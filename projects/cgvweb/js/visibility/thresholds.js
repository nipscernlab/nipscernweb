// @ts-check
// Mutable threshold state — pure scalars + setters, no Three.js / scene
// deps so it can be unit-tested. visibility.js re-exports these so existing
// consumers keep their import path; live-binding semantics are preserved.
//
// Cell-energy thresholds are in MeV (matches the WASM-decoded cell records).
// Track / cluster / jet thresholds are in GeV (matches the slider UI).
//
// Slider min / max values are also stored here because the slider widget
// snaps to them when the user edits the input by hand. They are rebuilt per
// event from the actual data percentile range.

// ── Cell energy thresholds (MeV, per detector) ───────────────────────────────
export let thrTileMev = 50;
export let thrLArMev = 0;
export let thrHecMev = 600;
export let thrFcalMev = 0;

/** @param {number} v */
export function setThrTileMev(v) {
  thrTileMev = v;
}
/** @param {number} v */
export function setThrLArMev(v) {
  thrLArMev = v;
}
/** @param {number} v */
export function setThrHecMev(v) {
  thrHecMev = v;
}
/** @param {number} v */
export function setThrFcalMev(v) {
  thrFcalMev = v;
}

// ── Track |pT| threshold + slider range (GeV) ────────────────────────────────
export let thrTrackGev = 2;
export let trackPtMinGev = 0;
export let trackPtMaxGev = 5;

/** @param {number} v */
export function setThrTrackGev(v) {
  thrTrackGev = v;
}
/** @param {number} v */
export function setTrackPtMinGev(v) {
  trackPtMinGev = v;
}
/** @param {number} v */
export function setTrackPtMaxGev(v) {
  trackPtMaxGev = v;
}

// ── Cluster ET threshold + slider range (GeV, used at view level 2) ──────────
export let thrClusterEtGev = 3;
export let clusterEtMinGev = 0;
export let clusterEtMaxGev = 1;

/** @param {number} v */
export function setThrClusterEtGev(v) {
  thrClusterEtGev = v;
}
/** @param {number} v */
export function setClusterEtMinGev(v) {
  clusterEtMinGev = v;
}
/** @param {number} v */
export function setClusterEtMaxGev(v) {
  clusterEtMaxGev = v;
}

// ── Jet ET threshold + slider range (GeV, used at view level 3) ──────────────
// Independent from the cluster threshold — the slider in #rpanel2 reads /
// writes one or the other based on the current view level (level 2 = cluster,
// level 3 = jet).
export let thrJetEtGev = 20;
export let jetEtMinGev = 0;
export let jetEtMaxGev = 1;

/** @param {number} v */
export function setThrJetEtGev(v) {
  thrJetEtGev = v;
}
/** @param {number} v */
export function setJetEtMinGev(v) {
  jetEtMinGev = v;
}
/** @param {number} v */
export function setJetEtMaxGev(v) {
  jetEtMaxGev = v;
}
