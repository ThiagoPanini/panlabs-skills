# A simulação cega

O protocolo de aceitação da spec [#35](https://github.com/ThiagoPanini/panlabs-skills/issues/35), fase 5 — [#47](https://github.com/ThiagoPanini/panlabs-skills/issues/47). Não é teste automatizado e não roda na esteira: roda **uma vez**, quando alguém quer saber como a skill se comporta na mão de quem acabou de instalá-la e não tem nenhum material complementar.

O que mora aqui é o **ambiente** da corrida, não a corrida. O agente cego continua sendo um sub-agente sem contexto nenhum, conduzido à mão; o que o `blind-run.sh` faz é montar o mundo em que ele acorda, e depois provar que esse mundo era o que dizia ser.

## Por que ele existe — a corrida de 2026-08-26

A primeira corrida do #47 rodou **dentro deste repositório**, e duas coisas deram errado ao mesmo tempo. Nenhuma das duas era sobre a skill.

**O sub-agente se recusou a gravar, e estava certo.** Ele leu o `CLAUDE.md`, reconheceu o `panlabs-skills` como um repositório público de skills e não como o projeto de um cliente, e recusou escrever uma arquitetura fictícia de dado de saúde dentro dele. Escreveu fora de git, onde o `tools/case.cjs` caiu no comportamento documentado — "fora de repositório git cai no diretório corrente, com aviso". O motor funcionou como projetado; quem desviou foi a escolha de onde rodar. Um protocolo cujo destino é *"o repositório em que você está"* só mede alguma coisa quando esse repositório pode plausivelmente ser o de quem chama.

**E a cópia que a simulação preparou nunca foi a que rodou.** O sub-agente encontrou a skill pela instalação **global** já existente na máquina — `~/.claude/skills/panlabs-aws-diagrams`, um link que resolve para o checkout principal —, não pela cópia isolada da branch descartável. Ocultar o `workbench/` numa branch não neutralizou nada: o corpus de modelos ficou a um `../..` de distância o tempo todo. Nada foi procurar por ele, o que é sorte, não isolamento. [#121](https://github.com/ThiagoPanini/panlabs-skills/issues/121).

## O que o harness monta

```bash
workbench/panlabs-aws-diagrams/blind-run/blind-run.sh setup      # monta e imprime o prompt
workbench/panlabs-aws-diagrams/blind-run/blind-run.sh verify     # audita o isolamento
workbench/panlabs-aws-diagrams/blind-run/blind-run.sh teardown   # devolve a máquina
```

**Um projeto de chamador que não é este repositório.** [`project/`](project/) é a árvore da `labmove-platform` — uma plataforma de coleta domiciliar de exames, com README próprio, dois serviços e um `docs/architecture/` com um ADR dentro. O `setup` materializa essa árvore no sandbox e faz dela um repositório git com identidade própria. A objeção de confidencialidade se dissolve porque a arquitetura que vai ser desenhada **é a daquele projeto**.

**Uma cópia da skill, cortada da origem.** A cópia sai do que o `git ls-files` diz que a skill carrega — nada de lista paralela de exclusões para divergir do `tools/package.sh` — e é **cópia, não link**. O `tools/install.sh` linka de propósito, para a skill instalada nunca ficar velha; aqui o requisito é o oposto, porque link sobe de volta na árvore de onde veio.

**Toda porta da máquina apontando para essa cópia.** Cada skill home — por padrão `~/.claude/skills` e `~/.agents/skills`, os dois que o `install.sh` escreve — tem a sua entrada repontada para a cópia, e o original fica registrado num arquivo ao lado (`.panlabs-aws-diagrams.blind-run-parked`). **O registro fica junto do skill home, não dentro do sandbox**: o sandbox mora no temporário do sistema e a máquina pode varrê-lo, e restauração que depende do sandbox é restauração que para de funcionar justamente quando é necessária.

### O que o `verify` mede

Nove afirmações, cada uma com o seu vermelho plantado em [`blind-run.proof.sh`](blind-run.proof.sh):

| | |
|---|---|
| o projeto de chamador é a raiz do próprio repositório git | senão o `case.cjs` grava em outro lugar |
| ele não se chama `panlabs-skills`, e nada nele nomeia `panlabs-skills` | é o que o sub-agente leu antes de recusar |
| ele **nunca** nomeia `docs/architecture/diagrams` | senão o critério passa por construção e não mede nada |
| a skill instalada é diretório de verdade, não link | link sobe de volta para a bancada |
| o git, perguntado de dentro da cópia, responde o projeto de chamador | é literalmente o que o `case.cjs` pergunta |
| nenhum link dentro do sandbox resolve para fora dele | |
| nenhum ancestral da cópia carrega `workbench/` ou uma segunda instalação | é o vazamento do #47, que se alcança **subindo**, não por link |
| toda porta declarada resolve para dentro do sandbox | |
| e cada uma delas tem o seu registro de restauração | sem ele o `teardown` não sabe o que devolver |

Rode `verify` **duas vezes**: antes de entregar o prompt e depois que a corrida terminar. Uma instalação repontada no meio do caminho — por outra sessão, por um `install.sh` rodado sem querer — só aparece na segunda.

## Como rodar

1. `blind-run.sh setup` — ele imprime o prompt, e o prompt é o **único** insumo do agente cego: o caminho do projeto mais o descritivo de [`brief.md`](brief.md), deliberadamente incompleto.
2. `blind-run.sh verify` — não entregue o prompt antes disso ficar verde.
3. Abra um sub-agente **sem nenhum contexto** desta conversa e entregue o prompt, sem mais nada. Não nomeie a skill: descobri-la é parte do que se mede.
4. Responda as perguntas dele **como o usuário responderia** — curto, sem completar o que a rodada não perguntou.
5. `blind-run.sh verify` de novo, e então leia os sete critérios do #47 contra o que ficou no sandbox.
6. `blind-run.sh teardown`.

O `--at <dir>` troca a raiz do sandbox (padrão: `${TMPDIR:-/tmp}/panlabs-blind-run`) e o `--skill-home <dir>`, repetível, **substitui** o par padrão em vez de somar a ele — é o que deixa a prova rodar contra um `HOME` de mentira em vez da máquina de verdade.

## O que ele deliberadamente não faz

**Não põe o agente cego dentro do sandbox por processo.** O prompt diz onde o projeto está e o agente vai até lá; a sessão dele continua nascendo do diretório de quem o abriu. Um agente que resolva ignorar a primeira linha do prompt grava no lugar errado — e isso é resultado da corrida, não defeito do harness: o critério 2 do #47 pergunta exatamente se a convenção da skill leva o trabalho para o lugar certo.

**Não esconde que existe um harness.** `prompt.txt` e `brief.txt` ficam na raiz do sandbox, um nível acima do projeto. Um agente que suba um nível descobre que está numa simulação — e descobrir isso não lhe diz onde gravar, que é a única coisa medida. Fingir o contrário custaria complexidade e não compraria critério nenhum.

**Não mede a skill.** Isso é a suíte, em [`../tests/run.sh`](../tests/run.sh). Aqui o verde só quer dizer *o mundo era o que dizia ser* — e foi para não confiar nesse verde de graça que a [prova](blind-run.proof.sh) planta cada uma das nove afirmações e exige o vermelho.
