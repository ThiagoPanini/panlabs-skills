# panlabs-aws-diagrams

Skill de diagramas de arquitetura AWS no draw.io: sabatina a necessidade, propõe
arquiteturas candidatas como vista lógica e, aprovada uma, gera a vista técnica
multi-conta por motor determinístico `IR → layout → mxGraph XML`.

> **O documento que um agente lê é [`SKILL.md`](SKILL.md)**, com o [`guia/`](guia/)
> ao lado. Este README é o mapa da árvore, para quem vai mexer no código.

```bash
node motor/gerar.cjs modelo/web-multi-az.json --saida saida/x.drawio
node tools/check-geometria.cjs modelo/web-multi-az.json    # o laudo das 62
node tools/revisar-lacunas.cjs modelo/web-multi-az.json    # a revisão de lacunas
node tools/aprovar.cjs modelo/sessao/varejo-logica.json    # passo 5: aprovar a lógica
node tools/retomar.cjs saida/varejo.drawio --delta modelo/sessao/varejo-elaboracao.json
./tests/rodar.sh                                           # a régua inteira
./tools/instalar.sh                                        # expor nos dois harnesses
./tools/medir-candidatos.sh                                # a medição que escolheu o motor
```

## Instalar

```bash
./tools/instalar.sh              # instala (ou reaponta) os dois links
./tools/instalar.sh --conferir   # só confere
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
| `guia/` | O que o arco revela por ponteiro: sabatina, modelo, context pack, laudo, visual, decisões |
| **`esquema.json`** | **O contrato.** `modelo@1` — o IR que o agente escreve. Na raiz de propósito: é de quem escreve o modelo, e o motor é só o primeiro leitor |
| `motor/` | O pipeline. `gerar` › `validar` › `resolver` › `derivar` › `dispor` › `planejar` › `emitir` › `conferir`, mais o portão de contraste |
| `validador/` | As 62 checagens da rubrica viradas código — 60 no validador obrigatório, 2 no render. É **portão**, não otimizador |
| `tema/` | O vocabulário FECHADO de estilo e os quatro temas. `esquema.json` aqui é `tema@1` |
| `sessao/` | Vista lógica → vista técnica, o `.drawio` como formato de persistência, e a cópia publicável. `esquema.json` aqui é `sessao@1`. `lacunas.cjs` é o vizinho de fora da regra: ele come `modelo@1`, não `sessao@1` — mora aqui porque a revisão de lacunas é passo do arco, e quem a chama é a camada de sessão |
| `catalog/` | 403 service icons + 606 resource icons do draw.io 31.3.1, com o delta de correções escrito à mão |
| `modelo/` | O corpus. `modelo/recusa/` para o que o motor **deve** recusar, `modelo/sessao/` para `sessao@1` |
| `tests/` | A união das suítes, em 8 camadas |
| `agents/` | O empacotamento multi-harness. `openai.yaml` copia a forma das outras 25 skills instaladas em `~/.claude/skills/*/agents/` — `interface.display_name` + `interface.short_description`, e nada mais. É **metadado de vitrine**, não instrução: um harness não-Claude aprende o NOME da skill por aqui e o resto por `SKILL.md`. Se algum harness precisar de mais, é aqui que cresce |
| `tools/` | Os comandos do arco (`aprovar`, `retomar`, `check-geometria`, `revisar-lacunas`, `instalar`) e as ferramentas de bancada — bisseção, render, as medições. `drawio.cjs` é o único lugar que sabe onde o binário mora |
| `saida/` | **Rascunho, e ignorado pelo git.** É onde `tests/rodar.sh` escreve o corpus gerado e o render |
| `docs/` | O registro de engenharia: o critério do corpus e o que ele disse, o que a recertificação mediu, o que o roteamento consertou |

`guia/` é o que o agente lê para **operar** a skill; `docs/` é o que se lê para
saber **o que foi medido**. Um ponteiro leva de um ao outro onde a medição é a
resposta.

### O que NÃO está aqui, e por quê

O que sai da skill é o que **quem instala não usa** — e o teto não é estético: o
limite de upload de uma skill é **30 MB descomprimidos**, o empacotador oficial
leva o diretório inteiro (menos `__pycache__`, `node_modules`, `*.pyc`,
`.DS_Store` e um `evals/` de raiz), e esta árvore chegou a **29 MB**. Estava a
1 MB de não poder ser publicada.

| foi para | o que é |
|---|---|
| [`docs/aws-diagrams/prototipos/`](../../docs/aws-diagrams/prototipos/) | 18 MB, 252 arquivos, um diretório por pergunta respondida — **fonte primária, não produção**. Três cópias do `elk.bundled.js` sozinhas davam 4,8 MB. `tests/check-sem-prototipo.cjs` sempre provou que a produção não alcançava daqui; agora nem no disco |
| [`docs/aws-diagrams/corpus/`](../../docs/aws-diagrams/corpus/) | 6,7 MB do corpus renderizado. Resultado de eval mora **fora** do pacote que o usuário instala — e a régua o reconstrói byte a byte, medido |

Sobraram **4,2 MB**, dos quais 1,6 MB é o `elkjs` embarcado que é a razão de a
skill não precisar de `npm install`.

## Os contratos

| `$id` | esquema | quem escreve |
|---|---|---|
| `panlabs-aws-diagrams/modelo@1` | `esquema.json` | o agente, na sabatina |
| `panlabs-aws-diagrams/tema@1` | `tema/esquema.json` | quem configura a identidade visual |
| `panlabs-aws-diagrams/sessao@1` | `sessao/esquema.json` | a camada de sessão, entre duas conversas |
| `panlabs-aws-diagrams/elaboracao@1` | **não existe** | o agente, na fase técnica |

`tests/check-esquema-unico.cjs` trava três coisas: nenhum `$id` repetido, o
`modelo@1` na raiz, e é **esse** arquivo que o motor abre — medido, não afirmado.

> ⚠️ **O quarto contrato não tem esquema.** `elaboracao@1` é declarado em
> `modelo/sessao/varejo-elaboracao.json` e consumido por `sessao/elaborar.cjs`, e
> nada o valida — a checagem acima varre só os três arquivos de esquema, então um
> contrato sem arquivo passa por baixo dela. A forma está descrita em
> [`guia/modelo.md`](guia/modelo.md); enquanto não houver esquema, essa descrição é
> a única.

## Zero dependência de rede ou de binário em runtime

O `elkjs` vai embarcado em `motor/vendor/` (1,6 MB) e nada mais é carregado de
fora da árvore — `tests/check-sem-prototipo.cjs` mede isso com `require.cache`,
não com grep.

O draw.io headless é **dependência de desenvolvimento**: a camada 7 da suíte
precisa dele e, sem o binário, avisa e segue.

## Onde ler o porquê

[`guia/decisoes.md`](guia/decisoes.md) carrega toda decisão da construção com o
gatilho que a reabre. As duas medições longas estão em
[`docs/recertificacao.md`](docs/recertificacao.md) — o que a união dos motores
mediu, o que caiu e o que sobreviveu — e em [`docs/roteamento.md`](docs/roteamento.md).
