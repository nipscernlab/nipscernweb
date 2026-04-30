// Track-vs-muon-chamber geometric intersection pass.
//
// Walks every visible (or particle-hidden — see below) track polyline and
// raycasts each segment against the muon-chamber meshes (subtree roots
// MUC1_2 / MUCH_1). Chambers a track passes through become visible; the
// rest stay hidden so the muon spectrometer reads as "lit by physics" not
// "every chamber on stage".
//
// This file ALSO houses the chamber-hover outline API (showChamberHover-
// Outline / clearChamberHoverOutline) because the per-chamber outline
// LineSegments it creates are reused by the hover handler.
//
// Material assignment (which colour each track line takes) lives in
// trackMaterials.js. The recompute*Match passes (jet / τ / electron /
// muon → track) live in trackMatch.js. Both are invoked from this file
// after the chamber-hit set updates each line's `isHitTrack` flag.

import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';
import { applyTrackMaterials } from './trackMaterials.js';
import { initTrackMatch } from './trackMatch.js';

// Chamber materials (only used here — not exported).
const atlasTrackHitMat = new THREE.MeshBasicMaterial({
  color: 0x4a90d9,
  transparent: true,
  opacity: 0.035,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const trackAtlasOutlineMat = new THREE.LineBasicMaterial({
  color: 0x4a90d9,
  transparent: true,
  opacity: 0.15,
  depthWrite: false,
});

// Atlas subtree names whose descendants are the chamber meshes we test.
const TRACK_ATLAS_TARGET_NODE_NAMES = ['MUCH_1', 'MUC1_2'];

// Reusable scratch objects for the per-segment raycast — avoids allocating
// inside the per-track loop (called every time a track-affecting state
// changes, can happen many times per second during slider drags).
const _trackAtlasRay = new THREE.Raycaster();
const _trackAtlasSegA = new THREE.Vector3();
const _trackAtlasSegB = new THREE.Vector3();
const _trackAtlasDir = new THREE.Vector3();
const _trackAtlasTrackBox = new THREE.Box3();
const _trackAtlasEdgeGeoCache = new Map();

let atlasRoot = null;
let _trackAtlasNodes = null;
let _trackAtlasMeshes = null;
let _trackAtlasOutlineMeshes = null;
let _trackAtlasMeshBoxes = null;

let _getTrackGroup = () => null;

/** @param {{ getTrackGroup: () => any }} deps */
export function initTrackAtlasIntersections({ getTrackGroup }) {
  _getTrackGroup = getTrackGroup;
  // Cascade init to the sibling track-match module so consumers only call
  // one init at startup (see main.js).
  initTrackMatch({ getTrackGroup });
}

export function setAtlasRoot(tree) {
  atlasRoot = tree;
  _trackAtlasNodes = null;
  _trackAtlasMeshes = null;
  _trackAtlasOutlineMeshes = null;
  _trackAtlasMeshBoxes = null;
}

/**
 * Returns the muon-chamber meshes that the track-vs-chamber intersection
 * test runs against — the same set hover-raycast wants for tooltip lookup.
 * Lazily resolves on the first call after setAtlasRoot. Returns an empty
 * array when atlas isn't loaded yet.
 * @returns {ReadonlyArray<any>}
 */
export function getMuonChamberMeshes() {
  if (!atlasRoot) return [];
  return _resolveTrackAtlasTargets().meshes;
}

// Hover outline for muon chambers — piggy-backs on the per-mesh
// trackAtlasOutline LineSegments already created by _ensureTrackAtlasOutline.
// Stores each forced mesh's prior outline.visible so we can restore it on
// hover-out (the next updateTrackAtlasIntersections will recompute the
// track-driven state authoritatively, but until then we leave it as we
// found it).
/** @type {Map<any, boolean>} */
const _hoverOutlinePrev = new Map();

/**
 * Forces the per-mesh outline on every chamber in `meshes` to visible —
 * typically every mesh of one station, fed in by the hover handler via
 * getStationMeshes(). Replaces any previous hover set.
 * @param {ReadonlyArray<any>} meshes
 */
export function showChamberHoverOutline(meshes) {
  clearChamberHoverOutline();
  for (const m of meshes) {
    const out = m.userData?.trackAtlasOutline;
    if (!out) continue;
    _hoverOutlinePrev.set(m, out.visible);
    out.visible = true;
  }
  if (_hoverOutlinePrev.size) markDirty();
}

/** Restores every outline forced visible by the last showChamberHoverOutline. */
export function clearChamberHoverOutline() {
  if (_hoverOutlinePrev.size === 0) return;
  for (const [m, prev] of _hoverOutlinePrev) {
    const out = m.userData?.trackAtlasOutline;
    if (out) out.visible = prev;
  }
  _hoverOutlinePrev.clear();
  markDirty();
}

function _findAtlasNodesByName(root, name, out = []) {
  if (!root) return out;
  if (root.name === name) out.push(root);
  for (const child of root.children.values()) _findAtlasNodesByName(child, name, out);
  return out;
}

function _maxAtlasSubtreeDepth(node) {
  if (!node.children.size) return 0;
  let maxDepth = 0;
  for (const child of node.children.values())
    maxDepth = Math.max(maxDepth, 1 + _maxAtlasSubtreeDepth(child));
  return maxDepth;
}

function _collectAtlasNodesAtDepth(node, depth, out = []) {
  if (depth === 0) {
    out.push(node);
    return out;
  }
  for (const child of node.children.values()) _collectAtlasNodesAtDepth(child, depth - 1, out);
  return out;
}

function _ensureTrackAtlasOutline(mesh) {
  mesh.material = atlasTrackHitMat;
  if (mesh.userData.trackAtlasOutline) return mesh.userData.trackAtlasOutline;
  const uid = mesh.geometry.uuid;
  if (!_trackAtlasEdgeGeoCache.has(uid))
    _trackAtlasEdgeGeoCache.set(uid, new THREE.EdgesGeometry(mesh.geometry, 30));
  const outline = new THREE.LineSegments(_trackAtlasEdgeGeoCache.get(uid), trackAtlasOutlineMat);
  outline.name = `${mesh.name}__track_outline`;
  outline.renderOrder = 8;
  outline.visible = false;
  mesh.add(outline);
  mesh.userData.trackAtlasOutline = outline;
  return outline;
}

function _resolveTrackAtlasTargets() {
  if (!atlasRoot) return { nodes: [], meshes: [], outlineMeshes: [] };
  if (_trackAtlasNodes && _trackAtlasMeshes && _trackAtlasOutlineMeshes)
    return {
      nodes: _trackAtlasNodes,
      meshes: _trackAtlasMeshes,
      outlineMeshes: _trackAtlasOutlineMeshes,
    };
  const sourceNodes = [];
  const seen = new Set();
  for (const name of TRACK_ATLAS_TARGET_NODE_NAMES) {
    for (const node of _findAtlasNodesByName(atlasRoot, name)) {
      if (seen.has(node)) continue;
      seen.add(node);
      sourceNodes.push(node);
    }
  }
  const nodes = [];
  const nodeSeen = new Set();
  const outlineNodes = [];
  const outlineNodeSeen = new Set();
  for (const node of sourceNodes) {
    const maxDepth = _maxAtlasSubtreeDepth(node);
    for (const depth of [maxDepth - 1, maxDepth]) {
      if (depth < 0) continue;
      for (const match of _collectAtlasNodesAtDepth(node, depth)) {
        if (nodeSeen.has(match)) continue;
        nodeSeen.add(match);
        nodes.push(match);
      }
    }
    const outlineDepth = maxDepth - 1;
    if (outlineDepth >= 0) {
      for (const match of _collectAtlasNodesAtDepth(node, outlineDepth)) {
        if (outlineNodeSeen.has(match)) continue;
        outlineNodeSeen.add(match);
        outlineNodes.push(match);
      }
    }
  }
  const meshes = [];
  const meshSeen = new Set();
  for (const node of nodes) {
    for (const mesh of node.meshes) {
      if (meshSeen.has(mesh)) continue;
      meshSeen.add(mesh);
      _ensureTrackAtlasOutline(mesh);
      meshes.push(mesh);
    }
  }
  const outlineMeshes = [];
  const outlineMeshSeen = new Set();
  for (const node of outlineNodes) {
    for (const mesh of node.meshes) {
      if (outlineMeshSeen.has(mesh)) continue;
      outlineMeshSeen.add(mesh);
      outlineMeshes.push(mesh);
    }
  }
  _trackAtlasNodes = nodes;
  _trackAtlasMeshes = meshes;
  _trackAtlasOutlineMeshes = outlineMeshes;
  return { nodes, meshes, outlineMeshes };
}

export function updateTrackAtlasIntersections() {
  if (!atlasRoot) return;
  const { meshes, outlineMeshes } = _resolveTrackAtlasTargets();
  if (!meshes.length) return;

  const trackGroup = _getTrackGroup();
  // Two questions, two answers:
  //   isHitTrack — purely geometric: does THIS track's polyline pass
  //                through any chamber? Computed for every track in the
  //                group, regardless of visibility. The Particles-panel
  //                filters in detectorGroups.js use this flag to decide
  //                whether a track is "muon-like" (real μ vs unmatched μ),
  //                so resetting it on hidden tracks would break the cycle:
  //                hide → reset isHitTrack → next filter pass can't fire →
  //                track comes back visible.
  //   hitMeshes  — actually-lit chambers: only tracks whose .visible=true
  //                or particleHidden=true (the J-button / "Muon Tracks
  //                off" / etc cases that hide the LINE but keep the
  //                physics) contribute. Unmatched-μ tracks set
  //                particleHidden=false so their chambers go dark too.
  const allTracks = trackGroup ? trackGroup.children : [];
  const hitMeshes = new Set();
  const hitTracks = new Set();

  if (allTracks.length) {
    scene.updateMatrixWorld(true);

    // Cache world-space AABBs for all target meshes once (static geometry).
    if (!_trackAtlasMeshBoxes) {
      _trackAtlasMeshBoxes = meshes.map((m) => new THREE.Box3().setFromObject(m));
    }

    for (const line of allTracks) {
      const pos = line.geometry?.getAttribute('position');
      if (!pos || pos.count < 2) continue;

      // Compute track world-space AABB to pre-filter candidate meshes.
      _trackAtlasTrackBox.makeEmpty();
      for (let i = 0; i < pos.count; i++) {
        _trackAtlasSegA.fromBufferAttribute(pos, i).applyMatrix4(line.matrixWorld);
        _trackAtlasTrackBox.expandByPoint(_trackAtlasSegA);
      }

      // Only test meshes whose AABB overlaps this track's AABB.
      const nearMeshes = [];
      for (let mi = 0; mi < meshes.length; mi++) {
        if (_trackAtlasMeshBoxes[mi].intersectsBox(_trackAtlasTrackBox))
          nearMeshes.push(meshes[mi]);
      }
      if (!nearMeshes.length) continue;

      // Track contributes to chamber lighting iff its line is rendered
      // (or in the "hide line, keep physics" mode). Geometric isHitTrack
      // is recorded for every track regardless.
      const lightsChambers = line.visible || line.userData.particleHidden;
      let lineHit = false;
      for (let i = 0; i < pos.count - 1; i++) {
        _trackAtlasSegA.fromBufferAttribute(pos, i).applyMatrix4(line.matrixWorld);
        _trackAtlasSegB.fromBufferAttribute(pos, i + 1).applyMatrix4(line.matrixWorld);
        _trackAtlasDir.subVectors(_trackAtlasSegB, _trackAtlasSegA);
        const len = _trackAtlasDir.length();
        if (len <= 1e-6) continue;
        _trackAtlasDir.multiplyScalar(1 / len);
        _trackAtlasRay.set(_trackAtlasSegA, _trackAtlasDir);
        _trackAtlasRay.far = len;
        for (const hit of _trackAtlasRay.intersectObjects(nearMeshes, false)) {
          if (lightsChambers) hitMeshes.add(hit.object);
          lineHit = true;
        }
      }
      if (lineHit) hitTracks.add(line);
    }
  }

  // A muon chamber shows only when a track passes through it AND the user
  // hasn't turned that station off in the layers panel
  // (mesh.userData.muonForceVisible). Defaults to AND-true so the prior
  // hit-driven behaviour is preserved out of the box; flipping a panel toggle
  // off vetoes the chamber even when a track hits it.
  let changed = false;
  for (const mesh of meshes) {
    const next = hitMeshes.has(mesh) && !!mesh.userData.muonForceVisible;
    if (mesh.visible !== next) {
      mesh.visible = next;
      changed = true;
    }
  }
  for (const mesh of meshes) {
    if (mesh.userData.trackAtlasOutline)
      mesh.userData.trackAtlasOutline.visible = hitMeshes.has(mesh) && outlineMeshes.includes(mesh);
  }
  if (trackGroup) {
    // Persist the muon-hit verdict on the line itself so the material logic
    // can be re-run later by recomputeJetTrackMatch without needing access to
    // the local `hitTracks` set.
    for (const line of trackGroup.children) {
      line.userData.isHitTrack = hitTracks.has(line);
    }
    applyTrackMaterials(trackGroup);
  }
  if (!changed) return;
  markDirty();
}
