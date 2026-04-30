import * as THREE from 'three';
import { initLanguage, setupLanguagePicker, t } from './i18n/index.js';
import { setupSidebarControls } from './sidebarControls.js';
import { createSlicerController } from './slicer.js';
import { getActiveJetCollection, onJetStateChange } from './jets.js';
import { registerViewerShortcuts } from './viewerShortcuts.js';
import { TILE_SCALE, HEC_SCALE, LAR_SCALE, FCAL_SCALE } from './palette.js';
import { markDirty, canvas, renderer, scene, camera, controls } from './renderer.js';
import { toggleAllGhosts, anyGhostOn } from './ghost.js';
import { setupColorPicker } from './colorpicker.js';
import { setupCinemaControls } from './cinema.js';
import { setupScreenshotControls } from './screenshot.js';
import { setupDetectorPanels } from './detectorPanels.js';
import {
  initVisibility,
  thrTileMev,
  thrLArMev,
  thrHecMev,
  thrFcalMev,
  thrTrackGev,
  trackPtMinGev,
  trackPtMaxGev,
  thrClusterEtGev,
  clusterEtMinGev,
  clusterEtMaxGev,
  thrJetEtGev,
  jetEtMinGev,
  jetEtMaxGev,
  setThrTileMev,
  setThrLArMev,
  setThrHecMev,
  setThrFcalMev,
  setThrTrackGev,
  setTrackPtMinGev,
  setTrackPtMaxGev,
  setThrClusterEtGev,
  setClusterEtMinGev,
  setClusterEtMaxGev,
  setThrJetEtGev,
  setJetEtMinGev,
  setJetEtMaxGev,
  hideNonActiveCells,
  applyThreshold,
  applyFcalThreshold,
  applyTrackThreshold,
  applyClusterThreshold,
  applyJetThreshold,
  refreshSceneVisibility,
  getTrackGroup,
} from './visibility.js';
import { createDownloadProgressController } from './downloadProgress.js';
import { initTrackAtlasIntersections } from './trackAtlasIntersections.js';
import { clearOutline } from './outlines.js';
import { initHoverTooltip, hideTooltip, tooltip, tipCellEl, tipEEl } from './hoverTooltip.js';
import { initRenderLoop } from './renderLoop.js';
import { setupPanelResize } from './panelResize.js';
import { setupButtonTooltips } from './buttonTooltips.js';
import { setupMobileToolbar } from './mobileToolbar.js';
import { processXml, setProcessXmlDeps } from './processXml.js';
import { initMinimap, setMinimapVisible } from './minimap.js';
import {
  initStatusHud,
  setStatus,
  updateCollisionHud,
  getLastEventInfo,
  setCollisionHudEnabled,
} from './statusHud.js';
import { setupTopToolbar } from './bootstrap/topToolbar.js';
import { setupLayersPanel } from './bootstrap/layersPanel.js';
import { setupHelpersPanel } from './bootstrap/helpersPanel.js';
import { setupModeWiring } from './bootstrap/modeWiring.js';
import { setupSceneInit } from './bootstrap/sceneInit.js';

let LivePoller = null;
try {
  ({ LivePoller } = await import('../live_atlas/live_cern/live_poller.js'));
} catch (_) {}

initLanguage();
setupLanguagePicker();
initMinimap();

let sidebarControls = null;

initTrackAtlasIntersections({ getTrackGroup });

const sceneInit = setupSceneInit({ t });

// Tooltip + dirty on camera drag.
let _ctrlActive = false;
controls.addEventListener('start', () => {
  _ctrlActive = true;
});
controls.addEventListener('end', () => {
  _ctrlActive = false;
});
controls.addEventListener('change', () => {
  markDirty();
  if (!cinema.isCinemaMode() && _ctrlActive) {
    hideTooltip();
    clearOutline();
  }
});

initRenderLoop({
  onFrameStart: () => {
    if (cinema.isAnimating()) cinema.tick();
  },
});

let tileSlider = null;
let larSlider = null;
let fcalSlider = null;
let hecSlider = null;
let trackPtSlider = null;
let clusterEtSlider = null;
let initDetPanel = null;
const { startProgress, advanceProgress, endProgress } = createDownloadProgressController();

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
// Reset-camera button: when the slicer is active, re-snap to the slicer's
// own wedge-front view (with scene rotation and +X camera placement) rather
// than the project-default top-down view. The slicer instance is created
// further below; the closure looks it up at click time, never at module
// init, so the const-before-let ordering is fine.
const resetCamera = () => {
  if (slicer?.isActive?.()) slicer.resetCamera();
  else cinema.resetCamera();
};

const topToolbar = setupTopToolbar({ resetCamera });

const layersPanel = setupLayersPanel();

// Helpers popover wires Ghost / Cell Info / Unmatched / Jet-Cluster Lines.
// It owns the showInfo state that hoverTooltip reads via getShowInfo.
// Mutual exclusivity with the other toolbar popovers is automatic — see the
// shared registry in js/bootstrap/anchoredPopover.js.
const helpersPanel = setupHelpersPanel({
  toggleAllGhosts,
  anyGhostOn,
  clearOutline,
  hideTooltip,
});

initHoverTooltip({
  getShowInfo: helpersPanel.getShowInfo,
  getCinemaMode: () => cinema.isCinemaMode(),
  getDragging: () => _ctrlActive,
  t,
});

setupPanelResize();

// ── About overlay ─────────────────────────────────────────────────────────────
sidebarControls = setupSidebarControls({
  canvas,
  getTourMode: () => cinema.isTourMode(),
  onDisableTourMode: () => cinema.disableTourMode(),
  onEnableTourMode: () => cinema.enableTourMode(),
  onToggleCollisionHud: (enabled) => setCollisionHudEnabled(enabled),
  onToggleMinimap: (enabled) => setMinimapVisible(enabled),
  t,
  updateCollisionHud,
});

initStatusHud({
  t,
  isCollisionHudEnabled: () => sidebarControls.isCollisionHudEnabled(),
  getPanelPinned: () => sidebarControls.getState().panelPinned,
});

({ tileSlider, larSlider, fcalSlider, hecSlider, trackPtSlider, clusterEtSlider, initDetPanel } =
  setupDetectorPanels({
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
    state: {
      getThrTileMev: () => thrTileMev,
      setThrTileMev,
      getThrLArMev: () => thrLArMev,
      setThrLArMev,
      getThrFcalMev: () => thrFcalMev,
      setThrFcalMev,
      getThrHecMev: () => thrHecMev,
      setThrHecMev,
      getThrTrackGev: () => thrTrackGev,
      setThrTrackGev,
      getTrackPtMinGev: () => trackPtMinGev,
      setTrackPtMinGev,
      getTrackPtMaxGev: () => trackPtMaxGev,
      setTrackPtMaxGev,
      getThrClusterEtGev: () => thrClusterEtGev,
      setThrClusterEtGev,
      getClusterEtMinGev: () => clusterEtMinGev,
      setClusterEtMinGev,
      getClusterEtMaxGev: () => clusterEtMaxGev,
      setClusterEtMaxGev,
      getThrJetEtGev: () => thrJetEtGev,
      setThrJetEtGev,
      getJetEtMinGev: () => jetEtMinGev,
      setJetEtMinGev,
      getJetEtMaxGev: () => jetEtMaxGev,
      setJetEtMaxGev,
    },
  }));

setProcessXmlDeps({
  getWasmOk: sceneInit.isWasmOk,
  tileSlider,
  larSlider,
  fcalSlider,
  hecSlider,
  trackPtSlider,
  clusterEtSlider,
  initDetPanel,
});

setupButtonTooltips();

const modeWiring = setupModeWiring({
  LivePoller,
  processXml,
  setStatus,
  startProgress,
  advanceProgress,
  endProgress,
  t,
});
sceneInit.setOnReady(() => modeWiring.onSceneAndWasmReady());

setupColorPicker();

// ── Download progress bar ─────────────────────────────────────────────────────

// ── Settings panel ────────────────────────────────────────────────────────────

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
  onMaskChange: refreshSceneVisibility,
  onDisable: refreshSceneVisibility,
  onHideNonActiveShowAll: hideNonActiveCells,
  markDirty,
  getActiveJetCollection,
});

// New event lands or user picks a different jet collection — if the slicer
// is active, snap its walls to the new top-2 jets. No-op when slicer is
// inactive or fewer than 2 usable jets are present.
onJetStateChange(() => slicer.refreshFromActiveJets());

initVisibility({ slicer });

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
  aboutOverlay: topToolbar.aboutOverlay,
  closeLayersPanel: layersPanel.closeLayersPanel,
  closeSettingsPanel: sidebarControls.closeSettingsPanel,
  enterCinema,
  exitCinema,
  getState: () => ({
    cinemaMode: cinema.isCinemaMode(),
    layersPanelOpen: layersPanel.isOpen(),
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
});
