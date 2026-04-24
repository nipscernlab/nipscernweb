import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';

// Track line materials — shared with drawTracks() so hit/miss restyling stays consistent.
export const TRACK_MAT = new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 2 });
const TRACK_HIT_MAT = new THREE.LineBasicMaterial({ color: 0x4a90d9, linewidth: 2 });

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

const TRACK_ATLAS_TARGET_NODE_NAMES = ['MUCH_1', 'MUC1_2'];
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

export function initTrackAtlasIntersections({ getTrackGroup }) {
  _getTrackGroup = getTrackGroup;
}

export function setAtlasRoot(tree) {
  atlasRoot = tree;
  _trackAtlasNodes = null;
  _trackAtlasMeshes = null;
  _trackAtlasOutlineMeshes = null;
  _trackAtlasMeshBoxes = null;
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
  outline.matrixAutoUpdate = false;
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
  const visibleTracks =
    trackGroup && trackGroup.visible ? trackGroup.children.filter((c) => c.visible) : [];
  const hitMeshes = new Set();
  const hitTracks = new Set();

  if (visibleTracks.length) {
    scene.updateMatrixWorld(true);

    // Cache world-space AABBs for all target meshes once (static geometry).
    if (!_trackAtlasMeshBoxes) {
      _trackAtlasMeshBoxes = meshes.map((m) => new THREE.Box3().setFromObject(m));
    }

    for (const line of visibleTracks) {
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
          hitMeshes.add(hit.object);
          lineHit = true;
        }
      }
      if (lineHit) hitTracks.add(line);
    }
  }

  let changed = false;
  for (const mesh of meshes) {
    const next = hitMeshes.has(mesh);
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
    for (const line of trackGroup.children)
      line.material = hitTracks.has(line) ? TRACK_HIT_MAT : TRACK_MAT;
  }
  if (!changed) return;
  markDirty();
}
