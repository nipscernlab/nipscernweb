// ---------------------------------------------------------------------------
// nipscern.com share Worker
//
//   1. GET /share/<slug>/<format>[-<lang>].png
//         → generates the social image on demand (resvg) and caches it at the
//           edge. Formats: og, square, portrait, story (with pt/en text) and
//           raw / rawstory / rawsquare (clean cover, no text).
//   2. /news/post(.html)?id=<slug>  (HTML navigations)
//         → injects per-post Open Graph / Twitter tags so link unfurls are
//           correct on LinkedIn, WhatsApp, X, Facebook, etc. (crawlers don't
//           run the page's JS, so the static defaults would otherwise show).
//   3. everything else → passed through to the origin unchanged.
//
// Deploy notes live in ../README.md. Image generation needs Workers Paid
// (CPU-bound); the OG injection alone is cheap.
// ---------------------------------------------------------------------------
import { renderShare } from './render.js';
import { FORMATS } from './template.js';
import { findPost, resolveShareMeta, titleFor } from './posts.js';

const SITE = 'https://www.nipscern.com';
const TEXT_LANGS = ['en', 'pt', 'fr', 'no'];

let dataCache = null;
/** Load news.json + news-featured.json from the origin, cached per isolate. */
async function loadData(origin) {
  if (dataCache) return dataCache;
  const opt = { cf: { cacheEverything: true, cacheTtl: 300 } };
  const [newsRes, featRes] = await Promise.all([
    fetch(new URL('/data/news.json', origin), opt),
    fetch(new URL('/data/news-featured.json', origin), opt),
  ]);
  const news = newsRes.ok ? await newsRes.json() : [];
  let featured = null;
  try { featured = featRes.ok ? await featRes.json() : null; } catch { /* optional */ }
  dataCache = { news, featured };
  return dataCache;
}

/** Parse "og-en", "story-pt", "raw", "rawstory" → { format, lang, withText }. */
function parseImageName(name) {
  const base = name.replace(/\.png$/i, '');
  // text formats: "<format>-<lang>"
  const m = base.match(/^([a-z]+)-([a-z]{2})$/i);
  if (m && FORMATS[m[1]] && FORMATS[m[1]].text && TEXT_LANGS.includes(m[2])) {
    return { format: m[1], lang: m[2], withText: true };
  }
  // raw formats: the whole name is the key
  if (FORMATS[base] && !FORMATS[base].text) {
    return { format: base, lang: 'en', withText: false };
  }
  return null;
}

async function handleShare(request, url, ctx, base) {
  // /share/<slug>/<file>.png
  const parts = url.pathname.split('/').filter(Boolean); // ['share', slug, file]
  if (parts.length !== 3) return new Response('Not found', { status: 404 });
  const slug = decodeURIComponent(parts[1]);
  const parsed = parseImageName(parts[2]);
  if (!parsed) return new Response('Unknown format', { status: 404 });

  // Edge cache: serve a hit immediately.
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const { news, featured } = await loadData(base);
  const post = findPost(news, featured, slug);
  if (!post) return new Response('Post not found', { status: 404 });

  const meta = resolveShareMeta(post, parsed.withText ? parsed.lang : 'en');
  const wParam = parseInt(url.searchParams.get('w') || '', 10);
  const width = Number.isFinite(wParam) ? wParam : 0;
  let png;
  try {
    png = await renderShare({ format: parsed.format, meta, withText: parsed.withText, width });
  } catch (e) {
    return new Response('Render error: ' + (e && e.message), { status: 500 });
  }

  const resp = new Response(png, {
    headers: {
      'content-type': 'image/png',
      // A day in the browser, a month at the edge; regenerates after that.
      'cache-control': 'public, max-age=86400, s-maxage=2592000',
      'x-generated-by': 'nipscern-share-worker',
    },
  });
  ctx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

/** Inject per-post OG/Twitter tags into the post HTML for crawlers. */
async function handleOgInjection(request, url, base) {
  const params = url.searchParams;
  const slug = params.get('id') || params.get('slug');
  // Fetch the real HTML file from the origin (explicit .html avoids depending
  // on clean-URL rewriting and never loops back into this worker's route).
  const originUrl = new URL('/news/post.html' + url.search, base);
  const originResp = await fetch(originUrl.toString(), { cf: { cacheTtl: 60 } });
  if (!slug) return originResp;

  const ct = (originResp.headers.get('content-type') || '');
  if (!ct.includes('text/html')) return originResp;

  const { news, featured } = await loadData(base);
  const post = findPost(news, featured, slug);
  if (!post) return originResp;

  const lang = 'en'; // OG default: the post's primary (top-level) language
  const title = (titleFor(post, lang) || 'NIPS-CERN') + ' — NIPS-CERN';
  const desc = (post.excerpt || (post.translations && post.translations[lang] && post.translations[lang].excerpt) || 'News from NIPS-CERN.').slice(0, 300);
  const canonical = `${SITE}/news/post?id=${encodeURIComponent(slug)}`;
  const image = `${SITE}/share/${encodeURIComponent(slug)}/og-${lang}.png`;
  const setContent = (content) => ({ element(el) { el.setAttribute('content', content); } });

  return new HTMLRewriter()
    .on('title#page-title', { element(el) { el.setInnerContent(title); } })
    .on('meta#page-desc', setContent(desc))
    .on('meta#og-title', setContent(title))
    .on('meta#og-desc', setContent(desc))
    .on('meta#og-url', setContent(canonical))
    .on('meta#og-image', setContent(image))
    .on('head', {
      element(el) {
        el.append(`<meta name="twitter:image" content="${image}">`, { html: true });
        el.append(`<meta name="twitter:title" content="${escapeAttr(title)}">`, { html: true });
        el.append(`<meta name="twitter:description" content="${escapeAttr(desc)}">`, { html: true });
        el.append(`<link rel="canonical" href="${canonical}">`, { html: true });
      },
    })
    .transform(originResp);
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const base = (env && env.ORIGIN) || url.origin;

    if (request.method === 'GET' && url.pathname.startsWith('/share/')) {
      return handleShare(request, url, ctx, base);
    }

    // OG injection on the client-rendered post page. We intercept only the
    // canonical extensionless path (the one the share panel emits) and fetch
    // the unrouted "/news/post.html" from origin — so the worker never recurses.
    if (request.method === 'GET' && url.pathname === '/news/post') {
      return handleOgInjection(request, url, base);
    }

    // Everything else: origin passthrough. In production the worker shares the
    // host with the site, so fetch(request) hits the origin. With an ORIGIN
    // override (local dev), proxy to that origin instead.
    if (base !== url.origin) {
      return fetch(new URL(url.pathname + url.search, base), request);
    }
    return fetch(request);
  },
};
