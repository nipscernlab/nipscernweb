// Inner Detector overlays (Tracks + Hits) — the per-event toggle pair that
// lives inside the #overlay-inner-detector-group block in index.html, just
// below the static-geometry tree.
//
// Self-contained: the parent gswitch bulk-flips both children to the inverse
// of their aggregate ON state, mirroring the .layer-row-parent pattern used
// inside #layers-tree.

import { getTracksVisible, setTracksVisible } from '../../visibility.js';
import { updateTrackAtlasIntersections } from '../../trackAtlasIntersections.js';
import { getHitsEnabled, setHitsEnabled, hideTrackHits } from '../../overlays/hitsOverlay.js';
import { markDirty } from '../../renderer.js';

export function setupInnerOverlay() {
  const btnTracks = document.getElementById('btn-tracks');
  const btnHits = document.getElementById('btn-hits');
  const btnInnerDetector = document.getElementById('btn-inner-detector');
  const innerDetectorGroup = document.getElementById('overlay-inner-detector-group');
  const innerDetectorRow = document.getElementById('overlay-inner-detector-row');

  function syncOverlayBtns() {
    btnTracks.classList.toggle('on', getTracksVisible());
    btnTracks.setAttribute('aria-checked', String(getTracksVisible()));
    btnHits.classList.toggle('on', getHitsEnabled());
    btnHits.setAttribute('aria-checked', String(getHitsEnabled()));
    const anyOn = getTracksVisible() || getHitsEnabled();
    btnInnerDetector.classList.toggle('on', anyOn);
    btnInnerDetector.setAttribute('aria-checked', String(anyOn));
  }

  btnTracks.addEventListener('click', (e) => {
    e.stopPropagation();
    setTracksVisible(!getTracksVisible());
    updateTrackAtlasIntersections();
    syncOverlayBtns();
    markDirty();
  });
  btnHits.addEventListener('click', (e) => {
    e.stopPropagation();
    setHitsEnabled(!getHitsEnabled());
    syncOverlayBtns();
    markDirty();
  });
  btnInnerDetector.addEventListener('click', (e) => {
    e.stopPropagation();
    const anyOn = getTracksVisible() || getHitsEnabled();
    const next = !anyOn;
    setTracksVisible(next);
    setHitsEnabled(next);
    if (!next) hideTrackHits();
    updateTrackAtlasIntersections();
    syncOverlayBtns();
    markDirty();
  });
  // Parent row click (anywhere except the gswitch) toggles expand/collapse.
  innerDetectorRow.addEventListener('click', (e) => {
    if (e.target.closest('.gswitch')) return;
    innerDetectorGroup.classList.toggle('expanded');
  });
  syncOverlayBtns();
}
