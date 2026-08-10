# Cloudflare, plano gratuito — o que ligar e o que não ligar

Medido em 2026-08-10 contra `www.nipscern.com`. Tudo aqui cabe no plano
gratuito; o que é pago está marcado como pago e listado só para você não perder
tempo procurando.

A topologia, em uma linha: o site é **GitHub Pages (build legacy, deploy from a
branch) atrás do proxy do Cloudflare**. Isso importa porque o arquivo `_headers`
na raiz do repositório
**não tem efeito nenhum** — é convenção de Cloudflare Pages e de Netlify, e o
GitHub Pages ignora. Ele promete `immutable` para `/assets/*` e a resposta real
é `max-age=3600`. Quem manda nos cabeçalhos aqui é o painel do Cloudflare.

---

## O que já está certo

Conferido na resposta real, não no painel:

| Item | Estado |
|---|---|
| HTTP/3 (QUIC) | ligado — `alt-svc: h3=":443"` |
| Brotli no HTML | ligado — `content-encoding: br` |
| Redirect apex → www | já é da borda (`Server: cloudflare`, sem passar pelo GitHub) |
| TLS | ativo, sem aviso |

Não mexa nesses.

---

## 1. Cache Rules — a maior de todas (grátis: 10 regras)

Este é o item de maior retorno do documento inteiro, e é o mais fácil.

**O problema, medido:**

```
GET /                            cf-cache-status: DYNAMIC   cache-control: max-age=600
GET /assets/css/main.min.css     cf-cache-status: MISS      cache-control: max-age=3600
GET /assets/fonts/geist…woff2    cf-cache-status: EXPIRED   cache-control: max-age=3600
```

Duas coisas erradas ao mesmo tempo:

`DYNAMIC` no HTML quer dizer que **o Cloudflare não está guardando a página**.
Por padrão ele só cacheia por extensão de arquivo, e `/` não tem extensão, então
toda visita à home vai até o GitHub buscar o HTML. Num site 100% estático isso é
uma viagem à origem que ninguém precisa fazer.

`max-age=3600` nos assets é uma hora, quando **todo asset já viaja com `?v=`**,
um token que é o hash do conteúdo e que o hook `.githooks/pre-commit` troca
sozinho. Uma URL dessas é imutável por construção: se o conteúdo muda, a URL
muda. Guardar por uma hora o que poderia ser guardado por um ano é jogar fora a
única coisa que aquele token existe para permitir.

**As duas regras.** Painel: *Caching → Cache Rules → Create rule*.

**Regra 1 — assets imutáveis**

```
Nome:       assets imutaveis
Se:         (starts_with(http.request.uri.path, "/assets/"))
Então:      Cache eligibility     -> Eligible for cache
            Edge TTL              -> Override origin: 1 year
            Browser TTL           -> Override origin: 1 year
```

**Regra 2 — HTML na borda**

```
Nome:       html na borda
Se:         (http.request.uri.path eq "/") or (ends_with(http.request.uri.path, ".html"))
            or (not http.request.uri.path contains ".")
Então:      Cache eligibility     -> Eligible for cache
            Edge TTL              -> Override origin: 2 hours
            Browser TTL           -> Override origin: 10 minutes
```

O TTL de borda alto no HTML é seguro porque o deploy do Pages não é frequente e
porque **você pode purgar**: *Caching → Configuration → Purge Everything*, ou
purge por URL. Deixe o TTL do navegador curto (10 min) para que uma correção
urgente não fique presa no disco de ninguém — a borda você limpa, o navegador do
visitante não.

A ordem importa: a regra de `/assets/` deve vir antes, senão a terceira condição
da regra 2 (caminho sem ponto) pode pegar uma URL de asset sem extensão.

**Nada dinâmico corre risco aqui, conferido.** A única coisa no site que escreve
estado é o botão de coração, e ele fala com
`https://nipscern-hearts.nipscernlab.workers.dev` — outro hostname, fora desta
zona, então nenhuma das duas regras o alcança. Não há endpoint de API sob
`www.nipscern.com`.

---

## 2. Compression Rules — brotli também nos assets (grátis)

**O problema, medido:**

```
GET /                          content-encoding: br      (bom)
GET /assets/css/main.min.css   content-encoding: gzip    (podia ser br)
```

O HTML sai em brotli e os assets em gzip. O motivo é que o GitHub Pages já
entrega os assets comprimidos em gzip e o Cloudflare repassa em vez de
recomprimir. Em brotli a folha minificada cai de **22,0 KB para 18,6 KB**, e o
mesmo vale proporcionalmente para os módulos.

Painel: *Rules → Compression Rules → Create rule*.

Os tipos abaixo são os que o GitHub Pages realmente manda, conferidos um a um na
resposta — repare que o JavaScript sai como `application/javascript` e não como
`text/javascript`, que é o erro fácil de cometer nessa lista:

```
Se:      (http.response.content_type.media_type in {"text/css" "text/html"
          "application/javascript" "text/javascript" "application/json"
          "image/svg+xml" "application/manifest+json" "text/plain"
          "application/xml"})
Então:   Compression options -> brotli, depois gzip, depois none
```

`text/plain` e `application/xml` entram pelo `robots.txt` e pelo `sitemap.xml`.

Ganho modesto em bytes, custo zero e nenhum risco visual.

---

## 3. Cabeçalhos de segurança — Transform Rules (grátis: 10 regras)

O site hoje não manda nenhum. Nenhum deles muda um pixel, e três deles o
Lighthouse cobra na categoria *Best Practices*.

Painel: *Rules → Transform Rules → Modify Response Header → Create rule*, com
`Se: all incoming requests`.

| Cabeçalho | Valor sugerido | Para quê |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | trava HTTPS no navegador |
| `X-Content-Type-Options` | `nosniff` | impede o navegador de adivinhar o tipo |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | não vaza o caminho completo para terceiros |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | recusa APIs que o site não usa |
| `X-Frame-Options` | **`SAMEORIGIN`** — nunca `DENY` | ver o aviso abaixo |

**Aviso no `X-Frame-Options`, e não é teórico.** O arquivo `_headers` do
repositório declarava `X-Frame-Options: DENY`. Ele nunca valeu, o que foi sorte:
a home embute `projects/cgvweb/` num `<iframe>` de mesma origem, e `DENY`
bloqueia o embed **inclusive da própria origem**. Copiar aquele valor para uma
Transform Rule transformaria a seção do calorímetro num retângulo vazio, sem
erro visível. O `_headers` já foi corrigido para `SAMEORIGIN`; use `SAMEORIGIN`
aqui também. Se um dia o visualizador passar a ser servido de outro hostname,
troque por `Content-Security-Policy: frame-ancestors` com a lista explícita.

**Sobre o `includeSubDomains` do HSTS — conferido, é seguro.** O projeto usa dois
hostnames sob o domínio, e os dois respondem em HTTPS:

```
cdn.nipscern.com    HTTP 404 via HTTPS   (404 em / é normal: é CDN, não tem índice)
www.nipscern.com    HTTP 200 via HTTPS
```

Se você tiver algum subdomínio fora do repositório — um painel, um staging, algo
antigo no DNS — que ainda fale HTTP puro, ele para de abrir e o navegador lembra
disso por um ano. Confira a aba DNS antes. Na dúvida, comece sem
`includeSubDomains`; dá para acrescentar depois, e tirar é que é difícil.

Não recomendo **Content-Security-Policy** por Transform Rule agora: a home carrega
GTM, GoatCounter, o Worker dos corações e o CDN, e uma CSP escrita às pressas
quebra um deles em silêncio numa página que você não testou. É um projeto à
parte, com `Content-Security-Policy-Report-Only` primeiro.

---

## 4. Speed → Optimization (grátis)

| Ajuste | Recomendação | Motivo |
|---|---|---|
| **Early Hints** | **ligar** | manda um `103` com os preloads antes da resposta pronta; ajuda o FCP e não muda nada visualmente |
| **HTTP/3 (QUIC)** | já ligado | conferido no `alt-svc` |
| **0-RTT Connection Resumption** | ligar | retoma TLS na volta do visitante |
| **Speed Brain** | ligar | pré-busca a próxima navegação provável; grátis |
| **Rocket Loader** | **NÃO LIGAR** | ver abaixo |
| Auto Minify | não existe mais | a Cloudflare removeu em agosto de 2024. A minificação agora é do build (`tools/build-min.js`), e é melhor assim: acontece uma vez no commit e não a cada resposta |

**Por que Rocket Loader não:** ele reescreve os `<script>` da página para carregar
tudo de forma assíncrona sob um loader próprio. Este site é ES modules com um
grafo de imports (`main.min.js` importa `i18n.min.js`, `home.min.js` importa
`motion.min.js`), e tem código que depende de ordem — `ensureMotionLibs()` injeta
o GSAP e só então o ScrollTrigger, que precisa que o GSAP já esteja em `window`.
Rocket Loader é exatamente o tipo de coisa que quebra isso de um jeito difícil de
diagnosticar, e o ganho que ele promete já foi obtido à mão neste repositório.

---

## 5. O redirect do apex — o que dá e o que não dá para fazer

O Lighthouse cobra **1020 ms** de `https://nipscern.com/`. Vale entender antes de
tentar consertar, porque a leitura óbvia está errada.

Medido:

```
apex : dns=0.031  connect=0.134  tls=0.268  ttfb=0.633  total=0.638  redirects=1
www  : dns=0.007  connect=0.083  tls=0.155  ttfb=0.242  total=0.305
```

O 301 **já vem da borda** (`Server: cloudflare`, sem cabeçalho nenhum do GitHub),
ou seja, não há o que mover para o Cloudflare: já está lá e já é rápido. O que
custa não é processar o redirect, é o fato de que o navegador precisa **abrir uma
conexão inteira — DNS, TCP e TLS — para um segundo hostname** depois de ter
aberto uma para o primeiro. Nenhuma configuração elimina isso enquanto forem dois
nomes.

As opções reais são três:

1. **Aceitar.** Só paga quem digita o domínio pelado. Quem chega por busca, por
   link ou por compartilhamento já vai para `www`, porque o `<link rel="canonical">`
   e as tags Open Graph apontam para lá. É o que a maioria dos sites faz.
2. **Servir os dois hostnames** sem redirect, mantendo o canonical em `www`. Tira
   o salto para todo mundo. O risco é de SEO — duas URLs com o mesmo conteúdo —
   e o canonical existe justamente para responder isso, mas é uma decisão de
   estratégia de domínio, não de performance.
3. **Trocar o canônico para o apex** e redirecionar `www → nipscern.com`. Não
   resolve nada: apenas troca quem paga o salto.

Minha recomendação é a 1, com uma observação prática: **rode o PageSpeed em
`https://www.nipscern.com/`**, não no apex. O relatório que você mandou mede o
apex e por isso carrega esse 1020 ms, que não é o que a maioria dos visitantes
vive.

---

## 6. Zaraz — vale avaliar, com cuidado

O Tag Manager pesa 112 KB e você quer mantê-lo, o que é uma decisão legítima.
Nesta sessão ele saiu do caminho crítico: o `dataLayer` continua sendo montado
inline, no parse, e só o download do container espera o `load`.

O **Zaraz** tem camada gratuita e é a ferramenta da Cloudflare para carregar
ferramentas de terceiro a partir da borda em vez de mandar o script inteiro para
o navegador. Se o que está configurado dentro do seu container GTM for coisa que
o Zaraz cobre nativamente, dá para trocar 112 KB por praticamente nada.

Não estou afirmando que ele substitui o seu container — isso depende inteiramente
de quais tags estão lá dentro, e eu não tenho acesso ao painel. É um "vale meia
hora de investigação", não um "faça".

---

## 7. O que é pago, para não perder tempo

| Recurso | Plano |
|---|---|
| **Polish** (recomprime imagens, serve WebP/AVIF automático) | Pro |
| **Mirage** (imagens adaptadas à conexão) | Pro |
| **Image Resizing / Cloudflare Images** | pago por uso |
| **Argo Smart Routing** | pago |
| **Load Balancing** | pago |

O Polish seria útil aqui, mas o trabalho que ele faria já foi feito à mão: as
imagens são WebP e o pôster do calorímetro agora tem `srcset` em quatro larguras.

---

## Ordem sugerida

| # | Ação | Onde | Ganho |
|---|---|---|---|
| 1 | Cache Rule para `/assets/*` | Caching → Cache Rules | segunda visita inteira sai do disco |
| 2 | Cache Rule para o HTML | Caching → Cache Rules | tira a viagem à origem de toda visita |
| 3 | Compression Rule (brotli) | Rules → Compression Rules | ~15% nos arquivos de texto |
| 4 | Early Hints + 0-RTT + Speed Brain | Speed → Optimization | três interruptores, nenhum risco |
| 5 | Cabeçalhos de segurança | Rules → Transform Rules | Best Practices, e é o certo a fazer |
| 6 | Conferir que Rocket Loader está **desligado** | Speed → Optimization | evita quebrar os módulos |

Os itens 1 e 2 são os que valem a viagem. Os outros são higiene.

## Como conferir

O painel diz o que foi configurado. Só a resposta diz o que chega ao navegador,
e é ela que conta. Há um script para isso:

```bash
bash tools/check-edge.sh                 # www.nipscern.com
bash tools/check-edge.sh nipscern.com    # o apex
```

Ele imprime OK ou FALTA para cada item deste documento, bate duas vezes em cada
URL (o `cf-cache-status` da primeira costuma ser MISS porque o objeto ainda não
está naquele datacenter — vale o da segunda) e tem uma checagem própria para o
`X-Frame-Options: DENY`, que é o único jeito de quebrar o CGV sem perceber.

Linha de base medida em 2026-08-10, antes de qualquer regra:

```
  3 ok, 9 pendente(s)
```

Os três que já passavam são o HTTP/3, o cache do asset chegando a HIT por conta
própria, e a ausência de `DENY`.
