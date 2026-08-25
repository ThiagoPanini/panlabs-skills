#!/usr/bin/env bash
# O pacote que sai de casa, e a única medida do teto que importa.
#
#   tools/package.sh              mede e empacota em ../<nome>.skill
#   tools/package.sh --conferir   só mede, não escreve nada
#
# ⚠️ `.gitignore` NÃO PROTEGE O PACOTE, e essa é a razão de este arquivo existir.
#
# O empacotador oficial (`skill-creator/scripts/package_skill.py`) varre o
# diretório inteiro com `rglob('*')` e exclui exatamente cinco coisas:
#
#     EXCLUDE_DIRS       = {"__pycache__", "node_modules"}
#     EXCLUDE_GLOBS      = {"*.pyc"}
#     EXCLUDE_FILES      = {".DS_Store"}
#     ROOT_EXCLUDE_DIRS  = {"evals"}     # só na raiz da skill
#
# Nada de `.gitignore` nessa lista. Um `output/` cheio de render — que o git
# ignora — vai para dentro do `.skill` do mesmo jeito. E o teto é DURO: 30 MB
# descomprimidos, recusa na hora do upload.
#
# Esta árvore já chegou a 29 MB sem ninguém medir. A lição não foi "limpe": foi
# que um limite que ninguém mede é um limite que se descobre no dia do upload.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$AQUI")"
NOME="$(basename "$RAIZ")"
TETO=$((30 * 1024 * 1024))

CONFERIR=0
for a in "$@"; do
  case "$a" in
    --conferir) CONFERIR=1 ;;
    *) echo "argumento desconhecido: $a"; exit 2 ;;
  esac
done

[ -f "$RAIZ/SKILL.md" ] || { echo "  ✗ $RAIZ não parece a raiz da skill (sem SKILL.md)"; exit 1; }

# ------------------------------------------------------- o que entra no pacote
# A mesma lista do empacotador oficial, na mesma ordem de precedência.
listar() {
  find "$RAIZ" \
    \( -type d \( -name __pycache__ -o -name node_modules \) -prune \) -o \
    \( -type d -path "$RAIZ/evals" -prune \) -o \
    \( -type f ! -name '*.pyc' ! -name '.DS_Store' -print \)
}

mapfile -t ARQUIVOS < <(listar)
N=${#ARQUIVOS[@]}
BYTES=0
for f in "${ARQUIVOS[@]}"; do BYTES=$((BYTES + $(stat -c%s "$f"))); done

pct=$((BYTES * 100 / TETO))
hum() { numfmt --to=iec --suffix=B --format='%.1f' "$1" 2>/dev/null || echo "$1 B"; }

echo
echo "  $NOME"
echo "  ────────────────────────────────────────────"
printf '  %-22s %s\n' "arquivos" "$N"
printf '  %-22s %s  (%d%% do teto de 30 MB)\n' "descomprimido" "$(hum $BYTES)" "$pct"

# ------------------------------------------------------- os cinco maiores dirs
echo
echo "  onde o peso está:"
for d in "$RAIZ"/*/; do
  [ -d "$d" ] || continue
  nome="$(basename "$d")"
  case "$nome" in evals|__pycache__|node_modules) continue ;; esac
  b=$(du -sb "$d" 2>/dev/null | cut -f1)
  echo "$b $nome"
done | sort -rn | head -5 | while read -r b nome; do
  printf '    %-14s %s\n' "$nome/" "$(hum "$b")"
done

# ------------------------------------------------- o que o git ignora e mesmo assim viaja
CLANDESTINO=0
if git -C "$RAIZ" rev-parse --git-dir > /dev/null 2>&1; then
  mapfile -t IGNORADOS < <(git -C "$RAIZ" ls-files --others --ignored --exclude-standard 2>/dev/null)
  if [ ${#IGNORADOS[@]} -gt 0 ]; then
    cb=0
    for f in "${IGNORADOS[@]}"; do
      [ -f "$RAIZ/$f" ] && cb=$((cb + $(stat -c%s "$RAIZ/$f")))
    done
    if [ "$cb" -gt 0 ]; then
      CLANDESTINO=1
      echo
      echo "  ⚠ ${#IGNORADOS[@]} arquivo(s) que o GIT IGNORA e o pacote LEVA — $(hum $cb)"
      echo "    O empacotador não lê .gitignore. Rode a limpeza antes de publicar:"
      echo "      rm -rf output/* && mkdir -p output/temas"
    fi
  fi
fi

# ------------------------------------------------------------------ o veredito
echo
if [ "$BYTES" -gt "$TETO" ]; then
  echo "  ✗ ESTOURA o teto de 30 MB — o upload vai recusar."
  exit 1
fi
if [ "$pct" -ge 70 ]; then
  echo "  ⚠ $pct% do teto. Acima de 70% vale saber o que está subindo junto."
else
  echo "  ✓ $pct% do teto de 30 MB."
fi

[ "$CONFERIR" -eq 1 ] && exit 0

# ------------------------------------------------------------------ o zip
command -v zip > /dev/null || { echo "  ✗ zip não encontrado — instale, ou use --conferir"; exit 1; }
ALVO="$(dirname "$RAIZ")/$NOME.skill"
rm -f "$ALVO"
( cd "$(dirname "$RAIZ")" && printf '%s\n' "${ARQUIVOS[@]#$(dirname "$RAIZ")/}" | zip -q -@ "$ALVO" )
echo "  → $ALVO  ($(hum "$(stat -c%s "$ALVO")") comprimido)"
