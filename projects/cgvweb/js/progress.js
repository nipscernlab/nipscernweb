const DL_STAGES = ['request', 'recogn', 'download', 'acquire', 'load'];
const DL_PCTS = { request: 10, recogn: 28, download: 58, acquire: 78, load: 95 };

export function createDownloadProgressController() {
  let dlTimer = null;

  function startProgress(kind = 'live') {
    const pEl = document.getElementById('dl-progress');
    if (!pEl) return;
    pEl.classList.toggle('local', kind === 'local');
    pEl.classList.toggle('live', kind !== 'local');
    pEl.hidden = false;
    DL_STAGES.forEach((stage) => {
      const el = document.getElementById('dlst-' + stage);
      if (el) el.classList.remove('active', 'done');
    });
    const bar = document.getElementById('dl-bar-fill');
    if (bar) bar.style.width = '0%';
    advanceProgress('request');
  }

  function advanceProgress(stage) {
    if (dlTimer) clearTimeout(dlTimer);
    const pEl = document.getElementById('dl-progress');
    if (!pEl) return;
    const idx = DL_STAGES.indexOf(stage);
    DL_STAGES.forEach((s, i) => {
      const el = document.getElementById('dlst-' + s);
      if (!el) return;
      el.classList.toggle('done', i < idx);
      el.classList.toggle('active', i === idx);
    });
    const bar = document.getElementById('dl-bar-fill');
    if (bar) bar.style.width = (DL_PCTS[stage] || 0) + '%';
  }

  function endProgress() {
    const bar = document.getElementById('dl-bar-fill');
    if (!bar) return;
    bar.style.width = '100%';
    DL_STAGES.forEach((stage) => {
      const el = document.getElementById('dlst-' + stage);
      if (el) {
        el.classList.remove('active');
        el.classList.add('done');
      }
    });
    dlTimer = setTimeout(() => {
      const p = document.getElementById('dl-progress');
      if (p) p.hidden = true;
      bar.style.width = '0%';
    }, 900);
  }

  return { startProgress, advanceProgress, endProgress };
}
