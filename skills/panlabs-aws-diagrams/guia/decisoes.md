# As decisões, e o que reabre cada uma

Tudo que foi decidido na construção desta skill, com a razão comprimida e o
**gatilho de reabertura**: a observação concreta que faria valer a pena rediscutir.
Fora desses gatilhos, a decisão está paga — não a rediscuta, e sobretudo não a
desfaça por parecer estranha.

Quase toda entrada aqui foi corrigida ao menos uma vez pela medição seguinte. É o
padrão do projeto, e o aviso que ele deixa: **cada metade estava certa sobre o
mundo em que foi medida.**

## As doze premissas

| | |
|---|---|
| 1 | **Arquiteto consultor**, não auditor formal: sabatina, aponta lacunas, propõe, então desenha |
| 2 | **Duas fases** — vista lógica → aprovação → vista técnica. A transição é parte do produto |
| 3 | Na fase lógica, **N arquiteturas candidatas** com trade-offs |
| 4 | **Multi-conta é v1**, não névoa — é o caso mais frequente |
| 5 | **Scripts liberados**: layout é matemática, não improviso de coordenada |
| 6 | Ícones e convenções **AWS oficiais** como base normativa + camada fina da casa |
| 7 | **Auto-contida e publicável** — zero dependência de rede ou binário em runtime |
| 8 | O **renderizador é dependência de desenvolvimento**, não de execução |
| 9 | **Validação em duas camadas**: geométrica obrigatória + render oportunista |
| 10 | **Context pack corporativo** aceito e honrado; a ausência dele não bloqueia |
| 11 | Cadência **AFK**: o usuário é chamado para gosto irredutível, não para catalogar shape |
| 12 | A **rubrica v1 deriva de pesquisa** e se refina após execuções reais. Risco nomeado |

A premissa 7 é a que mais decide. Ela escolheu Node em vez de Python (por causa do
`elkjs`), JSON em vez de YAML (um segundo parser vendorizado), e internalizou o
método de sabatina em vez de invocá-lo.

## Os gêneros da v1

**Lógica** — `L1` blocos e capacidades · `L2` fluxo de dados lógico.
**Técnica** — `T1` referência com consciência de rede · `T2` pipeline de dados ·
`T3` event-driven / serverless · `T4` fluxo de requisição numerado ·
`T5` multi-account.

O campo `genero` é informativo: nem o motor nem a projeção o leem.

## Formato e mecânica

### mxGraph XML

**XML descomprimido é o default oficial.** Emita `compressed="false"`.

- **Waypoints vivem no espaço do pai da aresta** — o XSD oficial erra ao chamá-los
  absolutos. Por isso toda aresta é parenteada na camada raiz: sobra **um** sistema
  de coordenadas.
- **A faixa de título do container conta como área do filho.** Um filho em `y=0`
  fica debaixo do título; o gerador soma `startSize` à mão. E sempre emite
  `startSize` explícito — o default diverge entre a doc, as constantes e a
  biblioteca real.
- **`childLayout` é proibido.** Ele reescreve as geometrias no *load*, e o arquivo
  gerado deixa de ser o que o usuário vê. Junto com os dois itens acima:
  **o gerador é dono de 100% da geometria e não delega nada ao app.**
- **Metadados arbitrários fazem round-trip byte a byte** — é o que destrava
  persistir o modelo dentro do próprio `.drawio`.
- **XML inválido renderiza truncado com código 0.** O renderizador não reclama,
  então o gerador confere antes de gravar.

*Reabre se:* uma versão do draw.io passar a normalizar atributo de `<object>`, ou
o round-trip parar de devolver o modelo idêntico.

### Estilo do draw.io

`background` no `<mxGraphModel>` é a **única** alavanca determinística de fundo.
`sketch=1` quebra os stencils AWS4. `strokeColor` pinta o **glifo**. `flowAnimation`
sobrevive a SVG e HTML, **nunca a PNG**. Tema só sobrevive **assado célula a
célula**. Detalhes operacionais em [`visual.md`](visual.md).

### Catálogo de shapes

`mxgraph.aws4.*` é a única família viva. Cinco armadilhas silenciosas, todas
corrigidas: `resourceIcon` desenha o *Service* Icon (o *Resource* Icon plano não
usa classe); `strokeColor` pinta o glifo; **AZ, Security group e os dois Generic
group saem sem `container=1`** e não aninham; 8 de 18 cores de grupo estão na
paleta pré-2022; nomes congelaram no rename.

**Dois arquivos, e o desenho é esse:** `aws4.catalog.json` é espelho fiel do
upstream (gerado, não edite) e `correcoes.json` é o delta escrito à mão. Assim
**reextrair não apaga correção**, e dá para responder *"isto é assim porque o
draw.io é assim"* ou *"porque nós mudamos, e aqui está a evidência"*.

**Compacto sem perda:** 965 styles reconstruídas de `template + (categoria,
stencil)` com 0 divergentes. Achado que sobrou aberto: 22 títulos existem em duas
paletas com cor — e às vezes ícone — divergente; 17 resolvidos pelo deck oficial.

*Reabre se:* o draw.io subir de versão (hoje 31.3.1, deck ~Q1-2026 contra Q3-2026
da AWS). O extrator regenera; as correções ficam.

> ⚠️ **O aviso de método deste ticket vale para tudo:** as 24 checagens estáticas
> estavam **verdes** quando o PNG revelou um serviço com o ícone errado.

### Layout: `elkjs`, algoritmo `layered`

Decisivo: **`shapeCoords: PARENT` entrega coordenadas já relativas ao pai** — a
semântica exata do `mxGeometry`, zero conversão. Nenhuma outra candidata faz isso.
Runner-up Graphviz WASM perdeu por **roteamento que não desvia de cluster** — não
por empacotamento, e vale registrar para não reabrir pelo motivo errado.

**Consequência: o motor é Node/JS, não Python.**

Duas armadilhas caras:

- **Opção de layout não desce para container.** Com `hierarchyHandling:
  INCLUDE_CHILDREN` a doc sugere que a raiz manda em tudo. Não manda: espaçamento
  é lido **por container**, e setar só na raiz não dá erro nem aviso — dá
  configuração **inerte**. Medido: `spacing.nodeNode` em 38, 50 ou 90 na raiz
  produz geometria idêntica.
- **Não há alavanca de alinhamento no ELK.** `priority.straightness`,
  `elk.margins` e `nodePlacement.favorStraightEdges` são inertes. O encaixe é do
  motor, em `alinhar.cjs`, e é conservador: só mexe em desalinhamento ≤30 px, move
  a coluna inteira, e **desfaz** se sobrepuser.

*Reabre se:* uma versão do `elkjs` passar a honrar opção herdada, ou entregar
alinhamento. Meça antes — três alavancas já foram medidas e estavam mortas.

## Convenções e qualidade

### O que a AWS prescreve

**O deck PPTX é a única fonte normativa escrita.** Não há Prescriptive Guidance
sobre o tema; as Trademark Guidelines não mencionam os ícones. Onde o deck não
fala, **não há norma** — há convenção observada, e isso tem de ser declarado como
tal. A separação virou três camadas: 24 normativos escritos, 15 travados no preset
do deck, 27 observados.

**A AWS viola as próprias regras nos próprios diagramas**, e a leitura adotada é:
**desvio profissional paga a dívida que cria** — quem codificou significado na cor
da linha entregou legenda junto.

⚠️ Este ticket **derrubou uma premissa do próprio mapa**: `Cloud › Region › VPC ›
AZ › Subnet` não existe como regra. AZ e VPC **se cruzam**; a subnet é a
interseção.

### A rubrica

62 checagens mecanizáveis + 13 julgamentos humanos, com limiares calibrados nos
percentis de **4.890 desenhos de especialistas**, não em folclore. Reenquadramento
que mudou o papel do validador: `A4.2` e `A5.5` detectam diagrama que **comunica
fronteira de rede inexistente** — é **guarda de veracidade**, não linter de
beleza.

Traz nove regras populares que a evidência **não** sustenta. Errata conhecida: a
fórmula de `A5.1` não normaliza contra o próprio `c_max`; o numerador tem de ser
em pares.

*Reabre com:* execuções reais (premissa 12). Os oito limiares `calibravel` estão
esperando medição, com `porque: null`.

### O validador

62/62 no índice — 60 obrigatórias, 2 no render. **É portão, não otimizador**, e a
razão é dura: as 62 não se combinam num escore, e sem escalar não há o que descer;
um laço de correção seria um segundo otimizador competindo com o ELK sem gradiente
nem função objetivo.

**Achado contra a rubrica: ela modela uma árvore de contenção só, e o motor
desenha duas coisas.** Daí `F1`, fora das 62 de propósito — o índice é o contrato
com a rubrica, e uma checagem a mais o quebraria. A distinção que a sustenta está
em [`modelo.md`](modelo.md) e [`laudo.md`](laudo.md).

**Decisão de contraste: o fundo efetivo é a pilha de grupos em ordem z, não a
página.** A primeira versão errava o corte de z e lia 1,00:1 como 13,57:1.

*Reabre se:* `F1` virar produção — aí promova a `A4.8` e atualize o índice.

## O motor

### A fronteira

> **O agente escreve o QUE existe. O motor calcula ONDE fica.**

E ela é **gramática, não disciplina**: o esquema não tem propriedade que nomeie
posição, tamanho, distância ou direção. Verificado por checagem **com experimento
de controle** — a lição de que 24 checagens verdes não pegaram o ícone errado.

`JSON, não YAML` · `lista plana com dentro, não aninhamento` · `dossiê opaco ao
motor` · `arestas todas na camada raiz`.

*Reabre se:* alguém precisar escrever coordenada. Isso é sinal de que falta um
**fato** no modelo ou um **token** no tema, não de que a fronteira está errada.

### A árvore de contenção, a AZ e o eixo

Três voltas, e a terceira encolheu o problema:

1. O deck derrubou a hierarquia em cadeia — AZ e VPC se cruzam.
2. **Cruzar não exige sair da árvore.** A cadeia é `Cloud › VPC › Subnet`; a AZ é
   **dimensão** da subnet, e vira faixa derivada desenhada **fora** da árvore
   quando a arquitetura afirma redundância zonal. Vale igual para Auto Scaling
   group, que cruza AZ 4× no deck. Árvore estrita foi **descartada**: desenha
   `us-east-1a` duas vezes — a fronteira inexistente que `A4.2` reprova.
3. **Faixa de AZ e fluxo numerado não disputam a horizontal.** Há fluxo → ele fica
   com ela e a AZ vira raia; não há → a AZ pode ficar com a coluna. As checagens
   que a pergunta aciona são de **incidência**, invariantes por transposição — o
   validador é **cego** a esta pergunta. Quem desempata é a **proporção**, em 24
   de 24 combinações realistas, e vira empate exatamente no regime sem fluxo.

O cruzamento que sobra é de **ordem de raia**, não de eixo — e heurística de
ordenação apenas troca um cruzamento por outro. **Varra, não adivinhe.**

Custo: quatro constantes de calha, mais uma quinta — duas bandas que topam na
mesma linha só empilham se **se sobrepõem** no eixo transversal.

*Reabre se:* aparecer corpus com caixa de AZ real. Hoje a medição vem de 2 lâminas
didáticas, e na SRA real há **zero** caixas de AZ.

### Multi-conta

**A conta é container; a OU é dimensão** — pelo fato bruto de `AWS account` estar
na lista fechada de group icons e `Organizational unit` não estar. A mecânica que
daí decorre está em [`modelo.md`](modelo.md).

**O diagrama multi-conta carro-chefe da AWS tem ZERO conectores.** A AWS resolve o
espaguete **não desenhando a aresta**. Dois modos derivados do modelo, nunca
perguntados: **integração** (≤4 contas, ≤7 travessias) desenha a travessia;
**inventário** suprime todas. A decomposição em 1+N páginas é **estrutural**, não
gatilho de saturação.

Condição que os testes forçaram: **barramento e agregação exigem a MESMA relação**,
não só a mesma origem — senão a barra afirma que contas recebem o que não recebem.

Ordem das contas por **varredura**, com desempate por inversões.

*Reabre se:* aparecer arquitetura com mais de 4 contas que ainda precise mostrar
travessia. Hoje ela cai para inventário.

### A ordem de leitura das camadas de rede

**O que põe a subnet de dados embaixo é o que ela guarda** — e o fato que faltava
nunca precisou ser perguntado: estava no catálogo, na categoria AWS de cada
serviço. A ordem cai de **exposição › camada › rótulo**.

Duas candidatas caíram **medidas**, não por argumento: *distância da borda* ordena
3 modelos, fica muda em 9 (não há nó exposto de onde contar — justo o caso da VPC
privada que mais precisa da ordem); *`ordem` explícita* cai porque `camada:
"dados"` continua verdadeiro quando a VPC ganha um andar e `ordem: 2` vira mentira
silenciosa, **inconferível**.

**Mistura vence o mais fundo**, e a regra protege o invariante que a justifica.
`camada` entra como **escape, não como pergunta** — a premissa 11 fica intacta.

*Reabre se:* mais de nove das trinta categorias AWS ganharem significado de andar.

### O tema

**Vocabulário fechado, e a camada normativa é indizível.** **A margem estética da
casa não está no fundo** — é régua, não gosto. **O tema não é downstream do
layout**: 10 dos 27 tokens são métrica. Ver [`visual.md`](visual.md).

Uma correção do próprio autor foi **retirada no retorno, e o erro é o achado**: o
tingimento de subnet tinha sido zerado citando a convenção, mas a ressalva da
própria pesquisa já dizia que diagramas oficiais tingem e que `noFill` é **padrão
de fábrica, não proibição**. O tingimento do produto **é** 10% da cor normativa do
grupo — portanto **reforça** a legenda em vez de inventar canal.

Desempate de paleta: **deck → irmandade → ordem registrada**.

*Reabre se:* um token comprovadamente não conseguir inventar canal de significado
novo. Essa é a régua inteira para abrir uma palavra.

### As duas vistas

**Um IR só, com dois casacos — e o trade-off do ticket era falso.** "Rastreabilidade
vs simplicidade" não é troca: com um IR a rastreabilidade **é uma função**.

Persistência **embutida, uma cópia por página**, escolhida por medição: sete
hospedeiros testados pelo codec do próprio app, e **`<mxGraphModel>` é o único que
o app come**. `host` **não serve** para reconhecer — o app reescreve para
`"Electron"` ao salvar.

Edição à mão dá **três estados, não dois**. A aprovação é uma **impressão do
recorte**, não um booleano.

⚠️ **Duas afirmações de identidade byte a byte deste ticket e do multi-conta
CAÍRAM** na recertificação. A **tese** sobrevive e agora é testada de verdade em
vez de por congelamento.

*Reabre se:* o selo passar a doer. Medido em 65% dos bytes num arquivo de 5
páginas — ver [`visual.md`](visual.md) para o caminho de saída, que **não** é
sidecar.

### A árvore de produção

O motor saiu por **medição**, e a hipótese registrada no próprio ticket
(*"o provável é o do tema"*) **estava errada**, por genealogia: aquele candidato
era um fork tirado antes do multi-conta existir. Rodando a união dos checks dos
quatro protótipos: **3 vermelhos de 25** contra **8**.

**Sete achados que só a união produz**, e o padrão é um só: *cada metade estava
certa sobre o mundo em que foi medida*. Três eram **defeitos vivos**, não vermelhos
de teste. A revisão da própria consolidação achou o mesmo padrão um nível acima —
**onze checagens que não sabiam falhar**.

> **Suíte verde por metade não é suíte verde.**

Registro completo em [`../docs/recertificacao.md`](../docs/recertificacao.md); a
medição roda em `tools/medir-candidatos.sh`.

### Roteamento de aresta

Fechou o orçamento: falha semântica **zero no corpus inteiro**, 146 → 132 falhas.

**A hipótese do ticket funcionou sem bastar** — e o número está registrado:
sozinha, ela **piora** o total e cria uma falha semântica nova. Só virou ganho com
a nota presa a nó entrando no layout.

Sete causas medidas, e uma oitava **que nenhuma checagem pegou** — um toco de linha
pendurado, que só o olho viu. A conta paga de propósito é `A5.7`, em
[`laudo.md`](laudo.md). Laudo completo em
[`../docs/roteamento.md`](../docs/roteamento.md).

### Renderização headless

Funciona: AppImage extraído mais `xvfb-run`, ~3,8 s/diagrama. `@drawio/export` não
existe. **Dependência de desenvolvimento apenas.**

Duas armadilhas de bancada: **duas exportações simultâneas penduram**, e `timeout`
mata o `xvfb-run` mas **não os filhos Electron** — processo pendurado a 0% de CPU
envenena toda tentativa posterior. E um `package.json` esquecido em `/tmp` pela
extração do AppImage **sequestra o `require` do Node**, fazendo o UMD do `elk`
virar ESM (`ELK is not a constructor`).

## Os dois protocolos

O protocolo inteiro de cada um está no seu arquivo; aqui fica a decisão comprimida
e o que a reabre.

### A sabatina

**A checagem que falha é a próxima pergunta** — o critério de parada é executável,
não julgamento. **Cinco eixos de forma**, admitidos pelo teste *muda o desenho*; o
resto da lista original é **desempate, não espinha**. Candidatas distintas por
**invariante de tupla**, teto 3 e piso 2. Consultor é **análise de grafo
pós-montagem**, que relata e nunca conserta calado. `/grilling` **internalizado,
não invocado** — a premissa 7 decide.

A vista lógica agrupa por **fronteira de responsabilidade**, não por conta AWS —
decidido contra render real, que provou que as duas molduras são geometricamente
idênticas. Logo não era decisão de layout, era de **vocabulário e audiência**.

> ⚠️ **Correção medida, e o protocolo original não a tinha:** *"pare quando `A1`
> passar"* é inalcançável. `A1.2`, `A1.3` e `A1.11` acusam em **15 de 15** modelos
> por dívida de motor e de esquema. O critério certo é **`A1` no piso**, e o piso
> tem nome. Um agente que siga a letra original pergunta para sempre.

*Reabre se:* a dívida de legenda for paga, ou `modelo@1` ganhar `data`/`versao`/
`autor` — aí o piso encolhe e o critério tem de ser reescrito. Protocolo em
[`sabatina.md`](sabatina.md).

### O context pack

**Prosa vira restrição; um `.drawio` de exemplo vira só preferência de estilo —
nunca o contrário.** Amostra n=1 não licencia proibir por ausência; divergência de
estilo observada, sim. **Sem pack:** convenção AWS oficial, aviso de **uma linha,
uma vez por sessão**, e **nunca bloqueia**. **Conflito:** obedece e sinaliza, nunca
calado, nunca "as duas opções" — isso é o protocolo de candidatas, e uma premissa
corporativa já foi paga, não é escolha do momento.

O canal reaproveita `notas[].origem = "premissa"`, que o esquema **já previa** sem
que este ticket tivesse pedido. O pack nasce por **captura preguiçosa** no próprio
ponto de conflito — sem entrevista dedicada.

*Reabre se:* aparecer material corporativo real. Todo o contrato foi projetado e
validado contra um pack **sintético**. Contrato em
[`context-pack.md`](context-pack.md).

## Fora de escopo, e por quê

- **Engenharia reversa de IaC ou de conta AWS viva** — projeto do tamanho deste, e
  ortogonal à decisão de layout. Se a v1 provar o motor, vira um *front-end* novo
  para o mesmo motor. *(Extrair convenção visual de um `.drawio` de exemplo **não**
  é isto e segue dentro do escopo.)*
- **Auditoria formal Well-Architected com relatório** — misturar auditoria com
  desenho piora as duas; o relatório vira ruído na conversa de diagrama.
- **Diagrama de contexto C4-nível-1** — gênero adjacente, não pedido.
- **Renderizador como dependência de runtime** — contradiz a premissa 7.

A primeira exclusão é a que mais custa: é ela que faz a sabatina ser a única
guarda de veracidade do conteúdo.

## Névoa nomeada — o que ainda não é especificável

- **O custo em bytes do selo por página.** 65% num arquivo de 5 páginas, e escala
  com N. Falta saber se chega a importar, e isso depende de arquitetura real.
- **O ciclo de refino pós-execução** — como o feedback das primeiras execuções
  reais volta para a rubrica (premissa 12). Depende de existir execução real.
- **O gatilho da vista de zona de referência** e a **calibração dos gatilhos da
  revisão de lacunas** — os dois limiares dependem de densidade real, que só um
  corpus de arquiteturas verdadeiras dá.

## Dívida com endereço nesta skill

- **Nenhum diagrama emite legenda** (`A1.2`/`A1.3` no corpus inteiro). O
  vocabulário fechado do tema não contrai essa dívida, e não a contrai de
  propósito.
- **`A1.11` não tem onde ser satisfeita**: pede `data`, `versao`, `autor`, e
  `modelo@1` não tem os campos. Ou o esquema ganha os três, ou o índice marca a
  checagem como inaplicável a este esquema.
- **`A1.5` e `A1.12` não conhecem a nota presa a nó.** Desde que a nota com `sobre`
  virou nó do ELK — a correção que zerou as falhas semânticas dela —, as duas
  checagens a acusam de *desenhar como nó e não existir no modelo*, porque
  procuram em `nos[]` e ela vive em `notas[]`. Isolado em experimento de três
  casos. Escapou porque **nenhum modelo de `modelo/*.json` usa `sobre`**: só o
  corpus de sessão usa, e o laudo dele não é asserido checagem a checagem. Morde o
  protocolo de frente, já que a revisão de lacunas exige nota ligada por `viaNota`
  para todo achado recusado.
- **A camada de sessão não tem CLI.** `abrir`, `aprovar`, `conferir`, `desenhar` e
  `elaborar` são só módulos; quem dirige uma sessão escreve os drivers dos passos 5
  e 6 do [`SKILL.md`](../SKILL.md). `tools/sessao1.cjs` e `tools/sessao2.cjs` são
  os dois exemplos que a suíte mantém verdes — e **os dois têm o caso do corpus
  fixo no código**, então servem de modelo, não de ferramenta.
- **`elaboracao@1` é um contrato sem esquema.** O delta da fase técnica é
  declarado nos dados e consumido por `elaborar.cjs`, e nada valida a forma dele:
  `check-esquema-unico.cjs` varre os três arquivos de esquema que existem, e um
  contrato sem arquivo passa por baixo. O agente escreve esse delta em toda sessão
  técnica, então é a superfície não validada de maior uso. A forma está em
  [`modelo.md`](modelo.md); o conserto é um quarto `esquema.json`.
- **O context pack é contrato, não código.** Ver [`context-pack.md`](context-pack.md).
- **`A3.7` acusa em 8 de 15**: o caminho da grade dimensiona a largura só pela
  nuvem.
- **A grade de AZ não desenha conta como container raiz** — a vista de detalhe
  recusa alto em vez de desenhar a conta fora do lugar.
