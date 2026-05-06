// Detector-layer tree — the static-geometry side of the Layers popover.
//
// Owns:
//   - PANEL_TREE config: each top-level detector subsystem and its samplings,
//     in outside-in display order (Muon spectrometer first, MBTS last).
//   - The muon sub-tree builder: inflates from the live atlas A/C subtrees
//     once the GLB has loaded, applying the friendly-station renames /
//     hidden-node skips / merged-group collapses from muonAliases.js.
//   - The DOM rendering pass + click handlers + All / None quick buttons.
//
// Exports `setupLayerTree()` returning `syncLayerToggles` so the layers-
// popover button can refresh its on/off indicator when other widgets touch
// layer state.

import {
  layerVis,
  setLayerLeaf,
  setLayerSubtree,
  anyLayerLeafOn,
  applyThreshold,
  applyFcalThreshold,
  applyMuonVisibility,
  refreshSceneVisibility,
  getMuonAtlasTrees,
  onMuonTreesChange,
} from '../../visibility.js';
import {
  MUON_STATION_RENAMES,
  MUON_MERGED_GROUPS,
  MUON_HIDDEN_NODES,
} from '../../visibility/muonAliases.js';

// Hex colours match the current palette family per top-level detector.
const C_TILE = '#c87c18';
const C_MBTS = '#e8c548';
const C_LAR = '#27b568';
const C_HEC = '#66e0f6';
const C_FCAL = '#b87333';
const C_MUON = '#4a90d9';

// Tree config — order here is the order shown in the panel. Each node:
//   path:    address into visibility.layerVis (string array)
//   label:   display text (i18n key falls back to this)
//   sub:     subtitle (optional)
//   color:   dot / switch accent
//   children: nested nodes (leaf if absent)
// Display order is outside-in (Muon spectrometer first, MBTS last) so the
// panel mirrors the user's mental walk through ATLAS layers from the muon
// chambers down toward the beam pipe. The Inner overlay group lives outside
// PANEL_TREE — it's appended after #layers-tree in index.html.
const PANEL_TREE = [
  // The muon node is rebuilt dynamically once the atlas tree is available —
  // see _rebuildMuonNode below. Initial placeholder has no children so the
  // toggle ON state stays meaningful (false until atlas loads).
  {
    path: ['muon'],
    label: 'Muon',
    sub: 'Muon spectrometer (loading…)',
    subKey: 'layer-sub-muon',
    color: C_MUON,
    children: [],
  },
  {
    path: ['tile'],
    label: 'TILE',
    labelKey: null,
    sub: 'TileCal barrel, extended & ITC',
    subKey: 'layer-sub-tile',
    color: C_TILE,
    children: [
      {
        path: ['tile', 'barrel'],
        label: 'Barrel (LB)',
        labelKey: 'layer-name-tile-barrel',
        sub: 'Long barrel A/BC/D',
        subKey: 'layer-sub-tile-barrel',
        color: C_TILE,
        children: [
          { path: ['tile', 'barrel', 'A'], label: 'A', sub: 'Sampling A', color: C_TILE },
          { path: ['tile', 'barrel', 'BC'], label: 'BC', sub: 'Sampling BC', color: C_TILE },
          { path: ['tile', 'barrel', 'D'], label: 'D', sub: 'Sampling D', color: C_TILE },
        ],
      },
      {
        path: ['tile', 'extended'],
        label: 'Extended (EB)',
        labelKey: 'layer-name-tile-ext',
        sub: 'Extended barrel A/B/D',
        subKey: 'layer-sub-tile-ext',
        color: C_TILE,
        children: [
          { path: ['tile', 'extended', 'A'], label: 'A', sub: 'Sampling A', color: C_TILE },
          { path: ['tile', 'extended', 'B'], label: 'B', sub: 'Sampling B', color: C_TILE },
          { path: ['tile', 'extended', 'D'], label: 'D', sub: 'Sampling D', color: C_TILE },
        ],
      },
      {
        path: ['tile', 'itc'],
        label: 'ITC',
        labelKey: 'layer-name-tile-itc',
        sub: 'Gap scintillators E1-E4',
        subKey: 'layer-sub-tile-itc',
        color: C_TILE,
        children: [
          { path: ['tile', 'itc', 'E'], label: 'E1-E4', sub: 'Gap scintillators', color: C_TILE },
        ],
      },
    ],
  },
  {
    path: ['lar'],
    label: 'LAr',
    sub: 'EM calorimeter',
    subKey: 'layer-sub-lar',
    color: C_LAR,
    children: [
      {
        path: ['lar', 'barrel'],
        label: 'Barrel (EMB)',
        labelKey: 'layer-name-lar-barrel',
        sub: 'EM barrel',
        subKey: 'layer-sub-lar-barrel',
        color: C_LAR,
        children: [
          { path: ['lar', 'barrel', 0], label: 'Presampler', sub: 'Sampling 0', color: C_LAR },
          { path: ['lar', 'barrel', 1], label: 'Strips', sub: 'Sampling 1', color: C_LAR },
          { path: ['lar', 'barrel', 2], label: 'Middle', sub: 'Sampling 2', color: C_LAR },
          { path: ['lar', 'barrel', 3], label: 'Back', sub: 'Sampling 3', color: C_LAR },
        ],
      },
      {
        path: ['lar', 'ec'],
        label: 'End-cap (EMEC)',
        labelKey: 'layer-name-lar-ec',
        sub: 'EM end-cap',
        subKey: 'layer-sub-lar-ec',
        color: C_LAR,
        children: [
          { path: ['lar', 'ec', 0], label: 'Presampler', sub: 'Sampling 0', color: C_LAR },
          { path: ['lar', 'ec', 1], label: 'Strips', sub: 'Sampling 1', color: C_LAR },
          { path: ['lar', 'ec', 2], label: 'Middle', sub: 'Sampling 2', color: C_LAR },
          { path: ['lar', 'ec', 3], label: 'Back', sub: 'Sampling 3', color: C_LAR },
        ],
      },
    ],
  },
  {
    path: ['hec'],
    label: 'HEC',
    sub: 'Hadronic end-cap',
    subKey: 'layer-sub-hec',
    color: C_HEC,
    children: [
      { path: ['hec', 0], label: 'HEC1', sub: 'Sampling 0', color: C_HEC },
      { path: ['hec', 1], label: 'HEC2', sub: 'Sampling 1', color: C_HEC },
      { path: ['hec', 2], label: 'HEC3', sub: 'Sampling 2', color: C_HEC },
      { path: ['hec', 3], label: 'HEC4', sub: 'Sampling 3', color: C_HEC },
    ],
  },
  {
    path: ['fcal'],
    label: 'FCAL',
    sub: 'Forward calorimeter',
    subKey: 'layer-sub-fcal',
    color: C_FCAL,
    children: [
      { path: ['fcal', 1], label: 'FCAL1', sub: 'EM (copper)', color: C_FCAL },
      { path: ['fcal', 2], label: 'FCAL2', sub: 'Hadronic (tungsten)', color: C_FCAL },
      { path: ['fcal', 3], label: 'FCAL3', sub: 'Hadronic (tungsten)', color: C_FCAL },
    ],
  },
  {
    path: ['mbts'],
    label: 'MBTS',
    sub: 'Minimum-bias trigger scintillators',
    subKey: 'layer-sub-mbts',
    color: C_MBTS,
    children: [
      {
        path: ['mbts', 'inner'],
        label: 'Inner',
        labelKey: 'layer-name-mbts-inner',
        sub: '|η| ≈ 3.84',
        color: C_MBTS,
      },
      {
        path: ['mbts', 'outer'],
        label: 'Outer',
        labelKey: 'layer-name-mbts-outer',
        sub: '|η| ≈ 2.76',
        color: C_MBTS,
      },
    ],
  },
];

// Naming tables (MUON_STATION_RENAMES, MUON_MERGED_GROUPS, MUON_HIDDEN_NODES)
// imported from ../../visibility/muonAliases.js — same source of truth used by
// hoverTooltip to resolve a chamber mesh back to its panel alias.
const _muonMergedMembers = new Set(MUON_MERGED_GROUPS.flatMap((g) => g.members));

// Builds the muon panel sub-tree from the atlas A/C subtrees. Recursion stops
// at renamed station nodes (BIS/BIL/...) — they become leaves whose toggle
// controls every mesh in their atlas subtree via allMeshes. Atlas pairs in
// MUON_MERGED_GROUPS are collapsed into a synthetic leaf (e.g. NSW) whose
// toggle drives all members at once.
function _buildMuonPanelChildren(atlasNode, parentPath) {
  if (!atlasNode || atlasNode.children.size === 0) return [];
  const out = [];
  for (const [name, child] of atlasNode.children) {
    if (_muonMergedMembers.has(name)) continue; // handled below
    if (MUON_HIDDEN_NODES.has(name)) continue;
    const path = [...parentPath, name];
    const renamed = MUON_STATION_RENAMES[name];
    const label = renamed ?? name;
    const children = renamed ? null : _buildMuonPanelChildren(child, path);
    out.push({
      path,
      label,
      color: C_MUON,
      children: children && children.length ? children : null,
    });
  }
  for (const group of MUON_MERGED_GROUPS) {
    const members = group.members.map((m) => atlasNode.children.get(m)).filter(Boolean);
    if (!members.length) continue;
    out.push({
      path: [...parentPath, group.label],
      label: group.label,
      color: C_MUON,
      mergePaths: group.members
        .filter((m) => atlasNode.children.has(m))
        .map((m) => [...parentPath, m]),
    });
  }
  return out;
}

function _rebuildMuonNode() {
  const trees = getMuonAtlasTrees();
  const muonNode = PANEL_TREE.find((n) => n.path[0] === 'muon');
  if (!muonNode) return;
  muonNode.sub = 'Muon spectrometer';
  muonNode.children = [
    {
      path: ['muon', 'aSide'],
      label: 'A Side',
      labelKey: 'layer-name-muon-aside',
      color: C_MUON,
      children: trees.aSide ? _buildMuonPanelChildren(trees.aSide, ['muon', 'aSide']) : null,
    },
    {
      path: ['muon', 'cSide'],
      label: 'C Side',
      labelKey: 'layer-name-muon-cside',
      color: C_MUON,
      children: trees.cSide ? _buildMuonPanelChildren(trees.cSide, ['muon', 'cSide']) : null,
    },
  ];
}

const CHEVRON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" ' +
  'stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

const _nodeByPath = new Map();
function _indexTree(nodes) {
  for (const n of nodes) {
    _nodeByPath.set(n.path.join('/'), n);
    if (n.children) _indexTree(n.children);
  }
}
function _reindexTree() {
  _nodeByPath.clear();
  _indexTree(PANEL_TREE);
}
_indexTree(PANEL_TREE);

function _leafValue(path) {
  let node = layerVis;
  for (const k of path) node = node[k];
  return !!node;
}
function _nodeOn(node) {
  if (node.mergePaths) return node.mergePaths.some((p) => anyLayerLeafOn(p));
  return node.children ? anyLayerLeafOn(node.path) : _leafValue(node.path);
}
function _esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function _idFromPath(pathStr) {
  // Sanitise to a valid HTML id — atlas mesh names can contain dots / spaces.
  return 'ltog-' + pathStr.replace(/[^A-Za-z0-9_-]/g, '_');
}

function _renderNode(node, depth) {
  const hasChildren = !!(node.children && node.children.length);
  const indentCls = depth === 1 ? ' layer-row-child' : depth >= 2 ? ' layer-row-grandchild' : '';
  // For nesting deeper than the static CSS classes handle, scale padding-left
  // inline so each level is still visually offset.
  const inlinePad = depth >= 3 ? ` style="padding-left:${4 + depth * 16}px"` : '';
  const parentCls = hasChildren ? ' layer-row-parent' : '';
  const pathStr = node.path.join('/');
  const id = _idFromPath(pathStr);
  const twist = hasChildren ? `<span class="layer-twist">${CHEVRON_SVG}</span>` : '';
  const labelAttr = node.labelKey ? ` data-i18n="${node.labelKey}"` : '';
  const subAttr = node.subKey ? ` data-i18n="${node.subKey}"` : '';
  const subDiv = node.sub ? `<div class="layer-sub"${subAttr}>${_esc(node.sub)}</div>` : '';
  const row =
    `<div class="layer-row${indentCls}${parentCls}"${inlinePad} data-path="${_esc(pathStr)}">` +
    twist +
    `<span class="layer-dot" style="background:${node.color}"></span>` +
    `<div class="layer-info">` +
    `<div class="layer-name"${labelAttr}>${_esc(node.label)}</div>` +
    subDiv +
    `</div>` +
    `<button class="gswitch on" id="${id}" role="switch" aria-checked="true"` +
    ` style="--gswitch-col:${node.color}" data-path="${_esc(pathStr)}"></button>` +
    `</div>`;
  if (!hasChildren) return row;
  return (
    `<div class="layer-group">` +
    row +
    node.children.map((c) => _renderNode(c, depth + 1)).join('') +
    `</div>`
  );
}

// Owns the tree DOM (#layers-tree), the gswitch click handlers, the All / None
// quick buttons, and the muon sub-tree rebuild on atlas load. Returns the
// `syncLayerToggles` helper so other widgets can refresh the layer-button
// "on" indicator after they manipulate layer state.
export function setupLayerTree() {
  const tree = document.getElementById('layers-tree');
  function renderTree() {
    tree.innerHTML = PANEL_TREE.map((n) => _renderNode(n, 0)).join('');
  }
  function syncLayerToggles() {
    for (const btn of tree.querySelectorAll('.gswitch')) {
      const node = _nodeByPath.get(btn.dataset.path);
      if (!node) continue;
      const on = _nodeOn(node);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-checked', on);
    }
    document.getElementById('btn-layers').classList.toggle(
      'on',
      PANEL_TREE.some((n) => _nodeOn(n)),
    );
  }
  function applyForPath(path) {
    if (path[0] === 'muon') applyMuonVisibility();
    else if (path[0] === 'fcal') applyFcalThreshold();
    else applyThreshold();
  }
  // Atlas may already be loaded, or arrive later. Either way, regenerate the
  // muon sub-tree once it's available so every chamber gets a toggle.
  function refreshMuonTree() {
    _rebuildMuonNode();
    _reindexTree();
    renderTree();
    syncLayerToggles();
  }

  renderTree();
  if (getMuonAtlasTrees().aSide || getMuonAtlasTrees().cSide) refreshMuonTree();
  onMuonTreesChange(refreshMuonTree);

  // Switch click: leaf toggles its boolean; parent flips the whole sub-tree
  // to the inverse of its aggregate ON state.
  tree.addEventListener('click', (e) => {
    const btn = e.target.closest('.gswitch');
    if (btn && tree.contains(btn)) {
      e.stopPropagation();
      const node = _nodeByPath.get(btn.dataset.path);
      if (!node) return;
      const wasOn = _nodeOn(node);
      if (node.mergePaths) {
        for (const p of node.mergePaths) setLayerSubtree(p, !wasOn);
      } else if (node.children) {
        setLayerSubtree(node.path, !wasOn);
      } else {
        setLayerLeaf(node.path, !wasOn);
      }
      syncLayerToggles();
      applyForPath(node.path);
      return;
    }
    // Click anywhere else on a parent row toggles its expand state.
    const row = e.target.closest('.layer-row-parent');
    if (row && tree.contains(row)) {
      row.parentElement.classList.toggle('expanded');
    }
  });

  document.getElementById('lbtn-all').addEventListener('click', () => {
    for (const n of PANEL_TREE) setLayerSubtree(n.path, true);
    syncLayerToggles();
    refreshSceneVisibility();
    applyMuonVisibility();
  });
  document.getElementById('lbtn-none').addEventListener('click', () => {
    for (const n of PANEL_TREE) setLayerSubtree(n.path, false);
    syncLayerToggles();
    refreshSceneVisibility();
    applyMuonVisibility();
  });

  syncLayerToggles();
  return { syncLayerToggles };
}
