/**
 * NIPS-CERN — Main JS Module
 * Navigation, footer injection, animations, shared utilities
 */

import { initI18n, getLang, setLanguage } from './i18n.js?v=9cef4aac16';

import { newsPostUrl } from './content-links.js?v=9cef4aac16';

/* One smooth scroll for the whole site, and nowhere else. Every place that used
   to move the scroll position with a `behavior: 'smooth'` of its own now asks
   this module, so there is a single thing deciding how the page moves and a
   single place to change it. */
import { initSmoothScroll, scrollToTop, holdScroll } from './smooth-scroll.js?v=9cef4aac16';

// ============================================================
// Navigation Template
// ============================================================

// `label` is the English default shown before i18n.json loads, so the raw
// key (e.g. "nav.home") never flashes on screen. i18n localises it after.
const NAV_LINKS = [
  { key: 'nav.home',         label: 'Home',         href: '',           paths: ['/'] },
  { key: 'nav.about',        label: 'About',        href: 'about.html', paths: ['/about', '/about.html'] },
  { key: 'nav.cern',         label: 'CERN',         href: 'cern.html',  paths: ['/cern', '/cern.html'] },
  { key: 'nav.projects',     label: 'Projects',     href: 'projects/',  paths: ['/projects/', '/projects/index.html', '/projects', '/projects/sapho', '/projects/sapho.html', '/projects/yanc', '/projects/yanc.html', '/projects/hits', '/projects/hits.html', '/projects/polaris', '/projects/polaris.html', '/projects/aurora', '/projects/aurora.html', '/projects/cgv', '/projects/cgv.html', '/projects/archived', '/projects/archived.html'] },
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

/* The order they appear in, which is not the order of the object above. */
const SUPPORTED = ['en', 'pt', 'fr', 'no'];

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
    return `<a href="${href}" class="nav-link${isActivePath(link) ? ' active glass-btn' : ''}" data-i18n="${link.key}">${link.label}</a>`;
  }).join('');

  /* Two switchers built from one list, and one handler for both: i18n.js binds
     .lang-btn[data-lang] once for the whole document, so neither of these has
     any behaviour of its own.

     The named version, for the mobile menu, where there is a column of room.
     Each language is named in its own language, because a reader looking for
     Norwegian is looking for Norsk, which is also why none of this is
     translated. */
  const langRows = (extra) => SUPPORTED.map(lang => `
    <button type="button" class="lang-btn${extra}" data-lang="${lang}" role="menuitemradio" aria-checked="false">
      <span class="lang-chip">${FLAG_SVGS[lang]}</span>
      <span class="lang-name">${LANG_NAMES[lang]}</span>
      <i class="ph ph-check-circle lang-tick" aria-hidden="true"></i>
    </button>
  `).join('');

  /* In the bar the flag is the whole of the control: four circles in a pill, no
     words, because two of the four languages are named in scripts of the same
     alphabet and the mark is quicker to find than the word. The name is still
     there for anyone who needs it, as the accessible label and the tooltip. */
  const langBtns = SUPPORTED.map(lang => `
    <button type="button" class="lang-btn" data-lang="${lang}" aria-pressed="false"
            aria-label="${LANG_NAMES[lang]}" title="${LANG_NAMES[lang]}">
      <span class="lang-chip">${FLAG_SVGS[lang]}</span>
    </button>
  `).join('');

  const langSwitch = `
    <div class="lang-switcher glass" role="group" aria-label="Language selector">${langBtns}</div>`;

  const mobileLinksHtml = NAV_LINKS.map(link => {
    const href = ROOT + link.href;
    const isActive = isActivePath(link);
    return `<a href="${href}" class="nav-mobile-link${isActive ? ' active glass-btn' : ''}" data-i18n="${link.key}">${link.label}</a>`;
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
        ${langSwitch}
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
      <div class="nav-mobile-lang">
        <div class="lang-list" role="group" aria-label="Language selector">
          ${langRows(' lang-btn--row')}
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

  /* overflow:hidden alone stops the document scrolling and says nothing to a
     library driving the scroll position from a ticker, so the page went on
     moving behind an open menu. Both, and in that order. */
  const openMenu = () => {
    mobile.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    holdScroll(true);
  };
  const closeMenu = () => {
    mobile.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    holdScroll(false);
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
        <p class="footer-tagline" data-i18n="footer.tagline">Two laboratories: NIPS, at UFJF, in Brazil, and Route Salam, at CERN, in Switzerland.</p>

        <!-- The figures are read off data/publications.json and data/team.json,
             the same ones the strip on the home counts up to. They are here
             because the footer said where the laboratories are and nothing at
             all about what has come out of them. -->
        <ul class="footer-figures">
          <li><b>147</b> <span data-i18n="footer.f_pubs">publications</span></li>
          <li><b>2001</b><span aria-hidden="true">–</span><b>2026</b> <span data-i18n="footer.f_years">on record</span></li>
          <li><b>32</b> <span data-i18n="footer.f_theses">theses supervised</span></li>
          <li><b>18</b> <span data-i18n="footer.f_people">people</span></li>
        </ul>
      </div>

      <div>
        <div class="footer-nav-title" data-i18n="footer.nav_title">Navigation</div>
        <ul class="footer-nav-list">${links}<li><a href="${ROOT}publications/courier.html">CERN Courier</a></li></ul>
      </div>

      <div>
        <div class="footer-nav-title" data-i18n="footer.contact_title">Contact</div>
        <ul class="footer-nav-list">
          <li><a href="mailto:luciano.andrade@ufjf.br">luciano.andrade@ufjf.br</a></li>
          <li><a href="mailto:chrysthofer.afonso@cern.ch">chrysthofer.afonso@cern.ch</a></li>
          <li style="line-height:1.5;color:var(--text-muted);font-size:var(--text-xs)">
            <strong style="color:var(--text-secondary);display:block;margin-bottom:2px">
              <img src="${ROOT}assets/icons/flag-for-brazil.svg" alt="" class="footer-flag" aria-hidden="true"> NIPS, UFJF
            </strong>
            Depto. de Engenharia Elétrica, PPEE<br>
            R. José Lourenço Kelmer, s/n<br>
            Juiz de Fora, MG 36036-900, Brasil
          </li>
          <li style="line-height:1.5;color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--sp-3)">
            <strong style="color:var(--text-secondary);display:block;margin-bottom:2px">
              <svg class="footer-flag" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="m0 0h32v32h-32z" fill="#f00"/>
                <path d="m13 6h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill="#fff"/>
              </svg> Route Salam, CERN
            </strong>
            Espl. des Particules 1<br>
            CH-1211 Genève 23, Suisse
          </li>
        </ul>
      </div>

      <div>
        <div class="footer-nav-title" data-i18n="footer.follow_title">Follow</div>
        <ul class="footer-nav-list">
          <li><a href="https://github.com/nipscernlab" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px"><i class="ph ph-github-logo" aria-hidden="true"></i> GitHub</a></li>
          <li><a href="https://gitlab.com/nips-cern" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px"><i class="ph ph-gitlab-logo" aria-hidden="true"></i> GitLab</a></li>
          <li><a href="https://www.nipscern.com" target="_blank" rel="noopener">nipscern.com</a></li>
          <li><a href="https://lattes.cnpq.br/5454168673866452" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px">
            <img src="${ROOT}assets/icons/lattes_icon.svg" alt="Lattes" style="width:14px;height:14px" aria-hidden="true"> Luciano no Lattes
          </a></li>
          <li><a href="https://github.com/Chrysthofer" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px"><i class="ph ph-github-logo" aria-hidden="true"></i> Chrysthofer no GitHub</a></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <p><a href="${ROOT}license.html" class="footer-copy" data-i18n="footer.copyright">© 2026 NIPS-CERN. Under the NIPS-CERN Licence 1.1.</a></p>
      <div style="display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap">
        <a href="${ROOT}qa.html" class="btn btn-ghost btn-sm glass-btn" data-i18n-aria="qa.hero.label" aria-label="Questions and Answers">
          <i class="ph ph-chats-circle" aria-hidden="true"></i> <span data-i18n="footer.qa">Q&amp;A</span>
        </a>
        <a href="${ROOT}projects/archived" class="btn btn-ghost btn-sm glass-btn" aria-label="Archived Projects">
          <i class="ph ph-archive" aria-hidden="true"></i> <span data-i18n="footer.archived">Archived Projects</span>
        </a>
        <!-- Four links that answer to the same hover as the navigation above
             them, so the footer behaves as one surface. They used to carry it
             as an inline handler each, four copies of the same two colours,
             which is also why the transition never matched: 0.15s written by
             hand against the token everything else uses. -->
        <div class="footer-legal">
          <a href="${ROOT}credits.html" data-i18n="footer.credits">Credits</a>
          <span aria-hidden="true">·</span>
          <a href="${ROOT}terms.html" data-i18n="footer.terms">Terms</a>
          <span aria-hidden="true">·</span>
          <a href="${ROOT}privacy.html" data-i18n="footer.privacy">Privacy</a>
          <span aria-hidden="true">·</span>
          <!-- The page, not the raw file on GitHub. license.html reads LICENSE.md
               and renders it, so it is the same text with the site around it,
               and the copyright line beside this one already pointed there. -->
          <a href="${ROOT}license.html" data-i18n="footer.licence">Licence</a>
        </div>
        <div class="footer-social">
          <a href="https://github.com/nipscernlab" class="footer-social-link" target="_blank" rel="noopener" aria-label="GitHub">
            <i class="ph ph-github-logo" aria-hidden="true" style="font-size:18px"></i>
          </a>
          <a href="https://gitlab.com/nips-cern" class="footer-social-link" target="_blank" rel="noopener" aria-label="GitLab">
            <i class="ph ph-gitlab-logo" aria-hidden="true" style="font-size:18px"></i>
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
// Supported by
// ============================================================
// Five marks in a row at half opacity, greyed out, with nothing said about any
// of them. It was the one part of the page that could have belonged to any
// laboratory anywhere, and it was carrying the names of the three agencies that
// pay for the work and the two institutions the group is inside.
//
// So they are named, and they are sorted: money is not the same relationship as
// premises, and putting CERN in a row of funding agencies says something untrue
// about both. The logos come up out of the grey, because a supporter shown at
// half strength is a supporter half acknowledged.
//
// Generated rather than written into each page: it goes wherever a page puts
// <div id="supporters"></div>, and there is one copy of it to correct.
const SUPPORTERS = [
  {
    kind: 'funding',
    of: [
      // The one square in the row, and a stacked lockup inside it: roundel over
      // wordmark, with a good tenth of the canvas as air on each side. Fitted by
      // height like the others it measured the same and read smaller, because
      // what arrives at 48px here is two marks sharing 38px of ink.
      { acr: 'FAPEMIG', href: 'https://fapemig.br', img: 'fapemig', ext: 'png', webp: true, h: 66, w: 96 },
      { acr: 'CAPES',   href: 'https://capes.gov.br', img: 'capes', ext: 'png', webp: true, h: 42, w: 92 },
      { acr: 'CNPq',    href: 'https://cnpq.br', img: 'cnpq', ext: 'svg', webp: false, h: 34, w: 116 },
    ],
  },
  {
    kind: 'institutions',
    of: [
      { acr: 'UFJF', href: 'https://ufjf.br', img: 'ufjf', ext: 'png', webp: true, lab: 'NIPS', h: 52, w: 86 },
      { acr: 'CERN', href: 'https://cern.ch', img: 'cern', ext: 'svg', webp: false, lab: 'Route Salam', h: 40, w: 74 },
    ],
  },
];

function supporterMark(s) {
  const base = `${ROOT}assets/images/sponsors/${s.img}`;
  const img = `<img src="${base}.${s.ext}" alt="" width="56" height="56" loading="lazy" decoding="async">`;
  return s.webp
    ? `<picture><source srcset="${base}.webp" type="image/webp">${img}</picture>`
    : img;
}

function initSupporters() {
  const host = document.getElementById('supporters');
  if (!host) return;

  const list = (g) => `
      <ul class="sup-list" data-i18n-aria="supporters.${g.kind}">${g.of.map(s => `
        <li>
          <a class="sup-item" href="${s.href}" target="_blank" rel="noopener"
             data-i18n-title="supporters.n_${s.acr.toLowerCase()}"
             data-i18n-aria="supporters.n_${s.acr.toLowerCase()}" aria-label="${s.acr}">
            <span class="sup-mark" style="--mark-h:${s.h}px;--mark-w:${s.w}px">${supporterMark(s)}</span>
          </a>
        </li>`).join('')}
      </ul>`;

  host.className = 'supporters seam';
  host.innerHTML = `
    <div class="supporters-inner">
      <p class="supporters-label" data-i18n="supporters.title">Supported by</p>
      <div class="supporters-bar glass">
        ${list(SUPPORTERS[0])}
        <span class="sup-div" aria-hidden="true"></span>
        ${list(SUPPORTERS[1])}
      </div>
    </div>`;
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
    link.href = rootPath(newsPostUrl(post, 'news/post.html'));
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
      <a href="${rootPath('publications.html')}" class="pub-card" style="height:100%;text-decoration:none">
        <div class="pub-card-body">
          <div class="pub-card-meta">
            <span class="badge ${typeMap[pub.type] || 'badge-gray'}" data-i18n="publications.types.${pub.type}">${pub.type}</span>
            <span class="news-date">${pub.year}</span>
            ${pubLangFlag(pub.title, pub.abstract)}
          </div>
          <div class="pub-title">${pub.title}</div>
          <div class="pub-authors">${pub.authors.join(', ')}</div>
          <div class="pub-journal">${pub.journal}</div>
          <div class="pub-abstract">${pub.abstract.length > 340 ? pub.abstract.substring(0, 340).trim() + '…' : pub.abstract}</div>
          <span class="news-read-more" style="display:inline-flex;align-items:center;gap:4px" data-i18n="common.read_more">Read more <i class="ph ph-arrow-right" aria-hidden="true"></i></span>
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
  btn.classList.add('glass-btn');
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '<i class="ph ph-arrow-up" aria-hidden="true"></i>';
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });

  /* Through the shared module rather than window.scrollTo. A native smooth
     scroll and a library holding the same position would each animate it, and
     the button would fight the page it is trying to move. */
  btn.addEventListener('click', scrollToTop);
}

// ============================================================
// Grid overlay — design-system verification aid
// Mirrors the 12-column guide used in the Figma file so a layout can be checked
// against it directly in the browser. Off by default; append ?grid to any URL
// or press Alt+G. The preference survives navigation within the session.
// ============================================================
function initGridOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'grid-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const inner = document.createElement('div');
  inner.className = 'grid-overlay-inner';
  const cols = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-cols'), 10) || 12;
  for (let i = 0; i < cols; i++) inner.appendChild(document.createElement('i'));

  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  const apply = (on) => {
    document.body.classList.toggle('show-grid', on);
    try { sessionStorage.setItem('nipscern_grid', on ? '1' : '0'); } catch (e) {}
  };

  let on = false;
  try { on = sessionStorage.getItem('nipscern_grid') === '1'; } catch (e) {}
  if (new URLSearchParams(location.search).has('grid')) on = true;
  apply(on);

  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      apply(!document.body.classList.contains('show-grid'));
    }
  });
}

// ============================================================
// Init
// ============================================================
// A page can end up with more than one instance of this module: the browser
// keys module identity on the full URL, so importing it as "main.js?v=<other>"
// (publications.js does) loads a second copy alongside the page's own
// <script src="main.js?v=9cef4aac16">. Each copy would otherwise append its own
// back-to-top button and grid overlay. The flag lives on window, which the
// copies do share, so only the first one bootstraps.
if (!window.__nipscernBooted) {
  window.__nipscernBooted = true;

  /* The page that arrives under a view transition
     ----------------------------------------------------------------
     Entrance elements sit at opacity 0 until the IntersectionObserver marks
     them, and that observer only runs after the translations are in. On an
     ordinary load nobody sees the gap: the page is being painted for the first
     time either way. Under a cross-document view transition that frame is the
     one the browser captures as the new page, so the transition would fade from
     a full page to an empty one and fill in afterwards, which reads as a page
     that failed to load.

     pagereveal fires before that capture and carries the transition object, so
     nothing here touches an ordinary navigation. Anything already inside the
     first screenful is put in place now, with its transition suppressed for the
     frame so it lands rather than starts fading. Everything below the fold is
     left to the observer, which is where the effect is meant to be seen. */
  window.addEventListener('pagereveal', (e) => {
    if (!e.viewTransition) return;
    const h = window.innerHeight || 0;
    const early = document.querySelectorAll('.fade-up, .fade-in, .stagger-children');
    early.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < h && r.bottom > 0) el.classList.add('visible', 'vt-settled');
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('.vt-settled').forEach((el) => el.classList.remove('vt-settled'));
    }));
  });

  document.addEventListener('DOMContentLoaded', async () => {
    /* First, because it wants to find GSAP already loaded and hang itself off
       that ticker, and because everything after this point is free to move the
       scroll position through it. */
    initSmoothScroll();
    initNav();
    initFooter();
    initSupporters();
    initBackToTop();
    initGridOverlay();
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
}
