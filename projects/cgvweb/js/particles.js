import * as THREE from 'three';
import { scene } from './renderer.js';
import {
  getTrackGroup,
  getPhotonGroup,
  getElectronGroup,
  getMuonGroup,
  getClusterGroup,
  getJetGroup,
  getTauGroup,
  setTrackGroup,
  setPhotonGroup,
  setElectronGroup,
  setMuonGroup,
  setClusterGroup,
  setJetGroup,
  setTauGroup,
  applyTrackThreshold,
  applyClusterThreshold,
  applyJetThreshold,
  applyTauPtThreshold,
} from './visibility.js';
import {
  TRACK_MAT,
  updateTrackAtlasIntersections,
  recomputeElectronTrackMatch,
  recomputeTauTrackMatch,
  recomputeMuonTrackMatch,
} from './trackAtlasIntersections.js';
import { getViewLevel } from './viewLevel.js';
import { makeLabelSprite } from './labelSprite.js';

// ── Cluster line rendering ────────────────────────────────────────────────────
// Lines are drawn from the origin in the η/φ direction, 5 m = 5000 mm long.
// Coordinate convention matches tracks: Three.js X = −ATLAS x, Y = −ATLAS y.
const CLUSTER_MAT = new THREE.LineDashedMaterial({
  color: 0xff4400,
  transparent: true,
  opacity: 0.2,
  dashSize: 40,
  gapSize: 60,
  depthWrite: false,
});
const PHOTON_MAT = new THREE.LineBasicMaterial({
  color: 0xffcc00,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
});

const PHOTON_PRE_INNER_MM = 400; // spring spans the last 40 cm of the photon path
const PHOTON_SPRING_R = 20; // helix radius in mm
const PHOTON_SPRING_TURNS_PER_MM = 0.014; // coils per mm of track length
const PHOTON_SPRING_PTS = 22; // points sampled per coil (smoothness)

// Electron / positron labels: only the "e-" / "e+" sprite is rendered now —
// the matched track itself (coloured red / green by recomputeElectronTrackMatch)
// stands in for the old red/green arrow that pointed into the inner cylinder.
const ELECTRON_NEG_COLOR = 0xff3030;
const ELECTRON_POS_COLOR = 0x33dd55;
// Push the sprite slightly outward (radially in the xy plane) so it doesn't
// sit directly on top of the line at the calorimeter face.
const ELECTRON_LABEL_RADIAL_OFFSET_MM = 120;
// Muon labels: blue, matching the TRACK_HIT_MAT colour painted on muon tracks
// by the muon-chamber-hit raycast. Charge is read from the label text
// (μ- / μ+), so a single colour is enough — splitting like the e± red/green
// would just add visual noise on top of an already-blue line.
const MUON_LABEL_COLOR = 0x4a90d9;

// Inner cylinder (start): r = 1.4 m, h = 6.4 m
const CLUSTER_CYL_IN_R = 1421.73;
const CLUSTER_CYL_IN_HALF_H = 3680.75;
// Outer cylinder (end):   r = 4.25 m, h = 12 m
const CLUSTER_CYL_OUT_R = 3820;
const CLUSTER_CYL_OUT_HALF_H = 6000;

// Returns t at which the unit-direction ray (dx,dy,dz) from the origin hits
// the surface of a cylinder with given radius and half-height.
function _cylIntersect(dx, dy, dz, r, halfH) {
  const rT = Math.sqrt(dx * dx + dy * dy);
  if (rT > 1e-9) {
    const tBarrel = r / rT;
    if (Math.abs(dz * tBarrel) <= halfH) return tBarrel;
  }
  return halfH / Math.abs(dz);
}

// ── Tracks ────────────────────────────────────────────────────────────────────
export function clearTracks() {
  const g = getTrackGroup();
  if (!g) return;
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  scene.remove(g);
  setTrackGroup(null);
  updateTrackAtlasIntersections();
}

// Last drawn electrons cached so view-level changes can re-run the
// ΔR matching against the current track set.
let _lastElectrons = [];
export function getLastElectrons() {
  return _lastElectrons;
}

// JiveXML emits multiple track collections that are alternative fits of the
// same physical particles (GSFTracks duplicates electrons; the four muon
// variants — MSOnlyExtrapolated / Extrapolated / MuonSpectrometer /
// CombinedMuon — cover the same muon at different stages of reconstruction).
// Rendering all of them produces visually overlapping lines. Pick the two
// collections that show each particle in its most complete form:
//   CombinedInDetTracks  — every ID track (vertex → r ≈ 1 m).
//   CombinedMuonTracks   — combined fit for muons; polyline runs from the
//                          vertex out through the muon chambers (r ≈ 9.7 m),
//                          which makes the track-vs-muon-chamber raycast
//                          fire and turns the muon blue end-to-end.
// The muon's ID portion appears in both collections (r ≈ 0-1 m), but having
// the full muon trajectory drawn as one continuous line outweighs that
// duplication for the user.
const _PRIMARY_TRACK_COLLECTIONS = new Set(['CombinedInDetTracks', 'CombinedMuonTracks']);

export function drawTracks(tracks) {
  clearTracks();
  if (!tracks.length) return;
  const g = new THREE.Group();
  g.renderOrder = 5;
  // Per-collection sequential index. JiveXML jets reference tracks via
  // (storeGateKey, trackIndex) where the index is the position within the
  // original Track block — matching that here lets jet→track highlighting
  // resolve `(InDetTrackParticles_xAOD, 39)` to a rendered line.
  const idxByKey = new Map();
  for (const { pts, ptGev, hitIds, storeGateKey } of tracks) {
    if (!_PRIMARY_TRACK_COLLECTIONS.has(storeGateKey)) continue;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, TRACK_MAT);
    line.userData.ptGev = ptGev;
    line.userData.hitIds = hitIds;
    line.userData.storeGateKey = storeGateKey;
    const idx = idxByKey.get(storeGateKey) ?? 0;
    idxByKey.set(storeGateKey, idx + 1);
    line.userData.indexInCollection = idx;
    // Geometric η/φ computed from origin → last polyline point. Tracks curve
    // in B-field so this is the angle at the calorimeter face, not at the
    // vertex; for high-pT tracks the difference is tiny. φ is reverted from
    // Three.js's negated convention back to ATLAS sign so it matches the
    // electron/photon η/φ in their XML form (used by ΔR matching).
    if (pts && pts.length) {
      const p = pts[pts.length - 1];
      const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      if (r > 1e-6) {
        const cosTheta = Math.max(-1, Math.min(1, p.z / r));
        const theta = Math.acos(cosTheta);
        line.userData.eta = -Math.log(Math.tan(theta / 2));
        line.userData.phi = Math.atan2(-p.y, -p.x);
      }
    }
    g.add(line);
  }
  scene.add(g);
  setTrackGroup(g); // stores ref + applies _tracksVisible
  applyTrackThreshold();
  updateTrackAtlasIntersections();
}

// ── Photons (Feynman-diagram wavy-line helix from the origin) ────────────────
function _makeSpringPoints(dx, dy, dz, totalLen, radius, nTurns, ptsPerTurn) {
  const fwd = new THREE.Vector3(dx, dy, dz).normalize();
  const ref = Math.abs(fwd.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(fwd, ref).normalize();
  const up = new THREE.Vector3().crossVectors(fwd, right).normalize();
  const startOffset = Math.max(0, totalLen - PHOTON_PRE_INNER_MM);
  const visibleLen = Math.max(0, totalLen - startOffset);
  const nTotal = nTurns * ptsPerTurn + 1;
  const pts = [];
  for (let i = 0; i < nTotal; i++) {
    const t = i / (nTotal - 1);
    const angle = t * nTurns * 2 * Math.PI;
    const along = startOffset + t * visibleLen;
    const cx = Math.cos(angle) * radius;
    const cy = Math.sin(angle) * radius;
    pts.push(
      new THREE.Vector3(
        fwd.x * along + right.x * cx + up.x * cy,
        fwd.y * along + right.y * cx + up.y * cy,
        fwd.z * along + right.z * cx + up.z * cy,
      ),
    );
  }
  return pts;
}

export function clearPhotons() {
  const g = getPhotonGroup();
  if (!g) return;
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  scene.remove(g);
  setPhotonGroup(null);
}

export function drawPhotons(photons) {
  clearPhotons();
  if (!photons.length) return;
  const g = new THREE.Group();
  g.renderOrder = 7;
  for (const { eta, phi, ptGev } of photons) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const tEnd = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
    const nTurns = Math.round(PHOTON_SPRING_TURNS_PER_MM * Math.min(PHOTON_PRE_INNER_MM, tEnd));
    const pts = _makeSpringPoints(dx, dy, dz, tEnd, PHOTON_SPRING_R, nTurns, PHOTON_SPRING_PTS);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, PHOTON_MAT);
    line.userData.ptGev = ptGev;
    line.userData.eta = eta;
    line.userData.phi = phi;
    g.add(line);
  }
  scene.add(g);
  setPhotonGroup(g);
  applyTrackThreshold();
}

// ── Electrons / Positrons ─────────────────────────────────────────────────────
// The arrow into the inner cylinder is gone — the matched track itself (red
// for e-, green for e+, set by recomputeElectronTrackMatch) plays that role.
// Only the floating "e-" / "e+" sprite label remains, anchored to the matched
// track's outermost point and pushed slightly outward so it doesn't sit on
// top of the line.

// Sprite-creation helper lives in labelSprite.js — shared with metOverlay's
// ν label. Default world-h / screen-px values match the old electron tuning.

// Full electron reset: drops the cached parser list and removes the label
// group. Called by resetScene before a new XML loads.
export function clearElectrons() {
  _lastElectrons = [];
  _clearElectronGroupOnly();
}

// Removes only the rendered label group, preserving the cached _lastElectrons
// so subsequent syncs (level / track-threshold changes) can still re-run the
// match against the same electron list.
function _clearElectronGroupOnly() {
  const g = getElectronGroup();
  if (!g) return;
  g.traverse((o) => {
    if (o.isSprite && o.material?.map) o.material.map.dispose();
  });
  scene.remove(g);
  setElectronGroup(null);
}

// drawElectrons no longer renders a 3D arrow — the matched track itself stands
// in for that. We just stash the electron list (so the level-gate hook can
// re-run the ΔR match later) and trigger a sync that colours tracks and adds
// floating "e-" / "e+" labels at each matched track's outermost point.
export function drawElectrons(electrons) {
  clearElectrons();
  _lastElectrons = Array.isArray(electrons) ? electrons : [];
  syncElectronTrackMatch(getViewLevel() === 3 ? electrons : null);
}

// Walks the rendered tracks and creates one "e-" / "e+" sprite per match.
// Sprite is anchored partway along the polyline (not at the calo face) so it
// reads as "labelled track segment" rather than a marker at the end.
function _rebuildElectronLabels() {
  const trackGroup = getTrackGroup();
  const g = new THREE.Group();
  g.renderOrder = 7;
  let added = false;
  if (trackGroup) {
    for (const line of trackGroup.children) {
      const pdg = line.userData.matchedElectronPdgId;
      if (pdg == null) continue;
      const pos = line.geometry?.getAttribute('position');
      if (!pos || pos.count < 1) continue;
      // ~half-way down the polyline — visually inside the inner detector,
      // away from the calorimeter face and the cell soup nearby.
      const idx = Math.floor((pos.count - 1) * 0.5);
      const x = pos.getX(idx);
      const y = pos.getY(idx);
      const z = pos.getZ(idx);
      const isElectron = pdg < 0;
      const label = makeLabelSprite(
        isElectron ? 'e-' : 'e+',
        isElectron ? ELECTRON_NEG_COLOR : ELECTRON_POS_COLOR,
      );
      const rLen = Math.hypot(x, y);
      const radX = rLen > 1e-6 ? x / rLen : 1;
      const radY = rLen > 1e-6 ? y / rLen : 0;
      label.position.set(
        x + radX * ELECTRON_LABEL_RADIAL_OFFSET_MM,
        y + radY * ELECTRON_LABEL_RADIAL_OFFSET_MM,
        z,
      );
      label.userData.pdgId = pdg;
      g.add(label);
      added = true;
    }
  }
  if (!added) return;
  scene.add(g);
  setElectronGroup(g);
}

// Single entry point used both by drawElectrons (fresh XML) and by the level
// gate / track-threshold hook (visibility.js): runs the ΔR match against the
// current track set and rebuilds the label sprites accordingly. Uses
// _clearElectronGroupOnly so the cached _lastElectrons survives.
export function syncElectronTrackMatch(electrons) {
  recomputeElectronTrackMatch(electrons);
  _clearElectronGroupOnly();
  if (electrons && electrons.length) _rebuildElectronLabels();
}

// ── Muons / Anti-muons ────────────────────────────────────────────────────────
// Mirrors the electron pipeline: the matched track is already coloured blue
// by the muon-chamber-hit raycast (TRACK_HIT_MAT), so we don't repaint it —
// we just add a "μ-" / "μ+" sprite floating beside it. Sprite is anchored on
// the OUTER end of the CombinedMuonTrack polyline (~9-10 m), where the muon
// exits the spectrometer and the line is most distinctly visible.

let _lastMuons = [];
export function getLastMuons() {
  return _lastMuons;
}

export function clearMuons() {
  _lastMuons = [];
  _clearMuonGroupOnly();
}

function _clearMuonGroupOnly() {
  const g = getMuonGroup();
  if (!g) return;
  g.traverse((o) => {
    if (o.isSprite && o.material?.map) o.material.map.dispose();
  });
  scene.remove(g);
  setMuonGroup(null);
}

export function drawMuons(muons) {
  clearMuons();
  _lastMuons = Array.isArray(muons) ? muons : [];
  syncMuonTrackMatch(getViewLevel() === 3 ? muons : null);
}

function _rebuildMuonLabels() {
  const trackGroup = getTrackGroup();
  const g = new THREE.Group();
  g.renderOrder = 7;
  let added = false;
  if (trackGroup) {
    for (const line of trackGroup.children) {
      if (!line.userData.isMuonMatched) continue;
      const pos = line.geometry?.getAttribute('position');
      if (!pos || pos.count < 1) continue;
      // Last polyline point — sits at the muon-chamber edge (~9-10 m radius),
      // outside every other detector envelope. Putting the sprite there keeps
      // it readable from any zoom and makes the "this blue line is a muon"
      // mapping immediate.
      const idx = pos.count - 1;
      const x = pos.getX(idx);
      const y = pos.getY(idx);
      const z = pos.getZ(idx);
      // Sign convention follows the existing electron code: pdgId < 0 maps
      // to the negatively-charged lepton. When pdgId is null (parser couldn't
      // determine the sign) we drop the ± and render a plain "μ" — better
      // than guessing.
      const pdg = line.userData.matchedMuonPdgId;
      const text = pdg == null ? 'μ' : pdg < 0 ? 'μ-' : 'μ+';
      const label = makeLabelSprite(text, MUON_LABEL_COLOR);
      const rLen = Math.hypot(x, y);
      const radX = rLen > 1e-6 ? x / rLen : 1;
      const radY = rLen > 1e-6 ? y / rLen : 0;
      label.position.set(
        x + radX * ELECTRON_LABEL_RADIAL_OFFSET_MM,
        y + radY * ELECTRON_LABEL_RADIAL_OFFSET_MM,
        z,
      );
      label.userData.pdgId = pdg;
      g.add(label);
      added = true;
    }
  }
  if (!added) return;
  scene.add(g);
  setMuonGroup(g);
}

export function syncMuonTrackMatch(muons) {
  recomputeMuonTrackMatch(muons);
  _clearMuonGroupOnly();
  if (muons && muons.length) _rebuildMuonLabels();
}

// ── Clusters (η/φ lines between inner and outer cylinders) ───────────────────
export function clearClusters() {
  const g = getClusterGroup();
  if (!g) return;
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  scene.remove(g);
  setClusterGroup(null);
}

export function drawClusters(clusters) {
  clearClusters();
  if (!clusters.length) return;
  const g = new THREE.Group();
  g.renderOrder = 6;
  for (const { eta, phi, etGev, storeGateKey } of clusters) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const t0 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
    const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
    const start = new THREE.Vector3(dx * t0, dy * t0, dz * t0);
    const end = new THREE.Vector3(dx * t1, dy * t1, dz * t1);
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, CLUSTER_MAT);
    line.computeLineDistances();
    line.userData.etGev = etGev;
    line.userData.eta = eta;
    line.userData.phi = phi;
    line.userData.storeGateKey = storeGateKey ?? '';
    g.add(line);
  }
  scene.add(g);
  setClusterGroup(g);
  applyClusterThreshold();
}

// ── Jets (η/φ lines, same cylinder span as clusters but orange + dashed).
// Orange is reserved for jets so it doesn't collide with the muon-track blue;
// dashes mirror the cluster style and visually distinguish jets from tracks.
const JET_MAT = new THREE.LineDashedMaterial({
  color: 0xff8800,
  transparent: true,
  opacity: 0.75,
  dashSize: 40,
  gapSize: 60,
  depthWrite: false,
});

export function clearJets() {
  const g = getJetGroup();
  if (!g) return;
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  scene.remove(g);
  setJetGroup(null);
}

// Draws one line per jet in the given collection. `collection` is
// { key, jets: [...] } from jets.js (or null/empty). The collection's
// storeGateKey is stamped on each line so the hover tooltip can show it.
export function drawJets(collection) {
  clearJets();
  if (!collection || !collection.jets || !collection.jets.length) {
    // Still flush downstream effects (cell filter, jet→track highlight) so
    // stale state from a previous collection doesn't linger.
    applyJetThreshold();
    return;
  }
  const g = new THREE.Group();
  g.renderOrder = 6;
  const sgk = collection.key;
  for (const j of collection.jets) {
    const { eta, phi } = j;
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const t0 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
    const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
    const start = new THREE.Vector3(dx * t0, dy * t0, dz * t0);
    const end = new THREE.Vector3(dx * t1, dy * t1, dz * t1);
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, JET_MAT);
    // Required by LineDashedMaterial — without it the line renders as solid.
    line.computeLineDistances();
    line.userData.etGev = j.etGev;
    line.userData.ptGev = j.ptGev;
    line.userData.energyGev = j.energyGev;
    line.userData.massGev = j.massGev;
    line.userData.eta = eta;
    line.userData.phi = phi;
    line.userData.storeGateKey = sgk;
    g.add(line);
  }
  scene.add(g);
  setJetGroup(g);
  applyJetThreshold();
}

// ── Taus (η/φ lines, purple-dashed) ───────────────────────────────────────────
// Hadronic τ candidates. Same η/φ-line style as jets/clusters but a distinct
// purple to read against the orange jet lines, since taus and jets sometimes
// share the same direction (overlap removal isn't perfect in the XML).
const TAU_MAT = new THREE.LineDashedMaterial({
  color: 0xb366ff,
  transparent: true,
  opacity: 0.85,
  dashSize: 40,
  gapSize: 60,
  depthWrite: false,
});

// Cached tau list so the level gate can re-run the track match on re-entry to L3.
let _lastTaus = [];
export function getLastTaus() {
  return _lastTaus;
}

export function clearTaus() {
  _lastTaus = [];
  _clearTauGroupOnly();
}

function _clearTauGroupOnly() {
  const g = getTauGroup();
  if (!g) return;
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  scene.remove(g);
  setTauGroup(null);
}

// Draws one line per tau candidate. `taus` is the flat array out of
// tauParser. Stamps tooltip-relevant fields on each line's userData and runs
// the track-match sync so the τ's associated tracks pick up the purple colour.
export function drawTaus(taus) {
  clearTaus();
  _lastTaus = Array.isArray(taus) ? taus : [];
  if (!_lastTaus.length) {
    syncTauTrackMatch(null);
    return;
  }
  const g = new THREE.Group();
  g.renderOrder = 6;
  for (const t of _lastTaus) {
    const { eta, phi } = t;
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const t0 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
    const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
    const start = new THREE.Vector3(dx * t0, dy * t0, dz * t0);
    const end = new THREE.Vector3(dx * t1, dy * t1, dz * t1);
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, TAU_MAT);
    // LineDashedMaterial requirement.
    line.computeLineDistances();
    line.userData.ptGev = t.ptGev;
    line.userData.eta = eta;
    line.userData.phi = phi;
    line.userData.isTau = t.isTau;
    line.userData.numTracks = t.numTracks;
    line.userData.storeGateKey = t.key;
    g.add(line);
  }
  scene.add(g);
  setTauGroup(g);
  // Honour the L3 ET slider on first draw — without this, every τ would
  // render until the user nudges the slider.
  applyTauPtThreshold();
  syncTauTrackMatch(getViewLevel() === 3 ? _lastTaus : null);
}

// Single entry point for the τ→track colour update. Called by drawTaus on
// load and by the visibility level gate when entering / leaving L3.
export function syncTauTrackMatch(taus) {
  recomputeTauTrackMatch(taus);
}
