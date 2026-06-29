/**
 * NIPS-CERN — Publications page JS
 * Handles loading, rendering, search, filter by type/year/author, sort by date
 */

import { t } from './i18n.js';
import { formatDate, pubLangFlag } from './main.js?v=lang-flags-20260529';
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

async function loadPublications() {
  const depth = (window.location.pathname.match(/\//g) || []).length - 1;
  const prefix = depth > 1 ? '../'.repeat(depth - 1) : '';
  const res = await fetch(prefix + 'data/publications.json?v=author-normalized-20260529-chrysthofer', { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  // Filter out empty entries and sort by year descending, then by title
  return data
    .filter(p => p.title && p.title.trim() !== '')
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
}

function renderCard(pub) {
  const typeClass = TYPE_BADGE[pub.type] || 'badge-gray';
  const typeKey = `publications.types.${pub.type}`;
  const tags = pub.tags
    .filter(tag => tag && tag.trim())
    .map(tag => `<span class="pub-tag">${tag}</span>`)
    .join('');
  const doi = pub.doi
    ? `<a href="https://doi.org/${pub.doi}" target="_blank" rel="noopener" class="text-brand" style="font-size:var(--text-xs);margin-top:4px;display:inline-block">${pub.doi}</a>`
    : '';
  const pdfViewerUrl = pub.pdf ? publicationUrl(pub) : '';
  const pdfBtn = pdfViewerUrl
    ? '<a href="' + pdfViewerUrl + '" class="btn btn-ghost btn-sm" data-i18n="publications.open_pdf"><i class="ph ph-file-pdf" aria-hidden="true"></i> Open PDF</a>'
    : '';

  return `
    <article class="pub-card fade-up" role="article" aria-labelledby="pub-${pub.id}-title">
      <div class="pub-card-body">
        <div class="pub-card-meta">
          <span class="badge ${typeClass}" data-i18n="${typeKey}">${pub.type}</span>
          <span class="news-date">${pub.year}</span>
          ${pubLangFlag(pub.title, pub.abstract)}
        </div>
        <h2 class="pub-title" id="pub-${pub.id}-title">${pub.title}</h2>
        <p class="pub-authors"><span data-i18n="publications.authors">Authors</span>: ${pub.authors.join(', ')}</p>
        <p class="pub-journal">${pub.journal}</p>
        ${doi}
        <p class="pub-abstract">
          <strong style="font-size:var(--text-xs);font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:6px" data-i18n="publications.abstract">Abstract</strong>
          ${pub.abstract}
        </p>
        ${tags ? `<div class="pub-tags">${tags}</div>` : ''}
      </div>
      <div class="pub-card-footer">${pdfBtn}</div>
    </article>
  `;
}

export async function initPublications() {
  const listEl      = document.getElementById('pub-list');
  const searchEl    = document.getElementById('pub-search');
  const typeEl      = document.getElementById('pub-filter-type');
  const yearEl      = document.getElementById('pub-filter-year');
  const authorCombo = document.getElementById('pub-author-combo');
  const authorInput = document.getElementById('pub-author-input');
  const authorList  = document.getElementById('pub-author-list');
  const authorClear = document.getElementById('pub-author-clear');
  const noResultsEl = document.getElementById('pub-no-results');

  if (!listEl) return;

  const publications = await loadPublications();

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
    } else {
      if (noResultsEl) noResultsEl.style.display = 'none';
      listEl.innerHTML = filtered.map(renderCard).join('');

      // Trigger entrance animations
      listEl.querySelectorAll('.fade-up').forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), i * 60);
      });
    }
  }

  // Re-render when the UI language changes so the result count localises
  document.addEventListener('langchange', render);

  // Search
  searchEl?.addEventListener('input', e => { currentSearch = e.target.value; render(); });

  // Type/Year selects
  typeEl?.addEventListener('change', e => { currentType = e.target.value; render(); });
  yearEl?.addEventListener('change', e => { currentYear = e.target.value; render(); });

  render();
}
