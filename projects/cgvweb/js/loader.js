import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  meshByKey,
  cellMeshesByDet,
  _ZERO_MAT4,
  _allCellIMeshes,
  _tileKey,
  _larEmKey,
  _hecKey,
} from './state.js';
import { matTile, matHec, matLAr, PAL_TILE_COLOR } from './palette.js';
import { scene, markDirty } from './renderer.js';
import { ghostVisible, ghostMeshByName } from './ghost.js';
import { HEC_NAMES } from './coords.js';
import { setLoadProgress } from './loading.js';
import { esc } from './utils.js';

// ── Mesh name → integer key ───────────────────────────────────────────────────
// Called once per mesh at GLB load time. Returns null for envelope/unknown meshes.
function meshNameToKey(name) {
  const S = '→';
  const a = name.indexOf(S);
  if (a < 0) return null;
  const b = name.indexOf(S, a + 1);
  if (b < 0) return null;
  const c = name.indexOf(S, b + 1);
  const l1 = name.slice(a + 1, b);
  const l2 = c < 0 ? name.slice(b + 1) : name.slice(b + 1, c);
  const l3 = c < 0 ? '' : name.slice(c + 1);
  let m;
  // TILE (legacy): Tile{x}{y}_0 → Tile{x}{y}{k}_{k} → cell_{mod}
  if ((m = /^Tile(\d+)([pn])_0$/.exec(l1))) {
    const layer = +m[1],
      pn = m[2] === 'p' ? 1 : 0;
    const m2 = /^Tile\d+[pn](\d+)_\d+$/.exec(l2);
    if (!m2) return null;
    const m3 = /^cell_(\d+)$/.exec(l3);
    if (!m3) return null;
    return _tileKey(layer, pn, +m2[1], +m3[1]);
  }
  // TILE (current): T{x}{y}{k}_{k} → c_{mod}
  if ((m = /^T(\d+)([pn])(\d+)_\d+$/.exec(l1))) {
    const layer = +m[1],
      pn = m[2] === 'p' ? 1 : 0,
      ieta = +m[3];
    const m2 = /^c_(\d+)$/.exec(l2);
    if (!m2) return null;
    return _tileKey(layer, pn, ieta, +m2[1]);
  }
  // LAr EM (legacy): EM{X}_{samp}_{R}_{Z}_{W} → … → cell[2]_{phi}
  if ((m = /^EM(Barrel|EndCap)_(\d+)_(\d+)_([pn])_\d+$/.exec(l1))) {
    const eb = m[1] === 'Barrel' ? 1 : +m[3],
      sampling = +m[2],
      region = +m[3],
      pn = m[4] === 'p' ? 1 : 0;
    const m2 = /^EM(?:Barrel|EndCap)_\d+_\d+_[pn]_(\d+)_\d+$/.exec(l2);
    if (!m2) return null;
    const m3 = /^cell(2?)_(\d+)$/.exec(l3);
    if (!m3) return null;
    return _larEmKey(eb, sampling, region, pn, +m2[1], +m3[2]);
  }
  // LAr EM barrel (current): EB_{samp}_{region}_{Z}_{eta}_{eta} → c[2]_{phi}
  if ((m = /^EB_(\d+)_(\d+)_([pn])_(\d+)_\d+$/.exec(l1))) {
    const sampling = +m[1],
      region = +m[2],
      pn = m[3] === 'p' ? 1 : 0,
      eta = +m[4];
    const m2 = /^c(2?)_(\d+)$/.exec(l2);
    if (!m2) return null;
    return _larEmKey(1, sampling, region, pn, eta, +m2[2]);
  }
  // LAr EM endcap (current): EE_{samp}_{abs_be}_{Z}_{eta}_{eta} → c[2]_{phi}
  if ((m = /^EE_(\d+)_(\d+)_([pn])_(\d+)_\d+$/.exec(l1))) {
    const sampling = +m[1],
      eb = +m[2],
      pn = m[3] === 'p' ? 1 : 0,
      eta = +m[4];
    const m2 = /^c(2?)_(\d+)$/.exec(l2);
    if (!m2) return null;
    return _larEmKey(eb, sampling, eb, pn, eta, +m2[2]);
  }
  // HEC (legacy): HEC_{name}_{region}_{Z}_0 → … → cell_{phi}
  if ((m = /^HEC_(\w+)_(\d+)_([pn])_0$/.exec(l1))) {
    const group = HEC_NAMES.indexOf(m[1]);
    if (group < 0) return null;
    const m2 = /^HEC_\w+_\d+_[pn]_(\d+)_\d+$/.exec(l2);
    if (!m2) return null;
    const m3 = /^cell_(\d+)$/.exec(l3);
    if (!m3) return null;
    return _hecKey(group, +m[2], m[3] === 'p' ? 1 : 0, +m2[1], +m3[1]);
  }
  // HEC (current): H_{group}_{region}_{Z}_{cum}_{cum} → c_{phi}
  if ((m = /^H_(\d+)_(\d+)_([pn])_(\d+)_\d+$/.exec(l1))) {
    const group = HEC_NAMES.indexOf(m[1]);
    if (group < 0) return null;
    const m2 = /^c_(\d+)$/.exec(l2);
    if (!m2) return null;
    return _hecKey(group, +m[2], m[3] === 'p' ? 1 : 0, +m[4], +m2[1]);
  }
  return null;
}

// Detector classifier for show-all-cells mode. Returns null for envelopes.
function classifyCellDet(name) {
  if (ghostVisible.has(name)) return null;
  const parts = name.split('→');
  if (parts.length < 3) return null;
  for (const p of parts) {
    if (p.startsWith('EB_') || p.startsWith('EE_')) return 'LAR';
    if (p.startsWith('H_')) return 'HEC';
    if (/^T\d/.test(p)) return 'TILE';
  }
  return null;
}

// Build a hierarchy tree from atlas mesh name paths "atlas→A→B→...".
// Each node: { name, parent, children: Map, meshes: Mesh[], allMeshes: Mesh[] }
function _buildAtlasTree(meshes) {
  const root = { name: 'atlas', parent: null, children: new Map(), meshes: [], allMeshes: [] };
  for (const mesh of meshes) {
    const parts = mesh.name.split('→');
    let node = root;
    for (let i = 1; i < parts.length; i++) {
      if (!node.children.has(parts[i]))
        node.children.set(parts[i], {
          name: parts[i],
          parent: node,
          children: new Map(),
          meshes: [],
          allMeshes: [],
        });
      node = node.children.get(parts[i]);
      if (i === parts.length - 1) node.meshes.push(mesh);
    }
  }
  const propagate = (n) => {
    n.allMeshes = [...n.meshes];
    for (const c of n.children.values()) {
      propagate(c);
      n.allMeshes.push(...c.allMeshes);
    }
  };
  propagate(root);
  return root;
}

// ── OPFS cache helpers ────────────────────────────────────────────────────────
const _GLB_URL = './geometry_data/CaloGeometry.glb.gz';
const _OPFS_DATA_NAME = 'CaloGeometry.glb.gz.bin';
const _OPFS_META_NAME = 'CaloGeometry.glb.meta';

async function _opfsRoot() {
  if (!navigator.storage?.getDirectory) return null;
  try {
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}
async function _opfsLoadGz(version) {
  const root = await _opfsRoot();
  if (!root || !version) return null;
  try {
    const metaH = await root.getFileHandle(_OPFS_META_NAME, { create: false });
    const meta = JSON.parse(await (await metaH.getFile()).text());
    if (meta.v !== version) return null;
    const dataH = await root.getFileHandle(_OPFS_DATA_NAME, { create: false });
    const file = await dataH.getFile();
    if (file.size !== meta.size) return null;
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}
async function _opfsSaveGz(buffer, version) {
  const root = await _opfsRoot();
  if (!root || !version) return;
  try {
    const dataH = await root.getFileHandle(_OPFS_DATA_NAME, { create: true });
    const wd = await dataH.createWritable();
    await wd.write(buffer);
    await wd.close();
    const metaH = await root.getFileHandle(_OPFS_META_NAME, { create: true });
    const wm = await metaH.createWritable();
    await wm.write(JSON.stringify({ v: version, size: buffer.byteLength, t: Date.now() }));
    await wm.close();
  } catch {
    /* OPFS quota or transient error — best-effort */
  }
}
async function _glbVersion() {
  // HEAD with no-cache forces a real server round trip to detect file updates.
  try {
    const head = await fetch(_GLB_URL, { method: 'HEAD', cache: 'no-cache' });
    if (!head.ok) return '';
    return head.headers.get('etag') || head.headers.get('last-modified') || '';
  } catch {
    return '';
  }
}
async function _decompressGz(stream, totalBytes, onProgress) {
  let loaded = 0;
  const counter = new TransformStream({
    transform(chunk, ctrl) {
      loaded += chunk.byteLength;
      if (totalBytes && onProgress) onProgress(loaded / totalBytes);
      ctrl.enqueue(chunk);
    },
  });
  return new Response(
    stream.pipeThrough(counter).pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer();
}

// ── initScene ─────────────────────────────────────────────────────────────────
// Fetches CaloGeometry.glb.gz (OPFS cache → network), parses it, and builds all
// InstancedMeshes. Calls onSceneReady() on success, onAtlasReady(tree) if atlas
// meshes are present.
export async function initScene({ setStatus, atlasMat, onSceneReady, onAtlasReady }) {
  setLoadProgress(0, 'Loading geometry…');
  let buffer = null;

  // ── 1. OPFS cache hit ──────────────────────────────────────────────────────
  const version = await _glbVersion();
  if (version) {
    const cachedGz = await _opfsLoadGz(version);
    if (cachedGz) {
      try {
        buffer = await _decompressGz(new Blob([cachedGz]).stream(), cachedGz.byteLength, (pct) =>
          setLoadProgress(pct * 40, `Loading cached geometry… ${Math.round(pct * 100)}%`),
        );
      } catch {
        buffer = null;
      }
    }
  }

  // ── 2. Network fetch ───────────────────────────────────────────────────────
  if (!buffer) {
    try {
      const res = await fetch(_GLB_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = parseInt(res.headers.get('Content-Length') || '0', 10);
      const [streamForDecode, streamForCache] = res.body.tee();
      const decodePromise = _decompressGz(streamForDecode, total, (pct) => {
        setLoadProgress(pct * 40, `Downloading geometry… ${Math.round(pct * 100)}%`);
        setStatus(`Downloading geometry: ${Math.round(pct * 100)}%`);
      });
      if (version) {
        new Response(streamForCache)
          .arrayBuffer()
          .then((gz) => _opfsSaveGz(gz, version))
          .catch(() => {});
      } else {
        streamForCache.cancel().catch(() => {});
      }
      buffer = await decodePromise;
    } catch (_) {
      setStatus('<span class="warn">CaloGeometry.glb.gz not found.</span>');
      setLoadProgress(100, 'Geometry skipped');
      onSceneReady();
      return;
    }
  }

  // ── 3. GLB parse + scene assembly ─────────────────────────────────────────
  new GLTFLoader().parse(
    buffer,
    './',
    ({ scene: g }) => {
      const ghosts = [];
      const atlasMeshes = [];
      const groups = new Map(); // "DET::uuid" → { det, geo, items }
      const loose = [];

      g.updateMatrixWorld(true);
      g.traverse((o) => {
        if (!o.isMesh) return;
        if (ghostVisible.has(o.name)) {
          ghosts.push(o);
          return;
        }
        if (o.name.split('→')[0] === 'atlas') {
          atlasMeshes.push(o);
          return;
        }
        const det = classifyCellDet(o.name);
        if (!det) {
          loose.push(o);
          return;
        }
        const gk = `${det}::${o.geometry.uuid}`;
        let bucket = groups.get(gk);
        if (!bucket) {
          bucket = { det, geo: o.geometry, items: [] };
          groups.set(gk, bucket);
        }
        bucket.items.push({
          matrix: o.matrixWorld.clone(),
          name: o.name,
          key: meshNameToKey(o.name),
        });
      });

      // Build one InstancedMesh per (detector, geometry) pair.
      const cellsGroup = new THREE.Group();
      cellsGroup.name = 'cells';
      cellsGroup.matrixAutoUpdate = false;

      for (const { det, geo, items } of groups.values()) {
        const mat = det === 'TILE' ? matTile : det === 'LAR' ? matLAr : matHec;
        const iMesh = new THREE.InstancedMesh(geo, mat, items.length);
        iMesh.name = `cells_${det}_${geo.uuid.slice(0, 8)}`;
        iMesh.matrixAutoUpdate = false;
        iMesh.frustumCulled = false;
        iMesh.renderOrder = 2;
        iMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        iMesh.setColorAt(0, new THREE.Color(1, 1, 1)); // allocate instanceColor buffer
        const handles = new Array(items.length);
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          iMesh.setMatrixAt(i, _ZERO_MAT4); // start hidden
          iMesh.setColorAt(i, PAL_TILE_COLOR[0]); // neutral; overwritten on event
          const h = { iMesh, instId: i, det, name: it.name, origMatrix: it.matrix, visible: false };
          handles[i] = h;
          if (it.key !== null) meshByKey.set(it.key, h);
          cellMeshesByDet[det].push(h);
        }
        iMesh.userData.handles = handles;
        iMesh.instanceMatrix.needsUpdate = true;
        iMesh.instanceColor.needsUpdate = true;
        cellsGroup.add(iMesh);
        _allCellIMeshes.push(iMesh);
      }
      scene.add(cellsGroup);

      // Envelope ghosts keep their individual-mesh behaviour.
      for (const gh of ghosts) {
        gh.matrixAutoUpdate = false;
        gh.frustumCulled = false;
        gh.visible = false;
        ghostMeshByName.set(gh.name, gh);
        scene.add(gh);
      }
      for (const o of loose) {
        o.matrixAutoUpdate = false;
        o.frustumCulled = false;
        o.visible = false;
        scene.add(o);
      }

      // Atlas structural geometry (atlas.root, cm → mm ×10 scale).
      if (atlasMeshes.length > 0) {
        const atlasContainer = new THREE.Group();
        atlasContainer.name = 'atlas-geo';
        atlasContainer.scale.setScalar(10);
        atlasContainer.updateMatrix();
        atlasContainer.matrixAutoUpdate = false;
        for (const o of atlasMeshes) {
          o.material = atlasMat;
          o.matrixAutoUpdate = false;
          o.frustumCulled = false;
          o.visible = false;
          atlasContainer.add(o);
        }
        scene.add(atlasContainer);
        onAtlasReady(_buildAtlasTree(atlasMeshes));
      }

      markDirty();
      setLoadProgress(100, 'Geometry loaded');
      onSceneReady();
    },
    (e) => {
      setStatus(`<span class="warn">GLB parse error: ${esc(e.message)}</span>`);
    },
  );
}
