# The system

What the home page settled, written down so the next page does not have to
settle it again. Everything here is in `assets/css/main.css` and
`assets/js/`, loaded by every page already. Building a page is choosing from
this, not adding to it.

Read `CLAUDE.md` first if you have not. This is the how; that is the why.

---

## 1. The page

```html
<nav id="nav"></nav>                      <!-- built by main.js -->
<main id="main">
  <header class="page-hero">…</header>
  <section class="section seam" style="--seam-from:var(--bg-0)">
    <div class="container">…</div>
  </section>
</main>
<div id="supporters"></div>               <!-- built by main.js -->
<footer id="footer"></footer>             <!-- built by main.js -->
```

The navigation, the supporters bar and the footer are generated. A page that
writes its own copy of any of them has forked something there is one of.

**Bands, not boxes.** The page is a stack of full-width sections. A section
never draws its own background as a flat fill: `.seam` fades the previous
band's colour down through the top 200px of this one, so bands dissolve into
each other instead of butting up. `--seam-from` is the colour above.

```html
<section class="section seam" style="--seam-from:var(--bg-1)">
```

| Class | What it is |
|---|---|
| `.section` | A band. Vertical rhythm, nothing else. |
| `.seam` | The fade from the band above. Set `--seam-from`. |
| `.container` | The 1320px rail with fluid side padding. |
| `.container--narrow` | 680px. Running text. Legal pages, post bodies. |

Full-bleed is the exception, and it is spelled out: a stage that runs to the
window edge sets its own width rather than living in `.container`.

---

## 2. Type

Three faces, self-hosted, no third-party font origin.

- **Bodoni Moda** (`--font-serif`) — the wordmark and display headings. A
  didone on near-black needs mass: weight 600 and `opsz` pinned to 40, or the
  hairlines break up and the N's come apart into loose bars. Never leave
  `font-optical-sizing` to decide.
- **Geist** (`--font-sans`) — everything read.
- **IBM Plex Mono** (`--font-mono`) — measured things. Years, counts, spec
  values, language codes, venues. If a number was counted or measured, it is
  mono; if it is prose, it is not.

Sizes are fluid: `clamp(min, intercept + slope·vw, max)` interpolating 360 to
1440px. Never write a `px` font-size. The tokens run `--text-xs` to
`--text-7xl`, and spacing `--sp-1` to `--sp-24` on the same principle.

| Class | Use |
|---|---|
| `.display-lg` `.display-md` | Page and section headings. Serif. |
| `.heading-lg` `.heading-md` `.heading-sm` | Inside a section. Sans. |
| `.body-lg` `.body-base` `.body-sm` | Running text. |
| `.eyebrow` | The small label above a heading. Icon plus a word. |

---

## 3. Surface

`.glass` is a pane that takes its colour from what is behind it: white at 3.5%,
the background blurred and pushed in saturation, and a hairline brighter along
the top, which is what makes a flat rectangle read as something with thickness.

It is worth nothing over a flat fill. Use it on a gradient, on the starfield,
or over moving video. `.glass-btn` is the same thing for controls, and it drops
the filter, keeping the paint, because a control that blurs what is behind it
costs a compositor layer per button.

Tint and edge are overridable per instance, which is how five project cards get
five colours out of one component:

```css
--glass-tint:       /* the wash */
--glass-edge:       /* the hairline */
--glass-edge-hover: /* the hairline on hover */
```

---

## 4. Colour

`--brand` is the site's one accent. A page or a card may carry a colour of its
own in `--pc`, and everything in it derives from that with `color-mix`, so a
component is written once and tinted per instance:

```css
background: color-mix(in srgb, var(--pc) 22%, transparent);
color:      color-mix(in srgb, var(--pc) 62%, #ffffff);
```

Colour is state, not decoration. Anything shown in full colour should be
answering a question: which language is this, which project is this card,
where am I. The language flags are the worked example — held down by
saturation at rest, full colour for the one in use.

Never dim a mark with `opacity` when what you want is quiet. Fading toward the
background greys the whites and the edges go soft. Take the saturation out
instead: every edge survives and only the shouting stops.

---

## 5. Icons

`assets/css/icons.css`. Phosphor, self-hosted as CSS masks over `currentColor`,
plus three of the laboratory's own marks. 107 icons, 14 KB gzipped, no icon
webfont and no CDN.

```html
<i class="ph ph-arrow-right" aria-hidden="true"></i>
```

**No emoji anywhere.** If an icon is missing, regenerate the sheet with
`tools/build-icons.js` rather than reaching for an emoji or drawing an SVG by
hand.

---

## 6. Media

Any picture on the site sits in a frame that clips it. The frame owns the
proportion; the picture fills it.

```html
<div class="frame" data-drift-frame>
  <img src="…" alt="" loading="lazy" decoding="async">
</div>
```

```css
.frame { position: relative; overflow: hidden; aspect-ratio: 16/10; }
.frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
```

**`aspect-ratio`, not `flex: 1`.** `flex: 1` on a media box is not a
constraint: an image at `width: 100%` takes whatever height its ratio asks for,
and the cards exploded in height the first time this was tried.

**Hover zoom**, on every cover on the site, written the same way:

```css
.frame img { transition: transform var(--t-slow); }
.card:hover .frame img { transform: scale(1.04); }
```

An element that drifts with the scroll cannot also zoom on hover: GSAP writes
an inline `transform` on it every frame and no rule here can win. The separate
`scale` property composes in theory and did not hold up in Firefox. Pick one,
and prefer the zoom, because it is the one the reader asked for.

---

## 7. Motion

`assets/js/motion.js`. A page opts in by loading GSAP:

```html
<script src="assets/js/vendor/gsap.min.js?v=…" defer></script>
<script src="assets/js/vendor/ScrollTrigger.min.js?v=…" defer></script>
```

Then it declares, and nothing needs to be written in JavaScript:

```html
<div class="frame" data-drift-frame>
  <img data-drift="6">                <!-- 6% of its own height, both ways -->
</div>
<img data-drift="14" data-drift-in=".hero">   <!-- an explicit frame -->
<div data-drift-px="40">                       <!-- pixels, for a block -->
```

### Two rules that are not style preferences

**A thing may drift only if a frame clips it.** The first version moved every
band on the home page, seventeen layers of it. Read as a whole that is not
depth, it is instability, and running text is the worst case: a reader uses the
gap between a heading and its first line to know they belong together. It also
collided, because `yPercent` on a 700px grid is seventy pixels of unbounded
travel, and the projects heading ended up under its own cards. Inside a frame,
use percent. Outside one, pixels.

The trap in the percentage is that it is a share of the *element*, not of the
frame. A medium hung at 118% and drifted by 14 travels 16.5% of the frame with
9% of headroom, and then the far edge goes empty, which is the one thing this
must never do. Check every number against the headroom its CSS gives it:

| | headroom | travels |
|---|---|---|
| the sky | 22% | 20.2% |
| the calorimeter poster | 16% | 13.2% |
| card media | 7% | 6.8% |

**Animation never decides whether content is visible.** `gsap.from({opacity:0})`
writes `opacity:0` inline the moment the tween is built and clears it only when
the trigger fires. One trigger that does not fire and the section is blank with
no way for a reader to recover, which happened. Entrances are CSS —
`.fade-up`, `.fade-in`, `.stagger-children`, marked `.visible` by the observer
in main.js — with `revealFailsafe()` two seconds behind them. Everything in
motion.js animates transforms alone: if none of it runs, the page is exactly
what the stylesheet laid out.

### Smooth scrolling

`assets/js/smooth-scroll.js`, on every page, Lenis behind it. Anything that
moves the scroll position asks it — `scrollToTop()`, `scrollToEl()`,
`holdScroll()` — and never `behavior: 'smooth'`, which fights a library holding
the same position. Off under reduced motion and off on touch.

### Page transitions

Cross-document view transitions, declared in main.css, working everywhere they
are supported and degrading to a plain navigation where they are not. Firefox
does not support them yet, which includes Zen. Test in Chrome before believing
they are broken.

---

## 8. Playing media

Everything that moves runs only while it is on screen, and everything on the
projects grid answers to the one pause button. `whileVisible(el, play, hold)`
from motion.js is the general case.

Media resumes rather than restarts: a video keeps its `currentTime`, a CSS
animation is held with `animation-play-state`, and anything drawn from a clock
accumulates its own elapsed time, or it jumps forward when it comes back.

Every loop carries a poster, and the poster is real: the calorimeter poster is
a recorded event, so the section shows the instrument whether or not the file
arrives.

---

## 9. Writing

The full rules are in `CLAUDE.md`. The short version:

- English on GitHub. Site copy exists in four languages, each **written**, not
  translated. A sentence that reads like English with Portuguese words in it
  has failed.
- No em-dashes. No bold used for emphasis in running text.
- No emoji.
- No AI sentence shapes: "in today's fast-paced world", "it's not just X, it's
  Y", "delve", triads of adjectives, a closing sentence that restates the
  opening one.
- Real content. Numbers that were counted, examples that exist, names of things
  the laboratory actually built. If a section needs filler to look finished, it
  does not need the section.

i18n keys live in `data/i18n.json`, CRLF, two-space, no trailing newline. After
editing it, **run `node tools/build-data-slices.js`** — the pages fetch the
per-language slices, not that file, and the data guard fails the build if they
have drifted.

---

## 10. Infrastructure that will bite

- **Cache tokens.** Every URL the browser caches is listed in
  `.githooks/pre-commit`. A file that is not on that list has a frozen `?v=`
  and its changes never reach anyone; this has happened four times. Add new
  assets to the list, and nothing else: the CI guard reads that same list.
  Enable the hook once per clone with
  `git config core.hooksPath .githooks`.
- **CRLF.** The repository is CRLF throughout. Never run `sed -i` or
  `perl -pi` over a tracked file: it rewrites every line ending and produces a
  4000-line diff for a one-line change. Use an editor, or Node with explicit
  string replacement.
- **2 MB per file**, enforced in CI. Heavier media goes to the
  `nipscern-assets` repository and is served from `cdn.nipscern.com`, with a
  smaller fallback committed here so a local checkout still works.
- **`kristoffer/` is not part of this site.** It shares the domain and nothing
  else. It is excluded from the cache scheme. Do not touch it.
- **Critical CSS.** `index.html` inlines a copy of the hero rules and the
  view-transition opt-in. Change both, or the home page paints one thing and
  settles into another.
