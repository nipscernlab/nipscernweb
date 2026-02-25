// ============================================================
//  CGV Web — tour.js
//  9-step guided tour. Steps 0, 1, 8 use the centered card;
//  steps 2-7 use a floating popover anchored to a UI element.
//
//  Bug fixed: removed duplicate id="tour-welcome-title" from
//  HTML (index.html now has a single id="tour-title" on the h2).
// ============================================================

const TOUR_DONE_KEY = 'cgv_tour_done';
const TOTAL_STEPS   = 9;

// ── DOM refs ──────────────────────────────────────────────────
const overlay    = document.getElementById('tour-overlay');
const card       = document.getElementById('tour-welcome');
const pop        = document.getElementById('tour-popover');
const spotlight  = document.getElementById('tour-spotlight');
const tourArrow  = document.getElementById('tour-arrow');

// Card elements
const cardStep  = document.getElementById('tour-step-indicator');
const cardTitle = document.getElementById('tour-title');   // single id, no duplicate
const cardBody  = document.getElementById('tour-body');

// Popover elements
const popStep   = document.getElementById('pop-step-indicator');
const popTitle  = document.getElementById('tour-pop-title');
const popBody   = document.getElementById('tour-pop-body');

// Buttons — card
const btnNext   = document.getElementById('tour-next');
const btnPrev   = document.getElementById('tour-prev');
const btnSkip   = document.getElementById('tour-skip');
const noShow    = document.getElementById('tour-no-show');

// Buttons — popover
const popNext   = document.getElementById('pop-next');
const popPrev   = document.getElementById('pop-prev');
const popSkip   = document.getElementById('pop-skip');

// ── Step definitions ──────────────────────────────────────────
const STEPS = [
  // 0 — Welcome (centered card)
  {
    type: 'card',
    title: 'Welcome to CGV Web',
    body: `
      <p>The <strong>Calorimeter Geometry Viewer</strong> is a browser-native 3D tool for
      exploring particle physics detector data from the <strong>ATLAS experiment</strong> at
      CERN's Large Hadron Collider — the world's highest-energy particle collider.</p>
      <p>This web edition is maintained by the <strong>NIPS Signal Processing Laboratory</strong>
      (Federal University of Juiz de Fora, Brazil), which has collaborated formally with
      ATLAS since 2008, developing energy-reconstruction algorithms for calorimeter readout.
      <a href="https://nipscern.com" target="_blank" style="color:var(--accent)">nipscern.com</a></p>
      <p>This short tour covers the main controls. Press <strong>Next</strong> to continue,
      or <strong>Skip tour</strong> to go straight to the viewer.</p>
    `,
  },

  // 1 — Load sample data (centered card)
  {
    type: 'card',
    title: 'No data file? Load a sample event.',
    body: `
      <p>CGV Web reads ATLAS calorimeter XML event files. If you don't have one, you can
      load a <strong>synthetic sample event</strong> generated in the browser — it contains
      a hadronic jet in TileCal, an electromagnetic shower in the LAr barrel, and diffuse
      HEC activity, giving you a realistic starting point for exploring all controls.</p>
      <button class="tour-load-btn" id="tour-load-sample" type="button">
        Load Sample Event
      </button>
      <p style="margin-top:14px;font-size:0.78rem;color:var(--text-muted)">
        You can also drag-and-drop your own XML file onto the canvas at any time.
      </p>
    `,
  },

  // 2 — 3D Navigation (popover → canvas)
  {
    type: 'pop', target: '#gl-canvas', side: 'top',
    title: '3D Navigation',
    body: `
      <strong>Left drag</strong> — orbit the detector<br>
      <strong>Right drag</strong> — pan the camera<br>
      <strong>Scroll</strong> — zoom in / out<br><br>
      The camera uses cinematic damping for smooth, fluid movement.
      Try pressing <kbd>F</kbd> to enter full-screen Cinema mode.
    `,
  },

  // 3 — Energy threshold (popover → rail)
  {
    type: 'pop', target: '#energy-rail', side: 'left',
    title: 'Energy Threshold Slider',
    body: `
      This colour scale represents the full energy range of the loaded event.
      Drag the white handle <strong>upward</strong> to set a minimum visible energy —
      cells below the threshold are hidden, suppressing electronic noise and revealing
      only the energetic physics objects (jets, EM showers, etc.).
    `,
  },

  // 4 — Sub-detector filters (popover → left panel)
  {
    type: 'pop', target: '#geometry-panel', side: 'right',
    title: 'Sub-detector Filters',
    body: `
      Toggle <strong>TileCal</strong> (hadronic barrel), <strong>HEC</strong>
      (hadronic end-cap), and <strong>LAr EM</strong> (electromagnetic) independently.
      Hover tooltips and filter controls only apply to cells that are currently visible —
      hiding a sub-detector suppresses both its rendering and its tooltip data.
    `,
  },

  // 5 — Z-Axis slice (popover → left panel)
  {
    type: 'pop', target: '#geometry-panel', side: 'right',
    title: 'Z-Axis Slice',
    body: `
      The <strong>Z-Axis Slice</strong> slider hides cells beyond a chosen depth along
      the beam axis, cutting into the detector layer by layer. Drag left to progressively
      reveal the inner structure — useful for exposing the EM accordion layers or the
      HEC wheels behind TileCal.
    `,
  },

  // 6 — Wireframe (popover → left panel)
  {
    type: 'pop', target: '#geometry-panel', side: 'right',
    title: 'Wireframe Mode',
    body: `
      Switch to <strong>Wireframe</strong> rendering to see through all cell surfaces.
      This lightweight mode draws only cell edges, making it easy to count layers,
      inspect geometry without occlusion, and identify sparse regions of the detector.
      Shortcut: <kbd>W</kbd>.
    `,
  },

  // 7 — Tools row (popover → top bar)
  {
    type: 'pop', target: '.tb-actions', side: 'bottom',
    title: 'Top Bar Actions',
    body: `
      <strong>Knowledge Tree</strong> — open the educational panel about ATLAS and CERN<br>
      <strong>Cinema mode</strong> — fullscreen auto-rotation, hides all UI (<kbd>F</kbd>)<br>
      <strong>Snapshot</strong> — download a 4K PNG of the current view<br>
      <strong>Reset</strong> — clear data and return to the ghost reference geometry
    `,
  },

  // 8 — Finish (centered card)
  {
    type: 'card',
    title: 'You\'re ready.',
    body: `
      <p>You now know the core controls. Load your own event data or explore the sample
      to see the calorimeter in action.</p>
      <p>For deeper context about the ATLAS detector, open the <strong>Knowledge Tree</strong>
      (the graph icon in the top bar) — it covers TileCal, HEC, and the LAr EM accordion
      with technical specifications and references.</p>
      <p>Official resources:&ensp;
        <a href="https://atlas.cern" target="_blank" style="color:var(--accent)">atlas.cern</a>
        &ensp;·&ensp;
        <a href="https://nipscern.com/projects/cgvweb" target="_blank" style="color:var(--accent)">nipscern.com/projects/cgvweb</a>
      </p>
    `,
  },
];

// ── State ─────────────────────────────────────────────────────
let current = 0;

// ── Spotlight ─────────────────────────────────────────────────
function showSpot(el) {
  if (!el) { spotlight.classList.remove('visible'); return; }
  const r = el.getBoundingClientRect(), P = 6;
  Object.assign(spotlight.style, {
    left: `${r.left - P}px`, top: `${r.top - P}px`,
    width: `${r.width + P * 2}px`, height: `${r.height + P * 2}px`,
  });
  spotlight.classList.add('visible');
}
function hideSpot() { spotlight.classList.remove('visible'); }

// ── Popover positioning ───────────────────────────────────────
function positionPop(targetEl, side) {
  pop.classList.add('visible');
  tourArrow.className = 'pop-arrow';

  const r  = targetEl.getBoundingClientRect();
  const W  = pop.offsetWidth  || 300;
  const H  = pop.offsetHeight || 220;
  const G  = 18;
  let left, top;

  switch (side) {
    case 'right':  left = r.right + G;         top = r.top + r.height / 2 - H / 2; tourArrow.classList.add('arrow-left');   break;
    case 'left':   left = r.left - W - G;       top = r.top + r.height / 2 - H / 2; tourArrow.classList.add('arrow-right');  break;
    case 'bottom': left = r.left + r.width / 2 - W / 2; top = r.bottom + G;         tourArrow.classList.add('arrow-top');    break;
    default:       left = r.left + r.width / 2 - W / 2; top = r.top - H - G;        tourArrow.classList.add('arrow-bottom'); break;
  }

  const VW = window.innerWidth, VH = window.innerHeight;
  left = Math.max(12, Math.min(left, VW - W - 12));
  top  = Math.max(12, Math.min(top,  VH - H - 12));
  pop.style.left = `${left}px`;
  pop.style.top  = `${top}px`;
}

// ── Render a step ─────────────────────────────────────────────
function render(idx) {
  const step  = STEPS[idx];
  const label = `Step ${idx + 1} / ${TOTAL_STEPS}`;
  const isLast = idx === TOTAL_STEPS - 1;

  cardStep.textContent = label;
  popStep.textContent  = label;

  // Prev button: hide on first step
  btnPrev.style.display = idx === 0 ? 'none' : 'flex';
  popPrev.style.display = idx === 0 ? 'none' : 'flex';

  // Next/Finish label
  const nextLabel = isLast ? 'Finish' : 'Next →';
  btnNext.textContent = nextLabel;
  popNext.textContent = isLast ? '✓' : '→';

  if (step.type === 'card') {
    // ── Show centered card ─────────────────────────────────
    card.style.display = 'block';
    card.style.opacity = '1';
    pop.classList.remove('visible');
    hideSpot();

    // Inject content — these IDs now exist correctly in HTML
    cardTitle.textContent = step.title;
    cardBody.innerHTML    = step.body;

    // Wire the in-tour sample loader (step 1 only)
    const sampleBtn = document.getElementById('tour-load-sample');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        document.getElementById('dz-sample-btn')?.click();
        setTimeout(() => go(idx + 1), 700);
      }, { once: true });
    }
  } else {
    // ── Show floating popover ──────────────────────────────
    card.style.display = 'none';

    popTitle.textContent = step.title;
    popBody.innerHTML    = step.body;

    const targetEl = document.querySelector(step.target);
    requestAnimationFrame(() => {
      positionPop(targetEl || document.body, step.side || 'right');
      if (targetEl) showSpot(targetEl);
      else hideSpot();
    });
  }
}

// ── Navigation ────────────────────────────────────────────────
function go(idx) {
  if (idx < 0 || idx >= TOTAL_STEPS) return;
  current = idx;
  render(idx);
}

function next() { current < TOTAL_STEPS - 1 ? go(current + 1) : end(); }
function prev() { current > 0 && go(current - 1); }

// ── Start / End ───────────────────────────────────────────────
function start(from = 0) {
  // Ensure the card is visible before rendering (display:none is the default CSS)
  card.style.display = 'none';
  pop.classList.remove('visible');

  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  go(from);
}

function end() {
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  card.style.display = 'none';
  pop.classList.remove('visible');
  hideSpot();

  if (noShow?.checked) localStorage.setItem(TOUR_DONE_KEY, '1');
}

// ── Event listeners ───────────────────────────────────────────
btnNext.addEventListener('click', next);
btnPrev.addEventListener('click', prev);
btnSkip.addEventListener('click', end);
popNext.addEventListener('click', next);
popPrev.addEventListener('click', prev);
popSkip.addEventListener('click', end);

document.addEventListener('keydown', e => {
  if (!overlay.classList.contains('active')) return;
  if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
  if (e.key === 'Escape')     { e.preventDefault(); end();  }
});

window.addEventListener('resize', () => {
  if (!overlay.classList.contains('active')) return;
  const step = STEPS[current];
  if (step?.type === 'pop') {
    const el = document.querySelector(step.target);
    if (el) { positionPop(el, step.side); showSpot(el); }
  }
});

// ── Public API ────────────────────────────────────────────────
window.cgvTour = { start, end, isActive: () => overlay.classList.contains('active') };

// ── Auto-start ────────────────────────────────────────────────
function initTour() {
  if (localStorage.getItem(TOUR_DONE_KEY) === '1') return;
  const params = new URLSearchParams(window.location.search);
  if (params.has('file') || params.has('camX')) return;
  // Small delay — let renderer initialise and fonts load
  setTimeout(() => start(0), 900);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTour);
} else {
  initTour();
}