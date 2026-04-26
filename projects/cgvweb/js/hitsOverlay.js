// Hover-driven hit overlay (inner detector + muon spectrometer).
//
// When the user mouses over a track line, this module looks up that track's
// hits (via line.userData.hitIds) in the maps populated by hitsParser, and
// renders one small marker sphere at each resolved hit position. Markers
// vanish as soon as the cursor leaves the track or the canvas.
//
// Three resolution paths per id:
//   • positions  — Pixel + SCT, exact (x, y, z) from the parser.
//   • trtParams  — TRT, polyline-interpolated at r (barrel) or z (endcap).
//   • chamberPos — muon chambers, kept only when within _CHAMBER_KEEP_MM
//                  of the polyline (otherwise it's a wire / chamber centre
//                  far from the actual track crossing).
//
// Costs are bounded — a CombinedInDetTracks line carries ~30 hits, a muon
// track ~25, so we just rebuild a fresh small Group per hover. No need for
// InstancedMesh.

import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';

// Solid white sphere — bright enough to read against any palette colour the
// underlying track might be painted with (yellow / orange / red / green).
// Per-frame onBeforeRender rescales the geometry so each hit has a constant
// HIT_TARGET_PX radius on screen regardless of camera distance — no growing
// blobs up close, no vanishing dots in long shots.
const HIT_BASE_RADIUS_MM = 8;
const HIT_TARGET_PX = 2;
const _HIT_GEO = new THREE.SphereGeometry(HIT_BASE_RADIUS_MM, 8, 6);
const _HIT_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.95,
  depthTest: false,
  depthWrite: false,
});

const _tmpVec2 = new THREE.Vector2();
function _hitOnBeforeRender(renderer, _scene, camera) {
  renderer.getSize(_tmpVec2);
  const viewportH = _tmpVec2.y || 1;
  let worldUnitsPerPx;
  if (camera.isPerspectiveCamera) {
    const dist = Math.max(0.001, camera.position.distanceTo(this.position));
    worldUnitsPerPx = (2 * Math.tan((camera.fov * Math.PI) / 360) * dist) / viewportH;
  } else {
    const visH = Math.max(0.001, (camera.top - camera.bottom) / (camera.zoom || 1));
    worldUnitsPerPx = visH / viewportH;
  }
  const targetWorldRadius = HIT_TARGET_PX * worldUnitsPerPx;
  this.scale.setScalar(targetWorldRadius / HIT_BASE_RADIUS_MM);
  // scene.updateMatrixWorld() already ran for this frame against the
  // previous scale — push the new scale into matrix and re-derive
  // matrixWorld so the upcoming draw call picks up the new size on the
  // SAME frame instead of the next. Without this, the first hover frame
  // pops in at the geometry's natural 8 mm and resizes on the next tick.
  this.updateMatrix();
  if (this.parent) {
    this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
  } else {
    this.matrixWorld.copy(this.matrix);
  }
}

let _positionsById = new Map();
let _trtById = new Map();
let _chamberById = new Map();
let _hitsGroup = null;
let _currentTrackLine = null;

// Called once per event by processXml after parseHits().
export function setHitPositions(parsed) {
  _positionsById = parsed && parsed.positions instanceof Map ? parsed.positions : new Map();
  _trtById = parsed && parsed.trtParams instanceof Map ? parsed.trtParams : new Map();
  _chamberById = parsed && parsed.chamberPos instanceof Map ? parsed.chamberPos : new Map();
}

// Drops any rendered markers AND the cached positions maps. Used by resetScene
// before a new XML loads.
export function clearHitsState() {
  hideTrackHits();
  _positionsById = new Map();
  _trtById = new Map();
  _chamberById = new Map();
}

// Smallest distance from `target` to the polyline (in scene mm). Used to
// filter muon hits: when JiveXML's (x,y,z) is the wire / chamber centre, it
// can land far from the track; we drop those. When it sits at the actual
// crossing (small chambers like RPC strips, or short barrel-MDT wires), the
// raw position already shows the natural measurement scatter, so we keep it.
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpAB = new THREE.Vector3();
const _tmpAT = new THREE.Vector3();
const _tmpProj = new THREE.Vector3();
function _distanceToPolyline(posAttr, target) {
  if (!posAttr || posAttr.count < 2) return Infinity;
  let bestDist2 = Infinity;
  for (let i = 0; i < posAttr.count - 1; i++) {
    _tmpA.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    _tmpB.set(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1));
    _tmpAB.subVectors(_tmpB, _tmpA);
    const len2 = _tmpAB.dot(_tmpAB);
    if (len2 < 1e-9) continue;
    _tmpAT.subVectors(target, _tmpA);
    const t = Math.max(0, Math.min(1, _tmpAT.dot(_tmpAB) / len2));
    _tmpProj.copy(_tmpA).addScaledVector(_tmpAB, t);
    const d2 = _tmpProj.distanceToSquared(target);
    if (d2 < bestDist2) bestDist2 = d2;
  }
  return Number.isFinite(bestDist2) ? Math.sqrt(bestDist2) : Infinity;
}

// Maximum distance (in scene mm) from a muon-chamber hit's raw position to
// the rendered track polyline before we treat it as "this is the chamber
// centre, not the actual hit" and drop it from the overlay.
const _CHAMBER_KEEP_MM = 300;

// Linear-interpolates the polyline at a target radius (barrel TRT) or target
// z (endcap TRT). Returns the (x, y, z) at the crossing, or null if the track
// doesn't reach the target.
//   `kind` is 'r' (barrel) or 'z' (endcap).
function _interpolatePolyline(posAttr, kind, target) {
  if (!posAttr || posAttr.count < 2) return null;
  const lastIdx = posAttr.count - 1;
  let prevX = posAttr.getX(0);
  let prevY = posAttr.getY(0);
  let prevZ = posAttr.getZ(0);
  let prevVal = kind === 'r' ? Math.hypot(prevX, prevY) : prevZ;
  for (let i = 1; i <= lastIdx; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const cur = kind === 'r' ? Math.hypot(x, y) : z;
    // Crossing in either direction.
    if ((prevVal <= target && cur >= target) || (prevVal >= target && cur <= target)) {
      const span = cur - prevVal;
      const t = Math.abs(span) > 1e-9 ? (target - prevVal) / span : 0;
      return new THREE.Vector3(
        prevX + (x - prevX) * t,
        prevY + (y - prevY) * t,
        prevZ + (z - prevZ) * t,
      );
    }
    prevX = x;
    prevY = y;
    prevZ = z;
    prevVal = cur;
  }
  return null;
}

export function hideTrackHits() {
  if (_hitsGroup) {
    _hitsGroup.traverse((o) => {
      if (o.geometry && o.geometry !== _HIT_GEO) o.geometry.dispose();
    });
    scene.remove(_hitsGroup);
    _hitsGroup = null;
    markDirty();
  }
  _currentTrackLine = null;
}

// Renders a sphere for each hit attached to `trackLine`:
//   • Pixel / SCT: position came pre-resolved from the parser.
//   • TRT: position is reconstructed by interpolating the track's polyline at
//     the straw's radius (barrel) or z (endcap) — the track itself encodes
//     where the straw was crossed, since it was fitted through these hits.
//   • Muon chambers (MDT, RPC, TGC, MM, STGC): kept at the raw (x, y, z)
//     when within _CHAMBER_KEEP_MM of the polyline (so realistic per-chamber
//     scatter shows), dropped when far (those would be wire / chamber
//     centres, off by metres for long MDT barrel wires).
// Re-uses the existing group when the same line is hovered again (no churn
// during raycast-driven re-fires).
export function showTrackHits(trackLine) {
  if (!trackLine) return;
  if (trackLine === _currentTrackLine) return;
  hideTrackHits();
  const ids = trackLine.userData?.hitIds;
  if (!Array.isArray(ids) || ids.length === 0) return;
  if (_positionsById.size === 0 && _trtById.size === 0 && _chamberById.size === 0) return;
  const posAttr = trackLine.geometry?.getAttribute('position');

  const g = new THREE.Group();
  g.renderOrder = 30;
  let added = 0;
  for (const id of ids) {
    let p = _positionsById.get(id);
    if (!p) {
      const trt = _trtById.get(id);
      if (trt && posAttr) {
        // sub 1, 2 → barrel (rhoz is r); sub 0, 3 → endcap (rhoz is z).
        const kind = trt.sub === 1 || trt.sub === 2 ? 'r' : 'z';
        p = _interpolatePolyline(posAttr, kind, trt.rhoz_mm);
      }
    }
    if (!p) {
      const cham = _chamberById.get(id);
      if (cham && posAttr) {
        // Keep the raw measurement position when it already sits on (or near)
        // the track — that gives the realistic small-scatter look of physical
        // hits. Drop it when it's a centre of a long wire / chamber that
        // landed metres off the trajectory.
        if (_distanceToPolyline(posAttr, cham) <= _CHAMBER_KEEP_MM) p = cham;
      }
    }
    if (!p) continue;
    const m = new THREE.Mesh(_HIT_GEO, _HIT_MAT);
    m.position.copy(p);
    m.onBeforeRender = _hitOnBeforeRender;
    g.add(m);
    added++;
  }
  if (!added) return;
  scene.add(g);
  _hitsGroup = g;
  _currentTrackLine = trackLine;
  markDirty();
}
