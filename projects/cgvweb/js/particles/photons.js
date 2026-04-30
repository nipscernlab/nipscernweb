// Photons drawn as Feynman-diagram wavy-line helices from the origin.
//
// The "spring" only spans the last 40 cm before the photon hits the inner
// calorimeter cylinder — the rest of the path is implicit (origin → calo
// face). The visible coil is what makes a γ recognisable at a glance against
// the straight tracks.

import * as THREE from 'three';
import { scene } from '../renderer.js';
import { getPhotonGroup, setPhotonGroup } from '../visibility.js';
import {
  _disposeGroup,
  _cylIntersect,
  CLUSTER_CYL_IN_R,
  CLUSTER_CYL_IN_HALF_H,
} from './_internal.js';

const PHOTON_MAT = new THREE.LineBasicMaterial({
  color: 0xffcc00,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
});

const PHOTON_PRE_INNER_MM = 400; // spring spans the last 40 cm of the photon path
const PHOTON_SPRING_R = 20; // helix radius in mm
const PHOTON_SPRING_TURNS_PER_MM = 0.014; // coils per mm of track length
const PHOTON_SPRING_PTS = 22; // points sampled per coil (smoothness)

function _makeSpringPoints(dx, dy, dz, totalLen, radius, nTurns, ptsPerTurn) {
  const fwd = new THREE.Vector3(dx, dy, dz).normalize();
  const ref = Math.abs(fwd.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(fwd, ref).normalize();
  const up = new THREE.Vector3().crossVectors(fwd, right).normalize();
  const startOffset = Math.max(0, totalLen - PHOTON_PRE_INNER_MM);
  const visibleLen = Math.max(0, totalLen - startOffset);
  const nTotal = nTurns * ptsPerTurn + 1;
  const pts = [];
  for (let i = 0; i < nTotal; i++) {
    const t = i / (nTotal - 1);
    const angle = t * nTurns * 2 * Math.PI;
    const along = startOffset + t * visibleLen;
    const cx = Math.cos(angle) * radius;
    const cy = Math.sin(angle) * radius;
    pts.push(
      new THREE.Vector3(
        fwd.x * along + right.x * cx + up.x * cy,
        fwd.y * along + right.y * cx + up.y * cy,
        fwd.z * along + right.z * cx + up.z * cy,
      ),
    );
  }
  return pts;
}

export function clearPhotons() {
  _disposeGroup(getPhotonGroup, setPhotonGroup);
}

export function drawPhotons(photons) {
  clearPhotons();
  if (!photons.length) return;
  const g = new THREE.Group();
  g.renderOrder = 7;
  for (const { eta, phi, ptGev } of photons) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const tEnd = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
    const nTurns = Math.round(PHOTON_SPRING_TURNS_PER_MM * Math.min(PHOTON_PRE_INNER_MM, tEnd));
    const pts = _makeSpringPoints(dx, dy, dz, tEnd, PHOTON_SPRING_R, nTurns, PHOTON_SPRING_PTS);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, PHOTON_MAT);
    line.userData.ptGev = ptGev;
    line.userData.eta = eta;
    line.userData.phi = phi;
    g.add(line);
  }
  scene.add(g);
  setPhotonGroup(g);
  // Same deferral as drawTracks — see comment there.
}
