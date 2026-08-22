# q16 · Contrato do context pack corporativo

> **Descartável.** Código e prosa de uma pergunta só, do ticket
> [#16 · Contrato do context pack corporativo](https://github.com/ThiagoPanini/panlabs-skills/issues/16).
> **Nada aqui vira produção.** O que sobrevive é a *decisão*, em
> [`contrato.md`](./contrato.md) e na resolução do ticket; estes arquivos
> ficam como fonte primária.

**Abra [`comparacao.html`](./comparacao.html) com duplo clique** — alterna
entre o exemplo de referência e o candidato antes/depois de passar pelo
context pack.

## A pergunta

A premissa 10 do mapa: a skill aceita ser alimentada com a arquitetura de
referência de uma empresa (prosa + `.drawio` de exemplo) e honra suas
premissas — mas o usuário real **não tem** esse material hoje. Este ticket
projeta o contrato contra um **exemplo sintético**, como a premissa manda: uma
empresa fictícia ("Acme Corp") cuja rede é privada-only atrás de uma conta de
trânsito com Transit Gateway — o mesmo cenário citado na invocação do ticket.

As seis perguntas e a resposta a cada uma estão em
[`contrato.md`](./contrato.md). Este README é o **worked example**: o
contrato rodando contra um context pack de verdade e um candidato de
arquitetura real, para provar que ele funciona — não só que faz sentido no
papel.

## O cenário

Um context pack sintético de duas peças (`exemplo-context-pack/`):

- [`premissas.md`](./exemplo-context-pack/premissas.md) — prosa. Catálogo
  proibido/obrigatório, topologia (zero subnet pública, egress só via Transit
  Gateway), nomenclatura (`acme-<camada>-<sufixo>`), segurança (CMK do
  cliente, VPC endpoint).
- [`exemplos/referencia.drawio`](./exemplo-context-pack/exemplos/referencia.drawio) —
  duas contas (rede compartilhada + workload front-end), montado com o
  catálogo do [#17](https://github.com/ThiagoPanini/panlabs-skills/issues/17)
  e **duas divergências deliberadas** do style canônico, pra provar que o
  extrator acha convenção visual de verdade: `strokeWidth=3` nos grupos de
  Conta (não existe no catálogo) e o `fontColor` do grupo VPC trocado do
  cinza `#AAB7B8` do catálogo para `#232F3E` — que por acaso é **a mesma
  divergência que o [#17](https://github.com/ThiagoPanini/panlabs-skills/issues/17)
  listou como aberta**, "camada de estilo, outro ticket".

E um candidato de arquitetura **de antes** do context pack existir: o IR
`web-multi-az` do [#11](https://github.com/ThiagoPanini/panlabs-skills/issues/11)
— três camadas, duas AZs, subnet pública com NAT gateway. Não foi escrito para
este ticket; é o candidato que a sabatina do #15 já teria produzido em
qualquer empresa sem convenção própria, e é exatamente o tipo de arquitetura
que o context pack da Acme rejeitaria.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `contrato.md` | **A decisão.** As seis perguntas do ticket, respondidas com justificativa. |
| `exemplo-context-pack/premissas.md` | Prosa sintética — o que a Acme exige. |
| `exemplo-context-pack/gerar-referencia.cjs` | Monta `exemplos/referencia.drawio` com o catálogo do #17 + as duas divergências deliberadas. `node exemplo-context-pack/gerar-referencia.cjs`. |
| `exemplo-context-pack/exemplos/referencia.drawio` · `.png` | O exemplo, e o render como prova. |
| `extrair.cjs` | `premissas.md` + `exemplos/*.drawio` → `restricoes.json`. `node extrair.cjs exemplo-context-pack/ restricoes.json`. |
| `restricoes.json` | Saída do extrator, contra o context pack da Acme. |
| `aplicar.cjs` | `restricoes.json` + um IR (#11) → IR compatibilizado + notas `origem=premissa`. `node aplicar.cjs restricoes.json modelo.json saida.json`. |
| `web-multi-az.compatibilizado.json` | O IR de antes, depois de passar pelo context pack. Válido contra o esquema do #11 — conferido com `validar.cjs`. |
| `saida/candidato-antes.drawio` · `.png` | O candidato original, renderizado pelo motor do #11 sem tocar em nada. |
| `saida/candidato-depois.drawio` · `.png` | O mesmo candidato depois de `aplicar.cjs`, mesmo motor. |
| `comparacao.html` | Alterna entre os três renders. |

## O que o extrator achou

Rodando `extrair.cjs` contra o context pack da Acme:

- **3 regras de topologia**, **2 de nomenclatura**, **2 de segurança** — uma
  por bullet de `premissas.md`, texto completo preservado (bullet quebrado em
  várias linhas de Markdown junta antes de virar regra — prosa de verdade não
  cabe numa linha só).
- **Catálogo**: `proibidos: [internet gateway, nat gateway]`,
  `obrigatoriosQuandoAplicavel: [transit gateway, vpc endpoint]`.
- **2 divergências de estilo**, e só essas duas — exatamente as que
  `gerar-referencia.cjs` plantou de propósito:

  | Alvo | Chave | Catálogo | Observado |
  |---|---|---|---|
  | `AWS Account` | `strokeWidth` | *(ausente)* | `3` |
  | `VPC` | `fontColor` | `#AAB7B8` | `#232F3E` |

  A subnet privada do exemplo **não** aparece na lista — está com o style do
  catálogo, sem divergência, exatamente como deveria. A primeira versão do
  extrator errava isso: `Private subnet` e `Public subnet` compartilham o
  mesmo `grIcon` no catálogo (só a cor separa as duas), e o índice reverso
  colapsava as duas no mesmo balde — corrigido com desempate por
  `strokeColor` quando o ícone sozinho não decide.

## O que `aplicar.cjs` fez com o candidato

12 notas `origem=premissa`, e a régua do §5 de `contrato.md` — reescreve com
fato de substituição, só sinaliza sem ele — separa nitidamente em três
grupos:

| Mudança | Tipo | Por quê |
|---|---|---|
| `pub-a`/`pub-b` (Public subnet) → privada, `nat-a`/`nat-b` removidos, attachment ao Transit Gateway inserido | **reescreve** | a prosa dá a regra ("zero subnet pública") **e** o fato de substituição ("egress via TGW") |
| VPC e as 6 subnets renomeadas para `acme-<camada>-<sufixo>` | **reescreve** | mecânico — conformar rótulo existente a um padrão declarado não inventa fato |
| `dado-a`/`dado-b` (RDS) — falta CMK do cliente | **só sinaliza** | qual chave usar não está no modelo nem no context pack |
| Serviços atrás de subnet privada — falta VPC endpoint | **só sinaliza** | quais integrações existem de fato não está no modelo |

O resultado passa em `validar.cjs` (#11) sem erro — é um IR válido, não um
JSON ad-hoc.

Detalhe que só apareceu ao renderizar: `notas[].texto` é o que o motor
**desenha**. A primeira versão de `aplicar.cjs` colava a premissa inteira ali
e o render saiu com caixas de nota se empilhando em cima dos ícones —
ilegível. Corrigido movendo a citação completa para `dossie.contextPack`
(opaco ao motor, campo que o esquema do #11 já reservava pra isso) e deixando
`texto` com uma frase curta. Ver §5 de `contrato.md`.

## Achado de método: nomenclatura pode apagar o gatilho de faixa de AZ

**Não estava no roteiro, e vale para quem for construir isto de verdade.**
Rodar os dois IRs pelo motor do #11 muda o **caminho de layout**:

| | `candidato-antes` | `candidato-depois` |
|---|---|---|
| gatilho do [#19](https://github.com/ThiagoPanini/panlabs-skills/issues/19) | `true` — 3 papéis repetem entre as 2 AZs | **`false`** — nenhum papel repete |
| caminho | grade (faixas de AZ) | elk puro |

Causa: `derivar.cjs` (#11) identifica "papel de subnet" pela tripla
`vpc|acesso|rotulo` — e o `rotulo` é **o mesmo campo** que a nomenclatura da
Acme reescreve para incluir o sufixo de AZ (`acme-app-1a` vs `acme-app-1b`).
A reescrita de nome, sozinha, destruiu o sinal que o #19 usa para reconhecer
redundância zonal — mesmo a arquitetura **continuando** zonalmente redundante.
`rotulo` está fazendo dois trabalhos (texto exibido + chave de papel), e uma
convenção de nomenclatura por AZ é exatamente o caso que expõe o acoplamento.
Não corrigido aqui — corrigi-lo é decisão do #11 (campo de papel separado do
rótulo, ou nomenclatura aplicada só na emissão, depois de `derivar`), fora do
escopo deste ticket. Fica registrado porque silenciar teria sido a mesma
mentira calada que o resto do repo rejeita.

## O que este protótipo NÃO decidiu

- **Onde o context pack mora dentro da skill publicada** — mesma névoa que
  `catalog/` e `motor/` já têm; mover é `git mv`.
- **O esquema completo de `restricoes.json`** — o suficiente para provar o
  mecanismo, não uma extração exaustiva do catálogo inteiro (o extrator
  reconhece uma lista de nomes candidatos, não os 403+606 do catálogo — trocar
  isso por uma varredura completa é extensão direta, não redesenho).
- **Persistência da captura preguiçosa do §6** — o *quando* (no ponto do
  conflito) está decidido; o *como* (que arquivo, que formato de diff) é
  matéria de quem implementar a skill de verdade.
