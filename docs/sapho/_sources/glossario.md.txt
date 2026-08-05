# Glossário

Este glossário reúne os termos usados de forma consistente no manual. Quando a interface mantiver um nome em inglês, o termo é preservado para facilitar sua localização na AURORA.

**AURORA**
: Ambiente desktop do ecossistema SAPHO para organizar projetos, editar fontes, gerar processadores, compilar, simular e analisar circuitos.

**C± / CMM**
: Linguagem de entrada para geração de processadores dedicados. Os algoritmos são armazenados em arquivos com extensão `.cmm`.

**YANC / SAPHO**
: YANC é o conjunto de compiladores usado na transformação de C± em hardware. SAPHO é o ecossistema no qual esse fluxo está inserido.

**Top Level / Testbench Top**
: Top Level é o módulo Verilog raiz do circuito. Testbench Top é o arquivo que inicia e controla a simulação.

**RTL**
: Representação do circuito em nível de transferência entre registradores, usada pelos módulos Verilog do projeto.

**Icarus / Verilator / cocotb**
: Icarus e Verilator são opções de simulação do RTL. O cocotb é o framework Python usado para escrever testbenches executados com um simulador compatível.

**VCD / FST / GTKWave / Surfer / layouts**
: VCD e FST armazenam formas de onda. GTKWave e Surfer são viewers. `.gtkw`, `.surf.ron` e `.sucl` registram organização visual ou comandos de visualização, sem conter os dados da simulação.

**Yosys / PRISM**
: Yosys processa a estrutura RTL usada pelo PRISM, que apresenta módulos e conexões em um diagrama navegável.

**Aurora Intelligence**
: Assistente integrado que pode consultar o contexto do projeto e, mediante confirmação, executar ações controladas.

**MCP**
: Model Context Protocol, empregado para disponibilizar ferramentas controladas da AURORA a agentes compatíveis.

**SPF**
: Formato JSON de projeto com extensão `.spf`. Registra estrutura, processadores, arquivos e seleções relevantes.

**CommandSpec**
: Contrato interno que representa executável, argumentos, diretório de trabalho e ambiente sem montar um comando de shell.
