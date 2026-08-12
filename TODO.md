# TODO — estado de 2026-08-11

Lista de trabalho viva. O histórico detalhado de cada decisão está em
[docs/redesign-plan.md](docs/redesign-plan.md), seção 12; este arquivo é só o
que falta e o que acabou de ser feito, para retomar sem arqueologia.

---

## Próximos passos, em ordem

- [ ] **Projects: replicar o grid da Home sem duplicar código.**
      Extrair os cards (`.pc-card`) e as mídias vivas (cascata do YANC, pulso
      do HITS, loops de vídeo, o botão único de pausa) de `assets/js/home.js`
      para um módulo compartilhado que a Home e `projects/index.html`
      importam. As peças já estão em funções isoladas (home.js, ~linhas
      260–660); o markup dos cards vive inline no `index.html` (~687–870).
      A página Projects de hoje é o template antigo de cards com ícone.

- [ ] **CERN, resto da Fase 2.**
      Harmonizar prosa, tabelas e tipografia restantes com o sistema
      (Bodoni/Geist/Plex Mono), revisar as seções que não foram tocadas.

- [ ] **Home: roda do TileCal como fundo de hero.**
      Ideia aprovada: os 64 setores azimutais em três camadas (A, BC, D)
      girando devagar atrás do título, células acendendo, no lugar de
      elemento ao lado do texto. three.js, mesma gramática do grafo e do anel.

- [ ] **Conteúdo original do lab (aguarda material de vocês).**
      Vídeos originais (bancada, FPGA, sala de controle, CGVWeb rodando) para
      Home e CERN; assinaturas escaneadas dos 18 pesquisadores para o record
      do About (traçadas com DrawSVG). Mídia pesada vai ao nipscern-assets /
      cdn.nipscern.com.

---

## Feito em 2026-08-11, quarta rodada: dois tubos, e menos brilho à toa

- [x] **O tubo virou dois tubos, que é o que o LHC tem.** A máquina carrega os
      dois feixes em canos separados por quase os 27 km inteiros e só os junta
      num cano comum em torno dos quatro pontos, e é por isso que colisão
      acontece nesses quatro lugares e em nenhum outro, por mais que os
      pacotes se cruzem no meio do caminho. Desenhar um tubo só jogava esse
      fato fora. Agora os dois canos abrem nos arcos (uns 10 px) e fecham em
      cada ponto de interação, com passo suave, e cada trem anda no seu lado:
      dá para ver os feixes se aproximarem antes de cada cruzamento. Conferido
      na geometria, não no olho: a separação vai a zero exatamente em 0°, 45°,
      180° e 315°.
- [x] **Traços na direção certa, mesmo que a moldura corte.** A regra que
      encurtava o traço para caber mentia: as colisões perto de uma borda
      saíam todas tortas, fugindo do limite, e o braço do LHCb tinha de ser
      apontado para o lado que o quadro aguentava. Saiu. O braço do LHCb agora
      aponta onde o de verdade aponta, e a cadeia do fato é curta: o eixo z do
      LHCb vai do cruzamento para as câmaras de múon, o feixe 1 é codirecional
      a esse z, e o feixe 1 corre no sentido horário visto de cima. Logo, no
      Ponto 8 o jato sai pela tangente horária, que é o caminho para o Ponto 1.
      Medido: concentração 0,65 apontando para 216°, que é a direção do ATLAS.
- [x] **Menos cintilação, menos poluição.** A cabeça de cada pacote tinha o
      brilho sorteado a cada quadro. Parecia purpurina e não dizia nada: saiu.
      O ritmo caiu para uma volta a cada 4,6 s com nivelamento mais baixo, e a
      cobertura de traços no quadro ficou em 1,55%. Atividade medida: ATLAS
      76% dos intervalos, CMS 56%, LHCb 40%, ALICE 32%. Suíte do repositório
      passando, 55 a 61 fps.

## Feito em 2026-08-11, terceira rodada: os quatro colidem

- [x] **Os quatro experimentos colidem, porque na máquina os quatro colidem.**
      Antes só ATLAS e CMS acendiam, e isso não era física: era consequência
      de desenhar um pacote por feixe. Dois pontos largados juntos num círculo
      só podem se reencontrar onde saíram e meia volta depois. Agora cada
      feixe é um trem de pacotes num grid de oito slots com seis preenchidos,
      que é o esqueleto de um esquema de preenchimento real reduzido ao que o
      olho conta. A regra é uma linha só: no tique em que o anel girou k
      slots, o par que se encontra num ponto a q slots é (q−k) e (q+k), e há
      colisão ali se os dois slots carregam pacote. Daí sai sozinho o resto:
      todos os pontos no mesmo relógio, cada um com um par diferente, e as
      lacunas do trem chegando em momentos distintos a cada um.
- [x] **Nivelamento de luminosidade, que é o que separa os quatro de fato.**
      ATLAS e CMS tomam toda colisão que os slots permitem e guardam dois
      objetos de evento cada, para um segundo cruzamento pousar enquanto o
      primeiro ainda voa, que é o empilhamento com que eles vivem. LHCb entra
      nivelado abaixo e sai em cone, porque é espectrômetro e não barril.
      ALICE é a mais rara e a mais densa: 46 traços quando dispara, porque é
      para isso que ela existe e é por isso que ela não aguenta empilhamento.
      Medido por diferença entre quadros: ATLAS ativo em 96% dos intervalos,
      CMS 78%, LHCb 70%, ALICE 22%, com o pico de traços da ALICE maior que o
      do CMS. Concentração angular confirma o cone: R = 0,77 no LHCb contra
      0,01 a 0,22 nos três barris.
- [x] Os pacotes agora aparecem como trem, com lacuna visível, e o quadro do
      movimento reduzido mostra os dois trens parados no tubo. 61 fps.

## Feito em 2026-08-11, segunda rodada no hero do CERN

- [x] **Pins: seções dos detectores no lugar dos logos.** Os quatro pins
      passaram por logos, depois por fotos das cavernas (poluídas a 40 px), e
      agora são vigias abertas na página: cortes das próprias máquinas nos
      raios publicados, desenhados por `tools/build-experiment-figures.js`.
      ATLAS, CMS e ALICE em seção transversal, LHCb de lado porque é
      espectrômetro frontal. Sem disco branco: o SVG é o círculo inteiro,
      escuro como a página, com uma linha azul fina na borda como todo o
      contorno. Duas regras seguram o conjunto: o ímã é o que faz cada máquina
      ter uma forma diferente, então o ímã é a única coisa quente em cada
      figura; e toda figura tem traços saindo do cruzamento, porque detector
      sem evento dentro é desenho de buraco (a ALICE tem quarenta, que é o que
      um evento chumbo-chumbo parece). Isso **encerra o pedido de permissão de
      uso das marcas**: o hero não usa mais logo nenhum. Os arquivos dos logos
      ficam no disco (`atlas.webp` e companhia) e trocar os nomes em `IPS`
      volta atrás, mas aí o pedido às colaborações renasce. Cada pin ganhou o
      nome embaixo, em mono, com o do ATLAS no azul da própria borda. Os
      traços saem em quatro cores de croma cheio (âmbar, vermelho, ciano,
      verde), as mesmas que o anel usa nas colisões, então quem vê o evento
      disparar no Ponto 1 e depois olha o pin lê uma paleta só. Verificado por
      medição, não por opinião: nenhum pixel branco sobrou, croma médio de
      0,42 a 0,53 nos pixels acesos, cada figura tem o seu ímã e a sua borda
      azul, e as quatro são distintas entre si (RMS 55 a 77 em 255).
- [x] **ALICE e LHCb estavam trocados de lado no anel.** Erro de fato, não de
      gosto: o Ponto 2 (ALICE) fica sob Saint-Genis-Pouilly, a oeste do sítio
      de Meyrin, e o Ponto 8 (LHCb) sob Ferney-Voltaire, a leste, perto do
      aeroporto. Como o ângulo corre anti-horário a partir de baixo nesta
      figura, ALICE é o octante negativo e LHCb o positivo. Conferido passando
      a posição de cada pin pelas vias de fronteira do `meyrin-map.json`: o
      ATLAS cai do lado suíço e os outros três do francês, que é o que o chão
      diz. O classificador por paridade só funciona com âncora local (Meyrin);
      com raio longo até a borda da bbox ele erra, porque a fronteira é
      cortada pelo quadro e o raio escapa pelo buraco.
- [x] **Traçados do mapa suavizados.** As poligonais chegam do OSM
      simplificadas a 60 m, e cada curva era uma quina. Passam por corte de
      cantos de Chaikin antes de desenhar, 3 vezes na fronteira e 2 na água,
      mantendo as pontas onde o levantamento diz que estão.
- [x] **Fronteira: tentativa desfeita, fica a linha fina.** Ela chegou a ser
      reconstruída como malha (um quad por traço, com corredor contínuo por
      baixo) para ficar impossível de perder. Ficou impossível de perder e
      errada: a medida diz que a fronteira passou a ocupar tanto pixel quanto
      toda a água do mapa junta, e o chão virou o assunto no lugar da máquina.
      Voltou à tracejada fina de sempre, com rios e riachos na intensidade
      anterior. O leitor acha a fronteira porque ela é tracejada e porque
      FRANCE e SUISSE estão escritos dos dois lados, não porque ela grita.
- [x] Bandeira do país na legenda de cada pin, com os mesmos SVGs oficiais que
      os rótulos FRANCE e SUISSE usam no chão. O ATLAS é o único dos quatro na
      Suíça, e é o que este laboratório trabalha.
- [x] Créditos: a entrada dos logos virou a das seções, nos 4 idiomas.
- [x] Feixe visível no tubo: a parede do toro escrevia no depth buffer e
      ocultava os prótons que correm na sua linha de centro. `depthWrite:false`
      mais `renderOrder` explícito (tubo, dots, feixes/eventos); tubo
      escurecido e cabeça do bunch cintilando. Volta de 3 s para 2 s.
- [x] Trajetórias não são mais cortadas: cada trilha faz uma caminhada seca
      pelo frustum antes de ser desenhada e é **reescalada** para caber, em
      vez de bater numa parede invisível na borda. Canvas mais alto e câmera
      recuada. Cores mais quentes, com uma temperatura sorteada por trilha.
- [x] Mapa maior e sem borda cortada: bbox do OSM ampliado (~15 km do centro),
      e o fade deixou de ser elipse fixa em CSS — cada vértice é projetado
      pela câmera e some perto da borda real do quadro, com os segmentos
      longos subdivididos para o fade chegar a zero antes dela. A fronteira
      ficou a linha mais forte do chão, que é o que diz quem está na Suíça e
      quem está na França.
- [x] Parallax do banner: a folga de 18% da foto agora fica metade acima e
      metade abaixo (`top:-9%`), senão a borda reta da imagem entrava no
      quadro arredondado no extremo do drift.

## Feito em 2026-08-11

- [x] About: record dos pesquisadores redesenhado como dossiê (bios intactas,
      prêmios em tabela com ano em coluna, áreas sob o retrato).
- [x] About: acento roxo (#a855f7) trocado pelo azul da marca em CSS, grafo
      de coautoria e legenda nos 4 idiomas.
- [x] CERN: descida pinada Meyrin → sala de controle (mural do Kristofoletti,
      CC0/Wikimedia) → túnel → pesquisadores, medidor 0 → −100 → 0 m.
- [x] CERN: banner LHC Status em vidro sobre a foto da sala de controle, com
      parallax declarativo (data-drift).
- [x] CERN: fact-check contra fontes oficiais — 25 estados-membros + 11
      associados (Brasil, 2024), 17.500+ pessoas, ATLAS 5.500+ membros,
      ~60 TB/s brutos, HLT ~1 kHz, L0/free-running é Phase-II, LS3 até
      jun/2030, túnel 45–170 m nos 4 idiomas.
- [x] CERN: contribuição reescrita com material real (TMDB com link para a
      notícia, reconstrução de energia em FPGA, CGV 2007→WASM, MWPCs do LHCb).
- [x] CERN: o pulso do TileCal — figura sticky com 4 passos (forma, 7
      amostras, empilhamento, Â), dados tabulados de arXiv:1510.01690 por
      tools/build-tilecal-pulse.js, GSAP DrawSVG.
- [x] CERN: FCC condensado nos componentes do sistema; glass nas legendas,
      botões e link-cards; em-dashes removidos da prosa visível.
- [x] CERN hero: mapa real de Meyrin (OSM via tools/build-meyrin-map.js,
      fronteira tracejada + rios em azul aditivo), toro com glow, colisão
      como event display (trilhas curvas âmbar, múons vermelhos, neutras
      ciano), badges redondos com os logos oficiais, bandeiras SVG oficiais,
      FRANCE/SUISSE nos lados verdadeiros.
- [x] Bugs estruturais: `overflow-x: hidden` no body matava todo
      position:sticky do site (→ clip); .stagger-children apagava cards do
      10º em diante; a legenda do céu da Home nunca traduzia (template
      inerte); "−0 m" no medidor.
- [x] Créditos nos 4 idiomas: fotos CERN (Terms of Use), foto do mural
      (CC0, Josef Kristofoletti creditado), Standard Model (Cush, domínio
      público), pulso (ATLAS Collaboration), OpenStreetMap (ODbL), logos dos
      experimentos.
