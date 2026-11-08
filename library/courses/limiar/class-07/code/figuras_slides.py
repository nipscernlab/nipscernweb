"""Figuras dos slides da aula 7: PyTorch.

Rode, a partir da raiz do repositório, depois de mlp_torch.py e de taxa.py:
    python aulas/07-pytorch/codigo/figuras_slides.py

Gera, em aulas/07-pytorch/figuras/:
    bifurcacao.png  a imagem da capa: o diagrama de bifurcação da equação logística,
                    de Jordan Pierce, CC0, recortado para tirar os eixos
    mesma.png       a acurácia na validação, época a época, do NumPy da aula 6 e do PyTorch
    adam.png        a acurácia na validação do gradiente descendente e do Adam
    taxa.png        o erro final contra a taxa, de 0,01 a 100
    zoom.png        o erro final perto do limiar, de 2 a 10, e a faixa de melhora e piora

Os números vêm de resultados/torch.json e resultados/taxa.json e, os da aula 6,
de aulas/06-mnist-numpy/resultados/mlp.json. A imagem original da capa fica em
figuras/bifurcacao-original.png, como veio do Wikimedia Commons.
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FuncFormatter, NullFormatter
from PIL import Image

plt.rcParams["mathtext.fontset"] = "stix"

AULA = Path(__file__).resolve().parents[1]
RAIZ = AULA.parents[1]
AZUL, LARANJA, ESCURO, CINZA = "#1f5fad", "#a8500f", "#14213d", "#8a94a6"
VIRGULA = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))
PORCENTO = FuncFormatter(lambda v, _: f"{100 * v:g}%".replace(".", ","))


def salva(fig, nome):
    """Salva a 200 dpi, recortada em volta do que foi desenhado."""
    saida = AULA / "figuras" / nome
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.2)
    plt.close(fig)
    print(f"salva: {saida}")


def bifurcacao():
    """Recorta do diagrama original só a área do desenho, sem os eixos.

    Os eixos do original têm ponto decimal, 0.8 e 2.4, e o curso usa vírgula;
    a licença CC0 permite recortar. Na versão de 1280 pixels, a área do desenho
    vai de x = 116 a 1243 e de y = 30 a 781.
    """
    original = Image.open(AULA / "figuras" / "bifurcacao-original.png")
    original.crop((116, 30, 1243, 781)).save(AULA / "figuras" / "bifurcacao.png")
    print("salva: bifurcacao.png")


def eixos_epocas(ax, rotulo):
    """O eixo das épocas, de 1 a 20, e o da acurácia em porcentagem, com vírgula."""
    ax.set_xlim(0.5, 20.5)
    ax.set_xticks([1, 5, 10, 15, 20])
    ax.yaxis.set_major_formatter(PORCENTO)
    ax.tick_params(labelsize=17)
    ax.set_xlabel("época", fontsize=18)
    ax.set_ylabel(rotulo, fontsize=18)
    ax.grid(axis="y", color="#e3e6eb", lw=1)


def mesma(torch_, aula6):
    """As duas curvas da acurácia na validação, NumPy e PyTorch: caem uma em cima da outra.

    O NumPy em círculos azuis grandes e vazados; o PyTorch em xis laranja,
    menores, por cima: dá para ver os dois marcadores em cada época.
    """
    fig, ax = plt.subplots(figsize=(8.4, 5.2))
    epocas = np.arange(1, 21)
    ax.plot(epocas, aula6["acuracia_validacao"], "o", ms=13, mfc="none", mec=AZUL, mew=2.4, label="NumPy, aula 6")
    ax.plot(epocas, torch_["sgd"]["historico"]["acuracia_validacao"], "x", ms=9, color=LARANJA, mew=2.6,
            label="PyTorch")
    eixos_epocas(ax, "acurácia na validação")
    ax.set_ylim(0.888, 0.98)
    fig.legend(loc="lower center", ncol=2, frameon=False, fontsize=17, columnspacing=2)
    fig.tight_layout(rect=(0, 0.1, 1, 1))
    salva(fig, "mesma.png")


def adam(torch_):
    """A acurácia na validação, época a época, com o gradiente descendente e com o Adam."""
    fig, ax = plt.subplots(figsize=(8.4, 5.2))
    epocas = np.arange(1, 21)
    ax.plot(epocas, torch_["sgd"]["historico"]["acuracia_validacao"], "o-", ms=7, lw=2.4, color=AZUL,
            label="gradiente descendente, taxa 0,1")
    ax.plot(epocas, torch_["adam"]["historico"]["acuracia_validacao"], "s--", ms=7, lw=2.4, color=LARANJA,
            label="Adam, taxa 0,001")
    eixos_epocas(ax, "acurácia na validação")
    ax.set_ylim(0.888, 0.98)
    fig.legend(loc="lower center", ncol=2, frameon=False, fontsize=16, columnspacing=1.6)
    fig.tight_layout(rect=(0, 0.1, 1, 1))
    salva(fig, "adam.png")


def separa(taxas, finais, antes):
    """Divide os pontos em três grupos: o treino melhorou a rede, piorou, ou a rede explodiu."""
    melhora, piora, explode = [], [], []
    for a, e in zip(taxas, finais):
        if e is None:
            explode.append(a)
        elif e > antes:
            piora.append((a, e))
        else:
            melhora.append((a, e))
    return melhora, piora, explode


def taxa(t):
    """O erro final contra a taxa, nos dois eixos em escala logarítmica.

    Azul, círculo: o treino melhorou a rede, o erro final ficou abaixo da perda
    de antes do treino, a linha cinza tracejada. Laranja, quadrado: piorou. As
    taxas em que a rede explodiu ficam como triângulos no alto.
    """
    antes = t["perda_antes"]
    melhora, piora, explode = separa(t["larga"]["taxas"], t["larga"]["finais"], antes)
    fig, ax = plt.subplots(figsize=(10, 5.6))
    ax.loglog(*zip(*melhora), "o", ms=6, color=AZUL, label="o treino melhora a rede")
    if piora:
        ax.loglog(*zip(*piora), "s", ms=6, color=LARANJA, label="o treino piora a rede")
    if explode:
        ax.loglog(explode, [600] * len(explode), "^", ms=7, color=ESCURO, label="a rede explode")
    ax.axhline(antes, color=CINZA, lw=1.6, ls=(0, (4, 3)), zorder=0)
    ax.text(0.012, antes * 1.25, "perda antes do treino", fontsize=15, color=CINZA)
    ax.set_xlim(0.008, 125)
    ax.set_ylim(3e-3, 1500)
    ax.xaxis.set_major_formatter(VIRGULA)
    ax.yaxis.set_major_formatter(VIRGULA)
    for eixo in (ax.xaxis, ax.yaxis):
        eixo.set_minor_formatter(NullFormatter())
    ax.tick_params(labelsize=16)
    ax.set_xlabel("taxa de aprendizado, η", fontsize=18)
    ax.set_ylabel("erro final", fontsize=18)
    fig.legend(loc="lower center", ncol=3, frameon=False, fontsize=16, columnspacing=1.6)
    fig.tight_layout(rect=(0, 0.1, 1, 1))
    salva(fig, "taxa.png")


def zoom(t):
    """Perto do limiar, de 2 a 10: o erro final em cima, e embaixo uma faixa, uma listra por taxa.

    Na faixa, azul onde o treino melhora a rede e laranja onde piora. Taxas
    vizinhas trocam de cor muitas vezes: a fronteira não é um ponto, é quebrada.
    """
    antes = t["perda_antes"]
    taxas, finais = np.array(t["fina"]["taxas"]), t["fina"]["finais"]
    melhora, piora, explode = separa(taxas, finais, antes)
    fig, (ax, faixa) = plt.subplots(2, 1, figsize=(10, 6.2), sharex=True,
                                    gridspec_kw={"height_ratios": [4, 1], "hspace": 0.12})
    ax.semilogy(*zip(*melhora), "o", ms=4, color=AZUL, label="o treino melhora a rede")
    if piora:
        ax.semilogy(*zip(*piora), "s", ms=4, color=LARANJA, label="o treino piora a rede")
    ax.axhline(antes, color=CINZA, lw=1.6, ls=(0, (4, 3)), zorder=0)
    ax.yaxis.set_major_formatter(VIRGULA)
    ax.yaxis.set_minor_formatter(NullFormatter())
    ax.tick_params(labelsize=16)
    ax.set_ylabel("erro final", fontsize=18)
    cores = [LARANJA if (e is None or e > antes) else AZUL for e in finais]
    passo = taxas[1] - taxas[0]
    faixa.bar(taxas, np.ones_like(taxas), width=passo, color=cores, align="center")
    faixa.set_yticks([])
    faixa.set_xlim(2, 10)
    faixa.xaxis.set_major_formatter(VIRGULA)
    faixa.tick_params(labelsize=16)
    faixa.set_xlabel("taxa de aprendizado, η", fontsize=18)
    for lado in ("top", "right", "left"):
        faixa.spines[lado].set_visible(False)
    fig.legend(loc="lower center", ncol=2, frameon=False, fontsize=16, columnspacing=1.8)
    fig.subplots_adjust(bottom=0.2)
    salva(fig, "zoom.png")


if __name__ == "__main__":
    torch_ = json.loads((AULA / "resultados" / "torch.json").read_text(encoding="utf-8"))
    t = json.loads((AULA / "resultados" / "taxa.json").read_text(encoding="utf-8"))
    aula6 = json.loads((RAIZ / "aulas" / "06-mnist-numpy" / "resultados" / "mlp.json").read_text(encoding="utf-8"))
    bifurcacao()
    mesma(torch_, aula6["redes"]["256"]["historico"])
    adam(torch_)
    taxa(t)
    zoom(t)
