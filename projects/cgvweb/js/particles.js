import * as THREE from 'three';
import { scene } from './renderer.js';
import {
  getTrackGroup, getPhotonGroup, getClusterGroup,
  setTrackGroup, setPhotonGroup, setClusterGroup,
  applyTrackThreshold, applyClusterThreshold,
} from './visibility.js';
import { TRACK_MAT, updateTrackAtlasIntersections } from './trackAtlasIntersections.js';

// ── Cluster line rendering ────────────────────────────────────────────────────
// Lines are drawn from the origin in the η/φ direction, 5 m = 5000 mm long.
// Coordinate convention matches tracks: Three.js X = −ATLAS x, Y = −ATLAS y.
const CLUSTER_MAT = new THREE.LineDashedMaterial({
  color: 0xff4400, transparent: true, opacity: 0.20,
  dashSize: 40, gapSize: 60, depthWrite: false,
});
const PHOTON_MAT = new THREE.LineBasicMaterial({
  color: 0xFFCC00, transparent: true, opacity: 0.85, depthWrite: false,
});

const PHOTON_PRE_INNER_MM        = 800;    // start the spring 80 cm before the inner LAr cylinder
const PHOTON_SPRING_R            = 20;     // helix radius in mm
const PHOTON_SPRING_TURNS_PER_MM = 0.014;  // coils per mm of track length
const PHOTON_SPRING_PTS          = 22;     // points sampled per coil (smoothness)

// Inner cylinder (start): r = 1.4 m, h = 6.4 m
const CLUSTER_CYL_IN_R      = 1421.730;
const CLUSTER_CYL_IN_HALF_H = 3680.75;
// Outer cylinder (end):   r = 4.25 m, h = 12 m
const CLUSTER_CYL_OUT_R      = 3820;
const CLUSTER_CYL_OUT_HALF_H = 6000;

// Returns t at which the unit-direction ray (dx,dy,dz) from the origin hits
// the surface of a cylinder with given radius and half-height.
function _cylIntersect(dx, dy, dz, r, halfH) {
  const rT = Math.sqrt(dx * dx + dy * dy);
  if (rT > 1e-9) {
    const tBarrel = r / rT;
    if (Math.abs(dz * tBarrel) <= halfH) return tBarrel;
  }
  return halfH / Math.abs(dz);
}

// ── Tracks ────────────────────────────────────────────────────────────────────
export function clearTracks() {
  const g = getTrackGroup();
  if (!g) return;
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(g);
  setTrackGroup(null);
  updateTrackAtlasIntersections();
}

export function drawTracks(tracks) {
  clearTracks();
  if (!tracks.length) return;
  const g = new THREE.Group();
  g.renderOrder = 5;
  for (const { pts, ptGev, hitIds, storeGateKey } of tracks) {
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, TRACK_MAT);
    line.userData.ptGev        = ptGev;
    line.userData.hitIds       = hitIds;
    line.userData.storeGateKey = storeGateKey;
    line.matrixAutoUpdate = false;
    g.add(line);
  }
  g.matrixAutoUpdate = false;
  scene.add(g);
  setTrackGroup(g);   // stores ref + applies _tracksVisible
  applyTrackThreshold();
  updateTrackAtlasIntersections();
}

// ── Photons (Feynman-diagram wavy-line helix from the origin) ────────────────
function _makeSpringPoints(dx, dy, dz, totalLen, radius, nTurns, ptsPerTurn) {
  const fwd = new THREE.Vector3(dx, dy, dz).normalize();
  const ref = Math.abs(fwd.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(fwd, ref).normalize();
  const up    = new THREE.Vector3().crossVectors(fwd, right).normalize();
  const startOffset = Math.max(0, totalLen - PHOTON_PRE_INNER_MM);
  const visibleLen  = Math.max(0, totalLen - startOffset);
  const nTotal = nTurns * ptsPerTurn + 1;
  const pts = [];
  for (let i = 0; i < nTotal; i++) {
    const t     = i / (nTotal - 1);
    const angle = t * nTurns * 2 * Math.PI;
    const along = startOffset + t * visibleLen;
    const cx    = Math.cos(angle) * radius;
    const cy    = Math.sin(angle) * radius;
    pts.push(new THREE.Vector3(
      fwd.x * along + right.x * cx + up.x * cy,
      fwd.y * along + right.y * cx + up.y * cy,
      fwd.z * along + right.z * cx + up.z * cy,
    ));
  }
  return pts;
}

export function clearPhotons() {
  const g = getPhotonGroup();
  if (!g) return;
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(g);
  setPhotonGroup(null);
}

export function drawPhotons(photons) {
  clearPhotons();
  if (!photons.length) return;
  const g = new THREE.Group();
  g.renderOrder = 7;
  for (const { eta, phi, ptGev } of photons) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT  = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz =  Math.cos(theta);
    const tEnd = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
    const nTurns = Math.round(PHOTON_SPRING_TURNS_PER_MM * Math.min(PHOTON_PRE_INNER_MM, tEnd));
    const pts  = _makeSpringPoints(dx, dy, dz, tEnd, PHOTON_SPRING_R, nTurns, PHOTON_SPRING_PTS);
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, PHOTON_MAT);
    line.userData.ptGev = ptGev;
    g.add(line);
  }
  g.matrixAutoUpdate = false;
  scene.add(g);
  setPhotonGroup(g);
  applyTrackThreshold();
}

// ── Clusters (η/φ lines between inner and outer cylinders) ───────────────────
export function clearClusters() {
  const g = getClusterGroup();
  if (!g) return;
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(g);
  setClusterGroup(null);
}

export function drawClusters(clusters) {
  clearClusters();
  if (!clusters.length) return;
  const g = new THREE.Group();
  g.renderOrder = 6;
  for (const { eta, phi, etGev, storeGateKey } of clusters) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT  = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz =  Math.cos(theta);
    const t0 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R,  CLUSTER_CYL_IN_HALF_H);
    const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
    const start = new THREE.Vector3(dx * t0, dy * t0, dz * t0);
    const end   = new THREE.Vector3(dx * t1, dy * t1, dz * t1);
    const geo  = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, CLUSTER_MAT);
    line.computeLineDistances();
    line.userData.etGev        = etGev;
    line.userData.storeGateKey = storeGateKey ?? '';
    line.matrixAutoUpdate = false;
    g.add(line);
  }
  g.matrixAutoUpdate = false;
  scene.add(g);
  setClusterGroup(g);
  applyClusterThreshold();
}
