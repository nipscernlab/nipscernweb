# share-gen — gerador local de imagens de compartilhamento + Open Graph

Gera, **no seu computador e de graça** (sem servidor, sem Worker pago), as
imagens de compartilhamento de cada notícia e as páginas de Open Graph por post.
É a Opção B do `docs/social-sharing-plan.md` (build-time + CDN), feita em Rust.

## O que ele produz

Para cada notícia (de `data/news.json` e `data/news-featured.json`):

- **Imagens** em `dist/share/<slug>/` — JPEG, todos os formatos:
  `og`, `square`, `portrait`, `story` (com título em `pt`/`en`) e `raw`,
  `rawsquare`, `rawstory` (capa limpa, sem texto). → **subir para o CDN**.
- **Página de OG** em `../../news/<slug>.html` — HTML mínimo com as tags
  `og:*`/`twitter:*`/`canonical` corretas (imagem apontando pro CDN). Redireciona
  humanos pro SPA (`/news/post?id=<slug>`) e entrega o preview certo pros crawlers
  do LinkedIn/WhatsApp/X. → **commitar no repo**.

O mesmo template SVG alimenta todos os formatos: capa recortada + scrim escuro,
data, faixa de colmeia neon que termina no topo do título, e atrás do título o
"event display" da casa — brilho azul profundo subindo do canto e trajetórias
curvas de partículas com pontos de hit. Título em DM Serif Display, marca
NIPS⚛CERN. As capas `.webp` são decodificadas nativamente (crate `image`).
Render em 3× com downscale Lanczos (texto nítido), JPEG em qualidade alta.

## Rodar

Precisa só do **Rust** (`cargo`). Nada de pagar, nada de servidor.

```bash
cd tools/share-gen
cargo run --release              # todas as notícias
cargo run --release -- <slug>    # só uma (ou várias) notícia(s)
```

Saída:
- `tools/share-gen/dist/share/<slug>/*.jpg`  (git-ignored — vai pro CDN)
- `news/<slug>.html`                          (commitar)

## Fluxo ao publicar/editar uma notícia

1. `cargo run --release` (ou passe o slug da notícia nova).
2. **Suba** `dist/share/<slug>/*.jpg` para o CDN, em
   `cdn.nipscern.com/share/<slug>/…` (o mesmo repositório de assets das capas).
3. **Commite** o novo `news/<slug>.html` e dê push (GitHub Pages, grátis).

Pronto: o link `https://www.nipscern.com/news/<slug>` fica com preview bonito, e
a seção "Baixar imagens" da notícia passa a servir os formatos a partir do CDN.

## Como o cliente usa

- O painel de compartilhamento (`news/post.html`) compartilha a URL
  `https://www.nipscern.com/news/<slug>` (a página de OG).
- A grade "Baixar imagens" aponta para `cdn.nipscern.com/share/<slug>/<formato>-<lang>.jpg`.

## Cache do CDN (IMPORTANTE ao atualizar imagens)

O Cloudflare cacheia as imagens do CDN por **1 ano** (`max-age=31536000`). Se você
regerar e subir imagens com o mesmo nome, o CDN continua servindo a versão antiga.
Por isso as URLs levam um cache-buster `?v=N`:

- `IMG_VER` em `src/main.rs` (usado no `og:image` das páginas de OG)
- `CDN_VER` em `news/post.html` (usado nas miniaturas/downloads)

**Ao regerar imagens: incremente os dois (mantenha iguais)**, regere as páginas de
OG (`cargo run`) e commite. Alternativa: purgar o cache do Cloudflare para
`cdn.nipscern.com/share/*` no painel (aí não precisa bumpar o `?v`).

## Notas

- **Sem custo**: tudo roda localmente; hospedagem é GitHub Pages + o CDN que já existe.
- **Contraste**: o gradiente escuro (scrim) sobre a capa garante leitura do título;
  se alguma capa muito clara pedir mais contraste, dá para reforçar o scrim em
  `src/main.rs` (gradiente `#scrim`).
- **Fontes**: DM Serif Display e Inter, SIL Open Font License (em `fonts/`).
- Dependências: `resvg` (render), `image` (webp/jpeg), `serde_json`, `ureq`, `base64`.
