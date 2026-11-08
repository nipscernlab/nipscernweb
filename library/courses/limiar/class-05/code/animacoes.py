"""Os vídeos da aula 5, feitos com o Manim Community.

Rode, a partir da raiz do repositório, com o nome dos vídeos que quer gravar, ou
sem nome nenhum para gravar todos:
    python aulas/05-retropropagacao/codigo/animacoes.py
    python aulas/05-retropropagacao/codigo/animacoes.py retro

Os três vídeos, na ordem da aula:
    taxas        z = 3w e L = z², em três retas com a mesma escala: um passo em w cresce 3 vezes em z e
                 2z vezes em L; com o passo menor, as razões chegam a 3, 6 e 18
    retro        a retropropagação na rede do XOR, com os pesos à mão da aula 3 e a sigmoide, na entrada
                 (0; 1): para a frente os valores, para trás os δ e as nove derivadas
    treino-xor   a retropropagação treina a rede 2-2-1: a perda cai e a fronteira se forma

Duas opções servem para conferir antes da gravação final, que é a mais demorada:
    --previa <pasta>   grava em 854 por 480, a 15 quadros por segundo, na pasta dada
    --quadros          grava só o último quadro, em 1920 por 1080, sem o mp4

Precisa do Manim Community (pip install manim), do MiKTeX, o mesmo das equações
dos slides, e do ffmpeg. Cada vídeo sai em dois arquivos:
    aulas/05-retropropagacao/videos/<nome>.mp4           1920 por 1080, 30 quadros por segundo
    aulas/05-retropropagacao/figuras/<nome>-quadro.png   o último quadro, que o slide mostra parado

As regras são as dos vídeos da aula 2. O vídeo ocupa uns 60% da largura do
slide, embaixo do título, e não tem título próprio; texto corrido com pelo menos
30 pontos do Manim, equação com pelo menos 36. Todo texto e todo número entra
escrito; as formas entram desenhadas. Nada se sobrepõe: cada texto tem um lugar
fixo, fora dos dados. E nada é sorteado na hora: o treino é o de
retropropagacao.py, com a semente da referência.
"""
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from contourpy import contour_generator
from manim import (DOWN, LEFT, RIGHT, UP, Arrow, Circle, Create, DashedLine, DecimalNumber, Dot, FadeIn, FadeOut,
                   GrowArrow, GrowFromCenter, ImageMobject, LaggedStart, Line, MathTex, MoveAlongPath, Polygon,
                   Rectangle, Scene, Square, Transform,
                   TexTemplate, Text, ValueTracker, VGroup, VMobject, Write, always_redraw, config, linear,
                   tempconfig)
from manimpango import register_font

RAIZ = Path(__file__).resolve().parents[3]
AULA = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from retropropagacao import EPOCAS, SEMENTE, T, X, para_a_frente, treina  # noqa: E402

# As fontes do curso, as mesmas dos slides, guardadas em infra/fontes/ com as licenças
for arquivo in ("IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf", "SourceSerif4-Semibold.ttf"):
    register_font(str(RAIZ / "infra" / "fontes" / arquivo))
SANS = "IBM Plex Sans"

# A paleta de infra/slides.py e das figuras: resposta 1 em círculo azul, resposta
# 0 em quadrado vermelho, região que dispara em azul claro
FUNDO, ESCURO, TEXTO, SUAVE = "#F6F5F1", "#14213D", "#3B4658", "#5E6A7D"
AZUL, LARANJA, VERMELHO, REGIAO = "#1F5FAD", "#A8500F", "#C0392B", "#CFE3F5"

# As equações em STIX Two, a fonte das equações dos slides (infra/equacoes.py)
MODELO = TexTemplate(preamble="\\usepackage[T1]{fontenc}\n\\usepackage{amsmath}\n\\usepackage{stix2}\n")
config.tex_template = MODELO


def texto(s, tamanho=32, cor=TEXTO):
    """Texto corrido, na fonte dos slides."""
    return Text(s, font=SANS, font_size=tamanho, color=cor)


def eq(tex, tamanho=40, cor=ESCURO):
    """Equação em LaTeX, na STIX Two."""
    return MathTex(tex, font_size=tamanho, color=cor, tex_template=MODELO)


class Numero(DecimalNumber):
    """Número que muda na tela, à brasileira: vírgula decimal e ponto no milhar, como 0,0021 e 2.000."""

    def _get_num_string(self, number):
        if self.num_decimal_places == 0:
            return f"{int(round(number)):,}".replace(",", ".")
        return f"{number:.{self.num_decimal_places}f}".replace(".", ",")


def bolinha(t, raio=0.17):
    """O marcador de um exemplo: círculo azul para a resposta 1, quadrado vermelho para a 0."""
    if t == 1:
        return Circle(radius=raio, color=AZUL, fill_opacity=1, stroke_width=0)
    return Square(side_length=raio * 1.8, color=VERMELHO, fill_opacity=1, stroke_width=0)


def legenda(*itens, tamanho=28):
    """Uma linha de legenda: cada item é (ícone, texto)."""
    return VGroup(*[VGroup(icone, texto(rotulo, tamanho)).arrange(RIGHT, buff=0.14) for icone, rotulo in itens]
                  ).arrange(RIGHT, buff=0.55)


class Plano:
    """Um quadrado do plano, de −0,5 a 1,5 nos dois eixos, com marcas em 0 e 1 por fora.

    canto: o canto de baixo à esquerda, na tela; lado: o tamanho do quadrado,
    na tela; nomes: o LaTeX do eixo de baixo e do eixo da esquerda.
    """

    LIM = (-0.5, 1.5)

    def __init__(self, canto, lado, nomes):
        self.canto, self.lado, self.nomes = np.array([*canto, 0.0]), lado, nomes

    def p(self, a, c):
        """Leva o ponto (a, c) do plano para a tela."""
        e = self.lado / (self.LIM[1] - self.LIM[0])
        return self.canto + np.array([(a - self.LIM[0]) * e, (c - self.LIM[0]) * e, 0.0])

    def centro(self):
        return self.p(0.5, 0.5)

    def desenho(self):
        """A moldura, as marcas, os números e os nomes dos eixos, tudo fora da área dos dados.

        Devolve (moldura, textos): a moldura entra desenhada, e os textos, escritos.
        """
        caixa = Rectangle(width=self.lado, height=self.lado, color=ESCURO, stroke_width=2.5).move_to(self.centro())
        tracos, num_x, num_y = VGroup(), VGroup(), VGroup()
        for v in (0, 1):
            bx, by = self.p(v, self.LIM[0]), self.p(self.LIM[0], v)
            tracos.add(Line(bx, bx + UP * 0.12, color=ESCURO, stroke_width=2.5),
                       Line(by, by + RIGHT * 0.12, color=ESCURO, stroke_width=2.5))
            num_x.add(eq(str(v), 30, TEXTO).next_to(bx, DOWN, buff=0.12))
            num_y.add(eq(str(v), 30, TEXTO).next_to(by, LEFT, buff=0.14))
        nome_x = eq(self.nomes[0], 38).next_to(VGroup(caixa, num_x), DOWN, buff=0.12)
        nome_y = eq(self.nomes[1], 38).next_to(VGroup(caixa, num_y), LEFT, buff=0.18)
        return VGroup(caixa, tracos), VGroup(num_x, num_y, nome_x, nome_y)

    def segmento(self, a, c, **estilo):
        return Line(self.p(*a), self.p(*c), **estilo)

    def poligono(self, vertices, cor=REGIAO):
        return Polygon(*[self.p(*v) for v in vertices], fill_color=cor, fill_opacity=1, stroke_width=0)


# ================================================================ o treino

class TreinoXOR(Scene):
    """O treino da rede 2-2-1 com a semente da referência, η = 2, 2000 épocas.

    À esquerda, o plano das entradas: em azul claro, onde a rede responde 1,
    isto é, y ≥ 0,5, e a linha escura é a fronteira, y = 0,5. À direita, a perda
    a cada época, em escala logarítmica, desenhada enquanto o treino anda. Em
    cima, a época e a perda. O tempo não anda por igual: o vídeo passa depressa
    pelo começo, em que a perda quase não muda, e devagar pela queda.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        perdas, _, copias = treina(SEMENTE, guardar=range(EPOCAS + 1))
        params = [copias[e] for e in range(EPOCAS + 1)]

        plano = Plano((-5.76, -3.0), 4.4, ("x_1", "x_2"))
        moldura, textos = plano.desenho()

        # ------------------------------------------------ o gráfico da perda, com o eixo vertical em log
        G_CANTO, G_LARG, G_ALT = np.array([1.96, -3.0, 0.0]), 4.4, 4.4  # quadrado, do tamanho do plano; margens iguais nas bordas
        LOG_MIN, LOG_MAX = -3.0, 0.0

        def g(e, L):
            fx = e / EPOCAS
            fy = (np.log10(L) - LOG_MIN) / (LOG_MAX - LOG_MIN)
            return G_CANTO + np.array([fx * G_LARG, fy * G_ALT, 0.0])

        caixa = Rectangle(width=G_LARG, height=G_ALT, color=ESCURO, stroke_width=2.5).move_to(
            G_CANTO + np.array([G_LARG / 2, G_ALT / 2, 0]))
        tracos, nums = VGroup(), VGroup()
        for e, rot in ((0, "0"), (500, "500"), (1000, "1.000"), (1500, "1.500"), (2000, "2.000")):
            b = g(e, 10 ** LOG_MIN)
            tracos.add(Line(b, b + UP * 0.12, color=ESCURO, stroke_width=2.5))
            nums.add(eq(rot, 28, TEXTO).next_to(b, DOWN, buff=0.12))
        for k, rot in ((-3, "0{,}001"), (-2, "0{,}01"), (-1, "0{,}1"), (0, "1")):
            b = g(0, 10.0 ** k)
            tracos.add(Line(b, b + RIGHT * 0.12, color=ESCURO, stroke_width=2.5))
            nums.add(eq(rot, 28, TEXTO).next_to(b, LEFT, buff=0.12))
        nome_x = texto("época", 30).next_to(VGroup(caixa, nums), DOWN, buff=0.12)
        titulo_g = texto("a perda", 30).next_to(caixa, UP, buff=0.25)
        titulo_p = texto("o que a rede responde", 30).next_to(moldura, UP, buff=0.25)
        leg = legenda((bolinha(1, 0.13), "resposta certa 1"), (bolinha(0, 0.13), "resposta certa 0"),
                      (Square(side_length=0.28, color=REGIAO, fill_opacity=1, stroke_width=0), "a rede responde 1"))
        leg.move_to([0, 2.65, 0])

        # ------------------------------------------------ o que anda com a época
        epoca = ValueTracker(0)

        def atual():
            return params[int(round(epoca.get_value()))]

        # a região: a saída da rede numa grade de pixels, pintada de azul claro onde y ≥ 0,5
        N_PIX = 360
        a = np.linspace(*Plano.LIM, N_PIX)
        g1, g2 = np.meshgrid(a, a[::-1])                 # a linha 0 da imagem é a de cima
        grade = np.column_stack([g1.ravel(), g2.ravel()])
        cor_0 = np.array([int(FUNDO[i:i + 2], 16) for i in (1, 3, 5)] + [255], dtype=np.uint8)
        cor_1 = np.array([int(REGIAO[i:i + 2], 16) for i in (1, 3, 5)] + [255], dtype=np.uint8)

        def desenha_regiao():
            y = para_a_frente(atual(), grade)["y"].reshape(N_PIX, N_PIX)
            img = np.where((y >= 0.5)[..., None], cor_1, cor_0)
            m = ImageMobject(img)
            m.stretch_to_fit_width(plano.lado)
            m.stretch_to_fit_height(plano.lado)
            return m.move_to(plano.centro())

        def desenha_fronteira():
            gx, gy = np.meshgrid(a, a)
            y = para_a_frente(atual(), np.column_stack([gx.ravel(), gy.ravel()]))["y"].reshape(N_PIX, N_PIX)
            linhas = contour_generator(x=gx, y=gy, z=y).lines(0.5)
            grupo = VGroup()
            for linha_ in linhas:
                if len(linha_) > 1:
                    grupo.add(VMobject(stroke_color=ESCURO, stroke_width=5).set_points_as_corners(
                        [plano.p(u, v) for u, v in linha_]))
            return grupo

        def desenha_curva():
            ate = int(round(epoca.get_value()))
            if ate < 1:
                return VMobject()
            pts = [g(e, perdas[e]) for e in range(0, ate + 1, 4)] + [g(ate, perdas[ate])]
            return VMobject(stroke_color=AZUL, stroke_width=5).set_points_as_corners(pts)

        regiao, fronteira, curva = (always_redraw(desenha_regiao), always_redraw(desenha_fronteira),
                                    always_redraw(desenha_curva))
        pontos = VGroup(*[bolinha(t).move_to(plano.p(*x)) for x, t in zip(X, T.astype(int))])

        # o contador: a época e a perda, em cima, no meio
        # cada número começa com o maior valor que vai mostrar, para o lugar dele ficar reservado na
        # disposição; depois volta ao valor do começo, com a borda esquerda fixa
        num_epoca = Numero(EPOCAS, num_decimal_places=0, font_size=40, color=ESCURO)
        num_perda = Numero(0.2547, num_decimal_places=4, font_size=40, color=ESCURO)
        contador = VGroup(VGroup(texto("época", 32), num_epoca).arrange(RIGHT, buff=0.25),
                          VGroup(texto("perda", 32), num_perda).arrange(RIGHT, buff=0.25)).arrange(RIGHT, buff=0.9)
        contador.move_to([0, 3.5, 0])
        num_epoca.set_value(0)
        num_perda.set_value(perdas[0])
        num_epoca.add_updater(lambda m: m.set_value(int(round(epoca.get_value()))))
        num_perda.add_updater(lambda m: m.set_value(perdas[int(round(epoca.get_value()))]))

        # ------------------------------------------------ a cena
        self.play(Create(moldura), Write(textos), Create(caixa), Create(tracos), Write(nums), Write(nome_x),
                  run_time=1.6)
        self.play(Write(titulo_p), Write(titulo_g), Write(leg), run_time=1.4)
        self.add(regiao, moldura)
        self.play(FadeIn(regiao), run_time=0.8)
        self.add(fronteira)
        self.play(LaggedStart(*[GrowFromCenter(m) for m in pontos], lag_ratio=0.2), run_time=1.0)
        self.add(curva, pontos)
        self.play(Write(contador), run_time=1.2)
        self.wait(1.0)
        # a época anda: depressa no patamar, devagar na queda, depressa de novo no fim
        for ate, tempo in ((400, 4.0), (1000, 9.0), (EPOCAS, 4.0)):
            self.play(epoca.animate.set_value(ate), run_time=tempo, rate_func=linear)
        self.wait(2.5)


# ================================================================ as frases do alto, nos vídeos novos

def frase(*pedacos, tamanho=30, cor=TEXTO):
    """Uma linha que mistura texto e equação: o pedaço que começa com $ é equação, um pouco maior que o texto."""
    partes = [eq(p.strip("$"), round(tamanho * 1.25), cor) if p.startswith("$") else texto(p, tamanho, cor)
              for p in pedacos]
    return VGroup(*partes).arrange(RIGHT, buff=0.16)


def no_alto(*pedacos):
    """A frase do alto do vídeo, que diz o que está acontecendo; cabe na largura com folga."""
    f = frase(*pedacos).move_to(np.array([0, 3.45, 0]))
    assert f.width < 13, pedacos
    return f


def troca(cena, atual, *pedacos):
    """Apaga a frase do alto e escreve a seguinte."""
    nova = no_alto(*pedacos)
    cena.play(FadeOut(atual), run_time=0.35)
    cena.play(Write(nova), run_time=0.9)
    return nova


def num(v, casas=3):
    """Número em LaTeX, com vírgula decimal e sem o espaço depois dela: −0{,}277. O zero sai 0, sem sinal nem casas."""
    if abs(v) < 0.5 * 10 ** -casas:
        return "0"
    return f"{v:.{casas}f}".replace(".", "{,}")


# ================================================================ a regra da cadeia: as taxas se multiplicam

class Taxas(Scene):
    """z = 3w e L = z², em três retas com a mesma escala: um passo em w vira um passo 3 vezes maior em z, e um passo
    2z vezes maior em L; as razões chegam a 3, 6 e 18 quando o passo encolhe."""

    def construct(self):
        self.camera.background_color = FUNDO
        ESC = 2.0                                   # unidades da tela por unidade de cada reta, a mesma nas três
        x_centro, meia = -1.6, 4.0                  # cada reta tem 8 de largura, centrada no valor do ponto
        retas = {"w": (1.0, 1.75), "z": (3.0, 0.0), "L": (9.0, -1.75)}   # valor do ponto e altura da reta

        def tela(nome, v):
            centro, y = retas[nome]
            return np.array([x_centro + (v - centro) * ESC, y, 0])

        desenho = VGroup()
        for nome, (centro, y) in retas.items():
            desenho.add(Line(np.array([x_centro - meia, y, 0]), np.array([x_centro + meia, y, 0]), color=ESCURO,
                             stroke_width=3))
            for v in range(int(np.ceil(centro - 2)), int(np.floor(centro + 2)) + 1):
                b = tela(nome, v)
                desenho.add(Line(b + DOWN * 0.1, b + UP * 0.1, color=ESCURO, stroke_width=2.5),
                            eq(str(v), 30, TEXTO).next_to(b, DOWN, buff=0.14))
            desenho.add(eq(nome, 44).move_to(np.array([x_centro - meia - 0.55, y, 0])))
        # as regras entre as retas, à esquerda, entre os números de uma reta e a reta de baixo
        regras = VGroup(eq("z = 3w", 34, SUAVE).move_to(np.array([0, 0.85, 0])).align_to(
                            np.array([x_centro - meia, 0, 0]), LEFT),
                        eq("L = z^2", 34, SUAVE).move_to(np.array([0, -0.9, 0])).align_to(
                            np.array([x_centro - meia, 0, 0]), LEFT))
        leg = no_alto("Três números em cadeia:", "$z = 3w$", "e", "$L = z^2$")
        self.play(Write(leg), Create(desenho), run_time=2.0)
        pontos = VGroup(*[Dot(tela(n, c), radius=0.09, color=ESCURO) for n, (c, _) in retas.items()])
        self.play(GrowFromCenter(pontos), Write(regras), run_time=1.0)
        self.wait(0.8)

        x_painel = 3.0

        def passo(dw):
            """Os três segmentos dos passos, em laranja, e as leituras à direita, para um passo dw em w."""
            w, z, L = 1.0, 3.0, 9.0
            dz = 3 * (w + dw) - z
            dL = (3 * (w + dw)) ** 2 - L
            seg = VGroup(*[Line(tela(n, c), tela(n, c + d), color=LARANJA, stroke_width=10)
                           for n, (c, _), d in zip(retas, retas.values(), (dw, dz, dL))])
            ler = VGroup(
                eq(rf"\Delta w = {num(dw, 2)}", 36).move_to(np.array([0, 1.75, 0])),
                VGroup(eq(rf"\Delta z = {num(dz, 2)}", 36),
                       eq(rf"\Delta z / \Delta w = {num(dz / dw, 2)}", 32, SUAVE)).arrange(DOWN, buff=0.12,
                                                                                         aligned_edge=LEFT).move_to(np.array([0, 0.1, 0])),
                VGroup(eq(rf"\Delta L = {num(dL, 4)}", 36),
                       eq(rf"\Delta L / \Delta z = {num(dL / dz, 2)}", 32, SUAVE)).arrange(DOWN, buff=0.12,
                                                                                         aligned_edge=LEFT).move_to(np.array([0, -1.65, 0])),
                eq(rf"\Delta L / \Delta w = {num(dL / dw, 2)}", 44, LARANJA).move_to(np.array([0, -3.05, 0])))
            for item in ler:
                item.align_to(np.array([x_painel, 0, 0]), LEFT)
            return seg, ler

        leg = troca(self, leg, "Um passo de 0,1 em", "$w$", "vira 0,3 em", "$z$", "e 1,89 em", "$L$")
        seg, ler = passo(0.1)
        self.play(Create(seg[0]), Write(ler[0]), run_time=1.0)
        self.play(Create(seg[1]), Write(ler[1]), run_time=1.2)
        self.play(Create(seg[2]), Write(ler[2]), run_time=1.2)
        self.play(Write(ler[3]), run_time=1.0)
        self.wait(1.5)
        leg = troca(self, leg, "As taxas se multiplicam: 3 vezes 6,3 dá 18,9")
        self.wait(1.5)
        leg = troca(self, leg, "Com o passo menor, as taxas chegam a 3, a", "$2z = 6$", "e a 18")
        for dw in (0.03, 0.01):
            novo_seg, novo_ler = passo(dw)
            self.play(Transform(seg, novo_seg), Transform(ler, novo_ler), run_time=1.4)
            self.wait(1.2)
        leg = troca(self, leg, "A regra da cadeia:", "$\\partial L/\\partial w = 2z \\cdot 3 = 18w$")
        self.wait(3)


# ================================================================ a retropropagação, com números

# Os pesos à mão da aula 3, com a sigmoide no lugar do degrau, e o exemplo (0; 1), de resposta certa 1
W_A_MAO = np.array([[1.0, 1.0], [1.0, 1.0]])
B_A_MAO = np.array([-0.5, -1.5])
V_A_MAO = np.array([1.0, -1.0])
C_A_MAO = -0.5
X_EXEMPLO, T_EXEMPLO = np.array([0.0, 1.0]), 1.0


def conta_do_exemplo():
    """A passada para a frente e para trás no exemplo, com L = (y − t)²: os valores e as nove derivadas."""
    s = lambda z: 1 / (1 + np.exp(-z))       # noqa: E731
    z1 = W_A_MAO @ X_EXEMPLO + B_A_MAO
    h = s(z1)
    z = V_A_MAO @ h + C_A_MAO
    y = s(z)
    delta = 2 * (y - T_EXEMPLO) * y * (1 - y)
    delta_h = V_A_MAO * delta * h * (1 - h)
    return {"z1": z1, "h": h, "z": z, "y": y, "L": (y - T_EXEMPLO) ** 2, "delta": delta, "delta_h": delta_h,
            "gv": delta * h, "gc": delta, "gW": np.outer(delta_h, X_EXEMPLO), "gb": delta_h}


class Retro(Scene):
    """A retropropagação na rede do XOR, com números: para a frente, os valores; para trás, os δ e as derivadas."""

    def construct(self):
        self.camera.background_color = FUNDO
        c = conta_do_exemplo()
        pos = {"x1": np.array([-5.6, 1.2, 0]), "x2": np.array([-5.6, -1.4, 0]), "h1": np.array([-1.6, 1.2, 0]),
               "h2": np.array([-1.6, -1.4, 0]), "y": np.array([2.2, -0.1, 0]), "L": np.array([5.4, -0.1, 0])}
        nomes = {"x1": "x_1", "x2": "x_2", "h1": "h_1", "h2": "h_2", "y": "y", "L": "L"}
        R = 0.42
        nos = VGroup(*[VGroup(Circle(radius=R, color=ESCURO, stroke_width=3, fill_color=FUNDO, fill_opacity=1).move_to(p),
                              eq(nomes[k], 36).move_to(p)) for k, p in pos.items()])

        def aresta(a, b):
            d = pos[b] - pos[a]
            u = d / np.linalg.norm(d)
            return Line(pos[a] + u * R, pos[b] - u * R, color=SUAVE, stroke_width=3)

        pares = [("x1", "h1"), ("x2", "h1"), ("x1", "h2"), ("x2", "h2"), ("h1", "y"), ("h2", "y"), ("y", "L")]
        arestas = VGroup(*[aresta(a, b) for a, b in pares])
        # onde fica o número de cada peso. Nas linhas retas, acima ou abaixo delas; nas diagonais, em cima da
        # própria linha, a 28% do caminho a partir da entrada, longe do cruzamento, com o fundo atrás, para não
        # haver dúvida de que linha é cada número
        diagonais = {("x1", "h2"), ("x2", "h1")}
        lugar = {("x1", "h1"): np.array([-3.6, 1.55, 0]), ("x2", "h2"): np.array([-3.6, -1.75, 0]),
                 ("x1", "h2"): pos["x1"] + 0.28 * (pos["h2"] - pos["x1"]),
                 ("x2", "h1"): pos["x2"] + 0.28 * (pos["h1"] - pos["x2"]),
                 ("h1", "y"): np.array([0.45, 0.95, 0]), ("h2", "y"): np.array([0.45, -1.15, 0])}
        valor_peso = {("x1", "h1"): W_A_MAO[0, 0], ("x2", "h1"): W_A_MAO[0, 1], ("x1", "h2"): W_A_MAO[1, 0],
                      ("x2", "h2"): W_A_MAO[1, 1], ("h1", "y"): V_A_MAO[0], ("h2", "y"): V_A_MAO[1]}
        derivada = {("x1", "h1"): c["gW"][0, 0], ("x2", "h1"): c["gW"][0, 1], ("x1", "h2"): c["gW"][1, 0],
                    ("x2", "h2"): c["gW"][1, 1], ("h1", "y"): c["gv"][0], ("h2", "y"): c["gv"][1]}

        def rotulo(k, tex, cor):
            """O número de um peso no lugar dele; nas diagonais, com um retângulo da cor do fundo atrás."""
            r = eq(tex, 32, cor).move_to(lugar[k])
            if k not in diagonais:
                return r
            fundo = Rectangle(width=r.width + 0.16, height=r.height + 0.12, stroke_width=0, fill_color=FUNDO,
                              fill_opacity=1).move_to(r)
            return VGroup(fundo, r)

        pesos = {k: rotulo(k, f"{v:g}".replace(".", "{,}"), ESCURO) for k, v in valor_peso.items()}

        leg = no_alto("A rede da aula 3 com a sigmoide, na entrada (0; 1), de resposta 1")
        self.play(Write(leg), Create(arestas), FadeIn(nos), run_time=2.0)
        self.play(*[Write(m) for m in pesos.values()], run_time=1.2)
        vieses = eq(r"b_1 = -0{,}5 \quad b_2 = -1{,}5 \quad c = -0{,}5", 32, SUAVE).move_to(np.array([0, -3.35, 0]))
        self.play(Write(vieses), run_time=1.0)
        self.wait(1.0)

        # para a frente: as entradas, as somas e as saídas, em azul
        leg = troca(self, leg, "Para a frente: cada soma e cada saída ficam guardadas")
        entradas = VGroup(eq("0", 36, AZUL).next_to(nos[0], LEFT, buff=0.25), eq("1", 36, AZUL).next_to(nos[1], LEFT, buff=0.25))
        ida = {"h1": eq(rf"z = {num(c['z1'][0], 1)},\ h = {num(c['h'][0])}", 32, AZUL).move_to(np.array([-1.6, 1.95, 0])),
               "h2": eq(rf"z = {num(c['z1'][1], 1)},\ h = {num(c['h'][1])}", 32, AZUL).move_to(np.array([-1.6, -2.15, 0])),
               "y": eq(rf"z = {num(c['z'])},\ y = {num(c['y'])}", 32, AZUL).move_to(np.array([3.0, 1.0, 0])),
               "L": eq(rf"L = {num(c['L'])}", 32, AZUL).move_to(np.array([5.4, 0.75, 0]))}
        alvo = eq("t = 1", 32, SUAVE).move_to(np.array([5.4, -0.95, 0]))
        self.play(Write(entradas), run_time=0.8)
        self.play(Write(ida["h1"]), Write(ida["h2"]), run_time=1.2)
        self.play(Write(ida["y"]), run_time=1.0)
        self.play(Write(ida["L"]), Write(alvo), run_time=1.0)
        self.wait(1.2)

        def linha_de_baixo(atual, tex):
            nova = eq(tex, 34).move_to(np.array([0, -3.35, 0]))
            self.play(FadeOut(atual), run_time=0.3)
            self.play(Write(nova), run_time=1.2)
            return nova

        # para trás: o δ da saída
        leg = troca(self, leg, "Para trás: o δ da saída é a derivada da perda pela soma dele")
        baixo = linha_de_baixo(vieses, rf"\delta = 2\,(y - t)\,\sigma'(z) = 2\,({num(c['y'])} - 1) \cdot "
                                       rf"{num(c['y'] * (1 - c['y']))} = {num(c['delta'])}")
        d_y = eq(rf"\delta = {num(c['delta'])}", 32, LARANJA).move_to(np.array([2.2, -0.95, 0]))
        self.play(Write(d_y), run_time=0.9)
        self.wait(1.0)

        # os pesos da saída: δ vezes a entrada de cada um
        leg = troca(self, leg, "Cada peso da saída: o δ vezes a entrada que ele multiplica")
        baixo = linha_de_baixo(baixo, rf"\partial L/\partial v_1 = \delta\, h_1 = {num(c['delta'])} \cdot "
                                      rf"{num(c['h'][0])} = {num(c['gv'][0])}")
        for k in (("h1", "y"), ("h2", "y")):
            novo = rotulo(k, num(derivada[k]), LARANJA)
            self.play(FadeOut(pesos[k]), Write(novo), run_time=0.8)
            pesos[k] = novo
        self.wait(1.0)

        # o δ volta até a camada oculta
        leg = troca(self, leg, "O δ volta pelo peso até cada neurônio oculto")
        baixo = linha_de_baixo(baixo, rf"\delta_1 = v_1\,\delta\,\sigma'(z_1) = 1 \cdot ({num(c['delta'])}) \cdot "
                                      rf"{num(c['h'][0] * (1 - c['h'][0]))} = {num(c['delta_h'][0])}")
        d_h = VGroup(eq(rf"\delta_1 = {num(c['delta_h'][0])}", 32, LARANJA).move_to(np.array([-1.6, 2.5, 0])),
                     eq(rf"\delta_2 = {num(c['delta_h'][1])}", 32, LARANJA).move_to(np.array([-1.6, -2.7, 0])))
        self.play(Write(d_h), run_time=1.2)
        self.wait(1.0)

        # os pesos da primeira camada: δ vezes x
        leg = troca(self, leg, "Na primeira camada, δ vezes x: com", "$x_1 = 0,$", "derivada zero")
        baixo = linha_de_baixo(baixo, rf"\partial L/\partial w_{{12}} = \delta_1\, x_2 = {num(c['delta_h'][0])} "
                                      rf"\cdot 1 = {num(c['gW'][0, 1])}")
        for k in (("x1", "h1"), ("x2", "h1"), ("x1", "h2"), ("x2", "h2")):
            novo = rotulo(k, num(derivada[k]), LARANJA)
            self.play(FadeOut(pesos[k]), Write(novo), run_time=0.6)
            pesos[k] = novo
        self.wait(0.8)
        leg = troca(self, leg, "As nove derivadas, numa passada para trás")
        self.wait(3)


# ================================================================ a gravação

CENAS = {"taxas": Taxas, "retro": Retro, "treino-xor": TreinoXOR}


def grava(nome, largura=1920, altura=1080, quadros=30, pasta_videos=None, pasta_quadros=None, crf=24,
          so_ultimo_quadro=False):
    """Desenha a cena e grava o mp4 e o png do último quadro.

    O padrão é 1920 por 1080, a 30 quadros por segundo, nas pastas videos/ e
    figuras/ da aula. O manim trabalha numa pasta temporária, uma por
    vídeo, apagada no fim. O mp4 sai de novo pelo ffmpeg, em H.264 com
    qualidade constante (crf 24), para ficar abaixo dos 20 MB que o deck aceita
    por vídeo. Com so_ultimo_quadro, o manim pula as animações e grava só o
    último quadro, em segundos: serve para conferir a disposição e para o PDF.
    Devolve o tempo gasto, em segundos.
    """
    inicio = time.perf_counter()
    pasta_videos = Path(pasta_videos or AULA / "videos")
    pasta_quadros = Path(pasta_quadros or AULA / "figuras")
    pasta_videos.mkdir(parents=True, exist_ok=True)
    pasta_quadros.mkdir(parents=True, exist_ok=True)
    trabalho = pasta_videos / f"_manim-{nome}"
    opcoes = {"pixel_width": largura, "pixel_height": altura, "frame_rate": quadros, "media_dir": str(trabalho),
              "output_file": nome, "background_color": FUNDO, "disable_caching": True, "progress_bar": "none",
              "verbosity": "WARNING", "tex_template": MODELO}
    if so_ultimo_quadro:
        opcoes.update(save_last_frame=True, write_to_movie=False)
    with tempconfig(opcoes):
        cena = CENAS[nome]()
        cena.render()
        if so_ultimo_quadro:
            png_manim = Path(cena.renderer.file_writer.image_file_path)
        else:
            mp4 = Path(cena.renderer.file_writer.movie_file_path)
    png = pasta_quadros / f"{nome}-quadro.png"   # -quadro: não pisar nas figuras estáticas
    if so_ultimo_quadro:
        shutil.copyfile(png_manim, png)
        arquivos = [png]
    else:
        destino = pasta_videos / f"{nome}.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4), "-c:v", "libx264", "-crf", str(crf),
                        "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(destino)],
                       check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-sseof", "-0.5", "-i", str(destino),
                        "-frames:v", "1", "-update", "1", str(png)], check=True)
        arquivos = [destino, png]
    shutil.rmtree(trabalho, ignore_errors=True)
    segundos = time.perf_counter() - inicio
    for arquivo in arquivos:
        print(f"gravado: {arquivo} ({arquivo.stat().st_size / 1e6:.1f} MB)")
    print(f"{nome}: {segundos:.0f} s")
    return segundos


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")      # os nomes com acento passam também quando a saída vai para arquivo
    args = sys.argv[1:]
    if "--previa" in args:
        i = args.index("--previa")
        pasta = Path(args[i + 1])
        nomes = [a for a in args[:i] + args[i + 2:]] or list(CENAS)
        for nome in nomes:
            grava(nome, 854, 480, 15, pasta_videos=pasta, pasta_quadros=pasta)
    elif "--quadros" in args:
        for nome in [a for a in args if a != "--quadros"] or list(CENAS):
            grava(nome, so_ultimo_quadro=True)
    else:
        for nome in args or list(CENAS):
            grava(nome)
