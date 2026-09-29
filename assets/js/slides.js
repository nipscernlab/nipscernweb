/* O deck de uma aula, no site
   ------------------------------------------------------------------
   As páginas library/courses/<curso>/<aula>/slides/ trazem as seções do deck
   inteiras, cada uma com 1920 por 1080 pixels e o estilo inline, do jeito que o
   tipo Slides do Artifact as guarda. Este módulo faz o que o Artifact fazia em
   volta delas, e é o mesmo comportamento da implementação de referência que o
   Chrysthofer testou no Edge:

     o palco de 1920 por 1080 escalado à janela, sem distorcer;
     seta, espaço, Enter e Page Down avançam, e no slide com vídeo o primeiro
       toque toca o vídeo e só o seguinte avança;
     clique no quadro toca o vídeo, clique no vídeo pausa;
     F, tela cheia; N, as anotações do apresentador; H ou ?, as teclas;
     #n no endereço abre o slide n.

   O que o site acrescenta: a barra de botões, para quem não tem teclado; o
   deslizar para os lados na tela de toque; e as imagens carregando só no slide
   atual e nos vizinhos, porque as 23 seções estão todas no DOM e, com src
   direto, a abertura baixaria o deck inteiro. */
import { initI18n, t } from './i18n.js?v=e5c0a3de6f';

const palco = document.getElementById('palco');
const slides = [...palco.children].filter((el) => el.tagName === 'SECTION');
const barra = document.getElementById('barra');
const contador = document.getElementById('contador');
const notas = document.getElementById('notas');
const notasTexto = document.getElementById('notas-texto');
const notasVazio = document.getElementById('notas-vazio');
const ajuda = document.getElementById('ajuda');
const botaoNotas = document.getElementById('botao-notas');
const botaoTela = document.getElementById('botao-tela');
const botaoAjuda = document.getElementById('botao-ajuda');
const progresso = document.getElementById('progresso');

let atual = 0;
let ocioso;

/* ---------------------------------------------------------------- o palco */

function escala() {
  /* Com as anotações abertas, o palco sobe para o espaço que sobra acima
     delas, em vez de ficar escondido embaixo do painel. */
  const baixo = notas.hidden ? 0 : notas.offsetHeight;
  const largura = innerWidth;
  const altura = Math.max(120, innerHeight - baixo);
  const s = Math.min(largura / 1920, altura / 1080);
  const x = (largura - 1920 * s) / 2;
  const y = (altura - 1080 * s) / 2;
  palco.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

/* ---------------------------------------------------------------- imagens sob demanda */

function carrega(i) {
  const sl = slides[i];
  if (!sl || sl.dataset.carregado) return;
  sl.querySelectorAll('img[data-src]').forEach((img) => {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  });
  sl.dataset.carregado = '1';
}

/* ---------------------------------------------------------------- vídeo

   O slide com vídeo mostra o quadro parado, o último quadro do vídeo, que é o
   que o PDF imprime. Quando o slide aparece, o <video> entra no lugar da
   imagem, com a imagem como pôster e o mesmo estilo inline, e começa a
   carregar: na tela nada muda, e o primeiro toque só dá o play, sem esperar a
   rede. Até esse toque o vídeo fica marcado como pendente.

   Os vídeos moram no CDN. Aberta em localhost, a página os pede ao dev-server,
   em /_cdn/, que serve o clone do nipscern-assets ao lado do repositório: é o
   que deixa ver uma aula nova antes de o CDN ter os arquivos dela. E vídeo que
   não carrega não falha calado: aparece um aviso com o link do arquivo. */

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const CDN = 'https://cdn.nipscern.com/';
const doCdn = (url) => (LOCAL && url.startsWith(CDN) ? '/_cdn/' + url.slice(CDN.length) : url);

let avisoTempo;
function avisaFalha(url) {
  const aviso = document.getElementById('aviso-video');
  aviso.querySelector('a').href = url;
  aviso.hidden = false;
  clearTimeout(avisoTempo);
  avisoTempo = setTimeout(() => { aviso.hidden = true; }, 9000);
}

function montaVideos(sl) {
  sl.querySelectorAll('img[data-video]').forEach((img) => {
    const v = document.createElement('video');
    v.poster = img.currentSrc || img.src || img.dataset.src || '';
    v.setAttribute('style', img.getAttribute('style'));
    v.playsInline = true;
    v.muted = true;            // os vídeos das aulas não têm som; mudo, o celular não barra o play
    v.preload = 'auto';
    v.title = img.alt || '';
    v.setAttribute('aria-label', img.alt || '');
    v.dataset.pendente = '1';
    v.addEventListener('error', () => avisaFalha(v.currentSrc || v.src), { once: true });
    v.src = doCdn(img.dataset.video);
    v.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (v.dataset.pendente || v.paused) toca(v); else v.pause();
    });
    img.replaceWith(v);
  });
}

function pendentes(sl) {
  return [...sl.querySelectorAll('video[data-pendente]')];
}

function toca(v) {
  delete v.dataset.pendente;
  if (v.ended) v.currentTime = 0;
  v.play().catch(() => {});
}

/* ---------------------------------------------------------------- navegação */

/* A anotação vem do <aside> do slide já em parágrafos, com os vetores desenhados
   pelo KaTeX no build (tools/courses/texto.py, notas_em_html). É HTML gerado
   por nós, a partir do deck do curso, e vai para o painel como está. */
function mostraNotas() {
  const a = slides[atual].querySelector('aside');
  notasTexto.innerHTML = a ? a.innerHTML : '';
  notasVazio.hidden = !!(a && a.textContent.trim());
  notas.scrollTop = 0;
}

function mostra(i, { semHash = false } = {}) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  slides[atual].querySelectorAll('video').forEach((v) => v.pause());
  slides[atual].classList.remove('atual');
  atual = i;
  slides[atual].classList.add('atual');
  [atual, atual + 1, atual + 2, atual - 1].forEach(carrega);
  montaVideos(slides[atual]);
  mostraNotas();
  contador.textContent = `${atual + 1} / ${slides.length}`;
  progresso.style.transform = `scaleX(${(atual + 1) / slides.length})`;
  if (!semHash) history.replaceState(null, '', '#' + (atual + 1));
  acorda();
}

function avanca() {
  const p = pendentes(slides[atual]);
  if (p.length) { toca(p[0]); return; }   // o vídeo começa no primeiro toque, como no original
  mostra(atual + 1);
}

function volta() { mostra(atual - 1); }

/* ---------------------------------------------------------------- painéis */

function alternaNotas(forcar) {
  notas.hidden = forcar === undefined ? !notas.hidden : !forcar;
  botaoNotas.setAttribute('aria-pressed', String(!notas.hidden));
  escala();
}

function alternaAjuda(forcar) {
  ajuda.hidden = forcar === undefined ? !ajuda.hidden : !forcar;
  botaoAjuda.setAttribute('aria-expanded', String(!ajuda.hidden));
}

function telaCheia() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

/* A barra some quando ninguém mexe, para não ficar por cima do slide projetado,
   e volta com o mouse, com o toque ou a cada troca de slide. Com o foco dentro
   dela, ou com o mouse em cima, ela fica. No celular em pé ela nunca some: o
   palco ocupa só a faixa do meio da tela, a barra fica embaixo dele sem cobrir
   nada, e sem teclado ela é o único jeito de andar além do dedo. */
const emPe = matchMedia('(pointer: coarse) and (orientation: portrait)');
function acorda() {
  document.body.classList.remove('ocioso');
  clearTimeout(ocioso);
  if (emPe.matches) return;
  ocioso = setTimeout(() => {
    if (barra.matches(':hover') || barra.contains(document.activeElement)) { acorda(); return; }
    document.body.classList.add('ocioso');
  }, 2600);
}
emPe.addEventListener('change', acorda);

/* ---------------------------------------------------------------- entradas */

document.addEventListener('keydown', (ev) => {
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const k = ev.key;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) {
    /* Enter e espaço num botão da barra são do botão. */
    if ((k === ' ' || k === 'Enter') && ev.target.closest && ev.target.closest('button, a')) return;
    ev.preventDefault(); avanca();
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { ev.preventDefault(); volta(); }
  else if (k === 'Home') { ev.preventDefault(); mostra(0); }
  else if (k === 'End') { ev.preventDefault(); mostra(slides.length - 1); }
  else if (k === 'f' || k === 'F') telaCheia();
  else if (k === 'n' || k === 'N') alternaNotas();
  else if (k === 'h' || k === 'H' || k === '?') alternaAjuda();
  else if (k === 'Escape') { alternaAjuda(false); alternaNotas(false); }
});


document.getElementById('anterior').addEventListener('click', volta);
document.getElementById('proximo').addEventListener('click', avanca);
botaoNotas.addEventListener('click', () => alternaNotas());
botaoAjuda.addEventListener('click', () => alternaAjuda());
document.getElementById('fecha-ajuda').addEventListener('click', () => alternaAjuda(false));
if (document.fullscreenEnabled) botaoTela.addEventListener('click', telaCheia);
else botaoTela.hidden = true;   // o iPhone não põe em tela cheia nada que não seja vídeo

/* Deslizar para os lados anda, em qualquer lugar da tela: no celular em pé o
   palco é uma faixa estreita no meio, e o dedo não mira nela. Fora disso, só
   as anotações, as teclas e a barra, onde o dedo está rolando ou apertando
   outra coisa. O limiar de 50 pixels e a folga na vertical são para rolar sem
   trocar de slide sem querer; um toque parado só acorda a barra. */
let toque = null;
document.addEventListener('touchstart', (ev) => {
  if (ev.target.closest('#notas, #ajuda, #barra')) { toque = null; return; }
  const p = ev.changedTouches[0];
  toque = { x: p.clientX, y: p.clientY };
}, { passive: true });
document.addEventListener('touchend', (ev) => {
  if (!toque) return;
  const p = ev.changedTouches[0];
  const dx = p.clientX - toque.x;
  const dy = p.clientY - toque.y;
  toque = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) { if (dx < 0) avanca(); else volta(); }
  else acorda();
}, { passive: true });

addEventListener('mousemove', acorda, { passive: true });
addEventListener('touchstart', acorda, { passive: true });   // um toque em qualquer lugar traz a barra
addEventListener('resize', escala);
addEventListener('hashchange', () => {
  const n = parseInt(location.hash.slice(1), 10);
  if (n && n - 1 !== atual) mostra(n - 1, { semHash: true });
});
document.addEventListener('fullscreenchange', escala);

/* ---------------------------------------------------------------- início */

escala();
mostra(Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1), { semHash: !location.hash });
document.body.classList.add('pronto');
initI18n().then(() => {
  /* o texto de "sem anotações" chega com o idioma */
  notasVazio.textContent = t('courses.v_no_notes');
  escala();
});
