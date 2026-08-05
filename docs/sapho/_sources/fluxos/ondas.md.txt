# Formas de onda, GTKWave e Surfer

As formas de onda mostram como cada sinal muda ao longo do tempo simulado. Esta página explica como escolher sinais, gerar o arquivo de onda e reutilizar layouts no viewer selecionado sem confundir resultados de testbenches diferentes.

## Gerar uma forma de onda

1. Defina o **Testbench Top**.
2. Escolha Icarus ou Verilator.
3. Escolha o viewer de waveform, quando quiser alternar entre GTKWave e Surfer.
4. Abra **Configuração de Ondas**.
5. Selecione os sinais desejados.
6. Clique em **Analisar Verilog (forma de onda)**.

A AURORA executa a simulação e abre o resultado no viewer selecionado. GTKWave é o viewer externo padrão. Surfer é uma opção opt-in; se o executável do Surfer não estiver disponível, a AURORA volta para GTKWave e avisa o usuário. Se a compilação ou o testbench falhar, o visualizador pode não ser aberto; nesse caso, o terminal Wave deve ser analisado antes da configuração visual.

## Escolher o viewer

Use GTKWave quando quiser o fluxo tradicional com janela externa e layouts `.gtkw`. Use Surfer quando quiser usar layouts `.surf.ron` ou scripts `.sucl` e o viewer estiver disponível na instalação.

| Viewer | Layouts | Observação |
|---|---|---|
| GTKWave | `.gtkw` | Padrão externo para VCD/FST. |
| Surfer | `.surf.ron` e `.sucl` | Opção opt-in; pode usar mappings em `%APPDATA%/surfer-project/surfer/config/mappings/`. |

O arquivo de onda real continua sendo `.vcd` ou `.fst`. Layouts apenas organizam sinais e visualização.

## Selecionar sinais

Na **Configuração de Ondas** você pode:

- Pesquisar por nome.
- Navegar pela hierarquia.
- Selecionar todos, nenhum ou o conjunto padrão.
- Filtrar sinais relacionados aos processadores.

```{figure} ../_static/screenshots/aurora-wave-configuration-verilog.png
:alt: Configuração de ondas com hierarquia de módulos e sinais Verilog selecionáveis.
:width: 85%
:align: center

Expanda a hierarquia, marque somente os sinais necessários e confira a quantidade selecionada antes de salvar.
```

Atalhos:

| Atalho | Ação |
|---|---|
| `Ctrl+F` | Focar a pesquisa. |
| `Esc` | Limpar a pesquisa; pressione novamente para fechar. |

Selecione primeiro clock, reset, entradas, saídas e os poucos sinais internos necessários para responder à pergunta do teste. Um conjunto menor torna a leitura mais simples, reduz o tamanho do arquivo de onda e evita que detalhes sem relação ocultem o comportamento importante.

Depois da simulação, confira se os nomes exibidos no viewer pertencem à hierarquia esperada. Se o circuito foi renomeado ou reorganizado, seleções antigas podem deixar de corresponder ao RTL atual.

## Testbench com `$dumpfile` e `$dumpvars`

Se o testbench já define o dump manualmente, a AURORA respeita essa configuração enquanto a **Configuração de Ondas** não tiver sido personalizada para esse testbench. Nesse caso, confirme se o nome do arquivo, o escopo passado a `$dumpvars` e os sinais gerados correspondem ao que deseja abrir. Uma configuração manual muito restrita pode produzir um arquivo válido, mas sem os sinais necessários para a análise.

Quando você salva uma seleção própria na **Configuração de Ondas** ou ativa um layout que dita sinais, a AURORA usa essa seleção como fonte do dump. Se houver `$dumpfile` ou `$dumpvars` manuais, eles são neutralizados apenas na cópia temporária usada para simular; o testbench original não é alterado.

## Usar layouts de viewer

O seletor de layout acompanha o viewer ativo. Em GTKWave, ele trabalha com `.gtkw`. Em Surfer, ele trabalha com `.surf.ron` e `.sucl`.

O seletor permite:

- **Default**: Gerar uma organização automática.
- **Add**: Registrar um layout existente.
- **Remove**: Remover a referência do seletor.

Use apenas layouts criados para o mesmo testbench e para uma hierarquia compatível. Um layout organiza nomes de sinais; ele não contém a simulação. Um layout de outro projeto pode apontar para sinais inexistentes mesmo quando o arquivo VCD ou FST foi gerado corretamente.

## Se o viewer abrir sem sinais

Verifique:

1. O testbench executou até o fim.
2. O terminal Wave não informou erro.
3. Existe dump de sinais.
4. Os sinais selecionados ainda existem no RTL.
5. O layout ativo pertence ao testbench atual.

Volte para **Default** e gere novamente para descartar um layout incompatível.

Se os sinais aparecerem, mas permanecerem sem mudança, verifique o clock, o reset, os estímulos e o intervalo de tempo mostrado. O problema pode estar no testbench ou no zoom da janela, e não na geração do arquivo.

## Se o arquivo de onda não for encontrado

- Confira o nome usado em `$dumpfile`.
- Verifique se o testbench encerrou antes de produzir o arquivo.
- Remova arquivos de onda antigos que possam causar ambiguidade.
- Execute novamente e leia o terminal Wave.
