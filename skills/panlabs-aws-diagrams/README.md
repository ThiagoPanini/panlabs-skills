# panlabs-aws-diagrams

Skill de diagramas de arquitetura AWS no draw.io: uma rodada de perguntas sobre o que a descrição não determinou, e as duas vistas — lógica e técnica multi-conta — desenhadas juntas por motor determinístico `IR → layout → mxGraph XML`, no projeto de quem chamou.

> **O documento que um agente lê é [`SKILL.md`](SKILL.md)**, com o [`guide/`](guide/)
> ao lado. Este README é o mapa da árvore, para quem vai mexer no código.

```bash
node engine/generate.cjs examples/web-multi-az.json --output /tmp/x.drawio
node tools/check-geometry.cjs examples/web-multi-az.json    # o laudo das 62
node tools/review-gaps.cjs examples/web-multi-az.json    # a revisão de lacunas
node tools/approve.cjs examples/session/retail-logical.json --output /tmp/retail.drawio    # o arco sequencial: aprovar a lógica
node tools/resume.cjs /tmp/retail.drawio --delta examples/session/retail-elaboration.json
./tools/install.sh                                        # expor nos dois harnesses
./tools/package.sh --check                            # o pacote cabe nos 30 MB?
```

A régua de 8 camadas mora no workspace irmão e roda de lá, contra esta árvore:
`workbench/panlabs-aws-diagrams/tests/run.sh` (#44). É lá também que mora a
bancada — medição, geração de variantes, bisseção, recorte, demonstração — e o
catálogo de extração/conferência, desde o #45; a bancada de medição de
candidatos mora em `workbench/panlabs-aws-diagrams/tools/measure-candidates.sh`.

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
| **`SKILL.md`** | **O documento.** A jornada em três turnos — pergunta, desenho, ajuste —, cada um com critério de parada checável, mais os dois gatilhos que promovem para o arco sequencial |
| `guide/` | O que a jornada revela por ponteiro: perguntas, modelo, context pack, laudo, visual |
| **`schema.json`** | **O contrato.** `model@1` — o IR que o agente escreve. Na raiz de propósito: é de quem escreve o modelo, e o motor é só o primeiro leitor |
| `engine/` | O pipeline. `gerar` › `validar` › `resolver` › `derivar` › `dispor` › `planejar` › `emitir` › `conferir`, mais o portão de contraste |
| `validator/` | As 62 checagens da rubrica viradas código — 60 no validador obrigatório, 2 no render. É **portão**, não otimizador |
| `theme/` | O vocabulário FECHADO de estilo e os três temas nomeáveis — `light`, `dark`, `corporate`. `schema.json` aqui é `theme@1`. O tema-armadilha do portão de contraste mora no workspace irmão desde o #45 |
| `session/` | Vista lógica → vista técnica, o `.drawio` como formato de persistência, e a cópia publicável. `schema.json` aqui é `session@1`. `gaps.cjs` é o vizinho de fora da regra: ele come `model@1`, não `session@1` — mora aqui porque a revisão de lacunas é passo do arco, e quem a chama é a camada de sessão |
| `catalog/` | `aws-shapes.cjs` resolve nome → shape sobre 403 service icons + 606 resource icons do draw.io 31.3.1, com o delta de correções escrito à mão. As ferramentas que extraem e conferem esse catálogo moram no workspace irmão desde o #45 |
| `examples/` | **Diretório de exemplos mínimo** — só o suficiente para os comandos documentados acima rodarem sem baixar nada. `examples/session/` guarda o único par pronto de `session@1` (lógica + delta) |
| `tools/` | Os comandos da jornada (`case.cjs`, `approve.cjs`, `resume.cjs`, `check-geometry.cjs`, `review-gaps.cjs`) mais `install.sh`, `package.sh` e `drawio.cjs` — o único lugar que sabe onde o binário do draw.io mora. `case.cjs --image` é quem chama `render.sh`, e é por isso que ele é o único item de bancada que não saiu no #45: a jornada publicada depende dele em tempo de execução |

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
| os protótipos | 18 MB, 252 arquivos, um diretório por pergunta respondida. Saíram da árvore no #29 e foram **apagados no #62**: um único commit na vida deles, o próprio `git mv`. `check-no-prototype.cjs` sempre provou que a produção não os alcançava; agora nem existem |
| o corpus renderizado | 6,7 MB de `.drawio` e PNG commitados. Também **apagados no #62**, e a medição que decidiu foi esta: 4 de 4 modelos regenerados divergiam do commitado, e nada na régua os comparava. A régua escreve em `output/` e nunca leu aquele diretório — não era fixture, era foto vencida |
| os casos de uso | 3,2 MB de prosa, modelo, desenho e laudo. Idem, com a mesma medição. Os defeitos que eles acharam já eram ticket e os repros já tinham sido promovidos para `models/` — que, por sua vez, saiu no #44 (ver abaixo). A tabela de cobertura sobreviveu, na auditoria do registro |
| a suíte de testes e o corpus de modelos | A suíte inteira (8 camadas) e os ~28 modelos que ela come — **movidos no #44** para `workbench/panlabs-aws-diagrams/`, que é quem os lê e roda agora. Não são apagados: a régua continua verde, rodando de fora da árvore e apontando para dentro dela, que é a única direção permitida. Ficou um diretório de exemplos mínimo (`examples/`) — só o suficiente para os comandos documentados no topo deste README rodarem sem baixar nada |
| a bancada, o catálogo de extração/conferência, o manifesto multi-harness e o tema-armadilha | **Movidos no #45**: 14 ferramentas de `tools/` (medição, geração de variantes, bisseção, recorte, demonstração) e as quatro de `catalog/tools/` foram para `workbench/panlabs-aws-diagrams/`, junto com `catalog/tests/` e `workbench/panlabs-aws-diagrams/theme/trap.json` — o mesmo critério executável do #44, aplicado ao resto. `agents/openai.yaml` **saiu**, sem substituto: nada na jornada o lia, e nenhum harness não-Claude jamais chegou a existir para o consumir. `output/` também saiu inteiro — três arquivos gerados (`predictive-fleet*.drawio`, `retail.drawio`) tinham ficado tracked por acidente apesar do `.gitignore`, e a régua passou a escrever o corpus renderizado num diretório de temporário de verdade (`OUTPUT_DIR`, via `mktemp`), nunca mais dentro de árvore nenhuma. `render.sh` foi a única exceção: `case.cjs --image` o chama em tempo de execução, então ficou em `tools/` |

O git guarda os três, e o #62 registra os endereços. **Nada aqui aponta para lá** —
é a direção que o #46 exige, e a razão de a lista congelada do
`check-single-schema.cjs` ter substituído uma leitura do git que subia dois
níveis acima da raiz da skill.

Sobraram **156 arquivos e 3,4 MB** — 11% do teto, medido por
`tools/package.sh --check` —, dos quais 1,6 MB é o `elkjs` embarcado que é a
razão de a skill não precisar de `npm install`.

**O #44 mediu de novo, e a mesma régua.** Antes da suíte e do corpus saírem, a
árvore estava em **168 arquivos e 3,7 MB** (12% do teto) — o crescimento desde
o `156` acima é trabalho de motor que aterrissou entre os dois tickets.
Depois, **101 arquivos e 3,4 MB** (11%): `tests/` e `models/` — 67 arquivos,
552 KB — foram para `workbench/panlabs-aws-diagrams/`, e ficaram os três
arquivos de `examples/`. A carga de leitura (`SKILL.md` + `guide/`) não se
mexeu — 78,6 KB antes, 78,9 KB depois —, porque nenhuma das duas árvores que
saíram era lida pelo agente: a suíte e o corpus sempre foram carga de quem
mantém, nunca de quem executa.

**O #45 mediu de novo, a mesma régua.** Antes deste ticket a árvore estava nos
mesmos **101 arquivos** do #44 (a #43 reescreveu `SKILL.md` sem mudar
contagem), **3,4 MB**. Depois, **73 arquivos e 2,5 MB** (8% do teto): 28
arquivos saíram — os 25 de `tools/`, `catalog/tools/`, `catalog/tests/` e mais
dois que foram para `workbench/panlabs-aws-diagrams/`, hoje
`workbench/panlabs-aws-diagrams/catalog/README.md` e
`workbench/panlabs-aws-diagrams/theme/trap.json` — mais os quatro apagados
(`agents/openai.yaml` e os três de `output/`), menos o `render.sh` que voltou
— ele é bancada, mas `case.cjs --image` o chama em tempo de execução, e mover
um comando publicado para fora da árvore que ele mesmo precisa em produção
seria repetir o defeito que abriu a spec #35. A carga de leitura não se mexeu
— 78,9 KB —, pelo mesmo motivo de sempre: nada do que saiu era lido pelo
agente. `workbench/panlabs-aws-diagrams/` ganhou 30 arquivos e 676 KB.

**O #46 fechou o que #44 e #45 deixaram em aberto.** A checagem de autocontenção não nasce mais aqui — migrou para o harness em `scripts/checks/references.sh`, varrendo todo link e toda imagem em Markdown pela árvore inteira, cerca de código excluída, com dois veredictos: resolve para fora da skill é autocontenção quebrada, resolve para dentro mas não existe é ponteiro morto. Contra os 73 arquivos e 2,5 MB que o #45 deixou, a régua roda limpa — nenhuma referência escapa da árvore, nenhuma aponta para o que o #44 e o #45 já moveram ou apagaram. Nenhum arquivo saiu, nenhum entrou, e a carga de leitura ficou onde estava — 78,9 KB, o mesmo número do #45.

E o teto deixou de ser a razão de qualquer coisa sair. Já não aperta ninguém;
o que ainda manda material para fora é a **carga de leitura**, e o critério
dos #44/#45 é o executável: *"o agente lê ou roda isto para executar a
skill?"*.

E o teto deixou de ser fé: `tools/package.sh --check` mede à mão, com a mesma
regra; quem a camada 0 da régua roda, desde o #45, é `scripts/checks/weight.sh`
— a régua do harness (#70), para a regra não viver escrita duas vezes. Os dois
acusam a mesma armadilha — **`.gitignore` não protege o pacote**. O empacotador
oficial varre o diretório e exclui exatamente `__pycache__`, `node_modules`,
`*.pyc`, `.DS_Store` e um `evals/` de raiz; um `output/` cheio de render subiria
junto mesmo o git ignorando — e é exatamente por isso que o #45 tirou o
`output/` da árvore em vez de só ignorá-lo melhor.

## Os contratos

| `$id` | esquema | quem escreve |
|---|---|---|
| `panlabs-aws-diagrams/model@1` | `schema.json` | o agente, na sabatina |
| `panlabs-aws-diagrams/theme@1` | `theme/schema.json` | quem configura a identidade visual |
| `panlabs-aws-diagrams/session@1` | `session/schema.json` | a camada de sessão, entre duas conversas |
| `panlabs-aws-diagrams/elaboration@1` | **não existe** | o agente, na fase técnica |

`check-single-schema.cjs`, na régua do workspace irmão, trava três coisas: nenhum
`$id` repetido, o `model@1` na raiz, e é **esse** arquivo que o motor abre —
medido, não afirmado.

> ⚠️ **O quarto contrato não tem esquema.** `elaboration@1` é declarado em
> `examples/session/retail-elaboration.json` e consumido por `session/elaborate.cjs`, e
> nada o valida — a checagem acima varre só os três arquivos de esquema, então um
> contrato sem arquivo passa por baixo dela. A forma está descrita em
> [`guide/model.md`](guide/model.md); enquanto não houver esquema, essa descrição é
> a única.

## Zero dependência de rede ou de binário em runtime

O `elkjs` vai embarcado em `engine/vendor/` (1,6 MB) e nada mais é carregado de
fora da árvore — `check-no-prototype.cjs`, na régua do workspace irmão, mede
isso com `require.cache`, não com grep.

O draw.io headless é **dependência de desenvolvimento**: a camada 7 da suíte
precisa dele e, sem o binário, avisa e segue.

O registro de engenharia — decisões da construção, corpus, recertificação e
roteamento — mora no workspace irmão, fora desta árvore: quem instala a skill
não paga por ele, e nada aqui dentro aponta de volta para lá.
