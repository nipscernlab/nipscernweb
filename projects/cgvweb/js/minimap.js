// ── η × φ energy-heatmap minimap ─────────────────────────────────────────────
// 2D canvas in the top-left (over the collision-info HUD slot when enabled) that
// shows total deposited energy binned by (η, φ). A user-drawn rectangle gates
// the 3D scene to only the cells inside that η×φ window — drag the rectangle
// to scan; it doesn't zoom, only filters visibility. Critical at view level 1.

const ETA_MIN = -4.9;
const ETA_MAX = 4.9;
const PHI_MIN = -Math.PI;
const PHI_MAX = Math.PI;

// Bin size for the energy heatmap. Δη=Δφ≈0.2 strikes a balance between cell
// detail and visual smoothness (~49 × 32 bins across the full range).
const BIN_ETA = 0.2;
const BIN_PHI = 0.2;
const NBINS_ETA = Math.ceil((ETA_MAX - ETA_MIN) / BIN_ETA);
const NBINS_PHI = Math.ceil((PHI_MAX - PHI_MIN) / BIN_PHI);

// Logical (CSS) pixel size. Bumped vs. the old point-plot minimap because the
// heatmap reads better with larger bin tiles. Backing store is dpr-scaled.
const W = 280;
const H = 180;

const INSET_L = 24;
const INSET_R = 8;
const INSET_T = 8;
const INSET_B = 16;

// Heat ramp: dark navy (zero) → blue → cyan → yellow → orange-red (peak).
const RAMP = [
  [10, 14, 34],
  [30, 60, 170],
  [40, 180, 200],
  [230, 220, 80],
  [255, 90, 30],
];

let _canvas = null;
let _ctx = null;
let _enabled = false;
let _active = null;
let _fcalCells = null;
let _clusters = null;

// η×φ rectangle the user drew. Stored in physical (η, φ) coordinates so it
// survives canvas resizes and is directly comparable to cell.eta/cell.phi.
// Layout: { etaMin, etaMax, phiMin, phiMax } | null.
let _rect = null;

// Mouse interaction state.
//   'idle'    — no gesture in progress
//   'drawing' — left-button held, sweeping a new rectangle from _dragAnchor
//   'panning' — left-button held inside an existing rectangle, translating it
let _mouseState = 'idle';
let _dragAnchor = null; // {eta, phi} for 'drawing'; {dEta, dPhi} for 'panning'
let _docMouseDownBound = false;

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

// ── Energy binning ──────────────────────────────────────────────────────────
// Combine TILE/LAR/HEC/MBTS (from `active` Map) and FCAL (separate list) into a
// single (η, φ) grid. Energies are normalised to MeV before accumulation.
function _buildBins() {
  const grid = new Float32Array(NBINS_ETA * NBINS_PHI);
  let max = 0;
  const add = (eta, phi, eMev) => {
    if (!Number.isFinite(eta) || !Number.isFinite(phi)) return;
    if (eta < ETA_MIN || eta > ETA_MAX) return;
    const ix = Math.min(NBINS_ETA - 1, Math.max(0, Math.floor((eta - ETA_MIN) / BIN_ETA)));
    const iy = Math.min(NBINS_PHI - 1, Math.max(0, Math.floor((phi - PHI_MIN) / BIN_PHI)));
    const k = iy * NBINS_ETA + ix;
    grid[k] += eMev;
    if (grid[k] > max) max = grid[k];
  };
  if (_active) {
    for (const e of _active.values()) {
      if (!e) continue;
      add(e.eta, e.phi, Math.abs(e.energyMev || 0));
    }
  }
  if (_fcalCells) {
    for (const c of _fcalCells) {
      // FCAL records from the WASM parser carry (x, y, z) in JiveXML cm, not
      // eta/phi — derive on the fly for the heatmap. Same flip convention the
      // 3D renderer uses (fcalRenderer.js: cx=-x*10, cy=-y*10, cz=z*10).
      let eta = c.eta;
      let phi = c.phi;
      if (!Number.isFinite(eta) || !Number.isFinite(phi)) {
        const r = Math.hypot(c.x, c.y);
        const theta = Math.atan2(r, c.z);
        eta = -Math.log(Math.tan(theta / 2));
        phi = Math.atan2(-c.y, -c.x);
      }
      // FCAL `energy` is in GeV.
      add(eta, phi, Math.abs((c.energy || 0) * 1000));
    }
  }
  return { grid, max };
}

// ── Drawing ─────────────────────────────────────────────────────────────────
function _drawFrame() {
  const ctx = _ctx;
  const area = _plotArea();
  ctx.clearRect(0, 0, W, H);

  // Background panel.
  ctx.fillStyle = 'rgba(8, 14, 28, 0.82)';
  ctx.fillRect(0, 0, W, H);

  // Plot frame.
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
  ctx.fillText('η', (area.x0 + area.x1) / 2, area.y1 + 2);
  ctx.textAlign = 'left';
  ctx.fillText('-4', area.x0, area.y1 + 2);
  ctx.textAlign = 'center';
  ctx.fillText('0', (area.x0 + area.x1) / 2 + 12, area.y1 + 2);
  ctx.textAlign = 'right';
  ctx.fillText('+4', area.x1, area.y1 + 2);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('+π', area.x0 - 2, area.y0 + 4);
  ctx.fillText('0', area.x0 - 2, yZero);
  ctx.fillText('-π', area.x0 - 2, area.y1 - 4);
  ctx.save();
  ctx.translate(7, (area.y0 + area.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('φ', 0, 0);
  ctx.restore();
}

function _drawHeatmap() {
  const ctx = _ctx;
  const area = _plotArea();
  const { grid, max } = _buildBins();
  if (max <= 0) return;
  // Log scale so a few hot bins don't wash out the rest. log1p(grid)/log1p(max).
  const denom = Math.log1p(max);
  if (denom <= 0) return;

  const cellW = (area.x1 - area.x0) / NBINS_ETA;
  const cellH = (area.y1 - area.y0) / NBINS_PHI;

  // Clip to the plot area so the tiles can't bleed into the axis margins.
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x0, area.y0, area.x1 - area.x0, area.y1 - area.y0);
  ctx.clip();

  for (let iy = 0; iy < NBINS_PHI; iy++) {
    for (let ix = 0; ix < NBINS_ETA; ix++) {
      const v = grid[iy * NBINS_ETA + ix];
      if (v <= 0) continue;
      const t = Math.log1p(v) / denom;
      // φ axis is flipped (positive phi at top), so iy=0 corresponds to the
      // bottom row in canvas-space.
      const x = area.x0 + ix * cellW;
      const y = area.y1 - (iy + 1) * cellH;
      ctx.fillStyle = _ramp(t);
      ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
    }
  }
  ctx.restore();
}

function _drawClusters() {
  if (!_clusters || !_clusters.length) return;
  const ctx = _ctx;
  const area = _plotArea();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1;
  for (const c of _clusters) {
    if (!Number.isFinite(c.eta) || !Number.isFinite(c.phi)) continue;
    if (c.eta < ETA_MIN || c.eta > ETA_MAX) continue;
    const x = _etaToX(c.eta, area);
    const y = _phiToY(c.phi, area);
    const r = 2.5 + 0.35 * Math.log10(Math.max(1, c.etGev || 1));
    ctx.beginPath();
    ctx.arc(x, y, Math.min(5, r), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function _drawRect() {
  if (!_rect) return;
  const ctx = _ctx;
  const area = _plotArea();
  const x0 = _etaToX(_rect.etaMin, area);
  const x1 = _etaToX(_rect.etaMax, area);
  const yA = _phiToY(_rect.phiMax, area);
  const yB = _phiToY(_rect.phiMin, area);
  const x = Math.min(x0, x1);
  const y = Math.min(yA, yB);
  const w = Math.abs(x1 - x0);
  const h = Math.abs(yB - yA);

  // High-contrast magenta — contrasts with every colour in the heat ramp
  // (navy / blue / cyan / yellow / orange-red). A dark outline behind the
  // stroke keeps it readable against the bright yellow/orange peaks too.
  ctx.fillStyle = 'rgba(255, 60, 200, 0.15)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.strokeStyle = 'rgba(255, 80, 220, 1)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);

  // Range label with a dark pill behind it for legibility over hot bins.
  ctx.font = '9px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const label = `η:${_rect.etaMin.toFixed(1)}…${_rect.etaMax.toFixed(1)}  φ:${_rect.phiMin.toFixed(1)}…${_rect.phiMax.toFixed(1)}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(x + 2, y + 2, tw + 6, 12);
  ctx.fillStyle = 'rgba(255, 200, 240, 1)';
  ctx.fillText(label, x + 5, y + 4);
}

function _redraw() {
  if (!_ctx || !_enabled) return;
  _drawFrame();
  _drawHeatmap();
  _drawAxes();
  _drawClusters();
  _drawRect();
}

// ── Region API ──────────────────────────────────────────────────────────────
// Coalesce notifications to one per animation frame — refreshSceneVisibility
// iterates every active cell, and mouse drags can easily fire >60 Hz.
let _regionRafQueued = false;
function _notifyRegion() {
  if (!_regionListener || _regionRafQueued) return;
  _regionRafQueued = true;
  requestAnimationFrame(() => {
    _regionRafQueued = false;
    if (_regionListener) _regionListener(_rect ? { ..._rect } : null);
  });
}

function _setRect(r) {
  // Normalise so etaMin ≤ etaMax and phiMin ≤ phiMax.
  if (r) {
    const etaMin = Math.min(r.etaMin, r.etaMax);
    const etaMax = Math.max(r.etaMin, r.etaMax);
    const phiMin = Math.min(r.phiMin, r.phiMax);
    const phiMax = Math.max(r.phiMin, r.phiMax);
    _rect = { etaMin, etaMax, phiMin, phiMax };
  } else {
    _rect = null;
  }
  _redraw();
  _notifyRegion();
}

function _pointInRect(eta, phi, r) {
  return eta >= r.etaMin && eta <= r.etaMax && phi >= r.phiMin && phi <= r.phiMax;
}

// ── Mouse handling ──────────────────────────────────────────────────────────
function _updateCursor(eta, phi) {
  if (!_canvas) return;
  if (_mouseState === 'panning') _canvas.style.cursor = 'grabbing';
  else if (_mouseState === 'drawing') _canvas.style.cursor = 'crosshair';
  else if (_rect && _pointInRect(eta, phi, _rect)) _canvas.style.cursor = 'grab';
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

  if (_rect && _pointInRect(eta, phi, _rect)) {
    _mouseState = 'panning';
    const cx = (_rect.etaMin + _rect.etaMax) / 2;
    const cy = (_rect.phiMin + _rect.phiMax) / 2;
    _dragAnchor = { dEta: eta - cx, dPhi: phi - cy };
  } else {
    _mouseState = 'drawing';
    _dragAnchor = { eta, phi };
    // Seed a zero-size rect so the visual feedback starts immediately.
    _setRect({ etaMin: eta, etaMax: eta, phiMin: phi, phiMax: phi });
  }
  _updateCursor(eta, phi);
  window.addEventListener('mousemove', _onMouseMove);
  window.addEventListener('mouseup', _onMouseUp);
}

function _onMouseMove(ev) {
  if (_mouseState === 'idle') return;
  const { x, y } = _clientToCanvas(ev);
  const area = _plotArea();
  // Clamp to plot bounds so dragging off-canvas still works smoothly.
  const cx = Math.max(area.x0, Math.min(area.x1, x));
  const cy = Math.max(area.y0, Math.min(area.y1, y));
  const eta = _xToEta(cx, area);
  const phi = _yToPhi(cy, area);

  if (_mouseState === 'drawing' && _dragAnchor) {
    _setRect({
      etaMin: _dragAnchor.eta,
      etaMax: eta,
      phiMin: _dragAnchor.phi,
      phiMax: phi,
    });
  } else if (_mouseState === 'panning' && _dragAnchor && _rect) {
    const halfE = (_rect.etaMax - _rect.etaMin) / 2;
    const halfP = (_rect.phiMax - _rect.phiMin) / 2;
    const ncx = eta - _dragAnchor.dEta;
    const ncy = phi - _dragAnchor.dPhi;
    // Clamp so the rect never leaves the plot range.
    const cE = Math.max(ETA_MIN + halfE, Math.min(ETA_MAX - halfE, ncx));
    const cP = Math.max(PHI_MIN + halfP, Math.min(PHI_MAX - halfP, ncy));
    _setRect({
      etaMin: cE - halfE,
      etaMax: cE + halfE,
      phiMin: cP - halfP,
      phiMax: cP + halfP,
    });
  }
  _updateCursor(eta, phi);
}

function _onMouseUp(ev) {
  if (ev.button !== 0) return;
  window.removeEventListener('mousemove', _onMouseMove);
  window.removeEventListener('mouseup', _onMouseUp);
  if (_mouseState === 'drawing' && _rect) {
    // Discard accidental click (no drag): rect too thin in either axis.
    if (_rect.etaMax - _rect.etaMin < 0.05 || _rect.phiMax - _rect.phiMin < 0.05) {
      _setRect(null);
    }
  }
  _mouseState = 'idle';
  if (_canvas) _canvas.style.cursor = '';
}

function _onMouseMoveHover(ev) {
  if (_mouseState !== 'idle') return;
  const { x, y } = _clientToCanvas(ev);
  const area = _plotArea();
  if (x < area.x0 || x > area.x1 || y < area.y0 || y > area.y1) {
    _canvas.style.cursor = '';
    return;
  }
  const eta = _xToEta(x, area);
  const phi = _yToPhi(y, area);
  _updateCursor(eta, phi);
}

// Click anywhere outside the minimap clears the rectangle. We attach in the
// capture phase so the canvas mousedown can stop propagation without us
// needing a separate flag.
function _onDocMouseDown(ev) {
  if (!_enabled || !_rect) return;
  if (_canvas && _canvas.contains(ev.target)) return;
  _setRect(null);
}

// ── Public API ──────────────────────────────────────────────────────────────
/**
 * Create the canvas and attach to body. Idempotent.
 */
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
  // Hidden until the user toggles it on. The toggle wiring lives in
  // sidebarControls.js → main.js (onToggleMinimap).
  _canvas.style.display = 'none';
  document.body.appendChild(_canvas);
  if (!_docMouseDownBound) {
    document.addEventListener('mousedown', _onDocMouseDown, true);
    _docMouseDownBound = true;
  }
  _redraw();
  return { redraw: _redraw };
}

/**
 * Refresh data shown in the heatmap.
 * @param {{ active: Map<any, any>, fcalCells?: any[], clusters?: any[] }} data
 */
export function updateMinimap({ active, fcalCells, clusters }) {
  _active = active || null;
  _fcalCells = fcalCells || null;
  _clusters = clusters || null;
  _redraw();
}

export function setMinimapVisible(visible) {
  _enabled = !!visible;
  if (_canvas) _canvas.style.display = _enabled ? '' : 'none';
  if (_enabled) {
    _redraw();
  }
  // Hiding the minimap drops the η/φ filter — listeners need to refresh.
  if (!_enabled && _rect) {
    _rect = null;
    _notifyRegion();
  }
}

export function isMinimapVisible() {
  return _enabled;
}

/** @returns {{etaMin:number, etaMax:number, phiMin:number, phiMax:number} | null} */
export function getMinimapRegion() {
  if (!_enabled) return null;
  return _rect ? { ..._rect } : null;
}

/**
 * Subscribe to rectangle changes. Callback receives the same shape as
 * getMinimapRegion(), or null when the rect is cleared. Single-listener API
 * — keeps the wiring simple; we only need one consumer (the visibility
 * pipeline) for now.
 * @param {(region: any) => void} cb
 */
export function setMinimapRegionListener(cb) {
  _regionListener = typeof cb === 'function' ? cb : null;
}
