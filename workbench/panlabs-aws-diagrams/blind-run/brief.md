A LabMove faz coleta domiciliar de exames laboratoriais. O paciente agenda pelo aplicativo, um técnico nosso vai até a casa dele, coleta o material e leva para um laboratório parceiro; o resultado volta pelo aplicativo alguns dias depois. Somos oito pessoas de engenharia e hoje roda tudo numa conta AWS só, o que já está apertado.

O que já está decidido é a separação em duas contas AWS, `agendamento` e `resultados`. A razão é regulatória: laudo de exame é dado de saúde, e a auditoria pediu que o ambiente que guarda laudo tenha fronteira própria, com acesso concedido a menos gente. O agendamento não toca laudo nenhum — ele sabe que existe uma coleta com um identificador, e para aí.

Os laudos chegam dos laboratórios parceiros por integração, e cada laboratório manda do jeito dele — hoje são três formatos diferentes. Depois de chegar, o laudo passa por uma normalização nossa antes de ficar disponível para o paciente. Esse processamento não é imediato, e não pode perder nada: quando um laudo se perde, a gente descobre pela reclamação do paciente.

O aplicativo do paciente é um cliente móvel que fala com uma API nossa, e o portal do técnico é web. Nada disso responde sem autenticação, e o banco onde o laudo fica não pode estar exposto à internet de jeito nenhum.

Não temos preferência de tecnologia — o time sabe Python e um pouco de Node, e ninguém aqui é especialista em AWS. Queremos o desenho para levar à reunião de arquitetura da semana que vem.
