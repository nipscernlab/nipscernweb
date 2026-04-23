import * as THREE from 'three';

// ── Shared XML cell extractor (operates on a pre-parsed Document) ─────────────
export function extractCells(doc, tagName) {
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

// ── Single-pass XML parse ─────────────────────────────────────────────────────
export function parseXmlDoc(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const pe  = doc.querySelector('parsererror');
  if (pe) throw new Error('XML parse error: ' + pe.textContent.slice(0, 120));
  return doc;
}

// ── Event metadata ────────────────────────────────────────────────────────────
export function parseEventInfo(doc) {
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

// ── Per-detector cell parsers ─────────────────────────────────────────────────
export function parseTile(doc) { return extractCells(doc, 'TILE'); }
export function parseLAr(doc)  { return extractCells(doc, 'LAr');  }
export function parseHec(doc)  { return extractCells(doc, 'HEC');  }

// ── MBTS parser ───────────────────────────────────────────────────────────────
export function parseMBTS(doc) {
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

// ── FCAL ID decoder ────────────────────────────────────────────────────────────
// Bit layout (MSB-first, from IdDictLArCalorimeter):
//   offset 64  3b subdet=4  |  61  3b part=±3(LArFCAL)  |  58  1b be
//   offset 57  2b module(0,1,2→FCAL1,2,3)  |  55  6b eta-fcal  |  49  4b phi-fcal
const _FCAL_ETA_PARAMS = [[3.2, 0.025], [3.2, 0.05], [3.2, 0.1]];

export function decodeFcalId(idStr) {
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

// ── FCAL parser ────────────────────────────────────────────────────────────────
// JiveXML stores cell centres (x,y,z) and half-extents (dx,dy,dz) in cm; energy in GeV.
export function parseFcal(doc) {
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

// ── Track polylines ───────────────────────────────────────────────────────────
// JiveXML stores coordinates in cm; Three.js scene uses mm → ×10.
export function parseTracks(doc) {
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
          pts.push(new THREE.Vector3(-xs[k] * 10, -ys[k] * 10, zs[k] * 10));
        }
        const ptGev = i < ptArr.length ? Math.abs(ptArr[i]) : 0;
        tracks.push({ pts, ptGev, hitIds, storeGateKey });
      }
      offset += n;
    }
  }
  return tracks;
}

// ── Photon parser ─────────────────────────────────────────────────────────────
export function parsePhotons(doc) {
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

// ── Cell-ID subdetector decoder ───────────────────────────────────────────────
// Bit layout (MSB-first, per ATLAS IdDict):
//   bits 63-61 (3 bits): subdet index → maps to [2,4,5,7,10,11,12,13]
//   bits 60-58 (3 bits, only when subdet=4): part index → maps to [-3,-2,-1,1,2,3,4,5]
//     |part|=1 → LAr EM,  |part|=2 → LAr HEC,  |part|=3 → FCAL
const _CELL_SUBDET_MAP = [2, 4, 5, 7, 10, 11, 12, 13];
const _CELL_PART_MAP   = [-3, -2, -1, 1, 2, 3, 4, 5];

export function decodeCellSubdet(idStr) {
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

// ── Cluster (eta/phi) parser ──────────────────────────────────────────────────
// Returns { flat, collections } where flat is [{eta,phi,etGev,cells,storeGateKey}]
// and collections is [{key, clusters:[...]}] — caller manages lastClusterData state.
export function parseClusters(doc) {
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
