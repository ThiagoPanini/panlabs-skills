# Fluxo de trabalho paralelo

Como várias sessões trabalham ao mesmo tempo neste repo sem que uma quebre a outra,
e como cada uma termina com o seu código na `main`.

```
/wayfinder  →  /to-spec  →  /to-tickets  →  território  →  worktree  →  união verde  →  PR  →  main
```

**Este arquivo é prosa, e prosa aqui é português.** Código é inglês — nome de
arquivo, identificador, comentário e mensagem impressa. A regra inteira, com a
dívida que ela declara, está no `CLAUDE.md` § O código é em inglês. É por isso que
`scripts/check-union.sh` tem nome e saída em inglês enquanto este documento não.

## As quatro colisões, e o git só vê uma

| # | Colisão | O que é | O git |
| --- | --- | --- | --- |
| 1 | **texto** | dois lados editam as mesmas linhas | **reprova** |
| 2 | **interseção** | dois lados editam o mesmo arquivo, em linhas distintas | mergeia limpo |
| 3 | **alocação** | dois lados tomam o mesmo nome de uma reta compartilhada | mergeia limpo |
| 4 | **estrutura** | um lado move um caminho; o outro continua apontando para ele | mergeia limpo |

A colisão 1 é a barata, e não precisa de doutrina — o git já a resolve. **As três
que sobram passam verdes**, e é para elas que este arquivo existe.

As três medições abaixo são o que esta árvore mostrava no dia em que a doutrina foi
escrita, e ficam como registro: não são hipótese, foram o estado real do repo. Os
tickets citados já aterrissaram — pela régua, e um de cada vez.

**Interseção.** As branches `issue-36-registro-fora-da-skill` e
`issue-37-quatro-contratos` saem da mesma base (`c70ec0e`) e cruzam em exatamente
um arquivo: `skills/panlabs-aws-diagrams/SKILL.md`. `git merge-tree` nas duas
devolve uma árvore sem um único marcador de conflito. A #36 **apaga** a linha que
aponta para `guia/decisoes.md` — porque moveu o arquivo para fora da skill. A #37
**reescreve** o parágrafo dos contratos, duas linhas abaixo. O merge é verde, e o
`SKILL.md` que sai dele não foi lido inteiro por nenhum dos dois autores.

**Alocação.** `docs/adr/NNNN-slug.md` é uma reta numérica compartilhada, e é a
única escrita deste repo que dois lados fazem **sem tocar no mesmo arquivo**. No
repo irmão isso já aconteceu e ficou: `overpower/docs/adr/` tem
`0013-a-chave-alheia-e-sobrescrita.md` **e** `0013-o-sdist-declara-o-que-carrega.md`,
entrados pelos PRs #74 e #73. Dois ADRs no mesmo ponto da reta, e nenhuma linha
ficou vermelha em lugar nenhum.

**Estrutura.** A #37 acabou de escrever, no `SKILL.md`, ponteiros para
`tests/check-esquema-unico.cjs` e `tests/check-paridade-tecnica.cjs`. A
[#44](https://github.com/ThiagoPanini/panlabs-skills/issues/44) tira `tests/` da
árvore da skill. Quem aterrissar por último aterrissa um ponteiro morto — texto
mergeia com texto. A [#46](https://github.com/ThiagoPanini/panlabs-skills/issues/46)
existe justamente para checar *"nada dentro da skill aponta para fora"*: o repo já
conhece a classe do estrago, só não a tinha ligado a branches paralelas.

## A tese: ninguém roda a união

O cabeçalho de `skills/panlabs-aws-diagrams/tests/rodar.sh` guarda a lição do #23
com todas as letras:

> *"as duas suítes estão verdes, cada uma contra o seu próprio motor; ninguém rodou
> a união"*

**É a mesma frase um nível acima.** Duas branches verdes, cada uma contra a sua
própria árvore; ninguém rodou a união. E o conserto tem a mesma forma: fazer a
união rodar, no único lugar onde as duas árvores existem, **antes** da segunda
aterrissar.

`scripts/check-union.sh` é isso. Ele não descobre nada que um humano não pudesse
ver — descobre **antes do merge**, que é a única diferença que importa depois que
ele aconteceu.

Ele aceita **duas** refs — `check-union.sh [DELES] [MEU]`, com `MEU` valendo `HEAD`
— e é isso que deixa a pergunta *estas duas branches abertas colidem?* ser feita de
uma terceira branch, que é de onde ela normalmente se faz. Foi assim que os PRs #48
e #52 foram medidos antes de entrarem, e a saída é esta:

```
$ scripts/check-union.sh origin/issue-36-registro-fora-da-skill origin/issue-37-quatro-contratos
==== the union . origin/issue-37-quatro-contratos x origin/issue-36-registro-fora-da-skill ====
   base c70ec0e . the other side moved 2 commit(s), 20 file(s)

-- overlap (the same file from both sides)
   x 1 file(s):
       skills/panlabs-aws-diagrams/SKILL.md

UNION RED - the clean merge would lie.
```

**E ele prova que mede antes de ser usado como régua.**
`scripts/check-union.proof.sh` planta as quatro colisões silenciosas num repo
descartável e exige vermelho em cada uma, mais três controles que têm de passar —
território disjunto, o modo de duas refs medido de uma terceira branch, e o mesmo
`git mv` com o link corrigido. **Sete casos, sete verdes.** As quatro checagens
passariam por vacuidade se a consulta estivesse errada, e nenhuma delas dispara na
árvore real com frequência suficiente para ser vista falhar por acidente —
**checagem só vista verde é documentação**. O caso da interseção ainda assevera a
premissa antes de medir: *o git mergeia aquele par sem conflito* — e é por isso que
a régua precisa existir.

**A quarta checagem — `self-dangling` — nasceu de um defeito que passou.** O `git mv`
move os bytes e não reescreve os links relativos **dentro** do arquivo movido: o
#36 aterrissou com `docs/aws-diagrams/decisoes.md` apontando para `docs/SKILL.md`,
que nunca existiu. Uma revisão humana pegou o link irmão em `recertificacao.md` e
deixou este passar. O check 3 era cego a isso por construção — ele procura o que o
**outro** lado moveu, e aqui quem moveu e quem apontava eram a mesma branch. Ver
[#56](https://github.com/ThiagoPanini/panlabs-skills/issues/56).

## Um ticket, um worktree, uma branch

| | |
| --- | --- |
| branch | `issue-<n>-<slug-curto>` |
| worktree | `.claude/worktrees/issue-<n>` — ignorado pelo git, e o `.gitignore` diz por quê |
| commits na `main` | **um**, por squash |

O número no nome não é enfeite: é o que liga a branch ao ticket em qualquer
consulta, e a consulta de fronteira do [`issue-tracker.md`](issue-tracker.md)
depende dessa ligação. Quando esta regra foi escrita havia **cinco esquemas de nome
convivendo** — `issue-36-…`, `prototipos/q14`, `skill/q25`,
`worktree-catalogo-shapes-aws` e `feat/33-…` —, e o custo não era estético: nenhuma
consulta encontrava a branch a partir do ticket. Os herdados que ainda existem
ficam; **tudo que nasce é `issue-<n>-<slug>`**.

## Território declarado antes da primeira escrita

**Primeira escrita da sessão, antes de qualquer edição:**

```bash
gh issue edit <n> --add-assignee @me
gh issue comment <n> --body 'Território
posse: skills/panlabs-aws-diagrams/sessao/, skills/panlabs-aws-diagrams/tests/check-paridade-tecnica.cjs
acréscimo: skills/panlabs-aws-diagrams/SKILL.md, skills/panlabs-aws-diagrams/tests/rodar.sh'
```

| Grau | Significa |
| --- | --- |
| **posse** | edita, move e apaga à vontade |
| **acréscimo** | só **adiciona** linha — nunca reordena, nunca renumera, nunca reescreve o que já estava |
| **fora** | tudo que não foi declarado. Encostou? É quebra de escopo: pare e diga. |

**Dois tickets cujas posses se cruzam não rodam ao mesmo tempo.** Essa é a regra
que resolve o problema; o `check-union.sh` é a rede embaixo dela. Antes de abrir
a sessão, olhe quem já está de pé:

```bash
gh issue list --state open --label ready-for-agent --json number,title,assignees,comments
scripts/check-union.sh <branch-da-outra-sessão>    # se a outra já tem branch
```

Achou cruzamento? **Não negocie o diff — pegue outro ticket.** O comando acima diz
quantos há; um número escrito aqui já teria envelhecido.

## Registro é append-only, e a regra troca uma colisão por outra de propósito

Três arquivos aqui são registros lineares cuja **ordem é carga**:

- `skills/*/tests/rodar.sh` — a lista de `passo`. O cabeçalho dele diz: *"a ordem
  das camadas é a ordem em que uma falha invalida as seguintes"*.
- `skills/*/SKILL.md` — as tabelas de ponteiro.
- `CLAUDE.md` — a seção de skills.

**Regra: acrescente no FIM da seção. Nunca no meio, nunca reordenando.**

Isso não é etiqueta, é **conversão de classe**. Dois acréscimos no fim da mesma
seção caem nas mesmas linhas → vira **colisão 1**, o git reprova, e o conserto é de
trinta segundos. Dois acréscimos espalhados pelo meio caem em linhas distintas →
vira **colisão 2**, mergeia verde, e produz uma lista cuja ordem ninguém escolheu.
A regra compra um conflito barato para não pagar um silêncio caro.

## Movimento de terra roda sozinho

Um ticket que **renomeia, move ou apaga caminho rastreado** invalida o território
que todo mundo declarou. Ele não é paralelizável, e tratá-lo como se fosse produz a
colisão 4 em escala.

**Enquanto um movimento de terra está EM VOO, nenhuma outra branch aterrissa.** Ele
entra primeiro, todo mundo rebaseia, e só então a fila volta a andar. Marque-o para
a fila enxergar: `gh issue edit <n> --add-label movimento-de-terra`.

> **Em voo, não apenas aberto** — e a diferença foi medida na primeira vez que esta
> regra rodou. *Aberto* é o ticket existir; *em voo* é ele estar assinado **e** com
> branch empurrada. Lidos como sinônimos, os três movimentos de terra ainda por
> começar ([#44](https://github.com/ThiagoPanini/panlabs-skills/issues/44),
> [#45](https://github.com/ThiagoPanini/panlabs-skills/issues/45),
> [#53](https://github.com/ThiagoPanini/panlabs-skills/issues/53)) travariam a fila
> para sempre — regra que nunca destrava não é fila, é parada. A consulta é:
>
> ```bash
> gh issue list --state open --label movimento-de-terra --json number,assignees
> git ls-remote --heads origin 'issue-*'
> ```
>
> Movimento de terra com dono e branch: espere. Só com ticket: siga, e **quem for
> pegá-lo pega a fila inteira rebaseando** — é ele que paga o custo, não os outros.

São quatro sobre a mesma árvore, e eles são uma **fila, não um lote**: a
[#36](https://github.com/ThiagoPanini/panlabs-skills/issues/36) tira `docs/` da
árvore da skill — **já aterrissou**, em `29307b4`, sozinha e primeiro, como a regra
manda —, a [#44](https://github.com/ThiagoPanini/panlabs-skills/issues/44) tira
`tests/` e o corpus, a
[#45](https://github.com/ThiagoPanini/panlabs-skills/issues/45) tira a bancada e as
ferramentas, e a [#53](https://github.com/ThiagoPanini/panlabs-skills/issues/53)
renomeia a árvore inteira para inglês. Por cima delas, a
[#43](https://github.com/ThiagoPanini/panlabs-skills/issues/43) reescreve o
`SKILL.md` que aponta para todas.

A #36 rodando primeiro deixou a medida do custo: quem entrou depois dela **teve de
rebasear e regenerar o derivado**, e foi barato porque foi um. Se as quatro
tivessem corrido juntas, seriam quatro renomeações sobre os mesmos diretórios e um
`SKILL.md` reescrito por baixo delas.

## Derivado não se mergeia, se regenera

`tests/motor.manifesto.json` é hash do motor. `saida/*.drawio` e `saida/*.png` são
render. Nenhum é fonte, e o histórico já pagou por tratá-los como se fossem:
`bdeb67b Re-render da suíte: o id do keyframe da animação não é determinístico`.

**No rebase, em arquivo derivado, não resolva o conflito — rode o gerador e
commite o resultado.** Nunca `--ours`, nunca `--theirs`: as duas escolhas produzem
um derivado que não corresponde a fonte nenhuma, e um manifesto assim passa verde
exatamente no check que ele deveria fazer falhar.

## A aterrissagem

O requisito é que **toda implementação termine com o código na `main`** — não numa
branch, não num PR aberto.

1. `scripts/check-union.sh` — verde. Vermelho? `git rebase origin/main`, e de novo.
2. `skills/<skill>/tests/rodar.sh` — verde **contra o resultado do rebase**, não contra a sua branch.
3. `gh pr create --fill --draft` no primeiro push; o corpo se escreve no fim, por quem tem o ticket na mão. `gh pr create` não é idempotente — a guarda é `gh pr list --head "$BRANCH" --state open`.
4. `gh pr ready` e `gh pr merge --squash`. Squash porque a `main` guarda **um commit por ticket**: é o que torna um revert uma operação e não uma arqueologia.
5. `git push origin --delete <branch>`.
6. **A sessão só acaba quando `git log origin/main --oneline` mostra o commit.** Abrir o PR não é acabar.

**`--delete-branch` falha aqui.** A flag troca o checkout para a `main`, e a `main`
está ocupada pelo worktree principal (`git worktree list` mostra
`/home/paninit/workspaces/panlabs-skills [main]`). Ela falha *depois* de já ter
mergeado, e a sessão sai achando que não mergeou.

**A `main` local nunca recebe commit — ela só fast-forwarda.** Na raiz do repo,
`git pull --ff-only`. Se o `--ff-only` recusar, alguém commitou direto na `main`
local: isso é o defeito, não o pull.

**E isto já custou trabalho de verdade.** Quando esta doutrina foi escrita, `8b71c7e`
e `6c5f29d` estavam na `main` local e em **remoto nenhum** (`git branch -r --contains
main` saía vazio) — e o SHA do topo mudou entre duas leituras da mesma sessão,
`759918e` → `8b71c7e` com o mesmo assunto. Ou seja, **a `main` local não só recebia
commit como estava sendo reescrita por outra sessão enquanto era lida.**

O `6c5f29d` não era redundante: ele trazia `modelo/ator-externo-3-contas.json`, um
arquivo que **não existia na `origin/main`**. Foi resgatado no
[#54](https://github.com/ThiagoPanini/panlabs-skills/issues/54), e o resgate é o
manual da regra do derivado — o cherry-pick conflitou em `motor.manifesto.json`, e a
resolução saiu de `check-motor-intocado.cjs --gravar`, não de escolher um lado.

O histórico guarda os outros dois nomes que essa prática deixa:
`a2a08ae Reconcilia com o PR #29, que mergeou a mesma branch na origin` e
`331b61c Traz para a main os 9 commits do #26 que ficaram na branch`.

## A primeira rodada não seguiu isto, e é ela que calibra as regras

Treze minutos de 2026-08-25, e os quatro PRs da manhã:

| hora | PR | branch | o que aconteceu |
| --- | --- | --- | --- |
| 11:28 | #48 | `issue-36-registro-fora-da-skill` | aberto |
| 11:31 | #49 | `feat/33-caixa-de-folha-mede-rotulo` | aberto **e mergeado 32 s depois** |
| 11:38 | #51 | `issue-50-doutrina-trabalho-paralelo` | este documento, aberto |
| 11:41 | #52 | `issue-37-quatro-contratos` | aberto como draft |

**Não seguiram, e não tinham como.** #48 e #49 eram anteriores a este arquivo; o #52
veio quatro minutos depois dele — e o #51, que era este arquivo, ainda estava
aberto. **Doutrina que não está na `main` não está em vigor**, e a regra que este
documento grava sobre si mesmo é a que ele grava sobre todo mundo: terminar é estar
na `main`.

Território declarado: **nenhum**. As issues #36 e #37 não têm um comentário sequer.
O #49 estreou um quinto esquema de nome de branch (`feat/33-…`) e foi mergeado 32
segundos depois de aberto — menos tempo do que a suíte da skill leva para rodar.

E o que a régua mediu nos três:

| par | interseção | o git | a regra que ela toca |
| --- | --- | --- | --- |
| #48 × #52 | `SKILL.md` | mergeia limpo | registro append-only |
| #48 × `main` | `tests/motor.manifesto.json` | mergeia limpo | derivado se regenera |
| #52 × `main` | `tests/rodar.sh` | mergeia limpo | registro append-only |

Três interseções, três regras deste arquivo, uma para cada — **as regras foram
escritas contra o que a primeira rodada de fato fez**, e não contra um risco
imaginado.

### E a união, rodada de verdade, deu verde

A árvore mergeada de #48 com a `main` foi materializada e a suíte inteira rodou
contra ela: **43 checks, 43 verdes**, camada 7 inclusive. O manifesto derivado
sobreviveu porque #49 mexeu em `gerar/planejar/resolver` e #48 em `dispor` — linhas
independentes. Isso é resultado, não alívio: foi **sorte de linha**, e duas branches
que tocassem o mesmo `.cjs` produziriam um manifesto verde apontando para um motor
que não existe. A regra continua sendo regenerar, e não conferir se deu certo desta
vez.

**Mas repare no que esse verde não cobre.** A colisão que sobra — #48 × #52 em
`SKILL.md` — é **invisível para os 43**: a única ocorrência da string `SKILL.md` em
toda a árvore de `tests/` é um comentário no cabeçalho do `check-arco.cjs`. A suíte
mede o motor; o `SKILL.md` é a porta de entrada da skill, o único arquivo que todo
ticket edita, e **nada o verifica**.

É exatamente por isso que a régua da união não é a suíte com outro nome. A suíte
responde *o motor ainda funciona?*; a união responde *duas edições que ninguém leu
juntas viraram um documento coerente?*. Rodar só a primeira e concluir que está
tudo bem é a lição do #23 acontecendo de novo, um andar acima.

### E foi assim que a fila drenou

A doutrina entrou primeiro (`da90a13`) porque nada abaixo dela valia enquanto ela
estivesse num PR aberto. Depois, um de cada vez, na ordem que ela mesma manda:

| | | |
| --- | --- | --- |
| `29307b4` | #36 | `movimento-de-terra` — **sozinho e primeiro**; união medida, suíte verde contra a árvore mergeada |
| `59826ba` | #54 | o commit que só existia na `main` local, com derivado **regenerado**, não mergeado |
| `a3daa63` | #37 | `SKILL.md` e `rodar.sh` materializados e **lidos**; os três ponteiros novos resolvem |
| `00da483` | #56 | o `self-dangling`, e o link morto que a revisão humana deixou passar |
| `1eb76aa` | #34 | conserto pronto que dormia numa branch sem PR desde 2026-08-24 |

**O que a execução ensinou, e virou regra acima:** duas das cinco entradas eram
trabalho **já pronto e não aterrissado** — uma na `main` local, outra numa branch
esquecida. Nenhuma das duas apareceria numa lista de PRs abertos. A auditoria que as
achou é barata e cabe em duas linhas:

```bash
git branch -vv | grep -v '\[origin/'        # commit local sem remoto nenhum
git branch -r --merged origin/main          # o complemento: branch que já pode sair
```

E a colisão do derivado apareceu **três vezes** nas cinco — sempre no
`motor.manifesto.json`, sempre resolvida por `--gravar`. Na terceira, a regeneração
saiu **no-op**: prova de que o merge produzia o mesmo que o gerador, e de que a
regra é barata mesmo quando não muda nada.

## Duas armadilhas de worktree

- **O stash é compartilhado** entre todos os worktrees, e outra sessão pode estar
  empilhando nele. `git stash` puro desempilha o dos outros. Prefira um commit WIP;
  se precisar mesmo do stash, `git stash push -u -m "<tag>"`, capture o SHA em
  seguida e recupere com `apply <sha>` — nunca `pop`.
- **`.claude/worktrees/` é ignorado, e continua sendo.** São checkouts deste repo
  dentro dele mesmo; commitá-los duplica o repo e quebra em qualquer clone. O
  `.gitignore` explica, e a explicação é boa.

## O que deliberadamente não é portão

Sem ruleset de branch, sem CI, sem required check. **Nada impede um
`git push origin main`.** A doutrina inteira acima é de sessão, não de servidor.

Isso é escolha e não pendência: o produto aqui é skill e artefato de agente, o
"build" é a suíte de uma skill só, e um ruleset num repo de um mantenedor troca
alguns merges perdidos por um portão que ninguém pode destravar. Mas a escolha tem
preço, e o preço é exatamente este — **a única coisa que roda a união é você
rodar.**

**O gatilho para reabrir**, se um dia doer mais do que o portão custaria: dois
merges verdes que quebraram a árvore no mesmo mês. Aí `check-union.sh` mais a
suíte da skill viram um workflow de PR, e esta seção vira ADR.
