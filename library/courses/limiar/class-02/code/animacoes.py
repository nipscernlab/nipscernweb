"""Os vídeos da aula 2, feitos com o Manim Community.

Rode, a partir da raiz do repositório, com o nome dos vídeos que quer gravar, ou
sem nome nenhum para gravar todos:
    python aulas/02-gradiente/codigo/animacoes.py
    python aulas/02-gradiente/codigo/animacoes.py derivada taxa

Os sete vídeos, na ordem da aula:
    perceptron-e     a revisão: a regra do perceptron aprende o E, e a tabela das épocas se monta
    perceptron-xor   a mesma regra no XOR: 30 épocas, 4 erros em cada uma, e a reta nunca para
    perda-de-w       a reta gira com o peso w, e a perda desenha uma curva com um fundo
    derivada         a secante vira tangente quando h encolhe, e de perto a curva vira reta
    parcial          dois cortes na superfície da perda: as duas derivadas parciais e o gradiente
    descida-3d       a descida na superfície da perda, com a reta se ajustando aos pontos ao lado
    taxa             o gradiente descendente na parábola com três taxas: devagar, oscila, diverge

Precisa do Manim Community (pip install manim), do MiKTeX, o mesmo das equações
dos slides, e do ffmpeg. Cada vídeo sai em dois arquivos:
    aulas/02-gradiente/videos/<nome>.mp4           1920 por 1080, 30 quadros por segundo, sem som
    aulas/02-gradiente/figuras/<nome>-quadro.png   o último quadro, que o slide mostra parado

No deck, o slide mostra o quadro parado e toca o mp4 quando se clica nele. O
vídeo ocupa uns 60% da largura do slide, embaixo do título do slide, e por isso
não tem título próprio, e as letras são grandes: texto corrido com pelo menos 30
pontos do Manim, equação com pelo menos 38.

Três regras valem em todas as cenas. Todo texto e todo número entra escrito, com
o efeito de escrita, como nos vídeos do 3Blue1Brown; as formas entram desenhadas.
Nada se sobrepõe: cada texto tem um lugar fixo, fora dos dados, e os pontos ficam
por cima das retas. E nada é sorteado: os vídeos saem sempre iguais, com os
números de reta.py e do perceptron.py da aula 1.
"""
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from manim import (DEGREES, DOWN, LEFT, RIGHT, UP, Arrow, Circle, Create, DashedLine, DecimalNumber, Dot, Dot3D,
                   FadeIn, FadeOut, GrowArrow, GrowFromCenter, GrowFromEdge, Indicate, LaggedStart, Line, MathTex,
                   MovingCameraScene, ParametricFunction, Polygon, Rectangle, RoundedRectangle, Scene, Square,
                   SurroundingRectangle, Surface, TexTemplate, Text, ThreeDAxes, ThreeDScene, TracedPath,
                   ValueTracker, VGroup, VMobject, Write, always_redraw, config, smooth, tempconfig)
from manim import TransformFromCopy
from manimpango import register_font

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reta import dados, gradiente, minimos_quadrados, perda  # noqa: E402

RAIZ = Path(__file__).resolve().parents[3]
AULA = Path(__file__).resolve().parents[1]

# As fontes do curso, as mesmas dos slides, guardadas em infra/fontes/ com as licenças
for arquivo in ("IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf", "SourceSerif4-Semibold.ttf"):
    register_font(str(RAIZ / "infra" / "fontes" / arquivo))
SANS, SERIFA = "IBM Plex Sans", "Source Serif 4"

# A paleta de infra/slides.py e das figuras: resposta 1 em círculo azul, resposta
# 0 em quadrado vermelho, região que dispara em azul claro
FUNDO, ESCURO, TEXTO, SUAVE, CINZA = "#F6F5F1", "#14213D", "#3B4658", "#5E6A7D", "#8A94A6"
AZUL, LARANJA, VERMELHO, REGIAO, CARTAO, BORDA = "#1F5FAD", "#A8500F", "#C0392B", "#CFE3F5", "#FDFCFA", "#DCDFE4"

# As equações em STIX Two, a fonte das equações dos slides (infra/equacoes.py).
# Vale para todo MathTex e para os algarismos dos números que mudam na tela.
MODELO = TexTemplate(preamble="\\usepackage[T1]{fontenc}\n\\usepackage{amsmath}\n\\usepackage{stix2}\n")
config.tex_template = MODELO


def texto(s, tamanho=34, cor=TEXTO, peso="NORMAL", fonte=SANS):
    """Texto corrido, na fonte dos slides."""
    return Text(s, font=fonte, font_size=tamanho, color=cor, weight=peso)


def eq(*partes, tamanho=44, cor=ESCURO):
    """Equação em LaTeX. Cada parte vira um pedaço separado, que se pode colorir ou mover sozinho."""
    return MathTex(*partes, font_size=tamanho, color=cor, tex_template=MODELO)


def frase(*pedacos, tamanho=32, cor=TEXTO):
    """Uma linha que mistura texto e equação, como "com o viés parado em b = 0,967".

    Cada pedaço é um texto comum ou, se começa com $, uma equação; a equação sai
    um pouco maior que o texto, para as duas letras terem a mesma altura.
    """
    partes = [eq(p.strip("$"), tamanho=round(tamanho * 1.25), cor=cor) if p.startswith("$") else texto(p, tamanho, cor)
              for p in pedacos]
    return VGroup(*partes).arrange(RIGHT, buff=0.16)


class Numero(DecimalNumber):
    """Número que muda na tela, com vírgula decimal, como pede o CLAUDE.md."""

    def _get_num_string(self, number):
        return super()._get_num_string(number).replace(".", ",")


def colore_fracao(fracao, cor_cima, cor_baixo):
    """Pinta o numerador de uma cor e o denominador de outra.

    As letras de um MathTex não vêm numa ordem garantida, então a divisão é pela
    posição: o traço da fração é a letra mais larga, e o que fica acima dele é o
    numerador; o que fica abaixo, o denominador. O traço fica com a cor do texto.
    """
    letras = fracao[0]
    traco = max(letras, key=lambda m: m.width)
    for m in letras:
        if m is not traco:
            m.set_color(cor_cima if m.get_center()[1] > traco.get_center()[1] else cor_baixo)


def n(v):
    """Número inteiro em LaTeX; o menos sai como sinal de menos, e não como hífen."""
    return f"{int(round(v))}"


def br(v, casas=2):
    """Número decimal em LaTeX, com vírgula decimal: 1{,}28, sem o espaço que o LaTeX põe depois de vírgula."""
    return f"{v:.{casas}f}".replace(".", "{,}")


def vetor(v):
    """Par de números inteiros em LaTeX, como (1,\\ 0)."""
    return rf"({n(v[0])},\ {n(v[1])})"


def distancia_ao_segmento(m, a, c):
    """A menor distância entre o ponto m e o segmento de a até c, no plano."""
    d = c - a
    s = np.clip(np.dot(m - a, d) / max(np.dot(d, d), 1e-12), 0, 1)
    return np.linalg.norm(m - (a + s * d))


class Moldura:
    """Um gráfico 2D com moldura e marcas por fora, como as figuras do matplotlib.

    Os eixos não passam pela origem: com eixo no meio do gráfico, a curva passaria
    por cima dos números do eixo. A moldura é o retângulo dos limites, as marcas
    ficam na borda de baixo e na da esquerda, e os números e os nomes dos eixos,
    fora dela. O nome de um eixo pode ser LaTeX, um texto pronto ou None.
    """

    def __init__(self, x_lim, y_lim, largura, altura, canto, x_marcas, y_marcas, x_nome, y_nome, casas=0,
                 tam_marca=32, tam_nome=40):
        self.x_lim, self.y_lim = x_lim, y_lim
        self.largura, self.altura = largura, altura
        self.canto = np.array([canto[0], canto[1], 0.0])
        self.x_marcas, self.y_marcas, self.casas = x_marcas, y_marcas, casas
        self.x_nome, self.y_nome = x_nome, y_nome
        self.tam_marca, self.tam_nome = tam_marca, tam_nome

    def p(self, x, y):
        """Leva o ponto (x, y) do gráfico para a tela."""
        fx = (x - self.x_lim[0]) / (self.x_lim[1] - self.x_lim[0])
        fy = (y - self.y_lim[0]) / (self.y_lim[1] - self.y_lim[0])
        return self.canto + np.array([fx * self.largura, fy * self.altura, 0.0])

    def dentro(self, x, y):
        return self.x_lim[0] <= x <= self.x_lim[1] and self.y_lim[0] <= y <= self.y_lim[1]

    def caixa(self):
        """O retângulo dos limites."""
        c = Rectangle(width=self.largura, height=self.altura, color=ESCURO, stroke_width=2.5)
        return c.move_to(self.canto + np.array([self.largura / 2, self.altura / 2, 0]))

    def desenho(self):
        """A moldura, as marcas, os números das marcas e os nomes dos eixos, tudo fora da área dos dados.

        Devolve um grupo: o primeiro item é a moldura, para ser desenhada com
        Create, e o resto são textos, para entrarem escritos.
        """
        caixa = self.caixa()
        partes = VGroup(caixa)
        numero = (lambda v: br(v, self.casas)) if self.casas else (lambda v: n(v))
        numeros_x, numeros_y = VGroup(), VGroup()
        for v in self.x_marcas:
            base = self.p(v, self.y_lim[0])
            partes.add(Line(base, base + UP * 0.12, color=ESCURO, stroke_width=2.5))
            numeros_x.add(eq(numero(v), tamanho=self.tam_marca, cor=TEXTO).next_to(base, DOWN, buff=0.14))
        for v in self.y_marcas:
            base = self.p(self.x_lim[0], v)
            partes.add(Line(base, base + RIGHT * 0.12, color=ESCURO, stroke_width=2.5))
            numeros_y.add(eq(numero(v), tamanho=self.tam_marca, cor=TEXTO).next_to(base, LEFT, buff=0.14))
        partes.add(numeros_x, numeros_y)
        for nome, lado, grupo in ((self.x_nome, DOWN, numeros_x), (self.y_nome, LEFT, numeros_y)):
            if nome is None:
                continue
            rotulo = eq(nome, tamanho=self.tam_nome) if isinstance(nome, str) else nome
            partes.add(rotulo.next_to(VGroup(caixa, grupo), lado, buff=0.25))
        return partes

    def curva(self, f, x_de, x_ate, cor=ESCURO, espessura=5, pontos=300):
        """O gráfico de f entre x_de e x_ate, só a parte que fica dentro da moldura."""
        xs = np.linspace(x_de, x_ate, pontos)
        dentro = [self.p(x, f(x)) for x in xs if self.dentro(x, f(x))]
        if len(dentro) < 2:
            return VMobject()
        return VMobject(stroke_color=cor, stroke_width=espessura).set_points_smoothly(dentro)

    def reta(self, x0, y0, inclinacao):
        """A reta por (x0, y0) com essa inclinação, cortada na moldura: as duas pontas, na tela."""
        xs = np.linspace(self.x_lim[0], self.x_lim[1], 600)
        ys = y0 + inclinacao * (xs - x0)
        ok = (ys >= self.y_lim[0]) & (ys <= self.y_lim[1])
        xs, ys = xs[ok], ys[ok]
        return (self.p(xs[0], ys[0]), self.p(xs[-1], ys[-1]))


# ================================================================ 1 e 2. o perceptron no E e no XOR

X_E = [(0, 0), (0, 1), (1, 0), (1, 1)]
T_E = [0, 0, 0, 1]
T_XOR = [0, 1, 1, 0]


def treino(alvos, epocas=20, para_sem_erro=True):
    """A regra do perceptron, com η = 1 e tudo começando em zero, como no perceptron.py da aula 1.

    Devolve um passo por exemplo visto: a época, o índice do exemplo, z, a saída
    y, a resposta certa t, os pesos e o viés antes e depois, e quantos erros a
    época já tem. No E, para na primeira época sem erro, a sexta; no XOR, que
    nunca fica sem erro, anda as épocas pedidas.
    """
    w, b = np.zeros(2), 0.0
    passos = []
    for epoca in range(1, epocas + 1):
        erros = 0
        for k, (x, t) in enumerate(zip(X_E, alvos)):
            x = np.array(x)
            z = w @ x + b
            y = int(z >= 0)                              # o degrau: dispara se z ≥ 0
            w_antes, b_antes = w.copy(), b
            if y != t:
                w = w + (t - y) * x                      # a regra dos pesos, com η = 1
                b = b + (t - y)                          # a regra do viés
                erros += 1
            passos.append(dict(epoca=epoca, k=k, z=z, y=y, t=t, w_antes=w_antes, b_antes=b_antes,
                               w=w.copy(), b=b, erros=erros))
        if erros == 0 and para_sem_erro:
            break
    return passos


class Plano:
    """O quadrado do plano (x₁, x₂), com os limites pedidos nos dois eixos.

    No E, de −0,5 a 1,5, como nas figuras da aula 1. No XOR, de −1,5 a 2,5: lá
    a reta passa por x₁ = −1 e por x₂ = −1, e precisa caber no desenho.
    """

    def __init__(self, canto, lado, lim=(-0.5, 1.5), fator_seta=0.2):
        self.canto, self.lado, self.lim = np.array(canto, dtype=float), lado, lim
        self.vao = lim[1] - lim[0]
        self.fator_seta = fator_seta

    def p(self, x1, x2):
        """Leva o ponto (x₁, x₂) do plano para a tela."""
        e = self.lado / self.vao
        return self.canto + np.array([(x1 - self.lim[0]) * e, (x2 - self.lim[0]) * e, 0.0])

    def cantos(self):
        a, c = self.lim
        return [(a, a), (c, a), (c, c), (a, c)]

    def regiao(self, w1, w2, b):
        """O pedaço do quadrado em que w₁x₁ + w₂x₂ + b ≥ 0, cortado pela reta, pelo método de Sutherland e Hodgman.

        Percorre os cantos, guarda os que estão do lado que dispara e, quando uma
        aresta cruza a reta, guarda o ponto do cruzamento.
        """
        cantos = self.cantos()
        z = [w1 * a + w2 * c + b for a, c in cantos]
        saida = []
        for i in range(4):
            p, q, zp, zq = cantos[i], cantos[(i + 1) % 4], z[i], z[(i + 1) % 4]
            if zp >= 0:
                saida.append(p)
            if (zp >= 0) != (zq >= 0):
                s = zp / (zp - zq)
                saida.append((p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1])))
        return saida

    def corda(self, w1, w2, b):
        """O pedaço da reta z = 0 que fica dentro do quadrado: os dois pontos da borda, ou None.

        A ordem dos dois pontos segue a direção de w girado de 90 graus, e não a
        ordem em que as bordas são percorridas. Assim, quando os pesos mudam aos
        poucos, cada ponta da corda muda aos poucos também, e a seta ancorada
        nela desliza, sem pular de um lado para o outro.
        """
        if np.hypot(w1, w2) < 1e-9:
            return None                                  # com w = (0, 0) não há reta: z = b em todo ponto
        cantos = self.cantos()
        z = [w1 * a + w2 * c + b for a, c in cantos]
        pontos = []
        for i in range(4):
            p, q = np.array(cantos[i], dtype=float), np.array(cantos[(i + 1) % 4], dtype=float)
            zp, zq = z[i], z[(i + 1) % 4]
            if zp == zq:
                continue                                 # aresta paralela à reta: não cruza, ou está em cima dela
            s = zp / (zp - zq)
            if 0 <= s <= 1:
                ponto = p + s * (q - p)
                if all(np.linalg.norm(ponto - o) > 1e-9 for o in pontos):
                    pontos.append(ponto)                 # um canto em cima da reta entraria duas vezes
        if len(pontos) < 2:
            return None
        a, c = max(((u, v) for u in pontos for v in pontos), key=lambda par: np.linalg.norm(par[0] - par[1]))
        if np.linalg.norm(c - a) < 1e-9:
            return None
        if np.dot(c - a, np.array([-w2, w1])) < 0:
            a, c = c, a
        return a, c

    def seta(self, w1, w2, b, s):
        """O vetor dos pesos, desenhado do ponto da corda na fração s, perpendicular à reta, para o lado que dispara.

        O comprimento é fator_seta vezes o tamanho de w, para se ver os pesos
        crescendo, mas encolhe se a ponta fosse sair do quadrado: encolher aos
        poucos não pisca, e sumir de repente piscaria. Devolve (início, fim) no
        plano, ou None quando não há reta dentro do quadrado.
        """
        corda = self.corda(w1, w2, b)
        if corda is None:
            return None
        a, c = corda
        base = a + s * (c - a)
        w = np.array([w1, w2])
        direcao = w / np.linalg.norm(w)
        margem = 0.03 * self.vao
        cabe = np.inf                                    # quanto a seta anda na direção de w até a borda
        for eixo in range(2):
            if direcao[eixo] > 1e-9:
                cabe = min(cabe, (self.lim[1] - margem - base[eixo]) / direcao[eixo])
            elif direcao[eixo] < -1e-9:
                cabe = min(cabe, (self.lim[0] + margem - base[eixo]) / direcao[eixo])
        comprimento = min(self.fator_seta * np.linalg.norm(w), cabe)
        if comprimento < 0.02 * self.vao:
            return None
        return base, base + comprimento * direcao

    def melhor_s(self, w1, w2, b, marcas):
        """A fração da corda onde ancorar a seta para esses pesos: a que deixa a seta inteira e mais longe dos pontos.

        Só se calcula nos pesos de chegada de cada correção; no caminho, a fração
        anda aos poucos de uma escolha à outra. Devolve None se a seta não cabe
        inteira em lugar nenhum.
        """
        inteira = self.fator_seta * np.hypot(w1, w2)
        melhor, maior = None, -1.0
        for s in np.linspace(0.1, 0.9, 33):
            seta = self.seta(w1, w2, b, s)
            if seta is None or np.linalg.norm(seta[1] - seta[0]) < inteira - 1e-9:
                continue
            d = min(distancia_ao_segmento(np.array(m, dtype=float), *seta) for m in marcas)
            if d > maior:
                melhor, maior = s, d
        return melhor


class Perceptron(Scene):
    """O que os vídeos do E e do XOR têm em comum: o plano, os quatro pontos, a legenda e o que anda com os pesos.

    O plano fica à esquerda, com a legenda em cima dele; a direita fica livre
    para cada vídeo. A reta z = 0, a região que dispara e o vetor dos pesos
    se redesenham a cada quadro a partir de quatro números: w₁, w₂, b e a
    fração da reta onde a seta se apoia.
    """

    ALVOS, LIM, MARCAS, FATOR_SETA = T_E, (-0.5, 1.5), (0, 1), 0.2

    def monta(self):
        self.camera.background_color = FUNDO
        plano = self.plano = Plano((-5.6, -2.6, 0), 5.0, self.LIM, self.FATOR_SETA)

        # ------------------------------------------------ o plano, com marcas e rótulos por fora
        meio = (self.LIM[0] + self.LIM[1]) / 2
        borda = Rectangle(width=plano.lado, height=plano.lado, color=ESCURO, stroke_width=2.5)
        borda.move_to(plano.p(meio, meio))
        tracos, numeros_x, numeros_y = VGroup(), VGroup(), VGroup()
        for v in self.MARCAS:
            base_x, base_y = plano.p(v, self.LIM[0]), plano.p(self.LIM[0], v)
            tracos.add(Line(base_x, base_x + UP * 0.12, color=ESCURO, stroke_width=2.5),
                       Line(base_y, base_y + RIGHT * 0.12, color=ESCURO, stroke_width=2.5))
            numeros_x.add(eq(n(v), tamanho=32, cor=TEXTO).next_to(base_x, DOWN, buff=0.16))
            numeros_y.add(eq(n(v), tamanho=32, cor=TEXTO).next_to(base_y, LEFT, buff=0.16))
        rotulos = VGroup(eq("x_1", tamanho=40).next_to(VGroup(borda, numeros_x), DOWN, buff=0.2),
                         eq("x_2", tamanho=40).next_to(VGroup(borda, numeros_y), LEFT, buff=0.25))
        self.borda, self.tracos, self.numeros = borda, tracos, VGroup(numeros_x, numeros_y, rotulos)

        # ------------------------------------------------ o que anda com os pesos
        self.w1, self.w2, self.b, self.s, self.opac = (ValueTracker(v) for v in (0.0, 0.0, 0.0, 0.5, 0.0))

        def valores():
            return self.w1.get_value(), self.w2.get_value(), self.b.get_value()

        def desenha_regiao():
            vertices = plano.regiao(*valores())
            if len(vertices) < 3:
                return VMobject()
            return Polygon(*[plano.p(*v) for v in vertices], fill_color=REGIAO, fill_opacity=1, stroke_width=0)

        def desenha_reta():
            corda = plano.corda(*valores())
            if corda is None:
                return VMobject()
            return Line(plano.p(*corda[0]), plano.p(*corda[1]), color=ESCURO, stroke_width=5)

        def desenha_seta():
            seta = plano.seta(*valores(), self.s.get_value())
            if seta is None or self.opac.get_value() < 0.01:
                return VMobject()
            return Arrow(plano.p(*seta[0]), plano.p(*seta[1]), buff=0, color=AZUL, stroke_width=7,
                         max_tip_length_to_length_ratio=0.3, max_stroke_width_to_length_ratio=12
                         ).set_opacity(self.opac.get_value())

        self.area, self.linha, self.seta = (always_redraw(desenha_regiao), always_redraw(desenha_reta),
                                            always_redraw(desenha_seta))

        self.marcadores = []
        for (a, c), t in zip(X_E, self.ALVOS):
            if t == 1:
                m = Circle(radius=0.21, color=AZUL, fill_opacity=1, stroke_width=0)
            else:
                m = Square(side_length=0.38, color=VERMELHO, fill_opacity=1, stroke_width=0)
            self.marcadores.append(m.move_to(plano.p(a, c)))

        # ------------------------------------------------ a legenda, em cima do plano e fora dele
        def item(icone, rotulo):
            return VGroup(icone, texto(rotulo, 26, TEXTO)).arrange(RIGHT, buff=0.14)
        self.legenda = VGroup(
            item(Circle(radius=0.12, color=AZUL, fill_opacity=1, stroke_width=0), "resposta 1"),
            item(Square(side_length=0.22, color=VERMELHO, fill_opacity=1, stroke_width=0), "resposta 0"),
            item(Square(side_length=0.26, color=REGIAO, fill_opacity=1, stroke_width=0), "dispara"),
            item(Arrow(LEFT * 0.25, RIGHT * 0.25, buff=0, color=AZUL, stroke_width=6), "o vetor dos pesos"),
        ).arrange_in_grid(rows=2, cols=2, buff=(0.4, 0.18), col_alignments="ll")
        self.legenda.next_to(borda, UP, buff=0.3, aligned_edge=LEFT)

    def abre(self):
        """Desenha o plano, os pontos e a legenda."""
        self.add(self.area, self.linha, self.seta)
        self.play(Create(self.borda), Create(self.tracos), Write(self.numeros), run_time=1.3)
        self.play(LaggedStart(*[GrowFromCenter(m) for m in self.marcadores], lag_ratio=0.2), run_time=1)
        self.play(Write(self.legenda), run_time=1.4)

    def move_pesos(self, w, b, tempo):
        """Leva pesos e viés aos valores novos; a reta, a região e a seta andam junto, aos poucos.

        A seta aparece só depois da primeira correção que a deixa inteira dentro
        do quadrado, e aparece devagar, em vez de surgir no meio do caminho.
        """
        s_novo = self.plano.melhor_s(w[0], w[1], b, X_E)
        anims = [self.w1.animate.set_value(w[0]), self.w2.animate.set_value(w[1]), self.b.animate.set_value(b)]
        if s_novo is not None:
            if self.opac.get_value() < 0.01:
                self.s.set_value(s_novo)                 # a seta ainda não apareceu: começa já no lugar certo
            else:
                anims.append(self.s.animate.set_value(s_novo))
        self.play(*anims, run_time=tempo)
        if self.opac.get_value() < 0.01 and s_novo is not None:
            self.play(self.opac.animate.set_value(1), run_time=0.5)

    def pulsa(self, k, tempo, fator=1.35):
        """Aumenta o marcador do exemplo k, para mostrar qual exemplo o neurônio está vendo."""
        self.play(self.marcadores[k].animate.scale(fator), run_time=tempo)

    def despulsa(self, k, tempo, fator=1.35):
        self.play(self.marcadores[k].animate.scale(1 / fator), run_time=tempo)


class PerceptronE(Perceptron):
    """A revisão: a regra do perceptron aprende o E, e a tabela das épocas se monta ao lado.

    À direita, o cartão das duas regras. Na primeira época, as letras das regras
    viram os números do exemplo, pedaço por pedaço, e a conta fica escrita
    embaixo; na segunda, a conta entra escrita, mais depressa. Da terceira em
    diante, a conta sai e fica a tabela das épocas, a do perceptron.py da aula 1:
    quantos erros e os pesos no fim de cada época. Termina na sexta, sem erro.
    """

    def construct(self):
        self.monta()
        passos = treino(T_E)

        # ------------------------------------------------ as duas regras, em pedaços, para as letras virarem números
        regra_w = eq(r"\vec{w}", r"\leftarrow", r"\vec{w}", "+", r"\eta", r"\,(t - y)\,", r"\vec{x}", tamanho=50)
        regra_b = eq("b", r"\leftarrow", "b", "+", r"\eta", r"\,(t - y)", tamanho=50)
        regras = VGroup(regra_w, regra_b).arrange(DOWN, buff=0.3)
        cartao = RoundedRectangle(corner_radius=0.18, width=6.15, height=regras.height + 0.6,
                                  fill_color=CARTAO, fill_opacity=1, stroke_color=BORDA, stroke_width=2)
        cartao.move_to(np.array([3.775, 3.75 - cartao.height / 2, 0]))
        regras.move_to(cartao)
        X0 = 0.7                                         # a margem esquerda da coluna da direita
        subtitulo = frase("com", "$\\eta = 1$", "e tudo começando em zero", tamanho=26, cor=SUAVE)
        subtitulo.move_to(np.array([X0, cartao.get_bottom()[1] - 0.42, 0]), aligned_edge=LEFT)

        # seis lugares fixos para as linhas da conta, um embaixo do outro, alinhados pela esquerda
        lugares = [np.array([X0, y, 0.0]) for y in (0.75, 0.0, -0.75, -1.5, -2.25, -3.0)]
        atuais = [None] * len(lugares)

        def poe(trocas, tempo):
            """Troca o conteúdo dos lugares pedidos; None deixa o lugar vazio.

            Primeiro sai o que estava, depois o novo entra escrito: saindo e entrando
            juntos, os dois ficariam um instante um por cima do outro.
            """
            saidas = [FadeOut(atuais[i]) for i, _ in trocas if atuais[i] is not None]
            if saidas:
                self.play(*saidas, run_time=min(0.25, tempo * 0.5))
            entradas = []
            for i, novo in trocas:
                if novo is not None:
                    novo.move_to(lugares[i], aligned_edge=LEFT)
                    entradas.append(Write(novo))
                atuais[i] = novo
            if entradas:
                self.play(*entradas, run_time=tempo)

        def substitui(regra, numerica, pares, resto, lugar, tempo):
            """As letras da regra viram os números: cada pedaço da regra voa para o pedaço correspondente da conta."""
            numerica.move_to(lugares[lugar], aligned_edge=LEFT)
            self.play(*[TransformFromCopy(regra[i], numerica[j]) for i, j in pares], run_time=1.4)
            self.play(Write(VGroup(*[numerica[j] for j in resto])), run_time=tempo)
            atuais[lugar] = numerica

        # ------------------------------------------------ a tabela das épocas, que substitui a conta da terceira em diante
        colunas = [1.3, 2.8, 4.6, 6.2]
        y_cabeca, y_linhas = 0.75, [0.05 - 0.62 * i for i in range(6)]
        cabeca = VGroup(texto("época", 30, SUAVE), texto("erros", 30, SUAVE), eq(r"\vec{w}", tamanho=40, cor=SUAVE),
                        eq("b", tamanho=40, cor=SUAVE))
        for c, m in zip(colunas, cabeca):
            m.move_to(np.array([c, y_cabeca, 0]))
        fio = Line(np.array([X0, y_cabeca - 0.36, 0]), np.array([6.85, y_cabeca - 0.36, 0]), color=BORDA,
                   stroke_width=2)
        fins = {}                                        # os pesos e os erros no fim de cada época
        for p in passos:
            fins[p["epoca"]] = p

        def celulas(epoca):
            f = fins[epoca]
            cor = LARANJA if f["erros"] else AZUL
            itens = [eq(str(epoca), tamanho=40), eq(str(f["erros"]), tamanho=40, cor=cor),
                     eq(vetor(f["w"]), tamanho=40), eq(n(f["b"]), tamanho=40)]
            for c, m in zip(colunas, itens):
                m.move_to(np.array([c, y_linhas[epoca - 1], 0]))
            return itens

        # ------------------------------------------------ a abertura
        self.abre()
        self.play(Create(cartao), run_time=0.6)
        self.play(Write(regras), run_time=1.6)
        self.play(Write(subtitulo), run_time=1.1)
        self.wait(0.8)

        # ------------------------------------------------ as duas primeiras épocas, exemplo por exemplo, com a conta
        tabela_aberta = False
        for p in passos:
            x = np.array(X_E[p["k"]])
            erro = p["t"] - p["y"]
            if p["epoca"] <= 2:
                tempo = 0.55 if p["epoca"] == 1 else 0.4
                poe([(0, texto(f"Época {p['epoca']}, exemplo {p['k'] + 1} de 4", 34, ESCURO, "SEMIBOLD")),
                     (1, eq(rf"\vec{{x}} = {vetor(x)} \qquad t = {p['t']}", tamanho=42)),
                     (2, None), (3, None), (4, None), (5, None)], tempo)
                self.pulsa(p["k"], tempo)
                poe([(2, eq(rf"z = {vetor(p['w_antes'])}\cdot{vetor(x)} + ({n(p['b_antes'])}) = {n(p['z'])}",
                            tamanho=42))], tempo)
                if erro == 0:
                    poe([(3, eq(rf"y = {p['y']}:\ \text{{acertou, nada muda}}", tamanho=42, cor=AZUL))], tempo)
                    self.wait(1.0 if p["epoca"] == 1 else 0.5)
                else:
                    poe([(3, eq(rf"y = {p['y']}:\ \text{{errou}},\ t - y = {n(erro)}", tamanho=42, cor=LARANJA))],
                        tempo)
                    self.play(cartao.animate.set_stroke(LARANJA, width=5), regras.animate.set_color(LARANJA),
                              run_time=tempo)
                    conta_w = eq(r"\vec{w}", r"\leftarrow", vetor(p["w_antes"]), "+", "1", rf"\cdot({n(erro)})\cdot",
                                 vetor(x), "=", vetor(p["w"]), tamanho=38)
                    conta_b = eq("b", r"\leftarrow", n(p["b_antes"]), "+", "1", rf"\cdot({n(erro)})", "=", n(p["b"]),
                                 tamanho=38)
                    if p["epoca"] == 1:
                        substitui(regra_w, conta_w, [(i, i) for i in range(7)], [7, 8], 4, tempo)
                        substitui(regra_b, conta_b, [(i, i) for i in range(6)], [6, 7], 5, tempo)
                    else:
                        poe([(4, conta_w), (5, conta_b)], tempo)
                    self.move_pesos(p["w"], p["b"], 1.6 if p["epoca"] == 1 else 1.1)
                    self.play(cartao.animate.set_stroke(BORDA, width=2), regras.animate.set_color(ESCURO),
                              run_time=0.3)
                    self.wait(0.8 if p["epoca"] == 1 else 0.4)
                self.despulsa(p["k"], tempo * 0.6)
                continue

            # ------------------------------------------------ da terceira época em diante: a tabela
            if not tabela_aberta:
                poe([(i, None) for i in range(6)], 0.4)
                self.play(Write(cabeca), Create(fio), run_time=1.0)
                self.play(*[Write(VGroup(*celulas(e))) for e in (1, 2)], run_time=1.2)
                self.wait(0.6)
                tabela_aberta = True
            if p["k"] == 0:
                linha = celulas(p["epoca"])
                self.play(Write(linha[0]), run_time=0.35)
            self.pulsa(p["k"], 0.18)
            if erro != 0:
                self.play(cartao.animate.set_stroke(LARANJA, width=5), regras.animate.set_color(LARANJA),
                          run_time=0.15)
                self.move_pesos(p["w"], p["b"], 0.7)
                self.play(cartao.animate.set_stroke(BORDA, width=2), regras.animate.set_color(ESCURO),
                          run_time=0.15)
            self.despulsa(p["k"], 0.14)
            if p["k"] == 3:
                self.play(Write(VGroup(*linha[1:])), run_time=0.6)
                self.wait(0.3)

        # ------------------------------------------------ a última época passou sem erro
        ultima = passos[-1]["epoca"]
        destaque = SurroundingRectangle(VGroup(*linha), color=AZUL, buff=0.14, corner_radius=0.1, stroke_width=3)
        fim = frase(f"Época {ultima}: nenhum erro.", tamanho=30, cor=AZUL)
        fim.move_to(subtitulo, aligned_edge=LEFT)
        self.play(Create(destaque), FadeOut(subtitulo), run_time=0.8)
        self.play(Write(fim), run_time=1.3)
        self.play(Indicate(self.marcadores[3], color=AZUL, scale_factor=1.3), run_time=1.2)
        self.wait(4)


class PerceptronXOR(Perceptron):
    """A mesma regra no XOR: a reta corrige e corrige, e nunca separa os pontos.

    O plano vai de −1,5 a 2,5, porque as retas do XOR passam por x₁ = −1 e por
    x₂ = −1. À direita, a época, os erros da época e os pesos; embaixo, o gráfico
    dos erros por época, que nunca chega a zero. As duas primeiras épocas vão
    devagar; da sexta em diante, bem depressa: são 30 épocas. Com tudo
    começando em zero, os pesos voltam a (−1, 0) e o viés a 0 no fim de toda
    época a partir da segunda: a regra anda em círculo.
    """

    ALVOS, LIM, MARCAS, FATOR_SETA = T_XOR, (-1.5, 2.5), (-1, 0, 1, 2), 0.3
    EPOCAS = 30

    def construct(self):
        self.monta()
        passos = treino(T_XOR, epocas=self.EPOCAS, para_sem_erro=False)
        X0 = 0.8
        lugar_epoca, lugar_erros, lugar_pesos = (np.array([X0, y, 0.0]) for y in (3.35, 2.6, 1.75))

        # ------------------------------------------------ o gráfico dos erros por época
        grafico = Moldura((0.3, self.EPOCAS + 0.7), (0, 4.4), 5.3, 2.9, (1.4, -2.75), [1, 10, 20, 30], [0, 2, 4],
                          texto("época", 28, SUAVE), None, tam_marca=30)
        desenho = grafico.desenho()
        nome_grafico = texto("erros por época", 28, SUAVE).next_to(grafico.caixa(), UP, buff=0.18,
                                                                    aligned_edge=LEFT)
        largura_barra = 0.62 * grafico.largura / self.EPOCAS

        def barra(epoca, erros):
            altura = erros * grafico.altura / (grafico.y_lim[1] - grafico.y_lim[0])
            r = Rectangle(width=largura_barra, height=altura, fill_color=LARANJA, fill_opacity=1, stroke_width=0)
            return r.move_to(grafico.p(epoca, 0), aligned_edge=DOWN)

        atual = {}

        def troca(chave, novo, lugar, tempo):
            """Troca um dos três textos da direita: o velho sai, o novo entra escrito no mesmo lugar."""
            if chave in atual:
                self.play(FadeOut(atual[chave]), run_time=min(0.2, tempo * 0.5))
            novo.move_to(lugar, aligned_edge=LEFT)
            self.play(Write(novo), run_time=tempo)
            atual[chave] = novo

        def pesos(w, b):
            return eq(rf"\vec{{w}} = {vetor(w)} \qquad b = {n(b)}", tamanho=44, cor=AZUL)

        # ------------------------------------------------ a abertura
        self.abre()
        troca("pesos", pesos((0, 0), 0), lugar_pesos, 1.0)
        self.play(Create(desenho[0]), Create(VGroup(*desenho[1:-3])), Write(VGroup(*desenho[-3:])),
                  Write(nome_grafico), run_time=1.5)
        self.wait(0.6)

        for p in passos:
            e, k = p["epoca"], p["k"]
            devagar, medio, rapido = e <= 2, 3 <= e <= 4, e >= 5
            if e == 5 and k == 0:
                # daqui em diante, bem depressa: os erros e os pesos mudariam rápido demais
                # para ler, e saem; o gráfico conta os erros de cada época
                self.play(FadeOut(atual.pop("erros")), FadeOut(atual.pop("pesos")), run_time=0.4)
            t_escrita = 0.5 if devagar else (0.25 if medio else 0.07)
            if k == 0:
                troca("epoca", texto(f"Época {e}", 40, ESCURO, "SEMIBOLD"), lugar_epoca, t_escrita)
                if not rapido:
                    troca("erros", texto("erros nesta época: 0", 32, TEXTO), lugar_erros, t_escrita)
            if not rapido:
                self.pulsa(k, 0.3 if devagar else 0.15)
            if p["t"] != p["y"]:
                self.move_pesos(p["w"], p["b"], 1.1 if devagar else (0.55 if medio else (0.16 if e <= 10 else 0.11)))
                if not rapido:
                    troca("erros", texto(f"erros nesta época: {p['erros']}", 32, TEXTO), lugar_erros, t_escrita)
                    troca("pesos", pesos(p["w"], p["b"]), lugar_pesos, t_escrita)
            elif devagar:
                self.wait(0.4)
            if not rapido:
                self.despulsa(k, 0.2 if devagar else 0.1)
            if k == 3:
                self.play(GrowFromEdge(barra(e, p["erros"]), DOWN), run_time=0.6 if devagar else (0.25 if medio
                          else 0.1))

        # ------------------------------------------------ 30 épocas, e nenhuma sem erro
        self.play(FadeOut(atual["epoca"]), run_time=0.4)
        fim_1 = texto(f"Época {self.EPOCAS}: ainda 4 erros.", 38, LARANJA, "SEMIBOLD")
        fim_2 = texto("Nenhuma reta separa o XOR.", 32, TEXTO)
        fim_1.move_to(lugar_epoca, aligned_edge=LEFT)
        fim_2.move_to(lugar_erros, aligned_edge=LEFT)
        ultimo = passos[-1]
        fim_3 = pesos(ultimo["w"], ultimo["b"]).move_to(lugar_pesos, aligned_edge=LEFT)
        fim_4 = texto("iguais no fim de toda época", 26, SUAVE)
        fim_4.next_to(fim_3, DOWN, buff=0.22, aligned_edge=LEFT)
        self.play(Write(fim_1), run_time=1.1)
        self.play(Write(fim_2), run_time=1.1)
        self.play(Write(fim_3), run_time=1.0)
        self.play(Write(fim_4), run_time=1.1)
        self.wait(4)


# ================================================================ 3. a perda como função do peso

class PerdaDeW(Scene):
    """A reta gira com o peso w e, ao lado, a perda de cada w desenha uma curva com um fundo.

    À esquerda, os 20 pontos de reta.py, a reta y = w x + b e o erro de cada
    ponto, em segmento laranja. O viés fica parado no melhor valor, 0,967, e só
    w muda: de 0,2 a 4, com a perda escrita e o ponto correspondente andando no
    gráfico da direita, que vai desenhando a curva L(w). Depois o ponto volta ao
    fundo da curva, e a reta do fundo é a que melhor passa pelos pontos.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        x, t = dados()
        w_mq, b_mq = minimos_quadrados(x, t)

        def L(w):
            return perda(w, b_mq, x, t)

        g1 = Moldura((0, 2.1), (0, 6), 5.3, 4.6, (-6.0, -2.45), [0, 1, 2], [0, 2, 4, 6], "x", "t")
        g2 = Moldura((0, 4.2), (0, 5.5), 5.3, 4.6, (1.45, -2.45), [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], "w", "L(w)")
        d1, d2 = g1.desenho(), g2.desenho()

        w, alcance = ValueTracker(0.2), ValueTracker(0.2001)

        def reta():
            a, c = g1.reta(0, b_mq, w.get_value())
            return Line(a, c, color=ESCURO, stroke_width=5)

        def erros():
            """O erro de cada ponto: o segmento vertical do ponto até a reta, cortado na moldura."""
            grupo = VGroup()
            for xi, ti in zip(x, t):
                yi = np.clip(w.get_value() * xi + b_mq, 0, 6)
                if abs(yi - ti) > 1e-3:
                    grupo.add(Line(g1.p(xi, ti), g1.p(xi, yi), color=LARANJA, stroke_width=3.5))
            return grupo

        def curva():
            return g2.curva(L, 0.2, max(alcance.get_value(), 0.21), pontos=200)

        def ponto():
            return Dot(g2.p(w.get_value(), L(w.get_value())), radius=0.11, color=LARANJA)

        linha, segmentos, tracado, bolinha = (always_redraw(reta), always_redraw(erros), always_redraw(curva),
                                              always_redraw(ponto))
        pontos = VGroup(*[Dot(g1.p(xi, ti), radius=0.075, color=AZUL) for xi, ti in zip(x, t)])

        # os números em cima de cada gráfico, fora dos dados
        valor_w = Numero(0.2, num_decimal_places=2, font_size=44, color=ESCURO)
        valor_l = Numero(L(0.2), num_decimal_places=3, font_size=44, color=LARANJA)
        rotulo_w = VGroup(eq("w =", tamanho=44), valor_w).arrange(RIGHT, buff=0.18)
        rotulo_l = VGroup(eq("L =", tamanho=44, cor=LARANJA), valor_l).arrange(RIGHT, buff=0.18)
        rotulo_w.move_to(g1.caixa().get_top() + UP * 0.5)
        rotulo_l.move_to(g2.caixa().get_top() + UP * 0.5)
        valor_w.add_updater(lambda d: d.set_value(w.get_value()))
        valor_l.add_updater(lambda d: d.set_value(L(w.get_value())))
        cima = np.array([0, 3.45, 0])
        aviso = frase("o viés fica parado em", "$b = 0{,}967;$", "só o peso", "$w$", "muda", tamanho=32, cor=SUAVE)
        aviso.move_to(cima)

        self.play(Create(d1[0]), Create(d2[0]), Create(VGroup(*d1[1:-4], *d2[1:-4])),
                  Write(VGroup(*d1[-4:], *d2[-4:])), run_time=1.8)
        self.play(LaggedStart(*[GrowFromCenter(p) for p in pontos], lag_ratio=0.06), run_time=1.3)
        self.play(Write(aviso), run_time=1.4)
        self.play(Create(linha), run_time=0.8)
        self.add(linha)
        self.play(Create(segmentos), run_time=1.0)
        self.add(segmentos, linha)
        self.bring_to_front(pontos)
        self.play(Write(rotulo_w), Write(rotulo_l), run_time=1.2)
        self.play(GrowFromCenter(bolinha), run_time=0.5)
        self.add(tracado, bolinha)
        self.wait(1.0)

        # w anda de 0,2 a 4: a reta gira, os erros mudam, e a curva se desenha
        self.play(w.animate.set_value(4.0), alcance.animate.set_value(4.0), run_time=8, rate_func=lambda u: u)
        self.wait(1.0)
        # e volta ao fundo, pela curva já desenhada
        self.play(w.animate.set_value(w_mq), run_time=3.5)
        rotulo_fundo = texto("o fundo", 30, LARANJA).move_to(g2.p(w_mq, 1.0))
        self.play(Write(rotulo_fundo), run_time=0.8)
        valor_w.clear_updaters()
        valor_l.clear_updaters()
        self.play(FadeOut(aviso), run_time=0.5)
        final = frase("No fundo da curva, a melhor reta:", "$w = 2{,}056$", tamanho=32, cor=ESCURO).move_to(cima)
        self.play(Write(final), run_time=1.5)
        self.wait(4)


# ================================================================ 4. a derivada

class Derivada(MovingCameraScene):
    """A secante de x² a partir de x = 1 gira até a tangente quando h encolhe; depois, a câmera chega perto.

    À esquerda, o gráfico, com o degrau da secante: a perna azul é h, a variação
    da entrada, e a laranja é f(1 + h) − f(1), a variação da saída. À direita, a
    razão entre as duas, com h e a inclinação escritos e mudando junto com o
    desenho: 3; 2,5; 2,1; 2,01. Com h = 0,01, o degrau é pequeno demais para se
    ver, e a câmera se aproxima 200 vezes do ponto (1, 1): de perto, a curva
    vira uma reta, o degrau aparece, e ele anda 0,01 e sobe 0,0201. Na volta,
    a tangente, de inclinação 2, e o limite.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        quadro = self.camera.frame
        largura0, centro0 = quadro.width, quadro.get_center().copy()

        def escala():
            """Quanto a câmera está perto: 1 no começo, 0,005 no fundo do zoom."""
            return quadro.width / largura0

        g = Moldura((-0.6, 2.4), (-1, 5.5), 5.6, 6.2, (-5.0, -3.0), [0, 1, 2], [0, 1, 2, 3, 4, 5], "x", "f(x)")
        eixos = g.desenho()

        def f(v):
            return v ** 2

        curva = g.curva(f, -0.6, 2.4, pontos=400)
        X0 = 1.1
        nome = eq("f(x) = x^2", tamanho=50).move_to(np.array([X0, 3.0, 0]), aligned_edge=LEFT)
        h = ValueTracker(1.0)

        def secante():
            a, c = g.reta(1, 1, 2 + h.get_value())
            return DashedLine(a, c, color=CINZA, stroke_width=4, dash_length=0.12)

        def perna_h():
            return Line(g.p(1, 1), g.p(1 + h.get_value(), 1), color=AZUL, stroke_width=6 * escala())

        def perna_f():
            v = h.get_value()
            return Line(g.p(1 + v, 1), g.p(1 + v, f(1 + v)), color=LARANJA, stroke_width=6 * escala())

        def ponto_q():
            v = h.get_value()
            return Dot(g.p(1 + v, f(1 + v)), radius=0.09 * escala(), color=ESCURO)

        p = Dot(g.p(1, 1), radius=0.1, color=ESCURO)
        p.add_updater(lambda d: d.scale_to_fit_width(0.2 * escala()).move_to(g.p(1, 1)))
        sec, ph, pf, q = (always_redraw(secante), always_redraw(perna_h), always_redraw(perna_f),
                          always_redraw(ponto_q))

        # à direita, a razão, com o numerador em laranja e o denominador em azul, como as pernas
        razao = eq(r"\frac{f(1 + h) - f(1)}{h}", tamanho=62)
        colore_fracao(razao, LARANJA, AZUL)
        razao.move_to(np.array([X0, 1.45, 0]), aligned_edge=LEFT)
        val_h = Numero(1.0, num_decimal_places=2, font_size=50, color=AZUL)
        val_i = Numero(3.0, num_decimal_places=2, font_size=50, color=ESCURO)
        linha_h = VGroup(eq("h =", tamanho=50, cor=AZUL), val_h).arrange(RIGHT, buff=0.2)
        linha_h.move_to(np.array([X0, -0.05, 0]), aligned_edge=LEFT)
        linha_i = VGroup(texto("inclinação =", 36, ESCURO), val_i).arrange(RIGHT, buff=0.2)
        linha_i.move_to(np.array([X0, -1.0, 0]), aligned_edge=LEFT)
        val_h.add_updater(lambda d: d.set_value(h.get_value()))
        val_i.add_updater(lambda d: d.set_value(2 + h.get_value()))

        self.play(Create(eixos[0]), Create(VGroup(*eixos[1:-4])), Write(VGroup(*eixos[-4:])), run_time=1.6)
        self.play(Create(curva), Write(nome), run_time=1.6)
        self.play(GrowFromCenter(p), run_time=0.5)
        self.play(Create(ph), Create(pf), GrowFromCenter(q), run_time=1)
        self.add(ph, pf, q)
        self.play(Create(sec), run_time=1)
        self.add(sec, p, q)
        self.play(Write(razao), run_time=1.5)
        self.play(Write(linha_h), Write(linha_i), run_time=1.4)
        self.wait(1.5)
        for alvo in (0.5, 0.1, 0.01):
            self.play(h.animate.set_value(alvo), run_time=2.4)
            self.wait(1.2)
        val_h.clear_updaters()
        val_i.clear_updaters()

        # ------------------------------------------------ de perto: a câmera se aproxima 200 vezes do ponto (1, 1)
        # O zoom é exponencial, com a mesma rapidez do começo ao fim, e o ponto (1, 1)
        # chega aos poucos ao centro da tela. A linha tracejada sai antes: de perto, os
        # tracinhos ficariam maiores que a tela.
        alvo = g.p(1.005, 1.0101)
        u = ValueTracker(0.0)
        K = 0.005

        # Neste renderizador, a espessura do traço cresce com o zoom: cada linha visível
        # afina na mesma proporção, para continuar com a espessura de antes na tela.
        finas = [(m, m.get_stroke_width()) for m in [*eixos.family_members_with_points(), curva]
                 if m.get_stroke_width() > 0]

        def acompanha(fr):
            k = K ** u.get_value()
            fr.set(width=largura0 * k)
            fr.move_to(alvo + (centro0 - alvo) * k * (1 - smooth(u.get_value())))
            for m, largura in finas:
                m.set_stroke(width=largura * k)

        self.play(FadeOut(sec), run_time=0.6)
        self.add(quadro)                                 # fora da cena, o quadro não roda o updater
        quadro.add_updater(acompanha)
        self.play(u.animate.set_value(1.0), run_time=5, rate_func=smooth)

        def perto(mob, onde):
            """Um texto no tamanho de quem está de perto: encolhido pelo zoom e posto na tela de agora."""
            return mob.scale(escala()).move_to(quadro.get_center() + onde * escala())

        leg_h = perto(eq("0{,}01", tamanho=48, cor=AZUL), np.array([0, 0, 0]))
        leg_h.next_to(g.p(1.005, 1), DOWN, buff=0.25 * escala())
        leg_f = perto(eq("0{,}0201", tamanho=48, cor=LARANJA), np.array([0, 0, 0]))
        leg_f.next_to(g.p(1.01, 1.01005), RIGHT, buff=0.25 * escala())
        conta = perto(eq(r"\frac{0{,}0201}{0{,}01} = 2{,}01", tamanho=56), np.array([-3.6, 2.4, 0]))
        aviso = VGroup(texto("de perto, a curva", 36, TEXTO), texto("é quase uma reta", 36, TEXTO)
                       ).arrange(DOWN, aligned_edge=LEFT, buff=0.18)
        aviso = perto(aviso, np.array([4.5, -3.0, 0]))

        def escreve(*mobs, tempo):
            """Write de perto: o traço provisório da escrita encolhe junto com o zoom."""
            self.play(*[Write(m, stroke_width=2 * escala()) for m in mobs], run_time=tempo)
        escreve(aviso, tempo=1.3)
        escreve(leg_h, leg_f, tempo=1.3)
        escreve(conta, tempo=1.5)
        self.wait(2.5)
        self.play(FadeOut(aviso), FadeOut(leg_h), FadeOut(leg_f), FadeOut(conta), run_time=0.6)
        self.play(u.animate.set_value(0.0), run_time=4, rate_func=smooth)
        quadro.clear_updaters()

        # ------------------------------------------------ a tangente: a secante no limite, quando h tende a zero
        a, c = g.reta(1, 1, 2)
        tangente = Line(a, c, color=VERMELHO, stroke_width=6)
        self.play(FadeOut(ph), FadeOut(pf), FadeOut(q), FadeOut(razao), FadeOut(linha_h), FadeOut(linha_i),
                  run_time=0.8)
        self.play(Create(tangente), run_time=1.3)
        self.add(p)
        limite = eq(r"f'(1) = \lim_{h \to 0} \frac{f(1 + h) - f(1)}{h} = 2", tamanho=40)
        limite.move_to(np.array([X0, 1.0, 0]), aligned_edge=LEFT)
        legenda_t = VGroup(Line(LEFT * 0.35, RIGHT * 0.35, color=VERMELHO, stroke_width=6),
                           texto("a tangente", 34, ESCURO)).arrange(RIGHT, buff=0.2)
        legenda_t.move_to(np.array([X0, -0.6, 0]), aligned_edge=LEFT)
        self.play(Write(limite), run_time=2)
        self.play(Write(legenda_t), run_time=1.3)
        self.wait(4)


# ================================================================ 5. as derivadas parciais, em 3D

def eixos_da_perda():
    """Os eixos 3D da perda da reta: w de −0,6 a 4,2, b de −1,2 a 3,2 e L de 0 a 24."""
    return ThreeDAxes(x_range=[-0.6, 4.2, 1], y_range=[-1.2, 3.2, 1], z_range=[0, 24, 4],
                      x_length=6.0, y_length=5.5, z_length=3.6,
                      axis_config=dict(color=ESCURO, stroke_width=2, include_tip=False))


def chao(eixos, marcas=True):
    """A moldura do chão, o plano (w, b), com as marcas e os números por fora, para a vista de cima.

    O chão é o retângulo de w entre −0,6 e 4,2 e b entre −1,2 e 3,2. Vista de
    cima, a moldura faz o papel dos eixos: os números ficam fora dela e não
    caem em cima das curvas de nível.
    """
    cantos = [eixos.c2p(-0.6, -1.2, 0), eixos.c2p(4.2, -1.2, 0), eixos.c2p(4.2, 3.2, 0), eixos.c2p(-0.6, 3.2, 0)]
    borda = Polygon(*cantos, stroke_color=ESCURO, stroke_width=2.5, fill_opacity=0)
    tracos, numeros = VGroup(), VGroup()
    if marcas:
        for v in range(0, 5):
            base = eixos.c2p(v, -1.2, 0)
            tracos.add(Line(base, eixos.c2p(v, -1.05, 0), color=ESCURO, stroke_width=2.5))
            numeros.add(eq(n(v), tamanho=36, cor=TEXTO).next_to(base, DOWN, buff=0.14))
        for v in range(-1, 4):
            base = eixos.c2p(-0.6, v, 0)
            tracos.add(Line(base, eixos.c2p(-0.45, v, 0), color=ESCURO, stroke_width=2.5))
            numeros.add(eq(n(v), tamanho=36, cor=TEXTO).next_to(base, LEFT, buff=0.14))
    nomes = VGroup(eq("w", tamanho=40).next_to(VGroup(borda, numeros), DOWN, buff=0.2),
                   eq("b", tamanho=40).next_to(VGroup(borda, numeros), LEFT, buff=0.25))
    return borda, tracos, VGroup(numeros, nomes)


def curvas_de_nivel(eixos, x, t, niveis):
    """As curvas de perda constante, as elipses em volta do mínimo, cortadas no chão, em pedaços contínuos.

    A perda da reta é uma forma quadrática em (w, b): L = L_min + ½ dᵀ H d, com d
    a distância ao mínimo e H a hessiana, a tabela das derivadas segundas. Cada
    curva de nível é então uma elipse, com os eixos nas direções dos autovetores
    de H.
    """
    w_mq, b_mq = minimos_quadrados(x, t)
    H = (2 / len(x)) * np.array([[np.sum(x ** 2), np.sum(x)], [np.sum(x), len(x)]])
    lam, V = np.linalg.eigh(H)
    L_min = perda(w_mq, b_mq, x, t)
    grupo = VGroup()
    for nivel in niveis:
        r = np.sqrt(2 * (nivel - L_min))
        th = np.linspace(0, 2 * np.pi, 600)
        ws = w_mq + r * (V[0, 0] * np.cos(th) / np.sqrt(lam[0]) + V[0, 1] * np.sin(th) / np.sqrt(lam[1]))
        bs = b_mq + r * (V[1, 0] * np.cos(th) / np.sqrt(lam[0]) + V[1, 1] * np.sin(th) / np.sqrt(lam[1]))
        dentro = (ws > -0.6) & (ws < 4.2) & (bs > -1.2) & (bs < 3.2)
        trecho = []
        for a, c, ok in zip(ws, bs, dentro):
            if ok:
                trecho.append(eixos.c2p(a, c, 0))
            elif len(trecho) > 1:
                grupo.add(VMobject(stroke_color=CINZA, stroke_width=3).set_points_smoothly(trecho))
                trecho = []
        if len(trecho) > 1:
            grupo.add(VMobject(stroke_color=CINZA, stroke_width=3).set_points_smoothly(trecho))
    return grupo


def trecho_ate(eixos, f, u_de, u_ate, teto=23.5):
    """Os valores de u entre u_de e u_ate em que f(u) fica abaixo do teto do gráfico, o maior pedaço contínuo."""
    us = np.linspace(u_de, u_ate, 400)
    ok = np.array([f(u) <= teto for u in us])
    melhor, atual = (0, 0), None
    for i, v in enumerate(ok):
        if v and atual is None:
            atual = i
        if (not v or i == len(ok) - 1) and atual is not None:
            fim = i if v else i - 1
            if fim - atual > melhor[1] - melhor[0]:
                melhor = (atual, fim)
            atual = None
    return us[melhor[0]], us[melhor[1]]


class Parcial(ThreeDScene):
    """As derivadas parciais como dois cortes na superfície da perda, e o gradiente que junta as duas.

    A superfície é L(w, b) para os 20 pontos de reta.py, e o ponto P é
    (w, b) = (0,5; −0,3), o mesmo do slide da derivada parcial. Primeiro, um
    plano com b parado em −0,3 corta a superfície: o corte é uma parábola em w,
    e a inclinação da tangente a ela em P é ∂L/∂w = −5,66. Depois, o plano com
    w parado em 0,5: a parábola em b, com ∂L/∂b = −5,36. No fim, a câmera sobe,
    e as duas inclinações viram as duas componentes do gradiente, no chão, com
    as curvas de nível: o gradiente sai da curva em ângulo reto, e descer é
    andar contra ele.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        x, t = dados()
        eixos = eixos_da_perda()
        W0, B0 = 0.5, -0.3

        def L(w, b):
            return perda(w, b, x, t)

        L0 = L(W0, B0)
        dw, db = gradiente(W0, B0, x, t)
        superficie = Surface(lambda u, v: eixos.c2p(u, v, L(u, v)), u_range=[-0.6, 4.2], v_range=[-1.2, 3.2],
                             resolution=(24, 24), fill_opacity=0.55, stroke_width=0.3, stroke_color=BORDA,
                             checkerboard_colors=["#7FA6CF", "#6E97C4"])
        self.set_camera_orientation(phi=66 * DEGREES, theta=-72 * DEGREES, zoom=0.92,
                                    frame_center=eixos.c2p(1.8, 1.0, 12))
        rotulos = VGroup(eq("w", tamanho=40).move_to(eixos.c2p(4.75, -1.2, 0)),
                         eq("b", tamanho=40).move_to(eixos.c2p(-0.6, 3.75, 0)),
                         eq("L", tamanho=40).move_to(eixos.c2p(-0.6, -1.2, 26.5)))
        self.add_fixed_orientation_mobjects(*rotulos)
        self.remove(*rotulos)

        # os textos fixos na tela: a frase do que se vê, no alto à esquerda, e a conta, no alto à direita,
        # onde a superfície não chega nas duas vistas
        canto_frase = np.array([-6.7, 3.45, 0])
        canto_conta = np.array([6.8, 3.3, 0])
        atual = {}

        def fixa(chave, novo, onde, alinhamento, tempo=1.2):
            """Troca um texto fixo na tela: o velho sai, o novo entra escrito."""
            if chave in atual:
                self.play(FadeOut(atual[chave]), run_time=0.4)
            novo.move_to(onde, aligned_edge=alinhamento)
            self.add_fixed_in_frame_mobjects(novo)
            self.remove(novo)
            self.play(Write(novo), run_time=tempo)
            atual[chave] = novo

        self.play(Create(eixos), Write(rotulos), run_time=1.6)
        self.play(Create(superficie), run_time=2.5)
        fixa("frase", frase("a altura é a perda de cada par", "$(w,\\ b)$", tamanho=32), canto_frase, LEFT)
        P = Dot3D(eixos.c2p(W0, B0, L0), radius=0.1, color=ESCURO)
        haste = DashedLine(eixos.c2p(W0, B0, 0), eixos.c2p(W0, B0, L0), color=ESCURO, stroke_width=3,
                           dash_length=0.1)
        self.play(Create(haste), GrowFromCenter(P), run_time=1.0)
        fixa("conta", eq(rf"P = (0{{,}}5;\ -0{{,}}3), \quad L = {br(L0)}", tamanho=40), canto_conta, RIGHT)
        self.wait(1.0)

        def corte(fixo_em_b, cor):
            """O plano de corte, a parábola que ele tira da superfície e a tangente a ela em P.

            fixo_em_b=True: o plano b = −0,3, e a parábola é L(w, −0,3), função de w.
            fixo_em_b=False: o plano w = 0,5, e a parábola é L(0,5; b), função de b.
            """
            if fixo_em_b:
                plano = Polygon(eixos.c2p(-0.6, B0, 0), eixos.c2p(4.2, B0, 0), eixos.c2p(4.2, B0, 24),
                                eixos.c2p(-0.6, B0, 24))
                u_de, u_ate = trecho_ate(eixos, lambda u: L(u, B0), -0.6, 4.2)
                parabola = ParametricFunction(lambda u: eixos.c2p(u, B0, L(u, B0)), t_range=[u_de, u_ate])
                d = 0.55
                tangente = Line(eixos.c2p(W0 - d, B0, L0 - d * dw), eixos.c2p(W0 + d, B0, L0 + d * dw))
            else:
                plano = Polygon(eixos.c2p(W0, -1.2, 0), eixos.c2p(W0, 3.2, 0), eixos.c2p(W0, 3.2, 24),
                                eixos.c2p(W0, -1.2, 24))
                u_de, u_ate = trecho_ate(eixos, lambda u: L(W0, u), -1.2, 3.2)
                parabola = ParametricFunction(lambda u: eixos.c2p(W0, u, L(W0, u)), t_range=[u_de, u_ate])
                d = 0.55
                tangente = Line(eixos.c2p(W0, B0 - d, L0 - d * db), eixos.c2p(W0, B0 + d, L0 + d * db))
            plano.set_fill(cor, opacity=0.16).set_stroke(cor, width=2)
            parabola.set_stroke(cor, width=7)
            tangente.set_stroke(ESCURO, width=6)
            return plano, parabola, tangente

        # ------------------------------------------------ o corte com b parado: a derivada parcial em w
        plano_b, parabola_b, tangente_b = corte(True, LARANJA)
        fixa("frase", frase("com", "$b$", "parado em", "$-0{,}3,$", "só", "$w$", "varia", tamanho=32, cor=LARANJA),
             canto_frase, LEFT)
        self.play(Create(plano_b), run_time=1.3)
        self.play(Create(parabola_b), run_time=1.6)
        self.play(Create(tangente_b), run_time=1.0)
        self.add(P)
        conta_w = eq(r"\frac{\partial L}{\partial w} = " + br(dw), tamanho=52, cor=LARANJA)
        fixa("conta", conta_w, canto_conta, RIGHT, 1.4)
        self.wait(2.0)

        # ------------------------------------------------ o corte com w parado: a derivada parcial em b
        self.play(FadeOut(plano_b), FadeOut(parabola_b), FadeOut(tangente_b), FadeOut(atual.pop("conta")),
                  run_time=0.8)
        self.move_camera(theta=-18 * DEGREES, run_time=2.5)
        plano_w, parabola_w, tangente_w = corte(False, AZUL)
        fixa("frase", frase("com", "$w$", "parado em", "$0{,}5,$", "só", "$b$", "varia", tamanho=32, cor=AZUL),
             canto_frase, LEFT)
        self.play(Create(plano_w), run_time=1.3)
        self.play(Create(parabola_w), run_time=1.6)
        self.play(Create(tangente_w), run_time=1.0)
        self.add(P)
        conta_b = eq(r"\frac{\partial L}{\partial b} = " + br(db), tamanho=52, cor=AZUL)
        fixa("conta", conta_b, canto_conta, RIGHT, 1.4)
        self.wait(2.0)

        # ------------------------------------------------ de cima: as duas inclinações são as componentes do gradiente
        # O chão de cima é desenhado num segundo par de eixos, à esquerda da tela: mudar
        # o centro da câmera para os lados arrastaria junto os textos fixos na tela.
        self.play(FadeOut(plano_w), FadeOut(parabola_w), FadeOut(tangente_w), FadeOut(atual.pop("frase")),
                  FadeOut(atual.pop("conta")), FadeOut(P), FadeOut(haste), FadeOut(rotulos), run_time=0.8)
        self.move_camera(phi=0, theta=-90 * DEGREES, zoom=1.0, frame_center=np.array([0.0, 0.0, 0.0]),
                         added_anims=[FadeOut(superficie), FadeOut(eixos)], run_time=2.5)
        de_cima = eixos_da_perda()
        de_cima.shift(np.array([-3.5, -0.1, 0]) - de_cima.c2p(1.8, 1.0, 0))
        borda, tracos, numeros = chao(de_cima)
        curvas = curvas_de_nivel(de_cima, x, t, (0.3, 0.8, 2, 4, L0, 12))
        self.play(Create(borda), Create(tracos), Write(numeros), run_time=1.3)
        self.play(Create(curvas), run_time=1.8)
        base = de_cima.c2p(W0, B0, 0)
        E = 0.12                                         # o gradiente mede 7,8; desenhado em 12% do tamanho

        def seta(dx, dy, cor):
            return Arrow(base, de_cima.c2p(W0 + E * dx, B0 + E * dy, 0), buff=0, color=cor, stroke_width=7,
                         max_tip_length_to_length_ratio=0.28)
        seta_w, seta_b, seta_g, seta_d = seta(dw, 0, LARANJA), seta(0, db, AZUL), seta(dw, db, ESCURO), \
            seta(-dw, -db, VERMELHO)
        marca_p = Dot(base, radius=0.08, color=ESCURO)

        # à direita, fixa na tela, a legenda das quatro setas, na ordem em que aparecem
        def item(cor, *pedacos):
            return VGroup(Arrow(LEFT * 0.3, RIGHT * 0.3, buff=0, color=cor, stroke_width=6),
                          frase(*pedacos, tamanho=30, cor=cor)).arrange(RIGHT, buff=0.22)
        itens = VGroup(item(LARANJA, "$\\partial L / \\partial w = " + br(dw) + "$"),
                       item(AZUL, "$\\partial L / \\partial b = " + br(db) + "$"),
                       item(ESCURO, "o gradiente: a subida"),
                       item(VERMELHO, "contra ele: a descida")).arrange(DOWN, aligned_edge=LEFT, buff=0.42)
        gradiente_eq = eq(r"\vec{\nabla} L = (" + br(dw) + r";\ " + br(db) + ")", tamanho=46)
        coluna = VGroup(gradiente_eq, itens).arrange(DOWN, aligned_edge=LEFT, buff=0.6)
        coluna.move_to(np.array([1.1, 0, 0]), aligned_edge=LEFT)
        for m in (gradiente_eq, *itens):
            self.add_fixed_in_frame_mobjects(m)
            self.remove(m)
        self.play(GrowFromCenter(marca_p), run_time=0.4)
        self.play(GrowArrow(seta_w), Write(itens[0]), run_time=1.1)
        self.play(GrowArrow(seta_b), Write(itens[1]), run_time=1.1)
        self.play(GrowArrow(seta_g), Write(gradiente_eq), run_time=1.4)
        self.play(Write(itens[2]), run_time=1.1)
        self.wait(1.0)
        self.play(GrowArrow(seta_d), Write(itens[3]), run_time=1.4)
        self.wait(4)


# ================================================================ 6. a descida em 3D

class Descida3D(ThreeDScene):
    """A descida na superfície da perda, com a reta se ajustando aos pontos ao lado, e no fim a mesma descida de cima.

    A superfície é L(w, b) para os 20 pontos de reta.py. Um ponto desce pelo
    gradiente, com η = 0,1, a partir de (0, 0), deixando o rastro. À direita,
    fixos na tela, os 20 pontos e a reta do passo atual, com o passo e a perda
    escritos em cima: cada ponto do chão é uma reta, e descer é a reta chegar
    aos pontos. No fim, a câmera sobe, e a mesma descida aparece vista de cima,
    sobre as curvas de nível, com a moldura do chão no lugar dos eixos.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        x, t = dados()
        eixos = eixos_da_perda()
        # A tigela fica na esquerda da tela. O centro da câmera não sai do eixo vertical,
        # porque, fora dele, o Manim arrasta junto os textos fixos na tela: quem anda é a
        # tigela, deslocada no espaço para o lado que aparece como esquerda.
        teta = -52 * DEGREES
        direita = np.array([-np.sin(teta), np.cos(teta), 0.0])      # a direção que aparece como direita na tela
        eixos.shift(-2.6 * direita - eixos.c2p(1.8, 1.0, 0) * np.array([1, 1, 0]))
        altura = eixos.c2p(1.8, 1.0, 11)[2]
        self.set_camera_orientation(phi=62 * DEGREES, theta=teta, zoom=0.9,
                                    frame_center=np.array([0.0, 0.0, altura]))

        def L(w, b):
            return perda(w, b, x, t)

        superficie = Surface(lambda u, v: eixos.c2p(u, v, L(u, v)), u_range=[-0.6, 4.2], v_range=[-1.2, 3.2],
                             resolution=(26, 26), fill_opacity=0.9, stroke_width=0.3, stroke_color=BORDA,
                             checkerboard_colors=["#7FA6CF", "#6E97C4"])

        # o caminho do gradiente descendente, com η = 0,1
        caminho = [(0.0, 0.0)]
        for _ in range(60):
            dw, db = gradiente(*caminho[-1], x, t)
            caminho.append((caminho[-1][0] - 0.1 * dw, caminho[-1][1] - 0.1 * db))
        pontos3d = [eixos.c2p(a, c, L(a, c) + 0.25) for a, c in caminho]

        regra = eq(r"(w,\ b) \leftarrow (w,\ b) - \eta\,\vec{\nabla} L", tamanho=46).to_corner(UP + LEFT, buff=0.45)
        self.add_fixed_in_frame_mobjects(regra)
        self.remove(regra)

        # ------------------------------------------------ o quadro dos dados, fixo à direita da tela
        g = Moldura((0, 2.1), (-0.5, 6), 3.6, 3.6, (2.9, -2.45), [0, 1, 2], [0, 2, 4, 6], "x", "t", tam_marca=30,
                    tam_nome=36)
        quadro_dados = g.desenho()
        pontos = VGroup(*[Dot(g.p(xi, ti), radius=0.065, color=AZUL) for xi, ti in zip(x, t)])

        def reta_do_passo(k):
            w, b = caminho[k]
            a, c = g.reta(0, b, w)
            return Line(a, c, color=LARANJA, stroke_width=5)

        def placar(k):
            """O passo e a perda, em cima do quadro dos dados; um novo a cada passo, fixo na tela."""
            linhas = VGroup(
                VGroup(texto("passo", 32, SUAVE), Numero(k, num_decimal_places=0, font_size=44, color=ESCURO)
                       ).arrange(RIGHT, buff=0.2),
                VGroup(eq("L =", tamanho=42, cor=SUAVE), Numero(L(*caminho[k]), num_decimal_places=3, font_size=44,
                                                                color=LARANJA)).arrange(RIGHT, buff=0.2))
            return linhas.arrange(RIGHT, buff=0.6).next_to(g.caixa(), UP, buff=0.45)

        for m in (quadro_dados, pontos):
            self.add_fixed_in_frame_mobjects(m)
            self.remove(m)

        self.play(Write(regra), run_time=1.4)
        rotulos = VGroup(eq("w", tamanho=40).move_to(eixos.c2p(4.75, 0, 0)),
                         eq("b", tamanho=40).move_to(eixos.c2p(0, 3.75, 0)),
                         eq("L", tamanho=40).move_to(eixos.c2p(0, 0, 26.5)))
        self.add_fixed_orientation_mobjects(*rotulos)
        self.remove(*rotulos)
        self.play(Create(eixos), Write(rotulos), run_time=1.6)
        self.play(Create(superficie), run_time=2.5)
        self.play(Create(quadro_dados[0]), Create(VGroup(*quadro_dados[1:-4])), Write(VGroup(*quadro_dados[-4:])),
                  run_time=1.4)
        self.play(LaggedStart(*[GrowFromCenter(p) for p in pontos], lag_ratio=0.05), run_time=1.0)

        atual_placar, atual_reta = placar(0), reta_do_passo(0)
        for m in (atual_placar, atual_reta):
            self.add_fixed_in_frame_mobjects(m)
            self.remove(m)
        bolinha = Dot3D(pontos3d[0], radius=0.1, color=LARANJA)
        self.play(GrowFromCenter(bolinha), Create(atual_reta), Write(atual_placar), run_time=1.2)
        self.bring_to_front(pontos)
        rastro = TracedPath(bolinha.get_center, stroke_color=LARANJA, stroke_width=6)
        self.add(rastro)
        self.wait(0.8)
        for k in range(1, len(pontos3d)):
            tempo = 0.55 if k <= 6 else (0.2 if k <= 30 else 0.09)
            novo_placar, nova_reta = placar(k), reta_do_passo(k)
            self.add_fixed_in_frame_mobjects(novo_placar, nova_reta)
            self.remove(atual_placar, atual_reta)
            self.bring_to_front(pontos)
            atual_placar, atual_reta = novo_placar, nova_reta
            self.play(bolinha.animate.move_to(pontos3d[k]), run_time=tempo)
        self.wait(1.5)

        # ------------------------------------------------ a mesma descida vista de cima
        # Saem os eixos 3D e a regra; a câmera sobe. O chão de cima é desenhado num
        # segundo par de eixos, na esquerda da tela, e o quadro dos dados fica à direita.
        self.play(FadeOut(eixos), FadeOut(rotulos), FadeOut(bolinha), FadeOut(rastro), FadeOut(regra), run_time=1)
        self.move_camera(phi=0, theta=-90 * DEGREES, zoom=0.9, frame_center=np.array([0.0, 0.0, 0.0]),
                         added_anims=[FadeOut(superficie)], run_time=2.5)
        de_cima = eixos_da_perda()
        de_cima.shift(np.array([-3.9, -0.1, 0]) - de_cima.c2p(1.8, 1.0, 0))
        borda, tracos, numeros = chao(de_cima)
        curvas = curvas_de_nivel(de_cima, x, t, (0.3, 0.8, 1.5, 4, 8))
        trilha = VMobject(stroke_color=LARANJA, stroke_width=6).set_points_as_corners(
            [de_cima.c2p(a, c, 0) for a, c in caminho])
        self.play(Create(borda), Create(tracos), Write(numeros), run_time=1.3)
        self.play(Create(curvas), run_time=2.0)
        self.play(Create(trilha), run_time=2.2)
        self.wait(4)


# ================================================================ 7. a taxa de aprendizado

class Taxa(Scene):
    """O gradiente descendente na parábola L(w) = (w − 2)², com η = 0,1, 0,9 e 1,05.

    Cada passo é uma seta que vai do ponto atual ao seguinte, sobre a curva. À
    direita, a distância até o fundo, w − 2, com o sinal, é escrita a cada
    passo: ela é multiplicada por 1 − 2η, o fator de cada taxa, e o sinal que
    troca mostra o ponto pulando de um lado do fundo para o outro. As setas de
    cada taxa saem antes da seguinte, para não se cruzarem; as da última ficam.
    No fim, a regra que separa as três: converge se |1 − 2η| < 1, isto é, se
    0 < η < 1.
    """

    CASOS = [(0.1, AZUL, "devagar"), (0.9, ESCURO, "oscila e chega"), (1.05, LARANJA, "diverge")]
    PASSOS = 3

    def construct(self):
        self.camera.background_color = FUNDO
        g = Moldura((-1.5, 5.5), (0, 12.5), 5.4, 6.2, (-5.2, -3.0), [-1, 0, 1, 2, 3, 4, 5], [0, 4, 8, 12],
                    "w", "L(w)")
        eixos = g.desenho()

        def L(w):
            return (w - 2) ** 2

        curva = g.curva(L, -1.5, 5.5, cor=CINZA)
        X0 = 0.9
        regra = eq(r"w \leftarrow w - \eta\, L'(w)", tamanho=50).move_to(np.array([X0, 3.3, 0]), aligned_edge=LEFT)
        derivada = eq(r"L'(w) = 2\,(w - 2)", tamanho=40, cor=SUAVE).next_to(regra, DOWN, aligned_edge=LEFT,
                                                                         buff=0.2)

        self.play(Create(eixos[0]), Create(VGroup(*eixos[1:-4])), Write(VGroup(*eixos[-4:])), run_time=1.5)
        self.play(Create(curva), run_time=1.2)
        self.play(Write(regra), run_time=1.4)
        self.play(Write(derivada), run_time=1.1)
        self.wait(0.8)

        blocos_y = [1.45, -0.15, -1.75]
        setas = VGroup()
        for i, ((eta, cor, nome), y0) in enumerate(zip(self.CASOS, blocos_y)):
            fator = 1 - 2 * eta
            cabeca = eq(rf"\eta = {br(eta, 2 if eta > 1 else 1)}", rf"\quad\text{{{nome}: fator }} {{{br(fator, 1)}}}",
                        tamanho=36, cor=cor)
            cabeca.move_to(np.array([X0, y0, 0]), aligned_edge=LEFT)
            self.play(Write(cabeca), run_time=1.1)
            w = 0.0
            ponto = Dot(g.p(w, L(w)), radius=0.11, color=cor)
            self.play(GrowFromCenter(ponto), run_time=0.4)
            # a fileira das distâncias até o fundo, com o sinal: o rótulo à esquerda, e um número a cada passo
            rotulo_d = eq(r"w - 2{:}", tamanho=34, cor=SUAVE).move_to(np.array([X0, y0 - 0.62, 0]), aligned_edge=LEFT)
            distancias = VGroup(eq(br(w - 2, 0), tamanho=34, cor=cor)).next_to(rotulo_d, RIGHT, buff=0.25)
            self.play(Write(rotulo_d), Write(distancias[0]), run_time=0.8)
            setas = VGroup()
            for k in range(self.PASSOS):
                novo_w = w - eta * 2 * (w - 2)
                seta = Arrow(g.p(w, L(w)), g.p(novo_w, L(novo_w)), buff=0.13, color=cor,
                             stroke_width=5, max_tip_length_to_length_ratio=0.12)
                casas = 1 if abs(round((novo_w - 2) * 10) - (novo_w - 2) * 10) < 1e-9 else 2
                d = eq(br(novo_w - 2, casas), tamanho=34, cor=cor).next_to(distancias, RIGHT, buff=0.3)
                self.play(GrowArrow(seta), ponto.animate.move_to(g.p(novo_w, L(novo_w))), run_time=0.8)
                self.play(Write(d), run_time=0.45)
                distancias.add(d)
                setas.add(seta)
                w = novo_w
            self.wait(1.2)
            if i < len(self.CASOS) - 1:
                self.play(FadeOut(setas), FadeOut(ponto), run_time=0.6)

        conclusao = eq(r"|1 - 2\eta| < 1 \;\Leftrightarrow\; 0 < \eta < 1", tamanho=46, cor=ESCURO)
        conclusao.move_to(np.array([X0, -3.35, 0]), aligned_edge=LEFT)
        self.play(Write(conclusao), run_time=1.8)
        self.wait(4)


# ================================================================ a gravação

CENAS = {"perceptron-e": PerceptronE, "perceptron-xor": PerceptronXOR, "perda-de-w": PerdaDeW,
         "derivada": Derivada, "parcial": Parcial, "descida-3d": Descida3D, "taxa": Taxa}


def grava(nome, largura=1920, altura=1080, quadros=30, pasta_videos=None, pasta_quadros=None, crf=24):
    """Desenha a cena e grava o mp4 e o png do último quadro.

    O padrão é 1920 por 1080, a 30 quadros por segundo, nas pastas videos/ e
    figuras/ da aula. Uma prévia pequena, para conferir a disposição antes da
    gravação final, pede tamanho menor e outras pastas.
    O manim trabalha numa pasta temporária, uma por vídeo, dentro da pasta dos
    vídeos, apagada no fim. O mp4 sai de novo pelo ffmpeg, em H.264 com qualidade constante
    (crf 24), para ficar abaixo dos 20 MB que o deck aceita por vídeo.
    """
    pasta_videos = Path(pasta_videos or AULA / "videos")
    pasta_quadros = Path(pasta_quadros or AULA / "figuras")
    pasta_videos.mkdir(parents=True, exist_ok=True)
    trabalho = pasta_videos / f"_manim-{nome}"   # uma pasta por vídeo: gravar vários ao mesmo tempo não dá conflito
    with tempconfig({"pixel_width": largura, "pixel_height": altura, "frame_rate": quadros,
                     "media_dir": str(trabalho), "output_file": nome, "background_color": FUNDO,
                     "disable_caching": True, "progress_bar": "none", "verbosity": "WARNING",
                     "tex_template": MODELO}):
        cena = CENAS[nome]()
        cena.render()
        mp4 = Path(cena.renderer.file_writer.movie_file_path)
    destino = pasta_videos / f"{nome}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4), "-c:v", "libx264", "-crf", str(crf),
                    "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(destino)],
                   check=True)
    png = pasta_quadros / f"{nome}-quadro.png"   # -quadro: não pisar nas figuras estáticas
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-sseof", "-0.5", "-i", str(destino),
                    "-frames:v", "1", "-update", "1", str(png)], check=True)
    shutil.rmtree(trabalho, ignore_errors=True)
    for arquivo in (destino, png):
        print(f"gravado: {arquivo} ({arquivo.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")      # os nomes com acento passam também quando a saída vai para arquivo
    for nome in (sys.argv[1:] or CENAS):
        grava(nome)
