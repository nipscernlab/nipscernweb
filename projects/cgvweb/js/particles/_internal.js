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
  getTrackGroup,
  getElectronGroup,
  getMuonGroup,
  getTauLabelGroup,
  getMetGroup,
  getUnmatchedTausVisible,
  getParticleLabelsVisible,
} from '../visibility.js';

// Inner cylinder (calo entry):  r = 1.42 m, h = 6.4 m
export const CLUSTER_CYL_IN_R = 1421.73;
export const CLUSTER_CYL_IN_HALF_H = 3680.75;
// Outer cylinder (calo exit):   r = 4.25 m, h = 12 m
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
 * @param {{
 *   items: ReadonlyArray<{ eta: number, phi: number, [k: string]: any }>,
 *   mat: any,
 *   mapToUserData: (item: any) => Record<string, any>,
 *   setter: (g: any) => void,
 *   renderOrder?: number,
 * }} cfg
 */
export function _buildEtaPhiLineGroup({ items, mat, mapToUserData, setter, renderOrder = 6 }) {
  if (!items.length) return;
  const g = new THREE.Group();
  g.renderOrder = renderOrder;
  for (const item of items) {
    const { eta, phi } = item;
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz = Math.cos(theta);
    const t0 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R, CLUSTER_CYL_IN_HALF_H);
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
