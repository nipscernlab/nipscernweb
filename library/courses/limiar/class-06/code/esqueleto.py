"""Aula 6, o esqueleto da entrega: um MLP no MNIST, em NumPy.

Este arquivo vai para a turma, junto com mnist.py, que carrega os dados. Antes,
rode uma vez, a partir da raiz do repositório:
    python infra/baixar_dados.py

Faltam três funções, marcadas com A FAZER: softmax, para_a_frente e
retropropagacao. O resto já funciona: os pesos iniciais, a perda, a acurácia, a
conferência do gradiente pela derivada numérica, o laço do treino e o gráfico.
Com as três escritas, rode:
    python aulas/06-mnist-numpy/codigo/esqueleto.py

O programa confere a retropropagação antes de treinar; se a diferença passar de
10⁻⁵, a conta está errada, e o treino nem começa. Depois treina, mostra a
acurácia na validação a cada época, mede o teste uma vez no fim e grava as
curvas em curvas-da-entrega.png, ao lado deste arquivo.

A entrega: a acurácia no teste, com a semente e a versão dos dados que o
programa imprime, e o gráfico das curvas de treino e de validação.

As matrizes seguem a convenção das aulas 3 e 5: X tem um exemplo por linha, N
por 784; W1 tem uma linha por neurônio oculto, largura por 784; W2, 10 por
largura. Uma camada inteira, para o lote todo, é X @ W1.T + b1.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mnist import carrega, versao  # noqa: E402

SEMENTE = 1         # troque, e anote: o resultado vai junto com a semente
TAXA = 0.1          # η, a taxa de aprendizado
LOTE = 64           # exemplos por passo do gradiente
EPOCAS = 10
LARGURA = 64        # neurônios na camada oculta


def sorteia_pesos(largura, semente):
    """Pesos iniciais de uma rede 784, largura, 10, com desvio 1/√n, n as entradas do neurônio."""
    rng = np.random.default_rng(semente)
    return {"W1": rng.normal(0, 1 / np.sqrt(784), (largura, 784)), "b1": np.zeros(largura),
            "W2": rng.normal(0, 1 / np.sqrt(largura), (10, largura)), "b2": np.zeros(10)}


def softmax(Z):
    """A FAZER. Recebe Z, N por 10, e devolve P, N por 10: a softmax de cada linha.

    p_k = e^{z_k} / Σ_j e^{z_j}. Subtraia o maior valor de cada linha antes da
    exponencial: o resultado não muda, e e^{z} não estoura. Ajuda: Z.max(axis=1,
    keepdims=True) e E.sum(axis=1, keepdims=True).
    """
    raise NotImplementedError("escreva a softmax")


def para_a_frente(p, X):
    """A FAZER. Recebe os pesos p e um lote X, N por 784. Devolve (H, P).

    H = tanh(X W1ᵀ + b1), N por largura; P = softmax(H W2ᵀ + b2), N por 10.
    """
    raise NotImplementedError("escreva a passada para a frente")


def perda(P, t):
    """A entropia cruzada média: −ln da probabilidade que a rede deu ao dígito certo."""
    return float(-np.mean(np.log(P[np.arange(len(t)), t] + 1e-12)))


def retropropagacao(p, X, t):
    """A FAZER. Devolve um dicionário com o gradiente da perda média em relação a W1, b1, W2 e b2.

    O δ da saída é (P − Y)/N, com Y o rótulo certo escrito como 1 na posição do
    dígito e 0 nas outras, e N o tamanho do lote. O δ da camada oculta é
    (δ da saída @ W2) vezes 1 − H², elemento a elemento. Cada gradiente de peso é
    δᵀ vezes a entrada da camada; o de cada viés, a soma do δ sobre o lote.
    Cada gradiente tem o mesmo formato do peso a que se refere.
    """
    raise NotImplementedError("escreva a retropropagação")


def acuracia(P, t):
    """A fração de acertos: a maior probabilidade tem de ser a do dígito certo."""
    return float(np.mean(P.argmax(axis=1) == t))


def confere_gradiente(X, t, quantos=30, h=1e-5):
    """Compara a sua retropropagação com a derivada numérica, em pesos sorteados.

    Devolve a maior diferença relativa entre as duas contas, que tem de ficar
    perto de 10⁻⁷ ou menor.
    """
    p = sorteia_pesos(16, 3)
    g = retropropagacao(p, X, t)
    rng = np.random.default_rng(3)
    pior = 0.0
    for _ in range(quantos):
        nome = rng.choice(list(p))
        idx = tuple(rng.integers(0, s) for s in p[nome].shape)
        guardado = p[nome][idx]
        p[nome][idx] = guardado + h
        mais = perda(para_a_frente(p, X)[1], t)
        p[nome][idx] = guardado - h
        menos = perda(para_a_frente(p, X)[1], t)
        p[nome][idx] = guardado
        numerica = (mais - menos) / (2 * h)
        pior = max(pior, abs(numerica - g[nome][idx]) / max(1e-8, abs(numerica) + abs(g[nome][idx])))
    return pior


def treina(treino, validacao):
    """O laço do treino: lotes embaralhados a cada época, um passo do gradiente por lote.

    Devolve (historico, melhores_pesos, melhor_epoca), com a melhor época escolhida
    pela acurácia na validação.
    """
    X, t = treino
    p = sorteia_pesos(LARGURA, SEMENTE)
    rng = np.random.default_rng(SEMENTE + 1000)
    historico = {"perda_treino": [], "perda_validacao": [], "acuracia_validacao": []}
    melhor, melhor_epoca = None, 0
    for epoca in range(1, EPOCAS + 1):
        ordem = rng.permutation(len(X))
        for inicio in range(0, len(X), LOTE):
            i = ordem[inicio:inicio + LOTE]
            g = retropropagacao(p, X[i], t[i])
            for nome in p:
                p[nome] -= TAXA * g[nome]
        historico["perda_treino"].append(perda(para_a_frente(p, X)[1], t))
        _, P = para_a_frente(p, validacao[0])
        historico["perda_validacao"].append(perda(P, validacao[1]))
        historico["acuracia_validacao"].append(acuracia(P, validacao[1]))
        print(f"época {epoca:>2}: perda no treino {historico['perda_treino'][-1]:.4f}, "
              f"na validação {historico['perda_validacao'][-1]:.4f}; "
              f"acurácia na validação {100 * historico['acuracia_validacao'][-1]:.2f}%")
        if melhor is None or historico["acuracia_validacao"][-1] > max(historico["acuracia_validacao"][:-1]):
            melhor, melhor_epoca = {k: v.copy() for k, v in p.items()}, epoca
    return historico, melhor, melhor_epoca


def desenha(historico, arquivo):
    """As curvas da perda no treino e na validação, época a época, num png."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    epocas = range(1, len(historico["perda_treino"]) + 1)
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.plot(epocas, historico["perda_treino"], "o-", label="treino")
    ax.plot(epocas, historico["perda_validacao"], "s--", label="validação")
    ax.set_xlabel("época")
    ax.set_ylabel("perda, entropia cruzada")
    ax.legend()
    fig.tight_layout()
    fig.savefig(arquivo, dpi=150)
    print(f"gráfico gravado em {arquivo}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    conjuntos = carrega()
    print(f"semente {SEMENTE}, versão dos dados {versao()}, largura {LARGURA}, taxa {TAXA}, lote {LOTE}")
    dif = confere_gradiente(conjuntos["treino"][0][:20], conjuntos["treino"][1][:20])
    print(f"retropropagação contra a derivada numérica: maior diferença relativa {dif:.1e}")
    if dif > 1e-5:
        sys.exit("a retropropagação não confere com a derivada numérica: corrija antes de treinar")
    historico, pesos, epoca = treina(conjuntos["treino"], conjuntos["validacao"])
    _, P = para_a_frente(pesos, conjuntos["teste"][0])
    print(f"melhor época na validação: {epoca}")
    print(f"teste, medido uma vez: acurácia {100 * acuracia(P, conjuntos['teste'][1]):.2f}%")
    desenha(historico, Path(__file__).resolve().parent / "curvas-da-entrega.png")
