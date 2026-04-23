import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';

// ── Ghost envelope mesh names ────────────────────────────────────────────────
export const GHOST_MESH_NAMES = [
  'C→LBTile_0',
  'C→EBTilep_0',
  'C→EBTilen_0',
  'Calorimeter→LBTile_0',
  'Calorimeter→LBTileLArg_0',
  'Calorimeter→LBLArg_0',
  'Calorimeter→EBTilep_0',
  'Calorimeter→EBTilen_0',
  'Calorimeter→EBTileHECp_0',
  'Calorimeter→EBTileHECn_0',
  'Calorimeter→EBHECp_0',
  'Calorimeter→EBHECn_0',
];

// TileCal envelopes visible by default on startup.
const GHOST_DEFAULT_ON = new Set([
  'C→LBTile_0', 'C→EBTilep_0', 'C→EBTilen_0',
  'Calorimeter→LBTile_0', 'Calorimeter→LBTileLArg_0',
  'Calorimeter→EBTilep_0', 'Calorimeter→EBTilen_0',
  'Calorimeter→EBTileHECp_0', 'Calorimeter→EBTileHECn_0',
]);

// Per-ghost visibility (name -> bool). All modules read this; mutation via .set().
export const ghostVisible    = new Map();
export const ghostMeshByName = new Map();
for (const n of GHOST_MESH_NAMES) ghostVisible.set(n, GHOST_DEFAULT_ON.has(n));

// ── Ghost materials ──────────────────────────────────────────────────────────
// RGB(92,95,102) = #5C5F66; very high transparency (99%) for a subtle outline.
let ghostSolidColor   = 0x5C5F66;
let ghostSolidOpacity = 0.01;

const ghostSolidMat = new THREE.MeshBasicMaterial({
  color: ghostSolidColor, transparent: true, opacity: ghostSolidOpacity,
  depthWrite: false, side: THREE.DoubleSide,
});
// Phi lines are locked at white + high transparency, independent of the opacity
// slider so they remain subtle guides regardless of envelope opacity.
const GHOST_PHI_FIXED_OPACITY = 0.06;
const ghostPhiMat = new THREE.LineBasicMaterial({
  color: 0xFFFFFF, transparent: true, opacity: GHOST_PHI_FIXED_OPACITY, depthWrite: false,
});

// ── Phi-segmentation lines (TileCal) ─────────────────────────────────────────
// 64 radial planes in φ — each a rectangle from r_inner to r_outer spanning z.
//   LB  : r 2288→3835, z ±2820
//   EB± : r 2288→3835, z [3600,6050] / [-6050,-3600]
const TILE_PHI_SEGS = [
  { rIn: 2288, rOut: 3835, zMin: -2820, zMax:  2820 },
  { rIn: 2288, rOut: 3835, zMin:  3600, zMax:  6050 },
  { rIn: 2288, rOut: 3835, zMin: -6050, zMax: -3600 },
];
const N_PHI = 64;
let ghostPhiGroup = null;

export function buildPhiLines() {
  if (ghostPhiGroup) {
    scene.remove(ghostPhiGroup);
    ghostPhiGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  ghostPhiGroup = new THREE.Group();
  ghostPhiGroup.renderOrder = 6;
  ghostPhiGroup.visible = false;
  for (let i = 0; i < N_PHI; i++) {
    const phi = (i / N_PHI) * Math.PI * 2;
    const cx = Math.cos(phi), cy = Math.sin(phi);
    for (const { rIn, rOut, zMin, zMax } of TILE_PHI_SEGS) {
      const pts = [
        new THREE.Vector3(cx * rIn,  cy * rIn,  zMin),
        new THREE.Vector3(cx * rIn,  cy * rIn,  zMax),
        new THREE.Vector3(cx * rOut, cy * rOut, zMax),
        new THREE.Vector3(cx * rOut, cy * rOut, zMin),
        new THREE.Vector3(cx * rIn,  cy * rIn,  zMin),
      ];
      ghostPhiGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ghostPhiMat));
    }
  }
  scene.add(ghostPhiGroup);
}

export function anyGhostOn() {
  for (const v of ghostVisible.values()) if (v) return true;
  return false;
}

export function applyGhostMeshOne(name, visible) {
  const mesh = ghostMeshByName.get(name);
  if (!mesh) return;
  if (visible) {
    mesh.material    = ghostSolidMat;
    mesh.renderOrder = 5;
    mesh.visible     = true;
  } else {
    mesh.renderOrder = 0;
    mesh.visible     = false;
  }
}

// Re-apply every ghost's visibility from the map. Safe to call after resetScene.
export function applyAllGhostMeshes() {
  for (const [name, v] of ghostVisible) applyGhostMeshOne(name, v);
  if (ghostPhiGroup) ghostPhiGroup.visible = anyGhostOn();
  markDirty();
}

export function syncGhostToggles() {
  document.getElementById('btn-ghost').classList.toggle('on', anyGhostOn());
}

export function toggleGhostByName(name) {
  if (!ghostVisible.has(name)) return;
  const next = !ghostVisible.get(name);
  ghostVisible.set(name, next);
  if (next && !ghostPhiGroup) buildPhiLines();
  applyGhostMeshOne(name, next);
  if (ghostPhiGroup) ghostPhiGroup.visible = anyGhostOn();
  syncGhostToggles();
  markDirty();
}

export function setAllGhosts(on) {
  for (const name of GHOST_MESH_NAMES) ghostVisible.set(name, on);
  if (on && !ghostPhiGroup) buildPhiLines();
  applyAllGhostMeshes();
  syncGhostToggles();
}

// Keyboard shortcut G: if any ghost on → turn all off; else restore TileCal defaults.
export function toggleAllGhosts() {
  if (anyGhostOn()) { setAllGhosts(false); return; }
  for (const name of GHOST_MESH_NAMES) ghostVisible.set(name, GHOST_DEFAULT_ON.has(name));
  if (!ghostPhiGroup) buildPhiLines();
  applyAllGhostMeshes();
  syncGhostToggles();
}

export function enableDefaultGhosts() {
  buildPhiLines();
  applyAllGhostMeshes();
  syncGhostToggles();
}

export function updateGhostColors() {
  ghostSolidMat.color.set(ghostSolidColor);
  ghostSolidMat.opacity = ghostSolidOpacity;
  ghostPhiMat.opacity = GHOST_PHI_FIXED_OPACITY;
  ghostPhiMat.color.set(0xFFFFFF);
  if (ghostPhiGroup) ghostPhiGroup.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  markDirty();
}
