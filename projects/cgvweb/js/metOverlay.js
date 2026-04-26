// Missing-transverse-energy arrow.
//
// Drawn as an ArrowHelper in the (x, y) plane (z = 0), pointing in the
// direction of the MET vector. Coordinates negated to match the scene's
// convention (Three.js x = -ATLAS x, y = -ATLAS y) so it's visually consistent
// with the rendered tracks. Length scales linearly with magnitude, clamped to
// stay readable for both very low and very high MET events.

import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';
import { getMetGroup, setMetGroup } from './visibility.js';

// Hot pink — distinct from every other rendered colour (track yellow, jet
// orange, cluster red-orange, electron red/green, photon yellow, muon blue).
const MET_COLOR = 0xff0066;
// 50 mm per GeV: 10 GeV → 50 cm, 100 GeV → 5 m. Min/max keeps the arrow
// readable across the full physics range (a few GeV up to ~1 TeV).
const MET_SCALE_MM_PER_GEV = 50;
const MET_MIN_LEN_MM = 400;
const MET_MAX_LEN_MM = 6000;
// Arrowhead is rescaled per-frame so it stays at MET_HEAD_PX pixels tall on
// screen, no matter the zoom — it's a directional indicator, not a magnitude
// readout. MET_HEAD_W_RATIO controls how thick the cone looks (width /
// height); 0.5 reads as a chunky arrowhead, smaller values are sharper.
const MET_HEAD_PX = 10;
const MET_HEAD_W_RATIO = 0.5;
// Material singletons — one shaft material, one cone material per arrow is
// wasteful, but materials with depthTest:false need to be shared cleanly.
const _SHAFT_MAT = new THREE.LineBasicMaterial({
  color: MET_COLOR,
  linewidth: 3,
  depthTest: false,
  toneMapped: false,
});
const _CONE_MAT = new THREE.MeshBasicMaterial({
  color: MET_COLOR,
  depthTest: false,
  toneMapped: false,
});
// Cone with apex at +Y, base at origin — easy to position by setting position
// at the arrow's tip and pointing +Y along the arrow direction.
const _CONE_GEO = new THREE.ConeGeometry(0.5, 1, 12);
const _Y_AXIS = new THREE.Vector3(0, 1, 0);
const _tmpVec2 = new THREE.Vector2();

export function clearMet() {
  const g = getMetGroup();
  if (!g) return;
  g.traverse((o) => {
    // Skip the shared cone geometry; only the per-event shaft geometry needs
    // disposing (it's created fresh in drawMet).
    if (o.geometry && o.geometry !== _CONE_GEO) o.geometry.dispose();
  });
  scene.remove(g);
  setMetGroup(null);
}

// metInfo: { key, sumEt, etx, ety, magnitude } from metParser, or null/empty.
// Idempotent — safe to call with null (just clears the previous arrow).
//
// Built as a separate Line shaft (with real-length geometry, not a unit line
// scaled in y like ArrowHelper does) plus a Cone mesh at the tip. The custom
// shaft matters: Three.js's Line.raycast divides the threshold by the
// average of scale.x/y/z, so ArrowHelper's (1, length, 1) scale collapses
// the hit zone to ~1 mm and the user can't reasonably hover the line.
export function drawMet(metInfo) {
  clearMet();
  if (!metInfo) return;
  const { etx, ety, magnitude } = metInfo;
  if (!Number.isFinite(magnitude) || magnitude <= 0) return;
  // Convert ATLAS xy → scene xy (negated). Direction normalised below.
  const sx = -etx;
  const sy = -ety;
  const dirLen = Math.hypot(sx, sy);
  if (dirLen < 1e-9) return;
  const dx = sx / dirLen;
  const dy = sy / dirLen;
  const len = Math.max(MET_MIN_LEN_MM, Math.min(MET_MAX_LEN_MM, MET_SCALE_MM_PER_GEV * magnitude));

  // Shaft: real-length Line geometry from origin to tip. No scale → raycast
  // threshold lands as the user expects.
  const shaftGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(dx * len, dy * len, 0),
  ]);
  const shaft = new THREE.Line(shaftGeo, _SHAFT_MAT);
  shaft.renderOrder = 9;

  // Cone at the tip, oriented along the arrow direction. Per-frame
  // onBeforeRender resizes it to MET_HEAD_PX pixels tall on screen.
  const cone = new THREE.Mesh(_CONE_GEO, _CONE_MAT);
  cone.matrixAutoUpdate = false;
  cone.renderOrder = 9;
  const tipDir = new THREE.Vector3(dx, dy, 0);
  const tipQuat = new THREE.Quaternion().setFromUnitVectors(_Y_AXIS, tipDir);
  cone.onBeforeRender = function (renderer, _scene, camera) {
    renderer.getSize(_tmpVec2);
    const viewportH = _tmpVec2.y || 1;
    let worldUnitsPerPx;
    if (camera.isPerspectiveCamera) {
      const dist = Math.max(0.001, camera.position.distanceTo(cone.position));
      worldUnitsPerPx = (2 * Math.tan((camera.fov * Math.PI) / 360) * dist) / viewportH;
    } else {
      const visH = Math.max(0.001, (camera.top - camera.bottom) / (camera.zoom || 1));
      worldUnitsPerPx = visH / viewportH;
    }
    const headH = MET_HEAD_PX * worldUnitsPerPx;
    const headW = headH * MET_HEAD_W_RATIO;
    // Position the cone so its BASE sits at the shaft's tip; the cone's
    // geometry is centered (height 1, base at y=-0.5 → world headH/2 below
    // the position), so position = tip + headH/2 along the direction.
    const cx = dx * (len + headH * 0.5);
    const cy = dy * (len + headH * 0.5);
    cone.position.set(cx, cy, 0);
    cone.quaternion.copy(tipQuat);
    cone.scale.set(headW, headH, headW);
    cone.updateMatrix();
    cone.matrixWorld.multiplyMatrices(cone.parent.matrixWorld, cone.matrix);
  };

  // Stamp metadata on both so a hover on either reaches it via parent walk.
  shaft.userData.metKey = metInfo.key;
  shaft.userData.magnitude = magnitude;
  shaft.userData.sumEt = metInfo.sumEt;
  cone.userData.metKey = metInfo.key;
  cone.userData.magnitude = magnitude;
  cone.userData.sumEt = metInfo.sumEt;

  const g = new THREE.Group();
  g.renderOrder = 9;
  g.add(shaft);
  g.add(cone);
  scene.add(g);
  setMetGroup(g);
  markDirty();
}
