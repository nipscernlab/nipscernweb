export function setupLocalMode({
  advanceProgress,
  endProgress,
  esc,
  fmtSize,
  processXml,
  setStatus,
  startProgress,
  activateLocalTab,
}) {
  let localFiles = [];
  let carouselActive = false;
  let carouselTimer = null;
  let carouselIdx = 0;
  let carouselDelaySec = 5;

  function stopCarousel() {
    carouselActive = false;
    clearTimeout(carouselTimer);
    document.getElementById('btn-carousel-stop').hidden = true;
    document.getElementById('btn-carousel-play').hidden = false;
  }

  async function readLocalFile(file, statusText = 'Reading file...') {
    setStatus(statusText);
    startProgress('local');
    advanceProgress('acquire');
    try {
      const text = await file.text();
      advanceProgress('load');
      processXml(text);
      endProgress();
    } catch (err) {
      endProgress();
      setStatus(`<span class="err">Read error: ${esc(err.message)}</span>`);
    }
  }

  async function runCarouselStep() {
    if (!carouselActive || !localFiles.length) return;
    carouselIdx = carouselIdx % localFiles.length;
    document.querySelectorAll('#local-list .lrow').forEach((r, i) =>
      r.classList.toggle('cur', i === carouselIdx));
    document.getElementById('carousel-status').textContent =
      `${carouselIdx + 1} / ${localFiles.length}`;
    const file = localFiles[carouselIdx];
    try {
      processXml(await file.text());
    } catch (e) {
      console.warn('Carousel error:', e.message);
    }
    carouselIdx++;
    carouselTimer = setTimeout(runCarouselStep, carouselDelaySec * 1000);
  }

  function renderLocalList() {
    const listEl = document.getElementById('local-list');
    const carBar = document.getElementById('carousel-bar');
    listEl.hidden = !localFiles.length;
    listEl.innerHTML = '';
    if (carBar) carBar.hidden = localFiles.length < 2;
    carouselIdx = 0;
    stopCarousel();

    localFiles.forEach(file => {
      const row = document.createElement('div');
      row.className = 'lrow';
      row.innerHTML = `<span class="lrow-name">${esc(file.name)}</span><span class="lrow-size">${fmtSize(file.size)}</span>`;
      row.addEventListener('click', async () => {
        document.querySelectorAll('#local-list .lrow.cur').forEach(r => r.classList.remove('cur'));
        row.classList.add('cur');
        await readLocalFile(file);
      });
      listEl.appendChild(row);
    });
  }

  document.getElementById('file-folder-in').addEventListener('change', e => {
    const files = [...(e.target.files ?? [])].filter(f => f.name.toLowerCase().endsWith('.xml'));
    e.target.value = '';
    if (!files.length) return;
    localFiles = files.sort((a, b) => a.name.localeCompare(b.name));
    renderLocalList();
  });

  document.querySelectorAll('.cdstep').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cdstep').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      carouselDelaySec = parseInt(btn.dataset.s, 10);
    });
  });

  document.getElementById('btn-carousel-play').addEventListener('click', () => {
    if (!localFiles.length) return;
    carouselActive = true;
    document.getElementById('btn-carousel-play').hidden = true;
    document.getElementById('btn-carousel-stop').hidden = false;
    runCarouselStep();
  });
  document.getElementById('btn-carousel-stop').addEventListener('click', stopCarousel);

  document.getElementById('file-in').addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (f) {
      setStatus('Parsing...');
      startProgress('local');
      advanceProgress('acquire');
      try {
        processXml(await f.text());
        advanceProgress('load');
        endProgress();
      } catch (err) {
        endProgress();
        setStatus(`<span class="err">${esc(err.message)}</span>`);
      }
    }
    e.target.value = '';
  });

  (function initLocalDnD() {
    const sec = document.getElementById('local-sec');
    if (!sec) return;
    ['dragenter', 'dragover'].forEach(ev => sec.addEventListener(ev, e => {
      e.preventDefault();
      e.stopPropagation();
      sec.classList.add('dragover');
      e.dataTransfer.dropEffect = 'copy';
    }));
    ['dragleave', 'dragend'].forEach(ev => sec.addEventListener(ev, e => {
      if (e.target === sec) sec.classList.remove('dragover');
    }));
    sec.addEventListener('drop', async e => {
      e.preventDefault();
      e.stopPropagation();
      sec.classList.remove('dragover');
      const items = e.dataTransfer?.files ? [...e.dataTransfer.files] : [];
      const xmls = items.filter(f => f.name.toLowerCase().endsWith('.xml'));
      if (!xmls.length) return;
      if (xmls.length === 1) {
        await readLocalFile(xmls[0]);
      } else {
        localFiles = xmls.sort((a, b) => a.name.localeCompare(b.name));
        renderLocalList();
      }
      activateLocalTab?.();
    });
  })();

  return {
    renderLocalList,
    stopCarousel,
  };
}
