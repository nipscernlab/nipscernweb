/**
 * Proxy reverso que serve o manual do SAPHO e da AURORA sob o domínio do
 * site, a partir do GitHub Pages do repositório nipscernlab/docs_aurora.
 *
 *   nipscern.com/library/sapho/...  -> github.io/docs_aurora/...
 *   nipscern.com/docs/sapho/...     -> 301 para /library/sapho/... (endereço antigo)
 *
 * O manual é gerado com Sphinx naquele repositório, que publica o site no
 * branch gh-pages a cada versão. Mantê-lo fora deste repositório evita trazer
 * para cá alguns megabytes de HTML, imagens e o PDF a cada publicação, e faz a
 * documentação atualizar sozinha, sem commit nenhum aqui.
 *
 * Rotas a registrar no painel (e variantes www.):
 *   nipscern.com/library/sapho*
 *   nipscern.com/docs/sapho*
 */
const UPSTREAM = 'https://nipscernlab.github.io/docs_aurora';
const PREFIX = '/library/sapho';
const OLD_PREFIX = '/docs/sapho';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // O manual estreou em /docs/sapho e mudou para /library/sapho logo em
    // seguida. Redirecionar preserva os links já divulgados.
    if (url.pathname.startsWith(OLD_PREFIX)) {
      const rest = url.pathname.slice(OLD_PREFIX.length) || '/';
      return Response.redirect(url.origin + PREFIX + rest + url.search, 301);
    }

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
