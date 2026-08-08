/**
 * NIPS-CERN home page behaviour.
 *
 * Three things live here:
 *
 *   1. Scroll choreography, driven by GSAP ScrollTrigger.
 *   2. The animated media inside the project cards.
 *
 * Everything is opt-out under prefers-reduced-motion, and every animation is
 * bound to an IntersectionObserver so nothing runs while it is off screen. No
 * file is fetched until the card that needs it comes near the viewport, so a
 * visitor who never scrolls that far pays for none of it.
 */

/* The same URL builders the publications and news pages use, so a paper opened
   from the home lands in the site's own viewer rather than on a raw PDF. */
import { publicationUrl, newsPostUrl } from './content-links.js';

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

  /* Parallax, and the rule for where it is allowed to happen.

     The first pass moved every band on the page: each section heading at one
     rate, the content under it at another, seventeen layers from the hero to
     the sponsors. Read as a whole that is not depth, it is instability. Running
     text is the worst case, because the reader uses the gap between a heading
     and its first line to know the two belong together, and a gap that keeps
     changing while you read takes that away.

     So: a thing may drift only if a frame clips it. That bounds the travel and
     makes it impossible to reach a neighbour, and it is also what parallax
     physically is, a view through an opening onto something further away. Three
     places qualify, and the rest of the page holds still:

       the starfield             inside the hero, which hides its overflow
       the calorimeter poster    inside .cgv-stage
       the artwork in each card  inside .pc-media, which the card clips

     Type never moves. Only transforms are animated, so if none of this runs the
     page is exactly what the CSS already laid out. */

  /* The sky lags the page, which is the whole of the hero's depth: the wordmark
     is fixed to the document and the far thing slides behind it. The wordmark
     used to counter-move as well, and the stargazer and his caption after that,
     but stacking movers only made the header restless. */
  const stars = document.getElementById('hero-stars');
  if (stars) {
    gsap.to(stars, {
      yPercent: 14,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
    });
  }

  /* Inside a clipping frame a percentage is the right unit: it is a share of
     the medium's own height, and whatever leaves the frame is cut off.

     The trap in that unit is that it is a share of the element, not of the
     frame. A medium hung at 118% of its frame and drifted by 14 travels 16.5%
     of the frame while having only 9% of headroom to do it in, and then the far
     edge goes empty, which is the one thing this effect must never do. Both
     numbers below are set against the headroom their CSS gives them:

       the sky        22% of headroom, travels 20.2%
       the poster     16% of headroom, travels 13.2%
       card media      7% of headroom, travels  6.8% */
  const driftInFrame = (el, pct, sc) => {
    if (!el) return;
    gsap.fromTo(el, { yPercent: pct }, {
      yPercent: -pct,
      ease: 'none',
      scrollTrigger: { trigger: sc || el, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
    });
  };

  /* The calorimeter poster inside its stage. The oldest parallax there is, and
     the one that reads best on a full-width band. The image is oversized in CSS
     so the movement never pulls an empty edge into view. */
  driftInFrame(document.querySelector('.cgv-poster'), 10, '.cgv-stage');

  /* The cover of the lead story, inside the frame that already clips it. Set up
     on a delay because the renderer fills that lane from the JSON well after
     this runs; the height watcher re-measures once it does. */
  setTimeout(() => driftInFrame(document.querySelector('.ln-media img'), 7, '.ln-lead'), 500);

  /* The boy under the hero. Not a frame, but a figure with room around it on
     every side, and he is the near plane of the same composition as the sky:
     the sky lags, he sweeps past. Small, and nothing but him moves here. The
     line under him stays where it is, because that one is type. */
  const boy = document.querySelector('.stargazer img');
  if (boy) {
    gsap.fromTo(boy, { yPercent: 7 }, {
      yPercent: -7,
      ease: 'none',
      scrollTrigger: { trigger: '.stargazer', start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
    });
  }

  /* The artwork inside each project card. What travels is the medium; the card
     and every word on it stay put. */
  gsap.utils.toArray('.pc-grid .pc-card').forEach((card, i) => {
    /* Except the calorimeter. Its medium is not oversized, because on a frame
       that wide the headroom the drift needs costs field of view, so there is
       nothing here to move without pulling an empty edge into the card. */
    const media = card.querySelector('.pc-media:not(.pc-media--cgv) img, .pc-media:not(.pc-media--cgv) video');
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

  /* The two halves of the pulse are summed over different windows, and that
     separation is the whole reason the trace is steady.

     The shaped part is spent after a dozen time constants, 60 us, so a short
     window covers it. The tail is the pole at 2.00e3 rad/s, a time constant of
     500 us, and the first version summed it over that same 60 us window. Events
     were dropping out while each was still worth about 0.04, and with one
     leaving every 34 us of signal the entire baseline stepped down, again and
     again: that is the trace sinking in stages. The tail needs some 3.5 ms of
     history before what falls off the end is worth less than a ten-thousandth. */
  /* Twenty-two time constants rather than twelve. Measured, the edge of the
     window was never the problem: the index is rounded down and then backed off
     one more event, so by the time an event leaves it is already 15 us past the
     nominal edge and worth 0.015 of a pixel. This is margin, not a fix, and it
     costs four events per sample either way. */
  const FAST_SPAN = TAU * 22;         // us
  const TAIL_SPAN = TAU_TAIL * 7;     // us

  const shaped = (t) => {
    if (t <= 0) return 0;
    const csp = 1 - Math.exp(-t / TAU_F);
    return Math.pow(t / TAU, N) * Math.exp(-t / TAU) / 24 / NORM * csp;
  };

  /* The slow pole does not switch on. Both poles are downstream of the same
     shaper, so the 500 us term is the convolution of that exponential with the
     integrator chain, and it climbs over the shaper's own time constant rather
     than appearing whole at the arrival time.

     Splitting the two terms apart is what lost this: the tail was left as a
     bare exp(-t/tau), which steps from nothing to 0.05 the instant an event
     arrives. Five percent of full scale is five pixels on this card, and with
     an event every 34 us the trace grew a small cliff every twenty pixels. In
     the peaks it was buried; in the valleys the tail is the entire signal, so
     every valley pulsed. Raised to the fourth, the rise matches the four RC
     stages and takes about 20 us, which is the same 4*tau the main pulse takes
     to reach its own peak. */
  const tailRise = (t) => { const r = 1 - Math.exp(-t / TAU); return r * r * r * r; };
  const tailTerm = (t) => TAIL_W * Math.exp(-t / TAU_TAIL) * tailRise(t);

  /* Deterministic event list. A hash rather than Math.random so an event keeps
     its time and amplitude as it travels across the panel; drawing fresh
     numbers each frame would make the trace shimmer. */
  const rnd = (i, salt) => {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const evTime = (i) => i * MEAN_GAP + (rnd(i, 1) - 0.5) * MEAN_GAP * 1.1;
  const evAmp = (i) => 0.22 + Math.pow(rnd(i, 2), 2.6) * 0.78;

  /* Electronic noise, keyed to signal time on a fixed grid and interpolated
     between the samples, so it travels along with the trace.

     Two things had to be true before the waveform would sit still. The first is
     that the noise be a function of signal time at all: it used to be drawn as
     rnd(Math.round(t * 4)), one fresh number per pixel, and since a pixel is
     0.62 us wide the index moved by 2.48 between neighbours and by another 2.48
     every frame as the panel scrolled. Every point on the trace got a new random
     value sixty times a second. That was not noise travelling with the signal,
     it was the panel boiling.

     The second is that its features be wider than a pixel. At a 0.5 us grid a
     feature was 0.8 px across while the trace scrolls 0.97 px per frame, so the
     texture aliased against its own movement and shimmered even though every
     value was correct. At 1.2 us a feature is about two pixels and visibly
     travels instead. The amplitude came down with it, because a wider wobble
     reads as larger at the same height.

     Smoothstep between samples, so the interpolation leaves no corners. */
  const NOISE_STEP = 1.2;    // us between noise samples, about 2 px
  const NOISE_AMP = 0.015;
  const noiseAt = (t) => {
    const g = t / NOISE_STEP;
    const g0 = Math.floor(g);
    const f = g - g0;
    const s = f * f * (3 - 2 * f);
    return ((rnd(g0, 7) - 0.5) * (1 - s) + (rnd(g0 + 1, 7) - 0.5) * s) * NOISE_AMP;
  };

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

    /* The pedestal sits low and the gain is set for the sum, not for one pulse:
       the piled-up tails lift the working baseline to roughly 0.6 on their own,
       and a peak rides on top of that. Both numbers were retuned when the canvas
       stopped being a 16:10 panel in the lower half of the card and became the
       whole card, so the trace keeps to the bottom half and never climbs into
       the description. */
    /* Gain set from the signal's own distribution rather than by eye: over a
       long run the median sits at 0.58 and the 99th percentile at 1.43, so at
       this gain the quiet stretches hug the bottom of the card and the rare big
       pulse climbs to about halfway. That spread is what a calorimeter readout
       under pile-up actually looks like. */
    const base = h * 0.92;
    const amp = h * 0.22;

    const tShift = el * SPEED * US_PER_PX;      // us of signal scrolled past
    const tLeft = tShift;                       // time at the left edge
    const tRight = tShift + w * US_PER_PX;

    /* Recent events in full, per pixel: the shaped pulse and its slow tail
       together, rise and all. The cut is on elapsed time rather than on index,
       because the arrival jitter is ±55% of the mean gap and an index window
       would take events at inconsistent ages, which is the seam the recurrence
       below then has to match exactly. */
    const nearAt = (t) => {
      const i0 = Math.floor((t - FAST_SPAN - MEAN_GAP) / MEAN_GAP) - 1;
      const i1 = Math.ceil(t / MEAN_GAP) + 1;
      let v = 0;
      for (let i = i0; i <= i1; i++) {
        const dt = t - evTime(i);
        if (dt > 0 && dt <= FAST_SPAN) v += evAmp(i) * (shaped(dt) + tailTerm(dt));
      }
      return v;
    };

    /* The tail, as a one-pole recurrence walked across the panel.

       This was a coarse grid sampled every 24 px and interpolated, on the
       reasoning that a 500 us time constant cannot change much across the 15 us
       a few pixels cover. The decay cannot, but the sum can: each event switches
       its own tail on at its arrival time, so the sum has a step of up to 0.05
       at every event, one every 34 us. Linear interpolation smeared each of
       those steps across 24 px, and because the grid was pinned to the screen
       rather than to the signal, the smear slid through the steps as the panel
       scrolled. That is the wobble, and it showed in the valleys because the
       valleys are where the tail is the whole of the signal.

       A single decaying pole obeys T(t + dt) = T(t) * exp(-dt / tau) plus
       whatever switched on inside that step, so the whole row is one multiply
       per pixel off an exact seed at the left edge. No sampling, no
       interpolation, and cheaper than the grid it replaces.

       This sum is the pile-up. The baseline drift is drawn in nowhere: it falls
       out of adding the tails up. */
    const decay = Math.exp(-US_PER_PX / TAU_TAIL);

    /* Older than FAST_SPAN the rise is finished to within a part in a billion,
       so every one of these events is a plain decaying exponential and the
       whole row is one multiply per pixel off an exact seed. */
    let tail = 0;
    for (let i = Math.floor((tLeft - TAIL_SPAN) / MEAN_GAP); i <= Math.ceil(tLeft / MEAN_GAP); i++) {
      const dt = tLeft - evTime(i);
      if (dt > FAST_SPAN) tail += evAmp(i) * TAIL_W * Math.exp(-dt / TAU_TAIL);
    }

    /* Handovers, not arrivals. An event joins this sum at the pixel where it
       turns FAST_SPAN old and nearAt() lets go of it, so the two never hold the
       same event and never drop it between them. Sorted by time because the
       arrival jitter can put two events out of index order. */
    const handover = [];
    for (let i = Math.floor((tLeft - FAST_SPAN) / MEAN_GAP) - 2; i <= Math.ceil(tRight / MEAN_GAP) + 2; i++) {
      const th = evTime(i) + FAST_SPAN;
      if (th > tLeft && th <= tRight) handover.push([th, evTime(i), evAmp(i) * TAIL_W]);
    }
    handover.sort((p, q) => p[0] - q[0]);
    let hi = 0;

    /* The graticule, every 50 us. Tall enough to give the trace a screen to run
       on, and stopping well short of the top: a rule that reaches the head of
       the card turns the medium back into a boxed panel with a grid in it, which
       is the framing this card is trying to get out of. The mask over the medium
       fades their upper end for free. */
    ctx.strokeStyle = 'rgba(255,255,255,0.075)';
    ctx.lineWidth = 1;
    const step = 50;
    const tickTop = base - h * 0.44;
    for (let tk = Math.ceil(tLeft / step) * step; tk < tRight; tk += step) {
      const x = (tk - tShift) / US_PER_PX;
      ctx.beginPath(); ctx.moveTo(x, tickTop); ctx.lineTo(x, base + 3); ctx.stroke();
    }

    // pedestal
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(w, base); ctx.stroke();

    // the conditioned signal the digitiser sees
    ctx.beginPath();
    for (let px = 0; px <= w; px += 1) {
      const t = tShift + px * US_PER_PX;
      if (px) tail *= decay;
      while (hi < handover.length && handover[hi][0] <= t) {
        tail += handover[hi][2] * Math.exp(-(t - handover[hi][1]) / TAU_TAIL);
        hi++;
      }
      const v = nearAt(t) + tail + noiseAt(t);
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
   2c. Looping card video
   ------------------------------------------------------------------
   Two cards use this: the CGV geometry turning, and the aurora over the pine
   wood on the AURORA card. Both are cut the same way, forward then backward
   inside one file, so the native loop turns over without a seam.

   The file is not fetched until the card is close, and it only plays while it
   is on screen: a background loop still decoding in a tab nobody is looking at
   is a battery drain for no benefit. The poster stands in until the first frame
   is ready, and stays if the video never loads at all, which is also what a
   visitor who asked for reduced motion gets.
   ------------------------------------------------------------------ */
function videoLoop(video) {
  if (REDUCED) return;                     // poster only
  let armed = false;

  /* Up to two sources. data-src is where the file is served from; data-fallback
     is an optional copy inside the repository, small enough to pass the 2 MB
     guard, and it is what makes the card work in a local checkout and on the day
     the CDN is unreachable. A card with only data-src simply has the one URL. */
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

/* ------------------------------------------------------------------
   5. From the Lab
   ------------------------------------------------------------------
   Two lanes. On the left what the laboratory announced, on the right what it
   published, and neither is a footnote to the other.

   Everything on screen is read out of the slices of data/news.json and of
   data/publications.json: the dates, the titles, the covers, the venue a
   paper appeared in, the people who wrote it. Nothing is written by hand here
   except the lane labels, and those come out of the markup so i18n owns them.
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

/* Titles and venue names are the group's own data rather than visitor input,
   but they still go through innerHTML, and one ampersand in a journal name is
   enough to eat the rest of a row. */
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* Venue names reach 96 characters. Six of them carry the full name and the
   short one on either side of a dash, as in "10th International Symposium on
   Instrumentation Systems, Circuits, and Transducers - INSCIT 2026". Where that
   shape exists the short form is the one a reader recognises, and taking it
   also drops a dash the house style does not use. The rest are cut by CSS. */
function venue(pub) {
  const parts = String(pub.journal || '').split(/\s+[—–]\s+/);
  return parts[parts.length - 1].trim();
}

/* The first author in full, then how many more. Surname-only citation form
   would have to guess where a compound Brazilian surname begins, and it gets
   names like "Manhães de Andrade Filho" wrong more often than it gets them
   right. */
function authorLine(pub, moreTpl) {
  const list = pub.authors || [];
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  return list[0] + ' ' + moreTpl.replace('{n}', String(list.length - 1));
}

function renderLab(news, pubs) {
  const newsHost = document.getElementById('lab-news');
  const paperHost = document.getElementById('lab-papers');
  if (!newsHost || !paperHost) return;

  /* Labels are read back out of the hidden spans in the markup, so this holds
     no copies of four languages and follows a language change for free. */
  const t = (k, fb) => {
    const el = document.querySelector(`[data-i18n="${k}"]`);
    return (el && el.textContent.trim()) || fb;
  };

  // ---- the news lane: one story with its cover, then two more as rows
  if (news && news.length) {
    const lead = news[0];
    const lt = postText(lead);
    const cover = coverURL(lead);
    const rest = news.slice(1, 3).map((p) => {
      const pt = postText(p);
      return `
      <a class="ln-item" href="${esc(newsPostUrl(p, 'news/post.html'))}">
        <time class="ln-item-date" datetime="${esc(p.date)}">${esc(fmtDate(p.date))}</time>
        <span class="ln-item-title">${esc(pt.title)}</span>
      </a>`;
    }).join('');

    newsHost.removeAttribute('aria-busy');
    newsHost.innerHTML = `
      <a class="ln-lead" href="${esc(newsPostUrl(lead, 'news/post.html'))}">
        <div class="ln-media">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : ''}</div>
        <div class="ln-meta">
          <time datetime="${esc(lead.date)}">${esc(fmtDate(lead.date))}</time>
          <span class="ln-dot" aria-hidden="true"></span>
          <span>${esc(lead.category)}</span>
        </div>
        <h4 class="ln-title">${esc(lt.title)}</h4>
        <p class="ln-excerpt">${esc(lt.excerpt || '')}</p>
        <span class="ln-go"><span class="ln-go-t">${esc(t('home.latest.read', 'Read the story'))}</span><i class="ph ph-arrow-right" aria-hidden="true"></i></span>
      </a>${rest}`;
  }

  /* ---- the papers lane.
     Papers, not theses: a thesis is a different kind of work and the 32 of them
     belong on the About page. Sorting is by year alone, and Array#sort has been
     stable since ES2019, so papers sharing a year keep the order the file gives
     them, which is newest first. The old code sorted the whole file, theses
     included, and took one arbitrary 2026 entry out of the six that tie. */
  /* Works on either shape. data/home-papers.json arrives already filtered and
     sorted, and running the same filter over it again is a no-op; the fallback
     hands over the whole archive, where the filter is the thing that makes it
     usable. tools/build-data-slices.js applies exactly these rules, and the two
     have to stay in step. */
  const papers = (pubs || [])
    .filter((p) => p.type === 'journal' || p.type === 'conference')
    .slice()
    .sort((a, b) => Number(b.year) - Number(a.year))
    .slice(0, 4);

  const moreTpl = t('home.latest.authors_more', 'and {n} others');
  paperHost.removeAttribute('aria-busy');
  paperHost.innerHTML = papers.map((p) => {
    const who = authorLine(p, moreTpl);
    return `
      <a class="lp-item" href="${esc(publicationUrl(p) || 'publications.html')}">
        <div class="lp-meta">
          <span class="lp-year">${esc(p.year)}</span>
          <span class="lp-venue">${esc(venue(p))}</span>
        </div>
        <h4 class="lp-title">${esc(p.title)}</h4>
        ${who ? `<p class="lp-authors">${esc(who)}</p>` : ''}
      </a>`;
  }).join('');
}

async function fromTheLab() {
  if (!document.getElementById('lab-news')) return;
  const base = new URL('../../', import.meta.url).href;
  try {
    /* The slices, not the archives. news.json carries the full body of every
       post and publications.json all 147 papers; this section shows three
       headlines and four citations and reads a word of neither body nor
       archive. tools/build-data-slices.js writes the two small files, and the
       big ones stay as the fallback, so a stale slice costs bytes and never a
       blank section. */
    const grab = (slim, full) =>
      fetch(base + slim).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .catch((e) => {
          console.warn('[from the lab] no ' + slim + ', reading the whole file:', e);
          return fetch(base + full).then((r) => r.json());
        });

    const [news, pubs] = await Promise.all([
      grab('data/home-news.json', 'data/news.json'),
      /* The papers lane can survive without this, so a failure here does not
         take the news lane down with it, and it does not pass in silence
         either: an empty lane with no explanation is the kind of bug that goes
         unnoticed for months. */
      grab('data/home-papers.json', 'data/publications.json').catch((e) => {
        console.warn('[from the lab] no publications, the papers lane will be empty:', e);
        return [];
      }),
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

  /* Every looping video on a card, whichever card it belongs to. */
  document.querySelectorAll('.pc-media video').forEach(videoLoop);

  const hp = document.querySelector('[data-media="hits-pulse"]');
  if (hp) hitsPulse(hp);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
