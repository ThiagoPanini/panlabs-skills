#!/usr/bin/env python3
"""THE INSTALLATION, MEASURED. Five families.

    python3 check-install.py

`tools/install.sh` is the only part of this skill whose failure lands on a
machine instead of in a file, and the failure it exists to prevent is the
quietest one in the house: a link into `.claude/worktrees/` works today and is
dangling tomorrow, because the session that owned the worktree was deleted.
Nothing announces that. The skill just stops being in the harness.

  1  both-links       both paths the house looks in carry the skill, and both
                      resolve to the same root
  2  link-shape       `~/.agents/…` carries the absolute path and `~/.claude/…`
                      carries the RELATIVE text pointing at it. One side
                      carries, the other points -- and two absolute links are
                      two places to repoint on the day the repo moves
  3  not-a-worktree   neither link resolves into `.claude/worktrees/`
  4  runs-from-both   the DOCUMENTED command runs from each installed path and
                      produces a page carrying its own fonts. Reading
                      `SKILL.md` through the link proves the link resolves; it
                      does not prove the skill runs, and a link to a tree
                      missing `engine/` reads its front door perfectly
  5  refuses-orphan   run from a worktree whose main checkout cannot be found,
                      the installer writes NOTHING and exits non-zero. This is
                      the one family whose subject is the installer's own
                      judgement rather than the state it leaves behind

EVERYTHING IS HERMETIC, and it has to be. `HOME` is a scratch directory, so
the machine's real `~/.claude/skills/` is never read and never written -- with
parallel sessions the doctrine here, a check that repointed the live skill
homes would hand every other session a different skill for as long as it ran.
And the tree being installed is a COPY, staged outside any worktree path, so
what the families measure is this branch's skill rather than whatever the main
checkout happens to hold.
"""
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

# Nothing this suite runs may leave bytecode in the tree it measures.
sys.dont_write_bytecode = True

HERE = pathlib.Path(__file__).resolve().parent
SKILL = (HERE / "../../../skills/panlabs-presentation-builder").resolve()
NAME = SKILL.name

HOMES = (".claude/skills", ".agents/skills")
RELATIVE = f"../../.agents/skills/{NAME}"
WORKTREE_MARK = "/.claude/worktrees/"


# --------------------------------------------------------------------------
# staging -- a copy of the skill, and a scratch HOME to install it into
# --------------------------------------------------------------------------
def stage(dst, under_worktree=False):
    """A hermetic copy of the skill tree at `dst`, or under a fake worktree.

    `__pycache__` is skipped rather than copied: the suite's own rule is that
    a ruler leaves no trace on its subject, and carrying the subject's
    bytecode into the copy would make the copy differ from the tree.
    """
    root = (pathlib.Path(dst) / ".claude/worktrees/w/skills" / NAME
            if under_worktree else pathlib.Path(dst) / NAME)
    root.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SKILL, root,
                    ignore=shutil.ignore_patterns("__pycache__"))
    return root


def install(root, home, *args):
    """Run the installer with `HOME` pointed at a scratch directory."""
    env = dict(os.environ, HOME=str(home), PYTHONDONTWRITEBYTECODE="1")
    return subprocess.run(["bash", str(pathlib.Path(root) / "tools/install.sh"),
                           *args],
                          capture_output=True, text=True, env=env, timeout=120)


def link(home, which):
    return pathlib.Path(home) / which / NAME


def links(home):
    return [link(home, w) for w in HOMES]


# --------------------------------------------------------------------------
# the five families, each over one already-installed scratch HOME
# --------------------------------------------------------------------------
def check_both_links(home=None, **_):
    missing = [str(p) for p in links(home) if not p.is_symlink()]
    if missing:
        return False, (f"not a link (or not there): {', '.join(missing)} -- "
                       f"run `bash tools/install.sh` and read what it refused")
    seen = {str(p.resolve()) for p in links(home)}
    if len(seen) != 1:
        return False, (f"the two links resolve to different roots: "
                       f"{', '.join(sorted(seen))} -- repoint them with "
                       f"`bash tools/install.sh`, which writes both from one "
                       f"target")
    return True, f"both paths carry the skill, and both resolve to {seen.pop()}"


def check_link_shape(home=None, **_):
    carrier, pointer = link(home, ".agents/skills"), link(home, ".claude/skills")
    if not (carrier.is_symlink() and pointer.is_symlink()):
        return False, ("one of the two links is missing, so their shape "
                       "cannot be read -- run `bash tools/install.sh`")
    text = os.readlink(pointer)
    if text != RELATIVE:
        return False, (f"{pointer} carries {text!r}, not {RELATIVE!r} -- one "
                       f"side carries and the other points, so make the "
                       f"`.claude` link relative")
    if not os.readlink(carrier).startswith("/"):
        return False, (f"{carrier} carries a relative path -- it is the side "
                       f"that CARRIES, so give it the absolute path to the "
                       f"repository")
    return True, "one side carries the absolute path, the other points at it"


def check_not_a_worktree(home=None, **_):
    caught = [f"{p} → {p.resolve()}" for p in links(home)
              if p.is_symlink() and WORKTREE_MARK in str(p.resolve())]
    if caught:
        return False, (f"link(s) into a worktree: {'; '.join(caught)} -- a "
                       f"worktree is deleted with the session that made it "
                       f"and the skill then vanishes with no warning. "
                       f"Reinstall from the main checkout")
    return True, "neither link resolves into a worktree"


def check_runs_from_both(home=None, scratch=None, **_):
    out_dir = pathlib.Path(scratch or tempfile.mkdtemp())
    for i, p in enumerate(links(home)):
        if not p.exists():
            return False, (f"{p} is not there, so nothing can be run from it "
                           f"-- run `bash tools/install.sh`")
        out = out_dir / f"from-{i}.html"
        r = subprocess.run(
            [sys.executable, str(p / "engine/build.py"),
             str(p / "examples/argument.json"), str(out)],
            capture_output=True, text=True,
            env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"), timeout=120)
        if r.returncode != 0:
            why = (r.stdout + r.stderr).strip().splitlines()
            return False, (f"the documented command does not run from {p}: "
                           f"{why[-1] if why else 'no output'} -- the link "
                           f"resolves and the skill does not work through it. "
                           f"Reinstall from a checkout that carries engine/ "
                           f"and examples/")
        if "data:font/woff2" not in out.read_text(encoding="utf-8"):
            return False, (f"built from {p}, but the page carries no embedded "
                           f"font -- it would need the network to look right. "
                           f"Check that assets/fonts/ came through the link")
    return True, (f"the documented command runs from both paths, and both "
                  f"pages carry their own fonts")


def check_refuses_orphan(root=None, **_):
    """The installer's judgement, not the state it leaves.

    Staged under a fake `.claude/worktrees/` with no repository above it, the
    main checkout is unresolvable. The only two answers are to point at the
    worktree anyway -- the exact link family 3 forbids, arriving later and
    silently -- or to refuse. This asserts it refuses, and that it wrote
    nothing on the way to refusing.
    """
    with tempfile.TemporaryDirectory() as tmp:
        orphan = stage(tmp, under_worktree=True)
        # The installer being measured is the one under test, so the staged
        # copy is overwritten with it: the plant in the proof edits `root`,
        # and without this the fake worktree would carry a pristine installer
        # and the plant would measure nothing.
        if root is not None:
            shutil.copy2(pathlib.Path(root) / "tools/install.sh",
                         orphan / "tools/install.sh")
        home = pathlib.Path(tmp) / "home"
        home.mkdir()
        r = install(orphan, home)
        if r.returncode == 0:
            return False, ("the installer accepted a worktree whose main "
                           "checkout it could not find -- restore the refusal "
                           "in tools/install.sh: write nothing and exit "
                           "non-zero, because the link it would write instead "
                           "is the one that dangles with nothing saying so")
        wrote = [str(p) for p in links(home) if p.is_symlink() or p.exists()]
        if wrote:
            return False, (f"the installer refused but still wrote "
                           f"{', '.join(wrote)} -- move the refusal above the "
                           f"first write")
    return True, ("a worktree with no reachable main checkout is refused, "
                  "with nothing written")


FAMILIES = [
    ("both-links", check_both_links),
    ("link-shape", check_link_shape),
    ("not-a-worktree", check_not_a_worktree),
    ("runs-from-both", check_runs_from_both),
    ("refuses-orphan", check_refuses_orphan),
]

BY_NAME = dict(FAMILIES)


def run(quiet=False, **over):
    bad = 0
    for name, fn in FAMILIES:
        try:
            ok, msg = fn(**over)
        except Exception as e:                                  # noqa: BLE001
            ok, msg = False, f"{type(e).__name__}: {e}"
        bad += not ok
        if not quiet:
            print(f"  {'ok  ' if ok else 'FAIL'} {name:<19} {msg}")
    return bad


def main():
    print("install:")
    if not (SKILL / "tools/install.sh").exists():
        print("  FAIL installer          tools/install.sh is not there -- every "
              "family below measures what it does, and their verdicts are "
              "unavailable, not false")
        return 1
    with tempfile.TemporaryDirectory(prefix="panlabs-install-check.") as tmp:
        root = stage(pathlib.Path(tmp) / "tree")
        home = pathlib.Path(tmp) / "home"
        home.mkdir()
        r = install(root, home)
        if r.returncode != 0:
            print(f"  FAIL installer          it refused to install into a "
                  f"clean scratch HOME: {r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr.strip()}")
            return 1
        return run(root=root, home=home, scratch=tmp)


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
