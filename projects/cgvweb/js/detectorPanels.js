import { fmtMev } from './utils.js';
import { getViewLevel, onViewLevelChange } from './viewLevel.js';
import { getActiveJetCollection, onJetStateChange } from './jets.js';
import { getLastTaus } from './particles.js';
import { t } from './i18n/index.js';

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
  applyJetThreshold,
  sidebarControls,
  state,
}) {
  const TAB_IDS = ['tile', 'lar', 'fcal', 'hec', 'track'];
  const rpanelWrap = document.getElementById('rpanel-wrap');

  // Shared floating popup for "type the threshold" — opens on dblclick over
  // any slider track. The per-slider input element is gone (HTML is leaner;
  // the slider thumb + sval-min/max labels still encode the value's position
  // within its range). Each slider passes its own commit-from-string + a
  // pre-fill string (current value formatted) + placeholder.
  /** @type {((raw: string) => void) | null} */
  let _popupCommit = null;
  let _popupCancelled = false;
  const _popup = document.createElement('div');
  _popup.id = 'thr-popup';
  _popup.hidden = true;
  _popup.innerHTML = '<input type="text" autocomplete="off" spellcheck="false">';
  document.body.appendChild(_popup);
  const _popupInput = /** @type {HTMLInputElement} */ (_popup.querySelector('input'));
  function _closePopup(commit) {
    if (commit && _popupCommit && !_popupCancelled) _popupCommit(_popupInput.value);
    _popupCommit = null;
    _popupCancelled = false;
    _popup.hidden = true;
  }
  _popupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      _popupInput.blur();
    } else if (e.key === 'Escape') {
      _popupCancelled = true;
      _popupInput.blur();
    }
  });
  _popupInput.addEventListener('blur', () => _closePopup(true));
  /**
   * @param {HTMLElement} anchor       slider track to position the popup against
   * @param {string} currentValue      pre-fill (current threshold formatted)
   * @param {(raw: string) => void} commit  parse + apply the typed string
   * @param {string} placeholder       hint text for the empty input
   */
  function openThrPopup(anchor, currentValue, commit, placeholder) {
    _popupCommit = commit;
    _popupCancelled = false;
    _popupInput.value = currentValue ?? '';
    _popupInput.placeholder = placeholder ?? '';
    const r = anchor.getBoundingClientRect();
    // Position to the LEFT of the slider — sliders live on the right edge of
    // the viewport (rpanel), so floating left keeps the popup on-screen and
    // doesn't cover the slider track itself.
    _popup.style.right = window.innerWidth - r.left + 8 + 'px';
    _popup.style.left = 'auto';
    _popup.style.top = r.top + r.height / 2 - 14 + 'px';
    _popup.hidden = false;
    requestAnimationFrame(() => {
      _popupInput.focus();
      _popupInput.select();
    });
  }

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
    getThr,
    setThr,
    maxMev,
    maxLblId,
    minLblId,
    onApply = applyThreshold,
  ) {
    const track = document.getElementById(trackId);
    const thumb = document.getElementById(thumbId);
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
    // Double-click → open the shared float popup so the user can type the
    // threshold instead of dragging the slider for fine values.
    track.addEventListener('dblclick', () => {
      const cur = getThr();
      const display = isFinite(cur) && cur > minMev ? fmtMev(cur) : '';
      openThrPopup(
        track,
        display,
        (raw) => {
          const value = parseMevInput(raw);
          if (value !== null) {
            const clamped = value === -Infinity ? value : Math.max(minMev, Math.min(maxMev, value));
            setThr(clamped);
            onApply();
            updateUI(getThr());
          }
        },
        t('thr-placeholder'),
      );
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

  function makeTrackPtSlider(trackId, thumbId, maxLblId, minLblId) {
    const trackEl = document.getElementById(trackId);
    const thumbEl = document.getElementById(thumbId);
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
    trackEl.addEventListener('dblclick', () => {
      const cur = state.getThrTrackGev();
      const display = cur > state.getTrackPtMinGev() + 1e-9 ? fmtGev(cur) : '';
      openThrPopup(
        trackEl,
        display,
        (raw) => {
          const value = raw.trim().toLowerCase();
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
        },
        t('thr-placeholder-gev'),
      );
    });

    function update(minGev, maxGev) {
      state.setTrackPtMinGev(minGev);
      state.setTrackPtMaxGev(maxGev);
      if (maxLblEl) maxLblEl.textContent = fmtGev(maxGev);
      if (minLblEl) minLblEl.textContent = fmtGev(minGev);
      updateUI();
    }

    return { updateUI, update };
  }

  function makeClusterEtSlider(trackId, thumbId, maxLblId, minLblId) {
    const trackEl = document.getElementById(trackId);
    const thumbEl = document.getElementById(thumbId);
    const maxLblEl = document.getElementById(maxLblId);
    const minLblEl = document.getElementById(minLblId);
    let drag = false;

    // Polymorphic ops bundle: cluster mode at level 2, jet mode at level 3.
    // Returns the same shape so updateUI / setFromRatio / blur logic works
    // unchanged. Outside levels 2 and 3 the slider is hidden anyway.
    const CLUSTER_OPS = {
      getMin: () => state.getClusterEtMinGev(),
      getMax: () => state.getClusterEtMaxGev(),
      getThr: () => state.getThrClusterEtGev(),
      setThr: (v) => state.setThrClusterEtGev(v),
      apply: applyClusterThreshold,
    };
    const JET_OPS = {
      getMin: () => state.getJetEtMinGev(),
      getMax: () => state.getJetEtMaxGev(),
      getThr: () => state.getThrJetEtGev(),
      setThr: (v) => state.setThrJetEtGev(v),
      apply: applyJetThreshold,
    };
    function currentOps() {
      return getViewLevel() === 3 ? JET_OPS : CLUSTER_OPS;
    }

    function updateUI() {
      const ops = currentOps();
      const min = ops.getMin();
      const max = ops.getMax();
      const span = max - min;
      const ratio = span > 0 ? Math.max(0, Math.min(1, (ops.getThr() - min) / span)) : 0;
      thumbEl.style.top = (1 - ratio) * 100 + '%';
      if (maxLblEl) maxLblEl.textContent = fmtGev(max);
      if (minLblEl) minLblEl.textContent = fmtGev(min);
    }

    function setFromRatio(ratio) {
      const ops = currentOps();
      const min = ops.getMin();
      const span = ops.getMax() - min;
      ops.setThr(ratio <= 0 ? min : min + span * ratio);
      updateUI();
      ops.apply();
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
    trackEl.addEventListener('dblclick', () => {
      const ops = currentOps();
      const cur = ops.getThr();
      const display = cur > ops.getMin() + 1e-9 ? fmtGev(cur) : '';
      openThrPopup(
        trackEl,
        display,
        (raw) => {
          const opsLive = currentOps();
          const value = raw.trim().toLowerCase();
          if (!value || value === 'all') {
            opsLive.setThr(opsLive.getMin());
          } else {
            const gev = value.match(/^([\d.]+)\s*gev$/i);
            const parsed = gev ? parseFloat(gev[1]) : parseFloat(value);
            if (isFinite(parsed)) {
              opsLive.setThr(Math.max(opsLive.getMin(), Math.min(opsLive.getMax(), parsed)));
            }
          }
          updateUI();
          opsLive.apply();
        },
        t('thr-placeholder-gev'),
      );
    });

    // Level switch: redraw the slider against the new mode's bounds + value.
    onViewLevelChange(updateUI);
    // Active jet collection changed (new event or user picked another from the
    // dropdown): recompute jet ET min/max from the active list AND from τ
    // candidates (they share this slider — see applyTauPtThreshold), then
    // refresh. processXml.js draws τs *before* setJetCollections so that
    // getLastTaus is already populated by the time this listener fires.
    onJetStateChange(() => {
      const c = getActiveJetCollection();
      let min = Infinity;
      let max = -Infinity;
      if (c) {
        for (const j of c.jets) {
          if (j.etGev < min) min = j.etGev;
          if (j.etGev > max) max = j.etGev;
        }
      }
      for (const t of getLastTaus()) {
        if (!Number.isFinite(t.ptGev)) continue;
        if (t.ptGev < min) min = t.ptGev;
        if (t.ptGev > max) max = t.ptGev;
      }
      if (!isFinite(min)) {
        min = 0;
        max = 1;
      }
      state.setJetEtMinGev(Math.max(0, min));
      state.setJetEtMaxGev(max);
      if (getViewLevel() === 3) updateUI();
    });

    // Cluster-only update path kept for processXml.js (which only knows about
    // cluster ET ranges). Jet bounds flow through the onJetStateChange hook
    // above. Both paths converge on updateUI for the active mode.
    function update(minGev, maxGev) {
      state.setClusterEtMinGev(minGev);
      state.setClusterEtMaxGev(maxGev);
      if (getViewLevel() !== 3) updateUI();
    }

    return { updateUI, update };
  }

  const tileSlider = makeDetSlider(
    'tile-strak',
    'tile-sthumb',
    state.getThrTileMev,
    state.setThrTileMev,
    TILE_SCALE,
    'tile-sval-max',
    'tile-sval-min',
  );
  const larSlider = makeDetSlider(
    'lar-strak',
    'lar-sthumb',
    state.getThrLArMev,
    state.setThrLArMev,
    LAR_SCALE,
    'lar-sval-max',
    'lar-sval-min',
  );
  const fcalSlider = makeDetSlider(
    'fcal-strak',
    'fcal-sthumb',
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
    state.getThrHecMev,
    state.setThrHecMev,
    HEC_SCALE,
    'hec-sval-max',
    'hec-sval-min',
  );
  const trackPtSlider = makeTrackPtSlider(
    'track-strak',
    'track-sthumb',
    'track-sval-max',
    'track-sval-min',
  );
  const clusterEtSlider = makeClusterEtSlider(
    'cluster-strak',
    'cluster-sthumb',
    'cluster-sval-max',
    'cluster-sval-min',
  );

  function initDetPanel(hasTile, hasLAr, hasHec, hasTracks, hasFcal) {
    tileSlider.updateUI(state.getThrTileMev());
    larSlider.updateUI(state.getThrLArMev());
    fcalSlider.updateUI(state.getThrFcalMev());
    hecSlider.updateUI(state.getThrHecMev());
    clusterEtSlider.updateUI();
    sidebarControls.setPinnedR(true);
    // Preserve whichever tab the user is on across new XML loads. Only auto-pick
    // a tab when nothing is currently selected (e.g. a fresh session).
    const hasActive = !!document.querySelector('#rpanel .det-tab.on');
    if (hasActive) return;
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

  switchTab('tile');
  tileSlider.updateUI(state.getThrTileMev());
  larSlider.updateUI(state.getThrLArMev());
  fcalSlider.updateUI(state.getThrFcalMev());
  hecSlider.updateUI(state.getThrHecMev());

  return {
    switchTab,
    initDetPanel,
    tileSlider,
    larSlider,
    fcalSlider,
    hecSlider,
    trackPtSlider,
    clusterEtSlider,
  };
}
