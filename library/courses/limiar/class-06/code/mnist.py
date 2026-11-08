"""Os dados do MNIST, prontos para a rede: leitura, versão e divisão em treino e validação.

Este arquivo vai para a turma junto com o esqueleto: ele só carrega os dados.
Antes, rode uma vez, a partir da raiz do repositório:
    python infra/baixar_dados.py
que baixa os quatro arquivos do MNIST para dados/ e confere cada um.

Rodado sozinho, mostra o que foi carregado:
    python aulas/06-mnist-numpy/codigo/mnist.py

O MNIST tem 70 mil dígitos escritos à mão, cada um numa imagem de 28 por 28
pixels em tons de cinza: 60 mil vêm marcados para treino e 10 mil para teste. A
validação sai do treino: 10 mil dos 60 mil, sorteados com uma semente fixa, ficam
de lado para escolher o tamanho da rede e a hora de parar. Sobram 50 mil para
ajustar os pesos. O teste só se usa uma vez, no fim.
"""
import gzip
import hashlib
import sys
from pathlib import Path

import numpy as np

DADOS = Path(__file__).resolve().parents[3] / "dados"
ARQUIVOS = {"treino": ("train-images-idx3-ubyte.gz", "train-labels-idx1-ubyte.gz"),
            "teste": ("t10k-images-idx3-ubyte.gz", "t10k-labels-idx1-ubyte.gz")}
SEMENTE_DIVISAO = 0        # a semente que sorteia quais 10 mil do treino viram validação
N_VALIDACAO = 10_000


def le_imagens(caminho):
    """Lê um arquivo de imagens do MNIST e devolve uma matriz N por 784, com valores de 0 a 1.

    O formato, chamado idx, começa com 16 bytes de cabeçalho: um número mágico,
    a quantidade de imagens, as linhas e as colunas, cada um em 4 bytes. Depois
    vêm os pixels, um byte cada, de 0 a 255, linha por linha. Cada imagem de 28
    por 28 vira uma linha de 784 números, a primeira linha da imagem primeiro;
    a divisão por 255 leva os valores para entre 0 e 1, a escala em que a tanh
    trabalha bem.
    """
    with gzip.open(caminho, "rb") as f:
        dados = f.read()
    magico, n, linhas, colunas = np.frombuffer(dados[:16], dtype=">u4")   # >u4: inteiro de 4 bytes, o mais significativo primeiro
    assert magico == 2051, f"{caminho.name} não é um arquivo de imagens do MNIST"
    pixels = np.frombuffer(dados[16:], dtype=np.uint8)
    return pixels.reshape(n, linhas * colunas).astype(np.float64) / 255.0


def le_rotulos(caminho):
    """Lê um arquivo de rótulos do MNIST e devolve um vetor de N inteiros, de 0 a 9.

    O cabeçalho tem 8 bytes, o número mágico e a quantidade; depois, um byte por
    rótulo, o dígito que a imagem mostra.
    """
    with gzip.open(caminho, "rb") as f:
        dados = f.read()
    magico, n = np.frombuffer(dados[:8], dtype=">u4")
    assert magico == 2049, f"{caminho.name} não é um arquivo de rótulos do MNIST"
    return np.frombuffer(dados[8:], dtype=np.uint8).astype(np.int64)


def versao():
    """A versão dos dados: os 12 primeiros caracteres do SHA-256 dos quatro arquivos juntos.

    Vai junto com todo resultado. Se alguém rodar com outros arquivos, a versão
    muda, e o resultado deixa de ser comparável.
    """
    h = hashlib.sha256()
    for imagens, rotulos in ARQUIVOS.values():
        for nome in (imagens, rotulos):
            h.update((DADOS / nome).read_bytes())
    return h.hexdigest()[:12]


def carrega():
    """Devolve um dicionário com os três conjuntos, cada um um par (X, t).

    X: matriz N por 784, um dígito por linha, valores de 0 a 1;
    t: vetor de N rótulos, de 0 a 9.
    "treino" tem 50 mil, "validacao" 10 mil, "teste" 10 mil. A validação são 10
    mil exemplos do treino original, sorteados com SEMENTE_DIVISAO; o teste é o
    teste original, intocado.
    """
    falta = [n for par in ARQUIVOS.values() for n in par if not (DADOS / n).exists()]
    if falta:
        sys.exit(f"faltam em dados/: {', '.join(falta)}. Rode antes: python infra/baixar_dados.py")
    X, t = le_imagens(DADOS / ARQUIVOS["treino"][0]), le_rotulos(DADOS / ARQUIVOS["treino"][1])
    X_teste, t_teste = le_imagens(DADOS / ARQUIVOS["teste"][0]), le_rotulos(DADOS / ARQUIVOS["teste"][1])
    ordem = np.random.default_rng(SEMENTE_DIVISAO).permutation(len(X))    # uma ordem sorteada dos 60 mil
    val, tre = ordem[:N_VALIDACAO], ordem[N_VALIDACAO:]
    return {"treino": (X[tre], t[tre]), "validacao": (X[val], t[val]), "teste": (X_teste, t_teste)}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    conjuntos = carrega()
    print(f"versão dos dados: {versao()}")
    for nome, (X, t) in conjuntos.items():
        contagem = np.bincount(t, minlength=10)
        print(f"{nome:>9}: {X.shape[0]:>6} dígitos de {X.shape[1]} pixels; de 0 a 9: {contagem.tolist()}")
