// @ts-check
// Calorimeter cell metric selector — energy (E) vs transverse energy (E_T).
//
// Every calo cell (TILE / LAr / HEC / MBTS / FCAL) carries a raw energy and a
// pseudorapidity η. E_T = E / cosh(η) is the energy projected onto the plane
// transverse to the beam — the quantity physics analyses actually threshold
// on, because it's Lorentz-invariant under boosts along z and isn't inflated
// by the large |η| of forward cells.
//
// This module owns a single global mode flag. processXml stamps both energyMev
// and etMev on each active-map entry; the threshold pipeline, palette colouring,
// heatmap feed, and hover tooltip all read the current mode through here so a
// flip recolours + re-thresholds everything from one switch.

/** @typedef {'E' | 'ET'} CellMetric */

/** @type {CellMetric} — E_T is the default: it's the quantity physics
 * analyses threshold on, and it's what the forward (high-|η|) cells need
 * to read sensibly. */
let _metric = 'ET';

/** @type {Array<(m: CellMetric) => void>} */
const _listeners = [];

/** @returns {CellMetric} */
export function getCellMetric() {
  return _metric;
}

/**
 * Sets the active metric and notifies listeners. No-op when unchanged so a
 * spurious select-change event can't churn the recolour pipeline.
 * @param {CellMetric} m
 */
export function setCellMetric(m) {
  if (m !== 'E' && m !== 'ET') return;
  if (m === _metric) return;
  _metric = m;
  for (const cb of _listeners) cb(_metric);
}

/** @param {(m: CellMetric) => void} cb */
export function onCellMetricChange(cb) {
  _listeners.push(cb);
}

/**
 * Transverse energy from energy + pseudorapidity. cosh(η) ≥ 1 always, so the
 * sign of E is preserved — ATLAS XML carries negative cell energies and E_T
 * stays negative for them, which the percentile ranges + palettes expect.
 * @param {number} eMev
 * @param {number} eta
 * @returns {number}
 */
export function etMevFromE(eMev, eta) {
  const ch = Math.cosh(eta);
  return ch > 0 ? eMev / ch : eMev;
}

/**
 * Picks the value for the current mode out of a cell's pre-stamped pair.
 * @param {number} energyMev
 * @param {number} etMev
 * @returns {number}
 */
export function metricValueOf(energyMev, etMev) {
  return _metric === 'ET' ? etMev : energyMev;
}
