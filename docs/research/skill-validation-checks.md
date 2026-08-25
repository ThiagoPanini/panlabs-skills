# Checagens de validação para Agent Skills: o catálogo do campo

> Pesquisa de fundação para um harness de CI que valide as skills deste repositório
> a cada branch. A pergunta não foi "o que é uma skill bem escrita" — foi **o que o
> campo mecanicamente checa, com que limiar exato, aplicado por quem, e se aquilo
> bloqueia ou só avisa**. Toda linha abaixo rastreia a uma fonte primária que eu
> efetivamente abri: texto normativo, código-fonte de validador, ou saída real de
> comando. Onde não consegui fonte primária, digo isso em vez de arredondar.
>
> Data da pesquisa: 2026-08-25.

---

## 0. Como ler este documento

Cada seção (A–D) fecha com uma ou mais tabelas de checagem, todas com as mesmas
cinco colunas:

| Coluna | Significado |
|---|---|
| **Regra** | precisa o bastante para implementar — limiar exato, padrão exato |
| **Fonte** | URL ou caminho de arquivo que eu efetivamente li |
| **Quem aplica** | a ferramenta/spec que declara ou executa a regra |
| **Mecanizável?** | sim / não / parcial — um script decide sem julgamento? |
| **Severidade na fonte** | bloqueante / consultivo, **como a própria ferramenta trata**, não como eu acho que deveria tratar |

Depois das quatro seções tem **"Onde as fontes divergem"** — os pontos em que duas
fontes primárias dizem coisas diferentes sobre a mesma regra, listados sem
suavização. Depois, **"O que vale para um repositório caseiro"** — a lista curada
para *este* repo, com uma linha de justificativa por item. Por fim, **Fontes**.

Duas skills existem hoje neste repo e são a régua de "repositório caseiro" usada
na seção final: `skills/panlabs-aws-diagrams/` (código pesado, motor determinístico
em `.cjs`, suíte de testes própria, `SKILL.md` com 230 linhas, `name` de 20
caracteres, `description` de 390 caracteres, ~13 MB em árvore) e
`skills/panlabs-python-standards/` (só prosa de referência, `SKILL.md` com 154
linhas, `name` de 24 caracteres, `description` de 517 caracteres, 256 KB).

---

## A. skills.sh

**A premissa do pedido — "skills.sh roda checagens de validação em skills
submetidas e sinaliza as que falham" — não se sustenta nas fontes primárias do
próprio site.** Isto não é uma opinião minha: é o que a página de FAQ do site
declara e o que o repositório que o alimenta mostra.

`skills.sh` é a vitrine pública do pacote npm **`skills`**, cujo código é
público em [`github.com/vercel-labs/skills`](https://github.com/vercel-labs/skills)
(o rodapé do próprio site linka para lá como "Project"). O README descreve o
projeto como "The CLI for the open agent skills ecosystem" — um instalador que
resolve `npx skills add owner/repo` puxando **direto de um repositório Git**
(GitHub, GitLab, qualquer git URL, ou path local), sem upload central e sem
etapa de aprovação.
Fonte: [vercel-labs/skills — README.md](https://raw.githubusercontent.com/vercel-labs/skills/main/README.md).

A página [`skills.sh/docs/faq`](https://skills.sh/docs/faq) foi fetchada e diz,
textualmente e por omissão: nenhuma regra de validação, checklist de submissão,
processo de QA ou critério de rejeição é documentado; o único mecanismo de
qualidade descrito é o **leaderboard por contagem de instalação**; e a
responsabilidade é declarada como descentralizada — *"Skills are maintained by
their respective authors"*, com problemas reportados via issue direto ao autor,
não a um gate central.

A página [`skills.sh/docs/cli`](https://skills.sh/docs/cli) documenta só o
instalador (`npx skills add <skill-name>`) — nenhuma menção a validar, lintar ou
publicar.

O que existe de mais próximo a "checagem" é a página
[`skills.sh/audits`](https://skills.sh/audits): resultados agregados de **três
scanners de terceiros** — *"Gen Agent Trust Hub, Socket, and Snyk"* — com status
`Safe`/`Pending` e nível de risco `Low`/`Medium`/`High`/`Critical`. A própria
página não publica o critério de cada scanner (isso mora na documentação de cada
um deles, fora do escopo de uma skill em particular), e o fetch encontrou uma
inconsistência visível no próprio dashboard: uma skill listada como `Safe` com
"0 alerts" e simultaneamente classificada `Critical` — os três serviços não
convergem num único veredito.

O repositório do CLI tem, sim, mecanismos de segurança concretos e mecanizáveis
— só que são **do instalador, na hora de instalar**, não de um gate de
submissão:

| Regra | Fonte | Quem aplica | Mecanizável? | Severidade na fonte |
|---|---|---|---|---|
| Download direto por URL limitado a 10 MiB; conteúdo extraído limitado a 25 MiB; arquivo `.zip`/`.tar`/`.tar.gz`/`.tgz` limitado a 1000 arquivos (overridable via `SKILLS_DOWNLOAD_MAX_BYTES` / `SKILLS_EXTRACT_MAX_BYTES` / `SKILLS_EXTRACT_MAX_FILES`) | [vercel-labs/skills README](https://raw.githubusercontent.com/vercel-labs/skills/main/README.md) | `skills` CLI (instalação) | sim | bloqueante (recusa a instalar) |
| Toda string de metadado untrusted (`name`/`description` do `SKILL.md` de terceiros) passa por um sanitizador que remove sequências de escape de terminal (CSI/OSC/DCS/C1/controle) antes de imprimir — defesa contra CWE-150 | [`src/sanitize.ts`](https://raw.githubusercontent.com/vercel-labs/skills/main/src/sanitize.ts) | `skills` CLI (instalação) | sim | N/A — saneamento silencioso, não é um veredito pass/fail |
| Parser de frontmatter deliberadamente restrito a YAML puro — **não** suporta o modo `---js`/`---javascript` do `gray-matter`, justamente para não herdar o `eval()` que esse modo expõe | [`src/frontmatter.ts`](https://raw.githubusercontent.com/vercel-labs/skills/main/src/frontmatter.ts) | `skills` CLI (instalação) | sim | N/A — escolha de parser, não é uma checagem com veredito |

**Conclusão da seção A:** não há um linter de conteúdo de skill mantido por
`skills.sh` para citar aqui. O que existe é (1) popularidade por instalação, (2)
selos de segurança de terceiros sem critério publicado no próprio site, e (3)
limites de segurança do *instalador*, não do *autor*.

---

## B. A especificação aberta — agentskills.io/specification

Lida na íntegra em [`agentskills.io/specification`](https://agentskills.io/specification).
O texto **não usa a convenção formal RFC 2119 em maiúsculas** (não há "MUST"/
"SHOULD" capitalizados) — usa linguagem natural ("must", "should", "may") em
prosa e uma tabela de campos com coluna "Required". Classifico abaixo pelo verbo
modal efetivamente usado.

### B.1 Frontmatter — campos

| Campo | Obrigatório | Regra exata | Modal |
|---|---|---|---|
| `name` | Sim | Máx. 64 caracteres. Só letras minúsculas unicode (`a-z` e além), dígitos e hífen. Não pode começar/terminar com hífen. Não pode ter hífens consecutivos (`--`). Deve ser igual ao nome do diretório-pai. | MUST (cada cláusula) |
| `description` | Sim | Máx. 1024 caracteres, não-vazia. | MUST |
| `description` (conteúdo) | Sim | "Should describe both what the skill does and when to use it" / "Should include specific keywords that help agents identify relevant tasks" | SHOULD |
| `license` | Não | Nome da licença ou referência a um arquivo de licença embutido; recomenda-se manter curto | sem limite numérico declarado |
| `compatibility` | Não | Máx. 500 caracteres se presente; só incluir se a skill tiver requisito de ambiente real | MUST (limite) / SHOULD (quando incluir) |
| `metadata` | Não | Mapa string→string livre; recomenda-se chaves razoavelmente únicas para evitar colisão entre clientes | SHOULD |
| `allowed-tools` | Não | String de tools separadas por espaço, pré-aprovadas; **experimental**, "support may vary between agent implementations" | — |

Exemplos válidos/inválidos de `name` no próprio texto da spec:
válidos `pdf-processing`, `data-analysis`, `code-review`; inválidos
`PDF-Processing` (maiúscula), `-pdf` (hífen inicial), `pdf--processing` (hífen
duplo).

**Nenhum outro campo é permitido.** O conjunto fechado é exatamente
`{name, description, license, compatibility, metadata, allowed-tools}` — isso
não está escrito como regra explícita na prosa da página de especificação, mas
é o que a implementação de referência (`skills-ref`, ver B.4) e todos os
validadores de terceiros que li (seção D) tratam como a lista fechada.

### B.2 Layout de diretório e corpo

- `SKILL.md` é o único arquivo obrigatório na raiz da skill.
- `scripts/`, `references/`, `assets/` são **recomendações de convenção**, não
  requisito — a spec diz "A skill directory may contain any files and
  directories beyond the required SKILL.md. The conventions below are
  recommendations."
- O corpo Markdown "has no format restrictions. Write whatever helps agents
  perform the task effectively." — mas a mesma página recomenda seções de
  passo-a-passo, exemplos de entrada/saída, e casos de borda.
- **Progressive disclosure**, os três níveis nomeados explicitamente: (1)
  metadata (`name`+`description`, ~100 tokens, carregado sempre), (2)
  instruções (corpo do `SKILL.md`, "< 5000 tokens recommended", carregado só
  quando a skill ativa), (3) recursos (`scripts/`/`references/`/`assets/`,
  carregados só quando referenciados).
- **"Keep your main SKILL.md under 500 lines. Move detailed reference material
  to separate files."** — SHOULD, sem número de tolerância declarado.
- Referências a arquivo: paths relativos à raiz da skill; **"Keep file
  references one level deep from SKILL.md. Avoid deeply nested reference
  chains."** — SHOULD.
- **Nenhum limite de tamanho de pacote, de arquivo individual, ou de contagem
  de arquivos aparece em nenhum lugar do texto da especificação.** Achado
  negativo relevante — ver "Onde as fontes divergem", item 6.

### B.3 Guias irmãs (mesma origem, não normativas)

`agentskills.io` publica três guias de autoria fora da especificação
formal — lidos na íntegra, mas são conselho de qualidade, não regra
mecanizável, com uma exceção anotada:

- [`skill-creation/best-practices.md`](https://agentskills.io/skill-creation/best-practices.md) —
  escopo coerente, "add what the agent lacks, omit what it knows", calibrar
  prescritividade à fragilidade da tarefa. Reforça o limite de 500
  linhas/5000 tokens da spec, sem adicionar número novo.
- [`skill-creation/optimizing-descriptions.md`](https://agentskills.io/skill-creation/optimizing-descriptions.md) —
  metodologia de eval de *trigger rate* (queries rotuladas should-trigger/
  should-not-trigger, 3 runs por query, taxa de disparo, split train/validation
  60/40). Não é uma checagem de CI — é um laço de iteração manual/eval, exige
  chamadas reais ao agente. A única regra dura repetida aqui é o **limite de
  1024 caracteres** já coberto em B.1.
- [`skill-creation/using-scripts.md`](https://agentskills.io/skill-creation/using-scripts.md) —
  não lido em profundidade: por título e pela entrada do `llms.txt`, é
  orientação qualitativa sobre scripts serem autocontidos e terem mensagens de
  erro úteis, sem limiar numérico esperado.

### B.4 A implementação de referência — `skills-ref`

A própria especificação aponta esta como a ferramenta de validação canônica:
*"Use the [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref)
reference library to validate your skills: `skills-ref validate ./my-skill`"*.
Li o código-fonte inteiro
([`validator.py`](https://raw.githubusercontent.com/agentskills/agentskills/main/skills-ref/src/skills_ref/validator.py),
[`parser.py`](https://raw.githubusercontent.com/agentskills/agentskills/main/skills-ref/src/skills_ref/parser.py),
[`models.py`](https://raw.githubusercontent.com/agentskills/agentskills/main/skills-ref/src/skills_ref/models.py),
[`errors.py`](https://raw.githubusercontent.com/agentskills/agentskills/main/skills-ref/src/skills_ref/errors.py),
[`cli.py`](https://raw.githubusercontent.com/agentskills/agentskills/main/skills-ref/src/skills_ref/cli.py)),
Python, licença no próprio repo.

| Regra | Fonte (linha de código) | Mecanizável? | Severidade |
|---|---|---|---|
| `SKILL.md` (ou `skill.md`) deve existir na raiz | `find_skill_md` em `parser.py` | sim | bloqueante — `validate()` retorna erro de string, `cli.py` sai com código 1 |
| Conteúdo deve começar com `---` e ter um segundo `---` fechando o frontmatter | `parse_frontmatter` em `parser.py` | sim | bloqueante |
| Frontmatter deve parsear como YAML e ser um mapeamento (usa `strictyaml`) | `parse_frontmatter` | sim | bloqueante |
| Só os 6 campos do conjunto `ALLOWED_FIELDS` — qualquer chave fora disso é erro | `_validate_metadata_fields` | sim | bloqueante |
| `name`: presente, não-vazio após `.strip()` | `_validate_name` | sim | bloqueante |
| `name`: ≤ 64 caracteres (constante `MAX_SKILL_NAME_LENGTH`), contados **depois** de normalizar Unicode NFKC | `_validate_name` | sim | bloqueante |
| `name`: `name == name.lower()` (comparação Unicode-aware, não ASCII) | `_validate_name` | sim | bloqueante |
| `name`: não pode começar/terminar com `-`, nem conter `--` | `_validate_name` | sim | bloqueante |
| `name`: todo caractere deve satisfazer `c.isalnum() or c == "-"` — `isalnum()` do Python é **Unicode-aware**, aceita letras acentuadas e de outros scripts, não só ASCII | `_validate_name` | sim | bloqueante |
| `name` (normalizado NFKC) deve ser igual ao nome do diretório da skill (também normalizado NFKC) | `_validate_name` | sim | bloqueante |
| `description`: presente, não-vazia após `.strip()` | `_validate_description` | sim | bloqueante |
| `description`: ≤ 1024 caracteres (`MAX_DESCRIPTION_LENGTH`) | `_validate_description` | sim | bloqueante |
| `compatibility`, se presente: deve ser string, ≤ 500 caracteres (`MAX_COMPATIBILITY_LENGTH`) | `_validate_compatibility` | sim | bloqueante |

O CLI (`skills-ref validate <path>`) sai com código 0 se `errors` estiver vazio,
1 caso contrário, imprimindo cada erro em `stderr`. Não existe conceito de
"warning" nesta ferramenta — é binário.

---

## C. Ferramentas da própria Anthropic

Três fontes distintas, com escopos que **não coincidem entre si** (ver
"Onde as fontes divergem"): a documentação de autoria do Claude Code
(`code.claude.com`), os requisitos da Skills API (`platform.claude.com`), e o
código do `skill-creator` (`github.com/anthropics/skills`).

### C.1 Autoria — `code.claude.com/docs/en/skills` e a Skills API

Lido na íntegra em [`code.claude.com/docs/en/skills`](https://code.claude.com/docs/en/skills)
(fetch bruto via `.md`, 1.048 linhas). A tabela **"Frontmatter reference"**
lista **19 campos**, todos opcionais no carregador do Claude Code (só
`description` é "Recommended", nenhum é "Required"):

`name`, `description`, `when_to_use`, `argument-hint`, `arguments`,
`disable-model-invocation`, `user-invocable`, `allowed-tools`,
`disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`,
`hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`.

Os últimos 13 (além dos 6 do spec aberto) **só existem no Claude Code**. A
própria página é explícita sobre a fronteira de portabilidade:

> "Claude Code accepts every field in the table above. Outside Claude Code, you
> can use only the fields in the Agent Skills spec [...] If you include any
> field the spec doesn't allow, packaging or upload fails with a hard error
> instead of ignoring the field."

E dá a mensagem de erro exata:

```
Unexpected key(s) in SKILL.md frontmatter: argument-hint. Allowed properties are: allowed-tools, compatibility, description, license, metadata, name
```

| Regra | Fonte | Quem aplica | Mecanizável? | Severidade na fonte |
|---|---|---|---|---|
| Fora do Claude Code (upload claude.ai, Skills API, `package_skill.py`), só `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` são aceitos — qualquer outro campo é erro rígido, não é ignorado | `code.claude.com/docs/en/skills` §"Using skill frontmatter outside Claude Code" | Skills API / packaging | sim | bloqueante |
| Dentro do Claude Code, frontmatter mal-formado (YAML quebrado) **não rejeita** a skill — o corpo carrega com `metadata` vazia, `/nome-da-skill` ainda funciona, só perde a `description` para matching | mesma página, §Troubleshooting "Skill not triggering" | Claude Code (carregador) | sim | consultivo — degrada, não bloqueia |
| `description` + `when_to_use` combinados são truncados em **1536 caracteres** na listagem que o Claude Code carrega em contexto (configurável via `skillListingMaxDescChars`) | mesma página, §"Skill descriptions are cut short" | Claude Code (runtime) | sim | consultivo — truncamento silencioso, não é erro de autoria |
| Orçamento de contexto para a listagem de skills é ~1% da janela de contexto do modelo por padrão (`skillListingBudgetFraction`); ao estourar, descrições das skills menos usadas são cortadas primeiro | mesma página | Claude Code (runtime) | parcial — depende do histórico de uso da sessão, não é estático | consultivo |
| `boolean` fields aceitam `yes/no/on/off/1/0` além de `true/false` desde a v2.1.218 | mesma página | Claude Code (parser) | sim | N/A |

A Skills API (upload via `platform.claude.com`) tem seu **próprio** conjunto de
exigências, textualmente idêntico em dois pontos independentes do mesmo
documento
([`platform.claude.com/docs/en/build-with-claude/skills-guide`](https://platform.claude.com/docs/en/build-with-claude/skills-guide),
fetch bruto via `.md`, linhas 2455–2466 e 3660–3673):

| Regra | Citação exata | Mecanizável? | Severidade |
|---|---|---|---|
| Tamanho total de upload | *"Total upload size must be under 30 MB (uncompressed)"* / *"Maximum Skill upload size: 30 MB (all files combined, uncompressed)"* | sim | bloqueante (rejeição no upload — o texto não expõe o código HTTP exato) |
| `SKILL.md` deve estar na raiz do upload (ou no topo de uma única pasta envolvente) | *"Must include a SKILL.md file at the upload root (or at the top of a single enclosing folder)"* | sim | bloqueante |
| `name`: charset + banimento extra | *"Maximum 64 characters, lowercase letters/numbers/hyphens only, no XML tags, no reserved words (\"anthropic\", \"claude\")"* | sim | bloqueante |
| `description`: sem XML | *"Maximum 1024 characters, non-empty, no XML tags"* | sim | bloqueante |
| `display_name` opcional | deriva de `name` se omitido; se explícito, até 255 caracteres, não precisa ser único no workspace | sim | bloqueante só se > 255 |
| Skills por requisição | *"Maximum Skills per request: 20"* | sim | bloqueante |
| Nova versão é snapshot completo | *"upload the Skill's full file set each time [...] the name in the new version's SKILL.md must match the Skill's existing name"* | sim | bloqueante |
| Ambiente de execução da skill (container) | sem acesso a rede, sem instalação de pacote em runtime, container isolado por padrão | sim | N/A — restrição de runtime, não de autoria |

"No XML tags" e "no reserved words" **não aparecem em nenhum lugar do texto da
especificação aberta** (seção B) — são específicos da Skills API. Ver "Onde as
fontes divergem", item 4.

### C.2 `skill-creator` — `package_skill.py` e `quick_validate.py`

Repositório [`anthropics/skills`](https://github.com/anthropics/skills),
código lido na íntegra:
[`scripts/package_skill.py`](https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/scripts/package_skill.py),
[`scripts/quick_validate.py`](https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/scripts/quick_validate.py).

**`package_skill.py` — o empacotador.** Roda `quick_validate.py` antes de
zipar; se `valid` for `False`, aborta e não produz o `.skill`. Exclusões do
zip, lidas direto do código:

```python
EXCLUDE_DIRS = {"__pycache__", "node_modules"}
EXCLUDE_GLOBS = {"*.pyc"}
EXCLUDE_FILES = {".DS_Store"}
ROOT_EXCLUDE_DIRS = {"evals"}   # só exclui evals/ na raiz da skill, não em subpastas
```

Isso confirma **exatamente** o que a auditoria interna deste repo
(`docs/aws-diagrams/auditoria.md`, linha 54–55) já descrevia. **Achado novo: o
código de `package_skill.py` não contém nenhuma checagem de tamanho.** Ele zipa
tudo que sobra depois das exclusões acima, sem medir o resultado contra
30 MB nem contra qualquer outro número — o teto de 30 MB é inteiramente uma
exigência da Skills API no momento do upload (C.1), não algo que o empacotador
oficial impede de gerar. Ver "Onde as fontes divergem", item 5.

**`quick_validate.py` — o pré-validador.** Regex-based, sem `strictyaml`, sem
normalização Unicode:

| Regra | Fonte (código) | Mecanizável? | Severidade |
|---|---|---|---|
| `SKILL.md` existe | `validate_skill()` | sim | bloqueante |
| Conteúdo começa com `---` e casa `^---\n(.*?)\n---` (regex, `re.DOTALL`) | idem | sim | bloqueante |
| YAML do frontmatter parseia como dict (`yaml.safe_load`) | idem | sim | bloqueante |
| Só chaves em `{name, description, license, allowed-tools, metadata, compatibility}` | idem | sim | bloqueante |
| `name` e `description` presentes como chaves | idem | sim | bloqueante |
| `name`: casa `^[a-z0-9-]+$` — **regex ASCII**, não Unicode | idem | sim | bloqueante, **só se `name.strip()` for não-vazio** |
| `name`: sem hífen líder/final, sem `--` | idem | sim | mesma ressalva acima |
| `name`: ≤ 64 caracteres | idem | sim | mesma ressalva acima |
| `description`: **não pode conter `<` ou `>`** — regra que não existe no texto da spec aberta, mas casa com "no XML tags" da Skills API (C.1) | idem | sim | bloqueante, só se não-vazia |
| `description`: ≤ 1024 caracteres | idem | sim | mesma ressalva |
| `compatibility`, se presente: ≤ 500 caracteres | idem | sim | bloqueante |

Duas lacunas reais neste script, encontradas lendo o código com atenção (não
achei nenhuma fonte secundária que aponte isso — é leitura direta):

1. **Todas as checagens de formato de `name` e `description` estão dentro de um
   `if name:` / `if description:`** — ou seja, se o valor for uma string vazia
   (`name: ""`) depois de `.strip()`, a checagem de presença da chave já passou
   e o bloco de formato é pulado inteiro. Uma skill com `name: ""` passa
   silenciosamente no `quick_validate.py`, ao contrário de `skills-ref`
   (B.4), que rejeita explicitamente string vazia.
2. **Não existe checagem de que `name` bate com o nome do diretório** — a spec
   (B.1) declara isso MUST, `skills-ref` (B.4) checa, `skill-lint` (D.2) checa;
   o pré-validador oficial da própria Anthropic não checa.

**`references/schemas.md`** (do mesmo `skill-creator`) **não é um schema para
`SKILL.md`.** Documenta os formatos internos do fluxo de eval/melhoria do
próprio `skill-creator`: `evals.json`, `history.json`, `grading.json`,
`metrics.json`, `timing.json`, `benchmark.json`, `comparison.json`,
`analysis.json`. Nenhum desses é o frontmatter de uma skill.
Fonte: [`references/schemas.md`](https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/references/schemas.md).
**Não encontrei, em nenhuma das fontes consultadas, um JSON Schema formal
publicado pela Anthropic para `SKILL.md`.** O mais próximo disso é a tabela em
prosa da spec (B.1) e o código imperativo de `quick_validate.py`/`skills-ref`.

O template oficial vazio, para referência do mínimo viável:
[`template/SKILL.md`](https://raw.githubusercontent.com/anthropics/skills/main/template/SKILL.md)
tem só `name: template-skill` e `description: Replace with description...`.

### C.3 `claude plugin validate`, `claude plugin eval`, `/doctor`, `/skill-doctor`

Esta subseção mistura duas classes de fonte, marcadas em cada linha: **(1)**
saída real de comando, rodada por mim nesta mesma máquina (Claude Code
`2.1.245`, `claude plugin validate --help` e `claude plugin eval --help`), e
**(2)** achados de um agente especializado (`claude-code-guide`) que tem acesso
a referência interna de recursos em early access — marcados explicitamente como
**não confirmados em documentação pública**.

**`claude plugin validate`** — **(1), confirmado eu mesmo.** É o validador
estrutural oficial e documentado via `--help`:

```
Usage: claude plugin validate [options] <path>

Validate a plugin or marketplace manifest, or the skills, agents, and commands
in a directory

Options:
  -h, --help  Display help for command
  --strict    Treat warnings as errors (exit 1). Use in CI to fail on
              unrecognized fields, missing metadata, and other issues that the
              runtime tolerates.
```

| Regra | Fonte | Mecanizável? | Severidade |
|---|---|---|---|
| Valida manifest de plugin/marketplace **e** skills/agents/commands de um diretório | `claude plugin validate --help` | parcial — o escopo exato das checagens de skill não é enumerado no `--help`, só o alvo | consultivo por padrão |
| `--strict`: promove warning a erro, sai com código 1 | idem, citação direta: *"Use in CI to fail on unrecognized fields, missing metadata, and other issues that the runtime tolerates"* | sim | bloqueante só com a flag |

Este é o único item da seção C explicitamente auto-descrito para uso em CI.

**`claude plugin eval`** — **(1) para a superfície de flags, confirmado eu
mesmo; (2) para semântica de grader e formato de caso**, via o agente
especializado. É um avaliador **comportamental**, não estrutural — roda casos
de teste (`prompt.md` + `graders/*.md`, ou `case.yaml`) contra a skill de fato
invocada por um agente, com julgamento por *graders* (tipos reportados via
(2): `regex`, `tool_used`, `tool_order`, `file_exists`, `llm`, `baseline` — não
verifiquei essa lista de tipos em `--help` nem em doc pública, só veio da
referência interna do agente especializado).

| Regra | Fonte | Mecanizável? | Severidade |
|---|---|---|---|
| `--threshold <0..1>`: sai com 1 se algum caso pontuar abaixo do limiar (padrão **1.0** — 100%) | `claude plugin eval --help`, confirmado (1) | sim, dado o grader | **bloqueante por padrão** (limiar 1.0 é estrito) |
| `--runs <n>`: repete cada caso (padrão 3) | idem | sim | N/A |
| `--max-cost-usd`: teto de custo, aborta com código 2 se estourado | idem | sim | bloqueante parcial (resultado parcial) |
| `--ablation with-without`: roda um braço sem a skill como baseline e reporta o delta | idem | sim (mecanismo) | consultivo — é comparação, não veredito |
| Grader tipo `llm`: julgamento por modelo (padrão `haiku` para o juiz) | (2), não confirmado em `--help` | **não** — é julgamento de LLM, o oposto de mecanizável sem juízo | depende do peso do grader no caso |
| Relatório HTML autopublicado em artifacts do claude.ai, a menos que `--no-publish` | `claude plugin eval --help` | sim | N/A |

Meu veredito de escopo: `claude plugin validate` é lint estrutural (o análogo
mais próximo do que este documento cataloga); `claude plugin eval` é avaliação
de qualidade/comportamento com juízes de LLM — outra categoria de ferramenta,
cara (chamadas de API) e não determinística por natureza (grader `llm`).

**`/doctor`** — **(1), confirmado**, mas não é o que o pedido original tinha em
mente. Está documentado em `code.claude.com/docs/en/skills`: reporta o **custo
de contexto da listagem de skills** e seus maiores contribuintes — é sobre o
orçamento de char/token da listagem (C.1), não sobre qualidade de conteúdo de
uma skill individual.

**`/skill-doctor`** — **(2) só, não encontrado em nenhuma doc pública.** O
agente especializado reporta, com a ressalva explícita de que a fonte é
referência interna de early access embutida no seu próprio prompt de sistema,
não uma URL pública: abre a aba de estatísticas do gerenciador de plugins
(equivalente a `/plugin stats`); relatório por skill com custo, uso/tokens dos
últimos 7 dias, aviso de "nunca invocada"; **somente leitura**, não conserta
nada. **Trato isso como não verificado** — cito porque foi pedido
explicitamente, mas não encontrei URL pública que confirme, e é um comando
diferente de `/doctor`, que esse sim é público e documentado.

---

## D. Outros validadores do campo

### D.1 `agent-ecosystem/skill-validator` (Go, CLI)

README lido na íntegra:
[`agent-ecosystem/skill-validator`](https://raw.githubusercontent.com/agent-ecosystem/skill-validator/main/README.md).
Instalável via Homebrew, Go, ou hook de pre-commit; tem modo `--json`,
`--markdown` e anotações de GitHub Actions. É de longe a checagem mais
granular que encontrei — a própria descrição resume o motivo: *"Spec compliance
is table stakes. skill-validator goes further."*

| Regra | Mecanizável? | Severidade |
|---|---|---|
| `SKILL.md` existe; só diretórios reconhecidos `scripts/`/`references/`/`assets/`; sem aninhamento profundo; sem arquivo órfão | sim | erro/warning conforme o caso |
| Frontmatter: `name`/`description` presentes e válidos; `name` kebab-case 1–64 e bate com o diretório; campos opcionais conformam tipo/tamanho; campo desconhecido é sinalizado | sim | erro |
| Detecção de arquivo estranho na raiz: `README.md`/`CHANGELOG.md`/`LICENSE` são sinalizados (são para humanos, não para o agente); `AGENTS.md` recebe aviso específico (é config de repositório, não conteúdo de skill) | sim | warning |
| **Keyword stuffing**: descrição com ≥5 strings entre aspas é sinalizada quando a prosa ao redor tem menos palavras que o número de strings citadas; ≥8 segmentos separados por vírgula (excluindo strings citadas) é sinalizado como lista de keywords | sim | warning |
| Contagem de tokens (`o200k_base`): corpo do `SKILL.md` avisa acima de **5.000 tokens ou 500 linhas** (== recomendação da spec, B.2); por arquivo de `references/`, avisa em **10.000**, erro em **25.000**; total de `references/`, avisa em **25.000**, erro em **50.000**; "outros arquivos" (fora da estrutura padrão), avisa em 25.000, erro em **100.000** | sim | warning/erro conforme o tier |
| Checagem holística: se conteúdo não-padrão excede **10× o conteúdo padrão** *e* passa de 25.000 tokens, erro — "the directory doesn't appear to be structured as a skill" | sim | erro |
| Cerca de código não fechada (` ``` ` ou `~~~`) em `SKILL.md` ou em `references/*.md` | sim | erro (não warning — "breaks agent usability") |
| Link interno relativo em `SKILL.md` deve resolver para um arquivo existente | sim | erro |
| **Detecção de órfão**: grafo de alcançabilidade a partir do corpo do `SKILL.md`, por *string containment* (não só link Markdown — pega menção em texto puro e em bloco de código); transitivo; resolve import Python (`from helpers.merge_runs import merge` → `helpers/merge_runs.py`); `__init__.py` isento por ser marcador de pacote, mas ainda conta como ponte de reachability | sim | warning (arquivo nunca referenciado) |
| Link externo (HTTP/HTTPS): `HEAD` request, timeout 10s, concorrente; template RFC 6570 (`{OWNER}`) é pulado; **403 vira `info`, não erro** (muitos sites bloqueiam requisição automatizada sem estar quebrados para humano) | sim, mecanicamente — mas depende de rede externa disponível no runner de CI | info/erro |
| Análise de conteúdo: contagem de palavras, razão de blocos de código, razão de frases imperativas, **densidade de informação** = `code_block_ratio*0.5 + imperative_ratio*0.5`, **especificidade de instrução** = `strong/(strong+weak)` (marcadores fortes: must/always/never/required/ensure; fracos: may/consider/could/optional) | sim (fórmula exata publicada) | só relatório, sem limiar pass/fail declarado |
| **Contaminação cross-language**: score = `multi_interface*0.3 + language_mismatch*0.4 + scope_breadth*0.3`, nível `high` ≥0.5, `medium` ≥0.2, `low` <0.2; categorias auxiliares (shell/config/query/markup) excluídas do cálculo de mismatch | sim (fórmula exata) | só relatório |
| `score evaluate`: LLM-as-judge, 6 dimensões para `SKILL.md` (clareza, acionabilidade, eficiência de token, disciplina de escopo, precisão diretiva, **novidade**) e 5 para arquivo de referência, 1–5 cada, com follow-up que aponta o detalhe novo quando a nota de novidade ≥3 | **não** — julgamento de LLM por definição | consultivo, custa chamada de API |

Flags relevantes para adequar isso a um layout que não é o canônico:
`--allow-flat-layouts` (aceita arquivos soltos na raiz), `--allow-dirs=x,y`
(aceita diretório não-padrão nomeado, ex. `evals/`), `--allow-nested-paths=x`
(permite aninhamento profundo só numa subárvore), `--exclude-token-paths=x`
(tira uma subárvore da contagem de token de "outros arquivos").

### D.2 `himself65/skill-lint` (TypeScript, GitHub Action + CLI)

README lido na íntegra:
[`himself65/skill-lint`](https://raw.githubusercontent.com/himself65/skill-lint/main/README.md).
Já publica a própria tabela regra→severidade — transcrita quase 1:1 porque é
exatamente o formato que este documento pede:

| Regra | Severidade |
|---|---|
| `SKILL.md` ausente | erro |
| `SKILL.md` com casing diferente (`skill.md`) é lido, mas cliente que casa nome exato não encontra | warning |
| Frontmatter inválido (não começa com `---`, YAML inválido, não fecha) | erro |
| `name` ausente | erro |
| Formato de `name`: 1–64 chars, minúsculas **incluindo não-ASCII**, dígitos e hífen, sem hífen líder/final/duplo | erro |
| `name` ≠ nome do diretório (comparado com normalização Unicode) | erro |
| `name` duplicado no mesmo namespace (skills de plugins diferentes são isentas) | warning |
| `description` ausente | erro |
| `description` fora de 1–1024 caracteres | erro |
| `compatibility` presente e fora de 1–500 caracteres | erro |
| `allowed-tools` fora do formato esperado (separado por espaço, parênteses balanceados; lista separada por vírgula é sinalizada) | warning |
| `metadata` não é mapa string→string | warning |
| Campo desconhecido (fora de `name/description/license/allowed-tools/metadata/compatibility`) | erro |
| Campo de extensão do Claude Code presente sem a flag `--claude-code` | erro |
| Corpo vazio depois do frontmatter | warning |
| Corpo com mais de ~500 linhas (recomendação da spec) | warning |
| Corpo com mais de ~5000 tokens estimados (recomendação da spec) | warning |
| Referência de arquivo com mais de um nível de profundidade | warning |
| Referência a arquivo que não existe em disco (link Markdown ou path em texto puro) | warning |
| Arquivo em `references/` nunca mencionado em lugar nenhum alcançável | warning |

**Confirma de forma independente** duas regras que não estão no texto da spec
aberta, atrás de uma flag `--claude` explicitamente rotulada *"not part of the
agentskills.io spec"*:

| Regra | Severidade |
|---|---|
| `name` não pode conter `anthropic` nem `claude` (palavra reservada) | erro |
| `description` não pode conter `<` ou `>` | erro |

E enumera exatamente os mesmos 13 campos de extensão do Claude Code que
`code.claude.com` documenta (C.1): `when_to_use`, `argument-hint`, `arguments`,
`disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`,
`effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell` —
segunda fonte independente para a mesma lista, sem divergência.

Checagem extra, fora do escopo de conformidade de spec — consistência interna
entre `.claude-plugin/marketplace.json` e o `plugin.json` de cada plugin que
ele referencia (versão do manifest deve bater com a versão do plugin);
irrelevante para este repo, que não publica marketplace.

### D.3 O framework de ameaça — OWASP Agentic Skills Top 10

Checklist lido em
[`owasp.org/www-project-agentic-skills-top-10/checklist.html`](https://owasp.org/www-project-agentic-skills-top-10/checklist.html)
(projeto: [`owasp.org/www-project-agentic-skills-top-10`](https://owasp.org/www-project-agentic-skills-top-10/)).
Dez categorias (AST01–AST10), cada uma com um checklist de auditoria. **O
modelo de ameaça é cadeia de suprimentos e skill de terceiro malicioso** —
identidade de publisher, assinatura ed25519, SBOM, isolamento de container,
IAM para "Non-Human Identity". A maioria dos itens não é mecanizável por um
script leve (exige processo humano de aprovação, ferramenta de assinatura,
inventário centralizado). Os itens genuinamente mecanizáveis e agnósticos de
modelo de confiança:

| Regra | Categoria | Mecanizável? |
|---|---|---|
| Rejeitar tags YAML inseguras (`!!python/object`, `!!python/apply`) no frontmatter | AST04 | sim |
| Nenhum campo além de um allowlist explícito de chaves YAML/JSON | AST04 | sim (mesma checagem de B.1/B.4) |
| Varredura de segredo/credencial (Gitleaks, TruffleHog ou equivalente) sobre o conteúdo da skill | AST08 | sim |
| Bloquear leitura de `~/.ssh/`, `~/.aws/`, `.env`, `**/credentials*`, `*.wallet` a menos que justificado | AST03 | sim, via grep no corpo/scripts |
| Nenhuma dependência com range de versão (`^`/`~`) em `requirements.txt`/`package.json` — pin exato | AST02 | sim |

Ferramentas de scan citadas pelo próprio checklist: Semgrep, Bandit, Gitleaks,
TruffleHog, Snyk, além de produtos proprietários (Caterpillar, SkillSpector,
Pipelock) que não investiguei.

### D.4 Mencionados, não verificados a fundo

O ecossistema de listas "awesome-claude-skills" está fragmentado — pelo menos
cinco repositórios curados independentes apareceram na busca
(`BehiSecc`, `karanb192`, `ComposioHQ`, `GetBindu`, `travisvn`), nenhum deles
prescrevendo um validador específico. **A convergência real do campo não está
numa lista "awesome" — está em `skill-validator` (D.1) e `skill-lint` (D.2)
reimplementando, cada um por conta própria, a mesma spec aberta mais as duas
mesmas regras específicas da Anthropic** (banimento de `anthropic`/`claude`
no nome, banimento de `<`/`>` na descrição) — isso é o de-facto lint do campo,
por convergência de implementação independente, não por lista curada.

Encontrados por busca mas **não confirmados em fonte primária própria** —
citados por completude, não usados para nenhuma linha de tabela acima:

- **agnix** — descrito em resultado de busca como linter de 156 regras para
  `SKILL.md`/`CLAUDE.md`/hooks/config MCP, com auto-fix e LSP. Não localizei
  repositório público que respondesse a essa descrição para confirmar.
- **Corgea** (produto), **Snyk ToxicSkills** (auditoria/relatório de
  segurança), **nesbitt.io "Skills Registry Threat Models"** (post) — atuam na
  mesma superfície do OWASP AST10 (D.3): segurança de registry contra skill
  maliciosa de terceiro. Não abri as fontes primárias de nenhum dos três; o
  ângulo (supply chain, não lint de autoria) já está coberto por D.3.

---

## Onde as fontes divergem

1. **Charset de `name`.** A spec (B.1) e `skills-ref` (B.4) aceitam unicode
   alfanumérico minúsculo (`str.isalnum()` do Python, ciente de acento e outros
   scripts). `quick_validate.py` da própria Anthropic (C.2) usa a regex ASCII
   `^[a-z0-9-]+$` — mais restritiva que a própria especificação que ela
   deveria implementar. `skill-lint` (D.2) segue a leitura ampla, "lowercase
   letters (including non-ASCII)". Resultado prático: um `name` com acento
   passa em `skills-ref` e em `skill-lint`, mas seria rejeitado por
   `quick_validate.py` antes de `package_skill.py` gerar o `.skill`.

2. **`name`/`description` vazios.** MUST non-empty explícito na spec (B.1) e
   checado por `skills-ref` (B.4). `quick_validate.py` (C.2) guarda a checagem
   de formato inteira atrás de `if name:` / `if description:` — uma string
   vazia pula a validação e passa. Achado de leitura de código, não relatado
   em nenhuma doc.

3. **Nome do diretório == campo `name`.** MUST na spec (B.1), checado por
   `skills-ref` (B.4) e por `skill-lint` (D.2). **Ausente** em
   `quick_validate.py` (C.2) — o pré-validador oficial que roda antes de todo
   `.skill` empacotado não checa essa regra da própria spec que ele deveria
   impor.

4. **Banimento de `<`/`>` e das palavras `anthropic`/`claude`.** Não existem
   em nenhuma frase do texto da especificação aberta (B.1–B.2). Existem em
   `quick_validate.py` (C.2) e nos requisitos textuais da Skills API (C.1,
   citação dupla e idêntica). `skill-lint` (D.2) isola essas duas regras atrás
   de uma flag `--claude` com comentário explícito no próprio README: *"These
   are not part of the agentskills.io spec"*. Três fontes independentes
   concordam que a regra existe **na plataforma Anthropic**, e concordam
   igualmente que ela **não está no padrão aberto**.

5. **Obrigatoriedade de `name`/`description`.** MUST na spec aberta (1–64 /
   1–1024, non-empty; B.1) — mas o próprio carregador do Claude Code (C.1)
   trata os dois como opcionais, e frontmatter quebrado não é rejeitado, só
   degrada (a skill perde a `description` para *matching*, mas continua
   invocável por nome). O mesmo campo é "obrigatório e validado" num lugar da
   pilha Anthropic e "best-effort, falha graciosamente" em outro.

6. **Proveniência do teto de 30 MB.** Não está em nenhuma frase do texto da
   especificação aberta (B.2 — busquei e não achei). Não é checado por
   nenhuma linha de código em `package_skill.py` (C.2 — li o arquivo inteiro,
   não há checagem de tamanho). É unicamente uma exigência declarada da Skills
   API (`platform.claude.com`, C.1), repetida duas vezes idênticas no mesmo
   documento. A auditoria interna deste repo
   (`docs/aws-diagrams/auditoria.md`, linha 6–9) atribui o teto à combinação
   "especificação aberta... e empacotador oficial" — impreciso pela leitura
   feita aqui: nenhum dos dois impõe o número; só a doc da API o declara, e o
   empacotador oficial deixaria passar um pacote de 200 MB sem reclamar (só
   falharia depois, no upload). O número em si (30 MB) está correto e
   confirmado; a atribuição de fonte é que merece esta nota.

7. **500 linhas / 5000 tokens.** Cinco fontes independentes repetem o mesmo
   número como recomendação — spec (B.2), `best-practices.md` (B.3), o
   `SKILL.md` do próprio `skill-creator` (C.2), `skill-validator` (D.1) e
   `skill-lint` (D.2) — e em **nenhuma delas** isso é um MUST nem um erro
   bloqueante por padrão. É a regra mais citada do campo inteiro e,
   consistentemente, a mais fraca em severidade.

---

## O que vale para um repositório caseiro

Duas skills, um autor, sem cadeia de suprimentos, sem terceiro instalando de
fonte não confiável, sem registry a agradar. A pergunta certa não é "o que o
campo checa" (seção acima) — é "o que dessas checagens paga aluguel aqui".

### Adotar

- **Validação estrutural de frontmatter** (chaves permitidas, `name`/
  `description` presentes e dentro do limite, `name` casa com o diretório) —
  é ~30 linhas de código (o próprio `validator.py` do `skills-ref` cabe
  inteiro numa tela), determinística, zero falso positivo, e já existe pronta
  para reuso via `skills-ref validate`. É a única checagem em que **quatro**
  implementações independentes (spec, `skills-ref`, `quick_validate.py`,
  `skill-lint`) convergem no mesmo conjunto de regras.
- **`claude plugin validate --strict` no CI.** Já está instalado neste
  ambiente, custo de setup zero, e é a única ferramenta deste catálogo
  **auto-descrita para uso em CI** no próprio texto de ajuda
  (*"Use in CI to..."*).
- **Teto de tamanho de pacote, no mesmo espírito de `tools/empacotar.sh
  --conferir`** que `panlabs-aws-diagrams` já tem. Justificativa não é
  teórica: este repo já bateu em 29 MB de 30 MB uma vez (auditoria de
  2026-08-23) porque nada media isso automaticamente antes do empacotador
  rodar. Vale medir os dois: o teto real da Skills API (30 MB) e um teto de
  alerta bem mais baixo (ex. 50%) para pegar a tendência antes do susto.
- **Checagem de referência órfã / link interno quebrado** (o grafo de
  alcançabilidade do `skill-validator`, ou o "missing reference"/
  "unreferenced reference file" do `skill-lint`). A auditoria interna já achou
  esse exato tipo de problema uma vez (docs apontando para fora da própria
  skill, achado #3 do relatório de 2026-08-23) — é checagem barata para uma
  classe de erro que já ocorreu aqui.
- **Aviso de orçamento do `SKILL.md`** (500 linhas / 5000 tokens, como
  advisory, não bloqueante — nenhuma fonte primária o trata como bloqueante).
  Hoje as duas skills passam com folga (230 e 154 linhas) — o valor não é
  corrigir nada agora, é virar um tropeço de regressão antes que
  `panlabs-aws-diagrams` cresça mais.
- **Checagem de portabilidade de frontmatter** — grep simples contra a
  allowlist de 6 campos do spec aberto (B.1), sinalizando qualquer campo
  Claude-Code-only (`when_to_use`, `model`, `hooks`, etc.). As duas skills
  deste repo já só usam `name`+`description`, então isso também é guarda de
  regressão, não conserto: barato de manter assim.
- **Cerca de código Markdown não fechada** — regex trivial, e o próprio
  `skill-validator` trata isso como erro (não warning) porque quebra a leitura
  de tudo que vem depois para o agente. Custo de implementação desprezível
  frente ao tamanho do estrago se acontecer.

### Pular

- **Identidade de publisher, assinatura de código, SBOM, ed25519** (OWASP
  AST01/AST02, D.3) — o modelo de ameaça é cadeia de suprimentos de terceiro;
  aqui não há terceiro, o autor do commit é quem instala.
- **Scoring por LLM-as-judge** (`skill-validator score evaluate`, D.1; laço de
  melhoria do `skill-creator`, C.2) — sinal real (novidade, clareza), mas é
  fluxo de iteração manual que custa chamada de API por rodada e exige um
  conjunto de eval curado que nenhuma das duas skills tem hoje. Vale rodar à
  mão de vez em quando, não em todo push de branch.
- **Validação de link externo via HTTP** (`skill-validator validate links`,
  D.1) — só compensa se `SKILL.md`/`references/` de fato linkarem para a web;
  checar isso primeiro com um grep antes de montar o job de CI que bate rede.
- **Métricas de densidade/contaminação cross-language** (D.1, fórmulas de
  `information_density`/`contamination_score`) — calibradas para triagem em
  massa de submissão de qualidade desconhecida num marketplace. Para duas
  skills que o próprio autor escreveu e lê, julgamento humano é mais barato e
  mais preciso que a fórmula.
- **Selos de auditoria de registry** (`skills.sh/audits`, Socket/Snyk/Gen
  Agent Trust Hub, seção A) — este repo não está listado em `skills.sh`, e
  esses scanners procuram padrão de skill maliciosa de terceiro, não erro no
  próprio código.
- **`claude plugin eval` com graders/baseline/ablation completos** (C.3) —
  valioso quando a skill tem casos de eval curados e o objetivo é afinar taxa
  de disparo; é early access, precisa de habilitação por organização, e é
  ferramenta de iteração de qualidade, não gate de merge. A skill code-heavy
  já tem "sua própria suíte de testes" — isso já é o equivalente funcional
  pago e em uso, não falta reimplementar com outra ferramenta.
- **Telemetria de custo (`/doctor`, `/skill-doctor`)** (C.3) — é diagnóstico
  de sessão em runtime; um job de CI num checkout limpo não tem histórico de
  uso para medir. Não é sequer aplicável, não é questão de valer ou não.

---

## Fontes

### Especificação aberta e validador de referência
- Agent Skills. *Specification*. https://agentskills.io/specification
- Agent Skills. *Best practices for skill creators*. https://agentskills.io/skill-creation/best-practices
- Agent Skills. *Optimizing skill descriptions*. https://agentskills.io/skill-creation/optimizing-descriptions
- Agent Skills. Site map. https://agentskills.io/llms.txt
- `agentskills/agentskills` — `skills-ref` (validador de referência em Python). https://github.com/agentskills/agentskills/tree/main/skills-ref — arquivos lidos: `validator.py`, `parser.py`, `models.py`, `errors.py`, `cli.py`.

### skills.sh
- skills.sh — home. https://skills.sh
- skills.sh — FAQ. https://skills.sh/docs/faq
- skills.sh — CLI docs. https://skills.sh/docs/cli
- skills.sh — Security audits. https://skills.sh/audits
- `vercel-labs/skills` (CLI que alimenta skills.sh). https://github.com/vercel-labs/skills — `README.md`, `src/frontmatter.ts`, `src/sanitize.ts`.

### Anthropic — documentação oficial
- *Extend Claude with skills* (Claude Code). https://code.claude.com/docs/en/skills
- *Using Agent Skills with the API* (Skills API / Messages API). https://platform.claude.com/docs/en/build-with-claude/skills-guide
- `anthropics/skills` — repositório oficial de skills e do `skill-creator`. https://github.com/anthropics/skills — arquivos lidos: `skills/skill-creator/scripts/package_skill.py`, `skills/skill-creator/scripts/quick_validate.py`, `skills/skill-creator/references/schemas.md`, `skills/skill-creator/SKILL.md`, `template/SKILL.md`, `spec/agent-skills-spec.md` (redireciona a agentskills.io/specification).
- `claude plugin validate --help` e `claude plugin eval --help` — executados localmente, Claude Code `2.1.245`.

### Comunidade
- `agent-ecosystem/skill-validator` (CLI em Go). https://github.com/agent-ecosystem/skill-validator
- `himself65/skill-lint` (GitHub Action + CLI em TypeScript). https://github.com/himself65/skill-lint

### Segurança / modelo de ameaça
- OWASP. *Agentic Skills Top 10* — projeto. https://owasp.org/www-project-agentic-skills-top-10/
- OWASP. *Skill Security Assessment Checklist*. https://owasp.org/www-project-agentic-skills-top-10/checklist.html

### Deste repositório
- `docs/aws-diagrams/auditoria.md` — auditoria de 2026-08-23, origem da citação do teto de 30 MB que este documento confirma e reatribui à fonte correta (item 6 de "Onde as fontes divergem").
- `docs/aws-diagrams/README.md`
- `skills/panlabs-aws-diagrams/SKILL.md`, `skills/panlabs-python-standards/SKILL.md` — medidos para a seção final.
