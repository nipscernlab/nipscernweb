// Jet η/φ lines, same cylinder span as clusters but orange + dashed.
// Orange is reserved for jets so it doesn't collide with the muon-track blue;
// dashes mirror the cluster style and visually distinguish jets from tracks.

import * as THREE from 'three';
import { getJetGroup, setJetGroup, applyJetThreshold } from '../visibility.js';
import { _disposeGroup, _buildEtaPhiLineGroup } from './_internal.js';

const JET_MAT = new THREE.LineDashedMaterial({
  color: 0xff8800,
  transparent: true,
  opacity: 0.75,
  dashSize: 40,
  gapSize: 60,
  depthWrite: false,
});

export function clearJets() {
  _disposeGroup(getJetGroup, setJetGroup);
}

// Draws one line per jet in the given collection. `collection` is
// { key, jets: [...] } from jets.js (or null/empty). The collection key
// is stamped on each line so the hover tooltip can show it.
export function drawJets(collection) {
  clearJets();
  const jets = collection?.jets ?? [];
  // Always run applyJetThreshold so downstream effects (cell filter,
  // jet→track highlight) flush even when the collection is empty.
  if (jets.length) {
    const sgk = collection.key;
    _buildEtaPhiLineGroup({
      items: jets,
      mat: JET_MAT,
      mapToUserData: (j) => ({
        etGev: j.etGev,
        ptGev: j.ptGev,
        energyGev: j.energyGev,
        massGev: j.massGev,
        eta: j.eta,
        phi: j.phi,
        storeGateKey: sgk,
      }),
      setter: setJetGroup,
    });
  }
  applyJetThreshold();
}
