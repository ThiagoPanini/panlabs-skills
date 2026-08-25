# panlabs-skills

## O código é em inglês, a prosa é português

**Todo artefato de código aqui é inglês** — nome de arquivo, nome de diretório,
identificador, variável, função, comentário, e mensagem que o programa imprime.
Idioma misto produz identificador híbrido (`checkEsquemaUnico`, `RAIZ`,
`--conferir`), e aí a fronteira entre os dois idiomas deixa de morar numa camada e
passa a morar em cada assinatura.

**Prosa não é código.** Mensagem de commit, ticket, PR, ADR, este arquivo e
`docs/agents/` são português.

Escapa uma coisa só: **interface alheia, grafada como o dono a grafa.**

> **Dívida conhecida, e ela é grande.** A árvore de `skills/panlabs-aws-diagrams/`
> nasceu mista — `tests/`, `tools/`, `catalog/`, `docs/` e `agents/` em inglês;
> `modelo/`, `motor/`, `sessao/`, `tema/`, `guia/` e `validador/` em português, com
> 81 dos 539 arquivos rastreados sob eles, mais os nomes portugueses dentro dos
> diretórios ingleses (`rodar.sh`, `check-arco.cjs`, `check-lacunas.cjs`). A regra
> **vale para código novo a partir de agora**; a conversão do que existe é um
> `movimento-de-terra` (ver `docs/agents/workflow.md`) e por isso roda sozinha,
> depois que a fila atual esvaziar.

## Sessões paralelas — leia antes da primeira escrita

Várias sessões trabalham aqui ao mesmo tempo, um ticket cada. A doutrina inteira
está em [`docs/agents/workflow.md`](docs/agents/workflow.md); estas quatro regras
são as que você precisa **antes** de editar qualquer coisa.

- **Declare o território primeiro.** `gh issue edit <n> --add-assignee @me`, e um
  comentário com os caminhos que o ticket **possui** e os que ele só **acrescenta**.
  Dois tickets cujas posses se cruzam não rodam ao mesmo tempo — pegue outro ticket.
- **Rode a união antes de aterrissar.** `scripts/check-union.sh` compara o seu
  diff com o que entrou na `origin/main` enquanto você trabalhava. O git só reprova
  uma das quatro colisões de trabalho paralelo; as outras três mergeiam verdes, e é
  essa régua que as pega. (`scripts/check-union.proof.sh` prova que ela mede.)
- **Registro é append-only.** `SKILL.md`, `tests/rodar.sh` e este arquivo são listas
  ordenadas — acrescente no **fim** da seção, nunca no meio.
- **Ticket que move ou apaga caminho rastreado roda sozinho** (rótulo
  `movimento-de-terra`). Nada mais aterrissa enquanto ele estiver aberto.

**Terminar é o código estar na `main`** — não numa branch, não num PR aberto: união
verde → suíte da skill verde contra o rebase → `gh pr merge --squash` → o commit
aparecendo em `git log origin/main`. A `main` local nunca recebe commit; ela só
fast-forwarda.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `ThiagoPanini/panlabs-skills`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Parallel workflow

Território, a régua da união, e a aterrissagem na `main`. See `docs/agents/workflow.md`.

_(As três seções acima estão em inglês porque são gabaritos herdados. A prosa deste
repo é português — ver `docs/agents/workflow.md`; traduzi-las é dívida conhecida.)_
