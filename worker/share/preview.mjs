// ---------------------------------------------------------------------------
// Local share-image preview / validation (Phase 1).
//
//   cd worker/share && node preview.mjs [slug ...]
//   (or: npm run preview -- <slug>)
//
// Renders every format × language for the given slugs (default: first 3 posts)
// to tools/share-out/ using the SAME resvg build and SVG template the Worker
// serves, so what you see here is what the edge will produce. WebP covers are
// decoded to PNG with sharp before embedding (resvg cannot read WebP).
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import sharp from 'sharp';
import { buildShareSvg, FORMATS } from './src/template.js';
import { resolveShareMeta, findPost, availableLangs } from './src/posts.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'tools', 'share-out');

const FONT_DM = fs.readFileSync(path.join(HERE, 'fonts', 'DMSerifDisplay-Regular.ttf'));
const FONT_INTER = fs.readFileSync(path.join(HERE, 'fonts', 'Inter-Regular.ttf'));

await initWasm(fs.readFileSync(path.join(HERE, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm')));

/** Fetch a cover (usually WebP) and return a cover-cropped PNG data URI. */
async function coverToPng(url, w, h) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const png = await sharp(buf)
      .resize({ width: w, height: h, fit: 'cover', position: 'attention' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return 'data:image/png;base64,' + png.toString('base64');
  } catch (e) {
    console.warn(`  ! cover failed (${url}): ${e.message}`);
    return null;
  }
}

function renderSvgToPng(svg) {
  const resvg = new Resvg(svg, {
    background: '#070a12',
    font: { fontBuffers: [FONT_DM, FONT_INTER], loadSystemFonts: false, defaultFontFamily: 'Inter' },
  });
  return resvg.render().asPng();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const news = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'news.json'), 'utf8'));
  let featured = null;
  try { featured = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'news-featured.json'), 'utf8')); } catch {}

  const args = process.argv.slice(2);
  const targets = args.length ? args : news.slice(0, 3).map(p => p.slug || p.id);

  for (const slug of targets) {
    const post = findPost(news, featured, slug);
    if (!post) { console.warn(`- ${slug}: not found`); continue; }
    console.log(`\n# ${slug}  (category=${post.category})`);
    const langs = availableLangs(post);

    const coverCache = new Map();
    const coverFor = async (w, h) => {
      const key = `${w}x${h}`;
      if (!coverCache.has(key)) coverCache.set(key, await coverToPng(post.image, w, h));
      return coverCache.get(key);
    };

    for (const [format, def] of Object.entries(FORMATS)) {
      const cover = await coverFor(def.w, def.h);
      const variants = def.text ? langs : ['raw'];
      for (const lang of variants) {
        const meta = resolveShareMeta(post, def.text ? lang : 'en');
        const svg = buildShareSvg({ format, coverDataUri: cover, ...meta });
        const png = renderSvgToPng(svg);
        const name = def.text ? `${slug}__${format}-${lang}.png` : `${slug}__${format}.png`;
        fs.writeFileSync(path.join(OUT, name), png);
        console.log(`  ✓ ${name.padEnd(52)} ${def.w}×${def.h}  ${(png.length / 1024).toFixed(0)} KB`);
      }
    }
  }
  console.log(`\nDone → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
