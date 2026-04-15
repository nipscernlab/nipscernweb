import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Renderer / scene / camera ────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance', precision:'mediump', preserveDrawingBuffer:false, stencil:false, depth:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.sortObjects = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);
scene.matrixAutoUpdate = false;
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 10, 100_000);
camera.position.set(0, 0, 12_000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.14; controls.zoomSpeed = 1.2;

let dirty = true;
controls.addEventListener('change', () => { dirty = true; });
(function loop(){
  requestAnimationFrame(loop);
  controls.update();
  if(controls.autoRotate) dirty = true;
  if(!dirty) return;
  renderer.render(scene, camera);
  dirty = false;
})();
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  dirty = true;
});

// ── Beam indicator ───────────────────────────────────────────────────────────
function buildBeam(){
  const g = new THREE.Group();
  const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-13000), new THREE.Vector3(0,0,13000)]);
  g.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({color:0x4a7fcc, transparent:true, opacity:0.50, depthWrite:false})));
  const north = new THREE.Mesh(new THREE.ConeGeometry(90,520,24,1,false), new THREE.MeshBasicMaterial({color:0xee2222}));
  north.rotation.x = Math.PI/2; north.position.z = 13260; g.add(north);
  const ringN = new THREE.Mesh(new THREE.TorusGeometry(90,8,8,24), new THREE.MeshBasicMaterial({color:0xff6666, transparent:true, opacity:0.55}));
  ringN.rotation.x = Math.PI/2; ringN.position.z = 13000; g.add(ringN);
  const south = new THREE.Mesh(new THREE.ConeGeometry(90,520,24,1,false), new THREE.MeshBasicMaterial({color:0x2244ee}));
  south.rotation.x = -Math.PI/2; south.position.z = -13260; g.add(south);
  const ringS = new THREE.Mesh(new THREE.TorusGeometry(90,8,8,24), new THREE.MeshBasicMaterial({color:0x6699ff, transparent:true, opacity:0.55}));
  ringS.rotation.x = Math.PI/2; ringS.position.z = -13000; g.add(ringS);
  scene.add(g);
}

// ── Phi ghost lines (procedural — no data needed) ────────────────────────────
const TILE_PHI_SEGS = [
  { rIn:2288, rOut:3835, zMin:-2820, zMax:2820 },
  { rIn:2288, rOut:3835, zMin:3600,  zMax:6050 },
  { rIn:2288, rOut:3835, zMin:-6050, zMax:-3600 },
];
const N_PHI = 64;
function buildPhiLines(){
  const group = new THREE.Group();
  group.renderOrder = 6;
  const mat = new THREE.LineBasicMaterial({color:0xFFFFFF, transparent:true, opacity:0.04, depthWrite:false});
  for(let i=0;i<N_PHI;i++){
    const phi=(i/N_PHI)*Math.PI*2; const cx=Math.cos(phi), cy=Math.sin(phi);
    for(const {rIn,rOut,zMin,zMax} of TILE_PHI_SEGS){
      const pts=[
        new THREE.Vector3(cx*rIn,  cy*rIn,  zMin),
        new THREE.Vector3(cx*rIn,  cy*rIn,  zMax),
        new THREE.Vector3(cx*rOut, cy*rOut, zMax),
        new THREE.Vector3(cx*rOut, cy*rOut, zMin),
        new THREE.Vector3(cx*rIn,  cy*rIn,  zMin),
      ];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
  }
  scene.add(group);
}

// ── Materials / runtime state ────────────────────────────────────────────────
const ghostSolidMat = new THREE.MeshBasicMaterial({color:0x5C5F66, transparent:true, opacity:0.04, depthWrite:false, side:THREE.DoubleSide});
const outlineAllMat = new THREE.LineBasicMaterial({color:0x000000});
const outlineHoverMat = new THREE.LineBasicMaterial({color:0xffffff});
const trackMat = new THREE.LineBasicMaterial({color:0xffea00});
const clusterMat = new THREE.LineDashedMaterial({
  color:0xff4400, transparent:true, opacity:0.55,
  dashSize:40, gapSize:60, depthWrite:false,
});

const matCache = new Map();
function matForRgb(r, g, b){
  const key = (Math.round(r*255)<<16) | (Math.round(g*255)<<8) | Math.round(b*255);
  let m = matCache.get(key);
  if(!m){
    m = new THREE.MeshBasicMaterial({color: new THREE.Color(r,g,b), side:THREE.FrontSide});
    matCache.set(key, m);
  }
  return m;
}

const rayTargets = [];
const cellEdgeBufByName = new Map(); // name -> Float32Array (baked edge positions)

// ── Hover white outline ──────────────────────────────────────────────────────
let hoverMesh = null;
function clearHover(){
  if(!hoverMesh) return;
  scene.remove(hoverMesh);
  hoverMesh.geometry.dispose();
  hoverMesh = null;
  dirty = true;
}
function showHover(mesh){
  if(hoverMesh && hoverMesh.userData.src === mesh.name) return;
  clearHover();
  const edgeBuf = cellEdgeBufByName.get(mesh.name);
  if(!edgeBuf) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(edgeBuf, 3));
  hoverMesh = new THREE.LineSegments(geo, outlineHoverMat);
  hoverMesh.matrixAutoUpdate = false;
  hoverMesh.frustumCulled = false;
  hoverMesh.renderOrder = 999;
  hoverMesh.userData.src = mesh.name;
  scene.add(hoverMesh);
  dirty = true;
}

// ── Raycast hover ────────────────────────────────────────────────────────────
const raycast = new THREE.Raycaster();
raycast.firstHitOnly = true;
const mxy = new THREE.Vector2();
let lastRay = 0;
function doRaycast(x, y){
  if(!rayTargets.length){ clearHover(); return; }
  const top = document.elementFromPoint(x, y);
  if(top && top !== canvas){ clearHover(); return; }
  const rect = canvas.getBoundingClientRect();
  if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom){ clearHover(); return; }
  mxy.set(((x-rect.left)/rect.width)*2-1, -((y-rect.top)/rect.height)*2+1);
  camera.updateMatrixWorld();
  raycast.setFromCamera(mxy, camera);
  const hits = raycast.intersectObjects(rayTargets, false);
  if(hits.length) showHover(hits[0].object); else clearHover();
}
document.addEventListener('mousemove', e => {
  const now = Date.now(); if(now - lastRay < 50) return; lastRay = now;
  doRaycast(e.clientX, e.clientY);
});
canvas.addEventListener('mouseleave', clearHover);

// ── Load scene_data.bin ──────────────────────────────────────────────────────
async function loadSceneData(){
  const buf = await (await fetch('./scene_data.bin')).arrayBuffer();
  const headerLen = new DataView(buf).getUint32(0, true);
  const headerJson = new TextDecoder().decode(new Uint8Array(buf, 4, headerLen));
  const header = JSON.parse(headerJson);
  const bodyOffset = 4 + headerLen;
  const f32 = (off, byteLen) => new Float32Array(buf, bodyOffset + off, byteLen/4);
  const u32 = (off, byteLen) => new Uint32Array(buf, bodyOffset + off, byteLen/4);
  return { header, f32, u32 };
}

async function main(){
  buildBeam();
  buildPhiLines();

  const { header, f32, u32 } = await loadSceneData();

  // Cells
  let totalEdgeFloats = 0;
  for(const c of header.cells) totalEdgeFloats += c.edge[1]/4;
  const allEdges = new Float32Array(totalEdgeFloats);
  let edgeCursor = 0;

  for(let i=0;i<header.cells.length;i++){
    const c = header.cells[i];
    const pos  = f32(c.pos[0],  c.pos[1]);
    const idx  = u32(c.idx[0],  c.idx[1]);
    const edge = f32(c.edge[0], c.edge[1]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));

    const mesh = new THREE.Mesh(geo, matForRgb(c.rgb[0], c.rgb[1], c.rgb[2]));
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.name = 'cell_' + i;
    scene.add(mesh);
    rayTargets.push(mesh);
    cellEdgeBufByName.set(mesh.name, edge);

    allEdges.set(edge, edgeCursor);
    edgeCursor += edge.length;
  }

  // Single big LineSegments for black outline
  if(totalEdgeFloats){
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(allEdges, 3));
    const m = new THREE.LineSegments(geo, outlineAllMat);
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
    m.renderOrder = 3;
    scene.add(m);
  }

  // Ghosts
  for(const g of header.ghosts){
    const pos = f32(g.pos[0], g.pos[1]);
    const idx = u32(g.idx[0], g.idx[1]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.Mesh(geo, ghostSolidMat);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    scene.add(mesh);
  }

  // Tracks
  if(header.tracks && header.tracks.length){
    const group = new THREE.Group();
    group.renderOrder = 5;
    for(const [off, byteLen] of header.tracks){
      const pts = f32(off, byteLen);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      group.add(new THREE.Line(geo, trackMat));
    }
    scene.add(group);
  }

  // Clusters
  if(header.clusters && header.clusters.length){
    const group = new THREE.Group();
    group.renderOrder = 6;
    for(const [off, byteLen] of header.clusters){
      const pts = f32(off, byteLen);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const line = new THREE.Line(geo, clusterMat);
      line.computeLineDistances();
      group.add(line);
    }
    scene.add(group);
  }

  dirty = true;
}

main().catch(e => console.error('scene.js load error:', e));
