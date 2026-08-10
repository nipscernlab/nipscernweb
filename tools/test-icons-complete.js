/* Nenhum ícone pode faltar no subconjunto da sua página.
   ------------------------------------------------------------------
   Cada página carrega `assets/css/icons/<pagina>.css`, com a regra base `.ph` e
   só os ícones daquela página. O ganho é real — a folha completa tem 110 ícones
   e 13,9 KB comprimidos, a home usa 28 e gasta 4,8 KB — e ela é a única folha
   que bloqueia o render, então esses nove quilobytes saem do caminho crítico.

   O risco é igualmente real. A regra base é

       .ph { background-color: currentColor; mask: var(--ph) no-repeat center }

   e um `--ph` que não existe torna a declaração `mask` inválida. O que sobra na
   tela não é um espaço vazio: é um QUADRADO SÓLIDO de 1em na cor do texto. Um
   subconjunto defasado não degrada com elegância, ele suja a página.

   Então este teste abre cada página num navegador de verdade, espera o JS
   escrever a navegação, o rodapé e o que mais ele monta, e pergunta a cada
   elemento `.ph` se o `--ph` dele resolveu para alguma coisa. É a única
   pergunta que importa, e ela cobre também os ícones que nenhum HTML contém
   porque algum script os injeta.

   Uso:
     1) npm run dev
     2) msedge --headless=new --remote-debugging-port=9222 \
               --user-data-dir=<pasta temporária> about:blank
     3) node tools/test-icons-complete.js
*/
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const BROWSER = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
const BASE = process.env.TEST_BASE || 'http://localhost:3000/';
const ROOT = path.join(__dirname, '..');

(async () => {
  const paginas = cp.execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.startsWith('kristoffer/'))
    .filter((f) => /assets\/css\/icons/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));

  const browser = await puppeteer.connect({ browserURL: BROWSER });
  const falhas = [];
  let totalIcones = 0, colisoesTotal = 0;

  for (const pagina of paginas) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    try {
      await page.goto(BASE + pagina, { waitUntil: 'load' });
      /* O JS escreve navegação, rodapé e listas depois do load. */
      await new Promise((r) => setTimeout(r, 1200));

      const r = await page.evaluate(() => {
        const vazios = new Set();
        let n = 0, colisoes = 0;
        for (const el of document.querySelectorAll('.ph')) {
          const nome = [...el.classList].find((c) => c.startsWith('ph-'));
          /* `.ph` sem nenhum `ph-*` não é um ícone. As páginas do AURORA e do
             YANC usam `<div class="ph">` como placeholder de screenshot, o "ph"
             de placeholder colidindo com o "ph" de Phosphor. Elas redefinem
             `.shot .ph` por cima e escondem o elemento quando a imagem chega,
             então não há nada quebrado ali — mas também não há máscara a
             cobrar, e cobrar transformaria este teste num alarme que ninguém
             pode silenciar. Fica contado e à parte. */
          if (!nome) { colisoes++; continue; }
          n++;
          if (!getComputedStyle(el).getPropertyValue('--ph').trim()) vazios.add(nome);
        }
        return { n, colisoes, vazios: [...vazios] };
      });

      totalIcones += r.n;
      if (r.colisoes) colisoesTotal += r.colisoes;
      const marca = r.vazios.length ? 'FALTA' : 'ok   ';
      console.log('  ' + marca + ' ' + pagina.padEnd(38) + String(r.n).padStart(3) + ' ícones'
        + (r.vazios.length ? '   sem --ph: ' + r.vazios.join(', ') : ''));
      if (r.vazios.length) falhas.push(pagina + ' -> ' + r.vazios.join(', '));
    } catch (e) {
      console.log('  ERRO  ' + pagina + ': ' + e.message);
      falhas.push(pagina + ': ' + e.message);
    }
    await page.close();
  }

  await browser.disconnect();

  console.log('');
  if (falhas.length) {
    console.log('FALHOU: ' + falhas.length + ' página(s) desenhariam quadrados sólidos.');
    falhas.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  if (colisoesTotal) console.log('(' + colisoesTotal + ' elementos .ph sem ph-*: placeholders do AURORA e do YANC, colisao de nome preexistente)');
  console.log('PASSOU: ' + totalIcones + ' ícones em ' + paginas.length + ' páginas, todos com máscara.');
})().catch((e) => { console.error('erro:', e.message); process.exit(2); });
