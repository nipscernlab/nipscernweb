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
import { palColorFcal } from '../palette.js';
import { thrFcalMev } from './thresholds.js';
import { layerVis } from './layerVis.js';
import { getSlicer, getActiveClusterCellIds } from '../visibility.js';

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
}

function _applyFcalDraw() {
  const slicer = getSlicer();
  const slicerMask = slicer?.getMaskState() ?? { active: false };
  const activeClusterCellIds = getActiveClusterCellIds();
  // layerVis is a recursive bool/object tree; the dispatch here narrows by
  // hand to layerVis.fcal[1|2|3], but the typedef can't express that without
  // an index signature, so we read through `any`.
  const lv = /** @type {any} */ (layerVis);

  const visible = fcalCellsData.filter((c) => {
    // FCAL is filtered per-module instead of a single showFcal flag — module
    // 1=EM, 2=Had1, 3=Had2 (parser/src/lib.rs:694).
    if (!lv.fcal[c.module]) return false;
    if (!slicer?.isShowAllCells() && c.energy * 1000 < thrFcalMev) return false;
    if (
      !slicer?.isShowAllCells() &&
      activeClusterCellIds !== null &&
      c.id &&
      !activeClusterCellIds.has(c.id)
    )
      return false;
    // slicerMask.active implies slicer was non-null (default literal has
    // active:false); guard explicitly for the type-checker.
    if (slicerMask.active && slicer) {
      const cx = -c.x * 10,
        cy = -c.y * 10,
        cz = c.z * 10;
      if (slicer.isPointInsideWedge(cx, cy, cz, slicerMask)) return false;
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
