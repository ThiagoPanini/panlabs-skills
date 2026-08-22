#!/usr/bin/env bash
# A régua do protótipo do #14. Sete camadas.
#
# As cinco primeiras rodam em qualquer máquina. As duas últimas precisam do
# draw.io headless (#9/#10) e avisam e seguem quando ele não existe — premissa 8
# do #1: o renderizador é dependência de DESENVOLVIMENTO, não de execução.
set -u
cd "$(dirname "$0")/.."

falhas=0
camada() {
  echo ""
  echo "── $1"
  shift
  if "$@"; then :; else falhas=$((falhas + 1)); echo "   ✗ falhou"; fi
}

camada "1 · fronteira — o esquema novo também não tem onde escrever coordenada" \
  node tools/check-fronteira.cjs

camada "2 · o motor do #11 não mudou um byte" \
  node tools/check-motor-intocado.cjs

camada "3 · sessão 1 — vista lógica aprovada e persistida" \
  node sessao1.cjs

camada "4 · sessão 2 — retomada, elaboração técnica, duas páginas" \
  node sessao2.cjs

camada "5 · projeção — o acordo, com experimento de controle (12 mutações)" \
  node tools/check-projecao.cjs

camada "6 · impressão — 10 edições humanas × 3 esquemas" \
  node tools/medir-impressao.cjs

camada "7 · divergência — o que a skill diz quando o humano editou" \
  node tools/demo-divergencia.cjs

camada "8 · round-trip do arquivo de duas páginas pelo app" \
  node tools/check-roundtrip.cjs

camada "9 · onde o metadado sobrevive (precisa do app)" \
  node tools/medir-hospedeiro.cjs

echo ""
if [ "$falhas" -eq 0 ]; then
  echo "suite verde"
else
  echo "✗ $falhas camada(s) falharam"
  exit 1
fi
