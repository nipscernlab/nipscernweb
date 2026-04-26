import * as THREE from 'three';
import { canvas, camera, controls, markDirty } from './renderer.js';
import { active, rayTargets } from './state.js';
import { fcalGroup, fcalVisibleMap } from './visibility.js';
import {
  getTrackGroup,
  getPhotonGroup,
  getClusterGroup,
  getJetGroup,
  getTauGroup,
  getMetGroup,
  getVertexGroup,
} from './visibility.js';
import { showOutline, showFcalOutline, clearOutline } from './outlines.js';
import { showTrackHits, hideTrackHits } from './hitsOverlay.js';

export const tooltip = document.getElementById('tip');
export const tipCellEl = document.getElementById('tip-cell');
const tipCoordEl = document.getElementById('tip-coords');
export const tipEEl = document.getElementById('tip-e');
const tipEKeyEl = document.querySelector('#tip .tkey');
const tipExtraEl = document.getElementById('tip-extra');

// Builds the extra-rows HTML for one tooltip. Each row is a key/value pair in
// the same `.trow / .tkey / .tval` style as the energy row. innerHTML so the
// caller can use sub/sup/HTML entities for physics labels (e.g., η, p_T).
function _setExtras(rows) {
  if (!tipExtraEl) return;
  if (!rows || !rows.length) {
    tipExtraEl.innerHTML = '';
    return;
  }
  tipExtraEl.innerHTML = rows
    .map(
      ([k, v]) =>
        `<div class="trow"><span class="tkey">${k}</span><span class="tval">${v}</span></div>`,
    )
    .join('');
}

function _fmtEta(eta) {
  return Number.isFinite(eta) ? eta.toFixed(3) : '—';
}

// `.tkey` applies text-transform:uppercase, which would morph the lowercase
// Greek letter η (U+03B7) into uppercase Η (U+0397) — visually identical to a
// Latin H. Wrap Greek letters in a span that opts out of the transform.
const _ETA_LABEL = '<span style="text-transform:none">η</span>';

export function hideTooltip() {
  tooltip.hidden = true;
}

const raycast = new THREE.Raycaster();
raycast.firstHitOnly = true; // stop after first intersection (much faster)
raycast.params.Line = { threshold: 40 }; // 40 mm hit zone for ID tracks / photons
// Muon tracks live at much larger radii (~10 m) and are typically watched
// from further away, so they want a wider raycast threshold to be easy to
// hover over. Used by toggling raycast.params.Line.threshold around the
// muon-only intersect call below.
const _MUON_TRACK_THRESHOLD_MM = 80;
const _DEFAULT_TRACK_THRESHOLD_MM = 40;
const mxy = new THREE.Vector2();

let lastRay = 0;
let mousePos = { x: 0, y: 0 };

let _getShowInfo = () => true;
let _getCinemaMode = () => false;
let _t = (k) => k;

export function initHoverTooltip({ getShowInfo, getCinemaMode, t }) {
  if (getShowInfo) _getShowInfo = getShowInfo;
  if (getCinemaMode) _getCinemaMode = getCinemaMode;
  if (t) _t = t;

  document.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
    const now = Date.now();
    if (now - lastRay < 50) return;
    lastRay = now;
    doRaycast(e.clientX, e.clientY);
  });
  canvas.addEventListener('mouseleave', () => {
    clearOutline();
    hideTooltip();
    hideTrackHits();
  });
  controls.addEventListener('end', () => {
    lastRay = 0;
    setTimeout(() => doRaycast(mousePos.x, mousePos.y), 50);
  });
}

function doRaycast(clientX, clientY) {
  // Electron group only carries sprite labels (not raycastable), so it doesn't
  // participate in the early-return "anything to hover" check below.
  const trackGroup = getTrackGroup();
  const photonGroup = getPhotonGroup();
  const clusterGroup = getClusterGroup();
  const jetGroup = getJetGroup();
  const tauGroup = getTauGroup();
  const metGroup = getMetGroup();
  const vertexGroup = getVertexGroup();
  const hasTrackLines = trackGroup && trackGroup.visible && trackGroup.children.length > 0;
  const hasPhotonLines = photonGroup && photonGroup.visible && photonGroup.children.length > 0;
  const hasClusterLines = clusterGroup && clusterGroup.visible && clusterGroup.children.length > 0;
  const hasJetLines = jetGroup && jetGroup.visible && jetGroup.children.length > 0;
  const hasTauLines = tauGroup && tauGroup.visible && tauGroup.children.length > 0;
  const hasMetArrow = metGroup && metGroup.visible && metGroup.children.length > 0;
  const hasVertexMarkers = vertexGroup && vertexGroup.visible && vertexGroup.children.length > 0;
  const hasFcalTubes =
    fcalGroup && fcalGroup.children.some((c) => c.isInstancedMesh) && fcalVisibleMap.length > 0;
  if (
    !_getShowInfo() ||
    _getCinemaMode() ||
    (!active.size &&
      !hasTrackLines &&
      !hasPhotonLines &&
      !hasClusterLines &&
      !hasJetLines &&
      !hasTauLines &&
      !hasMetArrow &&
      !hasVertexMarkers &&
      !hasFcalTubes)
  ) {
    hideTooltip();
    clearOutline();
    hideTrackHits();
    return;
  }
  // Don't show cell info when the pointer is over any UI element (panels, toolbar, overlays)
  const topEl = document.elementFromPoint(clientX, clientY);
  if (topEl && topEl !== canvas) {
    hideTooltip();
    clearOutline();
    hideTrackHits();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    hideTooltip();
    clearOutline();
    hideTrackHits();
    return;
  }
  mxy.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  camera.updateMatrixWorld();
  raycast.setFromCamera(mxy, camera);
  // ── Cell + FCAL hit (same priority — pick closest) ────────────────────────
  {
    let cellHit = null,
      cellHandle = null,
      cellDist = Infinity;
    if (active.size && rayTargets.length) {
      const hits = raycast.intersectObjects(rayTargets, false);
      for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        const iid = hit.instanceId;
        if (iid == null) continue;
        const h = hit.object.userData.handles?.[iid];
        if (!h || !active.has(h)) continue;
        cellHit = hit;
        cellHandle = h;
        cellDist = hit.distance;
        break; // hits are sorted; first active match is closest
      }
    }
    let fcalHit = null,
      fcalDist = Infinity;
    if (hasFcalTubes) {
      const iMesh = fcalGroup.children.find((c) => c.isInstancedMesh);
      if (iMesh) {
        const hits = raycast.intersectObject(iMesh, false);
        if (hits.length && hits[0].instanceId != null && fcalVisibleMap[hits[0].instanceId]) {
          fcalHit = hits[0];
          fcalDist = hits[0].distance;
        }
      }
    }
    if (cellHit && cellDist <= fcalDist) {
      const data = active.get(cellHandle);
      showOutline(cellHandle);
      hideTrackHits();
      tipCellEl.textContent = data.cellName;
      tipCoordEl.textContent = data.coords ?? '';
      tipEEl.textContent = `${data.energyGev.toFixed(4)} GeV`;
      if (tipEKeyEl) tipEKeyEl.textContent = _t('tip-energy-key');
      _setExtras(null);
      tooltip.style.left = Math.min(clientX + 18, rect.right - 210) + 'px';
      tooltip.style.top = Math.min(clientY + 18, rect.bottom - 90) + 'px';
      tooltip.hidden = false;
      markDirty();
      return;
    }
    if (fcalHit) {
      const iid = fcalHit.instanceId;
      const cell = fcalVisibleMap[iid];
      showFcalOutline(iid);
      hideTrackHits();
      const side = cell.eta >= 0 ? 'A' : 'C';
      tipCellEl.textContent = `FCAL${cell.module} (${side}-side)`;
      tipCoordEl.textContent = `η = ${cell.eta.toFixed(3)}   φ = ${cell.phi.toFixed(3)} rad`;
      tipEEl.textContent = `${cell.energy.toFixed(4)} GeV`;
      if (tipEKeyEl) tipEKeyEl.textContent = _t('tip-energy-key');
      _setExtras(null);
      tooltip.style.left = Math.min(clientX + 18, rect.right - 210) + 'px';
      tooltip.style.top = Math.min(clientY + 18, rect.bottom - 90) + 'px';
      tooltip.hidden = false;
      markDirty();
      return;
    }
  }
  // ── Vertex marker hit (priority over tracks) ─────────────────────────────
  // Tracks emanate from the primary vertex, so they cluster densely around
  // it. If we tested tracks first, the cursor on a vertex marker would
  // almost always hit a nearby track and the user would never see the
  // vertex tooltip. Vertex markers are small but distinct dots, so testing
  // them first matches user intent ("I'm pointing at the dot").
  if (hasVertexMarkers) {
    const vHits = raycast.intersectObject(vertexGroup, true);
    if (vHits.length) {
      const v = vHits[0].object;
      const kind = v.userData.vertexKind ?? 'primary';
      const label =
        kind === 'primary'
          ? 'Primary Vertex'
          : kind === 'pileup'
            ? 'Pile-up Vertex'
            : 'B-tag Vertex';
      const p = v.userData.position;
      const xyzMm = p ? `(${(-p.x).toFixed(2)}, ${(-p.y).toFixed(2)}, ${p.z.toFixed(2)}) mm` : '';
      clearOutline();
      hideTrackHits();
      tipCellEl.textContent = label;
      tipCoordEl.textContent = v.userData.vertexKey ?? '';
      tipEEl.textContent = `${v.userData.numTracks ?? 0}`;
      if (tipEKeyEl) tipEKeyEl.textContent = 'tracks';
      _setExtras([['x, y, z', xyzMm]]);
      tooltip.style.left = Math.min(clientX + 18, rect.right - 210) + 'px';
      tooltip.style.top = Math.min(clientY + 18, rect.bottom - 90) + 'px';
      tooltip.hidden = false;
      markDirty();
      return;
    }
  }
  // ── Track / Photon hit (pick closest) ────────────────────────────────────
  // Electron group now contains only sprites (the "e±" labels), which aren't
  // raycasted — the electron identity comes from the matched track instead.
  // Two raycasts with different Line thresholds: ID tracks / photons get the
  // narrow 40 mm hit zone (so neighbouring tracks don't bleed into each
  // other), muon tracks get the wider 80 mm zone since they're typically
  // viewed from far away.
  if (hasTrackLines || hasPhotonLines) {
    const idCandidates = [];
    const muonCandidates = [];
    if (hasTrackLines) {
      for (const c of trackGroup.children) {
        if (!c.visible) continue;
        if (c.userData.storeGateKey === 'CombinedMuonTracks') muonCandidates.push(c);
        else idCandidates.push(c);
      }
    }
    if (hasPhotonLines) {
      for (const c of photonGroup.children) if (c.visible) idCandidates.push(c);
    }
    raycast.params.Line.threshold = _DEFAULT_TRACK_THRESHOLD_MM;
    const idHits = idCandidates.length ? raycast.intersectObjects(idCandidates, false) : [];
    raycast.params.Line.threshold = _MUON_TRACK_THRESHOLD_MM;
    const muonHits = muonCandidates.length ? raycast.intersectObjects(muonCandidates, false) : [];
    raycast.params.Line.threshold = _DEFAULT_TRACK_THRESHOLD_MM; // restore
    // Closest of the two passes wins.
    const bestId = idHits.length ? idHits[0] : null;
    const bestMu = muonHits.length ? muonHits[0] : null;
    let hits;
    if (bestId && bestMu) hits = bestId.distance <= bestMu.distance ? [bestId] : [bestMu];
    else if (bestId) hits = [bestId];
    else if (bestMu) hits = [bestMu];
    else hits = [];
    if (hits.length) {
      const line = hits[0].object;
      const ptGev = line.userData.ptGev ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      const isPhoton = line.parent === photonGroup;
      let label;
      if (isPhoton) label = 'Photon';
      else {
        // Track label mirrors the colour priority chain in
        // _applyTrackMaterials: electron > muon > jet > τ > muon-hit >
        // default. Lepton IDs (electron / muon) are official ΔR matches to
        // <Electron> / <Muon> objects, so they win first. Jet beats τ
        // because every τ in this XML carries withoutQuality — they are τ
        // algorithm INPUT, not τ-ID output. When the muon's pdgId is
        // unknown we keep a charge-less "Track → Muon".
        const ePdg = line.userData.matchedElectronPdgId;
        if (ePdg != null) label = ePdg < 0 ? 'Track → Electron' : 'Track → Positron';
        else if (line.userData.isMuonMatched) {
          const muPdg = line.userData.matchedMuonPdgId;
          if (muPdg == null) label = 'Track → Muon';
          else label = muPdg < 0 ? 'Track → Muon' : 'Track → Anti-muon';
        } else if (line.userData.isJetMatched) label = 'Track → Jet';
        else if (line.userData.isTauMatched) label = 'Track → Tau';
        else label = 'Track';
      }
      // Show pixel-hit markers for the hovered track; clear them for photons.
      if (isPhoton) hideTrackHits();
      else showTrackHits(line);
      clearOutline();
      tipCellEl.textContent = label;
      tipCoordEl.textContent = storeGateKey;
      tipEEl.textContent = `${ptGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'p<sub>T</sub>';
      _setExtras([[_ETA_LABEL, _fmtEta(line.userData.eta)]]);
      tooltip.style.left = Math.min(clientX + 18, rect.right - 210) + 'px';
      tooltip.style.top = Math.min(clientY + 18, rect.bottom - 90) + 'px';
      tooltip.hidden = false;
      markDirty();
      return;
    }
  }
  // ── Cluster hit ───────────────────────────────────────────────────────────
  if (hasClusterLines) {
    const visibleClusters = clusterGroup.children.filter((c) => c.visible);
    const clusterHits = raycast.intersectObjects(visibleClusters, false);
    if (clusterHits.length) {
      const line = clusterHits[0].object;
      const etGev = line.userData.etGev ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      clearOutline();
      hideTrackHits();
      tipCellEl.textContent = 'Cluster';
      tipCoordEl.textContent = storeGateKey;
      tipEEl.textContent = `${etGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'E<sub>T</sub>';
      _setExtras([[_ETA_LABEL, _fmtEta(line.userData.eta)]]);
      tooltip.style.left = Math.min(clientX + 18, rect.right - 210) + 'px';
      tooltip.style.top = Math.min(clientY + 18, rect.bottom - 90) + 'px';
      tooltip.hidden = false;
      markDirty();
      return;
    }
  }
  // ── Tau hit ───────────────────────────────────────────────────────────────
  // Tested before jets because τ candidates often share a direction with a jet
  // (the hadronic τ decay products *form* a narrow jet) — the τ classification
  // is the more specific identification, so it wins the hover.
  if (hasTauLines) {
    const visibleTaus = tauGroup.children.filter((c) => c.visible);
    const tauHits = raycast.intersectObjects(visibleTaus, false);
    if (tauHits.length) {
      const line = tauHits[0].object;
      const ptGev = line.userData.ptGev ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      const numTracks = line.userData.numTracks ?? 0;
      clearOutline();
      hideTrackHits();
      tipCellEl.textContent = 'Tau';
      tipCoordEl.textContent = storeGateKey;
      tipEEl.textContent = `${ptGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'p<sub>T</sub>';
      _setExtras([
        [_ETA_LABEL, _fmtEta(line.userData.eta)],
        ['tracks', `${numTracks}`],
      ]);
      tooltip.style.left = Math.min(clientX + 18, rect.right - 210) + 'px';
      tooltip.style.top = Math.min(clientY + 18, rect.bottom - 90) + 'px';
      tooltip.hidden = false;
      markDirty();
      return;
    }
  }
  // ── Jet hit ───────────────────────────────────────────────────────────────
  if (hasJetLines) {
    const visibleJets = jetGroup.children.filter((c) => c.visible);
    const jetHits = raycast.intersectObjects(visibleJets, false);
    if (jetHits.length) {
      const line = jetHits[0].object;
      const ptGev = line.userData.ptGev ?? line.userData.etGev ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      const massGev = line.userData.massGev ?? 0;
      clearOutline();
      hideTrackHits();
      tipCellEl.textContent = 'Jet';
      tipCoordEl.textContent = storeGateKey;
      tipEEl.textContent = `${ptGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'p<sub>T</sub>';
      // η is the canonical companion to pT. Mass is only meaningful for
      // large-R (R = 1.0) collections — boosted W/Z/top/H tagging — so we
      // include it for AntiKt10* and skip it otherwise.
      const extras = [[_ETA_LABEL, _fmtEta(line.userData.eta)]];
      // (mass label below uses Latin chars, so the default uppercase styling
      // is fine.)
      if (storeGateKey.includes('AntiKt10')) {
        extras.push(['mass', `${massGev.toFixed(3)} GeV`]);
      }
      _setExtras(extras);
      tooltip.style.left = Math.min(clientX + 18, rect.right - 210) + 'px';
      tooltip.style.top = Math.min(clientY + 18, rect.bottom - 90) + 'px';
      tooltip.hidden = false;
      markDirty();
      return;
    }
  }
  // ── MET arrow hit ─────────────────────────────────────────────────────────
  // The shaft is a real-length Line and the head is a Mesh; raycast against
  // the whole group catches both at the default track threshold (40 mm).
  if (hasMetArrow) {
    const metHits = raycast.intersectObject(metGroup, true);
    if (metHits.length) {
      // Walk up to the ArrowHelper (where the metadata lives on userData).
      let arrow = metHits[0].object;
      while (arrow && arrow.userData.magnitude == null && arrow.parent) arrow = arrow.parent;
      const magnitude = arrow?.userData.magnitude ?? 0;
      const sumEt = arrow?.userData.sumEt ?? 0;
      const key = arrow?.userData.metKey ?? '';
      clearOutline();
      hideTrackHits();
      tipCellEl.textContent = 'MET';
      tipCoordEl.textContent = key;
      tipEEl.textContent = `${magnitude.toFixed(2)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'E<sub>T</sub><sup>miss</sup>';
      _setExtras([['Sum E', `${sumEt.toFixed(1)} GeV`]]);
      tooltip.style.left = Math.min(clientX + 18, rect.right - 210) + 'px';
      tooltip.style.top = Math.min(clientY + 18, rect.bottom - 90) + 'px';
      tooltip.hidden = false;
      markDirty();
      return;
    }
  }
  clearOutline();
  hideTooltip();
  hideTrackHits();
}
