"""Os dados do CMS: os 100 mil eventos com dois múons do registro 303, e a fórmula da massa invariante.

Este arquivo vai para a turma: ele só lê os dados e calcula a fórmula. Antes,
rode uma vez, a partir da raiz do repositório:
    python infra/baixar_dados.py

Rodado sozinho, confere a fórmula contra a coluna M do arquivo:
    python aulas/08-dados-do-cern/codigo/dimuon.py

As colunas, como a página do registro 303 as descreve: Type, o tipo de cada
múon, T de tracker muon e G de global muon; Run, a corrida; Event, o evento; e,
para cada múon, 1 e 2, E, a energia em GeV; px, py e pz, as componentes do
momento em GeV; pt, o momento transversal; eta, a pseudorrapidez; phi, o ângulo
phi em radianos; Q, a carga. M é a massa invariante dos dois múons, em GeV.
"""
import csv
import sys
from pathlib import Path

import numpy as np

ARQUIVO = Path(__file__).resolve().parents[3] / "dados" / "dimuon.csv"


def carrega():
    """Lê o dimuon.csv e devolve um dicionário: o nome de cada coluna e um array com os 100 mil valores.

    O cabeçalho do arquivo tem um espaço sobrando em "px1 ", que o strip() tira.
    A coluna Type é texto, como "GT" ou "GG", e fica como lista; as outras viram
    números.
    """
    if not ARQUIVO.exists():
        sys.exit("falta dados/dimuon.csv. Rode antes: python infra/baixar_dados.py")
    with open(ARQUIVO, newline="", encoding="utf-8") as f:
        linhas = list(csv.reader(f))
    nomes = [n.strip() for n in linhas[0]]
    colunas = {}
    for k, nome in enumerate(nomes):
        valores = [linha[k] for linha in linhas[1:]]
        colunas[nome] = valores if nome == "Type" else np.array(valores, dtype=np.float64)
    return colunas


def massa_invariante(E1, px1, py1, pz1, E2, px2, py2, pz2):
    """A massa invariante dos dois múons, em GeV, pela fórmula da relatividade especial.

    Com a energia em GeV e o momento em GeV, nas unidades em que a velocidade da
    luz vale 1, M² = (E₁ + E₂)² − |p⃗₁ + p⃗₂|²: a energia total ao quadrado menos o
    momento total ao quadrado. É a massa da partícula que se desfez nos dois
    múons, se foi isso que aconteceu. O np.maximum evita a raiz de um número
    negativo, que o arredondamento pode produzir quando M é muito pequena.
    """
    m2 = (E1 + E2) ** 2 - (px1 + px2) ** 2 - (py1 + py2) ** 2 - (pz1 + pz2) ** 2
    return np.sqrt(np.maximum(m2, 0.0))


MASSA_DO_MUON = 0.1056583755   # GeV; o verbete "Muon" da Wikipedia dá 105,66 MeV


def massa_das_colunas(c):
    """A fórmula aplicada à energia e ao momento do arquivo, E, px, py e pz de cada múon."""
    return massa_invariante(c["E1"], c["px1"], c["py1"], c["pz1"], c["E2"], c["px2"], c["py2"], c["pz2"])


def massa_pela_direcao(c):
    """A fórmula com o momento refeito de pt, eta e phi, e a energia de p e da massa do múon.

    px = pt cos φ, py = pt sen φ, pz = pt senh η, e E = √(p² + m²). É assim que a
    coluna M do arquivo bate em todos os eventos; com E, px, py e pz do arquivo,
    bate em 99,6% deles, porque em 0,4% a energia de um múon não combina com o
    momento dele. Isso é dedução, tirada dos próprios dados: a página do
    registro não diz como M foi calculada.
    """
    partes = []
    for k in ("1", "2"):
        pt, eta, phi = c["pt" + k], c["eta" + k], c["phi" + k]
        px, py, pz = pt * np.cos(phi), pt * np.sin(phi), pt * np.sinh(eta)
        partes += [np.sqrt(px ** 2 + py ** 2 + pz ** 2 + MASSA_DO_MUON ** 2), px, py, pz]
    return massa_invariante(*partes)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    c = carrega()
    print(f"{len(c['M'])} eventos; colunas: {', '.join(c)}")
    print(f"massa de {c['M'].min():.2f} a {c['M'].max():.2f} GeV")
    for nome, M in (("com E e p do arquivo", massa_das_colunas(c)), ("com pt, eta e phi", massa_pela_direcao(c))):
        rel = np.abs(M - c["M"]) / c["M"]
        print(f"fórmula {nome}: diferença relativa mediana {np.median(rel):.1e}; "
              f"eventos com mais de 0,1%: {(rel > 1e-3).sum()}")
    tipos, contagem = np.unique(c["Type"], return_counts=True)
    print("tipos:", dict(zip(tipos.tolist(), contagem.tolist())))
