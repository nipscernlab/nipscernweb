/**
 * NIPS-CERN — CERN & ATLAS page
 * ------------------------------------------------------------------
 * The two built things on this page, both about the same machine:
 *
 * The ring. In the hero, where a stock illustration used to sit: the LHC as a
 * figure, drawn by three.js the way the About page draws the collaboration —
 * the same glow texture, the same additive blending, the same held-down blue
 * for everything that is not the point. Two trains of proton bunches run it in
 * opposite directions and all four experiments collide, because all four of
 * them do: ATLAS at Point 1, ALICE at 2, CMS at 5 and LHCb at 8, each fed by
 * the same train and each getting a different pair of bunches out of it. An
 * earlier version lit only ATLAS and CMS, which was not physics but a
 * consequence of drawing a single bunch per beam: two points launched together
 * on a circle can only meet where they started and half a lap away. The figure
 * is schematic but it is not decoration: it is the page's subject, drawn.
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

import { ensureMotionLibs, initMotion, whileVisible } from './motion.js?v=fc0407e6d5';

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

/* Chaikin's corner cutting. The ways arrive from OpenStreetMap simplified to
   sixty metres, which is the right tolerance for a file that has to be
   downloaded and the wrong one for a line that is then drawn two pixels
   thick: every bend in the border was a visible corner. Cutting each corner
   twice replaces it with a pair of points a quarter of the way in, which is
   the same curve a draughtsman gets by leaning on the spline, and costs a
   few thousand vertices once at load. The endpoints are kept, so a way still
   starts and ends where the survey says it does. */
function smooth(pts, iters) {
  let out = pts;
  for (let it = 0; it < iters && out.length > 2; it++) {
    const next = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i], b = out[i + 1];
      next.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]
      );
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
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

/* Where the experiments actually are, and which country each one is under.
   Angles around the ring measured from Point 1: the LHC has eight points,
   ATLAS at 1, ALICE at 2, CMS at 5 — dead opposite ATLAS, which is why two
   bunches launched together meet at both — and LHCb at 8, one octant the
   other side.

   Which octant is which side matters, and the first version had it backwards:
   ALICE sits at Point 2 under Saint-Genis-Pouilly, west of the Meyrin site,
   and LHCb at Point 8 under Ferney-Voltaire, east of it by the airport. In
   this figure the angle runs anticlockwise from the bottom, so ALICE is the
   negative octant and LHCb the positive one, not the other way round.

   The countries are the municipalities the four caverns are in, and they are
   checked against the drawn border rather than asserted: putting each pin's
   position through the France-Switzerland ways in data/meyrin-map.json puts
   ATLAS on the Swiss side and the other three on the French, which is what
   the ground says. ATLAS is the only one of the four in Switzerland, and it
   is the one this laboratory works on. */
/* Each pin carries a section through the machine itself, drawn at its real
   radii by tools/build-experiment-figures.js: three barrels around a
   collision and, for LHCb, the forward spectrometer standing beside one. The
   magnet is the only thing in colour in each, because the magnet is what
   makes the four of them different shapes. Figures rather than logos on
   purpose — a mark is a trademark to ask permission for, and at this size it
   says the name the pin already carries instead of saying what the machine
   is. The logos stay on disk beside them (atlas.webp and the rest), so
   swapping the file names here swaps the identity system back. */
const IPS = [
  { name: 'ATLAS', file: 'atlas-figure.svg', angle: 0, main: true, flag: 'ch' },
  { name: 'ALICE', file: 'alice-figure.svg', angle: -Math.PI / 4, flag: 'fr' },
  { name: 'CMS', file: 'cms-figure.svg', angle: Math.PI, flag: 'fr' },
  { name: 'LHCb', file: 'lhcb-figure.svg', angle: Math.PI / 4, flag: 'fr' },
];

const R = 1.18;
const LAP = 4.6;             /* seconds per lap, so a slot every 575 ms */

/* The filling scheme, scaled down to something an eye can count.
   ------------------------------------------------------------------
   The real machine puts bunches in a grid of 3,564 slots 25 ns apart and
   fills about 2,800 of them, leaving gaps for the injection kickers and a
   three microsecond hole for the beam dump. Drawn at that density the ring
   is a solid line, so this figure keeps the structure and drops the count:
   eight slots, six of them filled, one gap.

   The structure is what matters, because it is what decides which point
   lights when. A bunch of beam 1 in slot s sits at angle (turn + s); a bunch
   of beam 2 in slot s' sits at angle (s' - turn), the two running opposite
   ways. So at the tick where the ring has turned k slots, the pair meeting at
   a point q slots round is s = q - k and s' = q + k, and there is a collision
   there only if both of those slots carry a bunch. That single line is the
   whole of it: every point runs on the same clock, and yet each one gets a
   different pair, so the gaps in the train reach the four of them at
   different moments and each one falls silent on its own beat. Real filling
   schemes are quoted exactly this way, as a different number of collisions
   per experiment out of one train: 2748b_2736_2258_2374 means 2,736 crossings
   in ATLAS and CMS, 2,258 in ALICE and 2,374 in LHCb, out of the same 2,748
   bunches. This pattern gives five, five, four and six out of eight, which
   keeps what matters — the four schedules all differ, ATLAS and CMS match
   each other, ALICE gets the fewest — and cannot reproduce the exact ordering,
   because eight slots is not 3,564. The visible difference in rate between
   the experiments is not this anyway: it is the levelling further down. */
const NSLOTS = 8;
const FILLED = [1, 1, 1, 1, 0, 1, 0, 1];
const SLOT_A = (Math.PI * 2) / NSLOTS;
const BUNCH_TRAIL = 5;       /* points drawn behind each bunch */

/* A place on the ring at angle a, in the ring's own plane. Angle 0 is Point 1,
   put at the bottom of the figure, nearest the reader, and the angle grows
   anticlockwise, which is beam 2's direction: by the LHC's own convention
   beam 1 runs clockwise seen from above, and above is where this figure
   stands. That convention is the reason the points are numbered the way they
   are round this circle, and the reason LHCb's arm points where it does. */
const onRing = (a, out) => out.set(R * Math.sin(a), -R * Math.cos(a), 0);

/* Two pipes, not one.
   ------------------------------------------------------------------
   The LHC carries its two beams in two separate vacuum pipes for almost the
   whole 27 km and brings them into one common pipe only around the four
   interaction points, which is the reason collisions happen at those four
   places and nowhere else, however often the bunches pass each other in
   between. Drawing the machine as a single tube throws that away and leaves
   the reader with beams that mysteriously ignore each other everywhere but
   four spots. So the pipe here separates in the arcs and closes at the
   points, and each beam rides its own side. */
const SEP = 0.03;            /* half the gap between the two pipes, in the arcs */
const MERGE = 0.42;          /* radians either side of a point where they close */

/* How far apart the pipes are at angle a: shut at every interaction point,
   open in the arcs, with a smooth step between so the two lines glide
   together instead of hinging. */
function pipeGap(a, ipAngles) {
  let near = Math.PI;
  for (const t of ipAngles) {
    let d = Math.abs(((a - t + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d < near) near = d;
  }
  if (near >= MERGE) return SEP;
  const t = near / MERGE;
  return SEP * t * t * (3 - 2 * t);
}

const onPipe = (a, side, ipAngles, out) => {
  const r = R + side * pipeGap(a, ipAngles);
  out.set(r * Math.sin(a), -r * Math.cos(a), 0);
};

/* One collision drawn the way the event displays draw it: tracks, not
   sparks. Charged particles bend in the magnetic field and are painted
   amber; muons leave long straight red lines; neutrals go out straight and
   cyan. Each track is a polyline grown outward from the vertex over a few
   tenths of a second, which is the grammar CGVWeb and the ATLAS displays
   use. The pool of lines is reused; only their shapes are thrown again at
   each crossing. */
/* The same four colours the pins are drawn with, so the collision that fires
   at Point 1 and the section inside the ATLAS pin are one palette rather than
   two. Kept at full chroma: under additive blending anything less turns to
   pastel the moment two tracks cross. */
const TRACK_COLORS = {
  charged: [1.0, 0.76, 0.12],
  muon: [1.0, 0.23, 0.36],
  neutral: [0.13, 0.88, 1.0],
  photon: [0.24, 0.94, 0.54],
};

function makeEvent(THREE, nTracks, scale, cone) {
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
    /* One crossing, thrown from the point it happened at. */
    fire(origin) {
      for (const line of tracks) {
        const r = Math.random();
        const kind = r < 0.55 ? 'charged'
          : r < 0.73 ? 'muon'
            : r < 0.87 ? 'neutral' : 'photon';
        const c = TRACK_COLORS[kind];
        /* Not every track burns the same: a few run hot toward white, most
           sit on the palette, which is how a real display reads — energy is
           a distribution, not a constant. */
        const heat = 0.8 + Math.random() * 0.5;
        line.material.color.setRGB(
          Math.min(1, c[0] * heat + (heat > 1.15 ? 0.25 : 0)),
          Math.min(1, c[1] * heat + (heat > 1.15 ? 0.2 : 0)),
          Math.min(1, c[2] * heat + (heat > 1.15 ? 0.2 : 0))
        );
        /* A charged track is an arc: constant curvature, sign at random,
           tighter for the slow ones. Muons run long and straight, neutrals
           short and straight. A little out-of-plane drift so the spray is a
           volume, not a disc. */
        /* Isotropic for the three barrels, which surround the crossing and
           are built to catch whatever comes out of it. LHCb gets a cone
           instead: it is a spectrometer standing to one side, covering out
           to 250 mrad of the beam it looks along, so its spray leaves the
           crossing pointing one way and the empty half of the picture is
           part of the fact. */
        const phi = cone
          ? cone.at + (Math.random() * 2 - 1) * cone.half
          : Math.random() * Math.PI * 2;
        const zDrift = (Math.random() - 0.5) * 0.7;
        /* A muon is the one that reaches the far side of everything; a photon
           stops where the electromagnetic calorimeter stops it. */
        const L = scale * (kind === 'muon' ? 1.6 + Math.random() * 0.8
          : kind === 'photon' ? 0.32 + Math.random() * 0.22
            : 0.5 + Math.random() * 0.9);
        const curv = kind === 'charged'
          ? (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 2.6) / scale
          : 0;
        /* A track that runs out of the picture runs out of the picture. An
           earlier version measured the frame first and threw the track
           shorter so nothing was ever cut, and the cost of that was a lie:
           the sprays nearest an edge came out lopsided, all of them bending
           away from the boundary, and LHCb's arm had to be aimed at whatever
           side the canvas could hold rather than at the side the machine
           points. Direction is the fact here; the edge of a picture is not. */
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
      this.life += dt / 0.95;
      if (this.life >= 1) { group.visible = false; return; }
      /* The tracks race out in the first third of the life and the whole
         event holds, then dies quickly: an event display frame, not a
         firework. */
      const grow = Math.min(1, this.life / 0.32);
      const n = Math.max(2, Math.round(grow * (SEG + 1)));
      const fade = this.life < 0.72 ? 1 : 1 - (this.life - 0.72) / 0.28;
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
    THREE = await import('./vendor/three.module.min.js?v=fc0407e6d5');
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
  /* Backed off far enough that the tracks a Point 1 event throws toward the
     reader still land inside the canvas: at 3.4 the sprays out of ATLAS ran
     off the bottom edge and were guillotined by it. The box is taller in the
     stylesheet by the same proportion, so the ring itself keeps its size on
     the page and the new room is all below, where the event happens. */
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 3.9);

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
    /* The countryside dissolves into the page, but the dissolve is baked into
       the lines themselves as vertex colour rather than laid over the canvas
       as a CSS mask: a mask on the canvas faded everything on it, and the
       tracks a collision throws are not scenery. Under additive blending a
       darker vertex is a fainter line, so the falloff is written once, here,
       and touches nothing but the ground. Full strength out to just past the
       ring, gone before the countryside reaches the edge of the box. */
    /* The dissolve is measured in the frame's own terms: each vertex is
       projected through the tilt and the camera and fades as it nears the
       edge of the canvas, wherever that edge happens to lie on the ground.
       The tilt compresses the far side, so the top of the frame holds some
       sixteen kilometres of countryside where the bottom holds five — the
       projection knows that without being told, which is why the fade is
       computed and not drawn. A second, gentler falloff with plain distance
       keeps the far country quieter than the fields the ring sits in. */
    tilt.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const pv = new THREE.Vector3();
    const ease = (t) => (t <= 0 ? 1 : t >= 1 ? 0 : 1 - t * t * (3 - 2 * t));
    const fadeAt = (px, py) => {
      pv.set(px, py, 0).applyMatrix4(tilt.matrixWorld).project(camera);
      const edge = Math.max(Math.abs(pv.x), Math.abs(pv.y));
      const kFar = 1 - 0.45 * Math.min(1, Math.max(0, (Math.hypot(px, py) - 1.4) / 3));
      return ease((edge - 0.7) / 0.26) * kFar;
    };
    /* The source ways are simplified to 60 m, which leaves segments long
       enough that a vertex colour interpolated across one could still be
       half-lit where the segment crosses the frame. Long segments are cut
       into short ones first, so the fade has vertices wherever it needs to
       reach zero — before the edge, always. */
    const MAXSEG = 0.06;
    const addWays = (ways, rounds, material, dashed) => {
      material.vertexColors = true;
      for (const w0 of ways) {
        if (w0.length < 2) continue;
        const w = smooth(w0, rounds || 0);
        const pts = [];
        let lx = 0, ly = 0;
        w.forEach(([x, y], i) => {
          const px = x * S, py = y * S;
          if (!i) pts.push(px, py);
          else {
            const n = Math.max(1, Math.ceil(Math.hypot(px - lx, py - ly) / MAXSEG));
            for (let k = 1; k <= n; k++) pts.push(lx + (px - lx) * k / n, ly + (py - ly) * k / n);
          }
          lx = px; ly = py;
        });
        const count = pts.length / 2;
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const px = pts[i * 2], py = pts[i * 2 + 1];
          pos.set([px, py, -0.002], i * 3);
          const k = fadeAt(px, py);
          col.set([k, k, k], i * 3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        const line = new THREE.Line(geo, material);
        if (dashed) line.computeLineDistances();
        tilt.add(line);
      }
    };
    /* Streams as texture, rivers in a blue that means water, and the border
       the one dashed line, which is how a border is drawn on every map the
       reader knows. Additive, so where lines gather the ground glows. The
       ground is context, not subject: held well below the machine so the
       ring and the beams stay the brightest things in the figure. */
    addWays(map.streams, 2, new THREE.LineBasicMaterial({
      color: new THREE.Color(0.22, 0.36, 0.6), transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    addWays(map.rivers, 2, new THREE.LineBasicMaterial({
      color: new THREE.Color(0.28, 0.6, 1.0), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    /* The border says ATLAS is in Switzerland and CMS, ALICE and LHCb are in
       France, which is a fact about this laboratory and not decoration. It
       is still one thin dashed line, and it stays that way. It was built as
       a ribbon for a while — a quad per dash over a wide soft corridor — to
       make it impossible to miss, and impossible to miss is what it became:
       a band heavier than the machine it is supposed to lie under. A reader
       finds a border because it is dashed and because FRANCE and SUISSE are
       written either side of it, not because it shouts. */
    addWays(map.border, 3, new THREE.LineDashedMaterial({
      color: new THREE.Color(0.8, 0.83, 0.9), transparent: true, opacity: 0.9,
      dashSize: 0.045, gapSize: 0.03,
      blending: THREE.AdditiveBlending, depthWrite: false,
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
     torus lies in the XY plane, which is the ring's plane and the map's.
     Neither writes depth: the bunches run the tube's own centre line, and a
     pipe wall that lands in the depth buffer occludes the very beam it
     carries. Draw order is stated with renderOrder instead — pipe first,
     beams and events over it — which is the answer three.js gives for
     transparent things that share a position. */
  /* Held down to a wall's brightness: a near-white bunch over a near-white
     pipe is invisible, and the glow belongs to the beam and not to the
     plumbing that carries it. Each pipe is a tube swept along its own curve,
     so the pair opens through the arcs and shuts at the four points. */
  const ipAngles = IPS.map((ip) => ip.angle);
  const pipeCurve = (side) => {
    const pts = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < 320; i++) {
      onPipe((i / 320) * Math.PI * 2, side, ipAngles, p);
      pts.push(p.clone());
    }
    return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  };
  for (const side of [1, -1]) {
    const wall = new THREE.Mesh(
      new THREE.TubeGeometry(pipeCurve(side), 320, 0.009, 6, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.36, 0.5, 0.78), transparent: true, opacity: 0.62,
        depthWrite: false,
      })
    );
    wall.renderOrder = 1;
    tilt.add(wall);
  }
  /* One faint halo over both, which is the cryostat they share: the two
     pipes are 194 mm apart inside one cold mass, not two machines. */
  const pipeGlow = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.045, 8, 200),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.2, 0.36, 0.7), transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  pipeGlow.renderOrder = 1;
  tilt.add(pipeGlow);

  /* The four experiments, at their stations. ATLAS carries the brand at full
     strength; the other three are the same blue held down, exactly the wall
     of portraits' rule: colour is which one matters here. */
  const ipDots = pointsObj(THREE, IPS.length, 0.16, tex, 1);
  ipDots.renderOrder = 2;
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

  /* A train of bunches per beam rather than one dot: the slots that carry a
     bunch, each with a short tail behind it. The head burns white, brighter
     than anything on the pipe by construction since the pipe is held at half
     strength, and the tail cools to the beam blue. The gap in the train is
     drawn by simply not being there, and it is the reason the four points do
     not all light on the same beat. */
  const SLOTS = FILLED.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
  const beams = [1, -1].map((dir) => {
    const obj = pointsObj(THREE, SLOTS.length * BUNCH_TRAIL, 0.11, tex, 1);
    obj.renderOrder = 3;
    tilt.add(obj);
    return { obj, dir };
  });

  /* One station per experiment, each with the event its machine actually
     sees. Every one of the four is fed by the same train and every one of
     them collides; what differs is how much of it each is allowed to take.

     ATLAS and CMS run at the top of the luminosity, so every crossing their
     slots allow is an event, and both keep two event objects so a second
     crossing can land while the first is still flying, which is the pile-up
     those two are built to live with. LHCb is levelled about an order of
     magnitude below them, and its spray leaves in a cone because it is a
     spectrometer looking along the beam rather than a barrel around it.
     ALICE is levelled lower still, on purpose: it is built to count
     thousands of tracks in one event and drowns in pile-up, so it fires
     rarely and, when it does, throws far more tracks than anyone else. */
  const STATIONS = IPS.map((ip) => {
    const pos = new THREE.Vector3();
    onRing(ip.angle, pos);
    const spec = {
      ATLAS: { n: 30, scale: 0.52, level: 1, pool: 2 },
      CMS: { n: 24, scale: 0.44, level: 0.85, pool: 2 },
      /* The arm points where the real one points, and the chain is short.
         LHCb's z axis runs from the crossing toward the muon stations;
         beam 1 is the beam codirectional with that z; and beam 1 runs
         clockwise seen from above, which is where this figure stands. So at
         Point 8 the spray leaves along the clockwise tangent, which is the
         way round toward Point 1, and that is ip.angle + pi here because the
         angle in this figure grows the other way. The numbering agrees:
         beam 1 goes 8 to 1, and on this circle that is 45 degrees to 0. */
      LHCb: { n: 14, scale: 0.46, level: 0.34, pool: 1, cone: { at: ip.angle + Math.PI, half: 0.26 } },
      ALICE: { n: 44, scale: 0.3, level: 0.18, pool: 1 },
    }[ip.name];
    const events = [];
    for (let i = 0; i < spec.pool; i++) {
      const ev = makeEvent(THREE, spec.n, spec.scale, spec.cone);
      ev.obj.renderOrder = 3;
      tilt.add(ev.obj);
      events.push(ev);
    }
    /* Where round the ring this point sits, counted in slots. It is what the
       pairing rule is written in. */
    return { q: Math.round(ip.angle / SLOT_A), pos, level: spec.level, events, next: 0 };
  });

  /* The four experiments are named by their own marks, projected over the
     canvas as HTML so they stay crisp at any pixel ratio. Each logo is used
     whole and unaltered, inside a white disc: CERN's design guidelines forbid
     changing a mark's proportions, colours or composition, and cropping the
     wordmark off the ATLAS lockup to make it fit a circle would be exactly
     that. The disc is a container, and white is the ground all four were
     drawn for. */
  const labels = IPS.map((ip) => {
    const el = document.createElement('span');
    el.className = 'lhc-ring-badge is-' + ip.name.toLowerCase() + (ip.main ? ' is-main' : '');
    /* The classic map pin: the teardrop pointing at the interaction point,
       the mark on the white disc in its head. The pin is a container; the
       logo inside it is the experiment's own, whole and unaltered. */
    const img = document.createElement('img');
    img.src = ROOT + 'assets/images/cern/experiments/' + ip.file;
    img.alt = ip.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    el.appendChild(img);
    /* The name under the porthole. The figure says what shape the machine is
       and the word says which one it is; without it the reader is asked to
       recognise four sections by heart. ATLAS is written in the blue of its
       own rim, which is the same rule the rest of the page uses for saying
       which of the four this laboratory works on. */
    const name = document.createElement('i');
    name.className = 'lhc-ring-name';
    if (ip.flag) {
      /* The flag of the country the cavern is actually in, which is the
         answer the border is drawn to let the reader work out and this
         states outright. Same official SVGs the FRANCE and SUISSE labels
         use, so the ground and the pins agree. */
      const flag = document.createElement('img');
      flag.src = ROOT + 'assets/images/flags/' + ip.flag + '.svg';
      flag.alt = ip.flag === 'ch' ? 'Switzerland' : 'France';
      name.appendChild(flag);
    }
    name.appendChild(document.createTextNode(ip.name));
    el.appendChild(name);
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
  /* The whole train at a phase: a bunch per filled slot, each riding its own
     pipe and dragging a short tail behind it. The two trains therefore drift
     apart through the arcs and come together at the four points, which is
     where they are allowed to meet.

     The heads used to have their brightness thrown fresh every frame. It
     looked like sparkle and said nothing, so it is gone: a bunch is a steady
     thing, and the only movement in this figure is now movement something is
     actually doing. */
  function setBeam(beam, phase) {
    const pos = beam.obj.geometry.attributes.position;
    const col = beam.obj.geometry.attributes.color;
    let n = 0;
    for (const s of SLOTS) {
      const head = phase + s * SLOT_A;
      for (let i = 0; i < BUNCH_TRAIL; i++) {
        onPipe(head - beam.dir * i * 0.026, beam.dir, ipAngles, v);
        pos.setXYZ(n, v.x, v.y, v.z);
        if (!i) col.setXYZ(n, 1, 1, 1);
        else {
          const k = (1 - i / BUNCH_TRAIL) * 0.85;
          col.setXYZ(n, BEAM[0] * k, BEAM[1] * k, BEAM[2] * k);
        }
        n++;
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  let raf = 0, last = 0, angle = 0, lastTick = -1;

  /* One static frame is the reduced-motion version: the machine drawn, the
     two trains sitting in the pipe between crossings, nothing else asked of
     it. Half a slot apart so both are visible rather than one hiding inside
     the other. */
  if (REDUCED) {
    setBeam(beams[0], SLOT_A * 0.42);
    setBeam(beams[1], -SLOT_A * 0.42);
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

    /* The crossings, on one clock. Every slot the ring turns is a tick, and
       on that tick the pair arriving at a point q slots round is (q - k) from
       one beam and (q + k) from the other. Both slots carrying a bunch is a
       crossing; the levelling then decides whether that crossing is an event
       here, which is what the machine itself does by pulling the beams apart
       at ALICE and LHCb so their detectors are not buried. The beams pass
       each other all the way round the ring and only these four points ever
       light, because everywhere else the two of them are in separate pipes. */
    const tick = Math.floor(angle / SLOT_A);
    if (tick > lastTick) {
      lastTick = tick;
      for (const st of STATIONS) {
        const s1 = ((st.q - tick) % NSLOTS + NSLOTS) % NSLOTS;
        const s2 = ((st.q + tick) % NSLOTS + NSLOTS) % NSLOTS;
        if (!FILLED[s1] || !FILLED[s2]) continue;
        if (st.level < 1 && Math.random() > st.level) continue;
        st.events[st.next].fire(st.pos);
        st.next = (st.next + 1) % st.events.length;
      }
    }
    for (const st of STATIONS) for (const ev of st.events) ev.step(dt);

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
