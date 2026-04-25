import * as THREE from 'three';
import { scene } from './renderer.js';
import {
  getTrackGroup,
  getPhotonGroup,
  getElectronGroup,
  getClusterGroup,
  setTrackGroup,
  setPhotonGroup,
  setElectronGroup,
  setClusterGroup,
  applyTrackThreshold,
  applyClusterThreshold,
} from './visibility.js';
import { TRACK_MAT, updateTrackAtlasIntersections } from './trackAtlasIntersections.js';

// ── Cluster line rendering ────────────────────────────────────────────────────
// Lines are drawn from the origin in the η/φ direction, 5 m = 5000 mm long.
// Coordinate convention matches tracks: Three.js X = −ATLAS x, Y = −ATLAS y.
const CLUSTER_MAT = new THREE.LineDashedMaterial({
  color: 0xff4400,
  transparent: true,
  opacity: 0.2,
  dashSize: 40,
  gapSize: 60,
  depthWrite: false,
});
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

// Electron / Positron arrows — solid cylinder shaft + cone head, outlined
// in black. Fixed total length (matches PHOTON_PRE_INNER_MM behaviour).
// Negative pdgId → electron (red), positive → positron (green). The "e-" /
// "e+" sprite at the tail is screen-space sized (constant pixel height).
const ELECTRON_NEG_COLOR = 0xff3030;
const ELECTRON_POS_COLOR = 0x33dd55;
const ELECTRON_FILL_NEG = new THREE.MeshBasicMaterial({ color: ELECTRON_NEG_COLOR });
const ELECTRON_FILL_POS = new THREE.MeshBasicMaterial({ color: ELECTRON_POS_COLOR });
const ELECTRON_OUTLINE_MAT = new THREE.LineBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.7,
});
const ELECTRON_LEN_MM = 400; // fixed total arrow length
const ELECTRON_HEAD_LEN_MM = 80;
const ELECTRON_SHAFT_R_MM = 6;
const ELECTRON_HEAD_R_MM = 16;
const ELECTRON_SEGMENTS = 8;
// Reusable resources (one per side: shaft + head share between all electrons).
const _SHAFT_GEO = new THREE.CylinderGeometry(
  ELECTRON_SHAFT_R_MM,
  ELECTRON_SHAFT_R_MM,
  ELECTRON_LEN_MM - ELECTRON_HEAD_LEN_MM,
  ELECTRON_SEGMENTS,
);
const _HEAD_GEO = new THREE.ConeGeometry(
  ELECTRON_HEAD_R_MM,
  ELECTRON_HEAD_LEN_MM,
  ELECTRON_SEGMENTS,
);
const _SHAFT_EDGES = new THREE.EdgesGeometry(_SHAFT_GEO);
const _HEAD_EDGES = new THREE.EdgesGeometry(_HEAD_GEO);
// Invisible fat cylinder covering the whole arrow span; this is what the
// hover raycast actually intersects so the user doesn't need pixel-perfect
// aim on the thin shaft.
const ELECTRON_HIT_R_MM = 60;
const _HIT_GEO = new THREE.CylinderGeometry(
  ELECTRON_HIT_R_MM,
  ELECTRON_HIT_R_MM,
  ELECTRON_LEN_MM,
  8,
);
const ELECTRON_HIT_MAT = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  depthTest: false,
});
// Sprite label sizing:
//   - far away (camera outside the detector): use a fixed world-units height
//     so the labels grow naturally on the screen as the user zooms in.
//   - close in (camera inside the outer cylinder): cap the on-screen height
//     so the labels stop dominating the view.
// The crossover happens automatically via min(worldH, screenH).
const ELECTRON_LABEL_WORLD_H_MM = 150;
const ELECTRON_LABEL_MAX_PX = 25;
const ELECTRON_LABEL_FWD_OFFSET_MM = 100; // along fwd, toward the tip
const ELECTRON_LABEL_RADIAL_OFFSET_MM = 80; // outward in the (x, y) plane
const _tmpVec2 = new THREE.Vector2();
const _Y_AXIS = new THREE.Vector3(0, 1, 0);

// Inner cylinder (start): r = 1.4 m, h = 6.4 m
const CLUSTER_CYL_IN_R = 1421.73;
const CLUSTER_CYL_IN_HALF_H = 3680.75;
// Outer cylinder (end):   r = 4.25 m, h = 12 m
const CLUSTER_CYL_OUT_R = 3820;
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
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
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
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, TRACK_MAT);
    line.userData.ptGev = ptGev;
    line.userData.hitIds = hitIds;
    line.userData.storeGateKey = storeGateKey;
    line.matrixAutoUpdate = false;
    g.add(line);
  }
  g.matrixAutoUpdate = false;
  scene.add(g);
  setTrackGroup(g); // stores ref + applies _tracksVisible
  applyTrackThreshold();
  updateTrackAtlasIntersections();
}

// ── Photons (Feynman-diagram wavy-line helix from the origin) ────────────────
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
  const g = getPhotonGroup();
  if (!g) return;
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
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
    g.add(line);
  }
  g.matrixAutoUpdate = false;
  scene.add(g);
  setPhotonGroup(g);
  applyTrackThreshold();
}

// ── Electrons / Positrons (arrow into the inner cylinder) ─────────────────────
// Builds the shaft (cylinder) and head (cone) meshes oriented along fwd,
// each with a black wireframe outline as a child, plus an invisible fat
// hit-area cylinder used for hover raycasting. Returns [shaft, head, hit].
function _makeArrowMeshes(dx, dy, dz, tEnd, fillMat) {
  const fwd = new THREE.Vector3(dx, dy, dz).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(_Y_AXIS, fwd);
  const tStart = Math.max(0, tEnd - ELECTRON_LEN_MM);
  const shaftLen = ELECTRON_LEN_MM - ELECTRON_HEAD_LEN_MM;

  const shaft = new THREE.Mesh(_SHAFT_GEO, fillMat);
  shaft.quaternion.copy(quat);
  shaft.position.copy(fwd).multiplyScalar(tStart + shaftLen / 2);
  shaft.add(new THREE.LineSegments(_SHAFT_EDGES, ELECTRON_OUTLINE_MAT));

  const head = new THREE.Mesh(_HEAD_GEO, fillMat);
  head.quaternion.copy(quat);
  head.position.copy(fwd).multiplyScalar(tStart + shaftLen + ELECTRON_HEAD_LEN_MM / 2);
  head.add(new THREE.LineSegments(_HEAD_EDGES, ELECTRON_OUTLINE_MAT));

  const hit = new THREE.Mesh(_HIT_GEO, ELECTRON_HIT_MAT);
  hit.quaternion.copy(quat);
  hit.position.copy(fwd).multiplyScalar(tStart + ELECTRON_LEN_MM / 2);
  hit.userData.isElectronHitArea = true;

  return [shaft, head, hit];
}

// Billboarded text sprite ("e-" or "e+") in the colour of the arrow.
// onBeforeRender keeps a constant on-screen pixel height regardless of zoom.
function _makeLabelSprite(text, hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `#${hexColor.toString(16).padStart(6, '0')}`;
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1, 0.5, 1); // overwritten in onBeforeRender
  sprite.onBeforeRender = function (renderer, _scene, camera) {
    renderer.getSize(_tmpVec2);
    const viewportH = _tmpVec2.y || 1;
    let worldHPerPx;
    if (camera.isPerspectiveCamera) {
      const dist = Math.max(0.001, camera.position.distanceTo(this.position));
      worldHPerPx = (2 * Math.tan((camera.fov * Math.PI) / 360) * dist) / viewportH;
    } else {
      const visH = Math.max(0.001, (camera.top - camera.bottom) / (camera.zoom || 1));
      worldHPerPx = visH / viewportH;
    }
    const screenCappedH = ELECTRON_LABEL_MAX_PX * worldHPerPx;
    const h = Math.min(ELECTRON_LABEL_WORLD_H_MM, screenCappedH);
    this.scale.set(h * 2, h, 1);
  };
  return sprite;
}

export function clearElectrons() {
  const g = getElectronGroup();
  if (!g) return;
  // Shaft / head / edges geometries are shared singletons — don't dispose.
  // Sprite labels each carry their own CanvasTexture, which we do free.
  g.traverse((o) => {
    if (o.isSprite && o.material?.map) o.material.map.dispose();
  });
  scene.remove(g);
  setElectronGroup(null);
}

export function drawElectrons(electrons) {
  clearElectrons();
  if (!electrons.length) return;
  const g = new THREE.Group();
  g.renderOrder = 7;
  for (const { eta, phi, ptGev, pdgId } of electrons) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const tEnd = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
    const isElectron = pdgId < 0;
    const fillMat = isElectron ? ELECTRON_FILL_NEG : ELECTRON_FILL_POS;
    const [shaft, head, hit] = _makeArrowMeshes(dx, dy, dz, tEnd, fillMat);
    shaft.userData.ptGev = ptGev;
    shaft.userData.pdgId = pdgId;
    head.userData.ptGev = ptGev;
    head.userData.pdgId = pdgId;
    hit.userData.ptGev = ptGev;
    hit.userData.pdgId = pdgId;
    g.add(shaft);
    g.add(head);
    g.add(hit);

    const tStart = Math.max(0, tEnd - ELECTRON_LEN_MM);
    const label = _makeLabelSprite(
      isElectron ? 'e-' : 'e+',
      isElectron ? ELECTRON_NEG_COLOR : ELECTRON_POS_COLOR,
    );
    // Tail position, then push fwd (toward the tip) and radially outward in
    // the (x, y) plane. Fallback to +X if the arrow is parallel to the beam.
    const baseX = dx * tStart;
    const baseY = dy * tStart;
    const baseZ = dz * tStart;
    const rLen = Math.hypot(baseX, baseY);
    const radX = rLen > 1e-6 ? baseX / rLen : 1;
    const radY = rLen > 1e-6 ? baseY / rLen : 0;
    label.position.set(
      baseX + dx * ELECTRON_LABEL_FWD_OFFSET_MM + radX * ELECTRON_LABEL_RADIAL_OFFSET_MM,
      baseY + dy * ELECTRON_LABEL_FWD_OFFSET_MM + radY * ELECTRON_LABEL_RADIAL_OFFSET_MM,
      baseZ + dz * ELECTRON_LABEL_FWD_OFFSET_MM,
    );
    label.userData.ptGev = ptGev;
    g.add(label);
  }
  g.matrixAutoUpdate = false;
  scene.add(g);
  setElectronGroup(g);
  applyTrackThreshold();
}

// ── Clusters (η/φ lines between inner and outer cylinders) ───────────────────
export function clearClusters() {
  const g = getClusterGroup();
  if (!g) return;
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
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
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const t0 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
    const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
    const start = new THREE.Vector3(dx * t0, dy * t0, dz * t0);
    const end = new THREE.Vector3(dx * t1, dy * t1, dz * t1);
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, CLUSTER_MAT);
    line.computeLineDistances();
    line.userData.etGev = etGev;
    line.userData.storeGateKey = storeGateKey ?? '';
    line.matrixAutoUpdate = false;
    g.add(line);
  }
  g.matrixAutoUpdate = false;
  scene.add(g);
  setClusterGroup(g);
  applyClusterThreshold();
}
