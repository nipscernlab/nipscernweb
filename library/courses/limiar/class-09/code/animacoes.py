"""Os vídeos da aula 9, feitos com o Manim Community.

Rode, a partir da raiz do repositório, depois de fractal.py, com o nome dos
vídeos que quer gravar, ou sem nome nenhum para gravar todos:
    python aulas/09-projeto/codigo/animacoes.py
    python aulas/09-projeto/codigo/animacoes.py zoom caixas

Os quatro vídeos, na ordem da aula:
    iteracao  repetir x ← x² + c a partir de 0: para uns c o número fica perto, para
              outros foge; na reta, a fronteira são dois pontos; no plano, é o
              conjunto de Mandelbrot; no treino, a conta repetida é o passo do gradiente
    pixel     quatro treinos da rede do projeto, um em cada par de taxas, com a perda
              passo a passo; cada um vira um pixel, e o plano se enche, de 8 por 8 a
              512 por 512 treinos
    zoom      seis janelas, uma dentro da outra, cada uma quatro vezes menor: mil vezes
              de aumento, e a fronteira continua cheia de detalhe
    caixas    a dimensão pela contagem de caixas: a linha pede 2 vezes mais caixas
              quando a caixa cai pela metade, a área 4 vezes, a fronteira 2 elevado a 1,68

Precisa do Manim Community (pip install manim), do MiKTeX e do ffmpeg, como os
vídeos das outras aulas. Cada vídeo sai em dois arquivos:
    aulas/09-projeto/videos/<nome>.mp4           1920 por 1080, 30 quadros por segundo, sem som
    aulas/09-projeto/figuras/<nome>-quadro.png   o último quadro, que o slide mostra parado

Uma opção grava só o último quadro, para conferir a composição: --quadros

As regras dos vídeos das outras aulas valem aqui. Sem título próprio, porque o
título está no slide; texto com pelo menos 30 pontos do Manim, equação com pelo
menos 38. Todo texto entra escrito e toda forma entra desenhada. Nada se
sobrepõe. E nada é sorteado: os mapas são os de fractal.py, gravados em
resultados/, e as cores são as do curso, de infra/slides.py, pela pinta() do
projeto/varredura.py.
"""
import json
import math
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from manim import (DOWN, LEFT, RIGHT, UP, Axes, Create, DashedLine, Dot, FadeIn, FadeOut, Group, ImageMobject,
                   Line, MathTex, Rectangle, Scene, Square, TexTemplate, Text, ValueTracker, VGroup, Write, config,
                   linear, tempconfig)
from manim.constants import RESAMPLING_ALGORITHMS
from manimpango import register_font

RAIZ = Path(__file__).resolve().parents[3]
AULA = Path(__file__).resolve().parents[1]
RESULTADOS = AULA / "resultados"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from figuras_slides import pinta, AZUL_LENTO, AZUL_RAPIDO, MARROM_LENTO, LARANJA_RAPIDO  # noqa: E402
from fractal import caixas, dimensao, fronteira  # noqa: E402

# As fontes do curso, as mesmas dos slides, guardadas em infra/fontes/ com as licenças
for arquivo in ("IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf", "SourceSerif4-Semibold.ttf"):
    register_font(str(RAIZ / "infra" / "fontes" / arquivo))
SANS = "IBM Plex Sans"

# A paleta de infra/slides.py e das figuras
FUNDO, ESCURO, TEXTO, SUAVE, CINZA = "#F6F5F1", "#14213D", "#3B4658", "#5E6A7D", "#8A94A6"
AZUL, LARANJA = "#1F5FAD", "#A8500F"
CONVERGIU, DIVERGIU = AZUL, LARANJA            # as palavras "convergiu" e "divergiu", nas cores do curso

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
    """Uma linha que mistura texto e equação. O pedaço que começa com $ é equação, um pouco maior que o texto,
    para as letras terem a mesma altura; a pontuação depois de uma equação vai dentro dela, como em "$c,$"."""
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


def mil(n):
    """Número inteiro com ponto de milhar: 262.144."""
    return f"{n:,}".replace(",", ".")


def hexa(rgb):
    """Uma cor RGB de 0 a 1 em hexadecimal, que é como o Manim recebe uma cor."""
    return "#" + "".join(f"{round(255 * v):02X}" for v in rgb)


def imagem(rgb, altura):
    """Uma matriz RGB de 0 a 1, com a linha 0 embaixo, como imagem do Manim, com os pixels nítidos."""
    img = ImageMobject((np.clip(rgb[::-1], 0, 1) * 255).astype(np.uint8))
    img.set_resampling_algorithm(RESAMPLING_ALGORITHMS["nearest"])
    img.set_height(altura)
    return img


def mascara(centro, lado, z=5):
    """Quatro retângulos da cor do fundo em volta de um quadrado: escondem o que passa dele quando a imagem cresce."""
    grande = 30
    c = np.array(centro, dtype=float)
    pecas = VGroup(
        Rectangle(width=grande, height=grande).move_to(c + np.array([0, lado / 2 + grande / 2, 0])),
        Rectangle(width=grande, height=grande).move_to(c - np.array([0, lado / 2 + grande / 2, 0])),
        Rectangle(width=grande, height=grande).move_to(c + np.array([lado / 2 + grande / 2, 0, 0])),
        Rectangle(width=grande, height=grande).move_to(c - np.array([lado / 2 + grande / 2, 0, 0])))
    pecas.set_fill(FUNDO, 1).set_stroke(width=0)
    pecas.set_z_index(z)
    return pecas


# ================================================================ 1. repetir uma conta

def iterados(c, passos):
    """Os números de x ← x² + c a partir de 0, até o passo dado ou até passar de 2.

    Com c entre −2 e 2, o número que passa de 2 nunca mais volta: x² já é maior
    que 2|x|, e cada passo o afasta mais. Por isso passar de 2 é fugir.
    """
    x, saida = 0.0, [0.0]
    for _ in range(passos):
        x = x * x + c
        saida.append(x)
        if abs(x) > 2:
            break
    return saida


def mandelbrot(n=600, iteracoes=200):
    """O conjunto de Mandelbrot em n por n pixels, com as cores dos mapas do curso.

    Cada pixel é um c = a + bi do plano, com a de −2,2 a 0,8 e b de −1,5 a 1,5.
    Repete-se z ← z² + c a partir de 0: se |z| passa de 2, a conta foge, e o
    pixel fica laranja, mais claro quanto mais cedo fugiu; se não passou em 200
    passos, fica azul.
    """
    a, b = np.meshgrid(np.linspace(-2.2, 0.8, n), np.linspace(-1.5, 1.5, n))
    c = a + 1j * b
    z = np.zeros_like(c)
    fugiu = np.full(c.shape, iteracoes)
    with np.errstate(all="ignore"):
        for k in range(iteracoes):
            z = z * z + c
            novo = (np.abs(z) > 2) & (fugiu == iteracoes)
            fugiu[novo] = k
            z[np.abs(z) > 2] = 3
    dentro = fugiu == iteracoes
    r = np.clip(1 - np.log1p(fugiu) / np.log1p(40), 0, 1)[..., None]     # 1, fugiu logo; 0, demorou
    rgb = np.where(dentro[..., None], AZUL_LENTO, MARROM_LENTO + r * (LARANJA_RAPIDO - MARROM_LENTO))
    return rgb


class Iteracao(Scene):
    """x ← x² + c a partir de 0, para quatro valores de c; depois a reta dos c, o plano, e o treino."""

    def construct(self):
        self.camera.background_color = FUNDO
        x0, x1 = -4.4, 2.2                     # a reta vai de x = −2 a x = 3; à direita, os vereditos
        cs = [(-1.0, "-1"), (0.25, "0{,}25"), (0.3, "0{,}3"), (1.0, "1")]   # o nome de c, em LaTeX
        ys = [1.9, 0.75, -0.4, -1.55]

        def px(v, y):
            return np.array([x0 + (v + 2) / 5 * (x1 - x0), y, 0])

        leg = legenda("Repetir a conta", "$x \\leftarrow x^2 + c,$", "começando em", "$x = 0$")
        guias = VGroup(*[DashedLine(px(v, ys[0] + 0.35), px(v, ys[-1] - 0.25), color=CINZA, stroke_width=1.5,
                                    dash_length=0.08) for v in range(-2, 4)])
        numeros = VGroup(*[eq(str(v), tamanho=38, cor=TEXTO).move_to(px(v, ys[-1] - 0.62))
                           for v in range(-2, 4)])
        linhas = VGroup(*[Line(px(-2, y), px(3, y), color=ESCURO, stroke_width=3) for y in ys])
        nomes = VGroup(*[eq(f"c = {n}", tamanho=40).next_to(px(-2, y), LEFT, buff=0.45) for (_, n), y in zip(cs, ys)])
        self.play(Write(leg), run_time=1.2)
        self.play(Create(linhas), Create(guias), Write(numeros), Write(nomes), run_time=1.8)

        series = [iterados(c, 14) for c, _ in cs]
        pontos = [Dot(px(0, y), radius=0.11, color=AZUL) for y in ys]
        rastros = VGroup()
        self.play(*[FadeIn(p) for p in pontos], run_time=0.5)
        passo = texto("passo 0", 30, SUAVE).move_to(np.array([5.3, 2.6, 0]))
        self.play(Write(passo), run_time=0.4)
        veredito = [None] * 4
        for k in range(1, 14):
            anims, novos = [], []
            for i, (serie, y) in enumerate(zip(series, ys)):
                if veredito[i] is not None:
                    continue
                if k >= len(serie):
                    continue
                rastros.add(Dot(pontos[i].get_center(), radius=0.05, color=AZUL, fill_opacity=0.35))
                if abs(serie[k]) <= 2:
                    anims.append(pontos[i].animate.move_to(px(serie[k], y)))
                else:                                  # passou de 2: fugiu; além de 3, sai da reta pela direita
                    veredito[i] = k
                    destino = px(serie[k], y) if serie[k] <= 3 else px(3, y) + RIGHT * 0.6
                    anims.append(pontos[i].animate.move_to(destino).set_color(LARANJA))
            novo_passo = texto(f"passo {k}", 30, SUAVE).move_to(passo)
            self.remove(passo)                       # o contador troca de uma vez, sem os dois números juntos
            self.add(rastros, novo_passo)
            passo = novo_passo
            self.play(*anims, run_time=0.55 if k < 6 else 0.4)
        # os vereditos, à direita de cada reta
        frases = []
        for i, ((c, _), y) in enumerate(zip(cs, ys)):
            if veredito[i] is not None:
                f = texto(f"foge no passo {veredito[i]}", 30, DIVERGIU)
            elif c < 0:
                f = texto("fica entre −1 e 0", 30, CONVERGIU)
            else:
                f = texto("chega perto de 0,5", 30, CONVERGIU)
            f.next_to(px(3, y), RIGHT, buff=0.95)
            assert f.get_right()[0] < 6.9, "o veredito sai da tela"
            frases.append(f)
        self.play(FadeOut(passo), *[Write(f) for f in frases], run_time=1.2)
        leg = troca(self, leg, "Fugir: passar de 2 em algum passo. Daí em diante, só cresce")
        self.wait(2.2)

        # a reta dos c: cada c pintado pela resposta
        tudo = VGroup(linhas, guias, numeros, nomes, rastros, *frases)
        self.play(FadeOut(tudo), *[FadeOut(p) for p in pontos], run_time=0.8)
        leg = troca(self, leg, "A mesma pergunta para cada", "$c$", "de", "$-2{,}5$", "a", "$1$")
        ca, cb, yc = -6.0, 5.6, 0.4

        def pc(v):
            return np.array([ca + (v + 2.5) / 3.5 * (cb - ca), yc, 0])

        eixo = Line(pc(-2.5), pc(1), color=ESCURO, stroke_width=3)
        marcas = VGroup(*[eq(n, tamanho=38, cor=TEXTO).move_to(pc(v) + DOWN * 0.75)
                          for v, n in ((-2.5, "-2{,}5"), (-2, "-2"), (-1, "-1"), (0, "0"), (0.25, "0{,}25"), (1, "1"))])
        tracos = VGroup(*[Line(pc(v) + DOWN * 0.3, pc(v) + DOWN * 0.42, color=ESCURO, stroke_width=2.5)
                          for v in (-2.5, -2, -1, 0, 0.25, 1)])
        self.play(Create(eixo), Create(tracos), Write(marcas), run_time=1.2)
        n = 140
        faixas = VGroup()
        for j in range(n):
            c = -2.5 + 3.5 * (j + 0.5) / n
            fica = all(abs(v) <= 2 for v in iterados(c, 200))
            faixas.add(Rectangle(width=(cb - ca) / n + 0.005, height=0.5, stroke_width=0)
                       .set_fill(CONVERGIU if fica else DIVERGIU, 1).move_to(pc(c)))
        self.play(FadeIn(faixas, lag_ratio=0.02), run_time=2.4)
        fronteira_ = VGroup(*[Line(pc(v) + UP * 0.45, pc(v) + DOWN * 0.3, color=ESCURO, stroke_width=5) for v in (-2, 0.25)])
        rotulos = VGroup(texto("fica", 30, CONVERGIU).move_to(pc(-0.9) + UP * 0.75),
                         texto("foge", 30, DIVERGIU).move_to(pc(-2.25) + UP * 0.75),
                         texto("foge", 30, DIVERGIU).move_to(pc(0.62) + UP * 0.75))
        self.play(Create(fronteira_), Write(rotulos), run_time=1.0)
        leg = troca(self, leg, "Na reta, a fronteira são dois pontos:", "$-2$", "e", "$0{,}25$")
        self.wait(2.4)

        # o plano: c com dois números; a mesma pergunta desenha o conjunto de Mandelbrot
        self.play(FadeOut(VGroup(eixo, marcas, tracos, faixas, fronteira_, rotulos)), run_time=0.8)
        leg = troca(self, leg, "Com", "$c$", "no plano, dois números, a fronteira é um fractal")
        mand = imagem(mandelbrot(), 5.2).move_to(np.array([-3.3, -0.35, 0]))
        nome_m = eq("z \\leftarrow z^2 + c", tamanho=44).next_to(mand, DOWN, buff=0.3)
        self.play(FadeIn(mand), Write(nome_m), run_time=1.6)
        self.wait(1.5)
        z = json.loads((RESULTADOS / "zoom.json").read_text(encoding="utf-8"))
        treino = imagem(pinta(np.load(RESULTADOS / "zoom-0.npy")), 5.2).move_to(np.array([3.3, -0.35, 0]))
        nome_t = eq("\\vec{w} \\leftarrow \\vec{w} - \\eta\\, \\nabla L(\\vec{w})", tamanho=44).next_to(treino, DOWN, buff=0.3)
        leg = troca(self, leg, "No treino, a conta repetida é o passo do gradiente")
        self.play(FadeIn(treino), Write(nome_t), run_time=1.6)
        assert z["janelas"][0] == [-3.0, 6.0, -3.0, 6.0]
        self.wait(3.0)


# ================================================================ 2. cada pixel é um treino

class Pixel(Scene):
    """Quatro treinos com a perda passo a passo; cada um vira um pixel, e o plano se enche."""

    def construct(self):
        self.camera.background_color = FUNDO
        r = json.loads((RESULTADOS / "curvas.json").read_text(encoding="utf-8"))
        S, C = 5.0, np.array([-2.7, -0.1, 0])            # o plano das taxas: lado e centro
        x0, x1 = -3.0, 6.0                                # log10 das taxas, nos dois eixos

        def no_plano(a, b):
            return C + np.array([(a - x0) / (x1 - x0) - 0.5, (b - x0) / (x1 - x0) - 0.5, 0]) * S

        quadro = Square(S, color=ESCURO, stroke_width=2.5).move_to(C)
        marcas = VGroup()
        for v in (-3, 0, 3, 6):
            n = str(v)
            marcas.add(eq(n, tamanho=38, cor=TEXTO).move_to(no_plano(v, x0) + DOWN * 0.42))
            marcas.add(eq(n, tamanho=38, cor=TEXTO).move_to(no_plano(x0, v) + LEFT * 0.42))
        nome_x = eq("\\log_{10} \\eta_0", tamanho=40).next_to(marcas, DOWN, buff=0.12)
        nome_y = eq("\\log_{10} \\eta_1", tamanho=40).rotate(math.pi / 2).next_to(quadro, LEFT, buff=0.85)

        # o painel da direita, de cima para baixo: o par de taxas (2,65), o veredito (2,05), o nome do eixo
        # vertical, o gráfico da perda, os números do passo e o nome do eixo horizontal
        eixos = Axes(x_range=[0, 100, 25], y_range=[-1, 3, 1], x_length=5.4, y_length=3.5,
                     axis_config={"color": ESCURO, "stroke_width": 2.5, "include_tip": False},
                     ).move_to(np.array([3.95, -0.75, 0]))
        rot_x = VGroup(*[eq(str(v), tamanho=38, cor=TEXTO).next_to(eixos.c2p(v, -1), DOWN, buff=0.2)
                         for v in (0, 50, 100)])
        rot_y = VGroup(*[eq(n, tamanho=38, cor=TEXTO).next_to(eixos.c2p(0, v), LEFT, buff=0.2)
                         for v, n in ((-1, "0{,}1"), (0, "1"), (1, "10"), (2, "100"), (3, "1000"))])
        nome_passo = texto("passo do treino", 30, TEXTO).next_to(rot_x, DOWN, buff=0.2)
        nome_v = frase("$L_t / L_0,$", "a perda sobre a do começo", tamanho=30).next_to(eixos, UP, buff=0.3)
        assert nome_v.get_top()[1] < 1.75 and nome_passo.get_bottom()[1] > -3.95, "o painel da direita não cabe"
        um = DashedLine(eixos.c2p(0, 0), eixos.c2p(100, 0), color=CINZA, stroke_width=2)

        leg = legenda("Cada par de taxas, uma por camada, é um treino da rede do projeto")
        self.play(Write(leg), run_time=1.2)
        self.play(Create(quadro), Write(marcas), Write(nome_x), Write(nome_y), run_time=1.6)
        self.play(Create(eixos), Write(rot_x), Write(rot_y), Write(nome_passo), Write(nome_v), Create(um), run_time=1.6)

        lado_pixel = S / 32
        pixels = VGroup()
        nomes_veredito = ["convergiu devagar", "convergiu rápido", "divergiu devagar", "divergiu rápido"]
        cores_pixel = [hexa(c) for c in (AZUL_LENTO, AZUL_RAPIDO, MARROM_LENTO, LARANJA_RAPIDO)]
        for k, ((a, b), perdas, medida) in enumerate(zip(r["pares_log10"], r["perdas"], r["medida"])):
            p = no_plano(a, b)
            alvo = Dot(p, radius=0.09, color=ESCURO)
            def taxa_tex(v):
                """A taxa para a equação: inteira com ponto de milhar a partir de 100; com uma casa abaixo disso."""
                return mil(round(v)) if v >= 100 else tex(v, 1)
            par = frase(f"$\\eta_0 = {taxa_tex(10 ** a)},$", f"$\\eta_1 = {taxa_tex(10 ** b)}$", tamanho=30)
            par.move_to(np.array([3.95, 2.65, 0]))
            self.play(FadeIn(alvo, scale=2), Write(par), run_time=0.8)
            v = [x / perdas[0] if x is not None else None for x in perdas]
            pts = []
            for t_, x in enumerate(v):
                if x is None or not math.isfinite(x) or x > 1e3:
                    pts.append(eixos.c2p(t_, 3.0))
                    break
                pts.append(eixos.c2p(t_, max(math.log10(x), -1)))
            convergiu = medida < 0
            cor = CONVERGIU if convergiu else DIVERGIU
            curva = VGroup().set_points_as_corners(pts).set_stroke(cor, 4)
            self.play(Create(curva), run_time=2.0 if len(pts) > 10 else 0.8, rate_func=linear)
            f = texto(nomes_veredito[k], 30, cor).move_to(np.array([3.95, 2.05, 0]))
            px_ = Square(lado_pixel).set_stroke(ESCURO, 1.5).set_fill(cores_pixel[k], 1).move_to(p)
            self.play(Write(f), FadeOut(alvo), FadeIn(px_), run_time=0.8)
            pixels.add(px_)
            self.wait(1.0)
            self.play(FadeOut(curva), FadeOut(f), FadeOut(par), run_time=0.5)

        # o plano se enche: 8, 16, 32, 64, 128 e 512 pixels de lado
        self.play(FadeOut(VGroup(eixos, rot_x, rot_y, nome_passo, nome_v, um)), run_time=0.6)
        leg = troca(self, leg, "Um treino por pixel, do zero, com o seu par de taxas")
        contador = VGroup()
        anterior = None
        for lado in (8, 16, 32, 64, 128, 512):
            V = np.load(RESULTADOS / (f"resolucao-{lado}.npy" if lado < 512 else "zoom-0.npy"))
            img = imagem(pinta(V), S).move_to(C)
            img.set_z_index(-1)
            novo = VGroup(texto(f"{lado} × {lado}", 40, ESCURO),
                          texto(f"{mil(lado * lado)} treinos", 30, TEXTO)).arrange(DOWN, buff=0.25)
            novo.move_to(np.array([3.6, 0.4, 0]))
            # o número velho sai antes de o novo entrar, para os dois nunca ficarem um sobre o outro
            self.play(FadeOut(contador) if anterior is not None else FadeOut(pixels), run_time=0.3)
            anims = [FadeIn(img), FadeIn(novo)]
            if anterior is not None:
                anims.append(FadeOut(anterior))
            self.play(*anims, run_time=0.8)
            anterior, contador = img, novo
            self.wait(1.2 if lado < 512 else 0.5)
        tempo = json.loads((RESULTADOS / "zoom.json").read_text(encoding="utf-8"))["segundos"][0]
        nota = texto(f"{round(tempo)} s no laptop, em 16 processos", 30, SUAVE)
        nota.next_to(contador, DOWN, buff=0.5)
        assert nota.get_right()[0] < 7.0, "a nota passa da borda"
        self.play(Write(nota), run_time=1.0)
        leg = troca(self, leg, "Azul, convergiu; laranja, divergiu. Mais claro, mais rápido")
        self.wait(3.0)


# ================================================================ 3. o zoom

class Zoom(Scene):
    """As seis janelas de fractal.py, cada uma quatro vezes menor, com o aumento e as taxas ao lado."""

    def construct(self):
        self.camera.background_color = FUNDO
        z = json.loads((RESULTADOS / "zoom.json").read_text(encoding="utf-8"))
        S, D = 6.6, np.array([-2.75, -0.4, 0])          # o lado e o centro do quadro do zoom
        imgs = [pinta(np.load(RESULTADOS / f"zoom-{k}.npy")) for k in range(len(z["janelas"]))]
        self.add(mascara(D, S))
        borda = Square(S, color=ESCURO, stroke_width=2.5).move_to(D).set_z_index(6)

        def faixa(lo, hi):
            """As duas pontas do intervalo de taxas, 10^lo e 10^hi, como texto.

            Casas decimais bastantes para as duas pontas serem diferentes quando a
            janela é estreita; abaixo de 10, pelo menos uma casa, e abaixo de 1, dois
            algarismos depois dos zeros, para 0,944 não virar 1.
            """
            a, b = 10 ** lo, 10 ** hi
            casas = max(0, int(math.ceil(-math.log10(b - a))) + 1) if b - a < 10 else 0

            def f(v):
                if v >= 1000:
                    return mil(round(v))
                if v < 1:
                    return f"{v:.2g}".replace(".", ",")      # dois algarismos significativos: 0,94; 0,001
                return br(v, max(casas, 1 if v < 10 else 0))
            return f(a), f(b)

        def painel(k):
            j = z["janelas"][k]
            e0, e1 = faixa(j[0], j[1]), faixa(j[2], j[3])
            g = VGroup(texto("aumento", 30, SUAVE), texto(f"{mil(4 ** k)} ×", 48, ESCURO),
                       frase("$\\eta_0$", f"de {e0[0]} a {e0[1]}", tamanho=30),
                       frase("$\\eta_1$", f"de {e1[0]} a {e1[1]}", tamanho=30)).arrange(DOWN, buff=0.32, aligned_edge=LEFT)
            g.move_to(np.array([4.35, -0.4, 0])).set_z_index(7)
            assert g.get_right()[0] < 7.0 and g.get_left()[0] > D[0] + S / 2 + 0.2, "o painel não cabe"
            return g

        atual = imagem(imgs[0], S).move_to(D)
        leg = legenda("A janela inteira: taxas de 0,001 a 1 milhão nas duas camadas").set_z_index(7)
        txt = painel(0)
        self.play(Write(leg), FadeIn(atual), Create(borda), Write(txt), run_time=1.6)
        self.wait(1.5)
        for k in range(1, len(imgs)):
            j0, j1 = z["janelas"][k - 1], z["janelas"][k]
            w = j0[1] - j0[0]
            F = D + np.array([((j1[0] + j1[1]) / 2 - j0[0]) / w - 0.5, ((j1[2] + j1[3]) / 2 - j0[2]) / w - 0.5, 0]) * S
            quadrado = Square(S / 4, color="black", stroke_width=4).move_to(F).set_z_index(4)
            self.play(Create(quadrado), run_time=0.8)
            proxima = imagem(imgs[k], S / 4).move_to(F)
            proxima.set_opacity(0)
            self.add(proxima)
            t = ValueTracker(0.0)

            def atualiza(_, a=atual, p=proxima, q=quadrado, F=F):
                tt = t.get_value()
                zf = 4 ** tt
                Dt = F + (D - F) * (zf - 1) / 3
                a.set_height(S * zf).move_to(Dt + zf * (D - F))
                p.set_height(S / 4 * zf).move_to(Dt)
                q.set_width(S / 4 * zf).move_to(Dt)
                # a janela nova aparece no fim, quando já cobre a maior parte do quadro: as cores de cada
                # janela se ajustam ao próprio mapa, e a borda dela ficaria visível por mais tempo
                p.set_opacity(float(np.clip((tt - 0.6) / 0.35, 0, 1)))
                q.set_stroke(opacity=float(np.clip(1 - tt / 0.5, 0, 1)))

            atual.add_updater(atualiza)
            self.play(t.animate.set_value(1.0), run_time=3.2, rate_func=lambda s: 0.5 - 0.5 * math.cos(math.pi * s))
            atual.clear_updaters()
            self.remove(atual, quadrado)
            atual = proxima
            atual.set_opacity(1)
            novo = painel(k)
            if k == 1:
                leg2 = legenda("Cada janela é quatro vezes menor que a anterior").set_z_index(7)
            elif k == len(imgs) - 1:
                leg2 = legenda("Mil vezes de aumento, e a fronteira continua cheia de detalhe").set_z_index(7)
            else:
                leg2 = None
            # o texto velho sai antes de o novo entrar
            self.play(FadeOut(txt), *([FadeOut(leg)] if leg2 is not None else []), run_time=0.3)
            self.play(FadeIn(novo), *([FadeIn(leg2)] if leg2 is not None else []), run_time=0.5)
            if leg2 is not None:
                leg = leg2
            txt = novo
            self.wait(1.4 if k < len(imgs) - 1 else 3.5)


# ================================================================ 4. a contagem de caixas

def grade_rgb(f, s, ampliar=2, tinta=(168 / 255, 80 / 255, 15 / 255), cor_fronteira=(0.08, 0.13, 0.24)):
    """A imagem da fronteira com as caixas de lado s que a tocam pintadas de laranja claro, e a grade.

    O laranja claro é o LARANJA do curso, #A8500F, misturado ao fundo.

    f: a fronteira, uma matriz de verdadeiro ou falso; a imagem sai ampliada
    `ampliar` vezes, para a grade ter linhas finas. Devolve a matriz RGB.
    """
    n = f.shape[0]
    m = n // s
    tocada = f[:m * s, :m * s].reshape(m, s, m, s).any(axis=(1, 3))
    rgb = np.ones((n, n, 3)) * np.array([0.965, 0.961, 0.945])
    caixa = np.kron(tocada, np.ones((s, s), dtype=bool))
    rgb[caixa] = 0.55 * np.array(tinta) + 0.45 * rgb[caixa]
    rgb[f] = cor_fronteira
    rgb = rgb.repeat(ampliar, 0).repeat(ampliar, 1)
    if s * ampliar >= 8:                        # as linhas da grade, só quando as caixas são grandes o bastante
        passo = s * ampliar
        rgb[::passo, :] = 0.75
        rgb[:, ::passo] = 0.75
        rgb[-1, :] = 0.75
        rgb[:, -1] = 0.75
    return rgb


class Caixas(Scene):
    """A dimensão pela contagem de caixas: a linha, a área e a fronteira da janela 3 do zoom."""

    def construct(self):
        self.camera.background_color = FUNDO
        S, C = 5.8, np.array([-3.6, -0.45, 0])
        n = 512

        # 1. a linha e a área, para calibrar
        linha_ = np.eye(n, dtype=bool)[::-1]                    # a diagonal, de baixo à esquerda ao alto à direita
        area = np.zeros((n, n), dtype=bool)
        area[128:384, 128:384] = True
        leg = legenda("Cobrir a figura com caixas e contar as que ela toca")
        self.play(Write(leg), run_time=1.0)

        def mostra(fig, tamanhos, nome, cor_nome):
            img = None
            linhas_ = VGroup()
            for i, s in enumerate(tamanhos):
                N = caixas(fig, [s])[0]
                nova = imagem(grade_rgb(fig, s), S).move_to(C)
                linha_txt = VGroup(texto(f"caixa de {s} pixels", 30, TEXTO), texto(f"{mil(N)} caixas", 30, ESCURO))
                linha_txt.arrange(RIGHT, buff=0.6)
                linha_txt.move_to(np.array([3.2, 1.6 - 0.8 * i, 0]))
                anims = [FadeIn(nova), Write(linha_txt)]
                if img is not None:
                    anims.append(FadeOut(img))
                self.play(*anims, run_time=1.0)
                img = nova
                linhas_.add(linha_txt)
                self.wait(0.6)
            return img, linhas_

        img, linhas_ = mostra(linha_, (128, 64, 32), "linha", ESCURO)
        concl = texto("caixa pela metade: 2 vezes mais caixas", 30, AZUL).move_to(np.array([3.2, -1.1, 0]))
        self.play(Write(concl), run_time=0.8)
        self.wait(1.5)
        self.play(FadeOut(img), FadeOut(linhas_), FadeOut(concl), run_time=0.6)
        img, linhas_ = mostra(area, (128, 64, 32), "área", ESCURO)
        concl = texto("caixa pela metade: 4 vezes mais caixas", 30, AZUL).move_to(np.array([3.2, -1.1, 0]))
        self.play(Write(concl), run_time=0.8)
        regra = VGroup(frase("linha: 2 =", "$2^1$", tamanho=30), frase("área: 4 =", "$2^2$", tamanho=30))
        regra.arrange(DOWN, buff=0.25, aligned_edge=LEFT).move_to(np.array([3.2, -2.4, 0]))
        leg = troca(self, leg, "O expoente é a dimensão: 1 na linha, 2 na área")
        self.play(Write(regra), run_time=1.0)
        self.wait(2.0)
        self.play(FadeOut(img), FadeOut(linhas_), FadeOut(concl), FadeOut(regra), run_time=0.6)

        # 2. a fronteira da janela 3 do zoom
        V = np.load(RESULTADOS / "zoom-3.npy")
        f = fronteira(V)
        leg = troca(self, leg, "A fronteira da janela 3 do zoom, 64 vezes ampliada")
        base = imagem(pinta(V), S).move_to(C)
        self.play(FadeIn(base), run_time=1.0)
        so_fronteira = imagem(grade_rgb(f, 1, ampliar=1), S).move_to(C)
        self.play(FadeIn(so_fronteira), run_time=1.0)
        self.remove(base)
        self.wait(1.0)

        # o i-ésimo tamanho de caixa fica em x = i + 0,5, longe do canto, para 1/16 não encostar em 2⁶
        eixos = Axes(x_range=[0, 4, 1], y_range=[6, 16, 2], x_length=4.6, y_length=3.0,
                     axis_config={"color": ESCURO, "stroke_width": 2.5, "include_tip": False},
                     x_axis_config={"include_ticks": False}).move_to(np.array([3.75, -0.95, 0]))
        tracos_x = VGroup(*[Line(eixos.c2p(i + 0.5, 6) + DOWN * 0.08, eixos.c2p(i + 0.5, 6) + UP * 0.08,
                                 color=ESCURO, stroke_width=2.5) for i in range(4)])
        eixos.add(tracos_x)
        rot_x = VGroup(*[eq(f"1/{s}", tamanho=38, cor=TEXTO).next_to(eixos.c2p(i + 0.5, 6), DOWN, buff=0.2)
                         for i, s in enumerate((16, 8, 4, 2))])
        nome_x = frase("$1/s,$", "o inverso do lado da caixa", tamanho=30).next_to(rot_x, DOWN, buff=0.15)
        assert nome_x.get_bottom()[1] > -3.9, "o nome do eixo sai da tela"
        rot_y = VGroup(*[eq(f"2^{{{v}}}", tamanho=38, cor=TEXTO).next_to(eixos.c2p(0, v), LEFT, buff=0.2)
                         for v in (6, 10, 14)])
        nome_y = frase("$N,$", "as caixas tocadas", tamanho=30).next_to(eixos, UP, buff=0.25).align_to(eixos, LEFT)
        self.play(Create(eixos), Write(rot_x), Write(nome_x), Write(rot_y), Write(nome_y), run_time=1.4)

        tamanhos = (16, 8, 4, 2)
        contagens = caixas(f, list(tamanhos))
        pontos = VGroup()
        img = so_fronteira
        contador = None
        for i, (s, N) in enumerate(zip(tamanhos, contagens)):
            nova = imagem(grade_rgb(f, s), S).move_to(C)
            ponto = Dot(eixos.c2p(i + 0.5, math.log2(N)), radius=0.09, color=LARANJA)
            novo_cont = VGroup(texto(f"caixa de {s} pixels", 30, TEXTO),
                               texto(f"{mil(N)} caixas", 30, ESCURO)).arrange(RIGHT, buff=0.6)
            novo_cont.move_to(np.array([3.6, 1.8, 0]))
            if contador is not None:
                self.play(FadeOut(contador), run_time=0.3)
            self.play(FadeIn(nova), FadeOut(img), FadeIn(ponto, scale=2), FadeIn(novo_cont), run_time=0.8)
            img, contador = nova, novo_cont
            pontos.add(ponto)
            self.wait(0.8)
        d, _ = dimensao(f, tamanhos)
        b = np.polyfit(range(4), np.log2(contagens), 1)
        reta = Line(eixos.c2p(0.2, b[1] - 0.3 * b[0]), eixos.c2p(3.8, b[1] + 3.3 * b[0]), color=AZUL, stroke_width=3)
        reta.set_z_index(-1)
        self.play(Create(reta), run_time=1.0)
        conta = VGroup(texto("caixa pela metade:", 30, TEXTO),
                       frase(f"$2^{{{tex(d)}}} \\approx {tex(2 ** d)}$", "vezes mais caixas", tamanho=30))
        conta.arrange(DOWN, buff=0.2, aligned_edge=LEFT).move_to(np.array([3.75, 2.2, 0]))
        assert conta.get_right()[0] < 7.0, "a conta passa da borda"
        assert conta.get_bottom()[1] - nome_y.get_top()[1] > 0.4, "a conta encosta no nome do eixo"
        self.play(FadeOut(contador), run_time=0.3)
        self.play(Write(conta), run_time=1.0)
        leg = troca(self, leg, f"Dimensão {br(d)}: mais que uma linha, menos que uma área")
        self.wait(3.5)


CENAS = {"iteracao": Iteracao, "pixel": Pixel, "zoom": Zoom, "caixas": Caixas}


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
