"""Figuras dos slides da aula 5: retropropagação.

Rode, a partir da raiz do repositório:
    python aulas/05-retropropagacao/codigo/figuras_slides.py

Gera, a 200 dpi, em aulas/05-retropropagacao/figuras/:
    para-tras.png   a rede com a perda no fim: os valores vão para a frente, as derivadas voltam
    sementes.png    a perda de 20 treinos do XOR, um por semente: 16 chegam, 4 param
    mosaico.png     a imagem da capa: a região que cada um dos 20 treinos aprendeu

O treino vem de retropropagacao.py, ao lado, que também desenha treino-xor.png,
a figura da entrega; o desenho da rede vem de
aulas/03-camadas/codigo/rede_em_bolinhas.py, o mesmo da aula 3. O vídeo do
treino sai de animacoes.py.
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FuncFormatter, LogLocator, MultipleLocator, NullFormatter

RAIZ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RAIZ / "aulas" / "03-camadas" / "codigo"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from rede_em_bolinhas import AZUL, ESCURO, FUNDO, LARANJA, MEIO, POS, R, desenha_rede  # noqa: E402
from retropropagacao import EPOCAS, SEMENTES, T, X, acerta, saida_no_plano, treina  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap  # noqa: E402

AULA = Path(__file__).resolve().parents[1]

# Vírgula decimal e sinal de menos tipográfico nos eixos, como pede o CLAUDE.md
VIRGULA = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))
MILHAR = FuncFormatter(lambda v, _: f"{v:,.0f}".replace(",", "."))


def salva(fig, nome):
    """Salva a 200 dpi. bbox_inches="tight" recorta em volta de tudo o que foi
    desenhado, legenda incluída, para nada encostar na borda."""
    saida = AULA / "figuras" / nome
    saida.parent.mkdir(exist_ok=True)
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.2, facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"salva: {saida}")


def para_tras():
    """A rede com a perda no fim e as duas passadas: os valores para a frente, as derivadas para trás.

    Em cima, uma faixa azul, da esquerda para a direita, com o que a passada
    para a frente calcula; embaixo, uma faixa laranja, da direita para a
    esquerda, com o que a passada para trás calcula. O δ de cada neurônio fica
    junto dele, em laranja.
    """
    fig, ax = plt.subplots(figsize=(15, 9.33), facecolor=FUNDO)
    pesos = {"w11": "$w_{11}$", "w12": "$w_{12}$", "w21": "$w_{21}$", "w22": "$w_{22}$", "b1": "$b_1$",
             "b2": "$b_2$", "v1": "$v_1$", "v2": "$v_2$", "c": "$c$"}
    nomes = {"x1": "$x_1$", "x2": "$x_2$", "h1": "$h_1$", "h2": "$h_2$", "y": "$y$"}
    hx, h1y = POS["h1"]
    _, h2y = POS["h2"]
    yx, yy = POS["y"]
    extras = [(hx + 1.25, h1y + 0.55, r"$\delta_1$", LARANJA, 32), (hx + 1.25, h2y - 0.55, r"$\delta_2$", LARANJA, 32),
              (yx, yy + R + 0.5, r"$\delta$", LARANJA, 32)]
    desenha_rede(ax, pesos, nomes, extras)
    ax.set_xlim(0, 18)
    ax.set_ylim(-2.0, 9.2)
    # a perda, numa caixa à direita da saída
    lx = 16.4
    ax.add_patch(plt.Rectangle((lx - 0.7, MEIO - 0.55), 1.4, 1.1, facecolor="white", edgecolor=ESCURO, lw=3, zorder=3))
    ax.text(lx, MEIO, "$L$", ha="center", va="center", fontsize=34, color=ESCURO, zorder=4)
    ax.annotate("", xy=(lx - 0.7, MEIO), xytext=(yx + R, MEIO), zorder=2,
                arrowprops=dict(arrowstyle="-|>", lw=2.5, color=ESCURO, mutation_scale=24, shrinkA=0, shrinkB=0))
    # as duas faixas, por fora da rede: a de cima vai para a direita, a de baixo, para a esquerda
    for y, cor, de, para, texto in ((8.75, AZUL, 1.0, 17.2, "para a frente: as saídas de cada camada, até a perda"),
                                    (-1.45, LARANJA, 17.2, 1.0, "para trás: o δ de cada neurônio, da perda até a entrada")):
        ax.annotate("", xy=(para, y), xytext=(de, y),
                    arrowprops=dict(arrowstyle="-|>", lw=4, color=cor, mutation_scale=34, shrinkA=0, shrinkB=0))
        ax.text(9.1, y + 0.42, texto, ha="center", va="bottom", fontsize=26, color=cor)
    salva(fig, "para-tras.png")


def sementes():
    """A perda a cada época em 20 treinos do XOR, um por semente, com a mesma taxa e as mesmas épocas.

    Os treinos que acertam o XOR vão em azul, linha cheia; os que param no
    patamar, em laranja, tracejado: cor e traço diferentes, para a figura valer
    também em preto e branco. A legenda conta quantos de cada.
    """
    fig, ax = plt.subplots(figsize=(11, 5.2))
    chegam, param = 0, 0
    for s in SEMENTES:
        perdas, p, _ = treina(s)
        if acerta(p):
            chegam += 1
            ax.semilogy(perdas, color=AZUL, lw=2.2, alpha=0.85, zorder=2)
        else:
            param += 1
            ax.semilogy(perdas, color=LARANJA, lw=3, ls=(0, (6, 3)), zorder=3)
    ax.set_xlim(0, EPOCAS)
    ax.set_ylim(5e-4, 0.6)
    ax.xaxis.set_major_locator(MultipleLocator(500))
    ax.xaxis.set_major_formatter(MILHAR)
    ax.yaxis.set_major_locator(LogLocator(base=10, numticks=10))
    ax.yaxis.set_major_formatter(VIRGULA)
    ax.yaxis.set_minor_formatter(NullFormatter())
    ax.tick_params(labelsize=17)
    ax.set_xlabel("época", fontsize=20)
    ax.set_ylabel("perda", fontsize=20)
    alcas = [plt.Line2D([], [], color=AZUL, lw=3, label=f"{chegam} sementes acertam o XOR"),
             plt.Line2D([], [], color=LARANJA, lw=3, ls=(0, (6, 3)), label=f"{param} sementes param no patamar")]
    fig.legend(handles=alcas, loc="lower center", ncol=2, frameon=False, fontsize=18, columnspacing=2.4)
    fig.tight_layout(rect=(0, 0.1, 1, 1))
    salva(fig, "sementes.png")
    return chegam, param


def mosaico():
    """A imagem da capa: o plano do XOR como cada um dos 20 treinos o deixou, em 4 linhas de 5.

    Um quadro por semente, da 0 à 19, na ordem de leitura. Cada quadro é o plano
    das entradas, de −0,5 a 1,5 nos dois eixos, pintado pela saída da rede depois
    das 2.000 épocas: do fundo dos slides, saída 0, ao azul, saída 1. Os quatro
    exemplos do XOR vão por cima: círculo cheio onde a resposta certa é 1,
    quadrado vazado onde é 0, marcador diferente para a figura valer em preto e
    branco. Os treinos que param no patamar ganham uma moldura laranja: neles, a
    rede responde perto de 0,5 em parte do plano, e o azul fica pela metade.
    """
    tinta = LinearSegmentedColormap.from_list("papel-azul", [FUNDO, AZUL])
    fig, eixos = plt.subplots(4, 5, figsize=(10, 8), facecolor=FUNDO)
    for s, ax in zip(SEMENTES, eixos.flat):
        _, p, _ = treina(s)
        _, _, y = saida_no_plano(p, pontos=201)
        ax.imshow(y, cmap=tinta, vmin=0, vmax=1, origin="lower", extent=(-0.5, 1.5, -0.5, 1.5))
        for (x1, x2), t in zip(X, T):
            if t == 1:
                ax.plot(x1, x2, "o", ms=9, color=ESCURO)
            else:
                ax.plot(x1, x2, "s", ms=8, mfc="none", mec=ESCURO, mew=2)
        ax.set_xticks([])
        ax.set_yticks([])
        parou = not acerta(p)
        for borda in ax.spines.values():
            borda.set_visible(parou)
            borda.set_color(LARANJA)
            borda.set_linewidth(4)
    fig.subplots_adjust(wspace=0.08, hspace=0.08)
    salva(fig, "mosaico.png")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    mosaico()
    para_tras()
    print("sementes que chegam e que param:", sementes())
