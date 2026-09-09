#!/usr/bin/env python3
"""THE DRIFT BETWEEN THE THEME AND THE DOCS, PLANTED AND DEMANDED RED.

    workbench/panlabs-presentation-builder/tests/check-theme.proof.py

`themes/panlabs/tokens.css` is a snapshot of `src/css/tokens.css` in
`panlabs-docs`, and `check-theme.py` is the only thing standing between the
two. A snapshot check that has only ever been seen green is a snapshot check
nobody has any reason to believe -- so every case here plants a disagreement
and demands that it be named.

THE DRIFT HAS TWO ENDS AND BOTH ARE PLANTED. A token can change in the theme
(somebody edited the snapshot) or in the documentation (the identity moved,
which is the case #207 actually expects), and a check that only noticed one of
them would be green through half of what it exists for. Neither plant is ever
written into the tree: both sides go to a temp copy, and the real files are
read and never opened for writing.

AND TWO CASES DEMAND GREEN, because a check can also be wrong by firing. The
prose around the tokens is a human's to write and must not be a drift; and
with no `panlabs-docs` beside the repository the check has to SKIP by name and
succeed, which is what keeps a maintainer who never cloned the docs from
having a suite they cannot run.

WITH NO DOCS ON THIS MACHINE, THIS PROOF SKIPS TOO. It measures a comparison
against a real second repository; inventing a fake one here would prove that
the resolver reads a fixture, which is not the claim.
"""

import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from proof_driver import Proof, cut, read, swap                        # noqa: E402

CHECK = os.path.join(HERE, "check-theme.py")
SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
THEME = os.path.join(SKILL, "themes", "panlabs", "tokens.css")

REAL = read(THEME)


def _docs():
    """Where the docs' tokens.css is, asked of the check itself.

    Importing `check-theme.py` would mean importing a hyphenated module; asking
    the command is cheaper and it also proves the lookup this proof depends on
    is the same lookup the check uses.
    """
    done = subprocess.run(
        [sys.executable, CHECK, "--print"],
        capture_output=True, text=True,
        env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"),
    )
    if "SKIP" in done.stdout:
        return None
    line = subprocess.run(
        [sys.executable, CHECK],
        capture_output=True, text=True,
        env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"),
    ).stdout.splitlines()[0]
    return line.split(" against ", 1)[1].split(" · ", 1)[0]


DOCS = _docs()
DOCS_TEXT = read(DOCS) if DOCS else None


def _run(theme_text=None, docs_text=None):
    """The documented command, over a planted copy of either side or of neither."""
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    with tempfile.TemporaryDirectory(prefix="panlabs-theme-proof-") as tmp:
        argv = [sys.executable, CHECK]
        if theme_text is not None:
            planted = os.path.join(tmp, "tokens.css")
            with open(planted, "w", encoding="utf-8") as fh:
                fh.write(theme_text)
            argv += ["--theme", planted]
        if docs_text is not None:
            planted = os.path.join(tmp, "docs-tokens.css")
            with open(planted, "w", encoding="utf-8") as fh:
                fh.write(docs_text)
            argv += ["--docs", planted]
        done = subprocess.run(argv, capture_output=True, text=True, env=env)
        return done.returncode == 0, (done.stdout + done.stderr).strip()


def the_prose_is_still_a_humans():
    """A comment rewritten in the theme sheet, and the check stays green.

    Every value in that file is surrounded by the paragraph explaining where
    it came from, and a check that read the comments would turn an edit to the
    explanation into a red about the identity.
    """
    planted = REAL.replace("IT IS A SNAPSHOT", "This is a snapshot", 1)
    changed = planted != REAL
    ok, said = _run(theme_text=planted)
    good = ok and changed
    marks = f"[{'+' if changed else '-'}{'+' if ok else '-'}]"
    print(f"  {'ok  ' if good else 'FAIL'} {'prose around it':<22} {marks} "
          "a comment rewritten around the tokens")
    if not good:
        print(f"       <- {'the plant changed nothing' if not changed else said}")
    return 0 if good else 1


def the_missing_docs_skip():
    """No `panlabs-docs` anywhere, and the check says so by name and succeeds.

    `$PANLABS_DOCS` pointed at a directory with no `src/css/tokens.css` under
    it is exactly the shape of "the docs are not beside this repository", and
    it is the only way to ask for that state without moving anybody's
    checkout.
    """
    with tempfile.TemporaryDirectory(prefix="panlabs-theme-nodocs-") as tmp:
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PANLABS_DOCS=tmp)
        done = subprocess.run([sys.executable, CHECK],
                              capture_output=True, text=True, env=env)
    said = (done.stdout + done.stderr).strip()
    ok = done.returncode == 0
    named = "SKIP" in said and "PANLABS_DOCS" in said
    good = ok and named
    marks = f"[{'+' if ok else '-'}{'+' if named else '-'}]"
    print(f"  {'ok  ' if good else 'FAIL'} {'no docs beside it':<22} {marks} "
          "the check skips by name instead of failing")
    if not good:
        print(f"       <- {said or 'said nothing at all'}")
    return 0 if good else 1


def main():
    if REAL is None:
        return Proof("the theme against the docs", lambda k: k, None, None, None).refuse(
            "put themes/panlabs/tokens.css back — with no snapshot there is "
            "nothing for this check to hold against the documentation"
        )
    if DOCS_TEXT is None:
        print("the theme against the docs:  SKIP — no panlabs-docs on this machine")
        print("  the drift check has nothing to compare, so neither has its proof;")
        print("  clone panlabs-docs as a sibling, or set PANLABS_DOCS=<path>")
        return 0

    proof = Proof(
        title="the theme against the docs",
        label=lambda key: key,
        invoke=lambda key, payload: _run(**payload),
        planted=lambda payload: (
            payload.get("theme_text", REAL) != REAL
            or payload.get("docs_text", DOCS_TEXT) != DOCS_TEXT
        ),
        control=lambda key: _run(),
        width=22,
    )

    failed = proof.run([
        (
            "a colour edited",
            "the accent moved in the snapshot and nowhere else",
            lambda: {"theme_text": swap(REAL, "#F77C55", "#FF7A50")()},
            "set --accent to #F77C55",
        ),
        (
            "an alpha edited",
            "a hairline at an opacity the docs never asked for",
            lambda: {"theme_text": swap(REAL, "rgb(244 246 250 / 0.12)",
                                        "rgb(244 246 250 / 0.15)")()},
            "set --hairline to rgb(244 246 250 / 0.12)",
        ),
        (
            "a token dropped",
            "a pair of the snapshot with only one side left",
            lambda: {"theme_text": cut(REAL, r"\n  --content-2: #75D78D;", "--content-2")()},
            "declare --content-2 in themes/panlabs/tokens.css",
        ),
        (
            "a font stack edited",
            "a fallback the docs do not name",
            lambda: {"theme_text": swap(REAL, "ui-monospace, SFMono-Regular",
                                        "Courier New, SFMono-Regular")()},
            "set --font-mono to",
        ),
        # THE OTHER END OF THE DRIFT, and the one #207 actually expects: the
        # identity moves in the documentation and the decks do not hear about
        # it. Planting on the docs' side is the only way to prove the check
        # notices the direction it exists for.
        (
            "the docs moved",
            "the brand rewritten in the documentation, snapshot untouched",
            lambda: {"docs_text": swap(DOCS_TEXT, "--pd-brand:          #BC461D;",
                                       "--pd-brand:          #1D6ABC;")()},
            "set --accent to",
        ),
        (
            "the ramp moved",
            "the page colour rewritten in the documentation",
            lambda: {"docs_text": swap(DOCS_TEXT, "--pd-neutral-page-dark:    #141414;",
                                       "--pd-neutral-page-dark:    #101010;")()},
            "set --surface to #101010",
        ),
    ])

    print()
    print("and the two that demand green:  [planted green]")
    failed += the_prose_is_still_a_humans()
    failed += the_missing_docs_skip()
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
