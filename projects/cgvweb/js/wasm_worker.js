// CGV Web — WASM parser Web Worker
// -----------------------------------------------------------------------------
// Offloads both the XML parsing and the per-event ATLAS ID bulk decode off the
// main thread so the UI stays 60fps even on huge events.
//
// Protocol (main -> worker):
//   { type: 'init' }
//       → { type: 'ready' }
//   { type: 'parse', rid, tile, lar, hec }
//       tile/lar/hec: whitespace-joined decimal ID strings (may be empty).
//       → { type: 'result', rid, tile, lar, hec }  (Int32Array | null each)
//   { type: 'parseXmlAndDecode', rid, xmlText }
//       → { type: 'parseXmlResult', rid, error? }
//         or { type: 'parseXmlResult', rid,
//              eventInfo, tileCells, larCells, hecCells, mbtsCells, fcalCells,
//              tracks, photons, clusters, clusterCollections,
//              tilePacked, larPacked, hecPacked }
//         tilePacked/larPacked/hecPacked: Int32Array (transferred zero-copy) | null
//         tracks[i].pts: [{x,y,z}] plain objects (no THREE.Vector3)

import wasmInit, { parse_atlas_ids_bulk, parse_jivexml } from '../parser/pkg/atlas_id_parser.js';

let _ready = false;
let _readyPromise = null;

async function ensureReady() {
  if (_ready) return;
  if (!_readyPromise) _readyPromise = wasmInit().then(() => { _ready = true; });
  await _readyPromise;
}

function runBulk(idStr) {
  if (!idStr || !idStr.length) return null;
  const packed = parse_atlas_ids_bulk(idStr);
  return packed instanceof Int32Array ? packed : new Int32Array(packed);
}

// ── XML parser functions (worker-side, no THREE.js dependency) ────────────────

function extractCells(doc, tagName) {
  const els = doc.getElementsByTagName(tagName);
  const cells = [];
  for (const el of els) {
    let n = 0;
    for (const ch of el.children) {
      const id = ch.getAttribute('id') ?? ch.getAttribute('cellID');
      const ev = ch.getAttribute('energy') ?? ch.getAttribute('e');
      if (id && ev) { const e = parseFloat(ev); if (isFinite(e)) { cells.push({ id: id.trim(), energy: e }); n++; } }
    }
    if (n) continue;
    const idEl = el.querySelector('id, cellID');
    const eEl  = el.querySelector('energy, e');
    if (idEl && eEl) {
      const ids = idEl.textContent.trim().split(/\s+/);
      const ens = eEl.textContent.trim().split(/\s+/).map(Number);
      const m   = Math.min(ids.length, ens.length);
      for (let i = 0; i < m; i++) if (ids[i] && isFinite(ens[i])) cells.push({ id: ids[i], energy: ens[i] });
    }
  }
  return cells;
}

function parseEventInfo(doc) {
  const ev = doc.querySelector('Event');
  if (!ev) return null;
  return {
    runNumber:   ev.getAttribute('runNumber')   || '',
    eventNumber: ev.getAttribute('eventNumber') || '',
    lumiBlock:   ev.getAttribute('lumiBlock')   || '',
    dateTime:    ev.getAttribute('dateTime')    || '',
    version:     ev.getAttribute('version')     || '',
  };
}

const _FCAL_ETA_PARAMS = [[3.2, 0.025], [3.2, 0.05], [3.2, 0.1]];

function decodeFcalId(idStr) {
  const id     = BigInt(idStr);
  const beSign = Number((id >> 57n) & 1n) ? 1 : -1;
  const modRaw = Number((id >> 55n) & 3n);
  const etaIdx = Number((id >> 49n) & 63n);
  const phiIdx = Number((id >> 45n) & 15n);
  const [eta0, deta] = _FCAL_ETA_PARAMS[modRaw] ?? [3.2, 0.025];
  const eta = beSign * (eta0 + etaIdx * deta + deta / 2);
  const phi = (phiIdx + 0.5) * (2 * Math.PI / 16);
  return { module: modRaw + 1, etaIdx, phiIdx, eta, phi };
}

function parseFcal(doc) {
  const cells = [];
  for (const el of doc.getElementsByTagName('FCAL')) {
    const xEl  = el.querySelector('x');
    const yEl  = el.querySelector('y');
    const zEl  = el.querySelector('z');
    const dxEl = el.querySelector('dx');
    const dyEl = el.querySelector('dy');
    const dzEl = el.querySelector('dz');
    const eEl  = el.querySelector('energy');
    const idEl = el.querySelector('id');
    if (!xEl || !yEl || !zEl || !dxEl || !dyEl || !dzEl) continue;
    const xs  = xEl.textContent.trim().split(/\s+/).map(Number);
    const ys  = yEl.textContent.trim().split(/\s+/).map(Number);
    const zs  = zEl.textContent.trim().split(/\s+/).map(Number);
    const dxs = dxEl.textContent.trim().split(/\s+/).map(Number);
    const dys = dyEl.textContent.trim().split(/\s+/).map(Number);
    const dzs = dzEl.textContent.trim().split(/\s+/).map(Number);
    const ens = eEl  ? eEl.textContent.trim().split(/\s+/).map(Number) : [];
    const ids = idEl ? idEl.textContent.trim().split(/\s+/)            : [];
    const n = Math.min(xs.length, ys.length, zs.length, dxs.length, dys.length, dzs.length);
    for (let i = 0; i < n; i++) {
      if (!isFinite(xs[i]) || !isFinite(ys[i]) || !isFinite(zs[i])) continue;
      let module = 0, eta = 0, phi = 0, cellId = ids[i] ?? '';
      if (cellId) {
        try { const d = decodeFcalId(cellId); module = d.module; eta = d.eta; phi = d.phi; }
        catch { /* leave defaults */ }
      }
      cells.push({
        x: xs[i], y: ys[i], z: zs[i],
        dx: dxs[i] || 0, dy: dys[i] || 0, dz: dzs[i] || 0,
        energy: isFinite(ens[i]) ? ens[i] : 0,
        id: cellId, module, eta, phi,
      });
    }
  }
  return cells;
}

function parseMBTS(doc) {
  const cells = [];
  const els = doc.getElementsByTagName('MBTS');
  for (const el of els) {
    let n = 0;
    for (const ch of el.children) {
      const label = ch.getAttribute('label');
      const ev    = ch.getAttribute('energy') ?? ch.getAttribute('e');
      if (label && ev) { const e = parseFloat(ev); if (isFinite(e)) { cells.push({ label: label.trim(), energy: e }); n++; } }
    }
    if (n) continue;
    const lblEl = el.querySelector('label');
    const eEl   = el.querySelector('energy, e');
    if (lblEl && eEl) {
      const labels = lblEl.textContent.trim().split(/\s+/);
      const ens    = eEl.textContent.trim().split(/\s+/).map(Number);
      const m      = Math.min(labels.length, ens.length);
      for (let i = 0; i < m; i++) if (labels[i] && isFinite(ens[i])) cells.push({ label: labels[i], energy: ens[i] });
    }
  }
  return cells;
}

// Returns plain {x,y,z} point objects — main thread reconstructs THREE.Vector3.
function parseTracks(doc) {
  const tracks = [];
  for (const el of doc.getElementsByTagName('Track')) {
    const numPolyEl = el.querySelector('numPolyline');
    const pxEl      = el.querySelector('polylineX');
    const pyEl      = el.querySelector('polylineY');
    const pzEl      = el.querySelector('polylineZ');
    if (!numPolyEl || !pxEl || !pyEl || !pzEl) continue;
    const numPoly = numPolyEl.textContent.trim().split(/\s+/).map(Number);
    const xs      = pxEl.textContent.trim().split(/\s+/).map(Number);
    const ys      = pyEl.textContent.trim().split(/\s+/).map(Number);
    const zs      = pzEl.textContent.trim().split(/\s+/).map(Number);
    const ptEl    = el.querySelector('pt');
    const ptArr   = ptEl ? ptEl.textContent.trim().split(/\s+/).map(Number) : [];

    const numHitsEl  = el.querySelector('numHits');
    const hitsEl     = el.querySelector('hits');
    const numHitsArr = numHitsEl ? numHitsEl.textContent.trim().split(/\s+/).map(Number) : [];
    const allHitStrs = hitsEl    ? hitsEl.textContent.trim().split(/\s+/)                : [];

    const storeGateKey = el.getAttribute('storeGateKey') ?? '';
    let offset = 0, hitOffset = 0;
    for (let i = 0; i < numPoly.length; i++) {
      const n  = numPoly[i];
      const nh = numHitsArr[i] ?? 0;
      const hitIds = allHitStrs.slice(hitOffset, hitOffset + nh);
      hitOffset += nh;
      if (n >= 2) {
        const pts = [];
        for (let j = 0; j < n; j++) {
          const k = offset + j;
          pts.push({ x: -xs[k] * 10, y: -ys[k] * 10, z: zs[k] * 10 });
        }
        const ptGev = i < ptArr.length ? Math.abs(ptArr[i]) : 0;
        tracks.push({ pts, ptGev, hitIds, storeGateKey });
      }
      offset += n;
    }
  }
  return tracks;
}

const _CELL_SUBDET_MAP = [2, 4, 5, 7, 10, 11, 12, 13];
const _CELL_PART_MAP   = [-3, -2, -1, 1, 2, 3, 4, 5];

function decodeCellSubdet(idStr) {
  const id     = BigInt(idStr);
  const sdIdx  = Number((id >> 61n) & 7n);
  const subdet = _CELL_SUBDET_MAP[sdIdx];
  if (subdet === 5) return 'TILE';
  if (subdet === 2) return 'TRACK';
  if (subdet === 4) {
    const ptIdx = Number((id >> 58n) & 7n);
    const part  = _CELL_PART_MAP[ptIdx] ?? 0;
    const absPart = Math.abs(part);
    if (absPart === 1) return 'LAR_EM';
    if (absPart === 2) return 'HEC';
    if (absPart === 3) return 'FCAL';
  }
  return 'OTHER';
}

// Returns { flat, collections } — does NOT set lastClusterData (main thread does it).
function parseClusters(doc) {
  const flat        = [];
  const collections = [];

  for (const el of doc.getElementsByTagName('Cluster')) {
    const key        = el.getAttribute('storeGateKey') ?? '';
    const etaEl      = el.querySelector('eta');
    const phiEl      = el.querySelector('phi');
    const etEl       = el.querySelector('et');
    const numCellsEl = el.querySelector('numCells');
    const cellsEl    = el.querySelector('cells');
    if (!etaEl || !phiEl) continue;

    const etas        = etaEl.textContent.trim().split(/\s+/).map(Number);
    const phis        = phiEl.textContent.trim().split(/\s+/).map(Number);
    const ets         = etEl       ? etEl.textContent.trim().split(/\s+/).map(Number) : [];
    const numCellsArr = numCellsEl ? numCellsEl.textContent.trim().split(/\s+/).map(Number) : [];
    const allCellStrs = cellsEl    ? cellsEl.textContent.trim().split(/\s+/)            : [];

    const m = Math.min(etas.length, phis.length);
    const collClusters = [];
    let offset = 0;
    for (let i = 0; i < m; i++) {
      const nc      = numCellsArr[i] ?? 0;
      const rawIds  = allCellStrs.slice(offset, offset + nc);
      offset += nc;
      if (!isFinite(etas[i]) || !isFinite(phis[i])) continue;

      const cells = { TILE: [], LAR_EM: [], HEC: [], FCAL: [], TRACK: [], OTHER: [] };
      for (const idStr of rawIds) {
        if (!idStr) continue;
        cells[decodeCellSubdet(idStr)].push(idStr);
      }

      const entry = { eta: etas[i], phi: phis[i], etGev: isFinite(ets[i]) ? ets[i] : 0, cells };
      collClusters.push(entry);
      flat.push({ ...entry, storeGateKey: key });
    }
    if (collClusters.length) collections.push({ key, clusters: collClusters });
  }

  return { flat, collections };
}

function parsePhotons(doc) {
  const result = [];
  for (const el of doc.getElementsByTagName('Photon')) {
    const etaEl    = el.querySelector('eta');
    const phiEl    = el.querySelector('phi');
    const energyEl = el.querySelector('energy');
    const ptEl     = el.querySelector('pt');
    if (!etaEl || !phiEl) continue;
    const etas     = etaEl.textContent.trim().split(/\s+/).map(Number);
    const phis     = phiEl.textContent.trim().split(/\s+/).map(Number);
    const energies = energyEl ? energyEl.textContent.trim().split(/\s+/).map(Number) : [];
    const pts      = ptEl     ? ptEl.textContent.trim().split(/\s+/).map(Number)     : [];
    const m = Math.min(etas.length, phis.length);
    for (let i = 0; i < m; i++) {
      if (!isFinite(etas[i]) || !isFinite(phis[i])) continue;
      result.push({
        eta: etas[i], phi: phis[i],
        energyGev: isFinite(energies[i]) ? energies[i] : 0,
        ptGev:     isFinite(pts[i])      ? pts[i]      : 0,
      });
    }
  }
  return result;
}

function idsToStr(cells) {
  const arr = new Array(cells.length);
  for (let i = 0; i < cells.length; i++) arr[i] = cells[i].id;
  return arr.join(' ');
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

    if (msg.type === 'parse') {
      await ensureReady();
      const { rid, tile, lar, hec } = msg;
      const tilePk = runBulk(tile);
      const larPk  = runBulk(lar);
      const hecPk  = runBulk(hec);

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

    if (msg.type === 'parseXmlAndDecode') {
      await ensureReady();
      const { rid, xmlText } = msg;
      // Delegate entirely to the Rust WASM parser — no DOMParser, no JS iteration.
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
