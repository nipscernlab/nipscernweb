# Os cursos da library

`library/courses/` inteira sai de `tools/courses/build.py`. Nenhuma página ali se
escreve à mão: a ferramenta lê o repositório do curso num commit, gera as páginas,
e apaga de `library/courses/` o que não escreveu naquela rodada.

| Endereço | O que é |
|---|---|
| `/library/courses/` | a coletânea, um cartão por curso |
| `/library/courses/<curso>/` | a página do curso |
| `/library/courses/<curso>/class-NN/` | a página da aula |
| `/library/courses/<curso>/class-NN/slides/` | o deck, com vídeos e anotações |
| `/library/courses/<curso>/class-NN/study-guide/` | o roteiro, com as equações |
| `/library/courses/<curso>/class-NN/code/` | o código da aula, com destaque e download |
| `/library/courses/<curso>/part-N/` | a página de uma parte, no curso que chega como apostila |

Os PDFs e os vídeos vão para o nipscern-assets e são servidos em
`https://cdn.nipscern.com/courses/<curso>/`. O endereço curto `/library/<curso>/`,
o que se digita de memória, é uma página de redirecionamento para
`/library/courses/<curso>/`, gravada pela mesma ferramenta; por isso um curso não
pode se chamar `sapho` nem `cgvweb`, que são rotas de Worker em `/library/`. A
navegação do site tem o item "Cursos", que acende em toda página abaixo de
`/library/courses/`.

No fim de cada rodada, a ferramenta abre as páginas que gerou e confere cada
`href`, `src`, `data-src`, `data-video` e pôster: o que é do site tem de existir, o
que é do CDN tem de ter sido publicado na rodada, e a âncora tem de existir no
destino. Endereço quebrado faz a rodada falhar.

## Rodar

Uma vez por máquina:

```bash
npm install                                      # traz o KaTeX
python -m pip install -r tools/courses/requirements.txt
```

E a cada atualização, com o clone do curso e o do nipscern-assets ao lado deste:

```bash
python tools/courses/build.py --assets ../nipscern-assets
```

A ferramenta roda `git fetch` no clone do curso e lê o `origin/main` por
`git archive`, sem tocar no working tree nem no branch de lá. `--no-fetch` pula o
fetch; `--ref <commit>` lê outro commit; `--source <pasta>` aponta outro clone.
`--course <curso>` gera só um curso e deixa a coletânea e o sitemap como estavam,
porque os dois listam todos os cursos; para atualizá-los, rode sem `--course`.

Rodar duas vezes sobre o mesmo commit dá os mesmos bytes. O que ela baixa da rede,
os PDFs abertos das obras e o oEmbed e as miniaturas do YouTube, fica em
`tools/courses/.cache/`, fora do git.

## Acrescentar uma aula

1. Em `tools/courses/<curso>.json`, uma entrada nova em `aulas`: número, `slug`
   (`class-03`), a pasta no repositório do curso, a data, o `quando` e o `onde`, o
   PDF dos slides e, se houver, `codigo_retido` com o que não pode sair ainda.
2. As obras citadas no README e no roteiro da aula vão em `obras`, uma vez por
   curso, e a aula lista os slugs delas. Cada uma leva o link oficial, conferido
   abrindo, e `pdf_aberto` só quando o PDF é de acesso aberto: é dele que sai a
   capa. As fontes que não são obra, verbetes e páginas, vão em `outras_fontes`.
3. `python tools/courses/build.py --assets ../nipscern-assets`.
4. Os arquivos novos do CDN entram no nipscern-assets por pull request; o
   manifesto `<curso>.cdn.json` e as páginas entram aqui, em outro.

Tema, prática, entrega, estudo da semana e créditos saem do README da aula; os
vídeos do estudo, do oEmbed do YouTube, e a ferramenta avisa quando o título ou o
canal não batem com o que o README cita. O deck sai de `slides/project/`, com o
mapa de `/_blob/` lido do `ARQUIVOS` e do `VIDEOS` do `slides.py` da aula, pela
árvore sintática, sem executar o arquivo.

## Curso em apostila

Eletrônica Analógica I, a disciplina CEL114 / CE5114 do professor Victor Mendes
Ribeiro, não tem repositório: chega como apostila em PDF, feita em LaTeX, em
partes. O `.json` dela diz `"formato": "apostila"`, e a ferramenta usa outra
classe, `CursoDeApostila`, com as mesmas peças de página.

A fonte de cada parte é o PDF que já está no CDN. O manifesto
`<curso>.cdn.json` diz onde ele está e qual o resumo dele; a ferramenta lê do
clone do nipscern-assets, se ele foi dado, ou baixa de `cdn.nipscern.com`, e
confere o resumo. Por isso uma rodada comum refaz as páginas do curso em
qualquer máquina, sem pasta nenhuma ao lado.

PDF novo, de uma parte ou de todas, entra assim:

```bash
python tools/courses/build.py --assets ../nipscern-assets \
    --material eletronica-analogica-1=C:/caminho/apostila.zip
```

`--material` aceita um `.zip`, uma pasta ou um `.pdf` só, e casa cada arquivo
com a parte pelo nome que está em `partes[].arquivo`; arquivo que não é de parte
nenhuma para a rodada. A parte que mudou ganha `-v2`, `-v3` no CDN, a anterior
continua onde estava, e a página dela se refaz a partir do PDF novo.

O que a página diz de cada parte sai do PDF, e não do `.json`
(`tools/courses/apostila.py`):

- o título da parte, os capítulos e o sumário, dos marcadores que o hyperref
  grava, com o número de página impresso, que é o rótulo da página no PDF;
- a abertura de cada capítulo, os parágrafos entre o título e a primeira seção;
- cada prática de laboratório, com o texto embaixo de OBJETIVOS na caixa dela;
- quantos exercícios cada capítulo propõe e quantos o gabarito responde (na
  versão 1, os de simulação do fim dos capítulos 2 e 3 não têm resposta);
- a data, dos metadados, e o número de páginas;
- a capa do curso, que é a capa da parte 1 cortada em 4:5; o fundo do hero, que
  é a faixa colorida dessa capa desfocada; a capa de cada parte; e a figura do
  cartão de cada parte, recortada da página pela legenda (`partes[].figura`).

O `.json` guarda só o que não dá para ler assim: a apresentação do curso, a
tabela de modelos da seção 1.1.3, que no PDF não tem fios e não se lê como
tabela, e as frases citadas em "Como estudar" e "A apostila". Cada citação tem
de estar no PDF palavra por palavra, ou a rodada falha; a tabela tem o resumo do
texto da seção em `resumo_da_leitura`, e a rodada avisa quando a seção muda.
Quando o desenho da apostila mudar (a caixa da prática sem OBJETIVOS, o
gabarito sem o número sozinho na linha, uma legenda renumerada), a leitura para
com erro e diz o que não achou.

A cor do curso vem do `.json`, em `cor`, e a ferramenta a põe no estilo do
`<body>` e do cartão na coletânea; o Limiar fica com a de fábrica do
`courses.css`.

## Quando o site publica diferente do curso

`correcoes`, na entrada da aula, troca um trecho de um arquivo do curso (o HTML de
um slide, o roteiro) antes de qualquer leitura; `correcoes_pdf` troca linhas de
texto numa página do PDF dos slides, no mesmo lugar e com a fonte do
`infra/fontes/` que o slide usa. Cada trecho tem de aparecer exatamente uma vez:
quando o repositório do curso for corrigido, a rodada falha por não achar o
trecho, e a entrada sai do `.json`. A primeira é a do slide 8 da aula 1, que dizia
"cada célula do TileCal" e agora diz o que o artigo citado fez, em sinais
simulados de calorímetro.

## O que nunca sai

- `mensagens/` e `__pycache__`, e todo arquivo de `codigo_retido`.
- Link para o repositório do curso, que é privado, e para `claude.ai`: um link
  relativo do Markdown vira o endereço do que o site publicou daquele arquivo, ou
  sai deixando o texto. A ferramenta para com erro se algum desses endereços
  sobrar numa página.
- Script ou atributo de evento vindo do deck: a ferramenta recusa o deck.

## Nomes que não mudam

Imagem escrita em `library/courses/<curso>/media/` leva no nome o resumo do
próprio conteúdo, e conteúdo novo é nome novo; por isso nenhuma delas precisa de
`?v=`. No CDN, o manifesto guarda o resumo de cada origem: conteúdo igual reusa o
nome publicado, conteúdo diferente ganha `-v2`, `-v3`, como manda o README do
nipscern-assets, e a ferramenta se recusa a sobrescrever um arquivo que já está lá.

## As fontes dos slides

IBM Plex Sans 400 e 600 e Source Serif 4 600 vêm do `infra/fontes/` do Limiar,
convertidas para woff2 sem subconjunto. A Source Serif 4 400, que os slides usam
nas tabelas e o `infra/fontes/` não tem, vem da mesma versão 4.005 da Adobe
(release `4.005R` de adobe-fonts/source-serif), de onde a Semibold do curso também
veio, byte a byte. A IBM Plex Mono é a que o site já servia. As três sob a SIL
Open Font License, com os textos em `assets/fonts/OFL-*.txt`.

## A folha de ícones

Todas as páginas de `library/courses/` carregam uma folha só,
`assets/css/icons/library-courses.css`, com a união dos ícones da família. É a
entrada `FAMILIAS` de `tools/build-icon-subsets.js`, e é o que faz uma aula nova
não pedir linha nova na lista do hook.
