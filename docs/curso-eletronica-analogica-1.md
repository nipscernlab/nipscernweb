# Eletrônica Analógica I na library: o que se achou

Estado em 29/09/2026: publicado, com a versão 1 das três partes da apostila do
Prof. Victor Mendes Ribeiro. Site no commit `eee115e`; PDFs no nipscern-assets
pelo PR #2. Endereço: https://www.nipscern.com/library/courses/eletronica-analogica-1/

Este arquivo registra o que apareceu ao montar o curso: o que vale levar ao
professor, o que ainda falta saber, e o que se descobriu na ferramenta e no
repositório. Como o curso funciona e como entra um PDF novo está em
[tools/courses/README.md](../tools/courses/README.md), na seção "Curso em
apostila".

---

## Para o professor Victor, na apostila

**A seção 1.9 diz três e lista quatro.** Na parte 1, página 28: "Três tipos de
análise cobrem quase tudo o que faremos:", e a tabela logo abaixo tem quatro
diretivas, `.tran`, `.ac`, `.op` e `.dc`. A página do site cita as quatro sem
dizer quantas são.

**Três exercícios não têm resposta no gabarito.** São os três de simulação no
LTspice:

| Exercício | Onde | Começa com |
|---|---|---|
| 2.14 | parte 1, p. 59 | "Monte no LTspice o circuito da prática de laboratório..." |
| 3.16 | parte 2, p. 31 | "Para os exercícios 3.1, 3.2 e 3.5, simule o circuito do modelo..." |
| 3.17 | parte 2, p. 31 | "Monte uma fonte completa, com transformador..." |

O gabarito abre dizendo "Respostas dos exercícios propostos ao final de cada
capítulo". Se a falta é de propósito, por serem abertos, uma frase no gabarito
resolve. A página de cada parte mostra os dois números, por exemplo "14
exercícios · 13 com resposta", e se ajusta sozinha quando o gabarito mudar.

**O Sedra é citado 18 vezes e não há bibliografia.** Os exemplos marcados
"(Sedra, Ex. N)" são 9 na parte 1, 6 na parte 2 e 3 na parte 3, e a apostila
não diz de que livro nem de que edição. Deduzo que é o Microelectronic
Circuits, de Adel S. Sedra e Kenneth C. Smith, mas é dedução, e o site não cita
o livro por isso. Há também uma pergunta sobre a numeração: os exemplos de
diodo vêm como Ex. 4.x (4.1, 4.2, 4.4, 4.5, 4.7, 4.8) e os de TBJ como Ex. 5.x
(5.10, 5.11, 5.17). Não conferi contra o livro; de memória, nas edições em que
o capítulo 4 é o de diodos, o de TBJ é o 6, e vale ver se as citações vêm de
edições diferentes. Uma linha de referência no começo de cada parte fecharia as
duas coisas.

**A apostila não declara termos de uso.** Não há licença nem nota de direitos
nas três partes. O site a publica porque o Chrysthofer pediu, mas o rodapé do
site fala da Licença NIPS-CERN, e o README do nipscern-assets diz que o material
de autor pertence ao autor. Convém ter do professor, por escrito, a autorização
e os termos, e o melhor lugar é o próprio PDF, no verso da capa.

**A apostila pede correções e não diz para onde mandá-las.** Os agradecimentos
terminam com "Agradeço desde já a quem contribuir com correções e sugestões",
sem endereço. A página do site também não dá um.

**O que a página lê do PDF, para a apostila continuar se atualizando sozinha.**
A ferramenta tira do PDF o sumário, a abertura dos capítulos, as práticas, a
contagem de exercícios, a data e as figuras dos cartões. Para isso depende de
alguns hábitos que a versão 1 tem:

- os marcadores do hyperref: a parte no primeiro nível, com o numeral romano; os
  capítulos no segundo; as seções no terceiro; o gabarito no segundo;
- a caixa de cada prática com "Prática N:" e "OBJETIVOS";
- o número de cada exercício sozinho na linha, no capítulo e no gabarito;
- as legendas "Figura 1.4.", "Figura 3.7." e "Figura 4.3.", das figuras que vão
  nos cartões das partes;
- as quatro frases citadas na página do curso, palavra por palavra;
- o nome dos arquivos, `Apostila_EletronicaAnalogicaI_ParteN.pdf`.

Se algum deles mudar, a rodada da ferramenta para e diz o que não achou. Nada
disso restringe o professor: basta avisar quem publica.

## O que ainda falta saber

- **Semestre, horário e sala** da disciplina. A apostila não diz, e a página
  não mostra; o Limiar mostra os dele.
- **"Ao lado do Limiar".** A coletânea continuou em lista, um curso embaixo do
  outro, como já era. Se o pedido era lado a lado, é uma mudança do layout da
  coletânea.
- **A autorização e os termos de uso**, como acima.

## Na ferramenta e no repositório do site

**`--course` apagava o outro curso.** Com `--course`, a ferramenta gerava um
curso só e reescrevia a coletânea e o sitemap com ele. Com um curso no catálogo
isso não aparecia; com dois, apagaria o outro dos dois arquivos. Corrigido no
commit `eee115e`: com `--course`, a coletânea e o sitemap ficam como estavam, e
a ferramenta avisa.

**O `#page=` não vale em todo leitor de PDF.** O sumário e os outros links
para um lugar da apostila iam direto ao arquivo com `#page=N`. O leitor do
Chrome obedece; a extensão do Adobe Acrobat no Chrome abre na primeira página,
como apontou o Chrysthofer em 30/09/2026, e o celular baixa o arquivo e perde a
página. Agora esses links passam pelo leitor de PDF do site, `pdf-viewer.html`,
com a página e o ponto do marcador (`#page=N&view=FitH,topo`), e o PDF abre já
no título da seção. O leitor passou a desenhar só as páginas perto da tela. Antes
desenhava todas: na parte 1, a 200% numa tela comum, são 70 canvas de
1190 × 1683 pixels, uns 560 MB pela conta de 4 bytes por pixel. É conta, não
medida, e o Safari do iPhone limita a memória de canvas de uma página, então as
últimas páginas, onde fica o gabarito, arriscavam sair em branco lá; isso é
dedução, não foi testado num iPhone. Com a mudança, o teste contou no máximo 4
páginas desenhadas ao mesmo tempo no computador e 11 no celular, rolando a
parte 1 inteira.

**O atalho levava o slug no título.** A página de `/library/<curso>/` tinha
como título `slug.capitalize()`, o que dava "Eletronica-analogica-1". Agora é o
nome do curso; o do Limiar continua "Limiar".

**O gerador de ícones só vê página versionada.** `tools/build-icon-subsets.js`
lista as páginas por `git ls-files`, e uma página nova, ainda fora do índice,
fica fora da conta. O ícone que só ela usa não entra no subconjunto e aparece
como um quadrado sólido. No commit o hook acerta, porque as páginas já estão no
índice; para conferir antes, `git add -N` nas páginas novas e rodar o gerador.
Aconteceu aqui com `flask`, `wave-sine` e `clock-counter-clockwise`.

**Três geradores deixam arquivos "modificados" sem mudança.**
`tools/build-min.js` reescreve todos os `.min.js`; `tools/build-data-slices.js`
reescreve `data/home-news.json` e `data/collab-network.json`; e
`tools/courses/build.py` reescreve `assets/fonts/katex-0.18.9/LICENSE` e o
`sitemap.xml`. Todos gravam com LF sobre um working copy com CRLF
(`core.autocrlf`), e o `git status` mostra os arquivos como modificados com
`git diff --ignore-cr-at-eol` vazio. Não chega a commit nenhum, porque o git
normaliza, mas confunde quem olha o status. A correção é comparar o conteúdo
normalizado antes de gravar, como `Escrita.grava` já faz para as páginas.

**Um aviso do pyflakes, antigo.** `tools/courses/build.py:783`, na página do
curso do Limiar: uma f-string sem campo, `f'<div class="cr-actions fade-up">'`.
Não muda nada no resultado.

**As dependências não estavam instaladas nesta máquina.** Faltavam os pacotes
de `tools/courses/requirements.txt` e o `node_modules/katex`; entraram com
`python -m pip install -r tools/courses/requirements.txt` e `npm ci`. As versões
fixadas funcionam no Python 3.14.7.

**A reprodução foi conferida.** Uma rodada sem `--material`, lendo os PDFs do
clone do nipscern-assets, deu os mesmos bytes nos 87 arquivos gerados. As
páginas do Limiar saíram idênticas às publicadas, do commit `d0e29b4` do
redes-neurais. O fluxo de versão nova foi testado com uma parte 2 alterada: ela
virou `-v2`, o `-v1` continuou no lugar, a página e o sitemap pegaram a data
nova; o teste foi desfeito depois. `node tools/test-courses.js` passou em todas
as páginas, no computador e no celular.

## Na leitura do PDF

Para quem mexer em `tools/courses/apostila.py`, com o PyMuPDF 1.27.2.3:

- A opção `TEXT_DEHYPHENATE` deixa escapar palavras partidas no fim da linha
  ("pri- meiro", "inte- grados") e, quando junta, junta também as compostas
  ("passa-baixas"). A ferramenta costura as linhas por conta própria: a forma
  com hífen fica quando aparece inteira em outra linha do PDF, e a palavra se
  junta nos outros casos.
- `cluster_drawings()` devolve a página inteira como um grupo só, porque cada
  página tem um retângulo branco de fundo. É preciso tirar os desenhos maiores
  que meia página antes de agrupar.
- `find_tables()` não acha a tabela da seção 1.1.3, que não tem fios. Por isso
  ela está escrita à mão no `.json`, com o resumo do texto da seção, que avisa
  quando a seção muda.
- Em texto com fórmula, o espaço depois de um símbolo matemático some: "22 kΩe
  33 kΩ", "RL ≫Rth". Nada disso chega às páginas hoje, porque as aberturas e os
  objetivos são prosa, mas pega quem for extrair mais texto.
- O sumário do começo de cada parte repete todos os títulos. Quem procura uma
  seção no texto inteiro acha a linha do sumário antes da seção; por isso a
  busca lê só as páginas da própria seção.

## Links de fora

A página do LTspice na Analog Devices,
https://www.analog.com/en/resources/design-tools-and-calculators/ltspice-simulator.html,
responde 403 a robô, com qualquer agente, inclusive o Edge em modo headless. O
endereço foi conferido por busca em 29/09/2026 e abre no navegador.

## O que parece defeito e não é

Nas capturas de página inteira, as imagens com `loading="lazy"` abaixo da
primeira tela saem em branco: as capas das obras na aula 1 do Limiar, e a
figura da parte 3 na captura de celular. É a captura, que não rola a página; o
teste de navegador, que rola, passa.
