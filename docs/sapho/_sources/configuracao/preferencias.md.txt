# Configurações do aplicativo

Abra **Configurações da AURORA** pela barra superior.

As configurações controlam a apresentação da interface, o nível de detalhes dos terminais e as integrações de IA. Faça uma alteração por vez e confirme o efeito antes de continuar, principalmente ao ajustar opções usadas em diagnóstico.

```{figure} ../_static/screenshots/aurora-settings-general-current.png
:alt: Janela Configurações da AURORA na seção Geral.
:width: 90%
:align: center

As categorias ficam no menu lateral. A seção **Geral** controla as dicas exibidas ao passar o cursor sobre a interface.
```

## Geral

**Idioma**
: Altera a interface e as mensagens geradas pela toolchain.

**Tooltips**
: Exibe explicações curtas ao posicionar o cursor sobre controles.

Ative tooltips enquanto estiver aprendendo a interface.

Depois de se familiarizar com os controles, você pode desativá-los para reduzir elementos sobrepostos. A alteração afeta apenas as dicas visuais; ela não modifica o projeto.

## Aparência

Altere ou restaure o ícone da aplicação, quando a opção estiver disponível. A versão atual não expõe um seletor geral de tema nessa seção.

## Terminal

Ative **verbose** quando precisar de detalhes para diagnóstico. Esse modo pode exibir comandos, caminhos e etapas auxiliares que ajudam a localizar a origem de uma falha. No uso normal, mantenha-o desativado para destacar as mensagens principais.

## Atalhos

Consulte {doc}`../referencia/atalhos` para os atalhos confirmados nesta versão.

```{figure} ../_static/screenshots/aurora-settings-shortcuts.png
:alt: Seção Atalhos de Teclado nas configurações da AURORA.
:width: 90%
:align: center

Clique em uma combinação para redefini-la. Pressione `Esc` para cancelar a gravação de um novo atalho.
```

## AI Assistant

Configure chaves, modelos, Ollama, Claude Code e ChatGPT via Codex CLI. Veja {doc}`../ia/provedores`.

Depois de configurar um provedor, use o teste de conexão antes de iniciar uma tarefa no projeto. Não inclua chaves ou tokens nas mensagens da conversa.

## About e atualização

Use **About** para conferir a versão instalada. Essa informação deve acompanhar relatórios de problema. Quando houver atualização disponível, leia as notas, salve os arquivos e faça backup do projeto antes de instalar.

## Zoom e janela

Os controles da barra permitem minimizar, maximizar, fechar e ajustar o zoom. O PRISM possui controles equivalentes em sua própria janela.

O zoom altera a escala da interface, não o conteúdo dos arquivos. Ajuste-o quando painéis ou textos não couberem adequadamente na janela.
