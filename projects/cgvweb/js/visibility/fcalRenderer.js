// @ts-check
// Forward calorimeter (FCAL) per-event rendering. Unlike the other detectors
// FCAL has no static GLB cell handles — each event's cells are rebuilt as a
// fresh InstancedMesh + outline LineSegments under fcalGroup.
//
// Three filters apply, all evaluated inside _applyFcalDraw:
//   1. layerVis.fcal[c.module]      (panel toggle per-module 1/2/3)
//   2. thrFcalMev                   (energy threshold slider)
//   3. activeClusterCellIds         (level-2/3 cluster/jet membership)
//   4. slicer wedge mask            (when the slicer is active)
//
// Slicer + cluster-filter state live in visibility.js because they are
// shared across the rest of the threshold pipeline; we read them via the
// getters exported from there. The circular import is safe — functions
// defined here only run after both modules finish loading.
import * as THREE from 'three';
import { scene, markDirty } from '../renderer.js';
import { palColorFcal, setPalMinFcal, setPalMaxFcal } from '../palette.js';
import { getCellMetric, etMevFromE } from '../cellMetric.js';
import { thrFcalMev } from './thresholds.js';
import { layerVis } from './layerVis.js';
import {
  FCAL_WIDTH_SCALE_DENOMINATOR,
  FCAL_WIDTH_SCALE_FIXED,
  FCAL_WIDTH_SCALE_GEOMETRY_KEY,
  FCAL_WIDTH_SCALE_IDS,
} from './fcalWidthScales.js';
import {
  getSlicer,
  getActiveClusterCellIds,
  inEtaPhiRegion,
  setFcalHeatmapEntries,
} from '../visibility.js';
import { refreshCaloBoundParticles } from '../particles.js';

/**
 * One FCAL cell as decoded by the WASM XML parser. `module` is 1=EM, 2=Had1,
 * 3=Had2 (parser/src/lib.rs:694). x/y/z + dx/dy/dz are in the JiveXML
 * coordinate frame (cm); the renderer multiplies by 10 and flips x/y to
 * scene-space mm.
 * @typedef {{
 *   id?: string|number,
 *   module: number,
 *   energy: number,
 *   x: number, y: number, z: number,
 *   dx: number, dy: number, dz: number,
 * }} FcalCell
 */

/** @type {FcalCell[]} */
let fcalCellsData = [];
/** @type {WeakMap<FcalCell, number>} */
let fcalWidthScale = new WeakMap();
/** @type {Map<string, number> | null} */
let fcalWidthScaleById = null;
/** @type {THREE.Group | null} */
export let fcalGroup = null;
/** @type {FcalCell[]} */
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

/** @type {Float32Array | null} — base unit-cylinder edge geometry, lazily built and cached */
let _fcalEdgeBase = null;
/** @returns {Float32Array} */
export function getFcalEdgeBase() {
  if (_fcalEdgeBase) return _fcalEdgeBase;
  const tmpGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const edgeGeo = new THREE.EdgesGeometry(tmpGeo, 30);
  tmpGeo.dispose();
  _fcalEdgeBase = /** @type {Float32Array} */ (edgeGeo.getAttribute('position').array.slice());
  edgeGeo.dispose();
  return _fcalEdgeBase;
}

/**
 * @param {number} hash
 * @param {string} s
 * @returns {number}
 */
function _fcalHashString(hash, s) {
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The FCAL geometry is event-stable for the built-in samples, while energies
 * vary. Hash only shape/placement fields so repeated events reuse the scale
 * table instead of recomputing pair intersections.
 * @param {FcalCell[]} cells
 * @returns {string}
 */
function _fcalGeometryKey(cells) {
  let hash = 2166136261;
  hash = _fcalHashString(hash, String(cells.length));
  for (const c of cells) {
    hash = _fcalHashString(hash, '|');
    hash = _fcalHashString(hash, String(c.id ?? ''));
    hash = _fcalHashString(hash, ',');
    hash = _fcalHashString(hash, String(c.x));
    hash = _fcalHashString(hash, ',');
    hash = _fcalHashString(hash, String(c.y));
    hash = _fcalHashString(hash, ',');
    hash = _fcalHashString(hash, String(c.z));
    hash = _fcalHashString(hash, ',');
    hash = _fcalHashString(hash, String(c.dx));
    hash = _fcalHashString(hash, ',');
    hash = _fcalHashString(hash, String(c.dy));
    hash = _fcalHashString(hash, ',');
    hash = _fcalHashString(hash, String(c.dz));
  }
  return `${cells.length}:${hash.toString(36)}`;
}

/** @returns {Map<string, number>} */
function _getFcalWidthScaleById() {
  if (fcalWidthScaleById) return fcalWidthScaleById;
  fcalWidthScaleById = new Map();
  for (let i = 0; i < FCAL_WIDTH_SCALE_IDS.length; i++) {
    fcalWidthScaleById.set(
      FCAL_WIDTH_SCALE_IDS[i],
      (FCAL_WIDTH_SCALE_FIXED[i] ?? FCAL_WIDTH_SCALE_DENOMINATOR) / FCAL_WIDTH_SCALE_DENOMINATOR,
    );
  }
  return fcalWidthScaleById;
}

/** @param {FcalCell[]} cells */
function _installFcalWidthScales(cells) {
  const key = _fcalGeometryKey(cells);
  const useTable =
    key === FCAL_WIDTH_SCALE_GEOMETRY_KEY && cells.length === FCAL_WIDTH_SCALE_FIXED.length;
  const scaleById = useTable ? null : _getFcalWidthScaleById();

  fcalWidthScale = new WeakMap();
  for (let i = 0; i < cells.length; i++) {
    const fixed = useTable ? FCAL_WIDTH_SCALE_FIXED[i] : undefined;
    const scale =
      fixed != null
        ? fixed / FCAL_WIDTH_SCALE_DENOMINATOR
        : (scaleById?.get(String(cells[i].id ?? '')) ?? 1);
    fcalWidthScale.set(cells[i], scale);
  }
}

export function clearFcal() {
  if (!fcalGroup) return;
  fcalGroup.traverse((o) => {
    // Mesh / LineSegments / etc. carry geometry+material; structural cast
    // because Object3D's base type doesn't expose them.
    const m = /** @type {any} */ (o);
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  });
  scene.remove(fcalGroup);
  fcalGroup = null;
}

/** @param {FcalCell[]} cells */
export function drawFcal(cells) {
  clearFcal();
  fcalCellsData = cells;
  if (!cells.length) return;
  _installFcalWidthScales(cells);
  _applyFcalDraw();
}

export function applyFcalThreshold() {
  if (!fcalCellsData.length) return;
  if (fcalGroup) {
    for (const child of [...fcalGroup.children]) {
      const m = /** @type {any} */ (child);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
      fcalGroup.remove(child);
    }
  }
  _applyFcalDraw();
  // FCAL visibility changed — re-run γ / cluster / jet / τ endpoints so
  // they don't end at FCAL cells that just got hidden (and pick up newly
  // shown ones). The flag inside refreshCaloBoundParticles prevents the
  // applyClusterThreshold → applyThreshold → applyFcalThreshold chain from
  // re-entering.
  refreshCaloBoundParticles();
}

// Re-derives the FCAL palette range for the current cell metric (E or E_T)
// over the loaded FCAL cells, sets the palette bounds, and returns [min,max]
// so the caller can refresh the FCAL threshold slider. Mirrors processXml's
// rangeMev(fcalCells, 0.5, 0.99) on signed energy, with eta-aware E_T support.
// Caller runs applyFcalThreshold afterwards to recolour with the new bounds.
/** @returns {[number, number]} */
export function computeFcalMetricRange() {
  const metric = getCellMetric();
  /** @type {number[]} */
  const vals = [];
  for (const c of fcalCellsData) {
    let v = c.energy * 1000;
    if (!isFinite(v)) continue;
    if (metric === 'ET') {
      const r = Math.hypot(c.x, c.y);
      const eta = -Math.log(Math.tan(Math.atan2(r, c.z) / 2));
      v = etMevFromE(v, eta);
    }
    vals.push(v);
  }
  if (!vals.length) {
    setPalMinFcal(0);
    setPalMaxFcal(1);
    return [0, 1];
  }
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor(0.5 * vals.length)] ?? vals[0];
  const hi = vals[Math.floor(0.99 * vals.length)] ?? vals[vals.length - 1];
  setPalMinFcal(lo);
  setPalMaxFcal(hi);
  return [lo, hi];
}

function _applyFcalDraw() {
  const slicer = getSlicer();
  const slicerMask = slicer?.getMaskState() ?? { active: false };
  const activeClusterCellIds = getActiveClusterCellIds();
  // layerVis is a recursive bool/object tree; the dispatch here narrows by
  // hand to layerVis.fcal[1|2|3], but the typedef can't express that without
  // an index signature, so we read through `any`.
  const lv = /** @type {any} */ (layerVis);

  // η/φ is computed per-cell below (from JiveXML x,y,z) and tested via the
  // shared inEtaPhiRegion helper — same union-of-rects logic as the other
  // detectors. No local region snapshot needed; inEtaPhiRegion reads the
  // current _etaPhiRegions array directly each call.

  // Heatmap entries are populated in parallel with the visibility filter.
  // They use a CONSISTENT filter set regardless of slicer state (module +
  // raw energy threshold + cluster filter) and ignore both the slicer wedge
  // and the minimap rect — see the matching comment in
  // visibility.js#_applySlicerMask for the rationale.
  /** @type {Array<{eta:number, phi:number, energyMev:number}>} */
  const heatmapEntries = [];

  // Threshold + heatmap compare against the active metric (E or E_T). E_T
  // needs the per-cell η, which is derived from the JiveXML geometry below.
  const metric = getCellMetric();

  const visible = fcalCellsData.filter((c) => {
    if (!lv.fcal[c.module]) return false;
    const eMev = Math.abs(c.energy * 1000);
    const inCluster = activeClusterCellIds === null || (c.id && activeClusterCellIds.has(c.id));
    const r = Math.hypot(c.x, c.y);
    const theta = Math.atan2(r, c.z);
    const eta = -Math.log(Math.tan(theta / 2));
    // φ is physics (ATLAS) φ — atan2 on the RAW x/y. The -x,-y below is the
    // scene-placement convention (scene = -ATLAS x/y, matches the GLB), NOT
    // a physics transform: applying it to φ too rotated the heatmap/region
    // gate by π. Keep the two separate. φ ∈ [-π, π].
    const phi = Math.atan2(c.y, c.x);
    const cellVal = metric === 'ET' ? etMevFromE(eMev, eta) : eMev;
    // Heatmap: module on + raw threshold + cluster membership. No slicer,
    // no rect — the minimap is a stable overview.
    if (cellVal >= thrFcalMev && inCluster) heatmapEntries.push({ eta, phi, energyMev: cellVal });

    // From here on: per-cell visibility for the 3D scene. Re-applies the
    // slicer's show-all-cells bypass for threshold + cluster, then the
    // slicer wedge and the rect.
    if (!slicer?.isShowAllCells() && cellVal < thrFcalMev) return false;
    if (
      !slicer?.isShowAllCells() &&
      activeClusterCellIds !== null &&
      c.id &&
      !activeClusterCellIds.has(c.id)
    )
      return false;
    if (slicerMask.active && slicer) {
      // Scene-space position (scene = -ATLAS x/y) — the wedge is defined in
      // scene coords, same as the GLB cells it tests against.
      const cx = -c.x * 10,
        cy = -c.y * 10,
        cz = c.z * 10;
      if (slicer.isPointInsideWedge(cx, cy, cz, slicerMask)) return false;
    }
    if (!inEtaPhiRegion(eta, phi)) return false;
    return true;
  });
  setFcalHeatmapEntries(heatmapEntries);
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
    const widthScale = fcalWidthScale.get(visible[i]) ?? 1;
    const rx = Math.max(Math.abs(dx) * 5 * widthScale, 1e-3);
    const ry = Math.max(Math.abs(dy) * 5 * widthScale, 1e-3);
    const len = Math.max(Math.abs(dz) * 2 * 10, 1e-3);
    // Scene placement: scene x/y = -ATLAS x/y (matches the GLB cells).
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
    // Colour uses the SIGNED metric value (palColorFcal's range is built on
    // signed energy — ATLAS FCAL cells run negative). E_T keeps the sign
    // since cosh(η) > 0.
    let colorVal = energy * 1000;
    if (metric === 'ET') {
      const cr = Math.hypot(x, y);
      const cEta = -Math.log(Math.tan(Math.atan2(cr, z) / 2));
      colorVal = etMevFromE(colorVal, cEta);
    }
    const [r, g, b] = palColorFcal(colorVal);
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
