"""Figuras dos slides da aula 8: os dados do CERN.

Rode, a partir da raiz do repositório, depois de mlp_massa.py:
    python aulas/08-dados-do-cern/codigo/figuras_slides.py

Gera, a 200 dpi, em aulas/08-dados-do-cern/figuras/:
    histograma.png  a massa invariante dos 100 mil eventos, com os três picos marcados
    rede.png        a massa da rede contra a da fórmula, nos 10 mil eventos do teste,
                    e os dois histogramas, um sobre o outro
    perto.png       os picos do J/ψ e do Υ de perto, em escala linear, com a largura
                    do pico do J/ψ à meia altura
    curva.png       o erro mediano no treino e na validação, época a época, com a
                    melhor época marcada
    onde-erra.png   o pico do J/ψ pela fórmula e pela rede, no teste, e o erro
                    mediano da rede em cada faixa de massa

Os números vêm de dimuon.py e de resultados/massa.json. As massas das partículas
marcadas são as da Wikipedia, que cita o Particle Data Group: J/ψ, 3,0969 GeV;
Υ, 9,46 GeV; Z, 91,1880 GeV.
"""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FuncFormatter, NullFormatter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dimuon import carrega  # noqa: E402

plt.rcParams["mathtext.fontset"] = "stix"

AULA = Path(__file__).resolve().parents[1]
AZUL, LARANJA, ESCURO, CINZA = "#1f5fad", "#a8500f", "#14213d", "#8a94a6"
SUAVE = "#5e6a7d"
VIRGULA = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))
MILHAR = FuncFormatter(lambda v, _: f"{v:,.0f}".replace(",", "."))
PICOS = [("J/ψ", 3.0969), ("Υ", 9.46), ("Z", 91.188)]
BORDAS = np.logspace(np.log10(2), np.log10(110), 301)     # 300 faixas, iguais em escala logarítmica


def salva(fig, nome):
    """Salva a 200 dpi, recortada em volta do que foi desenhado."""
    saida = AULA / "figuras" / nome
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.2)
    plt.close(fig)
    print(f"salva: {saida}")


def eixo_massa(ax):
    """O eixo da massa em escala logarítmica, com as marcas 2, 5, 10, 20, 50 e 100 GeV."""
    ax.set_xscale("log")
    ax.set_xlim(2, 110)
    ax.set_xticks([2, 5, 10, 20, 50, 100])
    ax.xaxis.set_major_formatter(VIRGULA)
    ax.xaxis.set_minor_formatter(NullFormatter())
    ax.set_xlabel("massa invariante dos dois múons, em GeV", fontsize=18)


def histograma(M):
    """Quantos eventos caem em cada faixa de massa, com os três picos marcados por cima.

    As faixas são iguais em escala logarítmica, para os picos de 3 e de 91 GeV
    terem a mesma largura relativa. O eixo vertical também é logarítmico: o fundo
    cai de milhares para dezenas de eventos por faixa. Cada nome fica acima do
    pico, longe dos dados, com uma linha fina até ele.
    """
    fig, ax = plt.subplots(figsize=(11, 5.6))
    n, _, _ = ax.hist(M, bins=BORDAS, histtype="stepfilled", color="#c9d7ea", edgecolor=AZUL, lw=1.4)
    ax.set_yscale("log")
    ax.set_ylim(3, 1.2e5)          # espaço em cima para os nomes, fora dos dados
    eixo_massa(ax)
    ax.yaxis.set_major_formatter(MILHAR)
    ax.yaxis.set_minor_formatter(NullFormatter())
    ax.tick_params(labelsize=16)
    ax.set_ylabel("eventos por faixa", fontsize=18)
    for nome, m in PICOS:
        k = np.searchsorted(BORDAS, m) - 1
        topo = n[max(k - 2, 0):k + 3].max()
        # o nome do Z, perto da borda direita, fica à esquerda da linha, para não sair do gráfico
        ax.annotate(f"{nome}, {m:g} GeV".replace(".", ","), xy=(m, topo * 1.15), xytext=(m, topo * 4.5),
                    ha="right" if m > 50 else "center", fontsize=16, color=LARANJA,
                    arrowprops={"arrowstyle": "-", "color": LARANJA, "lw": 1.4})
    salva(fig, "histograma.png")


def rede(resultado):
    """A rede contra a fórmula: à esquerda, um ponto por evento do teste; à direita, os dois histogramas.

    Na esquerda, a diagonal cinza tracejada é onde a rede acerta em cheio; os
    pontos azuis ficam em volta dela. Na direita, a fórmula em azul cheio e a
    rede em laranja, só o contorno: os picos aparecem nos dois, mais largos na
    rede.
    """
    m_f, m_r = np.array(resultado["teste_formula"]), np.array(resultado["teste_rede"])
    fig, (esq, dir_) = plt.subplots(1, 2, figsize=(12, 5.2), gridspec_kw={"wspace": 0.32})
    esq.plot(m_f, m_r, "o", ms=2.2, color=AZUL, alpha=0.35, mew=0)
    esq.plot([2, 110], [2, 110], color=CINZA, lw=1.6, ls=(0, (4, 3)))
    eixo_massa(esq)
    esq.set_xlabel("massa pela fórmula, GeV", fontsize=17)
    esq.set_yscale("log")
    esq.set_ylim(2, 110)
    esq.set_yticks([2, 5, 10, 20, 50, 100])
    esq.yaxis.set_major_formatter(VIRGULA)
    esq.yaxis.set_minor_formatter(NullFormatter())
    esq.set_ylabel("massa pela rede, GeV", fontsize=17)
    esq.set_aspect("equal")
    bordas = np.logspace(np.log10(2), np.log10(110), 121)
    dir_.hist(m_f, bins=bordas, histtype="stepfilled", color="#c9d7ea", edgecolor=AZUL, lw=1.4, label="fórmula")
    dir_.hist(m_r, bins=bordas, histtype="step", color=LARANJA, lw=2.2, ls=(0, (5, 2)), label="rede")
    dir_.set_yscale("log")
    eixo_massa(dir_)
    dir_.set_xlabel("massa invariante, GeV", fontsize=17)
    dir_.set_ylabel("eventos por faixa", fontsize=17)
    dir_.yaxis.set_major_formatter(MILHAR)
    dir_.yaxis.set_minor_formatter(NullFormatter())
    for ax in (esq, dir_):
        ax.tick_params(labelsize=15)
    alcas = [plt.Line2D([], [], color=AZUL, lw=6, alpha=0.5, label="fórmula"),
             plt.Line2D([], [], color=LARANJA, lw=2.2, ls=(0, (5, 2)), label="rede")]
    # a legenda vai embaixo dos dois painéis, abaixo dos nomes dos eixos
    fig.legend(handles=alcas, loc="upper center", ncol=2, frameon=False, fontsize=16, bbox_to_anchor=(0.5, -0.06))
    salva(fig, "rede.png")


def meia_altura(centros, n, fundo):
    """A largura do pico à meia altura, em GeV, descontado o fundo.

    O fundo é a média das faixas dos lados, longe do pico. A altura do pico é o
    máximo menos o fundo; a largura é a distância entre os dois pontos em que a
    contagem cruza o fundo mais a metade dessa altura, com interpolação linear
    entre as faixas vizinhas. É uma medida simples, sem ajuste de curva.
    Devolve as duas pontas, em GeV, e a contagem da meia altura.
    """
    k = int(np.argmax(n))
    meia = fundo + (n[k] - fundo) / 2
    esq = k
    while n[esq] > meia:
        esq -= 1
    dir_ = k
    while n[dir_] > meia:
        dir_ += 1
    x_esq = centros[esq] + (meia - n[esq]) / (n[esq + 1] - n[esq]) * (centros[esq + 1] - centros[esq])
    x_dir = centros[dir_ - 1] + (meia - n[dir_ - 1]) / (n[dir_] - n[dir_ - 1]) * (centros[dir_] - centros[dir_ - 1])
    return x_esq, x_dir, meia


def perto(M):
    """Os picos do J/ψ e do Υ em escala linear, nos 100 mil eventos, e a largura do J/ψ à meia altura.

    Faixas de 10 MeV no J/ψ e de 25 MeV no Υ. A seta laranja marca a largura do
    pico do J/ψ à meia altura, medida por meia_altura(); o número fica à direita
    da seta, sobre o fundo, longe do pico. Devolve a largura, em MeV.
    """
    fig, (esq, dir_) = plt.subplots(1, 2, figsize=(12, 4.8), gridspec_kw={"wspace": 0.28})
    bordas = np.arange(2.80, 3.40001, 0.01)
    n, _, _ = esq.hist(M, bins=bordas, histtype="stepfilled", color="#c9d7ea", edgecolor=AZUL, lw=1.4)
    centros = (bordas[1:] + bordas[:-1]) / 2
    lados = (centros < 2.95) | (centros > 3.25)
    x_esq, x_dir, meia = meia_altura(centros, n, n[lados].mean())
    esq.annotate("", xy=(x_esq, meia), xytext=(x_dir, meia),
                 arrowprops={"arrowstyle": "<->", "color": LARANJA, "lw": 2})
    esq.text(x_dir + 0.03, meia, f"{1000 * (x_dir - x_esq):.0f} MeV", color=LARANJA, fontsize=16, va="center")
    esq.set_xlim(2.8, 3.4)
    esq.set_ylim(0, n.max() * 1.12)
    esq.set_title("J/ψ, faixas de 10 MeV", fontsize=17, color=ESCURO)
    bordas = np.arange(8.80, 10.60001, 0.025)
    n2, _, _ = dir_.hist(M, bins=bordas, histtype="stepfilled", color="#c9d7ea", edgecolor=AZUL, lw=1.4)
    dir_.set_xlim(8.8, 10.6)
    dir_.set_ylim(0, n2.max() * 1.12)
    dir_.set_title("Υ, faixas de 25 MeV", fontsize=17, color=ESCURO)
    for ax in (esq, dir_):
        ax.xaxis.set_major_formatter(VIRGULA)
        ax.yaxis.set_major_formatter(MILHAR)
        ax.tick_params(labelsize=15)
        ax.set_xlabel("massa invariante, GeV", fontsize=17)
    esq.set_ylabel("eventos por faixa", fontsize=17)
    salva(fig, "perto.png")
    return 1000 * (x_dir - x_esq)


def curva(resultado):
    """O erro mediano no treino e na validação, época a época, em escala logarítmica, com a melhor época marcada.

    Marcadores diferentes para as duas curvas, círculo e quadrado, para a figura
    se ler em escala de cinza; a legenda vai embaixo, fora dos dados.
    """
    h = resultado["historico"]
    epocas = np.arange(1, len(h["erro_treino"]) + 1)
    melhor = resultado["melhor_epoca"]
    fig, ax = plt.subplots(figsize=(11, 4.8))
    ax.plot(epocas, 100 * np.array(h["erro_treino"]), "-o", color=AZUL, ms=4, lw=1.6, label="treino, 80 mil eventos")
    ax.plot(epocas, 100 * np.array(h["erro_validacao"]), "-s", color=LARANJA, ms=4, lw=1.6,
            label="validação, 10 mil eventos")
    ax.axvline(melhor, color=CINZA, lw=1.4, ls=(0, (4, 3)))
    ax.set_yscale("log")
    ax.set_ylim(1.5, 16)
    ax.set_yticks([2, 3, 5, 10, 15])
    ax.yaxis.set_major_formatter(VIRGULA)
    ax.yaxis.set_minor_formatter(NullFormatter())
    ax.set_xlim(0, len(epocas) + 1)
    ax.text(melhor - 1.5, 10, f"época {melhor}, a melhor\nna validação", ha="right", va="center", fontsize=15,
            color=SUAVE)
    ax.set_xlabel("época", fontsize=17)
    ax.set_ylabel("erro relativo mediano, %", fontsize=17)
    ax.tick_params(labelsize=15)
    fig.legend(loc="upper center", ncol=2, frameon=False, fontsize=15, bbox_to_anchor=(0.5, -0.02))
    salva(fig, "curva.png")


REGIOES = [(2, 2.9, "2 a 2,9"), (2.9, 3.3, "J/ψ\n2,9 a 3,3"), (3.3, 8.5, "3,3 a 8,5"), (8.5, 11, "Υ\n8,5 a 11"),
           (11, 80, "11 a 80"), (80, 100, "Z\n80 a 100")]


def onde_erra(resultado):
    """À esquerda, o pico do J/ψ no teste, pela fórmula e pela rede; à direita, o erro mediano da rede por faixa.

    Em cima de cada barra, quantos eventos do teste caem na faixa: o erro do Z,
    com poucos eventos, é o menos firme. Devolve, por faixa, o erro mediano em %
    e a contagem.
    """
    m_f, m_r = np.array(resultado["teste_formula"]), np.array(resultado["teste_rede"])
    rel = np.abs(m_r - m_f) / m_f
    fig, (esq, dir_) = plt.subplots(1, 2, figsize=(12, 4.8), gridspec_kw={"wspace": 0.3})
    bordas = np.arange(2.80, 3.40001, 0.02)
    esq.hist(m_f, bins=bordas, histtype="stepfilled", color="#c9d7ea", edgecolor=AZUL, lw=1.4)
    esq.hist(m_r, bins=bordas, histtype="step", color=LARANJA, lw=2.2, ls=(0, (5, 2)))
    esq.set_xlim(2.8, 3.4)
    esq.xaxis.set_major_formatter(VIRGULA)
    esq.set_xlabel("massa invariante, GeV", fontsize=17)
    esq.set_ylabel("eventos do teste por faixa", fontsize=17)
    esq.set_title("o J/ψ no teste, faixas de 20 MeV", fontsize=17, color=ESCURO)
    medianas, contagens = [], []
    for lo, hi, _ in REGIOES:
        s = (m_f >= lo) & (m_f < hi)
        medianas.append(100 * np.median(rel[s]))
        contagens.append(int(s.sum()))
    posicoes = np.arange(len(REGIOES))
    dir_.bar(posicoes, medianas, color="#c9d7ea", edgecolor=AZUL, lw=1.4, width=0.7)
    for x, v, n in zip(posicoes, medianas, contagens):
        dir_.text(x, v + 0.08, f"{n:,}".replace(",", "."), ha="center", va="bottom", fontsize=13, color=SUAVE)
    dir_.set_xticks(posicoes, [r[2] for r in REGIOES], fontsize=13)
    dir_.set_ylim(0, max(medianas) * 1.25)
    dir_.yaxis.set_major_formatter(VIRGULA)
    dir_.set_ylabel("erro relativo mediano, %", fontsize=17)
    dir_.set_xlabel("massa pela fórmula, GeV", fontsize=17)
    dir_.set_title("o erro da rede; em cima, quantos eventos", fontsize=17, color=ESCURO)
    for ax in (esq, dir_):
        ax.tick_params(axis="y", labelsize=15)
    esq.tick_params(axis="x", labelsize=15)
    alcas = [plt.Line2D([], [], color=AZUL, lw=6, alpha=0.5, label="fórmula"),
             plt.Line2D([], [], color=LARANJA, lw=2.2, ls=(0, (5, 2)), label="rede")]
    fig.legend(handles=alcas, loc="upper left", ncol=2, frameon=False, fontsize=15, bbox_to_anchor=(0.1, -0.06))
    salva(fig, "onde-erra.png")
    return dict(zip([r[2] for r in REGIOES], zip(medianas, contagens)))


if __name__ == "__main__":
    c = carrega()
    resultado = json.loads((AULA / "resultados" / "massa.json").read_text(encoding="utf-8"))
    histograma(c["M"])
    rede(resultado)
    print(f"largura do J/ψ à meia altura: {perto(c['M']):.0f} MeV")
    curva(resultado)
    print(onde_erra(resultado))
