export function fmtMev(v) {
  if (!isFinite(v)) return 'ALL';
  const a = Math.abs(v);
  if (a >= 1000) return `${(v / 1000).toPrecision(3)} GeV`;
  if (a >= 1) return `${v.toFixed(1)} MeV`;
  return `${v.toFixed(3)} MeV`;
}

export function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function makeRelTime(t) {
  return function relTime(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 10) return t('just-now');
    if (s < 60) return `${Math.floor(s)}${t('s-ago')}`;
    if (s < 3600) return `${Math.floor(s / 60)}${t('m-ago')}`;
    return `${Math.floor(s / 3600)}${t('h-ago')}`;
  };
}
