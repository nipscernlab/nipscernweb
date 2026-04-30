// @ts-check
// Three.js groups for the per-event objects (tracks, photons, electrons,
// muons, clusters, jets, taus, MET arrows, vertex markers) plus the small
// "user intent" booleans for the J / K toolbar toggles.
//
// Each setter is called once when the group is built in processXml; the
// view-level gate then enables / disables them when the user moves between
// levels 1 / 2 / 3 via applyDetectorGroupViewLevel(), invoked from
// visibility.js's _applyViewLevelGate. All visibility decisions route
// through the per-group `_isXGroupVisible` predicates, so the rule for
// each group lives in one place.
//
// No Three.js is imported directly here — the groups arrive from outside,
// already constructed; we only flip mesh.visible / group.visible. That keeps
// this module pure-ish so it can be tested in node with a stub group object.
import { getViewLevel } from '../viewLevel.js';
import { isRealMuon, isUnmatchedMuon } from '../trackMaterials.js';

/**
 * Structural type that fits THREE.Group / THREE.Object3D without importing
 * Three.js. Visibility consumers (visibility.applyTrackThreshold, etc.) read
 * `children[i].userData.<thing>`, so the children's userData is part of the
 * shape.
 * @typedef {{
 *   visible: boolean,
 *   children?: ReadonlyArray<{ visible: boolean, userData: Record<string, any> }>,
 * }} VisibleObject
 */

// ── Group references ─────────────────────────────────────────────────────────
/** @type {VisibleObject | null} */ let _trackGroup = null;
/** @type {VisibleObject | null} */ let _photonGroup = null;
/** @type {VisibleObject | null} */ let _electronGroup = null;
/** @type {VisibleObject | null} */ let _muonGroup = null;
/** @type {VisibleObject | null} */ let _tauLabelGroup = null;
/** @type {VisibleObject | null} */ let _clusterGroup = null;
/** @type {VisibleObject | null} */ let _jetGroup = null;
/** @type {VisibleObject | null} */ let _tauGroup = null;
/** @type {VisibleObject | null} */ let _metGroup = null;
/** @type {VisibleObject | null} */ let _vertexGroup = null;

// ── User-intent toggles ──────────────────────────────────────────────────────
// Tracks toggle (J button): controls only the track lines. Photons and
// electrons are no longer linked to this flag — their visibility comes from
// the view level (level 3 shows them).
let _tracksVisible = true;
// User intent for the cluster toggle (K button at level 2). The cluster group
// is only actually shown when level === 2 AND the user has clusters enabled.
let _clustersVisible = true;
// Per-particle-type toggles (level-3 only, controlled from the K-button
// popover). Each AND-s with `level === 3` in applyDetectorGroupViewLevel.
let _jetsVisible = true; // jet η/φ centerlines
let _photonsVisible = true; // photon "spring" lines
let _metVisible = true; // MET arrow
// τ jet lines (purple) share the K-popover "Jet lines" toggle with the
// orange jets — physically a hadronic τ IS a narrow jet, so toggling jets
// off and leaving τ lines hovering would visually misrepresent the event.
// No standalone tau toggle.
// Track-line subset filters (level-3 popover): hide only the matched subset
// of trackGroup.children. The J button still gates the whole trackGroup,
// these add a second pass on top. Filters live in applyParticleTrackFilters
// below.
let _electronTracksVisible = true;
let _muonTracksVisible = true;
let _tauTracksVisible = true;
// Tracks with no electron / muon / jet / τ match and no muon-chamber hit —
// these render in the default yellow TRACK_MAT (see trackAtlasIntersections's
// _applyTrackMaterials priority chain). Off by default so the user lands on
// a clean view that only shows the labelled physics; flip on via the K
// popover when the soft-track background context is wanted.
let _unmatchedTracksVisible = false;
// Photons whose (η, φ) sits OUTSIDE every visible jet / τ-jet cone — i.e.
// γ candidates not associated to a hadronic jet. Default off so the user
// lands on the labelled-physics view; flip on via the K popover when the
// raw photon background is wanted.
let _unmatchedPhotonsVisible = false;
// τ candidates whose summed daughter charge isn't ±1 — physically impossible
// for a real τ (always charge=±1), so they're algorithm seeds that grouped
// the wrong tracks (over-merged blobs, opposite-sign pairs, etc). Off by
// default so the user lands on a clean view of physically-plausible τ; flip
// on to inspect the seed-level candidates.
let _unmatchedTausVisible = false;
// Tracks with exactly one of (matchedToMuon, reachesChambers) true — i.e.
// either the heuristic ΔR matcher claimed the track but it doesn't reach
// the spectrometer (likely wrong polyline), or the track does pass through
// chambers but no <Muon> in the XML matched it (ΔR cap too tight after
// toroid bending). Real muons require BOTH flags. Off by default; flip on
// to inspect the half-evidence cases.
let _unmatchedMuonsVisible = false;
// e± / μ± / τ± lepton-label sprites (anchored to matched tracks). Single
// gate over all three label groups — when the user just wants to see the
// coloured tracks without the floating symbols on top. Default on so the
// labelled-physics view stays the entry point.
let _particleLabelsVisible = true;
// Vertex markers (primary, pile-up, b-tag dots). Event-level summary info —
// applies at every view level, so no level gate. Default on; the user can
// hide them via the Helpers popover when they get in the way of close-zooms
// inside the inner detector.
let _verticesVisible = true;

// ── Read accessors ───────────────────────────────────────────────────────────
export const getTrackGroup = () => _trackGroup;
export const getPhotonGroup = () => _photonGroup;
export const getElectronGroup = () => _electronGroup;
export const getMuonGroup = () => _muonGroup;
export const getTauLabelGroup = () => _tauLabelGroup;
export const getClusterGroup = () => _clusterGroup;
export const getJetGroup = () => _jetGroup;
export const getTauGroup = () => _tauGroup;
export const getMetGroup = () => _metGroup;
export const getVertexGroup = () => _vertexGroup;

export const getTracksVisible = () => _tracksVisible;
export const getClustersVisible = () => _clustersVisible;
export const getJetsVisible = () => _jetsVisible;
export const getPhotonsVisible = () => _photonsVisible;
export const getMetVisible = () => _metVisible;
export const getElectronTracksVisible = () => _electronTracksVisible;
export const getMuonTracksVisible = () => _muonTracksVisible;
export const getTauTracksVisible = () => _tauTracksVisible;
export const getUnmatchedTracksVisible = () => _unmatchedTracksVisible;
export const getUnmatchedPhotonsVisible = () => _unmatchedPhotonsVisible;
export const getUnmatchedTausVisible = () => _unmatchedTausVisible;
export const getUnmatchedMuonsVisible = () => _unmatchedMuonsVisible;
export const getParticleLabelsVisible = () => _particleLabelsVisible;
export const getVerticesVisible = () => _verticesVisible;

// ── Visibility predicates (single source of truth for each group's gate) ─────
// Every setter and the level gate route through these — so a change to (say)
// the electron rule lands in one place instead of half a dozen.
const _isPhotonGroupVisible = () => _photonsVisible && getViewLevel() === 3;
const _isElectronGroupVisible = () =>
  _tracksVisible && _electronTracksVisible && getViewLevel() === 3;
const _isMuonGroupVisible = () => _tracksVisible && _muonTracksVisible && getViewLevel() === 3;
// τ labels are sprites anchored on matched daughter tracks — gated by the
// same J / K-popover / level rules as the lepton sprite groups, swapping in
// the τ-track toggle. (The eta/φ τ LINES live in _tauGroup, gated by jets.)
// The Track Labels toggle (`_particleLabelsVisible`) is NOT in any of these
// predicates — it's enforced per-sprite by syncParticleLabelVisibility so
// the same code path can also gate the ν sprite that lives inside _metGroup
// alongside the always-on shaft + cone (no group-level switch can do that).
const _isTauLabelGroupVisible = () => _tracksVisible && _tauTracksVisible && getViewLevel() === 3;
const _isClusterGroupVisible = () => _clustersVisible && getViewLevel() === 2;
const _isJetGroupVisible = () => _jetsVisible && getViewLevel() === 3;
const _isTauGroupVisible = () => _jetsVisible && getViewLevel() === 3;
const _isMetGroupVisible = () => _metVisible && getViewLevel() === 3;

// Push the predicate onto the actual group ref. No-op when the group hasn't
// been built yet for the current event.
const _refreshPhoton = () => {
  if (_photonGroup) _photonGroup.visible = _isPhotonGroupVisible();
};
const _refreshElectron = () => {
  if (_electronGroup) _electronGroup.visible = _isElectronGroupVisible();
};
const _refreshMuon = () => {
  if (_muonGroup) _muonGroup.visible = _isMuonGroupVisible();
};
const _refreshTauLabel = () => {
  if (_tauLabelGroup) _tauLabelGroup.visible = _isTauLabelGroupVisible();
};
const _refreshCluster = () => {
  if (_clusterGroup) _clusterGroup.visible = _isClusterGroupVisible();
};
const _refreshJet = () => {
  if (_jetGroup) _jetGroup.visible = _isJetGroupVisible();
};
const _refreshTau = () => {
  if (_tauGroup) _tauGroup.visible = _isTauGroupVisible();
};
const _refreshMet = () => {
  if (_metGroup) _metGroup.visible = _isMetGroupVisible();
};

// ── Group registration (called once per group at event load) ─────────────────
/** @param {VisibleObject | null} g */
export function setTrackGroup(g) {
  _trackGroup = g;
  if (g) g.visible = _tracksVisible;
}
/** @param {VisibleObject | null} g */
export function setPhotonGroup(g) {
  _photonGroup = g;
  _refreshPhoton();
}
/** @param {VisibleObject | null} g */
export function setElectronGroup(g) {
  _electronGroup = g;
  _refreshElectron();
}
/** @param {VisibleObject | null} g */
export function setMuonGroup(g) {
  _muonGroup = g;
  _refreshMuon();
}
/** @param {VisibleObject | null} g */
export function setTauLabelGroup(g) {
  _tauLabelGroup = g;
  _refreshTauLabel();
}
/** @param {VisibleObject | null} g */
export function setClusterGroup(g) {
  _clusterGroup = g;
  _refreshCluster();
}
/** @param {VisibleObject | null} g */
export function setJetGroup(g) {
  _jetGroup = g;
  _refreshJet();
}
/** @param {VisibleObject | null} g */
export function setTauGroup(g) {
  _tauGroup = g;
  _refreshTau();
}
/** @param {VisibleObject | null} g */
export function setMetGroup(g) {
  _metGroup = g;
  _refreshMet();
}
// Vertices are event-level summary info — relevant at every view level. The
// only gate is the user's Helpers-popover toggle (_verticesVisible).
/** @param {VisibleObject | null} g */
export function setVertexGroup(g) {
  _vertexGroup = g;
  if (g) g.visible = _verticesVisible;
}

// ── Toolbar toggles ──────────────────────────────────────────────────────────
/** @param {boolean} v */
export function setTracksVisible(v) {
  _tracksVisible = v;
  if (_trackGroup) _trackGroup.visible = v;
  // e±/μ±/τ± labels are anchored to track polylines — hide / restore them with
  // the J button (subject to L3 + K-popover flag, applied by the predicates).
  _refreshElectron();
  _refreshMuon();
  _refreshTauLabel();
}
/** @param {boolean} v */
export function setClustersVisible(v) {
  _clustersVisible = v;
  _refreshCluster();
}
/** @param {boolean} v */
export function setJetsVisible(v) {
  _jetsVisible = v;
  _refreshJet();
  // τ jet lines share this toggle (see _isTauGroupVisible — they're a kind
  // of narrow jet).
  _refreshTau();
}
/** @param {boolean} v */
export function setPhotonsVisible(v) {
  _photonsVisible = v;
  _refreshPhoton();
}
/** @param {boolean} v */
export function setMetVisible(v) {
  _metVisible = v;
  _refreshMet();
}
// Track-subset setters: applyParticleTrackFilters() walks trackGroup.children
// and applies the matched-track flags. The electron / muon flags ALSO refresh
// their label-sprite group's visibility — sprites were built once at draw
// time (see particles.js) and live until the next event load.
/** @param {boolean} v */
export function setElectronTracksVisible(v) {
  _electronTracksVisible = v;
  _refreshElectron();
}
/** @param {boolean} v */
export function setMuonTracksVisible(v) {
  _muonTracksVisible = v;
  _refreshMuon();
}
/** @param {boolean} v */
export function setTauTracksVisible(v) {
  _tauTracksVisible = v;
  _refreshTauLabel();
}
/** @param {boolean} v */
export function setUnmatchedTracksVisible(v) {
  _unmatchedTracksVisible = v;
}
/** @param {boolean} v */
export function setUnmatchedPhotonsVisible(v) {
  _unmatchedPhotonsVisible = v;
}
/** @param {boolean} v */
export function setUnmatchedTausVisible(v) {
  _unmatchedTausVisible = v;
}
/** @param {boolean} v */
export function setUnmatchedMuonsVisible(v) {
  _unmatchedMuonsVisible = v;
}
/** @param {boolean} v */
export function setParticleLabelsVisible(v) {
  _particleLabelsVisible = v;
  // No refresh hooks here — the gate is enforced per-sprite by
  // syncParticleLabelVisibility (in particles.js), which the toggle handler
  // calls right after this. That central pass walks every group containing
  // sprites tagged userData.isParticleLabel (electron, muon, tau-label,
  // met) and applies the labels-on / anchor-visible / τ-extras combination.
}
/** @param {boolean} v */
export function setVerticesVisible(v) {
  _verticesVisible = v;
  if (_vertexGroup) _vertexGroup.visible = v;
}

/**
 * Re-applies the per-group level gate. Called from visibility.js's
 * _applyViewLevelGate whenever the user switches between view levels.
 * Tracks (and the always-on vertex group) are unaffected. Each refresh
 * reads getViewLevel() through its predicate, so the level isn't an
 * argument here.
 */
export function applyDetectorGroupViewLevel() {
  _refreshCluster();
  _refreshPhoton();
  _refreshElectron();
  _refreshMuon();
  _refreshTauLabel();
  _refreshJet();
  _refreshTau();
  _refreshMet();
}

/**
 * Filters the track-line group by the three matched-particle flags. A line
 * stays visible when none of the three "Off" rules applies; the function
 * does NOT override visibility set by applyTrackThreshold (per-track |pT|
 * threshold) — both gates AND together via direct .visible writes.
 *
 * Called from applyTrackThreshold and from the K-popover handlers.
 */
export function applyParticleTrackFilters() {
  if (!_trackGroup) return;
  // Unmatched-tracks filter only kicks in at level 3 — at L1 (Hits) and L2
  // (Clusters) the user is looking at raw / cluster context, where stripping
  // the soft-track background would be confusing. Match flags only mean
  // anything alongside the L3 lepton/jet colouring anyway.
  const filterUnmatched = !_unmatchedTracksVisible && getViewLevel() === 3;
  for (const child of _trackGroup.children ?? []) {
    const u = child.userData;
    // pT threshold already vetoed this line — there's nothing for the panel
    // toggles to do, but reset the flag so a stale `particleHidden` from a
    // previous toggle state can't sneak this line back into the chamber
    // lighting filter (updateTrackAtlasIntersections ORs particleHidden in).
    const ptVisible = child.visible !== false;
    let hide = false;
    // Two flavours of "hidden" — track is invisible either way, but they
    // differ in whether updateTrackAtlasIntersections still treats the
    // track as physics for chamber lighting:
    //   physicsHide = true  ⇒ user said "hide the LINE but keep the muon"
    //                          (Muon Tracks toggle off, etc) → particleHidden=true,
    //                          chambers stay lit.
    //   physicsHide = false ⇒ track has no real muon attached (Unmatched μ
    //                          toggle off) → particleHidden stays false so
    //                          the chamber-lighting pass drops it too.
    let physicsHide = true;
    if (ptVisible) {
      if (!_electronTracksVisible && u.matchedElectronPdgId != null) {
        hide = true;
      } else if (
        !_muonTracksVisible &&
        (u.isMuonMatched || u.storeGateKey === 'CombinedMuonTracks')
      ) {
        // Muon Tracks toggle hides the LINE for every track in the muon
        // pool. Chambers stay lit for real μ (physics preserved); unmatched
        // μ chambers stay only when the user separately opted in via
        // Unmatched μ — otherwise they drop with the line. So the two
        // toggles compose here in the single place where both apply.
        hide = true;
        if (!isRealMuon(child) && !_unmatchedMuonsVisible) physicsHide = false;
      } else if (!_tauTracksVisible && u.isTauMatched) {
        hide = true;
        // Unmatched τ daughter: track belongs to a τ candidate whose summed
        // daughter charge isn't ±1 (impossible for a real τ — algorithm seed
        // junk). Only hide when the track has no other identification —
        // tracks shared with a jet stay because the orange line represents
        // the jet, not the τ. Mirrors the eta/φ-line gate in
        // applyTauPtThreshold so the entire unmatched τ visual goes away.
      } else if (
        !_unmatchedTausVisible &&
        u.isTauMatched &&
        u.matchedTauCharge !== -1 &&
        u.matchedTauCharge !== 1 &&
        u.matchedElectronPdgId == null &&
        !u.isMuonMatched &&
        !u.isJetMatched
      ) {
        hide = true;
        // Unmatched μ — Muon Tracks is ON (the previous branch didn't
        // fire) but the user has Unmatched μ off. Hide the half-evidence
        // track and drop its chamber lighting too: no <Muon> ↔ track pair
        // means no real muon physics behind those chambers. Only fires
        // when nothing higher-priority claimed the track — jet/τ-matched
        // unmatched-μ candidates keep their own identity.
      } else if (
        !_unmatchedMuonsVisible &&
        isUnmatchedMuon(child) &&
        u.matchedElectronPdgId == null &&
        !u.isJetMatched &&
        !u.isTauMatched
      ) {
        hide = true;
        physicsHide = false;
        // Unmatched / yellow tracks: nothing in the priority chain claimed them.
        // _applyTrackMaterials would render these in TRACK_MAT.
      } else if (
        filterUnmatched &&
        u.matchedElectronPdgId == null &&
        !u.isMuonMatched &&
        !u.isJetMatched &&
        !u.isTauMatched &&
        !u.isHitTrack
      ) {
        hide = true;
      }
    }
    if (hide) child.visible = false;
    // particleHidden = "the panel hid this line, but it's still real". The
    // chamber-lighting pass treats those tracks as geometrically present so a
    // muon chamber stays lit when the user only wanted to hide the muon LINE,
    // not delete the underlying physics. Cleared whenever the line is allowed
    // through (or pT-killed) so the flag can't go stale across toggle flips.
    // Unmatched-μ hides clear it too — those tracks have no real <Muon>, so
    // dropping them from chamber lighting is the right call.
    u.particleHidden = hide && physicsHide;
  }
}

// Returns the cone radius for a jet line — AntiKt10 collections (R = 1.0,
// boosted W/Z/top tagging) vs AntiKt4 / everything else (R = 0.4, the default
// hadronic-jet size). Read off the storeGateKey stamped by drawJets.
/** @param {{ userData: Record<string, any> }} line */
function _jetConeR(line) {
  return String(line.userData.storeGateKey ?? '').includes('AntiKt10') ? 1.0 : 0.4;
}
// τ jets are narrow by construction (R ≈ 0.2-0.4 in the algorithm); use 0.4
// to be permissive — the user's intent is "this photon is part of a τ jet".
const _TAU_CONE_R = 0.4;

/**
 * @param {number} eta1
 * @param {number} phi1
 * @param {number} eta2
 * @param {number} phi2
 */
function _deltaR(eta1, phi1, eta2, phi2) {
  const dEta = eta1 - eta2;
  let dPhi = phi1 - phi2;
  if (dPhi > Math.PI) dPhi -= 2 * Math.PI;
  else if (dPhi < -Math.PI) dPhi += 2 * Math.PI;
  return Math.sqrt(dEta * dEta + dPhi * dPhi);
}

/**
 * @param {number} eta
 * @param {number} phi
 */
function _isInsideAnyVisibleJetOrTau(eta, phi) {
  if (_jetGroup) {
    for (const line of _jetGroup.children ?? []) {
      if (!line.visible) continue;
      const r = _jetConeR(line);
      if (_deltaR(eta, phi, line.userData.eta, line.userData.phi) < r) return true;
    }
  }
  if (_tauGroup) {
    for (const line of _tauGroup.children ?? []) {
      if (!line.visible) continue;
      if (_deltaR(eta, phi, line.userData.eta, line.userData.phi) < _TAU_CONE_R) return true;
    }
  }
  return false;
}

/**
 * Hides photon springs whose (η, φ) falls outside every visible jet / τ-jet
 * cone — gated by the K-popover "Unmatched Photons" toggle (off by default).
 * Runs after the track-threshold pT pass set per-line .visible; this filter
 * only ever HIDES on top of that, never re-shows. L3-only for the same
 * reason as the unmatched-tracks filter — jet/τ matches only mean anything
 * alongside the L3 lepton/jet colouring.
 *
 * Called from applyTrackThreshold; the implicit caller order means jet/τ
 * line visibility is already up to date by the time we read it (jets are
 * applied via applyJetThreshold's own pT pass + recomputeJetTrackMatch
 * BEFORE this runs).
 */
export function applyPhotonFilters() {
  if (!_photonGroup) return;
  if (_unmatchedPhotonsVisible || getViewLevel() !== 3) return;
  for (const child of _photonGroup.children ?? []) {
    if (child.visible === false) continue;
    const u = child.userData;
    if (!Number.isFinite(u.eta) || !Number.isFinite(u.phi)) continue;
    if (!_isInsideAnyVisibleJetOrTau(u.eta, u.phi)) child.visible = false;
  }
}
