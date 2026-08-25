#!/usr/bin/env bash
# Suite do catálogo, ponta a ponta.
#
#   ./tests/rodar.sh [repo-drawio] [binario-drawio]
#
# Duas camadas, e a diferença entre elas importa:
#
#   1. check-catalog     — estática, sem renderizar. Roda em qualquer máquina.
#   2. render + verificar — precisa do draw.io headless. É DEPENDÊNCIA DE
#      DESENVOLVIMENTO: a skill publicada não renderiza nada. Se o binário não
#      existir, a suite avisa e passa só a camada estática, em vez de falhar.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAT="$(dirname "$AQUI")"
REPO="${1:-/tmp/drawio}"
DRAWIO="${2:-$HOME/.local/opt/drawio/squashfs-root/drawio}"

falhou=0

echo "== 1. checagens estáticas =="
if [ -d "$REPO" ]; then
  node "$CAT/tools/check-catalog.cjs" "$REPO" || falhou=1
else
  echo "   (repo do draw.io ausente em $REPO — round-trip pulado)"
  node "$CAT/tools/check-catalog.cjs" || falhou=1
fi

echo
echo "== 2. amostra =="
node "$CAT/tools/render-sample.cjs" || falhou=1

echo
echo "== 3. render + verificação por pixel =="
if [ ! -x "$DRAWIO" ]; then
  echo "   draw.io headless não encontrado em $DRAWIO — render pulado."
  echo "   (dependência de desenvolvimento: draw.io Desktop AppImage + xvfb;"
  echo "    tools/drawio.cjs é quem sabe onde o binário mora)"
else
  xvfb-run -a "$DRAWIO" -x -f png -s 2 --no-sandbox --disable-gpu \
    -o "$AQUI/amostra.png" "$AQUI/amostra.drawio" 2>/dev/null
  python3 "$CAT/tools/verificar-render.py" "$AQUI/amostra.png" "$AQUI/amostra.manifesto.json" || falhou=1
fi

echo
if [ "$falhou" -ne 0 ]; then
  echo "SUITE VERMELHA"
  exit 1
fi
echo "suite verde"
