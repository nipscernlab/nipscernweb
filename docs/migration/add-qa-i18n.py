# -*- coding: utf-8 -*-
# Adiciona a secao "qa" (pagina Q&A) e o rotulo footer.qa ao data/i18n.json,
# nos 4 idiomas. As strings en sao extraidas do proprio qa.html (fonte unica).
import json, io, re

QA = {
"en": {
  "hero": {"label": "Questions & Answers", "title": "The Big Questions, Answered",
    "subtitle": "What people ask about CERN, the ATLAS experiment and the NIPSCERN projects, answered plainly by the lab that lives this work every day."},
  "cat_lab": "The Laboratory", "cat_projects": "Our Projects", "cat_cern": "CERN & ATLAS",
},
"pt": {
  "hero": {"label": "Perguntas e Respostas", "title": "As grandes perguntas, respondidas",
    "subtitle": "O que as pessoas perguntam sobre o CERN, o experimento ATLAS e os projetos do NIPSCERN, respondido sem rodeios pelo laboratório que vive esse trabalho todos os dias."},
  "cat_lab": "O Laboratório", "cat_projects": "Nossos Projetos", "cat_cern": "CERN & ATLAS",
  "q1": "O que é o NIPSCERN?",
  "a1": "O NIPSCERN (Núcleo de Instrumentação e Processamento de Sinais) é um laboratório de pesquisa e desenvolvimento da Universidade Federal de Juiz de Fora (UFJF). O laboratório projeta instrumentação eletrônica, métodos de processamento de sinais e processadores para a física de altas energias, em colaboração direta com o <a href=\"cern\">experimento ATLAS no CERN</a>. Conheça a <a href=\"about\">equipe e a missão</a>.",
  "q2": "Como um laboratório brasileiro colabora com o CERN?",
  "a2": "O NIPSCERN contribui para a operação e calibração do calorímetro hadrônico TileCal do detector ATLAS, desenvolve métodos digitais de reconstrução de sinais usados na seleção de eventos e cria softwares como o <a href=\"projects/cgv\">CGVWeb</a>, que roda no telão da Sala de Controle do ATLAS em Genebra. Membros do laboratório trabalham na UFJF e no próprio CERN; a história completa está na nossa <a href=\"cern\">página CERN & ATLAS</a>.",
  "q3": "Como posso entrar no NIPSCERN ou propor uma parceria?",
  "a3": "Estamos contratando: o laboratório busca pesquisadores em lógica, filosofia, engenharia de software, engenharias, programação e design. Empresas e instituições interessadas em construir sobre o nosso trabalho são bem-vindas: nossa <a href=\"https://github.com/nipscernlab/nipscernweb/blob/main/LICENSE.md\" target=\"_blank\" rel=\"noopener\">licença</a> é aberta a parcerias. Escreva para contact@nipscern.com ou nos conheça pela <a href=\"about\">página Sobre</a>.",
  "q4": "O que é o SAPHO?",
  "a4": "O <a href=\"projects/sapho\">SAPHO</a> é uma arquitetura de hardware escalável e um conjunto de ferramentas para criar processadores: você descreve um algoritmo em poucas linhas de C±, e o SAPHO gera um processador soft-core feito sob medida para rodar exatamente aquele algoritmo numa FPGA. A plataforma é a soma das partes (SAPHO = <a href=\"projects/aurora\">AURORA</a> + <a href=\"projects/yanc\">YANC</a>) e inclui POLARIS, YAWT e PRISM.",
  "q5": "O que é o AURORA?",
  "a5": "O <a href=\"projects/aurora\">AURORA</a> é a IDE oficial de desktop da plataforma SAPHO: escreva o algoritmo, compile, simule e inspecione o processador gerado numa única janela. O Aurora Intelligence adiciona um assistente de IA que opera a IDE pelas próprias ferramentas dela.",
  "q6": "O que é o YANC?",
  "a6": "O <a href=\"projects/yanc\">YANC</a> é o conjunto de compiladores que move o ecossistema SAPHO, incluindo o cmmcomp (compilador de C±) e o asmcomp (compilador de assembly). É escrito em C com Flex, Bison e GCC.",
  "q7": "O que é o CGVWeb?",
  "a7": "O <a href=\"projects/cgv\">CGVWeb</a> renderiza eventos reais de colisão dos calorímetros do ATLAS em 3D, em qualquer navegador, sem instalar nada. Construído com Rust/WebAssembly e Three.js, ele roda no telão da Sala de Controle do ATLAS no CERN. <a href=\"projects/cgvweb/\">Abra a aplicação ao vivo</a> ou leia a <a href=\"library/cgvweb/twiki/\">documentação técnica</a>.",
  "q8": "O que é o POLARIS?",
  "a8": "O <a href=\"projects/polaris\">POLARIS</a> é uma IDE gráfica moderna e multiplataforma para o ecossistema SAPHO, construída com Tauri e Rust. Integra o editor Monaco, o visualizador de RTL PRISM e o tracer de ondas YAWT.",
  "q9": "O que é o CERN e o que significa o nome?",
  "a9": "O CERN é o maior laboratório de física de partículas do mundo. O nome vem do francês <em>Conseil Européen pour la Recherche Nucléaire</em>, o conselho provisório criado em 1952 para planejar o laboratório; a organização que ele fundou manteve a sigla. Nossa <a href=\"cern\">página CERN & ATLAS</a> conta a história em profundidade.",
  "q10": "Onde fica o CERN?",
  "a10": "O CERN fica na fronteira entre a Suíça e a França, na saída de Genebra, com o campus principal em Meyrin. Seus aceleradores correm no subsolo dos dois países, incluindo o anel onde <a href=\"cern\">a equipe trabalha com o experimento ATLAS</a>.",
  "q11": "Quando o CERN foi fundado, e por quem?",
  "a11": "O CERN foi fundado em 29 de setembro de 1954 por doze países europeus que reconstruíam a cooperação científica no pós-guerra. Hoje conta com mais de vinte estados-membros, e cientistas de todos os continentes, incluindo o Brasil, participam dos seus experimentos.",
  "q12": "O que é o experimento ATLAS?",
  "a12": "O ATLAS é o maior detector de partículas de uso geral do Grande Colisor de Hádrons: 46 metros de comprimento, 25 de altura, cerca de 7.000 toneladas, a 100 metros de profundidade. Em 2012, ATLAS e CMS anunciaram a descoberta do bóson de Higgs. O NIPSCERN contribui para o calorímetro TileCal dele; veja <a href=\"cern\">como</a>.",
  "q13": "Onde fica o LHC e como ele funciona?",
  "a13": "O Grande Colisor de Hádrons é um anel de 27 quilômetros a cerca de 100 metros sob a fronteira franco-suíça. Ímãs supercondutores guiam dois feixes de prótons a quase a velocidade da luz para colisões frontais, até 40 milhões de vezes por segundo, recriando condições próximas às do universo primordial. Detectores como o <a href=\"cern\">ATLAS</a> registram o que sai delas.",
  "q14": "Quais países e instituições participam do ATLAS?",
  "a14": "A colaboração ATLAS reúne milhares de cientistas de cerca de 180 instituições em aproximadamente 40 países. O Brasil está entre eles, e a UFJF, por meio do NIPSCERN, é uma das instituições participantes. Nossas contribuições estão detalhadas na <a href=\"cern\">página CERN & ATLAS</a>.",
  "q15": "O CERN abriu um portal ou dividiu uma singularidade?",
  "a15": "Não. O LHC colide prótons, algo que os raios cósmicos fazem na atmosfera da Terra o tempo todo e com energias ainda maiores, e nenhum portal, dimensão ou singularidade está envolvido. O que as colisões realmente produzem é bem mais interessante: medidas precisas das partículas e forças que compõem o universo. Veja <a href=\"cern\">o que acontece de verdade dentro do ATLAS</a>.",
  "q16": "Quais são as 17 partículas do Modelo Padrão?",
  "a16": "O Modelo Padrão descreve a matéria com 17 partículas fundamentais: seis quarks, seis léptons (incluindo o elétron e os neutrinos), quatro bósons mediadores de força (fóton, glúon, W e Z) e o bóson de Higgs, confirmado no CERN em 2012. Há um diagrama completo na nossa <a href=\"cern\">página CERN & ATLAS</a>.",
  "q17": "O que é o CERN Courier?",
  "a17": "O CERN Courier é a revista internacional da física de altas energias, publicada desde 1959. O NIPSCERN mantém uma <a href=\"publications/courier\">coleção digital de edições</a> de 2013 até hoje, ao lado das nossas próprias <a href=\"publications\">publicações científicas</a>."
},
"fr": {
  "hero": {"label": "Questions et Réponses", "title": "Les grandes questions, avec leurs réponses",
    "subtitle": "Ce que l'on demande sur le CERN, l'expérience ATLAS et les projets du NIPSCERN, expliqué simplement par le laboratoire qui vit ce travail au quotidien."},
  "cat_lab": "Le Laboratoire", "cat_projects": "Nos Projets", "cat_cern": "CERN & ATLAS",
  "q1": "Qu'est-ce que le NIPSCERN ?",
  "a1": "Le NIPSCERN (Núcleo de Instrumentação e Processamento de Sinais, Noyau d'Instrumentation et de Traitement du Signal) est un laboratoire de recherche et développement de l'Université Fédérale de Juiz de Fora (UFJF), au Brésil. Le laboratoire conçoit de l'instrumentation électronique, des méthodes de traitement du signal et des processeurs pour la physique des hautes énergies, en collaboration directe avec <a href=\"cern\">l'expérience ATLAS au CERN</a>. Découvrez <a href=\"about\">l'équipe et la mission</a>.",
  "q2": "Comment un laboratoire brésilien collabore-t-il avec le CERN ?",
  "a2": "Le NIPSCERN contribue à l'exploitation et à l'étalonnage du calorimètre hadronique TileCal du détecteur ATLAS, développe des méthodes numériques de reconstruction des signaux utilisées dans le déclenchement des événements, et crée des logiciels comme <a href=\"projects/cgv\">CGVWeb</a>, affiché sur le grand écran de la salle de contrôle d'ATLAS à Genève. Les membres du laboratoire travaillent à l'UFJF et au CERN même ; l'histoire complète est sur notre <a href=\"cern\">page CERN & ATLAS</a>.",
  "q3": "Comment rejoindre le NIPSCERN ou proposer un partenariat ?",
  "a3": "Nous recrutons : le laboratoire recherche des chercheurs en logique, philosophie, génie logiciel, ingénierie, programmation et design. Les entreprises et institutions souhaitant bâtir sur notre travail sont les bienvenues : notre <a href=\"https://github.com/nipscernlab/nipscernweb/blob/main/LICENSE.md\" target=\"_blank\" rel=\"noopener\">licence</a> est ouverte aux partenariats. Écrivez à contact@nipscern.com ou rencontrez-nous via la <a href=\"about\">page À propos</a>.",
  "q4": "Qu'est-ce que SAPHO ?",
  "a4": "<a href=\"projects/sapho\">SAPHO</a> est une architecture matérielle évolutive et une chaîne d'outils pour créer des processeurs : décrivez un algorithme en quelques lignes de C±, et SAPHO génère un processeur soft-core taillé pour exécuter exactement cet algorithme sur FPGA. La plateforme est la somme de ses parties (SAPHO = <a href=\"projects/aurora\">AURORA</a> + <a href=\"projects/yanc\">YANC</a>) et inclut POLARIS, YAWT et PRISM.",
  "q5": "Qu'est-ce qu'AURORA ?",
  "a5": "<a href=\"projects/aurora\">AURORA</a> est l'IDE de bureau officiel de la plateforme SAPHO : écrivez l'algorithme, compilez, simulez et inspectez le processeur généré dans une seule fenêtre. Aurora Intelligence ajoute un assistant d'IA qui pilote l'IDE avec ses propres outils.",
  "q6": "Qu'est-ce que YANC ?",
  "a6": "<a href=\"projects/yanc\">YANC</a> est la chaîne de compilation qui anime l'écosystème SAPHO, avec cmmcomp (compilateur C±) et asmcomp (compilateur d'assembleur). Elle est écrite en C avec Flex, Bison et GCC.",
  "q7": "Qu'est-ce que CGVWeb ?",
  "a7": "<a href=\"projects/cgv\">CGVWeb</a> affiche en 3D, dans n'importe quel navigateur et sans installation, de vrais événements de collision des calorimètres d'ATLAS. Construit avec Rust/WebAssembly et Three.js, il tourne sur le grand écran de la salle de contrôle d'ATLAS au CERN. <a href=\"projects/cgvweb/\">Ouvrez l'application</a> ou lisez la <a href=\"library/cgvweb/twiki/\">documentation technique</a>.",
  "q8": "Qu'est-ce que POLARIS ?",
  "a8": "<a href=\"projects/polaris\">POLARIS</a> est un IDE graphique moderne et multiplateforme pour l'écosystème SAPHO, construit avec Tauri et Rust. Il intègre l'éditeur Monaco, le visualiseur RTL PRISM et le traceur d'ondes YAWT.",
  "q9": "Qu'est-ce que le CERN et que signifie son nom ?",
  "a9": "Le CERN est le plus grand laboratoire de physique des particules au monde. Le nom vient du <em>Conseil Européen pour la Recherche Nucléaire</em>, l'organe provisoire créé en 1952 pour planifier le laboratoire ; l'organisation qu'il a fondée a gardé le sigle. Notre <a href=\"cern\">page CERN & ATLAS</a> raconte l'histoire en profondeur.",
  "q10": "Où se trouve le CERN ?",
  "a10": "Le CERN est situé à la frontière franco-suisse, aux portes de Genève, avec son campus principal à Meyrin. Ses accélérateurs courent sous les deux pays, dont l'anneau où <a href=\"cern\">l'équipe travaille avec l'expérience ATLAS</a>.",
  "q11": "Quand le CERN a-t-il été fondé, et par qui ?",
  "a11": "Le CERN a été fondé le 29 septembre 1954 par douze pays européens qui reconstruisaient la coopération scientifique d'après-guerre. Il compte aujourd'hui plus de vingt États membres, et des scientifiques de tous les continents, dont le Brésil, participent à ses expériences.",
  "q12": "Qu'est-ce que l'expérience ATLAS ?",
  "a12": "ATLAS est le plus grand détecteur polyvalent du Grand collisionneur de hadrons : 46 mètres de long, 25 de haut, environ 7 000 tonnes, à 100 mètres sous terre. En 2012, ATLAS et CMS ont annoncé la découverte du boson de Higgs. Le NIPSCERN contribue à son calorimètre TileCal ; voyez <a href=\"cern\">comment</a>.",
  "q13": "Où est le LHC et comment fonctionne-t-il ?",
  "a13": "Le Grand collisionneur de hadrons est un anneau de 27 kilomètres à environ 100 mètres sous la frontière franco-suisse. Des aimants supraconducteurs guident deux faisceaux de protons proches de la vitesse de la lumière vers des collisions frontales, jusqu'à 40 millions de fois par seconde, recréant des conditions proches de celles de l'univers primordial. Des détecteurs comme <a href=\"cern\">ATLAS</a> enregistrent ce qui en sort.",
  "q14": "Quels pays et institutions participent à ATLAS ?",
  "a14": "La collaboration ATLAS réunit des milliers de scientifiques d'environ 180 institutions dans une quarantaine de pays. Le Brésil en fait partie, et l'UFJF, à travers le NIPSCERN, est l'une des institutions participantes. Nos contributions sont détaillées sur la <a href=\"cern\">page CERN & ATLAS</a>.",
  "q15": "Le CERN a-t-il ouvert un portail ou divisé une singularité ?",
  "a15": "Non. Le LHC fait entrer en collision des protons, ce que les rayons cosmiques font en permanence dans l'atmosphère terrestre à des énergies encore plus élevées, et aucun portail, dimension ou singularité n'est en jeu. Ce que les collisions produisent réellement est bien plus intéressant : des mesures précises des particules et des forces qui composent l'univers. Voyez <a href=\"cern\">ce qui se passe vraiment dans ATLAS</a>.",
  "q16": "Quelles sont les 17 particules du Modèle Standard ?",
  "a16": "Le Modèle Standard décrit la matière avec 17 particules fondamentales : six quarks, six leptons (dont l'électron et les neutrinos), quatre bosons médiateurs (photon, gluon, W et Z) et le boson de Higgs, confirmé au CERN en 2012. Un schéma complet figure sur notre <a href=\"cern\">page CERN & ATLAS</a>.",
  "q17": "Qu'est-ce que le CERN Courier ?",
  "a17": "Le CERN Courier est la revue internationale de la physique des hautes énergies, publiée depuis 1959. Le NIPSCERN tient une <a href=\"publications/courier\">collection numérique d'éditions</a> de 2013 à aujourd'hui, aux côtés de nos propres <a href=\"publications\">publications scientifiques</a>."
},
"no": {
  "hero": {"label": "Spørsmål og Svar", "title": "De store spørsmålene, besvart",
    "subtitle": "Det folk spør om CERN, ATLAS-eksperimentet og NIPSCERN-prosjektene, forklart enkelt av laboratoriet som lever dette arbeidet hver dag."},
  "cat_lab": "Laboratoriet", "cat_projects": "Våre Prosjekter", "cat_cern": "CERN & ATLAS",
  "q1": "Hva er NIPSCERN?",
  "a1": "NIPSCERN (Núcleo de Instrumentação e Processamento de Sinais, Senter for Instrumentering og Signalbehandling) er et forsknings- og utviklingslaboratorium ved det føderale universitetet i Juiz de Fora (UFJF) i Brasil. Laboratoriet utvikler elektronisk instrumentering, signalbehandlingsmetoder og prosessorer for høyenergifysikk, i direkte samarbeid med <a href=\"cern\">ATLAS-eksperimentet ved CERN</a>. Møt <a href=\"about\">teamet og oppdraget</a>.",
  "q2": "Hvordan samarbeider et brasiliansk laboratorium med CERN?",
  "a2": "NIPSCERN bidrar til drift og kalibrering av TileCal, det hadroniske kalorimeteret i ATLAS-detektoren, utvikler digitale metoder for signalrekonstruksjon brukt i hendelsesutvelgelse, og bygger programvare som <a href=\"projects/cgv\">CGVWeb</a>, som kjører på storskjermen i ATLAS-kontrollrommet i Genève. Medlemmer av laboratoriet arbeider både ved UFJF og ved CERN; hele historien finnes på vår <a href=\"cern\">CERN & ATLAS-side</a>.",
  "q3": "Hvordan kan jeg bli med i NIPSCERN eller foreslå et samarbeid?",
  "a3": "Vi ansetter: laboratoriet søker forskere innen logikk, filosofi, programvareutvikling, ingeniørfag, programmering og design. Bedrifter og institusjoner som vil bygge på arbeidet vårt er velkomne: <a href=\"https://github.com/nipscernlab/nipscernweb/blob/main/LICENSE.md\" target=\"_blank\" rel=\"noopener\">lisensen</a> vår er åpen for samarbeid. Skriv til contact@nipscern.com eller møt oss via <a href=\"about\">Om oss-siden</a>.",
  "q4": "Hva er SAPHO?",
  "a4": "<a href=\"projects/sapho\">SAPHO</a> er en skalerbar maskinvarearkitektur og verktøykjede for å lage prosessorer: beskriv en algoritme i noen få linjer C±, og SAPHO genererer en soft-core-prosessor skreddersydd for å kjøre akkurat den algoritmen på en FPGA. Plattformen er summen av delene (SAPHO = <a href=\"projects/aurora\">AURORA</a> + <a href=\"projects/yanc\">YANC</a>) og inkluderer POLARIS, YAWT og PRISM.",
  "q5": "Hva er AURORA?",
  "a5": "<a href=\"projects/aurora\">AURORA</a> er den offisielle skrivebords-IDE-en for SAPHO-plattformen: skriv algoritmen, kompiler, simuler og inspiser den genererte prosessoren i ett vindu. Aurora Intelligence legger til en KI-assistent som styrer IDE-en gjennom dens egne verktøy.",
  "q6": "Hva er YANC?",
  "a6": "<a href=\"projects/yanc\">YANC</a> er kompilatorverktøykjeden bak SAPHO-økosystemet, med cmmcomp (C±-kompilatoren) og asmcomp (assembly-kompilatoren). Den er skrevet i C med Flex, Bison og GCC.",
  "q7": "Hva er CGVWeb?",
  "a7": "<a href=\"projects/cgv\">CGVWeb</a> viser ekte kollisjonshendelser fra ATLAS-kalorimetrene i 3D, i hvilken som helst nettleser, uten installasjon. Bygget med Rust/WebAssembly og Three.js, og kjører på storskjermen i ATLAS-kontrollrommet ved CERN. <a href=\"projects/cgvweb/\">Åpne applikasjonen</a> eller les den <a href=\"library/cgvweb/twiki/\">tekniske dokumentasjonen</a>.",
  "q8": "Hva er POLARIS?",
  "a8": "<a href=\"projects/polaris\">POLARIS</a> er en moderne grafisk IDE for SAPHO-økosystemet, på tvers av plattformer, bygget med Tauri og Rust. Den integrerer Monaco-editoren, RTL-viseren PRISM og bølgesporeren YAWT.",
  "q9": "Hva er CERN, og hva betyr navnet?",
  "a9": "CERN er verdens største partikkelfysikklaboratorium. Navnet kommer fra det franske <em>Conseil Européen pour la Recherche Nucléaire</em>, det midlertidige rådet opprettet i 1952 for å planlegge laboratoriet; organisasjonen det grunnla beholdt forkortelsen. Vår <a href=\"cern\">CERN & ATLAS-side</a> forteller historien i dybden.",
  "q10": "Hvor ligger CERN?",
  "a10": "CERN ligger på grensen mellom Sveits og Frankrike, like utenfor Genève, med hovedcampus i Meyrin. Akseleratorene går under bakken i begge land, inkludert ringen der <a href=\"cern\">teamet arbeider med ATLAS-eksperimentet</a>.",
  "q11": "Når ble CERN grunnlagt, og av hvem?",
  "a11": "CERN ble grunnlagt 29. september 1954 av tolv europeiske land som gjenoppbygde det vitenskapelige samarbeidet etter krigen. I dag har det over tjue medlemsland, og forskere fra alle kontinenter, inkludert Brasil, deltar i eksperimentene.",
  "q12": "Hva er ATLAS-eksperimentet?",
  "a12": "ATLAS er den største allbruksdetektoren ved Large Hadron Collider: 46 meter lang, 25 meter høy, rundt 7 000 tonn, 100 meter under bakken. I 2012 kunngjorde ATLAS og CMS oppdagelsen av Higgs-bosonet. NIPSCERN bidrar til TileCal-kalorimeteret; se <a href=\"cern\">hvordan</a>.",
  "q13": "Hvor er LHC, og hvordan virker den?",
  "a13": "Large Hadron Collider er en 27 kilometer lang ring omtrent 100 meter under den fransk-sveitsiske grensen. Superledende magneter styrer to protonstråler nær lysets hastighet inn i frontkollisjoner, opptil 40 millioner ganger i sekundet, og gjenskaper forhold nær det tidlige universet. Detektorer som <a href=\"cern\">ATLAS</a> registrerer det som kommer ut.",
  "q14": "Hvilke land og institusjoner deltar i ATLAS?",
  "a14": "ATLAS-samarbeidet samler tusenvis av forskere fra rundt 180 institusjoner i omtrent 40 land. Brasil er blant dem, og UFJF, gjennom NIPSCERN, er en av institusjonene som deltar. Bidragene våre er beskrevet på <a href=\"cern\">CERN & ATLAS-siden</a>.",
  "q15": "Åpnet CERN en portal eller delte en singularitet?",
  "a15": "Nei. LHC kolliderer protoner, noe kosmisk stråling gjør i jordens atmosfære hele tiden og med enda høyere energi, og ingen portal, dimensjon eller singularitet er involvert. Det kollisjonene faktisk gir er langt mer interessant: presise målinger av partiklene og kreftene som utgjør universet. Se <a href=\"cern\">hva som virkelig skjer inne i ATLAS</a>.",
  "q16": "Hva er de 17 partiklene i Standardmodellen?",
  "a16": "Standardmodellen beskriver materie med 17 fundamentale partikler: seks kvarker, seks leptoner (inkludert elektronet og nøytrinoene), fire kraftbærende bosoner (foton, gluon, W og Z) og Higgs-bosonet, bekreftet ved CERN i 2012. Et fullstendig diagram finnes på vår <a href=\"cern\">CERN & ATLAS-side</a>.",
  "q17": "Hva er CERN Courier?",
  "a17": "CERN Courier er det internasjonale tidsskriftet for høyenergifysikk, utgitt siden 1959. NIPSCERN holder en <a href=\"publications/courier\">digital samling av utgaver</a> fra 2013 til i dag, ved siden av våre egne <a href=\"publications\">vitenskapelige publikasjoner</a>."
}
}

# As strings en (perguntas e respostas) vem do proprio qa.html, fonte unica
src = open('qa.html', encoding='utf-8').read()
pairs = re.findall(r'data-i18n="qa\.(q\d+)">([^<]+)</span></summary>\s*<div class="qa-answer" data-i18n-html="qa\.(a\d+)">(.*?)</div>', src, re.S)
for num, q, anum, a in pairs:
    QA["en"][num] = q.replace('&amp;', '&')
    QA["en"][anum] = re.sub(r'\s+', ' ', a).strip()

d = json.load(open('data/i18n.json', encoding='utf-8-sig'))
for lang in ['en', 'pt', 'fr', 'no']:
    d[lang]['qa'] = QA[lang]
    d[lang].setdefault('footer', {})['qa'] = 'Q&A'

with io.open('data/i18n.json', 'w', encoding='utf-8', newline='\n') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
    f.write('\n')
print('ok: %d pares extraidos do qa.html; qa por idioma:' % len(pairs),
      {l: len(d[l]['qa']) for l in ['en', 'pt', 'fr', 'no']})
