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
import {
  PAL_TILE_COLOR,
  PAL_LAR_COLOR,
  PAL_HEC_COLOR,
  palColorTile,
  palColorLAr,
  palColorHec,
  setPalMinTile,
  setPalMaxTile,
  setPalMinLAr,
  setPalMaxLAr,
  setPalMinHec,
  setPalMaxHec,
} from './palette.js';
import { metricValueOf } from './cellMetric.js';
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
  withCoalescedCaloBoundRefresh,
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

// ── η/φ region gate (driven by minimap rectangles) ──────────────────────────
// When non-empty, only cells/particles whose (η, φ) lies inside AT LEAST ONE
// rectangle are shown. Cleared when all rects are removed or the minimap hides.
// Ghost wireframes are exempt (controlled entirely by ghost.js).
/** @type {Array<{etaMin:number, etaMax:number, phiMin:number, phiMax:number}>} */
let _etaPhiRegions = [];

/** @param {Array<{etaMin:number, etaMax:number, phiMin:number, phiMax:number}> | null} regions */
export function setEtaPhiRegion(regions) {
  if (Array.isArray(regions) && regions.length > 0) {
    _etaPhiRegions = regions.filter(
      (r) =>
        Number.isFinite(r.etaMin) &&
        Number.isFinite(r.etaMax) &&
        Number.isFinite(r.phiMin) &&
        Number.isFinite(r.phiMax),
    );
  } else {
    _etaPhiRegions = [];
  }
  refreshSceneVisibility();
  // refreshSceneVisibility only covers calo cells. Tracks, clusters, jets and
  // taus each have their own pipelines that must be refreshed when the region
  // changes so they hide/show in sync with the cells.
  _refreshParticleRegions();
}

// Re-applies the η×φ region gate to all particle line groups without
// triggering the expensive ΔR rematch or jet-cell rebuild.
function _refreshParticleRegions() {
  // applyTrackThreshold handles tracks + photons + ΔR colours + K-popover +
  // label visibility in one idempotent pass — calling it here is safe.
  applyTrackThreshold();
  // Cluster lines.
  const clusterGroup = getClusterGroup();
  if (clusterGroup)
    for (const child of clusterGroup.children ?? []) {
      const { etGev, eta, phi } = child.userData;
      child.visible = etGev >= thrClusterEtGev && _inEtaPhiRegion(eta, phi);
    }
  // Jet + tau lines (applyTauPtThreshold already carries the region gate).
  const jetGroup = getJetGroup();
  if (jetGroup)
    for (const child of jetGroup.children ?? []) {
      const { etGev, eta, phi } = child.userData;
      child.visible = etGev >= thrJetEtGev && _inEtaPhiRegion(eta, phi);
    }
  applyTauPtThreshold();
}

export function getEtaPhiRegion() {
  return _etaPhiRegions;
}

// Returns true when (eta, phi) is inside at least one active rectangle, or
// when no rectangles are defined (no filter). Also returns true when eta/phi
// are undefined — callers that pass objects without those fields (e.g. sprite
// labels) should not be gated; their visibility follows their anchor's.
/** @param {number} eta @param {number} phi */
function _inEtaPhiRegion(eta, phi) {
  if (_etaPhiRegions.length === 0) return true;
  if (!Number.isFinite(eta) || !Number.isFinite(phi)) return true;
  // A rect's [phiMin, phiMax] is a CONTINUOUS arc that may run past ±π — drawn
  // across a rotated seam, or pushed there by panning. Test φ modulo 2π so the
  // gate matches the rectangle the user actually sees on the minimap.
  const TWO_PI = Math.PI * 2;
  return _etaPhiRegions.some((r) => {
    if (eta < r.etaMin || eta > r.etaMax) return false;
    const w = r.phiMax - r.phiMin;
    if (w >= TWO_PI - 1e-9) return true;
    const d = ((phi - r.phiMin) % TWO_PI + TWO_PI) % TWO_PI;
    return d <= w;
  });
}

// Exported for fcalRenderer and other sub-modules that need the same test
// without importing the private array.
export { _inEtaPhiRegion as inEtaPhiRegion };

// ── Pre-region "visible for heatmap" entries ────────────────────────────────
// The minimap's η×φ energy heatmap must reflect everything currently passing
// the detector / threshold / cluster / slicer filters, but NOT the η×φ
// rectangle filter (otherwise the heatmap would only show inside the rect —
// the user needs to see what's *outside* the rect to decide where to drag it).
//
// applyThreshold (and its slicer cousin) fills _visibleForHeatmap with one
// entry per cell that passes everything-except-region. fcalRenderer fills the
// FCAL side. A registered listener (set by main.js) gets notified after each
// rebuild so the minimap can re-bin.
/** @type {Array<{eta:number, phi:number, energyMev:number}>} */
let _visibleForHeatmap = [];
/** @type {Array<{eta:number, phi:number, energyMev:number}>} */
let _fcalVisibleForHeatmap = [];
/** @type {((cells: any[], fcal: any[]) => void) | null} */
let _heatmapListener = null;

/** @param {((cells: any[], fcal: any[]) => void) | null} cb */
export function setHeatmapListener(cb) {
  _heatmapListener = typeof cb === 'function' ? cb : null;
}

function _notifyHeatmap() {
  if (_heatmapListener) _heatmapListener(_visibleForHeatmap, _fcalVisibleForHeatmap);
}

/** @param {Array<{eta:number, phi:number, energyMev:number}> | null} entries */
export function setFcalHeatmapEntries(entries) {
  _fcalVisibleForHeatmap = entries || [];
  _notifyHeatmap();
}

// Re-applies cluster / photon / electron visibility AND the cell cluster-filter
// when the view level changes. Tracks are unaffected (they show at every level,
// gated only by setTracksVisible).
//
// applyThreshold + applyFcalThreshold each have their own particle-endpoint
// refresh hook; suppress them inside the wrapper so a single refresh runs
// after the full sub-stage chain — same pattern as applyClusterThreshold /
// applyJetThreshold / refreshSceneVisibility.
//
// Lepton match resolution is owned by applyTrackThreshold when on L3 (it
// re-runs syncElectronTrackMatch / syncMuonTrackMatch in its stage 2). Here
// we only need to *clear* those matches when leaving L3. τ match has no
// equivalent inside applyTrackThreshold so this function owns it on every
// transition.
function _applyViewLevelGate() {
  const lvl = getViewLevel();
  applyDetectorGroupViewLevel();
  withCoalescedCaloBoundRefresh(() => {
    // Refresh cell visibility: rebuildActiveClusterCellIds reads getViewLevel()
    // and disables the cluster-membership filter outside level 2; applyThreshold
    // then re-evaluates per-cell visibility.
    rebuildActiveClusterCellIds();
    applyThreshold();
    applyFcalThreshold();
    // Track jet-match highlight is only meaningful on level 3; passing null
    // (off levels) makes recompute clear all isJetMatched flags.
    recomputeJetTrackMatch(lvl === 3 ? getActiveJetCollection() : null, thrJetEtGev);
    if (lvl !== 3) {
      // Leaving L3: clear lepton matches so the red/green colouring drops out
      // of the L1/L2 views. On L3 → L3 transitions (or entering L3 from
      // L1/L2) applyTrackThreshold below re-establishes the matches.
      syncElectronTrackMatch(null);
      syncMuonTrackMatch(null);
    }
    syncTauTrackMatch(lvl === 3 ? getLastTaus() : null);
    // Re-run the track pipeline so the K-popover filters (in particular the
    // L3-only unmatched filter) get re-evaluated against the new level.
    // applyTrackThreshold's stage 2 also re-syncs electron/muon matches when
    // L3, so we don't pre-call them above.
    applyTrackThreshold();
  });
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
    for (const child of trackGroup.children ?? []) {
      const { ptGev, eta, phi } = child.userData;
      child.visible = ptGev >= thrTrackGev && _inEtaPhiRegion(eta, phi);
    }
  if (photonGroup)
    for (const child of photonGroup.children ?? []) {
      const { ptGev, eta, phi } = child.userData;
      child.visible = ptGev >= thrTrackGev && _inEtaPhiRegion(eta, phi);
    }
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
//
// applyTrackThreshold is intentionally NOT called from here, unlike
// applyJetThreshold which does need it (jet visibility feeds the
// "photons-in-jets" filter inside applyPhotonFilters, AND jet matches must
// be re-set via recomputeJetTrackMatch before the track filter pass). The
// cluster ET threshold's effect is fully contained in (a) the cluster line
// .visible flags above and (b) the cluster-cell membership filter rebuilt
// via rebuildActiveClusterCellIds, both of which only feed cell visibility
// (applyThreshold + applyFcalThreshold). Tracks are pT-driven, lepton
// matches are ΔR-driven against a static track set, and the K-popover
// filters depend on jet/τ visibility — none of which the cluster slider
// touches.
//
// applyThreshold + applyFcalThreshold each have their own particle-endpoint
// refresh hook; suppress them inside this composite so we run a single
// refresh after all sub-stages have updated cell visibility (otherwise the
// refresh between applyThreshold and applyFcalThreshold sees a stale FCAL).
export function applyClusterThreshold() {
  withCoalescedCaloBoundRefresh(() => {
    const clusterGroup = getClusterGroup();
    if (clusterGroup)
      for (const child of clusterGroup.children ?? []) {
        const { etGev, eta, phi } = child.userData;
        child.visible = etGev >= thrClusterEtGev && _inEtaPhiRegion(eta, phi);
      }
    rebuildActiveClusterCellIds();
    applyThreshold();
    applyFcalThreshold();
  });
}

// ── Jet threshold ─────────────────────────────────────────────────────────────
// Mirrors applyClusterThreshold: hides jet lines below thrJetEtGev AND rebuilds
// the cell-membership filter so cells outside the passing jets disappear at
// level 3 (same behaviour as the cluster view at level 2). Also refreshes the
// jet→track highlight (orange) for tracks belonging to passing jets.
export function applyJetThreshold() {
  // Single particle-endpoint refresh after the full sub-stage chain — see
  // applyClusterThreshold for the rationale.
  withCoalescedCaloBoundRefresh(() => {
    const jetGroup = getJetGroup();
    if (jetGroup)
      for (const child of jetGroup.children ?? []) {
        const { etGev, eta, phi } = child.userData;
        child.visible = etGev >= thrJetEtGev && _inEtaPhiRegion(eta, phi);
      }
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
  });
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
    child.visible = u.ptGev >= thrJetEtGev && passesCharge && _inEtaPhiRegion(u.eta, u.phi);
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
// Both branches (slicer-active via _applySlicerMask, regular per-cell sweep)
// fall through to the same particle-endpoint refresh at the end. The internal
// applyFcalThreshold call inside _applySlicerMask has its own hook — the
// suppress wrapper around the body silences it so we only refresh once.
export function applyThreshold() {
  withCoalescedCaloBoundRefresh(() => {
    if (_slicer?.isActive()) {
      _applySlicerMask();
      return;
    }
    visHandles = [];
    _visibleForHeatmap = [];
    const acIds = getActiveClusterCellIds();
    const amLabels = getActiveMbtsLabels();
    for (const [h, { energyMev, etMev, det, cellId, mbtsLabel, eta, phi }] of active) {
      const thr = det === 'LAR' ? thrLArMev : det === 'HEC' ? thrHecMev : thrTileMev;
      // Threshold + heatmap compare against the active metric (E or E_T).
      const cellVal = metricValueOf(energyMev, etMev);
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
      const passThr = _slicer?.isShowAllCells() || !isFinite(thr) || cellVal >= thr;
      const passCl = _slicer?.isShowAllCells() || inCluster;
      const passPreRegion = detOn && passThr && passCl;
      const passRegion = _inEtaPhiRegion(eta, phi);
      const vis = passPreRegion && passRegion;
      _setHandleVisible(h, vis);
      if (vis) visHandles.push(h);
      // Heatmap inclusion uses a CONSISTENT filter set regardless of slicer
      // state: detector toggle + energy threshold + cluster filter. The
      // slicer wedge and the minimap rect are intentionally excluded — the
      // minimap is meant as a stable overview the user can rely on while
      // they scan the 3D scene with the slicer (no holes that move with the
      // wedge). energyMev field carries the active-metric value.
      const passHeatmap = detOn && (!isFinite(thr) || cellVal >= thr) && inCluster;
      if (passHeatmap) _visibleForHeatmap.push({ eta, phi, energyMev: cellVal });
    }
    _syncNonActiveShowAll();
    _flushIMDirty();
    _rebuildRayIMeshes();
    rebuildAllOutlines();
    markDirty();
    _notifyHeatmap();
  });
}

// ── Slicer-masked threshold (called by applyThreshold when slicer is active) ──
function _applySlicerMask() {
  // Caller (applyThreshold) already gated on `_slicer?.isActive()`, so a null
  // _slicer here would be a bug — assert and pin a non-null local for TS.
  if (!_slicer) return;
  const slicer = _slicer;
  visHandles = [];
  _visibleForHeatmap = [];
  const slicerMask = slicer.getMaskState();
  const acIds = getActiveClusterCellIds();
  const amLabels = getActiveMbtsLabels();
  for (const [h, { energyMev, etMev, det, cellId, mbtsLabel, eta, phi }] of active) {
    const thr = det === 'LAR' ? thrLArMev : det === 'HEC' ? thrHecMev : thrTileMev;
    // Threshold + heatmap compare against the active metric (E or E_T).
    const cellVal = metricValueOf(energyMev, etMev);
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
    const passThr = slicer.isShowAllCells() || !isFinite(thr) || cellVal >= thr;
    const passCl = slicer.isShowAllCells() || inCluster;
    const passPreRegion = detOn && passThr && passCl;
    const passRegion = _inEtaPhiRegion(eta, phi);
    let passSlicer = true;
    if (passPreRegion) {
      const c = _cellCenter(h);
      if (slicer.isPointInsideWedge(c.x, c.y, c.z, slicerMask)) passSlicer = false;
    }
    const vis = passPreRegion && passRegion && passSlicer;
    _setHandleVisible(h, vis);
    if (vis) visHandles.push(h);
    // Heatmap inclusion: detector + energy threshold + cluster filter only.
    // The slicer wedge is deliberately NOT applied here — it would punch
    // wedge-shaped holes into the heatmap that move with the slicer drag,
    // making the overview hard to read. The minimap stays as a stable map
    // of the event while the slicer carves the 3D scene. (Also applies the
    // raw threshold even when slicer.isShowAllCells() is true, so toggling
    // the slicer doesn't suddenly repaint a flood of low-energy cells.)
    // energyMev field carries the active-metric value.
    const passHeatmap = detOn && (!isFinite(thr) || cellVal >= thr) && inCluster;
    if (passHeatmap) _visibleForHeatmap.push({ eta, phi, energyMev: cellVal });
  }
  _syncNonActiveShowAll();
  _flushIMDirty();
  _rebuildRayIMeshes();
  rebuildAllOutlines();
  applyFcalThreshold();
  markDirty();
  _notifyHeatmap();
  // Particle-endpoint refresh is owned by the caller (applyThreshold's slicer
  // branch) — _applySlicerMask runs inside applyFcalThreshold's hook (skipped
  // via the suppress flag during applyThreshold's downstream call).
}

// ── Cell-metric recolour ─────────────────────────────────────────────────────
// Re-derives per-detector percentile ranges, palette bounds, and per-cell
// colours from the current cell metric (E or E_T) over the active-map. Called
// by detectorPanels.js on a metric switch and by processXml on load when the
// panel is already in E_T mode. Returns the new [min,max] ranges so the
// caller can refresh the threshold sliders. Does NOT touch visibility — the
// caller runs applyThreshold afterwards.
/** @returns {{ tile: [number, number], lar: [number, number], hec: [number, number] }} */
export function recolorActiveCells() {
  /** @type {number[]} */ const tileVals = [];
  /** @type {number[]} */ const larVals = [];
  /** @type {number[]} */ const hecVals = [];
  for (const [, e] of active) {
    const v = metricValueOf(e.energyMev, e.etMev);
    if (!isFinite(v)) continue;
    if (e.det === 'LAR') larVals.push(v);
    else if (e.det === 'HEC') hecVals.push(v);
    else tileVals.push(v); // TILE + MBTS share the tile palette
  }
  // Same tail percentiles as processXml.rangeMev — a single extreme cell
  // can't blow out the colour scale.
  /**
   * @param {number[]} vals
   * @param {number} pctLo
   * @param {number} pctHi
   * @returns {[number, number]}
   */
  const range = (vals, pctLo, pctHi) => {
    if (!vals.length) return [0, 1];
    vals.sort((a, b) => a - b);
    const lo = vals[Math.floor(pctLo * vals.length)] ?? vals[0];
    const hi = vals[Math.floor(pctHi * vals.length)] ?? vals[vals.length - 1];
    return [lo, hi];
  };
  const tile = range(tileVals, 0.05, 0.995);
  const lar = range(larVals, 0.03, 0.97);
  const hec = range(hecVals, 0.02, 0.98);
  setPalMinTile(tile[0]);
  setPalMaxTile(tile[1]);
  setPalMinLAr(lar[0]);
  setPalMaxLAr(lar[1]);
  setPalMinHec(hec[0]);
  setPalMaxHec(hec[1]);
  for (const [h, e] of active) {
    const v = metricValueOf(e.energyMev, e.etMev);
    const col =
      e.det === 'LAR' ? palColorLAr(v) : e.det === 'HEC' ? palColorHec(v) : palColorTile(v);
    h.iMesh.setColorAt(h.instId, col);
    _markIMDirty(h.iMesh);
  }
  _flushIMDirty();
  markDirty();
  return { tile, lar, hec };
}

// ── High-level entry point ────────────────────────────────────────────────────
// Avoids double FCAL rebuild when slicer is active (_applySlicerMask already
// calls applyFcalThreshold internally). Single particle-endpoint refresh at
// the end — see applyClusterThreshold for the rationale.
export function refreshSceneVisibility() {
  withCoalescedCaloBoundRefresh(() => {
    applyThreshold();
    if (!_slicer?.isActive()) applyFcalThreshold();
  });
}
