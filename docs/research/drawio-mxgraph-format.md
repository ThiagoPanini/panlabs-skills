# Formato `.drawio` / `mxfile` e containers aninhados no mxGraph

> Pesquisa contra fontes primárias para escrever um **gerador determinístico** de `.drawio`.

## Fontes auditadas

| Sigla | Fonte | Referência exata |
|---|---|---|
| `[drawio]` | `jgraph/drawio`, clone local | commit `d3140c3105c7fe8fb47259f6283e7ef566c647c6`, tag de release **31.3.1** (2026-08-20). Caminhos relativos a `src/main/webapp/` |
| `[mx]` | Fork do mxGraph **embarcado** no drawio (o `jgraph/mxgraph` público está arquivado e defasado) | `src/main/webapp/mxgraph/src/...` dentro do mesmo commit |
| `[xsd]` | Schema oficial da jgraph para geração programática | <https://github.com/jgraph/drawio-mcp/blob/main/shared/mxfile.xsd> |
| `[styleref]` | "Style reference for AI diagram generation" (doc oficial, companheiro do XSD) | <https://www.drawio.com/docs/reference/diagram-generation/style-reference/> |
| `[doc:...]` | Manual oficial drawio.com | URL citada em cada afirmação |
| `[tpl]` | Diagramas reais produzidos pelo próprio app, versionados no repo | `src/main/webapp/templates/**.xml` |

**Aviso sobre URLs:** o site de docs foi reestruturado. Praticamente todo `drawio.com/doc/faq/<slug>` retorna **404**; o caminho canônico hoje é `drawio.com/docs/...`. Todas as URLs abaixo foram verificadas com HTTP 200.

---

## 1. Estrutura `mxfile > diagram > mxGraphModel > root > mxCell`

### 1.1 Visão geral e o mínimo absoluto

O próprio drawio define seu diagrama vazio canônico:

```js
// [drawio] js/diagramly/EditorUi.js:695
EditorUi.prototype.emptyDiagramXml =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
```

Isto prova que **`<mxGraphModel>` não exige nenhum atributo**. Todos os `dx/dy/grid/page...` são estado de visualização opcional.

Arquivo mínimo completo e válido `[styleref]` §1:

```xml
<mxfile>
  <diagram id="page-1" name="Page-1">
    <mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1"
        tooltips="1" connect="1" arrows="1" fold="1"
        page="1" pageScale="1" pageWidth="850" pageHeight="1100"
        math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### 1.2 Atributos por nível

#### `<mxfile>` — **todos opcionais**

Prova forte de que são opcionais: `EditorUi.prototype.createFileData` **remove** esses atributos no modo `compact`, e o parser nunca os exige.

```js
// [drawio] js/diagramly/EditorUi.js:1953-1962
fileNode.removeAttribute('userAgent');
fileNode.removeAttribute('modified');
fileNode.removeAttribute('version');
fileNode.removeAttribute('editor');
fileNode.removeAttribute('pages');
fileNode.removeAttribute('type');
fileNode.removeAttribute('etag');
```

| Atributo | Tipo | Papel | Fonte |
|---|---|---|---|
| `host` | string | App que gravou (`app.diagrams.net`, `Electron`, hostname) | `[xsd]` L46; `[drawio] EditorUi.js:1963-1971` |
| `modified` | string | Timestamp ISO 8601 | `[xsd]` L52 |
| `agent` | string | User-agent do criador | `[xsd]` L58 |
| `version` | string | Versão do drawio | `[xsd]` L64 |
| `etag` | string | Tag de sync/cache | `[xsd]` L70 |
| `type` | string | Backend: `device`, `google`, `github`… | `[xsd]` L76 |
| `compressed` | `"true"`/`"false"`, default `false` | **Fixa a política de compressão** — ver §2 | `[xsd]` L82 |
| `pages` | string | Contagem de páginas, **meramente informativo** | `[xsd]` L88 |
| `scale`, `border` | number | Só escritos para export | `[drawio] EditorUi.js:1995,2001` |

> Para um gerador: emita **apenas** `host` (sua identificação) e `compressed="false"`. Nada mais é necessário e nada mais sobrevive a um round-trip de forma confiável.

#### `<diagram>` — uma página

| Atributo | Obrigatório? | Papel |
|---|---|---|
| `id` | Não pelo schema, **sim na prática** | Identidade estável da página; é o alvo dos links `data:page/id,<id>` (§6). Se ausente, o app gera um GUID no load: `[drawio] js/diagramly/Pages.js:24-27` |
| `name` | Opcional | Rótulo da aba. "Defaults to `Page-N` if omitted" `[xsd]` L117 |

`Editor.guid()` gera o id: 20 caracteres do alfabeto `0-9a-zA-Z-_`.
```js
// [drawio] js/diagramly/Editor.js:4102,4107
Editor.GUID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
Editor.GUID_LENGTH = 20;
```
Um gerador determinístico deve usar **slugs próprios estáveis** (`pg-arquitetura`), não GUIDs aleatórios — o schema aceita qualquer string.

#### `<mxGraphModel>` — estado de viewport, tudo opcional

Escritos por `Editor.prototype.getGraphXml` `[drawio] js/grapheditor/Editor.js:1578-1600` e `Graph.prototype.saveViewState` `[drawio] js/diagramly/Pages.js:840-895`:

`dx`, `dy` (scroll), `grid` (1), `gridSize` (10), `guides` (1), `tooltips` (1), `connect` (1), `arrows` (1), `fold` (1), `page` (1), `pageScale` (1), `pageWidth` (850), `pageHeight` (1100), `math` (0), `shadow` (0), `background`, `backgroundImage`, `adaptiveColors`. Defaults conforme `[xsd]` L140-235.

#### `<root>` e as duas células raiz

```
<xs:documentation>            <!-- [xsd] rootType, L245-258 -->
  Must contain at least two structural mxCell elements:
  1. Root container: id="0", no parent attribute
  2. Default layer:  id="1", parent="0"
  All visible diagram elements (shapes, edges) must have parent="1"
  (or the id of another layer/group).
  Additional layers can be added as mxCell elements with parent="0".
</xs:documentation>
```

**O papel de cada uma** (semântica do motor, `[mx] model/mxGraphModel.js:14-25`):

> *"The cell hierarchy in the model must have a top-level root cell which contains the layers (typically one default layer), which in turn contain the top-level cells of the layers. This means each cell is contained in a layer."*

- **`id="0"`** — a *raiz do modelo*. Não é desenhada. Só existe para conter camadas. `mxGraphModel.createRoot()` literalmente cria uma célula e insere uma filha dentro dela `[mx] model/mxGraphModel.js:338-344`.
- **`id="1"`** — a *camada padrão* (layer). `isLayer(cell)` ≡ `isRoot(getParent(cell))` `[mx] model/mxGraphModel.js:551-554`. Toda célula visível é descendente de alguma camada.
- Camadas adicionais = mais `<mxCell parent="0">`. O `value` da camada vira seu nome no painel de camadas `[xsd]` L290.

> **Nuance importante:** os literais `"0"` e `"1"` são **convenção, não requisito do parser**. O decoder só reconstrói a árvore por referência `parent`. Um template real produzido pelo próprio app usa GUID na raiz:
> ```xml
> <!-- [tpl] templates/basic/placeholder.xml -->
> <mxCell id="X5NqExCQtvZxIxQ7pmgY-0" />
> <mxCell id="1" parent="X5NqExCQtvZxIxQ7pmgY-0" />
> ```
> Mesmo assim, **use `0` e `1`**: é o que `[styleref]` chama de "Critical Rules" e o que todo consumidor terceiro espera.

#### `<mxCell>` — atributos

`mxObjectCodec.encodeObject` escreve `id` e depois cada campo não-nulo do objeto `[mx] io/mxObjectCodec.js:437-456`; booleanos viram `"1"`/`"0"` via `convertAttributeToXml` `[mx] io/mxObjectCodec.js:588-599`; `parent`/`source`/`target` são **id-refs** e `geometry` é filho complexo — declarados no codec:

```js
// [mx] io/mxCellCodec.js:45-47
var codec = new mxObjectCodec(new mxCell(),
    ['children', 'edges', 'overlays', 'mxTransient'],   // transient (não serializados)
    ['parent', 'source', 'target']);                    // id-refs
```

| Atributo | Quando é obrigatório | Observação |
|---|---|---|
| `id` | Sempre, **exceto** quando envolto em `<object>` (o wrapper carrega o id) — §7 | Único no `<diagram>` |
| `parent` | Toda célula menos a raiz `id="0"` | id da camada, grupo ou container |
| `vertex="1"` | Toda forma | Mutuamente exclusivo com `edge` `[styleref]` |
| `edge="1"` | Toda aresta | idem |
| `style` | Opcional | `k=v;` separados por `;`, sensível a maiúsculas, sem espaços |
| `value` | Opcional | Rótulo. HTML se `html=1` no style |
| `source` / `target` | Só arestas | id-refs |
| `visible`, `connectable`, `collapsed` | Opcionais | Defaults no protótipo: `visible=true`, `connectable=true`, `collapsed=false` `[mx] model/mxCell.js:127-141` — **omita-os** |

`<mxGeometry ... as="geometry"/>` é o único filho de `<mxCell>` (além do que a geometria carrega). O `as="geometry"` vem de `writeComplexAttribute`, que marca todo campo complexo com o nome do campo:

```js
// [mx] io/mxObjectCodec.js:556-568
mxObjectCodec.prototype.writeComplexAttribute = function(enc, obj, name, value, node) {
    var child = enc.encode(value);
    if (child != null) {
        if (name != null) { child.setAttribute('as', name); }
        node.appendChild(child);
    }
    ...
```

Isso explica **todos** os `as=` do formato de uma vez: `as="geometry"`, `as="points"`, `as="offset"`, `as="sourcePoint"`, `as="alternateBounds"` — é sempre o nome do campo do objeto JS.

---

## 2. Compressão

### 2.1 Resposta direta: **use XML puro. É o default do drawio moderno.**

```js
// [drawio] js/diagramly/Editor.js:276-281
/** Specifies if XML files should be compressed. Default is true. */
Editor.compressXml = true;
/** Specifies if XML files should be compressed by default. Default is false. */
Editor.defaultCompressed = false;
```

`Editor.defaultCompressed = false` propaga por todo o caminho de gravação: `getFileData`, `getXmlFileData` e `createFileData` todos fazem `uncompressed = ... : !Editor.defaultCompressed` `[drawio] js/diagramly/EditorUi.js:2515, 2040, 1889`.

Confirmações independentes:
- `[doc:save-file-formats]` <https://www.drawio.com/docs/manual/editor/save-file-formats/> — *"`.drawio` (XML file): this is an **uncompressed** file using the XML format, but with our file extension name."*
- `[doc:configure]` <https://www.drawio.com/docs/reference/configure-diagram-editor/> — *"`compressXml`: Specifies whether the XML output should be compressed. The default is `false`."*
- `[xsd]` L82-84 — *"If `"true"`, diagram content is deflate-compressed and Base64-encoded. **For AI generation, always use `"false"` (uncompressed XML).**"*

### 2.2 O app aceita ambos — a lógica exata do leitor

```js
// [drawio] js/diagramly/Editor.js:2358-2394 (Editor.parseDiagramNode)
Editor.parseDiagramNode = function(diagramNode, checked, allowRecurse) {
    Editor.validateDiagramNode(diagramNode);
    var text = mxUtils.trim(mxUtils.getTextContent(diagramNode));
    var node = null;
    if (text.length > 0) {                     // (A) tem texto -> é base64 comprimido
        var tmp = Graph.decompress(text, null, checked);
        if (tmp != null && tmp.length > 0) { node = mxUtils.parseXml(tmp).documentElement; }
    } else {                                   // (B) sem texto -> pega o 1º filho elemento
        var temp = mxUtils.getChildNodes(diagramNode);
        ...
    }
    return node;
};
```

O discriminador é **o conteúdo de texto do `<diagram>`**: se houver texto (após `trim`), é payload comprimido; senão, o primeiro elemento-filho é o `<mxGraphModel>`. O `trim` é o que permite XML indentado/pretty-printed funcionar.

### 2.3 Por que XML puro num arquivo gerado por máquina

1. **É o default do próprio app** e a recomendação explícita do schema oficial da jgraph para geração programática `[xsd]` L84.
2. **Diffável em Git.** O caminho não-comprimido grava com `mxUtils.getPrettyXml` (indentado), o comprimido com `mxUtils.getXml` (uma linha): `var xml = (uncompressed) ? mxUtils.getPrettyXml(fileNode) : mxUtils.getXml(fileNode);` `[drawio] js/diagramly/EditorUi.js:2004`.
3. **Fixa a política no arquivo.** Emita `compressed="false"` no `<mxfile>`; o app respeita e continua gravando descomprimido ao re-salvar:
   ```js
   // [drawio] js/diagramly/DrawioFile.js:1281-1293
   DrawioFile.prototype.isCompressed = function() {
       var compressed = (this.ui.fileNode != null) ? this.ui.fileNode.getAttribute('compressed') : null;
       if (compressed != null) { return compressed != 'false'; }
       else { return this.isCompressedStorage() && Editor.compressXml; }
   };
   ```
   Note que `createFileData` remove `modified`/`version`/`etag`/`type` mas **não** remove `compressed` — o atributo sobrevive.
4. Sem ele, um mesmo arquivo pode voltar comprimido dependendo do backend de storage (`isCompressedStorage()`).

### 2.4 Se precisar comprimir: a cadeia exata

```js
// [drawio] js/grapheditor/Graph.js:2447-2478
Graph.compress = function(data, deflate) {
    if (data == null || data.length == 0 || typeof(pako) === 'undefined') { return data; }
    else {
        var tmp = (deflate) ? pako.deflate(encodeURIComponent(data))
                            : pako.deflateRaw(encodeURIComponent(data));
        return btoa(Graph.arrayBufferToString(new Uint8Array(tmp)));
    }
};

Graph.decompress = function(data, inflate, checked) {
    ...
    var tmp = Graph.stringToArrayBuffer(atob(data));
    var inflated = decodeURIComponent((inflate) ? pako.inflate(tmp, {to: 'string'})
                                                : pako.inflateRaw(tmp, {to: 'string'}));
    return (checked) ? inflated : Graph.zapGremlins(inflated);
};
```

**A ordem, sem ambiguidade** (`deflate` é chamado sem o 2º argumento em todo o caminho de arquivo, logo o ramo é `deflateRaw`):

```
XML  →  encodeURIComponent  →  raw DEFLATE (sem header zlib, sem gzip)  →  base64
```

- **URL-encode vem ANTES do deflate.** É o erro clássico.
- **Raw deflate** = `-MAX_WBITS` (janela negativa), **não** `zlib.compress` (que adiciona header `78 9c`) e **não** gzip.
- Na descompressão: `base64 decode → raw inflate → decodeURIComponent`.
- `Graph.compressNode(node)` é o wrapper que serializa e comprime um nó: `Graph.compress(Graph.zapGremlins(mxUtils.getXml(node)))` `[drawio] js/grapheditor/Graph.js:2380-2383`.

Implementação de referência em Python (validada com round-trip nesta pesquisa):

```python
import base64, zlib, urllib.parse

def drawio_compress(xml: str) -> str:
    # encodeURIComponent: não escapa A-Za-z0-9 e - _ . ! ~ * ' ( )
    quoted = urllib.parse.quote(xml, safe="!~*'()")
    co = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)  # janela negativa = raw deflate
    return base64.b64encode(co.compress(quoted.encode()) + co.flush()).decode()

def drawio_decompress(b64: str) -> str:
    raw = zlib.decompress(base64.b64decode(b64), -zlib.MAX_WBITS).decode()
    return urllib.parse.unquote(raw)
```

O `safe="!~*'()"` do `quote` reproduz exatamente o conjunto não-escapado de `encodeURIComponent` (verificado caractere a caractere).

Forma comprimida no arquivo — o base64 vai como **conteúdo de texto** do `<diagram>`:

```xml
<mxfile host="gerador" compressed="true">
  <diagram id="pg-1" name="Página 1">xVfbjpswEP0aXisuCd0+5rLdVmqlSHno9tHBs2DVYGScAP36GrCDHciWsJEi...</diagram>
</mxfile>
```

> **Atenção — `compressStyles` é outra coisa.** <https://www.drawio.com/docs/reference/style-compression/> descreve um recurso **experimental e desligado por default** que deduplica imagens num bloco `<defs>` com referências `style="image=def(0);"`. Arquivos assim só abrem em drawio ≥ 29.3.1; versões antigas perdem a arte permanentemente ao salvar. Não use num gerador.

---

## 3. Geometria: absoluta vs relativa ao pai

### 3.1 A matemática canônica

Tudo está em `mxGraphView.updateCellState` — esta é a fonte de verdade:

```js
// [mx] view/mxGraphView.js:1014-1077
mxGraphView.prototype.updateCellState = function(state) {
    state.origin.x = 0; state.origin.y = 0;
    if (state.cell != this.currentRoot) {
        var pState = this.getState(model.getParent(state.cell));
        if (pState != null && pState.cell != this.currentRoot) {
            state.origin.x += pState.origin.x;      // <-- acumula do pai
            state.origin.y += pState.origin.y;
        }
        var offset = this.graph.getChildOffsetForCell(state.cell);
        if (offset != null) { state.origin.x += offset.x; ... }

        var geo = this.graph.getCellGeometry(state.cell);
        if (geo != null) {
            if (!model.isEdge(state.cell)) {
                offset = (geo.offset != null) ? geo.offset : this.EMPTY_POINT;
                if (geo.relative && pState != null) {
                    if (model.isEdge(pState.cell)) { /* rótulo sobre aresta */ }
                    else {
                        state.origin.x += geo.x * pState.unscaledWidth  + offset.x;   // (R)
                        state.origin.y += geo.y * pState.unscaledHeight + offset.y;
                    }
                } else {
                    state.origin.x += geo.x;                                          // (A)
                    state.origin.y += geo.y;
                }
            }
            state.x = this.scale * (this.translate.x + state.origin.x);
            ...
```

**Regras derivadas:**

| Caso | Fórmula | Uso |
|---|---|---|
| **(A)** vértice, `relative` ausente/`0` (default) | `origem_abs = origem_abs(pai) + (geo.x, geo.y)` | O caso normal. `x,y` são **pixels relativos ao canto superior-esquerdo do pai**, acumulados recursivamente. Um filho da camada `1` tem coordenadas de canvas, porque a camada tem origem `(0,0)` |
| **(R)** vértice, `relative="1"` | `origem_abs = origem_abs(pai) + (geo.x·larg(pai), geo.y·alt(pai)) + offset` | `x,y` ∈ `[0,1]` são **frações** do pai. `<mxPoint as="offset"/>` soma pixels absolutos por cima. É o mecanismo de *ports* e de ícones fixados numa borda |
| **aresta**, `relative="1"` | — | Em arestas `relative="1"` é obrigatório e significa outra coisa: posição do **rótulo** ao longo da aresta (`x` ∈ `[-1,1]`, `0` = centro; `y` = deslocamento perpendicular em px) `[mx] model/mxGeometry.js:36-48`, `[xsd]` L506 |

`mxGeometry.relative` default é `false` `[mx] model/mxGeometry.js:139-152`. Consistência: `mxGeometry.translate()` **não mexe** em `x,y` quando `relative` é true `[mx] model/mxGeometry.js:298-308`.

### 3.2 A pegadinha do título do container

```js
// [mx] view/mxGraph.js:7320-7323
mxGraph.prototype.getChildOffsetForCell = function(cell) { return null; };
```

O drawio **não sobrescreve** este método (verificado por grep em `Graph.js` e em todo `js/diagramly/`). Consequência prática, decisiva para um gerador:

> **A origem `(0,0)` de um filho é o canto superior-esquerdo absoluto do container, incluindo a faixa do título.** O `startSize` de um swimlane **não** é descontado automaticamente. Um filho em `y=0` fica *por baixo* do cabeçalho.

O gerador precisa somar o `startSize` do pai ao `y` de cada filho (ou ao `x`, se `horizontal=0`).

Confirmação na doc: `[styleref]` §11 — *"Child coordinates are relative to the parent container"*.

### 3.3 Exemplo verificado — três níveis de aninhamento

Cadeia real extraída de `[tpl] templates/cloud/gcp/gcp_gaming_backend_database.xml`:

```
id=1     (layer)   parent=0
id=14              parent=1     geo x=580 y=100 w=410 h=410
id=…-541           parent=14    geo x=21  y=205 w=170 h=60   -> abs (601, 305)
id=…-542           parent=…-541 geo relative=1 w=30 h=30     -> ancorado na fração (0,0) do pai
```

Resolução aritmética conferida com um resolvedor que replica `updateCellState`:

| célula | `geo.x, geo.y` | origem absoluta |
|---|---|---|
| `plataforma` (filho da camada) | 40, 40 | **(40, 40)** |
| `dominio` (filho de `plataforma`) | 20, 50 | **(60, 90)** |
| `servico` (filho de `dominio`) | 20, 40 | **(80, 130)** |
| `api` (filho de `servico`) | 30, 60 | **(110, 190)** |

---

## 4. Containers

### 4.1 O que faz um shape virar container

```js
// [drawio] js/grapheditor/Graph.js:12436-12448
Graph.prototype.isContainer = function(cell) {
    var style = this.getCurrentCellStyle(cell);
    if (this.isSwimlane(cell)) { return style['container'] != '0'; }
    else                       { return style['container'] == '1'; }
};
```

Ou seja, **dois caminhos**:

1. **Swimlane** — `isSwimlane` é true quando `shape` ∈ {`swimlane`, `table`, `tableRow`} `[drawio] js/grapheditor/Graph.js:17546-17560`. Swimlanes são containers **por default**; só deixam de ser com `container=0`.
2. **Qualquer outro shape** — precisa de `container=1` explícito.

`[styleref]` §11 diz o mesmo em prosa: *"Use `style="group;"` for invisible containers"*, *"Use `style="swimlane;startSize=30;"` for containers with a visible header"*, *"Add `container=1;` to any style to make it act as a container"*.

### 4.2 `collapsible`

```js
// [drawio] js/grapheditor/Graph.js:13261-13277
Graph.prototype.isCellFoldable = function(cell) {
    var style = this.getCurrentCellStyle(cell);
    return this.foldingEnabled && !this.isTransparentBounds(cell) &&
        mxUtils.getValue(style, mxConstants.STYLE_RESIZABLE, '1') != '0' &&
        (style['treeFolding'] == '1' ||
        (!this.isCellLocked(cell) &&
        ((this.isContainer(cell) && style['collapsible'] != '0') ||
         (!this.isContainer(cell) && style['collapsible'] == '1'))));
};
```

- Container → dobrável **a menos que** `collapsible=0`.
- Não-container → dobrável **apenas se** `collapsible=1`.

`collapsible=0` é o que se quer num gerador: remove o botão `−`/`+` e evita que o app grave `<mxRectangle as="alternateBounds"/>` dentro da geometria ao colapsar (o que suja diffs).

### 4.3 Como o pai redimensiona em função dos filhos

**Mecanismo 1 — `extendParent` (crescimento automático).**

```js
// [mx] view/mxGraph.js:6036-6060
mxGraph.prototype.extendParent = function(cell) {
    var parent = this.model.getParent(cell);
    var p = this.getCellGeometry(parent);
    if (parent != null && p != null && !this.isCellCollapsed(parent)) {
        var geo = this.getCellGeometry(cell);
        if (geo != null && !geo.relative &&
            (p.width < geo.x + geo.width || p.height < geo.y + geo.height)) {
            p = p.clone();
            p.width  = Math.max(p.width,  geo.x + geo.width);
            p.height = Math.max(p.height, geo.y + geo.height);
            this.cellsResized([parent], [p], false);
        }
    }
};
```

Propriedades que importam para um gerador:
- **Só cresce, nunca encolhe** (`Math.max`).
- **Ignora geometria `relative`.**
- **Não considera `x,y` negativos** — um filho em `x=-10` fica pendurado fora do pai sem que o pai cresça para a esquerda.
- Defaults do motor, não sobrescritos pelo drawio: `extendParents=true`, `extendParentsOnAdd=true`, **`extendParentsOnMove=false`**, `constrainChildren=true` `[mx] view/mxGraph.js:1373-1406`.

**Mecanismo 2 — style `expand`.**

```js
// [drawio] js/grapheditor/Graph.js:17606-17621
Graph.prototype.isExtendParent = function(cell) {
    var parent = this.model.getParent(cell);
    if (parent != null) {
        var style = this.getCurrentCellStyle(parent);
        if (style['expand'] != null) { return style['expand'] != '0'; }
    }
    return graphIsExtendParent.apply(this, arguments) && (parent == null || !this.isTable(parent));
};
```

`expand=0` no **pai** desliga o crescimento automático. `[doc:group-shapes]` <https://www.drawio.com/docs/manual/editor/group-shapes-connectors/> documenta o par: *"`expand` / `contract` — `0 / 1` — Whether the group auto-extends or auto-shrinks when children change."*

**Mecanismo 3 — `childLayout` (layout automático, o pai é dirigido pelo layout).**

```js
// [drawio] js/grapheditor/Graph.js:9108-9200 (Graph.prototype.initLayoutManager)
this.layoutManager.hasLayout = function(cell) {
    return this.graph.getCellStyle(cell)['childLayout'] != null;
};
...
if (style['childLayout'] == 'stackLayout') {
    var stackLayout = new mxStackLayout(this.graph, true);
    stackLayout.resizeParentMax = ... mxUtils.getValue(style, 'resizeParentMax', '1') == '1';
    stackLayout.horizontal      = mxUtils.getValue(style, 'horizontalStack', '1') == '1';
    stackLayout.resizeParent    = ... mxUtils.getValue(style, 'resizeParent', '1') == '1';
    stackLayout.resizeLast      = ... mxUtils.getValue(style, 'resizeLast', '0') == '1';
    stackLayout.spacing         = style['stackSpacing'] || stackLayout.spacing;
    stackLayout.border          = style['stackBorder']  || stackLayout.border;
    stackLayout.marginLeft/Right/Top/Bottom = style['margin*'] || 0;
    ...
}
else if (style['childLayout'] == 'treeLayout')   { /* mxCompactTreeLayout   */ }
else if (style['childLayout'] == 'flowLayout')   { /* mxHierarchicalLayout  */ }
else if (style['childLayout'] == 'circleLayout') { /* mxCircleLayout        */ }
else if (style['childLayout'] == 'organicLayout'){ /* mxFastOrganicLayout   */ }
else if (style['childLayout'] == 'tableLayout')  { /* mxTableLayout         */ }
```

> **Recomendação para um gerador determinístico: NÃO use `childLayout`.** Ele entrega o posicionamento dos filhos ao motor de layout do app, que roda no load e reescreve as geometrias — o arquivo que você gerou não é o arquivo que o usuário vê nem o que ele re-salva. Calcule as coordenadas você mesmo e deixe `childLayout` ausente.

**Mecanismo 4 — `transparentBounds=1`.** Faz o container derivar seus bounds da união dos filhos, com geometria fixada em `(0,0,0,0)`; nunca é redimensionável e se auto-deleta quando fica vazio `[doc:group-shapes]`. Um gerador que já calcula bounds não precisa disso.

### 4.4 Chaves de estilo relevantes

Tabela §4.7 de `[styleref]`:

| Chave | Valores | Default | Descrição |
|---|---|---|---|
| `container` | 0, 1 | 0 | Célula é container |
| `collapsible` | 0, 1 | 1 | Pode colapsar |
| `recursiveResize` | 0, 1 | 1 | Redimensiona filhos junto com o pai |
| `startSize` | number | 23 | Altura do cabeçalho do swimlane |
| `horizontal` | 0, 1 | 1 | `1` = cabeçalho no topo, `0` = à esquerda |
| `childLayout` | stackLayout, treeLayout, flowLayout | — | Layout automático |
| `resizeParent` / `resizeParentMax` / `resizeLast` | 0, 1 | — | Modificadores do stackLayout |

Adicionais de `[doc:group-shapes]`: `dropTarget` (0/1, default 1), `expand`/`contract`, `groupPadding` (1–4 valores estilo CSS), `transparentBounds`, `selectParentFirst`, `locked`, `lockedGroup`.

> **Divergência de default em `startSize`:** `[styleref]` diz `23`; o motor diz `mxConstants.DEFAULT_STARTSIZE: 40` `[mx] util/mxConstants.js:604-609`. As entradas da biblioteca de shapes do drawio sempre gravam `startSize` explicitamente (`26`, `30`, `8`, `14`…) — nenhuma usa 23 nem 40. **Sempre emita `startSize` explícito.**

### 4.5 Exemplo mínimo e real — container dentro de container dentro de container

Este XML foi validado nesta pesquisa (parse OK, origens absolutas resolvidas conforme §3.1). Note que cada filho soma o `startSize` do pai ao seu `y`.

```xml
<mxfile host="panlabs-generator" compressed="false">
  <diagram id="pg-arquitetura" name="Arquitetura">
    <mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1"
        connect="1" arrows="1" fold="1" page="1" pageScale="1"
        pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <!-- Nível 1: coordenadas de canvas (pai = camada, origem 0,0) -->
        <mxCell id="plataforma" value="Plataforma"
                style="swimlane;html=1;startSize=30;container=1;collapsible=0;"
                vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="600" height="420" as="geometry" />
        </mxCell>

        <!-- Nível 2: x,y relativos ao canto de 'plataforma'. y=50 > startSize=30 -->
        <mxCell id="dominio" value="Domínio Pedidos"
                style="swimlane;html=1;startSize=26;container=1;collapsible=0;"
                vertex="1" parent="plataforma">
          <mxGeometry x="20" y="50" width="560" height="340" as="geometry" />
        </mxCell>

        <!-- Nível 3: relativos ao canto de 'dominio'. y=40 > startSize=26 -->
        <mxCell id="servico" value="Serviço Checkout"
                style="swimlane;html=1;startSize=24;container=1;collapsible=0;"
                vertex="1" parent="dominio">
          <mxGeometry x="20" y="40" width="520" height="270" as="geometry" />
        </mxCell>

        <!-- Folhas: relativas ao canto de 'servico'. y=60 > startSize=24 -->
        <mxCell id="api" value="API" style="rounded=1;whiteSpace=wrap;html=1;"
                vertex="1" parent="servico">
          <mxGeometry x="30" y="60" width="160" height="60" as="geometry" />
        </mxCell>
        <mxCell id="db" value="Postgres"
                style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;"
                vertex="1" parent="servico">
          <mxGeometry x="330" y="60" width="120" height="80" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

Origens absolutas resultantes: `plataforma` (40,40) → `dominio` (60,90) → `servico` (80,130) → `api` (110,190), `db` (410,190).

---

## 5. Arestas

### 5.1 `source` / `target`

São **id-refs** declarados no `mxCellCodec` (§1.2). Apontam para o `id` de um vértice — ou para o `id` do `<object>` que envolve o vértice (§7). Aresta sem terminais precisa de pontos explícitos:

> *"Edges should reference source and target via cell IDs. Edges without connections need explicit mxPoint sourcePoint/targetPoint."* `[styleref]` §1

```xml
<mxCell id="e0" style="edgeStyle=orthogonalEdgeStyle;html=1;" edge="1" parent="1">
  <mxGeometry relative="1" as="geometry">
    <mxPoint x="100" y="100" as="sourcePoint" />
    <mxPoint x="300" y="200" as="targetPoint" />
  </mxGeometry>
</mxCell>
```

Toda aresta precisa de `<mxGeometry relative="1" as="geometry"/>` — `relative="1"` é obrigatório em arestas `[xsd]` L506.

### 5.2 Waypoints — `<Array as="points">`

```xml
<mxGeometry relative="1" as="geometry">
  <Array as="points">
    <mxPoint x="260" y="90" />
    <mxPoint x="260" y="180" />
  </Array>
</mxGeometry>
```

O nome `Array` vem do codec genérico auto-registrado para `new Array()` (`mxObjectCodec.getName()` → `mxUtils.getFunctionName(template.constructor)` = `"Array"`) `[mx] io/mxCodecRegistry.js:102-132`, `[mx] io/mxObjectCodec.js:271-274`; e `as="points"` do nome do campo `mxGeometry.points` via `writeComplexAttribute` (§1.2). `mxPoint` sem `as` = waypoint `[xsd]` L539-551.

> ⚠️ **Correção a uma fonte oficial.** O `[xsd]` (`ArrayType`, L565) afirma: *"Points are in **absolute** coordinates"*. **Isso está errado quando a aresta tem um container como pai.** O código-fonte:
>
> ```js
> // [mx] view/mxGraphView.js:1474-1483
> mxGraphView.prototype.transformControlPoint = function(state, pt, ignoreScale) {
>     var orig = state.origin;                    // origem acumulada do PAI da aresta
>     var scale = ignoreScale ? 1 : this.scale;
>     return new mxPoint(scale * (pt.x + this.translate.x + orig.x),
>                        scale * (pt.y + this.translate.y + orig.y));
> };
> ```
>
> Os waypoints são somados a `state.origin`, que é a origem acumulada da cadeia de pais da **aresta**. Logo: **waypoints vivem no sistema de coordenadas do pai da aresta**, exatamente como as geometrias de vértices (§3.1). São "absolutos" apenas no caso comum em que o pai é a camada `1` (origem `0,0`).
>
> Confirmado num arquivo real gerado pelo próprio app — `[tpl] templates/basic/placeholder.xml`, aresta com `parent="Gr0Zq-AI6Quabplr0KPa-98"` (um container de 409×311) e waypoints `(85,182)` e `(205,182)`, valores que só fazem sentido dentro do container.
>
> **Regra para o gerador:** parenteie a aresta no **ancestral comum mais próximo** de `source` e `target`, e emita os waypoints nesse mesmo sistema de coordenadas.

### 5.3 `edgeStyle=orthogonalEdgeStyle`

```js
// [mx] util/mxConstants.js:2548-2554
EDGESTYLE_ORTHOGONAL: 'orthogonalEdgeStyle',
// [mx] view/mxStyleRegistry.js:67
mxStyleRegistry.putValue(mxConstants.EDGESTYLE_ORTHOGONAL, mxEdgeStyle.OrthConnector);
```

Outros valores registrados `[mx] view/mxStyleRegistry.js:62-68`: `elbowEdgeStyle`, `entityRelationEdgeStyle`, `loopEdgeStyle`, `sideToSideEdgeStyle`, `topToBottomEdgeStyle`, `segmentEdgeStyle`. `edgeStyle=none` desliga o roteador (linha reta / só waypoints).

`orthogonalEdgeStyle` **roteia automaticamente**: ele recebe os waypoints como dicas mas decide o caminho (`edgeStyle(edge, src, trg, points, pts)` em `updatePoints` `[mx] view/mxGraphView.js:1421-1449`). Para caminho 100% determinístico, combine com âncoras fixas (§5.4) — ou use `edgeStyle=none` e dite todos os pontos.

### 5.4 Ancoragem determinística — `exitX/exitY/exitDx/exitDy` e `entry*`

**Leitura do estilo:**

```js
// [mx] view/mxGraph.js:7104-7136
mxGraph.prototype.getConnectionConstraint = function(edge, terminal, source) {
    var point = null;
    var x = edge.style[(source) ? mxConstants.STYLE_EXIT_X : mxConstants.STYLE_ENTRY_X];
    if (x != null) {
        var y = edge.style[(source) ? mxConstants.STYLE_EXIT_Y : mxConstants.STYLE_ENTRY_Y];
        if (y != null) { point = new mxPoint(parseFloat(x), parseFloat(y)); }
    }
    var perimeter = false, dx = 0, dy = 0;
    if (point != null) {
        perimeter = mxUtils.getValue(edge.style,
            (source) ? mxConstants.STYLE_EXIT_PERIMETER : mxConstants.STYLE_ENTRY_PERIMETER, true);
        dx = parseFloat(edge.style[(source) ? mxConstants.STYLE_EXIT_DX : mxConstants.STYLE_ENTRY_DX]);
        dy = parseFloat(edge.style[(source) ? mxConstants.STYLE_EXIT_DY : mxConstants.STYLE_ENTRY_DY]);
        dx = isFinite(dx) ? dx : 0;  dy = isFinite(dy) ? dy : 0;
    }
    return new mxConnectionConstraint(point, perimeter, null, dx, dy);
};
```

**Cálculo do ponto:**

```js
// [mx] view/mxGraph.js:7236-7237
point = new mxPoint(bounds.x + constraint.point.x * bounds.width  + constraint.dx * scale,
                    bounds.y + constraint.point.y * bounds.height + constraint.dy * scale);
```

**Semântica exata:**

| Chave | Domínio | Significado |
|---|---|---|
| `exitX` / `entryX` | `0.0`–`1.0` | Fração da **largura** do bounding box do terminal. `0`=esquerda, `0.5`=centro, `1`=direita |
| `exitY` / `entryY` | `0.0`–`1.0` | Fração da **altura**. `0`=topo, `0.5`=meio, `1`=base |
| `exitDx` / `exitDy` (e `entry*`) | number | Offset **absoluto em pixels**, multiplicado pela escala da view |
| `exitPerimeter` / `entryPerimeter` | `0`/`1`, default **`1`** | `1` = o ponto é projetado no perímetro do shape. `0` = o ponto calculado é usado **literalmente** |

Tabela idêntica em `[styleref]` §4.6. Comportamento na UI: `[doc:fixed-vs-floating]` <https://www.drawio.com/docs/manual/connectors/connector-fixed-vs-floating/> — *"Floating connectors move around the perimeter of a shape as you move it… Fixed connectors stay attached to fixed points on your shapes."*

**Como fixar de que lado a aresta sai e entra — a receita:**

1. `exitX`/`exitY` **precisam ambos estar presentes** — o código só monta o `point` se `x != null` **e** `y != null`. Emitir só `exitX` não faz nada.
2. Ausência de `exitX`/`exitY` ⇒ conexão flutuante (o motor escolhe o lado). Para determinismo, sempre emita os dois.
3. Use os quatro pontos cardeais: direita `exitX=1;exitY=0.5`, esquerda `exitX=0;exitY=0.5`, topo `exitX=0.5;exitY=0`, base `exitX=0.5;exitY=1`.
4. **Emita `exitPerimeter=0` / `entryPerimeter=0`** para eliminar a projeção no perímetro. Em shapes não retangulares (elipse, cilindro, losango) o default `1` desloca o ponto de forma dependente da geometria do shape — é a principal fonte de não-determinismo visual.
5. `exitDx`/`exitDy` = `0` explícitos (é o que o app grava).

**Exemplo mínimo — aresta totalmente ancorada, dentro de um container:**

```xml
<!-- 'api' e 'db' são filhos de 'servico'; a aresta é parenteada em 'servico',
     o ancestral comum mais próximo. Os waypoints estão no espaço de 'servico'. -->
<mxCell id="e1"
        style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;
               exitX=1;exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;
               entryX=0;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;"
        edge="1" parent="servico" source="api" target="db">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="260" y="90" />
      <mxPoint x="260" y="100" />
    </Array>
  </mxGeometry>
</mxCell>
```

(Sem quebras de linha no `style` num arquivo real — quebrei aqui só para leitura.)

Exemplo real produzido pelo app, com `exitPerimeter=0` `[tpl] templates/cloud/gcp/gcp_general_app_engine_and_cloud_endpoints.xml`:

```xml
<mxCell id="20" value=""
        style="edgeStyle=orthogonalEdgeStyle;fontSize=12;html=1;endArrow=oval;endFill=1;rounded=0;strokeWidth=2;endSize=6;startSize=4;dashed=0;strokeColor=#4284F3;exitX=0;exitY=0.149;exitPerimeter=0;"
        parent="1" edge="1">
```

> **Nota lateral:** os pontos de ancoragem *oferecidos* por um shape são outra coisa — vêm do style `points=[[x,y,p,dx,dy],...]` na definição do shape `[doc:connection-points]` <https://www.drawio.com/docs/manual/shapes/shape-connection-points-customise/>: *"values between 0 and 1… Top left is `[0,0]`, top right is `[1,0]`…"*. `exitX/entryX` não estão limitados a esses pontos — qualquer fração vale.

---

## 6. Múltiplas páginas

### 6.1 Estrutura

`<mxfile>` aceita `<diagram maxOccurs="unbounded">` `[xsd]` L43. Cada `<diagram>` é uma aba, na ordem do documento.

```xml
<mxfile host="panlabs-generator" compressed="false" pages="2">
  <diagram id="pg-contexto" name="Contexto">
    <mxGraphModel …><root>
      <mxCell id="0" /><mxCell id="1" parent="0" />
      <mxCell id="sistema" value="Sistema" style="rounded=1;whiteSpace=wrap;html=1;"
              vertex="1" parent="1">
        <mxGeometry x="80" y="80" width="200" height="80" as="geometry" />
      </mxCell>
    </root></mxGraphModel>
  </diagram>

  <diagram id="pg-containers" name="Containers">
    <mxGraphModel …><root>
      <mxCell id="0" /><mxCell id="1" parent="0" />
    </root></mxGraphModel>
  </diagram>
</mxfile>
```

**Cada `<diagram>` tem seu próprio `<root>` com suas próprias células `0` e `1`.** Os `id` de células só precisam ser únicos **dentro de uma página** `[xsd]` L18-19; mas usar ids globalmente únicos evita confusão no seu gerador.

### 6.2 Nome e id

- `name` = rótulo da aba. Ausente ⇒ o app atribui `Page-N` no load `[xsd]` L117; a implementação usa o recurso `pageWithNumber` `[drawio] js/diagramly/EditorUi.js:1820-1823`.
- `id` = identidade estável. Se ausente, `DiagramPage` gera um GUID no load:
  ```js
  // [drawio] js/diagramly/Pages.js:16-28
  function DiagramPage(node, id) {
      this.node = node;
      if (id != null) { this.node.setAttribute('id', id); }
      else if (this.getId() == null) { this.node.setAttribute('id', Editor.guid()); }
  }
  ```
- `pages` no `<mxfile>` é **informativo apenas** — a contagem real vem do número de elementos `<diagram>` `[xsd]` L88-91. O app só o escreve quando há mais de uma página `[drawio] js/diagramly/EditorUi.js:1974-1977`.

### 6.3 Como referenciar uma página

O formato é `data:page/id,<id-do-diagram>`:

```js
// [drawio] js/grapheditor/Graph.js:4342-4345
Graph.isPageLink = function(text) {
    return text != null && text.substring(0, 13) == 'data:page/id,';
};
// [drawio] js/diagramly/Dialogs.js:954  (montagem do seletor "Edit Link")
pageOption.setAttribute('value', 'data:page/id,' + …);
```

Confirmado na doc oficial `[doc:custom-actions]` <https://www.drawio.com/docs/manual/links-tooltips-tags/animations-custom-actions/>: *"**Open** — Opens a URL (`https://…` or `data:page/id,…` to jump to another page)."*

Uso: como `link` num `<object>` (§7) ou como `href` num `<a>` dentro de um rótulo HTML.

```xml
<object label="Ver detalhe" link="data:page/id,pg-containers" id="drill-1">
  <mxCell style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
    <mxGeometry x="80" y="200" width="160" height="40" as="geometry" />
  </mxCell>
</object>
```

**Por que id e não nome:** `[doc:pages]` <https://www.drawio.com/docs/manual/pages/> — *"When you rename a diagram page, if there are any links from shapes to that page, the linked page name will automatically be updated."* Os links referenciam o `id`; o nome exibido é só apresentação. Não existe forma oficial `data:page/<nome>`.

> **Cuidado operacional:** `Extras > Edit Diagram` opera sobre **uma página por vez** (mostra `<mxGraphModel>`, não `<mxfile>`) `[doc:edit-diagram]` <https://www.drawio.com/docs/manual/advanced/diagram-source-edit/>. Não é caminho para round-trip de arquivo multi-página.

---

## 7. Metadados customizados: o wrapper `<object>`

### 7.1 Como funciona — a "inversão" do codec

O mecanismo é uma inversão deliberada no `mxCellCodec`:

```js
// [mx] io/mxCellCodec.js:85-104
codec.afterEncode = function(enc, obj, node) {
    if (obj.value != null && mxUtils.isNode(obj.value)) {
        // Wraps the graphical annotation up in the user object (inversion)
        var tmp = node;
        node = mxUtils.importNode(enc.document, obj.value, true);
        node.appendChild(tmp);
        // Moves the id attribute to the outermost XML node
        var id = tmp.getAttribute('id');
        node.setAttribute('id', id);
        tmp.removeAttribute('id');
    }
    return node;
};
```

Quando `mxCell.value` é um **nó DOM** em vez de string, o codec grava o nó DOM por fora e o `<mxCell>` por dentro, **movendo o `id` para o elemento externo**. Na leitura:

```js
// [mx] io/mxCodec.js:614-645
mxCodec.prototype.decodeCell = function(node, restoreStructures) {
    // Tries to find a codec for the given node name. If that does not return
    // a codec then the node is the user object (an XML node that contains the
    // mxCell, aka inversion).
    var decoder = mxCodecRegistry.getCodec(node.nodeName);
    if (!this.isCellCodec(decoder)) {
        var child = node.firstChild;
        while (child != null && !this.isCellCodec(decoder)) {
            decoder = mxCodecRegistry.getCodec(child.nodeName);
            child = child.nextSibling;
        }
    }
    ...
```

**Consequência:** o nome do elemento wrapper é irrelevante — qualquer nome sem codec registrado funciona. `object` e `UserObject` são só as convenções que o drawio emite (`doc.createElement('UserObject')` em `Graph.prototype.setAttributeForCell` `[drawio] js/grapheditor/Graph.js:20305`). `[xsd]` confirma: *"Use `object` or `UserObject` interchangeably (both are supported)."*

### 7.2 Atributos

`[xsd]` `UserObjectType` L374-437:

| Atributo | Papel |
|---|---|
| `id` | **`use="required"`**. *"Unique identifier (same role as mxCell id). **The nested mxCell should NOT have its own id.**"* |
| `label` | *"Display label text (replaces mxCell value)."* |
| `link` | *"Hyperlink URL. Opens when the cell is clicked in the viewer."* |
| `tags` | Tags separadas por espaço, para filtro |
| `tooltip` | Texto de hover |
| `placeholders` | `0`/`1` — *"When `"1"`, `%attribute%` in the label is replaced with attribute values."* |
| **qualquer outro** | `<xs:anyAttribute processContents="lax" />` — **chaves arbitrárias são parte do schema** |

*"Custom attributes appear in the 'Edit Data' dialog in draw.io and can be used for data-driven diagrams, linking, and metadata."* `[xsd]`

Na UI: `Edit > Edit Data` (`Ctrl+M` / `Cmd+M`) `[doc:metadata]` <https://www.drawio.com/docs/manual/shapes/shape-metadata/>.

### 7.3 Dá para embutir um modelo YAML/JSON serializado? **Sim, sem perda.**

Esta é a pergunta que mais depende de detalhe de implementação. Três barreiras possíveis, todas verificadas:

**Barreira 1 — normalização de atributo XML.** Pela spec XML, um LF literal dentro de um valor de atributo é normalizado para **espaço** na leitura. Verificado:

```
'<object data="a: 1&#10;b: 2"/>'  →  parse  →  'a: 1\nb: 2'   ✅
'<object data="a: 1\nb: 2"/>'     →  parse  →  'a: 1 b: 2'    ❌ corrompido
```

O drawio blinda contra isso em **ambos** os caminhos de serialização:

```js
// [mx] util/mxUtils.js:1246-1256  (getXml — caminho comprimido/uma linha)
var xml = mxUtils.zapGremlins(new XMLSerializer().serializeToString(node));
linefeed = linefeed || '&#xa;';
xml = xml.replace(/\n/g, linefeed);

// [mx] util/mxUtils.js:1349-1354  (getPrettyXml — caminho NÃO comprimido, o default)
var val = mxUtils.htmlEntities(mxUtils.zapGremlins(attrs[i].value)).replace(/\r/g, '&#xd;');
result.push(' ' + attrs[i].nodeName + '="' + val + '"');

// [mx] util/mxUtils.js:1166-1191
htmlEntities: function(s, newline, quotes, tab) {
    s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (quotes  == null || quotes)  { s = s.replace(/"/g,'&quot;').replace(/\'/g,'&#39;'); }
    if (newline == null || newline) { s = s.replace(/\n/g, '&#xa;'); }
    if (tab     == null || tab)     { s = s.replace(/\t/g, '&#x9;'); }
    return s;
}
```

Chamado sem argumentos ⇒ escapa `&  <  >  "  '  \n→&#xa;  \t→&#x9;`, mais `\r→&#xd;`. **Newlines e tabs sobrevivem ao round-trip como entidades numéricas.** Round-trip com um YAML multi-linha (incluindo aspas, `&`, `<`) verificado nesta pesquisa: **idêntico byte a byte**.

**Barreira 2 — `zapGremlins`.**

```js
// [mx] util/mxUtils.js:3684-3718
// Removes all illegal control characters with ASCII code <32 except TAB, LF
// and CR, and all unpaired surrogates.
var valid = (code >= 32 || code == 9 || code == 10 || code == 13) &&
    code != 0xFFFF && code != 0xFFFE;
```

**TAB, LF e CR são preservados.** Só caracteres de controle ilegais em XML e surrogates órfãos são removidos. YAML e JSON normais passam intactos. (Cuidado apenas com strings contendo bytes de controle, ex. um `\x00` vindo de binário.)

**Barreira 3 — sanitização.** `Graph.sanitizeHtml` / `Graph.sanitizeNode` (DOMPurify) `[drawio] js/grapheditor/Graph.js:3055, 3327` atuam sobre **renderização de rótulos HTML e hrefs**, não sobre atributos do modelo. Atributos customizados não passam por DOMPurify.

**Barreira 4 — o app preserva atributos que não conhece?** Sim, por construção: `beforeDecode` faz `obj.value = node.cloneNode(true)` (o elemento inteiro, todos os atributos) `[mx] io/mxCellCodec.js:112`, e `afterEncode` reimporta `obj.value` inteiro. Editar geometria/estilo no app não toca no `value`. `Graph.prototype.setAttributeForCell` também clona antes de alterar `[drawio] js/grapheditor/Graph.js:20293-20318`.

**Exemplo — modelo YAML embutido, sobrevive a round-trip:**

```xml
<object label="Serviço Checkout"
        panlabsKind="service"
        panlabsModel="name: checkout&#xa;owner: squad-pedidos&#xa;deps:&#xa;  - postgres&#xa;  - kafka&#xa;sla: &quot;99.9%&quot;"
        id="servico">
  <mxCell style="swimlane;html=1;startSize=24;container=1;collapsible=0;"
          vertex="1" parent="dominio">
    <mxGeometry x="20" y="40" width="520" height="270" as="geometry" />
  </mxCell>
</object>
```

Notas para o gerador:
- O `<mxCell>` interno **não** leva `id` — o wrapper carrega.
- O `label` do wrapper substitui o `value` do `mxCell`.
- Nomes de atributo devem ser NCNames XML válidos. **Evite `:`** — vira namespace. Use `panlabsModel`, não `panlabs:model`.
- **Não use `placeholders="1"`** se o seu YAML contiver `%`: o app passaria a substituir `%chave%` dentro do rótulo. Sem `placeholders`, `%` é literal. `[doc:placeholders]` <https://www.drawio.com/docs/manual/advanced/placeholders/> — o recurso é opt-in: *"placeholders are not enabled by default"*.
- Base64 do YAML é uma alternativa se você quiser imunidade total a escaping — ao custo de perder legibilidade no diff e no diálogo Edit Data.

### 7.4 Limite prático de tamanho

**Não existe limite documentado ou codificado para o tamanho de um atributo de `<object>`.** Nada no `[xsd]`, nada nas docs, nada em `Graph.js`/`Editor.js`.

Constantes de tamanho que existem no drawio e o que **realmente** limitam:

```js
// [drawio] js/diagramly/EditorUi.js:802-828
EditorUi.prototype.maxImageSize        = 1200;      // px, redimensionamento de imagem
EditorUi.prototype.maxImageBytes       = 2000000;   // 2 MB, imagem importada
EditorUi.prototype.maxBackgroundBytes  = 2500000;   // 2,5 MB, imagem de fundo
EditorUi.prototype.maxTextBytes        = 500000;    // 0,5 MB — ver abaixo
```

`maxTextBytes` **não** se aplica a atributos: seu único uso é truncar o conteúdo de um **arquivo de texto arrastado para o canvas** ao virar rótulo `[drawio] js/diagramly/EditorUi.js:13814-13817`.

Limites reais são do **backend de armazenamento**, não do formato: `GitHubClient.maxFileSize = 50 MB`, `GitLabClient.maxFileSize = 10 MB`, `TrelloClient.maxFileSize = 10 MB` `[drawio] js/diagramly/{GitHub,GitLab,Trello}Client.js`.

**Recomendação prática:** mantenha o payload por célula na casa das **dezenas de KB**. O custo real não é um limite rígido, é o app manter todo o DOM do modelo em memória e reserializar tudo a cada save — um YAML de 100 KB × 200 células vira um arquivo de 20 MB que trava o editor. Se o modelo for grande, guarde uma **chave/ponteiro** no `<object>` e o modelo fora do `.drawio`.

---

## 8. Receita condensada para o gerador

1. Raiz `<mxfile host="<seu-gerador>" compressed="false">`. Nada mais.
2. Uma `<diagram id="<slug-estável>" name="<Nome>">` por página; ids de página derivados do domínio, nunca aleatórios.
3. `<mxGraphModel>` com o conjunto padrão de atributos de viewport (ou nenhum — são opcionais).
4. `<root>` sempre abrindo com `<mxCell id="0"/>` e `<mxCell id="1" parent="0"/>`.
5. Ids de célula determinísticos derivados do domínio.
6. Layout calculado por você. Coordenadas dos filhos relativas ao canto do pai, **somando o `startSize` do pai** ao eixo do cabeçalho.
7. Containers: `container=1;collapsible=0;` (ou `swimlane;startSize=N;collapsible=0;`). **Sem `childLayout`.**
8. Dimensione o pai para conter os filhos você mesmo (`extendParent` só cresce e só reage a interação na UI).
9. Arestas: parenteadas no ancestral comum mais próximo; `<mxGeometry relative="1" as="geometry"/>`; `exitX/exitY/entryX/entryY` **sempre em par**, com `exitPerimeter=0;entryPerimeter=0`; waypoints em `<Array as="points">` no espaço do pai da aresta.
10. Metadados em `<object id="…" label="…" chaveCustom="…">` envolvendo um `<mxCell>` **sem id**. Escape `\n`→`&#xa;`, `\t`→`&#x9;`, `\r`→`&#xd;`, `&<>"'`.
11. Serialize com indentação de 2 espaços (é o que `getPrettyXml` faz) para diffs limpos.

---

## 9. Incertezas

Coisas que **não** consegui confirmar em fonte primária, ou onde as fontes primárias divergem entre si:

1. **`startSize` default: `23` vs `40`.** `[styleref]` §4.7 tabula default `23`; `[mx] util/mxConstants.js:609` define `DEFAULT_STARTSIZE: 40`. As entradas da biblioteca do drawio nunca usam nenhum dos dois (usam 26, 30, 8, 14…). Não localizei a folha de estilo que produziria 23. **Mitigação: sempre emitir `startSize` explícito.**

2. **`[xsd]` diz que waypoints são coordenadas absolutas — o código diz que não.** Documentei a correção em §5.2 com `transformControlPoint` e um template real como prova. Não achei nenhuma doc oficial *em prosa* que confirme a leitura do código. Se o gerador só produzir arestas parenteadas na camada `1`, a divergência é inócua.

3. **Defaults de `expand` / `contract`.** Aparecem uma única vez, numa linha de tabela em `[doc:group-shapes]`, sem default declarado. No código só encontrei a leitura de `expand` (`style['expand'] != '0'`), o que implica default "ligado"; **não encontrei nenhuma leitura de `contract`** em `Graph.js`. Pode ser doc adiantada a uma implementação, ou eu não localizei o ponto de leitura.

4. **Ausência de `exitX`/`exitY` ⇒ conexão flutuante.** É inferência forte (o código só monta o constraint quando ambos existem; `[styleref]` marca o default como "—"), mas **nenhuma fonte oficial afirma isso nesses termos**.

5. **Unidade de `exitDx`/`exitDy`.** O código multiplica por `this.scale`, o que só faz sentido para pixels de modelo, e `[doc:connection-points]` chama a 4ª/5ª coordenada de `points[]` de "absolute offset in pixels". Mas `[styleref]` só diz "number / Absolute x offset", e a UI (`[doc:blog]` <https://www.drawio.com/blog/edit-connection-points/>) mostra um campo "`Dx` % ou pt" — sugerindo que a UI pode aceitar percentual e converter. Considero "pixels no modelo" confirmado pelo código, mas a doc é ambígua.

6. **Limite de tamanho de atributo.** Concluí "não existe" por ausência de evidência (grep exaustivo por constantes de tamanho + leitura das docs). Ausência de evidência não é evidência de ausência: pode haver limites em backends específicos (Confluence, Google Drive, SharePoint) que não auditei.

7. **Não executei o drawio.** Todas as afirmações vêm de leitura de código, do schema oficial, das docs e de arquivos reais versionados no repo. Validei aritmética de geometria e a cadeia de compressão com implementações Python que replicam o código JS, mas **não** abri um arquivo gerado no app real nem fiz um round-trip de gravação de verdade. As duas afirmações que mais mereceriam esse teste: (a) preservação literal de um YAML multi-linha após editar e salvar no app; (b) estabilidade das coordenadas de containers aninhados após arrastar um filho.

8. **`Editor.compressXml = true` vs `Editor.defaultCompressed = false`.** As duas convivem `[drawio] js/diagramly/Editor.js:276-281` com comentários que se contradizem ("Default is true" / "Default is false"). Minha leitura: `defaultCompressed` governa o formato de gravação (e é `false`), enquanto `compressXml` só é consultado em `DrawioFile.isCompressed()` como fallback quando o storage é "comprimido" **e** o atributo `compressed` está ausente. Emitir `compressed="false"` torna a distinção irrelevante — que é exatamente por isso que recomendo emiti-lo.

9. **URLs `/doc/faq/*` estão mortas.** A reestruturação para `/docs/...` significa que qualquer link para docs drawio em código/comentários mais antigos que ~2025 provavelmente 404. Os links deste documento foram verificados nesta data (2026-08-21) mas o site já mostrou que reorganiza.
