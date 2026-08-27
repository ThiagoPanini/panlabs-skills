#!/usr/bin/env bash
# Exposes the skill in the two places where the house harnesses look.
#
#   tools/install.sh              installs (or repoints) both links
#   tools/install.sh --check   only checks, writes nothing
#   tools/install.sh --force     replaces even a real directory (dangerous)
#
# Map assumption 7 requires the skill to be self-contained and publishable: zero
# binaries, zero network, zero `npm install` at runtime. Installing, then, is just
# pointing — and pointing by LINK rather than by copy, so the installed skill is
# always the one in the repository instead of a snapshot of it that quietly goes
# stale.
#
#   ~/.agents/skills/<name>   → the repository (absolute link)
#   ~/.claude/skills/<name>   → ../../.agents/skills/<name>  (relative link)
#
# The two levels are the convention the other house skills already use
# (`panlabs-python-standards`, `caveman`, `frontend-design`): one side carries, the
# other points.
#
# ⚠️ THE LINK NEVER POINTS TO A WORKTREE, and that is not a preference.
#
# A Claude Code worktree lives under `.claude/worktrees/` and is DELETED along
# with the session that created it. A link to there works today and becomes a
# broken link tomorrow, with nothing warning about it — the skill simply vanishes
# from the harness. If this script runs from inside a worktree, it resolves the
# main checkout via `--git-common-dir` and points there instead, saying out loud
# that it did so.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_LOCAL="$(dirname "$HERE")"
NAME="$(basename "$SKILL_LOCAL")"

CHECK=0; FORCE=0
for a in "$@"; do
  case "$a" in
    --check) CHECK=1 ;;
    --force)   FORCE=1 ;;
    *) echo "unknown argument: $a"; exit 2 ;;
  esac
done

# ---------------------------------------------------- where the link points to
TARGET="$SKILL_LOCAL"
if [[ "$SKILL_LOCAL" == *"/.claude/worktrees/"* ]]; then
  COMMON="$(git -C "$SKILL_LOCAL" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  MAIN="$(dirname "${COMMON:-}")"
  CANDIDATE="$MAIN/skills/$NAME"
  if [ -d "$CANDIDATE" ]; then
    TARGET="$CANDIDATE"
    echo "  ⚠ running from a worktree — pointing to the main checkout:"
    echo "      worktree:  $SKILL_LOCAL"
    echo "      target:    $TARGET"
    echo "    (a link to a worktree breaks when the session is deleted, with no warning)"
  else
    echo "  ⚠ running from a worktree and could not find the main checkout at $CANDIDATE."
    echo "    Pointing to the worktree instead — REPOINT after the merge."
  fi
fi

[ -f "$TARGET/SKILL.md" ] || { echo "  ✗ $TARGET does not look like the skill root (no SKILL.md)"; exit 1; }

failed=0
ok()  { echo "  ✓ $1"; }
bad() { echo "  ✗ $1"; failed=1; }

# ------------------------------------------------------------------ one link
# $1 = the link's path · $2 = the text the link carries · $3 = where it has to
# END UP once resolved
#
# ⚠️ The last two are different things, and confusing them was a real bug here.
# The `~/.claude/` link carries a RELATIVE path (`../../.agents/…`), and
# `readlink -f` on a relative string resolves against the CALLER's working
# directory — not against the link's directory. `--check` used to reject a
# perfectly correct link. What decides is the FINAL DESTINATION: both links have
# to end up at the same skill root, whatever text they carry.
link_skill() {
  local link="$1" to="$2" destination="$3"
  local dir; dir="$(dirname "$link")"

  if [ ! -d "$dir" ]; then
    [ "$CHECK" = 1 ] && { bad "$dir does not exist"; return; }
    mkdir -p "$dir" || { bad "could not create $dir"; return; }
  fi

  if [ -L "$link" ]; then
    local current; current="$(readlink -f "$link" 2>/dev/null || true)"
    if [ "$current" = "$(readlink -f "$destination")" ]; then ok "$link → $current (already in place)"; return; fi
    [ "$CHECK" = 1 ] && { bad "$link resolves to $current, not to $destination"; return; }
    rm -f "$link"
  elif [ -e "$link" ]; then
    # a REAL directory: might be a skill from another source. Not deleted on our own say-so.
    if [ "$FORCE" != 1 ]; then
      bad "$link already exists and is NOT a link — not replacing it without --force"
      return
    fi
    [ "$CHECK" = 1 ] && { bad "$link exists and is not a link"; return; }
    rm -rf "$link"
  else
    [ "$CHECK" = 1 ] && { bad "$link does not exist"; return; }
  fi

  ln -s "$to" "$link" && ok "$link → $to" || bad "could not link $link"
}

echo
echo "installing \"$NAME\""
echo
link_skill "$HOME/.agents/skills/$NAME" "$TARGET" "$TARGET"
link_skill "$HOME/.claude/skills/$NAME" "../../.agents/skills/$NAME" "$TARGET"

# --------------------------------------------- and the proof: run FROM THERE, not from here
echo
echo "checking via the installed path (assumption 7: nothing beyond Node)"
echo
for base in "$HOME/.claude/skills/$NAME" "$HOME/.agents/skills/$NAME"; do
  if [ ! -r "$base/SKILL.md" ]; then bad "$base/SKILL.md unreadable"; continue; fi
  ok "$base/SKILL.md readable"
  # the test that matters: a skill command RUNNING from the link
  if output="$(cd "$base" && node catalog/aws-shapes.cjs lambda 2>&1)"; then
    echo "$output" | grep -q "mxgraph.aws4.lambda" \
      && ok "\`node catalog/aws-shapes.cjs lambda\` runs from $base" \
      || bad "ran but did not resolve the shape"
  else
    bad "could not run a skill command from $base"
  fi
done

echo
[ "$failed" = 0 ] && echo "  the skill is exposed at both paths, and runs from both." \
  || echo "  ✗ the installation did not close cleanly."
exit "$failed"
