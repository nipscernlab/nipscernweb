// @ts-check

/**
 * Format an energy value in MeV, promoting to GeV at ≥ 1 GeV.
 * ±Infinity and NaN are rendered as "ALL" (meaning "no threshold").
 *
 * @param {number} v  Energy in MeV.
 * @returns {string}
 */
export function fmtMev(v) {
  if (!isFinite(v)) return 'ALL';
  const a = Math.abs(v);
  if (a >= 1000) return `${(v / 1000).toPrecision(3)} GeV`;
  if (a >= 1) return `${v.toFixed(1)} MeV`;
  return `${v.toFixed(3)} MeV`;
}

/**
 * HTML-escape &, <, > for safe insertion into innerHTML. Null/undefined
 * become the empty string; other values are stringified first.
 *
 * The `&` replacement runs first so subsequent escapes aren't double-encoded.
 *
 * @param {unknown} s
 * @returns {string}
 */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Translator callback — maps an i18n key to a localized string.
 * @typedef {(key: string) => string} Translator
 */

/**
 * Build a relative-time formatter bound to a translator. The returned
 * function takes a past Unix-ms timestamp and returns "just now" for
 * anything under 10s, then Ns/Nm/Nh buckets using the translator's
 * suffix strings.
 *
 * @param {Translator} t
 * @returns {(ts: number) => string}
 */
export function makeRelTime(t) {
  return function relTime(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 10) return t('just-now');
    if (s < 60) return `${Math.floor(s)}${t('s-ago')}`;
    if (s < 3600) return `${Math.floor(s / 60)}${t('m-ago')}`;
    return `${Math.floor(s / 3600)}${t('h-ago')}`;
  };
}

/**
 * Classify a past timestamp into a date-group label ("today", "yesterday",
 * "this-week", or an absolute date like "2026-04-18"). Day boundaries use the
 * local-timezone midnight. Returns {key, label} where key is stable across
 * items in the same group and label is the display string.
 *
 * @param {number} ts  Unix ms.
 * @param {Translator} t
 * @returns {{ key: string, label: string }}
 */
export function dateGroup(ts, t) {
  if (!Number.isFinite(ts)) return { key: 'unknown', label: t('date-group-earlier') };
  const now = new Date();
  const item = new Date(ts);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const itemDay = startOfDay(item);
  const msPerDay = 86_400_000;
  const daysAgo = Math.round((today - itemDay) / msPerDay);

  if (daysAgo <= 0) return { key: 'today', label: t('date-group-today') };
  if (daysAgo === 1) return { key: 'yesterday', label: t('date-group-yesterday') };
  if (daysAgo < 7) return { key: 'this-week', label: t('date-group-this-week') };
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${item.getFullYear()}-${pad(item.getMonth() + 1)}-${pad(item.getDate())}`;
  return { key: iso, label: iso };
}
