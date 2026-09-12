#!/usr/bin/env python3
"""EVERY FAMILY OF THE EXTRACTOR CHECK, PLANTED AGAINST AND DEMANDED RED.

    workbench/panlabs-presentation-builder/tests/check-extract.proof.py

A check only ever seen green is documentation, and this one is the easiest in
the suite to be green about: the command it measures answers on six formats, and
a reader that quietly returned "" for one of them would still print a fragment,
still exit 0, and still look exactly like a command that worked.

THE PLANT IS IN THE COMMAND, NOT IN THE INPUT, and that is what makes this proof
different from its neighbours. `check-audit.proof.py` mutates a deck because the
subject there is a RULER reading a source; the subject here is the command
itself, so what has to be broken is the command -- one defect at a time, in a
COPY of the whole skill tree in a temp directory, with `check-extract.py` pointed
at that copy through the door it keeps open for exactly this.

THE TREE IS COPIED WHOLE RATHER THAN THE ONE FILE, because two families ask the
command about the tree it lives in: `--out` landing inside the skill has to be
refused, and nothing a run writes may land in it. A lone file in a temp
directory would answer both questions about a directory that is not a skill.

FOUR OF THE FIVE DEFECTS BELOW ARE REAL. The `.xlsx` whose relationship writes
`Target=` before `Id=`, and the one whose target is spelled from the root of the
zip, are the two the first real spreadsheet this reader was pointed at actually
had -- both came back as an empty workbook, with an exit code of 0 and a
fragment that looked filled in. The PDF with no text layer is the first real PDF
it was pointed at. Only the silent SKIP is invented, and it is the one that
would cost the most: a caller reading 0 carries on with a source whose words it
never got.
"""

import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from proof_driver import Proof, read, swap                       # noqa: E402

SKILL = HERE.parent.parent.parent / "skills" / "panlabs-presentation-builder"
COMMAND = SKILL / "tools" / "extract.py"
CHECK = HERE / "check-extract.py"

REAL = read(COMMAND)


def _plant(payload):
    """Run the check against a copy of the tree with `payload` as the command.

    THE COPY IS THROWN AWAY WITH THE PROCESS, and the real tree is never written
    to -- a ruler that modified its subject would be measuring itself, which is
    the same rule `check-audit.proof.py` keeps one layer down.
    """
    with tempfile.TemporaryDirectory(prefix="panlabs-extract-proof-") as into:
        tree = os.path.join(into, "skill")
        shutil.copytree(SKILL, tree, symlinks=True,
                        ignore=shutil.ignore_patterns("__pycache__"))
        command = os.path.join(tree, "tools", "extract.py")
        if payload is not None:
            with open(command, "w", encoding="utf-8") as fh:
                fh.write(payload)
        done = subprocess.run(
            [sys.executable, str(CHECK), command],
            capture_output=True, text=True, timeout=600,
            env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"),
        )
        said = (done.stdout + done.stderr).strip()
        # ONLY THE RED LINES COME BACK. The check prints a line per family, green
        # ones included, and a proof that quoted all six under every case would
        # bury the one line the assertion is about under thirty-five that say
        # nothing happened. What is asserted is the FIX, and the fix is in the red.
        reds = [line.strip() for line in said.splitlines()
                if line.strip().startswith("FAIL")]
        return done.returncode == 0, " / ".join(reds) if reds else said


# ── the needles ──────────────────────────────────────────────────────────────
# Each one is a line of `tools/extract.py` as it stands, and `swap` refuses to
# plant a needle the file no longer holds -- so a reader rewritten out from under
# this proof reports a drifted fixture instead of a case that plants nothing and
# passes the other three assertions by accident.

THE_PARAGRAPHS = "    for para in W_PARA.split(xml):"
THE_ATTRIBUTES = '    return {k: html.unescape(v) for k, v in X_ATTR.findall(said or "")}'
THE_ABSOLUTE = '    if target.startswith("/"):\n        return target.lstrip("/")'
THE_TEXT_LAYER = '    said = _squeeze("\\n\\n".join(page.extract_text() or "" for page in reader.pages))'
THE_SKIP_CODE = '    print(f"── extract · SKIP — {why}")\n    return SKIP'
THE_GUARD = "        if landing == ROOT or landing.startswith(ROOT + os.sep):"
THE_STDOUT = "    if not args.out:\n        print(said)\n        return 0"


def main():
    if REAL is None:
        return Proof(
            title="extract", label=lambda k: k, invoke=None,
            planted=None, control=None,
        ).refuse(f"{COMMAND} is not there — there is nothing to plant into")

    proof = Proof(
        title="extract",
        label=lambda key: key,
        invoke=lambda key, payload: _plant(payload),
        planted=lambda payload: payload != REAL,
        control=lambda key: _plant(None),
        width=17,
    )

    return proof.run([
        (
            "every-format",
            "a Word document whose paragraphs are never walked",
            swap(REAL, THE_PARAGRAPHS, "    for para in []:"),
            "fix the reader in tools/extract.py",
        ),
        (
            "attribute-order",
            "a relationship read only when Id= is written first",
            swap(REAL, THE_ATTRIBUTES,
                 '    found = X_ATTR.findall(said or "")\n'
                 "    return {k: html.unescape(v) for k, v in found[:1]}"),
            "read a relationship's attributes into a dict",
        ),
        (
            "attribute-order",
            "a target spelled from the root of the zip, resolved as relative",
            swap(REAL, THE_ABSOLUTE,
                 '    if target.startswith("/"):\n        return "xl/" + target.lstrip("/")'),
            "resolve a Target that starts with a slash",
        ),
        (
            "pdf-text",
            "a PDF reader that hands back nothing at all",
            swap(REAL, THE_TEXT_LAYER, '    said = ""'),
            "fix the PDF reader in tools/extract.py",
        ),
        (
            "named-skips",
            "a SKIP that prints and exits as though it had worked",
            swap(REAL, THE_SKIP_CODE,
                 '    print(f"── extract · SKIP — {why}")\n    return 0'),
            "print the named SKIP and exit 3",
        ),
        (
            "refusals",
            "the guard on --out dropped, and the fragment written into the skill",
            swap(REAL, THE_GUARD, "        if False:"),
            "refuse each of these with a fix",
        ),
        (
            "writes-nothing",
            "a command that keeps a copy of its own output inside the tree",
            swap(REAL, THE_STDOUT,
                 "    if not args.out:\n"
                 "        with open(os.path.join(ROOT, 'last-extract.md'), 'w',\n"
                 "                  encoding='utf-8') as fh:\n"
                 "            fh.write(said)\n"
                 "        print(said)\n"
                 "        return 0"),
            "send every byte this command writes outside the tree",
        ),
    ])


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
