// @ts-check
import * as THREE from 'three';
import {
  active,
  cellMeshesByDet,
  rayTargets,
  _ZERO_MAT4,
  _markIMDirty,
  _flushIMDirty,
  _rayIMeshes,
} from './state.js';
import { PAL_TILE_COLOR, PAL_LAR_COLOR, PAL_HEC_COLOR } from './palette.js';
import { markDirty } from './renderer.js';
import { getViewLevel, onViewLevelChange } from './viewLevel.js';
import { getActiveJetCollection } from './jets.js';
import { recomputeJetTrackMatch } from './trackMatch.js';
import { updateTrackAtlasIntersections } from './trackAtlasIntersections.js';
import { rebuildAllOutlines } from './outlines.js';
// Internal-use imports below — only the symbols this module's own pipeline
// orchestration touches. The complete public surface of each sub-module is
// re-exported via the `export * from` barrel further down.
import {
  getLastElectrons,
  syncElectronTrackMatch,
  getLastTaus,
  syncTauTrackMatch,
  getLastMuons,
  syncMuonTrackMatch,
  syncParticleLabelVisibility,
} from './particles.js';
import { isLayerOn } from './visibility/layerVis.js';
import { applyFcalThreshold } from './visibility/fcalRenderer.js';
import {
  setLastClusterData,
  getActiveClusterCellIds,
  getActiveMbtsLabels,
  clearClusterFilter,
  rebuildActiveClusterCellIds,
} from './visibility/clusterFilter.js';
import {
  getTrackGroup,
  getPhotonGroup,
  getClusterGroup,
  getJetGroup,
  getTauGroup,
  getUnmatchedTausVisible,
  applyDetectorGroupViewLevel,
  applyParticleTrackFilters,
  applyPhotonFilters,
} from './visibility/detectorGroups.js';
import {
  thrTileMev,
  thrLArMev,
  thrHecMev,
  thrTrackGev,
  thrClusterEtGev,
  thrJetEtGev,
} from './visibility/thresholds.js';

// ── Public-API barrel ──────────────────────────────────────────────────────
// Every symbol exported by these sub-modules is available via `from
// './visibility.js'` — adding a new export to a sub-module automatically
// flows through here, no explicit re-export edit needed. Each sub-module
// follows the underscore-prefix convention for internals, so there's no
// risk of leaking private helpers through the barrel.
export * from './visibility/layerVis.js';
export * from './visibility/muonVisibility.js';
export * from './visibility/fcalRenderer.js';
export * from './visibility/detectorGroups.js';
export * from './visibility/thresholds.js';

// Sub-set re-exports for modules whose surface is bigger than visibility.js's
// public contract (they expose internals that other consumers shouldn't
// import via this barrel — keep these explicit so the public list stays
// minimal).
export { setLastClusterData, rebuildActiveClusterCellIds };
export { syncParticleLabelVisibility };

// ── Late-injected slicer controller ──────────────────────────────────────────
// Slicer is a per-app controller instance built in main.js — not a stable
// module export — so it stays late-injected via initVisibility. The other
// previously-late-injected helpers (rebuildAllOutlines / updateTrackAtlas-
// Intersections) are now imported directly above; both ES module cycles are
// safe because the function bodies only run after both modules finish loading.

/**
 * Subset of slicer.createSlicerController()'s return shape that this module
 * actually reads. Kept structural (not an import('./slicer.js')) so a future
 * slicer rewrite only has to honour these four methods.
 * @typedef {{
 *   isActive: () => boolean,
 *   isShowAllCells: () => boolean,
 *   getMaskState: () => { active: boolean, [key: string]: any },
 *   isPointInsideWedge: (x: number, y: number, z: number, mask?: any) => boolean,
 * }} SlicerController
 */

/** @type {SlicerController | null} */
let _slicer = null;

/** @param {{ slicer: SlicerController }} deps */
export function initVisibility({ slicer }) {
  _slicer = slicer;
}

// Re-applies cluster / photon / electron visibility AND the cell cluster-filter
// when the view level changes. Tracks are unaffected (they show at every level,
// gated only by setTracksVisible).
function _applyViewLevelGate() {
  const lvl = getViewLevel();
  applyDetectorGroupViewLevel();
  // Refresh cell visibility: rebuildActiveClusterCellIds reads getViewLevel()
  // and disables the cluster-membership filter outside level 2; applyThreshold
  // then re-evaluates per-cell visibility.
  rebuildActiveClusterCellIds();
  applyThreshold();
  applyFcalThreshold();
  // Track jet-match highlight is only meaningful on level 3; passing null
  // (off levels) makes recompute clear all isJetMatched flags.
  recomputeJetTrackMatch(lvl === 3 ? getActiveJetCollection() : null, thrJetEtGev);
  // Same gate for the electron→track ΔR match — outside L3 we don't want the
  // red/green colours bleeding into the simpler views. syncElectronTrackMatch
  // re-marks tracks AND rebuilds the floating "e±" label sprites.
  syncElectronTrackMatch(lvl === 3 ? getLastElectrons() : null);
  // τ→track colour mirrors the same L3-only gate.
  syncTauTrackMatch(lvl === 3 ? getLastTaus() : null);
  // μ→track sprite labels — same L3-only gate.
  syncMuonTrackMatch(lvl === 3 ? getLastMuons() : null);
  // Re-run the track pipeline so the K-popover filters (in particular the
  // L3-only unmatched filter) get re-evaluated against the new level. Without
  // this, leaving L3 with unmatched=off leaves the tracks hidden at L1/L2.
  applyTrackThreshold();
  markDirty();
}
onViewLevelChange(_applyViewLevelGate);

// Local alias — the dispatcher itself lives in ./layerVis.js so it can be
// unit-tested without pulling Three.js / scene. The threshold loops below
// reference _detOnFor for backwards-compatible naming inside this module.
const _detOnFor = isLayerOn;

// Read accessor for the late-injected slicer — used by fcalRenderer.js to
// avoid a circular value-import. The cluster-filter accessors live in
// ./clusterFilter.js (re-exported through getActiveClusterCellIds).
export const getSlicer = () => _slicer;
export { getActiveClusterCellIds };

// ── Visibility bookkeeping ────────────────────────────────────────────────────
/** @type {import('./state.js').CellHandle[]} */
export let visHandles = [];

export function clearVisibilityState() {
  visHandles = [];
  clearClusterFilter();
}

// ── Core cell handle visibility primitive ─────────────────────────────────────
/**
 * @param {import('./state.js').CellHandle} h
 * @param {boolean} vis
 */
function _setHandleVisible(h, vis) {
  if (h.visible === vis) return;
  h.visible = vis;
  h.iMesh.setMatrixAt(h.instId, vis ? h.origMatrix : _ZERO_MAT4);
  _markIMDirty(h.iMesh);
}

function _rebuildRayIMeshes() {
  _rayIMeshes.clear();
  for (const h of visHandles) _rayIMeshes.add(h.iMesh);
  rayTargets.length = 0;
  _rayIMeshes.forEach((im) => rayTargets.push(im));
}

// Cached world-space centre of a cell handle (derived from origMatrix).
/** @param {import('./state.js').CellHandle} h  @returns {THREE.Vector3} */
function _cellCenter(h) {
  if (h._center) return h._center;
  const m = h.origMatrix.elements;
  const c = new THREE.Vector3(m[12], m[13], m[14]);
  if (c.lengthSq() < 1e-6) {
    const geo = h.iMesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const bs = geo.boundingSphere;
    if (bs) c.copy(bs.center).applyMatrix4(h.origMatrix);
  }
  h._center = c;
  return c;
}

// Called by the slicer's onHideNonActiveShowAll callback: hide all non-active cells.
export function hideNonActiveCells() {
  /** @type {Array<keyof typeof cellMeshesByDet>} */
  const dets = ['TILE', 'LAR', 'HEC'];
  for (const det of dets) {
    for (const h of cellMeshesByDet[det]) {
      if (!active.has(h)) _setHandleVisible(h, false);
    }
  }
  _flushIMDirty();
}

// ── Track threshold ───────────────────────────────────────────────────────────
// Single pipeline that re-derives all track-related visibility from the
// current pT slider, the K-popover flags, and the cached particle lists. The
// stages are ordered by data dependency — every stage reads what the previous
// stage just wrote — so the function is idempotent and order-stable when
// called from any of: pT slider, K-popover toggle, applyClusterThreshold,
// applyJetThreshold, the view-level gate.
//
// Stages:
//   1. pT pass        — c.visible = ptGev >= thr (tracks + photons)
//   2. ΔR rematch     — recompute electron/muon matches against the now
//                       pT-visible tracks (a soft track that just dropped
//                       below thr can no longer steal a match from a real
//                       lepton above thr; conversely lowering the slider
//                       can reassign matches). Tau/jet matches are by
//                       index, independent of visibility, and are owned by
//                       drawTaus / applyJetThreshold instead.
//   3. K-popover filter — applyParticleTrackFilters reads the FRESH match
//                       flags from stage 2 and hides matched tracks that
//                       the user has untoggled (Electrons, Muons, Taus,
//                       Unmatched).
//   4. Derived state  — per-sprite label .visible follows its anchor track,
//                       muon-chamber outlines follow the visible tracks
//                       passing through them.
//
// Callers must ensure tau/jet match flags are already set when this runs
// (they don't depend on pT visibility, so they're recomputed elsewhere).
// The processXml deferral pattern — drawTracks/drawPhotons skip calling
// this, the tail of processXml runs it once via applyJetThreshold — exists
// because at draw-tracks time _lastElectrons/_lastMuons are still empty.
export function applyTrackThreshold() {
  const trackGroup = getTrackGroup();
  const photonGroup = getPhotonGroup();
  // 1. pT pass. Photon spring lines share the slider; the electron / muon
  // label sprite groups are NOT iterated here — their children carry no
  // ptGev field, so `undefined >= thr === false` would silently hide every
  // label. Their group-level visibility is gated by setElectronGroup /
  // setMuonGroup (level + J button + K-popover flag).
  if (trackGroup)
    for (const child of trackGroup.children ?? [])
      child.visible = child.userData.ptGev >= thrTrackGev;
  if (photonGroup)
    for (const child of photonGroup.children ?? [])
      child.visible = child.userData.ptGev >= thrTrackGev;
  // 2. ΔR rematch (electron / muon only). Skipped outside L3 — the L3 view
  // level is the only one that surfaces lepton colours, and the level gate
  // already cleared the matches when the user left L3.
  if (getViewLevel() === 3) {
    syncElectronTrackMatch(getLastElectrons());
    syncMuonTrackMatch(getLastMuons());
  }
  // 3. K-popover filters (electron / muon / tau / unmatched on tracks; the
  // "photons-in-jets" filter on photons reads jet/τ visibility set earlier
  // by applyJetThreshold's pT pass).
  applyParticleTrackFilters();
  applyPhotonFilters();
  // 4. Derived state.
  syncParticleLabelVisibility();
  updateTrackAtlasIntersections();
  markDirty();
}

// ── Cluster threshold ─────────────────────────────────────────────────────────
export function applyClusterThreshold() {
  const clusterGroup = getClusterGroup();
  if (clusterGroup)
    for (const child of clusterGroup.children ?? [])
      child.visible = child.userData.etGev >= thrClusterEtGev;
  rebuildActiveClusterCellIds();
  applyThreshold();
  applyFcalThreshold();
  applyTrackThreshold();
}

// ── Jet threshold ─────────────────────────────────────────────────────────────
// Mirrors applyClusterThreshold: hides jet lines below thrJetEtGev AND rebuilds
// the cell-membership filter so cells outside the passing jets disappear at
// level 3 (same behaviour as the cluster view at level 2). Also refreshes the
// jet→track highlight (orange) for tracks belonging to passing jets.
export function applyJetThreshold() {
  const jetGroup = getJetGroup();
  if (jetGroup)
    for (const child of jetGroup.children ?? [])
      child.visible = child.userData.etGev >= thrJetEtGev;
  // τ lines share the same L3 ET slider — hadronic τs *are* narrow jets, so
  // letting them pass while real jets are cut would visually dominate the
  // L3 view. <TauJet> publishes pT (not ET); for the cone of objects we're
  // dealing with the two are close enough to compare against a single
  // threshold.
  applyTauPtThreshold();
  rebuildActiveClusterCellIds();
  applyThreshold();
  applyFcalThreshold();
  // Jet matches must be set BEFORE applyTrackThreshold's filter pass —
  // applyTrackThreshold recomputes electron/muon (visibility-dependent) but
  // not jet/tau (index-dependent), so jet ownership of this stage stays
  // here. See the pipeline doc above applyTrackThreshold.
  const lvl = getViewLevel();
  recomputeJetTrackMatch(lvl === 3 ? getActiveJetCollection() : null, thrJetEtGev);
  applyTrackThreshold();
}

// Hides τ lines whose pT falls below the L3 ET slider OR whose daughter-
// charge sum isn't ±1 (the "unmatched" τ candidates — algorithm seeds whose
// charge doesn't match a real τ). Called from applyJetThreshold when the
// slider moves, from drawTaus on fresh load, and from the K-popover binding
// when the Unmatched Tau toggle flips. Standalone (not folded into
// applyJetThreshold) so drawTaus can reuse it without dragging the cell-
// filter / track-recolour passes along.
export function applyTauPtThreshold() {
  const tauGroup = getTauGroup();
  if (!tauGroup) return;
  const showUnmatched = getUnmatchedTausVisible();
  for (const child of tauGroup.children ?? []) {
    const u = child.userData;
    const passesCharge = u.charge === -1 || u.charge === 1 || showUnmatched;
    child.visible = u.ptGev >= thrJetEtGev && passesCharge;
  }
}

// ── Non-active cells in show-all mode ────────────────────────────────────────
// Sweeps every cell absent from `active` and makes it visible (painted with
// the minimum-palette colour) unless the slicer wedge covers its centre.
// Appends newly-visible handles to visHandles so outlines and raycasting include them.
function _syncNonActiveShowAll() {
  if (!_slicer?.isShowAllCells()) return;
  // Pin a non-null reference for the closure below — TS can't narrow `_slicer`
  // through the lambda boundary even though we just guarded above.
  const slicer = _slicer;
  const slicerMask = slicer.getMaskState();
  // Each handle resolves its own visibility flag via h.subDet, so the sweep
  // doesn't need to be split per sub-region — just per top-level detector for
  // the minimum-palette colour.
  /**
   * @param {import('./state.js').CellHandle[]} list
   * @param {THREE.Color} minColor
   */
  const sweep = (list, minColor) => {
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (active.has(h)) continue;
      if (!_detOnFor(h)) {
        _setHandleVisible(h, false);
        continue;
      }
      let vis = true;
      if (slicerMask.active) {
        const c = _cellCenter(h);
        if (slicer.isPointInsideWedge(c.x, c.y, c.z, slicerMask)) vis = false;
      }
      if (vis) {
        h.iMesh.setColorAt(h.instId, minColor);
        _markIMDirty(h.iMesh);
        visHandles.push(h);
      }
      _setHandleVisible(h, vis);
    }
  };
  sweep(cellMeshesByDet.TILE, PAL_TILE_COLOR[0]);
  sweep(cellMeshesByDet.LAR, PAL_LAR_COLOR[0]);
  sweep(cellMeshesByDet.HEC, PAL_HEC_COLOR[0]);
}

// ── Main threshold application (Tile / LAr EM / HEC) ─────────────────────────
export function applyThreshold() {
  if (_slicer?.isActive()) {
    _applySlicerMask();
    return;
  }
  visHandles = [];
  const acIds = getActiveClusterCellIds();
  const amLabels = getActiveMbtsLabels();
  for (const [h, { energyMev, det, cellId, mbtsLabel }] of active) {
    const thr = det === 'LAR' ? thrLArMev : det === 'HEC' ? thrHecMev : thrTileMev;
    const detOn = _detOnFor(h);
    let inCluster;
    if (acIds === null) {
      inCluster = true;
    } else if (mbtsLabel != null) {
      inCluster = amLabels !== null && amLabels.has(mbtsLabel);
    } else if (cellId != null) {
      inCluster = acIds.has(cellId);
    } else {
      inCluster = true;
    }
    const passThr = _slicer?.isShowAllCells() || !isFinite(thr) || energyMev >= thr;
    const passCl = _slicer?.isShowAllCells() || inCluster;
    const vis = detOn && passThr && passCl;
    _setHandleVisible(h, vis);
    if (vis) visHandles.push(h);
  }
  _syncNonActiveShowAll();
  _flushIMDirty();
  _rebuildRayIMeshes();
  rebuildAllOutlines();
  markDirty();
}

// ── Slicer-masked threshold (called by applyThreshold when slicer is active) ──
function _applySlicerMask() {
  // Caller (applyThreshold) already gated on `_slicer?.isActive()`, so a null
  // _slicer here would be a bug — assert and pin a non-null local for TS.
  if (!_slicer) return;
  const slicer = _slicer;
  visHandles = [];
  const slicerMask = slicer.getMaskState();
  const acIds = getActiveClusterCellIds();
  const amLabels = getActiveMbtsLabels();
  for (const [h, { energyMev, det, cellId, mbtsLabel }] of active) {
    const thr = det === 'LAR' ? thrLArMev : det === 'HEC' ? thrHecMev : thrTileMev;
    const detOn = _detOnFor(h);
    let inCluster;
    if (acIds === null) {
      inCluster = true;
    } else if (mbtsLabel != null) {
      inCluster = amLabels !== null && amLabels.has(mbtsLabel);
    } else if (cellId != null) {
      inCluster = acIds.has(cellId);
    } else {
      inCluster = true;
    }
    const passThr = slicer.isShowAllCells() || !isFinite(thr) || energyMev >= thr;
    const passCl = slicer.isShowAllCells() || inCluster;
    const passFilter = detOn && passThr && passCl;
    let vis = passFilter;
    if (vis) {
      const c = _cellCenter(h);
      if (slicer.isPointInsideWedge(c.x, c.y, c.z, slicerMask)) vis = false;
    }
    _setHandleVisible(h, vis);
    if (vis) visHandles.push(h);
  }
  _syncNonActiveShowAll();
  _flushIMDirty();
  _rebuildRayIMeshes();
  rebuildAllOutlines();
  applyFcalThreshold();
  markDirty();
}

// ── High-level entry point ────────────────────────────────────────────────────
// Avoids double FCAL rebuild when slicer is active (_applySlicerMask already
// calls applyFcalThreshold internally).
export function refreshSceneVisibility() {
  applyThreshold();
  if (!_slicer?.isActive()) applyFcalThreshold();
}
