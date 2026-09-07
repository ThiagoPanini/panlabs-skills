#!/usr/bin/env python3
"""EVERY CHECK THE COMPILER MAKES, PLANTED AGAINST AND DEMANDED RED.

    workbench/panlabs-presentation-builder/tests/check-audit.proof.py

A check only ever seen green is documentation. The compiler says no in two
different registers, and both are here:

  the audit's rulers    read a well-formed source and report every fix at
                        once, in the report printed on every build
  the compiler's        stop before there is anything to audit -- no deck in
  refusals              the file, a header field missing, a theme the skill
                        does not carry

A case passes only when all four of ADR 0001's assertions hold: the plant
really changed the source, the build went red, the red NAMED ITS OWN FIX, and
the same build against the untouched example is green.

The asserted phrase is always the FIX and never the diagnosis. "unknown
class" would pass an assertion on a message that tells the reader nothing to
do; `drop the class "highlight"` cannot.

AND ONE CASE THAT DEMANDS GREEN, at the bottom, because a check can also be
wrong by firing. `fill()` used to hunt for leftover `{{NAME}}` markers AFTER
substituting the author's own text into the page, so a deck that said
`{{TITLE}}` out loud was refused with a fix naming a file its author had
never opened.

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


def _run(text):
    """Run THE DOCUMENTED COMMAND over a source; return verdict, words, page.

    Not `import build` -- the thing being proved is the command a human and an
    agent are told to run. A proof that reached past it into the library would
    be green about a compiler nobody invokes.
    """
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    with tempfile.TemporaryDirectory(prefix="panlabs-audit-proof-") as tmp:
        src = os.path.join(tmp, "planted.deck.html")
        out = os.path.join(tmp, "out.html")
        with open(src, "w", encoding="utf-8") as fh:
            fh.write(text)
        done = subprocess.run(
            [sys.executable, BUILD, src, out],
            capture_output=True, text=True, env=env, cwd=SKILL,
        )
        page = None
        if os.path.exists(out):
            with open(out, encoding="utf-8") as fh:
                page = fh.read()
        return done.returncode == 0, (done.stdout + done.stderr).strip(), page


def build(text):
    ok, said, _ = _run(text)
    return ok, said


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


def block(title, cases, width):
    proof = Proof(
        title=title,
        label=lambda key: key,
        invoke=lambda key, payload: build(payload),
        planted=lambda payload: payload != REAL,
        control=lambda key: build(REAL),
        width=width,
    )
    return proof.run(cases)


def the_page_is_not_a_template():
    """A deck may say `{{TITLE}}` out loud, and it stays said.

    THIS ONE DEMANDS GREEN, and it is the only one here that does. The
    skeleton's holes are filled in a single pass precisely so that the
    author's own words are never scanned for a marker of their own; going
    back to a substitution per hole brings back a refusal that blames
    `compiler/stage.html` for a sentence its author wrote.
    """
    print("the fill is one pass:  [built kept]")
    if REAL is None:
        print(f"  FAIL {'setup':<22} no example to plant in")
        return 1

    planted = REAL.replace("Nenhuma suíte verde", "Nenhuma {{TITLE}} verde", 1)
    ok, said, page = _run(planted)
    kept = bool(page) and "Nenhuma {{TITLE}} verde" in page
    marks = f"[{'+' if ok else '-'}{'+' if kept else '-'}]"
    good = ok and kept
    print(f"  {'ok  ' if good else 'FAIL'} {'author prose':<22} {marks} "
          "a slide whose own text looks like a hole")
    if not good:
        print(f"       <- {'refused: ' + said if not ok else 'the page lost the text'}")
    return 0 if good else 1


def main():
    if REAL is None:
        return Proof("the compiler's checks", lambda k: k, None, None, None).refuse(
            f"put a source back under {os.path.relpath(EXAMPLE, SKILL)} — with "
            "no real example there is no control, and a proof with no control "
            "measures its own author"
        )

    failed = block("the vocabulary ruler", [
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
    ], width=22)

    print()
    failed += block("the compiler's refusals", [
        (
            "no deck",
            "the element the whole source hangs from, gone",
            cut(r"<deck\b[^>]*>", "its opening <deck> tag"),
            "wrap the whole source in a <deck",
        ),
        (
            "header field gone",
            "one of the five the header has to say",
            swap('occasion="Retrospectiva de engenharia"', ""),
            "give the <deck> an occasion=",
        ),
        (
            "attribute with no value",
            "a header field written but never answered",
            swap('title="A régua e a plateia"', "title"),
            "give the <deck> a title=",
        ),
        (
            "theme not carried",
            "a theme the skill does not have on disk",
            swap('theme="base"', 'theme="panlabs"'),
            "build with a theme this skill carries",
        ),
    ], width=22)

    print()
    failed += the_page_is_not_a_template()
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
