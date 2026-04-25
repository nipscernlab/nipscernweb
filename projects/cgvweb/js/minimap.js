// ── η × φ radar minimap ──────────────────────────────────────────────────────
// Small 2D canvas in the top-right that plots active cells on the (η, φ) plane
// — the standard ATLAS "phase-space" view. Complements the 3D scene by making
// forward / back-to-back / MET-imbalance events readable at a glance.

const ETA_MIN = -4.9;
const ETA_MAX = 4.9;
const PHI_MIN = -Math.PI;
const PHI_MAX = Math.PI;

// Canvas dimensions in logical (CSS) pixels. Actual backing store is scaled by
// devicePixelRatio for crisp lines on HiDPI screens.
const W = 220;
const H = 120;

// Plot area inset (leaves room for axis labels).
const INSET_L = 22;
const INSET_R = 6;
const INSET_T = 6;
const INSET_B = 14;

const DET_COLOR = {
  TILE: '#c87c18',
  LAR: '#27b568',
  HEC: '#66e0f6',
  FCAL: '#b87333',
};

let _canvas = null;
let _ctx = null;
let _enabled = true;
let _active = null; // Map<handle, {eta, phi, det, energyMev}>
let _fcalCells = null; // Array<{eta, phi, energy}>
let _clusters = null; // Array<{eta, phi, etGev}>

function _plotArea() {
  return {
    x0: INSET_L,
    y0: INSET_T,
    x1: W - INSET_R,
    y1: H - INSET_B,
  };
}

function _etaToX(eta, area) {
  const t = (eta - ETA_MIN) / (ETA_MAX - ETA_MIN);
  return area.x0 + t * (area.x1 - area.x0);
}
function _phiToY(phi, area) {
  // φ increases upward (standard convention in ATLAS plots)
  const t = (phi - PHI_MIN) / (PHI_MAX - PHI_MIN);
  return area.y1 - t * (area.y1 - area.y0);
}

function _drawFrame() {
  const ctx = _ctx;
  const area = _plotArea();
  ctx.clearRect(0, 0, W, H);

  // Background panel
  ctx.fillStyle = 'rgba(8, 14, 28, 0.78)';
  ctx.fillRect(0, 0, W, H);

  // Plot frame
  ctx.strokeStyle = 'rgba(120, 150, 190, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(area.x0 + 0.5, area.y0 + 0.5, area.x1 - area.x0, area.y1 - area.y0);

  // Detector boundary guides: barrel/endcap (|η|=1.5) and endcap/FCAL (|η|=3.2)
  ctx.strokeStyle = 'rgba(120, 150, 190, 0.18)';
  ctx.setLineDash([3, 3]);
  for (const eta of [-3.2, -1.5, 0, 1.5, 3.2]) {
    const x = _etaToX(eta, area);
    ctx.beginPath();
    ctx.moveTo(x, area.y0);
    ctx.lineTo(x, area.y1);
    ctx.stroke();
  }
  // φ = 0 reference line
  const yZero = _phiToY(0, area);
  ctx.beginPath();
  ctx.moveTo(area.x0, yZero);
  ctx.lineTo(area.x1, yZero);
  ctx.stroke();
  ctx.setLineDash([]);

  // Axis labels
  ctx.fillStyle = 'rgba(160, 180, 210, 0.7)';
  ctx.font = '9px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText('η', (area.x0 + area.x1) / 2, area.y1 + 2);
  ctx.textAlign = 'right';
  ctx.fillText('-4', area.x0 + 2, area.y1 + 2);
  ctx.fillText('0', (area.x0 + area.x1) / 2 + 10, area.y1 + 2);
  ctx.fillText('+4', area.x1 - 2, area.y1 + 2);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('+π', area.x0 - 2, area.y0 + 4);
  ctx.fillText('0', area.x0 - 2, yZero);
  ctx.fillText('-π', area.x0 - 2, area.y1 - 4);
  ctx.save();
  ctx.translate(6, (area.y0 + area.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('φ', 0, 0);
  ctx.restore();
}

function _drawPoint(eta, phi, color, size) {
  if (!Number.isFinite(eta) || !Number.isFinite(phi)) return;
  if (eta < ETA_MIN || eta > ETA_MAX) return;
  const area = _plotArea();
  const x = _etaToX(eta, area);
  const y = _phiToY(phi, area);
  const ctx = _ctx;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

function _drawCells() {
  if (!_active) return;
  const ctx = _ctx;
  ctx.globalAlpha = 0.75;
  for (const entry of _active.values()) {
    if (!entry || !entry.eta || entry.eta === undefined) continue;
    const color = DET_COLOR[entry.det] || '#ccc';
    // Size ∝ sqrt(log(E)) — spans 1.5 → 3 px for typical event energies
    const eMev = Math.max(1, Math.abs(entry.energyMev || 0));
    const r = 1.2 + 0.45 * Math.log10(eMev);
    _drawPoint(entry.eta, entry.phi, color, Math.min(3.5, r));
  }
  ctx.globalAlpha = 1;
}

function _drawFcal() {
  if (!_fcalCells || !_fcalCells.length) return;
  const ctx = _ctx;
  ctx.globalAlpha = 0.75;
  for (const c of _fcalCells) {
    if (!Number.isFinite(c.eta)) continue;
    const eGev = Math.abs(c.energy || 0);
    if (eGev < 0.2) continue;
    const r = 1.2 + 0.6 * Math.log10(1000 * eGev);
    _drawPoint(c.eta, c.phi, DET_COLOR.FCAL, Math.min(3.5, r));
  }
  ctx.globalAlpha = 1;
}

function _drawClusters() {
  if (!_clusters || !_clusters.length) return;
  const ctx = _ctx;
  ctx.strokeStyle = '#ff4400';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.85;
  const area = _plotArea();
  for (const c of _clusters) {
    if (!Number.isFinite(c.eta) || !Number.isFinite(c.phi)) continue;
    const x = _etaToX(c.eta, area);
    const y = _phiToY(c.phi, area);
    const r = 2.5 + 0.35 * Math.log10(Math.max(1, c.etGev || 1));
    ctx.beginPath();
    ctx.arc(x, y, Math.min(5, r), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function _redraw() {
  if (!_ctx || !_enabled) return;
  _drawFrame();
  _drawCells();
  _drawFcal();
  _drawClusters();
}

/**
 * Create the canvas, attach it to document.body at top-right, and return a
 * handle. Idempotent — subsequent calls return the existing instance.
 */
export function initMinimap() {
  if (_canvas) return { redraw: _redraw };
  _canvas = document.createElement('canvas');
  _canvas.id = 'minimap';
  _canvas.setAttribute('aria-label', 'η × φ radar');
  _canvas.width = W * Math.min(window.devicePixelRatio || 1, 2);
  _canvas.height = H * Math.min(window.devicePixelRatio || 1, 2);
  _canvas.style.width = W + 'px';
  _canvas.style.height = H + 'px';
  _ctx = _canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  _ctx.scale(dpr, dpr);
  document.body.appendChild(_canvas);
  _redraw();
  return { redraw: _redraw };
}

/**
 * Update minimap with the current event's active cells and extras.
 * @param {{ active: Map<any, any>, fcalCells?: any[], clusters?: any[] }} data
 */
export function updateMinimap({ active, fcalCells, clusters }) {
  _active = active || null;
  _fcalCells = fcalCells || null;
  _clusters = clusters || null;
  _redraw();
}

/** Show/hide the minimap. */
export function setMinimapVisible(visible) {
  _enabled = !!visible;
  if (_canvas) _canvas.style.display = _enabled ? '' : 'none';
  if (_enabled) _redraw();
}

export function isMinimapVisible() {
  return _enabled;
}
