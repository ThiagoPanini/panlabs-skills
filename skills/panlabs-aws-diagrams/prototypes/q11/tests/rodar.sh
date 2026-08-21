#!/usr/bin/env bash
# Suite do motor, ponta a ponta.
#
#   ./tests/rodar.sh [binario-drawio]
#
# Quatro camadas. As três primeiras rodam em qualquer máquina — são a régua que
# a skill publicada leva junto. A quarta precisa do draw.io headless e é
# DEPENDÊNCIA DE DESENVOLVIMENTO (premissa 8 do mapa): se o binário não existir,
# avisa e segue, em vez de falhar.
#
# A ordem não é acidental: a fronteira é a primeira porque, se ela vazou, todo
# o resto do motor está defendendo uma regra que já não vale.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q11="$(dirname "$AQUI")"
DRAWIO="${1:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
falhou=0

echo "== 1. a fronteira (o agente não tem onde escrever coordenada) =="
node "$Q11/tools/check-fronteira.cjs" || falhou=1

echo
echo "== 2. validação (reprova o que deve, e explica) =="
node "$Q11/tools/check-validacao.cjs" || falhou=1

echo
echo "== 3. geração dos exemplos =="
for m in "$Q11"/modelo/*.json; do
  nome="$(basename "$m" .json)"
  node "$Q11/motor/gerar.cjs" "$m" --saida "$Q11/saida/$nome.drawio" || falhou=1
done

echo
echo "== 4. determinismo =="
node "$Q11/tools/check-determinismo.cjs" || falhou=1

echo
echo "== 5. round-trip do modelo embutido =="
node "$Q11/tools/check-roundtrip.cjs" "$DRAWIO" || falhou=1

echo
echo "== 6. render (dependência de desenvolvimento) =="
if [ ! -x "$DRAWIO" ]; then
  echo "   draw.io headless não encontrado em $DRAWIO — render pulado."
  echo "   (ver docs/research/drawio-headless-rendering-wsl2.md)"
else
  for d in "$Q11"/saida/*.drawio; do
    # a variante animada NÃO vai para PNG: o #4 mediu e este motor confirmou que
    # o `flowAnimation` vira tracejado estático, sem erro. PNG dela seria prova falsa.
    if [[ "$(basename "$d")" == *animado* ]]; then
      svg="${d%.drawio}.svg"
      xvfb-run -a "$DRAWIO" -x -f svg --no-sandbox --disable-gpu -o "$svg" "$d" 2>/dev/null
      if grep -q 'ge-flow-animation' "$svg" 2>/dev/null; then
        echo "   $(basename "$svg") ok (animação presente)"
      else
        echo "   $(basename "$svg") SEM ANIMAÇÃO"; falhou=1
      fi
      continue
    fi
    png="${d%.drawio}.png"
    xvfb-run -a "$DRAWIO" -x -f png -s 2 --no-sandbox --disable-gpu -o "$png" "$d" 2>/dev/null
    [ -s "$png" ] && echo "   $(basename "$png") ok" || { echo "   $(basename "$png") VAZIO"; falhou=1; }
  done
fi

echo
if [ "$falhou" -ne 0 ]; then echo "SUITE VERMELHA"; exit 1; fi
echo "suite verde"
