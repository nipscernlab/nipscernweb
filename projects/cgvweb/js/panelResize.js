export function setupPanelResize() {
  const panelEl = document.getElementById('panel');
  const panelResizer = document.getElementById('panel-resizer');

  const savedPW = localStorage.getItem('cgv-panel-width');
  if (savedPW) document.documentElement.style.setProperty('--pw', savedPW + 'px');

  let prDrag = false,
    prStartX = 0,
    prStartW = 0;

  panelResizer.addEventListener('pointerdown', (e) => {
    prDrag = true;
    prStartX = e.clientX;
    prStartW = panelEl.getBoundingClientRect().width;
    panelResizer.setPointerCapture(e.pointerId);
    panelResizer.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!prDrag) return;
    const newW = Math.max(180, Math.min(520, prStartW + e.clientX - prStartX));
    document.documentElement.style.setProperty('--pw', newW + 'px');
  });
  document.addEventListener('pointerup', () => {
    if (!prDrag) return;
    prDrag = false;
    panelResizer.classList.remove('dragging');
    const w = Math.round(
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pw')),
    );
    localStorage.setItem('cgv-panel-width', w);
  });
}
