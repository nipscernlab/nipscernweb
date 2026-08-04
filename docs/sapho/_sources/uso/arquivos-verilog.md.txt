# Arquivos Verilog e Testbenches

Os arquivos Verilog descrevem o circuito e o ambiente usado para testá-lo. Esta página mostra como classificá-los, definir os pontos de entrada e evitar seleções que levem a uma compilação incompleta.

## Tipos de arquivo

A AURORA separa os arquivos em dois grupos:

**Fontes sintetizáveis**
: Módulos RTL que formam o circuito.

**Testbenches**
: Arquivos Verilog ou Python/cocotb usados somente para simulação.

Confirme a categoria ao importar. Um testbench não deve ser incluído como fonte sintetizável, pois contém estímulos e construções destinadas apenas à simulação. Da mesma forma, os módulos instanciados pelo circuito precisam estar entre as fontes selecionadas.

## Adicionar arquivos

1. Localize o arquivo na árvore ou use a ação de importação.
2. Marque-o na categoria correta.
3. Repita para todas as dependências do projeto.

Arquivos externos funcionam, mas tornam o projeto mais difícil de mover. Sempre que possível, mantenha-os dentro da pasta do projeto. Depois da importação, abra o arquivo pela árvore para confirmar que o caminho registrado está acessível.

## Definir o Top Level

Escolha o arquivo que contém o módulo principal do circuito, clique nele com o botão direito do mouse e selecione **Definir como Top Level**.

O Top Level deve declarar ou conter o módulo que representa o circuito completo. Ele é necessário para:

- Validar o Verilog.
- Abrir o PRISM.
- Montar a hierarquia do projeto.

Definir um módulo intermediário como Top Level pode produzir uma validação parcial e uma árvore incompleta. Confirme o nome do módulo principal antes de executar o fluxo.

```{figure} ../_static/screenshots/aurora-set-top-level.png
:alt: Projeto proj_PMU_padrao com o menu de contexto do arquivo PMU_padrao.v e a seleção de Top Level.
:width: 100%
:align: center

No projeto `proj_PMU_padrao`, clique com o botão direito em `PMU_padrao.v` e use a ação de Top Level. A bandeira na árvore e o nome na barra de status confirmam a seleção; quando o arquivo já está selecionado, o menu oferece **Remover Top Level**.
```

## Definir o Testbench Top

Escolha o testbench que será executado, clique nele com o botão direito do mouse e selecione **Marcar como Testbench**. Essa ação define o Testbench Top usado pela simulação.

- Arquivos `.v` usam testbench Verilog.
- Arquivos `.py` usam cocotb.

O Testbench Top é necessário para **Analisar Verilog (forma de onda)** e outras ações de simulação.

O arquivo selecionado deve conseguir instanciar o circuito e gerar os estímulos do teste. Em cocotb, o arquivo Python contém o módulo de teste, enquanto o Top Level continua apontando para o circuito Verilog.

```{figure} ../_static/screenshots/aurora-set-testbench-top.png
:alt: Projeto proj_PMU_padrao com o menu de contexto do arquivo pmu_cocotb.py e a seleção de Testbench Top.
:width: 100%
:align: center

No projeto `proj_PMU_padrao`, use **Marcar como Testbench** no arquivo `.v` ou `.py` que será executado. O ícone de frasco identifica o testbench; quando ele já está selecionado, o menu oferece **Desmarcar como Testbench**.
```

## Usar a vista de hierarquia

Depois de uma análise bem-sucedida, alterne a árvore para a vista de hierarquia. Ela mostra como os módulos se relacionam e ajuda a localizar instâncias. Use essa vista para verificar se todas as dependências esperadas foram encontradas.

A vista de hierarquia não altera os arquivos selecionados no projeto.

## Corrigir arquivos ausentes

Quando uma referência não existe mais:

1. Restaure o arquivo no caminho anterior.
2. Remova a referência antiga e importe a nova localização.

## Evitar erros comuns

- Não inclua duas cópias que declarem o mesmo módulo.
- Mantenha todas as dependências do Top Level selecionadas.
- Defina Top Level e Testbench Top antes de simular.
- Valide com **Verilog** antes de abrir o PRISM.

Quando houver erro de módulo desconhecido, confira primeiro se o arquivo que declara esse módulo foi adicionado como fonte sintetizável. Quando houver declaração duplicada, procure cópias do mesmo módulo em arquivos diferentes.

Para praticar essas seleções com circuitos completos, consulte {doc}`../exemplos/galeria-testbenches`. A galeria contém fontes Verilog e C± acompanhadas por testbenches Verilog e cocotb equivalentes.
