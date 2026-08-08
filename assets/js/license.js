/**
 * NIPS-CERN — the licence page
 *
 * There is one licence and it lives in LICENSE.md at the root of the
 * repository, which is the file the licence guard in CI checks against
 * LICENSE-BASE.md. This page fetches that file and renders it. Nothing about
 * the licence is written twice, so the page cannot drift from the thing it is
 * showing, and there is no build step to forget to run.
 *
 * The renderer below is deliberately small. LICENSE.md uses four constructs and
 * only four, which is checked before rendering rather than assumed: a level-one
 * heading, level-two headings, dash lists, and bold runs. Anything else in the
 * file is shown as a plain paragraph rather than being silently dropped, which
 * is the right failure for a legal document: too plain is recoverable, missing
 * is not.
 */

const ROOT = new URL('../../', import.meta.url).href;

/** The four inline escapes that matter, in the order that keeps them correct. */
function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Bold runs, after escaping, so a ** inside the text cannot open a tag. */
function inline(s) {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function render(md) {
  const out = [];
  let list = null;
  let para = [];

  /* A paragraph is a run of lines up to a blank one, which is what markdown
     says it is and, more to the point, what this file needs: two of its bold
     runs open on one line and close on the next, and rendering line by line
     left a pair of asterisks showing in the middle of a legal clause. */
  const flushPara = () => {
    if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; }
  };
  const flushList = () => {
    if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
  };
  const flush = () => { flushPara(); flushList(); };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();

    if (!line) { flush(); continue; }

    if (line.startsWith('## ')) {
      flush();
      out.push('<h2>' + inline(line.slice(3)) + '</h2>');
    } else if (line.startsWith('# ')) {
      flush();
      out.push('<h1 class="lic-h1">' + inline(line.slice(2)) + '</h1>');
    } else if (/^[-*] /.test(line)) {
      flushPara();
      if (!list) list = [];
      list.push('<li>' + inline(line.slice(2)) + '</li>');
    } else {
      flushList();
      para.push(line);
    }
  }
  flush();
  return out.join('');
}

async function main() {
  const host = document.getElementById('lic-body');
  if (!host) return;

  try {
    const res = await fetch(ROOT + 'LICENSE.md', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const md = await res.text();
    if (!md.trim()) throw new Error('ficheiro vazio');

    host.innerHTML = render(md);
    host.removeAttribute('aria-busy');
  } catch (e) {
    /* The fallback is the file itself, not an apology. Somebody who came here
       to read the licence should leave with a way to read it. */
    console.warn('[license] could not load LICENSE.md:', e);
    host.removeAttribute('aria-busy');
    host.innerHTML =
      '<p>The licence could not be loaded on this page. It is in the repository, ' +
      'in full, at <a class="text-link" href="https://github.com/nipscernlab/nipscernweb/blob/main/LICENSE.md" ' +
      'target="_blank" rel="noopener">LICENSE.md</a>.</p>';
  }
}

main();
