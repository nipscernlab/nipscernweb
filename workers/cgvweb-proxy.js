/**
 * Proxy reverso que mantém nipscern.com/projects/cgvweb intacto (link
 * consolidado no CERN) servindo o conteúdo do deploy do cgv-web.
 *
 * Registrar no painel Cloudflare com a rota: nipscern.com/projects/cgvweb*
 * Ajustar UPSTREAM para o domínio do projeto no Cloudflare Pages.
 */
const UPSTREAM = 'https://cgv-web.pages.dev';
const PREFIX = '/projects/cgvweb';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Sem a barra final os caminhos relativos do app resolveriam fora do
    // prefixo, então normalizamos antes de servir.
    if (url.pathname === PREFIX) {
      return Response.redirect(url.origin + PREFIX + '/' + url.search, 301);
    }

    const path = url.pathname.slice(PREFIX.length) || '/';
    const upstream = new URL(path + url.search, UPSTREAM);

    return fetch(upstream, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });
  },
};
