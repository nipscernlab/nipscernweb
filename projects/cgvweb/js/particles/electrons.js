// Electron / positron labels.
//
// The matched track itself (red for e⁻, green for e⁺, set by
// recomputeElectronTrackMatch's _applyTrackMaterials) plays the role of
// the old colour-coded arrow. Only the floating "e⁻" / "e⁺" sprite remains,
// anchored ½-way down the matched track polyline so it lands inside the
// inner detector — away from the calorimeter face and the cell soup.
//
// Sprites are built ONCE in drawElectrons and survive until the next event
// load. Visibility flips (level gate, K-popover, J button, Track Labels) only
// touch the group's .visible / per-sprite .visible — never recreate the
// sprites.

import { getElectronGroup, setElectronGroup } from '../visibility.js';
import { recomputeElectronTrackMatch } from '../trackMatch.js';
import { getViewLevel } from '../viewLevel.js';
import { makeLabelSprite } from '../labelSprite.js';
import { leptonSymbol, isLeptonNegative } from '../particleSymbols.js';
import { _disposeGroup, _buildAnchoredLabelGroup } from './_internal.js';

const ELECTRON_NEG_COLOR = 0xff3030;
const ELECTRON_POS_COLOR = 0x33dd55;

// Last drawn electrons cached so view-level changes can re-run the
// ΔR matching against the current track set.
let _lastElectrons = [];
export function getLastElectrons() {
  return _lastElectrons;
}

// Full electron reset: drops the cached parser list and removes the label
// group. Called by resetScene before a new XML loads.
export function clearElectrons() {
  _lastElectrons = [];
  _disposeGroup(getElectronGroup, setElectronGroup);
}

export function drawElectrons(electrons) {
  clearElectrons();
  _lastElectrons = Array.isArray(electrons) ? electrons : [];
  if (!_lastElectrons.length) return;
  recomputeElectronTrackMatch(_lastElectrons);
  _buildAnchoredLabelGroup({
    // ½-way down the polyline — visually inside the inner detector, away from
    // the calorimeter face and the cell soup nearby.
    predicate: (line) => line.userData.matchedElectronPdgId != null,
    anchorIdx: (count) => Math.floor((count - 1) * 0.5),
    makeSprite: (line) => {
      const pdg = line.userData.matchedElectronPdgId;
      const sprite = makeLabelSprite(
        leptonSymbol('e', pdg),
        isLeptonNegative(pdg) ? ELECTRON_NEG_COLOR : ELECTRON_POS_COLOR,
      );
      sprite.userData.pdgId = pdg;
      sprite.userData.isParticleLabel = true;
      return sprite;
    },
    setter: setElectronGroup,
  });
  // The match also paints matched lines red / green via _applyTrackMaterials.
  // Outside L3 those colours would bleed into L1/L2 — clear them now (the
  // level gate restores them on entry to L3). Sprites already exist, hidden
  // via setElectronGroup's visibility predicate.
  if (getViewLevel() !== 3) recomputeElectronTrackMatch(null);
}

// Called by the level gate and applyTrackThreshold (visibility.js) when the
// visible track set changes. Re-runs the ΔR match so red/green track colours
// stay accurate. Does NOT touch label sprites — those were built once in
// drawElectrons. K-popover, J button, and level-gate toggles flip the group's
// .visible directly through the setters in detectorGroups.js.
export function syncElectronTrackMatch(electrons) {
  recomputeElectronTrackMatch(electrons);
}
