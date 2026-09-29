"""O texto do curso: Markdown do repositório virando HTML do site.

Três cuidados valem para tudo o que passa por aqui.

Os links. O repositório do curso é privado, e um link relativo dele, como
`[infra/](../../infra/)`, apontaria para lugar nenhum no site; os de claude.ai
são artifacts privados. Cada link relativo é resolvido para o caminho no
repositório e trocado pelo que o site publicou daquele arquivo, se publicou; se
não, o link sai e fica o texto. Os externos ficam, menos os proibidos.

As fórmulas. `$...$` vai para o KaTeX, pelo tools/courses/tex.js, uma chamada só
por página, e volta como HTML pronto. A página não roda KaTeX.

As tabelas. O Markdown divide a linha de tabela em toda barra vertical, e o
roteiro da aula 2 tem barra dentro de fórmula, `$|a|$`, e dentro do texto,
`|−1,1|`. Antes de o parser ver a tabela, a barra de dentro de fórmula vira
\\vert e a que não separa célula é escapada; a regra do que separa célula é a
do próprio roteiro, espaço dos dois lados. Uma linha que ainda assim sair com
mais células que o cabeçalho é erro.
"""
import html
import json
import posixpath
import re
import subprocess
from pathlib import Path

from markdown_it import MarkdownIt
from mdit_py_plugins.dollarmath import dollarmath_plugin

RAIZ = Path(__file__).resolve().parents[2]
PROIBIDOS = ("claude.ai", "github.com/Chrysthofer/redes-neurais", "/_blob/")
# Endereços que o curso escreve sem protocolo e que não respondem em https: o
# do livro do Nielsen apresenta o certificado de *.github.com, e o navegador
# recusa. Conferido em 28/09/2026.
SO_HTTP = {"neuralnetworksanddeeplearning.com"}


def katex(pedidos):
    """[(tex, display)] -> [html], pelo KaTeX instalado em node_modules."""
    if not pedidos:
        return []
    r = subprocess.run(["node", str(RAIZ / "tools" / "courses" / "tex.js")],
                       input=json.dumps([{"tex": t, "display": d} for t, d in pedidos]),
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise SystemExit(r.stderr or "tex.js falhou")
    return json.loads(r.stdout)


def _vetores(md):
    """w⃗ no texto corrido vira $\\vec{w}$.

    O roteiro escreve o vetor em prosa com a seta combinada, U+20D7, depois da
    letra. Nenhuma das fontes do site desenha esse sinal, e o navegador o busca
    numa fonte de reserva, que o põe torto ou como um quadrado. Como fórmula, sai
    com a mesma seta das equações da tabela de notação. Código e fórmula que já
    existem ficam como estão.
    """
    def troca(trecho):
        return re.sub(r"([A-Za-z]|∇)⃗", lambda m: "$\\vec{" + ("\\nabla" if m.group(1) == "∇" else m.group(1)) + "}$",
                      trecho)
    partes = re.split(r"(`[^`\n]*`|\$[^$\n]+\$)", md)
    return "".join(p if p.startswith(("`", "$")) else troca(p) for p in partes)


def notas_em_html(notas):
    """As anotações do apresentador, do texto do <aside> para parágrafos com os vetores desenhados.

    A anotação é texto corrido, um parágrafo por linha, com o vetor escrito w⃗,
    a letra e a seta combinada. A fonte do painel de anotações não tem a seta,
    como nenhuma do site, e ela saía torta; aqui cada w⃗ vira \\vec{w} pelo KaTeX,
    a mesma seta do roteiro. Todas as anotações de um deck numa chamada só.
    Devolve, na ordem, o HTML de cada uma.
    """
    marcas, pedidos = [], []
    for texto_nota in notas:
        paragrafos = []
        for linha in html.unescape(texto_nota).split("\n"):
            linha = linha.strip()
            if not linha:
                continue
            partes = re.split(r"([A-Za-z]|∇)⃗", linha)
            saida = html.escape(partes[0])
            for k in range(1, len(partes), 2):
                letra = "\\nabla" if partes[k] == "∇" else partes[k]
                pedidos.append((f"\\vec{{{letra}}}", False))
                saida += f"\x00{len(pedidos) - 1}\x00" + html.escape(partes[k + 1])
            paragrafos.append(f"<p>{saida}</p>")
        marcas.append("".join(paragrafos))
    desenhos = katex(pedidos)
    return [re.sub("\x00(\\d+)\x00", lambda m: desenhos[int(m.group(1))], h) for h in marcas]


_LEITURA = re.compile(r'^(?P<autor>[^,]+), (?P<ano>\d{4}), \*(?P<obra>[^*]+)\*, (?P<parte>capítulo \d+), '
                      r'"(?P<titulo>[^"]+)"(?:, (?P<resto>[^:]+))?: (?P<url>\S+?)\.?$')


def leitura(linha):
    """Um texto do estudo da semana, como o README escreve o do Nielsen, em partes.

    'Michael Nielsen, 2015, *Neural Networks and Deep Learning*, capítulo 1,
    "Using neural nets...", até a seção sobre a arquitetura das redes:
    neuralnetworksanddeeplearning.com/chap1.html.' Com as partes, o cartão do
    texto tem a mesma forma dos cartões de vídeo ao lado. Fora desse formato,
    devolve None, e o texto aparece como o README escreve.
    """
    m = _LEITURA.match(linha)
    if not m:
        return None
    url = m.group("url")
    if not url.startswith("http"):
        url = ("http://" if url.split("/")[0] in SO_HTTP else "https://") + url
    return {**m.groupdict(), "url": url}


def _conserta_tabelas(md):
    linhas = md.split("\n")
    saida = []
    colunas = None
    for linha in linhas:
        if re.fullmatch(r"\|[\s:|-]+\|", linha):
            pass   # a linha de separação, |---|---|, fica como está
        elif linha.startswith("|"):
            # a barra dentro de fórmula é o valor absoluto, não borda de célula
            linha = re.sub(r"\$[^$\n]+\$", lambda m: m.group(0).replace("|", r"\vert "), linha)
            partes = []
            for i, c in enumerate(linha):
                if c == "|":
                    antes = linha[i - 1] if i else " "
                    depois = linha[i + 1] if i + 1 < len(linha) else " "
                    partes.append("|" if (antes == " " and depois == " ") or i == 0 or i == len(linha) - 1
                                  else r"\|")
                else:
                    partes.append(c)
            linha = "".join(partes)
            n = len(re.findall(r"(?<!\\)\|", linha)) - 1
            if colunas is None:
                colunas = n
            elif n != colunas:
                raise SystemExit(f"linha de tabela com {n} células onde o cabeçalho tem {colunas}: {linha}")
        else:
            colunas = None
        saida.append(linha)
    return "\n".join(saida)


# Endereço sem protocolo, como o roteiro escreve (youtube.com/watch?v=...), e o
# arXiv e o DOI por extenso. Só os domínios de primeiro nível que aparecem no
# curso: um padrão genérico pegaria perceptron.py e dimuon.csv.gz.
_URL_NUA = re.compile(r"(?<![\w/@.])((?:https?://)?(?:[a-z0-9-]+\.)+(?:com|org|edu|cern|gov|net|br|ch|fr)"
                      r"(?:/[^\s<>\"'()]*)?)", re.I)
_ARXIV = re.compile(r"\barXiv:(\d{4}\.\d{4,5})(v\d+)?")
_DOI = re.compile(r"\bdoi:(10\.\d{4,9}/[^\s<>\"',;]+[^\s<>\"',;.])", re.I)


class Renderizador:
    """Markdown do curso -> HTML do site, com links resolvidos e fórmulas desenhadas.

    publicados: caminho no repositório do curso -> URL no site (relativa à
      página ou absoluta), para os links relativos que têm destino aqui.
    """

    def __init__(self, publicados, ancora_de_slide=None):
        self.publicados = publicados
        self.ancora_de_slide = ancora_de_slide    # n -> URL do slide n no deck, para os "### Slide n"
        self.md = MarkdownIt("commonmark", {"html": False, "typographer": False}).enable("table")
        self.md.use(dollarmath_plugin, allow_space=True, allow_digits=True, double_inline=False)

    def _resolve(self, href, arquivo):
        if re.match(r"^[a-z]+:", href, re.I) or href.startswith("//"):
            return None if any(p in href for p in PROIBIDOS) else href
        if href.startswith("#"):
            return href
        caminho = posixpath.normpath(posixpath.join(posixpath.dirname(arquivo), href.split("#")[0]))
        for chave in (caminho, caminho.rstrip("/"), caminho.rstrip("/") + "/"):
            if chave in self.publicados:
                return self.publicados[chave]
        return None

    def html(self, md, arquivo, rebaixa=0, sem_titulo=False):
        """Renderiza `md`, que veio de `arquivo` no repositório do curso.

        rebaixa: quantos níveis os títulos descem (um ## vira ### com 1).
        sem_titulo: tira o primeiro # do texto, que a página já mostra.
        """
        if sem_titulo:
            md = re.sub(r"\A\s*# [^\n]*\n", "", md)
        md = _vetores(md)
        md = _conserta_tabelas(md)
        tokens = self.md.parse(md)

        # Primeiro todas as fórmulas, numa chamada só ao KaTeX.
        formulas = []
        for t in tokens:
            if t.type in ("math_block",):
                formulas.append((t.content, True))
            for f in t.children or []:
                if f.type == "math_inline":
                    formulas.append((f.content, False))
        desenhos = katex(formulas)
        # No lugar de cada fórmula entra um marcador, e o HTML do KaTeX só volta
        # no fim: assim o linkificador nunca olha para dentro de uma fórmula.
        marcas = iter(range(len(desenhos)))

        for i, t in enumerate(tokens):
            if t.type == "heading_open" and rebaixa:
                n = min(6, int(t.tag[1]) + rebaixa)
                t.tag = tokens[i + 2].tag = f"h{n}"
            if t.type == "math_block":
                t.type, t.content = "html_block", f"<!--formula:{next(marcas)}-->"
            if t.type == "heading_open":
                texto = tokens[i + 1].content
                t.attrSet("id", _ancora(texto))
            for filho in t.children or []:
                if filho.type == "math_inline":
                    filho.type, filho.content = "html_inline", f"<!--formula:{next(marcas)}-->"

        # Os links: resolvidos, ou tirados deixando o texto.
        for t in tokens:
            if not t.children:
                continue
            filhos, pilha = [], []
            for f in t.children:
                if f.type == "link_open":
                    destino = self._resolve(f.attrGet("href"), arquivo)
                    pilha.append(destino)
                    if destino is None:
                        continue
                    f.attrSet("href", destino)
                    if re.match(r"^https?://", destino):
                        f.attrSet("target", "_blank")
                        f.attrSet("rel", "noopener")
                elif f.type == "link_close":
                    if pilha.pop() is None:
                        continue
                filhos.append(f)
            t.children = filhos

        saida = self.md.renderer.render(tokens, self.md.options, {})
        saida = self._linkifica(saida)
        saida = re.sub(r"<!--formula:(\d+)-->", lambda m: desenhos[int(m.group(1))], saida)
        if self.ancora_de_slide:
            saida = re.sub(r'(<h(\d) id="([^"]+)">Slide (\d+):([^<]*))</h\2>',
                           lambda m: (f'{m.group(1)} <a class="cg-slide-link" href="{self.ancora_de_slide(int(m.group(4)))}" '
                                      f'data-i18n-title="courses.open_in_slides" title="Open in the slides">'
                                      f'<i class="ph ph-monitor-play" aria-hidden="true"></i></a></h{m.group(2)}>'),
                           saida)
        confere(saida, arquivo)
        return saida

    def _linkifica(self, saida):
        """Endereços escritos como texto viram links, fora de <a>, <code> e das fórmulas."""
        partes = re.split(r"(<a\b.*?</a>|<code>.*?</code>|<[^>]+>)", saida, flags=re.S)
        for i, p in enumerate(partes):
            if not p or p.startswith("<"):
                continue
            p = _ARXIV.sub(lambda m: f'<a href="https://arxiv.org/abs/{m.group(1)}" target="_blank" rel="noopener">{m.group(0)}</a>', p)
            p = _DOI.sub(lambda m: f'<a href="https://doi.org/{m.group(1)}" target="_blank" rel="noopener">{m.group(0)}</a>', p)

            def url(m):
                texto = m.group(1)
                if any(x in texto for x in PROIBIDOS) or "arxiv.org/abs" in texto or "doi.org" in texto:
                    return texto
                final = ""
                while texto and texto[-1] in ".,;:":
                    final, texto = texto[-1] + final, texto[:-1]
                alvo = texto if texto.startswith("http") else ("http://" if texto.split("/")[0] in SO_HTTP else "https://") + texto
                alvo = re.sub(r"^https://youtube\.com/", "https://www.youtube.com/", alvo)
                return f'<a href="{html.escape(alvo)}" target="_blank" rel="noopener">{texto}</a>{final}'
            if "<a " not in p:
                p = _URL_NUA.sub(url, p)
            partes[i] = p
        return "".join(partes)


def _ancora(texto):
    import unicodedata
    s = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "secao"


def confere(saida, onde):
    for p in PROIBIDOS:
        if p in saida:
            raise SystemExit(f"{onde}: a saída ainda contém {p!r}, que não pode ir para o site")


# ------------------------------------------------------------------ o README de uma aula

def secoes(md):
    """Divide um Markdown pelos títulos ##: [(título, corpo)], mais o texto antes do primeiro."""
    blocos = re.split(r"^## +(.+)$", md, flags=re.M)
    inicio = blocos[0]
    return inicio, [(blocos[i].strip(), blocos[i + 1].strip()) for i in range(1, len(blocos), 2)]


def secao(lista, prefixo):
    for titulo, corpo in lista:
        if titulo.lower().startswith(prefixo.lower()):
            return titulo, corpo
    return None, None


_VIDEO = re.compile(r"capítulo (\d+), \"([^\"]+)\", (?:https?://)?(?:www\.)?youtube\.com/watch\?v=([\w-]{11})")


def estudo_da_semana(corpo):
    """Os itens de "Para estudar na semana": vídeos do YouTube e textos.

    Devolve (introducao, itens). Cada item de vídeo traz o id, o canal e a série
    como o README escreve, e o capítulo e o título citados; o título e o canal
    que a página mostra vêm do oEmbed, e o README serve para conferir. Um item
    sem vídeo do YouTube é um texto, que a página mostra como o README escreve.
    """
    introducao, _, resto = corpo.partition("\n- ")
    if not resto:
        return corpo.strip(), []
    if introducao.startswith("- "):
        introducao, resto = "", introducao[2:] + "\n- " + resto
    itens = []
    for bruto in re.split(r"\n- ", resto):
        linha = " ".join(bruto.split())
        videos = list(_VIDEO.finditer(linha))
        ids = re.findall(r"youtube\.com/watch\?v=([\w-]{11})", linha)
        if len(videos) != len(ids):
            raise SystemExit(f"não entendi o vídeo em: {linha}")
        if videos:
            cabeca = linha.split(", capítulo")[0]
            canal, _, serie = cabeca.partition(", ")
            for v in videos:
                itens.append({"tipo": "video", "id": v.group(3), "canal_citado": canal, "serie": serie,
                              "capitulo": v.group(1), "titulo_citado": v.group(2)})
        else:
            itens.append({"tipo": "texto", "md": linha})
    return introducao.strip(), itens


def data_do_titulo(titulo, ano):
    """"Entrega, até 02/10" -> "2026-10-02"."""
    m = re.search(r"(\d{2})/(\d{2})(?:/(\d{4}))?", titulo)
    if not m:
        return None
    return f"{m.group(3) or ano}-{m.group(2)}-{m.group(1)}"
