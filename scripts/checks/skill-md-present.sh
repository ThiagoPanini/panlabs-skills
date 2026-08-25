#!/usr/bin/env bash
# THE CHEAPEST RULE THERE IS, and the one every other family stands on: a
# directory under `skills/` carries a `SKILL.md` at its root.
#
#   scripts/checks/skill-md-present.sh --describe
#   scripts/checks/skill-md-present.sh <skill-dir>
#
# It is first because it is load-bearing, not because it is easy. `SKILL.md` is
# the only file the agent runtime reads to decide whether a skill applies at all;
# a directory without one is a directory, not a skill. And every family that
# comes after -- frontmatter, references, weight -- opens this same file to do
# its job, so its absence is the one failure that makes the others unanswerable.
#
# See `skill-md-present.proof.sh` for the proof that it can go red.
set -uo pipefail

if [ "${1:-}" = "--describe" ]; then
  echo "every directory under skills/ carries a SKILL.md file at its root"
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

# `-f` and not `-e`: a directory named SKILL.md satisfies existence and satisfies
# nothing else. It reads as present in a listing and is unreadable to everything.
if [ -f "$TARGET" ]; then
  exit 0
fi

if [ -e "$TARGET" ]; then
  echo "SKILL.md is present but is not a regular file"
else
  echo "no SKILL.md at the root of the skill directory"
fi
exit 1
