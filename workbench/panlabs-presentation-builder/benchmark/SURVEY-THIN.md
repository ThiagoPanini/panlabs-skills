# A travessia pela entrada rala

**A mesma tese, e material nenhum.** O pedido inteiro foi uma frase — *«uma apresentação sobre o framework de skills do Matt Pocock para engenheiros que não o conhecem, vinte minutos»* —, sem brief, sem registro de dados, sem um número. É o outro extremo da [`SURVEY-RICH.md`](SURVEY-RICH.md), e o que ele existe para provar é que o turno 0 **não muda de forma** quando o material acaba: o mapa é o mesmo, as linhas é que vêm vazias, e é a coluna «o que a skill faz» que passa a trabalhar.

## O mapa de insumos, como saiu do primeiro bloco

| função | o que o material já dá | o que falta | o que a skill faz |
| --- | --- | --- | --- |
| `context` | que o assunto é um conjunto de skills, e que a plateia é de engenheiros que não o conhecem | o que o conjunto **é**, medido: quantas skills, em que categorias, o que se instala | **pesquisa** — o repositório é público |
| `tension` | nada | por que alguém precisaria disto; o que falha hoje sem ele | **pergunta** — é a única que a pesquisa não fecha, porque é sobre a sala e não sobre o repositório |
| `thesis` | nada | a reação que a apresentação quer provocar | **pergunta** |
| `evidence` | nada | todo número, e todo número com fonte primária e data | **pesquisa** — o repositório, a máquina, e as issues deste repositório |
| `plan` | nada | os comandos do fluxo principal, escritos como se digitam, e em que ordem | **pesquisa** |
| `call` | que são vinte minutos ao vivo | quem decide, e o que se pede na sala | **pergunta** |

**Quatro linhas com buraco, três pesquisas e três perguntas.** É o contrário exato da entrada rica, onde as seis linhas fecharam e nenhuma pesquisa foi lançada — e é a mesma tabela, o que é o ponto.

## Os blocos

**O primeiro bloco** trouxe o mapa acima, as três perguntas que os buracos produziram — a tensão, a tese e quem decide —, e o aviso de que **duas pesquisas estavam correndo em segundo plano**, uma por classe de insumo:

- **a máquina local** — o conjunto instalado em `~/.claude/skills/`, contado diretório a diretório, e a execução da spec #237 neste repositório;
- **a web** — o repositório público `mattpocock/skills`, medido pela API do GitHub sobre o commit do dia.

**O segundo bloco não existiu.** A regra é que ele só existe se a pesquisa **mudar a tese**, e a pesquisa confirmou a tese que as respostas do primeiro bloco já tinham fixado — ela mudou **números**, não o argumento. O que ela trouxe entrou no deck e nas notas, sem virar mensagem.

## Os fragmentos de pesquisa

### F1' · o repositório `mattpocock/skills`

**onde:** `github.com/mattpocock/skills`, branch `main`, commit `3cca18b368ae95cdbdebbff572ccafa662551015`, lido pela API do GitHub (`gh api repos/mattpocock/skills/contents/...`). **quando:** commit de **2026-09-04**, lido em **2026-09-12**.

- categorias de primeiro nível sob `skills/` = **5**: `deprecated`, `engineering`, `in-progress`, `misc`, `productivity`
- skills por categoria: `engineering` 18, `productivity` 7, `in-progress` 8, `misc` 4, `deprecated` 0 (só um `README.md`) — **37 na árvore**
- o `.claude-plugin/plugin.json`, versão `1.2.3`, publica **25** caminhos explícitos: exatamente `engineering` + `productivity`
- o fluxo principal, na fonte literal de `docs/engineering/ask-plugin/ask-matt.md` («The main flow, idea to ship. Grill, spec, tickets, implement, review»): `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` → `/code-review`

### F2' · o conjunto instalado nesta máquina

**onde:** `~/.claude/skills/`, contado por `ls -la` classificando diretório real contra symlink, e `find`/`du`/`awk` por diretório. **quando:** **2026-09-12**.

- skills instaladas (diretórios reais; os 6 symlinks das skills da casa excluídos) = **25**, em **74** arquivos
- com `disable-model-invocation: true` no frontmatter = **14** — só o humano as dispara
- linhas de `SKILL.md` no fluxo principal: `/grill-with-docs` 7, `/implement` 15, `/tdd` 38, `/to-spec` 75, `/code-review` 87, `/to-tickets` 105 — **soma 327**

### F3' · a execução da spec #237 neste repositório

**onde:** `ThiagoPanini/panlabs-skills`, por `gh issue list`, `gh pr view` e o timeline da API. **quando:** **2026-09-12**.

- tickets que a spec #237 abriu = **8** (#238 a #245), cada um citando `#237` no corpo
- fechados até hoje = **2**: o #238 pelo PR #246, o #239 pelo PR #249
- o PR que fechou o #239 não trazia o link automático do GitHub nos dois sentidos; o evento `closed` da issue registra o commit `9c3ae30`, que é o `mergeCommit` do PR #249 — **confirmado por comparação direta, e não por link**

## As divergências contra o registro de dados, e por que nenhuma é erro

O [`DATA.md`](DATA.md) foi medido em **2026-07-30** (F1) e **2026-09-09** (F2, F3). A pesquisa desta travessia é de **2026-09-12**. **Toda diferença abaixo é atualização, e está citada como tal** — a regra do ticket é que o que divergir seja atualização e não erro, desde que citado:

| o que | `DATA.md` | a pesquisa de 12/set | o que é |
| --- | --- | --- | --- |
| skills no upstream | **41**, em seis categorias | **37**, em cinco | **atualização**: `deprecated/` esvaziou e ficou só com o `README.md`; o commit do dia é «link-skills: stop linking misc/ into local skill directories» |
| publicadas pelo plugin | **22** caminhos explícitos | **25**, na versão `1.2.3` | **atualização**: o plugin cresceu para `engineering` + `productivity` inteiras |
| skills instaladas | **25**, 74 arquivos | **25**, 74 arquivos | **confirmação**, três dias depois |
| a flag que só o humano dispara | **14** de 25 | **14** de 25 | **confirmação** |
| as 327 linhas do fluxo principal | 7, 15, 38, 75, 87, 105 | idênticas | **confirmação** |
| tamanho do conjunto instalado | **199,4 KiB** | **600 KiB** | **nem uma coisa nem outra**: é diferença de **método** — o `DATA.md` soma o tamanho aparente dos arquivos, a pesquisa somou blocos de 1 KiB por diretório. Duas medidas de coisas diferentes, e o deck não usa nenhuma das duas |

**E uma divergência que é do upstream consigo mesmo**, não nossa: a FAQ em `docs/engineering/ask-matt.md` diz «Thirteen of the plugin's twenty-two skills carry the flag», enquanto o `plugin.json` do mesmo commit publica 25. A própria doc se declara «hand-maintained and lags the repo». **O deck cita o `plugin.json`, que é o artefato executado, e a FAQ vira nota** — que é a regra de fonte primária aplicada dentro de uma fonte só.

## O que os outros turnos entregaram

| turno | o que saiu |
| --- | --- |
| 1 | o storyboard, a direção de arte, e o **esqueleto** com a folha de contato dele |
| 2 | o deck, a folha de contato, a lista do que ficou fora, e as quatro da lista visual respondidas |
| 3 | o **artigo** em Markdown, com os desenhos ao lado |

Os comandos e os vereditos estão em [`CROSSING.md`](CROSSING.md).
