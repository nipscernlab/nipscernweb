# Redesign completo do nipscern.com — estudo e plano

Status: estudo concluído em 2026-08-07. Nenhuma fase implementada ainda.
Ponto de retorno: release [v3.1.0](https://github.com/nipscernlab/nipscernweb/releases/tag/v3.1.0),
commit `8a991c3`, que congela o site como estava antes da reforma.

Objetivo: dar ao site uma identidade profissional própria, com um elemento
marcante por página, mantendo uma identidade global do laboratório. Sair do
visual de template e passar a usar o material autoral que o grupo já produz.

---

## 1. Decisões do cliente (registradas)

- Identidade única por página, não um template com nomes trocados.
- Um elemento marcante por página: cor, animação, 3D, o que fizer sentido.
- Sem modo claro/escuro. O site é escuro e cada página é única.
- Trabalho página por página, com calma, até cada uma ficar pronta.
- Identidade global do laboratório amarrando o conjunto.
- Trazer bastante material autoral: ícones, imagens, exemplos, dados, métricas.
- Mídia pesada vai para o repositório de assets (cdn.nipscern.com).
- Escolha da arquitetura delegada a quem implementa.
- Criar um blog (seção 9).
- `kristoffer/` não se toca. É projeto pessoal do Chrysthofer, sem relação com o
  laboratório, apenas hospedado no mesmo domínio. Fora do escopo da reforma e de
  qualquer limpeza.
- O céu estrelado da home é marca e permanece. Variações podem ser testadas; os
  traços de partícula entram como camada sobre ele, não no lugar dele.
- Tipografia: base padronizada para o site, com liberdade de fontes próprias nas
  páginas de projeto, como o YANC já faz.
- Tudo construído e revisado localmente primeiro, para poder comparar lado a
  lado com o site no ar antes de publicar.
- Telas menores são requisito permanente: laptop, tablet e celular entram na
  revisão de toda página, não no fim.
- Toda dependência de terceiro entra em `credits.html` no momento em que é
  adotada, com licença e link.

---

## 2. O que o estudo encontrou

### 2.1 Material autoral já existente e subaproveitado

- 43 SVGs, a maioria desenhada pelo grupo: olho de camaleão do SAPHO, três
  chevrons do YANC, emblema HITS edição Brasil, aurora boreal de 47 paths,
  Surfer surfando a aurora, e o circuito impresso dourado desenhado à mão que
  assina as imagens de compartilhamento.
- Nove fotografias do laboratório da UFJF dentro do CERN, incluindo a placa do
  detector de múons com o símbolo da UFJF gravado, módulo do TileCal, PMTs,
  eletrônica de front-end e uma panorâmica.
- O CGVWeb rodando nas telas da sala de controle do ATLAS, fotografado.
- Imagens computadas pelo hardware do próprio grupo: Mandelbrot e Buddhabrot
  calculados com SAPHO, árvore fractal de quarks e glúons.
- 147 publicações de 2001 a 2026 com tipo, ano, autores e venue. 18 pessoas.
  Prêmios datados. Nenhuma visualização em lugar nenhum.
- CGVWeb: viewer 3D real do calorímetro do ATLAS em Rust e WASM.

### 2.2 O que é genérico hoje

- 14 ilustrações unDraw em 12 páginas.
- O mesmo hero em nove páginas: eyebrow, título, subtítulo, desenho genérico à
  direita em caixa fixa de 280×200.
- Ícone Phosphor genérico como identidade de seção.
- Estatísticas arredondadas na home ("20+", "100+", "15+") quando existem
  números exatos nos dados.
- Gradiente azul em texto, glow e card que levanta 3px no hover, repetidos em
  todas as páginas.

### 2.3 Medições

Peso por página hoje, carregado sem necessidade:

| Item | Custo | Observação |
|---|---|---|
| Fonte de ícone Phosphor (woff2 + CSS) | 159 KB | para os 105 ícones que o site usa |
| `data/i18n.json` | 52 KB gzip | os 4 idiomas quando só 1 é usado |
| importmap do three.js | ruído | declarado na home, nada importa |

Sprite SVG com os mesmos 105 ícones: cerca de 8 KB gzip. Redução de 95% e fim
da dependência do unpkg.

Repositório: 110 MB dos 142 MB são as 105 capas do CERN Courier, referenciadas
por uma linha em `publications/courier.html`. É a causa do deploy lento do Pages.

---

## 3. Bibliotecas: viabilidade

### 3.1 Adotar

**GSAP com todos os plugins.** Gratuito para uso comercial desde abril de 2025,
quando a Webflow liberou a biblioteca inteira. Inclui ScrollTrigger, SplitText,
MorphSVG e DrawSVG, que antes eram pagos. MorphSVG e DrawSVG operam sobre SVG
autoral, que é exatamente o acervo do grupo. Custo aproximado: 70 KB gzip para
core mais ScrollTrigger, carregado só nas páginas que usam.

**Animações por rolagem nativas em CSS.** Suporte global em torno de 84%.
Firefox ainda atrás de flag, mas é prioridade do Interop 2026. Substitui o
sistema `fade-up` com IntersectionObserver que existe hoje. Custo zero.
Estratégia: CSS nativo onde o conteúdo sobrevive sem animar, GSAP onde a
coreografia é o conteúdo.

**View Transitions API entre documentos.** Transição animada entre páginas num
site multipágina estático, sem SPA. O wordmark pode persistir e se reposicionar
entre páginas; um card de projeto pode expandir para virar o hero daquele
projeto. Custo zero, é API do navegador. Degrada para navegação normal onde
não houver suporte.

**ogl para shaders.** 8 KB no core, 29 KB completo, ES modules, zero
dependências. Trinta vezes mais leve que three.js para fundo com shader e
campo de partículas.

**Sprite SVG de ícones.** Mantém Phosphor como base, que tem seis pesos e é
insubstituível nisso, mas entrega por sprite auto-hospedado. No mesmo sprite
entram as marcas autorais, então o ícone do SAPHO na navegação passa a ser o
olho de camaleão em vez de `ph-cpu`.

**Observable Plot** para gráficos padrão, do autor original do D3. SVG escrito
à mão animado com GSAP para as peças de assinatura.

### 3.2 Usar com parcimônia

**three.js.** Só onde 3D é o conteúdo. O CGVWeb já faz isso melhor, em Rust e
WASM. Custo de 260 KB gzip não se justifica como decoração. Remover o importmap
morto da home.

### 3.3 Descartar

**Rive e Lottie.** Runtime de 200 KB gzip no caso do Rive, e ambos exigem
editor e fluxo de trabalho que o grupo não tem. Com MorphSVG e DrawSVG
gratuitos, animação vetorial autoral sai de SVG escrito à mão.

**anime.js v4.** Excelente e leve (10 KB completo, 3 KB só WAAPI), mas
redundante se o GSAP entrar. Carregar as duas seria desperdício.

**Lenis (smooth scroll).** Briga com a rolagem nativa e prejudica
acessibilidade. Já está no `kristoffer/` e não deve migrar para o site.

---

## 4. Tipografia

Inter é hoje o sinal mais forte de template que o site emite. Direções:

- **IBM Plex** (Sans, Mono e Serif). Desenhada para produtos técnicos, com
  personalidade sem barulho, e as três variantes conversam entre si. É a mais
  coerente com engenharia.
- **Fraunces** para display. Tem eixo óptico e um eixo "wonky" que controla o
  quanto as excentricidades aparecem: em corpo grande as ink traps abrem e o
  contraste afia. Substituiria a DM Serif Display com muito mais presença.
- **Newsreader** para leitura longa, desenhada para texto extenso em tela.
  Candidata para o corpo das notícias, do blog e da página do CERN.

Todas com licença SIL Open Font, auto-hospedadas no CDN, com subset por idioma.
Decisão final na Fase 0.

---

## 5. Arquitetura

Gerador estático mínimo, em Node, rodado localmente, com saída commitada. Segue
a cultura que o repositório já tem: o `share-gen` roda local e a saída
(`news/<slug>.html`) é commitada.

O que o gerador resolve:

- As 30 linhas de `<head>` repetidas em 24 páginas.
- As centenas de estilos inline.
- Divisão do `i18n.json` por idioma.
- Montagem do sprite SVG a partir dos ícones usados.
- Fim da duplicação do CSS do hero entre o `<style>` inline da home e o
  `main.css`, que hoje exige editar os dois arquivos.

Não muda o GitHub Pages, não exige CI novo, não introduz framework.

---

## 6. Identidade global

O que toda página herda, definido na Fase 0:

- Sistema tipográfico (seção 4).
- Sprite único com Phosphor mais as marcas autorais.
- Paleta base do laboratório, com cor própria por página derivada dos tokens
  que já existem (`--accent-sapho` dourado, `--accent-yanc` teal,
  `--accent-hits` laranja, `--accent-aurora` violeta, `--accent-cgv` azul),
  estendida para CERN, publicações, notícias, sobre e blog.
- Transições entre páginas com View Transitions.
- O wordmark NIPS⚛CERN como elemento persistente.
- Grid de 12 colunas, que já existe e funciona.
- Regra de movimento: toda animação tem fallback em `prefers-reduced-motion`.

---

## 7. Elemento marcante por página

Um por página, ligado ao propósito da página, não à estética.

### Home
Propósito: porta institucional.
Elemento: o átomo do wordmark vira o ponto de interação real. Traços de
partículas saindo do centro, curvados por campo magnético, como um event
display do ATLAS. Substitui o céu estrelado atual, que é bonito mas diz
"espaço", não "física de partículas". Feito em ogl.
Complemento: as estatísticas arredondadas passam a ser calculadas dos dados
reais (147 publicações, 18 pessoas, anos exatos).

### About
Propósito: as pessoas.
Elemento: a rede de bolhas que já existe e funciona, mas com as arestas
passando a ser coautoria real extraída de `publications.json`, em vez de
vizinhança geométrica. O grafo deixa de ser decorativo e passa a ser verdadeiro.

### CERN
Propósito: explicar o CERN e o ATLAS.
Elemento: descida em rolagem. Da superfície de Genebra, 100 m abaixo até o
túnel do LHC, para dentro do ATLAS, atravessando as camadas do calorímetro,
até o módulo do TileCal em que o laboratório trabalha. GSAP ScrollTrigger com
pinning, usando as fotografias reais do CERN e o corte do ATLAS que já existem.
É a maior oportunidade cinematográfica do site.

### Projects (índice)
Propósito: catálogo.
Elemento: cada card carrega a identidade do próprio projeto (cor, marca,
movimento). A grade vira um conjunto de objetos distintos, não oito cards
iguais. Com View Transitions, o card expande para virar o hero do projeto.

### SAPHO
Propósito: o processador.
Elemento: o olho de camaleão, e o Buddhabrot calculado pelo próprio SAPHO como
material de hero. A imagem foi computada pelo processador que o grupo projetou.

### YANC
Já reescrita em 2026-07. Manter e harmonizar com o sistema global.

### AURORA
Já reescrita. Manter e harmonizar.

### HITS
Propósito: simulador em FPGA da leitura do TileCal.
Elemento: o pulso real. Forma de onda do sinal do TileCal desenhada com
DrawSVG, sincronizada com a rolagem.

### CGV
Propósito: o viewer 3D.
Elemento: parar de esconder num iframe de 520px. O viewer ao vivo ocupando o
hero inteiro.

### Publications
Propósito: arquivo e dado, 25 anos de produção.
Elemento: visualização do acervo como hero. Linha do tempo de produção por ano
e tipo. O arquivo fica visível antes de ficar pesquisável.

### News
Propósito: redação editorial.
Elemento: as imagens de compartilhamento que o `share-gen` já produz são
bonitas e assinadas. O índice passa a usar essa linguagem visual.

### Blog
Ver seção 9.

### Q&A, créditos, termos, privacidade
Propósito: utilidade. Elemento: contenção honesta. Não fingir peso.

### 404
Elemento: uma partícula perdida. Pequeno, com humor, sem custo.

---

## 8. Higiene a resolver no caminho

- Mover as 105 capas do CERN Courier para o CDN (110 MB, uma linha de código).
- Remover os 14 unDraw e as referências em 12 páginas.
- Remover o importmap morto do three.js na home.
- Limpar as metatags duplicadas da home: 4 `og:title` e 5 `description`
  concorrendo entre si.
- Remover a faixa de recrutamento do hero após 28/08/2026 (marcada no código
  como `RECRUIT-BANNER`).
- Decidir o destino de `kristoffer/`: está público, desconectado do site, com
  design próprio e três CDNs externos que o resto do site não usa.
- Substituir o `onmouseover` inline do footer.

---

## 9. Blog (novo)

Ideia registrada em 2026-08-07. A definir antes de implementar.

Separação em relação às notícias: notícia é o que aconteceu (aceite de artigo,
prêmio, marco). Blog é o que o grupo pensa e como fez (nota técnica, decisão de
projeto, tutorial, ensaio).

Perguntas abertas:

- Quem escreve? Só coordenação, ou qualquer membro?
- Idiomas: os quatro do site, ou português e inglês só?
- Formato de conteúdo: Markdown compilado pelo gerador, ou JSON como as
  notícias? Markdown é mais natural para texto longo com código.
- Precisa de código com destaque de sintaxe? Provavelmente sim, dado o assunto.
- Precisa de matemática (LaTeX)? Provavelmente sim.
- Rota: `/blog/` com posts em `/blog/<slug>`.
- Reaproveita o `share-gen` para imagens de compartilhamento e páginas de OG?
- Entra na busca? No RSS? (Não existe RSS no site hoje; seria bom ter.)

O elemento marcante do blog provavelmente é o próprio sistema tipográfico
levado a sério em leitura longa, mais blocos de código e figura tratados como
material de primeira classe.

---

## 9.1 Campanha de texto (frente paralela)

Decidida em 2026-08-07. Corre junto com as fases, não depois delas: cada página
redesenhada já sai com o texto revisado nos quatro idiomas.

Três problemas, medidos:

| Problema | Escala hoje |
|---|---|
| Em-dashes | 266 no HTML, 164 no `i18n.json`, 6 nos JSONs de notícia |
| Negrito | 66 `<strong>` no `news.json`, 13 por idioma no `i18n.json` |
| Tradução literal | os 12 posts traduzidos têm razão PT/EN entre 0,97 e 1,06 |

A razão de comprimento é o sinal mais claro. Português escrito nativamente fica
15 a 25% mais longo que o inglês; razão perto de 1,00 indica tradução palavra a
palavra. Todos os 12 posts caem nessa faixa.

Regra: cada idioma é escrito, não traduzido. O texto em português é redigido em
português por quem pensa em português, e o mesmo vale para inglês, francês e
norueguês. Compostos artificiais como o norueguês "Skrifttypehostingtjeneste"
(encontrado em `credits.gfonts_desc`) são o sintoma a eliminar.

Já aplicado: as três descrições de tipografia em `credits.*_desc`, reescritas
nativamente nos quatro idiomas.

---

## 9.2 Consolidação da licença (frente própria)

Registrada em 2026-08-07, a pedido do cliente. Ainda por fazer.

O repositório usa a Licença NIPS-CERN 1.0 (`LICENSE.md`, bilíngue): livre para
ler, estudar, usar e modificar, inclusive dentro de empresas; exploração
comercial exige autorização prévia por escrito do laboratório.

O que precisa ser resolvido:

- A licença está unificada entre os repositórios do laboratório? O `README`
  afirma que sim, mas isso precisa ser conferido repo a repo (`aurora`, `yanc`,
  `cgv-web`, `hits`, `nipscern-assets`).
- Distinguir claramente três coisas que hoje se misturam: o código do site, o
  conteúdo editorial (textos e imagens do grupo) e o material de terceiros
  (mídia do CERN, publicações dos próprios autores, fontes OFL, ícones MIT).
  Provavelmente pedem licenças diferentes.
- O YANC é MIT, segundo a página do projeto. Verificar se convive com a Licença
  NIPS-CERN 1.0 e qual vale para qual parte.
- Decidir a licença do conteúdo do blog quando ele existir (seção 9).
- `credits.html` é onde a atribuição de terceiros vive, e a regra combinada é
  que toda dependência entra lá no momento em que é adotada.

---

## 10. Plano de implementação por fases

Uma página por vez, até ficar pronta. A Fase 0 vem antes porque é o que todas
as outras herdam.

**Fase 0 — Identidade global e infraestrutura.**
Sistema tipográfico, paleta, sprite de ícones, gerador estático mínimo, View
Transitions, regra de movimento, capas do Courier para o CDN. Nenhuma página
redesenhada ainda, mas todas passam a compartilhar a mesma base.

**Fase 1 — Home.** A porta institucional e o teste do sistema.

**Fase 2 — CERN.** A peça mais ambiciosa, feita cedo enquanto há fôlego.

**Fase 3 — Projects (índice) e SAPHO, HITS, CGV.** YANC e AURORA só
harmonizam.

**Fase 4 — Publications.**

**Fase 5 — About.**

**Fase 6 — News.**

**Fase 7 — Blog.**

**Fase 8 — Utilidades:** Q&A, créditos, termos, privacidade, 404.

Cada fase termina com a página no ar e revisada. Sem fase pela metade.

---

## 11. Questões abertas

- Escolha tipográfica final (seção 4).
- Escopo e formato do blog (seção 9).
- Destino de `kristoffer/` (seção 8).
- O céu estrelado da home é substituído ou coexiste com o event display?
- As quatro traduções continuam obrigatórias em todas as páginas novas?

---

## 12. Decisões e progresso

**2026-08-07.** Estudo do site inteiro concluído. Release v3.1.0 publicada como
ponto de retorno. Cliente aprovou as sugestões do estudo e pediu o plano.
Decidido: uma página por vez até finalizar. Blog registrado como ideia nova.

**2026-08-11, About, o record dos pesquisadores.** Cliente vetou reescrita das
bios: foram os próprios pesquisadores que escreveram, e o texto deles fica. O
problema era o visual do record expandido, que empilhava blocos rotulados numa
coluna só, com a metade direita do painel vazia. Redesenhado como dossiê: o
retrato segura a coluna esquerda com as áreas de pesquisa e os links arquivados
embaixo, o cabeçalho ganha uma régua com a linha medida na outra ponta, a bio
fica na medida de leitura e os prêmios viram tabela com o ano em coluna mono. O
ano e a distinção são extraídos da string na exibição, sem tocar no dado.

**2026-08-11, conteúdo original (diretriz reforçada).** O cliente quer o site
carregando material autoral de verdade, a começar pela Home: vídeos originais
do grupo, imagens, PDFs. Regra de trabalho registrada: buscar sempre o material
real existente (repositório, cdn.nipscern.com) em vez de fabricar arte visual
ou prosa genérica; quando o material não existir, pedir ao grupo, não inventar.
O que o grupo pode fornecer e onde encaixa, seguindo a seção 7:

- Vídeos originais do laboratório (bancada, FPGA, sala de controle do ATLAS,
  CGVWeb rodando): candidatos a hero da Home e da página CERN.
- As nove fotografias do laboratório no CERN e as imagens computadas pelo
  SAPHO (Mandelbrot, Buddhabrot, fractais): já inventariadas na seção 2.1,
  seguem subaproveitadas.
- PDFs (posters, apresentações, material de divulgação): candidatos a acervo
  em Publications ou ao futuro blog.
- Mídia pesada vai para o nipscern-assets e é servida por cdn.nipscern.com,
  como já combinado.

**2026-08-07, Fase 0, tipografia.** Branch `redesign/phase-0`. Fontes escolhidas
e auto-hospedadas em `assets/fonts` (232 KB, licenças OFL junto):

- Fraunces variável para display, com os eixos `opsz` 9-144, `SOFT` e `WONK`.
- IBM Plex Sans variável para corpo e interface, com eixo de largura 75-100.
- IBM Plex Mono 400 e 500 para código, números e rótulos.

O eixo de tamanho óptico é deixado por conta do navegador: `font-optical-sizing`
já é `auto` por padrão e acompanha o tamanho real do `clamp()` melhor que
qualquer valor fixo. `SOFT` e `WONK` ficam no padrão 0 do arquivo, e uma página
que quiser o corte mais estranho declara localmente
`font-variation-settings: 'WONK' 1`, o que sobrescreve só esse eixo.

Peso das fontes subiu de 129 KB para 196 KB, mas saíram três origens externas
(`fonts.googleapis.com`, `fonts.gstatic.com` e, quando o sprite entrar,
`unpkg.com`) e 159 KB da fonte de ícone Phosphor. Saldo previsto: 92 KB a menos
por página.

Também feito: importmap morto do three.js removido da home; peso do display
subido de 400 para 500 porque Fraunces é mais leve que a DM Serif Display que
substitui; `credits.html` atualizado e as chaves de tipografia do `i18n.json`
reescritas nativamente nos quatro idiomas.

Armadilha registrada: `main.css` e os HTML são CRLF. Editar com ferramenta que
preserve as quebras. Um `perl -0777 -pi` reescreveu o arquivo inteiro para LF e
foi preciso reverter.

**2026-08-07, Fase 0, tipografia (revisão).** Cliente perguntou se Fraunces
trazia elegância. Não trazia: Fraunces é um revival de serifadas publicitárias
dos anos 70, quente e um pouco retrô. Isso é charme, não elegância. Trocada por
Bodoni Moda, uma didone de contraste extremo com eixo óptico de 6 a 96, mais
Geist no lugar do IBM Plex Sans. IBM Plex Mono fica.

Na primeira renderização o wordmark se desmontou: os "N" viraram barras soltas.
Três causas somadas, todas corrigidas:

- Bodoni em peso 400 numa tela quase preta. Traço fino é opticamente corroído
  pelo escuro em volta e Bodoni desenha a diagonal do N como hairline. Peso 600
  só no `.hero-title`.
- `opsz` automático ia ao topo do eixo no tamanho do hero, que é o corte de
  contraste máximo. Fixado em 40 apenas ali.
- O gradiente foil tinha âncora `#16407d`, que sobre `#070a12` lê como letra
  apagada. Piso levantado para o azul da marca, e o ramp, que tinha um vale em
  46,5%, agora sobe monotonicamente. Luminância mínima 149 contra fundo 10.

Fora do hero o display fica em 400: nos tamanhos menores a hairline não corre o
mesmo risco e o peso baixo é o que dá a elegância.

**2026-08-07, Fase 0, escala fluida.** Cliente apontou que botões e texto não
acompanhavam o resize. Era verdade e era estrutural: o título escalava em `12vw`
enquanto o subtítulo ia de 16 a 18px e os botões tinham padding fixo, então a
página só ficava proporcional numa largura.

Escala inteira trocada por interpolação linear entre 360px e 1440px de viewport.
Passos pequenos quase não se movem (corpo precisa continuar legível a 360px),
passos de display se movem muito. O ritmo de seção também virou fluido a partir
do passo 10; de 1 a 8 continua fixo, porque é espaçamento interno de componente.
Botões ganharam padding fluido em trilha própria, com piso de alvo de toque.

Efeito colateral resolvido: com os tokens virando `clamp()`, quinze classes
faziam `clamp` dentro de `clamp`. Duas inclinações competindo mudam a relação
entre um título e o texto sob ele conforme a janela. Todas colapsadas para o
token direto.

Resultado: a razão título/corpo vai de 2,7 a 320px até 6,0 a 1440px, de forma
contínua.

**2026-08-07, Fase 0, ícones e emojis.** A fonte Phosphor saiu. No lugar,
`assets/css/icons.css`, gerado por `tools/build-icons.js`: 106 ícones que o site
realmente usa mais três marcas próprias monocromáticas, entregues como máscara
CSS sobre `currentColor`. Zero mudança de marcação, o `<i class="ph ph-cpu">`
continua valendo. Marcas coloridas (camaleão do SAPHO, aurora, HITS, CGV) não
entram: máscara descarta cor e elas virariam silhueta chapada.

Três nomes de ícone nunca existiram no Phosphor e estavam quebrados no site:
`ph-circuit-board`, `ph-compiler` e `ph-open-source-logo`. Trocados por
`circuitry`, `code-block` e `git-fork`.

Emojis eliminados do site: o talher em `news.json` e o elo na legenda de
Instagram em `post.html`. Os glifos `⏸` e `▶` em prosa no CGV viraram ícones.
`©` e o `⚛` do wordmark ficam, porque não são emoji.

Com o unpkg fora, as menções a ele em `privacy.html` e `credits.html` ficaram
factualmente erradas e foram removidas nos quatro idiomas, junto com a chave
órfã `unpkg_desc`. A descrição do Phosphor foi reescrita nativamente por idioma.

Balanço de peso por página: de 288 KB em três origens externas para 102 KB na
própria origem.

Pendente de revisão visual do cliente: o peso 600 do wordmark e o display em 400
nas páginas internas.
