import * as THREE        from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Dirty flag ────────────────────────────────────────────────────────────────
// Demand-driven rendering: only render when something changed. Modules call
// markDirty() to request a frame; the render loop calls isDirty()/clearDirty().
let _dirty = true;
export const markDirty  = ()  => { _dirty = true;  };
export const isDirty    = ()  => _dirty;
export const clearDirty = ()  => { _dirty = false; };

// ── Renderer ──────────────────────────────────────────────────────────────────
// Default: WebGLRenderer. Opt-in WebGPU path via `?renderer=webgpu`.
// Falls back silently to WebGL if WebGPU is unavailable.
export const canvas = document.getElementById('c');
const _rendererQuery = new URLSearchParams(location.search).get('renderer');
const _wantWebGPU = _rendererQuery === 'webgpu' && typeof navigator !== 'undefined' && 'gpu' in navigator;

let _renderer = null;
if (_wantWebGPU) {
  try {
    const mod = await import('three/addons/renderers/webgpu/WebGPURenderer.js');
    const WebGPURenderer = mod.default || mod.WebGPURenderer;
    if (WebGPURenderer) {
      _renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      await _renderer.init();
      console.info('[renderer] WebGPU active');
    }
  } catch (e) {
    console.warn('[renderer] WebGPU unavailable, falling back to WebGL:', e && e.message ? e.message : e);
  }
}
if (!_renderer) {
  _renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    precision: 'mediump', preserveDrawingBuffer: true, stencil: false, depth: true,
  });
}
export const renderer = _renderer;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
if (renderer.isWebGLRenderer) {
  renderer.sortObjects = false;
  renderer.info.autoReset = false;
}

// ── Scene / Camera ────────────────────────────────────────────────────────────
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020d1c);
scene.matrixAutoUpdate = false;

export const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 10, 100_000);
camera.position.set(0, 0, 12_000);

// ── Controls ──────────────────────────────────────────────────────────────────
export const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.14;
controls.zoomSpeed     = 1.2;

// ── Lighting ──────────────────────────────────────────────────────────────────
export const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
scene.add(ambientLight);

// Directional light tracks the camera so cells are always front-lit.
export const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.copy(camera.position);
scene.add(dirLight);
controls.addEventListener('change', () => { dirLight.position.copy(camera.position); });
