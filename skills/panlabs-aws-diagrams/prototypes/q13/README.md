# ⚠️ Protótipos descartáveis — não é a skill

Código, medições e desenhos de uma pergunta só, do ticket
[#13 · Camada de estilo e tema](https://github.com/ThiagoPanini/panlabs-skills/issues/13).
**Nada aqui vira produção.** O que sobrevive é a *decisão*, que fica na resolução do ticket;
estes arquivos ficam como fonte primária.

**Abra `comparacao.html` com duplo clique** — os cinco desenhos lado a lado, mais as
medições que decidiram cada um.

## A pergunta

Como a identidade visual é expressa e configurada: onde o estilo mora, o que da convenção
AWS é inegociável, onde fica a margem estética real da casa, quais opções valem ser expostas
— e se uma opção pode quebrar uma checagem do validador.

## A resposta em quatro frases

1. **O tema é um vocabulário FECHADO de tokens, e a camada normativa da AWS é indizível** —
   não existe token que nomeie cor de grupo, cor de categoria, traço de grupo ou tamanho de
   ícone. Mesmo truque do [#11](https://github.com/ThiagoPanini/panlabs-skills/issues/11):
   regra que depende de disciplina se perde na terceira sessão; ausência de palavra, não.
2. **O tema NÃO é downstream do layout.** Nove dos seus tokens são *métrica* e movem
   coordenada (corpo de rótulo, densidade, qualificador); dezessete são *pintura* e não movem
   nenhuma. A partição está provada gerando, não afirmada.
3. **A margem estética da casa não está no fundo.** A paleta oficial da AWS é calibrada para
   branco puro — `#ED7100` só alcança os 3:1 da WCAG 1.4.11 contra `#FFFFFF`. Off-white
   corporativo é proibido por medição, não por gosto.
4. **Sim, uma opção quebra checagem** — e por isso o portão de contraste **reprova**, do lado
   do plano, não do lado do arquivo de tema.

## O cenário

O mesmo IR do [#11](https://github.com/ThiagoPanini/panlabs-skills/issues/11),
`modelo/pedidos-serverless.json`, com uma única adição: o campo `qualificador` por nó, que o
`O21` do [#5](https://github.com/ThiagoPanini/panlabs-skills/issues/5) pede e que o tema só
pode **mostrar ou esconder** — o texto em si é fato da arquitetura, não escolha de estilo.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `tema/esquema.json` | O **vocabulário fechado**, JSON Schema com `additionalProperties: false` em todo objeto. Cada descrição carrega a evidência que fecha aquele token. |
| `tema/tema.cjs` | Tokens → style string. É onde as duas inversões do deck escuro da AWS moram, e o único lugar que sabe que `strokeColor` num shape `aws4` pinta o **glifo**. |
| `tema/{claro,escuro,corporativo,armadilha}.json` | Os quatro temas. `claro` e `escuro` são só o interruptor; `corporativo` é a camada da casa no máximo; `armadilha` é dizível e errado, de propósito. |
| `motor/` | Fork do motor do #11 com o tema costurado. **Não existe caminho sem tema**: `dispor.cjs` — o layout — recebe o tema porque *tem de* receber (ver a partição). |
| `modelo/logica-pedidos.json` | A mesma arquitetura na **vista lógica** (premissa 2). Existe porque é o único lugar onde a casa escolhe cor de caixa — sem ele os tokens `bloco.*` não têm o que pintar. |
| `tools/medir-regua.cjs` | **A régua do fundo.** Até onde a paleta AWS aguenta a página mudar de cor. |
| `motor/contraste.cjs` | O portão: `A7.1`/`A7.2`/`A7.3` da rubrica do [#8](https://github.com/ThiagoPanini/panlabs-skills/issues/8), rodando sobre o **plano**. Mora em `motor/` porque **é estágio de pipeline**, não checagem de fora. |
| `tools/check-portao.cjs` | **O portão sabe falhar** — controle sobre o próprio portão, com cinco planos sabidamente ruins e um bom. |
| `tools/check-vocabulario.cjs` | A camada normativa é indizível — com experimento de controle. |
| `tools/check-particao.cjs` | Pintura × métrica, provado perturbando um token por vez e regerando. |
| `tools/gerar-armadilha.cjs` | As duas armadilhas, desenhadas. |
| `tools/verificar-tema.py` | Confere **no pixel** que o tema chegou no render. |
| `tools/check-roundtrip-tema.cjs` | O tema viaja **resolvido** dentro do `.drawio` e volta intacto pelo codec do próprio app. |
| `tools/renderizar.sh` | Render, com a pegadinha de concorrência do Electron anotada. |
| `tests/rodar.sh` | A régua inteira, oito camadas — **verde**. |

## Os desenhos

| Arquivo | O que é | portão |
|---|---|---|
| `saida/a-claro` | O default. Branco puro, squid ink, Arial 12, grade base 8, seta sólida. | passa (texto 5,35 · traço 3,02 · área 2,71 ⚠) |
| `saida/b-escuro` | O deck escuro da AWS: `AWS Cloud` invertido, ícones monocromáticos invertidos, **cor de grupo e de categoria intocadas**. Fundo `#1C1C1C`. | passa (texto 8,22 · traço 3,02 · área 3,32) |
| `saida/c-corporativo` | A camada da casa no máximo — Arial normativa, título 24 pt, densidade 1,25, seta `#545B64` com ponta *open*, cantos vivos, qualificador em itálico (`O21`) e linha de revisão técnica (`O24`). **No branco, porque a régua não deixa outra coisa.** | passa (texto 5,35 · traço 3,02 · área 2,71 ⚠) |
| `saida/d-armadilha` | Dizível e errado: off-white `#F2F3F5`, tinta pálida, seta fininha. Gerado só com `--forcar`. | **reprova em 4 frentes** |
| `saida/e-indizivel` | Indizível: `sketch=1`, cor de grupo trocada, `rounded=1` em vértice AWS4. Remendo bruto no XML, **depois** do motor. | passa no contraste — e mente assim mesmo |
| `saida/f-fluxo-animado.svg` | `--fluxo animado`. **Abrir no navegador** — as setas correm. Não tem PNG de propósito. | passa |
| `saida/g-vista-logica` | A vista lógica: pré-serviços, onde a convenção AWS não alcança e a casa manda de verdade. | passa (texto 5,35 · grafismo 3,64) |

Gerar e conferir:

```bash
./tests/rodar.sh                    # a régua inteira
node tools/medir-regua.cjs          # só a régua do fundo
node motor/gerar.cjs modelo/pedidos-serverless.json --tema escuro --saida saida/b-escuro.drawio
```

---

## O que as medições disseram

### 1. A paleta da AWS é calibrada para branco puro — e para nada mais

| cor | grupos | vs. branco | fundo claro mais escuro que ainda dá 3:1 |
|---|---|---|---|
| `#ED7100` | Auto Scaling, EC2 instance contents, Beanstalk, Spot Fleet | 3,02 | **`#FFFFFF`** |
| `#7AA116` | Public subnet, IoT Greengrass | 3,03 | `#FEFEFE` |
| `#00A4A6` | Region, Availability Zone, Private subnet | 3,06 | `#FDFDFD` |
| `#7D8998` | Server contents, Corporate data center | 3,56 | `#ECECEC` |

Não existe faixa no meio: ou branco (praticamente puro) ou escuro de verdade
(≤ `#212121` de luminância). **`#F7F8FA`, `#F2F3F5`, `#FAFAFA` — os off-whites
institucionais — todos caem fora.** A pergunta "qual fundo para o tema corporativo" tinha
resposta por número, e a resposta era "esta não é a alavanca".

E a razão de a paleta inteira encostar em 3:1 aparece na terceira tabela do `medir-regua`:
o glifo do service icon é **branco sobre o quadrado da categoria**, então "cor vs. branco" e
"contraste do glifo" são a mesma conta. **A paleta foi calibrada para o glifo caber, não
para a página.** O que sobra para o fundo é o resto.

### 2. O deck escuro da AWS é a edição mínima que a WCAG exige

A AWS publica dois decks, e o escuro muda **duas** coisas: a borda/ícone do `AWS Cloud`
inverte e os callouts invertem (`#5` §2.1). Medindo as nove cores de grupo contra um fundo
escuro (`#1C1C1C`), oito ficam entre 3,18 e 5,65:1 — e **só `#232F3E` desaba para 1,26**.

> A lista da medição e a lista do deck são a mesma. O deck escuro não é escolha estética da
> AWS; é a única edição que a acessibilidade obriga.

O mesmo vale para os assets: só as famílias `Res_General-Icons` têm variante `_Light`/`_Dark`
no pacote oficial, e são exatamente as monocromáticas — `#232F3D`, 1,25:1 no escuro. O
draw.io traz **uma** variante só, então quem inverte é o tema.

E o ícone do próprio `AWS Cloud` inverte junto, de graça: o stencil `group_aws_cloud_alt` não
tem cor fixa nenhuma — ele é preenchido com o `strokeColor` do grupo (a armadilha do #4 §3.2
trabalhando a favor). Trocando a borda para branco, o quadradinho vira **branco com o wordmark
`aws` em vazado**, que é exatamente a variante invertida do deck escuro. Conferido no recorte
de pixel do render, não deduzido.

**Mas o deck escuro não é universalmente seguro.** Duas cores de categoria reprovam no fundo
escuro — `#BC1356` (AR/VR, 2,73:1) e `#3334B9` (Customer Engagement, 1,89:1) —, o que atinge
**6 dos 403 service icons**. Se o diagrama não usa esses serviços, passa. É por isso que o
portão roda sobre o **plano**, e não sobre o arquivo de tema.

### 3. O que a camada de tema custou, arquivo por arquivo

`diff` contra o motor do #11, contando só as linhas alteradas (comentário separado de código):

| arquivo | linhas de código | o que mudou |
|---|---|---|
| `emitir.cjs` | **0** | o emissor de XML **não sabe que existe tema** |
| `alinhar.cjs` | **0** | o passe de encaixe geométrico, idem |
| `derivar.cjs` | **0** | o gatilho de faixa de AZ do #19, idem |
| `resolver.cjs` | 59 | onde o tema encosta no catálogo e onde a métrica de texto nasce |
| `planejar.cjs` | 126 | título, subtítulo, nota, aresta, fundo e **moldura** de página |
| `dispor.cjs` | 73 | **a escala de folga** — o layout precisa do tema |
| `gerar.cjs` | 38 | `--tema`, `--forcar` e o portão |
| `validar.cjs` | 11 | `type` como lista, que o esquema do tema exigiu |

A leitura: o #11 previu que "de `planejar` para frente ninguém sabe de onde veio o desenho, o
que deixa o #13 trocar estilo sem tocar no layout". **Meia previsão certa.** Para *baixo* de
`planejar` a costura segurou perfeitamente — `emitir.cjs` tem zero linhas de diferença. Para
*cima* não: a densidade e o corpo do rótulo entram em `dispor`, porque texto ocupa espaço.

**E não existe caminho sem tema.** A primeira versão deste protótipo carregava um ramo de
fábrica em todo lugar (`tema ? … : …`) para "manter o #11 rodando idêntico" — e ele **não
mantinha**: um literal `+10` de `porGrade` virou `+PAD` e o `web-multi-az` saía 6 px mais alto
sem que nada acusasse. Compatibilidade que ninguém exercita não é compatibilidade, é peso; o
ramo saiu inteiro, e com ele a última style string literal do motor.

### 4. O tema NÃO é downstream do layout

A intuição confortável é que estilo entra no fim. É falsa, e `check-particao.cjs` mede onde:

| classe | tokens | efeito na geometria |
|---|---|---|
| **pintura** | `pagina.cor`, `tinta.*`, `aresta.cor/espessura/ponta/cantos/saltos/fluxo`, `nota.*`, `bloco.*`, `texto.familia` | **17 de 17** não movem uma coordenada — e o XML muda em todos, senão seria token morto |
| **métrica** | `pagina.margem`, `texto.rotulo/grupo/aresta/titulo/subtitulo/qualificador`, `folga.base/densidade`, `cartao.revisao` | **10 de 10** movem — de 5 a 13 células |

Texto reserva espaço, e espaço é geometria. **O tema entra em `resolver`, antes de `dispor`.**

E a checagem pegou **quatro** coisas reais, em três execuções:

- **A faixa de título do container não olhava para `texto.grupo`.** Subir o rótulo de grupo
  para 18 pt não movia nada — a calha continuava em 4 degraus e o texto passava a raspar a
  borda. Corrigido: a faixa é derivada do corpo do texto.
- **`texto.familia` não movia nada com Verdana.** Isso não era um token inerte, era a métrica
  do motor (uma largura média por caractere) sendo cega à família. O conserto honesto foi
  **encolher a opção**: o enum tem três valores (`Arial`, `Arial,Helvetica`, `Helvetica`),
  que são metricamente intercambiáveis, e a família passa a ser **pintura**. Qualquer outra
  fonte exigiria uma tabela de largura por família que o motor não tem.
- **A própria checagem tinha uma condição que não sabia disparar.** O ramo "o token não pintou
  nada" comparava o XML cru, e o XML cru *nunca* podia ser igual: `comPatch` renomeia o tema e
  o `panlabsTema` embutido carrega o `id`. Tirando o payload da comparação, três tokens caíram
  na hora — `bloco.fundo`, `bloco.borda`, `bloco.cantos`.
- **E o acusado era o modelo, não os tokens.** Os `bloco.*` pintam a caixa da **vista lógica**,
  e o modelo de referência é técnico — não tem nenhum `bloco` para pintar. Mesmo caso do
  `texto.qualificador`, que também saiu inerte até o modelo ganhar qualificadores. **Uma
  bateria de um modelo só não distingue "token morto" de "modelo que não exercita o token"**;
  a partição agora roda contra dois.

### 5. O tingimento de subnet — a correção que foi retirada

Esta entrada existe porque a primeira volta errou, e o erro é instrutivo.

**O que eu tinha feito.** O draw.io entrega `Private subnet` com `fillColor=#E6F6F7` e
`Public subnet` com `#F2F6E8`; as outras 18 entradas de grupo são `none`. O deck é o oposto
(`A2`: `<a:noFill/>` nos 156 slides), e o tingimento derruba um ícone de Lambda dentro da
subnet de 3,02 para **2,71:1**. Duas razões apontando para o mesmo lado — zerei o fill no
delta do catálogo.

**Por que estava errado**, em três camadas, e nenhuma delas é opinião:

1. **A pesquisa do #5 já dizia.** A ressalva honesta do `A2` registra que diagramas oficiais
   reais tingem subnet — *Web Application Architecture*, *EKS*, *Security Automations for WAF*,
   *DeepRacer* — e que "sem preenchimento" é **padrão de fábrica, não proibição**. Li a regra e
   ignorei a ressalva que estava três linhas abaixo.
2. **O tingimento do draw.io não é arbitrário.** Medido: ele é exatamente **10% da própria cor
   normativa do grupo sobre o fundo da página**. 10% de `#00A4A6` sobre branco dá `#E6F6F6`
   contra os `#E6F6F7` entregues; 10% de `#7AA116` dá `#F2F6E8` **exato**. O tingimento
   *reforça* a legenda por cor em vez de inventar canal novo — que era a única razão pela qual
   ele seria indizível.
3. **O 2,71:1 era o par errado.** É o **quadrado** do ícone, uma área sólida de 48 px cuja
   identidade é carregada pelo glifo branco de dentro — e esse glifo é medido à parte, contra o
   próprio quadrado, sem depender do fundo. Aplicar a ele o mesmo limiar duro de uma borda de
   1,25 pt é leitura estrita demais da `1.4.11`.

**O que ficou no lugar.** O portão passou a separar `A7.2` **traço** (reprova) de `A7.2a`
**área** (avisa) — e o limiar de área está marcado como operacionalização de engenharia, não
texto da WCAG, a mesma marcação que a rubrica dá ao `A7.4`. O tingimento voltou ao catálogo, e
o **valor** virou derivação do tema (`grupo.tingimento`), porque um azul-claro que funciona no
deck claro é um bloco luminoso num fundo escuro que engole o rótulo branco de quem cai dentro.

Note a divisão que sobrou, que é a lição de arquitetura: **QUAIS grupos são tingidos continua
sendo fato do catálogo** — o tema não tem palavra para mudar esse conjunto — **e o VALOR é
derivado da cor que já estava lá.** Não existe hex de grupo no vocabulário, nem depois de
abrir o token. E a derivação conserta o tema escuro de graça: lá o quadrado do Lambda sobe
para **3,32:1**, melhor do que no claro.

### 5b. E uma correção que ficou de pé

**A calha do rótulo de nota era invisível.** `#E0B34D` sobre branco dá 1,96:1. Trocado por
`#B7791F` (3,64:1). Escolha da casa, corrigida por régua.

### 6. O portão reprova, não avisa

Pela mesma razão que o `conferir` do #11 reprova XML mal formado: **rótulo que some não dá
erro em lugar nenhum**. O arquivo abre, o PNG sai, e o diagrama passa a omitir informação em
silêncio — a família `A4.2` da rubrica, o diagrama que mente por ausência.

O tema `armadilha` (`#F2F3F5` + tinta `#AAB7B8`) reprova em **cinco** frentes de uma vez:

```
A7.1  texto: #AAB7B8 sobre #F2F3F5 = 1.86:1 (precisa 4.5)  — subtítulo
A7.2  traço da aresta: #AAB7B8 sobre #F2F3F5 = 1.86:1      — 5 arestas
A7.2  borda do grupo: #00A4A6 sobre #F2F3F5 = 2.76:1       — Region e Private subnet
A7.1  rótulo do ícone: #5A6C86 sobre #DAEBED = 4.35:1      — Lambda e RDS
A7.1  rótulo do grupo: #5A6C86 sobre #DAEBED = 4.35:1      — VPC endpoint
```

As duas últimas apareceram quando o tingimento voltou: sobre um fundo off-white a subnet é
tingida em `#DAEBED`, e a tinta pálida cai abaixo de 4,5 lá dentro. **O tingimento tornou a
armadilha mais fácil de pegar, não mais difícil.**

**E o portão não substitui a camada indizível.** O `e-indizivel` prova, e o próprio gerador
mede em vez de afirmar: trocando a cor dos três grupos por um azul corporativo `#1B6AC9`
(5,31:1 contra branco), o plano remendado **passa** — 38 pares medidos, pior grafismo 3,02:1,
pior texto 5,35:1. E mesmo assim três fronteiras diferentes viraram a mesma cor, o que apaga a
legenda. Contraste é acessibilidade; não é veracidade. Por isso a camada normativa tem de ser
**indizível**, e não apenas medida.

---

## As decisões

### Onde o estilo mora

**Tema declarativo separado do IR, em JSON, assado célula a célula, e viajando resolvido
dentro do `.drawio`.**

- *Separado do IR* porque o mesmo modelo tem de sair em qualquer tema, e porque a fronteira
  do #11 — "o agente escreve o QUE existe" — não comporta pintura.
- *Assado célula a célula* porque o #4 §7 mediu os quatro níveis do draw.io e só a style
  string por célula (nível D) e os atributos do `<mxGraphModel>` (nível D') viajam no
  arquivo. Folha `mxStylesheet` por nome não viaja o conteúdo; `defaultVertexStyle` é
  configuração do app de quem abre.
- *Viajando **resolvido*** — o `.drawio` guarda `panlabsTema` com os **tokens**, não o nome —
  pela mesma razão que o #4 recusou `style="<nome>"`: nome só resolve contra o que a outra
  ponta tem. Um arquivo que guardasse `tema=claro` regeneraria diferente no dia em que
  `claro.json` mudasse, sem aviso. Verificado como o #11 verificou o modelo: `drawio -x -f xml`
  faz o app **decodificar e re-serializar pelo próprio codec**, e o payload volta byte a byte
  (567 a 600 bytes conforme o tema). A checagem também recusa metadado de arquivo viajando
  como token — `esquema`, `id`, `rotulo`, `porque` e `herda` ficam de fora; `fundo` fica, porque
  sem o interruptor normativo o payload não se reconstrói.

### A camada normativa — indizível, não proibida

O que **não existe token** para dizer, e por quê:

| não dizível | por quê |
|---|---|
| cor de borda de grupo | a cor do grupo **é** a legenda (`#5` §6.4); 21 de 24 diagramas oficiais não têm legenda porque não precisam |
| traço de grupo | `sysDash`/`dash`/sólido carregam significado (`A5`) |
| cor de categoria de serviço | é a categoria (slide 26 do deck) |
| tamanho de ícone | `N1`: *"use icons at their predefined size and do not resize"* |
| `sketch` / `comic` | o `RoughCanvas` jittera o **glifo** do stencil; a paleta oficial força `sketch=0` em 56/56 |
| `glass`, `rounded` em vértice AWS4 | no-op **silencioso** — o pior tipo de opção: o pedido não aparece em lugar nenhum |
| `shadow`, `gradientColor` | zero sombra em 156 lâminas; gradiente é ícone legacy pré-2022 |
| `light-dark()` / `adaptiveColors` | o mesmo arquivo renderiza diferente em dois computadores |
| `math`, `fontSource` | custo de render puro / PNG depende da fonte no servidor de export |

Um item **saiu** desta lista no retorno do #13: o preenchimento de grupo. Ele agora é dizível
como `grupo.tingimento`, com dois valores e nenhum hex — ver a seção 5. A régua para abrir uma
palavra é essa: só quando o token comprovadamente **não consegue** inventar um canal de
significado novo.

`check-vocabulario.cjs` confere as duas pontas — o esquema recusa a **entrada**, e a style
string emitida não carrega a chave na **saída** — e o controle injeta os 14 tokens de volta
no esquema para provar que a checagem sabe falhar.

### A camada da casa — onde está a margem de verdade

| eixo | decisão | apoio |
|---|---|---|
| **tipografia** | `Arial` explícita (não a `Helvetica` herdada), 12 pt no rótulo | `N11` é literal: 12 pt Arial em **todo** rótulo. A paleta AWS4 não seta `fontFamily` em nenhuma entrada — herdar é desvio silencioso |
| **grade base** | **8 px** | derivada dos assets da própria AWS: ícone 48 (6×8), ícone de grupo 40 (5×8), folga mínima `N7` de 0.05" = 4,8 px |
| **escala de espaçamento** | duas classes — **folga** escala com a densidade, **calha** não | calha é reserva de rótulo, derivada de métrica de fonte e do `spacingTop` do estilo (#11 achado 6). Encolher calha não aperta: derruba texto sobre borda |
| **tinta do rótulo de grupo** | tinta neutra do tema, **nunca** a cor da borda | borda é grafismo (3:1), rótulo é texto (4,5:1). Dois limiares não cabem na mesma cor — e é o que o deck já dizia com `tx1` |
| **tratamento de rótulo** | nome + qualificador em itálico embaixo (`O21`), opcional | forte em 4 corpora. É o que salva três buckets S3 idênticos e ilegíveis |
| **tingimento de grupo** | derivado da cor normativa daquele grupo, a 10% sobre o fundo | é o que o draw.io já faz — medido, `#F2F6E8` sai exato. Derivar em vez de fixar é o que faz o tema escuro funcionar: lá o mesmo 10% dá um painel escuro em vez de um bloco luminoso |
| **legenda** | **nenhum token** — e a ausência é a resposta | `O7`/`O20`: 21 de 24 sem legenda, e os 3 com legenda são exatamente os 3 que codificaram significado na cor da linha. **Legenda é a dívida de quem inventa notação** — e como este vocabulário não deixa inventar notação, a dívida nunca é contraída. Um `legenda: auto` teria um único valor alcançável, e knob de um valor só sugere uma escolha que não existe |
| **bloco de título** | dentro do desenho, com título, subtítulo e linha de revisão opcional | `O8` põe o título fora, mas "fora" é a legenda do slide, que não existe num `.drawio` exportado. Os templates AWS do próprio draw.io põem dentro; `O24` dá a anatomia |
| **vista lógica** | a casa manda de verdade — cor de caixa, canto, borda | é pré-serviços; a convenção AWS não alcança |

### As opções expostas ao usuário (premissa 6)

| opção | valores | default | veredito |
|---|---|---|---|
| `grupo.tingimento` | `derivado` \| `nenhum` | **`derivado`** | **Vale**, e é o único token que fala de grupo. Sem hex: o conjunto de grupos tingidos é do catálogo e o valor é 10% da cor normativa daquele grupo. Ver a seção 5 |
| `fundo` | `claro` \| `escuro` | **`claro`** | **Vale.** É normativo — a AWS publica os dois decks. Não é seletor de cor: é interruptor de dois estados, porque a régua não deixa terceiro |
| `folga.densidade` | 0,6 – 2,0 | **1,0** | **Vale**, e é uma alavanca só, multiplicando a escala. Nunca toca calha |
| `aresta.fluxo` | `solido` \| `tracejado` \| `animado` | **`solido`** | **Vale com aviso.** `N9`/`A11`: a seta oficial é **sempre sólida**, então tracejado e animado pagam dívida. `animado` degrada **calado** em PNG (#4 mediu, #11 e este confirmam) |
| `aresta.saltos` | `none` \| `arc` \| `gap` \| `sharp` \| `line` | **`arc`** | **Vale.** Ganho de legibilidade alto, custo zero |
| `aresta.ponta` | `open` \| `blockThin` \| `block` \| `classic` | `blockThin` | **Vale como preset.** O deck manda "Open Arrow"; os templates do draw.io usam `endArrow=open;endFill=0`. O `corporativo` mostra a variante normativa |
| `aresta.cantos` | 0 – 24 | 12 | **Vale.** Em **aresta** `rounded=1` funciona; em vértice AWS4 é no-op — por isso só a aresta tem token |
| `texto.familia` | 3 valores | `Arial,Helvetica` | **Vale encolhido.** Fora dos três, a métrica do motor mente |
| `cartao.revisao` | texto \| ausente | ausente | **Vale.** `O24`, 12 de 12 PDFs |
| legenda | — | — | **Não existe token.** Ver a linha "legenda" da camada da casa: o vocabulário fechado nunca contrai a dívida que exigiria uma |
| fundo livre (qualquer hex) | — | — | **Armadilha.** Dizível, e o portão reprova. Ver `d-armadilha` |
| cor por serviço / por grupo | — | — | **Indizível.** Apaga a legenda. Ver `e-indizivel` |
| `sketch`, `glass`, `rounded` em ícone, sombra, gradiente, `light-dark()` | — | — | **Indizíveis.** Quebram stencil, ou são no-op silencioso, ou fazem o arquivo renderizar diferente por leitor |

### Como o tema interage com o validador

**Uma opção pode quebrar uma checagem de contraste — e é o caso mais comum, não o exótico.**
Três caminhos, todos medidos:

1. `fundo` escuro **sem** virar a tinta → `A7.1` reprova em todo rótulo (1,26:1).
2. Fundo off-white → `A7.2` reprova em três das nove cores de grupo antes de `#FAFAFA`.
3. Canal de significado só em cor → `A7.3`. Este é o único dos três que **não pode acontecer**
   com o vocabulário atual, e é justamente por isso que não existe token de legenda.

O ponto estrutural: **o tema não pode ser validado sozinho.** Contraste depende do fundo
efetivo resolvido pela pilha de z-order (#8 §5) — o tema é hipótese, o plano é onde ela vira
número. Daí o portão morar em `conferir`.

E aqui mora uma correção que o retorno forçou. A primeira volta afirmava que, com a convenção
AWS, o fundo efetivo **era** o fundo da página em todo lugar — porque box de grupo é
transparente (`A2`) — e concluía que a pilha de z-order da rubrica era decorativa neste
desenho. **Com o tingimento de volta, ela deixou de ser.** Duas subnets têm preenchimento, e
tudo que cai dentro delas mede contra o tingimento, não contra a página.

Pior: o portão tinha o **defeito exato** que o [#18](https://github.com/ThiagoPanini/panlabs-skills/issues/18)
registrou no mapa — media o **rótulo do grupo** contra o ancestral em vez de contra o
preenchimento do próprio grupo. Lá isso entregou "13,57:1" para um texto que na tela dava
1,00:1. Aqui ficou **dormente** enquanto os 20 grupos eram `fillColor=none`, e acordou no
instante em que o tingimento voltou.

O corte de z é diferente para cada par, e agora está escrito:

| o que | mede contra | por quê |
|---|---|---|
| **borda** do grupo | o que está **fora** | ela é a fronteira; o que importa é achá-la na página |
| **rótulo** do grupo | o preenchimento do **próprio** grupo | ele é desenhado no topo, por cima do fill |
| **rótulo** da folha | o **pai** | `verticalLabelPosition=bottom` desenha fora da caixa do ícone |
| **rótulo** do ícone monocromático | o **pai** | ali `fillColor` é o *glifo*, não uma superfície |
| **glifo** do ícone de serviço | o **próprio quadrado** | não depende do fundo da página |

`tools/check-portao.cjs` guarda os cinco com seis planos sabidamente ruins — e um bom, porque
portão que só sabe dizer não não é portão. Ele se pagou duas vezes na mesma tarde:

- **a primeira versão dos fixtures não pegou dois casos**, e o motivo foi instrutivo: as células
  de teste não tinham rótulo, então não exercitavam nada. Controle que não exercita é controle
  que mente;
- **a primeira versão da correção foi longe demais.** Apliquei o corte novo ao ramo `aws4`
  inteiro, e ele cobre três caminhos, não dois: grupo, ícone de serviço e ícone **monocromático**
  — onde `fillColor` é o glifo. Resultado: `#232F3E` sobre `#232F3E`, 1,00:1, reprovando os três
  temas de uma vez. A suite pegou na execução seguinte, e o caminho que faltava virou o sexto
  caso do controle.

---

## As duas listas que o #17 encaminhou

### As 5 divergências de `fontColor`

**Resolvidas, e a resolução é que `fontColor` de grupo não é fato de catálogo.** O deck manda
12 pt Arial na cor `tx1` — que não é um hex, é um papel, e só o tema sabe contra que fundo
resolve. O catálogo continua espelhando o upstream; o tema sobrescreve.

O argumento que fecha não é a citação, é a medição: **borda é grafismo (3:1) e rótulo é texto
(4,5:1)**; dois limiares diferentes não cabem na mesma cor.

| hex | onde | claro | escuro |
|---|---|---|---|
| `#AAB7B8` | rótulo do VPC | **2,06 ✗** | 8,26 |
| `#248814` | Public subnet | 4,56 | **3,74 ✗** |
| `#3F8624` | IoT Greengrass ×2 | 4,52 | **3,77 ✗** |
| `#5A6C86` | Server contents, Corporate data center | 5,35 | **3,18 ✗** |
| `#232F3E` | AWS Cloud | 13,57 | **1,26 ✗** |

No fundo claro só uma reprova; no escuro reprovam as cinco. "Rótulo herda a cor da borda" é a
leitura que **não sobrevive a nenhuma troca de fundo**.

E o `#232F3E` do `AWS Cloud` fica como está, como o #17 recomendou: é o squid ink de 403
service icons, o `#242F3E` do deck é inconsistência do próprio pacote da AWS, e é justamente
a cor que o deck escuro inverte — o tema já cuida disso.

### Os 4 desempates arbitrários

Regra fixada, em três degraus: **deck → irmandade → ordem da paleta, registrada**.

| serviço | antes | agora | por quê |
|---|---|---|---|
| **Snowmobile** | Migration `#01A88D` | **Storage `#7AA116`** | Snowball e Snowball Edge caem em Storage pelo deck. Três irmãos em duas cores era o sintoma visível |
| **Kinesis Video Streams** | Analytics `#8C4FFF` (arbitrário) | **Analytics `#8C4FFF`** (por irmandade) | Kinesis, Data Streams e Data Firehose resolvem em Analytics. O valor não mudou; deixou de ser sorte |
| **Compute Optimizer** | Compute `#ED7100` | **continua, `revisar: true`** | a própria AWS lista em duas categorias no deck, e o serviço não tem família. Não há resposta na fonte |
| **Quantum Ledger Database** | Blockchain `#ED7100` | **continua, `revisar: true`** | descontinuado, sem irmão de produto |

Ambiguidade registrada é honesta; ambiguidade escondida não. E nada disso é do tema: cor de
categoria não tem token.

---

## Achados de método (valem para o motor de verdade)

- **Duas exportações headless simultâneas do draw.io penduram — e o pendurado envenena a
  máquina.** A pesquisa do #9 deixou "concorrência não testada" como incerteza; está testada, e
  o resultado é pior que lentidão. Duas exportações ao mesmo tempo produzem
  `UnhandledPromiseRejectionWarning: Error: UnknownVizError` + `GPU process isn't usable`, com
  **código de saída 0 ou 1 e nenhum PNG**. O agravante é o que sobra: `timeout` mata o
  `xvfb-run`, **não** os filhos Electron. Eles ficam em `STAT S`, 0 % de CPU, por tempo
  indeterminado — medi **508 s** num export que leva 4 s — e a partir daí **toda tentativa
  posterior falha, inclusive as sequenciais**. Ceifados os pendurados, o mesmo comando que
  havia falhado cinco vezes passou de primeira. `tools/renderizar.sh` varre e ceifa na entrada.
  Perfil `--user-data-dir` próprio é higiene barata, mas sozinho **não** resolve.
- **O validador do #11 não suporta `type` como lista** (draft-07 legítimo). O esquema do tema
  precisou — `cartao.revisao` é string ou null. Três linhas.
- **Uma opção de estilo pode exigir um campo novo no IR.** `texto.qualificador` (o `O21`) é o
  único token que não se resolve sozinho: o tema decide **se mostra**, mas *o que* mostrar é
  fato da arquitetura. Foi a única vez em que a camada de estilo alcançou o modelo — e a
  checagem de partição foi quem obrigou a admitir isso, ao acusar o token como inerte num
  modelo sem qualificadores.
- **Uma colisão herdada, que este ticket não conserta de propósito.** Nos cinco desenhos, a
  aresta 4 (`grava pedido`) sai do Lambda pelo mesmo lado e na mesma altura da aresta 3, e o
  segmento horizontal dela cruza o rótulo `3. consulta catálogo`. É `A3.2` da rubrica, e é
  **layout**, não estilo: o halo (`labelBackgroundColor`) mascara a aresta *dona* do rótulo,
  nunca uma terceira. Consertar aqui contradiria a própria tese do ticket — a partição diz que
  pintura não move coordenada, e mover coordenada é do #18. Registrado, não silenciado.
- **Todo portão precisa de controle, inclusive o que julga os outros.** Cada checagem deste
  protótipo ganhou experimento de controle; o portão de contraste era o único sem — e era o que
  mais tinha a perder, porque portão que aprova por engano produz um **verde**. Quando o
  controle foi escrito, ele achou na hora o defeito de corte de z que o #18 já tinha registrado.
- **Afirmação de pixel que não sabe falhar não vale mais que checagem que não sabe falhar.** A
  verificação afirmava que o tingimento *fixo* do draw.io (`#E6F6F7`) estava ausente de todo
  render — e a afirmação é **indecidível no tema claro**, porque o valor derivado é `#E6F6F6`,
  um degrau de azul de distância. Nenhuma tolerância separa os dois: eles são a mesma cor. A
  afirmação foi para onde ela decide, que é o tema escuro. Mesmo defeito que a checagem de
  partição tinha, uma camada acima.
- **Checagem sem controle não prova nada** (a lição do #17, de novo). Os 14 tokens proibidos
  são reinjetados no esquema para confirmar que a checagem acusa; os 17 tokens de pintura são
  conferidos também contra o XML, para pegar o caso "não moveu geometria **nem pintou nada**".
