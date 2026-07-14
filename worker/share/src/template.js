// ---------------------------------------------------------------------------
// Share-image SVG template — the single source of truth for every format.
//
// Pure and renderer-agnostic: it returns an SVG *string*. The Cloudflare Worker
// rasterises it with resvg-wasm; the local preview (tools/share-preview.mjs)
// feeds it the same resvg build. The cover is passed in already decoded to a
// PNG/JPEG data URI (resvg cannot decode WebP), or null for a text-only card.
// ---------------------------------------------------------------------------

/** Every generated format. `text: false` is the clean, mark-free "raw" cover. */
export const FORMATS = {
  og:       { w: 1200, h: 630,  text: true,  label: 'Landscape (LinkedIn/OG/X)' },
  square:   { w: 1080, h: 1080, text: true,  label: 'Square (Instagram feed)' },
  portrait: { w: 1080, h: 1350, text: true,  label: 'Portrait (Instagram 4:5)' },
  story:    { w: 1080, h: 1920, text: true,  label: 'Story/Reels (9:16)' },
  raw:      { w: 1200, h: 630,  text: false, label: 'Raw cover (landscape, no text)' },
  rawstory: { w: 1080, h: 1920, text: false, label: 'Raw cover (story, no text)' },
  rawsquare:{ w: 1080, h: 1080, text: false, label: 'Raw cover (square, no text)' },
};

// Category → accent colour, mirroring the site's news badges.
const CATEGORY_COLOR = {
  milestone:   '#a78bfa',
  award:       '#fbbf24',
  event:       '#34d399',
  publication: '#60a5fa',
};
const BRAND = '#7cb5ff';
const BRAND_DEEP = '#5b9cf6';

/** Escape text for safe inclusion in XML/SVG. */
export function xml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Word-wrap `text` to at most `maxLines` lines that fit `maxWidth` px at the
 * given font size. Char widths are approximated (DM Serif Display averages
 * ~0.5em); good enough for headline layout. The last line is ellipsised when
 * the text overflows. Returns an array of lines.
 */
export function wrapTitle(text, maxWidth, fontSize, maxLines, charFactor = 0.5) {
  const maxChars = Math.max(6, Math.floor(maxWidth / (fontSize * charFactor)));
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  // Ellipsis if we dropped content
  const used = lines.join(' ').length;
  if (used < String(text || '').trim().length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && last.length > maxChars - 1) last = last.slice(0, -1);
    lines[lines.length - 1] = last.replace(/[\s.,;:]+$/, '') + '…';
  }
  return lines;
}

/** The NIPS⚛CERN wordmark + domain, bottom-left. `scale` tunes it per format. */
function brandmark(x, y, scale) {
  const fs = Math.round(38 * scale);
  const domFs = Math.round(20 * scale);
  const atom = Math.round(fs * 0.42);
  const gap = Math.round(fs * 0.30);
  // "NIPS" + atom + "CERN"
  const nipsW = fs * 0.62 * 4; // rough advance of "NIPS"
  const ax = x + nipsW + gap;
  const ay = y - fs * 0.34;
  return `
    <g>
      <text x="${x}" y="${y}" font-family="Inter" font-weight="700" font-size="${fs}" fill="#ffffff" letter-spacing="0.5">NIPS</text>
      <g transform="translate(${ax},${ay})">
        <circle cx="0" cy="0" r="${atom * 0.16}" fill="${BRAND}"/>
        <g fill="none" stroke="${BRAND}" stroke-width="${Math.max(2, atom * 0.09)}">
          <ellipse cx="0" cy="0" rx="${atom * 0.5}" ry="${atom * 0.2}"/>
          <ellipse cx="0" cy="0" rx="${atom * 0.5}" ry="${atom * 0.2}" transform="rotate(60)"/>
          <ellipse cx="0" cy="0" rx="${atom * 0.5}" ry="${atom * 0.2}" transform="rotate(120)"/>
        </g>
      </g>
      <text x="${ax + atom * 0.7}" y="${y}" font-family="Inter" font-weight="700" font-size="${fs}" fill="#ffffff" letter-spacing="0.5">CERN</text>
      <text x="${x}" y="${y + domFs * 1.7}" font-family="Inter" font-weight="500" font-size="${domFs}" fill="${BRAND}" letter-spacing="1">nipscern.com</text>
    </g>`;
}

/**
 * Build the share SVG for one format.
 * @param {object} o
 * @param {'og'|'square'|'portrait'|'story'|'raw'|'rawstory'|'rawsquare'} o.format
 * @param {string} o.title       Headline in the chosen language.
 * @param {string} o.category    Post category (drives the accent colour).
 * @param {string} o.dateLabel   Formatted date string (e.g. "10 Jul 2026").
 * @param {string|null} o.coverDataUri  PNG/JPEG data URI, or null.
 * @returns {string} SVG document
 */
export function buildShareSvg(o) {
  const fmt = FORMATS[o.format] || FORMATS.og;
  const { w, h } = fmt;
  const accent = CATEGORY_COLOR[o.category] || BRAND;

  // Cover (cover/crop) or a branded gradient fallback.
  const cover = o.coverDataUri
    ? `<image href="${o.coverDataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#bgFallback)"/>`;

  // Raw variant: just the cover, no overlay/marks.
  if (!fmt.text) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <radialGradient id="bgFallback" cx="50%" cy="38%" r="80%">
          <stop offset="0%" stop-color="#12203a"/><stop offset="100%" stop-color="#070a12"/>
        </radialGradient>
      </defs>
      ${cover}
    </svg>`;
  }

  // Layout metrics scale with width.
  const scale = w / 1200;
  const pad = Math.round(64 * scale);
  const titleFs = Math.round((o.format === 'og' ? 66 : 82) * scale);
  const lineH = Math.round(titleFs * 1.14);
  const maxLines = o.format === 'og' ? 4 : (o.format === 'story' ? 6 : 5);
  const lines = wrapTitle(o.title, w - pad * 2, titleFs, maxLines);

  // Title block sits above the brandmark, anchored to the bottom.
  const brandY = h - pad;
  const titleBottom = brandY - Math.round(96 * scale);
  const titleTop = titleBottom - (lines.length - 1) * lineH;
  const titleTspans = lines.map((ln, i) =>
    `<tspan x="${pad}" y="${titleTop + i * lineH}">${xml(ln)}</tspan>`).join('');

  // Category badge + date, top-left.
  const badgeFs = Math.round(24 * scale);
  const badgeText = (o.category || '').toUpperCase();
  const badgePadX = Math.round(18 * scale);
  const badgePadY = Math.round(10 * scale);
  const badgeW = Math.round(badgeText.length * badgeFs * 0.62) + badgePadX * 2;
  const badgeH = Math.round(badgeFs * 1.7);
  const badgeY = pad;
  const dateFs = Math.round(22 * scale);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <radialGradient id="bgFallback" cx="50%" cy="38%" r="80%">
        <stop offset="0%" stop-color="#12203a"/><stop offset="100%" stop-color="#070a12"/>
      </radialGradient>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="#05070d" stop-opacity="0.55"/>
        <stop offset="42%" stop-color="#05070d" stop-opacity="0.15"/>
        <stop offset="72%" stop-color="#05070d" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="#05070d" stop-opacity="0.95"/>
      </linearGradient>
    </defs>

    ${cover}
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#scrim)"/>

    <!-- category badge -->
    <g>
      <rect x="${pad}" y="${badgeY}" rx="${badgeH / 2}" ry="${badgeH / 2}" width="${badgeW}" height="${badgeH}" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-opacity="0.55" stroke-width="${Math.max(1, 1.5 * scale)}"/>
      <text x="${pad + badgePadX}" y="${badgeY + badgeH - badgePadY - Math.round(2 * scale)}" font-family="Inter" font-weight="700" font-size="${badgeFs}" fill="${accent}" letter-spacing="1.5">${xml(badgeText)}</text>
      ${o.dateLabel ? `<text x="${pad + badgeW + Math.round(18 * scale)}" y="${badgeY + badgeH - badgePadY - Math.round(2 * scale)}" font-family="Inter" font-weight="500" font-size="${dateFs}" fill="#c9d4e6" letter-spacing="0.5">${xml(o.dateLabel)}</text>` : ''}
    </g>

    <!-- accent rule above the title -->
    <rect x="${pad}" y="${titleTop - Math.round(titleFs * 0.9)}" width="${Math.round(70 * scale)}" height="${Math.max(3, Math.round(5 * scale))}" rx="2" fill="${BRAND_DEEP}"/>

    <!-- headline -->
    <text font-family="DM Serif Display" font-weight="400" font-size="${titleFs}" fill="#ffffff" style="line-height:${lineH}">${titleTspans}</text>

    ${brandmark(pad, brandY, scale)}
  </svg>`;
}
