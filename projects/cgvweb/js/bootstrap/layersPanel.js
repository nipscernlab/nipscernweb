// Detector layer toggles (TILE/LAr/HEC/FCAL), the Layers popover panel,
// and the Tracks/Clusters toggle buttons.
//
// Owns layersPanelOpen state. Returns { closeLayersPanel, isOpen } so the
// keyboard-shortcut module can close the popover and inspect its state.

import {
  showTile,
  showLAr,
  showHec,
  showFcal,
  setShowTile,
  setShowLAr,
  setShowHec,
  setShowFcal,
  applyThreshold,
  applyFcalThreshold,
  refreshSceneVisibility,
  getTracksVisible,
  getClustersVisible,
  setTracksVisible,
  setClustersVisible,
} from '../visibility.js';
import { updateTrackAtlasIntersections } from '../trackAtlasIntersections.js';
import { markDirty } from '../renderer.js';

export function setupLayersPanel() {
  // ── Detector layer toggles ─────────────────────────────────────────────────
  function syncLayerToggles() {
    const tTile = document.getElementById('ltog-tile');
    const tLAr = document.getElementById('ltog-lar');
    const tHec = document.getElementById('ltog-hec');
    const tFcal = document.getElementById('ltog-fcal');
    tTile.classList.toggle('on', showTile);
    tTile.setAttribute('aria-checked', showTile);
    tLAr.classList.toggle('on', showLAr);
    tLAr.setAttribute('aria-checked', showLAr);
    tHec.classList.toggle('on', showHec);
    tHec.setAttribute('aria-checked', showHec);
    tFcal.classList.toggle('on', showFcal);
    tFcal.setAttribute('aria-checked', showFcal);
    document
      .getElementById('btn-layers')
      .classList.toggle('on', showTile || showLAr || showHec || showFcal);
  }

  document.getElementById('ltog-tile').addEventListener('click', () => {
    setShowTile(!showTile);
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-lar').addEventListener('click', () => {
    setShowLAr(!showLAr);
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-hec').addEventListener('click', () => {
    setShowHec(!showHec);
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-fcal').addEventListener('click', () => {
    setShowFcal(!showFcal);
    syncLayerToggles();
    applyFcalThreshold();
  });
  document.getElementById('lbtn-all').addEventListener('click', () => {
    setShowTile(true);
    setShowLAr(true);
    setShowHec(true);
    setShowFcal(true);
    syncLayerToggles();
    refreshSceneVisibility();
  });
  document.getElementById('lbtn-none').addEventListener('click', () => {
    setShowTile(false);
    setShowLAr(false);
    setShowHec(false);
    setShowFcal(false);
    syncLayerToggles();
    refreshSceneVisibility();
  });

  // ── Layers panel popover ───────────────────────────────────────────────────
  const layersPanel = document.getElementById('layers-panel');
  let layersPanelOpen = false;

  function openLayersPanel() {
    layersPanelOpen = true;
    layersPanel.classList.add('open');
    document.getElementById('btn-layers').classList.add('on');
    const br = document.getElementById('btn-layers').getBoundingClientRect();
    requestAnimationFrame(() => {
      const pw = layersPanel.offsetWidth || 210;
      const ph = layersPanel.offsetHeight || 170;
      let left = br.left + br.width / 2 - pw / 2;
      let top = br.top - ph - 10;
      left = Math.max(6, Math.min(left, window.innerWidth - pw - 6));
      top = Math.max(6, top);
      layersPanel.style.left = left + 'px';
      layersPanel.style.top = top + 'px';
    });
  }

  function closeLayersPanel() {
    layersPanelOpen = false;
    layersPanel.classList.remove('open');
    document
      .getElementById('btn-layers')
      .classList.toggle('on', showTile || showLAr || showHec || showFcal);
  }

  document.getElementById('btn-layers').addEventListener('click', (e) => {
    e.stopPropagation();
    layersPanelOpen ? closeLayersPanel() : openLayersPanel();
  });
  document.addEventListener('click', () => {
    if (layersPanelOpen) closeLayersPanel();
  });
  layersPanel.addEventListener('click', (e) => e.stopPropagation());

  // ── Tracks / Clusters toggles ──────────────────────────────────────────────
  function syncTracksBtn() {
    document.getElementById('btn-tracks').classList.toggle('on', getTracksVisible());
  }
  document.getElementById('btn-tracks').addEventListener('click', () => {
    setTracksVisible(!getTracksVisible());
    updateTrackAtlasIntersections();
    syncTracksBtn();
    markDirty();
  });

  function syncClustersBtn() {
    document.getElementById('btn-cluster').classList.toggle('on', getClustersVisible());
  }
  document.getElementById('btn-cluster').addEventListener('click', () => {
    setClustersVisible(!getClustersVisible());
    syncClustersBtn();
    markDirty();
  });

  return {
    closeLayersPanel,
    isOpen: () => layersPanelOpen,
  };
}
