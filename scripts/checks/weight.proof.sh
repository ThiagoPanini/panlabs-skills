#!/usr/bin/env bash
# THE PROOF that `weight.sh` catches each of its three rules separately, and
# that the package-weight universe actually matches the official packager's
# exclusion list rather than merely claiming to.
#
#   scripts/checks/weight.proof.sh
#
# Rule 1's proof is the one worth the most care: `truncate` manufactures real
# byte counts without the time or disk cost of writing them, so the cap is
# crossed for real, not simulated. One case plants the file where
# `.gitignore` hides it from `git status` -- the exact trap that cost this
# repo a scare at 29 of 30 MB -- and demands the check still counts it.
# Another plants weight inside every one of the packager's five exclusions at
# once and demands green, so a universe that quietly drifted from the
# packager's own would be caught here, not assumed away.
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../proof.sh"

CHECK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/weight.sh"
[ -x "$CHECK" ] || { echo "x check not found or not executable: $CHECK"; exit 2; }

proof_begin "the proof . weight goes red on package bytes, SKILL.md lines, and an open fence, separately"
proof_bench

skill_md() { # skill_md <n-filler-lines> -> a minimal, valid SKILL.md body, 4 header lines plus n
  printf -- '---\nname: bench\ndescription: a skill that exists.\n---\n'
  local i=0
  while [ "$i" -lt "$1" ]; do
    echo "line"
    i=$((i + 1))
  done
}

# ── 1 . THE CONTROL ───────────────────────────────────────────────────────────
# Small package, short SKILL.md, no fence at all -- all three rules pass at
# once. Without this, "always red" would clear every case below.
mkdir -p "$PROOF_BENCH/light"
skill_md 0 > "$PROOF_BENCH/light/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/light" 2>&1)"; code=$?
expect "a light, short, closed skill passes all three rules" green "" "$out" "$code"

# ── 2 . PACKAGE WEIGHT -- OVER THE CAP ────────────────────────────────────────
mkdir -p "$PROOF_BENCH/heavy"
skill_md 0 > "$PROOF_BENCH/heavy/SKILL.md"
truncate -s 31M "$PROOF_BENCH/heavy/big.bin"
out="$("$CHECK" "$PROOF_BENCH/heavy" 2>&1)"; code=$?
expect "a skill over 30 MB turns red" red "over the 30 MB" "$out" "$code"

# ── 3 . PACKAGE WEIGHT -- .gitignore DOES NOT SHRINK THE MEASURED UNIVERSE ────
# The trap this repo already paid for: a file `.gitignore` hides from
# `git status` still ships in the `.skill` zip, because the packager never
# reads `.gitignore` either. Proven with a real repository, not a file on
# disk with no git involved at all.
mkdir -p "$PROOF_BENCH/gitignored/ignored"
git init -q "$PROOF_BENCH/gitignored"
echo "ignored/" > "$PROOF_BENCH/gitignored/.gitignore"
skill_md 0 > "$PROOF_BENCH/gitignored/SKILL.md"
truncate -s 31M "$PROOF_BENCH/gitignored/ignored/big.bin"
out="$("$CHECK" "$PROOF_BENCH/gitignored" 2>&1)"; code=$?
expect "a file .gitignore hides still counts toward the cap" red "over the 30 MB" "$out" "$code"

# ── 4 . PACKAGE WEIGHT -- THE PACKAGER'S OWN FIVE EXCLUSIONS, ALL AT ONCE ─────
# 50 MB planted split across all five things `package_skill.py` excludes.
# Counted, this fails loudly; excluded correctly, only the tiny SKILL.md is
# left and the skill passes.
mkdir -p "$PROOF_BENCH/excluded/__pycache__" "$PROOF_BENCH/excluded/node_modules" "$PROOF_BENCH/excluded/evals"
skill_md 0 > "$PROOF_BENCH/excluded/SKILL.md"
truncate -s 10M "$PROOF_BENCH/excluded/__pycache__/pad.bin"
truncate -s 10M "$PROOF_BENCH/excluded/node_modules/pad.bin"
truncate -s 10M "$PROOF_BENCH/excluded/evals/pad.bin"
truncate -s 10M "$PROOF_BENCH/excluded/thing.pyc"
truncate -s 10M "$PROOF_BENCH/excluded/.DS_Store"
out="$("$CHECK" "$PROOF_BENCH/excluded" 2>&1)"; code=$?
expect "the packager's five exclusions, 50 MB of them, all pass" green "" "$out" "$code"

# ── 5 . PACKAGE WEIGHT -- evals/ IS EXCLUDED ONLY AT THE SKILL ROOT ──────────
# `package_skill.py`'s ROOT_EXCLUDE_DIRS applies once, at the top. A nested
# `evals/` is an ordinary directory and its weight counts.
mkdir -p "$PROOF_BENCH/nested-evals/subdir/evals"
skill_md 0 > "$PROOF_BENCH/nested-evals/SKILL.md"
truncate -s 31M "$PROOF_BENCH/nested-evals/subdir/evals/big.bin"
out="$("$CHECK" "$PROOF_BENCH/nested-evals" 2>&1)"; code=$?
expect "an evals/ directory below the root is not excluded" red "over the 30 MB" "$out" "$code"

# ── 6 . SKILL.md BUDGET -- EXACTLY AT THE CAP PASSES ──────────────────────────
# 4 header lines plus 396 filler lines is exactly 400.
mkdir -p "$PROOF_BENCH/at-cap"
skill_md 396 > "$PROOF_BENCH/at-cap/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/at-cap" 2>&1)"; code=$?
expect "SKILL.md at exactly 400 lines passes" green "" "$out" "$code"

# ── 7 . SKILL.md BUDGET -- ONE LINE OVER TURNS RED ────────────────────────────
mkdir -p "$PROOF_BENCH/over-cap"
skill_md 397 > "$PROOF_BENCH/over-cap/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/over-cap" 2>&1)"; code=$?
expect "SKILL.md at 401 lines turns red" red "400-line budget" "$out" "$code"

# ── 8 . FENCE -- A CLOSED PAIR PASSES ─────────────────────────────────────────
mkdir -p "$PROOF_BENCH/fence-closed"
{ skill_md 0; printf -- '\n```bash\necho hi\n```\n'; } > "$PROOF_BENCH/fence-closed/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/fence-closed" 2>&1)"; code=$?
expect "a fence that opens and closes passes" green "" "$out" "$code"

# ── 9 . FENCE -- LEFT OPEN IN SKILL.md TURNS RED ──────────────────────────────
mkdir -p "$PROOF_BENCH/fence-open"
{ skill_md 0; printf -- '\n```bash\necho hi\n'; } > "$PROOF_BENCH/fence-open/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/fence-open" 2>&1)"; code=$?
expect "a fence opened and never closed turns red" red "SKILL.md has a code fence that never closes" "$out" "$code"

# ── 10 . FENCE -- THE SWEEP IS NOT JUST SKILL.md ──────────────────────────────
# `references.sh` already established that a skill's other Markdown is read by
# the agent too, not just SKILL.md. An open fence anywhere in the tree
# swallows the same way.
mkdir -p "$PROOF_BENCH/fence-open-nested/guide"
skill_md 0 > "$PROOF_BENCH/fence-open-nested/SKILL.md"
printf -- '# notes\n\n```text\nunterminated\n' > "$PROOF_BENCH/fence-open-nested/guide/notes.md"
out="$("$CHECK" "$PROOF_BENCH/fence-open-nested" 2>&1)"; code=$?
expect "an open fence outside SKILL.md turns red too" red "guide/notes.md has a code fence that never closes" "$out" "$code"

# ── 11 . THE TWO VERBS ────────────────────────────────────────────────────────
out="$("$CHECK" --describe 2>&1)"; code=$?
expect "--describe states the weight rule" green "30 MB" "$out" "$code"
expect "--describe states the SKILL.md budget" green "400 lines" "$out" "$code"
expect "--describe states the fence rule" green "code fence" "$out" "$code"

out="$("$CHECK" 2>&1)"; code=$?
expect "no argument is an error, not a pass" red "usage" "$out" "$code"

proof_verdict
