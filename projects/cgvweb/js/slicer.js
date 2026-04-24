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
  const SLICER_HEIGHT_MM_PER_PX = 20;
  const TWO_PI = 2 * Math.PI;

  let slicerGroup = null;
  let slicerActive = false;
  let slicerHalfHeight = SLICER_HEIGHT_INIT * 0.5;
  let slicerThetaLength = TWO_PI;
  let slicerYOffset = 0;
  let slicerZOffset = 0;

  function syncButtons() {
    slicerButton?.classList.toggle('on', slicerActive);
  }

  function resetState() {
    slicerHalfHeight = SLICER_HEIGHT_INIT * 0.5;
    slicerThetaLength = SLICER_THETA_INIT;
    slicerYOffset = 0;
    slicerZOffset = 0;
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
    let ang = Math.atan2(dy, x);
    if (ang < 0) ang += TWO_PI;
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
    g.userData.handle = sph;

    return g;
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
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartTheta = 0;
    let dragStartHeight = 0;

    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0) return;
        if (!slicerActive || !slicerGroup) return;
        const pt = pointerXY(e);
        dragRay.setFromCamera(pt, camera);
        const hits = dragRay.intersectObject(slicerGroup.userData.handle, false);
        if (!hits.length) return;
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartTheta = slicerThetaLength;
        dragStartHeight = slicerHalfHeight * 2;
        controls.enabled = false;
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = dragStartY - e.clientY;
      const dTheta = (dy / SLICER_THETA_DRAG_PX) * TWO_PI;
      const raw = dragStartTheta + dTheta;
      slicerThetaLength = ((raw % TWO_PI) + TWO_PI) % TWO_PI;

      const dx = e.clientX - dragStartX;
      const newHeight = dragStartHeight + dx * SLICER_HEIGHT_MM_PER_PX;
      const clampedH = Math.max(SLICER_HEIGHT_MIN, Math.min(SLICER_HEIGHT_MAX, newHeight));
      slicerHalfHeight = clampedH * 0.5;
      updateBasis();
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
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
    const pY = new THREE.Vector3();
    let tDragging = false;
    let prevNdcX = 0;
    let prevNdcY = 0;

    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 2) return;
        if (!slicerActive || !slicerGroup) return;
        const pt = pointerXY(e);
        dragRay.setFromCamera(pt, camera);
        const hits = dragRay.intersectObject(slicerGroup.userData.handle, false);
        if (!hits.length) return;
        tDragging = true;
        prevNdcX = pt.x;
        prevNdcY = pt.y;
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
      const dNdcY = pt.y - prevNdcY;

      // Origin of the gizmo in NDC.
      p0.set(0, slicerYOffset, slicerZOffset).project(camera);
      // Tip of +Z and +Y unit vectors, also in NDC.
      pZ.set(0, slicerYOffset, slicerZOffset + 1).project(camera);
      pY.set(0, slicerYOffset + 1, slicerZOffset).project(camera);

      const zdx = pZ.x - p0.x,
        zdy = pZ.y - p0.y;
      const ydx = pY.x - p0.x,
        ydy = pY.y - p0.y;

      // Solve a 2x2 system: [zdx ydx; zdy ydy] · [dz, dy] = [dNdcX, dNdcY].
      // This decomposes the cursor delta into independent contributions
      // along +Z and +Y of the world frame.
      const det = zdx * ydy - ydx * zdy;
      if (Math.abs(det) > 1e-10) {
        slicerZOffset += (ydy * dNdcX - ydx * dNdcY) / det;
        slicerYOffset += (-zdy * dNdcX + zdx * dNdcY) / det;
        updateBasis();
      } else {
        // Degenerate (camera looking down the axis we're trying to move) —
        // fall back to a straight Z projection so the gizmo still responds.
        const len2 = zdx * zdx + zdy * zdy;
        if (len2 > 1e-10) {
          slicerZOffset += (dNdcX * zdx + dNdcY * zdy) / len2;
          updateBasis();
        }
      }
      prevNdcX = pt.x;
      prevNdcY = pt.y;
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
      const hits = dragRay.intersectObject(slicerGroup.userData.handle, false);
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
