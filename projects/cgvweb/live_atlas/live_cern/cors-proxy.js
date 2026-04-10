/**
 * cors-proxy.js — Cloudflare Worker
 *
 * Deploy once, then set WORKER_URL in live_poller.js to your worker's URL.
 *
 * DEPLOY STEPS:
 *   1. Go to https://workers.cloudflare.com/ and create a free account
 *   2. Click "Create a Service" → name it e.g. "atlas-cors-proxy"
 *   3. Paste this entire file into the editor and click "Save and Deploy"
 *   4. Copy the worker URL (e.g. https://atlas-cors-proxy.YOUR-SUBDOMAIN.workers.dev)
 *   5. Set that URL as WORKER_URL at the top of live_poller.js
 *
 * SECURITY:
 *   The worker only forwards requests to atlas-live.cern.ch.
 *   All other targets are rejected with 403.
 */

const ALLOWED_ORIGIN_HOST = 'atlas-live.cern.ch';

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders('*') });
    }

    const url    = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return jsonError(400, 'Missing ?url= parameter');
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return jsonError(400, 'Invalid URL');
    }

    if (targetUrl.hostname !== ALLOWED_ORIGIN_HOST) {
      return jsonError(403, `Forbidden: only ${ALLOWED_ORIGIN_HOST} is allowed`);
    }

    // Forward the request
    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), {
        method:  'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (ATLAS TileCal Viewer; CERN)',
          'Accept':     'text/html,application/xml,text/xml,*/*',
        },
        cf: { cacheTtl: 0 },
      });
    } catch (e) {
      return jsonError(502, `Upstream fetch failed: ${e.message}`);
    }

    // Always return 200 to the browser so the client can read the body.
    // The real upstream status is passed in X-Upstream-Status.
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status:  200,
      headers: {
        ...Object.fromEntries(upstream.headers),
        ...corsHeaders('*'),
        'X-Upstream-Status': String(upstream.status),
        'Cache-Control': 'no-store',
      },
    });
  },
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders('*'), 'Content-Type': 'application/json' },
  });
}
