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
  email: 120,
  terminal: 24000,
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

  // O contato e opcional e so aparece se veio: e-mail e dado pessoal, e a
  // issue vive num repositorio privado justamente por causa disto. O
  // neutralizar barra o @ de virar mencao do GitHub.
  if (d.email) {
    partes.push('### Contato', '', neutralizar(d.email), '');
  }

  partes.push(
    '### Ambiente',
    '',
    '| | |',
    '|---|---|',
    `| AURORA | ${limpar(diag.versao, 40)}${diag.empacotado === false ? ' (dev)' : ''} |`,
    `| Sistema | ${limpar(diag.sistema, 120)} |`,
    `| Máquina | ${Number(diag.nucleos) || '?'} núcleos, ${Number(diag.memoriaGB) || '?'} GB |`,
    `| Disco livre | ${diag.discoLivreGB == null ? '?' : Number(diag.discoLivreGB) + ' GB'} |`,
    `| Componentes | ${limpar(diag.componentes, 300) || '?'} |`,
    `| Electron | ${limpar(diag.electron, 40)} |`,
    `| Chromium | ${limpar(diag.chrome, 40)} |`,
    `| Node | ${limpar(diag.node, 40)} |`,
    '',
  );

  // Bloco de log recolhível. A cerca não pode ser quebrada por conteúdo do
  // log, senão o resto do corpo escapa do bloco de código.
  const bloco = (titulo, conteudo, aberto) => [
    `<details${aberto ? ' open' : ''}><summary>${titulo}</summary>`,
    '',
    '```',
    conteudo.replace(/```/g, "'''"),
    '```',
    '',
    '</details>',
    '',
  ];

  // O terminal vem antes, e já aberto: é o que explica a compilação que
  // falhou, e quem tria os relatos deve poder ler sem clicar.
  const terminal = limpar(d.terminal, LIMITES.terminal);
  if (terminal) partes.push(...bloco('Terminal (erros e o que estava em volta)', terminal, true));

  const registro = limpar(diag.log, LIMITES.log);
  if (registro) partes.push(...bloco('Fim do log do aplicativo', registro, false));

  partes.push('_Enviado pelo relato de problema da AURORA._');
  return partes.join('\n');
}

/**
 * Limite por IP. Usa o KV quando existe; sem KV, deixa passar em vez de barrar
 * todo mundo, porque um relato perdido custa mais do que um repetido.
 *
 * O IP é dado pessoal (LGPD), então ele não é guardado: vira um hash com sal
 * do dia, que só serve para contar dentro da janela e expira sozinho em
 * minutos. O IP nunca entra na issue nem em log nenhum deste Worker.
 *
 * Devolve QUANTOS SEGUNDOS faltam, e não um sim ou não. Quem foi barrado
 * precisa saber quando pode tentar de novo: "aguarde" sem prazo é o tipo de
 * aviso que faz a pessoa clicar de novo em seguida e ser barrada de novo. O
 * instante de expiração viaja como metadado do próprio contador, então o
 * prazo é o de verdade, não uma estimativa.
 *
 * @returns {Promise<number>} segundos a esperar, ou 0 quando pode enviar.
 */
async function segundosDeEspera(env, ip) {
  if (!env.BUGREPORT_KV || !ip) return 0;
  const sal = new Date().toISOString().slice(0, 10);
  const bytes = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(`${sal}:${ip}`));
  const chave = 'ip:' + [...new Uint8Array(bytes)].slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  const { value, metadata } = await env.BUGREPORT_KV.getWithMetadata(chave);
  const atual = Number(value) || 0;
  if (atual >= RELATOS_POR_JANELA) {
    const restam = metadata && metadata.ate
      ? Math.ceil((metadata.ate - Date.now()) / 1000)
      : JANELA_SEGUNDOS;
    // Nunca zero: zero significaria "pode enviar", e aqui ja se sabe que nao.
    return Math.min(JANELA_SEGUNDOS, Math.max(1, restam));
  }
  await env.BUGREPORT_KV.put(chave, String(atual + 1), {
    expirationTtl: JANELA_SEGUNDOS,
    metadata: { ate: Date.now() + JANELA_SEGUNDOS * 1000 },
  });
  return 0;
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
    const espera = await segundosDeEspera(env, ip);
    if (espera) {
      // Retry-After e o cabecalho padrao para isto, e o corpo repete em
      // numero para o cliente nao ter que interpretar cabecalho.
      return new Response(
        JSON.stringify({ erro: 'muitos relatos seguidos', esperar: espera }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(espera),
            ...CORS,
          },
        },
      );
    }

    if (!env.GITHUB_TOKEN || !env.REPO) return json({ erro: 'canal nao configurado' }, 503);

    const titulo = limpar(dados.titulo, LIMITES.titulo) || oQue.split('\n')[0].slice(0, 120);
    const corpo = montarCorpo({
      oQueAconteceu: oQue,
      oQueEsperava: limpar(dados.oQueEsperava, LIMITES.oQueEsperava),
      comoReproduzir: limpar(dados.comoReproduzir, LIMITES.comoReproduzir),
      email: limpar(dados.email, LIMITES.email),
      terminal: limpar(dados.terminal, LIMITES.terminal),
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
