/* Um conjunto de ícones por página
   ------------------------------------------------------------------
   `assets/css/icons.css` traz os 110 ícones do site. A home usa 19 deles, e a
   folha é a ÚNICA que bloqueia o render — a `main.css`, quatro vezes maior,
   entra assíncrona. Ou seja, a folha pequena e quase toda inútil segura o
   primeiro pixel, e a grande e essencial não.

   Este arquivo escreve `assets/css/icons/<pagina>.css` com a regra base `.ph` e
   só as regras de que aquela página precisa. Na home: 14,4 KB comprimidos viram
   4,9 KB.

   ------------------------------------------------------------------
   Por que ele falha em vez de avisar
   ------------------------------------------------------------------
   A regra base é `mask: var(--ph) …` sobre `background-color: currentColor`. Um
   `--ph` que não existe torna a declaração inválida, e o que aparece na tela não
   é "nada": é um QUADRADO SÓLIDO de 1em na cor do texto. Um subconjunto
   desatualizado não degrada, ele estraga a página de um jeito bem visível.

   Por isso não há caminho silencioso aqui. Se uma página usa uma classe `ph-*`
   que não existe na folha, este arquivo sai com erro e diz qual é — o que
   também pega erro de digitação em ícone, que antes só aparecia como quadrado.

   ------------------------------------------------------------------
   O que entra no conjunto de uma página
   ------------------------------------------------------------------
   O que está no HTML dela MAIS tudo que qualquer JS do site menciona. A
   segunda parte não é preguiça: `main.js` escreve a navegação e o rodapé em
   toda página, `home.js` monta os cartões de notícia, `publications.js` monta a
   lista — nenhum desses ícones aparece no HTML de origem. Varrer só o HTML
   produziria exatamente o quadrado sólido descrito acima.

   Uso:  node tools/build-icon-subsets.js [--check]
         --check não escreve e sai com 1 se algum subconjunto estiver defasado.
*/
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const FONTE = 'assets/css/icons.css';
const DESTINO = 'assets/css/icons';
const CHECK = process.argv.includes('--check');

const ler = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* A folha inteira, separada em regra base e uma regra por ícone. */
function catalogo() {
  const css = ler(FONTE);
  const base = [];
  const icones = new Map();
  for (const linha of css.split(/\r?\n/)) {
    const m = linha.match(/^\.ph-([a-z0-9-]+)\{/);
    if (m) icones.set(m[1], linha);
    else if (linha.trim()) base.push(linha);
  }
  return { base: base.join('\n'), icones };
}

/* Toda classe ph-* que qualquer JS do site menciona. */
function iconesDoJs(icones) {
  const usados = new Set();
  const arquivos = cp.execSync('git ls-files "assets/js/*.js"', { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter((f) => f && !f.includes('.min.') && !f.includes('/vendor/'));
  for (const f of arquivos) {
    for (const m of ler(f).matchAll(/ph-([a-z0-9-]+)/g)) {
      if (icones.has(m[1])) usados.add(m[1]);
    }
  }
  return usados;
}

const nomeDoArquivo = (html) =>
  html.replace(/\.html$/, '').replace(/[\/\\]/g, '-') + '.css';

(async () => {
  const { base, icones } = catalogo();
  const doJs = iconesDoJs(icones);

  /* Só as páginas que de fato carregam uma folha de ícones.
     As catorze restantes são casulos de redirecionamento — os stubs de notícia
     que mandam para /news/post e o publications/index.html — com três
     quilobytes, sem CSS nenhum e sem um único <i class="ph">. Gerar
     subconjunto para elas produzia catorze arquivos que ninguém pede. */
  const paginas = cp.execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.startsWith('kristoffer/'))
    .filter((f) => /assets\/css\/icons/.test(ler(f)));

  fs.mkdirSync(path.join(ROOT, DESTINO), { recursive: true });

  const problemas = [];
  let defasados = 0;
  const linhas = [];

  for (const pagina of paginas) {
    const html = ler(pagina);
    const doHtml = new Set();
    for (const m of html.matchAll(/ph-([a-z0-9-]+)/g)) {
      /* `ph-` também aparece em nomes de arquivo e em prosa; só conta o que a
         folha conhece. O que ela não conhece e está num class= é erro, e é
         checado logo abaixo. */
      if (icones.has(m[1])) doHtml.add(m[1]);
    }
    for (const m of html.matchAll(/class="[^"]*\bph-([a-z0-9-]+)\b[^"]*"/g)) {
      if (!icones.has(m[1])) problemas.push(pagina + ': usa .ph-' + m[1] + ', que não existe em ' + FONTE);
    }

    const conjunto = [...new Set([...doHtml, ...doJs])].sort();
    const saida = base + '\n' + conjunto.map((n) => icones.get(n)).join('\n') + '\n';

    const destino = path.posix.join(DESTINO, nomeDoArquivo(pagina));
    const abs = path.join(ROOT, destino);
    const atual = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    const mudou = atual !== saida;

    if (CHECK) { if (mudou) { console.error('defasado: ' + destino); defasados++; } }
    else if (mudou) fs.writeFileSync(abs, saida);

    linhas.push([destino, conjunto.length, Buffer.byteLength(saida) / 1024, mudou]);
  }

  if (problemas.length) {
    console.error('ERRO: ícone inexistente referenciado — na tela isso vira um quadrado sólido:');
    problemas.forEach((p) => console.error('  ' + p));
    process.exit(1);
  }

  if (CHECK) {
    if (defasados) {
      console.error('\n' + defasados + ' subconjunto(s) defasado(s). Rode: node tools/build-icon-subsets.js');
      process.exit(1);
    }
    console.log('todos os subconjuntos de ícones estão em dia');
    return;
  }

  const totalFonte = fs.statSync(path.join(ROOT, FONTE)).size / 1024;
  for (const [destino, n, kb, mudou] of linhas) {
    console.log((mudou ? 'escrito ' : 'inalterado ') + destino.padEnd(34) +
      String(n).padStart(4) + ' ícones  ' + kb.toFixed(1).padStart(6) + 'K');
  }
  console.log('');
  console.log('folha completa: ' + totalFonte.toFixed(1) + 'K com ' + icones.size + ' ícones');
  console.log('(' + doJs.size + ' deles entram em toda página porque algum JS os injeta)');
})();
