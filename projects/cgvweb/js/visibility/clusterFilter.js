// @ts-check
// Cell-membership filter used at view levels 2 (clusters) and 3 (jets):
// pre-computes the set of cell IDs that pass the current overlay's threshold
// so the per-cell threshold loop in visibility.js can ask `does this cell
// belong to a passing cluster/jet?` in O(1).
//
// The filter is rebuilt whenever cluster data changes (setLastClusterData),
// the slider moves (applyClusterThreshold / applyJetThreshold), or the view
// level switches (_applyViewLevelGate).
//
//   level 1: filter off entirely (null = pass-all).
//   level 2: cells of clusters with etGev >= thrClusterEtGev.
//            Also computes activeMbtsLabels — MBTS modules whose η/φ falls
//            inside one of those clusters' rough acceptance window.
//   level 3: cells of jets in the active jet collection with etGev >=
//            thrJetEtGev. Collections without a <cells> field (EMPFlow,
//            UFOCSSK) yield an empty set — every cell is hidden, matching
//            the strict-cluster behaviour requested for the user view.
import { getViewLevel } from '../viewLevel.js';
import { getActiveJetCollection } from '../jets.js';
import { thrClusterEtGev, thrJetEtGev } from './thresholds.js';

/** @type {{ collections: Array<{ clusters: Array<any> }> } | null} */
let _lastClusterData = null;
/** @type {Set<string|number> | null} */
let _activeClusterCellIds = null;
/** @type {Set<string> | null} */
let _activeMbtsLabels = null;

/** @param {any} v */
export function setLastClusterData(v) {
  _lastClusterData = v;
}

export function getActiveClusterCellIds() {
  return _activeClusterCellIds;
}
export function getActiveMbtsLabels() {
  return _activeMbtsLabels;
}

export function clearClusterFilter() {
  _lastClusterData = null;
  _activeClusterCellIds = null;
  _activeMbtsLabels = null;
}

export function rebuildActiveClusterCellIds() {
  const lvl = getViewLevel();
  if (lvl === 2 && _lastClusterData) {
    /** @type {Set<string|number>} */
    const ids = new Set();
    /** @type {Set<string>} */
    const mbts = new Set();
    for (const { clusters } of _lastClusterData.collections) {
      for (const { eta, phi: rawPhi, etGev, cells } of clusters) {
        if (etGev < thrClusterEtGev) continue;
        for (const k of ['TILE', 'LAR_EM', 'HEC', 'FCAL', 'TRACK', 'OTHER'])
          for (const id of cells[k]) ids.add(id);
        const absEta = Math.abs(eta);
        let ch;
        if (absEta >= 2.78 && absEta <= 3.86) ch = 1;
        else if (absEta >= 2.08 && absEta < 2.78) ch = 0;
        else continue;
        const type = eta >= 0 ? 1 : -1;
        const phiPos = rawPhi < 0 ? rawPhi + 2 * Math.PI : rawPhi;
        const mod = Math.floor(phiPos / ((2 * Math.PI) / 8)) % 8;
        mbts.add(`type_${type}_ch_${ch}_mod_${mod}`);
      }
    }
    _activeClusterCellIds = ids;
    _activeMbtsLabels = mbts;
    return;
  }
  if (lvl === 3) {
    const c = getActiveJetCollection();
    /** @type {Set<string|number>} */
    const ids = new Set();
    if (c) {
      for (const j of c.jets) {
        if (j.etGev < thrJetEtGev) continue;
        for (const id of j.cells) ids.add(id);
      }
    }
    _activeClusterCellIds = ids;
    _activeMbtsLabels = null;
    return;
  }
  // Level 1 (or no data): filter off entirely.
  _activeClusterCellIds = null;
  _activeMbtsLabels = null;
}
