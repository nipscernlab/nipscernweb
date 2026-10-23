/* ============================================================
   Arriving from a search: scroll to where the words are, and light them.

   search.js calls rememberHit() just before it leaves for a result, with the
   result's address and the index terms the query matched. The page that
   opens finds that note in sessionStorage (main.js imports this module only
   when there is one), deletes it, and goes looking:

   - an address with an anchor goes to that anchor: a section heading, or the
     person's card on the About page, which about.js opens from #member-<id>;
   - inside it, or across the whole page when there is no anchor, the block
     of text (a paragraph, an item, a heading) holding the most of the words
     that were searched for.

   The page is scrolled to put that block a little below the bar, and a band
   of blue light comes up behind it and fades over three seconds. Nothing
   happens when nothing matches: a page is never scrolled to a guess.

   The note lives in sessionStorage, which the browser discards with the tab,
   and is deleted as soon as it is read. privacy.html says so.
   ============================================================ */
import { normalize } from './search-engine.js?v=346736d6d2';
import { scrollToEl } from './smooth-scroll.js?v=346736d6d2';

const KEY = 'nipscern_search_hit';
const MAX_AGE = 60000;
const BLOCKS = 'p, li, h1, h2, h3, h4, dd, dt, td, th, blockquote, figcaption, summary, .tm-card';
const SKIP = '#nav, #nav-mobile, #footer, #supporters, .site-search, script, style, noscript';

const strip = (p) => p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/\/$/, '') || '/';

export function rememberHit(url, terms) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ u: url, w: [...terms].slice(0, 150), t: Date.now() }));
  } catch (e) { /* private mode: the result still opens, only without the scroll */ }
}

/* How many of the searched words a block holds, once each. */
function score(el, terms) {
  const words = new Set(normalize(el.textContent).split(' '));
  let n = 0;
  for (const w of words) if (terms.has(w)) n++;
  return n;
}

function bestBlock(root, terms) {
  let best = null;
  let top = 0;
  for (const el of root.querySelectorAll(BLOCKS)) {
    if (el.closest(SKIP)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = score(el, terms);
    // Strictly more: on a tie the first block in the page wins, and a block
    // nested inside an earlier winner (an <li> in a <td>) has to beat it.
    if (s > top) { top = s; best = el; }
  }
  return best;
}

/* A person's card is drawn by about.js after team.json arrives, so the wait
   is for the card to exist and be open. */
function waitFor(find, ms = 3000) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const look = () => {
      const el = find();
      if (el || performance.now() - t0 > ms) resolve(el || null);
      else setTimeout(look, 100);
    };
    look();
  });
}

/* Wait for the page to stop changing. A news story read in Portuguese is drawn
   in English first and redrawn by its own script once the language is known,
   and the About page redraws a card when the language is applied: a block
   chosen before that is a block the page then throws away, and scrolling to
   it goes nowhere. So the choice waits until nothing has been added or
   removed for 400 ms, and never more than three and a half seconds. */
function settle(root, quiet = 400, max = 3500) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let timer = 0;
    const done = () => { obs.disconnect(); clearTimeout(timer); resolve(); };
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      if (performance.now() - t0 > max) done();
      else timer = setTimeout(done, quiet);
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    timer = setTimeout(done, quiet);
  });
}

async function target(hash, terms) {
  const id = hash ? decodeURIComponent(hash.slice(1)) : '';
  if (id.startsWith('member-')) {
    return waitFor(() => document.querySelector('.tm-detail') || document.querySelector('.tm-card.is-open'));
  }
  const anchor = id && document.getElementById(id);
  if (anchor) {
    const scope = anchor.closest('section, article, aside') || anchor.parentElement || anchor;
    return bestBlock(scope, terms) || anchor;
  }
  return bestBlock(document.querySelector('main') || document.body, terms);
}

/* Ink under the words of `el` that were searched for: each text node is split
   at its words and the matching ones wrapped in <mark>. A card or a record is
   left alone; only text blocks are touched, and at most twenty words. The
   marks are taken out again after ten seconds and the text put back as it was. */
function ink(el, terms) {
  if (el.matches('.tm-card, .tm-detail')) return;
  const marks = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const node of nodes) {
    const text = node.nodeValue;
    const parts = [];
    let last = 0;
    for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
      if (marks.length + parts.filter((p) => p.mark).length >= 20) break;
      if (!terms.has(normalize(m[0]))) continue;
      if (m.index > last) parts.push({ text: text.slice(last, m.index) });
      parts.push({ text: m[0], mark: true });
      last = m.index + m[0].length;
    }
    if (!parts.length) continue;
    if (last < text.length) parts.push({ text: text.slice(last) });
    const frag = document.createDocumentFragment();
    for (const p of parts) {
      if (p.mark) {
        const mk = document.createElement('mark');
        mk.className = 'site-search-word';
        mk.textContent = p.text;
        marks.push(mk);
        frag.appendChild(mk);
      } else {
        frag.appendChild(document.createTextNode(p.text));
      }
    }
    node.replaceWith(frag);
  }
  setTimeout(() => {
    for (const mk of marks) {
      const parent = mk.parentNode;
      if (!parent) continue;
      mk.replaceWith(document.createTextNode(mk.textContent));
      parent.normalize();
    }
  }, 10000);
}

function light(el) {
  const r = el.getBoundingClientRect();
  const band = document.createElement('div');
  band.className = 'site-search-hit';
  band.setAttribute('aria-hidden', 'true');
  const padX = Math.min(24, Math.max(10, r.width * 0.03));
  band.style.left = (r.left + window.scrollX - padX) + 'px';
  band.style.top = (r.top + window.scrollY - 6) + 'px';
  band.style.width = (r.width + padX * 2) + 'px';
  band.style.height = (r.height + 12) + 'px';
  document.body.appendChild(band);
  band.addEventListener('animationend', (e) => { if (e.animationName === 'site-search-out') band.remove(); });
  setTimeout(() => band.remove(), 4200);
}

export async function revealHit() {
  let hit = null;
  try {
    hit = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    sessionStorage.removeItem(KEY);
  } catch (e) { return; }
  if (!hit || !hit.u || Date.now() - hit.t > MAX_AGE) return;
  const want = new URL(hit.u, location.href);
  if (strip(want.pathname) !== strip(location.pathname)) return;

  const terms = new Set(hit.w || []);
  await settle(document.querySelector('main') || document.body);
  let el = await target(want.hash, terms);
  if (!el) return;
  const nav = document.getElementById('nav');
  const offset = -((nav ? nav.getBoundingClientRect().height : 64) + Math.round(window.innerHeight * 0.18));
  const place = (smooth) => {
    if (document.documentElement.classList.contains('lenis')) scrollToEl(el, offset);
    // The native path: scrollToEl would put the block at the very top, under
    // the bar; this puts it where the Lenis path does.
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: smooth ? 'smooth' : 'auto' });
  };
  // The reader's own scrolling wins over anything below.
  let moved = false;
  const mine = () => { moved = true; };
  for (const type of ['wheel', 'touchstart', 'keydown']) window.addEventListener(type, mine, { once: true, passive: true });
  place(true);
  // Lit once the scroll has landed, so the band is where the block is and not
  // where it was. The page may have moved things meanwhile: a story read on a
  // wide screen gets its table of contents wrapped round it after load, which
  // moves the block and the scroll with it, and a redraw can swap the block
  // out altogether. So the block is found again if it is gone, put back in
  // place once if it is not where it was sent (unless the reader has scrolled
  // in the meantime), and only then marked.
  setTimeout(async () => {
    if (!el.isConnected) el = await target(want.hash, terms);
    if (!el || !el.isConnected) return;
    if (!moved && Math.abs(el.getBoundingClientRect().top + offset) > 80) place(false);
    ink(el, terms);
    light(el);
  }, 900);
}
