"""Figuras dos slides da aula 3: matrizes e camadas.

Rode, a partir da raiz do repositório:
    python aulas/03-camadas/codigo/figuras_slides.py

Gera, a 200 dpi, em aulas/03-camadas/figuras/:
    rede.png        a rede 2-2-1 em bolinhas ligadas por linhas, com os nomes dos nove parâmetros
    rede-xor.png    a mesma rede com os pesos escolhidos à mão que calculam o XOR
    ativacao.png    o degrau e a sigmoide, lado a lado
    regiao.png      a saída da rede do XOR com a sigmoide, no plano, com os pesos vezes 1, 5 e 25

Os pesos à mão vêm de xor_a_mao.py, ao lado, e o desenho da rede, de
rede_em_bolinhas.py, que a aula 5 também usa. O vídeo da camada oculta sai de
animacoes.py.
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FuncFormatter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rede_em_bolinhas import (AZUL, CINZA, ESCURO, FUNDO, LARANJA, POS, R, VERMELHO, br, desenha_rede,  # noqa: E402
                              legendas_das_camadas)
from xor_a_mao import B_OCULTA, B_SAIDA, W_OCULTA, W_SAIDA  # noqa: E402

AULA = Path(__file__).resolve().parents[1]

# Vírgula decimal e sinal de menos tipográfico nos eixos, como pede o CLAUDE.md
VIRGULA = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))


def salva(fig, nome):
    """Salva a 200 dpi. bbox_inches="tight" recorta em volta de tudo o que foi
    desenhado, legenda incluída, para nada encostar na borda."""
    saida = AULA / "figuras" / nome
    saida.parent.mkdir(exist_ok=True)
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.2, facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"salva: {saida}")


def rede():
    """A rede 2-2-1 com os nomes dos nove parâmetros: W e b⃗ na camada oculta, v⃗ e c na saída."""
    fig, ax = plt.subplots(figsize=(16, 8.4), facecolor=FUNDO)
    pesos = {"w11": "$w_{11}$", "w12": "$w_{12}$", "w21": "$w_{21}$", "w22": "$w_{22}$", "b1": "$b_1$",
             "b2": "$b_2$", "v1": "$v_1$", "v2": "$v_2$", "c": "$c$"}
    nomes = {"x1": "$x_1$", "x2": "$x_2$", "h1": "$h_1$", "h2": "$h_2$", "y": "$y$"}
    desenha_rede(ax, pesos, nomes)
    legendas_das_camadas(ax)
    salva(fig, "rede.png")


def rede_xor():
    """A rede do XOR com os pesos à mão de xor_a_mao.py: h₁ é o OU, h₂ é o E, y é o XOR."""
    fig, ax = plt.subplots(figsize=(16, 8.4), facecolor=FUNDO)
    (w11, w12), (w21, w22) = W_OCULTA
    pesos = {"w11": br(w11), "w12": br(w12), "w21": br(w21), "w22": br(w22), "b1": br(B_OCULTA[0]),
             "b2": br(B_OCULTA[1]), "v1": br(W_SAIDA[0, 0]), "v2": br(W_SAIDA[0, 1]), "c": br(B_SAIDA[0])}
    nomes = {"x1": "$x_1$", "x2": "$x_2$", "h1": "$h_1$", "h2": "$h_2$", "y": "$y$"}
    # o nome da função de cada neurônio, do lado em que não passa linha nenhuma
    hx, h1y = POS["h1"]
    _, h2y = POS["h2"]
    yx, yy = POS["y"]
    extras = [(hx + 1.25, h1y + 0.55, "OU", LARANJA, 28), (hx + 1.25, h2y - 0.55, "E", LARANJA, 28),
              (yx, yy + R + 0.5, "XOR", LARANJA, 28)]
    desenha_rede(ax, pesos, nomes, extras)
    legendas_das_camadas(ax)
    salva(fig, "rede-xor.png")


def ativacao():
    """O degrau e a sigmoide, em dois painéis iguais, com os mesmos eixos.

    O degrau, da aula 1, pula de 0 para 1 em z = 0 e é plano no resto: a
    derivada é zero em todo ponto fora do zero. A sigmoide, σ(z) = 1/(1 + e⁻ᶻ),
    faz a mesma passagem de 0 a 1, mas lisa, e tem inclinação em todo ponto.
    """
    fig, eixos = plt.subplots(1, 2, figsize=(10, 4.4))
    z = np.linspace(-6, 6, 601)
    curvas = (("degrau", np.where(z >= 0, 1.0, 0.0)), ("sigmoide", 1 / (1 + np.exp(-z))))
    for ax, (nome, f) in zip(eixos, curvas):
        ax.set_box_aspect(0.8)
        if nome == "degrau":
            # os dois patamares, sem o traço vertical, que não faz parte da função; a bolinha cheia
            # mostra que em z = 0 o degrau vale 1, e a vazia, que ali ele não vale 0
            ax.plot(z[z < 0], f[z < 0], color=ESCURO, lw=3.5)
            ax.plot(z[z >= 0], f[z >= 0], color=ESCURO, lw=3.5)
            ax.plot([0], [1], "o", ms=12, color=ESCURO, zorder=3)
            ax.plot([0], [0], "o", ms=12, mfc="white", mec=ESCURO, mew=2.5, zorder=3)
        else:
            ax.plot(z, f, color=ESCURO, lw=3.5)
        ax.axhline(0.5, color=CINZA, lw=1.2, ls=(0, (4, 4)), zorder=0)
        ax.set_xlim(-6, 6)
        ax.set_ylim(-0.12, 1.12)
        ax.set_xticks([-6, -3, 0, 3, 6])
        ax.set_yticks([0, 0.5, 1])
        ax.xaxis.set_major_formatter(VIRGULA)
        ax.yaxis.set_major_formatter(VIRGULA)
        ax.tick_params(labelsize=17)
        ax.set_xlabel("$z$", fontsize=24)
        ax.set_title(nome, fontsize=22, color=ESCURO, pad=14)
    fig.tight_layout(w_pad=4)
    salva(fig, "ativacao.png")


FATORES = (1, 5, 25)    # os pesos à mão multiplicados por k, para a figura da sigmoide


def saida_sigmoide(x1, x2, k):
    """A saída da rede do XOR com a sigmoide no lugar do degrau e todos os pesos e vieses multiplicados por k.

    Com k grande, a sigmoide de k·z fica perto do degrau de z, e a rede volta a
    ser a de pesos à mão; com k = 1, as somas são pequenas, e a saída fica perto
    de 0,5 em todo o plano. Recebe arrays de x₁ e x₂ e devolve a saída y, entre 0 e 1.
    """
    def s(z):
        return 1 / (1 + np.exp(-z))
    h1 = s(k * (W_OCULTA[0, 0] * x1 + W_OCULTA[0, 1] * x2 + B_OCULTA[0]))
    h2 = s(k * (W_OCULTA[1, 0] * x1 + W_OCULTA[1, 1] * x2 + B_OCULTA[1]))
    return s(k * (W_SAIDA[0, 0] * h1 + W_SAIDA[0, 1] * h2 + B_SAIDA[0]))


def regiao():
    """A saída da rede do XOR com a sigmoide, no plano das entradas, para k = 1, 5 e 25.

    Três painéis do mesmo tamanho, a mesma escala de cor, de 0 a 1, do fundo ao
    azul, e a linha cheia em y = 0,5, a fronteira entre responder 0 e 1. Os quatro
    pontos com os marcadores do curso: círculo azul para a resposta 1, quadrado
    vermelho para a 0. A barra de cor vai embaixo, fora dos dados. Devolve a
    tabela da saída nos quatro pontos, para cada k.
    """
    from matplotlib.colors import LinearSegmentedColormap
    mapa = LinearSegmentedColormap.from_list("limiar", [FUNDO, "#9dbbe0", AZUL])
    g = np.linspace(-0.5, 1.5, 301)
    G1, G2 = np.meshgrid(g, g)
    fig, eixos = plt.subplots(1, 3, figsize=(15, 5.6), facecolor=FUNDO)
    tabela = {}
    for ax, k in zip(eixos, FATORES):
        Y = saida_sigmoide(G1, G2, k)
        im = ax.imshow(Y, origin="lower", extent=(-0.5, 1.5, -0.5, 1.5), cmap=mapa, vmin=0, vmax=1)
        if Y.min() < 0.5 < Y.max():
            ax.contour(G1, G2, Y, levels=[0.5], colors=ESCURO, linewidths=2)
        pontos = [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 0)]
        for a, b, t in pontos:
            ax.plot(a, b, "o" if t == 1 else "s", ms=15, color=AZUL if t == 1 else VERMELHO, mec="white", mew=2)
        tabela[k] = [float(saida_sigmoide(np.array(a), np.array(b), k)) for a, b, _ in pontos]
        ax.set_title(f"$k$ = {k}", fontsize=22, color=ESCURO, pad=12)
        ax.set_xticks([0, 1])
        ax.set_yticks([0, 1])
        ax.tick_params(labelsize=17)
        ax.set_xlabel("$x_1$", fontsize=22)
        ax.set_facecolor(FUNDO)
    eixos[0].set_ylabel("$x_2$", fontsize=22)
    barra = fig.colorbar(im, ax=list(eixos), orientation="horizontal", fraction=0.06, pad=0.2, aspect=50)
    barra.set_ticks([0, 0.5, 1])
    barra.ax.xaxis.set_major_formatter(VIRGULA)
    barra.ax.tick_params(labelsize=16)
    barra.set_label("a saída $y$ da rede", fontsize=18)
    salva(fig, "regiao.png")
    return tabela


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    rede()
    rede_xor()
    ativacao()
    for k_, ys in regiao().items():
        print(f"k = {k_}: saída em (0; 0), (0; 1), (1; 0), (1; 1) =", ", ".join(f"{y:.3f}" for y in ys))
