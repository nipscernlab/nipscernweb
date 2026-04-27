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
import { PAL_TILE_COLOR, PAL_LAR_COLOR, PAL_HEC_COLOR, palColorFcal } from './palette.js';
import { scene, markDirty } from './renderer.js';
import { getViewLevel, onViewLevelChange } from './viewLevel.js';
import { getActiveJetCollection } from './jets.js';
import { recomputeJetTrackMatch } from './trackAtlasIntersections.js';
import {
  getLastElectrons,
  syncElectronTrackMatch,
  getLastTaus,
  syncTauTrackMatch,
  getLastMuons,
  syncMuonTrackMatch,
} from './particles.js';

// ── Late-injected dependencies (set via initVisibility after slicer is ready) ─
let _slicer = null;
let _rebuildAllOutlines = null;
let _updateTrackAtlasIntersections = null;

export function initVisibility({ slicer, rebuildAllOutlines, updateTrackAtlasIntersections }) {
  _slicer = slicer;
  _rebuildAllOutlines = rebuildAllOutlines;
  _updateTrackAtlasIntersections = updateTrackAtlasIntersections;
}

// ── Track / Photon / Electron / Muon / Cluster / Jet / Tau / MET / Vertex groups ──
let _trackGroup = null;
let _photonGroup = null;
let _electronGroup = null;
let _muonGroup = null;
let _clusterGroup = null;
let _jetGroup = null;
let _tauGroup = null;
let _metGroup = null;
let _vertexGroup = null;

let _tracksVisible = true;
let _clustersVisible = true;
let _jetsVisible = true;
let _tausVisible = true;

export const getTrackGroup = () => _trackGroup;
export const getPhotonGroup = () => _photonGroup;
export const getElectronGroup = () => _electronGroup;
export const getMuonGroup = () => _muonGroup;
export const getClusterGroup = () => _clusterGroup;
export const getJetGroup = () => _jetGroup;
export const getTauGroup = () => _tauGroup;
export const getMetGroup = () => _metGroup;
export const getVertexGroup = () => _vertexGroup;

export const getTracksVisible = () => _tracksVisible;
export const getClustersVisible = () => _clustersVisible;
export const getJetsVisible = () => _jetsVisible;

export function setTrackGroup(g) {
  _trackGroup = g;
  if (g) g.visible = _tracksVisible;
}
export function setPhotonGroup(g) {
  _photonGroup = g;
  if (g) g.visible = getViewLevel() === 3;
}
export function setElectronGroup(g) {
  _electronGroup = g;
  if (g) g.visible = getViewLevel() === 3;
}
export function setMuonGroup(g) {
  _muonGroup = g;
  if (g) g.visible = getViewLevel() === 3;
}
export function setClusterGroup(g) {
  _clusterGroup = g;
  if (g) g.visible = _clustersVisible && getViewLevel() === 2;
}
export function setJetGroup(g) {
  _jetGroup = g;
  if (g) g.visible = _jetsVisible && getViewLevel() === 3;
}
export function setTauGroup(g) {
  _tauGroup = g;
  if (g) g.visible = _tausVisible && getViewLevel() === 3;
}
export function setMetGroup(g) {
  _metGroup = g;
  if (g) g.visible = getViewLevel() === 3;
}
// Vertices are event-level summary info — relevant at every view level, so
// no gate. Always visible while the marker group exists.
export function setVertexGroup(g) {
  _vertexGroup = g;
}

// Tracks toggle (J button): controls only the track lines now. Photons and
// electrons are no longer linked to this flag — their visibility comes from
// the view level (level 3 shows them).
export function setTracksVisible(v) {
  _tracksVisible = v;
  if (_trackGroup) _trackGroup.visible = v;
}
// User intent for the cluster toggle (K button at level 2). The cluster group
// is only actually shown when level === 2 AND the user has clusters enabled.
export function setClustersVisible(v) {
  _clustersVisible = v;
  if (_clusterGroup) _clusterGroup.visible = v && getViewLevel() === 2;
}
// User intent for the jet toggle (K button at level 3). Same idea, gated to L3.
export function setJetsVisible(v) {
  _jetsVisible = v;
  if (_jetGroup) _jetGroup.visible = v && getViewLevel() === 3;
}

// Re-applies cluster / photon / electron visibility AND the cell cluster-filter
// when the view level changes. Tracks are unaffected (they show at every level,
// gated only by setTracksVisible).
function _applyViewLevelGate() {
  const lvl = getViewLevel();
  if (_clusterGroup) _clusterGroup.visible = _clustersVisible && lvl === 2;
  if (_photonGroup) _photonGroup.visible = lvl === 3;
  if (_electronGroup) _electronGroup.visible = lvl === 3;
  if (_muonGroup) _muonGroup.visible = lvl === 3;
  if (_jetGroup) _jetGroup.visible = _jetsVisible && lvl === 3;
  if (_tauGroup) _tauGroup.visible = _tausVisible && lvl === 3;
  if (_metGroup) _metGroup.visible = lvl === 3;
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
  markDirty();
}
onViewLevelChange(_applyViewLevelGate);

// ── Energy threshold state ────────────────────────────────────────────────────
export let thrTileMev = 50;
export let thrLArMev = 0;
export let thrHecMev = 600;
export let thrFcalMev = 0;

export function setThrTileMev(v) {
  thrTileMev = v;
}
export function setThrLArMev(v) {
  thrLArMev = v;
}
export function setThrHecMev(v) {
  thrHecMev = v;
}
export function setThrFcalMev(v) {
  thrFcalMev = v;
}

// ── Detector toggle state ─────────────────────────────────────────────────────
// `layerVis` is a tree mirroring the layout of the floating Layers panel. Each
// leaf is a boolean; aggregate ON/OFF for parent rows is derived (any leaf on).
// Cell handles carry { det, subDet, sampling } tags set in loader.js, and the
// threshold loop dispatches through `_detOnFor(h)` which walks the tree.
//   tile.barrel    — A, BC, D                 (LB samplings)
//   tile.extended  — A, B, D                  (EB samplings; D4→D, C10→B)
//   tile.itc       — E                        (E1-E4 gap scintillators)
//   mbts           — inner, outer
//   lar.barrel     — 0, 1, 2, 3               (EMB samplings: presampler/strips/middle/back)
//   lar.ec         — 0, 1, 2, 3               (EMEC samplings)
//   hec            — 0, 1, 2, 3               (HEC1-HEC4)
//   fcal           — 1, 2, 3                  (FCAL1 EM, FCAL2 Had1, FCAL3 Had2)
export const layerVis = {
  tile: {
    barrel: { A: true, BC: true, D: true },
    extended: { A: true, B: true, D: true },
    itc: { E: true },
  },
  mbts: { inner: true, outer: true },
  lar: {
    barrel: { 0: true, 1: true, 2: true, 3: true },
    ec: { 0: true, 1: true, 2: true, 3: true },
  },
  hec: { 0: true, 1: true, 2: true, 3: true },
  fcal: { 1: true, 2: true, 3: true },
};

// Sets a leaf at the given path (e.g. ['tile','barrel','A']).
export function setLayerLeaf(path, on) {
  let node = layerVis;
  for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
  node[path[path.length - 1]] = !!on;
}
// Bulk-set every leaf under a sub-tree to `on`.
export function setLayerSubtree(path, on) {
  let node = layerVis;
  for (const k of path) node = node[k];
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) {
      if (typeof node[k] === 'object') setLayerSubtree([...path, k], on);
      else node[k] = !!on;
    }
  }
}
// True if any leaf under the sub-tree is on.
export function anyLayerLeafOn(path) {
  let node = layerVis;
  for (const k of path) node = node[k];
  if (typeof node !== 'object') return !!node;
  for (const k of Object.keys(node)) {
    if (typeof node[k] === 'object') {
      if (anyLayerLeafOn([...path, k])) return true;
    } else if (node[k]) {
      return true;
    }
  }
  return false;
}

// Picks the visibility flag for a given cell handle, based on its sub-detector
// and sampling tags. Used by both the active-cell threshold loop and the
// show-all sweep. FCAL is filtered separately in _applyFcalDraw.
function _detOnFor(h) {
  if (h.det === 'HEC') return !!layerVis.hec[h.sampling];
  if (h.det === 'LAR') return !!layerVis.lar[h.subDet]?.[h.sampling];
  if (h.det === 'TILE') {
    if (h.subDet === 'mbts') return !!layerVis.mbts[h.sampling];
    return !!layerVis.tile[h.subDet]?.[h.sampling];
  }
  return false;
}

// ── Track threshold state ─────────────────────────────────────────────────────
export let thrTrackGev = 2;
export let trackPtMinGev = 0;
export let trackPtMaxGev = 5;

export function setThrTrackGev(v) {
  thrTrackGev = v;
}
export function setTrackPtMinGev(v) {
  trackPtMinGev = v;
}
export function setTrackPtMaxGev(v) {
  trackPtMaxGev = v;
}

// ── Cluster threshold state ───────────────────────────────────────────────────
export let thrClusterEtGev = 3;
export let clusterEtMinGev = 0;
export let clusterEtMaxGev = 1;

export function setThrClusterEtGev(v) {
  thrClusterEtGev = v;
}
export function setClusterEtMinGev(v) {
  clusterEtMinGev = v;
}
export function setClusterEtMaxGev(v) {
  clusterEtMaxGev = v;
}

// ── Jet threshold state ───────────────────────────────────────────────────────
// Independent from cluster — the slider in #rpanel2 reads/writes one or the
// other based on the current view level (level 2 = cluster, level 3 = jet).
export let thrJetEtGev = 20;
export let jetEtMinGev = 0;
export let jetEtMaxGev = 1;

export function setThrJetEtGev(v) {
  thrJetEtGev = v;
}
export function setJetEtMinGev(v) {
  jetEtMinGev = v;
}
export function setJetEtMaxGev(v) {
  jetEtMaxGev = v;
}

// ── Cluster filter sets (computed from cluster data) ─────────────────────────
let lastClusterData = null;
let activeClusterCellIds = null;
let activeMbtsLabels = null;

export function setLastClusterData(v) {
  lastClusterData = v;
}

// ── Visibility bookkeeping ────────────────────────────────────────────────────
export let visHandles = [];

export function clearVisibilityState() {
  visHandles = [];
  lastClusterData = null;
  activeClusterCellIds = null;
  activeMbtsLabels = null;
}

// ── FCAL state and rendering ──────────────────────────────────────────────────
let fcalCellsData = [];
export let fcalGroup = null;
export let fcalVisibleMap = [];

// Reusable temporaries allocated once, reused across FCAL rebuilds.
const _fcalUp = new THREE.Vector3(0, 1, 0);
const _fcalDir = new THREE.Vector3();
const _fcalDummy = new THREE.Object3D();
const _fcalCol = new THREE.Color();
export const fcalEdgeMat4 = new THREE.Matrix4();
const _fcalTwist = new THREE.Quaternion();
const _fcalTwistAxis = new THREE.Vector3(0, 1, 0);
const _FCAL_TWIST_RAD = (2 * Math.PI) / 16;

let _fcalEdgeBase = null;
export function getFcalEdgeBase() {
  if (_fcalEdgeBase) return _fcalEdgeBase;
  const tmpGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const edgeGeo = new THREE.EdgesGeometry(tmpGeo, 30);
  tmpGeo.dispose();
  _fcalEdgeBase = edgeGeo.getAttribute('position').array.slice();
  edgeGeo.dispose();
  return _fcalEdgeBase;
}

export function clearFcal() {
  if (!fcalGroup) return;
  fcalGroup.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  scene.remove(fcalGroup);
  fcalGroup = null;
}

export function drawFcal(cells) {
  clearFcal();
  fcalCellsData = cells;
  if (!cells.length) return;
  _applyFcalDraw();
}

export function applyFcalThreshold() {
  if (!fcalCellsData.length) return;
  if (fcalGroup) {
    for (const child of [...fcalGroup.children]) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      fcalGroup.remove(child);
    }
  }
  _applyFcalDraw();
}

function _applyFcalDraw() {
  const slicerMask = _slicer?.getMaskState() ?? { active: false };

  const visible = fcalCellsData.filter((c) => {
    // FCAL is filtered per-module instead of a single showFcal flag — module
    // 1=EM, 2=Had1, 3=Had2 (parser/src/lib.rs:694).
    if (!layerVis.fcal[c.module]) return false;
    if (!_slicer?.isShowAllCells() && c.energy * 1000 < thrFcalMev) return false;
    if (
      !_slicer?.isShowAllCells() &&
      activeClusterCellIds !== null &&
      c.id &&
      !activeClusterCellIds.has(c.id)
    )
      return false;
    if (slicerMask.active) {
      const cx = -c.x * 10,
        cy = -c.y * 10,
        cz = c.z * 10;
      if (_slicer.isPointInsideWedge(cx, cy, cz, slicerMask)) return false;
    }
    return true;
  });
  fcalVisibleMap = visible;
  if (!fcalGroup) {
    fcalGroup = new THREE.Group();
    scene.add(fcalGroup);
  }
  if (!visible.length) {
    markDirty();
    return;
  }

  const n = visible.length;
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const cylMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.FrontSide });
  const iMesh = new THREE.InstancedMesh(cylGeo, cylMat, n);

  for (let i = 0; i < n; i++) {
    const { x, y, z, dx, dy, dz, energy } = visible[i];
    const rx = Math.max(Math.abs(dx) * 5, 1e-3);
    const ry = Math.max(Math.abs(dy) * 5, 1e-3);
    const len = Math.max(Math.abs(dz) * 2 * 10, 1e-3);
    const cx = -x * 10,
      cy = -y * 10,
      cz = z * 10;
    _fcalDir.set(0, 0, dz >= 0 ? 1 : -1);
    _fcalDummy.position.set(cx, cy, cz);
    _fcalDummy.scale.set(rx, len, ry);
    _fcalDummy.quaternion.setFromUnitVectors(_fcalUp, _fcalDir);
    _fcalTwist.setFromAxisAngle(_fcalTwistAxis, _FCAL_TWIST_RAD);
    _fcalDummy.quaternion.multiply(_fcalTwist);
    _fcalDummy.updateMatrix();
    iMesh.setMatrixAt(i, _fcalDummy.matrix);
    const [r, g, b] = palColorFcal(energy * 1000);
    _fcalCol.setRGB(r, g, b);
    iMesh.setColorAt(i, _fcalCol);
  }
  iMesh.instanceMatrix.needsUpdate = true;
  if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;
  fcalGroup.add(iMesh);

  const eb = getFcalEdgeBase();
  const outBuf = new Float32Array(n * eb.length);
  let op = 0;
  for (let i = 0; i < n; i++) {
    iMesh.getMatrixAt(i, fcalEdgeMat4);
    const m = fcalEdgeMat4.elements;
    for (let j = 0; j < eb.length; j += 3) {
      const lx = eb[j],
        ly = eb[j + 1],
        lz = eb[j + 2];
      outBuf[op++] = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
      outBuf[op++] = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
      outBuf[op++] = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
    }
  }
  const outGeo = new THREE.BufferGeometry();
  outGeo.setAttribute('position', new THREE.BufferAttribute(outBuf, 3));
  const outLines = new THREE.LineSegments(
    outGeo,
    new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  outLines.frustumCulled = false;
  outLines.renderOrder = 3;
  fcalGroup.add(outLines);

  markDirty();
}

// ── Core cell handle visibility primitive ─────────────────────────────────────
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
  for (const det of ['TILE', 'LAR', 'HEC']) {
    for (const h of cellMeshesByDet[det]) {
      if (!active.has(h)) _setHandleVisible(h, false);
    }
  }
  _flushIMDirty();
}

// ── Cell-membership filter (cluster at L2, jet at L3) ─────────────────────────
// Builds the set of cell IDs that pass the current overlay's filter.
//   Level 1: filter off (null = pass all).
//   Level 2: cells belonging to any cluster passing thrClusterEtGev.
//   Level 3: cells belonging to any jet (in the active collection) passing
//            thrJetEtGev. Collections without a <cells> field (EMPFlow,
//            UFOCSSK) yield an empty set, which hides every cell — matches
//            the strict cluster behaviour the user asked for.
// activeMbtsLabels is only populated for clusters; jets don't expose MBTS.
export function rebuildActiveClusterCellIds() {
  const lvl = getViewLevel();
  if (lvl === 2 && lastClusterData) {
    const ids = new Set();
    const mbts = new Set();
    for (const { clusters } of lastClusterData.collections) {
      for (const { eta, phi: rawPhi, etGev, cells } of clusters) {
        if (etGev < thrClusterEtGev) continue;
        for (const k of ['TILE', 'LAR_EM', 'HEC', 'FCAL', 'TRACK', 'OTHER'])
          for (const id of cells[k]) ids.add(id);
        const absEta = Math.abs(eta);
        let ch;
        if (absEta >= 2.78 && absEta <= 3.86) ch = 1;
        else if (absEta >= 2.08 && absEta < 2.78) ch = 0;
        else continue;
        const type = eta >= 0 ? 1 : -1;
        const phiPos = rawPhi < 0 ? rawPhi + 2 * Math.PI : rawPhi;
        const mod = Math.floor(phiPos / ((2 * Math.PI) / 8)) % 8;
        mbts.add(`type_${type}_ch_${ch}_mod_${mod}`);
      }
    }
    activeClusterCellIds = ids;
    activeMbtsLabels = mbts;
    return;
  }
  if (lvl === 3) {
    const c = getActiveJetCollection();
    const ids = new Set();
    if (c) {
      for (const j of c.jets) {
        if (j.etGev < thrJetEtGev) continue;
        for (const id of j.cells) ids.add(id);
      }
    }
    activeClusterCellIds = ids;
    activeMbtsLabels = null;
    return;
  }
  // Level 1 (or no data): filter off entirely.
  activeClusterCellIds = null;
  activeMbtsLabels = null;
}

// ── Track threshold ───────────────────────────────────────────────────────────
export function applyTrackThreshold() {
  if (_trackGroup)
    for (const child of _trackGroup.children) child.visible = child.userData.ptGev >= thrTrackGev;
  if (_photonGroup)
    for (const child of _photonGroup.children) child.visible = child.userData.ptGev >= thrTrackGev;
  if (_electronGroup)
    for (const child of _electronGroup.children)
      child.visible = child.userData.ptGev >= thrTrackGev;
  _updateTrackAtlasIntersections?.();
  // Track visibility just changed — soft tracks getting hidden could free up
  // the closest-track slot for an electron, or vice-versa. Re-run the ΔR match
  // and rebuild "e±" labels (gated to L3 — at other levels it's a no-op).
  // Same goes for "μ±" labels.
  if (getViewLevel() === 3) {
    syncElectronTrackMatch(getLastElectrons());
    syncMuonTrackMatch(getLastMuons());
  }
  markDirty();
}

// ── Cluster threshold ─────────────────────────────────────────────────────────
export function applyClusterThreshold() {
  if (_clusterGroup)
    for (const child of _clusterGroup.children)
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
  if (_jetGroup)
    for (const child of _jetGroup.children) child.visible = child.userData.etGev >= thrJetEtGev;
  // τ lines share the same L3 ET slider — hadronic τs *are* narrow jets, so
  // letting them pass while real jets are cut would visually dominate the
  // L3 view. <TauJet> publishes pT (not ET); for the cone of objects we're
  // dealing with the two are close enough to compare against a single
  // threshold.
  applyTauPtThreshold();
  rebuildActiveClusterCellIds();
  applyThreshold();
  applyFcalThreshold();
  applyTrackThreshold();
  // Highlight tracks of passing jets (orange) — only meaningful on level 3.
  const lvl = getViewLevel();
  recomputeJetTrackMatch(lvl === 3 ? getActiveJetCollection() : null, thrJetEtGev);
}

// Hides τ lines whose pT falls below the L3 ET slider. Called from
// applyJetThreshold when the slider moves and from drawTaus on fresh load.
// Standalone (not folded into applyJetThreshold) so drawTaus can reuse it
// without dragging the cell-filter / track-recolour passes along.
export function applyTauPtThreshold() {
  if (!_tauGroup) return;
  for (const child of _tauGroup.children) child.visible = child.userData.ptGev >= thrJetEtGev;
}

// ── Non-active cells in show-all mode ────────────────────────────────────────
// Sweeps every cell absent from `active` and makes it visible (painted with
// the minimum-palette colour) unless the slicer wedge covers its centre.
// Appends newly-visible handles to visHandles so outlines and raycasting include them.
function _syncNonActiveShowAll() {
  if (!_slicer?.isShowAllCells()) return;
  const slicerMask = _slicer.getMaskState();
  // Each handle resolves its own visibility flag via h.subDet, so the sweep
  // doesn't need to be split per sub-region — just per top-level detector for
  // the minimum-palette colour.
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
        if (_slicer.isPointInsideWedge(c.x, c.y, c.z, slicerMask)) vis = false;
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
  for (const [h, { energyMev, det, cellId, mbtsLabel }] of active) {
    const thr = det === 'LAR' ? thrLArMev : det === 'HEC' ? thrHecMev : thrTileMev;
    const detOn = _detOnFor(h);
    let inCluster;
    if (activeClusterCellIds === null) {
      inCluster = true;
    } else if (mbtsLabel != null) {
      inCluster = activeMbtsLabels !== null && activeMbtsLabels.has(mbtsLabel);
    } else if (cellId != null) {
      inCluster = activeClusterCellIds.has(cellId);
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
  _rebuildAllOutlines?.();
  markDirty();
}

// ── Slicer-masked threshold (called by applyThreshold when slicer is active) ──
function _applySlicerMask() {
  visHandles = [];
  const slicerMask = _slicer.getMaskState();
  for (const [h, { energyMev, det, cellId, mbtsLabel }] of active) {
    const thr = det === 'LAR' ? thrLArMev : det === 'HEC' ? thrHecMev : thrTileMev;
    const detOn = _detOnFor(h);
    let inCluster;
    if (activeClusterCellIds === null) {
      inCluster = true;
    } else if (mbtsLabel != null) {
      inCluster = activeMbtsLabels !== null && activeMbtsLabels.has(mbtsLabel);
    } else if (cellId != null) {
      inCluster = activeClusterCellIds.has(cellId);
    } else {
      inCluster = true;
    }
    const passThr = _slicer.isShowAllCells() || !isFinite(thr) || energyMev >= thr;
    const passCl = _slicer.isShowAllCells() || inCluster;
    const passFilter = detOn && passThr && passCl;
    let vis = passFilter;
    if (vis) {
      const c = _cellCenter(h);
      if (_slicer.isPointInsideWedge(c.x, c.y, c.z, slicerMask)) vis = false;
    }
    _setHandleVisible(h, vis);
    if (vis) visHandles.push(h);
  }
  _syncNonActiveShowAll();
  _flushIMDirty();
  _rebuildRayIMeshes();
  _rebuildAllOutlines?.();
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
