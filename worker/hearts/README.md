# NIPS-CERN hearts

A tiny like counter for the static site, running on Cloudflare Workers + D1.
GitHub Pages cannot store shared state, so this small Worker does it. Data is
ours, it runs on the same Cloudflare account we already use, and the free tier
covers our traffic comfortably.

## What it stores

- `hearts(slug, count)` — one row per news post.
- `hearts_votes(slug, voter, created_at)` — one row per (post, device). `voter`
  is `SHA-256(ip | user-agent | salt)`, never the raw IP. It is a soft guard
  against casual double-voting, not a real identity. The browser also keeps a
  localStorage flag so the heart stays marked on return visits.

## One-time deploy

From this folder (`worker/hearts`):

```sh
# 0. Make your local config from the example (wrangler.toml is gitignored, so
#    the real database_id never lands in the public repo).
cp wrangler.toml.example wrangler.toml

npm i -g wrangler            # or use: npx wrangler ...
wrangler login

# 1. Create the D1 database, then paste the printed database_id into wrangler.toml
wrangler d1 create nipscern-hearts

# 2. Create the tables (remote = the real database Cloudflare runs)
wrangler d1 execute nipscern-hearts --remote --file=schema.sql

# 3. Set a random secret salt (any long random string)
wrangler secret put SALT

# 4. Deploy
wrangler deploy
```

`wrangler deploy` prints the live URL, e.g.
`https://nipscern-hearts.<your-subdomain>.workers.dev`.

## Point the site at it

Open `assets/js/hearts.js` and set `API_BASE` to that URL (or, before the module
loads, set `window.HEARTS_API_BASE`). That is enough to test end to end.

## Later: same-domain, no CORS

When you are happy with it, drop the `workers.dev` URL and serve the Worker from
our own domain so there is no cross-origin call at all. Uncomment the `[[routes]]`
block in `wrangler.toml` (`www.nipscern.com/api/hearts*`), redeploy, and set
`API_BASE = '/api'` in `hearts.js`. Cloudflare intercepts that path before it
reaches GitHub Pages.

## Endpoints

- `GET /hearts` -> `{ counts: { slug: n, ... } }` (used to rank / show totals)
- `GET /hearts?slug=SLUG` -> `{ slug, count, liked }`
- `POST /hearts` body `{ "slug": "SLUG" }` -> `{ slug, count, liked }` (toggles)

## Notes / next steps

- Abuse hardening: Cloudflare already rate-limits at the edge. If bots become a
  problem, add a free Cloudflare Turnstile token check to the POST handler.
- `created_at` is stored so we can later show "most loved in the last 30 days"
  instead of only all-time totals.
- Free tier limits (Workers 100k req/day, D1 generous read/write) are far above
  our traffic; nothing here is metered by pageviews.
