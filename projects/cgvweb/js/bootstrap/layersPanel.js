// @ts-check
// Layers + Particles + Inner-Detector overlay bootstrap.
//
// This module is just the orchestrator. Each panel/popover lives in its own
// file under bootstrap/layersPanel/:
//   tree.js              detector-layer tree (PANEL_TREE config + DOM render
//                        + click handlers + All / None + muon sub-tree).
//   innerOverlay.js      Tracks + Hits parent/children gswitch group.
//   layersPopover.js     #btn-layers open/close glue.
//   particlesPopover.js  #btn-cluster K-popover (per-particle toggles).
//
// Returns { closeLayersPanel, isOpen } so the keyboard-shortcut module can
// close the layers popover and inspect its state.

import { setupLayerTree } from './layersPanel/tree.js';
import { setupInnerOverlay } from './layersPanel/innerOverlay.js';
import { setupLayersPopover } from './layersPanel/layersPopover.js';
import { setupParticlesPopover } from './layersPanel/particlesPopover.js';

export function setupLayersPanel() {
  const { syncLayerToggles } = setupLayerTree();
  setupInnerOverlay();
  // setupAnchoredPopover auto-closes any other open popover on open() — see
  // the registry in anchoredPopover.js. No explicit closeOther wiring needed.
  const layers = setupLayersPopover({ syncLayerToggles });
  setupParticlesPopover();
  return {
    closeLayersPanel: layers.close,
    isOpen: layers.isOpen,
  };
}
