# Fluxo completo para projetos Verilog

Este roteiro apresenta a AURORA como ambiente de desenvolvimento Verilog independente do fluxo C±. Ao final, você terá um projeto com fontes RTL, Top Level, testbench, validação, simulação, formas de onda e visualização no PRISM.

```{figure} ../_static/screenshots/aurora-alu32-editor.png
:alt: Projeto ALU32 aberto na AURORA com o arquivo alu32.v no editor.
:width: 100%
:align: center

O projeto `ALU32` aberto em `alu32.v`, com os módulos RTL e os testbenches registrados na árvore **Arquivos**.
```

## 1. Criar ou abrir o projeto

1. Clique em **Novo Projeto**.
2. Informe um nome para o projeto.
3. Escolha uma pasta com permissão de escrita.
4. Confirme a criação.

A AURORA cria a pasta do projeto e um arquivo `.spf`, usado para registrar os arquivos e as seleções do fluxo. Não é necessário criar um processador no **Hub de Processadores** para trabalhar com Verilog.

## 2. Adicionar os módulos RTL

Crie os arquivos no editor ou importe módulos existentes. Você também pode arrastar e soltar um ou vários arquivos sobre a árvore **Arquivos**. Esse recurso aceita módulos Verilog e SystemVerilog (`.v`, `.sv` e `.vh`) e testbenches cocotb (`.py`).

A AURORA classifica o conteúdo importado como fonte sintetizável ou testbench. Confirme a classificação na árvore e mantenha como fontes sintetizáveis todos os módulos que participam do circuito, inclusive os módulos instanciados pelo módulo principal.

Para um primeiro teste, você pode usar o circuito `porta_and.v` disponível na {doc}`../exemplos/galeria-testbenches`.

## 3. Definir o Top Level

Na árvore **Arquivos**, localize o arquivo que contém o módulo principal. Clique nele com o botão direito do mouse e selecione **Definir como Top Level**.

O Top Level é a raiz usada para:

- Validar a elaboração do projeto.
- Gerar a visualização **Hierarquia** da árvore.
- Associar o circuito aos testbenches Verilog ou Python/cocotb.
- Gerar a visualização do PRISM.

A bandeira ao lado do arquivo e o nome exibido na barra de status confirmam a seleção. Se o módulo principal instancia outros módulos, todos eles também devem estar adicionados como fontes sintetizáveis.

## 4. Adicionar o testbench

Use uma das alternativas:

- Um testbench Verilog `.v`, que instancia o circuito, gera estímulos e pode incluir as verificações no próprio HDL.
- Um testbench Python `.py` com cocotb, que controla o Top Level pelo simulador.

Adicione o arquivo à árvore, clique nele com o botão direito do mouse e escolha **Marcar como Testbench**. Essa ação define o Testbench Top usado na simulação. O testbench fica separado das fontes sintetizáveis.

## 5. Validar o Verilog

1. Salve os arquivos.
2. Clique em **Compilar Verilog**.
3. Leia o terminal **Verilog**.
4. Corrija a primeira mensagem de erro, se houver.

A validação confirma sintaxe, módulos e conexões necessárias para elaborar o Top Level. Ela não substitui o testbench: um circuito pode ser elaborado corretamente e ainda produzir resultados funcionais incorretos.

## 6. Simular

```{figure} ../_static/screenshots/aurora-toolbar-simulation.png
:alt: Trecho da barra superior com PRISM, simuladores, análise de forma de onda, execução rápida, cancelamento e configuração de ondas.
:width: 80%
:align: center

Na barra superior, escolha o simulador e use **Execução rápida** ou **Analisar Verilog (forma de onda)** conforme o resultado desejado.
```

1. Escolha Icarus Verilog ou Verilator. A **Execução rápida** com testbench Verilog exige Verilator; testbenches cocotb podem usar o simulador selecionado.
2. Confirme o Top Level e o Testbench Top na barra de status.
3. Use **Execução rápida** para executar o teste sem abrir formas de onda.
4. Use **Analisar Verilog (forma de onda)** para executar o Testbench Top, gerar a saída temporal e abrir o viewer selecionado.
5. Confirme no terminal se o testbench terminou e se todas as verificações passaram.

Icarus Verilog é uma boa escolha para a primeira execução e para observar sinais internos. Verilator é indicado quando a simulação exige mais desempenho e o projeto utiliza construções compatíveis.

## 7. Analisar formas de onda

Abra **Configuração de Ondas** para escolher os sinais e execute **Analisar Verilog (forma de onda)**. O viewer selecionado abre o VCD ou FST produzido pela simulação.

Use a forma de onda para conferir clock, reset, entradas, saídas e estados internos relevantes. A passagem do testbench continua sendo o critério funcional; a forma de onda ajuda a explicar por que um caso passou ou falhou.

## 8. Visualizar no PRISM

Com o Top Level definido e o Verilog válido, clique em **Abrir PRISM**. Use a visualização para conferir a hierarquia e as conexões estruturais do circuito.

O PRISM oferece o modo **Esquemático**, para inspecionar a estrutura, e o modo **Simular**, para alterar entradas lógicas e observar saídas diretamente. Essa interação não substitui um testbench nem a análise temporal no viewer de ondas.

## Resultado esperado

O fluxo Verilog está concluído quando:

- Todos os módulos necessários estão registrados como fontes sintetizáveis.
- O Top Level e o Testbench Top aparecem corretamente na barra de status.
- A validação Verilog termina sem erro.
- O testbench Verilog ou cocotb conclui suas verificações.
- A análise de forma de onda abre os sinais esperados, quando solicitada.
- O PRISM apresenta a raiz correta do circuito.

Para exemplos completos em `.v` e cocotb, consulte {doc}`../exemplos/galeria-testbenches`. Para detalhes de classificação dos arquivos, consulte {doc}`../uso/arquivos-verilog`.
