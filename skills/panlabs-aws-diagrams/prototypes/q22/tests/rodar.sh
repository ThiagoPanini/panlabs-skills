#!/usr/bin/env bash
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q22="$(dirname "$AQUI")"
DRAWIO="${1:-${DRAWIO_BIN:-$HOME/.local/opt/drawio/squashfs-root/AppRun}}"

echo "== interface pública e ordem renderizada =="
node --test "$AQUI/ordem-integracao.test.cjs"

echo
echo "== sintaxe =="
node --check "$Q22/camadas.cjs"
node --check "$Q22/gerar.cjs"

echo
echo "== regenerar as quatro provas =="
for modelo in "$Q22"/modelo/*.json; do
  nome="$(basename "$modelo" .json)"
  node "$Q22/gerar.cjs" "$modelo" --saida "$Q22/saida/$nome.drawio"
done

echo
echo "== render =="
if [ ! -x "$DRAWIO" ]; then
  echo "draw.io headless não encontrado em $DRAWIO — PNGs existentes preservados."
else
  for desenho in "$Q22"/saida/*.drawio; do
    png="${desenho%.drawio}.png"
    xvfb-run -a "$DRAWIO" -x -f png -s 2 --no-sandbox --disable-gpu -o "$png" "$desenho" 2>/dev/null
    test -s "$png"
    echo "$(basename "$png") ok"
  done
fi

echo
echo "suite verde"
