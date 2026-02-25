// ============================================================
//  CGV-WEB v3.0 — main.js
//  NIPSCERN Laboratory × ATLAS / CERN
// ============================================================
import * as THREE from 'three';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass }        from 'three/addons/postprocessing/SMAAPass.js';
import init, { process_xml_data, pick_cell_ray } from './pkg/cgv_web.js';
import { createIcons, icons } from 'lucide';
createIcons({ icons });

await init();

// ──────────────────────────────────────────────────────────
//  Layer → Sub-detector mapping
// ──────────────────────────────────────────────────────────
const LAYER_DET = new Uint8Array(26);
for (let i = 0;  i <= 13; i++) LAYER_DET[i] = 0; // TileCal
for (let i = 14; i <= 17; i++) LAYER_DET[i] = 1; // HEC
for (let i = 18; i <= 25; i++) LAYER_DET[i] = 2; // LAr EM

const DET_NAMES = ['TileCal', 'HEC', 'LAr EM'];
const DET_KEYS  = ['tile', 'hec', 'lar'];

// ──────────────────────────────────────────────────────────
//  DOM refs
// ──────────────────────────────────────────────────────────
const canvas          = document.getElementById('gl-canvas');
const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const toastEl         = document.getElementById('toast');
const toastPip        = document.getElementById('toast-pip');
const toastTextEl     = document.getElementById('toast-text');
const cellCountEl     = document.getElementById('cell-count');
const energyRangeEl   = document.getElementById('info-energy-range');
const energyPanel     = document.getElementById('energy-panel');
const epMax           = document.getElementById('ep-max');
const epMin           = document.getElementById('ep-min');
const threshDisp      = document.getElementById('threshold-display');
const gradTrack       = document.getElementById('grad-track');
const trackHandle     = document.getElementById('track-handle');
const trackDim        = document.getElementById('track-dim');
const sliderTip       = document.getElementById('slider-tip');
const tipVal          = document.getElementById('tip-val');
const tipPct          = document.getElementById('tip-pct');
const btnReset        = document.getElementById('btn-reset');
const btnSnap         = document.getElementById('btn-snapshot');
const btnHelp         = document.getElementById('btn-help');
const modalOv         = document.getElementById('modal-overlay');
const modalCloseBtn   = document.getElementById('modal-close-btn');
const ghostLbl        = document.getElementById('ghost-lbl');
const cellTooltip     = document.getElementById('cell-tooltip');
const ctEnergy        = document.getElementById('ct-energy');
const ctLayer         = document.getElementById('ct-layer');
const ctEta           = document.getElementById('ct-eta');
const ctPhi           = document.getElementById('ct-phi');
const clipSlider      = document.getElementById('clip-slider');
const clipFill        = document.getElementById('clip-fill');
const clipValDisp     = document.getElementById('clip-val-display');
const zdiBar          = document.getElementById('zdi-bar');
const gpToggleBtn     = document.getElementById('gp-toggle-btn');
const gpBody          = document.getElementById('gp-body');
const btnFocus        = document.getElementById('btn-focus');
const focusOverlay    = document.getElementById('focus-overlay');
const btnExitFocus    = document.getElementById('btn-exit-focus');
const detChecks       = [...document.querySelectorAll('.det-check')];
const modeSolidBtn    = document.getElementById('mode-solid');
const modeWireBtn     = document.getElementById('mode-wire');
const filenameDisplay = document.getElementById('filename-display');
const filenameText    = document.getElementById('filename-text');
const metaFilename    = document.getElementById('meta-filename');
const dzBrowseBtn     = document.getElementById('dz-browse-btn');
const dzSampleBtn     = document.getElementById('dz-sample-btn');
const loadingBar      = document.getElementById('loading-bar');
const loadingFill     = document.getElementById('loading-fill');
const loadingLabel    = document.getElementById('loading-label');
const activeBlocksEl  = document.getElementById('active-blocks');
const xmlDateEl       = document.getElementById('xml-date');
const wikiToggleBtn   = document.getElementById('wiki-toggle-btn');
const wikiPanel       = document.getElementById('wiki-panel');
const wikiCloseBtn    = document.getElementById('wiki-close-btn');
const cellHoverToggle = document.getElementById('cell-hover-toggle');
const metaToggleBtn   = document.getElementById('meta-toggle-btn');
const metaBody        = document.getElementById('meta-body');
const metaChevron     = document.getElementById('meta-chevron');

// ──────────────────────────────────────────────────────────
//  Cell hover enabled flag
// ──────────────────────────────────────────────────────────
let cellHoverEnabled = true;
cellHoverToggle?.addEventListener('change', e => {
  cellHoverEnabled = e.target.checked;
  if (!cellHoverEnabled) clearTooltip();
});

// ──────────────────────────────────────────────────────────
//  Metadata panel collapse
// ──────────────────────────────────────────────────────────
let metaCollapsed = false;
metaToggleBtn?.addEventListener('click', () => {
  metaCollapsed = !metaCollapsed;
  metaBody?.classList.toggle('collapsed', metaCollapsed);
  metaToggleBtn.setAttribute('aria-expanded', String(!metaCollapsed));
  if (metaChevron) {
    metaChevron.style.transform = metaCollapsed ? 'rotate(180deg)' : '';
  }
});

// ──────────────────────────────────────────────────────────
//  Renderer
// ──────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000811);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;   // slightly reduced for balanced look
renderer.localClippingEnabled = true;

// ──────────────────────────────────────────────────────────
//  Scene & Camera
// ──────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
scene.fog    = new THREE.FogExp2(0x000811, 0.006);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.01, 300);
camera.position.set(10, 5, 16);
camera.lookAt(0, 0, 0);

// ──────────────────────────────────────────────────────────
//  Post-processing: Bloom (reduced) + SMAA + Output
// ──────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// ▼ Bloom values significantly reduced for premium scientific look
// strength: 0.60→0.22, radius: 0.50→0.38, threshold: 0.34→0.52
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.22,  // strength  — was 0.60 (too aggressive)
  0.38,  // radius    — keeps soft halo without bleeding
  0.52,  // threshold — only bright cells bloom, not geometry
);
composer.addPass(bloomPass);

const smaaPass = new SMAAPass(
  window.innerWidth  * renderer.getPixelRatio(),
  window.innerHeight * renderer.getPixelRatio(),
);
smaaPass.edgeDetectionThreshold = 0.02;
smaaPass.maxSearchSteps = 32;
smaaPass.maxSearchStepsDiagonal = 16;
composer.addPass(smaaPass);
composer.addPass(new OutputPass());

// ──────────────────────────────────────────────────────────
//  Controls — cinematic damping
// ──────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping   = true;
controls.dampingFactor   = 0.048;
controls.minDistance     = 0.5;
controls.maxDistance     = 90;
controls.autoRotate      = true;
controls.autoRotateSpeed = 0.22;

// ──────────────────────────────────────────────────────────
//  Lighting — balanced, artistic
// ──────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x001828, 1.4));

const sun = new THREE.DirectionalLight(0xffffff, 1.75);
sun.position.set(8, 18, 10);
scene.add(sun);

// Warm fill from below-side for depth
const warmFill = new THREE.DirectionalLight(0xffc870, 0.28);
warmFill.position.set(-14, -2, 9);
scene.add(warmFill);

// Cool blue-fill from rear
const coolFill = new THREE.DirectionalLight(0x1a3050, 0.36);
coolFill.position.set(-14, -4, -8);
scene.add(coolFill);

// ──────────────────────────────────────────────────────────
//  Central beam axis + North marker
// ──────────────────────────────────────────────────────────
let axisGroup   = null;
let axisVisible = true;

function buildAxis() {
  if (axisGroup) { scene.remove(axisGroup); axisGroup = null; }
  const g = new THREE.Group();

  const lineMat = new THREE.LineBasicMaterial({ color: 0x1a4a6a, transparent: true, opacity: 0.55 });
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(0, 0,  10),
  ]);
  g.add(new THREE.Line(lineGeo, lineMat));

  // North cone at +Z
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xc84040, transparent: true, opacity: 0.82 });
  const coneGeo = new THREE.ConeGeometry(0.055, 0.26, 8);
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.z = 9.2;
  cone.rotation.x = -Math.PI / 2;
  g.add(cone);

  scene.add(g);
  axisGroup = g;
}
buildAxis();

function setAxisVisible(v) {
  axisVisible = v;
  if (axisGroup) axisGroup.visible = v;
}
document.getElementById('axis-toggle')?.addEventListener('change', e => {
  setAxisVisible(e.target.checked);
});

// ──────────────────────────────────────────────────────────
//  Z-Axis slice
// ──────────────────────────────────────────────────────────
let currentClipZ = Infinity;

clipSlider.addEventListener('input', () => {
  const pct = parseInt(clipSlider.value, 10) / 100;
  clipFill.style.width = `${pct * 100}%`;

  // Update depth indicator bar width (100% = full, 0% = core only)
  if (zdiBar) zdiBar.style.width = `${pct * 100}%`;

  if (pct >= 0.999) {
    currentClipZ = Infinity;
    renderer.clippingPlanes = [];
    if (clipValDisp) clipValDisp.textContent = 'OFF';
  } else {
    const MAX_Z = 8.5;
    const z = pct * MAX_Z;
    currentClipZ = z;
    renderer.clippingPlanes = [];
    if (clipValDisp) clipValDisp.textContent = `${(z * 1000).toFixed(0)}\u00a0mm`;
  }
  applyCombinedFilter();
});

// ──────────────────────────────────────────────────────────
//  Ghost calorimeter
// ──────────────────────────────────────────────────────────
let ghostGrp = null;

function buildGhost() {
  if (ghostGrp) { scene.remove(ghostGrp); ghostGrp = null; }
  const g = new THREE.Group();

  const shell = (r, hl, zc, op, col) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, hl * 2, 80, 1, true),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }),
    );
    m.rotation.x = Math.PI / 2; m.position.z = zc;
    g.add(m);
  };
  const ring = (rI, rO, z, op, col) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(rI, rO, 80),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }),
    );
    m.rotation.x = Math.PI / 2; m.position.z = z;
    g.add(m);
  };

  const G = 0.048, E = 0.12;
  const EM = 0x0d3a4a, TI = 0x0a2038, HC = 0x06121c;

  shell(1.42, 3.17,  0, G,       EM); shell(1.98, 3.17, 0, G * 0.6, EM);
  for (const z of [3.17, -3.17]) ring(1.42, 1.98, z, E * 0.5, EM);
  shell(2.30, 3.82,  0, G * 0.85, TI); shell(3.82, 3.82, 0, G * 0.42, TI);
  for (const z of [3.82, -3.82]) ring(2.30, 3.82, z, E * 0.28, TI);

  for (const s of [1, -1]) {
    const zc = s * 3.745;
    shell(0.33, 0.065, zc, G * 1.1, EM); shell(2.10, 0.065, zc, G * 1.1, EM);
    ring(0.33, 2.10, s * 3.68, E * 0.48, EM); ring(0.33, 2.10, s * 3.81, E * 0.36, EM);
  }
  for (const s of [1, -1]) {
    const z0 = s * 3.20, z1 = s * 5.20, zc = (z0 + z1) / 2, hl = Math.abs(z1 - z0) / 2;
    shell(2.30, hl, zc, G, TI); shell(3.82, hl, zc, G * 0.40, TI);
    ring(2.30, 3.82, z0, E * 0.26, TI); ring(2.30, 3.82, z1, E * 0.26, TI);
  }
  for (const s of [1, -1]) {
    const z0 = s * 4.35, z1 = s * 6.05, zc = (z0 + z1) / 2, hl = Math.abs(z1 - z0) / 2;
    shell(0.37, hl, zc, G * 0.62, HC); shell(2.00, hl, zc, G * 0.62, HC);
    ring(0.37, 2.00, z0, E * 0.22, HC); ring(0.37, 2.00, z1, E * 0.22, HC);
  }
  for (const s of [1, -1]) {
    const z0 = s * 4.60, z1 = s * 5.60, zc = (z0 + z1) / 2, hl = Math.abs(z1 - z0) / 2;
    shell(0.05, hl, zc, G * 0.82, HC); shell(0.45, hl, zc, G * 0.82, HC);
    ring(0.05, 0.45, z0, E * 0.32, HC); ring(0.05, 0.45, z1, E * 0.32, HC);
  }

  g.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -9.5), new THREE.Vector3(0, 0, 9.5),
    ]),
    new THREE.LineBasicMaterial({ color: 0x0a2030, transparent: true, opacity: 0.45 }),
  ));

  const eqRing = new THREE.Mesh(
    new THREE.RingGeometry(4.68, 4.72, 96),
    new THREE.MeshBasicMaterial({ color: 0x0a2a3a, side: THREE.DoubleSide, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  eqRing.rotation.x = Math.PI / 2;
  g.add(eqRing);

  const coneGeo = new THREE.ConeGeometry(0.065, 0.28, 8);
  const mk = (col, z, rx) => {
    const m = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.65 }));
    m.position.z = z; m.rotation.x = rx; return m;
  };
  g.add(mk(0x70c8b0,  9.0, -Math.PI / 2));
  g.add(mk(0xc87860, -9.0,  Math.PI / 2));

  scene.add(g);
  ghostGrp = g;
}
buildGhost();

// ──────────────────────────────────────────────────────────
//  Custom ShaderMaterial
// ──────────────────────────────────────────────────────────
const shaderUniforms = {
  u_threshold: { value: 0.0  },
  u_time:      { value: 0.0  },
  u_highlight: { value: -1.0 },
};

const vertexShader = /* glsl */`
  #include <clipping_planes_pars_vertex>

  attribute float a_energy;
  attribute float a_active;
  attribute float a_iid;
  attribute vec3  a_normal;   // normal plana pré-computada por face no CPU

  varying float v_energy;
  varying float v_active;
  varying float v_iid;
  varying vec3  v_col;
  varying vec3  v_worldPos;
  varying vec3  v_normal;

  void main() {
    v_energy   = a_energy;
    v_active   = a_active;
    v_iid      = a_iid;
    v_col      = color;
    v_normal   = normalize(normalMatrix * a_normal);  // transforma para view-space

    vec4 wp    = modelMatrix * vec4(position, 1.0);
    v_worldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;

    #include <clipping_planes_vertex>
  }
`;

const fragmentShader = /* glsl */`
  #include <clipping_planes_pars_fragment>

  uniform float u_threshold;
  uniform float u_time;
  uniform float u_highlight;

  varying float v_energy;
  varying float v_active;
  varying float v_iid;
  varying vec3  v_col;
  varying vec3  v_worldPos;
  varying vec3  v_normal;

  void main() {
    #include <clipping_planes_fragment>

    if (v_active < 0.5)         discard;
    if (v_energy < u_threshold) discard;

    // Normal estável vinda do CPU — sem dFdx/dFdy
    vec3 N = normalize(v_normal);

    vec3 L1 = normalize(vec3(0.50,  0.90, 0.45));
    vec3 L2 = normalize(vec3(-0.70, -0.25, -0.55));
    float d1 = max(dot(N, L1), 0.0) * 0.52;
    float d2 = max(dot(N, L2), 0.0) * 0.10;

    vec3 V    = normalize(cameraPosition - v_worldPos);
    float rim = pow(1.0 - max(dot(V, N), 0.0), 5.0) * 0.07;

    vec3 lit = v_col * (0.28 + d1 + d2) + vec3(rim * 0.18);

    float sp = pow(max(dot(reflect(-L1, N), V), 0.0), 48.0) * 0.04 * v_energy;
    lit += vec3(0.85, 0.68, 0.20) * sp;

    float boost = 1.0 + v_energy * v_energy * 0.55;
    lit *= boost;

    float isHot = step(u_highlight - 0.5, v_iid) * step(v_iid, u_highlight + 0.5);
    lit = mix(lit, lit * 1.35 + vec3(0.05, 0.03, 0.0), isHot * 0.55);

    gl_FragColor = vec4(lit, 0.92);
  }
`;

// ──────────────────────────────────────────────────────────
//  Cell data state
// ──────────────────────────────────────────────────────────
let minE = 0, maxE = 1;
let cellNormEnergies = null;
let cellLayerIds     = null;
let cellEtaIds       = null;
let cellPhiIds       = null;
let activeAttr       = null;
const detEnabled     = { tile: true, hec: true, lar: true };

// ──────────────────────────────────────────────────────────
//  ★ WIREFRAME OVERLAY — ARB8 real
//  Traça as 12 arestas do prisma trapezoidal de cada célula
//  diretamente a partir dos vértices ARB8, sem transformar
//  o cubo unitário. Uma draw call, sem instâncias.
// ──────────────────────────────────────────────────────────
let wireActive   = false;
let wireLinesObj = null;

// 12 arestas do prisma ARB8 como pares de índices em v[0..7]:
//   face z-:      0-2, 2-6, 6-4, 4-0
//   face z+:      1-3, 3-7, 7-5, 5-1
//   verticais:    0-1, 2-3, 4-5, 6-7
const ARB8_EDGE_PAIRS = new Uint8Array([
  0, 2,  2, 6,  6, 4,  4, 0,   // face z-
  1, 3,  3, 7,  7, 5,  5, 1,   // face z+
  0, 1,  2, 3,  4, 5,  6, 7,   // arestas verticais
]);
const ARB8_EDGES_N = ARB8_EDGE_PAIRS.length / 2; // 12 arestas
const ARB8_LINE_VERTS = ARB8_EDGES_N * 2;        // 24 verts por célula

function buildWireframeOverlay() {
  // Descarta overlay anterior
  if (wireLinesObj) {
    scene.remove(wireLinesObj);
    wireLinesObj.geometry.dispose();
    wireLinesObj.material.dispose();
    wireLinesObj = null;
  }
  if (!activeMesh) return;

  const n = cellCount;
  const thr = shaderUniforms.u_threshold.value;

  // Conta células visíveis para dimensionar o buffer exato
  let visCount = 0;
  for (let i = 0; i < n; i++) {
    if (activeAttr && activeAttr[i] < 0.5) continue;
    if (cellNormEnergies && cellNormEnergies[i] < thr) continue;
    visCount++;
  }
  if (visCount === 0) return;

  const pos = new Float32Array(visCount * ARB8_LINE_VERTS * 3);
  let   off = 0;

  if (cellArb8Verts) {
    // ── Caminho rápido: usa vértices ARB8 reais ────────────────────────────
    for (let i = 0; i < n; i++) {
      if (activeAttr && activeAttr[i] < 0.5) continue;
      if (cellNormEnergies && cellNormEnergies[i] < thr) continue;

      const base = i * 24; // offset no flat array (24 floats = 8 verts × xyz)
      for (let e = 0; e < ARB8_EDGE_PAIRS.length; e += 2) {
        const ia = base + ARB8_EDGE_PAIRS[e]     * 3;
        const ib = base + ARB8_EDGE_PAIRS[e + 1] * 3;
        pos[off++] = cellArb8Verts[ia];     pos[off++] = cellArb8Verts[ia+1]; pos[off++] = cellArb8Verts[ia+2];
        pos[off++] = cellArb8Verts[ib];     pos[off++] = cellArb8Verts[ib+1]; pos[off++] = cellArb8Verts[ib+2];
      }
    }
  } else {
    // ── Fallback: transforma cubo unitário pela instanceMatrix (legado) ────
    const _baseEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const _edgePos     = _baseEdgeGeo.getAttribute('position').array;
    const _edgeVerts   = _edgePos.length / 3;
    const m4 = new THREE.Matrix4();
    const v  = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      if (activeAttr && activeAttr[i] < 0.5) continue;
      if (cellNormEnergies && cellNormEnergies[i] < thr) continue;
      activeMesh.getMatrixAt(i, m4);
      for (let j = 0; j < _edgeVerts; j++) {
        v.set(_edgePos[j*3], _edgePos[j*3+1], _edgePos[j*3+2]).applyMatrix4(m4);
        pos[off++] = v.x; pos[off++] = v.y; pos[off++] = v.z;
      }
    }
    _baseEdgeGeo.dispose();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

  const mat = new THREE.LineBasicMaterial({
    color:       0x1a8fbb,
    transparent: true,
    opacity:     0.32,
  });

  if (renderer.clippingPlanes.length) {
    mat.clippingPlanes = renderer.clippingPlanes.slice();
  }

  wireLinesObj = new THREE.LineSegments(geo, mat);
  scene.add(wireLinesObj);
}

function setWireframe(active) {
  wireActive = active;
  modeSolidBtn?.classList.toggle('active', !active);
  modeWireBtn?.classList.toggle('active',   active);

  if (active) {
    if (activeMesh) activeMesh.visible = false;
    buildWireframeOverlay();
  } else {
    if (activeMesh) activeMesh.visible = true;
    if (wireLinesObj) {
      scene.remove(wireLinesObj);
      wireLinesObj.geometry.dispose();
      wireLinesObj.material.dispose();
      wireLinesObj = null;
    }
  }
}

modeSolidBtn?.addEventListener('click', () => setWireframe(false));
modeWireBtn?.addEventListener('click',  () => setWireframe(!wireActive));

// ──────────────────────────────────────────────────────────
//  Cell Z-positions (for Z-axis filtering)
// ──────────────────────────────────────────────────────────
let cellZPositions = null;


// ──────────────────────────────────────────────────────────
//  Build / tear down InstancedMesh
// ──────────────────────────────────────────────────────────
let activeMesh = null;
let cellCount = 0; // total de células do evento atual

// ── Variável global: vértices ARB8 de cada célula (metros, flat array) ───────
// Layout: 24 floats/célula → [v0.x,v0.y,v0.z, v1.x,..., v7.x,v7.y,v7.z]
// Usado pelo wireframe overlay para traçar as arestas reais.
let cellArb8Verts = null;

// ──────────────────────────────────────────────────────────
//  buildMesh — v4.0 (GPU arrays prontos do WASM)
//
//  [OPT-2] O loop pesado de geometria agora roda em Rust (10–50× mais rápido).
//  O WASM retorna Float32Array/Uint32Array prontos para BufferGeometry.
//  O JS apenas passa os buffers para a GPU e aplica a bounding sphere.
//
//  [OPT-1] instanceMatrix (build_matrix) foi eliminada do Rust.
//           O JS não precisa mais setMatrixAt() ou atribuir matrices.
//
//  [OPT-3] Frustum culling habilitado via geo.boundingSphere calculada pelo WASM.
// ──────────────────────────────────────────────────────────
function buildMesh(result) {
  // ── Tear-down ────────────────────────────────────────────────────────────
  if (activeMesh) {
    scene.remove(activeMesh);
    activeMesh.geometry.dispose();
    activeMesh.material.dispose();
    activeMesh = null;
  }
  if (wireLinesObj) {
    scene.remove(wireLinesObj);
    wireLinesObj.geometry.dispose();
    wireLinesObj.material.dispose();
    wireLinesObj = null;
  }

  const n = result.count;
  if (!n) return;
  cellCount = n;

  // ── Metadados por célula (para filtros, tooltip e wireframe) ──────────────
  cellNormEnergies = result.energies  ?? null;
  cellLayerIds     = result.layers    ?? null;
  cellEtaIds       = result.etas      ?? null;
  cellPhiIds       = result.phis      ?? null;
  cellArb8Verts    = result.arb8      ?? null;
  cellZPositions   = result.centers
    ? (() => {
        // Extrai coluna Z dos centros (índice 2 de cada triplet)
        const z = new Float32Array(n);
        for (let i = 0; i < n; i++) z[i] = result.centers[i * 3 + 2];
        return z;
      })()
    : null;

  // ── activeAttr: gerenciado pelo JS para filtros de detector / Z ───────────
  // O WASM inicializa todos como 1.0; o JS escreve 0.0 para ocultar.
  // É uma CÓPIA do buffer retornado, para que applyCombinedFilter() possa
  // modificar o atributo da geometria sem afetar os dados originais do WASM.
  activeAttr = new Float32Array(n).fill(1);

  // ── Fallback de energias normalizadas (caso o WASM não retorne) ───────────
  if (!cellNormEnergies) {
    cellNormEnergies = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = result.vert_colors[i * 72];       // primeiro vértice, canal R
      const b = result.vert_colors[i * 72 + 2];   // canal B
      cellNormEnergies[i] = Math.max(0, Math.min(1, (r - b * 0.5 + 0.5) * 0.8));
    }
  }

  // ── BufferGeometry — zero loops em JS ─────────────────────────────────────
  const geo = new THREE.BufferGeometry();

  // Atributos GPU — buffers prontos do WASM, passados por referência
  geo.setAttribute('position', new THREE.Float32BufferAttribute(result.positions,   3));
  geo.setAttribute('a_normal', new THREE.Float32BufferAttribute(result.normals,     3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(result.vert_colors, 3));
  geo.setAttribute('a_energy', new THREE.Float32BufferAttribute(result.vert_energ,  1));
  geo.setAttribute('a_iid',    new THREE.Float32BufferAttribute(result.iids,        1));
  geo.setAttribute('a_active', new THREE.Float32BufferAttribute(result.actives,     1));
  geo.setIndex(new THREE.BufferAttribute(result.indices, 1));

  // [OPT-3] Bounding sphere pré-calculada pelo WASM → frustum culling funcionando
  // result.bsphere = [cx, cy, cz, radius] em metros
  geo.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(result.bsphere[0], result.bsphere[1], result.bsphere[2]),
    result.bsphere[3]
  );
  // BoundingBox não é usada pelo Three.js se boundingSphere já está definida,
  // mas computamos para compatibilidade com ferramentas de inspeção.
  geo.computeBoundingBox();

  // ── ShaderMaterial ────────────────────────────────────────────────────────
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms:            shaderUniforms,
    vertexColors:        true,
    transparent:         true,
    depthWrite:          true,
    clipping:            true,
    side:                THREE.DoubleSide,
    polygonOffset:       true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits:  2,
  });

  // ── Mesh ──────────────────────────────────────────────────────────────────
  const mesh = new THREE.Mesh(geo, mat);
  // frustumCulled = true agora é seguro pois boundingSphere está definida
  mesh.frustumCulled = true;
  scene.add(mesh);
  activeMesh = mesh;

  if (wireActive) { wireActive = false; setWireframe(true); }

  // ── Resumo de blocos ───────────────────────────────────────────────────────
  const detCounts = { tile: 0, hec: 0, lar: 0 };
  if (cellLayerIds) {
    for (let i = 0; i < n; i++) {
      const key = DET_KEYS[LAYER_DET[Math.min(cellLayerIds[i], 25)]];
      detCounts[key]++;
    }
  }
  if (activeBlocksEl) {
    const parts = [];
    if (detCounts.tile) parts.push(`${detCounts.tile.toLocaleString()} TileCal`);
    if (detCounts.hec)  parts.push(`${detCounts.hec.toLocaleString()} HEC`);
    if (detCounts.lar)  parts.push(`${detCounts.lar.toLocaleString()} LAr`);
    activeBlocksEl.textContent = parts.join(' · ') || '—';
  }
}

// ──────────────────────────────────────────────────────────
//  Combined cell filter: detector + Z slice
// ──────────────────────────────────────────────────────────
function applyCombinedFilter() {
  if (!activeMesh || !cellLayerIds) return;
  const att = activeMesh.geometry.attributes.a_active;
  for (let i = 0; i < cellCount; i++) {
    const layer  = cellLayerIds[i];
    const key    = DET_KEYS[LAYER_DET[Math.min(layer, 25)]];
    const detOk  = detEnabled[key];
    const zOk    = cellZPositions ? Math.abs(cellZPositions[i]) <= currentClipZ : true;
    const val    = (detOk && zOk) ? 1 : 0;
    activeAttr[i] = val;
    const base   = i * 24;
    for (let j = 0; j < 24; j++) att.array[base + j] = val;
  }
  att.needsUpdate = true;

  if (wireActive) setTimeout(buildWireframeOverlay, 0);
}

function applyDetectorFilter() { applyCombinedFilter(); }

detChecks.forEach(cb => {
  cb.addEventListener('change', () => {
    const det = cb.dataset.det;
    if (det in detEnabled) {
      detEnabled[det] = cb.checked;
      applyDetectorFilter();
    }
  });
});

// ──────────────────────────────────────────────────────────
//  Toast
// ──────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, live = true) {
  clearTimeout(toastTimer);
  toastTextEl.textContent = msg;
  toastPip.classList.toggle('live', live);
  toastEl.classList.add('on');
}
function hideToast() { toastEl.classList.remove('on'); }

// ──────────────────────────────────────────────────────────
//  Loading bar helpers
// ──────────────────────────────────────────────────────────
function showLoading(label, pct) {
  loadingBar.classList.add('active');
  loadingLabel.textContent = label;
  loadingFill.style.width  = `${pct}%`;
}
function hideLoading() {
  loadingFill.style.width = '100%';
  setTimeout(() => {
    loadingBar.classList.remove('active');
    loadingFill.style.width = '0%';
  }, 400);
}

// ──────────────────────────────────────────────────────────
//  Energy formatting
// ──────────────────────────────────────────────────────────
function fmtE(mev) {
  const abs = Math.abs(mev);
  if (abs >= 1e6)  return `${(mev / 1e6).toFixed(2)}\u00a0TeV`;
  if (abs >= 1000) return `${(mev / 1000).toFixed(2)}\u00a0GeV`;
  if (abs >= 1)    return `${mev.toFixed(1)}\u00a0MeV`;
  return `${mev.toFixed(2)}\u00a0MeV`;
}

// ──────────────────────────────────────────────────────────
//  Energy panel
// ──────────────────────────────────────────────────────────
function setPanel(mn, mx) {
  minE = mn; maxE = mx;
  epMax.textContent = fmtE(mx);
  epMin.textContent = fmtE(mn);
  energyPanel.classList.add('on');
  if (energyRangeEl) energyRangeEl.textContent = `${fmtE(mn)}\u2013${fmtE(mx)}`;
}

// ──────────────────────────────────────────────────────────
//  Energy threshold slider
// ──────────────────────────────────────────────────────────
let frac = 0, dragging = false;

function applyThreshold(f, tipX, tipY) {
  frac = Math.max(0, Math.min(1, f));

  const h  = gradTrack.clientHeight;
  const px = frac * h;
  trackHandle.style.bottom = `${px - 1}px`;
  trackDim.style.height    = `${px}px`;

  shaderUniforms.u_threshold.value = frac;

  const pct   = Math.round(frac * 100);
  const e     = minE + frac * (maxE - minE);
  const label = frac > 0 ? `\u2265\u00a0${fmtE(e)}` : 'All cells';

  threshDisp.textContent = frac > 0 ? fmtE(e) : 'All';
  tipVal.textContent     = label;
  tipPct.textContent     = `${pct}%`;

  if (tipX != null) {
    let tx = tipX + 18, ty = tipY - 22;
    const tipW = sliderTip.offsetWidth  || 120;
    const tipH = sliderTip.offsetHeight || 52;
    if (tx + tipW > window.innerWidth  - 8) tx = tipX - tipW - 10;
    if (ty + tipH > window.innerHeight - 8) ty = window.innerHeight - tipH - 8;
    sliderTip.style.left = `${tx}px`;
    sliderTip.style.top  = `${ty}px`;
  }

  // Rebuild wireframe if active, since threshold changed
  if (wireActive && activeMesh) {
    setTimeout(buildWireframeOverlay, 0);
  }
}

function fracFromY(clientY) {
  const rect = gradTrack.getBoundingClientRect();
  return 1 - (clientY - rect.top) / rect.height;
}

trackHandle.addEventListener('mousedown', e => {
  dragging = true;
  trackHandle.classList.add('dragging');
  energyPanel.classList.add('active');
  sliderTip.classList.add('on');
  document.getElementById('energy-rail').classList.add('active');
  e.preventDefault();
});
document.addEventListener('mousemove', e => {
  if (!dragging) return;
  applyThreshold(fracFromY(e.clientY), e.clientX, e.clientY);
});
document.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  trackHandle.classList.remove('dragging');
  energyPanel.classList.remove('active');
  sliderTip.classList.remove('on');
  document.getElementById('energy-rail').classList.remove('active');
});
gradTrack.addEventListener('click', e => { applyThreshold(fracFromY(e.clientY)); });

trackHandle.addEventListener('touchstart', e => {
  dragging = true;
  trackHandle.classList.add('dragging');
  sliderTip.classList.add('on');
  document.getElementById('energy-rail').classList.add('active');
  e.preventDefault();
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (!dragging || !e.touches[0]) return;
  const t = e.touches[0];
  applyThreshold(fracFromY(t.clientY), t.clientX, t.clientY);
}, { passive: true });
document.addEventListener('touchend', () => {
  if (!dragging) return;
  dragging = false;
  trackHandle.classList.remove('dragging');
  sliderTip.classList.remove('on');
  document.getElementById('energy-rail').classList.remove('active');
});

// ──────────────────────────────────────────────────────────
//  Geometry panel collapse
// ──────────────────────────────────────────────────────────
let gpCollapsed = false;
gpToggleBtn.addEventListener('click', () => {
  gpCollapsed = !gpCollapsed;
  gpBody.classList.toggle('collapsed', gpCollapsed);
  gpToggleBtn.classList.toggle('collapsed', gpCollapsed);
});

// ──────────────────────────────────────────────────────────
//  Wiki panel
// ──────────────────────────────────────────────────────────
wikiToggleBtn?.addEventListener('click', () => {
  wikiPanel?.classList.toggle('open');
});
wikiCloseBtn?.addEventListener('click', () => {
  wikiPanel?.classList.remove('open');
});

// Wiki tabs with animated pane switch
document.querySelectorAll('.wiki-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.wiki-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.wiki-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    const pane = document.getElementById(`tab-${tab.dataset.tab}`);
    pane?.classList.add('active');
  });
});

// Knowledge tree accordion
document.querySelectorAll('.branch-header').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    btn.nextElementSibling?.classList.toggle('open', !expanded);
  });
});

// ──────────────────────────────────────────────────────────
//  ★ RAYCASTER & HOVER TOOLTIP
//  Constraints:
//  1. Disabled when Help modal is open
//  2. Disabled when Cell Data toggle is off
//  3. Ignores cells with a_active < 0.5 (hidden by filter)
//  4. Ignores cells below energy threshold
//  5. Disabled in focus/cinema mode
// ──────────────────────────────────────────────────────────
const raycaster  = new THREE.Raycaster();
const mouseNDC   = new THREE.Vector2();
let   lastRayMs  = 0;
const RAY_GAP_MS = 100;
let   hoveredId  = -1;

function isHelpModalOpen() {
  return modalOv.classList.contains('open');
}

function showTooltip(id, screenX, screenY) {
  if (id === hoveredId) { positionTooltip(screenX, screenY); return; }

  // Constraint: cell must be active (visible by filter)
  if (activeAttr && activeAttr[id] < 0.5) { clearTooltip(); return; }
  // Constraint: cell must be above energy threshold
  if (cellNormEnergies && cellNormEnergies[id] < shaderUniforms.u_threshold.value) {
    clearTooltip(); return;
  }

  hoveredId = id;
  shaderUniforms.u_highlight.value = id;

  if (cellNormEnergies && cellNormEnergies[id] != null) {
    const normE   = cellNormEnergies[id];
    const actualE = minE + normE * (maxE - minE);
    ctEnergy.textContent = fmtE(actualE);
  } else { ctEnergy.textContent = '—'; }

  if (cellLayerIds && cellLayerIds[id] != null) {
    const layer  = cellLayerIds[id];
    const detIdx = LAYER_DET[Math.min(layer, 25)];
    ctLayer.textContent = `${layer}\u00a0(${DET_NAMES[detIdx] ?? '?'})`;
  } else { ctLayer.textContent = '—'; }

  ctEta.textContent = (cellEtaIds && cellEtaIds[id] != null) ? String(cellEtaIds[id]) : '—';
  ctPhi.textContent = (cellPhiIds && cellPhiIds[id] != null) ? String(cellPhiIds[id]) : '—';

  cellTooltip.classList.add('visible');
  positionTooltip(screenX, screenY);
}

function positionTooltip(sx, sy) {
  const w = cellTooltip.offsetWidth  || 196;
  const h = cellTooltip.offsetHeight || 118;
  let tx = sx + 22, ty = sy - 12;
  if (tx + w > window.innerWidth  - 8) tx = sx - w - 12;
  if (ty + h > window.innerHeight - 8) ty = sy - h - 4;
  cellTooltip.style.left = `${tx}px`;
  cellTooltip.style.top  = `${ty}px`;
}

function clearTooltip() {
  if (hoveredId === -1) return;
  hoveredId = -1;
  shaderUniforms.u_highlight.value = -1.0;
  cellTooltip.classList.remove('visible');
}

// ──────────────────────────────────────────────────────────
//  ★ FAST CELL PICKER v4.0 — ray-sphere em Rust via WASM
//
//  [OPT-4] pick_cell_ray() exportada do WASM roda o loop O(n) em Rust,
//  eliminando overhead de GC/interpretador JS. O estado de células
//  (centros, raios, energias) é mantido em thread_local no WASM após
//  process_xml_data(), sem re-alocação a cada frame.
// ──────────────────────────────────────────────────────────
const _rayOrig = new THREE.Vector3();
const _rayDir  = new THREE.Vector3();

function pickCell(clientX, clientY) {
  if (!activeMesh || !activeAttr) return -1;

  // Monta o raio em world-space
  const ndcX =  (clientX / window.innerWidth)  * 2 - 1;
  const ndcY = -(clientY / window.innerHeight)  * 2 + 1;

  _rayOrig.setFromMatrixPosition(camera.matrixWorld);
  _rayDir.set(ndcX, ndcY, 0.5).unproject(camera).sub(_rayOrig).normalize();

  // Chama pick_cell_ray no Rust:
  //   - activeAttr: array per-célula (1=visível, 0=oculta) refletindo filtros atuais
  //   - threshold: limiar de energia do slider
  // O WASM usa os centros/raios armazenados internamente (thread_local PICK_STATE)
  return pick_cell_ray(
    _rayOrig.x, _rayOrig.y, _rayOrig.z,
    _rayDir.x,  _rayDir.y,  _rayDir.z,
    activeAttr,
    shaderUniforms.u_threshold.value,
  );
}

// Flag para evitar chamadas sobrepostas (ex.: mouse se move durante compute)
let _pickPending = false;

function onMouseMove(e) {
  if (document.body.classList.contains('focus-mode')) { clearTooltip(); return; }
  if (isHelpModalOpen())  { clearTooltip(); return; }
  if (!cellHoverEnabled)  { clearTooltip(); return; }
  if (!activeMesh || !activeMesh.visible) { clearTooltip(); return; }

  // Throttle por tempo — 100 ms é imperceptível para o usuário
  const now = performance.now();
  if (now - lastRayMs < RAY_GAP_MS) return;
  if (_pickPending) return;  // não empilha chamadas

  lastRayMs    = now;
  _pickPending = true;

  // Captura coordenadas antes do setTimeout (closure)
  const cx = e.clientX, cy = e.clientY;

  // Adia para fora do handler de evento → não bloqueia o frame atual
  setTimeout(() => {
    try {
      const id = pickCell(cx, cy);
      if (id >= 0) showTooltip(id, cx, cy);
      else         clearTooltip();
    } finally {
      _pickPending = false;
    }
  }, 0);
}

document.addEventListener('mousemove', onMouseMove, { passive: true });
renderer.domElement.addEventListener('mouseleave', clearTooltip);

// ──────────────────────────────────────────────────────────
//  XML date extraction
// ──────────────────────────────────────────────────────────
function extractXmlDate(text) {
  const m = text.match(/date=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// ──────────────────────────────────────────────────────────
//  Sample XML generator
// ──────────────────────────────────────────────────────────
function generateSampleXml() {
  const today = new Date().toISOString().slice(0, 10);
  const cells = [];
  const rnd = (min, max) => min + Math.random() * (max - min);

  // Hadronic jet in TileCal (layers 0-2)
  const jetEta = Math.floor(rnd(1, 6));
  const jetPhi = Math.floor(rnd(0, 64));
  for (let dl = 0; dl <= 2; dl++) {
    for (let de = -2; de <= 2; de++) {
      for (let dp = -3; dp <= 3; dp++) {
        const e = rnd(200, 8000) * Math.exp(-(de*de + dp*dp) / 4);
        if (e < 80) continue;
        const eta = jetEta + de, phi = (jetPhi + dp + 64) % 64;
        if (eta < 0 || eta > 9) continue;
        cells.push(`  <cell l="${dl}" eta="${eta}" phi="${phi}" e="${e.toFixed(1)}"/>`);
      }
    }
  }

  // EM shower in LAr barrel (layers 18-21)
  const emEta = Math.floor(rnd(5, 40));
  const emPhi = Math.floor(rnd(0, 64));
  for (let l = 18; l <= 21; l++) {
    const spread = l === 18 ? 4 : l === 19 ? 12 : l === 20 ? 6 : 3;
    for (let de = -spread; de <= spread; de++) {
      for (let dp = -3; dp <= 3; dp++) {
        const e = rnd(500, 15000) * Math.exp(-(de*de)/(spread*spread/2) - dp*dp/3);
        if (e < 100) continue;
        const eta = emEta + de, phi = (emPhi + dp + 64) % 64;
        const maxEta = l <= 20 ? 55 : 27;
        if (eta < 0 || eta >= maxEta) continue;
        cells.push(`  <cell l="${l}" eta="${eta}" phi="${phi}" e="${e.toFixed(1)}"/>`);
      }
    }
  }

  // Diffuse HEC activity (layers 14-17)
  for (let l = 14; l <= 17; l++) {
    for (let eta = 0; eta < 8; eta++) {
      for (let phi = 0; phi < 64; phi++) {
        if (Math.random() > 0.12) continue;
        cells.push(`  <cell l="${l}" eta="${eta}" phi="${phi}" e="${rnd(50, 2000).toFixed(1)}"/>`);
      }
    }
  }

  // Underlying event noise
  for (let l = 0; l <= 2; l++) {
    for (let eta = 0; eta < 10; eta++) {
      for (let phi = 0; phi < 64; phi++) {
        if (Math.random() > 0.05) continue;
        cells.push(`  <cell l="${l}" eta="${eta}" phi="${phi}" e="${rnd(10, 300).toFixed(1)}"/>`);
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<calorimeter run="450001" event="${Math.floor(rnd(1000, 9999))}" date="${today}" source="CGV-Web Sample">
${cells.join('\n')}
</calorimeter>`;
}

// ──────────────────────────────────────────────────────────
//  File loading
// ──────────────────────────────────────────────────────────
async function loadFile(file, xmlTextOverride = null) {
  const fname  = file?.name ?? 'sample-event.xml';
  const fnBase = fname.replace(/\.xml$/i, '');

  toast(`Reading ${fname}…`);
  showLoading('Reading file…', 15);
  dropZone.classList.add('hidden');
  ghostLbl.classList.add('gone');

  // Show filename in header pill
  if (filenameDisplay && filenameText) {
    filenameDisplay.classList.remove('hidden');
    filenameText.textContent = fname;
  }
  // Show in metadata panel (without .xml extension)
  if (metaFilename) metaFilename.textContent = fnBase;

  try {
    let bytes;
    let xmlText;
    if (xmlTextOverride) {
      xmlText = xmlTextOverride;
      bytes   = new TextEncoder().encode(xmlText);
    } else {
      xmlText = await file.text();
      bytes   = new Uint8Array(await file.arrayBuffer());
    }

    const dateStr = extractXmlDate(xmlText);
    if (xmlDateEl) xmlDateEl.textContent = dateStr ?? '—';

    showLoading('Computing geometry…', 45);
    toast('Computing geometry…');
    await new Promise(r => setTimeout(r, 30));

    showLoading('Building mesh…', 75);
    const result = process_xml_data(bytes);
    await new Promise(r => setTimeout(r, 16));

    showLoading('Uploading to GPU…', 92);
    await new Promise(r => setTimeout(r, 16));

    buildMesh(result);

    if (ghostGrp) ghostGrp.visible = false;

    const n = result.count;
    setPanel(result.minEnergy, result.maxEnergy);
    applyThreshold(0);

    cellCountEl.textContent = n.toLocaleString();

    hideLoading();
    toast(`${n.toLocaleString()} cells loaded`, false);
    toastTimer = setTimeout(hideToast, 2800);

    controls.autoRotate = false;
  } catch (err) {
    hideLoading();
    toast(`Error: ${err?.message ?? err}`, false);
    dropZone.classList.remove('hidden');
    ghostLbl.classList.remove('gone');
    filenameDisplay?.classList.add('hidden');
    if (metaFilename) metaFilename.textContent = '—';
  }
}

// ── File input / drop zone ────────────────────────────────
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer?.files[0];
  if (f) loadFile(f);
});

dzBrowseBtn?.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFile(f); });

dzSampleBtn?.addEventListener('click', e => {
  e.stopPropagation();
  const xml = generateSampleXml();
  loadFile({ name: 'sample-event.xml' }, xml);
});

// ──────────────────────────────────────────────────────────
//  ★ FOCUS MODE
//  Uses CSS opacity transition for smooth HUD fade.
//  body.focus-mode → opacity: 0 on all HUD elements (CSS handles it).
// ──────────────────────────────────────────────────
let focusActive = false;

function enterFocus() {
  focusActive = true;
  document.body.classList.add('focus-mode');
  // Fade in focus overlay (CSS transition handles opacity)
  focusOverlay.classList.add('active');
  controls.autoRotate      = true;
  controls.autoRotateSpeed = 0.65;
  clearTooltip();
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

function exitFocus() {
  focusActive = false;
  // Fade out focus overlay — CSS transition handles it
  focusOverlay.classList.remove('active');
  // Small delay before removing focus-mode so HUD fades back in gracefully
  requestAnimationFrame(() => {
    document.body.classList.remove('focus-mode');
  });
  controls.autoRotate      = !!activeMesh ? false : true;
  controls.autoRotateSpeed = 0.22;
  if (document.exitFullscreen && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

btnFocus.addEventListener('click', () => {
  if (focusActive) {
    exitFocus();
  } else {
    enterFocus();
  }
});

btnExitFocus.addEventListener('click', exitFocus);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && focusActive) exitFocus();
  if (e.key === 'Escape' && modalOv.classList.contains('open')) closeModal();
  if ((e.key === 'f' || e.key === 'F') && !focusActive && !modalOv.classList.contains('open')) enterFocus();
  if ((e.key === 'f' || e.key === 'F') && focusActive) exitFocus();
  if ((e.key === 'w' || e.key === 'W') && !modalOv.classList.contains('open')) setWireframe(!wireActive);
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && focusActive) {
    exitFocus();
  }
});

// ──────────────────────────────────────────────────────────
//  Snapshot (4K)
// ──────────────────────────────────────────────────────────
btnSnap.addEventListener('click', async () => {
  const W = 3840, H = 2160;
  const oc = document.createElement('canvas');
  oc.width = W; oc.height = H;

  const or = new THREE.WebGLRenderer({
    canvas: oc, antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  or.setPixelRatio(1);
  or.setSize(W, H, false);
  or.setClearColor(0x000811);
  or.toneMapping = renderer.toneMapping;
  or.toneMappingExposure = renderer.toneMappingExposure;
  or.localClippingEnabled = true;
  or.clippingPlanes = renderer.clippingPlanes.slice();

  const sc = camera.clone();
  sc.aspect = W / H;
  sc.updateProjectionMatrix();

  const oc2 = new EffectComposer(or);
  oc2.addPass(new RenderPass(scene, sc));
  // Use same reduced bloom for snapshot
  oc2.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.22, 0.38, 0.52));
  oc2.addPass(new OutputPass());
  oc2.render();

  const blob = await new Promise(res => oc.toBlob(res, 'image/png'));
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `cgv-${Date.now()}.png` }).click();
  URL.revokeObjectURL(url);
  or.dispose();

  btnSnap.classList.add('flash');
  setTimeout(() => btnSnap.classList.remove('flash'), 700);
});

// ──────────────────────────────────────────────────────────
//  Reset
// ──────────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  if (activeMesh) {
    scene.remove(activeMesh);
    activeMesh.geometry.dispose();
    activeMesh.material.dispose();
    activeMesh = null;
  }
  if (wireLinesObj) {
    scene.remove(wireLinesObj);
    wireLinesObj.geometry.dispose();
    wireLinesObj.material.dispose();
    wireLinesObj = null;
  }
  wireActive = false;
  modeSolidBtn?.classList.add('active');
  modeWireBtn?.classList.remove('active');

  if (ghostGrp) ghostGrp.visible = true;
  else buildGhost();

  cellNormEnergies = null; cellLayerIds = null;
  cellEtaIds = null; cellPhiIds = null; activeAttr = null;
  cellZPositions = null; currentClipZ = Infinity;
  cellCount = 0;

  energyPanel.classList.remove('on');
  cellCountEl.textContent   = '—';
  if (energyRangeEl) energyRangeEl.textContent = '—';
  if (xmlDateEl)     xmlDateEl.textContent      = '—';
  if (activeBlocksEl) activeBlocksEl.textContent = '—';
  if (metaFilename) metaFilename.textContent     = '—';
  threshDisp.textContent    = 'All';
  epMax.textContent         = '—';
  epMin.textContent         = '—';
  applyThreshold(0);
  shaderUniforms.u_threshold.value = 0;
  shaderUniforms.u_highlight.value = -1.0;
  hoveredId = -1;

  clipSlider.value         = 100;
  clipFill.style.width     = '100%';
  if (zdiBar) zdiBar.style.width = '100%';
  if (clipValDisp) clipValDisp.textContent  = 'OFF';
  renderer.clippingPlanes  = [];

  dropZone.classList.remove('hidden');
  ghostLbl.classList.remove('gone');
  filenameDisplay?.classList.add('hidden');
  fileInput.value = '';
  hideToast();
});

// ──────────────────────────────────────────────────────────
//  Help modal — smooth fade via CSS opacity transitions
// ──────────────────────────────────────────────────────────
function openModal()  {
  modalOv.classList.add('open');
  clearTooltip(); // disable hover data while modal is open
}
function closeModal() {
  modalOv.classList.remove('open');
}

btnHelp.addEventListener('click', openModal);
modalCloseBtn.addEventListener('click', closeModal);
modalOv.addEventListener('click', e => { if (e.target === modalOv) closeModal(); });

// ──────────────────────────────────────────────────────────
//  Resize
// ──────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
});

// ──────────────────────────────────────────────────────────
//  Render loop
// ──────────────────────────────────────────────────────────
const clock = new THREE.Clock();

(function loop() {
  requestAnimationFrame(loop);
  const dt = clock.getDelta();
  shaderUniforms.u_time.value += dt;
  controls.update(dt);
  composer.render();
})();