#!/usr/bin/env bash
# Suite do protótipo #13 — a camada de estilo e tema.
#
#   ./tests/rodar.sh [binario-drawio]
#
# Sete camadas, na ordem em que uma falha invalida as seguintes:
#
#   1. VOCABULÁRIO   a camada normativa da AWS é indizível — com experimento de
#                    controle, porque checagem que não sabe falhar não prova nada.
#   2. PARTIÇÃO      pintura não move coordenada; métrica move. É o que sustenta
#                    a afirmação de que estilo e layout são separáveis.
#   3. GERAÇÃO       os quatro temas + as duas armadilhas.
#   4. PORTÃO        o tema "armadilha" TEM de ser reprovado sem --forcar.
#   5. RENDER        dependência de desenvolvimento (premissa 8): avisa e segue.
#   6. ROUND-TRIP    o tema viaja RESOLVIDO dentro do .drawio e volta intacto.
#   7. PIXEL         a lição do #17 — style string certa não é render certo.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q13="$(dirname "$AQUI")"
DRAWIO="${1:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
MODELO="$Q13/modelo/pedidos-serverless.json"
falhou=0

echo "== 1. vocabulário fechado (com controle) =="
node "$Q13/tools/check-vocabulario.cjs" || falhou=1

echo
echo "== 2. partição pintura × métrica =="
node "$Q13/tools/check-particao.cjs" || falhou=1

echo
echo "== 3. geração dos temas =="
node "$Q13/motor/gerar.cjs" "$MODELO" --tema claro       --saida "$Q13/saida/a-claro.drawio"       || falhou=1
node "$Q13/motor/gerar.cjs" "$MODELO" --tema escuro      --saida "$Q13/saida/b-escuro.drawio"      || falhou=1
node "$Q13/motor/gerar.cjs" "$MODELO" --tema corporativo --saida "$Q13/saida/c-corporativo.drawio" || falhou=1
node "$Q13/motor/gerar.cjs" "$Q13/modelo/logica-pedidos.json" --tema claro \
  --saida "$Q13/saida/g-vista-logica.drawio" || falhou=1
node "$Q13/tools/gerar-armadilha.cjs" > /dev/null       || falhou=1
echo "   d-armadilha e e-indizivel gerados (ver tools/gerar-armadilha.cjs)"
node "$Q13/motor/gerar.cjs" "$MODELO" --tema claro --fluxo animado \
  --saida "$Q13/saida/f-fluxo-animado.drawio" > /dev/null || falhou=1
echo "   f-fluxo-animado gerado (só sai em SVG — ver a camada 5)"

echo
echo "== 4. o portão reprova o tema errado =="
if node "$Q13/motor/gerar.cjs" "$MODELO" --tema armadilha --saida /dev/null > /dev/null 2>&1; then
  echo "   ✗ o tema \"armadilha\" PASSOU no portão — o portão não está guardando nada"
  falhou=1
else
  echo "   ✓ \"armadilha\" reprovado sem --forcar, como tem de ser"
fi
if node "$Q13/motor/gerar.cjs" "$MODELO" --tema armadilha --forcar --saida /dev/null > /dev/null 2>&1; then
  echo "   ✓ --forcar gera assim mesmo, para o estrago poder ser visto"
else
  echo "   ✗ --forcar não gerou — a válvula de escape está quebrada"; falhou=1
fi

echo
echo "== 5. render (dependência de desenvolvimento) =="
bash "$Q13/tools/renderizar.sh" "$DRAWIO" || falhou=1

echo
echo "== 6. round-trip do tema pelo codec do app =="
node "$Q13/tools/check-roundtrip-tema.cjs" "$DRAWIO" || falhou=1

echo
echo "== 7. verificação no pixel =="
if command -v python3 > /dev/null && python3 -c "import PIL" 2>/dev/null; then
  python3 "$Q13/tools/verificar-tema.py" --todos || falhou=1
else
  echo "   Pillow ausente — verificação de pixel pulada."
fi

echo
if [ "$falhou" -ne 0 ]; then echo "SUITE VERMELHA"; exit 1; fi
echo "suite verde"
