# THE ARCHITECT — Lacunas de Lógica (decisões)

> Documento de decisão. Ramos de lógica **não cobertos** pelos 57 textos do plano (Anos I–VI), já triados por profundidade.
> Próximo passo (pendente): alocar cada item IN a um ano de I–VI.

## Princípio: feasibility se resolve com *profundidade*, não com corte

O plano não fica viável cortando ramos — fica viável atribuindo **profundidade**. Vale o mecanismo que o plano já usa:

- ✅ **CORE** — à fronteira. É o **ramo filosófico**: decisão, paradoxos, temporal, deôntica/ética, princípios, linguagem, metalógica.
- ◆ **BREADTH** — sólido. É a **base formal** que dá segurança e capacidade de prova. Não é fim em si.
- ○ **CURIOSITY** — uma passada, para o mapa. Satisfaz o "quero ver toda a lógica" sem custo de domínio.
- ✕ **OUT** — fora (matemático demais, ou aplicado demais, ou histórico não-essencial).

Marcas auxiliares: 🎯 = núcleo do ramo do autor · ⚛ = tração no CERN/aplicado.

---

## ⚑ O insight que fecha "provar meus próprios teoremas"

Provar teoremas tem **dois lados**: o sintático (a prova) e o semântico (o modelo).
O plano **já tem o lado da prova** — Gentzen, Troelstra, dedução natural.
Falta o **lado semântico: teoria de modelos** (soundness, completude, compacidade, Löwenheim–Skolem). É *com isso* que se prova algo **sobre** uma lógica — exatamente o que um lógico filosófico faz ao inventar ou defender um sistema. **É a peça mais importante da base formal.**

---

## Contexto: viés ou mérito?

Selecionar pelo mérito e o resultado sair majoritariamente europeu **não é viés** — viés seria *excluir* trabalho de primeira que existe. Três precisões:

1. Os ramos que mais movem o plano têm centros não-europeus que ele já honra: paraconsistência brasileira (da Costa), deôntica jurídica argentina (Alchourrón–Bulygin).
2. O buraco real é antigo/medieval, e é mérito puro: Navya-Nyāya, Dignāga, syādvāda, Buridan ficaram de fora por acesso, não por qualidade.
3. Correção certa: **alargar a rede mantendo a régua alta**, não cota.

---

## Tier 1 — Casa filosófica → tudo ✅ CORE

- ✅ 🎯 **Charles Sanders Peirce** — abdução, lógica de relações, gráficos existenciais. **Inegociável.** *(Collected Papers; Hookway como porta.)*
- ✅ 🎯 **W. V. O. Quine** — "Two Dogmas", compromisso ontológico, holismo, *Philosophy of Logic*. **Inegociável.**
- ✅ 🎯 **Condicionais e contrafactuais** — **David Lewis, *Counterfactuals***; Stalnaker. A peça entre lógica e causalidade (Pearl).
- ✅ 🎯 **Intuicionismo como filosofia** — **Dummett, *The Logical Basis of Metaphysics*** (anti-realismo). O lado filosófico do que o plano só tem como cálculo (Curry–Howard, Troelstra).
- ✅ 🎯⚛ **Lógica temporal / tense logic — Arthur Prior** — futuros contingentes, determinismo. Na versão LTL/CTL, espinha da verificação (CERN).
- ✅ 🎯 **Lógica da provabilidade (GL) — Boolos, *The Logic of Provability*** — amarra Gödel + modal num nó.
- ✅ 🎯 **Revisão de crenças (AGM) — Alchourrón–Gärdenfors–Makinson (1985)** — o mesmo Alchourrón da deôntica, agora sobre como um agente racional muda de ideia.
- ✅ 🎯 **Relevância — Anderson–Belnap, *Entailment*** — rejeita os paradoxos da implicação material. Vizinhança direta da paraconsistência.

## Tier 2 — Metalógica e Filosofia *da* Lógica → tudo ✅ CORE

Onde "filosófica e não meramente formal" vira tese, não preferência.

- ✅ 🎯 **Pluralismo vs. monismo — Beall & Restall, *Logical Pluralism***. O terreno onde a paraconsistência se defende.
- ✅ 🎯 **Consequência lógica — Tarski, "On the Concept of Logical Consequence"** (≠ o paper da verdade) **+ Etchemendy**; **Bolzano** como raiz.
- ✅ 🎯 **Anti-excepcionalismo: a lógica é revisável? — Quine, Putnam ("Is Logic Empirical?"), Williamson.**
- ✅ **Susan Haack, *Philosophy of Logics* / *Deviant Logic*** — survey que amarra a lista; possível espinha do Ano VI.

## Tier 3 — Base formal → enxuto, ◆ BREADTH (a "segurança" para provar)

- ◆ ⚑ **Teoria de modelos** — *a peça que faltava* (ver insight acima). A mais importante da base.
- ◆ **Teoria dos conjuntos básica** — relações, funções, cardinalidade, ordinais, Zorn/escolha. A língua franca da prova.
- ◆ **Lógica de segunda ordem / ordem superior** — poder expressivo, a objeção de Quine. Mais filosófica do que parece.
- ○ **Computabilidade (só o essencial)** — Church–Turing, problema da parada, decidível/indecidível. A incompletude depende disso.
- ✕ **Fora:** matemática reversa; graus de Turing; teoria dos conjuntos avançada (*forcing*, grandes cardinais, hipótese do contínuo). Matemática pura.

## Tier 4 — Não-clássicas → profundidade variável

- ✅ 🎯 **Vagueza / sorites — Williamson (*Vagueness*); Fine (supervaluacionismo)** — é paradoxo, é o ramo.
- ◆ **Polivalentes (Łukasiewicz, Kleene), lógica livre, lógica de plurais (Boolos; Oliver–Smiley)** — o sistema, além do mapa que o Priest já deu.
- ○ **Fuzzy (Hájek); mereologia (Leśniewski / Simons)** — uma passada.

## Tier 5 — Decisão, indução, probabilidade → mais central do que parecia

"Lógica das decisões" é um pilar declarado do autor; logo, CORE.

- ✅ 🎯 **Teoria da decisão — Jeffrey, *The Logic of Decision*** (Savage como apoio). Pilar declarado.
- ✅/◆ 🎯 **Indução e confirmação — Goodman (*Fact, Fiction, and Forecast*, "grue") e Hempel (corvo) a CORE; Carnap a BREADTH.** Goodman é paradoxo puro.
- ◆ **Epistemologia formal bayesiana — Ramsey, de Finetti.**

## Tier 6 — Computacional → quase tudo ✕, uma exceção filosófica

- ○ **Lógica categórica / teoria de topos — Lawvere** — fundação *alternativa* da lógica; conversa com a HoTT e o Fong–Spivak do Ano VI.
- ◆ **Lógica linear — Girard** — *reclassificada do Tier 1*: vizinha da paraconsistência (SAPHO), fica como base sólida.
- ✕ **Fora (hoje):** resolução/SAT/SMT, lógica de programas (Hoare/separação), *description logics*, programação em lógica (Prolog). Voltam à mesa **só se** a contribuição do Ano VI for *aplicada* no CERN — aí entra uma camada mínima (model checking + temporal).

## Tier 7 — Histórico → ✕, brigando por *um*

- ○ 🎯 **Buridan, *insolubilia*** — o tratamento medieval do Mentiroso, **séculos antes** de Tarski e Kripke. Leitura única e curta; cai como luva no Ano VI de paradoxos.
- ✕ **Fora, sem dó:** Dignāga/Dharmakīrti, jainista (syādvāda), megáricos (Diodoro).

---

## Veredito de feasibility

Somando: ~**14 a CORE**, ~**7 a BREADTH**, ~**5 a CURIOSITY** ≈ **26 adições**.
Sobre os 57 atuais, a trilha de lógica vai de ~9,5 para ~14 textos/ano — aumento real de ~45%, **mas concentrado onde se quer profundidade**, e boa parte são *papers* ou leituras de mapa, não tratados. Com grupos de estudo, é **viável**.

> A ameaça à feasibility **não está na lógica — está na Cultura** (495 itens). Toda profundidade somada aqui terá de ser paga com mais CURIOSITY (mapa, não domínio) lá. Esse é o trade-off real.

### Piso inegociável (o que sobra se tudo apertar)

**Peirce · Quine · Teoria de modelos · Teoria da decisão · Prior · Lewis · Dummett · Pluralismo (Beall–Restall).**
Esqueleto do ramo filosófico + a capacidade de provar.

---

## Recomendação para a contribuição (Ano VI)

Caminho mais curto até uma contribuição real em lógica filosófica, nesta ordem:

1. **Vizinhança da paraconsistência** (relevância + linear) — separa contribuição de recombinação.
2. **Metalógica / filosofia da lógica** (Tier 2) — onde a tese se sustenta.
3. **Teoria de modelos** — a ferramenta para *demonstrar*. Sem ela, ensaio; com ela, resultado.
