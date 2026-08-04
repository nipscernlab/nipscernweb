# Primeiro projeto: escolha seu fluxo

A AURORA possui dois fluxos principais. Antes de criar arquivos, escolha se o hardware será escrito diretamente em Verilog ou gerado a partir de um algoritmo C± do ecossistema SAPHO.

::::{grid} 1 2 2 2
:::{grid-item-card} Começar com Verilog
:link: ../fluxos/verilog
:link-type: doc
Use módulos RTL próprios ou importados, adicione um testbench e siga diretamente para validação e simulação.
:::
:::{grid-item-card} Começar com um processador SAPHO
:link: ../fluxos/processador-sapho
:link-type: doc
Configure o processador no **Hub de Processadores**, escreva o algoritmo C± e gere o hardware Verilog antes de simular.
:::
::::

## O que os dois fluxos compartilham

Em qualquer opção, você criará ou abrirá um projeto `.spf`, trabalhará com arquivos no editor e definirá os pontos de entrada usados pelas ferramentas:

**Top Level**
: Módulo Verilog principal do circuito.

**Testbench Top**
: Arquivo Verilog ou Python/cocotb que executa o teste.

Depois dessa preparação, ambos podem usar Icarus, Verilator, cocotb, GTKWave ou Surfer e PRISM.

## Diferença principal

No {doc}`../fluxos/verilog`, o RTL já é a entrada de trabalho: você escreve ou importa os módulos e os valida diretamente.

No {doc}`../fluxos/processador-sapho`, a entrada editável é o algoritmo `.cmm`: o YANC gera os módulos Verilog que seguem para as mesmas etapas de simulação e análise.

Consulte {doc}`../fluxos/index` para uma comparação completa. Para conhecer a interface antes de iniciar, continue em {doc}`../uso/interface`.
