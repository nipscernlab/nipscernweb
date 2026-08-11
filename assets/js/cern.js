/**
 * NIPS-CERN — CERN & ATLAS page
 * ------------------------------------------------------------------
 * The two built things on this page, both about the same machine:
 *
 * The ring. In the hero, where a stock illustration used to sit: the LHC as a
 * figure, drawn by three.js the way the About page draws the collaboration —
 * the same glow texture, the same additive blending, the same held-down blue
 * for everything that is not the point. Two proton bunches run the ring in
 * opposite directions and meet where they meet in the real machine: at Point 1,
 * which is ATLAS, and half a lap away at Point 5, which is CMS. ALICE and LHCb
 * sit at their real stations either side of ATLAS. The figure is schematic but
 * it is not decoration: it is the page's subject, drawn.
 *
 * The descent. The page's argument is vertical — CERN is a place you go down
 * into — so the section that says it moves that way: four photographs pinned
 * to the viewport, the reader's scroll carrying them from the Meyrin site at
 * the surface, into the tunnel, into the cavern, to the TileCal module the
 * laboratory works on, with the depth counted in the margin as it happens.
 * GSAP ScrollTrigger drives it through the same ensureMotionLibs gate the home
 * page uses, so a reader who asked for reduced motion downloads none of it and
 * reads the four photographs as a stack, which is the layout the stylesheet
 * wrote and the one every reader keeps if a single byte fails to arrive.
 */

import { ensureMotionLibs, initMotion, whileVisible } from './motion.js?v=8c4ea6da81';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* The palette of the About graph, reused deliberately: --brand at full
   strength for the thing being pointed at, the same blue held down for the
   rest. One rule across both figures. */
const BRAND = [0.36, 0.61, 0.96];
const HELD = [0.24, 0.42, 0.72];
const LINE = [0.2, 0.32, 0.55];
const BEAM = [0.62, 0.78, 1.0];

/* ------------------------------------------------------------------
   The ring
   ------------------------------------------------------------------ */

/* The soft dot, painted once — the same texture network.js paints, for the
   same reason: a texture survives drivers a shader might not. */
function dotTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.62)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function pointsObj(THREE, count, size, tex, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size,
    map: tex,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  }));
}

/* Where the experiments actually are. Angles around the ring measured from
   Point 1: the LHC has eight points, ATLAS at 1, ALICE at 2, CMS at 5 — dead
   opposite ATLAS, which is why two bunches launched together meet at both —
   and LHCb at 8, one octant the other side. */
const IPS = [
  { name: 'ATLAS', angle: 0, main: true },
  { name: 'ALICE', angle: Math.PI / 4 },
  { name: 'CMS', angle: Math.PI },
  { name: 'LHCb', angle: -Math.PI / 4 },
];

const R = 1.18;
const LAP = 5;               /* seconds per lap, so ATLAS lights every 5 s */
const TRAIL = 16;

/* A bunch's place on the ring at angle a, in the ring's own plane. Angle 0 is
   Point 1, put at the bottom of the figure, nearest the reader. */
const onRing = (a, out) => out.set(R * Math.sin(a), -R * Math.cos(a), 0);

/* One collision's worth of debris: a pool of points thrown from an
   interaction point and faded out, then thrown again at the next crossing.
   Directions are random on the sphere — a burst, not a jet — and the pool is
   reused rather than allocated per collision. */
function makeBurst(THREE, tex, n, size) {
  const obj = pointsObj(THREE, n, size, tex, 1);
  const col = obj.geometry.attributes.color;
  for (let i = 0; i < n; i++) col.setXYZ(i, BEAM[0], BEAM[1], BEAM[2]);
  col.needsUpdate = true;
  obj.visible = false;
  return {
    obj,
    vel: new Float32Array(n * 3),
    life: 1,
    fire(origin) {
      const pos = obj.geometry.attributes.position;
      for (let i = 0; i < n; i++) {
        pos.setXYZ(i, origin.x, origin.y, origin.z);
        const t = Math.random() * Math.PI * 2;
        const p = Math.acos(2 * Math.random() - 1);
        const s = 0.5 + Math.random() * 0.9;
        this.vel[i * 3] = Math.sin(p) * Math.cos(t) * s;
        this.vel[i * 3 + 1] = Math.sin(p) * Math.sin(t) * s;
        this.vel[i * 3 + 2] = Math.cos(p) * s * 0.6;
      }
      pos.needsUpdate = true;
      this.life = 0;
      obj.visible = true;
    },
    step(dt) {
      if (!obj.visible) return;
      this.life += dt / 1.1;
      if (this.life >= 1) { obj.visible = false; return; }
      const pos = obj.geometry.attributes.position;
      const damp = 1 - this.life * 0.5;
      for (let i = 0; i < n; i++) {
        pos.setXYZ(i,
          pos.getX(i) + this.vel[i * 3] * dt * damp,
          pos.getY(i) + this.vel[i * 3 + 1] * dt * damp,
          pos.getZ(i) + this.vel[i * 3 + 2] * dt * damp);
      }
      pos.needsUpdate = true;
      obj.material.opacity = 1 - this.life;
    },
  };
}

async function mountRing() {
  const host = document.getElementById('lhc-ring');
  const canvas = document.getElementById('lhc-ring-canvas');
  if (!host || !canvas) return;

  let THREE;
  try {
    THREE = await import('./vendor/three.module.min.js?v=8c4ea6da81');
  } catch (e) {
    /* No module, no figure. Removing the node collapses the hero to one
       column, which the grid already knows how to be. */
    host.remove();
    return;
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    powerPreference: 'low-power',
  });
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 3.4);

  /* The ring leans back the way the published aerial figures draw it: a
     circle read at an angle, the near side toward the reader. */
  const tilt = new THREE.Object3D();
  tilt.rotation.x = -0.95;
  scene.add(tilt);

  const tex = dotTexture(THREE);

  /* The two beam pipes, from the library's own curve: an EllipseCurve
     sampled into a LineLoop, twice, a hair apart. */
  for (const r of [R, R * 0.955]) {
    const pts = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2).getPoints(160);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    tilt.add(new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
      color: new THREE.Color(LINE[0], LINE[1], LINE[2]),
      transparent: true,
      opacity: r === R ? 0.85 : 0.45,
    })));
  }

  /* The four experiments, at their stations. ATLAS carries the brand at full
     strength; the other three are the same blue held down, exactly the wall
     of portraits' rule: colour is which one matters here. */
  const ipDots = pointsObj(THREE, IPS.length, 0.16, tex, 1);
  {
    const pos = ipDots.geometry.attributes.position;
    const col = ipDots.geometry.attributes.color;
    const v = new THREE.Vector3();
    IPS.forEach((ip, i) => {
      onRing(ip.angle, v);
      pos.setXYZ(i, v.x, v.y, v.z);
      const c = ip.main ? BRAND : HELD;
      col.setXYZ(i, c[0], c[1], c[2]);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
  tilt.add(ipDots);

  /* The bunches and their trails: the head bright, the tail dimming behind
     it, which under additive blending is a fade written as colour. */
  const beams = [1, -1].map((dir) => {
    const obj = pointsObj(THREE, TRAIL, 0.085, tex, 1);
    const col = obj.geometry.attributes.color;
    for (let i = 0; i < TRAIL; i++) {
      const k = 1 - i / TRAIL;
      col.setXYZ(i, BEAM[0] * k, BEAM[1] * k, BEAM[2] * k);
    }
    col.needsUpdate = true;
    tilt.add(obj);
    return { obj, dir };
  });

  const atlasPos = new THREE.Vector3();
  const cmsPos = new THREE.Vector3();
  onRing(0, atlasPos);
  onRing(Math.PI, cmsPos);

  const burstAtlas = makeBurst(THREE, tex, 30, 0.06);
  const burstCms = makeBurst(THREE, tex, 12, 0.038);
  tilt.add(burstAtlas.obj, burstCms.obj);

  /* The labels are HTML, projected — the same trick the graph's tooltip
     uses — so the type is the page's own mono and not something rastered
     into a texture. */
  const labels = IPS.map((ip) => {
    const el = document.createElement('span');
    el.className = 'lhc-ring-label' + (ip.main ? ' is-main' : '');
    el.textContent = ip.name;
    host.appendChild(el);
    const world = new THREE.Vector3();
    onRing(ip.angle, world);
    return { el, world };
  });

  const proj = new THREE.Vector3();
  function placeLabels(w, h) {
    for (const l of labels) {
      proj.copy(l.world).applyMatrix4(tilt.matrixWorld).project(camera);
      l.el.style.transform = 'translate(-50%, -130%) translate('
        + ((proj.x * 0.5 + 0.5) * w).toFixed(1) + 'px,'
        + ((-proj.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
    }
  }

  let w = 0, h = 0;
  function resize() {
    const r = host.getBoundingClientRect();
    if (!r.width) return;
    w = r.width; h = r.height;
    const dpr = Math.min(2, devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  const v = new THREE.Vector3();
  function setBeam(beam, head) {
    const pos = beam.obj.geometry.attributes.position;
    for (let i = 0; i < TRAIL; i++) {
      onRing(head - beam.dir * i * 0.045, v);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }

  /* One static frame is the reduced-motion version: the machine drawn, the
     bunches parked at their interaction points, nothing else asked of it. */
  if (REDUCED) {
    setBeam(beams[0], 0);
    setBeam(beams[1], Math.PI);
    tilt.updateMatrixWorld(true);
    renderer.render(scene, camera);
    placeLabels(w, h);
    return;
  }

  let raf = 0, last = 0, angle = 0, lastLap = 0, lastHalf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    angle += (Math.PI * 2 / LAP) * dt;

    setBeam(beams[0], angle);
    setBeam(beams[1], -angle);

    /* The crossings. Both bunches left Point 1 together, so they are back
       there together once a lap, and at Point 5 half a lap later — the
       geometry of the real machine, not a scheduled effect. */
    const lap = Math.floor(angle / (Math.PI * 2));
    if (lap > lastLap) { lastLap = lap; burstAtlas.fire(atlasPos); }
    const half = Math.floor((angle + Math.PI) / (Math.PI * 2));
    if (half > lastHalf) { lastHalf = half; burstCms.fire(cmsPos); }
    burstAtlas.step(dt);
    burstCms.step(dt);

    tilt.updateMatrixWorld(true);
    renderer.render(scene, camera);
    placeLabels(w, h);
  }

  whileVisible(host,
    () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    () => { cancelAnimationFrame(raf); raf = 0; });
}

/* ------------------------------------------------------------------
   The descent
   ------------------------------------------------------------------ */
async function mountDescent() {
  const stage = document.getElementById('descent');
  if (!stage || REDUCED) return;

  const ok = await ensureMotionLibs();
  if (!ok || !initMotion()) return;
  const gsap = window.gsap;

  /* The stylesheet lays the four scenes out as a plain stack, and that stack
     is the page until this line runs: the pinned, overlaid version exists
     only on top of a working ScrollTrigger, per the rule in motion.js that
     animation never decides whether content is visible. */
  stage.classList.add('is-live');

  const scenes = Array.from(stage.querySelectorAll('.descent-scene'));
  const depthEl = document.getElementById('descent-depth');
  if (scenes.length < 2) return;

  gsap.set(scenes.slice(1), { autoAlpha: 0 });
  gsap.set(scenes.slice(1).map((s) => s.querySelector('img')), { scale: 1.12 });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: stage,
      start: 'top top',
      end: '+=' + (scenes.length - 1) * 90 + '%',
      scrub: 0.6,
      pin: true,
      anticipatePin: 1,
    },
  });

  scenes.forEach((scene, i) => {
    if (!i) return;
    const prev = scenes[i - 1];
    tl.to(prev.querySelector('img'), { scale: 1.1, duration: 0.55, ease: 'none' }, i)
      .to(prev, { autoAlpha: 0, duration: 0.45, ease: 'none' }, i + 0.1)
      .to(scene, { autoAlpha: 1, duration: 0.45, ease: 'none' }, i + 0.08)
      .to(scene.querySelector('img'), { scale: 1, duration: 0.6, ease: 'none' }, i);
  });

  /* The depth, counted as it is travelled. 100 m is ATLAS's own number for
     Point 1, and it is reached with the tunnel — the two scenes after it are
     at the same depth, looking closer, so the meter arrives and holds. */
  if (depthEl) {
    const depth = { m: 0 };
    tl.to(depth, {
      m: 100,
      duration: 1,
      ease: 'none',
      onUpdate: () => { depthEl.textContent = '−' + Math.round(depth.m); },
    }, 1);
  }
}

/* ------------------------------------------------------------------ */
addEventListener('DOMContentLoaded', () => {
  mountRing();
  mountDescent();
});
