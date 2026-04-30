// Hadronic τ candidates: η/φ purple-dashed lines + per-daughter-track τ
// labels. Two render groups owned by this module:
//   - tauGroup       : the η/φ lines (one per τ candidate)
//   - tauLabelGroup  : the τ⁻ / τ⁺ / τ sprites anchored on matched daughter
//                      tracks. For 3-prong taus the daughters have separated
//                      by the calo face, so 3 close-but-readable τ symbols.
//
// τ candidates often share direction with a real jet (overlap removal isn't
// perfect); the purple dashed line + purple symbol distinguish from the jet's
// orange. The matched daughter tracks themselves are coloured purple by
// recomputeTauTrackMatch's _applyTrackMaterials priority chain, but only if
// no higher-priority match (electron / muon / jet) claims them first.

import * as THREE from 'three';
import {
  getTauGroup,
  setTauGroup,
  getTauLabelGroup,
  setTauLabelGroup,
  applyTauPtThreshold,
} from '../visibility.js';
import { recomputeTauTrackMatch } from '../trackMatch.js';
import { getViewLevel } from '../viewLevel.js';
import { makeLabelSprite } from '../labelSprite.js';
import { tauSymbolFromCharge } from '../particleSymbols.js';
import { _disposeGroup, _buildEtaPhiLineGroup, _buildAnchoredLabelGroup } from './_internal.js';

const TAU_MAT = new THREE.LineDashedMaterial({
  color: 0xb366ff,
  transparent: true,
  opacity: 0.85,
  dashSize: 40,
  gapSize: 60,
  depthWrite: false,
});

// τ label colour matches TAU_MAT and TRACK_TAU_MAT — same purple the daughter
// track is already painted in, so the eye links the floating label with the
// line it labels.
const TAU_LABEL_COLOR = 0xb366ff;

// Cached tau list so the level gate can re-run the track match on re-entry to L3.
let _lastTaus = [];
export function getLastTaus() {
  return _lastTaus;
}

export function clearTaus() {
  _lastTaus = [];
  _disposeGroup(getTauGroup, setTauGroup);
  _disposeGroup(getTauLabelGroup, setTauLabelGroup);
}

// Draws one line per tau candidate. `taus` is the flat array out of
// tauParser. Stamps tooltip-relevant fields on each line's userData and runs
// the track-match sync so the τ's associated tracks pick up the purple colour.
export function drawTaus(taus) {
  clearTaus();
  _lastTaus = Array.isArray(taus) ? taus : [];
  _buildEtaPhiLineGroup({
    items: _lastTaus,
    mat: TAU_MAT,
    mapToUserData: (t) => ({
      ptGev: t.ptGev,
      eta: t.eta,
      phi: t.phi,
      isTau: t.isTau,
      numTracks: t.numTracks,
      // Daughter-charge sum from <TauJet><charge>; ±1 = physically possible
      // τ, anything else = "unmatched" candidate that the K-popover gate can
      // strip from the view (see applyTauPtThreshold's unmatched filter).
      charge: t.charge,
      storeGateKey: t.key,
    }),
    setter: setTauGroup,
  });
  // Honour the L3 ET slider on first draw — without this every τ would
  // render until the user nudges the slider.
  applyTauPtThreshold();
  syncTauTrackMatch(getViewLevel() === 3 && _lastTaus.length ? _lastTaus : null);
  // τ labels: one sprite per matched daughter track, anchored at the calo
  // face (last polyline point) — for 3-prong taus the daughters have
  // separated by then, so 3 close-but-readable τ symbols. The build pass
  // can't filter by priority — drawTaus runs before recomputeJetTrackMatch,
  // so isJetMatched is still stale here. syncParticleLabelVisibility runs
  // later (post applyJetThreshold) and hides τ sprites whose anchor was
  // claimed by a higher-priority match.
  _buildAnchoredLabelGroup({
    predicate: (line) => !!line.userData.isTauMatched,
    anchorIdx: (count) => count - 1,
    makeSprite: (line) => {
      const c = line.userData.matchedTauCharge;
      const sprite = makeLabelSprite(tauSymbolFromCharge(c), TAU_LABEL_COLOR);
      sprite.userData.tauCharge = c;
      sprite.userData.isParticleLabel = true;
      return sprite;
    },
    setter: setTauLabelGroup,
  });
}

// Single entry point for the τ→track colour update. Called by drawTaus on
// load and by the visibility level gate when entering / leaving L3.
export function syncTauTrackMatch(taus) {
  recomputeTauTrackMatch(taus);
}
