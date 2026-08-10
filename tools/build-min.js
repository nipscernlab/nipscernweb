/* Minificação dos assets de texto
   ------------------------------------------------------------------
   O código deste site é comentado de propósito e com generosidade: as decisões
   de layout, os três bugs que a disciplina de refresh do ScrollTrigger custou,
   o motivo de cada número. Isso é para quem lê o repositório. O navegador não
   lê nada disso e paga por tudo — em `main.css` os comentários e o espaço em
   branco são 62% do que vai comprimido pela rede.

   Então a fonte fica como está, inteira, e este arquivo gera ao lado dela a
   cópia que o site serve:

     assets/css/main.css   ->  assets/css/main.min.css
     assets/js/home.js     ->  assets/js/home.min.js

   As páginas apontam para os `.min`. Ninguém edita um `.min` à mão: o hook
   `.githooks/pre-commit` roda este arquivo quando uma fonte entra no commit e
   põe a saída no mesmo commit, pela mesma razão que ele carimba o `?v=` — um
   par que pode divergir em silêncio é a única coisa que o histórico deste
   repositório mostra dando errado de verdade.

   Um módulo que importa outro tem que importar o `.min` do outro, senão a
   página baixa as duas versões do mesmo arquivo. Os especificadores são
   reescritos aqui embaixo, e `vendor/` fica fora porque já vem minificado.

   Uso:  node tools/build-min.js [--check]
         --check não escreve nada e sai com 1 se algum .min estiver defasado.
         É o que o CI roda.
*/

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

/* A lista vem do hook, exatamente como o guard de cache faz. Uma segunda cópia
   de uma lista é o que já deu errado quatro vezes neste repositório. */
function sourcesFromHook() {
  const hook = fs.readFileSync(path.join(ROOT, '.githooks', 'pre-commit'), 'utf8');
  const block = hook.match(/^ASSETS="([\s\S]*?)"$/m);
  if (!block) throw new Error('não consegui ler ASSETS de .githooks/pre-commit');
  return block[1]
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    /* Só texto que vale minificar. vendor/ já é minificado, e um .min.js da
       nossa própria geração não é fonte de coisa nenhuma.

       assets/css/icons/ também fica de fora: aqueles arquivos são gerados por
       tools/build-icon-subsets.js a partir de uma folha que já é uma regra por
       linha, sem um espaço sobrando. Minificá-los rendia menos de meio por
       cento e criava vinte e dois `.min.css` que página nenhuma carrega. */
    .filter((f) => /\.(css|js)$/.test(f))
    .filter((f) => !f.startsWith('assets/js/vendor/'))
    .filter((f) => !f.startsWith('assets/css/icons/'))
    .filter((f) => !f.endsWith('.min.css') && !f.endsWith('.min.js'));
}

const outputFor = (src) => src.replace(/\.(css|js)$/, '.min.$1');

/* Um import de irmão passa a apontar para o .min do irmão. Caminhos com barra
   (./vendor/…) não casam de propósito. */
function rewriteImports(code) {
  return code.replace(/(["'])(\.\.?\/)([A-Za-z0-9_-]+)\.js(\?v=[A-Za-z0-9._-]+)?\1/g,
    (m, q, dir, name, stamp) => `${q}${dir}${name}.min.js${stamp || ''}${q}`);
}

async function minify(src) {
  const abs = path.join(ROOT, src);
  const code = fs.readFileSync(abs, 'utf8');
  const loader = src.endsWith('.css') ? 'css' : 'js';

  const out = await esbuild.transform(code, {
    loader,
    minify: true,
    /* esnext desliga todo o "lowering" do esbuild. Queremos o arquivo menor,
       não o arquivo traduzido: color-mix, mask-image, @supports aninhado e os
       módulos ES saem daqui exatamente com a semântica que entraram. */
    target: 'esnext',
    format: loader === 'js' ? 'esm' : undefined,
    legalComments: 'none',
  });

  return loader === 'js' ? rewriteImports(out.code) : out.code;
}

/* A verificação que importa: minificar não pode perder uma regra.
   Compara o conjunto de seletores da fonte com o do resultado. Não prova que o
   CSS é idêntico, prova que nenhum seletor sumiu, que é o modo como isso
   quebraria em silêncio.

   A comparação é seletor a seletor e não lista a lista, porque o minificador
   funde regras de corpo igual: `.a{x}.b{x}` vira `.a,.b{x}`. Comparando listas
   inteiras, `.a` e `.b` apareceriam como perdidos estando os dois lá. */
function splitSelectorList(list) {
  const parts = [];
  let buf = '', paren = 0, bracket = 0;
  for (const ch of list) {
    if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket--;
    /* Vírgula dentro de :is(), :not() ou de [attr="a,b"] não separa nada. */
    if (ch === ',' && paren === 0 && bracket === 0) { parts.push(buf); buf = ''; continue; }
    buf += ch;
  }
  parts.push(buf);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/* `from`, `to`, `50%`: passos de @keyframes, não seletores. O minificador os
   reescreve e os funde (`from` vira `0%`), o que é livre para ele fazer. */
const isKeyframeStep = (s) =>
  /^(from|to|-?[\d.]+%)$/.test(s);

function selectorSet(css) {
  const src = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    /* Regra de corpo vazio é código morto e o minificador a descarta, com
       razão. `main.css` tem uma, `.footer-brand {}`. Sai dos dois lados. */
    .replace(/[^{}]+\{\s*\}/g, '');
  const out = new Set();
  let buf = '';
  let depth = 0;

  /* Contando chaves, porque um `@media` abre um bloco que contém blocos e
     qualquer divisão ingênua por `}` embaralha os dois níveis — foi assim que a
     primeira versão desta função acusou 125 seletores perdidos que estavam
     todos lá. */
  for (const ch of src) {
    if (ch === '{') {
      const head = buf.trim();
      /* Prelúdio de at-rule (@media, @supports, @font-face) não é seletor. */
      if (head && !head.startsWith('@')) {
        for (const one of splitSelectorList(head)) {
          const norm = one
            .replace(/\s*([,>+~])\s*/g, '$1')
            .replace(/\s+/g, ' ')
            /* O minificador escreve `:before` no lugar de `::before`. Os quatro
               pseudo-elementos originais — before, after, first-line e
               first-letter — têm as duas formas definidas como equivalentes e
               todo navegador aceita as duas; os posteriores (::selection,
               ::placeholder, ::backdrop) exigem os dois pontos duplos e o
               esbuild não encosta neles. Aqui os dois lados vão para a mesma
               forma antes de comparar, senão a verificação acusa perda numa
               troca que não perde nada. */
            .replace(/::(before|after|first-line|first-letter)\b/g, ':$1')
            /* Mais duas reescritas que o minificador faz e que não mudam o que
               casa: aspas dispensáveis em seletor de atributo, e as palavras
               `even`/`odd` na sua forma an+b. */
            .replace(/\[([^\]=]+)=["']([A-Za-z_-][\w-]*)["']\]/g, '[$1=$2]')
            .replace(/:nth-(child|of-type|last-child|last-of-type)\(even\)/g, ':nth-$1(2n)')
            .replace(/:nth-(child|of-type|last-child|last-of-type)\(odd\)/g, ':nth-$1(2n+1)');
          if (!isKeyframeStep(norm)) out.add(norm);
        }
      }
      depth++;
      buf = '';
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      buf = '';
    } else {
      buf += ch;
    }
  }
  return out;
}

(async () => {
  const sources = sourcesFromHook();
  let stale = 0;
  const rows = [];

  for (const src of sources) {
    const dst = outputFor(src);
    const built = await minify(src);

    if (src.endsWith('.css')) {
      const before = selectorSet(fs.readFileSync(path.join(ROOT, src), 'utf8'));
      const after = selectorSet(built);
      const lost = [...before].filter((s) => !after.has(s));
      if (lost.length) {
        console.error(`ERRO: ${src} -> ${dst} perdeu ${lost.length} seletor(es):`);
        lost.slice(0, 8).forEach((s) => console.error('  ' + s));
        process.exit(1);
      }
    }

    const absDst = path.join(ROOT, dst);
    const current = fs.existsSync(absDst) ? fs.readFileSync(absDst, 'utf8') : null;
    const changed = current !== built;

    if (CHECK) {
      if (changed) { console.error(`defasado: ${dst}`); stale++; }
    } else if (changed) {
      fs.writeFileSync(absDst, built);
    }

    const rawKb = fs.statSync(path.join(ROOT, src)).size / 1024;
    const minKb = Buffer.byteLength(built) / 1024;
    rows.push([dst, rawKb, minKb, changed]);
  }

  if (CHECK) {
    if (stale) {
      console.error(`\n${stale} arquivo(s) .min defasado(s). Rode: node tools/build-min.js`);
      process.exit(1);
    }
    console.log('todos os .min estão em dia');
    return;
  }

  let rawT = 0, minT = 0;
  for (const [dst, raw, min, changed] of rows) {
    rawT += raw; minT += min;
    console.log(
      (changed ? 'escrito ' : 'inalterado ') + dst.padEnd(34) +
      raw.toFixed(1).padStart(7) + 'K -> ' + min.toFixed(1).padStart(7) + 'K'
    );
  }
  console.log('');
  console.log('fonte ' + rawT.toFixed(1) + 'K, servido ' + minT.toFixed(1) + 'K ('
    + (100 * (1 - minT / rawT)).toFixed(0) + '% a menos, antes da compressão)');
})();
