/* As páginas dos cursos, abertas num navegador de verdade.
   ------------------------------------------------------------------
   Cada página de library/courses/ é aberta em tela de computador e de celular,
   e reprova se o console acusar erro, se algum pedido falhar ou se a página
   rolar para os lados. Em cada deck, o teste faz o que quem apresenta faz:
   anda com a seta, abre o slide pelo #n, toca o vídeo no primeiro toque e
   confere que ele está andando, abre as anotações e as teclas, e no celular
   desliza o dedo para trocar de slide.

   Os vídeos e os PDFs vivem no CDN. Com o clone do nipscern-assets ao lado
   deste repositório, os pedidos a cdn.nipscern.com são respondidos com os
   arquivos de lá, o que testa o que ainda não foi publicado; sem o clone, eles
   vão à rede.

   Uso:
     1) npm run dev
     2) msedge --headless=new --remote-debugging-port=9222 \
               --user-data-dir=<pasta temporária> about:blank
     3) node tools/test-courses.js [--shots <pasta>]
*/
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BROWSER = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
const BASE = process.env.TEST_BASE || 'http://localhost:3000/';
const ROOT = path.join(__dirname, '..');
const ASSETS = path.resolve(ROOT, process.env.ASSETS_DIR || '../nipscern-assets');
const i = process.argv.indexOf('--shots');
const SHOTS = i > -1 ? path.resolve(process.argv[i + 1]) : null;

const TELAS = {
  computador: { width: 1440, height: 900, deviceScaleFactor: 1 },
  celular: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

function paginas() {
  const lista = [];
  (function anda(dir) {
    for (const nome of fs.readdirSync(dir)) {
      const p = path.join(dir, nome);
      if (fs.statSync(p).isDirectory()) anda(p);
      else if (nome === 'index.html') lista.push(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  })(path.join(ROOT, 'library', 'courses'));
  return lista.sort();
}

const TIPOS = { '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.webp': 'image/webp' };

/* Responde de cdn.nipscern.com com o clone local, e com 206 quando o navegador
   pede um pedaço, que é como ele pede vídeo. */
async function comCdnLocal(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('https://cdn.nipscern.com/')) return req.continue();
    const local = path.join(ASSETS, decodeURIComponent(new URL(url).pathname));
    if (!fs.existsSync(local)) return req.continue();
    const corpo = fs.readFileSync(local);
    const tipo = TIPOS[path.extname(local)] || 'application/octet-stream';
    const faixa = /bytes=(\d+)-(\d*)/.exec(req.headers().range || '');
    if (faixa) {
      const ini = +faixa[1];
      const fim = faixa[2] ? Math.min(+faixa[2], corpo.length - 1) : corpo.length - 1;
      return req.respond({
        status: 206, body: corpo.subarray(ini, fim + 1),
        headers: { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${ini}-${fim}/${corpo.length}` },
      });
    }
    return req.respond({ status: 200, body: corpo, headers: { 'Content-Type': tipo, 'Accept-Ranges': 'bytes' } });
  });
}

async function abre(browser, pagina, tela, hash = '') {
  const page = await browser.newPage();
  await page.emulate({ viewport: TELAS[tela], userAgent: tela === 'celular'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    : (await browser.userAgent()) });
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  page.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  page.on('requestfailed', (r) => erros.push('falhou: ' + r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('response', (r) => { if (r.status() >= 400) erros.push(r.status() + ': ' + r.url()); });
  await comCdnLocal(page);
  await page.goto(BASE + pagina.replace(/index\.html$/, '') + hash, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 900));
  return { page, erros };
}

const estado = (page) => page.evaluate(() => {
  const s = [...document.querySelectorAll('#palco > section')];
  const atual = s.findIndex((x) => x.classList.contains('atual'));
  const v = s[atual] && s[atual].querySelector('video');
  return { n: s.length, atual: atual + 1, hash: location.hash, video: v ? { t: v.currentTime, pausado: v.paused } : null };
});

async function testaDeck(browser, pagina, tela, falhas) {
  const nome = `${pagina} [${tela}]`;
  const confere = (ok, msg) => { if (!ok) falhas.push(`${nome}: ${msg}`); };
  const { page, erros } = await abre(browser, pagina, tela, '#3');
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const vai = async (n) => { await page.evaluate((k) => { location.hash = '#' + k; }, n); await espera(500); };
  const cdp = tela === 'celular' ? await page.target().createCDPSession() : null;
  const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  /* No celular, um toque no alto do palco acorda a barra, como faz quem usa;
     depois, o botão de avançar. No computador, o espaço. */
  const avanca = async () => {
    if (tela === 'computador') return page.keyboard.press('Space');
    await toque('touchStart', 30, 150); await toque('touchEnd');
    await espera(150);
    return page.tap('#proximo');
  };

  let e = await estado(page);
  confere(e.atual === 3, `#3 abriu o slide ${e.atual}`);

  if (tela === 'computador') {
    /* A seta e o Page Up entre os slides 1 e 2, que não têm vídeo em aula
       nenhuma: num slide com vídeo, a seta toca o vídeo, e é para tocar. */
    await vai(1);
    await page.keyboard.press('ArrowRight');
    e = await estado(page);
    confere(e.atual === 2 && e.hash === '#2', `a seta levou a ${e.atual} (${e.hash})`);
    await page.keyboard.press('PageUp');
    e = await estado(page);
    confere(e.atual === 1, `Page Up levou a ${e.atual}`);

    await page.keyboard.press('KeyN');
    const notas = await page.evaluate(() => {
      const n = document.getElementById('notas');
      const a = document.querySelector('#palco > section.atual aside');
      const limpa = (x) => x.replace(/\s+/g, '');
      return { visivel: !n.hidden && n.offsetHeight > 0,
        igual: limpa(document.getElementById('notas-texto').textContent) === limpa(a ? a.textContent : '') };
    });
    confere(notas.visivel && notas.igual, `as anotações não abriram com o texto do slide (${JSON.stringify(notas)})`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, nome.replace(/[\/\[\] ]+/g, '_') + '-notas.png') });
    await page.keyboard.press('KeyN');
    await page.keyboard.press('KeyH');
    confere(await page.evaluate(() => !document.getElementById('ajuda').hidden), 'H não abriu as teclas');
    await page.keyboard.press('Escape');
    confere(await page.evaluate(() => document.getElementById('ajuda').hidden), 'Esc não fechou as teclas');
  }

  /* Todo vídeo do deck: o primeiro toque toca, sem sair do slide, e o vídeo anda;
     o segundo avança. */
  await page.reload({ waitUntil: 'networkidle0' });   // todos os vídeos de novo pendentes
  const comVideo = await page.evaluate(() => [...document.querySelectorAll('#palco > section')]
    .map((s, k) => (s.querySelector('img[data-video], video') ? k + 1 : 0)).filter(Boolean));
  for (const n of comVideo) {
    await vai(n);
    await avanca();
    await espera(2000);
    e = await estado(page);
    confere(e.atual === n, `o primeiro toque no slide ${n} saiu do slide (${e.atual})`);
    confere(e.video && !e.video.pausado && e.video.t > 0.5, `o vídeo do slide ${n} não está tocando (${JSON.stringify(e.video)})`);
    if (SHOTS && n === comVideo[0]) await page.screenshot({ path: path.join(SHOTS, nome.replace(/[\/\[\] ]+/g, '_') + '-video.png') });
    await avanca();
    await espera(300);
    e = await estado(page);
    confere(e.atual === n + 1, `o segundo toque no slide ${n} não avançou (${e.atual})`);
  }
  /* E o clique no quadro, no primeiro deles, com o vídeo ainda parado. */
  if (comVideo.length && tela === 'computador') {
    await page.reload({ waitUntil: 'networkidle0' });
    await vai(comVideo[0]);
    const caixa = await page.evaluate(() => {
      const r = document.querySelector('#palco > section.atual video').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(caixa.x, caixa.y);
    await espera(1800);
    e = await estado(page);
    confere(e.video && !e.video.pausado && e.video.t > 0.3, `o clique no quadro não tocou o vídeo (${JSON.stringify(e.video)})`);
  }
  if (comVideo.length) console.log(`         ${comVideo.length} vídeo(s) tocados: slides ${comVideo.join(', ')}`);

  if (tela === 'celular') {
    await vai(2);
    await toque('touchStart', 320, 300); await toque('touchMove', 200, 300); await toque('touchMove', 80, 300); await toque('touchEnd');
    await espera(500);
    e = await estado(page);
    confere(e.atual === 3, `deslizar para a esquerda levou a ${e.atual}`);
  }
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, nome.replace(/[\/\[\] ]+/g, '_') + '.png') });
  erros.forEach((x) => falhas.push(`${nome}: ${x}`));
  await page.close();
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.connect({ browserURL: BROWSER });
  const falhas = [];
  for (const pagina of paginas()) {
    for (const tela of Object.keys(TELAS)) {
      if (pagina.endsWith('/slides/index.html')) {
        await testaDeck(browser, pagina, tela, falhas);
        console.log(`  deck   ${pagina} [${tela}]`);
        continue;
      }
      const { page, erros } = await abre(browser, pagina, tela);
      const r = await page.evaluate(async () => {
        /* desce a página inteira, para as entradas .fade-up e as imagens lazy virem */
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
        scrollTo(0, 0);
        const quebradas = [...document.images].filter((im) => im.complete && im.naturalWidth === 0 && im.src).map((im) => im.src);
        return { largura: document.documentElement.scrollWidth, janela: innerWidth, quebradas };
      });
      if (r.largura > r.janela + 1) erros.push(`rola para o lado: ${r.largura}px numa janela de ${r.janela}px`);
      r.quebradas.forEach((s) => erros.push('imagem quebrada: ' + s));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${pagina}-${tela}.png`.replace(/[\/]+/g, '_')), fullPage: true });
      erros.forEach((x) => falhas.push(`${pagina} [${tela}]: ${x}`));
      console.log(`  ${erros.length ? 'FALHA' : 'ok   '}  ${pagina} [${tela}]`);
      await page.close();
    }
  }
  browser.disconnect();
  if (falhas.length) {
    console.error('\n' + falhas.length + ' problema(s):');
    falhas.forEach((f) => console.error('  ' + f));
    process.exit(1);
  }
  console.log('\ntodas as páginas dos cursos passaram');
})();
