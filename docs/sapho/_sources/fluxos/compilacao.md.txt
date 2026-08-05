# Compilar Verilog ou gerar um processador SAPHO

Esta página explica as etapas de compilação compartilhadas pelos dois fluxos principais. Em um projeto Verilog, a validação verifica diretamente o RTL selecionado. Em um processador SAPHO, a geração C± produz primeiro o hardware Verilog que será usado nas etapas seguintes.

## Antes de começar

Confirme qual fluxo está executando:

- No {doc}`verilog`, não é necessário possuir um processador ou arquivo `.cmm`.
- No {doc}`processador-sapho`, o processador e o arquivo `.cmm` ativo determinam o hardware que será regenerado.

Confirme:

1. O projeto está aberto.
2. Todos os arquivos modificados foram salvos.
3. O processador correto está ativo, se houver C±.
4. O Top Level está definido para validar Verilog.

Salvar os arquivos é indispensável porque os compiladores leem o conteúdo no disco. Confira também a barra de status para garantir que o processador e o Top Level pertencem ao fluxo que você deseja executar.

## Gerar um processador C±

1. Abra o arquivo `.cmm` do processador.
2. Clique em **C±**.
3. Acompanhe os terminais de C± e Assembly.
4. Aguarde a conclusão antes de iniciar outra etapa.

O resultado esperado é a criação ou atualização dos arquivos na pasta `Hardware` do processador. Os terminais de C± e Assembly devem concluir sem erro. A existência de um arquivo antigo nessa pasta, por si só, não prova que a geração atual foi bem-sucedida.

:::{tip}
Se você alterou apenas o algoritmo C±, não precisa executar manualmente cada compilador. O botão **C±** executa a sequência necessária.
:::

## Validar o projeto Verilog

1. Selecione todas as fontes sintetizáveis necessárias.
2. Defina o **Top Level**.
3. Clique em **Verilog**.
4. Leia o terminal Verilog.

A validação está correta quando termina sem erros de sintaxe, módulos ausentes ou módulos duplicados. Essa etapa não executa o comportamento do circuito; ela confirma que o Top Level e suas dependências formam um conjunto coerente para as etapas posteriores.

Se a validação falhar, corrija a primeira mensagem de erro e execute **Verilog** novamente. Um único módulo ausente pode produzir várias mensagens secundárias.

## Ações que recompilam dependências

As ações abaixo preparam automaticamente o que precisam:

| Ação | Resultado |
|---|---|
| **C±** | Atualiza o hardware do processador ativo |
| **Verilog** | Valida o Top Level e suas dependências |
| **Analisar Verilog (forma de onda)** | Compila e executa a simulação, depois abre as formas de onda. |
| **Execução rápida** | Compila e simula sem abrir o viewer de ondas |
| **PRISM** | Valida o RTL e gera a visualização |

Projetos somente Verilog também são suportados; não é obrigatório criar um processador C±.

Executar uma ação mais completa não elimina a necessidade de ler os terminais. Por exemplo, **Analisar Verilog (forma de onda)** pode recompilar dependências, mas ainda falhar antes da simulação se o Verilog estiver inválido.

## Interromper uma execução

Clique em **Cancelar**. A interrupção pode levar alguns segundos enquanto processos auxiliares são encerrados.

Não feche nem exclua arquivos temporários durante esse período.

Depois que o cancelamento terminar, revise a última mensagem do terminal. Se uma nova execução permanecer bloqueada, feche a ferramenta externa que ainda estiver aberta e consulte o diagnóstico do manual.

## Erros comuns

**Botão C± desabilitado**
: Abra o `.cmm` do processador desejado.

**Top Level não encontrado**
: Confirme o módulo principal e inclua todas as dependências Verilog.

**Módulo duplicado**
: Remova da seleção uma das cópias que declaram o mesmo módulo.

**Arquivo gerado não mudou**
: Salve o `.cmm`, confirme o processador ativo e execute C± novamente.

**Execução não termina**
: Use **Cancelar** e aguarde a limpeza. Se persistir, consulte {doc}`../referencia/diagnostico`.

