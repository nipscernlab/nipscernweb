"""Figuras dos slides da aula 6: o MNIST em NumPy.

Rode, a partir da raiz do repositório, depois de mlp.py, que grava os números:
    python aulas/06-mnist-numpy/codigo/figuras_slides.py

Gera, a 200 dpi, em aulas/06-mnist-numpy/figuras/:
    digito-medio.png o dígito médio de cada classe, a imagem da capa
    digitos.png      quatro exemplos de cada dígito, do conjunto de treino
    rede.png         a rede 784, 256, 10, em bolinhas
    saida.png        dois dígitos do teste e as dez probabilidades que a rede dá a cada um
    larguras.png     a acurácia na validação, época a época, para as três larguras
    curvas.png       a perda e a acurácia no treino e na validação da rede escolhida
    sobreajuste.png  a mesma rede treinada com só mil exemplos: o treino decora
    erros.png        os primeiros dígitos do teste que a rede erra
    confusao.png     a matriz de confusão do teste: o dígito certo contra o que a rede respondeu
    pesos.png        os pesos de 16 neurônios ocultos, cada um como uma imagem 28 por 28

Os números vêm de resultados/mlp.json, gravado por mlp.py; as imagens, de mnist.py.
Nada aqui treina rede.
"""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.ticker import FuncFormatter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mnist import carrega  # noqa: E402

plt.rcParams["mathtext.fontset"] = "stix"
plt.rcParams["hatch.color"] = "white"     # a hachura em branco, sobre a barra laranja
plt.rcParams["hatch.linewidth"] = 2.0

AULA = Path(__file__).resolve().parents[1]
AZUL, LARANJA, ESCURO, CINZA, TEXTO = "#1f5fad", "#a8500f", "#14213d", "#8a94a6", "#3b4658"
VIRGULA = FuncFormatter(lambda v, _: f"{v:g}".replace(".", ",").replace("-", "−"))
PORCENTO = FuncFormatter(lambda v, _: f"{100 * v:g}%".replace(".", ","))
# os dois exemplos do teste que a figura da saída e o vídeo mostram: o 7 do
# índice 0, em que a rede tem certeza, e o 8 do índice 61, em que ela hesita
EXEMPLOS = (0, 61)


def salva(fig, nome, fundo="white"):
    """Salva a 200 dpi, recortada em volta do que foi desenhado."""
    saida = AULA / "figuras" / nome
    saida.parent.mkdir(exist_ok=True)
    fig.savefig(saida, dpi=200, bbox_inches="tight", pad_inches=0.2, facecolor=fundo)
    plt.close(fig)
    print(f"salva: {saida}")


def digito_medio(conjuntos):
    """A imagem da capa: o dígito médio de cada classe, de 0 a 9, em duas linhas de cinco.

    Cada quadro é a média, pixel a pixel, de todos os exemplos de treino daquele
    dígito, uns 5 mil por classe. Onde quase todos passam o traço, como na haste
    do 1, a média fica escura; onde cada um escreve de um jeito, ela se espalha
    clara. As cores vão do fundo dos slides, #F6F5F1, ao azul-escuro dos títulos,
    e a figura sai com o fundo dos slides, para não fazer um retângulo branco na
    capa. Os pixels ficam quadrados, sem suavizar, como a rede os vê.
    """
    X, t = conjuntos["treino"]
    papel = "#F6F5F1"
    tinta = LinearSegmentedColormap.from_list("papel-tinta", [papel, ESCURO])
    fig, eixos = plt.subplots(2, 5, figsize=(10, 4.2), facecolor=papel)
    for d, ax in enumerate(eixos.flat):
        media = X[t == d].mean(axis=0).reshape(28, 28)
        ax.imshow(media, cmap=tinta, vmin=0, vmax=media.max(), interpolation="nearest")
        ax.axis("off")
    fig.subplots_adjust(wspace=0.04, hspace=0.04)
    salva(fig, "digito-medio.png", fundo=papel)


def decimal(v):
    """Probabilidade com três casas e vírgula; perto de 1, com quatro, para 0,9998 não virar 1,000."""
    return (f"{v:.3f}" if v < 0.9995 else f"{v:.4f}").replace(".", ",")


def imagem(ax, x):
    """Um dígito de 784 números desenhado como a imagem de 28 por 28: 0 branco, 1 preto."""
    ax.imshow(x.reshape(28, 28), cmap="gray_r", vmin=0, vmax=1, interpolation="nearest")
    ax.set_xticks([])
    ax.set_yticks([])
    for borda in ax.spines.values():
        borda.set_color(CINZA)


def digitos(conjuntos):
    """Quatro exemplos de cada dígito, de 0 a 9, os primeiros do conjunto de treino."""
    X, t = conjuntos["treino"]
    fig, eixos = plt.subplots(4, 10, figsize=(10, 4.4))
    for d in range(10):
        indices = np.flatnonzero(t == d)[:4]
        for linha, i in enumerate(indices):
            imagem(eixos[linha, d], X[i])
        eixos[0, d].set_title(str(d), fontsize=20, color=ESCURO, pad=8)
    fig.subplots_adjust(wspace=0.08, hspace=0.08)
    salva(fig, "digitos.png")


def rede(largura):
    """A rede em bolinhas: 784 entradas, `largura` neurônios ocultos e 10 saídas.

    Só alguns neurônios de cada camada aparecem desenhados, com reticências no
    meio; as saídas são as dez, com o dígito de cada uma. As ligações, todas com
    todas entre camadas vizinhas, vão em cinza claro, atrás das bolinhas.
    """
    fig, ax = plt.subplots(figsize=(10, 6.2))
    colunas = {"entrada": (0.0, [3.6, 2.8, 2.0, 1.2, -1.2, -2.0, -2.8, -3.6]),
               "oculta": (4.4, [3.0, 2.2, 1.4, -1.4, -2.2, -3.0]),
               "saida": (8.8, list(np.linspace(3.6, -3.6, 10)))}
    raio = 0.3
    for (xa, ya), (xb, yb) in ((colunas["entrada"], colunas["oculta"]), (colunas["oculta"], colunas["saida"])):
        for y1 in ya:
            for y2 in yb:
                ax.plot([xa, xb], [y1, y2], color="#d5d9e0", lw=0.8, zorder=0)
    for nome, (x, ys) in colunas.items():
        for k, y in enumerate(ys):
            ax.add_patch(plt.Circle((x, y), raio, facecolor="white", edgecolor=ESCURO, lw=2, zorder=2))
            if nome == "saida":
                ax.text(x, y, str(k), ha="center", va="center", fontsize=15, color=ESCURO, zorder=3)
        if nome != "saida":
            ax.text(x, 0, "⋮", ha="center", va="center", fontsize=30, color=ESCURO)
    rotulos = (("784 pixels", "entrada"), (f"{largura} neurônios\ncom a tanh", "oculta"),
               ("10 saídas\ncom a softmax", "saida"))
    for texto, nome in rotulos:
        ax.text(colunas[nome][0], -4.35, texto, ha="center", va="top", fontsize=17, color=TEXTO, linespacing=1.3)
    ax.set_xlim(-1.4, 10.4)
    ax.set_ylim(-5.9, 4.1)
    ax.set_aspect("equal")
    ax.axis("off")
    salva(fig, "rede.png")


def saida(conjuntos, resultado):
    """Dois dígitos do teste, à esquerda, e as dez probabilidades da rede, à direita.

    A barra mais alta, a resposta da rede, vai em azul, com o valor escrito em
    cima; as outras, em cinza. No 8 em que a rede hesita, a segunda barra também
    leva o valor, em laranja, com hachura, para a figura valer em preto e branco.
    """
    X, t = conjuntos["teste"]
    P = np.array(resultado["escolha"]["probabilidades_teste_200"])
    fig, eixos = plt.subplots(2, 2, figsize=(10, 6.6), gridspec_kw={"width_ratios": [1, 2.6]})
    for linha, i in enumerate(EXEMPLOS):
        imagem(eixos[linha, 0], X[i])
        eixos[linha, 0].set_title(f"o dígito certo: {t[i]}", fontsize=16, color=ESCURO, pad=8)
        ax = eixos[linha, 1]
        ordem = np.argsort(P[i])[::-1]
        cores = [CINZA] * 10
        cores[ordem[0]] = AZUL
        barras = ax.bar(range(10), P[i], color=cores, width=0.7)
        ax.text(ordem[0], P[i][ordem[0]] + 0.04, decimal(P[i][ordem[0]]), ha="center",
                va="bottom", fontsize=15, color=AZUL)
        if P[i][ordem[1]] > 0.1:
            barras[ordem[1]].set_facecolor(LARANJA)
            barras[ordem[1]].set_hatch("//")
            ax.text(ordem[1], P[i][ordem[1]] + 0.04, decimal(P[i][ordem[1]]), ha="center",
                    va="bottom", fontsize=15, color=LARANJA)
        ax.set_ylim(0, 1.22)
        ax.set_yticks([0, 0.5, 1])
        ax.yaxis.set_major_formatter(VIRGULA)
        ax.set_xticks(range(10))
        ax.tick_params(labelsize=15)
        ax.set_ylabel("probabilidade", fontsize=15)
        for lado in ("top", "right"):
            ax.spines[lado].set_visible(False)
    eixos[1, 1].set_xlabel("dígito", fontsize=15)
    fig.tight_layout(h_pad=2.2, w_pad=2.5)
    salva(fig, "saida.png")


def larguras(resultado):
    """A acurácia na validação, época a época, para as três larguras: cor, traço e marcador diferentes."""
    fig, ax = plt.subplots(figsize=(8.4, 5.2))
    estilos = {"16": (CINZA, "o", (0, (2, 2))), "64": (LARANJA, "s", (0, (6, 3))), "256": (AZUL, "D", "-")}
    for largura, (cor, marcador, traco) in estilos.items():
        h = resultado["redes"][largura]["historico"]["acuracia_validacao"]
        ax.plot(range(1, len(h) + 1), h, color=cor, marker=marcador, ms=7, ls=traco, lw=2.4,
                label=f"{largura} neurônios")
    ax.set_xlim(0.5, 20.5)
    ax.set_xticks([1, 5, 10, 15, 20])
    ax.set_ylim(0.888, 0.98)
    ax.set_yticks([0.90, 0.92, 0.94, 0.96, 0.98])
    ax.yaxis.set_major_formatter(PORCENTO)
    ax.tick_params(labelsize=17)
    ax.set_xlabel("época", fontsize=18)
    ax.set_ylabel("acurácia na validação", fontsize=18)
    ax.grid(axis="y", color="#e3e6eb", lw=1)
    fig.legend(loc="lower center", ncol=3, frameon=False, fontsize=17, columnspacing=1.6)
    fig.tight_layout(rect=(0, 0.1, 1, 1))
    salva(fig, "larguras.png")


def par_de_paineis(historico, nome, marca=None, teto=None):
    """Perda à esquerda e acurácia à direita, treino em azul cheio e validação em laranja tracejado.

    marca: uma época para marcar com uma linha vertical cinza, a da menor perda
    na validação; teto: o limite de cima do eixo da perda, que começa em zero.
    """
    epocas = np.arange(1, len(historico["perda_treino"]) + 1)
    muitas = len(epocas) > 40
    fig, eixos = plt.subplots(1, 2, figsize=(11, 4.6))
    for ax, chave, rotulo in ((eixos[0], "perda", "perda, entropia cruzada"), (eixos[1], "acuracia", "acurácia")):
        ax.set_box_aspect(0.75)
        ax.plot(epocas, historico[f"{chave}_treino"], color=AZUL, lw=2.6,
                marker=None if muitas else "o", ms=6)
        ax.plot(epocas, historico[f"{chave}_validacao"], color=LARANJA, lw=2.6, ls=(0, (6, 3)),
                marker=None if muitas else "s", ms=6)
        if marca:
            ax.axvline(marca, color=CINZA, lw=1.6, ls=(0, (2, 2)), zorder=0)
        ax.set_xlabel("época", fontsize=18)
        ax.set_ylabel(rotulo, fontsize=18)
        ax.tick_params(labelsize=16)
    if teto:
        eixos[0].set_ylim(0, teto)
    eixos[0].yaxis.set_major_formatter(VIRGULA)
    eixos[1].yaxis.set_major_formatter(PORCENTO)
    for ax in eixos:
        ax.xaxis.set_major_formatter(VIRGULA)
    alcas = [plt.Line2D([], [], color=AZUL, lw=2.6, marker=None if muitas else "o", label="treino"),
             plt.Line2D([], [], color=LARANJA, lw=2.6, ls=(0, (6, 3)), marker=None if muitas else "s",
                        label="validação")]
    if marca:
        alcas.append(plt.Line2D([], [], color=CINZA, lw=1.6, ls=(0, (2, 2)),
                                label=f"menor perda na validação, época {marca}"))
    fig.legend(handles=alcas, loc="lower center", ncol=len(alcas), frameon=False, fontsize=17, columnspacing=1.8)
    fig.tight_layout(rect=(0, 0.11, 1, 1), w_pad=3)
    salva(fig, nome)


def erros(conjuntos, resultado, quantos=16):
    """Os primeiros `quantos` dígitos do teste que a rede erra, com a resposta certa e a da rede."""
    X, t = conjuntos["teste"]
    previsto = np.array(resultado["escolha"]["previsto_teste"])
    errados = np.flatnonzero(previsto != t)[:quantos]
    fig, eixos = plt.subplots(2, quantos // 2, figsize=(12, 4.2))
    for ax, i in zip(eixos.flat, errados):
        imagem(ax, X[i])
        ax.set_xlabel(f"certo {t[i]}\nrede {previsto[i]}", fontsize=15, color=ESCURO, linespacing=1.25)
    fig.subplots_adjust(wspace=0.15, hspace=0.55)
    salva(fig, "erros.png")


def confusao(conjuntos, resultado):
    """A matriz de confusão do teste: em cada casa, quantos dígitos de uma classe a rede deu como outra.

    Linha: o dígito certo; coluna: o que a rede respondeu. A diagonal são os
    acertos, cerca de mil por dígito, e fica em cinza-escuro com o número em
    branco; fora dela, os erros, com a cor mais forte onde há mais. Os números
    estão todos escritos, para a figura se ler sem a cor. Devolve a matriz e os
    três pares mais confundidos.
    """
    _, t = conjuntos["teste"]
    previsto = np.array(resultado["escolha"]["previsto_teste"])
    C = np.zeros((10, 10), dtype=int)
    np.add.at(C, (t, previsto), 1)
    fora = C.copy()
    np.fill_diagonal(fora, 0)
    mapa = LinearSegmentedColormap.from_list("erros", ["#ffffff", LARANJA])
    fig, ax = plt.subplots(figsize=(8.2, 7.4))
    ax.imshow(fora, cmap=mapa, vmin=0, vmax=max(fora.max(), 1))
    for i in range(10):
        for j in range(10):
            if i == j:
                ax.add_patch(plt.Rectangle((j - 0.5, i - 0.5), 1, 1, color="#4a5568"))
                ax.text(j, i, f"{C[i, j]:,}".replace(",", "."), ha="center", va="center", fontsize=12 if C[i, j] >= 1000 else 14, color="white",
                        fontweight="bold")
            elif C[i, j]:
                ax.text(j, i, str(C[i, j]), ha="center", va="center", fontsize=16,
                        color="white" if C[i, j] > 0.6 * fora.max() else ESCURO)
    ax.set_xticks(range(10))
    ax.set_yticks(range(10))
    ax.tick_params(labelsize=18, length=0)
    ax.set_xlabel("o que a rede respondeu", fontsize=19)
    ax.set_ylabel("o dígito certo", fontsize=19)
    ax.xaxis.set_label_position("top")
    ax.xaxis.tick_top()
    for lado in ax.spines.values():
        lado.set_visible(False)
    salva(fig, "confusao.png")
    pares = sorted(((fora[i, j], i, j) for i in range(10) for j in range(10)), reverse=True)[:3]
    return C, pares


def pesos(resultado, quantos=16):
    """Os pesos de 16 neurônios ocultos, cada um desenhado como uma imagem 28 por 28.

    Cada neurônio oculto tem um peso por pixel; arrumados na forma da imagem,
    mostram o que o neurônio procura. Laranja é peso positivo: tinta ali aumenta
    a soma; azul é negativo: tinta ali diminui. A escala é a mesma nos 16, de
    menos a mais o maior valor absoluto, com o branco no zero, e a barra embaixo diz
    o valor de cada tom.
    """
    W = np.array(resultado["escolha"]["pesos_16"])[:quantos]
    limite = np.abs(W).max()
    mapa = LinearSegmentedColormap.from_list("pesos", [AZUL, "#ffffff", LARANJA])
    fig, eixos = plt.subplots(2, 8, figsize=(13, 4.4))
    for k, ax in enumerate(eixos.flat):
        im = ax.imshow(W[k].reshape(28, 28), cmap=mapa, vmin=-limite, vmax=limite)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_title(f"neurônio {k + 1}", fontsize=13, color=ESCURO)
        for lado in ax.spines.values():
            lado.set_color(CINZA)
    barra = fig.colorbar(im, ax=list(eixos.flat), orientation="horizontal", fraction=0.05, pad=0.06, aspect=60)
    barra.ax.xaxis.set_major_formatter(VIRGULA)
    barra.ax.tick_params(labelsize=13)
    barra.set_label("o peso de cada pixel: azul, negativo; laranja, positivo", fontsize=15)
    salva(fig, "pesos.png")
    return limite


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    conjuntos = carrega()
    resultado = json.loads((AULA / "resultados" / "mlp.json").read_text(encoding="utf-8"))
    escolhida = resultado["escolha"]["largura"]
    digito_medio(conjuntos)
    digitos(conjuntos)
    rede(escolhida)
    saida(conjuntos, resultado)
    larguras(resultado)
    par_de_paineis(resultado["redes"][str(escolhida)]["historico"], "curvas.png")
    poucos = resultado["poucos"]
    par_de_paineis(poucos["historico"], "sobreajuste.png", marca=poucos["epoca_menor_perda_validacao"], teto=1.3)
    erros(conjuntos, resultado)
    C, pares = confusao(conjuntos, resultado)
    print("os pares mais confundidos (quantos, certo, rede):", [(int(n), int(i), int(j)) for n, i, j in pares])
    print(f"o maior peso, em valor absoluto, dos 16 neurônios: {pesos(resultado):.3f}")
