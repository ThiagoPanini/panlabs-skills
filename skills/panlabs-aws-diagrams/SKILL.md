---
name: panlabs-aws-diagrams
description: Desenha arquitetura AWS em draw.io — sabatina a necessidade até a completude fechar, propõe arquiteturas candidatas como vista lógica e, aprovada uma, gera a vista técnica multi-conta por motor determinístico com validador geométrico. Use ao pedir, desenhar ou revisar um diagrama AWS; ao escolher entre arquiteturas antes de desenhar; e ao retomar um `.drawio` gerado numa sessão anterior.
---

# panlabs-aws-diagrams

> **O agente escreve o QUE existe. O motor calcula ONDE fica.**

A **fronteira** não é disciplina, é gramática: `esquema.json` não tem nenhuma
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
| um `.drawio` de sessão anterior | `node tools/sessao2.cjs <arquivo>` |
| um modelo já escrito (`modelo@1`) | `node motor/gerar.cjs <modelo.json> --saida x.drawio` — e pare aqui, o arco acabou |

**Fecha quando** a porta certa foi acionada: na segunda, o **briefing** já está
impresso. Ele devolve o acordo, as candidatas descartadas com o motivo, os achados
recusados e o estacionamento — **nada disso se pergunta de novo ao usuário**.

O briefing também classifica cada página em `intacto`, `remanejado` ou
`divergente`. Regerar por cima de uma página `remanejado` joga fora ajuste manual;
`divergente` bloqueia. Ver [`guia/modelo.md`](guia/modelo.md).

### 2 · Sabatina até a completude fechar

Rodadas inteiras de uma vez, cada pergunta numerada e com recomendação. Só os
**cinco eixos de forma**; sonda condicional entra destravada por uma resposta.

> **A checagem que falha é a próxima pergunta.**

```bash
node tools/check-geometria.cjs <modelo-em-construcao.json>
```

**Fecha quando** `A1` chega ao **piso** — e o piso tem nome: `A1.2`, `A1.3` e
`A1.11` sempre (dívida de motor e de esquema, medida em 35 de 35 páginas do
corpus), mais `A1.5` e `A1.12` assim que qualquer nota tiver `sobre`. Toda outra
entrada de `A1` que aparecer é uma pergunta a fazer.

[`guia/sabatina.md`](guia/sabatina.md) traz o protocolo inteiro — eixos,
procedência, estacionamento, material de entrada — e o comando que projeta um
`sessao@1` para `modelo@1`, que é o que a checagem come.

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
node tools/revisar-lacunas.cjs <modelo.json>
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

A camada de sessão **não tem CLI** — grave o driver abaixo como `aprovar.cjs` na
raiz da skill e rode `node aprovar.cjs`. É o passo do arco em que você escreve
código; `tools/sessao1.cjs` é o mesmo driver com os valores fixos, e a suíte o
mantém verde.

```js
const fs = require('fs');
const { validar } = require('./sessao/validar.cjs');
const { aprovar, conferir } = require('./sessao/acordo.cjs');
const { desenhar } = require('./sessao/desenhar.cjs');

(async () => {
  const sessao = JSON.parse(fs.readFileSync('modelo/sessao/<caso>-logica.json', 'utf8'));

  const v = validar(sessao);
  v.avisos.forEach(a => console.log('⚠', a));
  if (!v.ok) { v.erros.forEach(e => console.error('·', e)); process.exit(1); }

  const aprovado = aprovar(sessao, { em: '<AAAA-MM-DD>', por: '<quem>', candidata: '<id>' });
  if (!conferir(aprovado).ok) { console.error('· o acordo não confere'); process.exit(1); }

  const r = await desenhar(aprovado, 'logica');   // projetar › gerar › selar
  r.relatorio.avisos.forEach(a => console.log('⚠', a));
  fs.writeFileSync('saida/<caso>.drawio', r.xml);
  console.log(`→ saida/<caso>.drawio (${r.xml.length} bytes, caminho "${r.caminho}")`);
})();
```

**Fecha quando** `conferir(aprovado).ok` é verdadeiro e o `.drawio` está gravado.
O arquivo carrega o modelo, o dossiê, o acordo e as duas impressões do desenho —
**nada do que foi decidido depende de você lembrar**.

### 6 · Elabore a vista técnica e desenhe as duas

O estacionamento volta agora: os nomes de serviço ditos cedo demais reaparecem
como **sugestão inferida** contra a capacidade correspondente, para confirmar.

A fase técnica **não reescreve o modelo aprovado** — ela aplica um **delta de
elaboração** (`elaboracao@1`) sobre o que veio de dentro do `.drawio`. Nenhum campo
do delta alcança um casaco lógico, e `elaborar` recusa se você tentar: a fase
técnica não inventa capacidade. A forma do delta está em
[`guia/modelo.md`](guia/modelo.md); o exemplo do corpus é
`modelo/sessao/varejo-elaboracao.json`.

Resolva todo nome pelo catálogo **antes** de escrevê-lo no delta:

```bash
node catalog/aws-shapes.cjs "kinesis data firehose" opensearch "availability zone"
```

Grave como `elaborar.cjs` na raiz da skill.
`tools/sessao2.cjs` é este mesmo driver com o delta fixo, e a suíte o mantém verde.

```js
const fs = require('fs');
const { abrir } = require('./sessao/abrir.cjs');
const { elaborar } = require('./sessao/elaborar.cjs');
const { validar } = require('./sessao/validar.cjs');
const { conferir } = require('./sessao/acordo.cjs');
const { desenhar } = require('./sessao/desenhar.cjs');
const { costurar } = require('./sessao/gravar.cjs');

(async () => {
  const aberto = abrir(fs.readFileSync('saida/<caso>.drawio', 'utf8'));
  if (!aberto.nosso) { console.error('·', aberto.porque); process.exit(1); }

  const delta = JSON.parse(fs.readFileSync('modelo/sessao/<caso>-elaboracao.json', 'utf8'));
  const tecnico = elaborar(aberto.sessao, delta);

  const v = validar(tecnico);
  if (!v.ok) { v.erros.forEach(e => console.error('·', e)); process.exit(1); }

  const d = conferir(tecnico);
  if (!d.ok) {                     // mudou o que foi aprovado: exige aprovação nova
    d.diferencas.forEach(x => console.error('·', x.texto));
    process.exit(2);
  }

  const rl = await desenhar(tecnico, 'logica');
  const rt = await desenhar(tecnico, 'tecnica');
  rt.relatorio.avisos.forEach(a => console.log('⚠', a));
  fs.writeFileSync('saida/<caso>.drawio', costurar([rl.xml, rt.xml]));
})();
```

**Fecha quando** as duas condições valem:

- `conferir()` continua `ok` — a projeção lógica de hoje ainda é byte a byte a
  aprovada, mesmo depois de a fase técnica ter enfiado VPC e subnet entre a folha
  e a fronteira;
- `node motor/gerar.cjs <modelo> --portao veracidade` passa — nenhuma falha
  semântica, isto é, o desenho não afirma fronteira de rede que o modelo nega.

### 7 · Publique a cópia que circula

O arquivo que retoma e o arquivo que circula **não são o mesmo arquivo**. O de
trabalho carrega a deliberação — candidatas descartadas com o motivo, achados que
o time recusou, fala de reunião, quem aprovou —, tudo legível em *Extras › Editar
diagrama*.

```bash
node sessao/publicar.cjs saida/<caso>.drawio --saida saida/<caso>.publicado.drawio
```

**Fecha quando** o selo da cópia diz `publicado@1` e o comando reporta quantos
itens de deliberação podou. Sai o que é sobre **pessoas** e sobre **caminhos não
tomados**; fica o que é sobre a arquitetura desenhada.

## Os comandos

| | |
|---|---|
| `node motor/gerar.cjs <m.json> --saida x.drawio` | desenha. `--tema claro\|escuro\|corporativo` · `--fluxo solido\|tracejado\|animado` · `--portao nenhum\|veracidade\|falha\|estrito` · `--explicar` |
| `node tools/check-geometria.cjs <m.json>` | o laudo das 62 checagens. `--exemplos` roda o corpus, `--json` para ler no código |
| `node tools/revisar-lacunas.cjs <m.json>` | a revisão de lacunas do passo 4. `--corpus` roda a régua inteira |
| `node catalog/aws-shapes.cjs <nome>...` | resolve nome → shape, com as correções aplicadas |
| `node tools/sessao2.cjs <arq.drawio>` | retoma: reconhece o arquivo, classifica as páginas e imprime o briefing. A elaboração dele é a do corpus — para outro caso, use o driver do passo 6 |
| `node sessao/publicar.cjs <arq.drawio>` | a cópia que sai de casa |
| `./tests/rodar.sh` | a régua inteira, em 8 camadas |

`--explicar` é a trilha de auditoria: mostra como cada nome caiu no catálogo, de
onde saiu a camada de rede de cada subnet, e o laudo geométrico página a página.
É a primeira coisa a rodar quando o desenho saiu diferente do esperado.

## O que o motor recusa, e por quê

Recusa alto em vez de desenhar errado. Toda recusa vem com a lista do que
consertar.

| recusa | porque |
|---|---|
| modelo fora do esquema | o contrato é o contrato — e a mensagem sugere o vizinho (`"dentroo"` → *você quis dizer "dentro"?*) |
| XML mal formado | o draw.io renderiza **truncado com código 0**. O renderizador não reclama, então quem reclama é o gerador |
| tema que reprova no contraste | rótulo que some não dá erro em lugar nenhum. `--forcar` gera assim mesmo, para o estrago poder ser visto |
| subnet sem camada de rede, no caminho da grade | a ordem das linhas **é** o desenho, e ordem inventada põe a camada de dados em cima |
| nó que o caminho da grade não modela | omitir em silêncio é o diagrama que mente por ausência |
| laudo incompleto, em qualquer nível de portão | se uma família de checagem parou de rodar, o verde não quer dizer nada |

Recusa é **para o agente, não para o humano**: é ida e volta de máquina, não uma
pergunta nova na sabatina.

## A régua

`./tests/rodar.sh` — 8 camadas. As sete primeiras rodam em qualquer máquina; só o
render precisa do draw.io headless e, sem o binário, avisa e segue. O render é
dependência de **desenvolvimento**; a skill publicada não carrega nenhuma.

Uma suíte verde sobre a semântica **não substitui** o portão sobre a geometria, e
nenhum dos dois substitui olhar o PNG — o corpus tem caso de 24 checagens
estáticas verdes com o ícone errado no desenho.

## Onde está o resto

| leia quando | |
|---|---|
| for perguntar ao usuário, propor candidatas ou revisar lacunas | [`guia/sabatina.md`](guia/sabatina.md) |
| for escrever ou corrigir um modelo, e o esquema não bastar | [`guia/modelo.md`](guia/modelo.md) |
| a empresa tiver premissas de arquitetura, ou não tiver | [`guia/context-pack.md`](guia/context-pack.md) |
| o laudo acusar, ou o portão barrar | [`guia/laudo.md`](guia/laudo.md) |
| pedirem fundo escuro, cor da casa, fluxo animado ou uma cópia para circular | [`guia/visual.md`](guia/visual.md) |
| for mudar uma regra, ou quiser saber por que ela é assim | [`guia/decisoes.md`](guia/decisoes.md) |

Os contratos são a fonte da verdade e estão versionados — leia o arquivo, não uma
cópia dele: [`esquema.json`](esquema.json) (`modelo@1`, o que o agente escreve),
[`sessao/esquema.json`](sessao/esquema.json) (`sessao@1`, o que persiste entre
conversas) e [`tema/esquema.json`](tema/esquema.json) (`tema@1`, o vocabulário
fechado de estilo). O quarto — `elaboracao@1`, o delta da fase técnica — **não tem
arquivo de esquema**, e a única descrição da forma dele está em
[`guia/modelo.md`](guia/modelo.md).
