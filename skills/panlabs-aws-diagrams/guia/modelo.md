# Escrever o modelo

O esquema é a fonte da verdade e carrega a razão de cada campo na própria
`description` — **leia [`../esquema.json`](../esquema.json)**, não uma cópia dele.
Este arquivo é só o que o esquema não consegue dizer sobre si mesmo. Comando aqui
roda da raiz da skill, como no [`SKILL.md`](../SKILL.md).

## A fronteira, e por que ela se sustenta

> **O agente escreve o QUE existe. O motor calcula ONDE fica.**

Nenhuma propriedade do esquema nomeia posição, tamanho, distância ou direção, e
todo objeto é `additionalProperties: false`. Não existe onde escrever uma
coordenada.

A escolha é deliberada: regra que depende de disciplina se perde na terceira
sessão; **ausência de palavra, não**. É o mesmo movimento do vocabulário de tema,
e é conferido mecanicamente por `tests/check-fronteira-modelo.cjs`, validado com
experimento de controle — injetando `x` no esquema, tirando um
`additionalProperties: false` e pondo `posicao` num modelo, a checagem acusa as
três e sai vermelha.

Se você está tentado a mover uma caixa, o lugar de agir é o **modelo** (o fato que
falta) ou o **tema** (a métrica), nunca a geometria.

## Qual dos quatro contratos

| `$id` | esquema | escreva este quando |
|---|---|---|
| `modelo@1` | [`../esquema.json`](../esquema.json) | você tem **uma** vista e quer o `.drawio` — é o que o motor come |
| `sessao@1` | [`../sessao/esquema.json`](../sessao/esquema.json) | a conversa tem as **duas** vistas, um acordo e um dossiê para atravessar sessões |
| `tema@1` | [`../tema/esquema.json`](../tema/esquema.json) | você está configurando identidade visual — ver [`visual.md`](visual.md) |
| `elaboracao@1` | [`../sessao/esquema-elaboracao.json`](../sessao/esquema-elaboracao.json) | você está na fase técnica e vai aplicar um delta sobre o modelo aprovado |

`sessao@1` **não** é o que o motor come: ele projeta para `modelo@1`. A diferença
entre a vista lógica e a técnica não é outro modelo, é outro **casaco** sobre os
mesmos nós, mais os nós que só a camada técnica tem.

### O delta de elaboração

`elaboracao@1` tem esquema próprio —
[`../sessao/esquema-elaboracao.json`](../sessao/esquema-elaboracao.json) — desde o
#37. `elaborar()` valida a FORMA do delta contra ele antes de aplicar qualquer
regra de domínio, e `tests/check-esquema-unico.cjs` o varre junto dos outros três.
Os mapas (`casacos`, `dentro`, `refina`, `arestasCasaco`) ficam com valor solto no
esquema — as chaves são ids imprevisíveis aqui, e a forma de cada valor (em
particular a de um casaco técnico) é conferida de novo, já fundida no modelo
inteiro, por `sessao/validar.cjs` contra `sessao@1`.

Ele não é um segundo modelo — é o que a fase técnica **acrescenta** ao que a
sessão anterior aprovou. Campos, todos opcionais além de `esquema` e `sobre`:

| campo | forma | o que faz |
|---|---|---|
| `sobre` | id do modelo | recusa se não bater com o modelo aberto |
| `nos` | lista | infraestrutura nova. `camada: "tecnica"` obrigatória, e **casaco lógico é recusado** |
| `casacos` | `{ id: casacoTecnico }` | veste um nó **aprovado** de serviço AWS |
| `dentro` | `{ id: novoPai }` | reparenta um nó aprovado para dentro de nível novo — **a operação de risco** |
| `refina` | `{ idAresta: { por: [ids], rotulos: [...] } }` | transforma uma aresta aprovada num caminho técnico |
| `arestas` | lista | aresta que só a camada técnica tem |
| `arestasCasaco` | `{ idAresta: { rotulo, protocolo, ordem } }` | rótulo técnico numa aresta aprovada |
| `notas` `dossie` | | acrescentam |

`refina` merece a explicação. Tecnicamente, *"A avisa B"* passa por um barramento
de eventos. O reflexo é apagar a aresta aprovada e escrever duas novas — e aí o
extremo aprovado depende de alguém reescrever certo. Declarando os **saltos**, os
extremos continuam sendo os mesmos objetos: a primeira aresta continua sendo a
aprovada, com o rótulo lógico intacto, e a contração da projeção reconstrói o par
original.

Nenhum campo alcança um casaco lógico, e isso é **gramática, não disciplina**: não
existe onde escrever, `elaborar` recusa nó novo que traga casaco lógico, e a
projeção confere depois. Se a capacidade é mesmo nova, a vista lógica mudou e
precisa de **aprovação nova**, não de um casaco a mais.

## As sete armadilhas que o esquema não conta

### 1 · Resolva o nome do serviço antes de escrevê-lo

```bash
node catalog/aws-shapes.cjs "kinesis data firehose" "vpc endpoint" opensearch
```

A escada de resolução tem seis degraus, e a primeira que casa vence:
desambiguação → renome → título ou stencil → sigla/apelido → **substring** →
genérico.

**Só o quinto degrau erra calado.** Genérico avisa alto (`⚠ N nó(s) caíram no
ícone genérico`); os outros quatro acertam por construção. Substring casa — então
nenhum aviso dispara — e pode casar com a coisa errada. Medido em 47 nomes
plausíveis, 45 resolvem certo e os dois erros são ambos substring:

| você escreve | vira | devia ser |
|---|---|---|
| `kinesis firehose` | **Kinesis** | `kinesis data firehose` → Data Firehose |
| `vpc endpoint` | **VPC** (um grupo!) | escreva o serviço que o endpoint expõe |

`--explicar` mostra a via de cada nó. Qualquer coisa lendo `servico:substring`
merece uma segunda olhada.

Renomes e sinônimos funcionam e não são armadilha: `opensearch` →
`elasticsearch_service`, `cloudwatch` → `cloudwatch_2`, `alb`/`nlb` → Elastic Load
Balancing, `sagemaker` → SageMaker AI. O título do upstream nunca acompanha o
rename de marketing; a escada resolve.

### 2 · `de` é quem INICIA, não de onde o dado sai

Polling é `de: consumidor` com `dados: "volta"`. Errar isso inverte a leitura de
confiança do diagrama, e é a resposta que satisfaz *"o rótulo bate com a
intenção"* sem olho humano.

`dados: "volta"` é **semântico e o layout obedece**: o eixo passa a seguir o dado,
não a seta. A consequência foi paga de propósito — ver [`laudo.md`](laudo.md)
sobre `A5.7`.

### 3 · Dimensão não é container

| fato | como entra | por quê |
|---|---|---|
| zona de disponibilidade | `az` na **subnet** | a árvore de contenção real é `Cloud › VPC › Subnet`. A AZ cruza a VPC; virar nível desenharia `us-east-1a` duas vezes — uma fronteira que não existe |
| unidade organizacional | `ou` na **conta** | não existe shape oficial de OU. Vira par ícone+rótulo sem caixa, e o agrupamento sai do contraste de espaçamento 1:4 |
| conta AWS | `tipo: "conta"` | esta **é** container — está na lista fechada de group icons |

Em ambos os casos o motor decide sozinho se a dimensão vira faixa desenhada ou
fica só no rótulo. Você declara o fato; a política é dele.

### 4 · `camada` é escape, não pergunta

Por padrão o motor lê o andar de rede de uma subnet **pelo que ela guarda** — pela
categoria AWS de cada serviço dentro dela. O agente não responde nada a mais.

Declare `camada` só nos dois casos em que o conteúdo não sabe dizer:

- **subnet vazia** — não há de onde derivar;
- **o conteúdo diria errado** — a subnet de ingestão que hospeda os brokers.

Declarado vence derivado, e a divergência vira **aviso**, não erro. Nove das
trinta categorias AWS têm significado de andar; as outras 21 calam, e quem cala
não vota.

**Mistura vence o mais fundo.** Uma subnet com load balancer *e* banco é camada de
dados. Não é gosto: é a regra protegendo o invariante que a justifica — *subnet
com banco nunca acima de subnet sem banco*. Tomar o mais raso faria de um load
balancer alavanca para subir a camada de dados.

### 5 · Faixa: você diz QUEM, o motor calcula ONDE

`faixas[]` é para grupo que **cruza** a árvore de contenção — Auto Scaling group é
o caso frequente. A caixa é a **união calculada** dos membros; `membros` é a lista
de ids e nada mais.

**Faixas de AZ não entram aqui.** São derivadas da dimensão `az` das subnets.
Escrevê-las à mão duplica o que o motor já deriva.

A diferença entre grupo e faixa é semântica: **grupo afirma contenção, faixa
afirma atributo compartilhado.** Por isso a faixa tem uma checagem própria —
`F1`, abraça exatamente os membros que declara — e por isso as checagens de
aninhamento não se aplicam a ela.

### 6 · O `dossie` é opaco ao motor

Procedência, confirmação, tuplas das candidatas, estacionamento e achados viajam
dentro do arquivo e o motor **não lê um campo**. Uma superfície de entrada só, e o
dossiê cresce sem tocar no motor.

O que precisa virar desenho, a sabatina **projeta** em `notas`:

| `notas[].origem` | o que carrega |
|---|---|
| `achado-recusado` | o único canal pelo qual a recusa do usuário vira marca no desenho |
| `premissa` | conflito com o context pack — ver [`context-pack.md`](context-pack.md) |
| `legenda` | texto que o motor gera, como a travessia que virou frase na vista de detalhe |

`notas[].texto` é **desenhado** — vira caixa presa ao nó quando há `sobre`. Texto
longo empilha caixas em cima dos ícones. A frase fica curta; a citação inteira vai
para o `dossie`.

### 7 · Lista plana com `dentro`, nunca aninhamento

Acrescentar um nó a quatro níveis de profundidade é **uma linha no fim do
arquivo**, não reindentar uma subárvore. A escolha é para quem escreve o modelo
ser um LLM. O custo — ciclo de contenção passa a ser possível — são dez linhas de
validação que já existem.

## Os três caminhos de layout, e quem escolhe

Não é opção sua. Cai do modelo:

| | gatilho | quem manda |
|---|---|---|
| **contas** | ≥2 nós `tipo: "conta"` | o motor na grade de contas; o ELK dentro de cada conta |
| **grade** | ≥2 AZs distintas **e** algum papel de subnet em ≥2 AZs | o motor no `x` das colunas; o ELK dentro da célula |
| **elk** | o resto | o ELK na hierarquia inteira, uma passada |

Multi-conta manda no caminho mesmo com faixa de AZ possível: a conta é o nível
mais externo, e a faixa de AZ dentro de uma conta é trabalho da vista de detalhe
daquela conta.

### O eixo, quando há grade

**Há passo numerado** (`arestas[].ordem`) → o fluxo fica com a horizontal e a AZ
vira raia. **Não há** → a AZ pode ficar com a coluna.

Medido em 24 de 24 combinações realistas contra a proporção 16:9, e a razão não é
veracidade: as checagens que a pergunta aciona são de **incidência**, invariantes
por transposição. Quem desempata é a proporção, porque a dimensão ordenada tem
5–11 posições e a paralela tem 2–4.

### A ordem das linhas

**exposição › camada › rótulo.** O alfabeto sobrevive no fim **sem significado**,
só fechando a ordem total que o determinismo exige — e o determinismo importa
porque nenhum LLM emite a mesma lista na mesma ordem duas vezes; sem ordem
derivada, regerar o mesmo modelo produz um diff inteiro.

Onde o fato falta, a assimetria é deliberada: **o motor exige o fato onde o fato É
o desenho, e avisa onde ele é só desempate.** A grade recusa com a lista; o ELK
avisa e desenha.

### Multi-conta: dois modos, nenhum perguntado

| modo | gatilho | o que faz com a travessia |
|---|---|---|
| **integração** | ≤4 contas **e** ≤7 travessias | desenha a travessia |
| **inventário** | acima de qualquer um dos dois, ou zero travessias | **suprime todas** |

O diagrama multi-conta carro-chefe da AWS tem **zero conectores** — contado no
PPTX oficial. A AWS resolve o espaguete cross-account **não desenhando a aresta**:
vista consolidada sem arestas, mais vistas por conta com arestas internas. O corte
em 1+N páginas é **estrutural**, não gatilho de saturação: as duas coisas são
publicadas ao mesmo tempo.

Habilitador de permissão (papel IAM, bucket policy, política de event bus) é nó
com `habilita`, nunca rótulo de aresta.

## A projeção entre as duas vistas

Um IR só, dois casacos. A rastreabilidade vira **função**, e `projetar(técnico,
'lógica') == o aprovado` é comparação de strings. Com dois modelos ligados por
mapeamento a pergunta só se responde se o mapeamento estiver certo, e nada
garante que esteja.

Dois mecanismos sustentam a projeção:

- **colapso de contenção** — `dentro` aponta o pai mais fino; a vista grossa sobe
  até o primeiro ancestral que exista nela. Enfiar `VPC › Subnet` entre a folha e
  a fronteira **não muda uma linha** da projeção lógica.
- **contração de aresta** — nó só-técnico no meio do caminho projeta de volta para
  a aresta aprovada, com o rótulo dela.

`camada: "ambas"` é o padrão **de propósito**, mesmo sendo redundante com a
presença do casaco lógico: sem ele, esquecer o casaco lógico de um nó aprovado se
leria como *"ah, é só técnico"* e a capacidade sumiria da projeção sem erro
nenhum. Com o padrão em `ambas`, esquecer vira erro de validação. Redundância
**conferida** é guarda, não ruído.

## Quando o humano editou o arquivo

`abrir()` classifica cada página em três estados, e são três porque dois não dão
conta:

| estado | o que houve | o que fazer |
|---|---|---|
| **intacto** | as duas impressões batem | regerar é seguro |
| **remanejado** | a semântica bate, a geometria não — alguém **arrastou** coisa | o modelo continua valendo, mas regerar joga fora o trabalho dele. **Nunca calado** |
| **divergente** | a semântica não bate — acrescentaram, apagaram ou renomearam | o modelo afirma uma arquitetura diferente da desenhada. Bloqueia |

Colapsar *remanejado* em *intacto* perde meia hora de ajuste manual; colapsar em
*divergente* bloqueia quem só moveu uma caixa, e bloqueio que dispara à toa é
bloqueio que o usuário aprende a ignorar.

O bloqueio vem **depois** do briefing, de propósito: mesmo quando não dá para
seguir, o usuário recebe o contexto de volta.

> `host="panlabs-aws-diagrams"` é marca **fraca** e não serve para reconhecer — o
> app reescreve para `"Electron"` ao salvar. Quem reconhece é o selo.
