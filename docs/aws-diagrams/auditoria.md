# A auditoria de 2026-08-23 — o que foi medido, o que mudou, o que sobrou

Relatório visual com os seis diagramas embutidos:
**<https://claude.ai/code/artifact/512b8393-aea6-4d86-8be3-492ff401026a>**

A skill funciona. O que ela não tinha era alguém olhando de fora, e a régua desta
auditoria não foi gosto: foi a **especificação aberta de Agent Skills**
([agentskills.io/specification](https://agentskills.io/specification)) e o
**empacotador oficial** (`skill-creator/scripts/package_skill.py`).

## O placar

| | antes | depois |
|---|---|---|
| tamanho do pacote | **29 MB — 97% do teto de 30 MB** | 3,8 MB · 12% |
| arquivos que o pacote leva | 451 | 156 |
| passos do arco sem comando | 2 de 7 | 0 |
| campos de `modelo@1` inalcançáveis pelo arco | 3 | 0 |
| trabalho terminado fora da `main` | 9 commits, 29 arquivos | 0 |
| a régua | verde (8 camadas) | verde (8 camadas, 620 ✓) |

## O que a auditoria achou

### 1 · Nove commits nunca chegaram na `main`

O mapa ([#1](https://github.com/ThiagoPanini/panlabs-skills/issues/1)) declarava o
destino alcançado citando `tools/instalar.sh --conferir`, `agents/openai.yaml` e o
corpus de 20 modelos. Nada disso estava na `main`: o PR #28 mergeou o estado das
19h27 e a branch `skill/q25` seguiu até 20h58 com o ticket
[#26](https://github.com/ThiagoPanini/panlabs-skills/issues/26) inteiro.

Entre os 29 arquivos órfãos estava **`docs/corpus.md`** — o único registro
end-to-end que a skill tinha, invisível para quem olhasse a `main`. Isso explica
literalmente a queixa que abriu a auditoria.

### 2 · Dois dos sete passos mandavam gravar `.cjs` na raiz da skill

A camada de sessão não tinha CLI. O `SKILL.md` trazia dois blocos de ~20 linhas de
JavaScript com *"grave o driver abaixo como `aprovar.cjs` na raiz da skill"*.

| quebrava porque | |
|---|---|
| o diretório acumulava um arquivo por sessão | é a queixa que abriu esta auditoria, **causada pela própria skill** |
| skill instalada é frequentemente só-leitura | a doc oficial de autoria diz isso em voz alta |
| 20 linhas reescritas por sessão | *"prefer scripts for deterministic operations: write `validate_form.py` rather than asking Claude to generate validation code"* |

Viraram `tools/aprovar.cjs` e `tools/retomar.cjs`. O `SKILL.md` perdeu 50 linhas de
JS e ganhou duas de comando. De brinde, `--candidata` deixou de ser obrigatório: o
dossiê já carrega qual venceu (`estado: "escolhida"`, marcado no passo 3), e pedir
de volta o que se recebeu era ruído.

### 3 · A árvore estava a 1 MB do teto, e ninguém media

O limite é **30 MB descomprimidos** e o empacotador leva o diretório inteiro menos
`__pycache__`, `node_modules`, `*.pyc`, `.DS_Store` e um `evals/` de raiz.

| saiu | tamanho | por quê |
|---|---|---|
| `prototypes/` | 18 MB, 252 arquivos | o próprio README dizia *"fonte primária, não produção"*, com `check-sem-prototipo.cjs` provando por `require.cache` que a produção não alcança de lá. Três cópias do `elk.bundled.js` davam 4,8 MB |
| `saida/` | 6,7 MB, 51 arquivos | resultado de eval mora em workspace irmão. A régua o reconstrói **byte a byte**, medido |
| `skills/panlabs-aws-diagrams/skills/…/docs/` | — | diretório aninhado vazio espelhando o caminho da própria skill |

O teto deixou de ser fé: **`tools/empacotar.sh --conferir`** mede, e a camada 0 da
régua o roda. Ele também acusa a armadilha que custou o ticket — **`.gitignore` não
protege o pacote**. Com a suíte recém-rodada, o pacote pesava 11,6 MB, 7,9 deles de
render que o git não vê.

### 4 · Três campos existiam num contrato e não no outro

`qualificador`, `ou` e `habilita` viviam em `modelo@1` e não em `sessao@1`. Quem
escrevia o modelo direto tinha os três; quem passava pelo **arco de duas vistas** —
o caminho principal do `SKILL.md` — perdia os três sem erro nenhum.

`ou` era o mais caro: é a unidade organizacional da conta, e sem ele **as duas
bandeiras da skill não se combinavam** — multi-conta pelo arco não conseguia
declarar OU nenhuma. O caso do banco digital bateu nisso na primeira tentativa.

## Os cinco defeitos de motor

Todos saíram de rodar caso novo, nenhum de ler código. Quatro dos cinco foram
achados **pelo próprio validador da skill**.

| | ticket | quem achou |
|---|---|---|
| a grade recusa todo nó fora da VPC — CDN+WAF na frente de VPC multi-AZ não desenha | [#30](https://github.com/ThiagoPanini/panlabs-skills/issues/30) | o motor, recusando alto |
| faixa na grade engole não-membro: o Auto Scaling group entre duas AZs mente | [#31](https://github.com/ThiagoPanini/panlabs-skills/issues/31) | o validador (`F1`) + o portão |
| `A5.5` para ator fora de todas as contas | [#32](https://github.com/ThiagoPanini/panlabs-skills/issues/32) | o validador (`A5.5`) + o portão |
| `qualificador` vaza a célula de 120 px e nenhuma checagem mede | [#33](https://github.com/ThiagoPanini/panlabs-skills/issues/33) | **o olho, olhando o PNG** |
| o motor diz que desenha faixa de OU e não desenha | [#34](https://github.com/ThiagoPanini/panlabs-skills/issues/34) | comparar o aviso com o XML |

O [#30](https://github.com/ThiagoPanini/panlabs-skills/issues/30) é o mais caro: a
arquitetura de referência mais copiada da AWS não pode ser desenhada. Os cinco
modelos multi-AZ do corpus são VPC pura — o ponto cego é exato, porque todos foram
escritos já cabendo na restrição.

O [#33](https://github.com/ThiagoPanini/panlabs-skills/issues/33) é a lição que o
`SKILL.md` já registrava e que se confirmou de novo: *"nenhum dos dois substitui
olhar o PNG"*. As 62 checagens reportam **as mesmas 11 falhas** com o
`qualificador` ligado e desligado, enquanto o texto sai da página.

## A bateria

Seis arquiteturas novas, nenhuma fixture. Índice, prosa, modelos, `.drawio`, PNG e
laudo em [`casos/`](casos/).

Cobrem `L1`, `L2`, `T1`, `T3`, `T4` e `T5` nos dois modos, e os três caminhos de
layout. Dois deles rodam o arco inteiro. **A guarda de aprovação foi testada por
acidente**: no caso dos silos o delta técnico trazia uma nota que também entra na
vista lógica, e o passo 6 saiu com código 2 — *"a elaboração técnica mudou o que foi
aprovado"*. Erro meu, e a skill pegou.

## Onde a skill está no campo

Oito ferramentas levantadas em fonte primária. O sinal mais forte: a AWS
**depreciou** seu `aws-diagram-mcp-server` em abril/2026 e apontou para uma agent
skill que gera draw.io com hook validador. A aposta desta skill — draw.io editável,
motor determinístico, validação mecanizada — é para onde o campo foi.

**Duas lacunas do campo inteiro ela preenche sozinha:** ninguém faz multi-conta (nem
a AWS), e ninguém sabatina até fechar — todos assumem a arquitetura pronta no prompt,
e nenhum propõe candidatas para o humano escolher. A fronteira *"o agente escreve o
QUE, o motor calcula ONDE"* não existe em nenhum outro lugar: no concorrente mais
forte o agente ainda escreve as coordenadas, e cinco corretores as empurram depois.

O preço é o tamanho — o campo fica entre 4 e 29 arquivos e esta skill tem 156. É
defensável pelo motor e pelo validador, mas é o argumento que vai ser cobrado. Antes
desta limpeza eram 451.
