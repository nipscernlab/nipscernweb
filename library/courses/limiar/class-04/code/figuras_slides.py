"""Figuras dos slides da aula 4: o Jacobiano.

Rode, a partir da raiz do repositório:
    python aulas/04-jacobiano/codigo/figuras_slides.py

Gera, a 200 dpi, em aulas/04-jacobiano/figuras/:
    grade.png    a imagem da capa: uma grade regular do plano dobrada pela camada do exemplo
    tanh.png     a tangente hiperbólica e a inclinação dela, 1 − tanh², lado a lado
    ordens.png   as multiplicações do produto dos Jacobianos nas duas ordens, contra a largura da rede
    curvas-perda.png  as curvas de nível da perda da rede desta aula, com o gradiente, para a revisão

As contas vêm de jacobiano.py, ao lado, para as figuras e o código de referência
usarem os mesmos números. O vídeo da aproximação linear sai de animacoes.py.
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FixedLocator, FuncFormatter, LogLocator, NullFormatter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from jacobiano import B1, W1, X0, camada, gradiente_pela_cadeia, multiplicacoes, perda  # noqa: E402

# O que vem entre cifrões sai como fórmula, na fonte STIX, que tem o mesmo
# desenho da STIX Two das equações dos slides (infra/equacoes.py).
plt.rcParams["mathtext.fontset"] = "stix"

AULA = Path(__file__).resolve().parents[1]
AZUL, LARANJA, ESCURO, CINZA = "#1f5fad", "#a8500f", "#14213d", "#8a94a6"

# Vírgula decimal e sinal de menos tipográfico nos eixos, como pede o CLAUDE.md
VIRGULA = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))


def potencia_de_dez(v, _):
    """Marca do eixo em escala logarítmica como potência de dez: 10², 10⁶."""
    return f"$10^{{{int(round(np.log10(v)))}}}$"


def salva(fig, nome):
    """Salva a 200 dpi. bbox_inches="tight" recorta em volta de tudo o que foi
    desenhado, legenda incluída, para nada encostar na borda."""
    saida = AULA / "figuras" / nome
    saida.parent.mkdir(exist_ok=True)
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.2)
    plt.close(fig)
    print(f"salva: {saida}")


def tanh():
    """A tangente hiperbólica, à esquerda, e a inclinação dela, à direita, em dois painéis iguais.

    A tanh vai de −1 a 1 e passa por 0 em z = 0. A inclinação, 1 − tanh²(z), é 1
    em z = 0 e some longe do zero: é por isso que, no exemplo da aula, a linha do
    neurônio com z = 0 sai igual à linha de W no Jacobiano. As linhas tracejadas
    marcam z = 0,75, a soma do outro neurônio do exemplo, e a inclinação 0,5966
    que ela dá.
    """
    fig, eixos = plt.subplots(1, 2, figsize=(10, 4.4))
    z = np.linspace(-4, 4, 801)
    curvas = (("tanh", np.tanh(z), (-1.15, 1.15), [-1, 0, 1]),
              ("inclinação", 1 - np.tanh(z) ** 2, (-0.08, 1.12), [0, 0.5, 1]))
    for ax, (nome, f, ylim, yticks) in zip(eixos, curvas):
        ax.set_box_aspect(0.8)
        ax.plot(z, f, color=ESCURO, lw=3.2)
        ax.axhline(0, color=CINZA, lw=1, zorder=0)
        ax.set_xlim(-4, 4)
        ax.set_ylim(*ylim)
        ax.set_xticks([-4, -2, 0, 2, 4])
        ax.set_yticks(yticks)
        ax.xaxis.set_major_formatter(VIRGULA)
        ax.yaxis.set_major_formatter(VIRGULA)
        ax.tick_params(labelsize=17)
        ax.set_xlabel("$z$", fontsize=24)
    eixos[0].set_title(r"$\tanh(z)$", fontsize=24, color=ESCURO, pad=12)
    eixos[1].set_title(r"$1 - \tanh^2(z)$", fontsize=24, color=ESCURO, pad=12)
    # o ponto do exemplo: z = 0,75 dá a inclinação 1 − tanh²(0,75) = 0,5966
    z0 = 0.75
    inc = 1 - np.tanh(z0) ** 2
    eixos[1].plot([z0, z0], [-0.08, inc], color=LARANJA, lw=2, ls=(0, (4, 3)))
    eixos[1].plot([-4, z0], [inc, inc], color=LARANJA, lw=2, ls=(0, (4, 3)))
    eixos[1].plot([z0], [inc], "o", ms=10, color=LARANJA, zorder=3)
    fig.tight_layout(w_pad=3)
    salva(fig, "tanh.png")


def ordens():
    """As multiplicações do produto dos Jacobianos de 3 camadas, nas duas ordens, contra a largura.

    Os dois eixos em escala logarítmica, em que cada marca vale dez vezes a
    anterior. De trás para a frente, 3m², uma reta de inclinação 2; da frente
    para trás, 2m³ + m², quase uma reta de inclinação 3. Os marcadores são as
    larguras da tabela do código, 10, 100 e 1.000; cor, traço e marcador
    diferentes, para a figura valer também em preto e branco.
    """
    # figura pequena em polegadas e letra grande: no slide, ela ocupa uns 900 pixels
    # de largura, e a letra tem de chegar lá com tamanho de ler no projetor
    fig, ax = plt.subplots(figsize=(8.4, 5.4))
    m = np.logspace(np.log10(2), 3, 200)
    pontos = np.array([10, 100, 1000])          # em m = 2 os dois marcadores se tocariam: lá ficam só as linhas
    tras = [multiplicacoes(3, int(v))[0] for v in pontos]
    frente = [multiplicacoes(3, int(v))[1] for v in pontos]
    ax.loglog(m, 3 * m ** 2, color=AZUL, lw=2.8)
    ax.loglog(m, 2 * m ** 3 + m ** 2, color=LARANJA, lw=2.8, ls=(0, (6, 3)))
    ax.loglog(pontos, tras, "o", ms=11, color=AZUL)
    ax.loglog(pontos, frente, "s", ms=11, color=LARANJA)
    ax.set_xlim(1.6, 1300)
    ax.set_ylim(5, 5e9)
    ax.xaxis.set_major_locator(LogLocator(base=10, numticks=6))
    # no eixo das multiplicações, uma marca a cada duas potências de dez: com todas
    # as nove, a letra teria de ser miúda para elas não encostarem umas nas outras
    ax.yaxis.set_major_locator(FixedLocator([1e1, 1e3, 1e5, 1e7, 1e9]))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}".replace(",", ".")))
    ax.yaxis.set_major_formatter(FuncFormatter(potencia_de_dez))
    for eixo in (ax.xaxis, ax.yaxis):
        eixo.set_minor_formatter(NullFormatter())
    ax.tick_params(labelsize=19)
    ax.set_xlabel("largura da rede, neurônios por camada", fontsize=19)
    ax.set_ylabel("multiplicações", fontsize=19)
    alcas = [plt.Line2D([], [], color=AZUL, lw=2.8, marker="o", ms=10, label="de trás para a frente"),
             plt.Line2D([], [], color=LARANJA, lw=2.8, ls=(0, (6, 3)), marker="s", ms=10,
                        label="da frente para trás")]
    fig.legend(handles=alcas, loc="lower center", ncol=2, frameon=False, fontsize=19, columnspacing=2.0)
    fig.tight_layout(rect=(0, 0.11, 1, 1))
    salva(fig, "ordens.png")


def grade():
    """A imagem da capa: a grade regular do plano das entradas, levada pela camada do exemplo.

    As retas x₁ = constante e x₂ = constante, de −3 a 3 com passo 0,25, passam
    pela camada h⃗ = tanh(W₁ x⃗ + b⃗₁), a de jacobiano.py, e viram curvas no plano
    das saídas, que fica entre −1 e 1 nos dois eixos. Perto das bordas, onde a
    tanh se achata, as curvas se apertam. Sem eixos: é a imagem da capa, no fundo
    dos slides, para não fazer um retângulo branco.
    """
    papel = "#F6F5F1"
    fig, ax = plt.subplots(figsize=(6.4, 6.4), facecolor=papel)
    ax.set_facecolor(papel)
    valores = np.arange(-3, 3.0001, 0.25)
    amostras = np.linspace(-3, 3, 600)
    for v in valores:
        for pontos in (np.column_stack([np.full_like(amostras, v), amostras]),     # a reta x₁ = v
                       np.column_stack([amostras, np.full_like(amostras, v)])):    # a reta x₂ = v
            h = np.array([camada(x, W1, B1) for x in pontos])
            ax.plot(h[:, 0], h[:, 1], color=AZUL, lw=1.1, alpha=0.85)
    ax.set_xlim(-1.04, 1.04)
    ax.set_ylim(-1.04, 1.04)
    ax.set_aspect("equal")
    ax.axis("off")
    saida = AULA / "figuras" / "grade.png"
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.1, facecolor=papel)
    plt.close(fig)
    print(f"salva: {saida}")


def curvas_perda():
    """As curvas de nível da perda da rede desta aula, como função das entradas, com o gradiente.

    L(x⃗) = (v⃗ · h⃗₂ − t)², com h⃗₂ a saída das duas camadas de jacobiano.py: a mesma
    perda do slide "Até a perda, o gradiente é uma linha". As setas cinza são o
    gradiente em pontos de uma grade, encurtadas para caber; a laranja é o
    gradiente no ponto do exemplo, (1; 0,25), que a aula calcula pela regra da
    cadeia: (1,0940; −4,6074). Cada seta cruza as curvas de nível em ângulo reto,
    como na aula 2. É a figura da revisão: a ideia da aula 2 numa função nova.
    """
    x1, x2 = np.meshgrid(np.linspace(-0.5, 2.5, 300), np.linspace(-1.5, 2.0, 350))
    L = np.array([[perda(np.array([a, b])) for a, b in zip(la, lb)] for la, lb in zip(x1, x2)])
    fig, ax = plt.subplots(figsize=(5.0, 5.9))
    niveis = [0.1, 0.5, 1.0, 2.0, 3.0]
    cs = ax.contour(x1, x2, L, levels=niveis, colors=AZUL, linewidths=1.3)
    ax.clabel(cs, levels=[0.1, 1.0, 3.0], fmt=lambda v: f"{v:g}".replace(".", ","), fontsize=16, inline_spacing=6)
    for a in (0.0, 1.0, 2.0):
        for b in (-1.0, -0.25, 0.5, 1.25):
            p = np.array([a, b])
            if np.abs(p - X0).max() < 0.6:
                continue                                            # o ponto do exemplo leva a seta laranja
            g = gradiente_pela_cadeia(p)
            g = 0.32 * g / max(np.linalg.norm(g), 1e-9)              # todas do mesmo tamanho: só a direção
            ax.annotate("", xy=p + g, xytext=p, arrowprops=dict(arrowstyle="-|>", color=CINZA, lw=1.4))
    g0 = gradiente_pela_cadeia(X0)
    ax.annotate("", xy=X0 + 0.12 * g0, xytext=X0, arrowprops=dict(arrowstyle="-|>", color=LARANJA, lw=2.4))
    ax.plot(*X0, "o", color=LARANJA, ms=7)
    ax.set_xlabel("$x_1$", fontsize=20)
    ax.set_ylabel("$x_2$", fontsize=20)
    ax.xaxis.set_major_formatter(VIRGULA)
    ax.yaxis.set_major_formatter(VIRGULA)
    ax.tick_params(labelsize=16)
    ax.set_aspect("equal")
    salva(fig, "curvas-perda.png")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    grade()
    tanh()
    ordens()
    curvas_perda()
