"""Aula 9: o mapa das duas taxas, o zoom na fronteira e a dimensão dela.

Rode, a partir da raiz do repositório, depois de infra/baixar_dados.py:
    python aulas/09-projeto/codigo/fractal.py curvas
    python aulas/09-projeto/codigo/fractal.py resolucoes
    python aulas/09-projeto/codigo/fractal.py zoom
    python aulas/09-projeto/codigo/fractal.py dimensao
    python aulas/09-projeto/codigo/fractal.py esquerda
    python aulas/09-projeto/codigo/fractal.py precisao

A rede, os dados e o treino são os do projeto, em projeto/varredura.py, e este
programa só os chama: 8 entradas, a energia e o momento dos dois múons; 8
neurônios com a tanh; uma saída, o logaritmo da massa; sem viés; 72 eventos do
CMS, tantos quanto os pesos da rede; gradiente descendente com todos os
exemplos, 100 passos, uma taxa para cada camada; semente 0. Cada pixel de um
mapa é um treino inteiro, do zero, com um par de taxas.

O que cada parte grava em resultados/:
- curvas: a perda de quatro treinos, passo a passo, para o vídeo em que cada
  pixel é um treino (curvas.json);
- resolucoes: o mapa da janela inteira com 8, 16, 32, 64 e 128 pixels de lado,
  para o mesmo vídeo (resolucoes.json e resolucao-N.npy);
- zoom: seis janelas, uma dentro da outra, cada uma quatro vezes menor, com
  512 por 512 treinos cada, para o vídeo do zoom (zoom.json e zoom-K.npy);
- dimensao: a dimensão da fronteira em cada janela do zoom, pela contagem de
  caixas, e a mediana, como no artigo (dimensao.json).
- esquerda: a fronteira de cima, à esquerda do mapa: o limiar da regressão
  linear da aula 2, 2 / λ, e os treinos que explodem e voltam logo acima dele
  (esquerda.json);
- precisao: a janela do zoom do projeto em float32 e em float64, comparadas
  pixel a pixel (precisao.json).

Os .npy, a imagem em números, ficam fora do git: se refazem pelo .json ao lado.

As varreduras se repartem entre os núcleos do processador: cada processo treina
um pedaço dos pixels, com a função treinar do projeto. No laptop do professor,
com 16 núcleos, a janela de 512 por 512 leva uns 73 segundos, e tudo, uns 8 minutos.
"""
import os

# Cada processo usa um núcleo só na álgebra linear: são 16 processos, um por
# núcleo, e mais linhas de execução por processo só disputariam os núcleos.
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")

import json  # noqa: E402
import sys  # noqa: E402
import time  # noqa: E402
from concurrent.futures import ProcessPoolExecutor  # noqa: E402
from pathlib import Path  # noqa: E402

import numpy as np  # noqa: E402

RAIZ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RAIZ / "projeto"))
from varredura import carregar_muons, medida, sha256, treinar, ARQUIVO_MUONS  # noqa: E402

RESULTADOS = Path(__file__).resolve().parents[1] / "resultados"
SEMENTE, LARGURA, PASSOS = 0, 8, 100
JANELA = (-3.0, 6.0, -3.0, 6.0)          # a janela inteira do projeto, em log10 da taxa
PROCESSOS = os.cpu_count() or 4

# O zoom: o centro de cada janela, em log10 das duas taxas, e a largura da
# primeira. Cada janela seguinte tem um quarto da largura da anterior e fica
# dentro dela: a última é 4⁵ = 1.024 vezes menor que a primeira. Os centros
# foram escolhidos olhando cada mapa, sobre a fronteira de cima, onde há
# filamentos e redemoinhos: é escolha à mão, como a do artigo.
CENTROS = [(1.5, 1.5), (1.1, 1.65), (1.0, 1.72), (1.12, 1.665), (1.085, 1.668), (1.0825, 1.6715)]
LARGURA_0 = 9.0


def rede_e_dados():
    """Os pesos iniciais e os 72 eventos do projeto, como em varredura.py com a semente 0.

    Devolve X (72 por 8), y (72), W0 (8 por 8) e W1 (8). A ordem dos sorteios é
    a mesma de varredura.main(): primeiro os pesos, depois os eventos.
    """
    rng = np.random.default_rng(SEMENTE)
    W0, W1 = rng.standard_normal((8, LARGURA)), rng.standard_normal(LARGURA)
    X, y = carregar_muons(8 * LARGURA + LARGURA, SEMENTE)
    return X, y, W0, W1


def _pedaco(args):
    """Treina um pedaço dos pixels num processo e devolve a medida de cada treino."""
    X, y, W0, W1, taxa0, taxa1, tipo = args
    return medida(treinar(X, y, W0, W1, taxa0, taxa1, PASSOS, tipo))


def mapa(janela, resolucao, dados, tipo=np.float64):
    """O mapa de uma janela: resolucao por resolucao treinos, um por par de taxas.

    janela: (x0, x1, y0, y1) em log10 da taxa; x é a camada de entrada, y a de saída.
    Devolve a matriz de medidas, linha = taxa de saída, coluna = taxa de entrada:
    negativa onde o treino convergiu, positiva onde divergiu (medida() do projeto).
    tipo: a precisão dos números, float64, como no artigo, ou float32, para comparar.
    """
    tx = np.logspace(janela[0], janela[1], resolucao)
    ty = np.logspace(janela[2], janela[3], resolucao)
    taxa0, taxa1 = (m.ravel() for m in np.meshgrid(tx, ty))
    bloco = -(-taxa0.size // (4 * PROCESSOS))                 # quatro pedaços por processo
    tarefas = [(*dados, taxa0[i:i + bloco], taxa1[i:i + bloco], tipo) for i in range(0, taxa0.size, bloco)]
    with ProcessPoolExecutor(PROCESSOS) as ex:
        partes = list(ex.map(_pedaco, tarefas))
    return np.concatenate(partes).reshape(resolucao, resolucao)


def janela_do_zoom(k):
    """A janela k do zoom, (x0, x1, y0, y1), quadrada em log10 das taxas."""
    cx, cy = CENTROS[k]
    m = LARGURA_0 / 4 ** k / 2
    return (cx - m, cx + m, cy - m, cy + m)


def fronteira(V):
    """Os pixels da fronteira: os que têm um vizinho, de lado ou de cima, do outro lado.

    V é o mapa de medidas; o lado é o sinal, convergiu ou divergiu. Devolve uma
    matriz de verdadeiro ou falso do tamanho do mapa.
    """
    c = V < 0
    f = np.zeros_like(c)
    f[:, 1:] |= c[:, 1:] != c[:, :-1]
    f[:, :-1] |= c[:, 1:] != c[:, :-1]
    f[1:, :] |= c[1:, :] != c[:-1, :]
    f[:-1, :] |= c[1:, :] != c[:-1, :]
    return f


def caixas(f, tamanhos):
    """Quantas caixas de cada tamanho, em pixels, tocam a fronteira f.

    A imagem se corta numa grade de caixas de lado s; conta-se a caixa que tem
    pelo menos um pixel da fronteira. Uma linha precisa de 2 vezes mais caixas
    quando s cai pela metade; uma área, de 4 vezes; a fronteira, de 2 elevado à
    dimensão dela.
    """
    n = f.shape[0]
    contagem = []
    for s in tamanhos:
        m = n // s
        g = f[:m * s, :m * s].reshape(m, s, m, s).any(axis=(1, 3))
        contagem.append(int(g.sum()))
    return contagem


def dimensao(f, tamanhos=(2, 4, 8, 16)):
    """A dimensão pela contagem de caixas: a inclinação de log N contra log(1/s).

    Devolve a inclinação e as contagens. A reta se ajusta por mínimos quadrados.
    O tamanho 1, o pixel, fica de fora: nele, a fronteira desenhada tem a
    espessura de um pixel, e a conta mede o desenho, não a fronteira. As
    caixas de 32 e 64 pixels também: nas janelas de dentro do zoom, quase
    todas tocam a fronteira, a contagem para de crescer e a reta entorta.
    """
    N = caixas(f, tamanhos)
    inclinacao = np.polyfit(np.log(1 / np.array(tamanhos)), np.log(N), 1)[0]
    return float(inclinacao), N


def grava(nome, dados):
    RESULTADOS.mkdir(exist_ok=True)
    (RESULTADOS / nome).write_text(json.dumps(dados, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"gravado: {RESULTADOS / nome}")


def origem():
    return {"semente": SEMENTE, "largura": LARGURA, "passos": PASSOS, "exemplos": 8 * LARGURA + LARGURA,
            "dados": "dados/dimuon.csv", "sha256": sha256(ARQUIVO_MUONS)}


def faz_curvas(dados):
    """A perda, passo a passo, de quatro treinos da janela inteira: dois que convergem e dois que divergem.

    Os pares, em log10 das taxas (entrada; saída), foram escolhidos no mapa: um
    no meio da região que converge, um perto da fronteira, um logo acima dela e
    um longe, no alto.
    """
    pares = [(0.0, 0.0), (1.0, 1.5), (1.0, 2.2), (1.0, 4.5)]
    X, y, W0, W1 = dados
    t0 = np.array([10 ** a for a, _ in pares])
    t1 = np.array([10 ** b for _, b in pares])
    perdas = treinar(X, y, W0, W1, t0, t1, PASSOS)
    v = medida(perdas)
    grava("curvas.json", {**origem(), "pares_log10": pares, "perdas": np.where(np.isfinite(perdas), perdas, None).tolist(),
                          "medida": v.tolist()})


def faz_resolucoes(dados):
    """O mapa da janela inteira com 8, 16, 32, 64 e 128 pixels de lado: o vídeo enche o plano aos poucos."""
    tempos = {}
    for r in (8, 16, 32, 64, 128):
        inicio = time.perf_counter()
        V = mapa(JANELA, r, dados)
        tempos[r] = round(time.perf_counter() - inicio, 1)
        np.save(RESULTADOS / f"resolucao-{r}.npy", V)
        print(f"{r} por {r}: {tempos[r]} s, convergiram {np.mean(V < 0) * 100:.0f}%")
    grava("resolucoes.json", {**origem(), "janela": JANELA, "segundos": tempos, "processos": PROCESSOS})


def faz_zoom(dados, resolucao=512):
    """As seis janelas do zoom, com o tempo de cada uma."""
    janelas, tempos, fracoes = [], [], []
    for k in range(len(CENTROS)):
        j = janela_do_zoom(k)
        inicio = time.perf_counter()
        V = mapa(j, resolucao, dados)
        tempos.append(round(time.perf_counter() - inicio, 1))
        np.save(RESULTADOS / f"zoom-{k}.npy", V)
        janelas.append(j)
        fracoes.append(round(float(np.mean(V < 0)), 4))
        print(f"janela {k}: largura {j[1] - j[0]:.6f}, {tempos[-1]} s, convergiram {fracoes[-1] * 100:.0f}%")
    grava("zoom.json", {**origem(), "resolucao": resolucao, "centros": CENTROS, "largura_0": LARGURA_0,
                        "janelas": janelas, "segundos": tempos, "fracao_convergiu": fracoes, "processos": PROCESSOS})


def faz_dimensao():
    """A dimensão da fronteira em cada janela do zoom e a mediana delas, como no artigo."""
    r = json.loads((RESULTADOS / "zoom.json").read_text(encoding="utf-8"))
    tamanhos = (2, 4, 8, 16, 32, 64)        # as seis contagens vão para o JSON; a reta usa as quatro primeiras
    por_janela = []
    for k in range(len(r["janelas"])):
        f = fronteira(np.load(RESULTADOS / f"zoom-{k}.npy"))
        d, _ = dimensao(f)
        N = caixas(f, tamanhos)
        por_janela.append({"dimensao": round(d, 4), "caixas": N})
        print(f"janela {k}: dimensão {d:.2f}, caixas {N}")
    mediana = float(np.median([p["dimensao"] for p in por_janela]))
    print(f"mediana: {mediana:.2f}")
    grava("dimensao.json", {"tamanhos": tamanhos, "tamanhos_da_reta": (2, 4, 8, 16), "janelas": por_janela,
                            "mediana": round(mediana, 4)})


def faz_esquerda(dados, eta0=1e-3, etas1=(50.0, 52.0, 60.0, 70.0, 80.0)):
    """A fronteira de cima, à esquerda do mapa, onde a camada de entrada quase não anda.

    Com η₀ muito pequena, só a camada de saída treina, e o treino é a regressão
    linear da aula 2 sobre as saídas fixas da camada oculta, h: a perda é uma
    tigela, e o passo diverge acima de η₁ = 2 / λ, com λ o maior autovalor da
    hessiana, (2/n) hᵀh / 8², a conta do limiar 0,513 da reta da aula 2.
    O mapa mostra mais que a conta: logo acima do limiar, uma linha fina de
    treinos que divergem; acima dela, uma faixa em que a perda explode e volta.
    Na explosão, o gradiente fica tão grande que a camada de entrada se mexe,
    mesmo com η₀ = 0,001, o maior autovalor cai abaixo de 2 / η₁, e o treino
    converge; mais acima, a explosão vence. Os treinos com η₀ = 0,001 e as
    taxas de etas1 mostram isso com a função de leitura, perda_e_gradientes.
    """
    from varredura import perda_e_gradientes
    X, y, W0, W1 = dados
    n, d = X.shape

    def maior_autovalor(W):
        h = np.tanh(np.sqrt(2 / d) * X @ W)
        return float(np.linalg.eigvalsh(2 / n * h.T @ h / W1.size ** 2).max())

    lam = maior_autovalor(W0)
    treinos = []
    for eta1 in etas1:
        A, B, perdas = W0.copy(), W1.copy(), []
        with np.errstate(all="ignore"):
            for _ in range(PASSOS):
                L, g0, g1 = perda_e_gradientes(X, y, A, B)
                perdas.append(float(L))
                if not np.isfinite(L) or L > 1e6:
                    break
                A -= eta0 * g0
                B -= eta1 * g1
        divergiu = not np.isfinite(perdas[-1]) or perdas[-1] > 1e6 or perdas[-1] > perdas[0]
        treinos.append({"eta1": eta1, "pico": round(max(perdas), 1), "final": round(perdas[-1], 4),
                        "divergiu": bool(divergiu), "lambda_final": None if divergiu else round(maior_autovalor(A), 5),
                        "W0_mudou": None if divergiu else round(float(np.linalg.norm(A - W0) / np.linalg.norm(W0)), 3)})
        print(treinos[-1])
    # no mapa da janela inteira: a classe de cada linha nas colunas com η₀ abaixo de 10⁻²
    linha = {}
    if (RESULTADOS / "zoom-0.npy").exists():
        V = np.load(RESULTADOS / "zoom-0.npy")
        ty = np.linspace(JANELA[2], JANELA[3], V.shape[0])
        colunas = np.linspace(JANELA[0], JANELA[1], V.shape[1]) < -2
        fracao = (V[:, colunas] > 0).mean(1)            # em cada linha, a fração dos treinos que divergem
        fina = [i for i in range(len(ty)) if ty[i] < 1.8 and fracao[i] > 0.5 and fracao[i - 1] == 0 and fracao[i + 1] == 0]
        topo = float(ty[np.where(fracao == 0)[0].max()])
        linha = {"linha_fina_log10": [round(float(ty[i]), 3) for i in fina],
                 "linha_fina_fracao": [round(float(fracao[i]), 2) for i in fina],
                 "ultimo_que_converge_log10": round(topo, 3)}
    grava("esquerda.json", {**origem(), "eta0": eta0, "maior_autovalor": round(lam, 5),
                            "limiar": round(2 / lam, 2), "treinos": treinos, "no_mapa": linha})


def faz_precisao(dados, janela=(0.6, 1.6, 1.45, 1.95), resolucao=256):
    """A mesma janela em float32 e em float64: quantos pixels caem na mesma classe.

    A janela é a do zoom-muons de projeto/figuras/. Devolve, em precisao.json, a
    fração de pixels com a mesma classe, convergiu ou divergiu, nas duas
    precisões, e a fração dos que trocam que estão em cima da fronteira do mapa
    em float64. Também o espaçamento relativo entre taxas vizinhas da janela e o
    menor espaçamento que cada precisão distingue.
    """
    V32 = mapa(janela, resolucao, dados, np.float32)
    V64 = mapa(janela, resolucao, dados, np.float64)
    troca = (V32 < 0) != (V64 < 0)
    grava("precisao.json", {**origem(), "janela": janela, "resolucao": resolucao,
                            "mesma_classe": round(float(np.mean(~troca)), 4),
                            "trocas_na_fronteira": round(float(np.mean(fronteira(V64)[troca])), 3),
                            "espacamento_relativo": float(np.log(10) * (janela[1] - janela[0]) / (resolucao - 1)),
                            "float32_distingue": float(np.finfo(np.float32).eps),
                            "float64_distingue": float(np.finfo(np.float64).eps)})


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    RESULTADOS.mkdir(exist_ok=True)
    o_que = sys.argv[1] if len(sys.argv) > 1 else "tudo"
    if o_que == "dimensao":
        faz_dimensao()
        sys.exit()
    dados = rede_e_dados()
    if o_que in ("curvas", "tudo"):
        faz_curvas(dados)
    if o_que in ("resolucoes", "tudo"):
        faz_resolucoes(dados)
    if o_que in ("zoom", "tudo"):
        faz_zoom(dados)
    if o_que == "tudo":
        faz_dimensao()
    if o_que in ("esquerda", "tudo"):
        faz_esquerda(dados)
    if o_que in ("precisao", "tudo"):
        faz_precisao(dados)
