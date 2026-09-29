"""Os slides de uma aula, do formato do tipo Slides do Artifact para uma página do site.

Cada aula grava o deck em slides/project/: deck.json com a ordem e um HTML por
slide, uma <section> de 1920 por 1080 com todo o estilo inline e a anotação do
apresentador num <aside>. Imagens e vídeos aparecem como /_blob/<id>, o
endereço que o Artifact devolveu quando o arquivo foi enviado; o mapa de volta
para o arquivo no repositório está no ARQUIVOS do slides.py da aula e, quando a
aula tem vídeo, no VIDEOS, com o quadro parado e o mp4 de cada um.

O slides.py não é executado. Ele monta o deck inteiro ao ser importado, com as
equações compiladas pelo MiKTeX, e importar isso aqui faria o site depender do
ambiente de quem prepara as aulas. Os dois mapas são lidos da árvore sintática
do arquivo: as constantes de texto, a chamada usa_logos() e as atribuições de
VIDEOS e ARQUIVOS. A expressão de ARQUIVOS é avaliada sobre essas constantes e
nada mais, sem builtins.
"""
import ast
import json
import re

BLOB = re.compile(r"/_blob/[0-9a-f]{32}")


def _constantes_e_mapas(codigo, nome):
    arvore = ast.parse(codigo, nome)
    textos, logos, videos, no_arquivos, icones = {}, {}, {}, None, None
    for no in arvore.body:
        if isinstance(no, ast.Assign) and len(no.targets) == 1 and isinstance(no.targets[0], ast.Name):
            alvo = no.targets[0].id
            if isinstance(no.value, ast.Constant) and isinstance(no.value.value, str):
                textos[alvo] = no.value.value
            elif alvo == "VIDEOS":
                videos = ast.literal_eval(no.value)
            elif alvo == "ARQUIVOS":
                no_arquivos = no.value
            elif alvo == "ICONES":
                icones = ast.literal_eval(no.value)
        elif (isinstance(no, ast.Expr) and isinstance(no.value, ast.Call)
              and getattr(no.value.func, "id", None) == "usa_logos"):
            logos = {k.arg: ast.literal_eval(k.value) for k in no.value.keywords}
    return textos, logos, videos, no_arquivos, icones


def mapa_da_aula(fonte, pasta):
    """Endereço /_blob/ -> caminho no repositório, e os vídeos da aula.

    Devolve (arquivos, videos), com videos no formato do slides.py:
    nome -> (blob do quadro parado, blob do mp4).
    """
    nome = f"{pasta}/slides.py"
    textos, logos, videos, no_arquivos, _ = _constantes_e_mapas(fonte.texto(nome), nome)
    if no_arquivos is None:
        raise SystemExit(f"{nome}: não achei a atribuição ARQUIVOS = ...")
    ambiente = {**textos, "LOGOS": logos, "VIDEOS": videos, "__builtins__": {}}
    arquivos = eval(compile(ast.Expression(no_arquivos), nome, "eval"), ambiente)  # noqa: S307
    for video, (_, mp4) in videos.items():
        arquivos[mp4] = f"{pasta}/videos/{video}.mp4"
    return arquivos, videos


def icones_do_modelo(fonte):
    """Os traços dos ícones que o pdf_local de infra/slides.py põe no lugar dos <x-icon>."""
    _, _, _, _, icones = _constantes_e_mapas(fonte.texto("infra/slides.py"), "infra/slides.py")
    if not icones:
        raise SystemExit("infra/slides.py: não achei ICONES")
    return icones


def le_deck(fonte, pasta):
    """O índice e os slides, na ordem do deck: (indice, [(id, html), ...])."""
    base = f"{pasta}/slides/project"
    indice = json.loads(fonte.texto(f"{base}/deck.json"))
    slides = [(i, fonte.texto(f"{base}/slides/{i}.html").strip()) for i in indice["order"]]
    for i, html in slides:
        # O deck vem de um repositório nosso, mas vai inteiro para dentro de uma
        # página do site. Script ou atributo de evento ali seria código rodando
        # em nipscern.com, e o formato do Artifact não usa nenhum dos dois.
        if re.search(r"<script\b|\son[a-z]+\s*=|javascript:", html, re.I):
            raise SystemExit(f"{base}/slides/{i}.html traz script ou atributo de evento; o deck não pode ter isso")
    return indice, slides


def caixas_das_imagens(slides):
    """Para cada /_blob/, a maior caixa em que ele aparece e o encaixe: blob -> (l, a, encaixe)."""
    caixas = {}
    for _, html in slides:
        for tag in re.findall(r"<img\b[^>]*>", html):
            src = re.search(r'src="(/_blob/[0-9a-f]{32})"', tag)
            estilo = re.search(r'style="([^"]*)"', tag)
            if not src or not estilo:
                continue
            l = re.search(r"(?<![-\w])width:\s*(\d+)px", estilo.group(1))
            a = re.search(r"(?<![-\w])height:\s*(\d+)px", estilo.group(1))
            fit = re.search(r"object-fit:\s*(\w+)", estilo.group(1))
            if not l or not a:
                continue
            atual = caixas.get(src.group(1), (0, 0, "cover"))
            caixas[src.group(1)] = (max(atual[0], int(l.group(1))), max(atual[1], int(a.group(1))),
                                    fit.group(1) if fit else atual[2])
    return caixas


def traduz(html, enderecos, icones):
    """Troca os /_blob/ pelos endereços publicados e as peças do Artifact por HTML comum.

    x-icon e x-shape só existem dentro do Artifact; a tradução é a mesma do
    pdf_local de infra/slides.py, que é a que o PDF da turma já usa.
    """
    def blob(m):
        try:
            return enderecos[m.group(0)]
        except KeyError:
            raise SystemExit(f"{m.group(0)} aparece no deck e não está no ARQUIVOS nem no VIDEOS do slides.py")

    html = BLOB.sub(blob, html)
    html = re.sub(r'<x-icon name="(\w+)" style="([^"]*)"></x-icon>',
                  lambda m: (f'<span style="display:inline-block; {m.group(2)}"><svg viewBox="0 0 24 24" '
                             f'width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" '
                             f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                             f'{icones.get(m.group(1), "")}</svg></span>'), html)
    html = re.sub(r'<x-shape kind="arrow-right" style="([^"]*)"></x-shape>',
                  r'<div style="\1; clip-path: polygon(0 30%, 60% 30%, 60% 0, 100% 50%, 60% 100%, 60% 70%, 0 70%)"></div>',
                  html)
    sobra = set(re.findall(r"<x-[a-z-]+", html))
    if sobra:
        raise SystemExit(f"elemento do Artifact sem tradução no deck: {sorted(sobra)}")
    return html


def anotacao(html):
    """O texto do <aside> de um slide, a anotação do apresentador."""
    m = re.search(r"<aside>(.*?)</aside>", html, re.S)
    return m.group(1).strip() if m else ""
