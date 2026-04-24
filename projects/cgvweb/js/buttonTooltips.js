// Parse a tooltip string like "Reset camera (R)" or "Slicer … (Shift+S)" into
// its main text and (optional) keyboard shortcut. The shortcut pattern must
// be the last parenthesised group at the very end of the string and contain
// only key names / modifiers.
const SHORTCUT_RE = /\s*\(([A-Za-z0-9]+(?:\+[A-Za-z0-9]+)*(?:\s*\/\s*[A-Za-z0-9]+)*)\)\s*$/;

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Convert "Shift+B" → "<kbd>Shift</kbd>+<kbd>B</kbd>" and "L / A" → two kbds.
function formatShortcut(raw) {
  const parts = raw.split(/\s*\/\s*/); // alternatives split by "/"
  return parts
    .map((alt) =>
      alt
        .split('+')
        .map((k) => `<kbd>${escHtml(k.trim())}</kbd>`)
        .join('+'),
    )
    .join(' / ');
}

function renderTip(text) {
  const m = SHORTCUT_RE.exec(text);
  if (!m) return { html: escHtml(text), isHtml: false };
  const main = text.slice(0, m.index);
  const kbd = formatShortcut(m[1]);
  return { html: `${escHtml(main)} <span class="tip-kbd">${kbd}</span>`, isHtml: true };
}

export function setupButtonTooltips() {
  const btnTipEl = document.getElementById('btn-tip');

  function show(anchor, text) {
    const { html, isHtml } = renderTip(text);
    if (isHtml) btnTipEl.innerHTML = html;
    else btnTipEl.textContent = text;
    btnTipEl.classList.add('show');
    const ar = anchor.getBoundingClientRect();
    const tw = btnTipEl.offsetWidth,
      th = btnTipEl.offsetHeight,
      gap = 8;
    let left, top;
    if (anchor.closest('#toolbar')) {
      left = ar.left + ar.width / 2 - tw / 2;
      top = ar.top - th - gap;
    } else {
      left = ar.right + gap;
      top = ar.top + ar.height / 2 - th / 2;
    }
    left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));
    top = Math.max(6, Math.min(top, window.innerHeight - th - 6));
    btnTipEl.style.left = left + 'px';
    btnTipEl.style.top = top + 'px';
  }
  function hide() {
    btnTipEl.classList.remove('show');
  }

  document.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('mouseenter', () => show(el, el.dataset.tip));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('click', hide);
  });
}
