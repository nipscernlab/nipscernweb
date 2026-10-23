/* O teste da busca do site.
   ------------------------------------------------------------------
   Roda o motor de assets/js/search-engine.js sobre o índice gerado
   (assets/search/search-index.json) e confere respostas que um leitor
   espera, com erro de digitação, sem acento e nas quatro línguas, e as
   garantias contra a lista gigante: uma letra não traz nada, palavra vazia
   não traz nada, nenhuma resposta passa de oito itens nem repete endereço.

   Não abre navegador. Uso: node tools/test-search.js
   Sai com 0 se tudo passar, 1 se algo falhar.
*/
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');

(async () => {
  const E = await import(pathToFileURL(path.join(ROOT, 'assets', 'js', 'search-engine.js')).href);
  const t0 = performance.now();
  const idx = new E.SearchIndex(JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'search', 'search-index.json'), 'utf8')));
  const montagem = performance.now() - t0;

  const falhas = [];
  let casos = 0;
  let pior = 0;
  const busca = (q) => {
    const t = performance.now();
    const r = idx.search(q);
    pior = Math.max(pior, performance.now() - t);
    return r;
  };
  const confere = (q, ok, porque) => {
    casos++;
    const r = busca(q);
    const urls = r.results.map((x) => x.u);
    if (r.results.length > 8) falhas.push(`«${q}»: ${r.results.length} resultados, o máximo é 8`);
    if (new Set(urls).size !== urls.length) falhas.push(`«${q}»: endereço repetido na resposta`);
    if (!ok(r, urls)) falhas.push(`«${q}»: ${porque}. Veio: ${r.status} ${urls.slice(0, 4).join(' ') || '(nada)'}`);
  };
  const primeiro = (u) => (r, urls) => urls[0] === u;
  const entre = (u, n) => (r, urls) => urls.slice(0, n).includes(u);
  const titulos = (r) => r.results.map((x) => E.normalize(Object.values(x.t).join(' ')));

  // Nada de lista gigante.
  confere('a', (r) => r.status === 'short', 'uma letra não pode trazer resultado');
  confere('the', (r) => r.status === 'short', 'só palavra vazia não pode trazer resultado');
  confere('de la', (r) => r.status === 'short', 'só palavras vazias não podem trazer resultado');
  confere('xqzw', (r) => r.status === 'none', 'uma sequência sem sentido não pode trazer resultado');
  confere('ia', (r) => r.results.length <= 8, 'duas letras só casam palavra inteira');

  // O destino certo em primeiro.
  confere('sapho', primeiro('/projects/sapho'), 'a página do SAPHO vem primeiro');
  confere('saphp', entre('/projects/sapho', 3), 'com um erro de digitação, o SAPHO ainda aparece');
  confere('yanc compilador', primeiro('/projects/yanc'), 'o YANC vem primeiro');
  confere('lucinao', primeiro('/about#coordinator-card'), 'com as letras trocadas, o Luciano vem primeiro');
  confere('luciano andrade', primeiro('/about#coordinator-card'), 'a pessoa vem antes da notícia sobre ela');
  confere('heitor', primeiro('/about#member-heitor-balthazar'), 'o Heitor vem primeiro');
  confere('mateus hufnagel', (r, u) => u.includes('/about#member-mateus-hufnagel') && u.includes('/news/hufnagel-phd-defense-crosstalk'), 'a pessoa e a notícia do doutorado aparecem');
  confere('eletronica analogica', primeiro('/library/courses/eletronica-analogica-1/'), 'o curso vem primeiro, sem a página antiga de redirecionamento');
  confere('apostila diodo', primeiro('/library/courses/eletronica-analogica-1/part-2/'), 'a parte dos diodos vem primeiro');
  confere('deconvolucao pseudoinversa', primeiro('/publications/p/2026-cba-deconvolucao-pseudoinversa-lar'), 'o artigo do CBA vem primeiro');
  confere('cgvweb sala de controle', primeiro('/news/cgvweb-atlas-control-room'), 'a notícia da sala de controle vem primeiro, uma vez só');
  confere('fapemig', primeiro('/news/fapemig-cba-travel-grant'), 'a notícia da FAPEMIG vem primeiro');
  confere('trabalhos do grupo no cba sobre calorimetro', (r, u) => u[0] && u[0].startsWith('/news/cba-2026'), 'uma frase inteira cai nas notícias do CBA');

  // Acentos, idiomas e o glossário.
  const sem = busca('calorimetro').results.map((x) => x.u).join();
  confere('calorímetro', (r, u) => u.join() === sem && u.length > 0, 'com e sem acento dão a mesma resposta');
  confere('kalorimeter', (r) => r.results.length >= 3 && titulos(r).slice(0, 3).every((t) => /calorimet|kalorimet/.test(t)), 'o norueguês acha os trabalhos sobre calorímetro');
  confere('reseau de neurones', (r) => r.results.length >= 3 && titulos(r).filter((t) => /neur|nevral/.test(t)).length >= 3, 'o francês acha os trabalhos sobre redes neurais');
  confere('nevralt nettverk', (r) => r.results.length >= 3 && titulos(r).filter((t) => /neur|nevral/.test(t)).length >= 3, 'o norueguês acha os trabalhos sobre redes neurais');
  confere('material da parte', (r, u) => u[0] && u[0].includes('#material-t'), 'o título de seção traduzido acha a seção');

  console.log(`índice montado em ${montagem.toFixed(1)} ms; ${casos} casos; busca mais lenta ${pior.toFixed(1)} ms`);
  if (montagem > 300) falhas.push(`montar o índice levou ${montagem.toFixed(0)} ms, o teto é 300`);
  if (pior > 50) falhas.push(`uma busca levou ${pior.toFixed(0)} ms, o teto é 50`);
  if (falhas.length) {
    console.log('FALHOU:');
    for (const f of falhas) console.log('  ' + f);
    process.exit(1);
  }
  console.log('PASSOU: as respostas esperadas, nas quatro línguas, e nenhuma lista gigante.');
})().catch((e) => { console.error(e); process.exit(1); });
