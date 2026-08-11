/**
 * NIPS-CERN — About
 * ------------------------------------------------------------------
 * The three things on that page that are built rather than written: the
 * coordinator's card, the wall of eighteen people, and the mounting of the
 * collaboration graph.
 *
 * It used to be 260 lines of module inside about.html. Out here it is minified
 * like every other module on the site, cached under the same stamp, and the
 * page is markup again.
 *
 * ------------------------------------------------------------------
 * Why the wall looks the way it does
 * ------------------------------------------------------------------
 * What was here before was eighteen identical rounded cards, each with a 76px
 * circular photograph, a name, a role, two rounded chips and a pill reading
 * READ MORE. That is the shape a team section takes when nobody decides
 * anything about it, and it wasted the only material this page actually owns:
 * eighteen photographs of the people in it.
 *
 * So the photograph is the card. It fills the tile, and the name sits on a pane
 * of glass laid over the bottom of it, which is the one place on this page where
 * glass is doing what glass is for: there is something behind it worth blurring.
 *
 * The pill is gone. A tile that opens says so the way this site says everything
 * else — with colour as state. At rest every portrait is held down in
 * saturation, so eighteen photographs taken in eighteen places read as one wall;
 * under the pointer, one of them comes to full colour and lifts out of the
 * plane. Nothing else on the wall moves. The caret in the corner of the glass
 * is the only literal part, and it turns over when the record is open.
 */

import { t } from './i18n.js?v=a4d7854f36';
/* Never scrollIntoView({behavior:'smooth'}) on this site: Lenis is driving the
   scroll position from its own ticker and the two animations fight, which
   reads as no scroll at all. scrollToEl asks the library. */
import { scrollToEl } from './smooth-scroll.js?v=a4d7854f36';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROOT = new URL('../../', import.meta.url).href;
const LATTES = '<img src="' + ROOT + 'assets/icons/lattes_icon.svg" alt="" width="14" height="14" aria-hidden="true">';

/* Researchers, then the undergraduates. The coordinator is not in this list at
   all: that section is above, with the card the role earns. */
const ORDER = { researcher: 0, ic: 1 };

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const roleKey = (role) => 'about.team.roles.' + role;

/* What a role is called before the language file lands, and if it never does.
   team.json stores "ic" and "co_advisor"; printing those raw is what the markup
   fell back to before, and "ic" under a photograph is not a job title. */
const ROLE_EN = {
  coordinator: 'Coordinator',
  researcher: 'Researcher',
  advisor: 'Advisor',
  co_advisor: 'Co-advisor',
  ic: 'Undergraduate researcher',
  msc: 'MSc student',
  phd: 'PhD student',
};
const roleText = (role) => ROLE_EN[role] || role || '';

/* t() answers with the key itself until the language file has landed, and this
   module can render before that. So every generated label carries data-i18n,
   this walks the subtree it just wrote, and the same walk runs again whenever
   the language changes. One rule for the first paint and for the fifth switch. */
function localise(root) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val && val !== key) el.textContent = val;
  });
}

const json = (path) => fetch(ROOT + path).then((r) => (r.ok ? r.json() : null)).catch(() => null);

/* ------------------------------------------------------------------
   The coordinator
   ------------------------------------------------------------------ */
function coordinatorHTML(m, record) {
  const awards = (m.awards || []).map((a) => {
    if (a && typeof a === 'object') {
      return '<li class="cd-award"><span class="cd-award-year">' + esc(a.year) + '</span>'
        + '<span><span class="cd-award-title">' + a.title + '</span>'
        + '<span class="cd-award-body">' + esc(a.body) + '</span></span></li>';
    }
    return '<li class="cd-award"><span class="cd-award-year"></span><span class="cd-award-title">' + esc(a) + '</span></li>';
  }).join('');

  const links = [
    m.lattes && '<a href="' + esc(m.lattes) + '" target="_blank" rel="noopener" class="rd-ref">Lattes</a>',
    m.github && '<a href="' + esc(m.github) + '" target="_blank" rel="noopener" class="rd-ref">GitHub</a>',
    m.linkedin && '<a href="' + esc(m.linkedin) + '" target="_blank" rel="noopener" class="rd-ref">LinkedIn</a>',
  ].filter(Boolean).join('');

  return '<figure class="cd-portrait frame">'
    + (m.photo ? '<img src="' + esc(ROOT + m.photo) + '" alt="' + esc(m.name) + '" loading="lazy" decoding="async">' : '')
    + '</figure>'
    + '<div class="cd-body">'
    + (m.title ? '<p class="cd-title">' + esc(m.title) + '</p>' : '')
    + '<h3 class="cd-name">' + esc(m.name) + '</h3>'
    + '<p class="rt-role" data-i18n="' + roleKey(m.role) + '">' + esc(roleText(m.role)) + '</p>'
    + (record ? countHTML(record) : '')
    + '<p class="cd-bio">' + esc(m.bio) + '</p>'
    + (awards ? '<div class="rd-block"><p class="rd-label" data-i18n="about.team.awards">Awards</p>'
        + '<ul class="cd-awards">' + awards + '</ul></div>' : '')
    + (links ? '<div class="rd-links">' + links + '</div>' : '')
    + '</div>';
}

/* ------------------------------------------------------------------
   The wall
   ------------------------------------------------------------------ */
function cardHTML(m) {
  return '<button type="button" class="tm-card" data-member="' + esc(m.id) + '" aria-expanded="false">'
    + '<span class="tm-photo">'
    + (m.photo
      ? '<img src="' + esc(ROOT + m.photo) + '" alt="" loading="lazy" decoding="async">'
      : '<span class="tm-initial" aria-hidden="true">' + esc((m.name || '?').trim().charAt(0)) + '</span>')
    + '</span>'
    + '<span class="tm-plate glass">'
    + '<span class="tm-name">' + esc(m.name) + '</span>'
    + '<span class="rt-role" data-i18n="' + roleKey(m.role) + '">' + esc(roleText(m.role)) + '</span>'
    + '<i class="ph ph-caret-down tm-caret" aria-hidden="true"></i>'
    + '</span>'
    + '</button>';
}

/* The measured line, and only when there is something measured to put in it.
   It comes out of the same file the graph above is drawn from, so a person's
   count here and their dot up there are the same number by construction. Four
   of the eighteen have no line at all: they are undergraduate scholars who have
   not published yet, and a zero would be a statement where there is simply
   nothing to say. */
function countHTML(record) {
  if (!record || !record.w) return '';
  const years = record.f && record.l
    ? (record.f === record.l ? String(record.f) : record.f + '–' + record.l) : '';
  return '<p class="rd-count"><span class="rd-count-n">' + record.w + '</span>'
    + '<span data-i18n="about.team.works">works in the record</span>'
    + (years ? '<span class="rd-count-y">' + years + '</span>' : '') + '</p>';
}

function detailHTML(m, record) {
  const areas = (m.areas || []).map(esc).join('  ·  ');
  const awards = (m.awards || []).map((a) => {
    const year = a && typeof a === 'object' ? a.year : '';
    const title = a && typeof a === 'object' ? a.title : esc(a);
    return '<li class="rd-award"><span class="rd-award-year">' + esc(year) + '</span><span>' + title + '</span></li>';
  }).join('');
  const links = [
    m.lattes && '<a href="' + esc(m.lattes) + '" target="_blank" rel="noopener" class="rd-ref">' + LATTES + ' Lattes</a>',
    m.github && '<a href="' + esc(m.github) + '" target="_blank" rel="noopener" class="rd-ref">GitHub</a>',
    m.linkedin && '<a href="' + esc(m.linkedin) + '" target="_blank" rel="noopener" class="rd-ref">LinkedIn</a>',
  ].filter(Boolean).join('');

  const closeLabel = t('about.team.close');
  /* The coordinator's construction, one size down: the portrait a full column
     on the left at the tile's own 4:5, everything read beside it. Not a wide
     box with a thumbnail in the corner, which is the shape a record takes when
     nobody decides anything about it. */
  return '<button type="button" class="rd-close glass-btn" data-close aria-label="'
    + esc(closeLabel === 'about.team.close' ? 'Close' : closeLabel) + '">'
    + '<i class="ph ph-x" aria-hidden="true"></i></button>'
    + '<figure class="rd-side frame">'
    + (m.photo ? '<img src="' + esc(ROOT + m.photo) + '" alt="" loading="lazy" decoding="async">' : '')
    + '</figure>'
    + '<div class="rd-main">'
    + (m.title ? '<p class="rd-title">' + esc(m.title) + '</p>' : '')
    + '<p class="rd-name">' + esc(m.name) + '</p>'
    + '<p class="rt-role" data-i18n="' + roleKey(m.role) + '">' + esc(roleText(m.role)) + '</p>'
    + countHTML(record)
    + (m.bio ? '<p class="rd-bio">' + esc(m.bio) + '</p>' : '')
    + (areas ? '<div class="rd-block"><p class="rd-label" data-i18n="about.team.areas">Research areas</p>'
        + '<p class="rd-areas">' + areas + '</p></div>' : '')
    + (awards ? '<div class="rd-block"><p class="rd-label" data-i18n="about.team.awards">Awards</p>'
        + '<ul class="rd-awards">' + awards + '</ul></div>' : '')
    + (links ? '<div class="rd-links">' + links + '</div>' : '')
    + '</div>';
}

/* ------------------------------------------------------------------
   Opening a record
   ------------------------------------------------------------------
   In the grid, not over it. A modal is the wrong shape for a biography: it
   blacks out the page, takes the whole screen for one paragraph and puts the
   reader in a state they have to leave before they can look at anybody else.
   The record is inserted after the tile that was pressed and spans every
   column, so the rows below are pushed down and nothing is covered.
   ------------------------------------------------------------------ */
function mountRoster(grid, members, records) {
  const byId = new Map(members.map((m) => [m.id, m]));

  grid.innerHTML = members.map(cardHTML).join('');
  localise(grid);

  function close() {
    const open = grid.querySelector('.tm-detail');
    if (open) open.remove();
    grid.querySelectorAll('.tm-card.is-open').forEach((c) => {
      c.classList.remove('is-open');
      c.setAttribute('aria-expanded', 'false');
    });
  }

  function open(card, id, scroll) {
    const m = byId.get(id);
    const wasOpen = card.classList.contains('is-open');
    close();
    if (!m || wasOpen) return;
    const panel = document.createElement('div');
    panel.className = 'tm-detail glass';
    panel.innerHTML = detailHTML(m, records.get(id));
    card.insertAdjacentElement('afterend', panel);
    localise(panel);
    card.classList.add('is-open');
    card.setAttribute('aria-expanded', 'true');
    /* Only when it is not already on screen: a record that opens under your
       pointer should not also move the page out from under it. A click on a
       violet dot in the hero always scrolls, because the record it opened is
       three screens away and a panel that opens out of sight opened nothing.
       Through scrollToEl, not scrollIntoView: Lenis holds the scroll position
       and wins any fight with the browser's own smooth scrolling, which is
       why the first version of this "scrolled" and nothing moved. */
    const r = panel.getBoundingClientRect();
    if (scroll) {
      scrollToEl(card, -92);
    } else if (r.bottom > innerHeight) {
      scrollToEl(panel, -(innerHeight - Math.min(r.height + 24, innerHeight - 92)));
    }
  }

  grid.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { close(); return; }
    const card = e.target.closest('.tm-card[data-member]');
    if (card) open(card, card.getAttribute('data-member'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const card = grid.querySelector('.tm-card.is-open');
    if (!card) return;
    close();
    card.focus();
  });

  /* A dot in the graph above is a way into the record down here. */
  document.addEventListener('roster:open', (e) => {
    const id = e.detail && e.detail.id;
    const card = id && grid.querySelector('.tm-card[data-member="' + CSS.escape(id) + '"]');
    if (card) open(card, id, true);
  });

  /* The tilt. Five degrees, from where the pointer is inside the tile, written
     on the element itself with its own perspective() so it owes nothing to a
     parent: a perspective declared on the grid takes its vanishing point from
     the grid's centre, and the tiles in the outer columns then lean sideways
     instead of toward the reader. */
  if (!REDUCED && matchMedia('(hover: hover)').matches) {
    grid.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.tm-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'perspective(760px) rotateY(' + (x * 9).toFixed(2) + 'deg) rotateX('
        + (-y * 9).toFixed(2) + 'deg) translateZ(26px)';
    });
    grid.addEventListener('pointerout', (e) => {
      const card = e.target.closest('.tm-card');
      if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
    });
  }

  return { open, close };
}

/* ------------------------------------------------------------------
   Mounting the graph
   ------------------------------------------------------------------
   Three quarters of a screen of warning, the same ring the calorimeter viewer
   on the home page uses, and for the same reason: what is behind this import is
   188 KB of three.js, and a reader who never reaches the section should never
   pay for it. */
function mountNetwork(net) {
  const stage = document.getElementById('net-stage');
  const canvas = document.getElementById('net-canvas');
  if (!stage || !canvas) return;

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    import('./network.js?v=a4d7854f36').then(({ initNetwork }) =>
      initNetwork(canvas, { tip: document.getElementById('net-tip'), data: net })
    ).then((api) => {
      if (!api) { stage.classList.add('is-flat'); return; }
      stage.classList.add('is-live');
      import('./motion.js?v=a4d7854f36').then(({ whileVisible }) => whileVisible(stage, api.play, api.hold));
    }).catch(() => stage.classList.add('is-flat'));
  };

  if (!('IntersectionObserver' in window)) { start(); return; }
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { start(); io.disconnect(); }
  }, { rootMargin: '75%' });
  io.observe(stage);
}

/* Figures on the plate come from the file the graph is drawn from, so the plate
   can never claim a number the picture does not contain. */
function fillPlate(meta) {
  if (!meta) return;
  const set = (sel, value) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = value;
  };
  set('[data-net-people]', meta.people);
  set('[data-net-works]', meta.works);
  set('[data-net-links]', meta.links.toLocaleString());
  set('[data-net-span]', meta.from + '–' + meta.to);
}

/* ------------------------------------------------------------------ */
addEventListener('DOMContentLoaded', async () => {
  const [team, net] = await Promise.all([json('data/team.json'), json('data/collab-network.json')]);
  if (!team || !team.length) return;

  /* id -> {w, f, l}, for the people who appear in the graph. */
  const records = new Map();
  if (net && net.nodes) {
    for (const n of net.nodes) if (n.m) records.set(n.m, n);
  }
  fillPlate(net && net.meta);

  const coordinator = team.find((m) => m.role === 'coordinator');
  const card = document.getElementById('coordinator-card');
  if (coordinator && card) {
    card.innerHTML = coordinatorHTML(coordinator, records.get(coordinator.id));
    localise(card);
  }

  const grid = document.getElementById('team-grid');
  const members = team.filter((m) => m.role !== 'coordinator')
    .slice()
    .sort((a, b) => (ORDER[a.role] === undefined ? 9 : ORDER[a.role]) - (ORDER[b.role] === undefined ? 9 : ORDER[b.role]));
  if (grid && members.length) mountRoster(grid, members, records);

  document.addEventListener('langchange', () => {
    if (card) localise(card);
    if (grid) localise(grid);
    const panel = document.querySelector('.tm-detail');
    if (panel) localise(panel);
  });

  mountNetwork(net);
});
