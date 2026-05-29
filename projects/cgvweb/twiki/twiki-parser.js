// Minimal Foswiki / TWiki markup parser for local preview.
// Covers the subset used by the CGV Web TWiki (headings, lists, tables,
// bold/italic/mono, verbatim, [[WikiLink]] and [[url][label]], inline HTML).
// Not exhaustive — good enough to render the real .twiki files locally
// the same way the CERN ATLAS TWiki will render them server-side.

export function twikiToHtml(src, opts = {}) {
  const { linkTopic = (t) => `#/${t}` } = opts;
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Strip %META:...% lines entirely.
  const stripMeta = (s) => s.replace(/^%META:[A-Z]+\{[^}]*\}%\s*$/gm, "");

  // Inline pass: runs on a single line or on inline segments.
  function inline(s) {
    // Mask only tags whose attributes/href must survive inline processing
    // (<a>, <img>, <br>). <em>, <strong>, <code>, <span> pass through so
    // wiki-links and emphasis inside them are still resolved.
    const masks = [];
    s = s.replace(/<a\b[^>]*>[\s\S]*?<\/a>|<img\b[^>]*\/?>|<br\b[^>]*\/?>/gi, (m) => {
      masks.push(m); return `\u0000M${masks.length - 1}\u0000`;
    });

    // =mono= and ==bold-mono==
    s = s.replace(/==([^=\s](?:[^=]*[^=\s])?)==/g, "<code><b>$1</b></code>");
    s = s.replace(/(^|[\s(\[{])=([^=\s](?:[^=]*[^=\s])?)=(?=[\s)\]}.,;:!?]|$)/g,
      '$1<code>$2</code>');

    // [[url][label]] and [[WikiTopic][label]] and [[WikiTopic]]
    s = s.replace(/\[\[([^\]|\[]+)\]\[([^\]]+)\]\]/g, (_, target, label) => {
      if (/^https?:\/\//i.test(target) || target.startsWith("mailto:"))
        return `<a href="${target}" target="_blank" rel="noopener">${label}</a>`;
      return `<a href="${linkTopic(target)}">${label}</a>`;
    });
    s = s.replace(/\[\[([^\]|\[]+)\]\]/g, (_, target) => {
      if (/^https?:\/\//i.test(target))
        return `<a href="${target}" target="_blank" rel="noopener">${target}</a>`;
      return `<a href="${linkTopic(target)}">${target}</a>`;
    });

    // *bold* (word-boundary)
    s = s.replace(/(^|[\s(\[{>])\*([^\s*][^*\n]*[^\s*]|\S)\*(?=[\s)\]}.,;:!?<]|$)/g,
      '$1<strong>$2</strong>');

    // _italic_
    s = s.replace(/(^|[\s(\[{>])_([^\s_][^_\n]*[^\s_]|\S)_(?=[\s)\]}.,;:!?<]|$)/g,
      '$1<em>$2</em>');

    // %BR%
    s = s.replace(/%BR%/g, "<br/>");
    // %TOC% handled at block level
    // %DATE% -> today (ISO)
    s = s.replace(/%DATE%/g, new Date().toISOString().slice(0, 10));

    // Restore masks
    s = s.replace(/\u0000M(\d+)\u0000/g, (_, n) => masks[+n]);
    return s;
  }

  src = stripMeta(src);
  const srcLines = src.replace(/\r\n?/g, "\n").split("\n");
  const toc = [];

  while (i < srcLines.length) {
    const line = srcLines[i];

    // <verbatim>...</verbatim>
    const vm = line.match(/^<verbatim(?:\s+class="([^"]+)")?>\s*$/);
    if (vm) {
      const cls = vm[1] ? ` class="lang-${vm[1]}"` : "";
      const buf = [];
      i++;
      while (i < srcLines.length && !/^<\/verbatim>\s*$/.test(srcLines[i])) {
        buf.push(srcLines[i]); i++;
      }
      i++;
      out.push(`<pre><code${cls}>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // Headings: ---+ ... ---++++++  with optional "!!" = no TOC
    const hm = line.match(/^---(\+{1,6})(!!)?\s*(.+)$/);
    if (hm) {
      const level = hm[1].length;
      const noToc = !!hm[2];
      const raw = hm[3].trim();
      const slug = "h-" + raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!noToc && level >= 2) toc.push({ level, text: raw, slug });
      out.push(`<h${level} id="${slug}">${inline(raw)}</h${level}>`);
      i++;
      continue;
    }

    // %TOC%
    if (/^%TOC%\s*$/.test(line)) {
      out.push('<!--TOC-->');
      i++;
      continue;
    }

    // Table: lines starting with "|"
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < srcLines.length && /^\|/.test(srcLines[i])) {
        const cells = srcLines[i].split("|").slice(1, -1).map((c) => c.trim());
        rows.push(cells);
        i++;
      }
      const head = rows[0].every((c) => /^\*.*\*$/.test(c));
      let html = "<table>";
      rows.forEach((r, idx) => {
        const tag = head && idx === 0 ? "th" : "td";
        html += "<tr>" + r.map((c) => {
          const stripped = c.replace(/^\*(.*)\*$/, "$1");
          return `<${tag}>${inline(stripped)}</${tag}>`;
        }).join("") + "</tr>";
      });
      html += "</table>";
      out.push(html);
      continue;
    }

    // Lists: "   * item" (3 spaces per level), also "   1 item"
    if (/^ {3,}(\*|\d+)\s+/.test(line)) {
      const stack = []; // {type:'ul'|'ol', depth}
      const items = [];
      while (i < srcLines.length && /^ {3,}(\*|\d+)\s+/.test(srcLines[i])) {
        const m = srcLines[i].match(/^( {3,})(\*|\d+)\s+(.*)$/);
        const depth = Math.floor(m[1].length / 3);
        const type = m[2] === "*" ? "ul" : "ol";
        items.push({ depth, type, text: m[3] });
        i++;
      }
      let html = "";
      let prevDepth = 0;
      const openStack = [];
      for (const it of items) {
        while (openStack.length < it.depth) {
          html += `<${it.type}>`; openStack.push(it.type);
        }
        while (openStack.length > it.depth) {
          html += `</${openStack.pop()}>`;
        }
        html += `<li>${inline(it.text)}</li>`;
      }
      while (openStack.length) html += `</${openStack.pop()}>`;
      out.push(html);
      continue;
    }

    // Definition list: "$ *term*: body"
    if (/^\$\s+\*[^*]+\*\s*:/.test(line)) {
      let html = "<dl>";
      while (i < srcLines.length && /^\$\s+\*[^*]+\*\s*:/.test(srcLines[i])) {
        const m = srcLines[i].match(/^\$\s+\*([^*]+)\*\s*:\s*(.*)$/);
        html += `<dt>${inline(m[1])}</dt><dd>${inline(m[2])}</dd>`;
        i++;
      }
      html += "</dl>";
      out.push(html);
      continue;
    }

    // Blank line -> paragraph break
    if (line.trim() === "") {
      out.push("");
      i++;
      continue;
    }

    // Raw HTML block (lines starting with <)
    if (/^\s*<(?!\/?(strong|em|code|a|img|br|span)\b)/i.test(line)) {
      out.push(inline(line));
      i++;
      continue;
    }

    // Default: paragraph — accumulate contiguous non-empty, non-structural lines
    const para = [line];
    i++;
    while (i < srcLines.length) {
      const nxt = srcLines[i];
      if (
        nxt.trim() === "" ||
        /^---\+/.test(nxt) ||
        /^\|/.test(nxt) ||
        /^ {3,}(\*|\d+)\s+/.test(nxt) ||
        /^<verbatim/.test(nxt) ||
        /^%TOC%/.test(nxt) ||
        /^\$\s+\*/.test(nxt)
      ) break;
      para.push(nxt);
      i++;
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  // Build TOC HTML
  let tocHtml = "";
  if (toc.length) {
    tocHtml = '<nav class="twiki-toc"><h4>On this page</h4><ul>';
    let lastLevel = 2;
    const openUl = [];
    for (const t of toc) {
      while (lastLevel < t.level) { tocHtml += "<ul>"; openUl.push("ul"); lastLevel++; }
      while (lastLevel > t.level) { tocHtml += "</ul>"; openUl.pop(); lastLevel--; }
      tocHtml += `<li><a href="#${t.slug}">${t.text}</a></li>`;
    }
    while (openUl.length) { tocHtml += "</ul>"; openUl.pop(); }
    tocHtml += "</ul></nav>";
  }

  return out.join("\n").replace("<!--TOC-->", tocHtml);
}
