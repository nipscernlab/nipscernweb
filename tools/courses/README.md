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

Os PDFs e os vídeos vão para o nipscern-assets e são servidos em
`https://cdn.nipscern.com/courses/<curso>/`.

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
