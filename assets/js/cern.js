/**
 * NIPS-CERN — CERN & ATLAS page
 * ------------------------------------------------------------------
 * Two built things on this page.
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
 *
 * The pulse. The TileCal pulse as a figure, drawn from the published curve by
 * tools/build-tilecal-pulse.js and walked through step by step as the reader
 * scrolls the explanation beside it.
 *
 * A third thing used to be here: the LHC ring in the hero, drawn by three.js
 * over the Meyrin map. It came out on 2026-09-05. The code is in the history
 * of this file, and data/meyrin-map.json and tools/build-meyrin-map.js stay
 * in the repository for the day it is wanted back.
 */

import { ensureMotionLibs, initMotion } from './motion.js?v=301ab40fbd';

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
  mountDescent();
  mountPulse();
});
