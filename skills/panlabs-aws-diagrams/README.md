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
node tools/sessao2.cjs saida/varejo.drawio                 # retomar uma sessão
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
| `sessao/` | Vista lógica → vista técnica, o `.drawio` como formato de persistência, e a cópia publicável. `esquema.json` aqui é `sessao@1` |
| `catalog/` | 403 service icons + 606 resource icons do draw.io 31.3.1, com o delta de correções escrito à mão |
| `modelo/` | O corpus. `modelo/recusa/` para o que o motor **deve** recusar, `modelo/sessao/` para `sessao@1` |
| `tests/` | A união das suítes, em 8 camadas |
| `agents/` | O empacotamento multi-harness. `openai.yaml` é a forma que as outras skills da casa usam |
| `tools/` | Bisseção, render, instalação, as medições, as sessões de demonstração. `drawio.cjs` é o único lugar que sabe onde o binário mora |
| `saida/` | O que o motor produziu, e o render como prova |
| `docs/` | O registro de engenharia: o que a recertificação mediu, o que o roteamento consertou |
| `prototypes/` | **Fonte primária, não produção.** Um diretório por pergunta respondida. Nada da árvore de produção alcança daqui — e há checagem disso |

`guia/` é o que o agente lê para **operar** a skill; `docs/` é o que se lê para
saber **o que foi medido**. Um ponteiro leva de um ao outro onde a medição é a
resposta.

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
