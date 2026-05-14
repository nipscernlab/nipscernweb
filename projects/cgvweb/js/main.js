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
import { getViewLevel, onViewLevelChange } from './viewLevel.js';
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
  setEtaPhiRegion,
  setHeatmapListener,
  getTrackGroup,
} from './visibility.js';
import { createDownloadProgressController } from './downloadProgress.js';
import {
  initTrackAtlasIntersections,
  updateTrackAtlasIntersections,
} from './trackAtlasIntersections.js';
import { isAnyMuonVisible, onMuonVisibilityChange } from './visibility/muonVisibility.js';
import { clearOutline } from './outlines.js';
import { initHoverTooltip, hideTooltip, tooltip, tipCellEl, tipEEl } from './hoverTooltip.js';
import { initRenderLoop } from './renderLoop.js';
import { setupPanelResize } from './panelResize.js';
import { setupButtonTooltips } from './buttonTooltips.js';
import { setupMobileToolbar } from './mobileToolbar.js';
import { processXml, setProcessXmlDeps } from './processXml.js';
import {
  initMinimap,
  setMinimapVisible,
  setMinimapRegionListener,
  updateMinimap,
} from './minimap.js';
import {
  initStatusHud,
  setStatus,
  updateCollisionHud,
  getLastEventInfo,
  setCollisionHudEnabled,
  setCollisionHudSuppressed,
} from './statusHud.js';
import { setupTopToolbar } from './bootstrap/topToolbar.js';
import { setupLayersPanel } from './bootstrap/layersPanel.js';
import { setupHelpersPanel } from './bootstrap/helpersPanel.js';
import { setupModeWiring } from './bootstrap/modeWiring.js';
import { setupSceneInit } from './bootstrap/sceneInit.js';
import { setupRowToggle } from './bootstrap/rowToggle.js';

let LivePoller = null;
try {
  ({ LivePoller } = await import('../live_atlas/live_cern/live_poller.js'));
} catch (_) {}

initLanguage();
setupLanguagePicker();
initMinimap();
// Minimap rectangle changes feed BOTH the 3D-scene gate (setEtaPhiRegion)
// AND the cinema tour (so a user-defined area of interest narrows the path).
// cinema is declared further below; the closure captures the const binding
// and only fires once the user has actually drawn or moved a rect.
setMinimapRegionListener((regions) => {
  setEtaPhiRegion(regions);
  cinema.notifyMinimapChanged(regions);
});
// Visibility pipeline pushes pre-rectangle visible cells into the minimap
// heatmap every time a filter changes (threshold sliders, detector toggles,
// view-level switch, slicer move). The cinema reuses the same data feed to
// rebuild its event-driven tour path — debounced + fingerprint-gated inside
// cinema so slider drags don't churn the curve. cinema is declared further
// below but the closure only fires after the first visibility refresh, well
// past cinema's initialisation.
setHeatmapListener((cells, fcal) => {
  updateMinimap({ cells, fcal });
  cinema.updateTourFromEvent({ cells, fcal });
});

let sidebarControls = null;

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
let syncCellMetric = null;
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
// Seed the cinema's view-level cache with the starting level and refresh it
// on every transition between modes 1/2/3 — the fingerprint includes the
// level so the adaptive tour rebuilds even when the underlying cell set
// happens to be identical between two modes.
cinema.notifyViewLevelChanged(getViewLevel());
onViewLevelChange((level) => cinema.notifyViewLevelChanged(level));
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
  t,
  updateCollisionHud,
});

initStatusHud({
  t,
  isCollisionHudEnabled: () => sidebarControls.isCollisionHudEnabled(),
  getPanelPinned: () => sidebarControls.getState().panelPinned,
});

({
  tileSlider,
  larSlider,
  fcalSlider,
  hecSlider,
  trackPtSlider,
  clusterEtSlider,
  initDetPanel,
  syncCellMetric,
} = setupDetectorPanels({
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
  syncCellMetric,
});

setupButtonTooltips();
setupRowToggle();

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

// Slicer state changes (enable / disable / drag / muon-driven resize) need to
// recompute BOTH calo-cell visibility (refreshSceneVisibility → applyThreshold)
// AND muon-chamber visibility (updateTrackAtlasIntersections — owns the
// show-all-chambers + wedge-mask pass). refreshSceneVisibility doesn't cascade
// into the chamber pass because cell vs chamber pipelines are otherwise
// independent; coupling them at the slicer hook keeps the rest decoupled.
// Every slicer transition (enable / disable / mask drag) needs to notify
// the cinema so the adaptive tour drops POIs in the cut wedge. Done in a
// shared helper so all three callbacks share the same notification path.
// slicer is the variable captured below; this fn only runs from user
// interaction, well past slicer's initialisation.
const _notifyCinemaSlicer = () => {
  cinema.notifySlicerChanged(slicer.getMaskState(), slicer.isPointInsideWedge);
};

const onSlicerStateChanged = () => {
  refreshSceneVisibility();
  updateTrackAtlasIntersections();
  _notifyCinemaSlicer();
};

const slicer = createSlicerController({
  THREE,
  camera,
  canvas,
  controls,
  scene,
  slicerButton: document.getElementById('btn-slicer'),
  onMaskChange: onSlicerStateChanged,
  onDisable: onSlicerStateChanged,
  // Enabling the slicer carves the 3D scene; the minimap heatmap doesn't
  // share that affordance and the two can confuse each other if both are
  // on, so they're mutually exclusive — turning the slicer on disables the
  // minimap (and vice versa via the toolbar button below). Also notify the
  // cinema so the tour drops POIs in the cut wedge.
  onEnable: () => {
    setMinimapEnabled(false);
    _notifyCinemaSlicer();
  },
  onHideNonActiveShowAll: hideNonActiveCells,
  markDirty,
  getActiveJetCollection,
  isMuonOn: isAnyMuonVisible,
});

// Wire the muon-chamber pass to the slicer so show-all-cells mode drops the
// track-hit gate on chambers and the wedge cut carves through them. Late
// binding via getSlicer because slicer was just created above; the pass is
// only invoked from applyMuonVisibility after the GLB has loaded, well past
// the synchronous reach of this file.
initTrackAtlasIntersections({ getTrackGroup, getSlicer: () => slicer });

// User toggled a muon station (or the initial GLB load fired the first
// applyMuonVisibility). Tell the slicer to grow/shrink its mask cylinder
// and recenter — the chamber envelope dwarfs the calo when muon is on.
onMuonVisibilityChange(() => slicer.refreshSize());

// New event lands or user picks a different jet collection — if the slicer
// is active, snap its walls to the new top-2 jets. No-op when slicer is
// inactive or fewer than 2 usable jets are present.
onJetStateChange(() => slicer.refreshFromActiveJets());

// ── Minimap toggle controller ────────────────────────────────────────────────
// Single source of truth for "is the minimap on": owns the toolbar button's
// .on class, the persisted preference, suppressing the collision HUD while
// active, and the mutual exclusion with the slicer (turning the minimap on
// disables the slicer; the slicer's onEnable callback turns the minimap off
// in the opposite direction). Function declaration so it's hoisted into the
// slicer's onEnable closure above.
const btnMinimap = document.getElementById('btn-minimap');
let _minimapOn = false;
function setMinimapEnabled(on) {
  on = !!on;
  if (on === _minimapOn) return;
  _minimapOn = on;
  if (on && slicer.isActive()) slicer.disable();
  setMinimapVisible(on);
  setCollisionHudSuppressed(on);
  btnMinimap?.classList.toggle('on', on);
  btnMinimap?.setAttribute('aria-pressed', on ? 'true' : 'false');
  try {
    localStorage.setItem('cgv-minimap', on ? '1' : '0');
  } catch (_) {}
}
function toggleMinimap() {
  setMinimapEnabled(!_minimapOn);
}
btnMinimap?.addEventListener('click', toggleMinimap);
// Restore last session's preference. Defaults to off — heatmap stays out of
// the way until the user asks for it.
try {
  if (localStorage.getItem('cgv-minimap') === '1') setMinimapEnabled(true);
} catch (_) {}

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
  toggleMinimap,
});
