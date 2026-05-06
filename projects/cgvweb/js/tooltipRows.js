// @ts-check
// Pure HTML builder for the hover tooltip's extra-rows block. Lives in its
// own module so it can be tested without pulling Three.js / DOM / scene.
//
// Row layout per entry: <div class="trow"><span class="tkey">{key}</span>
// <span class="tval">{value}</span></div>
//
// Security contract:
//   - `keyHtml` is inserted raw so physics labels can use <sub>/<sup> /
//     entities (η, p_T, E_T^miss). Callers must NEVER pass anything derived
//     from external input (JiveXML, network, file upload) here. Today every
//     caller in hoverTooltip.js passes a literal constant or a curated
//     constant like _ETA_LABEL.
//   - `valueText` is HTML-escaped inside this module — safe to pass any
//     string, including raw fields parsed from JiveXML.
import { esc } from './utils.js';

/**
 * @param {ReadonlyArray<readonly [string, string | number]> | null | undefined} rows
 *   Each tuple is [keyHtml, valueText]. See module-level contract.
 * @returns {string}  HTML string to assign to a container's innerHTML.
 *   Empty array / null / undefined returns ''.
 */
export function buildExtrasHtml(rows) {
  if (!rows || !rows.length) return '';
  return rows
    .map(
      ([k, v]) =>
        `<div class="trow"><span class="tkey">${k}</span><span class="tval">${esc(v)}</span></div>`,
    )
    .join('');
}
