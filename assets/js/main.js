/**
 * NIPS-CERN — Main JS Module
 * Navigation, footer injection, animations, shared utilities
 */

import { initI18n, getLang, setLanguage } from './i18n.js';

import { newsPostUrl } from './content-links.js';

// ============================================================
// Navigation Template
// ============================================================

// `label` is the English default shown before i18n.json loads, so the raw
// key (e.g. "nav.home") never flashes on screen. i18n localises it after.
const NAV_LINKS = [
  { key: 'nav.home',         label: 'Home',         href: '',           paths: ['/'] },
  { key: 'nav.about',        label: 'About',        href: 'about',      paths: ['/about', '/about.html'] },
  { key: 'nav.cern',         label: 'CERN',         href: 'cern',       paths: ['/cern', '/cern.html'] },
  { key: 'nav.projects',     label: 'Projects',     href: 'projects/',  paths: ['/projects/', '/projects/index.html', '/projects', '/projects/sapho', '/projects/sapho.html', '/projects/yanc', '/projects/yanc.html', '/projects/polaris', '/projects/polaris.html', '/projects/aurora', '/projects/aurora.html', '/projects/cgv', '/projects/cgv.html'] },
  { key: 'nav.publications', label: 'Publications', href: 'publications.html', paths: ['/publications', '/publications/', '/publications.html'] },
  { key: 'nav.news',         label: 'News',         href: 'news/',      paths: ['/news/', '/news/index.html', '/news', '/news/post', '/news/post.html'] },
];

/**
 * Root URL of the project — derived from this module's own URL.
 * main.js lives at assets/js/main.js → go up 2 levels to reach the project root.
 * Works on localhost, GitHub Pages subdirectory, and custom domain.
 */
const ROOT = new URL('../../', import.meta.url).href;

const FLAG_PATHS = {
  en: 'assets/icons/flag-for-united-kingdom.svg',
  pt: 'assets/icons/flag-for-brazil.svg',
  fr: 'assets/icons/flag-for-france.svg',
  no: 'assets/icons/flag-for-norway.svg',
};

export const LANG_NAMES = { pt: 'Português', en: 'English', fr: 'Français', no: 'Norsk' };

function flagImg(lang) {
  const src = FLAG_PATHS[lang];
  const name = LANG_NAMES[lang] || lang;
  return src
    ? `<img class="flag" src="${ROOT}${src}" alt="" loading="lazy" decoding="async" aria-hidden="true" title="${name}">`
    : '';
}

export const FLAG_SVGS = Object.fromEntries(
  Object.keys(FLAG_PATHS).map(lang => [lang, flagImg(lang)])
);

const atomIcon = `<span class="nav-logo-atom" aria-hidden="true"></span>`;

function buildNav() {
  const path = window.location.pathname;

  // Fixed active detection: home must not match subdirectory index.html files
  function isActivePath(link) {
    return link.paths.some(p => {
      if (p === '/') {
        const segs = path.split('/').filter(s => s && s !== 'index.html' && s !== 'index');
        return segs.length === 0;
      }
      return path.endsWith(p);
    });
  }

  const linksHtml = NAV_LINKS.map(link => {
    const href = ROOT + link.href;
    return `<a href="${href}" class="nav-link${isActivePath(link) ? ' active' : ''}" data-i18n="${link.key}">${link.label}</a>`;
  }).join('');

  const langBtns = ['en', 'pt', 'fr', 'no'].map(lang => `
    <button class="lang-btn" data-lang="${lang}" aria-label="${lang.toUpperCase()} language" aria-pressed="false">
      ${FLAG_SVGS[lang]}
    </button>
  `).join('');

  const mobileLinksHtml = NAV_LINKS.map(link => {
    const href = ROOT + link.href;
    const isActive = isActivePath(link);
    return `<a href="${href}" class="nav-mobile-link${isActive ? ' active' : ''}" data-i18n="${link.key}">${link.label}</a>`;
  }).join('');

  return `
    <div class="nav-inner">
      <a href="${ROOT}" class="nav-logo" aria-label="NIPS-CERN Home">
        <img src="${ROOT}assets/icons/icon_home_nipscern.svg" alt="NIPS-CERN Logo" class="nav-logo-mark">
        <span class="nav-logo-text">NIPS${atomIcon}CERN</span>
      </a>

      <nav class="nav-links" role="navigation" aria-label="Main navigation">
        ${linksHtml}
      </nav>

      <div class="nav-right">
        <div class="lang-switcher" role="group" aria-label="Language selector">
          ${langBtns}
        </div>
        <a href="/projects/cgvweb" target="_blank" rel="noopener noreferrer" class="nav-cgv-link" aria-label="CGVWEB Project" title="CGVWEB">
          <img src="${ROOT}assets/icons/icon_cgv.svg" alt="CGVWEB" class="nav-cgv-icon">
        </a>
        <button class="nav-hamburger" id="nav-menu-btn" aria-label="Open menu" aria-expanded="false">
          <i class="ph ph-list" aria-hidden="true" style="font-size:20px"></i>
        </button>
      </div>
    </div>

    <!-- Mobile overlay -->
    <div class="nav-mobile" id="nav-mobile" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div class="nav-mobile-header">
        <a href="${ROOT}" class="nav-logo">
          <img src="${ROOT}assets/icons/icon_home_nipscern.svg" alt="NIPS-CERN Logo" class="nav-logo-mark">
          <span class="nav-logo-text">NIPS${atomIcon}CERN</span>
        </a>
        <button id="nav-mobile-close" aria-label="Close menu" style="width:40px;height:40px;border-radius:8px;background:var(--border-subtle);border:1px solid var(--border-mid);display:flex;align-items:center;justify-content:center;color:var(--text-secondary)">
          <i class="ph ph-x" style="font-size:20px" aria-hidden="true"></i>
        </button>
      </div>
      <nav class="nav-mobile-links">
        ${mobileLinksHtml}
      </nav>
      <div class="nav-mobile-cgv" style="border-top:1px solid var(--border-subtle);padding-top:var(--sp-8)">
        <a href="https://www.nipscern.com/projects/cgvweb" target="_blank" rel="noopener noreferrer" class="nav-mobile-cgv-link">
          <img src="${ROOT}assets/icons/icon_cgv.svg" alt="CGVWEB" class="nav-cgv-icon">
          <span>CGVWEB</span>
        </a>
      </div>
      <div class="nav-mobile-lang" style="border-top:1px solid var(--border-subtle);padding-top:var(--sp-8)">
        <div class="lang-switcher" style="justify-content:flex-start">
          ${langBtns}
        </div>
      </div>
    </div>
  `;
}

function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  nav.innerHTML = buildNav();

  // Scroll state
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  const btn = document.getElementById('nav-menu-btn');
  const mobile = document.getElementById('nav-mobile');
  const close = document.getElementById('nav-mobile-close');

  const openMenu = () => {
    mobile.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const closeMenu = () => {
    mobile.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  btn?.addEventListener('click', openMenu);
  close?.addEventListener('click', closeMenu);
  mobile?.addEventListener('click', e => { if (e.target === mobile) closeMenu(); });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}

// ============================================================
// Footer Template
// ============================================================
function buildFooter() {
  const links = NAV_LINKS.map(link => {
    const href = ROOT + link.href;
    return `<li><a href="${href}" data-i18n="${link.key}">${link.label}</a></li>`;
  }).join('');

  return `
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo">
          <img src="${ROOT}assets/icons/icon_home_nipscern.svg" alt="NIPS-CERN Logo" class="nav-logo-mark">
          <span style="font-size:var(--text-base);font-weight:700;letter-spacing:0.06em">NIPS${atomIcon}CERN</span>
        </div>
        <p class="footer-tagline" data-i18n="footer.tagline">Research and Development Laboratory at UFJF, Brazil — in collaboration with CERN, Geneva.</p>
      </div>

      <div>
        <div class="footer-nav-title" data-i18n="footer.nav_title">Navigation</div>
        <ul class="footer-nav-list">${links}</ul>
      </div>

      <div>
        <div class="footer-nav-title" data-i18n="footer.contact_title">Contact</div>
        <ul class="footer-nav-list">
          <li><a href="mailto:luciano.andrade@ufjf.br">luciano.andrade@ufjf.br</a></li>
          <li style="line-height:1.5;color:var(--text-muted);font-size:var(--text-xs)">
            <strong style="color:var(--text-secondary);display:block;margin-bottom:2px">NIPS-CERN / PPEE Lab</strong>
            Depto. de Engenharia Elétrica<br>
            UFJF — R. José Lourenço Kelmer, s/n<br>
            Juiz de Fora, MG 36036-900 — Brasil
          </li>
          <li style="line-height:1.5;color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--sp-3)">
            <strong style="color:var(--text-secondary);display:block;margin-bottom:2px">CERN</strong>
            Espl. des Particules 1<br>
            CH-1211 Genève 23 — Suisse
          </li>
        </ul>
      </div>

      <div>
        <div class="footer-nav-title" data-i18n="footer.follow_title">Follow</div>
        <ul class="footer-nav-list">
          <li><a href="https://github.com/nipscernlab" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px"><i class="ph ph-github-logo" aria-hidden="true"></i> GitHub</a></li>
          <li><a href="https://www.nipscern.com" target="_blank" rel="noopener">nipscern.com</a></li>
          <li><a href="https://lattes.cnpq.br/5454168673866452" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px">
            <img src="${ROOT}assets/icons/lattes_icon.svg" alt="Lattes" style="width:14px;height:14px" aria-hidden="true"> Luciano — Lattes
          </a></li>
          <li><a href="https://github.com/Chrysthofer" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px"><i class="ph ph-github-logo" aria-hidden="true"></i> Chrysthofer — GitHub</a></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <p data-i18n="footer.copyright">© 2026 NIPS-CERN — Federal University of Juiz de Fora. All rights reserved.</p>
      <div style="display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap">
        <a href="${ROOT}qa" class="btn btn-ghost btn-sm" data-i18n-aria="qa.hero.label" aria-label="Questions and Answers">
          <i class="ph ph-chats-circle" aria-hidden="true"></i> <span data-i18n="footer.qa">Q&amp;A</span>
        </a>
        <div style="display:flex;align-items:center;gap:var(--sp-3);font-size:var(--text-xs);color:var(--text-muted)">
          <a href="${ROOT}credits" style="color:var(--text-muted);text-decoration:none;transition:color 0.15s" onmouseover="this.style.color='var(--text-secondary)'" onmouseout="this.style.color='var(--text-muted)'" data-i18n="footer.credits">Credits</a>
          <span aria-hidden="true">·</span>
          <a href="${ROOT}terms" style="color:var(--text-muted);text-decoration:none;transition:color 0.15s" onmouseover="this.style.color='var(--text-secondary)'" onmouseout="this.style.color='var(--text-muted)'" data-i18n="footer.terms">Terms</a>
          <span aria-hidden="true">·</span>
          <a href="${ROOT}privacy" style="color:var(--text-muted);text-decoration:none;transition:color 0.15s" onmouseover="this.style.color='var(--text-secondary)'" onmouseout="this.style.color='var(--text-muted)'" data-i18n="footer.privacy">Privacy</a>
        </div>
        <div class="footer-social">
          <a href="https://github.com/nipscernlab" class="footer-social-link" target="_blank" rel="noopener" aria-label="GitHub">
            <i class="ph ph-github-logo" aria-hidden="true" style="font-size:18px"></i>
          </a>
        </div>
      </div>
    </div>
  `;
}

function initFooter() {
  const footer = document.getElementById('footer');
  if (!footer) return;
  footer.innerHTML = buildFooter();
}

/**
 * Populate any [data-content-lang] element with a small flag + language name,
 * marking the language a page's (untranslated) body content is written in.
 * Static — it reflects the content language, not the chosen UI language.
 */
function initContentLangBadges() {
  document.querySelectorAll('[data-content-lang]').forEach(el => {
    const lang = el.getAttribute('data-content-lang') || 'en';
    if (!FLAG_SVGS[lang]) return;
    const name = LANG_NAMES[lang] || lang;
    el.innerHTML = `<span class="clang-flag" aria-hidden="true">${FLAG_SVGS[lang]}</span><span>${name}</span>`;
    if (!el.getAttribute('title')) el.setAttribute('title', name);
  });
}

// ============================================================
// Intersection Observer — Entrance animations
// ============================================================
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-up, .fade-in, .stagger-children').forEach(el => {
    observer.observe(el);
  });
}

// ============================================================
// Load team, news, publications dynamically (home page)
// ============================================================
/** Resolve a root-relative path using the module's known location.
 *  Absolute URLs (CDN assets, e.g. cdn.nipscern.com) pass through untouched. */
function rootPath(rel) {
  if (/^(https?:)?\/\//.test(rel)) return rel;
  return ROOT + rel;
}

async function fetchJSON(path) {
  try {
    const res = await fetch(rootPath(path));
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[main] Could not fetch', path, e);
    return null;
  }
}

// ============================================================
// Publication language detection (title + abstract heuristic)
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

/** Build the small flag badge HTML for a publication's detected language. */
export function pubLangFlag(title, abstract) {
  const lang = detectLang(title, abstract);
  const name = LANG_NAMES[lang] || lang;
  return `<span class="pub-lang-flag" role="img" title="${name}" aria-label="${name}">${FLAG_SVGS[lang] || ''}</span>`;
}

/**
 * Resolve which language a news post is actually shown in: the current UI
 * language if a translation exists for it, otherwise English (the flat
 * fields / the `en` translation are English).
 */
export function newsResolvedLang(post) {
  const lang = (typeof getLang === 'function' && getLang()) || 'en';
  const t = (post && post.translations) || {};
  return t[lang] ? lang : 'en';
}

/** Flag badges marking every language available for a news post. */
export function newsLangFlag(post) {
  const translations = (post && post.translations) || {};
  const langs = ['en', ...Object.keys(translations)]
    .filter((lang, index, list) => FLAG_SVGS[lang] && list.indexOf(lang) === index);

  return `<span class="news-lang-flags" aria-label="${langs.map(lang => LANG_NAMES[lang] || lang).join(', ')}">`
    + langs.map(lang => {
      const name = LANG_NAMES[lang] || lang;
      return `<span class="pub-lang-flag" role="img" title="${name}" aria-label="${name}">${FLAG_SVGS[lang] || ''}</span>`;
    }).join('')
    + `</span>`;
}

// Format date like "18 Nov 2024", localised to the current UI language
const DATE_LOCALES = { en: 'en-GB', pt: 'pt-BR', fr: 'fr-FR', no: 'nb-NO' };
export function formatDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  const locale = DATE_LOCALES[(typeof getLang === 'function' && getLang()) || 'en'] || 'en-GB';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================================
// Home page — latest post + latest publication preview
// ============================================================
async function initHomeLatest() {
  const newsData = await fetchJSON('data/news.json');
  const pubData = await fetchJSON('data/publications.json');

  // Latest news card
  const newsEl = document.getElementById('latest-news-card');
  if (newsEl && newsData && newsData.length > 0) {
    const post = newsData[0];
    const catClass = `cat-${post.category}`;

    // Build image section: real image when available, icon fallback
    const imgDiv = document.createElement('div');
    imgDiv.className = 'news-card-image';
    if (post.image) {
      const imgPath = rootPath(post.image);
      const webpBase = imgPath.replace(/\.(jpe?g|png)$/i, '').replace(/\.webp$/, '');
      const picture = document.createElement('picture');
      const source = document.createElement('source');
      const w400 = webpBase + '-400.webp';
      const w840 = webpBase + '.webp';
      source.srcset = `${w400} 400w, ${w840} 840w`;
      source.sizes = '(max-width:640px) 400px, 840px';
      source.type = 'image/webp';
      picture.appendChild(source);
      const img = document.createElement('img');
      img.src = imgPath;
      img.alt = '';
      img.fetchPriority = 'high';
      img.decoding = 'async';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      picture.style.cssText = 'width:100%;height:100%;display:block';
      const icon = document.createElement('i');
      icon.className = 'ph ph-newspaper';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.display = 'none';
      img.onerror = () => { picture.style.display = 'none'; icon.style.display = ''; };
      picture.appendChild(img);
      imgDiv.appendChild(picture);
      imgDiv.appendChild(icon);
    } else {
      const icon = document.createElement('i');
      icon.className = 'ph ph-newspaper';
      icon.setAttribute('aria-hidden', 'true');
      imgDiv.appendChild(icon);
    }

    const link = document.createElement('a');
    link.href = rootPath(newsPostUrl(post, 'news/post'));
    link.className = 'news-card';
    link.style.height = '100%';
    link.appendChild(imgDiv);

    const body = document.createElement('div');
    body.className = 'news-card-body';

    const meta = document.createElement('div');
    meta.className = 'news-card-meta';
    const badge = document.createElement('span');
    badge.className = 'badge ' + catClass;
    badge.setAttribute('data-i18n', 'news.categories.' + post.category);
    badge.textContent = post.category;
    const dateEl = document.createElement('span');
    dateEl.className = 'news-date';
    dateEl.textContent = formatDate(post.date);
    meta.appendChild(badge);
    meta.appendChild(dateEl);
    meta.insertAdjacentHTML('beforeend', newsLangFlag(post));

    const _nl = newsResolvedLang(post);
    const _tr = (post.translations && post.translations[_nl]) || {};

    const titleEl = document.createElement('div');
    titleEl.className = 'news-title';
    titleEl.textContent = _tr.title || post.title;

    const excerptEl = document.createElement('div');
    excerptEl.className = 'news-excerpt';
    excerptEl.textContent = _tr.excerpt || post.excerpt;

    const readMore = document.createElement('span');
    readMore.className = 'news-read-more';
    readMore.setAttribute('data-i18n', 'common.read_more');
    readMore.textContent = 'Read more ';
    const arrow = document.createElement('i');
    arrow.className = 'ph ph-arrow-right';
    arrow.setAttribute('aria-hidden', 'true');
    readMore.appendChild(arrow);

    body.appendChild(meta);
    body.appendChild(titleEl);
    body.appendChild(excerptEl);
    body.appendChild(readMore);
    link.appendChild(body);

    newsEl.innerHTML = '';
    newsEl.appendChild(link);
  }

  // Latest publication card
  const pubEl = document.getElementById('latest-pub-card');
  if (pubEl && pubData && pubData.length > 0) {
    const pub = pubData.reduce((latest, p) => (Number(p.year) > Number(latest.year) ? p : latest), pubData[0]);
    const typeMap = {
      article: 'badge-blue',
      journal: 'badge-blue',
      conference: 'badge-green',
      tcc: 'badge-amber',
      dissertation: 'badge-purple',
      "master's thesis": 'badge-purple',
      'undergraduate thesis': 'badge-amber',
      'doctoral thesis': 'badge-purple',
    };
    pubEl.innerHTML = `
      <a href="${rootPath('publications.html')}" class="pub-card" style="height:100%;display:block;text-decoration:none">
        <div class="pub-card-body">
          <div class="pub-card-meta">
            <span class="badge ${typeMap[pub.type] || 'badge-gray'}" data-i18n="publications.types.${pub.type}">${pub.type}</span>
            <span class="news-date">${pub.year}</span>
            ${pubLangFlag(pub.title, pub.abstract)}
          </div>
          <div class="pub-title">${pub.title}</div>
          <div class="pub-authors">${pub.authors.join(', ')}</div>
          <div class="pub-journal">${pub.journal}</div>
          <div class="pub-abstract">${pub.abstract.substring(0, 200)}…</div>
          <span class="news-read-more" style="display:inline-flex;align-items:center;gap:4px;margin-top:var(--sp-4)" data-i18n="common.read_more">Read more <i class="ph ph-arrow-right" aria-hidden="true"></i></span>
        </div>
      </a>
    `;
  }
}

// ============================================================
// Back-to-top button
// ============================================================
function initBackToTop() {
  const btn = document.createElement('button');
  btn.id = 'back-to-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '<i class="ph ph-arrow-up" aria-hidden="true"></i>';
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initFooter();
  initBackToTop();
  initContentLangBadges();
  await initI18n();
  initAnimations();

  // Page-specific: home page dynamic content
  if (document.getElementById('latest-news-card') || document.getElementById('latest-pub-card')) {
    await initHomeLatest();
    // Re-apply translations to newly injected elements
    setLanguage(getLang());
  }
});
