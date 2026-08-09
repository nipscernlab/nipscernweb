/**
 * NIPS-CERN — Motion
 * ------------------------------------------------------------------
 * The scroll behaviour the home page worked out, available to every page by
 * writing an attribute instead of by editing this file.
 *
 * It was a list of hard-coded selectors inside home.js: the starfield, the
 * calorimeter poster, the artwork in each card. That is fine for one page and
 * it is the reason no other page has any of it, since adding a second page
 * meant adding a second list, and a third meant a third.
 *
 * So the page declares and this executes:
 *
 *   <div class="frame" data-drift-frame>
 *     <img data-drift="6">                     drifts 6% as the frame passes
 *   </div>
 *
 *   <img data-drift="14" data-drift-in=".hero">   an explicit trigger
 *   <div data-drift-px="40">                      pixels, for a whole block
 *
 * ------------------------------------------------------------------
 * The rule about where drift is allowed
 * ------------------------------------------------------------------
 * A thing may drift only if a frame clips it.
 *
 * The first version of this moved every band on the home page: each heading at
 * one rate, the content under it at another, seventeen layers from the hero to
 * the sponsors. Read as a whole that is not depth, it is instability. Running
 * text is the worst case, because a reader uses the gap between a heading and
 * its first line to know the two belong together, and a gap that keeps changing
 * while you read takes that away. It also collided: yPercent on a 700px grid is
 * seventy pixels of unbounded travel, and the projects heading ended up
 * underneath its own cards.
 *
 * A clipping frame bounds the travel, makes reaching a neighbour impossible,
 * and is what parallax physically is: a view through an opening onto something
 * further away.
 *
 * The unit follows from that. Inside a frame, percent, because it is a share of
 * the medium and whatever leaves the frame is cut off. Outside one, pixels,
 * because a percentage of a tall block is a distance nobody chose. The trap in
 * the percentage is that it is a share of the element and not of the frame: a
 * medium hung at 118% of its frame and drifted by 14 travels 16.5% of the frame
 * with 9% of headroom to do it in, and then the far edge goes empty, which is
 * the one thing this effect must never do. Every number written into a page has
 * to be read against the headroom its CSS gives it.
 *
 * ------------------------------------------------------------------
 * The rule about visibility
 * ------------------------------------------------------------------
 * Animation never decides whether content is visible.
 *
 * The cards were once revealed with gsap.from({opacity: 0}), which writes
 * opacity:0 inline the moment the tween is built and clears it only when the
 * trigger fires. One trigger that does not fire, for any reason, and the
 * section is blank with no way for a reader to recover. Entrances are CSS, they
 * have a failsafe below, and everything here animates transforms alone: if none
 * of it runs, the page is exactly what the stylesheet already laid out.
 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------
   Entrances
   ------------------------------------------------------------------
   .fade-up / .fade-in / .stagger-children sit at opacity 0 until an observer
   marks them .visible. main.js owns that observer; this is the net under it. */
export function revealFailsafe(ms = 2000) {
  setTimeout(() => {
    document.querySelectorAll('.fade-up, .fade-in, .stagger-children').forEach((el) => {
      el.classList.add('visible');
    });
  }, ms);
}

/* ------------------------------------------------------------------
   Run a thing only while it is on screen
   ------------------------------------------------------------------
   Every medium on the site goes through here or through the projects-grid
   version in home.js. A loop still decoding in a tab nobody is looking at is
   battery for nothing. */
export function whileVisible(el, play, hold, margin = '120px') {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { play(); return; }
  let on = false;
  new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting === on) return;
      on = e.isIntersecting;
      if (on) play(); else hold();
    });
  }, { rootMargin: margin }).observe(el);
}

/* ------------------------------------------------------------------
   Scroll choreography
   ------------------------------------------------------------------ */
export function initMotion() {
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  if (!gsap || !ST || REDUCED) return null;
  gsap.registerPlugin(ST);

  /* Refresh, which is most of what makes this survive a real page.
     Start positions are measured once, and the fonts, the lazily-loaded images,
     the injected cards and the video all change the height of the document
     after that first pass, which leaves every trigger below the fold measuring
     against a layout that no longer exists. That was the bug where scrolling to
     the bottom and back up found the parallax dead. Fixed timers did not cover
     it; watching the height covers all of them and anything added later. */
  addEventListener('load', () => ST.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());

  let lastH = 0, pending = 0;
  new ResizeObserver(() => {
    const h = document.documentElement.scrollHeight;
    if (Math.abs(h - lastH) < 4) return;
    lastH = h;
    clearTimeout(pending);
    pending = setTimeout(() => ST.refresh(), 150);
  }).observe(document.body);

  /* No custom scroller. An earlier version passed document.scrollingElement on
     the theory that overflow-x:hidden on html and body would confuse the
     measurements; it did the opposite, because naming a scroller puts
     ScrollTrigger into the mode it keeps for scrolling containers, and only the
     trigger sitting at scroll position zero went on working. The window is the
     scroller, which is the default, so it goes unsaid. */

  const drift = (el, opts) => gsap.fromTo(el, opts.from, {
    ...opts.to,
    ease: 'none',
    scrollTrigger: {
      trigger: opts.trigger,
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.5,
      invalidateOnRefresh: true,
    },
  });

  /* The frame an element drifts inside: whatever it says, or the nearest thing
     marked as one, or its own parent. Anything that clips can be a frame; the
     attribute only says which one to measure against, since a tween scrubbed
     over an image measures the image and not the opening it moves in. */
  const frameOf = (el) => {
    const named = el.getAttribute('data-drift-in');
    if (named) return document.querySelector(named) || el.parentElement;
    return el.closest('[data-drift-frame]') || el.parentElement || el;
  };

  document.querySelectorAll('[data-drift]').forEach((el) => {
    const pct = parseFloat(el.getAttribute('data-drift'));
    if (!pct) return;
    drift(el, { from: { yPercent: pct }, to: { yPercent: -pct }, trigger: frameOf(el) });
  });

  /* Pixels, for a block that is not inside a frame. Bounded by construction:
     forty pixels is forty pixels whatever the block turns out to be, where a
     percentage of a tall one is a distance nobody chose. */
  document.querySelectorAll('[data-drift-px]').forEach((el) => {
    const px = parseFloat(el.getAttribute('data-drift-px'));
    if (!px) return;
    drift(el, { from: { y: px }, to: { y: -px }, trigger: frameOf(el) });
  });

  return ST;
}

/* Stop one element drifting and give back its compositor layer. For media that
   is replaced by something heavier once it loads: a scrubbed tween writing a
   transform every frame onto an element nobody can see, while the thing that
   replaced it is busy on the same main thread, is work with a cost and no
   effect. The calorimeter poster is the case this exists for. */
export function stopDrift(el) {
  if (!el || !window.gsap) return;
  window.gsap.getTweensOf(el).forEach((t) => {
    if (t.scrollTrigger) t.scrollTrigger.kill();
    t.kill();
  });
  el.style.willChange = 'auto';
}
