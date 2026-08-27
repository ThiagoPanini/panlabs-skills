#!/usr/bin/env bash
# THE BLIND RUN'S SANDBOX -- a caller project that is not this repository, and
# every door to the skill opening onto the copy inside it.
#
#   blind-run.sh setup      build the sandbox and print the prompt to hand over
#   blind-run.sh verify     audit the isolation; one line per breach
#   blind-run.sh teardown   put the skill homes back, remove the sandbox
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
# it, and the skill ships exactly one `.js` — the vendored ELK bundle — in an
# otherwise `.cjs` tree, with no `package.json` of its own. Without a pin inside
# the sandbox, whatever the machine happens to have left above it decides how
# the engine is read: the first run under this harness landed under a stray
# `/tmp/package.json` from a draw.io extraction, `"type": "module"`, and the
# engine died on `ELK is not a constructor`. The fixture pins the scope so the
# run is reproducible, `verify` fails when the deciding file lives outside the
# sandbox, and the skill's own defect is #133 — pinned here, not hidden.
#
# ⚠️ TEARDOWN RESTORES FROM A RECORD BESIDE THE SKILL HOME, NOT FROM THE
# SANDBOX. The sandbox lives in the system temp and a machine may sweep it; a
# restore that read from there would be a restore that stops working exactly
# when it is needed. The record is `.panlabs-aws-diagrams.blind-run-parked`
# inside each skill home -- a dot-prefixed FILE, so nothing that discovers
# skills by scanning directories ever sees it as one.
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
[ -z "$REPO_NAME" ] || [ "$REPO_NAME" = "." ] && REPO_NAME="$(basename "$REPO")"
PROJECT_NAME="labmove-platform"
RECORD_NAME=".$SKILL_NAME.blind-run-parked"
PARKED_SUFFIX="$SKILL_NAME.blind-run-parked"

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
[ "${#SKILL_HOMES[@]}" -eq 0 ] && SKILL_HOMES=("$HOME/.claude/skills" "$HOME/.agents/skills")

PROJECT="$SANDBOX/$PROJECT_NAME"
COPY="$PROJECT/.claude/skills/$SKILL_NAME"

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

park_home() { # park_home <home>
  local home="$1" entry record parked created=no
  entry="$home/$SKILL_NAME"
  record="$home/$RECORD_NAME"

  [ -e "$record" ] && die "$record already exists — an earlier blind run never tore down. Run teardown first."

  if [ ! -d "$home" ]; then
    mkdir -p "$home" || die "could not create the skill home $home"
    created=yes
  fi

  { printf 'home-created=%s\n' "$created"; } > "$record"

  if [ -L "$entry" ]; then
    # `readlink` and not `readlink -f`: the ~/.claude entry carries a RELATIVE
    # text (`../../.agents/skills/<name>`), and restoring the resolved path
    # instead would silently rewrite the machine's install into a shape its own
    # installer never wrote.
    printf 'kind=symlink\ntarget=%s\n' "$(readlink "$entry")" >> "$record"
    ln -sfn "$COPY" "$entry" || die "could not repoint $entry"
    ok "$entry → the copy (was a link to $(read_record "$record" target))"
  elif [ -e "$entry" ]; then
    parked="$(dirname "$home")/$PARKED_SUFFIX"
    [ -e "$parked" ] && die "$parked is occupied — clear it before running"
    mv "$entry" "$parked" || die "could not park $entry"
    printf 'kind=moved\ntarget=%s\n' "$parked" >> "$record"
    ln -s "$COPY" "$entry" || die "could not link $entry"
    ok "$entry → the copy (a real directory was parked at $parked)"
  else
    printf 'kind=absent\n' >> "$record"
    ln -s "$COPY" "$entry" || die "could not link $entry"
    ok "$entry → the copy (nothing was installed here)"
  fi
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

  # Every reason to refuse is collected BEFORE the first byte is written. A
  # setup that dies halfway leaves a sandbox the next setup then refuses to
  # overwrite — one failure turning into two.
  local home
  for home in "${SKILL_HOMES[@]}"; do
    [ -e "$home/$RECORD_NAME" ] && die "$home/$RECORD_NAME exists — an earlier blind run never tore down. Run teardown first."
  done

  local parent breach staging untracked
  parent="$(dirname "$SANDBOX")"
  mkdir -p "$parent" || die "could not create $parent"
  breach="$(breaches_above "$parent")"
  [ -n "$breach" ] && die "refusing to build the sandbox under $parent — a blind agent could climb into:
$(printf '%s\n' "$breach" | sed 's/^/      /')"

  printf '\n  BLIND RUN · setup\n\n'

  # ── the caller project ──────────────────────────────────────────────────────
  mkdir -p "$PROJECT" || die "could not create $PROJECT"
  cp -R "$HERE/project/." "$PROJECT/" || die "could not materialise the caller project"
  git -c init.defaultBranch=main init -q "$PROJECT" || die "could not init the caller project"
  git -C "$PROJECT" config user.name  'LabMove Engenharia'
  git -C "$PROJECT" config user.email 'eng@labmove.example'
  git -C "$PROJECT" add -A >/dev/null || die "could not stage the caller project"
  git -C "$PROJECT" commit -q -m 'A plataforma como ela está hoje' || die "could not commit the caller project"
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
  mkdir -p "$(dirname "$COPY")"
  mv "$staging/skills/$SKILL_NAME" "$COPY" || die "could not place the copy"
  rm -rf "$staging"
  ok "the skill is copied — not linked — into $COPY"

  untracked="$(git -C "$SKILL_SOURCE" ls-files --others --exclude-standard | wc -l)"
  [ "$untracked" -gt 0 ] && warn "$untracked untracked file(s) under the skill are NOT in the copy — git decides what ships"

  # ── every door on the machine ───────────────────────────────────────────────
  for home in "${SKILL_HOMES[@]}"; do park_home "$home"; done

  # ── what the blind agent is handed ──────────────────────────────────────────
  cp "$HERE/brief.md" "$SANDBOX/brief.txt"
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
    # ⚠️ The options come BEFORE `-e`, and there is no `--`: `--` ends option
    # parsing, so `--exclude-dir` written after it is read as a FILE to search.
    # That mistake made this sweep read the installed skill and report the
    # project for a string only the skill carries.
    local named
    named="$(grep -rIl --exclude-dir=.git --exclude-dir=.claude -e "$REPO_NAME" "$project_real" 2>/dev/null)"
    if [ -n "$named" ]; then
      bad "the caller project names $REPO_NAME in: $(printf '%s' "$named" | tr '\n' ' ')"
    else
      ok "nothing in the caller project names $REPO_NAME"
    fi

    # 3 . and it does not dictate the very path the run is measuring
    local dictates
    dictates="$(grep -rIl --exclude-dir=.git --exclude-dir=.claude -e 'docs/architecture/diagrams' "$project_real" 2>/dev/null)"
    if [ -n "$dictates" ]; then
      bad "the caller project names docs/architecture/diagrams in: $(printf '%s' "$dictates" | tr '\n' ' ') — the criterion would pass by construction"
    else
      ok "the caller project never names docs/architecture/diagrams — the skill's convention is what has to produce it"
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
    case "$target" in
      "$sandbox_real"|"$sandbox_real"/*) ;;
      *) bad "a symlink escapes the sandbox: $link → ${target:-<broken>}"; escapes=1 ;;
    esac
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
  if [ -d "$COPY" ]; then
    local js dir deciding scopes="" outside=0
    while IFS= read -r js; do
      deciding=""
      while IFS= read -r dir; do
        [ -f "$dir/package.json" ] && { deciding="$dir/package.json"; break; }
      done < <(ancestors "$(dirname "$js")")
      [ -n "$deciding" ] || continue
      case "$scopes" in *"|$deciding|"*) continue ;; esac
      scopes="$scopes|$deciding|"
      local kind
      kind="$(sed -n 's/.*"type"[[:space:]]*:[[:space:]]*"\([a-z]*\)".*/\1/p' "$deciding" | head -1)"
      case "$deciding" in
        "$sandbox_real"/*) ok "the module scope of $(basename "$js") is the sandbox's own: $deciding (${kind:-commonjs})" ;;
        *) bad "the module scope of $(basename "$js") comes from OUTSIDE the sandbox: $deciding (${kind:-commonjs}) — the machine decides how the skill's .js is read, not the fixture"; outside=1 ;;
      esac
    done < <(find "$COPY" -type f -name '*.js' 2>/dev/null)
    [ -z "$scopes" ] && [ "$outside" -eq 0 ] && ok "nothing above the copy declares a module type — its .js reads as CommonJS"
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
      case "$resolved" in
        "$sandbox_real"|"$sandbox_real"/*) ok "$entry resolves inside the sandbox" ;;
        *) bad "$entry resolves to ${resolved:-<broken>} — outside the sandbox" ;;
      esac
    else
      bad "$entry does not exist — the skill is reachable from nowhere here"
    fi
  done

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
  for home in "${SKILL_HOMES[@]}"; do restore_home "$home" || failed=1; done

  if [ -e "$SANDBOX" ]; then
    rm -rf "$SANDBOX" && ok "the sandbox at $SANDBOX is gone" || { printf '  ✗ could not remove %s\n' "$SANDBOX"; failed=1; }
  else
    say "no sandbox at $SANDBOX"
  fi

  printf '\n'
  [ "$failed" -eq 0 ] && { say "the machine is back where it was."; printf '\n'; return 0; }
  printf '  ✗ the teardown did not close cleanly — read the lines above.\n\n'
  return 1
}

case "$VERB" in
  setup)    cmd_setup ;;
  verify)   cmd_verify ;;
  teardown) cmd_teardown ;;
  *) printf 'usage: %s setup|verify|teardown [--at <dir>] [--skill-home <dir>]...\n' "$(basename "$0")" >&2; exit 2 ;;
esac
