import * as THREE        from 'three';
import { initLanguage, setupLanguagePicker, t } from './i18n/index.js';
import { setupLiveMode } from './liveMode.js';
import { setupSidebarControls } from './sidebarControls.js';
import { createSlicerController } from './slicer.js';
import { setupServerMode } from './serverMode.js';
import { setupSampleMode } from './sampleMode.js';
import { registerViewerShortcuts } from './viewerShortcuts.js';
import { _wasmPool } from './state.js';
import { TILE_SCALE, HEC_SCALE, LAR_SCALE, FCAL_SCALE } from './palette.js';
import { setLoadProgress, dismissLoadingScreen, bumpReq } from './loading.js';
import {
  markDirty,
  canvas, renderer, scene, camera, controls,
} from './renderer.js';
import { toggleAllGhosts, enableDefaultGhosts } from './ghost.js';
import { initScene } from './loader.js';
import { setupColorPicker } from './colorpicker.js';
import { setupCinemaControls } from './cinema.js';
import { setupScreenshotControls } from './screenshot.js';
import { setupDetectorPanels } from './detectorPanels.js';
import {
  initVisibility,
  thrTileMev, thrLArMev, thrHecMev, thrFcalMev,
  showTile, showLAr, showHec, showFcal,
  thrTrackGev, trackPtMinGev, trackPtMaxGev,
  thrClusterEtGev, clusterEtMinGev, clusterEtMaxGev, clusterFilterEnabled,
  setThrTileMev, setThrLArMev, setThrHecMev, setThrFcalMev,
  setShowTile, setShowLAr, setShowHec, setShowFcal,
  setThrTrackGev, setTrackPtMinGev, setTrackPtMaxGev,
  setThrClusterEtGev, setClusterEtMinGev, setClusterEtMaxGev, setClusterFilterEnabled,
  hideNonActiveCells,
  applyThreshold, applyFcalThreshold, applyTrackThreshold, applyClusterThreshold,
  refreshSceneVisibility,
  getTrackGroup,
  getTracksVisible, getClustersVisible,
  setTracksVisible, setClustersVisible,
} from './visibility.js';
import { esc, makeRelTime } from './utils.js';
import { createDownloadProgressController } from './progress.js';
import {
  initTrackAtlasIntersections, setAtlasRoot, updateTrackAtlasIntersections,
} from './trackAtlasIntersections.js';
import { clearOutline, rebuildAllOutlines } from './outlines.js';
import {
  initHoverTooltip, hideTooltip,
  tooltip, tipCellEl, tipEEl,
} from './hoverTooltip.js';
import { initRenderLoop } from './renderLoop.js';
import { toggleBeam } from './beamIndicator.js';
import { setupPanelResize } from './panelResize.js';
import { setupButtonTooltips } from './buttonTooltips.js';
import { setupMobileToolbar } from './mobileToolbar.js';
import { processXml, setProcessXmlDeps } from './processXml.js';
import {
  initStatusHud, setStatus, showEventInfo, updateCollisionHud, getLastEventInfo,
} from './statusHud.js';

let LivePoller = null;
try { ({ LivePoller } = await import('../live_atlas/live_cern/live_poller.js')); } catch (_) {}

initLanguage();
setupLanguagePicker();


let wasmOk     = false;
let sceneOk    = false;
let isLive     = true;
let liveSub    = 'web'; // 'web' | 'server'
let showInfo   = true;

let sidebarControls = null;
let _readyFired  = false;



// ── Atlas structural geometry (from atlas.root merged into GLB) ───────────────
const atlasMat = new THREE.MeshBasicMaterial({
  color: 0x4A90D9, transparent: true, opacity: 0.07,
  depthWrite: false, side: THREE.DoubleSide,
});

initTrackAtlasIntersections({ getTrackGroup });

// Tooltip + dirty on camera drag.
let _ctrlActive = false;
controls.addEventListener('start',  () => { _ctrlActive = true; });
controls.addEventListener('end',    () => { _ctrlActive = false; });
controls.addEventListener('change', () => {
  markDirty();
  if (!cinema.isCinemaMode() && _ctrlActive) { hideTooltip(); clearOutline(); }
});

initRenderLoop({
  onFrameStart: () => { if (cinema.isAnimating()) cinema.tick(); },
});

// ── Status bar ────────────────────────────────────────────────────────────────
function checkReady() {
  if (!wasmOk || !sceneOk) return;
  setStatus(t('status-ready'));
  if (!_readyFired) {
    _readyFired = true;
    setLoadProgress(100, 'Ready');
    // Enable the default TileCal ghost envelopes on startup.
    enableDefaultGhosts();
    // Dismiss loading screen after a brief moment so 100% is visible
    setTimeout(dismissLoadingScreen, 280);
  }
  if (isLive && liveSub === 'web' && poller) {
    poller.start();
    liveMode.loadFirstAvailableEvent();
  }
}

// ── GLB loader (with OPFS cache) ──────────────────────────────────────────────
// ── Geometry + WASM initialisation ─────────────────────────────────────────
initScene({
  setStatus,
  atlasMat,
  onSceneReady() { sceneOk = true; markDirty(); checkReady(); },
  onAtlasReady(tree) { setAtlasRoot(tree); },
});
_wasmPool.init()
  .then(() => { wasmOk = true; checkReady(); })
  .catch(e => { setStatus(`<span class="err">WASM: ${esc(e && e.message || String(e))}</span>`); });

let tileSlider = null;
let larSlider = null;
let fcalSlider = null;
let hecSlider = null;
let trackPtSlider = null;
let clusterEtSlider = null;
let initDetPanel = null;
const relTime = makeRelTime(t);
const { startProgress, advanceProgress, endProgress } = createDownloadProgressController();

initHoverTooltip({
  getShowInfo:   () => showInfo,
  getCinemaMode: () => cinema.isCinemaMode(),
  t,
});

const cinema = setupCinemaControls({
  camera,
  canvas,
  controls,
  markDirty,
  clearOutline,
  hideTooltip,
  updateCollisionHud,
});
const enterCinema = () => cinema.enterCinema();
const exitCinema = () => cinema.exitCinema();
const resetCamera = () => cinema.resetCamera();

// ── Tooltip toggle ────────────────────────────────────────────────────────────
document.getElementById('btn-info').addEventListener('click', () => {
  showInfo = !showInfo;
  document.getElementById('btn-info').classList.toggle('on', showInfo);
  document.querySelector('#btn-info use').setAttribute('href', showInfo ? '#i-eye' : '#i-eye-off');
  if (!showInfo) { clearOutline(); hideTooltip(); }
});
document.getElementById('btn-ghost').addEventListener('click', e => {
  e.stopPropagation();
  toggleAllGhosts();
});
document.getElementById('btn-beam').addEventListener('click', toggleBeam);
document.getElementById('btn-reset').addEventListener('click', resetCamera);


// ── Detector layer toggles + Layers panel ────────────────────────────────────
function syncLayerToggles() {
  const tTile = document.getElementById('ltog-tile');
  const tLAr  = document.getElementById('ltog-lar');
  const tHec  = document.getElementById('ltog-hec');
  const tFcal = document.getElementById('ltog-fcal');
  tTile.classList.toggle('on', showTile); tTile.setAttribute('aria-checked', showTile);
  tLAr .classList.toggle('on', showLAr);  tLAr .setAttribute('aria-checked', showLAr);
  tHec .classList.toggle('on', showHec);  tHec .setAttribute('aria-checked', showHec);
  tFcal.classList.toggle('on', showFcal); tFcal.setAttribute('aria-checked', showFcal);
  // Layers button: dim when all off, lit otherwise
  document.getElementById('btn-layers').classList.toggle('on', showTile || showLAr || showHec || showFcal);
}

// refreshSceneVisibility is imported from visibility.js

document.getElementById('ltog-tile').addEventListener('click', () => { setShowTile(!showTile); syncLayerToggles(); applyThreshold(); });
document.getElementById('ltog-lar') .addEventListener('click', () => { setShowLAr(!showLAr);   syncLayerToggles(); applyThreshold(); });
document.getElementById('ltog-hec') .addEventListener('click', () => { setShowHec(!showHec);   syncLayerToggles(); applyThreshold(); });
document.getElementById('ltog-fcal').addEventListener('click', () => { setShowFcal(!showFcal); syncLayerToggles(); applyFcalThreshold(); });
document.getElementById('lbtn-all') .addEventListener('click', () => { setShowTile(true);  setShowLAr(true);  setShowHec(true);  setShowFcal(true);  syncLayerToggles(); refreshSceneVisibility(); });
document.getElementById('lbtn-none').addEventListener('click', () => { setShowTile(false); setShowLAr(false); setShowHec(false); setShowFcal(false); syncLayerToggles(); refreshSceneVisibility(); });

// Layers panel open / close
const layersPanel = document.getElementById('layers-panel');
let layersPanelOpen = false;
function openLayersPanel() {
  layersPanelOpen = true;
  layersPanel.classList.add('open');
  document.getElementById('btn-layers').classList.add('on');
  const br = document.getElementById('btn-layers').getBoundingClientRect();
  // Position above the button, centred
  requestAnimationFrame(() => {
    const pw = layersPanel.offsetWidth  || 210;
    const ph = layersPanel.offsetHeight || 170;
    let left = br.left + br.width / 2 - pw / 2;
    let top  = br.top - ph - 10;
    left = Math.max(6, Math.min(left, window.innerWidth - pw - 6));
    top  = Math.max(6, top);
    layersPanel.style.left = left + 'px';
    layersPanel.style.top  = top  + 'px';
  });
}
function closeLayersPanel() {
  layersPanelOpen = false;
  layersPanel.classList.remove('open');
  // Restore btn-layers state (lit if any layer on)
  document.getElementById('btn-layers').classList.toggle('on', showTile || showLAr || showHec || showFcal);
}
document.getElementById('btn-layers').addEventListener('click', e => {
  e.stopPropagation();
  layersPanelOpen ? closeLayersPanel() : openLayersPanel();
});

// ── Particle tracks (collision tracer) toggle ───────────────────────────────
function syncTracksBtn() {
  document.getElementById('btn-tracks').classList.toggle('on', getTracksVisible());
}
function toggleTracks() {
  setTracksVisible(!getTracksVisible());
  updateTrackAtlasIntersections();
  syncTracksBtn();
  markDirty();
}
document.getElementById('btn-tracks').addEventListener('click', toggleTracks);

// ── Cluster η/φ lines toggle ────────────────────────────────────────────────
function syncClustersBtn() {
  document.getElementById('btn-cluster').classList.toggle('on', getClustersVisible());
}
function toggleClusters() {
  setClustersVisible(!getClustersVisible());
  syncClustersBtn();
  markDirty();
}
document.getElementById('btn-cluster').addEventListener('click', toggleClusters);


document.addEventListener('click', () => {
  if (layersPanelOpen) closeLayersPanel();
});
layersPanel.addEventListener('click', e => e.stopPropagation());

setupPanelResize();


// ── About overlay ─────────────────────────────────────────────────────────────
sidebarControls = setupSidebarControls({
  canvas,
  getCinemaMode: () => cinema.isCinemaMode(),
  getTourMode: () => cinema.isTourMode(),
  onDisableTourMode: () => cinema.disableTourMode(),
  onEnableTourMode: () => cinema.enableTourMode(),
  t,
  updateCollisionHud,
});

initStatusHud({
  getPanelPinned:  () => sidebarControls.getState().panelPinned,
  getCinemaMode:   () => cinema.isCinemaMode(),
  isHintsEnabled:  () => sidebarControls.isHintsEnabled(),
});

({
  tileSlider,
  larSlider,
  fcalSlider,
  hecSlider,
  trackPtSlider,
  clusterEtSlider,
  initDetPanel,
} = setupDetectorPanels({
  TILE_SCALE,
  LAR_SCALE,
  FCAL_SCALE,
  HEC_SCALE,
  applyThreshold,
  applyFcalThreshold,
  applyTrackThreshold,
  applyClusterThreshold,
  sidebarControls,
  state: {
    getThrTileMev: () => thrTileMev,       setThrTileMev,
    getThrLArMev:  () => thrLArMev,        setThrLArMev,
    getThrFcalMev: () => thrFcalMev,       setThrFcalMev,
    getThrHecMev:  () => thrHecMev,        setThrHecMev,
    getThrTrackGev:    () => thrTrackGev,    setThrTrackGev,
    getTrackPtMinGev:  () => trackPtMinGev,  setTrackPtMinGev,
    getTrackPtMaxGev:  () => trackPtMaxGev,  setTrackPtMaxGev,
    getThrClusterEtGev: () => thrClusterEtGev, setThrClusterEtGev,
    getClusterEtMinGev: () => clusterEtMinGev, setClusterEtMinGev,
    getClusterEtMaxGev: () => clusterEtMaxGev, setClusterEtMaxGev,
    getClusterFilterEnabled: () => clusterFilterEnabled, setClusterFilterEnabled,
  },
}));

setProcessXmlDeps({
  getWasmOk: () => wasmOk,
  tileSlider, larSlider, fcalSlider, hecSlider, trackPtSlider, clusterEtSlider,
  initDetPanel,
});

const aboutOverlay = document.getElementById('about-overlay');
document.getElementById('btn-about-close').addEventListener('click', () => aboutOverlay.classList.remove('open'));
aboutOverlay.addEventListener('click', e => { if (e.target===aboutOverlay) aboutOverlay.classList.remove('open'); });

setupButtonTooltips();

// ── Mode toggle ───────────────────────────────────────────────────────────────
const sampleMode = setupSampleMode({
  advanceProgress,
  endProgress,
  esc,
  processXml,
  setStatus,
  startProgress,
  t,
});

const serverMode = setupServerMode({
  advanceProgress,
  endProgress,
  esc,
  processXml,
  setStatus,
  startProgress,
  t,
});

const TAB_KEY = 'cgv-tab';
const SUB_KEY = 'cgv-live-sub';

function setLiveSub(sub) {
  liveSub = (sub === 'server') ? 'server' : 'web';
  document.getElementById('btn-live-web').classList.toggle('on',    liveSub === 'web');
  document.getElementById('btn-live-server').classList.toggle('on', liveSub === 'server');
  document.getElementById('live-web-sec').hidden    = (liveSub !== 'web');
  document.getElementById('live-server-sec').hidden = (liveSub !== 'server');

  if (isLive) {
    if (liveSub === 'web') {
      serverMode.setActive(false);
      if (poller && wasmOk && sceneOk) poller.start();
    } else {
      if (poller) poller.stop();
      serverMode.setActive(true);
    }
  }
  try { localStorage.setItem(SUB_KEY, liveSub); } catch (_) {}
}

function setMode(mode) {
  isLive = (mode === 'live');
  document.getElementById('btn-live').classList.toggle('on',   mode === 'live');
  document.getElementById('btn-sample').classList.toggle('on', mode === 'sample');
  document.getElementById('live-sec').hidden   = (mode !== 'live');
  document.getElementById('sample-sec').hidden = (mode !== 'sample');
  if (mode === 'live') {
    setLiveSub(liveSub);
  } else {
    if (poller) poller.stop();
    serverMode.setActive(false);
    if (mode === 'sample') sampleMode.loadSampleIndex();
  }
  try { localStorage.setItem(TAB_KEY, mode); } catch (_) {}
}
document.getElementById('btn-live').addEventListener('click',   () => { if (!isLive) setMode('live'); });
document.getElementById('btn-sample').addEventListener('click', () => { if (document.getElementById('sample-sec').hidden) setMode('sample'); });
document.getElementById('btn-live-web').addEventListener('click',    () => { if (liveSub !== 'web')    setLiveSub('web'); });
document.getElementById('btn-live-server').addEventListener('click', () => { if (liveSub !== 'server') setLiveSub('server'); });

let poller = null;
const liveMode = setupLiveMode({
  LivePoller,
  advanceProgress,
  bumpReq,
  endProgress,
  esc,
  onFallbackToLocal: () => setLiveSub('server'),
  processXml,
  relTime,
  startProgress,
  t,
});
poller = liveMode.hasPoller() ? { start: () => liveMode.start(), stop: () => liveMode.stop() } : null;

// Restore last-used tab and sub-tab from localStorage
(function restoreTabs() {
  let savedTab = null;
  let savedSub = null;
  try {
    savedTab = localStorage.getItem(TAB_KEY);
    savedSub = localStorage.getItem(SUB_KEY);
  } catch (_) {}
  if (savedSub === 'server' || savedSub === 'web') liveSub = savedSub;
  if (savedTab === 'sample') {
    setMode('sample');
  } else {
    setLiveSub(liveSub);
  }
})();

setupColorPicker();


// ── Download progress bar ─────────────────────────────────────────────────────

// ── Settings panel ────────────────────────────────────────────────────────────

// ── About button (panel head) ─────────────────────────────────────────────────
document.getElementById('btn-about').addEventListener('click', () => {
  aboutOverlay.classList.add('open');
});

setupMobileToolbar();

// ── Slicer gizmo ──────────────────────────────────────────────────────────────
// _cellCenter, _applySlicerMask, and all visibility logic live in visibility.js.

const slicer = createSlicerController({
  THREE,
  camera,
  canvas,
  controls,
  scene,
  slicerButton: document.getElementById('btn-slicer'),
  onMaskChange:            refreshSceneVisibility,
  onDisable:               refreshSceneVisibility,
  onHideNonActiveShowAll:  hideNonActiveCells,
});

initVisibility({ slicer, rebuildAllOutlines, updateTrackAtlasIntersections });

setupScreenshotControls({
  camera,
  canvas,
  markDirty,
  renderer,
  scene,
  slicer,
  t,
  getLastEventInfo,
  tooltip,
  tipCellEl,
  tipEEl,
});

registerViewerShortcuts({
  aboutOverlay,
  closeLayersPanel,
  closeSettingsPanel: sidebarControls.closeSettingsPanel,
  enterCinema,
  exitCinema,
  getState: () => ({
    cinemaMode: cinema.isCinemaMode(),
    layersPanelOpen,
    panelPinned: sidebarControls.getState().panelPinned,
    rpanelPinned: sidebarControls.getState().rpanelPinned,
    settingsPanelOpen: sidebarControls.getState().settingsPanelOpen,
  }),
  openSettingsPanel: sidebarControls.openSettingsPanel,
  resetCamera,
  setPinned: sidebarControls.setPinned,
  setPinnedR: sidebarControls.setPinnedR,
  slicer,
  toggleAllGhosts,
  toggleBeam,
});


