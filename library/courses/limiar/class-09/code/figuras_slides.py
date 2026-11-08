"""Figuras dos slides da aula 9: o fractal e o projeto.

Rode, a partir da raiz do repositório, depois de fractal.py e de plano_aula7.py:
    python aulas/09-projeto/codigo/figuras_slides.py

Gera, a 200 dpi, em aulas/09-projeto/figuras/:
    gancho.png     a janela 4 do zoom em 1.024 por 1.024 treinos, sem eixos: o mapa do vídeo do
                   laço da aula 10; foi a capa desta aula até 08/11/2026
    janela.png     o mapa da janela inteira, 512 por 512 treinos, com a legenda
    janelas.png    as seis janelas do zoom, cada uma com o quadrado da seguinte
    aula7.png      a rede da aula 7 no plano das duas taxas, com a diagonal, e a perda de duas
                   taxas vizinhas por 600 passos
    dados.png      a janela inteira com o dado aleatório do artigo e com os múons do CMS

As cores, aqui, nos vídeos e no projeto/varredura.py, de onde vêm: o azul e o
laranja do curso, de infra/slides.py. Convergiu em azul, do quase branco, o
treino mais rápido, ao azul, o mais lento; divergiu em laranja, do laranja, a
explosão mais rápida, ao laranja escurecido, a mais lenta. Todo azul é mais
claro que todo laranja, e as duas regiões se separam também em escala de cinza
e para quem não distingue vermelho de verde.

O gancho leva uns 5 minutos no laptop do professor, com 16 processos, na primeira
vez; as figuras leem os .npy gravados por fractal.py e por plano_aula7.py.
"""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Patch, Rectangle
from matplotlib.ticker import FuncFormatter

AULA = Path(__file__).resolve().parents[1]
RAIZ = AULA.parents[1]
RESULTADOS = AULA / "resultados"
sys.path.insert(0, str(Path(__file__).resolve().parent))

plt.rcParams["mathtext.fontset"] = "stix"
ESCURO, SUAVE = "#14213d", "#5e6a7d"
VIRGULA = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))

# As pontas das duas escalas de cor, em RGB de 0 a 1.
# A pintura dos mapas é a do projeto, num lugar só: projeto/varredura.py, com o
# azul e o laranja do curso, de infra/slides.py.
sys.path.insert(0, str(RAIZ / "projeto"))
sys.path.insert(0, str(RAIZ / "infra"))
from slides import AZUL, LARANJA  # noqa: E402
from varredura import (CONVERGIU_LENTO as AZUL_LENTO, CONVERGIU_RAPIDO as AZUL_RAPIDO,  # noqa: E402
                       DIVERGIU_LENTO as MARROM_LENTO, DIVERGIU_RAPIDO as LARANJA_RAPIDO, pinta)

# o azul do curso clareado, para a classe "voltou" do mapa da aula 7 ficar mais
# clara que o laranja em escala de cinza
AZUL_CLARO = tuple(0.45 * np.array(AZUL_LENTO) + 0.55)


def legenda_cores(ax, ncol=2, y=-0.12, tamanho=13):
    """As quatro pontas das escalas, embaixo do mapa, fora da área dos dados."""
    itens = [Patch(color=AZUL_LENTO, label="convergiu devagar"), Patch(color=AZUL_RAPIDO, label="convergiu rápido"),
             Patch(color=MARROM_LENTO, label="divergiu devagar"), Patch(color=LARANJA_RAPIDO, label="divergiu rápido")]
    ax.legend(handles=itens, loc="upper center", bbox_to_anchor=(0.5, y), ncol=ncol, frameon=False,
              fontsize=tamanho, handlelength=1.6, columnspacing=1.6)


def eixos_taxa(ax, tamanho=16, marcas=14):
    ax.set_xlabel(r"$\log_{10}\,\eta_0$, a taxa da camada de entrada", fontsize=tamanho)
    ax.set_ylabel(r"$\log_{10}\,\eta_1$, a taxa da camada de saída", fontsize=tamanho)
    ax.xaxis.set_major_formatter(VIRGULA)
    ax.yaxis.set_major_formatter(VIRGULA)
    ax.tick_params(labelsize=marcas)


def salva(fig, nome):
    """Salva a 200 dpi, recortada em volta do que foi desenhado."""
    saida = AULA / "figuras" / nome
    saida.parent.mkdir(exist_ok=True)
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.2)
    plt.close(fig)
    print(f"salva: {saida}")


def janela():
    """O mapa da janela inteira, a janela 0 do zoom, com a legenda embaixo."""
    z = json.loads((RESULTADOS / "zoom.json").read_text(encoding="utf-8"))
    V = np.load(RESULTADOS / "zoom-0.npy")
    fig, ax = plt.subplots(figsize=(6, 6.6))
    ax.imshow(pinta(V), origin="lower", extent=z["janelas"][0], interpolation="nearest")
    eixos_taxa(ax, 17, 15)
    legenda_cores(ax, y=-0.13, tamanho=15)
    salva(fig, "janela.png")


def janelas():
    """As seis janelas do zoom, em duas linhas de três, cada uma com o quadrado da seguinte em preto."""
    z = json.loads((RESULTADOS / "zoom.json").read_text(encoding="utf-8"))
    fig, axs = plt.subplots(2, 3, figsize=(13.5, 9.6))
    for k, ax in enumerate(axs.ravel()):
        j = z["janelas"][k]
        ax.imshow(pinta(np.load(RESULTADOS / f"zoom-{k}.npy")), origin="lower", extent=j, interpolation="nearest")
        ax.set_xticks([])
        ax.set_yticks([])
        aumento = f"{4 ** k:,}".replace(",", ".")
        ax.set_title(f"janela {k}: {aumento} ×", fontsize=21, color=ESCURO)
        if k + 1 < len(z["janelas"]):
            x0, x1, y0, y1 = z["janelas"][k + 1]
            ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, fill=False, lw=2.2, ec="black"))
            ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, fill=False, lw=0.9, ec="white"))
    fig.subplots_adjust(wspace=0.08, hspace=0.16)
    legenda_cores(axs[1, 1], ncol=4, y=-0.06, tamanho=19)
    salva(fig, "janelas.png")


def aula7():
    """A rede da aula 7 no plano das duas taxas, à esquerda, e a perda de três taxas vizinhas, à direita.

    À esquerda, cada pixel é um treino de 200 passos, como na aula 7, numa de três
    classes no passo 200 (plano_aula7.py): voltou, a perda abaixo da de antes do
    treino; em trânsito, ainda acima dela; explodiu. A diagonal tracejada é a taxa
    única da aula 7; o quadrado preto, a janela da faixa.
    À direita, duas taxas vizinhas da janela da faixa, na mesma linha, a segunda
    0,9% maior, treinadas por 600 passos: a perda das duas salta para dezenas e
    fica oscilando, e no passo 200 uma está abaixo da perda de antes e a outra
    acima. É a causa do granulado.
    Cores do curso: azul-claro, laranja e laranja escurecido, três níveis de
    cinza bem separados; nas curvas, cor, traço e marcador diferentes.
    """
    r = json.loads((RESULTADOS / "plano-aula7.json").read_text(encoding="utf-8"))
    antes = r["perda_antes"]
    cores3 = np.array([AZUL_CLARO, LARANJA_RAPIDO, MARROM_LENTO])
    fig, axs = plt.subplots(1, 2, figsize=(13, 6.1))
    for ax in axs:
        ax.set_box_aspect(0.75)

    # à esquerda, o plano no passo 200
    ax = axs[0]
    c = np.load(RESULTADOS / "plano-aula7-plano.npy")
    j = r["plano"]["janela"]
    ax.imshow(cores3[c], origin="lower", extent=j, interpolation="nearest", aspect="auto")
    eixos_taxa(ax, 17, 15)
    ax.plot([j[0], j[1]], [j[0], j[1]], ls="--", lw=2, color="black")
    x0, x1, y0, y1 = r["faixa"]["janela"]
    ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, fill=False, lw=2.2, ec="black"))
    ax.set_title("o plano, no passo 200", fontsize=18, color=ESCURO)
    itens = [Patch(color=cores3[0], label="voltou"), Patch(color=cores3[1], label="em trânsito"),
             Patch(color=cores3[2], label="explodiu"),
             plt.Line2D([], [], ls="--", lw=2, color="black", label=r"$\eta_0 = \eta_1$, a aula 7")]
    ax.legend(handles=itens, loc="upper center", bbox_to_anchor=(0.5, -0.2), ncol=2, frameon=False,
              fontsize=16, handlelength=2.2, columnspacing=1.4)

    # à direita, duas taxas vizinhas, 600 passos
    ax = axs[1]
    passos = np.arange(len(r["vizinhas"][0]["perdas"]))
    for vz, (cor, traco, marca) in zip(r["vizinhas"][4:6], [(LARANJA, "-", "s"), (AZUL, "-", "o")]):
        k = vz["voltou_no_passo"]
        quando = (f"abaixo de 2,32 no passo {k}" if k else f"acima de 2,32 até o passo {passos[-1]}")
        ax.semilogy(passos, vz["perdas"], color=cor, ls=traco, lw=1.6, marker=marca, ms=8, markevery=50,
                    label=rf"$\eta_0$ = {vz['eta0']:.2f}: {quando}".replace(".", ",", 1))
    ax.axhline(antes, color=ESCURO, lw=2, ls=(0, (1, 1.5)), label="a perda de antes do treino, 2,32")
    ax.axvline(200, color=SUAVE, lw=2, ls=(0, (6, 3)), label="o passo 200, o da aula 7")
    ax.set_xlim(0, passos[-1])
    ax.set_ylim(0.8, 120)
    ax.set_xlabel("passo do treino", fontsize=17)
    ax.set_ylabel("perda", fontsize=17)
    ax.yaxis.set_major_formatter(VIRGULA)
    ax.tick_params(labelsize=15)
    ax.set_title("duas taxas vizinhas, 600 passos", fontsize=18, color=ESCURO)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.2), ncol=1, frameon=False, fontsize=16,
              handlelength=2.6)
    fig.subplots_adjust(wspace=0.3, bottom=0.3, top=0.93, left=0.08, right=0.97)
    salva(fig, "aula7.png")


def dados():
    """A janela inteira com o dado aleatório do artigo e com os múons, lado a lado (projeto/figuras/)."""
    fig, axs = plt.subplots(1, 2, figsize=(13, 7.2))
    for ax, nome, titulo in zip(axs, ("aleatorio", "muons"), ("dado aleatório, como no artigo", "72 eventos do CMS")):
        reg = json.loads((RAIZ / "projeto" / "figuras" / f"janela-{nome}.json").read_text(encoding="utf-8"))
        V = np.load(RAIZ / "projeto" / "figuras" / f"janela-{nome}.npy")
        ax.imshow(pinta(V), origin="lower", extent=reg["janela"], interpolation="nearest")
        eixos_taxa(ax, 17, 15)
        ax.set_title(titulo, fontsize=19, color=ESCURO)
    fig.subplots_adjust(wspace=0.28, bottom=0.2)
    itens = [Patch(color=AZUL_LENTO, label="convergiu devagar"), Patch(color=AZUL_RAPIDO, label="convergiu rápido"),
             Patch(color=MARROM_LENTO, label="divergiu devagar"), Patch(color=LARANJA_RAPIDO, label="divergiu rápido")]
    fig.legend(handles=itens, loc="lower center", ncol=4, frameon=False, fontsize=17, bbox_to_anchor=(0.5, 0.02))
    salva(fig, "dados.png")


def gancho():
    """A janela 4 do zoom em 1.024 por 1.024 treinos, sem eixos: o mapa do laço da aula 10."""
    from fractal import janela_do_zoom, mapa, rede_e_dados
    destino = RESULTADOS / "gancho.npy"
    if not destino.exists():
        np.save(destino, mapa(janela_do_zoom(4), 1024, rede_e_dados()))
    V = np.load(destino)
    fig = plt.figure(figsize=(1024 / 200, 1024 / 200), dpi=200)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.imshow(pinta(V), origin="lower", interpolation="nearest")
    ax.axis("off")
    saida = AULA / "figuras" / "gancho.png"
    fig.savefig(saida, dpi=200)
    plt.close(fig)
    print(f"salva: {saida}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    pedidas = sys.argv[1:] or ["janela", "janelas", "aula7", "dados", "gancho"]
    for nome in pedidas:
        globals()[nome]()
