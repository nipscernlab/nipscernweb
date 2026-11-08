"""Os vídeos da aula 6, feitos com o Manim Community.

Rode, a partir da raiz do repositório, depois de mlp.py, que grava as probabilidades e os pesos, com o nome
dos vídeos que quer gravar, ou sem nome nenhum para gravar todos:
    python aulas/06-mnist-numpy/codigo/animacoes.py
    python aulas/06-mnist-numpy/codigo/animacoes.py softmax

Os três vídeos, na ordem da aula:
    digito-probabilidades   o dígito vira uma lista de 784 números, que a rede leva a dez probabilidades
    softmax                 a softmax em três quadros, as somas, a exponencial e a divisão pela soma, com
                            o exemplo do slide, z⃗ = (2; 1; 0); as somas menos 2 e as somas vezes 3
    neuronio                um neurônio oculto: o dígito, os 784 pesos dele na forma da imagem, o produto
                            pixel a pixel e a soma, com um 7 e com um 5 do teste

Todo render do curso é em 1080p, 1920 por 1080, a 30 quadros por segundo. Uma
opção grava só o último quadro, em segundos, para conferir a composição:
    --quadros

Precisa do Manim Community (pip install manim), do MiKTeX, o mesmo das equações
dos slides, e do ffmpeg. Cada vídeo sai em dois arquivos:
    aulas/06-mnist-numpy/videos/<nome>.mp4           o vídeo
    aulas/06-mnist-numpy/figuras/<nome>-quadro.png   o último quadro, que o slide mostra parado

As regras são as dos vídeos das aulas anteriores: sem título próprio, texto com
pelo menos 30 pontos do Manim, equação com pelo menos 32, tudo escrito, nada
sobreposto, cada texto num lugar fixo. E nada é sorteado: os dois dígitos são
os do teste, índices 0 e 61, e as probabilidades são as que a rede de
referência deu a eles, lidas de resultados/mlp.json.
"""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from manim import (DOWN, LEFT, RIGHT, UP, Arrow, Create, FadeIn, FadeOut, GrowArrow, LaggedStart, Line, MathTex, Rectangle,
                   RoundedRectangle, Scene, TexTemplate, Text, Transform, TransformFromCopy, VGroup, Write, config,
                   interpolate_color, tempconfig, ManimColor)
from manimpango import register_font

RAIZ = Path(__file__).resolve().parents[3]
AULA = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mnist import carrega  # noqa: E402

for arquivo in ("IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf", "SourceSerif4-Semibold.ttf"):
    register_font(str(RAIZ / "infra" / "fontes" / arquivo))
SANS = "IBM Plex Sans"

FUNDO, ESCURO, TEXTO, SUAVE = "#F6F5F1", "#14213D", "#3B4658", "#5E6A7D"
AZUL, LARANJA, CINZA, BORDA = "#1F5FAD", "#A8500F", "#8A94A6", "#DCDFE4"

MODELO = TexTemplate(preamble="\\usepackage[T1]{fontenc}\n\\usepackage{amsmath}\n\\usepackage{stix2}\n")
config.tex_template = MODELO

EXEMPLOS = (0, 61)          # o 7 em que a rede tem certeza e o 8 em que ela hesita entre o 8 e o 2


def texto(s, tamanho=30, cor=TEXTO):
    """Texto corrido, na fonte dos slides."""
    return Text(s, font=SANS, font_size=tamanho, color=cor)


def eq(tex, tamanho=34, cor=ESCURO):
    """Equação em LaTeX, na STIX Two."""
    return MathTex(tex, font_size=tamanho, color=cor, tex_template=MODELO)


def decimal(v):
    """Probabilidade em LaTeX, com vírgula: três casas, ou quatro perto de 1, para 0,9998 não virar 1,000."""
    return (f"{v:.3f}" if v < 0.9995 else f"{v:.4f}").replace(".", "{,}")


def cor_do_pixel(v):
    """O tom de um pixel: 0 é branco, 1 é o azul-escuro dos títulos, como tinta no papel."""
    return interpolate_color(ManimColor("#FFFFFF"), ManimColor(ESCURO), float(v))


class DigitoProbabilidades(Scene):
    """Um dígito do teste vira uma lista de 784 números, e a rede devolve dez probabilidades.

    À esquerda, o dígito, 28 por 28 quadradinhos com o tom de cada pixel. As
    linhas da imagem descem, uma depois da outra, e se enfileiram numa faixa
    embaixo: 784 números, a primeira linha da imagem primeiro. A faixa entra na
    rede, no meio, e a rede devolve, à direita, dez barras, a probabilidade de
    cada dígito. Depois, o mesmo com um 8 em que a rede hesita entre o 8 e o 2.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        X, t = carrega()["teste"]
        resultado = json.loads((AULA / "resultados" / "mlp.json").read_text(encoding="utf-8"))
        P = np.array(resultado["escolha"]["probabilidades_teste_200"])
        a, b = EXEMPLOS

        # ------------------------------------------------ os lugares fixos de cada coisa
        Y_LEGENDA = 3.45
        lado, centro_digito = 0.12, np.array([-4.9, 0.9, 0])
        x_faixa, y_faixa, alt_faixa = (-6.6, 6.6), -2.75, 0.32
        largura_celula = (x_faixa[1] - x_faixa[0]) / 784
        centro_rede = np.array([0.25, 0.9, 0])
        x_barras, base, alt_max = np.linspace(2.85, 6.45, 10), -0.75, 3.2

        # ------------------------------------------------ o dígito: 784 quadradinhos
        def quadradinhos(x):
            g = VGroup()
            for k, v in enumerate(x):
                lin, col = divmod(k, 28)
                # o contorno fino da mesma cor fecha as frestas entre os quadradinhos vizinhos
                q = Rectangle(width=lado, height=lado, stroke_width=1, stroke_color=cor_do_pixel(v),
                              fill_color=cor_do_pixel(v), fill_opacity=1)
                q.move_to(centro_digito + np.array([(col - 13.5) * lado, (13.5 - lin) * lado, 0]))
                g.add(q)
            return g

        digito = quadradinhos(X[a])
        moldura = Rectangle(width=28 * lado, height=28 * lado, color=CINZA, stroke_width=2).move_to(centro_digito)
        linhas = [VGroup(*digito[28 * r:28 * r + 28]) for r in range(28)]

        # a faixa: as mesmas 784 cores, uma célula fina por pixel
        def faixa_de(x):
            g = VGroup()
            for k, v in enumerate(x):
                c = Rectangle(width=largura_celula, height=alt_faixa, stroke_width=1, stroke_color=cor_do_pixel(v),
                              fill_color=cor_do_pixel(v), fill_opacity=1)
                c.move_to(np.array([x_faixa[0] + (k + 0.5) * largura_celula, y_faixa, 0]))
                g.add(c)
            return g

        faixa = faixa_de(X[a])
        moldura_faixa = Rectangle(width=x_faixa[1] - x_faixa[0], height=alt_faixa, color=CINZA, stroke_width=2)
        moldura_faixa.move_to(np.array([0, y_faixa, 0]))
        nome_faixa = texto("784 números, um por pixel, a primeira linha da imagem primeiro", 30, SUAVE)
        nome_faixa.next_to(moldura_faixa, DOWN, buff=0.2)

        # ------------------------------------------------ a rede e as barras
        caixa = RoundedRectangle(width=2.6, height=1.5, corner_radius=0.18, color=ESCURO, stroke_width=2.5)
        caixa.move_to(centro_rede)
        dentro = VGroup(texto("a rede", 32, ESCURO), eq(r"784 \to 256 \to 10", 32)).arrange(DOWN, buff=0.16)
        dentro.move_to(centro_rede)
        seta_sobe = Arrow(np.array([centro_rede[0], y_faixa + alt_faixa / 2 + 0.08, 0]),
                          caixa.get_bottom() + DOWN * 0.06, buff=0, color=SUAVE, stroke_width=4)
        seta_lado = Arrow(caixa.get_right() + np.array([0.06, 0, 0]), np.array([x_barras[0] - 0.4, centro_rede[1], 0]),
                          buff=0, color=SUAVE, stroke_width=4)
        eixo = Line(np.array([x_barras[0] - 0.3, base, 0]), np.array([x_barras[-1] + 0.3, base, 0]),
                    color=ESCURO, stroke_width=2.5)
        nomes = VGroup(*[eq(str(d), 32, TEXTO).move_to(np.array([x, base - 0.3, 0])) for d, x in enumerate(x_barras)])

        def barras_de(p):
            """As dez barras: a maior em azul, a segunda em laranja se passar de 0,1, as outras em cinza."""
            ordem = np.argsort(p)[::-1]
            g = VGroup()
            for d, (x, v) in enumerate(zip(x_barras, p)):
                cor = AZUL if d == ordem[0] else (LARANJA if d == ordem[1] and v > 0.1 else CINZA)
                altura = max(v * alt_max, 0.004)
                r = Rectangle(width=0.26, height=altura, stroke_width=0, fill_color=cor, fill_opacity=1)
                r.move_to(np.array([x, base + altura / 2, 0]))
                g.add(r)
            valores = VGroup()
            for d in ordem[:2]:
                if p[d] > 0.1:
                    cor = AZUL if d == ordem[0] else LARANJA
                    valores.add(eq(decimal(p[d]), 30, cor).move_to(np.array([x_barras[d], base + p[d] * alt_max + 0.24, 0])))
            return g, valores

        barras, valores = barras_de(P[a])
        barras_zero = VGroup(*[r.copy().stretch_to_fit_height(0.004).move_to(np.array([r.get_x(), base + 0.002, 0]))
                               for r in barras])

        def legenda(s):
            return texto(s, 30, TEXTO).move_to(np.array([0, Y_LEGENDA, 0]))

        def troca_legenda(velha, nova):
            """Apaga a legenda e escreve a nova no mesmo lugar, uma depois da outra: as letras nunca se misturam."""
            self.play(FadeOut(velha), run_time=0.4)
            self.play(FadeIn(nova), run_time=0.5)
            return nova

        # ------------------------------------------------ 1. o dígito
        leg = legenda(f"um dígito do teste, o {t[a]}: 28 por 28 pixels, cada um de 0 a 1")
        self.play(Write(leg), Create(moldura), LaggedStart(*[FadeIn(l) for l in linhas], lag_ratio=0.06),
                  run_time=2.2)
        self.wait(1.2)

        # ------------------------------------------------ 2. as linhas descem e viram a faixa
        leg = troca_legenda(leg, legenda("linha após linha, a imagem vira uma lista de 784 números"))
        self.play(Create(moldura_faixa), run_time=0.8)
        self.play(LaggedStart(*[TransformFromCopy(linhas[r], VGroup(*faixa[28 * r:28 * r + 28]))
                                for r in range(28)], lag_ratio=0.12), run_time=4.5)
        self.play(Write(nome_faixa), run_time=1.0)
        self.wait(0.8)

        # ------------------------------------------------ 3. a rede e as dez probabilidades
        leg = troca_legenda(leg, legenda("a rede devolve dez probabilidades, que somam 1"))
        self.play(GrowArrow(seta_sobe), run_time=0.8)
        self.play(Create(caixa), Write(dentro), run_time=1.2)
        self.play(GrowArrow(seta_lado), Create(eixo), Write(nomes), FadeIn(barras_zero), run_time=1.2)
        self.play(Transform(barras_zero, barras), run_time=1.4)
        self.play(Write(valores), run_time=0.8)
        self.wait(1.6)

        # ------------------------------------------------ 4. um 8 em que a rede hesita
        novo_digito, nova_faixa = quadradinhos(X[b]), faixa_de(X[b])
        self.play(FadeOut(valores), run_time=0.5)
        leg = troca_legenda(leg, legenda(f"outro dígito, um {t[b]}: a rede hesita entre o 8 e o 2"))
        self.play(*[q.animate.set_fill(n.get_fill_color(), 1).set_stroke(n.get_fill_color())
                    for q, n in zip(digito, novo_digito)],
                  *[c.animate.set_fill(n.get_fill_color(), 1).set_stroke(n.get_fill_color())
                    for c, n in zip(faixa, nova_faixa)], run_time=1.8)
        novas_barras, novos_valores = barras_de(P[b])
        self.play(Transform(barras_zero, novas_barras), run_time=1.4)
        self.play(Write(novos_valores), run_time=0.8)
        self.wait(2.5)


# ================================================================ as frases do alto, nos vídeos novos

def no_alto(s):
    """A frase do alto do vídeo, que diz o que está acontecendo; cabe na largura com folga."""
    f = texto(s, 30).move_to(np.array([0, 3.45, 0]))
    assert f.width < 13, s
    return f


def troca(cena, atual, s):
    """Apaga a frase do alto e escreve a seguinte."""
    nova = no_alto(s)
    cena.play(FadeOut(atual), run_time=0.35)
    cena.play(Write(nova), run_time=0.9)
    return nova


def num(v, casas=3):
    """Número em LaTeX, com vírgula decimal e sem o espaço depois dela."""
    return f"{v:.{casas}f}".replace(".", "{,}")


# ================================================================ a softmax por dentro

ETAPAS_SOFTMAX = [((2.0, 1.0, 0.0), "As somas do exemplo do slide: 2, 1 e 0"),
                  ((0.0, -1.0, -2.0), "Menos 2 em todas as somas: as probabilidades não mudam"),
                  ((6.0, 3.0, 0.0), "Somas três vezes mais afastadas: a aposta fica firme")]


class Softmax(Scene):
    """A softmax em três quadros: as somas z, a exponencial e^z e a divisão pela soma, que dá as probabilidades.

    Os números são os do exemplo do slide, z⃗ = (2; 1; 0). Depois, as mesmas somas
    menos 2, que dão as mesmas probabilidades, e as somas vezes 3, que deixam a
    maior probabilidade perto de 1.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        xs = (-4.7, -0.1, 4.5)                     # o centro de cada quadro: z, e^z, p
        base_z, base, alt = -0.75, -1.9, 2.6        # a linha de base de cada quadro e a altura máxima das barras
        largura_barra, passo = 0.6, 0.95

        def barras(valores, x0, cor, escala, base_):
            """Três barras a partir da base, com o número em cima (ou embaixo, se negativo)."""
            g, nums = VGroup(), VGroup()
            for i, v in enumerate(valores):
                h = max(abs(v) * escala, 0.02)
                cx = x0 + (i - 1) * passo
                r = Rectangle(width=largura_barra, height=h, stroke_width=0, fill_color=cor, fill_opacity=0.85)
                r.move_to(np.array([cx, base_ + (h / 2 if v >= 0 else -h / 2), 0]))
                g.add(r)
                casas = 3 if abs(v) < 10 else 1
                n = eq(num(v, casas) if not float(v).is_integer() or abs(v) >= 10 else f"{v:g}".replace("-", "-"),
                       32, cor)
                n.next_to(r, UP if v >= 0 else DOWN, buff=0.12)
                nums.add(n)
            return g, nums

        def quadro(z):
            ez = np.exp(z)
            p = ez / ez.sum()
            gz, nz = barras(z, xs[0], AZUL, 0.38, base_z)
            ge, ne = barras(ez, xs[1], LARANJA, alt / ez.max(), base)
            gp, np_ = barras(p, xs[2], ESCURO, alt, base)
            soma = eq(rf"\text{{soma}} = {num(ez.sum(), 3 if ez.sum() < 100 else 1)}", 32, SUAVE).move_to(
                np.array([xs[1], base - 0.75, 0]))
            soma_p = eq(r"\text{soma} = 1", 32, SUAVE).move_to(np.array([xs[2], base - 0.75, 0]))
            return VGroup(gz, nz, ge, ne, gp, np_, soma, soma_p)

        linhas = VGroup(*[Line(np.array([x - 1.4, b_, 0]), np.array([x + 1.4, b_, 0]), color=ESCURO, stroke_width=2.5)
                          for x, b_ in zip(xs, (base_z, base, base))])
        nomes = VGroup(eq(r"z_k", 40).move_to(np.array([xs[0], 2.55, 0])),
                       eq(r"e^{z_k}", 40).move_to(np.array([xs[1], 2.55, 0])),
                       eq(r"p_k = e^{z_k} / \text{soma}", 40).move_to(np.array([xs[2], 2.55, 0])))
        setas = VGroup(Arrow(np.array([xs[0] + 1.55, 0.3, 0]), np.array([xs[1] - 1.55, 0.3, 0]), buff=0, color=SUAVE,
                             stroke_width=5, max_tip_length_to_length_ratio=0.25),
                       Arrow(np.array([xs[1] + 1.55, 0.3, 0]), np.array([xs[2] - 1.55, 0.3, 0]), buff=0, color=SUAVE,
                             stroke_width=5, max_tip_length_to_length_ratio=0.25))
        z0, frase0 = ETAPAS_SOFTMAX[0]
        leg = no_alto(frase0)
        q = quadro(np.array(z0))
        self.play(Write(leg), Create(linhas), Write(nomes), run_time=1.6)
        self.play(Create(q[0]), Write(q[1]), run_time=1.2)
        self.wait(0.8)
        leg = troca(self, leg, "A exponencial deixa tudo positivo, e as grandes muito maiores")
        self.play(GrowArrow(setas[0]), run_time=0.6)
        self.play(TransformFromCopy(q[0], q[2]), Write(q[3]), Write(q[6]), run_time=1.4)
        self.wait(0.8)
        leg = troca(self, leg, "Dividindo pela soma, saem probabilidades: 0,665, 0,245 e 0,090")
        self.play(GrowArrow(setas[1]), run_time=0.6)
        self.play(TransformFromCopy(q[2], q[4]), Write(q[5]), Write(q[7]), run_time=1.4)
        self.wait(1.5)
        for z, frase_ in ETAPAS_SOFTMAX[1:]:
            leg = troca(self, leg, frase_)
            self.play(Transform(q, quadro(np.array(z))), run_time=1.8)
            self.wait(1.8)
        self.wait(1.5)


# ================================================================ o que um neurônio oculto faz com a imagem

NEURONIO = 4              # o neurônio 5 da figura dos pesos, contado do 1: a barra azul com laranja em cima
DIGITOS_NEURONIO = (0, 8)  # o 7 do índice 0 do teste e o 5 do índice 8: um com soma negativa, outro positiva


def cor_do_peso(v, limite):
    """Azul para peso negativo, branco no zero, laranja para positivo, como na figura dos pesos."""
    f = float(np.clip(v / limite, -1, 1))
    if f < 0:
        return interpolate_color(ManimColor("#FFFFFF"), ManimColor(AZUL), -f)
    return interpolate_color(ManimColor("#FFFFFF"), ManimColor(LARANJA), f)


class NeuronioPixel(Scene):
    """Um neurônio oculto: o dígito, os 784 pesos dele na forma da imagem, o produto pixel a pixel e a soma.

    Os pesos são os do neurônio 5 da rede da aula, lidos de resultados/mlp.json. A
    soma mostrada é a dos 784 produtos, antes do viés do neurônio, que é um número
    só e não muda o desenho. Com o 7, a tinta cai sobre os pesos azuis, e a soma é
    negativa; com o 5, sobre o laranja, e a soma é positiva.
    """

    def construct(self):
        self.camera.background_color = FUNDO
        X, t = carrega()["teste"]
        resultado = json.loads((AULA / "resultados" / "mlp.json").read_text(encoding="utf-8"))
        w = np.array(resultado["escolha"]["pesos_16"])[NEURONIO]
        limite_w = np.abs(np.array(resultado["escolha"]["pesos_16"])).max()
        a, b = DIGITOS_NEURONIO
        limite_p = max(np.abs(X[a] * w).max(), np.abs(X[b] * w).max())
        lado, y0 = 0.1, 0.45
        centros = (np.array([-4.7, y0, 0]), np.array([-0.1, y0, 0]), np.array([4.5, y0, 0]))

        def grade(cores, centro):
            """28 por 28 quadradinhos, um por pixel, com a cor de cada um."""
            g = VGroup()
            for k, c in enumerate(cores):
                i, j = divmod(k, 28)
                g.add(Rectangle(width=lado, height=lado, stroke_width=0, fill_color=c, fill_opacity=1).move_to(
                    centro + np.array([(j - 13.5) * lado, (13.5 - i) * lado, 0])))
            borda = Rectangle(width=28 * lado, height=28 * lado, color=CINZA, stroke_width=2).move_to(centro)
            return VGroup(g, borda)

        def digito(i):
            return grade([cor_do_pixel(v) for v in X[i]], centros[0])

        def produto(i):
            return grade([cor_do_peso(v, limite_p) for v in X[i] * w], centros[2])

        def soma(i):
            return eq(rf"\sum_{{j=1}}^{{784}} w_j\, x_j = {num(X[i] @ w, 2)}", 44).move_to(np.array([0, -2.65, 0]))

        pesos = grade([cor_do_peso(v, limite_w) for v in w], centros[1])
        rotulos = VGroup(texto("o dígito", 30, SUAVE).next_to(pesos, DOWN, buff=0.3).set_x(centros[0][0]),
                         texto(f"os pesos do neurônio {NEURONIO + 1}", 30, SUAVE).next_to(pesos, DOWN, buff=0.3),
                         texto("pixel vezes peso", 30, SUAVE).next_to(pesos, DOWN, buff=0.3).set_x(centros[2][0]))
        sinais = VGroup(eq(r"\times", 56).move_to(np.array([-2.4, y0, 0])), eq("=", 56).move_to(np.array([2.2, y0, 0])))

        leg = no_alto(f"Um neurônio oculto tem um peso por pixel: 784, na forma da imagem")
        self.play(Write(leg), FadeIn(pesos, lag_ratio=0.002), run_time=2.0)
        self.play(Write(rotulos[1]), run_time=0.9)
        self.wait(1.0)
        leg = troca(self, leg, f"A imagem de um {t[a]} entra: cada pixel vezes o seu peso")
        d, pr = digito(a), produto(a)
        self.play(FadeIn(d, lag_ratio=0.002), Write(rotulos[0]), Write(sinais[0]), run_time=1.6)
        self.play(Write(sinais[1]), FadeIn(pr, lag_ratio=0.002), Write(rotulos[2]), run_time=1.8)
        self.wait(0.8)
        leg = troca(self, leg, "A soma dos produtos: tinta no laranja soma, tinta no azul subtrai")
        s = soma(a)
        self.play(Write(s), run_time=1.2)
        self.wait(1.8)
        leg = troca(self, leg, f"Outro dígito, um {t[b]}: a tinta cai no laranja, e a soma sobe")
        self.play(Transform(d, digito(b)), Transform(pr, produto(b)), Transform(s, soma(b)), run_time=2.0)
        self.wait(1.5)
        leg = troca(self, leg, "Cada neurônio responde a um padrão de tinta na imagem")
        self.wait(3)


CENAS = {"digito-probabilidades": DigitoProbabilidades, "softmax": Softmax, "neuronio": NeuronioPixel}


def grava(nome, largura=1920, altura=1080, quadros=30, crf=24, so_ultimo_quadro=False):
    """Desenha a cena e grava o mp4 e o png do último quadro, em videos/ e figuras/ da aula.

    O manim trabalha numa pasta temporária, apagada no fim. O mp4 sai de novo
    pelo ffmpeg, em H.264 com qualidade constante (crf 24), para ficar abaixo dos
    20 MB que o deck aceita por vídeo. Com so_ultimo_quadro, o manim pula as
    animações e grava só o último quadro. Devolve o tempo gasto, em segundos.
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
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    so_quadro = "--quadros" in args
    for nome in [a for a in args if a != "--quadros"] or list(CENAS):
        grava(nome, so_ultimo_quadro=so_quadro)
