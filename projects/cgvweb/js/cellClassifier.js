// @ts-check
// Pure cell-handle classifier — given the GLB mesh `name` (a "→"-joined
// path through the geometry tree), returns { det, subDet, sampling } so the
// layers panel can route per-cell visibility to the right leaf in layerVis.
// No DOM / Three.js / scene deps so it can be unit-tested.
//
// loader.js wraps this with a ghost-envelope filter (some atlas envelope
// names match the regexes but are not actual cells).
//
// Tile layer numbers `x` in the mesh prefix `T{x}{y}{k}_{k}` follow the
// build sequence in const/CaloBuild.C; the sampling tag is the standard
// A/BC/B/D/E (and inner/outer for MBTS modules at x=14/15).
//   x=1   → barrel/A     x=23 → barrel/BC   x=4 → barrel/D
//   x=5   → extended/A   x=6  → extended/B  x=7 → extended/D
//   x=8   → extended/D   (D4 cell, kept under EB-D)
//   x=9   → extended/B   (C10 cell, kept under EB-B per user request)
//   x=10..13 → itc/E     (E1-E4 collapse to a single ITC bucket)
//   x=14  → mbts/outer   x=15 → mbts/inner
import { HEC_NAMES } from './coords.js';

/**
 * @typedef {{ det: string, subDet: string, sampling: string | number }} CellClass
 */

/**
 * @param {string} name  Mesh path joined by "→" (the GLB tree separator).
 * @returns {CellClass | null}
 */
export function classifyCellName(name) {
  if (typeof name !== 'string') return null;
  const parts = name.split('→');
  if (parts.length < 3) return null;
  for (const p of parts) {
    let m = /^EB_(\d+)_/.exec(p);
    if (m) return { det: 'LAR', subDet: 'barrel', sampling: +m[1] };
    m = /^EE_(\d+)_/.exec(p);
    if (m) return { det: 'LAR', subDet: 'ec', sampling: +m[1] };
    m = /^EM(Barrel|EndCap)_(\d+)_/.exec(p);
    if (m) return { det: 'LAR', subDet: m[1] === 'Barrel' ? 'barrel' : 'ec', sampling: +m[2] };
    // HEC mesh prefix encodes the merged layer name (e.g. H_1_, H_23_) — map
    // it through HEC_NAMES to recover the sampling index 0..3.
    m = /^H_(\w+?)_/.exec(p);
    if (m) {
      const s = HEC_NAMES.indexOf(m[1]);
      if (s >= 0) return { det: 'HEC', subDet: 'ec', sampling: s };
    }
    m = /^HEC_(\w+?)_/.exec(p);
    if (m) {
      const s = HEC_NAMES.indexOf(m[1]);
      if (s >= 0) return { det: 'HEC', subDet: 'ec', sampling: s };
    }
    const tm = /^T(\d+)[pn]\d+_\d+$/.exec(p);
    if (tm) return _classifyTile(+tm[1]);
  }
  return null;
}

/**
 * Tile layer x → (subDet, sampling). Exported separately for tests that want
 * to assert the full layer table without parsing mesh names.
 * @param {number} x
 * @returns {CellClass}
 */
export function _classifyTile(x) {
  let subDet, sampling;
  if (x === 1) {
    subDet = 'barrel';
    sampling = 'A';
  } else if (x === 23) {
    subDet = 'barrel';
    sampling = 'BC';
  } else if (x === 4) {
    subDet = 'barrel';
    sampling = 'D';
  } else if (x === 5) {
    subDet = 'extended';
    sampling = 'A';
  } else if (x === 6 || x === 9) {
    subDet = 'extended';
    sampling = 'B';
  } else if (x === 7 || x === 8) {
    subDet = 'extended';
    sampling = 'D';
  } else if (x >= 10 && x <= 13) {
    subDet = 'itc';
    sampling = 'E';
  } else if (x === 14) {
    subDet = 'mbts';
    sampling = 'outer';
  } else if (x === 15) {
    subDet = 'mbts';
    sampling = 'inner';
  } else {
    subDet = 'extended';
    sampling = 'D';
  }
  return { det: 'TILE', subDet, sampling };
}
