# Editor, abas e painéis

O editor é a área de trabalho para algoritmos C±, módulos Verilog, testbenches e arquivos auxiliares. Esta página explica como organizar arquivos, salvar mudanças e comparar conteúdos sem perder o contexto do projeto.

## Abrir arquivos

Clique duas vezes em um arquivo da árvore. Arquivos de texto são abertos em uma aba; imagens e conteúdos reconhecidos usam visualizadores próprios.

O editor oferece realce para C±, Assembly, Verilog, Python, JSON e outros formatos comuns. O realce ajuda na leitura, mas não garante que o conteúdo esteja correto; use as etapas de compilação e simulação para validar o arquivo.

Use `Ctrl+N` para criar um documento vazio chamado `Untitled-N`. A AURORA detecta o tipo pelo conteúdo e sugere a extensão correspondente quando o arquivo é salvo.

### Criar um processador SAPHO com `$cmm`

1. Abra um documento vazio com `Ctrl+N`.
2. Digite somente `$cmm`.
3. Aguarde a expansão automática do modelo C±.
4. Use `Ctrl+S` e informe o nome do processador.

A AURORA substitui `$cmm` pelas diretivas padrão e pelo corpo inicial de um algoritmo C±. Ao salvar dentro de um projeto aberto, ela usa o nome escolhido em `#PRNAME`, registra o processador no `.spf` e cria a estrutura `<processador>/Software`, `<processador>/Hardware` e `<processador>/Simulation`. O arquivo `.cmm` é gravado em `Software` e passa a aparecer como processador do projeto.

## Abas

- Clique em uma aba para ativá-la.
- Use `Ctrl+W` para fechar a aba atual.
- Use `Ctrl+Shift+T` para reabrir a última aba fechada.
- O marcador na aba indica alterações ainda não salvas.

Ao fechar uma aba modificada, leia a confirmação antes de descartar o conteúdo. Fechar a aba não remove o arquivo do projeto nem do disco.

## Dividir o editor

Use o botão de divisão para abrir até três painéis. Isso é útil para comparar módulos, manter o testbench ao lado do RTL ou consultar um arquivo enquanto edita outro.

Se o mesmo arquivo estiver aberto em dois painéis, a alteração aparece nos dois porque ambos representam o mesmo documento. Use a divisão para consultar regiões diferentes ou comparar arquivos relacionados, não para criar versões independentes do mesmo conteúdo.

## Localizar e navegar

| Atalho | Ação |
|---|---|
| `Ctrl+F` | Localizar no arquivo |
| `Ctrl+H` | Localizar e substituir |
| `Ctrl+G` | Ir para uma linha |
| `F1` | Abrir a paleta de comandos do Monaco |
| `Ctrl+Shift+P` | Abrir a paleta de comandos da AURORA |
| `F12` | Ir para definição quando disponível |

## Salvar

- Atalho `Ctrl+S`: Salva o arquivo ativo.
- Atalho `Ctrl+Shift+S`: Salva todos os arquivos modificados.

Antes de compilar, confirme que o marcador de alteração desapareceu da aba.

Salvar antes da compilação é importante porque as ferramentas externas leem o conteúdo gravado no disco. Uma alteração visível no editor, mas ainda não salva, não fará parte da execução.

## Usar a seleção com IA

Selecione um trecho de código para enviá-lo à Aurora Intelligence com o caminho e a linguagem do arquivo. Um pedido específico, como “explique por que este sinal nunca muda”, produz um contexto melhor do que uma solicitação genérica. Peça primeiro uma explicação ou revisão. Alterações propostas pela IA exigem confirmação antes de serem aplicadas.

## Mudanças externas

Quando o arquivo muda no disco enquanto possui alterações locais, escolha conscientemente qual versão manter. Em caso de dúvida, copie o trecho local antes de recarregar.

Depois de resolver o conflito, salve o arquivo e verifique se a aba deixou de indicar modificação. Em seguida, compile novamente para garantir que a versão correta foi utilizada.

