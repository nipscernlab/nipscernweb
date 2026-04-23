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
  let tourMode = localStorage.getItem('cgv-tour-mode') === '1';

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
    new THREE.Vector3(-5500, 2500, -9500),
    new THREE.Vector3(-9000, 2000, 0),
    new THREE.Vector3(-5500, 3200, 8500),
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
  canvas.addEventListener('mousedown', () => { dragged = false; });
  canvas.addEventListener('mousemove', () => { dragged = true; });
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
