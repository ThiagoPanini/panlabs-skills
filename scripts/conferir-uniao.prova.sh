#!/usr/bin/env bash
# A PROVA de que `conferir-uniao.sh` mede — as três colisões silenciosas plantadas
# num repo descartável, e a régua tendo de reprovar cada uma.
#
#   scripts/conferir-uniao.prova.sh
#
# Existe porque checagem que só foi vista verde é documentação: as três daqui
# passam por vacuidade se a consulta estiver errada, e nenhuma delas dispara na
# árvore real com frequência suficiente para ser vista falhar por acidente.
set -uo pipefail

REGUA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/conferir-uniao.sh"
[ -x "$REGUA" ] || { echo "✗ régua não encontrada: $REGUA"; exit 2; }

BANCADA="$(mktemp -d)"
trap 'rm -rf "$BANCADA"' EXIT

falhou=0
exige() { # exige <título> <esperado: verde|vermelho> <padrão-na-saída> <saída> <código>
  local titulo="$1" esperado="$2" padrao="$3" saida="$4" codigo="$5"
  local obtido="verde"; [ "$codigo" -ne 0 ] && obtido="vermelho"
  if [ "$obtido" = "$esperado" ] && grep -qF -- "$padrao" <<< "$saida"; then
    printf '   ✓ %s\n' "$titulo"
  else
    printf '   ✗ %s — esperava %s com "%s", veio %s\n' "$titulo" "$esperado" "$padrao" "$obtido"
    sed 's/^/       | /' <<< "$saida"
    falhou=1
  fi
}

montar() { # monta um repo com base, um lado "outro" e um lado "meu"
  local r="$BANCADA/$1"; mkdir -p "$r/docs/adr" "$r/guia"; cd "$r" || exit 2
  git init -q -b main .
  git config user.email prova@local; git config user.name prova
  mkdir -p scripts && cp "$REGUA" scripts/
  echo "linha 1" > a.txt
  printf 'linha 1\nlinha 2\nlinha 3\nlinha 4\nlinha 5\n' > longo.txt
  echo "# adr um" > docs/adr/0001-primeiro.md
  echo "regra velha" > guia/velho.md
  echo "aponta para [velho](guia/velho.md)" > SKILL.md
  echo "intocado" > sozinho.txt
  git add -A && git commit -qm base
}

echo "════ a prova · conferir-uniao.sh reprova as três, e absolve a limpa ════"

# ── 1 · INTERSEÇÃO ────────────────────────────────────────────────────────────
# Mesmo arquivo, linhas distintas: o git mergeia limpo e a régua tem de barrar.
montar interseccao
git switch -qc outro
sed -i '1s/.*/OUTRO mexeu aqui/' longo.txt && git commit -qam "outro"
git switch -qc meu main
sed -i '5s/.*/EU mexi aqui/' longo.txt && git commit -qam "meu"
git merge-tree --write-tree outro meu > /dev/null 2>&1 \
  && printf '   · premissa: o git mergeia esta sem conflito\n' \
  || printf '   ⚠️ premissa falhou: o git JÁ reprova esta\n'
saida="$(bash scripts/conferir-uniao.sh outro 2>&1)"; codigo=$?
exige "interseção reprovada" vermelho "longo.txt" "$saida" "$codigo"

# ── 2 · NÚMERO TOMADO ─────────────────────────────────────────────────────────
# Dois ADRs `0002-*` com slugs diferentes: dois arquivos, zero conflito.
montar numero
git switch -qc outro
echo "# deles" > docs/adr/0002-decisao-deles.md && git add -A && git commit -qm "outro"
git switch -qc meu main
echo "# meus" > docs/adr/0002-decisao-minha.md && git add -A && git commit -qm "meu"
saida="$(bash scripts/conferir-uniao.sh outro 2>&1)"; codigo=$?
exige "número tomado reprovado" vermelho "0002" "$saida" "$codigo"

# ── 3 · PONTEIRO PENDENTE ─────────────────────────────────────────────────────
# O outro lado move `guia/velho.md`; eu edito o SKILL.md que ainda o cita.
montar ponteiro
git switch -qc outro
git mv guia/velho.md guia/novo.md && git commit -qm "outro move"
git switch -qc meu main
echo "e mais uma linha" >> SKILL.md && git commit -qam "meu edita o SKILL"
saida="$(bash scripts/conferir-uniao.sh outro 2>&1)"; codigo=$?
exige "ponteiro pendente reprovado" vermelho "guia/velho.md" "$saida" "$codigo"

# ── 4 · O CONTROLE ────────────────────────────────────────────────────────────
# Territórios disjuntos: a régua não pode inventar colisão.
montar limpo
git switch -qc outro
echo "outro" >> a.txt && git commit -qam "outro"
git switch -qc meu main
echo "meu" >> sozinho.txt && git commit -qam "meu"
saida="$(bash scripts/conferir-uniao.sh outro 2>&1)"; codigo=$?
exige "território disjunto absolvido" verde "união verde" "$saida" "$codigo"

echo
if [ "$falhou" -ne 0 ]; then
  echo "PROVA VERMELHA — a régua não mede o que diz medir."
  exit 1
fi
echo "prova verde — as três colisões silenciosas ficam vermelhas, e a limpa passa."
