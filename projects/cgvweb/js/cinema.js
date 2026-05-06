import * as THREE from 'three';

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

  const tourCamWaypoints = [
    new THREE.Vector3(8500, 3500, 12500),
    new THREE.Vector3(3000, 1200, 13000),
    new THREE.Vector3(0, 12, 11500),
    new THREE.Vector3(0, 10, 8500),
    new THREE.Vector3(0, 10, 7000),
    new THREE.Vector3(0, 10, 4500),
    new THREE.Vector3(0, 10, 2500),
    new THREE.Vector3(0, 10, 1000),
    new THREE.Vector3(0, 10, -500),
    new THREE.Vector3(0, 10, -2000),
    new THREE.Vector3(0, 10, -4000),
    new THREE.Vector3(0, 10, -7000),
    new THREE.Vector3(0, 12, -8500),
    new THREE.Vector3(0, 15, -11500),
    new THREE.Vector3(5500, 2500, -9500),
    new THREE.Vector3(9000, 2000, 0),
    new THREE.Vector3(5500, 3200, 8500),
    new THREE.Vector3(1000, 4500, 12000),
  ];
  const tourTgtWaypoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 3000),
    new THREE.Vector3(0, 0, 5800),
    new THREE.Vector3(0, 0, 5800),
    new THREE.Vector3(0, 0, 5500),
    new THREE.Vector3(0, 0, 1500),
    new THREE.Vector3(2800, 800, 1800),
    new THREE.Vector3(1200, 2400, 400),
    new THREE.Vector3(-1200, 2400, -400),
    new THREE.Vector3(-2800, 800, -1800),
    new THREE.Vector3(0, 0, -1500),
    new THREE.Vector3(0, 0, -5500),
    new THREE.Vector3(0, 0, -5500),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
  ];
  const tourPosCurve = new THREE.CatmullRomCurve3(tourCamWaypoints, true, 'centripetal', 0.5);
  const tourTgtCurve = new THREE.CatmullRomCurve3(tourTgtWaypoints, true, 'centripetal', 0.5);
  const TOUR_TOTAL_DURATION = 105_000;
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

  function tourNearestU(v) {
    const samples = 240;
    let bestU = 0;
    let bestD = Infinity;
    for (let i = 0; i < samples; i++) {
      const u = i / samples;
      tourPosCurve.getPoint(u, tourTmpPos);
      const d = tourTmpPos.distanceToSquared(v);
      if (d < bestD) {
        bestD = d;
        bestU = u;
      }
    }
    return bestU;
  }

  function tourSampleU(u) {
    u = ((u % 1) + 1) % 1;
    tourPosCurve.getPoint(u, tourTmpPos);
    tourTgtCurve.getPoint(u, tourTmpTgt);
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

  function startTour() {
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
    controls.autoRotate = false;
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
  };
}
