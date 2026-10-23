/* O índice da busca do site (a lupa do menu).
   ------------------------------------------------------------------
   Lê tudo o que um leitor pode querer achar e escreve
   assets/search/search-index.json, que o navegador só baixa quando alguém abre
   a busca. Quem nunca usa a lupa não paga nada.

   O que entra, e de onde:
   - as páginas do site (o HTML de cada uma): título, descrição, os títulos
     de seção e o texto. Cada seção com âncora (um <h2> com id, ou dentro de
     uma <section> com id) vira um resultado próprio, que leva direto a ela;
   - as publicações, de data/publications.json: título, autores, veículo,
     ano, palavras-chave e resumo;
   - as notícias, de data/news.json e data/news-featured.json, em inglês e
     português;
   - as pessoas, de data/team.json: nome, papel, áreas e biografia. O
     resultado abre o cartão da pessoa no About (about#member-<id>).

   Os quatro idiomas: o texto de cada elemento com data-i18n entra também nas
   outras três línguas, lido de data/i18n.json, então uma página escrita em
   inglês é achada pelo que ela diz em português, francês e norueguês.

   A normalização (minúsculas, sem acento, ø → o, sem palavras vazias) e o
   glossário entre idiomas são os de assets/js/search-engine.js, o mesmo
   módulo que responde à busca no navegador: o índice e a pergunta nunca
   discordam sobre o que é uma palavra.

   Uso:
     node tools/build-search.js            escreve o índice
     node tools/build-search.js --check    sai com erro se o índice estiver velho
*/
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const SAIDA = 'assets/search/search-index.json';
const CHECK = process.argv.includes('--check');
const IDIOMAS = ['en', 'pt', 'fr', 'no'];

const ler = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(ler(p));

/* Páginas que não são destino de busca: o erro, o leitor de PDF e o molde das
   notícias. As notícias e as publicações entram pelos dados, não pelo HTML
   pronto de cada uma. */
const FORA = new Set(['404.html', 'pdf-viewer.html', 'news/post.html']);
/* Páginas que são listas do que já entra pelos dados: entram só pelo título e
   pela introdução, sem as seções, para não repetir cada publicação e cada
   notícia como texto de página. */
const SO_INTRODUCAO = new Set(['publications.html', 'news/index.html']);

function paginas() {
  const lista = [];
  const anda = (dir) => {
    for (const nome of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = dir ? dir + '/' + nome.name : nome.name;
      if (nome.isDirectory()) {
        if (/^(node_modules|assets|data|docs|tools|worker|workers|\.git|\.github|\.githooks|media|materials)$/.test(nome.name)) continue;
        if (rel === 'publications/p' || rel === 'news') { if (rel === 'news') lista.push('news/index.html'); continue; }
        anda(rel);
      } else if (nome.name.endsWith('.html') && !FORA.has(rel)) {
        lista.push(rel);
      }
    }
  };
  anda('');
  return lista.sort();
}

/* O endereço limpo que o site usa: about.html é /about, uma pasta é /pasta/. */
const url = (rel) => '/' + rel.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', copy: '©', deg: '°', plusmn: '±' };
function decodifica(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTIDADES[e.toLowerCase()] || ' ';
  });
}
const semMarcacao = (h) => decodifica(String(h || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const limpa = (h) => h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|svg|noscript|template|head)\b[\s\S]*?<\/\1>/gi, ' ');

const I18N = json('data/i18n.json');
const traducao = (lang, chave) => chave.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), I18N[lang]);

/* O texto, nas quatro línguas, das chaves de tradução de um trecho de HTML. */
function traduzidas(fragmento) {
  const out = [];
  for (const m of fragmento.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) {
    for (const lang of IDIOMAS) {
      const v = traducao(lang, m[1]);
      if (typeof v === 'string') out.push(semMarcacao(v));
    }
  }
  return out.join(' ');
}
/* Um título nas quatro línguas. A chave de tradução pode estar no próprio
   elemento (<h2 data-i18n>) ou num pedaço dele (<h2><i></i><span data-i18n>);
   cada pedaço traduzível é trocado pelo texto da língua, e o resto (um número,
   um nome próprio) fica como está. */
function tituloTraduzido(tag, interno) {
  const chaveDoTag = (tag.match(/data-i18n(?:-html)?="([^"]+)"/) || [])[1];
  const t = {};
  for (const lang of IDIOMAS) {
    let html = interno;
    if (chaveDoTag) {
      const v = traducao(lang, chaveDoTag);
      if (typeof v === 'string') html = v;
    } else {
      html = interno.replace(/<([a-z0-9]+)([^>]*\sdata-i18n(?:-html)?="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/gi, (m, el, attrs, chave, padrao) => {
        const v = traducao(lang, chave);
        return typeof v === 'string' ? v : padrao;
      });
    }
    const texto = semMarcacao(html);
    if (texto && (lang === 'en' || texto !== t.en)) t[lang] = texto;
  }
  if (!t.en) t.en = semMarcacao(interno);
  return t;
}

const resumo = (s, n = 150) => { s = semMarcacao(s); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };

async function main() {
  const E = await import(pathToFileURL(path.join(ROOT, 'assets', 'js', 'search-engine.js')).href);
  const docs = [];
  const campos = [];
  const junta = (...partes) => partes.flat(Infinity).filter(Boolean).join(' ');
  const poe = (doc, titulo, chaves, corpo) => {
    docs.push(doc);
    campos.push([E.fieldTokens(titulo), E.fieldTokens(chaves), E.fieldTokens(corpo)]);
  };

  // ---- páginas e seções
  for (const rel of paginas()) {
    const bruto = ler(rel);
    // Um endereço antigo que só redireciona, ou uma página que pede para não
    // ser indexada, não é destino de busca.
    if (/<meta\s+http-equiv="refresh"/i.test(bruto) || /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(bruto)) continue;
    const titulo = semMarcacao((bruto.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s*[|·–—-]\s*NIPS-CERN.*$/i, '');
    const descricao = decodifica((bruto.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '');
    const html = limpa(bruto);
    const h1 = html.match(/<h1([^>]*)>([\s\S]*?)<\/h1>/i);
    const t = h1 && semMarcacao(h1[2]) ? tituloTraduzido(h1[1], h1[2]) : { en: titulo };
    if (!t.en) t.en = titulo;
    const tipo = rel.startsWith('projects/') ? 'project' : rel.startsWith('library/courses/') ? 'course' : 'page';
    const base = url(rel);

    // As seções: cada <h2>, até o próximo.
    const h2s = [...html.matchAll(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi)];
    const inicioSecoes = h2s.length ? h2s[0].index : html.length;
    const introducao = html.slice(0, inicioSecoes);
    const titulosSecao = [];
    let corpoSemAncora = '';
    if (!SO_INTRODUCAO.has(rel)) {
      h2s.forEach((m, i) => {
        const fim = i + 1 < h2s.length ? h2s[i + 1].index : html.length;
        const trecho = html.slice(m.index, fim);
        const ts = tituloTraduzido(m[1], m[2]);
        if (!ts.en) return;
        titulosSecao.push(Object.values(ts));
        let ancora = (m[1].match(/\sid="([^"]+)"/) || [])[1];
        if (!ancora) {
          // A <section> com id ainda aberta neste ponto.
          const antes = html.slice(0, m.index);
          const secoes = [...antes.matchAll(/<section\b[^>]*\sid="([^"]+)"[^>]*>/gi)];
          for (let k = secoes.length - 1; k >= 0 && !ancora; k--) {
            const depois = antes.slice(secoes[k].index);
            const abertas = (depois.match(/<section\b/gi) || []).length - (depois.match(/<\/section>/gi) || []).length;
            if (abertas > 0) ancora = secoes[k][1];
          }
        }
        const texto = semMarcacao(trecho.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, ' '));
        if (!ancora) { corpoSemAncora += ' ' + texto; return; }
        const h3 = [...trecho.matchAll(/<h3([^>]*)>([\s\S]*?)<\/h3>/gi)].map((x) => Object.values(tituloTraduzido(x[1], x[2])));
        poe({ u: base + '#' + ancora, k: 'section', t: ts, d: { en: (t.en || titulo) + ' — ' + resumo(texto, 110) } },
          junta(Object.values(ts)), junta(h3, Object.values(t)), junta(texto.slice(0, 6000), traduzidas(trecho)));
      });
    }
    poe({ u: base, k: tipo, t, d: { en: resumo(descricao || semMarcacao(introducao), 150) } },
      junta(Object.values(t)), junta(titulo, descricao, titulosSecao),
      junta(semMarcacao(introducao), traduzidas(introducao), corpoSemAncora.slice(0, 8000)));
  }

  // ---- publicações
  const rotulo = (grupo, chave) => IDIOMAS.map((l) => traducao(l, grupo + '.' + chave)).filter((v) => typeof v === 'string');
  for (const p of json('data/publications.json')) {
    const slug = String(p.id || '').replace(/^pub-/, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    // O ano vai no canto do resultado, ao lado do tipo; a descrição fica com o
    // veículo só, para não repetir.
    poe({ u: '/publications/p/' + slug, k: 'publication', t: { x: p.title }, d: { x: String(p.journal || '').trim() }, y: p.year },
      p.title, junta(p.authors, p.tags, p.journal, String(p.year || ''), rotulo('publications.types', p.type)),
      junta(semMarcacao(p.abstract), semMarcacao(p.abstract_pt)));
  }

  // ---- notícias
  const destaque = json('data/news-featured.json');
  const noticias = json('data/news.json').map((n) => ({
    slug: n.slug || n.id, date: n.date, tags: n.tags, cat: n.category,
    t: { en: n.title, pt: n.translations && n.translations.pt && n.translations.pt.title },
    d: { en: n.excerpt, pt: n.translations && n.translations.pt && n.translations.pt.excerpt },
    corpo: [n.content, n.translations && n.translations.pt && n.translations.pt.content],
  }));
  // A matéria de destaque tem o texto longo em news-featured.json e, às vezes,
  // uma entrada curta com o mesmo slug em news.json. É uma notícia só: o texto
  // longo se junta ao da entrada que já existe.
  if (destaque && destaque.slug) {
    const tr = destaque.translations || {};
    const longo = [tr.en && tr.en.content_html, tr.pt && tr.pt.content_html, tr.en && tr.en.subtitle, tr.pt && tr.pt.subtitle];
    const ja = noticias.find((n) => n.slug === destaque.slug);
    if (ja) ja.corpo.push(...longo);
    else noticias.push({ slug: destaque.slug, date: destaque.date, tags: destaque.tags, cat: destaque.category,
      t: { en: tr.en && tr.en.title, pt: tr.pt && tr.pt.title },
      d: { en: tr.en && (tr.en.excerpt || tr.en.subtitle), pt: tr.pt && (tr.pt.excerpt || tr.pt.subtitle) },
      corpo: longo });
  }
  for (const n of noticias) {
    const t = {}; const d = {};
    for (const l of ['en', 'pt']) { if (n.t[l]) t[l] = semMarcacao(n.t[l]); if (n.d[l]) d[l] = resumo(n.d[l]); }
    poe({ u: '/news/' + n.slug, k: 'news', t, d, y: String(n.date || '').slice(0, 10) },
      Object.values(t), junta(n.tags, rotulo('news.categories', n.cat), String(n.date || '').slice(0, 4)),
      junta(Object.values(d), n.corpo.map(semMarcacao)));
  }

  // ---- pessoas
  const equipe = json('data/team.json');
  for (const m of (Array.isArray(equipe) ? equipe : equipe.members || [])) {
    const d = {};
    for (const l of IDIOMAS) {
      const papel = traducao(l, 'about.team.roles.' + m.role) || m.role || '';
      d[l] = [papel, (m.areas || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ');
    }
    // O coordenador tem o cartão próprio no topo do About, fora das grades que
    // abrem pelo endereço #member-<id>.
    const destino = m.role === 'coordinator' ? '/about#coordinator-card' : '/about#member-' + m.id;
    poe({ u: destino, k: 'person', t: { x: m.name }, d },
      m.name, junta(m.areas, m.tags, m.title, m.affiliation, rotulo('about.team.roles', m.role), m.email),
      junta(semMarcacao(m.bio), semMarcacao(m.bio_pt)));
  }

  const indice = JSON.stringify(E.packIndex(docs, campos));
  const destino = path.join(ROOT, SAIDA);
  if (CHECK) {
    const atual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : '';
    if (atual !== indice) {
      console.error('O índice da busca está desatualizado. Rode: node tools/build-search.js');
      process.exit(1);
    }
    console.log(`índice da busca em dia (${docs.length} documentos)`);
    return;
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, indice);
  const porTipo = docs.reduce((a, d) => ((a[d.k] = (a[d.k] || 0) + 1), a), {});
  console.log(`${docs.length} documentos em ${SAIDA} (${(indice.length / 1024).toFixed(1)} KB): ${Object.entries(porTipo).map(([k, v]) => v + ' ' + k).join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
