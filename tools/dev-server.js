/*
 * NIPS-CERN local dev server (Node, zero dependencies).
 *
 * Previews the site exactly as GitHub Pages serves it, keeping clean
 * (extensionless) URLs: no .html ever appears in the URL. It falls back
 * from /news/post to /news/post.html and from a directory to its
 * index.html, so local preview matches production without changing any link.
 *
 *   npm run dev            # http://127.0.0.1:3000 (auto-falls back if busy)
 *   npm run dev -- 8080    # pick a specific port
 *
 * Why this exists: VS Code Live Preview (and `python -m http.server`) serve
 * files literally, so a clean link like /news/post?id=... returns
 * "File not found" locally even though it works on GitHub Pages.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function resolveFile(fsPath) {
  let st;
  try {
    st = fs.statSync(fsPath);
  } catch (e) {
    // Not found: clean-URL fallback (/news/post -> /news/post.html).
    if (!path.extname(fsPath) && fs.existsSync(fsPath + '.html')) return fsPath + '.html';
    return null;
  }
  if (st.isDirectory()) {
    const idx = path.join(fsPath, 'index.html');
    return fs.existsSync(idx) ? idx : null;
  }
  return fsPath;
}

function handler(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    pathname = '/';
  }
  // Resolve under ROOT and block path traversal.
  const fsPath = path.normalize(path.join(ROOT, pathname));
  if (fsPath !== ROOT && !fsPath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }
  const file = resolveFile(fsPath);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>Not found: ' + pathname + '</p>');
    return;
  }
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

function start(candidates, i) {
  if (i >= candidates.length) {
    console.error('Could not bind a port. Try a specific free one: npm run dev -- 8081');
    process.exit(1);
  }
  const port = candidates[i];
  const server = http.createServer(handler);
  server.once('error', () => start(candidates, i + 1));
  server.listen(port, '127.0.0.1', () => {
    const actual = server.address().port;
    console.log('NIPS-CERN dev server (clean URLs, like GitHub Pages)');
    console.log('  serving: ' + ROOT);
    console.log('  open:    http://127.0.0.1:' + actual + '/');
    if (actual !== candidates[0]) {
      console.log('  (port ' + candidates[0] + ' was unavailable; using ' + actual + ')');
    }
    console.log('  Ctrl+C to stop.');
  });
}

// Some ports (e.g. 3000) may be held by VS Code Live Preview or reserved by
// Windows (Hyper-V/WSL excluded ranges). Try the requested one, then fall back.
const requested = parseInt(process.argv[2], 10) || 3000;
const candidates = [requested, 8080, 8000, 5500, 4000, 0].filter((p, idx, a) => a.indexOf(p) === idx);
start(candidates, 0);
