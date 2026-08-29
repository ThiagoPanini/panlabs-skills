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
# fence shows syntax rather than making a reference. http(s) and mailto targets
# cross network, not tree, and an absolute path is already non-portable by
# construction -- neither is this family's failure to name.
#
# See `references.proof.sh`: both verdicts red on their own, and the #56 shape
# -- a moved file whose own relative link was never rewritten -- reproduced by
# actually moving the file.
#
# WIDENED BY #161. The sweep above reads only `*.md`, and only markdown
# link/image syntax inside it -- 8 of the 73 files a skill this size holds.
# Twenty-eight dead pointers hid in the other 65, in a comment in a `.cjs`, a
# `description` in a `.json`, a bare path typed into `.md` prose that was never
# a markdown link. A second, independent sweep covers exactly that gap:
#
#   - EVERY file under the skill root -- `.md`, `.cjs`, `.sh`, `.json` -- is
#     searched, outside fenced code blocks and outside markdown link/image
#     syntax (already the first sweep's job), for a bare PATH-LIKE token:
#     anything containing `/` and ending in `.cjs`, `.sh`, `.json` or `.md`.
#     The search itself is scoped to where this repo actually writes these
#     citations -- a `.cjs`/`.sh` comment, any quoted string in a `.json`
#     (`description` included), running `.md` prose -- never the executable
#     body of a `.cjs`/`.sh` file, which is what makes it safe to run over
#     `engine/vendor/elk.bundled.cjs` without drowning in its own internals.
#   - Each candidate is tried against THREE anchors, in order: the citing
#     file's own directory, the skill root, and the repository root. This
#     codebase writes these citations all three ways -- a self-reference as
#     `./sibling.cjs`, most comments as if the skill root were cwd, anything
#     moved out to `workbench/` or `scripts/` as repository-root-relative --
#     and existing under ANY of the three is enough.
#   - Self-containment is NOT enforced on this second sweep: a comment or a
#     `description` naming repo-root dev tooling (`workbench/`,
#     `scripts/checks/`) that exists there is accepted on purpose. Whether
#     that class of citation should be allowed to leave the installed package
#     is a question the #161 audit deliberately left open for another ticket.
#     Existence is all that is asked; nothing found under any of the three
#     anchors fails, same as an orphan link does on the first sweep.
#   - A dotdir/dotfile name (`.aws-context/premissas.md`) is not this family's
#     job either, on either sweep: `.` and `..` are the only leading-dot forms
#     that mean "relative to here" in this repo's prose; anything else
#     starting with a dot is documented elsewhere as a directory the skill
#     reads FROM THE CALLING PROJECT, never a path inside this repo.
#
# See `references.proof.sh` cases 8-11 for the three anchors and the one that
# stays unenforced on purpose.
set -uo pipefail

if [ "${1:-}" = "--describe" ]; then
  echo "every relative reference inside a skill file resolves to a path inside the skill"
  echo "every relative reference inside a skill file resolves to something that exists"
  echo "every bare path cited in a comment, a JSON string, or prose outside link syntax resolves to something that exists, from its own file's directory, the skill root, or the repository root"
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
REPO_ROOT="$(cd "$ROOT/../.." && pwd -P)"

# Every link/image target in <file>, fenced code blocks excluded -- a fence
# (optionally indented, ``` or ~~~) is showing syntax, not making a reference.
targets_in() { # targets_in <file>
  sed -E '/^[[:space:]]*(```|~~~)/,/^[[:space:]]*(```|~~~)/{/^[[:space:]]*(```|~~~)/!d}' "$1" \
    | grep -oE '\]\([^)]+\)' \
    | sed -E 's/^\]\(//; s/\)$//'
}

# Every bare path-like citation in <file>, outside fenced code blocks and
# outside markdown link/image syntax -- comments for `.cjs`/`.sh`, every
# quoted string for `.json`, running prose for `.md`. "Path-like" means:
# contains `/`, ends in `.cjs`, `.sh`, `.json` or `.md`.
bare_targets_in() { # bare_targets_in <file>
  local prose
  case "$1" in
    *.md)
      prose="$(sed -E '/^[[:space:]]*(```|~~~)/,/^[[:space:]]*(```|~~~)/{/^[[:space:]]*(```|~~~)/!d}' "$1" \
        | sed -E 's/\[[^]]*\]\([^)]*\)//g')"
      ;;
    *.cjs)
      prose="$(awk '
        /\/\*/ { in_block = 1 }
        in_block { print }
        /\*\// { in_block = 0 }
        /^[[:space:]]*\/\// { print }
      ' "$1")"
      ;;
    *.sh)
      prose="$(grep -E '^[[:space:]]*#' "$1" | grep -v '^#!')"
      ;;
    *.json)
      prose="$(grep -oE '"([^"\\]|\\.)*"' "$1")"
      ;;
    *)
      return 0
      ;;
  esac
  printf '%s\n' "$prose" \
    | grep -oE '[A-Za-z0-9_./-]+\.(cjs|sh|json|md)' \
    | grep '/' \
    | grep -v '^/' \
    | grep -vE '^\.[A-Za-z]' \
    | sort -u
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

  case "$file" in
    *.md)
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
      ;;
  esac

  while IFS= read -r target; do
    [ -n "$target" ] || continue
    r0="$(resolve "$dir" "$target")"
    r1="$(resolve "$ROOT" "$target")"
    r2="$(resolve "$REPO_ROOT" "$target")"
    if [ -e "$r0" ] || [ -e "$r1" ] || [ -e "$r2" ]; then
      continue
    fi
    echo "$rel cites $target, which does not resolve from its own directory, the skill root, or the repository root"
    failures=$((failures + 1))
  done < <(bare_targets_in "$file")
done < <(find "$ROOT" -type f \( -name '*.md' -o -name '*.cjs' -o -name '*.sh' -o -name '*.json' \) | sort)

[ "$failures" -eq 0 ] && exit 0
exit 1
