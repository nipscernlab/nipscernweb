"""Aula 7: o erro final contra a taxa de aprendizado, numa rede pequena.

Rode, a partir da raiz do repositório:
    python aulas/07-pytorch/codigo/taxa.py

A rede pequena desta aula: 784 entradas, 16 neurônios com a tanh e 10
saídas, treinada nos 256 primeiros exemplos do treino do MNIST pelo gradiente
descendente com todos os exemplos de uma vez, sem lotes, por 200 passos. Sem
lotes, nada é sorteado durante o treino: a mesma taxa dá sempre o mesmo
resultado, e a curva do erro final contra a taxa pode ser olhada de perto.

O programa faz duas varreduras e grava as duas em resultados/taxa.json:
1. 161 taxas de 0,01 a 100, em escala logarítmica: o erro final cai com a taxa,
   chega a um mínimo e depois sobe, quando o treino passa a piorar a rede;
2. 601 taxas de 2 a 10, perto do limiar: ali a curva fica irregular, e taxas
   vizinhas dão resultados muito diferentes. É uma fatia de uma dimensão do
   plano das duas taxas, uma por camada, que a aula 9 desenha.

Erro final é a perda, a entropia cruzada, depois do último passo. A rede diverge
quando o erro final passa da perda de antes do treino: o treino piorou a rede.

No laptop do professor, o programa leva cerca de 50 segundos.

Resultado, com a semente 0: a perda antes do treino é 2,3220; o menor erro final,
0,0070, sai com a taxa 2,371; a primeira taxa da varredura larga em que o treino
piora a rede é 4,467. Na varredura fina, 383 das 601 taxas pioram a rede, e a
resposta, melhora ou piora, troca 77 vezes entre taxas vizinhas.
"""
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import torch

AULA6 = Path(__file__).resolve().parents[2] / "06-mnist-numpy" / "codigo"
sys.path.insert(0, str(AULA6))
from mnist import carrega, versao  # noqa: E402

N_EXEMPLOS = 256
LARGURA = 16
PASSOS = 200
SEMENTE = 0
RESULTADOS = Path(__file__).resolve().parents[1] / "resultados" / "taxa.json"


def pesos_iniciais(semente=SEMENTE, largura=LARGURA):
    """Os pesos iniciais da rede pequena, com desvio 1/√n, como na aula 6; vieses em zero."""
    rng = np.random.default_rng(semente)
    p = [rng.normal(0, 1 / np.sqrt(784), (largura, 784)), np.zeros(largura),
         rng.normal(0, 1 / np.sqrt(largura), (10, largura)), np.zeros(10)]
    return [torch.tensor(a, dtype=torch.float64) for a in p]


def perda(p, X, t):
    """A entropia cruzada média da rede com os pesos p: tanh na camada oculta, softmax na saída."""
    return torch.nn.functional.cross_entropy(torch.tanh(X @ p[0].T + p[1]) @ p[2].T + p[3], t)


def erro_final(taxa, X, t, iniciais, passos=PASSOS):
    """Treina a rede pequena com a taxa dada e devolve a perda depois do último passo.

    Cada passo: a perda de todos os exemplos, o gradiente pelo autograd e o passo
    contra o gradiente. Se a perda virar infinita ou passar de 1.000, o treino
    para e devolve infinito: com essa taxa, a rede explodiu.
    """
    p = [q.clone().requires_grad_(True) for q in iniciais]
    for _ in range(passos):
        L = perda(p, X, t)
        if not math.isfinite(L.item()) or L.item() > 1e3:
            return math.inf
        grad = torch.autograd.grad(L, p)          # o gradiente de L em relação a cada peso
        with torch.no_grad():
            for q, g in zip(p, grad):
                q -= taxa * g
    with torch.no_grad():
        return perda(p, X, t).item()


def varre(taxas, X, t, iniciais):
    """O erro final de cada taxa da lista; None onde a rede explodiu, para o JSON."""
    finais = []
    for taxa in taxas:
        e = erro_final(float(taxa), X, t, iniciais)
        finais.append(None if math.isinf(e) else e)
    return finais


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    torch.set_num_threads(8)
    X, t = carrega()["treino"]
    X, t = torch.tensor(X[:N_EXEMPLOS]), torch.tensor(t[:N_EXEMPLOS])
    iniciais = pesos_iniciais()
    with torch.no_grad():
        antes = perda(iniciais, X, t).item()
    inicio = time.perf_counter()
    largas = np.logspace(-2, 2, 161)
    finas = np.linspace(2, 10, 601)
    resultado = {"versao_dos_dados": versao(), "semente": SEMENTE, "exemplos": N_EXEMPLOS, "largura": LARGURA,
                 "passos": PASSOS, "perda_antes": antes,
                 "larga": {"taxas": largas.tolist(), "finais": varre(largas, X, t, iniciais)},
                 "fina": {"taxas": finas.tolist(), "finais": varre(finas, X, t, iniciais)}}
    segundos = time.perf_counter() - inicio
    larga = resultado["larga"]
    validos = [(a, e) for a, e in zip(larga["taxas"], larga["finais"]) if e is not None]
    melhor = min(validos, key=lambda par: par[1])
    limiar = next(a for a, e in zip(larga["taxas"], larga["finais"]) if e is None or e > antes)
    resultado.update(melhor_taxa=melhor[0], menor_erro=melhor[1], limiar=limiar, segundos=segundos)
    fina = resultado["fina"]
    pioram = sum(1 for e in fina["finais"] if e is None or e > antes)
    trocas = sum(1 for a, b in zip(fina["finais"], fina["finais"][1:])
                 if ((a is None or a > antes) != (b is None or b > antes)))
    resultado.update(fina_pioram=pioram, fina_trocas=trocas)
    print(f"perda antes do treino: {antes:.4f}")
    print(f"menor erro final: {melhor[1]:.4f}, com a taxa {melhor[0]:.3f}")
    print(f"primeira taxa da varredura larga em que o treino piora a rede: {limiar:.3f}")
    print(f"na varredura fina, de 2 a 10: {pioram} de {len(finas)} taxas pioram a rede, "
          f"e a resposta troca {trocas} vezes entre taxas vizinhas")
    print(f"{segundos:.0f} s")
    RESULTADOS.parent.mkdir(exist_ok=True)
    RESULTADOS.write_text(json.dumps(resultado), encoding="utf-8")
    print(f"gravado: {RESULTADOS}")
