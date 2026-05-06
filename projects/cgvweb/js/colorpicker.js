import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';

// ── Background color picker (2D SV rectangle + vertical hue strip) ────────────
const DEFAULT_BG_HEX = '#020d1c';

export function setupColorPicker() {
  const btn = document.getElementById('btn-bgcolor');
  const pop = document.getElementById('bgcolor-popover');
  const sv = document.getElementById('bgcp-sv');
  const svCursor = document.getElementById('bgcp-sv-cursor');
  const hueStrip = document.getElementById('bgcp-hue-strip');
  const hueCursor = document.getElementById('bgcp-hue-cursor');
  const hexInput = document.getElementById('bgcp-hex');
  const swatch = document.getElementById('bgcp-swatch');
  const closeBtn = document.getElementById('bgcp-close');
  const resetBtn = document.getElementById('bgcp-reset');
  const presets = Array.from(document.querySelectorAll('.bgcp-preset'));
  if (!btn || !pop) return;

  // ── Color math helpers ─────────────────────────────────────────────
  function _clamp(n, a, b) {
    return n < a ? a : n > b ? b : n;
  }
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    const v = parseInt(m[1], 16);
    return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
  }
  function rgbToHex(r, g, b) {
    const h = (n) => _clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }
  function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h *= 60;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s: s * 100, v: max * 100 };
  }
  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0,
      g = 0,
      b = 0;
    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }

  // ── State ──────────────────────────────────────────────────────────
  let curH = 210,
    curS = 85,
    curV = 11; // initial ≈ #020d1c
  let open = false;

  function applyColor(hex, { save = false, syncCursors = true } = {}) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    scene.background = new THREE.Color(hex);
    swatch.style.background = hex;
    if (document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
    if (syncCursors) {
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      curH = hsv.h;
      curS = hsv.s;
      curV = hsv.v;
    }
    _paintSvBackground();
    _positionCursors();
    _markActivePreset(hex);
    if (save) localStorage.setItem('cgv-bg-color', hex);
    markDirty();
  }

  function _paintSvBackground() {
    const pure = hsvToRgb(curH, 100, 100);
    sv.style.background =
      `linear-gradient(to top, #000 0%, rgba(0,0,0,0) 100%), ` +
      `linear-gradient(to right, #fff 0%, rgba(255,255,255,0) 100%), ` +
      `rgb(${pure.r}, ${pure.g}, ${pure.b})`;
  }
  function _positionCursors() {
    svCursor.style.left = curS + '%';
    svCursor.style.top = 100 - curV + '%';
    hueCursor.style.top = (curH / 360) * 100 + '%';
  }
  function _markActivePreset(hex) {
    presets.forEach((p) =>
      p.classList.toggle('active', p.dataset.c.toLowerCase() === hex.toLowerCase()),
    );
  }
  function _updateFromHsv() {
    const rgb = hsvToRgb(curH, curS, curV);
    applyColor(rgbToHex(rgb.r, rgb.g, rgb.b), { save: true, syncCursors: false });
  }

  // ── SV rectangle drag ──────────────────────────────────────────────
  function _svFromEvent(e) {
    const r = sv.getBoundingClientRect();
    const x = _clamp(e.clientX - r.left, 0, r.width);
    const y = _clamp(e.clientY - r.top, 0, r.height);
    curS = (x / r.width) * 100;
    curV = (1 - y / r.height) * 100;
    _updateFromHsv();
  }
  let svDrag = false;
  sv.addEventListener('pointerdown', (e) => {
    svDrag = true;
    sv.setPointerCapture(e.pointerId);
    _svFromEvent(e);
  });
  sv.addEventListener('pointermove', (e) => {
    if (svDrag) _svFromEvent(e);
  });
  sv.addEventListener('pointerup', (e) => {
    svDrag = false;
    try {
      sv.releasePointerCapture(e.pointerId);
    } catch (_) {}
  });

  // ── Hue strip drag ─────────────────────────────────────────────────
  function _hueFromEvent(e) {
    const r = hueStrip.getBoundingClientRect();
    const y = _clamp(e.clientY - r.top, 0, r.height);
    curH = (y / r.height) * 360;
    _updateFromHsv();
  }
  let hueDrag = false;
  hueStrip.addEventListener('pointerdown', (e) => {
    hueDrag = true;
    hueStrip.setPointerCapture(e.pointerId);
    _hueFromEvent(e);
  });
  hueStrip.addEventListener('pointermove', (e) => {
    if (hueDrag) _hueFromEvent(e);
  });
  hueStrip.addEventListener('pointerup', (e) => {
    hueDrag = false;
    try {
      hueStrip.releasePointerCapture(e.pointerId);
    } catch (_) {}
  });

  hexInput.addEventListener('input', () => {
    let v = hexInput.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(v)) applyColor(v, { save: true, syncCursors: true });
  });

  presets.forEach((p) => {
    p.style.background = p.dataset.c;
    p.addEventListener('click', () => applyColor(p.dataset.c, { save: true, syncCursors: true }));
  });

  resetBtn.addEventListener('click', () =>
    applyColor(DEFAULT_BG_HEX, { save: true, syncCursors: true }),
  );

  // ── Popover open/close/position ────────────────────────────────────
  function position() {
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth || 260;
    const ph = pop.offsetHeight || 340;
    let left = r.left + r.width / 2 - pw / 2;
    let top = r.top - ph - 10;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    if (top < 8) top = r.bottom + 10;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }
  function openPop() {
    open = true;
    position();
    pop.classList.add('open');
    btn.classList.add('on');
    requestAnimationFrame(position);
  }
  function closePop() {
    open = false;
    pop.classList.remove('open');
    btn.classList.remove('on');
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    open ? closePop() : openPop();
  });
  closeBtn.addEventListener('click', closePop);
  document.addEventListener('click', (e) => {
    if (!open) return;
    if (pop.contains(e.target) || btn.contains(e.target)) return;
    closePop();
  });
  window.addEventListener('resize', () => {
    if (open) position();
  });

  // Expose for the Shift+B keyboard shortcut.
  window.__cgvToggleBgPicker = () => (open ? closePop() : openPop());

  // ── Initial color ──────────────────────────────────────────────────
  const saved = localStorage.getItem('cgv-bg-color');
  const initial = saved && /^#[0-9a-f]{6}$/i.test(saved) ? saved : DEFAULT_BG_HEX;
  applyColor(initial, { save: false, syncCursors: true });
}
