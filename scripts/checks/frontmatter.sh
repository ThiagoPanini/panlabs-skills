#!/usr/bin/env bash
# THE FRONTMATTER FAMILY -- the six rules four independent readers agree on:
# the open spec (agentskills.io), its reference validator `skills-ref`,
# Anthropic's own `quick_validate.py`, and the community `skill-lint`. See
# `docs/research/skill-validation-checks.md` SS B, C.2, D.2 for the source of
# each rule below.
#
#   scripts/checks/frontmatter.sh --describe
#   scripts/checks/frontmatter.sh <skill-dir>
#
# THE SIX RULES:
#
#   1. only the six fields the open spec allows -- anything else fails, named
#   2. `name` is present and non-empty
#   3. `name` is at most 64 characters
#   4. `name` equals the skill directory's own name
#   5. `description` is present and non-empty
#   6. `description` is at most 1024 characters
#
# TWO TRAPS THE RESEARCH FOUND, AND THIS FAMILY DOES NOT REPRODUCE. Anthropic's
# own `quick_validate.py` guards every format check behind `if name:` / `if
# description:`, so `name: ""` sails through with the format rules never run --
# rules 2 and 5 exist so an empty string fails here, unconditionally. And
# `quick_validate.py` never checks the directory match at all, though the spec
# states it as MUST and both `skills-ref` and `skill-lint` enforce it -- rule 4
# is that check.
#
# `name`'s charset is deliberately not a seventh rule. The open spec accepts
# lowercase Unicode; `quick_validate.py` restricts to ASCII `^[a-z0-9-]+$`, the
# stricter of the two readings and the one this repo already writes identifiers
# in (CLAUDE.md SS "O codigo e em ingles"). Rule 4 -- plain string equality
# against the directory name -- carries that restriction for free once the
# directory itself is ASCII, which every directory under `skills/` here is.
#
# Values are read as plain single-line YAML scalars: this repo never quotes
# `name` or `description`, and never folds them across lines (the "no rigid
# line wrap" rule keeps prose -- frontmatter included -- to one physical line).
# A block or folded scalar is out of scope for what this tree contains.
#
# See `frontmatter.proof.sh` for each rule seen failing, one at a time.
set -uo pipefail

ALLOWED_FIELDS="name description license compatibility metadata allowed-tools"
MAX_NAME_LEN=64
MAX_DESCRIPTION_LEN=1024

if [ "${1:-}" = "--describe" ]; then
  cat <<'EOF'
frontmatter uses only the fields the open spec allows: name, description, license, compatibility, metadata, allowed-tools
name is present and non-empty
name is at most 64 characters
name matches the name of the skill's directory
description is present and non-empty
description is at most 1024 characters
EOF
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

TARGET="$SKILL/SKILL.md"
if [ ! -f "$TARGET" ]; then
  echo "no SKILL.md to read frontmatter from"
  exit 1
fi

# ── locate the frontmatter block ────────────────────────────────────────────
if [ "$(sed -n '1p' "$TARGET")" != "---" ]; then
  echo "SKILL.md does not open with a --- frontmatter delimiter"
  exit 1
fi

close_line="$(awk 'NR>1 && /^---[[:space:]]*$/ {print NR; exit}' "$TARGET")"
if [ -z "$close_line" ]; then
  echo "SKILL.md frontmatter has no closing --- delimiter"
  exit 1
fi

block="$(sed -n "2,$((close_line - 1))p" "$TARGET")"

is_allowed_field() {
  local want="$1" f
  for f in $ALLOWED_FIELDS; do
    [ "$f" = "$want" ] && return 0
  done
  return 1
}

# Only a line with NO leading whitespace is a top-level field -- an indented
# line belongs to a value like `metadata`'s own map, not the frontmatter itself.
get_value() { # get_value <key>
  printf '%s\n' "$block" | grep -E "^${1}:" | head -n1 | sed -E "s/^${1}:[[:space:]]*//; s/[[:space:]]+\$//"
}
has_key() { # has_key <key>
  printf '%s\n' "$block" | grep -qE "^${1}:"
}

fail=0
fail_line() { echo "$1"; fail=1; }

# ── rule 1 . the allowlist ───────────────────────────────────────────────────
while IFS= read -r key; do
  [ -n "$key" ] || continue
  is_allowed_field "$key" || fail_line "frontmatter field not in the allowed set of 6: $key"
done < <(printf '%s\n' "$block" | grep -E '^[A-Za-z0-9_-]+:' | sed -E 's/^([A-Za-z0-9_-]+):.*/\1/')

# ── rules 2-4 . name ──────────────────────────────────────────────────────────
name_val=""
has_key name && name_val="$(get_value name)"
if [ -n "$name_val" ]; then
  [ "${#name_val}" -le "$MAX_NAME_LEN" ] || fail_line "name is longer than $MAX_NAME_LEN characters (${#name_val})"
  dir_val="$(basename "$SKILL")"
  [ "$name_val" = "$dir_val" ] || fail_line "name '$name_val' does not match the directory name '$dir_val'"
else
  fail_line "name is missing or empty"
fi

# ── rules 5-6 . description ───────────────────────────────────────────────────
description_val=""
has_key description && description_val="$(get_value description)"
if [ -n "$description_val" ]; then
  [ "${#description_val}" -le "$MAX_DESCRIPTION_LEN" ] || fail_line "description is longer than $MAX_DESCRIPTION_LEN characters (${#description_val})"
else
  fail_line "description is missing or empty"
fi

[ "$fail" -eq 0 ] && exit 0
exit 1
