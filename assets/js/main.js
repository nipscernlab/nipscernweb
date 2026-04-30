/**
 * NIPSCERN — Main JS Module
 * Navigation, footer injection, animations, shared utilities
 */

import { initI18n, getLang, setLanguage } from './i18n.js';

// ============================================================
// Navigation Template
// ============================================================

const NAV_LINKS = [
  { key: 'nav.home',         href: '',           paths: ['/'] },
  { key: 'nav.about',        href: 'about',      paths: ['/about', '/about.html'] },
  { key: 'nav.cern',         href: 'cern',       paths: ['/cern', '/cern.html'] },
  { key: 'nav.projects',     href: 'projects/',  paths: ['/projects/', '/projects/index.html', '/projects', '/projects/sapho', '/projects/sapho.html', '/projects/yanc', '/projects/yanc.html', '/projects/polaris', '/projects/polaris.html', '/projects/aurora', '/projects/aurora.html', '/projects/cgv', '/projects/cgv.html'] },
  { key: 'nav.publications', href: 'publications', paths: ['/publications', '/publications.html'] },
  { key: 'nav.news',         href: 'news/',      paths: ['/news/', '/news/index.html', '/news', '/news/post', '/news/post.html'] },
];

/**
 * Root URL of the project — derived from this module's own URL.
 * main.js lives at assets/js/main.js → go up 2 levels to reach the project root.
 * Works on localhost, GitHub Pages subdirectory, and custom domain.
 */
const ROOT = new URL('../../', import.meta.url).href;

const FLAG_SVGS = {
  en: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30">
<defs>
<clipPath id="uk-outer"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
<clipPath id="uk-inner"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
</defs>
<g clip-path="url(#uk-outer)">
<path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
<path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>
<path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#uk-inner)" stroke="#C8102E" stroke-width="4"/>
<path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/>
<path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/>
</g>
</svg>`,
  pt: `<svg width="1000" height="700" viewBox="-2100 -1470 4200 2940" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><g id="G"><clipPath id="g"><path d="m-31.5 0v-70h63v70zm31.5-47v12h31.5v-12z"/></clipPath><use clip-path="url(#g)" xlink:href="#O"/><path d="M5-35H31.5V-25H5z"/><path d="m21.5-35h10v35h-10z"/></g><g id="R"><use xlink:href="#P"/><path d="m28 0c0-10 0-32-15-32h-19c22 0 22 22 22 32"/></g><g id="s" fill="#fff"><g id="c"><path id="t" transform="rotate(18,0,-1)" d="m0-1v1h0.5"/><use transform="scale(-1,1)" xlink:href="#t"/></g><use transform="rotate(72)" xlink:href="#c"/><use transform="rotate(-72)" xlink:href="#c"/><use transform="rotate(144)" xlink:href="#c"/><use transform="rotate(216)" xlink:href="#c"/></g><g id="a"><use transform="scale(31.5)" xlink:href="#s"/></g><g id="b"><use transform="scale(26.25)" xlink:href="#s"/></g><g id="f"><use transform="scale(21)" xlink:href="#s"/></g><g id="h"><use transform="scale(15)" xlink:href="#s"/></g><g id="i"><use transform="scale(10.5)" xlink:href="#s"/></g><path id="D" d="m-31.5 0h33a30 30 0 0 0 30-30v-10a30 30 0 0 0-30-30h-33zm13-13h19a19 19 0 0 0 19-19v-6a19 19 0 0 0-19-19h-19z" fill-rule="evenodd"/><path id="E" transform="translate(-31.5)" d="m0 0h63v-13h-51v-18h40v-12h-40v-14h48v-13h-60z"/><path id="e" d="m-26.25 0h52.5v-12h-40.5v-16h33v-12h-33v-11h39.25v-12h-51.25z"/><path id="M" d="m-31.5 0h12v-48l14 48h11l14-48v48h12v-70h-17.5l-14 48-14-48h-17.5z"/><path id="O" d="m0 0a31.5 35 0 0 0 0-70 31.5 35 0 0 0 0 70m0-13a18.5 22 0 0 0 0-44 18.5 22 0 0 0 0 44" fill-rule="evenodd"/><path id="P" d="m-31.5 0h13v-26h28a22 22 0 0 0 0-44h-40zm13-39h27a9 9 0 0 0 0-18h-27z" fill-rule="evenodd"/><path id="S" d="m-15.75-22c0 7 6.75 10.5 16.75 10.5s14.74-3.25 14.75-7.75c0-14.25-46.75-5.25-46.5-30.25 0.25-21.5 24.75-20.5 33.75-20.5s26 4 25.75 21.25h-15.25c0-7.5-7-10.25-15-10.25-7.75 0-13.25 1.25-13.25 8.5-0.25 11.75 46.25 4 46.25 28.75 0 18.25-18 21.75-31.5 21.75-11.5 0-31.55-4.5-31.5-22z"/></defs><clipPath id="B"><circle r="735"/></clipPath><path d="m-2100-1470h4200v2940h-4200z" fill="#009440"/><path d="M -1743,0 0,1113 1743,0 0,-1113 Z" fill="#ffcb00"/><circle r="735" fill="#302681"/><path d="m-2205 1470a1785 1785 0 0 1 3570 0h-105a1680 1680 0 1 0-3360 0z" clip-path="url(#B)" fill="#fff"/><g transform="translate(-420,1470)" fill="#009440"><use transform="rotate(-7)" y="-1697.5" xlink:href="#O"/><use transform="rotate(-4)" y="-1697.5" xlink:href="#R"/><use transform="rotate(-1)" y="-1697.5" xlink:href="#D"/><use transform="rotate(2)" y="-1697.5" xlink:href="#E"/><use transform="rotate(5)" y="-1697.5" xlink:href="#M"/><use transform="rotate(9.75)" y="-1697.5" xlink:href="#e"/><use transform="rotate(14.5)" y="-1697.5" xlink:href="#P"/><use transform="rotate(17.5)" y="-1697.5" xlink:href="#R"/><use transform="rotate(20.5)" y="-1697.5" xlink:href="#O"/><use transform="rotate(23.5)" y="-1697.5" xlink:href="#G"/><use transform="rotate(26.5)" y="-1697.5" xlink:href="#R"/><use transform="rotate(29.5)" y="-1697.5" xlink:href="#E"/><use transform="rotate(32.5)" y="-1697.5" xlink:href="#S"/><use transform="rotate(35.5)" y="-1697.5" xlink:href="#S"/><use transform="rotate(38.5)" y="-1697.5" xlink:href="#O"/></g><use x="-600" y="-132" xlink:href="#a"/><use x="-535" y="177" xlink:href="#a"/><use x="-625" y="243" xlink:href="#b"/><use x="-463" y="132" xlink:href="#h"/><use x="-382" y="250" xlink:href="#b"/><use x="-404" y="323" xlink:href="#f"/><use x="228" y="-228" xlink:href="#a"/><use x="515" y="258" xlink:href="#a"/><use x="617" y="265" xlink:href="#f"/><use x="545" y="323" xlink:href="#b"/><use x="368" y="477" xlink:href="#b"/><use x="367" y="551" xlink:href="#f"/><use x="441" y="419" xlink:href="#f"/><use x="500" y="382" xlink:href="#b"/><use x="365" y="405" xlink:href="#f"/><use x="-280" y="30" xlink:href="#b"/><use x="200" y="-37" xlink:href="#f"/><use y="330" xlink:href="#a"/><use x="85" y="184" xlink:href="#b"/><use y="118" xlink:href="#b"/><use x="-74" y="184" xlink:href="#f"/><use x="-37" y="235" xlink:href="#h"/><use x="220" y="495" xlink:href="#b"/><use x="283" y="430" xlink:href="#f"/><use x="162" y="412" xlink:href="#f"/><use x="-295" y="390" xlink:href="#a"/><use y="575" xlink:href="#i"/></svg>`,
  fr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><rect width="300" height="600" fill="#002395"/><rect x="300" width="300" height="600" fill="#fff"/><rect x="600" width="300" height="600" fill="#ED2939"/></svg>`,
  no: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 22 16">
	<title>Flag of Norway</title>
	<rect width="22" height="16" fill="#ba0c2f"/>
	<path d="M0,8h22M8,0v16" stroke="#fff" stroke-width="4"/>
	<path d="M0,8h22M8,0v16" stroke="#00205b" stroke-width="2"/>
</svg>`,
};

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
    return `<a href="${href}" class="nav-link${isActivePath(link) ? ' active' : ''}" data-i18n="${link.key}">${link.key}</a>`;
  }).join('');

  const langBtns = ['en', 'pt', 'fr', 'no'].map(lang => `
    <button class="lang-btn" data-lang="${lang}" aria-label="${lang.toUpperCase()} language" aria-pressed="false">
      ${FLAG_SVGS[lang]}
    </button>
  `).join('');

  const mobileLinksHtml = NAV_LINKS.map(link => {
    const href = ROOT + link.href;
    const isActive = isActivePath(link);
    return `<a href="${href}" class="nav-mobile-link${isActive ? ' active' : ''}" data-i18n="${link.key}">${link.key}</a>`;
  }).join('');

  return `
    <div class="nav-inner">
      <a href="${ROOT}" class="nav-logo" aria-label="NIPSCERN Home">
        <img src="${ROOT}assets/icons/icon_home_nipscern.svg" alt="NIPSCERN Logo" class="nav-logo-mark">
        <span class="nav-logo-text">NIPS${atomIcon}CERN</span>
      </a>

      <nav class="nav-links" role="navigation" aria-label="Main navigation">
        ${linksHtml}
      </nav>

      <div class="nav-right">
        <div class="lang-switcher" role="group" aria-label="Language selector">
          ${langBtns}
        </div>
        <a href="nipscern.com/projects/cgvweb" target="_blank" rel="noopener noreferrer" class="nav-cgv-link" aria-label="CGVWEB Project" title="CGVWEB">
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
          <img src="${ROOT}assets/icons/icon_home_nipscern.svg" alt="NIPSCERN Logo" class="nav-logo-mark">
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
        <a href="nipscern.com/projects/cgvweb" target="_blank" rel="noopener noreferrer" class="nav-mobile-cgv-link">
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
    return `<li><a href="${href}" data-i18n="${link.key}">${link.key}</a></li>`;
  }).join('');

  return `
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo">
          <img src="${ROOT}assets/icons/icon_home_nipscern.svg" alt="NIPSCERN Logo" class="nav-logo-mark">
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
            <strong style="color:var(--text-secondary);display:block;margin-bottom:2px">NIPSCERN / PPEE Lab</strong>
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
          <li><a href="https://nipscern.com" target="_blank" rel="noopener">nipscern.com</a></li>
          <li><a href="https://lattes.cnpq.br/5454168673866452" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px">
            <img src="${ROOT}assets/icons/lattes_icon.svg" alt="Lattes" style="width:14px;height:14px" aria-hidden="true"> Luciano — Lattes
          </a></li>
          <li><a href="https://github.com/Chrysthofer" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px"><i class="ph ph-github-logo" aria-hidden="true"></i> Chrysthofer — GitHub</a></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <p data-i18n="footer.copyright">© 2025 NIPSCERN — Federal University of Juiz de Fora. All rights reserved.</p>
      <div style="display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:var(--sp-3);font-size:var(--text-xs);color:var(--text-muted)">
          <a href="${ROOT}credits" style="color:var(--text-muted);text-decoration:none;transition:color 0.15s" onmouseover="this.style.color='var(--text-secondary)'" onmouseout="this.style.color='var(--text-muted)'">Credits</a>
          <span aria-hidden="true">·</span>
          <a href="${ROOT}terms" style="color:var(--text-muted);text-decoration:none;transition:color 0.15s" onmouseover="this.style.color='var(--text-secondary)'" onmouseout="this.style.color='var(--text-muted)'">Terms</a>
          <span aria-hidden="true">·</span>
          <a href="${ROOT}privacy" style="color:var(--text-muted);text-decoration:none;transition:color 0.15s" onmouseover="this.style.color='var(--text-secondary)'" onmouseout="this.style.color='var(--text-muted)'">Privacy</a>
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
/** Resolve a root-relative path using the module's known location */
function rootPath(rel) {
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

// Format date like "18 Nov 2024"
export function formatDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
      const img = document.createElement('img');
      img.src = rootPath(post.image);
      img.alt = '';
      img.loading = 'lazy';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      const icon = document.createElement('i');
      icon.className = 'ph ph-newspaper';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.display = 'none';
      img.onerror = () => { img.style.display = 'none'; icon.style.display = ''; };
      imgDiv.appendChild(img);
      imgDiv.appendChild(icon);
    } else {
      const icon = document.createElement('i');
      icon.className = 'ph ph-newspaper';
      icon.setAttribute('aria-hidden', 'true');
      imgDiv.appendChild(icon);
    }

    const link = document.createElement('a');
    link.href = rootPath('news/') + '#' + post.id;
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

    const titleEl = document.createElement('div');
    titleEl.className = 'news-title';
    titleEl.textContent = post.title;

    const excerptEl = document.createElement('div');
    excerptEl.className = 'news-excerpt';
    excerptEl.textContent = post.excerpt;

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
    const pub = pubData[0];
    const typeMap = { article: 'badge-blue', conference: 'badge-green', tcc: 'badge-amber', dissertation: 'badge-purple' };
    pubEl.innerHTML = `
      <a href="${rootPath('publications')}" class="pub-card" style="height:100%;display:block;text-decoration:none">
        <div class="pub-card-body">
          <div class="pub-card-meta">
            <span class="badge ${typeMap[pub.type] || 'badge-gray'}" data-i18n="publications.types.${pub.type}">${pub.type}</span>
            <span class="news-date">${pub.year}</span>
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
  await initI18n();
  initAnimations();

  // Page-specific: home page dynamic content
  if (document.getElementById('latest-news-card') || document.getElementById('latest-pub-card')) {
    await initHomeLatest();
    // Re-apply translations to newly injected elements
    setLanguage(getLang());
  }
});
