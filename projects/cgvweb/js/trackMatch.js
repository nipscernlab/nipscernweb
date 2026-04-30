// Per-particle "which track is which" passes.
//
// Four functions, one per particle class, each stamps a userData flag (and
// sometimes a sign / charge) on every line in trackGroup, then calls
// applyTrackMaterials so the priority chain repaints. Any of them can be
// re-run independently when its source state changes (jet collection /
// threshold, τ list, electron list, muon list).
//
// Two matching styles, kept distinct because the source XML publishes
// different links:
//   - Direct (key, index) lookup for jet→track and τ→track. JiveXML's
//     <Jet> / <TauJet> blocks carry explicit <trackKey> / <trackIndex>
//     pairs; the only translation is xAOD → AOD via XAOD_TO_AOD_TRACK_KEY.
//   - Heuristic ΔR for electron→track and muon→track. JiveXML doesn't
//     publish the egamma → track or muon → track link, so we approximate
//     by η/φ proximity. The thresholds differ (electron 0.05, muon 0.10)
//     and so do the eligible track collections (electrons restricted to
//     ID-only, muons to CombinedMuonTracks).

import { markDirty } from './renderer.js';
import { applyTrackMaterials, XAOD_TO_AOD_TRACK_KEY } from './trackMaterials.js';

// Late-injected accessor for the rendered track group. Set by initTrackMatch
// once the visibility module has booted (chicken-and-egg between this module
// and the group registration).
let _getTrackGroup = () => null;

/** @param {{ getTrackGroup: () => any }} deps */
export function initTrackMatch({ getTrackGroup }) {
  _getTrackGroup = getTrackGroup;
}

// ── Jet → track ──────────────────────────────────────────────────────────────
// Direct lookup. Recompute is cheap (single Set membership per line) so we
// re-run on every jet-collection or threshold change — handles the case where
// a jet just dropped below threshold and its tracks should revert to yellow.
//
// Independent of updateTrackAtlasIntersections (which can early-return before
// atlasRoot loads), so jet/track colour stays consistent even on the very
// first event before the atlas geometry is parsed.
/**
 * @param {{ jets: Array<{ etGev: number, tracks: Array<{ key: string, index: number }> }> } | null} activeJetCollection
 * @param {number} thrJetEtGev
 */
export function recomputeJetTrackMatch(activeJetCollection, thrJetEtGev) {
  const trackGroup = _getTrackGroup();
  if (!trackGroup) return;
  // Build the matched key set: "<aod_collection>#<index>".
  /** @type {Set<string>} */
  const matched = new Set();
  if (activeJetCollection) {
    for (const j of activeJetCollection.jets) {
      if (j.etGev < thrJetEtGev) continue;
      for (const t of j.tracks) {
        const aod = XAOD_TO_AOD_TRACK_KEY[t.key];
        if (!aod) continue;
        matched.add(`${aod}#${t.index}`);
      }
    }
  }
  for (const line of trackGroup.children) {
    const k = line.userData.storeGateKey;
    const i = line.userData.indexInCollection;
    line.userData.isJetMatched = k != null && i != null && matched.has(`${k}#${i}`);
  }
  applyTrackMaterials(trackGroup);
  markDirty();
}

// ── τ → track ────────────────────────────────────────────────────────────────
// Direct (key, index) lookup. Stamps `isTauMatched` plus `matchedTauCharge`
// so the τ-label sprite renderer can pick the right sign symbol (τ⁻ / τ⁺ /
// τ for unmatched). matchedTauCharge inherits from the parent τ — for a
// 3-prong all daughters get the τ's charge, even though individual π charges
// in a 3-prong sum to but don't equal the τ charge. The label means "this
// track belongs to a τ⁻", not "this single track has charge -1".
//
// Conflict rule: if the same track is daughter of two τ candidates (rare but
// possible), prefer the one with charge ±1 — keeps the "Unmatched Tau" gate
// from accidentally hiding a real-τ daughter just because some other junk
// candidate also claimed it.
/**
 * @param {Array<{ tracks: Array<{ key: string, index: number }>, charge?: number }> | null} taus
 */
export function recomputeTauTrackMatch(taus) {
  const trackGroup = _getTrackGroup();
  if (!trackGroup) return;
  /** @type {Map<string, number>} */
  const matched = new Map();
  if (taus && taus.length) {
    for (const t of taus) {
      for (const trk of t.tracks) {
        const aod = XAOD_TO_AOD_TRACK_KEY[trk.key];
        if (!aod) continue;
        const k = `${aod}#${trk.index}`;
        const existing = matched.get(k);
        if (existing === -1 || existing === 1) continue;
        matched.set(k, t.charge ?? 0);
      }
    }
  }
  for (const line of trackGroup.children) {
    const k = line.userData.storeGateKey;
    const i = line.userData.indexInCollection;
    const key = k != null && i != null ? `${k}#${i}` : null;
    const has = key != null && matched.has(key);
    line.userData.isTauMatched = has;
    line.userData.matchedTauCharge = has ? matched.get(key) : null;
  }
  applyTrackMaterials(trackGroup);
  markDirty();
}

// ── Electron → track (heuristic ΔR) ──────────────────────────────────────────
// Pre-matching filters:
//   • Electron pT ≥ 3 GeV: cuts out the very softest egamma candidates while
//     still catching most physics electrons.
//   • Track must be visible (passes the user's track pT slider): hidden soft
//     tracks won't steal the match from the real electron track.
//   • Track must come from the inner-detector-only collection: muons that
//     happen to fall close in η/φ to an egamma cluster (rare but not zero —
//     e.g. an EM cluster shadow next to a real muon) would otherwise grab
//     the slot, and CombinedMuonTracks polylines extend all the way to the
//     muon chambers, so colouring them red would visually suggest "electron
//     exiting through the muon system" — physically impossible.
const _ELECTRON_TRACK_DR_MAX = 0.05;
const _ELECTRON_PT_MIN_GEV = 3;
const _ELECTRON_TRACK_COLLECTION = 'CombinedInDetTracks';
/**
 * @param {Array<{ eta: number, phi: number, ptGev?: number, pdgId: number }> | null} electrons
 */
export function recomputeElectronTrackMatch(electrons) {
  const trackGroup = _getTrackGroup();
  if (!trackGroup) return;
  // Reset previous matches.
  for (const line of trackGroup.children) line.userData.matchedElectronPdgId = null;

  if (electrons && electrons.length) {
    for (const e of electrons) {
      if (!Number.isFinite(e.eta) || !Number.isFinite(e.phi)) continue;
      if (Number.isFinite(e.ptGev) && (e.ptGev ?? 0) < _ELECTRON_PT_MIN_GEV) continue;
      let best = null;
      let bestDR = _ELECTRON_TRACK_DR_MAX;
      for (const line of trackGroup.children) {
        // Only ID-only tracks are eligible — see comment block above.
        if (line.userData.storeGateKey !== _ELECTRON_TRACK_COLLECTION) continue;
        if (!line.visible) continue;
        const tEta = line.userData.eta;
        const tPhi = line.userData.phi;
        if (!Number.isFinite(tEta) || !Number.isFinite(tPhi)) continue;
        // Skip already-claimed tracks so two electrons can't grab the same one.
        if (line.userData.matchedElectronPdgId != null) continue;
        const dEta = e.eta - tEta;
        let dPhi = e.phi - tPhi;
        if (dPhi > Math.PI) dPhi -= 2 * Math.PI;
        else if (dPhi < -Math.PI) dPhi += 2 * Math.PI;
        const dR = Math.sqrt(dEta * dEta + dPhi * dPhi);
        if (dR < bestDR) {
          bestDR = dR;
          best = line;
        }
      }
      if (best) best.userData.matchedElectronPdgId = e.pdgId;
    }
  }
  applyTrackMaterials(trackGroup);
  markDirty();
}

// ── Muon → track ──────────────────────────────────────────────────────────────
// Two-phase ΔR matching against CombinedMuonTracks.
//
//   Phase 1 — count-match shortcut. If the number of <Muon> objects equals
//             the number of CombinedMuonTracks that geometrically reach the
//             muon spectrometer (isHitTrack=true), each muon must own one
//             of those tracks. Greedy matching with NO ΔR cap pairs every
//             muon to its closest unclaimed chamber-track; nothing is left
//             over. This is the common path — hadronic event with N muons
//             reconstructed = N CombinedMuonTracks extrapolated through the
//             toroid.
//   Phase 2 — fallback, only when counts disagree. ΔR-capped greedy across
//             all CombinedMuonTracks (the original heuristic), so the rare
//             case where the algorithm produced more tracks than muons (or
//             fewer) doesn't force a wrong 1:1 pairing.
//
// Why phase 1 matters: when two muons start close at the IP (low-mass μ⁺μ⁻
// pair, say a J/ψ), the toroid bends them in opposite directions and their
// endpoint η/φ at the chambers are 0.2-0.3 rad apart. The original ΔR cap
// of 0.1 was too tight to catch the second muon — its target track had
// drifted past the cap, and greedy iteration order let the first muon
// claim the wrong one. The count-match shortcut sidesteps the cap entirely
// when we know each muon owns a track.
//
// Anchor / collection rules apply to both phases:
//   • Match against CombinedMuonTracks only: those polylines run all the
//     way through the toroid to the muon chambers (~10 m). ID-only tracks
//     would also be close in η/φ but anchor the μ± label inside the ID.
//   • No pT pre-cut on the muon side — the collection is curated, even
//     low-pT muons are worth labelling.
const _MUON_TRACK_DR_MAX = 0.1;
const _MUON_TRACK_COLLECTION = 'CombinedMuonTracks';

function _muonTrackEligible(line) {
  if (line.userData.storeGateKey !== _MUON_TRACK_COLLECTION) return false;
  const u = line.userData;
  if (!Number.isFinite(u.eta) || !Number.isFinite(u.phi)) return false;
  return true;
}

/**
 * @param {{ eta: number, phi: number }} mu
 * @param {{ userData: { eta: number, phi: number } }} line
 */
function _dRMuonToTrack(mu, line) {
  const dEta = mu.eta - line.userData.eta;
  let dPhi = mu.phi - line.userData.phi;
  if (dPhi > Math.PI) dPhi -= 2 * Math.PI;
  else if (dPhi < -Math.PI) dPhi += 2 * Math.PI;
  return Math.sqrt(dEta * dEta + dPhi * dPhi);
}

/**
 * @param {Array<{ eta: number, phi: number, pdgId: number | null }> | null} muons
 */
export function recomputeMuonTrackMatch(muons) {
  const trackGroup = _getTrackGroup();
  if (!trackGroup) return;
  // Two flags: `isMuonMatched` is the binary "this track has a Muon attached"
  // signal, `matchedMuonPdgId` carries the sign when known. Splitting them
  // lets the renderer distinguish "no match" from "matched but charge-less"
  // (parser returns pdgId=null when the XML field is missing or zero).
  for (const line of trackGroup.children) {
    line.userData.isMuonMatched = false;
    line.userData.matchedMuonPdgId = null;
  }

  if (!muons || !muons.length) {
    applyTrackMaterials(trackGroup);
    markDirty();
    return;
  }

  const validMuons = muons.filter((m) => Number.isFinite(m.eta) && Number.isFinite(m.phi));
  if (!validMuons.length) {
    applyTrackMaterials(trackGroup);
    markDirty();
    return;
  }

  // Phase 1 candidates: chamber-passing CombinedMuonTracks.
  const chamberTracks = trackGroup.children.filter(
    (line) => _muonTrackEligible(line) && line.userData.isHitTrack,
  );

  // The matching loop, parametrised by candidate set + ΔR cap. Greedy
  // first-Muon-wins: each muon claims the closest unclaimed candidate; ties
  // are rare enough not to warrant Hungarian-style optimisation.
  const matchAgainst = (candidates, maxDR) => {
    for (const mu of validMuons) {
      let best = null;
      let bestDR = maxDR;
      for (const line of candidates) {
        if (line.userData.isMuonMatched) continue;
        const dR = _dRMuonToTrack(mu, line);
        if (dR < bestDR) {
          bestDR = dR;
          best = line;
        }
      }
      if (best) {
        best.userData.isMuonMatched = true;
        best.userData.matchedMuonPdgId = mu.pdgId;
      }
    }
  };

  if (chamberTracks.length === validMuons.length) {
    // Counts agree → trust the count, drop the cap. Each muon WILL pair
    // with one chamber-track (Infinity guarantees a match per iteration
    // until the candidate pool is exhausted).
    matchAgainst(chamberTracks, Infinity);
  } else {
    // Counts disagree → standard ΔR-capped greedy across every eligible
    // CombinedMuonTrack (chamber-passing or not — preserves old behaviour
    // for the malformed-XML case).
    const allMuonTracks = trackGroup.children.filter(_muonTrackEligible);
    matchAgainst(allMuonTracks, _MUON_TRACK_DR_MAX);
  }

  // Re-apply materials: muon match now sits in the priority chain *above*
  // jet and τ (a track that's both a muon and in a jet should read as a
  // muon, not a jet). The colour is still the same blue as TRACK_HIT_MAT —
  // muon tracks virtually always also pass through the chambers — but the
  // priority guarantees it wins over orange / purple when both apply.
  applyTrackMaterials(trackGroup);
  markDirty();
}
