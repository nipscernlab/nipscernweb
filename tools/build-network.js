/* A rede de coautoria do laboratório, calculada aqui e não no navegador
   ------------------------------------------------------------------
   `data/publications.json` tem 147 trabalhos e 252 KB. O que a página About
   precisa deles é uma coisa só: quem assinou com quem. Isso cabe em 15 KB, e é
   o que este arquivo escreve em `data/collab-network.json`.

   O layout também sai daqui. Uma simulação de forças rodando no navegador
   custaria alguns milhões de operações na thread principal para produzir, toda
   visita, uma figura ligeiramente diferente — e esta figura é um dado, não um
   enfeite: ela tem que ser a mesma para todo mundo, como um gráfico é o mesmo
   em toda tiragem do artigo. Então ela é calculada uma vez, no build, e o que
   vai para a rede são as coordenadas prontas.

   DETERMINISMO. O guard de dados (.github/workflows/data-guard.yml) roda este
   código no Ubuntu e compara com o que foi commitado no Windows. Uma simulação
   de forças é caótica: qualquer diferença de um ulp no passo 3 vira uma figura
   diferente no passo 400. Por isso a conta inteira usa apenas +, -, *, / e
   Math.sqrt, que a IEEE-754 especifica com arredondamento exato e que portanto
   dão o mesmo bit em qualquer máquina. Não entra aqui Math.random, Math.sin,
   Math.cos, Math.pow nem Math.cbrt: as transcendentais não são especificadas
   com precisão e variam entre implementações. O sorteio inicial é um
   mulberry32 semeado, que é imul, xor e deslocamento.

   NOMES. Os 147 trabalhos trazem 127 formas de assinatura, e algumas são a
   mesma pessoa: "A. M. Silva" e "Alessa Monay e Silva". A fusão é feita só
   quando a forma abreviada casa com exatamente UMA forma por extenso do
   conjunto — sobrenome igual e as iniciais na ordem. Onde há dúvida, ficam
   duas. Um grafo que junta duas pessoas para arredondar um número deixa de ser
   um dado.

   Quatro dos dezoito membros do laboratório não aparecem: são bolsistas de
   iniciação científica que ainda não publicaram. Não há nó para eles, e não se
   inventa um.

   Uso:  node tools/build-network.js
   Também é chamado por tools/build-data-slices.js, que é o que o guard roda.
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* Partículas de nome e sufixos de geração. Fora do cotejo porque "de", "dos" e
   "Filho" não distinguem ninguém, e porque "Herman P. Lima Jr" e "Luciano
   Manhães de Andrade Filho" têm o sufixo escrito em umas assinaturas e não em
   outras. */
const PARTICLES = new Set([
  'de', 'da', 'do', 'dos', 'das', 'e', 'del', 'di', 'della', 'van', 'von', 'y',
  'jr', 'junior', 'filho', 'neto',
]);

/* "Leonardo, R. L." é a mesma convenção de "R. L. Leonardo" com a vírgula que
   as bibliografias usam. Desfeita antes de qualquer comparação, senão o
   sobrenome cai na posição do nome. */
function tokens(raw) {
  let s = String(raw).trim();
  const comma = s.indexOf(',');
  if (comma > -1) s = s.slice(comma + 1).trim() + ' ' + s.slice(0, comma).trim();
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  /* "A.A. Machado" e "J.S. Graulich" escrevem duas iniciais sem espaço. */
  s = s.replace(/\.(?=[A-Za-z])/g, '. ');
  return s.split(/\s+/)
    .map((t) => t.replace(/\./g, ''))
    .filter((t) => t && !PARTICLES.has(t.toLowerCase()));
}

const isAbbreviated = (ts) => ts.some((t) => t.length === 1);

/* A abreviada cabe na completa: mesmo último sobrenome, e cada peça da
   abreviada casa em ordem com uma peça da completa — inicial contra inicial,
   palavra contra palavra. */
function fitsInside(short, long) {
  if (short.length > long.length) return false;
  const a = short[short.length - 1].toLowerCase();
  const b = long[long.length - 1].toLowerCase();
  if (a !== b) return false;
  let i = 0;
  for (const piece of short) {
    const t = piece.toLowerCase();
    let matched = false;
    while (i < long.length) {
      const w = long[i].toLowerCase();
      i++;
      if (t.length === 1 ? w[0] === t : w === t) { matched = true; break; }
    }
    if (!matched) return false;
  }
  return true;
}

/* O sorteio. Semente fixa: a figura é a mesma em toda máquina e em toda visita. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildNetwork(pubs, team) {
  /* ---- as pessoas ---- */
  const signatures = [...new Set(pubs.flatMap((p) => p.authors || []))];
  const T = new Map(signatures.map((s) => [s, tokens(s)]));

  const complete = signatures.filter((s) => !isAbbreviated(T.get(s)));
  const alias = new Map();               // assinatura -> assinatura canónica
  for (const s of signatures) {
    if (!isAbbreviated(T.get(s))) continue;
    const hits = complete.filter((f) => fitsInside(T.get(s), T.get(f)));
    if (hits.length === 1) alias.set(s, hits[0]);
  }
  const canonical = (s) => alias.get(s) || s;

  /* ---- quem do laboratório é quem na lista de autores ----
     Quatro membros assinam só na forma abreviada, então o cotejo corre nos dois
     sentidos: a do laboratório dentro da assinatura e a assinatura dentro da do
     laboratório. */
  const memberOf = new Map();            // assinatura canónica -> id em team.json
  for (const m of team) {
    const mt = tokens(m.name);
    for (const s of signatures) {
      const st = T.get(s);
      if (fitsInside(st, mt) || fitsInside(mt, st)) memberOf.set(canonical(s), m.id);
    }
  }

  /* ---- os nós e as arestas ---- */
  const index = new Map();
  let nodes = [];
  const nodeOf = (sig) => {
    const key = canonical(sig);
    if (!index.has(key)) {
      index.set(key, nodes.length);
      nodes.push({ n: key, m: memberOf.get(key) || null, w: 0, f: Infinity, l: -Infinity });
    }
    return index.get(key);
  };

  const weight = new Map();              // "i|j" -> trabalhos em comum
  for (const p of pubs) {
    const ids = [...new Set((p.authors || []).map(nodeOf))];
    const year = Number(p.year) || 0;
    for (const i of ids) {
      nodes[i].w++;
      if (year) {
        if (year < nodes[i].f) nodes[i].f = year;
        if (year > nodes[i].l) nodes[i].l = year;
      }
    }
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const key = ids[a] < ids[b] ? ids[a] + '|' + ids[b] : ids[b] + '|' + ids[a];
        weight.set(key, (weight.get(key) || 0) + 1);
      }
    }
  }
  let edges = [...weight.entries()].map(([k, w]) => {
    const [a, b] = k.split('|');
    return { a: Number(a), b: Number(b), w };
  });

  /* Quem não tem coautor não entra num grafo de coautoria.
     São seis, e todos pela mesma razão: `publications.json` registra as
     monografias e dissertações com o nome de quem as escreveu e não com o de
     quem as orientou, então o autor de uma delas aparece no acervo assinando
     sozinho. Isso é uma lacuna do registro, não um fato sobre a pessoa, e
     desenhá-la como um ponto solto no fundo do quadro seria afirmar a lacuna.
     Também é o que arruinava a escala: sem vizinho nenhum, a repulsão os
     mandava para seis raios de distância e o núcleo inteiro do grafo aparecia
     comprimido num grão no meio da tela. */
  const linked = new Set();
  for (const e of edges) { linked.add(e.a); linked.add(e.b); }
  const keep = nodes.map((_, i) => i).filter((i) => linked.has(i));
  const remap = new Map(keep.map((old, now) => [old, now]));
  nodes = keep.map((i) => nodes[i]);
  edges = edges.map((e) => ({ a: remap.get(e.a), b: remap.get(e.b), w: e.w }));

  /* ---- o desenho ----
     Fruchterman-Reingold em três dimensões. Repulsão entre todos os pares,
     mola em cada aresta, e uma gravidade fraca para a origem que impede os
     componentes soltos de saírem de quadro. A temperatura cai linearmente, que
     é o resfriamento do artigo original e é uma conta exata. */
  const n = nodes.length;
  const rand = mulberry32(20260810);
  const px = new Float64Array(n), py = new Float64Array(n), pz = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = rand() - 0.5;
    py[i] = rand() - 0.5;
    pz[i] = rand() - 0.5;
  }

  /* K é a distância de equilíbrio de uma aresta: puxa por d/K, empurra por
     K²/d², e as duas se igualam exatamente em d = K.

     CUT é o alcance da repulsão, e não é um detalhe de desempenho. Sem ele, um
     nó na periferia continua sendo empurrado por todos os 119 restantes por
     mais longe que esteja, e a única coisa que o segura é a gravidade: o
     equilíbrio cai perto de r = 7, seis vezes o diâmetro do miolo, e como a
     figura é normalizada pelo raio máximo, o grafo inteiro encolhia até a
     distância mediana entre vizinhos ser 1,2% do quadro. Medido, com o corte:
     9,7%. É a diferença entre uma rede e uma mancha.

     Os valores saíram de uma varredura de K, CUT e gravidade, comparando
     distância mediana ao vizinho mais próximo contra o raio do conjunto. */
  const K = 0.30;
  const CUT = 1.2;
  const GRAVITY = 0.05;
  const ITER = 700;
  const T0 = 0.10;
  const dx = new Float64Array(n), dy = new Float64Array(n), dz = new Float64Array(n);

  for (let step = 0; step < ITER; step++) {
    dx.fill(0); dy.fill(0); dz.fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ax = px[i] - px[j], ay = py[i] - py[j], az = pz[i] - pz[j];
        let d = Math.sqrt(ax * ax + ay * ay + az * az);
        if (d > CUT) continue;
        if (d < 0.001) { ax = 0.001; ay = 0; az = 0; d = 0.001; }
        const f = (K * K) / (d * d);       // f/d já embutido: empurra por unidade
        dx[i] += ax * f; dy[i] += ay * f; dz[i] += az * f;
        dx[j] -= ax * f; dy[j] -= ay * f; dz[j] -= az * f;
      }
    }

    for (const e of edges) {
      const i = e.a, j = e.b;
      let ax = px[i] - px[j], ay = py[i] - py[j], az = pz[i] - pz[j];
      let d = Math.sqrt(ax * ax + ay * ay + az * az);
      if (d < 0.001) d = 0.001;
      /* Um par que assinou dez vezes junto puxa mais que um par que assinou uma,
         mas não dez vezes mais: a escala é limitada, senão o orientador de 115
         trabalhos colapsa o grafo inteiro num ponto. */
      let s = 1 + (e.w - 1) * 0.12;
      if (s > 2.4) s = 2.4;
      const f = (d / K) * s;
      dx[i] -= ax * f; dy[i] -= ay * f; dz[i] -= az * f;
      dx[j] += ax * f; dy[j] += ay * f; dz[j] += az * f;
    }

    const temp = T0 * (1 - step / ITER);
    for (let i = 0; i < n; i++) {
      dx[i] -= px[i] * GRAVITY; dy[i] -= py[i] * GRAVITY; dz[i] -= pz[i] * GRAVITY;
      const len = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i] + dz[i] * dz[i]);
      if (len > 0.000001) {
        const cap = len < temp ? len : temp;
        const s = cap / len;
        px[i] += dx[i] * s; py[i] += dy[i] * s; pz[i] += dz[i] * s;
      }
    }
  }

  /* Centrado no centróide e escalado para caber numa esfera de raio 1, para que
     a câmara do navegador não precise saber nada sobre estes números. */
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += px[i]; cy += py[i]; cz += pz[i]; }
  cx /= n; cy /= n; cz /= n;
  let rmax = 0;
  for (let i = 0; i < n; i++) {
    const ax = px[i] - cx, ay = py[i] - cy, az = pz[i] - cz;
    const r = Math.sqrt(ax * ax + ay * ay + az * az);
    if (r > rmax) rmax = r;
  }
  const scale = rmax > 0 ? 1 / rmax : 1;
  const round = (v) => Math.round(v * 1000) / 1000;

  const years = pubs.map((p) => Number(p.year)).filter(Boolean);
  const out = {
    meta: {
      people: n,
      works: pubs.length,
      links: edges.length,
      members: nodes.filter((x) => x.m).length,
      from: Math.min(...years),
      to: Math.max(...years),
    },
    nodes: nodes.map((node, i) => ({
      n: node.n,
      m: node.m,
      w: node.w,
      f: node.f === Infinity ? null : node.f,
      l: node.l === -Infinity ? null : node.l,
      p: [round((px[i] - cx) * scale), round((py[i] - cy) * scale), round((pz[i] - cz) * scale)],
    })),
    /* Plano de propósito: três números por aresta, sem 700 pares de chaves. */
    links: edges.flatMap((e) => [e.a, e.b, e.w]),
  };
  return out;
}

/* Uma pessoa por linha, e as arestas em blocos de doze números.
   JSON.stringify(obj, null, 2) escreve cada coordenada na sua própria linha:
   trinta e seis quilobytes para o que cabe em treze, e um diff em que mudar
   uma posição mexe em cinco linhas. Isto é o mesmo JSON, quebrado onde a
   leitura quer que ele quebre. */
function serialise(net) {
  const q = JSON.stringify;
  const node = (x) => '    {"n":' + q(x.n) + ',"m":' + q(x.m) + ',"w":' + x.w
    + ',"f":' + q(x.f) + ',"l":' + q(x.l) + ',"p":[' + x.p.join(',') + ']}';
  const links = [];
  for (let i = 0; i < net.links.length; i += 12) {
    links.push('    ' + net.links.slice(i, i + 12).join(','));
  }
  return '{\n'
    + '  "meta": ' + q(net.meta) + ',\n'
    + '  "nodes": [\n' + net.nodes.map(node).join(',\n') + '\n  ],\n'
    + '  "links": [\n' + links.join(',\n') + '\n  ]\n'
    + '}\n';
}

module.exports = { buildNetwork, serialise };

if (require.main === module) {
  const pubs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/publications.json'), 'utf8'));
  const team = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/team.json'), 'utf8'));
  const net = buildNetwork(pubs, team);
  const text = serialise(net);
  JSON.parse(text);   // se o serialisador quebrar, quebra aqui e não no navegador
  fs.writeFileSync(path.join(ROOT, 'data/collab-network.json'), text);
  console.log(JSON.stringify(net.meta));
  console.log((text.length / 1024).toFixed(1) + ' KB');
}
