# nipscern-share — Worker de compartilhamento

Worker Cloudflare que entrega **imagens de compartilhamento sob demanda** e injeta
**Open Graph por notícia**. É a Opção A do `docs/social-sharing-plan.md` (Cloudflare
na frente do domínio — já confirmado).

O que ele faz:

1. `GET /share/<slug>/<formato>[-<lang>].png` — gera a imagem da notícia na hora
   (resvg), cacheada no edge. Formatos: `og`, `square`, `portrait`, `story` (com
   título em `pt`/`en`) e `raw`, `rawsquare`, `rawstory` (capa limpa, sem texto).
   Aceita `?w=<px>` para uma versão menor (usado nas miniaturas do site).
2. `GET /news/post?id=<slug>` — busca o HTML no origin e injeta
   `og:title/description/image/url`, `twitter:*` e `canonical` corretos por post
   (crawlers não rodam o JS da página, então sem isto o preview fica genérico).
3. Qualquer outra rota é repassada ao origin sem alteração.

## Como a imagem é feita

- Template SVG único em `src/template.js` (fundo = capa recortada + gradiente,
  badge da categoria, data, título em DM Serif Display, marca NIPS⚛CERN +
  `nipscern.com`). O mesmo template alimenta o preview local e o Worker.
- `src/render.js` rasteriza o SVG com **resvg-wasm**. As capas são `.webp` (resvg
  não decodifica webp), então são decodificadas com **@jsquash/webp** e
  re-codificadas em PNG antes de embutir.
- Fontes OFL embutidas em `fonts/` (DM Serif Display, Inter).

## Rodar localmente

```bash
cd worker/share
npm install

# 1) sirva o site estático (para /data/*.json e o HTML das notícias)
#    na raiz do repo, em outro terminal:
python -m http.server 8099 --bind 127.0.0.1

# 2) suba o Worker apontando o ORIGIN para esse servidor:
npx wrangler dev --port 8788 --var ORIGIN:http://127.0.0.1:8099 --local
```

Teste:

- Imagem: <http://127.0.0.1:8788/share/tmdb-retirement-end-of-an-era/og-en.png>
- Miniatura: adicione `?w=360`
- OG: `curl "http://127.0.0.1:8788/news/post?id=tmdb-retirement-end-of-an-era"`

### Preview das imagens sem o Worker

```bash
cd worker/share
npm install
node preview.mjs                 # 3 primeiras notícias, todos os formatos
node preview.mjs <slug> <slug>   # notícias específicas
# saída em tools/share-out/ (git-ignored)
```

## Deploy (o que você precisa configurar)

1. **Workers Paid.** A geração de imagem é CPU-bound e estoura o limite de CPU do
   plano free. A injeção de OG sozinha roda no free, mas as imagens precisam do
   plano pago (Workers Paid, ~US$5/mês).
2. Login e deploy:
   ```bash
   cd worker/share
   npx wrangler login
   npx wrangler deploy
   ```
3. **Rotas** (Dashboard → Workers Routes, ou descomente em `wrangler.toml`):
   - `nipscern.com/share/*` e `www.nipscern.com/share/*`
   - `nipscern.com/news/post` e `www.nipscern.com/news/post`
     (apenas o caminho **sem** `.html` — o Worker busca o `/news/post.html` no
     origin, que deve ficar **fora** das rotas para nunca reentrar no Worker).
4. Pronto. A seção "Baixar imagens" de cada notícia e os previews de link nas
   redes passam a funcionar automaticamente (apontam para `/share/...`).

### Observações

- **Cache**: imagens saem com `s-maxage` de 30 dias no edge + cache interno do
  Worker (`caches.default`). Se um título/capa mudar, a imagem regenera após o TTL.
- **cdn.nipscern.com**: precisa estar acessível ao Worker (é de onde vem a capa).
- **Idioma do OG**: usa o idioma principal do post (`en`, campos de topo). O painel
  no cliente oferece pt/en para download.
- **Tamanho do bundle**: resvg + jsquash somam alguns MB (ok no limite de 10 MB do
  Workers Paid). No plano free (1 MB) não cabe — outra razão para o plano pago.

## Licenças de terceiros

- Fontes **DM Serif Display** e **Inter**: SIL Open Font License (redistribuíveis).
- Ícones de marca do painel de compartilhamento (no `news/post.html`): **Simple
  Icons** (CC0).
- `@resvg/resvg-wasm`, `@jsquash/webp`, `@jsquash/png`: MIT/Apache.
