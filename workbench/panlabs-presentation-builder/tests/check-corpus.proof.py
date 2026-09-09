#!/usr/bin/env python3
"""THE CORPUS CHECK, PLANTED AGAINST AND DEMANDED RED.

    workbench/panlabs-presentation-builder/tests/check-corpus.proof.py

A check only ever seen green is documentation, and this one is the easiest in
the suite to be green about nothing: hand it an empty directory, or a corpus
that lost a pattern, and a check written carelessly says "0 of 18" and exits 0.

EVERY CASE PLANTS INTO A COPY, NEVER INTO `examples/`. The check takes a
directory, so a case is "copy both decks into a temp directory, mutate one of
them, point the check at the copy" -- the real tree is read and never written,
the same rule check-audit.proof.py keeps one floor up.

THE FOURTH ASSERTION IS THE REAL CORPUS. Three of these cases would pass over a
check that always went red; the green control is what says the tree the skill
actually ships covers what it promises to cover.
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from proof_driver import Drifted, Proof                               # noqa: E402

SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
CHECK = os.path.join(HERE, "check-corpus.py")
EXAMPLES = os.path.join(SKILL, "examples")


def _run(examples):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    done = subprocess.run([sys.executable, CHECK, examples],
                          capture_output=True, text=True, env=env, cwd=SKILL)
    return done.returncode == 0, (done.stdout + done.stderr).strip()


def _copy(plant):
    """A copy of `examples/`, mutated, in a directory the caller deletes."""
    tmp = tempfile.mkdtemp(prefix="panlabs-corpus-proof-")
    shutil.copytree(EXAMPLES, os.path.join(tmp, "examples"))
    plant(os.path.join(tmp, "examples"))
    return tmp


def _drop_pattern(pattern):
    """Take every slide of one pattern out of whichever deck carries them."""
    def plant(examples):
        gone = 0
        for name in sorted(os.listdir(examples)):
            if not name.endswith(".deck.html"):
                continue
            path = os.path.join(examples, name)
            with open(path, encoding="utf-8") as fh:
                said = fh.read()
            cut, n = re.subn(
                r'\n  <section pattern="' + pattern + r'"[^>]*>.*?\n  </section>\n',
                "\n", said, flags=re.S)
            if n:
                gone += n
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(cut)
        if not gone:
            raise Drifted(f"no slide in the corpus takes the pattern {pattern!r}")
    return plant


def _drop_form(form):
    """Redraw the one chart of a form as a form the corpus already has."""
    def plant(examples):
        gone = 0
        for name in sorted(os.listdir(examples)):
            if not name.endswith(".deck.html"):
                continue
            path = os.path.join(examples, name)
            with open(path, encoding="utf-8") as fh:
                said = fh.read()
            cut, n = re.subn(
                r'\n  <section pattern="chart" type="' + form + r'"[^>]*>.*?\n  </section>\n',
                "\n", said, flags=re.S)
            if n:
                gone += n
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(cut)
        if not gone:
            raise Drifted(f"no chart in the corpus is drawn as {form!r}")
    return plant


def _empty(examples):
    for name in os.listdir(examples):
        os.remove(os.path.join(examples, name))


def _only_prose(examples):
    """The pattern named in a comment instead of taken by a slide.

    THE DEFECT A GREP WOULD MISS. `pattern="pull-quote"` written inside an HTML
    comment is not a slide taking that shape, and a check counting text rather
    than parsing would call this corpus complete while the room never sees the
    pattern.
    """
    dropped = _drop_pattern("pull-quote")
    dropped(examples)
    path = os.path.join(examples, sorted(os.listdir(examples))[0])
    with open(path, encoding="utf-8") as fh:
        said = fh.read()
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(said.replace("<deck ", '<!-- pattern="pull-quote" -->\n<deck ', 1))


CASES = [
    (
        "a pattern gone",
        "the corpus stops carrying one of the eighteen",
        _drop_pattern("pull-quote"),
        "add a slide in pull-quote",
    ),
    (
        "a chart form gone",
        "five of the six forms drawn, and the sixth nowhere",
        _drop_form("sparkline"),
        "add a chart drawn as sparkline",
    ),
    (
        "the pattern only in prose",
        "the name written in a comment, and no slide taking the shape",
        _only_prose,
        "add a slide in pull-quote",
    ),
    (
        "no corpus at all",
        "an examples/ with nothing in it, which is the easiest green to fake",
        _empty,
        "add a slide in",
    ),
]


def main():
    def invoke(_key, tmp):
        try:
            return _run(os.path.join(tmp, "examples"))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    settled = []

    def control(_key):
        if not settled:
            settled.append(_run(EXAMPLES))
        return settled[0]

    proof = Proof(
        title="the corpus covers the register (#219)",
        label=lambda key: key,
        invoke=invoke,
        # THE PLANT IS ON DISK, NOT IN A STRING, so "did it really change
        # anything" is asked of the FILES: a plant helper that matched nothing
        # raises `Drifted` before it gets here, and a directory whose decks are
        # byte-identical to the real ones has planted nothing at all.
        planted=lambda tmp: _digest(os.path.join(tmp, "examples")) != REAL_DIGEST,
        control=control,
        width=24,
    )
    return proof.run([(key, what, lambda p=plant: _copy(p), says)
                      for key, what, plant, says in CASES])


def _digest(examples):
    out = []
    for name in sorted(os.listdir(examples)):
        with open(os.path.join(examples, name), "rb") as fh:
            out.append((name, fh.read()))
    return out


REAL_DIGEST = _digest(EXAMPLES)


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
