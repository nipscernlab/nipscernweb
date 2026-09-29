"""Imagens, capas de PDF, miniaturas de vídeo e os arquivos que vão para o CDN.

Toda imagem que esta ferramenta escreve no site leva no nome um resumo do próprio
conteúdo, como `buddhabrot.3f2a9c1d0b.webp`. O Cloudflare guarda assets por um
ano, e uma imagem trocada no lugar, com o mesmo nome, seria servida velha por
esse tempo todo; com o resumo no nome, conteúdo novo é endereço novo e nenhuma
dessas imagens precisa de ?v= nem de entrada na lista do hook.

Os arquivos pesados, os vídeos e os PDFs, vão para o nipscern-assets, que tem a
regra oposta e explícita: arquivo publicado não se substitui, e versão nova
ganha nome novo. O manifesto `<curso>.cdn.json`, ao lado deste arquivo, guarda
para cada origem o resumo do conteúdo e o nome publicado; conteúdo igual reusa o
nome, conteúdo diferente ganha a versão seguinte.
"""
import hashlib
import io
import json
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

CACHE = Path(__file__).resolve().parent / ".cache"
AGENTE = "nipscernweb-courses/1.0 (+https://www.nipscern.com)"


def resumo(dados, n=10):
    return hashlib.sha256(dados).hexdigest()[:n]


def baixa(url, nome_no_cache=None, tentativas=3):
    """Baixa `url` uma vez e guarda em tools/courses/.cache; da segunda em diante, lê de lá."""
    CACHE.mkdir(exist_ok=True)
    local = CACHE / (nome_no_cache or hashlib.sha256(url.encode()).hexdigest()[:24])
    if local.exists():
        return local.read_bytes()
    erro = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
            with urllib.request.urlopen(req, timeout=60) as r:
                dados = r.read()
            local.write_bytes(dados)
            return dados
        except Exception as e:  # rede instável: tenta de novo antes de desistir
            erro = e
            time.sleep(2 * (i + 1))
    raise SystemExit(f"não consegui baixar {url}: {erro}")


def _tem_transparencia(im):
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        alfa = im.convert("RGBA").getchannel("A")
        return alfa.getextrema()[0] < 255
    return False


def webp(dados, caixa=None, encaixe="cover", maximo=2560, grafico=None):
    """Converte uma imagem para WebP, no tamanho que ela vai ocupar.

    caixa: (largura, altura) em pixels de CSS em que a imagem aparece. O alvo é
      o dobro disso, para telas de densidade 2, sem nunca aumentar a original.
      Com encaixe "cover" a imagem tem de cobrir a caixa; com "contain", caber
      nela, e é isso que decide qual dos dois lados manda na redução.
    maximo: o lado maior nunca passa disto, a regra do site para imagens.
    grafico: figura de linhas e texto, como as do matplotlib. Sai sem perda
      quando isso não custar muito mais que a versão com perda, porque borda de
      letra é onde a compressão com perda mais aparece. None decide pelo que a
      imagem é: PNG com até 65 536 cores é gráfico; foto, mesmo em PNG, como a
      do TileCal, tem muito mais cores que isso.

    A foto vai a uma vez e meia a caixa, e não ao dobro. As fotos das aulas são
    escaneamentos, com a retícula da impressão, e é justamente o que a
    compressão com perda mais custa para guardar: no dobro, a Knobby Adaline
    saía com 620 KB. Uma vez e meia cobre as telas de 125% e 150% de escala
    do Windows, que são as dos laptops da turma e do projetor.
    """
    # A conversão é determinística e a sem perda, em method=6, é lenta: o
    # resultado fica no cache, com a origem e os parâmetros na chave.
    chave = hashlib.sha256(dados + repr((caixa, encaixe, maximo, grafico, 2)).encode()).hexdigest()[:32]
    guardado = CACHE / "webp" / f"{chave}.webp"
    if guardado.exists():
        return guardado.read_bytes()
    saida = _webp(dados, caixa, encaixe, maximo, grafico)
    guardado.parent.mkdir(parents=True, exist_ok=True)
    guardado.write_bytes(saida)
    return saida


def _webp(dados, caixa, encaixe, maximo, grafico):
    im = Image.open(io.BytesIO(dados))
    formato = im.format
    im = ImageOps.exif_transpose(im)
    if grafico is None:
        grafico = formato == "PNG" and im.convert("RGB").getcolors(65536) is not None
    largura, altura = im.size
    escala = min(1.0, maximo / max(largura, altura))
    if caixa:
        fator = 2 if grafico else 1.5
        alvo_l, alvo_a = fator * caixa[0], fator * caixa[1]
        s = min(alvo_l / largura, alvo_a / altura) if encaixe == "contain" else max(alvo_l / largura, alvo_a / altura)
        escala = min(escala, s)
    if escala < 1:
        im = im.resize((max(1, round(largura * escala)), max(1, round(altura * escala))), Image.LANCZOS)
    alfa = _tem_transparencia(im)
    im = im.convert("RGBA" if alfa else "RGB")

    def salva(**opcoes):
        b = io.BytesIO()
        im.save(b, "WEBP", method=6, **opcoes)
        return b.getvalue()

    if grafico:
        com_perda = salva(quality=92)
        sem_perda = salva(lossless=True, quality=100)
        return sem_perda if len(sem_perda) <= 1.3 * len(com_perda) else com_perda
    return salva(quality=80)


def primeira_pagina(pdf, largura, indice=0):
    """Uma página de um PDF, a primeira por padrão, desenhada com `largura` pixels, em WebP."""
    import fitz  # PyMuPDF
    # O MuPDF reclama no terminal da árvore de estrutura de alguns PDFs, a parte
    # de acessibilidade, que a primeira página desenhada não usa.
    fitz.TOOLS.mupdf_display_errors(False)
    with fitz.open(stream=pdf, filetype="pdf") as doc:
        pagina = doc[indice]
        zoom = largura / pagina.rect.width
        pix = pagina.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        png = pix.tobytes("png")
    return webp(png, grafico=False)


def corrige_pdf(pdf, pagina, trocas, fonte_do_curso):
    """Troca linhas de texto numa página do PDF dos slides, no mesmo lugar e com a mesma letra.

    O PDF sai do Edge com as letras em fontes Type 3, que não servem para
    escrever texto novo. Cada linha a trocar é achada pelo texto, apagada por
    redação, só o texto, sem tocar nas imagens nem nos traços do slide, e
    reescrita na mesma linha de base, com o mesmo corpo e a mesma cor, na fonte
    do infra/fontes do curso que o slide usa.

    trocas: [{"de": [linhas], "para": [linhas], "fonte": caminho do .ttf no
      curso, "fundo": cor que fica no lugar do texto apagado}]
    O resultado é o mesmo byte a byte a cada rodada: o PyMuPDF não carimba
    data nem troca o /ID ao salvar assim.
    """
    import tempfile
    import fitz  # PyMuPDF
    fitz.TOOLS.mupdf_display_errors(False)
    doc = fitz.open(stream=pdf, filetype="pdf")
    pg = doc[pagina - 1]
    # Cada linha da página com o texto dela inteiro. A busca do PyMuPDF não
    # serve aqui: com as fontes Type 3 do Edge, cada palavra é um trecho à
    # parte, e ela devolve um retângulo por palavra.
    linhas = []
    for b in pg.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            texto = "".join(s["text"] for s in l["spans"]).strip()
            primeiro = next((s for s in l["spans"] if s["text"].strip()), None)
            if texto and primeiro:
                linhas.append((texto, fitz.Rect(l["bbox"]), primeiro))
    novos = []
    for tr in trocas:
        if len(tr["de"]) != len(tr["para"]):
            raise SystemExit("correção de PDF: 'de' e 'para' precisam do mesmo número de linhas")
        cor_fundo = tuple(int(tr["fundo"][k:k + 2], 16) / 255 for k in (1, 3, 5))
        for de, para in zip(tr["de"], tr["para"]):
            achados = [(r, s) for texto, r, s in linhas if texto == de]
            if len(achados) != 1:
                raise SystemExit(f"correção de PDF, página {pagina}: a linha {de!r} aparece {len(achados)} vez(es)")
            r, s = achados[0]
            novos.append((s["origin"], s["size"], s["color"], para, tr["fonte"]))
            pg.add_redact_annot(r + (-1, -1, 1, 1), fill=cor_fundo)
    pg.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
    with tempfile.TemporaryDirectory() as tmp:
        nomes = {}
        for origem, tam, cor, texto, fonte in novos:
            if fonte not in nomes:
                caminho = Path(tmp) / f"f{len(nomes)}.ttf"
                caminho.write_bytes(fonte_do_curso.ler(fonte))
                nomes[fonte] = (f"F{len(nomes)}", str(caminho))
            nome, arquivo = nomes[fonte]
            rgb = tuple(((cor >> k) & 255) / 255 for k in (16, 8, 0))
            pg.insert_text(origem, texto, fontsize=tam, fontname=nome, fontfile=arquivo, color=rgb)
        return doc.tobytes(garbage=3, deflate=True, no_new_id=True)


def youtube(video_id):
    """Título, canal e miniatura de um vídeo, pelo oEmbed do próprio YouTube.

    O título e o canal que aparecem na página vêm daqui e não do texto do
    README, que só cita: o oEmbed é o que o YouTube diz do vídeo hoje. A
    miniatura é baixada e servida pelo site, como WebP, em vez de apontar para
    i.ytimg.com: assim a página não chama o Google para desenhar um cartão, e
    continua certa sob uma Content-Security-Policy de img-src 'self'.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    meta = json.loads(baixa("https://www.youtube.com/oembed?format=json&url=" + urllib.request.quote(url, safe=""),
                            f"yt-{video_id}.json"))
    try:
        imagem = baixa(f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg", f"yt-{video_id}-max.jpg")
    except SystemExit:
        imagem = baixa(f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg", f"yt-{video_id}-hq.jpg")
    return {"id": video_id, "url": url, "titulo": meta["title"], "canal": meta["author_name"],
            "canal_url": meta.get("author_url"), "miniatura": webp(imagem, caixa=(400, 225), grafico=False)}


class Cdn:
    """Os arquivos que vão para o nipscern-assets, com nome versionado e imutável."""

    BASE = "https://cdn.nipscern.com/"

    def __init__(self, manifesto, pasta, clone=None):
        self.caminho = Path(manifesto)
        self.pasta = pasta.strip("/")               # courses/limiar
        self.clone = Path(clone) if clone else None
        self.dados = json.loads(self.caminho.read_text(encoding="utf-8")) if self.caminho.exists() else {}
        self.usados = {}

    def publica(self, origem, conteudo, nome):
        """Devolve a URL pública de `conteudo`, que veio de `origem` no repositório do curso.

        nome: o nome do arquivo sem versão, como limiar-aula-02-derivada.mp4.
        """
        h = hashlib.sha256(conteudo).hexdigest()
        base, ext = nome.rsplit(".", 1)
        entrada = self.dados.get(origem)
        if not entrada or entrada["sha256"] != h:
            versao = entrada["versao"] + 1 if entrada else 1
            entrada = {"sha256": h, "versao": versao, "bytes": len(conteudo),
                       "caminho": f"{self.pasta}/{base}-v{versao}.{ext}"}
            self.dados[origem] = entrada
        self.usados[entrada["caminho"]] = conteudo
        return self.BASE + entrada["caminho"]

    def grava(self):
        """Grava o manifesto e, com o clone do nipscern-assets, copia para lá o que faltar.

        Um arquivo que já existe no clone com outro conteúdo é erro, e não é
        sobrescrito: publicado no CDN, ele é imutável.
        """
        ordenado = dict(sorted(self.dados.items()))
        texto = json.dumps(ordenado, indent=2, ensure_ascii=False) + "\n"
        if not self.caminho.exists() or self.caminho.read_text(encoding="utf-8").replace("\r\n", "\n") != texto:
            self.caminho.write_text(texto, encoding="utf-8", newline="\n")
        relatorio = []
        for caminho, conteudo in sorted(self.usados.items()):
            estado = "sem clone do nipscern-assets"
            if self.clone:
                alvo = self.clone / caminho
                if alvo.exists():
                    if hashlib.sha256(alvo.read_bytes()).hexdigest() != hashlib.sha256(conteudo).hexdigest():
                        raise SystemExit(f"{alvo} já existe com outro conteúdo; no CDN um arquivo publicado não muda")
                    estado = "já no clone"
                else:
                    alvo.parent.mkdir(parents=True, exist_ok=True)
                    alvo.write_bytes(conteudo)
                    estado = "copiado para o clone"
            relatorio.append((caminho, len(conteudo), estado))
        return relatorio
