/**
 * NIPSCERN — Publications page JS
 * Handles loading, rendering, search, filter by type/year/author, sort by date
 */

import { t } from './i18n.js';
import { formatDate } from './main.js';

const TYPE_BADGE = {
  article:      'badge-blue',
  journal:      'badge-blue',
  conference:   'badge-green',
  revista:      'badge-green',
  tcc:          'badge-amber',
  dissertation: 'badge-purple',
};

async function loadPublications() {
  const depth = (window.location.pathname.match(/\//g) || []).length - 1;
  const prefix = depth > 1 ? '../'.repeat(depth - 1) : '';
  const res = await fetch(prefix + 'data/publications.json');
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
  const pdfViewerUrl = pub.pdf
    ? 'pdf-viewer.html?src=' + encodeURIComponent(pub.pdf)
      + '&title=' + encodeURIComponent(pub.title)
      + '&authors=' + encodeURIComponent(pub.authors.join('; '))
      + '&journal=' + encodeURIComponent(pub.journal)
      + '&year=' + encodeURIComponent(String(pub.year))
      + (pub.doi ? '&doi=' + encodeURIComponent(pub.doi) : '')
    : '';
  const pdfBtn = pdfViewerUrl
    ? '<a href="' + pdfViewerUrl + '" class="btn btn-ghost btn-sm" data-i18n="publications.open_pdf"><i class="ph ph-file-pdf" aria-hidden="true"></i> Open PDF</a>'
    : '';

  return `
    <article class="pub-card fade-up" role="article" aria-labelledby="pub-${pub.id}-title">
      <div class="pub-card-body">
        <div class="pub-card-meta">
          <span class="badge ${typeClass}" data-i18n="${typeKey}">${pub.type}</span>
          <span class="news-date">${pub.year}</span>
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

  function render() {
    const query = currentSearch.toLowerCase().trim();
    const tokens = query ? query.split(/\s+/) : [];

    const filtered = publications.filter(pub => {
      if (currentType && pub.type !== currentType) return false;
      if (currentYear && String(pub.year) !== currentYear) return false;
      if (tokens.length) {
        const haystack = [pub.title, ...pub.authors, pub.journal, ...pub.tags, String(pub.year)].join(' ').toLowerCase();
        if (!tokens.every(tok => haystack.includes(tok))) return false;
      }
      return true;
    });

    // Update result count
    const countEl = document.getElementById('pub-result-count');
    if (countEl) {
      countEl.textContent = filtered.length === publications.length
        ? `${filtered.length} publications`
        : `${filtered.length} of ${publications.length} publications`;
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

  // Search
  searchEl?.addEventListener('input', e => { currentSearch = e.target.value; render(); });

  // Type/Year selects
  typeEl?.addEventListener('change', e => { currentType = e.target.value; render(); });
  yearEl?.addEventListener('change', e => { currentYear = e.target.value; render(); });

  render();
}
