# Layout de grafo dirigido com containers aninhados — que biblioteca usar num script auto-contido

> **Pergunta de pesquisa:** que algoritmo/biblioteca produz layout de qualidade para um grafo
> dirigido com containers aninhados (compound/hierarchical graph), e é usável dentro de um script
> embarcado numa skill de agente que precisa ser auto-contida?
>
> **Critério de corte inegociável:** zero dependência de binário nativo pré-instalado no SO.
> Tem que instalar por `pip` ou `npm` e funcionar.
>
> **Data da pesquisa:** 2026-08-21
> **Ambiente de teste:** Linux 6.6.87 (WSL2) x86_64, Node v24.18.0, npm 11.16.0, Python 3.12.3,
> **sem Graphviz instalado no sistema** (`which dot` → vazio). Isto não é hipótese: a máquina de
> teste é justamente uma máquina "limpa" quanto a binários de layout.

---

## Fontes primárias usadas

Toda afirmação neste documento vem de uma destas fontes, ou de um experimento executado
nesta máquina. **Nenhum blog post foi usado como autoridade.**

| # | Fonte | URL / referência |
|---|---|---|
| F1 | ELK — página do algoritmo `layered` | <https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html> |
| F2 | ELK — Coordinate System (doc oficial) | <https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html> |
| F3 | ELK — JSON Format (doc oficial) | <https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html> |
| F4 | ELK — Reference de opções (páginas individuais) | <https://eclipse.dev/elk/reference/options.html> |
| F5 | elkjs — README no repositório | <https://github.com/kieler/elkjs> |
| F6 | npm registry — metadados de `elkjs`, `@dagrejs/dagre`, `@viz-js/viz`, `@hpcc-js/wasm-graphviz`, `dagre`, `@msagl/core` | `https://registry.npmjs.org/<pkg>` |
| F7 | dagre — código-fonte (`master`, clonado) | <https://github.com/dagrejs/dagre> — `lib/nesting-graph.ts`, `lib/layout.ts` |
| F8 | PyGraphviz — doc oficial de instalação | <https://pygraphviz.github.io/documentation/stable/install.html> |
| F9 | PyPI — matriz de wheels de `pygraphviz` | <https://pypi.org/pypi/pygraphviz/json> |
| F10 | Graphviz — atributo `splines` | <https://graphviz.org/docs/attrs/splines/> |
| F11 | mxGraph — API doc de `mxGeometry` | <https://jgraph.github.io/mxgraph/docs/js-api/files/model/mxGeometry-js.html> |
| F12 | Python `graphviz` — manual oficial | <https://graphviz.readthedocs.io/en/stable/manual.html> |
| F13 | Releases do `eclipse-elk/elk` e atividade dos repositórios | GitHub API |
| F14 | Docstrings/código instalados de `grandalf` 0.8, `igraph` 1.0.0, `networkx` 3.6.1, `pydot` 4.0.1 | inspeção local no venv |
| E* | **Experimentos executados nesta máquina** — ver seção "Método experimental" | — |

---

## Recomendação em uma linha

**Use `elkjs` (Eclipse Layout Kernel, algoritmo `layered`) num script Node.** É a única
candidata que entrega, simultaneamente: instalação limpa por `npm` sem binário nativo,
hierarquia de containers em profundidade arbitrária numa **única passada de layout**,
**coordenadas já relativas ao pai** (a semântica exata do `mxGeometry`), **waypoints
ortogonais calculados** e **constraints de posicionamento**. Runner-up: **Graphviz via WASM
(`@viz-js/viz`) ou `pygraphviz >= 2.0`** — perde por detalhes de integração, não por qualidade
de desenho. Detalhamento abaixo.

---

## Tabela comparativa

| Lib | Linguagem / runtime | Auto-contida? (só `pip`/`npm`) | Containers aninhados? | Roteamento de aresta | Constraints de posição | Mantida? | Veredito |
|---|---|---|---|---|---|---|---|
| **`elkjs` 0.12.0** (ELK `layered`) | JS puro, transpilado de Java via GWT | ✅ **Sim** — `npm i elkjs`, **zero dependências**, 7.8 MB | ✅ **Sim, N níveis**, uma passada só (`hierarchyHandling: INCLUDE_CHILDREN`) — testado a 3 níveis | ✅ **Waypoints ortogonais calculados** (`edgeRouting: ORTHOGONAL`, `sections[].bendPoints`) | ✅ Camada (`layerConstraint: FIRST/LAST`) + ordem dentro da camada (`elk.position` + `semiInteractive`) | ✅ ELK v0.12.0 em 2026-07-22; commits em ago/2026 | ✅ **RECOMENDADA** |
| **`@viz-js/viz` 3.29.0** (Graphviz 15.1.1 em WASM) | WASM + wrapper JS | ✅ **Sim** — `npm i @viz-js/viz`, zero deps, 5.0 MB | ✅ **Sim**, `subgraph cluster_*` aninhado; `bb`/`lp` por cluster no output JSON | ⚠️ Splines de Bézier por padrão; `splines=ortho` existe mas "não trata portas nem, no `dot`, rótulos de aresta" (F10) e **não desvia de clusters no `dot`** (F10) | ⚠️ `rank=min/max/same` apenas; sem pin absoluto no `dot` | ✅ commit em 2026-08-11 | 🥈 **Runner-up** |
| **`@hpcc-js/wasm-graphviz` 1.28.0** (Graphviz 15.1.0) | WASM + wrapper JS | ✅ Sim — zero deps, 2.1 MB | ✅ Sim (idêntico ao acima) | ⚠️ idem | ⚠️ idem | ✅ 2026-07-24 | Equivalente ao `@viz-js/viz`, API mais enxuta |
| **`pygraphviz` >= 2.0** (2.0.1, Graphviz 14.x embutido) | C ext. + libs Graphviz **dentro do wheel** | ✅ **Sim, desde a 2.0** — wheels cp310–cp314 para manylinux_2_28 (x86_64/aarch64), macOS (arm64/x86_64), win_amd64 (F9). ⚠️ **sem wheel musllinux (Alpine)** | ✅ Sim, clusters aninhados com `bb`/`lp` | ⚠️ idem Graphviz | ⚠️ idem Graphviz | ✅ commit em 2026-08-18 | 🥉 Melhor caminho **se o script tiver que ser Python** |
| **`@dagrejs/dagre` 3.1.1** | JS puro | ✅ Sim — 1 dep (`@dagrejs/graphlib`) | ⚠️ **Sim, funciona** (`compound: true` + `setParent`), mas **sem padding por container e sem espaço de rótulo de grupo** (F7: só `nodesep`/`edgesep`/`ranksep`/`marginx`/`marginy`, todos **globais**) | ❌ Polyline sobre a grade de ranks; **não desvia de bordas de cluster** (E7) | ⚠️ Só `rank` implícito; sem `layerConstraint` | ✅ v3.1.1 em 2026-08-08 | ❌ Perde no padding/rótulo — exatamente onde arquitetura quebra |
| `dagre` (pacote npm sem escopo) | JS puro | ✅ Sim | — | — | — | ❌ **0.8.5, última publicação 2019-12-03** (F6). O README oficial diz: "only the one in the DagreJs org is receiving updates right now" | ❌ Abandonado — use `@dagrejs/dagre` |
| **`msagljs` / `@msagl/core` 1.1.24** | TypeScript puro | ✅ Sim | ⚠️ suporta clusters | ⚠️ | ⚠️ | ⚠️ 1.1.24 em 2026-04-24, mas 1.1.23 era de 2024-09 — cadência esparsa | ❌ Não avaliada a fundo: sem vantagem sobre ELK e com menos tração |
| **`pydot` 4.0.1** | Python (gera DOT, **executa `dot`**) | ❌ **NÃO** | (n/a) | (n/a) | (n/a) | ✅ | ❌ **DESQUALIFICADA.** Verificado: `create()` → `FileNotFoundError: "dot" not found in path` |
| **`graphviz` (PyPI) 0.21** | Python (wrapper de CLI) | ❌ **NÃO** — "The only dependency is a working installation of Graphviz… make sure that its `bin/` subdirectory containing the `dot` layout command… is on your systems' `PATH`" (F12) | (n/a) | (n/a) | (n/a) | ✅ | ❌ **DESQUALIFICADA** — é o caso `apt install graphviz` |
| `pygraphviz` **< 2.0** | C ext. | ❌ **NÃO** — "Prior to version 2.0, pygraphviz requires Graphviz (version 2.46 or later) to be installed on the system" (F8) | — | — | — | — | ❌ Desqualificada; **a 2.0 resolveu isto** |
| **`grandalf` 0.8** | Python puro (Sugiyama) | ✅ Sim | ❌ **Não.** Busca no fonte de `grandalf.layouts`: `cluster`=0, `compound`=0, `nested`=0, `parent`=0, `subgraph`=0, `group`=0, `container`=0 ocorrências | ❌ nenhuma função de routing (`[n for n in dir(L) if 'route' in n]` → `[]`) | ❌ | ❌ Último release **0.8 em 2023-01-10**; último commit no repo `bdcht/grandalf` também 2023-01-10 | ❌ **DESCARTADA** — sem containers, sem routing, parada |
| **`igraph` 1.0.0** | C core em wheel (auto-contida) | ✅ Sim | ❌ Não. `layout_sugiyama` aceita `layers` (índice de camada por vértice) mas a docstring não menciona `cluster` nem `nested` (F14) | ❌ Só posiciona vértices (+ dummies) | ⚠️ `layers` fixa a camada | ✅ | ❌ **DESCARTADA** — sem noção de container |
| **`networkx` 3.6.1** | Python puro | ✅ (o core) | ❌ Não. Layouts nativos: `spring`, `circular`, `multipartite`, `bipartite`, `shell`, `spectral`, `planar`, `kamada_kawai`, `forceatlas2`, … — nenhum com containers | ❌ Nenhum layout devolve rota de aresta | ❌ | ✅ | ❌ **DESCARTADA como engine.** `nx_agraph`/`nx_pydot` só delegam ao Graphviz e devolvem **um dicionário de posições de nó** — sem bbox de cluster, sem spline |

Legenda: ✅ atende — ⚠️ atende com ressalva — ❌ não atende.

---

## Método experimental

Cada afirmação marcada `E<n>` abaixo foi produzida por um script executado na máquina descrita
no cabeçalho, com Graphviz **ausente** do sistema.

| ID | O que foi testado |
|---|---|
| E1 | ELK: grafo 2 níveis (`aws` ⊃ `vpc` ⊃ {alb, ecs}), aresta cruzando 2 níveis de hierarquia |
| E2 | ELK: `shapeCoords` `PARENT` vs `ROOT` — checagem aritmética de que as duas descrevem o mesmo desenho |
| E3 | ELK: 3 níveis de container + arestas cruzando containers irmãos, forçando cruzamentos |
| E4 | ELK: determinismo — 5 execuções com instância nova + 5 com a mesma instância, fingerprint só da geometria |
| E5 | ELK: matriz de `nodeLabels.placement` × `nodeSize.constraints` × `padding` — 14 combinações |
| E6 | ELK: `layerConstraint` + `elk.position` + `crossingMinimization.semiInteractive` |
| E7 | dagre 3.1.1: compound/`setParent`, determinismo, padding de cluster, waypoints |
| E8 | Graphviz WASM (`@viz-js/viz`, `@hpcc-js/wasm-graphviz`): clusters aninhados a 3 níveis, `splines` ∈ {spline, ortho, polyline, line}, determinismo, unidades |
| E9 | `pygraphviz` 2.0.1 instalado por `pip` numa máquina **sem** Graphviz: `A.layout(prog='dot')` com clusters aninhados |
| E10 | `pydot` 4.0.1 na mesma máquina |
| E11 | ELK: 72 nós / 12 containers / 60 arestas — tempo de layout |

---

## 1. ELK / `elkjs` — confirmado

### É JS puro?

Sim. O README oficial (F5) descreve os arquivos entregues:

> `elk-worker.js`: Provides the code that actually knows how to lay out a graph. This is the file
> that is generated from ELK's Java code base using GWT.

Metadados do npm (F6) para `elkjs@0.12.0` (publicado **2026-07-17**):

```
dependencies:         None
optionalDependencies: None
peerDependencies:     None
license:              EPL-2.0 OR GPL-3.0-or-later
unpackedSize:         8046232
```

**Zero dependências.** `npm install elkjs` instalou em 5 s e o layout roda em Node puro
(`import ELK from 'elkjs/lib/elk.bundled.js'`) sem web worker, sem binário, sem etapa de build.
O pacote `web-worker` é opcional e só entra se você quiser rodar num worker (F5).

Manutenção (F13): ELK v0.12.0 publicado em **2026-07-22**; último commit em `eclipse-elk/elk`
em **2026-08-05**; em `kieler/elkjs` em **2026-08-13**. Vivo.

### Honra containers aninhados de verdade, em múltiplos níveis?

Sim. A página oficial do algoritmo (F1) declara, verbatim:

> Furthermore, **full layout of compound graphs with cross-hierarchy edges is supported** when
> the respective option is activated on the top level.

e lista, em "Supported Graph Features":

> **Compound** — Edges that connect nodes from different hierarchy levels and are incident to compound nodes.
> **Clusters** — Edges that connect nodes from different clusters, but not the cluster parent nodes.

A opção referida é `org.eclipse.elk.hierarchyHandling` (F4):

> Determines whether separate layout runs are triggered for different compound nodes in a
> hierarchical graph. Setting a node's hierarchy handling to `INCLUDE_CHILDREN` will lay out that
> node and all of its descendants in a single layout run… **If the root node is set to `INHERIT`
> (or not set at all), the default behavior is `SEPARATE_CHILDREN`.**

⚠️ **Pegadinha de default:** se você não setar `hierarchyHandling: INCLUDE_CHILDREN` na raiz, o ELK
faz uma passada de layout **por container isoladamente** e as arestas que cruzam níveis ficam ruins.
Isto não é opcional para diagrama de arquitetura.

**E3 (3 níveis, verificado):**

```
root
  L1  x=12.0 y=87.0  w=721 h=682          <- nível 1
    L2  x=171.0 y=74.0  w=534 h=587       <- nível 2 (relativo a L1)
      L3a x=160.0 y=338.0 w=349 h=210     <- nível 3 (relativo a L2)
        a1 x=117.0 y=57.0 ; a2 x=237.0 y=57.0
      L3b x=160.0 y=88.0  w=349 h=210
        b1 x=237.0 y=57.0 ; b2 x=117.0 y=57.0
  ext1 x=596.7 y=12.0        <- layerConstraint FIRST
  ext2 x=288.7 y=794.0       <- layerConstraint LAST
```

Três níveis reais, cada container dimensionado a partir do conteúdo, filhos posicionados dentro
das bordas do pai. Note que o ELK **trocou a ordem** de `L3a`/`L3b` (L3b acabou acima) para reduzir
cruzamentos — ou seja, ele está de fato otimizando através da hierarquia, não só empilhando caixas.

---

## 2. Graphviz — o binário nativo deixou de ser obrigatório (com ressalvas)

Esta é a parte da pesquisa que contraria o senso comum. **"Graphviz exige `apt install graphviz`"
não é mais verdade em geral** — depende do wrapper:

| Caminho | Precisa de binário no SO? | Evidência |
|---|---|---|
| `pip install graphviz` (PyPI `graphviz` 0.21) | ❌ **SIM, precisa** | F12: "The only dependency is a working installation of Graphviz… make sure that its `bin/` subdirectory containing the `dot` layout command for rendering graph descriptions is on your systems' `PATH`" |
| `pip install pydot` | ❌ **SIM, precisa** | **E10**, verificado: `g.create(format='json')` → `FileNotFoundError: [Errno 2] "dot" not found in path.` |
| `pip install pygraphviz` **>= 2.0** | ✅ **NÃO precisa** | F8: "PyGraphviz provides wheels for most common platforms and can be installed with pip… **Note: Prior to version 2.0, pygraphviz requires Graphviz (version 2.46 or later) to be installed on the system.**" |
| `npm i @viz-js/viz` / `@hpcc-js/wasm-graphviz` | ✅ **NÃO precisa** | Build WASM do Graphviz; **E8** verificado |

### Um build WASM satisfaz o critério de auto-contenção?

**Sim.** O `.wasm` viaja dentro do tarball do npm; não há chamada a processo externo, não há
`dlopen` de biblioteca do sistema, não há passo de compilação. **E8**, nesta máquina sem `dot`:

```
graphvizVersion: 15.1.1
engines: circo,dot,fdp,neato,nop,nop1,nop2,osage,patchwork,sfdp,twopi
graph bb: 0,0,202,391.2
CLUSTERS:
  cluster_aws  bb=8,8,194,340       lp=100.77,327.6
  cluster_vpc  bb=27,79.2,175,299.2 lp=82.062,286.8
  cluster_az   bb=39,91.2,163,262.4 lp=86.457,250
```

Três clusters aninhados, cada um com bounding box e posição de rótulo. Determinístico em 3
execuções e entre instâncias novas.

### E o `pygraphviz` 2.0?

**E9**, nesta máquina sem Graphviz: `pip install pygraphviz` baixou
`pygraphviz-2.0.1-cp312-cp312-manylinux_2_28_x86_64.whl` (5,4 MB) e o layout **rodou**:

```
shutil.which('dot'): None
>>> LAYOUT OK with NO system graphviz installed
  subgraph cluster_aws bb= 8,8,164,304.1 lp= 65.125,291.47
    subgraph cluster_vpc bb= 24,91.2,148,262.85 lp= 47.75,250.22
```

O wheel traz `pygraphviz.libs/` com `libgvc-*.so.7.0.9`, `libcgraph`, `libgvplugin_dot_layout-*.so.8.0.10`,
`libpathplan`, `libcairo`, `libpango`… O binário `dot` **não** vem no wheel (só
`acyclic ccomps gc gvcolor gvpr sccmap tred unflatten` em `pygraphviz/bin`) — o layout é chamado
via `libgvc` linkada na extensão C, e é por isso que funciona.

⚠️ **Ressalva de portabilidade (F9):** a matriz de wheels da 2.0.1 é
cp310–cp314 × {`macosx_11_0_arm64`, `macosx_11_0_x86_64`, `manylinux_2_28_aarch64`,
`manylinux_2_28_x86_64`, `win_amd64`}. **Não há wheel `musllinux`** → numa imagem Alpine o pip cai
para o `.tar.gz` e aí sim volta a exigir Graphviz + compilador C. `elkjs` (JS puro) e os builds
WASM não têm esse buraco.

---

## 3. `dagre` — vivo, com compound, mas perde onde importa

Contra a lore comum: **`@dagrejs/dagre` 3.1.1 (publicado 2026-08-08) suporta compound nodes.**
O fonte (F7, `lib/nesting-graph.ts`) traz:

> A nesting graph creates dummy nodes for the tops and bottoms of subgraphs, adds appropriate edges
> to ensure that all cluster nodes are placed between these boundaries… The nesting graph idea comes
> from **Sander, "Layout of Compound Directed Graphs."**

**E7** confirma que funciona, inclusive aninhado (`vpc` dentro de `aws`), e que é **determinístico**
(4 execuções, mesmo fingerprint). Mas há três problemas que o eliminam para diagrama de arquitetura:

1. **Sem padding por container.** Em `lib/layout.ts` (F7), as opções numéricas de grafo são
   `["nodesep", "edgesep", "ranksep", "marginx", "marginy"]` — **todas globais**, nenhuma por cluster.
   Em **E7** o gap entre a borda do cluster e o primeiro filho foi fixo em 20 px, não configurável.
2. **Sem espaço reservado para rótulo de grupo.** `clusterLabelPos` é aceito como campo do nó mas
   **não é lido pelo layout** — em **E7**, com `clusterLabelPos: 'top'` e um título de 24 caracteres,
   o gap continuou 20 px. `clusterLabelPos` é conceito do renderer `dagre-d3`, não do `dagre`.
3. **Roteamento não desvia de borda de cluster.** Em **E7** a aresta `a1 -> b2` (que sai de dentro do
   `vpc` para fora) veio como
   `[{x:305,y:200},{x:305,y:220},{x:425,y:251.57894736842104}]` — o último segmento é uma
   **diagonal** cortando a borda do container.

Além disso as coordenadas são **centro absoluto** (`x`,`y` = centro do nó, no sistema global), não
relativas ao pai — dá mais trabalho para mapear em `mxGeometry`.

> ⚠️ O pacote npm **`dagre` sem escopo está morto**: versão 0.8.5, última publicação **2019-12-03** (F6).
> O README oficial diz: "There are 2 versions on NPM, but only the one in the DagreJs org is receiving
> updates right now." Se você for usar dagre, é `@dagrejs/dagre`.

---

## 4. Respostas às perguntas operacionais

### 4.1 Como o output mapeia para `mxGeometry` — absolutas ou relativas ao pai?

**ELK: relativas ao pai por padrão, e isso é exatamente o que o `mxGeometry` quer.**

A doc oficial de `mxGeometry` (F11) define:

> **`relative`** — Specifies if the coordinates in the geometry are to be interpreted as relative
> coordinates… **If this is false, then the coordinates are relative to the origin of the parent cell**…

Ou seja: para um vértice com `relative="0"` (o default do drawio), `x`/`y` já são medidos a partir do
canto superior esquerdo da célula pai. E a doc de coordenadas do ELK (F2):

> The coordinates of most elements are **relative to their parent element**.

O ELK ainda deixa você escolher explicitamente, por duas opções do importador JSON (F2, F4):

| Opção | Valores | Default |
|---|---|---|
| `org.eclipse.elk.json.shapeCoords` | `INHERIT` \| `PARENT` \| `ROOT` | `INHERIT`, exceto na raiz onde é `PARENT` |
| `org.eclipse.elk.json.edgeCoords` | `INHERIT` \| `CONTAINER` \| `PARENT` \| `ROOT` | `INHERIT`, exceto na raiz onde é **`CONTAINER`** |

**Receita para mxGraph:**
- `'elk.json.shapeCoords': 'PARENT'` → cada `x`/`y` cai direto no `<mxGeometry>` do filho, com
  `parent` = id do container. **Zero aritmética.**
- `'elk.json.edgeCoords': 'ROOT'` → waypoints em coordenadas absolutas, que é o que você quer se as
  arestas forem penduradas na layer raiz do drawio (`parent="1"`), o padrão.

**E2** verificou a consistência das duas leituras do mesmo desenho:

```
PARENT: aws (12,117) ; vpc (215,80) rel. a aws ; alb (151,69) rel. a vpc
ROOT  : aws (12,117) ; vpc (227,197)           ; alb (378,266)
        12+215 = 227 ✓   117+80  = 197 ✓
        12+215+151 = 378 ✓  117+80+69 = 266 ✓
```

⚠️ **Cuidado com o default `CONTAINER` para arestas.** Se você não setar `edgeCoords`, as
coordenadas de aresta ficam relativas ao **container próprio** da aresta (o *lowest common ancestor*
das pontas), que **não é** necessariamente o nó onde você declarou a aresta no JSON. O ELK escreve
o campo `container` em cada aresta para você conseguir interpretar (F2) — em **E3** apareceu
`EDGE x3 container=L2` para uma aresta declarada na raiz. É uma fonte de bug silencioso: prefira
`ROOT` e acabou.

**Graphviz (runner-up):** coordenadas **absolutas**, e com duas conversões obrigatórias:
- **Eixo Y invertido** — origem no canto **inferior** esquerdo. Precisa de `y_mx = bb_altura - y_gv`.
- **Unidades mistas** — em **E8**: `node a1: pos(points)= 92.4,200.8   width(inches)= 1.4   height(inches)= 0.6`.
  `pos` vem em **pontos**, `width`/`height` em **polegadas**. Fator 72.

### 4.2 A lib honra padding interno de container e rótulo de grupo ocupando espaço no topo?

Estes são os dois pontos onde layout de arquitetura quebra, e é onde a pesquisa rendeu mais.

#### Padding: sim, por container, em qualquer nível

`org.eclipse.elk.padding` (F4):

> The padding to be left to a parent element's border when placing child elements. **Applies To: parents, nodes.** Default: `new ElkPadding(12)`.

Setável **por container**, com os quatro lados independentes:
`'elk.padding': '[top=50,left=20,bottom=20,right=20]'`. **E1** confirmou em dois níveis simultâneos.

#### Rótulo de grupo: sim, mas o caminho óbvio é uma armadilha

**E5** rodou a matriz. Container com título de 300×30 e dois filhos:

| Config | box | label | canto sup. esq. da área de filhos | veredito |
|---|---|---|---|---|
| **A)** defaults (sem `nodeLabels.placement`) | 84×124 | (0,0) 300×30 | (12,12) | ❌ **SOBREPÕE** o título |
| **B)** `nodeLabels.placement: [H_LEFT,V_TOP,INSIDE]` | 469×99 | (5,5) | **(317,47)** | ❌ **empurra os filhos para a DIREITA do rótulo** |
| **C)** `[H_CENTER,V_TOP,INSIDE]` | 164×99 | (-68,5) | (12,47) | ✅ faixa no topo, mas o box **não cresce** para caber o título |
| **D)** `[H_RIGHT,V_TOP,INSIDE]` | 469×99 | (164,5) | (12,47) | ❌ gutter desperdiçado à direita |
| **E)** **sem `placement`, com `padding: [top=44,…]`** | **164×96** | (0,0) | **(12,44)** | ✅ **previsível e apertado** |

Duas conclusões duras:

1. **`nodeLabels.placement` default é `NodeLabelPlacement.fixed()`** e a doc (F4) diz: *"Hints for
   where node labels are to be placed; **if empty, the node label's position is not modified**."*
   Ou seja: **por padrão o ELK não reserva espaço nenhum para o rótulo do container** — linha A,
   sobreposição garantida. Quem não souber disso entrega diagrama com título por cima do conteúdo.
2. **`H_LEFT` + `INSIDE` não faz o que parece.** O ELK trata os rótulos internos como células de uma
   grade 3×3, e a área dos filhos é a célula do meio. Com `H_LEFT`, o rótulo ocupa a célula superior-
   **esquerda** e a área de filhos começa **depois da largura do rótulo** (x=317 na linha B), gerando
   um vão morto de ~300 px à esquerda. Como a convenção de arquitetura é justamente título no
   **topo à esquerda**, este é o caminho que todo mundo tenta primeiro — e é o errado.

**Recomendação (linha E):** não delegue o rótulo ao ELK. Reserve a faixa você mesmo como
`padding.top = altura_do_titulo + gap`, e desenhe o rótulo no mxGraph com
`verticalAlign=top;align=left`. Você fica com controle total e o resultado é o mais compacto da
matriz.

#### ⚠️ Bug/quirk confirmado: `nodeSize.minimum` troca os eixos em nó compound

O reflexo natural para "garantir que o título cabe" é `nodeSize.constraints: [MINIMUM_SIZE]` +
`nodeSize.minimum: (largura, altura)`. **Não funciona em container.** **E5**, `nodeSize.minimum = (320,80)`:

```
--- compound (tem filhos) ---
dir=DOWN   -> box=164x320     <- o 320 foi parar na ALTURA
dir=RIGHT  -> box=320x124     <- correto
dir=UP     -> box=164x320     <- errado
dir=LEFT   -> box=320x124     <- correto
--- nó folha (sem filhos) ---
dir=DOWN   -> box=320x80      <- correto
dir=RIGHT  -> box=320x80      <- correto
```

Em nó **folha** funciona sempre. Em nó **compound** com `direction` `DOWN`/`UP` os eixos saem
trocados (o `layered` trabalha internamente em `RIGHT` e o destroca parece não ser aplicado ao
mínimo). Também explica as alturas absurdas (`610`, `310`) que aparecem ao combinar
`nodeSize.constraints` com `nodeLabels.placement` em container.

**Contorno usado no exemplo abaixo:** pós-processar. Depois do layout, se
`container.width < largura_estimada_do_titulo`, alargue o container. É uma linha de código e não
depende de nenhuma opção do ELK. (Ver "Incertezas" — alargar pode encostar num irmão.)

### 4.3 Roteamento de aresta: waypoints ou só posicionamento?

**ELK entrega waypoints ortogonais calculados.** `org.eclipse.elk.edgeRouting` (F4) aceita
`UNDEFINED | POLYLINE | ORTHOGONAL | SPLINES`. O formato JSON (F3) devolve, por aresta, um array
`sections`, cada seção com `startPoint`, `endPoint` e `bendPoints`.

**E3** com `ORTHOGONAL`, aresta atravessando dois containers irmãos no nível 3:

```
EDGE x3 container=L2 bends=4: (327,445)->(327,563)->(150,563)->(150,73)->(327,73)->(327,145)
EDGE x1 container=root bends=4: (663,62)->(663,72)->(702,72)->(702,484)->(510,484)->(510,556)
```

Segmentos estritamente axis-aligned, contornando os containers. É exatamente o que você joga num
`<Array as="points">` de um `edgeStyle=orthogonalEdgeStyle`.

**Graphviz:** por padrão devolve **splines de Bézier** (o campo `pos` é `e,x,y` seguido dos pontos de
controle de uma B-spline cúbica por partes) — precisa ser amostrada ou aproximada para virar
waypoint de mxGraph. Existe `splines=ortho`, mas a doc oficial (F10) avisa:

> (28 Sep 2010) `splines=ortho` specifies edges should be routed as polylines of axis-aligned
> segments. **Currently, the routing does not handle ports or, in `dot`, edge labels.**

e, mais grave para arquitetura com containers:

> **If `fdp` is used for layout and `splines="compound"`, then the edges are drawn to avoid clusters
> as well as nodes.**

Isto é, "desviar de cluster" no Graphviz é feature do **`fdp`**, não do **`dot`**. Com `dot` +
clusters as arestas não têm garantia de contornar os containers. **Este é o motivo principal pelo
qual o Graphviz ficou em segundo lugar**, não a auto-contenção.

**dagre:** só polyline sobre a grade de ranks, sem consciência de borda de cluster (§3).

### 4.4 Dá pra fixar posição de um nó?

Sim, em dois eixos independentes, e **E6** provou os dois.

**(a) Em que camada o nó cai** — `org.eclipse.elk.layered.layering.layerConstraint` (F4),
valores `NONE | FIRST | FIRST_SEPARATE | LAST | LAST_SEPARATE`:

> Determines a constraint on the placement of the node regarding the layering.

Com `direction: DOWN`, `FIRST` = topo. Em **E3**: `ext1` (FIRST) → `y=12`; `ext2` (LAST) → `y=794`.

**(b) A ordem dentro da camada** — `elk.position` + `crossingMinimization.semiInteractive` (F4):

> **Semi-Interactive Crossing Minimization** — Preserves the order of nodes within a layer but still
> minimizes crossings between edges connecting long edge dummies. **Derives the desired order from
> positions specified by the `org.eclipse.elk.position` layout option.**

**E6**, prova de causalidade:

```
semi=true   user@(0,0) cdn@(1,0)  -> primeira camada esq->dir: [ user , cdn ]
semi=true   user@(1,0) cdn@(0,0)  -> primeira camada esq->dir: [ cdn , user ]   <- inverteu
semi=false  user@(1,0) cdn@(0,0)  -> primeira camada esq->dir: [ user , cdn ]   <- position ignorado
```

Então **"o usuário/internet sempre no topo à esquerda"** =
`layerConstraint: FIRST` + `elk.position: (0,0)` + `semiInteractive: true` na raiz. ✅

Nota: `org.eclipse.elk.position` sozinho é descrito como *"used by the 'Fixed Layout' algorithm to
specify a pre-defined position"* (F4) — pin absoluto de verdade só com o algoritmo `elk.fixed`,
que não faz layout nenhum. Para o `layered`, `position` é **ordinal**, não pixel.

**Graphviz:** `{rank=min; internet}` fixa o nó na primeira rank; ordenação dentro da rank é
indireta (ordem de declaração / arestas invisíveis com `constraint=false`). Pin em pixel (`pos="x,y!"`)
só nos engines `neato`/`fdp`, que não fazem layout em camadas. Mais fraco que o ELK.

### 4.5 Determinismo

**ELK: a geometria é determinística. O blob JSON não é — e a diferença tem uma causa boba.**

**E4**: 5 execuções com instância nova + 5 com a mesma instância, fingerprint calculado só sobre
`(id, x, y, width, height)` de todo nó e sobre todos os pontos de todas as arestas:

```
fresh-instance run0..4 geom-hash: d9210a03c7ff9cdb  (×5, idênticos)
same-instance  run0..4 geom-hash: d9210a03c7ff9cdb  (×5, idênticos)
```

Mas `JSON.stringify(resultado)` **difere** entre execuções. Diff campo a campo de duas execuções do
mesmo grafo:

```
DIFF .children.0.$H : 277 vs 358
DIFF .children.1.$H : 279 vs 360
DIFF .children.2.$H : 281 vs 362
DIFF .$H            : 13  vs 356
```

É só o campo **`$H`** — o hashcode de objeto que o GWT injeta e que vaza para o JSON de saída, com
um contador global de processo. **Nenhuma coordenada muda.** Se você for versionar o `.drawio`, ou
comparar saídas, **remova `$H` antes de serializar** (ou, melhor, gere o XML a partir dos campos
que você usa, como no exemplo).

Existe também `org.eclipse.elk.randomSeed` (F4):

> Seed used for pseudo-random number generators to control the layout algorithm. **If the value is 0,
> the seed shall be determined pseudo-randomly (e.g. from the system time).**

Sete-o explicitamente (`'elk.randomSeed': '1'`) — não porque foi preciso nos testes, mas porque
`0` significa "semente do relógio" e você não quer descobrir isso em produção.

**Graphviz WASM (E8):** 3 execuções na mesma instância + 1 instância nova → hash idêntico. Determinístico.
**dagre (E7):** 4 execuções → fingerprint idêntico. Determinístico.

### 4.6 Performance

**E11:** 72 nós, 12 containers, 60 arestas, `INCLUDE_CHILDREN` + `ORTHOGONAL` → **182 ms**.
Instanciar `new ELK()` → ~0 ms. Não é gargalo para diagrama de arquitetura.

---

## 5. Exemplo mínimo — ELK layoutando 2 níveis de container e emitindo mxGraph

Este arquivo foi executado nesta máquina; a saída abaixo é literal.

```bash
npm install elkjs      # única dependência
```

```js
// layout.mjs  — node layout.mjs
import ELK from 'elkjs/lib/elk.bundled.js';

const TITLE_H = 26;                                   // faixa de titulo do container
const titleW  = (s) => Math.ceil(s.length * 7.2) + 24; // largura estimada (fonte ~12px)

// container = no com filhos. A faixa do titulo e reservada como padding.top.
const group = (id, title, children, pad = 16) => ({
  id, title,
  layoutOptions: {
    'elk.padding': `[top=${TITLE_H + pad},left=${pad},bottom=${pad},right=${pad}]`,
  },
  children,
});
const leaf = (id, label, width = 150, height = 60, extra = {}) =>
  ({ id, title: label, width, height, layoutOptions: extra });

const graph = {
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',  // 1 passada para TODA a hierarquia
    'elk.edgeRouting': 'ORTHOGONAL',              // waypoints ortogonais calculados
    'elk.layered.spacing.nodeNodeBetweenLayers': '50',
    'elk.spacing.nodeNode': '35',
    'elk.spacing.edgeNode': '25',
    'elk.randomSeed': '1',                        // 0 == semente do relogio
    'elk.json.shapeCoords': 'PARENT',             // == semantica do mxGeometry
    'elk.json.edgeCoords': 'ROOT',                // waypoints absolutos p/ a layer raiz
  },
  children: [
    leaf('internet', 'Internet', 150, 60, {
      'elk.layered.layering.layerConstraint': 'FIRST',   // sempre no topo
    }),
    group('aws', 'AWS Account 123456789012', [           // ---- NIVEL 1
      group('vpc', 'VPC 10.0.0.0/16', [                  // ---- NIVEL 2
        leaf('alb', 'Application Load Balancer'),
        leaf('ecs', 'ECS Fargate Service'),
      ]),
      leaf('rds', 'RDS PostgreSQL'),
    ]),
  ],
  edges: [
    { id: 'e1', sources: ['internet'], targets: ['alb'] },  // cruza 2 niveis
    { id: 'e2', sources: ['alb'],      targets: ['ecs'] },
    { id: 'e3', sources: ['ecs'],      targets: ['rds'] },  // cruza 1 nivel
  ],
};

const laid = await new ELK().layout(structuredClone(graph));

// pos-processamento: garantir que o titulo cabe (contorna o bug de nodeSize.minimum)
(function fitTitles(n) {
  for (const c of n.children ?? []) {
    if (c.children?.length) { fitTitles(c); c.width = Math.max(c.width, titleW(c.title)); }
  }
})(laid);

// ---- emissao mxGraph / drawio -------------------------------------------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const GROUP_STYLE = 'rounded=1;html=1;whiteSpace=wrap;verticalAlign=top;align=left;'
                  + 'spacingLeft=8;spacingTop=4;fillColor=none;dashed=1;';
const NODE_STYLE  = 'rounded=1;html=1;whiteSpace=wrap;';
const cells = [];

(function emit(node, parentId) {
  for (const c of node.children ?? []) {
    const isGroup = !!c.children?.length;
    // x/y JA vem relativos ao pai -> mxGeometry com relative="0" (default do drawio)
    cells.push(
      `<mxCell id="${c.id}" value="${esc(c.title)}" style="${isGroup ? GROUP_STYLE : NODE_STYLE}"`
      + ` vertex="1" parent="${parentId}">`
      + `<mxGeometry x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" as="geometry"/>`
      + `</mxCell>`);
    if (isGroup) emit(c, c.id);          // <- recursao: o pai vira o parent do mxCell
  }
})(laid, '1');

for (const e of laid.edges ?? []) {
  const pts = (e.sections[0].bendPoints ?? []).map(p => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('');
  cells.push(
    `<mxCell id="${e.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1"`
    + ` parent="1" source="${e.sources[0]}" target="${e.targets[0]}">`
    + `<mxGeometry relative="1" as="geometry"><Array as="points">${pts}</Array></mxGeometry></mxCell>`);
}
console.log(cells.join('\n'));
```

**Geometria produzida** (`x`/`y` relativos ao **pai**, prontos para `mxGeometry`):

```
internet  x=44  y=12   w=150 h=60
aws       x=12  y=127  w=214 h=346
  vpc       x=16  y=47   w=182 h=198     <- relativo a `aws`
    alb       x=16  y=42   w=150 h=60    <- relativo a `vpc`
    ecs       x=16  y=122  w=150 h=60
  rds       x=32  y=270  w=150 h=60
```

Conferindo os dois pontos críticos:
- **padding**: `vpc.y = 47` dentro de `aws`, cujo `padding.top` é `26+16 = 42` → ✅ (47 ≥ 42);
  `vpc.x = 16` = `padding.left` → ✅. Mesma coisa um nível abaixo: `alb.y = 42`, `alb.x = 16`. ✅
- **faixa de título**: 26 px reservados no topo de cada container, sem sobreposição.

**Waypoints** (`edgeCoords: ROOT`, absolutos — aritmética conferida):

```
e1: (119,72) -> (119,216)     internet.bottom-center = (44+75, 12+60) = (119,72) ✓
                              alb.top-center abs      = (12+16+16+75, 127+47+42) = (119,216) ✓
e2: (119,276) -> (119,296)
e3: (119,356) -> (119,397)
```

**mxCells resultantes** (recortado):

```xml
<mxCell id="aws" value="AWS Account 123456789012" style="…verticalAlign=top;align=left;…"
        vertex="1" parent="1"><mxGeometry x="12" y="127" width="214" height="346" as="geometry"/></mxCell>
<mxCell id="vpc" value="VPC 10.0.0.0/16" style="…verticalAlign=top;align=left;…"
        vertex="1" parent="aws"><mxGeometry x="16" y="47" width="182" height="198" as="geometry"/></mxCell>
<mxCell id="alb" value="Application Load Balancer" style="rounded=1;html=1;whiteSpace=wrap;"
        vertex="1" parent="vpc"><mxGeometry x="16" y="42" width="150" height="60" as="geometry"/></mxCell>
```

Note `parent="aws"` e `parent="vpc"`: o aninhamento do ELK vira aninhamento de célula no drawio
sem nenhuma conversão de coordenada.

---

## 6. Recomendação defendida

### Escolhida: `elkjs` (ELK `layered`)

Ela é a única que fecha as cinco perguntas operacionais sem gambiarra:

| Requisito | ELK |
|---|---|
| Auto-contida | `npm i elkjs`, **zero dependências**, JS puro, sem WASM, sem `.node`, sem compilador |
| Containers aninhados | N níveis numa única passada, com padding **por container** |
| → mxGeometry | **`shapeCoords: PARENT` já entrega coordenadas relativas ao pai** — zero aritmética |
| Roteamento | waypoints **ortogonais**, contornando containers, direto no `<Array as="points">` |
| Constraints | camada (`layerConstraint`) **e** ordem na camada (`position` + `semiInteractive`) |
| Determinismo | geometria bit-idêntica; só o `$H` do GWT precisa ser ignorado |

O argumento decisivo não é a auto-contenção (três candidatas passam nesse teste), é o **par
`shapeCoords: PARENT` + roteamento ortogonal ciente de hierarquia**. Ele elimina justamente as duas
classes de bug que matam gerador de diagrama: conversão de coordenada entre níveis, e aresta cortando
a borda do container.

### Runner-up: Graphviz via WASM (`@viz-js/viz`) ou `pygraphviz >= 2.0`

Qualidade de desenho de cluster aninhado do `dot` é excelente e o critério de auto-contenção
**é atendido** (o senso comum de que "Graphviz exige `apt install`" está desatualizado). Perdeu por
quatro coisas, em ordem de peso:

1. **Roteamento.** Com o engine `dot`, arestas não têm garantia de contornar clusters — a doc do
   Graphviz (F10) coloca `splines=compound` (evitar clusters) explicitamente sob **`fdp`**, e `fdp`
   não faz layout em camadas. E `splines=ortho` "does not handle ports or, in `dot`, edge labels".
   O ELK faz roteamento ortogonal ciente de hierarquia por padrão.
2. **Impedância de coordenadas.** Absolutas + **eixo Y invertido** + **unidades mistas** (`pos` em
   pontos, `width`/`height` em polegadas). Para `mxGeometry` isso significa reconstruir o offset de
   cada container e inverter Y — código de conversão que o ELK simplesmente não exige.
3. **Constraints mais fracas.** `rank=min` posiciona na primeira rank, mas não há equivalente limpo
   ao `elk.position` + `semiInteractive` para ordenar dentro da camada.
4. **Superfície de API.** Você escreve DOT (linguagem textual, com escaping próprio) e faz parse do
   JSON de volta; com o ELK a entrada e a saída são o mesmo objeto JS.

`pygraphviz` ainda carrega o buraco do **musllinux** (F9): numa imagem Alpine ele volta a exigir
Graphviz + compilador C, o que reabre o critério de corte. Se o script tiver que ser Python, é a
melhor opção mesmo assim — só documente a restrição de plataforma.

### Descartada com prejuízo: `@dagrejs/dagre`

Está viva (v3.1.1, 2026-08-08), é determinística, e — contra a lore — **suporta compound nodes**.
Mas não tem padding por container, não reserva espaço para rótulo de grupo, e o roteamento corta
bordas de cluster. São exatamente os três lugares onde diagrama de arquitetura quebra.

### Descartadas sem prejuízo

- **`grandalf`**: Sugiyama em Python puro, mas **zero** noção de container (0 ocorrências de
  `cluster`/`compound`/`nested`/`parent`/`subgraph` no fonte de `grandalf.layouts`), zero roteamento,
  e parada desde jan/2023.
- **`igraph`**: `layout_sugiyama` aceita camadas explícitas, não containers. Não devolve rota de aresta.
- **`networkx`**: não é engine de layout hierárquico com containers. `nx_agraph`/`nx_pydot` delegam ao
  Graphviz e devolvem **só um dict de posições de nó** — perde bbox de cluster e spline, que é
  precisamente o que o caso de uso precisa.
- **`pydot`** e **`graphviz` (PyPI)**: exigem o binário no `PATH`. **Desqualificadas pelo critério de corte.**
- **`dagre` sem escopo (npm)**: 0.8.5, sem publicação desde 2019.

---

## 7. Armadilhas confirmadas — checklist para quem for implementar

1. **Setar `hierarchyHandling: INCLUDE_CHILDREN` na raiz.** O default efetivo é
   `SEPARATE_CHILDREN` (F4) — sem isso, cada container é layoutado isoladamente.
2. **Não usar `nodeLabels.placement: [H_LEFT, …]` em container.** Empurra os filhos para a direita
   do rótulo (E5, linha B). Reserve a faixa como `padding.top` e desenhe o rótulo no mxGraph.
3. **Sem `nodeLabels.placement`, o ELK não reserva espaço nenhum para o rótulo** — sobreposição
   silenciosa (E5, linha A).
4. **Não usar `nodeSize.minimum` em nó compound com `direction: DOWN`/`UP`** — eixos trocados (E5).
   Alargue o container em pós-processamento.
5. **Setar `edgeCoords` explicitamente.** O default na raiz é `CONTAINER`, não `ROOT` (F2) — as
   coordenadas de aresta ficam relativas a um nó que você não escolheu.
6. **Setar `randomSeed` explicitamente.** `0` = semente do relógio (F4).
7. **Descartar `$H` antes de serializar/diffar** a saída do ELK (E4).
8. **Se for de Graphviz:** inverter Y e multiplicar `width`/`height` por 72.

---

## 8. Incertezas

Coisas que este documento **não** provou, listadas para não serem lidas como provadas:

1. **Plataforma.** Todos os experimentos rodaram em **Linux x86_64 (WSL2), Node 24, Python 3.12**.
   Não testei macOS (arm64/x86_64), Windows, nem Alpine/musl. Para `elkjs` e os builds WASM o risco é
   baixo (JS puro / WASM). Para `pygraphviz` o risco é **concreto e conhecido**: a matriz de wheels (F9)
   não inclui `musllinux`, então Alpine cai no build de fonte.
2. **Diagnóstico do bug de `nodeSize.minimum`.** O *sintoma* está reproduzido de forma limpa (E5).
   A *causa* que proponho — o `layered` trabalhar internamente no eixo `RIGHT` e não destrocar o
   mínimo — é inferência minha a partir do padrão `DOWN/UP` errado × `RIGHT/LEFT` certo. Não abri o
   fonte Java do ELK nem procurei issue upstream para confirmar. **Trate como comportamento a evitar,
   não como diagnóstico confirmado.**
3. **Origem do campo `$H`.** Que é o hashcode de objeto injetado pelo GWT é inferência pela forma
   (`$`-prefixado, inteiro, monotônico por processo, ausente do schema JSON documentado em F3).
   Não li o runtime do GWT para confirmar. O que **está** verificado é que é o **único** campo que
   varia e que nenhuma coordenada muda.
4. **Determinismo sob reordenação de entrada.** Provei que o **mesmo** input dá o mesmo output.
   **Não** testei se reordenar `children`/`edges` no JSON de entrada muda o desenho — e há forte
   indício de que muda, já que existe `considerModelOrder.strategy` (F4), que existe justamente para
   preservar a ordem do modelo. Se o gerador de diagrama itera sobre um `dict`/`Map` sem ordem
   estável, o layout pode variar entre execuções **mesmo com o ELK sendo determinístico**.
   Vale um teste antes de confiar em diff de `.drawio` versionado.
5. **"Qualidade de layout" não foi medida.** O veredito compara **suporte a feature**, não métrica.
   Não contei cruzamentos de aresta, área total, nem razão de aspecto do ELK contra o `dot` no mesmo
   grafo. A afirmação de que o Graphviz tem "qualidade reconhecida em grafos aninhados" é premissa da
   pergunta, não resultado desta pesquisa. Se a decisão for sensível a isso, é preciso um benchmark
   com contagem de cruzamentos sobre um corpus de arquiteturas reais.
6. **Escala.** Testado até 72 nós / 12 containers / 60 arestas (182 ms). Não sei como o
   `INCLUDE_CHILDREN` + `ORTHOGONAL` se comporta em centenas de nós com hierarquia profunda —
   o roteamento ortogonal cross-hierarchy é a parte cara.
7. **Contorno de alargamento de container.** O pós-processamento que alarga um container para caber
   o título **pode fazê-lo encostar num irmão**, porque acontece depois do layout. No exemplo não
   disparou (214 > 197 estimado). Uma implementação séria deveria alargar **antes**, injetando a
   largura mínima como `width` de um nó folha invisível, ou re-rodar o layout — nenhuma das duas foi
   testada aqui.
8. **`msagljs` não foi avaliada a fundo.** É TypeScript puro e suporta clusters. Descartei por
   cadência de release esparsa (1.1.23 em set/2024 → 1.1.24 em abr/2026) e por não oferecer nada que
   o ELK não ofereça, mas **não** rodei os experimentos nela. Se o ELK cair, é o próximo a olhar.
9. **`elkjs` fora do Node puro.** Testei `require`/`import` de `elk.bundled.js` em Node 24. O próprio
   README (F5) lista como recorrente uma família de issues de transpilação GWT / módulos JS em
   webpack, React e web workers (`#127`, `#141`, `#142`, `g is not defined`,
   `Can't resolve web-worker`). Para um script embarcado numa skill isso é irrelevante; para um
   bundler, não é.
