import { fmtMev } from './utils.js';

function fmtGev(v) {
  return v.toFixed(2) + ' GeV';
}

function parseMevInput(s) {
  s = s.trim().toLowerCase();
  if (!s || s === 'all') return -Infinity;
  const g = s.match(/^([\d.]+)\s*gev$/i);
  if (g) return parseFloat(g[1]) * 1000;
  const m = s.match(/^([\d.]+)\s*(mev)?$/i);
  if (m) return parseFloat(m[1]);
  return null;
}

function ratioFromPtr(e, trackEl) {
  const rect = trackEl.getBoundingClientRect();
  return (
    1 -
    Math.max(0, Math.min(1, ((e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top) / rect.height))
  );
}

export function setupDetectorPanels({
  TILE_SCALE,
  LAR_SCALE,
  FCAL_SCALE,
  HEC_SCALE,
  applyThreshold,
  applyFcalThreshold,
  applyTrackThreshold,
  applyClusterThreshold,
  sidebarControls,
  state,
}) {
  const TAB_IDS = ['tile', 'lar', 'fcal', 'hec', 'track'];
  const rpanelWrap = document.getElementById('rpanel-wrap');

  function switchTab(det) {
    const tabs = [...TAB_IDS];
    const pc = document.getElementById('pane-cluster');
    if (pc && pc.parentElement && pc.parentElement.id === 'rpanel') tabs.push('cluster');
    tabs.forEach((id) => {
      const pane = document.getElementById('pane-' + id);
      const tab = document.getElementById('tab-' + id);
      if (pane) pane.style.display = id === det ? 'flex' : 'none';
      if (tab) tab.classList.toggle('on', id === det);
    });
  }

  function makeDetSlider(
    trackId,
    thumbId,
    inputId,
    getThr,
    setThr,
    maxMev,
    maxLblId,
    minLblId,
    onApply = applyThreshold,
  ) {
    const track = document.getElementById(trackId);
    const thumb = document.getElementById(thumbId);
    const input = document.getElementById(inputId);
    const maxLbl = maxLblId ? document.getElementById(maxLblId) : null;
    const minLbl = minLblId ? document.getElementById(minLblId) : null;
    let minMev = 0;
    let drag = false;

    // Slider semantics: bottom (ratio=0) snaps to -Infinity = "show all";
    // anywhere above the bottom maps linearly to [minMev, maxMev].
    const fromRatio = (r) => (r <= 0 ? -Infinity : minMev + (maxMev - minMev) * r);

    function updateUI(mev) {
      const span = maxMev - minMev;
      const ratio =
        isFinite(mev) && span > 0 && mev > minMev
          ? Math.max(0, Math.min(1, (mev - minMev) / span))
          : 0;
      thumb.style.top = (1 - ratio) * 100 + '%';
      if (document.activeElement !== input)
        input.value = isFinite(mev) && mev > minMev ? fmtMev(mev) : '';
    }

    track.addEventListener('pointerdown', (e) => {
      drag = true;
      rpanelWrap.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
      setThr(fromRatio(ratioFromPtr(e, track)));
      updateUI(getThr());
      onApply();
    });
    track.addEventListener('pointermove', (e) => {
      if (!drag) return;
      setThr(fromRatio(ratioFromPtr(e, track)));
      updateUI(getThr());
      onApply();
    });
    ['pointerup', 'pointercancel'].forEach((eventName) => {
      track.addEventListener(eventName, () => {
        drag = false;
        rpanelWrap.classList.remove('dragging');
      });
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
    input.addEventListener('blur', () => {
      const value = parseMevInput(input.value);
      if (value !== null) {
        const clamped = value === -Infinity ? value : Math.max(minMev, Math.min(maxMev, value));
        setThr(clamped);
        onApply();
      }
      updateUI(getThr());
    });

    function update(newMinMev, newMaxMev) {
      minMev = newMinMev;
      maxMev = newMaxMev;
      if (maxLbl) maxLbl.textContent = fmtMev(newMaxMev);
      if (minLbl) minLbl.textContent = fmtMev(newMinMev);
      updateUI(getThr());
    }

    return { updateUI, update };
  }

  function makeTrackPtSlider(trackId, thumbId, inputId, maxLblId, minLblId) {
    const trackEl = document.getElementById(trackId);
    const thumbEl = document.getElementById(thumbId);
    const inputEl = document.getElementById(inputId);
    const maxLblEl = document.getElementById(maxLblId);
    const minLblEl = document.getElementById(minLblId);
    let drag = false;

    function updateUI() {
      const span = state.getTrackPtMaxGev() - state.getTrackPtMinGev();
      const ratio =
        span > 0
          ? Math.max(0, Math.min(1, (state.getThrTrackGev() - state.getTrackPtMinGev()) / span))
          : 0;
      thumbEl.style.top = (1 - ratio) * 100 + '%';
      if (document.activeElement !== inputEl) {
        inputEl.value =
          state.getThrTrackGev() > state.getTrackPtMinGev() + 1e-9
            ? fmtGev(state.getThrTrackGev())
            : '';
      }
    }

    function setFromRatio(ratio) {
      const span = state.getTrackPtMaxGev() - state.getTrackPtMinGev();
      state.setThrTrackGev(
        ratio <= 0 ? state.getTrackPtMinGev() : state.getTrackPtMinGev() + span * ratio,
      );
      updateUI();
      applyTrackThreshold();
    }

    trackEl.addEventListener('pointerdown', (e) => {
      drag = true;
      rpanelWrap.classList.add('dragging');
      trackEl.setPointerCapture(e.pointerId);
      setFromRatio(ratioFromPtr(e, trackEl));
    });
    trackEl.addEventListener('pointermove', (e) => {
      if (drag) setFromRatio(ratioFromPtr(e, trackEl));
    });
    ['pointerup', 'pointercancel'].forEach((eventName) => {
      trackEl.addEventListener(eventName, () => {
        drag = false;
        rpanelWrap.classList.remove('dragging');
      });
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') inputEl.blur();
    });
    inputEl.addEventListener('blur', () => {
      const value = inputEl.value.trim().toLowerCase();
      if (!value || value === 'all') {
        state.setThrTrackGev(state.getTrackPtMinGev());
      } else {
        const gev = value.match(/^([\d.]+)\s*gev$/i);
        const parsed = gev ? parseFloat(gev[1]) : parseFloat(value);
        if (isFinite(parsed)) {
          state.setThrTrackGev(
            Math.max(state.getTrackPtMinGev(), Math.min(state.getTrackPtMaxGev(), parsed)),
          );
        }
      }
      updateUI();
      applyTrackThreshold();
    });

    function update(minGev, maxGev) {
      state.setTrackPtMinGev(minGev);
      state.setTrackPtMaxGev(maxGev);
      state.setThrTrackGev(2);
      if (maxLblEl) maxLblEl.textContent = fmtGev(maxGev);
      if (minLblEl) minLblEl.textContent = fmtGev(minGev);
      updateUI();
    }

    return { updateUI, update };
  }

  function makeClusterEtSlider(trackId, thumbId, inputId, maxLblId, minLblId) {
    const trackEl = document.getElementById(trackId);
    const thumbEl = document.getElementById(thumbId);
    const inputEl = document.getElementById(inputId);
    const maxLblEl = document.getElementById(maxLblId);
    const minLblEl = document.getElementById(minLblId);
    let drag = false;

    function updateUI() {
      const span = state.getClusterEtMaxGev() - state.getClusterEtMinGev();
      const ratio =
        span > 0
          ? Math.max(
              0,
              Math.min(1, (state.getThrClusterEtGev() - state.getClusterEtMinGev()) / span),
            )
          : 0;
      thumbEl.style.top = (1 - ratio) * 100 + '%';
      if (document.activeElement !== inputEl) {
        inputEl.value =
          state.getThrClusterEtGev() > state.getClusterEtMinGev() + 1e-9
            ? fmtGev(state.getThrClusterEtGev())
            : '';
      }
    }

    function setFromRatio(ratio) {
      if (!state.getClusterFilterEnabled()) return;
      const span = state.getClusterEtMaxGev() - state.getClusterEtMinGev();
      state.setThrClusterEtGev(
        ratio <= 0 ? state.getClusterEtMinGev() : state.getClusterEtMinGev() + span * ratio,
      );
      updateUI();
      applyClusterThreshold();
    }

    trackEl.addEventListener('pointerdown', (e) => {
      drag = true;
      rpanelWrap.classList.add('dragging');
      trackEl.setPointerCapture(e.pointerId);
      setFromRatio(ratioFromPtr(e, trackEl));
    });
    trackEl.addEventListener('pointermove', (e) => {
      if (drag) setFromRatio(ratioFromPtr(e, trackEl));
    });
    ['pointerup', 'pointercancel'].forEach((eventName) => {
      trackEl.addEventListener(eventName, () => {
        drag = false;
        rpanelWrap.classList.remove('dragging');
      });
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') inputEl.blur();
    });
    inputEl.addEventListener('blur', () => {
      if (!state.getClusterFilterEnabled()) {
        updateUI();
        return;
      }
      const value = inputEl.value.trim().toLowerCase();
      if (!value || value === 'all') {
        state.setThrClusterEtGev(state.getClusterEtMinGev());
      } else {
        const gev = value.match(/^([\d.]+)\s*gev$/i);
        const parsed = gev ? parseFloat(gev[1]) : parseFloat(value);
        if (isFinite(parsed)) {
          state.setThrClusterEtGev(
            Math.max(state.getClusterEtMinGev(), Math.min(state.getClusterEtMaxGev(), parsed)),
          );
        }
      }
      updateUI();
      applyClusterThreshold();
    });

    function update(minGev, maxGev) {
      state.setClusterEtMinGev(minGev);
      state.setClusterEtMaxGev(maxGev);
      state.setThrClusterEtGev(Math.max(3, minGev));
      if (maxLblEl) maxLblEl.textContent = fmtGev(maxGev);
      if (minLblEl) minLblEl.textContent = fmtGev(minGev);
      updateUI();
    }

    return { updateUI, update };
  }

  function syncClusterFilterToggle() {
    const btn = document.getElementById('cluster-filter-toggle');
    const pane = document.getElementById('pane-cluster');
    const input = document.getElementById('cluster-thr-input');
    if (!btn || !pane) return;
    btn.classList.toggle('on', state.getClusterFilterEnabled());
    btn.setAttribute('aria-checked', state.getClusterFilterEnabled() ? 'true' : 'false');
    btn.textContent = state.getClusterFilterEnabled() ? 'On' : 'Off';
    pane.classList.toggle('cluster-filter-disabled', !state.getClusterFilterEnabled());
    if (input) input.disabled = !state.getClusterFilterEnabled();
  }

  const tileSlider = makeDetSlider(
    'tile-strak',
    'tile-sthumb',
    'tile-thr-input',
    state.getThrTileMev,
    state.setThrTileMev,
    TILE_SCALE,
    'tile-sval-max',
    'tile-sval-min',
  );
  const larSlider = makeDetSlider(
    'lar-strak',
    'lar-sthumb',
    'lar-thr-input',
    state.getThrLArMev,
    state.setThrLArMev,
    LAR_SCALE,
    'lar-sval-max',
    'lar-sval-min',
  );
  const fcalSlider = makeDetSlider(
    'fcal-strak',
    'fcal-sthumb',
    'fcal-thr-input',
    state.getThrFcalMev,
    state.setThrFcalMev,
    FCAL_SCALE,
    'fcal-sval-max',
    'fcal-sval-min',
    applyFcalThreshold,
  );
  const hecSlider = makeDetSlider(
    'hec-strak',
    'hec-sthumb',
    'hec-thr-input',
    state.getThrHecMev,
    state.setThrHecMev,
    HEC_SCALE,
    'hec-sval-max',
    'hec-sval-min',
  );
  const trackPtSlider = makeTrackPtSlider(
    'track-strak',
    'track-sthumb',
    'track-thr-input',
    'track-sval-max',
    'track-sval-min',
  );
  const clusterEtSlider = makeClusterEtSlider(
    'cluster-strak',
    'cluster-sthumb',
    'cluster-thr-input',
    'cluster-sval-max',
    'cluster-sval-min',
  );

  function initDetPanel(hasTile, hasLAr, hasHec, hasTracks, hasFcal) {
    tileSlider.updateUI(state.getThrTileMev());
    larSlider.updateUI(state.getThrLArMev());
    fcalSlider.updateUI(state.getThrFcalMev());
    hecSlider.updateUI(state.getThrHecMev());
    clusterEtSlider.updateUI();
    syncClusterFilterToggle();
    sidebarControls.setPinnedR(true);
    if (hasTile) switchTab('tile');
    else if (hasLAr) switchTab('lar');
    else if (hasFcal) switchTab('fcal');
    else if (hasHec) switchTab('hec');
    else if (hasTracks) switchTab('track');
  }

  TAB_IDS.forEach((id) => {
    document.getElementById('tab-' + id).addEventListener('click', () => switchTab(id));
  });
  document.getElementById('tab-cluster').addEventListener('click', () => switchTab('cluster'));
  document.getElementById('cluster-filter-toggle').addEventListener('click', () => {
    state.setClusterFilterEnabled(!state.getClusterFilterEnabled());
    syncClusterFilterToggle();
    applyClusterThreshold();
  });

  switchTab('tile');
  tileSlider.updateUI(state.getThrTileMev());
  larSlider.updateUI(state.getThrLArMev());
  fcalSlider.updateUI(state.getThrFcalMev());
  hecSlider.updateUI(state.getThrHecMev());

  return {
    switchTab,
    initDetPanel,
    syncClusterFilterToggle,
    tileSlider,
    larSlider,
    fcalSlider,
    hecSlider,
    trackPtSlider,
    clusterEtSlider,
  };
}
