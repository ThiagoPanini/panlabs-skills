---
name: panlabs-aws-diagrams
description: Desenha arquitetura AWS em draw.io — sabatina a necessidade até a completude fechar, propõe arquiteturas candidatas como vista lógica e, aprovada uma, gera a vista técnica multi-conta por motor determinístico com validador geométrico. Use ao pedir, desenhar ou revisar um diagrama AWS; ao escolher entre arquiteturas antes de desenhar; e ao retomar um `.drawio` gerado numa sessão anterior.
---

# panlabs-aws-diagrams

> **O agente escreve o QUE existe. O motor calcula ONDE fica.**

A **fronteira** não é disciplina, é gramática: `schema.json` não tem nenhuma
propriedade que nomeie posição, tamanho, distância ou direção. Não existe onde
escrever uma coordenada. Escreva semântica — quais recursos existem, quem contém
quem, quem fala com quem — e pare.

E a razão de a skill existir não é bonita, é estrutural: **nenhuma checagem
geométrica sabe se a arquitetura desenhada existe.** O validador guarda o
desenho; a **sabatina** guarda o fato. Ela é a única guarda de veracidade do
conteúdo, e é por isso que o arco começa perguntando em vez de desenhando.

Todo comando abaixo roda a partir da raiz da skill
(`skills/panlabs-aws-diagrams/`). Node 18+, e nada além dele: o `elkjs` vai
embarcado, nenhum `npm install`, nenhuma rede.

## O arco

Sete passos. Cada um fecha numa condição checável — onde daria para parar por
julgamento, o critério está escrito como comando.

### 1 · Entre pela porta certa

| entrada | o que rodar |
|---|---|
| necessidade em prosa, ata de reunião, foto de quadro branco | nada — siga para o passo 2 |
| um `.drawio` de sessão anterior | `node tools/resume.cjs <arquivo>` |
| um modelo já escrito (`model@1`) | `node engine/generate.cjs <modelo.json> --output x.drawio` — e pare aqui, o arco acabou |

**Fecha quando** a porta certa foi acionada: na segunda, o **briefing** já está
impresso. Ele devolve o acordo, as candidatas descartadas com o motivo, os achados
recusados e o estacionamento — **nada disso se pergunta de novo ao usuário**.

O briefing também classifica cada página em `intacto`, `remanejado` ou
`divergente`. Regerar por cima de uma página `remanejado` joga fora ajuste manual;
`divergente` bloqueia. Ver [`guide/model.md`](guide/model.md).

### 2 · Sabatina até a completude fechar

Rodadas inteiras de uma vez, cada pergunta numerada e com recomendação. Só os
**cinco eixos de forma**; sonda condicional entra destravada por uma resposta.

> **A checagem que falha é a próxima pergunta.**

```bash
node tools/check-geometry.cjs <modelo-em-construcao.json>
```

**Fecha quando** `A1` chega ao **piso** — e o piso tem nome: `A1.2`, `A1.3` e
`A1.11` sempre (dívida de motor e de esquema, medida em 35 de 35 páginas do
corpus), mais `A1.5` e `A1.12` assim que qualquer nota tiver `sobre`. Toda outra
entrada de `A1` que aparecer é uma pergunta a fazer.

[`guide/inquiry.md`](guide/inquiry.md) traz o protocolo inteiro — eixos,
procedência, estacionamento, material de entrada — e o comando que projeta um
`session@1` para `model@1`, que é o que a checagem come.

### 3 · Proponha candidatas, e deixe o humano escolher

Teto 3, piso 2, e diga por quê quando entregar menos. Cada candidata carrega sua
tupla `E1–E5`; apresente em **compra / paga / escolha se / errada se**, mais a
sua recomendação.

**Fecha quando** toda dupla de candidatas difere em ≥1 eixo de forma **e você sabe
dizer qual** — tuplas iguais colapsam e são descartadas. A escolhida fica com
`estado: "escolhida"`; as descartadas ficam no dossiê com `porque`, que é o que
responde *"por que não a B?"* seis meses depois.

### 4 · Revise as lacunas — em bloco, uma vez só

SPOF, single-AZ, egress sem controle, dado em subnet pública, cross-account sem
confiança, assíncrono sem DLQ. Não é pergunta: é **propriedade emergente do grafo
montado**, e só existe depois que o grafo existe.

```bash
node tools/review-gaps.cjs <modelo.json>
```

Cada regra tem pré-condição, e onde o modelo não afirma a estrutura de que ela
fala ela sai **muda** — com o motivo, porque *"não acusou"* não é *"não rodou"*.

> **Relata, propõe, e conserta apenas o que o usuário mandar consertar.**

Consertar um SPOF calado produz um diagrama bonito de uma arquitetura que não
existe, e nada a jusante pega isso.

**Fecha quando** todo achado tem `estado`, e todo `estado: "recusado"` tem
`viaNota` apontando para uma entrada de `notas` — é o elo que faz *"SPOF conhecido
e aceito"* sobreviver até o desenho.

### 5 · Acorde a vista lógica

A aprovação não é um booleano. `aprovar()` guarda o **recorte** da projeção
lógica aprovada; `conferir()` reprojeta o modelo de hoje e compara.

```bash
node tools/approve.cjs <caso>-logica.json --by <quem> --output output/<caso>.drawio
```

`--candidate` sai do próprio dossiê: a sabatina marcou a vencedora com
`estado: "escolhida"` no passo 3, e o comando lê de lá em vez de pedir de volta o
que já recebeu. Passe `--candidate <id>` só quando nenhuma estiver marcada.

**Fecha quando** o comando imprime `conferir  ✓ o acordo confere` e o `.drawio`
está gravado.
O arquivo carrega o modelo, o dossiê, o acordo e as duas impressões do desenho —
**nada do que foi decidido depende de você lembrar**.

### 6 · Elabore a vista técnica e desenhe as duas

O estacionamento volta agora: os nomes de serviço ditos cedo demais reaparecem
como **sugestão inferida** contra a capacidade correspondente, para confirmar.

A fase técnica **não reescreve o modelo aprovado** — ela aplica um **delta de
elaboração** (`elaboration@1`) sobre o que veio de dentro do `.drawio`. Nenhum campo
do delta alcança um casaco lógico, e `elaborar` recusa se você tentar: a fase
técnica não inventa capacidade. A forma do delta está em
[`guide/model.md`](guide/model.md); o exemplo do corpus é
`models/session/retail-elaboration.json`.

Resolva todo nome pelo catálogo **antes** de escrevê-lo no delta:

```bash
node catalog/aws-shapes.cjs "kinesis data firehose" opensearch "availability zone"
```

É o **mesmo comando do passo 1**, agora com o delta — porque é a mesma leitura:
reconhecer o arquivo e devolver o briefing é o passo 1, aplicar o delta por cima
do que ele leu é o passo 6. Separá-los leria o arquivo duas vezes, e a segunda
leitura poderia discordar da primeira.

```bash
node tools/resume.cjs output/<caso>.drawio --delta <caso>-elaboracao.json
```

Ele sai com **2** quando a elaboração mudou o que foi aprovado — que é o caso em
que a resposta certa é aprovação nova, não desenho novo.

**Fecha quando** as duas condições valem:

- `conferir()` continua `ok` — a projeção lógica de hoje ainda é byte a byte a
  aprovada, mesmo depois de a fase técnica ter enfiado VPC e subnet entre a folha
  e a fronteira;
- `node engine/generate.cjs <modelo> --gate veracidade` passa — nenhuma falha
  semântica, isto é, o desenho não afirma fronteira de rede que o modelo nega.

### 7 · Publique a cópia que circula

O arquivo que retoma e o arquivo que circula **não são o mesmo arquivo**. O de
trabalho carrega a deliberação — candidatas descartadas com o motivo, achados que
o time recusou, fala de reunião, quem aprovou —, tudo legível em *Extras › Editar
diagrama*.

```bash
node session/publish.cjs output/<caso>.drawio --output output/<caso>.publicado.drawio
```

**Fecha quando** o selo da cópia diz `published@1` e o comando reporta quantos
itens de deliberação podou. Sai o que é sobre **pessoas** e sobre **caminhos não
tomados**; fica o que é sobre a arquitetura desenhada.

## Os comandos

| | |
|---|---|
| `node engine/generate.cjs <m.json> --output x.drawio` | desenha. `--theme claro\|escuro\|corporativo` · `--flow solido\|tracejado\|animado` · `--gate nenhum\|veracidade\|falha\|estrito` · `--explain` |
| `node tools/check-geometry.cjs <m.json>` | o laudo das 62 checagens. `--examples` roda o corpus, `--json` para ler no código |
| `node tools/review-gaps.cjs <m.json>` | a revisão de lacunas do passo 4. `--corpus` roda a régua inteira |
| `node catalog/aws-shapes.cjs <nome>...` | resolve nome → shape, com as correções aplicadas |
| `node tools/approve.cjs <sessao.json>` | passo 5: aprova a vista lógica e grava o `.drawio` que retoma. `--by` · `--candidate` · `--at` · `--output` |
| `node tools/resume.cjs <arq.drawio>` | passos 1 e 6: reconhece o arquivo, classifica as páginas e imprime o briefing. Com `--delta <d.json>`, elabora a vista técnica e grava as duas |
| `node session/publish.cjs <arq.drawio>` | a cópia que sai de casa |
| `./tests/run.sh` | a régua inteira, em 8 camadas |

`--explain` é a trilha de auditoria: mostra como cada nome caiu no catálogo, de
onde saiu a camada de rede de cada subnet, e o laudo geométrico página a página.
É a primeira coisa a rodar quando o desenho saiu diferente do esperado.

## O que o motor recusa, e por quê

Recusa alto em vez de desenhar errado. Toda recusa vem com a lista do que
consertar.

| recusa | porque |
|---|---|
| modelo fora do esquema | o contrato é o contrato — e a mensagem sugere o vizinho (`"insidee"` → *você quis dizer "inside"?*) |
| XML mal formado | o draw.io renderiza **truncado com código 0**. O renderizador não reclama, então quem reclama é o gerador |
| tema que reprova no contraste | rótulo que some não dá erro em lugar nenhum. `--force` gera assim mesmo, para o estrago poder ser visto |
| subnet sem camada de rede, no caminho da grade | a ordem das linhas **é** o desenho, e ordem inventada põe a camada de dados em cima |
| nó que o caminho da grade não modela | omitir em silêncio é o diagrama que mente por ausência |
| laudo incompleto, em qualquer nível de portão | se uma família de checagem parou de rodar, o verde não quer dizer nada |

Recusa é **para o agente, não para o humano**: é ida e volta de máquina, não uma
pergunta nova na sabatina.

## A régua

`./tests/run.sh` — 8 camadas. As sete primeiras rodam em qualquer máquina; só o
render precisa do draw.io headless e, sem o binário, avisa e segue. O render é
dependência de **desenvolvimento**; a skill publicada não carrega nenhuma.

Uma suíte verde sobre a semântica **não substitui** o portão sobre a geometria, e
nenhum dos dois substitui olhar o PNG — o corpus tem caso de 24 checagens
estáticas verdes com o ícone errado no desenho.

## Onde está o resto

| leia quando | |
|---|---|
| for perguntar ao usuário, propor candidatas ou revisar lacunas | [`guide/inquiry.md`](guide/inquiry.md) |
| for escrever ou corrigir um modelo, e o esquema não bastar | [`guide/model.md`](guide/model.md) |
| a empresa tiver premissas de arquitetura, ou não tiver | [`guide/context-pack.md`](guide/context-pack.md) |
| o laudo acusar, ou o portão barrar | [`guide/report.md`](guide/report.md) |
| pedirem fundo escuro, cor da casa, fluxo animado ou uma cópia para circular | [`guide/visual.md`](guide/visual.md) |

Os contratos são a fonte da verdade e estão versionados — leia o arquivo, não uma
cópia dele: [`schema.json`](schema.json) (`model@1`, o que o agente escreve),
[`session/schema.json`](session/schema.json) (`session@1`, o que persiste entre
conversas), [`theme/schema.json`](theme/schema.json) (`theme@1`, o vocabulário
fechado de estilo) e [`session/elaboration.schema.json`](session/elaboration.schema.json)
(`elaboration@1`, o delta da fase técnica). Os quatro são varridos por
`tests/check-single-schema.cjs`, e `model@1` e o casaco técnico de `session@1` têm
paridade de campo conferida por `tests/check-technical-parity.cjs` (#37).
