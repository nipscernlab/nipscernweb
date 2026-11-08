"""Aula 9: a rede pequena da aula 7 no plano das duas taxas, e por que a faixa dela é granulada.

Rode, a partir da raiz do repositório:
    python aulas/09-projeto/codigo/plano_aula7.py

A aula 7 treinou a rede de 784 entradas, 16 neurônios com a tanh e 10 saídas
nos 256 primeiros exemplos do MNIST, 200 passos sem lotes, com uma taxa só, e
achou, entre 3,86 e 7,55, uma faixa em que taxas vizinhas dão respostas
diferentes. Aqui cada camada ganha a sua taxa: η₀ para a camada oculta, pesos e
vieses, e η₁ para a de saída. A taxa única da aula 7 é a diagonal do plano,
η₀ = η₁.

Cada pixel é um treino, e a perda de cada passo fica guardada. No passo k, o
treino está numa de três classes:
- voltou: a perda está abaixo da de antes do treino, 2,3220;
- em trânsito: a perda está acima dela, mas nunca passou de 1.000;
- explodiu: a perda passou de 1.000, ou virou infinita, em algum passo até k.
"Voltou" é o "melhorou a rede" da aula 7, e a regra do artigo, a média dos 20
últimos passos abaixo da perda do começo, dá a mesma classe em mais de 99% dos
pixels.

O programa grava em resultados/plano-aula7.json:
1. o plano, η₀ e η₁ de 10⁻² a 10^2,5, 128 por 128 treinos de 200 passos, com
   as três classes, e a classe de cada pixel em plano-aula7-plano.npy;
2. a janela da faixa, η₀ de 10^0,6 a 10^1,1 e η₁ de 10^0,55 a 10^1,05, 128 por
   128 treinos de 600 passos: quantos já voltaram nos passos 200, 400 e 600, e
   quantos pares de vizinhos estão em classes diferentes;
3. a perda passo a passo de seis taxas vizinhas da janela, na mesma linha: o
   retrato do trânsito;
4. a diagonal da aula 7, as mesmas 601 taxas de 2 a 10 da figura do zoom de lá,
   agora com 600 passos: quantas pioram a rede e quantas vezes a resposta troca
   entre taxas vizinhas, nos passos 200, 400 e 600.
Só a parte 4, que leva segundos, sem refazer as outras:
    python aulas/09-projeto/codigo/plano_aula7.py diagonal

O resultado explica a faixa granulada. Nos primeiros passos, a perda salta da
inicial, 2,32, para dezenas, entre 37 e 62 nas seis vizinhas, e depois volta
devagar, oscilando, e cada taxa volta num passo diferente, sem ordem entre
vizinhas. O mapa num passo fixo pega umas
já de volta e outras ainda no caminho: com mais passos, mais voltam, e o mapa
continua granulado.

Para treinar milhares de redes de uma vez, a conta se reorganiza sem mudar o
resultado. O passo do gradiente descendente na camada oculta soma aos pesos uma
combinação das linhas de X, as imagens; então X W₀ᵀ + b₀, a entrada da tanh,
muda por K D, com K = X Xᵀ + 1, uma matriz de 256 por 256 calculada uma vez, e
D, a derivada da perda em relação a essa entrada. Assim a rede nunca multiplica
pelos 784 pixels depois do primeiro passo. A conferência no início compara três
taxas da diagonal com a função erro_final da aula 7.

No laptop do professor, o plano leva cerca de 2 minutos e meio, e a janela de
600 passos, uns 8 minutos; os tempos medidos ficam no .json.
"""
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import torch

RAIZ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RAIZ / "aulas" / "07-pytorch" / "codigo"))
sys.path.insert(0, str(RAIZ / "aulas" / "06-mnist-numpy" / "codigo"))
from mnist import carrega, versao  # noqa: E402
from taxa import N_EXEMPLOS, PASSOS, SEMENTE, erro_final, perda, pesos_iniciais  # noqa: E402

RESULTADOS = Path(__file__).resolve().parents[1] / "resultados"
PLANO = (-2.0, 2.5, -2.0, 2.5)
FAIXA = (0.6, 1.1, 0.55, 1.05)
RESOLUCAO = 128
PASSOS_FAIXA = 600
LINHA, COLUNAS = 64, range(40, 46)        # os seis vizinhos da janela da faixa: linha 64, colunas 40 a 45
VOLTOU, TRANSITO, EXPLODIU = 0, 1, 2


def treina_muitas(taxa0, taxa1, X, Y, P, K, passos=PASSOS):
    """Treina G cópias da rede pequena, uma para cada par de taxas, e devolve a perda de cada passo.

    taxa0, taxa1: tensores de G taxas, da camada oculta e da de saída;
    X, Y: as 256 imagens e os rótulos em one-hot, 256 por 10;
    P: os pesos iniciais da aula 7; K: X Xᵀ + 1.
    Devolve uma matriz G por passos + 1: a perda antes do primeiro passo e
    depois de cada um. A conta é a de taxa.py da aula 7, reorganizada.
    """
    G, n = taxa0.numel(), X.shape[0]
    Z = (X @ P[0].T + P[1])[None].expand(G, n, -1).clone()    # a entrada da tanh, G por 256 por 16
    W1 = P[2].T[None].expand(G, -1, -1).clone()                # os pesos de saída, G por 16 por 10
    b1 = P[3][None, None].expand(G, 1, -1).clone()             # os vieses de saída, G por 1 por 10
    e0, e1 = taxa0.view(G, 1, 1), taxa1.view(G, 1, 1)
    perdas = torch.empty(G, passos + 1, dtype=torch.float64)
    for k in range(passos + 1):
        h = torch.tanh(Z)
        ls = torch.log_softmax(torch.baddbmm(b1, h, W1), 2)    # o logaritmo da softmax
        perdas[:, k] = -(ls * Y).sum(2).mean(1)                # a entropia cruzada de cada rede
        if k == passos:
            break
        d = (ls.exp() - Y) / n                                 # a derivada da perda em relação à saída
        grad_W1 = torch.bmm(h.transpose(1, 2), d)
        grad_b1 = d.sum(1, keepdim=True)
        D = torch.bmm(d, W1.transpose(1, 2)) * (1 - h * h)     # a regra da cadeia até a entrada da tanh
        Z -= e0 * torch.matmul(K, D)                           # o passo da camada oculta, visto em Z
        W1 -= e1 * grad_W1
        b1 -= e1 * grad_b1
    return perdas.numpy()


def classes(perdas, k, antes):
    """A classe de cada treino no passo k: voltou, em trânsito ou explodiu (ver o começo do arquivo)."""
    ate_k = perdas[:, :k + 1]
    explodiu = (~np.isfinite(ate_k) | (ate_k > 1e3)).any(1)
    voltou = ~explodiu & (perdas[:, k] < antes)
    return np.where(explodiu, EXPLODIU, np.where(voltou, VOLTOU, TRANSITO))


def taxas(janela, resolucao=RESOLUCAO):
    """Os pares de taxas de uma janela em log10, linha por linha: linha = η₁, coluna = η₀."""
    tx = torch.logspace(janela[0], janela[1], resolucao, dtype=torch.float64)
    ty = torch.logspace(janela[2], janela[3], resolucao, dtype=torch.float64)
    T0, T1 = torch.meshgrid(tx, ty, indexing="xy")
    return T0.reshape(-1), T1.reshape(-1)


def varre(janela, passos, X, Y, P, K, bloco=2048):
    """A perda de cada passo de todos os treinos da janela, uma linha por pixel."""
    t0, t1 = taxas(janela)
    return np.concatenate([treina_muitas(t0[i:i + bloco], t1[i:i + bloco], X, Y, P, K, passos)
                           for i in range(0, t0.numel(), bloco)])


def vizinhos_diferentes(c):
    """A fração dos pares de pixels vizinhos, lado a lado, que estão em classes diferentes."""
    m = c.reshape(RESOLUCAO, RESOLUCAO)
    return float(np.mean(m[:, 1:] != m[:, :-1]))


def diagonal(X, Y, P, K, antes):
    """A parte 4: as 601 taxas de 2 a 10 da aula 7, com η₀ = η₁, por 600 passos.

    Devolve, para os passos 200, 400 e 600, quantas das 601 pioram a rede, a
    perda acima da de antes, e quantas vezes a resposta, melhora ou piora, troca
    entre taxas vizinhas. No passo 200, a aula 7 conta 383 e 77 trocas; aqui a
    ordem das somas é outra, e na faixa o treino amplifica a diferença do
    arredondamento, então as contagens podem diferir um pouco.
    """
    eta = torch.linspace(2, 10, 601, dtype=torch.float64)
    H = treina_muitas(eta, eta, X, Y, P, K, PASSOS_FAIXA)
    saida = {"taxas": [2, 10, 601], "passos": PASSOS_FAIXA}
    for k in (200, 400, 600):
        piora = classes(H, k, antes) != VOLTOU
        saida[str(k)] = {"pioram": int(piora.sum()), "trocas": int(np.sum(piora[1:] != piora[:-1]))}
    print("diagonal:", saida)
    return saida


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    torch.set_num_threads(16)
    X, t = carrega()["treino"]
    X, t = torch.tensor(X[:N_EXEMPLOS]), torch.tensor(t[:N_EXEMPLOS])
    Y = torch.nn.functional.one_hot(t, 10).double()
    P = pesos_iniciais()
    K = X @ X.T + 1.0
    with torch.no_grad():
        antes = perda(P, X, t).item()
    if sys.argv[1:] == ["diagonal"]:
        resultado = json.loads((RESULTADOS / "plano-aula7.json").read_text(encoding="utf-8"))
        resultado["diagonal"] = diagonal(X, Y, P, K, antes)
        (RESULTADOS / "plano-aula7.json").write_text(json.dumps(resultado, ensure_ascii=False), encoding="utf-8")
        sys.exit()

    # Conferência: na diagonal, a conta reorganizada tem de dar o resultado da aula 7.
    # Só com taxas de antes da faixa: dentro dela, a ordem diferente das somas muda
    # o arredondamento na 16ª casa, o treino amplifica a diferença, e os dois números
    # finais se separam. A taxa 5 fica registrada para mostrar isso.
    def final(eta):
        h = treina_muitas(torch.tensor([eta], dtype=torch.float64), torch.tensor([eta], dtype=torch.float64), X, Y, P, K)
        return math.inf if classes(h, PASSOS, antes)[0] == EXPLODIU else float(h[0, -1])
    conferencia = []
    for eta in (0.5, 1.0, 2.0):
        a, b = erro_final(eta, X, t, P), final(eta)
        conferencia.append({"taxa": eta, "aula7": a, "aqui": b})
        print(f"taxa {eta}: aula 7 {a:.10f}, aqui {b:.10f}")
        assert abs(a - b) < 1e-8, "a conta reorganizada não confere com a da aula 7"
    caos = {"taxa": 5.0, "aula7": erro_final(5.0, X, t, P), "aqui": final(5.0)}
    print(f"taxa 5, na faixa: aula 7 {caos['aula7']:.4f}, aqui {caos['aqui']:.4f}")

    RESULTADOS.mkdir(exist_ok=True)
    resultado = {"versao_dos_dados": versao(), "semente": SEMENTE, "exemplos": N_EXEMPLOS, "perda_antes": antes,
                 "resolucao": RESOLUCAO, "conferencia": conferencia, "caos": caos}

    # 1. o plano, 200 passos, como na aula 7
    inicio = time.perf_counter()
    H = varre(PLANO, PASSOS, X, Y, P, K)
    c = classes(H, PASSOS, antes)
    np.save(RESULTADOS / "plano-aula7-plano.npy", c.reshape(RESOLUCAO, RESOLUCAO).astype(np.int8))
    v = H / antes                                               # a regra do artigo, para comparar
    artigo = (np.nan_to_num(v[:, -20:], nan=np.inf, posinf=np.inf).mean(1) < 1) & (c != EXPLODIU)
    resultado["plano"] = {"janela": PLANO, "passos": PASSOS, "segundos": round(time.perf_counter() - inicio, 1),
                          "fracao": {nome: round(float(np.mean(c == k)), 4)
                                     for nome, k in (("voltou", VOLTOU), ("transito", TRANSITO),
                                                     ("explodiu", EXPLODIU))},
                          "regra_do_artigo_igual": round(float(np.mean(artigo == (c == VOLTOU))), 4)}
    print("plano:", resultado["plano"])

    # 2. a janela da faixa, 600 passos
    inicio = time.perf_counter()
    H = varre(FAIXA, PASSOS_FAIXA, X, Y, P, K)
    por_passo = {}
    for k in (200, 400, 600):
        ck = classes(H, k, antes)
        por_passo[str(k)] = {"voltou": round(float(np.mean(ck == VOLTOU)), 4),
                             "vizinhos_diferentes": round(vizinhos_diferentes(ck), 4)}
        np.save(RESULTADOS / f"plano-aula7-faixa-{k}.npy", ck.reshape(RESOLUCAO, RESOLUCAO).astype(np.int8))
    c200, c600 = classes(H, 200, antes), classes(H, 600, antes)
    resultado["faixa"] = {"janela": FAIXA, "passos": PASSOS_FAIXA, "segundos": round(time.perf_counter() - inicio, 1),
                          "por_passo": por_passo,
                          "voltou_depois_do_200": int(np.sum((c200 != VOLTOU) & (c600 == VOLTOU))),
                          "voltou_e_subiu_de_novo": int(np.sum((c200 == VOLTOU) & (c600 != VOLTOU)))}
    print("faixa:", resultado["faixa"])

    # 3. seis vizinhas na mesma linha da janela da faixa
    t0, t1 = taxas(FAIXA)
    idx = [LINHA * RESOLUCAO + j for j in COLUNAS]
    resultado["vizinhas"] = [{"eta0": float(t0[i]), "eta1": float(t1[i]),
                              "perdas": [round(float(x), 5) for x in H[i]],
                              "voltou_no_passo": next((k for k in range(1, PASSOS_FAIXA + 1) if H[i, k] < antes
                                                       and H[i, :k].max() > antes), None)}
                             for i in idx]
    resultado["diagonal"] = diagonal(X, Y, P, K, antes)
    print("vizinhas: voltam nos passos", [vz["voltou_no_passo"] for vz in resultado["vizinhas"]],
          "| pico", [round(max(vz["perdas"]), 1) for vz in resultado["vizinhas"]])
    (RESULTADOS / "plano-aula7.json").write_text(json.dumps(resultado, ensure_ascii=False), encoding="utf-8")
    print(f"gravado: {RESULTADOS / 'plano-aula7.json'}")
