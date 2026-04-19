// CGV Web — WASM parser Web Worker
// -----------------------------------------------------------------------------
// Offloads the per-event ATLAS ID bulk decode off the main thread so the UI
// stays 60fps even on huge events. All outputs are returned as transferable
// ArrayBuffers — the main thread receives them zero-copy via postMessage's
// transferList; no structured-clone payload allocation.
//
// Protocol (main -> worker):
//   { type: 'init' }                    — load WASM, reply { type: 'ready' }
//   { type: 'parse', rid, tile, lar, hec }
//       tile/lar/hec: whitespace-joined decimal ID strings (may be empty).
//
// Protocol (worker -> main):
//   { type: 'ready' }
//   { type: 'result', rid, tile, lar, hec }
//       tile/lar/hec: Int32Array (flat, 8 slots per cell) or null.
//   { type: 'error', rid, message }

import wasmInit, { parse_atlas_ids_bulk } from '../parser/pkg/atlas_id_parser.js';

let _ready = false;
let _readyPromise = null;

async function ensureReady() {
  if (_ready) return;
  if (!_readyPromise) _readyPromise = wasmInit().then(() => { _ready = true; });
  await _readyPromise;
}

function runBulk(idStr) {
  if (!idStr || !idStr.length) return null;
  // `parse_atlas_ids_bulk` returns an Int32Array-backed Uint8Array view from
  // wasm-bindgen; convert to a standalone Int32Array so its buffer is
  // transferable without interfering with wasm linear memory.
  const packed = parse_atlas_ids_bulk(idStr);
  // wasm-bindgen already gives us a fresh typed-array copy; return it as-is.
  // We return an Int32Array on a dedicated buffer suitable for transfer.
  return packed instanceof Int32Array
    ? packed
    : new Int32Array(packed);
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  try {
    if (msg.type === 'init') {
      await ensureReady();
      self.postMessage({ type: 'ready' });
      return;
    }
    if (msg.type === 'parse') {
      await ensureReady();
      const { rid, tile, lar, hec } = msg;
      const tilePk = runBulk(tile);
      const larPk  = runBulk(lar);
      const hecPk  = runBulk(hec);

      // Collect transfer list — transferring detaches the buffer here and
      // re-attaches on the receiver side zero-copy.
      const transfer = [];
      if (tilePk && tilePk.buffer) transfer.push(tilePk.buffer);
      if (larPk  && larPk.buffer)  transfer.push(larPk.buffer);
      if (hecPk  && hecPk.buffer)  transfer.push(hecPk.buffer);

      self.postMessage(
        { type: 'result', rid, tile: tilePk, lar: larPk, hec: hecPk },
        transfer
      );
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
