import * as THREE from 'three';
import { canvas, camera, controls, markDirty } from './renderer.js';
import { active, rayTargets } from './state.js';
import { fcalGroup, fcalVisibleMap } from './visibility.js';
import { getTrackGroup, getPhotonGroup, getClusterGroup } from './visibility.js';
import { showOutline, showFcalOutline, clearOutline } from './outlines.js';

export const tooltip    = document.getElementById('tip');
export const tipCellEl  = document.getElementById('tip-cell');
export const tipCoordEl = document.getElementById('tip-coords');
export const tipEEl     = document.getElementById('tip-e');
export const tipEKeyEl  = document.querySelector('#tip .tkey');

export function hideTooltip() { tooltip.hidden = true; }

const raycast = new THREE.Raycaster();
raycast.firstHitOnly = true;               // stop after first intersection (much faster)
raycast.params.Line = { threshold: 25 };   // 25 mm hit zone for track lines
const mxy = new THREE.Vector2();

let lastRay  = 0;
let mousePos = { x: 0, y: 0 };

let _getShowInfo   = () => true;
let _getCinemaMode = () => false;
let _t             = (k) => k;

export function initHoverTooltip({ getShowInfo, getCinemaMode, t }) {
  if (getShowInfo)   _getShowInfo   = getShowInfo;
  if (getCinemaMode) _getCinemaMode = getCinemaMode;
  if (t)             _t             = t;

  document.addEventListener('mousemove', e => {
    mousePos.x = e.clientX; mousePos.y = e.clientY;
    const now = Date.now();
    if (now - lastRay < 50) return;
    lastRay = now;
    doRaycast(e.clientX, e.clientY);
  });
  canvas.addEventListener('mouseleave', () => { clearOutline(); hideTooltip(); });
  controls.addEventListener('end', () => {
    lastRay = 0;
    setTimeout(() => doRaycast(mousePos.x, mousePos.y), 50);
  });
}

export function doRaycast(clientX, clientY) {
  const trackGroup   = getTrackGroup();
  const photonGroup  = getPhotonGroup();
  const clusterGroup = getClusterGroup();
  const hasTrackLines   = trackGroup   && trackGroup.visible   && trackGroup.children.length   > 0;
  const hasPhotonLines  = photonGroup  && photonGroup.visible  && photonGroup.children.length  > 0;
  const hasClusterLines = clusterGroup && clusterGroup.visible && clusterGroup.children.length > 0;
  const hasFcalTubes    = fcalGroup && fcalGroup.children.some(c => c.isInstancedMesh) && fcalVisibleMap.length > 0;
  if (!_getShowInfo() || _getCinemaMode() || (!active.size && !hasTrackLines && !hasPhotonLines && !hasClusterLines && !hasFcalTubes)) { hideTooltip(); clearOutline(); return; }
  // Don't show cell info when the pointer is over any UI element (panels, toolbar, overlays)
  const topEl = document.elementFromPoint(clientX, clientY);
  if (topEl && topEl !== canvas) { hideTooltip(); clearOutline(); return; }
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    hideTooltip(); clearOutline(); return;
  }
  mxy.set(((clientX-rect.left)/rect.width)*2-1, -((clientY-rect.top)/rect.height)*2+1);
  camera.updateMatrixWorld();
  raycast.setFromCamera(mxy, camera);
  // ── Cell + FCAL hit (same priority — pick closest) ────────────────────────
  {
    let cellHit = null, cellHandle = null, cellDist = Infinity;
    if (active.size && rayTargets.length) {
      const hits = raycast.intersectObjects(rayTargets, false);
      for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        const iid = hit.instanceId;
        if (iid == null) continue;
        const h = hit.object.userData.handles?.[iid];
        if (!h || !active.has(h)) continue;
        cellHit = hit; cellHandle = h; cellDist = hit.distance;
        break; // hits are sorted; first active match is closest
      }
    }
    let fcalHit = null, fcalDist = Infinity;
    if (hasFcalTubes) {
      const iMesh = fcalGroup.children.find(c => c.isInstancedMesh);
      if (iMesh) {
        const hits = raycast.intersectObject(iMesh, false);
        if (hits.length && hits[0].instanceId != null && fcalVisibleMap[hits[0].instanceId]) {
          fcalHit = hits[0]; fcalDist = hits[0].distance;
        }
      }
    }
    if (cellHit && cellDist <= fcalDist) {
      const data = active.get(cellHandle);
      showOutline(cellHandle);
      tipCellEl.textContent  = data.cellName;
      tipCoordEl.textContent = data.coords ?? '';
      tipEEl.textContent     = `${data.energyGev.toFixed(4)} GeV`;
      if (tipEKeyEl) tipEKeyEl.textContent = _t('tip-energy-key');
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; markDirty(); return;
    }
    if (fcalHit) {
      const iid  = fcalHit.instanceId;
      const cell = fcalVisibleMap[iid];
      showFcalOutline(iid);
      const side = cell.eta >= 0 ? 'A' : 'C';
      tipCellEl.textContent  = `FCAL${cell.module} (${side}-side)`;
      tipCoordEl.textContent = `η = ${cell.eta.toFixed(3)}   φ = ${cell.phi.toFixed(3)} rad`;
      tipEEl.textContent     = `${cell.energy.toFixed(4)} GeV`;
      if (tipEKeyEl) tipEKeyEl.textContent = _t('tip-energy-key');
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; markDirty(); return;
    }
  }
  // ── Track / Photon hit (pick closest) ────────────────────────────────────
  if (hasTrackLines || hasPhotonLines) {
    const candidates = [];
    if (hasTrackLines)  candidates.push(...trackGroup.children.filter(c => c.visible));
    if (hasPhotonLines) candidates.push(...photonGroup.children.filter(c => c.visible));
    const hits = raycast.intersectObjects(candidates, false);
    if (hits.length) {
      const line         = hits[0].object;
      const ptGev        = line.userData.ptGev        ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      const isPhoton     = photonGroup && photonGroup.children.includes(line);
      clearOutline();
      tipCellEl.textContent  = isPhoton ? 'Photon' : 'Track';
      tipCoordEl.textContent = storeGateKey;
      tipEEl.textContent     = `${ptGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'p<sub>T</sub>';
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; markDirty(); return;
    }
  }
  // ── Cluster hit ───────────────────────────────────────────────────────────
  if (hasClusterLines) {
    const visibleClusters = clusterGroup.children.filter(c => c.visible);
    const clusterHits = raycast.intersectObjects(visibleClusters, false);
    if (clusterHits.length) {
      const line         = clusterHits[0].object;
      const etGev        = line.userData.etGev        ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      clearOutline();
      tipCellEl.textContent  = 'Cluster';
      tipCoordEl.textContent = storeGateKey;
      tipEEl.textContent     = `${etGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'E<sub>T</sub>';
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; markDirty(); return;
    }
  }
  clearOutline(); hideTooltip();
}
