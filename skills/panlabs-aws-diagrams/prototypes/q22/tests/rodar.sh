#!/usr/bin/env bash
# Suite do #22, ponta a ponta.
#
#   ./tests/rodar.sh [binario-drawio]
#
# O motor mora no q11 e é compartilhado — este protótipo estende, não forka
# (mesma decisão do #12). Então as suites do #11 e do #12 são a PRIMEIRA camada
# desta: a regra de camada mexeu na ordem dos irmãos, que é a espinha dos dois,
# e se algum deles ficar vermelho a resposta daqui não vale.
#
# A camada de render é dependência de DESENVOLVIMENTO (premissa 8 do mapa): sem
# o binário, avisa e segue.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q22="$(dirname "$AQUI")"
Q11="$(dirname "$Q22")/q11"
Q12="$(dirname "$Q22")/q12"
DRAWIO="${1:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
falhou=0

echo "== 1. o que o #11 e o #12 provaram continua valendo =="
(cd "$Q11" && ./tests/rodar.sh "$DRAWIO" 2>&1 | grep -E '^(  ✓|  ✗|suite|SUITE|== )') || falhou=1
(cd "$Q12" && ./tests/rodar.sh "$DRAWIO" 2>&1 | grep -E '^(suite|SUITE)') || falhou=1

echo
echo "== 2. a fronteira, contra os modelos DESTE protótipo =="
# `camada` é campo novo no esquema. Quem diz que ele nomeia semântica e não
# posição não é o README — é esta checagem, rodando contra quem usa o campo.
node "$Q11/tools/check-fronteira.cjs" "$Q22/modelo" || falhou=1
node "$Q11/tools/check-fronteira.cjs" "$Q22/recusa" || falhou=1

echo
echo "== 3. a regra de camada, isolada do pixel =="
node "$Q22/tools/check-camada.cjs" || falhou=1

echo
echo "== 4. a candidata rival, medida no corpus inteiro =="
node "$Q22/tools/check-saltos.cjs" || falhou=1

echo
echo "== 4b. a resposta anterior (9b27d6f), medida contra a que ficou =="
node "$Q22/tools/check-standalone.cjs" || falhou=1

echo
echo "== 5. geração dos exemplos =="
for m in "$Q22"/modelo/*.json; do
  nome="$(basename "$m" .json)"
  node "$Q11/motor/gerar.cjs" "$m" --saida "$Q22/saida/$nome.drawio" || falhou=1
  echo
done

echo "== 5b. o ANTES, gerado pelo motor de antes =="
# Regerar aqui e não uma vez só: foi exatamente por ficar fora do laço que as
# variantes de fluxo do #11 envelheceram caladas — ver o comentário na suite de lá.
"$Q22/tools/gerar-antes.sh" || falhou=1

echo
echo "== 6. o que NÃO gera, e a mensagem que sai no lugar =="
# Um modelo que falha é prova só se a suite exigir que ele falhe. Se um dia a
# recusa deixar de disparar, é aqui que se descobre — não no render.
for m in "$Q22"/recusa/*.json; do
  nome="$(basename "$m" .json)"
  saida="$(node "$Q11/motor/gerar.cjs" "$m" --saida /dev/null 2>&1)"
  if [ $? -eq 0 ]; then
    echo "   ✗ $nome GEROU — a recusa deixou de disparar"; falhou=1
  elif echo "$saida" | grep -q 'camada de rede'; then
    echo "   ✓ $nome recusado, e a mensagem nomeia o que falta:"
    echo "$saida" | sed 's/^/       /'
  else
    echo "   ✗ $nome falhou por OUTRO motivo:"; echo "$saida" | sed 's/^/       /'; falhou=1
  fi
done

echo
echo "== 7. determinismo, inclusive sob reordenação da entrada =="
node "$Q11/tools/check-determinismo.cjs" "$Q22/modelo" || falhou=1

echo
echo "== 8. render (dependência de desenvolvimento) =="
if [ ! -x "$DRAWIO" ]; then
  echo "   draw.io headless não encontrado em $DRAWIO — render pulado."
  echo "   (ver docs/research/drawio-headless-rendering-wsl2.md)"
else
  "$Q12/tools/render-lote.sh" "$Q22"/saida/*.drawio || falhou=1
fi

echo
if [ "$falhou" -ne 0 ]; then echo "SUITE VERMELHA"; exit 1; fi
echo "suite verde"
