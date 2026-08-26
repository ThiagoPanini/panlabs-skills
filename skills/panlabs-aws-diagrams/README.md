# panlabs-aws-diagrams

Skill de diagramas de arquitetura AWS no draw.io: sabatina a necessidade, propõe
arquiteturas candidatas como vista lógica e, aprovada uma, gera a vista técnica
multi-conta por motor determinístico `IR → layout → mxGraph XML`.

> **O documento que um agente lê é [`SKILL.md`](SKILL.md)**, com o [`guide/`](guide/)
> ao lado. Este README é o mapa da árvore, para quem vai mexer no código.

```bash
node engine/generate.cjs models/web-multi-az.json --output output/x.drawio
node tools/check-geometry.cjs models/web-multi-az.json    # o laudo das 62
node tools/review-gaps.cjs models/web-multi-az.json    # a revisão de lacunas
node tools/approve.cjs models/session/retail-logical.json    # passo 5: aprovar a lógica
node tools/resume.cjs output/retail.drawio --delta models/session/retail-elaboration.json
./tests/run.sh                                           # a régua inteira
./tools/install.sh                                        # expor nos dois harnesses
./tools/package.sh --check                            # o pacote cabe nos 30 MB?
./tools/measure-candidates.sh                                # a medição que escolheu o motor
```

## Instalar

```bash
./tools/install.sh              # instala (ou reaponta) os dois links
./tools/install.sh --check   # só confere
```

Instalar é **apontar, não copiar** — a skill instalada é sempre a que está no
repositório, em vez de uma fotografia dela que envelhece em silêncio.

```
~/.agents/skills/panlabs-aws-diagrams   → o repositório (link absoluto)
~/.claude/skills/panlabs-aws-diagrams   → ../../.agents/skills/panlabs-aws-diagrams
```

O script **recusa apontar para um worktree**: `.claude/worktrees/` é apagado
junto com a sessão que o criou, e um link para lá funciona hoje e some amanhã sem
avisar. Rodando de dentro de um, ele resolve o checkout principal pelo
`--git-common-dir` e diz em voz alta que fez isso.

E ele não acredita em si mesmo: no fim, roda um comando da skill **a partir de
cada caminho instalado**, que é o que prova a premissa 7 (auto-contida, nada além
do Node).

## A árvore

| | |
|---|---|
| **`SKILL.md`** | **O documento.** O arco em sete passos, cada um com critério de parada checável |
| `guide/` | O que o arco revela por ponteiro: sabatina, modelo, context pack, laudo, visual |
| **`schema.json`** | **O contrato.** `model@1` — o IR que o agente escreve. Na raiz de propósito: é de quem escreve o modelo, e o motor é só o primeiro leitor |
| `engine/` | O pipeline. `gerar` › `validar` › `resolver` › `derivar` › `dispor` › `planejar` › `emitir` › `conferir`, mais o portão de contraste |
| `validator/` | As 62 checagens da rubrica viradas código — 60 no validador obrigatório, 2 no render. É **portão**, não otimizador |
| `theme/` | O vocabulário FECHADO de estilo e os quatro temas. `schema.json` aqui é `theme@1` |
| `session/` | Vista lógica → vista técnica, o `.drawio` como formato de persistência, e a cópia publicável. `schema.json` aqui é `session@1`. `gaps.cjs` é o vizinho de fora da regra: ele come `model@1`, não `session@1` — mora aqui porque a revisão de lacunas é passo do arco, e quem a chama é a camada de sessão |
| `catalog/` | 403 service icons + 606 resource icons do draw.io 31.3.1, com o delta de correções escrito à mão |
| `models/` | O corpus. `models/recusa/` para o que o motor **deve** recusar, `models/session/` para `session@1` |
| `tests/` | A união das suítes, em 8 camadas |
| `agents/` | O empacotamento multi-harness. `openai.yaml` copia a forma das outras 25 skills instaladas em `~/.claude/skills/*/agents/` — `interface.display_name` + `interface.short_description`, e nada mais. É **metadado de vitrine**, não instrução: um harness não-Claude aprende o NOME da skill por aqui e o resto por `SKILL.md`. Se algum harness precisar de mais, é aqui que cresce |
| `tools/` | Os comandos do arco (`aprovar`, `retomar`, `check-geometria`, `revisar-lacunas`, `instalar`) e as ferramentas de bancada — bisseção, render, as medições. `drawio.cjs` é o único lugar que sabe onde o binário mora |
| `output/` | **Rascunho, e ignorado pelo git.** É onde `tests/run.sh` escreve o corpus gerado e o render |

`guide/` é o que o agente lê para **operar** a skill — nada aqui se lê para
modificá-la, e nada daqui aponta para fora da árvore.

### O que NÃO está aqui, e por quê

O que sai da skill é o que **quem instala não usa** — e o teto não é estético: o
limite de upload de uma skill é **30 MB descomprimidos**, o empacotador oficial
leva o diretório inteiro (menos `__pycache__`, `node_modules`, `*.pyc`,
`.DS_Store` e um `evals/` de raiz), e esta árvore chegou a **29 MB**. Estava a
1 MB de não poder ser publicada.

| o que era | o que aconteceu |
|---|---|
| os protótipos | 18 MB, 252 arquivos, um diretório por pergunta respondida. Saíram da árvore no #29 e foram **apagados no #62**: um único commit na vida deles, o próprio `git mv`. `tests/check-no-prototype.cjs` sempre provou que a produção não os alcançava; agora nem existem |
| o corpus renderizado | 6,7 MB de `.drawio` e PNG commitados. Também **apagados no #62**, e a medição que decidiu foi esta: 4 de 4 modelos regenerados divergiam do commitado, e nada na régua os comparava. `tests/run.sh` escreve em `output/` e nunca leu aquele diretório — não era fixture, era foto vencida |
| os casos de uso | 3,2 MB de prosa, modelo, desenho e laudo. Idem, com a mesma medição. Os defeitos que eles acharam já eram ticket e os repros já tinham sido promovidos para `models/`. A tabela de cobertura sobreviveu, na auditoria do registro |

O git guarda os três, e o #62 registra os endereços. **Nada aqui aponta para lá** —
é a direção que o #46 exige, e a razão de a lista congelada do
`tests/check-single-schema.cjs` ter substituído uma leitura do git que subia dois
níveis acima da raiz da skill.

Sobraram **156 arquivos e 3,4 MB** — 11% do teto, medido por
`tools/package.sh --check` —, dos quais 1,6 MB é o `elkjs` embarcado que é a
razão de a skill não precisar de `npm install`.

E o teto deixou de ser a razão de qualquer coisa sair. A 11% ele não aperta mais
ninguém; o que ainda manda material para fora é a **carga de leitura**, e o
critério do #45 é o executável: *"o agente lê ou roda isto para executar a
skill?"*.

E o teto deixou de ser fé: `tools/package.sh --check` mede, e a camada 0 da
régua o roda. Ele também acusa a armadilha que custou este ticket — **`.gitignore`
não protege o pacote**. O empacotador oficial varre o diretório e exclui exatamente
`__pycache__`, `node_modules`, `*.pyc`, `.DS_Store` e um `evals/` de raiz; um
`output/` cheio de render sobe junto mesmo o git ignorando.

## Os contratos

| `$id` | esquema | quem escreve |
|---|---|---|
| `panlabs-aws-diagrams/model@1` | `schema.json` | o agente, na sabatina |
| `panlabs-aws-diagrams/theme@1` | `theme/schema.json` | quem configura a identidade visual |
| `panlabs-aws-diagrams/session@1` | `session/schema.json` | a camada de sessão, entre duas conversas |
| `panlabs-aws-diagrams/elaboration@1` | **não existe** | o agente, na fase técnica |

`tests/check-single-schema.cjs` trava três coisas: nenhum `$id` repetido, o
`model@1` na raiz, e é **esse** arquivo que o motor abre — medido, não afirmado.

> ⚠️ **O quarto contrato não tem esquema.** `elaboration@1` é declarado em
> `models/session/retail-elaboration.json` e consumido por `session/elaborate.cjs`, e
> nada o valida — a checagem acima varre só os três arquivos de esquema, então um
> contrato sem arquivo passa por baixo dela. A forma está descrita em
> [`guide/model.md`](guide/model.md); enquanto não houver esquema, essa descrição é
> a única.

## Zero dependência de rede ou de binário em runtime

O `elkjs` vai embarcado em `engine/vendor/` (1,6 MB) e nada mais é carregado de
fora da árvore — `tests/check-no-prototype.cjs` mede isso com `require.cache`,
não com grep.

O draw.io headless é **dependência de desenvolvimento**: a camada 7 da suíte
precisa dele e, sem o binário, avisa e segue.

O registro de engenharia — decisões da construção, corpus, recertificação e
roteamento — mora no workspace irmão, fora desta árvore: quem instala a skill
não paga por ele, e nada aqui dentro aponta de volta para lá.
