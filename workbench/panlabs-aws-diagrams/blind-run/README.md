# A simulação cega

O protocolo de aceitação da spec [#35](https://github.com/ThiagoPanini/panlabs-skills/issues/35), fase 5 — [#47](https://github.com/ThiagoPanini/panlabs-skills/issues/47). Não é teste automatizado e não roda na esteira: roda **uma vez**, quando alguém quer saber como a skill se comporta na mão de quem acabou de instalá-la e não tem nenhum material complementar.

O que mora aqui é o **ambiente** da corrida, não a corrida. O agente cego continua sendo um sub-agente sem contexto nenhum, conduzido à mão; o que o `blind-run.sh` faz é montar o mundo em que ele acorda, e depois provar que esse mundo era o que dizia ser.

## Por que ele existe — a corrida de 2026-08-26

A primeira corrida do #47 rodou **dentro deste repositório**, e duas coisas deram errado ao mesmo tempo. Nenhuma das duas era sobre a skill.

**O sub-agente se recusou a gravar, e estava certo.** Ele leu o `CLAUDE.md`, reconheceu o `panlabs-skills` como um repositório público de skills e não como o projeto de um cliente, e recusou escrever uma arquitetura fictícia de dado de saúde dentro dele. Escreveu fora de git, onde o `tools/case.cjs` caiu no comportamento documentado — "fora de repositório git cai no diretório corrente, com aviso". O motor funcionou como projetado; quem desviou foi a escolha de onde rodar. Um protocolo cujo destino é *"o repositório em que você está"* só mede alguma coisa quando esse repositório pode plausivelmente ser o de quem chama.

**E a cópia que a simulação preparou nunca foi a que rodou.** O sub-agente encontrou a skill pela instalação **global** já existente na máquina — `~/.claude/skills/panlabs-aws-diagrams`, um link que resolve para o checkout principal —, não pela cópia isolada da branch descartável. Ocultar o `workbench/` numa branch não neutralizou nada: o corpus de modelos ficou a um `../..` de distância o tempo todo. Nada foi procurar por ele, o que é sorte, não isolamento. [#121](https://github.com/ThiagoPanini/panlabs-skills/issues/121).

**A corrida de 2026-08-27 foi a primeira sob este harness, e o veredito dela está no [#47](https://github.com/ThiagoPanini/panlabs-skills/issues/47).** O critério que motivou o #121 passou — `docs/architecture/diagrams/labmove-duas-contas/` nasceu na raiz do projeto sintético —, e o resto rendeu quatro tickets: [#133](https://github.com/ThiagoPanini/panlabs-skills/issues/133) — já aterrissado —, [#137](https://github.com/ThiagoPanini/panlabs-skills/issues/137), [#138](https://github.com/ThiagoPanini/panlabs-skills/issues/138) e [#139](https://github.com/ThiagoPanini/panlabs-skills/issues/139). Falha vira ticket, não ajuste de prompt.

## O que o harness monta

```bash
workbench/panlabs-aws-diagrams/blind-run/blind-run.sh setup      # monta e imprime o prompt
workbench/panlabs-aws-diagrams/blind-run/blind-run.sh verify     # audita o isolamento
workbench/panlabs-aws-diagrams/blind-run/blind-run.sh teardown   # devolve a máquina
workbench/panlabs-aws-diagrams/blind-run/blind-run.sh paths      # os nomes que ele decide, key=value
```

O `paths` existe porque a **prova** precisa deles, e prova que soletra de novo o que mede é uma segunda cópia que diverge: a primeira versão dela repetia o nome do registro de estacionamento, e renomeá-lo no harness deixava a prova verde com o caso *"o registro sumiu"* olhando para um caminho que não existia sob nome nenhum. De quebra, é a resposta honesta a *"onde é que isso põe as coisas?"*.

**Um projeto de chamador que não é este repositório.** [`project/`](project/) é a árvore da `labmove-platform` — uma plataforma de coleta domiciliar de exames, com README próprio, dois serviços e um `docs/architecture/` com um ADR dentro. O `setup` materializa essa árvore no sandbox e faz dela um repositório git com identidade própria. A objeção de confidencialidade se dissolve porque a arquitetura que vai ser desenhada **é a daquele projeto**.

**Uma cópia da skill, cortada da origem.** A cópia sai do que o `git ls-files` diz que a skill carrega — nada de lista paralela de exclusões para divergir do `tools/package.sh` — e é **cópia, não link**. O `tools/install.sh` linka de propósito, para a skill instalada nunca ficar velha; aqui o requisito é o oposto, porque link sobe de volta na árvore de onde veio.

**Toda porta da máquina apontando para essa cópia.** Cada skill home — por padrão `~/.claude/skills` e `~/.agents/skills`, os dois que o `install.sh` escreve — tem a sua entrada repontada para a cópia, e o original fica registrado num arquivo ao lado. **O registro fica junto do skill home, não dentro do sandbox**: o sandbox mora no temporário do sistema e a máquina pode varrê-lo, e restauração que depende do sandbox é restauração que para de funcionar justamente quando é necessária. O `teardown` também aceita não ser informado de quais portas fechar — o sandbox guarda a lista, para uma corrida montada com `--skill-home` não-padrão não deixar aquela porta estacionada apontando para um sandbox que ele mesmo está prestes a apagar.

**E ele só apaga o que carimbou.** O `--at` aceita o que lhe derem, e uma versão anterior removia esse caminho sem perguntar: apontada para um diretório pessoal, ela o apagava e reportava *"the machine is back where it was"*. O carimbo é escrito no instante em que o `setup` cria o diretório — então um sandbox construído pela metade ainda é removível, e a árvore de outra pessoa nunca é. É a mesma regra que o `restore_home` já guardava uma função acima: nunca apagar o que este harness não pôs ali.

### O que o `verify` mede

Onze afirmações, cada uma com o seu vermelho plantado em [`blind-run.proof.sh`](blind-run.proof.sh):

| | |
|---|---|
| o projeto de chamador é a raiz do próprio repositório git | senão o `case.cjs` grava em outro lugar |
| ele não se chama `panlabs-skills`, e nada nele nomeia `panlabs-skills` | é o que o sub-agente leu antes de recusar |
| ele **nunca** nomeia `docs/architecture/diagrams` | senão o critério passa por construção e não mede nada |
| a skill instalada é diretório de verdade, não link | link sobe de volta para a bancada |
| o git, perguntado de dentro da cópia, responde o projeto de chamador | é literalmente o que o `case.cjs` pergunta |
| nenhum link dentro do sandbox resolve para fora dele | |
| nenhum ancestral da cópia carrega `workbench/` ou uma segunda instalação | é o vazamento do #47, que se alcança **subindo**, não por link |
| o escopo de módulo dos `.js` da cópia vem de dentro do sandbox | senão quem decide como o motor é lido é a máquina — ver abaixo |
| toda porta declarada resolve para dentro do sandbox | |
| cada uma delas tem o seu registro de restauração | sem ele o `teardown` não sabe o que devolver |
| nada apareceu na árvore que a corrida não devia tocar | é o critério 9 do #47, e ele já falhou uma vez — ver abaixo |

**As duas afirmações de identidade leem o commit do fixture, não a árvore de trabalho.** O `setup` fixa o SHA e o `verify` procura só ali. Elas são sobre o que o **fixture** diz; a árvore de trabalho também carrega o que o agente cego escreveu, e uma corrida que legitimamente gravasse as palavras `docs/architecture/diagrams` no próprio `case.md` seria reprovada por ter produzido exatamente aquilo que lhe pediram.

**O escopo de módulo virou checagem porque a primeira corrida morreu nele.** O Node decide se um `.js` é CommonJS ou ESM pelo `package.json` mais próximo subindo a árvore, e o `engine/vendor/elk.bundled.js` era o único `.js` de uma árvore que no resto é `.cjs`. A corrida caiu num sandbox cujo `package.json` mais próximo era um `/tmp/package.json` esquecido por uma extração do draw.io desktop, `"type": "module"` — o bundle UMD foi avaliado como ESM, o `require` devolveu um namespace congelado e vazio, e o motor morreu em `ELK is not a constructor` sem nada na mensagem apontando para a causa. O defeito da skill virou o [#133](https://github.com/ThiagoPanini/panlabs-skills/issues/133) e **já aterrissou** no mesmo dia: o bundle passou a ser `.cjs`, e hoje não há `.js` nenhum na árvore para ser lido de um jeito ou de outro.

**A checagem fica**, porque a propriedade que ela guarda é do **sandbox**, não da skill: no dia em que um `.js` voltar — um bundle novo, um arquivo gerado — quem decide como ele é lido não pode ser a máquina. É para isso que o [`project/package.json`](project/package.json) existe: ele fixa o escopo dentro do sandbox, e apagá-lo deixa o `verify` vermelho em vez de entregar em silêncio uma skill diferente para a próxima corrida. A prova planta a própria sonda `.js` em vez de tomar emprestado o arquivo da skill — a primeira versão tomava emprestado, e parou de rodar no dia seguinte, quando o #133 renomeou o arquivo.

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

**Isso não é hipótese, e por isso virou checagem.** A corrida de 2026-08-27 gravou o caso no lugar certo **e** deixou três arquivos de rascunho na árvore de quem abriu a sessão — o processo do agente nasce lá, e o harness sabe entregar caminho de projeto, não diretório de trabalho. O `setup` tira uma foto de `git status --porcelain` da árvore observada e o `verify` compara: o que apareceu no meio da corrida sai nomeado, em vez de depender de alguém lembrar de digitar `git status` depois. A foto guarda o caminho que observou, então apontá-la para outra árvore é o que deixa a prova rodar sem tocar nesta.

**Não esconde que existe um harness.** `prompt.txt` e `brief.txt` ficam na raiz do sandbox, um nível acima do projeto. Um agente que suba um nível descobre que está numa simulação — e descobrir isso não lhe diz onde gravar, que é a única coisa medida. Fingir o contrário custaria complexidade e não compraria critério nenhum.

**Não mede a skill.** Isso é a suíte, em [`../tests/run.sh`](../tests/run.sh). Aqui o verde só quer dizer *o mundo era o que dizia ser* — e foi para não confiar nesse verde de graça que a [prova](blind-run.proof.sh) planta cada uma das onze afirmações e exige o vermelho. **A camada 0 daquela suíte roda esta prova**, porque ela nasceu sem ninguém que a rodasse e apodreceu em menos de um dia: o #133 renomeou justamente o arquivo que um dos casos tomava emprestado, e nada ficou vermelho. Prova que servidor nenhum roda é prova só vista verde.
