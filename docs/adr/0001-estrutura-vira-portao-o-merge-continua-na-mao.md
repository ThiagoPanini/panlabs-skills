# Estrutura de skill vira portão, e o merge continua na mão

Este repositório passa a ter CI, e ela mede **uma coisa só**: se cada diretório sob `skills/` é uma skill bem construída — frontmatter, referência interna, peso. Isso reprova, trava o merge, e não tem isenção nem baseline.

O que **não** entra é tudo o que a doutrina de trabalho paralelo cobra: a união entre branches, a suíte de uma skill, o `git push origin main` direto. Continuam sendo disciplina de sessão, sem servidor nenhum atrás — e o gatilho que os reabriria fica de pé, intacto, sem ter sido consumido aqui.

Decidido em [O ADR que reabre a decisão "sem CI" — e diz que o gatilho não disparou](https://github.com/ThiagoPanini/panlabs-skills/issues/73), sob o mapa [o portão de estrutura de skill](https://github.com/ThiagoPanini/panlabs-skills/issues/66).

## O gatilho escrito não disparou, e isso vem primeiro

A [`docs/agents/workflow.md`](../agents/workflow.md) fechava prometendo este documento, e dizia sob que condição ele viria:

> **O gatilho para reabrir**, se um dia doer mais do que o portão custaria: dois merges verdes que quebraram a árvore no mesmo mês.

**Não aconteceu.** Nenhum par de merges verdes quebrou a árvore — nem no mesmo mês, nem em meses diferentes. Quem for procurar os dois merges não vai achar, e é para não deixar ninguém procurando que esta seção é a primeira.

A reabertura veio de outra dor: **implementações de skill saindo desalinhadas, sem diretiva que diga a um agente o que se espera dele antes de escrever, e sem nada medindo o que ele escreveu.** Não é a dor que o gatilho vigiava.

**Uma marca no contador, e uma não é duas.** A leitura que produziu este documento achou **uma** ocorrência da forma que o gatilho de fato vigia: `7d20bfa` mudou `motor/planejar.cjs` sem regenerar `tests/motor.manifesto.json`, e a suíte de `panlabs-aws-diagrams` está vermelha na `origin/main` desde então — *"o motor mudou desde a última medição da suíte"*. É exatamente a classe que a doutrina já nomeia em **Derivado não se mergeia, se regenera**. Mas o gatilho pede **duas** no mesmo mês, e esta é uma — então ele continua sem ter disparado, e este ADR **não se apoia nela**. Fica registrada como a primeira marca no contador dele, para quem for conferir depois.
>
> **Desfecho.** O vermelho foi apagado pelo [#53](https://github.com/ThiagoPanini/panlabs-skills/issues/53), que renomeou a árvore inteira e por isso teve de regenerar o manifesto de qualquer forma — pela regra do derivado, `--write`, não escolha de lado. A [#80](https://github.com/ThiagoPanini/panlabs-skills/issues/80), aberta só para esse conserto, foi absorvida ali. **A marca no contador continua valendo**: ela conta o merge verde que quebrou a árvore, e esse merge aconteceu — quem o consertou, e quando, não desconta o evento. Os dois caminhos citados acima hoje se chamam `engine/plan.cjs` e `tests/engine.manifest.json`.

### O gatilho mede quebra; a dor é deriva

Essa é a razão inteira de ele não ter disparado, e ela não é acidente de calibragem: **o gatilho escuta um sinal que esta classe de defeito não emite.** O caso acima ao menos acendeu vermelho em algum lugar — a suíte da skill. Deriva de skill não acende em lugar nenhum: a árvore não quebra, e os quatro casos que este repositório já tem documentados aterrissaram **verdes**:

| o que entrou | o que o repositório mediu |
| --- | --- |
| A árvore de `panlabs-aws-diagrams` nasceu com idioma misto — **81 de 539** arquivos rastreados sob diretórios em português dentro de uma árvore cujos irmãos são ingleses ([`CLAUDE.md`](../../CLAUDE.md) § *Dívida conhecida*) | nada |
| O `git mv` do [#36](https://github.com/ThiagoPanini/panlabs-skills/issues/36) aterrissou `docs/aws-diagrams/decisoes.md` apontando para `docs/SKILL.md`, **que nunca existiu**. Uma revisão humana pegou o link irmão e deixou este passar ([#56](https://github.com/ThiagoPanini/panlabs-skills/issues/56)) | nada — a suíte de 43 checks estava verde |
| A árvore bateu **29 MB de 30 MB** porque nada media isso antes de o empacotador rodar ([`docs/research/skill-validation-checks.md`](../research/skill-validation-checks.md)) | nada, até a auditoria manual |
| O `SKILL.md` — porta de entrada da skill e o único arquivo que **todo** ticket edita | nada |

A última linha não é dedução minha. É a própria `workflow.md` escrevendo, a duzentas linhas de distância de onde escreveu o gatilho:

> A suíte mede o motor; o `SKILL.md` é a porta de entrada da skill, o único arquivo que todo ticket edita, e **nada o verifica**.

**A doutrina não estava errada — estava incompleta, e disse isso por escrito.** Ela nomeou o buraco e não o fechou, porque o gatilho que escreveu vigiava a outra metade. Esperar por ele para tratar deriva seria esperar para sempre: um portão que só liga depois de dois vermelhos nunca liga contra um defeito que só produz verde.

## A decisão original tratava como uma coisa o que são duas

*"Sem CI"* respondia a uma pergunta só. São duas, e elas têm formas diferentes:

| | a pergunta | o que a resposta exige | quem conserta |
| --- | --- | --- | --- |
| **portão de merge** | esta união mente? esta suíte quebrou? | **julgamento** — ler as duas árvores e decidir se o verde é verdade | o mantenedor, na hora, lendo |
| **portão de estrutura** | esta skill está bem construída? | **leitura mecânica** de uma árvore só | o próprio diff que causou |

Separadas, cada uma recebe a resposta que merece: a de cima continua fora, a de baixo passa a valer. Juntas, a de cima arrastava a de baixo — e foi o que aconteceu.

### O argumento original, auditado perna por perna

A frase que fundou o *"sem CI"* tinha três pernas. Nenhuma foi descartada; elas se comportam de formas diferentes, e é a diferença que produz o corte.

**1. *"o produto aqui é skill e artefato de agente"* — esta perna virou do avesso.** Ela foi oferecida **contra** a CI, na leitura *"não há compilação, logo não há o que medir"*. Essa leitura vale para o portão de merge e falha para o de estrutura: se o produto é skill, então *"isto é uma skill bem formada?"* não é etapa de build — é a **definição de correto do próprio produto**. A perna que dizia que não havia nada a medir é exatamente a que diz o que medir.

**2. *"o 'build' é a suíte de uma skill só"* — intacta, e é ela que segura o portão de merge fora.** Aquela suíte mede o motor de `panlabs-aws-diagrams`: é **checagem de invocação** — roda dentro da skill, em runtime, e é problema dela. O portão que entra é **validação de desenvolvimento** — roda no repositório, sobre a árvore, e vale para qualquer skill independentemente do que ela faça. O mapa corta gate de teste por skill em voz alta, *"muito profundo para o momento atual"*. A perna 2 sobrevive e continua trabalhando.

**3. *"um ruleset num repo de um mantenedor troca alguns merges perdidos por um portão que ninguém pode destravar"* — verdadeira, e assimétrica entre as duas.** É a perna do custo, a única que de fato se paga, e ela não cobra o mesmo dos dois lados.

### Um portão vale a tranca quando a falha nomeia o próprio conserto

- **A união vermelha diz *"estas duas branches tocaram o mesmo arquivo"*.** A suíte vermelha diz *"1 de 43"*. Nenhuma das duas diz o que fazer. Alguém tem de ler as duas árvores e julgar — e num repo de um mantenedor esse alguém é **a mesma pessoa que a tranca está bloqueando**, sem segunda instância para recorrer. É literalmente o portão que ninguém pode destravar, e o medo estava certo.
- **A estrutura vermelha diz *"esta skill não tem `SKILL.md`"*, *"este caminho é citado e não existe"*, *"esta árvore passou do teto"*.** O achado **é** o conserto. Não há o que destravar, porque não há julgamento a sobrepor — trancar aqui é trancar uma porta que ninguém quer atravessar ao contrário.

É esse o corte, e é por isso que ele não é arbitrário: **o custo que a perna 3 cobra é proporcional ao julgamento que a falha exige, e a falha de estrutura não exige nenhum.**

## O que continua fora, e o gatilho preservado

Continuam **sem portão**, exatamente como estavam:

- a **união** entre uma branch e o que entrou na `origin/main` enquanto ela trabalhava;
- a **suíte** de uma skill — checagem de invocação, problema da skill;
- o **`git push origin main`** direto;
- e todo o resto da doutrina de sessão: território declarado, registro append-only, movimento de terra sozinho, derivado regenerado em vez de mergeado.

**O gatilho original fica de pé, palavra por palavra, e este ADR não o consome:** *dois merges verdes que quebraram a árvore no mesmo mês.* Se ele disparar um dia, reabre o portão **de merge** — que é decisão diferente da que este documento toma.

**Uma nota de estado para quem o disparar.** O gatilho é a **pergunta**, não a ferramenta: *a união mente? a suíte quebrou?* Não existe hoje régua automatizada da união nesta árvore, e o gatilho não pressupõe nenhuma — quem o disparar decide com que ferramenta responde, e a resposta nasce como todo check desta casa, com prova ao lado.

## Consequences

**A [esteira](https://github.com/ThiagoPanini/panlabs-skills/issues/72) fica destravada.** Ela declarava, por escrito, que esperava este documento — ligar o portão antes dele deixaria o repositório com uma doutrina contradizendo a própria CI, que é a classe de estrago que o mapa inteiro existe para evitar. Com este arquivo na `main`, a última frase da doutrina que a contradizia deixou de existir.

**A doutrina passa a ter duas camadas, com donos diferentes.** A de sessão — união, suíte, território, append-only — **ninguém aplica além de você**. A de estrutura, o servidor aplica. É a primeira coisa deste repositório da segunda espécie, e daqui em diante toda regra nova precisa declarar em qual camada nasce. Regra que não sabe dizer é regra que vai ser cobrada no lugar errado.

**Um vermelho de estrutura não tem saída negociada.** Sem isenção, sem arquivo de config por skill, sem baseline de falhas conhecidas — as três são o mesmo buraco com nomes diferentes, e é por onde o primeiro agente apressado desliga a checagem em vez de consertar. O preço é que uma checagem mal calibrada trava a fila até ser corrigida **no código dela**, e isso é aceito de propósito.

**Este ADR não diz como a esteira é construída.** Gatilho, forma do workflow, e o comando que liga o required check são da [#72](https://github.com/ThiagoPanini/panlabs-skills/issues/72); o catálogo de regras é das famílias de checagem; o *porquê* de cada família e o que nunca virou checagem são da [diretiva](https://github.com/ThiagoPanini/panlabs-skills/issues/74). Aqui se decide **o que é gateado**, e só. O repositório já pagou duas vezes por doutrina escrita antes do que ela descreve (`1ddbcd2`, `e43448d`).

**`docs/adr/` nasce com este arquivo, e com ele a reta numérica.** A `workflow.md` já documenta `docs/adr/NNNN-slug.md` como a colisão de alocação que o git mergeia verde, com o precedente medido no repo irmão: dois `0013` convivendo, entrados por PRs diferentes, nenhuma linha vermelha em lugar nenhum. **O próximo ADR confere a reta antes de tomar o número.**

## Quando este ADR se reabre

**Se um vermelho de estrutura precisar de julgamento.** O corte inteiro se apoia em a falha de estrutura nomear o próprio conserto. No dia em que uma reprovação legítima não tiver conserto mecânico — e a resposta certa for sobrepor o portão em vez de consertar o diff —, a assimetria da perna 3 quebrou, e a tranca passa a custar aqui o que custa lá. Um pedido de isenção é esse dia chegando; trate-o como reabertura, não como exceção.

**Se o repositório deixar de ser de um mantenedor.** *"Um mantenedor"* é premissa declarada, não pano de fundo: é dela que sai tanto *"não há segunda instância para destravar"* quanto *"o autor do commit é quem instala"*. Pull request rotineiro de terceiro move as duas.

**O portão de merge reabre pelo gatilho dele**, que continua sendo dois merges verdes quebrando a árvore no mesmo mês — e não por este documento ter aberto a porta da CI.
