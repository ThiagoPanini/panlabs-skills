#!/usr/bin/env bash
# A MEDIÇÃO QUE ESCOLHEU O MOTOR DE PRODUÇÃO — reprodutível, não afirmada.
#
#   tools/measure-candidates.sh [ref]        # default: HEAD
#
# O #23 pede o motor escolhido "por medição, não por data", e uma medição que só
# existe em prosa é exatamente o tipo de afirmação que este ticket nasceu para
# acabar. Então ela roda: este script materializa os DOIS candidatos a partir do
# git, põe cada um no lugar do outro, e roda a UNIÃO dos checks dos quatro
# protótipos contra os dois.
#
# ⚠️ ISTO É ARQUEOLOGIA, e por isso é ferramenta e não checagem da suíte. Depende
# de `prototypes/` existir no ref pedido. Quando os protótipos saírem da árvore, o
# script avisa e sai limpo — a pergunta que ele responde já terá sido respondida.
#
# O ANCESTRAL COMUM é `daf4bc4` e o número não foi escolhido: é o commit em que o
# #13 forkou o motor. Achado assim, e conferível:
#
#     git log --oneline -- skills/.../prototypes/q13/engine/derive.cjs
#     # -> daf4bc4, único commit; e naquele commit
#     git show daf4bc4:.../q11/engine/derive.cjs | sha256sum
#     git show daf4bc4:.../q13/engine/derive.cjs | sha256sum   # o MESMO hash
set -uo pipefail

REF="${1:-HEAD}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$AQUI")"
REPO="$(cd "$RAIZ/../.." && pwd)"
P="skills/panlabs-aws-diagrams/prototypes"
BASE="daf4bc4"

if ! git -C "$REPO" cat-file -e "$REF:$P/q13/engine/layout.cjs" 2>/dev/null; then
  echo "  os protótipos não existem em '$REF' — não há o que medir."
  echo "  (é o estado esperado depois que eles saírem da árvore; a medição já"
  echo "   foi feita e registrada)"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ⚠️ O `package.json` ESQUECIDO EM /tmp — o achado de brinde do #22, e ele mata
# este script em silêncio se ninguém guardar contra.
#
# A extração do AppImage do draw.io deixa `/tmp/package.json` com
# `"type": "module"`. O `elk.bundled.js` é `.js`, então o Node procura o
# `package.json` mais próximo subindo do diretório dele — e num sandbox criado
# por `mktemp -d` esse arquivo é o do draw.io. O UMD do elk passa a ser lido
# como ESM e o erro que sai é `ELK is not a constructor`, que não fala de nada
# disso. Um `package.json` nosso na raiz do sandbox encerra a busca antes.
printf '{ "type": "commonjs" }\n' > "$TMP/package.json"

extrair() {  # extrair <ref> <caminho-no-repo> <destino>
  mkdir -p "$3"
  git -C "$REPO" archive "$1" "$2" | tar -x -C "$TMP/_x" 2>/dev/null || return 1
  cp -r "$TMP/_x/$2/." "$3"
}

# ── as duas variantes ────────────────────────────────────────────────────────
# A: o motor do #11 no lugar dele.  B: o motor do #13 no lugar do #11, com o
# tema ao lado (é de lá que o `resolve.cjs` dele carrega o tema).
for V in A B; do
  rm -rf "$TMP/_x"; mkdir -p "$TMP/_x" "$TMP/$V"
  extrair "$REF" "skills/panlabs-aws-diagrams/catalog" "$TMP/$V/catalog"
  rm -rf "$TMP/_x"; mkdir -p "$TMP/_x"
  extrair "$REF" "$P" "$TMP/$V/prototypes"
done
rm -rf "$TMP/B/prototypes/q11/motor"
cp -r "$TMP/B/prototypes/q13/motor" "$TMP/B/prototypes/q11/motor"
cp -r "$TMP/B/prototypes/q13/tema"  "$TMP/B/prototypes/q11/tema"

# ── a união dos checks ───────────────────────────────────────────────────────
medir() {
  local R="$1" ROT="$2"
  local Q11="$R/prototypes/q11" Q12="$R/prototypes/q12"
  local Q14="$R/prototypes/q14" Q18="$R/prototypes/q18"
  local falhas=0 total=0
  linha() {
    local nome="$1"; shift
    local saida rc
    total=$((total+1))
    saida="$("$@" 2>&1)"; rc=$?
    if [ $rc -eq 0 ]; then printf '    %-38s verde\n' "$nome"
    else
      printf '    %-38s VERMELHO  %s\n' "$nome" \
        "$(echo "$saida" | grep -iE '✗|error|inválido|falh' | head -1 | cut -c1-96)"
      falhas=$((falhas+1))
    fi
  }
  echo
  echo "  ── $ROT"
  linha "#11 fronteira"        node "$Q11/tools/check-fronteira.cjs"
  linha "#11 validacao"        node "$Q11/tools/check-validation.cjs"
  for m in "$Q11"/models/*.json; do
    linha "#11 gerar $(basename "$m" .json)" \
      node "$Q11/engine/generate.cjs" "$m" --output "$Q11/output/$(basename "$m" .json).drawio"
  done
  linha "#11 determinismo"     node "$Q11/tools/check-determinism.cjs"
  linha "#12 gatilhos"         node "$Q12/tools/check-triggers.cjs"
  for m in "$Q12"/models/*.json; do
    nome="$(basename "$m" .json)"
    linha "#12 gerar $nome" node "$Q11/engine/generate.cjs" "$m" \
      --output "$Q12/output/$(echo "$nome" | sed 's/-[0-9]*-contas$//;s/-3-az$//').drawio"
  done
  linha "#12 travessia"        node "$Q12/tools/check-traversal.cjs"
  linha "#12 determinismo"     node "$Q11/tools/check-determinism.cjs" "$Q12/modelo"
  linha "#12 bissecao"         node "$Q12/tools/bisect-model.cjs" "$Q12/models/hub-tgw-3-accounts.json"
  linha "#14 fronteira"        node "$Q14/tools/check-fronteira.cjs"
  linha "#14 motor-intocado"   node "$Q14/tools/check-engine-untouched.cjs"
  linha "#14 sessao1"          node "$Q14/sessao1.cjs"
  linha "#14 sessao2"          node "$Q14/sessao2.cjs"
  linha "#14 projecao"         node "$Q14/tools/check-projection.cjs"
  linha "#14 impressao"        node "$Q14/tools/medir-fingerprint.cjs"
  linha "#18 indice"           node "$Q18/tests/check-index.cjs"
  linha "#18 primitivas"       node "$Q18/tests/check-primitives.cjs"
  linha "#18 quebrados"        node "$Q18/tests/check-broken.cjs"
  linha "#18 portao"           node "$Q18/tests/check-gate.cjs"
  linha "#18 bons"             node "$Q18/tests/check-good.cjs"
  printf '\n    ==> %s: %s VERMELHO(S) de %s\n' "$ROT" "$falhas" "$total"
}

echo "  a união dos checks dos quatro protótipos, contra os dois candidatos"
echo "  ref: $REF · ancestral comum: $BASE"
medir "$TMP/A" "A — motor do #11 (com o #12 e o #22 dentro)"
medir "$TMP/B" "B — motor do #13 (com a camada de tema dentro)"

# ── o tamanho dos dois deltas ────────────────────────────────────────────────
echo
echo "  o delta de cada lado a partir do ancestral comum ($BASE)"
echo "  tema = q13/motor@$REF  ·  tronco = q11/motor@$REF (o #12 mais o #22)"
echo
printf '  %-16s %10s %10s\n' arquivo 'tema #13' 'tronco'
printf '  %s\n' "----------------------------------------"
soma_t=0; soma_m=0
for f in align.cjs derive.cjs layout.cjs emit.cjs generate.cjs plan.cjs resolve.cjs validate.cjs schema.json; do
  conta() {  # conta <ref-a>:<caminho-a> <ref-b>:<caminho-b>
    local a b
    a="$TMP/_a"; b="$TMP/_b"
    git -C "$REPO" show "$1" > "$a" 2>/dev/null || : > "$a"
    git -C "$REPO" show "$2" > "$b" 2>/dev/null || : > "$b"
    diff -u "$a" "$b" | grep -c '^[+-][^+-]' || true
  }
  t="$(conta "$BASE:$P/q11/engine/$f" "$REF:$P/q13/engine/$f")"
  m="$(conta "$BASE:$P/q11/engine/$f" "$REF:$P/q11/engine/$f")"
  soma_t=$((soma_t + t)); soma_m=$((soma_m + m))
  printf '  %-16s %10s %10s\n' "$f" "$t" "$m"
done
printf '  %s\n' "----------------------------------------"
printf '  %-16s %10s %10s\n' TOTAL "$soma_t" "$soma_m"
echo
echo "  Leitura: o candidato com MENOS vermelhos é o tronco; o delta MENOR é o que"
echo "  se enxerta. As duas colunas apontam para o mesmo lado, e é isso que faz a"
echo "  decisão ser medida em vez de argumentada."
