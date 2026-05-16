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
//
// φ seam slider (left pane):
//   • drag up/down → rotate where the cylinder cut falls on the φ axis
//   • clusters split across the ±π seam can be centred by sliding the seam away
//   • dbl-click → reset seam to default (−π)
//
// Zoom (data viewport — no CSS widget resize):
//   • scroll wheel over minimap → zoom in/out centred on scroll position
//   • +/=/- keys while minimap hovered → zoom in/out
//   • 0 key → reset zoom

const ETA_MIN = -4.9;
const ETA_MAX = 4.9;
const PHI_MIN = -Math.PI;
const PHI_MAX = Math.PI;
const TWO_PI  = PHI_MAX - PHI_MIN;   // 2π

const BIN_ETA = 0.1;
const BIN_PHI = 0.1;
const NBINS_ETA = Math.ceil((ETA_MAX - ETA_MIN) / BIN_ETA);
const NBINS_PHI = Math.ceil((PHI_MAX - PHI_MIN) / BIN_PHI);

const W = 342;
const H = 220;

const INSET_L = 26;
const INSET_R = 20;
const INSET_T = 10;
const INSET_B = 20;
// Margin between plot edge and legend/slider bar top/bottom edges.
// Legend bar and seam slider are both sized to match: H-INSET_T-INSET_B-2*M = 182 px.
const LEGEND_BAR_M = 4;

const LEGEND_W = 10;
const LEGEND_GAP = 6;

// Vivid physics-style heat ramp: near-black → deep blue → bright cyan →
// pure yellow → pure red.
const RAMP = [
  [8, 8, 20],
  [10, 30, 210],
  [0, 215, 255],
  [255, 245, 0],
  [255, 20, 0],
];

let _canvas  = null;
let _ctx     = null;
let _enabled = false;
let _wrapEl  = null;

/** @type {Array<{eta:number, phi:number, energyMev:number}>} */
let _cellEntries = [];
/** @type {Array<{eta:number, phi:number, energyMev:number}>} */
let _fcalEntries = [];

let _binCache = null;

// Array of active η×φ rectangles.
/** @type {Array<{etaMin:number, etaMax:number, phiMin:number, phiMax:number}>} */
let _rects = [];

// Mouse / pointer state machine.
let _mouseState     = 'idle';
let _dragAnchor     = null;
let _activeRectIdx  = -1;
let _activePointerId = -1;
const DRAG_THRESHOLD_PX = 3;
const MIN_RECT_ETA = 0.05;
const MIN_RECT_PHI = 0.05;

let _regionListener = null;

// ── φ seam (cylinder-cut) state ─────────────────────────────────────────────
let _phiSeam      = PHI_MIN;
let _seamTrackEl  = null;
let _seamThumbEl  = null;
let _seamLblEl    = null;
let _seamDragging = false;

// ── Zoom state ───────────────────────────────────────────────────────────────
// Zoom acts on the canvas DATA viewport (η × display-φ), not the CSS widget.
// Center is set at scroll time and stays fixed until the next scroll.
let _zoomFactor    = 1.0;
let _zoomEtaCenter = 0.5;   // fraction [0,1] of full η range
let _zoomPhiCenter = 0.5;   // fraction [0,1] of full display-φ range

// ── Coordinate helpers ──────────────────────────────────────────────────────
function _plotArea() {
  return { x0: INSET_L, y0: INSET_T, x1: W - INSET_R, y1: H - INSET_B };
}

function _viewEtaFrac() {
  const half = 0.5 / _zoomFactor;
  const lo = Math.max(0, Math.min(1 - 2 * half, _zoomEtaCenter - half));
  return [lo, lo + 2 * half];
}
function _viewPhiFrac() {
  const half = 0.5 / _zoomFactor;
  const lo = Math.max(0, Math.min(1 - 2 * half, _zoomPhiCenter - half));
  return [lo, lo + 2 * half];
}

// Pin zoom center to where the mouse is right now (called at scroll time only).
function _updateZoomCenter(canvasX, canvasY) {
  const area = _plotArea();
  const [etaLo, etaHi] = _viewEtaFrac();
  const [phiLo, phiHi] = _viewPhiFrac();
  const fx = (canvasX - area.x0) / (area.x1 - area.x0);
  const fy = (area.y1 - canvasY) / (area.y1 - area.y0);
  _zoomEtaCenter = Math.max(0, Math.min(1, etaLo + fx * (etaHi - etaLo)));
  _zoomPhiCenter = Math.max(0, Math.min(1, phiLo + fy * (phiHi - phiLo)));
}

function _etaToX(eta, area) {
  const [lo, hi] = _viewEtaFrac();
  const frac = (eta - ETA_MIN) / (ETA_MAX - ETA_MIN);
  const t    = (frac - lo) / (hi - lo);
  return area.x0 + t * (area.x1 - area.x0);
}
// Maps φ → canvas Y, respecting seam + zoom.
function _phiToY(phi, area) {
  const disp = ((phi - _phiSeam) % TWO_PI + TWO_PI) % TWO_PI;
  const frac = disp / TWO_PI;
  const [lo, hi] = _viewPhiFrac();
  const t = (frac - lo) / (hi - lo);
  return area.y1 - t * (area.y1 - area.y0);
}
function _xToEta(x, area) {
  const [lo, hi] = _viewEtaFrac();
  const t    = (x - area.x0) / (area.x1 - area.x0);
  const frac = lo + t * (hi - lo);
  return ETA_MIN + frac * (ETA_MAX - ETA_MIN);
}
// Inverse of _phiToY — wraps result to [−π, +π].
function _yToPhi(y, area) {
  const [lo, hi] = _viewPhiFrac();
  const t    = (area.y1 - y) / (area.y1 - area.y0);
  const frac = lo + t * (hi - lo);
  const phi  = _phiSeam + frac * TWO_PI;
  return ((phi + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
}
// φ at canvas Y as a CONTINUOUS value (NO ±π wrap). Used while drawing a rect
// so the swept φ-arc stays contiguous even when the seam puts ±π mid-plot —
// min/max of two continuous endpoints is always the exact arc, never the
// complement. Y is clamped 1 px below the top so the arc never reaches a full
// 2π (which would alias to a zero-width display row).
function _yToPhiCont(y, area) {
  const cy   = Math.max(area.y0 + 1, Math.min(area.y1, y));
  const [lo, hi] = _viewPhiFrac();
  const t    = (area.y1 - cy) / (area.y1 - area.y0);
  const frac = lo + t * (hi - lo);
  return _phiSeam + frac * TWO_PI;
}
// Map a pointer event to internal canvas coords (W×H), independent of any CSS
// scaling on #minimap-wrap (mobile shrinks the widget via transform: scale()).
function _clientToCanvas(ev) {
  const r = _canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) * (W / r.width),
    y: (ev.clientY - r.top)  * (H / r.height),
  };
}

function _ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const seg = t * (RAMP.length - 1);
  const i   = Math.min(RAMP.length - 2, Math.floor(seg));
  const f   = seg - i;
  const a   = RAMP[i];
  const b   = RAMP[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

// Formats a φ value (radians) as a compact π-fraction string.
function _phiLabel(phi) {
  phi = ((phi + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  if (Math.abs(phi) < 0.02)                         return '0';
  if (Math.abs(Math.abs(phi) - Math.PI) < 0.02)     return phi > 0 ? '+π' : '-π';
  if (Math.abs(Math.abs(phi) - Math.PI / 2) < 0.02) return phi > 0 ? '+π/2' : '-π/2';
  const sign = phi > 0 ? '+' : '-';
  return sign + (Math.abs(phi) / Math.PI).toFixed(2) + 'π';
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
  // Transparent — CSS backdrop-filter blur on #minimap-wrap shows through.
  ctx.clearRect(0, 0, W, H);
  const area = _plotArea();
  ctx.strokeStyle = 'rgba(120, 150, 190, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(area.x0 + 0.5, area.y0 + 0.5, area.x1 - area.x0, area.y1 - area.y0);
}

function _drawAxes() {
  const ctx  = _ctx;
  const area = _plotArea();

  // Vertical η grid lines
  ctx.strokeStyle = 'rgba(150, 180, 220, 0.18)';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  for (const eta of [-3.2, -1.5, 0, 1.5, 3.2]) {
    const x = _etaToX(eta, area);
    if (x < area.x0 || x > area.x1) continue;
    ctx.beginPath();
    ctx.moveTo(x, area.y0);
    ctx.lineTo(x, area.y1);
    ctx.stroke();
  }

  // Horizontal φ reference lines — skip those too close to the seam edges.
  const EDGE_PX  = 5;
  const phiRefs  = [Math.PI / 2, 0, -Math.PI / 2, -Math.PI];
  const phiRefLb = ['+π/2', '0', '-π/2', '-π'];
  for (const phi of phiRefs) {
    const y = _phiToY(phi, area);
    if (y <= area.y0 + EDGE_PX || y >= area.y1 - EDGE_PX) continue;
    ctx.beginPath();
    ctx.moveTo(area.x0, y);
    ctx.lineTo(area.x1, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── Labels ────────────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(170, 195, 225, 0.78)';
  ctx.font      = '9px ui-monospace, monospace';

  // η axis labels (bottom) — reflect the zoomed η range
  const [etaVlo, etaVhi] = _viewEtaFrac();
  const viewEtaMin = ETA_MIN + etaVlo * (ETA_MAX - ETA_MIN);
  const viewEtaMax = ETA_MIN + etaVhi * (ETA_MAX - ETA_MIN);
  const viewEtaMid = (viewEtaMin + viewEtaMax) / 2;
  const fmtEta = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'center';
  ctx.fillText('η', (area.x0 + area.x1) / 2, area.y1 + 3);
  ctx.textAlign = 'left';
  ctx.fillText(fmtEta(viewEtaMin), area.x0, area.y1 + 3);
  ctx.textAlign = 'center';
  ctx.fillText(fmtEta(viewEtaMid), (area.x0 + area.x1) / 2 + 12, area.y1 + 3);
  ctx.textAlign = 'right';
  ctx.fillText(fmtEta(viewEtaMax), area.x1, area.y1 + 3);

  // φ notable-value labels (left side, interior)
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'right';
  for (let i = 0; i < phiRefs.length; i++) {
    const y = _phiToY(phiRefs[i], area);
    if (y <= area.y0 + EDGE_PX || y >= area.y1 - EDGE_PX) continue;
    ctx.fillText(phiRefLb[i], area.x0 - 2, y);
  }

  // φ axis title (rotated)
  ctx.save();
  ctx.translate(8, (area.y0 + area.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('φ', 0, 0);
  ctx.restore();
}

function _drawHeatmap() {
  const ctx  = _ctx;
  const area = _plotArea();
  const { grid, min, max } = _buildBins();
  if (max <= 0) return;
  const logMin = Math.log10(Math.max(min, 1e-3));
  const logMax = Math.log10(Math.max(max, logMin + 1e-3));
  const denom  = Math.max(1e-6, logMax - logMin);

  const plotW = area.x1 - area.x0;
  const plotH = area.y1 - area.y0;

  // Which φ bin sits at the bottom of the display (the seam)?
  const seamBin =
    ((Math.round((_phiSeam - PHI_MIN) / BIN_PHI) % NBINS_PHI) + NBINS_PHI) % NBINS_PHI;

  // Precompute x edges for all η bins under current zoom
  const [etaLo, etaHi] = _viewEtaFrac();
  const xEdges = new Float32Array(NBINS_ETA + 1);
  for (let i = 0; i <= NBINS_ETA; i++) {
    const frac = i / NBINS_ETA;
    xEdges[i] = area.x0 + ((frac - etaLo) / (etaHi - etaLo)) * plotW;
  }

  // Precompute y edges for all display rows under current zoom
  // displayRow 0 = bottom (seam), NBINS_PHI = top
  const [phiLo, phiHi] = _viewPhiFrac();
  const yEdges = new Float32Array(NBINS_PHI + 1);
  for (let r = 0; r <= NBINS_PHI; r++) {
    const frac = r / NBINS_PHI;
    yEdges[r] = area.y1 - ((frac - phiLo) / (phiHi - phiLo)) * plotH;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x0, area.y0, plotW, plotH);
  ctx.clip();

  for (let iy = 0; iy < NBINS_PHI; iy++) {
    const displayRow = (iy - seamBin + NBINS_PHI) % NBINS_PHI;
    // yEdges[r] = canvas y of bottom of displayRow r, [r+1] = top
    const yBot = yEdges[displayRow];
    const yTop = yEdges[displayRow + 1];
    if (yTop >= area.y1 || yBot <= area.y0) continue;

    const drawY = Math.max(area.y0, yTop);
    const drawH = Math.min(area.y1, yBot) - drawY;
    if (drawH <= 0) continue;

    for (let ix = 0; ix < NBINS_ETA; ix++) {
      const v = grid[iy * NBINS_ETA + ix];
      if (v <= 0) continue;

      const xL = xEdges[ix];
      const xR = xEdges[ix + 1];
      if (xR <= area.x0 || xL >= area.x1) continue;

      const drawX = Math.max(area.x0, xL);
      const drawW = Math.min(area.x1, xR) - drawX;
      if (drawW <= 0) continue;

      const t = (Math.log10(v) - logMin) / denom;
      ctx.fillStyle = _ramp(Math.max(0, Math.min(1, t)));
      ctx.fillRect(drawX, drawY, drawW, drawH);
    }
  }
  ctx.restore();
}

function _drawLegend() {
  const ctx  = _ctx;
  const area = _plotArea();

  const xL   = area.x1 + LEGEND_GAP;
  const yTop = area.y0 + LEGEND_BAR_M;
  const yBot = area.y1 - LEGEND_BAR_M;
  const barH = yBot - yTop;

  for (let i = 0; i <= barH; i++) {
    const t = 1 - i / barH;
    ctx.fillStyle = _ramp(t);
    ctx.fillRect(xL, yTop + i, LEGEND_W, 1);
  }
  ctx.strokeStyle = 'rgba(120, 150, 190, 0.55)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(xL + 0.5, yTop + 0.5, LEGEND_W, barH);
}

// Draw one rectangular band with pink fill + magenta glow stroke (inward).
// Outer perimeter of the border is the gate boundary — no black halo.
function _drawRectBand(ctx, x, y, w, h) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = 'rgba(255, 60, 200, 0.22)';
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.shadowColor = 'rgba(255, 80, 220, 0.85)';
  ctx.shadowBlur  = 8;
  ctx.strokeStyle = 'rgba(255, 80, 220, 1)';
  ctx.lineWidth   = 2.5;
  ctx.strokeRect(x + 1.25, y + 1.25, Math.max(0, w - 2.5), Math.max(0, h - 2.5));
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
}

function _drawRects() {
  if (!_rects.length) return;
  const ctx  = _ctx;
  const area = _plotArea();

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x0, area.y0, area.x1 - area.x0, area.y1 - area.y0);
  ctx.clip();

  for (const rect of _rects) {
    const x  = Math.min(_etaToX(rect.etaMin, area), _etaToX(rect.etaMax, area));
    const rw = Math.abs(_etaToX(rect.etaMax, area) - _etaToX(rect.etaMin, area));

    // Display-φ fractions (0 = bottom seam, 1 = top seam)
    const phiMinD = ((rect.phiMin - _phiSeam) % TWO_PI + TWO_PI) % TWO_PI / TWO_PI;
    const phiMaxD = ((rect.phiMax - _phiSeam) % TWO_PI + TWO_PI) % TWO_PI / TWO_PI;

    if (phiMaxD >= phiMinD) {
      // Seam outside rect — one contiguous band
      const yTop = _phiToY(rect.phiMax, area);
      const yBot = _phiToY(rect.phiMin, area);
      _drawRectBand(ctx, x, Math.min(yTop, yBot), rw, Math.abs(yBot - yTop));
    } else {
      // Seam falls inside rect — draw two edge bands
      const yMax = _phiToY(rect.phiMax, area);
      _drawRectBand(ctx, x, yMax, rw, area.y1 - yMax);
      const yMin = _phiToY(rect.phiMin, area);
      _drawRectBand(ctx, x, area.y0, rw, yMin - area.y0);
    }
  }

  ctx.restore();
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

// True when φ lies on the arc [phiMin, phiMax]. The arc is continuous and may
// extend past ±π (drawn across the seam, or pushed there by panning), so the
// test is done modulo 2π rather than with a plain numeric compare.
function _phiInArc(phi, phiMin, phiMax) {
  const w = phiMax - phiMin;
  if (w >= TWO_PI - 1e-9) return true;
  const d = ((phi - phiMin) % TWO_PI + TWO_PI) % TWO_PI;
  return d <= w;
}

function _pointInRect(eta, phi, r) {
  return eta >= r.etaMin && eta <= r.etaMax && _phiInArc(phi, r.phiMin, r.phiMax);
}

function _hitRectAt(eta, phi) {
  for (let i = _rects.length - 1; i >= 0; i--) {
    if (_pointInRect(eta, phi, _rects[i])) return i;
  }
  return -1;
}

// ── φ seam slider ────────────────────────────────────────────────────────────
function _updateSeamThumb() {
  if (!_seamThumbEl) return;
  const ratio   = (_phiSeam - PHI_MIN) / TWO_PI;   // 0 = −π (bottom), 1 = +π (top)
  // Pixel formula to match the 182 px CSS track height (= H-INSET_T-INSET_B-2*LEGEND_BAR_M)
  const TRACK_H = H - INSET_T - INSET_B - 2 * LEGEND_BAR_M;
  const THUMB_H = 5;
  _seamThumbEl.style.top = Math.round((1 - ratio) * (TRACK_H - THUMB_H)) + 'px';
  if (_seamLblEl) _seamLblEl.textContent = _phiLabel(_phiSeam);
}

function _applySeamFromPointer(ev) {
  const rect  = _seamTrackEl.getBoundingClientRect();
  const ratio = 1 - Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
  _phiSeam    = PHI_MIN + ratio * TWO_PI;
  _updateSeamThumb();
  _redraw();
}

function _onSeamPointerDown(ev) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  _seamDragging = true;
  _seamTrackEl.setPointerCapture(ev.pointerId);
  _applySeamFromPointer(ev);
}

function _onSeamPointerMove(ev) {
  if (!_seamDragging) return;
  _applySeamFromPointer(ev);
}

function _onSeamPointerUp(ev) {
  if (!_seamDragging) return;
  _seamDragging = false;
  _seamTrackEl.releasePointerCapture(ev.pointerId);
}

function _onSeamDblClick() {
  _phiSeam = PHI_MIN;
  _updateSeamThumb();
  _redraw();
}

// ── Zoom — data viewport only, no CSS transform ──────────────────────────────
function _onZoomKey(ev) {
  const k = ev.key;
  if (k === '+' || k === '=' || k === 'Add') {
    const nf = Math.min(6.0, _zoomFactor * 1.25);
    if (nf !== _zoomFactor) { ev.preventDefault(); _zoomFactor = nf; _redraw(); }
  } else if (k === '-' || k === 'Subtract') {
    const nf = Math.max(1.0, _zoomFactor / 1.25);
    if (nf !== _zoomFactor) { ev.preventDefault(); _zoomFactor = nf; _redraw(); }
  } else if (k === '0') {
    if (_zoomFactor !== 1.0) { ev.preventDefault(); _zoomFactor = 1.0; _redraw(); }
  }
}

function _onWheelZoom(ev) {
  ev.preventDefault();
  // Pin zoom center to where the mouse is — only at scroll time, not on hover.
  if (_canvas) {
    const r    = _canvas.getBoundingClientRect();
    const cx   = ev.clientX - r.left;
    const cy   = ev.clientY - r.top;
    const area = _plotArea();
    if (cx >= area.x0 && cx <= area.x1 && cy >= area.y0 && cy <= area.y1) {
      _updateZoomCenter(cx, cy);
    }
  }
  if (ev.deltaY < 0) {
    const nf = Math.min(6.0, _zoomFactor * 1.25);
    if (nf !== _zoomFactor) { _zoomFactor = nf; _redraw(); }
  } else {
    const nf = Math.max(1.0, _zoomFactor / 1.25);
    if (nf !== _zoomFactor) { _zoomFactor = nf; _redraw(); }
  }
}

// ── Mouse handling ──────────────────────────────────────────────────────────
function _updateCursor(insidePlot, eta, phi) {
  if (!_canvas) return;
  if (_mouseState === 'panning') { _canvas.style.cursor = 'grabbing'; return; }
  if (_mouseState === 'drawing' || _mouseState === 'maybe-draw') {
    _canvas.style.cursor = 'crosshair'; return;
  }
  if (!insidePlot) { _canvas.style.cursor = 'default'; return; }
  _canvas.style.cursor = _hitRectAt(eta, phi) >= 0 ? 'grab' : 'crosshair';
}

function _onMouseDown(ev) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  const { x, y } = _clientToCanvas(ev);
  const area      = _plotArea();
  if (x < area.x0 || x > area.x1 || y < area.y0 || y > area.y1) return;
  const eta = _xToEta(x, area);
  const phi = _yToPhi(y, area);

  const hitIdx = _hitRectAt(eta, phi);
  if (hitIdx >= 0) {
    _mouseState    = 'maybe-pan';
    _activeRectIdx = hitIdx;
    const r  = _rects[hitIdx];
    const cx = (r.etaMin + r.etaMax) / 2;
    const cy = (r.phiMin + r.phiMax) / 2;
    // phi0Display: center in display-φ [0, 2π) — avoids modulo discontinuities on pan.
    const phi0Display = ((cy - _phiSeam) % TWO_PI + TWO_PI) % TWO_PI;
    _dragAnchor = { dEta: eta - cx, x, y, phi0Display, halfP: (r.phiMax - r.phiMin) / 2 };
  } else {
    _mouseState = 'maybe-draw';
    // Anchor φ is stored CONTINUOUS (no ±π wrap) so the drag stays a single
    // contiguous arc whatever the seam rotation — see issue with rects that
    // appeared split top+bottom after the seam was moved.
    _dragAnchor = { eta, phi: _yToPhiCont(y, area), x, y };
  }
  _updateCursor(true, eta, phi);
  _activePointerId = ev.pointerId;
  try { _canvas.setPointerCapture(ev.pointerId); } catch (_) { /* no-op */ }
}

function _onMouseMove(ev) {
  if (_mouseState === 'idle') return;
  const { x, y } = _clientToCanvas(ev);
  const area      = _plotArea();
  const cx        = Math.max(area.x0, Math.min(area.x1, x));
  const cy        = Math.max(area.y0, Math.min(area.y1, y));
  const eta       = _xToEta(cx, area);

  if (_mouseState === 'maybe-draw') {
    if (Math.hypot(x - _dragAnchor.x, y - _dragAnchor.y) >= DRAG_THRESHOLD_PX) {
      _mouseState = 'drawing';
      _rects.push(_normalizeRect({
        etaMin: _dragAnchor.eta, etaMax: eta,
        phiMin: _dragAnchor.phi, phiMax: _yToPhiCont(cy, area),
      }));
      _notifyRegion();
      _redraw();
    }
    return;
  }

  if (_mouseState === 'drawing') {
    // Both φ endpoints are CONTINUOUS — the rect is exactly the arc swept by
    // the pointer, never the ±π complement, at any seam rotation.
    _rects[_rects.length - 1] = _normalizeRect({
      etaMin: _dragAnchor.eta, etaMax: eta,
      phiMin: _dragAnchor.phi, phiMax: _yToPhiCont(cy, area),
    });
    _notifyRegion();
    _redraw();
    return;
  }

  if (_mouseState === 'maybe-pan') {
    if (Math.hypot(x - _dragAnchor.x, y - _dragAnchor.y) >= DRAG_THRESHOLD_PX) {
      _mouseState          = 'panning';
      _canvas.style.cursor = 'grabbing';
    }
  }

  if (_mouseState === 'panning') {
    const r    = _rects[_activeRectIdx];
    const halfE = (r.etaMax - r.etaMin) / 2;
    const halfP = _dragAnchor.halfP;

    // η: use zoom-aware _xToEta directly
    const ncx = eta - _dragAnchor.dEta;
    const cE  = Math.max(ETA_MIN + halfE, Math.min(ETA_MAX - halfE, ncx));

    // φ: accumulate delta in display-φ [0,2π) space — no modulo, no teleport.
    // Scale pixel delta by visible φ range so panning feels 1:1 at any zoom level.
    const [phiLo, phiHi] = _viewPhiFrac();
    const deltaDispPhi   = (_dragAnchor.y - cy) / (area.y1 - area.y0) * (phiHi - phiLo) * TWO_PI;
    const newDispPhi     = _dragAnchor.phi0Display + deltaDispPhi;
    const clampedDisp    = Math.max(halfP, Math.min(TWO_PI - halfP, newDispPhi));
    const cP_cont        = _phiSeam + clampedDisp;
    const cP             = ((cP_cont + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;

    _rects[_activeRectIdx] = {
      etaMin: cE - halfE, etaMax: cE + halfE,
      phiMin: cP - halfP, phiMax: cP + halfP,
    };
    _notifyRegion();
    _redraw();
  }
}

function _onMouseUp(ev) {
  if (ev.pointerId !== _activePointerId) return;
  try { _canvas.releasePointerCapture(ev.pointerId); } catch (_) { /* no-op */ }
  _activePointerId = -1;

  if (_mouseState === 'maybe-pan') {
    _rects.splice(_activeRectIdx, 1);
    _notifyRegion();
    _redraw();
  } else if (_mouseState === 'drawing') {
    const r = _rects[_rects.length - 1];
    if (r.etaMax - r.etaMin < MIN_RECT_ETA || r.phiMax - r.phiMin < MIN_RECT_PHI) {
      _rects.pop();
      _notifyRegion();
      _redraw();
    }
  }

  _mouseState    = 'idle';
  _dragAnchor    = null;
  _activeRectIdx = -1;
  if (_canvas) _canvas.style.cursor = '';
}

function _onMouseMoveHover(ev) {
  if (_mouseState !== 'idle') return;
  const { x, y } = _clientToCanvas(ev);
  const area      = _plotArea();
  const insidePlot = x >= area.x0 && x <= area.x1 && y >= area.y0 && y <= area.y1;
  if (!insidePlot) { _canvas.style.cursor = 'default'; return; }
  _updateCursor(true, _xToEta(x, area), _yToPhi(y, area));
}

// ── Public API ──────────────────────────────────────────────────────────────
export function initMinimap() {
  if (_canvas) return { redraw: _redraw };

  _wrapEl    = document.createElement('div');
  _wrapEl.id = 'minimap-wrap';

  // ── φ seam slider pane (left side) ────────────────────────────────────────
  const pane    = document.createElement('div');
  pane.id       = 'minimap-phi-pane';

  _seamTrackEl           = document.createElement('div');
  _seamTrackEl.id        = 'minimap-phi-track';
  _seamTrackEl.className = 'strak';
  _seamTrackEl.title     = 'φ seam — drag to rotate the display cut (dbl-click to reset)';
  _seamTrackEl.style.background =
    'linear-gradient(to top, ' +
    'rgba(80,130,210,0.12) 0%, rgba(80,130,210,0.48) 50%, rgba(80,130,210,0.12) 100%)';

  _seamThumbEl           = document.createElement('div');
  _seamThumbEl.className = 'sthumb';
  _seamTrackEl.appendChild(_seamThumbEl);

  const lbl       = document.createElement('div');
  lbl.id          = 'minimap-phi-lbl';
  lbl.textContent = _phiLabel(_phiSeam);
  _seamLblEl      = lbl;

  pane.appendChild(_seamTrackEl);
  pane.appendChild(lbl);
  _wrapEl.appendChild(pane);

  // ── Canvas ────────────────────────────────────────────────────────────────
  _canvas    = document.createElement('canvas');
  _canvas.id = 'minimap';
  _canvas.setAttribute('aria-label', 'η × φ energy heatmap');
  const dpr        = Math.min(window.devicePixelRatio || 1, 2);
  _canvas.width    = W * dpr;
  _canvas.height   = H * dpr;
  _canvas.style.width  = W + 'px';
  _canvas.style.height = H + 'px';
  _ctx = _canvas.getContext('2d');
  _ctx.scale(dpr, dpr);

  // Pointer events (not mouse) so draw / pan / delete work with touch on
  // mobile. Pointer capture keeps the drag alive even past the canvas edge,
  // so no window-level listeners are needed.
  _canvas.addEventListener('pointerdown',   _onMouseDown);
  _canvas.addEventListener('pointermove',   _onMouseMoveHover);
  _canvas.addEventListener('pointermove',   _onMouseMove);
  _canvas.addEventListener('pointerup',     _onMouseUp);
  _canvas.addEventListener('pointercancel', _onMouseUp);
  _canvas.addEventListener('pointerleave', () => {
    if (_mouseState === 'idle') _canvas.style.cursor = '';
  });
  _wrapEl.appendChild(_canvas);

  // ── Slider events ─────────────────────────────────────────────────────────
  _seamTrackEl.addEventListener('pointerdown',   _onSeamPointerDown);
  _seamTrackEl.addEventListener('pointermove',   _onSeamPointerMove);
  _seamTrackEl.addEventListener('pointerup',     _onSeamPointerUp);
  _seamTrackEl.addEventListener('pointercancel', _onSeamPointerUp);
  _seamTrackEl.addEventListener('dblclick',      _onSeamDblClick);

  // ── Zoom: keyboard while hovered; scroll wheel on the minimap ─────────────
  _wrapEl.addEventListener('mouseenter', () => window.addEventListener('keydown',    _onZoomKey));
  _wrapEl.addEventListener('mouseleave', () => window.removeEventListener('keydown', _onZoomKey));
  _wrapEl.addEventListener('wheel', _onWheelZoom, { passive: false });

  _updateSeamThumb();

  _wrapEl.style.display = 'none';
  document.body.appendChild(_wrapEl);

  _redraw();
  return { redraw: _redraw };
}

/**
 * @param {{ cells?: any[], fcal?: any[] }} data
 */
export function updateMinimap({ cells, fcal }) {
  let binsDirty = false;
  if (cells !== undefined) { _cellEntries = cells; binsDirty = true; }
  if (fcal  !== undefined) { _fcalEntries = fcal;  binsDirty = true; }
  if (binsDirty) _binCache = null;
  _redraw();
}

export function setMinimapVisible(visible) {
  _enabled = !!visible;
  if (_wrapEl) _wrapEl.style.display = _enabled ? '' : 'none';
  if (_enabled) _redraw();
  if (!_enabled && _rects.length > 0) {
    _rects = [];
    _notifyRegion();
  }
}

export function isMinimapVisible() {
  return _enabled;
}

/**
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
