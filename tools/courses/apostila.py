"""Uma parte de apostila em PDF, lida para a página do site.

O curso que chega como apostila não tem repositório com README e roteiro: tem
o PDF, feito em LaTeX, e o PDF muda ao longo do semestre. Por isso a página de
cada parte não guarda texto escrito à mão sobre ela. O sumário sai dos
marcadores do PDF, que o hyperref grava; a abertura de cada capítulo, o
objetivo de cada prática de laboratório e a contagem de exercícios saem do
texto das páginas; o número de páginas, a data e as figuras, do próprio
arquivo. Um PDF novo refaz tudo isso sozinho.

O que se lê do texto depende do desenho da apostila: o título da parte no
primeiro nível dos marcadores, os capítulos no segundo, as seções no
terceiro, a caixa da prática com OBJETIVOS e o gabarito com a resposta de cada
exercício numa linha que começa pelo número dele. Quando o desenho muda, a
leitura para com erro e diz o que não achou, em vez de publicar uma página
torta.
"""
import io
import re
from dataclasses import dataclass, field

import fitz  # PyMuPDF

fitz.TOOLS.mupdf_display_errors(False)
ROMANOS = re.compile(r"^([IVXL]+) (.+)$")
NUMERO_E_TITULO = re.compile(r"^(\d+(?:\.\d+)*) (.+)$")
PRATICA = re.compile(r"^Prática de laboratório (\d+): (.+)$")
# Um título de caixa, como MATERIAL ou PRÉ-LABORATÓRIO: só maiúsculas.
CABECALHO = re.compile(r"^[A-ZÀ-Ý][A-ZÀ-Ý \-]{3,}$")


@dataclass
class Entrada:
    """Um marcador do PDF: o número, se tem, o título, a página e o ponto dela."""
    numero: str | None
    titulo: str
    indice: int          # a página, contada de 0
    rotulo: str          # o número impresso na página, que é o que o leitor vê
    topo: float | None = None   # a altura do destino na página, em pontos do PDF, contada de baixo

    @property
    def pagina(self):
        """A página para o #page= do endereço do PDF, contada de 1."""
        return self.indice + 1


def _topo(destino):
    """A altura do ponto para onde o marcador leva, como o #view=FitH,topo do PDF pede, ou None.

    O hyperref grava cada marcador como destino com nome, chapter.1 ou
    subsection.1.1.3, que aponta um /XYZ um pouco acima do título; o PyMuPDF
    resolve o nome e devolve o ponto em coordenadas do PDF, com o zero embaixo."""
    ponto = destino.get("to") if destino.get("kind") in (fitz.LINK_GOTO, fitz.LINK_NAMED) else None
    return round(ponto.y, 1) if ponto is not None else None


@dataclass
class Capitulo(Entrada):
    secoes: list = field(default_factory=list)
    abertura: list = field(default_factory=list)   # os parágrafos antes da primeira seção
    exercicios: int = 0      # quantos o capítulo propõe
    respondidos: int = 0     # quantos o gabarito responde


@dataclass
class Pratica(Entrada):
    n: int = 0             # o número da prática, que corre pela apostila inteira
    objetivo: str = ""


def _data(meta):
    m = re.match(r"D:(\d{4})(\d{2})(\d{2})", meta.get("creationDate") or "")
    if not m:
        raise SystemExit("o PDF não tem data de criação nos metadados")
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"


def _junta(texto):
    return re.sub(r"\s+", " ", texto).strip()


PALAVRA = r"[A-Za-zÀ-ÿ0-9]+"


def _vocabulario(doc):
    """As palavras que o PDF escreve inteiras numa linha, em minúsculas, com as compostas de hífen."""
    palavras = set()
    for pg in doc:
        for linha in pg.get_text("text").splitlines():
            palavras.update(t.lower() for t in re.findall(rf"{PALAVRA}(?:-{PALAVRA})*", linha))
    return palavras


def _costura(linhas, vocabulario):
    """As linhas de um parágrafo numa só, com a palavra partida no fim da linha inteira de novo.

    O LaTeX parte a palavra em sílabas no fim da linha e parte a composta no
    hífen dela, e no PDF as duas saem iguais: "inte-" numa linha e "grados" na
    outra, "passa-" e "baixas". O que decide é o resto do próprio PDF: se a
    forma com hífen aparece inteira em outra linha, e a sem hífen não, é
    composta e o hífen fica; nos outros casos, é sílaba e a palavra se junta.
    A opção TEXT_DEHYPHENATE do PyMuPDF junta as duas, e ainda deixava escapar
    partidas como "pri- meiro"."""
    saida = ""
    for linha in (_junta(l) for l in linhas):
        if not linha:
            continue
        antes = re.search(rf"({PALAVRA}(?:-{PALAVRA})*)-$", saida)
        depois = re.match(rf"{PALAVRA}", linha)
        if antes and depois and linha[0].islower():
            composta = f"{antes.group(1)}-{depois.group(0)}".lower()
            inteira = (antes.group(1) + depois.group(0)).lower()
            if composta in vocabulario and inteira not in vocabulario:
                saida += linha
            else:
                saida = saida[:-1] + linha
        else:
            saida = f"{saida} {linha}" if saida else linha
    return saida


class Apostila:
    def __init__(self, pdf, nome):
        self.nome = nome
        self.bytes = len(pdf)
        self.doc = fitz.open(stream=pdf, filetype="pdf")
        self.paginas = self.doc.page_count
        self.data = _data(self.doc.metadata)
        self.vocabulario = _vocabulario(self.doc)
        self._marcadores()
        self._aberturas()
        self._praticas()
        self._exercicios()

    def erro(self, msg):
        raise SystemExit(f"{self.nome}: {msg}")

    def rotulo(self, indice):
        return self.doc[indice].get_label() or str(indice + 1)

    def entrada(self, texto, indice, classe=Entrada, topo=None, **extra):
        m = NUMERO_E_TITULO.match(texto)
        numero, titulo = (m.group(1), m.group(2)) if m else (None, texto)
        return classe(numero, titulo.strip(), indice, self.rotulo(indice), topo, **extra)

    # ---------------------------------------------------------- os marcadores

    def _marcadores(self):
        toc = self.doc.get_toc(simple=False)
        partes = [t for t in toc if t[0] == 1]
        if len(partes) != 1 or not ROMANOS.match(partes[0][1]):
            self.erro("o primeiro nível dos marcadores tem de ser um só, o da parte, como 'I Fundamentos ...'")
        self.numeral, self.titulo = ROMANOS.match(partes[0][1]).groups()
        self.capitulos, self.gabarito = [], None
        atual = None
        for nivel, texto, pagina, destino in toc:
            texto = _junta(texto)
            if nivel == 2:
                if texto.startswith("Gabarito"):
                    self.gabarito = self.entrada(texto, pagina - 1, topo=_topo(destino))
                    atual = None
                    continue
                atual = self.entrada(texto, pagina - 1, Capitulo, _topo(destino))
                if not atual.numero or "." in atual.numero:
                    self.erro(f"o marcador de capítulo {texto!r} não começa pelo número do capítulo")
                self.capitulos.append(atual)
            elif nivel == 3 and atual:
                atual.secoes.append(self.entrada(texto, pagina - 1, topo=_topo(destino)))
        if not self.capitulos:
            self.erro("os marcadores não têm capítulo nenhum")
        if not self.gabarito:
            self.erro("os marcadores não têm o gabarito dos exercícios")

    def fim_do_capitulo(self, cap):
        """A última página do capítulo, contada de 0: a de antes do próximo capítulo ou do gabarito."""
        seguintes = [c.indice for c in self.capitulos if c.indice > cap.indice] + [self.gabarito.indice]
        return min(seguintes) - 1

    # ---------------------------------------------------------- o texto das páginas

    def blocos(self, indice):
        """Os blocos de texto da página, em ordem de leitura, cada um numa linha só."""
        return [(b[1], _costura(b[4].splitlines(), self.vocabulario))
                for b in self.doc[indice].get_text("blocks", sort=True) if b[6] == 0]

    def linhas(self, indice):
        saida = []
        for b in self.doc[indice].get_text("dict", sort=True)["blocks"]:
            for l in b.get("lines", []):
                t = _junta("".join(s["text"] for s in l["spans"]))
                if t:
                    saida.append(t)
        return saida

    def _aberturas(self):
        """Os parágrafos que abrem o capítulo, entre o título e a primeira seção."""
        for cap in self.capitulos:
            primeira = next((s for s in cap.secoes if s.numero), None)
            if not primeira or primeira.indice != cap.indice:
                self.erro(f"o capítulo {cap.numero} não tem a primeira seção na mesma página do título")
            blocos = [t for _, t in self.blocos(cap.indice)]
            try:
                ini = blocos.index(cap.titulo) + 1
                fim = blocos.index(f"{primeira.numero} {primeira.titulo}")
            except ValueError:
                self.erro(f"não achei, na página {cap.rotulo}, o título do capítulo {cap.numero} e o da seção {primeira.numero}")
            cap.abertura = [t for t in blocos[ini:fim] if len(t) > 40]
            if not cap.abertura:
                self.erro(f"o capítulo {cap.numero} não tem parágrafo de abertura antes da seção {primeira.numero}")

    def _praticas(self):
        """Cada prática de laboratório, com o texto que vem embaixo de OBJETIVOS na caixa dela."""
        self.praticas = []
        for cap in self.capitulos:
            for s in cap.secoes:
                m = PRATICA.match(s.titulo)
                if not m:
                    continue
                linhas = self.linhas(s.indice) + (self.linhas(s.indice + 1) if s.indice + 1 < self.paginas else [])
                cabeca = f"Prática {m.group(1)}:"
                try:
                    k = next(i for i, l in enumerate(linhas) if l.startswith(cabeca))
                    k = linhas.index("OBJETIVOS", k) + 1
                except (StopIteration, ValueError):
                    self.erro(f"a prática {m.group(1)} não tem a caixa com OBJETIVOS")
                objetivo = []
                while k < len(linhas) and not CABECALHO.match(linhas[k]):
                    objetivo.append(linhas[k])
                    k += 1
                if not objetivo:
                    self.erro(f"o objetivo da prática {m.group(1)} saiu vazio")
                self.praticas.append(Pratica(s.numero, m.group(2), s.indice, s.rotulo, s.topo, n=int(m.group(1)),
                                             objetivo=_costura(objetivo, self.vocabulario)))

    def _exercicios(self):
        """Quantos exercícios cada capítulo propõe, e quantos o gabarito responde.

        Nas páginas do capítulo e no gabarito, cada exercício abre com o número
        dele sozinho na linha, como 3.7. Os do capítulo têm de ir de 1 em diante
        sem falha, e o gabarito só pode responder o que o capítulo propõe; se
        não for assim, é o desenho que mudou. Nem todo exercício tem resposta:
        na versão 1, os de simulação no LTspice do fim dos capítulos 2 e 3,
        abertos, não têm."""
        def numeros(indices):
            achados = set()
            for i in indices:
                for l in self.linhas(i):
                    m = re.fullmatch(r"(\d+)\.(\d+)", l)
                    if m:
                        achados.add((int(m.group(1)), int(m.group(2))))
            return achados
        respostas = numeros(range(self.gabarito.indice, self.paginas))
        for cap in self.capitulos:
            n = int(cap.numero)
            no_gabarito = sorted(k for c, k in respostas if c == n)
            no_texto = sorted(k for c, k in numeros(range(cap.indice, self.fim_do_capitulo(cap) + 1)) if c == n)
            if not no_texto or no_texto != list(range(1, len(no_texto) + 1)):
                self.erro(f"os exercícios do capítulo {n} não vão de {n}.1 em diante sem falha: {no_texto}")
            if not set(no_gabarito) <= set(no_texto):
                self.erro(f"o gabarito responde exercícios do capítulo {n} que o capítulo não tem: "
                          f"{sorted(set(no_gabarito) - set(no_texto))}")
            cap.exercicios, cap.respondidos = len(no_texto), len(no_gabarito)

    def texto(self):
        """O texto inteiro, com os espaços juntados: é nele que se confere uma citação."""
        if not hasattr(self, "_texto"):
            linhas = [l for pg in self.doc for l in pg.get_text("text").splitlines()]
            self._texto = _costura(linhas, self.vocabulario)
        return self._texto

    def texto_da_secao(self, numero):
        """O texto de uma seção ou subseção, do título dela até o título do marcador seguinte.

        É para o resumo que avisa quando a seção de onde saiu um texto curado
        mudou. Lê só as páginas da seção, e não o texto inteiro, porque o
        sumário do começo repete todos os títulos."""
        toc = [(_junta(t), p - 1) for _, t, p in self.doc.get_toc()]
        for k, (titulo, pagina) in enumerate(toc):
            if titulo.startswith(numero + " "):
                prox = toc[k + 1] if k + 1 < len(toc) else None
                ultima = prox[1] if prox else self.paginas - 1
                linhas = [l for i in range(pagina, ultima + 1) for l in self.doc[i].get_text("text").splitlines()]
                texto = _costura(linhas, self.vocabulario)
                ini = texto.find(titulo)
                if ini < 0:
                    self.erro(f"não achei o título da seção {numero} na página {self.rotulo(pagina)}")
                fim = texto.find(prox[0], ini + len(titulo)) if prox else -1
                return texto[ini:fim if fim > ini else None]
        self.erro(f"os marcadores não têm a seção {numero}")

    def destino_da_secao(self, numero):
        """A página de uma seção ou subseção pelos marcadores, contada de 0, e a altura do título nela."""
        for _, titulo, pagina, destino in self.doc.get_toc(simple=False):
            if _junta(titulo).startswith(numero + " "):
                return pagina - 1, _topo(destino)
        self.erro(f"os marcadores não têm a seção {numero}")

    def pagina_da_citacao(self, citacao):
        """A página em que a citação começa, contada de 0, ou None se ela não está no PDF.

        Procura página a página e, para a que atravessa a quebra, em cada par de
        páginas seguidas."""
        paginas = [pg.get_text("text").splitlines() for pg in self.doc]
        for i in range(self.paginas):
            if citacao in _costura(paginas[i], self.vocabulario):
                return i
        for i in range(self.paginas - 1):
            if citacao in _costura(paginas[i] + paginas[i + 1], self.vocabulario):
                return i
        return None

    def topo_da_citacao(self, citacao, indice):
        """A altura da linha em que a citação começa na página `indice`, em pontos do PDF, contada de baixo.

        Procura as primeiras palavras da citação na página, e sobe um pouco, para
        a linha não colar no alto da tela. Sem achar, como quando a primeira
        palavra vem partida em sílabas, dá None, e o link abre no alto da página."""
        pg = self.doc[indice]
        palavras = citacao.split()
        for n in (6, 4, 3):
            achados = pg.search_for(" ".join(palavras[:n]))
            if achados:
                return round((achados[0].tl * ~pg.transformation_matrix).y + 12, 1)
        return None

    # ---------------------------------------------------------- imagens

    def pagina_png(self, indice, largura, clip=None):
        pg = self.doc[indice]
        area = clip or pg.rect
        zoom = largura / area.width
        return pg.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=area, alpha=False).tobytes("png")

    def faixa_da_capa(self, largura):
        """A faixa colorida do alto da capa, com o título dentro, desenhada em PNG.

        É o maior retângulo pintado da primeira página que não é branco; vira
        o fundo desfocado do hero, como a capa do Limiar vira o dele."""
        pg = self.doc[0]
        pintados = [d for d in pg.get_drawings() if d.get("fill") and max(d["fill"]) < 0.95]
        if not pintados:
            self.erro("a capa não tem faixa colorida")
        faixa = max(pintados, key=lambda d: d["rect"].width * d["rect"].height)
        return self.pagina_png(0, largura, faixa["rect"])

    def figura(self, rotulo, quadro=(1280, 720), margem=0.08):
        """A figura de legenda `rotulo`, como "Figura 3.7", no centro de um quadro branco, em PNG.

        O quadro tem a proporção da capa de uma aula no cartão, 16:9, e a
        figura entra inteira, com uma margem, sobre o branco do papel dela."""
        from PIL import Image
        area, indice = self.area_da_figura(rotulo)
        cabe = (quadro[0] * (1 - 2 * margem), quadro[1] * (1 - 2 * margem))
        escala = min(cabe[0] / area.width, cabe[1] / area.height)
        fig = Image.open(io.BytesIO(self.pagina_png(indice, round(area.width * escala), area))).convert("RGB")
        tela = Image.new("RGB", quadro, "white")
        tela.paste(fig, ((quadro[0] - fig.width) // 2, (quadro[1] - fig.height) // 2))
        b = io.BytesIO()
        tela.save(b, "PNG")
        return b.getvalue()

    def area_da_figura(self, rotulo):
        """O retângulo da figura de legenda `rotulo` na página, e o índice da página.

        A figura é vetorial, do TikZ. Os traços são agrupados pela distância
        entre eles, e a figura é o grupo logo acima da legenda, mais os grupos
        que estão ao lado dele ou empilhados em cima, a menos de um palmo, e os
        rótulos dos eixos, que são texto e ficam na borda."""
        for pg in self.doc:
            legenda = next((fitz.Rect(l["bbox"]) for b in pg.get_text("dict")["blocks"]
                            for l in b.get("lines", [])
                            if "".join(s["text"] for s in l["spans"]).strip().startswith(rotulo + ". ")), None)
            if legenda:
                break
        else:
            self.erro(f"não achei a legenda {rotulo!r}")
        area_pg = pg.rect.width * pg.rect.height
        tracos = [d for d in pg.get_drawings() if d["rect"].width * d["rect"].height < 0.5 * area_pg]
        grupos = [r for r in pg.cluster_drawings(drawings=tracos, x_tolerance=12, y_tolerance=12)
                  if r.y1 <= legenda.y0 + 1 and r.width > 20]
        if not grupos:
            self.erro(f"não há desenho acima da legenda {rotulo!r}, na página {self.rotulo(pg.number)}")
        area = fitz.Rect(max(grupos, key=lambda r: r.y1))
        cresceu = True
        while cresceu:
            cresceu = False
            for r in grupos:
                if not area.contains(r) and r.y1 >= area.y0 - 26 and r.y0 <= area.y1 and r.x1 > area.x0 - 40 and r.x0 < area.x1 + 40:
                    area |= r
                    cresceu = True
        for b in pg.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                r = fitz.Rect(l["bbox"])
                if (r.y1 <= legenda.y0 - 1 and r.y0 >= area.y0 - 14 and r.y0 <= area.y1 + 14
                        and r.x0 >= area.x0 - 45 and r.x1 <= area.x1 + 45):
                    area |= r
        return area + (-4, -4, 4, 4), pg.number
