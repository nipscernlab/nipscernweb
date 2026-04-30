// Parses <RVx> blocks from JiveXML.
//
// JiveXML publishes:
//   PrimaryVertices_xAOD          — full list with vertexType {1, 3, 0}
//   BTagging_*SecVtx_xAOD         — per-algo secondary vertices (b-tagging)
//
// vertexType in PrimaryVertices_xAOD:
//   1 → primary (the actual collision vertex of the event)
//   3 → pile-up (from concurrent collisions in the same bunch crossing)
//   0 → dummy / placeholder (always at the same coords as the PV; skip)
// In the BTagging blocks vertexType is 0 too but the meaning is different
// (secondary decay vertex from a b-hadron); they're distinguished by the
// storeGateKey.

import * as THREE from 'three';

// Convert XML coordinate (cm) to scene coords (mm) with x and y negated to
// match the existing track / hit convention.
function _toScene(xCm, yCm, zCm) {
  return new THREE.Vector3(-xCm * 10, -yCm * 10, zCm * 10);
}

function _readNums(body, tag) {
  const re = new RegExp(`<${tag}(?:\\s+multiple="[^"]+")?>([\\s\\S]*?)</${tag}>`);
  const m = body.match(re);
  if (!m) return null;
  const trimmed = m[1].trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).map(Number);
}

// Returns { primary, pileup, secondary } — each is an array of
// { position: Vector3, numTracks, key }.
//   primary[0]  — the event's primary vertex (highest-pT-sum collision).
//   pileup[]    — additional collisions from the same bunch crossing.
//   secondary[] — b-tagging-style displaced vertices, one per algorithm.
export function parseVertices(xmlText) {
  const out = { primary: [], pileup: [], secondary: [] };
  if (!xmlText) return out;
  const re = /<RVx\s+count="\d+"\s+storeGateKey="([^"]+)">([\s\S]*?)<\/RVx>/g;
  let m;
  while ((m = re.exec(xmlText)) !== null) {
    const key = m[1];
    const body = m[2];
    const xs = _readNums(body, 'x');
    const ys = _readNums(body, 'y');
    const zs = _readNums(body, 'z');
    const types = _readNums(body, 'vertexType');
    const ntrk = _readNums(body, 'numTracks');
    if (!xs || !ys || !zs) continue;
    const n = Math.min(xs.length, ys.length, zs.length);
    const isBTag = key.includes('SecVtx');
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(xs[i]) || !Number.isFinite(ys[i]) || !Number.isFinite(zs[i])) continue;
      const t = types?.[i] ?? 0;
      const v = {
        position: _toScene(xs[i], ys[i], zs[i]),
        numTracks: ntrk?.[i] | 0,
        key,
      };
      if (isBTag) {
        out.secondary.push(v);
      } else if (t === 1) {
        out.primary.push(v);
      } else if (t === 3) {
        out.pileup.push(v);
      }
      // type=0 in PrimaryVertices is the dummy placeholder — skipped.
    }
  }
  return out;
}
