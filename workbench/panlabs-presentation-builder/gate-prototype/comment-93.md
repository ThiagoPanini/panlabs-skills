## O portão de máquina de um HTML: o que é medível e o que é ilusão de medida

Li `validar.py` (1 243 linhas, stdlib puro) e `smoke.py` (222 linhas, Playwright) inteiros, e **prototipei toda checagem que proponho** — nenhuma abaixo é sugestão de papel. O trabalho está em `/home/paninit/.claude/jobs/86e0faa0/tmp/t93/`: um deck canônico na identidade medida mais 16 variantes com defeito plantado, os checadores `check-static.sh`, `check-render.cjs`, `check-drawing.cjs`, `check-bleed.cjs`, `sfnt.cjs`, e as sondas `probe-corpus.cjs` / `probe-icons.cjs`.

**A decisão de método que mudou o resultado:** além do corpus sintético, exercitei tudo contra o **corpus real do #94** — `primitives.html`, `charts.html`, `diagram.html`, 12 telas escritas à mão na identidade. Foi ali que **5 das 11 checagens candidatas morreram**, e nenhuma morreu por deixar defeito passar: morreram por **falso positivo contra trabalho legítimo**. É a lição que o próprio slideless escreveu no `_scrub()` — validador com falso positivo vira validador ignorado — e ela custa mais caro do que parece.

---

### 1. O que dá para medir sem abrir o browser

| # | checagem | mecanismo | estrago que pega | veredito |
|---|---|---|---|---|
| S1 | nenhuma referência sai da máquina | regex sobre `href`/`src`/`srcset`/`url()`/`@import` com esquema `http(s):` ou `//` | CDN, Google Fonts, imagem remota | **vale, e é comprovadamente incompleta** |
| S2 | `<style>`/`<script>` presentes e inline | conta as tags e exige ao menos uma sem `src=` | tema ou engine que saiu do arquivo | vale |
| S3 | toda família declarada tem `@font-face` com `src: url(data:` | extrai `font-family:`, casa contra o bloco `@font-face` | `font-family: Arial` no `h1`; `src: local()` | vale |
| S4 | todo payload base64 embutido é uma fonte íntegra | **checksum sfnt** por tabela, aritmética pura | base64 truncado/corrompido — a face nunca carrega | **vale, e foi a surpresa** |
| S5 | hex fora da paleta medida, **por igualdade** | compara com os 11 tokens | nada | **reprovada — 22 falsos positivos** |
| S5' | hex **cromático** fora dos acentos | croma = `max(RGB) − min(RGB)`; `≤12` passa, `>12` exige acento | `#667eea` e parentes | **vale, com ressalva** |
| S6 | o esqueleto foi preenchido | conta `.slide` e `[data-step]` | esqueleto entregue vazio | vale |
| S7 | conector termina **sobre** a forma que aponta | último par de coordenadas do `d`/`points` contra a borda do `rect` mais próximo | seta que para no ar | **vale — pegou defeito vivo** |
| S8 | as fatias da rosca fecham o círculo | soma os `stroke-dasharray` contra `2πr` | rosca que não fecha | vale |
| S9 | o número desenhado bate com o dado que o desenhou | soma `data-value` contra `data-total-of` | rótulo que mente | **vale só com contrato no esqueleto** |

**S4 é a surpresa e vale detalhar.** Plantei uma corrupção realista: os primeiros 400 caracteres do base64 do Anton intactos, o resto substituído mantendo o comprimento. Assinatura sfnt intacta, `@font-face` perfeito, `src: url(data:` presente — **toda checagem sintática passa**, e o browser pinta em Liberation Sans. Mas todo sfnt carrega checksum por tabela, e verificar isso é aritmética: `sfnt.cjs` tem 30 linhas, **não depende de biblioteca de fonte nenhuma**, roda em **5 ms** para as três faces embutidas, e devolve `table 'GDEF' checksum is 0x0, the directory says 0x9f4a9e82 -- the payload is corrupt`. Isso move a corrupção de fonte de "só o render vê" para "estático, exato e barato".

**S5 é a reprovada, e o número é constrangedor.** A regra "todo hex é um dos 11 tokens medidos" acusa **22 hexes distintos no corpus real** — trabalho fiel à identidade, escrito à mão. Mas a distribuição do croma separa os dois grupos com uma ordem de grandeza de folga:

```
#191919 #1B1B1C #232325 #2A2A2C #3A3A3F #4A4A4F #55555A #6A6A6E
#6F6F74 #77777C #8D8D92 #9A9AA0 #9B9BA0 #A0A0A5 #B6B6BA #C9C9CC
#D6D6D8 #E2E2E4   -> croma entre 0 e 6   = a rampa de cinza entre surface e fg
#5FA04E #844FBA #3776AB #F7DF1E          -> croma entre 82 e 217 = CROMÁTICOS
os 6 acentos + o laranja                 -> croma entre 76 e 254
```

Os 18 cinzas são **desenho, não desvio** — a rampa entre `#141415` e `#F3F3F3` que qualquer implementação real vai pedir. E os 4 cromáticos são **verde do Node, azul do Python, amarelo do JavaScript** e um roxo: marcas de terceiro num slide de tech stack. Então a regra que nasce é: **achromatic passa sempre; cromático fora dos acentos reprova; marca de terceiro precisa de lugar declarado no arquivo, não de passe silencioso**. Qualquer corte entre 6 e 76 funciona; usei 12.

**S9 só existe porque a decisão do #94 foi SVG e não canvas.** Na rosca real há três números que se conferem: os arcos (`207+138+97+111 = 553` contra `2πr = 552,9`), a legenda (`15+10+7+8 = 40`) e o total do centro (`40`). Dois quaisquer determinam o terceiro — é um **sistema fechado**, e é isso que torna coerência medível. Mas no markup real **nada liga o `40` ao `15 10 7 8` a não ser a prosa**, e o meu checador diz isso na cara: `(no data-total-of contract in this file: label-vs-data coherence is not measurable here)`. Com o contrato presente (`data-total-of` no texto, `data-value` nos arcos), plantei o defeito exato do `chart2` e saiu `the label for "entregas" reads 28 and the 4 series it totals sum to 40 (15 + 10 + 7 + 8) -- the drawing is right and the number is lying`. **A família é real, e o preço dela é uma linha de contrato no esqueleto.** Num `<canvas>` nenhum desses números existe no arquivo e a família inteira é impossível.

**S7 pegou defeito vivo, não plantado.** `diagram.html` do #94 ainda tem os cotovelos parando a 40 unidades da caixa: `connector "M415 170 L415 210 L450 210" has its end at (450,210), 40 units from the nearest box [300,60 230x110] -- the arrow points at nothing`. Exatamente o número que o #94 relatou, achado por aritmética sobre o markup, sem browser.

---

### 2. O que só o browser vê

Do `smoke.py` transportam-se quatro coisas — sangramento, texto quebrando por caractere, número duplicado por `counter()`, e scroll horizontal — mas **transportar o mecanismo literal perde defeito**, e isso apareceu duas vezes.

| # | checagem | mecanismo concreto | veredito |
|---|---|---|---|
| R1 | **nenhuma requisição sai da máquina** | CDP `Network.requestWillBeSent`, filtra esquema `file`/`data`/`blob`/`about`/`chrome` | **vale, e é a mais forte** |
| R2 | **a face que de fato pintou** cada nível | CDP `CSS.getPlatformFontsForNode` → `familyName`, `postScriptName`, `isCustomFont`, `glyphCount` | **vale — e é o que desmente o `getComputedStyle`** |
| R3 | `@font-face` que falhou ao carregar | `[...document.fonts].filter(f => f.status === 'error')` | vale, com armadilha |
| R4 | a escala tipográfica em % da altura do palco | `parseFloat(getComputedStyle(el).fontSize) / stage.height * 100` contra a tabela medida | vale |
| R5 | **piso de legibilidade** | histograma da caixa do texto no screenshot; cor dominante = fundo; melhor contraste contra ela `< 1.5:1` = o texto sumiu | **vale a 1,5:1; reprovada a 4,5:1** |
| R6 | o deck senta na própria superfície | cor dominante por estado, ao longo da caminhada inteira | **vale só para inversão global** |
| R7 | área fora da paleta no pixel | histograma + distância ao segmento entre dois tokens | **reprovada como medida de identidade** |
| R8 | **conteúdo cortado pela borda** | solta o clip do palco, fotografa a faixa **além** da borda, conta pixel não-preto | **vale medindo pixel; reprovada medindo caixa** |
| R9 | duas caixas absolutas colidindo | união dos retângulos dos descendentes com texto; ignora pares ancestral/descendente | vale |
| R10 | ícone de contorno pintado como mancha | `getComputedStyle(path).fill === 'none'` e `.stroke !== 'none'` | **vale só por slot declarado** |
| R11 | cobertura de tinta da caixa do ícone | % de pixel claro na caixa | **reprovada — sinal fraco** |

**R1 é a checagem mais valiosa do portão inteiro, e não tem equivalente estático.** Plantei um deck que monta a URL em runtime — `String.fromCharCode(104,116,116,112,115) + '://' + ['fonts','gstatic','com'].join('.')`. O arquivo **não contém nenhuma URL literal**: `grep -cE '<link[^>]+href=|<script[^>]+src=|url\(\s*https?:'` devolve `0`. Nenhum regex do mundo acha isso. O CDP acha: `the deck asked the network for https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm0K0.ttf`. E acha também `<link>`, `<script src>`, `url()` no CSS e `@import` — **uma checagem comportamental cobre as quatro sintáticas e mais o que elas não alcançam**. A premissa 4 é a premissa que **menos** se deixa cobrar por leitura de bytes.

**R2 é o achado central do ponto 3 e mora aqui.** Está na seção seguinte.

**R3 tem armadilha barata de errar:** no deck bom, `document.fonts` reporta `["Anton:400:loaded","DeckBody:300:loaded","DeckBody:800:unloaded"]`. O `unloaded` é a face peso 800, que só aparece num slide ainda não visitado — **não é erro, é preguiça**. A checagem tem de ser `status === 'error'`, nunca `status !== 'loaded'`, senão o portão reprova todo deck cuja tipografia tem mais de um peso.

**R8 é onde transportar o `smoke.py` literalmente perde o defeito.** O `clipped()` do slideless sobe a árvore e ignora qualquer elemento com ancestral `overflow:hidden` — existe para calar camada decorativa. Mas o palco de um deck 16:9 **é** `overflow:hidden`, então o guard cala exatamente o defeito do `prim5` ("o último nó saiu cortado"). Primeiro conserto: parar a subida **no palco**. Aí apareceu o segundo problema, e é o mais instrutivo do ticket: **a caixa não é a tinta**. O `c4` do corpus real tem um `<svg>` cuja caixa passa 42 px da borda e **não desenha nada ali** — regra por `getBoundingClientRect` acusa, e é falso positivo. A regra que separa mede pixel: solta o clip, fotografa a faixa além da borda, conta pixel não-preto.

```
CONTROL c4  (caixa do svg passa a borda)   0.000%   -> verde, e corretamente
CONTROL s5  (organograma consertado)       0.000%   -> verde
PLANT   s5  (organograma sangrando)        5.043%   -> vermelho
```

Zero contra cinco por cento. A família nasce **medindo tinta**; medindo caixa ela não nascia.

**R10 tem um falso positivo que ensina o formato do contrato.** A regra "ícone é contorno, não mancha" acusa **5 violações no corpus já consertado** — e está certa sobre os pixels e errada sobre a intenção: são os logos de tecnologia no trilho, `fill=rgb(132, 79, 186)`, marcas que são preenchidas por natureza. Separando por slot:

```
.chip (ícone de contorno)   corpus: 0 violações   plantado: 5 violações
.ico  (marca de terceiro)   corpus: 5 violações   plantado: 5 violações
```

A regra é exata **por slot declarado** e inútil sem ele. Vale para R10 e para o lugar declarado que S5' pedia: **as duas famílias precisam que o esqueleto diga qual caixa é qual**, e é a mesma linha de contrato nos dois casos.

**R11 é reprovada por medida fraca.** Cobertura de tinta na caixa do chip vai de **7,5% (contorno) para 16,9% (mancha)** — 2,2×, com o fundo do acento dominando a caixa nos dois casos. Sem separação limpa, o limiar seria chute. `getComputedStyle` do `fill`/`stroke` é exato e mais barato; a cobertura de tinta sai.

---

### 3. A identidade não derreteu — o que é medida e o que é ilusão de medida

Esta é a pergunta cara do ticket, e a resposta honesta tem duas metades desiguais.

#### O `getComputedStyle` é ilusão de medida, e é a ilusão mais perigosa das três

Plantei quatro decks e perguntei a fonte do `h1` de dois jeitos:

| variante | `getComputedStyle(h1).fontFamily` | `CSS.getPlatformFontsForNode` |
|---|---|---|
| `good` | `"Anton, sans-serif"` | `Anton` · `Anton-Regular` · `isCustomFont=true` · 29 glifos |
| `font-base64-corrupt` | `"Anton, sans-serif"` | **`Liberation Sans`** · `isCustomFont=false` · 29 glifos |
| `font-not-embedded` | `"Anton, sans-serif"` | **`Liberation Sans`** · `isCustomFont=false` · 29 glifos |
| `wrong-display-font` | `"Anton, sans-serif"` | **`Liberation Sans`** · `isCustomFont=false` · 29 glifos |

**A coluna do meio é idêntica nas quatro linhas.** `getComputedStyle` devolve a **lista declarada**, não a face resolvida — ele responde "o que o CSS pediu", nunca "o que pintou". Um portão construído sobre ele dá verde num deck inteiramente renderizado em Liberation Sans e escreve no log que a tipografia está correta. **É pior do que não medir**, porque compra confiança sem entregar informação.

O que mede é `CSS.getPlatformFontsForNode`, do CDP — devolve família, PostScript name, `isCustomFont` e **contagem de glifos por face**, que é o número que prova quem pintou. Não é alcançável de JS de página: é protocolo. E a contagem de glifos dá de graça o caso híbrido — um `h1` que pinta 24 glifos em Anton e 5 em fallback é acento faltando na subsetagem, e aparece como duas entradas.

#### O histograma de cor é ilusão de medida **como medida de identidade**, e é ilusão por dois motivos independentes

Construí o histograma completo: screenshot recortado no palco, contagem por RGB exato, e classificação de cada cor distinta em três baldes — **em cima de um token**, **na reta entre dois tokens** (a mesma regra cobre antialiasing e gradiente, que é elegante e funciona), ou **fora**. No deck bom: `token=99,44% · ramp=0,56% · OFF=0%`, com 237 cores distintas. O instrumento funciona. Ele só não mede o que se quer que meça.

**Motivo 1 — a inversão passa com 99,45%.** O deck `inverted` troca fundo e texto usando **só cores da paleta**. Resultado: `token=99,45% · OFF=0%`. A métrica "fração de pixels dentro da paleta" **não distingue o deck certo do deck com claro e escuro trocados** — porque a paleta não tem papéis, só cores. O que pega inversão é **papel**: qual token ocupa a maior área. E aí:

```
good              dominante #141415 em 7 de 7 estados
inverted          dominante #F3F3F3 em 0 de 7 estados   -> vermelho
```

**Motivo 2 — o papel só pega inversão global, e o resto é sorte.** Plantei `palette-repaint`: um slide de conteúdo repintado com um acento. Deu vermelho (3 de 7). Mas plantei também `legit-divider`: um slide divisor legitimamente inundado pelo mesmo tipo de acento. E os dois são **numericamente indistinguíveis**:

```
palette-repaint  slide 2   dominante #7634D2 @ 98,73%
legit-divider    slide 3   dominante #C75000 @ 98,66%
```

A única coisa que separou os dois no meu portão foi **quantos estados cada slide tem** — o repintado tinha 4 dos 7 e o divisor tinha 1. Provei que é sorte plantando `palette-repaint-single`, o mesmo defeito num slide de estado único: **passa verde**. Então a regra honesta é: **"a superfície domina a maioria dos estados" é detector de inversão global, não de paleta por slide** — e tem de ser escrita e nomeada assim, senão promete o que não entrega. Distinguir "acento inundou um slide por engano" de "acento inundou o divisor de propósito" é **intenção**, e intenção não está no pixel.

**Motivo 3 — o histograma é cego para cor errada em texto pequeno.** `#667eea` num `.kicker` ocupa **0,005% do slide**. Qualquer limiar que pegue isso está enterrado no ruído de antialiasing. O estático pega por leitura de bytes, trivialmente.

**A conclusão dos três:** o histograma de cor é bom instrumento para **área** e péssimo para **identidade**. Ele mede "que cores cobrem que fração da tela", que é uma pergunta real e estreita. "A identidade derreteu?" não é essa pergunta.

#### A razão título/corpo é ilusão de medida; a escala em % da altura do palco é medida

A razão sozinha é fraca — 2,5× pode ser título de 80 px sobre corpo de 32 px, ou título de 20 px sobre corpo de 8 px, e as duas passam. O #90 já entregou a régua certa e ela é absoluta: **% da altura do palco**. Medida assim, `parseFloat(getComputedStyle(el).fontSize) / stage.height * 100` é resolvida em px pelo browser e é fato:

```
good             h1 = 8,90%   lead = 4,00%   kicker = 2,50%    -> bate com a tabela medida
scale-collapse   h1 = 2,89%   lead = 4,00%   kicker = 2,50%    -> vermelho
```

E note o que o segundo caso mostra: o título saiu **menor que o lead**. Não é "a proporção desviou um pouco", é **inversão de hierarquia**, e ela é falsificável sem tolerância negociada. Detalhe de implementação que descobri apanhando: a escala do #90 é % **da altura do palco**, e `font-size` em `%` no CSS resolve contra o **pai**, não contra o palco — meu `h1` a `8.9%` renderizou a **6 px**. A unidade certa é `cqh` com `container-type: size` no palco.

#### O piso de legibilidade é medida — e o limiar tem de vir do deck, não da WCAG

Mede-se no pixel: histograma da caixa do texto, a cor mais frequente é o fundo, e o melhor contraste contra ela é o do texto. A 4,5:1 (WCAG AA) a checagem acusa o **divisor legítimo** — kicker `#141415` sobre `#C75000` dá **4,01:1**, abaixo de AA e exatamente o que a identidade medida faz. A 1,5:1 ela vira **"a caixa é monocromática"**, que é fato sem gosto dentro:

```
                        a 4,5:1        a 1,5:1
good                    verde          verde
legit-divider           VERMELHO       verde      (4,01:1 -- acento sobre acento, legítimo)
invisible-text          VERMELHO       VERMELHO   (1,01:1 -- o texto sumiu)
```

**Um portão calibrado numa régua externa reprova a própria fonte da verdade.** A11y é assunto real, mas é *outro* assunto, e mistura-lo aqui mata a credibilidade da família de identidade.

#### Resumo do ponto 3

| o que se queria medir | veredito |
|---|---|
| a fonte declarada em cada nível (`getComputedStyle`) | **ilusão** — devolve a lista pedida, não a face que pintou |
| **a face que pintou** cada nível (`CSS.getPlatformFontsForNode`) | **medida**, com contagem de glifos como prova |
| fração de pixels dentro da paleta | **ilusão** — dá 99,45% num deck invertido |
| **qual token domina a área, ao longo da caminhada** | **medida**, e só de **inversão global** |
| cor fora da paleta por área de pixel | **ilusão** para texto pequeno (0,005%); o estático pega |
| razão título/corpo | **ilusão** — invariante a escalar tudo junto |
| **tamanho como % da altura do palco** | **medida**, contra a tabela do #90 |
| **caixa de texto monocromática** | **medida** a 1,5:1; **ilusão de rigor** a 4,5:1 |
| croma de cor **declarada** fora dos acentos | **medida**, separação de 6 contra 76 |

**A identidade não é medível como uma coisa.** É medível como **quatro eixos independentes** — a face que pintou, a escala contra a altura, o papel dos tokens na área, e o croma do que foi declarado — e cada eixo pega um estrago diferente. Um deck pode derreter em qualquer um sem tocar nos outros três: `font-base64-corrupt` passa em cor, escala e croma e está inteiramente errado.

---

### 4. O headless é dependência de quê

**De desenvolvimento — com uma exceção que precisa ser decidida de propósito.**

Primeiro o achado prático, que muda a conta: **não é preciso Playwright nem Puppeteer.** Nesta máquina nenhum dos dois está instalado (`ModuleNotFoundError: No module named 'playwright'`; `require('puppeteer')` falha), e mesmo assim todo o portão de render roda. O Node 24 tem `WebSocket` global e o Chromium fala **CDP**: `cdp.cjs` tem ~110 linhas, **zero dependência npm**, e faz launch, navegação, `Runtime.evaluate`, `Input.dispatchKeyEvent` para as setas, `Page.captureScreenshot` com `clip`, `Network.enable` e `CSS.getPlatformFontsForNode`. Os binários já resolvem nos dois caminhos que o ticket cita. **A dependência do portão de render é "um Chromium em disco", não uma árvore de `node_modules`** — o que torna a degradação barata e o `SKIP` honesto.

O corte do `panlabs-aws-diagrams` cabe, e o implementei: sem binário, `check-render.cjs` imprime `SKIP: no chromium on this machine -- render layer not measured` e sai `0`. As famílias estáticas bloqueiam; as de render degradam e avisam.

**A exceção é a R1, e ela é séria.** A premissa 4 (rede zero) é regra dura, e a única checagem que a cobre de verdade é comportamental — precisa do browser. Se o render degrada, a premissa 4 fica guardada só pelo regex, **que eu provei incompleto** com o `runtime-fetch`. Não dá para ter as duas coisas ao mesmo tempo, então é decisão explícita, e as saídas honestas são duas:

- **aceitar o regex como guarda parcial** no bloqueio, e escrever no aviso do `SKIP` exatamente qual premissa deixou de ser cobrada — não "render não medido", mas "**a premissa 4 não foi verificada nesta execução**";
- **ou** fazer do Chromium dependência dura do **caminho de release** (o comando que declara uma apresentação pronta), mantendo-o opcional no laço de desenvolvimento.

Prefiro a segunda, com a primeira como comportamento do laço rápido: a premissa 4 é a que justifica a entrega inteira, e é a que menos se deixa cobrar por leitura de bytes.

Uma nota de custo: a caminhada completa do meu deck de 4 slides e 7 estados, com screenshot e histograma por estado, roda em poucos segundos por arquivo. O gargalo é o launch do Chromium, não a medição — reaproveitar um browser para todos os arquivos da suíte é a otimização óbvia se isso incomodar.

---

### 5. A prova: como se planta "a identidade derreteu"

O ADR 0001 exige prova que planta o defeito e exige vermelho. Fiz isso para as 11 famílias que sobreviveram, e o formato que funcionou tem **quatro asserções, não uma**:

1. **planta o defeito num repo descartável** — cópia do corpus com um `<style>` de override injetado antes do `</head>`, ou uma variante gerada pelo `build.py` com uma flag. Nunca editar o corpus no lugar;
2. **exige vermelho** — `exit 1`;
3. **assere a mensagem, não só o código de saída** — porque o ADR pede que o achado seja o conserto. `the label for "entregas" reads 28 and the 4 series it totals sum to 40 (15 + 10 + 7 + 8)` nomeia o conserto; `exit 1` não nomeia nada. Uma prova que só olha o código de saída passa verde quando a checagem certa dispara pela razão errada;
4. **exige verde no corpus real, sem defeito** — e esta é a asserção que eu não teria escrito antes deste ticket.

**A quarta é a que mais trabalha, e a evidência é o placar.** Das 11 candidatas que testei contra as 12 telas reais do #94, **5 morreram por falso positivo e zero morreu por defeito não pego**:

| checagem | como morreu |
|---|---|
| hex por igualdade com a paleta | 22 hexes acusados em trabalho fiel |
| contraste a 4,5:1 (WCAG AA) | acusou o divisor legítimo da própria identidade |
| sangramento medido por caixa | acusou um `<svg>` cuja caixa passa a borda sem desenhar nada |
| ícone contorno-vs-mancha sem slot | acusou 5 logos de terceiro que são preenchidos por natureza |
| colisão sem guarda de ancestral | acusou todo bloco absoluto contra os próprios filhos |

Nenhuma dessas aparece num corpus sintético — todas aparecem no primeiro contato com trabalho real. **Prova sem corpus real de controle mede o autor da checagem, não a checagem.**

Concretamente, para "a identidade derreteu", os defeitos que plantei e o vermelho que cada um exige:

| defeito plantado | vermelho exigido |
|---|---|
| base64 da fonte truncado mantendo comprimento | `@font-face never loaded for Anton` **e** `h1 painted 29 glyphs in "Liberation Sans"` |
| `h1, h2 { font-family: Arial }` | `h1 painted 29 glyphs in "Liberation Sans", not the display face "Anton"` |
| `h1 { font-size: 26px }` | `h1 renders at 2.89% of stage height, the measured scale for h1 is 8.9%` |
| fundo e texto trocados usando só tokens | `the surface token #141415 is the largest area in only 0 of 7 states` |
| `.lead { color: var(--surface) }` | `p.lead box has no colour above 1.01:1 against its own background #141415` |
| `#667eea` num kicker | `hex #667EEA is in the CSS and is not one of the 11 measured tokens` |
| URL montada em runtime | `the deck asked the network for https://fonts.gstatic.com/...` |
| organograma maior que o painel | `5.043% of the band past the bottom edge is painted` |
| título quebrando em duas linhas | `div.pad overlaps div.pad by 512x20px` |
| ícone `fill` no lugar de `stroke` | `.chip` de 0 para 5 violações do contrato |
| total da rosca mentindo | `reads 28 and the 4 series it totals sum to 40` |

E o controle correspondente: `good.html` verde, e as **12 telas reais do #94 verdes** nas 11 famílias.

---

### Uma armadilha de implementação que custou caro e não é óbvia

O portão da casa manda `set -uo pipefail`. Combinado com `printf '%s' "$big" | grep -q ...`, isso produz **falso vermelho não determinístico**: o `grep -q` sai no primeiro casamento, o `printf` toma SIGPIPE, e com `pipefail` o pipeline reporta **141** — então `! pipeline` é verdadeiro e a checagem acusa um arquivo correto. Levei um bom tempo para achar porque só dispara quando o payload é grande (base64 de fonte) e depende de corrida:

```
DEBUG fam=Anton     grepstatus=0    blocklen=173898
DEBUG fam=DeckBody  grepstatus=141  blocklen=226055
```

O conserto é herestring em vez de pipe (`grep -qE ... <<< "$block"`). **Toda checagem que lê um HTML com fonte embutida em base64 está exposta a isso**, e o sintoma — reprovar às vezes um arquivo bom — é exatamente o que destrói a credibilidade de um portão.

---

### Fecho

**Nascem 11 famílias**: 8 estáticas (S1, S2, S3, S4, S5', S6, S7, S8) mais S9 sob contrato, e 9 de render (R1, R2, R3, R4, R5 a 1,5:1, R6 como detector de inversão global, R8 medindo pixel, R9, R10 por slot). **Não nascem 4**: hex por igualdade, histograma como medida de identidade, razão título/corpo, e cobertura de tinta do ícone.

Três consequências de desenho que este ticket entrega junto, e que valem mais que a lista:

- **A escolha de SVG sobre canvas do #94 é o que torna a família de coerência possível.** Sem os números no markup, S7, S8 e S9 não existem — e são as três que pegam "o desenho está certo e o rótulo está errado", que é o modo de falha mais caro porque é o único invisível num screenshot rápido.
- **Duas famílias exigem que o esqueleto declare o slot** — S5' precisa de lugar para marca de terceiro, R10 precisa de saber que `.chip` é ícone e `.ico` é logo. É a mesma linha de contrato, e sem ela as duas são inúteis por falso positivo.
- **A checagem mais barata é a que o esqueleto torna desnecessária.** R4 mede a escala porque o modelo pode escrever `font-size`. Se o esqueleto for dono da escala e o portão proibir `font-size` no delta, o defeito vira impossível em vez de detectável — e é sempre melhor.
