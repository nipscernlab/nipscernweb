export function setupButtonTooltips() {
  const btnTipEl = document.getElementById('btn-tip');

  function show(anchor, text) {
    btnTipEl.textContent = text;
    btnTipEl.classList.add('show');
    const ar = anchor.getBoundingClientRect();
    const tw = btnTipEl.offsetWidth, th = btnTipEl.offsetHeight, gap = 8;
    let left, top;
    if (anchor.closest('#toolbar')) {
      left = ar.left + ar.width/2 - tw/2;
      top  = ar.top - th - gap;
    } else {
      left = ar.right + gap;
      top  = ar.top + ar.height/2 - th/2;
    }
    left = Math.max(6, Math.min(left, window.innerWidth  - tw - 6));
    top  = Math.max(6, Math.min(top,  window.innerHeight - th - 6));
    btnTipEl.style.left = left + 'px';
    btnTipEl.style.top  = top  + 'px';
  }
  function hide() { btnTipEl.classList.remove('show'); }

  document.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', () => show(el, el.dataset.tip));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('click',      hide);
  });
}
