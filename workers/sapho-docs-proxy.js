/**
 * Proxy reverso que serve a documentação do SAPHO sob o domínio do site,
 * a partir do GitHub Pages do repositório nipscernlab/docs_aurora.
 *
 *   nipscern.com/docs/sapho/...  -> github.io/docs_aurora/...
 *
 * O manual é gerado com Sphinx naquele repositório, que publica o site no
 * branch gh-pages a cada versão. Mantê-lo fora deste repositório evita trazer
 * para cá alguns megabytes de HTML, imagens e o PDF a cada publicação, e faz a
 * documentação atualizar sozinha, sem commit nenhum aqui.
 *
 * Rotas a registrar no painel (e variantes www.):
 *   nipscern.com/docs/sapho*
 */
const UPSTREAM = 'https://nipscernlab.github.io/docs_aurora';
const PREFIX = '/docs/sapho';

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
