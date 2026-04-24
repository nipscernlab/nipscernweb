// Loading screen progress bar and request counter.

const _loadBar = document.getElementById('loading-bar');
const _loadMsg = document.getElementById('loading-msg');

// RAF loop: eases _barCurrent toward _barTarget with an asymptotic creep so
// the bar never freezes during the GLB parse phase (ceiling 79%; the success
// callback jumps directly to 100%).
let _barTarget = 0;
let _barCurrent = 0;
let _barRafId = null;

function _barTick() {
  if (_barTarget < 79) _barTarget += (79 - _barTarget) * 0.003;
  const gap = _barTarget - _barCurrent;
  _barCurrent += gap > 0.05 ? gap * 0.1 : gap;
  if (_loadBar) _loadBar.style.width = _barCurrent.toFixed(2) + '%';
  _barRafId = requestAnimationFrame(_barTick);
}
_barRafId = requestAnimationFrame(_barTick);

export function setLoadProgress(pct, msg) {
  _barTarget = Math.max(_barTarget, Math.min(100, pct));
  if (_loadMsg && msg) _loadMsg.textContent = msg;
}

export function dismissLoadingScreen() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  cancelAnimationFrame(_barRafId);
  _barRafId = null;
  if (_loadBar) _loadBar.style.width = '100%';
  overlay.classList.add('done');
  setTimeout(() => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }, 750);
}

// Request counter shown in the status badge.
const _reqBadge = document.getElementById('req-badge');
let _reqCount = 0;
export function bumpReq() {
  _reqCount++;
  if (_reqBadge) _reqBadge.textContent = `${_reqCount} req`;
}
