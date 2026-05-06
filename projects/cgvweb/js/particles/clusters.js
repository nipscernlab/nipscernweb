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

// Cached cluster list so refreshCaloBoundParticles (in particles.js) can
// re-run drawClusters after a visibility change without re-parsing the XML.
let _lastClusters = [];
export function getLastClusters() {
  return _lastClusters;
}

export function clearClusters() {
  _lastClusters = [];
  _disposeGroup(getClusterGroup, setClusterGroup);
}

export function drawClusters(clusters) {
  clearClusters();
  _lastClusters = Array.isArray(clusters) ? clusters : [];
  _buildEtaPhiLineGroup({
    items: _lastClusters,
    mat: CLUSTER_MAT,
    mapToUserData: (c) => ({
      etGev: c.etGev,
      eta: c.eta,
      phi: c.phi,
      storeGateKey: c.storeGateKey ?? '',
    }),
    setter: setClusterGroup,
    // Cluster events routinely carry thousands of lines (most then hidden
    // by the ET threshold); per-cluster raycasting freezes slider drags.
    // Use the surface-based inner-face intersect — accurate to tens of mm,
    // invisible at the band scale (1.4–3.8 m radial).
    useCellRaycast: false,
  });
  applyClusterThreshold();
}
