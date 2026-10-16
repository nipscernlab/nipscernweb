/* As notícias prontas no HTML: uma página por post, news/<slug>.html.
   ------------------------------------------------------------------
   Cada página é news/post.html com o post já desenhado dentro: o cabeçalho,
   a capa e o texto, em inglês, e as tags de compartilhamento (Open Graph e
   Twitter) e o canônico do post. Um robô de busca ou a prévia de uma rede
   social leem a notícia inteira sem rodar JavaScript; o leitor recebe a
   página já pronta, e o script dela, vendo <html data-post>, só acrescenta o
   que é de tempo de execução (o coração, os posts relacionados, o painel de
   compartilhar) e traduz quando o idioma não é o inglês.

   O desenho não é reescrito aqui: este gerador abre news/post.html?id=<slug>
   num Edge sem janela, servido por tools/dev-server.js, deixa o próprio script
   da página desenhar o post, e copia o resultado. Por isso a página pronta é,
   por construção, o que o navegador desenharia.

   Até outubro de 2026 essas páginas eram do tools/share-gen (Rust): só as
   tags de compartilhamento e um redirecionamento para news/post?id=. O
   share-gen agora faz só as imagens, e a versão delas (IMG_VER) é lida de lá.

   Uso (depois de mudar data/news.json ou data/news-featured.json, ou o
   desenho de news/post.html):
     node tools/build-news.js

   Precisa do Edge (EDGE_PATH, se não estiver no caminho padrão). */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.nipscern.com/';
/* Qualquer Chromium serve: Edge, Chrome ou o próprio Chromium. Procura nos
   lugares de instalação comuns de Windows, macOS e Linux; CHROME_PATH (ou
   EDGE_PATH) aponta outro. Em 16/10/2026 o Edge não abriu na máquina do
   Luciano e a notícia nova saiu no formato antigo: daí a busca e a mensagem. */
function navegador() {
  const dado = process.env.CHROME_PATH || process.env.EDGE_PATH;
  if (dado) return dado;
  const local = process.env.LOCALAPPDATA || '';
  const lista = process.platform === 'win32' ? [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
    '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium',
  ];
  const achado = lista.find((x) => fs.existsSync(x));
  if (!achado) throw new Error('não achei Edge, Chrome nem Chromium. Instale um deles, ou diga onde está: CHROME_PATH=/caminho/do/executavel node tools/build-news.js');
  return achado;
}
const EDGE = navegador();
const PORTA = 3017;
const CR = String.fromCharCode(13);

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function espera(url, ms) {
  const fim = Date.now() + ms;
  return new Promise((ok, falha) => {
    const tenta = () => http.get(url, (r) => { r.resume(); ok(); }).on('error', () => {
      if (Date.now() > fim) falha(new Error('o servidor local não respondeu')); else setTimeout(tenta, 200);
    });
    tenta();
  });
}

/* Põe no elemento com aquele id o conteúdo e as classes que o script da
   página desenhou, mantendo a etiqueta do modelo, com display:none trocado por
   display:block. A etiqueta não é a do navegador porque o Chrome, ao
   reescrever o estilo de um elemento que o script mexeu, perde as margens
   escritas com var() dentro de um atalho (margin: 0 auto var(--sp-8) virava
   margin-left: ;), e a capa saía encostada na esquerda. Conta a profundidade
   das tags do mesmo nome para achar o fechamento certo. */
function trocaElemento(html, id, novo) {
  const abre = html.search(new RegExp(`<([a-z]+)[^>]*\\sid="${id}"`));
  if (abre < 0) throw new Error(`news/post.html não tem #${id}`);
  const tag = html.slice(abre + 1).match(/^[a-z]+/)[0];
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = abre;
  let nivel = 0, m;
  while ((m = re.exec(html))) {
    nivel += m[0][1] === '/' ? -1 : 1;
    if (nivel === 0) {
      const fimAbre = html.indexOf('>', abre) + 1;
      let etiqueta = html.slice(abre, fimAbre).replace('style="display:none', 'style="display:block');
      if (/\sclass="[^"]*"/.test(etiqueta)) etiqueta = etiqueta.replace(/\sclass="[^"]*"/, () => ` class="${esc(novo.classe)}"`);
      else if (novo.classe) etiqueta = etiqueta.replace(/^<([a-z]+)/, (t) => `${t} class="${esc(novo.classe)}"`);
      return html.slice(0, abre) + etiqueta + novo.dentro + html.slice(m.index);
    }
  }
  throw new Error(`#${id} não fecha`);
}

function trocaAtributo(html, id, attr, valor) {
  const re = new RegExp(`(<[^>]*\\sid="${id}"[^>]*\\s${attr}=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`news/post.html não tem ${attr} em #${id}`);
  return html.replace(re, (_, a, b) => a + esc(valor) + b);
}

(async () => {
  const modelo = fs.readFileSync(path.join(ROOT, 'news', 'post.html'), 'utf8').split(CR).join('');
  const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'news.json'), 'utf8'));
  const destaque = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'news-featured.json'), 'utf8'));
  const versaoImg = (fs.readFileSync(path.join(ROOT, 'tools', 'share-gen', 'src', 'main.rs'), 'utf8').match(/const IMG_VER: &str = "([^"]+)"/) || [])[1];
  if (!versaoImg) throw new Error('não achei IMG_VER em tools/share-gen/src/main.rs');

  // O post em destaque ganha do de mesmo slug em news.json, como em news/post.html.
  const slugs = [...new Set([destaque.slug, ...posts.map((p) => p.slug || p.id)].filter(Boolean))];
  for (const s of slugs) if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) throw new Error(`slug que não serve de nome de arquivo: ${s}`);

  const servidor = spawn(process.execPath, [path.join(ROOT, 'tools', 'dev-server.js'), String(PORTA)], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--lang=en-US', '--no-first-run'] });
  } catch (e) {
    servidor.kill();
    throw new Error(`o navegador ${EDGE} não abriu (${String(e.message || e).split('\n')[0]}). Feche outras janelas dele e tente de novo, ou aponte outro com CHROME_PATH. Sem isso a página da notícia fica no formato antigo: não commite news/ antes de rodar este gerador com sucesso.`);
  }
  try {
    await espera(`http://127.0.0.1:${PORTA}/`, 15000);
    for (const slug of slugs) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      const erros = [];
      page.on('pageerror', (e) => erros.push(e.message));
      await page.goto(`http://127.0.0.1:${PORTA}/news/post?id=${encodeURIComponent(slug)}&render=1`, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction(() => {
        const f = document.getElementById('post-footer');
        return f && f.style.display === 'block';
      }, { timeout: 30000 });
      await new Promise((r) => setTimeout(r, 400));
      if (erros.length) throw new Error(`${slug}: erro na página: ${erros[0]}`);

      const d = await page.evaluate(() => {
        const o = (id) => { const e = document.getElementById(id); return { dentro: e.innerHTML, classe: e.className }; };
        return {
          titulo: document.getElementById('page-title').textContent,
          descricao: document.getElementById('page-desc').content,
          ogTitulo: document.getElementById('og-title').content,
          ogDesc: document.getElementById('og-desc').content,
          header: o('post-header'), cover: o('post-cover'), body: o('post-body'),
          classeBody: document.body.className,
        };
      });
      await ctx.close();

      const url = SITE + 'news/' + slug;
      let html = modelo;
      html = html.replace('<html lang="en">', `<html lang="en" data-post="${slug}">`);
      html = html.replace(/<title id="page-title">[^<]*<\/title>/, `<title id="page-title">${esc(d.titulo)}</title>`);
      html = trocaAtributo(html, 'page-desc', 'content', d.descricao);
      html = trocaAtributo(html, 'og-url', 'content', url);
      html = trocaAtributo(html, 'canonical', 'href', url);
      html = trocaAtributo(html, 'og-title', 'content', d.ogTitulo);
      html = trocaAtributo(html, 'og-desc', 'content', d.ogDesc);
      html = trocaAtributo(html, 'og-image', 'content', `https://cdn.nipscern.com/share/${slug}/og-en.jpg?v=${versaoImg}`);
      html = trocaElemento(html, 'post-header', d.header);
      html = trocaElemento(html, 'post-cover', d.cover);
      html = trocaElemento(html, 'post-body', d.body);
      html = html.replace('<div id="post-loading" style="', '<div id="post-loading" style="display:none;');
      if (d.classeBody.trim()) html = html.replace('<body>', `<body class="${esc(d.classeBody.trim())}">`);
      html = html.replace('<!-- The canonical of a post is its static page', '<!-- Gerada por tools/build-news.js a partir de news/post.html e de data/. Não edite à mão. -->\n  <!-- The canonical of a post is its static page');

      fs.writeFileSync(path.join(ROOT, 'news', slug + '.html'), html);
      console.log(`  news/${slug}.html`);
    }
  } finally {
    await browser.close();
    servidor.kill();
  }
  // O bloco das notícias no sitemap.xml, com a data do post ou da última edição.
  const porSlug = new Map(posts.map((p) => [p.slug || p.id, p]));
  porSlug.set(destaque.slug, destaque);
  const arqMapa = path.join(ROOT, 'sitemap.xml');
  let mapa = fs.readFileSync(arqMapa, 'utf8').split(CR).join('');
  const linhas = ['  <!-- news: gerado por tools/build-news.js -->'];
  for (const slug of slugs) {
    const p = porSlug.get(slug) || {};
    const data = String(p.date_edited || p.date || '').slice(0, 10);
    linhas.push('  <url>', `    <loc>${SITE}news/${slug}</loc>`);
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data)) linhas.push(`    <lastmod>${data}</lastmod>`);
    linhas.push('    <changefreq>yearly</changefreq>', '    <priority>0.6</priority>', '  </url>');
  }
  linhas.push('  <!-- /news -->', '');
  const bloco = linhas.join('\n');
  const ini = mapa.indexOf('  <!-- news: gerado');
  const fim = mapa.indexOf('<!-- /news -->');
  if (ini >= 0 && fim > ini) mapa = mapa.slice(0, ini) + bloco + mapa.slice(mapa.indexOf('\n', fim) + 1);
  else mapa = mapa.replace('</urlset>', bloco + '</urlset>');
  fs.writeFileSync(arqMapa, mapa);

  console.log(`${slugs.length} notícias prontas em news/`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
