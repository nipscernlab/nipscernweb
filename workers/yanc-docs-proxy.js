/**
 * Proxy reverso que serve o manual do YANC sob o domínio do site, a partir do
 * GitHub Pages do repositório nipscernlab/yanc.
 *
 *   nipscern.com/library/yanc/...  -> nipscernlab.github.io/yanc/...
 *
 * O manual mora no próprio repositório do YANC (docs/, em Markdown) e é gerado
 * com Sphinx pelo workflow de release a cada versão, que publica no GitHub
 * Pages. Como o manual do SAPHO (sapho-docs-proxy.js), fica fora deste
 * repositório e se atualiza sozinho, sem commit nenhum aqui.
 *
 * Rotas a registrar no painel (e variantes www.):
 *   nipscern.com/library/yanc*
 */
const UPSTREAM = 'https://nipscernlab.github.io/yanc';
const PREFIX = '/library/yanc';
const PAGINA_404 = 'https://www.nipscern.com/404.html';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith(PREFIX)) {
      return fetch(request);
    }

    // Sem a barra final os caminhos relativos das páginas resolveriam fora do
    // prefixo, então normalizamos antes de servir.
    if (url.pathname === PREFIX) {
      return Response.redirect(url.origin + PREFIX + '/' + url.search, 301);
    }

    const rest = url.pathname.slice(PREFIX.length);
    const upstream = UPSTREAM + rest + url.search;

    const resposta = await fetch(upstream, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });

    // Uma página que não existe no manual mostra a página de erro do site, e
    // não a do GitHub Pages. Os caminhos dentro dela são absolutos, então ela
    // se desenha inteira em qualquer profundidade.
    if (resposta.status === 404 && (request.method === 'GET' || request.method === 'HEAD')) {
      const pagina = await fetch(PAGINA_404);
      if (pagina.ok) {
        return new Response(request.method === 'HEAD' ? null : pagina.body, {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
        });
      }
    }
    return resposta;
  },
};
