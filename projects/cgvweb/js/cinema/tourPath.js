// Event-driven tour path for the cinema mode.
//
// The path is a closed orbit on the "safe envelope" cylinder (R_SAFE_MM,
// well outside the muon system at r ≈ 12 m). All control points live on
// this cylinder, so the camera never crosses calorimeter or muon-chamber
// cells during normal traversal. The Catmull-Rom interpolation between
// adjacent control points stays close to the cylinder thanks to centripetal
// parametrisation; the cylinder radius has enough margin (~2 m) to absorb
// the small inward bowing the curve introduces even with wide gaps.
//
// Each POI maps to one control point:
//   φ     → azimuth on the cylinder (camera φ matches POI φ)
//   η     → camera z (forward POIs lift the camera off the equator so it
//           overlooks the forward calo; smoothstep-shaped so the orbital
//           plane changes gracefully)
//
// The look-at curve aims at the inner-calo radius (r ≈ 2.5 m) in the POI
// direction so the camera "leans toward" each hotspot as it passes.
//
// Slicer / minimap filters: POIs whose 3D centre falls inside the slicer
// wedge (hidden by the user) are dropped; POIs outside the active minimap
// rectangles (user-defined area of interest) are dropped. Both produce
// an event-aware path that excludes regions the user has explicitly
// removed from the scene.

import * as THREE from 'three';

// ── Clustering / POI extraction ───────────────────────────────────────────────
// ATLAS jet cones are typically ΔR=0.4, so 0.5 keeps the POI set coarse
// enough that small fluctuations don't spawn duplicate waypoints.
const POI_DR = 0.5;
// Cap on waypoints. With ≥10 the closed Catmull-Rom starts dwelling on
// neighbours; fewer feels jumpy on dense events.
const MAX_POIS = 8;
// Floor below which a POI is dropped (fraction of the peak POI energy).
const MIN_POI_ENERGY_FRAC = 0.02;

// ── Safe-envelope cylinder ────────────────────────────────────────────────────
// Muon outer shell is at r ≈ 11–12 m / |z| ≤ 22 m. R_SAFE_MM at 14 m clears
// the muon outer with ~2 m of margin — enough headroom that Catmull-Rom's
// inward bow between wide-gap waypoints still doesn't dip into the chambers.
const R_SAFE_MM = 14000;
// Z amplitude of the camera path. Forward POIs (|η| ≳ 2) lift the camera
// to ±Z_AXIAL_MAX, where it still sits outside the muon endcap (which goes
// to r ≈ 12 m, |z| ≤ 22 m).
const Z_AXIAL_MAX = 15000;
// |η| at which the camera reaches the |z| = Z_AXIAL_MAX cap. tanh-shaped
// so the response is smooth all the way out.
const Z_ETA_SCALE = 2.0;
// Look-at: inner-calo radius — places the look-at point at the cluster /
// jet origin band, the most visually informative depth.
const TGT_R_MM = 2500;

/**
 * @typedef {{eta:number, phi:number, energyMev:number}} HeatEntry
 * @typedef {{eta:number, phi:number, energyMev:number}} POI
 * @typedef {{etaMin:number, etaMax:number, phiMin:number, phiMax:number}} Rect
 */

function _wrapDPhi(d) {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Maps an η/φ direction to a (camera, target) pair on the safe envelope.
 * Convention matches the rest of the codebase (track parser et al.):
 *   θ = 2·atan(exp(-η))
 *   inward direction: (-sin θ·cos φ, -sin θ·sin φ, cos θ)
 *
 * @param {number} eta
 * @param {number} phi
 */
function _poiToCameraPair(eta, phi) {
  // Camera on the cylinder at the POI's φ. Z lifts with |η| so forward
  // POIs are framed from above (or below) the equatorial orbit.
  const zCam = Math.tanh(eta / Z_ETA_SCALE) * Z_AXIAL_MAX;
  const camX = -R_SAFE_MM * Math.cos(phi);
  const camY = -R_SAFE_MM * Math.sin(phi);

  // Target inside the calo, in the POI direction. Same xy sign convention
  // as the parser so the line from camera to target points "into" the
  // detector along the hot direction.
  const theta = 2 * Math.atan(Math.exp(-eta));
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const tgtX = -TGT_R_MM * sinT * Math.cos(phi);
  const tgtY = -TGT_R_MM * sinT * Math.sin(phi);
  const tgtZ = TGT_R_MM * cosT;

  return {
    pos: new THREE.Vector3(camX, camY, zCam),
    tgt: new THREE.Vector3(tgtX, tgtY, tgtZ),
  };
}

/**
 * 3D centre of a POI on the inner-calo radius — used by the slicer-wedge
 * filter to decide whether the POI is in the cut region.
 *
 * @param {POI} poi
 */
function _poiToWorldCentre(poi) {
  const theta = 2 * Math.atan(Math.exp(-poi.eta));
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  return {
    x: -TGT_R_MM * sinT * Math.cos(poi.phi),
    y: -TGT_R_MM * sinT * Math.sin(poi.phi),
    z: TGT_R_MM * cosT,
  };
}

/**
 * Greedy clustering of heat entries into POIs. Highest-energy cells seed
 * POIs; subsequent cells within ΔR ≤ POI_DR fold into the nearest seed
 * with an energy-weighted centroid (linear average for η, unit-vector
 * average for φ to handle wrap at ±π).
 *
 * @param {HeatEntry[]} cellEntries
 * @param {HeatEntry[]} fcalEntries
 * @returns {POI[]}
 */
export function extractPOIs(cellEntries, fcalEntries = []) {
  /** @type {HeatEntry[]} */
  const merged = [];
  const push = (/** @type {HeatEntry[]} */ src) => {
    for (const e of src || []) {
      if (!e || !Number.isFinite(e.eta) || !Number.isFinite(e.phi)) continue;
      const en = Math.abs(e.energyMev || 0);
      if (en <= 0) continue;
      merged.push({ eta: e.eta, phi: e.phi, energyMev: en });
    }
  };
  push(cellEntries);
  push(fcalEntries);
  if (!merged.length) return [];

  merged.sort((a, b) => b.energyMev - a.energyMev);

  /** @type {POI[]} */
  const pois = [];
  for (const e of merged) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < pois.length; i++) {
      const p = pois[i];
      const dEta = e.eta - p.eta;
      const dPhi = _wrapDPhi(e.phi - p.phi);
      const dR = Math.sqrt(dEta * dEta + dPhi * dPhi);
      if (dR < bestD) {
        bestD = dR;
        best = i;
      }
    }
    if (best >= 0 && bestD <= POI_DR) {
      const p = pois[best];
      const totE = p.energyMev + e.energyMev;
      p.eta = (p.eta * p.energyMev + e.eta * e.energyMev) / totE;
      const px = Math.cos(p.phi) * p.energyMev + Math.cos(e.phi) * e.energyMev;
      const py = Math.sin(p.phi) * p.energyMev + Math.sin(e.phi) * e.energyMev;
      p.phi = Math.atan2(py, px);
      p.energyMev = totE;
    } else {
      pois.push({ eta: e.eta, phi: e.phi, energyMev: e.energyMev });
    }
  }

  if (!pois.length) return pois;
  const maxE = pois.reduce((m, p) => Math.max(m, p.energyMev), 0);
  const thr = maxE * MIN_POI_ENERGY_FRAC;
  return pois
    .filter((p) => p.energyMev >= thr)
    .sort((a, b) => b.energyMev - a.energyMev)
    .slice(0, MAX_POIS);
}

/**
 * Drop POIs whose 3D centre falls inside the slicer wedge — they've been
 * cut out of the 3D scene so the tour shouldn't visit them. slicerMask
 * is the object returned by slicer.getMaskState(); when null / inactive
 * the input is returned unchanged.
 *
 * @param {POI[]} pois
 * @param {any} slicerMask
 * @param {(x:number, y:number, z:number, mask:any)=>boolean} isPointInsideWedge
 */
export function filterPOIsBySlicer(pois, slicerMask, isPointInsideWedge) {
  if (!slicerMask || !slicerMask.active || slicerMask.emptyTh) return pois;
  if (typeof isPointInsideWedge !== 'function') return pois;
  return pois.filter((p) => {
    const c = _poiToWorldCentre(p);
    return !isPointInsideWedge(c.x, c.y, c.z, slicerMask);
  });
}

/**
 * Drop POIs whose (η, φ) is outside every minimap rect — the user has
 * narrowed the view to specific regions, so the tour should follow suit.
 * No rects ⇒ no filter.
 *
 * @param {POI[]} pois
 * @param {Rect[] | null} rects
 */
export function filterPOIsByMinimap(pois, rects) {
  if (!rects || !rects.length) return pois;
  return pois.filter((p) =>
    rects.some(
      (r) => p.eta >= r.etaMin && p.eta <= r.etaMax && p.phi >= r.phiMin && p.phi <= r.phiMax,
    ),
  );
}

/**
 * Build a closed Catmull-Rom curve pair through the given POIs, ordered
 * azimuthally so the camera sweeps around the beam axis in one direction.
 * Returns null when fewer than 2 POIs remain (the cinema falls back to its
 * static safe-envelope orbit in that case).
 *
 * @param {POI[]} pois
 */
export function buildTourCurves(pois) {
  if (!pois || pois.length < 2) return null;

  const ordered = [...pois].sort((a, b) => a.phi - b.phi);

  /** @type {THREE.Vector3[]} */
  const camPts = [];
  /** @type {THREE.Vector3[]} */
  const tgtPts = [];
  for (const p of ordered) {
    const { pos, tgt } = _poiToCameraPair(p.eta, p.phi);
    camPts.push(pos);
    tgtPts.push(tgt);
  }

  const posCurve = new THREE.CatmullRomCurve3(camPts, true, 'centripetal', 0.5);
  const tgtCurve = new THREE.CatmullRomCurve3(tgtPts, true, 'centripetal', 0.5);
  return { posCurve, tgtCurve, waypointCount: camPts.length };
}

/**
 * Builds a stationary safe-envelope orbit used as a fallback when an
 * event has too few POIs to drive a meaningful adaptive curve. The orbit
 * lives entirely on the safe cylinder (r = R_SAFE_MM) with a gentle
 * z-wave so the camera doesn't sit on the equator forever. Like the
 * adaptive curves it never crosses cells.
 */
export function buildFallbackCurves() {
  const N = 12;
  /** @type {THREE.Vector3[]} */
  const camPts = [];
  /** @type {THREE.Vector3[]} */
  const tgtPts = [];
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const phi = t * Math.PI * 2;
    // Two full z-cycles per loop so the path has visible vertical motion
    // without becoming a corkscrew (amplitude is 1/2 of Z_AXIAL_MAX).
    const z = Math.sin(t * Math.PI * 4) * (Z_AXIAL_MAX * 0.5);
    camPts.push(new THREE.Vector3(-R_SAFE_MM * Math.cos(phi), -R_SAFE_MM * Math.sin(phi), z));
    tgtPts.push(new THREE.Vector3(0, 0, z * 0.4));
  }
  const posCurve = new THREE.CatmullRomCurve3(camPts, true, 'centripetal', 0.5);
  const tgtCurve = new THREE.CatmullRomCurve3(tgtPts, true, 'centripetal', 0.5);
  return { posCurve, tgtCurve, waypointCount: camPts.length };
}

/**
 * Fingerprint that captures the inputs that should trigger a rebuild:
 * event data (cells + fcal), slicer state, minimap rects, view level.
 * Two calls that produce the same string skip the rebuild even if the
 * heatmap listener fires (e.g. slider drag that didn't actually change
 * the visible set).
 *
 * @param {HeatEntry[]} cellEntries
 * @param {HeatEntry[]} fcalEntries
 * @param {any} slicerMask
 * @param {Rect[] | null} minimapRects
 * @param {number} viewLevel
 */
export function pathFingerprint(cellEntries, fcalEntries, slicerMask, minimapRects, viewLevel) {
  let count = 0;
  let totalE = 0;
  let etaSum = 0;
  let phiCos = 0;
  let phiSin = 0;
  const accum = (/** @type {HeatEntry[]} */ src) => {
    for (const e of src || []) {
      if (!e) continue;
      const en = Math.abs(e.energyMev || 0);
      if (en <= 0) continue;
      if (!Number.isFinite(e.eta) || !Number.isFinite(e.phi)) continue;
      count++;
      totalE += en;
      etaSum += e.eta * en;
      phiCos += Math.cos(e.phi) * en;
      phiSin += Math.sin(e.phi) * en;
    }
  };
  accum(cellEntries);
  accum(fcalEntries);

  const evtPart =
    count === 0 || totalE === 0
      ? 'empty'
      : `${count}|${Math.round(Math.log10(totalE) * 20)}|` +
        `${(etaSum / totalE).toFixed(2)}|` +
        `${Math.atan2(phiSin / totalE, phiCos / totalE).toFixed(2)}`;

  const slicerPart =
    !slicerMask || !slicerMask.active
      ? 'none'
      : `${slicerMask.phi.toFixed(2)}|${slicerMask.thetaLen.toFixed(2)}|` +
        `${slicerMask.zMin | 0}|${slicerMask.zMax | 0}`;

  const minimapPart =
    !minimapRects || !minimapRects.length
      ? 'none'
      : minimapRects
          .map(
            (r) =>
              `${r.etaMin.toFixed(2)},${r.etaMax.toFixed(2)},` +
              `${r.phiMin.toFixed(2)},${r.phiMax.toFixed(2)}`,
          )
          .join(';');

  const levelPart = Number.isFinite(viewLevel) ? `L${viewLevel | 0}` : 'L?';
  return `${evtPart}#${slicerPart}#${minimapPart}#${levelPart}`;
}
