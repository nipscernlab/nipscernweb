# Tarefas com a Aurora Intelligence

Em vez de memorizar nomes de ferramentas internas, descreva o resultado esperado. Inclua o arquivo, a etapa ou o erro relevante e informe se o assistente pode apenas analisar ou também propor alterações.

Os exemplos desta página são modelos de pedido. Substitua os nomes genéricos pelo contexto real e mantenha uma tarefa principal por mensagem.

## Entender o projeto

Comece por consultas de leitura. Elas ajudam a confirmar se o assistente reconheceu corretamente o projeto antes de executar qualquer ação.

```text
Resuma a estrutura do projeto e identifique Top Level, Testbench Top e processador ativo.
```

```text
Explique o arquivo ativo para alguém que está aprendendo Verilog.
```

## Corrigir compilação

Peça que o terminal seja analisado na ordem em que as mensagens ocorreram. Corrigir a primeira falha evita alterações desnecessárias causadas por erros secundários.

```text
Leia os terminais e explique somente o primeiro erro que impede a compilação.
```

```text
Confira se há módulos duplicados ou dependências ausentes antes de alterar arquivos.
```

## Editar com segurança

Defina limites claros: arquivo, trecho, comportamento esperado e validação que deverá ser executada depois da mudança.

```text
Mostre a alteração proposta e aguarde minha confirmação antes de editar.
```

```text
Faça apenas a menor mudança necessária e salve o arquivo.
```

## Trabalhar com processadores

```text
Liste os processadores e explique a configuração do processador ativo.
```

```text
Crie um processador chamado filtro com 16 bits, uma entrada e uma saída.
```

## Simular e analisar ondas

Informe se deseja apenas preparar a seleção, executar a simulação ou interpretar o resultado. Essas ações possuem efeitos e tempos de execução diferentes.

```text
Confira Top Level e Testbench Top e diga o que falta para simular.
```

```text
Selecione clock, reset, entradas e saídas na **Configuração de Ondas**.
```

```text
Execute a simulação e explique o resultado do terminal sem modificar o RTL.
```

## Organizar arquivos

```text
Liste referências ausentes e não remova nenhuma sem minha aprovação.
```

```text
Crie um backup antes de renomear o processador.
```

## Boas práticas

- Informe uma tarefa por vez.
- Peça análise antes de alterações amplas.
- Leia a confirmação de ações de escrita.
- Valide arquivos editados com compilação ou simulação.
- Mantenha backup ou controle de versão.

Depois de uma ação, peça um resumo objetivo do que foi alterado e do resultado da validação. Não considere uma resposta textual como prova de que a compilação ou a simulação foi concluída.

