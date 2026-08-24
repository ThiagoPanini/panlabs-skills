# Caso 1 · Rede de clínicas — prontuário eletrônico

**Gênero** `T1` referência com consciência de rede · **caminho de layout** grade ·
**entrada** `modelo@1` direto

## O que o usuário disse

> "A gente tem 40 unidades e o prontuário hoje roda numa máquina no escritório
> central. Precisa ir para a nuvem. As unidades já têm link dedicado com a
> matriz, então elas não entram pela internet. O jurídico é duro com isso: dado
> de saúde é dado sensível, e eles não aceitam nada do prontuário exposto. Laudo
> e imagem de exame a gente guarda por 20 anos por obrigação do CFM. E não pode
> cair — se cair, a recepção volta para o papel."

## O que a sabatina extraiu

| eixo | resposta |
|---|---|
| `E1` postura de computação | contêiner gerenciado, sem servidor próprio |
| `E2` estilo de integração | síncrono, requisição do consultório |
| `E3` estado e dados | relacional com réplica + objeto para laudo |
| `E4` exposição de rede | **privado** — entrada só por Direct Connect |
| `E5` fronteira de responsabilidade | uma só (é um sistema, não uma plataforma) |

**Sonda condicional destravada:** *"não pode cair"* → duas AZs? → sim, mas o cache
de sessão pode ficar em uma só (**achado recusado**, vira nota no desenho).

## O que exercita

Árvore `nuvem › vpc › subnet` com a dimensão `az`, camada de rede **derivada do
conteúdo** (nenhuma subnet declara `camada`), e a nota de premissa LGPD chegando
ao desenho.
