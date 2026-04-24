import * as THREE from 'three';

// ── WASM parser pool: runs entirely in a dedicated Web Worker ────────────────
// XML parse + bulk ID decode happen off-thread so the UI stays at 60 fps even
// on 47 MB events. If Web Workers are unavailable, init() rejects — there is
// no main-thread fallback.
class _WasmParserPool {
  constructor() {
    this._worker      = null;
    this._ready       = false;
    this._rid         = 0;
    this._pending     = new Map();
    this._initPromise = null;
  }
  init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      if (typeof Worker === 'undefined') throw new Error('Web Workers not supported');
      const w = new Worker(new URL('./wasm_worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (ev) => this._onMessage(ev);
      w.onerror   = (e) => { console.warn('[wasm worker] runtime error', e && e.message); };
      await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('wasm worker init timeout')), 20000);
        const onMsg = (ev) => {
          if (ev.data && ev.data.type === 'ready') {
            clearTimeout(to);
            w.removeEventListener('message', onMsg);
            resolve();
          }
        };
        w.addEventListener('message', onMsg);
        w.postMessage({ type: 'init' });
      });
      this._worker = w;
      this._ready  = true;
    })();
    return this._initPromise;
  }
  _onMessage(ev) {
    const m = ev.data;
    if (!m) return;
    if (m.type === 'ready') return;
    const pend = this._pending.get(m.rid);
    if (!pend) return;
    this._pending.delete(m.rid);
    if (m.type === 'error') pend.reject(new Error(m.message || 'wasm worker error'));
    else pend.resolve(m);
  }
  /** Parse XML + bulk-decode ATLAS IDs entirely in the worker. */
  parseXmlAndDecode(xmlText) {
    const rid = ++this._rid;
    return new Promise((resolve, reject) => {
      this._pending.set(rid, { resolve, reject });
      this._worker.postMessage({ type: 'parseXmlAndDecode', rid, xmlText });
    });
  }
}
export const _wasmPool = new _WasmParserPool();

// Subsystem codes returned by parse_atlas_ids_bulk (slot [0] of each 6-i32 record)
export const SUBSYS_TILE    = 1;
export const SUBSYS_LAR_EM  = 2;
export const SUBSYS_LAR_HEC = 3;

// ── Cell handle storage ──────────────────────────────────────────────────────
// Handles replace one-Mesh-per-cell. Each handle identifies one instance inside
// an InstancedMesh: { iMesh, instId, det, name, origMatrix, visible, _center? }
export const meshByKey       = new Map();            // int key -> handle
export const cellMeshesByDet = { TILE: [], LAR: [], HEC: [] };
export const active          = new Map();            // handle -> tooltip data; use .clear() to reset
export const rayTargets      = [];                   // InstancedMesh[]; use .length = 0 to reset

// ── InstancedMesh bookkeeping ────────────────────────────────────────────────
// Zero-determinant matrix collapses an instance to a point; degenerate
// triangles are rejected by both the rasterizer and the raycaster.
export const _ZERO_MAT4 = new THREE.Matrix4().set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0);
export const _dirtyIM   = new Set();

// Reusable temporaries for bounding-sphere computation (avoids per-frame GC).
const _bsMat = new THREE.Matrix4();
const _bsSph = new THREE.Sphere();

export function _markIMDirty(iMesh) { _dirtyIM.add(iMesh); }

export function _flushIMDirty() {
  for (const im of _dirtyIM) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    // Recompute bounding sphere skipping hidden instances.
    // Three.js's computeBoundingSphere applies _ZERO_MAT4, which yields an
    // Infinity/NaN center and poisons ray.intersectsSphere. Fix: skip any
    // instance where elements[15] === 0 (our zero-matrix sentinel).
    if (!im.geometry.boundingSphere) im.geometry.computeBoundingSphere();
    if (!im.boundingSphere) im.boundingSphere = new THREE.Sphere();
    im.boundingSphere.makeEmpty();
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, _bsMat);
      if (_bsMat.elements[15] === 0) continue;
      _bsSph.copy(im.geometry.boundingSphere).applyMatrix4(_bsMat);
      im.boundingSphere.union(_bsSph);
    }
    if (im.boundingSphere.isEmpty()) im.boundingSphere.set(new THREE.Vector3(), 0);
  }
  _dirtyIM.clear();
}

export const _allCellIMeshes = [];   // all cell InstancedMeshes, for bulk reset sweeps
export const _rayIMeshes     = new Set();

// ── Integer key encoding ─────────────────────────────────────────────────────
// Avoids string construction in the per-cell hot path.
// Bits [1:0] = detector tag: TILE=0b00, LAr EM=0b01, HEC=0b10
// TILE:   layer(5b<<2) | pn(1b<<7) | ieta(4b<<8) | module(6b<<12)
// LAr EM: (eb-1)(2b<<2) | sampling(2b<<4) | region(3b<<6) | pn(1b<<9) | eta(9b<<10) | phi(8b<<19)
// HEC:    group(2b<<2) | region(1b<<4) | pn(1b<<5) | eta(5b<<6) | phi(6b<<11)
export const _tileKey  = (layer, pn, ieta, mod) => (layer<<2)|(pn<<7)|(ieta<<8)|(mod<<12);
export const _larEmKey = (eb, sampling, region, pn, eta, phi) => 1|((eb-1)<<2)|(sampling<<4)|(region<<6)|(pn<<9)|(eta<<10)|(phi<<19);
export const _hecKey   = (group, region, pn, eta, phi) => 2|(group<<2)|(region<<4)|(pn<<5)|(eta<<6)|(phi<<11);
