"""Aula 1: o perceptron de Rosenblatt aprende E e OU, e não consegue o XOR.

Rode, a partir da raiz do repositório:
    python aulas/01-neuronio/codigo/perceptron.py

Os pesos começam em zero, então não há sorteio: o resultado é sempre o mesmo, e
dá para refazer a tabela à mão, no quadro.
"""
from pathlib import Path

import numpy as np

# As quatro combinações possíveis de duas entradas lógicas, uma por linha
X = np.array([[0, 0],
              [0, 1],
              [1, 0],
              [1, 1]])

# A resposta certa para cada linha de X, calculada com os operadores lógicos do
# Python: & é o E, | é o OU e ^ é o XOR. Eles agem bit a bit sobre inteiros e,
# com 0 e 1, dão exatamente as tabelas-verdade; com arrays do NumPy, a conta
# vale elemento a elemento. Cuidado: em Python, ^ não é potência; potência é **.
x1, x2 = X[:, 0], X[:, 1]            # a primeira e a segunda coluna de X
ALVOS = {
    "E":   x1 & x2,   # [0 0 0 1]: 1 só quando as duas entradas são 1
    "OU":  x1 | x2,   # [0 1 1 1]: 1 quando pelo menos uma entrada é 1
    "XOR": x1 ^ x2,   # [0 1 1 0]: 1 quando só uma das entradas é 1
}


def degrau(z):
    """Função degrau: 1 se z >= 0, senão 0. É o disparo do neurônio."""
    return int(z >= 0)


def neuronio(x, w, b):
    """Soma cada entrada multiplicada pelo seu peso, soma o viés e passa pelo degrau."""
    return degrau(x @ w + b)


def treinar(X, alvo, taxa=1, epocas=20):
    """Regra do perceptron. A cada exemplo errado, corrige pesos e viés:
        w = w + taxa * (alvo - saida) * x
        b = b + taxa * (alvo - saida)
    A taxa é a taxa de aprendizado, a letra grega η (eta) dos slides.
    Se a saída foi 0 e devia ser 1, os pesos crescem na direção de x; se foi 1 e
    devia ser 0, diminuem. Uma época é uma passada por todos os exemplos.
    """
    w = np.zeros(2)
    b = 0.0
    for epoca in range(1, epocas + 1):
        erros = 0
        for x, t in zip(X, alvo):
            y = neuronio(x, w, b)
            if y != t:
                w = w + taxa * (t - y) * x
                b = b + taxa * (t - y)
                erros += 1
        print(f"  época {epoca:2d}: {erros} erro(s); depois dela, w = {w}, b = {b:+.0f}")
        if erros == 0:
            return w, b, epoca
    return w, b, None


def desenhar(resultados, caminho):
    """Os quatro pontos de cada função e a reta que o perceptron aprendeu.

    O neurônio dispara na região azul, onde w1*x1 + w2*x2 + b >= 0, e não dispara
    fora dela. Aprender é mover a reta w1*x1 + w2*x2 + b = 0 até ela separar os
    pontos. Um ponto em cima da reta tem soma 0, e o degrau dá 1: ele dispara.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import FuncFormatter
    # o que vem entre cifrões, como $x_1$, sai como fórmula, com o índice embaixo,
    # na fonte STIX, que vem com o matplotlib e é a mesma das equações dos slides
    plt.rcParams["mathtext.fontset"] = "stix"
    virgula = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))
    fig, eixos = plt.subplots(1, 3, figsize=(15, 6))
    xs = np.linspace(-0.5, 1.5, 2)
    g1, g2 = np.meshgrid(np.linspace(-0.5, 1.5, 201), np.linspace(-0.5, 1.5, 201))
    for ax, (nome, (w, b, epoca)) in zip(eixos, resultados.items()):
        alvo = ALVOS[nome]
        if epoca is not None and w[1] != 0:
            dispara = (w[0] * g1 + w[1] * g2 + b >= 0)
            ax.contourf(g1, g2, dispara, levels=[0.5, 1.5], colors=["#cfe3f5"])
            ax.plot(xs, -(w[0] * xs + b) / w[1], "k-")
            ax.set_title(f"{nome}: separou na época {epoca}")
        else:
            ax.set_title(f"{nome}: nenhuma reta separa")
        ax.scatter(X[alvo == 1, 0], X[alvo == 1, 1], s=360, c="#1f5fad", label="alvo 1", zorder=3)
        ax.scatter(X[alvo == 0, 0], X[alvo == 0, 1], s=360, c="#c0392b", marker="s", label="alvo 0", zorder=3)
        ax.set_xlim(-0.5, 1.5)
        ax.set_ylim(-0.5, 1.5)
        ax.set_xticks([0, 0.5, 1])
        ax.set_yticks([0, 0.5, 1])
        ax.xaxis.set_major_formatter(virgula)
        ax.yaxis.set_major_formatter(virgula)
        ax.set_xlabel("entrada $x_1$", fontsize=18)
        ax.set_ylabel("entrada $x_2$", fontsize=18)
        ax.tick_params(labelsize=15)
        ax.title.set_fontsize(18)
        ax.set_aspect("equal")
    # a legenda fica embaixo, fora dos gráficos, para não cobrir nenhum ponto
    from matplotlib.patches import Patch
    alcas, _ = eixos[0].get_legend_handles_labels()
    alcas.append(Patch(color="#cfe3f5", label="região onde o neurônio dispara"))
    fig.legend(handles=alcas, loc="lower center", ncol=3, frameon=False, fontsize=17)
    fig.tight_layout(rect=(0, 0.1, 1, 1))
    fig.savefig(caminho, dpi=200)


if __name__ == "__main__":
    resultados = {}
    for nome, alvo in ALVOS.items():
        print(f"\n{nome}")
        w, b, epoca = treinar(X, alvo)
        resultados[nome] = (w, b, epoca)
        if epoca is None:
            print(f"  depois de 20 épocas ainda erra: nenhuma reta separa os pontos de {nome}")
    figura = Path(__file__).resolve().parent.parent / "figuras" / "perceptron.png"
    figura.parent.mkdir(exist_ok=True)
    desenhar(resultados, figura)
    print(f"\nfigura salva em {figura}")
