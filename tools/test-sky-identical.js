/* O céu não pode mudar de aparência.
   ------------------------------------------------------------------
   `drawStar` deixou de embutir o alfa em cada string de cor e passou a usar
   globalAlpha. A troca é aritmeticamente neutra — no source-over o alfa da
   origem é multiplicado pelo globalAlpha — mas "aritmeticamente neutra" é uma
   afirmação, e o pedido foi que a aparência não mudasse. Então isto compara os
   pixels.

   As duas versões de drawStar são reproduzidas aqui e desenhadas lado a lado
   num navegador de verdade, sobre o mesmo conjunto de estrelas e os mesmos
   valores de alfa e de `grow`, incluindo os três caminhos que a função tem:
   só núcleo, núcleo com brilho, e núcleo com brilho e espículas. Depois lê
   getImageData dos dois e conta quantos bytes diferem.

   Uso:
     1) suba um Chromium com porta de depuração:
        msedge --headless=new --remote-debugging-port=9222 \
               --user-data-dir=<pasta temporária> about:blank
     2) node tools/test-sky-identical.js

   Sai 0 se nenhum byte diferir. Também imprime o tempo das duas versões, que é
   o motivo da mudança existir.

   Se algum dia drawStar mudar em main, as cópias daqui têm que mudar junto —
   é o preço de comparar duas versões, e é por isso que o teste imprime os dois
   trechos de código no fim quando falha.
*/
const puppeteer = require('puppeteer-core');

const BROWSER = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
const QUADROS = 240;

const PAGINA = `<!doctype html><meta charset="utf-8">
<canvas id="a" width="900" height="600"></canvas>
<canvas id="b" width="900" height="600"></canvas>
<script>
const radiusFor = (mag) => Math.max(0.55, 0.55 + (6 - mag) * 0.27);
const alphaFor  = (mag) => Math.max(0.42, Math.min(1, 0.42 + (6 - mag) * 0.105));

/* ---- versão antiga: alfa embutido em cada string ---- */
function antigo(c, px, py, mag, rgb, a, grow) {
  const r = radiusFor(mag) * (grow || 1);
  const [rr, gg, bb] = rgb;
  const col = (al) => 'rgba(' + rr + ',' + gg + ',' + bb + ',' + al.toFixed(3) + ')';
  if (mag < 2.4) {
    const gr = r * (mag < 1.0 ? 6.5 : 4.4);
    const gl = c.createRadialGradient(px, py, 0, px, py, gr);
    gl.addColorStop(0, col(a * 0.42));
    gl.addColorStop(0.45, col(a * 0.10));
    gl.addColorStop(1, col(0));
    c.fillStyle = gl;
    c.beginPath(); c.arc(px, py, gr, 0, 6.283185); c.fill();
  }
  if (mag < 1.8) {
    const len = r * (3.4 + (1.8 - mag) * 2.6);
    c.lineCap = 'round';
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const g2 = c.createLinearGradient(px - dx*len, py - dy*len, px + dx*len, py + dy*len);
      g2.addColorStop(0, col(0));
      g2.addColorStop(0.5, col(a * 0.55));
      g2.addColorStop(1, col(0));
      c.strokeStyle = g2;
      c.lineWidth = Math.max(0.6, r * 0.30);
      c.beginPath(); c.moveTo(px - dx*len, py - dy*len); c.lineTo(px + dx*len, py + dy*len); c.stroke();
    }
  }
  c.fillStyle = col(a);
  c.beginPath(); c.arc(px, py, r, 0, 6.283185); c.fill();
}

/* ---- versão nova: alfa no globalAlpha, cores constantes ---- */
const NUCLEOS = new Map();
function corDoNucleo(rgb){const k=rgb[0]*65536+rgb[1]*256+rgb[2];let s=NUCLEOS.get(k);
 if(s===undefined){s='rgb('+rgb[0]+','+rgb[1]+','+rgb[2]+')';NUCLEOS.set(k,s);}return s;}
function novo(c, px, py, mag, rgb, a, grow) {
  const r = radiusFor(mag) * (grow || 1);
  const [rr, gg, bb] = rgb;
  const col = (al) => 'rgba(' + rr + ',' + gg + ',' + bb + ',' + al.toFixed(3) + ')';
  if (mag < 2.4) {
    const gr = r * (mag < 1.0 ? 6.5 : 4.4);
    const gl = c.createRadialGradient(px, py, 0, px, py, gr);
    gl.addColorStop(0, col(a * 0.42));
    gl.addColorStop(0.45, col(a * 0.10));
    gl.addColorStop(1, col(0));
    c.fillStyle = gl;
    c.beginPath(); c.arc(px, py, gr, 0, 6.283185); c.fill();
  }
  if (mag < 1.8) {
    const len = r * (3.4 + (1.8 - mag) * 2.6);
    c.lineCap = 'round';
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const g2 = c.createLinearGradient(px - dx*len, py - dy*len, px + dx*len, py + dy*len);
      g2.addColorStop(0, col(0));
      g2.addColorStop(0.5, col(a * 0.55));
      g2.addColorStop(1, col(0));
      c.strokeStyle = g2;
      c.lineWidth = Math.max(0.6, r * 0.30);
      c.beginPath(); c.moveTo(px - dx*len, py - dy*len); c.lineTo(px + dx*len, py + dy*len); c.stroke();
    }
  }
  c.globalAlpha = Math.round(a * 1000) / 1000;
  c.fillStyle = corDoNucleo(rgb);
  c.beginPath(); c.arc(px, py, r, 0, 6.283185); c.fill();
  c.globalAlpha = 1;
}

/* Um céu determinístico: mesmo gerador, mesmas estrelas, mesmos dois canvas.
   As magnitudes cobrem de propósito os três caminhos da função. */
function semente(s) { return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function ceu() {
  const rnd = semente(20260810);
  const out = [];
  for (let i = 0; i < 1600; i++) {
    const mag = 0.4 + rnd() * 5.1;
    out.push({ px: rnd() * 900, py: rnd() * 600, mag,
               rgb: [210, 225, 255],
               f1: 0.55 + rnd() * 1.5, f2: 1.7 + rnd() * 2.6,
               p1: rnd() * 6.283, p2: rnd() * 6.283,
               amp: 0.19 + (mag / 6) * 0.42 });
  }
  return out;
}

/* Sobre o fundo do site, não sobre transparência.
   ------------------------------------------------------------------
   Comparar os dois canvas transparentes mede a coisa errada. Na borda do
   brilho de uma estrela o alfa é quase zero, e o RGB de um pixel de alfa zero
   não é definido: um dos canvas guarda (0,0,0,0) e o outro (210,225,255,1), o
   que dá diferença de 255 num canal que ninguém enxerga. O céu é pintado sobre
   --bg-0, então é sobre --bg-0 que a comparação tem sentido — a diferença
   medida passa a ser a diferença que um leitor teria como ver. */
const FUNDO = '#070a12';

function desenhar(fn, ctx, estrelas, t) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, 900, 600);
  for (const s of estrelas) {
    const w = 1 + s.amp * (Math.sin(t * s.f1 + s.p1) * 0.62 + Math.sin(t * s.f2 + s.p2) * 0.38);
    const a = Math.max(0.08, Math.min(1, alphaFor(s.mag) * w));
    fn(ctx, s.px, s.py, s.mag, s.rgb, a, 1 + (w - 1) * 0.35);
  }
}

window.rodar = (quadros) => {
  const estrelas = ceu();
  const ca = document.getElementById('a').getContext('2d', { willReadFrequently: true });
  const cb = document.getElementById('b').getContext('2d', { willReadFrequently: true });

  let diferentes = 0, maiorDif = 0, amostrados = 0;
  for (let k = 0; k < 12; k++) {
    const t = k * 0.37;
    desenhar(antigo, ca, estrelas, t);
    desenhar(novo,   cb, estrelas, t);
    const A = ca.getImageData(0, 0, 900, 600).data;
    const B = cb.getImageData(0, 0, 900, 600).data;
    amostrados += A.length;
    for (let i = 0; i < A.length; i++) {
      const d = Math.abs(A[i] - B[i]);
      if (d) { diferentes++; if (d > maiorDif) maiorDif = d; }
    }
  }

  const cron = (fn, ctx) => {
    desenhar(fn, ctx, estrelas, 0);            // aquece
    const t0 = performance.now();
    for (let k = 0; k < quadros; k++) desenhar(fn, ctx, estrelas, k * 0.11);
    return performance.now() - t0;
  };
  const msAntigo = cron(antigo, ca);
  const msNovo   = cron(novo,   cb);

  return { diferentes, maiorDif, amostrados, msAntigo, msNovo, quadros, estrelas: estrelas.length };
};
</script>`;

(async () => {
  const browser = await puppeteer.connect({ browserURL: BROWSER });
  const page = await browser.newPage();
  await page.setContent(PAGINA, { waitUntil: 'load' });
  const r = await page.evaluate((q) => window.rodar(q), QUADROS);
  await page.close();
  await browser.disconnect();

  console.log('  estrelas por quadro   ' + r.estrelas);
  console.log('  bytes comparados      ' + r.amostrados.toLocaleString('pt-BR') + '  (12 quadros, RGBA)');
  console.log('  bytes diferentes      ' + r.diferentes + (r.diferentes ? '  (maior diferença: ' + r.maiorDif + '/255)' : ''));
  console.log('');
  console.log('  ' + r.quadros + ' quadros, versão antiga  ' + r.msAntigo.toFixed(0) + ' ms');
  console.log('  ' + r.quadros + ' quadros, versão nova    ' + r.msNovo.toFixed(0) + ' ms'
    + '   (' + (r.msAntigo / r.msNovo).toFixed(2) + 'x)');
  console.log('');

  if (r.diferentes === 0) {
    console.log('PASSOU: nenhum pixel difere.');
    process.exit(0);
  }
  console.log('FALHOU: o céu mudou de aparência.');
  process.exit(1);
})().catch((e) => { console.error('erro:', e.message); process.exit(2); });
