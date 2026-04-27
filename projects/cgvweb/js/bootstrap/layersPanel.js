// Detector layer toggles (TILE/LAr/HEC/FCAL), the Layers popover panel,
// and the Tracks/Clusters toggle buttons.
//
// Owns layersPanelOpen state. Returns { closeLayersPanel, isOpen } so the
// keyboard-shortcut module can close the popover and inspect its state.

import {
  showTileBarrel,
  showTileExt,
  showTileItc,
  showMbts,
  showLArBarrel,
  showLArEc,
  showHec,
  showFcal,
  setShowTileBarrel,
  setShowTileExt,
  setShowTileItc,
  setShowMbts,
  setShowLArBarrel,
  setShowLArEc,
  setShowHec,
  setShowFcal,
  applyThreshold,
  applyFcalThreshold,
  refreshSceneVisibility,
  getTracksVisible,
  getClustersVisible,
  getJetsVisible,
  setTracksVisible,
  setClustersVisible,
  setJetsVisible,
} from '../visibility.js';
import { updateTrackAtlasIntersections } from '../trackAtlasIntersections.js';
import { markDirty } from '../renderer.js';
import { getViewLevel, onViewLevelChange } from '../viewLevel.js';

export function setupLayersPanel() {
  // ── Detector layer toggles ─────────────────────────────────────────────────
  // Tile and LAr have a parent toggle that mirrors the OR of their children:
  // clicking the parent flips all children to the same target state. The MBTS
  // toggle is a peer of the parents (not a Tile child) because the user wants
  // it controlled separately.
  const anyTileOn = () => showTileBarrel || showTileExt || showTileItc;
  const anyLArOn = () => showLArBarrel || showLArEc;
  const anyOn = () => anyTileOn() || showMbts || anyLArOn() || showHec || showFcal;

  function setAllTile(v) {
    setShowTileBarrel(v);
    setShowTileExt(v);
    setShowTileItc(v);
  }
  function setAllLAr(v) {
    setShowLArBarrel(v);
    setShowLArEc(v);
  }

  function syncOne(id, on) {
    const el = document.getElementById(id);
    el.classList.toggle('on', on);
    el.setAttribute('aria-checked', on);
  }

  function syncLayerToggles() {
    syncOne('ltog-tile', anyTileOn());
    syncOne('ltog-tile-barrel', showTileBarrel);
    syncOne('ltog-tile-ext', showTileExt);
    syncOne('ltog-tile-itc', showTileItc);
    syncOne('ltog-mbts', showMbts);
    syncOne('ltog-lar', anyLArOn());
    syncOne('ltog-lar-barrel', showLArBarrel);
    syncOne('ltog-lar-ec', showLArEc);
    syncOne('ltog-hec', showHec);
    syncOne('ltog-fcal', showFcal);
    document.getElementById('btn-layers').classList.toggle('on', anyOn());
  }

  // Expand/collapse the Tile and LAr sub-trees. Click anywhere on the parent
  // row toggles `.expanded` on the group; clicks on the gswitch are ignored
  // here so the visibility-toggle handler fires alone.
  document.querySelectorAll('#layers-panel .layer-row-parent').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.gswitch')) return;
      row.parentElement.classList.toggle('expanded');
    });
  });

  document.getElementById('ltog-tile').addEventListener('click', () => {
    setAllTile(!anyTileOn());
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-tile-barrel').addEventListener('click', () => {
    setShowTileBarrel(!showTileBarrel);
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-tile-ext').addEventListener('click', () => {
    setShowTileExt(!showTileExt);
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-tile-itc').addEventListener('click', () => {
    setShowTileItc(!showTileItc);
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-mbts').addEventListener('click', () => {
    setShowMbts(!showMbts);
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-lar').addEventListener('click', () => {
    setAllLAr(!anyLArOn());
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-lar-barrel').addEventListener('click', () => {
    setShowLArBarrel(!showLArBarrel);
    syncLayerToggles();
    applyThreshold();
  });
  document.getElementById('ltog-lar-ec').addEventListener('click', () => {
    setShowLArEc(!showLArEc);
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
    setAllTile(true);
    setShowMbts(true);
    setAllLAr(true);
    setShowHec(true);
    setShowFcal(true);
    syncLayerToggles();
    refreshSceneVisibility();
  });
  document.getElementById('lbtn-none').addEventListener('click', () => {
    setAllTile(false);
    setShowMbts(false);
    setAllLAr(false);
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
    document.getElementById('btn-layers').classList.toggle('on', anyOn());
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

  // K button is level-aware: at L2 it toggles cluster lines, at L3 it toggles
  // jet lines, and at L1 it's disabled (no cluster/jet to show).
  const btnCluster = document.getElementById('btn-cluster');
  function syncClustersBtn() {
    const lvl = getViewLevel();
    if (lvl === 1) {
      btnCluster.classList.add('disabled');
      btnCluster.classList.remove('on');
    } else {
      btnCluster.classList.remove('disabled');
      const flag = lvl === 3 ? getJetsVisible() : getClustersVisible();
      btnCluster.classList.toggle('on', flag);
    }
  }
  btnCluster.addEventListener('click', () => {
    const lvl = getViewLevel();
    if (lvl === 1) return;
    if (lvl === 3) setJetsVisible(!getJetsVisible());
    else setClustersVisible(!getClustersVisible());
    syncClustersBtn();
    markDirty();
  });
  onViewLevelChange(syncClustersBtn);
  syncClustersBtn();

  return {
    closeLayersPanel,
    isOpen: () => layersPanelOpen,
  };
}
