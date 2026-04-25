// Geometry GLB loader + WASM parser pool initialisation.
//
// Owns the wasmOk / sceneOk flags and the _readyFired latch. main.js
// registers an onReady callback (typically modeWiring.onSceneAndWasmReady)
// which fires the first time both prerequisites finish loading.

import * as THREE from 'three';
import { _wasmPool } from '../state.js';
import { initScene } from '../loader.js';
import { setLoadProgress, dismissLoadingScreen } from '../loading.js';
import { enableDefaultGhosts } from '../ghost.js';
import { esc } from '../utils.js';
import { markDirty } from '../renderer.js';
import { setStatus } from '../statusHud.js';
import { setAtlasRoot } from '../trackAtlasIntersections.js';

const atlasMat = new THREE.MeshBasicMaterial({
  color: 0x4a90d9,
  transparent: true,
  opacity: 0.07,
  depthWrite: false,
  side: THREE.DoubleSide,
});

export function setupSceneInit({ t }) {
  let wasmOk = false;
  let sceneOk = false;
  let _readyFired = false;
  let onReadyCb = null;

  function checkReady() {
    if (!wasmOk || !sceneOk) return;
    setStatus(t('status-ready'));
    if (!_readyFired) {
      _readyFired = true;
      setLoadProgress(100, 'Ready');
      enableDefaultGhosts();
      setTimeout(dismissLoadingScreen, 280);
    }
    onReadyCb?.();
  }

  initScene({
    setStatus,
    atlasMat,
    onSceneReady() {
      sceneOk = true;
      markDirty();
      checkReady();
    },
    onAtlasReady(tree) {
      setAtlasRoot(tree);
    },
  });

  _wasmPool
    .init()
    .then(() => {
      wasmOk = true;
      checkReady();
    })
    .catch((e) => {
      setStatus(`<span class="err">WASM: ${esc((e && e.message) || String(e))}</span>`);
    });

  return {
    setOnReady(cb) {
      onReadyCb = cb;
    },
    isWasmOk: () => wasmOk,
  };
}
