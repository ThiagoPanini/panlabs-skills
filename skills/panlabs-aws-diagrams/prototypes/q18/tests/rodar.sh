#!/usr/bin/env bash
# Suíte do validador geométrico (#18).
#
#   ./tests/rodar.sh
#
# Cinco camadas, e a ordem tem motivo. O índice vem primeiro porque, se ele
# derivou da rubrica, todo o resto está medindo uma lista que não é mais a das
# 62. As primitivas vêm em seguida porque uma conta de geometria ou de cor
# errada não estoura — ela devolve um número plausível, e as checagens ficam
# verdes por não terem achado nada.
#
# Só depois disso vale rodar o validador: primeiro contra os defeitos, que é
# onde ele PROVA que mede (a convenção que o `check-fronteira.cjs` do #11
# estabeleceu), e por último contra os diagramas bons do #11, que é o critério
# de aceite escrito no ticket.
#
# Sem dependência: só `node`. Nenhum passo aqui precisa do draw.io — o render é
# do juiz oportunista, não do validador, e essa divisão é a decisão 5 do #18.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q18="$(dirname "$AQUI")"
falhou=0

echo "== 1. o índice bate com a rubrica (as 62, com severidade e insumo) =="
node "$Q18/tests/check-indice.cjs" || falhou=1

echo
echo "== 2. as primitivas batem com valor publicado (WCAG, Sharma et al. 2005) =="
node "$Q18/tests/check-primitivas.cjs" || falhou=1

echo
echo "== 3. o validador reprova o que deve, e absolve o que não deve =="
node "$Q18/tests/check-quebrados.cjs" || falhou=1

echo
echo "== 4. o portão barra o que mente e cabe entre planejar e emitir =="
node "$Q18/tests/check-portao.cjs" || falhou=1

echo
echo "== 5. os diagramas bons do #11, laudados =="
# Não usa `|| falhou=1`: os exemplos do #11 TÊM falhas reais (sem legenda, sem
# metadados, contraste de título abaixo de 4,5:1), e são achados do protótipo,
# não regressão da suíte. O que a suíte cobra aqui é que nenhuma falha
# SEMÂNTICA apareça — o desenho pode estar incompleto, não pode estar mentindo.
node "$Q18/tests/check-bons.cjs" || falhou=1

echo
if [ "$falhou" -ne 0 ]; then echo "SUITE VERMELHA"; exit 1; fi
echo "suite verde"
