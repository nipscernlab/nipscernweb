// Per-event track polylines.
//
// JiveXML emits multiple track collections that are alternative fits of the
// same physical particles (GSFTracks duplicates electrons; the four muon
// variants — MSOnlyExtrapolated / Extrapolated / MuonSpectrometer /
// CombinedMuon — cover the same muon at different stages of reconstruction).
// Rendering all of them produces visually overlapping lines. We pick two
// collections that show each particle in its most complete form:
//   CombinedInDetTracks  — every ID track (vertex → r ≈ 1 m).
//   CombinedMuonTracks   — combined fit for muons; polyline runs from the
//                          vertex out through the muon chambers (r ≈ 9.7 m),
//                          which makes the track-vs-muon-chamber raycast
//                          fire and turns the muon blue end-to-end.
// The muon's ID portion appears in both collections (r ≈ 0-1 m), but having
// the full muon trajectory drawn as one continuous line outweighs that
// duplication for the user.

import * as THREE from 'three';
import { scene } from '../renderer.js';
import { getTrackGroup, setTrackGroup } from '../visibility.js';
import { TRACK_MAT } from '../trackMaterials.js';
import { updateTrackAtlasIntersections } from '../trackAtlasIntersections.js';
import { _disposeGroup } from './_internal.js';

const _PRIMARY_TRACK_COLLECTIONS = new Set(['CombinedInDetTracks', 'CombinedMuonTracks']);

export function clearTracks() {
  _disposeGroup(getTrackGroup, setTrackGroup);
  updateTrackAtlasIntersections();
}

export function drawTracks(tracks) {
  clearTracks();
  if (!tracks.length) return;
  const g = new THREE.Group();
  g.renderOrder = 5;
  // Per-collection sequential index. JiveXML jets reference tracks via
  // (storeGateKey, trackIndex) where the index is the position within the
  // original Track block — matching that here lets jet→track highlighting
  // resolve `(InDetTrackParticles_xAOD, 39)` to a rendered line.
  const idxByKey = new Map();
  for (const { pts, ptGev, hitIds, storeGateKey } of tracks) {
    if (!_PRIMARY_TRACK_COLLECTIONS.has(storeGateKey)) continue;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, TRACK_MAT);
    line.userData.ptGev = ptGev;
    line.userData.hitIds = hitIds;
    line.userData.storeGateKey = storeGateKey;
    const idx = idxByKey.get(storeGateKey) ?? 0;
    idxByKey.set(storeGateKey, idx + 1);
    line.userData.indexInCollection = idx;
    // Geometric η/φ computed from origin → last polyline point. Tracks curve
    // in B-field so this is the angle at the calorimeter face, not at the
    // vertex; for high-pT tracks the difference is tiny. φ is reverted from
    // Three.js's negated convention back to ATLAS sign so it matches the
    // electron/photon η/φ in their XML form (used by ΔR matching).
    if (pts && pts.length) {
      const p = pts[pts.length - 1];
      const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      if (r > 1e-6) {
        const cosTheta = Math.max(-1, Math.min(1, p.z / r));
        const theta = Math.acos(cosTheta);
        line.userData.eta = -Math.log(Math.tan(theta / 2));
        line.userData.phi = Math.atan2(-p.y, -p.x);
      }
    }
    g.add(line);
  }
  scene.add(g);
  setTrackGroup(g); // stores ref + applies _tracksVisible
  // No applyTrackThreshold here — its filter stage needs every matchedXxx
  // flag set, and electrons/muons/taus/jets haven't been drawn yet. The
  // tail of processXml runs the full pipeline via applyJetThreshold once
  // every match flag is in place. See the pipeline doc above
  // applyTrackThreshold in visibility.js.
  updateTrackAtlasIntersections();
}
