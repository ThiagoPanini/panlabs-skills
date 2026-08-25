#!/usr/bin/env bash
# A UNIÃO — o que esta branch mudou × o que o outro lado mudou, desde a base comum.
#
#   scripts/conferir-uniao.sh [OUTRO]        # OUTRO default: origin/main
#
# Roda ANTES de aterrissar, e de novo depois de cada rebase. Responde também
# "estas duas branches abertas colidem?", quando OUTRO é a outra branch.
#
# ── por que existe ────────────────────────────────────────────────────────────
# O git só reprova UMA das quatro colisões de trabalho paralelo (ver
# `docs/agents/workflow.md` § As quatro colisões). As outras três mergeiam VERDE:
#
#   interseção          o mesmo arquivo dos dois lados, em linhas distintas
#   número tomado       dois ADRs alocados no mesmo ponto da reta numérica
#   ponteiro pendente   eu cito um caminho que o outro lado moveu ou apagou
#
# Cada checagem aqui transforma um verde silencioso num vermelho legível. Nenhuma
# descobre o que um humano não pudesse ver — elas descobrem ANTES do merge, que é
# a única diferença que importa depois que ele aconteceu.
set -uo pipefail

OUTRO="${1:-origin/main}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ" || exit 2

if git remote get-url origin > /dev/null 2>&1; then
  git fetch -q origin 2> /dev/null || echo "   ⚠️  sem rede: '$OUTRO' pode estar velho"
fi

git rev-parse --verify -q "$OUTRO" > /dev/null || { echo "✗ ref desconhecida: $OUTRO"; exit 2; }

EU="$(git rev-parse --abbrev-ref HEAD)"
BASE="$(git merge-base HEAD "$OUTRO")" || exit 2

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git diff --name-only "$BASE"...HEAD     | sort > "$TMP/meus"
git diff --name-only "$BASE"..."$OUTRO" | sort > "$TMP/deles"
ANDOU="$(git rev-list --count "$BASE".."$OUTRO")"

printf '\n════ a união · %s × %s ════\n' "$EU" "$OUTRO"
printf '   base %s · o outro lado andou %s commit(s), %s arquivo(s)\n' \
  "$(git rev-parse --short "$BASE")" "$ANDOU" "$(wc -l < "$TMP/deles")"

falhou=0

# ── 1 · INTERSEÇÃO ────────────────────────────────────────────────────────────
# O mesmo caminho dos dois lados. Em linhas distintas o git mergeia limpo, e o
# resultado é um arquivo que nenhum dos dois autores leu inteiro.
printf '\n── interseção (o mesmo arquivo dos dois lados)\n'
comm -12 "$TMP/meus" "$TMP/deles" > "$TMP/inter"
if [ -s "$TMP/inter" ]; then
  printf '   ✗ %s arquivo(s):\n' "$(wc -l < "$TMP/inter")"
  sed 's/^/       /' "$TMP/inter"
  falhou=1
else
  echo "   ✓ nenhum"
fi

# ── 2 · NÚMERO TOMADO ─────────────────────────────────────────────────────────
# `docs/adr/NNNN-slug.md` é uma reta numérica compartilhada, e alocar nela é a
# única escrita deste repo que dois lados fazem sem tocar no mesmo arquivo. Dois
# ADRs `0013-*` mergeiam limpo, e ninguém fica sabendo.
printf '\n── número tomado (dois ADRs no mesmo ponto da reta)\n'
grep '^docs/adr/[0-9]' "$TMP/meus"  | sed 's|docs/adr/\([0-9]*\)-.*|\1|' | sort -u > "$TMP/n-meus"
grep '^docs/adr/[0-9]' "$TMP/deles" | sed 's|docs/adr/\([0-9]*\)-.*|\1|' | sort -u > "$TMP/n-deles"
comm -12 "$TMP/n-meus" "$TMP/n-deles" > "$TMP/n-inter"
if [ -s "$TMP/n-inter" ]; then
  printf '   ✗ número(s) alocado(s) dos dois lados: %s\n' "$(tr '\n' ' ' < "$TMP/n-inter")"
  echo "       renumere o SEU, e refaça os links que apontam para ele"
  falhou=1
else
  echo "   ✓ nenhum"
fi

# ── 3 · PONTEIRO PENDENTE ─────────────────────────────────────────────────────
# O outro lado moveu ou apagou um caminho, e eu continuo citando o velho. Texto
# mergeia com texto: o ponteiro morto entra na main sem uma linha vermelha.
printf '\n── ponteiro pendente (caminho que o outro lado moveu, ainda citado aqui)\n'
git diff --name-status "$BASE"..."$OUTRO" | awk '$1 ~ /^[DR]/ { print $2 }' | sort -u > "$TMP/sumidos"
: > "$TMP/pendentes"
if [ -s "$TMP/sumidos" ] && [ -s "$TMP/meus" ]; then
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    while IFS= read -r meu; do
      [ -f "$meu" ] || continue
      grep -qF -- "$p" "$meu" && printf '%s → %s\n' "$meu" "$p" >> "$TMP/pendentes"
    done < "$TMP/meus"
  done < "$TMP/sumidos"
fi
if [ -s "$TMP/pendentes" ]; then
  printf '   ✗ %s ponteiro(s):\n' "$(wc -l < "$TMP/pendentes")"
  sed 's/^/       /' "$TMP/pendentes"
  falhou=1
else
  echo "   ✓ nenhum"
fi

echo
if [ "$falhou" -ne 0 ]; then
  echo "UNIÃO VERMELHA — o merge limpo mentiria. Antes de aterrissar:"
  echo "   git rebase origin/main"
  echo "   skills/<skill>/tests/rodar.sh    # a suíte contra o RESULTADO, não contra a sua branch"
  echo "   scripts/conferir-uniao.sh        # e a união de novo"
  exit 1
fi
echo "união verde — o outro lado andou e não encostou no seu território."
