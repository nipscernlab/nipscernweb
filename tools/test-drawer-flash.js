/* O drawer do menu não pode aparecer enquanto a folha de estilo não chegou.
   ------------------------------------------------------------------
   A home é a única página do site em que `main.css` carrega de forma
   assíncrona, e o `<nav>` é escrito por `main.js` no DOMContentLoaded. Havia
   uma corrida entre as duas coisas, e o navegador a vencia com frequência:

     sem a folha     position: static, transform: none, left: 0   -> visível
     com a folha     position: fixed,  translateX(100%)           -> escondido

   O que se via era o menu inteiro pintado como um bloco comum no meio da
   página — todos os links, as quatro bandeiras — e, quando a folha aplicava, a
   travessia da esquerda para a direita até sumir, porque o translateX entrava
   junto com a transição que o acompanha. Não era uma animação de abertura: era
   o menu fugindo.

   A correção são quatro propriedades de `.nav-mobile` no CSS crítico inline da
   home, que colocam o drawer fora da tela desde o primeiro quadro em que ele
   existe. Este teste existe porque essa correção é fácil de perder: ela mora
   num bloco de CSS duplicado, e quem editar `main.css` não tem como saber.

   Uso:
     1) npm run dev
     2) suba um Chromium com porta de depuração, por exemplo:
        msedge --headless=new --remote-debugging-port=9222 \
               --user-data-dir=<pasta temporária> about:blank
     3) node tools/test-drawer-flash.js

   Sai com 0 se o drawer nunca esteve na área de conteúdo, 1 se esteve.

   Ele atrasa `main.min.css` em três segundos de propósito. Sem o atraso o teste
   passa mesmo com o bug presente, porque numa máquina rápida com cache quente a
   folha chega antes de dar tempo de medir — que é exatamente por que este bug
   sobreviveu tanto tempo sendo visível a olho nu.
*/
const puppeteer = require('puppeteer-core');

const BROWSER = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
const URL = process.env.TEST_URL || 'http://localhost:3000/index.html';
const ATRASO = 3000;

const olhar = async (page) =>
  page.evaluate(() => {
    const el = document.getElementById('nav-mobile');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    /* clientWidth e não innerWidth: innerWidth inclui a barra de rolagem, e o
       drawer encosta o canto esquerdo exatamente onde a barra começa. Medir
       contra innerWidth acusa uma sobra de 15 px que a barra cobre. */
    const limite = document.documentElement.clientWidth;
    return {
      left: Math.round(b.left),
      width: Math.round(b.width),
      position: cs.position,
      transform: cs.transform,
      naTela: b.left < limite && b.right > 0 && b.width > 0 && b.height > 0,
    };
  });

(async () => {
  const browser = await puppeteer.connect({ browserURL: BROWSER });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (/main\.min\.css/.test(req.url())) setTimeout(() => req.continue(), ATRASO);
    else req.continue();
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 400));       // nav injetado, folha não
  const antes = await olhar(page);
  await new Promise((r) => setTimeout(r, ATRASO + 500));
  const depois = await olhar(page);

  await page.close();
  await browser.disconnect();

  const linha = (q, r) => console.log('  ' + q.padEnd(20) + (r ? JSON.stringify(r) : 'nav não injetado'));
  linha('sem a folha', antes);
  linha('depois da folha', depois);

  const ok = antes && !antes.naTela && depois && !depois.naTela;
  console.log(ok ? '\nPASSOU: o drawer nunca esteve na área de conteúdo.'
                 : '\nFALHOU: o drawer apareceu na tela.');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('erro:', e.message); process.exit(2); });
