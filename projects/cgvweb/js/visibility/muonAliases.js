// @ts-check
// Muon-spectrometer station naming. Atlas raw node names (BARh_1, BAR1_2, …)
// are opaque — every consumer that surfaces a muon chamber to the user
// (Detector Layers panel, hover tooltip) goes through these tables to get
// the friendly station label (BIS, BIL, BML, BMS, BOL, BOS, …) instead.
//
// MUON_STATION_RENAMES   leaf rename for the panel; also stops recursion so
//                        every chamber under that subtree shares the alias.
// MUON_MERGED_GROUPS     synthetic groups (NSW = barp/barq/bary on C side
//                        + bar8/bar9/barg on A side); all members share the
//                        group's label.
// MUON_HIDDEN_NODES      not shown in the panel at all (and not aliased).
//
// setupMuonAliasMap({ aSide, cSide }) walks both atlas subtrees once they're
// loaded and stamps mesh → alias into a Map; getMuonAliasForMesh(mesh) is
// the reverse lookup hover code uses.

export const MUON_STATION_RENAMES = {
  // C side (MUCH_1)
  BARh_1: 'BIS',
  BARi_2: 'BIL',
  BARj_3: 'BML',
  BARk_4: 'BMS',
  BARl_5: 'BOL',
  BARm_6: 'BOS',
  BARn_7: 'BIR',
  BARo_8: 'BEE',
  BARr_11: 'EES',
  BARs_12: 'EEL',
  BARt_13: 'EMS',
  BARu_14: 'EML',
  BARv_15: 'EOL',
  BARw_16: 'EOS',
  // A side (MUC1_2) — same sequence, different node-name pattern
  BARI_1: 'BIS',
  BAR1_2: 'BIL',
  BAR2_3: 'BML',
  BAR3_4: 'BMS',
  BAR4_5: 'BOL',
  BAR5_6: 'BOS',
  BAR6_7: 'BIR',
  BAR7_8: 'BEE',
  BAR0_11: 'EES',
  BARa_12: 'EEL',
  BARb_13: 'EMS',
  BARc_14: 'EML',
  BARd_15: 'EOL',
  BARe_16: 'EOS',
};

export const MUON_MERGED_GROUPS = [
  {
    label: 'NSW',
    members: [
      // C side (MUCH_1)
      'BARp_9',
      'BARq_10',
      'BARy_18',
      // A side (MUC1_2)
      'BAR8_9',
      'BAR9_10',
      'BARg_18',
    ],
  },
];

export const MUON_HIDDEN_NODES = new Set(['BARx_17', 'BARf_17']);

// alias → { full station name, detector technology }. Used by the hover
// tooltip; the panel only shows the short alias.
//   B = Barrel,    E = End-cap
//   I / M / O / E  = Inner / Middle / Outer / Extra (radial layer)
//   S / L          = Small / Large sector
// Technologies in the ATLAS muon spectrometer (Run 3):
//   MDT  — Monitored Drift Tubes (precision tracking)
//   RPC  — Resistive Plate Chambers (barrel trigger + 2nd-coord)
//   TGC  — Thin Gap Chambers (end-cap trigger + 2nd-coord)
//   sTGC — small-strip TGC (NSW)
//   MM   — MicroMegas (NSW precision)
// The barrel middle/outer/inner rings carry MDT + RPC; the end-cap middle/
// outer rings carry MDT + TGC; the EE / BEE / BIR "extra" rings are MDT
// only; the New Small Wheel (Run 3) replaced the old end-cap Inner station
// with sTGC + MicroMegas.
export const MUON_STATION_TECH = {
  BIS: { full: 'Barrel Inner Small', tech: 'MDT + RPC' },
  BIL: { full: 'Barrel Inner Large', tech: 'MDT + RPC' },
  BML: { full: 'Barrel Middle Large', tech: 'MDT + RPC' },
  BMS: { full: 'Barrel Middle Small', tech: 'MDT + RPC' },
  BOL: { full: 'Barrel Outer Large', tech: 'MDT + RPC' },
  BOS: { full: 'Barrel Outer Small', tech: 'MDT + RPC' },
  BIR: { full: 'Barrel Inner Rib', tech: 'MDT' },
  BEE: { full: 'Barrel End-cap Extra', tech: 'MDT' },
  EES: { full: 'End-cap Extra Small', tech: 'MDT' },
  EEL: { full: 'End-cap Extra Large', tech: 'MDT' },
  EMS: { full: 'End-cap Middle Small', tech: 'MDT + TGC' },
  EML: { full: 'End-cap Middle Large', tech: 'MDT + TGC' },
  EOL: { full: 'End-cap Outer Large', tech: 'MDT + TGC' },
  EOS: { full: 'End-cap Outer Small', tech: 'MDT + TGC' },
  NSW: { full: 'New Small Wheel', tech: 'sTGC + MicroMegas' },
};

// node-name → alias (renames + merged group members both folded in).
const _NODE_TO_ALIAS = (() => {
  /** @type {Record<string, string>} */
  const map = { ...MUON_STATION_RENAMES };
  for (const g of MUON_MERGED_GROUPS) for (const m of g.members) map[m] = g.label;
  return map;
})();

/**
 * @typedef {{
 *   side: 'A' | 'C',
 *   alias: string,
 *   full?: string,
 *   tech?: string,
 * }} MuonAliasInfo
 */

/** @type {WeakMap<object, MuonAliasInfo>} */
const _meshToAlias = new WeakMap();
// Inverse lookup: every mesh belonging to a station, keyed by `${side}:${alias}`.
// Used by the hover overlay to outline every chamber of the station the
// cursor is on, not just the single mesh under the ray.
/** @type {Map<string, object[]>} */
const _stationMeshes = new Map();
/**
 * @param {'A' | 'C'} side
 * @param {string} alias
 */
const _stationKey = (side, alias) => `${side}:${alias}`;

/**
 * Walks an atlas node subtree and stamps every mesh under any aliased
 * station / merged-group child with { side, alias }. Once recursion enters
 * an aliased subtree it doesn't recurse further (every nested mesh shares
 * the parent's alias).
 *
 * @param {{ children: Map<string, any>, meshes: any[] } | null} root
 * @param {'A' | 'C'} side
 */
function _stampSubtree(root, side) {
  if (!root) return;
  for (const [name, child] of root.children) {
    const alias = _NODE_TO_ALIAS[name];
    if (alias) {
      const techInfo = MUON_STATION_TECH[/** @type {keyof typeof MUON_STATION_TECH} */ (alias)];
      const key = _stationKey(side, alias);
      if (!_stationMeshes.has(key)) _stationMeshes.set(key, []);
      _stampAllMeshes(child, { side, alias, full: techInfo?.full, tech: techInfo?.tech });
    } else if (!MUON_HIDDEN_NODES.has(name)) {
      _stampSubtree(child, side);
    }
  }
}

/**
 * @param {{ children: Map<string, any>, meshes: any[] }} node
 * @param {MuonAliasInfo} info
 */
function _stampAllMeshes(node, info) {
  if (!node) return;
  const bucket = _stationMeshes.get(_stationKey(info.side, info.alias));
  if (!bucket) return; // _stampSubtree always primes the bucket; defensive only.
  for (const m of node.meshes ?? []) {
    _meshToAlias.set(m, info);
    bucket.push(m);
  }
  if (node.children) for (const child of node.children.values()) _stampAllMeshes(child, info);
}

/**
 * Builds the mesh → alias lookup AND the inverse station → meshes lookup.
 * Idempotent — safe to call again on a fresh atlas load. Old WeakMap entries
 * drop with their meshes; the station-meshes Map is cleared explicitly.
 *
 * @param {{ aSide: any, cSide: any }} trees
 */
export function setupMuonAliasMap({ aSide, cSide }) {
  _stationMeshes.clear();
  _stampSubtree(aSide, 'A');
  _stampSubtree(cSide, 'C');
}

/**
 * @param {object} mesh
 * @returns {MuonAliasInfo | undefined}
 */
export function getMuonAliasForMesh(mesh) {
  return _meshToAlias.get(mesh);
}

/**
 * Returns every chamber mesh that belongs to the same station as the given
 * mesh — i.e. all meshes sharing this mesh's (side, alias) pair. Empty array
 * when the mesh isn't a known muon chamber.
 *
 * @param {object} mesh
 * @returns {ReadonlyArray<object>}
 */
export function getStationMeshes(mesh) {
  const info = _meshToAlias.get(mesh);
  if (!info) return [];
  return _stationMeshes.get(_stationKey(info.side, info.alias)) ?? [];
}
