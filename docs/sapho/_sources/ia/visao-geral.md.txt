# Aurora Intelligence

Aurora Intelligence é o assistente integrado ao projeto. Ele pode explicar arquivos, consultar o estado da IDE, ajudar no diagnóstico e, com sua confirmação, executar ações. Esta página apresenta um modo de uso seguro e previsível, no qual cada alteração é revisada e validada.

```{figure} ../_static/screenshots/aurora-intelligence-panel-current.png
:alt: Painel Aurora Intelligence aberto ao lado de um testbench cocotb.
:width: 100%
:align: center

O painel permanece ao lado do editor, permitindo formular o pedido enquanto o arquivo e o estado do projeto continuam visíveis.
```

## O que você pode pedir

- Explicar um arquivo ou trecho selecionado.
- Localizar erros de compilação.
- Listar arquivos, processadores e sinais.
- Orientar a configuração do projeto.
- Criar ou editar arquivos.
- Compilar, simular e abrir ferramentas.
- Preparar uma sequência de diagnóstico.

O assistente trabalha melhor quando o pedido informa o objetivo, o arquivo e a etapa atual. Em vez de pedir apenas “corrija o projeto”, indique o erro observado e peça que a primeira causa seja explicada antes de qualquer modificação.

## Leitura e alteração

Pedidos de consulta podem ser executados diretamente. Ações que alteram arquivos, configurações ou executam fluxos apresentam uma confirmação.

Antes de aprovar, verifique:

1. Qual ação será executada.
2. Quais arquivos serão alterados.
3. Se há backup ou versionamento.
4. Se os argumentos correspondem ao seu objetivo.

Negar uma ação não encerra a conversa. O assistente pode explicar outra abordagem, reduzir o escopo ou apresentar a mudança em texto antes de solicitar nova confirmação.

Uma confirmação autoriza a ação mostrada naquele momento; ela não substitui a revisão do resultado. Depois de qualquer escrita, abra o arquivo alterado, confira o conteúdo e execute a validação adequada.

## Fluxo recomendado

1. Peça uma análise.
2. Solicite um plano curto.
3. Aprove uma alteração pequena.
4. Revise o resultado.
5. Compile ou simule.
6. Continue somente depois da validação.

Esse ciclo reduz o risco de acumular várias mudanças antes de descobrir qual delas introduziu um problema. Para tarefas maiores, peça que o assistente divida o trabalho em etapas independentes.

## Exemplos

```text
Explique o arquivo ativo e diga qual é o módulo principal.
```

```text
Leia o terminal Verilog e identifique o primeiro erro que preciso corrigir.
```

```text
Liste os sinais do testbench e sugira apenas clock, reset, entradas e saídas.
```

```text
Antes de editar, mostre exatamente quais linhas pretende alterar.
```

## Privacidade

O conteúdo enviado depende do provedor configurado:

- Provedores em nuvem recebem mensagens e contexto necessário.
- Ollama processa o modelo localmente.
- Claude Code e ChatGPT via Codex CLI usam suas próprias contas e CLIs.

Não envie projetos confidenciais sem verificar as regras do provedor. Remova segredos dos arquivos e revise o contexto da conversa.

Chaves, senhas e tokens não devem ser incluídos em mensagens ou arquivos usados como contexto. Quando um erro envolver autenticação, descreva apenas a mensagem recebida e o nome do provedor.

Para configurar um serviço, siga {doc}`provedores`. Para exemplos de tarefas, consulte {doc}`ferramentas`.
