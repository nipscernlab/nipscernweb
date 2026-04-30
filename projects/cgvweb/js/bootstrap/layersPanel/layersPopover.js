// Layers popover (#btn-layers) — the open/close glue + button click handler.
// The actual layer-tree DOM and click handling live in tree.js; this module
// just opens/closes the panel and keeps the button's "on" indicator wired
// through syncLayerToggles.

import { setupAnchoredPopover } from '../anchoredPopover.js';

/** @param {{ syncLayerToggles: () => void }} deps */
export function setupLayersPopover({ syncLayerToggles }) {
  const popover = setupAnchoredPopover({
    panelId: 'layers-panel',
    anchorId: 'btn-layers',
    defaultWidth: 210,
    onOpen: () => document.getElementById('btn-layers').classList.add('on'),
    // Close: btn-layers stays "on" iff at least one layer is on. syncLayerToggles
    // already encodes this rule; piggy-back on it instead of duplicating.
    onClose: syncLayerToggles,
  });
  document.getElementById('btn-layers').addEventListener('click', (e) => {
    e.stopPropagation();
    popover.isOpen() ? popover.close() : popover.open();
  });
  return popover;
}
