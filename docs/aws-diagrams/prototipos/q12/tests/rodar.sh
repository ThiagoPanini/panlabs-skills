#!/usr/bin/env bash
# Suite do #12, ponta a ponta.
#
#   ./tests/rodar.sh [binario-drawio]
#
# O motor mora no q11 e é compartilhado — este protótipo não forka o motor, ele
# o estende. Então a suite do q11 é PARTE desta: se ela ficar vermelha, o que o
# #12 acrescentou quebrou o que o #11 provou, e nada mais aqui vale.
#
# A camada de render é dependência de DESENVOLVIMENTO (premissa 8 do mapa): sem
# o binário, avisa e segue.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q12="$(dirname "$AQUI")"
Q11="$(dirname "$Q12")/q11"
DRAWIO="${1:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
falhou=0

echo "== 1. o que o #11 provou continua valendo =="
(cd "$Q11" && ./tests/rodar.sh "$DRAWIO" 2>&1 | grep -E '^(  ✓|  ✗|suite|SUITE|== )') || falhou=1

echo
echo "== 2. os gatilhos do #12 (OU, modo de vista, hierarquia de travessia) =="
node "$Q12/tools/check-gatilhos.cjs" || falhou=1

echo
echo "== 3. geração dos exemplos =="
for m in "$Q12"/modelo/*.json; do
  nome="$(basename "$m" .json)"
  saida="$Q12/saida/$(echo "$nome" | sed 's/-[0-9]*-contas$//;s/-3-az$//')"
  node "$Q11/motor/gerar.cjs" "$m" --saida "$saida.drawio" || falhou=1
  echo
done

echo "== 4. as decisões, conferidas no arquivo =="
node "$Q12/tools/check-travessia.cjs" || falhou=1

echo
echo "== 5. determinismo, inclusive sob reordenação da entrada =="
node "$Q11/tools/check-determinismo.cjs" "$Q12/modelo" || falhou=1

echo
echo "== 6. render (dependência de desenvolvimento) =="
if [ ! -x "$DRAWIO" ]; then
  echo "   draw.io headless não encontrado em $DRAWIO — render pulado."
  echo "   (ver docs/research/drawio-headless-rendering-wsl2.md)"
else
  # o `render-lote` limpa o ambiente entre um render e outro DE PROPÓSITO: um
  # render abortado deixa processo vivo e o próximo falha por motivo alheio ao
  # arquivo. Custou uma bisseção inteira descobrir isso — ver o README.
  "$Q12/tools/render-lote.sh" "$Q12"/saida/*.drawio || falhou=1
fi

echo
if [ "$falhou" -ne 0 ]; then echo "SUITE VERMELHA"; exit 1; fi
echo "suite verde"
