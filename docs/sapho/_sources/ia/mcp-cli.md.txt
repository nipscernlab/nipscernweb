# Usar Claude Code e ChatGPT via Codex CLI

Claude Code e ChatGPT via Codex CLI podem ser usados como provedores de assinatura dentro da Aurora Intelligence. A autenticação é feita no CLI de cada serviço. A AURORA inicia o provedor selecionado e disponibiliza ferramentas controladas para que ele consulte ou opere o projeto.

## Como a AURORA encontra os CLIs

A AURORA procura o executável nesta ordem:

1. Cache sob demanda em `userData\cli-cache`.
2. Dependência local instalada com a aplicação.
3. Executável disponível no `PATH` do Windows.

O manifesto atual fixa Claude Code em `2.1.196` e Codex em `0.131.0`. Quando o CLI não está no cache, a AURORA pode baixar o pacote previsto pelo manifesto e reutilizá-lo nas próximas execuções.

## Preparar o Claude Code

1. Execute `claude login` no terminal.
2. Confirme com `claude --version`.
3. Reinicie a AURORA se o login ou instalação tiver ocorrido enquanto ela estava aberta.
4. Selecione Claude Code em **Configurações da AURORA → Assistente IA**.

O login fica em `~\.claude\.credentials.json`. Se `claude --version` não for reconhecido no terminal, a AURORA ainda pode usar o cache sob demanda ou a dependência local; use o terminal principalmente para concluir login e diagnosticar credenciais.

## Preparar o ChatGPT via Codex CLI

1. Execute `codex login` no terminal.
2. Confirme com `codex --version`.
3. Reinicie a AURORA se o login ou instalação tiver ocorrido enquanto ela estava aberta.
4. Selecione ChatGPT em **Configurações da AURORA → Assistente IA**.

O Codex usa `CODEX_HOME\auth.json` quando `CODEX_HOME` está definido, ou `~\.codex\auth.json` no padrão. A AURORA não comprova que essa conta seja a mesma sessão do ChatGPT no navegador.

## Durante a conversa

A AURORA fornece ao CLI ferramentas controladas para consultar e operar o projeto. Alterações continuam sujeitas às confirmações exibidas pela interface.

Ao criar uma nova conversa, o contexto começa limpo. Informe novamente o objetivo e os arquivos relevantes. Ao continuar uma conversa existente, a AURORA tenta retomar a sessão anterior e preservar o encadeamento do trabalho.

Mesmo quando o CLI possui recursos próprios de execução, use as confirmações exibidas pela AURORA como limite operacional. Revise o nome da ação, os argumentos e os arquivos antes de autorizar.

## Problemas comuns

**CLI não encontrado**
: Verifique se o download sob demanda conseguiu gravar em `userData\cli-cache`, se a dependência local está presente ou se o executável está no `PATH`.

**Login expirado**
: Execute novamente `claude login` ou `codex login`.

**Conversa antiga não retoma**
: Inicie uma nova conversa e repita o contexto necessário.

**Ferramenta não responde**
: Confirme que a janela principal continua aberta e reinicie a conversa.

**Modelo explícito não é aceito**
: Selecione **Default** para usar a opção compatível com a conta.
