// View-level selector state.
//   1 — Hits:      raw cells + raw tracks
//   2 — Clusters:  cells + tracks + cluster η/φ lines
//   3 — Particles: cells + tracks + jets + photons + electrons (default)
//
// Subsystems read getViewLevel() to decide their own visibility; they get
// notified of changes through onViewLevelChange(cb).

const _DEFAULT_LEVEL = 3;
let _level = _DEFAULT_LEVEL;
const _listeners = new Set();

export function getViewLevel() {
  return _level;
}

export function setViewLevel(n) {
  const next = n === 1 || n === 2 || n === 3 ? n : _DEFAULT_LEVEL;
  if (next === _level) return;
  _level = next;
  for (const cb of _listeners) cb(_level);
}

export function onViewLevelChange(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
