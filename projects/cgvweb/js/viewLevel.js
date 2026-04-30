// @ts-check
// View-level selector state.
//   1 — Hits:      raw cells + raw tracks
//   2 — Clusters:  cells + tracks + cluster η/φ lines
//   3 — Particles: cells + tracks + jets + photons + electrons (default)
//
// Subsystems read getViewLevel() to decide their own visibility; they get
// notified of changes through onViewLevelChange(cb).

/** @typedef {1 | 2 | 3} ViewLevel */
/** @typedef {(level: ViewLevel) => void} ViewLevelListener */

/** @type {ViewLevel} */
const _DEFAULT_LEVEL = 3;
/** @type {ViewLevel} */
let _level = _DEFAULT_LEVEL;
/** @type {Set<ViewLevelListener>} */
const _listeners = new Set();

/** @returns {ViewLevel} */
export function getViewLevel() {
  return _level;
}

/** @param {number} n */
export function setViewLevel(n) {
  /** @type {ViewLevel} */
  const next = n === 1 || n === 2 || n === 3 ? n : _DEFAULT_LEVEL;
  if (next === _level) return;
  _level = next;
  for (const cb of _listeners) cb(_level);
}

/**
 * @param {ViewLevelListener} cb
 * @returns {() => boolean}  Unsubscribe handle.
 */
export function onViewLevelChange(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
