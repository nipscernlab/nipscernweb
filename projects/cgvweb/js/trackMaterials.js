// @ts-check
// Track-line materials + the priority chain that picks one per line.
//
// This file owns:
//   - The 6 LineBasicMaterial constants every rendered track may switch to.
//   - The fixed xAOD → AOD storeGateKey bridge (tau / jet retrievers reference
//     tracks by xAOD names; the rendered polylines live under the AOD names).
//   - applyTrackMaterials(trackGroup): the single place that knows the
//     priority ordering between the per-line userData flags.
//
// Consumers (trackMatch.js for the recompute*Match functions, trackAtlas-
// Intersections.js for the chamber-hit pass) read each line's userData flags
// and then call applyTrackMaterials to repaint. Centralising the priority
// keeps "which colour wins when both apply?" in one diff-friendly place.

import * as THREE from 'three';
import { isLeptonNegative } from './particleSymbols.js';

// Default unmatched track colour. Exported because drawTracks initially
// assigns this to every Line (the recompute*Match passes restyle later).
export const TRACK_MAT = new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 2 });
const TRACK_HIT_MAT = new THREE.LineBasicMaterial({ color: 0x4a90d9, linewidth: 2 });
// Tracks belonging to a jet in the active jet collection: paint them in the
// jet's own colour (orange) so visually associating "this track came out of
// that jet" is immediate.
const TRACK_JET_MAT = new THREE.LineBasicMaterial({ color: 0xff8800, linewidth: 2 });
// Tracks attached to a hadronic τ candidate: purple, same hue as the τ line.
const TRACK_TAU_MAT = new THREE.LineBasicMaterial({ color: 0xb366ff, linewidth: 2 });
// Tracks matched to a reconstructed electron / positron by ΔR — coloured to
// match the electron arrow so the eye links the track with the e±.
const TRACK_ELECTRON_NEG_MAT = new THREE.LineBasicMaterial({ color: 0xff3030, linewidth: 2 });
const TRACK_ELECTRON_POS_MAT = new THREE.LineBasicMaterial({ color: 0x33dd55, linewidth: 2 });

// Maps the xAOD track-collection names that jets / taus reference to the
// legacy (old-AOD) collection names that JiveXML actually publishes the
// polylines under. By convention the two run parallel — element i of one
// matches element i of the other — which is the bridge for jet→track and
// τ→track highlighting. Only collections we actually render are listed;
// mappings for skipped ones (GSFTracks, MS-only-extrapolated, etc.) would
// never resolve to a line.
export const XAOD_TO_AOD_TRACK_KEY = {
  InDetTrackParticles_xAOD: 'CombinedInDetTracks',
  CombinedMuonTrackParticles_xAOD: 'CombinedMuonTracks',
};

// ── Muon classification helpers ─────────────────────────────────────────────
// A track carries up to two pieces of muon evidence on its userData:
//   isMuonMatched — recomputeMuonTrackMatch paired this track to a <Muon>
//                   object via ΔR (heuristic, since JiveXML doesn't link
//                   them explicitly).
//   isHitTrack    — updateTrackAtlasIntersections raycast the polyline
//                   against the spectrometer chamber meshes and got a hit.
// Real muon = both true (an identified <Muon> whose track also reaches the
// chambers). Unmatched μ = exactly one true (the heuristic missed, or the
// track stops in the calo before the spectrometer). Neither true = not a
// muon candidate at all. Centralising the two predicates keeps the priority
// chain, the label predicate, and the K-popover filter on the same page.

/** @param {{ userData: any }} line */
export function isRealMuon(line) {
  return !!line.userData.isMuonMatched && !!line.userData.isHitTrack;
}

/** @param {{ userData: any }} line — true iff one (and only one) muon flag set. */
export function isUnmatchedMuon(line) {
  return !!line.userData.isMuonMatched !== !!line.userData.isHitTrack;
}

/**
 * Applies the priority chain to every track line:
 *   electron / positron match (red / green) >
 *   real muon = matched + reaches chambers (blue) >
 *   jet-match (orange) > τ-match (purple) >
 *   unmatched muon = isMuonMatched XOR isHitTrack (blue, no label) >
 *   default (yellow).
 *
 * Rationale (top-down):
 *   1. Electron wins first — official lepton ID via ΔR against <Electron>.
 *   2. Real muon: BOTH a Muon-object match (ΔR to <Muon>) AND geometric
 *      chamber traversal. The track must actually reach the spectrometer
 *      to qualify; a matched track that ends inside the calo is treated
 *      as unmatched (likely the heuristic ΔR caught the wrong polyline).
 *   3. Jet beats τ: every <TauJet> in current JiveXML carries
 *      isTauString="xAOD_tauJet_withoutQuality" — they are the τ
 *      algorithm's input list, not τs that passed any ID. Jet is the more
 *      established object; both claiming the same track → paint as jet.
 *      (If a future XML exposes τ-with-quality we can promote τ here.)
 *   4. Unmatched muon: track has either a <Muon> match without chamber
 *      reach OR a chamber reach without <Muon> match — but not both. Sits
 *      below jet/τ because if the track is also a jet daughter, the jet
 *      identification is stronger. Painted blue (still "muon-like") with
 *      no label since the sign isn't reliable. Visibility gated by the
 *      K-popover Unmatched μ toggle (handled in applyParticleTrackFilters
 *      via .visible / particleHidden — this priority chain only chooses
 *      the colour when the line is rendered).
 *
 * Each source flag lives on userData; this loop is the single place that
 * knows about the priority ordering.
 *
 * @param {{ children: Array<{ userData: any, material: any }> }} trackGroup
 */
export function applyTrackMaterials(trackGroup) {
  for (const line of trackGroup.children) {
    const u = line.userData;
    if (u.matchedElectronPdgId != null) {
      line.material = isLeptonNegative(u.matchedElectronPdgId)
        ? TRACK_ELECTRON_NEG_MAT
        : TRACK_ELECTRON_POS_MAT;
    } else if (isRealMuon(line)) {
      line.material = TRACK_HIT_MAT;
    } else if (u.isJetMatched) {
      line.material = TRACK_JET_MAT;
    } else if (u.isTauMatched) {
      line.material = TRACK_TAU_MAT;
    } else if (isUnmatchedMuon(line)) {
      line.material = TRACK_HIT_MAT;
    } else {
      line.material = TRACK_MAT;
    }
  }
}
