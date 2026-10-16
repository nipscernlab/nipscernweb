/**
 * NIPS-CERN: drawing the publications, shared by the browser and the build.
 *
 * publications.js renders the list with these functions, and
 * tools/build-publications.js renders the same list into publications.html at
 * build time, so a reader (or a crawler) without JavaScript sees the whole
 * archive, and the script's first render replaces it with identical markup:
 * nothing moves. Nothing here touches the DOM or fetches anything, which is
 * what lets Node import it.
 *
 * The page-specific parts come in through `ctx`: t (the i18n lookup), flag
 * (the language badge, which needs the site root), pdfUrl (the PDF viewer
 * link) and pageUrl (the publication's own page).
 */

// ============================================================
const LANG_WORDS = {
  pt: ['que','não','são','uma','um','com','para','do','da','dos','das','também','é','às','mais','como','pelo','pela','este','esta','esse','essa','foram','foi','utilizados','trabalho','sistema','através','desenvolvimento','aplicação','dados','partir','ao','os','as','no','na','nos','nas','sua','seu','por','em'],
  en: ['the','and','of','this','was','with','for','which','based','are','we','that','system','present','results','using','these','from','an','is','to','in','on','by','as','were','paper','work','detector'],
  fr: ['le','les','des','une','et','est','pour','avec','dans','cette','qui','sur','nous','au','aux','été','par','plus','ce','sont','leur','être'],
  no: ['og','av','som','er','til','på','med','det','ikke','denne','et','for','har','ble','blir','disse'],
};
const LANG_DIA = { pt: ['ã','õ'], fr: ['ê','è','ù','œ'], no: ['ø','å'] };

/** Detect the language of a publication from its title + abstract. */
export function detectLang(title, abstract) {
  const text = ((title || '') + ' ' + (abstract || '')).toLowerCase();
  const tokens = text.match(/[a-zàâçéèêëîïôûùüÿñæœãõáíóú]+/g) || [];
  if (tokens.length < 3) return 'en';
  const n = tokens.length;
  const scores = {};
  for (const lang in LANG_WORDS) {
    const wset = new Set(LANG_WORDS[lang]);
    let c = 0;
    for (const tok of tokens) if (wset.has(tok)) c++;
    scores[lang] = c / n;
  }
  for (const lang in LANG_DIA) {
    if (LANG_DIA[lang].some(ch => text.includes(ch))) scores[lang] += 0.02;
  }
  return Object.keys(scores).reduce((a, b) => (scores[b] > scores[a] ? b : a), 'en');
}


export const TYPE_BADGE = {
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

export const THESIS_TYPES = ["master's thesis", 'undergraduate thesis', 'doctoral thesis', 'tcc', 'dissertation'];

// Authors come from the JSON with stray leading/trailing spaces in a few
// entries; normalise the spacing without rewriting the names. Every author
// and co-author is shown, no truncation.
export function formatAuthors(authors) {
  return authors.map(a => String(a).trim()).filter(Boolean).join(', ');
}

/**
 * One publication as a row. The title and the Open PDF action carry the
 * weight; the source line (authors, journal, year, type) is muted, and the
 * abstract is tucked behind a toggle that expands with a height animation.
 */
export function renderItem(pub, { showYear } = {}, ctx) {
  const typeLabel = ctx.t(`publications.types.${pub.type}`);
  const doi = pub.doi
    ? `<a href="https://doi.org/${pub.doi}" target="_blank" rel="noopener" class="pub-item-doi">${pub.doi}</a>`
    : '';
  const pdfViewerUrl = pub.pdf ? ctx.pdfUrl(pub) : '';
  const pdfBtn = pdfViewerUrl
    ? `<a href="${pdfViewerUrl}" class="pub-open glass-btn glass--flat" aria-label="${ctx.t('publications.open_pdf')}: ${pub.title}"><i class="ph ph-file-pdf" aria-hidden="true"></i><span>${ctx.t('publications.open_pdf')}</span></a>`
    : '';
  const venue = (pub.journal && String(pub.journal).trim()) ? `<span class="pub-venue">${pub.journal}</span>` : '';
  const meta = [showYear ? pub.year : null, typeLabel].filter(Boolean).join(' · ');
  const source = [venue, meta].filter(Boolean).join(' · ');

  return `
    <li class="pub-item fade-up" role="listitem">
      <div class="pub-item-row">
        <h3 class="pub-item-title" id="pub-${pub.id}-title"><a href="${ctx.pageUrl(pub)}">${pub.title}</a></h3>
        <div class="pub-item-aside">
          <span class="pub-item-flag">${ctx.flag(pub.title, pub.abstract)}</span>
          ${pdfBtn}
        </div>
      </div>
      <p class="pub-item-authors">${formatAuthors(pub.authors)}</p>
      <p class="pub-item-source">${source}</p>
      <button class="pub-abstract-toggle" type="button" aria-expanded="false" aria-controls="pub-${pub.id}-abs">
        <i class="ph ph-caret-right pub-abstract-caret" aria-hidden="true"></i>
        <span class="pub-abstract-toggle-label">${ctx.t('publications.read_abstract')}</span>
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
export function renderFlat(list, showYear, ctx) {
  return `<ol class="pub-flat" role="list">${list.map(p => renderItem(p, { showYear }, ctx)).join('')}</ol>`;
}

/** Grouped by year, descending, with a header and count per year. */
export function renderGrouped(list, ctx) {
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
        <ol class="pub-year-items" role="list">${items.map(p => renderItem(p, { showYear: false }, ctx)).join('')}</ol>
      </section>
    `;
  }).join('');
}

/** A featured publication, rendered as a clickable highlight card. */
export function renderFeaturedCard(pub, ctx) {
  const typeClass = TYPE_BADGE[pub.type] || 'badge-gray';
  const typeLabel = ctx.t(`publications.types.${pub.type}`);
  const href = pub.pdf ? ctx.pdfUrl(pub) : '#';
  return `
    <a class="pub-feat-card glass" href="${href}">
      <div class="pub-feat-meta">
        <span class="badge ${typeClass}">${typeLabel}</span>
        <span class="pub-feat-year">${pub.year}</span>
      </div>
      <h3 class="pub-feat-title">${pub.title}</h3>
      <p class="pub-feat-journal">${pub.journal}</p>
      <span class="pub-feat-cta"><i class="ph ph-file-pdf" aria-hidden="true"></i> ${ctx.t('publications.open_pdf')}</span>
    </a>
  `;
}

/** Static overview chips: total, year range, and counts by family of type. */
export function renderStats(pubs, ctx) {
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
    chip(total, ctx.t('publications.count').replace('{n}', '').trim()),
    `<span class="pub-stat"><strong>${min}</strong>–<strong>${max}</strong></span>`,
    chip(journal, ctx.t('publications.types.journal')),
    chip(conference, ctx.t('publications.types.conference')),
    chip(theses, ctx.t('publications.theses')),
  ].join('');
}


/** The featured strip: explicit `featured` flags if present, otherwise the
 *  first three of the manual order, which the editor curates at the top of
 *  the JSON. */
export function featuredList(pubs) {
  const flagged = pubs.filter(p => p.featured);
  return (flagged.length ? flagged : pubs.slice(0, 3)).slice(0, 3);
}

/** The inside of #pub-featured. */
export function renderFeaturedStrip(featList, ctx) {
  return `
      <div class="pub-featured-head">
        <i class="ph ph-star" aria-hidden="true"></i>
        <span>${ctx.t('publications.featured_heading')}</span>
      </div>
      <div class="pub-featured-grid">${featList.map(p => renderFeaturedCard(p, ctx)).join('')}</div>
    `;
}

/** The address of a publication's own page, from the site root: the id
 *  without its "pub-", lower case, and anything but letters and digits as a
 *  hyphen (one id in the JSON has a space). */
export function publicationPagePath(pub) {
  const slug = String(pub.id || '').replace(/^pub-/, '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return 'publications/p/' + slug;
}
