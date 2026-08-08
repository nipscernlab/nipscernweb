/**
 * NIPS-CERN home page behaviour.
 *
 * Three things live here:
 *
 *   1. Scroll choreography, driven by GSAP ScrollTrigger.
 *   2. The animated media inside the project cards.
 *   3. A WebGL aurora, drawn with ogl, for the AURORA card.
 *
 * Everything is opt-out under prefers-reduced-motion, and every animation is
 * bound to an IntersectionObserver so nothing runs while it is off screen. The
 * aurora and ogl itself are imported dynamically the first time that card comes
 * near the viewport, so a visitor who never scrolls that far never pays the
 * 37 KB the library costs.
 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Run `fn` only while `el` is on screen. Returns a stop handle. */
function whileVisible(el, start, stop) {
  if (!('IntersectionObserver' in window)) { start(); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? start() : stop()));
  }, { rootMargin: '120px' });
  io.observe(el);
  return () => io.disconnect();
}

/* ------------------------------------------------------------------
   1. Scroll choreography
   ------------------------------------------------------------------ */
function choreograph() {
  const gsap = window.gsap;
  if (!gsap || REDUCED) return;
  const ST = window.ScrollTrigger;
  if (!ST) return;
  gsap.registerPlugin(ST);

  /* No custom scroller. An earlier version passed document.scrollingElement on
     the theory that overflow-x:hidden on html and body would confuse the
     measurements. It did the opposite: naming a scroller puts ScrollTrigger
     into the mode it uses for scrolling containers, and only the trigger that
     happens to sit at scroll position zero kept working. The window is the
     scroller here, which is the default, so it goes unsaid.

     What does need saying is refresh. Start positions are measured once, and
     the fonts, the lazily-loaded drawing and the card media all change the
     height of the page after that first pass, which leaves every trigger below
     the fold pointing at the wrong place. */
  addEventListener('load', () => ST.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());

  /* Refresh whenever the document actually changes height.
     Fixed timers were not enough: the latest news and publication cards are
     fetched and injected long after load, thirteen images arrive lazily, and
     the video swaps in later still. Every one of those changes the page height
     and leaves every trigger below it measuring against a layout that no
     longer exists, which is why scrolling to the bottom and back up found the
     parallax dead. Watching the height covers all of them and anything added
     later. */
  let lastH = 0, pending = 0;
  const watch = new ResizeObserver(() => {
    const h = document.documentElement.scrollHeight;
    if (Math.abs(h - lastH) < 4) return;
    lastH = h;
    clearTimeout(pending);
    pending = setTimeout(() => ST.refresh(), 150);
  });
  watch.observe(document.body);

  /* Parallax, as a stack rather than a single moving element.
     One layer drifting on its own reads as a glitch; depth only appears when
     several things move at rates the eye can compare. Three planes here, from
     back to front:

       the starfield   far    drifts down, so it lags the page
       the wordmark    middle rises a little as it leaves
       the stargazer   near   rises most, since near things sweep past fastest

     Only transforms are animated. If any of this fails to run, every element
     stays exactly where the CSS already put it. */

  // Far: the sky lags behind, which is what makes it read as distance.
  const stars = document.getElementById('hero-stars');
  if (stars) {
    gsap.to(stars, {
      yPercent: 18,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
    });
  }

  // Middle: the wordmark and its buttons leave a touch faster than the page.
  const heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    gsap.to(heroContent, {
      yPercent: -14,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
    });
  }

  // Near: the boy sweeps past fastest. The range is the whole time he is on
  // screen, so the travel is spread over a long scroll rather than crammed
  // into the few hundred pixels the figure itself occupies.
  const boy = document.querySelector('.stargazer img');
  if (boy) {
    gsap.fromTo(boy,
      { yPercent: 16 },
      {
        yPercent: -16,
        ease: 'none',
        scrollTrigger: { trigger: '.stargazer', start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
      });
  }

  // The line under him trails slightly further behind, which separates it from
  // the figure instead of letting the two travel as one block.
  const note = document.querySelector('.stargazer-note');
  if (note) {
    gsap.fromTo(note,
      { yPercent: 30 },
      {
        yPercent: -30,
        ease: 'none',
        scrollTrigger: { trigger: '.stargazer', start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
      });
  }

  /* Everything below the stargazer used to sit still, which made the parallax
     read as something that happens to the header rather than a property of the
     page. These carry it the rest of the way down.

     A helper, because the pattern is the same every time: travel from +a to -a
     over the whole time the trigger is on screen. */
  /* Travel is in pixels, not percentages.
     The first version used yPercent, which on a tall element means a percentage
     of its own height: the projects grid is some 700px, so 10% was 70px of
     movement and the grid climbed straight over the heading above it. A
     percentage is fine for something inside a frame that clips it, and wrong
     for a block that has neighbours. Pixels are bounded, so a band can move
     without ever reaching what sits next to it. */
  const drift = (sel, px, sc) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return;
    gsap.fromTo(el, { y: px }, {
      y: -px,
      ease: 'none',
      scrollTrigger: { trigger: sc || el, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
    });
  };

  /* For media that sits inside a frame with overflow hidden, a percentage is
     still the right unit: the frame clips whatever leaves it. */
  const driftInFrame = (el, pct, sc) => {
    if (!el) return;
    gsap.fromTo(el, { yPercent: pct }, {
      yPercent: -pct,
      ease: 'none',
      scrollTrigger: { trigger: sc || el, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
    });
  };

  // The figures rise gently out of their strip.
  drift('.stats-strip-inner', 18, '.stats-strip');

  /* The calorimeter poster moves inside its own frame, which is the oldest
     parallax there is and the one that reads best on a full-width band. The
     frame clips, so the image is oversized in CSS to have somewhere to go. */
  driftInFrame(document.querySelector('.cgv-poster'), 14, '.cgv-stage');

  /* Every band from here to the foot of the page.
     The first pass stopped at the calorimeter, which left a long dead stretch
     in the middle: parallax that quits halfway down reads worse than none at
     all, because the eye has already been told the page has depth.

     Each band moves its heading and its content at different rates, so the two
     separate as they pass rather than travelling as one block. Rates are small
     and all different; the point is that nothing sits perfectly still. */
  /* Each band moves its heading and its content by different, small amounts, so
     the two separate as they pass instead of travelling as one block. The
     numbers are pixels and the gaps between sections are far larger, which is
     what keeps a heading and the grid under it from ever meeting. */
  const bands = [
    { scope: '.cgv-section',     head: '.cgv-header',            headPx: 14, body: null,                     bodyPx: 0 },
    { scope: '.info-highlights', head: '.section-header',        headPx: 16, body: '.info-highlights .grid', bodyPx: 26 },
    { scope: '#latest-section',  head: '.lab-head',              headPx: 14, body: '.lab-feature',           bodyPx: 24 },
    { scope: '#projects-section',head: '.section-header',        headPx: 16, body: '.pc-grid',               bodyPx: 26 },
    { scope: '.sponsors-strip',  head: '.sponsors-label',        headPx: 10, body: '.sponsors-logos',        bodyPx: 18 },
  ];

  /* The list under the featured story trails it, so the two do not arrive as
     one block. Set up after the bands because the renderer fills it later; the
     height watcher re-measures once it does. */
  setTimeout(() => drift('.lab-rest', 14, '#latest-section'), 400);
  bands.forEach((b) => {
    const scope = document.querySelector(b.scope);
    if (!scope) return;
    const head = scope.querySelector(b.head);
    if (head) drift(head, b.headPx, scope);
    if (b.body) {
      const body = scope.querySelector(b.body) || document.querySelector(b.body);
      if (body) drift(body, b.bodyPx, scope);
    }
  });

  /* Inside each card the artwork drifts against its own frame, in percent,
     because the frame clips it. What travels is the media; the frame stays. */
  gsap.utils.toArray('.pc-grid .pc-card').forEach((card, i) => {
    const media = card.querySelector('.pc-shot img, .pc-video video');
    if (media) driftInFrame(media, i % 2 ? -6 : 6, card);
  });

  /* Nothing here may control whether content is visible.
     The first version faded the cards in with gsap.from({opacity: 0}), which
     writes opacity:0 inline the moment the tween is built and only clears it
     when the trigger fires. One trigger that does not fire, for any reason,
     and the section is blank with no way for the reader to recover. The page
     already reveals grids through .stagger-children in CSS, so that keeps the
     job; GSAP is left with the effects that fail harmlessly, where not running
     simply means the element sits where it already was. */

  /* Figures count up from zero when the strip is reached. If this never runs
     the numbers are already correct in the markup. */
  gsap.utils.toArray('.stat-number .accent').forEach((el) => {
    const end = parseInt(el.textContent.replace(/\D/g, ''), 10);
    if (!end) return;
    const obj = { v: 0 };
    gsap.to(obj, {
      v: end,
      duration: 1.2,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate() { el.textContent = Math.round(obj.v).toLocaleString(); },
    });
  });
}

/* ------------------------------------------------------------------
   2a. YANC — the instruction set, falling
   ------------------------------------------------------------------
   Every token below was read out of the compiler's own lexers: the twelve
   directives from CMMComp.l, the mnemonics from ASMComp.l. Nothing here is
   invented, which is the whole reason the card is worth looking at.

   The column falls rather than scrolls sideways, fogged at both ends, so it
   reads as a listing running past rather than a marquee. The track is printed
   twice and translated by exactly half its height, which puts the seam on an
   identical frame and makes the loop invisible.
   ------------------------------------------------------------------ */
const YANC_MNEMONICS = [
  'LOD', 'SET', 'PSH', 'POP', 'INN', 'OUT', 'JMP', 'JIZ', 'CAL', 'RET',
  'ADD', 'MLT', 'DIV', 'MOD', 'AND', 'ORR', 'XOR', 'INV', 'NEG', 'ABS',
  'SHL', 'SHR', 'SRS', 'EQU', 'GRE', 'LES', 'LAN', 'LOR', 'SGN', 'NOP',
  'F_ADD', 'F_MLT', 'F_DIV', 'F_ABS', 'F_NEG', 'F_SGN', 'F_GRE', 'F_LES',
  'F_ROT', 'F_SCL', 'F_PST', 'F_INN', 'I2F', 'F2I', 'NRM', 'PST', 'XPO',
  'LDI', 'STI', 'ILI', 'ISI', 'LDA', 'LEA', 'STA', 'LIN', 'NOP', 'SRS',
];

function yancCascade(host) {
  /* Instruction set only. The compiler directives came out: they are a
     different layer of the toolchain and reading `#NUBITS` next to `F_MLT`
     asks the eye to hold two ideas at once. What falls here is what the
     processor executes.

     Three columns. The middle one is the one you read; the outer two are the
     same instruction set at a smaller size and knocked back, which gives the
     panel depth and fills the width without adding anything new to look at.
     Each column starts at a different offset in the list and falls at its own
     rate, so the three never line up into rows. */
  const cols = [
    { cls: 'yc-side', offset: 17, dur: 0.46 },
    { cls: 'yc-main', offset: 0, dur: 0.34 },
    { cls: 'yc-side', offset: 34, dur: 0.52 },
  ];

  host.innerHTML = cols.map((c) => {
    const list = YANC_MNEMONICS.slice(c.offset).concat(YANC_MNEMONICS.slice(0, c.offset));
    const run = list.map((t) => `<i>${t}</i>`).join('');
    const secs = (YANC_MNEMONICS.length * c.dur).toFixed(1);
    return `<div class="yc-col ${c.cls}" style="--dur:${secs}s">
        <div class="yc-track"><div class="yc-run">${run}</div><div class="yc-run">${run}</div></div>
      </div>`;
  }).join('');

  whileVisible(host,
    () => host.classList.add('is-running'),
    () => host.classList.remove('is-running'));
}

/* ------------------------------------------------------------------
   2b. HITS — the pulse train
   ------------------------------------------------------------------
   The card is about a synthesizer that reproduces the Tile Calorimeter readout
   at the detector clock, so the media is a pulse train marching left at a
   steady rate. The shape is the calorimeter's own: a fast rise and a long tail,
   which is what the front-end shaper produces and what the digitiser samples
   every 25 ns.
   ------------------------------------------------------------------ */
function hitsPulse(canvas) {
  const ctx = canvas.getContext('2d');
  let raf = 0, running = false, w = 0, h = 0, dpr = 1, t0 = 0;

  /* The shaper is the one published in Luna, Paschoalin, Quirino and Andrade
     Filho, "Digital Implementation of a Signal Conditioning Stage on FPGA for
     Pulse Simulation in Nuclear Instrumentation", INSCIT 2026.

     A charge-sensitive preamplifier feeds a pulse shaper built on a CR-4RC
     topology. The paper fixes tau_f = 510 ns for the preamplifier, tau = 5 us
     for the shaper and a sampling period Ts = 25 ns, then expands the transfer
     function into its dominant poles. The last of those sits at 2.00e3 rad/s,
     a time constant of 500 us: that is the long tail, and it is the reason the
     paper argues a FIR shaper would need on the order of ten thousand taps.

     A CR-(RC)^n shaper peaks at n*tau, so this pulse peaks 20 us after the
     event, 800 samples in. That is far slower than the shape this card carried
     before, and it changes what the panel can show: at 25 ns a sample is finer
     than a pixel here, so the samples are not drawn individually and the axis
     is ruled in microseconds instead of bunch crossings. */
  const TAU_F = 0.51;        // us, charge-sensitive preamplifier
  const TAU = 5.0;           // us, CR-4RC shaper
  const TAU_TAIL = 500.0;    // us, the pole at 2.00e3 rad/s
  const TAIL_W = 0.05;       // its weight: small per pulse, cumulative in a train
  const N = 4;               // RC integrator stages
  const NORM = Math.pow(N, N) * Math.exp(-N) / 24;

  const US_PER_PX = 0.62;    // about 250 us of signal across the panel
  const SPEED = 58;          // px/s, so roughly 36 us of signal per second
  const MEAN_GAP = 34;       // us between events, close enough to pile up

  const shape = (t) => {
    if (t <= 0) return 0;
    const csp = 1 - Math.exp(-t / TAU_F);
    const cr4rc = Math.pow(t / TAU, N) * Math.exp(-t / TAU) / 24 / NORM;
    return (cr4rc + TAIL_W * Math.exp(-t / TAU_TAIL)) * csp;
  };

  /* Deterministic event list. A hash rather than Math.random so an event keeps
     its time and amplitude as it travels across the panel; drawing fresh
     numbers each frame would make the trace shimmer. */
  const rnd = (i, salt) => {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const evTime = (i) => i * MEAN_GAP + (rnd(i, 1) - 0.5) * MEAN_GAP * 1.1;
  const evAmp = (i) => 0.22 + Math.pow(rnd(i, 2), 2.6) * 0.78;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (ts) => {
    if (!t0) t0 = ts;
    const el = (ts - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    /* Room for a peak of one unit sitting on a baseline the piled-up tails have
       already lifted, so the gain is set for the sum rather than for a single
       pulse. */
    const base = h * 0.86;
    const amp = h * 0.44;

    const tShift = el * SPEED * US_PER_PX;      // us of signal scrolled past
    const tLeft = tShift;                       // time at the left edge
    const tRight = tShift + w * US_PER_PX;

    /* Value at a time: every event still contributing, summed. The window
       reaches 12 shaper time constants back because the tail is genuinely
       still there. That summation is pile-up, and the baseline drift is not
       drawn in anywhere: it falls out of adding the tails. */
    const iFrom = Math.floor((tLeft - TAU * 12) / MEAN_GAP) - 2;
    const iTo = Math.ceil(tRight / MEAN_GAP) + 2;
    const at = (t) => {
      let v = 0;
      for (let i = iFrom; i <= iTo; i++) {
        const dt = t - evTime(i);
        if (dt > 0) v += evAmp(i) * shape(dt);
      }
      return v;
    };

    // time ruler, every 50 us
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const step = 50;
    for (let tk = Math.ceil(tLeft / step) * step; tk < tRight; tk += step) {
      const x = (tk - tShift) / US_PER_PX;
      ctx.beginPath(); ctx.moveTo(x, h * 0.14); ctx.lineTo(x, base + 4); ctx.stroke();
    }

    // pedestal
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(w, base); ctx.stroke();

    // the conditioned signal the digitiser sees
    ctx.beginPath();
    for (let px = 0; px <= w; px += 1) {
      const t = tShift + px * US_PER_PX;
      let v = at(t);
      v += (rnd(Math.round(t * 4), 7) - 0.5) * 0.03;   // electronic noise
      const y = base - v * amp;
      px ? ctx.lineTo(px, y) : ctx.moveTo(px, y);
    }
    ctx.strokeStyle = '#ff6d00';
    ctx.lineWidth = 1.7;
    ctx.shadowColor = 'rgba(255,109,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    raf = requestAnimationFrame(draw);
  };

  const start = () => { if (!running) { running = true; resize(); raf = requestAnimationFrame(draw); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  resize();
  addEventListener('resize', resize);
  if (REDUCED) { requestAnimationFrame((ts) => { draw(ts); stop(); }); return; }
  whileVisible(canvas, start, stop);
}

/* ------------------------------------------------------------------
   2c. CGV — the rendered geometry loop
   ------------------------------------------------------------------
   The file is not fetched until the card is close, and it only plays while it
   is on screen: a background loop that keeps decoding in a tab nobody is
   looking at is a battery drain for no benefit. The poster stands in until the
   first frame is ready, and stays if the video never loads at all.
   ------------------------------------------------------------------ */
function cgvLoop(video) {
  if (REDUCED) return;                     // poster only
  let armed = false;

  /* Two sources. data-src is the full hundred-second cut on the CDN, which is
     where video belongs by this project's own rules; data-fallback is a
     shorter copy inside the repository, small enough to pass the 2 MB guard.
     The fallback is what makes the card work in a local checkout and on the
     day the CDN is unreachable, and it is why this is not simply one URL. */
  const arm = () => {
    if (armed) return;
    armed = true;
    const primary = video.dataset.src;
    const backup = video.dataset.fallback;
    const play = () => { const p = video.play(); if (p) p.catch(() => {}); };

    video.addEventListener('error', () => {
      if (backup && video.src.indexOf(backup) === -1) { video.src = backup; video.load(); play(); }
    }, { once: true });

    video.src = primary || backup;
    video.load();
  };

  whileVisible(video,
    () => { arm(); const p = video.play(); if (p) p.catch(() => {}); },
    () => video.pause());
}

/* A full-screen triangle. This build of ogl exports Geometry, Plane, Box and
   the rest but no Triangle helper, so the three vertices are written out: one
   oversized triangle covering the viewport, which costs one less vertex and one
   less diagonal seam than the two-triangle quad it replaces. */
function fullScreenTriangle(Geometry, gl) {
  return new Geometry(gl, {
    position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
    uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
  });
}

/* ------------------------------------------------------------------
   3. AURORA — a real aurora, in WebGL
   ------------------------------------------------------------------
   Drawn with ogl. The palette is taken from the project's own mark rather than
   from a generic green-and-purple aurora: the sage, amber and cold blue that
   the icon uses are the colours the card fades between.

   ogl is imported dynamically the first time this card approaches the viewport.
   ------------------------------------------------------------------ */
/* SoftAurora, from React Bits by David Haz, ported from its React component.
   MIT with the Commons Clause, which restricts reselling the software rather
   than using it on a site. Credited in credits.html.

   Two layered curtains of 3D Perlin noise, each tinted through a cosine
   gradient that drifts along the width. The last line is the reason this one
   works here: alpha comes from the length of the colour itself, so the curtain
   dissolves wherever it is dim and needs no mask to sit on a card.

   Source: https://reactbits.dev/backgrounds/soft-aurora */
const AURORA_VERT = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0, 1); }
`;

const AURORA_FRAG = `
precision highp float;

uniform float uTime;
uniform vec3  uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uBrightness;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform float uNoiseFreq;
uniform float uNoiseAmp;
uniform float uBandHeight;
uniform float uBandSpread;
uniform float uOctaveDecay;
uniform float uLayerOffset;
uniform float uColorSpeed;

#define TAU 6.28318

vec3 gradientHash(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 234.6)),
    dot(p, vec3(269.5, 183.3, 198.3)),
    dot(p, vec3(169.5, 283.3, 156.9))
  );
  vec3 h = fract(sin(p) * 43758.5453123);
  float phi = acos(2.0 * h.x - 1.0);
  float theta = TAU * h.y;
  return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
}

float quinticSmooth(float t) {
  float t2 = t * t;
  float t3 = t * t2;
  return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
}

vec3 cosineGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float perlin3D(float amplitude, float frequency, float px, float py, float pz) {
  float x = px * frequency;
  float y = py * frequency;

  float fx = floor(x); float fy = floor(y); float fz = floor(pz);
  float cx = ceil(x);  float cy = ceil(y);  float cz = ceil(pz);

  vec3 g000 = gradientHash(vec3(fx, fy, fz));
  vec3 g100 = gradientHash(vec3(cx, fy, fz));
  vec3 g010 = gradientHash(vec3(fx, cy, fz));
  vec3 g110 = gradientHash(vec3(cx, cy, fz));
  vec3 g001 = gradientHash(vec3(fx, fy, cz));
  vec3 g101 = gradientHash(vec3(cx, fy, cz));
  vec3 g011 = gradientHash(vec3(fx, cy, cz));
  vec3 g111 = gradientHash(vec3(cx, cy, cz));

  float d000 = dot(g000, vec3(x - fx, y - fy, pz - fz));
  float d100 = dot(g100, vec3(x - cx, y - fy, pz - fz));
  float d010 = dot(g010, vec3(x - fx, y - cy, pz - fz));
  float d110 = dot(g110, vec3(x - cx, y - cy, pz - fz));
  float d001 = dot(g001, vec3(x - fx, y - fy, pz - cz));
  float d101 = dot(g101, vec3(x - cx, y - fy, pz - cz));
  float d011 = dot(g011, vec3(x - fx, y - cy, pz - cz));
  float d111 = dot(g111, vec3(x - cx, y - cy, pz - cz));

  float sx = quinticSmooth(x - fx);
  float sy = quinticSmooth(y - fy);
  float sz = quinticSmooth(pz - fz);

  float lx00 = mix(d000, d100, sx);
  float lx10 = mix(d010, d110, sx);
  float lx01 = mix(d001, d101, sx);
  float lx11 = mix(d011, d111, sx);

  float ly0 = mix(lx00, lx10, sy);
  float ly1 = mix(lx01, lx11, sy);

  return amplitude * mix(ly0, ly1, sz);
}

float auroraGlow(float t) {
  vec2 uv = gl_FragCoord.xy / uResolution.y;

  float noiseVal = 0.0;
  float freq = uNoiseFreq;
  float amp = uNoiseAmp;
  vec2 samplePos = uv * uScale;

  for (float i = 0.0; i < 3.0; i += 1.0) {
    noiseVal += perlin3D(amp, freq, samplePos.x, samplePos.y, t);
    amp *= uOctaveDecay;
    freq *= 2.0;
  }

  float yBand = uv.y * 10.0 - uBandHeight * 10.0;
  return 0.3 * max(exp(uBandSpread * (1.0 - 1.1 * abs(noiseVal + yBand))), 0.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float t = uSpeed * 0.4 * uTime;

  vec3 col = vec3(0.0);
  col += 0.99 * auroraGlow(t) *
         cosineGradient(uv.x + uTime * uSpeed * 0.2 * uColorSpeed,
                        vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.20, 0.20)) * uColor1;
  col += 0.99 * auroraGlow(t + uLayerOffset) *
         cosineGradient(uv.x + uTime * uSpeed * 0.1 * uColorSpeed,
                        vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.20, 0.25)) * uColor2;

  col *= uBrightness;
  float alpha = clamp(length(col), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

/* Sage and cold blue, read off assets/icons/aurora.svg. The component ships
   white and magenta; the cosine gradients push these through amber on their
   own, which is the third colour in the mark. */
const AURORA_COLOR1 = [0.671, 0.741, 0.506];   // #abbd81
const AURORA_COLOR2 = [0.467, 0.643, 0.741];   // #77a4bd

async function auroraCanvas(canvas) {
  const host = canvas.closest('.pc-aurora');
  /* Anything at all going wrong past this point falls back to the still wash.
     The earlier version only caught a failed import, so a WebGL context that
     could not be created, a shader that would not compile or a bad uniform all
     ended the same way: an empty rectangle with no clue why. An unexplained
     blank is the one outcome worth engineering against. */
  const giveUp = (why) => {
    host?.classList.add('is-static');
    if (why) console.warn('[aurora] falling back to the static wash:', why);
  };

  if (REDUCED) { giveUp(); return; }

  let mod;
  try {
    mod = await import('./vendor/ogl.mjs');
  } catch (e) { giveUp(e); return; }

  try {
    await auroraRender(canvas, mod);
  } catch (e) { giveUp(e); }
}

async function auroraRender(canvas, mod) {
  const { Renderer, Program, Mesh, Geometry } = mod;

  const renderer = new Renderer({
    canvas, alpha: true, premultipliedAlpha: false, antialias: true,
    dpr: Math.min(devicePixelRatio || 1, 2),
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const program = new Program(gl, {
    vertex: AURORA_VERT,
    fragment: AURORA_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [1, 1, 1] },
      uSpeed: { value: 0.55 },
      /* Bigger noise features: a card is a small window, and at the stock
         scale the curtain reads as speckle rather than as sheets of light. */
      uScale: { value: 1.0 },
      uBrightness: { value: 2.0 },
      uColor1: { value: AURORA_COLOR1 },
      uColor2: { value: AURORA_COLOR2 },
      uNoiseFreq: { value: 2.5 },
      uNoiseAmp: { value: 1.0 },
      /* Centred on the card rather than sitting at the foot of a page-wide
         banner, which is what the default of 0.5 assumes. */
      uBandHeight: { value: 0.52 },
      /* Spread is what decides how much of the card the light reaches. It
         divides the exponent, so a high value concentrates the curtain into a
         bright strip and a low one opens it out. At the stock 1.1 the glow
         covered 40% of the height and left the rest dark, which is why the
         card read as an aurora at the top and nothing below. At 0.3 it reaches
         every part of the card, and brightness above compensates for spreading
         the same light further. */
      uBandSpread: { value: 0.3 },
      uOctaveDecay: { value: 0.1 },
      uLayerOffset: { value: 1.7 },
      uColorSpeed: { value: 1.0 },
    },
  });
  const mesh = new Mesh(gl, { geometry: fullScreenTriangle(Geometry, gl), program });

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height);
    program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height];
  };
  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(resize);

  let raf = 0, running = false;
  const frame = (t) => {
    program.uniforms.uTime.value = t * 0.001;
    renderer.render({ scene: mesh });
    raf = requestAnimationFrame(frame);
  };
  whileVisible(canvas,
    () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
    () => { running = false; cancelAnimationFrame(raf); });
}

/* ------------------------------------------------------------------
   5. From the Lab
   ------------------------------------------------------------------
   One story carries the section and the rest sit under it, rather than two
   equal boxes that told the reader a paper and a news item weigh the same.

   Everything shown is read out of data/news.json and data/publications.json:
   the dates, the titles, the covers, the venue a paper appeared in. The only
   invented thing on screen is the word "Paper".
   ------------------------------------------------------------------ */
const LANGS = ['en', 'pt', 'fr', 'no'];

function docLang() {
  const l = (document.documentElement.lang || 'en').slice(0, 2);
  return LANGS.includes(l) ? l : 'en';
}

/* A post carries translations for some languages and not others. Fall back to
   the original rather than showing an empty card. */
function postText(post) {
  const l = docLang();
  const t = (post.translations && post.translations[l]) || {};
  return {
    title: t.title || post.title,
    excerpt: t.excerpt || post.excerpt,
    lang: t.title ? l : 'en',
  };
}

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  const locale = { en: 'en-GB', pt: 'pt-BR', fr: 'fr-FR', no: 'nb-NO' }[docLang()];
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/* Covers live either in the repository or on the CDN, and the JSON holds both
   shapes. Absolute URLs are left alone. */
function coverURL(post) {
  if (!post.image) return '';
  return /^https?:/.test(post.image) ? post.image : post.image;
}

function renderLab(news, pubs) {
  const feature = document.getElementById('lab-feature');
  const rest = document.getElementById('lab-rest');
  if (!feature || !rest || !news || !news.length) return;

  const t = (k, fb) => {
    const el = document.querySelector(`[data-i18n="${k}"]`);
    return (el && el.textContent.trim()) || fb;
  };

  // ---- the story that leads
  const lead = news[0];
  const lt = postText(lead);
  const cover = coverURL(lead);
  feature.removeAttribute('aria-busy');
  feature.innerHTML = `
    <a class="lf-card" href="news/post.html?id=${encodeURIComponent(lead.slug || lead.id)}">
      <div class="lf-media">
        ${cover ? `<img src="${cover}" alt="" loading="lazy" decoding="async">` : ''}
      </div>
      <div class="lf-body">
        <div class="lf-meta">
          <time datetime="${lead.date}">${fmtDate(lead.date)}</time>
          <span class="lf-dot" aria-hidden="true"></span>
          <span class="lf-cat">${lead.category}</span>
        </div>
        <h3 class="lf-title">${lt.title}</h3>
        <p class="lf-excerpt">${lt.excerpt || ''}</p>
        <span class="lf-go">${t('home.latest.read', 'Read the story')}<i class="ph ph-arrow-right" aria-hidden="true"></i></span>
      </div>
    </a>`;

  // ---- two more stories and the newest paper
  const next = news.slice(1, 3);
  const paper = (pubs || []).slice().sort((a, b) => Number(b.year) - Number(a.year))[0];

  const items = next.map((p) => {
    const pt = postText(p);
    return `
      <a class="lr-item" href="news/post.html?id=${encodeURIComponent(p.slug || p.id)}">
        <time class="lr-date" datetime="${p.date}">${fmtDate(p.date)}</time>
        <span class="lr-title">${pt.title}</span>
      </a>`;
  });

  if (paper) {
    items.push(`
      <a class="lr-item lr-item--paper" href="${paper.pdf || 'publications.html'}"${paper.pdf ? ' target="_blank" rel="noopener"' : ''}>
        <span class="lr-date">${paper.year} <span class="lr-kind">${t('home.latest.paper', 'Paper')}</span></span>
        <span class="lr-title">${paper.title}</span>
        <span class="lr-venue">${paper.journal || ''}</span>
      </a>`);
  }

  rest.innerHTML = items.join('');
}

async function fromTheLab() {
  if (!document.getElementById('lab-feature')) return;
  const base = new URL('../../', import.meta.url).href;
  try {
    const [news, pubs] = await Promise.all([
      fetch(base + 'data/news.json').then((r) => r.json()),
      fetch(base + 'data/publications.json').then((r) => r.json()).catch(() => []),
    ]);
    renderLab(news, pubs);
    /* Re-render on a language change so the dates and the translated titles
       follow, and refresh the scroll positions because the section just
       changed height. */
    document.addEventListener('langchange', () => {
      renderLab(news, pubs);
      window.ScrollTrigger && window.ScrollTrigger.refresh();
    });
  } catch (e) {
    console.warn('[from the lab] could not load the data:', e);
  }
}

/* ------------------------------------------------------------------
   Wiring
   ------------------------------------------------------------------ */
/* Failsafe.
   The page hides .fade-up and .stagger-children in CSS and relies on an
   observer in main.js to add .visible. That is one script away from a blank
   page, which is exactly what happened once already. Two seconds after load,
   anything still hidden is revealed outright: a missed animation costs nothing,
   invisible content costs the reader everything. */
function revealFailsafe() {
  setTimeout(() => {
    document.querySelectorAll('.fade-up:not(.visible), .fade-in:not(.visible), .stagger-children:not(.visible)')
      .forEach((el) => el.classList.add('visible'));
  }, 2000);
}

function init() {
  revealFailsafe();
  fromTheLab();
  choreograph();

  const ys = document.querySelector('[data-media="yanc-cascade"]');
  if (ys) yancCascade(ys);

  const cg = document.querySelector('[data-media="cgv-loop"]');
  if (cg) cgvLoop(cg);

  const hp = document.querySelector('[data-media="hits-pulse"]');
  if (hp) hitsPulse(hp);

  /* ogl only arrives if the card gets close. */
  const au = document.querySelector('[data-media="aurora"]');
  if (au) {
    if (!('IntersectionObserver' in window)) { auroraCanvas(au); }
    else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { io.disconnect(); auroraCanvas(au); } });
      }, { rootMargin: '400px' });
      io.observe(au);
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
