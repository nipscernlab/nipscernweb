"""Os vídeos da aula 7, feitos com o Manim Community.

Rode, a partir da raiz do repositório, depois de taxa.py, que grava os números, com o nome dos vídeos que
quer gravar, ou sem nome nenhum para gravar todos:
    python aulas/07-pytorch/codigo/animacoes.py
    python aulas/07-pytorch/codigo/animacoes.py grafo adam

Os três vídeos, na ordem da aula:
    grafo         o grafo das contas da rede da aula 4: os valores para a frente e, com backward(), a derivada
                  da perda por cada nó, até o gradiente (1,0940; −4,6074)
    adam          o gradiente descendente e o Adam numa tigela alongada: um ziguezagueia, o outro dá passos de
                  tamanho parecido nas duas direções
    taxa-limiar   a varredura das taxas, ponto a ponto, e depois a fronteira quebrada perto do limiar

Todo render do curso é em 1080p, 1920 por 1080, a 30 quadros por segundo. Uma
opção grava só o último quadro, para conferir a composição:
    --quadros

O vídeo sai em aulas/07-pytorch/videos/taxa-limiar.mp4, e o último quadro, que o
slide mostra parado, em aulas/07-pytorch/figuras/taxa-limiar-quadro.png. As
regras são as dos vídeos das aulas anteriores: sem título próprio, texto com pelo
menos 30 pontos do Manim, número com pelo menos 28, nada sobreposto, cada texto
num lugar fixo. Nada é sorteado: os pontos são os de resultados/taxa.json.
"""
import json
import math
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from manim import (DOWN, LEFT, RIGHT, UP, Arrow, Create, DashedLine, Dot, FadeIn, FadeOut, GrowArrow, LaggedStart,
                   Line, MathTex, Rectangle, Scene, Square, SurroundingRectangle, TexTemplate, Text, Transform, Triangle,
                   VGroup, VMobject, Write, config, tempconfig)
from manimpango import register_font

RAIZ = Path(__file__).resolve().parents[3]
AULA = Path(__file__).resolve().parents[1]

for arquivo in ("IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf", "SourceSerif4-Semibold.ttf"):
    register_font(str(RAIZ / "infra" / "fontes" / arquivo))
SANS = "IBM Plex Sans"

FUNDO, ESCURO, TEXTO, SUAVE = "#F6F5F1", "#14213D", "#3B4658", "#5E6A7D"
AZUL, LARANJA, CINZA = "#1F5FAD", "#A8500F", "#8A94A6"

MODELO = TexTemplate(preamble="\\usepackage[T1]{fontenc}\n\\usepackage{amsmath}\n\\usepackage{stix2}\n")
config.tex_template = MODELO


def texto(s, tamanho=30, cor=TEXTO):
    """Texto corrido, na fonte dos slides."""
    return Text(s, font=SANS, font_size=tamanho, color=cor)


def num(s, tamanho=28, cor=TEXTO):
    """Número do eixo em LaTeX, na STIX Two, com vírgula decimal sem espaço."""
    return MathTex(s.replace(",", "{,}"), font_size=tamanho, color=cor, tex_template=MODELO)


class Grafico:
    """Um retângulo de gráfico na tela, com o eixo x em escala log ou linear e o y em escala log.

    canto: o canto de baixo à esquerda, na tela; largura e altura, na tela;
    xlim e ylim: os limites dos dados; logx: o eixo x em escala logarítmica.
    """

    def __init__(self, canto, largura, altura, xlim, ylim, logx):
        self.canto, self.largura, self.altura = np.array([*canto, 0.0]), largura, altura
        self.xlim, self.ylim, self.logx = xlim, ylim, logx

    def p(self, x, y):
        """Leva o ponto (x, y) dos dados para a tela."""
        fx = ((math.log10(x) - math.log10(self.xlim[0])) / (math.log10(self.xlim[1]) - math.log10(self.xlim[0]))
              if self.logx else (x - self.xlim[0]) / (self.xlim[1] - self.xlim[0]))
        fy = (math.log10(y) - math.log10(self.ylim[0])) / (math.log10(self.ylim[1]) - math.log10(self.ylim[0]))
        return self.canto + np.array([fx * self.largura, fy * self.altura, 0.0])

    def moldura(self, marcas_x, marcas_y, nome_x, nome_y):
        """A moldura, as marcas com os números e os nomes dos eixos, por fora do retângulo."""
        caixa = Rectangle(width=self.largura, height=self.altura, color=ESCURO, stroke_width=2.5)
        caixa.move_to(self.canto + np.array([self.largura / 2, self.altura / 2, 0]))
        numeros = VGroup()
        for v, s in marcas_x:
            b = self.p(v, self.ylim[0])
            numeros.add(Line(b, b + UP * 0.12, color=ESCURO, stroke_width=2.5), num(s).next_to(b, DOWN, buff=0.14))
        for v, s in marcas_y:
            b = self.p(self.xlim[0], v)
            numeros.add(Line(b, b + RIGHT * 0.12, color=ESCURO, stroke_width=2.5), num(s).next_to(b, LEFT, buff=0.14))
        nx = texto(nome_x, 30).next_to(caixa, DOWN, buff=0.62)
        ny = texto(nome_y, 30).rotate(math.pi / 2).next_to(caixa, LEFT, buff=0.95)
        return VGroup(caixa, numeros, nx, ny)


def marcador(ponto, tipo, raio=0.045):
    """Círculo azul onde o treino melhora a rede, quadrado laranja onde piora, triângulo onde explode."""
    if tipo == "melhora":
        return Dot(ponto, radius=raio, color=AZUL)
    if tipo == "piora":
        return Square(side_length=2 * raio * 0.95, color=LARANJA, fill_opacity=1, stroke_width=0).move_to(ponto)
    return Triangle(color=ESCURO, fill_opacity=1, stroke_width=0).scale(raio * 1.5).move_to(ponto)


class TaxaLimiar(Scene):
    """A varredura das taxas, ponto a ponto, e depois a fronteira quebrada perto do limiar."""

    def construct(self):
        self.camera.background_color = FUNDO
        r = json.loads((AULA / "resultados" / "taxa.json").read_text(encoding="utf-8"))
        antes = r["perda_antes"]

        def tipo(e):
            return "explode" if e is None else ("piora" if e > antes else "melhora")

        def legenda(s):
            t_ = texto(s, 30, TEXTO).move_to(np.array([0, 3.45, 0]))
            assert t_.width < 13, f"legenda larga demais para o quadro: {s}"   # o quadro tem 14,2 de largura
            return t_

        def troca(velha, nova):
            self.play(FadeOut(velha), run_time=0.4)
            self.play(FadeIn(nova), run_time=0.5)
            return nova

        # ------------------------------------------------ 1. a varredura larga, de 0,01 a 100
        g = Grafico((-5.2, -2.2), 10.8, 4.9, (0.008, 125), (3e-3, 1500), logx=True)
        moldura = g.moldura([(0.01, "0,01"), (0.1, "0,1"), (1, "1"), (10, "10"), (100, "100")],
                            [(0.01, "0,01"), (1, "1"), (100, "100")], "taxa de aprendizado", "erro final")
        linha_antes = DashedLine(g.p(0.008, antes), g.p(125, antes), color=CINZA, stroke_width=2.5, dash_length=0.12)
        nome_antes = texto("perda antes do treino", 28, SUAVE).next_to(g.p(0.008, antes), UP + RIGHT, buff=0.12)
        leg = legenda("cada ponto, uma rede treinada com uma taxa, por 200 passos")
        self.play(FadeIn(leg), Create(moldura), run_time=1.6)
        self.play(Create(linha_antes), FadeIn(nome_antes), run_time=0.8)
        pontos = VGroup(*[marcador(g.p(a, e if e is not None else 600), tipo(e))
                          for a, e in zip(r["larga"]["taxas"], r["larga"]["finais"])])
        self.play(LaggedStart(*[FadeIn(pt, scale=1.6) for pt in pontos], lag_ratio=0.04), run_time=7)
        self.wait(1)

        # ------------------------------------------------ 2. a janela perto do limiar
        janela = Rectangle(width=g.p(10, 1)[0] - g.p(2, 1)[0], height=g.altura, color=LARANJA, stroke_width=4)
        janela.move_to(np.array([(g.p(10, 1)[0] + g.p(2, 1)[0]) / 2, g.canto[1] + g.altura / 2, 0]))
        leg = troca(leg, legenda("depois do melhor ponto, o erro sobe: de 2 a 10, de perto"))
        self.play(Create(janela), run_time=1.0)
        self.wait(1.2)
        self.play(FadeOut(VGroup(moldura, linha_antes, nome_antes, pontos, janela)), run_time=0.8)

        # ------------------------------------------------ 3. a varredura fina, de 2 a 10, e a faixa
        f = Grafico((-5.2, -1.3), 10.8, 3.9, (2, 10), (3e-3, 300), logx=False)
        moldura_f = f.moldura([(2, "2"), (4, "4"), (6, "6"), (8, "8"), (10, "10")],
                              [(0.01, "0,01"), (1, "1"), (100, "100")], "taxa de aprendizado", "erro final")
        # o nome do eixo x sai de baixo do gráfico e vai para baixo da faixa
        moldura_f[2].next_to(np.array([0, -3.05, 0]), DOWN, buff=0.08)
        linha_f = DashedLine(f.p(2, antes), f.p(10, antes), color=CINZA, stroke_width=2.5, dash_length=0.12)
        leg = troca(leg, legenda("601 taxas: azul, o treino melhora a rede; laranja, piora"))
        self.play(Create(moldura_f), Create(linha_f), run_time=1.2)
        finos = VGroup(*[marcador(f.p(a, e if e is not None else 250), tipo(e), raio=0.03)
                         for a, e in zip(r["fina"]["taxas"], r["fina"]["finais"])])
        self.play(LaggedStart(*[FadeIn(pt) for pt in finos], lag_ratio=0.01), run_time=5)
        largura_listra = f.largura / len(r["fina"]["taxas"])
        faixa = VGroup(*[Rectangle(width=largura_listra * 1.02, height=0.42, stroke_width=0,
                                   fill_color=(AZUL if tipo(e) == "melhora" else LARANJA), fill_opacity=1)
                         .move_to(np.array([f.p(a, 1)[0], -2.62, 0]))
                         for a, e in zip(r["fina"]["taxas"], r["fina"]["finais"])])
        self.play(LaggedStart(*[FadeIn(lst) for lst in faixa], lag_ratio=0.01), run_time=3.5)
        leg = troca(leg, legenda("a fronteira entre melhorar e piorar não é um ponto: é quebrada"))
        self.wait(3)


# ================================================================ as frases do alto, nos vídeos novos

def eq(tex, tamanho=36, cor=ESCURO):
    """Equação em LaTeX, na STIX Two."""
    return MathTex(tex, font_size=tamanho, color=cor, tex_template=MODELO)


def no_alto(s):
    """A frase do alto do vídeo, que diz o que está acontecendo; cabe na largura com folga."""
    f = texto(s, 30).move_to(np.array([0, 3.45, 0]))
    assert f.width < 13, s
    return f


def troca_frase(cena, atual, s):
    """Apaga a frase do alto e escreve a seguinte."""
    nova = no_alto(s)
    cena.play(FadeOut(atual), run_time=0.35)
    cena.play(Write(nova), run_time=0.9)
    return nova


def tex_num(v, casas=4):
    """Número em LaTeX, com vírgula decimal sem espaço; o zero sai 0."""
    if abs(v) < 0.5 * 10 ** -casas:
        return "0"
    return f"{v:.{casas}f}".replace(".", "{,}")


def par(v, casas=4):
    """Um vetor de dois números em LaTeX, com ponto e vírgula: (0{,}6351;\\ 0)."""
    return rf"({tex_num(v[0], casas)};\ {tex_num(v[1], casas)})"


# ================================================================ o grafo das contas, com os números da aula 4

def contas_da_aula_4():
    """A rede da aula 4 no ponto x⃗ = (1; 0,25), pelo PyTorch: os valores de cada nó e a derivada de L por eles."""
    import torch
    sys.path.insert(0, str(RAIZ / "aulas" / "04-jacobiano" / "codigo"))
    from jacobiano import B1, B2, C, T, V, W1, W2, X0
    x = torch.tensor(X0, requires_grad=True)
    W1t, B1t, W2t, B2t, Vt = (torch.tensor(a) for a in (W1, B1, W2, B2, V))
    h1 = torch.tanh(W1t @ x + B1t)
    h2 = torch.tanh(W2t @ h1 + B2t)
    y = Vt @ h2 + C
    L = (y - T) ** 2
    for n in (h1, h2, y):
        n.retain_grad()                     # o PyTorch guarda a derivada só das folhas; aqui, de todos os nós
    L.backward()
    return {"x": (X0, x.grad.numpy()), "h1": (h1.detach().numpy(), h1.grad.numpy()),
            "h2": (h2.detach().numpy(), h2.grad.numpy()), "y": (y.item(), y.grad.item()), "L": (L.item(), 1.0)}


class Grafo(Scene):
    """O grafo das contas da rede da aula 4: para a frente, o valor de cada nó; para trás, com backward(), a derivada
    da perda por cada nó, até a entrada, (1,0940; −4,6074), o gradiente da aula 4."""

    def construct(self):
        self.camera.background_color = FUNDO
        v = contas_da_aula_4()
        nomes = [("x", r"\vec{x}"), ("h1", r"\vec{h}_1"), ("h2", r"\vec{h}_2"), ("y", "y"), ("L", "L")]
        xs = [-5.4, -2.7, 0.0, 2.7, 5.4]
        y_no = 1.1
        caixas = VGroup(*[VGroup(Rectangle(width=1.5, height=0.9, color=ESCURO, stroke_width=3, fill_color=FUNDO,
                                           fill_opacity=1).move_to(np.array([x, y_no, 0])),
                                 eq(tex, 40).move_to(np.array([x, y_no, 0]))) for x, (_, tex) in zip(xs, nomes)])
        setas, operacoes = VGroup(), VGroup()
        for i, op in enumerate((r"\tanh(W_1\,\cdot + \vec{b}_1)", r"\tanh(W_2\,\cdot + \vec{b}_2)",
                                r"\vec{v}\cdot\, + c", r"(\,\cdot - t)^2")):
            a, b = np.array([xs[i] + 0.8, y_no, 0]), np.array([xs[i + 1] - 0.8, y_no, 0])
            setas.add(Arrow(a, b, buff=0, color=SUAVE, stroke_width=4, max_tip_length_to_length_ratio=0.25))
            operacoes.add(eq(op, 28, SUAVE).move_to(np.array([(xs[i] + xs[i + 1]) / 2, y_no + 0.85, 0])))
        leg = no_alto("Para a frente: cada conta é um nó, e o valor fica guardado")
        self.play(Write(leg), Create(caixas), run_time=1.6)

        def valor(k):
            val = v[k][0]
            if k == "x":                     # a entrada é a da aula 4, escrita como lá: (1; 0,25)
                return r"(1;\ 0{,}25)"
            return par(val) if np.ndim(val) else tex_num(val)

        frente = VGroup(*[eq(valor(k), 30, AZUL).move_to(np.array([x, y_no - 0.85, 0])) for x, (k, _) in zip(xs, nomes)])
        self.play(Write(frente[0]), run_time=0.7)
        for i in range(4):
            self.play(GrowArrow(setas[i]), Write(operacoes[i]), run_time=0.7)
            self.play(Write(frente[i + 1]), run_time=0.6)
        self.wait(1.0)

        # para trás: L.backward() leva a derivada de nó em nó, da direita para a esquerda
        leg = troca_frase(self, leg, "Para trás, com backward(): a derivada da perda por cada nó")
        rotulo = texto("a derivada da perda por cada nó", 30, LARANJA).move_to(np.array([0, -1.25, 0]))
        tras = VGroup(*[eq(par(v[k][1]) if np.ndim(v[k][1]) else tex_num(v[k][1]), 30, LARANJA).move_to(
            np.array([x, -1.95, 0])) for x, (k, _) in zip(xs, nomes)])
        voltas = VGroup(*[Arrow(np.array([xs[i + 1] - 0.5, -2.55, 0]), np.array([xs[i] + 0.5, -2.55, 0]), buff=0,
                                color=LARANJA, stroke_width=4, max_tip_length_to_length_ratio=0.25) for i in range(4)])
        self.play(Write(rotulo), Write(tras[4]), run_time=1.0)
        for i in (3, 2, 1, 0):
            self.play(GrowArrow(voltas[i]), run_time=0.6)
            self.play(Write(tras[i]), run_time=0.7)
        self.wait(0.8)
        leg = troca_frase(self, leg, "Na entrada, o gradiente da aula 4: (1,0940; −4,6074)")
        caixa = SurroundingRectangle(tras[0], color=LARANJA, buff=0.12, stroke_width=4)
        self.play(Create(caixa), run_time=0.8)
        codigo = texto("L.backward()   e depois   x.grad", 30, ESCURO).move_to(np.array([0, -3.3, 0]))
        self.play(Write(codigo), run_time=1.0)
        self.wait(3)


# ================================================================ o passo do gradiente descendente e o do Adam

K_TIGELA = 25.0                      # a tigela alongada: L(a, b) = (a² + 25 b²) / 2, íngreme em b e rasa em a
INICIO = np.array([-4.0, 1.2])
PASSOS = 40


def caminhos(eta_sgd=0.075, eta_adam=0.3):
    """Os dois caminhos, do mesmo ponto: o gradiente descendente, com a maior taxa que a direção íngreme aguenta com
    folga, e o Adam, com os valores de fábrica do PyTorch para os β; os dois com 40 passos."""
    def grad(p):
        return np.array([p[0], K_TIGELA * p[1]])
    p, sgd = INICIO.copy(), [INICIO.copy()]
    for _ in range(PASSOS):
        p = p - eta_sgd * grad(p)
        sgd.append(p.copy())
    p, m, s, adam = INICIO.copy(), np.zeros(2), np.zeros(2), [INICIO.copy()]
    for t in range(1, PASSOS + 1):
        g = grad(p)
        m = 0.9 * m + 0.1 * g                      # a média do gradiente
        s = 0.999 * s + 0.001 * g ** 2             # a média do quadrado do gradiente
        p = p - eta_adam * (m / (1 - 0.9 ** t)) / (np.sqrt(s / (1 - 0.999 ** t)) + 1e-8)
        adam.append(p.copy())
    return np.array(sgd), np.array(adam)


class Adam(Scene):
    """Os dois passos numa tigela alongada: o do gradiente descendente, proporcional à inclinação, que ziguezagueia
    na direção íngreme e anda devagar na rasa; e o do Adam, de tamanho parecido nas duas direções."""

    def construct(self):
        self.camera.background_color = FUNDO
        sgd, adam = caminhos()
        # as duas tigelas uma sobre a outra, na largura toda: a tigela é larga e baixa, e lado a lado elas se cruzariam
        centros = (np.array([0.0, 1.2, 0]), np.array([0.0, -1.95, 0]))
        esc = 0.85                                 # tela por unidade do plano (a, b), a mesma nas duas direções

        def tela(c, p):
            return c + esc * np.array([p[0], p[1], 0])

        def elipses(c):
            g = VGroup()
            for nivel in (0.5, 2, 5, 10, 18, 26):
                ts = np.linspace(0, 2 * np.pi, 120)
                ra, rb = np.sqrt(2 * nivel), np.sqrt(2 * nivel / K_TIGELA)
                pts = [tela(c, (ra * np.cos(t_), rb * np.sin(t_))) for t_ in ts]
                g.add(VMobject(stroke_color=CINZA, stroke_width=2).set_points_smoothly(pts))
            g.add(Dot(tela(c, (0, 0)), radius=0.06, color=ESCURO))
            return g

        titulos = VGroup(texto("o gradiente descendente", 30, AZUL).move_to(np.array([0, 2.75, 0])).align_to(
                             np.array([-6.6, 0, 0]), LEFT),
                         texto("o Adam", 30, LARANJA).move_to(np.array([0, -0.4, 0])).align_to(
                             np.array([-6.6, 0, 0]), LEFT))
        leg = no_alto("A mesma tigela, rasa numa direção e íngreme na outra")
        self.play(Write(leg), *[Create(elipses(c)) for c in centros], Write(titulos), run_time=2.0)
        pontos = [Dot(tela(centros[0], sgd[0]), radius=0.08, color=AZUL),
                  Square(side_length=0.15, stroke_width=0, fill_color=LARANJA, fill_opacity=1).move_to(
                      tela(centros[1], adam[0]))]
        self.play(*[FadeIn(p) for p in pontos], run_time=0.6)
        contador = VGroup(texto("passo", 30, SUAVE), eq("0", 36)).arrange(RIGHT, buff=0.2).move_to(
            np.array([0, 2.75, 0])).align_to(np.array([6.6, 0, 0]), RIGHT)
        self.play(Write(contador), run_time=0.6)

        def anda(ate, run):
            segs = []
            for i in range(anda.feito, ate):
                segs.append(Line(tela(centros[0], sgd[i]), tela(centros[0], sgd[i + 1]), color=AZUL, stroke_width=3))
                segs.append(Line(tela(centros[1], adam[i]), tela(centros[1], adam[i + 1]), color=LARANJA, stroke_width=3))
            novo = VGroup(texto("passo", 30, SUAVE), eq(str(ate), 36)).arrange(RIGHT, buff=0.2).move_to(contador)
            self.play(LaggedStart(*[Create(s_) for s_ in segs], lag_ratio=0.3),
                      pontos[0].animate.move_to(tela(centros[0], sgd[ate])),
                      pontos[1].animate.move_to(tela(centros[1], adam[ate])), Transform(contador, novo), run_time=run)
            anda.feito = ate

        anda.feito = 0
        leg = troca_frase(self, leg, "Gradiente descendente: o passo é proporcional à inclinação")
        anda(6, 4.0)
        self.wait(0.6)
        leg = troca_frase(self, leg, "O Adam: passo de tamanho parecido nas duas direções")
        self.wait(0.8)
        anda(PASSOS, 7.0)
        leg = troca_frase(self, leg, "Cada peso com a sua taxa: o que o Adam faz por dentro")
        self.wait(3)


CENAS = {"taxa-limiar": TaxaLimiar, "grafo": Grafo, "adam": Adam}


def grava(nome, largura=1920, altura=1080, quadros=30, crf=24, so_ultimo_quadro=False):
    """Desenha a cena e grava o mp4 e o png do último quadro, em videos/ e figuras/ da aula.

    O manim trabalha numa pasta temporária, apagada no fim. O mp4 sai de novo
    pelo ffmpeg, em H.264 com qualidade constante (crf 24). Com so_ultimo_quadro,
    grava só o último quadro. Devolve o tempo gasto, em segundos.
    """
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
    segundos = time.perf_counter() - inicio
    for arquivo in arquivos:
        print(f"gravado: {arquivo} ({arquivo.stat().st_size / 1e6:.1f} MB)")
    print(f"{nome}: {segundos:.0f} s")
    return segundos


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    so_quadro = "--quadros" in args
    for nome in [a for a in args if a != "--quadros"] or list(CENAS):
        grava(nome, so_ultimo_quadro=so_quadro)
