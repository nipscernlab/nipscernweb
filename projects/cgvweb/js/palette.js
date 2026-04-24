// @ts-check

import * as THREE from 'three';

const PAL_N = 256;

/**
 * @typedef {(t: number) => THREE.Color} ColorRamp
 * A 0..1 parameter maps to a colour along the ramp.
 */

/** @type {ColorRamp} — TILE: white → dark red. */
function _rampTile(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(1.0 + t * (0.3 - 1.0), 1.0 + t * (0.0 - 1.0), 0.0);
}

/** @type {ColorRamp} — HEC: pale blue → deep blue. */
function _rampHec(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    0.4 + t * (0.0471 - 0.4),
    0.8784 + t * (0.0118 - 0.8784),
    0.9647 + t * (0.4078 - 0.9647),
  );
}

/** @type {ColorRamp} — LAr EM: dark green → green. */
function _rampLAr(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(0.0902 + t * (0.1529 - 0.0902), 0.8118 + t * (0.0 - 0.8118), 0.2588);
}

/**
 * Build a 256-entry palette by sampling a ramp, then boosting saturation.
 * @param {ColorRamp} ramp
 * @returns {THREE.Color[]}
 */
const _mkPal = (ramp) =>
  Array.from({ length: PAL_N }, (_, i) => {
    const c = ramp(i / (PAL_N - 1));
    c.offsetHSL(0, 0.35, 0);
    return c;
  });

/** @type {THREE.Color[]} */
export const PAL_TILE_COLOR = _mkPal(_rampTile);
/** @type {THREE.Color[]} */
export const PAL_HEC_COLOR = _mkPal(_rampHec);
/** @type {THREE.Color[]} */
export const PAL_LAR_COLOR = _mkPal(_rampLAr);

// Shared cell materials — one per detector. Per-instance colors come from
// InstancedMesh.setColorAt on top of the base white.
export const matTile = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  side: THREE.FrontSide,
  flatShading: true,
});
export const matHec = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  side: THREE.FrontSide,
  flatShading: true,
});
export const matLAr = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  side: THREE.FrontSide,
  flatShading: true,
});

// Default energy scale ceilings (MeV).
export const TILE_SCALE = 2000;
export const HEC_SCALE = 5000;
export const LAR_SCALE = 1000;
export const FCAL_SCALE = 7000;

let _tileMin = 0,
  _tileMax = TILE_SCALE;
let _hecMin = 0,
  _hecMax = HEC_SCALE;
let _larMin = 0,
  _larMax = LAR_SCALE;
let _fcalMin = 0,
  _fcalMax = FCAL_SCALE;

/**
 * @param {number} mev
 * @param {number} fallback
 * @returns {number}
 */
const _setFinite = (mev, fallback) => (isFinite(mev) ? mev : fallback);

/** @param {number} mev */
export const setPalMaxTile = (mev) => {
  _tileMax = _setFinite(mev, TILE_SCALE);
};
/** @param {number} mev */
export const setPalMaxHec = (mev) => {
  _hecMax = _setFinite(mev, HEC_SCALE);
};
/** @param {number} mev */
export const setPalMaxLAr = (mev) => {
  _larMax = _setFinite(mev, LAR_SCALE);
};
/** @param {number} mev */
export const setPalMaxFcal = (mev) => {
  _fcalMax = _setFinite(mev, FCAL_SCALE);
};
/** @param {number} mev */
export const setPalMinTile = (mev) => {
  _tileMin = _setFinite(mev, 0);
};
/** @param {number} mev */
export const setPalMinHec = (mev) => {
  _hecMin = _setFinite(mev, 0);
};
/** @param {number} mev */
export const setPalMinLAr = (mev) => {
  _larMin = _setFinite(mev, 0);
};
/** @param {number} mev */
export const setPalMinFcal = (mev) => {
  _fcalMin = _setFinite(mev, 0);
};

/**
 * Map v ∈ [lo, hi] to a 0..PAL_N-1 palette index. lo === hi falls back to hi.
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
const _palIdx = (v, lo, hi) => {
  const span = hi - lo;
  const t = span > 0 ? (v - lo) / span : 1;
  return Math.round(Math.max(0, Math.min(1, t)) * (PAL_N - 1));
};

/** @param {number} eMev @returns {THREE.Color} */
export const palColorTile = (eMev) => PAL_TILE_COLOR[_palIdx(eMev, _tileMin, _tileMax)];
/** @param {number} eMev @returns {THREE.Color} */
export const palColorHec = (eMev) => PAL_HEC_COLOR[_palIdx(eMev, _hecMin, _hecMax)];
/** @param {number} eMev @returns {THREE.Color} */
export const palColorLAr = (eMev) => PAL_LAR_COLOR[_palIdx(eMev, _larMin, _larMax)];

/** @param {number} eMev @returns {number[]} */
export const palColorFcal = (eMev) => {
  const span = _fcalMax - _fcalMin;
  const t = span > 0 ? (eMev - _fcalMin) / span : 1;
  return palColorFcalRgb(t);
};

/** @type {number[][]} */
const _FCAL_STOPS = [
  [0.102, 0.024, 0.0],
  [0.42, 0.137, 0.063],
  [0.784, 0.392, 0.165],
  [1.0, 0.698, 0.416],
  [1.0, 0.918, 0.745],
];

/** @type {number[]} */
const _FCAL_STEPS = [0.0, 0.25, 0.55, 0.8, 1.0];

/**
 * Piecewise-linear RGB interpolation across _FCAL_STOPS with a gamma pre-curve.
 * @param {number} t
 * @returns {number[]}
 */
function palColorFcalRgb(t) {
  t = Math.max(0, Math.min(1, t));
  t = Math.pow(t, 0.55);
  for (let i = 1; i < _FCAL_STEPS.length; i++) {
    if (t <= _FCAL_STEPS[i]) {
      const k = (t - _FCAL_STEPS[i - 1]) / (_FCAL_STEPS[i] - _FCAL_STEPS[i - 1]);
      const a = _FCAL_STOPS[i - 1],
        b = _FCAL_STOPS[i];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return _FCAL_STOPS[_FCAL_STOPS.length - 1];
}
