# Configurar o provedor de IA

O provedor determina qual serviço processará as mensagens da Aurora Intelligence. Esta página explica os requisitos de cada opção e como confirmar a conexão antes de utilizar ferramentas no projeto.

Abra **Configurações da AURORA → Assistente IA**.

```{figure} ../_static/screenshots/aurora-settings-ai-current.png
:alt: Configurações do Assistente IA com cartões de provedores, modelos e campos de chave.
:width: 90%
:align: center

Cada cartão reúne o modelo, a credencial e os botões para salvar e testar o provedor. Nunca publique uma captura com uma chave preenchida.
```

## Escolher uma opção

| Tipo | Opções | Requisito |
|---|---|---|
| API em nuvem | OpenAI, Anthropic, Google, DeepSeek e Groq | Chave de API e modelo válido. |
| Local | Ollama | Ollama iniciado e modelo instalado. |
| Assinatura por CLI | Claude Code e ChatGPT via Codex CLI | Login concluído no CLI correspondente. |

## Provedor por API

1. Abra o cartão do provedor.
2. Cole a chave de API.
3. Escolha ou informe o modelo.
4. Clique em **Save**.
5. Clique em **Test connection**.

Depois de salvar, o campo da chave pode ficar vazio. Isso não significa que a chave foi perdida.

O teste deve confirmar que a credencial, o endereço do serviço e o modelo são aceitos. Se a conexão funcionar, inicie uma conversa curta e peça apenas uma explicação antes de autorizar ações no projeto.

:::{warning}
As chamadas podem gerar cobrança na conta do provedor. Consulte limites e preços no serviço escolhido.
:::

## Ollama

Instale e inicie o Ollama fora da AURORA. Exemplo:

```powershell
ollama pull llama3.1:8b
ollama serve
```

na AURORA:

1. Informe `http://localhost:11434/v1` como URL.
2. Clique em **Detect models**.
3. Selecione o modelo.
4. Teste a conexão.

Se o modelo responde, mas não consegue executar ações, escolha um modelo com melhor suporte a ferramentas. Modelos locais variam em memória necessária, velocidade e capacidade de seguir estruturas de chamadas; selecione uma opção compatível com o computador utilizado.

## Claude Code

A AURORA usa o Claude Code CLI para este provedor. O executável pode ser encontrado no cache sob demanda em `userData\cli-cache`, na dependência local da aplicação ou no `PATH` do Windows. A versão pinada no manifesto atual é `2.1.196`.

Para autenticar:

```powershell
claude login
claude --version
```

Depois, selecione Claude Code na AURORA e inicie uma conversa. Se o CLI ainda não estiver cacheado, a AURORA pode baixar o pacote previsto pelo manifesto. O login continua sendo responsabilidade do CLI e usa as credenciais locais em `~\.claude\.credentials.json`.

## ChatGPT via Codex CLI

A opção **ChatGPT** usa o Codex CLI local. O executável pode ser encontrado no cache sob demanda em `userData\cli-cache`, na dependência local da aplicação ou no `PATH` do Windows. A versão pinada no manifesto atual é `0.131.0`.

Para autenticar:

```powershell
codex login
codex --version
```

Depois, selecione ChatGPT na AURORA. Se um modelo específico falhar, use a opção **Default**.

O Codex CLI usa `CODEX_HOME\auth.json` quando `CODEX_HOME` está definido, ou `~\.codex\auth.json` no caso padrão. A AURORA não garante que essa conta seja a mesma conta aberta no navegador.

## Se o teste falhar

- Confirme a chave, conta e modelo.
- Verifique conexão, proxy e firewall.
- Para Ollama, confirme que `ollama serve` está ativo.
- Para Claude Code ou Codex, refaça o login no CLI correspondente.
- Se o CLI foi instalado ou autenticado fora da AURORA, reinicie a aplicação para atualizar o ambiente.
- Se o cache sob demanda falhar, verifique conexão com o registro npm e permissões de escrita no perfil do usuário.

Leia a mensagem apresentada pelo teste antes de trocar várias configurações. Erros de autenticação, modelo inexistente, serviço indisponível e bloqueio de rede exigem correções diferentes.
