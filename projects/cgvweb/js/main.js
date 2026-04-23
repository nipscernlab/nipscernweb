import * as THREE        from 'three';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import { initLanguage, setupLanguagePicker, t } from './i18n/index.js';
import { setupLiveMode } from './liveMode.js';
import { setupSidebarControls } from './sidebarControls.js';
import { createSlicerController } from './slicer.js';
import { setupLocalMode } from './localMode.js';
import { setupSampleMode } from './sampleMode.js';
import { registerViewerShortcuts } from './viewerShortcuts.js';
import {
  _wasmPool, SUBSYS_TILE, SUBSYS_LAR_EM, SUBSYS_LAR_HEC,
  meshByKey, cellMeshesByDet, active, rayTargets,
  _ZERO_MAT4, _markIMDirty, _flushIMDirty,
  _allCellIMeshes, _rayIMeshes,
  _tileKey, _larEmKey, _hecKey,
} from './state.js';
import {
  PAL_TILE_COLOR, PAL_HEC_COLOR, PAL_LAR_COLOR,
  matTile, matHec, matLAr,
  TILE_SCALE, HEC_SCALE, LAR_SCALE, FCAL_SCALE,
  palColorTile, palColorHec, palColorLAr, palColorFcalRgb,
} from './palette.js';
import { setLoadProgress, dismissLoadingScreen, bumpReq } from './loading.js';
import {
  markDirty, isDirty, clearDirty,
  canvas, renderer, scene, camera, controls, dirLight,
} from './renderer.js';
import {
  GHOST_MESH_NAMES, ghostVisible, ghostMeshByName,
  anyGhostOn, applyGhostMeshOne, applyAllGhostMeshes, syncGhostToggles,
  toggleGhostByName, setAllGhosts, toggleAllGhosts,
  enableDefaultGhosts, updateGhostColors,
} from './ghost.js';
import {
  cellLabel, HEC_NAMES, HEC_INNER,
  physLarEmEta, physLarEmPhi, physLarHecEta, physLarHecPhi,
  physTileEta, physTilePhi, _wrapPhi,
} from './coords.js';
import { initScene } from './loader.js';
import {
  parseXmlDoc, parseEventInfo,
  parseTile, parseLAr, parseHec, parseMBTS, parseFcal,
  parseTracks, parsePhotons, parseClusters,
} from './parser.js';
import { setupColorPicker } from './colorpicker.js';
import { setupCinemaControls } from './cinema.js';
import { setupScreenshotControls } from './screenshot.js';
import { setupDetectorPanels } from './detectorPanels.js';
import { fmtSize, esc, makeRelTime } from './utils.js';
import { createDownloadProgressController } from './progress.js';

let LivePoller = null;
try { ({ LivePoller } = await import('../live_atlas/live_cern/live_poller.js')); } catch (_) {}

initLanguage();
setupLanguagePicker();


let tileMaxMev = 1, tileMinMev = 0;
let larMaxMev  = 1, larMinMev  = 0;
let hecMaxMev  = 1, hecMinMev  = 0;
let thrTileMev = 50;   // 0.05 GeV default
let thrLArMev  = 0;    // 0    GeV default
let thrHecMev  = 600;  // 0.6  GeV default
let thrFcalMev = 0;    // 0    GeV default

let showTile   = true;
let showLAr    = true;
let showHec    = true;
let showFcal   = true;

let wasmOk     = false;
let sceneOk    = false;
let isLive     = true;
let showInfo   = true;

// Ghost visibility is tracked per-mesh in `ghostVisible` (see GHOST_MESH_NAMES).
let beamGroup  = null;
let beamOn     = false;
let allOutlinesMesh = null;
let sidebarControls = null;
let trackGroup    = null;
let clusterGroup  = null;
let photonGroup   = null;
let fcalGroup     = null;
let fcalCellsData  = [];   // cached for threshold rebuilds
let fcalVisibleMap = [];   // [instanceId] → cell object for the current visible set
let lastClusterData       = null;  // { collections: [{key, clusters: [{eta,phi,etGev,cells:{TILE,LAR_EM,HEC,OTHER}}]}] }
let activeClusterCellIds  = null;  // null = no cluster filter; Set<string> = only these cell IDs are visible
let activeMbtsLabels      = null;  // null = no cluster filter; Set<string> = MBTS labels activated by cluster eta/phi
let clusterFilterEnabled  = true;
let _readyFired  = false;



// ── Atlas structural geometry (from atlas.root merged into GLB) ───────────────
const atlasMat = new THREE.MeshBasicMaterial({
  color: 0x4A90D9, transparent: true, opacity: 0.07,
  depthWrite: false, side: THREE.DoubleSide,
});
const atlasTrackHitMat = new THREE.MeshBasicMaterial({
  color: 0x4A90D9, transparent: true, opacity: 0.035,
  depthWrite: false, side: THREE.DoubleSide,
});
const trackAtlasOutlineMat = new THREE.LineBasicMaterial({
  color: 0x4A90D9, transparent: true, opacity: 0.15, depthWrite: false,
});
let atlasRoot = null; // tree root node (built after GLB loads)
const TRACK_ATLAS_TARGET_NODE_NAMES = ['MUCH_1', 'MUC1_2'];
let _trackAtlasNodes = null;
let _trackAtlasMeshes = null;
let _trackAtlasOutlineMeshes = null;
let _trackAtlasMeshBoxes = null;
const _trackAtlasRay = new THREE.Raycaster();
const _trackAtlasSegA = new THREE.Vector3();
const _trackAtlasSegB = new THREE.Vector3();
const _trackAtlasDir  = new THREE.Vector3();
const _trackAtlasEdgeGeoCache = new Map();

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
  for (const child of node.children.values())
    _collectAtlasNodesAtDepth(child, depth - 1, out);
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
    return { nodes: _trackAtlasNodes, meshes: _trackAtlasMeshes, outlineMeshes: _trackAtlasOutlineMeshes };
  const sourceNodes = [];
  const seen        = new Set();
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
  _trackAtlasNodes  = nodes;
  _trackAtlasMeshes = meshes;
  _trackAtlasOutlineMeshes = outlineMeshes;
  return { nodes, meshes, outlineMeshes };
}

const _trackAtlasTrackBox = new THREE.Box3();

function updateTrackAtlasIntersections() {
  if (!atlasRoot) return;
  const { nodes, meshes, outlineMeshes } = _resolveTrackAtlasTargets();
  if (!meshes.length) return;

  const visibleTracks = (trackGroup && trackGroup.visible)
    ? trackGroup.children.filter(c => c.visible)
    : [];
  const hitMeshes = new Set();
  const hitTracks = new Set();

  if (visibleTracks.length) {
    scene.updateMatrixWorld(true);

    // Cache world-space AABBs for all target meshes once (static geometry).
    if (!_trackAtlasMeshBoxes) {
      _trackAtlasMeshBoxes = meshes.map(m => new THREE.Box3().setFromObject(m));
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


// Tooltip + dirty on camera drag.
let _ctrlActive = false;
controls.addEventListener('start',  () => { _ctrlActive = true; });
controls.addEventListener('end',    () => { _ctrlActive = false; });
controls.addEventListener('change', () => {
  markDirty();
  if (!cinema.isCinemaMode() && _ctrlActive) { tooltip.hidden = true; clearOutline(); }
});

// ── FPS counter ──────────────────────────────────────────────────────────────
const fpsEl = document.createElement('div');
Object.assign(fpsEl.style, {
  position: 'fixed', bottom: '8px', right: '10px', zIndex: '9999',
  fontFamily: 'monospace', fontSize: '13px', color: '#66ccff',
  opacity: '0.45', pointerEvents: 'none', userSelect: 'none',
});
document.body.appendChild(fpsEl);
let _fpsFrames = 0, _fpsLast = performance.now();

// ── Render loop ───────────────────────────────────────────────────────────────
// Paused while the tab is hidden: browsers already throttle RAF on hidden tabs,
// but stopping the loop entirely frees the main thread for other tabs. Resumed
// on visibilitychange.
let _loopRunning = false;
let _loopRafId = 0;
let _resumeWarmFrames = 0;
function _scheduleWarmFrames(count = 12) {
  _resumeWarmFrames = Math.max(_resumeWarmFrames, count | 0);
  markDirty();
}
function _restoreRendererAfterFocus() {
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  dirLight.position.copy(camera.position);
  controls.update();
  if (renderer.isWebGLRenderer) {
    if (typeof renderer.resetState === 'function') renderer.resetState();
    if (renderer.info && typeof renderer.info.reset === 'function') renderer.info.reset();
  }
  _scheduleWarmFrames(18);
}
function _loopTick() {
  if (!_loopRunning) {
    _loopRafId = 0;
    return;
  }
  _loopRafId = requestAnimationFrame(_loopTick);
  _fpsFrames++;
  const now = performance.now();
  if (now - _fpsLast >= 500) {
    fpsEl.textContent = ((_fpsFrames / (now - _fpsLast)) * 1000).toFixed(0) + ' FPS';
    _fpsFrames = 0; _fpsLast = now;
  }
  if (cinema.isAnimating()) cinema.tick();
  controls.update();
  if (_resumeWarmFrames > 0) {
    _resumeWarmFrames--;
    markDirty();
  }
  if (controls.autoRotate) markDirty();
  if (!isDirty()) return;
  renderer.render(scene, camera);
  clearDirty();
}
function _startLoop() {
  if (_loopRunning) return;
  _loopRunning = true;
  _fpsLast = performance.now(); _fpsFrames = 0;
  markDirty();
  if (!_loopRafId) _loopRafId = requestAnimationFrame(_loopTick);
}
function _stopLoop() {
  _loopRunning = false;
  if (_loopRafId) {
    cancelAnimationFrame(_loopRafId);
    _loopRafId = 0;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) _stopLoop();
  else {
    _restoreRendererAfterFocus();
    _startLoop();
  }
});
_startLoop();
window.addEventListener('focus', () => {
  _restoreRendererAfterFocus();
  _startLoop();
});
window.addEventListener('pageshow', () => {
  _restoreRendererAfterFocus();
  _startLoop();
});
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  markDirty();
});

// ── Status bar ────────────────────────────────────────────────────────────────
const statusTxtEl = document.getElementById('status-txt');
function setStatus(h) { statusTxtEl.innerHTML = h; }
function checkReady() {
  if (!wasmOk || !sceneOk) return;
  setStatus(t('status-ready'));
  if (!_readyFired) {
    _readyFired = true;
    setLoadProgress(100, 'Ready');
    // Enable the default TileCal ghost envelopes on startup.
    enableDefaultGhosts();
    // Dismiss loading screen after a brief moment so 100% is visible
    setTimeout(dismissLoadingScreen, 280);
  }
  if (isLive && poller) {
    poller.start();
    liveMode.loadFirstAvailableEvent();
  }
}

// ── GLB loader (with OPFS cache) ──────────────────────────────────────────────
// ── Geometry + WASM initialisation ─────────────────────────────────────────
initScene({
  setStatus,
  atlasMat,
  onSceneReady() { sceneOk = true; markDirty(); checkReady(); },
  onAtlasReady(tree) {
    atlasRoot = tree;
    _trackAtlasNodes = null; _trackAtlasMeshes = null;
    _trackAtlasOutlineMeshes = null; _trackAtlasMeshBoxes = null;
  },
});
_wasmPool.init()
  .then(() => { wasmOk = true; checkReady(); })
  .catch(e => { setStatus(`<span class="err">WASM: ${esc(e && e.message || String(e))}</span>`); });

let _lastEventInfo = null;

// ── Collision info HUD ────────────────────────────────────────────────────────
const collisionHud = document.getElementById('collision-hud');
function _buildCollisionHud() {
  const info = _lastEventInfo;
  if (!info) { collisionHud.innerHTML = ''; return; }
  const fields = [
    ['Date/Time',    info.dateTime],
    ['Run',          info.runNumber],
    ['Event',        info.eventNumber],
    ['Lumi Block',   info.lumiBlock],
    ['Version',      info.version],
  ];
  collisionHud.innerHTML = fields
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="ch-key">${esc(k)}</span><span class="ch-val">${esc(v)}</span>`)
    .join('');
}
function updateCollisionHud() {
  const visible = !(sidebarControls ? sidebarControls.getState().panelPinned : true) || cinema.isCinemaMode();
  collisionHud.hidden = !(visible && _lastEventInfo);
  if (!collisionHud.hidden) _buildCollisionHud();
}

function showEventInfo(info) {
  _lastEventInfo = info;
  updateCollisionHud();
  if (!info) { setStatus('<span class="muted">No event metadata</span>'); return; }
  const dt  = info.dateTime   || '—';
  const run = info.runNumber  || '—';
  const evt = info.eventNumber|| '—';
  const lb  = info.lumiBlock  || '—';
  setStatus(
    `<span class="ev-dt">${esc(dt)}</span>` +
    `<span class="ev-sep">·</span>` +
    `<span class="ev-meta">Run <b>${esc(run)}</b></span>` +
    `<span class="ev-sep">·</span>` +
    `<span class="ev-meta">Evt <b>${esc(evt)}</b></span>` +
    `<span class="ev-sep">·</span>` +
    `<span class="ev-meta">LB <b>${esc(lb)}</b></span>`
  );
}


// ── Track rendering ───────────────────────────────────────────────────────────
let thrTrackGev   = 2;
let trackPtMinGev = 0;
let trackPtMaxGev = 5;

// ── Cluster Et threshold ──────────────────────────────────────────────────────
let thrClusterEtGev   = 0;
let clusterEtMinGev   = 0;
let clusterEtMaxGev   = 1;
let tileSlider = null;
let larSlider = null;
let fcalSlider = null;
let hecSlider = null;
let trackPtSlider = null;
let clusterEtSlider = null;
let initDetPanel = null;
const relTime = makeRelTime(t);
const { startProgress, advanceProgress, endProgress } = createDownloadProgressController();

const TRACK_MAT = new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 2 });
const TRACK_HIT_MAT = new THREE.LineBasicMaterial({ color: 0x4A90D9, linewidth: 2 });

function clearTracks() {
  if (!trackGroup) return;
  trackGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(trackGroup);
  trackGroup = null;
  updateTrackAtlasIntersections();
}

function applyTrackThreshold() {
  if (trackGroup)
    for (const child of trackGroup.children)
      child.visible = child.userData.ptGev >= thrTrackGev;
  if (photonGroup)
    for (const child of photonGroup.children)
      child.visible = child.userData.ptGev >= thrTrackGev;
  updateTrackAtlasIntersections();
  markDirty();
}

function drawTracks(tracks) {
  clearTracks();
  if (!tracks.length) return;
  trackGroup = new THREE.Group();
  trackGroup.renderOrder = 5;
  trackGroup.visible = (typeof tracksVisible === 'undefined') ? true : tracksVisible;
  for (const { pts, ptGev, hitIds, storeGateKey } of tracks) {
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, TRACK_MAT);
    line.userData.ptGev        = ptGev;
    line.userData.hitIds       = hitIds;
    line.userData.storeGateKey = storeGateKey;
    line.matrixAutoUpdate = false;
    trackGroup.add(line);
  }
  trackGroup.matrixAutoUpdate = false;
  scene.add(trackGroup);
  applyTrackThreshold();
  updateTrackAtlasIntersections();
}

// ── Cluster line rendering ────────────────────────────────────────────────────
// Lines are drawn from the origin in the η/φ direction, 5 m = 5000 mm long.
// Coordinate convention matches tracks: Three.js X = −ATLAS x, Y = −ATLAS y.
const CLUSTER_MAT = new THREE.LineDashedMaterial({
  color: 0xff4400, transparent: true, opacity: 0.20,
  dashSize: 40, gapSize: 60, depthWrite: false,
});
const PHOTON_MAT = new THREE.LineBasicMaterial({
  color: 0xFFCC00, transparent: true, opacity: 0.85, depthWrite: false,
});
const PHOTON_PRE_INNER_MM     = 800;   // start the spring 80 cm before the inner LAr cylinder
const PHOTON_SPRING_R         = 20;    // helix radius in mm
const PHOTON_SPRING_TURNS_PER_MM = 0.014; // coils per mm of track length
const PHOTON_SPRING_PTS       = 22;   // points sampled per coil (smoothness)
const PHOTON_TRACK_DIR_DOT_MIN = 0.97;
const PHOTON_TRACK_RADIAL_TOL_MM = 250;
// Inner cylinder (start): r = 1.4 m, h = 6.4 m
const CLUSTER_CYL_IN_R      = 1421.730;
const CLUSTER_CYL_IN_HALF_H = 3680.75;
// Outer cylinder (end):   r = 4.25 m, h = 12 m
const CLUSTER_CYL_OUT_R      = 3820;
const CLUSTER_CYL_OUT_HALF_H = 6000;

// Returns t at which the unit-direction ray (dx,dy,dz) from the origin hits
// the surface of a cylinder with given radius and half-height.
function _cylIntersect(dx, dy, dz, r, halfH) {
  const rT = Math.sqrt(dx * dx + dy * dy);
  if (rT > 1e-9) {
    const tBarrel = r / rT;
    if (Math.abs(dz * tBarrel) <= halfH) return tBarrel;
  }
  return halfH / Math.abs(dz);
}

function clearClusters() {
  if (!clusterGroup) return;
  clusterGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(clusterGroup);
  clusterGroup = null;
}

// ── Photon spring rendering ────────────────────────────────────────────────────
// Photons are shown as a helix (spring) in the η/φ direction from the origin,
// matching the conventional Feynman-diagram wavy-line symbol.

function _makeSpringPoints(dx, dy, dz, totalLen, radius, nTurns, ptsPerTurn) {
  const fwd = new THREE.Vector3(dx, dy, dz).normalize();
  const ref = Math.abs(fwd.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(fwd, ref).normalize();
  const up    = new THREE.Vector3().crossVectors(fwd, right).normalize();
  const startOffset = Math.max(0, totalLen - PHOTON_PRE_INNER_MM);
  const visibleLen  = Math.max(0, totalLen - startOffset);
  const nTotal = nTurns * ptsPerTurn + 1;
  const pts = [];
  for (let i = 0; i < nTotal; i++) {
    const t     = i / (nTotal - 1);
    const angle = t * nTurns * 2 * Math.PI;
    const along = startOffset + t * visibleLen;
    const cx    = Math.cos(angle) * radius;
    const cy    = Math.sin(angle) * radius;
    pts.push(new THREE.Vector3(
      fwd.x * along + right.x * cx + up.x * cy,
      fwd.y * along + right.y * cx + up.y * cy,
      fwd.z * along + right.z * cx + up.z * cy,
    ));
  }
  return pts;
}


function clearPhotons() {
  if (!photonGroup) return;
  photonGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(photonGroup);
  photonGroup = null;
}

function drawPhotons(photons) {
  clearPhotons();
  if (!photons.length) return;
  photonGroup = new THREE.Group();
  photonGroup.renderOrder = 7;
  photonGroup.visible = (typeof tracksVisible === 'undefined') ? true : tracksVisible;
  for (const { eta, phi, ptGev } of photons) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT  = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz =  Math.cos(theta);
    const tEnd = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
    const nTurns = Math.round(PHOTON_SPRING_TURNS_PER_MM * Math.min(PHOTON_PRE_INNER_MM, tEnd));
    const pts  = _makeSpringPoints(dx, dy, dz, tEnd, PHOTON_SPRING_R, nTurns, PHOTON_SPRING_PTS);
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, PHOTON_MAT);
    line.userData.ptGev = ptGev;
    line.visible = ptGev >= thrTrackGev;
    photonGroup.add(line);
  }
  photonGroup.matrixAutoUpdate = false;
  scene.add(photonGroup);
}

// ── FCAL tube rendering ────────────────────────────────────────────────────────
// Each cell is an InstancedMesh cylinder: centre at midpoint, aligned to (dx,dy,dz),
// radius 25 mm (diameter 50 mm), colour from copper palette keyed on |energy|.
// Uses MeshStandardMaterial + per-instance colour via setColorAt,
// matching the approach used for Tile/LAr/HEC cell materials.
// Coordinate convention: ATLAS x→–X, y→–Y, z→Z ; cm × 10 = mm.

function clearFcal() {
  if (!fcalGroup) return;
  fcalGroup.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  scene.remove(fcalGroup);
  fcalGroup = null;
}

function drawFcal(cells) {
  clearFcal();
  fcalCellsData = cells;
  if (!cells.length) return;
  _applyFcalDraw();
}

// Rebuild visible tubes from fcalCellsData with current threshold/show state.
// Keeps fcalGroup in the scene; only replaces its child InstancedMesh.
function applyFcalThreshold() {
  if (!fcalCellsData.length) return;
  if (fcalGroup) {
    for (const child of [...fcalGroup.children]) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      fcalGroup.remove(child);
    }
  }
  _applyFcalDraw();
}

// Reusable helpers — allocated once, reused across rebuilds.
const _fcalUp    = new THREE.Vector3(0, 1, 0);
const _fcalDir   = new THREE.Vector3();
const _fcalDummy = new THREE.Object3D();
const _fcalCol   = new THREE.Color();
const _fcalMat4  = new THREE.Matrix4();
const _fcalTwist = new THREE.Quaternion();
const _fcalTwistAxis = new THREE.Vector3(0, 1, 0);
const _FCAL_TWIST_RAD = (2 * Math.PI) / 16;
// Edge base for outline: local-space positions of all edges of CylinderGeometry(25,25,1,6).
// Lazily computed once (same parameters every time).
let _fcalEdgeBase = null;
function _getFcalEdgeBase() {
  if (_fcalEdgeBase) return _fcalEdgeBase;
  const tmpGeo  = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const edgeGeo = new THREE.EdgesGeometry(tmpGeo, 30);
  tmpGeo.dispose();
  _fcalEdgeBase = edgeGeo.getAttribute('position').array.slice(); // copy — edgeGeo is discarded
  edgeGeo.dispose();
  return _fcalEdgeBase;
}

function _applyFcalDraw() {
  // While the slicer is active, also carve FCAL tubes whose centre sits inside
  // the Z-aligned cylindrical wedge anchored at the ATLAS origin. FCAL cells
  // use (x,y,z,dz) in cm — convert to scene mm (×10).
  const slicerMask = slicer.getMaskState();

  const visible = fcalCellsData.filter(c => {
    if (!showFcal) return false;
    // Hide cells with negative energy — they aren't physically meaningful for
    // display, unless show-all is on (user explicitly asked for every cell).
    if (!slicer.isShowAllCells() && c.energy < 0) return false;
    if (!slicer.isShowAllCells() && c.energy * 1000 < thrFcalMev) return false;
    if (!slicer.isShowAllCells() && activeClusterCellIds !== null && c.id && !activeClusterCellIds.has(c.id)) return false;
    if (slicerMask.active) {
      const cx = -c.x * 10, cy = -c.y * 10, cz = c.z * 10;
      if (slicer.isPointInsideWedge(cx, cy, cz, slicerMask)) return false;
    }
    return true;
  });
  fcalVisibleMap = visible;   // instance index i → visible[i] for tooltip lookup
  if (!fcalGroup) {
    fcalGroup = new THREE.Group();
    fcalGroup.matrixAutoUpdate = false;
    scene.add(fcalGroup);
  }
  if (!visible.length) { markDirty(); return; }

  const n      = visible.length;
  // Shared geometry: unit-height cylinder (height scaled per instance via matrix).
  // 6 radial segments keeps poly count low; openEnded:false adds caps.
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  // MeshStandardMaterial, colour 0xffffff so per-instance colour shows directly.
  const cylMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.FrontSide });
  const iMesh  = new THREE.InstancedMesh(cylGeo, cylMat, n);
  iMesh.matrixAutoUpdate = false;

  for (let i = 0; i < n; i++) {
    const { x, y, z, dx, dy, dz, energy } = visible[i];
    // Tube runs along Z only: centre at (x, y, z), length = 2·dz (full cell depth).
    // dx/dy are transverse half-widths — not the tube direction.
    const rx  = Math.max(Math.abs(dx) * 5, 1e-3);
    const ry  = Math.max(Math.abs(dy) * 5, 1e-3);
    const len = Math.max(Math.abs(dz) * 2 * 10, 1e-3);   // cm → mm, full depth
    const cx  = -x * 10,  cy = -y * 10,  cz = z * 10;
    // Direction: +Z or -Z depending on which side of the detector
    _fcalDir.set(0, 0, dz >= 0 ? 1 : -1);
    // Place cylinder: centre at cell centre, Y-axis aligned to ±Z, scaled to length
    _fcalDummy.position.set(cx, cy, cz);
    _fcalDummy.scale.set(rx, len, ry);
    _fcalDummy.quaternion.setFromUnitVectors(_fcalUp, _fcalDir);
    _fcalTwist.setFromAxisAngle(_fcalTwistAxis, _FCAL_TWIST_RAD);
    _fcalDummy.quaternion.multiply(_fcalTwist);
    _fcalDummy.updateMatrix();
    iMesh.setMatrixAt(i, _fcalDummy.matrix);
    // Per-instance colour from copper palette
    const [r, g, b] = palColorFcalRgb(Math.abs(energy) * 1000 / FCAL_SCALE);
    _fcalCol.setRGB(r, g, b);
    iMesh.setColorAt(i, _fcalCol);
  }
  iMesh.instanceMatrix.needsUpdate = true;
  if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;
  fcalGroup.add(iMesh);

  // ── Outline: transform local cylinder edges into world-space for every instance ──
  // Mirrors the strategy used by _buildOutlinesNow for Tile/LAr/HEC cells:
  // collect all edge segments into a single flat Float32Array, one LineSegments draw call.
  const eb      = _getFcalEdgeBase();          // local-space edge positions, 3 floats/vert
  const outBuf  = new Float32Array(n * eb.length);
  let op = 0;
  for (let i = 0; i < n; i++) {
    iMesh.getMatrixAt(i, _fcalMat4);
    const m = _fcalMat4.elements;
    for (let j = 0; j < eb.length; j += 3) {
      const lx = eb[j], ly = eb[j + 1], lz = eb[j + 2];
      outBuf[op++] = m[0]*lx + m[4]*ly + m[8]*lz  + m[12];
      outBuf[op++] = m[1]*lx + m[5]*ly + m[9]*lz  + m[13];
      outBuf[op++] = m[2]*lx + m[6]*ly + m[10]*lz + m[14];
    }
  }
  const outGeo   = new THREE.BufferGeometry();
  outGeo.setAttribute('position', new THREE.BufferAttribute(outBuf, 3));
  const outLines = new THREE.LineSegments(outGeo, new THREE.LineBasicMaterial({ color: 0x000000 }));
  outLines.matrixAutoUpdate = false;
  outLines.frustumCulled   = false;
  outLines.renderOrder     = 3;
  fcalGroup.add(outLines);

  markDirty();
}

function rebuildActiveClusterCellIds() {
  if (!clusterFilterEnabled || !lastClusterData) { activeClusterCellIds = null; activeMbtsLabels = null; return; }
  const ids  = new Set();
  const mbts = new Set();
  for (const { clusters } of lastClusterData.collections) {
    for (const { eta, phi: rawPhi, etGev, cells } of clusters) {
      if (etGev < thrClusterEtGev) continue;
      for (const k of ['TILE', 'LAR_EM', 'HEC', 'FCAL', 'TRACK', 'OTHER'])
        for (const id of cells[k]) ids.add(id);
      // MBTS activation: map cluster (eta, phi) → type_X_ch_Y_mod_Z
      const absEta = Math.abs(eta);
      let ch;
      if      (absEta >= 2.78 && absEta <= 3.86) ch = 1;
      else if (absEta >= 2.08 && absEta <  2.78) ch = 0;
      else continue; // outside MBTS eta range
      const type    = eta >= 0 ? 1 : -1;
      const phiPos  = rawPhi < 0 ? rawPhi + 2 * Math.PI : rawPhi;
      const mod     = Math.floor(phiPos / (2 * Math.PI / 8)) % 8;
      mbts.add(`type_${type}_ch_${ch}_mod_${mod}`);
    }
  }
  activeClusterCellIds = ids;
  activeMbtsLabels     = mbts;
}

function applyClusterThreshold() {
  if (clusterGroup)
    for (const child of clusterGroup.children)
      child.visible = clusterFilterEnabled && child.userData.etGev >= thrClusterEtGev;
  rebuildActiveClusterCellIds();
  applyThreshold();
  applyFcalThreshold();
  applyTrackThreshold();
}

function drawClusters(clusters) {
  clearClusters();
  if (!clusters.length) return;
  clusterGroup = new THREE.Group();
  clusterGroup.renderOrder = 6;
  clusterGroup.visible = (typeof clustersVisible === 'undefined') ? true : clustersVisible;
  for (const { eta, phi, etGev, storeGateKey } of clusters) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT  = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz =  Math.cos(theta);
    const t0 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R,  CLUSTER_CYL_IN_HALF_H);
    const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
    const start = new THREE.Vector3(dx * t0, dy * t0, dz * t0);
    const end   = new THREE.Vector3(dx * t1, dy * t1, dz * t1);
    const geo  = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, CLUSTER_MAT);
    line.computeLineDistances();
    line.userData.etGev        = etGev;
    line.userData.storeGateKey = storeGateKey ?? '';
    line.matrixAutoUpdate = false;
    clusterGroup.add(line);
  }
  clusterGroup.matrixAutoUpdate = false;
  scene.add(clusterGroup);
  applyClusterThreshold();
}

// ── Scene reset ───────────────────────────────────────────────────────────────
// The visHandles list is the authoritative set of "cells that passed every
// filter" — used by the outline builder and the hover proxies.
let visHandles = [];
function _setHandleVisible(h, vis) {
  if (h.visible === vis) return;
  h.visible = vis;
  h.iMesh.setMatrixAt(h.instId, vis ? h.origMatrix : _ZERO_MAT4);
  _markIMDirty(h.iMesh);
}
function _rebuildRayIMeshes() {
  _rayIMeshes.clear();
  for (const h of visHandles) _rayIMeshes.add(h.iMesh);
  rayTargets.length = 0; _rayIMeshes.forEach(im => rayTargets.push(im));
}

function resetScene() {
  // Zero-scale every handle's matrix (hides every cell instance).
  for (const det of ['TILE', 'LAR', 'HEC']) {
    for (const h of cellMeshesByDet[det]) {
      if (h.visible) {
        h.visible = false;
        h.iMesh.setMatrixAt(h.instId, _ZERO_MAT4);
        _markIMDirty(h.iMesh);
      }
    }
  }
  _flushIMDirty();
  // Re-apply ghost state: resetScene hides all meshes (including ghost envelopes),
  // which would desync the ghostVisible map and make the next ghost toggle
  // render only the phi lines without the solid envelopes.
  applyAllGhostMeshes();
  active.clear(); visHandles = []; rayTargets.length = 0; _rayIMeshes.clear();
  clearOutline(); clearAllOutlines();
  clearTracks();
  clearClusters();
  clearPhotons();
  clearFcal();
  lastClusterData      = null;
  activeClusterCellIds = null;
  activeMbtsLabels     = null;
  tooltip.hidden = true; markDirty();
}

// Sweep every cell that isn't part of the XML's `active` set and decide its
// visibility for "show all cells" mode. When showAllCells is off, non-active
// cells stay hidden (the normal flow). When on, each non-active cell is
// painted with the minimum-palette colour of its detector, and hidden if the
// slicer wedge currently covers it. Non-active cells that become visible are
// appended to visHandles so outlines+raycast include them.
function _syncNonActiveShowAll() {
  if (!slicer.isShowAllCells()) return;
  const slicerMask = slicer.getMaskState();
  const sweep = (list, detOn, minColor) => {
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (active.has(h)) continue;      // active cells: normal flow handles them
      if (!detOn) { _setHandleVisible(h, false); continue; }
      let vis = true;
      if (slicerMask.active) {
        const c = _cellCenter(h);
        if (slicer.isPointInsideWedge(c.x, c.y, c.z, slicerMask)) vis = false;
      }
      if (vis) {
        h.iMesh.setColorAt(h.instId, minColor);
        _markIMDirty(h.iMesh);
        visHandles.push(h);
      }
      _setHandleVisible(h, vis);
    }
  };
  sweep(cellMeshesByDet.TILE, showTile, PAL_TILE_COLOR[0]);
  sweep(cellMeshesByDet.LAR,  showLAr,  PAL_LAR_COLOR[0]);
  sweep(cellMeshesByDet.HEC,  showHec,  PAL_HEC_COLOR[0]);
}

function applyThreshold() {
  // When the slicer is active it owns cell visibility (its mask already
  // incorporates the thresholds / cluster filter). Delegate to it so we don't
  // un-hide cells that should be inside the bubble.
  if (slicer.isActive()) { _applySlicerMask(); return; }
  visHandles = [];
  for (const [h, { energyMev, det, cellId, mbtsLabel }] of active) {
    const thr    = det === 'LAR' ? thrLArMev  : det === 'HEC' ? thrHecMev : thrTileMev;
    const detOn  = det === 'LAR' ? showLAr    : det === 'HEC' ? showHec   : showTile;
    let inCluster;
    if (activeClusterCellIds === null) {
      inCluster = true;                                           // no cluster data → no filter
    } else if (mbtsLabel != null) {
      inCluster = activeMbtsLabels !== null && activeMbtsLabels.has(mbtsLabel); // MBTS: cluster eta/phi match
    } else if (cellId != null) {
      inCluster = activeClusterCellIds.has(cellId);              // normal cell: ID match
    } else {
      inCluster = true;                                           // no ID and not MBTS → always pass
    }
    // Show-all bypasses every filter (threshold, cluster, negative energy) —
    // the user wants literally every cell on an enabled detector visible.
    const passThr = slicer.isShowAllCells() || (!isFinite(thr) || energyMev >= thr);
    const passCl  = slicer.isShowAllCells() || inCluster;
    const passNeg = slicer.isShowAllCells() || energyMev >= 0;
    const vis     = detOn && passNeg && passThr && passCl;
    _setHandleVisible(h, vis);
    if (vis) visHandles.push(h);
  }
  _syncNonActiveShowAll();
  _flushIMDirty();
  _rebuildRayIMeshes();
  rebuildAllOutlines();
  markDirty();
}

// ── Process XML ───────────────────────────────────────────────────────────────
// The WASM bulk decode runs in a Web Worker, so `processXml` is asynchronous.
// Multiple overlapping calls (e.g. user clicks event A then event B quickly)
// are kept correct by a monotonic rid: only the most recent call's worker reply
// is applied to the scene — stale replies are discarded. Callers that don't
// await the returned promise still get correct behavior because the final
// scene mutation is gated on `rid === _procXmlRid`.
let currentEventInfo = null;
let _procXmlRid = 0;
async function processXml(xmlText) {
  if (!wasmOk) return;
  const rid = ++_procXmlRid;
  const t0 = performance.now();

  let doc = null;
  let tileCells, larCells, hecCells, mbtsCells, fcalCells;
  let tilePacked = null, larPacked = null, hecPacked = null;
  let rawTracks = [], rawPhotons = [], rawClusters = [];
  let _clusterCollections = null;

  // ── Off-thread XML parse + WASM decode (worker path) ─────────────────────
  // Both DOMParser and bulk ID decode run in the existing WASM worker so the
  // main thread is never blocked, even on 47 MB events.
  let workerResult;
  try { workerResult = await _wasmPool.parseXmlAndDecode(xmlText); }
  catch (e) { console.warn('[parseXmlAndDecode] worker error, falling back:', e && e.message); workerResult = null; }
  // Drop stale replies — a newer event arrived while the worker was busy.
  if (rid !== _procXmlRid) return;

  if (workerResult) {
    if (workerResult.error) { setStatus(`<span class="err">${esc(workerResult.error)}</span>`); return; }
    currentEventInfo    = workerResult.eventInfo;
    tileCells           = workerResult.tileCells;
    larCells            = workerResult.larCells;
    hecCells            = workerResult.hecCells;
    mbtsCells           = workerResult.mbtsCells;
    fcalCells           = workerResult.fcalCells;
    tilePacked          = workerResult.tilePacked;
    larPacked           = workerResult.larPacked;
    hecPacked           = workerResult.hecPacked;
    rawPhotons          = workerResult.photons;
    rawClusters         = workerResult.clusters;
    _clusterCollections = workerResult.clusterCollections;
    // Worker returns plain {x,y,z} objects; reconstruct THREE.Vector3 here.
    rawTracks = workerResult.tracks.map(t => ({
      ...t, pts: t.pts.map(p => new THREE.Vector3(p.x, p.y, p.z)),
    }));
  } else {
    // ── Fallback: synchronous parse on main thread ─────────────────────────
    try { doc = parseXmlDoc(xmlText); }
    catch (e) { setStatus(`<span class="err">${esc(e.message)}</span>`); return; }
    currentEventInfo = parseEventInfo(doc);
    try { tileCells = parseTile(doc); } catch { tileCells = []; }
    try { larCells  = parseLAr(doc);  } catch { larCells  = []; }
    try { hecCells  = parseHec(doc);  } catch { hecCells  = []; }
    try { mbtsCells = parseMBTS(doc); } catch { mbtsCells = []; }
    try { fcalCells = parseFcal(doc); } catch { fcalCells = []; }
    try { rawTracks  = parseTracks(doc);  } catch (e) { console.warn('Track parse error', e); }
    try { rawPhotons = parsePhotons(doc); } catch (e) { console.warn('Photon parse error', e); }
    // parseClusters is called later (after resetScene) so lastClusterData is set
    // after the scene is cleared, keeping state consistent.
  }
  const total = tileCells.length + larCells.length + hecCells.length + mbtsCells.length;
  if (!total && !fcalCells.length) { setStatus('<span class="warn">No TILE, LAr, HEC, MBTS or FCAL cells found</span>'); return; }

  setStatus(`Decoding ${total} cells…`);
  resetScene();  // clears lastClusterData

  // ── Particle tracks ─────────────────────────────────────────────────────────
  if (rawTracks.length || rawPhotons.length) {
    let ptMax = 5;
    for (const { ptGev } of rawTracks)  if (isFinite(ptGev)  && ptGev  > ptMax) ptMax = ptGev;
    for (const { ptGev } of rawPhotons) if (isFinite(ptGev)  && ptGev  > ptMax) ptMax = ptGev;
    trackPtSlider.update(0, ptMax);
  }
  try { drawTracks(rawTracks);   } catch (e) { console.warn('Track draw error', e); }
  try { drawPhotons(rawPhotons); } catch (e) { console.warn('Photon draw error', e); }

  // ── Cluster η/φ lines ────────────────────────────────────────────────────────
  try {
    // Fallback: parse clusters now (after resetScene) so lastClusterData is set.
    // Worker path: restore lastClusterData from the pre-parsed collections.
    if (!workerResult) {
      const r = parseClusters(doc);
      rawClusters = r.flat;
      lastClusterData = { collections: r.collections };
    } else lastClusterData = { collections: _clusterCollections };
    if (rawClusters.length) {
      let etMin = Infinity, etMax = -Infinity;
      for (const { etGev } of rawClusters) {
        if (etGev < etMin) etMin = etGev;
        if (etGev > etMax) etMax = etGev;
      }
      clusterEtSlider.update(
        etMin === Infinity ? 0 : Math.max(0, etMin),
        etMax === -Infinity ? 1 : etMax,
      );
    }
    drawClusters(rawClusters);
    rebuildActiveClusterCellIds();
  } catch (e) { console.warn('Cluster parse error', e); }

  // ── FCAL cells ───────────────────────────────────────────────────────────────
  try { drawFcal(fcalCells); } catch (e) { console.warn('FCAL draw error', e); }

  // Per-detector energy ranges — min + 97th-percentile as max (top 3% above slider max)
  function minMax(cells) {
    const vals = [];
    for (const { energy } of cells) { const v = energy * 1000; if (isFinite(v) && v > 0) vals.push(v); }
    if (!vals.length) return [0, 1];
    vals.sort((a, b) => a - b);
    const p97 = vals[Math.floor(0.97 * vals.length)];
    return [vals[0], p97 ?? vals[vals.length - 1]];
  }
  // MBTS shares the Tile palette — merge its range with Tile's
  const allTileCells = tileCells.concat(mbtsCells);
  [tileMinMev, tileMaxMev] = minMax(allTileCells);
  [larMinMev,  larMaxMev]  = minMax(larCells);
  [hecMinMev,  hecMaxMev]  = minMax(hecCells);
  const fcalMaxMev = (() => { const [, mx] = minMax(fcalCells); return mx; })();
  tileSlider.update(tileMaxMev);
  larSlider.update(larMaxMev);
  hecSlider.update(hecMaxMev);
  fcalSlider.update(fcalMaxMev);

  let nTile = 0, nLAr = 0, nHec = 0, nMbts = 0, nMiss = 0, nSkip = 0;
  let nHecMiss = 0, nMbtsMiss = 0;
  // Sample misses instead of one console.warn per cell — full-resolution logging
  // craters FPS when DevTools is open (each warn forces a synchronous flush).
  // We keep the first 3 of each kind for diagnosis and aggregate the rest.
  const _MISS_SAMPLE = 3;
  const _missLog = { TILE: [], LAR: [], HEC: [], MBTS: [] };
  const _logMiss = (kind, msg) => { if (_missLog[kind].length < _MISS_SAMPLE) _missLog[kind].push(msg); };

  // ── Bulk WASM decode (fallback path only — worker already did it above) ────
  if (!workerResult) {
    const idsToStr = (cells) => {
      const arr = new Array(cells.length);
      for (let i = 0; i < cells.length; i++) arr[i] = cells[i].id;
      return arr.join(' ');
    };
    const _packs = await _wasmPool.parse(
      tileCells.length ? idsToStr(tileCells) : null,
      larCells.length  ? idsToStr(larCells)  : null,
      hecCells.length  ? idsToStr(hecCells)  : null,
    );
    if (rid !== _procXmlRid) return;
    tilePacked = _packs.tile;
    larPacked  = _packs.lar;
    hecPacked  = _packs.hec;
  }

  // ── TileCal cells ─────────────────────────────────────────────────────────
  // The event loop paints colors via setColorAt; visibility is decided by
  // applyThreshold() further down (which zero-scales the instance matrix for
  // filtered-out cells). renderOrder lives on the InstancedMesh itself.
  for (let i = 0; i < tileCells.length; i++) {
    const base = i * 8;
    if (tilePacked[base] !== SUBSYS_TILE) { nSkip++; continue; }
    const x       = tilePacked[base + 1];
    const k       = tilePacked[base + 2];
    const side    = tilePacked[base + 3];
    const module  = tilePacked[base + 4];
    const section = tilePacked[base + 5];
    const tower   = tilePacked[base + 6];
    const sampling= tilePacked[base + 7];
    const { id, energy } = tileCells[i];
    const eMev = energy * 1000;
    const s_bit = side < 0 ? 0 : 1;
    const h  = meshByKey.get(_tileKey(x, s_bit, k, module));
    if (!h) { _logMiss('TILE', `id=${id} | Tile${x}${s_bit?'p':'n'} k=${k} mod=${module}`); nMiss++; continue; }
    h.iMesh.setColorAt(h.instId, palColorTile(eMev));
    _markIMDirty(h.iMesh);
    const tEta = physTileEta(section, side, tower, sampling);
    const tPhi = physTilePhi(module);
    const tilePrefix = `${section === 1 ? 'LB' : 'EB'}${side >= 0 ? 'A' : 'C'}${module + 1}`;
    active.set(h, { energyGev: energy, energyMev: eMev, cellName: `${tilePrefix} ${cellLabel(x, k)}`, coords: `η = ${tEta.toFixed(3)}   φ = ${tPhi.toFixed(3)} rad`, det: 'TILE', cellId: id });
    nTile++;
  }

  // ── LAr EM cells ──────────────────────────────────────────────────────────
  for (let i = 0; i < larCells.length; i++) {
    const base    = i * 8;
    if (larPacked[base] !== SUBSYS_LAR_EM) { nSkip++; continue; }
    const abs_be  = larPacked[base + 1];
    const sampling= larPacked[base + 2];
    const region  = larPacked[base + 3];
    const z_pos   = larPacked[base + 4];
    const R       = larPacked[base + 5];
    const eta     = larPacked[base + 6];
    const phi     = larPacked[base + 7];
    const { id, energy } = larCells[i];
    const eMev = energy * 1000;
    const h = meshByKey.get(_larEmKey(abs_be, sampling, R, z_pos, eta, phi));
    if (!h) {
      _logMiss('LAR', `id=${id} | abs_be=${abs_be} samp=${sampling} R=${R} z=${z_pos} η=${eta} φ=${phi}`);
      nMiss++; continue;
    }
    h.iMesh.setColorAt(h.instId, palColorLAr(eMev));
    _markIMDirty(h.iMesh);
    const rName = abs_be === 1 ? `EMB${sampling}` : abs_be === 2 ? `EMEC${sampling}` : `EMEC${sampling} (inner)`;
    const bec   = abs_be * (z_pos ? 1 : -1);
    const lEta  = physLarEmEta(bec, sampling, region, eta);
    const lPhi  = physLarEmPhi(bec, sampling, region, phi);
    active.set(h, { energyGev: energy, energyMev: eMev, cellName: rName, coords: `η = ${lEta.toFixed(3)}   φ = ${lPhi.toFixed(3)} rad`, det: 'LAR', cellId: id });
    nLAr++;
  }

  // ── LAr HEC cells ─────────────────────────────────────────────────────────
  for (let i = 0; i < hecCells.length; i++) {
    const base     = i * 8;
    if (hecPacked[base] !== SUBSYS_LAR_HEC) { nSkip++; continue; }
    const group    = hecPacked[base + 1];
    const region   = hecPacked[base + 2];
    const z_pos    = hecPacked[base + 3];
    const cum_eta  = hecPacked[base + 4];
    const phi      = hecPacked[base + 5];
    const { id, energy } = hecCells[i];
    const eMev = energy * 1000;
    const h = meshByKey.get(_hecKey(group, region, z_pos, cum_eta, phi));
    if (!h) {
      _logMiss('HEC', `id=${id} | group=${group} region=${region} z=${z_pos} cumη=${cum_eta} φ=${phi}`);
      nHecMiss++; continue;
    }
    h.iMesh.setColorAt(h.instId, palColorHec(eMev));
    _markIMDirty(h.iMesh);
    const be      = z_pos ? 2 : -2;
    const eta_idx = region === 0 ? cum_eta : cum_eta - HEC_INNER[group];
    const hLabel  = `HEC${group + 1}`;
    const hEta    = physLarHecEta(be, group, region, eta_idx);
    const hPhi    = physLarHecPhi(region, phi);
    active.set(h, { energyGev: energy, energyMev: eMev, cellName: hLabel, coords: `η = ${hEta.toFixed(3)}   φ = ${hPhi.toFixed(3)} rad`, det: 'HEC', cellId: id });
    nHec++;
  }

  // ── MBTS cells (direct label→key, no WASM needed) ────────────────────────
  // EBA module numbers per mod index, inner (ch=0) and outer (ch=1)
  const _mbtsEbaInner = [57, 58, 39, 40, 41, 42, 55, 56];
  const _mbtsEbaOuter = [ 8,  8, 24, 24, 43, 43, 54, 54];
  for (let i = 0; i < mbtsCells.length; i++) {
    const { label, energy } = mbtsCells[i];
    const eMev = energy * 1000;
    const _m = /^type_(-?1)_ch_([01])_mod_([0-7])$/.exec(label);
    if (!_m) { _logMiss('MBTS', `label=${label} | bad format`); nMbtsMiss++; continue; }
    const tileNum = _m[2]==='0' ? 14 : 15, s_bit = _m[1]==='1' ? 1 : 0, mod = +_m[3];
    const h = meshByKey.get(_tileKey(tileNum, s_bit, 0, mod));
    if (!h) { _logMiss('MBTS', `label=${label} | no mesh`); nMbtsMiss++; continue; }
    h.iMesh.setColorAt(h.instId, palColorTile(eMev));
    _markIMDirty(h.iMesh);
    const mbtsCoords = `η = ${((s_bit?1:-1)*(_m[2]==='0'?2.76:3.84)).toFixed(3)}   φ = ${_wrapPhi(2*Math.PI/16+mod*2*Math.PI/8).toFixed(3)} rad`;
    const _mbtsInner = _m[2] === '1';
    const _mbtsSide  = s_bit ? 'A' : 'C';
    const _mbtsEba   = (_mbtsInner ? _mbtsEbaInner : _mbtsEbaOuter)[mod];
    const _mbtsIdx   = mod + (_mbtsInner ? 0 : 8);
    const _mbtsCellName = `EB${_mbtsSide}${String(_mbtsEba).padStart(2,'0')} MBTS ${_mbtsSide}${String(_mbtsIdx).padStart(2,'0')}`;
    active.set(h, { energyGev: energy, energyMev: eMev, cellName: _mbtsCellName, coords: mbtsCoords, det: 'TILE', mbtsLabel: label });
    nMbts++;
  }

  initDetPanel(nTile > 0, nLAr > 0, nHec > 0, trackGroup && trackGroup.children.length > 0, fcalCells.length > 0);
  applyThreshold();
  const dt = ((performance.now() - t0) / 1000).toFixed(2);

  const nHit    = nTile + nMbts + nLAr + nHec;
  const allMiss = nMiss + nHecMiss + nMbtsMiss;
  // Aggregated miss summary — one console line per detector kind, with samples.
  if (allMiss) {
    for (const kind of ['TILE', 'LAR', 'HEC', 'MBTS']) {
      const samples = _missLog[kind];
      if (samples.length) console.warn(`[${kind}] ${samples.length} sample miss(es):\n  ` + samples.join('\n  '));
    }
  }
  showEventInfo(currentEventInfo);
}

// Detector tabs and threshold sliders live in js/detectorPanels.js.

// (ghost functions defined above near GHOST_MESH_NAMES)

// ── Z-axis beam indicator ─────────────────────────────────────────────────────
function buildBeamIndicator() {
  if (beamGroup) return;
  beamGroup = new THREE.Group();
  const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-13000), new THREE.Vector3(0,0,13000)]);
  beamGroup.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0x4a7fcc, transparent: true, opacity: 0.50, depthWrite: false })));
  const northMesh = new THREE.Mesh(new THREE.ConeGeometry(90,520,24,1,false), new THREE.MeshBasicMaterial({ color: 0xee2222 }));
  northMesh.rotation.x = Math.PI/2; northMesh.position.z = 13260; beamGroup.add(northMesh);
  const ringN = new THREE.Mesh(new THREE.TorusGeometry(90,8,8,24), new THREE.MeshBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.55 }));
  ringN.rotation.x = Math.PI/2; ringN.position.z = 13000; beamGroup.add(ringN);
  const southMesh = new THREE.Mesh(new THREE.ConeGeometry(90,520,24,1,false), new THREE.MeshBasicMaterial({ color: 0x2244ee }));
  southMesh.rotation.x = -Math.PI/2; southMesh.position.z = -13260; beamGroup.add(southMesh);
  const ringS = new THREE.Mesh(new THREE.TorusGeometry(90,8,8,24), new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: 0.55 }));
  ringS.rotation.x = Math.PI/2; ringS.position.z = -13000; beamGroup.add(ringS);
  beamGroup.visible = false; scene.add(beamGroup);
}
function toggleBeam() {
  buildBeamIndicator(); beamOn = !beamOn;
  beamGroup.visible = beamOn;
  document.getElementById('btn-beam').classList.toggle('on', beamOn);
  markDirty();
}

// ── EdgesGeometry outline (hover) ─────────────────────────────────────────────
const eGeoCache  = new Map();
const outlineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
let   outlineMesh = null;
function clearOutline() {
  if (!outlineMesh) return; scene.remove(outlineMesh); outlineMesh = null; markDirty();
}
function showOutline(h) {
  if (outlineMesh?.userData.src === h.name) return;
  clearOutline();
  const geo = h.iMesh.geometry;
  const uid = geo.uuid;
  if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(geo, 30));
  outlineMesh = new THREE.LineSegments(eGeoCache.get(uid), outlineMat);
  outlineMesh.matrixAutoUpdate = false;
  outlineMesh.matrix.copy(h.origMatrix);
  outlineMesh.matrixWorld.copy(h.origMatrix);
  outlineMesh.renderOrder = 999; outlineMesh.userData.src = h.name;
  scene.add(outlineMesh); markDirty();
}

// Show hover outline (white) for a specific FCAL InstancedMesh instance.
// Mirrors showOutline but transforms the shared cylinder edge base by the instance matrix.
function showFcalOutline(instanceId) {
  const src = 'fcal_' + instanceId;
  if (outlineMesh?.userData.src === src) return;
  clearOutline();
  const iMesh = fcalGroup?.children.find(c => c.isInstancedMesh);
  if (!iMesh) return;
  iMesh.getMatrixAt(instanceId, _fcalMat4);
  const eb  = _getFcalEdgeBase();
  const buf = new Float32Array(eb.length);
  const m   = _fcalMat4.elements;
  for (let j = 0; j < eb.length; j += 3) {
    const lx = eb[j], ly = eb[j + 1], lz = eb[j + 2];
    buf[j]     = m[0]*lx + m[4]*ly + m[8]*lz  + m[12];
    buf[j + 1] = m[1]*lx + m[5]*ly + m[9]*lz  + m[13];
    buf[j + 2] = m[2]*lx + m[6]*ly + m[10]*lz + m[14];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
  outlineMesh = new THREE.LineSegments(geo, outlineMat);
  outlineMesh.matrixAutoUpdate = false;
  outlineMesh.renderOrder = 999;
  outlineMesh.userData.src = src;
  scene.add(outlineMesh); markDirty();
}

// ── All-cells outline (optimised: cached world-space edges per mesh) ─────────
const outlineAllMat = new THREE.LineBasicMaterial({ color: 0x000000 });
const _edgeWorldCache = new Map();  // handle.name → Float32Array (world-space positions)
let _outlineTimer = 0;

function _getWorldEdges(h) {
  const cached = _edgeWorldCache.get(h.name);
  if (cached) return cached;
  const geo = h.iMesh.geometry;
  const uid = geo.uuid;
  if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(geo, 30));
  const src = eGeoCache.get(uid).getAttribute('position').array;
  const m = h.origMatrix.elements;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    out[i]     = m[0] * x + m[4] * y + m[8]  * z + m[12];
    out[i + 1] = m[1] * x + m[5] * y + m[9]  * z + m[13];
    out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  _edgeWorldCache.set(h.name, out);
  return out;
}

function clearAllOutlines() {
  clearTimeout(_outlineTimer);
  if (!allOutlinesMesh) return;
  scene.remove(allOutlinesMesh);
  allOutlinesMesh.geometry.dispose();
  allOutlinesMesh = null;
  markDirty();
}

function rebuildAllOutlines() {
  clearAllOutlines();
  if (!visHandles.length) return;
  _buildOutlinesNow();
}

function _buildOutlinesNow() {
  if (!visHandles.length) return;
  // Count total floats needed
  let total = 0;
  const edgeArrays = new Array(visHandles.length);
  for (let i = 0; i < visHandles.length; i++) {
    const arr = _getWorldEdges(visHandles[i]);
    edgeArrays[i] = arr;
    total += arr.length;
  }
  // Single allocation, memcpy each cached array
  const buf = new Float32Array(total);
  let offset = 0;
  for (let i = 0; i < edgeArrays.length; i++) {
    buf.set(edgeArrays[i], offset);
    offset += edgeArrays[i].length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
  allOutlinesMesh = new THREE.LineSegments(geo, outlineAllMat);
  allOutlinesMesh.matrixAutoUpdate = false;
  allOutlinesMesh.frustumCulled = false;
  allOutlinesMesh.renderOrder = 3;
  scene.add(allOutlinesMesh);
  markDirty();
}

// ── Hover tooltip — raycasting fix ───────────────────────────────────────────
const raycast  = new THREE.Raycaster();
raycast.firstHitOnly = true;  // stop after first intersection (much faster)
raycast.params.Line = { threshold: 25 };  // 25 mm hit zone for track lines
const mxy      = new THREE.Vector2();
const tooltip    = document.getElementById('tip');
const tipCellEl  = document.getElementById('tip-cell');
const tipCoordEl = document.getElementById('tip-coords');
const tipEEl     = document.getElementById('tip-e');
const tipEKeyEl  = document.querySelector('#tip .tkey');
let   lastRay    = 0;
let   mousePos = { x: 0, y: 0 };
function doRaycast(clientX, clientY) {
  const hasTrackLines   = trackGroup   && trackGroup.visible   && trackGroup.children.length   > 0;
  const hasPhotonLines  = photonGroup  && photonGroup.visible  && photonGroup.children.length  > 0;
  const hasClusterLines = clusterGroup && clusterGroup.visible && clusterGroup.children.length > 0;
  const hasFcalTubes    = fcalGroup && fcalGroup.children.some(c => c.isInstancedMesh) && fcalVisibleMap.length > 0;
  if (!showInfo || cinema.isCinemaMode() || (!active.size && !hasTrackLines && !hasPhotonLines && !hasClusterLines && !hasFcalTubes)) { tooltip.hidden = true; clearOutline(); return; }
  // Don't show cell info when the pointer is over any UI element (panels, toolbar, overlays)
  const topEl = document.elementFromPoint(clientX, clientY);
  if (topEl && topEl !== canvas) { tooltip.hidden = true; clearOutline(); return; }
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    tooltip.hidden = true; clearOutline(); return;
  }
  mxy.set(((clientX-rect.left)/rect.width)*2-1, -((clientY-rect.top)/rect.height)*2+1);
  camera.updateMatrixWorld();
  raycast.setFromCamera(mxy, camera);
  // ── Cell + FCAL hit (same priority — pick closest) ────────────────────────
  {
    let cellHit = null, cellHandle = null, cellDist = Infinity;
    if (active.size && rayTargets.length) {
      const hits = raycast.intersectObjects(rayTargets, false);
      for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        const iid = hit.instanceId;
        if (iid == null) continue;
        const h = hit.object.userData.handles?.[iid];
        if (!h || !active.has(h)) continue;
        cellHit = hit; cellHandle = h; cellDist = hit.distance;
        break; // hits are sorted; first active match is closest
      }
    }
    let fcalHit = null, fcalDist = Infinity;
    if (hasFcalTubes) {
      const iMesh = fcalGroup.children.find(c => c.isInstancedMesh);
      if (iMesh) {
        const hits = raycast.intersectObject(iMesh, false);
        if (hits.length && hits[0].instanceId != null && fcalVisibleMap[hits[0].instanceId]) {
          fcalHit = hits[0]; fcalDist = hits[0].distance;
        }
      }
    }
    if (cellHit && cellDist <= fcalDist) {
      const data = active.get(cellHandle);
      showOutline(cellHandle);
      tipCellEl.textContent  = data.cellName;
      tipCoordEl.textContent = data.coords ?? '';
      tipEEl.textContent     = `${data.energyGev.toFixed(4)} GeV`;
      if (tipEKeyEl) tipEKeyEl.textContent = t('tip-energy-key');
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; markDirty(); return;
    }
    if (fcalHit) {
      const iid  = fcalHit.instanceId;
      const cell = fcalVisibleMap[iid];
      showFcalOutline(iid);
      const side = cell.eta >= 0 ? 'A' : 'C';
      tipCellEl.textContent  = `FCAL${cell.module} (${side}-side)`;
      tipCoordEl.textContent = `η = ${cell.eta.toFixed(3)}   φ = ${cell.phi.toFixed(3)} rad`;
      tipEEl.textContent     = `${cell.energy.toFixed(4)} GeV`;
      if (tipEKeyEl) tipEKeyEl.textContent = t('tip-energy-key');
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; markDirty(); return;
    }
  }
  // ── Track / Photon hit (pick closest) ────────────────────────────────────
  if (hasTrackLines || hasPhotonLines) {
    const candidates = [];
    if (hasTrackLines)  candidates.push(...trackGroup.children.filter(c => c.visible));
    if (hasPhotonLines) candidates.push(...photonGroup.children.filter(c => c.visible));
    const hits = raycast.intersectObjects(candidates, false);
    if (hits.length) {
      const line         = hits[0].object;
      const ptGev        = line.userData.ptGev        ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      const isPhoton     = photonGroup && photonGroup.children.includes(line);
      clearOutline();
      tipCellEl.textContent  = isPhoton ? 'Photon' : 'Track';
      tipCoordEl.textContent = storeGateKey;
      tipEEl.textContent     = `${ptGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'p<sub>T</sub>';
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; markDirty(); return;
    }
  }
  // ── Cluster hit ───────────────────────────────────────────────────────────
  if (hasClusterLines) {
    const visibleClusters = clusterGroup.children.filter(c => c.visible);
    const clusterHits = raycast.intersectObjects(visibleClusters, false);
    if (clusterHits.length) {
      const line         = clusterHits[0].object;
      const etGev        = line.userData.etGev        ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      clearOutline();
      tipCellEl.textContent  = 'Cluster';
      tipCoordEl.textContent = storeGateKey;
      tipEEl.textContent     = `${etGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'E<sub>T</sub>';
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; markDirty(); return;
    }
  }
  clearOutline(); tooltip.hidden = true;
}
document.addEventListener('mousemove', e => {
  mousePos.x = e.clientX; mousePos.y = e.clientY;
  const now = Date.now(); if (now-lastRay < 50) return; lastRay = now;
  doRaycast(e.clientX, e.clientY);
});
canvas.addEventListener('mouseleave', () => { clearOutline(); tooltip.hidden = true; });
controls.addEventListener('end', () => { lastRay = 0; setTimeout(() => doRaycast(mousePos.x, mousePos.y), 50); });

const cinema = setupCinemaControls({
  camera,
  canvas,
  controls,
  markDirty,
  clearOutline,
  hideTooltip: () => { tooltip.hidden = true; },
  updateCollisionHud,
});
const enterCinema = () => cinema.enterCinema();
const exitCinema = () => cinema.exitCinema();
const resetCamera = () => cinema.resetCamera();

// ── Tooltip toggle ────────────────────────────────────────────────────────────
document.getElementById('btn-info').addEventListener('click', () => {
  showInfo = !showInfo;
  document.getElementById('btn-info').classList.toggle('on', showInfo);
  document.querySelector('#btn-info use').setAttribute('href', showInfo ? '#i-eye' : '#i-eye-off');
  if (!showInfo) { clearOutline(); tooltip.hidden = true; }
});
document.getElementById('btn-ghost').addEventListener('click', e => {
  e.stopPropagation();
  toggleAllGhosts();
});
document.getElementById('btn-beam').addEventListener('click', toggleBeam);
document.getElementById('btn-reset').addEventListener('click', resetCamera);


// ── Detector layer toggles + Layers panel ────────────────────────────────────
function syncLayerToggles() {
  const tTile = document.getElementById('ltog-tile');
  const tLAr  = document.getElementById('ltog-lar');
  const tHec  = document.getElementById('ltog-hec');
  const tFcal = document.getElementById('ltog-fcal');
  tTile.classList.toggle('on', showTile); tTile.setAttribute('aria-checked', showTile);
  tLAr .classList.toggle('on', showLAr);  tLAr .setAttribute('aria-checked', showLAr);
  tHec .classList.toggle('on', showHec);  tHec .setAttribute('aria-checked', showHec);
  tFcal.classList.toggle('on', showFcal); tFcal.setAttribute('aria-checked', showFcal);
  // Layers button: dim when all off, lit otherwise
  document.getElementById('btn-layers').classList.toggle('on', showTile || showLAr || showHec || showFcal);
}

function refreshSceneVisibility() {
  applyThreshold();
  applyFcalThreshold();
}

document.getElementById('ltog-tile').addEventListener('click', () => { showTile = !showTile; syncLayerToggles(); applyThreshold(); });
document.getElementById('ltog-lar') .addEventListener('click', () => { showLAr  = !showLAr;  syncLayerToggles(); applyThreshold(); });
document.getElementById('ltog-hec') .addEventListener('click', () => { showHec  = !showHec;  syncLayerToggles(); applyThreshold(); });
document.getElementById('ltog-fcal').addEventListener('click', () => { showFcal = !showFcal; syncLayerToggles(); applyFcalThreshold(); });
document.getElementById('lbtn-all') .addEventListener('click', () => { showTile = showLAr = showHec = showFcal = true;  syncLayerToggles(); refreshSceneVisibility(); });
document.getElementById('lbtn-none').addEventListener('click', () => { showTile = showLAr = showHec = showFcal = false; syncLayerToggles(); refreshSceneVisibility(); });

// Layers panel open / close
const layersPanel = document.getElementById('layers-panel');
let layersPanelOpen = false;
function openLayersPanel() {
  layersPanelOpen = true;
  layersPanel.classList.add('open');
  document.getElementById('btn-layers').classList.add('on');
  const br = document.getElementById('btn-layers').getBoundingClientRect();
  // Position above the button, centred
  requestAnimationFrame(() => {
    const pw = layersPanel.offsetWidth  || 210;
    const ph = layersPanel.offsetHeight || 170;
    let left = br.left + br.width / 2 - pw / 2;
    let top  = br.top - ph - 10;
    left = Math.max(6, Math.min(left, window.innerWidth - pw - 6));
    top  = Math.max(6, top);
    layersPanel.style.left = left + 'px';
    layersPanel.style.top  = top  + 'px';
  });
}
function closeLayersPanel() {
  layersPanelOpen = false;
  layersPanel.classList.remove('open');
  // Restore btn-layers state (lit if any layer on)
  document.getElementById('btn-layers').classList.toggle('on', showTile || showLAr || showHec || showFcal);
}
document.getElementById('btn-layers').addEventListener('click', e => {
  e.stopPropagation();
  layersPanelOpen ? closeLayersPanel() : openLayersPanel();
});

// ── Particle tracks (collision tracer) toggle ───────────────────────────────
let tracksVisible = true;
function syncTracksBtn() {
  document.getElementById('btn-tracks').classList.toggle('on', tracksVisible);
}
function toggleTracks() {
  tracksVisible = !tracksVisible;
  if (trackGroup)  trackGroup.visible  = tracksVisible;
  if (photonGroup) photonGroup.visible = tracksVisible;
  updateTrackAtlasIntersections();
  syncTracksBtn();
  markDirty();
}
document.getElementById('btn-tracks').addEventListener('click', toggleTracks);

// ── Cluster η/φ lines toggle ────────────────────────────────────────────────
let clustersVisible = true;
function syncClustersBtn() {
  document.getElementById('btn-cluster').classList.toggle('on', clustersVisible);
}
function toggleClusters() {
  clustersVisible = !clustersVisible;
  if (clusterGroup) clusterGroup.visible = clustersVisible;
  syncClustersBtn();
  markDirty();
}
document.getElementById('btn-cluster').addEventListener('click', toggleClusters);


document.addEventListener('click', () => {
  if (layersPanelOpen) closeLayersPanel();
});
layersPanel.addEventListener('click', e => e.stopPropagation());

// ── Panel resize ──────────────────────────────────────────────────────────────
const panelEl      = document.getElementById('panel');
const panelEdge    = document.getElementById('panel-edge');
const panelResizer = document.getElementById('panel-resizer');
const rpanelWrap   = document.getElementById('rpanel-wrap');
const savedPW = localStorage.getItem('cgv-panel-width');
if (savedPW) document.documentElement.style.setProperty('--pw', savedPW + 'px');
let prDrag = false, prStartX = 0, prStartW = 0;
panelResizer.addEventListener('pointerdown', e => {
  prDrag = true; prStartX = e.clientX; prStartW = panelEl.getBoundingClientRect().width;
  panelResizer.setPointerCapture(e.pointerId); panelResizer.classList.add('dragging'); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!prDrag) return;
  const newW = Math.max(180, Math.min(520, prStartW + e.clientX - prStartX));
  document.documentElement.style.setProperty('--pw', newW+'px');
});
document.addEventListener('pointerup', () => {
  if (!prDrag) return; prDrag = false; panelResizer.classList.remove('dragging');
  const w = Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pw')));
  localStorage.setItem('cgv-panel-width', w);
});


// ── About overlay ─────────────────────────────────────────────────────────────
sidebarControls = setupSidebarControls({
  canvas,
  getCinemaMode: () => cinema.isCinemaMode(),
  getTourMode: () => cinema.isTourMode(),
  onDisableTourMode: () => cinema.disableTourMode(),
  onEnableTourMode: () => cinema.enableTourMode(),
  t,
  updateCollisionHud,
});

({
  tileSlider,
  larSlider,
  fcalSlider,
  hecSlider,
  trackPtSlider,
  clusterEtSlider,
  initDetPanel,
} = setupDetectorPanels({
  TILE_SCALE,
  LAR_SCALE,
  FCAL_SCALE,
  HEC_SCALE,
  applyThreshold,
  applyFcalThreshold,
  applyTrackThreshold,
  applyClusterThreshold,
  sidebarControls,
  state: {
    getThrTileMev: () => thrTileMev,
    setThrTileMev: v => { thrTileMev = v; },
    getThrLArMev: () => thrLArMev,
    setThrLArMev: v => { thrLArMev = v; },
    getThrFcalMev: () => thrFcalMev,
    setThrFcalMev: v => { thrFcalMev = v; },
    getThrHecMev: () => thrHecMev,
    setThrHecMev: v => { thrHecMev = v; },
    getThrTrackGev: () => thrTrackGev,
    setThrTrackGev: v => { thrTrackGev = v; },
    getTrackPtMinGev: () => trackPtMinGev,
    setTrackPtMinGev: v => { trackPtMinGev = v; },
    getTrackPtMaxGev: () => trackPtMaxGev,
    setTrackPtMaxGev: v => { trackPtMaxGev = v; },
    getThrClusterEtGev: () => thrClusterEtGev,
    setThrClusterEtGev: v => { thrClusterEtGev = v; },
    getClusterEtMinGev: () => clusterEtMinGev,
    setClusterEtMinGev: v => { clusterEtMinGev = v; },
    getClusterEtMaxGev: () => clusterEtMaxGev,
    setClusterEtMaxGev: v => { clusterEtMaxGev = v; },
    getClusterFilterEnabled: () => clusterFilterEnabled,
    setClusterFilterEnabled: v => { clusterFilterEnabled = v; },
  },
}));

const aboutOverlay = document.getElementById('about-overlay');
document.getElementById('btn-about-close').addEventListener('click', () => aboutOverlay.classList.remove('open'));
aboutOverlay.addEventListener('click', e => { if (e.target===aboutOverlay) aboutOverlay.classList.remove('open'); });

// ── Button hint tooltips ──────────────────────────────────────────────────────
const btnTipEl = document.getElementById('btn-tip');
function showBtnTip(anchor, text) {
  btnTipEl.textContent = text;
  btnTipEl.classList.add('show');
  const ar = anchor.getBoundingClientRect();
  const tw = btnTipEl.offsetWidth, th = btnTipEl.offsetHeight, gap = 8;
  let left, top;
  if (anchor.closest('#toolbar')) {
    left = ar.left + ar.width/2 - tw/2; top = ar.top - th - gap;
  } else {
    left = ar.right + gap; top = ar.top + ar.height/2 - th/2;
  }
  left = Math.max(6, Math.min(left, window.innerWidth  - tw - 6));
  top  = Math.max(6, Math.min(top,  window.innerHeight - th - 6));
  btnTipEl.style.left = left+'px'; btnTipEl.style.top = top+'px';
}
function hideBtnTip() { btnTipEl.classList.remove('show'); }
document.querySelectorAll('[data-tip]').forEach(el => {
  el.addEventListener('mouseenter', () => showBtnTip(el, el.dataset.tip));
  el.addEventListener('mouseleave', hideBtnTip);
  el.addEventListener('click',      hideBtnTip);
});

// ── Statusbar hint: full collision info on hover ──────────────────────────────
(function () {
  const sb   = document.getElementById('statusbar');
  const hint = document.getElementById('stat-hint');
  if (!sb || !hint) return;
  function labels() {
    return {
      'Date/Time':    'dateTime',
      'Run Number':   'runNumber',
      'Event Number': 'eventNumber',
      'Lumi Block':   'lumiBlock',
      'Version':      'version',
    };
  }
  function build() {
    const info = _lastEventInfo;
    if (!info) { hint.innerHTML = `<span class="sh-key">Status</span><span class="sh-val">${esc(statusTxtEl.textContent)}</span>`; return; }
    const map = labels();
    let html = '';
    for (const [k, prop] of Object.entries(map)) {
      const v = info[prop];
      if (!v) continue;
      html += `<span class="sh-key">${esc(k)}</span><span class="sh-val">${esc(v)}</span>`;
    }
    hint.innerHTML = html || `<span class="sh-key">Event</span><span class="sh-val">no metadata</span>`;
  }
  function show() {
    if (!sidebarControls.isHintsEnabled()) return;
    build();
    hint.classList.add('show');
    const sr = sb.getBoundingClientRect();
    const hw = hint.offsetWidth, hh = hint.offsetHeight, gap = 8;
    let left = sr.left;
    let top  = sr.top - hh - gap;
    left = Math.max(6, Math.min(left, window.innerWidth - hw - 6));
    if (top < 6) top = sr.bottom + gap;
    hint.style.left = left + 'px';
    hint.style.top  = top  + 'px';
  }
  function hide() { hint.classList.remove('show'); }
  sb.addEventListener('mouseenter', show);
  sb.addEventListener('mouseleave', hide);
})();

// ── Mode toggle ───────────────────────────────────────────────────────────────
const sampleMode = setupSampleMode({
  advanceProgress,
  endProgress,
  esc,
  processXml,
  setStatus,
  startProgress,
  t,
});

function setMode(mode) {
  // mode: 'live' | 'local' | 'sample'
  isLive = (mode === 'live');
  document.getElementById('btn-live').classList.toggle('on',   mode === 'live');
  document.getElementById('btn-local').classList.toggle('on',  mode === 'local');
  document.getElementById('btn-sample').classList.toggle('on', mode === 'sample');
  document.getElementById('live-sec').hidden   = (mode !== 'live');
  document.getElementById('local-sec').hidden  = (mode !== 'local');
  document.getElementById('sample-sec').hidden = (mode !== 'sample');
  if (mode === 'live') {
    if (poller && wasmOk && sceneOk) poller.start();
  } else {
    if (poller) poller.stop();
    if (mode === 'sample') sampleMode.loadSampleIndex();
  }
}
document.getElementById('btn-live').addEventListener('click',   () => { if (!isLive) setMode('live'); });
document.getElementById('btn-local').addEventListener('click',  () => { if (document.getElementById('local-sec').hidden) setMode('local'); });
document.getElementById('btn-sample').addEventListener('click', () => { if (document.getElementById('sample-sec').hidden) setMode('sample'); });

const liveMode = setupLiveMode({
  LivePoller,
  advanceProgress,
  bumpReq,
  endProgress,
  esc,
  onFallbackToLocal: () => document.getElementById('btn-local').click(),
  processXml,
  relTime,
  startProgress,
  t,
});
const poller = liveMode.hasPoller() ? { start: () => liveMode.start(), stop: () => liveMode.stop() } : null;

setupLocalMode({
  advanceProgress,
  endProgress,
  esc,
  fmtSize,
  processXml,
  setStatus,
  startProgress,
  activateLocalTab: () => document.getElementById('btn-local')?.click(),
});

// ── Screenshot ────────────────────────────────────────────────────────────────

// Pick a sensible default resolution based on device capabilities.
// Mobile (landscape small screens, touch/coarse pointer, low DPR) → 2K.
// Desktop → 10K (maximum available).
setupColorPicker();

async function renderAndDownload(targetW, targetH) {
  // ── 1. Save current renderer state ──────────────────────────────────────
  const origW  = renderer.domElement.width;
  const origH  = renderer.domElement.height;
  const origPR = renderer.getPixelRatio();
  const origAspect = camera.aspect;
  const origFov   = camera.fov;

  // ── 2. Snapshot tooltip content before any resize ────────────────────────
  const tipVisible  = !tooltip.hidden;
  let tipData = null;
  if (tipVisible) {
    tipData = {
      cellName: tipCellEl.textContent,
      energy:   tipEEl.textContent,
      // Tooltip position as fraction of the current viewport
      xFrac: (parseFloat(tooltip.style.left) - canvas.getBoundingClientRect().left) / origW * origPR,
      yFrac: (parseFloat(tooltip.style.top)  - canvas.getBoundingClientRect().top)  / origH * origPR,
    };
  }

  // ── 3. Resize renderer to target resolution ──────────────────────────────
  // Adjust the vertical FOV so the screenshot frustum contains at least
  // everything the user currently sees. If the target aspect is narrower
  // (taller) than the window, widen the vertical FOV so the horizontal
  // extent is preserved; if it's wider, keep fov_v and let the wider
  // aspect reveal more sideways. Prevents edge/corner cropping.
  const targetAspect = targetW / targetH;
  const origTanHalf  = Math.tan((origFov * Math.PI / 180) / 2);
  const newTanHalf   = origTanHalf * Math.max(1, origAspect / targetAspect);
  const newFov       = 2 * Math.atan(newTanHalf) * 180 / Math.PI;
  renderer.setPixelRatio(1);
  renderer.setSize(targetW, targetH, false); // false = don't update CSS size
  camera.aspect = targetAspect;
  camera.fov    = newFov;
  camera.updateProjectionMatrix();

  // ── 4. Render one high-quality frame ─────────────────────────────────────
  // If transparent-bg screenshot is requested, temporarily drop scene.background
  // so the alpha channel is preserved when we read pixels.
  const transparentBg = !!document.getElementById('shot-transparent')?.checked;
  const savedBg = scene.background;
  if (transparentBg) {
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
  }
  // Hide slicer gizmo for the screenshot — the carve stays, the handle vanishes.
  const slicerGroup = slicer.getGroup();
  const slicerVisSaved = slicerGroup ? slicerGroup.visible : null;
  if (slicerGroup) slicerGroup.visible = false;
  renderer.render(scene, camera);
  if (slicerGroup && slicerVisSaved !== null) slicerGroup.visible = slicerVisSaved;

  // ── 5. Grab raw pixels from the WebGL canvas ─────────────────────────────
  const gl    = renderer.getContext();
  const pixels = new Uint8Array(targetW * targetH * 4);
  gl.readPixels(0, 0, targetW, targetH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // ── 6. Flip Y (WebGL origin is bottom-left, canvas is top-left) ──────────
  const offscreen = document.createElement('canvas');
  offscreen.width  = targetW;
  offscreen.height = targetH;
  const ctx = offscreen.getContext('2d');
  const imgData = ctx.createImageData(targetW, targetH);
  for (let y = 0; y < targetH; y++) {
    const srcRow = (targetH - 1 - y) * targetW * 4;
    imgData.data.set(pixels.subarray(srcRow, srcRow + targetW * 4), y * targetW * 4);
  }
  ctx.putImageData(imgData, 0, 0);

  // ── 7. Draw tooltip overlay if it was visible ────────────────────────────
  if (tipData) {
    const scale  = targetW / origW * origPR;   // pixel mapping factor
    const tx     = tipData.xFrac * targetW;
    const ty     = tipData.yFrac * targetH;
    const pad    = 14 * scale;
    const radius = 7  * scale;
    const fs     = 14 * scale;
    const lh     = 20 * scale;

    ctx.save();
    ctx.font       = `600 ${fs}px Inter, system-ui, sans-serif`;
    const nameW    = ctx.measureText(tipData.cellName).width;
    ctx.font       = `400 ${fs * 0.84}px Inter, system-ui, sans-serif`;
    const eKeyW    = ctx.measureText('ENERGY').width;
    ctx.font       = `500 ${fs}px "JetBrains Mono", monospace`;
    const eValW    = ctx.measureText(tipData.energy).width;
    const boxW     = Math.max(nameW, eKeyW + eValW + pad * 2.5) + pad * 2;
    const boxH     = lh * 2 + pad * 2 + 8 * scale; // name + divider + energy row

    // Clamp so tooltip doesn't go off-canvas
    const bx = Math.min(tx, targetW - boxW - 4 * scale);
    const by = Math.min(ty, targetH - boxH - 4 * scale);

    // Background
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, radius);
    ctx.fillStyle = 'rgba(2,11,28,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(22,72,168,0.55)';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    // Cell name
    ctx.font      = `600 ${fs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#d6eaff';
    ctx.fillText(tipData.cellName, bx + pad, by + pad + fs);

    // Divider
    ctx.strokeStyle = 'rgba(22,72,168,0.35)';
    ctx.lineWidth   = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(bx + pad, by + pad + lh + 4 * scale);
    ctx.lineTo(bx + boxW - pad, by + pad + lh + 4 * scale);
    ctx.stroke();

    // Energy key + value
    const ey = by + pad + lh + 4 * scale + lh * 0.9;
    ctx.font      = `400 ${fs * 0.84}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#2c5270';
    ctx.fillText('ENERGY', bx + pad, ey);
    ctx.font      = `500 ${fs}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#d6eaff';
    ctx.textAlign = 'right';
    ctx.fillText(tipData.energy, bx + boxW - pad, ey);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  // ── 7b. Draw collision info HUD if enabled ───────────────────────────────
  const showCollision = !!document.getElementById('shot-show-collision')?.checked;
  if (showCollision && _lastEventInfo) {
    const info = _lastEventInfo;
    const scale = targetW / origW * origPR;
    const fields = [
      ['Date/Time',  info.dateTime],
      ['Run',        info.runNumber],
      ['Event',      info.eventNumber],
      ['Lumi Block', info.lumiBlock],
      ['Version',    info.version],
    ].filter(([, v]) => v);

    if (fields.length) {
      const fs     = 13 * scale;
      const lh     = 18 * scale;
      const colGap = 8  * scale;
      const margin = 10 * scale;

      ctx.save();
      ctx.fillStyle = '#66ccff';

      ctx.font = `400 ${fs * 0.78}px monospace`;
      const keyW = Math.max(...fields.map(([k]) => ctx.measureText(k.toUpperCase()).width));

      let x = margin, y = margin;

      for (const [k, v] of fields) {
        ctx.font = `400 ${fs * 0.78}px monospace`;
        ctx.globalAlpha = 0.25;
        ctx.fillText(k.toUpperCase(), x, y + lh * 0.82);
        ctx.font = `500 ${fs}px monospace`;
        ctx.globalAlpha = 0.45;
        ctx.fillText(v, x + keyW + colGap, y + lh * 0.82);
        y += lh;
      }

      ctx.restore();
    }
  }

  // ── 8. Restore original renderer state ──────────────────────────────────
  if (transparentBg) {
    scene.background = savedBg;
    renderer.setClearColor(0x000000, 1);
  }
  renderer.setPixelRatio(origPR);
  renderer.setSize(origW / origPR, origH / origPR, false);
  camera.aspect = origAspect;
  camera.fov    = origFov;
  camera.updateProjectionMatrix();
  markDirty();

  // ── 9. Download ─────────────────────────────────────────────────────────
  const ts   = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const link = document.createElement('a');
  link.download = `CGVWEB_${targetW}x${targetH}_${ts}.png`;
  link.href = offscreen.toDataURL('image/png');
  link.click();
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function fmtMev(v) {
  if (!isFinite(v)) return 'ALL';
  const a = Math.abs(v);
  if (a>=1000) return `${(v/1000).toPrecision(3)} GeV`;
  if (a>=1)    return `${v.toFixed(1)} MeV`;
  return `${v.toFixed(3)} MeV`;
}


// ── Download progress bar ─────────────────────────────────────────────────────

// ── Settings panel ────────────────────────────────────────────────────────────

// ── About button (panel head) ─────────────────────────────────────────────────
document.getElementById('btn-about').addEventListener('click', () => {
  aboutOverlay.classList.add('open');
});

// ── Mobile toolbar toggle (landscape-only) ────────────────────────────────────
// The toggle pill acts as both opener and closer:
//  • toolbar hidden → pill sits at the bottom, click slides toolbar up.
//  • toolbar open  → pill slides above the toolbar (.tb-open), click hides it.
(function () {
  const tb  = document.getElementById('toolbar');
  const btn = document.getElementById('btn-toolbar-toggle');
  const closeBtn = document.getElementById('btn-toolbar-close');
  // Mobile UI is enabled only for landscape small screens. Portrait triggers
  // the "rotate your device" overlay in CSS, so no JS handling needed there.
  const isLandscapeMobile = () =>
    window.innerHeight <= 520 && window.innerWidth > window.innerHeight;
  let tbVisible = !isLandscapeMobile();

  function apply() {
    tb.classList.toggle('tb-visible', tbVisible);
    // The toggle pill slides above the toolbar when open (only on mobile).
    btn.classList.toggle('tb-open', tbVisible && isLandscapeMobile());
  }
  // Apply initial state without animation
  tb.style.transition = 'none';
  apply();
  setTimeout(() => tb.style.transition = '', 50);

  btn.addEventListener('click', () => {
    if (isLandscapeMobile()) { tbVisible = !tbVisible; apply(); }
    else                     { tbVisible = true;       apply(); }
  });
  // Legacy in-toolbar close button (hidden by CSS on mobile, but keep a handler
  // in case it's exposed elsewhere or on non-mobile widths).
  if (closeBtn) closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (isLandscapeMobile()) { tbVisible = false; apply(); }
  });

  // On resize, reset to desktop state if needed
  window.addEventListener('resize', () => {
    if (!isLandscapeMobile()) {
      tbVisible = true;
      apply();
    }
  });
})();

// ── Slicer gizmo ──────────────────────────────────────────────────────────────
// A draggable 3D marker defining a cylindrical "bubble" at its current position.
// While active, any cell whose centre is inside the bubble is hidden (both the
// filled mesh AND its outline), so you can carve a hole through the detector.
// Cells outside the bubble render normally (subject to the usual thresholds /
// cluster filters).
// Cut-volume is an invisible Z-aligned cylindrical wedge anchored at the origin.
// The user controls two parameters by click-dragging the handle:
//   · screen-Y drag → angular sweep (thetaLength, 0..2π)
//   · screen-X drag → total height (mm, symmetric around origin)
// Right-click + drag translates the whole cut volume (handle + cylinder)
// along the scene's Z axis. Independent of the left-drag behaviours above.
// Show-all-cells toggle: when true, every mesh from the GLB whose detector is
// enabled is made visible. Cells absent from the current XML (not in `active`)
// are painted with the minimum-palette colour for their detector.
// Cell center world positions are cached on the handle itself (stable identity,
// no extra Map lookup). The center is computed from origMatrix + geometry
// bounding sphere, identical to the pre-refactor semantics.
function _cellCenter(h) {
  if (h._center) return h._center;
  const m = h.origMatrix.elements;
  const c = new THREE.Vector3(m[12], m[13], m[14]);
  // For a few un-transformed cells the translation is 0. Fall back to the
  // geometry's bounding-sphere centre so our "bubble" check isn't wrong.
  if (c.lengthSq() < 1e-6) {
    const geo = h.iMesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const bs = geo.boundingSphere;
    if (bs) c.copy(bs.center).applyMatrix4(h.origMatrix);
  }
  h._center = c;
  return c;
}

// Apply the slicer cut — hide any active cell whose centre is inside the bubble,
// then rebuild outlines so the outlined set matches what's visible.
function _applySlicerMask() {
  if (!slicer.isActive()) return;
  visHandles = [];
  const slicerMask = slicer.getMaskState();
  for (const [h, { energyMev, det, cellId, mbtsLabel }] of active) {
    const thr    = det === 'LAR' ? thrLArMev  : det === 'HEC' ? thrHecMev : thrTileMev;
    const detOn  = det === 'LAR' ? showLAr    : det === 'HEC' ? showHec   : showTile;
    let inCluster;
    if (activeClusterCellIds === null) {
      inCluster = true;
    } else if (mbtsLabel != null) {
      inCluster = activeMbtsLabels !== null && activeMbtsLabels.has(mbtsLabel);
    } else if (cellId != null) {
      inCluster = activeClusterCellIds.has(cellId);
    } else {
      inCluster = true;
    }
    const passThr    = slicer.isShowAllCells() || (!isFinite(thr) || energyMev >= thr);
    const passCl     = slicer.isShowAllCells() || inCluster;
    const passNeg    = slicer.isShowAllCells() || energyMev >= 0;
    const passFilter = detOn && passNeg && passThr && passCl;
    let vis = passFilter;
    if (vis) {
      const c = _cellCenter(h);
      // Inside Z-aligned cylindrical wedge at origin: r² in XY, z within
      // [zMin, zMax], and polar angle within [0, thetaLen).
      if (slicer.isPointInsideWedge(c.x, c.y, c.z, slicerMask)) vis = false;
    }
    _setHandleVisible(h, vis);
    if (vis) visHandles.push(h);
  }
  _syncNonActiveShowAll();
  _flushIMDirty();
  _rebuildRayIMeshes();
  rebuildAllOutlines();
  // FCAL tubes are drawn separately (instanced) — rebuild with current bubble.
  applyFcalThreshold();
  markDirty();
}

const slicer = createSlicerController({
  THREE,
  camera,
  canvas,
  controls,
  scene,
  slicerButton: document.getElementById('btn-slicer'),
  showAllButton: document.getElementById('btn-showall'),
  onMaskChange: () => {
    if (slicer.isActive()) _applySlicerMask();
    else refreshSceneVisibility();
  },
  onDisable: refreshSceneVisibility,
  onHideNonActiveShowAll: () => {
    for (const det of ['TILE', 'LAR', 'HEC']) {
      for (const h of cellMeshesByDet[det]) {
        if (!active.has(h)) _setHandleVisible(h, false);
      }
    }
    _flushIMDirty();
  },
});

setupScreenshotControls({
  camera,
  canvas,
  markDirty,
  renderer,
  scene,
  slicer,
  t,
  getLastEventInfo: () => _lastEventInfo,
  tooltip,
  tipCellEl,
  tipEEl,
});

registerViewerShortcuts({
  aboutOverlay,
  closeLayersPanel,
  closeSettingsPanel: sidebarControls.closeSettingsPanel,
  enterCinema,
  exitCinema,
  getState: () => ({
    cinemaMode: cinema.isCinemaMode(),
    layersPanelOpen,
    panelPinned: sidebarControls.getState().panelPinned,
    rpanelPinned: sidebarControls.getState().rpanelPinned,
    settingsPanelOpen: sidebarControls.getState().settingsPanelOpen,
  }),
  openSettingsPanel: sidebarControls.openSettingsPanel,
  resetCamera,
  setPinned: sidebarControls.setPinned,
  setPinnedR: sidebarControls.setPinnedR,
  slicer,
  toggleAllGhosts,
  toggleBeam,
});


