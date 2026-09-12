# Protocolo de economia de contexto — implementação

> Injetado pelo hook `UserPromptSubmit` (`~/.claude/hooks/context-economy-injector.py`) quando uma implementação começa — `/implement`, «implementa as issues». Este arquivo é também o **marker** de opt-in: enquanto ele existir, os dois hooks de economia de contexto ficam ativos neste repositório; sem ele, saem calados em `exit 0`. Foi assim que este repositório atravessou 116 sessões com a proteção instalada e inerte.

Você está começando a implementar. A meta é chegar ao primeiro `Edit` com a janela perto do baseline — ~48k —, não em 150k.

**Medido neste repositório em 2026-09-12, 116 sessões que escreveram código:** o primeiro `Edit` acontece com **145.584 tokens** de mediana, e 82% das sessões passam de 100k antes da primeira linha. A repartição não é a intuitiva: só ~43k são bytes de arquivo e de comando; **~65k é o seu próprio raciocínio**, gerado nos ~67 turnos gastos orquestrando a exploração; ~47k é o baseline. Ler menos ataca só o quarto que é byte. Tirar o reconhecimento da janela ataca também os turnos e o raciocínio — eles acontecem na janela do subagente, e só o digest atravessa. No repositório irmão que mediu o A/B, o protocolo injetado levou a mediana de 145k para 104k, com os turnos caindo de 69 para 34.

## A ordem

1. **A primeira ferramenta é `Agent`**, do tipo `Explore`. Até o digest chegar, o reconhecimento inteiro é dele: a árvore, os vizinhos, a doutrina, o ticket. Vale seguir direto quando o ticket nomeia o arquivo **e** a mudança cabe numa função — diga que é o caso e siga.

2. **Peça um digest de schema fixo, com teto de ~2.500 tokens, e diga o teto ao subagente.** Medido aqui: as 12 sessões que chamaram um `Agent` antes do primeiro `Edit` chegaram lá com **217k** de mediana, contra 142k das que não chamaram — subagente sem teto de digest devolve um relatório que custa mais do que a exploração que ele substituiu.
   - **arquivos relevantes** — path, e por que cada um importa;
   - **o vizinho mais próximo, verbatim** — o arquivo que o código novo vai espelhar: o `check-*` irmão da mesma camada, a prova irmã, o módulo do `compiler/` ou do `engine/` ao lado. O digest carrega o código a clonar, e por isso não custa uma segunda leitura sua. Os demais entram só por path;
   - **o padrão a espelhar**, e as invariantes ou ADR que se aplicam;
   - **onde o vermelho encosta** — a camada do `workbench/<skill>/tests/run.sh` que vai medir a mudança, e a prova que vai plantá-la.

   O `CLAUDE.md` tem a tabela de qual **seção** de `docs/agents/*` responde o quê. **O `Explore` não lê o `CLAUDE.md`** — a doc do Claude Code diz que ele pula o arquivo de memória —, então copie na instrução dele as linhas da tabela que o ticket precisa: `workflow.md` tem 24 kB, e a seção certa custa um décimo do arquivo. **No código, o índice é o cabeçalho**: 168 dos 169 arquivos de código deste repositório abrem com um comentário que declara a responsabilidade do arquivo e o ticket que o moldou — `head -30` neles localiza mais barato do que ler.

3. **Aja sobre o digest.** O vizinho que veio verbatim você clona. Dos demais, leia só o que o digest nomeia, e só o que faltou, em fatia estreita (`offset`/`limit`, `sed -n`). O digest é o **orçamento de leitura**.

4. **Issue enxuta.** Só o ticket-alvo, campos nomeados: `gh issue view N --json title,body,labels`. **A spec não é leitura de implementação**: cada ticket da fila é autocontido, e a spec — #207 tem 28 kB, #237 tem 41 kB — entra só pela seção que o ticket cita, e só se ele citar. Irmãs e `--comments` entram com necessidade real declarada.

5. **Vá direto ao vermelho.** O digest já é o plano — plante o defeito na prova, veja a régua ficar vermelha, e só então o verde. É a forma de toda régua desta casa: plantado, vermelho, mensagem que nomeia o conserto, verde contra o corpus real.

6. **Narre comprimido.** Prosa de sessão é português, e curta: o que mudou, o que mediu, o que falta. Código, commit, corpo de PR e aviso de risco seguem em prosa normal.

7. **Output cru vira digest uma vez.** `.output` de subagente e dumps de `tool-results/` já viraram preview. Precisa do conteúdo? Re-consulte a fonte com pergunta dirigida — a trava de `Read` (`~/.claude/hooks/read-denylist-guard.py`) bloqueia a releitura.

## Antes de propor o merge

O detalhe mora em `docs/agents/workflow.md` § A aterrissagem, e aqui fica o que se checa com o trabalho na mão.

- [ ] Território declarado no ticket **antes** da primeira escrita — `workflow.md` § Território declarado antes da primeira escrita.
- [ ] A união rodada — os dois `git diff --name-only` de `workflow.md` § A tese: ninguém roda a união — e o cruzamento lido.
- [ ] `scripts/check-skills.sh` verde. É o que a esteira roda, e a tranca recusa o push que reprova.
- [ ] `workbench/<skill>/tests/run.sh` verde **contra o resultado do rebase**, e rodando **sozinho** na máquina — dois renders headless ao mesmo tempo travam.
- [ ] PR aberto `--draft` no primeiro push, com a guarda `gh pr list --head "$BRANCH" --state open`; corpo escrito no fim, por quem tem o ticket na mão; `gh pr ready` depois; `gh pr merge --squash` **sem** `--delete-branch`.
- [ ] `git log origin/main --oneline` mostra o commit. Antes disso a sessão não acabou.

## Para medir de novo

`python3 ~/.claude/ctx-audit.py .` — instrumento local da máquina do mantenedor, fora deste repositório. Ele lê os transcripts do repositório e de cada worktree, corta cada sessão no primeiro `Edit`/`Write`, e devolve a mediana, a repartição por componente e os arquivos abertos antes da primeira edição. Os números acima são os dele, e envelhecem: quem mudar este protocolo ou o `CLAUDE.md` re-mede antes de afirmar efeito, e separa o que foi medido do que é esperado.
