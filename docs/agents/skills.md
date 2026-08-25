# Skills desta casa: o que se espera de você antes de escrever

Este documento é a metade da régua que **nenhum comando entrega**. A outra metade é `scripts/check-skills.sh`, que julga toda skill sob `skills/` e sabe se defender sozinho — rode-o antes de abrir PR, porque a esteira roda exatamente o mesmo comando e descobrir o vermelho na sua máquina custa segundos em vez de um ciclo.

O vocabulário usado aqui — **portão de estrutura**, **família de checagem**, **prova**, **regra de sessão** — está definido em [`CONTEXT.md`](../../CONTEXT.md). Se um termo daqui parecer ambíguo, ele provavelmente é um par que este repositório separou, e a separação está lá.

## A lista de regras não mora aqui

```
scripts/check-skills.sh --list
```

Isso imprime as regras vigentes, agrupadas por família, direto de quem as impõe. **Este documento não guarda uma cópia dela**, e a razão não é economia de linhas: uma lista copiada é uma segunda fonte que ninguém atualiza no mesmo commit que a primeira, e a que envelhece é sempre a que o agente lê. O repositório já pagou duas vezes por doutrina descrevendo o que não existia mais (`1ddbcd2`, `e43448d`).

O que este documento guarda é o que o `--list` **não consegue** dizer: por que cada família existe, e as regras que nenhuma família consegue medir.

## Por que cada família existe

As linhas abaixo **nomeiam** cada família para você saber de qual se fala; quem diz o que ela exige, com os limiares em vigor, é o `--list`. O cabeçalho de cada `scripts/checks/<família>.sh` guarda o raciocínio do check — o que ele lê, o que deliberadamente não lê, e onde a regra foi buscada. O que está aqui é a terceira pergunta: **que estrago concreto ela existe para não deixar acontecer de novo.** Três das quatro nomeiam um estrago que este repositório já sofreu.

### `skill-md-present` — o chão em que as outras três pisam

Todo diretório sob `skills/` carrega um `SKILL.md` na raiz. É a regra mais barata do conjunto e a que sustenta as outras: `SKILL.md` é o único arquivo que o runtime lê para decidir se a skill se aplica, e as outras três famílias abrem esse mesmo arquivo para trabalhar — sem ele, os veredictos delas não são falsos, são **indisponíveis**.

O estrago aqui não é um incidente, é uma ausência que o [ADR 0001](../adr/0001-estrutura-vira-portao-o-merge-continua-na-mao.md) mediu: o `SKILL.md` é a porta de entrada da skill e o único arquivo que **todo** ticket edita, e até esta família existir nada o verificava. Ver [`skill-md-present.sh`](../../scripts/checks/skill-md-present.sh).

### `references` — quem instala recebe só o diretório

Toda referência relativa dentro de um arquivo da skill resolve **para dentro** da árvore dela, e resolve para algo que existe. As duas metades vêm de estragos diferentes.

**Para dentro**, porque quem instala uma skill recebe o diretório dela e nada ao lado: um link que sobe para fora funciona na máquina que o escreveu e quebra em todas as outras. **Para algo que existe**, porque `git mv` move os bytes de um arquivo e não reescreve uma linha do conteúdo dele — foi assim que um documento desta árvore aterrissou apontando para um caminho que nunca existiu, com a suíte de 43 checks da skill **verde** e uma revisão humana tendo pego o link irmão e deixado este passar ([#56](https://github.com/ThiagoPanini/panlabs-skills/issues/56)). Ver [`references.sh`](../../scripts/checks/references.sh).

### `frontmatter` — as seis regras em que quatro implementações convergem

Allowlist de seis campos, `name` e `description` presentes e dentro do limite, e `name` igual ao nome do diretório. É o único conjunto do campo inteiro onde a especificação aberta, o validador de referência `skills-ref`, o `quick_validate.py` da própria Anthropic e o `skill-lint` da comunidade concordam.

Esta é a única das quatro cujo estrago documentado **não é desta casa** — as duas skills já passavam antes de ela existir. O estrago é do pré-validador oficial: o `quick_validate.py` guarda toda checagem de formato atrás de `if name:`, então `name: ""` atravessa sem que uma única regra rode, e ele nunca checa o casamento com o diretório, que a própria spec declara obrigatório. Duas armadilhas achadas por leitura de código, relatadas em doc nenhuma — e é por isso que esta família é escrita aqui em vez de delegada. Ver [`frontmatter.sh`](../../scripts/checks/frontmatter.sh) e [a pesquisa](../research/skill-validation-checks.md).

### `weight` — o teto que a árvore encostou sem ninguém ver

Três orçamentos: quanto o pacote pesa, quantas linhas o `SKILL.md` tem, e se toda cerca de código markdown fecha.

A árvore de `panlabs-aws-diagrams` chegou a **29 dos 30 MB** e ninguém soube até uma auditoria manual, porque nada media isso antes do empacotador rodar — e o que a encheu foi render que o `.gitignore` escondia do `git status`, mas que o empacotador oficial leva assim mesmo, porque ele também não lê `.gitignore`. Esta família mede o mesmo universo que o empacotador leva, pela mesma razão. O teto de linhas é mais baixo do que os 500 que o campo inteiro repete como conselho, e ao contrário deles **reprova**: as duas skills passam com folga hoje, e o número existe para que nenhuma dobre de tamanho sem alguém decidir isso. A cerca aberta engole tudo que vem depois dela para o próximo leitor, agente incluído, e a leitura não se recupera no meio do arquivo. Ver [`weight.sh`](../../scripts/checks/weight.sh).

## O que nunca virou checagem

Neste repositório **tudo que entra reprova**: regra que não vale reprovar não vale ser checagem. As que sobram estão abaixo, e sobram por uma de duas razões — nenhuma máquina consegue julgá-las, ou o falso positivo custaria mais do que o defeito. São **regras de sessão**: ninguém as aplica além de você.

### A `description` nomeia o gatilho

O portão confere que ela existe e cabe no limite que a especificação declara. Não há como conferir a única coisa que importa nela: se a frase diz **quando** buscar a skill.

É a regra de maior consequência da lista, porque `name` e `description` são o que o runtime carrega **sempre**, e o corpo do `SKILL.md` é o que ele carrega **nunca**, até decidir pela description que vale a pena. Uma skill cuja description descreve só o que ela faz é uma skill que existe e não dispara. A forma que esta casa usa está nas duas que já existem: o que a skill faz, travessão, e uma lista dos casos concretos que devem alcançá-la — *"Use ao criar um serviço Python do zero, ao revisar um existente, ou ao decidir…"*.

### O `SKILL.md` guarda o que toda invocação precisa; o resto desce um nível

A especificação nomeia três níveis de divulgação: metadados sempre carregados, corpo do `SKILL.md` carregado quando a skill ativa, e arquivos de apoio carregados só quando referenciados. O portão conta linhas — um número, não um julgamento. Ele não sabe dizer que aquele parágrafo específico só interessa a um caminho de execução e deveria estar um nível abaixo.

Mantenha as referências **um nível** a partir do `SKILL.md`. Cadeia de referência aninhada faz o agente pagar duas leituras para chegar onde uma bastaria.

### Acrescente o que falta ao agente; omita o que ele já sabe

O maior peso morto de uma skill não é o arquivo grande — é o parágrafo que ensina ao modelo algo que ele já faz por padrão. Ele custa contexto em toda invocação e não muda comportamento nenhum. Nenhuma família mede isso, e é o julgamento que mais decide se a skill vale o que carrega.

### Tudo que fica dentro da skill é alcançável a partir do `SKILL.md`

A família `references` varre uma direção só: todo link resolve para dentro e para algo que existe. A direção contrária — um arquivo dentro da árvore que **nada** alcança — é regra do `skill-lint` e este repositório escolheu não a adotar, porque decidir "alcançável" exigiria adivinhar o que conta como referência, e o falso positivo dessa adivinhação apaga arquivo. Fica com você: o que a skill não usa, sai.

### `name` em ASCII, e as duas palavras que a plataforma recusa

`name` casando com o diretório já carrega o ASCII de graça enquanto todo diretório desta árvore for ASCII — no dia em que um não for, o portão fica em silêncio sobre isso. Escreva `name` em `[a-z0-9-]`, sem hífen na ponta e sem hífen duplo.

Separadamente: a plataforma Anthropic recusa `<`, `>` e as palavras `anthropic` e `claude` em `name` e `description`. Isso **não está** na especificação aberta — três fontes independentes concordam nas duas metades — e por isso não é checagem aqui, onde nada é publicado na Skills API. Vira problema no dia em que for.

### A árvore da skill tem a forma que o trabalho dela pede

`scripts/`, `references/` e `assets/` são **recomendação de convenção**, e a especificação diz isso com todas as letras: o único arquivo obrigatório na raiz é o `SKILL.md`, e a skill pode conter quaisquer outros arquivos e diretórios. Um `references/` vazio criado para parecer conforme é peso sem função.

## Quando você acrescentar uma regra

Decida primeiro **em que camada ela nasce** — o [ADR 0001](../adr/0001-estrutura-vira-portao-o-merge-continua-na-mao.md) fixa que toda regra nova responde isso antes de existir, e por quê. O que segue é como responder.

- **Vale reprovar um merge por causa dela, e a reprovação nomeia o próprio conserto?** Então é **regra de estrutura**: vira família de checagem, com a prova ao lado, e o `--list` passa a imprimi-la. A forma exata de uma família está no cabeçalho de [`check-skills.sh`](../../scripts/check-skills.sh).
- **Ela exige julgamento, ou o falso positivo dela custa mais que o defeito?** Então é **regra de sessão**: vira uma seção deste documento, com o estrago que a motivou junto. O portão tem um degrau só, e ele reprova — é por isso que esta é a metade que mora em prosa.
