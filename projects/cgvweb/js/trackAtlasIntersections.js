import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';

// Track line materials — shared with drawTracks() so hit/miss restyling stays consistent.
export const TRACK_MAT = new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 2 });
const TRACK_HIT_MAT = new THREE.LineBasicMaterial({ color: 0x4a90d9, linewidth: 2 });
// Tracks belonging to a jet in the active jet collection: paint them in the
// jet's own colour (orange) so visually associating "this track came out of
// that jato" is immediate.
const TRACK_JET_MAT = new THREE.LineBasicMaterial({ color: 0xff8800, linewidth: 2 });
// Tracks attached to a hadronic τ candidate: purple, same hue as the τ line.
const TRACK_TAU_MAT = new THREE.LineBasicMaterial({ color: 0xb366ff, linewidth: 2 });
// Tracks matched to a reconstructed electron / positron by ΔR — coloured to
// match the electron arrow so the eye links the track with the e±.
const TRACK_ELECTRON_NEG_MAT = new THREE.LineBasicMaterial({ color: 0xff3030, linewidth: 2 });
const TRACK_ELECTRON_POS_MAT = new THREE.LineBasicMaterial({ color: 0x33dd55, linewidth: 2 });

// Maps the xAOD track-collection names that jets reference to the legacy
// (old-AOD) collection names that JiveXML actually publishes the polylines
// under. By convention the two run parallel — element i of one matches
// element i of the other — which is the bridge for jet→track highlighting.
// Only collections we actually render are listed; mappings for skipped ones
// (GSFTracks, MS-only-extrapolated, etc.) would never resolve to a line.
const _XAOD_TO_AOD_TRACK_KEY = {
  InDetTrackParticles_xAOD: 'CombinedInDetTracks',
  CombinedMuonTrackParticles_xAOD: 'CombinedMuonTracks',
};

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
    // Persist the muon-hit verdict on the line itself so the material logic
    // can be re-run later by recomputeJetTrackMatch without needing access to
    // the local `hitTracks` set.
    for (const line of trackGroup.children) {
      line.userData.isHitTrack = hitTracks.has(line);
    }
    _applyTrackMaterials(trackGroup);
  }
  if (!changed) return;
  markDirty();
}

// Applies the priority chain to every track line:
//   electron / positron match (red / green) > τ-match (purple) >
//   jet-match (orange) > muon-chamber hit (blue) > default (yellow).
// Each source flag lives on userData; this loop is the single place that knows
// about the priority ordering. Electron beats τ because e± identification is
// the most specific. τ beats jet because hadronic τs *are* narrow jets — the
// τ ID is a stricter classification of the same object, and the explicit
// (key, index) link from <TauJet> is more authoritative than the jet's track
// list, which can include the same tracks via overlap.
function _applyTrackMaterials(trackGroup) {
  for (const line of trackGroup.children) {
    const ePdg = line.userData.matchedElectronPdgId;
    if (ePdg != null) {
      line.material = ePdg < 0 ? TRACK_ELECTRON_NEG_MAT : TRACK_ELECTRON_POS_MAT;
    } else if (line.userData.isTauMatched) {
      line.material = TRACK_TAU_MAT;
    } else if (line.userData.isJetMatched) {
      line.material = TRACK_JET_MAT;
    } else if (line.userData.isHitTrack) {
      line.material = TRACK_HIT_MAT;
    } else {
      line.material = TRACK_MAT;
    }
  }
}

// Recomputes the `isJetMatched` flag on each rendered track line based on the
// active jet collection and the current jet ET threshold. Then re-applies the
// material priority directly (independent of updateTrackAtlasIntersections,
// which can early-return before atlasRoot is loaded).
export function recomputeJetTrackMatch(activeJetCollection, thrJetEtGev) {
  const trackGroup = _getTrackGroup();
  if (!trackGroup) return;
  // Build the matched key set: "<aod_collection>#<index>".
  const matched = new Set();
  if (activeJetCollection) {
    for (const j of activeJetCollection.jets) {
      if (j.etGev < thrJetEtGev) continue;
      for (const t of j.tracks) {
        const aod = _XAOD_TO_AOD_TRACK_KEY[t.key];
        if (!aod) continue;
        matched.add(`${aod}#${t.index}`);
      }
    }
  }
  for (const line of trackGroup.children) {
    const k = line.userData.storeGateKey;
    const i = line.userData.indexInCollection;
    line.userData.isJetMatched = k != null && i != null && matched.has(`${k}#${i}`);
  }
  _applyTrackMaterials(trackGroup);
  markDirty();
}

// Resolves each TauJet's <trackKey>/<trackIndex> pairs to the rendered track
// lines and stamps `isTauMatched` accordingly. Direct (key, index) lookup —
// no heuristic — because <TauJet> publishes the link explicitly. Same xAOD →
// AOD key bridge as jet→track. `taus` may be null (clears all matches).
export function recomputeTauTrackMatch(taus) {
  const trackGroup = _getTrackGroup();
  if (!trackGroup) return;
  const matched = new Set();
  if (taus && taus.length) {
    for (const t of taus) {
      for (const trk of t.tracks) {
        const aod = _XAOD_TO_AOD_TRACK_KEY[trk.key];
        if (!aod) continue;
        matched.add(`${aod}#${trk.index}`);
      }
    }
  }
  for (const line of trackGroup.children) {
    const k = line.userData.storeGateKey;
    const i = line.userData.indexInCollection;
    line.userData.isTauMatched = k != null && i != null && matched.has(`${k}#${i}`);
  }
  _applyTrackMaterials(trackGroup);
  markDirty();
}

// Heuristic ΔR matching from each electron to its closest track. JiveXML
// doesn't publish the official egamma → track link, so we use η/φ proximity
// — sufficient because the ATLAS reconstruction puts electron clusters within
// ~0.025 of the matched track, and our threshold is generous.
//
// Pre-matching filters:
//   • Electron pT ≥ 3 GeV: cuts out the very softest egamma candidates while
//     still catching most physics electrons.
//   • Track must be visible (passes the user's track pT slider): hidden soft
//     tracks won't steal the match from the real electron track.
//   • Track must come from the inner-detector-only collection: muons that
//     happen to fall close in η/φ to an egamma cluster (rare but not zero —
//     e.g. an EM cluster shadow next to a real muon) would otherwise grab
//     the slot, and CombinedMuonTracks polylines extend all the way to the
//     muon chambers, so colouring them red would visually suggest "electron
//     exiting through the muon system" — physically impossible.
const _ELECTRON_TRACK_DR_MAX = 0.05;
const _ELECTRON_PT_MIN_GEV = 3;
const _ELECTRON_TRACK_COLLECTION = 'CombinedInDetTracks';
export function recomputeElectronTrackMatch(electrons) {
  const trackGroup = _getTrackGroup();
  if (!trackGroup) return;
  // Reset previous matches.
  for (const line of trackGroup.children) line.userData.matchedElectronPdgId = null;

  if (electrons && electrons.length) {
    for (const e of electrons) {
      if (!Number.isFinite(e.eta) || !Number.isFinite(e.phi)) continue;
      if (Number.isFinite(e.ptGev) && e.ptGev < _ELECTRON_PT_MIN_GEV) continue;
      let best = null;
      let bestDR = _ELECTRON_TRACK_DR_MAX;
      for (const line of trackGroup.children) {
        // Only ID-only tracks are eligible: a CombinedMuonTracks line with a
        // long polyline would, if matched, get coloured red along its full
        // 10 m extent — making the e± look like a muon.
        if (line.userData.storeGateKey !== _ELECTRON_TRACK_COLLECTION) continue;
        // Hidden tracks (below user pT threshold) can't claim a match —
        // otherwise a soft pile-up track would steal the slot from the real
        // visible electron track.
        if (!line.visible) continue;
        const tEta = line.userData.eta;
        const tPhi = line.userData.phi;
        if (!Number.isFinite(tEta) || !Number.isFinite(tPhi)) continue;
        // Skip already-claimed tracks so two electrons can't grab the same one.
        if (line.userData.matchedElectronPdgId != null) continue;
        const dEta = e.eta - tEta;
        let dPhi = e.phi - tPhi;
        if (dPhi > Math.PI) dPhi -= 2 * Math.PI;
        else if (dPhi < -Math.PI) dPhi += 2 * Math.PI;
        const dR = Math.sqrt(dEta * dEta + dPhi * dPhi);
        if (dR < bestDR) {
          bestDR = dR;
          best = line;
        }
      }
      if (best) best.userData.matchedElectronPdgId = e.pdgId;
    }
  }
  _applyTrackMaterials(trackGroup);
  markDirty();
}
