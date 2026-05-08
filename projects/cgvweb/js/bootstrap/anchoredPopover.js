// @ts-check
// Shared open/close + positioning for activity-bar popovers
// (Layers, Particles, Helpers). All popovers built through this helper are
// mutually exclusive: opening one auto-closes any other (registry below).
// Click outside the panel also closes it.
//
// Positioning is layout-aware:
//   • Vertical activity bar (desktop, left-side): popover anchors to the
//     RIGHT of the button, vertically centered then clamped to the
//     viewport. Vertical sub-tree growth scrolls inside the popover.
//   • Horizontal floating dock (mobile landscape, bottom-center): popover
//     anchors ABOVE the button so it doesn't fall off-screen.
//
// We detect orientation by querying #toolbar's bounding rect: if it sits on
// the left edge (left ≈ 0), we're vertical; otherwise horizontal.

/** @type {Set<{ open: () => void, close: () => void, isOpen: () => boolean }>} */
const _all = new Set();

const VIEWPORT_PAD = 8;

function isVerticalDock() {
  const tb = document.getElementById('toolbar');
  if (!tb) return true;
  const r = tb.getBoundingClientRect();
  // Vertical = sits on left edge AND taller than wide.
  return r.left < 8 && r.height > r.width;
}

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

  function position() {
    if (!panel) return;
    const anchor = document.getElementById(anchorId);
    if (!anchor) return;
    const br = anchor.getBoundingClientRect();
    const pw = panel.offsetWidth || defaultWidth;
    const ph = panel.offsetHeight || 320;

    panel.style.left = '';
    panel.style.top = '';
    panel.style.right = '';
    panel.style.bottom = '';
    panel.style.maxHeight = '';

    if (isVerticalDock()) {
      // Right-of-anchor placement.
      const left = Math.min(window.innerWidth - pw - VIEWPORT_PAD, br.right + 8);
      const maxH = window.innerHeight - 2 * VIEWPORT_PAD;
      let top = br.top + br.height / 2 - ph / 2;
      top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - ph - VIEWPORT_PAD));
      panel.style.left = `${Math.max(VIEWPORT_PAD, left)}px`;
      panel.style.top = `${top}px`;
      panel.style.maxHeight = `${maxH}px`;
    } else {
      // Above-anchor placement (horizontal mobile dock).
      let left = br.left + br.width / 2 - pw / 2;
      left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - pw - VIEWPORT_PAD));
      panel.style.left = `${left}px`;
      panel.style.bottom = `${window.innerHeight - br.top + 10}px`;
      panel.style.maxHeight = `${Math.max(120, br.top - 16)}px`;
    }
  }

  /** @type {{ open: () => void, close: () => void, isOpen: () => boolean }} */
  const api = {
    open() {
      if (!panel) return;
      for (const other of _all) if (other !== api && other.isOpen()) other.close();
      isOpen = true;
      panel.classList.add('open');
      if (onOpen) onOpen();
      requestAnimationFrame(position);
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

  document.addEventListener('click', () => {
    if (isOpen) api.close();
  });
  if (panel) panel.addEventListener('click', (e) => e.stopPropagation());

  // Re-position on resize / orientation change while the popover is open.
  window.addEventListener('resize', () => {
    if (isOpen) position();
  });

  return api;
}
