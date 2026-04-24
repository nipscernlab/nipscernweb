import {
  renderer, scene, camera, controls, dirLight,
  markDirty, isDirty, clearDirty,
} from './renderer.js';

// ── FPS counter ──────────────────────────────────────────────────────────────
const fpsEl = document.createElement('div');
Object.assign(fpsEl.style, {
  position: 'fixed', bottom: '8px', right: '10px', zIndex: '9999',
  fontFamily: 'monospace', fontSize: '13px', color: '#66ccff',
  opacity: '0.45', pointerEvents: 'none', userSelect: 'none',
});
document.body.appendChild(fpsEl);

// ── Render loop ───────────────────────────────────────────────────────────────
// Paused while the tab is hidden: browsers already throttle RAF on hidden tabs,
// but stopping the loop entirely frees the main thread for other tabs. Resumed
// on visibilitychange.
let _fpsFrames = 0, _fpsLast = performance.now();
let _loopRunning = false;
let _loopRafId = 0;
let _resumeWarmFrames = 0;
let _onFrameStart = () => {};

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
  _onFrameStart();
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

export function initRenderLoop({ onFrameStart } = {}) {
  if (onFrameStart) _onFrameStart = onFrameStart;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) _stopLoop();
    else {
      _restoreRendererAfterFocus();
      _startLoop();
    }
  });
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

  _startLoop();
}
