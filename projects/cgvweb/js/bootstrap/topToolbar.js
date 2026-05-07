// Wires the bottom-floating button row (view-level segmented control,
// jet-collection dropdown, About overlay). The Ghost / Cell Info / Unmatched
// Tracks / Jet Lines toggles previously here moved to the Helpers popover —
// see js/bootstrap/helpersPanel.js.

import { getViewLevel, setViewLevel, onViewLevelChange } from '../viewLevel.js';
import { getJetCollections, getActiveJetKey, setActiveJetKey, onJetStateChange } from '../jets.js';

export function setupTopToolbar({ resetCamera }) {
  document.getElementById('btn-reset').addEventListener('click', resetCamera);

  // View-level segmented control (1/2/3). Sync .on highlight on every click;
  // visibility logic for each level lives in visibility.js (cells, cluster lines)
  // and here (right-side panel header colour, label, visibility).
  const viewLevelEl = document.getElementById('view-level');
  const rpanel2 = document.getElementById('rpanel2');
  const tabLabel = document.getElementById('cluster-tab-label');
  const strak = document.getElementById('cluster-strak');
  const jetTrigger = document.getElementById('jet-coll-trigger');
  const jetLabel = document.getElementById('jet-coll-label');
  const jetMenu = document.getElementById('jet-coll-menu');

  // Panel skin per level: cluster (red) at L2, jet (cyan) at L3, hidden at L1.
  const PANEL_SKIN = {
    1: null,
    2: { label: 'Cluster', color: '#ff4400', gradFrom: '#661a00', gradTo: '#ff4400' },
    3: { label: 'Jet', color: '#ff8800', gradFrom: '#4a2900', gradTo: '#ff8800' },
  };
  function syncRightPanelSkin() {
    const lvl = getViewLevel();
    const skin = PANEL_SKIN[lvl];
    if (!skin) {
      if (rpanel2) rpanel2.style.display = 'none';
      if (jetTrigger) jetTrigger.style.display = 'none';
      closeJetMenu();
      return;
    }
    if (rpanel2) rpanel2.style.display = '';
    if (tabLabel) {
      tabLabel.textContent = skin.label;
      tabLabel.style.setProperty('--tab-col', skin.color);
    }
    if (strak)
      strak.style.background = `linear-gradient(to top, ${skin.gradFrom} 0%, ${skin.gradTo} 100%)`;
    // Dropdown only shows at level 3 and only when there's at least one
    // collection in the current event.
    if (jetTrigger) {
      const show = lvl === 3 && getJetCollections().length;
      jetTrigger.style.display = show ? '' : 'none';
      if (!show) closeJetMenu();
    }
  }

  // ── Custom dropdown logic ──────────────────────────────
  function closeJetMenu() {
    if (!jetMenu) return;
    jetMenu.classList.remove('open');
    if (jetTrigger) jetTrigger.setAttribute('aria-expanded', 'false');
  }

  function positionJetMenu() {
    if (!jetMenu || !jetTrigger) return;
    const br = jetTrigger.getBoundingClientRect();
    const mw = jetMenu.offsetWidth;
    const mh = jetMenu.offsetHeight;
    // Anchor the menu's top-right to the trigger's bottom-right, then
    // clamp so it never spills off-screen (top/left fallback handled too).
    let left = br.right - mw;
    let top = br.bottom + 6;
    left = Math.max(6, Math.min(left, window.innerWidth - mw - 6));
    if (top + mh > window.innerHeight - 6) {
      // Flip above the trigger if there isn't room below.
      top = Math.max(6, br.top - mh - 6);
    }
    jetMenu.style.left = `${left}px`;
    jetMenu.style.top = `${top}px`;
  }

  function openJetMenu() {
    if (!jetMenu || !jetTrigger) return;
    // Display first so we can measure, then position, then add .open
    // on the next frame to let the animation play from the start state.
    jetMenu.style.display = 'flex';
    jetMenu.style.visibility = 'hidden';
    positionJetMenu();
    jetMenu.style.visibility = '';
    requestAnimationFrame(() => {
      jetMenu.classList.add('open');
      jetTrigger.setAttribute('aria-expanded', 'true');
    });
  }

  // Re-populate the menu rows whenever the parsed jet collections change.
  // Keeps the trigger label in sync with the active key.
  function syncJetSelectOptions() {
    if (!jetMenu || !jetTrigger || !jetLabel) return;
    const colls = getJetCollections();
    const activeKey = getActiveJetKey();
    jetMenu.innerHTML = '';
    for (const c of colls) {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'jet-coll-opt';
      opt.setAttribute('role', 'option');
      opt.dataset.key = c.key;
      if (c.key === activeKey) {
        opt.classList.add('on');
        opt.setAttribute('aria-selected', 'true');
      }
      const name = document.createElement('span');
      name.className = 'jet-coll-opt-name';
      name.textContent = c.key;
      const count = document.createElement('span');
      count.className = 'jet-coll-opt-count';
      count.textContent = c.jets.length;
      opt.appendChild(name);
      opt.appendChild(count);
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveJetKey(c.key);
        closeJetMenu();
      });
      jetMenu.appendChild(opt);
    }
    // Update the trigger label with the active collection key.
    jetLabel.textContent = activeKey || '—';
    // If menu is open while options changed, re-clamp position.
    if (jetMenu.classList.contains('open')) positionJetMenu();
    syncRightPanelSkin();
  }
  if (jetTrigger && jetMenu) {
    jetTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (jetMenu.classList.contains('open')) closeJetMenu();
      else openJetMenu();
    });
    document.addEventListener('click', (e) => {
      if (!jetMenu.classList.contains('open')) return;
      if (e.target === jetMenu || jetMenu.contains(e.target)) return;
      closeJetMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && jetMenu.classList.contains('open')) closeJetMenu();
    });
    window.addEventListener('resize', () => {
      if (jetMenu.classList.contains('open')) positionJetMenu();
    });
    window.addEventListener(
      'scroll',
      () => {
        if (jetMenu.classList.contains('open')) positionJetMenu();
      },
      true,
    );
    onJetStateChange(syncJetSelectOptions);
    syncJetSelectOptions();
  }

  if (viewLevelEl) {
    const segBtns = viewLevelEl.querySelectorAll('.tseg-btn');
    const syncSeg = () => {
      const cur = getViewLevel();
      for (const b of segBtns) b.classList.toggle('on', Number(b.dataset.level) === cur);
    };
    for (const b of segBtns) {
      b.addEventListener('click', () => {
        setViewLevel(Number(b.dataset.level));
        syncSeg();
      });
    }
    syncSeg();
  }
  onViewLevelChange(syncRightPanelSkin);
  syncRightPanelSkin();

  const aboutOverlay = document.getElementById('about-overlay');
  document.getElementById('btn-about').addEventListener('click', () => {
    aboutOverlay.classList.add('open');
  });
  document
    .getElementById('btn-about-close')
    .addEventListener('click', () => aboutOverlay.classList.remove('open'));
  aboutOverlay.addEventListener('click', (e) => {
    if (e.target === aboutOverlay) aboutOverlay.classList.remove('open');
  });

  return { aboutOverlay };
}
