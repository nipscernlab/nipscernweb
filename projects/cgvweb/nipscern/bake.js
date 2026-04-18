import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import wasmInit, { parse_atlas_ids_bulk } from './atlas_id_parser.js';

const logEl = document.getElementById('log');
const btn = document.getElementById('go');
const log = (...a) => { console.log(...a); logEl.textContent += a.join(' ') + '\n'; };

const SUBSYS_TILE = 1, SUBSYS_LAR_EM = 2, SUBSYS_LAR_HEC = 3;
const DEF_THR = 200;
const thrTileMev = DEF_THR, thrLArMev = DEF_THR, thrHecMev = 1000, thrFcalMev = DEF_THR;

const PAL_N = 256;
function palColorTile(t){t=Math.max(0,Math.min(1,t));return new THREE.Color(1+t*(0.502-1),1+t*(0-1),0);}
function palColorHec(t){t=Math.max(0,Math.min(1,t));return new THREE.Color(0.4+t*(0.0471-0.4),0.8784+t*(0.0118-0.8784),0.9647+t*(0.4078-0.9647));}
function palColorLAr(t){t=Math.max(0,Math.min(1,t));return new THREE.Color(0.0902+t*(0.1529-0.0902),0.8118+t*(0-0.8118),0.2588);}
function makePal(fn){return Array.from({length:PAL_N},(_,i)=>{const c=fn(i/(PAL_N-1));c.offsetHSL(0,0.35,0);return c;});}
const PAL_TILE = makePal(palColorTile);
const PAL_HEC  = makePal(palColorHec);
const PAL_LAR  = makePal(palColorLAr);
const TILE_SCALE=2000, HEC_SCALE=5000, LAR_SCALE=1000;
const colTile = eMev => PAL_TILE[Math.round(Math.max(0,Math.min(1,eMev/TILE_SCALE))*(PAL_N-1))];
const colHec  = eMev => PAL_HEC [Math.round(Math.max(0,Math.min(1,eMev/HEC_SCALE ))*(PAL_N-1))];
const colLAr  = eMev => PAL_LAR [Math.round(Math.max(0,Math.min(1,eMev/LAR_SCALE ))*(PAL_N-1))];

// FCAL copper palette — mirrors js/main.js palColorFcalRgb with gamma 0.55.
const FCAL_SCALE = 7000; // MeV
const _FCAL_STOPS = [
  [0.102, 0.024, 0.000], [0.420, 0.137, 0.063], [0.784, 0.392, 0.165],
  [1.000, 0.698, 0.416], [1.000, 0.918, 0.745],
];
const _FCAL_STEPS = [0.0, 0.25, 0.55, 0.80, 1.0];
function palColorFcal(eMev){
  let t = Math.max(0, Math.min(1, eMev / FCAL_SCALE));
  t = Math.pow(t, 0.55);
  for (let i = 1; i < _FCAL_STEPS.length; i++){
    if (t <= _FCAL_STEPS[i]){
      const k = (t - _FCAL_STEPS[i-1]) / (_FCAL_STEPS[i] - _FCAL_STEPS[i-1]);
      const a = _FCAL_STOPS[i-1], b = _FCAL_STOPS[i];
      return new THREE.Color(a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k);
    }
  }
  const s = _FCAL_STOPS[_FCAL_STOPS.length-1];
  return new THREE.Color(s[0], s[1], s[2]);
}
const _FCAL_TWIST_RAD = (2 * Math.PI) / 16;

const GHOST_TILE_NAMES = [
  'Calorimeter\u2192LBTile_0', 'Calorimeter\u2192LBTileLArg_0',
  'Calorimeter\u2192EBTilep_0', 'Calorimeter\u2192EBTilen_0',
  'Calorimeter\u2192EBTileHECp_0', 'Calorimeter\u2192EBTileHECn_0',
];
const HEC_NAMES = ['1','23','45','67'];

function extractCells(doc, tagName){
  const els = doc.getElementsByTagName(tagName); const cells=[];
  for(const el of els){
    let n=0;
    for(const ch of el.children){
      const id=ch.getAttribute('id')??ch.getAttribute('cellID');
      const ev=ch.getAttribute('energy')??ch.getAttribute('e');
      if(id&&ev){const e=parseFloat(ev);if(isFinite(e)){cells.push({id:id.trim(),energy:e});n++;}}
    }
    if(n) continue;
    const idEl=el.querySelector('id, cellID'); const eEl=el.querySelector('energy, e');
    if(idEl&&eEl){
      const ids=idEl.textContent.trim().split(/\s+/);
      const ens=eEl.textContent.trim().split(/\s+/).map(Number);
      const m=Math.min(ids.length,ens.length);
      for(let i=0;i<m;i++) if(ids[i]&&isFinite(ens[i])) cells.push({id:ids[i],energy:ens[i]});
    }
  }
  return cells;
}
// FCAL cells: (x,y,z,dx,dy,dz) in cm, energy in GeV. Rendered as oriented cylinders.
function extractFcal(doc){
  const cells = [];
  for (const el of doc.getElementsByTagName('FCAL')){
    const xEl=el.querySelector('x'),  yEl=el.querySelector('y'),  zEl=el.querySelector('z');
    const dxEl=el.querySelector('dx'),dyEl=el.querySelector('dy'),dzEl=el.querySelector('dz');
    const eEl=el.querySelector('energy');
    if(!xEl||!yEl||!zEl||!dxEl||!dyEl||!dzEl) continue;
    const xs =xEl .textContent.trim().split(/\s+/).map(Number);
    const ys =yEl .textContent.trim().split(/\s+/).map(Number);
    const zs =zEl .textContent.trim().split(/\s+/).map(Number);
    const dxs=dxEl.textContent.trim().split(/\s+/).map(Number);
    const dys=dyEl.textContent.trim().split(/\s+/).map(Number);
    const dzs=dzEl.textContent.trim().split(/\s+/).map(Number);
    const ens=eEl ? eEl.textContent.trim().split(/\s+/).map(Number) : [];
    const n = Math.min(xs.length, ys.length, zs.length, dxs.length, dys.length, dzs.length);
    for (let i = 0; i < n; i++){
      if (!isFinite(xs[i]) || !isFinite(ys[i]) || !isFinite(zs[i])) continue;
      cells.push({
        x: xs[i], y: ys[i], z: zs[i],
        dx: dxs[i]||0, dy: dys[i]||0, dz: dzs[i]||0,
        energy: isFinite(ens[i]) ? ens[i] : 0,
      });
    }
  }
  return cells;
}
function extractMbts(doc){
  const cells=[];
  for(const el of doc.getElementsByTagName('MBTS')){
    let n=0;
    for(const ch of el.children){
      const lbl=ch.getAttribute('label'); const ev=ch.getAttribute('energy')??ch.getAttribute('e');
      if(lbl&&ev){const e=parseFloat(ev);if(isFinite(e)){cells.push({label:lbl.trim(),energy:e});n++;}}
    }
    if(n) continue;
    const lblEl=el.querySelector('label'); const eEl=el.querySelector('energy, e');
    if(lblEl&&eEl){
      const ls=lblEl.textContent.trim().split(/\s+/);
      const ens=eEl.textContent.trim().split(/\s+/).map(Number);
      const m=Math.min(ls.length,ens.length);
      for(let i=0;i<m;i++) if(ls[i]&&isFinite(ens[i])) cells.push({label:ls[i],energy:ens[i]});
    }
  }
  return cells;
}
const CLUSTER_THR_GEV = 3;
const CLUSTER_CYL_IN_R = 1400, CLUSTER_CYL_IN_HALF_H = 3200;
const CLUSTER_CYL_OUT_R = 3820, CLUSTER_CYL_OUT_HALF_H = 6000;
function _cylIntersect(dx, dy, dz, r, halfH){
  const rT = Math.sqrt(dx*dx + dy*dy);
  if(rT > 1e-9){
    const tB = r / rT;
    if(Math.abs(dz * tB) <= halfH) return tB;
  }
  return halfH / Math.abs(dz);
}
function parseClusters(doc){
  const out = [];
  for(const el of doc.getElementsByTagName('Cluster')){
    const etaEl = el.querySelector('eta');
    const phiEl = el.querySelector('phi');
    const etEl  = el.querySelector('et');
    if(!etaEl || !phiEl) continue;
    const etas = etaEl.textContent.trim().split(/\s+/).map(Number);
    const phis = phiEl.textContent.trim().split(/\s+/).map(Number);
    const ets  = etEl ? etEl.textContent.trim().split(/\s+/).map(Number) : [];
    const m = Math.min(etas.length, phis.length);
    for(let i=0;i<m;i++){
      const eta = etas[i], phi = phis[i], et = isFinite(ets[i]) ? ets[i] : 0;
      if(!isFinite(eta) || !isFinite(phi)) continue;
      if(et < CLUSTER_THR_GEV) continue;
      const theta = 2 * Math.atan(Math.exp(-eta));
      const sinT = Math.sin(theta);
      const dx = -sinT * Math.cos(phi);
      const dy = -sinT * Math.sin(phi);
      const dz =  Math.cos(theta);
      const t0 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R,  CLUSTER_CYL_IN_HALF_H);
      const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
      const arr = new Float32Array(6);
      arr[0] = dx*t0; arr[1] = dy*t0; arr[2] = dz*t0;
      arr[3] = dx*t1; arr[4] = dy*t1; arr[5] = dz*t1;
      out.push(arr);
    }
  }
  return out;
}
function parseTracks(doc){
  const out=[];
  for(const el of doc.getElementsByTagName('Track')){
    const numPolyEl=el.querySelector('numPolyline');
    const pxEl=el.querySelector('polylineX'), pyEl=el.querySelector('polylineY'), pzEl=el.querySelector('polylineZ');
    if(!numPolyEl||!pxEl||!pyEl||!pzEl) continue;
    const numPoly=numPolyEl.textContent.trim().split(/\s+/).map(Number);
    const xs=pxEl.textContent.trim().split(/\s+/).map(Number);
    const ys=pyEl.textContent.trim().split(/\s+/).map(Number);
    const zs=pzEl.textContent.trim().split(/\s+/).map(Number);
    let offset=0;
    for(let i=0;i<numPoly.length;i++){
      const n=numPoly[i];
      if(n>=2){
        const arr=new Float32Array(n*3);
        for(let j=0;j<n;j++){
          const k=offset+j;
          arr[j*3  ] = -xs[k]*10;
          arr[j*3+1] = -ys[k]*10;
          arr[j*3+2] =  zs[k]*10;
        }
        out.push(arr);
      }
      offset+=n;
    }
  }
  return out;
}
function mbtsMeshPath(label, meshByName){
  const m=/^type_(-?1)_ch_([01])_mod_([0-7])$/.exec(label);
  if(!m) return null;
  const side=m[1]==='1'?'p':'n';
  const tileNum=m[2]==='0'?14:15;
  const mod=m[3];
  const path=`Calorimeter\u2192Tile${tileNum}${side}_0\u2192Tile${tileNum}${side}0_0\u2192cell_${mod}`;
  return meshByName.has(path)?path:null;
}

function bakeGeom(mesh){
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  const pos = g.getAttribute('position').array;
  let idx = g.index ? g.index.array : null;
  if(!idx){
    idx = new Uint32Array(pos.length/3);
    for(let i=0;i<idx.length;i++) idx[i]=i;
  } else if(!(idx instanceof Uint32Array)){
    idx = new Uint32Array(idx);
  }
  const edgeGeo = new THREE.EdgesGeometry(g, 30);
  const edge = edgeGeo.getAttribute('position').array;
  const posF32   = pos   instanceof Float32Array ? pos   : new Float32Array(pos);
  const edgeF32  = edge  instanceof Float32Array ? edge  : new Float32Array(edge);
  g.dispose(); edgeGeo.dispose();
  return { pos: posF32, idx, edge: edgeF32 };
}

// Bake one FCAL tube into world-space geometry. Mirrors js/main.js _applyFcalDraw:
//   unit CylinderGeometry(1,1,1,8,1,false) → scale (rx, len, ry) → rotate (0,1,0)→(0,0,±1) → twist.
const _fcalUpVec   = new THREE.Vector3(0, 1, 0);
const _fcalTwistAx = new THREE.Vector3(0, 1, 0);
function bakeFcalCell({x, y, z, dx, dy, dz}){
  const rx  = Math.max(Math.abs(dx) * 5, 1e-3);
  const ry  = Math.max(Math.abs(dy) * 5, 1e-3);
  const len = Math.max(Math.abs(dz) * 2 * 10, 1e-3);   // cm → mm, full depth
  const cx  = -x * 10,  cy = -y * 10,  cz = z * 10;
  const dir = new THREE.Vector3(0, 0, dz >= 0 ? 1 : -1);
  const q   = new THREE.Quaternion().setFromUnitVectors(_fcalUpVec, dir);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(_fcalTwistAx, _FCAL_TWIST_RAD));
  const m   = new THREE.Matrix4().compose(
    new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(rx, len, ry));
  const geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  geo.applyMatrix4(m);
  const pos = geo.getAttribute('position').array;
  let idx = geo.index ? geo.index.array : null;
  if(!idx){
    idx = new Uint32Array(pos.length/3);
    for(let i=0;i<idx.length;i++) idx[i]=i;
  } else if(!(idx instanceof Uint32Array)){
    idx = new Uint32Array(idx);
  }
  const edgeGeo = new THREE.EdgesGeometry(geo, 30);
  const edge = edgeGeo.getAttribute('position').array;
  const posF32  = pos  instanceof Float32Array ? pos  : new Float32Array(pos);
  const edgeF32 = edge instanceof Float32Array ? edge : new Float32Array(edge);
  geo.dispose(); edgeGeo.dispose();
  return { pos: posF32, idx, edge: edgeF32 };
}

function bakeGhost(mesh){
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  const pos = g.getAttribute('position').array;
  let idx = g.index ? g.index.array : null;
  if(!idx){
    idx = new Uint32Array(pos.length/3);
    for(let i=0;i<idx.length;i++) idx[i]=i;
  } else if(!(idx instanceof Uint32Array)){
    idx = new Uint32Array(idx);
  }
  const posF32 = pos instanceof Float32Array ? pos : new Float32Array(pos);
  g.dispose();
  return { pos: posF32, idx };
}

async function main(){
  btn.disabled = true;
  log('Initializing WASM...');
  await wasmInit();

  log('Loading GLB...');
  const meshByName = new Map();
  await new Promise((res, rej)=>{
    new GLTFLoader().load('./CaloGeometry.glb', ({scene:g}) => {
      g.traverse(o => { if(o.isMesh) meshByName.set(o.name, o); });
      res();
    }, undefined, rej);
  });
  log('  meshes:', meshByName.size);

  log('Fetching XML...');
  const xmlText = await (await fetch('./JiveXML_518084_14173642443.xml')).text();
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const pe = doc.querySelector('parsererror');
  if(pe) throw new Error('XML parse error: '+pe.textContent.slice(0,120));

  const tileCells = extractCells(doc, 'TILE');
  const larCells  = extractCells(doc, 'LAr');
  const hecCells  = extractCells(doc, 'HEC');
  const mbtsCells = extractMbts(doc);
  const fcalCells = extractFcal(doc);
  log('  TILE', tileCells.length, 'LAr', larCells.length, 'HEC', hecCells.length,
      'MBTS', mbtsCells.length, 'FCAL', fcalCells.length);

  const tracks = parseTracks(doc);
  log('  tracks:', tracks.length);
  const clusters = parseClusters(doc);
  log('  clusters (Et >= '+CLUSTER_THR_GEV+' GeV):', clusters.length);

  // Resolve to (meshName, energyMev, det)
  const idsToStr = cs => cs.map(c=>c.id).join(' ');
  const tilePacked = tileCells.length ? parse_atlas_ids_bulk(idsToStr(tileCells)) : null;
  const larPacked  = larCells.length  ? parse_atlas_ids_bulk(idsToStr(larCells))  : null;
  const hecPacked  = hecCells.length  ? parse_atlas_ids_bulk(idsToStr(hecCells))  : null;

  const active = new Map(); // name -> { det, eMev }

  for(let i=0;i<tileCells.length;i++){
    const b=i*8; if(tilePacked[b]!==SUBSYS_TILE) continue;
    const x=tilePacked[b+1], k=tilePacked[b+2], side=tilePacked[b+3], mod=tilePacked[b+4];
    const eMev=tileCells[i].energy*1000;
    const y=side<0?'n':'p';
    const path=`Calorimeter\u2192Tile${x}${y}_0\u2192Tile${x}${y}${k}_${k}\u2192cell_${mod}`;
    if(!meshByName.has(path)) continue;
    if(eMev < thrTileMev) continue;
    active.set(path, {det:'TILE', eMev});
  }
  for(let i=0;i<larCells.length;i++){
    const b=i*8; if(larPacked[b]!==SUBSYS_LAR_EM) continue;
    const abs_be=larPacked[b+1], sampling=larPacked[b+2], z_pos=larPacked[b+4],
          R=larPacked[b+5], eta=larPacked[b+6], phi=larPacked[b+7];
    const eMev=larCells[i].energy*1000;
    const X=abs_be===1?'Barrel':'EndCap'; const W=abs_be===1?0:1; const Z=z_pos?'p':'n';
    const prefix=`Calorimeter\u2192EM${X}_${sampling}_${R}_${Z}_${W}\u2192EM${X}_${sampling}_${R}_${Z}_${eta}_${eta}\u2192`;
    const path = meshByName.has(prefix+`cell_${phi}`)  ? prefix+`cell_${phi}`  :
                 meshByName.has(prefix+`cell2_${phi}`) ? prefix+`cell2_${phi}` : null;
    if(!path) continue;
    if(eMev < thrLArMev) continue;
    active.set(path, {det:'LAR', eMev});
  }
  for(let i=0;i<hecCells.length;i++){
    const b=i*8; if(hecPacked[b]!==SUBSYS_LAR_HEC) continue;
    const group=hecPacked[b+1], region=hecPacked[b+2], z_pos=hecPacked[b+3],
          cum_eta=hecPacked[b+4], phi=hecPacked[b+5];
    const eMev=hecCells[i].energy*1000;
    const Z=z_pos?'p':'n'; const name=HEC_NAMES[group];
    const path=`Calorimeter\u2192HEC_${name}_${region}_${Z}_0\u2192HEC_${name}_${region}_${Z}_${cum_eta}_${cum_eta}\u2192cell_${phi}`;
    if(!meshByName.has(path)) continue;
    if(eMev < thrHecMev) continue;
    active.set(path, {det:'HEC', eMev});
  }
  for(const {label, energy} of mbtsCells){
    const eMev = energy*1000;
    const path = mbtsMeshPath(label, meshByName);
    if(!path) continue;
    if(eMev < thrTileMev) continue;
    active.set(path, {det:'TILE', eMev});
  }
  log('  active cells (after threshold):', active.size);

  // FCAL: energy ≥ threshold and ≥ 0 (mirrors live viewer filter).
  const fcalActive = fcalCells.filter(c => c.energy >= 0 && c.energy * 1000 >= thrFcalMev);
  log('  active FCAL cells (after threshold):', fcalActive.length);

  // Bake all active cells
  log('Baking cell geometries...');
  const cellHeaders = [];
  const chunks = []; // array of {arr, align}  (we'll emit Float32/Uint32)
  let byteCursor = 0;
  function pushChunk(arr){
    // align to 4 bytes
    const align = 4;
    if(byteCursor % align) byteCursor += align - (byteCursor % align);
    const off = byteCursor;
    chunks.push({arr, off});
    byteCursor += arr.byteLength;
    return [off, arr.byteLength];
  }

  for(const [name, {det, eMev}] of active){
    const mesh = meshByName.get(name);
    const {pos, idx, edge} = bakeGeom(mesh);
    const col = det==='TILE' ? colTile(eMev) : det==='LAR' ? colLAr(eMev) : colHec(eMev);
    cellHeaders.push({
      det, rgb:[+col.r.toFixed(4), +col.g.toFixed(4), +col.b.toFixed(4)],
      pos: pushChunk(pos),
      idx: pushChunk(idx),
      edge: pushChunk(edge),
    });
  }

  // FCAL — bake each tube as its own cell entry (no GLB mesh, synthesized from JiveXML).
  for (const c of fcalActive){
    const {pos, idx, edge} = bakeFcalCell(c);
    const col = palColorFcal(Math.abs(c.energy) * 1000);
    cellHeaders.push({
      det: 'FCAL', rgb:[+col.r.toFixed(4), +col.g.toFixed(4), +col.b.toFixed(4)],
      pos: pushChunk(pos),
      idx: pushChunk(idx),
      edge: pushChunk(edge),
    });
  }

  log('Baking ghost meshes...');
  const ghostHeaders = [];
  for(const name of GHOST_TILE_NAMES){
    const mesh = meshByName.get(name);
    if(!mesh) continue;
    const {pos, idx} = bakeGhost(mesh);
    ghostHeaders.push({
      pos: pushChunk(pos),
      idx: pushChunk(idx),
    });
  }

  log('Packing tracks...');
  const trackHeaders = [];
  for(const arr of tracks){
    trackHeaders.push(pushChunk(arr));
  }

  log('Packing clusters...');
  const clusterHeaders = [];
  for(const arr of clusters){
    clusterHeaders.push(pushChunk(arr));
  }

  // Assemble body buffer
  const body = new ArrayBuffer(byteCursor);
  const bodyU8 = new Uint8Array(body);
  for(const {arr, off} of chunks){
    bodyU8.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), off);
  }

  const header = {
    v: 2,
    cells: cellHeaders,
    ghosts: ghostHeaders,
    tracks: trackHeaders,
    clusters: clusterHeaders,
  };
  let headerJson = JSON.stringify(header);
  // Pad header so (4 + headerLen) is 4-aligned for typed-array views into body
  while(((4 + headerJson.length) & 3) !== 0) headerJson += ' ';
  const headerBytes = new TextEncoder().encode(headerJson);

  // Final file: [u32 LE: headerLen][header][body]
  const out = new ArrayBuffer(4 + headerBytes.byteLength + body.byteLength);
  new DataView(out).setUint32(0, headerBytes.byteLength, true);
  new Uint8Array(out, 4, headerBytes.byteLength).set(headerBytes);
  new Uint8Array(out, 4 + headerBytes.byteLength).set(bodyU8);

  log('Total size:', (out.byteLength/1024/1024).toFixed(2), 'MB');
  log('  header JSON:', (headerBytes.byteLength/1024).toFixed(1), 'KB');
  log('  body       :', (body.byteLength/1024/1024).toFixed(2), 'MB');

  // Download
  const blob = new Blob([out], {type:'application/octet-stream'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'scene_data.bin';
  a.click();
  URL.revokeObjectURL(url);
  log('Downloaded scene_data.bin');
  btn.disabled = false;
}

btn.addEventListener('click', () => {
  logEl.textContent = '';
  main().catch(e => { log('ERROR:', e.message); console.error(e); btn.disabled=false; });
});
