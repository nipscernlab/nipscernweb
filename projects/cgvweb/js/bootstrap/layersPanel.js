// Detector layer toggles, the Layers popover panel, and the Tracks/Clusters
// toggle buttons.
//
// The layer hierarchy is generated from PANEL_TREE and rendered into
// #layers-tree at startup. Each node is bound to a path into visibility.js's
// `layerVis` object — leaf clicks flip a single boolean, parent clicks set
// the whole sub-tree.
//
// Owns layersPanelOpen state. Returns { closeLayersPanel, isOpen } so the
// keyboard-shortcut module can close the popover and inspect its state.

import {
  layerVis,
  setLayerLeaf,
  setLayerSubtree,
  anyLayerLeafOn,
  applyThreshold,
  applyFcalThreshold,
  refreshSceneVisibility,
  getTracksVisible,
  getClustersVisible,
  getJetsVisible,
  setTracksVisible,
  setClustersVisible,
  setJetsVisible,
} from '../visibility.js';
import { updateTrackAtlasIntersections } from '../trackAtlasIntersections.js';
import { markDirty } from '../renderer.js';
import { getViewLevel, onViewLevelChange } from '../viewLevel.js';

// Hex colours match the current palette family per top-level detector.
const C_TILE = '#c87c18';
const C_MBTS = '#e8c548';
const C_LAR = '#27b568';
const C_HEC = '#66e0f6';
const C_FCAL = '#b87333';

// Tree config — order here is the order shown in the panel. Each node:
//   path:    address into visibility.layerVis (string array)
//   label:   display text (i18n key falls back to this)
//   sub:     subtitle (optional)
//   color:   dot / switch accent
//   children: nested nodes (leaf if absent)
const PANEL_TREE = [
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
];

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
_indexTree(PANEL_TREE);

function _leafValue(path) {
  let node = layerVis;
  for (const k of path) node = node[k];
  return !!node;
}
function _nodeOn(node) {
  return node.children ? anyLayerLeafOn(node.path) : _leafValue(node.path);
}
function _esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function _renderNode(node, depth) {
  const hasChildren = !!(node.children && node.children.length);
  const indentCls = depth === 1 ? ' layer-row-child' : depth >= 2 ? ' layer-row-grandchild' : '';
  const parentCls = hasChildren ? ' layer-row-parent' : '';
  const pathStr = node.path.join('/');
  const id = `ltog-${pathStr.replace(/\//g, '-')}`;
  const twist = hasChildren ? `<span class="layer-twist">${CHEVRON_SVG}</span>` : '';
  const labelAttr = node.labelKey ? ` data-i18n="${node.labelKey}"` : '';
  const subAttr = node.subKey ? ` data-i18n="${node.subKey}"` : '';
  const subDiv = node.sub ? `<div class="layer-sub"${subAttr}>${_esc(node.sub)}</div>` : '';
  const row =
    `<div class="layer-row${indentCls}${parentCls}" data-path="${pathStr}">` +
    twist +
    `<span class="layer-dot" style="background:${node.color}"></span>` +
    `<div class="layer-info">` +
    `<div class="layer-name"${labelAttr}>${_esc(node.label)}</div>` +
    subDiv +
    `</div>` +
    `<button class="gswitch on" id="${id}" role="switch" aria-checked="true"` +
    ` style="--gswitch-col:${node.color}" data-path="${pathStr}"></button>` +
    `</div>`;
  if (!hasChildren) return row;
  return (
    `<div class="layer-group">` +
    row +
    node.children.map((c) => _renderNode(c, depth + 1)).join('') +
    `</div>`
  );
}

export function setupLayersPanel() {
  // ── Render the layer tree ────────────────────────────────────────────────
  const tree = document.getElementById('layers-tree');
  tree.innerHTML = PANEL_TREE.map((n) => _renderNode(n, 0)).join('');

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
    if (path[0] === 'fcal') applyFcalThreshold();
    else applyThreshold();
  }

  // Switch click: leaf toggles its boolean; parent flips the whole sub-tree
  // to the inverse of its aggregate ON state.
  tree.addEventListener('click', (e) => {
    const btn = e.target.closest('.gswitch');
    if (btn && tree.contains(btn)) {
      e.stopPropagation();
      const node = _nodeByPath.get(btn.dataset.path);
      if (!node) return;
      const wasOn = _nodeOn(node);
      if (node.children) setLayerSubtree(node.path, !wasOn);
      else setLayerLeaf(node.path, !wasOn);
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
  });
  document.getElementById('lbtn-none').addEventListener('click', () => {
    for (const n of PANEL_TREE) setLayerSubtree(n.path, false);
    syncLayerToggles();
    refreshSceneVisibility();
  });

  // ── Layers panel popover ───────────────────────────────────────────────────
  const layersPanel = document.getElementById('layers-panel');
  let layersPanelOpen = false;

  function openLayersPanel() {
    layersPanelOpen = true;
    layersPanel.classList.add('open');
    document.getElementById('btn-layers').classList.add('on');
    const br = document.getElementById('btn-layers').getBoundingClientRect();
    requestAnimationFrame(() => {
      const pw = layersPanel.offsetWidth || 210;
      const ph = layersPanel.offsetHeight || 170;
      let left = br.left + br.width / 2 - pw / 2;
      let top = br.top - ph - 10;
      left = Math.max(6, Math.min(left, window.innerWidth - pw - 6));
      top = Math.max(6, top);
      layersPanel.style.left = left + 'px';
      layersPanel.style.top = top + 'px';
    });
  }

  function closeLayersPanel() {
    layersPanelOpen = false;
    layersPanel.classList.remove('open');
    document.getElementById('btn-layers').classList.toggle(
      'on',
      PANEL_TREE.some((n) => _nodeOn(n)),
    );
  }

  document.getElementById('btn-layers').addEventListener('click', (e) => {
    e.stopPropagation();
    layersPanelOpen ? closeLayersPanel() : openLayersPanel();
  });
  document.addEventListener('click', () => {
    if (layersPanelOpen) closeLayersPanel();
  });
  layersPanel.addEventListener('click', (e) => e.stopPropagation());

  syncLayerToggles();

  // ── Tracks / Clusters toggles ──────────────────────────────────────────────
  function syncTracksBtn() {
    document.getElementById('btn-tracks').classList.toggle('on', getTracksVisible());
  }
  document.getElementById('btn-tracks').addEventListener('click', () => {
    setTracksVisible(!getTracksVisible());
    updateTrackAtlasIntersections();
    syncTracksBtn();
    markDirty();
  });

  // K button is level-aware: at L2 it toggles cluster lines, at L3 it toggles
  // jet lines, and at L1 it's disabled (no cluster/jet to show).
  const btnCluster = document.getElementById('btn-cluster');
  function syncClustersBtn() {
    const lvl = getViewLevel();
    if (lvl === 1) {
      btnCluster.classList.add('disabled');
      btnCluster.classList.remove('on');
    } else {
      btnCluster.classList.remove('disabled');
      const flag = lvl === 3 ? getJetsVisible() : getClustersVisible();
      btnCluster.classList.toggle('on', flag);
    }
  }
  btnCluster.addEventListener('click', () => {
    const lvl = getViewLevel();
    if (lvl === 1) return;
    if (lvl === 3) setJetsVisible(!getJetsVisible());
    else setClustersVisible(!getClustersVisible());
    syncClustersBtn();
    markDirty();
  });
  onViewLevelChange(syncClustersBtn);
  syncClustersBtn();

  return {
    closeLayersPanel,
    isOpen: () => layersPanelOpen,
  };
}
