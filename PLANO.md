# Plano de 2026-08-10 — onde parei e como continuar

Arquivo de passagem de bastão. Tudo abaixo já está commitado e publicado; o que
sobrou está na lista do fim, separado entre "depende de você" e "candidatos".

Os dois documentos longos são:

- [docs/home-performance-study.md](docs/home-performance-study.md) — o estudo da
  Home, com as três correções onde ele próprio errou
- [docs/cloudflare-free-plan.md](docs/cloudflare-free-plan.md) — o que está
  configurado na borda e por quê

---

## 1. Ligar a máquina nova (faça isto primeiro)

```bash
git clone git@github.com:nipscernlab/nipscernweb.git
cd nipscernweb
npm install
git config core.hooksPath .githooks     # NÃO PULE — veja abaixo
```

**O `core.hooksPath` não é opcional agora.** O hook de pre-commit deixou de ser
só o carimbo de `?v=`: ele também gera as cópias minificadas que o site serve e
os subconjuntos de ícones de cada página. Sem ele, um commit publica HTML novo
apontando para `.min` velhos, e uma página que ganhou um ícone desenha um
quadrado sólido no lugar dele. O guard de CI pega o `?v=`, mas não pega isso.

Para rodar os testes é preciso um Chromium com porta de depuração aberta:

```bash
npm run dev                              # terminal 1

# terminal 2 — Windows
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --remote-debugging-port=9222 \
  --user-data-dir=%TEMP%/edge-dbg about:blank

npm test                                 # terminal 3
```

Comandos disponíveis:

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor local, com compressão (produção também comprime) |
| `npm test` | os quatro testes abaixo |
| `npm run test:drawer` | o menu não pode aparecer antes da folha, nem imagem passar de 28px |
| `npm run test:cgv` | o visualizador não arma na abertura, e arma ao chegar perto |
| `npm run test:sky` | o céu novo contra o antigo, byte a byte |
| `npm run test:icons` | todo `.ph` de toda página com máscara resolvida |
| `npm run build:min` | regenera os `.min` (o hook já faz) |
| `npm run build:icons` | regenera os subconjuntos (o hook já faz) |
| `npm run check:min` / `check:icons` | falham se algo estiver defasado — é o que o CI roda |
| `bash tools/check-edge.sh` | pergunta à borda o que ela devolve; hoje 13 ok, 0 pendente |

---

## 2. O que foi feito hoje

Quatorze commits, em ordem. Cada mensagem de commit conta o porquê inteiro; aqui
é só o mapa.

### Os consertos que você pediu

- **Chevron da Home** — saiu a animação em laço; agora sobe e cresce só no hover.
  Precisou de um invólucro: o GSAP escreve `transform` inline no elemento para
  afundá-lo quando o hero sai, e transform inline vence qualquer `:hover`.
- **Vídeos parados na primeira visita** — só `'playing'` no localStorage libera.
  A política de privacidade descrevia a chave ao contrário nos quatro idiomas.
  **Consequência a saber:** no celular não existe hover e um toque no card
  navega, então lá os loops só rodam depois do botão Play.
- **Mobile** — o drawer abria atrás da faixa de anúncio (a altura da faixa agora
  é medida e publicada como `--top-banner-h`); o card de estatísticas tinha uma
  borda pendurada em *Theses supervised* (`+` conta ordem, não linha); o botão
  Open Full CGV ganhou respiro.
- **O menu que fugia** — era FOUC. O `<nav>` é escrito por JS e o `main.css` da
  Home é assíncrono, então o drawer nascia sem estilo e, quando a folha chegava,
  o `translateX(100%)` entrava junto com a transição. O ícone gigante era o
  mesmo bug na barra: `icon_cgv.svg` tem 512×512.

### Desempenho

Medido no site publicado: **1.809 KB → 675 KB** e **TBT 1.560 ms → 40 ms** para
quem não desce até o calorímetro. Acessibilidade **90 → 100**.

- **Minificação** (`tools/build-min.js`) — 63 KB comprimidos. Os comentários são
  62% do que a `main.css` manda pela rede. As fontes ficam intactas.
- **Visualizador CGV** — o anel que o arma dizia "uma tela e meia"; medido, o
  stage fica a 102–126% de uma tela da dobra, então ele sempre armava na
  abertura. Agora 75%.
- **Ícones por página** — 13,9 KB → 4,8 KB na Home, e sai do caminho crítico.
- **GTM** — mantido, movido para o `load`. O `dataLayer` continua inline.
- **GSAP** — condicional a `prefers-reduced-motion`, na Home e no about.
- **`aurora` em AV1** — mesma resolução, fps, contagem de quadros e duração;
  VMAF 97,08 médio e 95,01 no pior quadro; 435 KB a menos.
- **`srcset`** no pôster do calorímetro, quatro larguras.
- **O céu** — 7 a 11% com **zero pixels de diferença**, provado byte a byte.

### Cloudflare

Aplicado por API. `bash tools/check-edge.sh` confirma: 13 ok, 0 pendente.

- Cache Rules: assets com `?v=` (1 ano), sem `?v=` (borda 1 ano, navegador 1 dia),
  HTML (borda 5 min, navegador revalida).
- Cabeçalhos de segurança, HSTS, TLS mínimo 1.0 → **1.2**.
- **Compression Rule criada, medida e apagada** — o brotli da borda saiu MAIOR
  que o gzip que o GitHub Pages já produz. Está documentado com os números.

### Testes que sobraram

Quatro, e **verifiquei que cada um reprova sem o conserto**. Um teste que passa
com o bug de volta não prova nada.

---

## 3. TODO

### Depende de você

- [ ] **Revogar o token do Cloudflare.** Vale até 31/08 e tem
      `Cache Rules`, `Transform Rules`, `Zone Settings`, `Config Rules` e
      `Response Compression`. O trabalho dele acabou.
      dash.cloudflare.com → My Profile → API Tokens.
- [ ] **Criar o segredo `CLOUDFLARE_PURGE_TOKEN`** (Settings → Secrets and
      variables → Actions), com um token novo de permissão **única**:
      `Cache Purge: Purge`, restrito a nipscern.com.
      Isso acorda `.github/workflows/purge-cache.yml`, que hoje avisa e sai.
- [ ] **Depois disso, subir o TTL de borda do HTML** de 5 min para 2 h.
      Caching → Cache Rules → *HTML — 5 min na borda*. Os 5 min existem só
      porque nada avisava a borda quando o Pages publicava.
- [ ] **HSTS `includeSubDomains`** — deixei desligado de propósito: o token não
      lia DNS e eu não pude confirmar que todo subdomínio fala HTTPS. Confira a
      aba DNS; se todos falarem, marque em SSL/TLS → Edge Certificates.
      **Deixe *Preload* desmarcado** — sair da lista leva meses.
- [ ] **Medir o PageSpeed em `https://www.nipscern.com/`**, não no apex. O
      relatório do apex cobra 1020 ms de um redirect que não tem conserto de
      configuração: o 301 já é da borda, e o custo é o segundo handshake
      DNS+TCP+TLS para um segundo hostname.

### Candidatos, com o motivo de não terem sido feitos

- [ ] **`assets/css/icons.min.css` virou arquivo morto** (55 KB). Nenhuma página
      o carrega desde que os subconjuntos entraram. Tirá-lo pede mexer no filtro
      do `build-min` e na lista do hook; não fiz para não arriscar o build no
      fim do dia. É limpeza, não urgência.
- [ ] **Colisão de nome `.ph`** — AURORA e YANC usam `<div class="ph">` como
      placeholder de screenshot, colidindo com o `.ph` do Phosphor. Nada
      quebrado: as páginas redefinem `.shot .ph` por cima e escondem o elemento
      quando a imagem chega. Renomear para `.shot-ph` resolveria de vez.
- [ ] **O céu, além dos 7–11%** — o tempo restante está no rasterizador
      desenhando 1.600 arcos por quadro. Tirá-lo de lá exige trocar arco por
      sprite, o que reamostra, o que muda o que se vê. **Fora do combinado.**
- [ ] **Reenquadrar o `cgv-geometry-loop`** — é 1100×560 numa moldura mais alta
      que larga com `object-fit: cover`, então mais de metade de cada quadro é
      recortada e descartada, e é o arquivo de maior bitrate. Valeria ~700 KB.
      **Fora de escopo por decisão sua** (nada de reenquadrar vídeo). Fica
      registrado para o dia em que a origem for reexportada.
- [ ] **Content-Security-Policy** — não escrevi. A Home carrega GTM,
      GoatCounter, o Worker dos corações e o CDN; uma CSP feita às pressas
      quebra um deles em silêncio numa página que ninguém testou. É projeto à
      parte, começando por `Content-Security-Policy-Report-Only`.

### Coisas para não refazer

- **Compression Rule no Cloudflare** — já tentei. O brotli e o zstd da borda
  saem maiores que o gzip da origem, porque a borda comprime barato (a cada
  resposta) e o GitHub Pages comprime caro (uma vez, em repouso). Números em
  `docs/cloudflare-free-plan.md`, seção 2.
- **Recodificar os outros quatro loops** — varredura de CRF 18/20/22 em x264:
  **todo** re-encode saiu maior que o original. Já estavam bem codificados.
- **`matches` (regex) em regra do Cloudflare** — exige plano Business. No
  gratuito é `starts_with`, `ends_with`, `wildcard` ou `in`. A regra de cache
  que existia usava `eq` com uma regex dentro e por isso nunca casou com nada.

---

## 4. Duas armadilhas que já custaram tempo

**Medição em máquina ocupada mente.** Uma execução do Lighthouse com o
dev-server, o Edge de depuração e um `npm install` rodando junto acusou TBT de
10.570 ms; com a máquina limpa, 1.630 ms. Feche tudo antes de medir, e rode três
vezes.

**O dev-server agora comprime, e isso importa.** Antes ele entregava 125 KB de
CSS onde a produção entrega 22, o que fazia toda medição local errar na mesma
direção — dois segundos a mais de primeiro pixel que não existiam.
