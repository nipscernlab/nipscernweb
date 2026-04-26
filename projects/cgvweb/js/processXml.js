import * as THREE from 'three';
import {
  _wasmPool,
  SUBSYS_TILE,
  SUBSYS_LAR_EM,
  SUBSYS_LAR_HEC,
  meshByKey,
  cellMeshesByDet,
  active,
  rayTargets,
  _ZERO_MAT4,
  _markIMDirty,
  _flushIMDirty,
  _rayIMeshes,
  _tileKey,
  _larEmKey,
  _hecKey,
} from './state.js';
import {
  palColorTile,
  palColorHec,
  palColorLAr,
  setPalMaxTile,
  setPalMaxHec,
  setPalMaxLAr,
  setPalMaxFcal,
  setPalMinTile,
  setPalMinHec,
  setPalMinLAr,
  setPalMinFcal,
} from './palette.js';
import {
  cellLabel,
  HEC_INNER,
  physLarEmEta,
  physLarEmPhi,
  physLarHecEta,
  physLarHecPhi,
  physTileEta,
  physTilePhi,
  _wrapPhi,
} from './coords.js';
import { applyAllGhostMeshes } from './ghost.js';
import {
  clearVisibilityState,
  clearFcal,
  drawFcal,
  setLastClusterData,
  applyThreshold,
  getTrackGroup,
} from './visibility.js';
import {
  drawTracks,
  drawPhotons,
  drawElectrons,
  drawMuons,
  drawClusters,
  drawJets,
  drawTaus,
  clearTracks,
  clearClusters,
  clearPhotons,
  clearElectrons,
  clearMuons,
  clearJets,
  clearTaus,
} from './particles.js';
import { parseJets } from './jetParser.js';
import {
  setJetCollections,
  clearJetState,
  getActiveJetCollection,
  onJetStateChange,
} from './jets.js';
import { parseHits } from './hitsParser.js';
import { setHitPositions, clearHitsState } from './hitsOverlay.js';
import { parseMet, pickPreferredMet } from './metParser.js';
import { drawMet, clearMet } from './metOverlay.js';
import { parseVertices } from './vertexParser.js';
import { drawVertices, clearVertices } from './vertexOverlay.js';
import { parseTaus } from './tauParser.js';
import { parseMuons } from './muonParser.js';
import { clearOutline, clearAllOutlines } from './outlines.js';
import { setStatus, showEventInfo } from './statusHud.js';
import { markDirty } from './renderer.js';
import { hideTooltip } from './hoverTooltip.js';
import { esc } from './utils.js';
import { updateMinimap } from './minimap.js';

// Single subscription that re-draws jets whenever jet state changes — fires on
// fresh events (setJetCollections) and on user-driven collection switches
// (setActiveJetKey). drawJets(null) on clearJetState removes the group.
onJetStateChange(() => {
  drawJets(getActiveJetCollection());
});

// Sliders + detector-panel init are assigned by setupDetectorPanels(), which
// runs after this module loads. Main wires them via setProcessXmlDeps().
let _deps = {
  getWasmOk: () => false,
  tileSlider: null,
  larSlider: null,
  fcalSlider: null,
  hecSlider: null,
  trackPtSlider: null,
  clusterEtSlider: null,
  initDetPanel: null,
};

export function setProcessXmlDeps(deps) {
  Object.assign(_deps, deps);
}

// ── Scene reset ───────────────────────────────────────────────────────────────
function resetScene() {
  for (const det of ['TILE', 'LAR', 'HEC']) {
    for (const h of cellMeshesByDet[det]) {
      if (h.visible) {
        h.visible = false;
        h.iMesh.setMatrixAt(h.instId, _ZERO_MAT4);
        _markIMDirty(h.iMesh);
      }
    }
  }
  _flushIMDirty();
  // Re-apply ghost state: resetScene hides all meshes (including ghost envelopes),
  // which would desync the ghostVisible map and make the next ghost toggle
  // render only the phi lines without the solid envelopes.
  applyAllGhostMeshes();
  active.clear();
  rayTargets.length = 0;
  _rayIMeshes.clear();
  clearVisibilityState();
  clearOutline();
  clearAllOutlines();
  clearTracks();
  clearClusters();
  clearPhotons();
  clearElectrons();
  clearMuons();
  clearJets();
  clearJetState();
  clearTaus();
  clearHitsState();
  clearMet();
  clearVertices();
  clearFcal();
  hideTooltip();
  markDirty();
}

// ── Process XML ───────────────────────────────────────────────────────────────
// The WASM bulk decode runs in a Web Worker, so `processXml` is asynchronous.
// Multiple overlapping calls (e.g. user clicks event A then event B quickly)
// are kept correct by a monotonic rid: only the most recent call's worker reply
// is applied to the scene — stale replies are discarded. Callers that don't
// await the returned promise still get correct behavior because the final
// scene mutation is gated on `rid === _procXmlRid`.
let _procXmlRid = 0;

export async function processXml(xmlText) {
  if (!_deps.getWasmOk()) return;
  const rid = ++_procXmlRid;

  // ── Off-thread XML parse + ID decode (entirely in the WASM worker) ──────
  let workerResult;
  try {
    workerResult = await _wasmPool.parseXmlAndDecode(xmlText);
  } catch (e) {
    setStatus(`<span class="err">${esc((e && e.message) || String(e))}</span>`);
    return;
  }
  // Drop stale replies — a newer event arrived while the worker was busy.
  if (rid !== _procXmlRid) return;
  if (workerResult.error) {
    setStatus(`<span class="err">${esc(workerResult.error)}</span>`);
    return;
  }

  const currentEventInfo = workerResult.eventInfo;
  const tileCells = workerResult.tileCells;
  const larCells = workerResult.larCells;
  const hecCells = workerResult.hecCells;
  const mbtsCells = workerResult.mbtsCells;
  const fcalCells = workerResult.fcalCells;
  const tilePacked = workerResult.tilePacked;
  const larPacked = workerResult.larPacked;
  const hecPacked = workerResult.hecPacked;
  const rawPhotons = workerResult.photons;
  const rawElectrons = workerResult.electrons ?? [];
  const rawClusters = workerResult.clusters;
  const _clusterCollections = workerResult.clusterCollections;
  // Worker returns plain {x,y,z} objects; reconstruct THREE.Vector3 here.
  const rawTracks = workerResult.tracks.map((t) => ({
    ...t,
    pts: t.pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
  }));

  const total = tileCells.length + larCells.length + hecCells.length + mbtsCells.length;
  if (!total && !fcalCells.length) {
    setStatus('<span class="warn">No TILE, LAr, HEC, MBTS or FCAL cells found</span>');
    return;
  }

  setStatus(`Decoding ${total} cells…`);
  resetScene(); // clears lastClusterData

  // ── Particle tracks ─────────────────────────────────────────────────────────
  // Slider max uses the 99th percentile across tracks ∪ photons ∪ electrons,
  // not the raw maximum. Without the percentile cap, a single high-pT object
  // (W/Z lepton, ~30-50 GeV) pushes the slider top way past where most
  // tracks live and the user has to drag the thumb almost all the way down
  // to reach the bulk. Floor at 5 GeV keeps the slider usable in events
  // with mostly soft tracks.
  if (rawTracks.length || rawPhotons.length || rawElectrons.length) {
    const allPts = [];
    for (const { ptGev } of rawTracks) if (isFinite(ptGev)) allPts.push(ptGev);
    for (const { ptGev } of rawPhotons) if (isFinite(ptGev)) allPts.push(ptGev);
    for (const { ptGev } of rawElectrons) if (isFinite(ptGev)) allPts.push(ptGev);
    let ptMax = 5;
    if (allPts.length) {
      allPts.sort((a, b) => a - b);
      const idx = Math.floor(0.99 * allPts.length);
      ptMax = Math.max(ptMax, allPts[Math.min(idx, allPts.length - 1)]);
    }
    _deps.trackPtSlider.update(0, ptMax);
  }
  drawTracks(rawTracks);
  drawPhotons(rawPhotons);
  drawElectrons(rawElectrons);
  // Muons parsed JS-side (the WASM worker doesn't extract them yet). The
  // <Muon> regex pass over xmlText is cheap — typically 0-3 muons per event.
  drawMuons(parseMuons(xmlText));

  // ── Cluster η/φ lines ────────────────────────────────────────────────────────
  setLastClusterData({ collections: _clusterCollections });
  if (rawClusters.length) {
    let etMin = Infinity,
      etMax = -Infinity;
    for (const { etGev } of rawClusters) {
      if (etGev < etMin) etMin = etGev;
      if (etGev > etMax) etMax = etGev;
    }
    _deps.clusterEtSlider.update(
      etMin === Infinity ? 0 : Math.max(0, etMin),
      etMax === -Infinity ? 1 : etMax,
    );
  }
  // drawClusters → applyClusterThreshold internally rebuilds the cluster
  // cell-id set and refreshes thresholds; no extra rebuildActiveClusterCellIds
  // call is needed here.
  drawClusters(rawClusters);

  // ── Hadronic τ candidates (TauJets_xAOD) ──────────────────────────────────
  // 6-9 per event typical. drawTaus also re-runs the τ→track colour sync so
  // tracks attached to a τ pick up the purple material. Drawn BEFORE
  // setJetCollections so the L3 ET-slider listener (in detectorPanels.js)
  // can pick up τ pT values via getLastTaus when it recomputes the range —
  // τs share the same slider as jets.
  drawTaus(parseTaus(xmlText));

  // ── Jets ────────────────────────────────────────────────────────────────────
  // The Rust WASM parser doesn't extract jets yet — do a light JS pass over
  // the same xmlText (regex-based, jets are a tiny fraction of the file).
  // setJetCollections triggers onJetStateChange (installed at module load
  // below); the listener handles the redraw, both for fresh events and when
  // the user later picks a different collection.
  setJetCollections(parseJets(xmlText));

  // ── Inner-detector + muon-spectrometer hits ───────────────────────────────
  // Cache hit-id → position lookup (with TRT/muon-chamber subtleties handled
  // inside the overlay) so the hover tooltip can render markers along the
  // track under the cursor. No rendering happens here.
  setHitPositions(parseHits(xmlText));

  // ── Missing transverse energy (MET) ─────────────────────────────────────────
  // JiveXML publishes several MET variants (EMPFlow / EMTopo / Calo / ...).
  // We render only the preferred one (EMPFlow when present, first otherwise).
  drawMet(pickPreferredMet(parseMet(xmlText)));

  // ── Vertices (primary, pile-up, b-tag secondary) ──────────────────────────
  // Small markers showing where the actual collisions happened — the PV is
  // typically at z ~ ±50 mm from origin (within the BeamSpot), useful context
  // when zooming in to the inner detector.
  drawVertices(parseVertices(xmlText));

  // Per-detector energy range: symmetric percentiles on each tail so a single
  // extreme cell (e.g. FCAL down to -31 GeV) can't blow out the scale. Real
  // ATLAS XML contains negative energies (~50% of Tile cells, ~40% of FCAL);
  // LAr/HEC are clipped at 50 MeV upstream so the low tail is a no-op there.
  // Computed BEFORE drawFcal so palette bounds are set when cells are first colored.
  function rangeMev(cells, pctLo, pctHi) {
    const vals = [];
    for (const { energy } of cells) {
      const v = energy * 1000;
      if (isFinite(v)) vals.push(v);
    }
    if (!vals.length) return [0, 1];
    vals.sort((a, b) => a - b);
    const lo = vals[Math.floor(pctLo * vals.length)] ?? vals[0];
    const hi = vals[Math.floor(pctHi * vals.length)] ?? vals[vals.length - 1];
    return [lo, hi];
  }
  // MBTS shares the Tile palette — merge its range with Tile's
  const [tileMinMev, tileMaxMev] = rangeMev(tileCells.concat(mbtsCells), 0.05, 0.995);
  const [larMinMev, larMaxMev] = rangeMev(larCells, 0.03, 0.97);
  const [hecMinMev, hecMaxMev] = rangeMev(hecCells, 0.02, 0.98);
  const [fcalMinMev, fcalMaxMev] = rangeMev(fcalCells, 0.5, 0.99);
  // Drive both the threshold sliders and the cell-color palette from the same range.
  _deps.tileSlider.update(tileMinMev, tileMaxMev);
  _deps.larSlider.update(larMinMev, larMaxMev);
  _deps.hecSlider.update(hecMinMev, hecMaxMev);
  _deps.fcalSlider.update(fcalMinMev, fcalMaxMev);
  setPalMinTile(tileMinMev);
  setPalMaxTile(tileMaxMev);
  setPalMinLAr(larMinMev);
  setPalMaxLAr(larMaxMev);
  setPalMinHec(hecMinMev);
  setPalMaxHec(hecMaxMev);
  setPalMinFcal(fcalMinMev);
  setPalMaxFcal(fcalMaxMev);

  // ── FCAL cells ───────────────────────────────────────────────────────────────
  drawFcal(fcalCells);

  let nTile = 0,
    nLAr = 0,
    nHec = 0;

  // ── TileCal cells ─────────────────────────────────────────────────────────
  // The event loop paints colors via setColorAt; visibility is decided by
  // applyThreshold() further down (which zero-scales the instance matrix for
  // filtered-out cells). renderOrder lives on the InstancedMesh itself.
  for (let i = 0; i < tileCells.length; i++) {
    const base = i * 8;
    if (tilePacked[base] !== SUBSYS_TILE) continue;
    const x = tilePacked[base + 1];
    const k = tilePacked[base + 2];
    const side = tilePacked[base + 3];
    const module = tilePacked[base + 4];
    const section = tilePacked[base + 5];
    const tower = tilePacked[base + 6];
    const sampling = tilePacked[base + 7];
    const { id, energy } = tileCells[i];
    const eMev = energy * 1000;
    const s_bit = side < 0 ? 0 : 1;
    const h = meshByKey.get(_tileKey(x, s_bit, k, module));
    if (!h) continue;
    h.iMesh.setColorAt(h.instId, palColorTile(eMev));
    _markIMDirty(h.iMesh);
    const tEta = physTileEta(section, side, tower, sampling);
    const tPhi = physTilePhi(module);
    const tilePrefix = `${section === 1 ? 'LB' : 'EB'}${side >= 0 ? 'A' : 'C'}${module + 1}`;
    active.set(h, {
      energyGev: energy,
      energyMev: eMev,
      cellName: `${tilePrefix} ${cellLabel(x, k)}`,
      coords: `η = ${tEta.toFixed(3)}   φ = ${tPhi.toFixed(3)} rad`,
      eta: tEta,
      phi: tPhi,
      det: 'TILE',
      cellId: id,
    });
    nTile++;
  }

  // ── LAr EM cells ──────────────────────────────────────────────────────────
  for (let i = 0; i < larCells.length; i++) {
    const base = i * 8;
    if (larPacked[base] !== SUBSYS_LAR_EM) continue;
    const abs_be = larPacked[base + 1];
    const sampling = larPacked[base + 2];
    const region = larPacked[base + 3];
    const z_pos = larPacked[base + 4];
    const R = larPacked[base + 5];
    const eta = larPacked[base + 6];
    const phi = larPacked[base + 7];
    const { id, energy } = larCells[i];
    const eMev = energy * 1000;
    const h = meshByKey.get(_larEmKey(abs_be, sampling, R, z_pos, eta, phi));
    if (!h) continue;
    h.iMesh.setColorAt(h.instId, palColorLAr(eMev));
    _markIMDirty(h.iMesh);
    const rName =
      abs_be === 1
        ? `EMB${sampling}`
        : abs_be === 2
          ? `EMEC${sampling}`
          : `EMEC${sampling} (inner)`;
    const bec = abs_be * (z_pos ? 1 : -1);
    const lEta = physLarEmEta(bec, sampling, region, eta);
    const lPhi = physLarEmPhi(bec, sampling, region, phi);
    active.set(h, {
      energyGev: energy,
      energyMev: eMev,
      cellName: rName,
      coords: `η = ${lEta.toFixed(3)}   φ = ${lPhi.toFixed(3)} rad`,
      eta: lEta,
      phi: lPhi,
      det: 'LAR',
      cellId: id,
    });
    nLAr++;
  }

  // ── LAr HEC cells ─────────────────────────────────────────────────────────
  for (let i = 0; i < hecCells.length; i++) {
    const base = i * 8;
    if (hecPacked[base] !== SUBSYS_LAR_HEC) continue;
    const group = hecPacked[base + 1];
    const region = hecPacked[base + 2];
    const z_pos = hecPacked[base + 3];
    const cum_eta = hecPacked[base + 4];
    const phi = hecPacked[base + 5];
    const { id, energy } = hecCells[i];
    const eMev = energy * 1000;
    const h = meshByKey.get(_hecKey(group, region, z_pos, cum_eta, phi));
    if (!h) continue;
    h.iMesh.setColorAt(h.instId, palColorHec(eMev));
    _markIMDirty(h.iMesh);
    const be = z_pos ? 2 : -2;
    const eta_idx = region === 0 ? cum_eta : cum_eta - HEC_INNER[group];
    const hLabel = `HEC${group + 1}`;
    const hEta = physLarHecEta(be, group, region, eta_idx);
    const hPhi = physLarHecPhi(region, phi);
    active.set(h, {
      energyGev: energy,
      energyMev: eMev,
      cellName: hLabel,
      coords: `η = ${hEta.toFixed(3)}   φ = ${hPhi.toFixed(3)} rad`,
      eta: hEta,
      phi: hPhi,
      det: 'HEC',
      cellId: id,
    });
    nHec++;
  }

  // ── MBTS cells (direct label→key, no WASM needed) ────────────────────────
  // EBA module numbers per mod index, inner (ch=0) and outer (ch=1)
  const _mbtsEbaInner = [57, 58, 39, 40, 41, 42, 55, 56];
  const _mbtsEbaOuter = [8, 8, 24, 24, 43, 43, 54, 54];
  for (let i = 0; i < mbtsCells.length; i++) {
    const { label, energy } = mbtsCells[i];
    const eMev = energy * 1000;
    const _m = /^type_(-?1)_ch_([01])_mod_([0-7])$/.exec(label);
    if (!_m) continue;
    const tileNum = _m[2] === '0' ? 14 : 15,
      s_bit = _m[1] === '1' ? 1 : 0,
      mod = +_m[3];
    const h = meshByKey.get(_tileKey(tileNum, s_bit, 0, mod));
    if (!h) continue;
    h.iMesh.setColorAt(h.instId, palColorTile(eMev));
    _markIMDirty(h.iMesh);
    const mbtsEta = (s_bit ? 1 : -1) * (_m[2] === '0' ? 2.76 : 3.84);
    const mbtsPhi = _wrapPhi((2 * Math.PI) / 16 + (mod * 2 * Math.PI) / 8);
    const mbtsCoords = `η = ${mbtsEta.toFixed(3)}   φ = ${mbtsPhi.toFixed(3)} rad`;
    const _mbtsInner = _m[2] === '1';
    const _mbtsSide = s_bit ? 'A' : 'C';
    const _mbtsEba = (_mbtsInner ? _mbtsEbaInner : _mbtsEbaOuter)[mod];
    const _mbtsIdx = mod + (_mbtsInner ? 0 : 8);
    const _mbtsCellName = `EB${_mbtsSide}${String(_mbtsEba).padStart(2, '0')} MBTS ${_mbtsSide}${String(_mbtsIdx).padStart(2, '0')}`;
    active.set(h, {
      energyGev: energy,
      energyMev: eMev,
      cellName: _mbtsCellName,
      coords: mbtsCoords,
      eta: mbtsEta,
      phi: mbtsPhi,
      det: 'TILE',
      mbtsLabel: label,
    });
  }

  const tg = getTrackGroup();
  _deps.initDetPanel(
    nTile > 0,
    nLAr > 0,
    nHec > 0,
    tg && tg.children.length > 0,
    fcalCells.length > 0,
  );
  applyThreshold();
  showEventInfo(currentEventInfo);
  updateMinimap({ active, fcalCells, clusters: rawClusters });
}
