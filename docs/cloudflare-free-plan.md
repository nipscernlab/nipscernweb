# Cloudflare, plano gratuito — o que ligar e o que não ligar

Medido em 2026-08-10 contra `www.nipscern.com`. Tudo aqui cabe no plano
gratuito; o que é pago está marcado como pago e listado só para você não perder
tempo procurando.

> **Estado em 2026-08-10: 13 de 13 conferidos, nada pendente.**
> `bash tools/check-edge.sh` dá o estado atual a qualquer momento.

---

## O que foi encontrado ao aplicar, e que este documento não previa

**A regra de cache dos assets já existia, estava ativa, e não fazia nada.**
A expressão era:

```
(http.request.uri.path eq "\.(css|js|webp|png|jpg|svg|woff2|ico)$")
```

Uma regex escrita com `eq`, que é igualdade exata de string — ela só casaria com
um caminho literalmente igual àquele texto, o que nunca acontece. Era esse o
motivo real do `max-age=3600`, e não a ausência de regra. **`matches`, o
operador de regex, exige plano Business**, então no gratuito a forma certa é
`starts_with`.

**O HTML não era `DYNAMIC` por padrão do Cloudflare.** Havia uma regra explícita
chamada *HTML — No Cache* com `cache: false`. A explicação que este documento
dava antes — de que o Cloudflare cacheia por extensão e `/` não tem uma — estava
errada: era decisão registrada, não omissão.

**Metade dos assets não tem `?v=`.** Das 34 referências a `/assets/` na home, 16
não carregam carimbo. Um `max-age` de um ano no navegador congelaria essas por um
ano se algum dia forem trocadas no lugar. Por isso são **duas** regras e não uma,
separadas por `http.request.uri.query contains "v="`.

**Quase todo o Speed já estava certo.** Early Hints, 0-RTT, HTTP/3 e Speed Brain
ligados, e o Rocket Loader já desligado. Em compensação, duas coisas de segurança
estavam abertas e foram fechadas: **HSTS desativado** e **TLS mínimo em 1.0**.

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

**As três regras, como estão configuradas hoje.** Painel: *Caching → Cache
Rules*.

**Regra 1 — assets carimbados**

```
Nome:  assets imutaveis (com ?v=) — 1 ano
Se:    starts_with(http.request.uri.path, "/assets/")
       and http.request.uri.query contains "v="
       and not (http.host eq "cdn.nipscern.com")
Então: Eligible for cache | Edge TTL 31536000 | Browser TTL 31536000
```

**Regra 2 — assets sem carimbo**

```
Nome:  assets sem ?v= — borda 1 ano, navegador 1 dia
Se:    starts_with(http.request.uri.path, "/assets/")
       and not (http.request.uri.query contains "v=")
       and not (http.host eq "cdn.nipscern.com")
Então: Eligible for cache | Edge TTL 31536000 | Browser TTL 86400
```

A borda guarda por um ano nos dois casos porque a borda **você pode purgar**. O
navegador do visitante é que não, e é por isso que só o carimbado ganha o ano lá.

**Regra 3 — HTML na borda**

```
Nome:  HTML — 5 min na borda, revalida no navegador
Se:    (ends_with(http.request.uri.path, ".html"))
       or (http.request.uri.path eq "/")
       or (not http.request.uri.path contains ".")
Então: Eligible for cache | Edge TTL 300 | Browser TTL 0
```

**Cinco minutos, e não as duas horas que este documento sugeria antes.** O
raciocínio mudou ao lembrar de como o site publica: o deploy é um push no
GitHub Pages, sem purga automática. Com duas horas de borda, uma correção
publicada pode não aparecer por duas horas e o diagnóstico disso é exatamente o
"o site não atualizou" que já custou tempo aqui. Cinco minutos tira praticamente
toda viagem à origem sob tráfego e mantém um deploy visível quase na hora.
`Browser TTL 0` faz o navegador revalidar sempre, então na ponta a correção é
imediata.

Para subir esse TTL com segurança, o caminho é purgar no deploy: um passo no
workflow do GitHub chamando a API de purge com um token que tenha *Cache Purge*.
Aí 2 h, ou um dia, passam a ser seguros.

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

## 2. Compression Rules — **NÃO CRIE. Foi tentado, medido e desfeito.**

Este documento recomendava forçar brotli. A regra foi criada, medida e removida,
porque ela **aumenta** o arquivo mais pesado do site.

O raciocínio original era: o HTML sai em brotli e os assets em gzip, logo há
ganho a fazer. E a conta local dizia que sim — `main.min.css` dá 22,0 KB em gzip
e 18,6 KB em brotli. O que faltava era saber **em que qualidade a borda
comprime**.

Medido com a regra ativa, no mesmo arquivo, em `MISS` e em `HIT`:

| o que a borda entrega | bytes |
|---|---:|
| gzip (o que o GitHub Pages já produz, em repouso) | **23.454** |
| brotli da Cloudflare, com a regra | 24.175 |
| zstd da Cloudflare, com a regra | 26.016 |
| brotli q11 local, o ideal inalcançável | 19.058 |

A compressão dinâmica da Cloudflare roda em qualidade baixa de propósito, porque
ela acontece **a cada resposta** e precisa ser barata. O GitHub Pages comprime
uma vez, em repouso, e pode gastar mais tempo nisso. Recomprimir um gzip bom com
um brotli rápido dá um arquivo maior — os três algoritmos perderam.

Então: **a regra foi apagada** e o interruptor `brotli` da zona ficou como estava
(ligado). A borda escolhe o algoritmo e não há regra forçando nada.

**O teto desta topologia.** O melhor possível seria 19.058 bytes, e chegar lá
exigiria a origem servir um `.br` pré-comprimido em repouso. O GitHub Pages não
serve arquivos pré-comprimidos, então esses **4,4 KB são inalcançáveis** aqui —
não por falta de configuração, mas pela hospedagem. Seria um argumento a favor
do Cloudflare Pages num dia em que a migração fizer sentido por outros motivos.

A lição, que vale além deste item: um número medido na sua máquina não é o número
que a borda produz.

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

Conferido pela API em 2026-08-10: **tudo isto já estava como devia.** A tabela
fica como registro do que é o estado correto, não como lista de tarefas.

| Ajuste | Estado | Motivo |
|---|---|---|
| **Early Hints** | ✅ já ligado | manda um `103` com os preloads antes da resposta pronta |
| **HTTP/3 (QUIC)** | ✅ já ligado | conferido também no `alt-svc` |
| **0-RTT** | ✅ já ligado | retoma TLS na volta do visitante |
| **Speed Brain** | ✅ já ligado | pré-busca a próxima navegação provável |
| **Brotli (zona)** | ✅ ligado, como estava | ver a nota abaixo |
| **Rocket Loader** | ✅ já desligado | ver abaixo |

**A nota sobre o Brotli.** O interruptor `brotli` da zona está ligado e os
assets continuam saindo em gzip. Não é contradição: esse interruptor manda o
Cloudflare comprimir o que a origem mandou **sem** compressão, e o GitHub Pages
já entrega tudo em gzip, então não há o que comprimir e a borda repassa.

E está certo assim. A seção 2 conta a história da Compression Rule que forçava a
recompressão: foi criada, medida, saiu maior, e foi apagada.
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

## Estado, item a item

| # | Ação | Estado |
|---|---|---|
| 1 | Cache Rule `/assets/*` com `?v=` — 1 ano | ✅ aplicado (a regra que existia estava quebrada) |
| 2 | Cache Rule `/assets/*` sem `?v=` — borda 1 ano, navegador 1 dia | ✅ aplicado |
| 3 | Cache Rule do HTML — 5 min na borda | ✅ aplicado (era `No Cache` explícito) |
| 4 | Cabeçalhos de segurança | ✅ aplicado — 4 via Transform Rule |
| 5 | HSTS | ✅ ligado, 1 ano, **sem** `includeSubDomains` |
| 6 | TLS mínimo 1.0 → 1.2 | ✅ aplicado |
| 7 | Early Hints, 0-RTT, HTTP/3, Speed Brain | ✅ já estavam ligados |
| 8 | Rocket Loader desligado | ✅ já estava |
| 9 | Compression Rule (brotli) | ❌ **criada, medida e removida** — piorava (seção 2) |

### Por que o HSTS ficou sem `includeSubDomains`

`includeSubDomains` vale para **todo** subdomínio e o navegador lembra por um
ano. Os dois hostnames que o repositório usa falam HTTPS, mas não deu para
enumerar o DNS da zona para saber se existe algum outro — um painel antigo, um
staging — que ainda responda em HTTP puro. Um desses pararia de abrir e a
lembrança dura um ano.

Para acrescentar depois: abra a aba **DNS**, confirme que todo registro A, AAAA
ou CNAME que serve web fala HTTPS, e então marque *Include subdomains* em
**SSL/TLS → Edge Certificates → HTTP Strict Transport Security**. Deixe
*Preload* desmarcado — sair da lista de preload leva meses.

### O que falta: a Compression Rule

O token usado tinha `Zone:Read`, `Zone Settings:Edit`, `Cache Rules:Edit`,
`Transform Rules:Edit` e `Config Rules:Edit`, e mesmo a **leitura** da fase
`http_response_compression` respondeu *request is not authorized* — é permissão
separada, não coberta por nenhuma dessas.

Dois caminhos:

1. **Pelo painel**, que é mais rápido: *Rules → Compression Rules → Create rule*,
   com a expressão da seção 2 e a ordem brotli → gzip → none.
2. **Por API**, acrescentando ao token a permissão de compressão de resposta
   (na lista de *Zone*, procure por *Response Compression*).

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
