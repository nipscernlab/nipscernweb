import { esc } from './utils.js';

const statusTxtEl = document.getElementById('status-txt');
const collisionHud = document.getElementById('collision-hud');

let _lastEventInfo = null;

let _getPanelPinned = () => false;
let _getCinemaMode = () => false;
let _isHintsEnabled = () => true;

export function getLastEventInfo() {
  return _lastEventInfo;
}

export function setStatus(h) {
  statusTxtEl.innerHTML = h;
}

function _buildCollisionHud() {
  const info = _lastEventInfo;
  if (!info) {
    collisionHud.innerHTML = '';
    return;
  }
  const fields = [
    ['Date/Time', info.dateTime],
    ['Run', info.runNumber],
    ['Event', info.eventNumber],
    ['Lumi Block', info.lumiBlock],
    ['Version', info.version],
  ];
  collisionHud.innerHTML = fields
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="ch-key">${esc(k)}</span><span class="ch-val">${esc(v)}</span>`)
    .join('');
}

export function updateCollisionHud() {
  const visible = !_getPanelPinned() || _getCinemaMode();
  collisionHud.hidden = !(visible && _lastEventInfo);
  if (!collisionHud.hidden) _buildCollisionHud();
}

const BASE_TITLE = 'CGV — Calorimeter Geometry Viewer';
function _updateDocumentTitle(info) {
  if (!info || (!info.runNumber && !info.eventNumber)) {
    document.title = BASE_TITLE;
    return;
  }
  const run = info.runNumber || '—';
  const evt = info.eventNumber || '—';
  document.title = `CGV — Run ${run} | Event ${evt}`;
}

export function showEventInfo(info) {
  _lastEventInfo = info;
  updateCollisionHud();
  _updateDocumentTitle(info);
  if (!info) {
    setStatus('<span class="muted">No event metadata</span>');
    return;
  }
  const dt = info.dateTime || '—';
  const run = info.runNumber || '—';
  const evt = info.eventNumber || '—';
  const lb = info.lumiBlock || '—';
  setStatus(
    `<span class="ev-dt">${esc(dt)}</span>` +
      `<span class="ev-sep">·</span>` +
      `<span class="ev-meta">Run <b>${esc(run)}</b></span>` +
      `<span class="ev-sep">·</span>` +
      `<span class="ev-meta">Evt <b>${esc(evt)}</b></span>` +
      `<span class="ev-sep">·</span>` +
      `<span class="ev-meta">LB <b>${esc(lb)}</b></span>`,
  );
}

// ── Statusbar hint: full collision info on hover ──────────────────────────────
function _installStatusBarHint() {
  const sb = document.getElementById('statusbar');
  const hint = document.getElementById('stat-hint');
  if (!sb || !hint) return;
  const LABELS = {
    'Date/Time': 'dateTime',
    'Run Number': 'runNumber',
    'Event Number': 'eventNumber',
    'Lumi Block': 'lumiBlock',
    Version: 'version',
  };
  function build() {
    const info = _lastEventInfo;
    if (!info) {
      hint.innerHTML = `<span class="sh-key">Status</span><span class="sh-val">${esc(statusTxtEl.textContent)}</span>`;
      return;
    }
    let html = '';
    for (const [k, prop] of Object.entries(LABELS)) {
      const v = info[prop];
      if (!v) continue;
      html += `<span class="sh-key">${esc(k)}</span><span class="sh-val">${esc(v)}</span>`;
    }
    hint.innerHTML =
      html || `<span class="sh-key">Event</span><span class="sh-val">no metadata</span>`;
  }
  function show() {
    if (!_isHintsEnabled()) return;
    build();
    hint.classList.add('show');
    const sr = sb.getBoundingClientRect();
    const hw = hint.offsetWidth,
      hh = hint.offsetHeight,
      gap = 8;
    let left = sr.left;
    let top = sr.top - hh - gap;
    left = Math.max(6, Math.min(left, window.innerWidth - hw - 6));
    if (top < 6) top = sr.bottom + gap;
    hint.style.left = left + 'px';
    hint.style.top = top + 'px';
  }
  function hide() {
    hint.classList.remove('show');
  }
  sb.addEventListener('mouseenter', show);
  sb.addEventListener('mouseleave', hide);
}

export function initStatusHud({ getPanelPinned, getCinemaMode, isHintsEnabled } = {}) {
  if (getPanelPinned) _getPanelPinned = getPanelPinned;
  if (getCinemaMode) _getCinemaMode = getCinemaMode;
  if (isHintsEnabled) _isHintsEnabled = isHintsEnabled;
  _installStatusBarHint();
}
