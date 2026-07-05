/**
 * NIPS-CERN hearts — a tiny like counter for the static site.
 *
 * Backed by Cloudflare D1 (SQLite). Two tables:
 *   hearts        (slug, count)              one row per news post
 *   hearts_votes  (slug, voter, created_at)  one row per (post, device)
 *
 * "voter" is a SHA-256 hash of IP + User-Agent + a secret salt. It is a soft
 * guard against casual double-voting, not a real identity: shared networks and
 * changing IPs make it approximate. The client also keeps a localStorage flag,
 * so the heart stays marked on return visits. Neither side stores the raw IP.
 *
 * Endpoints:
 *   GET  /hearts              -> { counts: { slug: n, ... } }   (for ranking/lists)
 *   GET  /hearts?slug=SLUG    -> { slug, count, liked }
 *   POST /hearts  {slug}      -> { slug, count, liked }         (toggles this voter)
 */

const ALLOWED_ORIGINS = new Set([
  'https://nipscern.com',
  'https://www.nipscern.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,127}$/i;

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.nipscern.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, origin, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

async function voterId(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ua = request.headers.get('User-Agent') || '';
  const salt = env.SALT || 'change-me';
  const bytes = new TextEncoder().encode(`${ip}|${ua}|${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (!url.pathname.replace(/\/+$/, '').endsWith('/hearts')) {
      return json({ ok: true, service: 'nipscern-hearts' }, origin);
    }

    try {
      if (request.method === 'GET') {
        const slug = url.searchParams.get('slug');
        if (slug) {
          if (!SLUG_RE.test(slug)) return json({ error: 'bad slug' }, origin, 400);
          const voter = await voterId(request, env);
          const row = await env.DB.prepare('SELECT count FROM hearts WHERE slug = ?').bind(slug).first();
          const vote = await env.DB
            .prepare('SELECT 1 FROM hearts_votes WHERE slug = ? AND voter = ?')
            .bind(slug, voter)
            .first();
          return json({ slug, count: row ? row.count : 0, liked: !!vote }, origin);
        }
        const { results } = await env.DB.prepare('SELECT slug, count FROM hearts').all();
        const counts = {};
        for (const r of results) counts[r.slug] = r.count;
        return json({ counts }, origin);
      }

      if (request.method === 'POST') {
        let body = {};
        try { body = await request.json(); } catch (_) {}
        const slug = body && body.slug;
        if (!slug || !SLUG_RE.test(slug)) return json({ error: 'bad slug' }, origin, 400);

        const voter = await voterId(request, env);
        const existing = await env.DB
          .prepare('SELECT 1 FROM hearts_votes WHERE slug = ? AND voter = ?')
          .bind(slug, voter)
          .first();

        let liked;
        if (existing) {
          await env.DB.batch([
            env.DB.prepare('DELETE FROM hearts_votes WHERE slug = ? AND voter = ?').bind(slug, voter),
            env.DB.prepare('UPDATE hearts SET count = MAX(count - 1, 0) WHERE slug = ?').bind(slug),
          ]);
          liked = false;
        } else {
          await env.DB.batch([
            env.DB
              .prepare('INSERT INTO hearts_votes (slug, voter, created_at) VALUES (?, ?, ?)')
              .bind(slug, voter, Date.now()),
            env.DB
              .prepare('INSERT INTO hearts (slug, count) VALUES (?, 1) ON CONFLICT(slug) DO UPDATE SET count = count + 1')
              .bind(slug),
          ]);
          liked = true;
        }

        const row = await env.DB.prepare('SELECT count FROM hearts WHERE slug = ?').bind(slug).first();
        return json({ slug, count: row ? row.count : 0, liked }, origin);
      }

      return json({ error: 'method not allowed' }, origin, 405);
    } catch (err) {
      return json({ error: 'server error', detail: String(err && err.message || err) }, origin, 500);
    }
  },
};
