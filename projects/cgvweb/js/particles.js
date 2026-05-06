// @ts-check
// Per-particle render barrel. Each particle class lives in its own file
// under js/particles/ — this module just re-exports the public API so the
// historical `from './particles.js'` imports stay working.
//
//   js/particles/_internal.js   shared infra (group disposers, η/φ-line +
//                               anchored-label builders, label-visibility
//                               sync, calo-cylinder constants).
//   js/particles/{tracks,photons,electrons,muons,clusters,jets,taus}.js
//                               one file per particle class — its draw* /
//                               clear* / sync* / get* functions and any
//                               class-private materials & constants.
//
// Adding a new particle class means a new file under js/particles/ and a
// re-export here; no other consumers need to change.

import {
  clearPhotons,
  drawPhotons,
  getLastPhotons,
  refreshPhotonsGeometry,
} from './particles/photons.js';
import { clearClusters, drawClusters, getLastClusters } from './particles/clusters.js';
import {
  clearTaus,
  drawTaus,
  syncTauTrackMatch,
  getLastTaus,
  refreshTausGeometry,
} from './particles/taus.js';
import { clearJets, drawJets, refreshJetsGeometry } from './particles/jets.js';
import { getActiveJetCollection } from './jets.js';

export { clearTracks, drawTracks } from './particles/tracks.js';
export { clearPhotons, drawPhotons, getLastPhotons };
export {
  clearElectrons,
  drawElectrons,
  syncElectronTrackMatch,
  getLastElectrons,
} from './particles/electrons.js';
export { clearMuons, drawMuons, syncMuonTrackMatch, getLastMuons } from './particles/muons.js';
export { clearClusters, drawClusters, getLastClusters };
export { clearJets, drawJets };
export { clearTaus, drawTaus, syncTauTrackMatch, getLastTaus };
export { syncParticleLabelVisibility } from './particles/_internal.js';

// ── Calo-bound particle refresh ──────────────────────────────────────────────
// γ springs and jet / τ η-φ lines terminate on the first VISIBLE calo cell
// (via _firstVisibleCellHit in _internal.js). When cell visibility changes —
// slider thresholds, layer toggles, slicer mask, jet collection switch —
// those endpoints go stale: the cached geometry still points where the now-
// hidden cells were. Callers in visibility.js invoke refreshCaloBoundParticles()
// at the tail of applyThreshold / applyFcalThreshold (and the composite
// apply{Cluster,Jet}Threshold / refreshSceneVisibility); _drawAll then walks
// each existing Line and rewrites its position attribute in place via the
// per-particle refreshXxxGeometry — no Group/Line/BufferGeometry rebuild.
//
// Clusters opt out (useCellRaycast=false in clusters.js) — their endpoints
// are deterministic from (η, φ) and re-running drawClusters across ~10 k
// cluster lines per slider tick freezes the UI.
//
// The shared `_refreshSuppressed` flag guards against re-entry — drawClusters
// → applyClusterThreshold → applyThreshold would otherwise re-trigger the
// refresh while already inside it — and also lets bulk callers (processXml's
// initial event load) batch the four draws under withSuppressedCaloBoundRefresh
// so the internal applyThreshold/applyFcalThreshold calls don't each kick
// off another full refresh cycle.
let _refreshSuppressed = false;
export function isRefreshingCaloBoundParticles() {
  return _refreshSuppressed;
}
function _hasAnyCachedCaloParticle() {
  // Mirrors _drawAll — clusters intentionally excluded (they use surface-
  // based intersection and don't refresh on visibility change).
  return (
    getLastPhotons().length > 0 || getLastTaus().length > 0 || getActiveJetCollection() != null
  );
}
function _drawAll() {
  // In-place position-attribute updates on the existing Lines, rather than
  // tear-down + rebuild via drawXxx. Each refreshXxxGeometry walks
  // get*Group().children, recomputes (t0, t1) via _firstVisibleCellHit, and
  // writes the new coordinates straight into the existing position
  // BufferAttribute — skipping the per-tick Group/Line/BufferGeometry
  // allocation that drawXxx would otherwise do.
  //
  // Clusters intentionally not refreshed: they use surface-based intersect
  // (useCellRaycast=false in clusters.js) so their (η, φ)-derived endpoints
  // are deterministic and don't move with cell visibility.
  refreshPhotonsGeometry();
  refreshTausGeometry();
  refreshJetsGeometry();
}
// rAF-debounced so a slider drag firing applyXxxThreshold many times per
// frame coalesces into a single _drawAll on the next frame. Without this the
// drag freezes — each tick re-runs all four drawXxx + raycaster end-to-end.
let _refreshScheduled = false;
function _runRefreshNow() {
  _refreshScheduled = false;
  if (_refreshSuppressed) return;
  if (!_hasAnyCachedCaloParticle()) return;
  _refreshSuppressed = true;
  try {
    _drawAll();
  } finally {
    _refreshSuppressed = false;
  }
}
export function refreshCaloBoundParticles() {
  if (_refreshSuppressed) return;
  if (!_hasAnyCachedCaloParticle()) return;
  if (_refreshScheduled) return;
  _refreshScheduled = true;
  requestAnimationFrame(_runRefreshNow);
}
/** @param {() => void} fn */
export function withSuppressedCaloBoundRefresh(fn) {
  if (_refreshSuppressed) {
    fn();
    return;
  }
  _refreshSuppressed = true;
  try {
    fn();
  } finally {
    _refreshSuppressed = false;
  }
}

// Composite-pattern shorthand: run `fn` with the per-stage refresh hooks
// suppressed, then fire ONE refresh after fn returns. Replaces the
// 5-place repetition of `withSuppressedCaloBoundRefresh(fn);
// refreshCaloBoundParticles();` in visibility.js (applyThreshold,
// applyClusterThreshold, applyJetThreshold, refreshSceneVisibility,
// _applyViewLevelGate). Re-entrant: when called inside an existing
// suppressed block (initial event-load draws, refresh's own _drawAll)
// the inner refresh is skipped by the suppress flag — so nesting
// doesn't multiply the refresh count.
/** @param {() => void} fn */
export function withCoalescedCaloBoundRefresh(fn) {
  withSuppressedCaloBoundRefresh(fn);
  refreshCaloBoundParticles();
}
