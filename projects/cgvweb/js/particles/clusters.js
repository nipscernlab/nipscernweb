// Calorimeter clusters drawn as η/φ-direction dashed lines spanning the band
// between the inner-detector cylinder (r ≈ 1.42 m) and the outer cylinder
// (r ≈ 3.82 m) — the visual zone occupied by the calo.

import * as THREE from 'three';
import { getClusterGroup, setClusterGroup, applyClusterThreshold } from '../visibility.js';
import { _disposeGroup, _buildEtaPhiLineGroup } from './_internal.js';

// Lines are drawn from the inner cylinder out to the outer cylinder in the
// η/φ direction (5 m bridge). Coordinate convention matches tracks:
// Three.js X = −ATLAS x, Y = −ATLAS y.
const CLUSTER_MAT = new THREE.LineDashedMaterial({
  color: 0xff4400,
  transparent: true,
  opacity: 0.2,
  dashSize: 40,
  gapSize: 60,
  depthWrite: false,
});

export function clearClusters() {
  _disposeGroup(getClusterGroup, setClusterGroup);
}

export function drawClusters(clusters) {
  clearClusters();
  _buildEtaPhiLineGroup({
    items: clusters,
    mat: CLUSTER_MAT,
    mapToUserData: (c) => ({
      etGev: c.etGev,
      eta: c.eta,
      phi: c.phi,
      storeGateKey: c.storeGateKey ?? '',
    }),
    setter: setClusterGroup,
  });
  applyClusterThreshold();
}
