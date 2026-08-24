#!/usr/bin/env bash
# O "antes" — e ele não é reconstituição.
#
#   tools/gerar-antes.sh [ref-git]
#
# O #11 guardou o antes dele (`antes-rotulo-fora-do-elk.png`) desligando uma
# entrega no motor. Aqui não precisa de chave: o motor de antes ESTÁ no git.
# Este script materializa o `motor/` e o `catalog/` como estavam no fechamento
# do #12 — quando a ordem das linhas ainda caía de exposição + alfabeto — e roda
# esse motor contra o modelo de HOJE.
#
# Sem chave de compatibilidade não sobra nenhum galho morto no motor só para
# provar uma coisa; e o antes é o binário de antes, não uma imitação dele.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q22="$(dirname "$AQUI")"
REPO="$(git -C "$Q22" rev-parse --show-toplevel)"
REF="${1:-a83b48a}"                    # fechamento do #12 — o motor sem a camada
REL='skills/panlabs-aws-diagrams'

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git -C "$REPO" archive "$REF" "$REL/prototypes/q11/motor" "$REL/catalog" | tar -x -C "$TMP" || {
  echo "não consegui materializar o motor em $REF"; exit 1; }

# Este `package.json` de uma linha não é zelo — é cicatriz.
#
# O Node resolve o tipo de módulo pelo `package.json` MAIS PRÓXIMO subindo do
# arquivo, e a extração do AppImage do draw.io (#9/#10) deixa um
# `/tmp/package.json` — o do próprio draw.io — na raiz do diretório temporário.
# Com ele por cima, o `elk.bundled.js` (UMD) era carregado com semântica de ESM
# e `require` devolvia `{}`: o erro que aparecia era "ELK is not a constructor",
# a 1.600 km da causa. Ancorar o tipo aqui torna a extração imune ao que houver
# acima dela, qualquer que seja o `TMPDIR`.
printf '{"type":"commonjs"}\n' > "$TMP/package.json"

MOTOR="$TMP/$REL/prototypes/q11/motor/gerar.cjs"
[ -f "$MOTOR" ] || { echo "motor ausente em $REF"; exit 1; }

echo "  motor de $REF (pré-#22), modelo de hoje:"
node "$MOTOR" "$Q22/modelo/web-dados.json" \
  --saida "$Q22/saida/antes-ordem-alfabetica.drawio" 2>&1 | sed 's/^/    /'
