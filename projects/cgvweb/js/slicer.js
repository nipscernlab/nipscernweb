export function createSlicerController({
  THREE,
  canvas,
  camera,
  controls,
  scene,
  slicerButton,
  showAllButton,
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

  let slicerGroup = null;
  let slicerActive = false;
  let showAllCells = false;
  let slicerHalfHeight = SLICER_HEIGHT_INIT * 0.5;
  let slicerThetaLength = 2 * Math.PI;
  let slicerZOffset = 0;

  function syncButtons() {
    slicerButton?.classList.toggle('on', slicerActive);
    showAllButton?.classList.toggle('on', showAllCells);
  }

  function resetState() {
    slicerHalfHeight = SLICER_HEIGHT_INIT * 0.5;
    slicerThetaLength = SLICER_THETA_INIT;
    slicerZOffset = 0;
  }

  function getMaskState() {
    const thetaLen = slicerActive ? slicerThetaLength : 0;
    return {
      active: slicerActive,
      r2: SLICER_RADIUS * SLICER_RADIUS,
      zMin: slicerZOffset - slicerHalfHeight,
      zMax: slicerZOffset + slicerHalfHeight,
      thetaLen,
      fullTh: thetaLen >= 2 * Math.PI - SLICER_EPS,
      emptyTh: thetaLen <= SLICER_EPS,
    };
  }

  function isPointInsideWedge(x, y, z, slicer = getMaskState()) {
    if (!slicer.active || slicer.emptyTh) return false;
    if (x * x + y * y >= slicer.r2) return false;
    if (z <= slicer.zMin || z >= slicer.zMax) return false;
    if (slicer.fullTh) return true;
    let ang = Math.atan2(y, x);
    if (ang < 0) ang += 2 * Math.PI;
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

    g.userData.arrowZ = mkArrow(new THREE.Vector3(0, 0, 1), 0xff2a2a); g.add(g.userData.arrowZ);
    g.userData.arrowP = mkArrow(new THREE.Vector3(0, 1, 0), 0x33dd55); g.add(g.userData.arrowP);
    g.userData.arrowT = mkArrow(new THREE.Vector3(1, 0, 0), 0x3b8cff); g.add(g.userData.arrowT);

    const sphGeo = new THREE.SphereGeometry(sphR, 16, 12);
    const sphMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false });
    const sph = new THREE.Mesh(sphGeo, sphMat);
    sph.userData.slicerHandle = true;
    sph.renderOrder = 22;
    g.add(sph);
    g.userData.handle = sph;

    return g;
  }

  function updateBasis() {
    if (!slicerGroup) return;
    slicerGroup.position.set(0, 0, slicerZOffset);
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
    onDisable?.();
  }

  function toggle() {
    slicerActive ? disable() : enable();
  }

  function setShowAllCells(next) {
    const prev = showAllCells;
    showAllCells = !!next;
    syncButtons();
    if (prev && !showAllCells) onHideNonActiveShowAll?.();
    onMaskChange?.();
  }

  function toggleShowAllCells() {
    setShowAllCells(!showAllCells);
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

    canvas.addEventListener('pointerdown', e => {
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
    }, true);

    canvas.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dy = dragStartY - e.clientY;
      const dTheta = (dy / SLICER_THETA_DRAG_PX) * 2 * Math.PI;
      slicerThetaLength = Math.max(0, Math.min(2 * Math.PI, dragStartTheta + dTheta));

      const dx = e.clientX - dragStartX;
      const newHeight = dragStartHeight + dx * SLICER_HEIGHT_MM_PER_PX;
      const clampedH = Math.max(SLICER_HEIGHT_MIN, Math.min(SLICER_HEIGHT_MAX, newHeight));
      slicerHalfHeight = clampedH * 0.5;
      updateBasis();
    });

    const endDrag = e => {
      if (!dragging) return;
      dragging = false;
      controls.enabled = true;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  })();

  (function installZDrag() {
    const dragRay = new THREE.Raycaster();
    dragRay.params.Line = { threshold: 25 };
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    let zDragging = false;
    let zPrevNdcX = 0;
    let zPrevNdcY = 0;

    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 2) return;
      if (!slicerActive || !slicerGroup) return;
      const pt = pointerXY(e);
      dragRay.setFromCamera(pt, camera);
      const hits = dragRay.intersectObject(slicerGroup.userData.handle, false);
      if (!hits.length) return;
      zDragging = true;
      zPrevNdcX = pt.x;
      zPrevNdcY = pt.y;
      controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    }, true);

    canvas.addEventListener('pointermove', e => {
      if (!zDragging) return;
      const pt = pointerXY(e);
      const dNdcX = pt.x - zPrevNdcX;
      const dNdcY = pt.y - zPrevNdcY;
      p0.set(0, 0, slicerZOffset).project(camera);
      p1.set(0, 0, slicerZOffset + 1).project(camera);
      const zdx = p1.x - p0.x;
      const zdy = p1.y - p0.y;
      const len2 = zdx * zdx + zdy * zdy;
      if (len2 > 1e-10) {
        slicerZOffset += (dNdcX * zdx + dNdcY * zdy) / len2;
        updateBasis();
      }
      zPrevNdcX = pt.x;
      zPrevNdcY = pt.y;
    });

    const endZDrag = e => {
      if (!zDragging) return;
      zDragging = false;
      controls.enabled = true;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    canvas.addEventListener('pointerup', endZDrag);
    canvas.addEventListener('pointercancel', endZDrag);

    canvas.addEventListener('contextmenu', e => {
      if (!slicerActive || !slicerGroup) return;
      const pt = pointerXY(e);
      dragRay.setFromCamera(pt, camera);
      const hits = dragRay.intersectObject(slicerGroup.userData.handle, false);
      if (hits.length) e.preventDefault();
    });
  })();

  slicerButton?.addEventListener('click', toggle);
  showAllButton?.addEventListener('click', toggleShowAllCells);
  syncButtons();

  return {
    disable,
    enable,
    getGroup: () => slicerGroup,
    getMaskState,
    isActive: () => slicerActive,
    isPointInsideWedge,
    isShowAllCells: () => showAllCells,
    toggle,
    toggleShowAllCells,
  };
}
