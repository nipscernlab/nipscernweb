/**
 * NIPS-CERN hearts — client for the Cloudflare hearts Worker.
 *
 * Renders an interactive heart on a news post (with click feedback) and can
 * fetch all counts for ranking/lists. The heart stays marked across visits via
 * localStorage; the server (IP+UA hash) is the authoritative "liked" state.
 *
 * Configure the API base once, after deploying the Worker (see worker/hearts):
 *   - set window.HEARTS_API_BASE = 'https://nipscern-hearts.<sub>.workers.dev'
 *   - or edit the constant below.
 */
import { t, getLang } from './i18n.js';

const API_BASE =
  (typeof window !== 'undefined' && window.HEARTS_API_BASE) ||
  'https://nipscern-hearts.nipscernlab.workers.dev';

const LS_KEY = 'nipscern:hearts:liked';
let warned = false;

// Inline heart (outline when empty, filled when liked, via CSS). Using an SVG
// avoids depending on Phosphor's fill weight, which the site does not load.
const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
export function heartSvg(extraClass) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'heart-ico' + (extraClass ? ' ' + extraClass : ''));
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', HEART_PATH);
  svg.appendChild(path);
  return svg;
}

function apiConfigured() {
  const ok = !/REPLACE-ME/.test(API_BASE);
  if (!ok && !warned) {
    warned = true;
    console.warn('[hearts] API_BASE not configured — set window.HEARTS_API_BASE or edit assets/js/hearts.js');
  }
  return ok;
}

function likedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); } catch (_) { return new Set(); }
}
function persistLiked(slug, liked) {
  const set = likedSet();
  if (liked) set.add(slug); else set.delete(slug);
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch (_) {}
}

/** All counts, keyed by slug. Returns {} on any failure (feature is optional). */
export async function fetchAllCounts() {
  if (!apiConfigured()) return {};
  try {
    const res = await fetch(`${API_BASE}/hearts`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return {};
    const data = await res.json();
    return data.counts || {};
  } catch (_) { return {}; }
}

/** A small read-only heart tally (filled heart + number) for news cards. */
export function tallyElement(count) {
  const el = document.createElement('span');
  el.className = 'news-heart';
  el.appendChild(heartSvg());
  const n = document.createElement('span');
  n.className = 'news-heart-n';
  n.textContent = String(count);
  el.appendChild(n);
  return el;
}

async function fetchOne(slug) {
  if (!apiConfigured()) return null;
  try {
    const res = await fetch(`${API_BASE}/hearts?slug=${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

async function toggleVote(slug) {
  const res = await fetch(`${API_BASE}/hearts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  });
  if (!res.ok) throw new Error('vote failed');
  return res.json();
}

function slugOf(post) {
  return typeof post === 'string' ? post : (post && (post.slug || post.id)) || '';
}

/**
 * Build the appreciation widget (prompt + heart button + feedback line) and
 * mount it into `container`. Returns the widget element.
 */
export function mountPostHeart(container, post) {
  const slug = slugOf(post);
  if (!container || !slug) return null;

  const wrap = document.createElement('div');
  wrap.className = 'post-hearts-inner';

  const prompt = document.createElement('div');
  prompt.className = 'heart-prompt';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'heart-btn';
  const icon = heartSvg();
  const countEl = document.createElement('span');
  countEl.className = 'heart-count';
  countEl.textContent = '0';
  btn.appendChild(icon);
  btn.appendChild(countEl);

  const thanks = document.createElement('div');
  thanks.className = 'heart-thanks';
  thanks.setAttribute('role', 'status');
  thanks.setAttribute('aria-live', 'polite');

  wrap.appendChild(prompt);
  wrap.appendChild(btn);
  wrap.appendChild(thanks);
  container.appendChild(wrap);

  let liked = likedSet().has(slug);
  let count = 0;
  let busy = false;

  function labels() {
    prompt.textContent = t('news.heart_give');
    btn.setAttribute('aria-label', liked ? t('news.heart_remove') : t('news.heart_give'));
  }
  function paint() {
    countEl.textContent = String(count);
    btn.classList.toggle('is-liked', liked);
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    labels();
  }

  function celebrate() {
    // Visual feedback on a like: pop the heart, bump the number, float a heart,
    // and show a short thank-you line.
    btn.classList.remove('pop'); btn.classList.remove('bump');
    void btn.offsetWidth; // restart animations
    btn.classList.add('pop'); btn.classList.add('bump');
    const float = heartSvg('heart-float');
    btn.appendChild(float);
    setTimeout(() => float.remove(), 850);
    thanks.textContent = t('news.heart_thanks');
    thanks.classList.add('show');
    clearTimeout(celebrate._timer);
    celebrate._timer = setTimeout(() => thanks.classList.remove('show'), 1600);
  }

  paint();

  // Reconcile with the server: it is authoritative for the count and, via the
  // IP+UA hash, for whether this device already liked.
  fetchOne(slug).then((d) => {
    if (!d) return;
    count = typeof d.count === 'number' ? d.count : count;
    if (typeof d.liked === 'boolean') { liked = d.liked; persistLiked(slug, liked); }
    paint();
  });

  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const wasLiked = liked;

    // Optimistic update for instant feedback.
    liked = !wasLiked;
    count = Math.max(0, count + (liked ? 1 : -1));
    persistLiked(slug, liked);
    paint();
    if (liked) celebrate();

    if (!apiConfigured()) { busy = false; return; }
    try {
      const d = await toggleVote(slug);
      count = typeof d.count === 'number' ? d.count : count;
      liked = typeof d.liked === 'boolean' ? d.liked : liked;
      persistLiked(slug, liked);
      paint();
    } catch (_) {
      // On failure, ask the server for the authoritative state; if even that
      // fails, fall back to the pre-click state.
      const d = await fetchOne(slug);
      if (d) { count = d.count; liked = !!d.liked; }
      else { liked = wasLiked; count = Math.max(0, count + (wasLiked ? 1 : -1)); }
      persistLiked(slug, liked);
      paint();
    } finally {
      busy = false;
    }
  });

  document.addEventListener('langchange', labels);
  return wrap;
}
