# Otimização da Home — estudo

Status: estudo, 2026-08-10. Nada aqui foi implementado, com uma exceção
registrada na seção 3 (a grade de projetos passou a abrir parada nesta mesma
sessão, e o efeito colateral de desempenho disso é grande o bastante para o
estudo começar por ele).

**As duas restrições, aceitas como dadas:**

1. Nada de perda de qualidade visual. O céu, o vidro, o parallax, a tipografia
   e os loops continuam exatamente como estão para quem olha.
2. Nada de encurtar os vídeos dos cards de projects. A duração de cada loop é
   intocável.

Tudo abaixo respeita as duas. Onde uma alavanca chega perto da fronteira — e há
uma só, o item 4.3 — isso está dito na cara.

---

## 1. O que a Home carrega hoje

Medido no repositório em 2026-08-10, com gzip -9 e brotli para os arquivos de
texto, e conferido contra o que o servidor realmente devolve.

### Caminho crítico (antes do primeiro pixel)

| Recurso | Na rede | Observação |
|---|---:|---|
| `gtm.js` (Google Tag Manager) | **112,5 KB** | script de terceiro, no `<head>` |
| `icons.css` | 14,4 KB | **único stylesheet que bloqueia render** |
| `index.html` | 15,0 KB | brotli, servido pelo Cloudflare |
| `geist-var-latin.woff2` | 28,7 KB | preload |
| `bodoni-var-latin.woff2` | 45,2 KB | preload |

### Depois do primeiro pixel

| Recurso | Na rede |
|---|---:|
| `main.css` | 58,3 KB gzip (61,5 KB como servido) |
| `gsap.min.js` + `ScrollTrigger.min.js` | 45,1 KB |
| JS próprio (main, home, sky, i18n, motion, smooth-scroll, hearts…) | ≈ 45,5 KB |
| `lenis.mjs` | 8,2 KB (só ponteiro fino, só sem reduced-motion) |
| `i18n/en.json` + fatias da home | 16,5 KB |
| pôsteres e imagens | 313,7 KB |
| **vídeos dos cards** | **4,88 MB** |

O somatório sem vídeo dá **≈ 707 KB**. Com os cinco vídeos, **≈ 5,6 MB**.

### Os cinco loops, medidos

| Arquivo | Resolução | fps | Duração | Bitrate | Tamanho |
|---|---|---:|---:|---:|---:|
| `about-light-waves-loop.mp4` | 720×1280 | **60** | 9,95 s | 1,10 Mbps | 1,32 MB |
| `cgv-geometry-loop.mp4` | **1100×560** | 30 | 5,07 s | **2,02 Mbps** | 1,22 MB |
| `aurora-borealis-loop.mp4` | 810×1050 | 30 | 5,47 s | **1,77 Mbps** | 1,16 MB |
| `ai-hand-loop.mp4` | 780×950 | 24 | 17,33 s | 0,48 Mbps | 1,00 MB |
| `sapho-circuit-loop.mp4` | 620×850 | 30 | 3,27 s | 0,45 Mbps | 0,18 MB |

Todos H.264. O `ai-hand`, com 17 segundos, é o mais longo e o **segundo menos
pesado por segundo** — ele já está bem codificado. Os caros são o `cgv-geometry`
e o `aurora`, e o caro deles não é a duração: é o bitrate.

---

## 2. Como ler o resto do documento

Cada alavanca abaixo traz o ganho medido ou estimado, o custo em trabalho, e o
risco visual. As que valem mais estão primeiro. Nenhuma delas encosta na duração
dos loops.

---

## 3. O que já foi ganho nesta sessão (≈ 4,9 MB)

A grade agora abre parada numa primeira visita. O efeito colateral é que
`videoLoop()` só chama `arm()` quando o vídeo vai tocar, e `arm()` é quem
atribui o `src`. Parada, a grade **não busca um byte de vídeo**: os cinco
pôsteres ficam no lugar, e o arquivo desce quando o leitor aponta para o card ou
aperta Play.

Uma Home que baixava até 5,6 MB numa rolagem completa passa a baixar ≈ 707 KB.
É, de longe, a maior mudança de peso possível na página, e ela custou uma linha.

**A consequência que precisa ser dita:** em telas de toque não existe hover, e
um toque no card navega, porque o card é um link. Na prática, no celular, os
loops só rodam depois que o leitor aperta Play. O botão está visível e diz Play,
então a saída existe e é óbvia — mas é uma mudança de comportamento no celular,
não só uma economia. Se a intenção for que o celular veja os loops, o caminho é
tocá-los em `IntersectionObserver` só quando `(pointer: coarse)`, o que devolve
o custo dos 4,88 MB exatamente na plataforma onde ele dói mais. Vale conversar.

---

## 4. Alavancas por ordem de retorno

### 4.1 Google Tag Manager — 112,5 KB no `<head>` (ganho: 112,5 KB, risco visual: zero)

É o maior arquivo isolado da Home. Ele sozinho pesa **mais que GSAP e
ScrollTrigger somados** (45,1 KB), mais que a `main.css` inteira (58,3 KB), e
custa ainda uma conexão a um terceiro e o parse dele na thread principal, tudo
antes do primeiro pixel.

E a análise de audiência do site não depende dele: quem conta visita é o
GoatCounter, 3,5 KB, carregado por `assets/js/analytics.js`, que é o que a
política de privacidade descreve como sendo o analytics do site.

Três saídas, em ordem de preferência:

1. **Remover.** Se nada dentro do GTM está configurado, ele é 112,5 KB de
   caminho crítico servindo um container vazio. Conferir no painel antes.
2. **Adiar.** Mover o snippet para dentro de um `window.addEventListener('load',
   …)`. O GTM continua funcionando, mas para de disputar a largura de banda com
   a fonte e a folha de estilo.
3. **Manter e aceitar o custo**, se houver tag de campanha rodando ali que o
   laboratório usa.

Vale notar que a política de privacidade lista o GoatCounter e as três chaves de
`localStorage` e não menciona o Tag Manager. Se ele fica, o texto precisa dizer
que ele está lá.

### 4.2 Recortar o `cgv-geometry-loop` (ganho estimado: 700–800 KB, risco visual: zero)

Este é o achado mais desconfortável do estudo. O arquivo é **1100×560**, uma
paisagem larga. A moldura em que ele toca, `.pc-media`, é o card inteiro:
≈ 424 × 492 px em 1440, e o vídeo entra com `object-fit: cover`.

Cover num quadro mais alto que largo escala pela altura. Um 1100×560 esticado
para cobrir 492 px de altura fica com 966 px de largura, dos quais o card mostra
424. **Mais da metade de cada quadro é recortada e jogada fora** — e é a metade
mais cara, porque é onde está o bitrate mais alto dos cinco arquivos.

Recortar na origem para a proporção que o card realmente mostra é invisível para
quem olha (esses pixels nunca chegaram à tela) e devolve a maior parte de 1,22 MB.

```bash
# 620×720 cobre a moldura do card com folga para o parallax (a mídia é
# posicionada a 114% da altura). Ajustar o offset do crop para onde a
# geometria de interesse está no quadro original.
ffmpeg -i assets/videos/cgv-geometry-loop.mp4 \
  -vf "crop=560:560:270:0,scale=620:620:flags=lanczos" \
  -c:v libx264 -crf 24 -preset slower -profile:v high -pix_fmt yuv420p \
  -movflags +faststart -an \
  assets/videos/cgv-geometry-loop-v7.mp4
```

Nada de `-t`, nada de `-r`: mesma duração, mesmos quadros.

Vale conferir os outros quatro pelo mesmo critério antes de recodificar — o
`about-light-waves` (720×1280) roda na `.cube-rail`, que é outra moldura, e o
recorte dele tem que ser medido contra ela e não contra o card.

### 4.3 Recodificar os loops sem tocar na duração (ganho estimado: 1,2–1,8 MB, risco visual: baixo)

Os arquivos estão em H.264 com bitrate fixo alto. Sob o scrim do card — os loops
correm atrás de um gradiente de legibilidade, com o texto por cima — o olho não
distingue 2,02 Mbps de 0,9 Mbps. Recodificar por CRF, que aloca bits onde o
quadro precisa em vez de espalhá-los por igual, costuma cortar 40–60% com
diferença imperceptível.

```bash
# Mesma resolução, mesma duração, mesmo fps. Só a alocação de bits muda.
for f in aurora-borealis ai-hand sapho-circuit; do
  ffmpeg -i "assets/videos/$f-loop.mp4" \
    -c:v libx264 -crf 24 -preset slower -profile:v high -pix_fmt yuv420p \
    -movflags +faststart -an "assets/videos/$f-loop-v2.mp4"
done
```

`-movflags +faststart` põe o índice na frente do arquivo, então o primeiro
quadro aparece sem esperar o download inteiro. `-an` tira a trilha de áudio, que
não existe para nada num loop `muted`.

**Um passo além, opcional:** servir AV1 ou VP9 em WebM com o MP4 como fallback,
via dois `<source>` em vez de um `data-src`. AV1 na mesma qualidade percebida
costuma ficar 30–50% abaixo do H.264. O custo é que `videoLoop()` hoje troca
`video.src` na mão e teria que passar a montar `<source>`; e Safari só toca AV1
em hardware recente, por isso o MP4 continua.

**A fronteira, e ela é do cliente:** `about-light-waves-loop.mp4` está a **60
fps**, o dobro dos outros. São 597 quadros para 10 segundos de ondas de luz
lentas. A 30 fps o arquivo cai perto da metade, a duração não muda em nada, e a
diferença num movimento tão lento é, na prática, invisível. Mas é redução de
quadros, e a restrição diz qualidade visual intocada — então fica aqui como
decisão, não como recomendação:

```bash
# Só se aprovado. Corta ≈ 40-50% de 1,32 MB. Duração idêntica.
ffmpeg -i assets/videos/about-light-waves-loop.mp4 -r 30 \
  -c:v libx264 -crf 24 -preset slower -pix_fmt yuv420p \
  -movflags +faststart -an assets/videos/about-light-waves-loop-30.mp4
```

### 4.4 Cache de verdade para `/assets/*` (ganho: a segunda visita inteira, risco visual: zero)

Todo asset já viaja com `?v=<hash>`, trocado automaticamente pelo hook
`.githooks/pre-commit`. Uma URL assim é imutável por construção: se o conteúdo
muda, a URL muda. Mesmo assim, a resposta real é:

```
cache-control: max-age=3600
```

Uma hora. O `_headers` na raiz promete `immutable` mas é inerte, porque o
GitHub Pages não o lê (ver a topologia de deploy). O resultado é que quem volta
no dia seguinte revalida tudo de novo sem nenhuma necessidade.

A correção não é código: é uma **Cache Rule no Cloudflare** para
`/assets/*`, com Edge TTL e Browser TTL em 1 ano. Ganho: numa segunda visita, os
≈ 707 KB de HTML/CSS/JS/fonte/imagem saem do disco em vez da rede.

### 4.5 Brotli para os estáticos (ganho: ≈ 14,5 KB só na `main.css`, risco visual: zero)

O HTML já sai comprimido em brotli. Os estáticos não:

```
GET /assets/css/main.css     content-encoding: gzip     61.463 bytes
```

A mesma folha em brotli dá **47,0 KB**. São 14,5 KB no maior arquivo de texto da
página, mais alguns KB espalhados pelo resto. Também é configuração de
Cloudflare, não de código.

### 4.6 `icons.css`: 110 ícones para usar 19 (ganho: ≈ 11 KB, e sai do caminho crítico)

A folha de ícones tem 110 regras. A Home usa 19 delas. E ela é a **única folha
que bloqueia o render da Home** — a `main.css`, que é quatro vezes maior, entra
assíncrona por `preload` + `onload`, e o crítico dela está embutido no `<head>`.
Ou seja: a folha pequena e quase toda inútil bloqueia, e a grande e essencial
não.

O `tools/build-icons.js` já gera esse arquivo, então gerar um subconjunto por
página é mudança de build, não de arquitetura. Duas formas:

- **Subconjunto por página**, mantendo o `<link>` bloqueante: 14,4 KB → ≈ 3 KB.
- **Os 19 da Home embutidos no crítico** junto do resto, e a folha completa
  carregada assíncrona para o que aparece depois da dobra.

Carregar a folha inteira assíncrona sem nenhuma das duas não serve: os ícones do
hero apareceriam depois, piscando.

### 4.7 GSAP para quem pediu menos movimento (ganho: 45,1 KB para esse público, risco visual: zero)

`initMotion()` devolve `null` sob `prefers-reduced-motion`, e todo o uso de GSAP
na Home está dentro de `choreograph()`, que sai na hora quando isso acontece.
Mesmo assim, `gsap.min.js` e `ScrollTrigger.min.js` são dois `<script defer>` no
HTML: descem e são parseados sempre, inclusive para quem nunca vai ver um único
quadro do que eles fazem.

O site já sabe fazer isso certo em outro lugar: `initSmoothScroll()` só importa
o `lenis.mjs` depois de checar `REDUCED` e `(pointer: coarse)`. É o mesmo padrão,
aplicado a um arquivo 5,5 vezes maior.

```js
// em vez de dois <script defer> no HTML
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  await Promise.all([load('vendor/gsap.min.js'), load('vendor/ScrollTrigger.min.js')]);
}
```

Público pequeno, ganho grande para ele, e nenhuma diferença para todo mundo.

### 4.8 `srcset` nos pôsteres (ganho: ≈ 150–200 KB no celular, risco visual: zero)

| Imagem | Dimensões | Peso |
|---|---|---:|
| `CGVWEB_2560x1440_…webp` | 2560×1440 | 159,7 KB |
| `cgv-geometry-poster.webp` | 1100×560 | 76,2 KB |
| `ai-hand-poster.webp` | 780×950 | 30,4 KB |

Os três descem inteiros em qualquer tela. O pôster de 2560 px é justificável num
monitor retina, onde a faixa ocupa ≈ 1320 px CSS; num celular de 390 px de
largura ele é seis vezes maior que o necessário. `srcset` com 800/1280/2560 e um
`sizes` honesto resolve sem tirar um pixel de ninguém — o desktop continua vendo
o de 2560.

O `cgv-geometry-poster` tem o mesmo problema de recorte do vídeo (seção 4.2) e
deve ser recortado junto com ele, pelo mesmo motivo.

---

## 5. O que não vale a pena mexer

- **`main.css` inteira (58,3 KB gzip) em toda página.** Dá para dividir por
  página, mas o crítico da Home já está embutido no `<head>` e a folha entra
  assíncrona, então ela não segura o primeiro pixel. Dividir traria complexidade
  de build permanente por um ganho que o leitor não sente.
- **O céu (`sky.js`).** 5,7 KB, com o DPR limitado a 2 e desenho só enquanto
  visível. É marca do site e está bem-comportado.
- **GSAP para quem tem movimento ligado.** É o que faz o parallax e a
  coreografia existirem. Sai fora da restrição.
- **Duração de qualquer loop.** Fora do escopo por decisão do cliente, e o
  estudo mostra que não é lá que está o peso: o loop mais longo dos cinco é o
  segundo mais leve por segundo.

---

## 6. Ordem sugerida

| # | Alavanca | Ganho | Onde se mexe |
|---|---|---:|---|
| 1 | GTM: remover ou adiar | 112,5 KB | `index.html` + demais páginas |
| 2 | Cache Rule `/assets/*` | 2ª visita inteira | painel Cloudflare |
| 3 | Brotli nos estáticos | ≈ 20 KB | painel Cloudflare |
| 4 | Recortar o `cgv-geometry` | ≈ 700–800 KB | `ffmpeg` + repo de assets |
| 5 | Recodificar os outros loops por CRF | ≈ 1,2–1,8 MB | `ffmpeg` + repo de assets |
| 6 | `icons.css` por página | ≈ 11 KB, e sai do crítico | `tools/build-icons.js` |
| 7 | GSAP condicional | 45,1 KB (reduced-motion) | `index.html` + `home.js` |
| 8 | `srcset` nos pôsteres | ≈ 150–200 KB no celular | `index.html` |

Os itens 1 a 3 são os de melhor relação entre ganho e trabalho, e nenhum dos
três encosta em pixel nenhum. Os 4 e 5 mexem em mídia e devem ir para o repositório
`nipscern-assets`, com as variantes ao lado do arquivo principal.

Vídeo total depois dos itens 4 e 5, mantidas as cinco durações: estimativa de
**4,88 MB → ≈ 2,2–2,6 MB**, e nada disso desce numa primeira visita de qualquer
forma, por causa da seção 3.
