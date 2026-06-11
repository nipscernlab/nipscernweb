# Contribuindo / Contributing

*English below.*

## Como funciona

O site **nipscern.com** é mantido pelo Laboratório NIPSCERN (UFJF). Somente
membros da organização têm acesso de escrita; contribuições externas são
bem-vindas via **pull request** e passam por revisão e aprovação dos membros
antes de entrar no projeto.

Ao contribuir, você concorda com a seção 4 da [Licença NIPSCERN](LICENSE.md).

## Regras práticas

1. **Nada acima de 2 MB neste repositório.** O CI bloqueia automaticamente.
   Mídias pesadas (PDFs, vídeos, imagens grandes) vivem no repositório
   [nipscern-assets](https://github.com/nipscernlab/nipscern-assets) e são
   servidas em `cdn.nipscern.com`.
2. **Otimize mídia antes de enviar**: use `tools/optimize-media.ps1`
   (funções para PDF, imagem e vídeo, com os parâmetros padrão do site).
3. **Imagens novas**: WebP, largura máxima 2560 px, com `loading="lazy"` e
   dimensões explícitas quando abaixo da dobra.
4. **Não toque** em `workers/` sem combinar antes: esses arquivos espelham
   Workers ativos no Cloudflare.
5. Issues e PRs podem ser escritos em português ou inglês.

## Estamos contratando

O NIPSCERN busca pesquisadores em lógica, filosofia, engenharia de software,
engenharias, programação e design. Entre em contato pelo site.

---

## How it works

The **nipscern.com** website is maintained by the NIPSCERN Laboratory (UFJF).
Only organization members have write access; external contributions are
welcome via **pull request** and go through member review and approval before
entering the project.

By contributing, you agree to section 4 of the [NIPSCERN License](LICENSE.md).

## Practical rules

1. **Nothing above 2 MB in this repository.** CI blocks it automatically.
   Heavy media (PDFs, videos, large images) live in the
   [nipscern-assets](https://github.com/nipscernlab/nipscern-assets)
   repository and are served from `cdn.nipscern.com`.
2. **Optimize media before submitting**: use `tools/optimize-media.ps1`.
3. **New images**: WebP, max width 2560 px, with `loading="lazy"` and
   explicit dimensions when below the fold.
4. **Do not touch** `workers/` without prior discussion: those files mirror
   live Cloudflare Workers.
5. Issues and PRs may be written in Portuguese or English.

## We are hiring

NIPSCERN is looking for researchers in logic, philosophy, software
engineering, engineering disciplines, programming and design. Reach out
through the website.
