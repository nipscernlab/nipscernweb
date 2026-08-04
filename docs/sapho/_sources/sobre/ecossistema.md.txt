# Entenda os fluxos da AURORA

Esta página apresenta como as etapas de um projeto se conectam. Ao final, você saberá distinguir o arquivo que descreve o circuito, o ponto de entrada da validação e o arquivo que controla a simulação.

A AURORA reúne dois caminhos principais: o desenvolvimento direto de RTL Verilog e a geração de processadores SAPHO a partir de um algoritmo C±, salvo em um arquivo `.cmm`. Os dois caminhos passam a compartilhar as mesmas ferramentas depois que o hardware Verilog está disponível.

```{mermaid}
flowchart LR
  VER["Módulos Verilog"] --> RTL["Hardware Verilog"]
  CMM["Algoritmo C± (.cmm)"] --> YANC["Geração do processador SAPHO"]
  YANC --> RTL
  RTL --> VALIDAR["Validação e hierarquia"]
  RTL --> SIM["Simulação com testbench"]
  SIM --> WAVE["Forma de onda"]
  RTL --> PRISM["Estrutura RTL no PRISM"]
```

## Como as etapas se relacionam

1. No fluxo Verilog, você cria ou importa diretamente os módulos RTL.
2. No fluxo SAPHO, o YANC transforma o algoritmo C± em módulos Verilog na pasta `Hardware`.
3. Você define o **Top Level**, que identifica a raiz do circuito.
4. Para simular, você também define o **Testbench Top**, que contém ou inicia os estímulos e as verificações.
5. Icarus ou Verilator executa a simulação. Um testbench pode ser escrito em Verilog ou em Python com cocotb.
6. A simulação pode gerar uma forma de onda para análise no GTKWave ou no Surfer.
7. O PRISM usa o RTL validado para apresentar módulos e conexões; ele não executa o testbench.

Uma validação bem-sucedida confirma que os módulos podem ser elaborados. A simulação verifica o comportamento definido pelo testbench. A forma de onda permite observar os sinais ao longo do tempo, enquanto o PRISM apresenta a organização estrutural do circuito.

## Conceitos que organizam o projeto

| Conceito | Definição | Por que é necessário |
|---|---|---|
| **Projeto `.spf`** | Arquivo que registra fontes, processadores e seleções do projeto. | Permite que a AURORA restaure o contexto de trabalho. |
| **Algoritmo C±** | Código-fonte `.cmm` usado para gerar um processador SAPHO. | É a entrada editável do fluxo SAPHO. |
| **Processador ativo** | Processador associado ao arquivo `.cmm` aberto. | Determina qual algoritmo será compilado e testado pelas ações de processador. |
| **Fonte sintetizável** | Módulo Verilog que pertence ao circuito. | Participa da elaboração, da hierarquia e do PRISM. |
| **Top Level** | Módulo Verilog que representa a raiz do circuito completo. | Orienta a validação, a hierarquia, o PRISM e a associação com testbenches cocotb. |
| **Testbench Top** | Arquivo `.v` ou `.py` selecionado para iniciar a simulação. | Define os estímulos, as verificações e o término do teste. |
| **Forma de onda** | Registro temporal dos sinais gerado pela simulação, normalmente em VCD ou FST. | Permite investigar a sequência de eventos e valores do circuito. |

O **Top Level** e o **Testbench Top** cumprem funções diferentes. Em um teste Verilog, o Testbench Top normalmente instancia o módulo definido como Top Level. Em um teste cocotb, o arquivo Python controla o simulador e acessa as portas do Top Level.

:::{tip}
Antes de validar, simular ou abrir o PRISM, confira na barra de status se o processador ativo, o **Top Level** e o **Testbench Top** correspondem ao fluxo que você pretende executar.
:::

Escolha seu roteiro em {doc}`../fluxos/index`.
