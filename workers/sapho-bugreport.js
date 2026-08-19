/**
 * Recebe o relato de problema da AURORA e abre uma issue no repositório.
 *
 * POR QUE UM WORKER, E NÃO O APLICATIVO FALANDO COM O GITHUB
 * ----------------------------------------------------------
 * Abrir issue exige token, e token embutido em aplicativo distribuído é token
 * publicado: basta abrir o executável. Aqui o token fica no Worker, onde só o
 * NIPS-CERN chega, e o aplicativo só conhece um endereço público. Endereço
 * público qualquer um chama, e é por isso que quem protege é este arquivo,
 * limitando tamanho e frequência, e não o segredo do endereço.
 *
 * O QUE ENTRA
 * -----------
 * O JSON que main/ipc/bug_report.js monta na AURORA. Nada é aceito por
 * confiança: cada campo é recortado no tamanho e escapado antes de virar corpo
 * de issue, porque o texto vem de fora e vai para uma página que outras
 * pessoas leem.
 *
 * VARIÁVEIS (painel do Cloudflare, como secret)
 *   GITHUB_TOKEN  token fine-grained com permissão de Issues (write) apenas no
 *                 repositório de destino
 *   REPO          "nipscernlab/aurora"
 *
 * Rota a registrar: nipscern.com/api/sapho/bugreport
 */

const LIMITE_BYTES = 80 * 1024;

/** Teto por campo, na mesma ordem de grandeza do que o cliente já recorta. */
const LIMITES = {
  titulo: 120,
  oQueAconteceu: 8000,
  oQueEsperava: 4000,
  comoReproduzir: 4000,
  log: 40000,
};

/** Uma janela curta por IP, o bastante para conter engano e robô simples. */
const JANELA_SEGUNDOS = 300;
const RELATOS_POR_JANELA = 3;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/** Corta e limpa. O texto vai para Markdown, então o que sobra tem que ser inerte. */
function limpar(valor, teto) {
  return String(valor == null ? '' : valor)
    .replace(/\r/g, '')
    .slice(0, teto)
    .trim();
}

/**
 * Impede que o relato feche issues ou marque gente.
 *
 * O GitHub interpreta "closes #12" e "@fulano" no corpo da issue. Um relato
 * legítimo pode conter as duas coisas sem querer, e um mal-intencionado pode
 * contê-las de propósito, então o caractere é neutralizado nos dois casos.
 */
function neutralizar(texto) {
  return texto.replace(/([@#])(?=[\w-])/g, '$1​');
}

/** Bloco de citação, para o texto de quem relata não se misturar ao nosso. */
function citar(texto) {
  return texto.split('\n').map((l) => '> ' + l).join('\n');
}

function montarCorpo(d) {
  const diag = d.diagnostico || {};
  const partes = [
    '### O que aconteceu',
    '',
    citar(neutralizar(d.oQueAconteceu)),
    '',
  ];

  if (d.oQueEsperava) {
    partes.push('### O que era esperado', '', citar(neutralizar(d.oQueEsperava)), '');
  }
  if (d.comoReproduzir) {
    partes.push('### Como reproduzir', '', citar(neutralizar(d.comoReproduzir)), '');
  }

  partes.push(
    '### Ambiente',
    '',
    '| | |',
    '|---|---|',
    `| AURORA | ${limpar(diag.versao, 40)}${diag.empacotado === false ? ' (dev)' : ''} |`,
    `| Sistema | ${limpar(diag.sistema, 120)} |`,
    `| Máquina | ${Number(diag.nucleos) || '?'} núcleos, ${Number(diag.memoriaGB) || '?'} GB |`,
    `| Electron | ${limpar(diag.electron, 40)} |`,
    `| Chromium | ${limpar(diag.chrome, 40)} |`,
    `| Node | ${limpar(diag.node, 40)} |`,
    '',
  );

  const registro = limpar(diag.log, LIMITES.log);
  if (registro) {
    partes.push(
      '<details><summary>Fim do log</summary>',
      '',
      '```',
      // A cerca não pode ser quebrada por conteúdo do log, senão o resto do
      // corpo escapa do bloco de código.
      registro.replace(/```/g, "'''"),
      '```',
      '',
      '</details>',
      '',
    );
  }

  partes.push('_Enviado pelo relato de problema da AURORA._');
  return partes.join('\n');
}

/**
 * Limite por IP. Usa o KV quando existe; sem KV, deixa passar em vez de barrar
 * todo mundo, porque um relato perdido custa mais do que um repetido.
 */
async function excedeuLimite(env, ip) {
  if (!env.BUGREPORT_KV || !ip) return false;
  const chave = `ip:${ip}`;
  const atual = Number(await env.BUGREPORT_KV.get(chave)) || 0;
  if (atual >= RELATOS_POR_JANELA) return true;
  await env.BUGREPORT_KV.put(chave, String(atual + 1), { expirationTtl: JANELA_SEGUNDOS });
  return false;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ erro: 'metodo nao permitido' }, 405);

    const tamanho = Number(request.headers.get('content-length') || 0);
    if (tamanho > LIMITE_BYTES) return json({ erro: 'relato grande demais' }, 413);

    let dados;
    try { dados = await request.json(); }
    catch (_) { return json({ erro: 'json invalido' }, 400); }

    const oQue = limpar(dados.oQueAconteceu, LIMITES.oQueAconteceu);
    if (!oQue) return json({ erro: 'sem descricao' }, 400);

    const ip = request.headers.get('cf-connecting-ip');
    if (await excedeuLimite(env, ip)) return json({ erro: 'muitos relatos seguidos' }, 429);

    if (!env.GITHUB_TOKEN || !env.REPO) return json({ erro: 'canal nao configurado' }, 503);

    const titulo = limpar(dados.titulo, LIMITES.titulo) || oQue.split('\n')[0].slice(0, 120);
    const corpo = montarCorpo({
      oQueAconteceu: oQue,
      oQueEsperava: limpar(dados.oQueEsperava, LIMITES.oQueEsperava),
      comoReproduzir: limpar(dados.comoReproduzir, LIMITES.comoReproduzir),
      diagnostico: dados.diagnostico || {},
    });

    const r = await fetch(`https://api.github.com/repos/${env.REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'sapho-bugreport-worker',
      },
      body: JSON.stringify({
        title: `[relato] ${titulo}`,
        body: corpo,
        // O rótulo separa o que chegou de fora do que a equipe abriu, e é o que
        // permite triar sem ler tudo.
        labels: ['relato-do-usuario'],
      }),
    });

    if (!r.ok) {
      const detalhe = (await r.text()).slice(0, 300);
      return json({ erro: `github ${r.status}`, detalhe }, 502);
    }

    const issue = await r.json();
    return json({ ok: true, url: issue.html_url, numero: issue.number });
  },
};
