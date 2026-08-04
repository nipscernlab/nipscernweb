# Galeria de projetos e testbenches

Esta galeria reúne exemplos pequenos para praticar o fluxo completo de simulação na AURORA. Cada circuito ou algoritmo possui duas alternativas de teste: um testbench Verilog (`.v`) e um testbench cocotb (`.py`). Use apenas uma alternativa como **Testbench Top** em cada execução.

## Como usar os exemplos

Para um exemplo Verilog:

1. Baixe ou copie os três arquivos do conjunto para a pasta do projeto.
2. Adicione o arquivo do circuito como fonte sintetizável.
3. Defina o arquivo do circuito como **Top Level**.
4. Adicione `tb_*.v` ou `test_*.py` como testbench.
5. Defina o testbench escolhido como **Testbench Top**.
6. Execute **Analisar Verilog (forma de onda)** para abrir as formas de onda ou **Execução rápida** para conferir apenas as verificações.

Para um exemplo C±:

1. Crie no **Hub de Processadores** um processador com o mesmo nome indicado por `#PRNAME`.
2. Substitua o conteúdo do arquivo em `Software` pelo exemplo `.cmm`.
3. Execute **C±** para gerar o módulo em `Hardware/<nome>.v` e os arquivos de memória necessários.
4. Adicione o testbench `.v` ou `.py` correspondente ao projeto.
5. Defina `Hardware/<nome>.v` como **Top Level** e o teste escolhido como **Testbench Top**.
6. Execute **Analisar Verilog (forma de onda)** ou **Execução rápida**.

:::{important}
Os testbenches dos exemplos C± exercitam o Verilog gerado pelo compilador. Compile o `.cmm` antes da simulação e mantenha os arquivos gerados pela AURORA no projeto. O arquivo Python não executa C± diretamente.
:::

## Porta AND em Verilog

Este primeiro conjunto cobre um circuito combinacional. Os quatro pares possíveis de entrada são aplicados, e cada saída é comparada com a tabela-verdade da operação AND.

Arquivos: {download}`porta_and.v <../_static/examples/testbenches/verilog/porta_and/porta_and.v>`, {download}`tb_porta_and.v <../_static/examples/testbenches/verilog/porta_and/tb_porta_and.v>` e {download}`test_porta_and.py <../_static/examples/testbenches/verilog/porta_and/test_porta_and.py>`.

### Circuito `porta_and.v`

```{literalinclude} ../_static/examples/testbenches/verilog/porta_and/porta_and.v
:language: verilog
:linenos:
```

### Testbench Verilog `tb_porta_and.v`

```{literalinclude} ../_static/examples/testbenches/verilog/porta_and/tb_porta_and.v
:language: verilog
:linenos:
```

O bloco `task verificar` evita repetir a sequência de atribuição, espera e comparação. `$fatal(1)` encerra a execução com falha assim que um caso produz uma saída incorreta. `$dumpfile` e `$dumpvars` registram os sinais para o viewer de ondas.

### Testbench cocotb `test_porta_and.py`

```{literalinclude} ../_static/examples/testbenches/verilog/porta_and/test_porta_and.py
:language: python
:linenos:
```

A diretiva `# aurora-toplevel: porta_and` seleciona explicitamente o módulo testado. A função auxiliar aplica um caso, aguarda a propagação combinacional e inclui entradas, valor esperado e valor obtido na mensagem da asserção.

## Contador de 4 bits em Verilog

Este conjunto introduz clock, reset e controle de habilitação. O teste confirma que o reset zera o estado, que o contador avança a cada borda quando `enable` vale `1` e que o valor permanece estável quando `enable` vale `0`.

Arquivos: {download}`contador4.v <../_static/examples/testbenches/verilog/contador4/contador4.v>`, {download}`tb_contador4.v <../_static/examples/testbenches/verilog/contador4/tb_contador4.v>` e {download}`test_contador4.py <../_static/examples/testbenches/verilog/contador4/test_contador4.py>`.

### Circuito `contador4.v`

```{literalinclude} ../_static/examples/testbenches/verilog/contador4/contador4.v
:language: verilog
:linenos:
```

### Testbench Verilog `tb_contador4.v`

```{literalinclude} ../_static/examples/testbenches/verilog/contador4/tb_contador4.v
:language: verilog
:linenos:
```

O clock alterna a cada `5 ns`, portanto o período é de `10 ns`. O reset é retirado na borda de descida para estar estável antes da próxima borda de subida. O atraso `#1` após a borda permite observar o valor atualizado pela atribuição não bloqueante do contador.

### Testbench cocotb `test_contador4.py`

```{literalinclude} ../_static/examples/testbenches/verilog/contador4/test_contador4.py
:language: python
:linenos:
```

`Clock` gera o clock em uma corrotina separada. A função `ler_apos_borda` aguarda `RisingEdge` e depois `ReadOnly`, fase em que as atualizações daquele instante já podem ser lidas sem disputar com a lógica do simulador. As mudanças de `rst` e `enable` são feitas após `FallingEdge`, fora da fase somente de leitura e antes da próxima borda ativa.

## Soma de constantes em C±

Este exemplo gera um processador chamado `soma_constantes`. O algoritmo soma `3 + 4`, escreve `7` na porta de saída `0` e alcança `#TOAQUI`, que permite ao hardware indicar o término pelo sinal `cheguei`.

Arquivos: {download}`soma_constantes.cmm <../_static/examples/testbenches/cmm/soma_constantes/soma_constantes.cmm>`, {download}`tb_soma_constantes.v <../_static/examples/testbenches/cmm/soma_constantes/tb_soma_constantes.v>` e {download}`test_soma_constantes.py <../_static/examples/testbenches/cmm/soma_constantes/test_soma_constantes.py>`.

### Algoritmo `soma_constantes.cmm`

```{literalinclude} ../_static/examples/testbenches/cmm/soma_constantes/soma_constantes.cmm
:language: c
:linenos:
```

### Testbench Verilog `tb_soma_constantes.v`

```{literalinclude} ../_static/examples/testbenches/cmm/soma_constantes/tb_soma_constantes.v
:language: verilog
:linenos:
```

O bloco acionado na borda de subida observa `out_en == 1`, condição que identifica uma escrita na porta `0`. A captura ocorre na própria borda porque esse sinal funciona como um pulso de habilitação da escrita. O limite de `200` ciclos evita uma simulação infinita se o algoritmo não produzir a saída ou não alcançar `#TOAQUI`.

### Testbench cocotb `test_soma_constantes.py`

```{literalinclude} ../_static/examples/testbenches/cmm/soma_constantes/test_soma_constantes.py
:language: python
:linenos:
```

O teste amostra `out_en`, `out` e `cheguei` na borda de descida do clock, quando os sinais produzidos na borda ativa já estão estáveis. Ele exige a lista exata `[7]`; dessa forma, detecta ausência de saída, valor incorreto e escritas adicionais inesperadas. O limite de ciclos impede uma espera infinita.

## Sequência de quadrados em C±

Este exemplo usa um laço `while` para escrever `0`, `1`, `4` e `9` na porta `0`. Além do valor de cada amostra, os testes verificam a ordem e a quantidade de escritas.

Arquivos: {download}`sequencia_quadrados.cmm <../_static/examples/testbenches/cmm/sequencia_quadrados/sequencia_quadrados.cmm>`, {download}`tb_sequencia_quadrados.v <../_static/examples/testbenches/cmm/sequencia_quadrados/tb_sequencia_quadrados.v>` e {download}`test_sequencia_quadrados.py <../_static/examples/testbenches/cmm/sequencia_quadrados/test_sequencia_quadrados.py>`.

### Algoritmo `sequencia_quadrados.cmm`

```{literalinclude} ../_static/examples/testbenches/cmm/sequencia_quadrados/sequencia_quadrados.cmm
:language: c
:linenos:
```

### Testbench Verilog `tb_sequencia_quadrados.v`

```{literalinclude} ../_static/examples/testbenches/cmm/sequencia_quadrados/tb_sequencia_quadrados.v
:language: verilog
:linenos:
```

O vetor `esperado` funciona como um modelo de referência simples. Cada pulso de `out_en` consome uma posição. O teste falha se houver valor incorreto, quantidade diferente de quatro saídas ou ausência do sinal de término.

### Testbench cocotb `test_sequencia_quadrados.py`

```{literalinclude} ../_static/examples/testbenches/cmm/sequencia_quadrados/test_sequencia_quadrados.py
:language: python
:linenos:
```

A lista Python torna a comparação da sequência inteira direta. Esse padrão pode ser ampliado para filtros, máquinas de estados e processadores que produzam séries de amostras.

## Escolher entre os dois tipos de testbench

| Situação | Testbench recomendado |
|---|---|
| Aprender eventos e tarefas do Verilog | `.v` |
| Controlar diretamente o dump de sinais | `.v` |
| Percorrer muitos casos de entrada | `.py` com cocotb |
| Criar listas, modelos matemáticos e mensagens detalhadas | `.py` com cocotb |
| Depurar a integração inicial de um módulo | Comece com `.v` e reproduza em `.py` quando necessário |

Os dois formatos verificam o mesmo hardware. A escolha altera a linguagem e a organização do teste, não o circuito sintetizável. Para o procedimento de execução e o diagnóstico de falhas, consulte {doc}`../fluxos/simulacao`.
