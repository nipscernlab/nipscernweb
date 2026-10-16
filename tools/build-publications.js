/* As publicações prontas no HTML, a partir de data/publications.json.
   ------------------------------------------------------------------
   Gera três coisas:

   1. A lista inteira dentro de publications.html: a faixa de números, os
      destaques e a lista agrupada por ano, que é a ordem que a página abre.
      O desenho é o de assets/js/pub-render.js, o mesmo módulo que
      publications.js usa no navegador, em inglês, que é a língua do HTML.
      Quando o script carrega, ele desenha a mesma lista por cima, então nada
      se mexe; quem não roda JavaScript, um robô de busca ou uma prévia de
      rede social, vê o acervo inteiro.
   2. Uma página por publicação, em publications/p/<id sem "pub-">.html, com
      título, autores, onde saiu, resumo, link para o PDF e o DOI, e o que os
      buscadores acadêmicos leem: as meta tags citation_* (o formato que o
      Google Acadêmico pede, uma publicação por página) e os dados
      estruturados schema.org (ScholarlyArticle, ou Thesis para teses).
   3. O bloco dessas páginas no sitemap.xml, entre marcadores.

   Uso:
     node tools/build-publications.js            # grava
     node tools/build-publications.js --check    # falha se algo estiver defasado

   Rode depois de mudar data/publications.json. O hook de pre-commit acerta o
   ?v= e os ícones das páginas novas como de qualquer outra. */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.nipscern.com/';
const CHECK = process.argv.includes('--check');
const DIR_P = path.join(ROOT, 'publications', 'p');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Tudo o que este gerador escreve passa por aqui. No --check, compara com o
   que está em disco (normalizando o fim de linha, como o git faz) e conta. */
const defasados = [];
function grava(arq, texto) {
  const atual = fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8').replace(/\r\n/g, '\n') : null;
  if (atual === texto) return;
  if (CHECK) { defasados.push(path.relative(ROOT, arq).split(path.sep).join('/')); return; }
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, texto);
}

function trocaEntre(texto, inicio, fim, novo, arq) {
  const i = texto.indexOf(inicio), j = texto.indexOf(fim);
  if (i < 0 || j < i) throw new Error(`${arq}: faltam os marcadores ${inicio} ... ${fim}`);
  return texto.slice(0, i + inicio.length) + novo + texto.slice(j);
}

(async () => {
  const R = await import(pathToFileURL(path.join(ROOT, 'assets', 'js', 'pub-render.js')).href);
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'i18n', 'en.json'), 'utf8')).en;
  const t = (key) => key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), en) || key;
  const pubs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'publications.json'), 'utf8'))
    .filter((p) => p.title && p.title.trim() !== '');

  // Os ids viram nomes de arquivo: têm de ser únicos e não colidir com o que
  // já mora em publications/.
  const vistos = new Set();
  for (const p of pubs) {
    const nome = R.publicationPagePath(p);
    if (!/^publications\/p\/[a-z0-9][a-z0-9-]*$/.test(nome)) throw new Error(`id que não serve de endereço: ${p.id}`);
    if (vistos.has(nome)) throw new Error(`id repetido: ${p.id}`);
    vistos.add(nome);
  }

  // A chave de efeitos do <head>, a mesma de todas as páginas: copiada da Home.
  const efeitos = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<script>\/\* Efeitos:[\s\S]*?<\/script>/) || [])[0];
  if (!efeitos) throw new Error('index.html não tem a chave de efeitos no <head>');

  const versao = (fs.readFileSync(path.join(ROOT, 'publications.html'), 'utf8').match(/main\.min\.css\?v=([A-Za-z0-9]+)/) || [])[1];
  if (!versao) throw new Error('publications.html não tem o ?v= da main.min.css');

  /* ---------- 1. a lista em publications.html ---------- */
  const flagHtml = (root) => (title, abstract) => {
    const lang = R.detectLang(title, abstract);
    const nomes = { pt: 'Português', en: 'English', fr: 'Français', no: 'Norsk' };
    const arq = { en: 'flag-for-united-kingdom', pt: 'flag-for-brazil', fr: 'flag-for-france', no: 'flag-for-norway' }[lang];
    const name = nomes[lang] || lang;
    const img = arq ? `<img class="flag" src="${root}assets/icons/${arq}.svg" alt="" loading="lazy" decoding="async" aria-hidden="true" title="${name}">` : '';
    return `<span class="pub-lang-flag" role="img" title="${name}" aria-label="${name}">${img}</span>`;
  };
  const ctx = {
    t,
    flag: flagHtml(SITE),
    pdfUrl: (p) => '/pdf-viewer.html?id=' + encodeURIComponent(p.id),
    pageUrl: (p) => '/' + R.publicationPagePath(p),
  };
  const arqLista = path.join(ROOT, 'publications.html');
  let html = fs.readFileSync(arqLista, 'utf8').replace(/\r\n/g, '\n');
  html = trocaEntre(html, '<!-- pubs:stats -->', '<!-- /pubs:stats -->', R.renderStats(pubs, ctx), 'publications.html');
  html = trocaEntre(html, '<!-- pubs:featured -->', '<!-- /pubs:featured -->', R.renderFeaturedStrip(R.featuredList(pubs), ctx), 'publications.html');
  html = trocaEntre(html, '<!-- pubs:list -->', '<!-- /pubs:list -->', R.renderGrouped(pubs, ctx), 'publications.html');
  grava(arqLista, html);

  /* ---------- 2. uma página por publicação ---------- */
  const TESES = new Set(R.THESIS_TYPES);
  const escritas = new Set();
  for (const p of pubs) {
    const rel = R.publicationPagePath(p);
    const url = SITE + rel;
    const lang = R.detectLang(p.title, p.abstract);
    const tipo = t(`publications.types.${p.type}`);
    const autores = R.formatAuthors(p.authors);
    const venue = String(p.journal || '').trim();
    const tese = TESES.has(p.type);
    const desc = String(p.abstract || '').replace(/\s+/g, ' ').trim();
    const curta = desc.length > 200 ? desc.slice(0, 197).replace(/\s+\S*$/, '') + '…' : desc;

    const citation = [
      ['citation_title', p.title],
      ...p.authors.map((a) => String(a).trim()).filter(Boolean).map((a) => ['citation_author', a]),
      ['citation_publication_date', String(p.year)],
      [tese ? 'citation_dissertation_institution' : (p.type === 'conference' ? 'citation_conference_title' : 'citation_journal_title'), venue],
      ['citation_pdf_url', p.pdf],
      ['citation_doi', p.doi],
      ['citation_language', lang],
      ['citation_abstract_html_url', url],
    ].filter(([, v]) => v);

    const ld = {
      '@context': 'https://schema.org',
      '@type': tese ? 'Thesis' : 'ScholarlyArticle',
      headline: p.title,
      name: p.title,
      author: p.authors.map((a) => String(a).trim()).filter(Boolean).map((name) => ({ '@type': 'Person', name })),
      datePublished: String(p.year),
      inLanguage: lang,
      abstract: desc || undefined,
      url,
      sameAs: p.doi ? 'https://doi.org/' + p.doi : undefined,
      isPartOf: venue && !tese ? { '@type': p.type === 'conference' ? 'Event' : 'Periodical', name: venue } : undefined,
      sourceOrganization: tese && venue ? { '@type': 'Organization', name: venue } : undefined,
      encoding: p.pdf ? { '@type': 'MediaObject', contentUrl: p.pdf, encodingFormat: 'application/pdf' } : undefined,
      keywords: (p.tags || []).join(', ') || undefined,
      publisher: { '@type': 'ResearchOrganization', name: 'NIPS-CERN', url: SITE },
    };

    const pagina = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>try{var l=localStorage.getItem('nipscern_lang');if(l&&['en','pt','fr','no'].indexOf(l)>-1)document.documentElement.lang=l;}catch(e){}</script>
  ${efeitos}
  <!-- Gerada por tools/build-publications.js a partir de data/publications.json. Não edite à mão. -->
  <title>${esc(p.title)} | NIPS-CERN</title>
  <meta name="description" content="${esc(curta)}">
  <link rel="canonical" href="${url}">

  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(curta)}">
  <meta property="og:image" content="${SITE}assets/images/og-default.png">
  <meta name="twitter:card" content="summary">

  <!-- Para o Google Acadêmico: uma publicação por página, nas meta tags que ele lê. -->
${citation.map(([k, v]) => `  <meta name="${k}" content="${esc(v)}">`).join('\n')}

  <script type="application/ld+json">
${JSON.stringify(ld, null, 2).split('\n').map((l) => '  ' + l).join('\n')}
  </script>

  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/assets/icons/icon_home_nipscern.svg" type="image/svg+xml">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png">
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="preload" href="../../assets/fonts/geist-var-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../../assets/fonts/bodoni-var-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../../assets/css/icons/publications-p.css?v=${versao}">
  <link rel="stylesheet" href="../../assets/css/main.min.css?v=${versao}">
  <style>
    .pubp-meta { color: var(--text-secondary); margin-top: var(--sp-3); }
    .pubp-meta strong { color: var(--text-primary); font-weight: 500; }
    .pubp-actions { display: flex; flex-wrap: wrap; gap: var(--sp-3); margin-top: var(--sp-6); }
    .pubp-body { max-width: 760px; margin: var(--sp-10) auto var(--sp-12); padding: 0 var(--container-pad); }
    .pubp-body h2 { font-size: var(--text-lg); margin-bottom: var(--sp-3); }
    .pubp-body p { color: var(--text-secondary); line-height: 1.7; }
    .pubp-tags { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-6); }
  </style>
</head>
<body>

  <a href="#main" class="skip-link" data-i18n="nav.skip">Skip to content</a>
  <nav id="nav" role="navigation" aria-label="Main navigation"></nav>

  <main id="main">
    <header class="page-hero page-hero--legal" aria-labelledby="pub-title">
      <div class="page-hero-inner">
        <div class="page-hero-text">
          <div class="eyebrow">
            <i class="ph ph-book-open" aria-hidden="true"></i>
            <span>${esc(tipo)} · ${esc(p.year)}</span>
          </div>
          <h1 class="display-md" id="pub-title"${lang !== 'en' ? ` lang="${lang}"` : ''}>${esc(p.title)}</h1>
          <p class="pubp-meta">${esc(autores)}</p>
          ${venue ? `<p class="pubp-meta"><strong>${esc(venue)}</strong></p>` : ''}
          <div class="pubp-actions">
            ${p.pdf ? `<a class="btn btn-primary glass-btn" href="${ctx.pdfUrl(p)}"><i class="ph ph-file-pdf" aria-hidden="true"></i><span>${esc(t('publications.open_pdf'))}</span></a>` : ''}
            ${p.doi ? `<a class="btn btn-ghost glass-btn" href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener"><i class="ph ph-link" aria-hidden="true"></i><span>DOI ${esc(p.doi)}</span></a>` : ''}
            <a class="btn btn-ghost glass-btn" href="../../publications"><i class="ph ph-arrow-left" aria-hidden="true"></i><span>${esc(t('publications.title'))}</span></a>
          </div>
        </div>
      </div>
    </header>

    <section class="pubp-body"${lang !== 'en' ? ` lang="${lang}"` : ''}>
      ${desc ? `<h2>Abstract</h2>\n      <p>${esc(desc)}</p>` : ''}
      ${(p.tags || []).length ? `<div class="pubp-tags">${p.tags.map((x) => `<span class="badge badge-gray">${esc(x)}</span>`).join('')}</div>` : ''}
    </section>
  </main>

  <footer id="footer" role="contentinfo"></footer>

  <script type="module" src="../../assets/js/main.min.js?v=${versao}"></script>
  <script src="../../assets/js/analytics.min.js?v=${versao}" defer></script>
</body>
</html>
`;
    const arq = path.join(ROOT, ...rel.split('/')) + '.html';
    grava(arq, pagina.replace(/\n\s*\n\s*\n/g, '\n\n'));
    escritas.add(path.basename(arq));
  }
  // Página de publicação que saiu do JSON sai do site.
  if (fs.existsSync(DIR_P)) {
    for (const f of fs.readdirSync(DIR_P)) {
      if (f.endsWith('.html') && !escritas.has(f)) {
        if (CHECK) defasados.push('publications/p/' + f + ' (sobra)');
        else fs.unlinkSync(path.join(DIR_P, f));
      }
    }
  }

  /* ---------- 3. o sitemap ---------- */
  const arqMapa = path.join(ROOT, 'sitemap.xml');
  let mapa = fs.readFileSync(arqMapa, 'utf8').replace(/\r\n/g, '\n');
  const bloco = '  <!-- publications: gerado por tools/build-publications.js -->\n' + pubs.map((p) =>
    `  <url>\n    <loc>${SITE}${R.publicationPagePath(p)}</loc>\n    <changefreq>yearly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`).join('') + '  <!-- /publications -->\n';
  if (mapa.includes('<!-- publications:')) mapa = mapa.replace(/  <!-- publications: [\s\S]*?<!-- \/publications -->\n/, () => bloco);
  else mapa = mapa.replace('</urlset>', bloco + '</urlset>');
  grava(arqMapa, mapa);

  if (CHECK) {
    if (defasados.length) {
      console.error('defasado, rode node tools/build-publications.js:\n  ' + defasados.join('\n  '));
      process.exit(1);
    }
    console.log(`publicações em dia (${pubs.length})`);
  } else {
    console.log(`${pubs.length} publicações: lista em publications.html, páginas em publications/p/, sitemap.xml`);
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
