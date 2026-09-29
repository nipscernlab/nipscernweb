"""Figuras dos slides da aula 2.

Rode, a partir da raiz do repositório:
    python aulas/02-gradiente/codigo/figuras_slides.py

Gera, a 200 dpi, em aulas/02-gradiente/figuras/:
    neuronio-linear.png   o neurônio da aula 1 sem o degrau: a saída é a própria soma
    dados.png             os 20 pontos, uma reta qualquer e o erro de cada ponto
    direcao.png           o sinal da derivada diz para que lado fica o fundo
    curvas.png            as curvas de nível da perda e o gradiente, perpendicular a elas
    limiar.png            a perda depois de 100 passos contra a taxa: o limiar

Os dados e as contas da reta vêm de reta.py, ao lado, para as figuras e a
solução de referência usarem os mesmos pontos. A figura da perda a cada passo,
taxas.png, sai do próprio reta.py. A derivada, a descida em 3D e as taxas na
parábola viraram vídeos, em animacoes.py.
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Patch
from matplotlib.ticker import FuncFormatter

from reta import PASSOS, dados, descer, gradiente, limiar_pela_hessiana, minimos_quadrados, perda

# O que vem entre cifrões, como $x_i$, sai como fórmula, com o índice embaixo, na
# fonte STIX, que vem com o matplotlib e tem o mesmo desenho da STIX Two das
# equações dos slides (infra/equacoes.py).
plt.rcParams["mathtext.fontset"] = "stix"

AULA = Path(__file__).resolve().parents[1]
AZUL, VERMELHO, LARANJA, ESCURO = "#1f5fad", "#c0392b", "#a8500f", "#14213d"
REGIAO, CINZA, SUAVE, FUNDO = "#cfe3f5", "#8a94a6", "#5e6a7d", "#F6F5F1"
CLARO_LARANJA = "#f6e2d3"    # fundo da região em que o treino diverge

# Vírgula decimal e sinal de menos tipográfico nos eixos, como pede o CLAUDE.md
VIRGULA = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))


def br(v, casas=2):
    """Número com vírgula decimal e o menos tipográfico, para rótulos e legendas."""
    return f"{v:.{casas}f}".replace(".", ",").replace("-", "−")


def eixos_br(ax, tamanho=17):
    """Vírgula decimal nos dois eixos e o tamanho dos números das marcas."""
    ax.xaxis.set_major_formatter(VIRGULA)
    ax.yaxis.set_major_formatter(VIRGULA)
    ax.tick_params(labelsize=tamanho)


def salva(fig, nome):
    """Salva a 200 dpi. bbox_inches="tight" recorta em volta de tudo o que foi
    desenhado, legenda incluída, para nada encostar na borda."""
    saida = AULA / "figuras" / nome
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.2)
    plt.close(fig)
    print(f"salva: {saida}")


def neuronio_linear():
    """O neurônio da aula 1, em bolinhas ligadas por linhas, sem o degrau.

    Da esquerda para a direita: a entrada x e a entrada fixa 1, que carrega o
    viés; uma linha de cada até a soma, com o peso que a multiplica; a soma Σ;
    e a saída y, que é a própria soma: y = w·x + b. Com uma entrada só, os
    pontos (x, y) formam uma reta, e é por isso que ajustar o neurônio é
    ajustar uma reta. Tudo é simétrico em torno da linha do meio, y = 2,4 nas
    coordenadas do desenho.
    """
    fig, ax = plt.subplots(figsize=(12, 4.8), facecolor=FUNDO)
    ax.set_facecolor(FUNDO)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 4.8)
    ax.set_aspect("equal")
    ax.axis("off")

    def bolinha(centro, raio, fundo, borda, texto, cor_texto, tamanho):
        ax.add_patch(plt.Circle(centro, raio, facecolor=fundo, edgecolor=borda, lw=3, zorder=3))
        ax.text(*centro, texto, ha="center", va="center", fontsize=tamanho, color=cor_texto, zorder=4)

    def seta(de, para):
        ax.annotate("", xy=para, xytext=de, zorder=2,
                    arrowprops=dict(arrowstyle="-|>", lw=2.5, color=ESCURO, mutation_scale=24, shrinkA=0, shrinkB=0))

    meio = 2.4
    soma, r_soma, r_entrada = np.array([5.5, meio]), 0.95, 0.55
    entradas = [("$x$", "$w$", 3.7, "white", AZUL), ("$1$", "$b$", 1.1, "#e9eef5", CINZA)]
    for nome, peso, y, fundo, borda in entradas:
        centro = np.array([1.6, y])
        bolinha(centro, r_entrada, fundo, borda, nome, ESCURO, 30)
        # a linha sai da borda da bolinha e chega à borda da soma, na direção que liga os centros
        direcao = (soma - centro) / np.linalg.norm(soma - centro)
        seta(centro + r_entrada * direcao, soma - r_soma * direcao)
        # o peso fica a 45% do caminho, afastado da linha na perpendicular, para não encostar nela
        normal = np.array([-direcao[1], direcao[0]])
        pos = centro + 0.45 * (soma - centro) + 0.42 * normal
        ax.text(*pos, peso, ha="center", va="center", fontsize=30, color=AZUL, zorder=5)

    bolinha(soma, r_soma, ESCURO, ESCURO, r"$\Sigma$", "white", 50)
    saida = np.array([10.4, meio])
    bolinha(saida, r_entrada, LARANJA, LARANJA, "$y$", "white", 32)
    seta(soma + [r_soma, 0], saida - [r_entrada, 0])
    # a conta vai em cima da seta da saída: a saída é a soma, sem degrau
    ax.text((soma[0] + r_soma + saida[0] - r_entrada) / 2, meio + 0.35, r"$y = w\,x + b$",
            ha="center", va="bottom", fontsize=28, color=ESCURO)

    # legendas embaixo de cada parte, numa mesma altura
    for x, texto in [(1.6, "entradas"), (soma[0], "soma ponderada"), (saida[0], "saída")]:
        ax.text(x, 0.12, texto, ha="center", fontsize=23, color=SUAVE)
    salva(fig, "neuronio-linear.png")


def pontos():
    """Os 20 pontos, uma reta ainda ruim e o erro de cada ponto, em segmentos verticais.

    A reta é w = 1 e b = 1,5, escolhida longe da melhor para os erros
    aparecerem. O erro do ponto i é yᵢ − tᵢ: a distância, na vertical, entre o
    que a reta prevê e a resposta certa; a perda é a média dos quadrados deles.
    Devolve a perda dessa reta, para o texto do slide.
    """
    x, t = dados()
    w, b = 1.0, 1.5
    fig, ax = plt.subplots(figsize=(7.2, 7.4))
    xs = np.array([0, 2])
    ax.plot(xs, w * xs + b, color=ESCURO, lw=3, zorder=2)
    for xi, ti in zip(x, t):
        ax.plot([xi, xi], [ti, w * xi + b], color=LARANJA, lw=2.2, ls=(0, (4, 2)), zorder=1)
    ax.scatter(x, t, s=130, c=AZUL, edgecolors="white", linewidths=1.2, zorder=3)
    ax.set_xlim(-0.05, 2.05)
    ax.set_ylim(0, 6)
    ax.set_xticks([0, 0.5, 1, 1.5, 2])
    ax.set_xlabel("entrada $x$", fontsize=20)
    ax.set_ylabel("resposta certa $t$", fontsize=20)
    eixos_br(ax)
    L = perda(w, b, x, t)
    alcas = [plt.Line2D([], [], marker="o", ls="", ms=12, color=AZUL, label=r"exemplos $(x_i,\ t_i)$"),
             plt.Line2D([], [], color=ESCURO, lw=3, label=r"a reta $y = x + 1{,}5$"),
             plt.Line2D([], [], color=LARANJA, lw=2.2, ls=(0, (4, 2)), label=r"o erro $y_i - t_i$")]
    # a legenda fica embaixo, fora do gráfico, para não cobrir nenhum ponto
    fig.legend(handles=alcas, loc="lower center", ncol=1, frameon=False, fontsize=18)
    fig.tight_layout(rect=(0, 0.2, 1, 1))
    salva(fig, "dados.png")
    return L


def direcao():
    """A parábola L(w) = (w − 2)² com a tangente em dois pontos e o passo de cada um.

    Em w = 0,5, a inclinação é L′ = −3: descer é andar para a direita, o
    sentido contrário ao da inclinação. Em w = 3,5, L′ = +3: descer é andar
    para a esquerda. Nos dois casos o passo é −η·L′, e as setas mostram o
    passo com η = 0,25, que leva w a 1,25 e a 2,75.
    """
    fig, ax = plt.subplots(figsize=(8.4, 6.6))
    ws = np.linspace(-0.5, 4.5, 300)
    ax.plot(ws, (ws - 2) ** 2, color=ESCURO, lw=3.5, zorder=2)
    eta = 0.25
    for w0, cor in ((0.5, AZUL), (3.5, LARANJA)):
        L0, inclinacao = (w0 - 2) ** 2, 2 * (w0 - 2)
        trecho = np.array([w0 - 0.6, w0 + 0.6])
        ax.plot(trecho, L0 + inclinacao * (trecho - w0), color=cor, lw=3, zorder=3)
        ax.scatter([w0], [L0], s=130, color=cor, zorder=4)
        w1 = w0 - eta * inclinacao
        # o passo, desenhado no chão, na altura zero, para mostrar só o sentido e o tamanho
        ax.annotate("", xy=(w1, -0.9), xytext=(w0, -0.9),
                    arrowprops=dict(arrowstyle="-|>", lw=3, color=cor, mutation_scale=26))
        ax.plot([w0, w0], [-0.9, L0], color=cor, lw=1.2, ls=":", zorder=1)
        # o rótulo fica dentro da tigela, acima do fundo, onde não há curva nem tangente
        lado = "left" if w0 < 2 else "right"
        ax.text(1.05 if w0 < 2 else 2.95, 3.4, f"$L′$ = {'−3' if w0 < 2 else '+3'}", ha=lado, va="center",
                fontsize=22, color=cor)
    ax.scatter([2], [0], s=160, marker="*", color=ESCURO, zorder=4)
    ax.set_xlim(-0.5, 4.5)
    ax.set_ylim(-1.6, 6.2)
    ax.set_xticks([0, 1, 2, 3, 4])
    ax.set_yticks([0, 2, 4, 6])
    ax.set_xlabel("peso $w$", fontsize=20)
    ax.set_ylabel("perda $L(w)$", fontsize=20)
    eixos_br(ax)
    alcas = [plt.Line2D([], [], color=ESCURO, lw=3.5, label=r"$L(w) = (w - 2)^2$"),
             plt.Line2D([], [], marker="*", ls="", ms=16, color=ESCURO, label="o fundo, em $w$ = 2"),
             plt.Line2D([], [], color=ESCURO, lw=3, marker=">", ms=10, label=r"o passo $-\eta\, L′$, com $\eta$ = 0,25")]
    fig.legend(handles=alcas, loc="lower center", ncol=1, frameon=False, fontsize=18)
    fig.tight_layout(rect=(0, 0.22, 1, 1))
    salva(fig, "direcao.png")


def grade_da_perda(ws, bs):
    """A perda em cada ponto de uma grade de (w, b), para as curvas de nível e a superfície."""
    x, t = dados()
    W, B = np.meshgrid(ws, bs)
    L = np.mean((W[..., None] * x + B[..., None] - t) ** 2, axis=-1)
    return W, B, L


def curvas():
    """As curvas de nível da perda e o gradiente em pontos de uma delas.

    Curva de nível é o conjunto dos pontos (w, b) de mesma perda, como as linhas
    de altitude de um mapa. As setas saem de pontos da curva de perda 1,5, uma
    a cada 45 graus em volta do mínimo, e apontam na direção do gradiente, para
    onde a perda mais cresce; todas têm o mesmo tamanho, curto o bastante para
    não chegar à curva seguinte, e cada uma sai da curva em ângulo reto. Os dois
    eixos têm a mesma escala; sem isso, o ângulo reto não apareceria. Nada se
    cruza na figura além do que se pede para ver: a seta saindo da própria curva.
    """
    x, t = dados()
    w_mq, b_mq = minimos_quadrados(x, t)
    ws, bs = np.linspace(-0.5, 4.5, 400), np.linspace(-1.5, 3.5, 400)
    W, B, L = grade_da_perda(ws, bs)
    fig, ax = plt.subplots(figsize=(7.6, 8.4))
    niveis = [0.3, 0.8, 1.5, 4, 8, 14]      # de 1,5 para 4, espaço para a seta caber inteira
    ax.contour(W, B, L, levels=niveis, colors=CINZA, linewidths=1.6, zorder=1)
    ax.contour(W, B, L, levels=[1.5], colors=ESCURO, linewidths=2.4, zorder=2)
    # pontos da curva de perda 1,5: a partir do mínimo, em cada direção, anda-se até a perda valer 1,5
    L_min = perda(w_mq, b_mq, x, t)
    for ang in np.deg2rad(np.arange(0, 360, 45) + 22.5):
        d = np.array([np.cos(ang), np.sin(ang)])
        # a perda cresce como o quadrado da distância ao mínimo: L = Lmin + c·s², com c pela própria perda
        c = perda(w_mq + d[0], b_mq + d[1], x, t) - L_min
        s = np.sqrt((1.5 - L_min) / c)
        w0, b0 = w_mq + s * d[0], b_mq + s * d[1]
        g = np.array(gradiente(w0, b0, x, t))
        g = 0.3 * g / np.linalg.norm(g)
        ax.annotate("", xy=(w0 + g[0], b0 + g[1]), xytext=(w0, b0), zorder=3,
                    arrowprops=dict(arrowstyle="-|>", lw=2.6, color=AZUL, mutation_scale=22, shrinkA=0, shrinkB=0))
    ax.scatter([w_mq], [b_mq], s=420, marker="*", color=ESCURO, zorder=4)
    ax.set_xlim(-0.5, 4.5)
    ax.set_ylim(-1.5, 3.5)
    ax.set_aspect("equal")
    ax.set_xlabel("peso $w$", fontsize=20)
    ax.set_ylabel("viés $b$", fontsize=20)
    eixos_br(ax)
    alcas = [plt.Line2D([], [], color=CINZA, lw=1.6, label="curvas de nível: pontos de mesma perda"),
             plt.Line2D([], [], color=ESCURO, lw=2.4, label="a curva de perda 1,5"),
             plt.Line2D([], [], color=AZUL, lw=2.6, marker=">", ms=10,
                        label="o gradiente, para onde a perda mais cresce"),
             plt.Line2D([], [], marker="*", ls="", ms=18, color=ESCURO, label="a menor perda")]
    fig.legend(handles=alcas, loc="lower center", ncol=1, frameon=False, fontsize=17)
    fig.tight_layout(rect=(0, 0.2, 1, 1))
    salva(fig, "curvas.png")


def limiar():
    """A perda depois de 100 passos contra a taxa: abaixo do limiar converge, acima explode.

    Cada ponto da curva é um treino inteiro, de 100 passos, com uma taxa. A
    perda final cai enquanto a taxa cresce, porque passos maiores chegam mais
    perto do fundo em 100 passos; perto de 0,51 ela dispara. A faixa laranja
    começa no limiar pela hessiana, 2/λ máximo, e é a borda dela que marca o
    limiar, sem linha por cima da curva. É o mapa do projeto de dezembro com
    uma taxa só, em vez de duas.
    """
    x, t = dados()
    taxas = np.arange(0.005, 0.6001, 0.0025)
    finais = np.array([descer(x, t, taxa)[0][-1] for taxa in taxas])
    eta_estrela = limiar_pela_hessiana(x)
    fig, ax = plt.subplots(figsize=(14, 6.4))
    ax.axvspan(eta_estrela, 0.6, color=CLARO_LARANJA, zorder=0)
    ax.semilogy(taxas, finais, color=ESCURO, lw=3, zorder=2)
    ax.set_xlim(0, 0.6)
    ax.set_ylim(0.05, 1e7)
    ax.set_xlabel(r"taxa de aprendizado $\eta$", fontsize=20)
    ax.set_ylabel("perda depois de 100 passos", fontsize=20)
    ax.xaxis.set_major_formatter(VIRGULA)
    ax.yaxis.set_major_formatter(FuncFormatter(
        lambda v, _: f"{v:,.0f}".replace(",", ".") if v >= 1 else f"{v:g}".replace(".", ",")))
    ax.tick_params(labelsize=17)
    alcas = [plt.Line2D([], [], color=ESCURO, lw=3, label="cada ponto: um treino de 100 passos"),
             Patch(facecolor=CLARO_LARANJA, label=rf"o treino diverge: $\eta$ acima de {br(eta_estrela, 3)}")]
    fig.legend(handles=alcas, loc="lower center", ncol=2, frameon=False, fontsize=18, columnspacing=2.4)
    fig.tight_layout(rect=(0, 0.1, 1, 1))
    salva(fig, "limiar.png")


if __name__ == "__main__":
    neuronio_linear()
    L = pontos()
    print(f"perda da reta y = x + 1,5 da figura dos dados: {L:.4f}")
    direcao()
    curvas()
    limiar()
