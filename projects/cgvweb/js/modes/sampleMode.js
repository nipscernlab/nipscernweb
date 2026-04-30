export function setupSampleMode({
  advanceProgress,
  endProgress,
  esc,
  processXml,
  setStatus,
  startProgress,
  t,
}) {
  let sampleLoaded = false;
  // Entries: { display, kind: 'test' | 'user', source: { url } | { file }, key }
  let entries = [];
  let currentKey = null;
  let seq = 0;

  const listEl = document.getElementById('sample-list');
  const msgEl = document.getElementById('sample-list-msg');
  const sec = document.getElementById('sample-sec');
  const addBtn = document.getElementById('btn-sample-add');
  const clearBtn = document.getElementById('btn-sample-clear');
  const fileInput = document.getElementById('sample-file-in');

  function syncClearVisibility() {
    if (!clearBtn) return;
    clearBtn.hidden = entries.length === 0;
  }

  function renderList() {
    listEl.innerHTML = '';
    entries.forEach((entry) => {
      const btn = document.createElement('div');
      btn.className = 'sample-item' + (entry.key === currentKey ? ' cur' : '');
      const iconHtml =
        entry.kind === 'test'
          ? `<svg class="ic sample-item-icon" style="width:11px;height:11px"><use href="#i-star"/></svg>`
          : `<i class="ti ti-file-code sample-item-icon" style="font-size:11px"></i>`;
      const subKey = entry.kind === 'test' ? 'sample-sub-test' : 'sample-sub-user';
      btn.innerHTML = `
        ${iconHtml}
        <div class="sample-item-info">
          <div class="sample-item-name">${esc(entry.display)}</div>
          <div class="sample-item-sub" data-i18n="${subKey}">${esc(t(subKey))}</div>
        </div>
        <button class="sample-item-x" data-tip="Remove from list" data-i18n-tip="tip-sample-remove">
          <svg class="ic" style="width:9px;height:9px;stroke-width:2.2"><use href="#i-x"/></svg>
        </button>`;
      btn.addEventListener('click', (ev) => {
        if (ev.target.closest('.sample-item-x')) return;
        load(entry, btn);
      });
      btn.querySelector('.sample-item-x').addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeEntry(entry.key);
      });
      listEl.appendChild(btn);
    });
    syncClearVisibility();
  }

  async function load(entry, rowEl) {
    document.querySelectorAll('.sample-item.cur').forEach((b) => b.classList.remove('cur'));
    rowEl.classList.add('cur');
    currentKey = entry.key;
    setStatus('Loading sample…');
    startProgress();
    advanceProgress('request');
    try {
      let xmlText;
      if (entry.source.url) {
        const res = await fetch(entry.source.url);
        advanceProgress('download');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        xmlText = await res.text();
      } else if (entry.source.file) {
        advanceProgress('acquire');
        xmlText = await entry.source.file.text();
      }
      advanceProgress('load');
      processXml(xmlText);
      endProgress();
    } catch (err) {
      endProgress();
      setStatus(`<span class="err">Error: ${esc(err.message)}</span>`);
      rowEl.classList.remove('cur');
    }
  }

  function removeEntry(key) {
    entries = entries.filter((e) => e.key !== key);
    if (currentKey === key) currentKey = null;
    renderList();
  }

  function clearAll() {
    entries = [];
    currentKey = null;
    renderList();
  }

  function addUserFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.xml')) return;
    const key = `u:${++seq}`;
    entries.unshift({
      display: file.name,
      kind: 'user',
      source: { file },
      key,
    });
    renderList();
  }

  async function loadSampleIndex() {
    if (sampleLoaded) return;
    msgEl.textContent = t('sample-loading');
    msgEl.hidden = false;

    try {
      const res = await fetch('./default_xml/index.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const names = await res.json();
      msgEl.hidden = true;
      if (!names.length) {
        msgEl.textContent = t('sample-empty');
        msgEl.hidden = false;
        return;
      }
      const testEntries = names.map((name) => ({
        display: `test_${name}`,
        kind: 'test',
        source: { url: `./default_xml/${encodeURIComponent(name)}` },
        key: `t:${name}`,
      }));
      entries = testEntries.concat(entries.filter((e) => e.kind === 'user'));
      renderList();
      sampleLoaded = true;
    } catch (_) {
      msgEl.textContent = t('sample-error');
      msgEl.hidden = false;
    }
  }

  addBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) addUserFile(f);
  });
  clearBtn.addEventListener('click', clearAll);

  ['dragenter', 'dragover'].forEach((ev) =>
    sec.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      sec.classList.add('dragover');
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    }),
  );
  ['dragleave', 'dragend'].forEach((ev) =>
    sec.addEventListener(ev, (e) => {
      if (e.target === sec) sec.classList.remove('dragover');
    }),
  );
  sec.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sec.classList.remove('dragover');
    const files = [...(e.dataTransfer?.files ?? [])].filter((f) =>
      f.name.toLowerCase().endsWith('.xml'),
    );
    files.forEach(addUserFile);
  });

  syncClearVisibility();

  return { loadSampleIndex };
}
