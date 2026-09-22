# Noodle

O marcador de horários do laboratório, em nipscern.com/noodle. Dois tipos de
enquete:

- **Reunião em grupo.** Quem organiza escolhe os dias e, se quiser, faixas de
  horário; manda um link; cada pessoa abre, escreve o nome e marca sim, se
  precisar ou não em cada opção. A melhor opção se destaca; quem organiza
  encerra a enquete, marca a escolhida, e todo mundo ganha um link para o
  Google Agenda ou um arquivo .ics.
- **Horários individuais.** Cada horário fica com uma pessoa só, como um
  atendimento de orientação: quem chega primeiro pega; a segunda tentativa no
  mesmo horário é recusada pelas regras, sem transação nenhuma, porque o
  documento da reserva tem o id do horário.

Faixas de horário têm duração fixa (15 a 120 minutos, ou outra) e um fuso
escolhido por quem cria, gravado na enquete; quem lê escolhe o fuso em que vê
os horários, e a escolha fica no navegador. Links na descrição e no lugar viram
clicáveis; o link da enquete sai por cópia, e-mail ou pelo compartilhar do
celular. O formulário de criar e a resposta ainda não salva ficam guardados no
navegador, e voltam depois de um reload. Comentários podem ser editados por quem
os escreveu, e passam a dizer que foram editados.

É um Doodle para vinte pessoas, não para vinte mil. Tudo abaixo foi escolhido
com isso em mente.

## Onde cada coisa vive

| O quê | Onde | Custo |
|---|---|---|
| A página e o código | `noodle.html`, `assets/js/noodle.js`, neste repositório, no GitHub Pages | zero |
| As enquetes, respostas, reservas e comentários | Cloud Firestore, num projeto Firebase do laboratório | plano Spark, zero |
| Login de quem organiza | Firebase Authentication, provedor Google | zero |
| Sessão de quem responde | Firebase Authentication, provedor anônimo | zero |
| O SDK do Firebase | CDN do Google (`www.gstatic.com/firebasejs`), carregado só nesta página | zero |

Não há servidor nosso. O navegador fala direto com o Firestore, e quem decide o
que cada pessoa pode ler e escrever são as regras em `docs/noodle.rules`.

### Por que fica grátis

O plano Spark do Firebase não pede cartão. Sem conta de faturamento ligada ao
projeto, o Google não tem de onde cobrar: quando uma cota do dia acaba, a
operação falha até o dia seguinte, e é só isso que acontece. Não mude o projeto
para o plano Blaze para "ter margem"; a margem vira fatura.

As cotas do Spark que interessam aqui, como estavam na página de preços quando
isto foi escrito (confira em firebase.google.com/pricing antes de confiar nos
números):

| Recurso | Cota diária |
|---|---|
| Leituras no Firestore | 50 mil |
| Escritas no Firestore | 20 mil |
| Exclusões no Firestore | 20 mil |
| Armazenamento | 1 GiB no total |
| Logins (Google e anônimo) | sem cobrança até 50 mil usuários ativos por mês |

Uma enquete com dez opções e vinte respostas custa umas quarenta leituras para
cada pessoa que a abre, porque a tabela se atualiza ao vivo. Cem aberturas por
dia são quatro mil leituras: menos de um décimo da cota.

## Ligar o Noodle: passo a passo

Leva uns quinze minutos. Tudo no console do Firebase, console.firebase.google.com,
com a conta do Google do laboratório (a que vai administrar; pode ser a sua).

1. **Criar o projeto.** "Adicionar projeto", nome `nipscern-noodle` (ou o que
   quiser). Desligue o Google Analytics quando ele oferecer: não precisamos, e
   é uma coisa a menos coletando.

2. **Criar o banco.** Menu Build, Firestore Database, "Criar banco de dados".
   Local: `eur3` (Europa) ou `southamerica-east1` (São Paulo); qualquer um serve,
   e depois de criado não muda. Modo: **produção**. Nesse modo o banco nasce
   fechado, e o próximo passo abre exatamente o que precisa.

3. **Colar as regras.** Na aba Regras do Firestore, apague o que estiver lá,
   cole o conteúdo inteiro de `docs/noodle.rules` e publique. Sem este passo
   nada funciona, e é assim que tem de ser.

4. **Ligar os dois logins.** Menu Build, Authentication, "Começar". Na aba
   Sign-in method, ative **Google** (ele pede um e-mail de suporte: use o do
   laboratório) e ative **Anônimo**. Nada mais.

5. **Autorizar o domínio.** Ainda em Authentication, aba Settings, "Domínios
   autorizados": adicione `www.nipscern.com` e `nipscern.com`. O `localhost` já
   está lá, e é o que permite testar com `npm run dev`.

6. **Registrar o app web e copiar a configuração.** Engrenagem, Configurações
   do projeto, seção "Seus apps", ícone `</>`. Apelido `Noodle`, sem Firebase
   Hosting. Ele mostra um objeto `firebaseConfig`. Copie `apiKey`, `authDomain`,
   `projectId` e `appId` para o bloco `window.NOODLE_FIREBASE` no `<head>` de
   `noodle.html`, no lugar dos `REPLACE-ME`. Os outros campos que o console
   mostra não são usados.

   Esses valores são identificadores públicos: o Firebase os desenha para
   ficarem no código do site, e a proteção dos dados são as regras, não a
   chave. Mesmo assim, não os cole em chat nem em issue; ficam no arquivo.

7. **Publicar.** Commit e pull request como qualquer mudança do site. O hook
   carimba o `?v=` dos assets novos sozinho.

Depois disso, abra nipscern.com/noodle, entre com o Google e crie uma enquete
de teste. Se o botão "Criar enquete" devolver "sem permissão", veja a seção
sobre a lista de acesso logo abaixo.

## Quem pode criar enquetes

Como está, qualquer conta do Google com e-mail verificado cria enquetes. Para
um laboratório isso costuma bastar: a página não é anunciada e uma enquete
alheia não encosta nas nossas. Se quiser fechar, crie no Firestore, pelo
console, o documento `config/access` (coleção `config`, id `access`) com um dos
campos, ou os dois:

| Campo | Tipo | Exemplo |
|---|---|---|
| `emails` | array de string | `fulano@cern.ch`, `beltrana@gmail.com` |
| `domains` | array de string | `cern.ch`, `ufjf.br`, `estudante.ufjf.br` |

Com o documento presente, só quem casa com uma das listas cria. A comparação
de domínio é exata: `ufjf.br` não cobre `estudante.ufjf.br`, e é por isso que
o exemplo lista os dois. Ninguém do lado do cliente lê este documento; as regras
o consultam por dentro.

Responder e comentar continuam livres para quem tiver o link, como no Doodle.
É o que faz um convidado de fora do laboratório conseguir responder.

## O que é seguro aqui, e o que não é

O que as regras garantem, independentemente do que o navegador faça:

- Uma enquete só é criada por conta do Google com e-mail verificado (e, com
  `config/access`, só pelas contas listadas).
- Só a dona altera ou apaga a enquete. Dona, data de criação e opções não
  mudam depois de criadas.
- Cada pessoa escreve só na própria resposta: o documento tem o uid da sessão
  dela, e ninguém escreve num uid que não é o seu.
- Um horário individual tem uma reserva só: o documento tem o id do horário,
  criar só existe enquanto ele não existe, e atualizar ninguém pode. A própria
  pessoa devolve; a dona apaga qualquer uma. O limite de uma reserva por pessoa
  é do cliente, não da regra; a dona corrige pelo painel se alguém contornar.
- Enquete encerrada, ou com prazo vencido, não aceita resposta nem comentário.
  O relógio que vale é o do servidor.
- Tamanhos têm teto: título 120, descrição 2000, nome 60, comentário 1000,
  sessenta opções por enquete. Campos fora da lista são recusados.
- Listar enquetes só devolve as da própria conta. Abrir uma, qualquer pessoa
  com o id consegue: o id tem vinte caracteres aleatórios e é o próprio segredo
  do link, exatamente como no Doodle.

O que fica a cargo de quem administra:

- **Restringir a chave da API ao nosso domínio.** No console do Google Cloud
  (console.cloud.google.com, mesmo projeto), APIs e serviços, Credenciais,
  "Browser key (auto created by Firebase)". Em restrições de aplicativo,
  referenciadores HTTP: `https://www.nipscern.com/*`, `https://nipscern.com/*`
  e `http://localhost:3000/*`. Em restrições de API, deixe só Identity Toolkit
  API, Token Service API e Cloud Firestore API. Isso impede que a chave seja
  usada de outro site. Teste depois: se o login parar, foi um referenciador
  faltando.
- **A tela de consentimento do Google.** O Firebase a cria. Se o login mostrar
  "app não verificado" ou recusar contas que não estão numa lista de teste, vá
  em APIs e serviços, Tela de consentimento OAuth, e publique o app. Com os
  escopos básicos (e-mail e perfil) o Google não pede verificação.
- **Limpar sessões anônimas.** Cada pessoa que responde ganha um usuário
  anônimo. Em Authentication, Settings, há uma opção para apagar contas
  anônimas antigas automaticamente; ligue-a com trinta dias. Quem tiver a conta
  apagada perde só a capacidade de editar a resposta antiga; a resposta fica.
- **Backup.** O Spark não tem backup automático. Uma enquete perdida é uma
  enquete refeita; se um dia isso doer, o console exporta a coleção à mão.

## Fuso horário

Juiz de Fora e Genebra têm quatro ou cinco horas de diferença conforme o horário
de verão europeu. Uma faixa de horário é gravada como instante (ISO em UTC),
junto com o fuso de quem criou, e cada pessoa a vê no próprio fuso: quem cria
"14:00" em Genebra é lido como "09:00" ou "10:00" em Juiz de Fora, e a página
diz em que fuso está mostrando. Uma opção de dia inteiro é só uma data, e uma
data não se converte.

## Privacidade

O Noodle guarda o que a pessoa digita: um nome, as marcações e, se ela quiser,
um comentário. Isso é dado pessoal, e a política de privacidade do site diz hoje
que o site não coleta nenhum. Antes de divulgar a ferramenta, acrescente um
parágrafo à `privacy.html` (chaves `legal.privacy.*` em `data/i18n.json`, nas
quatro línguas). Uma redação de partida, em português:

> **Noodle.** Ao responder a uma enquete em nipscern.com/noodle, o nome que você
> digita e as suas marcações são guardados no Cloud Firestore, um serviço do
> Google, junto com um identificador de sessão anônimo que permite a você editar
> a própria resposta depois. Quem entra com a conta do Google tem também o nome,
> o identificador e o endereço da foto dessa conta guardados, e a foto aparece ao
> lado do nome para os outros participantes. Nada disso é usado para
> outra finalidade. Quem organiza pode apagar a enquete inteira a qualquer
> momento, e você pode apagar a sua resposta. O Google processa esses dados como
> operador; veja a política de privacidade do Firebase.

## Testar localmente

`npm run dev` e abra `http://localhost:3000/noodle`. O `localhost` já é um
domínio autorizado no Firebase, então o login do Google funciona daí. Use
`localhost`, não `127.0.0.1`: o segundo não está na lista e o login recusa.

## O mascote

O espaguete de Kise1ki, do Flaticon, na licença gratuita que pede atribuição;
o crédito está em `credits.html`, na seção de imagens. O arquivo é
`assets/images/noodle/mascot.webp`, WebP sem perda (19 KB) a partir do PNG
original de 512 px, exibido a 220 pontos no desktop e 160 no celular.

## O que não existe (ainda)

- Acrescentar opções depois de criada. As regras proíbem de propósito: as
  respostas e as reservas apontam para os ids das opções. Crie outra enquete.
- Mudar o tipo (grupo ou individual) depois de criada, pela mesma razão.
- Aviso por e-mail quando alguém responde, e lembrete automático a quem não
  respondeu. Não há servidor nem remetente; a tabela se atualiza ao vivo para
  quem estiver com a página aberta. Se um dia fizer falta, um Worker do
  Cloudflare com o Email Service faz isso de graça.
- Ligar a agenda de quem organiza para ver conflitos. Pediria acesso ao
  calendário do Google da pessoa, que é mais do que o Noodle precisa saber.
- Limite de vagas por opção, esconder respostas dos outros, enquetes de texto
  livre. Cabem, se fizerem falta.
- A versão do SDK está fixada em `noodle.js` (`FB_VERSION`). Subir de versão é
  trocar o número e testar login e escrita.
