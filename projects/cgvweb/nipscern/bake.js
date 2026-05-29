import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import wasmInit, { parse_atlas_ids_bulk } from '../parser/pkg/atlas_id_parser.js';

const logEl = document.getElementById('log');
const btn = document.getElementById('go');
const log = (...a) => { console.log(...a); logEl.textContent += a.join(' ') + '\n'; };

const SUBSYS_TILE = 1, SUBSYS_LAR_EM = 2, SUBSYS_LAR_HEC = 3;
const DEF_THR = 200;
const thrTileMev = DEF_THR, thrLArMev = DEF_THR, thrHecMev = 1000, thrFcalMev = DEF_THR;

// ── Palettes (mirrored from js/palette.js) ───────────────────────────────────
const PAL_N = 256;
function palColorTile(t){t=Math.max(0,Math.min(1,t));return new THREE.Color(1+t*(0.3-1),1+t*(0-1),0);}
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

// FCAL copper palette
const FCAL_SCALE = 7000;
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

// ── Ghost names ──────────────────────────────────────────────────────────────
const GHOST_TILE_NAMES = [
  'C→LBTile_0', 'C→EBTilep_0', 'C→EBTilen_0',
];
const HEC_NAMES = ['1','23','45','67'];

// ── Integer key encoding (mirrors js/state.js) ────────────────────────────────
const _tileKey = (layer, pn, ieta, mod) =>
  (layer << 2) | (pn << 7) | (ieta << 8) | (mod << 12);
const _larEmKey = (eb, sampling, region, pn, eta, phi) =>
  1 | ((eb - 1) << 2) | (sampling << 4) | (region << 6) | (pn << 9) | (eta << 10) | (phi << 19);
const _hecKey = (group, region, pn, eta, phi) =>
  2 | (group << 2) | (region << 4) | (pn << 5) | (eta << 6) | (phi << 11);

// ── Mesh name → integer key (mirrors js/loader.js meshNameToKey) ──────────────
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
  if ((m = /^Tile(\d+)([pn])_0$/.exec(l1))) {
    const layer = +m[1], pn = m[2] === 'p' ? 1 : 0;
    const m2 = /^Tile\d+[pn](\d+)_\d+$/.exec(l2);
    if (!m2) return null;
    const m3 = /^cell_(\d+)$/.exec(l3);
    if (!m3) return null;
    return _tileKey(layer, pn, +m2[1], +m3[1]);
  }
  if ((m = /^T(\d+)([pn])(\d+)_\d+$/.exec(l1))) {
    const layer = +m[1], pn = m[2] === 'p' ? 1 : 0, ieta = +m[3];
    const m2 = /^c_(\d+)$/.exec(l2);
    if (!m2) return null;
    return _tileKey(layer, pn, ieta, +m2[1]);
  }
  if ((m = /^EM(Barrel|EndCap)_(\d+)_(\d+)_([pn])_\d+$/.exec(l1))) {
    const eb = m[1] === 'Barrel' ? 1 : +m[3], sampling = +m[2], region = +m[3], pn = m[4] === 'p' ? 1 : 0;
    const m2 = /^EM(?:Barrel|EndCap)_\d+_\d+_[pn]_(\d+)_\d+$/.exec(l2);
    if (!m2) return null;
    const m3 = /^cell(2?)_(\d+)$/.exec(l3);
    if (!m3) return null;
    return _larEmKey(eb, sampling, region, pn, +m2[1], +m3[2]);
  }
  if ((m = /^EB_(\d+)_(\d+)_([pn])_(\d+)_\d+$/.exec(l1))) {
    const sampling = +m[1], region = +m[2], pn = m[3] === 'p' ? 1 : 0, eta = +m[4];
    const m2 = /^c(2?)_(\d+)$/.exec(l2);
    if (!m2) return null;
    return _larEmKey(1, sampling, region, pn, eta, +m2[2]);
  }
  if ((m = /^EE_(\d+)_(\d+)_([pn])_(\d+)_\d+$/.exec(l1))) {
    const sampling = +m[1], eb = +m[2], pn = m[3] === 'p' ? 1 : 0, eta = +m[4];
    const m2 = /^c(2?)_(\d+)$/.exec(l2);
    if (!m2) return null;
    return _larEmKey(eb, sampling, eb, pn, eta, +m2[2]);
  }
  if ((m = /^HEC_(\w+)_(\d+)_([pn])_0$/.exec(l1))) {
    const group = HEC_NAMES.indexOf(m[1]);
    if (group < 0) return null;
    const m2 = /^HEC_\w+_\d+_[pn]_(\d+)_\d+$/.exec(l2);
    if (!m2) return null;
    const m3 = /^cell_(\d+)$/.exec(l3);
    if (!m3) return null;
    return _hecKey(group, +m[2], m[3] === 'p' ? 1 : 0, +m2[1], +m3[1]);
  }
  if ((m = /^H_(\w+)_(\d+)_([pn])_(\d+)_\d+$/.exec(l1))) {
    const group = HEC_NAMES.indexOf(m[1]);
    if (group < 0) return null;
    const m2 = /^c_(\d+)$/.exec(l2);
    if (!m2) return null;
    return _hecKey(group, +m[2], m[3] === 'p' ? 1 : 0, +m[4], +m2[1]);
  }
  return null;
}

// ── XML extraction ────────────────────────────────────────────────────────────
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

// ── Particle parsers ──────────────────────────────────────────────────────────
function _readTextNums(el, tag){
  const child = el.querySelector(tag);
  if(!child) return [];
  return child.textContent.trim().split(/\s+/).map(Number).filter(isFinite);
}

function parseElectrons(doc){
  const out = [];
  for(const el of doc.getElementsByTagName('Electron')){
    const etas = _readTextNums(el, 'eta');
    const phis = _readTextNums(el, 'phi');
    const pts  = _readTextNums(el, 'pt');
    const pdgs = _readTextNums(el, 'pdgId');
    const n = Math.min(etas.length, phis.length);
    for(let i=0;i<n;i++){
      if(!isFinite(etas[i])||!isFinite(phis[i])) continue;
      const raw = pdgs[i];
      const pdgId = Number.isFinite(raw) && raw !== 0 ? raw|0 : null;
      out.push({eta:etas[i], phi:phis[i], ptGev:isFinite(pts[i])?pts[i]:0, pdgId});
    }
  }
  return out;
}

function parseMuons(doc){
  const out = [];
  for(const el of doc.getElementsByTagName('Muon')){
    const etas = _readTextNums(el, 'eta');
    const phis = _readTextNums(el, 'phi');
    const pts  = _readTextNums(el, 'pt');
    const pdgs = _readTextNums(el, 'pdgId');
    const n = Math.min(etas.length, phis.length);
    for(let i=0;i<n;i++){
      if(!isFinite(etas[i])||!isFinite(phis[i])) continue;
      const raw = pdgs[i];
      const pdgId = Number.isFinite(raw) && raw !== 0 ? raw|0 : null;
      out.push({eta:etas[i], phi:phis[i], ptGev:isFinite(pts[i])?pts[i]:0, pdgId});
    }
  }
  return out;
}

// ── Clusters ──────────────────────────────────────────────────────────────────
const CLUSTER_THR_GEV = 3;
const CLUSTER_CYL_OUT_R = 3820, CLUSTER_CYL_OUT_HALF_H = 6000;
// Muon spectrometer outer boundary (barrel r=10 m, endcap z=±22 m)
const MUON_R = 10000, MUON_Z = 22000;

// Inner calo face — composite from CaloGeometry.glb with ATLAS-standard |η|
// transitions (1.5 / 1.8). Dispatch is by |η| computed from the ray; see
// _internal.js for the full rationale. Constants kept in sync so live and
// baked geometry agree.
const CALO_BPS_R       = 1423.445;
const CALO_ECPS_Z      = 3680.75;
const CALO_ECSTRIP_Z   = 3754.240;
const ETA_BPS_TO_ECPS    = 1.5;
const ETA_ECPS_TO_STRIP  = 1.8;

function _cylIntersect(dx, dy, dz, r, halfH){
  const rT = Math.sqrt(dx*dx + dy*dy);
  if(rT > 1e-9){
    const tB = r / rT;
    if(Math.abs(dz * tB) <= halfH) return tB;
  }
  return halfH / Math.abs(dz);
}

// First-entry into Barrel PS / EC PS / EC Strip — see _internal.js.
function _innerCaloFaceIntersect(dx, dy, dz){
  const rT = Math.sqrt(dx*dx + dy*dy);
  const dzAbs = Math.abs(dz);
  if(rT < 1e-9) return CALO_ECSTRIP_Z / dzAbs;
  const absEta = Math.asinh(dzAbs / rT);
  if(absEta <= ETA_BPS_TO_ECPS)   return CALO_BPS_R / rT;
  if(absEta <= ETA_ECPS_TO_STRIP) return CALO_ECPS_Z / dzAbs;
  return CALO_ECSTRIP_Z / dzAbs;
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
      const t0 = _innerCaloFaceIntersect(dx, dy, dz);
      const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
      const arr = new Float32Array(6);
      arr[0] = dx*t0; arr[1] = dy*t0; arr[2] = dz*t0;
      arr[3] = dx*t1; arr[4] = dy*t1; arr[5] = dz*t1;
      out.push(arr);
    }
  }
  return out;
}

// ── Tracks ────────────────────────────────────────────────────────────────────
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

// ── Photons (wavy helix) ──────────────────────────────────────────────────────
const PHOTON_PRE_INNER_MM = 400;
const PHOTON_SPRING_R = 20;
const PHOTON_SPRING_TURNS_PER_MM = 0.014;
const PHOTON_SPRING_PTS = 22;

function _makeSpringPoints(dx, dy, dz, totalLen){
  const fwd = new THREE.Vector3(dx, dy, dz).normalize();
  const ref = Math.abs(fwd.x) < 0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
  const right = new THREE.Vector3().crossVectors(fwd, ref).normalize();
  const up    = new THREE.Vector3().crossVectors(fwd, right).normalize();
  const startOffset = Math.max(0, totalLen - PHOTON_PRE_INNER_MM);
  const visibleLen  = Math.max(0, totalLen - startOffset);
  const nTurns  = Math.round(PHOTON_SPRING_TURNS_PER_MM * Math.min(PHOTON_PRE_INNER_MM, totalLen));
  const nTotal  = nTurns * PHOTON_SPRING_PTS + 1;
  if(nTotal < 2) return null;
  // Taper radius smoothly to 0 over the last 15% of t so the spring closes
  // onto the centerline endpoint — for endcap photons the centerline ends at
  // z = ±halfH, so the visible tip lands exactly on the calo face. Without
  // the taper the radial helix offset has a z-component that pulls the tip
  // a few mm short of the cap.
  const TAPER_START = 0.85;
  const arr = new Float32Array(nTotal * 3);
  for(let i=0;i<nTotal;i++){
    const t = i/(nTotal-1);
    const angle = t * nTurns * 2 * Math.PI;
    const along = startOffset + t * visibleLen;
    const taper = t < TAPER_START ? 1 : 1 - (t - TAPER_START) / (1 - TAPER_START);
    const cx = Math.cos(angle) * PHOTON_SPRING_R * taper;
    const cy = Math.sin(angle) * PHOTON_SPRING_R * taper;
    arr[i*3  ] = fwd.x*along + right.x*cx + up.x*cy;
    arr[i*3+1] = fwd.y*along + right.y*cx + up.y*cy;
    arr[i*3+2] = fwd.z*along + right.z*cx + up.z*cy;
  }
  return arr;
}

function parsePhotons(doc){
  const out = [];
  for(const el of doc.querySelectorAll('PhotonCollection, Photon')){
    const ptEl  = el.querySelector('pt, et');
    const etaEl = el.querySelector('eta');
    const phiEl = el.querySelector('phi');
    if(!etaEl || !phiEl) continue;
    const etas = etaEl.textContent.trim().split(/\s+/).map(Number);
    const phis = phiEl.textContent.trim().split(/\s+/).map(Number);
    const pts  = ptEl ? ptEl.textContent.trim().split(/\s+/).map(Number) : [];
    const m = Math.min(etas.length, phis.length);
    for(let i=0;i<m;i++){
      if(!isFinite(etas[i]) || !isFinite(phis[i])) continue;
      out.push({eta:etas[i], phi:phis[i], ptGev:isFinite(pts[i])?pts[i]:0});
    }
  }
  return out;
}

// ── Electron helix (same waveguide as photon, shorter spring) ─────────────────
const ELECTRON_SPRING_R = 14;
const ELECTRON_SPRING_TURNS_PER_MM = 0.025;
const ELECTRON_SPRING_PTS = 22;
const ELECTRON_PRE_INNER_MM = 300;

function _makeElectronSpring(dx, dy, dz, totalLen){
  const fwd = new THREE.Vector3(dx, dy, dz).normalize();
  const ref = Math.abs(fwd.x) < 0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
  const right = new THREE.Vector3().crossVectors(fwd, ref).normalize();
  const up    = new THREE.Vector3().crossVectors(fwd, right).normalize();
  const startOffset = Math.max(0, totalLen - ELECTRON_PRE_INNER_MM);
  const visibleLen  = Math.max(0, totalLen - startOffset);
  const nTurns  = Math.round(ELECTRON_SPRING_TURNS_PER_MM * Math.min(ELECTRON_PRE_INNER_MM, totalLen));
  const nTotal  = nTurns * ELECTRON_SPRING_PTS + 1;
  if(nTotal < 2) return null;
  const arr = new Float32Array(nTotal * 3);
  for(let i=0;i<nTotal;i++){
    const t = i/(nTotal-1);
    const angle = t * nTurns * 2 * Math.PI;
    const along = startOffset + t * visibleLen;
    const cx = Math.cos(angle) * ELECTRON_SPRING_R;
    const cy = Math.sin(angle) * ELECTRON_SPRING_R;
    arr[i*3  ] = fwd.x*along + right.x*cx + up.x*cy;
    arr[i*3+1] = fwd.y*along + right.y*cx + up.y*cy;
    arr[i*3+2] = fwd.z*along + right.z*cx + up.z*cy;
  }
  return arr;
}

// ── Muon straight line (origin → muon spectrometer outer wall) ────────────────
function _makeMuonLine(eta, phi){
  const theta = 2 * Math.atan(Math.exp(-eta));
  const sinT = Math.sin(theta);
  const dx = -sinT * Math.cos(phi);
  const dy = -sinT * Math.sin(phi);
  const dz =  Math.cos(theta);
  const t = _cylIntersect(dx, dy, dz, MUON_R, MUON_Z);
  const arr = new Float32Array(6);
  arr[0]=0; arr[1]=0; arr[2]=0;
  arr[3]=dx*t; arr[4]=dy*t; arr[5]=dz*t;
  return arr;
}

// ── η/φ line spanning the calorimeter (used by jets and τ-jets) ───────────────
function _makeEtaPhiLine(eta, phi){
  const theta = 2 * Math.atan(Math.exp(-eta));
  const sinT = Math.sin(theta);
  const dx = -sinT * Math.cos(phi);
  const dy = -sinT * Math.sin(phi);
  const dz =  Math.cos(theta);
  const t0 = _innerCaloFaceIntersect(dx, dy, dz);
  const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
  const arr = new Float32Array(6);
  arr[0] = dx*t0; arr[1] = dy*t0; arr[2] = dz*t0;
  arr[3] = dx*t1; arr[4] = dy*t1; arr[5] = dz*t1;
  return arr;
}

// ── MET parser (Missing Transverse Energy) ────────────────────────────────────
// Picks AntiKt4EMPFlow preferred, falls back to first available collection.
const MET_PREFERRED_KEY = 'MET_Reference_AntiKt4EMPFlow_xAOD';
function parseMet(doc){
  const collections = [];
  for(const el of doc.getElementsByTagName('ETMis')){
    const sgk = el.getAttribute('storeGateKey') || '';
    const etxEl = el.querySelector('etx'), etyEl = el.querySelector('ety'), etEl = el.querySelector('et');
    if(!etxEl || !etyEl) continue;
    const etx = parseFloat(etxEl.textContent.trim().split(/\s+/)[0]);
    const ety = parseFloat(etyEl.textContent.trim().split(/\s+/)[0]);
    if(!isFinite(etx) || !isFinite(ety)) continue;
    const sumEt = etEl ? parseFloat(etEl.textContent.trim().split(/\s+/)[0]) : 0;
    collections.push({
      key: sgk, etx, ety,
      sumEt: isFinite(sumEt) ? sumEt : 0,
      magnitude: Math.hypot(etx, ety),
    });
  }
  if(!collections.length) return null;
  return collections.find(c => c.key === MET_PREFERRED_KEY) || collections[0];
}

// ── Vertex parser (primary / pile-up / b-tag secondary) ───────────────────────
// XML is in cm; convert to scene mm with x and y negated to match tracks.
function parseVertices(doc){
  const out = { primary: [], pileup: [], secondary: [] };
  for(const el of doc.getElementsByTagName('RVx')){
    const sgk = el.getAttribute('storeGateKey') || '';
    const xEl = el.querySelector('x'), yEl = el.querySelector('y'), zEl = el.querySelector('z');
    const tEl = el.querySelector('vertexType');
    if(!xEl || !yEl || !zEl) continue;
    const xs = xEl.textContent.trim().split(/\s+/).map(Number);
    const ys = yEl.textContent.trim().split(/\s+/).map(Number);
    const zs = zEl.textContent.trim().split(/\s+/).map(Number);
    const ts = tEl ? tEl.textContent.trim().split(/\s+/).map(Number) : [];
    const isBTag = sgk.includes('SecVtx');
    const n = Math.min(xs.length, ys.length, zs.length);
    for(let i=0;i<n;i++){
      if(!isFinite(xs[i]) || !isFinite(ys[i]) || !isFinite(zs[i])) continue;
      const p = [-xs[i]*10, -ys[i]*10, zs[i]*10];
      const t = ts[i] ?? 0;
      if(isBTag) out.secondary.push(p);
      else if(t === 1) out.primary.push(p);
      else if(t === 3) out.pileup.push(p);
      // type=0 in PrimaryVertices is the dummy placeholder, skipped.
    }
  }
  return out;
}

// ── Jet parser (η/φ lines, AntiKt4EMTopoJets preferred) ──────────────────────
const JET_PREFERRED_KEY = 'AntiKt4EMTopoJets_xAOD';
const JET_THR_GEV = 5;
function parseJets(doc){
  const collections = [];
  for(const el of doc.getElementsByTagName('Jet')){
    const sgk = el.getAttribute('storeGateKey') || '';
    const etas = _readTextNums(el, 'eta');
    const phis = _readTextNums(el, 'phi');
    const ets  = _readTextNums(el, 'et');
    const pxs  = _readTextNums(el, 'px');
    const pys  = _readTextNums(el, 'py');
    const n = Math.min(etas.length, phis.length);
    const jets = [];
    for(let i=0;i<n;i++){
      const px = pxs[i], py = pys[i];
      const pt = isFinite(px) && isFinite(py)
        ? Math.sqrt(px*px + py*py)
        : (isFinite(ets[i]) ? ets[i] : 0);
      jets.push({ eta: etas[i], phi: phis[i], ptGev: pt });
    }
    collections.push({ key: sgk, jets });
  }
  if(!collections.length) return [];
  const preferred = collections.find(c => c.key === JET_PREFERRED_KEY && c.jets.length);
  const chosen = preferred || collections.find(c => c.jets.length) || null;
  return chosen ? chosen.jets : [];
}

// ── Tau parser (η/φ lines + charge for label) ────────────────────────────────
const TAU_THR_GEV = 10;
function parseTaus(doc){
  const out = [];
  for(const el of doc.getElementsByTagName('TauJet')){
    const etas = _readTextNums(el, 'eta');
    const phis = _readTextNums(el, 'phi');
    const pts  = _readTextNums(el, 'pt');
    const chs  = _readTextNums(el, 'charge');
    const n = Math.min(etas.length, phis.length);
    for(let i=0;i<n;i++){
      if(!isFinite(etas[i]) || !isFinite(phis[i])) continue;
      const charge = isFinite(chs[i]) ? chs[i] : 0;
      const ptGev  = isFinite(pts[i]) ? pts[i] : 0;
      out.push({ eta: etas[i], phi: phis[i], ptGev, charge });
    }
  }
  return out;
}

// ── MBTS key lookup ───────────────────────────────────────────────────────────
function mbtsMeshKey(label){
  const m=/^type_(-?1)_ch_([01])_mod_([0-7])$/.exec(label);
  if(!m) return null;
  return _tileKey(m[2]==='0'?14:15, m[1]==='1'?1:0, 0, +m[3]);
}

// ── Geometry baking ────────────────────────────────────────────────────────────
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
  const posF32  = pos  instanceof Float32Array ? pos  : new Float32Array(pos);
  const edgeF32 = edge instanceof Float32Array ? edge : new Float32Array(edge);
  g.dispose(); edgeGeo.dispose();
  return { pos: posF32, idx, edge: edgeF32 };
}

const _fcalUpVec   = new THREE.Vector3(0, 1, 0);
const _fcalTwistAx = new THREE.Vector3(0, 1, 0);
function bakeFcalCell({x, y, z, dx, dy, dz}){
  const rx  = Math.max(Math.abs(dx) * 5, 1e-3);
  const ry  = Math.max(Math.abs(dy) * 5, 1e-3);
  const len = Math.max(Math.abs(dz) * 2 * 10, 1e-3);
  const cx  = -x * 10,  cy = -y * 10,  cz = z * 10;
  const dir = new THREE.Vector3(0, 0, dz >= 0 ? 1 : -1);
  const q   = new THREE.Quaternion().setFromUnitVectors(_fcalUpVec, dir);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(_fcalTwistAx, _FCAL_TWIST_RAD));
  const mat = new THREE.Matrix4().compose(
    new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(rx, len, ry));
  const geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  geo.applyMatrix4(mat);
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

// Atlas-prefixed meshes (muon spectrometer + structural envelopes) live in the
// same GLB but the live app wraps them in a Group scaled by 10. We pre-apply
// that same scale to the world matrix here so the baked vertices land in scene
// coordinates (mm), consistent with every other baked geometry.
const _ATLAS_SCALE_MAT = new THREE.Matrix4().makeScale(10, 10, 10);
function bakeAtlasMesh(mesh){
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry.clone();
  const worldWithScale = mesh.matrixWorld.clone().premultiply(_ATLAS_SCALE_MAT);
  g.applyMatrix4(worldWithScale);
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

// ── Main bake routine ──────────────────────────────────────────────────────────
async function main(){
  btn.disabled = true;
  log('Initializing WASM...');
  await wasmInit();

  log('Loading GLB...');
  const meshByKey  = new Map();
  const meshByName = new Map();
  // Atlas-prefixed meshes are the muon spectrometer + structural envelopes
  // (MUCH_1 on the C side, MUC1_2 on the A side, plus the toroid, ID volumes,
  // solenoid, etc.). The live app hides them by default behind a toggle; here
  // we bake every one so the preview shows the full apparatus around the
  // event without any interactive UI.
  const atlasMeshes = [];
  await new Promise((res, rej)=>{
    new GLTFLoader().load('../geometry_data/CaloGeometry.glb', ({scene:g}) => {
      g.updateMatrixWorld(true);
      g.traverse(o => {
        if(!o.isMesh) return;
        if(o.name.split('→')[0] === 'atlas'){
          atlasMeshes.push(o);
          return;
        }
        meshByName.set(o.name, o);
        const key = meshNameToKey(o.name);
        if(key !== null) meshByKey.set(key, o);
      });
      res();
    }, undefined, rej);
  });
  log('  meshes:', meshByName.size, '  keyed:', meshByKey.size, '  atlas:', atlasMeshes.length);

  log('Fetching XML...');
  const xmlText = await (await fetch('../default_xml/JiveXML_518084_14173642443.xml')).text();
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

  const tracks   = parseTracks(doc);
  const clusters = parseClusters(doc);
  const photonParticles   = parsePhotons(doc);
  const electronParticles = parseElectrons(doc);
  const muonParticles     = parseMuons(doc);
  const jetParticles      = parseJets(doc).filter(j => j.ptGev >= JET_THR_GEV);
  const tauParticles      = parseTaus(doc).filter(t => t.ptGev >= TAU_THR_GEV);
  const metInfo           = parseMet(doc);
  const verticesInfo      = parseVertices(doc);
  log('  tracks:', tracks.length, '  clusters:', clusters.length,
      '  photons:', photonParticles.length,
      '  electrons:', electronParticles.length,
      '  muons:', muonParticles.length,
      '  jets:', jetParticles.length,
      '  taus:', tauParticles.length);
  log('  vertices:  primary', verticesInfo.primary.length,
      '  pileup', verticesInfo.pileup.length,
      '  secondary', verticesInfo.secondary.length);
  log('  MET:', metInfo ? `${metInfo.key} mag=${metInfo.magnitude.toFixed(1)} GeV` : '(none)');

  const idsToStr = cs => cs.map(c=>c.id).join(' ');
  const tilePacked = tileCells.length ? parse_atlas_ids_bulk(idsToStr(tileCells)) : null;
  const larPacked  = larCells.length  ? parse_atlas_ids_bulk(idsToStr(larCells))  : null;
  const hecPacked  = hecCells.length  ? parse_atlas_ids_bulk(idsToStr(hecCells))  : null;

  const active = new Map();

  for(let i=0;i<tileCells.length;i++){
    const b=i*8; if(tilePacked[b]!==SUBSYS_TILE) continue;
    const x=tilePacked[b+1], k=tilePacked[b+2], side=tilePacked[b+3], mod=tilePacked[b+4];
    const eMev=tileCells[i].energy*1000;
    if(eMev < thrTileMev) continue;
    const mesh = meshByKey.get(_tileKey(x, side<0?0:1, k, mod));
    if(!mesh) continue;
    active.set(mesh.name, {det:'TILE', eMev, mesh});
  }
  for(let i=0;i<larCells.length;i++){
    const b=i*8; if(larPacked[b]!==SUBSYS_LAR_EM) continue;
    const abs_be=larPacked[b+1], sampling=larPacked[b+2], z_pos=larPacked[b+4],
          R=larPacked[b+5], eta=larPacked[b+6], phi=larPacked[b+7];
    const eMev=larCells[i].energy*1000;
    if(eMev < thrLArMev) continue;
    const mesh = meshByKey.get(_larEmKey(abs_be, sampling, R, z_pos, eta, phi));
    if(!mesh) continue;
    active.set(mesh.name, {det:'LAR', eMev, mesh});
  }
  for(let i=0;i<hecCells.length;i++){
    const b=i*8; if(hecPacked[b]!==SUBSYS_LAR_HEC) continue;
    const group=hecPacked[b+1], region=hecPacked[b+2], z_pos=hecPacked[b+3],
          cum_eta=hecPacked[b+4], phi=hecPacked[b+5];
    const eMev=hecCells[i].energy*1000;
    if(eMev < thrHecMev) continue;
    const mesh = meshByKey.get(_hecKey(group, region, z_pos, cum_eta, phi));
    if(!mesh) continue;
    active.set(mesh.name, {det:'HEC', eMev, mesh});
  }
  for(const {label, energy} of mbtsCells){
    const eMev = energy*1000;
    if(eMev < thrTileMev) continue;
    const key = mbtsMeshKey(label);
    if(key === null) continue;
    const mesh = meshByKey.get(key);
    if(!mesh) continue;
    active.set(mesh.name, {det:'TILE', eMev, mesh});
  }
  log('  active cells (after threshold):', active.size);

  const fcalActive = fcalCells.filter(c => c.energy >= 0 && c.energy * 1000 >= thrFcalMev);
  log('  active FCAL cells (after threshold):', fcalActive.length);

  log('Baking cell geometries...');
  const cellHeaders = [];
  const chunks = [];
  let byteCursor = 0;
  function pushChunk(arr){
    const align = 4;
    if(byteCursor % align) byteCursor += align - (byteCursor % align);
    const off = byteCursor;
    chunks.push({arr, off});
    byteCursor += arr.byteLength;
    return [off, arr.byteLength];
  }

  for(const [, {det, eMev, mesh}] of active){
    const {pos, idx, edge} = bakeGeom(mesh);
    const col = det==='TILE' ? colTile(eMev) : det==='LAR' ? colLAr(eMev) : colHec(eMev);
    cellHeaders.push({
      det, rgb:[+col.r.toFixed(4), +col.g.toFixed(4), +col.b.toFixed(4)],
      pos: pushChunk(pos),
      idx: pushChunk(idx),
      edge: pushChunk(edge),
    });
  }

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
    ghostHeaders.push({ pos: pushChunk(pos), idx: pushChunk(idx) });
  }

  log('Baking atlas / muon spectrometer meshes...');
  const atlasHeaders = [];
  let atlasBytes = 0;
  for(const mesh of atlasMeshes){
    const {pos, idx} = bakeAtlasMesh(mesh);
    const posEntry = pushChunk(pos);
    const idxEntry = pushChunk(idx);
    atlasHeaders.push({ pos: posEntry, idx: idxEntry });
    atlasBytes += posEntry[1] + idxEntry[1];
  }
  log('  atlas meshes baked:', atlasHeaders.length,
      '  body bytes:', (atlasBytes/1024/1024).toFixed(2), 'MB');

  log('Packing tracks...');
  const trackHeaders = [];
  for(const arr of tracks) trackHeaders.push(pushChunk(arr));

  log('Packing clusters...');
  const clusterHeaders = [];
  for(const arr of clusters) clusterHeaders.push(pushChunk(arr));

  log('Packing jets...');
  const jetHeaders = [];
  for(const {eta, phi} of jetParticles){
    jetHeaders.push(pushChunk(_makeEtaPhiLine(eta, phi)));
  }

  log('Packing taus...');
  const tauHeaders = [];
  for(const {eta, phi} of tauParticles){
    tauHeaders.push(pushChunk(_makeEtaPhiLine(eta, phi)));
  }

  log('Packing vertices...');
  function _packVtxArr(list){
    if(!list.length) return null;
    const arr = new Float32Array(list.length * 3);
    for(let i=0;i<list.length;i++){
      arr[i*3  ] = list[i][0];
      arr[i*3+1] = list[i][1];
      arr[i*3+2] = list[i][2];
    }
    return pushChunk(arr);
  }
  const vertexHeaders = {
    primary:   _packVtxArr(verticesInfo.primary),
    pileup:    _packVtxArr(verticesInfo.pileup),
    secondary: _packVtxArr(verticesInfo.secondary),
  };

  log('Packing photons...');
  const photonHeaders = [];
  for(const {eta, phi} of photonParticles){
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz =  Math.cos(theta);
    const tEnd = _innerCaloFaceIntersect(dx, dy, dz);
    const arr = _makeSpringPoints(dx, dy, dz, tEnd);
    if(arr) photonHeaders.push(pushChunk(arr));
  }

  log('Packing electrons...');
  const electronHeaders = [];
  for(const {eta, phi} of electronParticles){
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz =  Math.cos(theta);
    const tEnd = _innerCaloFaceIntersect(dx, dy, dz);
    const arr = _makeElectronSpring(dx, dy, dz, tEnd);
    if(arr) electronHeaders.push(pushChunk(arr));
    else    electronHeaders.push(null);
  }

  log('Packing muons...');
  const muonHeaders = [];
  for(const {eta, phi} of muonParticles){
    muonHeaders.push(pushChunk(_makeMuonLine(eta, phi)));
  }

  const body = new ArrayBuffer(byteCursor);
  const bodyU8 = new Uint8Array(body);
  for(const {arr, off} of chunks){
    bodyU8.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), off);
  }

  const header = {
    v: 5,
    cells:    cellHeaders,
    ghosts:   ghostHeaders,
    atlas:    atlasHeaders,
    tracks:   trackHeaders,
    clusters: clusterHeaders,
    jets:     jetHeaders,
    taus:     tauHeaders,
    photons:  photonHeaders,
    electrons:electronHeaders,
    muons:    muonHeaders,
    vertices: vertexHeaders,
    met: metInfo ? {
      etx: +metInfo.etx.toFixed(3),
      ety: +metInfo.ety.toFixed(3),
      sumEt: +metInfo.sumEt.toFixed(3),
      magnitude: +metInfo.magnitude.toFixed(3),
    } : null,
    // Particle lists for label sprites (eta/phi/pdgId/charge stored in JSON header)
    photonList:   photonParticles.map(({eta,phi,ptGev})=>({eta,phi,ptGev})),
    electronList: electronParticles.map(({eta,phi,pdgId,ptGev})=>({eta,phi,pdgId,ptGev})),
    muonList:     muonParticles.map(({eta,phi,pdgId,ptGev})=>({eta,phi,pdgId,ptGev})),
    tauList:      tauParticles.map(({eta,phi,ptGev,charge})=>({eta,phi,ptGev,charge})),
  };
  let headerJson = JSON.stringify(header);
  while(((4 + headerJson.length) & 3) !== 0) headerJson += ' ';
  const headerBytes = new TextEncoder().encode(headerJson);

  const out = new ArrayBuffer(4 + headerBytes.byteLength + body.byteLength);
  new DataView(out).setUint32(0, headerBytes.byteLength, true);
  new Uint8Array(out, 4, headerBytes.byteLength).set(headerBytes);
  new Uint8Array(out, 4 + headerBytes.byteLength).set(bodyU8);

  log('Total size:', (out.byteLength/1024/1024).toFixed(2), 'MB');
  log('  header JSON:', (headerBytes.byteLength/1024).toFixed(1), 'KB');
  log('  body       :', (body.byteLength/1024/1024).toFixed(2), 'MB');
  log('  cells:', cellHeaders.length, ' ghosts:', ghostHeaders.length,
      ' atlas:', atlasHeaders.length,
      ' tracks:', trackHeaders.length, ' clusters:', clusterHeaders.length,
      ' jets:', jetHeaders.length, ' taus:', tauHeaders.length,
      ' photons:', photonHeaders.length,
      ' electrons:', electronHeaders.filter(Boolean).length,
      ' muons:', muonHeaders.length,
      ' met:', metInfo ? 'yes' : 'no',
      ' vtx:', (verticesInfo.primary.length+verticesInfo.pileup.length+verticesInfo.secondary.length));

  const blob = new Blob([out], {type:'application/octet-stream'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'scene_data.bin';
  a.click();
  URL.revokeObjectURL(url);
  log('Downloaded scene_data.bin — replace the file in public/nipscern/ and re-bake is done.');
  btn.disabled = false;
}

btn.addEventListener('click', () => {
  logEl.textContent = '';
  main().catch(e => { log('ERROR:', e.message); console.error(e); btn.disabled=false; });
});
