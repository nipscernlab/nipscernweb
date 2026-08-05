# Instalação e primeiro início

Esta página orienta a instalação da AURORA e a verificação inicial do ambiente. Ao final, a aplicação estará pronta para abrir ou criar um projeto.

## Requisitos

- Windows 10 ou Windows 11.
- Espaço para o aplicativo, os projetos e a toolchain.
- Permissão para gravar arquivos na pasta escolhida para os projetos.

## Baixar a AURORA

O instalador da versão solicitada está publicado na página da versão 6.2.0 do repositório da AURORA:

[Baixar a AURORA 6.2.0 nas Releases do GitHub](https://github.com/nipscernlab/aurora/releases/tag/v6.2.0)

Na página da versão, localize a seção **Assets** e baixe o instalador destinado ao Windows. Use exatamente essa versão quando estiver acompanhando um curso, laboratório ou projeto preparado para a AURORA 6.2.0.

## Instalar

1. Abra o instalador baixado em [AURORA 6.2.0 nas Releases do GitHub](https://github.com/nipscernlab/aurora/releases/tag/v6.2.0).
2. Siga as etapas apresentadas pelo instalador.
3. Abra a AURORA pelo menu Iniciar ou pelo atalho criado.
4. Aguarde a tela de abertura concluir a preparação do ambiente.
5. Abra **Configurações da AURORA → Sobre** e confira a versão instalada.

Na primeira execução, a preparação pode levar mais tempo porque a AURORA configura o ambiente de compilação. Quando a janela principal aparecer e responder aos comandos, a inicialização básica estará concluída.

## Confirmar que está pronto

Após iniciar, verifique:

1. A janela principal abriu sem permanecer na tela de carregamento.
2. **Novo Projeto** e **Abrir Projeto** estão disponíveis.
3. O editor aparece no centro da janela.
4. **Configurações da AURORA** abre normalmente.
5. A barra inferior indica que a aplicação está pronta.

Se esses itens estiverem corretos, siga para {doc}`primeiro-projeto` e escolha entre o fluxo Verilog e o fluxo de processador SAPHO.

## Se a AURORA não iniciar

1. Aguarde alguns segundos para confirmar que a preparação inicial não está apenas em andamento.
2. Verifique se outra janela da AURORA já está aberta.
3. Reinicie a aplicação pelo menu Iniciar.
4. Registre a versão do Windows e a etapa em que a abertura parou antes de solicitar suporte.

Consulte {doc}`../referencia/diagnostico` para uma investigação orientada por sintomas.

## Onde seus dados ficam

Você escolhe a pasta de cada projeto. Ela contém o arquivo `.spf`, os fontes e os arquivos gerados.

Preferências, projetos recentes, conversas da IA e outros dados da aplicação ficam no perfil do Windows. Esses dados facilitam a retomada da sessão, mas não substituem a pasta do projeto. Para fazer backup do trabalho, copie a pasta completa que contém o `.spf`, os fontes e os arquivos gerados; veja {doc}`../referencia/formatos`.
