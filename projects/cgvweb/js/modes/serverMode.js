import { dateGroup } from '../utils.js';

const MAX_ENTRIES = 100;
const REFRESH_MS = 5000;
const REMOTE_API = '/api/xml';
const HAS_FSA = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

function fmtTime(ts) {
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function walkDirectoryHandle(dirHandle, out, prefix = '') {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      if (!entry.name.toLowerCase().endsWith('.xml')) continue;
      try {
        const f = await entry.getFile();
        out.push({ file: f, rel: prefix + entry.name });
      } catch (_) {}
    } else if (entry.kind === 'directory') {
      await walkDirectoryHandle(entry, out, prefix + entry.name + '/');
    }
  }
}

async function walkDataTransferEntry(entry, out, prefix = '') {
  if (!entry) return;
  if (entry.isFile) {
    const f = await new Promise((res) => entry.file(res, () => res(null)));
    if (f && f.name.toLowerCase().endsWith('.xml')) {
      out.push({ file: f, rel: prefix + f.name });
    }
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let batch;
    do {
      batch = await new Promise((res) => reader.readEntries(res, () => res([])));
      for (const child of batch) {
        await walkDataTransferEntry(child, out, prefix + entry.name + '/');
      }
    } while (batch.length);
  }
}

export function setupServerMode({
  advanceProgress,
  endProgress,
  esc,
  processXml,
  setStatus,
  startProgress,
  t,
}) {
  let entries = [];
  let currentKey = null;
  let lastAutoLoadedKey = null;
  let folderHandle = null;
  let inputFiles = null;
  let refreshTimer = null;
  let isActive = false;
  let isPaused = false;
  let canPoll = false;
  let remoteMode = false;
  let remoteFolderPath = null;

  const sec = document.getElementById('live-server-sec');
  const listEl = document.getElementById('server-list');
  const emptyEl = document.getElementById('server-empty');
  const refreshBtn = document.getElementById('server-refresh-btn');
  const pickBtn = document.getElementById('btn-server-pick');
  const folderInput = document.getElementById('server-folder-in');
  const remoteBar = document.getElementById('server-remote-bar');
  const remoteFolderBtn = document.getElementById('server-folder-cur');
  const remoteFolderText = document.getElementById('server-folder-cur-text');
  const remoteEditRow = document.getElementById('server-folder-edit');
  const remoteEditInput = document.getElementById('server-folder-input');
  const remoteApplyBtn = document.getElementById('server-folder-apply');
  const remoteCancelBtn = document.getElementById('server-folder-cancel');
  const remoteErrorEl = document.getElementById('server-folder-error');

  function keyFor(f, rel) {
    return `${rel || f.name}|${f.size}|${f.lastModified}`;
  }

  function syncRefreshBtn() {
    if (!refreshBtn) return;
    refreshBtn.classList.remove('state-active', 'state-paused');
    if (!canPoll) {
      refreshBtn.hidden = true;
      return;
    }
    refreshBtn.hidden = false;
    if (isPaused) {
      refreshBtn.classList.add('state-paused');
      refreshBtn.dataset.i18nTip = 'tip-poll-play';
      refreshBtn.dataset.tip = t('tip-poll-play');
    } else {
      refreshBtn.classList.add('state-active');
      refreshBtn.dataset.i18nTip = 'tip-poll-stop';
      refreshBtn.dataset.tip = t('tip-poll-stop');
    }
  }

  function flashRefresh() {
    if (!refreshBtn || !canPoll || isPaused) return;
    refreshBtn.classList.remove('spin');
    void refreshBtn.offsetWidth;
    refreshBtn.classList.add('spin');
    clearTimeout(flashRefresh._t);
    flashRefresh._t = setTimeout(() => {
      refreshBtn.classList.remove('spin');
    }, 750);
  }

  function renderList() {
    emptyEl.hidden = entries.length > 0;
    listEl.hidden = entries.length === 0;
    listEl.innerHTML = '';
    let lastGroupKey = null;
    entries.forEach((e, idx) => {
      const group = dateGroup(e.file.lastModified, t);
      if (group.key !== lastGroupKey) {
        lastGroupKey = group.key;
        const sep = document.createElement('div');
        sep.className = 'date-sep';
        sep.textContent = group.label;
        listEl.appendChild(sep);
      }
      const row = document.createElement('div');
      row.className = 'srow' + (e.key === currentKey ? ' cur' : '');
      const shortName = e.rel.split('/').pop();
      row.innerHTML = `
        <div class="srow-info">
          <div class="srow-name">${esc(shortName)}</div>
          <div class="srow-time">#${idx + 1} · ${fmtTime(e.file.lastModified)}</div>
        </div>
        <button class="srow-dl" data-tip="Download XML" data-i18n-tip="tip-server-dl">
          <svg class="ic" style="width:11px;height:11px"><use href="#i-dl"/></svg>
        </button>`;
      row.querySelector('.srow-info').addEventListener('click', async () => {
        currentKey = e.key;
        listEl.querySelectorAll('.srow.cur').forEach((r) => r.classList.remove('cur'));
        row.classList.add('cur');
        await readAndProcess(e.file);
      });
      row.querySelector('.srow-dl').addEventListener('click', (ev) => {
        ev.stopPropagation();
        downloadFile(e.file, shortName);
      });
      listEl.appendChild(row);
    });
  }

  async function readAndProcess(file) {
    setStatus('Reading file…');
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

  function downloadFile(file, name) {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function updateEntries(rawItems) {
    const sorted = rawItems
      .slice()
      .sort((a, b) => {
        const dt = (b.file.lastModified || 0) - (a.file.lastModified || 0);
        if (dt !== 0) return dt;
        const ds = (b.file.size || 0) - (a.file.size || 0);
        if (ds !== 0) return ds;
        return (a.rel || '').localeCompare(b.rel || '');
      })
      .slice(0, MAX_ENTRIES)
      .map((it) => ({ ...it, key: keyFor(it.file, it.rel) }));
    const sameLen = sorted.length === entries.length;
    const sameKeys = sameLen && sorted.every((e, i) => e.key === entries[i].key);
    if (!sameKeys) {
      entries = sorted;
      renderList();
    }
    maybeAutoLoadTop();
  }

  function maybeAutoLoadTop() {
    if (!entries.length) return;
    const top = entries[0];
    if (top.key === lastAutoLoadedKey) return;
    lastAutoLoadedKey = top.key;
    currentKey = top.key;
    listEl.querySelectorAll('.srow.cur').forEach((r) => r.classList.remove('cur'));
    const firstRow = listEl.querySelector('.srow');
    if (firstRow) firstRow.classList.add('cur');
    readAndProcess(top.file);
  }

  async function reloadFromHandle() {
    if (!folderHandle) return;
    try {
      const out = [];
      await walkDirectoryHandle(folderHandle, out);
      updateEntries(out);
    } catch (err) {
      console.warn('[serverMode] reload failed:', err);
    }
  }

  function reloadFromInput() {
    if (!inputFiles) return;
    const out = [];
    for (const f of inputFiles) {
      if (f.name.toLowerCase().endsWith('.xml')) {
        out.push({ file: f, rel: f.webkitRelativePath || f.name });
      }
    }
    updateEntries(out);
  }

  function makeRemoteFile(meta) {
    const url = `${REMOTE_API}/file/${encodeURIComponent(meta.name)}`;
    return {
      name: meta.name,
      size: meta.size,
      lastModified: meta.mtime,
      async text() {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      },
    };
  }

  async function reloadFromRemote() {
    try {
      const r = await fetch(`${REMOTE_API}/list`, { cache: 'no-store' });
      if (!r.ok) {
        if (r.status === 503) {
          entries = [];
          renderList();
        }
        return;
      }
      const list = await r.json();
      const out = list.map((it) => ({ file: makeRemoteFile(it), rel: it.name }));
      updateEntries(out);
    } catch (err) {
      console.warn('[serverMode] remote reload failed:', err);
    }
  }

  async function refreshTick() {
    if (!isActive || isPaused) return;
    flashRefresh();
    if (remoteMode) await reloadFromRemote();
    else if (folderHandle) await reloadFromHandle();
    scheduleRefresh();
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    if (!isActive || isPaused) return;
    if (!remoteMode && !folderHandle) return;
    refreshTimer = setTimeout(refreshTick, REFRESH_MS);
  }

  function clearRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  function showFallbackWarning() {
    const main = esc(t('server-no-watch'));
    const tip = HAS_FSA ? '' : ` <span class="warn-tip">${esc(t('server-try-chromium'))}</span>`;
    setStatus(`<span class="warn">${main}${tip}</span>`);
  }

  async function pickFolder() {
    if (window.showDirectoryPicker) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        folderHandle = handle;
        inputFiles = null;
        canPoll = true;
        isPaused = false;
        lastAutoLoadedKey = null;
        syncRefreshBtn();
        await reloadFromHandle();
        scheduleRefresh();
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          console.warn('[serverMode] directory picker failed, falling back:', err);
          folderInput.click();
        }
      }
    } else {
      folderInput.click();
    }
  }

  pickBtn.addEventListener('click', pickFolder);

  folderInput.addEventListener('change', (e) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    folderHandle = null;
    inputFiles = files;
    canPoll = false;
    isPaused = false;
    lastAutoLoadedKey = null;
    syncRefreshBtn();
    reloadFromInput();
    clearRefresh();
    showFallbackWarning();
  });

  refreshBtn?.addEventListener('click', () => {
    if (!canPoll) return;
    if (isPaused) {
      isPaused = false;
      syncRefreshBtn();
      refreshTick();
    } else {
      isPaused = true;
      clearRefresh();
      syncRefreshBtn();
    }
  });

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
  sec.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    sec.classList.remove('dragover');
    const items = e.dataTransfer?.items ? [...e.dataTransfer.items] : [];
    const out = [];

    const entriesList = items
      .filter((it) => it.kind === 'file')
      .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
      .filter(Boolean);

    if (entriesList.length) {
      for (const en of entriesList) await walkDataTransferEntry(en, out);
    } else if (e.dataTransfer?.files?.length) {
      for (const f of e.dataTransfer.files) {
        if (f.name.toLowerCase().endsWith('.xml')) {
          out.push({ file: f, rel: f.webkitRelativePath || f.name });
        }
      }
    }

    if (!out.length) return;
    folderHandle = null;
    inputFiles = out.map((o) => o.file);
    canPoll = false;
    isPaused = false;
    lastAutoLoadedKey = null;
    syncRefreshBtn();
    updateEntries(out);
    clearRefresh();
    showFallbackWarning();
  });

  function setActive(b) {
    isActive = !!b;
    if (isActive) {
      scheduleRefresh();
    } else {
      clearRefresh();
    }
  }

  // ── Remote mode (server-side folder via /api/xml/*) ───────────────────
  function updateRemoteFolderDisplay() {
    if (!remoteFolderText) return;
    remoteFolderText.textContent = remoteFolderPath || t('server-folder-not-set');
    if (remoteFolderBtn) remoteFolderBtn.title = remoteFolderPath || '';
  }

  function showRemoteError(msg) {
    if (!remoteErrorEl) return;
    if (!msg) {
      remoteErrorEl.hidden = true;
      remoteErrorEl.textContent = '';
      return;
    }
    remoteErrorEl.hidden = false;
    remoteErrorEl.textContent = msg;
  }

  function openFolderEdit() {
    if (!remoteEditRow) return;
    showRemoteError('');
    remoteEditInput.value = remoteFolderPath || '';
    remoteEditRow.hidden = false;
    if (remoteBar) remoteBar.hidden = true;
    setTimeout(() => remoteEditInput.focus(), 0);
  }

  function closeFolderEdit() {
    if (!remoteEditRow) return;
    remoteEditRow.hidden = true;
    if (remoteBar) remoteBar.hidden = false;
    showRemoteError('');
  }

  async function applyFolderEdit() {
    const path = (remoteEditInput?.value || '').trim();
    if (!path) return;
    try {
      const r = await fetch(`${REMOTE_API}/set-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      remoteFolderPath = data.path || path;
      updateRemoteFolderDisplay();
      lastAutoLoadedKey = null;
      currentKey = null;
      closeFolderEdit();
      await reloadFromRemote();
    } catch (err) {
      showRemoteError(err.message || String(err));
    }
  }

  async function tryEnterRemoteMode() {
    try {
      const r = await fetch(`${REMOTE_API}/folder`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!r.ok) return false;
      // Guard against static hosts (Cloudflare Pages, etc.) that return a 200
      // HTML 404 page on unknown routes — only accept a JSON body with `path`.
      const ct = r.headers.get('content-type') || '';
      if (!ct.toLowerCase().includes('json')) return false;
      const data = await r.json();
      if (!data || typeof data !== 'object' || !('path' in data)) return false;
      remoteMode = true;
      remoteFolderPath = data.path || null;
      // Hide the local picker; show the remote bar.
      if (pickBtn) pickBtn.hidden = true;
      if (remoteBar) remoteBar.hidden = false;
      updateRemoteFolderDisplay();
      canPoll = true;
      isPaused = false;
      syncRefreshBtn();
      await reloadFromRemote();
      return true;
    } catch (_) {
      return false;
    }
  }

  if (remoteFolderBtn) remoteFolderBtn.addEventListener('click', openFolderEdit);
  if (remoteApplyBtn) remoteApplyBtn.addEventListener('click', applyFolderEdit);
  if (remoteCancelBtn) remoteCancelBtn.addEventListener('click', closeFolderEdit);
  if (remoteEditInput) {
    remoteEditInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyFolderEdit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFolderEdit();
      }
    });
  }

  syncRefreshBtn();
  tryEnterRemoteMode();

  return {
    setActive,
    hasEntries: () => entries.length > 0,
  };
}
