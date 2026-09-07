#!/usr/bin/env python3
"""THE AUDIT'S RULERS, PLANTED AGAINST AND DEMANDED RED.

    workbench/panlabs-presentation-builder/tests/check-audit.proof.py

A check only ever seen green is documentation. Every ruler the compiler runs
gets a case here that breaks the source in exactly the way the ruler exists to
catch, and the case passes only when all four of ADR 0001's assertions hold --
the plant really changed the source, the build went red, the red NAMED ITS OWN
FIX, and the same build against the untouched example is green.

The asserted phrase is always the FIX and never the diagnosis. "unknown class"
would pass an assertion on a message that tells the reader nothing to do;
`drop the class "highlight"` cannot.

IT PLANTS IN A TEMP DIRECTORY, NEVER IN THE SKILL. The build command takes a
path, so the mutated source has to reach disk somewhere -- somewhere is a
`mktemp` directory that goes away with the process. The tree this measures is
never written to, and the subprocess is told not to leave bytecode in it
either: a ruler that modified its subject would be measuring itself.
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
BUILD = os.path.join(SKILL, "compiler", "build.py")
EXAMPLE = os.path.join(SKILL, "examples", "statement.deck.html")


def read_example():
    try:
        with open(EXAMPLE, encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return None


REAL = read_example()


def build(text):
    """Run THE DOCUMENTED COMMAND over a source, and report what it said.

    Not `import build` -- the thing being proved is the command a human and an
    agent are told to run. A proof that reached past it into the library would
    be green about a compiler nobody invokes.
    """
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    with tempfile.TemporaryDirectory(prefix="panlabs-audit-proof-") as tmp:
        src = os.path.join(tmp, "planted.deck.html")
        with open(src, "w", encoding="utf-8") as fh:
            fh.write(text)
        done = subprocess.run(
            [sys.executable, BUILD, src, os.path.join(tmp, "out.html")],
            capture_output=True, text=True, env=env, cwd=SKILL,
        )
        return done.returncode == 0, (done.stdout + done.stderr).strip()


def swap(needle, replacement):
    """Plant by substitution, and refuse to plant nothing."""
    def plant():
        if REAL is None:
            raise Drifted(f"{EXAMPLE} is not readable")
        if needle not in REAL:
            raise Drifted(f"the example no longer contains {needle!r}")
        return REAL.replace(needle, replacement, 1)
    return plant


def cut(expression, what):
    """Plant by deletion, and refuse to plant nothing."""
    def plant():
        if REAL is None:
            raise Drifted(f"{EXAMPLE} is not readable")
        planted, n = re.subn(expression, "", REAL, count=1, flags=re.S)
        if n == 0:
            raise Drifted(f"the example no longer holds {what}")
        return planted
    return plant


def main():
    proof = Proof(
        title="the vocabulary ruler",
        label=lambda key: key,
        invoke=lambda key, payload: build(payload),
        planted=lambda payload: payload != REAL,
        control=lambda key: build(REAL) if REAL is not None else (False, "no example"),
        width=17,
    )

    if REAL is None:
        return proof.refuse(
            f"put a source back under {os.path.relpath(EXAMPLE, SKILL)} — with "
            "no real example there is no control, and a proof with no control "
            "measures its own author"
        )

    return proof.run([
        (
            "foreign class",
            "a class the catalog never declared",
            swap('class="statement"', 'class="highlight"'),
            'drop the class "highlight"',
        ),
        (
            "unknown pattern",
            "a pattern the catalog never declared",
            swap('pattern="full-bleed-statement"', 'pattern="mega-cover"'),
            'replace the pattern "mega-cover"',
        ),
        (
            "missing slot",
            "the pattern's required slot taken away",
            cut(r'<p class="statement">.*?</p>', "the statement slot"),
            'add the missing <p class="statement">',
        ),
        (
            "smuggled geometry",
            "a size typed into the source as an attribute",
            swap("<strong>", '<strong style="font-size:9px">'),
            "drop style= from the <strong>",
        ),
    ])


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
