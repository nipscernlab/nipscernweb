import { esc } from './utils.js';

const statusTxtEl = document.getElementById('status-txt');
const collisionHud = document.getElementById('collision-hud');

let _lastEventInfo = null;
let _collisionHudEnabled = true;
let _getPanelPinned = () => false;
let _t = (k) => k;

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
  const hiddenByPanel = _getPanelPinned();
  collisionHud.hidden = !(_collisionHudEnabled && _lastEventInfo && !hiddenByPanel);
  if (!collisionHud.hidden) _buildCollisionHud();
}

export function setCollisionHudEnabled(enabled) {
  _collisionHudEnabled = !!enabled;
  updateCollisionHud();
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
    setStatus(`<span class="muted">${esc(_t('status-no-metadata'))}</span>`);
    return;
  }
  // Event info (run/event/LB/timestamp) is shown exclusively in the top-left
  // collision HUD now. The statusbar just shows a brief "loaded" confirmation.
  setStatus(`<span class="ev-meta">${esc(_t('status-loaded'))}</span>`);
}

export function initStatusHud({ t, isCollisionHudEnabled, getPanelPinned } = {}) {
  if (t) _t = t;
  if (typeof isCollisionHudEnabled === 'function') _collisionHudEnabled = !!isCollisionHudEnabled();
  if (typeof getPanelPinned === 'function') _getPanelPinned = getPanelPinned;
}
