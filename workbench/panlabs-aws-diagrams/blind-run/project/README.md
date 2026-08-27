# labmove-platform

A plataforma da LabMove — agendamento da coleta domiciliar, o portal que o técnico usa na rua, e a entrega do laudo ao paciente.

## Os serviços

| | |
| --- | --- |
| [`services/scheduling/`](services/scheduling/) | agenda a coleta, monta a rota do técnico, e é o que o aplicativo do paciente consome |
| [`services/results/`](services/results/) | recebe o laudo do laboratório parceiro, normaliza, e libera para o paciente |

Os dois rodam em contas AWS separadas — `agendamento` e `resultados`. A separação é regulatória antes de ser técnica, e o porquê está no [ADR 0001](docs/architecture/adr/0001-o-laudo-mora-atras-da-propria-fronteira.md).

## Rodando local

```bash
make bootstrap     # sobe o postgres e o localstack do compose
make test          # a suíte dos dois serviços
```

## Onde ficam as decisões

Em [`docs/architecture/`](docs/architecture/). Decisão que muda a forma do sistema e não está escrita lá não foi decidida — foi feita, e a próxima pessoa não tem como saber.
