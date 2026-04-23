import * as THREE from 'three';

// ── WASM parser: off-main-thread worker with synchronous fallback ────────────
// Runs in a dedicated Web Worker so bulk ID decodes never block the render
// thread. Falls back to main-thread WASM if Worker is unavailable or crashes.
class _WasmParserPool {
  constructor() {
    this._worker      = null;
    this._ready       = false;
    this._rid         = 0;
    this._pending     = new Map();
    this._fallbackFn  = null;
    this._initPromise = null;
  }
  init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      if (typeof Worker !== 'undefined') {
        try {
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
          return;
        } catch (e) {
          console.warn('[wasm worker] unavailable, falling back to main-thread WASM:', e && e.message);
        }
      }
      await this._initFallback();
    })();
    return this._initPromise;
  }
  async _initFallback() {
    const mod = await import('../parser/pkg/atlas_id_parser.js');
    await mod.default();
    this._fallbackFn = mod.parse_atlas_ids_bulk;
    this._ready = true;
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
  /** Parse three whitespace-joined ID strings; any may be empty/null.
   *  Returns { tile, lar, hec } of Int32Array | null. */
  parse(tileStr, larStr, hecStr) {
    if (this._worker) {
      const rid = ++this._rid;
      return new Promise((resolve, reject) => {
        this._pending.set(rid, { resolve, reject });
        this._worker.postMessage({
          type: 'parse', rid,
          tile: tileStr || '', lar: larStr || '', hec: hecStr || '',
        });
      }).then(({ tile, lar, hec }) => ({ tile, lar, hec }));
    }
    const f = this._fallbackFn;
    return Promise.resolve({
      tile: tileStr && f ? f(tileStr) : null,
      lar:  larStr  && f ? f(larStr)  : null,
      hec:  hecStr  && f ? f(hecStr)  : null,
    });
  }
  /** Parse XML + bulk-decode ATLAS IDs entirely in the worker.
   *  Returns the full parseXmlResult, or null if no worker (caller must fall back). */
  parseXmlAndDecode(xmlText) {
    if (!this._worker) return Promise.resolve(null);
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
