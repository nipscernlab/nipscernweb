// Live/sample mode tab + web/server sub-tab wiring.
//
// Owns: isLive, liveSub, poller, sampleMode, serverMode, liveMode.
// Persistence: cgv-tab and cgv-live-sub localStorage keys.
//
// Exposes onSceneAndWasmReady() so the boot code can ask the live tab to
// start polling once both prerequisites are loaded.

import { setupLiveMode } from '../liveMode.js';
import { setupServerMode } from '../serverMode.js';
import { setupSampleMode } from '../sampleMode.js';
import { bumpReq } from '../loading.js';
import { esc, makeRelTime } from '../utils.js';

const TAB_KEY = 'cgv-tab';
const SUB_KEY = 'cgv-live-sub';

export function setupModeWiring({
  LivePoller,
  processXml,
  setStatus,
  startProgress,
  advanceProgress,
  endProgress,
  t,
}) {
  let isLive = true;
  let liveSub = 'web';
  let poller = null;
  let _ready = false;

  const relTime = makeRelTime(t);

  const sampleMode = setupSampleMode({
    advanceProgress,
    endProgress,
    esc,
    processXml,
    setStatus,
    startProgress,
    t,
  });

  const serverMode = setupServerMode({
    advanceProgress,
    endProgress,
    esc,
    processXml,
    setStatus,
    startProgress,
    t,
  });

  function setLiveSub(sub) {
    liveSub = sub === 'server' ? 'server' : 'web';
    document.getElementById('btn-live-web').classList.toggle('on', liveSub === 'web');
    document.getElementById('btn-live-server').classList.toggle('on', liveSub === 'server');
    document.getElementById('live-web-sec').hidden = liveSub !== 'web';
    document.getElementById('live-server-sec').hidden = liveSub !== 'server';

    if (isLive) {
      if (liveSub === 'web') {
        serverMode.setActive(false);
        if (poller && _ready) poller.start();
      } else {
        if (poller) poller.stop();
        serverMode.setActive(true);
      }
    }
    try {
      localStorage.setItem(SUB_KEY, liveSub);
    } catch (_) {}
  }

  function setMode(mode) {
    isLive = mode === 'live';
    document.getElementById('btn-live').classList.toggle('on', mode === 'live');
    document.getElementById('btn-sample').classList.toggle('on', mode === 'sample');
    document.getElementById('live-sec').hidden = mode !== 'live';
    document.getElementById('sample-sec').hidden = mode !== 'sample';
    if (mode === 'live') {
      setLiveSub(liveSub);
    } else {
      if (poller) poller.stop();
      serverMode.setActive(false);
      if (mode === 'sample') sampleMode.loadSampleIndex();
    }
    try {
      localStorage.setItem(TAB_KEY, mode);
    } catch (_) {}
  }

  document.getElementById('btn-live').addEventListener('click', () => {
    if (!isLive) setMode('live');
  });
  document.getElementById('btn-sample').addEventListener('click', () => {
    if (document.getElementById('sample-sec').hidden) setMode('sample');
  });
  document.getElementById('btn-live-web').addEventListener('click', () => {
    if (liveSub !== 'web') setLiveSub('web');
  });
  document.getElementById('btn-live-server').addEventListener('click', () => {
    if (liveSub !== 'server') setLiveSub('server');
  });

  const liveMode = setupLiveMode({
    LivePoller,
    advanceProgress,
    bumpReq,
    endProgress,
    esc,
    onFallbackToLocal: () => setLiveSub('server'),
    processXml,
    relTime,
    startProgress,
    t,
  });
  poller = liveMode.hasPoller()
    ? { start: () => liveMode.start(), stop: () => liveMode.stop() }
    : null;

  (function restoreTabs() {
    let savedTab = null;
    let savedSub = null;
    try {
      savedTab = localStorage.getItem(TAB_KEY);
      savedSub = localStorage.getItem(SUB_KEY);
    } catch (_) {}
    if (savedSub === 'server' || savedSub === 'web') liveSub = savedSub;
    if (savedTab === 'sample') {
      setMode('sample');
    } else {
      setLiveSub(liveSub);
    }
  })();

  return {
    onSceneAndWasmReady() {
      _ready = true;
      if (isLive && liveSub === 'web' && poller) {
        poller.start();
        liveMode.loadFirstAvailableEvent();
      }
    },
  };
}
