# Arquitetura multi-conta AWS e integração cross-account: convenções de desenho

> Pesquisa contra fontes primárias AWS (docs.aws.amazon.com, whitepapers, AWS Prescriptive Guidance,
> AWS Architecture Icons deck oficial). Nenhum write-up de terceiro foi usado como autoridade.
>
> Data da pesquisa: 2026-08-21. Release do icon deck analisado: `24-2026.07.31`.
> Fonte PPTX do AWS SRA analisada: `aws-security-reference-architecture-diagrams_June_2026.pptx`.

## 0. Método e por que este documento é confiável

Além de ler a documentação, foram baixados e **abertos os arquivos-fonte oficiais**, o que permite
afirmar medidas e estilos em vez de estimá-los a olho:

| Artefato | URL |
|---|---|
| AWS Architecture Icons — pacote de ícones | `https://aws.amazon.com/architecture/icons/` → `Icon-package_07312026...zip` |
| AWS Architecture Icons — deck PPTX (light/dark) | mesmo pacote, `Microsoft-PPTx-toolkits_07312026...zip` |
| AWS SRA — fonte editável dos diagramas | https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/samples/attachment.zip |

Do deck extraiu-se o slide 25 (`Groups 1/5`) e os slides 11–18 (`Guidelines`); do PPTX do SRA
extraiu-se a geometria real (offsets/extents em EMU) de cada caixa de conta. As medidas em polegadas
citadas adiante vêm daí.

---

## 1. AWS Organizations num diagrama de arquitetura oficial: OUs, contas e SCPs

### 1.1 Existe shape oficial de conta — e **não** existe shape oficial de Organization nem de OU

O deck oficial tem uma categoria fechada de *containers* (o slide 25, `Groups 1/5`). A lista completa,
extraída do XML do slide, é:

```
AWS Cloud · Region · Availability Zone · Security group · Auto Scaling group ·
Virtual private cloud (VPC) · Private subnet · Public subnet · Server contents ·
Corporate data center · EC2 instance contents · Spot Fleet · AWS account ·
AWS IoT Greengrass Deployment · AWS IoT Greengrass · Elastic Beanstalk container ·
AWS Step Functions workflow · Generic group · Generic group (alt, tracejado)
```

E o pacote de ícones confirma, em `Architecture-Group-Icons_07312026/`, exatamente 13 arquivos de
ícone de grupo, entre eles **`AWS-Account_32.svg`**.

**Conclusões duras:**

- **`AWS account` é um group/boundary oficial.** Conta é uma caixa de primeira classe.
- **`Organization` e `Organizational unit` NÃO são groups.** Não existe caixa oficial para nenhum dos dois.
- OU e conta existem apenas como **resource icons** (ícones pequenos, não containers), em
  `Resource-Icons_07312026/Res_Management-Governance/`:
  `Res_AWS-Organizations_Account_48`, `Res_AWS-Organizations_Organizational-Unit_48`,
  `Res_AWS-Organizations_Management-Account_48` — confirmados no slide 108 do deck
  (`Management Tools 6/10 | AWS Organizations | Account | Organizational unit | Management account`).

Isto é o achado mais importante para um gerador automático: **o modelo de agrupamento da AWS só tem
containment de verdade até o nível de conta. OU é rótulo; Organization é moldura improvisada.**

### 1.2 Estilos exatos de borda dos containers

Extraído do XML do slide 25. Espessura uniforme `w="15875"` EMU = **1,25 pt** (o slide 13 exige 2 pt
no caso de uso Training & Certification — ver §1.4).

| Group | Traço | Cor |
|---|---|---|
| **AWS account** | **sólido** | **`#E7157B`** (magenta) |
| Region | `sysDash` (tracejado) | `#00A4A6` |
| Availability Zone | `dash` | `#00A4A6` |
| Virtual private cloud (VPC) | sólido | `#8C4FFF` (roxo) |
| Private subnet | sólido | `#00A4A6` |
| Public subnet | sólido | `#7AA116` (verde) |
| Security group | sólido | `#DD344C` |
| Auto Scaling group | `dash` | `#ED7100` |
| Corporate data center | sólido | `#7D8998` (cinza) |
| Generic group | sólido **ou** `dash` | `#7D8998` |
| AWS Cloud | sólido | cor de tema (squid ink), sem `srgbClr` no XML |

Regra visual derivada: **fronteira física/geográfica é tracejada (Region, AZ); fronteira lógica de
posse é sólida (Account, VPC, subnet).** Conta é sólida — é uma fronteira de verdade.

### 1.3 Como a AWS desenha "Organization" na prática, já que não há shape

Duas soluções distintas aparecem nos diagramas oficiais:

**(a) Moldura custom.** No AWS SRA, a organização é um retângulo azul `#0070C0` envolvendo tudo, com o
ícone de serviço `AWS Organizations` (quadrado magenta) e o rótulo `Organization` posicionados **acima
e fora** da caixa, alinhados à sua borda esquerda. Medido no PPTX oficial: caixa em
`x=1,54" y=0,80"`, rótulo em `y=0,28–0,32"`, ícone em `x=1,54"` — ou seja, `icon.x == box.x`.
Isso é permitido explicitamente pelo deck (slide 14, *DO*: "Add a custom group if needed"; slide 26,
"Create a Custom Group for a Service").

**(b) Não desenhar.** Em vários diagramas a organização é implícita e só as contas aparecem.

### 1.4 Como OU aparece

Em diagramas de arquitetura, **OU é um par ícone+rótulo flutuante posicionado acima do primeiro
membro do grupo, sem caixa**. Confirmado na geometria do SRA: o rótulo `OU – Security` está em
`y=3,06"`, e a primeira conta membro (`Security Tooling`) começa em `y=3,68"` — o rótulo não envolve
nada, apenas encabeça a pilha.

A descrição textual oficial do próprio diagrama confirma a leitura posicional
([account-structure.html](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/account-structure.html)):

> "At the upper left of the diagram is the Org Management account... **Below** the Org Management
> account is the Security OU with two specific accounts... **Along the right side** is the
> Infrastructure OU with the Network account and Shared Services account. **At the bottom** of the
> diagram is the Workloads OU..."

Em **diagramas de hierarquia** (não de arquitetura) a coisa muda — ver §4.1.

### 1.5 Como SCP aparece — três tratamentos, nenhum deles é um container

Este é um ponto que quebra a intuição. SCP **nunca** é desenhada como fronteira/halo em volta da OU.

1. **Ícone parqueado na margem + setas tracejadas** — diagrama de conceitos do Organizations
   ([orgs_getting-started_concepts.html](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_getting-started_concepts.html),
   imagem `AccountOuDiagram.png`). Um único ícone `Policies` (checklist) fica **fora da hierarquia, na
   borda direita**, e dele saem setas **tracejadas/traço-ponto** para o root, para OUs e diretamente
   para contas. Legendas em texto ao lado explicam o escopo: *"Policies applied at root apply to all
   accounts in the organization"*, *"Policies applied at the OU apply to accounts within the OU"*,
   *"Policies can be assigned to OUs or directly to accounts"*.
2. **Ícone dentro da conta de management** — AMS MALZ
   ([malz-net-arch.html](https://docs.aws.amazon.com/managedservices/latest/userguide/malz-net-arch.html)):
   `Service Control Policies` é apenas mais um resource icon **dentro da caixa `Management Account`**,
   ao lado de `AWS Orgs` e `Break-Glass Role`.
3. **Ausente** — no diagrama principal consolidado do AWS SRA, SCPs **não aparecem**. São tratadas só
   em prosa. O diagrama é um mapa de *onde cada serviço mora*, não de governança.

**Regra:** SCP/RCP é *anotação de política*, não geometria. Um gerador não deve tentar representá-la
como container.

---

## 2. Landing Zone / Control Tower / AWS SRA: contas canônicas e disposição visual

### 2.1 O conjunto canônico de contas

Fonte: [SRA — Dedicated accounts structure](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/dedicated-accounts.html)

| Conta | OU | Papel |
|---|---|---|
| Management (Org Management) | — (raiz) | Governança central; hospeda o root da organização |
| Security Tooling (= *Audit* no Control Tower) | Security | GuardDuty, Security Hub, Config, Inspector, Detective, Audit Manager |
| Log Archive | Security | Ingestão e arquivamento imutável de todos os logs |
| Network | Infrastructure | Gateway entre a aplicação e a internet; TGW, firewalls, edge |
| Shared Services | Infrastructure | Identity Center directory, AD, messaging, metadata |
| Application (Workload) | Workloads | Hospeda os workloads de negócio |

O Control Tower cria automaticamente apenas a **Security OU** (com Log Archive + Audit) e,
opcionalmente, a **Sandbox OU**; Infrastructure OU e Workloads OU são criadas pelo cliente
([aws-multi-account-landing-zone.html](https://docs.aws.amazon.com/controltower/latest/userguide/aws-multi-account-landing-zone.html)).

Catálogo completo de OUs recomendadas
([recommended-ous-and-accounts.html](https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/recommended-ous-and-accounts.html)):

- **Foundational**: Security, Infrastructure
- **Application**: Workloads
- **Experimental**: Sandbox
- **Procedural**: Exceptions, Transitional, Suspended, Policy Staging
- **Advanced**: Individual Business Users, Deployments, Business Continuity

### 2.2 A disposição visual do AWS SRA — medida no arquivo-fonte

O PPTX oficial tem slide de **12" × 11"** (quase quadrado, ligeiramente retrato). Geometria real das
caixas no slide 5 (*OU and dedicated account structure*):

```
Organization (borda #0070C0)   x=1,54  y=0,80  w=7,92  h=9,93
├─ COLUNA ESQUERDA  (x ≈ 1,78–1,82)
│   Org Management account      y=1,06  h=1,66   w=3,23
│   [rótulo] OU – Security      y=3,06            (ícone 0,50×0,50)
│   Security Tooling account    y=3,68  h=1,44   w=2,51
│   Log Archive account         y=5,27  h=1,40   w=2,53
│   [rótulo] OU – Workloads     y=7,18
│   Application account         y=7,79  h=2,70   w=3,98
└─ COLUNA DIREITA   (x ≈ 5,77–5,84)
    [rótulo] OU – Infrastructure y=0,94
    Network account             y=1,55  h=3,68   w=3,30
    Shared Services account     y=5,34  h=1,92   w=2,53
```

Métricas derivadas dessa medição:

| Métrica | Valor |
|---|---|
| Passo entre colunas (x da esquerda → x da direita) | **4,04"** |
| Gap vertical entre contas irmãs da **mesma** OU | **0,11–0,15"** |
| Gap vertical entre o fim de uma OU e o rótulo da próxima | **≈ 0,51"** (≈ 4× o gap de irmãs) |
| Padding interno do container `Organization` | **0,24"–0,34"** |
| Gap entre rótulo de OU e primeira conta membro | **≈ 0,12"** abaixo do ícone |
| Altura das caixas de conta | **não uniforme** (1,40" a 3,68") — dimensionadas por conteúdo |
| Alinhamento das contas dentro da coluna | **left-aligned** na origem x da coluna |

O deck exige apenas `.05"` de folga em grupos aninhados (slide 14); o SRA usa **~5× isso** (0,24").
Ou seja: o mínimo oficial é folgado na prática.

### 2.3 O mesmo layout no diagrama consolidado

O slide 3 (*consolidated main diagram*) repete exatamente a mesma topologia — mesma organização em duas
colunas, mesma ordem:

```
Organization label   x=0,96 y=0,13
OU – Infrastructure  x=5,03 y=0,80   ← coluna DIREITA, topo
OU – Security        x=1,16 y=2,80   ← coluna ESQUERDA, meio
OU – Workloads       x=1,16 y=7,57   ← coluna ESQUERDA, base
```

### 2.4 AMS MALZ: o layout hierárquico top-down com barramento

O diagrama de alto nível do AMS Multi-Account Landing Zone
([malz-net-arch.html](https://docs.aws.amazon.com/managedservices/latest/userguide/malz-net-arch.html),
imagem `MALZ-high-level-Nov2022.png`) usa uma organização **diferente e igualmente canônica**:

- **Management Account no topo, centralizada**, isolada acima de tudo.
- **Caixa "Conventions" (legenda) no canto superior direito**: borda **sólida** = conta gerenciada pela
  AMS; borda **tracejada** = conta gerenciada pelo cliente. *A AWS codifica tipo de conta no estilo da
  borda e declara isso numa legenda.*
- **Core OU: as 4 contas core (Shared Services, Network, Security, Log Archive) lado a lado
  horizontalmente**, mesma altura, dentro de um retângulo externo.
- **Um barramento horizontal corre por baixo das 4 contas**, com stubs verticais subindo com ponta de
  seta para dentro de cada caixa de conta; o ícone da OU fica na **extremidade esquerda do barramento**,
  rotulado `Core Organizational Unit`. Este é exatamente o padrão de "canaleta dedicada" — ver §4.2.
- Abaixo, o mesmo barramento se repete para `Applications OU` → `Applications: Managed OU` e
  `Applications: Development OU`.
- **Contas em quantidade indeterminada** são desenhadas como **duas ou três caixas sobrepostas em
  cascata**, rotuladas `Application Account 1` e `Application Account N`. Nunca se desenham N caixas.

### 2.5 Landing Zone Accelerator: colunas de larguras desiguais, sem arestas cross-account

[architecture-overview.html](https://docs.aws.amazon.com/solutions/latest/landing-zone-accelerator-on-aws/architecture-overview.html)
(`lza-arch-diagram.png`), 3 contas:

- `Management Account`: caixa grande ocupando ~2/3 da largura, à **esquerda**.
- `Log Archive Account`: canto **superior direito**. `Audit Account`: canto **inferior direito**.
- Estilo da caixa de conta = o group oficial: borda magenta `#E7157B` + **aba preenchida magenta no
  canto superior esquerdo** com o ícone `AWS account` e o rótulo à direita do ícone.
- Dentro das contas, subgrupos são **`Generic group` tracejado cinza** (`INSTALLER`, `CORE`, `SOURCE`,
  `BUILD`, `DEPLOYMENT STAGES`, `Centralized Logging`).
- **Callouts numerados** (círculos pretos, número branco em negrito) 1→10, na ordem
  esquerda→direita, topo→base, cruzando as três contas.
- **Não há uma única seta entre as caixas de conta.** A relação Management → Log Archive → Audit é
  transmitida pela numeração e pelo texto que acompanha a figura.

**Conclusão:** contas **não** são caixas pares de mesmo tamanho. São dimensionadas por conteúdo e
empacotadas; a conta mais densa domina a área e as demais se acomodam numa coluna lateral.

---

## 3. Integração cross-account: como cada padrão é desenhado

Nota metodológica: os diagramas desta seção foram **baixados e inspecionados visualmente**, não apenas
lidos em texto — as páginas de documentação raramente descrevem o desenho.

### 3.0 A gramática comum da travessia de fronteira

Três regras valem para **todos** os padrões:

1. **A borda da conta é atravessada sem cerimônia.** A linha simplesmente passa por cima da borda
   magenta. **Não existe convenção AWS de "porta", gateway, losango ou marcador de travessia.**
2. **O que marca a travessia é onde o habilitador de permissão está desenhado**, não a linha.
3. **`Sólido` = caminho de dados real. `Tracejado` = relação lógica / política / recurso não-possuído.**
   Fluxo de tráfego, quando mostrado, vai como **overlay pontilhado colorido** por cima da topologia
   sólida, com caixa de legenda `Index:`.

E uma regra de posicionamento que se repete em quase todos:

> **Contas ficam lado a lado horizontalmente, e o elemento compartilhado/central fica na CALHA
> (gutter) entre elas** — ou numa conta de rede dedicada à direita/abaixo. Empilhamento vertical só
> aparece quando um lado é "muitos spokes" e o outro é "uma conta central".

### 3.1 VPC peering

[Prescriptive Guidance — Architecture 2](https://docs.aws.amazon.com/prescriptive-guidance/latest/integrate-third-party-services/architecture-2.html)
é a referência cross-account explícita.

- `Your account` (esquerda) e `Third-party account` (direita), **caixas magenta de mesma altura**, calha
  larga entre elas.
- **O ícone roxo de VPC peering fica NA CALHA, fora de ambas as contas** — o peering é um **nó no meio
  da aresta**, não um rótulo de linha. Rótulo "VPC peering connection" abaixo do ícone.
- Aresta **cinza fina ortogonal com ponta de seta em AMBAS as extremidades** (bidirecionalidade
  explícita), atravessando as bordas magenta sem marcação.
- Para comunicar a explosão combinatória `n(n-1)/2`, o
  [whitepaper de rede](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/vpc-peering.html)
  põe 4 VPCs numa **grade 2×2 com ícone de peering em cada aresta e nas duas diagonais** (5 ícones) —
  o espaguete é o argumento visual.
- A não-transitividade é desenhada em **V invertido**: duas VPCs no topo, uma na base, dois ícones de
  peering, e a **ausência** de linha entre as duas do topo carrega a mensagem.

### 3.2 AWS Transit Gateway

Três representações distintas, escolhidas pelo nível de detalhe:

**(a) Hub radial puro** —
[whitepaper, `hub-and-spoke-design.png`](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/transit-gateway.html).
TGW no **centro geométrico exato**, spokes irradiando em ~360° com **linhas retas diagonais sem pontas
de seta**. Legenda no canto superior direito codificando **cor por tipo de attachment**
(`VPC Attachment` verde, `GRE Tunnel` azul, `TGW Connect` preto, `BGP Peering` vermelho tracejado,
`Direct Connect` roxo, `SD-WAN Overlay` laranja). Sem caixas de conta — é nível serviço.

**(b) Pivô na calha** —
[PG Architecture 3](https://docs.aws.amazon.com/prescriptive-guidance/latest/integrate-third-party-services/architecture-3.html).
Duas contas magenta lado a lado, **TGW no centro da calha, fora de ambas**, quatro linhas cinza
ortogonais saindo dele com **seta apenas na ponta da VPC**. A route table flutua **acima** do TGW como
três pílulas roxas empilhadas com CIDRs, ligada por seta vertical de ponta dupla.

**(c) TGW como contêiner** — quando as route tables importam
([inspeção de tráfego](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/centralized-network-security-for-vpc-to-vpc-and-on-premises-to-vpc-traffic.html)),
o TGW deixa de ser ícone e vira **retângulo grande contendo cards de route table lado a lado**, cada um
com borda tracejada de cor distinta. As VPCs spoke ficam numa **fileira horizontal no topo**, descem por
linhas verticais até um **barramento horizontal** e entram no retângulo.

Orientação textual da AWS sobre posicionamento organizacional:

> "**Place your organization's Transit Gateway instance in its Network Services account.** ... **Use AWS
> Resource Access Manager (RAM) to share a Transit Gateway instance** for connecting VPCs across
> multiple accounts."

**Ponto de attachment** tem três graus de detalhe: (a) só a linha; (b) **sub-caixa nomeada
`TGW Attachment` com acento ciano dentro da VPC**; (c) `TGW Subnet` + `TGW ENI` dentro de uma faixa de AZ.

### 3.3 AWS PrivateLink / VPC endpoint services

**Atenção: a orientação provedor/consumidor NÃO é estável na documentação oficial.**

| Fonte | Esquerda | Direita |
|---|---|---|
| [docs VPC — concepts](https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html) | Service **consumer** VPC | Service **provider** VPC |
| [whitepaper multi-VPC](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/aws-privatelink.html) | **Consumer** Account | Service **Provider** Account |
| [PG Architecture 1](https://docs.aws.amazon.com/prescriptive-guidance/latest/integrate-third-party-services/architecture-1.html) | **Third-party (provider)** | **Your account (consumer)** |

O que **é** estável:

- **O tile roxo `AWS PrivateLink` fica na calha entre as duas contas**, fora de ambas — de novo, nó no
  meio da aresta.
- O **`Endpoint service` é desenhado como sub-contêiner CINZA TRACEJADO dentro da VPC do provedor**,
  envolvendo o Load Balancer.
- **Seta única e unidirecional consumidor → provedor** (contraste deliberado com o peering, que é de
  ponta dupla). O texto AWS justifica: *"it is limited to only TCP traffic and unidirectional
  communication. The third-party workloads cannot initiate communication back to your account."*
- Quando há múltiplos endpoints (um por AZ), as linhas **convergem no ícone do PrivateLink** e **uma
  única linha sai** dele para o NLB — funil, não N linhas paralelas.
- Serviços AWS públicos aparecem numa **caixa azul tracejada `AWS Public Services/Endpoints`** — o
  tracejado marca "não pertence a nenhuma conta do cliente".

### 3.4 AWS RAM — o caso mais divergente

**Não há uma convenção única. Há quatro, e a escolha depende da classe do recurso.**

**Convenção A — recurso de rede anexável (TGW).**
[PG Architecture 3.1](https://docs.aws.amazon.com/prescriptive-guidance/latest/integrate-third-party-services/architecture-3-1.html).
O TGW compartilhado **NÃO é duplicado nem fantasmado** na conta consumidora: aparece **uma única vez**,
na conta dona. **`AWS RAM` é um tile de serviço posicionado ABAIXO do recurso compartilhado, dentro da
conta dona, com uma seta apontando PARA CIMA, para o recurso.** As arestas de attachment que cruzam para
a conta consumidora são **sólidas cinza com seta**, não tracejadas. RAM não emite linhas até os
consumidores.

**Convenção B — subnet/VPC compartilhada: o recurso é ESTICADO através das colunas de conta.**
[Blog de rede — VPC sharing](https://aws.amazon.com/blogs/networking-and-content-delivery/vpc-sharing-key-considerations-and-best-practices/).
Layout em **swimlanes verticais**: quatro colunas de conta com **borda vermelha TRACEJADA** dentro de uma
moldura `AWS Organization` sólida, e **uma única caixa verde `Shared VPC` atravessando as quatro
colunas horizontalmente**. Cada subnet é uma **faixa horizontal que se estende exatamente até a coluna da
conta com quem foi compartilhada**, e os recursos do participante são desenhados **dentro dessa faixa,
na coluna dele**. **Zero linhas de conexão no diagrama inteiro** — o compartilhamento é comunicado
*puramente por geometria*. Note a **inversão da hierarquia**: aqui a conta é tracejada (permeável) e a
VPC é sólida e a atravessa.

**Convenção B′ — participantes aninhados dentro da VPC do dono.**
[whitepaper — VPC sharing](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/amazon-vpc-sharing.html):
cinco caixas de conta magenta desenhadas **DENTRO** da caixa da VPC do dono. A AWS quebra
deliberadamente o aninhamento hierárquico estrito para comunicar "o participante existe dentro do
espaço de rede do outro".

**Convenção C — recurso de configuração/política: linha tracejada rotulada, no topo.** Ver §3.5.

**Convenção C′ (legada) — o recurso é fantasmado no consumidor.** Ver §3.5.

### 3.5 Route 53 Resolver rules compartilhadas via RAM

**Referência moderna:**
[PG — DNS híbrido multi-conta](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/set-up-dns-resolution-for-hybrid-networks-in-a-multi-account-aws-environment.html)

- **Quatro contas magenta lado a lado numa fileira**, com a `Shared Services account` **na extremidade
  direita**. Abaixo e centralizada, uma `Networking account` com TGW/Cloud WAN.
- **O ícone `AWS RAM` fica no canto superior direito, ACIMA e FORA da caixa da Shared Services account.**
- **A aresta de sharing é uma linha PRETA TRACEJADA HORIZONTAL correndo pelo TOPO de todas as contas**,
  do RAM até a extrema esquerda, com **pontas de seta descendo para dentro da borda superior de cada
  conta consumidora**, e o rótulo de texto **inline sobre a linha**. Isto é literalmente uma **canaleta
  dedicada acima da fileira de contas** — o padrão mais próximo do que um algoritmo de layout precisa.
- Associações de PHZ correm numa **segunda canaleta tracejada, embaixo**.
- Legenda `Index:` no canto inferior direito, codificando **cor por tipo de resolução**.

**Variante whitepaper:** o sharing vira apenas **anotação de texto entre colchetes dentro do rótulo do
recurso** — `Route53 resolver – Forwarding Rules [shared with spoke VPC's using AWS RAM]` — sem linha
dedicada
([DNS no whitepaper](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/dns.html)).
Endpoints inbound/outbound são desenhados como **faixas horizontais atravessando as colunas de AZ, com
uma ENI em cada AZ**.

**Variante legada (blog de 2019):** o ícone da regra é **duplicado em miniatura dentro de cada conta
consumidora**, ligado ao original por uma aresta rotulada **`Shared`** (sólida para o caso destacado,
tracejada para os demais). O padrão de 2024/2025 abandonou isso.

**Barramento de associação:** o
[whitepaper de DNS híbrido](https://docs.aws.amazon.com/whitepapers/latest/hybrid-cloud-dns-options-for-vpc/scaling-dns-management-across-multiple-accounts-and-vpcs.html)
desenha as PHZ associations como **um barramento horizontal roxo no topo, com linhas descendo até cada
VPC** — barramento compartilhado, não N linhas ponto-a-ponto.

### 3.6 IAM role assumida cross-account

**O tutorial oficial não tem diagrama.** O diagrama canônico está em
[Common scenarios — AWS accounts](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_aws-accounts.html)
(`roles-usingroletodelegate.png`).

**Achado contraintuitivo e importante:**

> **A conta do RECURSO (trusting, `Production`) fica à ESQUERDA. A conta da IDENTIDADE (trusted,
> `Development`) fica à DIREITA.** É o inverso da intuição "identidade à esquerda".

- Fronteiras = retângulos de **cantos arredondados** com o rótulo interrompendo a borda superior
  (estilo legado, anterior ao icon set atual).
- **Par request/response, não seta única**: passo 3 direita→esquerda (principal pede o role), passo 4
  esquerda→direita (STS devolve credenciais), passo 5 direita→esquerda (uso da credencial no bucket).
- **Convenção de numeração posicional muito útil:** passos **1 e 2 ficam DENTRO das caixas** (são
  configuração local de cada conta); passos **3, 4, 5 ficam NO VÃO**, cada um colado à sua seta de
  travessia.
- **Não há ícone de trust policy** — a confiança é implícita na seta.

Em diagramas modernos, o IAM Role aparece como **nó anexado**: o ícone de role fica **abaixo** do
componente que ele autoriza, com **seta vertical apontando para CIMA, para dentro do componente**
(ver §3.7 e §3.8).

### 3.7 S3 bucket policy cross-account (fan-in)

Três níveis de fidelidade, todos oficiais:

**Nível 1 — origens não desenhadas.**
[SRA Log Archive](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/log-archive.html):
o bucket `Central logs` recebe setas **rotuladas pelo TIPO DE LOG**, não pela conta emissora
(`Access logs`, `DNS logs`, `Flow logs`), mais uma seta diagonal longa com o texto rotacionado **ao
longo da própria seta**: `From CloudTrail organization trail`. **As contas de origem simplesmente não
existem no desenho.**

**Nível 2 — origens desenhadas, política como nó.**
[PG — VPC Flow Logs centralizados](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/configure-vpc-flow-logs-for-centralization-across-aws-accounts.html):
`Member account` à esquerda, `Log Archive account` à direita, linhas ortogonais que **se fundem** numa
única entrada no bucket.

> 🔑 **A `Bucket policy` é desenhada como NÓ PRÓPRIO (ícone de documento com cadeado) ABAIXO do
> bucket, com seta vertical curta apontando PARA CIMA, para dentro do bucket.** Nunca como rótulo
> sobre a linha de travessia.

**Nível 3 — multiplicidade explícita.**
[PG — logging centralizado com Terraform](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/set-up-centralized-logging-at-enterprise-scale-by-using-terraform.html):
`Application accounts (1…n)` desenhada como **PILHA de caixas deslocadas** (cópias offset atrás). Três
linhas paralelas atravessam as fronteiras, e **o mesmo número de passo se repete idêntico nas três**
(não incrementa).

### 3.8 Amazon EventBridge cross-account

**A página de docs de cross-account não tem diagrama** — o padrão está só em prosa. Mas a convenção do
bus é oficial e verificável no SVG:

> **O event bus NÃO é um nó — é um RETÂNGULO-CONTAINER** de traço `#E71578`, `stroke-width="2"`, que se
> **entra pela esquerda e sai pela direita**, com as *rules* desenhadas **dentro** dele.
> ([eb-event-bus.html](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-bus.html))

**Cross-account 1:1** —
[PG pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/create-cross-account-amazon-eventbridge-connection-organization.html):
container externo `Organization`, `Source account` à esquerda, `Destination account` à direita, **uma
única seta horizontal reta** atravessando ambas as bordas. O **IAM Role fica abaixo da Cross Account
Rule com seta apontando para cima, para dentro dela** — mesma gramática do bucket policy.

**Hub central com fan-out** —
[AWS Compute Blog](https://aws.amazon.com/blogs/compute/simplifying-cross-account-access-with-amazon-eventbridge-resource-policies/):
publisher à esquerda, **hub no meio**, subscribers **empilhados à direita**. A conta central ganha
**borda grossa e rótulo em negrito**; as demais, borda fina cinza. O **evento é desenhado como ícone
posicionado SOBRE o conector, no vão entre contas**. Fan-out **ortogonal**: uma linha sai do hub e só
depois bifurca em cotovelos — evita N diagonais longas.

**Bus como barra vertical (many-to-many)** —
[AWS Cloud Operations Blog](https://aws.amazon.com/blogs/mt/event-driven-architecture-using-amazon-eventbridge/).
O melhor exemplo de anti-espaguete que encontrei:

- O bus é uma **BARRA VERTICAL alta e estreita** de borda rosa, ocupando quase toda a altura da conta
  central, com as rules empilhadas dentro. Arestas entram e saem **horizontalmente em alturas
  diferentes** — literalmente um barramento elétrico.
- **Anti-espaguete #1 — uma COR POR FLUXO.** Azul = evento E1, laranja = E3, roxo = E2.
- **Anti-espaguete #2 — "PORTAS" rotuladas.** Cada ponta de aresta termina num **pequeno círculo
  colorido** rotulado `P-E1` (publisher do evento 1), `S-E2` (subscriber do evento 2)… **A aresta não
  termina direto no ícone do serviço.** Roteamento 100% ortogonal.

### 3.9 AWS Lake Formation / data mesh

**A página de cross-account permissions não tem diagrama.** As referências são outras.

**Layout de três colunas** —
[PG — AWS offerings for data mesh](https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-data-mesh/aws-offerings-data-mesh.html):
**produtores à esquerda, `Central governance account` no centro (verticalmente centrado), consumidores à
direita.** Só duas instâncias desenhadas de cada lado: `Member account 1` e `Member account N` — o `N`
no rótulo carrega a multiplicidade. As linhas dos produtores **convergem no mesmo ponto de entrada** da
borda esquerda da conta central (fan-in) e saem pela direita em cotovelos (fan-out). Ponta de origem =
**ponto preto preenchido sem seta**; ponta de destino = seta. **O mesmo número de passo se repete nas
arestas paralelas.**

**Barra horizontal central** —
[Data Analytics Lens — data mesh reference architecture](https://docs.aws.amazon.com/wellarchitected/latest/analytics-lens/data-mesh-reference-architecture.html).
Esta é a resposta mais forte contra espaguete em many-to-many:

- Três faixas horizontais: **produtores na BASE, `Federated governance` no MEIO como retângulo laranja
  tracejado atravessando toda a largura, consumidores no TOPO**.
- **Arestas são setas verticais curtas e bidirecionais** ligando cada produtor/consumidor à barra.
  **Zero arestas produtor→consumidor.**
- Grupos não são caixas fechadas: são **colchetes abertos** com rótulo fora.
- **`....` literal** entre instâncias = "e mais N", sem desenhar.

**Grant vs. acesso — a distinção de traço mais precisa** —
[AWS Big Data Blog (LF-TBAC)](https://aws.amazon.com/blogs/big-data/securely-share-your-data-across-aws-accounts-using-aws-lake-formation/):

- **Linha TRACEJADA LARANJA sem ponta de seta** ligando a LF-Tag do produtor à do consumidor = **o grant
  de permissão**. A cópia no consumidor é desenhada em **estilo fantasma/esmaecido** = "compartilhado,
  não possuído".
- **Seta PRETA GROSSA SÓLIDA** do `Resource Link` no consumidor atravessando para o `Data Catalog` do
  produtor = **o acesso/query real**.
- Grants são listados numa **caixa tipo TABELA** no rodapé de cada conta, **não em linhas**.

**Multiplicidade por pilha** —
[EDLA blog](https://aws.amazon.com/blogs/big-data/design-patterns-for-an-enterprise-data-lake-using-aws-lake-formation-cross-account-access/):
produtor e consumidor como **pilhas de retângulos tracejados deslocados**; a conta central (hub) usa
**borda tracejada ciano** — cor diferente para destacá-la. O **ícone do AWS RAM é posicionado logo
dentro de cada borda**, funcionando como "porta" da travessia.

### 3.10 SRA Security Tooling (delegated administrator)

> 🚨 **A SRA não desenha NENHUMA seta entre contas.**

O diagrama do
[Security Tooling account](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/security-tooling.html)
é uma **grade de ícones de serviço** dentro do cartão da conta. **Zero setas, zero linhas, zero contas-
membro desenhadas.** Não há fan-in visual. A relação administrador/membro é expressa **em prosa**:

> "The Security Tooling account serves as the administrator account for security services that are
> managed in an administrator/member structure throughout the AWS accounts... this is handled through
> the AWS Organizations delegated administrator functionality."

E o próprio guia declara que o *placement* é o conteúdo do diagrama, e os *links* são texto:

> "**Recommended placement** to most effectively enable and manage the service. This is captured in the
> individual architecture diagrams for each account and OU. **Configuration, management, and data
> sharing links to other security services** [texto, não desenho]."

### 3.11 Bônus — como se desenha uma travessia PROIBIDA

[Building a data perimeter on AWS](https://docs.aws.amazon.com/whitepapers/latest/building-a-data-perimeter-on-aws/building-a-data-perimeter-on-aws.html):

- Uma **ELIPSE ROXA** envolve a zona confiável (`My AWS`); `Not My AWS` fica em texto fora, à direita.
  **Elipse = perímetro lógico de confiança; retângulo continua sendo fronteira de propriedade.**
- Entidades não-confiáveis são **ícones nus, sem caixa de fronteira**, rotulados **em vermelho**.
- **Setas atravessam a elipse e um "X" VERMELHO GRANDE é posicionado exatamente no ponto de interseção
  com o perímetro.** É a convenção AWS para "travessia que deve ser negada".

### 3.12 Endpoints centralizados / egress / inspection

Padrão consistente: **spokes de um lado, conta central do outro (ou abaixo), TGW no meio como pivô.**

- **Interface endpoints centralizados**
  ([whitepaper](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/centralized-access-to-vpc-private-endpoints.html)):
  três contas spoke numa **fileira superior**; uma **cápsula roxa tracejada horizontal
  `Private Hosted Zone Associations`** entre a fileira de spokes e a conta central, com linhas roxas
  tracejadas subindo até cada VPC spoke; `Networking Account` como **caixa larga na fileira inferior**.
  Linhas pretas sólidas verticais descem dos spokes, cruzam duas bordas de conta e **convergem no TGW**.
- **Egress centralizado**
  ([whitepaper](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/using-nat-gateway-for-centralized-egress.html)):
  contas spoke **empilhadas à esquerda**, `Networking Account` **à direita ocupando toda a altura**,
  TGW dentro da conta de rede mas **fora da Egress VPC**, `Internet Gateway` **a cavaleiro na borda**.
- **Inspection VPC cross-account**
  ([PG](https://docs.aws.amazon.com/prescriptive-guidance/latest/integrate-third-party-services/architecture-3.html)):
  a `Inspection VPC` fica **no topo da conta dona, acima das VPCs spoke, e é desenhada MAIS LARGA que
  elas** — a largura comunica "posição privilegiada / caminho de todos".

Gateways (IGW, VGW, NAT) são sempre desenhados **a cavaleiro sobre a borda da VPC**, não dentro dela.

---

## 4. O problema de layout, explicitamente

### 4.1 Existem DOIS gêneros de diagrama multi-conta, com convenções incompatíveis

Este é o ponto que mais confunde um gerador automático. A AWS usa duas linguagens distintas conforme o
assunto:

**Gênero A — "diagrama de arquitetura" (o que roda onde).**
Caixas aninhadas, sem linhas de árvore, OU como rótulo flutuante, conta como container.
Exemplos: AWS SRA slides 3 e 5; LZA; AMS MALZ.

**Gênero B — "diagrama de hierarquia/governança" (quem está sob quem).**
Árvore ortogonal explícita, com root no topo. Exemplo canônico:
[OU design phase 1](https://docs.aws.amazon.com/prescriptive-guidance/latest/ou-structure-landing-zone/phase-1.html).
Convenções observadas nessa figura:

- Ícone de serviço `AWS Organizations` no **topo, centralizado**, com uma seta horizontal para o ícone
  `AWS management account` à direita — a management account fica **fora** da árvore.
- `Root` como caixa **tracejada azul**, centralizada, logo abaixo.
- **Elbow connectors** (stub vertical → barramento horizontal → quedas verticais com ponta de seta)
  descendo do Root para os grupos de OU.
- **Categorias de OU são caixas tracejadas coloridas** com rótulo em itálico **acima e à esquerda,
  fora da caixa**: `Foundational OUs` em azul, `Workload OUs` em âmbar. **A cor do tracejado codifica a
  categoria da OU.**
- Dentro de cada categoria, as OUs ficam **lado a lado horizontalmente** (ícone à esquerda + nome à
  direita, dentro de uma caixinha de borda fina).
- **As contas penduram abaixo da sua OU**: uma espinha vertical desce da caixa da OU e dela saem
  **stubs horizontais curtos apontando para a direita** para cada conta, empilhadas verticalmente e
  alinhadas à esquerda.
- **Marcadores explícitos de truncamento**: `.....` horizontal entre OUs para indicar "há mais OUs";
  `⋮` vertical abaixo de uma OU para indicar "há mais contas".

O texto do Control Tower confirma que o layout em **colunas rotuladas** é intencional no whitepaper:
*"In the **Foundational OUs column**, two OUs have been added..."* / *"In the **Additional OUs area**,
several more OUs have been added..."*
([aws-multi-account-landing-zone.html](https://docs.aws.amazon.com/controltower/latest/userguide/aws-multi-account-landing-zone.html)).

Há ainda um **Gênero C degenerado**: a "vitrine de catálogo", usada quando não há hierarquia a mostrar.
O diagrama `recommended-ous.png` do whitepaper põe **9 OUs numa única fileira horizontal** de ícones
com rótulo embaixo, e um sub-box tracejado cinza `Foundational OUs` centralizado abaixo contendo
Security e Infrastructure. Não é hierarquia, é enumeração.

### 4.2 Contas pares lado a lado, empilhadas, ou agrupadas por OU?

A evidência primária dá uma resposta em três partes:

1. **Agrupadas por OU, sempre** — mas o agrupamento é expresso por **adjacência + rótulo**, não por
   caixa envolvente (Gênero A) ou por **aresta de árvore** (Gênero B).
2. **Contas irmãs da mesma OU: empilhadas verticalmente** no AWS SRA (Security Tooling sobre Log
   Archive; Network sobre Shared Services) — porque o canvas do SRA é retrato.
   **Lado a lado horizontalmente** no AMS MALZ (as 4 contas core) — porque o canvas é paisagem.
   → **A direção de empilhamento das irmãs segue a orientação do canvas, não a semântica.**
3. **Contas NÃO são pares de mesmo tamanho.** No SRA as alturas vão de 1,40" a 3,68"; no LZA a
   Management ocupa 2/3 da largura. São dimensionadas pelo conteúdo.

Posição fixa observada consistentemente:

| Conta | Posição | Fonte |
|---|---|---|
| Management / Org Management | topo (upper-left no SRA, top-center no MALZ), **fora de OU** | SRA, MALZ, phase-1 |
| Security OU (Security Tooling + Log Archive) | logo abaixo da management | SRA, MALZ, Control Tower |
| Infrastructure OU (Network + Shared Services) | **coluna direita** (SRA) / meio da fileira core (MALZ) | SRA, MALZ |
| Workloads OU (Application) | **base** do diagrama | SRA, MALZ, phase-1 |

Ou seja: **a ordem de leitura é governança → segurança → infraestrutura → workload**, do topo/esquerda
para a base/direita. A conta de rede **não** fica sempre à esquerda; no SRA ela está no topo da coluna
**direita**, e no MALZ no meio da fileira horizontal.

### 4.3 Como uma aresta que cruza fronteira de conta é roteada sem virar espaguete

**A resposta primária, e ela é radical: na maior parte das vezes a AWS simplesmente não desenha a
aresta.**

Contagem de conectores (`<p:cxnSp>`, incluindo aninhados em grupos) no PPTX oficial do AWS SRA:

| Slide | Conteúdo | Conectores |
|---|---|---|
| 3 | **Diagrama principal consolidado (6 contas, todos os serviços)** | **0** |
| 5 | Estrutura de OU e contas | **0** |
| 7 | Org Management account (detalhe) | 3 |
| 8 | Security Tooling account (detalhe) | 2 |
| 9 | Log Archive account (detalhe) | 7 |
| 10 | Network account (detalhe) | 6 |
| 11 | Shared Services account (detalhe) | 3 |
| 12 | Application account (detalhe) | 3 |

O diagrama-carro-chefe multi-conta da AWS tem **zero setas**. Todas as setas existem só nas vistas
por-conta, e ali são **intra-conta**. O mesmo vale para o LZA (nenhuma seta entre as três contas).

Quando uma relação cross-account **precisa** aparecer, os mecanismos oficiais observados são, em ordem
de frequência:

1. **Aresta agregada e anotada em texto.** No detalhe da Log Archive account, em vez de N setas vindas
   de N contas, há **uma seta diagonal entrando na caixa da conta vinda de fora**, rotulada
   **"From CloudTrail organization trail"**. O texto substitui a cardinalidade.
2. **Callouts numerados sem aresta.** LZA: passos 1–10 atravessam três contas sem uma única linha.
   O deck manda ordenar "as linearly as possible, such as left to right, top to bottom, or clockwise"
   (slide 18).
3. **Barramento/canaleta ortogonal dedicada.** AMS MALZ: um **segmento horizontal único correndo por
   baixo da fileira de contas**, com stubs verticais curtos subindo para dentro de cada conta. Uma
   linha, N stubs — em vez de N linhas cruzadas. É a canaleta dedicada literal.
4. **Espinha vertical + stubs horizontais.** Gênero B (phase-1): uma linha vertical desce ao lado da
   lista de contas e stubs curtos apontam para a direita, para cada conta.
5. **Hub central com raios.** Só quando o hub é uma entidade real (Transit Gateway na Network account);
   ver §3.
6. **Elemento compartilhado desenhado uma vez, na conta dona.** Ver §3 (RAM).

O deck reforça a ortogonalidade (slide 16, *DO*): *"Use straight lines and right angles to connect
objects wherever possible. In the instance where right angles are not possible, you may use a diagonal
line as provided."* Os presets de seta do slide 27 incluem `Elbow Connector` (roteamento ortogonal) além
de `Straight Arrow Connector`.

Estilo das setas (extraído do XML do slide 27): **todas sólidas**, `w=15875` EMU = 1,25 pt, ponta
`Open Arrow` tamanho `med`/`sm`, na cauda, na cabeça, ou em ambas (bidirecional). **Não existe preset
tracejado no conjunto oficial de setas** — as setas tracejadas vistas no diagrama de conceitos do
Organizations são customizações para significar "política/lógico", não fluxo.

### 4.4 A partir de quantas contas o diagrama quebra em múltiplas vistas

A evidência não aponta para um limite de contagem de contas, e sim para uma **regra de decomposição
por eixo**. O AWS SRA é o caso mais instrutivo, porque a fonte editável revela a estrutura completa:

```
slide  3  → 1 vista consolidada    (6 contas, todos os serviços, 0 setas)
slide  5  → 1 vista de estrutura   (6 contas, 0 serviços, 0 setas)
slides 7–12 → 6 vistas de detalhe  (1 conta cada, com setas intra-conta)
```

**6 contas ainda cabem numa página** — o SRA insiste nisso: *"The recommendations are built around a
**single-page architecture**"*, *"a simple, three-tier web architecture that **can fit on a single
page**"*
([introduction](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/introduction.html),
[architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/architecture.html)).

Mas o SRA **também** publica as 6 vistas por conta *ao mesmo tempo*. Isto é, o corte não acontece
"quando fica cheio demais" — é estrutural e simultâneo:

- **Eixo 1 — por conta.** Uma vista de detalhe por conta, sempre. É a decomposição padrão.
- **Eixo 2 — por camada de abstração.** Uma vista *sem serviços* (estrutura de OU/conta) e uma vista
  *com serviços*. O mesmo conjunto de contas, dois níveis de zoom.
- **Eixo 3 — por domínio/capacidade.** A biblioteca do SRA separa em guias inteiros:
  identity management, perimeter security, cyber forensics, generative AI, IoT
  ([about-sra-library](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/about-sra-library.html)).
- **Eixo 4 — por fase temporal.** `phase-1`, `phase-2`, `phase-3` do guia de estrutura de OU: o mesmo
  ambiente crescendo, uma figura por fase.

E quando a contagem de contas é **indeterminada**, a AWS não quebra em vistas — ela **trunca com
notação**: caixas sobrepostas `Account 1`/`Account N` (MALZ), `.....` e `⋮` (phase-1), ou uma aresta
agregada rotulada "from all accounts in the organization" (SRA Log Archive).

**Regra prática defensável:** a página única aguenta ~6 contas *desde que as arestas cross-account
sejam suprimidas*. O que força a quebra não é o número de contas — é o número de **arestas**.

---

## 5. Exemplos oficiais que valem como padrão-ouro

Ordenados por valor para calibrar um gerador.

| # | O que é | URL |
|---|---|---|
| 1 | **AWS SRA — fonte editável (PPTX) dos diagramas.** O artefato mais valioso: geometria real, 16 slides, vista consolidada + estrutura + 6 vistas por conta | https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/samples/attachment.zip |
| 2 | AWS SRA — diagrama principal consolidado (single-page, 6 contas, 0 setas) | https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/architecture.html |
| 3 | AWS SRA — estrutura de OU e contas, **com a descrição textual das posições** ("upper left", "along the right side", "at the bottom") | https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/account-structure.html |
| 4 | AWS SRA — vistas por conta (o padrão de decomposição) | `.../org-management.html`, `.../security-tooling.html`, `.../log-archive.html`, `.../network.html`, `.../shared-services.html`, `.../application.html` |
| 5 | **AWS Organizations — diagrama de conceitos.** O padrão-ouro de como desenhar root/OU/conta/**políticas** (swimlanes + políticas na margem) | https://docs.aws.amazon.com/organizations/latest/userguide/orgs_getting-started_concepts.html |
| 6 | **AMS MALZ — estrutura multi-conta de alto nível.** Padrão-ouro de barramento horizontal, legenda de convenções e notação `Account 1..N` | https://docs.aws.amazon.com/managedservices/latest/userguide/malz-net-arch.html |
| 7 | **OU design phase 1** — padrão-ouro do Gênero B (árvore de hierarquia com categorias tracejadas coloridas e marcadores de truncamento) | https://docs.aws.amazon.com/prescriptive-guidance/latest/ou-structure-landing-zone/phase-1.html |
| 8 | Landing Zone Accelerator on AWS — 3 contas, colunas desiguais, callouts numerados, zero arestas cross-account | https://docs.aws.amazon.com/solutions/latest/landing-zone-accelerator-on-aws/architecture-overview.html |
| 9 | Whitepaper — catálogo de OUs recomendadas (Gênero C) | https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/recommended-ous-and-accounts.html |
| 10 | **AWS Architecture Icons** — pacote de ícones + deck com as *Guidelines* (slides 11–18) e os *Groups* (slide 25) | https://aws.amazon.com/architecture/icons/ |
| 11 | Control Tower — estratégia multi-conta; texto que confirma layout em **colunas** ("Foundational OUs column") | https://docs.aws.amazon.com/controltower/latest/userguide/aws-multi-account-landing-zone.html |
| 12 | Whitepaper de rede multi-VPC — referência para TGW/PrivateLink/VPC sharing/DNS/egress | https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/welcome.html |

Padrões-ouro específicos de **integração cross-account** (§3):

| # | Padrão | URL |
|---|---|---|
| 13 | **Trio canônico de 2 contas do Prescriptive Guidance** — PrivateLink / VPC peering / Transit Gateway, mesmo layout, mesma gramática. A melhor calibração para "duas contas + travessia" | `.../integrate-third-party-services/architecture-1.html`, `architecture-2.html`, `architecture-3.html`, `architecture-3-1.html` (RAM) |
| 14 | **DNS híbrido multi-conta** — o melhor exemplo de **canaleta de sharing** (linha tracejada no topo, do ícone RAM, com stubs descendo para cada conta) | https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/set-up-dns-resolution-for-hybrid-networks-in-a-multi-account-aws-environment.html |
| 15 | **Data mesh — Data Analytics Lens.** Padrão-ouro de **barramento central** em N→M: produtores na base, governança como barra, consumidores no topo, zero arestas laterais | https://docs.aws.amazon.com/wellarchitected/latest/analytics-lens/data-mesh-reference-architecture.html |
| 16 | **Data mesh — Prescriptive Guidance.** Três colunas produtor/central/consumidor, fan-in + fan-out ortogonal, `Member account 1` / `N` | https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-data-mesh/aws-offerings-data-mesh.html |
| 17 | **VPC sharing (blog de rede).** Swimlanes verticais de conta com a VPC atravessando-as; **zero linhas de conexão** — sharing puramente por geometria | https://aws.amazon.com/blogs/networking-and-content-delivery/vpc-sharing-key-considerations-and-best-practices/ |
| 18 | **EventBridge como barramento vertical** — cor por fluxo + portas rotuladas (`P-E1`/`S-E2`). Melhor anti-espaguete de many-to-many | https://aws.amazon.com/blogs/mt/event-driven-architecture-using-amazon-eventbridge/ |
| 19 | **EventBridge cross-account (PG)** — IAM Role como nó anexado com seta para dentro da rule | https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/create-cross-account-amazon-eventbridge-connection-organization.html |
| 20 | **VPC Flow Logs centralizados** — bucket policy como **nó anexado** ao bucket, com seta para dentro | https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/configure-vpc-flow-logs-for-centralization-across-aws-accounts.html |
| 21 | **AssumeRole cross-account** — o único diagrama oficial; recurso à esquerda, identidade à direita, par request/response | https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_aws-accounts.html |
| 22 | **Lake Formation LF-TBAC** — grant (tracejado laranja, sem seta) × acesso (sólido preto, com seta); cópia "fantasma" no consumidor | https://aws.amazon.com/blogs/big-data/securely-share-your-data-across-aws-accounts-using-aws-lake-formation/ |
| 23 | **Data perimeter** — como desenhar uma travessia **proibida** (elipse + X vermelho na interseção) | https://docs.aws.amazon.com/whitepapers/latest/building-a-data-perimeter-on-aws/building-a-data-perimeter-on-aws.html |

---

## 6. Regras de layout derivadas

Regras acionáveis por um algoritmo. Cada uma traz a evidência que a sustenta.

### 6.1 Modelo de agrupamento

| # | Regra | Evidência |
|---|---|---|
| **G1** | O grafo de containment tem exatamente estes níveis: `Organization? → [rótulo de OU] → Account → Region? → VPC → subnet → recurso`. **Só `Account`, `Region`, `VPC` e `subnet` são caixas.** | Lista fechada de group icons (slide 25); `AWS-Account_32.svg` existe, `Organization`/`OU` não existem |
| **G2** | **OU não é um container.** Renderize OU como par (ícone 0,50"×0,50" + rótulo) **acima** do primeiro membro, alinhado à esquerda da coluna, e agrupe os membros por adjacência + gap. Nunca desenhe caixa de OU num diagrama de arquitetura. | Geometria SRA slide 5: rótulo `OU – Security` em `y=3,06`, membro em `y=3,68`, sem retângulo |
| **G3** | `Organization`, se necessária, é uma **moldura custom** (retângulo sólido, cor não-padrão — o SRA usa `#0070C0`) com **ícone+rótulo acima e fora**, com `icon.x == box.x`. É legítimo omiti-la. | SRA slide 5; deck slide 14/26 autoriza custom groups |
| **G4** | Conta = retângulo **sólido `#E7157B`**, 1,25 pt, com aba do ícone `AWS account` no **canto superior esquerdo** e rótulo à direita do ícone. | Slide 25 XML; LZA `lza-arch-diagram.png` |
| **G5** | Fronteira geográfica/física é **tracejada** (Region `sysDash`, AZ `dash`); fronteira de posse é **sólida** (Account, VPC, subnet). Não invente estilos. | Tabela §1.2 |
| **G6** | Subgrupos sem ícone oficial → **`Generic group`, cinza `#7D8998`, tracejado**. Nunca inventar um group novo com ícone de serviço arbitrário. | Deck slide 14 *DON'T*: "Create groups with nonapproved AWS icon(s)"; uso no LZA |

### 6.2 Espaçamento e dimensionamento

| # | Regra | Evidência |
|---|---|---|
| **S1** | Padding interno de container: **≥ 0,24"** (o mínimo absoluto do deck é 0,05", mas o SRA usa 0,24–0,34"). Escale tudo a partir deste valor se o canvas mudar. | Geometria SRA; deck slide 14 |
| **S2** | Gap entre **contas irmãs da mesma OU** = `1×` unidade base (**0,11–0,15"**). | Geometria SRA |
| **S3** | Gap entre **grupos de OU diferentes** = **≈ 4× o gap de irmãs** (**≈ 0,5"**). Este contraste 1:4 é o que faz o agrupamento por OU ser legível **sem caixa**. | Geometria SRA — regra derivada mais importante do §6 |
| **S4** | Caixas de conta são **dimensionadas por conteúdo**, não uniformizadas. Alturas no SRA: 1,40"–3,68". | Geometria SRA; LZA (Management ocupa 2/3 da largura) |
| **S5** | Contas dentro de uma coluna são **left-aligned** na origem x da coluna; larguras variam livremente. | Geometria SRA: x = 1,78/1,80/1,82 |
| **S6** | Ícones de serviço **nunca** são redimensionados; ficam no tamanho predefinido e são dispostos em **grade regular** dentro da conta. Rótulos 12 pt Arial, máx. 2 linhas, nunca quebrar no meio da palavra. | Deck slides 15 e 17 |

### 6.3 Posicionamento semântico

| # | Regra | Evidência |
|---|---|---|
| **P1** | Ordem de leitura canônica: **Management → Security → Infrastructure → Workloads**, do topo/esquerda para a base/direita. Ancore esta ordem antes de qualquer otimização de arestas. | SRA (texto explícito de posições), MALZ, phase-1 |
| **P2** | **Management/Org Management fica no topo e fora de qualquer OU.** upper-left em canvas retrato, top-center em canvas paisagem. | SRA `y=1,06` topo da coluna esquerda; MALZ topo centralizado; phase-1 fora da árvore |
| **P3** | **Workloads/Application vai na base.** É o maior box e o mais profundo (contém VPC + subnets). | SRA `y=7,79 h=2,70`; MALZ fileira inferior |
| **P4** | **Falso: "conta de rede sempre à esquerda".** No SRA a Network fica no **topo da coluna direita**; no MALZ, no **meio da fileira horizontal**. O invariante real é: **Network é vizinha de Shared Services dentro da Infrastructure OU**, e o par fica *entre* Security e Workloads na ordem de leitura. | SRA slide 5; MALZ |
| **P5** | Número de colunas ≈ 2 para 6 contas em canvas retrato; 1 fileira para 4 contas em canvas paisagem. **Direção de empilhamento das irmãs = eixo longo do canvas.** | SRA (12"×11", 2 colunas, irmãs empilhadas); MALZ (paisagem, irmãs lado a lado) |
| **P6** | Canvas: **12"×11"** para o diagrama-mestre; **6,5"×8,75"** quando o destino é retrato (blog/Word). | PPTX do SRA; deck slide 12 |

### 6.4 Arestas cross-account — o núcleo do problema

| # | Regra | Evidência |
|---|---|---|
| **E1** | **Regra soberana: na vista consolidada multi-conta, suprima TODAS as arestas cross-account.** Faça a vista consolidada ser um *mapa de colocação* (que serviço mora em que conta), não um grafo de fluxo. | SRA slides 3 e 5: **0 conectores**; LZA: 0 arestas entre contas |
| **E2** | Se a relação for indispensável na consolidada, use **callouts numerados** (círculo preto, número branco em negrito) ordenados esquerda→direita, topo→base. **Sem linha.** Nunca misture tamanhos de callout. | Deck slide 18; LZA passos 1–10 |
| **E3** | Um fan-in de **N contas → 1 destino** colapsa em **uma única aresta rotulada** entrando na caixa do destino vinda de fora, com o texto carregando a cardinalidade ("From CloudTrail organization trail", "from all accounts in the organization"). **Nunca N arestas.** | SRA slide 9 (Log Archive) |
| **E4** | Quando várias contas irmãs precisam do mesmo vínculo, roteie por **barramento ortogonal dedicado**: um segmento paralelo à fileira/coluna de contas, deslocado para fora dela, com **stubs perpendiculares curtos** entrando em cada conta. 1 linha + N stubs, nunca N linhas. | MALZ (barramento horizontal sob a fileira core); phase-1 (espinha vertical + stubs à direita) |
| **E5** | Toda aresta é **ortogonal** (`Elbow Connector`); diagonal só quando o ângulo reto for impossível. | Deck slide 16 *DO* |
| **E6** | Estilo de aresta: **sólida**, 1,25 pt (2 pt em contexto T&C), ponta `Open Arrow` `med`/`sm`. Reserve **tracejado** para relação **lógica/de política**, não para fluxo de dados — e saiba que isso é uma extensão, não um preset oficial. | Slide 27 XML (todos os presets sólidos); `AccountOuDiagram.png` usa tracejado só para políticas |
| **E7** | Um recurso compartilhado (via RAM, hub TGW, forward rules, PHZ, bucket central) é desenhado **uma única vez, dentro da conta que o possui**. Não replique nem "fantasmeie" nas consumidoras. Exceções conhecidas: subnet/VPC compartilhada (§3.4-B) e o padrão legado de 2019 (§3.5). | PG Arch 3.1; PG DNS multi-conta |
| **E8** | **A borda da conta é atravessada sem cerimônia.** Não desenhe porta, gateway, losango ou marcador de travessia. O que marca a travessia é **onde o habilitador de permissão está**, não a linha. | Todos os diagramas de §3 |
| **E9** | **Habilitador de permissão é NÓ ANEXADO, nunca rótulo de aresta.** IAM Role, bucket policy, event bus policy: ícone posicionado **abaixo** do componente que autorizam, com **seta curta apontando para CIMA, para dentro dele**. | PG Flow Logs (bucket policy); PG EventBridge cross-account (Role) |
| **E10** | **Um elemento de conectividade nomeado (peering, PrivateLink, TGW) é um NÓ NO MEIO DA ARESTA, posicionado na calha entre as contas** — com ícone + rótulo abaixo. Nunca um rótulo sobre a linha. | PG Arch 1/2/3 |
| **E11** | **A direção da seta carrega semântica.** Peering = ponta dupla (bidirecional). PrivateLink = ponta única consumidor→provedor. TGW attachment = ponta única TGW→VPC. AssumeRole = **par request/response**, duas setas opostas no vão. | PG Arch 1/2/3; `roles-usingroletodelegate.png` |
| **E12** | Quando o many-to-many é inevitável, use **cor por fluxo** + **"portas" rotuladas** (`P-E1`, `S-E2`) nas pontas, em vez de terminar a aresta direto no ícone do serviço. | AWS Cloud Ops blog (EventBridge) |
| **E13** | Passos numerados posicionam-se por semântica: passos de **setup ficam DENTRO** da caixa de conta; passos de **runtime/travessia ficam NO VÃO**, colados à seta. Em arestas paralelas idênticas, **repita o mesmo número** (não incremente). | `roles-usingroletodelegate.png`; PG Terraform logging; PG data mesh |
| **E14** | Fluxo de tráfego, quando mostrado, vai como **overlay pontilhado colorido por cima** da topologia sólida, com caixa de legenda `Index:`. Nunca misture as duas camadas no mesmo traço. | whitepaper (inspeção ingress); PG DNS multi-conta |

**Hierarquia de escolha para uma aresta cross-account** (aplicar na ordem, parando na primeira que serve):

```
1. Não desenhe                     → vista consolidada (E1)
2. Callout numerado, sem linha     → relação é sequencial e narrável (E2)
3. Aresta agregada + rótulo texto  → fan-in N→1 (E3)
4. Canaleta / barramento dedicado  → N irmãs recebem o mesmo vínculo (E4)
5. Hub central + raios ortogonais  → N→M com entidade central real (E4, §3.9)
6. Aresta direta com nó na calha   → exatamente 2 contas (E10)
```

### 6.5 Escala e decomposição

| # | Regra | Evidência |
|---|---|---|
| **D1** | **Limite prático: ~6 contas por página**, e isso só se E1 for respeitada. O gatilho de quebra é a **contagem de arestas**, não a de contas. | SRA: 6 contas + 0 arestas numa página |
| **D2** | Emita **sempre** uma vista de detalhe por conta, em paralelo à consolidada — não como fallback. Arestas intra-conta vivem só ali (2–7 por vista no SRA). | Estrutura do PPTX do SRA (slides 7–12) |
| **D3** | Emita **duas camadas de zoom** do mesmo conjunto de contas: uma *sem serviços* (estrutura de OU/conta) e uma *com serviços*. | SRA slides 5 e 3 |
| **D4** | Para conjuntos de cardinalidade indeterminada, **trunque com notação em vez de quebrar em vistas**: caixas sobrepostas em cascata rotuladas `X 1` / `X N`; `.....` horizontal para mais irmãos; `⋮` vertical para mais filhos. | MALZ; phase-1 |
| **D5** | Eixos de decomposição legítimos, em ordem: **(1) por conta**, (2) por camada de abstração, (3) por domínio/capacidade, (4) por fase temporal. | SRA library; guia phase-1/2/3 |

### 6.6 Governança e legenda

| # | Regra | Evidência |
|---|---|---|
| **L1** | **SCP/RCP nunca é geometria.** Ou vira ícone `Policies` parqueado na margem com setas tracejadas para root/OU/conta, ou vira resource icon dentro da Management account, ou é omitida. Nunca um halo/fronteira em volta da OU. | `AccountOuDiagram.png`; MALZ; SRA (omite) |
| **L2** | Se o estilo da borda codificar semântica (ex.: sólida = gerenciada por X, tracejada = gerenciada por Y), **emita uma caixa de legenda "Conventions"**, canto superior direito. | MALZ |
| **L3** | Em diagramas de **hierarquia** (Gênero B), categorias de OU viram **caixas tracejadas com cor por categoria** e rótulo em itálico **acima e fora** — a única situação em que OU ganha caixa. | phase-1 (`Foundational OUs` azul, `Workload OUs` âmbar) |
| **L4** | Ordem de construção do algoritmo, na ordem que a AWS prescreve: **(1) grupos/estrutura → (2) ícones de serviço/recurso → (3) setas → (4) numeração.** Layout antes de arestas, sempre. | Deck slide 11, "Building a Diagram" |

### 6.7 Regras específicas da vista de integração cross-account

A vista *de integração* (2–4 contas, o assunto é a travessia) obedece a regras **diferentes** da vista
*de inventário* (§6.3). Um gerador precisa saber em qual dos dois modos está.

| # | Regra | Evidência |
|---|---|---|
| **X1** | Na vista de integração, **contas ficam lado a lado horizontalmente**, com uma **calha larga** entre elas. Empilhamento vertical só quando um lado é "N spokes" e o outro é "1 conta central". | PG Arch 1/2/3; whitepaper egress centralizado |
| **X2** | **O elemento compartilhado/central vive NA CALHA entre as contas** (TGW, PrivateLink, ícone de peering) ou **numa conta de rede dedicada posicionada à direita ou abaixo**. | PG Arch 1/2/3; whitepaper endpoints centralizados |
| **X3** | **Canaleta dedicada é uma faixa PARALELA à fileira de contas, deslocada para FORA dela** (acima ou abaixo), com stubs perpendiculares entrando na borda de cada conta. Use para sharing/associação de N contas. | PG DNS multi-conta (canaleta tracejada no topo); whitepaper DNS híbrido (barramento roxo no topo); whitepaper endpoints centralizados (cápsula roxa) |
| **X4** | **Barramento central de largura ou altura total** quando a relação é N→M: produtores de um lado, consumidores do outro, barra atravessando entre eles, arestas **curtas e perpendiculares**, **zero arestas laterais**. | Data Analytics Lens (barra horizontal); AWS Cloud Ops blog (barra vertical) |
| **X5** | O eixo esquerda→direita segue o **FLUXO primário** (produtor→consumidor, source→destination). **Exceção documentada: AssumeRole inverte** — a conta do *recurso* (trusting) fica à esquerda e a da *identidade* (trusted) à direita. | PG data mesh; PG EventBridge; `roles-usingroletodelegate.png` |
| **X6** | A conta que é **hub** ganha ênfase visual: borda mais grossa e rótulo em negrito (ou cor de borda distinta), enquanto os spokes ficam com borda fina. | AWS Compute blog (EventBridge); EDLA blog (hub ciano) |
| **X7** | Multiplicidade se **anota, não se desenha**: pilha de caixas deslocadas + `(1…n)` no rótulo; ou desenhar só a instância `1` e a `N`; ou `....` literal entre elas. | PG Terraform logging; PG data mesh; Data Analytics Lens |
| **X8** | Grupos que não precisam de fronteira forte podem virar **colchete aberto** (linha + ticks laterais) com o rótulo fora, em vez de retângulo fechado. | Data Analytics Lens |
| **X9** | Um recurso que existe **por AZ** vira **faixa horizontal atravessando as colunas de AZ**, com um ícone de ENI em cada. Gateways (IGW/VGW/NAT) ficam **a cavaleiro sobre a borda** da VPC, nunca dentro. | whitepaper DNS; whitepaper egress/ingress |
| **X10** | Travessia **proibida** = seta que cruza o perímetro + **"X" vermelho no ponto de interseção**; entidades não-confiáveis desenhadas como **ícones nus sem caixa**, rotulados em vermelho. Perímetro lógico de confiança = **elipse**; fronteira de propriedade = retângulo. | whitepaper Data perimeter |

---

## 7. Incertezas

1. **Duas gerações de estilo de caixa de conta convivem.** O SRA desenha conta como retângulo de borda
   **preta fina** com o *resource icon* `Account` magenta no topo; o LZA usa o *group* oficial (borda
   magenta `#E7157B` + aba preenchida). Ambos são oficiais e atuais. Não encontrei documento que declare
   um deles depreciado. Para um gerador, o estilo do **group oficial** é o mais defensável — é o que
   está no deck normativo.

2. **A moldura azul `#0070C0` de `Organization` é uma invenção do time do SRA**, não um padrão. Outros
   documentos oficiais não a usam. Não há cor canônica para organização.

3. **As medidas de espaçamento (0,24" / 0,15" / 0,51") vêm de UM arquivo-fonte** (o PPTX do SRA de
   junho/2026). O contraste 1:4 entre gap-de-irmãs e gap-de-OU é consistente e reproduzível ali, mas
   não encontrei nenhum documento AWS que o *declare* como regra. É uma regra **derivada por medição**,
   não citada.

4. **Não existe documento AWS que declare um limite de contas por diagrama.** O "~6 contas por página"
   é inferência a partir do SRA se descrever como *single-page architecture* com 6 contas. A afirmação
   forte e bem sustentada é a outra: **o SRA tem zero arestas cross-account na vista consolidada**.

5. **O deck oficial não tem preset de seta tracejada.** As setas tracejadas/traço-ponto do diagrama de
   conceitos do Organizations são customizações. Se um gerador adotar "tracejado = relação lógica",
   estará estendendo o sistema, não seguindo-o.

6. **`Availability Zone`, `Security group`, `Elastic Beanstalk container` e `AWS Step Functions
   workflow` aparecem como groups no slide 25 do deck mas não têm SVG correspondente em
   `Architecture-Group-Icons_07312026/`** (13 SVGs vs 19 rótulos). Provavelmente são compostos só no
   PPTX. Um gerador que dependa dos SVGs precisa de fallback para esses quatro.

7. **Páginas de whitepaper renderizadas por JS não puderam ser lidas** (`appendix-e-establish-multi-account.html`,
   `patterns-for-organizing-your-aws-accounts.html`) e o PDF baixado veio truncado em 8 páginas sem
   ferramenta de extração disponível no ambiente. A afirmação sobre layout em **colunas** ("Foundational
   OUs column") vem do **texto do Control Tower que descreve essas figuras**, não da inspeção direta
   delas. É citação de segunda mão dentro da própria AWS.

8. **Não foi verificado** se o `.zip` do SRA contém o `aws-security-reference-architecture-deep-dive.pptx`
   referenciado no slide 13 — o zip baixado tinha apenas um arquivo. Pode estar anexado a outro guia da
   biblioteca do SRA.

9. **A orientação provedor/consumidor do PrivateLink é CONTRADITÓRIA entre documentos oficiais**
   (tabela em §3.3). Os docs do VPC e o whitepaper põem o consumidor à esquerda; o Prescriptive
   Guidance põe o provedor à esquerda. Não existe fonte que arbitre. Um gerador precisa escolher e ser
   consistente — a maioria (2 de 3) põe **consumidor à esquerda**.

10. **AWS RAM tem quatro convenções incompatíveis** (§3.4): tile apontando para o recurso; recurso
    esticado através das colunas de conta; participantes aninhados dentro da VPC do dono; e o padrão
    legado que fantasma miniaturas no consumidor. **A classe do recurso determina a convenção**
    (anexável × compartilhável-por-subnet × configuração), mas isso é inferência minha — não achei
    documento AWS que declare essa taxonomia.

11. **Divergências de cor entre gerações de diagrama.** O deck normativo dá conta = `#E7157B` e
    VPC = `#8C4FFF` (roxo). Diagramas mais antigos usam conta em carmim (`~#C7255C`) e **VPC em verde**.
    Ambos aparecem em material corrente da AWS. Adote os valores do deck e trate o resto como legado.

12. **Colisão de cor não resolvida:** o event bus do EventBridge usa `#E71578` e a conta AWS usa
    `#E7157B` — praticamente a mesma cor. Num diagrama que tenha os dois, o container de conta e o
    container de bus ficam visualmente indistinguíveis. Não achei orientação AWS sobre isso.

13. **As páginas de documentação mais óbvias para cross-account NÃO têm diagrama:**
    `tutorial_cross-account-with-roles.html` (IAM), `eb-cross-account.html` (EventBridge) e
    `cross-account-permissions.html` (Lake Formation) — verificado no HTML bruto. Os diagramas
    canônicos estão em páginas vizinhas ou em blogs. Se um gerador for calibrado por essas páginas,
    não encontrará nada.

14. **O diagrama canônico de AssumeRole está em estilo legado** (retângulos de cantos arredondados,
    rótulo interrompendo a borda, setas diagonais) — anterior ao icon set atual. A inversão
    "recurso à esquerda / identidade à direita" é observada nesse único diagrama e **não foi
    corroborada** por um diagrama moderno. Trate X5 (exceção do AssumeRole) como frágil.

15. **A distinção entre "vista de inventário" (§6.3) e "vista de integração" (§6.7) é minha**, derivada
    do contraste entre o SRA (zero arestas, 6 contas) e os padrões do Prescriptive Guidance (2 contas,
    arestas explícitas). Nenhum documento AWS nomeia esses dois modos. É a abstração que melhor explica
    os dados, mas não é citação.
