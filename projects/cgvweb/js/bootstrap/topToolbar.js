// Wires the bottom-floating button row (info / ghost / beam / reset)
// plus the About overlay open/close handlers.
//
// Owns the `showInfo` state because the only consumer outside this module
// is the hover tooltip, which we expose via getShowInfo().

export function setupTopToolbar({
  resetCamera,
  clearOutline,
  hideTooltip,
  toggleAllGhosts,
  toggleBeam,
}) {
  let showInfo = true;

  const btnInfo = document.getElementById('btn-info');
  btnInfo.addEventListener('click', () => {
    showInfo = !showInfo;
    btnInfo.classList.toggle('on', showInfo);
    document
      .querySelector('#btn-info use')
      .setAttribute('href', showInfo ? '#i-eye' : '#i-eye-off');
    if (!showInfo) {
      clearOutline();
      hideTooltip();
    }
  });

  document.getElementById('btn-ghost').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAllGhosts();
  });

  document.getElementById('btn-beam').addEventListener('click', toggleBeam);
  document.getElementById('btn-reset').addEventListener('click', resetCamera);

  const aboutOverlay = document.getElementById('about-overlay');
  document.getElementById('btn-about').addEventListener('click', () => {
    aboutOverlay.classList.add('open');
  });
  document
    .getElementById('btn-about-close')
    .addEventListener('click', () => aboutOverlay.classList.remove('open'));
  aboutOverlay.addEventListener('click', (e) => {
    if (e.target === aboutOverlay) aboutOverlay.classList.remove('open');
  });

  return {
    getShowInfo: () => showInfo,
    aboutOverlay,
  };
}
