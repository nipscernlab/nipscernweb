// @ts-check
// Single source of truth for particle symbols + the PDG sign convention.
//
// Standard PDG numbering (https://pdg.lbl.gov/2024/reviews/rpp2024-rev-monte-
// carlo-numbering.pdf): the particle ID for a charged lepton is positive,
// the anti-particle's is negative.
//   pdgId = +11 → e⁻ (electron, negative charge)
//   pdgId = -11 → e⁺ (positron, positive charge)
//   pdgId = +13 → μ⁻ (muon, negative)
//   pdgId = -13 → μ⁺ (anti-muon, positive)
//   pdgId = +15 → τ⁻ (tau, negative)
//   pdgId = -15 → τ⁺ (anti-tau, positive)
// Hence: pdg > 0 ⇒ negative-charge particle (the lepton).
//
// Centralising these helpers prevents the sign-inversion bug class — the
// codebase used to scatter `pdg < 0 ? '⁻' : '⁺'` checks across sprites,
// tooltips and material assignments, which all had to be flipped together
// when the convention error was caught.

/**
 * Letter + Unicode-superscript sign from a PDG ID. Returns the bare letter
 * when pdg is null/undefined — used for "matched but charge stripped" cases
 * (e.g. older XMLs without the <pdgId> field).
 *
 * @param {string} letter  e / μ / τ etc.
 * @param {number | null | undefined} pdg
 * @returns {string}
 */
export function leptonSymbol(letter, pdg) {
  if (pdg == null) return letter;
  return pdg > 0 ? `${letter}⁻` : `${letter}⁺`;
}

/**
 * τ symbol from the daughter-charge sum (which equals the τ charge for
 * physically-valid candidates — always ±1). 0 / null / undefined collapses
 * to plain "τ", marking the algorithm-seed candidates whose summed charge
 * doesn't match a real τ ("unmatched τ" in the K-popover).
 *
 * @param {number | null | undefined} c
 * @returns {string}
 */
export function tauSymbolFromCharge(c) {
  if (c == null || c === 0) return 'τ';
  return c < 0 ? 'τ⁻' : 'τ⁺';
}

/**
 * Boolean: this PDG identifies a negatively-charged particle (the lepton,
 * not the anti-lepton). Used by colour-selection sites that pick between
 * "negative" and "positive" materials for the matched track.
 *
 * @param {number | null | undefined} pdg
 * @returns {boolean}
 */
export function isLeptonNegative(pdg) {
  return pdg != null && pdg > 0;
}
