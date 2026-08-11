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

import { ensureMotionLibs, initMotion, whileVisible } from './motion.js?v=63799f47d6';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROOT = new URL('../../', import.meta.url).href;
const STAMP = import.meta.url.split('?')[1] || '';
const json = (path) => fetch(ROOT + path).then((r) => (r.ok ? r.json() : null)).catch(() => null);

/* One more plugin than motion.js loads, and only on this page. It is fetched
   after gsap is already on window, because a plugin registers itself against
   the core and an async pair settles in whichever order the network returns.
   If it never lands, the curve appears instead of drawing itself, which is a
   difference in ceremony and not in content. */
function loadDrawSVG() {
  if (window.DrawSVGPlugin) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = ROOT + 'assets/js/vendor/DrawSVGPlugin.min.js' + (STAMP ? '?' + STAMP : '');
    s.async = false;
    s.onload = () => resolve(!!window.DrawSVGPlugin);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

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
  { name: 'ATLAS', file: 'atlas.webp', angle: 0, main: true },
  { name: 'ALICE', file: 'alice.webp', angle: Math.PI / 4 },
  { name: 'CMS', file: 'cms.webp', angle: Math.PI },
  { name: 'LHCb', file: 'lhcb.webp', angle: -Math.PI / 4 },
];

const R = 1.18;
const LAP = 3;               /* seconds per lap, so ATLAS lights every 3 s */
const TRAIL = 22;

/* A bunch's place on the ring at angle a, in the ring's own plane. Angle 0 is
   Point 1, put at the bottom of the figure, nearest the reader. */
const onRing = (a, out) => out.set(R * Math.sin(a), -R * Math.cos(a), 0);

/* One collision drawn the way the event displays draw it: tracks, not
   sparks. Charged particles bend in the magnetic field and are painted
   amber; muons leave long straight red lines; neutrals go out straight and
   cyan. Each track is a polyline grown outward from the vertex over a few
   tenths of a second, which is the grammar CGVWeb and the ATLAS displays
   use. The pool of lines is reused; only their shapes are thrown again at
   each crossing. */
const TRACK_COLORS = {
  charged: [1.0, 0.72, 0.25],
  muon: [0.95, 0.3, 0.32],
  neutral: [0.45, 0.85, 1.0],
};

function makeEvent(THREE, nTracks, scale) {
  const SEG = 24;
  const group = new THREE.Group();
  group.visible = false;
  const tracks = [];
  for (let i = 0; i < nTracks; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    group.add(line);
    tracks.push(line);
  }
  return {
    obj: group,
    life: 1,
    fire(origin) {
      for (const line of tracks) {
        const r = Math.random();
        const kind = r < 0.62 ? 'charged' : (r < 0.82 ? 'muon' : 'neutral');
        const c = TRACK_COLORS[kind];
        line.material.color.setRGB(c[0], c[1], c[2]);
        /* A charged track is an arc: constant curvature, sign at random,
           tighter for the slow ones. Muons run long and straight, neutrals
           short and straight. A little out-of-plane drift so the spray is a
           volume, not a disc. */
        const phi = Math.random() * Math.PI * 2;
        const zDrift = (Math.random() - 0.5) * 0.7;
        const L = scale * (kind === 'muon' ? 1.6 + Math.random() * 0.8 : 0.5 + Math.random() * 0.9);
        const curv = kind === 'charged'
          ? (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 2.6) / scale
          : 0;
        const pos = line.geometry.attributes.position;
        const step = L / SEG;
        let a = phi, x = origin.x, y = origin.y, z = origin.z;
        for (let s = 0; s <= SEG; s++) {
          pos.setXYZ(s, x, y, z);
          x += Math.cos(a) * step;
          y += Math.sin(a) * step;
          z += zDrift * step * 0.4;
          a += curv * step;
        }
        pos.needsUpdate = true;
        line.geometry.setDrawRange(0, 1);
      }
      this.life = 0;
      group.visible = true;
    },
    step(dt) {
      if (!group.visible) return;
      this.life += dt / 1.05;
      if (this.life >= 1) { group.visible = false; return; }
      /* The tracks race out in the first third of the life and the whole
         event holds, then dies quickly: an event display frame, not a
         firework. */
      const grow = Math.min(1, this.life / 0.32);
      const n = Math.max(2, Math.round(grow * (SEG + 1)));
      const fade = this.life < 0.6 ? 1 : 1 - (this.life - 0.6) / 0.4;
      for (const line of tracks) {
        line.geometry.setDrawRange(0, n);
        line.material.opacity = fade;
      }
    },
  };
}

async function mountRing() {
  const host = document.getElementById('lhc-ring');
  const canvas = document.getElementById('lhc-ring-canvas');
  if (!host || !canvas) return;

  let THREE;
  try {
    THREE = await import('./vendor/three.module.min.js?v=63799f47d6');
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

  /* The ground over the machine, and it is the real ground: the
     France–Switzerland border and the watercourses of the Meyrin countryside,
     fetched from OpenStreetMap by tools/build-meyrin-map.js and committed as
     data. The ring sits at the LHC's true centre and radius within it, so the
     border crosses the circle where it crosses it on any published map. All
     of it lies in the ring's own tilted plane: this is the surface the
     accelerator is under, not a backdrop behind it. */
  json('data/meyrin-map.json').then((map) => {
    if (!map || !map.border) return;
    const S = R / map.ring_r_m;
    const addWays = (ways, material, dashed) => {
      for (const w of ways) {
        if (w.length < 2) continue;
        const pts = w.map(([x, y]) => new THREE.Vector3(x * S, y * S, -0.002));
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, material);
        if (dashed) line.computeLineDistances();
        tilt.add(line);
      }
    };
    /* Streams as texture, rivers in a blue that means water, and the border
       the one dashed line, which is how a border is drawn on every map the
       reader knows. Additive, so where lines gather the ground glows. */
    addWays(map.streams, new THREE.LineBasicMaterial({
      color: new THREE.Color(0.22, 0.36, 0.6), transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    addWays(map.rivers, new THREE.LineBasicMaterial({
      color: new THREE.Color(0.28, 0.6, 1.0), transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    addWays(map.border, new THREE.LineDashedMaterial({
      color: new THREE.Color(0.72, 0.75, 0.82), transparent: true, opacity: 0.75,
      dashSize: 0.045, gapSize: 0.03,
    }), true);

    /* Which side is which, written on the ground with the flags. Positions
       in metres from the ring centre: outside the circle, clear of the pipe
       and the badges. The flags are the official SVGs, files of their own in
       assets/images/flags. */
    for (const c of [
      { name: 'FRANCE', flag: 'fr.svg', x: -4700, y: 4900 },
      { name: 'SUISSE', flag: 'ch.svg', x: 2600, y: -4600 },
    ]) {
      const el = document.createElement('span');
      el.className = 'lhc-ring-country';
      const flag = document.createElement('img');
      flag.src = ROOT + 'assets/images/flags/' + c.flag;
      flag.alt = '';
      const name = document.createElement('i');
      name.textContent = c.name;
      el.append(flag, name);
      host.appendChild(el);
      const world = new THREE.Vector3(c.x * S, c.y * S, 0);
      labels.push({ el, world });
    }

    /* The map lands after the first paint. If the loop is running it will be
       in the next frame; under reduced motion, or while the loop is held
       off screen, one explicit frame puts the ground under the machine. */
    tilt.updateMatrixWorld(true);
    if (!raf) { renderer.render(scene, camera); placeLabels(w, h); }
  });

  /* The pipe is a pipe: a torus with real thickness from the library's own
     geometry, and a fatter, fainter twin behind it carrying the glow. The
     torus lies in the XY plane, which is the ring's plane and the map's. */
  tilt.add(new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.013, 10, 220),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.42, 0.58, 0.88), transparent: true, opacity: 0.95,
    })
  ));
  tilt.add(new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.04, 10, 220),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.22, 0.4, 0.75), transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  ));

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

  /* The collision at Point 1 is the event the page is about, so it is the one
     that is allowed to be violent: many more tracks, thrown harder and drawn
     larger than the crossing on the far side of the ring. */
  const burstAtlas = makeEvent(THREE, 30, 0.52);
  const burstCms = makeEvent(THREE, 12, 0.3);
  tilt.add(burstAtlas.obj, burstCms.obj);

  /* The four experiments are named by their own marks, projected over the
     canvas as HTML so they stay crisp at any pixel ratio. Each logo is used
     whole and unaltered, inside a white disc: CERN's design guidelines forbid
     changing a mark's proportions, colours or composition, and cropping the
     wordmark off the ATLAS lockup to make it fit a circle would be exactly
     that. The disc is a container, and white is the ground all four were
     drawn for. */
  const labels = IPS.map((ip) => {
    const el = document.createElement('span');
    el.className = 'lhc-ring-badge' + (ip.main ? ' is-main' : '');
    /* The classic map pin: the teardrop pointing at the interaction point,
       the mark on the white disc in its head. The pin is a container; the
       logo inside it is the experiment's own, whole and unaltered. */
    const img = document.createElement('img');
    img.src = ROOT + 'assets/images/cern/experiments/' + ip.file;
    img.alt = ip.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    el.appendChild(img);
    host.appendChild(el);
    const world = new THREE.Vector3();
    onRing(ip.angle, world);
    return { el, world };
  });

  const proj = new THREE.Vector3();
  function placeLabels(w, h) {
    for (const l of labels) {
      proj.copy(l.world).applyMatrix4(tilt.matrixWorld).project(camera);
      l.el.style.transform = 'translate(-50%, -50%) translate('
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

  let raf = 0, last = 0, angle = 0, lastLap = 0, lastHalf = 0;

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

  /* The depth, counted as it is travelled. The first two scenes are at the
     surface, the tunnel is 100 m down — ATLAS's own number for Point 1 — and
     the last scene comes back up to the people. So the meter falls on the way
     into the tunnel and climbs on the way out. */
  if (depthEl) {
    const depth = { m: 0 };
    /* "−0 m" is a reading no instrument would print. */
    const write = () => {
      const m = Math.round(depth.m);
      depthEl.textContent = m ? '−' + m : '0';
    };
    /* Both tweens end before the last scene's own tween does, or the reading
       is still travelling when the scroll runs out and the meter is left
       showing a depth nobody is at. */
    tl.to(depth, { m: 100, duration: 0.5, ease: 'none', onUpdate: write }, 2)
      .to(depth, { m: 0, duration: 0.5, ease: 'none', onUpdate: write }, 3);
  }
}

/* ------------------------------------------------------------------
   The pulse
   ------------------------------------------------------------------
   What the laboratory actually works on, drawn from the numbers rather than
   described in a paragraph. A TileCal cell answers a particle with a shaped
   pulse 150 ns wide; the electronics sees seven samples of it, 25 ns apart;
   and when the next bunch crossing lands inside the same window the samples
   are no longer the pulse. Recovering the amplitude from those seven deformed
   numbers, in an FPGA, within the trigger's latency, is the research line the
   section above lists twenty years of papers on.

   The shape is read from data/tilecal-pulse.json, built by
   tools/build-tilecal-pulse.js out of the ATLAS Collaboration's published
   reference pulse. The figure is drawn complete and readable the moment the
   data lands: GSAP only decides the order in which its parts arrive. If the
   library never arrives, or the reader asked for less motion, the whole
   figure is simply there.
   ------------------------------------------------------------------ */
const SVG_NS = 'http://www.w3.org/2000/svg';

const el = (name, attrs, parent) => {
  const n = document.createElementNS(SVG_NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};

async function mountPulse() {
  const host = document.getElementById('pulse-figure');
  const steps = Array.from(document.querySelectorAll('.pulse-step'));
  if (!host) return;

  const d = await json('data/tilecal-pulse.json');
  if (!d || !d.curve) { host.remove(); return; }

  /* The out-of-time signal on its own is the difference between what the
     channel gives with it and without it. One source of truth for both. */
  const oot = d.sum.map((v, i) => Number((v - d.curve[i]).toFixed(5)));

  const W = 760, H = 360;
  const L = 46, R = 16, T = 20, B = 40;
  const PW = W - L - R, PH = H - T - B;
  const VMAX = Math.max(...d.sum) * 1.12;

  const X = (t) => L + ((t - d.t0) / (d.t1 - d.t0)) * PW;
  const Y = (v) => T + (1 - v / VMAX) * PH;
  const pathOf = (arr) => arr
    .map((v, i) => (i ? 'L' : 'M') + X(d.t0 + i * d.step).toFixed(1) + ' ' + Y(v).toFixed(1))
    .join(' ');

  const svg = el('svg', {
    viewBox: '0 0 ' + W + ' ' + H,
    class: 'pulse-svg',
    role: 'img',
    'aria-label': 'The TileCal shaped pulse, its seven samples 25 ns apart, and the same window with an out-of-time signal from the next bunch crossing added.',
  }, host);

  /* The frame: baseline, the readout window, and the axis in nanoseconds. */
  el('line', { class: 'pl-axis', x1: L, y1: Y(0), x2: L + PW, y2: Y(0) }, svg);
  el('line', { class: 'pl-axis', x1: L, y1: T, x2: L, y2: Y(0) }, svg);

  for (const t of [-100, -50, 0, 50, 100, 150]) {
    el('line', { class: 'pl-tick', x1: X(t), y1: Y(0), x2: X(t), y2: Y(0) + 5 }, svg);
    const label = el('text', { class: 'pl-num', x: X(t), y: Y(0) + 19, 'text-anchor': 'middle' }, svg);
    label.textContent = t;
  }
  const unit = el('text', { class: 'pl-num', x: L + PW, y: Y(0) + 34, 'text-anchor': 'end' }, svg);
  unit.textContent = 'ns';

  for (const v of [0.5, 1]) {
    el('line', { class: 'pl-grid', x1: L, y1: Y(v), x2: L + PW, y2: Y(v) }, svg);
    const label = el('text', { class: 'pl-num', x: L - 8, y: Y(v) + 3, 'text-anchor': 'end' }, svg);
    label.textContent = v === 1 ? 'A' : v;
  }

  /* The three curves. The reference pulse is the signal of interest, the
     faint one is the crossing that follows it, and the white one is their
     sum, which is the only thing the digitiser ever sees. */
  const sum = el('path', { class: 'pl-sum', d: pathOf(d.sum) }, svg);
  const ootPath = el('path', { class: 'pl-oot', d: pathOf(oot) }, svg);
  const ref = el('path', { class: 'pl-ref', d: pathOf(d.curve) }, svg);

  /* The recovered amplitude: what the filter gets back out of the deformed
     samples, which is the height of the pulse that was there all along. */
  const amp = el('g', { class: 'pl-amp' }, svg);
  el('line', { x1: L, y1: Y(1), x2: X(0), y2: Y(1) }, amp);
  el('circle', { cx: X(0), cy: Y(1), r: 4 }, amp);
  const ampText = el('text', { x: X(0) + 10, y: Y(1) - 8 }, amp);
  ampText.textContent = 'Â = Σ wᵢyᵢ';

  /* The seven samples, drawn as the stems the electronics actually reads. */
  const marks = d.sampleT.map((t, i) => {
    const g = el('g', { class: 'pl-sample' }, svg);
    const stem = el('line', { x1: X(t), y1: Y(0), x2: X(t), y2: Y(d.piled[i]) }, g);
    const dot = el('circle', { cx: X(t), cy: Y(d.piled[i]), r: 4.5 }, g);
    return { g, stem, dot, t };
  });

  const win = el('text', { class: 'pl-note', x: X(-75), y: T + 12 }, svg);
  win.textContent = '7 × 25 ns';

  /* Everything above is the finished figure. What follows only decides the
     order it arrives in, and it runs at all only when the library is here. */
  const ok = await ensureMotionLibs();
  if (!ok || !initMotion() || !steps.length) return;
  const gsap = window.gsap;
  if (await loadDrawSVG()) gsap.registerPlugin(window.DrawSVGPlugin);

  const hidden = { autoAlpha: 0 };
  gsap.set([sum, ootPath, amp], hidden);
  gsap.set(marks.map((m) => m.g), hidden);
  if (window.DrawSVGPlugin) gsap.set(ref, { drawSVG: '0%' });

  let at = -1;
  const to = (target, vars) => gsap.to(target, { duration: 0.5, ease: 'power2.out', ...vars });

  function go(step) {
    if (step === at) return;
    at = step;
    /* Each state is written in full rather than as a diff, so scrolling back
       up lands on exactly the same figure as scrolling down. */
    if (window.DrawSVGPlugin) to(ref, { drawSVG: step >= 0 ? '100%' : '0%', duration: 0.9 });
    to(ref, { autoAlpha: 1 });
    marks.forEach((m, i) => {
      to(m.g, { autoAlpha: step >= 1 ? 1 : 0, delay: step >= 1 ? i * 0.05 : 0 });
      const v = step >= 2 ? d.piled[i] : d.clean[i];
      to(m.stem, { attr: { y2: Y(v) } });
      to(m.dot, { attr: { cy: Y(v) } });
    });
    to(ootPath, { autoAlpha: step >= 2 ? 1 : 0 });
    to(sum, { autoAlpha: step >= 2 ? 1 : 0 });
    to(amp, { autoAlpha: step >= 3 ? 1 : 0 });
  }

  go(0);
  steps.forEach((stepEl, i) => {
    window.ScrollTrigger.create({
      trigger: stepEl,
      /* The two edges meet at the same line, so consecutive steps tile the
         scroll with no gap: one step is always the active one. With the end
         higher than the start there were positions between two steps where
         neither was on and the figure sat in whatever state it was left in. */
      start: 'top 60%',
      end: 'bottom 60%',
      onEnter: () => { stepEl.classList.add('is-on'); go(i); },
      onEnterBack: () => { stepEl.classList.add('is-on'); go(i); },
      onLeave: () => stepEl.classList.remove('is-on'),
      onLeaveBack: () => stepEl.classList.remove('is-on'),
    });
  });
}

/* ------------------------------------------------------------------ */
addEventListener('DOMContentLoaded', () => {
  mountRing();
  mountDescent();
  mountPulse();
});
