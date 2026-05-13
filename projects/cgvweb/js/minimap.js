// ── η × φ energy-heatmap minimap ─────────────────────────────────────────────
// 2D canvas in the top-left. Shows the standard ATLAS calorimetry grid
// (Δη = Δφ = 0.1) coloured by summed cell energies. Fed by the visibility
// pipeline AFTER every per-cell filter but BEFORE the η×φ rectangles — so
// the user always sees the full event and can decide where to place rects.
//
// Interaction:
//   • hover empty plot  → cursor: crosshair
//   • hover over rect   → cursor: grab (grabbing while dragging)
//   • mousedown + drag on empty area → draw a new rectangle (appended to list)
//   • mousedown + drag on existing rect → translate that rectangle
//   • click on existing rect (no drag) → delete that rectangle
//   • click on empty area (no drag) → no-op
//   • multiple rects may overlap; visibility uses the UNION of all rects

const ETA_MIN = -4.9;
const ETA_MAX = 4.9;
const PHI_MIN = -Math.PI;
const PHI_MAX = Math.PI;

const BIN_ETA = 0.1;
const BIN_PHI = 0.1;
const NBINS_ETA = Math.ceil((ETA_MAX - ETA_MIN) / BIN_ETA);
const NBINS_PHI = Math.ceil((PHI_MAX - PHI_MIN) / BIN_PHI);

const W = 400;
const H = 220;

const INSET_L = 26;
const INSET_R = 78;
const INSET_T = 10;
const INSET_B = 20;

const LEGEND_W = 10;
const LEGEND_GAP = 6;

// Vivid physics-style heat ramp: near-black → deep blue → bright cyan →
// pure yellow → pure red. High saturation and strong contrast so hot bins
// stand out clearly against cold ones on any display.
const RAMP = [
  [8, 8, 20],
  [10, 30, 210],
  [0, 215, 255],
  [255, 245, 0],
  [255, 20, 0],
];

let _canvas = null;
let _ctx = null;
let _enabled = false;

/** @type {Array<{eta:number, phi:number, energyMev:number}>} */
let _cellEntries = [];
/** @type {Array<{eta:number, phi:number, energyMev:number}>} */
let _fcalEntries = [];

let _binCache = null;

// Array of active η×φ rectangles. Each element: {etaMin, etaMax, phiMin, phiMax}.
/** @type {Array<{etaMin:number, etaMax:number, phiMin:number, phiMax:number}>} */
let _rects = [];

// Mouse state machine.
//   'idle'       — no gesture
//   'maybe-draw' — mousedown on empty area; release = no-op, drag = new rect
//   'maybe-pan'  — mousedown on existing rect; release = delete, drag = move
//   'drawing'    — sweeping out a new rect (already pushed to _rects)
//   'panning'    — translating an existing rect
let _mouseState = 'idle';
let _dragAnchor = null;
let _activeRectIdx = -1;
const DRAG_THRESHOLD_PX = 3;
const MIN_RECT_ETA = 0.05;
const MIN_RECT_PHI = 0.05;

let _regionListener = null;

// ── Coordinate helpers ──────────────────────────────────────────────────────
function _plotArea() {
  return { x0: INSET_L, y0: INSET_T, x1: W - INSET_R, y1: H - INSET_B };
}
function _etaToX(eta, area) {
  const t = (eta - ETA_MIN) / (ETA_MAX - ETA_MIN);
  return area.x0 + t * (area.x1 - area.x0);
}
function _phiToY(phi, area) {
  const t = (phi - PHI_MIN) / (PHI_MAX - PHI_MIN);
  return area.y1 - t * (area.y1 - area.y0);
}
function _xToEta(x, area) {
  const t = (x - area.x0) / (area.x1 - area.x0);
  return ETA_MIN + t * (ETA_MAX - ETA_MIN);
}
function _yToPhi(y, area) {
  const t = (area.y1 - y) / (area.y1 - area.y0);
  return PHI_MIN + t * (PHI_MAX - PHI_MIN);
}
function _clientToCanvas(ev) {
  const r = _canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function _ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const seg = t * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

function _normalizeRect(r) {
  return {
    etaMin: Math.min(r.etaMin, r.etaMax),
    etaMax: Math.max(r.etaMin, r.etaMax),
    phiMin: Math.min(r.phiMin, r.phiMax),
    phiMax: Math.max(r.phiMin, r.phiMax),
  };
}

// ── Binning ─────────────────────────────────────────────────────────────────
function _buildBins() {
  if (_binCache) return _binCache;
  const grid = new Float32Array(NBINS_ETA * NBINS_PHI);
  let max = 0;
  let min = Infinity;
  const add = (eta, phi, eMev) => {
    if (eMev <= 0) return;
    if (!Number.isFinite(eta) || !Number.isFinite(phi)) return;
    if (eta < ETA_MIN || eta > ETA_MAX) return;
    const ix = Math.min(NBINS_ETA - 1, Math.max(0, Math.floor((eta - ETA_MIN) / BIN_ETA)));
    const iy = Math.min(NBINS_PHI - 1, Math.max(0, Math.floor((phi - PHI_MIN) / BIN_PHI)));
    grid[iy * NBINS_ETA + ix] += eMev;
  };
  for (const e of _cellEntries) add(e.eta, e.phi, Math.abs(e.energyMev || 0));
  for (const e of _fcalEntries) add(e.eta, e.phi, Math.abs(e.energyMev || 0));
  for (let k = 0; k < grid.length; k++) {
    const v = grid[k];
    if (v > 0) {
      if (v > max) max = v;
      if (v < min) min = v;
    }
  }
  if (!Number.isFinite(min)) min = 0;
  _binCache = { grid, min, max };
  return _binCache;
}

// ── Drawing ─────────────────────────────────────────────────────────────────
function _drawFrame() {
  const ctx = _ctx;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8, 14, 28, 0.82)';
  ctx.fillRect(0, 0, W, H);
  const area = _plotArea();
  ctx.strokeStyle = 'rgba(120, 150, 190, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(area.x0 + 0.5, area.y0 + 0.5, area.x1 - area.x0, area.y1 - area.y0);
}

function _drawAxes() {
  const ctx = _ctx;
  const area = _plotArea();
  ctx.strokeStyle = 'rgba(150, 180, 220, 0.18)';
  ctx.setLineDash([3, 3]);
  for (const eta of [-3.2, -1.5, 0, 1.5, 3.2]) {
    const x = _etaToX(eta, area);
    ctx.beginPath();
    ctx.moveTo(x, area.y0);
    ctx.lineTo(x, area.y1);
    ctx.stroke();
  }
  const yZero = _phiToY(0, area);
  ctx.beginPath();
  ctx.moveTo(area.x0, yZero);
  ctx.lineTo(area.x1, yZero);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(170, 195, 225, 0.78)';
  ctx.font = '9px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText('η', (area.x0 + area.x1) / 2, area.y1 + 3);
  ctx.textAlign = 'left';
  ctx.fillText('-4', area.x0, area.y1 + 3);
  ctx.textAlign = 'center';
  ctx.fillText('0', (area.x0 + area.x1) / 2 + 12, area.y1 + 3);
  ctx.textAlign = 'right';
  ctx.fillText('+4', area.x1, area.y1 + 3);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('+π', area.x0 - 2, area.y0 + 4);
  ctx.fillText('0', area.x0 - 2, yZero);
  ctx.fillText('-π', area.x0 - 2, area.y1 - 4);
  ctx.save();
  ctx.translate(8, (area.y0 + area.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('φ', 0, 0);
  ctx.restore();
}

function _drawHeatmap() {
  const ctx = _ctx;
  const area = _plotArea();
  const { grid, min, max } = _buildBins();
  if (max <= 0) return;
  const logMin = Math.log10(Math.max(min, 1e-3));
  const logMax = Math.log10(Math.max(max, logMin + 1e-3));
  const denom = Math.max(1e-6, logMax - logMin);

  const plotW = area.x1 - area.x0;
  const plotH = area.y1 - area.y0;

  const xEdges = new Int16Array(NBINS_ETA + 1);
  for (let i = 0; i <= NBINS_ETA; i++)
    xEdges[i] = Math.round(area.x0 + (i * plotW) / NBINS_ETA);
  const yEdges = new Int16Array(NBINS_PHI + 1);
  for (let i = 0; i <= NBINS_PHI; i++)
    yEdges[i] = Math.round(area.y0 + (i * plotH) / NBINS_PHI);

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x0, area.y0, plotW, plotH);
  ctx.clip();

  for (let iy = 0; iy < NBINS_PHI; iy++) {
    for (let ix = 0; ix < NBINS_ETA; ix++) {
      const v = grid[iy * NBINS_ETA + ix];
      if (v <= 0) continue;
      const t = (Math.log10(v) - logMin) / denom;
      const x = xEdges[ix];
      const xn = xEdges[ix + 1];
      const y = yEdges[NBINS_PHI - 1 - iy];
      const yn = yEdges[NBINS_PHI - iy];
      ctx.fillStyle = _ramp(t);
      ctx.fillRect(x, y, xn - x, yn - y);
    }
  }
  ctx.restore();
}

function _drawLegend() {
  const ctx = _ctx;
  const area = _plotArea();
  const { min, max } = _buildBins();

  const xL = area.x1 + LEGEND_GAP;
  const yTop = area.y0 + 4;
  const yBot = area.y1 - 4;
  const barH = yBot - yTop;

  for (let i = 0; i <= barH; i++) {
    const t = 1 - i / barH;
    ctx.fillStyle = _ramp(t);
    ctx.fillRect(xL, yTop + i, LEGEND_W, 1);
  }
  ctx.strokeStyle = 'rgba(120, 150, 190, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(xL + 0.5, yTop + 0.5, LEGEND_W, barH);

  ctx.fillStyle = 'rgba(190, 210, 235, 0.9)';
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'left';
  if (max > 0) {
    ctx.textBaseline = 'top';
    ctx.fillText(_fmtEnergy(max), xL + LEGEND_W + 3, yTop - 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(_fmtEnergy(min), xL + LEGEND_W + 3, yBot + 2);
  } else {
    ctx.textBaseline = 'middle';
    ctx.fillText('no data', xL + LEGEND_W + 3, (yTop + yBot) / 2);
  }
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  ctx.fillText('E', xL + LEGEND_W / 2, yTop - 4);
}

function _fmtEnergy(eMev) {
  const eGev = eMev / 1000;
  if (eGev >= 100) return `${eGev.toFixed(0)} GeV`;
  if (eGev >= 10) return `${eGev.toFixed(1)} GeV`;
  if (eGev >= 1) return `${eGev.toFixed(2)} GeV`;
  if (eGev >= 0.1) return `${eGev.toFixed(2)} GeV`;
  if (eGev >= 0.01) return `${(eGev * 1000).toFixed(0)} MeV`;
  return `${(eGev * 1000).toFixed(1)} MeV`;
}

// Draws all active rectangles. No per-rect label — with multiple rects the
// individual range labels become cluttered and misleading (overlapping rects
// share a union, not their individual bounds).
function _drawRects() {
  if (!_rects.length) return;
  const ctx = _ctx;
  const area = _plotArea();
  for (const rect of _rects) {
    const x0 = _etaToX(rect.etaMin, area);
    const x1 = _etaToX(rect.etaMax, area);
    const yA = _phiToY(rect.phiMax, area);
    const yB = _phiToY(rect.phiMin, area);
    const x = Math.min(x0, x1);
    const y = Math.min(yA, yB);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(yB - yA);

    // Vivid fill.
    ctx.fillStyle = 'rgba(255, 60, 200, 0.22)';
    ctx.fillRect(x, y, w, h);

    // Glowing border: thick dark halo first, then a bright magenta stroke on
    // top, then a thin white highlight. The three-layer approach ensures the
    // rect stays legible against every part of the heat ramp.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);

    ctx.save();
    ctx.shadowColor = 'rgba(255, 80, 220, 0.85)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(255, 80, 220, 1)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }
}

function _redraw() {
  if (!_ctx || !_enabled) return;
  _drawFrame();
  _drawHeatmap();
  _drawAxes();
  _drawLegend();
  _drawRects();
}

// ── Region API ──────────────────────────────────────────────────────────────
let _regionRafQueued = false;
function _notifyRegion() {
  if (!_regionListener || _regionRafQueued) return;
  _regionRafQueued = true;
  requestAnimationFrame(() => {
    _regionRafQueued = false;
    if (_regionListener) _regionListener(_rects.length > 0 ? [..._rects] : null);
  });
}

function _pointInRect(eta, phi, r) {
  return eta >= r.etaMin && eta <= r.etaMax && phi >= r.phiMin && phi <= r.phiMax;
}

// Returns the index of the topmost rect containing (eta, phi), or -1.
function _hitRectAt(eta, phi) {
  for (let i = _rects.length - 1; i >= 0; i--) {
    if (_pointInRect(eta, phi, _rects[i])) return i;
  }
  return -1;
}

// ── Mouse handling ──────────────────────────────────────────────────────────
function _updateCursor(insidePlot, eta, phi) {
  if (!_canvas) return;
  if (_mouseState === 'panning') {
    _canvas.style.cursor = 'grabbing';
    return;
  }
  if (_mouseState === 'drawing' || _mouseState === 'maybe-draw') {
    _canvas.style.cursor = 'crosshair';
    return;
  }
  if (!insidePlot) {
    _canvas.style.cursor = 'default';
    return;
  }
  if (_hitRectAt(eta, phi) >= 0) _canvas.style.cursor = 'grab';
  else _canvas.style.cursor = 'crosshair';
}

function _onMouseDown(ev) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  const { x, y } = _clientToCanvas(ev);
  const area = _plotArea();
  if (x < area.x0 || x > area.x1 || y < area.y0 || y > area.y1) return;
  const eta = _xToEta(x, area);
  const phi = _yToPhi(y, area);

  const hitIdx = _hitRectAt(eta, phi);
  if (hitIdx >= 0) {
    _mouseState = 'maybe-pan';
    _activeRectIdx = hitIdx;
    const r = _rects[hitIdx];
    const cx = (r.etaMin + r.etaMax) / 2;
    const cy = (r.phiMin + r.phiMax) / 2;
    _dragAnchor = { dEta: eta - cx, dPhi: phi - cy, x, y };
  } else {
    _mouseState = 'maybe-draw';
    _dragAnchor = { eta, phi, x, y };
  }
  _updateCursor(true, eta, phi);
  window.addEventListener('mousemove', _onMouseMove);
  window.addEventListener('mouseup', _onMouseUp);
}

function _onMouseMove(ev) {
  if (_mouseState === 'idle') return;
  const { x, y } = _clientToCanvas(ev);
  const area = _plotArea();
  const cx = Math.max(area.x0, Math.min(area.x1, x));
  const cy = Math.max(area.y0, Math.min(area.y1, y));
  const eta = _xToEta(cx, area);
  const phi = _yToPhi(cy, area);

  if (_mouseState === 'maybe-draw') {
    const ddx = x - _dragAnchor.x;
    const ddy = y - _dragAnchor.y;
    if (Math.hypot(ddx, ddy) >= DRAG_THRESHOLD_PX) {
      _mouseState = 'drawing';
      _rects.push(_normalizeRect({
        etaMin: _dragAnchor.eta, etaMax: eta,
        phiMin: _dragAnchor.phi, phiMax: phi,
      }));
      _notifyRegion();
      _redraw();
    }
    return;
  }

  if (_mouseState === 'drawing') {
    _rects[_rects.length - 1] = _normalizeRect({
      etaMin: _dragAnchor.eta, etaMax: eta,
      phiMin: _dragAnchor.phi, phiMax: phi,
    });
    _notifyRegion();
    _redraw();
    return;
  }

  // maybe-pan: check drag threshold, then fall through to panning
  if (_mouseState === 'maybe-pan') {
    const ddx = x - _dragAnchor.x;
    const ddy = y - _dragAnchor.y;
    if (Math.hypot(ddx, ddy) >= DRAG_THRESHOLD_PX) {
      _mouseState = 'panning';
      _canvas.style.cursor = 'grabbing';
    }
  }

  if (_mouseState === 'panning') {
    const r = _rects[_activeRectIdx];
    const halfE = (r.etaMax - r.etaMin) / 2;
    const halfP = (r.phiMax - r.phiMin) / 2;
    const ncx = eta - _dragAnchor.dEta;
    const ncy = phi - _dragAnchor.dPhi;
    const cE = Math.max(ETA_MIN + halfE, Math.min(ETA_MAX - halfE, ncx));
    const cP = Math.max(PHI_MIN + halfP, Math.min(PHI_MAX - halfP, ncy));
    _rects[_activeRectIdx] = {
      etaMin: cE - halfE, etaMax: cE + halfE,
      phiMin: cP - halfP, phiMax: cP + halfP,
    };
    _notifyRegion();
    _redraw();
  }
}

function _onMouseUp(ev) {
  if (ev.button !== 0) return;
  window.removeEventListener('mousemove', _onMouseMove);
  window.removeEventListener('mouseup', _onMouseUp);

  if (_mouseState === 'maybe-pan') {
    // Click (no drag) on a rect → delete it.
    _rects.splice(_activeRectIdx, 1);
    _notifyRegion();
    _redraw();
  } else if (_mouseState === 'drawing') {
    // Discard if too small (accidental micro-drag).
    const r = _rects[_rects.length - 1];
    if (r.etaMax - r.etaMin < MIN_RECT_ETA || r.phiMax - r.phiMin < MIN_RECT_PHI) {
      _rects.pop();
      _notifyRegion();
      _redraw();
    }
  }
  // 'maybe-draw' (click on empty space) → no-op, no rect added.

  _mouseState = 'idle';
  _dragAnchor = null;
  _activeRectIdx = -1;
  if (_canvas) _canvas.style.cursor = '';
}

function _onMouseMoveHover(ev) {
  if (_mouseState !== 'idle') return;
  const { x, y } = _clientToCanvas(ev);
  const area = _plotArea();
  const insidePlot = x >= area.x0 && x <= area.x1 && y >= area.y0 && y <= area.y1;
  if (!insidePlot) {
    _canvas.style.cursor = 'default';
    return;
  }
  _updateCursor(true, _xToEta(x, area), _yToPhi(y, area));
}

// ── Public API ──────────────────────────────────────────────────────────────
export function initMinimap() {
  if (_canvas) return { redraw: _redraw };
  _canvas = document.createElement('canvas');
  _canvas.id = 'minimap';
  _canvas.setAttribute('aria-label', 'η × φ energy heatmap');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  _canvas.width = W * dpr;
  _canvas.height = H * dpr;
  _canvas.style.width = W + 'px';
  _canvas.style.height = H + 'px';
  _ctx = _canvas.getContext('2d');
  _ctx.scale(dpr, dpr);
  _canvas.addEventListener('mousedown', _onMouseDown);
  _canvas.addEventListener('mousemove', _onMouseMoveHover);
  _canvas.addEventListener('mouseleave', () => {
    if (_mouseState === 'idle') _canvas.style.cursor = '';
  });
  _canvas.style.display = 'none';
  document.body.appendChild(_canvas);
  _redraw();
  return { redraw: _redraw };
}

/**
 * @param {{ cells?: any[], fcal?: any[] }} data
 */
export function updateMinimap({ cells, fcal }) {
  let binsDirty = false;
  if (cells !== undefined) {
    _cellEntries = cells;
    binsDirty = true;
  }
  if (fcal !== undefined) {
    _fcalEntries = fcal;
    binsDirty = true;
  }
  if (binsDirty) _binCache = null;
  _redraw();
}

export function setMinimapVisible(visible) {
  _enabled = !!visible;
  if (_canvas) _canvas.style.display = _enabled ? '' : 'none';
  if (_enabled) {
    _redraw();
  }
  // Hiding drops all rectangle filters so the 3D scene is no longer gated.
  if (!_enabled && _rects.length > 0) {
    _rects = [];
    _notifyRegion();
  }
}

export function isMinimapVisible() {
  return _enabled;
}

/**
 * Returns the active rectangles (array), or null when none are set or the
 * minimap is hidden.
 * @returns {Array<{etaMin:number, etaMax:number, phiMin:number, phiMax:number}> | null}
 */
export function getMinimapRegion() {
  if (!_enabled || !_rects.length) return null;
  return [..._rects];
}

/**
 * @param {(regions: any) => void} cb
 */
export function setMinimapRegionListener(cb) {
  _regionListener = typeof cb === 'function' ? cb : null;
}
