# Processadores SAPHO

Um processador reúne o algoritmo C±, a configuração numérica e os arquivos necessários para gerar o hardware. Esta página explica como criar, selecionar, gerar e testar um processador dentro de um projeto.

## Criar no Hub de Processadores

Abra **Hub de Processadores**, preencha os campos e confirme.

```{figure} ../_static/screenshots/aurora-processor-hub-current.png
:alt: Hub de Processadores com os campos de formato numérico, pilhas e portas.
:width: 90%
:align: center

O Hub de Processadores concentra os parâmetros usados para criar a estrutura inicial do processador SAPHO.
```

| Campo | Significado |
|---|---|
| Nome | Identifica o processador e suas pastas |
| Bits totais | Largura da palavra processada |
| Ganho | Escala usada pela representação numérica |
| Mantissa / Expoente | Divisão dos bits de ponto flutuante |
| Pilha de instruções | Capacidade de chamadas e controle |
| Pilha de dados | Capacidade para valores temporários |
| Entradas / Saídas | Quantidade de portas de I/O |

Use apenas números inteiros positivos. O ganho deve ser potência de dois e a soma de mantissa, expoente e bit de sinal deve corresponder aos bits totais. Se a configuração for rejeitada, revise primeiro essa relação e os tamanhos das pilhas antes de tentar valores diferentes aleatoriamente.

Os valores determinam características do hardware gerado. Para o primeiro projeto, mantenha uma configuração já validada pelo curso, laboratório ou exemplo de referência. Altere um parâmetro por vez quando precisar avaliar seu efeito.

## Criar rapidamente com `$cmm`

1. Use `Ctrl+N` para criar um arquivo `Untitled-N`.
2. Digite somente `$cmm`.
3. Aguarde a AURORA expandir o modelo inicial do algoritmo C±.
4. Use `Ctrl+S` e informe o nome do processador.

Ao salvar dentro de um projeto aberto, a AURORA atualiza a diretiva `#PRNAME`, registra o processador no `.spf` e cria as pastas `<processador>/Software`, `<processador>/Hardware` e `<processador>/Simulation`. O arquivo `.cmm` é salvo dentro de `Software` e passa a aparecer como processador do projeto.

## Arquivos criados

Cada processador possui:

```text
<processador>/
├── Software/    algoritmo C±
├── Hardware/    Verilog gerado
└── Simulation/  entradas, saídas e arquivos de simulação
```

O arquivo `.cmm` inicial contém as diretivas da configuração escolhida. A pasta `Software` guarda o algoritmo editável; `Hardware` recebe os módulos Verilog; e `Simulation` concentra arquivos usados nos testes do processador.

## Processador ativo

Abra o `.cmm` do processador que deseja usar. O nome ativo aparece na barra de status e habilita as ações relacionadas.

Se o botão **C±** estiver desabilitado, confirme que:

1. O projeto está aberto.
2. O arquivo `.cmm` do processador está ativo.
3. Nenhuma compilação está em andamento.

## Configuração de execução

O painel do processador permite ajustar:

- Frequência de clock.
- Quantidade de ciclos.
- Exibição de arrays.

Esses valores afetam simulações e a execução direta do processador. A frequência participa da configuração temporal, enquanto a quantidade de ciclos limita a duração esperada da execução. Comece com os padrões e altere somente quando souber a duração necessária do teste.

```{figure} ../_static/screenshots/aurora-processor-settings-panel.png
:alt: Projeto proj_PMU_padrao aberto em PMU_padrao.cmm com o painel de configuração de execução e o terminal TCMM selecionado.
:width: 100%
:align: center

No projeto `proj_PMU_padrao`, o painel da engrenagem aparece sobre o algoritmo `PMU_padrao.cmm`. Ele ajusta a frequência, o limite de ciclos e a inclusão de arrays nas formas de onda. O tempo estimado é atualizado com os valores informados.
```

## Gerar o hardware

1. Abra o arquivo `.cmm`.
2. Salve as alterações.
3. Clique em **C±**.
4. Acompanhe os terminais.
5. Confirme que os arquivos apareceram em `Hardware`.

Leia o terminal de C± e, em seguida, o terminal de Assembly. O processo deve terminar sem erro antes que os arquivos em `Hardware` sejam considerados atualizados. Se a geração falhar, preserve a primeira mensagem de erro para o diagnóstico.

## Executar diretamente

**Teste do processador sintetizado** executa o processador ativo pelo fluxo de teste dedicado. Use essa opção quando quiser testar entradas e saídas do processador sem montar uma análise completa no viewer de ondas. O resultado aparece no terminal **THTEST**.

## Renomear ou excluir

Faça backup e use os comandos da AURORA. A exclusão pode remover arquivos do processador; leia a confirmação antes de prosseguir.

