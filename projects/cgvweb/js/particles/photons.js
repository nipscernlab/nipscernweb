// Photons drawn as Feynman-diagram wavy-line helices from the origin.
//
// The "spring" only spans the last 40 cm before the photon hits the inner
// calorimeter cylinder — the rest of the path is implicit (origin → calo
// face). The visible coil is what makes a γ recognisable at a glance against
// the straight tracks.

import * as THREE from 'three';
import { scene } from '../renderer.js';
import { getPhotonGroup, setPhotonGroup } from '../visibility.js';
import { _disposeGroup, _firstVisibleCellHit } from './_internal.js';

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

// Reusable scratch vectors so the per-photon spring computation doesn't
// allocate Vector3s into the GC every refresh.
const _fwd = new THREE.Vector3();
const _ref = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

// Writes the spring polyline into `out` (a Float32Array of length
// >= nTotal*3, where nTotal = nTurns*ptsPerTurn + 1). Same math as the
// previous Vector3-array version — see the TAPER_START block for why the
// last 15 % of t taper to zero radial offset (closes the spring onto the
// centerline endpoint so the visible tip lands exactly on the calo face).
function _fillSpringPoints(out, dx, dy, dz, totalLen, radius, nTurns, ptsPerTurn) {
  _fwd.set(dx, dy, dz).normalize();
  if (Math.abs(_fwd.x) < 0.9) _ref.set(1, 0, 0);
  else _ref.set(0, 1, 0);
  _right.crossVectors(_fwd, _ref).normalize();
  _up.crossVectors(_fwd, _right).normalize();
  const startOffset = Math.max(0, totalLen - PHOTON_PRE_INNER_MM);
  const visibleLen = Math.max(0, totalLen - startOffset);
  const nTotal = nTurns * ptsPerTurn + 1;
  const TAPER_START = 0.85;
  const fx = _fwd.x,
    fy = _fwd.y,
    fz = _fwd.z;
  const rx = _right.x,
    ry = _right.y,
    rz = _right.z;
  const ux = _up.x,
    uy = _up.y,
    uz = _up.z;
  const denom = nTotal - 1;
  for (let i = 0; i < nTotal; i++) {
    const t = i / denom;
    const angle = t * nTurns * 2 * Math.PI;
    const along = startOffset + t * visibleLen;
    const taper = t < TAPER_START ? 1 : 1 - (t - TAPER_START) / (1 - TAPER_START);
    const cx = Math.cos(angle) * radius * taper;
    const cy = Math.sin(angle) * radius * taper;
    const o = i * 3;
    out[o] = fx * along + rx * cx + ux * cy;
    out[o + 1] = fy * along + ry * cx + uy * cy;
    out[o + 2] = fz * along + rz * cx + uz * cy;
  }
  return nTotal;
}

// Cached photon list so refreshCaloBoundParticles (in particles.js) can
// re-run drawPhotons after a visibility change without re-parsing the XML.
let _lastPhotons = [];
export function getLastPhotons() {
  return _lastPhotons;
}

export function clearPhotons() {
  _lastPhotons = [];
  _disposeGroup(getPhotonGroup, setPhotonGroup);
}

// Convert a (dx,dy,dz) ray into spring geometry, returning the Float32Array
// of point coordinates. Used by drawPhotons (full build) and
// refreshPhotonsGeometry (in-place update via array reuse).
function _computeSpringFromRay(dx, dy, dz, out) {
  const tEnd = _firstVisibleCellHit(dx, dy, dz);
  const nTurns = Math.round(PHOTON_SPRING_TURNS_PER_MM * Math.min(PHOTON_PRE_INNER_MM, tEnd));
  const nTotal = nTurns * PHOTON_SPRING_PTS + 1;
  const arr = out && out.length >= nTotal * 3 ? out : new Float32Array(nTotal * 3);
  _fillSpringPoints(arr, dx, dy, dz, tEnd, PHOTON_SPRING_R, nTurns, PHOTON_SPRING_PTS);
  return { arr, nTotal };
}

export function drawPhotons(photons) {
  clearPhotons();
  _lastPhotons = Array.isArray(photons) ? photons : [];
  if (!_lastPhotons.length) return;
  const g = new THREE.Group();
  g.renderOrder = 7;
  for (const { eta, phi, ptGev } of _lastPhotons) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const { arr } = _computeSpringFromRay(dx, dy, dz);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
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

// Visibility-driven refresh: re-runs _firstVisibleCellHit per existing line
// and rewrites its position attribute in place. Avoids the dispose / new
// Group / new Line / new BufferGeometry chain of drawPhotons (~10–30 ms for
// 28 springs of 133 vertices each). nTurns can change with tEnd, so the
// point count may shift — we re-allocate only when that happens.
export function refreshPhotonsGeometry() {
  const g = getPhotonGroup();
  if (!g) return;
  for (const line of g.children) {
    const { eta, phi } = line.userData;
    if (eta == null || phi == null) continue;
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const posAttr = line.geometry.getAttribute('position');
    const { arr, nTotal } = _computeSpringFromRay(dx, dy, dz, posAttr ? posAttr.array : null);
    if (!posAttr || posAttr.array !== arr || posAttr.count !== nTotal) {
      // Point count changed (or no attribute yet) — rebind the attribute.
      line.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    } else {
      posAttr.needsUpdate = true;
    }
    line.geometry.computeBoundingSphere();
  }
}
