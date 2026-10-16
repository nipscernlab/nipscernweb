# Medição prod-antes

2026-10-16 19:54 UTC, https://www.nipscern.com/, git 252e7a4 (com mudanças locais). Mediana de 2 execuções por página e perfil.
Edge Edg/155.0.4283.60, Lighthouse 13.5.0, 13th Gen Intel(R) Core(TM) i7-13620H (16 threads, 15.6 GB), GPU Intel(R) UHD Graphics + NVIDIA GeForce RTX 4060 Laptop GPU, tela de 164 Hz (6.1 ms por quadro).

LH, FCP, LCP, TBT, CLS e SI são do Lighthouse (simulado). KB e pedidos são da rede real da execução. "parado" é a página no topo por 5 s sem ninguém mexer; "rolagem" é a página rolada inteira, até 12.000 px a 1.500 px/s. "principal %" e "GPU %" são o tempo ocupado da thread principal da página e da thread principal da GPU. "quadros %" é a parte dos quadros que a tela esperava e recebeu. "toque" é o tempo do toque no menu até o quadro seguinte.

## Computador

| página | LH | FCP ms | LCP ms | TBT ms | CLS | SI ms | KB | pedidos | parado: principal % | parado: GPU % | parado: rAF/s | rolagem: fps | rolagem: quadros % | rolagem: p95 ms | engasgos >50ms | rolagem: principal % | rolagem: GPU % | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home | 99 | 705 | 994 | 0 | 0.000 | 705 | 763 | 49 | 39.0 | 70.9 | 487 | 126 | 77 | 12.2 | 4 | 62 | 71 | 8.1 |
| about | 94 | 658 | 1593 | 0 | 0.000 | 1033 | 754 | 44 | 11.3 | 19.1 | 333 | 161 | 98 | 6.2 | 2 | 10 | 13 | 4.0 |
| cern | 96 | 684 | 1356 | 0 | 0.000 | 799 | 2009 | 45 | 7.4 | 5.8 | 334 | 163 | 100 | 6.2 | 1 | 22 | 13 | 3.1 |
| projects | 100 | 489 | 593 | 0 | 0.000 | 489 | 255 | 37 | 1.7 | 0.0 | 0 | 165 | 100 | 6.2 | 0 | 3 | 5 | 1.2 |
| sapho | 93 | 583 | 1744 | 0 | 0.000 | 640 | 774 | 53 | 15.1 | 22.0 | 530 | 165 | 100 | 6.2 | 0 | 13 | 11 | 10.8 |
| cgv | 81 | 701 | 877 | 477 | 0.000 | 717 | 1296 | 41 | 2.9 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 4 | 6 | 17.5 |
| publications | 79 | 546 | 725 | 0 | 0.500 | 548 | 356 | 40 | 3.3 | 0.5 | 0 | 165 | 100 | 6.2 | 0 | 6 | 16 | 1.8 |
| news-post | 72 | 602 | 1695 | 0 | 0.500 | 659 | 850 | 44 | 1.9 | 0.1 | 169 | 164 | 100 | 6.2 | 0 | 8 | 9 | 2.6 |
| noodle | 85 | 505 | 619 | 0 | 0.300 | 505 | 504 | 37 | 3.6 | 0.1 | 0 | 163 | 99 | 6.2 | 0 | 5 | 10 | 3.3 |
| course-ea1 | 99 | 454 | 1041 | 0 | 0.000 | 454 | 359 | 42 | 3.8 | 0.1 | 0 | 162 | 99 | 6.2 | 0 | 7 | 12 | 1.2 |

## Celular

| página | LH | FCP ms | LCP ms | TBT ms | CLS | SI ms | KB | pedidos | parado: principal % | parado: GPU % | parado: rAF/s | rolagem: fps | rolagem: quadros % | rolagem: p95 ms | engasgos >50ms | rolagem: principal % | rolagem: GPU % | toque ms | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home | 88 | 2058 | 3711 | 0 | 0.000 | 2164 | 715 | 48 | 97.5 | 36.7 | 204 | 96 | 59 | 18.2 | 1 | 98 | 36 | 84 | 6.9 |
| about | 84 | 2373 | 4592 | 84 | 0.000 | 2602 | 754 | 43 | 51.3 | 14.4 | 334 | 165 | 100 | 6.2 | 0 | 53 | 14 | 68 | 6.6 |
| cern | 76 | 2571 | 5611 | 18 | 0.000 | 3279 | 1999 | 44 | 24.0 | 3.6 | 169 | 165 | 100 | 6.2 | 0 | 26 | 4 | 40 | 3.2 |
| projects | 98 | 1757 | 2328 | 0 | 0.000 | 1757 | 220 | 32 | 6.8 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 7 | 0 | 28 | 1.3 |
| sapho | 73 | 2093 | 7181 | 117 | 0.000 | 2359 | 765 | 52 | 64.0 | 6.4 | 339 | 159 | 97 | 9.1 | 0 | 68 | 7 | 60 | 8.6 |
| cgv | 64 | 1811 | 3004 | 3430 | 0.000 | 1811 | 1295 | 41 | 21.8 | 0.1 | 0 | 165 | 100 | 6.2 | 1 | 28 | 0 | 56 | 16.3 |
| publications | 64 | 1873 | 4739 | 40 | 0.400 | 1873 | 356 | 40 | 16.3 | 0.0 | 0 | 165 | 100 | 6.2 | 0 | 10 | 0 | 40 | 5.2 |
| news-post | 51 | 1927 | 7024 | 91 | 0.700 | 2084 | 850 | 44 | 21.9 | 0.1 | 168 | 165 | 100 | 6.2 | 0 | 27 | 0 | 52 | 2.0 |
| noodle | 83 | 1713 | 2463 | 5 | 0.300 | 1713 | 544 | 40 | 26.9 | 0.0 | 0 | 165 | 100 | 6.2 | 0 | 27 | 0 | 52 | 3.3 |
| course-ea1 | 89 | 1554 | 3738 | 12 | 0.000 | 1554 | 335 | 41 | 25.6 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 32 | 0 | 52 | 1.3 |
