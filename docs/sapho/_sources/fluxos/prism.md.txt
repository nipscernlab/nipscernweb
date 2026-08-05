# Visualizar e simular o RTL no PRISM

O PRISM possui dois modos complementares. **Esquemático** apresenta a estrutura RTL sintetizada; **Simular** abre um circuito lógico interativo no qual entradas podem ser alteradas entre `0` e `1` e as saídas são atualizadas na tela.

## Abrir o PRISM

1. Adicione todas as fontes sintetizáveis ao projeto.
2. Defina o **Top Level**.
3. Salve os arquivos.
4. Execute **Compilar Verilog** e corrija os erros mostrados no terminal.
5. Clique em **Abrir PRISM**.

O diagrama corresponde ao RTL salvo e processado naquele momento. Se o Top Level ou o conjunto de fontes mudar, confirme as seleções na janela principal e use **Recompilar**.

## Projeto Verilog puro

```{figure} ../_static/screenshots/aurora-prism-alu32-rtl.png
:alt: PRISM exibindo o esquemático RTL do projeto Verilog ALU32.
:width: 100%
:align: center

O projeto `ALU32` mostra operações, multiplexadores, portas e conexões derivados diretamente do módulo `alu32.v`.
```

No modo **Esquemático**, use o zoom para aproximar ou afastar, arraste a área livre para navegar e abra instâncias navegáveis para inspecionar módulos internos. **Voltar** retorna ao nível anterior e **Ajustar** enquadra o diagrama na janela.

## Processador SAPHO

```{figure} ../_static/screenshots/aurora-prism-pmu-rtl.png
:alt: PRISM exibindo o RTL do projeto proj_PMU_padrao com o ícone próprio do processador SAPHO.
:width: 100%
:align: center

No projeto `proj_PMU_padrao`, o processador SAPHO aparece com um ícone próprio no RTL, ao lado dos demais blocos e conexões do Top Level.
```

A aparência própria do bloco `processor` facilita reconhecer o núcleo SAPHO dentro de um projeto maior. O ícone representa uma instância do módulo; abra a instância quando quiser navegar pela estrutura interna disponível.

## Controles da janela

| Controle | O que faz |
|---|---|
| **Voltar** | Retorna ao módulo visualizado anteriormente |
| **Ajustar** | Centraliza e enquadra todo o circuito |
| **Baixar** | Exporta a visualização atual |
| **Simular** | Troca do esquemático para a simulação lógica interativa |
| **Esquemático** | Retorna da simulação interativa ao diagrama RTL |
| **Recompilar** | Processa novamente os arquivos salvos e atualiza a visualização |

## Simulação interativa

```{figure} ../_static/screenshots/aurora-prism-porta-and-simulation.png
:alt: Simulação interativa do projeto porta_AND no PRISM com as duas entradas em 1 e a saída em 1.
:width: 100%
:align: center

Na simulação do projeto `porta_AND`, as entradas `a` e `b` estão em `1`; a saída `y` responde com `1` conforme a tabela-verdade da porta AND.
```

Para testar um circuito combinacional:

1. Abra o esquemático do Top Level no PRISM.
2. Clique em **Simular** e aguarde a construção do circuito interativo.
3. Clique nos controles de entrada para alternar cada valor entre `0` e `1`.
4. Observe as conexões e os valores das saídas atualizados na própria tela.
5. Clique em **Esquemático** para retornar à estrutura RTL.

Em circuitos sequenciais, a simulação pode disponibilizar controles adicionais de clock. Valores desconhecidos podem aparecer como `x` até que entradas, clock ou reset definam um estado válido.

## O que o PRISM confirma

Use o modo **Esquemático** para conferir hierarquia, instâncias e conexões. Use **Simular** para experimentar estados lógicos diretamente, sobretudo em circuitos pequenos e combinacionais.

A simulação interativa não substitui um testbench Verilog ou cocotb, nem a análise temporal em formas de onda. Para verificar sequências extensas, temporização, clock e asserções automatizadas, use {doc}`simulacao` e {doc}`ondas`.

## Quando o PRISM falhar

**Top Level incorreto**
: Escolha o módulo raiz do projeto.

**Módulo ausente**
: Inclua o arquivo que declara a dependência.

**Módulo duplicado**
: Remova uma das fontes que declaram o mesmo nome.

**Diagrama não é gerado**
: Execute **Compilar Verilog** primeiro e corrija o erro mais inicial do terminal.

**Uma instância não abre**
: Ela pode ser uma primitiva, um módulo filtrado ou não possuir informação suficiente para navegação.

**A simulação mostra `x`**
: Defina as entradas e aplique reset ou clock quando o circuito exigir estado inicial.
