import * as THREE from 'three';
import {
  extractPOIs,
  buildTourCurves,
  buildFallbackCurves,
  filterPOIsBySlicer,
  filterPOIsByMinimap,
  pathFingerprint,
} from './cinema/tourPath.js';

export function setupCinemaControls({
  camera,
  canvas,
  controls,
  markDirty,
  clearOutline,
  hideTooltip,
  updateCollisionHud,
}) {
  let cinemaMode = false;
  let tourMode = localStorage.getItem('cgv-tour-mode') !== '0';

  // Safe-envelope fallback orbit: lives on r = 14 m at all azimuths, gentle
  // z-wave so the camera doesn't sit on the equator forever. Used until an
  // event is loaded and whenever the current event has too few POIs to drive
  // an adaptive path. Like the adaptive curves, it never crosses cells.
  const _fallback = buildFallbackCurves();
  const fallbackPosCurve = _fallback.posCurve;
  const fallbackTgtCurve = _fallback.tgtCurve;
  let tourPosCurve = fallbackPosCurve;
  let tourTgtCurve = fallbackTgtCurve;
  let _isAdaptive = false;
  let _lastFingerprint = '';

  // Cached inputs that drive curve rebuilds. Each notifier slots its own
  // input into the cache and triggers the debounced recompute. The
  // fingerprint inside _rebuildNow then decides whether the curves actually
  // need to change. Slicer / minimap filters are read here (not by visibility
  // pipeline) because their effect on the tour is independent of how they
  // affect cell visibility.
  let _lastCells = /** @type {any[]} */ ([]);
  let _lastFcal = /** @type {any[]} */ ([]);
  let _lastSlicerMask = /** @type {any} */ (null);
  let _lastIsInsideWedge = /** @type {((x:number,y:number,z:number,m:any)=>boolean) | null} */ (
    null
  );
  let _lastMinimapRects = /** @type {any[] | null} */ (null);
  // View level (1=hits, 2=clusters, 3=particles). Always part of the
  // fingerprint so L2↔L3 transitions trigger a rebuild even when the
  // visible cell set happens to be identical between the two levels.
  let _lastViewLevel = 1;

  // Coalesce repeated notifications to a single rebuild ~250 ms after the
  // last call. The heatmap listener fires once per visibility pass, and an
  // event load triggers TILE/LAr/HEC/FCAL passes back-to-back. The
  // fingerprint check inside the timer skips redundant rebuilds when the
  // accumulated state ends up the same.
  const PATH_DEBOUNCE_MS = 250;
  let _pathDebounceTimer = null;

  // Total tour duration in arc-length space. Camera moves at constant
  // linear speed along the curve (via getPointAt) so this scales 1:1 with
  // perceived velocity regardless of how the control points are spaced.
  const TOUR_TOTAL_DURATION = 60_000;
  const TOUR_BLEND_MS = 2200;
  const TOUR_EXIT_DURATION = 1400;

  let tourExiting = false;
  let tourExitT0 = 0;
  const tourPrevPos = new THREE.Vector3();
  const tourPrevTgt = new THREE.Vector3();
  const tourVelPos = new THREE.Vector3();
  const tourVelTgt = new THREE.Vector3();
  let tourPrevT = 0;

  let tourT0 = 0;
  let tourU0 = 0;
  let tourBlending = false;
  let tourBlendT0 = 0;
  const tourBlendFromPos = new THREE.Vector3();
  const tourBlendFromTgt = new THREE.Vector3();
  const tourTmpPos = new THREE.Vector3();
  const tourTmpTgt = new THREE.Vector3();

  function tourEase(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Arc-length nearest-U: scans the curve at uniform ARC-LENGTH positions
  // (not parameter positions) so the resolution is the same everywhere
  // regardless of how the control points are spaced. Returns u in [0, 1]
  // where 0 is the curve start and 1 is the closed loop's wrap-around.
  function tourNearestU(v) {
    const samples = 240;
    let bestU = 0;
    let bestD = Infinity;
    for (let i = 0; i < samples; i++) {
      const u = i / samples;
      tourPosCurve.getPointAt(u, tourTmpPos);
      const d = tourTmpPos.distanceToSquared(v);
      if (d < bestD) {
        bestD = d;
        bestU = u;
      }
    }
    return bestU;
  }

  // Sample by arc length so the camera moves at constant linear speed along
  // the curve — no dwelling on densely-spaced waypoints, no zooming through
  // long segments. Both curves share the same u so position and target stay
  // in sync; they have similar arc-length-to-parameter mappings since they
  // were built from the same POIs.
  function tourSampleU(u) {
    u = ((u % 1) + 1) % 1;
    tourPosCurve.getPointAt(u, tourTmpPos);
    tourTgtCurve.getPointAt(u, tourTmpTgt);
  }

  // Two blends drive the inner-detector camera overrides:
  //
  // 1. TARGET blend (x/y based): the on-axis corridor in xy where the
  //    camera's curve target gets replaced by a far ±Z point so the look
  //    direction is forced parallel to the beam axis. Sign flips abruptly
  //    at z=0, in/out fades smoothly so the entry/exit of the corridor
  //    doesn't itself jump.
  //
  // 2. ROLL blend (z based): the screen rolls 90° around the beam axis
  //    while the camera is INSIDE the cylinder. We tie this to the z
  //    position relative to the calo outer envelope (half-length 6 m,
  //    matching CLUSTER_CYL_OUT_HALF_H in particles.js). Roll starts at
  //    the cylinder edge and finishes 1.5 m further in — same on the way
  //    out — so the rotation feels gradual instead of snapping to fully
  //    rolled the moment the camera enters the on-axis corridor.
  const TRAVERSAL_X_FULL = 100;
  const TRAVERSAL_X_OFF = 800;
  const TRAVERSAL_Y_FULL = 50;
  const TRAVERSAL_Y_OFF = 400;
  const TRAVERSAL_TARGET_FAR = 10000;
  const ROLL_CYL_HALF_LEN_MM = 6000;
  const ROLL_RAMP_MM = 1500;
  const _tourOverrideTgt = new THREE.Vector3();
  const _UP_OUTSIDE = new THREE.Vector3(0, 1, 0);
  const _UP_INSIDE = new THREE.Vector3(1, 0, 0);
  function _smoothBlend01(v, fullBelow, offAbove) {
    if (v <= fullBelow) return 1;
    if (v >= offAbove) return 0;
    const t = (v - fullBelow) / (offAbove - fullBelow);
    return 1 - t * t * (3 - 2 * t);
  }
  function _zRollBlend(z) {
    const az = Math.abs(z);
    if (az >= ROLL_CYL_HALF_LEN_MM) return 0;
    if (az <= ROLL_CYL_HALF_LEN_MM - ROLL_RAMP_MM) return 1;
    const t = (ROLL_CYL_HALF_LEN_MM - az) / ROLL_RAMP_MM;
    return t * t * (3 - 2 * t); // smoothstep 0 → 1 over the ramp
  }
  function _maybeOverrideTraversalTarget() {
    // On-axis gate (xy): both target override and roll are only meaningful
    // while the camera is in the on-axis corridor. Outside waypoints can
    // also cross z=0 — without this gate the roll would fire there too.
    const xBlend = _smoothBlend01(Math.abs(tourTmpPos.x), TRAVERSAL_X_FULL, TRAVERSAL_X_OFF);
    const yBlend = _smoothBlend01(tourTmpPos.y, TRAVERSAL_Y_FULL, TRAVERSAL_Y_OFF);
    const onAxisBlend = xBlend * yBlend;

    // Up vector: gated by on-axis AND ramped on z so the 90° roll fades
    // over the first 1.5 m inside the cylinder (and unwinds on the way
    // out). Outside the corridor → up stays at world +Y.
    const rollBlend = _zRollBlend(tourTmpPos.z) * onAxisBlend;
    camera.up.lerpVectors(_UP_OUTSIDE, _UP_INSIDE, rollBlend).normalize();

    // Target override: same gate, no z ramp.
    if (onAxisBlend <= 0) return;
    const sign = tourTmpPos.z >= 0 ? -1 : 1;
    _tourOverrideTgt.set(0, 0, sign * TRAVERSAL_TARGET_FAR);
    tourTmpTgt.lerp(_tourOverrideTgt, onAxisBlend);
  }

  function tick() {
    const now = performance.now();

    if (tourExiting) {
      const et = now - tourExitT0;
      if (et >= TOUR_EXIT_DURATION) {
        tourExiting = false;
        return;
      }
      const decay = Math.pow(1 - et / TOUR_EXIT_DURATION, 2);
      const dtSec = Math.max(0.001, (now - tourPrevT) / 1000);
      camera.position.addScaledVector(tourVelPos, decay * dtSec);
      controls.target.addScaledVector(tourVelTgt, decay * dtSec);
      controls.update();
      markDirty();
      tourPrevT = now;
      return;
    }

    if (!cinemaMode || !tourMode) return;

    if (tourBlending) {
      const bt = now - tourBlendT0;
      const k = Math.min(1, bt / TOUR_BLEND_MS);
      const eased = tourEase(k);
      tourSampleU(tourU0);
      _maybeOverrideTraversalTarget();
      camera.position.lerpVectors(tourBlendFromPos, tourTmpPos, eased);
      controls.target.lerpVectors(tourBlendFromTgt, tourTmpTgt, eased);
      controls.update();
      markDirty();

      const dtSec = Math.max(0.001, (now - tourPrevT) / 1000);
      tourVelPos.subVectors(camera.position, tourPrevPos).divideScalar(dtSec);
      tourVelTgt.subVectors(controls.target, tourPrevTgt).divideScalar(dtSec);
      tourPrevPos.copy(camera.position);
      tourPrevTgt.copy(controls.target);
      tourPrevT = now;

      if (k >= 1) {
        tourBlending = false;
        tourT0 = now;
      }
      return;
    }

    const u = (tourU0 + (now - tourT0) / TOUR_TOTAL_DURATION) % 1;
    tourSampleU(u);
    _maybeOverrideTraversalTarget();
    camera.position.copy(tourTmpPos);
    controls.target.copy(tourTmpTgt);
    controls.update();
    markDirty();

    const dtSec = Math.max(0.001, (now - tourPrevT) / 1000);
    tourVelPos.subVectors(camera.position, tourPrevPos).divideScalar(dtSec);
    tourVelTgt.subVectors(controls.target, tourPrevTgt).divideScalar(dtSec);
    tourPrevPos.copy(camera.position);
    tourPrevTgt.copy(controls.target);
    tourPrevT = now;
  }

  // Shared blend setup: snapshot camera state and target the nearest point on
  // whatever curves are currently active. Used both by startTour (entering
  // cinema) and _applyNewCurves (live path swap when a new event arrives).
  function _startBlendToCurves() {
    const now = performance.now();
    tourU0 = tourNearestU(camera.position);
    tourBlending = true;
    tourBlendT0 = now;
    tourT0 = now;
    tourBlendFromPos.copy(camera.position);
    tourBlendFromTgt.copy(controls.target);
    tourPrevPos.copy(camera.position);
    tourPrevTgt.copy(controls.target);
    tourVelPos.set(0, 0, 0);
    tourVelTgt.set(0, 0, 0);
    tourPrevT = now;
    tourExiting = false;
  }

  function startTour() {
    _startBlendToCurves();
    controls.autoRotate = false;
  }

  // Live curve swap. If the user is currently in the tour, the existing
  // blend machinery interpolates from where the camera is RIGHT NOW (which
  // may itself be mid-blend) to the nearest point on the new curves over
  // TOUR_BLEND_MS — same easing the cinema entry uses, so the visual feel
  // is consistent. Outside cinema (or with tour mode off) we just replace
  // the curves silently; the next enterCinema() picks them up.
  function _applyNewCurves(newPosCurve, newTgtCurve, isAdaptive) {
    tourPosCurve = newPosCurve;
    tourTgtCurve = newTgtCurve;
    _isAdaptive = !!isAdaptive;
    if (cinemaMode && tourMode) {
      _startBlendToCurves();
    }
  }

  function _scheduleRebuild() {
    if (_pathDebounceTimer) clearTimeout(_pathDebounceTimer);
    _pathDebounceTimer = setTimeout(_rebuildNow, PATH_DEBOUNCE_MS);
  }

  function _rebuildNow() {
    _pathDebounceTimer = null;
    const fp = pathFingerprint(
      _lastCells,
      _lastFcal,
      _lastSlicerMask,
      _lastMinimapRects,
      _lastViewLevel,
    );
    if (fp === _lastFingerprint) return;
    _lastFingerprint = fp;

    let pois = extractPOIs(_lastCells, _lastFcal);
    // POI filters: slicer drops POIs whose 3D centre is in the hidden
    // wedge; minimap drops POIs outside the user-defined rects. Either
    // can leave fewer than 2 POIs, which falls back to the safe orbit.
    if (_lastSlicerMask && _lastIsInsideWedge) {
      pois = filterPOIsBySlicer(pois, _lastSlicerMask, _lastIsInsideWedge);
    }
    if (_lastMinimapRects) {
      pois = filterPOIsByMinimap(pois, _lastMinimapRects);
    }

    const built = pois.length >= 2 ? buildTourCurves(pois) : null;
    if (built) {
      _applyNewCurves(built.posCurve, built.tgtCurve, true);
    } else if (_isAdaptive) {
      // No usable POIs — restore the safe-envelope fallback so the tour
      // keeps moving.
      _applyNewCurves(fallbackPosCurve, fallbackTgtCurve, false);
    }
  }

  /**
   * Heatmap-listener entry point. The visibility pipeline pushes its
   * pre-region cell set here after every refresh. Stored cells/fcal feed
   * the next rebuild; the rebuild itself is debounced + fingerprinted to
   * avoid 60-Hz churn during slider drags.
   *
   * @param {{cells?: any[], fcal?: any[]}} data
   */
  function updateTourFromEvent({ cells, fcal } = {}) {
    _lastCells = cells || [];
    _lastFcal = fcal || [];
    _scheduleRebuild();
  }

  /**
   * Called when the slicer is enabled, disabled, or its mask moves.
   * mask is the live state object from slicer.getMaskState(); isInside is
   * the slicer.isPointInsideWedge function (a free fn that takes (x,y,z,mask)).
   * Passing both keeps the cinema decoupled from the slicer module.
   *
   * @param {any} mask
   * @param {((x:number,y:number,z:number,m:any)=>boolean) | null} isInside
   */
  function notifySlicerChanged(mask, isInside) {
    _lastSlicerMask = mask || null;
    _lastIsInsideWedge = typeof isInside === 'function' ? isInside : null;
    _scheduleRebuild();
  }

  /**
   * Called when the minimap rectangles change. regions is the array of
   * {etaMin,etaMax,phiMin,phiMax} rects returned by getMinimapRegion(),
   * or null when no rects are active.
   *
   * @param {any[] | null} regions
   */
  function notifyMinimapChanged(regions) {
    _lastMinimapRects = Array.isArray(regions) && regions.length ? regions : null;
    _scheduleRebuild();
  }

  /**
   * Called when the view level switches between 1 / 2 / 3. The level itself
   * doesn't change POI positions but is folded into the fingerprint so
   * L2↔L3 transitions force a rebuild even when the cell set is identical
   * between the two — keeps rule "recompute on every mode change" honest.
   *
   * @param {number} level
   */
  function notifyViewLevelChanged(level) {
    if (!Number.isFinite(level)) return;
    _lastViewLevel = level | 0;
    _scheduleRebuild();
  }

  function enterCinema() {
    cinemaMode = true;
    document.body.classList.add('cinema');
    document.getElementById('btn-cinema').classList.add('on');
    clearOutline();
    hideTooltip();
    tourExiting = false;
    updateCollisionHud();
    if (tourMode) {
      startTour();
    } else {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.55;
    }
  }

  function exitCinema() {
    const wasTour = cinemaMode && tourMode;
    cinemaMode = false;
    document.body.classList.remove('cinema');
    controls.autoRotate = false;
    document.getElementById('btn-cinema').classList.remove('on');
    updateCollisionHud();
    // The traversal override may have rolled camera.up around the beam
    // axis; restore the project-default world-up so post-cinema navigation
    // doesn't carry the roll over.
    camera.up.set(0, 1, 0);
    if (wasTour) {
      tourExiting = true;
      tourExitT0 = performance.now();
      tourPrevT = tourExitT0;
    }
  }

  function resetCamera() {
    camera.position.set(0, 0, 12_000);
    controls.target.set(0, 0, 0);
    controls.update();
    markDirty();
  }

  function disableTourMode() {
    tourMode = false;
    if (cinemaMode) {
      tourExiting = false;
      tourBlending = false;
      camera.up.set(0, 1, 0);
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.55;
    }
  }

  function enableTourMode() {
    tourMode = true;
    if (cinemaMode) startTour();
  }

  document.getElementById('btn-cinema').addEventListener('click', () => {
    if (cinemaMode) exitCinema();
    else enterCinema();
  });
  document.getElementById('cinema-exit').addEventListener('click', exitCinema);

  let dragged = false;
  canvas.addEventListener('mousedown', () => {
    dragged = false;
  });
  canvas.addEventListener('mousemove', () => {
    dragged = true;
  });
  canvas.addEventListener('mouseup', () => {
    if (cinemaMode && !dragged) exitCinema();
  });

  return {
    tick,
    enterCinema,
    exitCinema,
    resetCamera,
    isAnimating: () => cinemaMode || tourExiting,
    isCinemaMode: () => cinemaMode,
    isTourMode: () => tourMode,
    disableTourMode,
    enableTourMode,
    updateTourFromEvent,
    notifySlicerChanged,
    notifyMinimapChanged,
    notifyViewLevelChanged,
  };
}
