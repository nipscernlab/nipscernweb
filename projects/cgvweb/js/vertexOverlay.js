// Vertex marker overlay.
//
// Renders the primary, pile-up and secondary (b-tag) vertices as small
// spheres. Each marker has a per-frame onBeforeRender that keeps it at a
// fixed pixel size on screen — vertices live ~mm from the origin and would
// otherwise be invisible from any reasonable camera distance.

import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';
import { getVertexGroup, setVertexGroup } from './visibility.js';

// Three vertex flavours, three styles. Sizes in target screen pixels.
const VERTEX_STYLES = {
  primary: { color: 0xffffff, sizePx: 8, opacity: 0.95 },
  pileup: { color: 0x88aaff, sizePx: 4, opacity: 0.55 },
  secondary: { color: 0x00ff88, sizePx: 6, opacity: 0.95 },
};

// Base radius in scene mm — onBeforeRender rescales each frame so the marker
// keeps `sizePx` pixels of apparent radius up to a world-size cap. Without
// that cap, zooming out past the detector envelope makes the marker grow to
// many centimetres and overwhelm the geometry; once we hit the cap, the
// marker shrinks naturally with distance like the rest of the scene.
const VERTEX_BASE_RADIUS_MM = 8;
const VERTEX_MAX_WORLD_RADIUS_MM = 30;
const _GEO = new THREE.SphereGeometry(VERTEX_BASE_RADIUS_MM, 12, 8);
const _MATS = {
  primary: new THREE.MeshBasicMaterial({
    color: VERTEX_STYLES.primary.color,
    transparent: true,
    opacity: VERTEX_STYLES.primary.opacity,
    depthTest: false,
    depthWrite: false,
  }),
  pileup: new THREE.MeshBasicMaterial({
    color: VERTEX_STYLES.pileup.color,
    transparent: true,
    opacity: VERTEX_STYLES.pileup.opacity,
    depthTest: false,
    depthWrite: false,
  }),
  secondary: new THREE.MeshBasicMaterial({
    color: VERTEX_STYLES.secondary.color,
    transparent: true,
    opacity: VERTEX_STYLES.secondary.opacity,
    depthTest: false,
    depthWrite: false,
  }),
};

const _tmpVec2 = new THREE.Vector2();
function _makeOnBeforeRender(sizePx) {
  return function (renderer, _scene, camera) {
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
    // min(pixel-driven, world-cap): up close we want the marker readable
    // (pixel size dominates), far out we want it to shrink with the scene
    // so it doesn't dwarf the detector (the cap dominates).
    const targetWorldRadius = Math.min(VERTEX_MAX_WORLD_RADIUS_MM, sizePx * worldUnitsPerPx);
    this.scale.setScalar(targetWorldRadius / VERTEX_BASE_RADIUS_MM);
    this.updateMatrix();
    if (this.parent) {
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    } else {
      this.matrixWorld.copy(this.matrix);
    }
  };
}

export function clearVertices() {
  const g = getVertexGroup();
  if (!g) return;
  // Geometry and materials are shared singletons — never dispose them here.
  scene.remove(g);
  setVertexGroup(null);
}

// vertices: { primary, pileup, secondary } — empty arrays are OK.
export function drawVertices(vertices) {
  clearVertices();
  if (!vertices) return;
  const all = [
    ...(vertices.primary ?? []).map((v) => ({ ...v, kind: 'primary' })),
    ...(vertices.pileup ?? []).map((v) => ({ ...v, kind: 'pileup' })),
    ...(vertices.secondary ?? []).map((v) => ({ ...v, kind: 'secondary' })),
  ];
  if (!all.length) return;

  const g = new THREE.Group();
  g.renderOrder = 31; // above hit markers (renderOrder 30)
  for (const v of all) {
    const style = VERTEX_STYLES[v.kind];
    const m = new THREE.Mesh(_GEO, _MATS[v.kind]);
    m.position.copy(v.position);
    m.onBeforeRender = _makeOnBeforeRender(style.sizePx);
    m.userData.vertexKind = v.kind;
    m.userData.numTracks = v.numTracks;
    m.userData.vertexKey = v.key;
    m.userData.position = v.position;
    g.add(m);
  }
  scene.add(g);
  setVertexGroup(g);
  markDirty();
}
