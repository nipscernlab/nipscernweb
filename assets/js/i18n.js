/**
 * NIPSCERN i18n — Internationalisation Module
 * Supports: en, pt, fr, no
 */

const SUPPORTED_LANGS = ['en', 'pt', 'fr', 'no'];
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'nipscern_lang';

let translations = {};
let currentLang = DEFAULT_LANG;

/**
 * Root URL of the project — derived from this module's own URL.
 * i18n.js lives at assets/js/i18n.js → go up 2 levels to reach the root.
 * This works regardless of the server path (localhost, GitHub Pages subdir, or custom domain).
 */
const ROOT = new URL('../../', import.meta.url).href;

/** Detect stored or browser language */
function detectLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;

  const browserLangs = navigator.languages || [navigator.language || navigator.userLanguage || ''];
  for (const lang of browserLangs) {
    const code = lang.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGS.includes(code)) return code;
  }
  return DEFAULT_LANG;
}

/** Resolve a root-relative path robustly using import.meta.url */
function rootPath(rel) {
  return ROOT + rel;
}

/** Load the i18n JSON from data/i18n.json (relative to root) */
async function loadTranslations() {
  const path = rootPath('data/i18n.json');

  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    translations = await res.json();
  } catch (e) {
    console.warn('[i18n] Could not load translations:', e);
    translations = {};
  }
}

/** Deep-get a key like "nav.home" from a nested object */
function getKey(obj, path) {
  return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj);
}

/** Apply translations to all [data-i18n] elements */
function applyTranslations(lang) {
  const t = translations[lang] || translations[DEFAULT_LANG] || {};

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = getKey(t, key);
    if (val !== null && typeof val === 'string') {
      // If element has child elements (e.g. icons), update only the first text node
      // to avoid destroying child elements like <i class="ph ...">
      if (el.children.length > 0) {
        let updated = false;
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = val + ' ';
            updated = true;
            break;
          }
        }
        // If no text node found, prepend one
        if (!updated) {
          el.insertBefore(document.createTextNode(val + ' '), el.firstChild);
        }
      } else {
        el.textContent = val;
      }
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = getKey(t, key);
    if (val !== null && typeof val === 'string') {
      el.placeholder = val;
    }
  });

  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    const val = getKey(t, key);
    if (val !== null && typeof val === 'string') {
      el.setAttribute('aria-label', val);
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const val = getKey(t, key);
    if (val !== null && typeof val === 'string') {
      el.title = val;
    }
  });
}

/** Update lang switcher button states */
function updateLangButtons(lang) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const btnLang = btn.getAttribute('data-lang');
    btn.classList.toggle('active', btnLang === lang);
    btn.setAttribute('aria-pressed', btnLang === lang ? 'true' : 'false');
  });
}

/** Set language and persist */
export async function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  if (!translations[lang]) await loadTranslations();

  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;

  applyTranslations(lang);
  updateLangButtons(lang);

  // Dispatch event so other modules can react
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

/** Get a single translated string */
export function t(key) {
  const obj = translations[currentLang] || translations[DEFAULT_LANG] || {};
  return getKey(obj, key) || key;
}

/** Get current language code */
export function getLang() {
  return currentLang;
}

/** Initialise i18n — call once on DOMContentLoaded */
export async function initI18n() {
  await loadTranslations();
  const lang = detectLanguage();
  await setLanguage(lang);

  // Bind lang switcher buttons
  document.addEventListener('click', e => {
    const btn = e.target.closest('.lang-btn');
    if (btn) {
      const lang = btn.getAttribute('data-lang');
      if (lang) setLanguage(lang);
    }
  });
}
