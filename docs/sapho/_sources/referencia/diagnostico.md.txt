# Solução de problemas

Use esta página para localizar a etapa que falhou antes de alterar configurações ou reinstalar ferramentas. Um diagnóstico eficiente registra o contexto, reproduz uma única ação e começa pela primeira mensagem de erro.

## Comece por aqui

1. Salve todos os arquivos.
2. Confira projeto, processador, Top Level, Testbench Top e simulador na barra de status.
3. Repita apenas a ação que falhou.
4. Leia a primeira mensagem de erro no terminal correspondente.
5. Ative **verbose** somente se precisar de mais detalhes.

Anote o resultado esperado e o que realmente aconteceu. Essa comparação evita descrições genéricas como “não funciona” e ajuda a decidir se a falha está na interface, na configuração do projeto, na compilação ou no testbench.

## Interface

**Um botão está desabilitado**
: Abra o arquivo esperado e confirme Top Level ou Testbench Top. Veja {doc}`../uso/interface`.

**O editor não carrega**
: Feche e abra a AURORA. Se continuar, reinicie o Windows e repita a abertura.

**Um arquivo mudou fora da AURORA**
: Escolha conscientemente entre a versão do disco e a versão do editor.

## Compilação

**Top Level não encontrado**
: Confirme o módulo principal e inclua suas dependências.

**Módulo duplicado**
: Remova uma das fontes que declaram o mesmo módulo.

**A geração C± não atualiza o hardware**
: Salve o `.cmm`, confirme o processador ativo e execute C± novamente.

**O cancelamento demora**
: Aguarde alguns segundos para que processos auxiliares sejam encerrados.

Depois de uma falha de compilação, não use arquivos antigos em `Hardware` como evidência de sucesso. Verifique a data de atualização e confirme que o terminal da execução atual terminou corretamente.

## Simulação e ondas

**Testbench não inicia**
: Confirme Testbench Top, clock, reset e nomes de módulos.

**Nenhum arquivo de onda**
: Confirme que o testbench terminou e possui sinais configurados para dump.

**Viewer de ondas abre sem sinais**
: Volte o layout para **padrão**, revise a **Configuração de Ondas** e gere novamente.

**O cocotb não encontra um sinal**
: Compare o nome usado no Python com as portas reais do módulo.

Se a simulação não termina, confira se o testbench possui uma condição de encerramento. Use **Cancelar** antes de iniciar outra execução.

## PRISM

Execute **Verilog** antes do PRISM. Corrija primeiro erros de módulo ausente, módulo duplicado e Top Level incorreto.

Se o Verilog está válido, mas o diagrama continua desatualizado, salve os arquivos e use **Recompile** na janela do PRISM.

## Aurora Intelligence

**Chave salva, mas a conexão falha**
: Confirme conta, modelo, rede e permissões do provedor.

**Ollama não detecta modelos**
: Confirme que `ollama serve` está ativo e use `http://localhost:11434/v1`.

**Claude Code ou ChatGPT via Codex CLI não conecta**
: Execute novamente o login, confirme `--version` e reinicie a AURORA.

## Pedir suporte

Inclua:

- Versão da AURORA e do Windows.
- Ação exata que falhou.
- Resultado esperado e observado.
- Saída exportada do terminal.
- Projeto mínimo sem dados confidenciais.

Inclua apenas o necessário para reproduzir o problema. Remova chaves, dados pessoais e arquivos que não participam do fluxo. Quando possível, descreva uma sequência curta de passos que leve ao mesmo resultado.

