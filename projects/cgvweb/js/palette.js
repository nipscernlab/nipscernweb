import * as THREE from 'three';

export const PAL_N = 256;

// Linear color ramps — inputs clamped to [0, 1].
function _rampTile(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    1.000 + t * (0.502 - 1.000),  // R: 1.0 -> 0.502
    1.000 + t * (0.000 - 1.000),  // G: 1.0 -> 0
    0.0
  );
}
function _rampHec(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    0.4000 + t * (0.0471 - 0.4000),
    0.8784 + t * (0.0118 - 0.8784),
    0.9647 + t * (0.4078 - 0.9647)
  );
}
function _rampLAr(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    0.0902 + t * (0.1529 - 0.0902),
    0.8118 + t * (0.0000 - 0.8118),
    0.2588
  );
}

// Build a 256-entry palette by sampling a ramp function, then boosting saturation.
const _mkPal = ramp => Array.from({ length: PAL_N }, (_, i) => {
  const c = ramp(i / (PAL_N - 1));
  c.offsetHSL(0, 0.35, 0);
  return c;
});

export const PAL_TILE_COLOR = _mkPal(_rampTile);
export const PAL_HEC_COLOR  = _mkPal(_rampHec);
export const PAL_LAR_COLOR  = _mkPal(_rampLAr);

// Shared cell materials — one per detector. Per-instance colors come from
// InstancedMesh.setColorAt on top of the base white.
export const matTile = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.FrontSide, flatShading: true });
export const matHec  = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.FrontSide, flatShading: true });
export const matLAr  = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.FrontSide, flatShading: true });

// Energy scale ceilings (MeV) used to map energy -> palette index.
export const TILE_SCALE = 2000;
export const HEC_SCALE  = 5000;
export const LAR_SCALE  = 1000;

const _palIdx = (v, s) => Math.round(Math.max(0, Math.min(1, v / s)) * (PAL_N - 1));
export const palColorTile = (eMev) => PAL_TILE_COLOR[_palIdx(eMev, TILE_SCALE)];
export const palColorHec  = (eMev) => PAL_HEC_COLOR [_palIdx(eMev, HEC_SCALE)];
export const palColorLAr  = (eMev) => PAL_LAR_COLOR [_palIdx(eMev, LAR_SCALE)];

// FCAL copper ramp: deep patina -> oxidised -> molten -> bright -> hot highlight.
// Gamma 0.55 keeps low energies dark and lets high values dominate.
export const FCAL_SCALE = 7000;
const _FCAL_STOPS = [
  [0.102, 0.024, 0.000],
  [0.420, 0.137, 0.063],
  [0.784, 0.392, 0.165],
  [1.000, 0.698, 0.416],
  [1.000, 0.918, 0.745],
];
const _FCAL_STEPS = [0.0, 0.25, 0.55, 0.80, 1.0];
export function palColorFcalRgb(t) {
  t = Math.max(0, Math.min(1, t));
  t = Math.pow(t, 0.55);
  for (let i = 1; i < _FCAL_STEPS.length; i++) {
    if (t <= _FCAL_STEPS[i]) {
      const k = (t - _FCAL_STEPS[i-1]) / (_FCAL_STEPS[i] - _FCAL_STEPS[i-1]);
      const a = _FCAL_STOPS[i-1], b = _FCAL_STOPS[i];
      return [a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k];
    }
  }
  return _FCAL_STOPS[_FCAL_STOPS.length - 1];
}
