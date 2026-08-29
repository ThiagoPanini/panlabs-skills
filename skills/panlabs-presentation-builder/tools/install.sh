#!/usr/bin/env bash
# Exposes the skill in the two places where the house harnesses look.
#
#   tools/install.sh           installs (or repoints) both links
#   tools/install.sh --check   only checks, writes nothing
#   tools/install.sh --force   replaces even a real directory (dangerous)
#
# The skill is self-contained and publishable: Python 3 and nothing else, zero
# network, zero `pip install`. Installing, then, is just pointing -- and
# pointing by LINK rather than by copy, so the installed skill is always the
# one in the repository instead of a snapshot of it that quietly goes stale.
#
#   ~/.agents/skills/<name>   -> the repository (absolute link)
#   ~/.claude/skills/<name>   -> ../../.agents/skills/<name>  (relative link)
#
# The two levels are the convention the other house skills already use: one
# side carries, the other points.
#
# ⚠️ THE LINK NEVER POINTS TO A WORKTREE, and that is not a preference.
#
# A worktree lives under `.claude/worktrees/` and is DELETED along with the
# session that created it. A link to there works today and is a broken link
# tomorrow, with nothing warning about it -- the skill simply vanishes from the
# harness. Running from inside a worktree, this resolves the main checkout via
# `--git-common-dir` and points there instead, saying out loud that it did.
#
# AND IT REFUSES RATHER THAN DEGRADING, which is where this parts company with
# the sibling installer it is otherwise modelled on. That one warns and points
# at the worktree anyway. A warning is the right shape when the fallback is
# merely worse; here the fallback is the exact outcome the rule above exists to
# forbid, arriving later, silently, in a session that will not be looking. So
# with the main checkout unresolvable, nothing is written and the exit code
# says so.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_LOCAL="$(dirname "$HERE")"
NAME="$(basename "$SKILL_LOCAL")"

CHECK=0; FORCE=0
for a in "$@"; do
  case "$a" in
    --check) CHECK=1 ;;
    --force) FORCE=1 ;;
    *) echo "unknown argument: $a"; exit 2 ;;
  esac
done

# ---------------------------------------------------- where the link points to
TARGET="$SKILL_LOCAL"
if [[ "$SKILL_LOCAL" == *"/.claude/worktrees/"* ]]; then
  COMMON="$(git -C "$SKILL_LOCAL" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  MAIN="$(dirname "${COMMON:-}")"
  CANDIDATE="$MAIN/skills/$NAME"
  if [ -n "${COMMON:-}" ] && [ -d "$CANDIDATE" ]; then
    TARGET="$CANDIDATE"
    echo "  ⚠ running from a worktree — pointing to the main checkout:"
    echo "      worktree:  $SKILL_LOCAL"
    echo "      target:    $TARGET"
    echo "    (a link to a worktree breaks when the session is deleted, with no warning)"
  else
    echo "  ✗ running from a worktree, and the main checkout is not at $CANDIDATE."
    echo "    Nothing was written. Linking to a worktree would install a skill"
    echo "    that disappears when this session is deleted, and nothing would"
    echo "    say so — run this again from the main checkout."
    exit 1
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
# ⚠️ The last two are different things. The `~/.claude/` link carries a
# RELATIVE path (`../../.agents/…`), and `readlink -f` on a relative string
# resolves against the CALLER's working directory, not against the link's
# directory. What decides is the FINAL DESTINATION: both links have to end up
# at the same skill root, whatever text they carry.
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

# ------------------------------------- and the proof: run FROM THERE, not here
#
# Reading `SKILL.md` through the link proves the link resolves. It does not
# prove the skill RUNS, and the two come apart exactly where it matters: a link
# to a tree missing `engine/` reads its front door perfectly. So the documented
# command runs, from each path in turn, and what is asserted is the property
# the whole format rests on -- a page that carries its own fonts and therefore
# opens with no network at all.
echo
echo "checking via the installed path (Python 3 and nothing else)"
echo

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/panlabs-presentation-builder-install.XXXXXX")"
if [ -z "$SCRATCH" ] || [ ! -d "$SCRATCH" ]; then
  echo "  ✗ could not make a temp directory to build into — nothing was verified"
  exit 1
fi
trap 'rm -rf "$SCRATCH"' EXIT

for base in "$HOME/.claude/skills/$NAME" "$HOME/.agents/skills/$NAME"; do
  if [ ! -r "$base/SKILL.md" ]; then bad "$base/SKILL.md unreadable"; continue; fi
  ok "$base/SKILL.md readable"
  out="$SCRATCH/$(basename "$(dirname "$base")").html"
  # PYTHONDONTWRITEBYTECODE: `build.py` imports `register`, and without this
  # the check would leave `engine/__pycache__/` inside the tree it just
  # installed. Verifying a skill must not modify it.
  if PYTHONDONTWRITEBYTECODE=1 python3 "$base/engine/build.py" \
       "$base/examples/argument.json" "$out" >/dev/null 2>&1; then
    if grep -q "data:font/woff2" "$out" 2>/dev/null; then
      ok "\`python3 engine/build.py\` runs from $base, and the page carries its fonts"
    else
      bad "built from $base, but the page has no embedded font — it would need the network"
    fi
  else
    bad "could not run a skill command from $base"
  fi
done

echo
[ "$failed" = 0 ] && echo "  the skill is exposed at both paths, and runs from both." \
  || echo "  ✗ the installation did not close cleanly."
exit "$failed"
