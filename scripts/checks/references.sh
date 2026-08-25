#!/usr/bin/env bash
# EVERY REFERENCE A SKILL FILE MAKES STAYS INSIDE THE SKILL, AND LANDS ON
# SOMETHING REAL -- one sweep, two verdicts:
#
#   scripts/checks/references.sh --describe
#   scripts/checks/references.sh <skill-dir>
#
# Whoever installs a skill receives only its directory, nothing beside it. A
# relative link that climbs out of the skill's own tree works on the machine
# that wrote it and breaks on every machine that installs it -- the one
# direction a reference may travel is IN, never OUT. Separately, `git mv` moves
# a file's bytes and rewrites nothing inside it: a link correct before the move
# can still land inside the tree and point at nothing after it. Both are the
# same sweep of every relative link/image target in every `*.md` file: resolves
# outside the skill -> fails as self-containment; resolves inside but nothing is
# there -> fails as orphan; resolves inside to something real -> passes.
#
# SCOPE, ASSERTED RATHER THAN ASSUMED. This reads Markdown link/image syntax --
# `[text](target)`, `![alt](target)` -- and skips fenced code blocks, since a
# fence shows syntax rather than making a reference. It does not chase a bare
# path typed into running prose without brackets: that treats every string in
# every file as a possible path, and a rule this repo can grant no exemption
# from (no per-skill config, no baseline -- see the harness's own doctrine) has
# no business guessing. http(s) and mailto targets cross network, not tree, and
# an absolute path is already non-portable by construction -- neither is this
# family's failure to name.
#
# See `references.proof.sh`: both verdicts red on their own, and the #56 shape
# -- a moved file whose own relative link was never rewritten -- reproduced by
# actually moving the file.
set -uo pipefail

if [ "${1:-}" = "--describe" ]; then
  echo "every relative reference inside a skill file resolves to a path inside the skill"
  echo "every relative reference inside a skill file resolves to something that exists"
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

# Every link/image target in <file>, fenced code blocks excluded -- a fence
# (optionally indented, ``` or ~~~) is showing syntax, not making a reference.
targets_in() { # targets_in <file>
  sed -E '/^[[:space:]]*(```|~~~)/,/^[[:space:]]*(```|~~~)/{/^[[:space:]]*(```|~~~)/!d}' "$1" \
    | grep -oE '\]\([^)]+\)' \
    | sed -E 's/^\]\(//; s/\)$//'
}

# Lexical resolution of <path> against <dir> -- no existence required, so a
# dangling target still resolves to somewhere this can classify.
resolve() { # resolve <dir> <path>
  ( cd "$1" 2>/dev/null && realpath -m -- "$2" )
}

failures=0
while IFS= read -r file; do
  rel="${file#"$ROOT"/}"
  dir="$(dirname "$file")"
  while IFS= read -r target; do
    [ -n "$target" ] || continue
    target="${target%%#*}"        # a same-file anchor is not a path
    [ -n "$target" ] || continue   # a bare "#section" leaves nothing to check
    case "$target" in
      http://*|https://*|mailto:*|/*) continue ;;
    esac

    resolved="$(resolve "$dir" "$target")"
    case "$resolved" in
      "$ROOT"|"$ROOT"/*) ;;
      *)
        echo "$rel references $target, which resolves outside the skill"
        failures=$((failures + 1))
        continue
        ;;
    esac
    if [ ! -e "$resolved" ]; then
      echo "$rel references $target, which does not exist"
      failures=$((failures + 1))
    fi
  done < <(targets_in "$file")
done < <(find "$ROOT" -type f -name '*.md' | sort)

[ "$failures" -eq 0 ] && exit 0
exit 1
