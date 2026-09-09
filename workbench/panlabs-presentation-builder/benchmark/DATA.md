# Os dados do benchmark, com fonte e data

**Todo número que aparece no deck aparece aqui primeiro, com de onde ele veio e de quando ele é.** A régua `chart-source` do compilador cobra a data em cada gráfico, mas ela cobra só que a linha exista; o que ela não sabe conferir é se o número atrás da linha foi medido ou inventado. Este arquivo é onde isso fica conferível — e é a diferença entre o benchmark e os dois exemplos da árvore, que são sintéticos e dizem isso na primeira linha de cada um.

**Nenhum número aqui é sobre produtividade.** Não existe medição de tempo de sessão, de antes e depois, nem de velocidade de quem usa o framework — o laudo de pesquisa registra explicitamente que ela não existe —, e o brief proíbe inventar uma.

## As três fontes

| id | o que é | onde | quando |
| --- | --- | --- | --- |
| **F1** | A anatomia dos AI Frameworks candidatos, medida byte a byte sobre clones `--depth 1` | `overpower`, `docs/research/ai-frameworks-anatomy.md`, commit `4fdb24a` da branch `research/ai-frameworks-anatomy` | pesquisa de **2026-07-30**; `mattpocock/skills` no commit `2ab9580`, de 2026-07-28 |
| **F2** | O conjunto instalado nesta máquina, contado por `os.walk` sobre `~/.claude/skills/` — só os diretórios de verdade, nunca os symlinks das skills da casa | a própria máquina do dono | medido em **2026-09-09** |
| **F3** | A execução da spec #207 neste repositório: issues, PRs e datas de fechamento | `gh issue list` e `gh pr list` em `ThiagoPanini/panlabs-skills` | lido em **2026-09-09** |

O que F1 mede é o **upstream**, com as 41 skills nas seis categorias. O que F2 mede é o que o `overpower` vendoriza e instala, que são **25** — a curadoria da v1.2.3, e não as 41. Os dois números medem coisas diferentes e o deck nunca os soma.

## Gráfico 1 · Linhas por `SKILL.md`, no fluxo principal (F2, 2026-09-09)

O fluxo «idea → ship» são seis comandos, e é a soma deles que o slide afirma.

| comando | linhas do `SKILL.md` |
| --- | ---: |
| `/grill-with-docs` | 7 |
| `/implement` | 15 |
| `/tdd` | 38 |
| `/to-spec` | 75 |
| `/code-review` | 87 |
| `/to-tickets` | 105 |
| **soma** | **327** |

Contexto que não vai ao slide e vai às notas: as 25 skills instaladas somam **1.594** linhas de `SKILL.md`, em **74** arquivos e **199,4 KiB**; **22** desses arquivos são referência ao lado de um `SKILL.md`, e **14 das 25** trazem `disable-model-invocation: true`, isto é, só o humano as dispara.

## Gráfico 2 · A execução da spec #207, acumulada (F3, 2026-09-09)

Tickets da spec fechados, em acumulado, por dia.

| dia | fechados no dia | acumulado |
| --- | ---: | ---: |
| 07/set | #208, #209, #210, #211, #212 — 5 | 5 |
| 08/set | #213 — 1 | 6 |
| 09/set | #214, #215, #216, #217, #218, #219 — 6 | 12 |

A spec nasceu em **2026-09-07** com **58** user stories e **13** tickets (#208 a #220); doze fecharam, cada um pelo seu PR — **#221 a #232**, todos com squash na `main`. O décimo terceiro é o #220, que é este.

## Gráfico 3 · As categorias em proporção (F1, 2026-07-30)

As 41 skills do upstream em seis categorias, e a fronteira que importa: o `.claude-plugin/plugin.json` traz um array de **22 caminhos explícitos** — as «promovidas» —, e o que está fora dele não é publicado pela via de plugin.

| categoria | skills | arquivos | bytes | publicada |
| --- | ---: | ---: | ---: | --- |
| `engineering/` | 17 | 52 | 147.398 | sim |
| `productivity/` | 5 | 16 | 49.451 | sim |
| `in-progress/` | 9 | 21 | 51.021 | não |
| `deprecated/` | 4 | 9 | 17.028 | não |
| `misc/` | 4 | 10 | 12.592 | não |
| `personal/` | 2 | 5 | 2.856 | não |
| **total** | **41** | **113** | **280.346** | |

O gráfico é uma proporção de três fatias, e as três somam cem por maior resto: `engineering/` 17/41 = 41,46% → **42**; `productivity/` 5/41 = 12,20% → **12**; as quatro não publicadas 19/41 = 46,34% → **46**.

## Gráfico 4 · Os frameworks comparados, em contagem e em tamanho (F1, 2026-07-30)

O valor desenhado é **KiB por skill** — o tamanho do que seria vendorizado dividido pelo número de skills. A contagem viaja no rótulo, ao lado do nome, porque o slide afirma as duas coisas ao mesmo tempo.

| conjunto | skills | vendorizável | KiB por skill |
| --- | ---: | ---: | ---: |
| `open-gsd/gsd-core` | 71 | 4,8 MiB | **69,2** |
| `bmad-code-org/BMAD-METHOD` | 50 | 1,64 MiB | **33,6** |
| `obra/superpowers` | 14 | 343 KiB | **24,5** |
| `Fission-AI/OpenSpec` | 13 | 108 KiB | **8,3** |
| `mattpocock/skills` | 41 | 274 KiB | **6,7** |

**Duas ausências, e as duas são deliberadas.** `anthropics/skills` (18 skills, 10,1 MiB, **574,6** KiB por skill) fica fora porque F1 registra que ele **não declara licença** — não há arquivo `LICENSE` e a API do GitHub devolve `license: null` —, e um conjunto que ninguém pode adotar não pertence a uma comparação sobre o que adotar. `github/spec-kit` fica fora porque não é uma árvore de skills: é uma ferramenta Python que **gera** dez arquivos de skill na instalação, e dividir o wheel dela por dez compararia coisas de espécie diferente.

## O que a figura desenha (F1 e as próprias skills instaladas, 2026-09-09)

O pipeline canônico, lido do `ask-matt/SKILL.md` e do `docs/agents/workflow.md` deste repositório: `/setup-matt-pocock-skills` uma vez por repositório; depois `/grill-with-docs` até a fronteira fechar, `/to-spec`, `/to-tickets`, e `/implement` uma vez por ticket, com `/clear` entre as sessões. `/implement` dirige `/tdd` por dentro e fecha em `/code-review`. Duas entradas laterais alimentam o mesmo fluxo sem passar pelo grilling: `/triage`, para a issue que você não escreveu, e `/diagnosing-bugs`, para o defeito que já está na sua frente.

## As frases citadas

A citação do deck é literal, do `grilling/SKILL.md` instalado (F2, 2026-09-09): «Finding facts is your job, never the user's» e «The decisions are the user's». O deck cita as duas juntas, em inglês, porque é assim que elas estão escritas — a skill é inglesa, e traduzir a citação seria atribuir ao autor uma frase que ele não escreveu.
