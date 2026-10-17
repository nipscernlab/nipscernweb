# Medição hero-depois

2026-10-17 00:56 UTC, http://127.0.0.1:3000/, git c7e0e01 (com mudanças locais). Mediana de 2 execuções por página e perfil.
Edge Edg/155.0.4283.60, Lighthouse 13.5.0, 13th Gen Intel(R) Core(TM) i7-13620H (16 threads, 15.6 GB), GPU Intel(R) UHD Graphics + NVIDIA GeForce RTX 4060 Laptop GPU, tela de 164 Hz (6.1 ms por quadro).

LH, FCP, LCP, TBT, CLS e SI são do Lighthouse (simulado). KB e pedidos são da rede real da execução. "parado" é a página no topo por 5 s sem ninguém mexer; "rolagem" é a página rolada inteira, até 12.000 px a 1.500 px/s. "principal %" e "GPU %" são o tempo ocupado da thread principal da página e da thread principal da GPU. "quadros %" é a parte dos quadros que a tela esperava e recebeu. "toque" é o tempo do toque no menu até o quadro seguinte.

## Computador

| página |  |
|---||

## Celular

| página | LH | FCP ms | LCP ms | TBT ms | CLS | SI ms |
|---|---:|---:|---:|---:|---:|---:|
| about | 88 | 2159 | 3215 | 188 | 0.000 | 2205 |
| cern | 95 | 1772 | 2791 | 3 | 0.000 | 2062 |
| projects | 99 | 1206 | 2142 | 1 | 0.000 | 1266 |
| publications | 97 | 1773 | 2485 | 35 | 0.000 | 2120 |
| news | 94 | 1212 | 2460 | 16 | 0.100 | 1368 |
