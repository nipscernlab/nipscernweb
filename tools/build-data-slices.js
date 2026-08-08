/* Cut the big JSON files down to what a page actually reads.
   ------------------------------------------------------------------
   Three files were being downloaded whole and used in pieces:

     data/i18n.json          170 KB, four languages, one of them shown
     data/publications.json  246 KB, 147 papers, the home lists 4
     data/news.json           94 KB, 13 posts with their full body text,
                              the home lists 3 and shows only the excerpt

   That is half a megabyte to render a heading, three headlines and four
   citations. This writes the slices; the pages read the slice and fall back to
   the whole file if it is missing, so nothing here can take a page down.

   The source files stay the ones a human edits. Run this after touching any of
   them; data-guard.yml fails the build if the slices are stale.

   Usage: node tools/build-data-slices.js
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

/* Written with two spaces and a trailing newline so a diff of a slice is
   readable, and so the guard compares like with like. */
function write(rel, obj) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const before = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
  const text = JSON.stringify(obj, null, 2) + '\n';
  if (before === text) return { rel, bytes: text.length, changed: false };
  fs.writeFileSync(full, text);
  return { rel, bytes: text.length, changed: true };
}

const out = [];

/* ---- one file per language ---- */
const i18n = read('data/i18n.json');
for (const lang of Object.keys(i18n)) {
  out.push(write('data/i18n/' + lang + '.json', { [lang]: i18n[lang] }));
}

/* ---- the home's slice of the news ----
   Everything the two lanes render and nothing else. The body of a post is the
   bulk of news.json and the home never shows a word of it. */
const news = read('data/news.json');
const NEWS_ON_HOME = 3;
out.push(write('data/home-news.json', news.slice(0, NEWS_ON_HOME).map((p) => ({
  id: p.id,
  slug: p.slug,
  category: p.category,
  date: p.date,
  title: p.title,
  excerpt: p.excerpt,
  image: p.image,
  translations: p.translations
    ? Object.fromEntries(Object.entries(p.translations).map(
        ([l, t]) => [l, { title: t.title, excerpt: t.excerpt }]))
    : undefined,
}))));

/* ---- the home's slice of the publications ----
   Papers only, no theses, newest first. Array#sort has been stable since
   ES2019, so papers sharing a year keep the order the file gives them, which is
   the same rule home.js applies. Kept in step with it on purpose. */
const pubs = read('data/publications.json');
const PAPERS_ON_HOME = 4;
out.push(write('data/home-papers.json', pubs
  .filter((p) => p.type === 'journal' || p.type === 'conference')
  .slice()
  .sort((a, b) => Number(b.year) - Number(a.year))
  .slice(0, PAPERS_ON_HOME)
  .map((p) => ({ id: p.id, year: p.year, type: p.type, journal: p.journal, title: p.title, authors: p.authors }))));

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
for (const o of out) console.log((o.changed ? 'escrito ' : 'inalterado ') + o.rel.padEnd(26) + kb(o.bytes));

const antes = ['data/i18n.json', 'data/news.json', 'data/publications.json']
  .reduce((a, f) => a + fs.statSync(path.join(ROOT, f)).size, 0);
const depois = out.filter((o) => !o.rel.startsWith('data/i18n/') || o.rel.endsWith('/en.json'))
  .reduce((a, o) => a + o.bytes, 0);
console.log('');
console.log('a home baixava ' + kb(antes) + ', agora baixa ' + kb(depois) + ' (um idioma)');
