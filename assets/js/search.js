/* ============================================================
   The search box: the magnifying glass in the bar, and the dialog it opens.

   Nothing here loads with the page. main.js imports this module the first
   time someone points at the glass, presses it, or types / or Ctrl+K, and the
   index (assets/search/search-index.json, about 105 KB in brotli) is fetched
   then and kept by the browser for a year under its ?v= token. A reader who
   never searches downloads none of it.

   The ranking lives in search-engine.js; this file only asks it and draws the
   answer: up to eight results, the words that matched marked in the title and
   the description, arrows to move, Enter to go, Esc to leave.
   ============================================================ */
import { SearchIndex, normalize, pick } from './search-engine.js?v=57ea17fe67';
import { t, getLang } from './i18n.js?v=57ea17fe67';
import { holdScroll } from './smooth-scroll.js?v=57ea17fe67';
import { rememberHit, revealHit } from './search-hit.js?v=57ea17fe67';

const INDEX_URL = new URL('../search/search-index.json?v=57ea17fe67', import.meta.url);

const ICON = {
  page: 'ph-file-text', section: 'ph-file-text', project: 'ph-cpu', course: 'ph-books',
  publication: 'ph-book-open', news: 'ph-newspaper', person: 'ph-user',
};

let indexPromise = null;
let dialog = null;
let input, list, status;
let results = [];
let lastTerms = new Set();
let shownFor = null;
let active = -1;
let returnFocus = null;
let timer = 0;

/* Start the download without opening anything: called when the pointer comes
   near the glass, so the index is usually there by the time it is pressed. */
export function preloadSearch() {
  if (!indexPromise) {
    indexPromise = fetch(INDEX_URL).then((r) => {
      if (!r.ok) throw new Error('search index ' + r.status);
      return r.json();
    }).then((data) => new SearchIndex(data));
    indexPromise.catch(() => { indexPromise = null; });
  }
  return indexPromise;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* The words of `text` that the query matched, wrapped in <mark>. The engine
   hands back every index term it used (the exact word, the prefixes, the near
   misses), and a word of the text is marked when it normalises to one of them. */
function mark(text, terms) {
  let out = '';
  let last = 0;
  for (const m of String(text).matchAll(/[\p{L}\p{N}]+/gu)) {
    out += esc(text.slice(last, m.index));
    const word = m[0];
    out += terms.has(normalize(word)) ? '<mark>' + esc(word) + '</mark>' : esc(word);
    last = m.index + word.length;
  }
  return out + esc(String(text).slice(last));
}

function build() {
  dialog = document.createElement('div');
  dialog.className = 'site-search';
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="site-search-backdrop" data-close></div>
    <div class="site-search-panel glass" role="dialog" aria-modal="true">
      <div class="site-search-field">
        <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
        <input id="site-search-input" class="site-search-input" type="search" autocomplete="off" spellcheck="false"
               role="combobox" aria-expanded="false" aria-controls="site-search-list" aria-autocomplete="list">
        <button type="button" class="site-search-close" data-close><i class="ph ph-x" aria-hidden="true"></i></button>
      </div>
      <ul id="site-search-list" class="site-search-list" role="listbox"></ul>
      <p class="site-search-status" aria-live="polite"></p>
      <div class="site-search-keys" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> <span data-k="navigate"></span></span>
        <span><kbd>Enter</kbd> <span data-k="go"></span></span>
        <span><kbd>Esc</kbd> <span data-k="close"></span></span>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  input = dialog.querySelector('.site-search-input');
  list = dialog.querySelector('.site-search-list');
  status = dialog.querySelector('.site-search-status');

  dialog.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSearch(); });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 60); });
  dialog.addEventListener('keydown', onKey);
  list.addEventListener('mousemove', (e) => {
    const li = e.target.closest('[data-i]');
    if (li && +li.dataset.i !== active) setActive(+li.dataset.i);
  });
  list.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a) { e.preventDefault(); go(a.getAttribute('href')); }
  });
  document.addEventListener('langchange', () => { if (!dialog.hidden) { label(); run(); } });
  label();
}

function label() {
  input.placeholder = t('search.placeholder');
  input.setAttribute('aria-label', t('search.open'));
  dialog.querySelector('[role="dialog"]').setAttribute('aria-label', t('search.open'));
  dialog.querySelector('.site-search-close').setAttribute('aria-label', t('search.close'));
  dialog.querySelectorAll('[data-k]').forEach((el) => { el.textContent = t('search.' + el.dataset.k); });
}

async function run() {
  const query = input.value;
  if (!query.trim()) { draw([]); say(''); return; }
  let index;
  try {
    say(t('search.loading'));
    index = await preloadSearch();
  } catch (e) {
    draw([]); say(t('search.error')); return;
  }
  if (query !== input.value) return; // typed on while the index arrived
  const r = index.search(query);
  shownFor = query;
  if (r.status === 'short') { draw([]); say(t('search.short')); return; }
  if (r.status === 'none') { draw([]); say(t('search.none').replace('{q}', query.trim())); return; }
  lastTerms = r.terms;
  draw(r.results, r.terms);
  say('');
}

function say(text) { status.textContent = text; status.hidden = !text; }

function draw(items, terms = new Set()) {
  results = items;
  const lang = getLang();
  list.innerHTML = items.map((r, i) => {
    const title = pick(r.t, lang);
    const desc = pick(r.d, lang);
    const kind = t('search.types.' + r.k);
    const when = r.y ? String(r.y).slice(0, r.k === 'news' ? 10 : 4) : '';
    return `<li role="option" id="site-search-r${i}" data-i="${i}" aria-selected="false">
      <a href="${esc(r.u)}" tabindex="-1">
        <i class="ph ${ICON[r.k] || 'ph-file-text'} site-search-icon" aria-hidden="true"></i>
        <span class="site-search-text">
          <span class="site-search-title">${mark(title, terms)}</span>
          ${desc ? `<span class="site-search-desc">${mark(desc, terms)}</span>` : ''}
        </span>
        <span class="site-search-kind"><span>${esc(kind)}</span>${when ? '<span>' + esc(when) + '</span>' : ''}</span>
      </a></li>`;
  }).join('');
  input.setAttribute('aria-expanded', items.length ? 'true' : 'false');
  setActive(items.length ? 0 : -1);
}

function setActive(i) {
  active = i;
  list.querySelectorAll('[data-i]').forEach((li) => li.setAttribute('aria-selected', String(+li.dataset.i === i)));
  if (i >= 0) {
    input.setAttribute('aria-activedescendant', 'site-search-r' + i);
    const li = list.querySelector(`[data-i="${i}"]`);
    if (li) li.scrollIntoView({ block: 'nearest' });
  } else {
    input.removeAttribute('aria-activedescendant');
  }
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeSearch(); return; }
  if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((active + 1) % results.length); return; }
  if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((active - 1 + results.length) % results.length); return; }
  if (e.key === 'Enter' && e.target === input) {
    e.preventDefault();
    const open = () => { const r = results[active >= 0 ? active : 0]; if (r) go(r.u); };
    // Typed and pressed Enter inside the 60 ms the list waits before
    // redrawing: what is on screen is still the previous query's answer, and
    // opening it would go somewhere the reader never asked for. Answer the
    // text in the box first.
    if (shownFor !== input.value) { clearTimeout(timer); run().then(open); }
    else open();
    return;
  }
  // Keep Tab inside the dialog: the field and the close button.
  if (e.key === 'Tab') {
    const close = dialog.querySelector('.site-search-close');
    if (e.shiftKey && document.activeElement === input) { e.preventDefault(); close.focus(); }
    else if (!e.shiftKey && document.activeElement === close) { e.preventDefault(); input.focus(); }
  }
}

/* Going to a result. The words that matched go along (search-hit.js), so the
   page that opens scrolls to where they are and lights that block. On the
   page already open only the anchor changes: the About page opens the
   person's card on hashchange, and the scroll and the light follow. */
function go(url) {
  const target = new URL(url, location.href);
  const samePage = target.pathname.replace(/\.html$/, '').replace(/\/$/, '') === location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  rememberHit(target.pathname + target.hash, lastTerms);
  closeSearch(false);
  if (samePage) {
    if (target.hash && target.hash !== location.hash) location.hash = target.hash;
    setTimeout(revealHit, 80);
  } else {
    location.href = target.href;
  }
}

export function openSearch(trigger) {
  if (!dialog) build();
  returnFocus = trigger || document.activeElement;
  dialog.hidden = false;
  document.documentElement.classList.add('site-search-open');
  holdScroll(true);
  input.focus();
  input.select();
  preloadSearch().catch(() => {});
  if (input.value) run();
}

export function closeSearch(restoreFocus = true) {
  if (!dialog || dialog.hidden) return;
  dialog.hidden = true;
  document.documentElement.classList.remove('site-search-open');
  holdScroll(false);
  if (restoreFocus && returnFocus && returnFocus.focus) returnFocus.focus();
}
