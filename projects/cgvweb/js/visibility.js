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

// ── Late-injected dependencies (set via initVisibility after slicer is ready) ─
let _slicer = null;
let _rebuildAllOutlines = null;
let _updateTrackAtlasIntersections = null;

export function initVisibility({ slicer, rebuildAllOutlines, updateTrackAtlasIntersections }) {
  _slicer = slicer;
  _rebuildAllOutlines = rebuildAllOutlines;
  _updateTrackAtlasIntersections = updateTrackAtlasIntersections;
}

// ── Track / Photon / Cluster groups (created by particles.js, lifecycle owned here) ──
let _trackGroup = null;
let _photonGroup = null;
let _clusterGroup = null;

let _tracksVisible = true;
let _clustersVisible = true;

export const getTrackGroup = () => _trackGroup;
export const getPhotonGroup = () => _photonGroup;
export const getClusterGroup = () => _clusterGroup;

export const getTracksVisible = () => _tracksVisible;
export const getClustersVisible = () => _clustersVisible;

export function setTrackGroup(g) {
  _trackGroup = g;
  if (g) g.visible = _tracksVisible;
}
export function setPhotonGroup(g) {
  _photonGroup = g;
  if (g) g.visible = _tracksVisible;
}
export function setClusterGroup(g) {
  _clusterGroup = g;
  if (g) g.visible = _clustersVisible;
}

export function setTracksVisible(v) {
  _tracksVisible = v;
  if (_trackGroup) _trackGroup.visible = v;
  if (_photonGroup) _photonGroup.visible = v;
}
export function setClustersVisible(v) {
  _clustersVisible = v;
  if (_clusterGroup) _clusterGroup.visible = v;
}

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
export let showTile = true;
export let showLAr = true;
export let showHec = true;
export let showFcal = true;

export function setShowTile(v) {
  showTile = v;
}
export function setShowLAr(v) {
  showLAr = v;
}
export function setShowHec(v) {
  showHec = v;
}
export function setShowFcal(v) {
  showFcal = v;
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
export let thrClusterEtGev = 0;
export let clusterEtMinGev = 0;
export let clusterEtMaxGev = 1;
export let clusterFilterEnabled = true;

export function setThrClusterEtGev(v) {
  thrClusterEtGev = v;
}
export function setClusterEtMinGev(v) {
  clusterEtMinGev = v;
}
export function setClusterEtMaxGev(v) {
  clusterEtMaxGev = v;
}
export function setClusterFilterEnabled(v) {
  clusterFilterEnabled = v;
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
    if (!showFcal) return false;
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
    fcalGroup.matrixAutoUpdate = false;
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
  iMesh.matrixAutoUpdate = false;

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
  outLines.matrixAutoUpdate = false;
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

// ── Cluster filter ────────────────────────────────────────────────────────────
export function rebuildActiveClusterCellIds() {
  if (!clusterFilterEnabled || !lastClusterData) {
    activeClusterCellIds = null;
    activeMbtsLabels = null;
    return;
  }
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
}

// ── Track threshold ───────────────────────────────────────────────────────────
export function applyTrackThreshold() {
  if (_trackGroup)
    for (const child of _trackGroup.children) child.visible = child.userData.ptGev >= thrTrackGev;
  if (_photonGroup)
    for (const child of _photonGroup.children) child.visible = child.userData.ptGev >= thrTrackGev;
  _updateTrackAtlasIntersections?.();
  markDirty();
}

// ── Cluster threshold ─────────────────────────────────────────────────────────
export function applyClusterThreshold() {
  if (_clusterGroup)
    for (const child of _clusterGroup.children)
      child.visible = clusterFilterEnabled && child.userData.etGev >= thrClusterEtGev;
  rebuildActiveClusterCellIds();
  applyThreshold();
  applyFcalThreshold();
  applyTrackThreshold();
}

// ── Non-active cells in show-all mode ────────────────────────────────────────
// Sweeps every cell absent from `active` and makes it visible (painted with
// the minimum-palette colour) unless the slicer wedge covers its centre.
// Appends newly-visible handles to visHandles so outlines and raycasting include them.
function _syncNonActiveShowAll() {
  if (!_slicer?.isShowAllCells()) return;
  const slicerMask = _slicer.getMaskState();
  const sweep = (list, detOn, minColor) => {
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (active.has(h)) continue;
      if (!detOn) {
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
  sweep(cellMeshesByDet.TILE, showTile, PAL_TILE_COLOR[0]);
  sweep(cellMeshesByDet.LAR, showLAr, PAL_LAR_COLOR[0]);
  sweep(cellMeshesByDet.HEC, showHec, PAL_HEC_COLOR[0]);
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
    const detOn = det === 'LAR' ? showLAr : det === 'HEC' ? showHec : showTile;
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
    const detOn = det === 'LAR' ? showLAr : det === 'HEC' ? showHec : showTile;
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
