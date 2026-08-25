#!/usr/bin/env bash
# THE PROOF that `frontmatter.sh` enforces each of its six rules -- and only
# those six. Every case below plants exactly one defect, chosen so no other
# rule fires alongside it, and demands the red; the healthy and all-fields
# controls are what stops "always red" from passing the rest for free.
#
#   scripts/checks/frontmatter.proof.sh
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../proof.sh"

CHECK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/frontmatter.sh"
[ -x "$CHECK" ] || { echo "x check not found or not executable: $CHECK"; exit 2; }

proof_begin "the proof . frontmatter goes red one rule at a time"
proof_bench

# ── 1 . THE CONTROL ───────────────────────────────────────────────────────────
mkdir -p "$PROOF_BENCH/healthy"
printf -- '---\nname: healthy\ndescription: a skill that exists and does something useful.\n---\n' \
  > "$PROOF_BENCH/healthy/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/healthy" 2>&1)"; code=$?
expect "a skill with valid name and description passes" green "" "$out" "$code"

# ── 2 . RULE 1, THE POSITIVE SIDE ─────────────────────────────────────────────
# All six allowed fields at once still passes -- the allowlist rejects what is
# outside the six, not what uses more than the bare minimum of them.
mkdir -p "$PROOF_BENCH/all-fields"
cat > "$PROOF_BENCH/all-fields/SKILL.md" <<'SKILLEOF'
---
name: all-fields
description: a skill that uses every allowed field at once.
license: MIT
compatibility: requires bash 4 or later
metadata:
  team: platform
allowed-tools: Read Write
---
SKILLEOF
out="$("$CHECK" "$PROOF_BENCH/all-fields" 2>&1)"; code=$?
expect "all six allowed fields together still pass" green "" "$out" "$code"

# ── 3 . RULE 1, THE NEGATIVE SIDE ─────────────────────────────────────────────
mkdir -p "$PROOF_BENCH/extra-field"
printf -- '---\nname: extra-field\ndescription: a skill with a field the spec does not allow.\nauthor: someone\n---\n' \
  > "$PROOF_BENCH/extra-field/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/extra-field" 2>&1)"; code=$?
expect "a field outside the allowed six turns red, naming it" red "author" "$out" "$code"

# ── 4 . RULE 2 . name present and non-empty ───────────────────────────────────
# The quick_validate.py trap: a `name` key that exists but is blank. The whole
# reason rules 2 and 5 are unconditional is that Anthropic's own pre-validator
# skips its format checks on exactly this input.
mkdir -p "$PROOF_BENCH/empty-name"
printf -- '---\nname:\ndescription: a skill whose name field is present but empty.\n---\n' \
  > "$PROOF_BENCH/empty-name/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/empty-name" 2>&1)"; code=$?
expect "an empty name turns red -- the quick_validate.py trap" red "name is missing or empty" "$out" "$code"

# ── 5 . RULE 3 . name at most 64 characters ───────────────────────────────────
# The directory is named the same 65 characters as `name`, so rule 4 (the
# directory match) stays satisfied and only the length rule fires.
long_name="$(printf 'a%.0s' $(seq 1 65))"
mkdir -p "$PROOF_BENCH/$long_name"
printf -- '---\nname: %s\ndescription: a skill whose name is one character over the limit.\n---\n' "$long_name" \
  > "$PROOF_BENCH/$long_name/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/$long_name" 2>&1)"; code=$?
expect "a name over 64 characters turns red" red "longer than 64 characters" "$out" "$code"

# ── 6 . RULE 4 . name matches the directory ───────────────────────────────────
mkdir -p "$PROOF_BENCH/actual-dir-name"
printf -- '---\nname: different-name\ndescription: a skill whose name does not match its directory.\n---\n' \
  > "$PROOF_BENCH/actual-dir-name/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/actual-dir-name" 2>&1)"; code=$?
expect "a name that does not match the directory turns red" red "does not match the directory name" "$out" "$code"

# ── 7 . RULE 5 . description present and non-empty ───────────────────────────
mkdir -p "$PROOF_BENCH/empty-description"
printf -- '---\nname: empty-description\ndescription:\n---\n' \
  > "$PROOF_BENCH/empty-description/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/empty-description" 2>&1)"; code=$?
expect "an empty description turns red -- the quick_validate.py trap" red "description is missing or empty" "$out" "$code"

# ── 8 . RULE 6 . description at most 1024 characters ─────────────────────────
long_description="$(printf 'x%.0s' $(seq 1 1025))"
mkdir -p "$PROOF_BENCH/long-description"
printf -- '---\nname: long-description\ndescription: %s\n---\n' "$long_description" \
  > "$PROOF_BENCH/long-description/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/long-description" 2>&1)"; code=$?
expect "a description over 1024 characters turns red" red "longer than 1024 characters" "$out" "$code"

# ── 9 . THE TWO VERBS ─────────────────────────────────────────────────────────
out="$("$CHECK" --describe 2>&1)"; code=$?
expect "--describe states the length rule" green "at most 64 characters" "$out" "$code"
expect "--describe names the allowed fields" green "allowed-tools" "$out" "$code"

out="$("$CHECK" 2>&1)"; code=$?
expect "no argument is an error, not a pass" red "usage" "$out" "$code"

# ── 10 . WHAT ISN'T EVEN FRONTMATTER YET ──────────────────────────────────────
# A family that cannot find a block to read is red, never a silent pass for
# rules it never got to evaluate.
mkdir -p "$PROOF_BENCH/no-skill-md"
out="$("$CHECK" "$PROOF_BENCH/no-skill-md" 2>&1)"; code=$?
expect "a missing SKILL.md turns red" red "no SKILL.md to read frontmatter from" "$out" "$code"

mkdir -p "$PROOF_BENCH/no-opening-delim"
printf -- 'name: no-opening-delim\ndescription: a file that never opens a frontmatter block.\n' \
  > "$PROOF_BENCH/no-opening-delim/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/no-opening-delim" 2>&1)"; code=$?
expect "a file that never opens with --- turns red" red "does not open with a --- frontmatter delimiter" "$out" "$code"

mkdir -p "$PROOF_BENCH/no-closing-delim"
printf -- '---\nname: no-closing-delim\ndescription: frontmatter that never closes.\n' \
  > "$PROOF_BENCH/no-closing-delim/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/no-closing-delim" 2>&1)"; code=$?
expect "a frontmatter block that never closes turns red" red "no closing" "$out" "$code"

proof_verdict
