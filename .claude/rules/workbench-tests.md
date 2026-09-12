---
paths:
  - "workbench/**/tests/**"
---

# Ao escrever sob `workbench/<skill>/tests/`

Esta suíte é a **checagem de invocação da skill, rodada por quem a mantém**: nenhum servidor a roda, e `.github/workflows/skills.yml` não sabe que ela existe. Ela aponta **para dentro** de `skills/<skill>/`, nunca o inverso — instalar a skill não instala o workbench.

## O andaime já existe — clone dele

- **A ordem das camadas é carga.** O cabeçalho de `run.sh` declara cada camada e por que uma falha invalida as seguintes. Um `passo` novo entra no **fim** da camada a que pertence — registro append-only, nunca no meio.
- **Toda régua nasce com a prova ao lado, e cada suíte tem a sua forma.** Na `panlabs-presentation-builder`, `check-<x>.py` mede e `check-<x>.proof.py` planta o defeito; as quatro asserções — plantado, vermelho, mensagem que nomeia o conserto, verde contra o corpus real — estão escritas uma vez em `proof_driver.py` e `proof_driver.cjs`: importe, não copie. Na `panlabs-aws-diagrams`, cada `check-<x>.cjs` planta o próprio defeito dentro de si, e o cabeçalho dele diz o que mede e o que deliberadamente não mede.
- **O vermelho nomeia o próprio conserto, no imperativo.** `exit 1` não nomeia nada, e um vermelho que não diz o que fazer é um vermelho que se aprende a ignorar.
- **O vizinho mais próximo é o `check-*` irmão da mesma camada.** Abra um, clone a forma, e não leia os outros.

## Antes de dizer que está verde

- Rode `run.sh` inteiro, **contra o resultado do rebase** e **sozinho na máquina** — dois renders headless ao mesmo tempo travam, e o `timeout` não mata os filhos do Electron.
- O que a suíte gera — `output/`, `renders/`, manifesto — é derivado: em conflito, regenere com o gerador; nunca `--ours`, nunca `--theirs`.
