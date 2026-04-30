// @ts-check
// Muon-spectrometer visibility. The atlas-tree subtrees for the A side
// (MUC1_2) and C side (MUCH_1) arrive from the loader once the GLB is
// parsed; the layers panel then mirrors that structure into
// layerVis.muon, and applyMuonVisibility writes
// mesh.userData.muonForceVisible on every chamber leaf so the track-hit
// pass in trackAtlasIntersections.js can AND it with the actual hit set.
//
// Pure-ish: only the markDirty / track-intersection refresh side-effects
// touch Three.js / scene, and they are fine to leave as direct imports
// because trackAtlasIntersections never imports back from this module
// (so there's no circular-evaluation risk).
import { layerVis, replaceMuonState } from './layerVis.js';
import { updateTrackAtlasIntersections } from '../trackAtlasIntersections.js';
import { markDirty } from '../renderer.js';
import { setupMuonAliasMap } from './muonAliases.js';

/**
 * @typedef {{
 *   name: string,
 *   children: Map<string, AtlasNode>,
 *   meshes: Array<{ userData: Record<string, any> }>,
 *   allMeshes: Array<{ userData: Record<string, any> }>,
 * }} AtlasNode
 */

/** @typedef {{ aSide: AtlasNode | null, cSide: AtlasNode | null }} MuonTrees */

/** @typedef {(trees: MuonTrees) => void} MuonChangeListener */

/** @type {MuonTrees} */
let _muonAtlasTrees = { aSide: null, cSide: null };
/** @type {MuonChangeListener[]} */
const _muonChangeListeners = [];

/**
 * Registers the A/C atlas subtrees, rebuilds the layerVis.muon mirror, and
 * applies visibility. Called from loader.js once the GLB has been parsed.
 * @param {{ aSide?: AtlasNode | null, cSide?: AtlasNode | null }} trees
 */
export function setMuonTrees({ aSide = null, cSide = null }) {
  _muonAtlasTrees = { aSide, cSide };
  replaceMuonState({
    aSide: _muonStateFromTree(aSide),
    cSide: _muonStateFromTree(cSide),
  });
  // Build the chamber-mesh → friendly-station-alias map (BIS / BIL / NSW / …)
  // — same naming the Detector Layers panel surfaces, used by the hover
  // tooltip when raycasting a muon chamber.
  setupMuonAliasMap(_muonAtlasTrees);
  applyMuonVisibility();
  for (const cb of _muonChangeListeners) cb(_muonAtlasTrees);
}

export function getMuonAtlasTrees() {
  return _muonAtlasTrees;
}

/** @param {MuonChangeListener} cb */
export function onMuonTreesChange(cb) {
  _muonChangeListeners.push(cb);
}

/**
 * Mirrors an atlas-tree subtree as a layerVis state object. Atlas nodes
 * with no children become a single boolean leaf; intermediate nodes become
 * objects keyed by child name and recurse. Direct meshes attached to
 * intermediate nodes are not exposed individually — they follow the parent's
 * aggregate state via _applyMuonNode. Leaves default to true so the muon
 * visibility AND (panel allowed × track hit) keeps showing the same
 * hit-driven chambers it always did until the user explicitly disables a
 * station.
 * @param {AtlasNode | null} node
 * @returns {boolean | Record<string, any>}
 */
function _muonStateFromTree(node) {
  if (!node) return true;
  if (node.children.size === 0) return true;
  /** @type {Record<string, any>} */
  const obj = {};
  for (const [name, child] of node.children) obj[name] = _muonStateFromTree(child);
  return obj;
}

/** @param {boolean | Record<string, any>} state */
function _muonStateAnyOn(state) {
  if (typeof state === 'boolean') return state;
  if (state && typeof state === 'object') {
    for (const k of Object.keys(state)) if (_muonStateAnyOn(state[k])) return true;
  }
  return false;
}

/**
 * @param {AtlasNode | null} atlasNode
 * @param {boolean | Record<string, any>} visState
 */
function _applyMuonNode(atlasNode, visState) {
  if (!atlasNode) return;
  if (typeof visState === 'boolean') {
    for (const m of atlasNode.allMeshes) m.userData.muonForceVisible = visState;
    return;
  }
  // Object: recurse into named children and aggregate for any direct meshes
  // hanging off this intermediate node (so they don't get orphaned).
  let any = false;
  for (const [name, child] of atlasNode.children) {
    const childState = visState[name];
    _applyMuonNode(child, childState);
    if (_muonStateAnyOn(childState)) any = true;
  }
  for (const m of atlasNode.meshes) m.userData.muonForceVisible = any;
}

export function applyMuonVisibility() {
  // Walks both subtrees, writing userData.muonForceVisible on every leaf
  // mesh. Then triggers the track-hit pass which ORs that flag with its own
  // hit set so hit-chamber outlines stay consistent.
  /** @type {any} */
  const lv = layerVis;
  _applyMuonNode(_muonAtlasTrees.aSide, lv.muon.aSide);
  _applyMuonNode(_muonAtlasTrees.cSide, lv.muon.cSide);
  updateTrackAtlasIntersections();
  markDirty();
}
