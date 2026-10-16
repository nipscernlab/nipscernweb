# Medição final-icones-sapho

2026-10-16 22:11 UTC, http://127.0.0.1:3000/, git 49970c6 (com mudanças locais). Mediana de 2 execuções por página e perfil.
Edge Edg/155.0.4283.60, Lighthouse 13.5.0, 13th Gen Intel(R) Core(TM) i7-13620H (16 threads, 15.6 GB), GPU Intel(R) UHD Graphics + NVIDIA GeForce RTX 4060 Laptop GPU, tela de 164 Hz (6.1 ms por quadro).

LH, FCP, LCP, TBT, CLS e SI são do Lighthouse (simulado). KB e pedidos são da rede real da execução. "parado" é a página no topo por 5 s sem ninguém mexer; "rolagem" é a página rolada inteira, até 12.000 px a 1.500 px/s. "principal %" e "GPU %" são o tempo ocupado da thread principal da página e da thread principal da GPU. "quadros %" é a parte dos quadros que a tela esperava e recebeu. "toque" é o tempo do toque no menu até o quadro seguinte.

## Computador

| página |  |
|---||

## Celular

| página | LH | FCP ms | LCP ms | TBT ms | CLS | SI ms | KB | pedidos | parado: principal % | parado: GPU % | parado: rAF/s | rolagem: fps | rolagem: quadros % | rolagem: p95 ms | engasgos >50ms | rolagem: principal % | rolagem: GPU % | toque ms | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home | 79 | 1206 | 3515 | 24 | 0.200 | 1753 | 631 | 45 | 24.8 | 6.5 | 29 | 165 | 100 | 6.2 | 0 | 28 | 7 | 36 | 6.0 |
| about | 95 | 1508 | 2716 | 104 | 0.000 | 1699 | 673 | 37 | 19.8 | 2.2 | 169 | 165 | 100 | 6.2 | 1 | 30 | 5 | 32 | 5.0 |
| sapho | 82 | 1881 | 4629 | 89 | 0.000 | 1881 | 710 | 46 | 21.5 | 1.5 | 185 | 164 | 100 | 6.2 | 0 | 24 | 1 | 28 | 8.6 |
| publications | 91 | 1807 | 3314 | 7 | 0.000 | 1807 | 291 | 31 | 9.9 | 0.0 | 0 | 165 | 100 | 6.2 | 1 | 10 | 0 | 32 | 2.6 |
