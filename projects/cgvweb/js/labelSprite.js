// Billboarded text sprite used by particle overlays (e±, μ±, ν, …).
//
// Renders a single text token onto a small canvas, makes a Sprite out of it,
// and installs an onBeforeRender that keeps the sprite at a constant on-screen
// pixel height regardless of zoom — capped by `worldH` so the label can also
// grow to a maximum world-mm size when the camera is far away.
//
// Sizing rule:
//   far away  → world-units height dominates (label grows on screen as you
//                approach), capped at `worldH` mm.
//   close in  → screen-pixel height dominates (label stays at `maxPx` pixels
//                so it doesn't dwarf the geometry).
// The crossover happens automatically via min(worldH, maxPx * worldUnitsPerPx).

import * as THREE from 'three';

const _tmpVec2 = new THREE.Vector2();
const DEFAULT_WORLD_H_MM = 150;
const DEFAULT_MAX_PX = 20;

export function makeLabelSprite(text, hexColor, opts = {}) {
  const worldH = opts.worldH ?? DEFAULT_WORLD_H_MM;
  const maxPx = opts.maxPx ?? DEFAULT_MAX_PX;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `#${hexColor.toString(16).padStart(6, '0')}`;
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1, 0.5, 1); // overwritten in onBeforeRender
  sprite.onBeforeRender = function (renderer, _scene, camera) {
    renderer.getSize(_tmpVec2);
    const viewportH = _tmpVec2.y || 1;
    let worldHPerPx;
    if (camera.isPerspectiveCamera) {
      const dist = Math.max(0.001, camera.position.distanceTo(this.position));
      worldHPerPx = (2 * Math.tan((camera.fov * Math.PI) / 360) * dist) / viewportH;
    } else {
      const visH = Math.max(0.001, (camera.top - camera.bottom) / (camera.zoom || 1));
      worldHPerPx = visH / viewportH;
    }
    const screenCappedH = maxPx * worldHPerPx;
    const h = Math.min(worldH, screenCappedH);
    this.scale.set(h * 2, h, 1);
  };
  return sprite;
}
