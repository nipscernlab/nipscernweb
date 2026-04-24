// CGV Web — WASM parser Web Worker
// -----------------------------------------------------------------------------
// Offloads the JiveXML parse + ATLAS ID bulk decode off the main thread so the
// UI stays at 60 fps even on 47 MB events.
//
// Protocol (main -> worker):
//   { type: 'init' }
//       → { type: 'ready' }
//   { type: 'parseXmlAndDecode', rid, xmlText }
//       → { type: 'parseXmlResult', rid, error? }
//         or { type: 'parseXmlResult', rid,
//              eventInfo, tileCells, larCells, hecCells, mbtsCells, fcalCells,
//              tracks, photons, clusters, clusterCollections,
//              tilePacked, larPacked, hecPacked }
//         tilePacked/larPacked/hecPacked: Int32Array (transferred zero-copy) | null
//         tracks[i].pts: [{x,y,z}] plain objects (no THREE.Vector3)

import wasmInit, { parse_jivexml } from '../parser/pkg/atlas_id_parser.js';

let _ready = false;
let _readyPromise = null;

async function ensureReady() {
  if (_ready) return;
  if (!_readyPromise)
    _readyPromise = wasmInit().then(() => {
      _ready = true;
    });
  await _readyPromise;
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  try {
    if (msg.type === 'init') {
      await ensureReady();
      self.postMessage({ type: 'ready' });
      return;
    }

    if (msg.type === 'parseXmlAndDecode') {
      await ensureReady();
      const { rid, xmlText } = msg;
      const result = parse_jivexml(xmlText);
      self.postMessage({ type: 'parseXmlResult', rid, ...result });
      return;
    }
  } catch (e) {
    self.postMessage({
      type: 'error',
      rid: msg && msg.rid,
      message: e && e.message ? e.message : String(e),
    });
  }
};
