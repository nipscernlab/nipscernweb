"""Os vídeos da aula 4, feitos com o Manim Community.

Rode, a partir da raiz do repositório, com o nome dos vídeos que quer gravar, ou
sem nome nenhum para gravar todos:
    python aulas/04-jacobiano/codigo/animacoes.py
    python aulas/04-jacobiano/codigo/animacoes.py custo

Os três vídeos, na ordem da aula:
    jacobiano-coluna   mexe só uma entrada, para cima e para baixo, com Δ de 0,5 a 0,001: a variação das
                       saídas dividida por 2Δ converge para uma coluna de J
    jacobiano-local    a camada curva a grade do plano; perto de um ponto, ela age como a matriz J
    custo              o produto g J₃ J₂ J₁ nas duas ordens, com 4 neurônios por camada: 48 contas contra 144

Duas opções servem para conferir antes da gravação final, que é a mais demorada:
    --previa <pasta>   grava em 854 por 480, a 15 quadros por segundo, na pasta dada
    --quadros          grava só o último quadro, em 1920 por 1080, sem o mp4

Precisa do Manim Community (pip install manim), do MiKTeX, o mesmo das equações
dos slides, e do ffmpeg. Cada vídeo sai em dois arquivos:
    aulas/04-jacobiano/videos/<nome>.mp4            1920 por 1080, 30 quadros por segundo
    aulas/04-jacobiano/figuras/<nome>-quadro.png    o último quadro, que o slide mostra parado

As regras são as dos vídeos das aulas 2 e 3. O vídeo ocupa uns 60% da largura do
slide, embaixo do título, e não tem título próprio; texto corrido com pelo menos
30 pontos do Manim, equação com pelo menos 32. Todo texto e todo número entra
escrito; as formas entram desenhadas. Nada se sobrepõe: cada texto tem um lugar
fixo, fora dos dados. E nada é sorteado: a camada e o ponto são os de jacobiano.py.
"""
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from manim import (DOWN, LEFT, RIGHT, UP, Arrow, Create, DashedVMobject, Dot, FadeIn, FadeOut, GrowArrow,
                   GrowFromCenter, Indicate, Line, MathTex, MovingCameraScene, Polygon, Rectangle, Scene, Square,
                   TexTemplate, Text, Transform, VGroup, VMobject, Write, config, tempconfig)
from manimpango import register_font

RAIZ = Path(__file__).resolve().parents[3]
AULA = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from jacobiano import B1, W1, X0, camada, jacobiano_a_mao  # noqa: E402

# As fontes do curso, as mesmas dos slides, guardadas em infra/fontes/ com as licenças
for arquivo in ("IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf", "SourceSerif4-Semibold.ttf"):
    register_font(str(RAIZ / "infra" / "fontes" / arquivo))
SANS = "IBM Plex Sans"

# A paleta de infra/slides.py e das figuras
FUNDO, ESCURO, TEXTO, SUAVE = "#F6F5F1", "#14213D", "#3B4658", "#5E6A7D"
AZUL, LARANJA, GRADE = "#1F5FAD", "#A8500F", "#9FB3CF"

# As equações em STIX Two, a fonte das equações dos slides (infra/equacoes.py)
MODELO = TexTemplate(preamble="\\usepackage[T1]{fontenc}\n\\usepackage{amsmath}\n\\usepackage{stix2}\n")
config.tex_template = MODELO


def texto(s, tamanho=30, cor=TEXTO):
    """Texto corrido, na fonte dos slides."""
    return Text(s, font=SANS, font_size=tamanho, color=cor)


def eq(tex, tamanho=36, cor=ESCURO):
    """Equação em LaTeX, na STIX Two."""
    return MathTex(tex, font_size=tamanho, color=cor, tex_template=MODELO)


def br(v, casas=2):
    """Número decimal em LaTeX, com vírgula decimal e sem o espaço que o LaTeX põe depois dela."""
    return f"{v:.{casas}f}".replace(".", "{,}")


class Plano:
    """Um quadrado do plano com os limites pedidos nos dois eixos, marcas e nomes por fora.

    canto: o canto de baixo à esquerda, na tela; lado: o tamanho do quadrado, na
    tela; xlim e ylim: os limites do plano; marcas: os valores marcados em cada
    eixo; nomes: o LaTeX dos dois eixos.
    """

    def __init__(self, canto, lado, xlim, ylim, marcas_x, marcas_y, nomes):
        self.canto, self.lado = np.array([*canto, 0.0]), lado
        self.xlim, self.ylim, self.marcas_x, self.marcas_y, self.nomes = xlim, ylim, marcas_x, marcas_y, nomes

    def p(self, a, c):
        """Leva o ponto (a, c) do plano para a tela."""
        fx = (a - self.xlim[0]) / (self.xlim[1] - self.xlim[0])
        fy = (c - self.ylim[0]) / (self.ylim[1] - self.ylim[0])
        return self.canto + np.array([fx * self.lado, fy * self.lado, 0.0])

    def desenho(self):
        """A moldura, as marcas, os números e os nomes dos eixos; devolve (moldura, textos)."""
        caixa = Rectangle(width=self.lado, height=self.lado, color=ESCURO, stroke_width=2.5)
        caixa.move_to(self.canto + np.array([self.lado / 2, self.lado / 2, 0]))
        tracos, num_x, num_y = VGroup(), VGroup(), VGroup()
        for v in self.marcas_x:
            b = self.p(v, self.ylim[0])
            tracos.add(Line(b, b + UP * 0.12, color=ESCURO, stroke_width=2.5))
            num_x.add(eq(br(v, 0) if float(v).is_integer() else br(v, 1), 28, TEXTO).next_to(b, DOWN, buff=0.12))
        for v in self.marcas_y:
            b = self.p(self.xlim[0], v)
            tracos.add(Line(b, b + RIGHT * 0.12, color=ESCURO, stroke_width=2.5))
            num_y.add(eq(br(v, 0) if float(v).is_integer() else br(v, 1), 28, TEXTO).next_to(b, LEFT, buff=0.12))
        nome_x = eq(self.nomes[0], 36).next_to(VGroup(caixa, num_x), DOWN, buff=0.1)
        nome_y = eq(self.nomes[1], 36).next_to(VGroup(caixa, num_y), LEFT, buff=0.16)
        return VGroup(caixa, tracos), VGroup(num_x, num_y, nome_x, nome_y)


def curva(pontos):
    """Uma linha suave pelos pontos, já na tela."""
    return VMobject(stroke_color=GRADE, stroke_width=2.5).set_points_smoothly(pontos)


class JacobianoLocal(MovingCameraScene):
    """A camada h⃗ = tanh(W x⃗ + b⃗) leva a grade do plano das entradas a uma grade curva.

    À esquerda, o plano das entradas, (x₁, x₂), com uma grade de passo 0,25; à
    direita, o plano das saídas, (h₁, h₂), com a grade levada pela camada. O
    ponto x⃗₀ = (1; 0,25) e um quadradinho de lado 0,25 em volta dele, em
    laranja, vão para o ponto h⃗(x⃗₀) e para uma figura curva. O paralelogramo
    tracejado, em azul, é o quadradinho levado pela matriz J, o Jacobiano no
    ponto: os lados dele são as colunas de J vezes 0,25. A câmera chega perto, e
    a figura curva e o paralelogramo quase coincidem: perto do ponto, a camada
    age como a matriz J.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        esq = Plano((-5.75, -3.05), 4.0, (0, 2), (-0.75, 1.25), (0, 1, 2), (-0.5, 0, 0.5, 1), ("x_1", "x_2"))
        dir_ = Plano((2.35, -3.05), 4.0, (-1, 1), (-1, 1), (-1, 0, 1), (-1, 0, 1), ("h_1", "h_2"))

        def f(a, c):
            return camada(np.array([a, c]), W1, B1)

        J = jacobiano_a_mao(X0, W1, B1)
        h0 = f(*X0)

        # ------------------------------------------------ as equações e a legenda, em cima, fora dos planos
        eq_camada = eq(r"\vec{h} = \tanh(W\vec{x} + \vec{b}),\quad W = \begin{pmatrix} 1 & -1\\ 0{,}5 & 2 "
                       r"\end{pmatrix},\quad \vec{b} = \begin{pmatrix} 0\\ -1 \end{pmatrix}", 32)
        eq_camada.move_to([0, 2.25, 0]).to_edge(LEFT, buff=0.45)
        eq_j = eq(rf"J = \begin{{pmatrix}} {br(J[0, 0])} & {br(J[0, 1])}\\ {br(J[1, 0])} & {br(J[1, 1])} "
                  r"\end{pmatrix}", 32)
        eq_j.move_to([0, 2.25, 0]).to_edge(RIGHT, buff=0.45)
        amostra_q = Square(side_length=0.3, color=LARANJA, fill_color=LARANJA, fill_opacity=0.25, stroke_width=4)
        amostra_p = DashedVMobject(Square(side_length=0.3, color=AZUL, stroke_width=4), num_dashes=8)
        legenda = VGroup(VGroup(amostra_q, texto("o quadradinho e a imagem dele", 28)).arrange(RIGHT, buff=0.16),
                         VGroup(amostra_p, texto("o quadradinho levado por J", 28)).arrange(RIGHT, buff=0.16)
                         ).arrange(RIGHT, buff=0.7).move_to([0, 3.55, 0])

        # ------------------------------------------------ os planos, a grade e a seta da camada
        molduras, textos = zip(esq.desenho(), dir_.desenho())
        self.play(*[Create(m) for m in molduras], *[Write(t_) for t_ in textos], run_time=1.5)
        self.play(Write(eq_camada), run_time=1.8)
        valores_x = np.arange(0, 2.0001, 0.25)
        valores_y = np.arange(-0.75, 1.2501, 0.25)
        amostras = np.linspace(0, 1, 60)
        grade_esq, grade_dir = VGroup(), VGroup()
        for a in valores_x:                      # linhas verticais, x₁ fixo
            ys = esq.ylim[0] + amostras * (esq.ylim[1] - esq.ylim[0])
            grade_esq.add(curva([esq.p(a, c) for c in ys]))
            grade_dir.add(curva([dir_.p(*f(a, c)) for c in ys]))
        for c in valores_y:                      # linhas horizontais, x₂ fixo
            xs = esq.xlim[0] + amostras * (esq.xlim[1] - esq.xlim[0])
            grade_esq.add(curva([esq.p(a, c) for a in xs]))
            grade_dir.add(curva([dir_.p(*f(a, c)) for a in xs]))
        for g in (grade_esq, grade_dir):
            g.set_z_index(0)
        self.play(Create(grade_esq, lag_ratio=0.05), run_time=1.6)
        seta = Arrow([-1.4, -1.05, 0], [1.15, -1.05, 0], buff=0, color=SUAVE, stroke_width=6,
                     max_tip_length_to_length_ratio=0.15)
        nome_seta = texto("a camada", 30, SUAVE).next_to(seta, UP, buff=0.18)
        self.play(GrowArrow(seta), Write(nome_seta), run_time=1.0)
        # a grade da direita se desenha no próprio lugar: viajando da esquerda, ela passaria por cima
        # do nome da seta e do nome do eixo h₂
        self.play(Create(grade_dir, lag_ratio=0.05), run_time=2.6)
        self.wait(0.6)

        # ------------------------------------------------ o ponto, o quadradinho e as imagens deles
        lado = 0.25
        cantos = [X0 + lado / 2 * np.array(s) for s in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        quadradinho = Polygon(*[esq.p(*c) for c in cantos], color=LARANJA, fill_color=LARANJA, fill_opacity=0.25,
                              stroke_width=4).set_z_index(2)
        borda = []                               # a borda do quadradinho, bem amostrada, para a imagem curva
        for i in range(4):
            a, b = cantos[i], cantos[(i + 1) % 4]
            borda += [a + s * (b - a) for s in np.linspace(0, 1, 30, endpoint=False)]
        imagem = Polygon(*[dir_.p(*f(*q)) for q in borda], color=LARANJA, fill_color=LARANJA, fill_opacity=0.25,
                         stroke_width=4).set_z_index(2)
        ponto_x = Dot(esq.p(*X0), radius=0.07, color=LARANJA).set_z_index(3)
        ponto_h = Dot(dir_.p(*h0), radius=0.07, color=LARANJA).set_z_index(3)
        self.play(GrowFromCenter(ponto_x), FadeIn(quadradinho), run_time=1.0)
        self.play(FadeIn(imagem), GrowFromCenter(ponto_h), run_time=1.6)
        self.wait(0.4)

        # ------------------------------------------------ o paralelogramo de J e a matriz
        paralelogramo = DashedVMobject(
            Polygon(*[dir_.p(*(h0 + J @ (c - X0))) for c in cantos], color=AZUL, stroke_width=4),
            num_dashes=40).set_z_index(4)
        self.play(Write(legenda), run_time=1.4)
        self.play(Create(paralelogramo), Write(eq_j), run_time=1.8)
        self.wait(1.0)

        # ------------------------------------------------ de perto
        quadro = self.camera.frame
        self.play(quadro.animate.scale(0.22).move_to(dir_.p(*h0)), run_time=2.2)
        self.wait(2.0)
        self.play(quadro.animate.scale(1 / 0.22).move_to([0, 0, 0]), run_time=2.0)
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


# ================================================================ o Jacobiano, coluna a coluna

PASSOS = (0.5, 0.25, 0.05, 0.001)       # os Δ da diferença central, do grande ao pequeno


def coluna_numerica(j, delta):
    """A coluna j do Jacobiano pela diferença central: (h(x + Δ eⱼ) − h(x − Δ eⱼ)) / 2Δ, no ponto X0."""
    e = np.zeros(2)
    e[j] = delta
    return (camada(X0 + e, W1, B1) - camada(X0 - e, W1, B1)) / (2 * delta)


class JacobianoColuna(Scene):
    """Mexe só uma entrada, para cima e para baixo, e mede o que acontece com as duas saídas: é uma coluna de J.

    À esquerda, o plano das entradas, com o ponto x⃗₀ = (1; 0,25) e os dois pontos
    x⃗₀ ± Δ numa direção só; à direita, o plano das saídas, com as imagens deles e
    a seta da coluna, desenhada a partir de h⃗(x⃗₀). Com Δ de 0,5 a 0,001, a coluna
    converge para a do Jacobiano à mão. Primeiro a coluna 1, em azul, depois a 2,
    em laranja; no fim, as duas lado a lado formam J.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        esq = Plano((-5.85, -2.45), 3.0, (0, 2), (-0.75, 1.25), (0, 1, 2), (-0.5, 0, 0.5, 1), ("x_1", "x_2"))
        dir_ = Plano((-1.65, -2.45), 3.0, (-1, 2.25), (-1, 2.25), (0, 1, 2), (0, 1, 2), ("h_1", "h_2"))
        h0 = camada(X0, W1, B1)
        J = jacobiano_a_mao(X0, W1, B1)
        x_painel = 2.0

        eq_camada = eq(r"\vec{h} = \tanh(W\vec{x} + \vec{b})", 36).move_to(np.array([-2.65, 1.45, 0]))
        leg = no_alto("A coluna 1 de", "$J:$", "só a entrada", "$x_1$", "se mexe, para cima e para baixo")
        molduras, textos = zip(esq.desenho(), dir_.desenho())
        ponto_x = Dot(esq.p(*X0), radius=0.08, color=ESCURO)
        ponto_h = Dot(dir_.p(*h0), radius=0.08, color=ESCURO)
        self.play(Write(leg), *[Create(m) for m in molduras], *[Write(t_) for t_ in textos], Write(eq_camada),
                  run_time=1.8)
        self.play(GrowFromCenter(ponto_x), GrowFromCenter(ponto_h), run_time=0.8)

        def coluna_cena(j, cor, y_leitura):
            """Os passos de Δ para a coluna j: os dois pontos, as imagens, a seta e os números."""
            mais = r"x_1 + \Delta,\ x_2" if j == 0 else r"x_1,\ x_2 + \Delta"
            menos = r"x_1 - \Delta,\ x_2" if j == 0 else r"x_1,\ x_2 - \Delta"
            formula = eq(r"\frac{\vec{h}(" + mais + r") - \vec{h}(" + menos + r")}{2\Delta}", 34)
            formula.move_to(np.array([0, 2.0, 0])).align_to(np.array([x_painel, 0, 0]), LEFT)

            def desenho(delta):
                e = np.zeros(2)
                e[j] = delta
                a, b = X0 - e, X0 + e
                ha, hb = camada(a, W1, B1), camada(b, W1, B1)
                c = coluna_numerica(j, delta)
                return VGroup(Line(esq.p(*a), esq.p(*b), color=cor, stroke_width=4),
                              Dot(esq.p(*a), radius=0.06, color=cor), Dot(esq.p(*b), radius=0.06, color=cor),
                              Line(dir_.p(*ha), dir_.p(*hb), color=cor, stroke_width=4),
                              Dot(dir_.p(*ha), radius=0.06, color=cor), Dot(dir_.p(*hb), radius=0.06, color=cor),
                              Arrow(dir_.p(*h0), dir_.p(*(h0 + c)), buff=0, color=cor, stroke_width=6,
                                    max_tip_length_to_length_ratio=0.18))

            def leitura(delta):
                c = coluna_numerica(j, delta)
                d = f"{delta:g}".replace(".", "{,}")
                return VGroup(eq(rf"\Delta = {d}", 36),
                              eq(rf"\text{{coluna {j + 1}}} \approx ({br(c[0], 4)};\ {br(c[1], 4)})", 36, cor)
                              ).arrange(DOWN, buff=0.18, aligned_edge=LEFT).move_to(np.array([0, y_leitura, 0])).align_to(
                    np.array([x_painel, 0, 0]), LEFT)

            self.play(Write(formula), run_time=1.2)
            atual, num = desenho(PASSOS[0]), leitura(PASSOS[0])
            self.play(Create(atual), Write(num), run_time=1.6)
            self.wait(1.2)
            for delta in PASSOS[1:]:
                self.play(Transform(atual, desenho(delta)), Transform(num, leitura(delta)), run_time=1.4)
                self.wait(0.9)
            self.play(FadeOut(formula), FadeOut(num[0]), run_time=0.5)
            return atual, num[1]

        seta1, col1 = coluna_cena(0, AZUL, 0.55)
        leg = troca(self, leg, "A coluna 2: só", "$x_2$", "se mexe, e a seta cresce até 2")
        self.play(FadeOut(seta1[:6]), run_time=0.4)
        seta2, col2 = coluna_cena(1, LARANJA, -0.75)

        # as duas colunas lado a lado: o Jacobiano
        leg = troca(self, leg, "As duas colunas, lado a lado, são o Jacobiano")
        self.play(FadeOut(seta2[:6]), run_time=0.4)
        matriz_j = eq(rf"J = \begin{{pmatrix}} {br(J[0, 0], 4)} & {br(J[0, 1], 4)}\\ {br(J[1, 0], 4)} & "
                      rf"{br(J[1, 1], 4)} \end{{pmatrix}}", 40).move_to(np.array([0, -2.2, 0])).align_to(
            np.array([x_painel, 0, 0]), LEFT)
        rotulo = texto("a conta à mão dá o mesmo", 28, SUAVE).next_to(matriz_j, DOWN, buff=0.2).align_to(
            matriz_j, LEFT)
        self.play(Write(matriz_j), run_time=1.4)
        self.play(Write(rotulo), run_time=1.0)
        self.wait(3)


# ================================================================ o custo das duas ordens

M_CUSTO = 4                               # neurônios por camada no desenho


class Custo(Scene):
    """O produto g J₃ J₂ J₁ nas duas ordens, com 4 neurônios por camada: 48 multiplicações contra 144."""

    def construct(self):
        self.camera.background_color = FUNDO
        lado = 0.3

        def bloco(linhas, colunas, cor, centro):
            """Uma matriz desenhada como uma tabela de quadradinhos, um por número."""
            g = VGroup(*[Square(side_length=lado, stroke_color=cor, stroke_width=2, fill_color=cor, fill_opacity=0.18)
                         for _ in range(linhas * colunas)])
            g.arrange_in_grid(rows=linhas, cols=colunas, buff=0)
            return g.move_to(centro)

        def nome(tex, alvo):
            return eq(tex, 34).next_to(alvo, DOWN, buff=0.2)

        xs = (-5.4, -3.2, -1.0, 1.2)
        trilhas = {"tras": 1.25, "frente": -1.75}
        leg = no_alto("O gradiente é", "$g\\,J_3\\,J_2\\,J_1:$", "a mesma conta, em duas ordens")
        self.play(Write(leg), run_time=1.2)
        titulos = VGroup(texto("de trás para a frente", 30, LARANJA).move_to(np.array([-2.1, 2.45, 0])),
                         texto("da frente para trás", 30, AZUL).move_to(np.array([-2.1, -0.55, 0])))
        pecas = {}
        for chave, y in trilhas.items():
            linha_g = bloco(1, M_CUSTO, LARANJA, np.array([xs[0], y, 0]))
            mats = [bloco(M_CUSTO, M_CUSTO, AZUL, np.array([x, y, 0])) for x in xs[1:]]
            nomes = VGroup(nome("g", linha_g), *[nome(f"J_{k}", m) for k, m in zip((3, 2, 1), mats)])
            pecas[chave] = (linha_g, mats, nomes)
        self.play(Write(titulos), *[Create(VGroup(p[0], *p[1])) for p in pecas.values()],
                  *[Write(p[2]) for p in pecas.values()], run_time=2.0)
        self.wait(0.8)

        def placar(valor, y, cor):
            return VGroup(eq(rf"{valor}", 56, cor), texto("multiplicações", 28, SUAVE)).arrange(
                DOWN, buff=0.1).move_to(np.array([4.9, y, 0]))

        # de trás para a frente: a linha engole uma matriz de cada vez
        leg = troca(self, leg, "De trás para a frente: linha vezes matriz,", "$4 \\cdot 4 = 16$", "contas")
        linha_g, mats, nomes = pecas["tras"]
        conta = 0
        ponto = placar(0, trilhas["tras"], LARANJA)
        self.play(Write(ponto), run_time=0.6)
        atual = linha_g
        for k, m in enumerate(mats):
            conta += M_CUSTO * M_CUSTO
            nova = bloco(1, M_CUSTO, LARANJA, m.get_center())
            self.play(Indicate(atual, color=LARANJA), Indicate(m, color=LARANJA), run_time=0.8)
            self.play(FadeOut(atual), FadeOut(nomes[k]), Transform(m, nova),
                      Transform(ponto, placar(conta, trilhas["tras"], LARANJA)), run_time=1.0)
            atual = m
        self.play(FadeOut(nomes[3]), Write(texto("o gradiente", 28, LARANJA).next_to(atual, DOWN, buff=0.2)),
                  run_time=0.8)
        self.wait(0.8)

        # da frente para trás: matriz vezes matriz, até a linha entrar no fim
        leg = troca(self, leg, "Da frente para trás: matriz vezes matriz,", "$4 \\cdot 4 \\cdot 4 = 64$", "contas")
        linha_g, mats, nomes = pecas["frente"]
        conta = 0
        ponto = placar(0, trilhas["frente"], AZUL)
        self.play(Write(ponto), run_time=0.6)
        # nomes: g, J3, J2, J1; a matriz da direita engole a vizinha da esquerda, e o resultado fica no lugar dela
        direita, nome_dir = mats[2], nomes[3]
        for esquerda, nome_esq in ((mats[1], nomes[2]), (mats[0], nomes[1])):
            conta += M_CUSTO ** 3
            nova = bloco(M_CUSTO, M_CUSTO, AZUL, esquerda.get_center())
            self.play(Indicate(esquerda, color=AZUL), Indicate(direita, color=AZUL), run_time=0.8)
            self.play(FadeOut(direita), FadeOut(nome_dir), Transform(esquerda, nova),
                      Transform(ponto, placar(conta, trilhas["frente"], AZUL)), run_time=1.0)
            direita, nome_dir = esquerda, nome_esq
        conta += M_CUSTO * M_CUSTO
        nova = bloco(1, M_CUSTO, LARANJA, linha_g.get_center())
        self.play(Indicate(linha_g, color=AZUL), Indicate(direita, color=AZUL), run_time=0.8)
        self.play(FadeOut(direita), FadeOut(nome_dir), Transform(linha_g, nova),
                  Transform(ponto, placar(conta, trilhas["frente"], AZUL)), run_time=1.0)
        self.play(FadeOut(nomes[0]), Write(texto("o gradiente", 28, LARANJA).next_to(linha_g, DOWN, buff=0.2)),
                  run_time=0.8)
        self.wait(0.8)
        leg = troca(self, leg, "Com 100 neurônios por camada: 30 mil contas contra 2 milhões")
        self.wait(3)


# ================================================================ a gravação

CENAS = {"jacobiano-local": JacobianoLocal, "jacobiano-coluna": JacobianoColuna, "custo": Custo}


def grava(nome, largura=1920, altura=1080, quadros=30, pasta_videos=None, pasta_quadros=None, crf=24,
          so_ultimo_quadro=False):
    """Desenha a cena e grava o mp4 e o png do último quadro.

    O padrão é 1920 por 1080, a 30 quadros por segundo, nas pastas videos/ e
    figuras/ da aula. O manim trabalha numa pasta temporária, apagada no fim. O
    mp4 sai de novo pelo ffmpeg, em H.264 com qualidade constante (crf 24), para
    ficar abaixo dos 20 MB que o deck aceita por vídeo. Com so_ultimo_quadro, o
    manim pula as animações e grava só o último quadro, em segundos. Devolve o
    tempo gasto, em segundos.
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
        for nome in [a for a in args[:i] + args[i + 2:]] or list(CENAS):
            grava(nome, 854, 480, 15, pasta_videos=pasta, pasta_quadros=pasta)
    elif "--quadros" in args:
        for nome in [a for a in args if a != "--quadros"] or list(CENAS):
            grava(nome, so_ultimo_quadro=True)
    else:
        for nome in args or list(CENAS):
            grava(nome)
