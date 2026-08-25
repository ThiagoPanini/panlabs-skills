#!/usr/bin/env bash
# THE UNION — what this branch changed x what the other side changed, since the
# common base.
#
#   scripts/check-union.sh [THEIRS] [MINE]
#
#   THEIRS   defaults to origin/main
#   MINE     defaults to HEAD — pass it to compare two refs from a third branch,
#            e.g. "do these two open PRs collide?" asked from anywhere:
#              scripts/check-union.sh origin/issue-36-x origin/issue-37-y
#
# Run before landing, and again after every rebase.
#
# ── why this exists ───────────────────────────────────────────────────────────
# Git only fails ONE of the four parallel-work collisions (see
# `docs/agents/workflow.md` § As quatro colisoes). The other three merge GREEN:
#
#   overlap    the same file from both sides, on distinct lines
#   allocation both sides claim the same slot on a shared number line (ADRs)
#   dangling   I still point at a path the other side moved or deleted
#
# Each check here turns a silent green into a readable red. None of them finds
# what a human could not; they find it BEFORE the merge, which is the only
# difference that matters once it has happened.
set -uo pipefail

THEIRS="${1:-origin/main}"
MINE="${2:-HEAD}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 2

if git remote get-url origin > /dev/null 2>&1; then
  git fetch -q origin 2> /dev/null || echo "   !  no network: '$THEIRS' may be stale"
fi

for ref in "$THEIRS" "$MINE"; do
  git rev-parse --verify -q "$ref" > /dev/null || { echo "x unknown ref: $ref"; exit 2; }
done

MINE_NAME="$(git rev-parse --abbrev-ref "$MINE")"
BASE="$(git merge-base "$MINE" "$THEIRS")" || exit 2

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git diff --name-only "$BASE".."$MINE"   | sort > "$TMP/mine"
git diff --name-only "$BASE".."$THEIRS" | sort > "$TMP/theirs"
MOVED="$(git rev-list --count "$BASE".."$THEIRS")"

printf '\n==== the union . %s x %s ====\n' "$MINE_NAME" "$THEIRS"
printf '   base %s . the other side moved %s commit(s), %s file(s)\n' \
  "$(git rev-parse --short "$BASE")" "$MOVED" "$(wc -l < "$TMP/theirs")"

failed=0

# ── 1 . OVERLAP ───────────────────────────────────────────────────────────────
# The same path from both sides. On distinct lines git merges clean, and the
# result is a file neither author read end to end.
printf '\n-- overlap (the same file from both sides)\n'
comm -12 "$TMP/mine" "$TMP/theirs" > "$TMP/overlap"
if [ -s "$TMP/overlap" ]; then
  printf '   x %s file(s):\n' "$(wc -l < "$TMP/overlap")"
  sed 's/^/       /' "$TMP/overlap"
  failed=1
else
  echo "   . none"
fi

# ── 2 . ALLOCATION ────────────────────────────────────────────────────────────
# `docs/adr/NNNN-slug.md` is a shared number line, and claiming a slot on it is
# the only write in this repo two sides make WITHOUT touching the same file. Two
# `0013-*` ADRs merge clean, and nobody ever finds out.
printf '\n-- allocation (two ADRs on the same slot)\n'
grep '^docs/adr/[0-9]' "$TMP/mine"   | sed 's|docs/adr/\([0-9]*\)-.*|\1|' | sort -u > "$TMP/adr-mine"
grep '^docs/adr/[0-9]' "$TMP/theirs" | sed 's|docs/adr/\([0-9]*\)-.*|\1|' | sort -u > "$TMP/adr-theirs"
comm -12 "$TMP/adr-mine" "$TMP/adr-theirs" > "$TMP/adr-clash"
if [ -s "$TMP/adr-clash" ]; then
  printf '   x slot(s) claimed by both sides: %s\n' "$(tr '\n' ' ' < "$TMP/adr-clash")"
  echo "       renumber YOURS, and fix the links pointing at it"
  failed=1
else
  echo "   . none"
fi

# ── 3 . DANGLING ──────────────────────────────────────────────────────────────
# The other side moved or deleted a path; I still name the old one. Text merges
# with text: the dead pointer lands on main without a single red line.
printf '\n-- dangling (a path the other side moved, still named here)\n'
git diff --name-status "$BASE".."$THEIRS" | awk '$1 ~ /^[DR]/ { print $2 }' | sort -u > "$TMP/vanished"
: > "$TMP/dangling"
if [ -s "$TMP/vanished" ] && [ -s "$TMP/mine" ]; then
  while IFS= read -r gone; do
    [ -n "$gone" ] || continue
    while IFS= read -r f; do
      git cat-file -e "$MINE:$f" 2> /dev/null || continue
      git show "$MINE:$f" 2> /dev/null | grep -qF -- "$gone" \
        && printf '%s -> %s\n' "$f" "$gone" >> "$TMP/dangling"
    done < "$TMP/mine"
  done < "$TMP/vanished"
fi
if [ -s "$TMP/dangling" ]; then
  printf '   x %s pointer(s):\n' "$(wc -l < "$TMP/dangling")"
  sed 's/^/       /' "$TMP/dangling"
  failed=1
else
  echo "   . none"
fi

echo
if [ "$failed" -ne 0 ]; then
  echo "UNION RED - the clean merge would lie. Before landing:"
  echo "   git rebase origin/main"
  echo "   skills/<skill>/tests/rodar.sh    # the suite against the RESULT, not against your branch"
  echo "   scripts/check-union.sh           # and the union again"
  exit 1
fi
echo "union green - the other side moved and did not touch your territory."
