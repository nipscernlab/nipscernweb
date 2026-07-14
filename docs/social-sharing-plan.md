# Compartilhamento de notícias nas redes — estudo e plano

Status: em implementação. Fase 4 (painel de compartilhamento) concluída em
2026-07-14. Data do estudo: 2026-07-14.

Objetivo: em cada notícia, permitir que qualquer visitante compartilhe a notícia
nas redes com imagens prontas e bonitas, feitas pelo laboratório, e que o
laboratório também possa (opcionalmente) publicar de forma automatizada nas
contas oficiais.

---

## 1. Decisões do cliente (comentários registrados)

Requisitos definidos até aqui:

- Gerar imagens nos formatos mais comuns de Instagram e LinkedIn.
- A pessoa baixa facilmente qualquer imagem da notícia e posta ela mesma, com a
  legenda que quiser. As imagens são do laboratório.
- Variantes desejadas por notícia: capa crua; capa com título em pt; capa com
  título em en; larguras/alturas diferentes; logo do lab; nome do lab.
- LinkedIn (que permite criar post): caprichar. Sempre mostrar o link da notícia
  original.
- Botões de WhatsApp, X e Telegram: incluir. Todos com o ícone correto do site.
  A maioria acessa pelo celular, então abrir o app da pessoa automaticamente.
- A pessoa já está logada na conta dela.
- Instagram: se for difícil ou inviável publicar de fato via API, priorizar
  publicações no LinkedIn.
- Ordem de trabalho: salvar o estudo e os comentários, montar o plano e só depois
  implementar.

## 2. Estudo de viabilidade (resumo)

São dois problemas separados: gerar a imagem e publicar. Tratá-los juntos gera
expectativa errada.

Gerar a imagem por notícia, automaticamente, é totalmente viável e é a parte que
entrega a maior parte do valor.

Publicar é onde as plataformas impõem limites:

- Instagram não tem "intent" web para pré-preencher um story. Postar de verdade
  por API só é possível na conta do próprio lab (conta Professional ligada a uma
  Página do Facebook, app Meta com `instagram_content_publish`, App Review, token
  de longa duração). Um visitante qualquer postar no story dele não dá para
  automatizar na web aberta. O caminho realista para o visitante é: entregar a
  imagem (Web Share no celular, download no desktop) e a pessoa finaliza no app.
- LinkedIn é mais simples. Compartilhar o link com preview rico é imediato via URL
  de share; postar na Página do lab é possível via API (com token em segredo).

Consequência prática: "eu publico e vai pro Instagram" só é automático para a
conta oficial do lab. "Qualquer um compartilha com a imagem" é viável, com a
pessoa dando o toque final no app.

## 3. Restrições do repositório e infraestrutura a confirmar

- Site estático, com `.github/workflows/size-guard.yml` guardando o tamanho do
  repositório. Não commitar dezenas de imagens grandes; usar o CDN
  (`cdn.nipscern.com`, como as capas de notícia já fazem) ou geração sob demanda.
- Já existem Cloudflare Workers no projeto (`worker/hearts/` com D1, mais dois em
  `workers/`). Há capacidade server-side com segredos fora do código aberto.
- A página de notícia (`news/post.html`) é renderizada no cliente: o post é
  carregado por JS a partir do slug, e as tags Open Graph são defaults estáticos
  atualizados em runtime. Crawlers de Instagram, LinkedIn, WhatsApp, X e Facebook
  não executam JS, então hoje o preview por notícia é genérico. Corrigir isso é
  pré-requisito para qualquer compartilhamento de link ficar bom.
- Confirmar: `nipscern.com` está atrás do Cloudflare (proxy laranja) ou é GitHub
  Pages puro? A presença de `_headers` e dos Workers sugere Cloudflare no caminho.
  Isso decide se dá para injetar OG e gerar imagem sob demanda num Worker, ou se
  precisa ser tudo build-time estático.

## 4. Arquitetura recomendada

Gerador de imagem: um único crate Rust usando `resvg` + `usvg` + `tiny-skia`,
com `fontdb` carregando as fontes do site embutidas (DM Serif Display para o
título, Inter para apoio). O layout de cada formato é um template SVG
parametrizável (capa, título, idioma, badges, logo). É o "rust compactado":
binário pequeno, sem dependência de sistema, e o mesmo código compila para WASM
se precisar rodar no Worker ou no cliente.

Entrega das imagens, duas opções conforme a infra do item 3:

- Opção A (recomendada se Cloudflare está na frente): um Worker (Rust para WASM)
  serve `GET /share/<slug>/<formato>-<lang>.jpg`, gerado na primeira requisição e
  cacheado no edge. Sem armazenamento, sem passo de upload, e o mesmo Worker
  injeta as tags OG por post. Evita gerar e guardar ~15 imagens por notícia.
- Opção B (GitHub Pages puro): as imagens são geradas no GitHub Actions ao
  publicar a notícia e enviadas ao CDN; um passo do build gera também um HTML
  estático por post com as tags OG corretas.

Cliente: um painel de compartilhamento e download em cada notícia (detalhes no
item 7).

## 5. Formatos de imagem a gerar

Por notícia, por idioma (pt e en), mais uma variante crua sem texto:

- Instagram stories/reels: 1080x1920 (9:16)
- Instagram feed quadrado: 1080x1080 (1:1)
- Instagram feed retrato: 1080x1350 (4:5)
- LinkedIn / Open Graph paisagem: 1200x627 (1.91:1)
- LinkedIn quadrado: 1200x1200 (1:1), opcional
- X/Twitter usa o mesmo da paisagem OG (1200x628)
- Capa crua reenquadrada para cada tamanho, sem título

São da ordem de 15 imagens por notícia (5 formatos com texto x 2 idiomas, mais as
cruas). Esse volume é o principal argumento a favor da geração sob demanda com
cache (Opção A). Para a publicação via API do Instagram (Fase 5), gerar em JPEG,
que é o formato exigido pelo container de imagem da Graph API.

## 6. Template da imagem ("queimado")

- Fundo: a capa da notícia preenchendo o quadro (cover/crop para o formato), com
  um gradiente escuro para dar legibilidade ao texto.
- Título: no serif do site (DM Serif Display), em pt ou en conforme a variante,
  com quebra de linha cuidada. Badge de categoria e data opcionais.
- Marca: logo do lab, wordmark "NIPS-CERN" e "nipscern.com".
- Acentos em `#7cb5ff` / `#5b9cf6`.
- Variante crua: apenas a capa reenquadrada, sem texto nem marca (para quem quer a
  imagem limpa).

Fontes precisam ser embutidas no gerador (arquivos TTF), já que o resvg não busca
fontes do sistema de forma confiável no CI/Worker.

## 7. Interface de compartilhamento e central de download

Em cada post (e possivelmente nos cards da lista), um botão "Compartilhar" abre um
painel com:

- Linha de botões sociais com os ícones de marca do Phosphor (o mesmo conjunto de
  ícones que o site já carrega): `ph-linkedin-logo`, `ph-instagram-logo`,
  `ph-whatsapp-logo`, `ph-x-logo`, `ph-telegram-logo` e `ph-link` para copiar o
  link. No celular, abrem o app da pessoa.
- Seção "Baixar imagens": abas de idioma (pt/en) e de formato/plataforma, com uma
  grade de miniaturas, cada uma com botão de download.
- LinkedIn caprichado: botão para copiar uma legenda sugerida (texto pronto mais o
  link da notícia), botão para baixar a imagem no formato LinkedIn e botão para
  abrir o LinkedIn. Com o OG corrigido, colar só o link já gera um unfurl bonito.

## 8. Botões sociais (deep links e abertura de app)

- WhatsApp: `https://wa.me/?text=<texto+url>` (no celular abre o app).
- X: `https://twitter.com/intent/tweet?text=<texto>&url=<url>` (ou `x.com/intent/post`).
- Telegram: `https://t.me/share/url?url=<url>&text=<texto>`.
- LinkedIn (compartilhar link): `https://www.linkedin.com/sharing/share-offsite/?url=<url>`.
- Instagram: não há intent web; usar `navigator.share({ files: [blob] })` no
  celular e download no desktop.
- Copiar link: `navigator.clipboard`.
- Preferir Web Share quando `navigator.canShare` existir (tipicamente mobile).

Todos os textos de compartilhamento sempre incluem o link da notícia original.

## 9. Correção de Open Graph por post (pré-requisito)

Para o preview por notícia funcionar em todas as redes:

- Via Worker: injeta `og:title`, `og:description`, `og:image`, `og:url` por slug
  na resposta HTML. É o caminho mais limpo se o Cloudflare está na frente.
- Ou HTML estático por post gerado no build (bom para GitHub Pages puro).
- `og:image` aponta para a variante paisagem 1200x627 com o título no idioma
  padrão do post. Manter `twitter:card = summary_large_image` (já existe) e
  atualizá-lo por post.
- URLs amigáveis (`/news/<slug>`) seriam melhores que `post.html?...`; avaliar
  reescrita no Worker.

## 10. Fase opcional: publicação automática nas contas do lab

- LinkedIn (prioritário): postar na Página do lab via LinkedIn Posts/UGC API
  (OAuth, App Review, token em segredo do Actions ou Worker), anexando a imagem
  gerada e o link. Com etapa de aprovação humana antes de publicar.
- Instagram: só na conta Business/Creator do lab via Graph API (container de
  imagem JPEG em URL pública, depois `media_publish`; stories tem suporte mais
  restrito, confirmar na doc atual da Meta). Se o custo/burocracia não compensar,
  focar no LinkedIn, conforme decisão do cliente.
- Segredos nunca no repositório aberto; sempre em GitHub Actions Secrets ou
  secrets do Worker.

## 11. Plano de implementação por fases

Fase 0 — Fundações
- Confirmar infraestrutura (Cloudflare na frente ou GitHub Pages puro).
- Escolher entrega das imagens (Worker sob demanda com cache, ou build mais CDN).
- Reunir assets: logo(s) do lab e fontes TTF (DM Serif Display, Inter) para
  embutir no gerador.

Fase 1 — Gerador de imagens (Rust)
- Crate com resvg mais template SVG parametrizável (capa, título, idioma, formato).
- CLI que lê `data/news.json` e produz as imagens de um slug/idioma/formato.
- Validar visualmente com 2 ou 3 notícias reais.

Fase 2 — Entrega das imagens
- Worker Rust para WASM em `/share/...` com cache no edge (Opção A), ou passo de
  build que envia ao CDN (Opção B).

Fase 3 — Open Graph por post
- Worker injeta OG por slug, ou HTML estático por post no build.

Fase 4 — Interface no cliente
- Painel de compartilhamento e download, ícones de marca do Phosphor, deep links e
  Web Share.
- Legenda sugerida para o LinkedIn com o link da notícia.

Fase 5 — (opcional) Publicação automática
- LinkedIn na Página do lab com aprovação humana. Instagram como esforço melhor,
  só se compensar.

O primeiro corte útil ("publiquei e qualquer um compartilha com imagem bonita")
são as Fases 1 a 4, sem depender de aprovação de API de nenhuma plataforma.

## 12. Questões abertas

- Infra: Cloudflare na frente do domínio, ou GitHub Pages puro?
- Armazenamento das imagens: sob demanda com cache, ou build mais CDN?
- Idioma padrão do OG por post: o do post, ou o do visitante?
- Quais formatos entram no MVP (sugestão: stories 9:16, quadrado 1:1 e paisagem
  1.91:1, em pt e en, mais a capa crua)?
- Quais arquivos de logo e de fonte usar no template.
- A Fase 5 (auto-post) entra agora ou fica para depois?

## 13. Decisões e progresso (2026-07-14)

Decisões do cliente nesta rodada:

- Infra: **a confirmar**. Indícios fortes de Cloudflare na frente (Workers
  roteados no domínio: `worker/hearts` com D1 e `workers/publications-redirect.js`
  fazendo redirect ao vivo só funcionam com o tráfego passando pelo Cloudflare).
  Falta confirmar no painel se o proxy laranja está ligado para `www.nipscern.com`.
  Isso decide entre Opção A (Worker sob demanda + injeção de OG) e Opção B (build
  + CDN). **Bloqueia as Fases 1–3.**
- Primeiro incremento: **Fase 4 (painel de compartilhamento)** — feito.
- Fase 5 (auto-post na conta do lab): **adiada**. Em vez de publicar pela conta
  oficial, o foco é um **sistema genérico para qualquer conta** — o visitante
  compartilha com as contas dele, via deep links e Web Share. "Deixar a conta
  logada" (publicação pela conta do lab) fica para depois.

Implementado na Fase 4 (`news/post.html` + `assets/css/main.css` + `data/i18n.json`):

- Painel de compartilhamento no rodapé de cada notícia com os ícones de marca do
  Phosphor: WhatsApp, X, Telegram, LinkedIn, copiar link e Web Share nativo
  (aparece só quando `navigator.share` existe — tipicamente celular).
- Deep links que abrem o app da pessoa: `wa.me`, `twitter.com/intent/tweet`,
  `t.me/share/url`, `linkedin.com/sharing/share-offsite`. Todos carregam sempre o
  link canônico de produção da notícia.
- Botão "Copiar legenda pro LinkedIn" (título + resumo + link, prontos para colar).
- Tudo localizado (en/pt/fr/no) e reconstruído ao trocar de idioma.

Próximos passos (em ordem):

1. Confirmar a infra (item bloqueante) para escolher Opção A ou B.
2. Fase 1 — gerador de imagens em Rust (resvg). Precisa dos assets: logo(s) do
   lab e fontes TTF (DM Serif Display, Inter) para embutir.
3. Fase 3 — Open Graph por post (Worker ou HTML estático), pré-requisito para o
   unfurl bonito do link.
4. Fase 2 — entrega das imagens (Worker sob demanda ou build + CDN).
5. Ampliar o painel da Fase 4 com a seção "Baixar imagens" (grade de miniaturas
   por idioma/formato) assim que o gerador existir.
