// ---------------------------------------------------------------------------
// Rendering core for the Worker: SVG (from template.js) → PNG via resvg-wasm.
// Covers arrive as WebP (the site's format), which resvg cannot decode, so we
// decode WebP → re-encode PNG with @jsquash before embedding. PNG/JPEG covers
// pass straight through. All wasm is imported statically (Workers bundle it)
// and initialised once per isolate.
// ---------------------------------------------------------------------------
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import decodeWebp, { init as initWebpDec } from '@jsquash/webp/decode.js';
import encodePng, { init as initPngEnc } from '@jsquash/png/encode.js';

import RESVG_WASM from '@resvg/resvg-wasm/index_bg.wasm';
import WEBP_DEC_WASM from '@jsquash/webp/codec/dec/webp_dec.wasm';
import PNG_ENC_WASM from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';

import DM_TTF from '../fonts/DMSerifDisplay-Regular.ttf';
import INTER_TTF from '../fonts/Inter-Regular.ttf';

import { buildShareSvg } from './template.js';

let ready = null;
/** Initialise every wasm module once; subsequent calls await the same promise. */
function ensureReady() {
  if (!ready) {
    ready = Promise.all([
      initWasm(RESVG_WASM),
      initWebpDec(WEBP_DEC_WASM),
      initPngEnc(PNG_ENC_WASM),
    ]);
  }
  return ready;
}

/** Fetch a cover and return a resvg-embeddable data URI (PNG/JPEG), or null. */
async function coverDataUri(coverUrl) {
  if (!coverUrl) return null;
  try {
    const res = await fetch(coverUrl, { cf: { cacheEverything: true, cacheTtl: 86400 } });
    if (!res.ok) throw new Error(`cover HTTP ${res.status}`);
    const type = (res.headers.get('content-type') || '').toLowerCase();
    const buf = await res.arrayBuffer();

    if (type.includes('webp') || /\.webp(\?|$)/i.test(coverUrl)) {
      const imageData = await decodeWebp(buf);            // {data,width,height}
      const png = await encodePng(imageData);             // ArrayBuffer
      return 'data:image/png;base64,' + base64(new Uint8Array(png));
    }
    // resvg reads PNG/JPEG/GIF natively.
    const mime = type.includes('png') ? 'image/png'
      : (type.includes('jpeg') || type.includes('jpg')) ? 'image/jpeg'
      : 'image/png';
    return `data:${mime};base64,` + base64(new Uint8Array(buf));
  } catch (e) {
    console.log('coverDataUri failed:', e && e.message);
    return null; // template falls back to a branded gradient
  }
}

/** Base64-encode bytes without blowing the call stack on large buffers. */
function base64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * Render one share image.
 * @param {object} args
 * @param {string} args.format   FORMATS key.
 * @param {object} args.meta     resolveShareMeta() output (title, category, dateLabel).
 * @param {boolean} args.withText  Whether this format carries text/marks.
 * @returns {Promise<Uint8Array>} PNG bytes
 */
export async function renderShare({ format, meta, withText, width }) {
  await ensureReady();
  const cover = await coverDataUri(meta.coverUrl);
  const svg = buildShareSvg({ format, coverDataUri: cover, ...meta });
  const opts = {
    background: '#070a12',
    font: {
      fontBuffers: [new Uint8Array(DM_TTF), new Uint8Array(INTER_TTF)],
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
  };
  // Optional downscale (used for lightweight thumbnails), clamped for safety.
  if (width) {
    opts.fitTo = { mode: 'width', value: Math.max(80, Math.min(2000, width | 0)) };
  }
  const resvg = new Resvg(svg, opts);
  return resvg.render().asPng();
}
