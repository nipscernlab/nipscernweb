# AURORA — manual de uso

<div class="hero">
<span class="version-pill">Versão documentada: 6.3.2</span>

Use este manual para instalar a AURORA, criar projetos, gerar processadores, compilar Verilog, simular, analisar formas de onda, versionar arquivos e usar a Aurora Intelligence. O conteúdo acompanha a ordem normal de trabalho, desde a criação do primeiro projeto até a análise dos resultados.

As páginas são orientadas a tarefas e organizadas conforme o fluxo normal de uso da AURORA.

<div class="hero-actions">

{{ pdf_button }}

</div>
</div>

:::{note}
Este manual descreve a AURORA **6.3.2** para Windows 10/11. Para informações sobre commit, fontes consultadas e método de análise, consulte {doc}`sobre/escopo`.
:::

## Como usar este manual

Se esta é a sua primeira experiência com a AURORA, comece por **Instalação e primeiro início** e siga para **Escolha seu fluxo**. O manual apresenta Verilog e processadores SAPHO como caminhos principais independentes, que convergem nas ferramentas de simulação e análise.

Se você já possui um projeto, use o menu lateral para ir diretamente à tarefa desejada. As páginas de referência ajudam a consultar atalhos, formatos de arquivos e causas de falhas sem repetir todo o tutorial.

## Encontre o que precisa

::::{grid} 1 2 2 3
:::{grid-item-card} Começar
:link: inicio/instalacao
:link-type: doc
Instale a AURORA e confirme que o ambiente está pronto.
:::
:::{grid-item-card} Fluxo Verilog
:link: fluxos/verilog
:link-type: doc
Crie ou importe RTL, valide, simule e analise o circuito.
:::
:::{grid-item-card} Fluxo SAPHO
:link: fluxos/processador-sapho
:link-type: doc
Gere um processador a partir de C± e teste o hardware produzido.
:::
:::{grid-item-card} Aurora Intelligence
:link: ia/visao-geral
:link-type: doc
Configure um provedor e use IA com confirmação de alterações.
:::
:::{grid-item-card} Resolver problemas
:link: referencia/diagnostico
:link-type: doc
Diagnostique botões desabilitados, compilação, ondas, PRISM e IA.
:::
::::

```{toctree}
:maxdepth: 2
:caption: Comece aqui

sobre/ecossistema
inicio/instalacao
inicio/primeiro-projeto
```

```{toctree}
:maxdepth: 2
:caption: Usar a AURORA

uso/interface
uso/projetos
uso/editor
uso/processadores
uso/arquivos-verilog
uso/source-control
```

```{toctree}
:maxdepth: 2
:caption: Fluxos principais

fluxos/index
fluxos/verilog
fluxos/processador-sapho
```

```{toctree}
:maxdepth: 2
:caption: Compilar, simular e analisar

fluxos/compilacao
fluxos/simulacao
exemplos/galeria-testbenches
fluxos/ondas
fluxos/prism
```

```{toctree}
:maxdepth: 2
:caption: Aurora Intelligence

ia/visao-geral
ia/provedores
ia/ferramentas
ia/mcp-cli
```

```{toctree}
:maxdepth: 2
:caption: Configuração e ajuda

configuracao/preferencias
referencia/formatos
referencia/atalhos
referencia/diagnostico
```

```{toctree}
:maxdepth: 1
:caption: Apêndices

glossario
sobre/escopo
```
