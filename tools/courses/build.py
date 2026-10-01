#!/usr/bin/env python3
"""As páginas dos cursos da library, geradas a partir do repositório de cada curso.

    python tools/courses/build.py                      # todos os cursos de catalogo.json
    python tools/courses/build.py --assets ../nipscern-assets
    python tools/courses/build.py --no-fetch           # sem git fetch no repositório do curso
    python tools/courses/build.py --assets ../nipscern-assets \\
        --material eletronica-analogica-1=apostila.zip # PDF novo de um curso em apostila

Tudo o que está em library/courses/ sai daqui e não se edita à mão: rodar de novo
sobre o mesmo commit do curso dá os mesmos bytes, e um arquivo que esta
ferramenta não escreveu nesta rodada é apagado de lá. Acrescentar uma aula é
acrescentar a entrada dela em tools/courses/<curso>.json e rodar de novo. O
passo a passo, as dependências e o caminho dos arquivos pesados até o CDN estão
em tools/courses/README.md.
"""
import argparse
import html
import io
import json
import re
import sys
import urllib.parse
import zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

import apostila  # noqa: E402
import deck  # noqa: E402
import midia  # noqa: E402
import texto  # noqa: E402
from fonte import Fonte  # noqa: E402

RAIZ = AQUI.parents[1]
SAIDA = RAIZ / "library" / "courses"
SITE = "https://www.nipscern.com/"
_KATEX = RAIZ / "node_modules" / "katex" / "package.json"
KATEX_VERSAO = json.loads(_KATEX.read_text(encoding="utf-8"))["version"] if _KATEX.exists() else None
e = html.escape


# ------------------------------------------------------------------ o que foi escrito nesta rodada

class Escrita:
    """Grava só o que mudou e lembra de tudo o que gravou, para apagar o resto."""

    def __init__(self):
        self.escritos = set()

    def grava(self, caminho, conteudo):
        caminho = Path(caminho)
        caminho.parent.mkdir(parents=True, exist_ok=True)
        dados = conteudo.encode("utf-8") if isinstance(conteudo, str) else conteudo
        if caminho.exists():
            atual = caminho.read_bytes()
            # o clone está em autocrlf: o arquivo no disco pode ter CRLF e ser o mesmo
            if atual == dados or (isinstance(conteudo, str) and atual.replace(b"\r\n", b"\n") == dados):
                self.escritos.add(caminho.resolve())
                return
        caminho.write_bytes(dados)
        self.escritos.add(caminho.resolve())

    def limpa(self, pasta):
        apagados = []
        for arq in sorted(Path(pasta).rglob("*")):
            if arq.is_file() and arq.resolve() not in self.escritos:
                arq.unlink()
                apagados.append(arq)
        for d in sorted((p for p in Path(pasta).rglob("*") if p.is_dir()), key=lambda p: -len(p.parts)):
            if not any(d.iterdir()):
                d.rmdir()
        return apagados


# ------------------------------------------------------------------ a moldura: i18n e o esqueleto da página

I18N = json.loads((RAIZ / "data" / "i18n.json").read_text(encoding="utf-8"))


def t(chave):
    """O texto em inglês da chave, que a página traz de fábrica; o i18n.js troca pelo idioma escolhido."""
    for lang in I18N:
        no = I18N[lang]
        for parte in chave.split("."):
            no = no.get(parte) if isinstance(no, dict) else None
        if not isinstance(no, str):
            raise SystemExit(f"a chave {chave} falta em data/i18n.json ({lang})")
    no = I18N["en"]
    for parte in chave.split("."):
        no = no[parte]
    return no


def rotulo(chave, tag="span", classe=""):
    c = f' class="{classe}"' if classe else ""
    return f'<{tag}{c} data-i18n="courses.{chave}">{e(t("courses." + chave))}</{tag}>'


def aria(chave):
    """aria-label e title traduzíveis, com o inglês de fábrica."""
    v = e(t("courses." + chave))
    return (f'aria-label="{v}" title="{v}" data-i18n-aria="courses.{chave}" data-i18n-title="courses.{chave}"')


def token_de_cache():
    """O ?v= que as páginas do site usam hoje. O hook reescreve no commit; ler o atual evita diff à toa."""
    m = re.search(r"main\.min\.css\?v=([A-Za-z0-9._-]+)", (RAIZ / "index.html").read_text(encoding="utf-8"))
    return m.group(1)


def prefixo(rel):
    """De library/courses/limiar/index.html até a raiz do site: ../../../"""
    return "../" * (len(Path(rel).parts) - 1)


def url_publica(rel):
    return SITE + str(Path(rel).parent.as_posix()) + "/"


def esqueleto(rel, titulo, descricao, corpo, token, css=(), sem_moldura=False, js=None, corpo_classe="", corpo_estilo=""):
    p = prefixo(rel)
    canon = url_publica(rel)
    estilos = "".join(f'\n  <link rel="stylesheet" href="{p}{c}?v={token}">' for c in css)
    fontes = base = ""
    if not sem_moldura:
        fontes = (f'\n  <link rel="preload" href="{p}assets/fonts/geist-var-latin.woff2" as="font" type="font/woff2" crossorigin>'
                  f'\n  <link rel="preload" href="{p}assets/fonts/bodoni-var-latin.woff2" as="font" type="font/woff2" crossorigin>')
        base = f'\n  <link rel="stylesheet" href="{p}assets/css/main.min.css?v={token}">'
    scripts = js if js is not None else (f'  <script type="module" src="{p}assets/js/main.min.js?v={token}"></script>\n'
                                         f'  <script type="module" src="{p}assets/js/courses.min.js?v={token}"></script>\n')
    moldura_ini = ("" if sem_moldura else
                   '  <a href="#main" class="skip-link" data-i18n="nav.skip">Skip to content</a>\n'
                   '  <nav id="nav" role="navigation" aria-label="Main navigation"></nav>\n\n'
                   '  <main id="main">\n')
    moldura_fim = "" if sem_moldura else '  </main>\n\n  <footer id="footer" role="contentinfo"></footer>\n\n'
    cls = f' class="{corpo_classe}"' if corpo_classe else ""
    # A cor de um curso que não é a do Limiar, a de fábrica de courses.css, vem
    # no estilo do corpo: as variáveis --cr-accent passam para tudo embaixo.
    cls += f' style="{corpo_estilo}"' if corpo_estilo else ""
    return f"""<!DOCTYPE html>
<!-- Gerado por tools/courses/build.py. Não edite: rode a ferramenta de novo. -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>try{{var l=localStorage.getItem('nipscern_lang');if(l&&['en','pt','fr','no'].indexOf(l)>-1)document.documentElement.lang=l;}}catch(e){{}}</script>
  <title>{e(titulo)}</title>
  <meta name="description" content="{e(descricao)}">

  <meta property="og:type"  content="website">
  <meta property="og:url"   content="{canon}">
  <meta property="og:title" content="{e(titulo)}">
  <meta property="og:description" content="{e(descricao)}">
  <meta property="og:image" content="{SITE}assets/images/og-default.png">

  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="{canon}">

  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/assets/icons/icon_home_nipscern.svg" type="image/svg+xml">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png">
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">{fontes}
  <link rel="stylesheet" href="{p}assets/css/icons/library-courses.css?v={token}">{base}{estilos}
</head>
<body{cls}>

{moldura_ini}{corpo}
{moldura_fim}{scripts}  <script src="{p}assets/js/analytics.min.js?v={token}" defer></script>
</body>
</html>
"""


# ------------------------------------------------------------------ peças das páginas

IDIOMA = '<span class="content-lang-badge" data-content-lang="pt"></span>'
LANG_PT = ' lang="pt-BR"'


def migalhas(itens):
    """A trilha de volta: [(texto_html, href ou None)]."""
    partes = []
    for i, (txt, href) in enumerate(itens):
        if i:
            partes.append('<i class="ph ph-caret-right" aria-hidden="true"></i>')
        partes.append(f'<a href="{href}">{txt}</a>' if href else f'<span aria-current="page">{txt}</span>')
    return f'<nav class="cr-crumbs fade-up" aria-label="Breadcrumb">{"".join(partes)}</nav>'


def fichas(itens):
    """Os fatos numa linha, cada um com o ícone e o rótulo para leitor de tela: [(ícone, chave, valor)].

    O valor é texto do curso, em português. Um quarto elemento False diz que
    ele é número com rótulo do site, que o i18n.js traduz, e aí não leva o
    lang do português. O último item é o selo da língua do conteúdo, que o
    main.js preenche com a bandeira e o nome."""
    lis = "".join(f'<li><i class="ph ph-{ic}" aria-hidden="true"></i>{rotulo(ch, classe="sr-only")}'
                  f'<span{LANG_PT if (resto[0] if resto else True) else ""}>{valor}</span></li>'
                  for ic, ch, valor, *resto in itens)
    return f'<ul class="cr-facts fade-up">{lis}<li class="cr-facts-lang">{IDIOMA}</li></ul>'


def programa(chave, id_, miolo, nota=""):
    """Uma parte da página do curso, lida como programa impresso: o nome na margem, o conteúdo ao lado."""
    return (f'<section class="cr-ed" aria-labelledby="{id_}">'
            f'<div class="cr-ed-side fade-up"><h2 class="cr-ed-label" id="{id_}">{rotulo(chave)}</h2>{nota}</div>'
            f'<div class="cr-ed-body fade-up">{miolo}</div></section>')


def titulo(icone, chave, id_, extra=""):
    """O título de uma banda: um ícone e uma palavra, sem o rótulo repetido em cima."""
    return (f'<h2 class="cr-h2 fade-up" id="{id_}"><i class="ph ph-{icone}" aria-hidden="true"></i>'
            f'{rotulo(chave)}{extra}</h2>')


def banda(miolo, rotulo_id=None, lit=True, classe=""):
    classes = " ".join(c for c in ("section seam cr-band", "section--lit" if lit else "", classe) if c)
    ref = f' aria-labelledby="{rotulo_id}"' if rotulo_id else ""
    return (f'    <section class="{classes}" style="--seam-from:var(--bg-0)"{ref}>\n'
            f'      <div class="container">\n{miolo}\n      </div>\n    </section>\n')


def hero(fundo_url, crumbs, texto_html, lado_html="", classe=""):
    fundo = (f'<div class="cr-hero-bg" aria-hidden="true"><img src="{fundo_url}" alt="" decoding="async"></div>'
             if fundo_url else "")
    lado = f'\n          <div class="cr-hero-side">{lado_html}</div>' if lado_html else ""
    return f"""    <header class="cr-hero {classe}">
      {fundo}
      <div class="page-hero-inner cr-hero-inner">
        {crumbs}
        <div class="cr-hero-grid">
          <div class="cr-hero-text">
            {texto_html}
          </div>{lado}
        </div>
      </div>
    </header>
"""


def botao(href, icone, chave, primario=False, fora=False, pequeno=False, extra=""):
    classes = "btn glass-btn " + ("btn-primary" if primario else "btn-ghost") + (" btn-sm" if pequeno else "")
    alvo = ' target="_blank" rel="noopener"' if fora else ""
    return f'<a class="{classes}" href="{e(href)}"{alvo}{extra}><i class="ph ph-{icone}" aria-hidden="true"></i>{rotulo(chave)}</a>'


# ------------------------------------------------------------------ o curso

class Curso:
    def __init__(self, arquivo, args):
        self.arquivo = Path(arquivo)
        self.cfg = json.loads(self.arquivo.read_text(encoding="utf-8"))
        self.slug = self.cfg["slug"]
        repo = Path(args.source) if args.source else (RAIZ / self.cfg["fonte"]["repositorio"]).resolve()
        self.fonte = Fonte(repo, args.ref or self.cfg["fonte"]["ref"], buscar=not args.no_fetch)
        # As correções que o site faz no texto do curso, antes de qualquer
        # leitura: o deck, o roteiro e o README já saem corrigidos daqui.
        for a in self.cfg["aulas"]:
            for c in a.get("correcoes", []):
                self.fonte.corrige(c["arquivo"], c["de"], c["para"])
        self.raiz = f"library/courses/{self.slug}/"
        self.media = SAIDA / self.slug / "media"
        self.cdn = midia.Cdn(AQUI / f"{self.slug}.cdn.json", f"courses/{self.slug}", args.assets)
        self.midias = {}          # chave da mídia -> nome do arquivo em media/
        self.aulas = []

    # ---------------------------------------------------------- endereços

    def site(self, rel, alvo):
        """Endereço de `alvo`, um caminho a partir da raiz do site, visto da página `rel`."""
        return prefixo(rel) + alvo

    def url_midia(self, arquivo, rel):
        return self.site(rel, self.raiz + "media/" + arquivo)

    # ---------------------------------------------------------- mídia com nome pelo conteúdo

    def poe_midia(self, chave, dados, nome, ext):
        """Grava em media/ com o resumo do conteúdo no nome e devolve o nome do arquivo."""
        base = re.sub(r"[^a-z0-9-]+", "-", nome.lower()).strip("-")
        arquivo = f"{base}.{midia.resumo(dados)}.{ext}"
        self.escrita.grava(self.media / arquivo, dados)
        self.midias[chave] = arquivo
        return arquivo

    def imagem_do_repo(self, caminho, caixa=None, encaixe="cover"):
        chave = (caminho, caixa, encaixe)
        if chave in self.midias:
            return self.midias[chave]
        dados = self.fonte.ler(caminho)
        nome = Path(caminho).stem
        if caminho.endswith(".svg"):
            return self.poe_midia(chave, dados, nome, "svg")
        return self.poe_midia(chave, midia.webp(dados, caixa=caixa, encaixe=encaixe), nome, "webp")

    # ---------------------------------------------------------- as obras citadas

    def obra(self, slug):
        o = self.cfg["obras"].get(slug)
        if not o:
            raise SystemExit(f"a obra {slug} não está em obras, em {self.arquivo.name}")
        return o

    def capa_da_obra(self, slug):
        """A primeira página da obra, quando há PDF aberto; sem PDF aberto, não há capa.

        capa_imagem é para o caso da nota de Cauchy: a Gallica serve a página
        como imagem, em domínio público, mas recusa o PDF de um trecho a pedidos
        automáticos. A imagem é a mesma primeira página."""
        o = self.obra(slug)
        if not (o.get("pdf_aberto") or o.get("capa_imagem")):
            return None
        chave = ("capa", slug)
        if chave not in self.midias:
            if o.get("capa_imagem"):
                imagem = midia.baixa(o["capa_imagem"], f"capa-{slug}.img")
                capa = midia.webp(imagem, caixa=(140, 187), grafico=False)
            else:
                pdf = midia.baixa(o["pdf_aberto"], f"pdf-{slug}.pdf")
                if not pdf.startswith(b"%PDF"):
                    raise SystemExit(f"{o['pdf_aberto']} não devolveu um PDF")
                # 280 px: o dobro do maior lugar em que a capa aparece, os 132 px do artigo do projeto
                capa = midia.primeira_pagina(pdf, 280, o.get("pagina_da_capa", 0))
            self.poe_midia(chave, capa, f"capa-{slug}", "webp")
        return self.midias[chave]

    def referencia(self, slug, rel, grande=False):
        """Uma obra na lista: a primeira página, se o PDF é aberto, e a citação com o link oficial."""
        o = self.obra(slug)
        capa = self.capa_da_obra(slug)
        link = e(o["link"])
        figura = (f'<a class="cr-ref-cover" href="{link}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">'
                  f'<img src="{self.url_midia(capa, rel)}" alt="" width="240" height="320" loading="lazy" decoding="async"></a>'
                  if capa else "")
        nota = f'<p class="cr-ref-note">{e(o["nota"])}</p>' if o.get("nota") else ""
        pdf = (f'<a class="cr-ref-link" href="{e(o["pdf_link"])}" target="_blank" rel="noopener"><span class="cr-wave">PDF</span>'
               f'<i class="ph ph-file-pdf" aria-hidden="true"></i></a>' if o.get("pdf_link") else "")
        classes = "cr-ref" + (" cr-ref--grande" if grande else "") + ("" if capa else " cr-ref--sem-capa")
        return (f'<li class="{classes}" lang="pt-BR">{figura}<div class="cr-ref-body">'
                f'<p class="cr-ref-title" lang="{o.get("lingua", "en")}"><a href="{link}" target="_blank" rel="noopener"><span class="cr-wave cr-wave--quiet">{e(o["titulo"])}</span></a></p>'
                f'<p class="cr-ref-by">{e(o["autores"])} · <span class="cr-mono">{e(str(o["ano"]))}</span></p>'
                f'<p class="cr-ref-venue">{e(o["onde"])}</p>{nota}'
                f'<p class="cr-ref-links"><a class="cr-ref-link" href="{link}" target="_blank" rel="noopener"><span class="cr-wave">{e(o["rotulo_link"])}</span>'
                f'<i class="ph ph-arrow-square-out" aria-hidden="true"></i></a>{pdf}</p>'
                f'</div></li>')

    # ---------------------------------------------------------- a rodada inteira

    def gera(self, escrita, token):
        self.escrita = escrita
        self.token = token
        cfg = self.cfg
        f = self.fonte

        # A leitura de onde saiu o texto da página do curso. Se o README da raiz
        # mudar, o texto curado em <curso>.json pode ter ficado para trás.
        leitura = cfg["fonte"]["leitura_da_raiz"]
        h = midia.resumo(f.ler(leitura), 16)
        if cfg["fonte"].get("resumo_da_leitura") != h:
            print(f"AVISO: {leitura} mudou desde a curadoria do texto do curso (resumo {h}); "
                  f"revise os textos de {self.arquivo.name} e atualize fonte.resumo_da_leitura.")
        self.confere_fontes()

        # O que é do curso inteiro e fica no CDN ou no site.
        materiais = cfg["materiais_do_curso"]
        self.url_guia = self.cdn.publica(materiais["guia"], f.ler(materiais["guia"]), f"{self.slug}-guia-de-instalacao.pdf")
        self.req = self.raiz + "materials/requirements.txt"
        escrita.grava(RAIZ / self.req, f.texto(materiais["requirements"]))

        # A capa do curso: a imagem, e uma cópia pequena e desfocada para o fundo do hero.
        capa = cfg["capa"]
        self.capa = self.imagem_do_repo(capa["arquivo"], caixa=(520, 650))
        from PIL import Image, ImageFilter
        im = Image.open(io.BytesIO(f.ler(capa["arquivo"]))).convert("RGB")
        im.thumbnail((720, 720))
        im = im.filter(ImageFilter.GaussianBlur(18))
        b = io.BytesIO()
        im.save(b, "WEBP", quality=70, method=6)
        self.fundo = self.poe_midia(("fundo",), b.getvalue(), f"{self.slug}-fundo", "webp")

        self.aulas = [self.gera_aula(a) for a in cfg["aulas"]]
        self.gera_pagina_do_curso()

    def confere_fontes(self):
        """As fontes dos slides no site têm de ser as do infra/fontes do curso.

        Elas ficam em assets/fonts/, sem resumo no nome, como as outras fontes do
        site, e por isso não são reescritas aqui: uma fonte trocada no lugar
        seria servida velha pelo cache de um ano da borda. O .json guarda o
        resumo de cada arquivo de origem de quando o woff2 foi feito; se o curso
        trocar uma fonte, isto avisa, e a fonte nova entra com nome novo, à mão.
        (Comparar o woff2 gerado de novo não serve: o fontTools grava no
        cabeçalho a hora da conversão, e os bytes nunca saem iguais.)
        """
        import hashlib
        for origem, item in self.cfg["fontes"].items():
            if not (RAIZ / item["site"]).exists():
                raise SystemExit(f"{item['site']} não existe no site")
            if hashlib.sha256(self.fonte.ler(origem)).hexdigest() != item["sha256"]:
                print(f"AVISO: {origem} mudou no curso desde que {item['site']} foi feito; "
                      f"veja tools/courses/README.md, as fontes dos slides")

    # ---------------------------------------------------------- uma aula

    def gera_aula(self, a):
        f = self.fonte
        pasta = a["pasta"]
        base = f"{self.raiz}{a['slug']}/"
        rel_aula, rel_deck = base + "index.html", base + "slides/index.html"
        rel_rot, rel_cod = base + "study-guide/index.html", base + "code/index.html"
        readme = f.texto(f"{pasta}/README.md")
        tema_da_aula = re.match(r"# Aula \d+: (.+)", readme).group(1).strip()
        _, secs = texto.secoes(readme)

        # ---- o deck
        arquivos, videos = deck.mapa_da_aula(f, pasta)
        indice, slides = deck.le_deck(f, pasta)
        icones = deck.icones_do_modelo(f)
        caixas = deck.caixas_das_imagens(slides)
        mp4s = {mp4: nome for nome, (_, mp4) in videos.items()}
        enderecos = {}
        for blob, caminho in arquivos.items():
            if blob in mp4s:
                enderecos[blob] = self.cdn.publica(caminho, f.ler(caminho), f"{self.slug}-aula-{a['n']:02d}-{mp4s[blob]}.mp4")
            else:
                l, h, fit = caixas.get(blob, (960, 540, "contain"))
                enderecos[blob] = self.url_midia(self.imagem_do_repo(caminho, (l, h), fit), rel_deck)
        traduzidos = [(i, deck.traduz(html_, enderecos, icones)) for i, html_ in slides]
        n_videos = sum(1 for _, h_ in traduzidos if "data-video=" in h_)

        pdf_slides = f.ler(f"{pasta}/{a['pdf_dos_slides']}")
        for c in a.get("correcoes_pdf", []):
            pdf_slides = midia.corrige_pdf(pdf_slides, c["pagina"], c["trocas"], f)
        url_pdf = self.cdn.publica(f"{pasta}/{a['pdf_dos_slides']}", pdf_slides, f"{self.slug}-aula-{a['n']:02d}-slides.pdf")
        capa_aula = self.poe_midia(("capa-aula", a["n"]), midia.primeira_pagina(pdf_slides, 1280),
                                   f"{self.slug}-aula-{a['n']:02d}-capa", "webp")
        folha = f"{pasta}/folha-de-topicos.pdf"
        url_folha = self.cdn.publica(folha, f.ler(folha), f"{self.slug}-aula-{a['n']:02d}-folha-de-topicos.pdf")
        self.escrita.grava(RAIZ / rel_deck, self.pagina_do_deck(a, indice, traduzidos, rel_deck, url_pdf))

        # ---- o código
        retidos = a.get("codigo_retido", {})
        codigo = []
        for caminho in f.lista(f"{pasta}/codigo"):
            if "__pycache__" in caminho or caminho[len(pasta) + 1:] in retidos or not caminho.endswith(".py"):
                continue
            fonte_py = f.texto(caminho)
            nome = Path(caminho).name
            self.escrita.grava(RAIZ / base / "code" / nome, fonte_py)
            doc = re.match(r'\s*"""(.+?)(?:\n|""")', fonte_py)
            codigo.append({"nome": nome, "caminho": caminho, "texto": fonte_py,
                           "linhas": fonte_py.count("\n") + (0 if fonte_py.endswith("\n") else 1),
                           "resumo": doc.group(1).strip() if doc else ""})
        for r in retidos:
            if not f.existe(f"{pasta}/{r}"):
                print(f"AVISO: {pasta}/{r} está em codigo_retido e não existe mais na aula")

        # ---- o que o site publicou, para os links que o README e o roteiro fazem
        def publicados(rel):
            m = {
                f"{pasta}/roteiro.md": self.site(rel, base + "study-guide/"),
                f"{pasta}/folha-de-topicos.pdf": url_folha,
                f"{pasta}/{a['pdf_dos_slides']}": url_pdf,
                f"{pasta}/slides.py": self.site(rel, base + "slides/"),
                "infra": self.url_guia, "infra/": self.url_guia, "infra/README.md": self.url_guia,
                "infra/guia-de-instalacao.pdf": self.url_guia,
                "infra/fontes": self.site(rel, "credits.html"),
                "infra/requirements.txt": self.site(rel, self.req),
            }
            for c in codigo:
                m[c["caminho"]] = self.site(rel, base + f"code/#{_id_arquivo(c['nome'])}")
            for (chave, *_), arq in list(self.midias.items()):
                if isinstance(chave, str) and chave.startswith(pasta + "/figuras/"):
                    m[chave] = self.url_midia(arq, rel)
            return m

        ren = texto.Renderizador(publicados(rel_aula))

        def sec_md(inicio):
            titulo_s, corpo = texto.secao(secs, inicio)
            if corpo is None:
                raise SystemExit(f"{pasta}/README.md não tem a seção {inicio!r}")
            return titulo_s, ren.html(corpo, f"{pasta}/README.md", rebaixa=2)

        _, tema = sec_md("Tema")
        _, pratica = sec_md("Prática na aula")
        titulo_entrega, entrega = sec_md("Entrega")
        _, corpo_estudo = texto.secao(secs, "Para estudar")
        intro_estudo, itens_estudo = texto.estudo_da_semana(corpo_estudo)

        # ---- o roteiro e o código, cada um na sua página
        ren_rot = texto.Renderizador(publicados(rel_rot), ancora_de_slide=lambda n: f"../slides/#{n}")
        rot_md = f.texto(f"{pasta}/roteiro.md")
        rot_titulo = re.match(r"# (.+)", rot_md).group(1).strip()
        rot_html = ren_rot.html(rot_md, f"{pasta}/roteiro.md", sem_titulo=True)
        self.escrita.grava(RAIZ / rel_rot, self.pagina_do_roteiro(a, rot_titulo, rot_html, rel_rot))
        self.escrita.grava(RAIZ / rel_cod, self.pagina_do_codigo(a, tema_da_aula, codigo, bool(retidos), rel_cod))

        info = {
            "cfg": a, "titulo": tema_da_aula[0].upper() + tema_da_aula[1:], "rel": rel_aula, "capa": capa_aula,
            "n_slides": len(traduzidos), "n_videos": n_videos, "url_pdf": url_pdf, "url_folha": url_folha,
            "tema": tema, "pratica": pratica, "entrega": entrega,
            "prazo": texto.data_do_titulo(titulo_entrega, a["data"][:4]),
            "intro_estudo": ren.html(intro_estudo, f"{pasta}/README.md") if intro_estudo else "",
            "estudo": [self.item_de_estudo(i, ren, pasta, rel_aula) for i in itens_estudo],
            "creditos": self.creditos(secs, pasta, ren), "codigo": codigo, "retidos": bool(retidos),
        }
        self.escrita.grava(RAIZ / rel_aula, self.pagina_da_aula(info))
        return info

    def creditos(self, secs, pasta, ren):
        """A seção de créditos do README: a introdução, a tabela e a nota que vem logo depois dela.

        O que vem depois da nota, numa lista, já é outro assunto no README da aula
        1 (os arquivos de código), e fica de fora.
        """
        _, corpo = texto.secao(secs, "Créditos das imagens")
        if corpo is None:
            return ""
        guardados, viu_tabela = [], False
        for b in re.split(r"\n\s*\n", corpo.strip()):
            if b.lstrip().startswith("|"):
                viu_tabela = True
            elif viu_tabela and b.lstrip().startswith("- "):
                break
            guardados.append(b)
        return ren.html("\n\n".join(guardados), f"{pasta}/README.md")

    def item_de_estudo(self, item, ren, pasta, rel):
        if item["tipo"] == "texto":
            partes = texto.leitura(item["md"])
            if partes:
                return {"tipo": "leitura", **partes}
            return {"tipo": "texto", "html": ren.html(item["md"], f"{pasta}/README.md")}
        v = midia.youtube(item["id"])
        if v["canal"] != item["canal_citado"]:
            print(f"AVISO: o README cita {item['canal_citado']} e o YouTube diz {v['canal']} para {item['id']}")
        if item["titulo_citado"].lower().rstrip("?!. ") not in v["titulo"].lower():
            print(f"AVISO: título citado {item['titulo_citado']!r}, e no YouTube {v['titulo']!r}")
        miniatura = self.poe_midia(("yt", v["id"]), v["miniatura"], f"yt-{v['id']}", "webp")
        return {"tipo": "video", **item, "titulo": v["titulo"], "canal": v["canal"], "url": v["url"],
                "miniatura": self.url_midia(miniatura, rel)}

    # ---------------------------------------------------------- o deck

    def pagina_do_deck(self, a, indice, slides, rel, url_pdf):
        p = prefixo(rel)
        # As imagens entram por data-src, e o slides.js carrega as do slide atual e
        # as dos vizinhos. Com src direto, as seções, que estão todas no DOM,
        # baixariam o deck inteiro na abertura, quadro parado de vídeo incluído.
        corpo = "\n".join(re.sub(r'(<img\b[^>]*?)\ssrc="', r'\1 data-src="', s) for _, s in slides)
        # A anotação do <aside> vira parágrafos, com os vetores pelo KaTeX: é o
        # HTML que o slides.js põe no painel de anotações.
        notas_html = iter(texto.notas_em_html(re.findall(r"<aside>(.*?)</aside>", corpo, re.S)))
        corpo = re.sub(r"<aside>(.*?)</aside>", lambda m: f"<aside>{next(notas_html)}</aside>", corpo, flags=re.S)
        barra = f"""  <div class="deck-progress" aria-hidden="true"><span id="progresso"></span></div>
  <div class="deck-bar" id="barra" role="toolbar" {aria("slides")}>
    <a class="deck-btn" href="../" {aria("back_to_class")}><i class="ph ph-arrow-left" aria-hidden="true"></i></a>
    <span class="deck-sep" aria-hidden="true"></span>
    <button type="button" class="deck-btn" id="anterior" {aria("v_prev")}><i class="ph ph-caret-left" aria-hidden="true"></i></button>
    <span class="deck-count" id="contador" aria-live="polite">1 / {len(slides)}</span>
    <button type="button" class="deck-btn" id="proximo" {aria("v_next")}><i class="ph ph-caret-right" aria-hidden="true"></i></button>
    <span class="deck-sep" aria-hidden="true"></span>
    <button type="button" class="deck-btn" id="botao-notas" aria-pressed="false" {aria("v_notes")}><i class="ph ph-notebook" aria-hidden="true"></i></button>
    <button type="button" class="deck-btn" id="botao-tela" {aria("v_fullscreen")}><i class="ph ph-arrows-out-simple" aria-hidden="true"></i></button>
    <button type="button" class="deck-btn" id="botao-ajuda" aria-expanded="false" aria-controls="ajuda" {aria("v_keys")}><i class="ph ph-question" aria-hidden="true"></i></button>
  </div>"""
        teclas = "".join(f'<li data-i18n="courses.{k}">{e(t("courses." + k))}</li>'
                         for k in ("v_k_next", "v_k_prev", "v_k_click", "v_k_f", "v_k_n", "v_k_h", "v_k_hash", "v_k_touch"))
        ajuda = f"""  <div class="deck-help" id="ajuda" role="dialog" aria-modal="false" aria-labelledby="ajuda-titulo" hidden>
    <div class="deck-help-head"><h2 id="ajuda-titulo" data-i18n="courses.v_keys">{e(t('courses.v_keys'))}</h2>
      <button type="button" class="deck-btn" id="fecha-ajuda" {aria("v_close")}><i class="ph ph-x" aria-hidden="true"></i></button></div>
    <ul>{teclas}</ul>
  </div>"""
        notas = (f'  <aside class="deck-notes" id="notas" lang="pt-BR" hidden {aria("v_notes")}>'
                 f'<div class="deck-notes-text" id="notas-texto"></div>'
                 f'<p class="deck-notes-vazio" id="notas-vazio" data-i18n="courses.v_no_notes" hidden>{e(t("courses.v_no_notes"))}</p></aside>')
        aviso = (f'  <p class="deck-aviso" id="aviso-video" role="status" hidden><i class="ph ph-warning-circle" aria-hidden="true"></i>'
                 f'{rotulo("v_video_error")} <a href="#" target="_blank" rel="noopener">{rotulo("v_video_open")}</a></p>')
        miolo = (f'  <div class="deck-view">\n  <div id="palco" class="deck-stage" lang="pt-BR" aria-roledescription="slides">\n{corpo}\n  </div>\n  </div>\n'
                 f'  <noscript><p class="deck-noscript"><a href="{e(url_pdf)}">PDF</a></p></noscript>\n'
                 f"{barra}\n{notas}\n{ajuda}\n{aviso}\n")
        js = f'  <script type="module" src="{p}assets/js/slides.min.js?v={self.token}"></script>\n'
        return esqueleto(rel, f"{indice['title']} | NIPS-CERN",
                         f"Slides of class {a['n']} of Limiar, the NIPS-CERN neural networks course, in Portuguese, with the presenter notes.",
                         miolo, self.token, css=("assets/css/slides.min.css", "assets/css/vendor/katex.min.css"),
                         sem_moldura=True, js=js, corpo_classe="deck")

    # ---------------------------------------------------------- o roteiro

    def pagina_do_roteiro(self, a, rot_titulo, rot_html, rel):
        p = prefixo(rel)
        crumbs = migalhas([(rotulo("title"), p + "library/courses/"), (e(self.cfg["nome"]), "../../"),
                           (f'{rotulo("class")} {a["n"]}', "../"), (rotulo("study_guide"), None)])
        topo = hero(self.url_midia(self.fundo, rel), crumbs,
                    f'<p class="eyebrow fade-up"><i class="ph ph-book-open-text" aria-hidden="true"></i>{rotulo("study_guide")}</p>'
                    f'<h1 class="display-md fade-up" lang="pt-BR">{e(rot_titulo)}</h1>'
                    + fichas([("calendar-blank", "when", e(a["quando"])), ("map-pin", "where", e(a["onde"]))])
                    + f'<div class="cr-actions fade-up">{botao("../slides/", "monitor-play", "open_slides", primario=True)}'
                      f'{botao("../", "arrow-left", "back_to_class")}</div>',
                    classe="cr-hero--slim")
        # O sumário ao lado, nas telas largas: os títulos ## do roteiro.
        sumario = "".join(f'<li><a href="#{i}">{txt}</a></li>'
                          for i, txt in re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', rot_html))
        corpo = (topo + '    <section class="section seam cr-band cr-band--guide" style="--seam-from:var(--bg-0)">\n'
                 f'      <div class="container cr-guide-grid">\n'
                 f'        <nav class="cr-toc" aria-labelledby="toc-t"><p class="cr-toc-title" id="toc-t">{rotulo("on_this_page")}</p>'
                 f'<ol lang="pt-BR">{sumario}</ol></nav>\n'
                 f'        <article class="cr-prose cr-guide" lang="pt-BR">\n{rot_html}\n        </article>\n'
                 f'      </div>\n    </section>\n')
        return esqueleto(rel, f"{rot_titulo} | Limiar | NIPS-CERN",
                         f"Study guide of class {a['n']} of Limiar, the NIPS-CERN neural networks course, in Portuguese.",
                         corpo, self.token, css=("assets/css/courses.min.css", "assets/css/vendor/katex.min.css"))

    # ---------------------------------------------------------- o código

    def pagina_do_codigo(self, a, tema_da_aula, codigo, retidos, rel):
        p = prefixo(rel)
        crumbs = migalhas([(rotulo("title"), p + "library/courses/"), (e(self.cfg["nome"]), "../../"),
                           (f'{rotulo("class")} {a["n"]}', "../"), (rotulo("code"), None)])
        # Com mais de um arquivo, a lista deles no alto, cada um levando ao seu:
        # o primeiro pode ter mil linhas, e o segundo fica longe.
        arquivos = ""
        if len(codigo) > 1:
            arquivos = (f'<nav class="cr-actions cr-files fade-up" aria-label="{e(t("courses.on_this_page"))}" '
                        f'data-i18n-aria="courses.on_this_page">'
                        + "".join(f'<a class="btn btn-sm btn-ghost glass-btn" href="#{_id_arquivo(c["nome"])}">'
                                  f'<i class="ph ph-file-code" aria-hidden="true"></i><span class="cr-mono">{e(c["nome"])}</span>'
                                  f'<span class="cr-muted"><span class="cr-mono">{c["linhas"]}</span> {rotulo("lines")}</span></a>'
                                  for c in codigo)
                        + '</nav>')
        topo = hero(self.url_midia(self.fundo, rel), crumbs,
                    f'<p class="eyebrow fade-up"><i class="ph ph-code" aria-hidden="true"></i>{rotulo("code")}</p>'
                    f'<h1 class="display-md fade-up" lang="pt-BR">Aula {a["n"]}: {e(tema_da_aula)}</h1>'
                    f'<p class="body-lg fade-up">{rotulo("code_intro")}</p>'
                    f'<div class="cr-actions fade-up">{botao("../", "arrow-left", "back_to_class")}{IDIOMA}</div>'
                    + arquivos,
                    classe="cr-hero--slim")
        blocos = []
        for c in codigo:
            ident = _id_arquivo(c["nome"])
            blocos.append(
                f'        <section class="cr-file fade-up" id="{ident}" aria-labelledby="{ident}-t">\n'
                f'          <header class="cr-file-head glass glass--flat">\n'
                f'            <div><h2 class="cr-file-name" id="{ident}-t"><i class="ph ph-file-code" aria-hidden="true"></i>{e(c["nome"])}</h2>\n'
                f'            <p class="cr-file-sum" lang="pt-BR">{e(c["resumo"])}</p></div>\n'
                f'            <div class="cr-file-actions"><span class="cr-mono cr-muted">{c["linhas"]} {rotulo("lines")}</span>'
                f'<a class="btn btn-sm btn-ghost glass-btn" href="{e(c["nome"])}" download>'
                f'<i class="ph ph-download-simple" aria-hidden="true"></i>{rotulo("download")}</a></div>\n'
                f'          </header>\n'
                f'          <pre class="cr-code" lang="pt-BR"><code>{_realca(c["texto"], ident)}</code></pre>\n'
                f'        </section>\n')
        aviso = (f'        <p class="cr-withheld"><i class="ph ph-lock" aria-hidden="true"></i>{rotulo("withheld")}</p>\n'
                 if retidos else "")
        corpo = topo + banda("".join(blocos) + aviso, lit=False)
        return esqueleto(rel, f"Código da aula {a['n']} | Limiar | NIPS-CERN",
                         f"Code of class {a['n']} of Limiar, the NIPS-CERN neural networks course: Python, highlighted, with downloads.",
                         corpo, self.token, css=("assets/css/courses.min.css",))

    # ---------------------------------------------------------- a aula

    def pagina_da_aula(self, i):
        a, rel = i["cfg"], i["rel"]
        p = prefixo(rel)
        crumbs = migalhas([(rotulo("title"), p + "library/courses/"), (e(self.cfg["nome"]), "../"),
                           (f'{rotulo("class")} {a["n"]}', None)])

        # O hero: o título e os fatos de um lado, a capa dos slides do outro.
        videos = (f'<span><span class="cr-mono">{i["n_videos"]}</span> {rotulo("n_videos")}</span>' if i["n_videos"] else "")
        capa = (f'<a class="cr-cover frame fade-up" href="slides/" {aria("open_slides")}>'
                f'<img src="{self.url_midia(i["capa"], rel)}" alt="" width="1280" height="720" decoding="async">'
                f'<span class="cr-play" aria-hidden="true"><i class="ph ph-play"></i></span>'
                f'<span class="cr-cover-tag" aria-hidden="true"><span><span class="cr-mono">{i["n_slides"]}</span> {rotulo("n_slides")}</span>'
                f'{videos}</span></a>'
                f'<p class="cr-cover-hint fade-up">{rotulo("keys_hint")} {rotulo("pdf_no_notes")}</p>')
        texto_hero = (f'<p class="eyebrow fade-up"><i class="ph ph-books" aria-hidden="true"></i>'
                      f'{e(self.cfg["nome"])} · {rotulo("class")} {a["n"]}</p>'
                      f'<h1 class="display-md cr-class-h1 fade-up" lang="pt-BR">{e(i["titulo"])}</h1>'
                      + fichas([("calendar-blank", "when", e(a["quando"])), ("map-pin", "where", e(a["onde"])),
                                ("user", "taught_by", e(self.cfg["quem_da"]))])
                      + f'<div class="cr-actions fade-up">{botao("slides/", "monitor-play", "open_slides", primario=True)}'
                        f'{botao("study-guide/", "book-open-text", "study_guide")}'
                        f'{botao(i["url_pdf"], "file-pdf", "slides_pdf", fora=True)}</div>')
        topo = hero(self.url_midia(self.fundo, rel), crumbs, texto_hero, capa)

        # A aula e o material, lado a lado.
        prazo = (f'<span class="cr-due"><i class="ph ph-calendar-check" aria-hidden="true"></i>{rotulo("due")} '
                 f'<time datetime="{i["prazo"]}" class="cr-mono">{i["prazo"][8:10]}/{i["prazo"][5:7]}</time></span>'
                 if i["prazo"] else "")
        plano = (f'<article class="cr-panel cr-plan glass fade-up" aria-labelledby="aula-t">'
                 f'<h2 class="cr-panel-title" id="aula-t"><i class="ph ph-notebook" aria-hidden="true"></i>{rotulo("the_class")}</h2>'
                 f'<section class="cr-block"><h3 class="cr-block-title">{rotulo("topic")}</h3><div class="cr-prose" lang="pt-BR">{i["tema"]}</div></section>'
                 f'<section class="cr-block"><h3 class="cr-block-title">{rotulo("in_class")}</h3><div class="cr-prose" lang="pt-BR">{i["pratica"]}</div></section>'
                 f'<section class="cr-block"><h3 class="cr-block-title">{rotulo("assignment")}{prazo}</h3><div class="cr-prose" lang="pt-BR">{i["entrega"]}</div></section>'
                 f'</article>')
        linhas = [
            ("book-open-text", "study_guide", "study_guide_desc", "study-guide/", False),
            ("file-pdf", "topic_sheet", "topic_sheet_desc", i["url_folha"], True),
            ("file-pdf", "install_guide", "install_guide_desc", self.url_guia, True),
        ]
        itens = "".join(
            f'<li><a class="cr-row" href="{e(href)}"{" target=_blank rel=noopener" if fora else ""}>'
            f'<i class="ph ph-{ic}" aria-hidden="true"></i><span class="cr-row-text"><strong>{rotulo(ch)}</strong>'
            f'<span>{rotulo(desc)}</span></span><i class="ph ph-{"arrow-square-out" if fora else "arrow-right"} cr-row-go" aria-hidden="true"></i></a></li>'
            for ic, ch, desc, href, fora in linhas)
        itens += (f'<li><a class="cr-row" href="{self.site(rel, self.req)}" download><i class="ph ph-file-text" aria-hidden="true"></i>'
                  f'<span class="cr-row-text"><strong class="cr-mono">requirements.txt</strong><span>{rotulo("requirements_desc")}</span></span>'
                  f'<i class="ph ph-download-simple cr-row-go" aria-hidden="true"></i></a></li>')
        cod = "".join(
            f'<li><a class="cr-row" href="code/#{_id_arquivo(c["nome"])}"><i class="ph ph-file-code" aria-hidden="true"></i>'
            f'<span class="cr-row-text"><strong class="cr-mono">{e(c["nome"])}</strong><span lang="pt-BR">{e(c["resumo"])}</span></span>'
            f'<span class="cr-mono cr-muted cr-row-n">{c["linhas"]}</span>'
            f'<i class="ph ph-arrow-right cr-row-go" aria-hidden="true"></i></a></li>' for c in i["codigo"])
        retido = (f'<p class="cr-withheld"><i class="ph ph-lock" aria-hidden="true"></i>{rotulo("withheld")}</p>'
                  if i["retidos"] else "")
        material = (f'<aside class="cr-panel cr-kit glass fade-up" aria-labelledby="material-t">'
                    f'<h2 class="cr-panel-title" id="material-t"><i class="ph ph-package" aria-hidden="true"></i>{rotulo("class_materials")}</h2>'
                    f'<ul class="cr-rows">{itens}</ul>'
                    f'<h3 class="cr-kit-sub"><i class="ph ph-code" aria-hidden="true"></i>{rotulo("code")}</h3>'
                    f'<ul class="cr-rows">{cod}</ul>{retido}</aside>')
        banda_aula = banda(f'<div class="cr-duo">{plano}{material}</div>', lit=True, classe="cr-band--first")

        # O estudo da semana.
        cartoes = []
        for it in i["estudo"]:
            if it["tipo"] == "video":
                cartoes.append(
                    f'<a class="cr-video glass glass--flat" href="{e(it["url"])}" target="_blank" rel="noopener">'
                    f'<span class="frame cr-video-thumb"><img src="{it["miniatura"]}" alt="" width="600" height="338" loading="lazy" decoding="async">'
                    f'<span class="cr-play cr-play--sm" aria-hidden="true"><i class="ph ph-play"></i></span></span>'
                    f'<span class="cr-video-body"><span class="cr-video-meta" lang="pt-BR">{e(it["serie"][0].upper() + it["serie"][1:])}, capítulo {e(it["capitulo"])}</span>'
                    f'<span class="cr-video-title" lang="en">{e(it["titulo"])}</span>'
                    f'<span class="cr-video-channel">{e(it["canal"])} · <span class="cr-wave">{rotulo("watch")}</span><i class="ph ph-arrow-square-out" aria-hidden="true"></i></span></span></a>')
            elif it["tipo"] == "leitura":
                # O texto com a mesma forma do vídeo ao lado: no lugar da miniatura, o
                # livro, com o título e o autor, e embaixo o capítulo, o título dele e o link.
                resto = f', {e(it["resto"])}' if it.get("resto") else ""
                cartoes.append(
                    f'<a class="cr-video cr-reading glass glass--flat" href="{e(it["url"])}" target="_blank" rel="noopener">'
                    f'<span class="frame cr-video-thumb cr-book" aria-hidden="true"><span class="cr-book-inner">'
                    f'<span class="cr-book-title" lang="en">{e(it["obra"])}</span>'
                    f'<span class="cr-book-author">{e(it["autor"])} · {e(it["ano"])}</span></span></span>'
                    f'<span class="cr-video-body"><span class="cr-video-meta" lang="pt-BR">{e(it["parte"][0].upper() + it["parte"][1:])}{resto}</span>'
                    f'<span class="cr-video-title" lang="en">{e(it["titulo"])}</span>'
                    f'<span class="cr-video-channel"><span class="cr-wave">{rotulo("read_online")}</span>'
                    f'<i class="ph ph-arrow-square-out" aria-hidden="true"></i></span></span></a>')
            else:
                cartoes.append(f'<div class="cr-read glass glass--flat"><i class="ph ph-book-open" aria-hidden="true"></i>'
                               f'<div class="cr-prose" lang="pt-BR">{it["html"]}</div></div>')
        intro = f'<div class="cr-intro cr-prose fade-up" lang="pt-BR">{i["intro_estudo"]}</div>' if i["intro_estudo"] else ""
        banda_estudo = banda(titulo("monitor-play", "study", "estudo-t") + intro
                             + f'<div class="cr-grid cr-grid--videos fade-up">{"".join(cartoes)}</div>', "estudo-t", lit=False)

        # As obras, e as outras fontes num quadro que se abre.
        refs = "".join(self.referencia(s, rel) for s in a.get("obras", []))
        outras = a.get("outras_fontes", [])
        lista_outras = "".join(
            f'<li><a href="{e(o["link"])}" target="_blank" rel="noopener">{e(o["titulo"])}</a>'
            + (f' <span class="cr-muted">{e(o["onde"])}</span>' if o.get("onde") else "") + "</li>" for o in outras)
        mais = (f'<details class="cr-more glass glass--flat fade-up"><summary><i class="ph ph-link" aria-hidden="true"></i>'
                f'{rotulo("other_sources")} <span class="cr-mono cr-muted">{len(outras)}</span>'
                f'<i class="ph ph-caret-down cr-more-caret" aria-hidden="true"></i></summary>'
                f'<ul class="cr-sources" lang="pt-BR">{lista_outras}</ul></details>' if outras else "")
        banda_obras = banda(titulo("books", "papers", "obras-t")
                            + f'<p class="cr-intro fade-up">{rotulo("papers_intro")}</p>'
                            + f'<ol class="cr-refs fade-up">{refs}</ol>{mais}', "obras-t", lit=True)

        banda_creditos = (banda(titulo("images", "credits", "creditos-t")
                                + f'<div class="cr-credits fade-up cr-prose" lang="pt-BR">{i["creditos"]}</div>',
                                "creditos-t", lit=False, classe="cr-band--last") if i["creditos"] else "")

        corpo = topo + banda_aula + banda_estudo + banda_obras + banda_creditos
        return esqueleto(rel, f"Aula {a['n']}: {i['titulo']} | Limiar | NIPS-CERN",
                         f"Class {a['n']} of Limiar, the NIPS-CERN neural networks course, in Portuguese: slides, study guide, code and readings.",
                         corpo, self.token, css=("assets/css/courses.min.css",))

    # ---------------------------------------------------------- o curso

    def gera_pagina_do_curso(self):
        cfg = self.cfg
        rel = self.raiz + "index.html"
        ren = texto.Renderizador({"guia": self.url_guia, "requirements": self.site(rel, self.req)})
        md = lambda s: ren.html(s, self.arquivo.name)  # noqa: E731
        crumbs = migalhas([(rotulo("title"), "../"), (e(cfg["nome"]), None)])
        s = cfg["secoes"]
        primeira = self.aulas[0]["cfg"]["slug"] + "/" if self.aulas else ""
        texto_hero = (f'<p class="eyebrow fade-up"><i class="ph ph-books" aria-hidden="true"></i>{rotulo("course")}</p>'
                      f'<h1 class="cr-course-name fade-up">{e(cfg["nome"])}</h1>'
                      f'<p class="cr-subtitle fade-up" lang="pt-BR">{e(cfg["subtitulo"])}</p>'
                      f'<p class="cr-lede fade-up" lang="pt-BR">{e(cfg["apresentacao"])}</p>'
                      + fichas([("user", "taught_by", e(cfg["quem_da"])), ("calendar-blank", "when", e(cfg["quando"])),
                                ("map-pin", "where", e(cfg["onde"]))])
                      + f'<div class="cr-actions fade-up">'
                        + (botao(primeira, "monitor-play", "open_first", primario=True) if primeira else "")
                        + f'{botao("#aulas-t", "list", "s_classes")}</div>')
        capa = (f'<figure class="cr-course-cover fade-up"><div class="frame"><img src="{self.url_midia(self.capa, rel)}" '
                f'alt="{e(cfg["capa"]["alt"])}" width="780" height="975" decoding="async"></div>'
                f'<figcaption lang="pt-BR">{e(cfg["capa"]["credito"])}</figcaption></figure>')
        topo = hero(self.url_midia(self.fundo, rel), crumbs, texto_hero, capa, classe="cr-hero--course")

        # Daqui para baixo, a página se lê como um programa de curso impresso: o
        # nome de cada parte na margem, em serifa, e o conteúdo ao lado, com um
        # fio entre uma parte e outra. Sem painel, sem ícone em título: o que
        # organiza é a tipografia.
        linha = programa

        def itens(md_lista):
            """As linhas "- ..." de uma lista em Markdown, cada uma já em HTML, sem o <p>."""
            return [re.sub(r"^<p>|</p>\s*$", "", md(l[2:]).strip())
                    for l in md_lista.split("\n") if l.startswith("- ")]

        # O nome, em três sentidos, como o slide 3 da aula 1 os mostra.
        n = s["nome"]
        sentidos = "".join(f'<li><span class="cr-meaning-n">{k}</span><span class="cr-meaning-t">{e(rot)}</span>'
                           f'<p>{e(frase)}</p></li>' for k, (rot, frase) in enumerate(n["sentidos"], 1))
        nome = (f'<p class="cr-ed-lede" lang="pt-BR">{e(n["abertura"])}</p>'
                f'<ol class="cr-meanings" lang="pt-BR">{sentidos}</ol>')

        # As aulas publicadas.
        cartoes = []
        for aula in self.aulas:
            c = aula["cfg"]
            cartoes.append(
                f'<a class="cr-class glass glass--flat" href="{c["slug"]}/">'
                f'<span class="frame cr-class-cover"><img src="{self.url_midia(aula["capa"], rel)}" alt="" width="1280" height="720" loading="lazy" decoding="async"></span>'
                f'<span class="cr-class-body"><span class="cr-class-n">{rotulo("class")} <span class="cr-mono">{c["n"]}</span></span>'
                f'<span class="cr-class-title" lang="pt-BR">{e(aula["titulo"])}</span>'
                f'<span class="cr-class-meta" lang="pt-BR">{e(c["quando"])}</span>'
                f'<span class="cr-class-meta" lang="pt-BR">{e(c["onde"])}</span>'
                f'</span></a>')
        contagem = (f'<p class="cr-ed-note">{rotulo("classes_online")}<br><span class="cr-mono">'
                    f'{len(self.aulas)} / {cfg["aulas_previstas"]}</span></p>')
        aulas = f'<div class="cr-grid cr-grid--classes">{"".join(cartoes)}</div>'

        # Aonde o curso chega, com o artigo do projeto embaixo do texto que o cita.
        aonde = (f'<div class="cr-prose cr-prose--lg" lang="pt-BR">{md(s["aonde"])}</div>'
                 f'<div class="cr-ed-ref"><p class="cr-ed-sub">{rotulo("project_paper")}</p>'
                 f'<ol class="cr-refs cr-refs--one">{self.referencia(cfg["artigo_do_projeto"], rel, grande=True)}</ol></div>')

        objetivos = f'<ul class="cr-goal-list" lang="pt-BR">{"".join(f"<li>{x}</li>" for x in itens(s["objetivos"]))}</ul>'

        agenda = "".join(f'<li><span class="cr-agenda-t">{e(tempo)}</span><span>{e(oque)}</span></li>'
                         for tempo, oque in s["aula"])
        formato = (f'<ol class="cr-agenda" lang="pt-BR">{agenda}</ol>'
                   f'<p class="cr-ed-sub">{rotulo("s_between")}</p><div class="cr-prose" lang="pt-BR">{md(s["entre_aulas"])}</div>')

        dados = f'<div class="cr-prose" lang="pt-BR">{md(s["dados"])}</div>'
        ferramentas = (f'<div class="cr-prose" lang="pt-BR">{md(s["ferramentas"])}</div>'
                       f'<div class="cr-actions">{botao(self.url_guia, "file-pdf", "install_guide", fora=True, pequeno=True)}'
                       f'<a class="btn btn-sm btn-ghost glass-btn" href="{self.site(rel, self.req)}" download>'
                       f'<i class="ph ph-download-simple" aria-hidden="true"></i><span class="cr-mono">requirements.txt</span></a></div>')

        banda_1 = banda(linha("s_name", "nome-t", nome) + linha("s_classes", "aulas-t", aulas, contagem)
                        + linha("s_goes", "aonde-t", aonde), classe="cr-band--first cr-band--ed")
        banda_2 = banda(linha("s_goals", "objetivos-t", objetivos) + linha("s_format", "formato-t", formato)
                        + linha("s_data", "dados-t", dados) + linha("s_tools", "ferramentas-t", ferramentas),
                        lit=False, classe="cr-band--last cr-band--ed")
        corpo = topo + banda_1 + banda_2
        self.escrita.grava(RAIZ / rel, esqueleto(
            rel, f"{cfg['nome']}: {cfg['subtitulo'].lower()} | NIPS-CERN",
            f"{cfg['nome']}, the NIPS-CERN neural networks course, taught in Portuguese at UFJF: classes, slides, study guides, code and readings.",
            corpo, self.token, css=("assets/css/courses.min.css",)))

    # ---------------------------------------------------------- o que a library inteira pede de cada curso

    estilo = ""   # a cor do curso, para o curso que não usa a de fábrica

    @property
    def data(self):
        return self.fonte.data

    def origem(self):
        return f"{self.fonte.ref} = {self.fonte.sha[:10]} ({self.fonte.data})"

    def paginas_do_sitemap(self):
        """(caminho, prioridade, frequência) de cada página do curso, para o sitemap."""
        yield self.raiz, "0.7", "weekly"
        for a in self.aulas:
            base = f"{self.raiz}{a['cfg']['slug']}/"
            yield base, "0.6", "monthly"
            yield base + "slides/", "0.5", "monthly"
            yield base + "study-guide/", "0.5", "monthly"
            yield base + "code/", "0.4", "monthly"

    def fatos_do_cartao(self):
        """Os fatos do cartão na coletânea: (chave do rótulo, valor, se o valor é texto em português)."""
        return [("period", self.cfg["periodo"]["texto"], True),
                ("classes_online", f"{len(self.aulas)} / {self.cfg['aulas_previstas']}", False)]

    def cartao_da_colecao(self, rel):
        cfg = self.cfg
        fatos = "".join(f'<span><span class="cr-card-k">{rotulo(k)}</span>'
                        f'<span class="cr-mono"{LANG_PT if pt else ""}>{e(v)}</span></span>'
                        for k, v, pt in self.fatos_do_cartao())
        estilo = f' style="{self.estilo}"' if self.estilo else ""
        return (f'<a class="cr-card glass" href="{self.slug}/"{estilo}>'
                f'<span class="frame cr-card-cover"><img src="{self.url_midia(self.capa, rel)}" alt="{e(cfg["capa"]["alt"])}" '
                f'width="780" height="975" loading="lazy" decoding="async"></span>'
                f'<span class="cr-card-body"><span class="cr-card-eyebrow">{rotulo("course")}</span>'
                f'<span class="cr-card-title">{e(cfg["nome"])}</span>'
                f'<span class="cr-card-sub" lang="pt-BR">{e(cfg["subtitulo"])}</span>'
                f'<span class="cr-card-line" lang="pt-BR">{e(cfg["linha"])}</span>'
                f'<span class="cr-card-facts">{fatos}</span>'
                f'<span class="cr-card-go"><span class="cr-wave">{rotulo("open_course")}</span><i class="ph ph-arrow-right" aria-hidden="true"></i></span>'
                f'<span class="cr-card-credit" lang="pt-BR">{e(cfg["capa"]["credito"])}</span>'
                f'</span></a>')


# ------------------------------------------------------------------ o curso em apostila

ROMANOS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]


def _data_br(iso):
    return f"{iso[8:10]}/{iso[5:7]}/{iso[:4]}"


def _maiuscula(texto_):
    return texto_[:1].upper() + texto_[1:]


def _capitulos(ap):
    """Capítulo 3, ou Capítulos 1 e 2: os números dos capítulos de uma parte, em português."""
    n = [c.numero for c in ap.capitulos]
    return f"Capítulo {n[0]}" if len(n) == 1 else f"Capítulos {', '.join(n[:-1])} e {n[-1]}"


class CursoDeApostila(Curso):
    """Um curso que chega como apostila em PDF, dividida em partes, sem repositório.

    A fonte de cada parte é o PDF publicado no CDN, que o manifesto
    <curso>.cdn.json localiza e cujo resumo ele confere: rodar de novo lê o que
    está publicado e dá os mesmos bytes, em qualquer máquina. Um PDF novo entra
    por --material <curso>=<zip, pasta ou PDF>, ganha no CDN a versão seguinte,
    e a página da parte se refaz a partir dele, do sumário à data. O que o
    .json escreve à mão, a tabela de modelos e as citações, é conferido contra
    o PDF a cada rodada.
    """

    def __init__(self, arquivo, args, material=None):
        self.arquivo = Path(arquivo)
        self.cfg = json.loads(self.arquivo.read_text(encoding="utf-8"))
        self.slug = self.cfg["slug"]
        self.raiz = f"library/courses/{self.slug}/"
        self.media = SAIDA / self.slug / "media"
        self.cdn = midia.Cdn(AQUI / f"{self.slug}.cdn.json", f"courses/{self.slug}", args.assets)
        self.midias = {}
        self.aulas = []
        self.partes = []
        self.material = material or {}
        esperados = {p["arquivo"] for p in self.cfg["partes"]}
        sobra = sorted(set(self.material) - esperados)
        if sobra:
            raise SystemExit(f"o material de {self.slug} traz {', '.join(sobra)}, que não é de parte nenhuma em "
                             f"{self.arquivo.name}; as partes esperam {', '.join(sorted(esperados))}")
        cor = self.cfg["cor"]
        r, g, b = (int(cor[k:k + 2], 16) for k in (1, 3, 5))
        self.estilo = (f"--cr-accent:{cor};--cr-accent-dim:rgba({r}, {g}, {b}, 0.14);"
                       f"--cr-accent-edge:rgba({r}, {g}, {b}, 0.32)")

    @property
    def data(self):
        """A lastmod do sitemap: a data do PDF mais novo, que o LaTeX grava nos metadados."""
        return max(x["ap"].data for x in self.partes)

    def origem(self):
        return ("PDFs novos: " + ", ".join(sorted(self.material))) if self.material else "os PDFs publicados no CDN"

    def parte(self, n):
        return next(x for x in self.partes if x["cfg"]["n"] == n)

    def pdf(self, x, rel, indice, topo=None):
        """O endereço que abre o PDF de uma parte na página `indice`, contada de 0, e no ponto `topo` dela.

        Vai pelo leitor de PDF do site, /pdf-viewer.html, e não direto ao
        arquivo, porque o leitor do navegador nem sempre obedece ao #page=: a
        extensão do Adobe Acrobat no Chrome abre na primeira página, e o celular
        baixa o arquivo. O endereço leva os parâmetros de abertura do PDF,
        #page=N e #view=FitH,topo, que o leitor do site lê como o do navegador
        leria; `rel` é a página onde o link fica."""
        ancora = f"page={indice + 1}" + (f"&view=FitH,{topo:g}" if topo is not None else "")
        return f"{prefixo(rel)}pdf-viewer.html?src={urllib.parse.quote(x['url'], safe=':/')}#{ancora}"

    # ---------------------------------------------------------- a rodada

    def gera(self, escrita, token):
        self.escrita = escrita
        self.token = token
        cfg = self.cfg
        for p in cfg["partes"]:
            origem = f"parte-{p['n']}"
            if p["arquivo"] in self.material:
                pdf = self.material[p["arquivo"]]
            elif origem in self.cdn.dados:
                pdf = self.cdn.le_publicado(origem)
            else:
                raise SystemExit(f"a parte {p['n']} de {cfg['nome']} ainda não tem PDF publicado: rode com "
                                 f"--material {self.slug}=<zip, pasta ou PDF com {p['arquivo']}>")
            ap = apostila.Apostila(pdf, f"{cfg['nome']}, parte {p['n']}")
            if ap.numeral != ROMANOS[p["n"]]:
                raise SystemExit(f"{p['arquivo']} é a parte {ap.numeral} pelos marcadores, e o .json diz {p['n']}")
            url = self.cdn.publica(origem, pdf, f"{self.slug}-apostila-parte-{p['n']}.pdf")
            self.partes.append({"cfg": p, "ap": ap, "url": url, "versao": self.cdn.dados[origem]["versao"],
                                "rel": f"{self.raiz}{p['slug']}/index.html"})
        self.confere_textos()
        self.gera_imagens()
        for x in self.partes:
            escrita.grava(RAIZ / x["rel"], self.pagina_da_parte(x))
        self.gera_pagina_do_curso()

    def confere_textos(self):
        """O que o .json cita da apostila tem de estar nela, e a tabela de modelos avisa quando a seção dela muda."""
        s = self.cfg["secoes"]
        m = s["modelos"]
        ap = self.parte(m["parte"])["ap"]
        secao = ap.texto_da_secao(m["secao"])
        h = midia.resumo(secao.encode("utf-8"), 16)
        if h != m["resumo_da_leitura"]:
            print(f"AVISO: a seção {m['secao']} da parte {m['parte']} mudou desde a curadoria da tabela de modelos "
                  f"(resumo {h}); revise secoes.modelos em {self.arquivo.name} e atualize resumo_da_leitura.")
        if m["abertura"] not in secao:
            raise SystemExit(f"a frase de abertura de secoes.modelos não está mais na seção {m['secao']} da apostila")
        self.destino_do_modelo = ap.destino_da_secao(m["secao"])
        self.citacoes = {}
        for c in s["metodo"] + [s["evolucao"]]:
            ap_ = self.parte(c["parte"])["ap"]
            indice = ap_.pagina_da_citacao(c["citacao"])
            if indice is None:
                raise SystemExit(f"a citação {c['citacao'][:60]!r}, em {self.arquivo.name}, não está mais na parte {c['parte']}")
            self.citacoes[c["citacao"]] = (indice, ap_.topo_da_citacao(c["citacao"], indice))

    def gera_imagens(self):
        """A capa do curso, o fundo do hero, e de cada parte a capa dela e uma figura para o cartão.

        Tudo sai do PDF, desenhado aqui, e nada é imagem feita à parte: a capa
        do curso é a capa da apostila, cortada em 4:5 a partir do alto; o fundo
        é a faixa colorida dessa capa, pequena e desfocada; a figura do cartão
        é a do .json, recortada da página e posta num quadro 16:9."""
        from PIL import Image, ImageFilter

        def png(im):
            b = io.BytesIO()
            im.save(b, "PNG")
            return b.getvalue()

        primeira = self.partes[0]["ap"]
        im = Image.open(io.BytesIO(primeira.pagina_png(0, 1040))).convert("RGB")
        self.capa = self.poe_midia(("capa",), midia.webp(png(im.crop((0, 0, 1040, 1300))), grafico=True),
                                   f"{self.slug}-capa", "webp")
        im = Image.open(io.BytesIO(primeira.faixa_da_capa(720))).convert("RGB").filter(ImageFilter.GaussianBlur(18))
        b = io.BytesIO()
        im.save(b, "WEBP", quality=70, method=6)
        self.fundo = self.poe_midia(("fundo",), b.getvalue(), f"{self.slug}-fundo", "webp")
        for x in self.partes:
            n, ap = x["cfg"]["n"], x["ap"]
            x["capa"] = self.poe_midia(("capa-parte", n), midia.webp(ap.pagina_png(0, 760), grafico=True),
                                       f"{self.slug}-parte-{n}-capa", "webp")
            x["figura"] = self.poe_midia(("figura", n), midia.webp(ap.figura(x["cfg"]["figura"]), grafico=True),
                                         f"{self.slug}-parte-{n}-figura", "webp")

    # ---------------------------------------------------------- a página de uma parte

    def pagina_da_parte(self, x):
        cfg, p, ap, rel, url = self.cfg, x["cfg"], x["ap"], x["rel"], x["url"]
        fora = ' target="_blank" rel="noopener"'
        seta = '<i class="ph ph-arrow-square-out" aria-hidden="true"></i>'
        mb = f"{ap.bytes / 1e6:.1f}".replace(".", ",")
        crumbs = migalhas([(rotulo("title"), prefixo(rel) + "library/courses/"), (e(cfg["nome"]), "../"),
                           (f'{rotulo("part")} {p["n"]}', None)])

        # O hero: o título da parte e os fatos de um lado, a capa dela do outro.
        texto_hero = (
            f'<p class="eyebrow fade-up"><i class="ph ph-books" aria-hidden="true"></i>'
            f'{e(cfg["nome"])} · {rotulo("part")} {p["n"]}</p>'
            f'<h1 class="display-md cr-class-h1 fade-up" lang="pt-BR">{e(ap.titulo)}</h1>'
            + fichas([("book-open-text", "chapters", e(_capitulos(ap))),
                      ("file-text", "pages", f'<span class="cr-mono">{ap.paginas}</span> {rotulo("n_pages")}', False),
                      ("clock-counter-clockwise", "version",
                       f'{rotulo("version")} <span class="cr-mono">{x["versao"]}</span>, '
                       f'<time class="cr-mono" datetime="{ap.data}">{_data_br(ap.data)}</time>', False),
                      ("user", "taught_by", e(cfg["quem_da"]))])
            + f'<div class="cr-actions fade-up">{botao(url, "file-pdf", "open_handout", primario=True, fora=True)}'
              f'{botao("#sumario-t", "list", "contents")}{botao("../", "arrow-left", "back_to_course")}</div>')
        capa = (f'<a class="cr-cover cr-cover--page frame fade-up" href="{e(url)}"{fora} {aria("open_handout")}>'
                f'<img src="{self.url_midia(x["capa"], rel)}" alt="" width="760" height="1075" decoding="async">'
                f'<span class="cr-cover-tag" aria-hidden="true"><span><span class="cr-mono">{ap.paginas}</span> {rotulo("n_pages")}</span>'
                f'<span><span class="cr-mono">{mb}</span> MB</span></span></a>'
                f'<p class="cr-cover-hint fade-up">{rotulo("pdf_hint")}</p>')
        topo = hero(self.url_midia(self.fundo, rel), crumbs, texto_hero, capa, classe="cr-hero--part")

        # A parte e o material, lado a lado: a abertura de cada capítulo, nas
        # palavras da apostila, e o que se abre dela.
        def na(entrada):
            """O endereço que abre a apostila no marcador `entrada`, na página e na altura dele."""
            return self.pdf(x, rel, entrada.indice, entrada.topo)

        def link(entrada, miolo):
            return (f'<a class="cr-ref-link" href="{e(na(entrada))}"{fora}>{miolo}'
                    f' <span class="cr-muted">{rotulo("page_abbr")} {e(entrada.rotulo)}</span>{seta}</a>')

        blocos = []
        for c in ap.capitulos:
            exercicios = next((s for s in c.secoes if not s.numero and s.titulo.startswith("Exercícios")), None)
            resumo = next((s for s in c.secoes if not s.numero and s.titulo.startswith("Resumo")), None)
            links = [link(c, f'<span class="cr-wave">{rotulo("read_chapter")}</span>')]
            if exercicios:
                respostas = (f' · <span class="cr-mono">{c.respondidos}</span> {rotulo("with_answer")}'
                             if c.respondidos < c.exercicios else "")
                links.append(link(exercicios, f'<span class="cr-wave"><span class="cr-mono">{c.exercicios}</span> '
                                              f'{rotulo("n_exercises")}{respostas}</span>'))
            if resumo:
                links.append(link(resumo, f'<span class="cr-wave">{rotulo("chapter_summary")}</span>'))
            abertura = "".join(f"<p>{e(t)}</p>" for t in c.abertura)
            blocos.append(f'<section class="cr-block" id="capitulo-{c.numero}">'
                          f'<h3 class="cr-block-title">{rotulo("chapter")} <span class="cr-mono">{c.numero}</span></h3>'
                          f'<p class="cr-ch-title" lang="pt-BR">{e(c.titulo)}</p>'
                          f'<div class="cr-prose" lang="pt-BR">{abertura}</div>'
                          f'<p class="cr-ref-links cr-ch-links">{"".join(links)}</p></section>')
        plano = (f'<article class="cr-panel cr-plan glass fade-up" aria-labelledby="parte-t">'
                 f'<h2 class="cr-panel-title" id="parte-t"><i class="ph ph-notebook" aria-hidden="true"></i>{rotulo("the_part")}</h2>'
                 f'{"".join(blocos)}</article>')

        def linha(href, icone, forte, fraco, externo=True):
            return (f'<li><a class="cr-row" href="{e(href)}"{fora if externo else ""}>'
                    f'<i class="ph ph-{icone}" aria-hidden="true"></i><span class="cr-row-text"><strong>{forte}</strong>'
                    f'<span>{fraco}</span></span><i class="ph ph-{"arrow-square-out" if externo else "arrow-right"} cr-row-go" aria-hidden="true"></i></a></li>')

        itens = [linha(url, "file-pdf", rotulo("handout_pdf"),
                       f'<span class="cr-mono">{ap.paginas}</span> {rotulo("n_pages")} · <span class="cr-mono">{mb}</span> MB · '
                       f'{rotulo("version")} <span class="cr-mono">{x["versao"]}</span>'),
                 linha(na(ap.gabarito), "check-circle", rotulo("answer_key"), rotulo("answer_key_desc"))]
        for c in ap.capitulos:
            resumo = next((s for s in c.secoes if not s.numero and s.titulo.startswith("Resumo")), None)
            if resumo:
                itens.append(linha(na(resumo), "file-text",
                                   f'{rotulo("chapter_summary")} <span class="cr-mono">{c.numero}</span>', rotulo("chapter_summary_desc")))
        lt = cfg["ltspice"]
        outras = "".join(linha(f'../{y["cfg"]["slug"]}/', "books", f'{rotulo("part")} <span class="cr-mono">{y["cfg"]["n"]}</span>',
                               f'<span lang="pt-BR">{e(y["ap"].titulo)}</span>', externo=False)
                         for y in self.partes if y is not x)
        material = (f'<aside class="cr-panel cr-kit glass fade-up" aria-labelledby="material-t">'
                    f'<h2 class="cr-panel-title" id="material-t"><i class="ph ph-package" aria-hidden="true"></i>{rotulo("part_materials")}</h2>'
                    f'<ul class="cr-rows">{"".join(itens)}</ul>'
                    f'<h3 class="cr-kit-sub"><i class="ph ph-wave-sine" aria-hidden="true"></i>{rotulo("simulation")}</h3>'
                    f'<ul class="cr-rows">{linha(lt["link"], "wave-sine", "LTspice", rotulo("ltspice_desc"))}</ul>'
                    + (f'<h3 class="cr-kit-sub"><i class="ph ph-books" aria-hidden="true"></i>{rotulo("s_parts")}</h3>'
                       f'<ul class="cr-rows">{outras}</ul>' if outras else "")
                    + '</aside>')
        banda_parte = banda(f'<div class="cr-duo">{plano}{material}</div>', lit=True, classe="cr-band--first")

        # O sumário, dos marcadores do PDF: cada linha abre o PDF no lugar dela.
        colunas = []
        for c in ap.capitulos:
            secoes = "".join(
                f'<li><a href="{e(na(s))}"{fora}><span class="cr-toc2-n">{e(s.numero or "")}</span>'
                f'<span class="cr-toc2-t">{e(s.titulo)}</span><span class="cr-toc2-p">{e(s.rotulo)}</span></a></li>'
                for s in c.secoes)
            colunas.append(f'<section class="cr-toc2-ch" aria-labelledby="sumario-{c.numero}">'
                           f'<h3 class="cr-toc2-title" id="sumario-{c.numero}"><a href="{e(na(c))}"{fora}>'
                           f'<span class="cr-toc2-cap">{rotulo("chapter")} <span class="cr-mono">{c.numero}</span></span>'
                           f'<span class="cr-toc2-name" lang="pt-BR">{e(c.titulo)}</span></a></h3>'
                           f'<ol lang="pt-BR">{secoes}</ol></section>')
        gab = ap.gabarito
        gabarito = (f'<p class="cr-toc2-end"><a href="{e(na(gab))}"{fora}><i class="ph ph-check-circle" aria-hidden="true"></i>'
                    f'<span class="cr-toc2-t" lang="pt-BR">{e(gab.titulo)}</span><span class="cr-toc2-p">{e(gab.rotulo)}</span></a></p>')
        tem_praticas = bool(ap.praticas)
        banda_sumario = banda(titulo("list", "contents", "sumario-t")
                              + f'<p class="cr-intro fade-up">{rotulo("contents_intro")}</p>'
                              + f'<div class="cr-toc2 fade-up">{"".join(colunas)}</div>{gabarito}',
                              "sumario-t", lit=False, classe="" if tem_praticas else "cr-band--last")

        # As práticas de laboratório, com o objetivo que a caixa de cada uma dá.
        banda_lab = ""
        if tem_praticas:
            abrir = f'<span class="cr-wave">{rotulo("open_handout")}</span>'
            praticas = "".join(
                f'<li id="pratica-{q.n}"><span class="cr-agenda-t">{rotulo("practice")} {q.n}</span>'
                f'<div class="cr-lab"><p class="cr-lab-title" lang="pt-BR">{e(_maiuscula(q.titulo))}</p>'
                f'<p lang="pt-BR">{e(q.objetivo)}</p>'
                f'<p class="cr-ref-links">{link(q, abrir)}</p></div></li>'
                for q in ap.praticas)
            banda_lab = banda(titulo("flask", "lab_practices", "praticas-t")
                              + f'<p class="cr-intro fade-up">{rotulo("lab_intro")}</p>'
                              + f'<ol class="cr-agenda cr-labs fade-up">{praticas}</ol>',
                              "praticas-t", lit=True, classe="cr-band--last")

        corpo = topo + banda_parte + banda_sumario + banda_lab
        return esqueleto(rel, f"Parte {p['n']}: {ap.titulo} | {cfg['nome']} | NIPS-CERN",
                         f"Part {p['n']} of the {cfg['nome']} handout, the analog electronics course of the UFJF Faculty of "
                         f"Engineering, in Portuguese: contents, lab practices and exercises.",
                         corpo, self.token, css=("assets/css/courses.min.css",), corpo_estilo=self.estilo)

    # ---------------------------------------------------------- a página do curso

    def gera_pagina_do_curso(self):
        cfg, s = self.cfg, self.cfg["secoes"]
        rel = self.raiz + "index.html"
        fora = ' target="_blank" rel="noopener"'
        seta = '<i class="ph ph-arrow-square-out" aria-hidden="true"></i>'
        ren = texto.Renderizador({})
        md = lambda t: ren.html(t, self.arquivo.name)  # noqa: E731
        crumbs = migalhas([(rotulo("title"), "../"), (e(cfg["nome"]), None)])
        texto_hero = (f'<p class="eyebrow fade-up"><i class="ph ph-books" aria-hidden="true"></i>{rotulo("course")}</p>'
                      f'<h1 class="cr-course-name cr-course-name--long fade-up">{e(cfg["nome"])}</h1>'
                      f'<p class="cr-subtitle fade-up" lang="pt-BR">{e(cfg["subtitulo"])}</p>'
                      f'<p class="cr-lede fade-up" lang="pt-BR">{e(cfg["apresentacao"])}</p>'
                      + fichas([("user", "taught_by", e(cfg["quem_da"])), ("map-pin", "where", e(cfg["onde"])),
                                ("notebook", "course_code", e(cfg["disciplina"]))])
                      + f'<div class="cr-actions fade-up">'
                        f'{botao(self.partes[0]["cfg"]["slug"] + "/", "book-open-text", "open_first_part", primario=True)}'
                        f'{botao("#partes-t", "list", "s_parts")}</div>')
        capa = (f'<figure class="cr-course-cover fade-up"><div class="frame"><img src="{self.url_midia(self.capa, rel)}" '
                f'alt="{e(cfg["capa"]["alt"])}" width="780" height="975" decoding="async"></div>'
                f'<figcaption lang="pt-BR">{e(cfg["capa"]["credito"])}</figcaption></figure>')
        topo = hero(self.url_midia(self.fundo, rel), crumbs, texto_hero, capa, classe="cr-hero--course")

        def cita(parte, citacao, onde):
            return (f'<p class="cr-ed-cite" lang="pt-BR"><a class="cr-ref-link" href="{e(self.pdf(self.parte(parte), rel, *self.citacoes[citacao]))}"{fora}>'
                    f'<span class="cr-wave">{e(onde)}</span>{seta}</a></p>')

        # As partes, cada uma com uma figura dela no cartão.
        cartoes = []
        for x in self.partes:
            caps = "".join(f'<span class="cr-class-meta" lang="pt-BR"><span class="cr-mono">{c.numero}</span> · {e(c.titulo)}</span>'
                           for c in x["ap"].capitulos)
            cartoes.append(
                f'<a class="cr-class glass glass--flat" href="{x["cfg"]["slug"]}/">'
                f'<span class="frame cr-class-cover"><img src="{self.url_midia(x["figura"], rel)}" alt="" width="1280" height="720" loading="lazy" decoding="async"></span>'
                f'<span class="cr-class-body"><span class="cr-class-n">{rotulo("part")} <span class="cr-mono">{x["cfg"]["n"]}</span></span>'
                f'<span class="cr-class-title" lang="pt-BR">{e(x["ap"].titulo)}</span>{caps}'
                f'<span class="cr-class-meta"><span class="cr-mono">{x["ap"].paginas}</span> {rotulo("n_pages")} · '
                f'{rotulo("version")} <span class="cr-mono">{x["versao"]}</span></span></span></a>')
        contagem = (f'<p class="cr-ed-note">{rotulo("parts_online")}<br><span class="cr-mono">'
                    f'{len(self.partes)} / {cfg["partes_previstas"]}</span></p>')
        partes = f'<div class="cr-grid cr-grid--parts">{"".join(cartoes)}</div>'

        # Os modelos: a tabela da seção 1.1.3, que é o mapa do curso.
        m = s["modelos"]
        tabela = ("| " + " | ".join(m["colunas"]) + " |\n|" + "---|" * len(m["colunas"]) + "\n"
                  + "\n".join("| " + " | ".join(l) + " |" for l in m["linhas"]))
        modelos = (f'<p class="cr-ed-lede" lang="pt-BR">“{e(m["abertura"])}.”</p>'
                   f'<div class="cr-prose cr-models" lang="pt-BR">{md(tabela)}</div>'
                   f'<p class="cr-ed-cite" lang="pt-BR"><a class="cr-ref-link" href="{e(self.pdf(self.parte(m["parte"]), rel, *self.destino_do_modelo))}"{fora}>'
                   f'<span class="cr-wave">{e(m["onde"])}</span>{seta}</a></p>')

        # Como estudar: três frases da apostila, cada uma com a página de onde veio.
        metodo = ('<ul class="cr-goal-list cr-quotes">'
                  + "".join(f'<li><blockquote lang="pt-BR"><p>“{e(c["citacao"])}”</p></blockquote>'
                            f'{cita(c["parte"], c["citacao"], c["onde"])}</li>' for c in s["metodo"])
                  + '</ul>')

        # O laboratório: as práticas de todas as partes, e o simulador.
        praticas = "".join(
            f'<li><span class="cr-agenda-t">{rotulo("practice")} {q.n}</span>'
            f'<span><a href="{x["cfg"]["slug"]}/#pratica-{q.n}"><span class="cr-wave cr-wave--quiet" lang="pt-BR">{e(_maiuscula(q.titulo))}</span></a>'
            f' <span class="cr-muted">· {rotulo("part")} {x["cfg"]["n"]}</span></span></li>'
            for x in self.partes for q in x["ap"].praticas)
        lab = (f'<ol class="cr-agenda">{praticas}</ol>'
               f'<p class="cr-ed-sub">{rotulo("simulation")}</p><div class="cr-prose" lang="pt-BR">{md(s["simulacao"])}</div>'
               f'<div class="cr-actions"><a class="btn btn-sm btn-ghost glass-btn" href="{e(cfg["ltspice"]["link"])}"{fora}>'
               f'<i class="ph ph-wave-sine" aria-hidden="true"></i><span>LTspice</span></a></div>')

        # A apostila: cada parte com a versão e a data do PDF publicado.
        ev = s["evolucao"]
        linhas = "".join(
            f'<tr><td><a href="{x["cfg"]["slug"]}/">{rotulo("part")} {x["cfg"]["n"]}</a></td>'
            f'<td lang="pt-BR">{e(", ".join(c.numero for c in x["ap"].capitulos))}</td>'
            f'<td class="cr-mono">{x["ap"].paginas}</td><td class="cr-mono">{x["versao"]}</td>'
            f'<td><time class="cr-mono" datetime="{x["ap"].data}">{_data_br(x["ap"].data)}</time></td>'
            f'<td><a class="cr-ref-link" href="{e(x["url"])}"{fora}><span class="cr-wave">PDF</span>'
            f'<i class="ph ph-file-pdf" aria-hidden="true"></i></a></td></tr>' for x in self.partes)
        apostila_ = (f'<p class="cr-ed-lede" lang="pt-BR">“{e(ev["citacao"])}”</p>'
                     + cita(ev["parte"], ev["citacao"], ev["onde"])
                     + f'<div class="cr-prose cr-versions"><table><thead><tr><th>{rotulo("part")}</th><th>{rotulo("chapters")}</th>'
                       f'<th>{rotulo("pages")}</th><th>{rotulo("version")}</th><th>{rotulo("date")}</th>'
                       f'<th><span class="sr-only">PDF</span></th></tr></thead><tbody>{linhas}</tbody></table></div>'
                     + f'<p class="cr-ed-note">{rotulo("versions_note")}</p>')

        banda_1 = banda(programa("s_parts", "partes-t", partes, contagem) + programa("s_models", "modelos-t", modelos),
                        classe="cr-band--first cr-band--ed")
        banda_2 = banda(programa("s_method", "metodo-t", metodo) + programa("s_lab", "lab-t", lab)
                        + programa("s_handout", "apostila-t", apostila_),
                        lit=False, classe="cr-band--last cr-band--ed")
        self.escrita.grava(RAIZ / rel, esqueleto(
            rel, f"{cfg['nome']}: {cfg['subtitulo'].lower()} | NIPS-CERN",
            f"{cfg['nome']}, the analog electronics course of the UFJF Faculty of Engineering, in Portuguese: the handout by "
            f"{cfg['quem_da']} in {len(self.partes)} parts, with contents, lab practices and exercises.",
            topo + banda_1 + banda_2, self.token, css=("assets/css/courses.min.css", "assets/css/vendor/katex.min.css"),
            corpo_estilo=self.estilo))

    # ---------------------------------------------------------- o que a library pede

    def paginas_do_sitemap(self):
        yield self.raiz, "0.7", "weekly"
        for x in self.partes:
            yield f"{self.raiz}{x['cfg']['slug']}/", "0.6", "monthly"

    def fatos_do_cartao(self):
        return [("course_code", self.cfg["disciplina"], False),
                ("parts_online", f"{len(self.partes)} / {self.cfg['partes_previstas']}", False)]


def le_material(caminho):
    """Os PDFs de um .zip, de uma pasta ou um .pdf só: {nome do arquivo: bytes}."""
    p = Path(caminho)
    if p.is_dir():
        nomes = [(f.name, f.read_bytes()) for f in sorted(p.glob("*.pdf"))]
    elif p.suffix.lower() == ".zip" and p.is_file():
        with zipfile.ZipFile(p) as z:
            nomes = [(Path(n).name, z.read(n)) for n in z.namelist()
                     if n.lower().endswith(".pdf") and not n.startswith("__MACOSX/")]
    elif p.suffix.lower() == ".pdf" and p.is_file():
        nomes = [(p.name, p.read_bytes())]
    else:
        raise SystemExit(f"--material: {caminho} não é pasta, .zip nem .pdf")
    pdfs = dict(nomes)
    if not pdfs:
        raise SystemExit(f"--material: {caminho} não tem PDF nenhum")
    if len(pdfs) != len(nomes):
        raise SystemExit(f"--material: {caminho} tem dois PDFs com o mesmo nome em pastas diferentes")
    return pdfs


def _id_arquivo(nome):
    return re.sub(r"[^a-z0-9]+", "-", nome.lower()).strip("-")


def _realca(codigo, ident):
    """Python com destaque de sintaxe, uma linha por <span>, com o número em data-n.

    O número vem do CSS, por attr(data-n), e por isso não entra quando se copia
    o código. Um token que atravessa linhas, como uma docstring, é partido em
    cada quebra, para toda linha fechar os próprios spans.
    """
    from pygments.lexers import PythonLexer
    from pygments.token import STANDARD_TYPES

    def classe(tt):
        while tt not in STANDARD_TYPES:
            tt = tt.parent
        return STANDARD_TYPES[tt]

    linhas = [[]]
    for tt, valor in PythonLexer(stripnl=False, ensurenl=False).get_tokens(codigo):
        c = classe(tt)
        for k, pedaco in enumerate(valor.split("\n")):
            if k:
                linhas.append([])
            if pedaco:
                linhas[-1].append(f'<span class="{c}">{e(pedaco)}</span>' if c else e(pedaco))
    if linhas and not linhas[-1]:
        linhas.pop()
    return "\n".join(f'<span class="cl" id="{ident}-L{n}" data-n="{n}">{"".join(l)}</span>'
                     for n, l in enumerate(linhas, 1))


# ------------------------------------------------------------------ o que vale para a library inteira

def pagina_da_colecao(cursos, token):
    rel = "library/courses/index.html"
    crumbs = migalhas([(rotulo("library"), None), (rotulo("title"), None)])
    topo = hero(None, crumbs,
                f'<p class="eyebrow fade-up"><i class="ph ph-books" aria-hidden="true"></i>{rotulo("library")}</p>'
                f'<h1 class="display-lg fade-up">{rotulo("title")}</h1>'
                f'<p class="body-lg fade-up">{rotulo("intro")}</p>', classe="cr-hero--collection")
    cartoes = "".join(c.cartao_da_colecao(rel) for c in cursos)
    corpo = topo + banda(f'<div class="cr-grid cr-grid--courses fade-up">{cartoes}</div>', classe="cr-band--first cr-band--last")
    return esqueleto(rel, "Courses | Library | NIPS-CERN",
                     "Courses by NIPS-CERN and by the people who work with it, with their slides, handouts, study guides, code and readings.",
                     corpo, token, css=("assets/css/courses.min.css",))


def copia_katex(escrita):
    """A folha e as fontes do KaTeX, do node_modules para o site, só em woff2.

    A folha de fábrica pede cada fonte em woff2, woff e ttf; os dois últimos
    formatos não vêm para o site, então as referências a eles saem da folha,
    e os caminhos passam a apontar para assets/fonts/katex-<versão>/, uma pasta
    por versão: fonte de outra versão com o mesmo nome seria servida velha pelo
    cache de um ano da borda.
    """
    if not KATEX_VERSAO:
        raise SystemExit("KaTeX não está instalado: rode npm install")
    dist = RAIZ / "node_modules" / "katex" / "dist"
    css = (dist / "katex.min.css").read_text(encoding="utf-8")
    css = re.sub(r',url\(fonts/[^)]+\.woff\) format\("woff"\)', "", css)
    css = re.sub(r',url\(fonts/[^)]+\.ttf\) format\("truetype"\)', "", css)
    css = css.replace("url(fonts/", f"url(../../fonts/katex-{KATEX_VERSAO}/")
    if re.search(r"url\(fonts/|\.woff\)|\.ttf\)", css):
        raise SystemExit("a folha do KaTeX mudou de formato; revise copia_katex()")
    escrita.grava(RAIZ / "assets" / "css" / "vendor" / "katex.min.css",
                  f"/* KaTeX {KATEX_VERSAO}, MIT. Copiado de node_modules por tools/courses/build.py, só com woff2. */\n" + css)
    destino = RAIZ / "assets" / "fonts" / f"katex-{KATEX_VERSAO}"
    for fonte in sorted((dist / "fonts").glob("*.woff2")):
        escrita.grava(destino / fonte.name, fonte.read_bytes())
    escrita.grava(destino / "LICENSE", (RAIZ / "node_modules" / "katex" / "LICENSE").read_bytes())


# Os endereços de /library/ que já são de outro dono: os Workers do manual do
# SAPHO e da TWiki do CGVWeb. Um curso com um desses nomes tomaria a rota deles.
ROTAS_DE_WORKER = {"sapho", "cgvweb"}


def atalho(slug, escrita, nome):
    """/library/<curso>/ leva a /library/courses/<curso>/.

    É o endereço que se digita de memória, e sem isto ele dá 404. O GitHub Pages
    não redireciona do lado do servidor, então a página faz o que um 301 faria:
    refresh imediato, o canonical apontando para o endereço de verdade, e o
    location.replace, que leva junto o #n de quem digitou um slide. O noindex
    deixa o buscador com um endereço só.
    """
    if slug in ROTAS_DE_WORKER or slug == "courses":
        raise SystemExit(f"o curso {slug!r} teria o atalho /library/{slug}/, que já é de outra coisa")
    destino = f"/library/courses/{slug}/"
    pagina = f"""<!DOCTYPE html>
<!-- Gerado por tools/courses/build.py: o atalho de /library/{slug}/ para {destino}. -->
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>{e(nome)} | NIPS-CERN</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="{SITE}library/courses/{slug}/">
  <meta http-equiv="refresh" content="0; url={destino}">
  <script>location.replace({json.dumps(destino)} + location.search + location.hash);</script>
</head>
<body>
  <p><a href="{destino}">{SITE}library/courses/{slug}/</a></p>
</body>
</html>
"""
    escrita.grava(RAIZ / "library" / slug / "index.html", pagina)


def confere_links(cursos):
    """Todo endereço das páginas geradas tem de levar a alguma coisa.

    Abre cada .html de library/courses/ e resolve href, src, data-src,
    data-video e poster como o navegador resolveria a partir da página, com as
    URLs limpas do GitHub Pages: pasta vira index.html, e caminho sem extensão
    vira .html. O que é do site tem de existir no repositório; o que é do CDN
    tem de ser um arquivo que esta rodada publicou; e a âncora tem de existir na
    página de destino. Nos slides, #n é o número do slide, que o slides.js lê,
    e vale de 1 ao total. Endereço de fora não se confere aqui, porque depende
    da rede; é o que o relatório do PR conta. O link para o leitor de PDF do
    site, pdf-viewer.html, tem de abrir um PDF desta rodada, numa página que ele
    tem. Devolve a lista dos problemas.
    """
    cdn = {c.cdn.BASE + caminho for c in cursos for caminho in c.cdn.usados}
    paginas_do_pdf = {x["url"]: x["ap"].paginas for c in cursos for x in getattr(c, "partes", [])}
    leitor = (RAIZ / "pdf-viewer.html").resolve()
    paginas = {}
    for arq in sorted(SAIDA.rglob("*.html")):
        paginas[arq.resolve()] = arq.read_text(encoding="utf-8")

    def ids(texto_html):
        return set(re.findall(r'\sid="([^"]+)"', texto_html))

    def no_leitor(rel, valor, destino, ancora):
        src = (urllib.parse.parse_qs(urllib.parse.urlsplit(destino).query).get("src") or [""])[0]
        if src not in cdn:
            return [f"{rel}: {valor} abre no leitor {src or 'nada'}, que não é um PDF publicado no CDN nesta rodada"]
        pagina = (urllib.parse.parse_qs(ancora).get("page") or ["1"])[0]
        total = paginas_do_pdf.get(src)
        if not pagina.isdigit() or (total and not 1 <= int(pagina) <= total):
            return [f"{rel}: {valor} pede a página {pagina}, e o PDF tem {total}"]
        return []

    def arquivo_de(caminho_url):
        alvo = (RAIZ / caminho_url.lstrip("/")).resolve()
        if caminho_url.endswith("/"):
            alvo = alvo / "index.html"
        elif not alvo.suffix:
            html_ = alvo.with_suffix(".html")
            alvo = html_ if html_.exists() else alvo / "index.html"
        return alvo

    problemas = []
    for arq, texto_html in paginas.items():
        rel = arq.relative_to(RAIZ.resolve()).as_posix()
        base = "/" + rel.rsplit("/", 1)[0] + "/"
        for attr, valor in re.findall(r'\s(href|src|data-src|data-video|poster)="([^"]*)"', texto_html):
            valor = html.unescape(valor)
            if not valor or valor.startswith(("mailto:", "tel:", "data:")):
                continue
            if valor.startswith(("http://", "https://")):
                if valor.startswith(SITE):
                    valor = "/" + valor[len(SITE):]
                elif valor.startswith("https://cdn.nipscern.com/"):
                    if valor.split("#")[0] not in cdn:
                        problemas.append(f"{rel}: {valor} não é um arquivo publicado no CDN nesta rodada")
                    continue
                else:
                    continue
            if valor == "#" and attr == "href":
                continue      # o link do aviso de vídeo, que o slides.js preenche
            destino, _, ancora = valor.partition("#")
            if destino:
                caminho = urllib.parse.urljoin(base, destino.split("?")[0])
                alvo = arquivo_de(caminho)
                if not alvo.exists():
                    problemas.append(f"{rel}: {attr}={valor} leva a {caminho}, que não existe")
                    continue
            else:
                alvo = arq
            if alvo == leitor:
                problemas += no_leitor(rel, valor, destino, ancora)
                continue
            if ancora:
                if alvo.name == "index.html" and alvo.parent.name == "slides" and ancora.isdigit():
                    n = paginas.get(alvo.resolve(), "").count('<section id="')
                    if not 1 <= int(ancora) <= n:
                        problemas.append(f"{rel}: {valor} pede o slide {ancora}, e o deck tem {n}")
                elif alvo.suffix == ".html":
                    texto_alvo = paginas.get(alvo.resolve()) or alvo.read_text(encoding="utf-8")
                    if ancora not in ids(texto_alvo):
                        problemas.append(f"{rel}: {valor} aponta para #{ancora}, que não existe no destino")
    return problemas


def atualiza_sitemap(cursos):
    """As URLs da library/courses, num bloco marcado do sitemap.xml que só esta ferramenta mexe."""
    arq = RAIZ / "sitemap.xml"
    xml = arq.read_text(encoding="utf-8")
    entradas = []

    def url(caminho, lastmod, prioridade, freq="monthly"):
        entradas.append(f"  <url>\n    <loc>{SITE}{caminho}</loc>\n    <lastmod>{lastmod}</lastmod>\n"
                        f"    <changefreq>{freq}</changefreq>\n    <priority>{prioridade}</priority>\n  </url>\n")

    url("library/courses/", max(c.data for c in cursos), "0.7")
    for c in cursos:
        for caminho, prioridade, freq in c.paginas_do_sitemap():
            url(caminho, c.data, prioridade, freq)
    bloco = "  <!-- courses: gerado por tools/courses/build.py -->\n\n" + "\n".join(entradas) + "\n  <!-- /courses -->\n"
    if "<!-- courses:" in xml:
        xml = re.sub(r"  <!-- courses: .*?<!-- /courses -->\n", lambda _: bloco, xml, flags=re.S)
    else:
        xml = xml.replace("</urlset>", bloco + "\n</urlset>")
    arq.write_text(xml, encoding="utf-8", newline="\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--course", help="só este curso (o slug)")
    ap.add_argument("--source", help="clone do repositório do curso, no lugar do caminho do .json")
    ap.add_argument("--ref", help="o commit ou a referência a ler, no lugar do ref do .json")
    ap.add_argument("--no-fetch", action="store_true", help="não roda git fetch no repositório do curso")
    ap.add_argument("--assets", help="clone do nipscern-assets, para onde vão os arquivos novos do CDN")
    ap.add_argument("--material", action="append", default=[], metavar="CURSO=CAMINHO",
                    help="os PDFs novos de um curso em apostila: um .zip, uma pasta ou um .pdf")
    args = ap.parse_args()

    catalogo = json.loads((AQUI / "catalogo.json").read_text(encoding="utf-8"))
    if args.course and args.course not in catalogo["cursos"]:
        raise SystemExit(f"{args.course} não está em catalogo.json")
    materiais = {}
    for m in args.material:
        slug, _, caminho = m.partition("=")
        if slug not in catalogo["cursos"] or not caminho:
            raise SystemExit(f"--material {m}: o formato é CURSO=CAMINHO, com um curso de catalogo.json")
        materiais[slug] = le_material(caminho)
    escrita = Escrita()
    token = token_de_cache()
    cursos = []
    for slug in catalogo["cursos"]:
        if args.course and slug != args.course:
            continue
        arquivo = AQUI / f"{slug}.json"
        if json.loads(arquivo.read_text(encoding="utf-8")).get("formato") == "apostila":
            c = CursoDeApostila(arquivo, args, materiais.get(slug))
        elif slug in materiais:
            raise SystemExit(f"--material é para curso em apostila, e {slug} lê o repositório dele")
        else:
            c = Curso(arquivo, args)
        print(f"{c.cfg['nome']}: {c.origem()}")
        c.gera(escrita, token)
        cursos.append(c)

    # A coletânea e o sitemap listam todos os cursos. Com --course, só um foi
    # gerado, e reescrever os dois com ele apagaria os outros de lá.
    if not args.course:
        escrita.grava(SAIDA / "index.html", pagina_da_colecao(cursos, token))
    for c in cursos:
        atalho(c.slug, escrita, c.cfg["nome"])
    copia_katex(escrita)
    if not args.course:
        atualiza_sitemap(cursos)
    else:
        print("com --course, a coletânea e o sitemap ficam como estavam; rode sem --course para atualizá-los")

    # A limpeza só com todos os cursos gerados: com --course, as páginas dos
    # outros não foram escritas nesta rodada e seriam apagadas.
    if not args.course:
        for apagado in escrita.limpa(SAIDA):
            print(f"apagado: {apagado.relative_to(RAIZ)}")
    for c in cursos:
        print(f"\n{c.cfg['nome']}, arquivos do CDN (https://cdn.nipscern.com/):")
        for caminho, n, estado in c.cdn.grava():
            print(f"  {caminho}  {n / 1e6:.2f} MB  {estado}")

    problemas = confere_links(cursos)
    if problemas:
        print(f"\n{len(problemas)} endereço(s) sem destino:")
        for p in problemas:
            print("  " + p)
        raise SystemExit(1)
    print("\ntodos os endereços internos das páginas geradas levam a algum lugar.")
    print("feito.")


if __name__ == "__main__":
    main()
