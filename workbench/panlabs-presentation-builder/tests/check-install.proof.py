#!/usr/bin/env python3
"""Plant one defect per install family and demand RED -- the four assertions.

    python3 check-install.proof.py

An installer is the part of a skill people run once and never look at again,
which is exactly the profile of a check nobody has ever seen fail. Every
family of `check-install.py` is planted against here, on the standard
`proof_driver.py` states in full: the plant really changed something, the
family goes red for it, the red names its own fix, and the same family is
green against a clean installation.

NOTHING TOUCHES THE MACHINE. Every plant is built inside this process's own
temporary directory, from a COPY of the skill and a scratch `HOME` -- the real
`~/.claude/skills/` is never read and never written. This repository has
already paid for a review agent that planted its defect in the real worktree,
and an installer is the one subject where that mistake repoints the harness of
every session running beside this one.
"""
import hashlib
import importlib.util
import os
import pathlib
import shutil
import sys
import tempfile

# Nothing this suite runs may leave bytecode in the tree it measures.
sys.dont_write_bytecode = True

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from proof_driver import Drifted, Proof                           # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "check_install", HERE / "check-install.py")
check = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check)

# One staging area for the whole run, cleaned up on the way out. A
# `TemporaryDirectory` per plant would be collected while the driver is still
# reading the state it describes.
BENCH = tempfile.TemporaryDirectory(prefix="panlabs-install-proof.")
BASE = pathlib.Path(BENCH.name)
ROOT = check.stage(BASE / "tree")
HOME = BASE / "home"
HOME.mkdir()
_r = check.install(ROOT, HOME)
CLEAN = _r.returncode == 0


def _seq():
    """A fresh directory name, so plants never write over each other."""
    _seq.n += 1
    return BASE / f"plant{_seq.n}"


_seq.n = 0


def fingerprint(root, home):
    """What a plant is allowed to have changed: the links, and the installer.

    The driver's first assertion is that the plant CHANGED something -- a
    fixture that silently stopped applying would otherwise pass the other
    three by accident, which is the way a proof rots without anyone noticing.
    """
    parts = []
    for p in check.links(home):
        text = os.readlink(p) if p.is_symlink() else (
            "<real dir>" if p.exists() else "<gone>")
        end = str(p.resolve()) if p.exists() else "<broken>"
        parts.append(f"{p.name}|{text}|{end}")
    sh = pathlib.Path(root) / "tools/install.sh"
    parts.append(hashlib.sha256(sh.read_bytes()).hexdigest())
    return tuple(sorted(parts))


BASELINE = fingerprint(ROOT, HOME) if CLEAN else None


def _home_copy():
    """A copy of the clean scratch HOME, links kept as links."""
    dst = _seq() / "home"
    shutil.copytree(HOME, dst, symlinks=True)
    return dst


# --------------------------------------------------------------------------
# the plants -- one per family
# --------------------------------------------------------------------------
def plant_one_link_gone():
    """Only one of the two paths carries the skill."""
    home = _home_copy()
    check.link(home, ".agents/skills").unlink()
    return dict(root=ROOT, home=home)


def plant_absolute_pointer():
    """Both links carry an absolute path -- two places to repoint, not one."""
    home = _home_copy()
    p = check.link(home, ".claude/skills")
    p.unlink()
    p.symlink_to(ROOT)
    return dict(root=ROOT, home=home)


def plant_into_a_worktree():
    """The link this whole file exists for: one that dangles later, quietly."""
    home = _home_copy()
    fake = _seq() / ".claude/worktrees/w/skills" / check.NAME
    fake.mkdir(parents=True)
    (fake / "SKILL.md").write_text("---\nname: x\n---\n", encoding="utf-8")
    p = check.link(home, ".agents/skills")
    p.unlink()
    p.symlink_to(fake)
    return dict(root=ROOT, home=home)


def plant_engine_gone():
    """A tree whose front door reads perfectly and whose engine is not there.

    This is the gap between "the link resolves" and "the skill runs", and the
    reason family 4 runs the documented command instead of reading `SKILL.md`
    through the link and calling it installed.
    """
    stump = _seq() / "stump"
    shutil.copytree(ROOT, stump,
                    ignore=shutil.ignore_patterns("__pycache__"))
    shutil.rmtree(stump / "engine")
    home = _home_copy()
    for which in check.HOMES:
        p = check.link(home, which)
        p.unlink()
        p.symlink_to(stump)
    return dict(root=ROOT, home=home)


GUARD = '    exit 1\n  fi\n'


def plant_guard_removed():
    """The installer degrades instead of refusing, like the sibling does.

    Not a synthetic mutation: this is precisely the sibling installer's own
    behaviour, and the departure is documented in this one's header. Planting
    it here is what makes that paragraph a rule rather than a claim.
    """
    root = _seq() / "tree"
    shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns("__pycache__"))
    sh = root / "tools/install.sh"
    text = sh.read_text(encoding="utf-8")
    if text.count(GUARD) != 1:
        raise Drifted(
            "the worktree refusal is no longer a lone `exit 1` before its "
            "`fi` — re-anchor GUARD on whatever shape it has now")
    sh.write_text(text.replace(GUARD, '  fi\n', 1), encoding="utf-8")
    return dict(root=root, home=HOME)


CASES = [
    ("both-links", "one of the two paths does not carry the skill",
     plant_one_link_gone, "run `bash tools/install.sh`"),
    ("link-shape", "the pointing side carries an absolute path too",
     plant_absolute_pointer, "link relative"),
    ("not-a-worktree", "a link resolving into .claude/worktrees/",
     plant_into_a_worktree, "reinstall from the main checkout"),
    ("runs-from-both", "a linked tree whose engine/ is not there",
     plant_engine_gone, "reinstall from a checkout that carries engine/"),
    ("refuses-orphan", "the worktree refusal removed from the installer",
     plant_guard_removed, "restore the refusal"),
]


def _invoke(key, payload):
    return check.BY_NAME[key](scratch=str(BASE), **payload)


def _control(key):
    if not CLEAN:
        return False, (f"the installer would not install into a clean scratch "
                       f"HOME, so no family here has a control: "
                       f"{_r.stdout.strip() or _r.stderr.strip()}")
    return check.BY_NAME[key](root=ROOT, home=HOME, scratch=str(BASE))


PROOF = Proof(
    title="install.proof",
    label=lambda key: key,
    invoke=_invoke,
    planted=lambda payload: fingerprint(payload["root"],
                                        payload["home"]) != BASELINE,
    control=_control,
)


def main():
    if BASELINE is None:
        return PROOF.refuse(
            f"the installer refused a clean scratch HOME, so nothing can be "
            f"planted against it: "
            f"{_r.stdout.strip().splitlines()[-1] if _r.stdout.strip() else _r.stderr.strip()}")
    failed = PROOF.run(CASES)

    # A family nobody plants against is a family nobody has ever seen fail.
    unplanted = [n for n, _ in check.FAMILIES
                 if not any(c[0] == n for c in CASES)]
    print(f"  {'FAIL' if unplanted else 'ok  '} {'coverage':<19} "
          f"{len(CASES)} planted defects over all {len(check.FAMILIES)} "
          f"families" if not unplanted else
          f"  FAIL {'coverage':<19} never planted against: "
          f"{', '.join(unplanted)} -- add a case, or drop the family")
    return failed + len(unplanted)


if __name__ == "__main__":
    try:
        sys.exit(1 if main() else 0)
    finally:
        BENCH.cleanup()
