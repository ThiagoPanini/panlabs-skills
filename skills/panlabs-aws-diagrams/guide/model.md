# Escrever o modelo

O esquema é a fonte da verdade e carrega a razão de cada campo na própria `description` — **leia [`../schema.json`](../schema.json)**, não uma cópia dele. Este arquivo é só o que o esquema não consegue dizer sobre si mesmo. Comando aqui roda da raiz da skill, como no [`SKILL.md`](../SKILL.md).

## A fronteira, e por que ela se sustenta

> **O agente escreve o QUE existe. O motor calcula ONDE fica.**

Nenhuma propriedade do esquema nomeia posição, tamanho, distância ou direção, e todo objeto é `additionalProperties: false`. Não existe onde escrever uma coordenada.

A escolha é deliberada: regra que depende de disciplina se perde na terceira sessão; **ausência de palavra, não**. É o mesmo movimento do vocabulário de tema, e é conferido mecanicamente por `check-model-boundary.cjs`, validado com experimento de controle — injetando `x` no esquema, tirando um `additionalProperties: false` e pondo `position` num modelo, a checagem acusa as três e sai vermelha.

Se você está tentado a mover uma caixa, o lugar de agir é o **modelo** (o fato que falta) ou o **tema** (a métrica), nunca a geometria.

## Qual dos quatro contratos

| `$id` | esquema | escreva este quando |
|---|---|---|
| `model@1` | [`../schema.json`](../schema.json) | você tem **uma** vista e quer o `.drawio` — é o que o motor come |
| `session@1` | [`../session/schema.json`](../session/schema.json) | a conversa tem as **duas** vistas, um acordo e um dossiê para atravessar sessões |
| `theme@1` | [`../theme/schema.json`](../theme/schema.json) | você está configurando identidade visual — ver [`visual.md`](visual.md) |
| `elaboration@1` | [`../session/elaboration.schema.json`](../session/elaboration.schema.json) | você está na fase técnica e vai aplicar um delta sobre o modelo aprovado |

`session@1` **não** é o que o motor come: ele projeta para `model@1`. A diferença entre a vista lógica e a técnica não é outro modelo, é outro **casaco** sobre os mesmos nós, mais os nós que só a camada técnica tem.

**Toda chave de contrato é inglesa** — nas quatro. A prosa que explica continua portuguesa, aqui e dentro das `description` dos próprios esquemas, e é só isso que a fronteira de idioma separa. Nome de campo em português é de antes do #53 e não existe mais em contrato nenhum: um delta que ainda os traga é recusado campo por campo, com a crase valendo como marca de que a chave está viva.

### O delta de elaboração

`elaboration@1` tem esquema próprio — [`../session/elaboration.schema.json`](../session/elaboration.schema.json) — desde o #37. `elaborate()` valida a FORMA do delta contra ele antes de aplicar qualquer regra de domínio, e `check-single-schema.cjs` o varre junto dos outros três. Os mapas (`facets`, `inside`, `refines`, `facetEdges`) ficam com valor solto no esquema — as chaves são ids imprevisíveis aqui, e a forma de cada valor (em particular a de um casaco técnico) é conferida de novo, já fundida no modelo inteiro, por `session/validate.cjs` contra `session@1`.

Ele não é um segundo modelo — é o que a fase técnica **acrescenta** ao que a sessão anterior aprovou. Campos, todos opcionais além de `schema` e `about`:

| campo | forma | o que faz |
|---|---|---|
| `about` | id do modelo | recusa se não bater com o modelo aberto |
| `nodes` | lista | infraestrutura nova. `layer: "technical"` obrigatória, e **casaco lógico é recusado** |
| `facets` | `{ id: technicalFacet }` | veste um nó **aprovado** de serviço AWS |
| `inside` | `{ id: newParentId }` | reparenta um nó aprovado para dentro de nível novo — **a operação de risco** |
| `refines` | `{ edgeId: { by: [ids], labels: [...] } }` | transforma uma aresta aprovada num caminho técnico |
| `edges` | lista | aresta que só a camada técnica tem |
| `facetEdges` | `{ edgeId: { label, protocol, order } }` | rótulo técnico numa aresta aprovada |
| `notes` `dossier` | | acrescentam |

Qualquer chave começada por `_` é comentário livre, em qualquer lugar do delta, e `elaborate()` não lê nenhuma.

`refines` merece a explicação. Tecnicamente, *"A avisa B"* passa por um barramento de eventos. O reflexo é apagar a aresta aprovada e escrever duas novas — e aí o extremo aprovado depende de alguém reescrever certo. Declarando os **saltos** em `by`, os extremos continuam sendo os mesmos objetos: a primeira aresta continua sendo a aprovada, com o rótulo lógico intacto, e a contração da projeção reconstrói o par original. Repare no `labels` ao lado do `by`: essa chave mora dentro de um mapa que o esquema deixa **aberto** (`refines` é `additionalProperties: true`), e por isso o esquema não a valida — quem a lê é `session/elaborate.cjs`, e um delta que a escreva com qualquer outro nome passa limpo e desenha os segmentos sem rótulo, calado. É a classe de chave que só o código guarda; o [#124](https://github.com/ThiagoPanini/panlabs-skills/issues/124) converteu a última que ainda vinha em português, nas duas pontas de uma vez.

Nenhum campo alcança um casaco lógico, e isso é **gramática, não disciplina**: não existe onde escrever, `elaborate()` recusa nó novo que traga casaco lógico, e a projeção confere depois. Se a capacidade é mesmo nova, a vista lógica mudou e precisa de **aprovação nova**, não de um casaco a mais.

## A segunda linha da folha: `resource` e `qualifier`

Esta é a razão de a vista técnica existir, e é o campo que mais some.

Toda folha é desenhada em **duas** linhas: o nome do serviço, e embaixo uma segunda linha em itálico. O nome diz o que o nó **É**; o itálico diz o que ele **é aqui**. Sem a segunda linha, três buckets S3 na mesma página são três ícones idênticos e ilegíveis, e o diagrama deixa de responder a pergunta que motivou desenhá-lo.

Quem alimenta a segunda linha são dois campos, e a precedência é fixa — `resource` ganha de `qualifier` quando os dois existem (`engine/resolve.cjs:144`):

| campo | responde | vive em | exemplo |
|---|---|---|---|
| `resource` | como este recurso **se chama** | só no casaco **técnico** | `pedidos-2024`, `lake-bruto`, `dlq-parse` |
| `qualifier` | o que este nó **faz aqui** | nas **duas** vistas | `guarda os pedidos`, `fila de retentativa` |

A vista lógica não tem `resource` de propósito: ela não conhece recurso, só capacidade — `logicalFacet` sequer declara o campo. Por isso a folha lógica sempre cai em `qualifier`, e a técnica quase sempre tem um `resource` a dizer.

**O erro que este campo existe para impedir é colar a descrição dentro do nome.** `"CloudTrail · trilha de auditoria dedicada"` numa string só produz uma linha comprida, sem itálico, que o motor não consegue medir nem quebrar, e que a projeção lógica não sabe descartar. Duas chaves, não uma:

```json
{
  "schema": "panlabs-aws-diagrams/elaboration@1",
  "about": "retail-300-stores",
  "_": "Três nós aprovados vestidos de serviço AWS. Cada casaco separa o que o serviço É (`service`, que resolve o ícone), como ele SE CHAMA aqui (`resource`, que vira a linha em itálico) e o que ele faz aqui (`qualifier`, a queda quando não há recurso nomeável).",

  "facets": {
    "guardar-bruto": {
      "kind": "service", "service": "s3",
      "resource": "lake-bruto",
      "qualifier": "zona bruta do lago"
    },
    "tratar-falha": {
      "kind": "service", "service": "sqs",
      "resource": "dlq-parse"
    },
    "consultar": {
      "kind": "service", "service": "athena",
      "qualifier": "consulta ad hoc sobre a zona curada"
    }
  }
}
```

O que o motor emite para essas três folhas, medido:

| nó | primeira linha | segunda linha, em itálico | de onde veio |
|---|---|---|---|
| `guardar-bruto` | Simple Storage Service (S3) | *lake-bruto* | `resource` ganhou de `qualifier` |
| `tratar-falha` | Simple Queue Service | *dlq-parse* | só havia `resource` |
| `consultar` | Athena | *consulta ad hoc sobre a zona curada* | não há recurso nomeável, caiu em `qualifier` |

Repare que a primeira linha **não** é a chave `service`: é o título oficial que o catálogo resolve a partir dela — mais uma razão para você não escrever `label` quando o título serve. Escrever `label` é para quando ele não serve, e mesmo aí ele continua sendo o **nome**, nunca o nome mais a descrição.

E repare no que este delta **não** faz: ele não dá segunda linha nenhuma à vista lógica. `qualifier` vive nas duas vistas, mas cada casaco tem o seu — o que a folha lógica mostra é o `qualifier` do `logicalFacet`, escrito na sessão em que a capacidade foi aprovada. A elaboração não alcança casaco lógico, e é por isso que a segunda linha da vista lógica é trabalho do turno 1.

Se o tema esconde ou não a segunda linha é decisão dele (`text.qualifier`). O texto é fato do modelo; a exibição é do tema.

## As sete armadilhas que o esquema não conta

### 1 · Resolva o nome do serviço antes de escrevê-lo

```bash
node catalog/aws-shapes.cjs "kinesis data firehose" "vpc endpoint" opensearch
```

A escada de resolução tem seis degraus, e a primeira que casa vence: desambiguação → renome → título ou stencil → sigla/apelido → **substring** → genérico.

**Só o quinto degrau ainda pode errar calado.** Genérico sempre foi a resposta de "não sei", mas até o #139 só o motor de geração avisava alto disso (`report.avisos`); esta CLI imprimia a mesma linha de um match bem-sucedido, com `generic` escondido dentro dos parênteses — é o caso de `aurora serverless`: "Aurora" e o ícone de categoria "Serverless" nunca compartilharam stencil, então a consulta sempre caiu em genérico, só que calada. Hoje a CLI imprime `⚠ generic <nome> -> ...` e sai com código de erro quando isso acontece. Substring é a outra forma de erro, e mais grave: casa — então nenhum aviso dispara — e podia casar com a coisa errada, com confiança total. Medido em 47 nomes plausíveis, dois casavam errado: `kinesis firehose` (linha abaixo) e `vpc endpoint`, que casava com **VPC** (um grupo!) porque a consulta continha as palavras "vpc" e "endpoint" e um desempate escolhia o ícone de serviço entre os dois candidatos reais e diferentes — o #139 tirou esse desempate, e agora esse tipo de colisão cai em genérico, ruidosamente, em vez de devolver uma resposta confiante errada. O que resta, porque não há colisão nenhuma para recusar — é uma palavra só, sozinha:

| você escreve | vira | devia ser |
|---|---|---|
| `kinesis firehose` | **Kinesis** | `kinesis data firehose` → Data Firehose |

`--explain` mostra a via de cada nó — `service` quando o título casou direto, `service:rename`, `service:substring`, e assim por diante. Qualquer coisa lendo `service:substring` merece uma segunda olhada.

Renomes e sinônimos funcionam e não são armadilha: `opensearch` → `elasticsearch_service`, `cloudwatch` → `cloudwatch_2`, `alb`/`nlb` → Elastic Load Balancing, `sagemaker` → SageMaker AI. O título do upstream nunca acompanha o rename de marketing; a escada resolve.

### 2 · `from` é quem INICIA, não de onde o dado sai

Polling é `from: consumidor` com `data: "back"`. Errar isso inverte a leitura de confiança do diagrama, e é a resposta que satisfaz *"o rótulo bate com a intenção"* sem olho humano.

`data: "back"` é **semântico e o layout obedece**: o eixo passa a seguir o dado, não a seta. A consequência foi paga de propósito — ver [`report.md`](report.md) sobre `A5.7`.

### 3 · Dimensão não é container

| fato | como entra | por quê |
|---|---|---|
| zona de disponibilidade | `az` na **subnet** | a árvore de contenção real é `Cloud › VPC › Subnet`. A AZ cruza a VPC; virar nível desenharia `us-east-1a` duas vezes — uma fronteira que não existe |
| unidade organizacional | `ou` na **conta** | não existe shape oficial de OU. Vira par ícone+rótulo sem caixa, e o agrupamento sai do contraste de espaçamento 1:4 |
| conta AWS | `kind: "account"` | esta **é** container — está na lista fechada de group icons |

Em ambos os casos o motor decide sozinho se a dimensão vira faixa desenhada ou fica só no rótulo. Você declara o fato; a política é dele.

### 4 · `layer` é escape, não pergunta — e são dois campos com o mesmo nome

Antes da regra, a homonímia, porque ela morde: **`layer` significa duas coisas conforme onde está escrito.**

| onde | o que significa | valores |
|---|---|---|
| no **nó** de `session@1` e no delta | onde o elemento existe na sessão | `both` (padrão), `technical` |
| no **nó** de `model@1` e no casaco técnico | andar de rede da subnet | `edge`, `application`, `data` |

Não é o mesmo conceito: aquele decide **presença**, este afirma um **fato de rede**. A coincidência é do vocabulário e está registrada na `description` dos dois — o resto desta armadilha é sobre o segundo.

Por padrão o motor lê o andar de rede de uma subnet **pelo que ela guarda** — pela categoria AWS de cada serviço dentro dela. O agente não responde nada a mais.

Declare `layer` só nos dois casos em que o conteúdo não sabe dizer:

- **subnet vazia** — não há de onde derivar;
- **o conteúdo diria errado** — a subnet de ingestão que hospeda os brokers.

Declarado vence derivado, e a divergência vira **aviso**, não erro. Nove das trinta categorias AWS têm significado de andar; as outras 21 calam, e quem cala não vota.

**Mistura vence o mais fundo.** Uma subnet com load balancer *e* banco é camada de dados. Não é gosto: é a regra protegendo o invariante que a justifica — *subnet com banco nunca acima de subnet sem banco*. Tomar o mais raso faria de um load balancer alavanca para subir a camada de dados.

### 5 · Faixa: você diz QUEM, o motor calcula ONDE

`bands[]` é para grupo que **cruza** a árvore de contenção — Auto Scaling group é o caso frequente. A caixa é a **união calculada** dos membros; `members` é a lista de ids e nada mais.

**Faixas de AZ não entram aqui.** São derivadas da dimensão `az` das subnets. Escrevê-las à mão duplica o que o motor já deriva.

A diferença entre grupo e faixa é semântica: **grupo afirma contenção, faixa afirma atributo compartilhado.** Por isso a faixa tem uma checagem própria — `F1`, abraça exatamente os membros que declara — e por isso as checagens de aninhamento não se aplicam a ela.

### 6 · O `dossier` é opaco ao motor

Procedência, confirmação, tuplas das candidatas, estacionamento e achados viajam dentro do arquivo e o motor **não lê um campo**. Uma superfície de entrada só, e o dossiê cresce sem tocar no motor.

O que precisa virar desenho, a sabatina **projeta** em `notes`:

| `notes[].origin` | o que carrega |
|---|---|
| `rejected-finding` | o único canal pelo qual a recusa do usuário vira marca no desenho |
| `assumption` | conflito com o context pack — ver [`context-pack.md`](context-pack.md) |
| `legend` | texto que o motor gera, como a travessia que virou frase na vista de detalhe |

`notes[].text` é **desenhado** — vira caixa presa ao nó quando há `about`. Texto longo empilha caixas em cima dos ícones. A frase fica curta; a citação inteira vai para o `dossier`.

### 7 · Lista plana com `inside`, nunca aninhamento

Acrescentar um nó a quatro níveis de profundidade é **uma linha no fim do arquivo**, não reindentar uma subárvore. A escolha é para quem escreve o modelo ser um LLM. O custo — ciclo de contenção passa a ser possível — são dez linhas de validação que já existem.

## Os três caminhos de layout, e quem escolhe

Não é opção sua. Cai do modelo:

| | gatilho | quem manda |
|---|---|---|
| **contas** | ≥2 nós `kind: "account"` | o motor na grade de contas; o ELK dentro de cada conta |
| **grade** | ≥2 AZs distintas **e** algum papel de subnet em ≥2 AZs | o motor no `x` das colunas; o ELK dentro da célula |
| **elk** | o resto | o ELK na hierarquia inteira, uma passada |

Multi-conta manda no caminho mesmo com faixa de AZ possível: a conta é o nível mais externo, e a faixa de AZ dentro de uma conta é trabalho da vista de detalhe daquela conta.

### O eixo, quando há grade

**Há passo numerado** (`edges[].order`) → o fluxo fica com a horizontal e a AZ vira raia. **Não há** → a AZ pode ficar com a coluna.

Medido em 24 de 24 combinações realistas contra a proporção 16:9, e a razão não é veracidade: as checagens que a pergunta aciona são de **incidência**, invariantes por transposição. Quem desempata é a proporção, porque a dimensão ordenada tem 5–11 posições e a paralela tem 2–4.

### A ordem das linhas

**`access` › `layer` › `label`.** O alfabeto sobrevive no fim **sem significado**, só fechando a ordem total que o determinismo exige — e o determinismo importa porque nenhum LLM emite a mesma lista na mesma ordem duas vezes; sem ordem derivada, regerar o mesmo modelo produz um diff inteiro.

Onde o fato falta, a assimetria é deliberada: **o motor exige o fato onde o fato É o desenho, e avisa onde ele é só desempate.** A grade recusa com a lista; o ELK avisa e desenha.

### Multi-conta: dois modos, nenhum perguntado

| modo | gatilho | o que faz com a travessia |
|---|---|---|
| **integração** | ≤4 contas **e** ≤7 travessias | desenha a travessia |
| **inventário** | acima de qualquer um dos dois, ou zero travessias | **suprime todas** |

O diagrama multi-conta carro-chefe da AWS tem **zero conectores** — contado no PPTX oficial. A AWS resolve o espaguete cross-account **não desenhando a aresta**: vista consolidada sem arestas, mais vistas por conta com arestas internas. O corte em 1+N páginas é **estrutural**, não gatilho de saturação: as duas coisas são publicadas ao mesmo tempo.

Habilitador de permissão (papel IAM, bucket policy, política de event bus) é nó com `enables`, nunca rótulo de aresta.

## A projeção entre as duas vistas

Um IR só, dois casacos. A rastreabilidade vira **função**, e `project(técnico, 'logical') == o aprovado` é comparação de strings. Com dois modelos ligados por mapeamento a pergunta só se responde se o mapeamento estiver certo, e nada garante que esteja.

Dois mecanismos sustentam a projeção:

- **colapso de contenção** — `inside` aponta o pai mais fino; a vista grossa sobe até o primeiro ancestral que exista nela. Enfiar `VPC › Subnet` entre a folha e a fronteira **não muda uma linha** da projeção lógica.
- **contração de aresta** — nó só-técnico no meio do caminho projeta de volta para a aresta aprovada, com o rótulo dela.

`layer: "both"` é o padrão **de propósito**, mesmo sendo redundante com a presença do casaco lógico: sem ele, esquecer o casaco lógico de um nó aprovado se leria como *"ah, é só técnico"* e a capacidade sumiria da projeção sem erro nenhum. Com o padrão em `both`, esquecer vira erro de validação. Redundância **conferida** é guarda, não ruído.

## Quando o humano editou o arquivo

`open()` classifica cada página em três estados, e são três porque dois não dão conta:

| estado | o que houve | o que fazer |
|---|---|---|
| **intacto** | as duas impressões batem | regerar é seguro |
| **remanejado** | a semântica bate, a geometria não — alguém **arrastou** coisa | o modelo continua valendo, mas regerar joga fora o trabalho dele. **Nunca calado** |
| **divergente** | a semântica não bate — acrescentaram, apagaram ou renomearam | o modelo afirma uma arquitetura diferente da desenhada. Bloqueia |

Colapsar *remanejado* em *intacto* perde meia hora de ajuste manual; colapsar em *divergente* bloqueia quem só moveu uma caixa, e bloqueio que dispara à toa é bloqueio que o usuário aprende a ignorar.

O bloqueio vem **depois** do briefing, de propósito: mesmo quando não dá para seguir, o usuário recebe o contexto de volta.

> `host="panlabs-aws-diagrams"` é marca **fraca** e não serve para reconhecer — o app reescreve para `"Electron"` ao salvar. Quem reconhece é o selo.
