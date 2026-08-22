#!/usr/bin/env bash
# Renderiza vários .drawio, LIMPANDO o ambiente entre um e outro.
#
# A limpeza entre renders não é higiene opcional: um render abortado deixa
# processo vivo, e o próximo render herda uma máquina saturada e falha por
# motivo alheio ao arquivo. Sem isso, as medições não são comparáveis.
#
#   tools/render-lote.sh a.drawio b.drawio ...
set -uo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
falhou=0

for d in "$@"; do
  "$AQUI/limpar-render.sh" >/dev/null 2>&1
  png="${d%.drawio}.png"
  if "$AQUI/render.sh" "$d" "$png" 2>&1 | tail -3; then :; else falhou=1; fi
done

"$AQUI/limpar-render.sh" >/dev/null 2>&1
exit "$falhou"
