export function registerViewerShortcuts({
  aboutOverlay,
  closeLayersPanel,
  closeSettingsPanel,
  enterCinema,
  exitCinema,
  getState,
  openSettingsPanel,
  resetCamera,
  setPinned,
  setPinnedR,
  slicer,
  toggleAllGhosts,
  toggleBeam,
}) {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.shiftKey) {
      switch (e.key.toUpperCase()) {
        case 'B':
          window.__cgvToggleBgPicker?.();
          return;
        case 'S':
          slicer.toggle();
          return;
        case 'K':
          document.getElementById('cluster-filter-toggle')?.click();
          return;
      }
      return;
    }

    const state = getState();
    switch (e.key.toUpperCase()) {
      case 'G':
        toggleAllGhosts();
        break;
      case 'B':
        toggleBeam();
        break;
      case 'R':
        resetCamera();
        break;
      case 'I':
        document.getElementById('btn-info').click();
        break;
      case 'C':
        state.cinemaMode ? exitCinema() : enterCinema();
        break;
      case 'M':
        document.getElementById('btn-panel').click();
        break;
      case 'E':
        setPinnedR(!state.rpanelPinned);
        break;
      case 'P':
        document.getElementById('btn-shot').click();
        break;
      case 'S':
        state.settingsPanelOpen ? closeSettingsPanel() : openSettingsPanel();
        break;
      case 'T':
        document.getElementById('ltog-tile').click();
        break;
      case 'L':
      case 'A':
        document.getElementById('ltog-lar').click();
        break;
      case 'H':
        document.getElementById('ltog-hec').click();
        break;
      case 'F':
        document.getElementById('ltog-fcal').click();
        break;
      case 'J':
        document.getElementById('btn-tracks').click();
        break;
      case 'K':
        document.getElementById('btn-cluster').click();
        break;
      case 'ESCAPE':
        if (slicer.isActive()) {
          slicer.disable();
          return;
        }
        if (state.cinemaMode) {
          exitCinema();
          return;
        }
        if (state.settingsPanelOpen) {
          closeSettingsPanel();
          return;
        }
        if (state.layersPanelOpen) {
          closeLayersPanel();
          return;
        }
        if (state.rpanelPinned) {
          setPinnedR(false);
          return;
        }
        if (document.getElementById('shot-overlay').classList.contains('open')) {
          document.getElementById('btn-shot-cancel').click();
          return;
        }
        if (state.panelPinned) {
          setPinned(false);
          return;
        }
        aboutOverlay.classList.remove('open');
        break;
    }
  });
}
