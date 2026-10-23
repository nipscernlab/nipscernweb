/* ============================================================
   The search engine: text in, the right page out.

   One module for three readers. The browser runs it to answer a query,
   tools/build-search.js runs it to write the index, and tools/test-search.js
   runs it to hold the answers to account. All three normalise text through the
   same function, so a word indexed at build time and the same word typed into
   the box can never disagree about what they are.

   What it is built to do, and why each part is there:

   - Any of the four languages, with or without accents. "calorimetro",
     "calorímetro", "calorimètre" and "Kalorimeter" are four spellings of one
     word to a reader, so normalisation folds case, diacritics and the three
     Norwegian letters before anything else looks at the text.
   - Spelling mistakes. A query word of four letters or more may be one edit
     away from the word in the page (a typo, a swapped pair, a missing letter),
     and from seven letters two edits. Shorter words must be right: at three
     letters one edit reaches half the dictionary.
   - The same idea in another language. A small glossary of the group's own
     vocabulary (energy, calorimeter, neural network, thesis, ...) maps every
     language's word onto one concept, so a query in Norwegian finds a paper
     written in Portuguese.
   - Never a wall of results. One letter returns nothing. Two letters match
     whole words only, never prefixes or near misses. Every word of the query
     has to be found in the result, falling back to most of them only when no
     page has all of them. Anything scoring under a third of the best result
     is dropped, and the box shows at most eight.
   ============================================================ */

/* Letters that NFD does not decompose. The Norwegian three are the reason this
   exists: ø and æ are letters of their own, not an o or an a with a mark. */
const FOLD = { 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'đ': 'd', 'ł': 'l', 'ı': 'i' };

export function normalize(text) {
  return String(text || '').toLowerCase()
    .replace(/[øæœßđłı]/g, (c) => FOLD[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenize(text) {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

/* Words that carry no meaning of their own, in the four languages. They are
   left out of the index and out of the query, so "the team at CERN" searches
   for team and CERN. A query made only of them finds nothing, on purpose. */
const STOP = new Set((
  // en
  'a an and are as at be by for from has have in into is it its of on or that the their this to was were will with ' +
  // pt
  'o os as um uma uns umas de do da dos das em no na nos nas por para com sem e ou que se ao aos como mais mas sobre entre ' +
  'sua seu suas seus pelo pela pelos pelas foi sao ser este esta estes estas esse essa isso ' +
  // fr
  'le la les un une des du d l et en au aux pour par sur dans avec sans qui est sont ce cette ces son sa ses leur leurs ne pas plus ' +
  // no
  'og i pa av til med et ei den det er som fra om har var ikke seg sin sitt sine'
).split(' '));

export const isStopword = (t) => STOP.has(t);

/* The glossary. One line per concept, every spelling of it in any of the four
   languages. Matching runs on normalised text, so the accents here are only for
   whoever reads the list. Multi-word entries are matched as phrases. Keep it to
   words this site actually uses: a concept that matches everything is worse
   than none. */
const GLOSSARY = [
  ['energy', 'energia', 'énergie', 'energi'],
  ['calorimeter', 'calorímetro', 'calorimètre', 'kalorimeter', 'calorimetry', 'calorimetria', 'calorimétrie', 'kalorimetri', 'calorimeters', 'calorímetros'],
  ['reconstruction', 'reconstrução', 'rekonstruksjon', 'reconstruir', 'reconstruct'],
  ['signal', 'sinal', 'sinais', 'signals', 'signaux', 'signaler'],
  ['signal processing', 'processamento de sinais', 'traitement du signal', 'traitement de signal', 'signalbehandling'],
  ['processing', 'processamento', 'traitement', 'behandling', 'prosessering'],
  ['filter', 'filtro', 'filtre', 'filters', 'filtros', 'filtres', 'filtering', 'filtragem', 'filtrage', 'filtrering'],
  ['optimal filter', 'filtro ótimo', 'filtre optimal', 'optimalt filter', 'filtragem ótima', 'optimal filtering'],
  ['matched filter', 'filtro casado', 'filtre adapté', 'tilpasset filter'],
  ['detector', 'detector', 'détecteur', 'detektor', 'detectors', 'detectores', 'détecteurs', 'detektorer'],
  ['neural network', 'rede neural', 'redes neurais', 'neural networks', 'réseau de neurones', 'réseaux de neurones', 'nevralt nettverk', 'nevrale nettverk'],
  ['machine learning', 'aprendizado de máquina', 'aprendizagem de máquina', 'apprentissage automatique', 'maskinlæring'],
  ['artificial intelligence', 'inteligência artificial', 'intelligence artificielle', 'kunstig intelligens', 'ai', 'ia', 'ki'],
  ['high energy physics', 'física de altas energias', 'physique des hautes énergies', 'høyenergifysikk'],
  ['physics', 'física', 'physique', 'fysikk'],
  ['particle', 'partícula', 'particule', 'partikkel', 'particles', 'partículas', 'particules', 'partikler'],
  ['accelerator', 'acelerador', 'accélérateur', 'akselerator', 'aceleradores', 'accelerators'],
  ['collision', 'colisão', 'colisões', 'collisions', 'kollisjon', 'kollisjoner', 'collider', 'colisor', 'collisionneur'],
  ['event', 'evento', 'eventos', 'events', 'événement', 'événements', 'hendelse', 'hendelser'],
  ['visualization', 'visualização', 'visualisation', 'visualisering', 'visualizer', 'visualizador'],
  ['geometry', 'geometria', 'géométrie', 'geometri'],
  ['trigger', 'gatilho', 'déclenchement', 'utløser'],
  ['pile-up', 'pileup', 'empilhamento', 'empilement'],
  ['deconvolution', 'deconvolução', 'déconvolution', 'dekonvolusjon'],
  ['estimation', 'estimação', 'estimativa', 'estimering', 'estimator', 'estimador', 'estimateur'],
  ['processor', 'processador', 'processeur', 'prosessor', 'processors', 'processadores'],
  ['compiler', 'compilador', 'compilateur', 'kompilator'],
  ['programming language', 'linguagem de programação', 'langage de programmation', 'programmeringsspråk'],
  ['simulation', 'simulação', 'simulering', 'simulations', 'simulações'],
  ['simulator', 'simulador', 'simulateur', 'simulatorer'],
  ['electronics', 'eletrônica', 'électronique', 'elektronikk', 'electronic', 'eletrônico'],
  ['analog', 'analógica', 'analógico', 'analogique', 'analogue'],
  ['circuit', 'circuito', 'circuitos', 'circuits', 'krets', 'kretser'],
  ['diode', 'diodo', 'diodos', 'diodes', 'dioder'],
  ['transistor', 'transistores', 'transistors', 'transistorer'],
  ['amplifier', 'amplificador', 'amplificadores', 'amplificateur', 'forsterker'],
  ['voltage', 'tensão', 'spenning'],
  ['noise', 'ruído', 'bruit', 'støy'],
  ['course', 'curso', 'cursos', 'courses', 'cours', 'kurs'],
  ['class', 'aula', 'aulas', 'lecture', 'lectures', 'forelesning'],
  ['handout', 'apostila', 'apostilas', 'lecture notes', 'polycopié', 'kompendium'],
  ['news', 'notícia', 'notícias', 'nouvelles', 'actualités', 'nyheter', 'nyhet'],
  ['publication', 'publicação', 'publicações', 'publications', 'publikasjon', 'publikasjoner', 'paper', 'papers', 'artigo', 'artigos', 'article', 'articles', 'artikkel', 'artikler'],
  ['thesis', 'theses', 'tese', 'teses', 'thèse', 'thèses', 'avhandling', 'dissertation', 'dissertação', 'dissertações', 'mémoire'],
  ['team', 'equipe', 'équipe'],
  ['researcher', 'pesquisador', 'pesquisadores', 'pesquisadora', 'researchers', 'chercheur', 'chercheurs', 'forsker', 'forskere'],
  ['student', 'aluno', 'alunos', 'aluna', 'estudante', 'estudantes', 'students', 'étudiant', 'étudiants', 'studenter'],
  ['professor', 'professores', 'professeur', 'professeurs', 'professors'],
  ['laboratory', 'laboratório', 'laboratoire', 'laboratorium', 'lab', 'labs'],
  ['award', 'awards', 'prize', 'prêmio', 'prêmios', 'premiação', 'prix', 'pris', 'priser'],
  ['conference', 'congresso', 'conferência', 'conférence', 'konferanse', 'kongress', 'congress', 'symposium', 'simpósio'],
  ['scholarship', 'bolsa', 'bolsas', 'bourse', 'stipend'],
];

const CONCEPT = new Map();
/* The words each concept is spelled with, in every language, so that a match
   made through the glossary can still be marked in the text: "nevralt
   nettverk" finds a paper titled "Redes Neurais", and "redes" and "neurais"
   are what has to light up. */
const CONCEPT_WORDS = new Map();
let MAX_GRAM = 1;
for (const row of GLOSSARY) {
  const id = '§' + normalize(row[0]).replace(/ /g, '_');
  const words = new Set();
  for (const spelling of row) {
    const key = normalize(spelling);
    if (!key) continue;
    CONCEPT.set(key, id);
    MAX_GRAM = Math.max(MAX_GRAM, key.split(' ').length);
    for (const w of key.split(' ')) if (w.length >= 2 && !STOP.has(w)) words.add(w);
  }
  CONCEPT_WORDS.set(id, words);
}

/* Concepts named in a run of words, by phrase first: "rede neural" is the
   neural-network concept, not "rede" plus something. */
function conceptsIn(words) {
  const found = [];
  for (let i = 0; i < words.length; i++) {
    for (let n = Math.min(MAX_GRAM, words.length - i); n >= 1; n--) {
      const id = CONCEPT.get(words.slice(i, i + n).join(' '));
      if (id) { found.push({ id, from: i, to: i + n - 1 }); break; }
    }
  }
  return found;
}

const keepToken = (t) => t.length >= 2 && !STOP.has(t);

/* The tokens one field of one document contributes to the index: its words,
   once each, and the concepts they name. Used at build time. */
export function fieldTokens(text) {
  const words = tokenize(text);
  const out = new Set();
  for (const w of words) if (keepToken(w)) out.add(w);
  for (const c of conceptsIn(words)) out.add(c.id);
  return [...out].join(' ');
}

/* Optimal string alignment distance, bounded: gives up as soon as every cell
   of a row is past `max`, which on a vocabulary of thousands is the whole cost
   of fuzzy matching. A swapped pair of letters counts as one edit. */
export function editDistance(a, b, max) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev2 = new Array(lb + 1);
  let prev = new Array(lb + 1);
  let cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cb = b.charCodeAt(j - 1);
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca === cb ? 0 : 1));
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const t = prev2; prev2 = prev; prev = cur; cur = t;
  }
  return prev[lb];
}

/* Field weights: a word in the title is worth five in the body, a keyword
   (tags, authors, headings, research areas) two and a half. */
const WEIGHT = [5, 2.5, 1];
/* A slight lean towards the places a reader means to arrive at. Between a
   person and the news story about that person, both named in the title, the
   person comes first; between a project page and a paper about it, the page. */
const PRIOR = { person: 1.1, project: 1.06, page: 1.05, course: 1.05 };
const MAX_RESULTS = 8;
const RELATIVE_CUTOFF = 0.3;

/* The index on disk is inverted: the vocabulary, sorted, and for each term the
   list of places it occurs, a place being document * 3 + field, written as
   the gaps between consecutive places in base 36. Of the three layouts
   measured it was the smallest after compression (105 KB in brotli for the
   whole site, against 134 for the plain token lists), and it is the shape the
   search wants anyway. */
export function packIndex(docs, fields) {
  const places = new Map();
  fields.forEach((perField, doc) => perField.forEach((text, field) => {
    if (!text) return;
    for (const term of text.split(' ')) {
      if (!places.has(term)) places.set(term, []);
      places.get(term).push(doc * 3 + field);
    }
  }));
  const w = [...places.keys()].sort();
  const p = w.map((term) => places.get(term).sort((a, b) => a - b)
    .map((v, i, a) => (i ? v - a[i - 1] : v).toString(36)).join(' '));
  return { v: 2, docs, w, p };
}

export class SearchIndex {
  constructor(data) {
    this.docs = data.docs;
    this.n = this.docs.length;
    this.postings = new Map();
    data.w.forEach((term, i) => {
      const list = [];
      let at = 0;
      for (const gap of data.p[i].split(' ')) { at += parseInt(gap, 36); list.push(at); }
      this.postings.set(term, list);
    });
    this.idf = new Map();
    for (const [term, list] of this.postings) {
      const df = new Set(list.map((p) => Math.floor(p / 3))).size;
      this.idf.set(term, Math.log(1 + this.n / df));
    }
    // Words only (concepts start with §, which sorts after every letter),
    // sorted for the prefix search, and bucketed by length for the fuzzy one.
    this.words = data.w.filter((t) => t[0] !== '§');
    this.byLength = new Map();
    for (const w of this.words) {
      if (!this.byLength.has(w.length)) this.byLength.set(w.length, []);
      this.byLength.get(w.length).push(w);
    }
  }

  /* Every index term one query word may stand for, with how much it is worth. */
  alternatives(word) {
    const alt = new Map();
    const put = (term, score) => { if ((alt.get(term) || 0) < score) alt.set(term, score); };
    const numeric = /^\d+$/.test(word);
    if (this.postings.has(word)) put(word, 1);
    if (word.length >= 3 && !numeric) {
      // Prefix: the reader is still typing. Worth more the closer the word is
      // to complete, capped so a long tail of rare words cannot pile up.
      let lo = 0, hi = this.words.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (this.words[mid] < word) lo = mid + 1; else hi = mid; }
      let taken = 0;
      for (let i = lo; i < this.words.length && this.words[i].startsWith(word) && taken < 60; i++, taken++) {
        if (this.words[i] !== word) put(this.words[i], 0.55 + 0.35 * (word.length / this.words[i].length));
      }
    }
    if (word.length >= 4 && !numeric) {
      const max = word.length >= 7 ? 2 : 1;
      for (let len = word.length - max; len <= word.length + max; len++) {
        for (const w of this.byLength.get(len) || []) {
          if (w === word) continue;
          const d = editDistance(word, w, max);
          if (d <= max) put(w, d === 1 ? 0.75 : 0.55);
        }
      }
    }
    return alt;
  }

  search(text, { limit = MAX_RESULTS } = {}) {
    const words = tokenize(text);
    if (words.join('').length < 2) return { status: 'short', results: [], terms: new Set() };

    // The query words that count: no stopwords, no lone letters. Two neighbours
    // that the index knows as one word ("cgv web" for cgvweb, "pile up" for
    // pileup) are read as that word.
    let query = words.filter(keepToken);
    for (let i = 0; i + 1 < query.length; i++) {
      const joined = query[i] + query[i + 1];
      if (this.postings.has(joined) && !(this.postings.has(query[i]) && this.postings.has(query[i + 1]))) {
        query.splice(i, 2, joined);
      }
    }
    if (!query.length) return { status: 'short', results: [], terms: new Set() };

    // Concepts named anywhere in what was typed, mapped back onto the query
    // words they cover, so "rede neural" lends its concept to both words.
    const concepts = conceptsIn(words);
    const conceptOf = new Map();
    for (const c of concepts) {
      for (let i = c.from; i <= c.to; i++) {
        const q = query.indexOf(words[i]);
        if (q >= 0 && this.postings.has(c.id)) conceptOf.set(q, c.id);
      }
    }

    const total = new Map();
    const hits = new Map();
    const titleHits = new Map();
    const used = new Set();
    query.forEach((word, qi) => {
      const alt = this.alternatives(word);
      if (conceptOf.has(qi)) alt.set(conceptOf.get(qi), Math.max(alt.get(conceptOf.get(qi)) || 0, 0.7));
      const best = new Map();
      const inTitle = new Set();
      for (const [term, score] of alt) {
        const idf = this.idf.get(term) || 0;
        for (const p of this.postings.get(term) || []) {
          const doc = Math.floor(p / 3), field = p % 3;
          const v = score * WEIGHT[field] * idf;
          if (v > (best.get(doc) || 0)) best.set(doc, v);
          if (field === 0) inTitle.add(doc);
        }
      }
      for (const [doc, v] of best) {
        total.set(doc, (total.get(doc) || 0) + v);
        hits.set(doc, (hits.get(doc) || 0) + 1);
      }
      for (const doc of inTitle) titleHits.set(doc, (titleHits.get(doc) || 0) + 1);
      for (const term of alt.keys()) {
        if (term[0] !== '§') used.add(term);
        else for (const w of CONCEPT_WORDS.get(term) || []) used.add(w);
      }
    });

    // Every word must be found. Only when no document has them all does the
    // query relax, to all but one for three or four words and to three fifths
    // beyond that: a sentence pasted whole should still land somewhere.
    const n = query.length;
    let pool = [...hits].filter(([, h]) => h === n).map(([d]) => d);
    if (!pool.length && n >= 3) {
      const need = n <= 4 ? n - 1 : Math.ceil(0.6 * n);
      pool = [...hits].filter(([, h]) => h >= need).map(([d]) => d);
    }
    if (!pool.length) return { status: 'none', results: [], terms: used };

    // Bonuses, all about the title: the share of the query words found in it,
    // the query as a phrase inside it, and the title being exactly what was
    // typed ("sapho" is the SAPHO page before every page that mentions SAPHO).
    // Ties go to the newer item, then to the shorter title.
    const phrase = query.join(' ');
    const scored = pool.map((doc) => {
      let s = total.get(doc) * (1 + 0.3 * ((titleHits.get(doc) || 0) / n)) * (PRIOR[this.docs[doc].k] || 1);
      const titles = Object.values(this.docs[doc].t).map(normalize);
      if (titles.some((title) => title === phrase || title.replace(/ /g, '') === phrase)) s *= 1.6;
      else if (n >= 2 && titles.some((title) => title.includes(phrase))) s *= 1.4;
      return { doc, score: s };
    }).sort((a, b) => (b.score - a.score)
      || String(this.docs[b.doc].y || '').localeCompare(String(this.docs[a.doc].y || ''))
      || (pick(this.docs[a.doc].t, 'en').length - pick(this.docs[b.doc].t, 'en').length));

    const top = scored[0].score;
    const results = scored.filter((r) => r.score >= top * RELATIVE_CUTOFF).slice(0, limit)
      .map((r) => ({ ...this.docs[r.doc], score: r.score }));
    return { status: 'ok', results, terms: used };
  }
}

/* The title and description a document shows in the reader's language: theirs
   when the document has it, then English, then whatever it was written in. */
export function pick(map, lang) {
  if (!map) return '';
  return map[lang] || map.en || map.x || Object.values(map)[0] || '';
}
