"""Os vídeos da aula 3, feitos com o Manim Community.

Rode, a partir da raiz do repositório, com o nome dos vídeos que quer gravar, ou
sem nome nenhum para gravar todos:
    python aulas/03-camadas/codigo/animacoes.py
    python aulas/03-camadas/codigo/animacoes.py produto grade

Os quatro vídeos, na ordem da aula:
    produto         W x⃗ + b⃗ com números: cada linha de W faz o produto escalar com x⃗, soma o viés,
                    e o degrau vale para cada posição
    camada-oculta   a camada oculta leva os quatro pontos do XOR a um plano novo, onde uma reta os separa
    grade           uma matriz leva a grade do plano a outra grade de retas; duas matrizes seguidas valem
                    a do produto; a sigmoide em cada coordenada entorta as retas
    sigmoide        o degrau e a sigmoide; σ(k z) vira degrau quando k cresce; a inclinação, ponto a ponto

Duas opções servem para conferir antes da gravação final, que é a mais demorada:
    --previa <pasta>   grava em 854 por 480, a 15 quadros por segundo, na pasta dada
    --quadros          grava só o último quadro, em 1920 por 1080, sem o mp4

Precisa do Manim Community (pip install manim), do MiKTeX, o mesmo das equações
dos slides, e do ffmpeg. Cada vídeo sai em dois arquivos:
    aulas/03-camadas/videos/<nome>.mp4            1920 por 1080, 30 quadros por segundo
    aulas/03-camadas/figuras/<nome>-quadro.png    o último quadro, que o slide mostra parado

As regras são as dos vídeos da aula 2. O vídeo ocupa uns 60% da largura do
slide, embaixo do título, e não tem título próprio; texto corrido com pelo menos
30 pontos do Manim, equação com pelo menos 36. Todo texto e todo número entra
escrito; as formas entram desenhadas. Nada se sobrepõe: cada texto tem um lugar
fixo, fora dos dados. E nada é sorteado: os pesos são os de xor_a_mao.py.
"""
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from contourpy import contour_generator
from manim import (DOWN, LEFT, RIGHT, UP, ApplyPointwiseFunction, Arrow, Circle, Create, DashedLine, DecimalNumber,
                   Dot, FadeIn, FadeOut, GrowArrow, GrowFromCenter, ImageMobject, LaggedStart, Line, MathTex, Matrix,
                   MoveAlongPath, Polygon, Rectangle, Scene, Square, SurroundingRectangle, TransformFromCopy,
                   TexTemplate, Text, ValueTracker, VGroup, VMobject, Write, always_redraw, config, linear,
                   tempconfig)
from manimpango import register_font

RAIZ = Path(__file__).resolve().parents[3]
AULA = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from xor_a_mao import B_OCULTA, T_XOR, W_OCULTA, X, degrau  # noqa: E402

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


# ================================================================ a camada oculta

class CamadaOculta(Scene):
    """Os quatro pontos do XOR passam pela camada oculta e chegam a um plano em que uma reta os separa.

    À esquerda, o plano das entradas (x₁, x₂); à direita, o plano das saídas da
    camada oculta (h₁, h₂). Os pesos são os de xor_a_mao.py: h₁ é o OU, com a
    reta x₁ + x₂ = 0,5, cheia; h₂ é o E, com a reta x₁ + x₂ = 1,5, tracejada.
    Cada ponto viaja até o lugar (h₁, h₂) que a camada oculta lhe dá: (0, 1) e
    (1, 0) chegam ao mesmo ponto, (1, 0). Lá, a reta do neurônio de saída,
    h₁ − h₂ = 0,5, separa os círculos dos quadrados. No fim, a região em que a
    rede inteira dispara volta ao plano das entradas: a faixa entre as duas retas.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        esq = Plano((-6.1, -3.0), 4.0, ("x_1", "x_2"))
        dir_ = Plano((2.4, -3.0), 4.0, ("h_1", "h_2"))

        # ------------------------------------------------ as equações dos neurônios, em cima de cada plano
        def linha_eq(tex, nome, traco):
            """A equação de um neurônio, com o traço da reta dele à esquerda, como numa legenda."""
            amostra = (Line(LEFT * 0.35, RIGHT * 0.35, color=ESCURO, stroke_width=5) if traco == "cheio"
                       else DashedLine(LEFT * 0.35, RIGHT * 0.35, color=ESCURO, stroke_width=5, dash_length=0.12))
            return VGroup(amostra, eq(tex, 36), texto(nome, 30, LARANJA)).arrange(RIGHT, buff=0.22)

        eq_h1 = linha_eq(r"h_1 = \operatorname{degrau}(x_1 + x_2 - 0{,}5)", "OU", "cheio")
        eq_h2 = linha_eq(r"h_2 = \operatorname{degrau}(x_1 + x_2 - 1{,}5)", "E", "tracejado")
        # o bloco da esquerda encosta na margem esquerda, e a equação da direita, na direita
        bloco = VGroup(eq_h1, eq_h2).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
        bloco.move_to([0, 2.25, 0]).to_edge(LEFT, buff=0.45)
        eq_y = VGroup(eq(r"y = \operatorname{degrau}(h_1 - h_2 - 0{,}5)", 36), texto("XOR", 30, LARANJA)
                      ).arrange(RIGHT, buff=0.22).move_to([0, 2.25, 0]).to_edge(RIGHT, buff=0.45)
        leg = legenda((bolinha(1, 0.13), "resposta 1"), (bolinha(0, 0.13), "resposta 0"),
                      (Square(side_length=0.28, color=REGIAO, fill_opacity=1, stroke_width=0), "a rede dispara"))
        leg.move_to([0, 3.6, 0])

        # A ordem de desenho é fixa, pelo z_index: as regiões embaixo, as retas e as
        # molduras no meio, os pontos por cima. Assim, enquanto uma região aparece,
        # ela nunca cobre um ponto nem uma reta.
        REGIOES, LINHAS, PONTOS = 0, 1, 2

        # ------------------------------------------------ os planos e os pontos
        molduras, textos = zip(esq.desenho(), dir_.desenho())
        for m in molduras:
            m.set_z_index(LINHAS)
        pontos = [bolinha(t).move_to(esq.p(*x)).set_z_index(PONTOS) for x, t in zip(X, T_XOR)]
        self.play(*[Create(m) for m in molduras], *[Write(t_) for t_ in textos], run_time=1.5)
        self.play(LaggedStart(*[GrowFromCenter(m) for m in pontos], lag_ratio=0.2), Write(leg), run_time=1.4)
        self.wait(0.5)

        # ------------------------------------------------ as duas retas da camada oculta
        reta_ou = esq.segmento((-0.5, 1.0), (1.0, -0.5), color=ESCURO, stroke_width=5).set_z_index(LINHAS)
        reta_e = DashedLine(esq.p(0.0, 1.5), esq.p(1.5, 0.0), color=ESCURO, stroke_width=5,
                            dash_length=0.16).set_z_index(LINHAS)
        self.play(Write(eq_h1), run_time=1.6)
        self.play(Create(reta_ou), run_time=1.0)
        self.wait(0.6)
        self.play(Write(eq_h2), run_time=1.6)
        self.play(Create(reta_e), run_time=1.0)
        self.wait(0.8)

        # ------------------------------------------------ a passagem pela camada oculta
        seta = Arrow([-1.75, -1.0, 0], [1.0, -1.0, 0], buff=0, color=SUAVE, stroke_width=6,
                     max_tip_length_to_length_ratio=0.15)
        nome_seta = texto("camada oculta", 30, SUAVE).next_to(seta, UP, buff=0.18)
        self.play(GrowArrow(seta), Write(nome_seta), run_time=1.2)

        # A rota de cada ponto não passa por cima de nenhum texto nem de outro
        # ponto: sobe por uma coluna livre do plano da esquerda, x₁ = 0,5 ou
        # x₁ = 1,4, sai pela borda de cima, cruza na altura Y_CRUZA, acima dos
        # dois planos e abaixo das equações, e desce pela coluna do destino. No
        # plano da direita, as colunas h₁ = 0 e h₁ = 1 estão livres na hora da
        # descida: o (1, 1) chega por último, depois dos dois círculos.
        Y_CRUZA = 1.27
        colunas_de_subida = {(0, 0): 0.5, (0, 1): 0.5, (1, 0): 1.4, (1, 1): 1.4}
        copias = []
        for x, m in zip(X, pontos):
            h = degrau(W_OCULTA @ x + B_OCULTA)          # o lugar do ponto no plano novo
            sobe = colunas_de_subida[tuple(int(v) for v in x)]
            rota = [esq.p(*x), esq.p(sobe, x[1]), np.array([esq.p(sobe, 0)[0], Y_CRUZA, 0]),
                    np.array([dir_.p(*h)[0], Y_CRUZA, 0]), dir_.p(*h)]
            caminho = VMobject().set_points_as_corners(rota)
            c = m.copy().set_z_index(PONTOS)
            copias.append(c)
            self.play(MoveAlongPath(c, caminho), run_time=1.6)
        self.wait(0.8)

        # ------------------------------------------------ a reta do neurônio de saída, no plano novo
        regiao_saida = dir_.poligono([(0.0, -0.5), (1.5, -0.5), (1.5, 1.0)]).set_z_index(REGIOES)  # h₁ − h₂ − 0,5 ≥ 0
        reta_saida = dir_.segmento((0.0, -0.5), (1.5, 1.0), color=ESCURO, stroke_width=5).set_z_index(LINHAS)
        self.play(Write(eq_y), run_time=1.6)
        self.play(FadeIn(regiao_saida), Create(reta_saida), run_time=1.2)
        self.wait(1.2)

        # ------------------------------------------------ de volta ao plano das entradas: a faixa
        faixa = esq.poligono([(-0.5, 1.0), (1.0, -0.5), (1.5, -0.5), (1.5, 0.0), (0.0, 1.5), (-0.5, 1.5)])
        self.play(FadeIn(faixa.set_z_index(REGIOES)), run_time=1.4)
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


def matriz(linhas, tamanho=48, cor=ESCURO):
    """Matriz ou vetor em coluna, entre parênteses, com cada número um pedaço que se pode destacar ou copiar."""
    m = Matrix(linhas, left_bracket="(", right_bracket=")", element_to_mobject=MathTex,
               element_to_mobject_config={"font_size": tamanho, "tex_template": MODELO}, h_buff=1.1, v_buff=0.8)
    return m.set_color(cor)


# ================================================================ o produto da matriz pelo vetor

W_P = [["1", "-2"], ["3", "0{,}5"]]        # a matriz do exemplo: números pequenos, um negativo, um decimal
X_P = [["2"], ["1"]]
B_P = [["0{,}5"], ["-1"]]
# As contas, linha por linha: 1·2 + (−2)·1 + 0,5 = 0,5 e 3·2 + 0,5·1 − 1 = 5,5; o degrau dá (1; 1)


class Produto(Scene):
    """W x⃗ + b⃗ com números: cada linha de W faz o produto escalar com x⃗, soma o viés e dá um número da saída."""

    def construct(self):
        self.camera.background_color = FUNDO
        W, x, b = matriz(W_P), matriz(X_P), matriz(B_P)
        # a saída já nasce com a largura dos números certos, escondidos; no lugar deles, pontos de interrogação
        r = matriz([["0{,}5"], ["5{,}5"]])
        mais, igual = eq("+", 48), eq("=", 48)
        conta = VGroup(W, x, mais, b, igual, r).arrange(RIGHT, buff=0.3).move_to(np.array([0, 1.25, 0]))
        for entrada in r.get_entries():
            entrada.set_opacity(0)
        perguntas = VGroup(*[eq("?", 48).move_to(e_) for e_ in r.get_entries()])
        leg = no_alto("Uma camada: a matriz dos pesos vezes as entradas, mais os vieses")
        self.play(Write(leg), run_time=1.2)
        self.play(Write(VGroup(W, x, mais, b, igual, r.get_brackets())), Write(perguntas), run_time=2.0)
        self.wait(1.0)

        def linha_da_conta(k, partes, cor, altura):
            """A conta da linha k, copiada dos números de cima, e o resultado levado para a saída."""
            moldura_w = SurroundingRectangle(W.get_rows()[k], color=cor, buff=0.12, stroke_width=4)
            moldura_x = SurroundingRectangle(x.get_entries(), color=cor, buff=0.12, stroke_width=4)
            moldura_b = SurroundingRectangle(b.get_entries()[k], color=cor, buff=0.12, stroke_width=4)
            self.play(Create(moldura_w), Create(moldura_x), Create(moldura_b), run_time=0.8)
            linha_ = MathTex(*partes, font_size=48, color=ESCURO, tex_template=MODELO).move_to(np.array([0, altura, 0]))
            linha_[-1].set_color(cor)
            origem = {0: W.get_rows()[k][0], 2: x.get_entries()[0], 4: W.get_rows()[k][1], 6: x.get_entries()[1],
                      8: b.get_entries()[k]}
            self.play(*[TransformFromCopy(origem[i], linha_[i]) for i in origem],
                      *[Write(linha_[i]) for i in (1, 3, 5, 7)], run_time=1.6)
            self.play(Write(linha_[9]), Write(linha_[10]), run_time=0.8)
            novo = MathTex(partes[10], font_size=48, color=cor, tex_template=MODELO).move_to(r.get_entries()[k])
            self.play(FadeOut(perguntas[k]), TransformFromCopy(linha_[10], novo), run_time=0.9)
            self.play(FadeOut(moldura_w, moldura_x, moldura_b), run_time=0.4)
            return linha_, novo

        leg = troca(self, leg, "A linha 1 de", "$W$", "faz o produto escalar com", "$\\vec{x}$",
                    "e soma o viés")
        linha1, z1 = linha_da_conta(0, ["1", "\\cdot", "2", "+", "(-2)", "\\cdot", "1", "+", "0{,}5", "=", "0{,}5"],
                                    LARANJA, -0.8)
        leg = troca(self, leg, "A linha 2 faz o mesmo: um número por neurônio")
        linha2, z2 = linha_da_conta(1, ["3", "\\cdot", "2", "+", "0{,}5", "\\cdot", "1", "+", "(-1)", "=", "5{,}5"],
                                    AZUL, -1.75)
        self.wait(0.8)

        # a ativação, posição por posição
        h = matriz([["1"], ["1"]])
        ativ = VGroup(eq("\\vec{h} = \\operatorname{degrau}(\\vec{z}) =", 48), h).arrange(RIGHT, buff=0.2)
        ativ.move_to(np.array([0, -2.95, 0]))
        leg = troca(self, leg, "O degrau vale para cada posição do vetor, separadamente")
        self.play(Write(ativ), run_time=1.6)
        self.wait(1.0)

        # as dimensões, embaixo de cada peça
        dims = VGroup(*[texto(s, 30, SUAVE).next_to(peca, DOWN, buff=0.22)
                        for s, peca in (("2 por 2", W), ("2", x), ("2", b), ("2", r))])
        leg = troca(self, leg, "2 por 2 vezes 2 números dá 2 números, um por neurônio")
        self.play(Write(dims), run_time=1.2)
        self.wait(3)


# ================================================================ a grade do plano: matrizes e a sigmoide

ESC = 0.5                                    # unidades da tela por unidade do plano
W1_G = np.array([[1.0, 0.5], [0.0, 1.0]])    # inclina a grade
W2_G = np.array([[1.0, 0.0], [-0.5, 1.0]])   # inclina na outra direção
W21_G = W2_G @ W1_G                          # (1; 0,5) e (−0,5; 0,75): as duas numa matriz só


def sigmoide(z):
    return 1 / (1 + np.exp(-z))


class Grade(Scene):
    """Uma matriz leva a grade do plano a outra grade de retas; duas matrizes seguidas valem a matriz do produto; a
    sigmoide, aplicada a cada coordenada, entorta as retas."""

    def construct(self):
        self.camera.background_color = FUNDO
        CE, CD = np.array([-3.5, -0.5, 0.0]), np.array([3.5, -0.5, 0.0])

        def grade(centro):
            """As retas x = −3, −2,5, …, 3 e y = −3, …, 3, cada uma com muitos pontos, para poder entortar."""
            g = VGroup()
            ts = np.linspace(-3, 3, 61)
            for v in np.linspace(-3, 3, 13):
                eixo = abs(v) < 1e-9
                for vertical in (True, False):
                    pts = [centro + ESC * (np.array([v, t, 0]) if vertical else np.array([t, v, 0])) for t in ts]
                    g.add(VMobject(stroke_color=ESCURO if eixo else AZUL, stroke_width=4 if eixo else 2,
                                   stroke_opacity=1 if eixo else 0.55).set_points_as_corners(pts))
            return g

        def tex_matriz(nome, M):
            linhas = r" \\ ".join(" & ".join(f"{v:g}".replace(".", "{,}") for v in linha_) for linha_ in M)
            return eq(nome + r" = \begin{pmatrix} " + linhas + r" \end{pmatrix}", 36)

        esq, dir_ = grade(CE), grade(CD)
        rot_esq = tex_matriz("W_1", W1_G).move_to(np.array([CE[0], 2.35, 0]))
        leg = no_alto("Uma matriz leva a grade do plano a outra grade")
        self.play(Write(leg), Create(esq), run_time=2.0)
        self.play(Write(rot_esq), run_time=1.0)
        self.play(esq.animate.apply_matrix(W1_G, about_point=CE), run_time=2.5)
        leg = troca(self, leg, "As retas continuam retas, e as paralelas, paralelas")
        self.wait(0.8)
        novo = tex_matriz("W_2", W2_G).move_to(rot_esq)
        self.play(FadeOut(rot_esq), run_time=0.3)
        rot_esq = novo
        self.play(Write(rot_esq), run_time=1.0)
        self.play(esq.animate.apply_matrix(W2_G, about_point=CE), run_time=2.5)
        self.wait(0.6)

        rot_dir = tex_matriz("W_2 W_1", W21_G).move_to(np.array([CD[0], 2.35, 0]))
        leg = troca(self, leg, "A matriz do produto faz as duas de uma vez")
        self.play(Create(dir_), Write(rot_dir), run_time=1.8)
        self.play(dir_.animate.apply_matrix(W21_G, about_point=CD), run_time=2.5)
        final_esq = tex_matriz("W_2 W_1", W21_G).move_to(rot_esq)
        self.play(FadeOut(rot_esq), run_time=0.3)
        rot_esq = final_esq
        self.play(Write(rot_esq), run_time=0.8)
        leg = troca(self, leg, "As duas grades são a mesma: duas camadas lineares valem uma")
        self.wait(1.5)

        # a direita recomeça: W₁ e depois a sigmoide em cada coordenada
        self.play(FadeOut(dir_, rot_dir), run_time=0.6)
        dir_ = grade(CD)
        rot_dir = eq(r"\sigma(W_1\vec{x})", 40).move_to(np.array([CD[0], 2.35, 0]))
        leg = troca(self, leg, "Com a sigmoide em cada coordenada, as retas entortam")
        self.play(Create(dir_), Write(rot_dir), run_time=1.6)
        self.play(dir_.animate.apply_matrix(W1_G, about_point=CD), run_time=2.0)

        def leva(p):
            """Da tela para o plano, a sigmoide em cada coordenada, e de volta: o quadrado de 0 a 1 ocupa 3."""
            u = (p - CD) / ESC
            s = sigmoide(u[:2])
            return CD + np.array([3.0 * (s[0] - 0.5), 3.0 * (s[1] - 0.5), 0.0])

        self.play(ApplyPointwiseFunction(leva, dir_), run_time=3.0)
        self.wait(0.5)
        notas = VGroup(texto("sem ativação: retas", 30, SUAVE).move_to(np.array([CE[0], -3.35, 0])),
                       texto("com a sigmoide: curvas, de 0 a 1", 30, SUAVE).move_to(np.array([CD[0], -3.35, 0])))
        self.play(Write(notas), run_time=1.2)
        self.wait(3)


# ================================================================ do degrau à sigmoide

class Sigmoide(Scene):
    """O degrau e a sigmoide; a sigmoide de k·z vira degrau quando k cresce; a inclinação, ponto a ponto."""

    def construct(self):
        self.camera.background_color = FUNDO
        canto, larg, alt = np.array([-6.0, -2.7, 0.0]), 8.4, 4.6
        zlim, ylim = (-6.0, 6.0), (-0.1, 1.1)

        def p(z, y):
            return canto + np.array([(z - zlim[0]) / (zlim[1] - zlim[0]) * larg, (y - ylim[0]) / (ylim[1] - ylim[0]) * alt,
                                     0.0])

        caixa = Rectangle(width=larg, height=alt, color=ESCURO, stroke_width=2.5).move_to(canto + np.array([larg / 2, alt / 2, 0]))
        tracos, numeros = VGroup(), VGroup()
        for v in (-6, -3, 0, 3, 6):
            b0 = p(v, ylim[0])
            tracos.add(Line(b0, b0 + UP * 0.12, color=ESCURO, stroke_width=2.5))
            numeros.add(eq(str(v), 32, TEXTO).next_to(b0, DOWN, buff=0.12))
        for v, s in ((0, "0"), (0.5, "0{,}5"), (1, "1")):
            b0 = p(zlim[0], v)
            tracos.add(Line(b0, b0 + RIGHT * 0.12, color=ESCURO, stroke_width=2.5))
            numeros.add(eq(s, 32, TEXTO).next_to(b0, LEFT, buff=0.14))
        nome_z = eq("z", 40).next_to(VGroup(caixa, numeros), DOWN, buff=0.1)
        k = ValueTracker(1.0)
        z0 = ValueTracker(-4.0)

        degrau_ = VGroup(Line(p(-6, 0), p(0, 0), color=LARANJA, stroke_width=6),
                         Line(p(0, 1), p(6, 1), color=LARANJA, stroke_width=6),
                         DashedLine(p(0, 0), p(0, 1), color=LARANJA, stroke_width=2, dash_length=0.08))

        def curva():
            zs = np.linspace(-6, 6, 300)
            return VMobject(stroke_color=AZUL, stroke_width=6).set_points_smoothly(
                [p(z, sigmoide(k.get_value() * z)) for z in zs])

        leg = no_alto("O degrau: 0 antes do zero, 1 depois")
        self.play(Write(leg), Create(caixa), Create(tracos), Write(numeros), Write(nome_z), run_time=1.8)
        self.play(Create(degrau_), run_time=1.2)
        self.wait(1.0)

        sig = curva()
        leg = troca(self, leg, "A sigmoide faz a mesma passagem, sem salto")
        self.play(Create(sig), run_time=1.6)
        meio = Dot(p(0, 0.5), radius=0.08, color=ESCURO)
        rot_meio = eq("\\sigma(0) = 0{,}5", 36).next_to(p(0.35, 0.5), RIGHT, buff=0.1)
        self.play(GrowFromCenter(meio), Write(rot_meio), run_time=0.9)
        self.wait(1.0)

        # k multiplica a soma: a sigmoide aperta e vira degrau
        x_painel = 3.0
        leitura_k = VGroup(eq("k =", 44), Numero(1.0, num_decimal_places=1, font_size=44, color=ESCURO)).arrange(
            RIGHT, buff=0.2).move_to(np.array([0, 1.4, 0])).align_to(np.array([x_painel, 0, 0]), LEFT)
        leitura_k[1].add_updater(lambda m: m.set_value(k.get_value()))
        rot_k = eq("\\sigma(k z)", 40, SUAVE).next_to(leitura_k, UP, buff=0.3).align_to(leitura_k, LEFT)
        leg = troca(self, leg, "Com a soma multiplicada por", "$k,$", "a sigmoide vira o degrau")
        self.play(Write(rot_k), Write(leitura_k), run_time=1.0)
        self.remove(sig)
        sig = always_redraw(curva)
        self.add(sig)
        self.play(k.animate.set_value(12), run_time=4.0)
        self.wait(1.0)
        self.play(k.animate.set_value(1), run_time=1.5)

        # a inclinação, ponto a ponto, com k = 1
        def inclinacao():
            s = sigmoide(z0.get_value())
            return s * (1 - s)

        def tangente():
            z, s, m = z0.get_value(), sigmoide(z0.get_value()), inclinacao()
            dz = 1.3
            return Line(p(z - dz, s - m * dz), p(z + dz, s + m * dz), color=ESCURO, stroke_width=4)

        ponto = always_redraw(lambda: Dot(p(z0.get_value(), sigmoide(z0.get_value())), radius=0.08, color=ESCURO))
        tang = always_redraw(tangente)
        leitura_z = VGroup(texto("no ponto", 30, SUAVE), eq("z =", 40),
                           Numero(-4.0, num_decimal_places=1, font_size=40, color=ESCURO)).arrange(RIGHT, buff=0.18)
        leitura_z.move_to(np.array([0, 0.1, 0])).align_to(np.array([x_painel, 0, 0]), LEFT)
        leitura_z[2].add_updater(lambda m: m.set_value(z0.get_value()))
        leitura_m = VGroup(texto("inclinação", 30, SUAVE),
                           Numero(inclinacao(), num_decimal_places=3, font_size=40, color=ESCURO)).arrange(RIGHT, buff=0.2)
        leitura_m.move_to(np.array([0, -0.8, 0])).align_to(np.array([x_painel, 0, 0]), LEFT)
        leitura_m[1].add_updater(lambda m: m.set_value(inclinacao()))
        leg = troca(self, leg, "A sigmoide inclina em todo ponto; o degrau, só no salto")
        self.play(FadeOut(rot_meio, meio), run_time=0.4)
        self.play(GrowFromCenter(ponto), Create(tang), Write(leitura_z), Write(leitura_m), run_time=1.2)
        self.play(z0.animate.set_value(0.0), run_time=3.0, rate_func=linear)
        self.wait(1.0)
        self.play(z0.animate.set_value(3.0), run_time=2.5, rate_func=linear)
        self.wait(0.6)
        leg = troca(self, leg, "Inclinação zero, passo zero: o degrau não treina")
        self.wait(3)


# ================================================================ a gravação

CENAS = {"camada-oculta": CamadaOculta, "produto": Produto, "grade": Grade, "sigmoide": Sigmoide}


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
