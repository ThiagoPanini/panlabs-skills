# panlabs-skills

Onde moram as agent skills desta casa, e o portão que mede se cada uma está bem construída. O vocabulário — checagem de invocação, validação de desenvolvimento, portão de estrutura, família, prova, regra de sessão, workbench — está em `CONTEXT.md`, e é o que se usa aqui.

## O reconhecimento sai da janela

A implementação começa **delegando o reconhecimento a um subagente `Explore`** e agindo sobre o **digest** que ele devolve, com teto declarado. O digest é o orçamento de leitura: o que ele nomeia se lê em fatia estreita, o resto fica de fora. O schema, a ordem e o checklist de aterrissagem estão em `.claude/context-economy-protocol.md` — o hook injeta esse arquivo quando `/implement` começa, e ele vale igual para a sessão que chega a escrever código por outro caminho.

Medido em 133 sessões deste repositório (2026-09-12): explorar dentro da própria janela leva a primeira escrita a **125k tokens** de mediana — 35k de `Read` e `Bash` crus, 47k do raciocínio nos 54 turnos que os orquestram, 46k de baseline. A primeira sessão sob o protocolo, a do #240, chegou lá com 105k em 48 turnos; a irmã do #239, sem ele, com 233k em 80. Uma sessão típica lia `workflow.md` inteiro (24 kB), os dois `SKILL.md` (18 e 35 kB), os dois `workbench/<skill>/tests/run.sh` (24 e 35 kB) e a spec inteira (28 a 41 kB) antes da primeira linha. Nenhum deles é leitura de implementação: cada ticket é autocontido, e a seção certa custa um décimo do arquivo.

## Onde perguntar antes de procurar

Leia a **seção**, não o arquivo. A tabela saiu do que as sessões de fato abriram antes da primeira edição, não dos cabeçalhos dos documentos.

| Pergunta | Onde |
| --- | --- |
| O que declarar no ticket antes da primeira escrita, e o que «posse» e «acréscimo» permitem | `docs/agents/workflow.md` § Território declarado antes da primeira escrita |
| Como rodar a união — os dois `git diff --name-only` e o que o cruzamento significa | `docs/agents/workflow.md` § A tese: ninguém roda a união |
| Nome de branch, de worktree, e um commit por ticket | `docs/agents/workflow.md` § Um ticket, um worktree, uma branch |
| Os seis passos de aterrissar na `main`, e por que `--delete-branch` falha | `docs/agents/workflow.md` § A aterrissagem |
| Conflito num manifesto, num render ou em qualquer derivado | `docs/agents/workflow.md` § Derivado não se mergeia, se regenera |
| Onde acrescentar linha em `SKILL.md`, em `workbench/<skill>/tests/run.sh` e neste arquivo | `docs/agents/workflow.md` § Registro é append-only |
| Ticket que move ou apaga caminho rastreado | `docs/agents/workflow.md` § Movimento de terra roda sozinho |
| O que o portão mede, e por que cada família existe | `scripts/check-skills.sh --list`, depois `docs/agents/skills.md` § Por que cada família existe |
| A `description` que dispara, divulgação progressiva, escopo, `name` | `docs/agents/skills.md` § O que nunca virou checagem |
| Regra nova: estrutura ou sessão? | `docs/agents/skills.md` § Quando você acrescentar uma regra, e `docs/adr/` |
| Como falar com o tracker, e as operações de wayfinding | `docs/agents/issue-tracker.md` |
| Por que uma decisão é o que é | `docs/adr/` |
| O que um termo significa aqui | `CONTEXT.md` § Vocabulário |

**No código, o índice é o cabeçalho.** 168 dos 169 arquivos de código deste repositório — `.py`, `.cjs` e `.sh` sob `skills/`, `workbench/` e `scripts/` — abrem com um comentário que declara a responsabilidade do arquivo e o ticket que o moldou; o único que não abre é o bundle vendorizado do ELK. `head -30` neles localiza mais barato do que `grep`, e muito mais barato do que ler. Os `workbench/<skill>/tests/run.sh` guardam no cabeçalho a ordem das camadas e o que cada uma mede: leia o cabeçalho, rode o script, e não leia o corpo.

## O código é em inglês, a prosa é português

**Todo artefato de código aqui é inglês** — nome de arquivo, diretório, identificador, comentário, e mensagem que o programa imprime. Idioma misto produz identificador híbrido, e aí a fronteira entre os dois idiomas passa a morar em cada assinatura. **Prosa não é código**: commit, ticket, PR, ADR, este arquivo e `docs/agents/` são português. Escapa uma coisa só: **interface alheia, grafada como o dono a grafa.**

A fronteira mora numa camada, chave de contrato inclusive; a `description` dentro de um esquema continua portuguesa. A dívida da `panlabs-aws-diagrams` foi paga no #53, e a lição que ficou: chave de contrato tem **duas pontas**, quem escreve e quem lê, e converter uma só produz um verde que mente.

## Markdown não leva quebra de linha rígida

**Parágrafo, item de lista e citação são cada um UMA linha física**, por mais longos que fiquem. A quebra gravada só aparece nas duas horas em que atrapalha: ao editar a frase e ao ler o diff. Vale para todo `.md` deste repo **e para corpo de issue, comentário e PR**. Bloco de código, tabela, título e regra horizontal ficam como estão.

## Sessões paralelas — as quatro regras antes da primeira escrita

Várias sessões trabalham aqui ao mesmo tempo, um ticket cada. A doutrina inteira está em `docs/agents/workflow.md`, e a tabela acima diz qual seção responde o quê.

- **Declare o território primeiro.** `gh issue edit <n> --add-assignee @me`, e um comentário com os caminhos que o ticket **possui** e os que ele só **acrescenta**. Posses que se cruzam não rodam ao mesmo tempo — pegue outro ticket.
- **Rode a união antes de aterrissar.** O git só reprova uma das quatro colisões; as outras três mergeiam verdes, e a comparação dos dois `git diff --name-only` é o que as pega.
- **Registro é append-only.** `SKILL.md`, `workbench/<skill>/tests/run.sh` e este arquivo são listas ordenadas — acrescente no **fim** da seção, nunca no meio.
- **Ticket que move ou apaga caminho rastreado roda sozinho** (rótulo `movimento-de-terra`). Nada mais aterrissa enquanto ele estiver em voo.

**Terminar é o código estar na `main`** — não numa branch, não num PR aberto: união verde → suíte da skill verde contra o rebase → `gh pr merge --squash` → o commit em `git log origin/main`. A `main` local nunca recebe commit; ela só fast-forwarda.

## Pegadinhas

- **`gh pr merge --delete-branch` falha aqui.** A flag troca o checkout para a `main`, ocupada pelo worktree principal, e falha *depois* de já ter mergeado. Mergeie sem a flag e apague a branch remota com `git push origin --delete <branch>`.
- **`gh pr create` não é idempotente.** A guarda é `gh pr list --head "$BRANCH" --state open`.
- **«Fecha #n» não fecha nada.** O GitHub só entende as keywords em inglês: ponha `Closes #n` no corpo do PR, ou feche o ticket à mão.
- **A tranca recusa o push, não só o merge.** Um commit que reprova `scripts/check-skills.sh` volta com `GH013` e não aterrissa nada; um PR vermelho fica `BLOCKED`, sem bypass para ninguém.
- **A suíte de uma skill roda sozinha na máquina.** Dois renders headless ao mesmo tempo travam, e o `timeout` não mata os filhos do Electron.
- **Nenhum servidor roda a suíte de uma skill.** A esteira roda o portão e a prova dele, e só; `workbench/<skill>/tests/run.sh` é disciplina de sessão, contra o resultado do rebase.

## Ao compactar

Preserve o número do ticket e a branch, o território declarado, a lista dos arquivos já editados, e o estado da união e da suíte — o que ainda não rodou, e o que rodou vermelho. Descarte o conteúdo dos arquivos lidos; o caminho basta para reler a fatia.

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

O portão mede toda skill deste repositório e não ensina nada antes de reprovar. `docs/agents/skills.md` é o que vem antes: por que cada família de checagem existe e o estrago concreto que a motivou, e as regras que nenhuma delas consegue medir. Leia a seção que a tabela acima aponta antes de criar uma skill, de editar um `SKILL.md`, ou de acrescentar uma regra nova.

A lista das regras vigentes não mora em documento nenhum: `scripts/check-skills.sh --list` imprime, `scripts/check-skills.sh` julga. Rode o segundo antes de abrir PR — a esteira roda o mesmo comando.
