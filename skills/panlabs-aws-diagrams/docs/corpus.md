# O corpus de validação — o critério, escrito antes de rodar

Este arquivo nasce em duas partes e **nesta ordem**, e a ordem é a garantia: o
critério é commitado sozinho, antes de existir corpus novo, antes de existir
gatilho calibrado, antes de qualquer medição de aceitação. O git prova que
nenhum número aqui foi escolhido depois de ver o resultado.

> Ticket [#26](https://github.com/ThiagoPanini/panlabs-skills/issues/26).
> A segunda parte — **o que o corpus disse** — entra abaixo, em commit posterior.

---

# Parte 1 · O critério

## Por que um critério escrito antes

Um corpus sem critério prévio mede o que ele já sabia entregar. Este repositório
já pagou essa conta duas vezes, e as duas estão registradas: o `A4.1` do
[#23](https://github.com/ThiagoPanini/panlabs-skills/issues/23) media **o motor
contra ele mesmo** (limiar 12 px = o `PAD` do próprio motor, 77 ocorrências
reportando exatamente 8), e o [#17](https://github.com/ThiagoPanini/panlabs-skills/issues/17)
tinha 24 checagens estáticas verdes sobre um ícone errado.

Uma checagem que não sabe falhar não é uma checagem. Um corpus que não sabe
reprovar não é um corpus.

## § 1 · O que "aprovado" significa, caso a caso

Um caso do corpus está **aprovado** quando as cinco valem. Nenhuma é opcional, e
nenhuma é julgamento.

| | condição | como se confere |
|---|---|---|
| `C1` | o motor gera, ou **recusa por desenho** | `motor/gerar.cjs` sai 0; os casos de `modelo/recusa/` declaram a recusa esperada e a mensagem que a nomeia |
| `C2` | **nenhuma falha semântica** | `semanticas.length == 0` — `A4.2`, `A4.4`, `A5.5` e `F1`, as quatro de tolerância zero |
| `C3` | **o laudo está completo** | as 8 famílias rodaram. Um laudo incompleto nunca passa, em nenhum nível — a garantia do [#18](https://github.com/ThiagoPanini/panlabs-skills/issues/18) que o enxerto do #23 já engoliu uma vez |
| `C4` | **toda falha fora do piso está nomeada** | o piso está em `guia/laudo.md`; qualquer falha além dele precisa de entrada escrita no §5 deste arquivo, com motivo. Falha não nomeada = caso reprovado |
| `C5` | **determinismo** | duas gerações do mesmo modelo saem byte a byte idênticas |

**`C4` é o que faz o corpus medir alguma coisa.** Sem ele, "tem falha" é o estado
natural — os modelos do corpus têm de 4 a 9 falhas cada um — e a régua não
distingue nada. Com ele, cada falha ou está no piso conhecido ou tem dono.

## § 2 · O piso — o que NÃO conta contra o caso

Herdado de `guia/laudo.md`, medido nos 15 modelos que já existiam. Repetido aqui
porque um critério que aponta para outro arquivo é um critério que se afrouxa
sozinho.

| | por quê |
|---|---|
| `A1.2` `A1.3` | nenhum diagrama emite legenda — o motor não tem legenda |
| `A1.11` | `modelo@1` é `additionalProperties: false` e não tem `data`/`versao`/`autor` |
| `A1.5` `A1.12` | sempre que houver nota com `sobre` — as duas checagens não conhecem a classe "nota desenhada" |
| `A7.2` | o quadrado do ícone contra o tingimento de subnet, 2,71:1 — leitura de **traço** aqui, de **área** no portão do tema |
| `A7.4` `A3.9` | `calibravel`, limiar default de engenharia |
| `A4.5` | padding de grupo uniforme |
| `A3.7` | o caminho da grade dimensiona a largura só pela nuvem |
| `A5.7` | avisa de propósito desde o [#24](https://github.com/ThiagoPanini/panlabs-skills/issues/24): o eixo segue o dado, e a seta da consulta aponta para trás — que é o que ela é |

Tudo o mais é `C4`.

## § 3 · A cobertura de gênero — e o que cada gênero tem de EXERCITAR

Cobertura **não** é um arquivo por gênero. É um arquivo por gênero que põe sob
carga o mecanismo que aquele gênero implica — senão o corpus tem sete rótulos e
um caminho de código.

| | gênero | o mecanismo que o caso tem de exercitar |
|---|---|---|
| `L1` | blocos lógicos / capacidades | vista lógica **sem passo numerado** — o regime em que `eixoDaGrade` devolve `coluna`, e agrupamento por fronteira de responsabilidade |
| `L2` | fluxo de dados lógico | vista lógica **com** `ordem` — `eixoDaGrade` devolve `raia` sem nenhuma AZ envolvida |
| `T1` | referência com consciência de rede | árvore `nuvem › vpc › subnet` + a dimensão `az`, com o caminho da **grade** (não o do ELK) |
| `T2` | pipeline de dados | cadeia de ≥4 serviços gerenciados **fora de VPC** — o caminho do **ELK**, e a categoria AWS decidindo camada onde não há subnet |
| `T3` | event-driven / serverless | **leque assíncrono**: uma origem de evento para ≥2 consumidores, com fila morta declarada em um e ausente em outro |
| `T4` | fluxo de requisição numerado | `ordem` em toda aresta **e** faixa de AZ na mesma página — os dois disputando a horizontal (#21) |
| `T5` | multi-account | os **dois** modos derivados do #12 — integração (travessia desenhada) e inventário (`E1` suprime) — e a faixa de OU |

Além dos gêneros, um eixo que não é gênero nenhum e sem o qual a calibração 1
não tem o que medir:

| | o que o corpus precisa ter |
|---|---|
| **densidade do leque** | modelos cujo grafo de travessia entre zonas **não cabe numa reta** — o caso em que nenhuma permutação de raia zera o `A5.5` |

## § 4 · As duas calibrações — o que conta como resposta

A parte nova do ticket. Escrever aqui o que conta como resposta é o que impede a
resposta de ser desenhada em volta do resultado.

### 4.1 · O gatilho da vista de zona de referência (#21)

O [#21](https://github.com/ThiagoPanini/panlabs-skills/issues/21) decidiu que
apagar a aresta que cruza zona — a saída do [#6](https://github.com/ThiagoPanini/panlabs-skills/issues/6)
aplicada à zona — é **fallback, não default**, e que o disparo tem de vir do
**validador**, não de constante mágica. Ficou pendente *qual checagem e qual
limiar*.

**Conta como resposta** quando as quatro valem:

| | |
|---|---|
| `Z1` | a checagem é uma que o validador **já calcula** — não uma métrica nova inventada para este gatilho |
| `Z2` | o limiar é **derivado**, não escolhido: ou é a tolerância que a própria rubrica já fixa para aquela checagem, ou tem medição do corpus por trás |
| `Z3` | existe caso do corpus em que o gatilho **dispara** e caso em que **não dispara**, e a diferença entre os dois é a densidade do leque — não uma flag no modelo |
| `Z4` | quando dispara, a supressão é **dita**, não silenciosa — o motor recusa mentir por ausência em todo o resto, e não pode abrir exceção aqui |

**Conta como NÃO ter respondido:**

- o gatilho nunca dispara no corpus — aí ele é infalsificável, e o honesto é
  registrá-lo como névoa nomeada em vez de embarcá-lo como calibrado;
- o gatilho dispara sobre um desenho que já era verdadeiro — um fallback que
  dispara sem precisar é um fallback que **apaga aresta verdadeira**, e isso é
  pior que o cruzamento que ele evita.

### 4.2 · Os limiares da revisão de lacunas (#15)

A política está decidida no [#15](https://github.com/ThiagoPanini/panlabs-skills/issues/15):
bloqueia **em bloco, uma vez só**, relata e nunca conserta calado. O que ficou
pendente é o limiar — as regras do protótipo dispararam **4 achados num modelo de
3 nós**.

**Conta como resposta** quando as quatro valem:

| | |
|---|---|
| `L1` | toda regra tem **pré-condição escrita**: o modelo afirma a estrutura sobre a qual a regra fala. Onde o modelo não afirma, a regra é **muda** — e quem cala não vota (#22) |
| `L2` | toda regra **dispara em ≥1 modelo do corpus** — regra que nunca dispara nunca foi testada |
| `L3` | toda regra é **muda em ≥1 modelo do corpus** — regra que dispara em todos não está medindo nada, está afirmando uma constante |
| `L4` | nenhum modelo do corpus produz mais achados que **⌈nós ÷ 4⌉** |

`L2` e `L3` juntos são o guarda: uma regra tem de saber dizer sim e saber dizer
não, contra o mesmo corpus. É a forma da lição do #23 — *a checagem que não sabe
falhar não é uma checagem* — aplicada à outra ponta.

`L4` é o teto, e o número sai do próprio ticket: o protótipo fez **1,33 achado por
nó**. Um a cada quatro nós é uma ordem de grandeza abaixo, e é o que separa
"consultor que aponta o que importa" de "linter que o usuário aprende a ignorar".

> **Se o teto não for atingível, o critério não se ajusta.** A razão vira achado
> registrado, e a regra que estoura vira refino conhecido (premissa 12 do mapa).
> Baixar a régua depois de ver o número é exatamente o que este arquivo existe
> para impedir.

## § 5 · O arco ponta a ponta

O ticket pede a skill rodando *necessidade vaga → sabatina → candidatas →
aprovação da vista lógica → vista técnica → `.drawio`*.

| | condição |
|---|---|
| `E1` | o arco roda contra um caso que **não existia antes deste ticket** — validar o arco contra a própria fixture dele não mede nada |
| `E2` | cada um dos 7 passos do `SKILL.md` fecha na condição escrita **dele**, e não em julgamento |
| `E3` | `conferir(aprovado).ok` é verdadeiro depois de a fase técnica ter enfiado VPC e subnet entre a folha e a fronteira |
| `E4` | o `.drawio` final passa em `--portao veracidade` |
| `E5` | a cópia publicada existe e o selo dela diz que **não retoma** |

## § 6 · A instalação

| | condição |
|---|---|
| `I1` | `~/.claude/skills/panlabs-aws-diagrams` e `~/.agents/skills/panlabs-aws-diagrams` resolvem para a skill deste repo |
| `I2` | `agents/openai.yaml` existe e segue a forma que os outros skills da casa usam |
| `I3` | um comando da skill roda **a partir do caminho instalado**, não do repo — é o que prova que a premissa 7 sobreviveu |

## § 7 · O que este critério NÃO promete

Nomeado agora, para não virar surpresa depois:

- **não** promete que o corpus é representativo de arquitetura de produção — ele
  é sintético, escrito por quem escreveu o motor, e a premissa 12 do mapa já diz
  que a rubrica se refina **depois** das primeiras execuções reais;
- **não** promete inspeção visual de todo caso novo — o render é dependência de
  desenvolvimento (premissa 8), e o corpus tem caso de 24 checagens estáticas
  verdes com o ícone errado. Onde o olho não passou, isto fica dito;
- **não** promete que os cinco eixos de forma da sabatina são os certos — o #15
  já registrou que cinco *bastaram*, não que cinco *são*.
