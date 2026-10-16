# Medição fx-depois

2026-10-16 19:42 UTC, http://127.0.0.1:3000/, git 252e7a4 (com mudanças locais). Mediana de 2 execuções por página e perfil.
Edge Edg/155.0.4283.60, Lighthouse 13.5.0, 13th Gen Intel(R) Core(TM) i7-13620H (16 threads, 15.6 GB), GPU Intel(R) UHD Graphics + NVIDIA GeForce RTX 4060 Laptop GPU, tela de 164 Hz (6.1 ms por quadro).

LH, FCP, LCP, TBT, CLS e SI são do Lighthouse (simulado). KB e pedidos são da rede real da execução. "parado" é a página no topo por 5 s sem ninguém mexer; "rolagem" é a página rolada inteira, até 12.000 px a 1.500 px/s. "principal %" e "GPU %" são o tempo ocupado da thread principal da página e da thread principal da GPU. "quadros %" é a parte dos quadros que a tela esperava e recebeu. "toque" é o tempo do toque no menu até o quadro seguinte.

## Computador

| página | KB | pedidos | parado: principal % | parado: GPU % | parado: rAF/s | rolagem: fps | rolagem: quadros % | rolagem: p95 ms | engasgos >50ms | rolagem: principal % | rolagem: GPU % | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home | 673 | 45 | 21.4 | 29.3 | 222 | 160 | 98 | 6.2 | 2 | 24 | 20 | 6.3 |
| cern | 1957 | 38 | 8.7 | 0.2 | 4 | 160 | 98 | 6.2 | 6 | 27 | 20 | 2.7 |

## Celular

| página | KB | pedidos | parado: principal % | parado: GPU % | parado: rAF/s | rolagem: fps | rolagem: quadros % | rolagem: p95 ms | engasgos >50ms | rolagem: principal % | rolagem: GPU % | toque ms | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home | 629 | 44 | 92.3 | 32.6 | 101 | 68 | 42 | 27.4 | 6 | 95 | 32 | 96 | 5.9 |
| cern | 1950 | 37 | 24.5 | 0.1 | 4 | 165 | 100 | 6.2 | 0 | 28 | 0 | 32 | 2.9 |
