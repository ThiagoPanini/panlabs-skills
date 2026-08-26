#!/usr/bin/env bash
# The package that ships, and the only measurement of the ceiling that matters.
#
#   tools/package.sh              measures and packages into ../<name>.skill
#   tools/package.sh --check   only measures, writes nothing
#
# ⚠️ `.gitignore` DOES NOT PROTECT THE PACKAGE, and that is the reason this file
# exists.
#
# The official packager (`skill-creator/scripts/package_skill.py`) sweeps the
# whole directory with `rglob('*')` and excludes exactly five things:
#
#     EXCLUDE_DIRS       = {"__pycache__", "node_modules"}
#     EXCLUDE_GLOBS      = {"*.pyc"}
#     EXCLUDE_FILES      = {".DS_Store"}
#     ROOT_EXCLUDE_DIRS  = {"evals"}     # only at the skill root
#
# No `.gitignore` in that list. An `output/` full of renders — which git ignores
# — goes into the `.skill` all the same. And the ceiling is HARD: 30 MB
# uncompressed, rejected at upload time.
#
# This tree already reached 29 MB with nobody measuring it. The lesson was not
# "clean up": it was that a limit nobody measures is a limit discovered on
# upload day.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
NAME="$(basename "$ROOT")"
CEILING=$((30 * 1024 * 1024))

CHECK=0
for a in "$@"; do
  case "$a" in
    --check) CHECK=1 ;;
    *) echo "unknown argument: $a"; exit 2 ;;
  esac
done

[ -f "$ROOT/SKILL.md" ] || { echo "  ✗ $ROOT does not look like the skill root (no SKILL.md)"; exit 1; }

# ------------------------------------------------------- what goes into the package
# The same list as the official packager, in the same precedence order.
list_files() {
  find "$ROOT" \
    \( -type d \( -name __pycache__ -o -name node_modules \) -prune \) -o \
    \( -type d -path "$ROOT/evals" -prune \) -o \
    \( -type f ! -name '*.pyc' ! -name '.DS_Store' -print \)
}

mapfile -t FILES < <(list_files)
N=${#FILES[@]}
BYTES=0
for f in "${FILES[@]}"; do BYTES=$((BYTES + $(stat -c%s "$f"))); done

pct=$((BYTES * 100 / CEILING))
human() { numfmt --to=iec --suffix=B --format='%.1f' "$1" 2>/dev/null || echo "$1 B"; }

echo
echo "  $NAME"
echo "  ────────────────────────────────────────────"
printf '  %-22s %s\n' "files" "$N"
printf '  %-22s %s  (%d%% of the 30 MB ceiling)\n' "uncompressed" "$(human $BYTES)" "$pct"

# ------------------------------------------------------- the five biggest dirs
echo
echo "  where the weight is:"
for d in "$ROOT"/*/; do
  [ -d "$d" ] || continue
  name="$(basename "$d")"
  case "$name" in evals|__pycache__|node_modules) continue ;; esac
  b=$(du -sb "$d" 2>/dev/null | cut -f1)
  echo "$b $name"
done | sort -rn | head -5 | while read -r b name; do
  printf '    %-14s %s\n' "$name/" "$(human "$b")"
done

# ------------------------------------------------- what git ignores and still ships
SNEAKY=0
if git -C "$ROOT" rev-parse --git-dir > /dev/null 2>&1; then
  mapfile -t IGNORED < <(git -C "$ROOT" ls-files --others --ignored --exclude-standard 2>/dev/null)
  if [ ${#IGNORED[@]} -gt 0 ]; then
    ib=0
    for f in "${IGNORED[@]}"; do
      [ -f "$ROOT/$f" ] && ib=$((ib + $(stat -c%s "$ROOT/$f")))
    done
    if [ "$ib" -gt 0 ]; then
      SNEAKY=1
      echo
      echo "  ⚠ ${#IGNORED[@]} file(s) that GIT IGNORES and the package SHIPS — $(human $ib)"
      echo "    The packager does not read .gitignore. Run the cleanup before publishing:"
      echo "      rm -rf output/* && mkdir -p output/themes"
    fi
  fi
fi

# ------------------------------------------------------------------ the verdict
echo
if [ "$BYTES" -gt "$CEILING" ]; then
  echo "  ✗ BLOWS PAST the 30 MB ceiling — the upload will be rejected."
  exit 1
fi
if [ "$pct" -ge 70 ]; then
  echo "  ⚠ $pct% of the ceiling. Above 70% it is worth knowing what is riding along."
else
  echo "  ✓ $pct% of the 30 MB ceiling."
fi

[ "$CHECK" -eq 1 ] && exit 0

# ------------------------------------------------------------------ the zip
command -v zip > /dev/null || { echo "  ✗ zip not found — install it, or use --check"; exit 1; }
TARGET="$(dirname "$ROOT")/$NAME.skill"
rm -f "$TARGET"
( cd "$(dirname "$ROOT")" && printf '%s\n' "${FILES[@]#$(dirname "$ROOT")/}" | zip -q -@ "$TARGET" )
echo "  → $TARGET  ($(human "$(stat -c%s "$TARGET")") compressed)"
