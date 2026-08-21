# Rubrica de qualidade para diagramas de arquitetura (AWS)

> Pesquisa de fundação para o gerador automático de diagramas. Objetivo: separar
> **regra verificável** de **gosto**. Tudo aqui é rastreado a uma fonte primária —
> livro/autor original, especificação, ou guia oficial de plataforma.
>
> Data da pesquisa: 2026-08-21.

---

## 0. Como ler este documento

O documento tem duas listas que **não se misturam**:

- **(A) Checagens mecanizáveis** — computáveis a partir de um modelo geométrico
  (caixas com coordenadas + arestas com polilinhas + cores + rótulos). Estas viram
  o validador. Cada uma traz **limiar sugerido** e **fonte**.
- **(B) Julgamentos humanos / de render** — o que a geometria não alcança, e por quê.

Antes das listas, as respostas às 6 perguntas de investigação. Depois delas, uma
seção do que a evidência **não** sustenta, e as incertezas.

### Modelo de entrada assumido pelo validador

Para as checagens de (A) serem implementáveis, o gerador precisa expor:

| Objeto | Campos mínimos |
|---|---|
| `canvas` | `w`, `h`, `bg_color` |
| `node` | `x`, `y`, `w`, `h`, `type`, `label`, `icon_id`, `fill`, `stroke`, `stroke_width`, `stroke_style` |
| `group` | `x`, `y`, `w`, `h`, `type` (Region/VPC/AZ/Subnet/SG/...), `label`, `parent`, `stroke`, `stroke_style`, `fill` |
| `edge` | `points[]` (polilinha ou Bézier), `source`, `target`, `label`, `arrowhead` (0/1/2 pontas), `stroke`, `stroke_style` |
| `text` | `x`, `y`, `w`, `h`, `font_size_px`, `color`, `bold`, `owner` (nó/aresta/grupo/título/legenda) |
| `legend` | lista de entradas `(símbolo, significado)` |
| `meta` | `title`, `scope`, `abstraction_level`, `date`, `version`, `author` |

Sem esses campos, metade das checagens vira julgamento humano. **Instrumentar o
gerador para emitir esse modelo é pré-requisito da rubrica.**

---

## 1. Design de informação aplicado a diagrama

### 1.1 Tufte

Tufte define **data-ink ratio** como `data-ink / total ink used to print the graphic`,
equivalente a `1 − (proporção do gráfico que pode ser apagada sem perda de informação)`;
data-ink é "the non-erasable core of a graphic, the non-redundant ink arranged in
response to variation in the numbers represented". Os imperativos são
*"Above all else show the data"*, *"Maximize the data-ink ratio"*, *"Erase non-data-ink"*,
*"Erase redundant data-ink"*. **Chartjunk** é o ornamento que consome tinta sem
carregar informação.
Fonte: Edward R. Tufte, *The Visual Display of Quantitative Information* (Graphics Press,
1983; 2ª ed. 2001), cap. 4–5.

**Tradução honesta para diagrama de arquitetura.** Diagrama não é gráfico estatístico:
não existe "dado" contínuo mapeado em posição. O análogo defensável do data-ink ratio é:

> Cada traço no diagrama deve corresponder a **um fato verificável da arquitetura**
> (um recurso, uma fronteira, uma chamada). Traço que não corresponde a fato é chartjunk.

Isso vira regra concreta e mecanizável:
- **Sem sombras, gradientes, bevels, 3D, skeuomorfismo** — nenhum desses codifica
  nada da arquitetura. Checável: propriedades de estilo proibidas.
- **Sem elemento decorativo sem `type`** — todo shape no canvas mapeia a uma entidade
  do modelo. Checável: contagem de shapes órfãos = 0.
- **Sem redundância de codificação sem ganho** — se cor, forma e rótulo já dizem
  "Lambda", a moldura extra é redundant data-ink.
- **Cobertura de tinta** (fração da área do canvas coberta por não-fundo) é um proxy
  computável, mas *fraco* — ver §"O que a evidência NÃO sustenta".

**Small multiples.** Tufte (*Envisioning Information*, Graphics Press, 1990) argumenta
que comparações se fazem repetindo o mesmo enquadramento com uma variável mudando.
Em arquitetura isso é: **um diagrama por ambiente / por região / por fluxo**, com
posições e escala **idênticas** entre eles, em vez de um diagrama sobrecarregado.
Regra mecanizável: em uma série, os nós comuns devem estar nas mesmas coordenadas
(tolerância zero) e a escala dos ícones deve ser idêntica.

### 1.2 Gestalt

A formalização de Gestalt para desenho de grafos que uso aqui é Kobourov, Mchedlidze &
Vonessen, *Gestalt Principles in Graph Drawing* (pôster, Graph Drawing), que mapeia cada
princípio a convenções de layout concretas:

| Princípio | Formulação em node-link (fonte acima) | Regra de layout |
|---|---|---|
| **Continuação** | "uma aresta pode ser seguida mais facilmente pelo olho quando tem poucas dobras, e não bruscas"; caminhos geodésicos são preferidos; cruzamentos em ângulo pequeno "disparam movimentos oculares extras de vai-e-vem" | minimizar dobras; proibir dobras agudas; maximizar ângulo de cruzamento |
| **Proximidade** | "nós próximos são percebidos como grupos" — base dos algoritmos de grafos agrupados e das forças atrativas/repulsivas | distância intra-grupo < distância inter-grupo, com margem |
| **Similaridade** | mesma cor = mesmo cluster; mesmo tamanho = mesma importância; mesma forma = mesmas propriedades; comprimentos de aresta uniformes = relações de importância igual | codificação visual idêntica para o mesmo `type`; comprimento de aresta uniforme |
| **Simetria** | fortemente preferida por humanos, mas "é difícil formalizar a simetria de um node-link e fornecer uma medida computável para ela" | ver §B — não mecanizar simetria diretamente; usar alinhamento a grid como proxy |
| **Região comum** | (não coberto pelo pôster; vem da tradição Gestalt e é o que caixas de grupo exploram) | caixa de grupo fechada; nenhum filho fora; nenhum não-membro dentro |
| **Fechamento** | usado explicitamente para *aliviar* cruzamentos: arestas parcialmente desenhadas, confiando na percepção para completar | recurso avançado; não é regra de validação |

**A consequência mais importante para roteamento**: região comum e proximidade são
mais fortes que qualquer rótulo. Se uma aresta atravessa uma caixa de VPC da qual
nem origem nem destino são membros, o leitor percebe uma relação que não existe.
Isso é falha dura e é geometricamente checável (§A-12).

---

## 2. C4 model — as regras explícitas

O C4 é **notação-independente**, mas prescreve um conjunto fechado de requisitos.
Copiados de `c4model.com/diagrams/notation` e `c4model.com/diagrams/checklist`:

**Diagrama**
- "Every diagram should have a **title** describing the diagram type and scope
  (e.g. 'System Context diagram for My Software System')."
- "Every diagram should have a **key/legend** explaining the notation being used
  (e.g. shapes, colours, border styles, line types, arrow heads, etc)."
- "Acronyms and abbreviations ... should be understandable by all audiences, or
  explained in the diagram key/legend."

**Elementos**
- "The **type** of every element should be explicitly specified."
- "Every element should have a short **description**."
- "Every container and component should have a **technology** explicitly specified."
- Do checklist: entende-se o significado de **toda cor, forma, ícone, estilo de borda
  e tamanho de elemento** usados? (isto é: cada canal visual usado tem entrada na legenda)

**Relações**
- "Every line should represent a **unidirectional** relationship."
- "Every line should be **labelled**, the label being consistent with the direction
  and intent of the relationship."
- Relações entre containers "should have a **technology/protocol** explicitly labelled."

**Nível de abstração** (`c4model.com/faq`)
- "The key is to ensure that each of the separate diagrams tells a different part of
  the same overall story, **at the same level of abstraction**."
- "Large diagrams are usually hard to interpret and comprehend because **the cognitive
  load is too high**. And if nobody understands the diagram, nobody is going to look at it."
- Remédio prescrito: "Don't be afraid to split that single complex diagram into a
  **larger number of simpler diagrams**."

**Cor**: livre, "but should be consistent across diagrams and account for accessibility
concerns like colorblindness".

### As que se aplicam a um diagrama AWS (todas mecanizáveis)

1. Título presente, contendo tipo + escopo.
2. Legenda presente.
3. Legenda **completa**: toda cor, forma, estilo de borda, estilo de linha, tipo de ponta
   de seta e tamanho de ícone efetivamente usados no canvas têm entrada correspondente.
4. Todo elemento tem nome.
5. Todo elemento tem `type` declarado (serviço AWS, ator externo, sistema externo, grupo).
6. Todo container/serviço tem tecnologia explícita (o próprio nome do serviço AWS satisfaz).
7. Toda aresta tem rótulo.
8. Toda aresta é unidirecional (uma ponta só).
9. Rótulo de aresta consistente com a direção (checagem parcial — ver §B-3).
10. Toda sigla usada aparece expandida no diagrama ou na legenda.
11. Um único nível de abstração: todos os nós do diagrama têm o mesmo `abstraction_level`.

---

## 3. Guias oficiais de plataforma — onde concordam

Fontes consultadas (todas oficiais):
- **Microsoft**: *Create architecture design diagrams*, Azure Well-Architected Framework
  (`learn.microsoft.com/azure/well-architected/architect-role/design-diagrams`) e
  *Azure Icons* (`learn.microsoft.com/azure/architecture/icons/`).
- **AWS**: *AWS Architecture Icons* (`aws.amazon.com/architecture/icons/`),
  *What is Architecture Diagramming?* (`aws.amazon.com/what-is/architecture-diagramming/`),
  e o deck oficial *AWS Architecture Icons* (slides DO/DON'T e slides de Groups).
- **Google**: *Icon library* (`cloud.google.com/icons`) e o
  *Google developer documentation style guide* — `developers.google.com/style/images`
  e `/style/accessibility`.
- **IBM**: `github.com/IBM-Cloud/architecture-icons` (stencils + guidance) e
  IBM Cloud Architecture Framework, *Creating an architecture diagram*.
- **C4** (§2), citado explicitamente pela própria Microsoft como especificação de referência.

### 3.1 Onde concordam — este é o sinal forte

| Regra | Microsoft | AWS | Google | IBM | C4 |
|---|:--:|:--:|:--:|:--:|:--:|
| Usar ícones **oficiais e atuais** do fornecedor | ✅ | ✅ | ✅ | ✅ | — |
| **Não** cortar, girar, espelhar ou deformar ícones | ✅ | ✅ | ✅ | ✅ | — |
| **Não** recolorir arbitrariamente marca/ícone | ✅ | ✅ | ✅ | ✅ | — |
| Nome do produto **junto do ícone** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Rotular tudo**: ícone, container de grupo, relação | ✅ | ✅ | — | ✅ | ✅ |
| **Setas direcionais** obrigatórias; linha sem seta é ambígua | ✅ | ✅ | — | ✅ | ✅ |
| **Evitar setas bidirecionais**; preferir dois fluxos | ✅ | — | — | — | ✅ |
| **Consistência** de cor, caixa, tamanho de ícone, espessura e estilo de linha, ponta de seta e borda para elementos similares | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Legenda** quando há semântica de borda/linha (ex.: sólido = síncrono, tracejado = assíncrono) | ✅ | ✅ | — | ✅ | ✅ |
| **Contraste suficiente**; **não depender só de cor** — parear cor com padrão | ✅ | — | ✅ | ✅ | ✅ |
| **Camadas, não sobrecarga**: revelação progressiva, contexto → container → componente | ✅ | ✅ | — | ✅ | ✅ |
| **Metadados** no diagrama: título, descrição, data de atualização, autor, versão | ✅ | — | — | — | ✅ (título) |
| **Precisão acima de simplificação**: não desenhar algo que a arquitetura não faz | ✅ | — | — | — | — |
| **Versionar o fonte do diagrama** junto do código | ✅ | ✅ (DaC) | — | — | — |

Citações-chave da Microsoft (a fonte oficial mais prescritiva que existe hoje):

> "**Use directional arrows.** Lines without arrows make relationships unclear. Always use
> arrows, and when bi-directional communication exists, either show two separate flows
> (preferred) or annotate a single arrow with request/response notes."
>
> "**Avoid bidirectional arrows.** Double arrows imply bidirectional dependencies, which
> can create confusion."
>
> "**Maintain consistency.** Use standardized colors, casing, icons, icon sizes, line
> weights, line types, arrow heads, and border styles for similar elements."
>
> "**Be accurate.** While diagrams are abstractions, don't sacrifice accuracy for
> unnecessary simplicity. For example, don't depict a PaaS service inside a subnet if
> it's actually accessed over a private endpoint."
>
> "**Design for accessibility.** Ensure sufficient color contrast. Avoid relying solely
> on color to distinguish types, instead consistently pair color with pattern."
>
> "**Layer, don't overload.** ... Provide progressive disclosure: a context diagram leads
> to a container diagram, which leads to a focused component or sequence diagram."

Deck oficial da AWS (slides DO/DON'T):
- DO: "Use icons at their **predefined size, color and format** in diagrams."
- DON'T: cortar, espelhar, girar ícones ou alterar a forma do ícone.
- Groups: DON'T redimensionar os ícones de grupo; DON'T criar grupos com ícones não aprovados.
- Arrows: DO "use the **preset arrows** provided in the Elements section"; DON'T usar outras.
- Labels: nome de serviço em **no máximo duas linhas**; "Amazon" na mesma linha da primeira
  palavra; DON'T quebrar no meio da palavra; DON'T duplicar formas curtas entre serviços.
- Callouts: tamanhos predefinidos, numeração linear; DON'T misturar tamanhos nem usar letras.

IBM adiciona a convenção de borda mais explícita de todas:
- **Container group** (relação `deployedOn`, localização lógica/virtual/física): **borda sólida**,
  ícone no canto superior esquerdo.
- **Zone / non-container group** (relação `deployedTo`): **borda tracejada**.
- Grupos aninhados **alternam preenchimento branco / claro por acessibilidade**.

### 3.2 Onde divergem

1. **Densidade normativa.** A Microsoft publica um ruleset completo de diagramação.
   A AWS publica **quase nada de layout** — a página oficial de ícones traz regras de uso
   do ícone, não de composição do diagrama; nem VPC/subnet/AZ têm regra escrita de nesting
   publicada como norma. **Consequência prática: para regras de layout AWS, a autoridade
   textual mais forte é Microsoft + C4, e a AWS entra como autoridade de vocabulário visual
   (ícones e grupos), não de gramática.**
2. **Bidirecional.** Microsoft e C4 proíbem seta dupla. AWS, Google e IBM não se pronunciam.
3. **Cor.** IBM prescreve paleta por domínio (Network=Cyan 50, Compute=Blue 60, Data=Purple 70,
   Storage=Teal 60, Security=Red 60, Management=Gray 100) e preenchimentos alternados em
   grupos aninhados. AWS prescreve cor **de ícone** mas não semântica de cor de grupo.
   C4 deixa cor livre. **Não há consenso sobre semântica de cor** — então cor não pode ser
   o único portador de significado (o que a WCAG já exigia).
4. **Metadados.** Só a Microsoft exige data/versão/autor no artefato.
5. **Legenda.** C4 a torna obrigatória sempre; Microsoft a torna condicional ("se você
   introduz semântica de borda ou linha"); AWS menciona legenda apenas descritivamente.
   **Adote a regra mais forte (C4): legenda sempre.**

---

## 4. Literatura de graph drawing — o que ordena o impacto

### 4.1 A ordenação clássica

Purchase (1997) testou cinco estéticas com medição de tempo e erro e concluiu:

> "reducing the number of **edge crosses** is by far the most important aesthetic, while
> minimising the number of **bends** and maximising **symmetry** have a lesser effect."

Fonte: H. C. Purchase, *Which aesthetic has the greatest effect on human understanding?*,
Graph Drawing 1997, LNCS 1353, Springer.

**Esta é a resposta direta à pergunta "existe paper que ordena?": sim, e a ordem é
cruzamentos ≫ dobras ≈ simetria.**

### 4.2 Refinamentos que mudam a regra

- **O ângulo do cruzamento importa mais do que a contagem.** Huang, Eades & Hong mostram
  que cruzamentos deixam de atrapalhar quando o ângulo é grande; o tempo de resposta cai
  conforme o ângulo aumenta e estabiliza perto de 90°. Ângulos pequenos "disparam
  movimentos oculares extras e causam atraso em tarefas de busca de caminho", mas
  "cruzamentos têm pouco impacto em tarefas de localizar nó".
  Fontes: W. Huang, P. Eades, S.-H. Hong, C.-C. Lin, *Larger crossing angles make graphs
  easier to read*, J. Visual Languages & Computing 25(4):452–465, 2014; W. Huang,
  *An Eye Tracking Study into the Effects of Graph Layout*, arXiv:0810.4431.
  O valor **70°** virou o "ângulo ideal" de referência na literatura de métricas
  (Dunne et al. 2015; `greadability.js`), derivado desses experimentos.
- **Continuidade é quase tão importante quanto cruzamentos.** Ware, Purchase, Colpoys &
  McGill: "after the length of the path the two most important factors are **continuity**
  and **edge crossings**"; outro fator relevante é "o número de ramos saindo dos nós do
  caminho". Continuidade = manter caminhos multi-aresta o mais retos possível.
  Fonte: *Cognitive Measurements of Graph Aesthetics*, Information Visualization 1(2):103–110, 2002.
- **Cruzamentos deixam de importar em grafos grandes.** Kobourov, Pupyrev & Saket:
  "increasing the number of crossings negatively impacts accuracy and performance time,
  and that impact is **significant for small graphs but not significant for large graphs**."
  Fonte: *Are Crossings Important for Drawing Large Graphs?*, Graph Drawing 2014, pp. 234–245.
  → Para diagramas de arquitetura (dezenas de nós), estamos no regime "pequeno": **cruzamento
  importa**.
- **O domínio semântico muda quais estéticas pesam.** Purchase, Carrington & Allder:
  "the use of only some aesthetics affect usability significantly, and **the semantic domain
  of the graph drawings affects which aesthetic criteria need to be emphasised**."
  Fonte: *Empirical evaluation of aesthetics-based graph layout*, Empirical Software
  Engineering 7(3):233–255, 2002. → Caveat central: os efeitos medidos em grafos abstratos
  **não transferem automaticamente** para diagramas com significado (UML, arquitetura).

### 4.3 As métricas com fórmula fechada e normalizada [0,1]

Purchase (2002) definiu métricas contínuas normalizadas para sete critérios (cruzamento de
aresta, dobras, ângulo mínimo entre arestas incidentes, ortogonalidade, simetria, direção de
fluxo, variação de comprimento de aresta), "so that aesthetic quality is not stated as a
binary conformance decision ... but can be stated as the extent of aesthetic conformance
using a number between 0 and 1".
Fonte: H. C. Purchase, *Metrics for Graph Drawing Aesthetics*, J. Visual Languages &
Computing 13(5):501–516, 2002.

A versão moderna, com **fórmulas explícitas e implementação de referência**, está em
Mooney, Hegemann, Wolff, Wybrow & Purchase, *Universal Quality Metrics for Graph Drawings*,
GD 2025, LIPIcs vol. 357, art. 30 (CC-BY; código: `github.com/gavjmooney/geg`), que estende
Mooney et al., PacificVis 2024. **Todas as fórmulas de §A vêm daí.** Convenção: valor 1 = melhor.

### 4.4 Calibração empírica dos limiares

O mesmo paper GD 2025 computou as dez métricas sobre **4.890 desenhos extraídos de 27 anos
de anais do simpósio Graph Drawing** (majoritariamente desenhados à mão por especialistas,
mediana de 11 nós — faixa comparável à de um diagrama de arquitetura). Esses percentis são
a melhor referência disponível de "como é um desenho bom feito por especialista":

| Métrica (1 = melhor) | Q1 | Mediana | Q3 |
|---|---|---|---|
| Edge Crossings (EC) | 0,966 | **1,000** | 1,000 |
| Crossing Angle (CA) | 0,762 | **1,000** | 1,000 |
| Edge Length Deviation (ELD) | 0,647 | **0,719** | 0,802 |
| Node Uniformity (NU) | 0,500 | **0,600** | 0,714 |
| Edge Orthogonality (EO) | 0,486 | **0,559** | 0,708 |
| Angular Resolution (AR) | 0,352 | **0,488** | 0,657 |
| Kruskal Stress (KSM) | 0,618 | **0,686** | 0,766 |
| Neighbourhood Preservation (NP) | 0,341 | **0,500** | 0,650 |
| Aspect Ratio (Asp) | 0,499 | **0,750** | 0,920 |
| Node Resolution (NR) | 0,067 | **0,127** | 0,207 |

**Política de limiar que adoto abaixo: `warn` no Q1, `target` na mediana.** É defensável
("abaixo do quartil inferior do que especialistas produzem") e não inventada.

---

## 5. Acessibilidade

Normas WCAG 2.2 (W3C Recommendation) aplicadas a diagrama:

- **SC 1.4.3 Contrast (Minimum), nível AA** — texto normal ≥ **4,5:1**; texto grande ≥ **3:1**.
  Texto grande = "at least 18 point or 14 point bold" (≈ 24 px, ou 18,5 px em negrito).
  Exceções: texto puramente decorativo, texto que faz parte de logotipo/marca.
  (AAA / SC 1.4.6: 7:1 e 4,5:1.)
- **SC 1.4.11 Non-text Contrast, nível AA** — ≥ **3:1** contra cores adjacentes para
  "parts of graphics required to understand the content". O entendimento do W3C é explícito
  de que isso cobre diagramas: "the important parts of a more complex diagram such as each
  line in a graph". → Bordas de caixa, linhas de aresta, pontas de seta e bordas de grupo
  precisam de 3:1 contra o fundo em que estão.
- **SC 1.4.1 Use of Color, nível A** — "Color is not used as the only visual means of
  conveying information, indicating an action, prompting a response, or distinguishing a
  visual element." Contraste ≥3:1 entre cores adjacentes conta como distinção adicional
  **apenas** quando as cores diferem em matiz **e** luminosidade; se o conteúdo depende de
  identificar a cor em si, "an additional visual indicator will be required regardless of
  the contrast ratio".
- **Fórmula** (WCAG Technique G18): `L = 0.2126R + 0.7152G + 0.0722B` sobre canais sRGB
  linearizados (`c ≤ 0.04045 → c/12.92`, senão `((c+0.055)/1.055)^2.4`); razão de contraste
  `(L1 + 0.05) / (L2 + 0.05)`.
- **Google developer documentation style guide** reforça de forma independente:
  "Pick colors that respect accessible color contrast ratios (4.5:1 for text)" e
  "avoid relying solely on visual cues like color, shape, or directional words";
  além disso, "avoid embedding explanatory text in ... graphics; text that's incorporated
  into a graphic hurts accessibility and searchability" → **o diagrama precisa de descrição
  textual equivalente fora da imagem**.
- **Microsoft** e **IBM** convergem: Microsoft manda "consistently pair color with pattern";
  IBM alterna preenchimentos em grupos aninhados explicitamente "for accessibility".

**Ponto não óbvio e mecanizável**: o fundo efetivo de um rótulo dentro de um diagrama
com grupos aninhados **não é o fundo do canvas** — é a cor do grupo mais interno que o
contém. O cálculo de contraste precisa resolver a pilha de preenchimentos por z-order.

---

## 6. Limites de carga cognitiva — evidência vs. folclore

**Resposta curta: existe evidência de degradação com o tamanho, mas os números redondos
que circulam (7±2 elementos, "máximo 10 caixas") são folclore quando aplicados a diagramas.**

O que a evidência sustenta:

1. **Correlação negativa forte entre tamanho do diagrama e desempenho do leitor.**
   Störrle: "there is a **strong negative correlation between diagram size and modeler
   performance**", resultados "highly significant"; e especialistas se beneficiam **menos**
   de melhoria de layout do que novatos.
   Fontes: H. Störrle, *On the Impact of Layout Quality to Understanding UML Diagrams:
   Size Matters*, MODELS 2014, LNCS 8767; e *On the impact of size to the understanding of
   UML diagrams*, Software & Systems Modeling, 2016.
2. **Node-link degrada acima de ~20 vértices** em comparação a matriz, para a maioria das
   tarefas — exceto busca de caminho, onde node-link continua vencendo.
   Fonte: Ghoniem, Fekete & Castagliola, *A Comparison of the Readability of Graphs Using
   Node-Link and Matrix-Based Representations*, IEEE InfoVis 2004; versão estendida em
   *Information Visualization* 4(2), 2005.
3. **Os "cortes" que a comunidade usa na prática são 20 / 50 / 200 nós.** O survey de 152
   estudos empíricos encontra "clear cuts at 20, 50, and 200 nodes" (pequeno ≤20,
   médio 21–50, grande 51–200, muito grande >200) e que três quartos dos estudos usam
   grafos com ≤100 nós e ≤200 arestas; 78% usam densidade <10%.
   Fonte: Yoghourdjian, Archambault, Diehl, Dwyer, Klein, Purchase & Wu,
   *Exploring the Limits of Complexity: A Survey of Empirical Studies on Graph Visualisation*,
   arXiv:1809.00270 (2018).
4. **Mas os próprios autores desse survey desmontam o limiar como evidência:**
   > "Our findings indicate a threshold at 200 nodes and 10% density. ... Nonetheless, we
   > believe that this threshold is a result of the **expert intuition of the researchers,
   > rather than empirical research**. A controlled study is needed to validate and refine
   > this threshold."
5. **Decompor funciona, e o efeito é grande.** Sobre modularizar e estruturar
   hierarquicamente diagramas: "Experimental studies show that this can improve end user
   understanding of RE diagrams by **more than 50%**."
   Fonte: D. L. Moody & P. Heymans, *Improving the Effectiveness of Visual Representations
   in Requirements Engineering*, RE'09 (aplicação do *Physics of Notations*).
6. **O único limite numérico rigorosamente derivado se aplica ao VOCABULÁRIO, não à
   contagem de caixas.** Moody define *graphic complexity* = "the number of different symbols
   used in a notation ... measured by the **number of legend entries required**", e:
   > "the human ability to discriminate between perceptually distinct alternatives
   > (**span of absolute judgement**) is around **6 categories**: this defines an effective
   > upper limit for graphic complexity."
   DFD tem complexidade gráfica 4, ER e Use Case têm 5, i* tem 175. Isso é **explicitamente
   distinto** da complexidade no nível do diagrama (tokens).
   Fontes: Moody & Heymans (RE'09); D. L. Moody, *The "Physics" of Notations*,
   IEEE TSE 35(6):756–779, 2009.
7. **Miller (1956) e Cowan (2001) são sobre memória de trabalho, não sobre diagramas.**
   Miller "seven plus or minus two" é descrito no próprio survey de graph drawing como
   "commonly accepted as a **rule-of-thumb**". Cowan revisou para ~4 chunks. Nenhum dos dois
   mediu leitura de diagrama — o diagrama fica na tela, é memória externa. Usar 7±2 como
   limite de caixas por diagrama é extrapolação sem suporte.
   Fontes: G. A. Miller, *The Magical Number Seven, Plus or Minus Two*, Psychological Review
   63(2), 1956; N. Cowan, *The magical number 4 in short-term memory*, Behavioral and Brain
   Sciences 24(1):87–114, 2001.

**Recomendação operacional defensável**: `warn` em >20 elementos de primeira classe
(nós de serviço, excluindo caixas de grupo) porque é o ponto onde node-link começa a perder
para outras representações (Ghoniem) e é o corte "pequeno" do survey; `fail` em >50, o corte
"médio→grande". E `fail` em >6 entradas de legenda (Moody). Ambos rotulados como o que são:
o primeiro é convenção calibrada, o segundo é derivado de limite perceptual.

---

# (A) CHECAGENS MECANIZÁVEIS

Formato de cada checagem:
**`ID · Nome`** — *o que mede* · **Computar:** como · **Limiar:** valor · **Fonte:** origem ·
**Severidade:** `fail` (bloqueia) / `warn` (reporta).

Convenção: métricas normalizadas seguem GD 2025 — **1 = melhor**.

---

## A1 · Completude semântica

> Não é geometria, é presença de campos. É o grupo mais barato de implementar e o de
> maior retorno: é literalmente o checklist do C4 transformado em asserção.

**`A1.1 · Título presente`** — o diagrama se descreve sozinho.
· **Computar:** `meta.title` não vazio; contém tipo de diagrama e escopo (ex.: regex por
`(Context|Container|Component|Deployment|Network|Data flow)` + nome do sistema).
· **Limiar:** presente. · **Fonte:** C4 (`/diagrams/notation`); Azure WAF ("Include metadata").
· **Severidade:** `fail`.

**`A1.2 · Legenda presente`**
· **Computar:** `legend` não vazia.
· **Limiar:** presente. · **Fonte:** C4 ("Every diagram should have a key/legend").
· **Severidade:** `fail`.

**`A1.3 · Legenda completa (cobertura de canal visual)`** — todo canal usado é explicado.
· **Computar:** para cada canal `c ∈ {fill, stroke, stroke_style, shape, arrowhead, icon_family,
node_size_class}`, colete o conjunto de valores distintos efetivamente usados no canvas;
verifique que cada valor tem entrada correspondente em `legend`. Reporte `valores_sem_entrada`.
· **Limiar:** `|valores_sem_entrada| = 0`.
· **Fonte:** C4 review checklist (cores, formas, ícones, estilos de borda, tamanhos, pontas de
seta, estilos de linha); Azure WAF ("Provide a legend" se há semântica de borda/linha).
· **Severidade:** `fail`.

**`A1.4 · Todo elemento nomeado`**
· **Computar:** `∀ node,group: label ≠ ""`. · **Limiar:** 100%.
· **Fonte:** C4 checklist; Azure WAF ("Label everything clearly ... each icon, grouping
container, and relationship"); Azure Icons ("include the product name somewhere close to the icon").
· **Severidade:** `fail`.

**`A1.5 · Todo elemento tipado`**
· **Computar:** `∀ node,group: type ∈ catálogo`. · **Limiar:** 100%.
· **Fonte:** C4 ("The type of every element should be explicitly specified").
· **Severidade:** `fail`.

**`A1.6 · Toda aresta rotulada`**
· **Computar:** `∀ edge: label ≠ ""`. · **Limiar:** 100%.
· **Fonte:** C4 ("Every line should be labelled"); Azure WAF.
· **Severidade:** `fail`.

**`A1.7 · Toda aresta unidirecional`**
· **Computar:** `∀ edge: count(arrowheads) == 1`. · **Limiar:** 0 arestas bidirecionais.
· **Fonte:** C4 ("Every line should represent a unidirectional relationship"); Azure WAF
("Avoid bidirectional arrows ... Use single-ended arrows"). · **Severidade:** `fail`.

**`A1.8 · Nenhuma linha sem seta`**
· **Computar:** `∀ edge: count(arrowheads) ≥ 1`. · **Limiar:** 100%.
· **Fonte:** Azure WAF ("Lines without arrows make relationships unclear. Always use arrows").
· **Severidade:** `fail`.

**`A1.9 · Siglas expandidas`**
· **Computar:** tokenize todos os rótulos; casar contra regex de sigla (`\b[A-Z]{2,}\b`),
subtraindo whitelist de nomes de serviço AWS oficiais; toda sigla restante deve aparecer
expandida no diagrama ou na legenda.
· **Limiar:** 0 siglas não explicadas. · **Fonte:** C4 ("Acronyms and abbreviations ... should
be understandable by all audiences, or explained in the diagram key/legend").
· **Severidade:** `warn`.

**`A1.10 · Um nível de abstração`**
· **Computar:** `|distinct(node.abstraction_level)| == 1`.
· **Limiar:** 1. · **Fonte:** C4 FAQ ("each of the separate diagrams tells a different part of
the same overall story, at the same level of abstraction"); Azure WAF ("Layer, don't overload").
· **Severidade:** `fail`.

**`A1.11 · Metadados de frescor`**
· **Computar:** `meta.date`, `meta.version`, `meta.author` presentes.
· **Limiar:** presentes. · **Fonte:** Azure WAF ("Include elements such as title, description,
last updated date, author, version, and external references"). · **Severidade:** `warn`.

**`A1.12 · Nenhum shape órfão`** — todo traço mapeia a um fato da arquitetura (data-ink).
· **Computar:** todo objeto de desenho no canvas pertence a `nodes ∪ groups ∪ edges ∪ labels
∪ legend ∪ title`. Contar objetos não referenciados.
· **Limiar:** 0. · **Fonte:** Tufte, *Visual Display*, "Erase non-data-ink" (adaptado: tinta que
não corresponde a entidade). · **Severidade:** `fail`.

---

## A2 · Notação, consistência e vocabulário

**`A2.1 · Complexidade gráfica ≤ 6`**
· **Computar:** `|legend|` (número de entradas distintas necessárias).
· **Limiar:** `≤ 6`; `warn` em 7–8; `fail` acima.
· **Fonte:** Moody, *Physics of Notations* — "graphic complexity ... measured by the number of
legend entries required"; "span of absolute judgement is around 6 categories: this defines an
effective upper limit". · **Severidade:** `warn` (7–8) / `fail` (>8).
· **Nota:** conta **tipos de símbolo**, não instâncias. Vinte Lambdas = 1 entrada.

**`A2.2 · Ícone íntegro`**
· **Computar:** para cada `node`, a matriz de transformação do ícone é `[s 0; 0 s]` com `s > 0`
(escala uniforme, sem rotação, sem espelhamento, sem cisalhamento) e `clip` ausente.
· **Limiar:** 100% dos ícones. · **Fonte:** AWS deck (DON'T crop/flip/rotate/change shape);
Azure Icons ("Don't crop, flip, or rotate icons. Don't distort or change icon shape in any way");
Azure WAF ("Don't stretch or recolor brand shapes arbitrarily"). · **Severidade:** `fail`.

**`A2.3 · Cor de ícone não alterada`**
· **Computar:** hash dos pixels/paths do ícone renderizado == hash do asset oficial.
· **Limiar:** igual. · **Fonte:** AWS deck (DO "use icons at their predefined size, color and
format"); Azure WAF. · **Severidade:** `fail`.

**`A2.4 · Ícone do catálogo oficial e atual`**
· **Computar:** `icon_id ∈ catálogo AWS do trimestre corrente`; sinalizar ids em conjunto legado.
· **Limiar:** 100%. · **Fonte:** AWS Architecture Icons ("check that you're using up-to-date
icons, because some libraries may contain legacy icon sets"; releases trimestrais).
· **Severidade:** `warn`.

**`A2.5 · Tamanho de ícone uniforme por classe`**
· **Computar:** agrupar nós por `type_class` (serviço / ator / sistema externo); dentro de cada
classe, `max(w)/min(w) == 1`.
· **Limiar:** razão `== 1` dentro da classe. · **Fonte:** Azure WAF ("Use standardized ... icons,
icon sizes ... for similar elements"). · **Severidade:** `fail`.

**`A2.6 · Codificação visual consistente por tipo`**
· **Computar:** para cada `type`, `|distinct(fill)| == 1 ∧ |distinct(stroke)| == 1 ∧
|distinct(stroke_width)| == 1 ∧ |distinct(stroke_style)| == 1 ∧ |distinct(shape)| == 1`.
· **Limiar:** 1 valor por canal por tipo. · **Fonte:** Azure WAF ("Maintain consistency"); C4;
Gestalt/similaridade (Kobourov et al.: "same shape implies similar properties").
· **Severidade:** `fail`.

**`A2.7 · Estilo de linha semanticamente consistente`**
· **Computar:** construir a relação `stroke_style → conjunto de tipos-de-relação`; falhar se
um estilo mapeia a mais de um significado, ou um significado a mais de um estilo.
· **Limiar:** bijeção. · **Fonte:** Azure WAF ("Avoid ambiguous lines. Be consistent in how you
represent these relationships"); C4 checklist. · **Severidade:** `fail`.

**`A2.8 · Borda de grupo segue a convenção containment vs. deployment`**
· **Computar:** grupos que representam localização/containment → `stroke_style = solid`;
grupos que representam relação lógica de deployment/zona → `stroke_style = dashed`.
· **Limiar:** 100% conforme o mapa de convenção adotado.
· **Fonte:** IBM Cloud architecture-icons (container group = borda sólida para `deployedOn`;
zone/non-container group = borda tracejada para `deployedTo`); AWS deck (grupos com estilos de
borda distintos por tipo). · **Severidade:** `warn`.
· **Nota:** ver Incertezas — o mapa exato de cor/estilo por grupo AWS não está publicado como
norma textual pela AWS; extraia-o programaticamente do asset oficial em vez de hard-codar.

**`A2.9 · Rótulo de serviço com no máximo 2 linhas, sem quebra intra-palavra`**
· **Computar:** contar quebras de linha do rótulo renderizado; verificar que nenhuma quebra
ocorre dentro de um token.
· **Limiar:** `≤ 2` linhas, 0 quebras intra-palavra. · **Fonte:** AWS deck, slide de Labels.
· **Severidade:** `warn`.

**`A2.10 · Setas do conjunto predefinido`**
· **Computar:** `arrowhead_style ∈ {presets AWS}`.
· **Limiar:** 100%. · **Fonte:** AWS deck ("Use the preset arrows provided in the Elements
section"). · **Severidade:** `warn`.

**`A2.11 · Sem chartjunk`**
· **Computar:** nenhum objeto possui `filter`, `box-shadow`, `drop-shadow`, gradiente,
`transform: perspective/rotate3d`, bisel, textura ou clip-art fora do catálogo.
· **Limiar:** 0 ocorrências. · **Fonte:** Tufte, *Visual Display*, cap. 5 (chartjunk);
Azure WAF ("Use standard notations"). · **Severidade:** `fail`.

---

## A3 · Sobreposição e legibilidade espacial

> Esta família é a de maior valor prático: são falhas duras, tolerância zero, trivialmente
> computáveis, e são exatamente o que um gerador automático erra.

**`A3.1 · Sobreposição nó–nó (node occlusion)`**
· **Computar:** para todo par `(a,b)` de nós/grupos-irmãos: `área(rect(a) ∩ rect(b)) > 0`.
· **Limiar:** **0 pares**. Além disso exigir folga mínima `gap ≥ 8 px` (ou `≥ 0.25 × altura do
ícone`) entre retângulos não aninhados.
· **Fonte:** Purchase 2002 e Dunne et al. 2015 (métrica *node occlusion*: "two nodes are
considered occluded if the distance between them is less than a defined diameter");
Azure WAF ("Avoid ambiguous..."). · **Severidade:** `fail`.

**`A3.2 · Sobreposição rótulo–rótulo`**
· **Computar:** interseção de bounding boxes de texto, com padding de 2 px.
· **Limiar:** 0 pares. · **Fonte:** Dunne et al. 2015; C4 checklist (legibilidade do rótulo).
· **Severidade:** `fail`.

**`A3.3 · Rótulo transbordando sua caixa`**
· **Computar:** `text.bbox ⊄ node.rect` (com padding interno mínimo).
· **Limiar:** 0. · **Fonte:** AWS deck (regras de Labels); consequência direta de A1.4.
· **Severidade:** `fail`.

**`A3.4 · Sobreposição rótulo–aresta`**
· **Computar:** interseção do bbox do texto com qualquer segmento de aresta que não seja a
aresta dona do rótulo.
· **Limiar:** 0. · **Fonte:** Dunne et al. 2015 (*node-edge occlusion*, generalizado a texto).
· **Severidade:** `fail`.

**`A3.5 · Aresta atravessando nó (node–edge occlusion)`**
· **Computar:** para cada aresta `e` e nó `n ∉ {source(e), target(e)}`: interseção de
`polyline(e)` com `rect(n)`.
· **Limiar:** **0**. · **Fonte:** Dunne et al. 2015; Azure WAF ("Avoid ambiguous lines").
· **Severidade:** `fail`.

**`A3.6 · Ancoragem de seta`**
· **Computar:** o primeiro ponto de `e` está sobre o perímetro de `rect(source)` ±2 px e o
último sobre o perímetro de `rect(target)` ±2 px.
· **Limiar:** 100% das arestas. · **Fonte:** consequência de A1.6/A1.8 (rótulo consistente com
a direção exige extremidades inequívocas); Azure WAF. · **Severidade:** `fail`.

**`A3.7 · Nada fora do canvas`**
· **Computar:** bounding box da união de todos os objetos ⊆ `canvas`, com margem `≥ 16 px`.
· **Limiar:** contido. · **Fonte:** requisito de render; nenhum guia precisa dizer.
· **Severidade:** `fail`.

**`A3.8 · Resolução de nó (NR)`** — o menor par de nós não fica desproporcionalmente colado.
· **Computar:** `NR = min‖u−v‖ / max‖u−v‖` sobre todos os pares de centros de nós.
· **Limiar:** `warn` se `NR < 0,067` (Q1 de desenhos de especialista); alvo `≥ 0,127` (mediana).
· **Fonte:** Mooney et al., GD 2025, eq. (9) + Tabela 2. · **Severidade:** `warn`.

**`A3.9 · Tamanho mínimo de fonte`**
· **Computar:** `font_size_px` efetivo após todas as escalas do pipeline de render.
· **Limiar:** `≥ 12 px` para rótulos de aresta e descrições; `≥ 14 px` para nomes de elemento.
· **Fonte:** derivado — **não** é regra WCAG (WCAG normatiza contraste, não tamanho); o valor
vem da fronteira de "texto grande" da SC 1.4.3 (18 pt / 14 pt bold) usada ao contrário: abaixo
de 18 pt vale a exigência de 4,5:1, e 12 px é o piso prático abaixo do qual o texto deixa de ser
legível em impressão/slide. **Rotulado como default de engenharia.** · **Severidade:** `warn`.

---

## A4 · Agrupamento e região comum (Gestalt)

> Em diagrama AWS, esta família carrega a semântica mais forte do desenho: a caixa de VPC
> **é** a fronteira de rede. Erro aqui não é feio, é **factualmente errado**.

**`A4.1 · Contenção estrita`** — todo filho dentro do pai.
· **Computar:** `∀ child: rect(child) ⊆ rect(parent)` com padding interno `p ≥ 12 px`
em todos os quatro lados.
· **Limiar:** 100%, tolerância 0. · **Fonte:** Gestalt/região comum (Kobourov, Mchedlidze &
Vonessen); Azure WAF ("Be accurate ... don't depict a PaaS service inside a subnet if it's
actually accessed over a private endpoint"). · **Severidade:** `fail`.

**`A4.2 · Não-membro fora da região`** — nenhum nó cai dentro de um grupo do qual não é filho.
· **Computar:** `∀ node n, group g: n.parent ≠ g ⇒ área(rect(n) ∩ rect(g)) == 0`.
· **Limiar:** 0 violações. · **Fonte:** mesma de A4.1. Esta é a **falha de maior gravidade
semântica de todo o validador**: comunica pertencimento a uma fronteira de rede que não existe.
· **Severidade:** `fail`.

**`A4.3 · Grupos irmãos disjuntos`**
· **Computar:** para grupos `g1,g2` com o mesmo `parent` e sem relação de ancestralidade:
`área(rect(g1) ∩ rect(g2)) == 0`.
· **Limiar:** 0. · **Fonte:** região comum; a hierarquia AWS (Region ⊃ VPC ⊃ AZ ⊃ Subnet)
é uma árvore, e desenho de árvore com irmãos sobrepostos é ambíguo. · **Severidade:** `fail`.

**`A4.4 · Aninhamento geométrico == aninhamento lógico`**
· **Computar:** derive a árvore de contenção puramente da geometria (quem está dentro de quem)
e compare, por igualdade de estrutura, com `parent` declarado.
· **Limiar:** árvores idênticas. · **Fonte:** Azure WAF ("Be accurate"); região comum.
· **Severidade:** `fail`.

**`A4.5 · Padding de grupo uniforme`**
· **Computar:** para cada grupo, desvio padrão dos quatro paddings internos até o bbox dos
filhos; e desvio entre grupos do mesmo `type`.
· **Limiar:** `σ ≤ 4 px` intra-grupo; mesmo padding nominal entre grupos do mesmo tipo.
· **Fonte:** Azure WAF ("Maintain consistency"); similaridade Gestalt. · **Severidade:** `warn`.

**`A4.6 · Rótulo de grupo em posição canônica`**
· **Computar:** o rótulo e o ícone do grupo estão no canto superior esquerdo interno do
retângulo, e não colidem com nenhum filho.
· **Limiar:** 100%. · **Fonte:** IBM ("icons in upper left corners"); AWS deck (Groups).
· **Severidade:** `warn`.

**`A4.7 · Razão de proximidade intra/inter grupo`** — proximidade Gestalt operacionalizada.
· **Computar:** `ρ = média(distância entre centros de nós do mesmo grupo) / média(distância
entre centros de nós de grupos distintos)`.
· **Limiar:** `ρ ≤ 0,6`; `warn` acima. · **Fonte:** princípio de proximidade formalizado em
Kobourov, Mchedlidze & Vonessen ("nós próximos são percebidos como grupos"). **Valor do
limiar é default de engenharia**, não medido. · **Severidade:** `warn`.

---

## A5 · Roteamento de arestas

**`A5.1 · Cruzamentos de aresta (EC)`** — a estética de maior impacto medido.
· **Computar:** `EC = 1 − c/c_max`, onde `c = Σ_x |E(x)|²` sobre pontos de interseção,
`c_max = C(|E|,2) − Σ_v C(deg(v),2)`.
· **Limiar:** alvo `EC = 1,0` (mediana de especialistas); `warn` se `EC < 0,966` (Q1).
Em termos absolutos, para um diagrama de arquitetura típico (<50 arestas): **alvo 0 cruzamentos**,
`warn` em ≥1, `fail` em >`⌈|E|/10⌉`.
· **Fonte:** Purchase 1997 ("reducing the number of edge crosses is by far the most important
aesthetic"); fórmula em Mooney et al., GD 2025, eq. (3); percentis na Tabela 2 do mesmo.
· **Severidade:** `warn` → `fail` acima do orçamento.

**`A5.2 · Ângulo de cruzamento (CA)`** — quando cruzar for inevitável, cruze reto.
· **Computar:** `CA = 1 − (1/|X|) Σ |(90° − φ_min)/90°|` sobre todos os pares cruzantes.
Reporte também `min_angle` absoluto.
· **Limiar:** `min_angle ≥ 70°` (alvo); **`fail` se `min_angle < 30°`**; `warn` se `CA < 0,762` (Q1).
· **Fonte:** Huang, Eades, Hong & Lin, *Larger crossing angles make graphs easier to read*
(JVLC 2014) — tempo de resposta cai com o ângulo e estabiliza perto de 90°; 70° é o valor ideal
adotado por Dunne et al. 2015 e `greadability.js`. Fórmula: Mooney et al., GD 2025, eq. (2).
· **Severidade:** `warn` / `fail` abaixo de 30°.

**`A5.3 · Número de dobras por aresta`**
· **Computar:** `bends(e) = |points(e)| − 2`. Reporte máximo e média.
· **Limiar:** `≤ 2` por aresta (alvo `≤ 1`); `fail` em `> 4`.
· **Fonte:** Purchase 1997 (minimizar dobras — efeito menor que cruzamentos, mas real);
Gestalt/continuação (Kobourov et al.: "uma aresta pode ser seguida mais facilmente quando tem
poucas dobras"). **O valor 2 é default de engenharia.** · **Severidade:** `warn` / `fail` >4.

**`A5.4 · Ângulo de dobra`** — dobras não podem ser agudas.
· **Computar:** para cada vértice interno da polilinha, o ângulo interno entre segmentos.
· **Limiar:** `≥ 90°`; `fail` abaixo de 60°.
· **Fonte:** Gestalt/continuação — "poucas dobras **que não sejam bruscas**"; a mesma fonte
observa que desenhos ortogonais inclinados substituem dobras de 90° por diagonais justamente
por isso. · **Severidade:** `warn` / `fail` <60°.

**`A5.5 · Aresta atravessando fronteira espúria`**
· **Computar:** para cada aresta `e` e grupo `g`: se `polyline(e) ∩ rect(g) ≠ ∅` mas nem
`source(e)` nem `target(e)` são descendentes de `g` **e** `g` não é ancestral comum, marcar.
· **Limiar:** 0. · **Fonte:** região comum (Gestalt) + Azure WAF ("Be accurate"). Aresta que
corta uma VPC alheia sugere um caminho de rede inexistente. · **Severidade:** `fail`.

**`A5.6 · Ortogonalidade de aresta (EO)`** — só se o estilo declarado for ortogonal.
· **Computar:** `EO = 1 − (1/|E|) Σ_e δ_e`, com `δ_e` = desvio angular ponderado por
comprimento até o eixo mais próximo, escalado por 45°.
· **Limiar:** se `style == orthogonal`: alvo `EO ≥ 0,90`. Se `style == straight`: `warn` só se
`EO < 0,486` (Q1) — ou seja, mistura desordenada de ângulos.
· **Fonte:** Mooney et al., GD 2025, eqs. (5)–(6); Purchase 2002 (ortogonalidade entre os sete
critérios). · **Severidade:** `warn`.

**`A5.7 · Direção de fluxo consistente`**
· **Computar:** projete o vetor `target − source` de cada aresta no eixo dominante escolhido
(ex.: esquerda→direita); `flow = fração de arestas com projeção > 0`, ignorando arestas
perpendiculares dentro de ±15°.
· **Limiar:** `flow ≥ 0,90`; `warn` abaixo.
· **Fonte:** "consistent flow direction" está entre os sete critérios de Purchase 2002;
Gestalt/similaridade (Kobourov et al.: "directed upward drawings indicate similar hierarchical
relations"). **O valor 0,90 é default de engenharia.** · **Severidade:** `warn`.

**`A5.8 · Arestas paralelas separadas`**
· **Computar:** duas arestas com o mesmo par `(source,target)` não podem ter polilinhas com
distância de Hausdorff `< 6 px`; e nenhuma aresta pode ter comprimento 0.
· **Limiar:** separação `≥ 6 px`. · **Fonte:** consequência de A1.6 (cada aresta tem rótulo
próprio e legível). · **Severidade:** `fail`.

**`A5.9 · Uniformidade de comprimento de aresta (ELD)`**
· **Computar:** `ELD = 1 / (1 + (1/|E|) Σ_e |L(e) − L_ideal| / L_ideal)`, com
`L_ideal = média dos comprimentos`.
· **Limiar:** `warn` se `ELD < 0,647` (Q1); alvo `≥ 0,719` (mediana).
· **Fonte:** fórmula em Mooney et al., GD 2025, eq. (4); critério em Purchase 2002; motivação
Gestalt/similaridade ("comprimentos de aresta uniformes ... capturam a noção de igual
importância das relações"). · **Severidade:** `warn`.
· **Caveat:** em diagramas com grupos aninhados, comprimentos naturalmente variam entre
intra-grupo e inter-grupo. **Calcule ELD separadamente por classe de aresta.**

---

## A6 · Distribuição e forma global

**`A6.1 · Resolução angular (AR)`** — arestas incidentes não saem "em leque colado".
· **Computar:** `AR = 1 − (1/|V_{>1}|) Σ_v |(ϑ_v − ϑ_v^min)/ϑ_v|`, com `ϑ_v = 360°/deg(v)`.
· **Limiar:** `warn` se `AR < 0,352` (Q1); alvo `≥ 0,488` (mediana). Adicionalmente,
**`fail` se o ângulo absoluto entre duas arestas incidentes ao mesmo nó for `< 15°`**
(indistinguíveis a olho).
· **Fonte:** Mooney et al., GD 2025, eq. (1); Purchase 2002. · **Severidade:** `warn`/`fail`.

**`A6.2 · Uniformidade de nós (NU)`** — sem aglomerado + vazio.
· **Computar:** grade `⌊√|V|⌋ × ⌈|V|/⌊√|V|⌋⌉` sobre o bbox; `NU = 1 − (1/D_max) Σ_i |n_i − μ|`,
`μ = |V|/T`, `D_max = 2|V|(T−1)/T`.
· **Limiar:** `warn` se `NU < 0,500` (Q1); alvo `≥ 0,600`.
· **Fonte:** Mooney et al., GD 2025, eq. (10). · **Severidade:** `warn`.

**`A6.3 · Razão de aspecto (Asp)`**
· **Computar:** `Asp = min(h,w)/max(h,w)` do bbox de tudo.
· **Limiar:** para render em página/slide, casar com o alvo: `warn` se `Asp < 0,499` (Q1 de
especialistas) **ou** se a razão do bbox difere da razão do canvas em mais de 20% (deixa faixas
vazias grandes).
· **Fonte:** Mooney et al., GD 2025 (definição + percentis). · **Severidade:** `warn`.

**`A6.4 · Alinhamento a grid`** — proxy computável de simetria/ordem.
· **Computar:** `align_x = 1 − |distinct(round(x_center / g))| / |V|` e análogo em `y`,
com passo de grade `g` (ex.: 8 px). Reporte também a fração de nós que compartilham `x` ou `y`
com pelo menos um outro nó.
· **Limiar:** `≥ 70%` dos nós alinhados a pelo menos um outro nó em `x` ou `y`.
· **Fonte:** literatura de graph aesthetics reporta que "aligning nodes and edges to an
underlying grid" é importante junto com remoção de cruzamentos; Gestalt/simetria via
"número pequeno de inclinações de aresta" (Kobourov et al.). **O valor 70% é default de
engenharia.** · **Severidade:** `warn`.
· **Nota:** este é o substituto operacional da simetria — ver B-1.

**`A6.5 · Preservação de vizinhança (NP)` / `Stress (KSM)`** — opcional.
· **Computar:** conforme Mooney et al., GD 2025, eqs. (7)–(8).
· **Limiar:** `warn` se `NP < 0,341` ou `KSM < 0,618` (Q1).
· **Fonte:** idem. · **Severidade:** `warn`.
· **Nota:** em diagrama de arquitetura, posição é ditada por grupos (VPC/AZ), não por
distância de grafo. **Baixa prioridade; provavelmente ruído.** Ver Incertezas.

---

## A7 · Acessibilidade cromática (tudo computável a partir de cores + geometria)

**`A7.1 · Contraste de texto`**
· **Computar:** resolver o **fundo efetivo** de cada rótulo pela pilha de z-order (grupo mais
interno que o contém, com composição alpha); aplicar
`L = 0.2126R + 0.7152G + 0.0722B` sobre sRGB linearizado e `(L1+0.05)/(L2+0.05)`.
· **Limiar:** `≥ 4,5:1` para texto < 18 pt (ou < 14 pt bold); `≥ 3,0:1` para texto ≥ 18 pt
(≥ 24 px) ou ≥ 14 pt bold (≥ 18,5 px).
· **Fonte:** WCAG 2.2 SC 1.4.3 (AA); fórmula em WCAG Technique G18. Reforçado por
Google style guide ("4.5:1 for text") e Azure WAF. · **Severidade:** `fail`.

**`A7.2 · Contraste não-textual`**
· **Computar:** contraste de borda de nó, borda de grupo, traço de aresta e ponta de seta
contra a cor adjacente efetiva.
· **Limiar:** `≥ 3:1`. · **Fonte:** WCAG 2.2 SC 1.4.11 — cobre "the important parts of a more
complex diagram such as each line in a graph". · **Severidade:** `fail`.

**`A7.3 · Cor não é o único canal`**
· **Computar:** construir o mapa `significado → (fill, stroke_style, shape, icon, pattern)`.
Para todo par de significados que difere **apenas** em `fill`, marcar violação.
· **Limiar:** 0 pares. · **Fonte:** WCAG 2.2 SC 1.4.1 (nível A); Azure WAF ("Avoid relying
solely on color to distinguish types, instead consistently pair color with pattern");
C4 ("account for accessibility concerns like colorblindness");
Google style guide. · **Severidade:** `fail`.

**`A7.4 · Distinguibilidade sob deficiência de cor`**
· **Computar:** transformar a paleta usada por matrizes de simulação (protanopia, deuteranopia,
tritanopia) e computar a menor distância perceptual (CIEDE2000) entre quaisquer duas cores que
carreguem significados distintos.
· **Limiar:** `ΔE00 ≥ 10` em cada uma das três simulações.
· **Fonte:** WCAG SC 1.4.1 é o requisito normativo; o teste de simulação é **operacionalização
de engenharia** (o W3C não prescreve ΔE). **Marque como default calibrável.**
· **Severidade:** `warn`.
· **Nota:** A7.3 já é a rede de segurança normativa; A7.4 é diagnóstico complementar.

**`A7.5 · Contraste da legenda`**
· **Computar:** A7.1 e A7.2 aplicados às amostras de cor e ao texto da legenda.
· **Limiar:** idem. · **Fonte:** idem. · **Severidade:** `fail`.

---

## A8 · Volume e complexidade

**`A8.1 · Contagem de elementos de primeira classe`**
· **Computar:** `|nodes|` excluindo caixas de grupo.
· **Limiar:** alvo `≤ 20`; `warn` em 21–50; `fail` em > 50.
· **Fonte:** Ghoniem, Fekete & Castagliola (node-link perde para matriz acima de ~20 vértices
na maioria das tarefas); Yoghourdjian et al., arXiv:1809.00270 ("clear cuts at 20, 50, and 200
nodes"); Störrle (correlação negativa forte entre tamanho e desempenho); C4 FAQ ("split that
single complex diagram into a larger number of simpler diagrams").
· **Severidade:** `warn`/`fail`. · **Nota:** o remédio prescrito é **decompor**, não encolher —
"improve end user understanding ... by more than 50%" (Moody & Heymans, RE'09).

**`A8.2 · Densidade de arestas`**
· **Computar:** `d = |E| / C(|V|,2)`; e densidade linear `|E|/|V|`.
· **Limiar:** `warn` se `d > 0,10` **e** `|V| > 20` (a combinação que a literatura evita).
· **Fonte:** Yoghourdjian et al. (78% dos estudos usam densidade <10%; acima de 20% só com
matriz ou edge bundling). · **Severidade:** `warn`.

**`A8.3 · Arestas por nó (fan-out)`**
· **Computar:** `max(deg(v))`.
· **Limiar:** `warn` em `deg > 8` — acima disso a resolução angular (A6.1) fica mecanicamente
impossível de satisfazer (`360°/8 = 45°`, e cai rápido).
· **Fonte:** derivado de A6.1 + Ware et al. 2002 ("o número de ramos saindo dos nós do caminho"
é fator de custo cognitivo). · **Severidade:** `warn`.

**`A8.4 · Cobertura de tinta`** — proxy fraco de data-ink.
· **Computar:** fração de pixels não-fundo / área do canvas.
· **Limiar:** faixa `[0,15 ; 0,60]` como **sinal diagnóstico**, não como reprovação.
· **Fonte:** Tufte (data-ink ratio), **explicitamente adaptado e enfraquecido** — ver
§"O que a evidência NÃO sustenta". · **Severidade:** `warn` apenas.

---

## Resumo de prioridade de implementação

| Ordem | Família | Por quê |
|---|---|---|
| 1 | A3 (sobreposição) + A4 (contenção) | falhas duras, tolerância zero, semanticamente graves, trivialmente computáveis; é o que gerador automático erra |
| 2 | A1 (completude) | checklist do C4 virado em asserção; custo quase zero, cobre a maior parte do consenso entre guias |
| 3 | A5.1/A5.2/A5.5 (cruzamentos, ângulo, fronteira espúria) | a estética com maior efeito medido, e o regime de tamanho é o certo |
| 4 | A7 (acessibilidade) | normativo, determinístico, sem espaço para debate |
| 5 | A2 (consistência/notação) | consenso unânime dos cinco guias |
| 6 | A6, A8 | ajuste fino; limiares menos firmes |

---

# (B) JULGAMENTOS QUE EXIGEM OLHO HUMANO OU RENDER

Cada item explica **por que a geometria não alcança** e o que substitui (revisão humana,
teste de render, ou verificação contra outra fonte de verdade).

**`B1 · Simetria`**
A literatura de graph drawing lista simetria entre as estéticas clássicas e humanos a
preferem fortemente, mas a fonte primária é explícita: *"é difícil formalizar a simetria de um
node-link e fornecer uma medida computável para ela"* (Kobourov, Mchedlidze & Vonessen).
Purchase 2002 define uma métrica de simetria, mas ela é sensível a heurística de detecção de
eixo e não se comporta bem em desenhos com caixas de grupo aninhadas de tamanhos diferentes.
**Substituto:** A6.4 (alinhamento a grid) captura a parte da ordem visual que é computável.
A simetria "de verdade" fica com o revisor.

**`B2 · O diagrama está CORRETO?`**
Nenhuma checagem geométrica sabe se a arquitetura desenhada existe. A Microsoft coloca isso
como regra explícita — *"Be accurate. While diagrams are abstractions, don't sacrifice accuracy
for unnecessary simplicity ... Inaccuracies in diagrams can lead to serious miscommunication"* —
e é o único item da lista deles que a geometria **não** pode tocar.
**Substituto:** diff contra o IaC / a API de descoberta de recursos. Isso não é validação de
diagrama, é validação de modelo — e deve rodar **antes** do layout.

**`B3 · O rótulo da aresta corresponde à direção e à intenção?`**
A checagem A1.6 garante que existe rótulo; a direção do rótulo (`"lê de"` vs `"escreve em"`)
exige entender o texto. Um `"invoca"` apontando de banco para função passa em toda checagem
geométrica. C4 pede explicitamente que "the description match the relationship direction".
**Substituto:** LLM-as-judge sobre `(source.type, label, target.type)`, ou dicionário de verbos
com polaridade. Não é geometria.

**`B4 · O nível de abstração é o CERTO para a audiência?`**
A1.10 garante que o nível é **uniforme**. Se ele é o **adequado** — "essa audiência precisa ver
subnets?" — é decisão editorial. Azure WAF: "the choice of architecture diagram depends on what
you're trying to convey and your audience's questions".
**Substituto:** parâmetro de entrada do gerador, revisado por humano.

**`B5 · O nome é significativo?`**
`label = "Lambda1"` passa em A1.4. C4 pede que o leitor "understand what every element does".
Semântica de nome não é geometria.
**Substituto:** revisão, ou lint de nomenclatura contra convenções do projeto.

**`B6 · A legenda EXPLICA, ou só lista?`**
A1.3 garante cobertura de canais. Se a entrada diz "azul = azul" em vez de
"azul = plano de dados", só um leitor percebe.
**Substituto:** revisão humana.

**`B7 · Legibilidade real do texto no meio de destino`**
Kerning, fallback de fonte, elipse por overflow, hinting, anti-aliasing, e como tudo isso
degrada em projeção, impressão P&B ou tela de baixo DPI — nada disso está no modelo geométrico.
`font_size_px` (A3.9) é uma aproximação; o texto renderizado é a verdade.
**Substituto:** render para PNG no DPI de destino + OCR de round-trip (se o OCR não lê o
rótulo, o humano provavelmente também não lê). Isso é **teste de render**, não de geometria.

**`B8 · Fidelidade e reconhecibilidade do ícone`**
A2.2/A2.3 checam que o ícone não foi transformado nem recolorido. Não checam se o ícone
**certo** foi escolhido para o serviço, nem se ele continua reconhecível no tamanho renderizado.
Azure Icons: "Use the icons as they would appear within Azure"; Azure WAF: "Don't substitute
marketing logos for conceptual elements".
**Substituto:** mapa serviço→ícone mantido à mão + inspeção visual em amostragem.

**`B9 · Estética/percepção agregada — "isso parece confuso?"`**
As dez métricas de Mooney et al. são componentes ortogonais; nenhuma combinação linear delas
foi validada como preditor de compreensão para diagramas com significado. Purchase, Carrington
& Allder mostram que "the semantic domain of the graph drawings affects which aesthetic criteria
need to be emphasised" — ou seja, o peso relativo muda com o domínio, e ninguém mediu esses
pesos para diagramas de arquitetura de nuvem.
**Substituto:** não construa um "score de qualidade" único. Reporte cada métrica separadamente.

**`B10 · Escolha do tipo de diagrama`**
Contexto vs. container vs. deployment vs. data-flow vs. sequência — a Azure WAF lista 12+ tipos
e diz "favor a minimal set of purposeful diagrams over creating every possible type". Escolher
errado produz um diagrama impecável que responde à pergunta errada.
**Substituto:** entrada explícita do usuário.

**`B11 · Frescor`**
A1.11 checa que há uma data. Se a data é verdadeira, e se o diagrama ainda descreve o sistema,
não é computável a partir do diagrama. Azure WAF: "Retire diagrams that no longer accurately
answer an active stakeholder question."
**Substituto:** CI que regenera e diffa contra o IaC.

**`B12 · Descrição textual equivalente (alt text)`**
O Google style guide exige que "a informação transmitida na imagem seja capturada no texto" e
desaconselha texto embutido em gráfico. Gerar essa descrição é tarefa de linguagem, e avaliar
se ela é adequada é julgamento.
**Substituto:** gerar com LLM a partir do modelo (não da imagem) e revisar.

**`B13 · Semântica de cor do fornecedor`**
A2.8 checa conformidade contra um mapa de convenção. **Quem define o mapa** para AWS não é a
AWS por escrito — é o asset oficial. Se o asset mudar, o mapa fica errado silenciosamente.
**Substituto:** extração programática do deck oficial a cada release trimestral + revisão.

---

# O QUE A EVIDÊNCIA NÃO SUSTENTA

Regras populares que a literatura primária **não** confirma. Cada uma tem circulação ampla em
blog posts e listicles; nenhuma sobrevive à fonte.

**1. "Máximo 7±2 elementos por diagrama."**
Miller (1956) mediu **memória de trabalho**, não leitura de diagrama, e o próprio survey de
graph drawing descreve 7±2 como "commonly accepted as a **rule-of-thumb**". Cowan (2001) revisou
para ~4 chunks — o que tornaria a regra "máximo 4 caixas", obviamente absurda. Diagrama é
memória **externa**: o leitor não precisa reter os elementos, eles estão na tela. O que existe
de real é a correlação negativa tamanho↔desempenho (Störrle) e o corte prático em ~20 nós
(Ghoniem; Yoghourdjian et al.) — nenhum dos dois é 7±2.
*O número 6 de Moody é sobre entradas de legenda (tipos de símbolo), não sobre caixas.*

**2. "Zero cruzamentos, sempre."**
Purchase 1997 estabelece cruzamentos como a estética mais importante, mas: (a) Kobourov, Pupyrev
& Saket mostram que o efeito é "significant for small graphs but **not significant for large
graphs**"; (b) Huang et al. mostram que um cruzamento em ~90° custa pouco ou nada, enquanto um
cruzamento em ângulo raso é caro. **Um cruzamento perpendicular é melhor que três dobras para
evitá-lo.** A regra correta é orçamentada e condicionada ao ângulo (A5.1 + A5.2), não absoluta.

**3. "Maximize o data-ink ratio em diagramas."**
O data-ink ratio é definido sobre **ink que codifica variação numérica**. Em um diagrama de
arquitetura não existe essa variação — quase toda a tinta é rótulo, ícone e fronteira, que
Tufte classificaria como não-data-ink. Aplicado literalmente, o critério mandaria apagar
os ícones e as caixas de grupo. Some-se a isso que o experimento de Bateman et al. encontrou
que a precisão de descrição de gráficos embelezados "was no worse than for plain charts" e a
recordação após 2–3 semanas foi **significativamente melhor** — resultado que contradiz a
posição minimalista forte. *Fonte: Bateman, Mandryk, Gutwin, Genest, McDine & Brooks,*
Useful Junk? The Effects of Visual Embellishment on Comprehension and Memorability of Charts,
*CHI 2010.*
**O que sobrevive:** a versão fraca — "todo traço mapeia a um fato" (A1.12, A2.11). A versão
quantitativa (A8.4) fica como diagnóstico, nunca como reprovação.

**4. "Sempre use layout ortogonal / sempre use linhas retas."**
Não há evidência primária que ordene os dois. Nos 4.890 desenhos de especialistas do GD
collection, 43% são straight-line, 20% poligonais e 37% curvos — nenhum estilo domina, e as
distribuições de métricas são "largely similar" entre eles. O que muda: desenhos straight-line
pontuam melhor em uniformidade de comprimento (ELD mediana 0,774 vs 0,676/0,685) e poligonais
pontuam melhor em ortogonalidade (0,592 vs 0,55/0,56). **Escolha um estilo e seja consistente**
(isso sim é consenso unânime dos guias) — mas não afirme que um é objetivamente melhor.

**5. "Melhorar o layout resolve o diagrama."**
Störrle encontra que **tamanho** correlaciona negativamente com desempenho de forma altamente
significativa, e que **especialistas se beneficiam menos** de melhoria de layout do que
novatos. Purchase, Carrington & Allder encontram que só **algumas** estéticas afetam usabilidade
significativamente e que isso depende do domínio semântico. Ou seja: dado um diagrama grande
demais, otimizar cruzamentos não salva. **Decompor bate polir** — e é a única intervenção com
efeito grande relatado ("more than 50%", Moody & Heymans, RE'09).

**6. "Existe um score único de qualidade de diagrama."**
As dez métricas de Mooney et al. são intencionalmente separadas e o paper de 2024 documenta as
**correlações par a par** justamente porque elas não colapsam em um índice. Nenhum estudo
validou uma combinação ponderada contra compreensão humana em diagramas de arquitetura.
Reporte um vetor, não um número.

**7. "A AWS tem um guia oficial de diagramação."**
Ela tem um guia de **ícones** e um deck com regras de uso de ícone/grupo/seta/rótulo. Ela **não**
publica regras de layout (roteamento, cruzamentos, espaçamento, contraste, legenda obrigatória,
níveis de abstração). Tratar "AWS best practices" como se cobrisse layout é atribuir autoridade
a uma fonte que não a exerce. O ruleset textual mais completo de qualquer hyperscaler é o da
Microsoft (Azure WAF, *Create architecture design diagrams*).

**8. "Cor codifica o domínio do serviço (compute=laranja, storage=verde, ...)."**
É convenção **da IBM** (Network=Cyan 50, Compute=Blue 60, ...), não um padrão da indústria, e a
AWS usa cor por **categoria de produto no ícone**, não como canal semântico livre. C4 deixa cor
explicitamente livre. Não existe consenso — e a WCAG SC 1.4.1 impede que cor seja o único
portador de qualquer significado de todo modo.

**9. "Uma seta bidirecional economiza espaço e é equivalente a duas setas."**
Microsoft e C4 proíbem explicitamente. Não há estudo empírico que quantifique o custo, mas há
**consenso normativo de duas fontes independentes** contra — o que é suficiente para virar regra
de validação. Registrado aqui porque é a única regra forte de (A) cuja base é consenso de guia,
não experimento.

---

# INCERTEZAS

**U1 · Transferência do domínio.** Todos os limiares numéricos de §A5/A6 vêm de métricas
validadas em **node-link genéricos**, não em diagramas de arquitetura com ícones, rótulos longos
e caixas de grupo aninhadas. Purchase, Carrington & Allder mostram que o domínio semântico muda
quais estéticas pesam. **Risco:** ELD, NP e KSM podem ser ruído puro aqui (a posição de um nó
é ditada pela VPC que o contém, não pela topologia). Recomendo tratar A6.5 como experimental e
medir se ele correlaciona com julgamento humano antes de dar peso.

**U2 · Percentis calibrados em desenhos sem caixas.** A tabela de Q1/mediana/Q3 vem de 4.890
desenhos do GD collection — grafos de mediana 11 nós, **sem containers**. Um diagrama AWS tem
nós dentro de caixas, o que muda mecanicamente NR, NU e Asp. Os limiares de A3.8, A6.2 e A6.3
precisam de recalibração assim que houver um corpus próprio.

**U3 · Extração automática.** O paper GD 2025 é honesto sobre a taxa de erro do seu pipeline de
extração ("given the inevitable errors in the completely automated extraction, the
GD-collection-v1 is clearly not a perfect representation"). Os percentis carregam esse ruído.

**U4 · Fórmulas de Purchase 2002 não lidas na fonte.** Não consegui acesso ao texto integral de
*Metrics for Graph Drawing Aesthetics* (JVLC 2002, paywall). As fórmulas em §A vêm da
reformulação de Mooney et al. (GD 2025, CC-BY, com código publicado), que declara estendê-las.
A enumeração exata dos "sete critérios" de Purchase 2002 vem do abstract e pode estar
imprecisa em um ou dois itens.

**U5 · Convenção de borda/cor de grupo AWS.** A AWS não publica, em texto normativo, o mapa
`tipo de grupo → cor + estilo de borda`. Os valores que circulam (Region `#00A4A6` pontilhado,
AZ `#00A4A6` tracejado, VPC `#8C4FFF` sólido) vêm de transcrições de terceiros do deck oficial.
**Não hard-code.** Extraia do asset oficial e re-extraia a cada release trimestral. A2.8 está
marcada como `warn` por causa disso.

**U6 · Limiar de contagem de elementos.** Os próprios autores do survey de complexidade dizem
que o limiar de 200 nós/10% "is a result of the expert intuition of the researchers, rather than
empirical research. A controlled study is needed". O corte de 20 tem base melhor (Ghoniem et al.
mediram), mas para node-link **vs. matriz**, não para "diagrama saturou". Trate A8.1 como
convenção defensável, não como fato.

**U7 · Ângulo ideal de cruzamento: 70° ou 90°?** Huang et al. mostram queda de tempo de resposta
que "estabiliza perto de 90°"; a literatura de métricas adotou **70°** como ideal operacional
(Dunne et al. 2015, `greadability.js`), enquanto Mooney et al. (GD 2025) usam **90°** na fórmula
de CA. Adotei 70° como alvo prático e 30° como piso de falha; a diferença 70/90 é imaterial na
prática, mas afeta o valor absoluto da métrica CA. Fixe uma convenção e documente qual.

**U8 · Números marcados como "default de engenharia".** Sem base experimental:
A3.9 (12/14 px), A4.7 (ρ ≤ 0,6), A5.3 (≤2 dobras), A5.7 (flow ≥ 0,90), A6.4 (70% alinhados),
A7.4 (ΔE00 ≥ 10), A8.3 (deg ≤ 8), A8.4 (faixa de cobertura). São palpites informados. **Devem
ser expostos como configuração**, não embutidos.

**U9 · Simetria.** Deixada fora de (A) deliberadamente (B1). Se surgir necessidade, a métrica de
Purchase 2002 existe, mas a fonte primária de Gestalt-em-graph-drawing declara o problema
mal-condicionado. Não recomendo.

**U10 · Fontes não acessadas integralmente.** Purchase 1997 e 2002, Huang et al. 2014,
Ghoniem et al. 2004/2005, Störrle 2014/2016, Moody 2009 (IEEE TSE), Dunne et al. 2015 e
Bateman et al. 2010 foram lidos por abstract, por citação em fonte primária acessível, ou por
reformulação em paper CC-BY. Mooney et al. GD 2025, os guias de plataforma, a WCAG e Moody &
Heymans RE'09 foram lidos no texto integral. **As citações entre aspas são todas de textos que
li integralmente; as demais estão parafraseadas e marcadas.**

---

# FONTES

## Design de informação
- Edward R. Tufte. *The Visual Display of Quantitative Information*. Graphics Press, 1983 (2ª ed. 2001). — data-ink ratio, chartjunk.
- Edward R. Tufte. *Envisioning Information*. Graphics Press, 1990. — small multiples.
- S. Kobourov, T. Mchedlidze, L. Vonessen. *Gestalt Principles in Graph Drawing*. Pôster, Graph Drawing. https://i11www.iti.kit.edu/_media/en/members/tamara_mchedlidze/description.pdf
- S. Bateman, R. L. Mandryk, C. Gutwin, A. Genest, D. McDine, C. Brooks. *Useful Junk? The Effects of Visual Embellishment on Comprehension and Memorability of Charts*. CHI 2010.

## Notação e modelo
- Simon Brown. **C4 model**. https://c4model.com — `/diagrams/notation`, `/diagrams/checklist`, `/abstractions`, `/faq`.
- D. L. Moody. *The "Physics" of Notations: Toward a Scientific Basis for Constructing Visual Notations in Software Engineering*. IEEE TSE 35(6):756–779, 2009.
- D. L. Moody, P. Heymans. *Improving the Effectiveness of Visual Representations in Requirements Engineering*. RE'09. https://homepages.uc.edu/~niunn/courses/RE-refs/PoN-RE09.pdf

## Guias oficiais de plataforma
- Microsoft. *Create architecture design diagrams* — Azure Well-Architected Framework. https://learn.microsoft.com/en-us/azure/well-architected/architect-role/design-diagrams
- Microsoft. *Azure Icons* — Azure Architecture Center. https://learn.microsoft.com/en-us/azure/architecture/icons/
- AWS. *AWS Architecture Icons*. https://aws.amazon.com/architecture/icons/ (+ deck oficial, slides DO/DON'T, Groups, Arrows, Labels, Callouts)
- AWS. *What is Architecture Diagramming?* https://aws.amazon.com/what-is/architecture-diagramming/
- Google. *Icon library*. https://cloud.google.com/icons
- Google. *Diagrams, figures, and other images* & *Write accessible documentation* — Google developer documentation style guide. https://developers.google.com/style/images · https://developers.google.com/style/accessibility
- IBM. *architecture-icons* (stencils e guidance). https://github.com/IBM-Cloud/architecture-icons
- IBM Cloud Architecture Framework. *Creating an architecture diagram*.

## Graph drawing — estética, métricas e evidência
- H. C. Purchase. *Which aesthetic has the greatest effect on human understanding?* Graph Drawing 1997, LNCS 1353, Springer.
- H. C. Purchase. *Metrics for Graph Drawing Aesthetics*. J. Visual Languages & Computing 13(5):501–516, 2002.
- H. C. Purchase, D. Carrington, J.-A. Allder. *Empirical Evaluation of Aesthetics-based Graph Layout*. Empirical Software Engineering 7(3):233–255, 2002.
- C. Ware, H. Purchase, L. Colpoys, M. McGill. *Cognitive Measurements of Graph Aesthetics*. Information Visualization 1(2):103–110, 2002.
- W. Huang, P. Eades, S.-H. Hong, C.-C. Lin. *Larger crossing angles make graphs easier to read*. J. Visual Languages & Computing 25(4):452–465, 2014.
- W. Huang. *An Eye Tracking Study into the Effects of Graph Layout*. arXiv:0810.4431.
- S. Kobourov, S. Pupyrev, B. Saket. *Are Crossings Important for Drawing Large Graphs?* Graph Drawing 2014, pp. 234–245.
- C. Dunne, S. I. Ross, B. Shneiderman, M. Martino. *Readability metric feedback for aiding node-link visualization designers*. IBM J. Research and Development 59(2/3):14:1–14:16, 2015.
- G. J. Mooney, H. C. Purchase, M. Wybrow, S. G. Kobourov. *The Multi-Dimensional Landscape of Graph Drawing Metrics*. IEEE PacificVis 2024, pp. 122–131.
- G. J. Mooney, T. Hegemann, A. Wolff, M. Wybrow, H. C. Purchase. *Universal Quality Metrics for Graph Drawings: Which Graphs Excite Us Most?* GD 2025, LIPIcs vol. 357, art. 30. CC-BY. https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.GD.2025.30 · código: https://github.com/gavjmooney/geg
- R. Gove. *greadability.js — Graph layout readability metrics*. https://github.com/rpgove/greadability

## Complexidade e carga cognitiva
- M. Ghoniem, J.-D. Fekete, P. Castagliola. *A Comparison of the Readability of Graphs Using Node-Link and Matrix-Based Representations*. IEEE InfoVis 2004; versão estendida em Information Visualization 4(2), 2005.
- V. Yoghourdjian, D. Archambault, S. Diehl, T. Dwyer, K. Klein, H. C. Purchase, H.-Y. Wu. *Exploring the Limits of Complexity: A Survey of Empirical Studies on Graph Visualisation*. arXiv:1809.00270, 2018.
- H. Störrle. *On the Impact of Layout Quality to Understanding UML Diagrams: Size Matters*. MODELS 2014, LNCS 8767.
- H. Störrle. *On the impact of size to the understanding of UML diagrams*. Software & Systems Modeling, 2016.
- G. A. Miller. *The Magical Number Seven, Plus or Minus Two*. Psychological Review 63(2):81–97, 1956.
- N. Cowan. *The magical number 4 in short-term memory: A reconsideration of mental storage capacity*. Behavioral and Brain Sciences 24(1):87–114, 2001.

## Acessibilidade
- W3C. *Web Content Accessibility Guidelines (WCAG) 2.2* — SC 1.4.1 Use of Color, SC 1.4.3 Contrast (Minimum), SC 1.4.6 Contrast (Enhanced), SC 1.4.11 Non-text Contrast.
- W3C. *Technique G18* — fórmula de luminância relativa e razão de contraste. https://www.w3.org/WAI/WCAG22/Techniques/general/G18
