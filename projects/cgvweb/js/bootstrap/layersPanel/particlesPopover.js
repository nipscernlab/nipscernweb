// Particles popover (#btn-cluster, level-aware).
//
//   L1 — disabled (no clusters / particles to show).
//   L2 — simple toggle of cluster lines (clusterGroup).
//   L3 — opens the Particles popover with per-particle-type checkboxes
//        (jet lines / photon springs / MET arrow / electron / muon / tau /
//        unmatched track filters). The button's "on" indicator reflects
//        whether any particle type is enabled.
//
// Adding a new toggle: register it in TOGGLES below with its DOM id, getter,
// setter, and the "apply" callback that flushes downstream state. The bind
// loop wires up every entry uniformly.

import {
  getPhotonsVisible,
  getMetVisible,
  getElectronTracksVisible,
  getMuonTracksVisible,
  getTauTracksVisible,
  getUnmatchedTracksVisible,
  getUnmatchedPhotonsVisible,
  getUnmatchedTausVisible,
  getUnmatchedMuonsVisible,
  setPhotonsVisible,
  setMetVisible,
  setElectronTracksVisible,
  setMuonTracksVisible,
  setTauTracksVisible,
  setUnmatchedTracksVisible,
  setUnmatchedPhotonsVisible,
  setUnmatchedTausVisible,
  setUnmatchedMuonsVisible,
  applyTrackThreshold,
  applyTauPtThreshold,
} from '../../visibility.js';
import { markDirty } from '../../renderer.js';
import { getViewLevel, onViewLevelChange } from '../../viewLevel.js';
import { setupAnchoredPopover } from '../anchoredPopover.js';

export function setupParticlesPopover() {
  const btnCluster = document.getElementById('btn-cluster');

  /** @returns {boolean} true if at least one particle type is enabled at L3 */
  function anyParticleOn() {
    return (
      getPhotonsVisible() ||
      getMetVisible() ||
      getElectronTracksVisible() ||
      getMuonTracksVisible() ||
      getTauTracksVisible()
    );
  }
  // K button is the Particles popover trigger — only meaningful at L3 now
  // that "Cluster Lines" / "Jet Lines" moved to the Helpers popover.
  function syncClustersBtn() {
    const lvl = getViewLevel();
    if (lvl !== 3) {
      btnCluster.classList.add('disabled');
      btnCluster.classList.remove('on');
    } else {
      btnCluster.classList.remove('disabled');
      btnCluster.classList.toggle('on', anyParticleOn());
    }
  }

  // Each entry pairs a popover gswitch id with the visibility flag it drives
  // and the apply callback that flushes the downstream effect. Apply choices:
  //   markDirty            — group's .visible flips through the setter, only
  //                          a re-render is needed (jets / photons / MET).
  //   applyTrackThreshold  — track filters need the full pipeline because the
  //                          filter stage HIDES only; pT pass at the head must
  //                          reset visibility first, then the now-updated
  //                          filter applies on top.
  //   tauUnmatched custom  — Unmatched Tau also gates the η/φ τ LINE via
  //                          applyTauPtThreshold, on top of the daughter-
  //                          track + label cleanup that applyTrackThreshold
  //                          handles.
  const TOGGLES = [
    // Order matches the panel: γ → e± → μ± → τ± → ν.
    { id: 'ptog-photons', get: getPhotonsVisible, set: setPhotonsVisible, apply: markDirty },
    {
      id: 'ptog-electrons',
      get: getElectronTracksVisible,
      set: setElectronTracksVisible,
      apply: applyTrackThreshold,
    },
    {
      id: 'ptog-muons',
      get: getMuonTracksVisible,
      set: setMuonTracksVisible,
      apply: applyTrackThreshold,
    },
    {
      id: 'ptog-taus',
      get: getTauTracksVisible,
      set: setTauTracksVisible,
      apply: applyTrackThreshold,
    },
    { id: 'ptog-met', get: getMetVisible, set: setMetVisible, apply: markDirty },
    // Below the separator: "unmatched" filters that strip background.
    {
      id: 'ptog-unmatched',
      get: getUnmatchedTracksVisible,
      set: setUnmatchedTracksVisible,
      apply: applyTrackThreshold,
    },
    {
      id: 'ptog-unmatched-photons',
      get: getUnmatchedPhotonsVisible,
      set: setUnmatchedPhotonsVisible,
      apply: applyTrackThreshold,
    },
    {
      id: 'ptog-unmatched-muons',
      get: getUnmatchedMuonsVisible,
      set: setUnmatchedMuonsVisible,
      apply: applyTrackThreshold,
    },
    {
      id: 'ptog-unmatched-taus',
      get: getUnmatchedTausVisible,
      set: setUnmatchedTausVisible,
      // Two visibility passes: applyTauPtThreshold gates the η/φ τ LINE,
      // applyTrackThreshold gates the daughter TRACK + the τ label sprite
      // (via syncParticleLabelVisibility) + drives the chamber-lighting
      // re-evaluation if any tau-only track gets hidden.
      apply: () => {
        applyTauPtThreshold();
        applyTrackThreshold();
      },
    },
  ];

  function syncParticlesPanel() {
    for (const t of TOGGLES) {
      const el = document.getElementById(t.id);
      if (!el) continue;
      const on = t.get();
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', String(on));
    }
  }

  const popover = setupAnchoredPopover({
    panelId: 'particles-panel',
    anchorId: 'btn-cluster',
    defaultWidth: 220,
    onOpen: syncParticlesPanel,
    onClose: syncClustersBtn,
  });

  btnCluster.addEventListener('click', (e) => {
    e.stopPropagation();
    if (getViewLevel() !== 3) return;
    popover.isOpen() ? popover.close() : popover.open();
  });

  for (const t of TOGGLES) {
    const el = document.getElementById(t.id);
    if (!el) continue;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      t.set(!t.get());
      syncParticlesPanel();
      syncClustersBtn();
      t.apply();
    });
  }

  onViewLevelChange((lvl) => {
    syncClustersBtn();
    if (lvl !== 3 && popover.isOpen()) popover.close();
  });
  syncClustersBtn();

  return popover;
}
