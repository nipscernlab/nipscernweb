# Projetos

Um projeto reúne o arquivo de configuração `.spf`, os algoritmos C±, os módulos Verilog, os testbenches e os resultados gerados. Esta página explica como criar, abrir, mover e preservar esse conjunto sem quebrar referências.

## Criar

1. Clique em **Novo Projeto**.
2. Informe um nome.
3. Escolha a pasta de destino.
4. Confirme.

O nome do projeto é usado na pasta e no arquivo `.spf`. Escolha um nome curto, descritivo e sem caracteres que possam ser rejeitados pelo Windows. Depois da confirmação, aguarde a árvore do projeto aparecer antes de criar processadores ou importar arquivos.

```{figure} ../_static/screenshots/aurora-new-project-current.png
:alt: Formulário Criar Novo Projeto com os campos de nome e local do projeto.
:width: 85%
:align: center

Preencha o nome, escolha a pasta de destino em **Procurar** e confirme em **Gerar Projeto**.
```

## Abrir

Clique em **Abrir Projeto** e selecione o arquivo `.spf`. Projetos usados recentemente também aparecem na tela inicial. Ao abrir, a AURORA restaura a estrutura registrada e verifica os caminhos dos arquivos associados.

Se um projeto recente foi movido ou excluído, abra-o novamente pela nova localização. Uma entrada recente não contém uma cópia do projeto; ela é apenas um atalho para o `.spf` existente no disco.

## O que é o arquivo `.spf`

O `.spf` guarda a configuração do projeto, incluindo:

- Processadores.
- Arquivos Verilog e Testbenches.
- Top Level e Testbench Top.
- Caminhos de arquivos importados.

Não edite esse arquivo manualmente durante o uso normal. Para mover um projeto, feche-o na AURORA, copie a pasta completa e abra o `.spf` na nova localização. Depois, confirme se Top Level, Testbench Top e arquivos importados continuam válidos.

## Navegar pela pasta do projeto

Use a visualização **Pastas** para conferir a estrutura real no disco. Ela mostra pastas e arquivos do projeto mesmo quando eles não fazem parte da lista Verilog registrada no `.spf`.

A visualização **Pastas** é útil para:

- Abrir arquivos auxiliares sem sair da AURORA.
- Conferir resultados gerados em `Hardware/`, `Simulation/` e `testbench/`.
- Revelar ou expandir pastas do projeto.
- Ver badges Git junto dos arquivos no disco.

Arquivos ocultos, metadados internos e alguns arquivos de configuração histórica não aparecem nessa view para reduzir ruído.

## Filtrar a visualização Pastas com `.inv`

Crie um arquivo `.inv` na raiz do projeto para esconder arquivos e pastas somente na navegação da AURORA. A sintaxe é inspirada em `.gitignore`: aceita comentários, linhas vazias, negação com `!`, padrões de diretório, `*`, `?`, `**` e comparação sem diferenciar maiúsculas de minúsculas.

Exemplo:

```text
# Esconder resultados locais volumosos.
Simulation/tmp/
*.log

# Manter um relatório visível.
!Simulation/relatorio.log
```

O `.inv` não altera Git, não muda o `.spf` e não impede que um arquivo seja aberto por caminho direto. Ao salvar o `.inv`, a visualização **Pastas** é atualizada.

## Importar arquivos

Você pode usar arquivos dentro ou fora da pasta do projeto.

1. Adicione o arquivo pelo comando de importação ou arraste e solte um ou vários arquivos sobre a árvore **Arquivos**.
2. Confirme se ele é fonte sintetizável ou testbench.
3. Defina Top Level ou Testbench Top quando necessário.

O recurso de arrastar e soltar aceita os formatos suportados pelo fluxo HDL: Verilog e SystemVerilog (`.v`, `.sv` e `.vh`) e testbenches Python/cocotb (`.py`). A AURORA registra os arquivos importados no `.spf`; ela não transforma automaticamente um formato desconhecido em fonte compilável.

Para facilitar backup e compartilhamento, prefira manter as fontes dentro da pasta do projeto.

Arquivos externos permanecem dependentes do caminho original. Se o projeto for enviado para outra máquina sem esses arquivos, a árvore indicará referências ausentes e as etapas de compilação poderão falhar.

## Fechar e reabrir

Use a ação **Fechar Projeto** na árvore. Salve arquivos modificados antes de fechar.

Ao reabrir, confira na barra de status:

- Processador ativo.
- Top Level.
- Testbench Top.
- Simulador selecionado.

Abra também um ou dois arquivos importantes para confirmar que os caminhos foram restaurados. Essa verificação é especialmente importante depois de mover a pasta ou restaurar um backup.

## Backup

Use a ação de backup antes de:

- Renomear ou excluir processadores.
- Importar muitos arquivos.
- Alterar a estrutura Verilog.
- Atualizar a AURORA.

O backup não substitui um sistema de versionamento, mas permite voltar rapidamente a um estado anterior. Identifique a cópia com uma data ou uma descrição da mudança para evitar confundi-la com a versão ativa.

## Renomear ou excluir

Use os comandos da AURORA para renomear ou excluir projetos, processadores e arquivos registrados. Alterar apenas nomes de pastas pelo Explorer pode deixar referências inválidas no `.spf`.

## Versionamento

Para acompanhar alterações ao longo do tempo, mantenha a pasta do projeto em Git. A AURORA pode exibir decorações nas árvores e operar status, diff, stage, commit, branch, stash, pull e push pelo painel de Source Control. Veja {doc}`source-control`.
