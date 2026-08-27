# panlabs-skills

O repositório onde moram as agent skills desta casa, e o portão que mede se cada uma está bem construída.

## Vocabulário

Só o que este repositório cunhou ou torceu — e, nos dois primeiros grupos, cunhou porque **uma palavra estava fazendo o trabalho de duas**, e a confusão já custou alguma coisa.

### As duas coisas que se chamavam "checagem"

**Checagem de invocação** — verificação que roda **dentro** de uma skill, em tempo de execução, sobre o material que aquela skill acabou de produzir. É problema da própria skill: cada uma tem a sua, ou não tem nenhuma. _Evitar_: checagem (sozinha), teste, suíte — os três também nomeiam a de baixo.

**Validação de desenvolvimento** — verificação que roda **no repositório**, sobre a árvore de uma skill, e vale para qualquer skill independentemente do que ela faça. É o que o portão de estrutura mede. _Evitar_: checagem (sozinha), lint, CI.

### Os dois portões que se chamavam "CI"

**Portão de estrutura** — o que pergunta *esta skill está bem construída?* e responde por leitura mecânica de uma árvore só. A falha nomeia o próprio conserto, e é isso que o torna trancável. _Evitar_: CI (sozinha) — nomeia os dois.

**Portão de merge** — o que pergunta *esta união mente? esta suíte quebrou?* e exige julgamento humano para responder. Está deliberadamente fora deste repositório — ver [ADR 0001](docs/adr/0001-estrutura-vira-portao-o-merge-continua-na-mao.md). _Evitar_: CI (sozinha), required check.

### As peças do portão de estrutura

**Família de checagem** — um programa executável de dois verbos: `--describe` imprime as regras que ele impõe, `<skill-dir>` julga uma skill. Descoberto por varredura de `scripts/checks/`, nunca por registro. Acrescentar uma família acrescenta dois arquivos e não toca em nada compartilhado. _Evitar_: regra, check, validador — a família **agrupa** regras, não é uma.

**Prova** — o `<família>.proof.sh` ao lado de uma família, cujo trabalho é plantar o defeito e exigir que a família fique **vermelha**. Checagem só vista verde é documentação. _Evitar_: teste — neste repositório a palavra já pertence à checagem de invocação.

### O workspace irmão de uma skill

Nem toda verificação é **checagem de invocação** (roda dentro da skill) nem **validação de desenvolvimento** (genérica, vale para qualquer skill) — falta a que testa o motor de UMA skill específica: geometria, determinismo, semântica. Ela não serve a nenhuma outra skill do repositório, e a skill instalada nunca a roda — então não é nem uma nem outra, e ficar dentro da árvore só infla o pacote publicado. Mora num diretório irmão, `workbench/<nome-da-skill>/`, rastreado neste mesmo repositório e apontando **para dentro** da skill que testa — nunca o inverso, porque instalar a skill não instala o irmão. O #44 abriu a primeira instância, `workbench/panlabs-aws-diagrams/`, com a suíte de 8 camadas e o corpus de modelos que ela come; o #45 estendeu a mesma árvore com a bancada (`tools/`) e o catálogo de extração/conferência (`catalog/`) — o resto do que a execução não usa. _Evitar_: bancada (sozinha — hoje é só uma parte do que este diretório guarda, não o nome dele), corpus de testes (sozinho) — a confusão que motivou o nome é exatamente com as duas categorias acima.

### As duas camadas em que uma regra nasce

Distinção decidida no [ADR 0001](docs/adr/0001-estrutura-vira-portao-o-merge-continua-na-mao.md), que também fixa o que fazer com ela.

**Regra de estrutura** — a que o servidor aplica. Mora numa família de checagem, e `scripts/check-skills.sh --list` a imprime. _Evitar_: convenção, padrão — nenhum dos dois diz quem aplica.

**Regra de sessão** — a que ninguém aplica além de quem está na sessão. Mora em prosa — [`CLAUDE.md`](CLAUDE.md) e [`docs/agents/`](docs/agents/) — porque não há como reprová-la por leitura mecânica. _Evitar_: convenção, boa prática, aviso — este repositório não tem categoria de aviso.
