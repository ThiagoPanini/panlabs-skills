# A sabatina

O protocolo que leva de *"quero um sistema que faz X"* a um modelo completo.
Comando aqui roda da raiz da skill, como no [`SKILL.md`](../SKILL.md).

É o que separa esta skill de um gerador de diagrama, e a razão é estrutural:

> **Nenhuma checagem geométrica sabe se a arquitetura desenhada existe.**

O substituto que a literatura propõe — diferença contra o IaC — está fora do
escopo desta skill. Logo a sabatina é a **única guarda de veracidade do
conteúdo**: o validador guarda o desenho, a sabatina guarda o fato. Daí decorre
todo o desenho do protocolo: ela extrai exatamente o que o validador **não**
alcança.

Três julgamentos que precisariam de olho humano ficam satisfeitos **por
construção**, e é a sabatina que os satisfaz: o rótulo de aresta bate com a
intenção (a pergunta *"quem inicia?"*), o nome é significativo, e a legenda
explica em vez de listar.

## Fase 0 · Entrada

Aceite ata de reunião, notas soltas, documento e foto de quadro branco. A foto é
o insumo mais rico — entrega o **grafo** direto —, e todo rótulo nela é ilegível
até ser confirmado.

**Material de entrada pré-preenche e nunca abaixa a régua.** Todo fato extraído
entra como `procedencia: "inferido"` e **não conta** até `confirmado: true`.
Confirme **em bloco**, não uma pergunta por fato.

| o que veio | como entra |
|---|---|
| afirmação direta — *"são 300 lojas"* | `fato` com `procedencia: "perguntado"` |
| leitura sua do material — *"os arquivos caem de madrugada"* | `inferido` + `de:` com o trecho, e some da conta até confirmar |
| linguagem hedge — *"acho que dava pra fazer com Lambda"* | **opção**, jamais fato |
| nome de serviço AWS dito cedo | **estacionamento** (abaixo) |

### Estacionamento

O usuário diz "Lambda" no minuto um — sempre. Se o nome entrar agora, quebra *um
nível de abstração* (`A1.10`) e contamina a vista lógica, que é mostrada também a
gente não-AWS.

Guarde em `dossie.estacionamento` com `estado: "estacionado"` e a `capacidade`
contra a qual ele volta. Na fase técnica ele reaparece como **sugestão inferida**,
para confirmar — não para assumir. Sem esse campo o retorno não sobrevive a uma
sessão nova.

## Fases 1 e 2 · As rodadas

Entregue a **rodada inteira de uma vez**, cada pergunta numerada e com uma
recomendação. Nunca pergunte fato que dá para descobrir sozinho.

### Os cinco eixos de forma

Teste de admissão, e ele é o que fecha a lista em cinco: **um eixo é obrigatório
se, e só se, a resposta dele muda o desenho.**

| | eixo | exemplo de resposta, do corpus |
|---|---|---|
| `E1` | postura de computação | *gerenciado sem compute próprio* |
| `E2` | estilo de integração | *assíncrono por evento (chegada do arquivo)* |
| `E3` | estado e dados | *objeto / data lake com camada analítica* |
| `E4` | exposição de rede | *privado, com ponto de entrega controlado* |
| `E5` | fronteira de responsabilidade | *três fronteiras: aterrissagem, processamento, consumo* |

Orçamento, maturidade do time, latência, janela de manutenção, lock-in, RTO/RPO
**não reformatam o desenho — escolhem entre candidatas**. São desempate, e o
lugar deles é a fase 3.

`E5` fala **fronteira de responsabilidade**, não *conta AWS*. Decidido contra
render real: as duas molduras saem geometricamente idênticas, mesmas caixas e
mesmas coordenadas, então a escolha nunca foi de layout — é de **vocabulário e
audiência**. A vista lógica vai para diretoria, produto e jurídico. A fronteira
vira conta na transição para a vista técnica, e isso é troca de estilo, não de
estrutura.

### Sondas condicionais

Entram **destravadas por uma resposta**, nunca antes — perguntar antes é
adivinhar. Padrão: *resposta de `Ex` → o que ela contradiz ou obriga*.

- retenção longa + auditoria → residência de dados, imutabilidade, chave própria?
- *"manda fora de hora"* + *"o painel está velho"* → o gatilho é a chegada, não o
  relógio? (contradiz `E2`, e muda o desenho)
- protocolo legado citado → é requisito do cliente, ou só o que existe hoje? (se
  é do cliente, vira componente do desenho, não detalhe)
- multi-fronteira → **quem inicia** a travessia? (direção errada inverte a leitura
  de confiança)

### Quando o usuário já sabe o que quer

A fase lógica **sempre começa, e colapsa numa confirmação** quando o material de
entrada já determina a arquitetura. Pular de vez contradiz a progressão que é o
coração do produto; sabatina inteira para quem já decidiu é atrito que mata
adoção. Mesmo mecanismo do material de entrada: pré-preenche, confirmação valida.

## Fase 3 · A parada

> **Perguntei o que a descrição não determinou.**

É uma lista, não um julgamento — e é o **teto de uma rodada** que a torna executável:

- os **eixos de forma** `E1–E5` que a descrição deixou em aberto;
- mais **qualquer fato cuja ausência faria o desenho afirmar algo falso** — quem inicia uma travessia, se o que guarda estado mora em subnet pública, se uma fronteira é conta ou grupo.

Perguntado isso, a rodada acabou. O que sobrou de aberto não vira segunda rodada: com **um** eixo em aberto desenha-se com a recomendação e **declara-se o chute**; com **dois ou mais**, o arco volta a ser sequencial e as candidatas vêm antes do desenho. Os dois gatilhos estão no [`SKILL.md`](../SKILL.md).

### `A1` continua rodando — depois do desenho

A regra de parada **era** *"`A1` chega ao piso"*, e a troca não aposentou a família: aposentou a **posição** dela. `A1` mede o modelo, e antes de desenhar não existe modelo para medir — cobrá-la adiantado é fazer o usuário responder uma dúzia de perguntas sobre uma arquitetura que ele ainda não viu.

Ela roda no turno do desenho, junto da revisão de lacunas, e o que ela acusar volta como **ajuste**, que é barato, em vez de como **pergunta**, que é cara. O que continua valendo é o que ela dá em troca: `A1` é lista fechada e finita, então o conserto termina.

```bash
node tools/check-geometry.cjs <modelo.json>
```

### Rodando `A1` sobre um modelo de sessão

`check-geometry.cjs` come `model@1`. Se o que você tem é um `session@1`, **projete antes** — e a projeção é fiel: os dois caminhos produzem laudo idêntico, medido.

```bash
node -e "const {project}=require('./session/project.cjs');
  require('fs').writeFileSync('/tmp/proj.json',
    JSON.stringify(project(require('./models/session/<caso>-logical.json'),'logical').model));"
node tools/check-geometry.cjs /tmp/proj.json
```

### O piso — as checagens que fato nenhum fecha

Medido nas **35 páginas** que os 20 modelos do corpus produzem — em páginas e não
em modelos, porque o multi-conta sai em 1+N: `A1.2`, `A1.3` e `A1.11` acusam em
**35 de 35**, e não porque falta informação.

| | o que pede | por que não fecha |
|---|---|---|
| `A1.2` | legenda presente | o motor ainda não emite legenda |
| `A1.3` | legenda cobre todo canal visual | mesma causa |
| `A1.11` | `data`, `versao`, `autor` | `model@1` é `additionalProperties: false` e **não tem esses campos** — não há onde escrever |

E o piso **sobe duas** assim que qualquer nota tiver `sobre`:

| | quando |
|---|---|
| `A1.5` todo elemento tipado | `A1.5` e `A1.12` acusam a **nota presa a nó**, que desenha como nó e vive em `notas[]`, não em `nos[]` |
| `A1.12` nenhum shape órfão | idem — isoladas em experimento: sem nota, limpo; nota de rodapé, limpo; nota com `sobre`, as duas acusam |

Isto morde o protocolo de frente: a **fase 5 exige** uma nota ligada por `viaNota`
para cada achado recusado. Se ela for presa ao nó, essas duas passam a fazer parte
do piso — e não são perguntas.

**Pare de consertar quando `A1` chegar a exatamente o piso do seu modelo.** Tratar entrada de piso como defeito faz o ajuste rodar para sempre; a dívida tem dono e endereço em [`report.md`](report.md).

### As que viram ajuste

`A1.1` título · `A1.4` todo elemento nomeado · `A1.6` toda aresta rotulada ·
`A1.7` toda aresta unidirecional · `A1.8` nenhuma linha sem seta · `A1.9` siglas
expandidas · `A1.10` um nível de abstração. Mais `A1.5` e `A1.12` **quando não há
nota presa a nó** — aí elas voltam a acusar de verdade.

Nenhuma delas precisa de uma volta ao usuário: são fatos que o próprio modelo já carrega ou que o agente escreve. Prova de que fechar é barato: um modelo de 3 nós acusava `A1.6` em duas arestas; escrever os dois `label` levou `A1` ao piso na mesma rodada.

### O ajuste também subtrai

Estourado o teto de complexidade (`A2.1`, `A8.1`), a resposta **não** é *"me conte mais"* — é **"o que sai do diagrama?"**. O remédio para diagrama saturado é decompor, não encolher, e essa é a única entrada de `A1` que de fato volta ao usuário.

### Duas réguas, não uma

*Decidir* fecha na rodada de perguntas: os eixos em aberto foram perguntados.
*Desenhar* fecha depois do desenho: `A1` no piso.

## Fase 4 · As candidatas

**Elas mudaram de posição, não de conteúdo.** No caminho normal o agente escolhe a que recomendaria, desenha, e apresenta as alternativas **junto** do desenho — o humano compara formas olhando uma delas pronta, em vez de escolher entre três parágrafos. No arco sequencial elas voltam a vir **antes**, e é para isso que os dois gatilhos do [`SKILL.md`](../SKILL.md) existem. Tudo abaixo vale igual nos dois casos.

**Teto 3, piso 2, e diga por quê quando entregar menos.** O número cai do
invariante, não é constante: forçar uma terceira quando o espaço real tem duas
produz exatamente as "três variações da mesma coisa" que o protocolo existe para
evitar.

### O invariante de tupla

Cada candidata carrega sua tupla `E1–E5`. **Todo par difere em ≥1 eixo de forma, e
você tem de saber dizer qual** — o campo `difereEm` guarda isso. Tuplas iguais
colapsam e são descartadas: é o guarda mecânico contra distinção só de intenção.

Do corpus, três candidatas e a distinção explícita entre elas:

```
cand-a  escolhida    gerenciado-sem-compute · evento        · data-lake            · privado · multi-fronteira
cand-b  descartada   gerenciado-sem-compute · lote-agendado · data-lake            · privado · multi-fronteira   difereEm: E2
cand-c  descartada   conteineres            · evento        · relacional-gerenciado · privado · fronteira-unica   difereEm: E1, E3, E5
```

### Como apresentar

**compra / paga / escolha se / errada se**, mais a sua recomendação. Sem matriz de
estrelas: estrela convida a tirar média, e média destrói decisão.

- **compra** — o que essa forma entrega que as outras não
- **paga** — o custo, dito sem eufemismo
- **escolha se** — a condição do mundo que a torna certa
- **errada se** — a condição que a derruba

### As descartadas ficam

Com o `porque` do descarte. Sem elas a sessão seguinte re-propõe uma forma já
recusada, e ninguém sabe responder *"por que não a B?"*.

## Fase 5 · A revisão de lacunas

Roda **depois do desenho**, porque estas não são respostas a perguntas — são **propriedades emergentes do grafo**, e o grafo só existe depois de montado. Não dá para perguntar *"tem SPOF?"*.

```bash
node tools/review-gaps.cjs <modelo.json>       # o laudo
node tools/review-gaps.cjs --corpus            # a régua contra o corpus
```

São **seis regras**, e cada uma tem **pré-condição escrita**: a estrutura que o
modelo precisa afirmar para a regra ter o que dizer. Onde o modelo não afirma, a
regra fica **muda** — e muda aparece no laudo com o motivo, porque *"não acusou"*
não pode se confundir com *"não rodou"*.

| regra | dispara quando | e é muda quando |
|---|---|---|
| `spof` | nó sem par, único caminho de um ator até **≥2** outros | não há ator, ou não há aresta |
| `single-az` | o que guarda estado mora num papel de subnet que existe em **1** zona | nenhuma subnet declara `az` |
| `egress-sem-controle` | VPC com subnet privada ocupada, sem NAT/endpoint/gateway **dentro nem ligado** | não há subnet privada com conteúdo |
| `dado-em-subnet-publica` | o que guarda estado está numa subnet `publica` | não há subnet pública |
| `cross-account-sem-confianca` | travessia entre contas sem `habilita` em nenhuma ponta | <2 contas, ou nenhuma travessia |
| `assincrono-sem-dlq` | consumidor de fila que não escreve em nenhuma **outra fila** | nada sai de fila, tópico ou barramento |

**"Estado" e "fila" não são listas novas** — saem da mesma tabela de categoria
AWS do [#22](https://github.com/ThiagoPanini/panlabs-skills/issues/22) que decide
o andar da subnet. Se ela estiver errada, está errada nos dois lugares e
conserta-se num só.

> **Relata, propõe, e conserta apenas o que o usuário mandar consertar.**

**Não bloqueia mais — relata, em bloco e uma vez só.** Todos os achados saem junto do desenho, no mesmo turno, e viram a seção 5 do `case.md`; cada um é aceito ou recusado pelo usuário quando ele responder. Uma interação, não N: atrito importa, e o que bloqueava aqui deixou de precisar bloquear porque o desenho já está na frente de quem decide — quem guarda a fronteira de rede agora é o portão de veracidade, por máquina.

### A recusa tem de chegar ao desenho

Todo achado com `estado: "recusado"` precisa de `viaNota` apontando para uma
entrada de `notas` com `origem: "achado-recusado"`. O elo é **explícito**, e não
busca de substring no texto, para que quem edita o texto da nota não quebre a
rastreabilidade sem perceber.

```
achado   spof · alvo receber-arquivo · recusado · viaNota: n-spof
nota     n-spof · origem achado-recusado
         "SPOF conhecido e aceito: ponto de entrada sem par (decisão de orçamento, 2026-08)."
```

Sem esse elo a recusa fica só no dossiê e o diagrama volta a enganar calado.

### A calibração, e o que ela consertou

O protótipo do #15 fazia **4 achados num modelo de 3 nós** — 1,33 por nó. Contra
o corpus de 22 modelos e 247 nós, estas regras fazem **0,101 por nó**: treze vezes
menos.

E o que consertou não foi apertar número, foi mudar a forma. Três das quatro
regras do protótipo disparavam sobre **ausência** (*"nenhum componente declara
redundância"*), e regra que dispara sobre ausência dispara em todo modelo
pequeno, porque modelo pequeno é quase todo ausência.

> **Um achado só nasce sobre um fato que o modelo AFIRMA, nunca sobre um fato que
> ele não menciona.**

**Três** limiares dentro das regras foram medidos contra o corpus, não escolhidos,
e cada um matou um falso positivo concreto:

| | e o que ele matou |
|---|---|
| `spof` orfana **≥2** | num encadeamento `A→B→C`, dizer que B é o ponto único de falha de C é só dizer que **C tem um vizinho** — afirmação sobre C, não sobre caminho compartilhado. Sem a cláusula, o `orders-serverless` acusava o VPC endpoint por "separar" o DynamoDB |
| egresso conta **ligado**, não só contido | no `hub-tgw-3-accounts` o Transit Gateway **é** a saída controlada e mora fora das VPCs que serve. A regra reprovava as duas spokes pelo motivo que as torna certas |
| `spof` **só os maximais** | numa cadeia toda ligação é ponto de articulação, com os órfãos encaixados. A `predictive-fleet` acusava **seis** num modelo de 11 nós — pior que o protótipo que motivou esta calibração inteira |

A régua está em `tests/check-gaps.cjs`, e ela cobra dos **dois lados**: toda
regra tem de disparar em ≥1 modelo do corpus **e** calar em ≥1. Regra que dispara
em todos não está medindo nada — está afirmando uma constante.

**Nenhum modelo do corpus estoura o teto** de ⌈nós÷4⌉ — 22 de 22. Houve uma
exceção nomeada, o `platform-3-accounts` a 6 achados contra teto 5, e ela
**expirou sozinha** quando a cláusula dos maximais entrou: o teste ficou vermelho
com a mensagem que ele mesmo tinha preparado, e a entrada foi apagada.

Fica registrado o que aquela exceção mediu, porque continua verdadeiro e não tem
mais quem prove: o **denominador do teto está errado** — achado escala com
superfície de arquitetura (contas, VPCs, pontos de entrada), não com contagem de
nós.

**`retencao-sem-regra` não virou regra**, e é bom dizer por quê: ele aparece no
dossiê do corpus de sessão, mas retenção é fato de política de dado que o
`model@1` não tem onde afirmar. Sai da sabatina, não do grafo — e este módulo só
lê o grafo.

## Fase 6 · O acordo e a transição

**Esta fase é do arco sequencial** — no caminho normal não há vista lógica entregue sozinha para aprovar, porque as duas saem juntas no mesmo turno.

Entregue a vista lógica com **zero nome de serviço AWS** e diga o que acontece ao aprovar: o estacionamento volta como sugestão inferida contra a capacidade correspondente.

A aprovação vira **registro** conferível — e deixou de **travar** a vista técnica; quem guarda essa fronteira agora é o portão de veracidade, por máquina. Ver [`SKILL.md`](../SKILL.md) para o mecanismo, e [`model.md`](model.md) para o que a projeção faz com os níveis que só a vista técnica tem.

## O que veio do método de sabatina geral, e o que fica de fora

Herdado e creditado: **rodadas** · **frontier** · **a rodada inteira de uma vez** · **pergunta numerada com recomendação** · **nunca perguntar fato que dá para descobrir sozinho**.

**Detecte a `/grilling` e use-a se ela estiver no ambiente, com teto de uma rodada.** Quem já tem a skill instalada recebe o formato de pergunta ao qual já está acostumado, e isso não custa nada a quem não tem: **não existindo, aplique este mesmo documento**, que é o formato inteiro escrito aqui. Nenhum comando desta skill a invoca e nenhuma instrução pressupõe que ela exista — o caminho de fallback é o caminho principal, e é assim que a régua o mede.

**O empréstimo é de forma, nunca de regra de parada**, e a distinção é a única coisa que essa detecção não pode borrar. Lá se para quando a frontier esvazia — critério da outra skill, sobre o material dela. Aqui o teto é **uma rodada**, e o que fica em aberto vira chute declarado ou promove para o arco sequencial. Herdar a parada de lá reintroduziria exatamente a sabatina que cobra adiantado.

A portabilidade é o que decide isso: uma skill auto-contida e publicável não pode depender **em runtime** de uma skill pessoal que talvez não exista no ambiente corporativo nem em outro harness.

## O que o protótipo do protocolo NÃO demonstrou

Registrado para não ser confundido com decisão fechada:

- que **cinco** são os eixos certos — só que cinco bastaram para aquele caso;
- que **três** é o número certo de candidatas;
- comportamento com usuário que responde *"não sei"* num eixo de forma;
- material de entrada que **contradiz** o que o usuário diz depois.
