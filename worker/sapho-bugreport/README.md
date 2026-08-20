# sapho-bugreport

Recebe o relato de problema enviado de dentro da AURORA (painel Relatar um
problema) e abre uma issue em `nipscernlab/sapho-relatos`, que e privado
justamente porque um relato pode conter dado pessoal.

## Por que existe

Abrir issue exige token, e token embutido num aplicativo distribuido e token
publicado. Aqui o token vive no Worker, e a AURORA so conhece um endereco
publico. Endereco publico qualquer um chama, e por isso quem protege e este
Worker limitando tamanho e frequencia, nunca o segredo do endereco.

## Implantar

    npx wrangler deploy --config worker/sapho-bugreport/wrangler.toml

## O segredo

O token nao mora no wrangler.toml. Ele e um fine-grained token do GitHub com
Issues (write) APENAS no repositorio de destino:

    npx wrangler secret put GITHUB_TOKEN --config worker/sapho-bugreport/wrangler.toml

## Rotas

`www.nipscern.com/api/sapho/bugreport` e o apex. As duas existem porque um
POST no apex responderia 301, e nem todo cliente segue redirect.

## Limite de frequencia

Tres relatos por cinco minutos por IP, no KV `BUGREPORT_KV`. O IP nunca e
guardado: vira hash com sal do dia, que expira sozinho em minutos e nunca
entra na issue (LGPD).
