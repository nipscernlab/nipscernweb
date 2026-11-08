"""A rede 2-2-1 desenhada em bolinhas ligadas por setas, para as figuras das aulas 3 e 5.

Não roda sozinho: é importado por aulas/03-camadas/codigo/figuras_slides.py e por
aulas/05-retropropagacao/codigo/figuras_slides.py, para as duas aulas desenharem a
mesma rede, com as mesmas posições, cores e tamanhos. É o desenho clássico do
neurônio da aula 1, com duas entradas, dois neurônios ocultos e uma saída.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# O que vem entre cifrões, como $x_1$, sai como fórmula, na fonte STIX, que tem o
# mesmo desenho da STIX Two das equações dos slides (infra/equacoes.py).
plt.rcParams["mathtext.fontset"] = "stix"

AZUL, VERMELHO, LARANJA, ESCURO = "#1f5fad", "#c0392b", "#a8500f", "#14213d"
REGIAO, CINZA, SUAVE, FUNDO = "#cfe3f5", "#8a94a6", "#5e6a7d", "#F6F5F1"


def br(v):
    """Número com vírgula decimal e o menos tipográfico, para os rótulos: −0,5."""
    return f"{v:g}".replace(".", ",").replace("-", "−")


# Onde fica cada bolinha, nas coordenadas do desenho, de 0 a 16 na horizontal e
# de 0 a 8 na vertical. Tudo é simétrico em torno da linha do meio, 4,2: as
# entradas e os neurônios ocultos ficam 1,8 acima e 1,8 abaixo dela.
MEIO = 4.2
POS = {"x1": (1.5, MEIO + 1.8), "x2": (1.5, MEIO - 1.8), "h1": (7.0, MEIO + 1.8), "h2": (7.0, MEIO - 1.8),
       "y": (12.5, MEIO)}
R = 0.62                                   # o raio das bolinhas


def desenha_rede(ax, pesos, nomes, extras=None, tamanho=30):
    """A rede 2-2-1 na representação clássica: bolinhas ligadas por setas.

    pesos: o texto de cada parâmetro, um dicionário com as chaves w11, w12,
      w21, w22, b1, b2, v1, v2 e c, como "$w_{11}$" ou "1";
    nomes: o texto dentro de cada bolinha, com as chaves de POS;
    extras: textos soltos, uma lista de (x, y, texto, cor, tamanho).
    O viés de cada neurônio entra por uma seta curta, de fora da rede: por cima
    no neurônio de cima, por baixo nos outros, para não cruzar nenhuma linha.
    É o peso da entrada que vale sempre 1, o desenho da aula 1, sem a bolinha
    do 1, que aqui encheria o desenho. O peso wₖⱼ liga a entrada j ao neurônio
    k: linha k, coluna j da matriz W.
    """
    ax.set_xlim(0, 16)
    ax.set_ylim(-0.9, 8.4)
    ax.set_aspect("equal")
    ax.axis("off")

    def seta(de, para, cor=ESCURO, lw=2.5):
        ax.annotate("", xy=para, xytext=de, zorder=2,
                    arrowprops=dict(arrowstyle="-|>", lw=lw, color=cor, mutation_scale=24, shrinkA=0, shrinkB=0))

    def liga(a, b):
        """Seta da borda da bolinha a até a borda da bolinha b, na direção que liga os centros."""
        pa, pb = np.array(POS[a]), np.array(POS[b])
        d = (pb - pa) / np.linalg.norm(pb - pa)
        seta(pa + R * d, pb - R * d)

    for a, b in (("x1", "h1"), ("x1", "h2"), ("x2", "h1"), ("x2", "h2"), ("h1", "y"), ("h2", "y")):
        liga(a, b)
    # as bolinhas: entradas brancas de borda azul, neurônios ocultos escuros, saída laranja, como na aula 1
    estilo = {"x1": ("white", AZUL, ESCURO), "x2": ("white", AZUL, ESCURO), "h1": (ESCURO, ESCURO, "white"),
              "h2": (ESCURO, ESCURO, "white"), "y": (LARANJA, LARANJA, "white")}
    for chave, (fundo, borda, cor_texto) in estilo.items():
        ax.add_patch(plt.Circle(POS[chave], R, facecolor=fundo, edgecolor=borda, lw=3, zorder=3))
        ax.text(*POS[chave], nomes[chave], ha="center", va="center", fontsize=tamanho + 2, color=cor_texto, zorder=4)

    # o viés: seta curta de fora para dentro de cada neurônio, com o valor na ponta de fora
    for chave, lado, nome in (("h1", +1, "b1"), ("h2", -1, "b2"), ("y", -1, "c")):
        cx, cy = POS[chave]
        inicio = (cx, cy + lado * (R + 1.0))
        seta(inicio, (cx, cy + lado * R))
        ax.text(cx, cy + lado * (R + 1.0 + 0.32), pesos[nome], ha="center", va="center", fontsize=tamanho,
                color=AZUL)

    def junto_da_linha(a, b, fracao, lado, distancia):
        """O ponto a `fracao` do caminho de a até b, afastado `distancia` da linha na perpendicular.

        lado = +1 afasta para a esquerda de quem anda de a para b; −1, para a
        direita. Assim cada peso fica perto da própria linha e longe das outras.
        """
        pa, pb = np.array(POS[a]), np.array(POS[b])
        d = (pb - pa) / np.linalg.norm(pb - pa)
        normal = np.array([-d[1], d[0]])
        return pa + fracao * (pb - pa) + lado * distancia * normal

    # os pesos das linhas: os horizontais por fora, os diagonais no vão entre as
    # duas entradas, perto da entrada de onde saem, e os da saída por fora das linhas
    for texto, ponto in ((pesos["w11"], junto_da_linha("x1", "h1", 0.3, +1, 0.45)),
                         (pesos["w22"], junto_da_linha("x2", "h2", 0.3, -1, 0.45)),
                         (pesos["w21"], junto_da_linha("x1", "h2", 0.17, -1, 0.55)),
                         (pesos["w12"], junto_da_linha("x2", "h1", 0.17, +1, 0.55)),
                         (pesos["v1"], junto_da_linha("h1", "y", 0.5, +1, 0.5)),
                         (pesos["v2"], junto_da_linha("h2", "y", 0.5, -1, 0.5))):
        ax.text(*ponto, texto, ha="center", va="center", fontsize=tamanho, color=AZUL, zorder=5)
    for x, y, texto, cor, tam in (extras or []):
        ax.text(x, y, texto, ha="center", va="center", fontsize=tam, color=cor, zorder=5)


def legendas_das_camadas(ax):
    """Os nomes das três colunas, embaixo, numa mesma altura."""
    for x, texto in ((POS["x1"][0], "entradas"), (POS["h1"][0], "camada oculta"), (POS["y"][0], "camada de saída")):
        ax.text(x, -0.6, texto, ha="center", fontsize=24, color=SUAVE)
