"""Figuras dos slides da aula 1.

Rode, a partir da raiz do repositório:
    python aulas/01-neuronio/codigo/figuras_slides.py

Gera duas figuras do mesmo tamanho e com os mesmos eixos, a 200 dpi:
    aulas/01-neuronio/figuras/reta-e.png   o neurônio da tabela do E, a reta dele e o vetor w
    aulas/01-neuronio/figuras/xor.png      os quatro pontos do XOR, que nenhuma reta separa

A figura do perceptron sai do próprio perceptron.py. As fotos e desenhos dos
slides vêm do Wikimedia Commons; autor e licença de cada um estão no README
da aula.
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Patch
from matplotlib.ticker import FuncFormatter

# O que vem entre cifrões, como $x_1$, sai como fórmula, com o índice embaixo, na
# fonte STIX, que vem com o matplotlib e tem o mesmo desenho da STIX Two das
# equações dos slides (infra/equacoes.py).
plt.rcParams["mathtext.fontset"] = "stix"

AULA = Path(__file__).resolve().parents[1]
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])        # as quatro combinações de duas entradas lógicas
AZUL, VERMELHO, REGIAO, ESCURO, LARANJA = "#1f5fad", "#c0392b", "#cfe3f5", "#14213d", "#a8500f"

# Vírgula decimal e sinal de menos tipográfico nos eixos, como pede o CLAUDE.md
VIRGULA = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))


def plano(alvo, com_regiao):
    """Figura e eixos no padrão das duas figuras: mesmo tamanho, mesmos limites, mesma legenda.

    alvo: a resposta certa de cada linha de X, 1 ou 0.
    com_regiao: se a legenda inclui a região onde o neurônio dispara.
    Os pontos de resposta 1 são círculos azuis, e os de resposta 0, quadrados
    vermelhos: forma e cor diferentes, para a figura continuar legível para
    quem não distingue vermelho de azul e em impressão em preto e branco.
    """
    fig, ax = plt.subplots(figsize=(6.4, 7.0))
    ax.scatter(X[alvo == 1, 0], X[alvo == 1, 1], s=420, c=AZUL, zorder=3)
    ax.scatter(X[alvo == 0, 0], X[alvo == 0, 1], s=420, c=VERMELHO, marker="s", zorder=3)
    ax.set_xlim(-0.5, 1.5)
    ax.set_ylim(-0.5, 1.5)
    ax.set_xticks([0, 0.5, 1])
    ax.set_yticks([0, 0.5, 1])
    ax.xaxis.set_major_formatter(VIRGULA)
    ax.yaxis.set_major_formatter(VIRGULA)
    ax.tick_params(labelsize=17)
    ax.set_xlabel("entrada $x_1$", fontsize=20)
    ax.set_ylabel("entrada $x_2$", fontsize=20)
    ax.set_aspect("equal")
    # legenda embaixo, fora do gráfico, centrada, para não cobrir nenhum ponto
    alcas = [plt.Line2D([], [], marker="o", ls="", ms=16, color=AZUL, label="resposta 1"),
             plt.Line2D([], [], marker="s", ls="", ms=16, color=VERMELHO, label="resposta 0")]
    if com_regiao:
        alcas.append(Patch(color=REGIAO, label="dispara"))
    fig.legend(handles=alcas, loc="lower center", ncol=len(alcas), frameon=False, fontsize=17,
               columnspacing=1.2, handletextpad=0.4)
    fig.tight_layout(rect=(0, 0.09, 1, 1))
    return fig, ax


def salva(fig, nome):
    """Salva a 200 dpi. bbox_inches="tight" recorta em volta de tudo o que foi
    desenhado, legenda incluída, para nada encostar na borda."""
    saida = AULA / "figuras" / nome
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.2)
    plt.close(fig)
    print(f"salva: {saida}")


def reta_e():
    """O neurônio com w1 = 1, w2 = 1 e b = -1,5, o da tabela do E no quadro.

    Com esses pesos, a reta x1 + x2 - 1,5 = 0 passa longe dos quatro pontos, o
    que deixa a separação clara na primeira vez que a turma vê a ideia. A região
    azul é onde a soma z é maior ou igual a zero, isto é, onde o neurônio dispara.

    A seta é o vetor de pesos w = (1, 1), desenhado a partir de um ponto da reta.
    Ele é perpendicular à reta e aponta para o lado em que z cresce, que é o lado
    em que o neurônio dispara: é a geometria do produto escalar w·x.
    """
    w1, w2, b = 1.0, 1.0, -1.5
    fig, ax = plano(np.array([0, 0, 0, 1]), com_regiao=True)
    g1, g2 = np.meshgrid(np.linspace(-0.5, 1.5, 401), np.linspace(-0.5, 1.5, 401))
    ax.contourf(g1, g2, w1 * g1 + w2 * g2 + b >= 0, levels=[0.5, 1.5], colors=[REGIAO])
    xs = np.array([-0.5, 1.5])
    ax.plot(xs, -(w1 * xs + b) / w2, color=ESCURO, lw=2.5)        # a reta z = 0
    # o vetor w, com comprimento 0,3 no desenho, saindo do ponto (1,1; 0,4), que está na reta
    base = np.array([1.1, 0.4])
    ponta = base + 0.3 * np.array([w1, w2]) / np.hypot(w1, w2)
    ax.annotate("", xy=ponta, xytext=base, arrowprops=dict(arrowstyle="-|>", lw=3, color=ESCURO, mutation_scale=28))
    # w com a seta em cima, como todo vetor nos slides
    ax.text(ponta[0] + 0.03, ponta[1] + 0.03, r"$\vec{w}$", fontsize=26, color=ESCURO)
    salva(fig, "reta-e.png")


def xor():
    """Os quatro pontos do XOR, sem reta: nenhuma reta deixa os círculos de um
    lado e os quadrados do outro, porque eles estão em diagonal."""
    fig, ax = plano(np.array([0, 1, 1, 0]), com_regiao=False)
    salva(fig, "xor.png")


def neuronio():
    """O neurônio na representação clássica: bolinhas ligadas por linhas.

    Da esquerda para a direita: as entradas x₁ e x₂ e a entrada fixa 1, que
    carrega o viés; uma linha de cada entrada até o neurônio, com o peso que a
    multiplica; a soma Σ; a função degrau, desenhada como um degrau; a saída y.
    Tratar o viés como o peso de uma entrada que vale sempre 1 é o jeito
    clássico de desenhar: b·1 = b, então a conta é a mesma, z = w₁x₁ + w₂x₂ + b.
    Tudo é simétrico em torno da linha do meio, y = 2,8 nas coordenadas do desenho.
    """
    FUNDO, CINZA, SUAVE = "#F6F5F1", "#8a94a6", "#5e6a7d"
    fig, ax = plt.subplots(figsize=(14, 5.6), facecolor=FUNDO)
    ax.set_facecolor(FUNDO)
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 5.6)
    ax.set_aspect("equal")
    ax.axis("off")

    def bolinha(centro, raio, fundo, borda, texto, cor_texto, tamanho):
        ax.add_patch(plt.Circle(centro, raio, facecolor=fundo, edgecolor=borda, lw=3, zorder=3))
        ax.text(*centro, texto, ha="center", va="center", fontsize=tamanho, color=cor_texto, zorder=4)

    def seta(de, para, cor=ESCURO):
        ax.annotate("", xy=para, xytext=de, zorder=2,
                    arrowprops=dict(arrowstyle="-|>", lw=2.5, color=cor, mutation_scale=24, shrinkA=0, shrinkB=0))

    meio = 2.8
    soma, r_soma, r_entrada = np.array([6.2, meio]), 0.95, 0.55
    entradas = [("$x_1$", "$w_1$", 4.4, "white", AZUL), ("$x_2$", "$w_2$", meio, "white", AZUL),
                ("$1$", "$b$", 1.2, "#e9eef5", CINZA)]
    for nome, peso, y, fundo, borda in entradas:
        centro = np.array([1.6, y])
        bolinha(centro, r_entrada, fundo, borda, nome, ESCURO, 30)
        # a linha sai da borda da bolinha e chega à borda do neurônio, na direção que liga os centros
        direcao = (soma - centro) / np.linalg.norm(soma - centro)
        seta(centro + r_entrada * direcao, soma - r_soma * direcao)
        # o peso fica a 42% do caminho, afastado da linha na perpendicular, para
        # não encostar nela: normal é a direção da linha girada de 90 graus
        normal = np.array([-direcao[1], direcao[0]])
        pos = centro + 0.42 * (soma - centro) + 0.42 * normal
        ax.text(*pos, peso, ha="center", va="center", fontsize=30, color=AZUL, zorder=5)

    bolinha(soma, r_soma, ESCURO, ESCURO, r"$\Sigma$", "white", 50)

    # a função degrau, desenhada dentro de uma caixa: 0 à esquerda de z = 0, 1 à direita
    cx, larg, alt = 9.4, 1.9, 1.4
    ax.add_patch(plt.Rectangle((cx - larg / 2, meio - alt / 2), larg, alt, facecolor="white",
                               edgecolor=ESCURO, lw=3, zorder=3))
    xs = [cx - 0.7, cx, cx, cx + 0.7]
    ys = [meio - 0.35, meio - 0.35, meio + 0.35, meio + 0.35]
    ax.plot(xs, ys, color=LARANJA, lw=4, zorder=4, solid_capstyle="round")

    saida = np.array([12.4, meio])
    bolinha(saida, r_entrada, LARANJA, LARANJA, "$y$", "white", 32)

    seta(soma + [r_soma, 0], [cx - larg / 2, meio])
    ax.text((soma[0] + r_soma + cx - larg / 2) / 2, meio + 0.3, "$z$", ha="center", fontsize=30, color=ESCURO)
    seta([cx + larg / 2, meio], saida - [r_entrada, 0])

    # legendas embaixo de cada parte, alinhadas numa mesma altura; a letra é
    # grande porque o slide mostra a figura menor que o tamanho dela
    for x, texto in [(1.6, "entradas"), (soma[0], "soma ponderada"), (cx, "degrau"), (saida[0], "saída")]:
        ax.text(x, 0.25, texto, ha="center", fontsize=23, color=SUAVE)
    salva(fig, "neuronio.png")


if __name__ == "__main__":
    reta_e()
    xor()
    neuronio()
