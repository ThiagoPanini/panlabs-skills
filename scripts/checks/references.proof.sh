#!/usr/bin/env bash
# THE PROOF that `references.sh` catches both verdicts, and only the shapes it
# claims to.
#
#   scripts/checks/references.proof.sh
#
# The case that matters most here is the one #56 lived through: `git mv` moves a
# file's bytes and rewrites nothing inside it, so a relative link correct before
# the move can survive the move and land on nothing -- silently, no conflict, no
# red anywhere. Case 4 below reproduces that shape by actually moving a file, not
# by describing it. Every other case plants one defect and demands the matching
# red; the control is what stops "always red" from passing all of them.
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../proof.sh"

CHECK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/references.sh"
[ -x "$CHECK" ] || { echo "x check not found or not executable: $CHECK"; exit 2; }

proof_begin "the proof . references goes red on an escaped link and on a dangling one, separately"
proof_bench

# ── 1 . THE CONTROL ───────────────────────────────────────────────────────────
# A sibling file, a parent-directory file, and a directory target with a
# trailing slash -- the exact shape this repo's own README.md uses today.
# Without this, "always red" would clear every case below.
mkdir -p "$PROOF_BENCH/healthy/guide"
printf -- '[guide](guide/)\n[model](guide/model.md)\n' > "$PROOF_BENCH/healthy/SKILL.md"
printf -- '[back to SKILL.md](../SKILL.md)\n' > "$PROOF_BENCH/healthy/guide/model.md"
out="$("$CHECK" "$PROOF_BENCH/healthy" 2>&1)"; code=$?
expect "in-tree links to a sibling, a parent, and a directory all pass" green "" "$out" "$code"

# ── 2 . SELF-CONTAINMENT -- A LINK THAT CLIMBS OUT ────────────────────────────
# The target is real -- it sits right there on disk -- and it is still wrong:
# this rule is about where a path lands, not whether it exists.
mkdir -p "$PROOF_BENCH/escapes/inner"
echo "sibling workspace" > "$PROOF_BENCH/escapes-neighbour.md"
printf -- '[out](../../escapes-neighbour.md)\n' > "$PROOF_BENCH/escapes/inner/page.md"
out="$("$CHECK" "$PROOF_BENCH/escapes" 2>&1)"; code=$?
expect "a link resolving outside the skill root turns red" red "resolves outside the skill" "$out" "$code"

# ── 3 . ORPHAN -- A LINK THAT STAYS IN BUT LANDS ON NOTHING ───────────────────
mkdir -p "$PROOF_BENCH/orphan"
printf -- '[nope](does-not-exist.md)\n' > "$PROOF_BENCH/orphan/SKILL.md"
out="$("$CHECK" "$PROOF_BENCH/orphan" 2>&1)"; code=$?
expect "a link inside the tree that resolves to nothing turns red, with its own message" red "does not exist" "$out" "$code"

# ── 4 . THE #56 SHAPE -- git mv REWRITES NOTHING INSIDE THE MOVED FILE ────────
# One hop deep, "../SKILL.md" is correct. `git mv` relocates the file a level
# deeper and touches no byte inside it -- the same "../SKILL.md" now names a
# path that was never there. This is the `decisoes.md` incident, reproduced by
# moving the file rather than described.
mkdir -p "$PROOF_BENCH/mv/guide"
: > "$PROOF_BENCH/mv/SKILL.md"
printf -- '[root](../SKILL.md)\n' > "$PROOF_BENCH/mv/guide/decisions.md"
out="$("$CHECK" "$PROOF_BENCH/mv" 2>&1)"; code=$?
expect "one hop deep, the link is correct before the move" green "" "$out" "$code"

mkdir -p "$PROOF_BENCH/mv/docs/aws-diagrams"
mv "$PROOF_BENCH/mv/guide/decisions.md" "$PROOF_BENCH/mv/docs/aws-diagrams/decisions.md"
out="$("$CHECK" "$PROOF_BENCH/mv" 2>&1)"; code=$?
expect "moved a level deeper with the link untouched, it now dangles" red "does not exist" "$out" "$code"

# ── 5 . OUT OF SCOPE ON PURPOSE ────────────────────────────────────────────────
# http(s), mailto, a same-file anchor, and an absolute path -- shaped to fail if
# they were resolved as relative references, and none of them is one.
mkdir -p "$PROOF_BENCH/out-of-scope"
cat > "$PROOF_BENCH/out-of-scope/SKILL.md" <<'EOF'
[web](https://example.com/nope)
[mail](mailto:nobody@example.com)
[here](#some-heading)
[abs](/some/absolute/path.md)
EOF
out="$("$CHECK" "$PROOF_BENCH/out-of-scope" 2>&1)"; code=$?
expect "http(s), mailto, an anchor, and an absolute path are not this family's job" green "" "$out" "$code"

# ── 6 . A FENCE IS SHOWING SYNTAX, NOT MAKING A REFERENCE ────────────────────
mkdir -p "$PROOF_BENCH/fenced"
cat > "$PROOF_BENCH/fenced/SKILL.md" <<'EOF'
example of a link:

```markdown
[bad](../../way-outside.md)
```
EOF
out="$("$CHECK" "$PROOF_BENCH/fenced" 2>&1)"; code=$?
expect "a link shown inside a fenced code block is not a reference" green "" "$out" "$code"

# ── 7 . THE TWO VERBS ─────────────────────────────────────────────────────────
out="$("$CHECK" --describe 2>&1)"; code=$?
expect "--describe states the self-containment rule" green "path inside the skill" "$out" "$code"
expect "--describe states the orphan rule" green "resolves to something that exists" "$out" "$code"

out="$("$CHECK" 2>&1)"; code=$?
expect "no argument is an error, not a pass" red "usage" "$out" "$code"

proof_verdict
