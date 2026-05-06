// Shared infrastructure used by every per-particle file in this directory.
//
// Three reusable group-builders:
//   - _disposeGroup        : free a per-event group's GPU resources
//   - _buildEtaPhiLineGroup: η/φ line group spanning the calo cylinders
//                            (clusters / jets / τ all use this)
//   - _buildAnchoredLabelGroup : sprite group anchored on matched tracks
//                            (e± / μ± / τ± all use this)
//
// Plus the cylinder-intersection helper they depend on, the small set of
// constants that pin label placement, and the central
// syncParticleLabelVisibility pass that walks every label-bearing group via
// the userData.isParticleLabel tag.

import * as THREE from 'three';
import { scene } from '../renderer.js';
import {
  fcalGroup,
  fcalVisibleMap,
  visHandles,
  getTrackGroup,
  getElectronGroup,
  getMuonGroup,
  getTauLabelGroup,
  getMetGroup,
  getUnmatchedTausVisible,
  getParticleLabelsVisible,
} from '../visibility.js';

// Inner calo face — composite surface for first-volume entry, with transitions
// snapped to ATLAS-standard |η|. Surface positions come from CaloGeometry.glb;
// the dispatch is by |η| so the boundary always lands on the right surface,
// without the floating-point ULP issues that arise from comparing derived
// limits like R·sinh(1.5):
//   |η| ≤ 1.5         → Barrel PS  (r = 1423.445)
//   1.5 < |η| ≤ 1.8   → EC PS      (|z| = 3680.75)
//   1.8 < |η|         → EC Strip   (|z| = 3754.24, also the fallback when the
//                                   ray would pass through the strip's inner hole)
const CALO_BPS_R = 1423.445;
const CALO_ECPS_Z = 3680.75;
const CALO_ECSTRIP_Z = 3754.24;
const ETA_BPS_TO_ECPS = 1.5;
const ETA_ECPS_TO_STRIP = 1.8;

// Outer cylinder (calo exit): r = 3.82 m, half-h = 6.0 m
export const CLUSTER_CYL_OUT_R = 3820;
export const CLUSTER_CYL_OUT_HALF_H = 6000;

// Push the lepton-label sprite slightly outward (radially in xy) so it doesn't
// sit on top of the line at the anchor point.
const LEPTON_LABEL_RADIAL_OFFSET_MM = 120;
// renderOrder for label groups — above tracks (5) and clusters/jets (6) so
// labels stay legible against any underlying line / dashed line.
const LEPTON_LABEL_RENDER_ORDER = 7;

/**
 * Returns t at which the unit-direction ray (dx,dy,dz) from the origin hits
 * the surface of a cylinder with given radius and half-height.
 */
export function _cylIntersect(dx, dy, dz, r, halfH) {
  const rT = Math.sqrt(dx * dx + dy * dy);
  if (rT > 1e-9) {
    const tBarrel = r / rT;
    if (Math.abs(dz * tBarrel) <= halfH) return tBarrel;
  }
  return halfH / Math.abs(dz);
}

/**
 * Returns t at which the unit-direction ray (dx,dy,dz) from the origin first
 * enters a LAr EM calorimeter volume — Barrel PS, EC PS, or EC Strip — based
 * on |η| computed from the ray itself (|η| = asinh(|dz|/rT) for a unit ray).
 * Used for the inner endpoint of cluster/jet/τ lines and the spring termination
 * of γ/e helices.
 */
export function _innerCaloFaceIntersect(dx, dy, dz) {
  const rT = Math.sqrt(dx * dx + dy * dy);
  const dzAbs = Math.abs(dz);
  // Pure-z ray (no transverse component): far forward, send to strip face.
  if (rT < 1e-9) return CALO_ECSTRIP_Z / dzAbs;
  const absEta = Math.asinh(dzAbs / rT);
  if (absEta <= ETA_BPS_TO_ECPS) return CALO_BPS_R / rT; // Barrel PS
  if (absEta <= ETA_ECPS_TO_STRIP) return CALO_ECPS_Z / dzAbs; // EC PS
  return CALO_ECSTRIP_Z / dzAbs; // EC Strip
}

// World-space bounding sphere cached on each cell handle (lazy, on first
// raycast hit). Computed from the geometry's local bsphere transformed by
// origMatrix. The sphere is invariant under cell visibility — we only need
// to recompute if origMatrix changes (it never does for static geometry).
function _handleWorldSphere(h) {
  if (h._wsphere) return h._wsphere;
  const geo = h.iMesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const s = new THREE.Sphere().copy(geo.boundingSphere);
  s.applyMatrix4(h.origMatrix);
  h._wsphere = s;
  return s;
}

/**
 * Returns t at which the unit ray (dx,dy,dz) from the origin first hits a
 * VISIBLE calorimeter cell — Tile / LAr / HEC instances currently in `active`,
 * OR an FCAL tube currently flagged in fcalVisibleMap. Falls back to the
 * surface-based `_innerCaloFaceIntersect` when no such cell lies on the ray.
 *
 * Implementation: manual ray-vs-bounding-sphere iteration over the visible
 * cell maps. Three.js's Raycaster.intersectObjects is O(total instances) per
 * ray — including the zero-matrix hidden ones it can't short-circuit, which
 * on this detector is ~150 k per InstancedMesh. The manual pass is O(visible
 * cells), typically a few hundred, and skips the per-instance triangle
 * iteration entirely.
 *
 * Bounding-sphere approximation means the reported t lands on the cell's
 * front bsphere, not on the exact triangle hit — accurate to cell-half-size
 * (~tens of mm), which is invisible at the visualization scale.
 */
export function _firstVisibleCellHit(dx, dy, dz) {
  // dx, dy, dz are unit (caller normalises). Origin at (0,0,0).
  let bestT = Infinity;

  // Tile / LAr / HEC: iterate visHandles (cells whose iMesh matrix is
  // currently set to origMatrix, i.e. actually displayed). visHandles is
  // rebuilt by applyThreshold / _applySlicerMask whenever cell visibility
  // changes, so the spring tip follows the slider.
  for (let i = 0; i < visHandles.length; i++) {
    const h = visHandles[i];
    const s = _handleWorldSphere(h);
    const cx = s.center.x,
      cy = s.center.y,
      cz = s.center.z;
    const r = s.radius;
    const tCenter = dx * cx + dy * cy + dz * cz; // closest-approach t along ray
    if (tCenter <= 0) continue; // sphere behind origin
    const distSq = cx * cx + cy * cy + cz * cz - tCenter * tCenter;
    const r2 = r * r;
    if (distSq > r2) continue; // ray misses sphere
    const tHit = tCenter - Math.sqrt(r2 - distSq); // front-of-sphere t
    if (tHit > 0 && tHit < bestT) bestT = tHit;
  }

  // FCAL: separate InstancedMesh whose instance i is visible iff
  // fcalVisibleMap[i] is truthy. We pull the per-instance world-space matrix
  // out of the InstancedMesh and apply it to the geometry's bsphere.
  if (fcalGroup && fcalVisibleMap && fcalVisibleMap.length) {
    const fcalIMesh = fcalGroup.children.find((c) => c.isInstancedMesh);
    if (fcalIMesh) {
      const fcalGeo = fcalIMesh.geometry;
      if (!fcalGeo.boundingSphere) fcalGeo.computeBoundingSphere();
      const localR = fcalGeo.boundingSphere.radius;
      for (let i = 0; i < fcalVisibleMap.length; i++) {
        if (!fcalVisibleMap[i]) continue;
        fcalIMesh.getMatrixAt(i, _scratchMat4);
        // Translation column carries the world-space cell centre (the FCAL
        // builder pre-bakes scale/orientation into the local geometry).
        const e = _scratchMat4.elements;
        const cx = e[12],
          cy = e[13],
          cz = e[14];
        // Approx radius: max scale × local bsphere radius. The FCAL builder
        // applies non-uniform scales (rx, ry, len/2) to a unit-cylinder; pick
        // the largest axis so we don't false-negative.
        const sx = Math.hypot(e[0], e[1], e[2]);
        const sy = Math.hypot(e[4], e[5], e[6]);
        const sz = Math.hypot(e[8], e[9], e[10]);
        const r = localR * Math.max(sx, sy, sz);
        const tCenter = dx * cx + dy * cy + dz * cz;
        if (tCenter <= 0) continue;
        const distSq = cx * cx + cy * cy + cz * cz - tCenter * tCenter;
        const r2 = r * r;
        if (distSq > r2) continue;
        const tHit = tCenter - Math.sqrt(r2 - distSq);
        if (tHit > 0 && tHit < bestT) bestT = tHit;
      }
    }
  }

  if (bestT < Infinity) return bestT;
  return _innerCaloFaceIntersect(dx, dy, dz);
}

const _scratchMat4 = new THREE.Matrix4();

/**
 * Removes a per-event group from the scene and frees its owned GPU resources:
 *   - Line geometries (per-event BufferGeometry) → dispose.
 *   - Sprite textures (per-sprite CanvasTexture) → dispose. The sprite's
 *     geometry is Three.js's shared built-in plane and must NOT be disposed.
 *   - Materials are typically shared singletons (TRACK_MAT, JET_MAT, …) and
 *     are also left alone.
 *
 * @param {() => { traverse: (cb: (o: any) => void) => void } | null} getter
 * @param {(g: any) => void} setter
 */
export function _disposeGroup(getter, setter) {
  const g = getter();
  if (!g) return;
  g.traverse((o) => {
    if (o.isSprite) {
      if (o.material?.map) o.material.map.dispose();
    } else if (o.geometry) {
      o.geometry.dispose();
    }
  });
  scene.remove(g);
  setter(null);
}

/**
 * Builds a Group of η/φ lines stretching from the inner-detector cylinder
 * (r ≈ 1.42 m) to the outer cylinder (r ≈ 3.82 m) — the visual band where
 * clusters / jets / τ candidates live. Each line gets the supplied material
 * (typically a LineDashedMaterial — computeLineDistances is called for you so
 * the dashes show up), its endpoints derived from the item's (eta, phi), and
 * its userData stamped via mapToUserData(item). On non-empty input attaches
 * the group via setter; empty input is a no-op (caller is responsible for
 * any pre-clear via _disposeGroup before calling).
 *
 * `useCellRaycast` controls the inner-endpoint computation:
 *   - true  (default — jets, τ): _firstVisibleCellHit, lands on a real cell.
 *   - false (clusters): _innerCaloFaceIntersect, surface only. Cluster events
 *                       routinely have thousands of cluster lines (most cut
 *                       by the ET threshold), and per-cluster raycasting
 *                       freezes slider drags. Surface approximation puts the
 *                       cluster line start within tens of mm of the real
 *                       first-cell hit, invisible at the visualization scale.
 *
 * @param {{
 *   items: ReadonlyArray<{ eta: number, phi: number, [k: string]: any }>,
 *   mat: any,
 *   mapToUserData: (item: any) => Record<string, any>,
 *   setter: (g: any) => void,
 *   renderOrder?: number,
 *   useCellRaycast?: boolean,
 * }} cfg
 */
export function _buildEtaPhiLineGroup({
  items,
  mat,
  mapToUserData,
  setter,
  renderOrder = 6,
  useCellRaycast = true,
}) {
  if (!items.length) return;
  const g = new THREE.Group();
  g.renderOrder = renderOrder;
  const innerHit = useCellRaycast ? _firstVisibleCellHit : _innerCaloFaceIntersect;
  for (const item of items) {
    const { eta, phi } = item;
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const t0 = innerHit(dx, dy, dz);
    const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
    const start = new THREE.Vector3(dx * t0, dy * t0, dz * t0);
    const end = new THREE.Vector3(dx * t1, dy * t1, dz * t1);
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, mat);
    // Required by LineDashedMaterial — without it, the line renders solid.
    line.computeLineDistances();
    Object.assign(line.userData, mapToUserData(item));
    g.add(line);
  }
  scene.add(g);
  setter(g);
}

/**
 * Visibility-driven refresh for an η/φ-line group built by
 * _buildEtaPhiLineGroup. Walks the existing Lines, recomputes (t0, t1) from
 * each Line's userData.eta / userData.phi, and rewrites its 6-float position
 * attribute in place. Skips the Group / Line / BufferGeometry allocation
 * dance that would otherwise run per slider tick. computeLineDistances()
 * is re-run since the LineDashedMaterial caches them based on positions.
 *
 * @param {THREE.Group | null} g  the existing line group (no-op if null)
 * @param {boolean} useCellRaycast  same semantics as in _buildEtaPhiLineGroup
 */
export function _refreshEtaPhiLineGroupGeometry(g, useCellRaycast = true) {
  if (!g) return;
  const innerHit = useCellRaycast ? _firstVisibleCellHit : _innerCaloFaceIntersect;
  for (const line of g.children) {
    const { eta, phi } = line.userData;
    if (eta == null || phi == null) continue;
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const t0 = innerHit(dx, dy, dz);
    const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
    const posAttr = line.geometry.getAttribute('position');
    const arr = posAttr.array;
    arr[0] = dx * t0;
    arr[1] = dy * t0;
    arr[2] = dz * t0;
    arr[3] = dx * t1;
    arr[4] = dy * t1;
    arr[5] = dz * t1;
    posAttr.needsUpdate = true;
    line.computeLineDistances();
  }
}

/**
 * Builds a Group of sprite labels — one per matched track that `predicate`
 * accepts — anchored at the polyline point selected by `anchorIdx`, pushed
 * radially outward by LEPTON_LABEL_RADIAL_OFFSET_MM. Each sprite stashes its
 * matched line on userData.anchorLine so syncParticleLabelVisibility can keep
 * per-sprite visibility in lockstep with the line. Sprite identity (text +
 * colour + extra userData) is delegated to `makeSprite`; if it returns null,
 * that line is skipped. On success attaches via `setter`; on no matches no-ops.
 *
 * @param {{
 *   predicate: (line: any) => boolean,
 *   anchorIdx: (count: number) => number,
 *   makeSprite: (line: any) => any,
 *   setter: (g: any) => void,
 * }} cfg
 */
export function _buildAnchoredLabelGroup({ predicate, anchorIdx, makeSprite, setter }) {
  const trackGroup = getTrackGroup();
  if (!trackGroup) return;
  const g = new THREE.Group();
  g.renderOrder = LEPTON_LABEL_RENDER_ORDER;
  let added = false;
  for (const line of trackGroup.children) {
    if (!predicate(line)) continue;
    const pos = line.geometry?.getAttribute('position');
    if (!pos || pos.count < 1) continue;
    const idx = anchorIdx(pos.count);
    const x = pos.getX(idx);
    const y = pos.getY(idx);
    const z = pos.getZ(idx);
    const sprite = makeSprite(line);
    if (!sprite) continue;
    const rLen = Math.hypot(x, y);
    const radX = rLen > 1e-6 ? x / rLen : 1;
    const radY = rLen > 1e-6 ? y / rLen : 0;
    sprite.position.set(
      x + radX * LEPTON_LABEL_RADIAL_OFFSET_MM,
      y + radY * LEPTON_LABEL_RADIAL_OFFSET_MM,
      z,
    );
    sprite.userData.anchorLine = line;
    // Initial visibility honours the Track Labels toggle so a freshly-created
    // sprite doesn't flash for the frames between drawXxx and the
    // syncParticleLabelVisibility that runs at the tail of the event-load
    // pipeline. (Anchor-driven and τ-extras refinements are applied on the
    // next sync — see syncParticleLabelVisibility below.)
    sprite.visible = getParticleLabelsVisible();
    g.add(sprite);
    added = true;
  }
  if (!added) return;
  scene.add(g);
  setter(g);
}

/**
 * Single pass over every group that holds particle-label sprites. Each label
 * is identified by `userData.isParticleLabel` (set at sprite-creation time —
 * see drawElectrons / drawMuons / drawTaus / metOverlay) so adding a new
 * label-bearing overlay only needs the tag, not a new branch here.
 *
 * Visibility = (Track Labels toggle) AND (anchor track visible) AND
 *              (sprite-specific extras — currently only τ has them).
 *
 * Anchor-driven hide keeps a label from floating in empty space when the
 * pT slider drops the track underneath. ν has no anchor (anchor is null),
 * so the optional-chain collapses to `true` and only the labels-toggle
 * gates it.
 *
 * τ extras: hide when the anchor's been claimed by a higher-priority match
 * (every hadronic τ IS a jet to anti-kt; the orange jet track shouldn't
 * also wear a τ symbol — see _applyTrackMaterials' priority chain). And
 * hide tauCharge=0 candidates unless the K-popover Unmatched Tau toggle
 * is on (sum=0 is impossible for a real τ — always ±1).
 *
 * Called from applyTrackThreshold after the pT pass + filter pass have
 * updated track visibility, and from setParticleLabelsVisible when the
 * Track Labels toggle flips.
 */
export function syncParticleLabelVisibility() {
  const labelsOn = getParticleLabelsVisible();
  const showUnmatchedTau = getUnmatchedTausVisible();
  const labelGroups = [getElectronGroup(), getMuonGroup(), getTauLabelGroup(), getMetGroup()];
  for (const g of labelGroups) {
    if (!g) continue;
    for (const sprite of g.children ?? []) {
      if (!sprite.userData?.isParticleLabel) continue;
      const anchor = sprite.userData.anchorLine;
      const anchorOk = !anchor || anchor.visible;
      // τ-only extras: presence of tauCharge in userData identifies a τ
      // sprite (other label sprites never set it).
      let tauOk = true;
      if (sprite.userData.tauCharge !== undefined && anchor) {
        const u = anchor.userData;
        if (u.matchedElectronPdgId != null || u.isMuonMatched || u.isJetMatched) {
          tauOk = false;
        } else {
          const c = sprite.userData.tauCharge;
          tauOk = c === -1 || c === 1 || showUnmatchedTau;
        }
      }
      sprite.visible = labelsOn && anchorOk && tauOk;
    }
  }
}
