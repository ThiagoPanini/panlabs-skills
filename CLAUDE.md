# panlabs-skills

## O código é em inglês, a prosa é português

**Todo artefato de código aqui é inglês** — nome de arquivo, nome de diretório, identificador, variável, função, comentário, e mensagem que o programa imprime. Idioma misto produz identificador híbrido (`checkEsquemaUnico`, `RAIZ`, `--conferir`), e aí a fronteira entre os dois idiomas deixa de morar numa camada e passa a morar em cada assinatura.

**Prosa não é código.** Mensagem de commit, ticket, PR, ADR, este arquivo e `docs/agents/` são português.

Escapa uma coisa só: **interface alheia, grafada como o dono a grafa.**

> **A dívida da `panlabs-aws-diagrams` foi paga, e o que ela ensinou fica.** A árvore nasceu mista e foi convertida inteira pelo [#53](https://github.com/ThiagoPanini/panlabs-skills/issues/53): 145 caminhos renomeados, as 165 chaves dos quatro contratos, os enums, os ids do corpus, as flags de linha de comando e os identificadores do código. **A fronteira mora numa camada:** identificador é inglês — chave de contrato inclusive —, e a prosa que explica continua portuguesa, o que vale para o `SKILL.md`, para o `guide/` e para as `description` dentro dos próprios esquemas. A lição que sobrou é que uma conversão dessas não é achar-e-trocar: chave de contrato tem **duas pontas**, quem escreve e quem lê, e converter uma só produz um verde que mente — o motor montou um grafo com id nulo por exatamente isso.

## Markdown não leva quebra de linha rígida

**Parágrafo, item de lista e citação são cada um UMA linha física**, por mais longos que fiquem. Não quebre prosa em 80, 90 ou qualquer coluna.

A quebra gravada no arquivo não aparece para quem lê — o renderizador rearranja tudo de novo. Ela só aparece nas duas horas em que atrapalha: quando alguém vai **editar a frase** e quando alguém vai **ler o diff**, onde um ajuste de uma palavra repinta o parágrafo inteiro de vermelho e verde e esconde o que de fato mudou.

Vale para todo `.md` deste repo **e para corpo de issue, comentário e PR** — o mesmo texto, o mesmo problema. Bloco de código, tabela, título e regra horizontal não são prosa: ficam exatamente como estão.

## Sessões paralelas — leia antes da primeira escrita

Várias sessões trabalham aqui ao mesmo tempo, um ticket cada. A doutrina inteira está em [`docs/agents/workflow.md`](docs/agents/workflow.md); estas quatro regras são as que você precisa **antes** de editar qualquer coisa.

- **Declare o território primeiro.** `gh issue edit <n> --add-assignee @me`, e um comentário com os caminhos que o ticket **possui** e os que ele só **acrescenta**. Dois tickets cujas posses se cruzam não rodam ao mesmo tempo — pegue outro ticket.
- **Rode a união antes de aterrissar.** Compare o seu diff com o que entrou na `origin/main` enquanto você trabalhava — os dois `git diff --name-only` estão em [`docs/agents/workflow.md`](docs/agents/workflow.md). O git só reprova uma das quatro colisões de trabalho paralelo; as outras três mergeiam verdes, e essa comparação é o que as pega.
- **Registro é append-only.** `SKILL.md`, `tests/run.sh` e este arquivo são listas ordenadas — acrescente no **fim** da seção, nunca no meio.
- **Ticket que move ou apaga caminho rastreado roda sozinho** (rótulo `movimento-de-terra`). Nada mais aterrissa enquanto ele estiver aberto.

**Terminar é o código estar na `main`** — não numa branch, não num PR aberto: união verde → suíte da skill verde contra o rebase → `gh pr merge --squash` → o commit aparecendo em `git log origin/main`. A `main` local nunca recebe commit; ela só fast-forwarda.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `ThiagoPanini/panlabs-skills`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Parallel workflow

Território, a régua da união, e a aterrissagem na `main`. See `docs/agents/workflow.md`.

_(As três seções acima estão em inglês porque são gabaritos herdados. A prosa deste repo é português — ver `docs/agents/workflow.md`; traduzi-las é dívida conhecida.)_

## Skills — o que se espera antes de você escrever sob `skills/`

O portão mede toda skill deste repositório e não ensina nada antes de reprovar. [`docs/agents/skills.md`](docs/agents/skills.md) é o que vem antes: por que cada família de checagem existe e o estrago concreto que a motivou, e as regras que nenhuma delas consegue medir — a `description` que diz **quando** disparar, divulgação progressiva, escopo, portabilidade do `name`. Leia antes de criar uma skill, de editar um `SKILL.md`, ou de acrescentar uma regra nova.

A lista das regras vigentes não mora em documento nenhum: `scripts/check-skills.sh --list` imprime, `scripts/check-skills.sh` julga. Rode o segundo antes de abrir PR — a esteira roda o mesmo comando.
