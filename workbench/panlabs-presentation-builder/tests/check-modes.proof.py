#!/usr/bin/env python3
"""EVERY FAMILY OF THE MODES CHECK, PLANTED AGAINST AND DEMANDED RED.

    workbench/panlabs-presentation-builder/tests/check-modes.proof.py

A check only ever seen green is documentation, and `check-modes.py` is one of
the two easiest in this suite to be green about. The skeleton it measures is
audited by the DIALECT alone -- so a generator that painted the wrong pattern,
dropped the plan's message or quietly "fixed up" a stranger into a known name
would build a page, print a green laudo and look exactly like a rehearsal that
worked. The article is audited by nothing at all: it is Markdown, and the
audit's subject is a source, so a generator that stopped writing the speaker
notes would leave a published article missing the half of the deck that was
never on the stage.

THE PLANT IS IN THE COMPILER, NOT IN THE INPUT, and that is what makes this
proof a sibling of `check-extract.proof.py` rather than of
`check-audit.proof.py`. The subject there is a RULER reading a source, so a deck
is mutated; the subject here is what the command WRITES, so what has to be
broken is the writer -- one defect at a time, in a COPY of the whole skill tree
in a temp directory, with `check-modes.py` pointed at that copy through the
`--skill` door it keeps open for exactly this.

THE TREE IS COPIED WHOLE RATHER THAN THE ONE FILE, because the command reads its
siblings: the register, the stage, the icons, the theme and the faces. A lone
generator in a temp directory would answer about a skill that is not there.

ONE DECK, NOT THE CORPUS. Each case runs the check once, and what it needs is a
deck that exercises every family -- a plan with rows, a slide with notes, a
divider, a drawing. `examples/proposal.deck.html` is all four and is the only
corpus member in the unbranded theme, so it is also the cheapest: `base` embeds
no faces. The corpus of three is what `check-modes.py` itself eats when the
suite runs it with no arguments.

TWO CASES SHARE THE `refuses` FAMILY, and neither of them breaks the refusal by
deleting it -- they break it by being LENIENT, which is the shape the defect
really takes. A reader that raised on a stranger pattern would still be refused
one step later by the dialect ruler, with almost the same words; what nothing
downstream catches is a reader that silently substitutes a pattern the plan
never asked for, or reads the message out of whichever column happens to be
first. Both build green, and both are a plan quietly replaced by another one.
"""

import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from proof_driver import Proof, read, swap                        # noqa: E402

SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
CHECK = os.path.join(HERE, "check-modes.py")
COMPILER = os.path.join(SKILL, "compiler")
FIXTURE = os.path.join("examples", "proposal.deck.html")

# Every file a case plants into, read once and kept as text. `swap` refuses a
# needle the file no longer holds, so a generator rewritten out from under this
# proof reports a drifted fixture instead of planting nothing and passing the
# other three assertions by accident.
FILES = ("storyboard.py", "skeleton.py", "article.py")
REAL = {name: read(os.path.join(COMPILER, name)) for name in FILES}


# ── the needles ──────────────────────────────────────────────────────────────

THE_PATTERN = '''        pattern = _coded(said["pattern"])
        if pattern not in pattern_names():
            raise Refused('''

THE_COLUMNS = '''    at = {}
    for column in COLUMNS:
        if column.label not in heading:
            raise Refused('''

THE_MESSAGE = "        if slot is said:"

THE_NOTES = """        if el.tag == NOTES_TAG:
            blocks.extend(notes_of(el))
            continue"""

THE_TAIL = """    lines += references(deck)
    lines.append("")
    return "\\n".join(lines)"""


def planted_in(name, needle, replacement):
    """One substitution in one file of the compiler, as a payload the driver plants."""
    inner = swap(REAL[name], needle, replacement)
    return lambda: (name, inner())


def run(payload):
    """Run the check against a copy of the tree, with `payload` planted in it."""
    with tempfile.TemporaryDirectory(prefix="panlabs-modes-proof-") as into:
        tree = os.path.join(into, "skill")
        shutil.copytree(SKILL, tree, symlinks=True,
                        ignore=shutil.ignore_patterns("__pycache__"))
        if payload is not None:
            name, said = payload
            with open(os.path.join(tree, "compiler", name),
                      "w", encoding="utf-8") as fh:
                fh.write(said)
        done = subprocess.run(
            [sys.executable, CHECK, os.path.join(tree, FIXTURE),
             "--skill", tree],
            capture_output=True, text=True, timeout=600,
            env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"),
        )
    said = (done.stdout + done.stderr).strip()
    # ONLY THE RED LINES COME BACK. The check prints a line per family, green
    # ones included, and a proof that quoted all four under every case would
    # bury the one line the assertion is about.
    reds = [line.strip() for line in said.splitlines()
            if line.strip().startswith("FAIL")]
    return done.returncode == 0, " / ".join(reds) if reds else said


SETTLED = []


def control(_key):
    """The check against the untouched tree, run once and kept.

    THE CONTROL IS CACHED AND ITS NEIGHBOURS ARE NOT, which is the one place
    this proof differs from `check-extract.proof.py`. Every case here copies a
    tree and builds five decks through it; running the control five more times
    would double the layer's cost to answer a question whose answer cannot
    change between two cases.
    """
    if not SETTLED:
        SETTLED.append(run(None))
    return SETTLED[0]


def main():
    missing = [name for name, said in REAL.items() if said is None]
    if missing:
        return Proof(title="modes", label=lambda k: k, invoke=None,
                     planted=None, control=None).refuse(
            f"{', '.join(missing)} is not under compiler/ — there is nothing "
            "to plant into"
        )

    families = [("refuses", None), ("skeleton", None), ("article", None),
                ("deterministic", None)]
    cases = [
        (
            "refuses",
            "a plan whose stranger pattern is quietly swapped for a known one",
            planted_in("storyboard.py", THE_PATTERN,
                       '        pattern = _coded(said["pattern"])\n'
                       "        if pattern not in pattern_names():\n"
                       "            pattern = pattern_names()[0]\n"
                       "        if False:\n"
                       "            raise Refused("),
            "refuse it, and name the fix",
        ),
        (
            "refuses",
            "a table read by whatever column came first when one is missing",
            planted_in("storyboard.py", THE_COLUMNS,
                       "    at = {c.key: (heading.index(c.label)\n"
                       "                  if c.label in heading else 0)\n"
                       "          for c in COLUMNS}\n"
                       "    for column in []:\n"
                       "        if column.label not in heading:\n"
                       "            raise Refused("),
            "refuse it, and name the fix",
        ),
        (
            "skeleton",
            "a rehearsal that stands in for the plan's own message too",
            planted_in("skeleton.py", THE_MESSAGE,
                       "        if slot is said and not slot.role:"),
            "the message is the one line of a plan that is not a placeholder",
        ),
        (
            "article",
            "an article written without the speaker notes",
            planted_in("article.py", THE_NOTES,
                       "        if el.tag == NOTES_TAG:\n"
                       "            blocks.extend([])\n"
                       "            continue"),
            "the notes are the prose of an article",
        ),
        (
            "deterministic",
            "a generator that writes a different article every time it runs",
            planted_in("article.py", THE_TAIL,
                       "    lines += references(deck)\n"
                       '    lines.append(str(__import__("time").time_ns()))\n'
                       '    return "\\n".join(lines)'),
            "take the clock out of the article generator",
        ),
    ]

    proof = Proof(
        title="modes",
        label=lambda key: key,
        invoke=lambda key, payload: run(payload),
        planted=lambda payload: payload[1] != REAL[payload[0]],
        control=control,
        width=15,
    )
    failed = proof.run(cases)
    failed += proof.coverage(families, cases)
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
