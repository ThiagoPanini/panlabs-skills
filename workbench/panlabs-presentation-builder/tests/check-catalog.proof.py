#!/usr/bin/env python3
"""THE DRIFT BETWEEN THE REGISTER AND THE REFERENCE, PLANTED AND DEMANDED RED.

    workbench/panlabs-presentation-builder/tests/check-catalog.proof.py

`compiler/catalog.py` is the register and `CATALOG.md` is what a model reads
before it writes a deck. Two copies of the same facts is the shape the v1
already paid for: the copy that is read is always the one that aged, and
nothing was red about it. `--check` is the ruler that refuses the drift, and
this file is what stops that ruler from being a green nobody tested.

Every case plants into a COPY of the document in a temp directory and points
`--check` at the copy: the tree being measured is never written to. The four
assertions are ADR 0001's, same as every other proof here -- the plant really
changed the document, `--check` went red, the red NAMED ITS OWN FIX (which is
always `--write`, the one command that repairs it), and `--check` against the
real `CATALOG.md` is green.

AND ONE CASE THAT DEMANDS GREEN, because a check can also be wrong by firing:
the prose AROUND the generated block is a human's to write, and a ruler that
compared the whole file would turn every edit to the explanation into a red
about the register.
"""

import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from proof_driver import Drifted, Proof                                # noqa: E402

SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
REGISTER = os.path.join(SKILL, "compiler", "catalog.py")
DOCUMENT = os.path.join(SKILL, "CATALOG.md")

WRITE = "run `python3 compiler/catalog.py --write`"


def read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return None


REAL = read(DOCUMENT)


def _check(text=None):
    """Run THE DOCUMENTED COMMAND, over a planted copy or over the real file."""
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    argv = [sys.executable, REGISTER, "--check"]
    if text is None:
        done = subprocess.run(argv, capture_output=True, text=True, env=env, cwd=SKILL)
        return done.returncode == 0, (done.stdout + done.stderr).strip()

    with tempfile.TemporaryDirectory(prefix="panlabs-catalog-proof-") as tmp:
        # Named CATALOG.md inside the temp directory, because every message
        # the check writes names the document by its basename -- a copy called
        # anything else would prove a red that talks about a file nobody has.
        planted = os.path.join(tmp, "CATALOG.md")
        with open(planted, "w", encoding="utf-8") as fh:
            fh.write(text)
        done = subprocess.run(argv + [planted],
                              capture_output=True, text=True, env=env, cwd=SKILL)
        return done.returncode == 0, (done.stdout + done.stderr).strip()


def swap(needle, replacement):
    def plant():
        if REAL is None:
            raise Drifted(f"{DOCUMENT} is not readable")
        if needle not in REAL:
            raise Drifted(f"the document no longer contains {needle!r}")
        return REAL.replace(needle, replacement, 1)
    return plant


def cut(expression, what):
    def plant():
        if REAL is None:
            raise Drifted(f"{DOCUMENT} is not readable")
        planted, n = re.subn(expression, "", REAL, count=1)
        if n == 0:
            raise Drifted(f"the document no longer holds {what}")
        return planted
    return plant


def the_prose_is_still_a_humans():
    """A word changed OUTSIDE the block, and the check stays green.

    The generated block is the register's; every line around it is written by
    hand and explains what the block cannot. A ruler that owned the whole file
    would be a ruler that punished the explanation for being edited.
    """
    if REAL is None:
        print(f"  FAIL {'setup':<22} no document to plant in")
        return 1

    planted = REAL.replace("# O catálogo", "# O catálogo de padrões", 1)
    changed = planted != REAL
    ok, said = _check(planted)
    good = ok and changed
    marks = f"[{'+' if changed else '-'}{'+' if ok else '-'}]"
    print(f"  {'ok  ' if good else 'FAIL'} {'prose around it':<22} {marks} "
          "a heading rewritten outside the generated block")
    if not good:
        print(f"       <- {'the plant changed nothing' if not changed else said}")
    return 0 if good else 1


def main():
    if REAL is None:
        return Proof("the register's reference", lambda k: k, None, None, None).refuse(
            "put CATALOG.md back at the skill's root and run `python3 "
            "compiler/catalog.py --write` — with no published reference there "
            "is nothing for this ruler to keep in step"
        )

    proof = Proof(
        title="the reference against the register",
        label=lambda key: key,
        invoke=lambda key, payload: _check(payload),
        planted=lambda payload: payload != REAL,
        control=lambda key: _check(),
        width=22,
    )

    failed = proof.run([
        (
            "budget edited",
            "a ceiling raised in the document and nowhere else",
            swap("até 25 palavras", "até 40 palavras"),
            WRITE,
        ),
        (
            "slot renamed",
            "a slot the register never called that",
            swap("`attribution`", "`author`"),
            WRITE,
        ),
        (
            "row dropped",
            "a slot the register declares, missing from the table",
            cut(r"\| `index` \|[^\n]*\n", "the section-divider's index row"),
            WRITE,
        ),
        (
            "markers gone",
            "the block's own fence taken out",
            swap("<!-- catalog:begin -->", ""),
            "put <!-- catalog:begin --> and <!-- catalog:end --> back",
        ),
    ])

    print()
    print("and the one that demands green:  [planted green]")
    failed += the_prose_is_still_a_humans()
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
