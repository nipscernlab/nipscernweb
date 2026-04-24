export function setupLiveMode({
  LivePoller,
  advanceProgress,
  bumpReq,
  endProgress,
  esc,
  onFallbackToLocal,
  processXml,
  relTime,
  startProgress,
  t,
}) {
  let currentEventId = null;
  const poller = LivePoller ? new LivePoller() : null;

  function setLiveDot(state) {
    const dot = document.getElementById('ldot');
    const txt = document.getElementById('live-txt');
    dot.className = 'ldot';
    switch (state) {
      case 'polling':
        dot.classList.add('ok', 'pulse');
        txt.textContent = t('live-polling');
        break;
      case 'same':
        dot.classList.add('ok');
        txt.textContent = t('live-same');
        break;
      case 'downloading':
        dot.classList.add('dl', 'pulse');
        txt.textContent = t('live-fetching');
        bumpReq();
        startProgress();
        advanceProgress('download');
        break;
      case 'error':
        dot.classList.add('err');
        txt.textContent = t('live-error');
        break;
      default:
        txt.textContent = t('live-stopped');
    }
  }

  function renderEventList() {
    const list = poller ? poller.getList() : [];
    const listEl = document.getElementById('evt-list');
    const emptyEl = document.getElementById('live-empty');
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = list.length > 0;

    let marked = false;
    list.slice(0, 100).forEach((entry, idx) => {
      const row = document.createElement('div');
      const isCurrent = !marked && entry.id === currentEventId;
      if (isCurrent) marked = true;
      row.className = 'erow' + (isCurrent ? ' cur' : '');
      const displayName = /\.xml$/i.test(entry.name) ? entry.name : entry.name + '.xml';
      row.innerHTML = `
        <div class="einfo">
          <div class="ename">${esc(displayName)}</div>
          <div class="etime" data-ts="${entry.timestamp}">${relTime(entry.timestamp)}</div>
        </div>
        <button class="edl"><svg class="ic" style="width:11px;height:11px"><use href="#i-dl"/></svg></button>`;
      row.querySelector('.einfo').addEventListener('click', () => {
        currentEventId = entry.id;
        processXml(entry.text);
        renderEventList();
      });
      row.querySelector('.edl').addEventListener('click', ev => {
        ev.stopPropagation();
        poller.download(idx);
      });
      listEl.appendChild(row);
    });
  }

  function refreshRelativeTimes() {
    for (const el of document.querySelectorAll('.etime[data-ts]')) {
      el.textContent = relTime(+el.dataset.ts);
    }
  }

  function start() {
    if (!poller) return;
    poller.start();
  }

  function stop() {
    if (!poller) return;
    poller.stop();
    document.getElementById('ibtn-stop').hidden = true;
    document.getElementById('ibtn-play').hidden = false;
    setLiveDot('stopped');
  }

  function loadFirstAvailableEvent() {
    if (!poller) return;
    const list = poller.getList();
    if (!list.length) return;
    currentEventId = list[0].id;
    processXml(list[0].text);
    renderEventList();
  }

  document.getElementById('ibtn-play').addEventListener('click', () => {
    if (!poller) return;
    poller.start();
    document.getElementById('ibtn-play').hidden = true;
    document.getElementById('ibtn-stop').hidden = false;
  });

  document.getElementById('ibtn-stop').addEventListener('click', stop);
  window.setInterval(refreshRelativeTimes, 30_000);

  if (poller) {
    poller.addEventListener('newxml', ({ detail: { entry } }) => {
      startProgress();
      advanceProgress('load');
      currentEventId = entry.id;
      processXml(entry.text);
      renderEventList();
      bumpReq();
      endProgress();
    });
    poller.addEventListener('listupdate', renderEventList);
    poller.addEventListener('status', ({ detail: { state } }) => setLiveDot(state));
    poller.addEventListener('error', ({ detail }) => {
      console.warn('[LivePoller]', detail.message);
    });
    poller.init().then(() => {
      renderEventList();
    }).catch(() => {});
  } else {
    onFallbackToLocal?.();
  }

  return {
    hasPoller() {
      return !!poller;
    },
    loadFirstAvailableEvent,
    renderEventList,
    start,
    stop,
  };
}
