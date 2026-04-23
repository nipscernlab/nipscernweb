export function setupSidebarControls({
  canvas,
  getCinemaMode,
  getTourMode,
  onDisableTourMode,
  onEnableTourMode,
  t,
  updateCollisionHud,
}) {
  const panelEl = document.getElementById('panel');
  const panelEdge = document.getElementById('panel-edge');
  const rpanelWrap = document.getElementById('rpanel-wrap');
  const rpanelEdge = document.getElementById('rpanel-edge');
  const btnRpanel = document.getElementById('btn-rpanel');
  const settingsPanel = document.getElementById('settings-panel');
  const btnSettings = document.getElementById('btn-settings');
  const btnPin = document.getElementById('btn-pin');
  const btnPanel = document.getElementById('btn-panel');
  const hintsToggle = document.getElementById('stog-hints');
  const autoOpenToggle = document.getElementById('stog-autopen');
  const tourToggle = document.getElementById('stog-tour');
  const btnTip = document.getElementById('btn-tip');
  const mobileMQ = window.matchMedia('(orientation: landscape) and (max-height: 520px)');

  let panelPinned = true;
  let panelHovered = false;
  let rpanelPinned = true;
  let rpanelHovered = false;
  let settingsPanelOpen = false;
  let hintsEnabled = true;
  let autoOpenEnabled = true;

  function syncLeftPanel() {
    document.body.classList.toggle('panel-unpinned', !panelPinned);
    panelEl.classList.toggle('collapsed', !panelPinned);
    btnPin.classList.toggle('on', panelPinned);
    document.querySelector('#pin-icon use').setAttribute('href', panelPinned ? '#i-pin' : '#i-pin-off');
    btnPin.dataset.tip = t(panelPinned ? 'tip-pin' : 'tip-panel');
    btnPanel.classList.toggle('on', panelPinned);
    updateCollisionHud();
  }

  function syncRightPanel() {
    const open = rpanelPinned || rpanelHovered;
    rpanelWrap.classList.toggle('collapsed', !open);
    btnRpanel.classList.toggle('on', rpanelPinned);
    document.body.classList.toggle('rpanel-unpinned', !rpanelPinned);
  }

  function setPinned(value) {
    panelPinned = value;
    syncLeftPanel();
  }

  function setPinnedR(value) {
    rpanelPinned = value;
    if (value) rpanelHovered = false;
    syncRightPanel();
  }

  function openSettingsPanel() {
    settingsPanelOpen = true;
    settingsPanel.classList.add('open');
    btnSettings.classList.add('on');
    const br = btnSettings.getBoundingClientRect();
    requestAnimationFrame(() => {
      const pw = settingsPanel.offsetWidth || 290;
      const ph = settingsPanel.offsetHeight || 320;
      let left = br.left + br.width / 2 - pw / 2;
      let top = br.top - ph - 10;
      left = Math.max(6, Math.min(left, window.innerWidth - pw - 6));
      top = Math.max(6, top);
      settingsPanel.style.left = left + 'px';
      settingsPanel.style.top = top + 'px';
    });
  }

  function closeSettingsPanel() {
    settingsPanelOpen = false;
    settingsPanel.classList.remove('open');
    btnSettings.classList.remove('on');
  }

  function syncAutoOpenUi() {
    autoOpenToggle.classList.toggle('on', autoOpenEnabled);
    autoOpenToggle.setAttribute('aria-checked', autoOpenEnabled);
    panelEdge.style.pointerEvents = autoOpenEnabled ? '' : 'none';
    rpanelEdge.style.pointerEvents = autoOpenEnabled ? '' : 'none';
  }

  function syncHintsUi() {
    hintsToggle.classList.toggle('on', hintsEnabled);
    hintsToggle.setAttribute('aria-checked', hintsEnabled);
    btnTip.style.display = hintsEnabled ? '' : 'none';
  }

  function syncTourUi() {
    if (!tourToggle) return;
    const tourMode = getTourMode();
    tourToggle.classList.toggle('on', tourMode);
    tourToggle.setAttribute('aria-checked', tourMode ? 'true' : 'false');
  }

  btnPin.addEventListener('click', () => setPinned(!panelPinned));
  panelEdge.addEventListener('mouseenter', () => {
    if (!panelPinned && autoOpenEnabled) {
      panelEl.classList.remove('collapsed');
      panelHovered = true;
    }
  });
  panelEl.addEventListener('mouseleave', () => {
    if (!panelPinned && panelHovered) {
      panelEl.classList.add('collapsed');
      panelHovered = false;
    }
  });
  canvas.addEventListener('click', () => {
    if (!panelPinned && panelHovered) {
      panelEl.classList.add('collapsed');
      panelHovered = false;
    }
    if (!rpanelPinned && rpanelHovered) {
      rpanelHovered = false;
      syncRightPanel();
    }
  });
  btnPanel.addEventListener('click', () => {
    if (!panelPinned && panelHovered) {
      panelHovered = false;
      setPinned(true);
      return;
    }
    setPinned(!panelPinned);
  });

  rpanelEdge.addEventListener('mouseenter', () => {
    if (!rpanelPinned && autoOpenEnabled) {
      rpanelHovered = true;
      syncRightPanel();
    }
  });
  rpanelWrap.addEventListener('mouseleave', () => {
    if (!rpanelPinned && rpanelHovered) {
      rpanelHovered = false;
      syncRightPanel();
    }
  });
  btnRpanel.addEventListener('click', e => {
    e.stopPropagation();
    setPinnedR(!rpanelPinned);
  });

  (function setupEdgeTaps() {
    function tapOpener(el, openFn) {
      let sx = 0;
      let sy = 0;
      let st = 0;
      let tracking = false;
      el.addEventListener('touchstart', e => {
        if (!mobileMQ.matches) return;
        const touch = e.touches[0];
        sx = touch.clientX;
        sy = touch.clientY;
        st = Date.now();
        tracking = true;
      }, { passive: true });
      el.addEventListener('touchend', e => {
        if (!tracking) return;
        tracking = false;
        const touch = e.changedTouches[0];
        const dx = Math.abs(touch.clientX - sx);
        const dy = Math.abs(touch.clientY - sy);
        const dt = Date.now() - st;
        if (dt <= 350 && dx <= 12 && dy <= 12) {
          openFn();
          e.preventDefault();
        }
      });
      el.addEventListener('click', () => {
        if (mobileMQ.matches) openFn();
      });
    }
    tapOpener(panelEdge, () => setPinned(true));
    tapOpener(rpanelEdge, () => setPinnedR(true));
  })();

  btnSettings.addEventListener('click', e => {
    e.stopPropagation();
    settingsPanelOpen ? closeSettingsPanel() : openSettingsPanel();
  });
  document.addEventListener('click', () => {
    if (settingsPanelOpen) closeSettingsPanel();
  });
  settingsPanel.addEventListener('click', e => e.stopPropagation());

  hintsToggle.addEventListener('click', () => {
    hintsEnabled = !hintsEnabled;
    syncHintsUi();
  });

  autoOpenToggle.addEventListener('click', () => {
    autoOpenEnabled = !autoOpenEnabled;
    syncAutoOpenUi();
  });

  if (tourToggle) {
    syncTourUi();
    tourToggle.addEventListener('click', () => {
      const next = !getTourMode();
      localStorage.setItem('cgv-tour-mode', next ? '1' : '0');
      if (next) onEnableTourMode();
      else onDisableTourMode();
      syncTourUi();
    });
  }

  setPinnedR(false);
  if (window.innerWidth < 640 || mobileMQ.matches) setPinned(false);
  syncHintsUi();
  syncAutoOpenUi();

  return {
    closeSettingsPanel,
    getState() {
      return {
        hintsEnabled,
        mobileMQ,
        panelPinned,
        rpanelPinned,
        settingsPanelOpen,
      };
    },
    isHintsEnabled() {
      return hintsEnabled;
    },
    openSettingsPanel,
    setPinned,
    setPinnedR,
  };
}
