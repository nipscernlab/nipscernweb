# Arquivos do projeto e backup

Esta página identifica quais arquivos fazem parte do trabalho e como mover ou arquivar um projeto com segurança. O princípio principal é preservar o `.spf` junto com os fontes e recursos aos quais ele se refere.

## O que deve ser preservado

Para copiar ou arquivar um projeto, preserve a pasta completa. Os itens principais são:

| Item | Conteúdo |
|---|---|
| Arquivo `.spf` | Configuração e estrutura do projeto |
| `Software/` | Algoritmos C± |
| `Hardware/` | Verilog gerado e fontes relacionadas |
| `Simulation/` | Arquivos de entrada, saída e testes do processador |
| Testbenches | Arquivos Verilog ou Python usados na simulação |
| `testbench/` | Seleção de sinais e layouts de ondas |
| `.inv` | Filtro visual opcional da visualização **Pastas** |

Os arquivos em `Hardware` podem ser regenerados em muitos fluxos, mas preservá-los junto com o projeto facilita comparação, reprodução e diagnóstico. Os fontes C±, módulos adicionados manualmente e testbenches devem sempre ser tratados como dados essenciais.

## Mover um projeto

1. Feche o projeto na AURORA.
2. Copie a pasta completa.
3. Abra o `.spf` na nova localização.
4. Verifique arquivos importados.
5. Confirme Top Level e Testbench Top.

Arquivos importados de fora da pasta continuam apontando para o caminho original.

Depois da cópia, execute uma validação Verilog ou abra os arquivos principais. Isso confirma que o projeto não depende de um caminho que ficou na máquina anterior.

## O que não editar manualmente

Durante o uso normal, evite alterar diretamente:

- O arquivo `.spf`.
- Arquivos de estado dentro de `testbench/`.
- Dados internos da IA no perfil do Windows.
- Arquivos temporários da toolchain.

Use a interface para mudar configurações e referências. O `.inv` é a exceção: ele pode ser criado ou ajustado manualmente quando você quiser filtrar a visualização **Pastas**, pois não altera o projeto nem o Git.

Uma edição manual incorreta pode deixar o arquivo sintaticamente válido, mas inconsistente com as pastas reais. Se precisar investigar o formato, trabalhe sobre uma cópia do projeto.

## Fazer backup

Use o comando de backup da AURORA antes de alterações estruturais. Para projetos importantes, mantenha também uma cópia externa ou repositório de controle de versão.

## Arquivo `.inv`

O `.inv` fica na raiz do projeto e controla apenas a visualização **Pastas**. Ele aceita comentários, linhas vazias, negação com `!`, padrões de diretório, globs e `**`. A comparação é feita sem diferenciar maiúsculas de minúsculas.

Não use `.inv` para segurança, empacotamento ou Git. Para controle de versão, use `.gitignore` e revise o painel de Source Control.

## Layouts de ondas

O diretório `testbench/` guarda um JSON por Testbench Top. Esse estado registra sinais selecionados, inicialização da **Configuração de Ondas**, layouts `.gtkw` e layouts Surfer (`.surf.ron` ou `.sucl`) associados ao testbench.

Layouts `.gtkw` organizam sinais para GTKWave. Layouts `.surf.ron` e `.sucl` configuram o Surfer. Eles não substituem o arquivo de onda (`.vcd` ou `.fst`), que continua sendo a fonte dos valores simulados.

Nunca dependa apenas da pasta de arquivos temporários ou da lista de projetos recentes.

## Verificar um backup

1. Copie o backup para uma pasta de teste.
2. Abra o `.spf` dessa cópia.
3. Confira processadores, Top Level e Testbench Top.
4. Abra os fontes principais.
5. Execute a validação apropriada.

Um backup só deve ser considerado utilizável depois dessa verificação. Evite testar diretamente sobre a única cópia preservada.

