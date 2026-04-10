/**
 * live_poller.js — ATLAS Live Event Poller
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SET YOUR WORKER URL BELOW after deploying cors-proxy/cors-proxy.js │
 * │  to Cloudflare Workers (free tier — 100k requests/day).             │
 * │  Instructions are at the top of cors-proxy.js.                      │
 * └─────────────────────────────────────────────────────────────────────┘
 */
const WORKER_URL = 'https://atlas-cors-prox.nipscernlab.workers.dev/';  // e.g. 'https://atlas-cors-proxy.you.workers.dev'

// ─────────────────────────────────────────────────────────────────────────────

const LATEST_URL = 'https://atlas-live.cern.ch/latest';
const BASE_URL   = 'https://atlas-live.cern.ch';
const CACHE_NAME = 'atlas-live-xml-v2';
const MAX_CACHED = 10;
const POLL_MS    = 5_000;

/**
 * Proxy candidates, evaluated in order.
 * type 'raw'  → fetch(prefix + encodeURIComponent(url)) → .text()
 * type 'json' → fetch(prefix + encodeURIComponent(url)) → .json() → .contents
 * type 'qs'   → fetch(prefix + '?url=' + encodeURIComponent(url)) → .text()
 *               (used for the Cloudflare Worker which takes ?url=)
 */
function buildProxies() {
  const list = [
    // Direct — works if the browser is on the CERN network or CORS is enabled
    { label: 'direct',       prefix: '',                                             type: 'raw'  },
  ];

  // Own Cloudflare Worker — most reliable, set WORKER_URL to enable
  if (WORKER_URL) {
    list.unshift(
      { label: 'cf-worker', prefix: `${WORKER_URL.replace(/\/$/, '')}?url=`, type: 'raw' }
    );
  }

  // Public fallbacks (best-effort)
  list.push(
    { label: 'allorigins',   prefix: 'https://api.allorigins.win/get?url=',          type: 'json' },
    { label: 'codetabs',     prefix: 'https://api.codetabs.com/v1/proxy?quest=',     type: 'raw'  },
    { label: 'htmldriven',   prefix: 'https://cors-proxy.htmldriven.com/?url=',      type: 'raw'  },
  );

  return list;
}

// No aggressive backoff — always retry at the normal poll interval
// even on repeated failures, so we catch the moment CERN comes back.

// ─────────────────────────────────────────────────────────────────────────────

export class LivePoller extends EventTarget {
  constructor() {
    super();
    this._proxies   = buildProxies();
    this._proxyIdx  = null;   // locked-in proxy index once one works
    this._lastId    = null;
    this._list      = [];
    this._running   = false;
    this._timer     = null;
    this._failCount = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async init() {
    await this._restoreFromCache();
    this._emit('listupdate', { list: this.getList() });
  }

  start() {
    if (this._running) return;
    this._running   = true;
    this._failCount = 0;
    this._emit('status', { state: 'polling' });
    this._schedule(0);
  }

  stop() {
    this._running = false;
    clearTimeout(this._timer);
    this._emit('status', { state: 'stopped' });
  }

  isRunning() { return this._running; }
  getList()   { return [...this._list]; }

  /** Trigger a browser download of the cached entry at position idx. */
  download(idx) {
    const entry = this._list[idx];
    if (!entry) return;
    const url = URL.createObjectURL(new Blob([entry.text], { type: 'text/xml' }));
    const a   = Object.assign(document.createElement('a'), { href: url, download: `${entry.name}.xml` });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  /** Force a specific proxy by index (use poller.getProxies() to see list). */
  forceProxy(idx) { this._proxyIdx = idx ?? null; this._failCount = 0; }

  getProxies() { return this._proxies.map((p, i) => ({ ...p, idx: i })); }

  /** Re-read WORKER_URL in case the user patched it at runtime. */
  refreshProxies() { this._proxies = buildProxies(); this._proxyIdx = null; }

  // ── Poll cycle ──────────────────────────────────────────────────────────────

  _schedule(ms = POLL_MS) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._poll(), ms);
  }

  async _poll() {
    if (!this._running) return;

    // Step 1 — Fetch the /latest page through the proxy
    let html;
    try {
      html = await this._fetchText(LATEST_URL);
    } catch (err) {
      // Network / proxy failure — reset proxy lock to re-probe next cycle
      this._proxyIdx = null;
      this._failCount++;
      this._emit('error',  { message: err.message });
      this._emit('status', { state: 'error', retryIn: POLL_MS, fails: this._failCount, lastChecked: Date.now() });
      if (this._running) this._schedule(POLL_MS);
      return;
    }

    // Step 2 — Parse the page for a JiveXML reference
    //          (proxy stays locked — it worked, CERN just has no event right now)
    const m = html.match(/src="([^"]*JiveXML_(\d+)_(\d+)\.png)"/);
    if (!m) {
      this._failCount++;
      this._emit('error',  { message: 'JiveXML not found — CERN /latest may be updating' });
      this._emit('status', { state: 'error', retryIn: POLL_MS, fails: this._failCount, lastChecked: Date.now() });
      if (this._running) this._schedule(POLL_MS);
      return;
    }

    const xmlRel  = m[1].replace('.png', '.xml');
    const eventId = `${m[2]}_${m[3]}`;
    const xmlUrl  = /^https?:\/\//.test(xmlRel) ? xmlRel : `${BASE_URL}/${xmlRel.replace(/^\//, '')}`;
    this._failCount = 0;

    // Step 3 — Download the XML if it's a new event
    try {
      if (eventId !== this._lastId) {
        this._emit('status', { state: 'downloading', eventId });
        const text = await this._fetchText(xmlUrl);
        await this._addEntry(eventId, xmlUrl, text);
        this._lastId = eventId;
      } else {
        this._emit('status', { state: 'same', eventId, lastChecked: Date.now() });
      }
    } catch (err) {
      this._failCount++;
      this._emit('error',  { message: err.message });
      this._emit('status', { state: 'error', retryIn: POLL_MS, fails: this._failCount, lastChecked: Date.now() });
      if (this._running) this._schedule(POLL_MS);
      return;
    }

    if (this._running) this._schedule();
  }

  async _fetchText(url) {
    // Use locked-in proxy if we found one that works
    if (this._proxyIdx !== null) {
      return this._tryProxy(this._proxies[this._proxyIdx], url);
    }
    // Probe all proxies in order
    const errors = [];
    for (let i = 0; i < this._proxies.length; i++) {
      try {
        const text = await this._tryProxy(this._proxies[i], url);
        this._proxyIdx = i;
        if (i > 0 || this._proxies[i].label !== 'direct') {
          this._emit('proxydetected', { proxy: this._proxies[i].prefix, label: this._proxies[i].label });
        }
        return text;
      } catch (e) {
        errors.push(`[${this._proxies[i].label}] ${e.message}`);
      }
    }
    throw new Error('All proxies failed:\n' + errors.join('\n'));
  }

  async _tryProxy(proxy, url) {
    const target = proxy.prefix
      ? proxy.prefix + encodeURIComponent(url)
      : url;

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 15_000);
    let res;
    try {
      res = await fetch(target, { cache: 'no-store', signal: ctrl.signal });
    } finally {
      clearTimeout(tid);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} from ${proxy.label}`);

    if (proxy.type === 'json') {
      const data = await res.json();
      const txt  = data?.contents ?? data?.body;
      if (typeof txt !== 'string' || !txt) throw new Error(`${proxy.label}: empty JSON contents`);
      return txt;
    }

    return res.text();
  }

  // ── Entry management ─────────────────────────────────────────────────────────

  async _addEntry(id, url, text) {
    const entry = { id, name: `JiveXML_${id}`, text, url, timestamp: Date.now() };
    this._list.unshift(entry);
    while (this._list.length > MAX_CACHED) {
      await this._cacheDelete(this._list.pop().id);
    }
    await this._cacheSave(entry);
    this._emit('newxml',     { entry, idx: 0 });
    this._emit('listupdate', { list: this.getList() });
  }

  // ── Cache API ────────────────────────────────────────────────────────────────

  // Cache API requires http/https keys — use a synthetic URL
  _cacheKey(id) { return `https://atlas-live.cern.ch/cache/${id}.xml`; }

  async _cacheSave(entry) {
    if (!('caches' in window)) return;
    try {
      const c    = await caches.open(CACHE_NAME);
      const meta = JSON.stringify({ id: entry.id, name: entry.name, url: entry.url, timestamp: entry.timestamp });
      await c.put(this._cacheKey(entry.id),
        new Response(entry.text, { headers: { 'Content-Type': 'text/xml', 'X-Atlas-Meta': meta } }));
    } catch (e) { console.warn('[LivePoller] cache write:', e); }
  }

  async _cacheDelete(id) {
    if (!('caches' in window)) return;
    try {
      const c = await caches.open(CACHE_NAME);
      await c.delete(this._cacheKey(id));
    } catch (_) {}
  }

  async _restoreFromCache() {
    if (!('caches' in window)) return;
    try {
      const c       = await caches.open(CACHE_NAME);
      const reqs    = await c.keys();
      const entries = [];
      for (const req of reqs) {
        const res = await c.match(req);
        if (!res) continue;
        const ms = res.headers.get('X-Atlas-Meta');
        if (!ms) continue;
        try {
          const meta = JSON.parse(ms);
          entries.push({ ...meta, text: await res.text() });
        } catch (_) {}
      }
      entries.sort((a, b) => b.timestamp - a.timestamp);
      this._list = entries.slice(0, MAX_CACHED);
      if (this._list.length > 0) this._lastId = this._list[0].id;
      for (const e of entries.slice(MAX_CACHED)) await this._cacheDelete(e.id);
    } catch (e) { console.warn('[LivePoller] cache restore:', e); }
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}