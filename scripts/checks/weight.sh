#!/usr/bin/env bash
# THREE BUDGETS, ONE FAMILY -- BYTES, LINES, AND ONE FENCE LEFT OPEN. All three
# were crossed, or nearly were, in this repo before anything measured them.
#
#   scripts/checks/weight.sh --describe
#   scripts/checks/weight.sh <skill-dir>
#
# RULE 1 -- the skill fits the Skills API's 30 MB uncompressed upload cap,
# measured over the SAME universe the official packager (`package_skill.py`)
# takes: the whole directory, minus `__pycache__`, `node_modules`, `*.pyc`,
# `.DS_Store`, and a root-level `evals/` -- nothing else, and nothing that
# reads `.gitignore`. This tree already reached 29 of the 30 MB before anyone
# measured it by hand; a directory full of render that `.gitignore` hides from
# `git status` shipped in the package regardless, because the packager never
# reads `.gitignore` either. This rule doesn't read it, on purpose, for the
# same reason.
#
# WHERE THE NUMBER COMES FROM, PRECISELY, because a past writeup in this repo
# got it wrong. The 30 MB cap is not in the open Agent Skills spec -- it does
# not appear anywhere in that text -- and `package_skill.py` contains no size
# check at all: it would zip 200 MB without complaint and let the upload
# reject it afterward. The number is stated exactly once, as a Skills API
# upload requirement ("Maximum Skill upload size: 30 MB (all files combined,
# uncompressed)"). One source declares it; crediting the spec or the packager
# for it was the mistake to not repeat here.
#
# RULE 2 -- SKILL.md is at most 400 lines. Every primary source in the field
# repeats 500 lines / 5000 tokens as ADVICE, blocking in none of them. This
# number is lower and IS blocking, on purpose: not the field's style guide,
# this repo's regression wire. Both skills clear it today with room to spare
# (230 and 154 lines) -- the rule exists so a skill cannot double in size
# without someone deciding that on purpose.
#
# RULE 3 -- every Markdown code fence in the skill closes. A fence left open
# swallows every line that follows it for whichever reader hits it next, agent
# included -- the read never recovers mid-file. The check is the trivial
# regex the defect deserves: count fence delimiters per file, an odd count is
# one still open at end of file.
#
# See `weight.proof.sh`: each of the three goes red on its own, and the
# package universe is proven against the packager's own exclusion list, not
# just asserted to match it.
set -uo pipefail

if [ "${1:-}" = "--describe" ]; then
  echo "the skill directory is at most 30 MB uncompressed, measured over the same files the official packager takes"
  echo "SKILL.md is at most 400 lines"
  echo "every Markdown code fence in the skill closes"
  exit 0
fi

SKILL="${1:-}"
if [ -z "$SKILL" ]; then
  echo "usage: $(basename "$0") [--describe] <skill-dir>" >&2
  exit 2
fi
if [ ! -d "$SKILL" ]; then
  echo "not a directory: $SKILL" >&2
  exit 2
fi

ROOT="$(cd "$SKILL" && pwd -P)"
failures=0

hum() { numfmt --to=iec --suffix=B --format='%.1f' "$1" 2>/dev/null || printf '%s B' "$1"; }

# ── rule 1 . package weight, the packager's own universe ──────────────────────
CAP=$((30 * 1024 * 1024))

# The exact five exclusions of `package_skill.py`'s `rglob('*')`, in its own
# order. No `.gitignore` in that list, so none here either.
package_files() {
  find "$ROOT" \
    \( -type d \( -name __pycache__ -o -name node_modules \) -prune \) -o \
    \( -type d -path "$ROOT/evals" -prune \) -o \
    \( -type f ! -name '*.pyc' ! -name '.DS_Store' -print \)
}

bytes=0
while IFS= read -r f; do
  bytes=$((bytes + $(stat -c%s "$f")))
done < <(package_files)

if [ "$bytes" -gt "$CAP" ]; then
  echo "package weight is $(hum "$bytes") -- over the 30 MB uncompressed cap the Skills API enforces at upload"
  failures=$((failures + 1))
fi

# ── rule 2 . SKILL.md budget ───────────────────────────────────────────────────
LINE_CAP=400
SKILL_MD="$ROOT/SKILL.md"
if [ -f "$SKILL_MD" ]; then
  lines=$(wc -l < "$SKILL_MD")
  if [ "$lines" -gt "$LINE_CAP" ]; then
    echo "SKILL.md is $lines lines -- over the $LINE_CAP-line budget"
    failures=$((failures + 1))
  fi
fi

# ── rule 3 . every fence closes, in every Markdown file in the skill ──────────
while IFS= read -r file; do
  rel="${file#"$ROOT"/}"
  fences=$(grep -cE '^[[:space:]]*(```|~~~)' "$file")
  if [ $((fences % 2)) -ne 0 ]; then
    echo "$rel has a code fence that never closes"
    failures=$((failures + 1))
  fi
done < <(find "$ROOT" -type f -name '*.md' | sort)

[ "$failures" -eq 0 ] && exit 0
exit 1
