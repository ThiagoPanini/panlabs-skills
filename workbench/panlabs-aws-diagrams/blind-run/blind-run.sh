#!/usr/bin/env bash
# THE BLIND RUN'S SANDBOX -- a caller project that is not this repository, and
# every door to the skill opening onto the copy inside it.
#
#   blind-run.sh setup      build the sandbox and print the prompt to hand over
#   blind-run.sh verify     audit the isolation; one line per breach
#   blind-run.sh teardown   put the skill homes back, remove the sandbox
#   blind-run.sh paths      print every name this harness decides, as key=value
#
#   --at <dir>          the sandbox root  (default: ${TMPDIR:-/tmp}/panlabs-blind-run)
#   --skill-home <dir>  a directory some harness reads skills from. Repeatable,
#                       and it REPLACES the default pair rather than adding to
#                       it -- which is what lets the proof run against a fake
#                       HOME instead of the machine's real one.
#
# WHY THIS EXISTS. #47 ran the blind simulation inside THIS repository, and two
# things went wrong at once -- both of them about the environment, neither about
# the skill.
#
#   The context-free sub-agent read CLAUDE.md, recognised `panlabs-skills` as a
#   public repository of skills rather than a client's project, and REFUSED to
#   write a fictitious health-data architecture into it. That judgement was
#   right. It wrote outside git instead, where `tools/case.cjs` fell back to the
#   current directory exactly as documented -- the engine behaved, the choice of
#   where to run did not. A protocol whose destination is "the repository you
#   happen to be standing in" only measures anything when that repository can
#   plausibly be the caller's.
#
#   And the copy the simulation prepared was never the copy that ran. The
#   sub-agent found the skill through the GLOBAL install already on the machine
#   -- `~/.claude/skills/panlabs-aws-diagrams`, a link resolving into the main
#   checkout -- so hiding the workbench on a throwaway branch neutralised
#   nothing: the model corpus sat one `../..` away the whole time. Nothing went
#   looking for it, which is luck, not isolation. #121.
#
# So the sandbox does two things, and `verify` is what says they held:
#
#   1. A CALLER PROJECT that is a git repository of its own, with its own
#      identity, its own README, its own architecture directory. The
#      confidentiality objection dissolves because the architecture being drawn
#      IS that project's architecture.
#   2. A SEVERED COPY of the skill inside it, with every skill home on the
#      machine repointed at that copy for the length of the run and the original
#      parked next door, so teardown can put it back.
#
# ⚠️ THE CALLER PROJECT NEVER NAMES `docs/architecture/diagrams/`. Its own docs
# establish that architecture material belongs in the repository, and stop
# there. The criterion under test is that the SKILL's convention produces that
# path; a project that dictated it would make the criterion pass by construction
# and measure nothing. `verify` fails if the project ever starts naming it.
#
# ⚠️ THE COPY IS A COPY, NOT A LINK, and the difference is the point.
# `tools/install.sh` links on purpose -- an installed skill that IS the
# repository never goes stale. Here the requirement is the opposite: no path may
# climb out of the copy into a tree carrying `workbench/panlabs-aws-diagrams`,
# and a link climbs straight back into one.
#
# ⚠️ THE CALLER PROJECT CARRIES A `package.json`, AND IT IS LOAD-BEARING.
# Node reads a `.js` file as CommonJS or ESM by the nearest `package.json` above
# it. The skill shipped exactly one `.js` — the vendored ELK bundle, in an
# otherwise `.cjs` tree, with no `package.json` of its own — and the first run
# under this harness landed beneath a stray `/tmp/package.json` from a draw.io
# extraction, `"type": "module"`. The bundle was read as ESM and the engine died
# on `ELK is not a constructor`. #133 renamed it to `.cjs` the same day, so
# today there is no `.js` left to be read either way.
#
# The pin and the check stay, because the property they hold is the SANDBOX's,
# not the skill's: the day a `.js` comes back — a vendored bundle, something
# generated — the machine must not be the one deciding how it is read. `verify`
# fails when the deciding `package.json` lives outside the sandbox, and the
# fixture's own `package.json` is what keeps it inside.
#
# ⚠️ TEARDOWN RESTORES FROM A RECORD BESIDE THE SKILL HOME, NOT FROM THE
# SANDBOX. The sandbox lives in the system temp and a machine may sweep it; a
# restore that read from there would be a restore that stops working exactly
# when it is needed. The record is `RECORD_NAME` below, inside each skill home
# -- a dot-prefixed FILE, so nothing that discovers skills by scanning
# directories ever sees it as one. `blind-run.sh paths` prints it rather than
# anyone spelling it out a second time.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
SKILL_NAME="panlabs-aws-diagrams"
SKILL_SOURCE="$REPO/skills/$SKILL_NAME"
# ⚠️ NOT `basename "$REPO"`. Run from a worktree, that answers with the
# worktree's directory name (`fix-engine-manifest-80`) instead of the
# repository's, and the check for "the caller project must not wear this
# repository's name" would then be looking for a string nobody has ever typed.
# `--git-common-dir` resolves to the main checkout's `.git` from anywhere.
REPO_NAME="$(basename "$(dirname "$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")" 2>/dev/null)"
# Spelled as an `if` and not as `[ ] || [ ] && …`: that chain parses as
# `(A||B) && C`, which is right today and one `set -e` away from skipping the
# fallback in silence.
if [ -z "$REPO_NAME" ] || [ "$REPO_NAME" = "." ]; then REPO_NAME="$(basename "$REPO")"; fi
PROJECT_NAME="labmove-platform"
RECORD_NAME=".$SKILL_NAME.blind-run-parked"
PARKED_SUFFIX="$SKILL_NAME.blind-run-parked"
WATCH_RECORD="watched-tree.before"
FIXTURE_RECORD="fixture-commit"
HOMES_RECORD="skill-homes"
# ⚠️ THE PROOF THAT THIS SANDBOX IS OURS, and the only thing that licenses
# `teardown` to `rm -rf` anything. Written the moment the directory exists, so a
# setup that dies halfway still leaves a sandbox teardown is allowed to remove —
# and a `--at` pointed at somebody's home directory is refused instead of
# deleted.
STAMP=".blind-run"

say()  { printf '  %s\n' "$1"; }
ok()   { printf '  ✓ %s\n' "$1"; }
warn() { printf '  ⚠ %s\n' "$1"; }
die()  { printf '\n  ✗ %s\n\n' "$1" >&2; exit 1; }

# ── the arguments ─────────────────────────────────────────────────────────────
VERB="${1:-}"
[ $# -gt 0 ] && shift
SANDBOX="${TMPDIR:-/tmp}/panlabs-blind-run"
SKILL_HOMES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --at)         [ $# -ge 2 ] || die "--at needs a directory"; SANDBOX="$2"; shift 2 ;;
    --skill-home) [ $# -ge 2 ] || die "--skill-home needs a directory"; SKILL_HOMES+=("$2"); shift 2 ;;
    *) die "unknown argument: $1" ;;
  esac
done
HOMES_WERE_GIVEN=1
if [ "${#SKILL_HOMES[@]}" -eq 0 ]; then
  HOMES_WERE_GIVEN=0
  SKILL_HOMES=("$HOME/.claude/skills" "$HOME/.agents/skills")
fi

PROJECT="$SANDBOX/$PROJECT_NAME"
COPY="$PROJECT/.claude/skills/$SKILL_NAME"

# Literal containment, never a `case` glob. `case "$p" in "$root"/*)` reads the
# root as a PATTERN, so a sandbox path carrying `[` or `*` — `--at` takes
# whatever it is given — is misjudged in whichever direction the glob happens to
# fall. `${p#"$root"/}` strips a quoted prefix, which is the literal test.
inside() { # inside <root> <path>
  local root="$1" p="$2"
  [ "$p" = "$root" ] && return 0
  [ "${p#"$root"/}" != "$p" ]
}

# ── where a blind run may and may not stand ───────────────────────────────────

# Every directory from <dir> up to `/`, nearest first. Physical, so a symlinked
# temp directory is walked as the filesystem sees it and not as the caller typed
# it.
ancestors() { # ancestors <dir>
  local d
  d="$(cd "$1" 2>/dev/null && pwd -P)" || return 0
  while :; do
    printf '%s\n' "$d"
    [ "$d" = "/" ] && break
    d="$(dirname "$d")"
  done
}

# The trees a blind run must not be able to climb into, printed one per line:
# any ancestor carrying the skill's workbench -- the model corpus #47 could not
# neutralise -- or a second copy of the skill under `skills/`. <own> is the
# copy's own physical path, which is the one `skills/<name>` that is allowed.
breaches_above() { # breaches_above <dir> [own]
  local from="$1" own="${2:-}" a p
  while IFS= read -r a; do
    [ -d "$a/workbench/$SKILL_NAME" ] && printf '%s\n' "$a/workbench/$SKILL_NAME"
    if [ -d "$a/skills/$SKILL_NAME" ]; then
      p="$(cd "$a/skills/$SKILL_NAME" && pwd -P)"
      { [ -n "$own" ] && [ "$p" = "$own" ]; } || printf '%s\n' "$a/skills/$SKILL_NAME"
    fi
  done < <(ancestors "$from")
  return 0
}

# ── the skill homes: park the original, point the entry at the copy ───────────

read_record() { # read_record <record-file> <key>
  sed -n "s/^$2=//p" "$1"
}

# Where the original gets parked when a home holds a real directory rather than
# a link. Beside the skills directory, never inside it: anything that discovers
# skills by scanning would read a second directory in there as a second skill.
parked_slot() { # parked_slot <home>
  printf '%s/%s\n' "$(dirname "$1")" "$PARKED_SUFFIX"
}

park_home() { # park_home <home>
  local home="$1" entry record created=no kind target=""
  entry="$home/$SKILL_NAME"
  record="$home/$RECORD_NAME"

  if [ ! -d "$home" ]; then
    mkdir -p "$home" || die "could not create the skill home $home"
    created=yes
  fi

  # ⚠️ WHAT GETS RECORDED IS DECIDED BEFORE ANYTHING MOVES, and the record lands
  # in ONE write. The first version appended `kind=` after the fact: a setup
  # that died in between left a record carrying only `home-created`, and
  # teardown then had nothing to restore from but a "restore by hand".
  if [ -L "$entry" ]; then
    kind=symlink
    # `readlink` and not `readlink -f`: the ~/.claude entry carries a RELATIVE
    # text (`../../.agents/skills/<name>`), and restoring the resolved path
    # instead would silently rewrite the machine's install into a shape its own
    # installer never wrote.
    target="$(readlink "$entry")"
  elif [ -e "$entry" ]; then
    kind=moved
    target="$(parked_slot "$home")"
  else
    kind=absent
  fi

  printf 'home-created=%s\nkind=%s\ntarget=%s\n' "$created" "$kind" "$target" > "$record" \
    || die "could not write the parked record at $record"

  case "$kind" in
    symlink)
      ln -sfn "$COPY" "$entry" || die "could not repoint $entry"
      ok "$entry → the copy (was a link to $target)" ;;
    moved)
      mv "$entry" "$target" || die "could not park $entry at $target"
      ln -s "$COPY" "$entry" || die "could not link $entry"
      ok "$entry → the copy (a real directory was parked at $target)" ;;
    absent)
      ln -s "$COPY" "$entry" || die "could not link $entry"
      ok "$entry → the copy (nothing was installed here)" ;;
  esac
}

restore_home() { # restore_home <home>
  local home="$1" entry record kind target created
  entry="$home/$SKILL_NAME"
  record="$home/$RECORD_NAME"
  [ -f "$record" ] || { say "$home — nothing parked here"; return 0; }

  kind="$(read_record "$record" kind)"
  target="$(read_record "$record" target)"
  created="$(read_record "$record" home-created)"

  # ⚠️ Only ever a link is removed. A real directory at this path is something
  # this harness did not put there, and blowing it away on our own say-so is the
  # one mistake a teardown cannot undo.
  if [ -L "$entry" ]; then
    rm -f "$entry"
  elif [ -e "$entry" ]; then
    printf '  ✗ %s is not a link — refusing to remove it. Restore by hand from %s\n' "$entry" "${target:-<nothing parked>}"
    return 1
  fi

  case "$kind" in
    symlink) ln -s "$target" "$entry" || return 1; ok "$entry → $target (restored)" ;;
    moved)   mv "$target" "$entry"    || return 1; ok "$entry restored from $target" ;;
    absent)  ok "$entry removed (nothing was installed here before)" ;;
    *)       printf '  ✗ %s carries no kind — restore by hand\n' "$record"; return 1 ;;
  esac

  rm -f "$record"
  [ "$created" = yes ] && rmdir "$home" 2>/dev/null
  return 0
}

# ── setup ─────────────────────────────────────────────────────────────────────

cmd_setup() {
  [ -e "$SANDBOX" ] && die "the sandbox already exists at $SANDBOX — run teardown first"
  [ -f "$SKILL_SOURCE/SKILL.md" ] || die "no skill to copy at $SKILL_SOURCE"

  # Every reason to refuse is collected BEFORE the first byte is written — and
  # that sentence used to be false. The occupied-parking check lived inside
  # `park_home`, so with two homes and the second one blocked, setup aborted
  # having already repointed the first and built the sandbox. Half a machine
  # moved, and a message that did not even say to run teardown.
  local home
  for home in "${SKILL_HOMES[@]}"; do
    [ -e "$home/$RECORD_NAME" ] && die "$home/$RECORD_NAME exists — an earlier blind run never tore down. Run teardown first."
    if [ ! -L "$home/$SKILL_NAME" ] && [ -e "$home/$SKILL_NAME" ] && [ -e "$(parked_slot "$home")" ]; then
      die "$home/$SKILL_NAME is a real directory and would have to be parked at $(parked_slot "$home"), which is occupied. Clear it, or run teardown."
    fi
  done

  local parent breach staging untracked
  parent="$(dirname "$SANDBOX")"
  mkdir -p "$parent" || die "could not create $parent"
  breach="$(breaches_above "$parent")"
  [ -n "$breach" ] && die "refusing to build the sandbox under $parent — a blind agent could climb into:
$(printf '%s\n' "$breach" | sed 's/^/      /')"

  printf '\n  BLIND RUN · setup\n\n'

  # The stamp goes down BEFORE anything else, and it is what licenses teardown
  # to remove this directory at all.
  mkdir -p "$SANDBOX" || die "could not create $SANDBOX"
  printf 'harness=%s\n' "$HERE" > "$SANDBOX/$STAMP" || die "could not stamp $SANDBOX"
  # And the homes this run touched, so a teardown invoked without the same
  # `--skill-home` list still knows which doors to close instead of orphaning
  # one pointing into a sandbox that is about to stop existing.
  printf '%s\n' "${SKILL_HOMES[@]}" > "$SANDBOX/$HOMES_RECORD" || die "could not record the skill homes"

  # ── the caller project ──────────────────────────────────────────────────────
  mkdir -p "$PROJECT" || die "could not create $PROJECT"
  cp -R "$HERE/project/." "$PROJECT/" || die "could not materialise the caller project"
  git -c init.defaultBranch=main init -q "$PROJECT" || die "could not init the caller project"
  git -C "$PROJECT" config user.name  'LabMove Engenharia' || die "could not name the caller project's author"
  git -C "$PROJECT" config user.email 'eng@labmove.example' || die "could not address the caller project's author"
  git -C "$PROJECT" add -A >/dev/null || die "could not stage the caller project"
  git -C "$PROJECT" commit -q -m 'A plataforma como ela está hoje' || die "could not commit the caller project"
  # ⚠️ The FIXTURE's commit, pinned. The two identity assertions — "nothing here
  # names this repository", "nothing here names the destination path" — are
  # about the fixture, and reading them off the working tree would judge the
  # blind agent's own output too: a run that legitimately wrote the words
  # `docs/architecture/diagrams` into its `case.md` would report a breach that
  # is not one. They read this commit instead.
  git -C "$PROJECT" rev-parse HEAD > "$SANDBOX/$FIXTURE_RECORD" || die "could not pin the fixture commit"
  ok "the caller project is a git repository of its own at $PROJECT"

  # ── the severed copy ────────────────────────────────────────────────────────
  # git decides what ships, so no second list of exclusions exists to drift from
  # `tools/package.sh`. The WORKING TREE is copied, not HEAD -- a blind run
  # measures the skill as it is right now, uncommitted work included -- but a
  # file nobody added is a file the repository would not hand anyone, so it is
  # counted out loud instead of silently carried.
  staging="$(mktemp -d)" || die "could not make a staging directory"
  git -C "$REPO" ls-files -z -- "skills/$SKILL_NAME" \
    | tar -C "$REPO" --null --files-from=- -cf - \
    | tar -C "$staging" -xf - || die "could not copy the skill"
  mkdir -p "$(dirname "$COPY")" || die "could not create $(dirname "$COPY")"
  mv "$staging/skills/$SKILL_NAME" "$COPY" || die "could not place the copy"
  rm -rf "$staging"
  ok "the skill is copied — not linked — into $COPY"

  untracked="$(git -C "$SKILL_SOURCE" ls-files --others --exclude-standard | wc -l)"
  [ "$untracked" -gt 0 ] && warn "$untracked untracked file(s) under the skill are NOT in the copy — git decides what ships"

  # ── every door on the machine ───────────────────────────────────────────────
  for home in "${SKILL_HOMES[@]}"; do park_home "$home"; done

  # ── the tree the run is not supposed to touch ───────────────────────────────
  # The blind agent's PROCESS starts wherever the operator opened it, and this
  # harness can hand it a project path but not a working directory. The first
  # run under it left three scratch files in this repository's working tree —
  # criterion 9 of #47, "the working tree came back clean", caught only because
  # someone remembered to type `git status`. The snapshot makes it a line.
  {
    printf 'watching=%s\n' "$REPO"
    git -C "$REPO" status --porcelain
  } > "$SANDBOX/$WATCH_RECORD"

  # ── what the blind agent is handed ──────────────────────────────────────────
  cp "$HERE/brief.md" "$SANDBOX/brief.txt" || die "could not copy the brief"
  awk -v project="$PROJECT" -v brief="$HERE/brief.md" '
    /\{\{brief\}\}/ { while ((getline line < brief) > 0) print line; next }
    { gsub(/\{\{project\}\}/, project); print }
  ' "$HERE/prompt.md" > "$SANDBOX/prompt.txt" || die "could not write the prompt"

  printf '\n  the prompt to hand a context-free agent, and nothing else:\n\n'
  sed 's/^/      /' "$SANDBOX/prompt.txt"
  printf '\n  it is also at %s, and the brief verbatim at %s\n' "$SANDBOX/prompt.txt" "$SANDBOX/brief.txt"
  printf '  audit the isolation with `%s verify`, and put the machine back with `%s teardown`\n\n' \
    "$(basename "$0")" "$(basename "$0")"
}

# ── verify ────────────────────────────────────────────────────────────────────

cmd_verify() {
  local failures=0
  bad() { printf '  ✗ %s\n' "$1"; failures=$((failures + 1)); }

  printf '\n  BLIND RUN · verify\n\n'
  [ -d "$SANDBOX" ] || die "no sandbox at $SANDBOX — run setup first"

  local sandbox_real project_real
  sandbox_real="$(cd "$SANDBOX" && pwd -P)"

  # 1 . the caller project is a repository, and it is its own root
  if [ -d "$PROJECT" ]; then
    project_real="$(cd "$PROJECT" && pwd -P)"
    local toplevel
    toplevel="$(git -C "$PROJECT" rev-parse --show-toplevel 2>/dev/null)"
    if [ "$toplevel" = "$project_real" ]; then
      ok "the caller project is the root of its own git repository"
    else
      bad "the caller project's git root is ${toplevel:-<not a repository>}, not $project_real"
    fi
  else
    bad "there is no caller project at $PROJECT"
    project_real=""
  fi

  # 2 . and it does not identify as this repository
  if [ -n "$project_real" ]; then
    if [ "$(basename "$project_real")" = "$REPO_NAME" ]; then
      bad "the caller project is named $(basename "$project_real") — the same name it must not wear"
    else
      ok "the caller project is named $(basename "$project_real"), not $REPO_NAME"
    fi
    # ⚠️ THE FIXTURE'S COMMIT, NOT THE WORKING TREE. Both sweeps below are about
    # what the fixture says; the working tree also holds whatever the blind
    # agent wrote, and a `case.md` that legitimately spelled
    # `docs/architecture/diagrams` would then be reported as a breach that is
    # not one. `git grep <sha>` reads that one commit and nothing else.
    local fixture
    fixture="$(cat "$SANDBOX/$FIXTURE_RECORD" 2>/dev/null)"
    if [ -z "$fixture" ]; then
      bad "no fixture commit pinned at $SANDBOX/$FIXTURE_RECORD — the caller project's identity cannot be read"
    else
      local named
      named="$(git -C "$PROJECT" grep -lI -e "$REPO_NAME" "$fixture" 2>/dev/null | sed "s/^$fixture://")"
      if [ -n "$named" ]; then
        bad "the caller project names $REPO_NAME in: $(printf '%s' "$named" | tr '\n' ' ')"
      else
        ok "nothing in the caller project names $REPO_NAME"
      fi

      # 3 . and it does not dictate the very path the run is measuring
      local dictates
      dictates="$(git -C "$PROJECT" grep -lI -e 'docs/architecture/diagrams' "$fixture" 2>/dev/null | sed "s/^$fixture://")"
      if [ -n "$dictates" ]; then
        bad "the caller project names docs/architecture/diagrams in: $(printf '%s' "$dictates" | tr '\n' ' ') — the criterion would pass by construction"
      else
        ok "the caller project never names docs/architecture/diagrams — the skill's convention is what has to produce it"
      fi
    fi
  fi

  # 4 . the copy is a copy
  if [ -L "$COPY" ]; then
    bad "the installed skill is a link ($(readlink "$COPY")) — a link climbs back into the tree it came from"
  elif [ ! -f "$COPY/SKILL.md" ]; then
    bad "there is no skill at $COPY"
  else
    ok "the installed skill is a real directory, severed from its source"
  fi

  # 5 . and the repository it answers with is the caller's
  if [ -d "$COPY" ] && [ -n "$project_real" ]; then
    local from_copy
    from_copy="$(git -C "$COPY" rev-parse --show-toplevel 2>/dev/null)"
    if [ "$from_copy" = "$project_real" ]; then
      ok "git, asked from inside the copy, answers with the caller project"
    else
      bad "git, asked from inside the copy, answers ${from_copy:-<no repository>} — case.cjs would write there"
    fi
  fi

  # 6 . nothing inside the sandbox points out of it
  local escapes=0 link target
  while IFS= read -r link; do
    target="$(readlink -f "$link" 2>/dev/null)"
    inside "$sandbox_real" "${target:-}" \
      || { bad "a symlink escapes the sandbox: $link → ${target:-<broken>}"; escapes=1; }
  done < <(find "$sandbox_real" -type l 2>/dev/null)
  [ "$escapes" -eq 0 ] && ok "no symlink inside the sandbox resolves outside it"

  # 7 . and nothing above the copy can be climbed into
  if [ -d "$COPY" ]; then
    local copy_real above
    copy_real="$(cd "$COPY" && pwd -P)"
    above="$(breaches_above "$copy_real" "$copy_real")"
    if [ -n "$above" ]; then
      while IFS= read -r b; do bad "reachable by climbing out of the copy: $b"; done <<< "$above"
    else
      ok "no ancestor of the copy carries a workbench or a second install of the skill"
    fi
  fi

  # 8 . and the module scope its `.js` files are read under belongs to the
  #     sandbox, not to whatever the machine left lying above it
  #
  # Node decides whether a `.js` file is CommonJS or ESM by the NEAREST
  # `package.json` above it, and the skill's vendored ELK bundle is the one
  # `.js` in an otherwise `.cjs` tree. The first blind run under this harness
  # landed in a sandbox whose nearest `package.json` was a stray
  # `/tmp/package.json` left by a draw.io extraction, `"type": "module"` — the
  # UMD bundle was evaluated as ESM, `require` handed back an empty frozen
  # namespace, and the engine died on `ELK is not a constructor` with nothing in
  # the message pointing at the cause. The defect in the skill is its own
  # ticket; what belongs HERE is that a run whose module scope came from the
  # machine is a run that measured the machine.
  #
  # ⚠️ THE COPY'S OWN ROOT IS ALWAYS ONE OF THE PLACES ASKED, and not only the
  # directories that happen to hold a `.js` today. #133 renamed the bundle to
  # `.cjs` the day after this check was written, and a version that asked only
  # about `.js` files then went quiet and reported "nothing above the copy
  # declares a module type" while the fixture's `package.json` sat right there,
  # unread. Green for the wrong reason is the failure this whole file exists to
  # refuse.
  if [ -d "$COPY" ]; then
    local from dir deciding scopes="" kind
    while IFS= read -r from; do
      deciding=""
      while IFS= read -r dir; do
        [ -f "$dir/package.json" ] && { deciding="$dir/package.json"; break; }
      done < <(ancestors "$from")
      [ -n "$deciding" ] || continue
      case "$scopes" in *"|$deciding|"*) continue ;; esac
      scopes="$scopes|$deciding|"
      kind="$(sed -n 's/.*"type"[[:space:]]*:[[:space:]]*"\([a-z]*\)".*/\1/p' "$deciding" | head -1)"
      if inside "$sandbox_real" "$deciding"; then
        ok "the module scope over the copy is the fixture's: $deciding (${kind:-commonjs})"
      else
        bad "the module scope over the copy is not the fixture's: $deciding is outside the sandbox (${kind:-commonjs}) — the machine decides how the skill's .js is read"
      fi
    done < <( { printf '%s\n' "$COPY"; find "$COPY" -type f -name '*.js' -exec dirname {} \; 2>/dev/null; } | sort -u)
    # ⚠️ NO PIN AT ALL IS A BREACH, not a green. Node's default without any
    # `package.json` is CommonJS, so the run would work today — and the first
    # machine to drop one above the sandbox changes how the skill is read, with
    # nothing saying so. The two failures share a stem on purpose: removing the
    # fixture's pin turns this red whichever of the two the machine happens to
    # produce, so the proof does not depend on what sits above /tmp.
    [ -z "$scopes" ] && bad "the module scope over the copy is not the fixture's: nothing pins it, and the next package.json to appear above the sandbox decides"
  fi

  # 9 . every door on the machine opens onto the copy
  local home entry resolved
  for home in "${SKILL_HOMES[@]}"; do
    entry="$home/$SKILL_NAME"
    if [ ! -f "$home/$RECORD_NAME" ]; then
      bad "$home carries no parked record — this harness never neutralised it"
    fi
    # ⚠️ `-L` BEFORE `-e`, and not `-e` alone: `-e` follows the link, so a link
    # pointing at something that is not there reads as "no entry" — and gets
    # reported as a door that leads nowhere when it is really a door that leads
    # OUT. A dangling link is still an entry, and where it points is still the
    # thing worth judging.
    if [ -L "$entry" ] || [ -e "$entry" ]; then
      resolved="$(readlink -f "$entry" 2>/dev/null)"
      if inside "$sandbox_real" "${resolved:-}"; then
        ok "$entry resolves inside the sandbox"
      else
        bad "$entry resolves to ${resolved:-<broken>} — outside the sandbox"
      fi
    else
      bad "$entry does not exist — the skill is reachable from nowhere here"
    fi
  done

  # 10 . and nothing appeared in the tree the run was never supposed to touch
  local before="$SANDBOX/$WATCH_RECORD" watched appeared line
  if [ ! -f "$before" ]; then
    bad "no snapshot at $before — setup never took one, so a leak into the operator's tree cannot be seen"
  else
    watched="$(sed -n 's/^watching=//p' "$before" | head -1)"
    if ! git -C "$watched" rev-parse --git-dir >/dev/null 2>&1; then
      bad "$watched is not a git repository — the snapshot has nothing to compare against"
    else
      appeared="$(comm -13 <(tail -n +2 "$before" | sort) <(git -C "$watched" status --porcelain | sort))"
      if [ -n "$appeared" ]; then
        while IFS= read -r line; do
          [ -n "$line" ] && bad "appeared in $watched while the sandbox existed: $line"
        done <<< "$appeared"
      else
        ok "nothing appeared in $watched while the sandbox existed"
      fi
    fi
  fi

  printf '\n'
  if [ "$failures" -eq 0 ]; then
    say "the sandbox is isolated — the blind run measures the skill, not the machine."
    printf '\n'
    return 0
  fi
  printf '  ✗ %d breach(es) — this run would measure the machine, not the skill.\n\n' "$failures"
  return 1
}

# ── teardown ──────────────────────────────────────────────────────────────────

cmd_teardown() {
  local failed=0 home
  printf '\n  BLIND RUN · teardown\n\n'

  # ⚠️ THE HOMES COME FROM THE SANDBOX WHEN THE CALLER DID NOT NAME THEM. A run
  # set up with a non-default `--skill-home` and torn down without it used to
  # leave that door parked and pointing into a sandbox that this same command
  # was about to delete — a record nobody would ever read again, and a skill
  # home resolving to nothing.
  if [ "$HOMES_WERE_GIVEN" -eq 0 ] && [ -f "$SANDBOX/$HOMES_RECORD" ]; then
    mapfile -t SKILL_HOMES < "$SANDBOX/$HOMES_RECORD"
    say "closing the doors this sandbox recorded: ${SKILL_HOMES[*]}"
  fi
  for home in "${SKILL_HOMES[@]}"; do restore_home "$home" || failed=1; done

  # ⚠️ NOTHING IS REMOVED WITHOUT PROOF THIS HARNESS BUILT IT. `--at` takes
  # whatever it is handed, and an earlier version removed that path outright:
  # pointed at a home directory it deleted the home directory and reported "the
  # machine is back where it was". The stamp is written the moment setup creates
  # the directory, so a half-built sandbox is still removable and somebody
  # else's tree never is. It is the same rule `restore_home` already keeps one
  # function up — never delete what this harness did not put there.
  if [ ! -e "$SANDBOX" ]; then
    say "no sandbox at $SANDBOX"
  elif [ ! -f "$SANDBOX/$STAMP" ]; then
    printf '  ✗ %s carries no %s stamp — this harness did not build it, and will not remove it\n' "$SANDBOX" "$STAMP"
    failed=1
  elif rm -rf "$SANDBOX"; then
    ok "the sandbox at $SANDBOX is gone"
  else
    printf '  ✗ could not remove %s\n' "$SANDBOX"
    failed=1
  fi

  printf '\n'
  [ "$failed" -eq 0 ] && { say "the machine is back where it was."; printf '\n'; return 0; }
  printf '  ✗ the teardown did not close cleanly — read the lines above.\n\n'
  return 1
}

# ── paths ─────────────────────────────────────────────────────────────────────

# Every name this harness decides, printed as `key=value`. It exists because the
# PROOF needs them, and a proof that spells them out again is a second copy that
# drifts: renaming `RECORD_NAME` here once left the proof still green while
# "the parked record is gone" had stopped looking at any record at all. It is
# also the honest answer to "where does this thing put things?".
cmd_paths() {
  printf 'sandbox=%s\n'      "$SANDBOX"
  printf 'project=%s\n'      "$PROJECT"
  printf 'copy=%s\n'         "$COPY"
  printf 'skill-name=%s\n'   "$SKILL_NAME"
  printf 'record-name=%s\n'  "$RECORD_NAME"
  printf 'watch-record=%s\n' "$WATCH_RECORD"
  printf 'fixture-record=%s\n' "$FIXTURE_RECORD"
  printf 'homes-record=%s\n' "$HOMES_RECORD"
  printf 'stamp=%s\n'        "$STAMP"
  local home
  for home in "${SKILL_HOMES[@]}"; do printf 'skill-home=%s\n' "$home"; done
}

case "$VERB" in
  setup)    cmd_setup ;;
  verify)   cmd_verify ;;
  paths)    cmd_paths ;;
  teardown) cmd_teardown ;;
  *) printf 'usage: %s setup|verify|teardown|paths [--at <dir>] [--skill-home <dir>]...\n' "$(basename "$0")" >&2; exit 2 ;;
esac
