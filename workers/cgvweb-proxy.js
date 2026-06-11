/**
 * Proxy reverso que mantém as URLs canônicas do CGVWeb no site
 * (consolidadas no CERN) servindo o conteúdo do GitHub Pages do
 * repositório nipscernlab/cgv-web.
 *
 *   nipscern.com/projects/cgvweb/...      -> github.io/cgv-web/...
 *   nipscern.com/library/cgvweb/twiki/... -> github.io/cgv-web/twiki/...
 *
 * Rotas a registrar no painel (e variantes www.):
 *   nipscern.com/projects/cgvweb*
 *   nipscern.com/library/cgvweb/twiki*
 */
const UPSTREAM = 'https://nipscernlab.github.io/cgv-web';
const PREFIXES = [
  { from: '/projects/cgvweb', to: '' },
  { from: '/library/cgvweb/twiki', to: '/twiki' },
];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const rule = PREFIXES.find((p) => url.pathname.startsWith(p.from));
    if (!rule) {
      return fetch(request);
    }

    // Sem a barra final os caminhos relativos do app resolveriam fora do
    // prefixo, então normalizamos antes de servir.
    if (url.pathname === rule.from) {
      return Response.redirect(url.origin + rule.from + '/' + url.search, 301);
    }

    const rest = url.pathname.slice(rule.from.length);
    const upstream = UPSTREAM + rule.to + rest + url.search;

    return fetch(upstream, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });
  },
};
