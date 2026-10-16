# http://127.0.0.1:3001/ (docs/perf/local-antes.json) → http://127.0.0.1:3000/ (docs/perf/local-depois.json)

Antes: git 252e7a4 (com mudanças locais), 2026-10-16T18:34. Depois: git 252e7a4 (com mudanças locais), 2026-10-16T20:21. Medianas de 2 e 2 execuções. ✔ melhorou além do ruído, ✘ piorou além do ruído.

## home, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 93 | 93 | 0 (0%) |  |
| LCP ms | 694 | 770 | +76.3 (+11%) |  |
| TBT ms | 0 | 0 | 0 |  |
| Speed Index ms | 584 | 541 | -42.6 (-7%) |  |
| CLS | 0.2 | 0.2 | 0 (0%) |  |
| KB transferidos | 790 | 673 | -116 (-15%) | ✔ |
| parado: thread principal % | 47.7 | 30.9 | -16.8 (-35%) | ✔ |
| parado: GPU % | 94.3 | 48.1 | -46.2 (-49%) | ✔ |
| parado: rAF por s | 473 | 223 | -250 (-53%) | ✔ |
| rolagem: fps | 158 | 158 | +0.7 (+0%) |  |
| rolagem: quadros entregues % | 96.1 | 96.6 | +0.5 (+1%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 1 | 2 | +1 (+100%) |  |
| rolagem: thread principal % | 26.2 | 34.3 | +8.1 (+31%) | ✘ |
| rolagem: GPU % | 26.1 | 29.3 | +3.2 (+12%) | ✘ |
| heap JS MB | 5 | 9.4 | +4.4 (+88%) | ✘ |

## home, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 79 | 83 | +4 (+5%) |  |
| LCP ms | 3278 | 3387 | +109 (+3%) |  |
| TBT ms | 133 | 20.5 | -112 (-85%) | ✔ |
| Speed Index ms | 2252 | 2019 | -233 (-10%) |  |
| CLS | 0.2 | 0.2 | 0 (0%) |  |
| KB transferidos | 743 | 629 | -114 (-15%) | ✔ |
| parado: thread principal % | 97.9 | 51.6 | -46.3 (-47%) | ✔ |
| parado: GPU % | 31.3 | 11.4 | -19.9 (-64%) | ✔ |
| parado: rAF por s | 108 | 28.8 | -79.2 (-73%) | ✔ |
| rolagem: fps | 43.7 | 165 | +121 (+277%) | ✔ |
| rolagem: quadros entregues % | 26.7 | 100 | +73.3 (+275%) | ✔ |
| rolagem: p95 do quadro ms | 30.5 | 6.2 | -24.3 (-80%) | ✔ |
| rolagem: engasgos >50 ms | 0.5 | 0 | -0.5 (-100%) |  |
| rolagem: thread principal % | 97.9 | 57.1 | -40.8 (-42%) | ✔ |
| rolagem: GPU % | 28.8 | 11.1 | -17.7 (-61%) | ✔ |
| toque no menu ms | 140 | 60 | -80 (-57%) | ✔ |
| heap JS MB | 8.2 | 3 | -5.2 (-63%) | ✔ |

## about, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 100 | 100 | 0 (0%) |  |
| LCP ms | 591 | 571 | -19.9 (-3%) |  |
| TBT ms | 18.8 | 17.7 | -1.1 (-6%) |  |
| Speed Index ms | 759 | 715 | -43.7 (-6%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 669 | 671 | +1.8 (+0%) |  |
| parado: thread principal % | 10.9 | 5.8 | -5.1 (-47%) | ✔ |
| parado: GPU % | 16 | 4.1 | -11.9 (-74%) | ✔ |
| parado: rAF por s | 333 | 169 | -164 (-49%) | ✔ |
| rolagem: fps | 160 | 160 | -0.1 (0%) |  |
| rolagem: quadros entregues % | 97.4 | 97.3 | -0.1 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 1 | 1.5 | +0.5 (+50%) |  |
| rolagem: thread principal % | 10.6 | 11.5 | +0.9 (+8%) |  |
| rolagem: GPU % | 14.3 | 16 | +1.7 (+12%) |  |
| heap JS MB | 3.7 | 3.7 | 0 (0%) |  |

## about, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 67.5 | 94.5 | +27 (+40%) | ✔ |
| LCP ms | 4967 | 2636 | -2330 (-47%) | ✔ |
| TBT ms | 631 | 123 | -508 (-81%) | ✔ |
| Speed Index ms | 2506 | 2091 | -415 (-17%) | ✔ |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 669 | 671 | +1.7 (+0%) |  |
| parado: thread principal % | 62.9 | 23.9 | -39 (-62%) | ✔ |
| parado: GPU % | 18.6 | 2.6 | -16 (-86%) | ✔ |
| parado: rAF por s | 316 | 169 | -147 (-47%) | ✔ |
| rolagem: fps | 153 | 165 | +11.3 (+7%) |  |
| rolagem: quadros entregues % | 93.6 | 100 | +6.4 (+7%) |  |
| rolagem: p95 do quadro ms | 9.2 | 6.2 | -3 (-33%) | ✔ |
| rolagem: engasgos >50 ms | 1 | 0 | -1 (-100%) |  |
| rolagem: thread principal % | 67.8 | 48.3 | -19.5 (-29%) | ✔ |
| rolagem: GPU % | 17 | 6.4 | -10.6 (-62%) | ✔ |
| toque no menu ms | 68 | 56 | -12 (-18%) |  |
| heap JS MB | 5.3 | 5 | -0.3 (-6%) |  |

## cern, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 96.5 | 97 | +0.5 (+1%) |  |
| LCP ms | 1292 | 1252 | -40.7 (-3%) |  |
| TBT ms | 0 | 0 | 0 |  |
| Speed Index ms | 825 | 632 | -193 (-23%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 1955 | 1957 | +1.8 (+0%) |  |
| parado: thread principal % | 13.4 | 7.3 | -6.1 (-46%) | ✔ |
| parado: GPU % | 9.6 | 0.2 | -9.4 (-98%) | ✔ |
| parado: rAF por s | 334 | 4.1 | -330 (-99%) | ✔ |
| rolagem: fps | 159 | 163 | +4.3 (+3%) |  |
| rolagem: quadros entregues % | 96.9 | 99.5 | +2.6 (+3%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 5 | 1 | -4 (-80%) | ✔ |
| rolagem: thread principal % | 35.2 | 19.9 | -15.3 (-43%) | ✔ |
| rolagem: GPU % | 22.5 | 15.1 | -7.4 (-33%) | ✔ |
| heap JS MB | 2.7 | 2.7 | 0 (0%) |  |

## cern, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 82 | 83.5 | +1.5 (+2%) |  |
| LCP ms | 5269 | 5114 | -156 (-3%) |  |
| TBT ms | 44.5 | 1.5 | -43 (-97%) | ✔ |
| Speed Index ms | 3357 | 2700 | -657 (-20%) | ✔ |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 1948 | 1950 | +1.8 (+0%) |  |
| parado: thread principal % | 68.6 | 39.3 | -29.3 (-43%) | ✔ |
| parado: GPU % | 9.1 | 0.2 | -8.9 (-98%) | ✔ |
| parado: rAF por s | 161 | 3.9 | -157 (-98%) | ✔ |
| rolagem: fps | 150 | 165 | +14.6 (+10%) |  |
| rolagem: quadros entregues % | 91.7 | 100 | +8.3 (+9%) |  |
| rolagem: p95 do quadro ms | 9.2 | 6.2 | -3 (-33%) | ✔ |
| rolagem: engasgos >50 ms | 1 | 0 | -1 (-100%) |  |
| rolagem: thread principal % | 75.8 | 35.4 | -40.4 (-53%) | ✔ |
| rolagem: GPU % | 8.7 | 0.1 | -8.6 (-99%) | ✔ |
| toque no menu ms | 84 | 32 | -52 (-62%) | ✔ |
| heap JS MB | 2.8 | 2.9 | +0.1 (+4%) |  |

## projects, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 100 | 100 | 0 (0%) |  |
| LCP ms | 629 | 655 | +26.5 (+4%) |  |
| TBT ms | 0 | 0 | 0 |  |
| Speed Index ms | 481 | 467 | -14.2 (-3%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 260 | 262 | +1.5 (+1%) |  |
| parado: thread principal % | 2.9 | 2.8 | -0.1 (-3%) |  |
| parado: GPU % | 0.1 | 0.2 | +0.1 (+100%) |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 164 | 163 | -1.1 (-1%) |  |
| rolagem: quadros entregues % | 100 | 99.4 | -0.6 (-1%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0 | 0 |  |
| rolagem: thread principal % | 4.3 | 4.8 | +0.5 (+12%) |  |
| rolagem: GPU % | 8 | 9.6 | +1.6 (+20%) |  |
| heap JS MB | 1 | 1 | 0 (0%) |  |

## projects, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 98 | 98 | 0 (0%) |  |
| LCP ms | 2375 | 2348 | -27.2 (-1%) |  |
| TBT ms | 7.5 | 19.4 | +11.9 (+159%) |  |
| Speed Index ms | 1158 | 1162 | +4.1 (+0%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 197 | 199 | +1.5 (+1%) |  |
| parado: thread principal % | 18.3 | 23.8 | +5.5 (+30%) | ✘ |
| parado: GPU % | 0.1 | 0.1 | 0 (0%) |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 165 | 165 | -0.1 (0%) |  |
| rolagem: quadros entregues % | 100 | 100 | 0 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0 | 0 |  |
| rolagem: thread principal % | 19.7 | 24.1 | +4.4 (+22%) | ✘ |
| rolagem: GPU % | 0 | 0.1 | +0.1 |  |
| toque no menu ms | 52 | 52 | 0 (0%) |  |
| heap JS MB | 1 | 1 | 0 (0%) |  |

## sapho, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 98 | 98 | 0 (0%) |  |
| LCP ms | 1068 | 1071 | +2.6 (+0%) |  |
| TBT ms | 4.8 | 10 | +5.2 (+108%) |  |
| Speed Index ms | 663 | 650 | -12.6 (-2%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 713 | 714 | +1.6 (+0%) |  |
| parado: thread principal % | 19.5 | 22 | +2.5 (+13%) |  |
| parado: GPU % | 27.5 | 52.8 | +25.3 (+92%) | ✘ |
| parado: rAF por s | 538 | 203 | -335 (-62%) | ✔ |
| rolagem: fps | 163 | 162 | -1.1 (-1%) |  |
| rolagem: quadros entregues % | 99.4 | 98.7 | -0.7 (-1%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 1 | 1 | 0 (0%) |  |
| rolagem: thread principal % | 10.9 | 13 | +2.1 (+19%) |  |
| rolagem: GPU % | 12.1 | 13.5 | +1.4 (+12%) |  |
| heap JS MB | 8.1 | 9.9 | +1.8 (+22%) | ✘ |

## sapho, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 83.5 | 80 | -3.5 (-4%) |  |
| LCP ms | 4329 | 4333 | +4.8 (+0%) |  |
| TBT ms | 94 | 222 | +128 (+136%) | ✘ |
| Speed Index ms | 2110 | 2046 | -64.2 (-3%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 705 | 707 | +1.6 (+0%) |  |
| parado: thread principal % | 50 | 78 | +28 (+56%) | ✘ |
| parado: GPU % | 4.9 | 7.3 | +2.4 (+49%) |  |
| parado: rAF por s | 348 | 134 | -214 (-62%) | ✔ |
| rolagem: fps | 152 | 114 | -38 (-25%) | ✘ |
| rolagem: quadros entregues % | 92.8 | 69.6 | -23.2 (-25%) | ✘ |
| rolagem: p95 do quadro ms | 9.2 | 15.2 | +6 (+65%) | ✘ |
| rolagem: engasgos >50 ms | 0.5 | 2 | +1.5 (+300%) | ✘ |
| rolagem: thread principal % | 65.1 | 87.1 | +22 (+34%) | ✘ |
| rolagem: GPU % | 6.1 | 8 | +1.9 (+31%) |  |
| toque no menu ms | 72 | 100 | +28 (+39%) | ✘ |
| heap JS MB | 8.6 | 8.6 | 0 (0%) |  |

## cgv, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 100 | 100 | 0 (0%) |  |
| LCP ms | 605 | 607 | +1.7 (+0%) |  |
| TBT ms | 0 | 0 | 0 |  |
| Speed Index ms | 467 | 468 | +1.8 (+0%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 316 | 317 | +1.4 (+0%) |  |
| parado: thread principal % | 3.6 | 4.4 | +0.8 (+22%) |  |
| parado: GPU % | 0.3 | 0.1 | -0.2 (-67%) |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 164 | 163 | -0.5 (0%) |  |
| rolagem: quadros entregues % | 100 | 99.7 | -0.3 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0 | 0 |  |
| rolagem: thread principal % | 5.1 | 6.5 | +1.4 (+27%) |  |
| rolagem: GPU % | 8.8 | 10.2 | +1.4 (+16%) |  |
| heap JS MB | 1.3 | 1.3 | 0 (0%) |  |

## cgv, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 94.5 | 94.5 | 0 (0%) |  |
| LCP ms | 2855 | 2744 | -111 (-4%) |  |
| TBT ms | 0 | 1 | +1 |  |
| Speed Index ms | 1842 | 1844 | +1.6 (+0%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 316 | 317 | +1.5 (+0%) |  |
| parado: thread principal % | 15.3 | 28.4 | +13.1 (+86%) | ✘ |
| parado: GPU % | 0 | 0.1 | +0.1 |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 165 | 165 | 0 (0%) |  |
| rolagem: quadros entregues % | 100 | 100 | 0 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0 | 0 |  |
| rolagem: thread principal % | 7.7 | 28.6 | +20.9 (+271%) | ✘ |
| rolagem: GPU % | 0 | 0 | 0 |  |
| toque no menu ms | 28 | 56 | +28 (+100%) | ✘ |
| heap JS MB | 1.4 | 1.4 | 0 (0%) |  |

## publications, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 78 | 100 | +22 (+28%) | ✔ |
| LCP ms | 804 | 761 | -43.2 (-5%) |  |
| TBT ms | 0 | 0 | 0 |  |
| Speed Index ms | 457 | 476 | +18.7 (+4%) |  |
| CLS | 0.5 | 0 | -0.5 (-100%) | ✔ |
| KB transferidos | 335 | 336 | +1.4 (+0%) |  |
| parado: thread principal % | 1.8 | 3 | +1.2 (+67%) |  |
| parado: GPU % | 0.1 | 0.1 | 0 (0%) |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 165 | 164 | -1.1 (-1%) |  |
| rolagem: quadros entregues % | 100 | 99.7 | -0.3 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0.5 | +0.5 |  |
| rolagem: thread principal % | 3.6 | 5.3 | +1.7 (+47%) |  |
| rolagem: GPU % | 9.5 | 13.8 | +4.3 (+45%) | ✘ |
| heap JS MB | 1.5 | 1.5 | 0 (0%) |  |

## publications, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 82 | 90.5 | +8.5 (+10%) | ✔ |
| LCP ms | 3361 | 3414 | +53.1 (+2%) |  |
| TBT ms | 23 | 59.5 | +36.5 (+159%) | ✘ |
| Speed Index ms | 1582 | 1585 | +3.1 (+0%) |  |
| CLS | 0.2 | 0 | -0.2 (-100%) | ✔ |
| KB transferidos | 335 | 273 | -61.6 (-18%) | ✔ |
| parado: thread principal % | 12 | 14.5 | +2.5 (+21%) |  |
| parado: GPU % | 0.1 | 0.1 | 0 (0%) |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 165 | 165 | 0 (0%) |  |
| rolagem: quadros entregues % | 100 | 100 | 0 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0 | 0 |  |
| rolagem: thread principal % | 9.2 | 14 | +4.8 (+52%) | ✘ |
| rolagem: GPU % | 0 | 0 | 0 |  |
| toque no menu ms | 48 | 52 | +4 (+8%) |  |
| heap JS MB | 1.5 | 1.5 | 0 (0%) |  |

## news-post, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 76 | 97.5 | +21.5 (+28%) | ✔ |
| LCP ms | 1222 | 1144 | -77.5 (-6%) |  |
| TBT ms | 0 | 0 | 0 |  |
| Speed Index ms | 411 | 542 | +131 (+32%) |  |
| CLS | 0.5 | 0.1 | -0.4 (-80%) | ✔ |
| KB transferidos | 794 | 795 | +0.9 (+0%) |  |
| parado: thread principal % | 1.8 | 3.5 | +1.7 (+94%) |  |
| parado: GPU % | 0.1 | 0 | -0.1 (-100%) |  |
| parado: rAF por s | 169 | 4 | -165 (-98%) | ✔ |
| rolagem: fps | 163 | 163 | -0.3 (0%) |  |
| rolagem: quadros entregues % | 99.5 | 99.4 | -0.1 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 2 | 0 | -2 (-100%) | ✔ |
| rolagem: thread principal % | 6.1 | 10.8 | +4.7 (+77%) | ✘ |
| rolagem: GPU % | 7.7 | 11.8 | +4.1 (+53%) | ✘ |
| heap JS MB | 2.3 | 2.4 | +0.1 (+4%) |  |

## news-post, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 55 | 79 | +24 (+44%) | ✔ |
| LCP ms | 5750 | 5714 | -36.5 (-1%) |  |
| TBT ms | 78.9 | 65.5 | -13.4 (-17%) |  |
| Speed Index ms | 1295 | 1648 | +353 (+27%) | ✘ |
| CLS | 0.7 | 0 | -0.7 (-100%) | ✔ |
| KB transferidos | 794 | 795 | +0.9 (+0%) |  |
| parado: thread principal % | 7.3 | 19.5 | +12.2 (+167%) | ✘ |
| parado: GPU % | 0 | 0 | 0 |  |
| parado: rAF por s | 169 | 4 | -165 (-98%) | ✔ |
| rolagem: fps | 165 | 165 | 0 (0%) |  |
| rolagem: quadros entregues % | 100 | 100 | 0 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0 | 0 |  |
| rolagem: thread principal % | 9.2 | 27.9 | +18.7 (+203%) | ✘ |
| rolagem: GPU % | 0 | 0 | 0 |  |
| toque no menu ms | 28 | 48 | +20 (+71%) | ✘ |
| heap JS MB | 1.9 | 2.8 | +0.9 (+47%) |  |

## noodle, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 85 | 100 | +15 (+18%) | ✔ |
| LCP ms | 448 | 446 | -1.7 (0%) |  |
| TBT ms | 0 | 0 | 0 |  |
| Speed Index ms | 434 | 445 | +11.2 (+3%) |  |
| CLS | 0.3 | 0 | -0.3 (-100%) | ✔ |
| KB transferidos | 465 | 466 | +1.3 (+0%) |  |
| parado: thread principal % | 2.1 | 3.3 | +1.2 (+57%) |  |
| parado: GPU % | 0.1 | 0.1 | 0 (0%) |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 165 | 163 | -1.2 (-1%) |  |
| rolagem: quadros entregues % | 100 | 99.7 | -0.3 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0 | 0 |  |
| rolagem: thread principal % | 4.6 | 4.5 | -0.1 (-2%) |  |
| rolagem: GPU % | 8.4 | 9.1 | +0.7 (+8%) |  |
| heap JS MB | 3 | 2.9 | -0.1 (-3%) |  |

## noodle, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 85 | 99 | +14 (+16%) | ✔ |
| LCP ms | 2105 | 2105 | +0.7 (+0%) |  |
| TBT ms | 0 | 14 | +14 |  |
| Speed Index ms | 1322 | 1361 | +39.1 (+3%) |  |
| CLS | 0.3 | 0 | -0.3 (-100%) | ✔ |
| KB transferidos | 506 | 507 | +1.5 (+0%) |  |
| parado: thread principal % | 17.7 | 20 | +2.3 (+13%) |  |
| parado: GPU % | 0 | 0 | 0 |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 165 | 165 | +0.1 (+0%) |  |
| rolagem: quadros entregues % | 100 | 100 | 0 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0 | 0 |  |
| rolagem: thread principal % | 21.5 | 17.5 | -4 (-19%) | ✔ |
| rolagem: GPU % | 0.1 | 0.1 | 0 (0%) |  |
| toque no menu ms | 44 | 52 | +8 (+18%) |  |
| heap JS MB | 3.3 | 3.1 | -0.2 (-6%) |  |

## course-ea1, computador

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 99 | 99.5 | +0.5 (+1%) |  |
| LCP ms | 840 | 828 | -11.9 (-1%) |  |
| TBT ms | 0 | 0 | 0 |  |
| Speed Index ms | 461 | 466 | +4.1 (+1%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 328 | 330 | +1.5 (+0%) |  |
| parado: thread principal % | 3.3 | 3.2 | -0.1 (-3%) |  |
| parado: GPU % | 0.1 | 0 | -0.1 (-100%) |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 164 | 163 | -1.2 (-1%) |  |
| rolagem: quadros entregues % | 99.9 | 99.3 | -0.6 (-1%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0.5 | +0.5 |  |
| rolagem: thread principal % | 6 | 5.2 | -0.8 (-13%) |  |
| rolagem: GPU % | 8.4 | 9 | +0.6 (+7%) |  |
| heap JS MB | 1 | 1 | 0 (0%) |  |

## course-ea1, celular

| métrica | antes | depois | variação | |
|---|---:|---:|---:|:-:|
| Lighthouse | 90.5 | 91 | +0.5 (+1%) |  |
| LCP ms | 3403 | 3326 | -76.7 (-2%) |  |
| TBT ms | 22.5 | 1.5 | -21 (-93%) |  |
| Speed Index ms | 1772 | 1881 | +109 (+6%) |  |
| CLS | 0 | 0 | 0 |  |
| KB transferidos | 304 | 306 | +1.4 (+0%) |  |
| parado: thread principal % | 17.7 | 22.5 | +4.8 (+27%) | ✘ |
| parado: GPU % | 0.1 | 0.1 | 0 (0%) |  |
| parado: rAF por s | 0 | 0 | 0 |  |
| rolagem: fps | 165 | 165 | +0.5 (+0%) |  |
| rolagem: quadros entregues % | 100 | 100 | 0 (0%) |  |
| rolagem: p95 do quadro ms | 6.2 | 6.2 | 0 (0%) |  |
| rolagem: engasgos >50 ms | 0 | 0 | 0 |  |
| rolagem: thread principal % | 12.9 | 25.5 | +12.6 (+98%) | ✘ |
| rolagem: GPU % | 0 | 0 | 0 |  |
| toque no menu ms | 40 | 56 | +16 (+40%) |  |
| heap JS MB | 1 | 1 | 0 (0%) |  |

63 métricas melhoraram e 29 pioraram além do ruído.
