# Caso 2 · Marketplace de ingressos — a abertura de vendas

**Gênero** `T4` fluxo de requisição numerado · **caminho de layout** grade com AZ
em raia · **entrada** `modelo@1` direto

## O que o usuário disse

> "O problema não é o dia a dia, é a abertura. Show grande, 50 mil pessoas
> apertando F5 no mesmo minuto. Ano passado o site caiu e viramos meme. O que a
> diretoria quer é que quem entrou primeiro compre primeiro — não adianta subir
> máquina, porque aí quem tem internet melhor ganha. E não pode vender o mesmo
> assento duas vezes."

## O que a sabatina extraiu

| eixo | resposta |
|---|---|
| `E1` postura de computação | contêiner com autoscaling |
| `E2` estilo de integração | síncrono numerado — o passo importa |
| `E3` estado e dados | chave-valor com escrita condicional para o assento |
| `E4` exposição de rede | público, com fila virtual na borda |
| `E5` fronteira de responsabilidade | uma só |

**A fila virtual é requisito de negócio, não de capacidade** — vira nota de
premissa. Autoscaling não entrega ordem de chegada.

## O que exercita

`ordem` em **toda** aresta disputando a horizontal com a faixa de AZ (a briga do
#21), mais uma **faixa** de Auto Scaling group cruzando as duas AZs — e é aí que
este caso achou defeito. Ver o laudo.
