"""Os vídeos da aula 10, feitos com o Manim Community.

Rode, a partir da raiz do repositório, com o nome dos vídeos que quer gravar, ou
sem nome nenhum para gravar todos:
    python aulas/10-apresentacao/codigo/animacoes.py
    python aulas/10-apresentacao/codigo/animacoes.py convolucao

Os três vídeos, na ordem da aula:
    laco        o curso numa figura: o laço do treino, com a aula de cada peça, girando
                as 20 épocas do MNIST da aula 6; depois, o limiar do treino três vezes:
                um ponto na aula 2, uma faixa na aula 7, um fractal na aula 9
    convolucao  um filtro de 3 por 3 desliza sobre um 7 do MNIST; a conta numa posição,
                com os números, e o mapa que sai; os mesmos 9 pesos em todo lugar
    atencao     cinco palavras como vetores inventados; "atravessa" compara-se com as
                outras pelo produto escalar, a softmax vira pesos, e a palavra nova é a
                média ponderada

Precisa do Manim Community (pip install manim), do MiKTeX e do ffmpeg, como os
vídeos das outras aulas, e dos dados do MNIST, que `python infra/baixar_dados.py`
baixa. Lê os resultados gravados das aulas 6 e 7 e o gancho da aula 9, a janela 4
do zoom em 1.024 por 1.024 treinos (aulas/09-projeto/figuras/gancho.png).
Cada vídeo sai em dois arquivos:
    aulas/10-apresentacao/videos/<nome>.mp4           1920 por 1080, 30 quadros por segundo, sem som
    aulas/10-apresentacao/figuras/<nome>-quadro.png   o último quadro, que o slide mostra parado

Uma opção grava só o último quadro, para conferir a composição: --quadros

As regras dos vídeos das outras aulas valem aqui: sem título próprio, texto com
pelo menos 30 pontos do Manim, equação com pelo menos 38, nada se sobrepõe, nada
é sorteado.
"""
import json
import math
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from manim import (DOWN, LEFT, RIGHT, UP, Arrow, Axes, Create, Dot, FadeIn, FadeOut, GrowArrow, ImageMobject,
                   Line, MathTex, Rectangle, RoundedRectangle, Scene, Square, TexTemplate, Text, ValueTracker, VGroup,
                   VMobject, Write, config, linear, tempconfig)
from manim.constants import RESAMPLING_ALGORITHMS
from manimpango import register_font
from PIL import Image

RAIZ = Path(__file__).resolve().parents[3]
AULA = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "aulas" / "06-mnist-numpy" / "codigo"))

# As fontes do curso, as mesmas dos slides, guardadas em infra/fontes/ com as licenças
for arquivo in ("IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf", "SourceSerif4-Semibold.ttf"):
    register_font(str(RAIZ / "infra" / "fontes" / arquivo))
SANS = "IBM Plex Sans"

# A paleta de infra/slides.py e das figuras
FUNDO, ESCURO, TEXTO, SUAVE, CINZA = "#F6F5F1", "#14213D", "#3B4658", "#5E6A7D", "#8A94A6"
AZUL, LARANJA, CLARO = "#1F5FAD", "#A8500F", "#C9D7EA"
CONVERGIU, DIVERGIU = AZUL, LARANJA            # convergiu e divergiu, nas cores do curso, como na aula 9

# As equações em STIX Two, a fonte das equações dos slides (infra/equacoes.py)
MODELO = TexTemplate(preamble="\\usepackage[T1]{fontenc}\n\\usepackage{amsmath}\n\\usepackage{stix2}\n")
config.tex_template = MODELO


def texto(s, tamanho=30, cor=TEXTO):
    """Texto corrido, na fonte dos slides."""
    return Text(s, font=SANS, font_size=tamanho, color=cor)


def eq(*partes, tamanho=40, cor=ESCURO):
    """Equação em LaTeX; cada parte vira um pedaço separado."""
    return MathTex(*partes, font_size=tamanho, color=cor, tex_template=MODELO)


def frase(*pedacos, tamanho=30, cor=TEXTO):
    """Uma linha que mistura texto e equação; o pedaço que começa com $ é equação."""
    partes = [eq(p.strip("$"), tamanho=round(tamanho * 1.25), cor=cor) if p.startswith("$") else texto(p, tamanho, cor)
              for p in pedacos]
    return VGroup(*partes).arrange(RIGHT, buff=0.16)


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


def br(v, casas=2):
    """Número com vírgula decimal, para texto; o menos sai como sinal de menos."""
    return f"{v:.{casas}f}".replace(".", ",").replace("-", "−")


def tex(v, casas=2):
    """Número para dentro de uma equação: vírgula decimal sem o espaço que o LaTeX põe depois dela."""
    return f"{v:.{casas}f}".replace(".", "{,}")


def imagem(rgb, altura):
    """Uma matriz RGB de 0 a 1, com a linha 0 em cima, como imagem do Manim, com os pixels nítidos."""
    img = ImageMobject((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    img.set_resampling_algorithm(RESAMPLING_ALGORITHMS["nearest"])
    img.set_height(altura)
    return img


def rgb_de(hexa):
    """Uma cor hexadecimal como três números de 0 a 1."""
    return np.array([int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)])


# ================================================================ 1. o laço do treino

class Laco(Scene):
    """O laço do treino com a aula de cada peça; as 20 épocas da aula 6; o limiar três vezes."""

    def construct(self):
        self.camera.background_color = FUNDO
        mlp = json.loads((RAIZ / "aulas" / "06-mnist-numpy" / "resultados" / "mlp.json").read_text(encoding="utf-8"))
        perdas = mlp["redes"]["256"]["historico"]["perda_treino"]
        acuracia = mlp["escolha"]["acuracia_teste"]

        # as quatro peças, em sentido horário, a partir do alto à esquerda
        centros = [np.array([-4.3, 1.05, 0]), np.array([0.3, 1.05, 0]), np.array([0.3, -2.05, 0]),
                   np.array([-4.3, -2.05, 0])]
        pecas = [("para a frente", "\\hat{y} = f(W\\vec{x} + \\vec{b})", "aulas 1 e 3"),
                 ("a perda", "L = -\\ln p_t", "aulas 2 e 6"),
                 ("para trás", "\\partial L / \\partial W", "aulas 4 e 5"),
                 ("o passo", "W \\leftarrow W - \\eta\\, \\nabla L", "aulas 2 e 7")]
        caixas = []
        for c, (nome, formula, aulas) in zip(centros, pecas):
            dentro = VGroup(texto(nome, 30, ESCURO), eq(formula, tamanho=38), texto(aulas, 30, SUAVE))
            dentro.arrange(DOWN, buff=0.18)
            caixa = RoundedRectangle(width=3.9, height=1.95, corner_radius=0.18, color=CINZA, stroke_width=2)
            caixa.set_fill("#FDFCFA", 1).move_to(c)
            dentro.move_to(c)
            assert dentro.width < 3.7 and dentro.height < 1.85, nome
            caixa.set_z_index(2)                 # opacas e por cima: o ponto que gira some dentro delas
            dentro.set_z_index(3)
            caixas.append(VGroup(caixa, dentro))
        setas = VGroup(
            Arrow(centros[0] + RIGHT * 1.95, centros[1] + LEFT * 1.95, buff=0.08, color=ESCURO, stroke_width=4),
            Arrow(centros[1] + DOWN * 0.98, centros[2] + UP * 0.98, buff=0.08, color=ESCURO, stroke_width=4),
            Arrow(centros[2] + LEFT * 1.95, centros[3] + RIGHT * 1.95, buff=0.08, color=ESCURO, stroke_width=4),
            Arrow(centros[3] + UP * 0.98, centros[0] + DOWN * 0.98, buff=0.08, color=ESCURO, stroke_width=4))
        dados = texto("os dados: o MNIST e os múons do CMS, aulas 6 e 8", 30, AZUL)
        dados.move_to(np.array([-2.0, 2.62, 0]))
        seta_dados = Arrow(np.array([-4.3, 2.4, 0]), centros[0] + UP * 0.98, buff=0.05, color=AZUL, stroke_width=4)
        taxa = texto("a taxa η: aulas 2, 7 e 9", 30, LARANJA).move_to(np.array([-4.3, -3.6, 0]))
        seta_taxa = Arrow(taxa.get_top(), centros[3] + DOWN * 0.98, buff=0.05, color=LARANJA, stroke_width=4)

        leg = legenda("O curso numa figura: o laço do treino")
        self.play(Write(leg), run_time=1.0)
        for k in range(4):
            self.play(FadeIn(caixas[k][0]), Write(caixas[k][1]), run_time=0.9)
            self.play(GrowArrow(setas[k]), run_time=0.4)
        self.play(Write(dados), GrowArrow(seta_dados), run_time=1.0)
        self.play(Write(taxa), GrowArrow(seta_taxa), run_time=1.0)
        self.wait(1.0)

        # o laço gira: cada volta é uma época do MLP da aula 6, e a curva da perda cresce ao lado
        eixos = Axes(x_range=[0, 20, 5], y_range=[0, 0.35, 0.1], x_length=3.4, y_length=3.0,
                     axis_config={"color": ESCURO, "stroke_width": 2.5, "include_tip": False}).move_to(
            np.array([4.95, -0.6, 0]))
        rot_x = VGroup(*[eq(str(v), tamanho=38, cor=TEXTO).next_to(eixos.c2p(v, 0), DOWN, buff=0.15) for v in (0, 20)])
        nome_x = texto("época", 30, TEXTO).next_to(rot_x, DOWN, buff=0.1)
        rot_y = VGroup(*[eq(tex(v, 1), tamanho=38, cor=TEXTO).next_to(eixos.c2p(0, v), LEFT, buff=0.15)
                         for v in (0.1, 0.3)])
        nome_y = texto("perda no treino", 30, TEXTO).next_to(eixos, UP, buff=0.3)
        assert nome_y.get_left()[0] > 2.4 and eixos.get_right()[0] < 6.9, "o gráfico não cabe"
        leg = troca(self, leg, "Cada volta é uma época: o MLP da aula 6 no MNIST")
        self.play(Create(eixos), Write(rot_x), Write(nome_x), Write(rot_y), Write(nome_y), run_time=1.2)
        caminho = VMobject().set_points_as_corners([centros[0], centros[1], centros[2], centros[3], centros[0]])
        ponto = Dot(centros[0], radius=0.13, color=LARANJA).set_z_index(1)    # aparece só nas setas, entre as caixas
        self.add(ponto)
        voltas = ValueTracker(0.0)
        curva = VMobject().set_stroke(AZUL, 4)

        def atualiza_curva(c):
            v = voltas.get_value()
            n = int(v)
            pts = [eixos.c2p(e + 1, perdas[e]) for e in range(min(n, 20))]
            if len(pts) >= 2:
                c.set_points_as_corners(pts)
            ponto.move_to(caminho.point_from_proportion(v % 1.0 if v < 20 else 0.0))

        curva.add_updater(atualiza_curva)
        self.add(curva)
        self.play(voltas.animate.set_value(1.0), run_time=3.0, rate_func=linear)
        self.play(voltas.animate.set_value(20.0), run_time=7.0, rate_func=linear)
        curva.clear_updaters()
        fim = texto(f"{br(100 * acuracia)}% no teste", 30, AZUL).next_to(nome_x, DOWN, buff=0.2)   # embaixo do eixo
        assert fim.get_bottom()[1] > -3.95, "o resultado sai da tela"
        self.play(Write(fim), FadeOut(ponto), run_time=0.8)
        self.wait(2.0)

        # o limiar do treino, três vezes
        tudo = VGroup(*caixas, setas, dados, seta_dados, taxa, seta_taxa, eixos, rot_x, nome_x, rot_y, nome_y, curva, fim)
        self.play(FadeOut(tudo), run_time=0.8)
        leg = troca(self, leg, "O limiar do treino, três vezes: um ponto, uma faixa, um fractal")
        y0, largura = 0.15, 3.9
        xs = [-4.55, 0.0, 4.55]

        # aula 2: a reta, com uma taxa só e um limiar, 0,513
        a, b = 0.0, 1.0
        lim = 0.513
        p1 = VGroup(Rectangle(width=largura * (lim - a) / (b - a), height=0.7, stroke_width=0).set_fill(CONVERGIU, 1),
                    Rectangle(width=largura * (b - lim) / (b - a), height=0.7, stroke_width=0).set_fill(DIVERGIU, 1))
        p1.arrange(RIGHT, buff=0).move_to(np.array([xs[0], y0, 0]))
        marca = Line(p1.get_left() + RIGHT * largura * lim + UP * 0.5, p1.get_left() + RIGHT * largura * lim + DOWN * 0.5,
                     color=ESCURO, stroke_width=5)
        n1 = VGroup(eq("0", tamanho=38, cor=TEXTO).next_to(p1.get_corner(DOWN + LEFT), DOWN, buff=0.15),
                    eq("0{,}513", tamanho=38, cor=TEXTO).next_to(marca, DOWN, buff=0.05),
                    eq("1", tamanho=38, cor=TEXTO).next_to(p1.get_corner(DOWN + RIGHT), DOWN, buff=0.15))
        c1 = VGroup(texto("aula 2: a reta", 30, ESCURO), texto("um ponto", 30, TEXTO)).arrange(DOWN, buff=0.12)

        # aula 7: a rede pequena, 601 taxas de 2 a 10, melhora ou piora
        t7 = json.loads((RAIZ / "aulas" / "07-pytorch" / "resultados" / "taxa.json").read_text(encoding="utf-8"))
        antes = t7["perda_antes"]
        piora = np.array([x is None or x > antes for x in t7["fina"]["finais"]])
        faixa = np.where(piora[None, :, None], rgb_de(DIVERGIU), rgb_de(CONVERGIU)).repeat(8, axis=0)
        p2 = imagem(faixa, 0.7)
        p2.stretch_to_fit_width(largura)
        p2.move_to(np.array([xs[1], y0, 0]))
        n2 = VGroup(eq("2", tamanho=38, cor=TEXTO).next_to(p2.get_corner(DOWN + LEFT), DOWN, buff=0.15),
                    eq("10", tamanho=38, cor=TEXTO).next_to(p2.get_corner(DOWN + RIGHT), DOWN, buff=0.15))
        c2 = VGroup(texto("aula 7: uma taxa", 30, ESCURO), texto("uma faixa", 30, TEXTO))
        c2.arrange(DOWN, buff=0.12)

        # aula 9: duas taxas, o fractal; a janela 4 do zoom, em 1.024 por 1.024 treinos
        capa = np.asarray(Image.open(RAIZ / "aulas" / "09-projeto" / "figuras" / "gancho.png").convert("RGB"),
                          dtype=float) / 255
        p3 = imagem(capa, 3.0).move_to(np.array([xs[2], y0 + 0.2, 0]))
        c3 = VGroup(texto("aula 9: duas taxas", 30, ESCURO), texto("um fractal", 30, TEXTO))
        c3.arrange(DOWN, buff=0.12)
        for c, x in zip((c1, c2, c3), xs):
            c.move_to(np.array([x, -2.45, 0]))
        assert c3.get_right()[0] < 7.0 and c1.get_left()[0] > -7.0, "as legendas não cabem"
        self.play(FadeIn(p1), Create(marca), Write(n1), Write(c1), run_time=1.2)
        self.wait(0.8)
        self.play(FadeIn(p2), Write(n2), Write(c2), run_time=1.2)
        self.wait(0.8)
        self.play(FadeIn(p3), Write(c3), run_time=1.2)
        self.wait(3.5)


# ================================================================ 2. a convolução

def correlacao(x, f):
    """O mapa de um filtro f, 3 por 3, sobre a imagem x: em cada posição, a soma de pixel vezes peso."""
    n = x.shape[0] - 2
    return np.array([[float((x[i:i + 3, j:j + 3] * f).sum()) for j in range(n)] for i in range(n)])


def pinta_mapa(m, escala):
    """O mapa em cores: positivo em azul, negativo em laranja, zero da cor do fundo."""
    fundo, pos, neg = rgb_de(FUNDO), rgb_de(AZUL), rgb_de(LARANJA)
    r = np.clip(m / escala, -1, 1)[..., None]
    return np.where(r >= 0, fundo + r * (pos - fundo), fundo - r * (neg - fundo))


class Convolucao(Scene):
    """Um filtro de 3 por 3 sobre um 7 do MNIST: uma conta com números e o mapa inteiro."""

    def construct(self):
        self.camera.background_color = FUNDO
        from mnist import carrega
        X, t = carrega()["teste"]
        x = X[0].reshape(28, 28)
        assert t[0] == 7, "o primeiro dígito do teste devia ser um 7"
        filtros = {"vertical": np.array([[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], dtype=float),
                   "horizontal": np.array([[1, 1, 1], [0, 0, 0], [-1, -1, -1]], dtype=float)}

        S, CD, CM = 5.6, np.array([-4.2, -0.45, 0]), np.array([4.45, -0.1, 0])      # lado, centro do dígito e do mapa
        px = S / 28
        tinta = rgb_de(ESCURO)
        digito_rgb = rgb_de(FUNDO) + x[..., None] * (tinta - rgb_de(FUNDO))
        digito = imagem(digito_rgb, S).move_to(CD)
        borda = Square(S, color=CINZA, stroke_width=2).move_to(CD)

        def no_digito(i, j):
            """O centro da janela de 3 por 3 que começa na linha i, coluna j."""
            return CD + np.array([(j + 1.5) * px - S / 2, S / 2 - (i + 1.5) * px, 0])

        def grade(valores, lado, cor_texto=ESCURO, casas=0):
            """Uma grade de 3 por 3 com um número em cada casa."""
            g = VGroup()
            for a in range(3):
                for b in range(3):
                    casa = Square(lado, color=CINZA, stroke_width=2).set_fill("#FDFCFA", 1)
                    casa.move_to(np.array([(b - 1) * lado, (1 - a) * lado, 0]))
                    v = valores[a][b]
                    n = texto(br(v, casas) if casas else str(int(v)).replace("-", "−"), 30, cor_texto)
                    n.move_to(casa)
                    g.add(VGroup(casa, n))
            return g

        leg = legenda("Um 7 do MNIST e um filtro de 3 por 3: nove pesos")
        filtro = grade(filtros["vertical"], 0.55).move_to(np.array([0.4, 1.85, 0]))
        nome_f = texto("o filtro", 30, SUAVE).next_to(filtro, UP, buff=0.15)
        self.play(Write(leg), FadeIn(digito), Create(borda), run_time=1.2)
        self.play(FadeIn(filtro), Write(nome_f), run_time=1.0)

        # uma posição, com a conta: a de maior soma nas 12 primeiras linhas, na borda esquerda do traço
        m = correlacao(x, filtros["vertical"])
        i0, j0 = np.unravel_index(np.argmax(m[:12]), m[:12].shape)
        janela = Square(3 * px, color=LARANJA, stroke_width=5).move_to(no_digito(i0, j0)).set_z_index(3)
        leg = troca(self, leg, "Em cada posição, a soma de pixel vezes peso")
        self.play(Create(janela), run_time=0.6)
        pedaco = grade(x[i0:i0 + 3, j0:j0 + 3], 0.92, TEXTO, casas=2).move_to(np.array([0.4, -1.1, 0]))
        assert pedaco.get_left()[0] > -1.3 and pedaco.get_right()[0] < 2.1, "a grade dos pixels não cabe no meio"
        nome_p = texto("os pixels", 30, SUAVE).next_to(pedaco, UP, buff=0.15)
        assert nome_p.get_top()[1] < filtro.get_bottom()[1] - 0.15, "o rótulo dos pixels encosta no filtro"
        self.play(FadeIn(pedaco), Write(nome_p), run_time=1.0)
        soma = frase("soma:", f"${tex(m[i0, j0])}$", tamanho=30).move_to(np.array([0.4, -2.95, 0]))
        self.play(Write(soma), run_time=0.8)
        self.wait(1.5)

        # o mapa inteiro: a janela varre as linhas, e o mapa se enche
        lado_m = 26 * 0.17                         # o mapa um pouco menor, para a legenda das cores caber embaixo
        escala = float(np.abs(m).max())
        borda_m = Square(lado_m, color=CINZA, stroke_width=2).move_to(CM)
        nome_m = texto("o mapa: 26 por 26", 30, SUAVE).next_to(borda_m, UP, buff=0.15)
        leg = troca(self, leg, "Os mesmos nove pesos em todas as 676 posições")
        self.play(Create(borda_m), Write(nome_m), FadeOut(pedaco), FadeOut(nome_p), FadeOut(soma), run_time=0.8)
        parcial = np.full((26, 26), 0.0)
        img_m = None
        for i in range(26):
            parcial[i] = m[i]
            novo = imagem(pinta_mapa(parcial, escala), lado_m).move_to(CM)
            anims = [janela.animate.move_to(no_digito(i, 23 if i % 2 else 0))]
            if img_m is not None:
                self.remove(img_m)
            self.add(novo)
            img_m = novo
            self.play(*anims, run_time=0.16 if i > 2 else 0.4, rate_func=linear)
        self.play(FadeOut(janela), run_time=0.4)
        cores = VGroup(texto("azul: borda esquerda", 30, AZUL), texto("laranja: borda direita", 30, LARANJA))
        cores.arrange(DOWN, buff=0.12, aligned_edge=LEFT).next_to(borda_m, DOWN, buff=0.25)
        assert cores.get_bottom()[1] > -3.95 and cores.get_right()[0] < 7.0, "a legenda das cores sai da tela"
        self.play(Write(cores), run_time=1.0)
        self.wait(1.5)

        # outro filtro, outro mapa
        leg = troca(self, leg, "Outro filtro, outro mapa: agora as bordas de cima e de baixo")
        filtro2 = grade(filtros["horizontal"], 0.55).move_to(filtro)
        m2 = correlacao(x, filtros["horizontal"])
        img2 = imagem(pinta_mapa(m2, float(np.abs(m2).max())), lado_m).move_to(CM)
        cores2 = VGroup(texto("azul: borda de baixo", 30, AZUL), texto("laranja: borda de cima", 30, LARANJA))
        cores2.arrange(DOWN, buff=0.12, aligned_edge=LEFT).move_to(cores, aligned_edge=LEFT)
        self.play(FadeOut(filtro), FadeIn(filtro2), FadeOut(img_m), FadeIn(img2), FadeOut(cores), FadeIn(cores2),
                  run_time=1.2)
        self.wait(1.5)
        leg = troca(self, leg, "O treino escolhe os nove números de cada filtro")
        self.wait(3.0)


# ================================================================ 3. a atenção

# Os vetores das palavras, inventados para o exemplo e espalhados no plano, para os
# rótulos não se encostarem. Cada palavra é um ponto; o vetor vai da origem até ele.
PALAVRAS = [("o", (1.2, 0.2)), ("múon", (2.0, 0.6)), ("atravessa", (0.4, 0.9)), ("a", (0.2, 1.6)),
            ("câmara", (1.1, 1.9))]
LADO_ROTULO = {"o": RIGHT, "múon": RIGHT, "atravessa": DOWN, "a": LEFT, "câmara": RIGHT}


class Atencao(Scene):
    """A atenção com cinco palavras: produto escalar, softmax e a média ponderada."""

    def construct(self):
        self.camera.background_color = FUNDO
        O, U = np.array([-6.4, -2.9, 0]), 2.45          # a origem do plano das palavras e o tamanho de uma unidade
        vetores = {w: np.array(v) for w, v in PALAVRAS}

        def ponto(v):
            return O + np.array([v[0] * U, v[1] * U, 0])

        eixo_x = Arrow(O + LEFT * 0.2, O + RIGHT * 5.6, buff=0, color=CINZA, stroke_width=2, tip_length=0.18)
        eixo_y = Arrow(O + DOWN * 0.2, O + UP * 5.6, buff=0, color=CINZA, stroke_width=2, tip_length=0.18)
        setas, rotulos = VGroup(), VGroup()
        for w, v in PALAVRAS:
            cor = AZUL if w == "atravessa" else TEXTO
            s = Dot(ponto(v), radius=0.11, color=cor)          # a palavra é o ponto na ponta do vetor
            r = texto(w, 30, cor).next_to(ponto(v), LADO_ROTULO[w], buff=0.15)
            setas.add(s)
            rotulos.add(r)
        leg = legenda("Cada palavra é um vetor; aqui, com dois números inventados")
        self.play(Write(leg), Create(eixo_x), Create(eixo_y), run_time=1.0)
        self.play(*[FadeIn(s, scale=2) for s in setas], *[Write(r) for r in rotulos], run_time=1.6)
        self.wait(1.2)

        # a pergunta de "atravessa": o produto escalar com cada palavra, dividido por √2
        q = vetores["atravessa"]
        notas = np.array([q @ vetores[w] / math.sqrt(2) for w, _ in PALAVRAS])
        pesos = np.exp(notas) / np.exp(notas).sum()
        ys = [1.75, 0.9, 0.05, -0.8, -1.65]
        cab = VGroup(texto("palavra", 30, SUAVE).move_to(np.array([1.3, 2.6, 0])),
                     eq("\\vec{q} \\cdot \\vec{k} / \\sqrt{2}", tamanho=38, cor=SUAVE).move_to(np.array([3.3, 2.6, 0])))
        leg = troca(self, leg, "“atravessa” se compara com cada palavra: o produto escalar")
        linhas = VGroup()
        for (w, _), y, n in zip(PALAVRAS, ys, notas):
            linhas.add(VGroup(texto(w, 30, AZUL if w == "atravessa" else TEXTO).move_to(np.array([1.3, y, 0])),
                              eq(tex(n), tamanho=38).move_to(np.array([3.3, y, 0]))))
        self.play(Write(cab), run_time=0.8)
        self.play(*[Write(l) for l in linhas], run_time=1.6)
        self.wait(1.5)

        # a softmax da aula 6 vira as notas em pesos, positivos e com soma 1
        leg = troca(self, leg, "A softmax da aula 6 vira as notas em pesos que somam 1")
        cab_p = texto("peso", 30, SUAVE).move_to(np.array([5.4, 2.6, 0]))
        barras, numeros = VGroup(), VGroup()
        for y, p in zip(ys, pesos):
            b = Rectangle(width=max(2.4 * p, 0.02), height=0.42, stroke_width=0).set_fill(LARANJA, 0.85)
            b.move_to(np.array([4.5 + 2.4 * p / 2, y, 0]))
            barras.add(b)
            numeros.add(eq(tex(p), tamanho=38).next_to(b, RIGHT, buff=0.12))
        assert max(n.get_right()[0] for n in numeros) < 7.0, "os pesos saem da tela"
        self.play(Write(cab_p), *[FadeIn(b) for b in barras], *[Write(n) for n in numeros], run_time=1.6)
        self.wait(1.8)

        # a palavra nova: a soma dos vetores, cada um com o seu peso
        nova = sum(p * vetores[w] for p, (w, _) in zip(pesos, PALAVRAS))
        # a palavra se move: do ponto antigo ao novo, uma seta tracejada
        seta_nova = Arrow(ponto(vetores["atravessa"]), ponto(nova), buff=0.12, color=LARANJA, stroke_width=5,
                          tip_length=0.22)
        ponto_novo = Dot(ponto(nova), radius=0.13, color=LARANJA)
        rot_nova = texto("atravessa, depois", 30, LARANJA).next_to(ponto(nova), RIGHT, buff=0.18)
        leg = troca(self, leg, "A palavra nova é a média ponderada: mudou com as vizinhas")
        conta = frase(f"$({tex(nova[0])};\\ {tex(nova[1])})$", tamanho=30).next_to(rot_nova, DOWN, buff=0.1)
        conta.align_to(rot_nova, LEFT)
        assert conta.get_right()[0] < 0.4 and rot_nova.get_right()[0] < 0.4, "o rótulo novo invade a tabela"
        self.play(GrowArrow(seta_nova), FadeIn(ponto_novo, scale=2), Write(rot_nova), Write(conta), run_time=1.4)
        self.wait(2.0)
        leg = troca(self, leg, "O Transformer aprende as perguntas: as matrizes de Q, K e V")
        self.wait(3.0)


CENAS = {"laco": Laco, "convolucao": Convolucao, "atencao": Atencao}


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
