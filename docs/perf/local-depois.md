# Medição local-depois

2026-10-16 20:21 UTC, http://127.0.0.1:3000/, git 252e7a4 (com mudanças locais). Mediana de 2 execuções por página e perfil.
Edge Edg/155.0.4283.60, Lighthouse 13.5.0, 13th Gen Intel(R) Core(TM) i7-13620H (16 threads, 15.6 GB), GPU Intel(R) UHD Graphics + NVIDIA GeForce RTX 4060 Laptop GPU, tela de 164 Hz (6.1 ms por quadro).

LH, FCP, LCP, TBT, CLS e SI são do Lighthouse (simulado). KB e pedidos são da rede real da execução. "parado" é a página no topo por 5 s sem ninguém mexer; "rolagem" é a página rolada inteira, até 12.000 px a 1.500 px/s. "principal %" e "GPU %" são o tempo ocupado da thread principal da página e da thread principal da GPU. "quadros %" é a parte dos quadros que a tela esperava e recebeu. "toque" é o tempo do toque no menu até o quadro seguinte.

## Computador

| página | LH | FCP ms | LCP ms | TBT ms | CLS | SI ms | KB | pedidos | parado: principal % | parado: GPU % | parado: rAF/s | rolagem: fps | rolagem: quadros % | rolagem: p95 ms | engasgos >50ms | rolagem: principal % | rolagem: GPU % | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home | 93 | 329 | 770 | 0 | 0.200 | 541 | 673 | 45 | 30.9 | 48.1 | 223 | 158 | 97 | 6.2 | 2 | 34 | 29 | 9.4 |
| about | 100 | 367 | 571 | 18 | 0.000 | 715 | 671 | 37 | 5.8 | 4.1 | 169 | 160 | 97 | 6.2 | 2 | 12 | 16 | 3.7 |
| cern | 97 | 449 | 1252 | 0 | 0.000 | 632 | 1957 | 38 | 7.3 | 0.2 | 4 | 163 | 100 | 6.2 | 1 | 20 | 15 | 2.7 |
| projects | 100 | 306 | 655 | 0 | 0.000 | 467 | 262 | 30 | 2.8 | 0.2 | 0 | 163 | 99 | 6.2 | 0 | 5 | 10 | 1.0 |
| sapho | 98 | 472 | 1071 | 10 | 0.000 | 650 | 714 | 46 | 22.0 | 52.8 | 203 | 162 | 99 | 6.2 | 1 | 13 | 14 | 9.9 |
| cgv | 100 | 407 | 607 | 0 | 0.000 | 468 | 317 | 28 | 4.4 | 0.1 | 0 | 163 | 100 | 6.2 | 0 | 7 | 10 | 1.3 |
| publications | 100 | 388 | 761 | 0 | 0.000 | 476 | 336 | 34 | 3.0 | 0.1 | 0 | 164 | 100 | 6.2 | 1 | 5 | 14 | 1.5 |
| news-post | 98 | 296 | 1144 | 0 | 0.100 | 542 | 795 | 37 | 3.5 | 0.0 | 4 | 163 | 99 | 6.2 | 0 | 11 | 12 | 2.4 |
| noodle | 100 | 305 | 446 | 0 | 0.000 | 445 | 466 | 30 | 3.3 | 0.1 | 0 | 163 | 100 | 6.2 | 0 | 5 | 9 | 2.9 |
| course-ea1 | 100 | 405 | 828 | 0 | 0.000 | 466 | 330 | 35 | 3.2 | 0.0 | 0 | 163 | 99 | 6.2 | 1 | 5 | 9 | 1.0 |

## Celular

| página | LH | FCP ms | LCP ms | TBT ms | CLS | SI ms | KB | pedidos | parado: principal % | parado: GPU % | parado: rAF/s | rolagem: fps | rolagem: quadros % | rolagem: p95 ms | engasgos >50ms | rolagem: principal % | rolagem: GPU % | toque ms | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home | 83 | 1282 | 3387 | 21 | 0.200 | 2019 | 629 | 44 | 51.6 | 11.4 | 29 | 165 | 100 | 6.2 | 0 | 57 | 11 | 60 | 3.0 |
| about | 95 | 1809 | 2636 | 123 | 0.000 | 2091 | 671 | 36 | 23.9 | 2.6 | 169 | 165 | 100 | 6.2 | 0 | 48 | 6 | 56 | 5.0 |
| cern | 84 | 1962 | 5114 | 2 | 0.000 | 2700 | 1950 | 37 | 39.3 | 0.2 | 4 | 165 | 100 | 6.2 | 0 | 35 | 0 | 32 | 2.9 |
| projects | 98 | 1130 | 2348 | 19 | 0.000 | 1162 | 199 | 25 | 23.8 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 24 | 0 | 52 | 1.0 |
| sapho | 80 | 1922 | 4333 | 222 | 0.000 | 2046 | 707 | 45 | 78.0 | 7.3 | 134 | 114 | 70 | 15.2 | 2 | 87 | 8 | 100 | 8.6 |
| cgv | 95 | 1844 | 2744 | 1 | 0.000 | 1844 | 317 | 28 | 28.4 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 29 | 0 | 56 | 1.4 |
| publications | 91 | 1585 | 3414 | 60 | 0.000 | 1585 | 273 | 29 | 14.5 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 14 | 0 | 52 | 1.5 |
| news-post | 79 | 1130 | 5714 | 66 | 0.000 | 1648 | 795 | 37 | 19.5 | 0.0 | 4 | 165 | 100 | 6.2 | 0 | 28 | 0 | 48 | 2.8 |
| noodle | 99 | 1281 | 2105 | 14 | 0.000 | 1361 | 507 | 33 | 20.0 | 0.0 | 0 | 165 | 100 | 6.2 | 0 | 18 | 0 | 52 | 3.1 |
| course-ea1 | 91 | 1881 | 3326 | 2 | 0.000 | 1881 | 306 | 34 | 22.5 | 0.1 | 0 | 165 | 100 | 6.2 | 0 | 26 | 0 | 56 | 1.0 |
