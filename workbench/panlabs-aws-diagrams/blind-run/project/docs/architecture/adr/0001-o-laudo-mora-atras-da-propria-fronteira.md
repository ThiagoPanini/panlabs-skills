# 0001 — O laudo mora atrás da própria fronteira de conta

Aceita. Substitui a conta única com que a plataforma nasceu.

## Contexto

Laudo de exame é dado de saúde. A auditoria do ano passado apontou que agendamento e laudo dividiam a mesma conta AWS, o mesmo conjunto de papéis e a mesma trilha de acesso: quem conseguia ler a agenda de coletas conseguia, com o mesmo papel, ler o resultado do exame. Ninguém precisava disso para trabalhar, e separação por convenção de nome de bucket não é fronteira — é etiqueta.

## Decisão

Duas contas: `agendamento` e `resultados`. O agendamento não toca laudo nenhum — ele conhece a coleta por um identificador e para aí. O acesso à conta `resultados` é concedido a menos gente, e a concessão é revisada a cada trimestre.

## Consequência

Toda travessia entre os dois lados passa a ser explícita e auditável, e nenhuma delas é implícita por estarem no mesmo lugar. O custo é operação em dobro — duas trilhas, dois orçamentos, dois conjuntos de alarme — e a plataforma aceita esse custo.

## O que reabre

Uma terceira fronteira aparecer com o mesmo argumento. Duas contas se administram à mão; seis, não, e aí a resposta passa a ser organização de contas com política herdada, em vez de mais uma conta escrita uma a uma.
