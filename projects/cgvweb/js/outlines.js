import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';
import {
  fcalGroup, fcalEdgeMat4, getFcalEdgeBase, visHandles,
} from './visibility.js';

// ── EdgesGeometry outline (hover) ─────────────────────────────────────────────
const eGeoCache  = new Map();
const outlineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
let   outlineMesh = null;

export function clearOutline() {
  if (!outlineMesh) return;
  scene.remove(outlineMesh);
  outlineMesh = null;
  markDirty();
}

export function showOutline(h) {
  if (outlineMesh?.userData.src === h.name) return;
  clearOutline();
  const geo = h.iMesh.geometry;
  const uid = geo.uuid;
  if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(geo, 30));
  outlineMesh = new THREE.LineSegments(eGeoCache.get(uid), outlineMat);
  outlineMesh.matrixAutoUpdate = false;
  outlineMesh.matrix.copy(h.origMatrix);
  outlineMesh.matrixWorld.copy(h.origMatrix);
  outlineMesh.renderOrder = 999;
  outlineMesh.userData.src = h.name;
  scene.add(outlineMesh);
  markDirty();
}

// Show hover outline (white) for a specific FCAL InstancedMesh instance.
// Mirrors showOutline but transforms the shared cylinder edge base by the instance matrix.
export function showFcalOutline(instanceId) {
  const src = 'fcal_' + instanceId;
  if (outlineMesh?.userData.src === src) return;
  clearOutline();
  const iMesh = fcalGroup?.children.find(c => c.isInstancedMesh);
  if (!iMesh) return;
  iMesh.getMatrixAt(instanceId, fcalEdgeMat4);
  const eb  = getFcalEdgeBase();
  const buf = new Float32Array(eb.length);
  const m   = fcalEdgeMat4.elements;
  for (let j = 0; j < eb.length; j += 3) {
    const lx = eb[j], ly = eb[j + 1], lz = eb[j + 2];
    buf[j]     = m[0]*lx + m[4]*ly + m[8]*lz  + m[12];
    buf[j + 1] = m[1]*lx + m[5]*ly + m[9]*lz  + m[13];
    buf[j + 2] = m[2]*lx + m[6]*ly + m[10]*lz + m[14];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
  outlineMesh = new THREE.LineSegments(geo, outlineMat);
  outlineMesh.matrixAutoUpdate = false;
  outlineMesh.renderOrder = 999;
  outlineMesh.userData.src = src;
  scene.add(outlineMesh);
  markDirty();
}

// ── All-cells outline (optimised: cached world-space edges per mesh) ─────────
const outlineAllMat = new THREE.LineBasicMaterial({ color: 0x000000 });
const _edgeWorldCache = new Map();  // handle.name → Float32Array (world-space positions)
let allOutlinesMesh = null;

function _getWorldEdges(h) {
  const cached = _edgeWorldCache.get(h.name);
  if (cached) return cached;
  const geo = h.iMesh.geometry;
  const uid = geo.uuid;
  if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(geo, 30));
  const src = eGeoCache.get(uid).getAttribute('position').array;
  const m = h.origMatrix.elements;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    out[i]     = m[0] * x + m[4] * y + m[8]  * z + m[12];
    out[i + 1] = m[1] * x + m[5] * y + m[9]  * z + m[13];
    out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  _edgeWorldCache.set(h.name, out);
  return out;
}

export function clearAllOutlines() {
  if (!allOutlinesMesh) return;
  scene.remove(allOutlinesMesh);
  allOutlinesMesh.geometry.dispose();
  allOutlinesMesh = null;
  markDirty();
}

export function rebuildAllOutlines() {
  clearAllOutlines();
  if (!visHandles.length) return;
  // Count total floats needed
  let total = 0;
  const edgeArrays = new Array(visHandles.length);
  for (let i = 0; i < visHandles.length; i++) {
    const arr = _getWorldEdges(visHandles[i]);
    edgeArrays[i] = arr;
    total += arr.length;
  }
  // Single allocation, memcpy each cached array
  const buf = new Float32Array(total);
  let offset = 0;
  for (let i = 0; i < edgeArrays.length; i++) {
    buf.set(edgeArrays[i], offset);
    offset += edgeArrays[i].length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
  allOutlinesMesh = new THREE.LineSegments(geo, outlineAllMat);
  allOutlinesMesh.matrixAutoUpdate = false;
  allOutlinesMesh.frustumCulled = false;
  allOutlinesMesh.renderOrder = 3;
  scene.add(allOutlinesMesh);
  markDirty();
}
