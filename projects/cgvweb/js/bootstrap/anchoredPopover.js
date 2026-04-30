// @ts-check
// Shared open/close + bottom-anchored positioning for the toolbar popovers
// (Layers, Particles, Helpers). All popovers built through this helper are
// mutually exclusive: opening one auto-closes any other that's currently open
// (registry below). Click outside the panel also closes it.

/** @type {Set<{ open: () => void, close: () => void, isOpen: () => boolean }>} */
const _all = new Set();

/**
 * @param {{
 *   panelId: string,
 *   anchorId: string,
 *   defaultWidth: number,
 *   onOpen?: () => void,
 *   onClose?: () => void,
 * }} cfg
 */
export function setupAnchoredPopover({ panelId, anchorId, defaultWidth, onOpen, onClose }) {
  const panel = document.getElementById(panelId);
  let isOpen = false;

  /** @type {{ open: () => void, close: () => void, isOpen: () => boolean }} */
  const api = {
    open() {
      if (!panel) return;
      // Close every other popover before opening — only one anchored popover
      // is allowed on screen at a time.
      for (const other of _all) if (other !== api && other.isOpen()) other.close();
      isOpen = true;
      panel.classList.add('open');
      if (onOpen) onOpen();
      const anchor = document.getElementById(anchorId);
      if (!anchor) return;
      const br = anchor.getBoundingClientRect();
      requestAnimationFrame(() => {
        const pw = panel.offsetWidth || defaultWidth;
        let left = br.left + br.width / 2 - pw / 2;
        left = Math.max(6, Math.min(left, window.innerWidth - pw - 6));
        // Anchor the panel's bottom 10px above the button's top so expanding
        // a sub-tree grows the panel upward instead of pushing it past the
        // toolbar. Cap max-height to the available space so internal
        // scrolling kicks in when content overflows the viewport.
        panel.style.left = `${left}px`;
        panel.style.top = '';
        panel.style.bottom = `${window.innerHeight - br.top + 10}px`;
        panel.style.maxHeight = `${Math.max(120, br.top - 16)}px`;
      });
    },
    close() {
      if (!panel) return;
      isOpen = false;
      panel.classList.remove('open');
      if (onClose) onClose();
    },
    isOpen: () => isOpen,
  };
  _all.add(api);

  // Click outside the popover closes it; clicks INSIDE are stopped from
  // bubbling so they don't trigger the document-level close.
  document.addEventListener('click', () => {
    if (isOpen) api.close();
  });
  if (panel) panel.addEventListener('click', (e) => e.stopPropagation());

  return api;
}
