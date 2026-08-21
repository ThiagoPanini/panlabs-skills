# Catálogo de shapes AWS no draw.io — nomes canônicos e escolha programática

> **Pergunta de pesquisa:** quais são os nomes canônicos de shape AWS disponíveis no
> draw.io, e como escolher o certo programaticamente?
>
> **Data da pesquisa:** 2026-08-21
> **Versão do draw.io analisada:** `31.3.1` (`ChangeLog`: `15-AUG-2026: 31.3.1`)
> **Commit inspecionado:** `d3140c3105c7fe8fb47259f6283e7ef566c647c6` (`jgraph/drawio`, branch padrão, 2026-08-20)
>
> Documento irmão: [`aws-diagramming-conventions.md`](./aws-diagramming-conventions.md)
> — este aqui é o *como codificar no draw.io*; aquele é o *o que a AWS prescreve*.

---

## Fontes primárias usadas

Toda afirmação vem de uma destas fontes. **Nenhum write-up de terceiro foi usado como
autoridade.** Blog posts e docs do próprio fornecedor (drawio.com) contam como primários,
mas só foram usados onde o código não responde.

| # | Fonte | Caminho / URL |
|---|---|---|
| D1 | Paletas AWS 2019+ (a atual) | `src/main/webapp/js/diagramly/sidebar/Sidebar-AWS4.js` (235 KB) |
| D2 | Paletas AWS 2018 (legacy) | `src/main/webapp/js/diagramly/sidebar/Sidebar-AWS4b.js` (88 KB) |
| D3 | Paletas AWS 2017 (legacy) | `src/main/webapp/js/diagramly/sidebar/Sidebar-AWS3.js` (85 KB) |
| D4 | Paletas AWS v1/v2 (legacy) | `src/main/webapp/js/diagramly/sidebar/Sidebar-AWS.js` (57 KB) |
| D5 | Paletas AWS 3D / isométrico | `src/main/webapp/js/diagramly/sidebar/Sidebar-AWS3D.js` (16 KB) |
| D6 | Implementação das classes de shape | `src/main/webapp/shapes/mxAWS4.js` |
| D7 | Stencils (geometria dos glifos) | `src/main/webapp/stencils/aws4.xml` (6,5 MB, 1037 shapes) |
| D8 | Registro de bibliotecas / lazy loading | `src/main/webapp/js/diagramly/Editor.js` (~linha 11897) |
| D9 | Metadados de biblioteca + rótulos da UI | `src/main/webapp/js/diagramly/sidebar/Sidebar.js` (linhas 75–95, 500–530, 1940–1975) |
| D10 | Normalização de nome de stencil + lazy load | `src/main/webapp/js/grapheditor/Graph.js` (linhas 16854–17100) |
| D11 | Mapa nome→style do importador Lucidchart/Gliffy | `src/main/webapp/js/diagramly/Extensions.js` (linhas ~3160–3430) |
| D12 | Histórico de releases | `ChangeLog` (raiz do repo) |
| F1 | Página oficial AWS Architecture Icons | <https://aws.amazon.com/architecture/icons/> |
| F4 | Pacote oficial de assets AWS | `Icon-package_07312026.zip` (baixado 2026-08-21) |
| W1 | Doc oficial draw.io sobre diagramas AWS | <https://www.drawio.com/docs/diagram-types/aws-diagrams/> |

**Método de obtenção do repo (reprodutível):**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/jgraph/drawio.git /tmp/drawio
cd /tmp/drawio
git sparse-checkout set src/main/webapp/js/diagramly src/main/webapp/stencils \
                        src/main/webapp/shapes src/main/webapp/js/grapheditor
git log -1 --format='%H %cI %s'
# -> d3140c3105c7fe8fb47259f6283e7ef566c647c6 2026-08-20T12:32:41+01:00 31.3.1 release
```

---

## 1. Famílias de stencil — o que existe e qual é a atual

### 1.1 O mapa completo

Cinco famílias `mxgraph.aws*` são registradas. Os pacotes de stencil vêm de D8
(`mxStencilRegistry.libraries`) e do diretório `src/main/webapp/stencils/`:

| Prefixo de shape | Arquivo de stencil | Nº de shapes | Paleta (arquivo) | Rótulo no "More Shapes" | Status |
|---|---|---|---|---|---|
| `mxgraph.aws.*` | `stencils/aws/*.xml` (11 arquivos) | — | D4 | `AWS` (via `aws2`/`aws`) | obsoleto (deck ~2013) |
| `mxgraph.aws2.*` | `stencils/aws2/*.xml` (16 arquivos) | — | D4 | idem | obsoleto (deck ~2015) |
| `mxgraph.aws3.*` | `stencils/aws3.xml` | **293** | D3 | **`AWS17`** | superseded |
| `mxgraph.aws3d.*` | `stencils/aws3d.xml` | **16** | D5 | `AWS 3D` | nicho (isométrico) |
| `mxgraph.aws4.*` | `stencils/aws4.xml` | **1037** | D1 (atual) + D2 (AWS18) | **`AWS <ano corrente>`** e `AWS18` | **ATUAL** |

Verificação da contagem de stencils:

```bash
grep -o '<shape [^>]*name="[^"]*"' src/main/webapp/stencils/aws4.xml | wc -l   # 1037
grep -o '<shape [^>]*name="[^"]*"' src/main/webapp/stencils/aws3.xml | wc -l   # 293
```

### 1.2 O detalhe que confunde: `aws4` e `aws4b` compartilham o MESMO stencil

D8, linhas 11898–11899, literal:

```js
mxStencilRegistry.libraries['aws4']  = [SHAPES_PATH + '/mxAWS4.js', STENCIL_PATH + '/aws4.xml'];
mxStencilRegistry.libraries['aws4b'] = [SHAPES_PATH + '/mxAWS4.js', STENCIL_PATH + '/aws4.xml'];
```

`aws4b` **não é outra família de stencil** — é a mesma `mxgraph.aws4.*` renderizada com
outra classe de shape e outro preset de cor, para reproduzir o visual do deck AWS de 2018.
Não existe prefixo `mxgraph.aws4b.*`. Se você vir `aws4b` em algum lugar, é um *id de
biblioteca da sidebar*, não um namespace de shape.

### 1.3 Qual é a recomendada — evidência no código

Três sinais independentes em D9 dizem que `aws4` (via `Sidebar-AWS4.js`) é a atual:

1. **Rótulo dinâmico da UI** (D9, ~linha 527):

   ```js
   var year = new Date().getFullYear();
   ...
   {title: 'AWS17', id: 'aws3',  image: IMAGE_PATH + '/sidebar-aws3.png'},
   {title: 'AWS18', id: 'aws4b', image: IMAGE_PATH + '/sidebar-aws4b.png'},
   {title: 'AWS ' + year, id: 'aws4', image: IMAGE_PATH + '/sidebar-aws4.png'},
   ```

   > ⚠️ **Armadilha de design.** O rótulo "AWS 2026" na UI vem de
   > `new Date().getFullYear()` — **não** de nenhuma versão de deck. Ele vai virar
   > "AWS 2027" em 1º de janeiro sem que um único ícone mude. Nunca trate esse rótulo
   > como indicador de atualidade do catálogo. Ver §6.

2. **Exclusão explícita de sugestão** (D9, linha 1948), com o comentário do próprio autor:

   ```js
   /**
    * More Shapes entries that are never offered as chips - superseded
    * versions where only the latest library of a family should be suggested
    */
   Sidebar.prototype.libraryChipExcluded = ['uml', 'aws3', 'aws4b', 'cisco', ...];
   ```

3. **Peso de busca negativo** (D9, linha 1960), comentário literal:
   *"on equal search scores, shapes from the latest library of a family rank above the
   ones from its predecessors (eg. `aws` lists AWS 2026 shapes before AWS18 and AWS17)"*

   ```js
   Sidebar.prototype.librarySearchWeights = {aws3: -2, aws4b: -1, ...};
   ```

**Decisão:** gere sempre `mxgraph.aws4.*` com a classe `resourceIcon`. `aws3`/`aws4b`
só para reproduzir um diagrama legado existente.

---

## 2. Service Icon vs Resource Icon vs Product Icon

### 2.1 A taxonomia da AWS (F4) — verificada no pacote oficial

A estrutura de diretórios de `Icon-package_07312026.zip` **é** a taxonomia:

```
Architecture-Service-Icons_07312026/   -> 303 ícones (quadrado colorido, glifo branco)
Resource-Icons_07312026/               -> 513 ícones (glifo plano, sem quadrado)
Architecture-Group-Icons_07312026/     ->  15 ícones (marca de canto de container)
Category-Icons_07312026/               ->   4 tamanhos (16/32/48/64)
```

**"Product Icon" não existe na taxonomia atual da AWS.** É o termo do deck de 2018,
onde os quadrados tinham gradiente e borda. A AWS renomeou para "Service Icon" no deck
de 2019. O nome sobrevive apenas dentro do draw.io.

### 2.2 A taxonomia do draw.io (D6) — as cinco classes de shape

D6 registra exatamente cinco classes (`grep -n "mxCellRenderer.registerShape" shapes/mxAWS4.js`):

| Classe | Chave de style que aponta o glifo | Corresponde a | Usada em |
|---|---|---|---|
| `mxgraph.aws4.resourceIcon` | `resIcon=` | **AWS Service Icon** | D1 (`aws4`), 403 entradas |
| `mxgraph.aws4.productIcon` | `prIcon=` | AWS 2018 "Product Icon" | D2 (`aws4b`), 142 entradas |
| `mxgraph.aws4.group` | `grIcon=` | AWS Group Icon (ícone no canto sup. esq.) | 15 entradas em D1 |
| `mxgraph.aws4.groupCenter` | `grIcon=` | Group Icon centralizado no topo | 1 entrada em D1 (Auto Scaling) |
| `mxgraph.aws4.group2` | `grIcon=` | variante com quadrado sólido no canto | **registrada mas não usada** por nenhuma paleta |

> **O nome `resourceIcon` é um falso amigo.** No draw.io, `shape=mxgraph.aws4.resourceIcon`
> desenha o **Service Icon** da AWS (quadrado colorido). O que a AWS chama de *Resource
> Icon* (glifo plano) no draw.io **não usa classe de shape nenhuma** — é o stencil
> desenhado direto (`shape=mxgraph.aws4.<nome>`). Errar isso é a causa mais provável de
> um diagrama gerado sair com o visual errado.

### 2.3 O que cada classe realmente pinta (D6, `paintVertexShape`)

**`resourceIcon`** — o quadrado é preenchido com `fillColor`; o glifo é pintado com
**`strokeColor`** (não com `fontColor`), com inset de 10% de cada lado:

```js
c.begin(); c.moveTo(0,0); c.lineTo(w,0); c.lineTo(w,h); c.lineTo(0,h); c.close(); c.fill();
var prIcon = mxUtils.getValue(this.state.style, 'resIcon', '');
var stencil = mxStencilRegistry.getStencil(prIcon);
if (stencil != null) {
    var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
    c.setFillColor(strokeColor);           // <-- strokeColor pinta o GLIFO
    c.setStrokeColor('none');
    stencil.drawShape(c, this, w*0.1, h*0.1, w*0.8, h*0.8);
}
```

Consequência prática: **`strokeColor=#ffffff` não é decoração, é obrigatório.** Sem ele o
glifo sai preto sobre o quadrado colorido.

**`productIcon`** — pinta a borda com `strokeColor`, o interior com
`fillColor`/`gradientColor` (`gradientDirection`), e o glifo também com `strokeColor`,
com inset de 15%. É o visual 2018 (branco com borda colorida).

**`group` / `groupCenter`** — pintam o retângulo e desenham o `grIcon` em `strokeColor`
num quadrado de `grIconSize` px (default **25**). `grStroke=0` suprime o traço da borda
(só preenche). `groupCenter` centraliza o ícone horizontalmente no topo.

### 2.4 Quando usar cada um

| Situação | Use |
|---|---|
| Representar um **serviço AWS** (Lambda, S3, RDS…) | `resourceIcon` + `resIcon=` |
| Representar um **recurso dentro de um serviço** (bucket S3, tabela DynamoDB, instância EC2 tipo `c6g`) | stencil direto: `shape=mxgraph.aws4.<nome>;fillColor=<cor da categoria>;strokeColor=none;aspect=fixed;` |
| Representar um **container lógico** (VPC, Region, subnet…) | `group` / `groupCenter` + `grIcon=` |
| Reproduzir um diagrama legado de 2018 | `productIcon` + `prIcon=` |
| Qualquer coisa nova | **nunca** `productIcon`, **nunca** `group2` |

Exemplos literais de *resource icon* plano (extraídos de D1):

```
[Compute] Trainium Instance (48×48)
sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#ED7100;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;pointerEvents=1;shape=mxgraph.aws4.trainium_instance;

[Storage] S3 Tables (78×78)
sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#7AA116;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;pointerEvents=1;shape=mxgraph.aws4.s3_tables;
```

Repare: **`strokeColor=none`** aqui (o glifo usa `fillColor`), o oposto do `resourceIcon`.

---

## 3. Shapes de grupo

### 3.1 As duas formas de expressar um grupo no draw.io

1. **Com ícone de canto** → `shape=mxgraph.aws4.group` (ou `groupCenter`) + `grIcon=`.
2. **Sem ícone** → retângulo puro, sem `shape=` nenhum, só cor/traço.

A paleta `AWS / Groups` de D1 tem **20 entradas**: 15 usam `group`, 1 usa `groupCenter`,
e 4 são retângulos puros (Availability Zone, Security group, e duas variantes de
Generic group).

### 3.2 Prefixo comum

Todos os grupos com ícone compartilham o mesmo prefixo (variável `n4` em
`addAWS4GroupsPalette`, D1 linha 263). Nas tabelas abaixo ele é abreviado como `${GRP}`:

```
${GRP} =
points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;
```

> Note que `${GRP}` **não** contém `sketch=0` — ao contrário do prefixo dos ícones de
> serviço. É assim no código-fonte (a variável `pts` usada aqui é a crua, sem `sketch=0`).
> Tamanho default de todos: **130×130**.

### 3.3 Tabela completa — style strings literais, verbatim de D1

| Grupo | Style string |
|---|---|
| **AWS Cloud** (variante *alt*, a primeira da paleta) | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;` |
| **AWS Cloud** (logo) | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;` |
| **Region** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_region;strokeColor=#00A4A6;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#147EBA;dashed=1;` |
| **Availability Zone** | `fillColor=none;strokeColor=#147EBA;dashed=1;verticalAlign=top;fontStyle=0;fontColor=#147EBA;whiteSpace=wrap;html=1;` |
| **Security group** | `fillColor=none;strokeColor=#DD3522;verticalAlign=top;fontStyle=0;fontColor=#DD3522;whiteSpace=wrap;html=1;` |
| **Auto Scaling group** | `${GRP}shape=mxgraph.aws4.groupCenter;grIcon=mxgraph.aws4.group_auto_scaling_group;grStroke=1;strokeColor=#D86613;fillColor=none;verticalAlign=top;align=center;fontColor=#D86613;dashed=1;spacingTop=25;` |
| **VPC** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;` |
| **Private subnet** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#00A4A6;fillColor=#E6F6F7;verticalAlign=top;align=left;spacingLeft=30;fontColor=#147EBA;dashed=0;` |
| **Public subnet** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#7AA116;fillColor=#F2F6E8;verticalAlign=top;align=left;spacingLeft=30;fontColor=#248814;dashed=0;` |
| **Server contents** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_on_premise;strokeColor=#7D8998;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#5A6C86;dashed=0;` |
| **Corporate data center** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_corporate_data_center;strokeColor=#7D8998;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#5A6C86;dashed=0;` |
| **Elastic Beanstalk container** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_elastic_beanstalk;strokeColor=#D86613;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#D86613;dashed=0;` |
| **EC2 instance contents** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_ec2_instance_contents;strokeColor=#D86613;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#D86613;dashed=0;` |
| **Spot Fleet** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_spot_fleet;strokeColor=#D86613;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#D86613;dashed=0;` |
| **AWS Step Functions workflow** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_step_functions_workflow;strokeColor=#CD2264;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#CD2264;dashed=0;` |
| **AWS Account** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_account;strokeColor=#CD2264;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#CD2264;dashed=0;` |
| **AWS IoT Greengrass Deployment** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_iot_greengrass_deployment;strokeColor=#7AA116;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#3F8624;dashed=0;` |
| **AWS IoT Greengrass** | `${GRP}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_iot_greengrass;strokeColor=#7AA116;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#3F8624;dashed=0;` |
| **Generic group** (tracejado) | `fillColor=none;strokeColor=#5A6C86;dashed=1;verticalAlign=top;fontStyle=0;fontColor=#5A6C86;whiteSpace=wrap;html=1;` |
| **Generic group** (sólido) | `fillColor=#EFF0F3;strokeColor=none;dashed=0;verticalAlign=top;fontStyle=0;fontColor=#232F3D;whiteSpace=wrap;html=1;` |

**Exemplo totalmente expandido** (AWS Cloud, sem abreviação — cole isto no XML e funciona):

```
points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;
```

### 3.4 ⚠️ As cores de grupo do draw.io estão DESATUALIZADAS

Extraí as cores oficiais direto dos SVGs de `Architecture-Group-Icons_07312026/` (F4) e
comparei com D1. **A cor de preenchimento dos ícones de serviço bate 100% com a AWS; a
cor de borda dos grupos, não.** Várias ainda usam a paleta AWS pré-2022.

| Grupo | AWS Q3-2026 (F4, verificado no SVG) | draw.io 31.3.1 (`strokeColor`) | Bate? |
|---|---|---|---|
| AWS Cloud | `#242F3E` | `#232F3E` | ~ (1 dígito) |
| Region | `#00A4A6` | `#00A4A6` | ✅ |
| VPC | `#8C4FFF` | `#8C4FFF` | ✅ |
| Private subnet | `#00A4A6` | `#00A4A6` | ✅ |
| Public subnet | `#7AA116` | `#7AA116` | ✅ |
| Corporate data center | `#7D8998` | `#7D8998` | ✅ |
| Server contents | `#7D8998` | `#7D8998` | ✅ |
| IoT Greengrass (Deployment) | `#7AA116` | `#7AA116` | ✅ |
| **Availability Zone** | `#00A4A6` (sem ícone no deck) | `#147EBA` | ❌ **cor antiga** |
| **Security group** | `#DD344C` (sem ícone no deck) | `#DD3522` | ❌ **cor antiga** |
| **Auto Scaling group** | `#ED7100` | `#D86613` | ❌ **cor antiga** |
| **EC2 instance contents** | `#ED7100` | `#D86613` | ❌ **cor antiga** |
| **Spot Fleet** | `#ED7100` | `#D86613` | ❌ **cor antiga** |
| **Elastic Beanstalk container** | `#ED7100` | `#D86613` | ❌ **cor antiga** |
| **AWS Account** | `#E7157B` | `#CD2264` | ❌ **cor antiga** |
| **Step Functions workflow** | `#E7157B` | `#CD2264` | ❌ **cor antiga** |

Além disso, `fontColor` diverge de `strokeColor` em vários grupos (Region: borda
`#00A4A6`, texto `#147EBA`; VPC: borda `#8C4FFF`, texto cinza `#AAB7B8`), enquanto no deck
oficial o rótulo é preto/branco de 12 pt.

**Decisão:** se o objetivo é fidelidade ao deck AWS atual, **não copie a style da sidebar
verbatim** — copie a estrutura (`shape`, `grIcon`, `dashed`, `align`, `spacingLeft`) e
sobrescreva `strokeColor`/`fontColor` com a cor oficial. As style strings da tabela §3.3
são o que o draw.io *entrega*, não o que a AWS *prescreve*.

### 3.5 Availability Zone e Security group não são containers

Ambos saem da paleta como retângulos puros, **sem `container=1`**. Em D10
(`Graph.prototype.isContainer`, linha 12436) `container == '1'` é condição necessária,
e `isValidDropTarget` (linha 18519) cai no default do mxGraph, que rejeita retângulo vazio.
Resultado: soltar um shape em cima não o aninha.

O próprio draw.io corrige isso no importador Lucidchart (D11, linha 3391):

```js
var containerStyle = 'container=1;pointerEvents=0;collapsible=0;recursiveResize=0;';
...
'AvailabilityZoneAWS19' : 'verticalAlign=top;fillColor=none;dashed=1;dashPattern=5 5;fontColor=#0E82B8;strokeOpacity=100;strokeColor=#147eba;' + containerStyle,
'SecuritygroupAWS19'    : 'verticalAlign=top;fillColor=none;fontColor=#DD3522;' + containerStyle,
```

**Para geração programática, sempre acrescente `container=1;pointerEvents=0;collapsible=0;recursiveResize=0;`
a AZ e Security group.**

### 3.6 Por que subnet pública e privada usam `grIcon=...group_security_group`

Parece bug, não é. Verifiquei em F4 que
`Architecture-Group-Icons_07312026/Private-subnet_32.svg` e `Public-subnet_32.svg` têm
**exatamente o mesmo path SVG**, diferindo só na cor de preenchimento:

```
mesmo glifo? True
priv: M19.536,22.049 C20.642,22.049 21.542,22.948 21.542,24.054 …
publ: M19.536,22.049 C20.642,22.049 21.542,22.948 21.542,24.054 …
```

O draw.io guarda esse glifo único sob o nome herdado `group_security_group` e distingue
as duas subnets só por cor. O mesmo casamento aparece em D11 (`PrivateSubnetAWS19` e
`PublicSubnetAWS19` usam ambos `grIcon=mxgraph.aws4.group_security_group`), o que confirma
que é intencional.

### 3.7 Estoque de `grIcon` disponível

`grep -o '<shape [^>]*name="group[^"]*"' stencils/aws4.xml` → 19 stencils. Após a
normalização de nome (§4.2):

```
group_account                       group_auto_scaling_group        group_availability_zone
group_aws_cloud                     group_aws_cloud_alt             group_aws_step_functions_workflow
group_corporate_data_center         group_ec2_instance_contents     group_elastic_beanstalk
group_elastic_load_balancing        group_iot_greengrass            group_iot_greengrass_deployment
group_on_premise                    group_region                    group_security_group
group_spot_fleet                    group_subnet                    group_vpc
group_vpc2
```

Quatro deles (`group_availability_zone`, `group_subnet`, `group_vpc`,
`group_elastic_load_balancing`) **existem no stencil mas não são usados pela paleta
`aws4`** — são resquícios do preset AWS18, que os usa em `AWS18 / Groups (light|dark)` (D2).
`group_vpc2` é a versão nova; `group_vpc` é a de 2018.

---

## 4. Onde mora a lista completa e como extraí-la de forma reprodutível

### 4.1 A armadilha: grep não funciona

As style strings **não existem literalmente em nenhum arquivo**. D1 as monta por
concatenação em runtime:

```js
var n2 = 'sketch=0;points=[[0,0,0],…];outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;'
       + 'strokeColor=#ffffff;dashed=0;…;aspect=fixed;' + mxConstants.STYLE_SHAPE + "=mxgraph.aws4.";
var gn = 'mxgraph.aws4';
…
this.createVertexTemplateEntry(n2 + 'resourceIcon;resIcon=' + gn + '.lambda;', w2, w2, '', 'Lambda', …)
```

Confirmação empírica — no bundle publicado a concatenação continua em runtime:

```bash
grep -c 'resIcon=mxgraph.aws4.lambda' src/main/webapp/js/app.min.js          # 0
grep -o 'resourceIcon;resIcon="+[a-zA-Z]*+"\.lambda;"' src/main/webapp/js/app.min.js
# -> resourceIcon;resIcon="+d+".lambda;"
```

Um regex sobre o `.js` recupera no máximo o sufixo (`.lambda;`), nunca o prefixo com a cor.
**A única forma correta é executar o arquivo.**

### 4.2 Formato dos dois arquivos que importam

**`stencils/aws4.xml`** — geometria. Um `<shapes name="mxgraph.aws4">` com 1037 filhos:

```xml
<shapes name="mxgraph.aws4">
<shape aspect="fixed" h="44" name="a1 instance" strokewidth="inherit" w="44">
    <connections/>
    <foreground><path><move x="44" y="11"/>…</path></foreground>
</shape>
```

A normalização do nome está em D10 (`mxStencilRegistry.parseStencilSet`, linha 17038):

```js
var stencilName = name.replace(/ /g,"_");
mxStencilRegistry.addStencil(packageName + stencilName.toLowerCase(), new mxStencil(shape));
```

→ **`<packageName>.<name em minúsculas com espaços trocados por `_`>`**.
`name="a1 instance"` ⇒ `mxgraph.aws4.a1_instance`.

O carregamento é lazy (D10, `getBasenameForStencil`, linha 16934): `mxgraph.aws4.X` ⇒
basename `aws4` ⇒ carrega `shapes/mxAWS4.js` + `stencils/aws4.xml` (D8). Ou seja,
**basta o `shape=`/`resIcon=` estar no XML do diagrama; nada precisa ser pré-registrado.**

**`Sidebar-AWS4.js`** — mapeamento nome→style. Estrutura estável, uma função por categoria:

```js
Sidebar.prototype.addAWS4<Categoria>Palette = function(s, w, h, w2, gn, sb) {
    var n  = '<prefixo para resource icons planos>' + mxConstants.STYLE_SHAPE + "=mxgraph.aws4.";
    var n2 = '<prefixo para service icons>'        + mxConstants.STYLE_SHAPE + "=mxgraph.aws4.";
    this.addPaletteFunctions('aws4<Categoria>', 'AWS / <Categoria>', false, [
        this.createVertexTemplateEntry(n2 + 'resourceIcon;resIcon=' + gn + '.<stencil>;',
            w2, w2, '', '<Título legível>', null, null, this.getTagsForStencil(...).join(' ')),
        ...
    ]);
};
```

Assinatura relevante (`src/main/webapp/js/grapheditor/Sidebar.js`, linha 5625):

```js
Sidebar.prototype.createVertexTemplateEntry = function(style, width, height, value, title, showLabel, showTitle, tags)
```

→ o **título** (índice 4) é o nome legível do serviço; **style** (índice 0) é o que
queremos; **width/height** (1,2) são o tamanho canônico.

### 4.3 O procedimento

Salve como `drawio-aws-catalog.cjs` (extensão `.cjs` importa: força CommonJS mesmo se
houver um `package.json` com `"type":"module"` num diretório pai).

```js
#!/usr/bin/env node
/**
 * Uso: node drawio-aws-catalog.cjs <repo-drawio> [aws4|aws4b|aws3|aws|aws3d] [--tsv]
 *
 * Executa o Sidebar-AWS*.js num vm com stubs mínimos do mxGraph e intercepta
 * createVertexTemplateEntry/createEdgeTemplateEntry para capturar as style strings
 * já concatenadas.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');

const repo  = process.argv[2];
const which = (process.argv[3] && !process.argv[3].startsWith('--')) ? process.argv[3] : 'aws4';
const tsv   = process.argv.includes('--tsv');

const FILE  = {aws4:'Sidebar-AWS4.js', aws4b:'Sidebar-AWS4b.js', aws3:'Sidebar-AWS3.js',
               aws:'Sidebar-AWS.js',   aws3d:'Sidebar-AWS3D.js'}[which];
const ENTRY = {aws4:'addAWS4Palette',  aws4b:'addAWS4bPalette',  aws3:'addAWS3Palette',
               aws:'addAWSPalette',    aws3d:'addAWS3DPalette'}[which];
if (!FILE) { console.error('familia invalida:', which); process.exit(2); }

const src = fs.readFileSync(path.join(repo, 'src/main/webapp/js/diagramly/sidebar', FILE), 'utf8');
const out = [];

function Sidebar() {}
Sidebar.prototype = {
  setCurrentSearchEntryLibrary() {},
  getTagsForStencil(gn, name, dt) { return [(dt||''), (name||'')].join(' ').trim().split(/\s+/); },
  createVertexTemplateEntry(style, w, h, value, title) {
    return {kind:'vertex', style, width:w, height:h, value:value||'', title:title||''};
  },
  createEdgeTemplateEntry(style, w, h, value, title) {
    return {kind:'edge', style, width:w, height:h, value:value||'', title:title||''};
  },
  createVertexTemplate() { return {}; },
  addEntry() { return {}; },
  addPalette() { return {}; },
  addPaletteFunctions(id, title, expanded, fns) {
    for (const e of fns) if (e && e.style !== undefined) { e.paletteId = id; e.palette = title; out.push(e); }
  }
};

const sandbox = {
  Sidebar, console,
  mxConstants: {STYLE_SHAPE:'shape', STYLE_POINTER_EVENTS:'pointerEvents', NODETYPE_ELEMENT:1},
  mxCellRenderer: {registerShape(){}},
  mxUtils: {bind:(s,f)=>f.bind(s), extend(){}, getValue:(s,k,d)=>d},
  mxStencilRegistry: {libraries:{}, getStencil(){ return null; }},
  mxShape: function(){}
};
sandbox.window = sandbox; sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, {filename: FILE});

const sb = Object.create(sandbox.Sidebar.prototype);
sandbox.Sidebar.prototype[ENTRY].call(sb);

if (tsv) {
  console.log(['palette','title','shapeClass','stencil','w','h','style'].join('\t'));
  for (const e of out) {
    const cls  = (e.style.match(/shape=mxgraph\.aws[0-9a-z]*\.([A-Za-z0-9_]+)/)||[])[1] || '';
    const sten = (e.style.match(/(?:resIcon|prIcon|grIcon)=(mxgraph\.aws[0-9a-z]*\.[A-Za-z0-9_]+)/)||[])[1]
              || (/^(resourceIcon|productIcon|group|groupCenter|group2)$/.test(cls) ? ''
                 : (e.style.match(/shape=(mxgraph\.aws[0-9a-z]*\.[A-Za-z0-9_]+)/)||[])[1] || '');
    console.log([e.palette, e.title, cls, sten, e.width, e.height, e.style].join('\t'));
  }
} else {
  console.log(JSON.stringify(out, null, 1));
}
```

Execução e resultados obtidos em 2026-08-21 (draw.io 31.3.1):

```bash
node drawio-aws-catalog.cjs /tmp/drawio aws4  --tsv > aws4.tsv    # 1038 entradas + cabeçalho
node drawio-aws-catalog.cjs /tmp/drawio aws4b --tsv > aws4b.tsv   #  366 entradas
node drawio-aws-catalog.cjs /tmp/drawio aws3  --tsv > aws3.tsv    #  331 entradas
node drawio-aws-catalog.cjs /tmp/drawio aws   --tsv > aws.tsv     #  234 entradas
node drawio-aws-catalog.cjs /tmp/drawio aws3d --tsv > aws3d.tsv   #   64 entradas
```

Distribuição das 1038 entradas de `aws4` por classe de shape:

| Classe | Nº |
|---|---|
| `resourceIcon` (service icons) | 403 |
| stencil direto (resource icons planos) | 606 |
| `group` | 15 |
| `groupCenter` | 1 |
| sem `shape=` (retângulos e arestas) | 13 |

Consultas úteis sobre o TSV:

```bash
# só service icons, com nome do stencil
awk -F'\t' '$3=="resourceIcon"{print $2"\t"$4}' aws4.tsv | sort -u

# achar um serviço
grep -iP '\tLambda\t' aws4.tsv | cut -f1,2,4,7

# stencils declarados mas nunca usados pela paleta atual
grep -o '<shape [^>]*name="[^"]*"' /tmp/drawio/src/main/webapp/stencils/aws4.xml \
  | sed 's/.*name="//;s/"$//' | tr 'A-Z ' 'a-z_' | sort -u > declarados.txt
cut -f4 aws4.tsv | sed 's/^mxgraph\.aws4\.//' | sort -u > usados.txt
comm -23 declarados.txt usados.txt   # 62 stencils só usados por aws4b
```

Validação cruzada: os 975 nomes de stencil referenciados por D1 existem todos em D7
(0 referências quebradas).

### 4.4 Fonte alternativa já em formato chave→valor: `Extensions.js`

D11 contém **476 pares** `'<NomeLucid>AWS19' : '<style>'` como literais de string,
usados pelo importador de Lucidchart/Gliffy. Esses **são** grepáveis:

```bash
grep -oP "'\w+AWS19(_v2)?'\s*:\s*'[^']+'" src/main/webapp/js/diagramly/Extensions.js
```

Vantagem: sem execução de JS. Desvantagens: só cobre o subconjunto que o Lucid tinha em
2019 (476 vs 1038), tem duplicatas (`_v2`), e as styles são mais enxutas (sem `points=`,
com `labelPosition=center`). **Use como referência cruzada, não como catálogo primário.**

---

## 5. Cobertura — o que não tem shape dedicado e o fallback

### 5.1 Números

| Conjunto | Nº |
|---|---|
| Service icons no deck AWS Q3-2026 (F4) | **303** |
| `resourceIcon` distintos no draw.io `aws4` (D1) | **403** |
| Resource icons no deck AWS Q3-2026 (F4) | 513 |
| Stencils em `aws4.xml` (D7) | 1037 |

O draw.io tem *mais* service icons que a AWS porque **nunca remove** os de serviços
descontinuados. A paleta ainda entrega CodeWhisperer, DeepLens, DeepComposer, DeepRacer,
Sumerian, Honeycode, Lumberyard, Alexa for Business, WorkLink, OpsWorks, CodeStar,
CodeCommit, Elastic Inference, GameSparks, Panorama, entre outros.

### 5.2 Serviços do deck AWS atual que o draw.io NÃO tem

Diff automatizado (303 nomes do F4 normalizados contra os 403 títulos+stencils de D1),
com aliases manuais para renomes conhecidos. Resultado — **4 lacunas reais**:

| Serviço AWS (Q3-2026) | Categoria | Situação no draw.io |
|---|---|---|
| **AWS FinOps Agent** | Cloud Financial Management | ausente |
| **AWS Interconnect** | Networking & Content Delivery | ausente |
| **AWS Sustainability** | Management Tools | ausente |
| **AWS Elemental Inference** | Artificial Intelligence | ausente |

### 5.3 Serviços que não têm ícone nem no deck da AWS

Verifiquei no F4 (service icons **e** resource icons): estes não existem em lugar nenhum.

- **Aurora DSQL**
- **Kiro**
- **SageMaker Unified Studio**
- **Lambda SnapStart**
- **AWS CDK** (existe como `Arch_AWS-Cloud-Development-Kit`, mas nenhum "CDK Construct")

Aqui o fallback é obrigatório mesmo para quem usa o deck oficial atualizado.

### 5.4 Casos que *parecem* faltar mas não faltam — nome divergente

Este é o modo de falha mais comum de um gerador: buscar pelo nome de marketing atual e
não achar, porque o draw.io guarda o nome **antigo** do stencil.

| Serviço (nome atual) | Stencil no draw.io | Título na paleta |
|---|---|---|
| Amazon OpenSearch Service | `elasticsearch_service` | `OpenSearch Service` |
| AWS IAM Identity Center | `single_sign_on` | `Identity Center` |
| Amazon CloudWatch | `cloudwatch_2` | `CloudWatch` |
| Amazon EFS | `elastic_file_system` | `Elastic File System` |
| Amazon S3 | `s3` | `Simple Storage Service (S3)` |
| Amazon SQS / SNS | `sqs` / `sns` | `Simple Queue Service` / `Simple Notification Service` |
| AWS IAM | `identity_and_access_management` | `Identity & Access Management` |
| AWS KMS | `key_management_service` | `Key Management Service` |
| Amazon VPC | `vpc` | `VPC` |
| Amazon MemoryDB | `memorydb_for_redis` | `MemoryDB` |
| Application Migration Service | `cloudendure_migration` | `Application Migration Service` |
| Elastic Disaster Recovery | `cloudendure_disaster_recovery` | `Elastic Disaster Recovery` |
| Amazon Quick Suite | `quick_suite` | `Quick Suite` |
| AWS Fault Injection Service | `fault_injection_simulator` | `Fault Injection Service` |
| Amazon Data Firehose | `kinesis_data_firehose` | `Data Firehose` |
| Infrastructure Composer | `application_composer` | `Infrastructure Composer` |

**Consequência de design:** um lookup por nome de serviço tem que casar contra **título
E stencil E tags**, com normalização (minúsculas, `_`↔espaço, remoção de prefixos
`AWS `/`Amazon `). Casar só por um dos três produz falsos negativos.

### 5.5 Também não é lacuna: existe como *resource icon*, não como *service icon*

Vários itens recentes existem só como glifo plano (§2.2). Se o gerador só procura
`resourceIcon`, ele conclui "não existe" e cai no fallback sem necessidade:

| Item | Como está no draw.io |
|---|---|
| S3 Tables | `shape=mxgraph.aws4.s3_tables` (78×78) |
| S3 Express One Zone | `shape=mxgraph.aws4.s3_express_one_zone` (78×78) |
| EventBridge Pipes | `shape=mxgraph.aws4.eventbridge_pipes` (78×78) |
| EventBridge Scheduler | `shape=mxgraph.aws4.eventbridge_scheduler` (78×78) |
| Trainium / Inferentia | `shape=mxgraph.aws4.trainium_instance` / `.inferentia` (48×48) |
| Default / Custom Event Bus | `shape=mxgraph.aws4.eventbridge_default_event_bus_resource` etc. |

### 5.6 Fallback — a escada de decisão

Em ordem de preferência, tudo verificado como existente em D1/D7:

1. **Service icon do serviço** — `resourceIcon` + `resIcon=<serviço>`.
2. **Resource icon do serviço** — stencil direto, se só existir a versão plana (§5.5).
3. **Service icon da categoria** — o draw.io tem um ícone-categoria para cada uma; é o
   fallback correto para um serviço novo sem ícone próprio. Exemplos literais:

   ```
   Analytics             resIcon=mxgraph.aws4.analytics                        fillColor=#8C4FFF
   Application Integration resIcon=mxgraph.aws4.application_integration          fillColor=#E7157B
   AI/ML                 resIcon=mxgraph.aws4.machine_learning                 fillColor=#01A88D
   Compute               resIcon=mxgraph.aws4.compute                          fillColor=#ED7100
   Containers            resIcon=mxgraph.aws4.containers                       fillColor=#ED7100
   Database              resIcon=mxgraph.aws4.database                         fillColor=#C925D1
   Developer Tools       resIcon=mxgraph.aws4.developer_tools                  fillColor=#C925D1
   Management&Governance resIcon=mxgraph.aws4.management_and_governance        fillColor=#E7157B
   Networking            resIcon=mxgraph.aws4.networking_and_content_delivery  fillColor=#8C4FFF
   Security              resIcon=mxgraph.aws4.security_identity_and_compliance fillColor=#DD344C
   Storage               resIcon=mxgraph.aws4.storage                          fillColor=#7AA116
   Serverless            resIcon=mxgraph.aws4.serverless                       fillColor=#8C4FFF
   Cost Management       resIcon=mxgraph.aws4.cost_management                  fillColor=#7AA116
   ```

   Esta é também a receita que o próprio deck da AWS chama de *"Create a Custom Group for
   a Service"*: quadrado da cor da categoria + rótulo textual.

4. **Genéricos de `AWS / General Resources`** — quando nem a categoria serve:

   ```
   generic_application  generic_database  generic_firewall  traditional_server
   client  mobile_client  user  users  internet  internet_alt1  internet_alt2
   corporate_data_center  office_building  document  documents  logs  gear
   ```

   Style base (`n` da paleta General Resources, D1 linha 121):

   ```
   sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#232F3D;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;pointerEvents=1;shape=mxgraph.aws4.generic_application;
   ```

5. **Último recurso** — retângulo `Generic group` com o nome do serviço escrito.

> **Nunca** faça downgrade para `mxgraph.aws3.*` só porque o `aws4` não tem o ícone: o
> deck de 2017 tem *menos* serviços (293 stencils vs 1037), e misturar as duas gerações
> num mesmo diagrama é o erro visual mais visível que existe.

---

## 6. Versionamento — que deck o draw.io carrega e como ele envelhece

### 6.1 Cadência da AWS (F1, texto literal da página em 2026-08-21)

> "Check that you're using up-to-date icons, because some libraries may contain legacy
> icon sets. **Architecture icon packages are released on a quarterly basis: Q1 (end of
> January), Q2 (end of April), and Q3 (end of July). No releases occur in Q4.**"

Pacote corrente na data da pesquisa, extraído do HTML da própria F1:

```
https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip
```

→ **`07312026` = 31 de julho de 2026 = release Q3 2026.**

### 6.2 Cadência do draw.io (D12, `ChangeLog`)

Todas as entradas do `ChangeLog` que tocam stencils AWS, com data e versão:

| Data | Versão | Entrada |
|---|---|---|
| 26-FEB-2026 | 29.5.6 | AWS shapes update |
| 13-OCT-2025 | 28.2.6 | AWS shapes update |
| 06-MAY-2025 | 26.3.0 | AWS update |
| 25-JUL-2024 | 24.7.5 | AWS shapes update |
| 28-FEB-2024 | 23.1.8 | AWS shapes update [DS-951] |
| 13-NOV-2023 | 22.1.1 | Updates AWS icons to Q3 23 set |
| 08-SEP-2023 | 21.7.4 | AWS shapes update to Q2 2023 |
| 14-APR-2023 | 21.1.8 | Updates AWS icons |
| 02-JUN-2022 | 18.2.1 | Updates AWS |
| 09-FEB-2022 | 16.5.5 | Updates AWS stencils |
| 24-AUG-2021 | 14.9.9 | Updates AWS stencils to latest set |
| 09-JAN-2021 | 14.1.9 | AWS stencil update |
| 04-FEB-2020 | 12.6.5 | Adds new AWS 19 shapes |
| 20-NOV-2018 | 9.4.5 | Adds 2018 AWS icons |

Último toque em `stencils/aws4.xml` na branch padrão (API do GitHub, `?path=…&per_page=100`):

```
2026-03-06 | 29.6.1 release
2026-01-17 | 29.3.2 release
```

### 6.3 O gap atual

| | |
|---|---|
| Deck AWS corrente | **Q3 2026** (31-jul-2026) |
| Deck embutido no draw.io 31.3.1 | ≈ **Q1 2026** (release de 26-fev-2026 / commit de 06-mar-2026) |
| Atraso | **~2 releases da AWS** (Q2-2026 e Q3-2026) |
| Rótulo mostrado na UI | **"AWS 2026"** — mas só porque `getFullYear()` retorna 2026 |

**Como o catálogo envelhece, concretamente:**

1. **Nomes congelam.** O stencil `elasticsearch_service` sobreviveu ao rename para
   OpenSearch; `single_sign_on` sobreviveu ao rename para IAM Identity Center;
   `cloudendure_migration` sobreviveu ao rename para Application Migration Service.
   O *título* da paleta é atualizado, o *nome do stencil* nunca é — porque mudá-lo
   quebraria todos os diagramas salvos.
2. **Nada é removido.** Ícones de serviços descontinuados continuam disponíveis
   indefinidamente (§5.1).
3. **Serviços novos chegam com 1–2 trimestres de atraso** e, quando o serviço é muito
   recente, a AWS ainda não publicou o ícone (§5.3).
4. **As cores de *grupo* envelhecem mais que as de *serviço*.** As `fillColor` dos
   service icons batem 100% com o deck Q3-2026 (§7.2); as `strokeColor` dos grupos ainda
   carregam a paleta pré-2022 em 8 dos 18 grupos (§3.4).

**Decisão:** trate o catálogo do draw.io como *snapshot com deriva conhecida*. Um gerador
sério deve (a) manter a tabela nome→stencil versionada junto com o commit do drawio de
onde foi extraída, (b) reexecutar o script de §4.3 a cada bump de versão do draw.io, e
(c) diffar contra o `Icon-package_MMDDYYYY.zip` corrente para detectar novas lacunas.

---

## 7. Style strings verificadas para geração programática

### 7.1 O template — uma forma, duas variáveis

Canonizei as 403 styles de `resourceIcon` de D1 (substituindo `fillColor` e `resIcon` por
placeholders). Resultado: **355 das 403 colapsam num único template.** As 48 restantes
são variantes de gradiente (AR/VR, Customer Engagement, General Resources) ou têm
`points=` duplicado — um bug cosmético na paleta Management Governance (39 entradas).

O template canônico, literal:

```
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=${CATEGORY_COLOR};strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.${SERVICE};
```

Tamanho canônico: **78×78**.

Nas tabelas abaixo esse prefixo (tudo até `aspect=fixed;` inclusive) é abreviado `${SVC}`,
de modo que a style completa é `${SVC}shape=mxgraph.aws4.resourceIcon;resIcon=…;` — mas
com `fillColor` já substituído pela cor da categoria.

### 7.2 Tabela de cores de categoria — cruzada com a AWS

`fillColor` extraído de D1 (por paleta) vs. cor extraída dos SVGs de
`Architecture-Service-Icons_07312026/` (F4). **Bate 100% em todas as 23 categorias que
existem nos dois lados.**

| Categoria (draw.io) | `fillColor` | Cor no deck AWS Q3-2026 | Bate? |
|---|---|---|---|
| Analytics | `#8C4FFF` | `#8C4FFF` | ✅ |
| Application Integration | `#E7157B` | `#E7157B` | ✅ |
| Artificial Intelligence | `#01A88D` | `#01A88D` | ✅ |
| Blockchain | `#ED7100` | `#ED7100` | ✅ |
| Business Applications | `#DD344C` | `#DD344C` | ✅ |
| Cloud Financial Management | `#7AA116` | `#7AA116` | ✅ |
| Compute | `#ED7100` | `#ED7100` | ✅ |
| Containers | `#ED7100` | `#ED7100` | ✅ |
| Customer Enablement | `#C925D1` | `#C925D1` | ✅ |
| Database | `#C925D1` | `#C925D1` | ✅ |
| Developer Tools | `#C925D1` | `#C925D1` | ✅ |
| End User Computing | `#01A88D` | `#01A88D` | ✅ |
| Front End Web Mobile | `#DD344C` | `#DD344C` | ✅ |
| Games | `#8C4FFF` | `#8C4FFF` | ✅ |
| Internet of Things | `#7AA116` | `#7AA116` | ✅ |
| Management Governance | `#E7157B` | `#E7157B` (Management Tools) | ✅ |
| Media Services | `#ED7100` | `#ED7100` | ✅ |
| Migration Modernization | `#01A88D` | `#01A88D` | ✅ |
| Network Content Delivery | `#8C4FFF` | `#8C4FFF` | ✅ |
| Quantum Technologies | `#ED7100` | `#ED7100` | ✅ |
| Satellite | `#C925D1` | `#C925D1` | ✅ |
| Security Identity Compliance | `#DD344C` | `#DD344C` | ✅ |
| Storage | `#7AA116` | `#7AA116` | ✅ |
| *AR VR* | `#BC1356` | — (categoria extinta) | só draw.io |
| *Contact Center* | `#DD344C` | — (extinta) | só draw.io |
| *Customer Engagement* | `#3334B9` | — (extinta) | só draw.io |
| *Robotics* | `#DD344C` | — (extinta) | só draw.io |
| *Serverless* | `#8C4FFF` | — (não é categoria) | só draw.io |
| *General Resources* | `#1E262E` | `#232F3D` (General Icons) | ~ |

> **Insight de design:** `fillColor` é função da **categoria**, não do serviço. Um chooser
> programático precisa de duas tabelas — `serviço → stencil` e `serviço → categoria` — e
> monta a style com o template de §7.1. Isso reduz 403 strings a 403 pares + 28 cores.

### 7.3 Os 12 serviços mais comuns — styles literais e verificadas

Todas extraídas de D1 pelo procedimento de §4.3, verbatim. Tamanho **78×78** em todas.

| Serviço | Paleta | `resIcon` | `fillColor` |
|---|---|---|---|
| Lambda | Compute | `mxgraph.aws4.lambda` | `#ED7100` |
| Simple Storage Service (S3) | Storage | `mxgraph.aws4.s3` | `#7AA116` |
| DynamoDB | Database | `mxgraph.aws4.dynamodb` | `#C925D1` |
| API Gateway | Application Integration | `mxgraph.aws4.api_gateway` | `#E7157B` |
| Elastic Container Service | Containers | `mxgraph.aws4.ecs` | `#ED7100` |
| RDS | Database | `mxgraph.aws4.rds` | `#C925D1` |
| EC2 | Compute | `mxgraph.aws4.ec2` | `#ED7100` |
| Simple Queue Service | Application Integration | `mxgraph.aws4.sqs` | `#E7157B` |
| EventBridge | Application Integration | `mxgraph.aws4.eventbridge` | `#E7157B` |
| CloudFront | Network Content Delivery | `mxgraph.aws4.cloudfront` | `#8C4FFF` |
| Simple Notification Service | Application Integration | `mxgraph.aws4.sns` | `#E7157B` |
| Identity & Access Management | Security Identity Compliance | `mxgraph.aws4.identity_and_access_management` | `#DD344C` |

Styles completas (copiar e colar):

```
# Lambda  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.lambda;

# Simple Storage Service (S3)  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#7AA116;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.s3;

# DynamoDB  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.dynamodb;

# API Gateway  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#E7157B;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.api_gateway;

# Elastic Container Service (ECS)  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ecs;

# RDS  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.rds;

# EC2  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;

# Simple Queue Service (SQS)  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#E7157B;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.sqs;

# EventBridge  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#E7157B;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.eventbridge;

# CloudFront  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudfront;

# Simple Notification Service (SNS)  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#E7157B;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.sns;

# Identity & Access Management (IAM)  (78x78)
sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#DD344C;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.identity_and_access_management;
```

### 7.4 Chaves de style que importam (e o que quebra se faltarem)

| Chave | Efeito | Se faltar |
|---|---|---|
| `shape=mxgraph.aws4.resourceIcon` | seleciona a classe | vira retângulo |
| `resIcon=mxgraph.aws4.<x>` | qual glifo | quadrado colorido vazio |
| `fillColor` | cor do quadrado (= cor da categoria) | branco |
| `strokeColor=#ffffff` | **cor do glifo** | glifo preto sobre cor |
| `aspect=fixed` | trava a proporção 1:1 | ícone distorce ao redimensionar |
| `verticalLabelPosition=bottom;verticalAlign=top` | rótulo abaixo do ícone | rótulo dentro do quadrado |
| `fontColor=#232F3E` | cor do rótulo (AWS squid ink) | preto puro |
| `points=[…]` | 16 pontos de conexão fixos | conexão flutuante (aceitável) |
| `sketch=0` | desliga o modo rascunho | herda o tema do arquivo |
| `outlineConnect=0` | conexão só nos pontos | — |
| `container=1;pointerEvents=0;collapsible=0;recursiveResize=0` | (grupos) aninhamento real | container só visual (§3.5) |
| `grStroke=0` | (grupos) suprime a borda | borda desenhada |
| `grIconSize=<n>` | (grupos) tamanho do ícone de canto, default **25** | 25 px |

---

## 8. Receita de escolha programática — resumo executivo

```
entrada: nome do serviço AWS + (opcional) categoria

1. normalizar: lowercase, "_"->" ", remover prefixo "aws "/"amazon ", remover pontuação
2. procurar no catálogo (TSV de §4.3) por, nesta ordem:
     a) título da paleta normalizado
     b) nome do stencil normalizado
     c) coluna de tags
     d) tabela manual de renomes (§5.4)
3. se achou entrada com shapeClass=resourceIcon  -> template §7.1 com o resIcon achado
4. se achou entrada com stencil direto           -> style plano (fillColor=cor da categoria,
                                                    strokeColor=none, aspect=fixed)
5. se não achou                                  -> escada de fallback §5.6 (categoria > genérico)
6. cor: SEMPRE derivar de categoria (§7.2), nunca do serviço
7. grupos: estrutura de §3.3, mas sobrescrever strokeColor/fontColor pela cor oficial de §3.4
           e garantir container=1 em AZ e Security group (§3.5)
```

---

## Incertezas

1. **Não renderizei nada.** Todas as style strings foram extraídas executando o
   `Sidebar-AWS4.js` original num sandbox e são idênticas às que o draw.io produz em
   runtime — mas eu não abri o draw.io e não exportei um PNG para conferir visualmente.
   O risco residual é baixo (as strings são o que a própria sidebar passa para
   `createVertexTemplate`), mas não é zero. **Recomendo um smoke test:** montar um
   `.drawio` com as 12 styles de §7.3 e exportar.

2. **A contagem "403 service icons" inclui duplicatas por paleta.** `API Gateway` aparece
   em `Application Integration` e em `Network Content Delivery`; `Connect` aparece em três
   paletas; `Fargate` em duas. O número de *serviços distintos* é menor. Não apurei o
   valor exato porque a deduplicação depende de decidir se `sagemaker` e `sagemaker_2`
   (títulos "SageMaker AI" e "Sagemaker") são o mesmo serviço — não são, mas o nome sugere.

3. **O diff de cobertura (§5.2) usa casamento por nome normalizado com aliases manuais.**
   Detectei 17 candidatos a lacuna e classifiquei 13 como renomes; sobram 4 lacunas reais.
   Um ou dois desses 13 podem ter sido classificados errado. Os 4 restantes
   (FinOps Agent, Interconnect, Sustainability, Elemental Inference) foram verificados
   individualmente com `grep -i` no TSV e no `aws4.xml` — nesses tenho confiança alta.

4. **O histórico do GitHub para `aws4.xml` retornou só 2 commits** mesmo com
   `per_page=100`. O repo `jgraph/drawio` parece ter histórico truncado/reescrito na
   branch padrão. Usei o `ChangeLog` como fonte principal de cadência, que é mais
   confiável, mas a data exata do último refresh (fev vs mar de 2026) tem ±1 release de
   incerteza.

5. **Não consegui confirmar em fonte primária a nomenclatura "Service Icon" no texto da
   AWS.** A página F1 renderizada não usa os termos; a estrutura de diretórios de F4
   (`Architecture-Service-Icons`, `Resource-Icons`, `Category-Icons`,
   `Architecture-Group-Icons`) é a evidência mais forte que obtive, e é sólida. O deck
   PPTX (F2/F3), analisado no documento irmão, tem um slide que define os termos
   explicitamente — cruzar com ele fecha essa lacuna.

6. **A afirmação "draw.io está ~2 releases atrás" assume que o refresh de fev/2026 trouxe
   o deck Q1-2026 (fim de janeiro).** É a leitura mais natural das datas, mas o `ChangeLog`
   não nomeia a release do deck (as entradas de 2023 nomeavam: "Q2 2023", "Q3 23 set"; as
   de 2024+ não). Pode ser que fev/2026 tenha trazido o deck Q3-2025.

7. **`points=` duplicado na paleta Management Governance** (39 entradas com o mesmo
   `points=[…]` repetido duas vezes) é, na minha leitura, um bug cosmético do
   `Sidebar-AWS4.js` — o mxGraph usa a última ocorrência e o efeito é nulo. Não abri issue
   nem confirmei com os mantenedores.

8. **Não investiguei o `Sidebar-AWS3D.js`/`aws3d` em profundidade** (64 entradas,
   16 stencils). A pergunta não pedia, e a família é nicho (isométrico). Se um dia
   importar, o mesmo script de §4.3 extrai o catálogo com `aws3d`.
