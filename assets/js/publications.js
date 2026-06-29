/**
 * NIPS-CERN — Publications page JS
 * Loading, rendering, search, filter by type/year/author, and three view
 * modes: grouped by year (default), most recent (flat), and the manual
 * "featured" order defined in publications.json. The abstract is collapsed
 * by default and revealed per item with a toggle.
 */

import { t } from './i18n.js';
import { pubLangFlag } from './main.js?v=lang-flags-20260529';
import { publicationUrl } from './content-links.js';

const TYPE_BADGE = {
  article:      'badge-blue',
  journal:      'badge-blue',
  conference:   'badge-green',
  revista:      'badge-green',
  tcc:          'badge-amber',
  dissertation: 'badge-purple',
  "master's thesis": 'badge-purple',
  'undergraduate thesis': 'badge-amber',
  'doctoral thesis': 'badge-purple',
};

const THESIS_TYPES = ["master's thesis", 'undergraduate thesis', 'doctoral thesis', 'tcc', 'dissertation'];

// Same author written in different ways across publications.
// Maps each variant to a single canonical name used in the filter list,
// the author filter and the search. Publication cards keep the original names.
const AUTHOR_ALIASES = {
  'm. hufnagel':            'Mateus Hufnagel Maranha de Faria',
  'leandro r. manso':       'Leandro Rodrigues Manso Silva',
  'afonso, c. a. a':        'Chrysthofer A. A. Afonso',
  'chrysthofer arthur amaro afonso': 'Chrysthofer A. A. Afonso',
  'dabson ferreira':        'Dabson Ferreira dos Santos',
  'dabson f. dos santos':   'Dabson Ferreira dos Santos',
  'allec nunes':            'Allec Nunes Terrezo',
  'allec terrezo':          'Allec Nunes Terrezo',
  'l. andrade':             'Luciano Manhães de Andrade Filho',
  'j.s. graulichc':         'J. S. Graulich',
  'j. s. graulichc':        'J. S. Graulich',
  'mariana de souza oliveira': 'Mariana de Oliveira Resende',
};

function cleanAuthorName(author) {
  const cleaned = String(author || '').trim().replace(/\s+/g, ' ').replace(/\.$/, '');
  return AUTHOR_ALIASES[cleaned.toLowerCase()] || cleaned;
}

// Authors come from the JSON with stray leading/trailing spaces in a few
// entries; normalise the spacing without rewriting the names. Every author
// and co-author is shown, no truncation.
function formatAuthors(authors) {
  return authors.map(a => String(a).trim()).filter(Boolean).join(', ');
}

async function loadPublications() {
  const depth = (window.location.pathname.match(/\//g) || []).length - 1;
  const prefix = depth > 1 ? '../'.repeat(depth - 1) : '';
  const res = await fetch(prefix + 'data/publications.json?v=author-normalized-20260529-chrysthofer', { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  // Keep the manual order defined in the JSON file (top of the array shows
  // first). This order is used by the "Featured" sort mode and to pick the
  // featured strip when no explicit `featured` flag is set. Drop empty entries.
  return data.filter(p => p.title && p.title.trim() !== '');
}

const SORT_DEFAULT = 'year';

/**
 * One publication as a row. The title and the Open PDF action carry the
 * weight; the source line (authors, journal, year, type) is muted, and the
 * abstract is tucked behind a toggle that expands with a height animation.
 */
function renderItem(pub, { showYear } = {}) {
  const typeLabel = t(`publications.types.${pub.type}`);
  const doi = pub.doi
    ? `<a href="https://doi.org/${pub.doi}" target="_blank" rel="noopener" class="pub-item-doi">${pub.doi}</a>`
    : '';
  const pdfViewerUrl = pub.pdf ? publicationUrl(pub) : '';
  const pdfBtn = pdfViewerUrl
    ? `<a href="${pdfViewerUrl}" class="pub-open" aria-label="${t('publications.open_pdf')}: ${pub.title}"><i class="ph ph-file-pdf" aria-hidden="true"></i><span>${t('publications.open_pdf')}</span></a>`
    : '';
  const venue = (pub.journal && String(pub.journal).trim()) ? `<span class="pub-venue">${pub.journal}</span>` : '';
  const meta = [showYear ? pub.year : null, typeLabel].filter(Boolean).join(' · ');
  const source = [venue, meta].filter(Boolean).join(' · ');

  return `
    <li class="pub-item fade-up" role="listitem">
      <div class="pub-item-row">
        <h3 class="pub-item-title" id="pub-${pub.id}-title">${pub.title}</h3>
        <div class="pub-item-aside">
          <span class="pub-item-flag">${pubLangFlag(pub.title, pub.abstract)}</span>
          ${pdfBtn}
        </div>
      </div>
      <p class="pub-item-authors">${formatAuthors(pub.authors)}</p>
      <p class="pub-item-source">${source}</p>
      <button class="pub-abstract-toggle" type="button" aria-expanded="false" aria-controls="pub-${pub.id}-abs">
        <i class="ph ph-caret-right pub-abstract-caret" aria-hidden="true"></i>
        <span class="pub-abstract-toggle-label">${t('publications.read_abstract')}</span>
      </button>
      <div class="pub-abstract-panel" id="pub-${pub.id}-abs">
        <div class="pub-abstract-inner">
          <p class="pub-item-abstract">${pub.abstract}</p>
          ${doi}
        </div>
      </div>
    </li>
  `;
}

/** Flat list (used by "Most recent" and "Featured" sorts). */
function renderFlat(list, showYear) {
  return `<ol class="pub-flat" role="list">${list.map(p => renderItem(p, { showYear })).join('')}</ol>`;
}

/** Grouped by year, descending, with a header and count per year. */
function renderGrouped(list) {
  const byYear = new Map();
  list.forEach(p => {
    if (!byYear.has(p.year)) byYear.set(p.year, []);
    byYear.get(p.year).push(p);
  });
  const years = [...byYear.keys()].sort((a, b) => b - a);
  return years.map(y => {
    const items = byYear.get(y);
    return `
      <section class="pub-year-group">
        <header class="pub-year-head">
          <h2 class="pub-year-label">${y}</h2>
          <span class="pub-year-count">${items.length}</span>
        </header>
        <ol class="pub-year-items" role="list">${items.map(p => renderItem(p, { showYear: false })).join('')}</ol>
      </section>
    `;
  }).join('');
}

/** A featured publication, rendered as a clickable highlight card. */
function renderFeaturedCard(pub) {
  const typeClass = TYPE_BADGE[pub.type] || 'badge-gray';
  const typeLabel = t(`publications.types.${pub.type}`);
  const href = pub.pdf ? publicationUrl(pub) : '#';
  return `
    <a class="pub-feat-card" href="${href}">
      <div class="pub-feat-meta">
        <span class="badge ${typeClass}">${typeLabel}</span>
        <span class="pub-feat-year">${pub.year}</span>
      </div>
      <h3 class="pub-feat-title">${pub.title}</h3>
      <p class="pub-feat-journal">${pub.journal}</p>
      <span class="pub-feat-cta"><i class="ph ph-file-pdf" aria-hidden="true"></i> ${t('publications.open_pdf')}</span>
    </a>
  `;
}

/** Static overview chips: total, year range, and counts by family of type. */
function renderStats(pubs) {
  const total = pubs.length;
  if (!total) return '';
  const years = pubs.map(p => Number(p.year)).filter(Boolean);
  const min = Math.min(...years);
  const max = Math.max(...years);
  const journal = pubs.filter(p => p.type === 'journal' || p.type === 'article').length;
  const conference = pubs.filter(p => p.type === 'conference').length;
  const theses = pubs.filter(p => THESIS_TYPES.includes(p.type)).length;

  const chip = (n, label) => `<span class="pub-stat"><strong>${n}</strong> ${label}</span>`;
  return [
    chip(total, t('publications.count').replace('{n}', '').trim()),
    `<span class="pub-stat"><strong>${min}</strong>–<strong>${max}</strong></span>`,
    chip(journal, t('publications.types.journal')),
    chip(conference, t('publications.types.conference')),
    chip(theses, t('publications.theses')),
  ].join('');
}

export async function initPublications() {
  const listEl      = document.getElementById('pub-list');
  const searchEl    = document.getElementById('pub-search');
  const typeEl      = document.getElementById('pub-filter-type');
  const yearEl      = document.getElementById('pub-filter-year');
  const sortEl      = document.getElementById('pub-sort');
  const statsEl     = document.getElementById('pub-stats');
  const featuredEl  = document.getElementById('pub-featured');
  const authorCombo = document.getElementById('pub-author-combo');
  const authorInput = document.getElementById('pub-author-input');
  const authorList  = document.getElementById('pub-author-list');
  const authorClear = document.getElementById('pub-author-clear');
  const noResultsEl = document.getElementById('pub-no-results');

  if (!listEl) return;

  const publications = await loadPublications();

  // Featured strip: explicit `featured` flags if present, otherwise the first
  // three of the manual order (which the editor curates at the top of the JSON).
  const flagged = publications.filter(p => p.featured);
  const featList = (flagged.length ? flagged : publications.slice(0, 3)).slice(0, 3);

  // Populate year filter
  if (yearEl) {
    const years = [...new Set(publications.map(p => p.year))].sort((a, b) => b - a);
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearEl.appendChild(opt);
    });
  }

  let currentSearch = '';
  let currentType   = '';
  let currentYear   = '';
  let currentAuthor = '';
  let currentSort   = sortEl ? (sortEl.value || SORT_DEFAULT) : SORT_DEFAULT;

  // Searchable author filter (combobox)
  if (authorInput && authorList) {
    // Count publications per (canonical) author
    const authorCount = new Map();
    publications.forEach(pub => {
      const seen = new Set();   // avoid double-counting if a name repeats in one pub
      pub.authors.map(cleanAuthorName).filter(Boolean).forEach(name => {
        if (seen.has(name)) return;
        seen.add(name);
        authorCount.set(name, (authorCount.get(name) || 0) + 1);
      });
    });

    const authors = [...authorCount.keys()]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    let activeIndex = -1;   // highlighted option for keyboard nav
    let visible = [];       // authors currently shown in the list

    function renderOptions(query) {
      const q = query.trim().toLowerCase();
      visible = q ? authors.filter(a => a.toLowerCase().includes(q)) : authors.slice();
      activeIndex = -1;

      if (visible.length === 0) {
        authorList.innerHTML = `<li class="author-combo-empty">${t('publications.no_authors')}</li>`;
        return;
      }
      authorList.innerHTML = visible.map((a, i) => {
        const sel = a === currentAuthor ? ' is-selected' : '';
        const count = authorCount.get(a) || 0;
        return `<li class="author-combo-option${sel}" role="option" data-index="${i}" aria-selected="${a === currentAuthor}"><span class="author-combo-name">${a}</span><span class="author-combo-count">${count}</span></li>`;
      }).join('');
    }

    function openList() {
      renderOptions(authorInput.value === currentAuthor ? '' : authorInput.value);
      authorList.hidden = false;
      authorInput.setAttribute('aria-expanded', 'true');
    }

    function closeList() {
      authorList.hidden = true;
      authorInput.setAttribute('aria-expanded', 'false');
      activeIndex = -1;
      // Restore the input text to the current selection (or empty)
      authorInput.value = currentAuthor;
      authorClear.hidden = !currentAuthor;
    }

    function selectAuthor(name) {
      currentAuthor = name;
      authorInput.value = name;
      authorClear.hidden = !name;
      closeList();
      render();
    }

    function setActive(i) {
      const opts = authorList.querySelectorAll('.author-combo-option');
      opts.forEach(o => o.classList.remove('is-active'));
      activeIndex = i;
      if (i >= 0 && opts[i]) {
        opts[i].classList.add('is-active');
        opts[i].scrollIntoView({ block: 'nearest' });
      }
    }

    authorInput.addEventListener('focus', () => { openList(); authorInput.select(); });
    authorInput.addEventListener('click', openList);

    authorInput.addEventListener('input', () => {
      authorClear.hidden = !authorInput.value;
      renderOptions(authorInput.value);
      authorList.hidden = false;
      authorInput.setAttribute('aria-expanded', 'true');
    });

    authorInput.addEventListener('keydown', e => {
      if (authorList.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { openList(); return; }
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); if (visible.length) setActive((activeIndex + 1) % visible.length); break;
        case 'ArrowUp':   e.preventDefault(); if (visible.length) setActive((activeIndex - 1 + visible.length) % visible.length); break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && visible[activeIndex]) selectAuthor(visible[activeIndex]);
          else if (visible.length === 1) selectAuthor(visible[0]);
          break;
        case 'Escape': closeList(); authorInput.blur(); break;
      }
    });

    authorList.addEventListener('mousedown', e => {
      // mousedown (not click) so it fires before the input blur
      const opt = e.target.closest('.author-combo-option');
      if (opt) { e.preventDefault(); selectAuthor(visible[Number(opt.dataset.index)]); }
    });

    authorClear.addEventListener('click', () => {
      selectAuthor('');
      authorInput.focus();
    });

    // Close when clicking outside the combobox
    document.addEventListener('click', e => {
      if (!authorCombo.contains(e.target)) closeList();
    });
  }

  // Collapse a single abstract toggle to its closed state
  function collapseAbstract(btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('is-open');
    const panel = btn.nextElementSibling;
    if (panel && panel.classList.contains('pub-abstract-panel')) panel.classList.remove('is-open');
    const label = btn.querySelector('.pub-abstract-toggle-label');
    if (label) label.textContent = t('publications.read_abstract');
  }

  // Expand/collapse an abstract (event delegation — survives re-renders).
  // Accordion: opening one abstract closes whichever was open.
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('.pub-abstract-toggle');
    if (!btn) return;
    const panel = btn.nextElementSibling;
    if (!panel || !panel.classList.contains('pub-abstract-panel')) return;
    const open = btn.getAttribute('aria-expanded') === 'true';

    if (!open) {
      listEl.querySelectorAll('.pub-abstract-toggle.is-open').forEach(other => {
        if (other !== btn) collapseAbstract(other);
      });
    }

    btn.setAttribute('aria-expanded', String(!open));
    btn.classList.toggle('is-open', !open);
    panel.classList.toggle('is-open', !open);
    const label = btn.querySelector('.pub-abstract-toggle-label');
    if (label) label.textContent = open ? t('publications.read_abstract') : t('publications.hide_abstract');
  });

  function renderFeatured(active) {
    if (!featuredEl) return;
    // Hide the showcase while the visitor is searching or filtering
    if (active || featList.length === 0) {
      featuredEl.hidden = true;
      featuredEl.innerHTML = '';
      return;
    }
    featuredEl.hidden = false;
    featuredEl.innerHTML = `
      <div class="pub-featured-head">
        <i class="ph ph-star" aria-hidden="true"></i>
        <span>${t('publications.featured_heading')}</span>
      </div>
      <div class="pub-featured-grid">${featList.map(renderFeaturedCard).join('')}</div>
    `;
  }

  function render() {
    const query = currentSearch.toLowerCase().trim();
    const tokens = query ? query.split(/\s+/) : [];

    const filtered = publications.filter(pub => {
      if (currentType && pub.type !== currentType) return false;
      if (currentYear && String(pub.year) !== currentYear) return false;
      if (currentAuthor && !pub.authors.some(author => cleanAuthorName(author) === currentAuthor)) return false;
      if (tokens.length) {
        const haystack = [pub.title, ...pub.authors.map(cleanAuthorName), pub.journal, ...pub.tags, String(pub.year)].join(' ').toLowerCase();
        if (!tokens.every(tok => haystack.includes(tok))) return false;
      }
      return true;
    });

    const anyFilter = !!(currentType || currentYear || currentAuthor || tokens.length);
    renderFeatured(anyFilter);

    // Update result count
    const countEl = document.getElementById('pub-result-count');
    if (countEl) {
      countEl.textContent = filtered.length === publications.length
        ? t('publications.count').replace('{n}', filtered.length)
        : t('publications.count_filtered').replace('{n}', filtered.length).replace('{total}', publications.length);
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      if (noResultsEl) noResultsEl.style.display = 'block';
      return;
    }
    if (noResultsEl) noResultsEl.style.display = 'none';

    if (currentSort === 'recent') {
      const ordered = filtered.slice().sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
      listEl.innerHTML = renderFlat(ordered, true);
    } else if (currentSort === 'featured') {
      // `filtered` preserves the manual JSON order
      listEl.innerHTML = renderFlat(filtered, true);
    } else {
      listEl.innerHTML = renderGrouped(filtered);
    }

    // Entrance animation, with a capped stagger so long lists don't crawl
    listEl.querySelectorAll('.fade-up').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), Math.min(i, 16) * 40);
    });
  }

  // Re-render when the UI language changes so labels and the count localise
  document.addEventListener('langchange', () => {
    if (statsEl) statsEl.innerHTML = renderStats(publications);
    render();
  });

  // Search
  searchEl?.addEventListener('input', e => { currentSearch = e.target.value; render(); });

  // Type / Year / Sort selects
  typeEl?.addEventListener('change', e => { currentType = e.target.value; render(); });
  yearEl?.addEventListener('change', e => { currentYear = e.target.value; render(); });
  sortEl?.addEventListener('change', e => { currentSort = e.target.value; render(); });

  if (statsEl) statsEl.innerHTML = renderStats(publications);
  render();
}
