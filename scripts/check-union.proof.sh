#!/usr/bin/env bash
# THE PROOF that `check-union.sh` measures — the three silent collisions planted
# in a throwaway repo, and the ruler having to fail each one.
#
#   scripts/check-union.proof.sh
#
# Exists because a check only ever seen green is documentation: all three pass by
# vacuity if the query is wrong, and none of them fires on the real tree often
# enough to be seen failing by accident.
set -uo pipefail

RULER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-union.sh"
[ -x "$RULER" ] || { echo "x ruler not found: $RULER"; exit 2; }

BENCH="$(mktemp -d)"
trap 'rm -rf "$BENCH"' EXIT

failed=0
expect() { # expect <title> <want: green|red> <needle> <output> <exit-code>
  local title="$1" want="$2" needle="$3" output="$4" code="$5"
  local got="green"; [ "$code" -ne 0 ] && got="red"
  if [ "$got" = "$want" ] && grep -qF -- "$needle" <<< "$output"; then
    printf '   . %s\n' "$title"
  else
    printf '   x %s - wanted %s containing "%s", got %s\n' "$title" "$want" "$needle" "$got"
    sed 's/^/       | /' <<< "$output"
    failed=1
  fi
}

scaffold() { # build a repo with a base, a "theirs" side and a "mine" side
  local r="$BENCH/$1"; mkdir -p "$r/docs/adr" "$r/guide"; cd "$r" || exit 2
  git init -q -b main .
  git config user.email proof@local; git config user.name proof
  mkdir -p scripts && cp "$RULER" scripts/
  echo "line 1" > a.txt
  printf 'line 1\nline 2\nline 3\nline 4\nline 5\n' > long.txt
  echo "# adr one" > docs/adr/0001-first.md
  echo "old rule" > guide/old.md
  echo "points at [old](guide/old.md)" > SKILL.md
  echo "untouched" > alone.txt
  git add -A && git commit -qm base
}

echo "==== the proof . check-union.sh fails all three, and clears the clean one ===="

# ── 1 . OVERLAP ───────────────────────────────────────────────────────────────
# Same file, distinct lines: git merges clean and the ruler has to stop it.
scaffold overlap
git switch -qc theirs
sed -i '1s/.*/THEIRS touched here/' long.txt && git commit -qam theirs
git switch -qc mine main
sed -i '5s/.*/MINE touched here/' long.txt && git commit -qam mine
git merge-tree --write-tree theirs mine > /dev/null 2>&1 \
  && printf '   - premise: git merges this one without conflict\n' \
  || printf '   ! premise failed: git ALREADY fails this one\n'
out="$(bash scripts/check-union.sh theirs 2>&1)"; code=$?
expect "overlap failed" red "long.txt" "$out" "$code"

# ── 2 . ALLOCATION ────────────────────────────────────────────────────────────
# Two `0002-*` ADRs with different slugs: two files, zero conflict.
scaffold allocation
git switch -qc theirs
echo "# theirs" > docs/adr/0002-their-decision.md && git add -A && git commit -qm theirs
git switch -qc mine main
echo "# mine" > docs/adr/0002-my-decision.md && git add -A && git commit -qm mine
out="$(bash scripts/check-union.sh theirs 2>&1)"; code=$?
expect "allocation failed" red "0002" "$out" "$code"

# ── 3 . DANGLING ──────────────────────────────────────────────────────────────
# Theirs moves `guide/old.md`; I edit the SKILL.md that still names it.
scaffold dangling
git switch -qc theirs
git mv guide/old.md guide/new.md && git commit -qm "theirs moves"
git switch -qc mine main
echo "and one more line" >> SKILL.md && git commit -qam "mine edits SKILL"
out="$(bash scripts/check-union.sh theirs 2>&1)"; code=$?
expect "dangling failed" red "guide/old.md" "$out" "$code"

# ── 4 . THE CONTROL ───────────────────────────────────────────────────────────
# Disjoint territory: the ruler must not invent a collision.
scaffold control
git switch -qc theirs
echo theirs >> a.txt && git commit -qam theirs
git switch -qc mine main
echo mine >> alone.txt && git commit -qam mine
out="$(bash scripts/check-union.sh theirs 2>&1)"; code=$?
expect "disjoint territory cleared" green "union green" "$out" "$code"

# ── 5 . TWO-REF MODE ──────────────────────────────────────────────────────────
# The question "do these two open PRs collide?" is asked from a THIRD branch, so
# neither side is HEAD. Same collision as case 1, measured from elsewhere.
scaffold tworef
git switch -qc theirs
sed -i '1s/.*/THEIRS touched here/' long.txt && git commit -qam theirs
git switch -qc mine main
sed -i '5s/.*/MINE touched here/' long.txt && git commit -qam mine
git switch -q main
out="$(bash scripts/check-union.sh theirs mine 2>&1)"; code=$?
expect "two-ref mode, from a third branch" red "long.txt" "$out" "$code"

echo
if [ "$failed" -ne 0 ]; then
  echo "PROOF RED - the ruler does not measure what it claims to."
  exit 1
fi
echo "proof green - the three silent collisions turn red, and the clean one passes."
