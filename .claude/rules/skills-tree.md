---
paths:
  - "skills/**"
---

# Ao escrever sob `skills/<skill>/`

Tudo aqui é **o que se instala**: quem instala recebe este diretório e nada ao lado. O portão `scripts/check-skills.sh` mede a árvore inteira a cada push, e a tranca recusa o push que reprova — `scripts/check-skills.sh --list` imprime as regras vigentes, e nenhum documento guarda cópia.

- **Nada aqui aponta para fora.** Toda referência relativa — link, path em comentário, string em JSON — resolve para dentro de `skills/<skill>/` e para algo que existe. `git mv` não reescreve o conteúdo do arquivo movido: confira os links depois de mover.
- **`SKILL.md` é registro append-only e tem teto de 400 linhas.** Acrescente no fim da seção; o que só interessa a um caminho de execução desce um nível, para um arquivo que o `SKILL.md` referencia.
- **A `description` nomeia o gatilho.** É a única parte que o runtime carrega sempre; o corpo, nunca até ela disparar. Diga *quando* buscar a skill, não só o que ela faz.
- **O que a skill não usa, sai.** A suíte, o corpus, a bancada e os renders moram em `workbench/<skill>/`, apontando para cá — nunca o inverso.
- **Antes de aterrissar:** `scripts/check-skills.sh` verde, e `workbench/<skill>/tests/run.sh` verde contra o resultado do rebase, rodando sozinho na máquina.
