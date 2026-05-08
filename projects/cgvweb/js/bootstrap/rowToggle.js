// Row-level toggle: clicking anywhere on a `.layer-row` (non-parent) or
// `.sett-row` forwards the click to the inner `.gswitch`. The user
// shouldn't have to aim at the small switch — the whole row is the
// hit target.
//
// Skip rules:
//  • If the click target is the gswitch itself (or inside it), do nothing —
//    let the existing handler fire normally.
//  • If the row is `.layer-row-parent`, do nothing — those rows already
//    expand/collapse the sub-tree on click (handled elsewhere).
//  • If the click is on another interactive child (a button, link, input),
//    do nothing — let that element's handler run.

const INTERACTIVE = 'a, button, input, select, textarea, [role="button"]';

export function setupRowToggle() {
  // Capture phase: each popover (#layers-panel, #helpers-panel, etc.) has a
  // bubble-phase stopPropagation that would prevent a document-level bubble
  // delegate from ever firing for clicks inside it. Capture runs top-down
  // before any bubble handler can stop the event, so we get our chance.
  document.addEventListener(
    'click',
    (e) => {
      const target = /** @type {Element|null} */ (e.target);
      if (!target) return;

      const row = target.closest('.layer-row, .sett-row');
      if (!row) return;
      if (row.classList.contains('layer-row-parent')) return;

      // Click already on the switch (or any other actionable child) → bail
      // and let that element's own handler run normally.
      if (target.closest('.gswitch')) return;
      const interactive = target.closest(INTERACTIVE);
      if (interactive && interactive !== row && row.contains(interactive)) return;

      const sw = /** @type {HTMLElement|null} */ (row.querySelector('.gswitch'));
      if (!sw) return;
      // Forward to the switch. The synthetic click triggers its own
      // capture/bubble pass; this handler's early-bail above keeps the
      // forwarded click from being re-routed into infinite recursion.
      sw.click();
    },
    true,
  );

  // Make the cursor advertise the larger hit target. CSS could do this
  // alone, but keeping it next to the wiring keeps the contract obvious.
  const style = document.createElement('style');
  style.textContent = `
    .layer-row:not(.layer-row-parent),
    .sett-row {
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}
