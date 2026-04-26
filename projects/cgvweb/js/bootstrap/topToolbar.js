// Wires the bottom-floating button row (info / ghost / beam / reset)
// plus the About overlay open/close handlers.
//
// Owns the `showInfo` state because the only consumer outside this module
// is the hover tooltip, which we expose via getShowInfo().

import { getViewLevel, setViewLevel, onViewLevelChange } from '../viewLevel.js';
import { getJetCollections, getActiveJetKey, setActiveJetKey, onJetStateChange } from '../jets.js';

export function setupTopToolbar({ resetCamera, clearOutline, hideTooltip, toggleAllGhosts }) {
  let showInfo = true;

  const btnInfo = document.getElementById('btn-info');
  btnInfo.addEventListener('click', () => {
    showInfo = !showInfo;
    btnInfo.classList.toggle('on', showInfo);
    document
      .querySelector('#btn-info use')
      .setAttribute('href', showInfo ? '#i-eye' : '#i-eye-off');
    if (!showInfo) {
      clearOutline();
      hideTooltip();
    }
  });

  document.getElementById('btn-ghost').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAllGhosts();
  });

  document.getElementById('btn-reset').addEventListener('click', resetCamera);

  // View-level segmented control (1/2/3). Sync .on highlight on every click;
  // visibility logic for each level lives in visibility.js (cells, cluster lines)
  // and here (right-side panel header colour, label, visibility).
  const viewLevelEl = document.getElementById('view-level');
  const rpanel2 = document.getElementById('rpanel2');
  const tabLabel = document.getElementById('cluster-tab-label');
  const strak = document.getElementById('cluster-strak');
  const jetSelect = document.getElementById('jet-collection-select');

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
      if (jetSelect) jetSelect.style.display = 'none';
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
    if (jetSelect) {
      jetSelect.style.display = lvl === 3 && getJetCollections().length ? '' : 'none';
    }
  }

  // Re-populate the <option>s whenever the parsed jet collections change.
  // Keeps the user's selected key in sync via the jets module.
  function syncJetSelectOptions() {
    if (!jetSelect) return;
    const colls = getJetCollections();
    const activeKey = getActiveJetKey();
    jetSelect.innerHTML = '';
    for (const c of colls) {
      const opt = document.createElement('option');
      opt.value = c.key;
      opt.textContent = `${c.key}  (${c.jets.length})`;
      if (c.key === activeKey) opt.selected = true;
      jetSelect.appendChild(opt);
    }
    // Hidden when no collections; visibility itself driven by syncRightPanelSkin.
    syncRightPanelSkin();
  }
  if (jetSelect) {
    jetSelect.addEventListener('change', () => setActiveJetKey(jetSelect.value));
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

  return {
    getShowInfo: () => showInfo,
    aboutOverlay,
  };
}
