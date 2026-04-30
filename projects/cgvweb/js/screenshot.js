export function setupScreenshotControls({
  camera,
  canvas,
  markDirty,
  renderer,
  scene,
  slicer,
  t,
  getLastEventInfo,
  tooltip,
  tipCellEl,
  tipEEl,
}) {
  const shotOverlay = document.getElementById('shot-overlay');
  const shotSaveBtn = document.getElementById('btn-shot-save');
  const shotProgress = document.getElementById('shot-progress');
  const shotProgTxt = document.getElementById('shot-progress-txt');
  let shotW = 0;
  let shotH = 0;

  function pickDefaultShotRes() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const small =
      window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches ||
      window.innerWidth < 900;
    return coarse || small ? { w: 2560, h: 1440 } : { w: 10240, h: 5760 };
  }

  function applyDefaultShotRes() {
    const { w, h } = pickDefaultShotRes();
    const target = document.querySelector(`.shot-res[data-w="${w}"][data-h="${h}"]`);
    if (!target) return;
    document.querySelectorAll('.shot-res').forEach((btn) => btn.classList.remove('active'));
    target.classList.add('active');
    shotW = w;
    shotH = h;
    shotSaveBtn.disabled = false;
  }

  function openShotDialog() {
    shotOverlay.classList.add('open');
    applyDefaultShotRes();
  }

  function closeShotDialog() {
    shotOverlay.classList.remove('open');
    document.querySelectorAll('.shot-res').forEach((btn) => btn.classList.remove('active'));
    shotSaveBtn.disabled = true;
    shotProgress.classList.remove('running');
    shotProgTxt.textContent = '';
    shotW = 0;
    shotH = 0;
  }

  async function renderAndDownload(targetW, targetH) {
    const origW = renderer.domElement.width;
    const origH = renderer.domElement.height;
    const origPR = renderer.getPixelRatio();
    const origAspect = camera.aspect;
    const origFov = camera.fov;

    const tipVisible = !tooltip.hidden;
    let tipData = null;
    if (tipVisible) {
      tipData = {
        cellName: tipCellEl.textContent,
        energy: tipEEl.textContent,
        xFrac:
          ((parseFloat(tooltip.style.left) - canvas.getBoundingClientRect().left) / origW) * origPR,
        yFrac:
          ((parseFloat(tooltip.style.top) - canvas.getBoundingClientRect().top) / origH) * origPR,
      };
    }

    const targetAspect = targetW / targetH;
    const origTanHalf = Math.tan((origFov * Math.PI) / 180 / 2);
    const newTanHalf = origTanHalf * Math.max(1, origAspect / targetAspect);
    const newFov = (2 * Math.atan(newTanHalf) * 180) / Math.PI;
    renderer.setPixelRatio(1);
    renderer.setSize(targetW, targetH, false);
    camera.aspect = targetAspect;
    camera.fov = newFov;
    camera.updateProjectionMatrix();

    const transparentBg = !!document.getElementById('shot-transparent')?.checked;
    const savedBg = scene.background;
    if (transparentBg) {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    }

    const slicerGroup = slicer.getGroup();
    const slicerVisSaved = slicerGroup ? slicerGroup.visible : null;
    if (slicerGroup) slicerGroup.visible = false;
    renderer.render(scene, camera);
    if (slicerGroup && slicerVisSaved !== null) slicerGroup.visible = slicerVisSaved;

    const gl = renderer.getContext();
    const pixels = new Uint8Array(targetW * targetH * 4);
    gl.readPixels(0, 0, targetW, targetH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const ctx = offscreen.getContext('2d');
    const imgData = ctx.createImageData(targetW, targetH);
    for (let y = 0; y < targetH; y++) {
      const srcRow = (targetH - 1 - y) * targetW * 4;
      imgData.data.set(pixels.subarray(srcRow, srcRow + targetW * 4), y * targetW * 4);
    }
    ctx.putImageData(imgData, 0, 0);

    if (tipData) {
      const scale = (targetW / origW) * origPR;
      const tx = tipData.xFrac * targetW;
      const ty = tipData.yFrac * targetH;
      const pad = 14 * scale;
      const radius = 7 * scale;
      const fs = 14 * scale;
      const lh = 20 * scale;

      ctx.save();
      ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
      const nameW = ctx.measureText(tipData.cellName).width;
      ctx.font = `400 ${fs * 0.84}px Inter, system-ui, sans-serif`;
      const eKeyW = ctx.measureText('ENERGY').width;
      ctx.font = `500 ${fs}px "JetBrains Mono", monospace`;
      const eValW = ctx.measureText(tipData.energy).width;
      const boxW = Math.max(nameW, eKeyW + eValW + pad * 2.5) + pad * 2;
      const boxH = lh * 2 + pad * 2 + 8 * scale;

      const bx = Math.min(tx, targetW - boxW - 4 * scale);
      const by = Math.min(ty, targetH - boxH - 4 * scale);

      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, radius);
      ctx.fillStyle = 'rgba(2,11,28,0.95)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(22,72,168,0.55)';
      ctx.lineWidth = 1 * scale;
      ctx.stroke();

      ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = '#d6eaff';
      ctx.fillText(tipData.cellName, bx + pad, by + pad + fs);

      ctx.strokeStyle = 'rgba(22,72,168,0.35)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(bx + pad, by + pad + lh + 4 * scale);
      ctx.lineTo(bx + boxW - pad, by + pad + lh + 4 * scale);
      ctx.stroke();

      const ey = by + pad + lh + 4 * scale + lh * 0.9;
      ctx.font = `400 ${fs * 0.84}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = '#2c5270';
      ctx.fillText('ENERGY', bx + pad, ey);
      ctx.font = `500 ${fs}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#d6eaff';
      ctx.textAlign = 'right';
      ctx.fillText(tipData.energy, bx + boxW - pad, ey);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    const showCollision = !!document.getElementById('shot-show-collision')?.checked;
    const lastEventInfo = getLastEventInfo();
    if (showCollision && lastEventInfo) {
      const fields = [
        ['Date/Time', lastEventInfo.dateTime],
        ['Run', lastEventInfo.runNumber],
        ['Event', lastEventInfo.eventNumber],
        ['Lumi Block', lastEventInfo.lumiBlock],
        ['Version', lastEventInfo.version],
      ].filter(([, value]) => value);

      if (fields.length) {
        const scale = (targetW / origW) * origPR;
        const fs = 13 * scale;
        const lh = 18 * scale;
        const colGap = 8 * scale;
        const margin = 10 * scale;

        ctx.save();
        ctx.fillStyle = '#66ccff';
        ctx.font = `400 ${fs * 0.78}px monospace`;
        const keyW = Math.max(...fields.map(([k]) => ctx.measureText(k.toUpperCase()).width));

        const x = margin;
        let y = margin;
        for (const [k, v] of fields) {
          ctx.font = `400 ${fs * 0.78}px monospace`;
          ctx.globalAlpha = 0.25;
          ctx.fillText(k.toUpperCase(), x, y + lh * 0.82);
          ctx.font = `500 ${fs}px monospace`;
          ctx.globalAlpha = 0.45;
          ctx.fillText(v, x + keyW + colGap, y + lh * 0.82);
          y += lh;
        }
        ctx.restore();
      }
    }

    if (transparentBg) {
      scene.background = savedBg;
      renderer.setClearColor(0x000000, 1);
    }
    renderer.setPixelRatio(origPR);
    renderer.setSize(origW / origPR, origH / origPR, false);
    camera.aspect = origAspect;
    camera.fov = origFov;
    camera.updateProjectionMatrix();
    markDirty();

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const link = document.createElement('a');
    link.download = `CGVWEB_${targetW}x${targetH}_${ts}.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
  }

  document.querySelectorAll('.shot-res').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shot-res').forEach((node) => node.classList.remove('active'));
      btn.classList.add('active');
      shotW = parseInt(btn.dataset.w, 10);
      shotH = parseInt(btn.dataset.h, 10);
      shotSaveBtn.disabled = false;
    });
  });

  document.getElementById('btn-shot').addEventListener('click', openShotDialog);
  document.getElementById('btn-shot-cancel').addEventListener('click', closeShotDialog);
  shotOverlay.addEventListener('click', (e) => {
    if (e.target === shotOverlay) closeShotDialog();
  });

  shotSaveBtn.addEventListener('click', async () => {
    if (!shotW || !shotH) return;
    shotSaveBtn.disabled = true;
    shotProgTxt.textContent = t('shot-rendering').replace('{w}', shotW).replace('{h}', shotH);
    shotProgress.classList.add('running');
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      await renderAndDownload(shotW, shotH);
      shotProgTxt.textContent = t('shot-done');
      await new Promise((resolve) => setTimeout(resolve, 900));
      closeShotDialog();
    } catch (err) {
      shotProgTxt.textContent = t('shot-error').replace('{msg}', err.message);
      shotSaveBtn.disabled = false;
    }
  });

  return { openShotDialog, closeShotDialog };
}
