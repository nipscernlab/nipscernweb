/**
 * The collaboration, drawn.
 * ------------------------------------------------------------------
 * One hundred and twenty people who have signed a paper with this laboratory,
 * and the six hundred and nineteen pairs of them who signed the same one. The
 * positions are not arranged: they fall out of a force layout run over the real
 * coauthorship of all 147 works in data/publications.json, and the reason the
 * coordinator sits dead in the middle is that he is on 115 of them.
 *
 * The layout is computed at build time by tools/build-network.js and shipped as
 * 16 KB of finished coordinates, for two reasons. A simulation in the browser
 * would put a few million floating-point operations on the main thread of a
 * page that is otherwise cheap; and it would draw a slightly different figure
 * on every visit, which is fine for a starfield and wrong for a measurement.
 * The sky over the home page is random on purpose. This one is not: it is the
 * same figure for every reader, the way a plot in a paper is the same in every
 * copy of the journal.
 *
 * ------------------------------------------------------------------
 * What this costs, stated plainly
 * ------------------------------------------------------------------
 * three.js is 188 KB over the wire, which is four times GSAP and more than the
 * whole of the rest of this page. It is fetched by a dynamic import that only
 * runs when the stage is about to be looked at, so nobody who does not reach
 * this section pays for it, and the page below it is unaffected either way: the
 * stage carries its own figures on a glass plate, and if the import never
 * resolves the plate is what is left, which still says the true thing.
 *
 * ------------------------------------------------------------------
 * Reduced motion
 * ------------------------------------------------------------------
 * The graph is information, so it is still drawn: one frame, no rotation, no
 * parallax. What a reader who asked for less motion loses is the movement, not
 * the content. Pointing at a node still names it, because that is a thing they
 * asked for at the moment they did it.
 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const DATA = new URL('../../data/collab-network.json', import.meta.url).href;

/* One blue, two states: the laboratory's own --brand at full strength for the
   people who work here, held down for everybody else they have written with.
   Colour is state on this site, and the state carried here is "ours" against
   "theirs" — the same rule the language flags follow, full colour for the one
   in use. It was violet against blue before, but the violet was the About
   accent, and that accent is now the brand itself. */
const MEMBER = [0.36, 0.61, 0.96];   // #5b9cf6, --brand
const OTHER  = [0.24, 0.42, 0.72];   // the same blue, held down
const LINE   = [0.16, 0.26, 0.46];
const LINK_MEMBER = [0.27, 0.44, 0.75];

/* A round dot with a soft edge, painted once into a 64px canvas. A texture
   rather than a shader because a shader I cannot see running on a driver I do
   not have is the sort of thing that renders a blank rectangle on somebody
   else's laptop. */
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

function points(THREE, coords, colours, size, tex, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
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

export async function initNetwork(canvas, opts = {}) {
  if (!canvas) return null;
  const stage = canvas.parentElement;

  /* The data first, and normally it is already here: about.js reads the same
     file to put each person's paper count on their record, so it hands the
     parsed object over rather than have two modules fetch one file. The fetch
     below is for anything that mounts this on its own. If neither works there
     is nothing to draw, and 188 KB of three.js for an empty scene is the one
     outcome worth checking for first. */
  let net = opts.data;
  if (!net) {
    try {
      const res = await fetch(DATA);
      if (!res.ok) throw new Error(res.status);
      net = await res.json();
    } catch (e) {
      return null;
    }
  }
  if (!net.nodes || !net.nodes.length) return null;

  /* No WebGL, no canvas. The plate over it carries the figures and stays. */
  let THREE;
  try {
    THREE = await import('./vendor/three.module.min.js?v=7a8294c79a');
  } catch (e) {
    return null;
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    /* Additive blending onto a transparent canvas is the one combination that
       reliably comes out wrong when the context is premultiplied: the glow
       accumulates into the alpha channel as well as the colour, and the bright
       middle of the graph ends up punching a lighter hole through to the page.
       Unpremultiplied, additive means what it says. */
    premultipliedAlpha: false,
    powerPreference: 'low-power',
  });
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 3.2);

  /* Two nested frames rather than one. The tilt is fixed and the spin is
     animated, and keeping them apart means the rotation is one number going up
     for ever instead of a pair of angles that have to be recomposed. */
  const tilt = new THREE.Object3D();
  tilt.rotation.x = 0.22;
  tilt.rotation.z = -0.06;
  scene.add(tilt);
  const spin = new THREE.Object3D();
  tilt.add(spin);

  /* ---- the nodes ---- */
  const nodes = net.nodes;
  const tex = dotTexture(THREE);
  const mine = [], mineC = [], theirs = [], theirsC = [];
  const lookup = [];                       // index in the drawn set -> node
  for (const node of nodes) {
    const [x, y, z] = node.p;
    if (node.m) { mine.push(x, y, z); mineC.push(...MEMBER); }
    else { theirs.push(x, y, z); theirsC.push(...OTHER); }
  }
  /* Two objects, because a member's dot is nearly three times the size of a
     coauthor's and PointsMaterial carries one size for the whole cloud. */
  const pOther = points(THREE, theirs, theirsC, 0.055, tex, 0.9);
  const pMine = points(THREE, mine, mineC, 0.145, tex, 1);
  spin.add(pOther, pMine);
  lookup[0] = nodes.filter((n) => !n.m);
  lookup[1] = nodes.filter((n) => n.m);

  /* ---- the edges ----
     Brighter where they touch somebody who works here, so the laboratory's own
     share of a graph of 619 coauthorships can be read without a legend saying
     which lines to look at. */
  const lp = [], lc = [];
  const L = net.links;
  for (let i = 0; i < L.length; i += 3) {
    const a = nodes[L[i]], b = nodes[L[i + 1]];
    const c = (a.m || b.m) ? LINK_MEMBER : LINE;
    lp.push(a.p[0], a.p[1], a.p[2], b.p[0], b.p[1], b.p[2]);
    lc.push(...c, ...c);
  }
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lgeo.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
  spin.add(new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    /* Additive lines gain a stop of brightness everywhere they cross, and 619
       of them cross a lot: at 0.55 the core read as a starburst. This is the
       value at which single lines are still legible and the crossings stop
       shouting. */
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })));

  /* ---- the ring under the pointer ----
     One vertex that moves to whichever node is being pointed at. Cheaper than
     rebuilding a colour attribute, and it reads as a highlight rather than as a
     dot that changed colour. */
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const halo = new THREE.Points(haloGeo, new THREE.PointsMaterial({
    size: 0.34,
    map: tex,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  }));
  spin.add(halo);

  /* ---- size ---- */
  let w = 0, h = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (Math.abs(r.width - w) < 1 && Math.abs(r.height - h) < 1) return;
    w = r.width; h = r.height;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    /* Narrow screens see the graph from further back, or the outer shell of it
       runs off both sides. The graph is a unit sphere, so this is the whole of
       the responsive behaviour it needs. */
    camera.position.z = w < 600 ? 4.1 : 3.2;
    camera.updateProjectionMatrix();
    draw();
  }
  new ResizeObserver(resize).observe(canvas);

  /* ---- pointing at somebody ---- */
  const ray = new THREE.Raycaster();
  ray.params.Points.threshold = 0.045;
  const ndc = new THREE.Vector2();
  let hover = null;
  const tip = opts.tip || null;

  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([pMine, pOther], false);
    if (!hits.length) return null;
    /* Members first when two dots overlap: theirs is the bigger target and the
       one a reader is more likely to have been aiming at. */
    hits.sort((a, b) => (a.object === pMine ? -1 : 0) - (b.object === pMine ? -1 : 0) || a.distanceToRay - b.distanceToRay);
    const hit = hits[0];
    const set = hit.object === pMine ? lookup[1] : lookup[0];
    return { node: set[hit.index], point: hit.point };
  }

  function showTip(found, ev) {
    if (!tip) return;
    if (!found) { tip.hidden = true; return; }
    const n = found.node;
    const years = n.f && n.l ? (n.f === n.l ? String(n.f) : n.f + '–' + n.l) : '';
    tip.querySelector('[data-tip-name]').textContent = n.n;
    tip.querySelector('[data-tip-meta]').textContent =
      [n.w + '×', years].filter(Boolean).join('  ·  ');
    tip.classList.toggle('is-member', !!n.m);
    tip.hidden = false;

    /* Measured against the pane the tip is positioned in, not against the
       canvas: on wide screens the canvas is shifted right inside the stage and
       the two rectangles disagree. */
    const r = (tip.offsetParent || stage).getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;

    /* Above the cursor, unless there is no room above the cursor.
       The stage runs to the top of the document and the navigation bar is
       fixed over the first 68 pixels of it, so a name read off a dot in the
       upper third of the graph was drawn under the bar and clipped by the
       stage's own overflow: the reader got a rounded corner and no name, and
       for the dots highest in the figure it never came back. Flipping the tip
       to the other side of the cursor is what a tooltip is supposed to do at
       an edge, and here the edge is the bar rather than the window.

       Measured, not assumed: the bar is injected by main.js and its height is
       a token that has changed before. */
    const bar = document.getElementById('nav');
    const barBottom = (bar ? bar.getBoundingClientRect().bottom : 68) - r.top;
    const below = (y - 14 - tip.offsetHeight) < barBottom + 8;
    tip.classList.toggle('is-below', below);

    /* Clamped by the tip's real width rather than by a guessed half of it:
       these are people's full names and they run from "A. Reis" to
       "Chrysthofer Arthur Amaro Afonso". And the flip alone is not enough for
       the dots in the first pixels of the figure: the cursor itself can be
       under the bar there, so the anchor is held down far enough that the
       tip's top edge clears it. */
    const half = tip.offsetWidth / 2;
    tip.style.left = Math.max(half + 4, Math.min(r.width - half - 4, x)) + 'px';
    tip.style.top = (below ? Math.max(y, barBottom - 6) : y) + 'px';
  }

  function aimAt(ev) {
    const found = pick(ev);
    hover = found ? found.node : null;
    const p = halo.geometry.attributes.position;
    if (found) {
      p.setXYZ(0, found.node.p[0], found.node.p[1], found.node.p[2]);
      p.needsUpdate = true;
      halo.material.opacity = found.node.m ? 0.5 : 0.34;
    } else {
      halo.material.opacity = 0;
    }
    canvas.style.cursor = found && found.node.m ? 'pointer' : 'default';
    showTip(found, ev);
    if (REDUCED) draw();
    return found;
  }

  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'touch') aimAt(ev);
  });
  /* A finger has no hover, so the touch reads the graph on the way down and the
     click that follows acts on what it found. Without this the whole thing is
     inert on a phone. */
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'touch') aimAt(ev);
  });
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    halo.material.opacity = 0;
    if (tip) tip.hidden = true;
    if (REDUCED) draw();
  });

  /* A dot that is one of ours is a way into that person's record further down
     the page. The roster listens for this; nothing breaks if it is not there. */
  canvas.addEventListener('click', (ev) => {
    const found = hover ? { node: hover } : aimAt(ev);
    if (found && found.node.m) {
      document.dispatchEvent(new CustomEvent('roster:open', { detail: { id: found.node.m } }));
    }
  });

  /* ---- the pointer moves the camera, not the graph ----
     Turning the graph under the pointer makes it a toy you have to operate.
     Moving the camera a few hundredths of a unit is the parallax of standing up
     a little, which is what a reader is doing with their eyes anyway. */
  let px = 0, py = 0, tx = 0, ty = 0;
  if (!REDUCED && stage) {
    stage.addEventListener('pointermove', (ev) => {
      const r = stage.getBoundingClientRect();
      tx = ((ev.clientX - r.left) / r.width - 0.5) * 0.5;
      ty = ((ev.clientY - r.top) / r.height - 0.5) * -0.32;
    });
    stage.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
  }

  function draw() {
    camera.position.x = px;
    camera.position.y = py;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  /* ---- the clock ----
     A full turn takes about two minutes. Anything faster is a logo spinning;
     this should read as something you noticed had moved, not as something
     moving. */
  let last = 0, raf = 0, running = false, wanted = false;
  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    spin.rotation.y += dt * 0.052;
    px += (tx - px) * Math.min(1, dt * 3);
    py += (ty - py) * Math.min(1, dt * 3);
    draw();
    raf = requestAnimationFrame(frame);
  }
  /* Two conditions, one switch. The caller says whether the stage is on screen
     and the browser says whether the tab is; an earlier version had the tab
     handler calling play() directly, which restarted the loop for a graph
     four screens above the reader every time they came back to the page. */
  function sync() {
    const go = wanted && !document.hidden && !REDUCED;
    if (go === running) return;
    running = go;
    if (go) { last = 0; raf = requestAnimationFrame(frame); }
    else cancelAnimationFrame(raf);
  }
  const play = () => { wanted = true; sync(); };
  const hold = () => { wanted = false; sync(); };

  resize();
  draw();
  document.addEventListener('visibilitychange', sync);

  return { play, hold, meta: net.meta };
}
