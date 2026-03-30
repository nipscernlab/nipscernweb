/**
 * NIPSCERN CGV-Preview — Interactive 3D ATLAS Calorimeter
 * Three.js — ES Module
 *
 * Coordinate convention (matches ATLAS):
 *   Three.js X  = ATLAS X  (transverse, horizontal)
 *   Three.js Y  = ATLAS Y  (transverse, vertical)
 *   Three.js Z  = ATLAS Z  (beam axis — HORIZONTAL in view)
 *
 * Geometry from CaloGeoConst.h (mm → m):
 *   TileCal barrel:  r = 2.30–3.82 m,  |z| ≤ 2.82 m,  64φ × 10η × 3 layers
 *   TileCal ext:     r = 2.30–3.82 m,  3.56 ≤ |z| ≤ 6.15 m, same binning
 *   LAr barrel:      r = 1.421–1.985 m, |z| ≤ 3.25 m, 32φ × 16η × 4 layers
 *   HEC endcaps:     r = 0.303–2.034 m, 4 discs ±z, 32φ × 8η
 *
 * Event generation: 3–5 jets + diffuse pileup → 5 000–8 000 active cells.
 * Uses THREE.InstancedMesh per subdetector for GPU performance.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================
// Geometry constants (metres, from CaloGeoConst.h)
// ============================================================
const TILE_LAYERS = [
  { rMin: 2.30, rMax: 2.60 },   // A
  { rMin: 2.60, rMax: 3.44 },   // BC
  { rMin: 3.44, rMax: 3.82 },   // D
];
const TILE_Z_HALF    = 2.82;
const TILE_ETA_BINS  = 10;
const TILE_ETA_MAX   = 1.0;
const TILE_PHI_BINS  = 64;

const TILE_EXT_Z_MIN  = 3.56;
const TILE_EXT_Z_MAX  = 6.15;
const TILE_EXT_ETA_MIN = 1.0;
const TILE_EXT_ETA_MAX = 1.7;
const TILE_EXT_ETA_BINS = 8;

const LAR_LAYERS = [
  { rMin: 1.421, rMax: 1.52  },   // Strip
  { rMin: 1.52,  rMax: 1.67  },   // Middle
  { rMin: 1.67,  rMax: 1.83  },   // Back
  { rMin: 1.83,  rMax: 1.985 },   // Presampler ext
];
const LAR_Z_HALF   = 3.25;
const LAR_ETA_BINS = 16;
const LAR_ETA_MAX  = 1.475;
const LAR_PHI_BINS = 32;

const HEC_DISC_Z   = [4.52, 4.96, 5.46, 5.88];
const HEC_R_MIN    = 0.303;
const HEC_R_MAX    = 2.034;
const HEC_ETA_BINS = 8;
const HEC_PHI_BINS = 32;
const HEC_ETA_MIN  = 1.5;
const HEC_ETA_MAX  = 3.2;

// ============================================================
// Energy → colour  (blue → cyan → green → yellow → red)
// ============================================================
function energyToColour(e) {
  const t = Math.max(0, Math.min(1, e));
  const stops = [
    [0.00, 0x0a, 0x3a, 0x8f],
    [0.20, 0x00, 0xaa, 0xff],
    [0.45, 0x00, 0xe0, 0x60],
    [0.70, 0xff, 0xee, 0x00],
    [1.00, 0xff, 0x22, 0x00],
  ];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, r0, g0, b0] = stops[i];
  const [t1, r1, g1, b1] = stops[i + 1];
  const f = (t - t0) / (t1 - t0);
  return new THREE.Color(
    (r0 + f * (r1 - r0)) / 255,
    (g0 + f * (g1 - g0)) / 255,
    (b0 + f * (b1 - b0)) / 255,
  );
}

// ============================================================
// Gaussian and delta-phi helpers
// ============================================================
function gauss(x, sigma) { return Math.exp(-0.5 * (x / sigma) ** 2); }

function wrapPhi(d) {
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ============================================================
// Pre-compute cell pool (called once on init)
// Each cell: { x, y, z, dr, darc, dz, phi, eta }
// Coordinate system: ATLAS X→Three.jsX, ATLAS Y→Three.jsY, ATLAS Z→Three.jsZ
// ============================================================
function buildCellPool() {
  const tile = [];   // TileCal barrel + extended
  const lar  = [];   // LAr barrel
  const hec  = [];   // HEC endcaps

  const tilePhiStep = (2 * Math.PI) / TILE_PHI_BINS;
  const tileEtaStep = (2 * TILE_ETA_MAX) / TILE_ETA_BINS;

  // TileCal barrel (eta covers both ±z halves automatically)
  for (const layer of TILE_LAYERS) {
    const rMid = (layer.rMin + layer.rMax) / 2;
    const dr   = (layer.rMax - layer.rMin) * 0.90;
    for (let ie = 0; ie < TILE_ETA_BINS; ie++) {
      const eta = -TILE_ETA_MAX + (ie + 0.5) * tileEtaStep;
      const z   = rMid * Math.sinh(eta);
      const dz  = rMid * Math.cosh(eta) * tileEtaStep * 0.90;
      for (let ip = 0; ip < TILE_PHI_BINS; ip++) {
        const phi  = -Math.PI + (ip + 0.5) * tilePhiStep;
        const darc = rMid * tilePhiStep * 0.86;
        tile.push({ x: rMid * Math.cos(phi), y: rMid * Math.sin(phi), z, dr, darc, dz, phi, eta, rMid });
      }
    }
  }

  // TileCal extended barrel (both ±z sides)
  const extEtaStep = (TILE_EXT_ETA_MAX - TILE_EXT_ETA_MIN) / TILE_EXT_ETA_BINS;
  for (const layer of TILE_LAYERS) {
    const rMid = (layer.rMin + layer.rMax) / 2;
    const dr   = (layer.rMax - layer.rMin) * 0.90;
    for (let side = -1; side <= 1; side += 2) {
      for (let ie = 0; ie < TILE_EXT_ETA_BINS; ie++) {
        const absEta = TILE_EXT_ETA_MIN + (ie + 0.5) * extEtaStep;
        const eta    = side * absEta;
        const z      = side * rMid * Math.sinh(absEta);
        const dz     = rMid * Math.cosh(absEta) * extEtaStep * 0.90;
        for (let ip = 0; ip < TILE_PHI_BINS; ip++) {
          const phi  = -Math.PI + (ip + 0.5) * tilePhiStep;
          const darc = rMid * tilePhiStep * 0.86;
          tile.push({ x: rMid * Math.cos(phi), y: rMid * Math.sin(phi), z, dr, darc, dz, phi, eta, rMid });
        }
      }
    }
  }

  // LAr barrel
  const larPhiStep = (2 * Math.PI) / LAR_PHI_BINS;
  const larEtaStep = (2 * LAR_ETA_MAX) / LAR_ETA_BINS;
  for (const layer of LAR_LAYERS) {
    const rMid = (layer.rMin + layer.rMax) / 2;
    const dr   = (layer.rMax - layer.rMin) * 0.90;
    for (let ie = 0; ie < LAR_ETA_BINS; ie++) {
      const eta = -LAR_ETA_MAX + (ie + 0.5) * larEtaStep;
      const z   = rMid * Math.sinh(eta);
      const dz  = rMid * Math.cosh(eta) * larEtaStep * 0.90;
      for (let ip = 0; ip < LAR_PHI_BINS; ip++) {
        const phi  = -Math.PI + (ip + 0.5) * larPhiStep;
        const darc = rMid * larPhiStep * 0.86;
        lar.push({ x: rMid * Math.cos(phi), y: rMid * Math.sin(phi), z, dr, darc, dz, phi, eta, rMid });
      }
    }
  }

  // HEC endcaps (both ±z sides)
  const hecPhiStep = (2 * Math.PI) / HEC_PHI_BINS;
  const hecRStep   = (HEC_R_MAX - HEC_R_MIN) / HEC_ETA_BINS;
  const hecEtaStep = (HEC_ETA_MAX - HEC_ETA_MIN) / HEC_ETA_BINS;
  for (const discZ of HEC_DISC_Z) {
    for (let side = -1; side <= 1; side += 2) {
      for (let ie = 0; ie < HEC_ETA_BINS; ie++) {
        const rMin = HEC_R_MIN + ie * hecRStep;
        const rMax = rMin + hecRStep;
        const rMid = (rMin + rMax) / 2;
        const dr   = hecRStep * 0.86;
        const eta  = side * (HEC_ETA_MIN + (ie + 0.5) * hecEtaStep);
        const z    = side * discZ;
        const dz   = 0.20;
        for (let ip = 0; ip < HEC_PHI_BINS; ip++) {
          const phi  = -Math.PI + (ip + 0.5) * hecPhiStep;
          const darc = rMid * hecPhiStep * 0.86;
          hec.push({ x: rMid * Math.cos(phi), y: rMid * Math.sin(phi), z, dr, darc, dz, phi, eta, rMid });
        }
      }
    }
  }

  return { tile, lar, hec };
}

// ============================================================
// Build InstancedMesh per subdetector
// Unit cube geometry; scale/rotate/translate per instance
// ============================================================
function buildInstancedMeshes(scene) {
  const pool = buildCellPool();
  const unitGeo = new THREE.BoxGeometry(1, 1, 1);

  function makeMesh(count, layer) {
    const mat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.88 });
    const inst = new THREE.InstancedMesh(unitGeo, mat, count);
    inst.count = 0;
    inst.userData.isInstCell = true;
    inst.userData.layer = layer;
    scene.add(inst);
    return inst;
  }

  return {
    pool,
    tileInst: makeMesh(pool.tile.length, 'tilecal'),
    larInst:  makeMesh(pool.lar.length,  'lar'),
    hecInst:  makeMesh(pool.hec.length,  'hec'),
  };
}

// ============================================================
// Build wireframe shells (static detector outline)
// ============================================================
function buildShells(scene) {
  const wireMat = () => new THREE.MeshBasicMaterial({
    color: 0x1a2a4a, wireframe: true, transparent: true, opacity: 0.20,
  });

  // TileCal barrel (outer + inner cylinder, axis along Z)
  [[3.82, 'tilecal'], [2.30, 'tilecal'], [2.28, 'lar'], [1.421, 'lar']].forEach(([r, layer]) => {
    const geo = new THREE.CylinderGeometry(r, r, TILE_Z_HALF * 2, 64, 1, true);
    const m = new THREE.Mesh(geo, wireMat());
    m.rotation.x = Math.PI / 2;   // cylinder axis → world Z (beam)
    m.userData.isShell = true;
    m.userData.layer = layer;
    scene.add(m);
  });

  // TileCal extended barrel (both ±z)
  const extHalf = (TILE_EXT_Z_MAX - TILE_EXT_Z_MIN) / 2;
  const extCentre = (TILE_EXT_Z_MAX + TILE_EXT_Z_MIN) / 2;
  [-1, 1].forEach(side => {
    [3.82, 2.30].forEach(r => {
      const geo = new THREE.CylinderGeometry(r, r, extHalf * 2, 64, 1, true);
      const m = new THREE.Mesh(geo, wireMat());
      m.rotation.x = Math.PI / 2;
      m.position.z = side * extCentre;
      m.userData.isShell = true;
      m.userData.layer = 'tilecal';
      scene.add(m);
    });
  });

  // HEC endcap rings (discs perpendicular to beam axis)
  HEC_DISC_Z.forEach(discZ => {
    [-1, 1].forEach(side => {
      const geo = new THREE.RingGeometry(HEC_R_MIN, HEC_R_MAX, 32);
      const m = new THREE.Mesh(geo, wireMat());
      // RingGeometry is in XY plane by default → normal along Z → perpendicular to beam ✓
      m.position.z = side * discZ;
      m.userData.isShell = true;
      m.userData.layer = 'hec';
      scene.add(m);
    });
  });

  // Beam axis line (along Z)
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -8),
    new THREE.Vector3(0, 0,  8),
  ]);
  const beamLine = new THREE.Line(beamGeo,
    new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4 }));
  beamLine.userData.isBeamAxis = true;
  beamLine.visible = false;
  scene.add(beamLine);

  // Z-axis north indicator — red cone at +Z end (always visible)
  const zConeMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const zConeGeo = new THREE.ConeGeometry(0.12, 0.42, 14);
  const zCone    = new THREE.Mesh(zConeGeo, zConeMat);
  // ConeGeometry points along +Y by default; rotate -90° around X → points along +Z
  zCone.rotation.x = -Math.PI / 2;
  // Position so the cone base sits at z≈8.0 and tip points outward
  zCone.position.set(0, 0, 8.21);
  zCone.userData.isZNorth = true;
  zCone.visible = false;          // shown only when beam axis is on
  scene.add(zCone);
}

// ============================================================
// Event generation — fills InstancedMesh arrays
// 8 distinct topologies chosen at random for visual variety
// ============================================================
const _pos   = new THREE.Vector3();
const _quat  = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat4  = new THREE.Matrix4();
const _axis  = new THREE.Vector3(0, 0, 1);   // rotation about Z axis

function setInstance(inst, idx, cell, energy) {
  const col = energyToColour(energy);
  _pos.set(cell.x, cell.y, cell.z);
  _quat.setFromAxisAngle(_axis, cell.phi);   // radial orientation in XY plane
  _scale.set(cell.dr, cell.darc, cell.dz);   // width=radial, height=phi-arc, depth=beam-z
  _mat4.compose(_pos, _quat, _scale);
  inst.setMatrixAt(idx, _mat4);
  inst.setColorAt(idx, col);
}

/**
 * Choose a random collision topology.
 * Each topology returns:
 *   jets   — array of { eta, phi, energy, isEM, sEta, sPhi }
 *   pileup — fraction of cells receiving random pileup noise
 *   pileupE — max pileup energy per noisy cell
 *   thTile/thLar/thHec — energy thresholds below which cells are hidden
 */
function pickTopology() {
  const r = Math.random();

  if (r < 0.125) {
    // 1 — Hadronic di-jet (back-to-back, symmetric)
    const phi0 = -Math.PI + Math.random() * 2 * Math.PI;
    const eta0 = (Math.random() - 0.5) * 2.0;
    return {
      jets: [
        { eta: eta0,  phi: phi0,                       energy: 0.65 + Math.random() * 0.35, isEM: false, sEta: 0.16 + Math.random() * 0.08, sPhi: 0.18 + Math.random() * 0.08 },
        { eta: -eta0 + (Math.random() - 0.5) * 0.3,
          phi: wrapPhi(phi0 + Math.PI),                 energy: 0.55 + Math.random() * 0.35, isEM: false, sEta: 0.16 + Math.random() * 0.08, sPhi: 0.18 + Math.random() * 0.08 },
      ],
      pileup: 0.28, pileupE: 0.09, thTile: 0.024, thLar: 0.026, thHec: 0.020,
    };
  }
  if (r < 0.250) {
    // 2 — EM shower (electron / photon — narrow cluster mostly in LAr)
    const nEM = Math.random() < 0.5 ? 1 : 2;
    return {
      jets: Array.from({ length: nEM }, () => ({
        eta: (Math.random() - 0.5) * 2.2, phi: -Math.PI + Math.random() * 2 * Math.PI,
        energy: 0.80 + Math.random() * 0.20, isEM: true,
        sEta: 0.04 + Math.random() * 0.03, sPhi: 0.04 + Math.random() * 0.03,
      })),
      pileup: 0.07, pileupE: 0.04, thTile: 0.044, thLar: 0.016, thHec: 0.048,
    };
  }
  if (r < 0.375) {
    // 3 — Multi-jet spray (4–6 jets, mix of EM and hadronic)
    const n = 4 + Math.floor(Math.random() * 3);
    return {
      jets: Array.from({ length: n }, () => ({
        eta: (Math.random() - 0.5) * 2.8, phi: -Math.PI + Math.random() * 2 * Math.PI,
        energy: 0.22 + Math.random() * 0.55, isEM: Math.random() < 0.28,
        sEta: 0.13 + Math.random() * 0.10, sPhi: 0.13 + Math.random() * 0.10,
      })),
      pileup: 0.32, pileupE: 0.09, thTile: 0.018, thLar: 0.020, thHec: 0.015,
    };
  }
  if (r < 0.500) {
    // 4 — Forward event (high |η|, HEC-dominated, very few barrel cells)
    return {
      jets: [
        { eta:  2.0 + Math.random() * 1.1, phi: -Math.PI + Math.random() * 2 * Math.PI, energy: 0.5 + Math.random() * 0.5, isEM: false, sEta: 0.22, sPhi: 0.28 },
        { eta: -2.0 - Math.random() * 1.1, phi: -Math.PI + Math.random() * 2 * Math.PI, energy: 0.4 + Math.random() * 0.4, isEM: false, sEta: 0.22, sPhi: 0.28 },
      ],
      pileup: 0.11, pileupE: 0.05, thTile: 0.050, thLar: 0.044, thHec: 0.015,
    };
  }
  if (r < 0.590) {
    // 5 — Minimum bias (very few, low-energy cells scattered across the detector)
    const n = 1 + Math.floor(Math.random() * 3);
    return {
      jets: Array.from({ length: n }, () => ({
        eta: (Math.random() - 0.5) * 4.8, phi: -Math.PI + Math.random() * 2 * Math.PI,
        energy: 0.05 + Math.random() * 0.14, isEM: Math.random() < 0.5,
        sEta: 0.42 + Math.random() * 0.28, sPhi: 0.42 + Math.random() * 0.28,
      })),
      pileup: 0.05, pileupE: 0.04, thTile: 0.013, thLar: 0.013, thHec: 0.011,
    };
  }
  if (r < 0.700) {
    // 6 — Heavy-ion central collision (very high multiplicity, fills the whole detector)
    const n = 9 + Math.floor(Math.random() * 6);
    return {
      jets: Array.from({ length: n }, () => ({
        eta: (Math.random() - 0.5) * 5.4, phi: -Math.PI + Math.random() * 2 * Math.PI,
        energy: 0.06 + Math.random() * 0.40, isEM: Math.random() < 0.42,
        sEta: 0.28 + Math.random() * 0.28, sPhi: 0.32 + Math.random() * 0.32,
      })),
      pileup: 0.66, pileupE: 0.20, thTile: 0.009, thLar: 0.009, thHec: 0.007,
    };
  }
  if (r < 0.820) {
    // 7 — Single narrow hadronic jet (clean, isolated)
    return {
      jets: [{
        eta: (Math.random() - 0.5) * 1.8, phi: -Math.PI + Math.random() * 2 * Math.PI,
        energy: 0.85 + Math.random() * 0.15, isEM: false,
        sEta: 0.08 + Math.random() * 0.06, sPhi: 0.09 + Math.random() * 0.06,
      }],
      pileup: 0.16, pileupE: 0.07, thTile: 0.030, thLar: 0.032, thHec: 0.038,
    };
  }
  // 8 — Boosted / fat jet (one large-R jet with sub-structure)
  const phi0 = -Math.PI + Math.random() * 2 * Math.PI;
  const eta0 = (Math.random() - 0.5) * 1.5;
  return {
    jets: [
      { eta: eta0,         phi: phi0,                  energy: 0.92, isEM: false, sEta: 0.44, sPhi: 0.46 },
      { eta: eta0 + 0.14,  phi: wrapPhi(phi0 + 0.22),  energy: 0.62, isEM: false, sEta: 0.18, sPhi: 0.18 },
      { eta: eta0 - 0.18,  phi: wrapPhi(phi0 - 0.20),  energy: 0.48, isEM: true,  sEta: 0.06, sPhi: 0.06 },
    ],
    pileup: 0.22, pileupE: 0.08, thTile: 0.019, thLar: 0.019, thHec: 0.017,
  };
}

function generateEvent(instData) {
  const { pool, tileInst, larInst, hecInst } = instData;
  const { jets, pileup, pileupE, thTile, thLar, thHec } = pickTopology();

  // ---- TileCal ----
  let ti = 0;
  for (const cell of pool.tile) {
    let E = 0;
    for (const j of jets) {
      const dPhi = wrapPhi(cell.phi - j.phi);
      if (j.isEM) {
        E += j.energy * 0.07 * gauss(cell.eta - j.eta, j.sEta) * gauss(dPhi, j.sPhi);
      } else {
        E += j.energy       * gauss(cell.eta - j.eta, j.sEta) * gauss(dPhi, j.sPhi);
      }
    }
    if (Math.random() < pileup) E += Math.random() * pileupE;
    if (E < thTile) continue;
    setInstance(tileInst, ti++, cell, Math.min(E, 1));
  }
  tileInst.count = ti;
  tileInst.instanceMatrix.needsUpdate = true;
  if (tileInst.instanceColor) tileInst.instanceColor.needsUpdate = true;

  // ---- LAr ----
  let li = 0;
  for (const cell of pool.lar) {
    let E = 0;
    for (const j of jets) {
      const dPhi = wrapPhi(cell.phi - j.phi);
      const sE   = j.isEM ? j.sEta      : j.sEta * 1.5;
      const sP   = j.isEM ? j.sPhi      : j.sPhi * 1.5;
      const w    = j.isEM ? 1.0         : 0.35;
      E += j.energy * w * gauss(cell.eta - j.eta, sE) * gauss(dPhi, sP);
    }
    if (Math.random() < pileup * 0.62) E += Math.random() * pileupE * 0.72;
    if (E < thLar) continue;
    setInstance(larInst, li++, cell, Math.min(E * 1.1, 1));
  }
  larInst.count = li;
  larInst.instanceMatrix.needsUpdate = true;
  if (larInst.instanceColor) larInst.instanceColor.needsUpdate = true;

  // ---- HEC ----
  let hi = 0;
  for (const cell of pool.hec) {
    let E = 0;
    for (const j of jets) {
      const absEtaDiff = Math.abs(cell.eta) - Math.abs(j.eta);
      const dPhi = wrapPhi(cell.phi - j.phi);
      E += j.energy * 0.55 * gauss(absEtaDiff, j.sEta * 1.3) * gauss(dPhi, j.sPhi * 1.3);
    }
    if (Math.random() < pileup * 0.33) E += Math.random() * pileupE * 0.52;
    if (E < thHec) continue;
    setInstance(hecInst, hi++, cell, Math.min(E * 0.85, 1));
  }
  hecInst.count = hi;
  hecInst.instanceMatrix.needsUpdate = true;
  if (hecInst.instanceColor) hecInst.instanceColor.needsUpdate = true;

  return ti + li + hi;
}

// ============================================================
// Main export
// ============================================================
export function initCGVPreview(containerId = 'cgv-canvas-wrapper') {
  const wrapper = document.getElementById(containerId);
  if (!wrapper) return;

  const canvas  = wrapper.querySelector('#cgv-canvas');
  const loading = wrapper.querySelector('.cgv-loading');

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
  renderer.setClearColor(0x05070f, 1);

  // ---- Scene ----
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070f, 0.025);

  // ---- Camera — positioned to show beam axis horizontal ----
  const camera = new THREE.PerspectiveCamera(52, wrapper.clientWidth / wrapper.clientHeight, 0.1, 120);
  camera.position.set(5, 7, 12);
  camera.lookAt(0, 0, 0);

  // ---- Lights ----
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.9);
  d1.position.set(6, 10, 8);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0x4466ff, 0.3);
  d2.position.set(-6, -4, -6);
  scene.add(d2);

  // ---- Controls ----
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.06;
  controls.rotateSpeed    = 0.7;
  controls.zoomSpeed      = 0.8;
  controls.panSpeed       = 0.6;
  controls.minDistance    = 3;
  controls.maxDistance    = 30;
  controls.autoRotate     = true;
  controls.autoRotateSpeed = 0.35;

  // ---- Geometry ----
  buildShells(scene);
  const instData = buildInstancedMeshes(scene);

  // ---- State ----
  let wireframeMode   = false;
  let beamAxisVisible = false;
  const layerVisible  = { tilecal: true, lar: true, hec: true };

  // ---- UI refs ----
  const btnEvent   = wrapper.querySelector('#cgv-btn-event');
  const btnWire    = wrapper.querySelector('#cgv-btn-wire');
  const btnBeam    = wrapper.querySelector('#cgv-btn-beam');
  const btnTilecal = wrapper.querySelector('#cgv-btn-tilecal');
  const btnLar     = wrapper.querySelector('#cgv-btn-lar');
  const btnHec     = wrapper.querySelector('#cgv-btn-hec');
  const countEl    = wrapper.querySelector('#cgv-cell-count');

  function updateCount(n) {
    if (countEl) countEl.textContent = n.toLocaleString();
  }

  function setWireframe(on) {
    wireframeMode = on;
    [instData.tileInst, instData.larInst, instData.hecInst].forEach(inst => {
      if (inst.material) { inst.material.wireframe = on; inst.material.opacity = on ? 0.65 : 0.88; }
    });
    scene.children.forEach(c => {
      if (c.userData.isShell && c.material) c.material.opacity = on ? 0.45 : 0.20;
    });
    btnWire?.classList.toggle('active', on);
    btnWire?.setAttribute('aria-pressed', String(on));
  }

  function setBeamAxis(on) {
    beamAxisVisible = on;
    scene.children.forEach(c => { if (c.userData.isBeamAxis || c.userData.isZNorth) c.visible = on; });
    btnBeam?.classList.toggle('active', on);
    btnBeam?.setAttribute('aria-pressed', String(on));
  }

  function setLayerVisible(layer, on) {
    layerVisible[layer] = on;
    [instData.tileInst, instData.larInst, instData.hecInst].forEach(inst => {
      if (inst.userData.layer === layer) inst.visible = on;
    });
    scene.children.forEach(c => {
      if (c.userData.isShell && c.userData.layer === layer) c.visible = on;
    });
    const btn = wrapper.querySelector('#cgv-btn-' + layer);
    btn?.classList.toggle('active', on);
    btn?.setAttribute('aria-pressed', String(on));
  }

  function doGenerate() {
    const n = generateEvent(instData);
    updateCount(n);
    if (wireframeMode) setWireframe(true);
    Object.entries(layerVisible).forEach(([layer, on]) => { if (!on) setLayerVisible(layer, false); });
  }

  btnEvent?.addEventListener('click', doGenerate);
  btnWire?.addEventListener('click',  () => setWireframe(!wireframeMode));
  btnBeam?.addEventListener('click',  () => setBeamAxis(!beamAxisVisible));
  btnTilecal?.addEventListener('click', () => setLayerVisible('tilecal', !layerVisible.tilecal));
  btnLar?.addEventListener('click',     () => setLayerVisible('lar',     !layerVisible.lar));
  btnHec?.addEventListener('click',     () => setLayerVisible('hec',     !layerVisible.hec));

  // Initial event
  doGenerate();

  // Hide loading
  loading?.classList.add('hidden');

  // ---- Resize ----
  const onResize = () => {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  // ---- Render loop ----
  let frameId;
  function animate() {
    frameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // ---- Cleanup ----
  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    controls.dispose();
  };
}
