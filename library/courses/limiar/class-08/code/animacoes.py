"""Os vídeos da aula 8, feitos com o Manim Community.

Rode, a partir da raiz do repositório, com o nome dos vídeos que quer gravar, ou
sem nome nenhum para gravar todos:
    python aulas/08-dados-do-cern/codigo/animacoes.py
    python aulas/08-dados-do-cern/codigo/animacoes.py picos treino-massa

Os cinco vídeos, na ordem da aula:
    direcao           de lado e de frente: o momento transversal p_T, o η e o φ de um múon
    massa-invariante  um J/ψ se desfaz em dois múons; quando ele anda, a energia e o momento
                      de cada múon mudam, e a massa dos dois fica a mesma
    picos             do evento ao histograma: três eventos com a conta, quarenta caindo nas
                      faixas, depois 100 mil, e os picos aparecem
    compressao        o asinh(E / 5) leva a energia de 300 múons para outra linha e espalha
                      os números pequenos
    treino-massa      a massa da rede contra a da fórmula, das épocas 0 a 80: a nuvem vai
                      para a diagonal

Precisa do Manim Community (pip install manim), do MiKTeX e do ffmpeg, como os
vídeos das outras aulas. Cada vídeo sai em dois arquivos:
    aulas/08-dados-do-cern/videos/<nome>.mp4           1920 por 1080, 30 quadros por segundo, sem som
    aulas/08-dados-do-cern/figuras/<nome>-quadro.png   o último quadro, que o slide mostra parado

Uma opção grava só o último quadro, para conferir a composição: --quadros

As regras dos vídeos da aula 2 valem aqui. Sem título próprio, porque o título
está no slide; texto com pelo menos 30 pontos do Manim, equação com pelo menos
38. Todo texto entra escrito e toda forma entra desenhada. Nada se sobrepõe: cada
texto tem um lugar fixo, fora dos dados e fora do caminho dos pontos que se
movem. E nada é sorteado: os eventos são os do arquivo, na ordem dele, e a rede é
a de mlp_massa.py, com os retratos de oito épocas gravados em resultados/massa.json.
"""
import json
import math
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from manim import (DOWN, LEFT, RIGHT, UP, Arc, Arrow, Brace, Circle, Create, DashedLine, DecimalNumber, Dot,
                   FadeIn, FadeOut, GrowArrow, GrowFromCenter, Indicate, LaggedStart, Line, MathTex, Rectangle,
                   Scene, Square, Succession, SurroundingRectangle, TexTemplate, Text, Transform, TransformFromCopy,
                   ValueTracker, VGroup, Write, always_redraw, config, linear, tempconfig)
from manimpango import register_font

RAIZ = Path(__file__).resolve().parents[3]
AULA = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from dimuon import MASSA_DO_MUON, carrega  # noqa: E402

# As fontes do curso, as mesmas dos slides, guardadas em infra/fontes/ com as licenças
for arquivo in ("IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf", "SourceSerif4-Semibold.ttf"):
    register_font(str(RAIZ / "infra" / "fontes" / arquivo))
SANS = "IBM Plex Sans"

# A paleta de infra/slides.py e das figuras
FUNDO, ESCURO, TEXTO, SUAVE, CINZA = "#F6F5F1", "#14213D", "#3B4658", "#5E6A7D", "#8A94A6"
AZUL, LARANJA, CLARO = "#1F5FAD", "#A8500F", "#C9D7EA"

# As equações em STIX Two, a fonte das equações dos slides (infra/equacoes.py)
MODELO = TexTemplate(preamble="\\usepackage[T1]{fontenc}\n\\usepackage{amsmath}\n\\usepackage{stix2}\n")
config.tex_template = MODELO

JPSI = "\\mathrm{J}/\\psi"          # nome de partícula, em letra reta
MASSA_JPSI = 3.0969                 # GeV, a massa do J/ψ, a mesma do histograma e das notas


def texto(s, tamanho=30, cor=TEXTO):
    """Texto corrido, na fonte dos slides."""
    return Text(s, font=SANS, font_size=tamanho, color=cor)


def eq(*partes, tamanho=40, cor=ESCURO):
    """Equação em LaTeX; cada parte vira um pedaço separado, que se pode transformar sozinho."""
    return MathTex(*partes, font_size=tamanho, color=cor, tex_template=MODELO)


def frase(*pedacos, tamanho=30, cor=TEXTO):
    """Uma linha que mistura texto e equação. O pedaço que começa com $ é equação, um pouco maior que o texto,
    para as letras terem a mesma altura; a vírgula depois de uma equação vai dentro dela, como em "$p_T,$"."""
    partes = [eq(p.strip("$"), tamanho=round(tamanho * 1.25), cor=cor) if p.startswith("$") else texto(p, tamanho, cor)
              for p in pedacos]
    return VGroup(*partes).arrange(RIGHT, buff=0.16)


class Numero(DecimalNumber):
    """Número que muda na tela, com vírgula decimal."""

    def _get_num_string(self, number):
        return super()._get_num_string(number).replace(".", ",")


def br(v, casas=2):
    """Número decimal em LaTeX, com vírgula decimal e sem o espaço que o LaTeX põe depois da vírgula."""
    return f"{v:.{casas}f}".replace(".", "{,}")


def mil(n):
    """Número inteiro com ponto de milhar: 100.000."""
    return f"{n:,}".replace(",", ".")


def legenda(*pedacos):
    """A frase do alto do vídeo, que diz o que está acontecendo; cabe na largura com folga."""
    f = frase(*pedacos).move_to(np.array([0, 3.45, 0]))
    assert f.width < 13, pedacos
    return f


def troca(cena, atual, *pedacos):
    """Apaga a frase do alto e escreve a seguinte."""
    nova = legenda(*pedacos)
    cena.play(FadeOut(atual), run_time=0.35)
    cena.play(Write(nova), run_time=0.9)
    return nova


def unitario(graus):
    """O vetor de tamanho 1 que faz esse ângulo, em graus, com o eixo horizontal."""
    a = math.radians(graus)
    return np.array([math.cos(a), math.sin(a), 0.0])


# ================================================================ 1. a direção do múon

class Direcao(Scene):
    """De lado, o ângulo θ com o feixe, as duas partes do momento e o η; de frente, o φ."""

    def construct(self):
        self.camera.background_color = FUNDO
        O, R = np.array([-6.2, -1.8, 0.0]), 3.7        # o ponto da colisão, no painel de lado, e o tamanho da seta
        teta = ValueTracker(50.0)                      # o ângulo com o feixe, em graus

        feixe = Line(O + LEFT * 0.6, O + RIGHT * (R + 1.0), color=ESCURO, stroke_width=4)
        nome_feixe = texto("feixe", 30, SUAVE).next_to(feixe.get_end(), DOWN, buff=0.15)
        nome_feixe.align_to(feixe.get_end(), RIGHT)
        colisao = Dot(O, radius=0.09, color=ESCURO)
        lado = texto("de lado", 30, SUAVE).move_to(np.array([-4.3, -2.85, 0]))

        def seta_muon(graus):
            return Arrow(O, O + R * unitario(graus), buff=0, color=ESCURO, stroke_width=6,
                         max_tip_length_to_length_ratio=0.07, max_stroke_width_to_length_ratio=10)

        leg = legenda("De lado: o múon sai da colisão num ângulo", "$\\theta$", "com o feixe")
        self.play(Write(leg), Create(feixe), Write(nome_feixe), Write(lado), run_time=1.6)
        self.play(GrowFromCenter(colisao), run_time=0.5)
        muon = seta_muon(50)
        self.play(GrowArrow(muon), run_time=1.0)
        arco = Arc(radius=0.9, start_angle=0, angle=math.radians(50), arc_center=O, color=SUAVE, stroke_width=3)
        rot_teta = eq("\\theta", cor=SUAVE).move_to(O + 1.3 * unitario(25))
        self.play(Create(arco), Write(rot_teta), run_time=0.9)
        self.wait(1.2)

        # as duas partes do momento: ao longo do feixe e perpendicular a ele
        ponta = O + R * unitario(50)
        pe = np.array([ponta[0], O[1], 0.0])
        perna_z = Line(O, pe, color=AZUL, stroke_width=8)
        perna_t = Line(pe, ponta, color=LARANJA, stroke_width=8)
        rot_z = eq("p_z", cor=AZUL).next_to(perna_z, DOWN, buff=0.15)
        rot_t = eq("p_T", cor=LARANJA).next_to(perna_t, RIGHT, buff=0.15)
        leg = troca(self, leg, "O momento: uma parte ao longo do feixe, outra perpendicular")
        self.play(Create(perna_z), Create(perna_t), run_time=1.2)
        self.play(Write(rot_z), Write(rot_t), run_time=0.8)
        self.wait(1.8)

        # o leque das linhas de η constante, e a seta girando por ele
        leque, rot_leque = VGroup(), VGroup()
        for e in (0, 1, 2, 3):
            graus = math.degrees(2 * math.atan(math.exp(-e)))      # θ = 2 arctan(e^(−η))
            fim = O + (R + 0.35) * unitario(graus)
            leque.add(Line(O, fim, color=CINZA, stroke_width=2.5))
            rot_leque.add(eq(f"\\eta = {e}", tamanho=38, cor=SUAVE).next_to(fim, unitario(graus), buff=0.12))
        leitura = VGroup(eq("\\theta ="), Numero(50, num_decimal_places=0, font_size=40, color=ESCURO),
                         texto("graus"), eq("\\eta =").shift(RIGHT * 0.5),
                         Numero(-math.log(math.tan(math.radians(25))), num_decimal_places=2, font_size=40,
                                color=ESCURO))
        leitura.arrange(RIGHT, buff=0.18).move_to(np.array([-4.2, -3.5, 0]))
        leitura[3].shift(RIGHT * 0.5)
        leitura[4].shift(RIGHT * 0.5)
        leitura[1].add_updater(lambda m: m.set_value(teta.get_value()))
        leitura[4].add_updater(lambda m: m.set_value(-math.log(math.tan(math.radians(teta.get_value()) / 2))))
        leg = troca(self, leg, "O", "$\\eta$", "mede esse ângulo: 0 na perpendicular, e cresce perto do feixe")
        self.play(FadeOut(perna_z, perna_t, rot_z, rot_t, arco, rot_teta), run_time=0.6)
        self.play(Create(leque), Write(rot_leque), Write(leitura), run_time=1.6)
        self.remove(muon)
        muon = always_redraw(lambda: seta_muon(teta.get_value()))
        self.add(muon)
        self.play(teta.animate.set_value(90), run_time=1.4)
        self.wait(0.6)
        self.play(teta.animate.set_value(12), run_time=6, rate_func=linear)
        self.wait(1.0)

        # de frente, ao longo do feixe: o círculo do detector e o ângulo φ em volta do feixe
        C, raio, comprimento = np.array([3.7, -0.3, 0.0]), 2.2, 1.9
        fi = ValueTracker(0.9)                          # em radianos, como no arquivo
        detector = Circle(radius=raio, color=SUAVE, stroke_width=3).move_to(C)
        feixe_frente = VGroup(Circle(radius=0.16, color=ESCURO, stroke_width=4).move_to(C),
                              Dot(C, radius=0.05, color=ESCURO))
        nota_feixe = texto("o feixe sai da tela", 30, SUAVE).move_to(C + DOWN * 0.6)
        referencia = DashedLine(C, C + RIGHT * raio, color=CINZA, stroke_width=2.5)
        frente = texto("de frente", 30, SUAVE).move_to(np.array([3.7, -2.85, 0]))

        def seta_t(f):
            return Arrow(C, C + comprimento * unitario(math.degrees(f)), buff=0, color=LARANJA, stroke_width=7,
                         max_tip_length_to_length_ratio=0.14, max_stroke_width_to_length_ratio=10)

        def arco_fi(f):
            return Arc(radius=0.65, start_angle=0, angle=f, arc_center=C, color=SUAVE, stroke_width=3)

        rot_fi = eq("\\phi", cor=SUAVE)
        rot_fi.add_updater(lambda m: m.move_to(C + 1.0 * unitario(math.degrees(fi.get_value() / 2))))
        rot_pt = eq("p_T", cor=LARANJA)
        rot_pt.add_updater(lambda m: m.move_to(C + 0.95 * unitario(math.degrees(fi.get_value()))
                                               + 0.42 * unitario(math.degrees(fi.get_value()) + 90)))
        leitura_fi = VGroup(eq("\\phi ="), Numero(0.9, num_decimal_places=2, font_size=40, color=ESCURO),
                            texto("rad")).arrange(RIGHT, buff=0.18).move_to(np.array([3.7, -3.5, 0]))
        leitura_fi[1].add_updater(lambda m: m.set_value(fi.get_value()))
        leg = troca(self, leg, "De frente, ao longo do feixe: o ângulo em volta dele é o", "$\\phi$")
        self.play(Create(detector), Create(feixe_frente), Create(referencia), Write(nota_feixe), Write(frente),
                  run_time=1.6)
        seta = seta_t(0.9)
        arco2 = arco_fi(0.9)
        self.play(GrowArrow(seta), Create(arco2), run_time=1.0)
        self.play(Write(rot_fi), Write(rot_pt), Write(leitura_fi), run_time=1.0)
        self.remove(seta, arco2)
        seta = always_redraw(lambda: seta_t(fi.get_value()))
        arco2 = always_redraw(lambda: arco_fi(fi.get_value()))
        self.add(seta, arco2)
        self.play(fi.animate.set_value(2.6), run_time=3.5)
        self.wait(0.8)
        leg = troca(self, leg, "O tamanho", "$p_T$", "e os ângulos", "$\\eta$", "e", "$\\phi$",
                    "dão o momento do múon")
        self.wait(3)


# ================================================================ 2. a massa invariante

P_ESTRELA = math.sqrt(MASSA_JPSI ** 2 / 4 - MASSA_DO_MUON ** 2)    # o momento de cada múon com o J/ψ parado


def muons(P, angulo):
    """A energia e o momento (px, py) dos dois múons de um J/ψ que anda com momento P ao longo de x.

    Com o J/ψ parado, os dois múons saem em sentidos opostos, cada um com a metade
    da energia, M / 2, e momento P_ESTRELA, no ângulo pedido, em graus. Para quem
    vê o J/ψ andar, vale a transformação de Lorentz ao longo de x, com
    γ = E_J / M e βγ = P / M:
        E' = γ E + βγ p_x      p_x' = βγ E + γ p_x      p_y' = p_y
    Devolve [(E1, px1, py1), (E2, px2, py2)], em GeV.
    """
    gama, beta_gama = math.hypot(P, MASSA_JPSI) / MASSA_JPSI, P / MASSA_JPSI
    a, E = math.radians(angulo), MASSA_JPSI / 2
    saida = []
    for sinal in (1, -1):
        px, py = sinal * P_ESTRELA * math.cos(a), sinal * P_ESTRELA * math.sin(a)
        saida.append((gama * E + beta_gama * px, beta_gama * E + gama * px, py))
    return saida


class MassaInvariante(Scene):
    """Um J/ψ se desfaz em dois múons. Ele anda, os múons saem em outro ângulo, e a massa dos dois é sempre a mesma."""

    def construct(self):
        self.camera.background_color = FUNDO
        O, escala = np.array([-5.6, -0.3, 0.0]), 0.58      # o ponto do decaimento, e unidades da tela por GeV
        P, angulo = ValueTracker(0.0), ValueTracker(60.0)

        def estado():
            return muons(P.get_value(), angulo.get_value())

        def ponta(i):
            _, px, py = estado()[i]
            return O + escala * np.array([px, py, 0.0])

        def seta(i, cor):
            return Arrow(O, ponta(i), buff=0, color=cor, stroke_width=7, max_stroke_width_to_length_ratio=12)

        def soma():
            (E1, px1, py1), (E2, px2, py2) = estado()
            return E1 + E2, math.hypot(px1 + px2, py1 + py2)

        jpsi = Dot(O, radius=0.13, color=ESCURO)
        nome_jpsi = eq(JPSI).next_to(jpsi, LEFT, buff=0.25)
        leg = legenda("Um", f"${JPSI}$", "parado se desfaz em dois múons")
        self.play(Write(leg), GrowFromCenter(jpsi), Write(nome_jpsi), run_time=1.4)
        self.wait(1.0)

        seta1, seta2 = seta(0, AZUL), seta(1, LARANJA)
        rot1, rot2 = eq("\\mu^-", cor=AZUL), eq("\\mu^+", cor=LARANJA)

        def segue(rotulo, i):
            d = ponta(i) - O
            rotulo.move_to(ponta(i) + 0.42 * d / max(np.linalg.norm(d), 1e-9))

        segue(rot1, 0)
        segue(rot2, 1)
        self.play(FadeOut(jpsi, nome_jpsi), GrowArrow(seta1), GrowArrow(seta2), run_time=1.2)
        self.play(Write(rot1), Write(rot2), run_time=0.7)

        # a leitura: as duas energias, o tamanho da soma dos momentos e a massa
        linhas = VGroup()
        for i, (nome, cor) in enumerate((("E_1 =", AZUL), ("E_2 =", LARANJA), ("|\\vec{p}_1 + \\vec{p}_2| =", ESCURO))):
            valor = Numero(0, num_decimal_places=2, font_size=44, color=cor)
            linha = VGroup(eq(nome, tamanho=44, cor=cor), valor, texto("GeV")).arrange(RIGHT, buff=0.2)
            linha.move_to(np.array([0, 2.0 - 0.95 * i, 0])).align_to(np.array([0.9, 0, 0]), LEFT)
            linhas.add(linha)
        linhas[0][1].add_updater(lambda m: m.set_value(estado()[0][0]))
        linhas[1][1].add_updater(lambda m: m.set_value(estado()[1][0]))
        linhas[2][1].add_updater(lambda m: m.set_value(soma()[1]))
        massa = VGroup(eq("M =", tamanho=60), Numero(MASSA_JPSI, num_decimal_places=3, font_size=60, color=ESCURO),
                       texto("GeV", 36)).arrange(RIGHT, buff=0.22)
        massa.move_to(np.array([0, -1.15, 0])).align_to(np.array([0.9, 0, 0]), LEFT)
        massa[1].add_updater(lambda m: m.set_value(math.sqrt(soma()[0] ** 2 - soma()[1] ** 2)))
        caixa = SurroundingRectangle(massa, color=LARANJA, buff=0.22, stroke_width=4)
        formula = eq("M^2 = (E_1 + E_2)^2 - |\\vec{p}_1 + \\vec{p}_2|^2", tamanho=40, cor=SUAVE)
        formula.next_to(caixa, DOWN, buff=0.45).align_to(caixa, LEFT)
        self.play(Write(linhas), run_time=1.4)
        self.play(Write(massa), Create(caixa), run_time=1.0)
        self.play(Write(formula), run_time=1.0)
        self.wait(1.5)

        self.remove(seta1, seta2)
        seta1, seta2 = always_redraw(lambda: seta(0, AZUL)), always_redraw(lambda: seta(1, LARANJA))
        self.add(seta1, seta2)
        rot1.add_updater(lambda m: segue(m, 0))
        rot2.add_updater(lambda m: segue(m, 1))

        leg = troca(self, leg, "Quando o", f"${JPSI}$", "anda, a energia e o momento de cada múon mudam")
        self.play(P.animate.set_value(9.0), run_time=4.5)
        self.play(Indicate(massa[1], color=LARANJA, scale_factor=1.15), run_time=1.2)
        self.wait(0.8)
        leg = troca(self, leg, "Os múons saem em outro ângulo, e a massa é a mesma")
        self.play(angulo.animate.set_value(150), run_time=3.5)
        self.wait(1.0)
        leg = troca(self, leg, "Todo", f"${JPSI}$", "dá a mesma massa: por isso o pico do histograma")
        self.play(P.animate.set_value(4.0), angulo.animate.set_value(100), run_time=2.5)
        self.wait(3)


# ================================================================ 3. do evento ao histograma

ETAPAS = [500, 2000, 10000, 30000, 100000]
PICOS = [(JPSI, 3.0969), ("\\Upsilon", 9.46), ("\\mathrm{Z}", 91.188)]
DEVAGAR = [2, 47, 2102]      # o primeiro evento do arquivo perto do J/ψ, o primeiro perto do Υ e o primeiro perto do Z
DEPRESSA = 40                # depois, os 40 primeiros eventos do arquivo caem um a um


class Picos(Scene):
    """Cada evento vira uma massa, e a massa cai na sua faixa; com 100 mil eventos, os picos são partículas."""

    def construct(self):
        self.camera.background_color = FUNDO
        c = carrega()
        M = c["M"]
        bordas = np.logspace(math.log10(2), math.log10(110), 151)
        canto, largura = np.array([-4.8, -2.3, 0.0]), 10.9
        altura_eventos, altura_final = 3.8, 4.9       # a moldura cresce quando os quadrados dão lugar às barras
        ymax = 5.0              # log10 do topo do eixo: 100 mil por faixa, para os nomes caberem acima dos picos
        lado = 0.14             # o lado do quadrado de um evento

        def x(m):
            return canto[0] + (math.log10(m) - math.log10(2)) / (math.log10(110) - math.log10(2)) * largura

        def y(contagem):
            return canto[1] + (math.log10(contagem) / ymax) * altura_final if contagem >= 1 else canto[1]

        def barras(n_eventos):
            n, _ = np.histogram(M[:n_eventos], bins=bordas)
            g = VGroup()
            for k, cont in enumerate(n):
                x0, x1 = x(bordas[k]), x(bordas[k + 1])
                h = max(y(cont) - canto[1], 0.001)
                g.add(Rectangle(width=x1 - x0, height=h, stroke_width=1.2, stroke_color=AZUL, fill_color=CLARO,
                                fill_opacity=1).move_to(np.array([(x0 + x1) / 2, canto[1] + h / 2, 0])))
            return g, n

        def moldura(altura):
            r = Rectangle(width=largura, height=altura, color=ESCURO, stroke_width=2.5)
            return r.move_to(canto + np.array([largura / 2, altura / 2, 0]))

        quadro = moldura(altura_eventos)
        marcas_x = VGroup()
        for v in (2, 5, 10, 20, 50, 100):
            b = np.array([x(v), canto[1], 0])
            marcas_x.add(Line(b, b + UP * 0.12, color=ESCURO, stroke_width=2.5),
                         eq(str(v), tamanho=38, cor=TEXTO).next_to(b, DOWN, buff=0.14))
        nome_x = texto("massa invariante dos dois múons, em GeV").next_to(quadro, DOWN, buff=0.7)

        # as pilhas de quadrados: cada coluna tem a largura de um quadrado, e o quadrado cai em cima dos que já estão lá
        pilhas = {}

        def destino(m):
            col = int((x(m) - canto[0]) // lado)
            altura_pilha = pilhas.get(col, 0)
            pilhas[col] = altura_pilha + 1
            return np.array([canto[0] + (col + 0.5) * lado, canto[1] + (altura_pilha + 0.5) * lado, 0])

        def quadrado(posicao):
            return Square(side_length=lado * 0.9, stroke_width=0, fill_color=AZUL, fill_opacity=0.85).move_to(posicao)

        leg = legenda("Um evento: dois múons, uma massa")
        self.play(Write(leg), Create(quadro), Create(marcas_x[0::2]), Write(marcas_x[1::2]), Write(nome_x),
                  run_time=1.6)

        quadrados = VGroup()
        for k in DEVAGAR:
            # Os quadrados, como no slide da conta à mão: a massa sai da diferença de dois números grandes, e
            # arredondar as somas antes de elevar ao quadrado mudaria a segunda casa da massa. Com os quadrados
            # em duas casas, a conta na tela confere com a coluna M até a terceira casa.
            S2 = round((c["E1"][k] + c["E2"][k]) ** 2, 2)
            P2 = round((c["px1"][k] + c["px2"][k]) ** 2 + (c["py1"][k] + c["py2"][k]) ** 2
                       + (c["pz1"][k] + c["pz2"][k]) ** 2, 2)
            m_tela = math.sqrt(S2 - P2)               # a conta com os números que aparecem na tela
            assert abs(m_tela - M[k]) < 0.0015, (k, m_tela, M[k])

            def quadrado_tex(v):
                """O quadrado com duas casas e ponto de milhar, para dentro de uma equação: 24{.}401{,}56."""
                return f"{v:,.2f}".replace(",", "X").replace(".", "{,}").replace("X", "{.}")

            linha1 = frase(f"Evento {mil(k + 1)}:", f"$(E_1 + E_2)^2 = {quadrado_tex(S2)}$", "e",
                           f"$|\\vec{{p}}_1 + \\vec{{p}}_2|^2 = {quadrado_tex(P2)}$").move_to(np.array([0, 2.7, 0]))
            linha2 = eq(f"M = \\sqrt{{{quadrado_tex(S2)} - {quadrado_tex(P2)}}} =", br(m_tela, 3), "\\ \\text{GeV}",
                        tamanho=44)
            linha2.move_to(np.array([0, 1.95, 0]))
            assert linha1.width < 13.5 and linha2.width < 13.5
            q = quadrado(np.array([x(M[k]), canto[1] + altura_eventos - 0.25, 0]))
            self.play(Write(linha1), run_time=1.2)
            self.play(Write(linha2), run_time=1.2)
            self.wait(0.6)
            self.play(TransformFromCopy(linha2[1], q), run_time=0.8)
            self.play(q.animate.move_to(destino(M[k])), run_time=0.7)
            quadrados.add(q)
            self.wait(0.4)
            self.play(FadeOut(linha1, linha2), run_time=0.4)

        leg = troca(self, leg, "Cada quadrado é um evento, na faixa da sua massa")
        caindo = []
        for k in [k for k in range(DEPRESSA) if k not in DEVAGAR]:
            q = quadrado(np.array([x(M[k]), canto[1] + altura_eventos - 0.25, 0]))
            caindo.append(Succession(FadeIn(q, run_time=0.15), q.animate(run_time=0.45).move_to(destino(M[k]))))
            quadrados.add(q)
        self.play(LaggedStart(*caindo, lag_ratio=0.12), run_time=6)
        self.wait(1.2)

        # milhares de eventos: os quadrados dão lugar às barras, e o eixo vertical passa a contar em potências de dez
        marcas_y = VGroup()
        for cont, s in ((10, "10"), (100, "100"), (1000, "1.000"), (10000, "10.000")):
            b = np.array([canto[0], y(cont), 0])
            marcas_y.add(Line(b, b + RIGHT * 0.12, color=ESCURO, stroke_width=2.5),
                         eq(s.replace(".", "{.}"), tamanho=38, cor=TEXTO).next_to(b, LEFT, buff=0.14))
        quadro_final = moldura(altura_final)
        nome_y = texto("eventos por faixa").rotate(math.pi / 2).next_to(VGroup(quadro_final, marcas_y), LEFT,
                                                                    buff=0.3)
        leg = troca(self, leg, "Com milhares de eventos, cada marca vale dez vezes a de baixo")
        self.play(FadeOut(quadrados), Transform(quadro, quadro_final), run_time=1.2)
        self.play(Create(marcas_y[0::2]), Write(marcas_y[1::2]), Write(nome_y), run_time=1.2)
        atual, _ = barras(ETAPAS[0])
        leg_n = legenda(f"{mil(ETAPAS[0])} eventos")
        self.play(FadeOut(leg), run_time=0.35)
        leg = leg_n
        self.play(Write(leg), Create(atual), run_time=1.4)
        self.wait(1.0)
        n_final = None
        for n_ev in ETAPAS[1:]:
            novas, n_final = barras(n_ev)
            fim = n_ev == ETAPAS[-1]
            nova_leg = legenda(f"{mil(n_ev)} eventos" + (": os picos são partículas" if fim else ""))
            self.play(FadeOut(leg), run_time=0.3)
            leg = nova_leg
            self.play(Write(leg), Transform(atual, novas), run_time=1.6)
            self.wait(0.9)

        # os nomes dos três picos, acima de cada um, com uma linha fina até ele
        nomes = VGroup()
        for nome, m in PICOS:
            k = np.searchsorted(bordas, m) - 1
            topo = y(n_final[max(k - 2, 0):k + 3].max())
            base = np.array([x(m), topo + 0.1, 0])
            ponta_ = base + UP * 0.55
            rotulo = eq(f"{nome},\\ {m:g}".replace(".", "{,}") + "\\ \\text{GeV}", tamanho=38, cor=LARANJA)
            if m > 50:
                rotulo.next_to(ponta_, UP, buff=0.08).align_to(ponta_, RIGHT)
            else:
                rotulo.next_to(ponta_, UP, buff=0.08)
            if rotulo.get_left()[0] < canto[0] + 0.15:          # o nome do J/ψ não passa da borda esquerda
                rotulo.align_to(np.array([canto[0] + 0.15, 0, 0]), LEFT)
            nomes.add(Line(base, ponta_, color=LARANJA, stroke_width=3), rotulo)
        self.play(Create(nomes[0::2]), Write(nomes[1::2]), run_time=1.4)
        self.wait(3)


# ================================================================ 4. a compressão das entradas

N_COMPRESSAO = 300           # os 300 primeiros eventos do arquivo
TOPO_GEV = 350               # o fim da linha de cima, em GeV; a maior energia dos 300 é 322,8
TOPO_ASINH = 5.0             # o fim da linha de baixo


class Compressao(Scene):
    """A energia do múon 1 em 300 eventos, antes e depois de asinh(E / 5): os números pequenos se espalham."""

    def construct(self):
        self.camera.background_color = FUNDO
        E = carrega()["E1"][:N_COMPRESSAO]
        mediana = float(np.median(E))
        x0, x1, ya, yb = -5.5, 5.5, 1.2, -1.6        # as duas linhas: a de cima em GeV, a de baixo depois do asinh

        def xa(v):
            return x0 + v / TOPO_GEV * (x1 - x0)

        def xb(v):
            return x0 + v / TOPO_ASINH * (x1 - x0)

        def linha(yy, marcas, para_cima, f):
            """A linha, as marcas e os números; os números ficam do lado de fora, longe do corredor do meio."""
            g, numeros = VGroup(Line(np.array([x0, yy, 0]), np.array([x1, yy, 0]), color=ESCURO, stroke_width=3)), VGroup()
            sentido = UP if para_cima else DOWN
            for v in marcas:
                b = np.array([f(v), yy, 0])
                g.add(Line(b, b + sentido * 0.12, color=ESCURO, stroke_width=2.5))
                numeros.add(eq(str(v), tamanho=38, cor=TEXTO).move_to(b + sentido * 0.5))
            return g, numeros

        # um sobe-e-desce fixo, só para os pontos iguais não ficarem um em cima do outro
        desvio = [((k * 37) % 11 - 5) * 0.026 for k in range(len(E))]
        linha_a, numeros_a = linha(ya, range(0, TOPO_GEV + 1, 50), True, xa)
        nome_a = frase("$E_1,$", "a energia do múon 1, em GeV").next_to(numeros_a, UP, buff=0.3).align_to(
            np.array([x0, 0, 0]), LEFT)
        pontos = VGroup(*[Dot(np.array([xa(e), ya + d, 0]), radius=0.06, color=AZUL, fill_opacity=0.45)
                          for e, d in zip(E, desvio)])
        leg = legenda(f"A energia do múon 1 em {N_COMPRESSAO} eventos: quase todas pequenas")
        self.play(Write(leg), Create(linha_a), Write(numeros_a), Write(nome_a), run_time=1.6)
        self.play(FadeIn(pontos, lag_ratio=0.01), run_time=1.6)
        chave_a = Brace(Line(np.array([xa(0), ya - 0.2, 0]), np.array([xa(mediana), ya - 0.2, 0])), DOWN,
                        color=LARANJA, buff=0.05)
        nota_a = texto(f"metade dos eventos: abaixo de {mediana:.1f} GeV".replace(".", ","), 30, LARANJA)
        nota_a.next_to(chave_a, DOWN, buff=0.12).align_to(np.array([x0, 0, 0]), LEFT)
        self.play(Create(chave_a), Write(nota_a), run_time=1.0)
        self.wait(2.0)

        # o asinh: cada ponto desce para a sua posição na linha de baixo; a sombra fica em cima, para comparar
        linha_b, numeros_b = linha(yb, range(0, int(TOPO_ASINH) + 1), False, xb)
        nome_b = eq("\\operatorname{asinh}(E_1 / 5)").next_to(numeros_b, DOWN, buff=0.25).align_to(
            np.array([x0, 0, 0]), LEFT)
        leg = troca(self, leg, "O", "$\\operatorname{asinh}(E_1 / 5)$", "leva cada número para a linha de baixo")
        self.play(FadeOut(chave_a, nota_a), run_time=0.5)
        self.play(Create(linha_b), Write(numeros_b), Write(nome_b), run_time=1.4)
        sombra = pontos.copy().set_fill(opacity=0.12)
        self.add(sombra)
        self.play(*[p.animate.move_to(np.array([xb(math.asinh(e / 5)), yb + d, 0]))
                    for p, e, d in zip(pontos, E, desvio)], run_time=3.0)
        self.wait(0.8)

        meio = math.asinh(mediana / 5)
        antes, depois = round(100 * mediana / TOPO_GEV), round(100 * meio / TOPO_ASINH)
        chave_b = Brace(Line(np.array([xb(0), yb + 0.2, 0]), np.array([xb(meio), yb + 0.2, 0])), UP,
                        color=LARANJA, buff=0.05)
        nota_b = texto("a mesma metade dos eventos", 30, LARANJA).next_to(chave_b, UP, buff=0.12)
        leg = troca(self, leg, f"A metade de baixo ocupava {antes}% da linha; agora ocupa {depois}%")
        self.play(Create(chave_b), Write(nota_b), run_time=1.0)
        self.wait(2.2)

        # o leque: de 10 em 10 GeV até 50, e de 50 em 50 até 350, cada valor ligado à sua imagem
        valores = [10, 20, 30, 40, 50, 100, 150, 200, 250, 300, 350]
        leque = VGroup(*[Line(np.array([xa(v), ya - 0.25, 0]), np.array([xb(math.asinh(v / 5)), yb + 0.25, 0]),
                              color=CINZA, stroke_width=2.5) for v in valores])
        parte = round(100 * math.asinh(50 / 5) / TOPO_ASINH)
        leg = troca(self, leg, f"Os primeiros 50 GeV ganham {parte}% da linha; os outros 300, o resto")
        self.play(FadeOut(chave_b, nota_b), run_time=0.5)
        self.play(Create(leque, lag_ratio=0.15), run_time=2.0)
        self.wait(3)


# ================================================================ 5. o treino, época a época

N_TREINO = 2000              # os 2 mil primeiros eventos do teste, os mesmos que mlp_massa.py retrata


class TreinoMassa(Scene):
    """A massa da rede contra a da fórmula, das épocas 0 a 80: a nuvem de pontos vai para a diagonal."""

    def construct(self):
        self.camera.background_color = FUNDO
        r = json.loads((AULA / "resultados" / "massa.json").read_text(encoding="utf-8"))
        formula = np.array(r["teste_formula"][:N_TREINO])
        instantes = {int(e): np.array(m) for e, m in r["instantes"].items()}
        canto, lado = np.array([-4.4, -2.6, 0.0]), 5.4
        lim = (math.log10(1.5), math.log10(150))

        def frac(m):
            return (math.log10(min(max(m, 1.5), 150)) - lim[0]) / (lim[1] - lim[0])

        def pos(mx, my):
            return canto + np.array([frac(mx) * lado, frac(my) * lado, 0])

        quadro = Rectangle(width=lado, height=lado, color=ESCURO, stroke_width=2.5).move_to(
            canto + np.array([lado / 2, lado / 2, 0]))
        marcas, numeros = VGroup(), VGroup()
        for v in (2, 5, 10, 20, 50, 100):
            bx, by = pos(v, 1.5), pos(1.5, v)
            marcas.add(Line(bx, bx + UP * 0.12, color=ESCURO, stroke_width=2.5),
                       Line(by, by + RIGHT * 0.12, color=ESCURO, stroke_width=2.5))
            numeros.add(eq(str(v), tamanho=38, cor=TEXTO).next_to(bx, DOWN, buff=0.14),
                        eq(str(v), tamanho=38, cor=TEXTO).next_to(by, LEFT, buff=0.14))
        nome_x = texto("massa pela fórmula, em GeV").next_to(quadro, DOWN, buff=0.7)
        nome_y = texto("massa da rede, em GeV").rotate(math.pi / 2).next_to(quadro, LEFT, buff=0.95)
        diagonal = DashedLine(pos(1.5, 1.5), pos(150, 150), color=SUAVE, stroke_width=3)
        nome_diag = texto("rede = fórmula", 30, SUAVE).next_to(pos(150, 150), RIGHT, buff=0.25)

        def nuvem(e):
            return VGroup(*[Dot(pos(mx, my), radius=0.028, color=AZUL, fill_opacity=0.5)
                            for mx, my in zip(formula, instantes[e])])

        def erro(e):
            return float(np.median(np.abs(instantes[e] - formula) / formula))

        x_painel = 2.4
        rot_epoca = texto("época", 30, SUAVE).move_to(np.array([0, 1.9, 0])).align_to(np.array([x_painel, 0, 0]), LEFT)
        rot_erro = texto("erro mediano", 30, SUAVE).move_to(np.array([0, -0.3, 0])).align_to(
            np.array([x_painel, 0, 0]), LEFT)

        def num_epoca(e):
            return eq(str(e), tamanho=72).next_to(rot_epoca, DOWN, buff=0.3).align_to(rot_epoca, LEFT)

        def num_erro(e):
            return eq(br(100 * erro(e), 1) + "\\%", tamanho=64).next_to(rot_erro, DOWN, buff=0.3).align_to(rot_erro, LEFT)

        leg = legenda(f"{mil(N_TREINO)} eventos do teste: a massa da rede contra a da fórmula")
        self.play(Write(leg), Create(quadro), Create(marcas), Write(numeros), Write(nome_x), Write(nome_y),
                  run_time=1.8)
        self.play(Create(diagonal), Write(nome_diag), run_time=1.0)
        pontos, ep, er = nuvem(0), num_epoca(0), num_erro(0)
        self.play(FadeIn(pontos, lag_ratio=0.002), Write(rot_epoca), Write(ep), Write(rot_erro), Write(er),
                  run_time=1.6)
        leg = troca(self, leg, "Antes do treino, a rede dá quase a mesma massa a todos")
        self.wait(1.8)
        frases = {1: ("Depois de uma época, os pontos já seguem a diagonal",),
                  10: ("A cada época, a nuvem aperta em volta da diagonal",),
                  80: ("Época 80, a melhor pela validação: os picos viram manchas",)}
        for e in sorted(instantes)[1:]:
            if e in frases:
                leg = troca(self, leg, *frases[e])
            self.play(Transform(pontos, nuvem(e)), Transform(ep, num_epoca(e)), Transform(er, num_erro(e)),
                      run_time=1.6)
            self.wait(1.0 if e < 80 else 3.0)


CENAS = {"direcao": Direcao, "massa-invariante": MassaInvariante, "picos": Picos, "compressao": Compressao,
         "treino-massa": TreinoMassa}


def grava(nome, largura=1920, altura=1080, quadros=30, crf=24, so_ultimo_quadro=False):
    """Desenha a cena e grava o mp4 e o png do último quadro, em videos/ e figuras/ da aula."""
    inicio = time.perf_counter()
    pasta_videos, pasta_quadros = AULA / "videos", AULA / "figuras"
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
    png = pasta_quadros / f"{nome}-quadro.png"
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
    for arquivo in arquivos:
        print(f"gravado: {arquivo} ({arquivo.stat().st_size / 1e6:.1f} MB)")
    print(f"{nome}: {time.perf_counter() - inicio:.0f} s")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    so_quadro = "--quadros" in args
    for nome in [a for a in args if a != "--quadros"] or list(CENAS):
        grava(nome, so_ultimo_quadro=so_quadro)
