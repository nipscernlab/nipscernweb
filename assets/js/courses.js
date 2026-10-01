/* As páginas dos cursos: o link para um lugar da própria página chega deslizando
   ------------------------------------------------------------------
   O botão "Aulas" da página de um curso, o sumário ao lado do roteiro e todo
   link #âncora dessas páginas levam ao lugar suavemente, em vez de pular. O
   caminho é o scrollToEl de smooth-scroll.js, o mesmo que o site usa para voltar
   ao topo: sem o Lenis, que estas páginas não carregam porque nada nelas anda
   com a rolagem, ele é o scrollIntoView suave do próprio navegador, e com
   prefers-reduced-motion vira o salto de sempre. O recuo da barra de
   navegação fixa vem do scroll-margin-top dos títulos, em courses.css.

   O foco vai junto para o destino, como iria num link comum: sem isso, o próximo
   Tab voltaria para o topo da página. */
import { scrollToEl } from './smooth-scroll.js?v=5422482445';

/* Aberta em localhost, a página troca os links para o CDN pelo /_cdn/ do
   dev-server, que serve o clone do nipscern-assets: o PDF de uma aula nova abre
   antes de chegar ao CDN. Vale também para o PDF que o leitor do site abre, no
   src= do link para o pdf-viewer.html. Em produção, nada muda. */
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  const CDN = 'https://cdn.nipscern.com/';
  document.querySelectorAll(`a[href^="${CDN}"]`).forEach((a) => {
    a.href = '/_cdn/' + a.getAttribute('href').slice(CDN.length);
  });
  document.querySelectorAll('a[href*="pdf-viewer.html?src="]').forEach((a) => {
    const u = new URL(a.href);
    const src = u.searchParams.get('src') || '';
    if (!src.startsWith(CDN)) return;
    u.searchParams.set('src', '/_cdn/' + src.slice(CDN.length));
    a.href = u.href;
  });
}

document.addEventListener('click', (ev) => {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const a = ev.target.closest && ev.target.closest('a[href^="#"]');
  if (!a || a.classList.contains('skip-link')) return;
  const id = decodeURIComponent(a.getAttribute('href').slice(1));
  const alvo = id && document.getElementById(id);
  if (!alvo) return;
  ev.preventDefault();
  scrollToEl(alvo);
  history.pushState(null, '', '#' + id);
  if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
  alvo.focus({ preventScroll: true });
});
