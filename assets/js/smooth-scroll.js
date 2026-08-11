/**
 * NIPS-CERN — Smooth scrolling
 * ------------------------------------------------------------------
 * Lenis, self-hosted in assets/js/vendor. The library reads the wheel and key
 * events itself and moves the window a little behind where the input asked for,
 * so a scroll arrives instead of jumping. It is one line of setup and the rest
 * of this file is the site meeting it halfway.
 *
 * Why not `html { scroll-behavior: smooth }`, which is free:
 * it was in main.css and came out. The browser's own smoothing animates the
 * scroll position over several frames while ScrollTrigger reads that position
 * every frame, and the two fought; the symptom was a parallax that worked on
 * the way down the home page and gave up on the way back. Lenis exists because
 * it drives that same position from a single ticker that animation can be hung
 * off, which is exactly what the wiring below does.
 *
 * Where it does not run:
 *   - prefers-reduced-motion. Smoothing is motion the visitor did not ask for.
 *   - touch. Lenis leaves it alone by default and so do we: phones already have
 *     momentum scrolling, tuned by the platform, and replacing it with a
 *     JavaScript approximation is how a site starts feeling like it lags.
 *
 * Everything here degrades to a plain scroll. If the import fails, or the file
 * is missing from a checkout, the page scrolls the way it always did.
 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis = null;

/* Public surface, used by the three places on the site that move the scroll
   position themselves. Each works with or without Lenis running, so no call
   site has to know whether the import succeeded. */

/** Scroll to the top, or to an element, however the page is currently scrolled. */
export function scrollToTop() {
  if (lenis) { lenis.scrollTo(0); return; }
  window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
}

/**
 * Scroll an element into view. `offset` is in pixels and is usually negative,
 * to clear the fixed navigation bar.
 */
export function scrollToEl(el, offset = 0) {
  if (!el) return;
  if (lenis) { lenis.scrollTo(el, { offset }); return; }
  el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
}

/**
 * Hold and release the scroll. The mobile menu sets `overflow: hidden` on the
 * body, which stops the document scrolling but says nothing to a library that
 * is driving the scroll position from a ticker: without this the page went on
 * moving underneath the open menu.
 */
export function holdScroll(on) {
  if (!lenis) return;
  if (on) lenis.stop(); else lenis.start();
}

export function initSmoothScroll() {
  if (REDUCED) return;
  /* Coarse pointer means touch, and touch keeps the platform's own momentum. */
  if (matchMedia('(pointer: coarse)').matches) return;

  import('./vendor/lenis.mjs?v=7af9a938d4').then(({ default: Lenis }) => {
    lenis = new Lenis({
      /* Higher is snappier. The default 0.1 leaves the page still settling well
         after the wheel has stopped, which on a site with a fixed navigation and
         a lot of scroll-driven work reads as lag rather than as smoothness. */
      lerp: 0.12,
      wheelMultiplier: 1,
      /* Off. See the note at the top of the file. */
      syncTouch: false,
      /* We drive the frames ourselves, below, so that ScrollTrigger and Lenis
         run off one clock rather than two. */
      autoRaf: false,
    });

    /* The anchor case. Lenis owns the scroll position, so a same-page #link
       handled by the browser would jump while Lenis believed the page was
       elsewhere. Routing it through scrollTo keeps one authority over the
       position, and the offset is the fixed navigation plus the breathing room
       :target already reserves in CSS. */
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const navH = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--nav-h')) || 64;
      /* The skip link goes straight there. It exists so a keyboard user can get
         past the navigation in one keystroke, and half a second of gliding is
         the opposite of that. */
      const instant = a.classList.contains('skip-link');
      lenis.scrollTo(target, { offset: -(navH + 24), immediate: instant });
      history.pushState(null, '', id);
      /* Following an anchor natively moves focus to the target, and preventing
         the default took that away: the skip link scrolled the page and left
         the next Tab back at the top of the navigation. */
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });

    /* One clock. GSAP already runs a ticker for every animation on the page, so
       Lenis is stepped from it rather than from a requestAnimationFrame of its
       own, and ScrollTrigger is updated from Lenis rather than from the scroll
       event. That ordering is the whole reason this works where the CSS
       property did not: position is written, then read, once per frame, in that
       order.
       lagSmoothing(0) because GSAP otherwise skips ahead after a long frame to
       keep animations on schedule, and a scroll position that jumps to catch up
       is the one thing smooth scrolling exists to prevent.
       Without GSAP on the page (every page but the home), Lenis keeps its own
       frame loop and nothing else needs to know. */
    const gsap = window.gsap;
    const ST = window.ScrollTrigger;
    if (gsap && ST) {
      lenis.on('scroll', ST.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }).catch(() => { /* plain scrolling, which is what the page had before */ });
}
