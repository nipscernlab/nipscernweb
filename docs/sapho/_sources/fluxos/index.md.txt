# Escolha o fluxo de trabalho

A AURORA atende a dois fluxos principais. Você pode desenvolver um projeto diretamente em Verilog ou gerar um processador dedicado do ecossistema SAPHO a partir de um algoritmo C±, armazenado em arquivo `.cmm`. Os dois caminhos usam o mesmo editor, a mesma estrutura de projeto e as mesmas ferramentas de validação e análise, mas começam de pontos diferentes.

::::{grid} 1 2 2 2
:::{grid-item-card} Fluxo Verilog
:link: verilog
:link-type: doc
Crie ou importe módulos RTL, defina o Top Level, adicione um testbench e siga diretamente para validação, simulação, análise de ondas e PRISM.
:::
:::{grid-item-card} Fluxo de processador SAPHO
:link: processador-sapho
:link-type: doc
Configure um processador, escreva o algoritmo C±, gere o hardware Verilog com o YANC e depois simule ou visualize o RTL produzido.
:::
::::

## Comparação rápida

| Etapa | Fluxo Verilog | Fluxo de processador SAPHO |
|---|---|---|
| Entrada principal | Módulos `.v` ou `.sv` | algoritmo C± em arquivo `.cmm` |
| Geração inicial | Escrita ou importação do RTL | Hub de Processadores e compilação C± |
| Hardware usado | RTL fornecido pelo usuário | RTL gerado na pasta `Hardware` |
| Top Level | Módulo principal do projeto | Módulo gerado do processador ou módulo que o instancia |
| Testbench Top | Testbench `.v` ou cocotb `.py` | Testbench gerado, personalizado `.v` ou cocotb `.py` |
| Validação | Botão **Verilog** | Botão **C±**, seguido da validação Verilog quando necessária |
| Simulação | **Analisar Verilog (forma de onda)** ou **Execução rápida** | **Analisar Verilog (forma de onda)**, **Execução rápida** ou **Teste do processador sintetizado** |
| Análise | Viewer de ondas e PRISM | Viewer de ondas e PRISM |

## Etapas compartilhadas

Depois que o hardware Verilog está disponível, os dois fluxos convergem:

```{mermaid}
flowchart LR
  V["RTL Verilog criado ou importado"] --> RTL["Projeto Verilog preparado"]
  C["algoritmo C±"] --> Y["YANC gera o processador"]
  Y --> RTL
  RTL --> T["Top Level e Testbench Top"]
  T --> S["Icarus, Verilator ou cocotb"]
  S --> W["Viewer de ondas"]
  RTL --> P["PRISM"]
```

Em ambos os caminhos, o **Top Level** identifica o módulo principal do circuito e o **Testbench Top** identifica o teste que controla a simulação. A diferença está na origem do RTL: escrito ou importado no fluxo Verilog; gerado a partir de C± no fluxo SAPHO.

## Qual fluxo escolher

Escolha {doc}`verilog` quando já possui módulos RTL, está aprendendo Verilog ou deseja testar um circuito digital sem gerar um processador SAPHO.

Escolha {doc}`processador-sapho` quando deseja transformar um algoritmo C± em uma arquitetura dedicada, configurar largura numérica e portas de entrada e saída ou trabalhar com o fluxo de geração de processadores do ecossistema SAPHO.

As páginas {doc}`compilacao`, {doc}`simulacao`, {doc}`ondas` e {doc}`prism` detalham as ferramentas compartilhadas depois da preparação inicial.
