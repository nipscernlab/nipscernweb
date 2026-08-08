# Diretrizes do redesign do nipscern.com

Arquivo de contexto para quem continuar o trabalho. Reúne as decisões e as
regras que o Chrysthofer estabeleceu durante a reforma iniciada em 2026-08-07.
O plano detalhado, com estudo, viabilidade de bibliotecas e fases, está em
[docs/redesign-plan.md](docs/redesign-plan.md).

Ponto de retorno: release [v3.1.0](https://github.com/nipscernlab/nipscernweb/releases/tag/v3.1.0),
commit `8a991c3`, que congela o site como estava antes da reforma.

---

## 1. A regra que gerou todas as outras

O site precisa parecer feito por gente que sabe do que está falando, e não por
um gerador. Quase toda correção nesta reforma veio de uma violação disso.

**Não invente elemento visual.** Não desenhe SVG, não escreva shader, não crie
ilustração. Use biblioteca pronta ou material autoral do laboratório. Quando
faltar biblioteca, procure na internet antes de improvisar; a resposta quase
sempre existe. Um shader escrito à mão foi rejeitado, e o substituto correto
foi uma implementação de terceiros adaptada.

**Biblioteca não é desculpa para enfeite.** Trocar código próprio por
biblioteca não resolve nada se o efeito continua sendo ornamento sem relação
com o conteúdo. Um card inclinando no hover foi rejeitado mesmo vindo de
biblioteca MIT de 2,6 KB.

**Leia os papers.** O conteúdo técnico do site tem fonte: 147 publicações com
PDF no CDN, mais os repositórios irmãos em `C:\Users\chrys\Documents\GitHub`
(`yanc`, `aurora`, `cgv-web`, `hits`, `sapho_cnn`, `surfer-aurora`). Os
mnemônicos do YANC saíram do lexer `ASMComp.l`. A forma do pulso do HITS saiu
do paper do INSCIT 2026 sobre o shaper CR-4RC. Nada disso se adivinha.

---

## 2. Identidade

- Identidade própria por página. Não é um template com nomes trocados.
- Um elemento marcante por página, ligado ao propósito dela, não à estética.
- Sem modo claro. O site é escuro e cada página é única.
- Inspiração declarada: **Raycast**. O que se aproveita de lá é liderar com o
  produto em tamanho real, fundo quase preto neutro, espaço generoso, valores
  técnicos tratados como objeto, e cards com desenho técnico em vez de foto.
  O que não se aproveita: mesh de gradiente colorido, vidro fosco e grade de
  cards uniformes, que num laboratório de física leem como SaaS.
- Cor por projeto, dos tokens que já existem: `--accent-sapho` dourado,
  `--accent-yanc` teal, `--accent-hits` laranja, `--accent-aurora` violeta,
  `--accent-cgv` azul.
- As marcas autorais entram no lugar dos ícones genéricos: o olho de camaleão
  do SAPHO, os três chevrons do YANC, o emblema HITS, a aurora boreal.

---

## 3. Texto

- **Sem em-dash.** Nem em português, nem em inglês.
- **Negrito com parcimônia.** Frase inteira em negrito não enfatiza nada.
- **Sem construção de frase de IA.** Nada de "descubra", "explore", "mergulhe",
  "no mundo de hoje", "não é apenas X, é Y".
- **Cada idioma é escrito, não traduzido.** O texto em português é redigido em
  português por quem pensa em português, e o mesmo vale para inglês, francês e
  norueguês. Razão de comprimento PT/EN perto de 1,00 é sinal de tradução
  palavra a palavra; português nativo fica 15 a 25% mais longo.
- **Sem emoji.** Onde havia, entrou ícone. `©` e o `⚛` do wordmark ficam,
  porque não são emoji.
- **No GitHub, em inglês.** Mensagens de commit, releases, corpos de PR e
  issues. Documentos internos em `docs/` seguem em português.

### Enquadramento institucional, corrigido pelo cliente

- O grupo **não colabora com o CERN, é parte do CERN**. Nunca escrever
  "in collaboration with CERN".
- **Dois laboratórios**: o NIPS, na UFJF, no Brasil, e a Route Salam, no CERN,
  na Suíça. Manter essa fórmula em todos os idiomas.
- **5 institutos brasileiros**, não "institutos nacionais". O número existe para
  demonstrar o binacionalismo do laboratório.
- Domínios de trabalho: física de altas energias, computação científica,
  visualização 3D, sistemas de hardware e inteligência artificial.
- Números vêm dos dados, não arredondados para cima. Hoje: 147 publicações,
  26 anos de produção (2001 a 2026), 32 teses e dissertações orientadas,
  18 pessoas, 127 coautores distintos.

---

## 4. Processo

- **Uma página por vez, até terminar.** Não espalhar por várias páginas.
  Quando o foco é a home, as outras páginas não existem.
- **Estudar antes de propor.** Ler o código, medir, conferir os dados.
- **Construir local primeiro.** O cliente compara `127.0.0.1:8080` com o site no
  ar antes de qualquer publicação.
- **Ser ativo.** Perguntar quando a decisão é do cliente, mas não parar a cada
  passo pedindo permissão. Menos explicação, mais entrega.
- **Telas menores são requisito permanente.** Laptop, tablet e celular entram na
  revisão de cada página, não no fim.

---

## 5. Bibliotecas

Instaladas e auto-hospedadas em `assets/js/vendor`, sem CDN de terceiro:

| Biblioteca | Peso gzip | Papel |
|---|---|---|
| GSAP 3.13 + ScrollTrigger | 44 KB | Coreografia de rolagem e parallax |
| ogl | 37 KB | WebGL, importado sob demanda |

Avaliadas e descartadas, com o motivo: **three.js** (260 KB, só onde 3D é o
conteúdo, e o CGVWeb já faz isso melhor), **anime.js** (excelente mas redundante
com o GSAP), **Rive e Lottie** (exigem editor e fluxo que o grupo não tem),
**Lenis** (briga com a rolagem nativa), **Atropos** (funciona, mas o efeito é
ornamento).

Descobertas que mudam decisões antigas:

- **GSAP é gratuito desde abril de 2025**, com todos os plugins, incluindo
  ScrollTrigger, SplitText, MorphSVG e DrawSVG. Não era verdade quando o site
  foi construído.
- **Animações por rolagem nativas em CSS** têm 84% de suporte e substituem o
  sistema `fade-up` com IntersectionObserver.
- **View Transitions entre documentos** dão transição entre páginas num site
  multipágina estático, sem SPA e sem custo. Ainda não implementado.

---

## 6. Infraestrutura

- **Mídia pesada vai para `nipscern-assets`**, servido em `cdn.nipscern.com`.
  O CI deste repositório bloqueia arquivos acima de 2 MB. O repo de assets fica
  em `C:\Users\chrys\Documents\GitHub\nipscern-assets` e precisa de commit e
  push próprios; o GitHub Pages leva alguns minutos para publicar.
- **Cache do CDN é de um ano.** Regerar um arquivo com o mesmo nome não
  substitui o antigo. Use `?v=` ou purgue no painel.
- **Arquivo fonte nunca se altera.** Vídeo, foto ou PDF originais permanecem
  intocados; o processamento escreve em arquivo novo.
- **Créditos em dia.** Toda dependência de terceiro entra em `credits.html` no
  momento em que é adotada, com licença e link. Pendente: GSAP, ogl e a
  implementação de aurora do React Bits.
- **`kristoffer/` não se toca.** É projeto pessoal do Chrysthofer, sem relação
  com o laboratório, apenas hospedado no mesmo domínio. Fora do escopo de
  qualquer reforma ou limpeza.
- **Licença por consolidar.** Ver seção 9.2 do plano: falta conferir se a
  Licença NIPS-CERN 1.1 está unificada entre os repositórios e separar código do
  site, conteúdo editorial e material de terceiros.

---

## 7. Armadilhas do repositório, aprendidas na prática

- **Os arquivos são CRLF.** Editar com ferramenta que preserve as quebras. Um
  `perl -0777 -pi` reescreveu `main.css` inteiro para LF e foi preciso reverter.
- **Animação nunca decide se o conteúdo aparece.** `gsap.from({opacity: 0})`
  escreve `opacity:0` inline no instante em que o tween é criado e só limpa
  quando o gatilho dispara. Um gatilho que não dispara deixa a seção em branco.
  Existe uma rede de segurança em `home.js` que revela à força o que continuar
  escondido dois segundos depois do load.
- **Nunca engolir erro em silêncio.** Quase todo bug demorado desta sessão foi
  um `catch` vazio. Toda falha cai num fallback visível e escreve o motivo no
  console.
- **`scroll-behavior: smooth` quebra o ScrollTrigger.** Foi removido do `html`.
- **Parallax em bloco de layout usa pixel, não porcentagem.** `yPercent` num
  bloco de 700px vira 70px de movimento sem teto e colide com o vizinho.
  Porcentagem só para mídia dentro de moldura que recorta.
- **A altura da página muda muito depois do load.** Um `ResizeObserver` em
  `home.js` recalcula o ScrollTrigger quando isso acontece.
- **O CSS do `projects/index.html` e o da home compartilhavam nomes.** A home
  usa `pc-card`, a página de projetos usa `project-card`. Não misturar de novo.
- **O CSS crítico inline da home duplica tokens do `main.css`.** Mudou num,
  mude no outro, senão a página pinta com valores velhos e pula.
- **O viewer do CGV vem de outro repositório por Worker.** Não existe num
  checkout local, então o card e a seção têm poster e fallback.

---

## 8. Estado em 2026-08-08

Feito, na branch `redesign/phase-0`, nada publicado:

- Tipografia: Bodoni Moda para display, Geist para corpo, IBM Plex Mono para
  números e código, auto-hospedadas. Saíram Google Fonts e unpkg.
- Escala fluida de tipo, espaçamento e botões, interpolando entre 360 e 1440px.
- Ícones como máscara CSS a partir de `assets/css/icons.css`, gerado por
  `tools/build-icons.js`. 106 ícones mais três marcas próprias.
- Emojis eliminados do site.
- Home: barra de recrutamento no topo, garoto na janela com o céu único por
  visita, números reais, calorímetro em largura total, cinco cards de projeto
  com mídia animada, seção "From the Lab" refeita, parallax em 17 camadas.

Pendente na home: créditos das bibliotecas novas, View Transitions,
performance, e as capas do CERN Courier saindo do repositório para o CDN
(110 MB dos 142 MB).

Depois da home, a ordem do plano é CERN, projetos, publicações, sobre,
notícias, blog e utilidades.
