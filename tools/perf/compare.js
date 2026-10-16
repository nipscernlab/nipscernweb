/* Compara duas medições de tools/perf/measure.js, página a página.

     node tools/perf/compare.js docs/perf/local-antes.json docs/perf/local-depois.json [--md saida.md]

   Para cada página e perfil, mostra antes → depois das métricas principais e a
   variação. Melhorou ou piorou só conta além do ruído: 10% e um mínimo
   absoluto por métrica, porque duas execuções da mesma página já variam isso. */
'use strict';
const fs = require('fs');

const METRICAS = [
  // chave, rótulo, maior é melhor?, ruído absoluto
  ['lh.nota', 'Lighthouse', true, 2],
  ['lh.lcp', 'LCP ms', false, 150],
  ['lh.tbt', 'TBT ms', false, 30],
  ['lh.si', 'Speed Index ms', false, 300],
  ['lh.cls', 'CLS', false, 0.02],
  ['rede.kb', 'KB transferidos', false, 20],
  ['parado.ocupado.principal', 'parado: thread principal %', false, 3],
  ['parado.ocupado.gpu', 'parado: GPU %', false, 3],
  ['parado.rafPorSeg', 'parado: rAF por s', false, 5],
  ['rolagem.fps', 'rolagem: fps', true, 5],
  ['rolagem.entregues', 'rolagem: quadros entregues %', true, 3],
  ['rolagem.p95', 'rolagem: p95 do quadro ms', false, 2],
  ['rolagem.engasgos50', 'rolagem: engasgos >50 ms', false, 1],
  ['rolagem.ocupado.principal', 'rolagem: thread principal %', false, 3],
  ['rolagem.ocupado.gpu', 'rolagem: GPU %', false, 3],
  ['toque.ms', 'toque no menu ms', false, 16],
  ['memoria.heapMB', 'heap JS MB', false, 1],
];

const [, , fa, fb, ...resto] = process.argv;
if (!fa || !fb) {
  console.error('uso: node tools/perf/compare.js <antes.json> <depois.json> [--md saida.md]');
  process.exit(1);
}
const A = JSON.parse(fs.readFileSync(fa, 'utf8'));
const B = JSON.parse(fs.readFileSync(fb, 'utf8'));
const iMd = resto.indexOf('--md');
const saida = iMd > -1 ? resto[iMd + 1] : null;

const fmt = (x) => (x == null ? '' : Math.abs(x) >= 100 ? String(Math.round(x)) : String(Math.round(x * 10) / 10));
const linhas = [
  `# ${A.ambiente.base}${A.ambiente.query ? '?' + A.ambiente.query : ''} (${fa}) → ${B.ambiente.base}${B.ambiente.query ? '?' + B.ambiente.query : ''} (${fb})`,
  '',
  `Antes: git ${A.ambiente.git}, ${A.ambiente.data.slice(0, 16)}. Depois: git ${B.ambiente.git}, ${B.ambiente.data.slice(0, 16)}. Medianas de ${A.ambiente.runs} e ${B.ambiente.runs} execuções. ✔ melhorou além do ruído, ✘ piorou além do ruído.`,
  '',
];
let melhor = 0, pior = 0;
for (const pagina of Object.keys(B.resumo)) {
  for (const perfil of ['desktop', 'mobile']) {
    const a = A.resumo[pagina] && A.resumo[pagina][perfil];
    const b = B.resumo[pagina][perfil];
    if (!a || !b) continue;
    const corpo = [];
    for (const [k, rot, maiorMelhor, ruido] of METRICAS) {
      const x = a[k], y = b[k];
      if (x == null || y == null) continue;
      const d = y - x;
      const rel = x ? d / Math.abs(x) : 0;
      let marca = '';
      if (Math.abs(d) > ruido && Math.abs(rel) > 0.1) {
        const bom = maiorMelhor ? d > 0 : d < 0;
        marca = bom ? '✔' : '✘';
        if (bom) melhor++; else pior++;
      }
      corpo.push(`| ${rot} | ${fmt(x)} | ${fmt(y)} | ${d > 0 ? '+' : ''}${fmt(d)}${x ? ` (${d > 0 ? '+' : ''}${Math.round(rel * 100)}%)` : ''} | ${marca} |`);
    }
    if (!corpo.length) continue;
    linhas.push(`## ${pagina}, ${perfil === 'desktop' ? 'computador' : 'celular'}`, '', '| métrica | antes | depois | variação | |', '|---|---:|---:|---:|:-:|', ...corpo, '');
  }
}
linhas.push(`${melhor} métricas melhoraram e ${pior} pioraram além do ruído.`, '');
const texto = linhas.join('\n');
if (saida) fs.writeFileSync(saida, texto);
console.log(texto);
