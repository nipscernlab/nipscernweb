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

- [ ] **Logos dos experimentos: pedir permissão formal.**
      Os logos de ATLAS, CMS, ALICE e LHCb no hero do CERN estão como TESTE.
      As diretrizes do CERN exigem aprovação prévia para uso por terceiros e
      proíbem modificar as marcas (por isso estão inteiras, em discos
      brancos). Ação do grupo, não do código: encaminhar o pedido às
      colaborações. Referências: design-guidelines.web.cern.ch e
      atlas.cern/design.

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
