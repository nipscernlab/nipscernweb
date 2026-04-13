/**
 * NIPSCERN CGV-Preview — Full ATLAS Calorimeter Scene
 * Loads the complete geometry from projects/cgvweb/nipscern/
 * Three.js ES Module — GLB + WASM + XML event data
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Base path for nipscern assets
const NIPSCERN_BASE = new URL('../../projects/cgvweb/nipscern/', import.meta.url).href;

// ============================================================
// Main export
// ============================================================
export function initATLASScene(containerId = 'cgv-canvas-wrapper') {
  const wrapper = document.getElementById(containerId);
  if (!wrapper) return;

  const canvas  = wrapper.querySelector('#cgv-canvas');
  const loading = wrapper.querySelector('.cgv-loading');

  // ── Renderer ──────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    precision: 'mediump',
    preserveDrawingBuffer: false,
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.sortObjects = false;

  // ── Scene ─────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070f);
  scene.matrixAutoUpdate = false;

  // ── Camera ────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    45,
    wrapper.clientWidth / wrapper.clientHeight,
    10,
    100_000
  );
  camera.position.set(0, 0, 12_000);

  // ── Controls ──────────────────────────────────────────────
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.14;
  controls.zoomSpeed = 1.2;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;

  // ── State ─────────────────────────────────────────────────
  let dirty = true;
  let wasmOk = false;
  let sceneOk = false;
  let parse_atlas_ids_bulk = null;

  const meshByName = new Map();
  const origMat = new Map();
  let active = new Map();
  let rayTargets = [];
  let beamGroup = null;
  let beamOn = false;
  let allOutlinesMesh = null;
  let trackGroup = null;
  let showGhostTile = false;
  let ghostPhiGroup = null;

  const SUBSYS_TILE = 1;
  const SUBSYS_LAR_EM = 2;
  const SUBSYS_LAR_HEC = 3;
  const PAL_N = 256;
  const DEF_THR = 200;
  let thrTileMev = DEF_THR;
  let thrLArMev = DEF_THR;
  let thrHecMev = 1000;
  let showTile = true;
  let showLAr = true;
  let showHec = true;

  controls.addEventListener('change', () => { dirty = true; });

  // ── Render loop ───────────────────────────────────────────
  let frameId;
  (function loop() {
    frameId = requestAnimationFrame(loop);
    controls.update();
    if (controls.autoRotate) dirty = true;
    if (!dirty) return;
    renderer.render(scene, camera);
    dirty = false;
  })();

  // ── Resize ────────────────────────────────────────────────
  const onResize = () => {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  window.addEventListener('resize', onResize);

  // ── Palettes ──────────────────────────────────────────────
  function palColorTile(t) {
    t = Math.max(0, Math.min(1, t));
    return new THREE.Color(1.0 + t * (0.502 - 1.0), 1.0 + t * (0.0 - 1.0), 0.0);
  }
  const PAL_TILE = Array.from({ length: PAL_N }, (_, i) => {
    const c = palColorTile(i / (PAL_N - 1));
    c.offsetHSL(0, 0.35, 0);
    return new THREE.MeshBasicMaterial({ color: c, side: THREE.FrontSide });
  });
  const TILE_SCALE = 2000;
  function palMatTile(eMev) {
    return PAL_TILE[Math.round(Math.max(0, Math.min(1, eMev / TILE_SCALE)) * (PAL_N - 1))];
  }

  function palColorHec(t) {
    t = Math.max(0, Math.min(1, t));
    return new THREE.Color(0.4 + t * (0.0471 - 0.4), 0.8784 + t * (0.0118 - 0.8784), 0.9647 + t * (0.4078 - 0.9647));
  }
  const PAL_HEC = Array.from({ length: PAL_N }, (_, i) => {
    const c = palColorHec(i / (PAL_N - 1));
    c.offsetHSL(0, 0.35, 0);
    return new THREE.MeshBasicMaterial({ color: c, side: THREE.FrontSide });
  });
  const HEC_SCALE = 5000;
  function palMatHec(eMev) {
    return PAL_HEC[Math.round(Math.max(0, Math.min(1, eMev / HEC_SCALE)) * (PAL_N - 1))];
  }

  function palColorLAr(t) {
    t = Math.max(0, Math.min(1, t));
    return new THREE.Color(0.0902 + t * (0.1529 - 0.0902), 0.8118 + t * (0.0 - 0.8118), 0.2588);
  }
  const PAL_LAR = Array.from({ length: PAL_N }, (_, i) => {
    const c = palColorLAr(i / (PAL_N - 1));
    c.offsetHSL(0, 0.35, 0);
    return new THREE.MeshBasicMaterial({ color: c, side: THREE.FrontSide });
  });
  const LAR_SCALE = 1000;
  function palMatLAr(eMev) {
    return PAL_LAR[Math.round(Math.max(0, Math.min(1, eMev / LAR_SCALE)) * (PAL_N - 1))];
  }

  // ── Ghost ─────────────────────────────────────────────────
  const GHOST_TILE_NAMES = [
    'Calorimeter\u2192LBTile_0', 'Calorimeter\u2192LBTileLArg_0',
    'Calorimeter\u2192EBTilep_0', 'Calorimeter\u2192EBTilen_0',
    'Calorimeter\u2192EBTileHECp_0', 'Calorimeter\u2192EBTileHECn_0',
  ];
  const ghostSolidMat = new THREE.MeshBasicMaterial({
    color: 0x5C5F66, transparent: true, opacity: 0.04,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const ghostPhiMat = new THREE.LineBasicMaterial({
    color: 0xFFFFFF, transparent: true, opacity: 0.04, depthWrite: false,
  });

  const TILE_PHI_SEGS = [
    { rIn: 2288, rOut: 3835, zMin: -2820, zMax: 2820 },
    { rIn: 2288, rOut: 3835, zMin: 3600, zMax: 6050 },
    { rIn: 2288, rOut: 3835, zMin: -6050, zMax: -3600 },
  ];
  const N_PHI = 64;

  function buildPhiLines() {
    if (ghostPhiGroup) { scene.remove(ghostPhiGroup); ghostPhiGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    ghostPhiGroup = new THREE.Group();
    ghostPhiGroup.renderOrder = 6;
    ghostPhiGroup.visible = false;
    for (let i = 0; i < N_PHI; i++) {
      const phi = (i / N_PHI) * Math.PI * 2;
      const cx = Math.cos(phi), cy = Math.sin(phi);
      for (const { rIn, rOut, zMin, zMax } of TILE_PHI_SEGS) {
        const pts = [
          new THREE.Vector3(cx * rIn, cy * rIn, zMin),
          new THREE.Vector3(cx * rIn, cy * rIn, zMax),
          new THREE.Vector3(cx * rOut, cy * rOut, zMax),
          new THREE.Vector3(cx * rOut, cy * rOut, zMin),
          new THREE.Vector3(cx * rIn, cy * rIn, zMin),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        ghostPhiGroup.add(new THREE.Line(geo, ghostPhiMat));
      }
    }
    scene.add(ghostPhiGroup);
  }

  function applyGhostMesh(visible) {
    for (const name of GHOST_TILE_NAMES) {
      const mesh = meshByName.get(name);
      if (!mesh) continue;
      if (visible) {
        mesh.material = ghostSolidMat;
        mesh.renderOrder = 5;
        mesh.visible = true;
      } else {
        mesh.material = origMat.get(name) ?? mesh.material;
        mesh.renderOrder = 0;
        mesh.visible = false;
      }
    }
    if (ghostPhiGroup) ghostPhiGroup.visible = visible;
    dirty = true;
  }

  function toggleAllGhosts() {
    showGhostTile = !showGhostTile;
    buildPhiLines();
    applyGhostMesh(showGhostTile);
  }

  // ── Beam indicator ────────────────────────────────────────
  function buildBeamIndicator() {
    if (beamGroup) return;
    beamGroup = new THREE.Group();
    const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -13000), new THREE.Vector3(0, 0, 13000)]);
    beamGroup.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0x4a7fcc, transparent: true, opacity: 0.50, depthWrite: false })));
    const northMesh = new THREE.Mesh(new THREE.ConeGeometry(90, 520, 24, 1, false), new THREE.MeshBasicMaterial({ color: 0xee2222 }));
    northMesh.rotation.x = Math.PI / 2; northMesh.position.z = 13260; beamGroup.add(northMesh);
    const ringN = new THREE.Mesh(new THREE.TorusGeometry(90, 8, 8, 24), new THREE.MeshBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.55 }));
    ringN.rotation.x = Math.PI / 2; ringN.position.z = 13000; beamGroup.add(ringN);
    const southMesh = new THREE.Mesh(new THREE.ConeGeometry(90, 520, 24, 1, false), new THREE.MeshBasicMaterial({ color: 0x2244ee }));
    southMesh.rotation.x = -Math.PI / 2; southMesh.position.z = -13260; beamGroup.add(southMesh);
    const ringS = new THREE.Mesh(new THREE.TorusGeometry(90, 8, 8, 24), new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: 0.55 }));
    ringS.rotation.x = Math.PI / 2; ringS.position.z = -13000; beamGroup.add(ringS);
    beamGroup.visible = false; scene.add(beamGroup);
  }
  function toggleBeam() {
    buildBeamIndicator();
    beamOn = !beamOn;
    beamGroup.visible = beamOn;
    dirty = true;
  }

  // ── Outline caches ────────────────────────────────────────
  const eGeoCache = new Map();
  const outlineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  let outlineMesh = null;
  function clearOutline() {
    if (!outlineMesh) return; scene.remove(outlineMesh); outlineMesh = null; dirty = true;
  }
  function showOutline(mesh) {
    if (outlineMesh?.userData.src === mesh.name) return;
    clearOutline();
    mesh.updateWorldMatrix(true, false);
    const uid = mesh.geometry.uuid;
    if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(mesh.geometry, 30));
    outlineMesh = new THREE.LineSegments(eGeoCache.get(uid), outlineMat);
    outlineMesh.matrixAutoUpdate = false;
    outlineMesh.matrix.copy(mesh.matrixWorld);
    outlineMesh.matrixWorld.copy(mesh.matrixWorld);
    outlineMesh.renderOrder = 999; outlineMesh.userData.src = mesh.name;
    scene.add(outlineMesh); dirty = true;
  }

  const outlineAllMat = new THREE.LineBasicMaterial({ color: 0x000000 });
  const _edgeWorldCache = new Map();

  function _getWorldEdges(mesh) {
    const cached = _edgeWorldCache.get(mesh.name);
    if (cached) return cached;
    mesh.updateWorldMatrix(true, false);
    const uid = mesh.geometry.uuid;
    if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(mesh.geometry, 30));
    const src = eGeoCache.get(uid).getAttribute('position').array;
    const m = mesh.matrixWorld.elements;
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      const x = src[i], y = src[i + 1], z = src[i + 2];
      out[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    _edgeWorldCache.set(mesh.name, out);
    return out;
  }

  function clearAllOutlines() {
    if (!allOutlinesMesh) return;
    scene.remove(allOutlinesMesh);
    allOutlinesMesh.geometry.dispose();
    allOutlinesMesh = null;
    dirty = true;
  }

  function rebuildAllOutlines() {
    clearAllOutlines();
    if (!rayTargets.length) return;
    let total = 0;
    const edgeArrays = new Array(rayTargets.length);
    for (let i = 0; i < rayTargets.length; i++) {
      const arr = _getWorldEdges(rayTargets[i]);
      edgeArrays[i] = arr;
      total += arr.length;
    }
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
    dirty = true;
  }

  // ── Raycasting ────────────────────────────────────────────
  const raycast = new THREE.Raycaster();
  raycast.firstHitOnly = true;
  const mxy = new THREE.Vector2();
  let lastRay = 0;
  function doRaycast(clientX, clientY) {
    if (!active.size) { clearOutline(); return; }
    const topEl = document.elementFromPoint(clientX, clientY);
    if (topEl && topEl !== canvas) { clearOutline(); return; }
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      clearOutline(); return;
    }
    mxy.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycast.setFromCamera(mxy, camera);
    const hits = raycast.intersectObjects(rayTargets, false);
    if (hits.length && active.has(hits[0].object.name)) {
      showOutline(hits[0].object);
    } else {
      clearOutline();
    }
  }
  document.addEventListener('mousemove', e => {
    const now = Date.now(); if (now - lastRay < 50) return; lastRay = now;
    doRaycast(e.clientX, e.clientY);
  });
  canvas.addEventListener('mouseleave', () => { clearOutline(); });

  // ── Cell ID helpers ───────────────────────────────────────
  function compX(sec, samp, tow) {
    if (sec < 3) {
      if (samp === 0) return sec === 1 ? 1 : 5;
      if (samp === 1) return sec === 1 ? 23 : 6;
      if (samp === 2) return sec === 1 ? 4 : 7;
    } else {
      if (tow === 8) return 8; if (tow === 9) return 9;
      if (tow === 10) return 10; if (tow === 11) return 11;
      if (tow === 13) return 12; if (tow === 15) return 13;
    }
    return null;
  }
  function compK(tow, samp, x) {
    if (tow < 8) return samp === 2 ? Math.floor(tow / 2) : tow;
    if (tow === 8) return (x === 0 || x === 1) ? 8 : 0;
    if (tow === 9) { if (x === 1) return 9; if (x === 9) return 0; return null; }
    if (tow === 10) return 0;
    if (tow === 11) { if (x === 11 || x === 5) return 0; if (x === 6) return 1; return null; }
    if (tow === 12) { if (x === 5) return 1; if (x === 6) return 2; if (x === 7) return 1; return null; }
    if (tow === 13) { if (x === 12) return 0; if (x === 5) return 2; if (x === 6) return 3; return null; }
    if (tow === 14) { if (x === 5) return 3; if (x === 6) return 4; return null; }
    if (tow === 15) { if (x === 13) return 0; if (x === 5) return 4; return null; }
    return null;
  }

  // ── HEC mesh path ─────────────────────────────────────────
  const HEC_GROUPS_MAP = [
    { name: '1', innerBins: 10 },
    { name: '23', innerBins: 10 },
    { name: '45', innerBins: 9 },
    { name: '67', innerBins: 8 },
  ];
  function hecMeshPath(be, sampling, region, eta, phi) {
    const g = HEC_GROUPS_MAP[sampling];
    if (!g) return null;
    const Z = be > 0 ? 'p' : 'n';
    const cum = region === 0 ? eta : g.innerBins + eta;
    const B = cum;
    const path = `Calorimeter\u2192HEC_${g.name}_${region}_${Z}_0\u2192HEC_${g.name}_${region}_${Z}_${cum}_${B}\u2192cell_${phi}`;
    return meshByName.has(path) ? path : null;
  }

  // ── MBTS mesh path ────────────────────────────────────────
  function mbtsMeshPath(label) {
    const m = /^type_(-?1)_ch_([01])_mod_([0-7])$/.exec(label);
    if (!m) return null;
    const side = m[1] === '1' ? 'p' : 'n';
    const tileNum = m[2] === '0' ? 14 : 15;
    const mod = m[3];
    const path = `Calorimeter\u2192Tile${tileNum}${side}_0\u2192Tile${tileNum}${side}0_0\u2192cell_${mod}`;
    return meshByName.has(path) ? path : null;
  }

  // ── LAr EM mesh path ──────────────────────────────────────
  function larMeshPath(bec, samp, region, eta, phi) {
    const X = (bec === -1 || bec === 1) ? 'Barrel' : 'EndCap';
    const W = X === 'Barrel' ? 0 : 1;
    const Z = bec > 0 ? 'p' : 'n';
    const R = X === 'EndCap' ? Math.abs(bec) : region;
    const prefix = `Calorimeter\u2192EM${X}_${samp}_${R}_${Z}_${W}\u2192EM${X}_${samp}_${R}_${Z}_${eta}_${eta}\u2192`;
    if (meshByName.has(prefix + `cell_${phi}`)) return prefix + `cell_${phi}`;
    if (meshByName.has(prefix + `cell2_${phi}`)) return prefix + `cell2_${phi}`;
    return null;
  }

  // ── XML parsers ───────────────────────────────────────────
  function extractCells(doc, tagName) {
    const els = doc.getElementsByTagName(tagName);
    const cells = [];
    for (const el of els) {
      let n = 0;
      for (const ch of el.children) {
        const id = ch.getAttribute('id') ?? ch.getAttribute('cellID');
        const ev = ch.getAttribute('energy') ?? ch.getAttribute('e');
        if (id && ev) { const e = parseFloat(ev); if (isFinite(e)) { cells.push({ id: id.trim(), energy: e }); n++; } }
      }
      if (n) continue;
      const idEl = el.querySelector('id, cellID');
      const eEl = el.querySelector('energy, e');
      if (idEl && eEl) {
        const ids = idEl.textContent.trim().split(/\s+/);
        const ens = eEl.textContent.trim().split(/\s+/).map(Number);
        const m2 = Math.min(ids.length, ens.length);
        for (let i = 0; i < m2; i++) if (ids[i] && isFinite(ens[i])) cells.push({ id: ids[i], energy: ens[i] });
      }
    }
    return cells;
  }

  function parseTracks(doc) {
    const tracks = [];
    for (const el of doc.getElementsByTagName('Track')) {
      const numPolyEl = el.querySelector('numPolyline');
      const pxEl = el.querySelector('polylineX');
      const pyEl = el.querySelector('polylineY');
      const pzEl = el.querySelector('polylineZ');
      if (!numPolyEl || !pxEl || !pyEl || !pzEl) continue;
      const numPoly = numPolyEl.textContent.trim().split(/\s+/).map(Number);
      const xs = pxEl.textContent.trim().split(/\s+/).map(Number);
      const ys = pyEl.textContent.trim().split(/\s+/).map(Number);
      const zs = pzEl.textContent.trim().split(/\s+/).map(Number);
      const ptEl = el.querySelector('pt');
      const ptArr = ptEl ? ptEl.textContent.trim().split(/\s+/).map(Number) : [];
      let off = 0;
      for (let i = 0; i < numPoly.length; i++) {
        const n = numPoly[i];
        if (n >= 2) {
          const pts = [];
          for (let j = 0; j < n; j++) {
            const k = off + j;
            pts.push(new THREE.Vector3(-xs[k] * 10, -ys[k] * 10, zs[k] * 10));
          }
          tracks.push({ pts, ptGev: i < ptArr.length ? Math.abs(ptArr[i]) : 0 });
        }
        off += n;
      }
    }
    return tracks;
  }

  // ── Track rendering ───────────────────────────────────────
  const TRACK_MAT = new THREE.LineBasicMaterial({ color: 0xffea00, depthWrite: false });
  function drawTracks(tracks) {
    if (trackGroup) {
      trackGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      scene.remove(trackGroup);
    }
    trackGroup = null;
    if (!tracks.length) return;
    trackGroup = new THREE.Group();
    trackGroup.renderOrder = 5;
    for (const { pts } of tracks) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      trackGroup.add(new THREE.Line(geo, TRACK_MAT));
    }
    scene.add(trackGroup);
  }

  // ── Scene reset / threshold ───────────────────────────────
  function resetScene() {
    for (const [name, mesh] of meshByName) {
      mesh.visible = false; mesh.material = origMat.get(name) ?? mesh.material; mesh.renderOrder = 0;
    }
    active.clear(); rayTargets = [];
    clearOutline(); clearAllOutlines();
    if (trackGroup) { trackGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); scene.remove(trackGroup); trackGroup = null; }
    dirty = true;
  }
  function applyThreshold() {
    rayTargets = [];
    for (const [name, { energyMev, det }] of active) {
      const mesh = meshByName.get(name); if (!mesh) continue;
      const thr = det === 'LAR' ? thrLArMev : det === 'HEC' ? thrHecMev : thrTileMev;
      const detOn = det === 'LAR' ? showLAr : det === 'HEC' ? showHec : showTile;
      const vis = detOn && (!isFinite(thr) || energyMev >= thr);
      mesh.visible = vis; if (vis) rayTargets.push(mesh);
    }
    rebuildAllOutlines();
    dirty = true;
  }

  // ── Process XML ───────────────────────────────────────────
  function processXml(xmlText) {
    if (!wasmOk) return;
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    const pe = doc.querySelector('parsererror');
    if (pe) { console.error('XML parse error:', pe.textContent.slice(0, 120)); return; }

    const tileCells = extractCells(doc, 'TILE');
    const larCells = extractCells(doc, 'LAr');
    const hecCells = extractCells(doc, 'HEC');

    const mbtsCells = [];
    const mbtsEls = doc.getElementsByTagName('MBTS');
    for (const el of mbtsEls) {
      let n = 0;
      for (const ch of el.children) {
        const label = ch.getAttribute('label');
        const ev = ch.getAttribute('energy') ?? ch.getAttribute('e');
        if (label && ev) { const e = parseFloat(ev); if (isFinite(e)) { mbtsCells.push({ label: label.trim(), energy: e }); n++; } }
      }
      if (n) continue;
      const lblEl = el.querySelector('label');
      const eEl = el.querySelector('energy, e');
      if (lblEl && eEl) {
        const labels = lblEl.textContent.trim().split(/\s+/);
        const ens = eEl.textContent.trim().split(/\s+/).map(Number);
        const m2 = Math.min(labels.length, ens.length);
        for (let i = 0; i < m2; i++) if (labels[i] && isFinite(ens[i])) mbtsCells.push({ label: labels[i], energy: ens[i] });
      }
    }

    const total = tileCells.length + larCells.length + hecCells.length + mbtsCells.length;
    if (!total) { console.warn('No cells found in XML'); return; }

    resetScene();

    // Tracks
    try { drawTracks(parseTracks(doc)); } catch (e) { console.warn('Track error', e); }

    // Bulk WASM decode
    function idsToStr(cells) {
      let s = cells[0].id;
      for (let i = 1; i < cells.length; i++) s += ' ' + cells[i].id;
      return s;
    }
    const tilePacked = tileCells.length ? parse_atlas_ids_bulk(idsToStr(tileCells)) : null;
    const larPacked = larCells.length ? parse_atlas_ids_bulk(idsToStr(larCells)) : null;
    const hecPacked = hecCells.length ? parse_atlas_ids_bulk(idsToStr(hecCells)) : null;

    // TileCal
    for (let i = 0; i < tileCells.length; i++) {
      const base = i * 6;
      if (tilePacked[base] !== SUBSYS_TILE) continue;
      const section = tilePacked[base + 1], side = tilePacked[base + 2],
        module = tilePacked[base + 3], tower = tilePacked[base + 4], sampling = tilePacked[base + 5];
      const eMev = tileCells[i].energy * 1000;
      const x = compX(section, sampling, tower); if (x === null) continue;
      const k = compK(tower, sampling, x); if (k === null) continue;
      const y = side < 0 ? 'n' : 'p';
      const path = `Calorimeter\u2192Tile${x}${y}_0\u2192Tile${x}${y}${k}_${k}\u2192cell_${module}`;
      const mesh = meshByName.get(path);
      if (!mesh) continue;
      mesh.material = palMatTile(eMev); mesh.visible = true; mesh.renderOrder = 2;
      active.set(path, { energyMev: eMev, det: 'TILE' });
    }

    // LAr EM
    for (let i = 0; i < larCells.length; i++) {
      const base = i * 6;
      if (larPacked[base] !== SUBSYS_LAR_EM) continue;
      const bec = larPacked[base + 1], sampling = larPacked[base + 2],
        region = larPacked[base + 3], eta = larPacked[base + 4], phi = larPacked[base + 5];
      const eMev = larCells[i].energy * 1000;
      const path = larMeshPath(bec, sampling, region, eta, phi);
      if (!path) continue;
      const mesh = meshByName.get(path);
      if (!mesh) continue;
      mesh.material = palMatLAr(eMev); mesh.visible = true; mesh.renderOrder = 2;
      active.set(path, { energyMev: eMev, det: 'LAR' });
    }

    // HEC
    for (let i = 0; i < hecCells.length; i++) {
      const base = i * 6;
      if (hecPacked[base] !== SUBSYS_LAR_HEC) continue;
      const be = hecPacked[base + 1], sampling = hecPacked[base + 2],
        region = hecPacked[base + 3], eta = hecPacked[base + 4], phi = hecPacked[base + 5];
      const eMev = hecCells[i].energy * 1000;
      const path = hecMeshPath(be, sampling, region, eta, phi);
      if (!path) continue;
      const mesh = meshByName.get(path);
      if (!mesh) continue;
      mesh.material = palMatHec(eMev); mesh.visible = true; mesh.renderOrder = 2;
      active.set(path, { energyMev: eMev, det: 'HEC' });
    }

    // MBTS
    for (let i = 0; i < mbtsCells.length; i++) {
      const { label, energy } = mbtsCells[i];
      const eMev = energy * 1000;
      const path = mbtsMeshPath(label);
      if (!path) continue;
      const mesh = meshByName.get(path);
      if (!mesh) continue;
      mesh.material = palMatTile(eMev); mesh.visible = true; mesh.renderOrder = 2;
      active.set(path, { energyMev: eMev, det: 'TILE' });
    }

    applyThreshold();

    if (showGhostTile) applyGhostMesh(true);
  }

  // ── Boot ──────────────────────────────────────────────────
  let _glbDone = false, _wasmDone = false;

  function tryStart() {
    if (!_glbDone || !_wasmDone) return;
    // Hide loading overlay
    loading?.classList.add('hidden');

    toggleAllGhosts();
    toggleBeam();
    fetch(NIPSCERN_BASE + 'JiveXML_518084_14173642443.xml')
      .then(r => r.text())
      .then(xml => { processXml(xml); dirty = true; })
      .catch(e => console.error('Failed to load XML:', e));
  }

  // Load GLB geometry
  new GLTFLoader().load(
    NIPSCERN_BASE + 'CaloGeometry.glb',
    ({ scene: g }) => {
      const meshes = [];
      g.traverse(o => { if (o.isMesh) meshes.push(o); });
      for (const m of meshes) {
        m.updateWorldMatrix(true, false);
        m.matrix.copy(m.matrixWorld);
        m.matrixAutoUpdate = false;
        m.frustumCulled = false;
        m.visible = false;
        meshByName.set(m.name, m);
        origMat.set(m.name, m.material);
        scene.add(m);
      }
      sceneOk = true; dirty = true;
      _glbDone = true;
      tryStart();
    },
    undefined,
    (err) => { console.error('GLB load error:', err); _glbDone = true; tryStart(); }
  );

  // Load WASM parser — dynamic import resolves import.meta.url correctly
  const parserUrl = NIPSCERN_BASE + 'atlas_id_parser.js';
  import(/* webpackIgnore: true */ parserUrl)
    .then(async (mod) => {
      // Init the WASM (default export is the init function)
      await mod.default();
      // Now parse_atlas_ids_bulk is ready to use
      parse_atlas_ids_bulk = mod.parse_atlas_ids_bulk;
      wasmOk = true;
      _wasmDone = true;
      tryStart();
    })
    .catch(e => { console.error('WASM init error:', e); _wasmDone = true; tryStart(); });

  // ── Cleanup ───────────────────────────────────────────────
  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    controls.dispose();
  };
}
