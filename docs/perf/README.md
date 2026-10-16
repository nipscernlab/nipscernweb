# Medições de desempenho

Esta pasta guarda as medições do site, uma por arquivo, para comparar antes e
depois de cada mudança. Quem mede é `tools/perf/measure.js`; quem compara é
`tools/perf/compare.js`. O plano de otimização de outubro de 2026 está em
[plano-2026-10.md](plano-2026-10.md).

## Medir

Uma vez por máquina: `npm install` (traz o Lighthouse 13.5.0, a versão do
PageSpeed Insights, e o puppeteer-core). O Edge tem de estar no caminho padrão,
ou em `EDGE_PATH`.

```bash
npm run dev                                                   # para medir o local
node tools/perf/measure.js --label local-depois               # http://127.0.0.1:3000/
node tools/perf/measure.js --base https://www.nipscern.com/ --label prod-depois
node tools/perf/compare.js docs/perf/local-antes.json docs/perf/local-depois.json
```

Opções: `--runs N` (3), `--only home,about` (nomes da lista `PAGINAS` no
começo do medidor), `--profiles desktop,mobile`, `--query fx=lite` (acrescentado
à URL de cada página), `--no-lighthouse`, `--no-runtime`.

Cada medição grava `docs/perf/<label>.json` e `.md`, com as medianas e o
ambiente (CPU, GPU, versão do Edge, frequência da tela), e
`tools/perf/.out/<label>/`, fora do git, com cada execução e os relatórios do
Lighthouse.

## O que se mede

| Medida | Como |
|---|---|
| Nota, FCP, LCP, TBT, CLS, Speed Index | Lighthouse 13.5.0, simulado: celular Moto G Power em 4G lento com CPU 4x; computador com o perfil de desktop do Lighthouse |
| KB e pedidos | a rede real da execução, com cache vazio |
| parado | a página no topo por 5 s sem ninguém mexer: % ocupado da thread principal da página, da rasterização, do compositor e da GPU (trace do Edge), e pedidos de `requestAnimationFrame` por segundo |
| rolagem | a página rolada até 12.000 px a 1.500 px/s, com roda no computador e dedo no celular: fps, quadros entregues (dos que a tela esperava), p95 e pior intervalo, engasgos acima de 50 ms, long animation frames |
| toque | no celular, o toque no botão do menu até o quadro seguinte (Event Timing) |

Computador: 1536 × 864, DPR 1,25, CPU sem freio. Celular: 390 × 844, DPR 3,
toque, CPU 4x mais lenta. A GPU não tem freio, então o número de GPU vale para
comparar antes e depois na mesma máquina, não entre máquinas.

Os beacons de análise (GoatCounter, Google Analytics, Bing, Cloudflare Web
Analytics, Zaraz) ficam bloqueados durante a medição, para as visitas
sintéticas não entrarem nas estatísticas. Os scripts carregam; só o envio não
sai. Em produção, a Cloudflare injeta o Zaraz e o beacon dela no HTML; no
servidor local eles não existem.

## As flags de efeitos

Toda página lê `?fx=` no `<head>`, antes do primeiro pixel, e põe as classes
em `<html>`:

| `?fx=` | Desliga |
|---|---|
| `full` | nada: tudo ligado, inclusive no celular |
| `lite` | céu animado (fica parado), brilho e halo do título, vidro (`backdrop-filter`), Lenis |
| `min` | o de `lite`, mais GSAP (coreografia e parallax), loops de vídeo e o giro do grafo do About |
| `no-sky`, `no-foil`, `no-halo`, `no-shimmer`, `no-glass`, `no-lenis`, `no-motion`, `no-video` | um efeito só, para medir quanto ele custa |

Sem `?fx=`, o padrão é decidido pelo aparelho:

- **economia de dados ligada** (`Save-Data`) ou **até 2 GB de memória**
  (`navigator.deviceMemory`, só nos navegadores Chromium): `lite`;
- **tela de toque** (`pointer: coarse`): tudo ligado, menos a animação do céu,
  que fica parado. Medido em outubro de 2026 na Home, num celular emulado (CPU
  4x mais lenta): com o céu animado, a página parada ocupava 92% da thread
  principal e a rolagem entregava 42% dos quadros; com o céu parado, 38% e 100%;
- o resto: tudo ligado.

Os efeitos leem as classes `fx-no-<efeito>`: o CSS no fim de
`assets/css/main.css`, e `sky.js`, `smooth-scroll.js`, `motion.js`,
`network.js`, `home.js` e `main.js` (o brilho do título) no JavaScript.
