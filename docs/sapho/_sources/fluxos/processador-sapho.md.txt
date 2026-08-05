# Fluxo completo para processadores SAPHO

Este roteiro apresenta a geração de hardware do ecossistema SAPHO. Ao final, você terá um processador configurado no **Hub de Processadores**, um algoritmo C± compilado, o Verilog correspondente e um teste executado na AURORA.

```{figure} ../_static/screenshots/aurora-pmu-cmm-editor.png
:alt: Projeto proj_PMU_padrao aberto na AURORA com o algoritmo PMU_padrao.cmm no editor.
:width: 100%
:align: center

O projeto `proj_PMU_padrao` aberto em `PMU_padrao.cmm`. Ao abrir o algoritmo C±, o processador `PMU_padrao` fica ativo e as ações relacionadas ao processador são habilitadas.
```

## 1. Criar ou abrir o projeto

1. Clique em **Novo Projeto**.
2. Informe um nome para o projeto.
3. Escolha uma pasta com permissão de escrita.
4. Confirme a criação.

O arquivo `.spf` criado pela AURORA registra os processadores, as fontes e as seleções do projeto. Não edite esse arquivo manualmente durante o fluxo normal.

## 2. Criar o processador

Abra **Hub de Processadores** e informe apenas o nome do processador. No primeiro projeto, mantenha os valores padrão já preenchidos para bits totais, ganho, mantissa, expoente, pilhas e portas de entrada e saída. Em seguida, clique em **Gerar Processador**.

Os padrões formam uma configuração válida e permitem praticar o fluxo antes de alterar a arquitetura. Para compreender cada campo e preparar configurações específicas, consulte {doc}`../uso/processadores` com o título **Processadores SAPHO**.

Depois da confirmação, o processador aparece na árvore com as pastas:

```text
<processador>/
├── Software/
├── Hardware/
└── Simulation/
```

## 3. Escrever o algoritmo C±

Abra `Software/<processador>.cmm`, preserve as diretivas geradas e escreva o algoritmo dentro das funções do arquivo.

O arquivo `.cmm` define tanto o comportamento quanto os parâmetros usados na geração. Salve antes de compilar. Para testes que precisam identificar o término do algoritmo, use `#TOAQUI` no ponto adequado.

## 4. Gerar o hardware

1. Mantenha o arquivo `.cmm` aberto.
2. Clique em **Compilar C±**.
3. Acompanhe os terminais **C±** e **ASM**.
4. Aguarde a criação ou atualização dos arquivos na pasta `Hardware`.

O YANC transforma o algoritmo em Assembly SAPHO e depois gera o módulo Verilog, as imagens de memória e o testbench padrão. Um arquivo antigo em `Hardware` não comprova que a compilação atual passou; confirme o resultado nos terminais.

## 5. Preparar Top Level e testbench

O módulo em `Hardware/<processador>.v` pode ser usado como Top Level quando o projeto testa apenas esse processador. Clique nele com o botão direito do mouse e escolha **Definir como Top Level**. Em sistemas maiores, o Top Level pode ser outro módulo Verilog que instancia um ou mais processadores gerados.

Como Testbench Top, use:

- O testbench padrão criado na pasta `Simulation`.
- Um testbench Verilog personalizado.
- Um arquivo Python/cocotb com a diretiva `# aurora-toplevel: <processador>`.

Clique com o botão direito no testbench escolhido e selecione **Marcar como Testbench**. Confirme o Top Level e o Testbench Top na barra de status antes de simular.

## 6. Escolher a forma de execução

**Teste do processador sintetizado**
: Executa o processador ativo em um harness dedicado do Verilator. Use para validar entradas, saídas e término sem preparar uma inspeção completa no viewer de ondas. O progresso e o resultado aparecem no terminal **THTEST**.

**Execução rápida**
: Executa o Testbench Top sem abrir formas de onda. Use para verificações automatizadas e regressões curtas.

**Analisar Verilog (forma de onda)**
: Executa o Testbench Top, gera VCD ou FST e abre o viewer selecionado. Use quando precisa observar sinais, portas e estados internos.

## 7. Conferir entradas e saídas

Nos processadores gerados, `out` transporta o valor e `out_en` identifica a porta de saída escrita. O sinal `cheguei` indica que a execução alcançou o marcador `#TOAQUI`.

Um teste adequado deve verificar:

- Se cada porta recebeu os valores esperados.
- Se a quantidade e a ordem das saídas estão corretas.
- Se o processador alcançou o ponto de término.
- Se existe um limite de ciclos para evitar espera infinita.

## 8. Analisar o hardware gerado

Use **Analisar Verilog (forma de onda)** para observar o comportamento temporal e **Abrir PRISM** para examinar a estrutura RTL. O algoritmo C± continua sendo a fonte editável; os arquivos da pasta `Hardware` são resultados da geração e podem ser substituídos na próxima compilação.

```{figure} ../_static/screenshots/aurora-wave-configuration-sapho.png
:alt: Configuração de ondas de um processador SAPHO com clock, reset, portas de saída e sinal de término.
:width: 85%
:align: center

No fluxo SAPHO, comece por `clk`, `rst`, `proc_io_out`, `proc_out_en` e `proc_cheguei`. Expanda o processador somente quando precisar investigar sinais internos.
```

## Resultado esperado

O fluxo SAPHO está concluído quando:

- O Hub de Processadores criou a estrutura do processador.
- O algoritmo `.cmm` compila sem erro.
- O Verilog e os arquivos de memória são atualizados.
- O Top Level e o Testbench Top estão definidos.
- A execução produz as saídas esperadas e alcança o término.
- O viewer de ondas ou o PRISM apresenta o resultado desejado, quando utilizado.

Para compreender os campos do Hub de Processadores, consulte {doc}`../uso/processadores`. Para exemplos C± com testbenches Verilog e cocotb, consulte {doc}`../exemplos/galeria-testbenches`.
