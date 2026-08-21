# Alavancas visuais do draw.io — o que expor num gerador automático de diagramas AWS

> **Pergunta de pesquisa:** que alavancas visuais o draw.io realmente oferece, quais
> sobrevivem ao arquivo e ao export, e quais valem virar opção de customização de um
> gerador automático de diagramas AWS?
>
> **Data da pesquisa:** 2026-08-21
> **Código analisado:** `jgraph/drawio`, branch `dev`, commit `d3140c3105c7fe8fb47259f6283e7ef566c647c6`
> (2026-08-20), `VERSION` = `31.3.1`

---

## Fontes primárias usadas

Toda afirmação neste documento vem de uma destas fontes. **Nenhum write-up de terceiro
foi usado como autoridade.** Blogs e docs citados são do próprio produto (drawio.com).

| # | Fonte | Referência |
|---|---|---|
| S1 | Código-fonte `jgraph/drawio` @ `d3140c3` | `https://github.com/jgraph/drawio/blob/d3140c3105c7fe8fb47259f6283e7ef566c647c6/<path>` |
| S2 | API docs do mxGraph — `mxConstants` | <https://jgraph.github.io/mxgraph/docs/js-api/files/util/mxConstants-js.html> |
| S3 | draw.io doc — *Edit the style of a shape* | <https://www.drawio.com/doc/faq/shape-styles> |
| S4 | draw.io doc — *Animate connectors* | <https://www.drawio.com/doc/faq/connector-animate> |
| S5 | draw.io blog — *More flow animation styles for connectors* | <https://www.drawio.com/blog/connector-animation-styles> |
| S6 | draw.io doc — *Disable distracting animations in diagrams* | <https://www.drawio.com/docs/manual/styles/disable-animations/> |
| S7 | draw.io blog — *Updates to draw.io dark mode diagrams improve readability* | <https://www.drawio.com/blog/dark-mode-diagrams> |
| S8 | draw.io doc — *Adaptive colours for dark and light mode* | <https://www.drawio.com/docs/manual/editor/appearance/adaptive-colours/> |
| S9 | draw.io doc — *Change the background in draw.io* | <https://www.drawio.com/docs/manual/editor/panels/background/> |
| S10 | draw.io doc — *Configure the draw.io editor* | <https://www.drawio.com/doc/faq/configure-diagram-editor> |
| S11 | draw.io doc — *Style connectors* | <https://www.drawio.com/doc/faq/connector-styles> |
| S12 | draw.io doc — *Consistency in diagrams* (best practice) | <https://www.drawio.com/docs/best-practice/consistent-diagrams/> |
| S13 | draw.io doc — *Why text in exported SVG images may not display correctly* | <https://www.drawio.com/doc/faq/svg-export-text-problems> |
| S14 | Templates oficiais AWS do produto | `src/main/webapp/templates/cloud/aws/aws_{1..10}.xml` |

**Método:** os arquivos de `src/main/webapp/**` foram baixados do commit fixado acima e
inspecionados diretamente. Os templates AWS estão comprimidos (`deflateRaw` + base64 +
`encodeURIComponent`) dentro de `<diagram>` e foram descomprimidos para leitura. As
style strings reproduzidas abaixo são **literais do código**, não reconstruções.

Caminhos citados com frequência (todos sob `src/main/webapp/`):

- `js/grapheditor/{Graph,Editor,Format,Shapes,Menus}.js` — o editor genérico
- `js/diagramly/{Editor,EditorUi,Pages,GraphViewer}.js` — a camada draw.io
- `js/diagramly/sidebar/Sidebar-AWS4.js` — a paleta AWS oficial do produto
- `shapes/mxAWS4.js` — as formas JS `mxgraph.aws4.{productIcon,resourceIcon,group,groupCenter,group2}`
- `stencils/aws4.xml` — os stencils de ícone (`resIcon=`, `grIcon=`, `shape=mxgraph.aws4.<nome>`)
- `mxgraph/src/**` — o fork do mxGraph embutido
- `styles/{default,default-old,dark-default}.xml` — as folhas de estilo `mxStylesheet` do app
- `js/export.js` — o renderizador headless do serviço de export

---

## 1. Fundo escuro: o que é arquivo e o que é preferência local

### 1.1 O que o `.drawio` realmente grava

O conjunto exato de atributos gravados no elemento `<mxGraphModel>` está em
`Graph.prototype.saveViewState` (`js/diagramly/Pages.js`) e em
`Editor.prototype.getGraphXml` (`js/grapheditor/Editor.js` + o override em
`js/diagramly/Editor.js`). São eles:

| Atributo | Significado | Escrito quando |
|---|---|---|
| `background` | cor de fundo da página | só se `graph.background != null` |
| `backgroundImage` | JSON da imagem de fundo | só se houver imagem |
| `math` | MathJax/LaTeX nos rótulos ligado | sempre (`'0'`/`'1'`) |
| `shadow` | sombra global do diagrama (filtro SVG) | sempre (`'0'`/`'1'`) |
| `adaptiveColors` | `auto` \| `simple` \| `none` | só se `graph.adaptiveColors != null` |
| `style` | **nome** de uma folha de estilo embutida do app | só se `!= 'default-style2'` |
| `extFonts` | fontes web (`nome^url\|nome^url`) | só se houver |
| `grid`, `gridSize`, `guides`, `tooltips`, `connect`, `arrows`, `fold`, `page`, `pageScale`, `pageWidth`, `pageHeight` | estado de edição/página | sempre |

Trecho literal de `js/diagramly/Pages.js` (`saveViewState`):

```js
if (vs.background != null)
{
    node.setAttribute('background', vs.background);
}
...
node.setAttribute('math', ((vs == null) ? this.defaultMathEnabled : vs.mathEnabled) ? '1' : '0');
node.setAttribute('shadow', (vs != null && vs.shadowVisible) ? '1' : '0');
```

Cabeçalho literal de um template oficial AWS (`templates/cloud/aws/aws_1.xml`, após
descompressão) — note `math="0" shadow="0"` e a **ausência** de `background`:

```xml
<mxGraphModel dx="2585" dy="1385" grid="1" gridSize="10" guides="1" tooltips="1"
  connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169"
  pageHeight="827" math="0" shadow="0">
```

Para gravar fundo escuro no arquivo, o gerador escreve:

```xml
<mxGraphModel ... background="#0D1117" math="0" shadow="0">
```

### 1.2 `pageBackgroundColor` **não** é do arquivo

`pageBackgroundColor` não existe como atributo de `<mxGraphModel>` nem como chave de
style. É uma variável global JS do app (`js/grapheditor/Editor.js`):

```js
Editor.pageBackgroundColor = '#ffffff';
Editor.darkPageBackgroundColor = null;

Editor.getDefaultPageBackgroundColor = function()
{
    return 'light-dark(' + Editor.pageBackgroundColor + ', ' +
        ((Editor.darkPageBackgroundColor != null) ?
        Editor.darkPageBackgroundColor : Editor.darkColor) + ')';
};
```

Ela é configurável apenas via **configuração do app**, pelas chaves
`defaultPageBackgroundColor` e `defaultDarkPageBackgroundColor` (S10). Ou seja: quem
altera isso muda o próprio editor, não o diagrama. Um gerador não tem como setá-la.

### 1.3 O dark mode do app é filtro/CSS, não dado

O blog oficial é explícito (S7):

> "The mode colour intensity change is a CSS filter - this does not change the colours
> in your diagram data."

O código confere: o modo escuro vem de `mxSettings.settings.darkMode` (localStorage),
de `urlParams['dark']` ou de `prefers-color-scheme`
(`js/diagramly/EditorUi.js`, bloco em torno de `this.setDarkMode(...)`):

```js
if (darkMode == 'auto' && this.isAutoDarkModeSupported())
{
    darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
}
```

Existem **dois** mecanismos distintos que fazem um diagrama "ficar escuro":

**(a) Cores `default` + adaptive colours.** A folha de estilo do app
(`styles/default.xml`) define os valores literais `default`:

```xml
<add as="defaultVertex">
  <add as="fillColor" value="default"/>
  <add as="strokeColor" value="default"/>
  <add as="fontColor" value="default"/>
</add>
```

`Graph.prototype.replaceDefaultColors` (`js/grapheditor/Graph.js`) troca `default` em
tempo de render por:

```js
Graph.prototype.shapeForegroundColor = 'light-dark(#000000, #ffffff)';
Graph.prototype.shapeBackgroundColor = 'light-dark(#ffffff, var(' +
    Editor.darkColorVar + ', ' + Editor.darkColor + '))';   // --ge-dark-color, #121212
```

**(b) Cores duplas escolhidas pelo usuário.** Quando o usuário define uma cor
específica para dark mode (S8), o valor gravado no style é literalmente uma expressão
CSS `light-dark()` (`Graph.prototype.getDefaultColor`, `js/grapheditor/Graph.js`):

```js
var color = mxUtils.getLightDarkColor(defaultValue);
defaultValue = 'light-dark(' + color.dark + ', ' + color.light + ')';
```

Isto é, `fillColor=light-dark(#dae8fc, #1a3a5c);` é uma style string válida e viaja no
arquivo. S8 confirma: as configurações de cor adaptativa "are saved in the diagram file"
e usam a função CSS `light-dark()`.

### 1.4 Respostas diretas

**"Um diagrama gerado com fundo escuro abre escuro pra outra pessoa?"**

- Se o fundo veio de `background="#0D1117"` no `<mxGraphModel>`: **sim**, sempre, para
  qualquer leitor, independente do tema do app dele. É dado do arquivo.
- Se o fundo veio do dark mode do app: **não**. É preferência local (S7).
- Se as formas usam `fillColor=default` / `light-dark(...)`: o fundo da página pode ser
  escuro, mas as **formas** vão resolver conforme o `color-scheme` do leitor — o mesmo
  arquivo renderiza diferente em dois computadores. Para um gerador isso é
  indesejável: use hex explícito.

**"E no export PNG/SVG?"**

`EditorUi.prototype.exportSvg` (`js/diagramly/EditorUi.js`):

```js
var bg = (transparentBackground) ? null : this.editor.graph.background;

if (bg == mxConstants.NONE) { bg = null; }

// Handles special case where background is null but transparent is false
if (bg == null && transparentBackground == false)
{
    bg = this.editor.graph.shapeBackgroundColor;   // 'light-dark(#ffffff, var(--ge-dark-color, #121212))'
}
```

Ou seja: **sem `background` no arquivo, o export não-transparente cai num
`light-dark()`** — o SVG exportado muda de cor conforme o tema do sistema de quem abre.
Com `background` explícito, o export sai fixo.

O seletor *Appearance: Light/Dark* do diálogo de export congela a resolução:

```js
if (theme == 'light' || theme == 'dark')
{
    mxUtils.lightDarkColorSupported = false;
    mxUtils.preferDarkColor = theme == 'dark';
}
```

PNG passa por `canvas.toDataURL('image/' + format)`
(`EditorUi.prototype.createImageDataUri`) — um raster de um frame, com o fundo já
resolvido no momento do export.

**E `math`?** É atributo de arquivo (`math="0"|"1"`), mas não tem relação com fundo: liga
o typesetting MathJax dos rótulos. Só ligue se o gerador emitir LaTeX; caso contrário
é custo de render puro.

---

## 2. Animação de aresta (`flowAnimation`)

### 2.1 As chaves

A lista canônica está em `Graph.edgeStyles` (`js/grapheditor/Graph.js`):

```js
Graph.edgeStyles = ['edgeStyle', 'elbow', 'jumpStyle', 'jumpSize', 'startArrow',
    'startFill', 'startSize', 'endArrow', 'endFill', 'endSize', 'flowAnimation',
    'flowAnimationDirection', 'flowAnimationTimingFunction', 'flowAnimationDuration',
    'sourcePerimeterSpacing', 'targetPerimeterSpacing', 'curved', 'linecap', 'linejoin',
    'libavoidRouting'];
```

Atenção: a doc do produto fala em "Flow Duration / Flow Timing / Flow Direction" (S4, S5)
mas **as chaves reais têm o prefixo `flowAnimation`**, não `flow`. Confirmado em
`Graph.prototype.addFlowAnimationToNode`:

```js
var d = Math.round((sum / scale / 16) * parseInt(mxUtils.getValue(
    style, 'flowAnimationDuration', 500)));
var tf = mxUtils.getValue(style, 'flowAnimationTimingFunction', 'linear');
var ad = mxUtils.getValue(style, 'flowAnimationDirection', 'normal');
node.style.animation = id + ' ' + d + 'ms ' + mxUtils.htmlEntities(tf) +
    ' infinite ' + mxUtils.htmlEntities(ad);
node.style.strokeDashoffset = sum;
```

Valores documentados (S5): `flowAnimationDuration` default `500`;
`flowAnimationTimingFunction` ∈ `linear` (default) `| ease | ease-in | ease-out |
ease-in-out`; `flowAnimationDirection` ∈ `normal` (default) `| reverse | alternate |
alternate-reverse`.

Style string literal:

```
edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;flowAnimation=1;flowAnimationDuration=800;flowAnimationTimingFunction=ease-in-out;flowAnimationDirection=normal;strokeColor=#545B64;strokeWidth=2;endArrow=open;endFill=0;
```

### 2.2 A aresta vira tracejada quando anima

Ainda em `addFlowAnimationToNode`: se o nó não tiver `stroke-dasharray`, o draw.io
**cria um** a partir de `dashPattern` (default `'8'`):

```js
if (dashArray == '' || dashArray == null)
{
    tokens = String(mxUtils.getValue(style, mxConstants.STYLE_DASH_PATTERN, '8')).split(' ');
    ...
    node.setAttribute('stroke-dasharray', tokens.join(' '));
}
```

Consequência prática: `flowAnimation=1` numa aresta sólida a transforma visualmente em
tracejada em movimento. Não existe animação de aresta contínua.

### 2.3 Funciona no app?

Sim, mas **atrás de um gate global**. `Graph.prototype.enableFlowAnimation = false` por
padrão (`js/grapheditor/Graph.js`); o editor liga isso a partir de
`Editor.enableAnimations` (`js/diagramly/EditorUi.js`):

```js
graph.enableFlowAnimation = Editor.enableAnimations;
```

`Editor.enableAnimations = true` por padrão (`js/diagramly/Editor.js`), configurável
pela chave `enableAnimations` da configuração do app (S10) e desligável pelo usuário em
*View > Animations* / *Settings > Animations* (S6), com persistência em
`mxSettings.settings.enableAnimations`. S6 é explícito: desligar **não** remove o style
do arquivo — "This does not disable the flow animation style on the connectors, only the
visual effect in your browser window."

Só é oferecido para arestas: em `js/grapheditor/Format.js`,

```js
if (ss.edges.length > 0 && ss.vertices.length == 0)
{
    addOption(mxResources.get('flowAnimation'), 'flowAnimation', 0);
}
```

### 2.4 Sobrevive ao export SVG?

**Sim.** `Graph.prototype.getSvg` injeta um `<style>` com o `@keyframes` dentro de
`<defs>` e aplica `style.animation` no path exportado:

```js
var addFlowAnimationStyle = mxUtils.bind(this, function()
{
    if (flowAnimationId == null)
    {
        flowAnimationId  = 'ge-flow-animation-' + Editor.guid();
        var style = ... svgDoc.createElementNS(mxConstants.NS_SVG, 'style') ...;
        style.innerHTML = this.createFlowAnimationCss(flowAnimationId);
        svgDoc.getElementsByTagName('defs')[0].appendChild(style);
    }
    return flowAnimationId;
});
```

com

```js
Graph.prototype.createFlowAnimationCss = function(id)
{
    return '@keyframes ' + id + ' {\n' +
    '  to {\n' +
    '    stroke-dashoffset: 0;\n' +
    '  }\n' +
    '}';
};
```

S4 confirma: *"Export your diagram to a SVG file to include the connector animation when
you publish it in a web page."*

**Ressalva encontrada no código, não na doc:** o export só emite a animação se o gate
global estava ligado no momento do export. Em `getSvg`:

```js
var origEnabledFlowAnimation = this.enableFlowAnimation;
this.enableFlowAnimation = false;
...
state.shape.isFlowAnimationEnabled = function()
{
    return origEnabledFlowAnimation && graph.model.isEdge(state.cell) &&
        mxUtils.getValue(state.style, 'flowAnimation', '0') == '1';
};
```

Se o usuário desligou *View > Animations*, o SVG que **ele** exportar sai estático. O
serviço de export headless não tem esse problema — `js/export.js` liga
incondicionalmente:

```js
var graph = new Graph(container);
graph.enableFlowAnimation = true;
```

### 2.5 E o export HTML?

**Sim.** `EditorUi.prototype.createHtml` gera um `<div class="mxgraph">` com os dados e o
loader do viewer; o viewer (`js/diagramly/GraphViewer.js`) liga a animação sempre:

```js
this.graph = new Graph(container);
...
this.graph.enableFlowAnimation = true;
```

### 2.6 E PNG / PDF?

**Não, por construção.** PNG/JPG passam por `canvas.toDataURL(...)` — um frame. PDF é
render estático do mesmo pipeline. Não há mecanismo de animação nesses formatos.

---

## 3. Estilos de forma vs. stencils `mxgraph.aws4.*`

### 3.1 O que a paleta AWS oficial do próprio draw.io emite

Três famílias, extraídas literalmente de `js/diagramly/sidebar/Sidebar-AWS4.js`
(`mxConstants.STYLE_SHAPE` é a string `shape`):

**(a) Ícone de serviço colorido (quadrado + glifo interno) —
`shape=mxgraph.aws4.resourceIcon`:**

```
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.athena;
```

**(b) Ícone de recurso monocromático (stencil direto) —
`shape=mxgraph.aws4.<nome>`:**

```
sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#8C4FFF;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;pointerEvents=1;shape=mxgraph.aws4.<nome>;
```

**(c) Container de grupo — `shape=mxgraph.aws4.group`:**

```
<points=[...]>outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;
```

e a variante centrada (Auto Scaling group):

```
...shape=mxgraph.aws4.groupCenter;grIcon=mxgraph.aws4.group_auto_scaling_group;grStroke=1;strokeColor=#D86613;fillColor=none;verticalAlign=top;align=center;fontColor=#D86613;dashed=1;spacingTop=25;
```

**Fato duro:** `Sidebar-AWS4.js` contém **56 ocorrências de `sketch=0` e zero de
`sketch=1`**. A paleta oficial desliga sketch explicitamente em toda entrada.

### 3.2 A armadilha do `strokeColor` nas formas AWS4

Em `shapes/mxAWS4.js`, `strokeColor` **não** é a cor da borda — é a cor de preenchimento
do glifo interno:

```js
mxShapeAws4ResourceIcon.prototype.paintVertexShape = function(c, x, y, w, h)
{
    c.translate(x, y);
    c.begin(); c.moveTo(0,0); c.lineTo(w,0); c.lineTo(w,h); c.lineTo(0,h); c.close();
    c.fill();

    c.setShadow(false);

    var prIcon = mxUtils.getValue(this.state.style, 'resIcon', '');
    var stencil = mxStencilRegistry.getStencil(prIcon);

    if (stencil != null)
    {
        var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
        c.setFillColor(strokeColor);
        c.setStrokeColor('none');
        stencil.drawShape(c, this, w * 0.1, h * 0.1, w * 0.8, h * 0.8);
    }
};
```

Mesmo padrão em `mxShapeAws4Group` (`strokeColor` pinta a borda **e** o ícone do grupo).
Um gerador que trate `strokeColor` como "cor de contorno" vai pintar o glifo AWS de
branco/preto sem perceber.

### 3.3 Compatibilidade item a item

| Chave | Comportamento nos `mxgraph.aws4.*` | Veredito |
|---|---|---|
| `sketch=1` | `mxShape.prototype.createHandJiggle` (override em `js/diagramly/Editor.js`) devolve um `RoughCanvas` que intercepta `rect/ellipse/roundrect/lineTo/moveTo/quadTo/curveTo/arcTo/close/fill/stroke/fillAndStroke`. Como `mxStencil.drawShape` usa exatamente essas primitivas, o **glifo do ícone AWS também é jitterado**. | **Quebra.** A paleta oficial força `sketch=0`. |
| `comic=1` / `sketchStyle=comic` | `createComicCanvas` → `HandJiggle`, mesmas primitivas. Idem. | **Quebra.** |
| `rounded=1` | `Graph.prototype.isRoundedState` só oferece a opção para `Graph.prototype.roundableShapes` (`label, rectangle, internalStorage, corner, parallelogram, swimlane, triangle, trapezoid, ext, step, tee, process, link, rhombus, offPageConnector, loopLimit, hexagon, manualInput, card, curlyBracket, singleArrow, callout, doubleArrow, flexArrow, umlLifeline`) — nenhuma AWS4 na lista. `mxgraph/src/shape/mxStencil.js` não lê `STYLE_ROUNDED`. | **No-op silencioso** em AWS4. Útil só em arestas e em retângulos comuns (ex.: a entrada "Generic group"). |
| `shadow=1` | Funciona, mas só no quadrado externo: `resourceIcon` chama `c.setShadow(false)` antes do stencil, e `mxStencil.drawShape` também desliga sombra depois do primeiro `fill/stroke/fillstroke`. A opção por célula é desabilitada no Safari (`Editor.enableShadowOption = !mxClient.IS_SF`). | **Parcial.** Prefira o `shadow="1"` global no `<mxGraphModel>`. |
| `glass=1` | `paintGlassEffect` só é invocado por `mxRectangleShape` (base mxGraph), `mxRhombus` e `mxEllipse` (`js/grapheditor/Shapes.js`). Nenhuma forma AWS4 e nenhum stencil chama. | **No-op silencioso.** |
| `gradientColor` + `gradientDirection` | Funciona: `resourceIcon`/`productIcon` chamam `c.fill()` com o fill do state, e o canvas SVG monta o gradiente. A própria paleta AWS4 usa: `gradientDirection=north;gradientColor=#505863;fillColor=#1E262E`. Direções válidas (`mxConstants`): `north`, `south`, `east`, `west`, `radial`. | **Compatível.** Cuidado: `Graph.cellStyleGroups` trata `['fillColor','gradientColor','gradientDirection']` como grupo — colar estilo substitui os três juntos. |

Chaves que o gerador **não deve remover** das entradas AWS4: `aspect=fixed` (mantém o
ícone quadrado ao redimensionar), `outlineConnect=0`, `points=[...]` (pontos de conexão),
`container=1;collapsible=0;recursiveResize=0;pointerEvents=0` nos grupos.

---

## 4. Tipografia

### 4.1 Fontes seguras

O default do app vem da folha `styles/default.xml`:

```xml
<add as="defaultVertex">
  <add as="fontSize" value="12"/>
  <add as="fontFamily" value="Helvetica"/>
</add>
<add as="defaultEdge">
  <add as="fontSize" value="11"/>
  <add as="fontFamily" value="Helvetica"/>
</add>
```

O default do mxGraph puro é `mxConstants.DEFAULT_FONTFAMILY = 'Arial,Helvetica'` e
`DEFAULT_FONTSIZE = 11` (S2).

A lista que o produto expõe no menu é `Menus.prototype.defaultFonts`
(`js/grapheditor/Menus.js`):

```js
Menus.prototype.defaultFonts = ['Helvetica', 'Verdana', 'Times New Roman', 'Garamond',
    'Comic Sans MS', 'Courier New', 'Georgia', 'Lucida Console', 'Tahoma'];
```

Essas nove são as **seguras** (web-safe, presentes no app e no renderizador de export).
A paleta AWS4 oficial **não seta `fontFamily` em nenhuma entrada** — herda `Helvetica`.

### 4.2 Fonte não-sistema exige `fontSource` + `extFonts`

Uma fonte fora dessa lista precisa de duas coisas: `fontSource` na style string da célula
e o atributo `extFonts` no `<mxGraphModel>`. O próprio tema sketch é o exemplo canônico
(`js/diagramly/Editor.js` + `EditorUi.js`):

```js
Editor.sketchFontFamily = 'Architects Daughter';
Editor.sketchFontSource = 'https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DArchitects%2BDaughter';
```

produzindo a style string literal (vista em `js/diagramly/EditorUi.js`):

```
fontFamily=Architects Daughter;fontSource=https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DArchitects%2BDaughter;
```

No export SVG, `Editor.embedSvgFonts = true` (config `embedSvgFonts`, S10) embute a
fonte como data URI; S13 recomenda ligar *Embed Fonts* "in case the viewer doesn't have
the font installed". Em PNG/JPG o serviço de export precisa da fonte instalada. Para um
gerador, isso é risco de infra por ganho estético baixo.

### 4.3 As chaves

| Chave | Tipo / valores | Fonte |
|---|---|---|
| `fontSize` | int, px | S2 (`STYLE_FONTSIZE`) |
| `fontColor` | nome HTML ou hex | S2 (`STYLE_FONTCOLOR`) |
| `fontStyle` | bitmask: `1` bold, `2` italic, `4` underline, `8` strikethrough (soma) | S2 (`FONT_BOLD/ITALIC/UNDERLINE/STRIKETHROUGH`) |
| `align` | `left` \| `center` \| `right` — texto **dentro** da caixa do rótulo | S2 (`STYLE_ALIGN`) |
| `verticalAlign` | `top` \| `middle` \| `bottom` — idem | S2 (`STYLE_VERTICAL_ALIGN`) |
| `labelPosition` | `left` \| `center` \| `right` — desloca a **caixa** do rótulo | S2 + `mxGraphView.updateVertexLabelOffset` |
| `verticalLabelPosition` | `top` \| `middle` \| `bottom` — idem | idem |
| `labelBackgroundColor`, `labelBorderColor` | cor | S2 |
| `spacing`, `spacingTop`, `spacingLeft`, `spacingRight`, `spacingBottom` | px | S2 |
| `whiteSpace=wrap`, `html=1` | quebra de linha e rótulo HTML | S3 |

`fontStyle=3` = negrito + itálico.

### 4.4 Rótulo fora do shape — o mecanismo exato

`mxGraphView.prototype.updateVertexLabelOffset` (`mxgraph/src/view/mxGraphView.js`):

```js
var h = mxUtils.getValue(state.style, mxConstants.STYLE_LABEL_POSITION, mxConstants.ALIGN_CENTER);

if (h == mxConstants.ALIGN_LEFT)      { state.absoluteOffset.x -= lw; }
else if (h == mxConstants.ALIGN_RIGHT){ state.absoluteOffset.x += state.width; }
...
if (v == mxConstants.ALIGN_TOP)       { state.absoluteOffset.y -= state.height; }
else if (v == mxConstants.ALIGN_BOTTOM){ state.absoluteOffset.y += state.height; }
```

Leitura: `labelPosition`/`verticalLabelPosition` movem a caixa do rótulo por uma
largura/altura inteira do vértice; `align`/`verticalAlign` posicionam o texto **dentro**
dessa caixa. Por isso o par idiomático AWS é:

```
verticalLabelPosition=bottom;verticalAlign=top;align=center;
```

— a caixa desce uma altura inteira (fica abaixo do ícone) e o texto encosta no topo dela,
ou seja, colado sob o ícone. É exatamente o que toda entrada da paleta AWS4 usa.

Rótulo à direita do ícone:

```
labelPosition=right;verticalLabelPosition=middle;align=left;verticalAlign=middle;spacingLeft=6;
```

Os templates AWS oficiais também usam a variante "caixa com título embaixo do
retângulo" (`aws_1.xml`):

```
whiteSpace=wrap;html=1;fillColor=none;fontSize=14;fontColor=#000000;dashed=0;fontStyle=0;align=center;verticalAlign=top;strokeColor=#D86613;gradientColor=none;spacingLeft=0;labelPosition=center;verticalLabelPosition=bottom;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;
```

---

## 5. Arestas

### 5.1 `edgeStyle` — os valores reais

Do menu *Waypoints* (`js/grapheditor/Format.js`, `js/grapheditor/Menus.js`), cada entrada
grava a tupla `[edgeStyle, elbow, curved, noEdgeStyle, libavoidRouting]`:

| Opção do produto | Style resultante |
|---|---|
| Straight | `edgeStyle=none;` (todas as chaves limpas) |
| Orthogonal | `edgeStyle=orthogonalEdgeStyle;` |
| Auto-route (libavoid) | `edgeStyle=orthogonalEdgeStyle;libavoidRouting=1;` — só quando `extensions.min.js` está carregado |
| Horizontal elbow | `edgeStyle=elbowEdgeStyle;elbow=vertical;` |
| Vertical elbow | `edgeStyle=elbowEdgeStyle;` |
| Isometric | `edgeStyle=isometricEdgeStyle;` |
| Isometric vertical | `edgeStyle=isometricEdgeStyle;elbow=vertical;` |
| Curved | `edgeStyle=orthogonalEdgeStyle;curved=1;` |
| Entity relation | `edgeStyle=entityRelationEdgeStyle;` |

`isometricEdgeStyle` **é exclusivo do draw.io**, não do mxGraph stock — registrado em
`js/grapheditor/Shapes.js`:

```js
mxStyleRegistry.putValue('isometricEdgeStyle', mxEdgeStyle.IsometricConnector);
```

O default do app (`js/grapheditor/Graph.js`):

```js
Graph.prototype.defaultEdgeStyle = {'edgeStyle': 'orthogonalEdgeStyle', 'rounded': '0',
    'jettySize': 'auto', 'orthogonalLoop': '1'};
```

Style string idiomática dos templates AWS oficiais:

```
edgeStyle=orthogonalEdgeStyle;html=1;endArrow=open;elbow=vertical;startArrow=none;endFill=0;strokeColor=#545B64;rounded=0;fontSize=14;strokeWidth=2;
```

### 5.2 `curved=1` e `rounded=1`

- `rounded=1` em aresta arredonda os cantos das dobras ortogonais (`arcSize`); em vértice
  arredonda o retângulo (S2, `STYLE_ROUNDED`: *"For edges this determines whether or not
  joins between edges segments are smoothed to a rounded finish"*).
- `curved=1` só é oferecido quando `Graph.edgeSupportsCurved(style)` é verdadeiro; a UI
  o combina com `orthogonalEdgeStyle`.
- **`curved=1` desliga os saltos de linha.** Em `mxGraphView.validateCellState`
  (override em `js/grapheditor/Graph.js`), só arestas não-curvas entram na lista de
  candidatas a interseção:

```js
if (state != null && recurse && this.graph.model.isEdge(state.cell) &&
    state.style != null && state.style[mxConstants.STYLE_CURVED] != 1)
{
    this.validEdges.push(state);
}
```

### 5.3 `jumpStyle` / `jumpSize`

Não estão em `mxConstants` do mxGraph stock — são chaves do draw.io. Valores do select
(`js/grapheditor/Format.js`):

```js
var styles = ['none', 'arc', 'gap', 'sharp', 'line'];
```

Tamanho default: `Graph.defaultJumpSize = 6` (`js/grapheditor/Graph.js`); o raio real é
`(jumpSize - 2) / 2 + strokewidth`. S11 confirma a lista de opções do produto
("overlapped (none), with an arc, a gap or a sharp bend").

```
edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;jumpStyle=arc;jumpSize=6;
```

### 5.4 Setas, traços, marcadores

- `startArrow` / `endArrow`: valores são as constantes `ARROW_*` do mxGraph (S2). Default
  do app: `endArrow=classic` (`styles/default.xml`). Acompanham `startFill`/`endFill`
  (0/1) e `startSize`/`endSize` (px).
- `dashed=0|1` (S2: *"Use 0 (default) for non-dashed or 1 for dashed"*).
- `dashPattern`: lista de números separados por espaço (S2). Multiplicado pela espessura
  do traço salvo `fixDash=1` — ver `addFlowAnimationToNode`, que usa
  `mxConstants.STYLE_FIX_DASH` na mesma conta.
- `sourcePerimeterSpacing` / `targetPerimeterSpacing`: espaço entre a ponta e a forma.
  S11: *"Negative values for spacing will position the end of the connector inside the
  shape boundary."*

```
edgeStyle=orthogonalEdgeStyle;html=1;rounded=0;dashed=1;dashPattern=8 8;startArrow=none;endArrow=blockThin;endFill=1;endSize=8;strokeWidth=2;strokeColor=#7AA116;
```

### 5.5 Rótulo em aresta

Rótulo de aresta é uma **célula filha**, não um atributo. `js/grapheditor/Graph.js`:

```js
label.style = 'edgeLabel;' + this.appendFontSize(style, this.edgeFontSize);
```

A forma completa no XML:

```xml
<mxCell id="lbl1" value="HTTPS" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];labelBackgroundColor=none;fontSize=11;"
        vertex="1" connectable="0" parent="e1">
  <mxGeometry x="-0.2" y="10" relative="1" as="geometry">
    <mxPoint as="offset"/>
  </mxGeometry>
</mxCell>
```

Posicionamento: `x` ∈ `[-1, 1]` é a posição relativa ao longo da aresta (`-1` na origem,
`0` no meio, `1` no destino); `y` é o deslocamento perpendicular em px; `<mxPoint
as="offset"/>` é o ajuste absoluto que o usuário produz ao arrastar. A folha
`styles/default.xml` define o estilo nomeado:

```xml
<add as="edgeLabel" extend="text">
  <add as="labelBackgroundColor" value="default"/>
  <add as="fontSize" value="11"/>
</add>
```

Alternativa mais simples: `value` direto na `<mxCell edge="1">` — vai para o meio da
aresta, sem controle de posição.

---

## 6. Legenda e título

### 6.1 Não existe shape "legenda" no draw.io

Busca no repositório inteiro: as únicas ocorrências relevantes de "legend" são
(a) rótulos legados em `shapes/er/mxER.js` e (b) **uma** entrada de biblioteca no C4:
`js/diagramly/sidebar/Sidebar-C4.js`, `this.addDataEntry(dt + 'legend', 180, 210, 'Legend', ...)`.
`Sidebar-AWS4.js` tem **zero** ocorrências. Não há shape genérico de legenda.

### 6.2 A convenção do produto: legenda é uma tabela de células comuns

Descomprimindo a entrada `Legend` do C4, a estrutura é:

```xml
<mxCell id="2" value="Legend"
  style="shape=table;startSize=30;container=1;collapsible=0;childLayout=tableLayout;fontSize=16;align=left;verticalAlign=top;fillColor=none;strokeColor=none;fontColor=#4D4D4D;fontStyle=1;spacingLeft=6;spacing=0;resizable=0;"
  vertex="1" parent="1">
  <mxGeometry width="180" height="210" as="geometry"/>
</mxCell>
<mxCell id="3" value=""
  style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;strokeColor=inherit;top=0;left=0;bottom=0;right=0;collapsible=0;dropTarget=0;fillColor=none;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontSize=12;"
  vertex="1" parent="2">
  <mxGeometry y="30" width="180" height="30" as="geometry"/>
</mxCell>
<mxCell id="4" value="Person"
  style="shape=partialRectangle;html=1;whiteSpace=wrap;connectable=0;strokeColor=inherit;overflow=hidden;fillColor=#083F75;top=0;left=0;bottom=0;right=0;pointerEvents=1;fontSize=12;align=left;fontColor=#FFFFFF;gradientColor=none;spacingLeft=10;spacingRight=4;"
  vertex="1" parent="3">
  <mxGeometry width="180" height="30" as="geometry">
    <mxRectangle width="180" height="30" as="alternateBounds"/>
  </mxGeometry>
</mxCell>
```

Padrão: `shape=table` + `childLayout=tableLayout` como container, uma
`shape=tableRow` por item, uma `shape=partialRectangle` com a cor da categoria.

### 6.3 Título e legenda nos templates AWS oficiais

Nos 10 templates de `templates/cloud/aws/`, o padrão é consistente e literal:

| Elemento | Style string literal |
|---|---|
| Título | `text;html=1;resizable=0;points=[];autosize=1;align=left;verticalAlign=top;spacingTop=-4;fontSize=30;fontStyle=1` |
| Subtítulo | `text;html=1;resizable=0;points=[];autosize=1;align=left;verticalAlign=top;spacingTop=-4;fontSize=16;` |
| Rótulo de seção | `text;html=1;resizable=0;points=[];autosize=1;align=left;verticalAlign=top;spacingTop=-4;fontSize=16;fontStyle=1` |
| Marcador numerado (legenda de passos) | `rounded=1;whiteSpace=wrap;html=1;fillColor=#007CBD;strokeColor=none;fontColor=#FFFFFF;fontStyle=1;fontSize=22;labelBackgroundColor=none;` |
| Bloco de texto da legenda | `text;html=1;align=left;verticalAlign=top;spacingTop=-4;fontSize=14;labelBackgroundColor=none;whiteSpace=wrap;` |

Ou seja: a "legenda" dos diagramas AWS oficiais do produto é uma **lista numerada de
passos** (círculo azul `#007CBD` + parágrafo), não uma tabela de cores. E o título é
apenas um shape `text;` no canto superior esquerdo — não há suporte de "título de
página" no formato.

A doc de boas práticas (S12) recomenda incluir legenda quando há codificação por cor,
mas não prescreve forma.

---

## 7. Onde um tema deve morar

Existem quatro níveis. Só um deles viaja no arquivo.

### Nível A — folha de estilo `mxStylesheet` do app

`styles/default.xml`, `styles/default-old.xml`, `styles/dark-default.xml` são
`<mxStylesheet>` completos, carregados por `Graph.prototype.loadStylesheet`. O arquivo
`.drawio` guarda apenas o **nome**:

```js
// js/diagramly/Editor.js — getGraphXml
if (this.graph.currentStyle != null && this.graph.currentStyle != 'default-style2')
{
    node.setAttribute('style', this.graph.currentStyle);
}
```

e na leitura resolve contra `this.graph.themes[style]` ou `STYLE_PATH + '/' + style + '.xml'`.
**O conteúdo da folha não viaja.** Um nome que o app do leitor não conheça não resolve em
nada. Não existe `<mxStylesheet>` embutido no `.drawio` — `mxCodec.allowlist` inclui
`'mxStylesheet'`, mas `Editor.setGraphXml` decodifica somente o `<mxGraphModel>`.

### Nível B — `defaultVertexStyle` / `defaultEdgeStyle` (configuração do app)

São propriedades de `Graph.prototype`, populadas pela configuração do draw.io (S10,
chaves `defaultVertexStyle`, `defaultEdgeStyle`, `defaultTextStyle`, `defaultFonts`,
`customFonts`):

```js
// js/diagramly/Editor.js
if (config.defaultVertexStyle != null)
{
    Graph.prototype.defaultVertexStyle = config.defaultVertexStyle;
}
```

Pior: quando **não** configuradas, o próprio app as sobrescreve conforme o tema do
editor do leitor (`js/diagramly/EditorUi.js`):

```js
if (Editor.currentTheme == 'sketch')
{
    setStyle(graph.defaultEdgeStyle, 'edgeStyle', 'none');
    setStyle(graph.defaultEdgeStyle, 'curved', '1');
    ...
}
```

Isso só afeta formas **novas** criadas no app, na máquina de quem tem a configuração.
Não vai para o arquivo. Inútil para um gerador.

### Nível C — `currentVertexStyle` / `currentEdgeStyle` (sessão)

Estado da sessão do editor (o "Set as Default Style" da UI). Clonado de B em
`Graph` constructor. Também não vai para o arquivo.

### Nível D — style string por célula

**A única coisa que viaja no `.drawio` e é o que o renderizador lê.** A allowlist de
chaves conhecidas é `Graph.cellStyles` (`js/grapheditor/Graph.js`), composta por
`Graph.textStyles` + `Graph.edgeStyles` + `Graph.cellStyleGroups` + a lista base
(`rounded, shadow, glass, dashed, dashPattern, comic, sketch, fillWeight, hachureGap,
hachureAngle, jiggle, ..., strokeColor, strokeWidth, align, verticalAlign, spacing*,
arcSize, absoluteArcSize, comicStyle, swimlaneFillColor, shadow*`).

### Nível D' — atributos de diagrama no `<mxGraphModel>`

`background`, `backgroundImage`, `math`, `shadow`, `adaptiveColors`, `extFonts`,
`pageWidth`/`pageHeight`/`pageScale`, `grid`/`gridSize`. **Viajam.** É onde mora o tema
"de página".

### Qual sobrevive à edição manual no app?

**Nível D sobrevive bem.** O Format panel edita **chave a chave** via
`graph.setCellStyles(<chave>, <valor>, cells)` / `graph.updateCellStyles({...})` — as
chaves não tocadas permanecem na string. Exemplos literais do painel:

```js
graph.setCellStyles('jumpStyle', styleSelect.value, ss.cells);
graph.updateCellStyles({'sketch': (enabled) ? '1' : null,
    'curveFitting': ..., 'jiggle': ...}, cells);
```

Os riscos reais de perda:

1. **Trocar a forma** (Edit Shape / arrastar outro shape) reescreve a string inteira.
2. **Copy/Paste Style** substitui grupos inteiros: `Graph.cellStyleGroups` faz
   `['fillColor','gradientColor','gradientDirection']`, `['startArrow','startFill','endArrow','endFill']`,
   `['startSize','endSize']` e `['sourcePerimeterSpacing','targetPerimeterSpacing']`
   serem tratados como blocos atômicos ("if one appears all are ignored").
3. **Edit Style** manual (`Ctrl+E`) — o usuário reescreve tudo à mão (S3).

**Conclusão para o gerador:** materialize o tema como style string completa por célula
(nível D), mais os atributos de diagrama (nível D'). Nunca conte com A, B ou C — eles
dependem da instalação e do tema do editor do leitor.

---

## 8. Tabela final — o que expor ao usuário

Legenda de "Sobrevive ao export?": **SVG** / **PNG** / **HTML** (export como página com
viewer). "—" = não se aplica.

| Opção | O que faz | Sobrevive ao export? | Expor ao usuário? |
|---|---|---|---|
| `background` (atributo `<mxGraphModel>`) | cor de fundo da página gravada no arquivo | SVG ✅ · PNG ✅ · HTML ✅ | **Sim.** É a única forma determinística de "diagrama escuro". Sem ele, o export não-transparente cai num `light-dark()` que muda por leitor. |
| Dark mode do app | filtro CSS local (S7) | ❌ nada | **Não.** Não é dado; o gerador não tem como setá-lo. |
| `adaptiveColors` (`auto`/`simple`/`none`) | como cores `default`/`light-dark()` resolvem | parcialmente (o export com Appearance fixa congela) | **Não** por padrão; exponha só como `none` implícito, emitindo hex explícito em toda célula. |
| `fillColor=light-dark(claro, escuro)` | cor dupla claro/escuro gravada na célula | SVG ✅ (resolve no viewer) · PNG resolve no momento do export | **Não** para AWS. Faz o mesmo arquivo renderizar diferente em duas máquinas; conflita com as cores oficiais AWS. |
| `math` | typesetting LaTeX nos rótulos | SVG ✅ · PNG ✅ | **Não.** Só faz sentido se o gerador emitir LaTeX; caso contrário é custo puro. |
| `flowAnimation=1` (+`flowAnimationDuration/TimingFunction/Direction`) | tracejado em movimento na aresta | SVG ✅ (`@keyframes` em `<defs>`) · HTML ✅ (GraphViewer liga sempre) · PNG ❌ · PDF ❌ | **Sim, opt-in e escopado.** Ótimo para marcar 1–2 fluxos "quentes"; use `flowAnimationDuration` para controlar velocidade. Avise que a aresta vira tracejada e que PNG/PDF ficam estáticos. |
| `sketch=1` | render rough.js (hand-drawn) | SVG ✅ · PNG ✅ | **Não.** Jittera o glifo do ícone AWS (o `RoughCanvas` intercepta as primitivas usadas por `mxStencil`). A paleta AWS4 oficial força `sketch=0` em 56/56 entradas. |
| `comic=1` / `sketchStyle=comic` | HandJiggle | SVG ✅ · PNG ✅ | **Não.** Mesmo problema, pior acabamento. |
| `rounded=1` (vértice) | cantos arredondados | SVG ✅ · PNG ✅ | **Não** para shapes AWS4 (no-op silencioso: não estão em `roundableShapes` e `mxStencil` ignora). **Sim** para caixas/grupos genéricos. |
| `rounded=1` (aresta) | suaviza as dobras ortogonais | SVG ✅ · PNG ✅ | **Sim.** Barato, sem risco, muda bastante o "tom" do diagrama. |
| `shadow=1` (por célula) | sombra no shape | SVG ✅ · PNG ✅ | **Talvez.** Só o quadrado externo recebe sombra (o stencil interno tem `setShadow(false)`), e a opção é desabilitada no Safari. Prefira o global. |
| `shadow="1"` (`<mxGraphModel>`) | sombra global via filtro SVG | SVG ✅ · PNG ✅ | **Sim**, como flag booleana única do tema. Resultado uniforme. |
| `glass=1` | brilho "vidro" | — | **Não.** No-op silencioso em AWS4 (`paintGlassEffect` só é chamado por rect/rhombus/ellipse). Expor gera bug report. |
| `gradientColor` + `gradientDirection` (`north/south/east/west/radial`) | gradiente no fill | SVG ✅ · PNG ✅ | **Talvez.** Tecnicamente compatível (a própria paleta AWS4 usa), mas foge da paleta chapada oficial da AWS. Exponha no máximo como preset de tema, nunca por serviço. |
| `fontFamily` (lista `Menus.defaultFonts`) | fonte dos rótulos | SVG ✅ · PNG ✅ | **Sim**, restrito às nove seguras: Helvetica, Verdana, Times New Roman, Garamond, Comic Sans MS, Courier New, Georgia, Lucida Console, Tahoma. |
| `fontFamily` + `fontSource` + `extFonts` (fonte web) | fonte customizada | SVG ✅ só com *Embed Fonts* · PNG ❌ (precisa da fonte no servidor de export) | **Não.** Risco alto de o export sair com fonte errada (S13). |
| `fontSize` | tamanho do rótulo | SVG ✅ · PNG ✅ | **Sim.** Um par `fontSize` de nó (default 12) e de aresta (default 11) já dá densidade ajustável. |
| `fontColor` | cor do rótulo | SVG ✅ · PNG ✅ | **Sim.** Obrigatório junto com fundo escuro (o default AWS `#232F3E` some em fundo escuro). |
| `fontStyle` (bitmask 1/2/4/8) | bold/italic/underline/strike | SVG ✅ · PNG ✅ | **Sim**, mas restrito: bold (`1`) para títulos/grupos. AWS4 usa `fontStyle=0` nos ícones. |
| `labelPosition` / `verticalLabelPosition` | posição da caixa do rótulo | SVG ✅ · PNG ✅ | **Sim.** É a alavanca central para ícone AWS: `verticalLabelPosition=bottom;verticalAlign=top` (rótulo abaixo) vs. `labelPosition=right;align=left` (rótulo à direita, layouts densos). |
| `labelBackgroundColor` | fundo do rótulo | SVG ✅ · PNG ✅ | **Sim**, útil para rótulo de aresta sobre linhas. Emitir `none` explícito evita a herança `default` (que é `light-dark(...)`). |
| `spacing*` | folga do rótulo | SVG ✅ · PNG ✅ | **Não** como opção de usuário; é detalhe interno (`spacingLeft=30` nos grupos AWS4, `spacingTop=25` no groupCenter). Deve ser fixo pelo gerador. |
| `edgeStyle` (`orthogonalEdgeStyle` / `elbowEdgeStyle` / `entityRelationEdgeStyle` / `isometricEdgeStyle` / `none`) | roteamento | SVG ✅ · PNG ✅ | **Sim**, mas restrito a `orthogonalEdgeStyle` (default AWS) e `none` (reto). Elbow/entityRelation/isometric não fazem sentido em arquitetura AWS. |
| `libavoidRouting=1` | roteamento com desvio de obstáculos | ❌ depende de `extensions.min.js` no app do leitor | **Não.** Dependência opcional do app; se ausente, a aresta vira ortogonal comum. |
| `curved=1` | aresta curva | SVG ✅ · PNG ✅ | **Talvez.** Desliga `jumpStyle`. Exponha como escolha exclusiva com "line jumps", nunca as duas. |
| `jumpStyle` (`arc`/`gap`/`sharp`/`line`) + `jumpSize` (default 6) | salto no cruzamento | SVG ✅ · PNG ✅ | **Sim.** Ganho de legibilidade alto em diagramas densos, custo zero. Default sugerido: `arc`. |
| `startArrow` / `endArrow` / `*Fill` / `*Size` | marcadores | SVG ✅ · PNG ✅ | **Sim**, como preset de tema (ex.: templates AWS usam `endArrow=open;endFill=0`), não por aresta. |
| `dashed` + `dashPattern` | traço | SVG ✅ · PNG ✅ | **Sim**, mas como **semântica**, não estética: os grupos AWS4 já usam `dashed=1` para Region/Auto Scaling. Expor livremente conflita com a convenção. |
| Rótulo de aresta (`edgeLabel` filho + `mxGeometry relative="1"`) | texto na aresta com posição | SVG ✅ · PNG ✅ | **Sim.** Exponha `label` + posição (`x` ∈ [-1,1]). É a forma correta; `value` direto na aresta não dá controle. |
| Título (`text;...fontSize=30;fontStyle=1`) | título do diagrama | SVG ✅ · PNG ✅ | **Sim.** Convenção do próprio produto nos templates AWS. Barato e de alto valor. |
| Legenda (tabela `shape=table` + `tableRow` + `partialRectangle`, ou lista numerada) | legenda | SVG ✅ · PNG ✅ | **Sim**, como flag `legend: true` gerando células. Não existe shape pronto — o gerador tem que montar. |
| `style="<nome>"` no `<mxGraphModel>` | folha de estilo do app por nome | ❌ conteúdo não viaja | **Não.** Só resolve nomes embutidos (`default`, `default-old`, `dark-default`); o leitor pode não ter. |
| `defaultVertexStyle` / `defaultEdgeStyle` | defaults de formas novas | ❌ não vai para o arquivo | **Não.** É configuração do app; o tema do editor do leitor sobrescreve. |

---

## 9. Incertezas

1. **`flowAnimation` em export SVG feito pelo usuário com animações desligadas.** O
   código (`getSvg`, via `origEnabledFlowAnimation`) indica que o SVG sai estático se
   *View > Animations* estiver desligado. S6 fala de "exported link", não de arquivo SVG,
   então doc e código não se contradizem — mas **não validei isso empiricamente** num
   export real. O serviço headless (`js/export.js`) liga incondicionalmente, então
   exports pelo servidor não têm o problema.

2. **PNG/PDF e animação.** Afirmo que não animam por construção (raster de um frame /
   render estático). Isso decorre de `canvas.toDataURL(...)`, não de uma afirmação
   explícita da documentação. Não achei doc oficial dizendo isso literalmente.

3. **Suporte a `light-dark()` em viewers antigos.** O código tem guardas explícitas
   (`@supports (color: light-dark(#000, #fff))`, comentários citando "Firefox ESR 115").
   Não mapeei a matriz completa de fallback — só sei que existe fallback e que ele muda o
   resultado. Isso reforça a recomendação de não usar `light-dark()` num gerador.

4. **`shape=table` / `childLayout=tableLayout` para legenda.** Extraí a estrutura da
   entrada `Legend` do C4 (fonte do produto), mas **não há documentação normativa**
   dizendo que essa é "a" convenção de legenda do draw.io. É a única implementação
   pronta que o produto oferece; não é um padrão declarado.

5. **`aws4.xml` (os stencils).** Não abri o XML dos ~700 stencils individualmente —
   trabalhei com `shapes/mxAWS4.js` (as cinco formas JS) e com as style strings de
   `Sidebar-AWS4.js`. Se algum stencil específico tiver comportamento próprio de
   `fillColor`/`strokeColor` fora do padrão, não seria visível na minha análise.

6. **Chave `styles` da configuração (S10).** A doc lista uma chave `styles` entre as
   configurações de "Default Styles". Não localizei onde ela é consumida no código
   (`Editor.configure`) dentro do tempo desta pesquisa. Provavelmente alimenta a grade de
   presets da aba *Style* do Format panel, mas **não confirmei**.

7. **Fonte `Helvetica` no serviço de export.** O produto usa `Helvetica` como default e
   a lista `defaultFonts` como "seguras", mas **não achei uma declaração oficial** de
   quais fontes estão instaladas no renderizador do serviço de export. `export-fonts.css`
   existe no repositório mas está vazio no branch `dev` (0 bytes), sugerindo que é
   gerado no build. Tratei a lista `Menus.defaultFonts` como proxy de "seguras".

8. **`Editor.enableShadowOption = !mxClient.IS_SF`.** Li isso como "opção de sombra por
   célula desabilitada no Safari". Não testei se o style `shadow=1` já presente no
   arquivo ainda **renderiza** no Safari — o flag desabilita o checkbox da UI, o que é
   diferente de desabilitar o render.
