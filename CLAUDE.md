# panlabs-skills

## Sessões paralelas — leia antes da primeira escrita

Várias sessões trabalham aqui ao mesmo tempo, um ticket cada. A doutrina inteira
está em [`docs/agents/workflow.md`](docs/agents/workflow.md); estas quatro regras
são as que você precisa **antes** de editar qualquer coisa.

- **Declare o território primeiro.** `gh issue edit <n> --add-assignee @me`, e um
  comentário com os caminhos que o ticket **possui** e os que ele só **acrescenta**.
  Dois tickets cujas posses se cruzam não rodam ao mesmo tempo — pegue outro ticket.
- **Rode a união antes de aterrissar.** `scripts/conferir-uniao.sh` compara o seu
  diff com o que entrou na `origin/main` enquanto você trabalhava. O git só reprova
  uma das quatro colisões de trabalho paralelo; as outras três mergeiam verdes, e é
  essa régua que as pega. (`scripts/conferir-uniao.prova.sh` prova que ela mede.)
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
