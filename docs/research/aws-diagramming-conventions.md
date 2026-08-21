# Convenções oficiais da AWS para diagramas de arquitetura

> **Pergunta de pesquisa:** o que a AWS prescreve **oficialmente** sobre como desenhar
> uma arquitetura — e o que os diagramas oficiais fazem que os amadores não fazem?
>
> **Data da pesquisa:** 2026-08-21
> **Release dos ícones analisada:** `Release 24-2026.07.31` (a mais recente na data)

---

## Fontes primárias usadas

Toda afirmação neste documento vem de uma destas fontes. **Nenhum write-up de terceiro
foi usado como autoridade.**

| # | Fonte | URL / arquivo |
|---|---|---|
| F1 | Página oficial AWS Architecture Icons | <https://aws.amazon.com/architecture/icons/> |
| F2 | Deck oficial PPTX — fundo claro | `Microsoft-PPTx-toolkits_07312026.zip` → `AWS-Architecture-Icons-Deck_For-Light-BG_07312026.pptx` |
| F3 | Deck oficial PPTX — fundo escuro | mesmo zip → `AWS-Architecture-Icons-Deck_For-Dark-BG_07312026.pptx` |
| F4 | Pacote oficial de assets (SVG/PNG) | `Icon-package_07312026.zip` |
| F5 | AWS Architecture Center | <https://aws.amazon.com/architecture/> |
| F6 | AWS Trademark Guidelines (atualizado 17-jul-2026) | <https://aws.amazon.com/trademark-guidelines/> |
| F7 | Amazon VPC — PrivateLink / gateway endpoints | <https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html> |
| F8 | AWS Security Reference Architecture | <https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/architecture.html> |
| F9 | AWS — "What is architecture diagramming?" (explicativo, descritivo) | <https://aws.amazon.com/what-is/architecture-diagramming/> |
| F10 | AWS Solutions Library — Dynamic Image Transformation for CloudFront (diagrama + PNG inspecionado) | <https://docs.aws.amazon.com/solutions/latest/dynamic-image-transformation-for-amazon-cloudfront/lambda-architecture.html> |
| F11 | Corpus de 24 diagramas oficiais inspecionados pixel a pixel | Reference Architecture PDFs em <https://d1.awsstatic.com/architecture-diagrams/ArchitectureDiagrams/>, <https://docs.aws.amazon.com/architecture-diagrams/>, Solutions Library e Prescriptive Guidance patterns — URLs citadas caso a caso na seção 5.3 |
| F12 | AWS SRA — conta Application + PPTX editável de origem | <https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/application.html> |
| F13 | Generative AI Application Builder on AWS (mesma arquitetura com e sem VPC) | <https://docs.aws.amazon.com/solutions/latest/generative-ai-application-builder-on-aws/architecture-overview.html> |

URLs de download verbatim (F1, capturadas em 2026-08-21):

```
https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Microsoft-PPTx-toolkits_07312026.1c286c4a809a3cf2902c88ff63bf7dd1fa3cd55d.zip
https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip
```

**Método:** os dois pacotes foram baixados e os `.pptx` foram abertos como ZIP/OOXML.
Cores, espessuras de linha, padrões de traço, tamanhos e coordenadas foram extraídos
diretamente do XML (`ppt/slides/slideN.xml`, `ppt/theme/theme1.xml`) e dos SVGs do
pacote de assets. **Os hex neste documento não são estimados a partir de captura de
tela — são os valores literais dos arquivos da AWS.**

---

## 1. AWS Architecture Icons — regras de uso declaradas

### 1.1 O que a página pública diz (F1)

A página oficial é notavelmente **magra** em regras. O texto normativo completo é:

> "We allow customers and partners to use these toolkits and assets to create
> architecture diagrams."
>
> "AWS architecture icons are designed to be simple, so you can easily use them in
> diagrams. You can also put icons in materials like whitepapers, presentations, data
> sheets, and posters."
>
> "You can build diagrams with preexisting libraries on third-party tools. Check that
> you're using up-to-date icons, because some libraries may contain legacy icon sets."
>
> "Architecture icon packages are released on a quarterly basis: Q1 (end of January),
> Q2 (end of April), and Q3 (end of July). No releases occur in Q4."

**Correção a uma premissa comum:** na release atual a AWS distribui apenas **dois**
artefatos oficiais — `Microsoft PPTx toolkits` e `Icon package` (SVG + PNG). **Não há
mais deck oficial Sketch, Figma ou Draw.io.** Figma, Draw.io, Cacoo, Creately,
Cloudcraft, Arcentry, Cloudockit e Cloudviz.io aparecem na página apenas como
*ferramentas de terceiros* listadas em "Drawing and diagramming tools" — e vêm com a
ressalva explícita de que suas bibliotecas podem conter *legacy icon sets* (F1).

### 1.2 O que o deck diz — as regras DO / DON'T

As regras reais vivem **dentro do PPTX**, na seção *Guidelines* (slides 10–18). São
listas explícitas de `DO:` e `DON'T:`. Transcrição literal (F2):

**Ícones (slide 15)**

> **DO:** Use icons at their predefined size, color and format in diagrams. / Scale
> icons as needed for use in presentations. / Hold down Shift while resizing.
>
> **DON'T:** Crop service icons. / Flip or rotate icons. / Change icon shapes.

E, no corpo do slide:

> "All icons in this deck are SVGs, allowing them to be scaled up or down **only when
> used in presentations**. To preserve icon integrity, be sure to hold down Shift while
> resizing. **For diagrams, use icons at their predefined size and do not resize.**"

**Grupos (slide 14)**

> **DO:** Use a generic group type if the presets do not suit your needs. / Add a custom
> group if needed (see slide 26).
>
> **DON'T:** Create groups with nonapproved AWS icon(s). / **Resize group icons.**

> "Nested groups — When you have groups within groups, inner groups should have at least
> **.05" buffer on all sides**."

**Setas (slide 16)**

> **DO:** Use the preset arrows provided in the Elements section. / Use **straight lines
> and right angles** to connect objects wherever possible. / In the instance where right
> angles are not possible, you may use a diagonal line as provided.
>
> **DON'T:** Use anything beside preset or default arrows.

> "Preset arrows use the 'Open Arrow' in **Size 4**."

**Rótulos de ícone (slide 17)**

> "All label text should be **12pt Arial** throughout the diagram."
>
> "AWS service names must fit on **no more than two lines**. AWS or Amazon should always
> be accompanied by the service name. Lines should never break mid-word."
>
> **DO:** Break a line after the second word in the service name if necessary.
>
> **DON'T:** Use short forms without first mentioning the full service name somewhere in
> the document. / Duplicate short forms for different services, such as ELB for Elastic
> Beanstalk and Elastic Load Balancing. / Break a line in the middle of a word.

**Callouts numerados (slide 18)**

> "Callouts are **black with bold white type** so that they stand out among the colored
> service and resource icons in the diagram."
>
> **DO:** Use callouts at their predefined size, color and format. / **Order your numbers
> as linearly as possible, such as left to right, top to bottom, or clockwise.** / Be as
> consistent as possible in placement of the callouts.
>
> **DON'T:** Mix callout sizes within the same diagram. / Change color or font size
> within the callout. / **Use letters or other symbols.** / Manually size or stretch the
> callout shape. / Create new callout shapes.

**Training & Certification (slide 13)** — o único lugar do deck com um "style guide"
numérico fechado:

> "Diagrams for Training and Certification should appear only on a **white background**."
> "All type should be **16pt** throughout the diagram." / "All type should be **black**."
> "All icon sizes are **fixed and should not be altered**." / "All colors for icons have
> been **accessibility tested and should not be altered**."
> "All lines should be **2pt** throughout the diagram." / "All colors for lines have been
> **accessibility tested and should not be altered**."

> ⚠️ Esse slide vale **só** para material de Training & Certification. O resto do deck
> usa 12pt e linhas de 1.25pt (medido no XML). Não confunda os dois regimes.

### 1.3 Resumo do que é proibido

| Proibição | Slide | Literal? |
|---|---|---|
| Distorcer / mudar a forma do ícone | 15 | sim (`Change icon shapes`) |
| Cortar (crop) ícone de serviço | 15 | sim |
| Espelhar ou rotacionar ícone | 15 | sim |
| Redimensionar ícone **em diagrama** | 15 | sim (redimensionar só em *apresentação*, com Shift) |
| Redimensionar o ícone de um grupo | 14 | sim |
| Recolorir ícones | 13 | sim, mas explicitado só no contexto T&C |
| Criar grupo com ícone não aprovado | 14 | sim |
| Usar setas fora do preset/default | 16 | sim |
| Misturar tamanhos de callout no mesmo diagrama | 18 | sim |
| Usar letras/símbolos em vez de números nos callouts | 18 | sim |
| Quebrar nome de serviço no meio da palavra | 17 | sim |
| Usar forma curta sem antes citar o nome completo | 17 | sim |

### 1.4 O que NÃO existe (verificado, não presumido)

Três buscas negativas que mudam como a pergunta deve ser respondida:

1. **Não existe documento de AWS Prescriptive Guidance sobre diagramação.**
   `https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-diagrams/`
   retorna **HTTP 404**. Sete slugs candidatos (`architectural-diagrams`,
   `architecture-diagrams`, `diagramming`, `create-architecture-diagrams`,
   `aws-architecture-diagrams`, `diagram-guidelines`, `documenting-architecture`) foram
   testados: todos 404. Se você vir esse documento citado, a citação está errada.

2. **As AWS Trademark Guidelines não cobrem os architecture icons.**
   <https://aws.amazon.com/trademark-guidelines/> (última atualização 17-jul-2026) não
   contém a expressão "architecture icon" em lugar nenhum. As proibições fortes que ela
   traz governam **Marks/logos**, não ícones de arquitetura:

   > "**9. Logo Display.** [...] You will not alter the logo images in any manner,
   > including but not limited to changing the proportion, color, or font of the AWS
   > Marks, or adding or removing any elements to or from the images."
   >
   > "**10. Trade Dress.** You will not imitate the trade dress or 'look and feel' of any
   > AWS website, including without limitation, the branding, color combinations, fonts,
   > graphic designs, product icons, or other elements associated with AWS."

   Ou seja: a regra "não distorça, não recolora" que muita gente atribui às trademark
   guidelines **vem do deck**, não delas.

3. **O pacote de assets não traz README, LICENSE nem TERMS.** Só SVG e PNG. Verificado
   descompactando `Icon-package_07312026.zip` inteiro.

**Conclusão:** o **deck PPTX é a única fonte normativa escrita da AWS sobre como desenhar
um diagrama de arquitetura.** Ele não é indexado como documento, não é linkado como
guia, e só é alcançável baixando o zip da página de ícones.

**Nota importante:** a proibição genérica de *recolorir* não aparece como `DON'T` na
seção geral de ícones — ela é declarada de forma inequívoca apenas no slide 13
(Training & Certification). Ver "Incertezas".

---

## 2. Hierarquia canônica de grupos — cores, bordas, rótulos

### 2.1 A tabela (extraída do XML do deck oficial)

Todos os valores abaixo vêm de `ppt/slides/slide25.xml` (deck claro, F2) e
`ppt/slides/slide23.xml` (deck escuro, F3) — o slide "Groups 1/5", que é a paleta
oficial de grupos. A cor do quadrado do ícone vem dos SVGs em
`Architecture-Group-Icons_07312026/` (F4).

**Constantes válidas para TODOS os grupos:**

- Espessura da borda: `w="15875"` EMU = **1.25 pt**
- Preenchimento do box: `<a:noFill/>` → **transparente, sem fundo colorido**
- Rótulo: **12 pt Arial**, cor `tx1` (preto no deck claro / branco no escuro)
- Rótulo posicionado no **topo** do box (`tIns` = 91440 EMU = 0.1")
- Quando há ícone: `lIns` = 502920 EMU = **0.55"** de recuo à esquerda, para o texto
  não colidir com o ícone
- Ícone de grupo: **0.417" (40 px @96dpi)**, ancorado no **canto superior esquerdo**
  do box (offset relativo 0,0)

| Grupo | Borda (deck claro) | Borda (deck escuro) | Traço (`prstDash`) | Ícone? | Cor do quadrado do ícone | Alinhamento do rótulo |
|---|---|---|---|---|---|---|
| **AWS Cloud** | `#000000` (`tx1`) | `#FFFFFF` (`bg1`) | sólida | **sim** (2 variantes) | `#242F3E` claro / `#FFFFFF` invertido no escuro | esquerda |
| **Region** | `#00A4A6` | `#00A4A6` | `sysDash` (tracejado fino) | **sim** | `#00A4A6` | esquerda |
| **Availability Zone** | `#00A4A6` | `#00A4A6` | `dash` (tracejado largo) | **NÃO** | — | **centro** |
| **Virtual private cloud (VPC)** | `#8C4FFF` | `#8C4FFF` | sólida | **sim** | `#8C4FFF` | esquerda |
| **Private subnet** | `#00A4A6` | `#00A4A6` | sólida | **sim** | `#00A4A6` | esquerda |
| **Public subnet** | `#7AA116` | `#7AA116` | sólida | **sim** | `#7AA116` | esquerda |
| **Security group** | `#DD344C` | `#DD344C` | sólida | **NÃO** | — | esquerda |
| **Auto Scaling group** | `#ED7100` | `#ED7100` | `dash` | **sim** | `#ED7100` | **centro** |
| **AWS account** | `#E7157B` | `#E7157B` | sólida | **sim** | `#E7157B` | esquerda |
| **Corporate data center** | `#7D8998` | `#7D8998` | sólida | **sim** | `#7D8998` | esquerda |
| **Server contents** | `#7D8998` | `#7D8998` | sólida | **sim** | `#7D8998` | esquerda |
| **EC2 instance contents** | `#ED7100` | `#ED7100` | sólida | **sim** | `#ED7100` | esquerda |
| **Spot Fleet** | `#ED7100` | `#ED7100` | sólida | **sim** | `#ED7100` | esquerda |
| **Elastic Beanstalk container** | `#ED7100` | `#ED7100` | sólida | **sim** | `#ED7100` | esquerda |
| **AWS Step Functions workflow** | `#E7157B` | `#E7157B` | sólida | **sim** | `#E7157B` | esquerda |
| **AWS IoT Greengrass** | `#7AA116` | `#7AA116` | sólida | **sim** | `#7AA116` | esquerda |
| **AWS IoT Greengrass Deployment** | `#7AA116` | `#7AA116` | sólida | **sim** | `#7AA116` | esquerda |
| **Generic group** (tracejado) | `#7D8998` | `#7D8998` | `dash` | **NÃO** | — | **centro** |
| **Generic group** (sólido) | `#7D8998` | `#7D8998` | sólida | **NÃO** | — | **centro** |

**Leituras importantes desta tabela:**

1. **A cor da borda é idêntica à cor do quadrado do ícone** em todos os grupos — exceto
   `AWS Cloud`, cuja borda é preta pura (`#000000`) enquanto o ícone é `#242F3E`
   (squid ink). Esse é o único desvio.
2. **As cores dos grupos NÃO mudam entre o deck claro e o escuro.** Só `AWS Cloud` troca
   (preto ↔ branco), porque é a única cor near-black da paleta.
3. **`Availability Zone`, `Security group` e `Generic group` não têm ícone.** Isso é
   verificável de duas formas independentes: no XML do slide 25 (esses três são
   retângulos soltos, não `grpSp` com um `pic` dentro) e no pacote de assets, onde
   `Architecture-Group-Icons_07312026/` **não contém** nenhum arquivo `Availability-Zone`
   ou `Security-group`.
4. **Três grupos têm rótulo centralizado** — `Availability Zone`, `Auto Scaling group` e
   `Generic group`. Todos os outros são alinhados à esquerda. Não é acidente: os dois
   primeiros são grupos que *atravessam* outros grupos (ver 2.3), e centralizar evita
   colisão com o canto de quem eles cruzam.
5. **`#00A4A6` e `#7D8998` não pertencem à paleta de categorias de serviço** — são cores
   exclusivas de grupo ("teal de infraestrutura" e "cinza neutro").

### 2.2 Paleta oficial de cores de categoria (slide 26, F2)

O slide 26 ("Create a Custom Group for a Service") entrega o mapeamento completo
categoria → cor. É a mesma cor usada no fundo do ícone de serviço daquela categoria.

| Hex | Categorias |
|---|---|
| `#ED7100` | Blockchain, Compute, Containers, Media Services, Quantum Technologies |
| `#C925D1` | Customer Enablement, Databases, Developer Tools, Satellite |
| `#7AA116` | Cloud Financial Management, Internet of Things, Storage |
| `#01A88D` | Artificial Intelligence, End User Computing, Migration & Modernization |
| `#8C4FFF` | Analytics, Games, Networking & Content Delivery, Serverless |
| `#DD344C` | Business Applications, Customer Experience, Front-End Web & Mobile, Security & Identity |
| `#E7157B` | Application Integration, Management Tools, Multicloud & Hybrid |

Confirmado nos SVGs (F4): `Arch_Amazon-Simple-Storage-Service_64.svg` tem
`fill="#7AA116"` (Storage) e glifo `#FFFFFF`. `Virtual-private-cloud-VPC_32.svg` tem
`fill="#8C4FFF"` — a mesma cor de Networking & Content Delivery. **A cor do grupo VPC não
é arbitrária: é a cor da categoria Networking.** Idem `Public subnet` = `#7AA116` = Storage/IoT.

> Nota: na release atual os ícones de serviço usam **fill sólido**, sem gradiente. As
> releases de 2021–2022 usavam gradiente; se você vir um ícone com gradiente, ele é
> legacy. Isso corrobora o aviso da F1 sobre bibliotecas de terceiros desatualizadas.

### 2.3 A hierarquia real: nem tudo aninha

A premissa comum é `AWS Cloud › Region › VPC › Availability Zone › Subnet`, tudo
estritamente aninhado. **Os diagramas oficiais da AWS não desenham assim.**

O deck declara isso em texto (slide 14):

> "Some groups **cross** multiple groups, such as Auto Scaling, while others are meant to
> **nest** inside another, such as **a VPC and subnets**."

E as coordenadas confirmam. Medições em polegadas absolutas extraídas do XML:

**Slide 9 — "System Elements 2/2", a ilustração canônica de *Nested groups* (F2):**

| Box | X | Y |
|---|---|---|
| AWS Cloud | 5.12 → 13.01 | 1.16 → 6.28 |
| Virtual private cloud (VPC) | 5.20 → 12.92 | 2.12 → 5.81 |
| Availability Zone 1 | 5.61 → 7.96 | **1.70 → 5.93** |
| Availability Zone 2 | 10.15 → 12.49 | **1.70 → 5.93** |
| Auto Scaling group | 5.70 → 12.39 | 3.51 → 4.57 |

As AZs começam **0.42" acima** do topo da VPC e terminam **0.12" abaixo** da base dela.
Elas são colunas verticais que **atravessam** a caixa da VPC. O Auto Scaling group é uma
faixa horizontal que atravessa as duas AZs.

**Slide 21 — exemplo "Chef Automate Architecture on AWS" (F2):**

| Box | X | Y |
|---|---|---|
| AWS Cloud | 4.52 → 13.07 | 1.37 → 6.39 |
| Availability Zone | 5.17 → 12.42 | 1.72 → 6.18 |
| Virtual private cloud (VPC) | **4.76 → 12.82** | 2.28 → 5.98 |
| Public subnet | 5.24 → 12.34 | 2.90 → 5.40 |

Aqui a VPC é **mais larga** que a AZ (sai pelos dois lados) e a AZ é **mais alta** que a
VPC (sai por cima e por baixo). Elas se cruzam. A **subnet**, por outro lado, está
inteiramente contida em **ambas**.

**O modelo real, portanto:**

```
AWS Cloud  ⊃  { VPC, AZ }        VPC e AZ se CRUZAM (não aninham)
Subnet     ⊂  (VPC ∩ AZ)         a subnet é a interseção
```

Isso é tecnicamente correto: uma VPC **abrange várias AZs**, e uma subnet pertence a
**exatamente uma** AZ. Nenhum dos dois contém o outro. O aninhamento estrito
`VPC › AZ` que amadores desenham é um erro de modelagem, não só de estética.

**`Region` não aparece em nenhum diagrama de exemplo do deck** — só na paleta do slide
25. Um `grep` por `<a:t>Region</a:t>` combinado com `#00A4A6` em todos os 156 slides
retorna apenas `slide25.xml`. Ver "Incertezas".

---

## 3. Service Icon vs Resource Icon

### 3.1 A definição da AWS (slide 8, F2)

> "**Service icons** — Represent an AWS service"
> "**Resource icons** — Represent an AWS service resource"
> "**General resource icons** — Apply to resources and objects for multiple AWS services
> and categories"

### 3.2 A diferença estrutural (verificável no pacote, F4)

São **três** famílias, não duas. A diferença é visual e verificável no SVG:

| | **Service icon** | **Resource icon** (de serviço) | **General resource icon** |
|---|---|---|---|
| Pasta | `Architecture-Service-Icons_07312026/Arch_<Cat>/` | `Resource-Icons_07312026/Res_<Cat>/` | `Resource-Icons_07312026/Res_General-Icons/` |
| Prefixo | `Arch_` | `Res_` | `Res_` |
| Tamanhos | **16, 32, 48, 64** (+ `@5x` PNG) | **apenas 48** | **apenas 48** |
| Variantes Light/Dark | não | não | **sim** (`Res_48_Light/`, `Res_48_Dark/`) |
| **Fundo** | **quadrado sólido** na cor da categoria | **nenhum** (`<rect>` = 0) | **nenhum** |
| **Cor do traço** | glifo **branco** sobre o quadrado | **cor da categoria** | `#242F3E` (Light) / `#FFFFFF` (Dark) |
| Nomenclatura | `Arch_Amazon-EC2_32.svg` | `Res_Amazon-EC2_Instance_48.svg` — **serviço + recurso** | `Res_User_48_Light.svg` |

Verificação literal nos SVGs (F4):

```
Arch_Amazon-Simple-Storage-Service_64.svg  → rect 80x80 fill="#7AA116", glifo #FFFFFF
Res_Amazon-Simple-Storage-Service_Bucket_48.svg → 48x48, 0 rects, traço #7AA116
Res_Amazon-EC2_Instance_48.svg             → 48x48, 0 rects, traço #ED7100
Res_Amazon-CloudFront_Functions_48.svg     → 48x48, 0 rects, traço #8C4FFF
Res_User_48_Light.svg                      → 48x48, 0 rects, traço #242F3E
Res_User_48_Dark.svg                       → 48x48, 0 rects, traço #FFFFFF
```

**A regra visual, portanto, é inequívoca:**

> **Quadrado colorido preenchido = serviço.**
> **Glifo em linha, na cor da categoria, sem quadrado = recurso daquele serviço.**
> **Glifo em linha monocromático (squid ink / branco) = recurso genérico** (User, Client,
> Internet, Server, Database...).

Só as famílias `General` têm variantes Light/Dark, porque só elas são monocromáticas e
precisam inverter conforme o fundo. As demais usam a cor da categoria, que já foi testada
para os dois fundos (slide 15: "designed to be used on both light and dark backgrounds").

O nome do arquivo de resource icon carrega o serviço-pai (`Res_AWS-Backup_Backup-Vault_48.svg`,
`Res_AWS-App-Mesh_Virtual-Node_48.svg`). Ou seja: **um resource icon nunca existe
sozinho — ele sempre é um recurso *de* algum serviço.**

### 3.3 Quando usar cada um — o que o exemplo canônico mostra

O slide 9 anota explicitamente as duas coisas no mesmo diagrama:

- **Service icon** → `Amazon EC2 Auto Scaling` (o serviço)
- **Resource icon** → `Instance`, `NAT gateway` (as coisas concretas que o serviço cria)

A regra operacional que decorre disso: **use o service icon quando o elemento do diagrama
é "o serviço"; use o resource icon quando é uma instância concreta e contável daquele
serviço** (uma instância EC2, um bucket, uma fila, um NAT gateway). Note que o deck
**não escreve essa frase** — ela é inferida da definição + do exemplo. Ver seção
NORMATIVO vs OBSERVADO.

### 3.4 Tamanhos usados nos diagramas oficiais (medido no XML)

| Elemento | Tamanho no slide | Asset correspondente |
|---|---|---|
| Ícone de **grupo** | 0.417" = **40 px @96dpi** | `*_32.svg` (canvas 40×40) |
| Ícone de **serviço/recurso** no diagrama | 0.500" = **48 px @96dpi** | `Arch_48` / `Res_48` |
| Ícone de serviço em destaque (slide 9) | 0.833" = **80 px** | `Arch_64` (canvas 80×80) |

> Detalhe do pacote: o SVG nomeado `_32` tem canvas **40×40**; o `_64` tem **80×80**.
> O número no nome é a grade de design, não o tamanho do arquivo. Quem faz o import
> assumindo que `_64` é 64 px desalinha o diagrama inteiro.

---

## 4. Serviços gerenciados fora da VPC (S3, DynamoDB, SQS, EventBridge)

### 4.1 Não existe regra escrita

Varri os 156 slides do deck oficial procurando por qualquer texto normativo sobre
posicionamento de serviços gerenciados em relação ao box da VPC (`grep` por
`outside`, `boundary`, `inside`, `managed`, `VPC` nos `<a:t>` de todos os slides de
guidelines). **Não há nenhuma frase sobre isso.** O deck ensina *quais* boxes existem e
como formatá-los; não ensina *o que colocar dentro de qual*.

### 4.2 O que o exemplo oficial mostra

O slide 20 do deck ("Example: Git to S3 Webhooks", F2) é a evidência direta mais forte.
Estrutura medida:

| Elemento | X | Dentro do quê |
|---|---|---|
| `Git users` | 0.58 | **fora** do AWS Cloud |
| `Third-party Git repository` | 2.84 | **fora** do AWS Cloud |
| **AWS Cloud** (box) | **5.90 → 11.92** | — |
| `AWS Lambda` | 6.69 | dentro do AWS Cloud |
| `Amazon S3 SSH key bucket` | 9.64 | dentro do AWS Cloud |
| `AWS KMS key` | 9.64 | dentro do AWS Cloud |
| `Amazon S3 output bucket` | 9.64 | dentro do AWS Cloud |

Ou seja: **S3, KMS e Lambda ficam soltos dentro do box `AWS Cloud`, e não há box de VPC
nenhum no diagrama.** A AWS não desenhou uma VPC vazia só para deixar o S3 do lado de
fora — ela simplesmente não desenhou VPC, porque a arquitetura não usa uma.

A convenção que decorre: **serviços gerenciados que não vivem na VPC do cliente ficam
dentro de `AWS Cloud` (ou de `Region`), fora do box da VPC.** O box da VPC só entra em
cena quando existe rede de cliente para representar.

---
### 4.3 O que a documentação de rede da AWS estabelece (indiretamente)

A AWS nunca escreveu "desenhe o S3 fora da VPC", mas a documentação de rede torna a
topologia inequívoca:

> "AWS PrivateLink is a highly available, scalable technology that you can use to
> privately connect your VPC to services and resources **as if they were in your VPC**."
> — <https://docs.aws.amazon.com/vpc/latest/privatelink/what-is-privatelink.html>

O "*as if*" é a chave: eles **não estão** na sua VPC.

> "Gateway VPC endpoints provide reliable connectivity to Amazon S3 and DynamoDB without
> requiring an internet gateway or a NAT device for your VPC."
> "Traffic to Amazon S3 or DynamoDB from an instance in a public subnet is routed to the
> internet gateway for the VPC and then to the service. [...] While traffic to Amazon S3
> or DynamoDB traverses the internet gateway, **it does not leave the AWS network**."
> "When your instances access Amazon S3 or DynamoDB through a gateway endpoint, **they
> access the service using its public endpoint**."
> — <https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html>

O texto alternativo do próprio diagrama oficial da AWS nessa página diz:
**"Traffic leaves your VPC through an internet gateway, but stays in the AWS network."**

### 4.4 A evidência negativa mais eloquente

O pacote `Architecture-Group-Icons_07312026/` tem **18 ícones de grupo**. Não há ícone de
grupo para **S3, DynamoDB, SQS, SNS ou EventBridge**. A AWS entrega esses serviços
**apenas como service icon, nunca como container.** Um diagrama que desenha um box
"Amazon S3" envolvendo outras coisas está inventando um elemento que a AWS deliberadamente
não fornece.

### 4.5 Verificado em três diagramas oficiais independentes

**(1) AWS Security Reference Architecture — conta Application.** A VPC (box roxo) contém
**só** subnets privadas com EC2 e Aurora, o ALB, o agente do Systems Manager, os Flow logs
e três endpoints rotulados "Amazon S3 endpoint", "Amazon KMS endpoint", "Systems Manager
endpoint" — **a linha roxa da VPC passa visualmente por cima dos ícones de endpoint**.
Fora da VPC mas dentro da conta: Amazon S3, AWS KMS, AWS Secrets Manager, AWS Private CA,
AWS CloudHSM, Amazon Cognito, Amazon Verified Permissions.

Confirmado **numericamente** no PPTX editável que a própria AWS publica
(`aws-security-reference-architecture-diagrams_June_2026.pptx`): retângulo da VPC em
X 1.42″–5.98″; retângulo da conta em X 1.18″–10.82″; as formas de S3 / KMS / Secrets
Manager caem **fora do primeiro e dentro do segundo**.
<https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/application.html>

**(2) Generative AI Application Builder on AWS — a mesma arquitetura desenhada duas
vezes.** É a demonstração mais limpa que existe:

- *VPC option **disabled***: um único box `AWS Cloud`, **nenhuma VPC**, todos os serviços
  gerenciados dispostos lado a lado.
- *VPC option **enabled***: aparecem um box `Region` e um box `VPC` contendo **apenas**
  subnets públicas/privadas, ENIs, routers e NAT — enquanto API Gateway, Lambda, DynamoDB,
  S3, Bedrock, Kendra, SageMaker e CloudWatch **permanecem fora da VPC**, alcançados por
  ícones explícitos de "VPC Gateway endpoints" e "VPC Interface endpoints" **na fronteira**.

<https://docs.aws.amazon.com/solutions/latest/generative-ai-application-builder-on-aws/architecture-overview.html>

**(3) PG pattern: Automate AWS infrastructure operations using Amazon Bedrock.** Um grupo
cinza tracejado **literalmente rotulado "AWS services"**, contendo Amazon RDS, Amazon S3 e
Amazon EC2, fica **fora** da VPC; um grupo "VPC endpoints" fica **dentro**; um ícone de
PrivateLink marca a travessia.
<https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/automate-aws-infrastructure-operations-by-using-amazon-bedrock.html>

Idem em *Web Application Architecture on AWS* (Route 53, WAF, CloudFront, ACM, S3 dentro
do `AWS Cloud`, fora do box da VPC) e em *Modernize Applications with Microservices Using
Amazon EKS* (Route 53 fora da VPC, dentro da Region).

### 4.6 Veredito

> **Serviços gerenciados são desenhados DENTRO da fronteira de conta / Region / AWS Cloud
> e FORA da fronteira da VPC.**
>
> **A VPC contém apenas**: subnets, ENIs, gateways, load balancers, EC2 / containers /
> RDS — **e os VPC endpoints, que são desenhados SOBRE a linha da VPC**, fazendo a ponte
> para os serviços gerenciados de fora.

A frase mais próxima de um enunciado da AWS explica o mecanismo mas nunca diz "portanto
desenhe assim":

> "In addition to using the security features of Amazon VPC the AWS SRA also makes use of
> **VPC endpoints to provide private connectivity between the VPC and supported AWS
> services**, and to provide a mechanism to place access policies at the network
> boundary."
> — <https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/application.html>

**Status:** convenção **fortemente atestada na prática** (verificada em 3 diagramas
oficiais independentes, um deles medido no PPTX de origem), mas **não é mandato escrito
citável**. Ver a seção NORMATIVO vs OBSERVADO.

---

## 5. Padrões observados nos diagramas oficiais

Esta seção é **observação**, não regra escrita. Começo pelos dois únicos diagramas de
exemplo do próprio deck (slides 20 e 21, F2), medidos no XML — evidência de primeira
mão, sem intermediário — e depois generalizo para o Architecture Center.

### 5.1 Evidência medida nos exemplos do deck

**Direção do fluxo — esquerda → direita, sem exceção nos dois exemplos.**

Slide 20 ("Git to S3 Webhooks"), coordenada X de cada elemento na ordem do fluxo:

```
Git users (0.58) → Third-party Git repository (2.84) → [ AWS Cloud @ 5.90 ]
   → AWS Lambda (6.69) → fork → S3 SSH key bucket / KMS key / S3 output bucket (9.64)
```

Slide 21 ("Chef Automate"), com os callouts:

```
① Chef workstation (6.12) → ② Chef Automate (8.16) → ③ Chef node (10.01)
callout ① @ 6.29    callout ② @ 8.59    callout ③ @ 10.77
```

Os callouts estão em ordem estritamente crescente de X — exatamente o que o slide 18
manda ("left to right").

**Usuário e internet ficam FORA do box `AWS Cloud`, à ESQUERDA.**
No slide 20 o box `AWS Cloud` começa em X = 5.90. `Git users` (0.58) e
`Third-party Git repository` (2.84) estão fora dele, à esquerda. O deck também fornece
ícones genéricos `Internet`, `Internet alt1`, `Internet alt2`, `Users`, `Client`,
`Mobile client`, `Office building` (slide 28) — todos pensados para o lado de fora.

**Cor: só em duas coisas.**
Extraindo apenas as cores explicitamente aplicadas em `spPr/a:ln` dos três diagramas
(slides 9, 20, 21):

| Slide | Cores de linha usadas |
|---|---|
| 9 | `#00A4A6`, `#8C4FFF`, `#ED7100` (bordas de grupo) + `tx1` (AWS Cloud) + `accent3` **apenas nas linhas-guia da anotação didática**, não no diagrama |
| 20 | **somente `tx1`** — todas as 6 linhas, inclusive todas as setas |
| 21 | `#00A4A6`, `#7AA116`, `#8C4FFF` (bordas de grupo) + `tx1` nas 4 setas/box do AWS Cloud |

Conclusão dura: **nenhuma seta colorida em nenhum diagrama oficial do deck.** Cor
aparece só no (a) quadrado do ícone e (b) borda do grupo. Todo o resto — setas, texto,
box do `AWS Cloud` — é a cor do texto.

**Densidade.** Slide 20: **6 ícones** no total (4 dentro do `AWS Cloud`, 2 fora) e
**1 box**. Slide 21: **4 ícones**, **4 boxes** aninhados e **3 callouts**. Os exemplos
que a AWS escolheu para ensinar são **esparsos** — ordem de meia dúzia de ícones, não
trinta.

### 5.2 Evidência de primeira mão no AWS Solutions Library

Baixei e inspecionei o diagrama oficial de uma solução da AWS Solutions Library:

- Página: <https://docs.aws.amazon.com/solutions/latest/dynamic-image-transformation-for-amazon-cloudfront/lambda-architecture.html>
- Imagem: `.../images/serverless-image-handler-architecture.png` (2218 × 1288 px)

O que o diagrama faz, item a item:

| Aspecto | O que o diagrama oficial faz |
|---|---|
| **Direção do fluxo** | **Esquerda → direita**: `Client` → CloudFront Function → CloudFront → [S3 + API Gateway] → Lambda → S3 |
| **Cliente** | Ícone genérico de monitor, **fora do box de fronteira, na borda esquerda** |
| **Box de fronteira** | **"AWS CloudFormation Stack"** em `#E7157B` sólido, com o quadrado do ícone no canto superior esquerdo e rótulo à direita dele. `#E7157B` é a cor de **Management Tools** — categoria do CloudFormation. É um **grupo customizado feito exatamente pela receita do slide 26** |
| **Grupo interno** | Box **cinza tracejado sem rótulo** em volta de S3 + API Gateway — o preset `Generic group` (`#7D8998`, `dash`) |
| **Callouts** | Círculos **pretos com número branco bold**, 1 a 7 — idêntico à spec do slide 18 |
| **Setas** | **Todas pretas**, retas, ângulos retos, **bidirecionais** (ponta nas duas extremidades) para request/response. Zero seta colorida |
| **Rótulos** | Nome **completo** do serviço, centralizado **abaixo** do ícone: "Amazon CloudFront", "Amazon API Gateway", "AWS Lambda", "Amazon Rekognition", "AWS Secrets Manager", "Amazon S3" |
| **Service vs Resource icon** | `Amazon CloudFront` = **quadrado roxo preenchido** (service icon). `Amazon CloudFront Function` = **glifo roxo em linha, sem quadrado** (resource icon). `Client` = **glifo monocromático** (general resource icon). Exatamente a regra da seção 3.2 |
| **Serviços fora da fronteira** | `Amazon Rekognition` fica **acima e fora** do box do CloudFormation Stack — porque não é criado pela stack |
| **VPC** | **Nenhum box de VPC** — arquitetura 100% serverless |
| **Legenda** | **Nenhuma** |
| **Título** | Caption em **negrito acima** da imagem: "Lambda architecture for cost-optimized image processing" — fora do desenho |
| **Prosa numerada** | Lista numerada **abaixo** da imagem, introduzida por "The high-level process flow for the Lambda architecture is as follows:", com os passos opcionais marcados "(Optional)" |
| **Densidade** | 8 ícones, 2 boxes, 7 callouts |

**As cores dos ícones batem exatamente com a paleta que extraí do slide 26:**
CloudFront e API Gateway `#8C4FFF`, S3 `#7AA116`, Lambda `#ED7100`, Rekognition
`#01A88D`, Secrets Manager `#DD344C`, CloudFormation `#E7157B`.

**Honestidade sobre a numeração:** os callouts 1→4 crescem da esquerda para a direita,
mas o 5 fica abaixo, o 6 acima e o **7 volta para a esquerda** (é a perna de resposta).
Ou seja, o "order your numbers as linearly as possible" do slide 18 é **"o mais linear
possível"**, não "estritamente linear" — quando o fluxo tem ida e volta, a numeração
segue o fluxo, não a geometria.

**Sobre o box de fronteira:** note que a AWS **não** usou `AWS Cloud` aqui. Usou um grupo
customizado `AWS CloudFormation Stack`, porque a fronteira que importa nessa solução é
"o que o template cria". Isso é a aplicação prática do slide 26 — e é um contraste forte
com o hábito amador de sempre desenhar `AWS Cloud` mesmo quando ele não separa nada.

### 5.3 Corpus maior — 24 diagramas oficiais inspecionados pixel a pixel

Amostra: 24 diagramas vistos diretamente (PDFs de Reference Architecture renderizados,
PNGs do Solutions Library e do Prescriptive Guidance), mais análise estrutural de 25
soluções / 31 diagramas e de 152 patterns do Prescriptive Guidance.

#### Direção do fluxo

**17 dos 24 leem primariamente esquerda → direita.** 2 entram por cima ou por baixo e
depois viram para a direita; 3 são layouts puros de contenção, sem fluxo; 2 são mistos.

A forma canônica é uma faixa horizontal de três zonas:
**produtores/fontes na borda esquerda → processamento AWS no meio → consumidores/saídas
na borda direita.**

Exemplos: *Data Mesh with Amazon DataZone* (5 colunas estritas L→R),
*Web Application Architecture on AWS* (Web Client → Route 53 → WAF → CloudFront → ALB →
web tier → app tier → DB tier), *Knowledge Graphs and GraphRAG with Neo4j* (Data sources
→ Parsing → Knowledge graph → GraphRAG → Applications).

**Contraexemplos reais:**

- **Entrada pelo topo** — *PG: chat assistant com Bedrock Agents* põe "End user" no
  **topo, centro, fora do box `AWS Cloud`**, desce por ALB → ECS → Lambda e só então vira
  L→R.
- **Entrada por baixo** — *SD-WAN Connectivity with AWS Cloud WAN Connect attachments*
  (p. 3) põe escritórios remotos e o site corporativo **embaixo**.
- **Sem fluxo nenhum** — a **AWS Security Reference Architecture** é retrato e puramente
  contenção/inventário: Organization → OUs → contas, **zero setas, zero números**.

#### Usuário / internet

**20 de 22 diagramas com ator externo o colocam fora da fronteira AWS; 18 desses 20 na
borda esquerda.** Sempre com **ícone genérico monocromático**, nunca com ícone de serviço
colorido.

**Sub-regra observada, consistente:** *usuário final vai para a esquerda; infraestrutura
on-premises / rede corporativa vai para a direita (ou para baixo)*. Em diagramas de rede
híbrida a VPC fica à esquerda e o data center à direita, porque a narrativa é "da nuvem
para o on-prem". Exemplos: *Hybrid DNS with Route 53 Resolver Endpoints* e
*AWS Site-to-Site VPN to an Amazon VPC* põem o "Corporate data center" à **direita**.

#### Numeração de passos

| Corpus | Com passos numerados |
|---|---|
| Solutions Library | **24 de 25 (96 %)** |
| Reference Architecture PDFs | **12 de 12 (100 %)** |
| Prescriptive Guidance patterns (com seção `## Architecture`) | **72 de 125 (58 %)** |

Patterns de topologia pura (layout de rede, wiring de migração) frequentemente trazem
diagrama + bullets de componentes e **nenhum walkthrough numerado**.

**Quatro estilos visuais observados, não um:**

| Estilo | Onde |
|---|---|
| **Círculo preto preenchido, numeral branco** — o callout oficial do deck | Hybrid DNS (2025), Data Mesh DataZone, Knowledge Graphs Neo4j, Connected Vehicle, GenAI App Builder, Video on Demand, QnABot, Automated Security Response, Centralized Logging |
| **Quadrado azul arredondado, numeral branco** — legado, ainda em uso | Web App on AWS (2021), Modern Data Analytics (2022), Manufacturing (2020), VPC Lattice, EKS/VMware, Traffic Encryption (2025) |
| Círculo de contorno fino, numeral preto | PG: Automate AWS infra ops with Bedrock |
| Texto `(1)`, `(6a)` entre parênteses | DeepRacer — export de draw.io, não do deck AWS |

> **Trate o círculo preto como a norma atual, mas não afirme que é universal.**

**Letras aparecem apesar do `DON'T` do slide 18.** É um padrão recorrente e deliberado
nas Reference Architectures de rede: **números para passos de configuração, letras para
um fluxo de tráfego** — duas trilhas de anotação no mesmo desenho.
*AWS Site-to-Site VPN to an Amazon VPC* tem dois títulos no painel direito,
"Configuration steps" (1–5, quadrados azuis) e "Sample traffic flow" (A–E, quadrados
laranja). *Security Automations for AWS WAF* rotula a pilha de regras de A a I.
**Sub-numeração** para ramos paralelos também é comum: `12a`/`12b`, `7a`/`7b`, `6a`/`6b`/`6c`.

**Contagem de passos** — Solutions Library: mín. 4, **mediana 9**, máx. 38. PG patterns:
mín. 1, **mediana 5**, máx. 18. RA PDFs: 5–13. **A faixa-alvo é 5 a 11 passos**; acima de
~14 é atípico.

**Frase que introduz a lista** (medido em 125 patterns do PG): *"The diagram shows the
following workflow:"* é a mais comum — **31 de 94 intros (33 %)**. *"The following diagram
shows …"* introduz a **imagem** em 42 % dos docs. **O diagrama vem antes da lista em 93 %
dos casos** (67 de 72).

#### Densidade

**Típico: 15–30 ícones, mediana ≈ 20.** Faixa observada: **12 a ~50**.

Amostra: PG Bedrock chat assistant 12 · Site-to-Site VPN 12 · VPC Lattice 14 · Video on
Demand 15 · Knowledge Graphs 16 · Hybrid DNS 18 · GenAI text (sem VPC) 20 · SRA
Application account 22 · EKS 22 · Web Application 24 · Centralized Logging 24 · Data Mesh
28 · QnABot 28 · GenAI text (com VPC) 30 · Automated Security Response ~40 · Connected
Vehicle ~45 · Manufacturing ~50.

**Observação valiosa:** *Manufacturing on AWS* tem ~50 ícones mas **apenas 5 passos
numerados**. Quando a contagem de ícones sobe, a AWS torna a numeração **mais grossa e
temática**, não mais fina. Ela para de narrar cada hop.

**Quando fica complexo, a AWS divide — três mecanismos:**

1. **PDF multipágina com página de índice.** *Reference Architectures for Implementing
   SD-WAN Solutions on AWS* tem 8 páginas: a primeira é título + lista numerada das 7
   sub-arquiteturas, cada uma com sua página inteira.
2. **Página de docs com vários diagramas.** *Amazon VPC Lattice Reference Architectures*:
   6 diagramas, 31 itens numerados. *AWS Connected Vehicle*: 5 diagramas, 43 itens.
3. **Variantes em abas.** *Generative AI Application Builder on AWS* tem 5 abas na landing
   e 9 diagramas no implementation guide — a mesma arquitetura desenhada **duas vezes**,
   "with VPC option disabled" e "enabled".

**Formato:** os 12 Reference Architecture PDFs medidos são **exatamente 960 × 540 pt =
16:9** — a tela widescreen do PowerPoint. Coerente com o deck (que também é 16:9) e com a
alternativa retrato de 6.5″ × 8.75″ do slide 12.

#### Cor

**21 de 24 diagramas têm todos os conectores em preto fino com ponta aberta simples.**
Tracejado carrega significado (assíncrono, opcional, stream de resposta) — **cor, não**.

**Os 3 contraexemplos são todos de rede, e todos têm legenda:**

- *AWS Site-to-Site VPN to an Amazon VPC*: **azul traço-ponto = Direct Connect public
  VIF**, **vermelho traço-ponto = Site-to-Site VPN**, com chave de 2 linhas.
- *SD-WAN with AWS Cloud WAN Connect*: **laranja grosso = overlay SD-WAN**, **azul claro
  = túnel GRE**, **verde tracejado = BGP peering**, chave de 3 linhas.
- *Security Automations for AWS WAF*: rótulos de seta em **azul itálico** e um **✗
  vermelho** no caminho do atacante.

Isso dá a regra operacional mais útil de todo este documento:

> **Sem legenda enquanto você usar ícones AWS padrão e setas pretas.
> No momento em que você codificar significado na cor de um conector, você deve uma
> legenda.**

**Outros usos de cor observados:**

- **Rótulo tingido na cor do seu box**: rótulos de VPC/subnet em verde, de AZ em azul, de
  Direct Connect em roxo.
- **Fundo tingido para agrupar**: preenchimento azul-claro em subnets (*Web App*, *EKS*),
  cinza-claro em "Web application resources" (*WAF*), amarelo em "Training jobs" e azul em
  "LIVE races" (*DeepRacer*).
- **Wordmark laranja "AWS Reference Architecture"** no rodapé dos 12 RA PDFs.

> ⚠️ **Correção a uma afirmação minha anterior:** o *preset* do deck é `noFill`
> (transparente). Mas **diagramas oficiais reais às vezes tingem o fundo do grupo**. Ou
> seja: "sem preenchimento" é o padrão de fábrica, não uma proibição.

#### Rótulos e títulos

**Todo ícone tem rótulo. Abaixo, centralizado. Zero ícones sem rótulo nos 24 diagramas.**

**Convenção do qualificador em itálico** — um hábito muito consistente e distintamente
AWS: **nome do serviço em peso normal, papel dele em itálico na linha de baixo.**

```
Amazon Route 53          Amazon DynamoDB          AWS Lambda
DNS service              vehicle lookup           LangChain Orchestrator
```

Exemplos: *Web App* ("Amazon S3 / *static storage and backup*", "Amazon RDS / *primary
database*"), *Connected Vehicle*, *GenAI App Builder* ("Amazon DynamoDB / *Session
Store*"), *QnABot* ("Amazon Cognito / *Users and Identity*"). A variante do Prescriptive
Guidance usa **nome em negrito + descritor em cinza**.

Isso resolve um problema real: o nome do serviço diz **o que é**, o itálico diz **o que
faz aqui**. Sem ele, um diagrama com três buckets S3 é ilegível.

**Títulos:**

- **Reference Architecture PDFs: sempre.** Título em negrito grande no topo à esquerda +
  subtítulo descritivo de 1–3 linhas + rodapé padrão. **12/12** trazem o wordmark laranja
  "AWS Reference Architecture"; **10/12** trazem "Reviewed for technical accuracy
  \<data\>"; todos trazem o logo AWS embaixo à esquerda e a linha de copyright.
- **PNGs em páginas de docs: sem título na imagem.** O título é um H2 na página mais uma
  **linha de caption em negrito imediatamente acima da imagem** — idioma consistente do
  Solutions Library: `**Video on Demand on AWS architecture**`.

**Alt text é escrito como frase descritiva, não como rótulo.** Mediana de 12 palavras em
162 imagens do PG; 67 % terminam com ponto. Ex.: *"From each VPC one flow log sends logs
to CloudWatch and another sends logs to the S3 bucket."*

**Legendas: 3 de 24.** E os três são exatamente os casos em que o diagrama **inventou
notação além do conjunto de ícones** (estilos de linha coloridos, ou um glossário de
siglas). A AWS SRA tem **zero** legendas.

#### Diagramas oficiais são entregues editáveis

Todo diagrama em `docs.aws.amazon.com/architecture-diagrams/` traz um ZIP:
*"To customize this reference architecture diagram based on your business needs, download
the ZIP file which contains an editable PowerPoint."* Dentro, o slide 2 é uma página
"Resources" que diz: *"For all service icons, refer to AWS Architecture Icons."*
A AWS SRA também publica seu PPTX editável
(`aws-security-reference-architecture-diagrams_June_2026.pptx`).


## 6. Rótulo, legenda e título

### 6.1 Rótulo de ícone

Medido no XML dos exemplos oficiais (slides 9, 20, 21 — F2):

- **12 pt Arial**, cor `tx1`
- **Centralizado** (`algn="ctr"`) e posicionado **imediatamente abaixo** do ícone — o
  topo da caixa de texto coincide com a base do ícone (ícone em `y`, altura 0.5";
  rótulo começa em `y + 0.498`)
- Altura da caixa: 0.303" para uma linha, 0.505" para duas
- Máximo **duas linhas**, nunca quebrando no meio da palavra (slide 17)
- `Amazon` / `AWS` sempre acompanham o nome do serviço, na **mesma linha** da primeira
  palavra do nome ("AWS Elastic Beanstalk" quebra depois de "AWS Elastic", não depois
  de "AWS")

O deck é explícito sobre por que ícone e rótulo são objetos separados:

> "The icon and label are **separated** to allow for adjustment or abbreviation. General
> icons are flexible and their labels can be **customized** for your use-case. For
> example, the general 'User' icon for Storage can also be used as 'Profile' for Games."

### 6.2 Rótulo de grupo

- **12 pt Arial**, no **topo** do box (recuo superior 0.1")
- Alinhado à **esquerda** quando o grupo tem ícone (recuo esquerdo 0.55", para não
  colidir com o ícone de 0.417")
- **Centralizado** nos três grupos sem ícone que atravessam outros: `Availability Zone`,
  `Auto Scaling group`, `Generic group`
- O rótulo é texto **dentro do próprio retângulo**, não uma caixa flutuante

### 6.3 Callouts numerados — o padrão completo

Extraído dos slides 18 (spec) e 21 (uso real):

| | Large callout | Small callout |
|---|---|---|
| Forma | elipse | elipse |
| Diâmetro | **0.36"** | **0.30"** |
| Preenchimento | `tx1` (preto no deck claro) | idem |
| Borda | **nenhuma** (`<a:noFill/>` na `ln`) | idem |
| Texto | **14 pt Arial bold**, `bg1` (branco) | **11 pt Arial bold**, branco |
| Quando usar | "For a **simple** diagram" | "For a **complicated** diagram" |

**E o padrão de acompanhamento** — no slide 21, os callouts ①②③ dentro do diagrama são
espelhados por uma **lista numerada automática** (`buAutoNum`, 14 pt) posicionada **à
esquerda do diagrama**, com uma frase por passo:

> 1. Chef Knife uploads cookbooks.
> 2. Knife bootstraps and communicates with nodes.
> 3. Chef client processes run list.

Isso é o "diagrama + narrativa numerada" que aparece em toda solução do AWS Solutions
Library — e ele está aqui, no deck oficial, como exemplo.

### 6.4 Legenda

**O deck oficial não tem nenhum conceito de legenda.** Nenhum dos 156 slides usa a
palavra `legend` ou `key`, nenhum exemplo tem um bloco de legenda, e não existe elemento
de legenda na seção *Elements*.

Isso é coerente com o desenho do sistema: **a cor do grupo já é a legenda**. Como
`#8C4FFF` sempre significa VPC e `#7AA116` sempre significa subnet pública, uma legenda
seria redundância. O leitor treinado decodifica por cor.

A única menção a legenda em toda a AWS está numa página explicativa de marketing, e é
puramente **descritiva** ("may", "can"), não normativa:

> "Additionally, the diagram **may** also use icons to visually represent different
> components. **A small legend at the bottom, similar to the legend on a map, explains
> icon usage.** The way in which the components and connections are arranged is called a
> layout."
> — <https://aws.amazon.com/what-is/architecture-diagramming/>

Essa página descreve diagramas de arquitetura **em geral**, não a convenção AWS. E os
diagramas oficiais da AWS não seguem esse conselho.

### 6.5 Título

O deck **não define** um elemento de título de diagrama. Varredura dos 156 slides por
`title` e `caption`: zero ocorrência normativa. Nos exemplos, o título vive no título do
*slide* ("Example: Chef Automate Architecture on AWS"), fora do desenho. Não há caixa de
título, régua de posicionamento ou tipografia prescrita para título dentro do diagrama.

### 6.6 O que a AWS diz sobre o *conteúdo* de um diagrama de referência

O único lugar onde a AWS explica as próprias escolhas de diagramação é a AWS Security
Reference Architecture — e é descritivo, não prescritivo:

> "This architectural diagram brings together all the AWS security-related services. It
> is built around a simple, three-tier web architecture **that can fit on a single
> page**. [...] The architecture is **purposefully modular** and provides **high-level
> abstraction**."
>
> "For this reference architecture, the actual web application and data tier are
> **deliberately represented as simply as possible** [...] Most architecture diagrams
> focus and dive deep on the web, application, and data tiers. **For readability, they
> often omit** the security controls. This diagram flips that emphasis."
> — <https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/architecture.html>

Três princípios extraíveis: **cabe em uma página**, **abstração deliberada do que não é o
assunto**, e **um diagrama tem um foco** (aqui, segurança) ao qual o resto se subordina.

---

## 7. O delta amador → profissional

Cada item abaixo é uma diferença **concreta e verificável** entre o que os arquivos
oficiais da AWS fazem e o que um diagrama ruim faz. A coluna "origem" diz se a regra
está escrita (`slide N`) ou se foi medida nos arquivos (`medido`).

| # | Diagrama amador | Diagrama oficial AWS | Origem |
|---|---|---|---|
| 1 | Preenche os boxes de grupo com um pastel de fundo | Boxes de grupo são **transparentes** (`<a:noFill/>`); só a borda tem cor | medido |
| 2 | Cantos arredondados nos boxes | **100% `prstGeom prst="rect"`** — cantos vivos, sem exceção nos 156 slides | medido |
| 3 | Escolhe cores "bonitas" para os boxes | Cada grupo tem **um hex fixo** que é a cor da categoria do serviço; a borda tem a mesma cor do quadrado do ícone | slide 26 + medido |
| 4 | Bordas todas iguais (ou todas tracejadas) | O **tipo de traço carrega significado**: `Region` = `sysDash`, `AZ` e `Auto Scaling` = `dash`, VPC/subnet/SG = sólida | medido |
| 5 | Espessura de linha aleatória | **1.25 pt em todo lugar** — boxes e setas | medido |
| 6 | Redimensiona ícones para "caber" | "For diagrams, use icons at their **predefined size and do not resize**" | slide 15 |
| 7 | Estica, gira ou recolore ícone | `DON'T: Crop service icons / Flip or rotate icons / Change icon shapes` | slide 15 |
| 8 | Mistura tamanhos de ícone | **48 px** para serviço/recurso, **40 px** para ícone de grupo — invariante | medido |
| 9 | Setas curvas, tracejadas, coloridas, com estilos variados | **Uma** seta: 1.25 pt, cor do texto, ponta "Open Arrow" Size 4, sempre sólida. Zero seta colorida nos exemplos | slide 16 + medido |
| 10 | Linhas diagonais por toda parte | "Use **straight lines and right angles** wherever possible"; diagonal só quando ângulo reto é impossível | slide 16 |
| 11 | Fontes e tamanhos variados | **12 pt Arial** para todo rótulo do diagrama, sem exceção | slide 17 + medido |
| 12 | Rótulo ao lado do ícone, alinhamento inconsistente | Rótulo **centralizado, imediatamente abaixo** do ícone, colado na base dele | medido |
| 13 | Nome quebrado no meio da palavra, ou em 3+ linhas | Máx. **2 linhas**, nunca quebra no meio da palavra, `AWS`/`Amazon` na mesma linha da 1ª palavra | slide 17 |
| 14 | "S3", "EB", "ELB" soltos | Forma curta só depois de citar o nome completo; nunca a mesma sigla para dois serviços | slide 17 |
| 15 | Numera com letras, símbolos ou tamanhos misturados | Callouts: elipse preta, texto branco **bold**, um único tamanho por diagrama, só números | slide 18 |
| 16 | Números espalhados sem ordem | "Order your numbers as **linearly as possible** — left to right, top to bottom, or clockwise" | slide 18 |
| 17 | Diagrama sozinho, sem explicação | Callouts ①②③ **espelhados por uma lista numerada** ao lado do diagrama, uma frase por passo | slide 21 (medido) |
| 18 | Aninha AZ estritamente dentro da VPC | AZ e VPC **se cruzam**; a subnet é a interseção — porque a VPC abrange várias AZs | medido (slides 9 e 21) |
| 19 | Empilha grupos colados | "Inner groups should have at least **.05" buffer on all sides**" | slide 14 |
| 20 | Inventa um box de grupo novo com um ícone qualquer | `DON'T: Create groups with nonapproved AWS icon(s)` — use um `Generic group` ou customize a partir da cor da categoria | slides 14, 26 |
| 21 | Põe uma legenda de cores | **Nenhum diagrama oficial tem legenda.** A cor do grupo *é* a legenda | medido (0 ocorrências) |
| 22 | Mistura ícones antigos (com gradiente) e novos | Ícones da release atual são **fill sólido**; a própria AWS avisa que bibliotecas de terceiros podem ter *legacy icon sets* | F1 + medido |
| 23 | Desenha uma VPC vazia só para "ter" uma VPC | Se não há rede de cliente, **não há box de VPC** — S3/KMS/Lambda ficam direto no `AWS Cloud` | slide 20 (medido) |
| 24 | Usa o mesmo ícone para o serviço e para a coisa que ele cria | **Quadrado preenchido = serviço**; **glifo em linha na cor da categoria = recurso daquele serviço**; **glifo monocromático = recurso genérico** | slides 8, 9 + SVGs |
| 26 | Desenha um box `AWS Cloud` que não separa nada | A fronteira desenhada é a que **importa** para aquele diagrama — a AWS usou `AWS CloudFormation Stack` quando o recorte era "o que a stack cria" | F10 |
| 27 | Um único diagrama tentando dizer tudo | "Built around a simple, three-tier web architecture **that can fit on a single page**"; tiers fora do foco "**deliberately represented as simply as possible**" | AWS SRA |
| 28 | Rotula só o nome do serviço — três buckets S3 idênticos e ilegíveis | **Qualificador em itálico embaixo do nome**: "Amazon S3 / *static storage and backup*". O nome diz o que é, o itálico diz o que faz **ali** | corpus |
| 29 | Põe legenda "por segurança", ou codifica cor sem legenda | **Sem legenda** enquanto usar ícone padrão + seta preta; **com legenda** no instante em que a cor da linha passar a significar algo | corpus (3 de 24) |
| 30 | Entrega um PNG e nada mais | Diagrama oficial vem com **PPTX editável**, título, subtítulo, data de revisão técnica e lista numerada de passos | corpus |
| 31 | Adiciona mais um passo numerado a cada hop num diagrama denso | Quando a contagem de ícones sobe, a numeração fica **mais grossa e temática** (~50 ícones e só 5 passos em *Manufacturing on AWS*) | corpus |
| 25 | Usa o mesmo diagrama em fundo claro e escuro | Existem **dois decks**; no escuro a borda do `AWS Cloud` vira branca e os callouts invertem (branco com texto preto) | F2/F3 |

---

## 8. NORMATIVO vs OBSERVADO

Esta é a seção que importa. Muita coisa que circula como "regra da AWS" é padrão
observado, e muita coisa que é regra de verdade quase ninguém conhece — porque está
enterrada num PPTX que não é indexado nem linkado como documento.

Uso **três camadas**, porque duas não bastam:

- **(a1) NORMATIVO EXPLÍCITO** — a AWS escreveu a regra em prosa imperativa.
- **(a2) NORMATIVO POR ARTEFATO** — não há frase, mas o valor está travado no preset que
  a prosa manda usar sem alterar ("use at their predefined size, color and format").
  Vinculante na prática, e verificável byte a byte.
- **(b) OBSERVADO** — se repete nos diagramas oficiais, mas **não há regra escrita**.

### (a1) Convenções NORMATIVAS — a AWS declara explicitamente

| # | Regra | Onde |
|---|---|---|
| N1 | Em diagramas, usar ícones no **tamanho, cor e formato predefinidos**; **não** redimensionar | deck slide 15 |
| N2 | **Não** cortar, girar, espelhar ou mudar a forma de um ícone | deck slide 15 |
| N3 | Em *apresentações* (não em diagramas) pode escalar, **segurando Shift** (proporção travada) | deck slide 15 |
| N4 | **Não** criar grupo com ícone não aprovado; **não** redimensionar ícone de grupo | deck slide 14 |
| N5 | Se o preset não serve: usar **Generic group** ou criar grupo custom a partir da **cor da categoria** | deck slides 14, 26 |
| N6 | Grupo custom: inserir o **SVG** de `Arch_32` — "Do not choose a PNG file, image quality will be degraded" | deck slide 26 |
| N7 | Grupos aninhados: **≥ 0.05" de folga em todos os lados** | deck slide 14 |
| N8 | **VPC e subnets aninham**; alguns grupos (ex. Auto Scaling) **atravessam** múltiplos grupos | deck slide 14 |
| N9 | Setas: **só** as preset ou default ("Open Arrow", Size 4) | deck slide 16 |
| N10 | **Linhas retas e ângulos retos** sempre que possível; diagonal só quando ângulo reto for impossível | deck slide 16 |
| N11 | Todo rótulo do diagrama: **12 pt Arial** | deck slide 17 |
| N12 | Nome de serviço em **no máximo 2 linhas**; **nunca** quebrar no meio da palavra | deck slide 17 |
| N13 | `AWS`/`Amazon` sempre acompanham o nome, na **mesma linha da primeira palavra** do nome | deck slide 17 |
| N14 | Forma curta só depois de citar o nome completo no documento; **não** duplicar sigla entre serviços | deck slide 17 |
| N15 | Callouts: **preto com texto branco bold** (invertido no deck escuro) | deck slide 18 |
| N16 | **Não** misturar tamanhos de callout no mesmo diagrama | deck slide 18 |
| N17 | Callouts: **só números** — nada de letras ou símbolos | deck slide 18 |
| N18 | **Não** esticar, redimensionar manualmente ou criar novas formas de callout | deck slide 18 |
| N19 | Numerar **o mais linearmente possível**: esquerda→direita, topo→baixo, ou horário | deck slide 18 |
| N20 | Ordem de construção: deck (claro/escuro) → **estrutura de grupos** → ícones → setas → numeração | deck slide 11 |
| N21 | `AWS Cloud`: usar a variante **com o logo AWS**, exceto em Regions onde ele não pode ser usado (ex. China) | deck slide 25 |
| N22 | Training & Certification: fundo branco, **16 pt**, texto preto, linhas **2 pt**, cores **não podem ser alteradas** | deck slide 13 |
| N23 | Formato retrato (Word/blog): slide **6.5" × 8.75"**, fundo branco, colar como imagem | deck slide 12 |
| N24 | Usar ícones **atualizados** — bibliotecas de terceiros podem conter *legacy icon sets* | página oficial de ícones |

> **Nota de escopo:** N22 vale **só** para material de Training & Certification. Ele
> contradiz N11 (16 pt vs 12 pt) e a espessura medida (2 pt vs 1.25 pt). Não misture.

### (a2) Convenções NORMATIVAS POR ARTEFATO — travadas no preset

Não há frase escrita, mas N1/N4/N18 mandam usar os presets sem alterar. Estes são os
valores literais dos arquivos da AWS:

| # | Valor | Verificação |
|---|---|---|
| A1 | Borda de grupo: **1.25 pt** (`w="15875"` EMU), sem exceção | XML dos slides 9, 20, 21, 25 |
| A2 | Box de grupo: **sem preenchimento** (`<a:noFill/>`) — transparente *(padrão de fábrica; ver ressalva abaixo)* | idem |
| A3 | Box de grupo: **canto vivo** (`prstGeom prst="rect"`) — zero `roundRect` em 156 slides | idem |
| A4 | Hex exato de cada grupo | tabela da seção 2.1 |
| A5 | Tipo de traço por grupo (`sysDash` / `dash` / sólido) carrega significado | seção 2.1 |
| A6 | Ícone de grupo: **40 px**, ancorado no **canto superior esquerdo** do box | XML |
| A7 | Rótulo de grupo: 12 pt Arial no **topo**, recuo esquerdo 0.55" quando há ícone | XML |
| A8 | Rótulo de grupo **centralizado** em `Availability Zone`, `Auto Scaling group`, `Generic group` | XML |
| A9 | Ícone de serviço/recurso no diagrama: **48 px** | XML slides 9, 20, 21 |
| A10 | Rótulo de ícone: 12 pt Arial, **centralizado, colado na base** do ícone | XML |
| A11 | Seta: 1.25 pt, cor `tx1`, ponta `arrow` (`w=med`, `len=sm`), **sempre sólida** | XML slide 27 |
| A12 | Callout grande: elipse **0.36"**, texto **14 pt bold**; pequeno: **0.30"**, **11 pt bold**; sem borda | XML slide 18 |
| A13 | Service icon: `Arch_` em 16/32/48/64. Resource icon: `Res_` **só em 48**, com variantes Light/Dark | pacote de assets |
| A14 | Ícones da release atual usam **fill sólido**, sem gradiente | SVGs do pacote |
| A15 | **Não existe ícone de grupo** para S3, DynamoDB, SQS, SNS, EventBridge | pacote de assets |

> **Ressalva honesta sobre A2.** O preset é `noFill`, mas **diagramas oficiais reais às
> vezes tingem o fundo do grupo** (subnets em azul-claro no *Web Application Architecture*
> e no *EKS*, cinza-claro no *Security Automations for WAF*, amarelo/azul no *DeepRacer*).
> Portanto "sem preenchimento" é o **padrão de fábrica**, não uma proibição. O que **não**
> se observa é preenchimento colorido arbitrário sem função de agrupamento.

> **Ressalva honesta sobre A12.** O círculo preto é o callout **atual** do deck, mas o
> corpus mostra também um **quadrado azul arredondado** legado ainda em uso ativo (inclusive
> em material de 2025), além de círculo de contorno e texto entre parênteses. Trate o
> círculo preto como norma, não como universal. E: **letras aparecem** em Reference
> Architectures de rede — números para configuração, letras para fluxo de tráfego — apesar
> do `DON'T` explícito do slide 18.

### (b) Tendências OBSERVADAS — sem regra escrita

| # | Padrão | Evidência | Força |
|---|---|---|---|
| O1 | **Fluxo esquerda → direita** — faixa de 3 zonas: fontes à esquerda, processamento no meio, consumidores à direita | **17 de 24** diagramas oficiais inspecionados; slides 20 e 21; F10 | forte |
| O2 | **Ator externo fora da fronteira AWS, com ícone genérico monocromático** | **20 de 22** diagramas com ator externo; slide 20; F10 | forte |
| O3 | **Serviços gerenciados dentro da conta/Region/`AWS Cloud`, fora do box `VPC`; VPC endpoints desenhados SOBRE a linha da VPC** | SRA (medido no PPTX de origem), GenAI App Builder (mesma arquitetura com/sem VPC), PG Bedrock; slide 20; ausência de group icon (A15) | **muito forte**, mas não escrita |
| O4 | **`Availability Zone` desenhada CRUZANDO a VPC**, não aninhada dentro dela | slides 9 e 21 (coordenadas medidas) | forte |
| O5 | **Subnet = interseção** de VPC e AZ | slide 21 (medido) | forte |
| O6 | **Conector preto fino** — o tracejado carrega significado, a cor **não** | **21 de 24**; slides 9, 20, 21; F10. As 3 exceções são todas de rede — e todas **trazem legenda** | forte |
| O7 | **Sem legenda quando se usa ícone padrão + seta preta** | **21 de 24** sem legenda; 0 ocorrências de `legend` em 156 slides do deck; SRA com zero legendas | forte |
| O8 | **Título fica fora do desenho** — caption em negrito acima da imagem | slides 20, 21; F10 ("Lambda architecture for cost-optimized image processing") | forte |
| O9 | **Callouts espelhados por lista numerada em prosa**, ao lado ou abaixo do diagrama | slide 21 (`buAutoNum`, 14 pt); F10 (7 passos, opcionais marcados "(Optional)") | forte |
| O10 | **Densidade 15–30 ícones, mediana ≈ 20** (faixa 12–50). Acima disso, a numeração fica **mais grossa**, não mais fina | contagem visual em 24 diagramas; slides 20/21; F10 | forte |
| O11 | **Service icon = o serviço; Resource icon = a instância concreta** | slide 9 (anotação); nomenclatura `Res_<Serviço>_<Recurso>` | média — a *definição* é normativa (N/slide 8), a *regra de escolha* é inferida |
| O12 | **`Region` raramente é desenhada** — ausente de todos os exemplos do deck | grep em 156 slides | média |
| O13 | **Sem box de VPC quando não há rede de cliente** | slide 20 (nenhuma VPC desenhada) | média |
| O14 | **Cor só em duas coisas**: quadrado/glifo do ícone e borda do grupo | slides 9, 20, 21 (medido) + F10 | forte |
| O15 | **Diagrama de referência cabe em uma página** e abstrai o que não é o assunto | AWS SRA (declarado pela AWS, mas sobre aquele diagrama, não como regra geral) | média |
| O16 | **A fronteira do diagrama nem sempre é `AWS Cloud`** — pode ser um grupo customizado que reflete a fronteira que de fato importa (ex. `AWS CloudFormation Stack`) | F10 | média |
| O17 | **Setas bidirecionais** (ponta nas duas extremidades) para pares request/response | F10 | média |
| O18 | **Numeração segue o fluxo, não a geometria** — quando há ida e volta, o último passo pode voltar para a esquerda | F10 (callout 7 na perna de resposta) | média |
| O19 | **Sub-regra de lateralidade**: usuário final à **esquerda**; on-premises / rede corporativa à **direita** ou embaixo | Hybrid DNS, Site-to-Site VPN, SD-WAN | forte |
| O20 | **A legenda é a dívida de quem inventa notação**: os 3 diagramas com legenda são exatamente os 3 que codificaram significado na cor da linha | corpus de 24 | forte |
| O21 | **Qualificador em itálico sob o nome do serviço** — "Amazon Route 53 / *DNS service*" — diz o que o serviço **faz ali** | Web App, Connected Vehicle, GenAI App Builder, QnABot | forte |
| O22 | **5 a 11 passos numerados** é a faixa-alvo (mediana 9 no Solutions Library, 5 no PG) | 25 soluções + 125 patterns | forte |
| O23 | **O diagrama vem antes da lista numerada** | **93 %** (67 de 72 patterns do PG) | forte |
| O24 | **Reference Architecture PDFs são 16:9 (960 × 540 pt)**, com título, subtítulo, wordmark laranja e "Reviewed for technical accuracy \<data\>" | 12 de 12 PDFs medidos | forte |
| O25 | **Quando fica complexo, divide**: PDF multipágina com índice, página com vários diagramas, ou variantes em abas | SD-WAN (8 p.), VPC Lattice (6 diagramas), GenAI App Builder (5 abas) | forte |
| O26 | **Diagramas oficiais são publicados EDITÁVEIS** (ZIP com PowerPoint), e o PPTX aponta de volta para o AWS Architecture Icons | todo diagrama em `docs.aws.amazon.com/architecture-diagrams/`; SRA | forte |
| O27 | **A ordem de aninhamento NÃO é fixa**: vi `Region › Account › VPC › AZ › Subnet` e `AWS Cloud › Region › VPC › Subnet`; a SRA nem tem box `AWS Cloud` — o dela é `Organization` | VPC Lattice, GenAI, PG Bedrock, SRA | forte |

### A regra de ouro para diferenciar

> Se está escrito em prosa imperativa num slide da seção *Guidelines* do deck → **(a1)**.
> Se está travado num preset que a prosa manda usar sem alterar → **(a2)**.
> Se só se repete nos diagramas → **(b)**. Nesse caso é convenção de comunidade
> reforçada pela AWS na prática, e você pode desviar com justificativa.

**O erro mais comum na indústria** é tratar O4 ao contrário — desenhar a AZ estritamente
dentro da VPC. Isso não é só estética: é um erro de modelagem, porque uma VPC abrange
várias AZs. E a AWS desenha corretamente nos dois exemplos do próprio deck.

### E uma advertência que muda como usar tudo isto

**A própria AWS viola as próprias regras (a1) nos próprios diagramas oficiais.** Isso não
é acusação, é dado:

| Regra (a1) | Violação observada em diagrama oficial AWS |
|---|---|
| N17 — callouts **só com números**, nada de letras | *Site-to-Site VPN to an Amazon VPC*, *SD-WAN Cloud WAN*, *Security Automations for WAF* usam **letras** numa segunda trilha de anotação |
| N16 — não misturar tamanhos/estilos de callout | O corpus tem **quatro** estilos de callout convivendo, inclusive em material recente |
| N15 — callout preto com texto branco | Quadrado **azul** arredondado em Web App, Modern Data Analytics, VPC Lattice, Traffic Encryption (2025) |
| A2 — box de grupo sem preenchimento | Subnets com **fundo azul-claro** em *Web App* e *EKS* |
| N14 — sem forma curta solta | *Automated Security Response* rotula "SQS Queue", "DynamoDB Tables", "Backend Lambda" |

**Como ler isso.** As regras (a1) são o padrão de fábrica e o default correto. Os desvios
observados **não são descuido aleatório — são adaptações com função**: a segunda trilha em
letras existe porque o diagrama precisa contar duas histórias (configuração e tráfego) no
mesmo desenho; o fundo tingido existe porque a subnet precisa ler como zona, não como
moldura.

A conclusão prática: **conheça a regra, siga-a por padrão, e desvie só quando puder
nomear a função que o desvio compra.** Um diagrama amador desvia porque não sabe a regra.
Um diagrama profissional desvia porque a regra não resolve aquele problema — e paga a
dívida do desvio (por exemplo: codificou cor na linha → entregou legenda).

---

## 9. Incertezas

Coisas que eu **não** consegui resolver contra fonte primária, listadas sem eufemismo.

1. **`dash` vs `sysDash` — padrão renderizado.** Os tokens OOXML são fato (extraídos do
   XML). O padrão numérico correspondente (`dash` ≈ 4,3 e `sysDash` ≈ 3,1 em múltiplos da
   espessura) vem da especificação ECMA-376, **não da AWS**, e implementações diferentes
   (LibreOffice, Google Slides, draw.io) renderizam com pequenas variações. Se você for
   reimplementar em SVG/CSS, valide visualmente contra o PPTX.

2. **`#242F3E` vs `#232F3E` no ícone `AWS Cloud`.** A variante clara usa `#242F3E`; a
   variante `_Dark` usa `#232F3E` (o "squid ink" da marca AWS). É uma inconsistência nos
   próprios arquivos da AWS. Não sei qual é o valor canônico.

3. **`Public subnet`: sólida ou tracejada?** O preset do slide 25 é **sólida**
   (`prstDash val="solid"`), mas o exemplo do slide 21 desenha a mesma subnet com
   `dash`. A AWS é internamente inconsistente. Aposto no preset (é o artefato que a
   guideline manda usar), mas não posso provar.

4. **A hierarquia canônica da pergunta não existe como regra.** O grupo `Region` tem
   ícone e cor, mas **não aparece em nenhum exemplo do deck**. No corpus maior a ordem de
   aninhamento é **inconsistente**: vi `Region › Account › VPC › AZ › Subnet` (VPC Lattice)
   e `AWS Cloud › Region › VPC › Subnet` (GenAI App Builder, PG Bedrock) — e a AWS SRA nem
   tem box `AWS Cloud`: o box mais externo dela é `Organization`. **O slide 25 lista os 18
   presets em ordem de seletor, não em ordem de aninhamento.** Ou seja: a cadeia
   `AWS Cloud › Region › VPC › AZ › Subnet` da pergunta original é uma **racionalização
   posterior**, não uma prescrição da AWS. O que é regra é apenas o que o slide 14 diz:
   VPC e subnets aninham; alguns grupos atravessam.

5. **Tamanho do service icon vs resource icon.** No slide 9 o service icon
   (`Amazon EC2 Auto Scaling`) tem 80 px enquanto os resource icons têm 48 px. No slide
   21 tudo tem 48 px. Não sei se "service icon maior que resource icon" é regra ou se o
   slide 9 ampliou por causa da anotação didática.

6. **"Consult with your team to see if you can use numbered callouts"** (slide 18)
   sugere um processo de aprovação interno da AWS que **não é público**. Não sei a que
   ele se refere nem se se aplica a autores externos.

7. **Força jurídica das regras do deck.** A concessão de permissão é uma frase
   ("We allow customers and partners to use these toolkits and assets to create
   architecture diagrams"). Não há arquivo de licença no pacote, e as Trademark
   Guidelines não mencionam architecture icons. Se os DO/DON'T do deck são obrigação
   contratual ou só orientação de estilo é uma pergunta **jurídica**, não técnica, e eu
   não a respondo.

8. **Quando os ícones deixaram de ter gradiente.** A release atual usa fill sólido.
   Releases antigas (2021–2022) usavam gradiente. Não consegui datar a mudança contra
   fonte primária — a AWS não publica changelog de design.

9. **Bibliotecas de terceiros.** Não verifiquei se as bibliotecas de draw.io, Figma,
   Lucidchart etc. codificam os mesmos hex e traços. A própria AWS avisa que podem estar
   desatualizadas (N24), o que sugere que **não**.

10. **Cobertura e viés da amostra.** O corpus são **24 diagramas** vistos pixel a pixel,
    mais 25 soluções / 31 diagramas analisados estruturalmente e 152 patterns do
    Prescriptive Guidance. É substancial, mas **não é um censo**, e é **enviesado** para
    Reference Architecture PDFs e para os domínios de rede e analytics. Dos diagramas do
    Solutions Library, 11 de 31 foram vistos como imagem; do PG, apenas 2 de 30. Padrões
    marcados como "média" força — em particular O16 (fronteira customizada) e O17 (setas
    bidirecionais) — vêm de **uma única observação** cada.

11. **As contagens de densidade são visuais, não extraídas por máquina.** Trate os números
    da seção 5.3 como **± 20 %**.

12. **Estilo de callout por data não é regra limpa.** O círculo preto correlaciona
    *fracamente* com material pós-2023, mas o diagrama *Traffic Encryption* de 2025 usa
    quadrado azul. **Não afirme uma linha do tempo.**

13. **O "How-to Guide: Building an Architecture Diagram" da APN existe mas está atrás do
    login do Partner Central.** Não consegui verificar o conteúdo. É a única fonte
    primária conhecida que eu não consegui ler — e pode conter regras que este documento
    não tem.

14. **Deck escuro.** Analisei-o o suficiente para confirmar que as cores de grupo são
    idênticas e que `AWS Cloud` e os callouts invertem. Não fiz a auditoria completa dos
    154 slides como fiz no claro.
