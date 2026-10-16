/* Medidas de desempenho do site, para comparar antes e depois.
   ------------------------------------------------------------------
   Abre cada página num Edge headless, com perfil novo e cache vazio, no
   computador e no celular, e mede quatro coisas:

   1. A carga, pelo Lighthouse 13.5.0, a mesma versão do PageSpeed Insights:
      nota, FCP, LCP, TBT, CLS, Speed Index, bytes e trabalho da thread
      principal. Celular com o perfil padrão do Lighthouse (Moto G Power, 4G
      lento, CPU 4x); computador com o perfil de desktop dele.
   2. A página parada no topo por 5 s, sem ninguém mexer: quanto da thread
      principal, do compositor, da rasterização e da GPU fica ocupado, e
      quantas vezes por segundo a página pede requestAnimationFrame. É aqui que
      aparece animação que nunca para.
   3. A rolagem da página inteira (até 12.000 px, a 1.500 px/s), com roda de
      mouse no computador e dedo no celular: quadros por segundo, a parte dos
      quadros que a tela esperava e recebeu, o pior intervalo, os engasgos de
      mais de 50 ms e os long animation frames.
   4. No celular, o toque no botão do menu, pela Event Timing API: o tempo do
      toque até o próximo quadro, que é o que o INP mede.

   O computador é 1536 × 864 com DPR 1,25 (uma tela de 1920 × 1080 com zoom de
   125%, a mais comum em notebook) e CPU sem freio; o celular é 390 × 844 com
   DPR 3, toque e CPU 4x mais lenta. A GPU não tem freio: o número de GPU é o
   desta máquina, e vale para comparar antes e depois, não entre máquinas. O
   ambiente (CPU, GPU, versão do Edge, intervalo de quadro da tela) vai junto
   com o resultado.

   Os beacons de análise (GoatCounter, Google Analytics, Bing, Cloudflare Web
   Analytics, Zaraz) ficam bloqueados: centenas de visitas sintéticas sujariam
   as estatísticas do site. Os scripts deles carregam normalmente; só o envio
   da visita não sai.

   Uso:
     npm run dev                                     # para medir o local
     node tools/perf/measure.js --label local-antes
     node tools/perf/measure.js --base https://www.nipscern.com/ --label prod-antes
     node tools/perf/compare.js docs/perf/local-antes.json docs/perf/local-depois.json

   Opções: --runs N (3), --only home,about (nomes da lista PAGINAS),
   --profiles desktop,mobile, --query fx=lite (acrescentado à URL de cada
   página, para medir uma flag), --no-lighthouse, --no-runtime.

   Saída: docs/perf/<label>.json e .md (as medianas, que entram no git) e
   tools/perf/.out/<label>/ (cada execução e os relatórios do Lighthouse,
   fora do git). */
'use strict';
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
/* A porta de depuração do Edge, que o Lighthouse usa. Escolhida pelo sistema
   (0) e lida do endereço do navegador: uma porta fixa ficava presa ao Edge da
   rodada anterior enquanto ele fechava, e a rodada seguinte não abria. */
let PORTA = 0;

const PAGINAS = [
  ['home', ''],
  ['about', 'about'],
  ['cern', 'cern'],
  ['projects', 'projects/'],
  ['sapho', 'projects/sapho'],
  ['cgv', 'projects/cgv'],
  ['aurora', 'projects/aurora'],
  ['hits', 'projects/hits'],
  ['yanc', 'projects/yanc'],
  ['polaris', 'projects/polaris'],
  ['archived', 'projects/archived'],
  ['publications', 'publications'],
  ['courier', 'publications/courier'],
  ['news', 'news/'],
  ['news-post', 'news/post?id=cgvweb-atlas-control-room'],
  ['noodle', 'noodle'],
  ['qa', 'qa'],
  ['credits', 'credits'],
  ['courses', 'library/courses/'],
  ['course-ea1', 'library/courses/eletronica-analogica-1/'],
  ['limiar-slides', 'library/courses/limiar/class-02/slides/'],
];

const PERFIS = {
  desktop: {
    viewport: { width: 1536, height: 864, deviceScaleFactor: 1.25 },
    cpu: 1,
    gesto: 'mouse',
  },
  mobile: {
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    cpu: 4,
    gesto: 'touch',
    ua: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
  },
};

const BLOQUEIO = [
  '*nipscern.goatcounter.com/count*',
  '*google-analytics.com/*collect*',
  '*analytics.google.com/*collect*',
  '*bat.bing.com/action*',
  '*cdn-cgi/rum*',
  '*/cdn-cgi/zaraz/t',
  '*/cdn-cgi/zaraz/t?*',
];

const ROLAGEM_MAX = 12000;
const ROLAGEM_VEL = 1500;
const PARADO_MS = 5000;

function opcoes() {
  const a = process.argv.slice(2);
  const val = (k, d) => { const i = a.indexOf('--' + k); return i > -1 ? a[i + 1] : d; };
  const tem = (k) => a.includes('--' + k);
  const o = {
    base: val('base', 'http://127.0.0.1:3000/').replace(/\/?$/, '/'),
    label: val('label', null),
    runs: Math.max(1, +val('runs', '3')),
    only: val('only', ''),
    perfis: val('profiles', 'desktop,mobile').split(',').filter(Boolean),
    query: val('query', ''),
    lighthouse: !tem('no-lighthouse'),
    runtime: !tem('no-runtime'),
  };
  if (!o.label) throw new Error('falta --label, o nome desta medição (por exemplo local-antes)');
  if (!/^[a-z0-9._-]+$/i.test(o.label)) throw new Error('--label só com letras, números, ponto, hífen e sublinhado');
  for (const p of o.perfis) if (!PERFIS[p]) throw new Error(`perfil desconhecido: ${p}`);
  return o;
}

function urlDe(o, caminho) {
  const u = o.base + caminho;
  if (!o.query) return u;
  return u + (u.includes('?') ? '&' : '?') + o.query;
}

/* ---------- o que roda dentro da página ---------- */

/* Instalado antes de qualquer script da página. Os observers usam buffered,
   então pegam também o que aconteceu antes deles. O requestAnimationFrame é
   embrulhado só para contar quantas vezes a página o pede; o gravador de
   quadros usa o original, para não se contar. */
function INSTALA() {
  const P = (window.__perf = { lt: [], loaf: [], ls: [], lcp: [], ev: [], paint: [], raf: 0 });
  const obs = (type, fn, extra) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe(Object.assign({ type, buffered: true }, extra || {}));
    } catch (e) { /* tipo não suportado */ }
  };
  const nome = (el) => {
    if (!el || !el.tagName) return '';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s;
  };
  obs('longtask', (e) => P.lt.push([e.startTime, e.duration]));
  obs('long-animation-frame', (e) => P.loaf.push([e.startTime, e.duration, e.blockingDuration || 0,
    (e.scripts || []).slice(0, 3).map((s) => `${String(s.sourceURL || '').split('/').pop().split('?')[0]}:${s.sourceFunctionName || s.invoker || ''}:${Math.round(s.duration)}`)]));
  obs('layout-shift', (e) => { if (!e.hadRecentInput) P.ls.push([e.startTime, e.value]); });
  obs('largest-contentful-paint', (e) => P.lcp.push([e.startTime, nome(e.element), e.size, e.url || '']));
  obs('paint', (e) => P.paint.push([e.name, e.startTime]));
  obs('event', (e) => P.ev.push([e.name, e.startTime, e.duration]), { durationThreshold: 16 });
  const raf = window.requestAnimationFrame;
  P.rafOriginal = raf;
  window.requestAnimationFrame = function (cb) { P.raf++; return raf.call(window, cb); };
}

function GRAVA_INICIO(marca) {
  const P = window.__perf;
  P.quadros = [];
  P.gravando = true;
  P.raf0 = P.raf;
  P.loaf0 = P.loaf.length;
  P.t0 = performance.now();
  performance.mark(marca);
  const laco = (t) => { if (!P.gravando) return; P.quadros.push(t); P.rafOriginal.call(window, laco); };
  P.rafOriginal.call(window, laco);
}

function GRAVA_FIM(marca) {
  const P = window.__perf;
  P.gravando = false;
  performance.mark(marca);
  const q = P.quadros;
  const d = [];
  for (let i = 1; i < q.length; i++) d.push(q[i] - q[i - 1]);
  const loaf = P.loaf.slice(P.loaf0);
  return {
    ms: performance.now() - P.t0,
    intervalos: d,
    raf: P.raf - P.raf0,
    loaf: loaf.length,
    loafBloqueio: loaf.reduce((a, l) => a + l[2], 0),
    loafPiores: loaf.sort((a, b) => b[1] - a[1]).slice(0, 3).map((l) => `${Math.round(l[1])}ms ${l[3].join(' ')}`),
  };
}

function CARGA() {
  const P = window.__perf;
  const n = performance.getEntriesByType('navigation')[0] || {};
  const fcp = (P.paint.find((p) => p[0] === 'first-contentful-paint') || [])[1];
  const lcp = P.lcp[P.lcp.length - 1] || [];
  let cls = 0, janela = 0, ini = -1, ult = -1;
  for (const [t, v] of P.ls) {
    if (ult < 0 || t - ult > 1000 || t - ini > 5000) { janela = 0; ini = t; }
    janela += v; ult = t; cls = Math.max(cls, janela);
  }
  const tbt = fcp == null ? 0 : P.lt.filter(([s]) => s >= fcp).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
  const videos = [...document.querySelectorAll('video')];
  return {
    ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd,
    fcp: fcp == null ? null : fcp, lcp: lcp[0] == null ? null : lcp[0], lcpEl: lcp[1] || '',
    cls: +cls.toFixed(4), tbt: Math.round(tbt), longTasks: P.lt.length,
    elementos: document.getElementsByTagName('*').length,
    iframes: document.querySelectorAll('iframe').length,
    canvas: document.querySelectorAll('canvas').length,
    videos: videos.length, videosTocando: videos.filter((v) => !v.paused).length,
    altura: document.documentElement.scrollHeight,
  };
}

/* ---------- utilidades ---------- */

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const mediana = (xs) => {
  const v = xs.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const pct = (xs, p) => {
  const v = [...xs].sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
};
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

/* Os intervalos entre quadros, lidos contra o intervalo da tela (vsync). Um
   quadro "entregue" é um que a tela esperava e recebeu: em 1 s numa tela de
   165 Hz cabem 165; se a página entregou 120, entregou 73%. */
function quadros(g, vsync) {
  const d = g.intervalos;
  const soma = d.reduce((a, b) => a + b, 0);
  if (!d.length || !soma) return { fps: null, entregues: null, p95: null, pior: null, engasgos50: null };
  return {
    fps: r1(d.length / (soma / 1000)),
    entregues: r1(100 * Math.min(1, d.length / (soma / vsync))),
    p95: r1(pct(d, 0.95)),
    pior: r1(Math.max(...d)),
    engasgos50: d.filter((x) => x > 50).length,
    rafPorSeg: r1(g.raf / (g.ms / 1000)),
    loaf: g.loaf,
    loafBloqueio: Math.round(g.loafBloqueio),
    loafPiores: g.loafPiores,
  };
}

/* Quanto cada thread ficou ocupada entre as duas marcas, em % do tempo. Soma
   a união dos intervalos das tarefas de topo (categoria toplevel) de cada
   thread, para não contar duas vezes uma tarefa dentro da outra. O
   compositor, a rasterização e a thread principal são as do processo da
   página (o que tem as marcas); a GPU e o Viz são do processo da GPU. A
   rasterização tem várias threads, então passa de 100% quando mais de uma
   trabalha ao mesmo tempo. */
function ocupacao(trace, m0, m1) {
  const ev = trace.traceEvents || trace;
  const proc = {}, thr = {};
  let t0 = null, t1 = null, pidPagina = null;
  for (const e of ev) {
    if (e.ph === 'M' && e.name === 'process_name') proc[e.pid] = e.args.name;
    if (e.ph === 'M' && e.name === 'thread_name') thr[e.pid + ':' + e.tid] = e.args.name;
    if (e.name === m0 && (e.cat || '').includes('user_timing')) { t0 = e.ts; pidPagina = e.pid; }
    if (e.name === m1 && (e.cat || '').includes('user_timing')) t1 = e.ts;
  }
  if (t0 == null || t1 == null || t1 <= t0) return null;
  const iv = {};
  for (const e of ev) {
    if (e.ph !== 'X' || !e.dur || !(e.cat || '').split(',').includes('toplevel')) continue;
    const s = Math.max(e.ts, t0), f = Math.min(e.ts + e.dur, t1);
    if (f <= s) continue;
    (iv[e.pid + ':' + e.tid] = iv[e.pid + ':' + e.tid] || []).push([s, f]);
  }
  const uniao = (xs) => {
    xs.sort((a, b) => a[0] - b[0]);
    let tot = 0, cs = -1, cf = -1;
    for (const [s, f] of xs) {
      if (s > cf) { if (cf > cs) tot += cf - cs; cs = s; cf = f; } else cf = Math.max(cf, f);
    }
    if (cf > cs) tot += cf - cs;
    return tot;
  };
  const g = { principal: 0, compositor: 0, raster: 0, gpu: 0, viz: 0 };
  for (const k of Object.keys(iv)) {
    const pid = +k.split(':')[0];
    const p = proc[pid] || '', t = thr[k] || '';
    let grupo = null;
    if (pid === pidPagina && t === 'CrRendererMain') grupo = 'principal';
    else if (pid === pidPagina && t === 'Compositor') grupo = 'compositor';
    else if (pid === pidPagina && /CompositorTileWorker|Raster/.test(t)) grupo = 'raster';
    else if (/GPU/i.test(p) && t === 'CrGpuMain') grupo = 'gpu';
    else if (/GPU/i.test(p) && /VizCompositor/.test(t)) grupo = 'viz';
    if (grupo) g[grupo] += uniao(iv[k]);
  }
  const span = t1 - t0;
  for (const k of Object.keys(g)) g[k] = r1((100 * g[k]) / span);
  return g;
}

const CATEGORIAS = ['toplevel', 'blink.user_timing', '__metadata'];

async function metricas(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

/* ---------- uma execução de uma página num perfil ---------- */

async function execucao(browser, o, nome, caminho, perfil, vsync) {
  const P = PERFIS[perfil];
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const res = { pagina: nome, perfil, url: urlDe(o, caminho) };
  try {
    await page.setViewport(P.viewport);
    if (P.ua) await page.setUserAgent(P.ua);
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: BLOQUEIO });
    await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
    await page.evaluateOnNewDocument(INSTALA);

    // A rede: cada pedido, o que veio e quanto pesou.
    const pedidos = new Map();
    let emVoo = 0, ultimo = Date.now();
    cdp.on('Network.requestWillBeSent', (e) => {
      if (!pedidos.has(e.requestId)) { emVoo++; }
      pedidos.set(e.requestId, Object.assign(pedidos.get(e.requestId) || {}, { url: e.request.url, tipo: e.type || 'Other' }));
      ultimo = Date.now();
    });
    cdp.on('Network.responseReceived', (e) => {
      const h = Object.fromEntries(Object.entries(e.response.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      Object.assign(pedidos.get(e.requestId) || {}, {
        status: e.response.status, protocolo: e.response.protocol, cache: h['cf-cache-status'] || '',
        enc: h['content-encoding'] || '', cc: h['cache-control'] || '',
      });
    });
    const fim = (e, falhou) => {
      const r = pedidos.get(e.requestId);
      if (r && !r.fim) { r.fim = true; r.bytes = e.encodedDataLength || 0; r.falhou = falhou ? e.errorText : undefined; emVoo--; }
      ultimo = Date.now();
    };
    cdp.on('Network.loadingFinished', (e) => fim(e, false));
    cdp.on('Network.loadingFailed', (e) => fim(e, true));

    const t0 = Date.now();
    await page.goto(res.url, { waitUntil: 'load', timeout: 90000 });
    // Rede quieta por 2 s, ou 30 s no máximo (vídeo em laço nunca fica quieto).
    while (Date.now() - t0 < 30000 && !(emVoo <= 0 && Date.now() - ultimo > 2000)) await espera(200);
    await espera(1000);

    res.carga = await page.evaluate(CARGA);
    const m = await metricas(cdp);
    res.memoria = { heapMB: r1(m.JSHeapUsedSize / 1048576), nos: m.Nodes, documentos: m.Documents, frames: m.Frames };

    const host = new URL(res.url).host;
    const lista = [...pedidos.values()].filter((r) => r.url && !r.url.startsWith('data:'));
    const grupo = (u) => { try { const h = new URL(u).host; return h === host ? 'site' : (h === 'cdn.nipscern.com' ? 'cdn' : 'terceiros'); } catch (e) { return 'terceiros'; } };
    const porTipo = {}, porOrigem = {};
    for (const r of lista) {
      porTipo[r.tipo] = (porTipo[r.tipo] || 0) + (r.bytes || 0);
      const gr = grupo(r.url);
      porOrigem[gr] = (porOrigem[gr] || 0) + (r.bytes || 0);
    }
    res.rede = {
      pedidos: lista.length,
      kb: r1(lista.reduce((a, r) => a + (r.bytes || 0), 0) / 1024),
      porTipoKB: Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, r1(v / 1024)])),
      porOrigemKB: Object.fromEntries(Object.entries(porOrigem).map(([k, v]) => [k, r1(v / 1024)])),
      bloqueados: lista.filter((r) => r.falhou && /BLOCKED/i.test(r.falhou)).length,
      falhas: lista.filter((r) => r.falhou && !/BLOCKED|ABORTED/i.test(r.falhou)).map((r) => `${r.falhou} ${r.url}`).slice(0, 5),
      erros: lista.filter((r) => r.status >= 400).map((r) => `${r.status} ${r.url}`).slice(0, 5),
      cache: lista.reduce((a, r) => { if (r.cache) a[r.cache] = (a[r.cache] || 0) + 1; return a; }, {}),
      itens: lista.map((r) => ({ url: r.url, tipo: r.tipo, kb: r1((r.bytes || 0) / 1024), status: r.status, cache: r.cache, enc: r.enc, cc: r.cc, p: r.protocolo })),
    };

    // Parada no topo.
    await page.evaluate(() => window.scrollTo(0, 0));
    await espera(800);
    await page.tracing.start({ categories: CATEGORIAS });
    const a0 = await metricas(cdp);
    await page.evaluate(GRAVA_INICIO, 'perf-parado-0');
    await espera(PARADO_MS);
    const g1 = await page.evaluate(GRAVA_FIM, 'perf-parado-1');
    const a1 = await metricas(cdp);
    const tr1 = JSON.parse(Buffer.from(await page.tracing.stop()).toString('utf8'));
    res.parado = Object.assign(quadros(g1, vsync), {
      ocupado: ocupacao(tr1, 'perf-parado-0', 'perf-parado-1'),
      scriptPct: r1((100 * (a1.ScriptDuration - a0.ScriptDuration)) / (g1.ms / 1000)),
      layoutPct: r1((100 * (a1.LayoutDuration + a1.RecalcStyleDuration - a0.LayoutDuration - a0.RecalcStyleDuration)) / (g1.ms / 1000)),
    });

    // Rolagem.
    const dist = Math.min(ROLAGEM_MAX, res.carga.altura - P.viewport.height);
    if (dist > 300) {
      await page.tracing.start({ categories: CATEGORIAS });
      await page.evaluate(GRAVA_INICIO, 'perf-rola-0');
      await cdp.send('Input.synthesizeScrollGesture', {
        x: Math.round(P.viewport.width / 2), y: Math.round(P.viewport.height / 2),
        yDistance: -dist, speed: ROLAGEM_VEL, gestureSourceType: P.gesto, preventFling: true, repeatCount: 1,
      });
      await espera(1200);
      const g2 = await page.evaluate(GRAVA_FIM, 'perf-rola-1');
      const tr2 = JSON.parse(Buffer.from(await page.tracing.stop()).toString('utf8'));
      const chegou = await page.evaluate(() => window.scrollY);
      res.rolagem = Object.assign(quadros(g2, vsync), { ocupado: ocupacao(tr2, 'perf-rola-0', 'perf-rola-1'), px: dist, chegou: Math.round(chegou) });
      const m2 = await metricas(cdp);
      res.memoria.heapDepoisMB = r1(m2.JSHeapUsedSize / 1048576);
      res.memoria.nosDepois = m2.Nodes;
    }

    // O toque no menu, no celular.
    if (perfil === 'mobile') {
      await page.evaluate(() => window.scrollTo(0, 0));
      await espera(600);
      const botao = await page.$('#nav-menu-btn');
      if (botao && await botao.isVisible()) {
        const antes = await page.evaluate(() => performance.now());
        await botao.tap();
        await espera(900);
        res.toque = await page.evaluate((t) => {
          const ev = window.__perf.ev.filter((e) => e[1] >= t - 5);
          return { ms: ev.length ? Math.round(Math.max(...ev.map((e) => e[2]))) : null, eventos: ev.map((e) => `${e[0]}:${Math.round(e[2])}`) };
        }, antes);
        await botao.tap().catch(() => {});
        await espera(400);
      }
    }
  } catch (e) {
    res.erro = String(e && e.stack || e).split('\n').slice(0, 3).join(' | ');
  } finally {
    await page.tracing.stop().catch(() => {});
    await ctx.close().catch(() => {});
  }
  return res;
}

/* ---------- Lighthouse ---------- */

let lh = null;
async function lighthouse(o, nome, caminho, perfil, dirBruto, k) {
  if (!lh) {
    lh = {
      run: (await import('lighthouse')).default,
      desktop: (await import('lighthouse/core/config/desktop-config.js')).default,
    };
  }
  const url = urlDe(o, caminho);
  const flags = { port: PORTA, output: 'json', logLevel: 'error', onlyCategories: ['performance'], blockedUrlPatterns: BLOQUEIO };
  try {
    const r = await lh.run(url, flags, perfil === 'desktop' ? lh.desktop : undefined);
    const lhr = r.lhr;
    fs.writeFileSync(path.join(dirBruto, `lh-${nome}-${perfil}-${k}.json.gz`), zlib.gzipSync(r.report));
    const a = (id) => (lhr.audits[id] ? lhr.audits[id].numericValue : null);
    const det = (id) => (lhr.audits[id] && lhr.audits[id].details && lhr.audits[id].details.items) || [];
    return {
      nota: lhr.categories.performance.score == null ? null : Math.round(lhr.categories.performance.score * 100),
      fcp: a('first-contentful-paint'), lcp: a('largest-contentful-paint'), tbt: a('total-blocking-time'),
      cls: a('cumulative-layout-shift'), si: a('speed-index'),
      kb: r1(a('total-byte-weight') / 1024), threadMs: a('mainthread-work-breakdown'), jsMs: a('bootup-time'),
      pedidos: det('network-requests').length,
      erro: lhr.runtimeError ? lhr.runtimeError.message : undefined,
      avisos: (lhr.runWarnings || []).slice(0, 3),
    };
  } catch (e) {
    return { erro: String(e && e.message || e) };
  }
}

/* ---------- resumo ---------- */

function folhas(obj, pre, out) {
  for (const [k, v] of Object.entries(obj || {})) {
    const nome = pre ? pre + '.' + k : k;
    if (typeof v === 'number') (out[nome] = out[nome] || []).push(v);
    else if (v && typeof v === 'object' && !Array.isArray(v) && k !== 'itens') folhas(v, nome, out);
  }
  return out;
}

function resume(execucoes) {
  const por = {};
  for (const e of execucoes) {
    const chave = e.pagina + '|' + e.perfil;
    por[chave] = por[chave] || [];
    por[chave].push(e);
  }
  const resumo = {};
  for (const [chave, es] of Object.entries(por)) {
    const [pagina, perfil] = chave.split('|');
    const acc = {};
    for (const e of es) folhas({ lh: e.lh, carga: e.carga, rede: e.rede, memoria: e.memoria, parado: e.parado, rolagem: e.rolagem, toque: e.toque }, '', acc);
    const med = {};
    for (const [k, xs] of Object.entries(acc)) med[k] = r1(mediana(xs));
    med.execucoes = es.length;
    med.erros = es.filter((e) => e.erro || (e.lh && e.lh.erro)).map((e) => e.erro || e.lh.erro);
    med.lcpEl = (es.find((e) => e.carga && e.carga.lcpEl) || { carga: {} }).carga.lcpEl;
    med.loafPiores = (es.find((e) => e.rolagem && e.rolagem.loafPiores && e.rolagem.loafPiores.length) || { rolagem: {} }).rolagem.loafPiores || [];
    (resumo[pagina] = resumo[pagina] || {})[perfil] = med;
  }
  return resumo;
}

const COLUNAS = [
  ['lh.nota', 'LH', 0], ['lh.fcp', 'FCP ms', 0], ['lh.lcp', 'LCP ms', 0], ['lh.tbt', 'TBT ms', 0], ['lh.cls', 'CLS', 3], ['lh.si', 'SI ms', 0],
  ['rede.kb', 'KB', 0], ['rede.pedidos', 'pedidos', 0],
  ['parado.ocupado.principal', 'parado: principal %', 1], ['parado.ocupado.gpu', 'parado: GPU %', 1], ['parado.rafPorSeg', 'parado: rAF/s', 0],
  ['rolagem.fps', 'rolagem: fps', 0], ['rolagem.entregues', 'rolagem: quadros %', 0], ['rolagem.p95', 'rolagem: p95 ms', 1],
  ['rolagem.engasgos50', 'engasgos >50ms', 0], ['rolagem.ocupado.principal', 'rolagem: principal %', 0], ['rolagem.ocupado.gpu', 'rolagem: GPU %', 0],
  ['toque.ms', 'toque ms', 0], ['memoria.heapMB', 'heap MB', 1],
];

function tabela(resumo, perfil) {
  const cols = COLUNAS.filter(([k]) => Object.values(resumo).some((p) => p[perfil] && p[perfil][k] != null));
  const linhas = [`| página | ${cols.map((c) => c[1]).join(' | ')} |`, `|---|${cols.map(() => '---:').join('|')}|`];
  for (const [pagina, porPerfil] of Object.entries(resumo)) {
    const m = porPerfil[perfil];
    if (!m) continue;
    linhas.push(`| ${pagina} | ${cols.map(([k, , d]) => (m[k] == null ? '' : m[k].toFixed(d))).join(' | ')} |`);
  }
  return linhas.join('\n');
}

/* ---------- principal ---------- */

(async () => {
  const o = opcoes();
  const paginas = PAGINAS.filter(([n]) => !o.only || o.only.split(',').includes(n));
  const dirBruto = path.join(__dirname, '.out', o.label);
  fs.mkdirSync(dirBruto, { recursive: true });
  const dirDocs = path.join(ROOT, 'docs', 'perf');
  fs.mkdirSync(dirDocs, { recursive: true });

  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'nips-perf-'));
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    userDataDir: perfil,
    args: ['--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--mute-audio', '--lang=en-US'],
  });
  PORTA = +new URL(browser.wsEndpoint()).port;

  // O intervalo de quadro da tela, numa página vazia.
  const vazia = await browser.newPage();
  await vazia.evaluateOnNewDocument(INSTALA);
  await vazia.goto('about:blank');
  await vazia.evaluate(INSTALA);
  await vazia.evaluate(GRAVA_INICIO, 'v0');
  await espera(1500);
  const gv = await vazia.evaluate(GRAVA_FIM, 'v1');
  const vsync = mediana(gv.intervalos);
  await vazia.close();

  let git = '';
  try { git = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim() + (execSync('git status --porcelain', { cwd: ROOT }).toString().trim() ? ' (com mudanças locais)' : ''); } catch (e) { /* sem git */ }
  let gpu = '';
  try {
    const s = await browser.target().createCDPSession();
    const info = await s.send('SystemInfo.getInfo');
    gpu = (info.gpu.devices || []).filter((d) => d.deviceString && !/Basic Render/.test(d.deviceString)).map((d) => d.deviceString).join(' + ');
  } catch (e) { /* sem info */ }
  const ambiente = {
    data: new Date().toISOString(), base: o.base, query: o.query, git, runs: o.runs,
    edge: await browser.version(), cpu: os.cpus()[0].model, nucleos: os.cpus().length,
    ramGB: r1(os.totalmem() / 1073741824), gpu, vsyncMs: r1(vsync), hz: Math.round(1000 / vsync),
    lighthouse: require('lighthouse/package.json').version,
    perfis: Object.fromEntries(o.perfis.map((p) => [p, { viewport: PERFIS[p].viewport, cpu: PERFIS[p].cpu }])),
    rolagem: { maxPx: ROLAGEM_MAX, pxPorSeg: ROLAGEM_VEL }, paradoMs: PARADO_MS, bloqueados: BLOQUEIO,
  };
  console.log(`ambiente: ${ambiente.edge}, ${ambiente.cpu}, GPU ${gpu}, tela ${ambiente.hz} Hz, git ${git}`);

  const execucoes = [];
  const total = paginas.length * o.perfis.length * o.runs;
  let n = 0;
  for (const [nome, caminho] of paginas) {
    for (const p of o.perfis) {
      for (let k = 1; k <= o.runs; k++) {
        n++;
        const t = Date.now();
        let e = { pagina: nome, perfil: p, url: urlDe(o, caminho) };
        if (o.runtime) e = await execucao(browser, o, nome, caminho, p, vsync);
        if (o.lighthouse) e.lh = await lighthouse(o, nome, caminho, p, dirBruto, k);
        e.execucao = k;
        execucoes.push(e);
        fs.writeFileSync(path.join(dirBruto, 'execucoes.json'), JSON.stringify({ ambiente, execucoes }, null, 1));
        const lhTxt = e.lh ? (e.lh.erro ? `LH erro: ${e.lh.erro}` : `LH ${e.lh.nota} LCP ${Math.round(e.lh.lcp)} TBT ${Math.round(e.lh.tbt)}`) : '';
        const rtTxt = e.parado ? `parado principal ${e.parado.ocupado && e.parado.ocupado.principal}% gpu ${e.parado.ocupado && e.parado.ocupado.gpu}% | rolagem ${e.rolagem ? e.rolagem.fps + ' fps, ' + e.rolagem.entregues + '%' : '-'}` : '';
        console.log(`[${n}/${total}] ${nome} ${p} #${k} ${((Date.now() - t) / 1000).toFixed(0)}s  ${lhTxt}  ${rtTxt}${e.erro ? '  ERRO ' + e.erro : ''}`);
      }
    }
  }
  await browser.close();
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) { /* o Edge às vezes segura um arquivo */ }

  const resumo = resume(execucoes);
  fs.writeFileSync(path.join(dirDocs, `${o.label}.json`), JSON.stringify({ ambiente, resumo }, null, 1) + '\n');
  const md = [
    `# Medição ${o.label}`,
    '',
    `${ambiente.data.slice(0, 16).replace('T', ' ')} UTC, ${o.base}${o.query ? ' com ?' + o.query : ''}, git ${git}. Mediana de ${o.runs} execuções por página e perfil.`,
    `Edge ${ambiente.edge}, Lighthouse ${ambiente.lighthouse}, ${ambiente.cpu} (${ambiente.nucleos} threads, ${ambiente.ramGB} GB), GPU ${gpu}, tela de ${ambiente.hz} Hz (${ambiente.vsyncMs} ms por quadro).`,
    '',
    'LH, FCP, LCP, TBT, CLS e SI são do Lighthouse (simulado). KB e pedidos são da rede real da execução. "parado" é a página no topo por 5 s sem ninguém mexer; "rolagem" é a página rolada inteira, até 12.000 px a 1.500 px/s. "principal %" e "GPU %" são o tempo ocupado da thread principal da página e da thread principal da GPU. "quadros %" é a parte dos quadros que a tela esperava e recebeu. "toque" é o tempo do toque no menu até o quadro seguinte.',
    '',
    '## Computador',
    '',
    tabela(resumo, 'desktop'),
    '',
    '## Celular',
    '',
    tabela(resumo, 'mobile'),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dirDocs, `${o.label}.md`), md);
  console.log(`\nresumo: docs/perf/${o.label}.json e .md; execuções e relatórios: tools/perf/.out/${o.label}/`);
})().catch((e) => { console.error(e); process.exit(1); });
