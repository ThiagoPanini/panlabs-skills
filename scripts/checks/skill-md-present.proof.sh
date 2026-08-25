#!/usr/bin/env bash
# THE PROOF that `skill-md-present.sh` can go red.
#
#   scripts/checks/skill-md-present.proof.sh
#
# The rule is one `[ -f ]`, which is exactly why it needs this: a check this
# small is also the easiest one to write inside out and never notice, because
# the real tree has passed it since before it existed. Every case below plants
# the defect and demands the red; the green control is what stops "always red"
# from passing all of them.
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../proof.sh"

CHECK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skill-md-present.sh"
[ -x "$CHECK" ] || { echo "x check not found or not executable: $CHECK"; exit 2; }

proof_begin "the proof . skill-md-present goes red without a SKILL.md"
proof_bench

# ── 1 . THE CONTROL ───────────────────────────────────────────────────────────
# A skill that has the file passes. Without this, "always red" clears every case
# below and the family is a rule that no tree can ever satisfy.
mkdir -p "$PROOF_BENCH/healthy"
printf -- '---\nname: healthy\n---\n' > "$PROOF_BENCH/healthy/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/healthy" 2>&1)"; code=$?
expect "a skill with a SKILL.md passes" green "" "$out" "$code"

# ── 2 . THE DEFECT ────────────────────────────────────────────────────────────
mkdir -p "$PROOF_BENCH/naked/some/nesting"
echo "content" > "$PROOF_BENCH/naked/README.md"
out="$("$CHECK" "$PROOF_BENCH/naked" 2>&1)"; code=$?
expect "no SKILL.md turns red" red "no SKILL.md" "$out" "$code"

# ── 3 . NOT AT THE ROOT ───────────────────────────────────────────────────────
# One level down it is a file the runtime never opens. Existence somewhere in the
# tree is not the rule; existence at the root is.
mkdir -p "$PROOF_BENCH/buried/inner"
printf -- '---\nname: buried\n---\n' > "$PROOF_BENCH/buried/inner/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/buried" 2>&1)"; code=$?
expect "a SKILL.md one level down does not count" red "no SKILL.md" "$out" "$code"

# ── 4 . PRESENT BUT NOT A FILE ────────────────────────────────────────────────
# `-e` would clear this and `-f` does not. A directory named SKILL.md reads as
# present in every listing and is unreadable to everything that matters.
mkdir -p "$PROOF_BENCH/directory-not-file/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/directory-not-file" 2>&1)"; code=$?
expect "a directory named SKILL.md turns red" red "not a regular file" "$out" "$code"

# ── 5 . AN EMPTY SKILL.md STILL PASSES HERE ───────────────────────────────────
# The boundary of this family, asserted rather than assumed: it answers presence
# and nothing else. What is inside the file belongs to the frontmatter family,
# and a rule that quietly grew a second job is a rule nobody can name.
mkdir -p "$PROOF_BENCH/empty-file"
: > "$PROOF_BENCH/empty-file/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/empty-file" 2>&1)"; code=$?
expect "an empty SKILL.md passes -- content is not this family's job" green "" "$out" "$code"

# ── 6 . THE TWO VERBS ─────────────────────────────────────────────────────────
out="$("$CHECK" --describe 2>&1)"; code=$?
expect "--describe states the rule" green "SKILL.md" "$out" "$code"

# A family called with no skill must not answer green. Silent success on a
# missing argument reports a pass for a skill it never opened.
out="$("$CHECK" 2>&1)"; code=$?
expect "no argument is an error, not a pass" red "usage" "$out" "$code"

proof_verdict
