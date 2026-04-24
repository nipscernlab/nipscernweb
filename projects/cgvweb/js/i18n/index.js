import { TRANSLATIONS } from './translations.js';

let currentLang = 'en';

export function t(key) {
  return (TRANSLATIONS[currentLang] ?? TRANSLATIONS.en)[key] ?? TRANSLATIONS.en[key] ?? key;
}

function applyLang(lang) {
  currentLang = lang;

  const htmlLang = { no: 'nb', pt: 'pt-BR' };
  document.documentElement.lang = htmlLang[lang] ?? lang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n);
    if (v) el.textContent = v;
  });

  document.querySelectorAll('[data-i18n-tip]').forEach((el) => {
    const v = t(el.dataset.i18nTip);
    if (v) el.dataset.tip = v;
  });

  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const v = t(el.dataset.i18nPh);
    if (v) el.placeholder = v;
  });

  document
    .querySelectorAll('.lang-opt')
    .forEach((o) => o.classList.toggle('on', o.dataset.lang === lang));

  localStorage.setItem('cgv-lang', lang);
}

export function initLanguage() {
  const saved = localStorage.getItem('cgv-lang');
  const browser = (navigator.language ?? 'en')
    .split('-')[0]
    .replace('nb', 'no')
    .replace('nn', 'no');
  const initial = saved ?? (['en', 'fr', 'no', 'pt'].includes(browser) ? browser : 'en');

  applyLang(initial);
}

export function setupLanguagePicker() {
  const langMenu = document.getElementById('lang-menu');
  const langButton = document.getElementById('btn-lang');
  if (!langMenu || !langButton) return;

  langButton.addEventListener('click', (e) => {
    e.stopPropagation();

    const open = langMenu.classList.toggle('open');
    if (!open) return;

    const br = langButton.getBoundingClientRect();
    const mw = langMenu.offsetWidth || 140;
    const mh = langMenu.offsetHeight || 110;
    let left = br.left + br.width / 2 - mw / 2;
    let top = br.top - mh - 10;

    left = Math.max(6, Math.min(left, window.innerWidth - mw - 6));
    top = Math.max(6, top);

    langMenu.style.left = `${left}px`;
    langMenu.style.top = `${top}px`;
  });

  document.addEventListener('click', () => langMenu.classList.remove('open'));

  document.querySelectorAll('.lang-opt').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      applyLang(opt.dataset.lang);
      langMenu.classList.remove('open');
    });
  });
}
