/* O visualizador do CGV não pode ser carregado na abertura da home.
   ------------------------------------------------------------------
   O iframe é de mesma origem, então tudo que ele faz — buscar 261 KB de
   three.js de um CDN de terceiro e montar um contexto WebGL — acontece na mesma
   thread principal que o hero está tentando pintar. Nas medições ele era o
   segundo maior consumidor de tempo de thread da página inteira.

   Ele é armado por um IntersectionObserver. O anel valia 1400px, depois 150% da
   viewport, e as duas coisas alcançavam a dobra: medido, o topo do stage fica
   entre 102% e 126% de uma tela abaixo dela, em celular, tablet e desktop. Ou
   seja, "uma tela e meia de antecedência" sempre foi, na prática, "agora".

   Este teste fixa as duas metades do combinado:

     não carregar quando a página abre
     carregar quando o leitor rola até perto

   Um teste que só verificasse a primeira passaria com o observador desligado.

   O app do CGV é servido por um Worker e responde 404 num checkout local, então
   as respostas dele são simuladas aqui. O que está sendo testado é a lógica de
   armar, não o visualizador.

   Uso:
     1) npm run dev
     2) msedge --headless=new --remote-debugging-port=9222 \
               --user-data-dir=<pasta temporária> about:blank
     3) node tools/test-cgv-defer.js
*/
const puppeteer = require('puppeteer-core');

const BROWSER = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
const URL = process.env.TEST_URL || 'http://localhost:3000/index.html';
const TELAS = [
  { w: 390, h: 844, nome: 'celular' },
  { w: 820, h: 1180, nome: 'tablet' },
  { w: 1440, h: 900, nome: 'desktop' },
];

const ehPesado = (r) =>
  /three\.module/.test(r.u) ||
  (/cgvweb\/nipscern\/index\.html/.test(r.u) && r.m !== 'HEAD');

(async () => {
  const browser = await puppeteer.connect({ browserURL: BROWSER });
  const falhas = [];

  for (const t of TELAS) {
    const page = await browser.newPage();
    await page.setViewport({ width: t.w, height: t.h });

    const req = [];
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      req.push({ u: r.url(), m: r.method() });
      /* O visualizador real não existe localmente. Um documento vazio basta:
         o que importa é se o navegador chegou a pedi-lo. */
      if (/cgvweb\/nipscern\/index\.html/.test(r.url())) {
        return r.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title>' });
      }
      r.continue();
    });

    await page.goto(URL, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 2500));
    const naAbertura = req.filter(ehPesado).length;

    const distancia = await page.evaluate(() => {
      const s = document.getElementById('cgv-stage');
      const r = s.getBoundingClientRect();
      return Math.round(r.top + window.scrollY - window.innerHeight);
    });

    await page.evaluate(() => document.getElementById('cgv-stage').scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 3000));
    const aoRolar = req.filter(ehPesado).length;

    const pct = Math.round((distancia / t.h) * 100);
    console.log('  ' + t.nome.padEnd(9) +
      ' stage a ' + String(distancia).padStart(5) + 'px da dobra (' + String(pct).padStart(4) + '% da tela)' +
      ' | abertura: ' + naAbertura + ' | apos rolar: ' + aoRolar);

    if (naAbertura > 0) falhas.push(t.nome + ': o visualizador foi armado na abertura da página');
    if (aoRolar === 0) falhas.push(t.nome + ': o visualizador NÃO foi armado ao rolar até ele');

    await page.close();
  }

  await browser.disconnect();

  if (falhas.length) {
    console.log('\nFALHOU:');
    falhas.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('\nPASSOU: adiado na abertura e carregado ao chegar perto, nas três telas.');
})().catch((e) => { console.error('erro:', e.message); process.exit(2); });
