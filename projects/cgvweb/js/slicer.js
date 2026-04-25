export function createSlicerController({
  THREE,
  canvas,
  camera,
  controls,
  scene,
  slicerButton,
  onMaskChange,
  onDisable,
  onHideNonActiveShowAll,
}) {
  const SLICER_RADIUS = 5000;
  const SLICER_HEIGHT_MIN = 0;
  const SLICER_HEIGHT_MAX = 20000;
  const SLICER_HEIGHT_INIT = 5000;
  const SLICER_THETA_INIT = 0.5 * Math.PI;
  const SLICER_EPS = 1e-6;
  const SLICER_THETA_DRAG_PX = 300;
  const SLICER_PHI_DRAG_PX = 300;
  const SLICER_HEIGHT_MM_PER_PX = 20;
  const TWO_PI = 2 * Math.PI;
  // Touch-only: hold the gizmo without moving for this long to enter the
  // rotate-around-Z mode (mirrors what right-click does on desktop).
  const SLICER_LONGPRESS_MS = 400;
  // If the finger drifts more than this before the timer fires, treat the
  // gesture as a regular shape drag.
  const SLICER_LONGPRESS_MOVE_PX = 10;

  let slicerGroup = null;
  let slicerActive = false;
  let slicerHalfHeight = SLICER_HEIGHT_INIT * 0.5;
  let slicerThetaLength = TWO_PI;
  let slicerYOffset = 0;
  let slicerZOffset = 0;
  let slicerPhi = 0;

  function syncButtons() {
    slicerButton?.classList.toggle('on', slicerActive);
  }

  function resetState() {
    slicerHalfHeight = SLICER_HEIGHT_INIT * 0.5;
    slicerThetaLength = SLICER_THETA_INIT;
    slicerYOffset = 0;
    slicerZOffset = 0;
    slicerPhi = 0;
  }

  function getMaskState() {
    const thetaLen = slicerActive ? slicerThetaLength : 0;
    return {
      active: slicerActive,
      r2: SLICER_RADIUS * SLICER_RADIUS,
      yOff: slicerYOffset,
      zMin: slicerZOffset - slicerHalfHeight,
      zMax: slicerZOffset + slicerHalfHeight,
      thetaLen,
      phi: slicerPhi,
      fullTh: thetaLen >= TWO_PI - SLICER_EPS,
      emptyTh: thetaLen <= SLICER_EPS,
    };
  }

  function isPointInsideWedge(x, y, z, slicer = getMaskState()) {
    if (!slicer.active || slicer.emptyTh) return false;
    const dy = y - slicer.yOff;
    if (x * x + dy * dy >= slicer.r2) return false;
    if (z <= slicer.zMin || z >= slicer.zMax) return false;
    if (slicer.fullTh) return true;
    let ang = Math.atan2(dy, x) - slicer.phi;
    ang = ((ang % TWO_PI) + TWO_PI) % TWO_PI;
    return ang < slicer.thetaLen;
  }

  function buildGizmo() {
    const g = new THREE.Group();
    g.renderOrder = 20;
    const L = 800;
    const head = 120;
    const rad = 40;
    const sphR = 60;

    const mkArrow = (dir, color) => {
      const a = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), L, color, head, rad);
      a.line.material.linewidth = 3;
      a.line.material.depthTest = false;
      a.cone.material.depthTest = false;
      a.renderOrder = 21;
      return a;
    };

    g.userData.arrowZ = mkArrow(new THREE.Vector3(0, 0, 1), 0xff2a2a);
    g.add(g.userData.arrowZ);
    g.userData.arrowP = mkArrow(new THREE.Vector3(0, 1, 0), 0x33dd55);
    g.add(g.userData.arrowP);
    g.userData.arrowT = mkArrow(new THREE.Vector3(1, 0, 0), 0x3b8cff);
    g.add(g.userData.arrowT);

    const sphGeo = new THREE.SphereGeometry(sphR, 16, 12);
    const sphMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const sph = new THREE.Mesh(sphGeo, sphMat);
    sph.userData.slicerHandle = true;
    sph.renderOrder = 22;
    g.add(sph);
    g.userData.handleMouse = sph;

    // Invisible larger hit-area so touch input on mobile (where the visual
    // sphere is only a few pixels wide) doesn't have to land on the dot exactly.
    const hitR = 500;
    const hitGeo = new THREE.SphereGeometry(hitR, 12, 8);
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.userData.slicerHandle = true;
    hit.renderOrder = 22;
    g.add(hit);
    g.userData.handleTouch = hit;

    return g;
  }

  function pickHandle(e) {
    return e.pointerType === 'touch'
      ? slicerGroup.userData.handleTouch
      : slicerGroup.userData.handleMouse;
  }

  function updateBasis() {
    if (!slicerGroup) return;
    slicerGroup.position.set(0, slicerYOffset, slicerZOffset);
    slicerGroup.userData.arrowZ.setDirection(new THREE.Vector3(0, 0, 1));
    slicerGroup.userData.arrowP.setDirection(new THREE.Vector3(0, 1, 0));
    slicerGroup.userData.arrowT.setDirection(new THREE.Vector3(1, 0, 0));
    slicerGroup.updateMatrix();
    onMaskChange?.();
  }

  function enable() {
    if (slicerActive) return;
    slicerActive = true;
    resetState();
    if (!slicerGroup) {
      slicerGroup = buildGizmo();
      scene.add(slicerGroup);
    }
    slicerGroup.visible = true;
    syncButtons();
    updateBasis();
  }

  function disable() {
    if (!slicerActive) return;
    slicerActive = false;
    if (slicerGroup) slicerGroup.visible = false;
    syncButtons();
    onHideNonActiveShowAll?.();
    onDisable?.();
  }

  function toggle() {
    slicerActive ? disable() : enable();
  }

  function pointerXY(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  (function installShapeDrag() {
    const dragRay = new THREE.Raycaster();
    dragRay.params.Line = { threshold: 25 };
    const p0 = new THREE.Vector3();
    const pZ = new THREE.Vector3();
    let dragging = false;
    let mode = 'shape'; // 'shape' | 'rotate' (touch long-press)
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartTheta = 0;
    let dragStartHeight = 0;
    // Rotate-mode anchors, set when long-press fires (not at pointerdown).
    let dragStartClientY_rot = 0;
    let dragStartPhi_rot = 0;
    let prevNdcX_rot = 0;
    // Last cursor position; needed by the long-press timer because the
    // setTimeout callback has no fresh PointerEvent of its own.
    let lastClientX = 0;
    let lastClientY = 0;
    let longPressTimer = null;

    function clearLongPress() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    function setHandleHighlight(on) {
      if (!slicerGroup) return;
      const sph = slicerGroup.userData.handleMouse;
      sph.material.color.setHex(on ? 0xffaa33 : 0xffffff);
    }

    function enterRotateMode() {
      if (!dragging) return;
      mode = 'rotate';
      dragStartClientY_rot = lastClientY;
      dragStartPhi_rot = slicerPhi;
      const rect = canvas.getBoundingClientRect();
      prevNdcX_rot = ((lastClientX - rect.left) / rect.width) * 2 - 1;
      setHandleHighlight(true);
      try {
        navigator.vibrate?.(15);
      } catch (_) {}
    }

    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0) return;
        if (!slicerActive || !slicerGroup) return;
        const pt = pointerXY(e);
        dragRay.setFromCamera(pt, camera);
        const hits = dragRay.intersectObject(pickHandle(e), false);
        if (!hits.length) return;
        dragging = true;
        mode = 'shape';
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartTheta = slicerThetaLength;
        dragStartHeight = slicerHalfHeight * 2;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        controls.enabled = false;
        canvas.setPointerCapture(e.pointerId);
        if (e.pointerType === 'touch') {
          longPressTimer = setTimeout(enterRotateMode, SLICER_LONGPRESS_MS);
        }
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      // Cancel pending long-press if the finger drifts before it fires.
      if (longPressTimer) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (dx * dx + dy * dy > SLICER_LONGPRESS_MOVE_PX * SLICER_LONGPRESS_MOVE_PX) {
          clearLongPress();
        }
      }

      if (mode === 'shape') {
        const dy = dragStartY - e.clientY;
        const dTheta = (dy / SLICER_THETA_DRAG_PX) * TWO_PI;
        const raw = dragStartTheta + dTheta;
        slicerThetaLength = ((raw % TWO_PI) + TWO_PI) % TWO_PI;

        const dx = e.clientX - dragStartX;
        const newHeight = dragStartHeight + dx * SLICER_HEIGHT_MM_PER_PX;
        const clampedH = Math.max(SLICER_HEIGHT_MIN, Math.min(SLICER_HEIGHT_MAX, newHeight));
        slicerHalfHeight = clampedH * 0.5;
        updateBasis();
      } else {
        // Rotate mode: vertical → phi, horizontal → Z translation.
        const dyClient = e.clientY - dragStartClientY_rot;
        slicerPhi = dragStartPhi_rot + (dyClient / SLICER_PHI_DRAG_PX) * TWO_PI;

        const ndcX = pointerXY(e).x;
        const dNdcX = ndcX - prevNdcX_rot;
        p0.set(0, slicerYOffset, slicerZOffset).project(camera);
        pZ.set(0, slicerYOffset, slicerZOffset + 1).project(camera);
        const zdx = pZ.x - p0.x,
          zdy = pZ.y - p0.y;
        const len2 = zdx * zdx + zdy * zdy;
        if (len2 > 1e-10) {
          slicerZOffset += (dNdcX * zdx) / len2;
        }
        prevNdcX_rot = ndcX;
        updateBasis();
      }
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      clearLongPress();
      if (mode === 'rotate') setHandleHighlight(false);
      mode = 'shape';
      controls.enabled = true;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  })();

  (function installTranslateDrag() {
    const dragRay = new THREE.Raycaster();
    dragRay.params.Line = { threshold: 25 };
    const p0 = new THREE.Vector3();
    const pZ = new THREE.Vector3();
    let tDragging = false;
    let prevNdcX = 0;
    let dragStartClientY = 0;
    let dragStartPhi = 0;

    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 2) return;
        if (!slicerActive || !slicerGroup) return;
        const pt = pointerXY(e);
        dragRay.setFromCamera(pt, camera);
        const hits = dragRay.intersectObject(pickHandle(e), false);
        if (!hits.length) return;
        tDragging = true;
        prevNdcX = pt.x;
        dragStartClientY = e.clientY;
        dragStartPhi = slicerPhi;
        controls.enabled = false;
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    canvas.addEventListener('pointermove', (e) => {
      if (!tDragging) return;
      const pt = pointerXY(e);
      const dNdcX = pt.x - prevNdcX;

      // Vertical drag → rotate the wedge around the Z (beam) axis.
      const dyClient = e.clientY - dragStartClientY;
      slicerPhi = dragStartPhi + (dyClient / SLICER_PHI_DRAG_PX) * TWO_PI;

      // Horizontal drag → translate along world +Z. Project the unit +Z
      // vector to NDC so the cursor "follows" the gizmo at any camera angle;
      // we only consume the horizontal component of the cursor delta.
      p0.set(0, slicerYOffset, slicerZOffset).project(camera);
      pZ.set(0, slicerYOffset, slicerZOffset + 1).project(camera);
      const zdx = pZ.x - p0.x,
        zdy = pZ.y - p0.y;
      const len2 = zdx * zdx + zdy * zdy;
      if (len2 > 1e-10) {
        slicerZOffset += (dNdcX * zdx) / len2;
      }

      updateBasis();
      prevNdcX = pt.x;
    });

    const endTDrag = (e) => {
      if (!tDragging) return;
      tDragging = false;
      controls.enabled = true;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };
    canvas.addEventListener('pointerup', endTDrag);
    canvas.addEventListener('pointercancel', endTDrag);

    canvas.addEventListener('contextmenu', (e) => {
      if (!slicerActive || !slicerGroup) return;
      const pt = pointerXY(e);
      dragRay.setFromCamera(pt, camera);
      const hits = dragRay.intersectObject(slicerGroup.userData.handleMouse, false);
      if (hits.length) e.preventDefault();
    });
  })();

  slicerButton?.addEventListener('click', toggle);
  syncButtons();

  return {
    disable,
    enable,
    getGroup: () => slicerGroup,
    getMaskState,
    isActive: () => slicerActive,
    isPointInsideWedge,
    isShowAllCells: () => slicerActive,
    toggle,
  };
}
