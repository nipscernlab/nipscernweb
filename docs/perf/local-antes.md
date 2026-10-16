# Medição local-antes

2026-10-16 18:34 UTC, http://127.0.0.1:3001/, git 252e7a4 (com mudanças locais). Mediana de 2 execuções por página e perfil.
Edge Edg/155.0.4283.45, Lighthouse 13.5.0, 13th Gen Intel(R) Core(TM) i7-13620H (16 threads, 15.6 GB), GPU Intel(R) UHD Graphics + NVIDIA GeForce RTX 4060 Laptop GPU, tela de 164 Hz (6.1 ms por quadro).

LH, FCP, LCP, TBT, CLS e SI são do Lighthouse (simulado). KB e pedidos são da rede real da execução. "parado" é a página no topo por 5 s sem ninguém mexer; "rolagem" é a página rolada inteira, até 12.000 px a 1.500 px/s. "principal %" e "GPU %" são o tempo ocupado da thread principal da página e da thread principal da GPU. "quadros %" é a parte dos quadros que a tela esperava e recebeu. "toque" é o tempo do toque no menu até o quadro seguinte.

## Computador

| página | LH | FCP ms | LCP ms | TBT ms | CLS | SI ms | KB | pedidos | parado: principal % | parado: GPU % | parado: rAF/s | rolagem: fps | rolagem: quadros % | rolagem: p95 ms | engasgos >50ms | rolagem: principal % | rolagem: GPU % | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home | 93 | 327 | 694 | 0 | 0.200 | 584 | 790 | 46 | 47.7 | 94.3 | 473 | 158 | 96 | 6.2 | 1 | 26 | 26 | 5.0 |
| about | 100 | 321 | 591 | 19 | 0.000 | 759 | 669 | 37 | 10.9 | 16.0 | 333 | 160 | 97 | 6.2 | 1 | 11 | 14 | 3.7 |
| cern | 97 | 424 | 1292 | 0 | 0.000 | 825 | 1955 | 38 | 13.4 | 9.6 | 334 | 159 | 97 | 6.2 | 5 | 35 | 23 | 2.7 |
| projects | 100 | 306 | 629 | 0 | 0.000 | 481 | 260 | 30 | 2.9 | 0.1 | 0 | 164 | 100 | 6.2 | 0 | 4 | 8 | 1.0 |
| sapho | 98 | 469 | 1068 | 5 | 0.000 | 663 | 713 | 46 | 19.5 | 27.5 | 538 | 163 | 99 | 6.2 | 1 | 11 | 12 | 8.1 |
| cgv | 100 | 405 | 605 | 0 | 0.000 | 467 | 316 | 28 | 3.6 | 0.3 | 0 | 164 | 100 | 6.2 | 0 | 5 | 9 | 1.3 |
| publications | 78 | 387 | 804 | 0 | 0.500 | 457 | 335 | 34 | 1.8 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 4 | 10 | 1.5 |
| news-post | 76 | 306 | 1222 | 0 | 0.500 | 411 | 794 | 37 | 1.8 | 0.1 | 169 | 163 | 100 | 6.2 | 2 | 6 | 8 | 2.3 |
| noodle | 85 | 305 | 448 | 0 | 0.300 | 434 | 465 | 30 | 2.1 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 5 | 8 | 3.0 |
| course-ea1 | 99 | 408 | 840 | 0 | 0.000 | 461 | 328 | 35 | 3.3 | 0.1 | 0 | 164 | 100 | 6.2 | 0 | 6 | 8 | 1.0 |

## Celular

| página | LH | FCP ms | LCP ms | TBT ms | CLS | SI ms | KB | pedidos | parado: principal % | parado: GPU % | parado: rAF/s | rolagem: fps | rolagem: quadros % | rolagem: p95 ms | engasgos >50ms | rolagem: principal % | rolagem: GPU % | toque ms | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home | 79 | 1239 | 3278 | 133 | 0.200 | 2252 | 743 | 45 | 97.9 | 31.3 | 108 | 44 | 27 | 30.5 | 1 | 98 | 29 | 140 | 8.2 |
| about | 68 | 1609 | 4967 | 631 | 0.000 | 2506 | 669 | 36 | 62.9 | 18.6 | 316 | 153 | 94 | 9.2 | 1 | 68 | 17 | 68 | 5.3 |
| cern | 82 | 1963 | 5269 | 45 | 0.000 | 3357 | 1948 | 37 | 68.6 | 9.1 | 161 | 150 | 92 | 9.2 | 1 | 76 | 9 | 84 | 2.8 |
| projects | 98 | 1130 | 2375 | 8 | 0.000 | 1158 | 197 | 25 | 18.3 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 20 | 0 | 52 | 1.0 |
| sapho | 84 | 1958 | 4329 | 94 | 0.000 | 2110 | 705 | 45 | 50.0 | 4.9 | 348 | 152 | 93 | 9.2 | 1 | 65 | 6 | 72 | 8.6 |
| cgv | 95 | 1842 | 2855 | 0 | 0.000 | 1842 | 316 | 28 | 15.3 | 0.0 | 0 | 165 | 100 | 6.2 | 0 | 8 | 0 | 28 | 1.4 |
| publications | 82 | 1582 | 3361 | 23 | 0.200 | 1582 | 335 | 34 | 12.0 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 9 | 0 | 48 | 1.5 |
| news-post | 55 | 1206 | 5750 | 79 | 0.700 | 1295 | 794 | 37 | 7.3 | 0.0 | 169 | 165 | 100 | 6.2 | 0 | 9 | 0 | 28 | 1.9 |
| noodle | 85 | 1280 | 2105 | 0 | 0.300 | 1322 | 506 | 33 | 17.7 | 0.0 | 0 | 165 | 100 | 6.2 | 0 | 22 | 0 | 44 | 3.3 |
| course-ea1 | 91 | 1772 | 3403 | 23 | 0.000 | 1772 | 304 | 34 | 17.7 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 13 | 0 | 40 | 1.0 |
