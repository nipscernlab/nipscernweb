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

    return fetch(upstream, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });
  },
};
