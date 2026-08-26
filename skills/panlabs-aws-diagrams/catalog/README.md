# Catálogo de shapes AWS

O que o motor de geração consulta para transformar "põe um Lambda dentro de uma
subnet privada" numa style string do mxGraph que renderiza o ícone certo.

Resolve o ticket
[Extrair o catálogo de shapes AWS com as correções de cor e container](https://github.com/ThiagoPanini/panlabs-skills/issues/17).
A matéria-prima foi a pesquisa de shapes do #17. Ela está cristalizada aqui:
[`aws4.catalog.json`](aws4.catalog.json) é o extrato do `Sidebar-AWS4.js`, e
[`corrections.json`](corrections.json) é o que a pesquisa corrigiu nele.

> **Decidido: ele mora aqui.** A estrutura da skill deixou de ser névoa — o
> documento que o agente lê é [`../SKILL.md`](../SKILL.md), com a prosa de
> operação em [`../guide/`](../guide/), e `catalog/` continua sendo um diretório de
> código irmão de `engine/`. Quem quiser saber como o motor resolve um nome por
> aqui: [`../guide/model.md`](../guide/model.md).

## Os arquivos

| Arquivo | O que é | Gerado? |
|---|---|---|
| `aws4.catalog.json` | Espelho **fiel** do que o draw.io entrega: 403 service icons, 606 resource icons, 20 grupos, 30 categorias. | **sim** — não edite |
| `corrections.json` | O delta para o que a **AWS prescreve**: cores de paleta legada, `container=1`, renomes, desambiguação. Cada entrada carrega a evidência. | não — escrito à mão |
| `aws-shapes.cjs` | Resolve nome → shape e monta a style. Aplica as correções. Também é CLI. | não |
| `tools/extract-aws4-catalog.cjs` | Regenera o catálogo a partir de um clone do `jgraph/drawio`. | — |
| `tools/check-catalog.cjs` | 24 checagens estáticas, incluindo o round-trip. | — |
| `tools/render-sample.cjs` | Monta a amostra e o manifesto de posições. | — |
| `tools/verify-render.py` | Verificação por pixel: cada shape mostra glifo, não caixa vazia. | — |
| `tests/sample.drawio` · `.png` · `.manifest.json` | A amostra renderizada e conferida. | **sim** |

A separação entre as duas primeiras linhas é o ponto do desenho: **reextrair não
apaga correção**, e dá para responder "isto é assim porque o draw.io é assim" ou
"isto é assim porque nós mudamos, e aqui está o porquê".

## Usar

```js
const cat = require('./aws-shapes.cjs').load();

cat.service('lambda');
// { style: 'sketch=0;points=[...];fillColor=#ED7100;...resIcon=mxgraph.aws4.lambda;',
//   via: 'service', title: 'Lambda', stencil: 'lambda', fill: '#ED7100', w: 78, h: 78 }

cat.service('opensearch').stencil;   // 'elasticsearch_service'  (nome congelado)
cat.service('s3 tables').via;        // 'resource'               (ícone plano, sem quadrado)
cat.group('Availability Zone').corrections;
// [ '#147EBA->#00A4A6', 'container=1' ]
```

Como CLI, para conferir na mão:

```bash
node aws-shapes.cjs lambda opensearch "availability zone"
```

### A escada de resolução

Em ordem — a primeira que casar vence:

1. **desambiguação** — o título existe em duas paletas com cor ou ícone diferente
2. **renome** — nome atual da AWS → stencil congelado
3. **título ou nome de stencil**, normalizado
4. **sigla / apelido**
5. **substring inequívoca** — só se restar exatamente um candidato
6. **fallback** — ícone genérico, com o nome pedido devolvido como rótulo

A ordem entre 2 e 3 não é cosmética: pedir `sagemaker` casa por título exato com
`Sagemaker` (stencil `sagemaker_2`, roxo de Analytics) e nunca chegaria em
`SageMaker AI` (stencil `sagemaker`, teal). O título que o upstream não atualizou
venceria o nome atual. Há checagem para isso.

## O que foi corrigido

| Correção | Alcance |
|---|---|
| **Cores de paleta pré-2022** | 4 hexes → atual, em 12 grupos. `#D86613`→`#ED7100`, `#CD2264`→`#E7157B`, `#147EBA`→`#00A4A6`, `#DD3522`→`#DD344C`. Evidência: SVGs de `Architecture-Group-Icons_07312026`. |
| **`container=1` ausente** | 4 grupos saem da sidebar como retângulo puro e **não aninham**: Availability Zone, Security group e os dois Generic group. O ticket nomeia os dois primeiros; os Generic entraram porque é o mesmo defeito. |
| **Os dois caminhos de ícone** | `resourceIcon` (Service Icon, quadrado colorido) **e** `shape=mxgraph.aws4.<nome>` (Resource Icon plano). Buscar só o primeiro faz o gerador concluir que S3 Tables, EventBridge Pipes/Scheduler e Trainium não existem. |
| **Renomes congelados** | 24 entradas. O título da paleta acompanha o rename de marketing; o nome do stencil nunca. |
| **Títulos ambíguos** | 22 títulos existem em mais de uma paleta com cor divergente — e às vezes com **stencil** divergente, ou seja, ícone diferente. 17 resolvidos pelo deck oficial, 1 por coincidência stencil/título, 4 por desempate arbitrário marcado `review`. |

O que **não** foi corrigido, de propósito: cinco divergências de `fontColor` que
são escolha de rótulo do draw.io, não paleta velha. Corrigi-las é decidir a
camada de estilo — outro ticket. Estão listadas em `corrections.json`
sob `uncorrectedDivergences`, para a decisão ser tomada com a lista na mão.

## Compacto, e sem perder nada

355 das 403 styles de service icon já colapsavam num template de duas variáveis.
Normalizando um bug do upstream (`points=` repetido em 39 entradas da paleta
Management Governance, que o mxGraph ignora), sobem para **394 de 403**.

O catálogo guarda **template + (categoria, stencil)**, não 1009 strings. Restam
44 literais — variantes de gradiente que não cabem no molde. A checagem de
round-trip reconstrói os 965 restantes e compara com o que o `Sidebar-AWS4.js`
produz: **0 divergentes**. Compactar aqui é compressão, não aproximação.

## Rodar a suite

```bash
./tests/run.sh                      # usa /tmp/drawio e ~/.local/opt/drawio/
./tests/run.sh /caminho/do/repo /caminho/do/binario
```

Três camadas:

1. **`check-catalog.cjs`** — 24 checagens estáticas. Round-trip, referências de
   stencil, tabelas apontando e **resolvendo** para o stencil declarado, nenhuma
   cor legada sobrevivente, nenhum grupo sem `container=1`, toda ambiguidade
   coberta. Não precisa renderizar.
2. **`render-sample.cjs`** — monta uma amostra de 23 service icons, 6 resource
   icons e 12 tipos de grupo, cada grupo com um ícone aninhado dentro.
3. **`verify-render.py`** — renderiza e checa **shape a shape**, por pixel.

### "Caixa vazia" tem definição mecânica

O ícone errado e a caixa vazia são o mesmo bug visto de longe, então a checagem
não pode ser "tem alguma cor ali":

- **Service Icon** — o quadrado é `fillColor`, o glifo é `strokeColor` (#ffffff)
  com 10% de inset. `resIcon` apontando para stencil inexistente pinta só o
  quadrado. Logo: **tem que haver pixel branco nos 80% centrais**.
- **Resource Icon plano** — não há quadrado. Um `shape=` inexistente cai no
  retângulo padrão do mxGraph, **preenchido de ponta a ponta** com `fillColor` —
  que uma checagem ingênua aprovaria. Por isso há teto de densidade: glifo real
  ocupa 15–30% da caixa; bloco sólido, 100%.
- **Grupo** — borda em `strokeColor` mais o `grIcon` numa janela de 25 px no
  canto, afastada da borda e antes do `spacingLeft=30`, para não confundir com o
  rótulo.

O mapeamento coordenada→pixel vem de **dois marcadores magenta** no diagrama, não
de adivinhar a margem e a escala do exportador.

O verificador foi validado por **experimento de controle**: corrompendo nomes de
stencil na amostra, ele acusa 15 falhas — e foi esse controle que revelou o furo
do bloco sólido, que a versão anterior aprovava.

## Envelhecimento

| | |
|---|---|
| Deck AWS corrente | **Q3 2026** (`Icon-package_07312026`) |
| draw.io analisado | **31.3.1**, commit `d3140c31` — embute ≈ deck **Q1 2026** |
| Atraso | ~2 releases da AWS |

A AWS solta ícone trimestralmente (fim de jan/abr/jul; nada em Q4). Nomes de
stencil **congelam** no rename e nada é removido, então o catálogo não quebra —
ele fica para trás em silêncio.

Ao dar bump no draw.io:

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/jgraph/drawio.git /tmp/drawio
cd /tmp/drawio && git sparse-checkout set src/main/webapp/js/diagramly \
    src/main/webapp/stencils src/main/webapp/shapes src/main/webapp/js/grapheditor
node tools/extract-aws4-catalog.cjs /tmp/drawio
./tests/run.sh
```

Ao dar bump no deck da AWS, reconferir `legacyPalette` e
`uncorrectedDivergences` contra os SVGs novos de `Architecture-Group-Icons`.

## Bugs do upstream registrados

Não são corrigidos aqui — o catálogo espelha o draw.io — mas quem consome
precisa saber. Estão em `corrections.json` sob `bugsUpstream`:

- **`points=` duplicado** em 39 entradas de Management Governance. Cosmético; o
  mxGraph usa a última ocorrência. Normalizado na extração.
- **A aresta "Open (double)"** sai com `htmDepartman barl=1` no lugar de
  `html=1` — uma string de tradução vazou para dentro da style. Qualquer aresta
  nossa deve ser **montada**, nunca copiada dessa entrada.

## Aberto

- **4 desempates arbitrários** entre paletas: Compute Optimizer, Kinesis Video
  Streams, Quantum Ledger Database, Snowmobile. Nos dois primeiros a própria AWS
  lista o serviço em duas categorias; os dois últimos sumiram do deck por
  descontinuação. Hoje vale a ordem da paleta, marcada `review: true`. Efeito
  colateral visível: `snowmobile` cai em Migration enquanto Snowball e Snowball
  Edge caem em Storage pelo deck — os irmãos ficam inconsistentes.
- **5 divergências de `fontColor`** não corrigidas (acima). A mais visível é o
  VPC, cujo rótulo é cinza `#AAB7B8` sobre borda roxa — some no diagrama.
