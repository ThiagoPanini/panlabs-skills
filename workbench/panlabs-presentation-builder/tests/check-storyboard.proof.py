#!/usr/bin/env python3
"""THE STORYBOARD CHECK, PLANTED AGAINST AND DEMANDED RED.

    workbench/panlabs-presentation-builder/tests/check-storyboard.proof.py

`check-storyboard.py` is the only thing in this suite that reads the page
`compiler/storyboard.py` writes. Every ruler in the compiler stops at the
source, so a storyboard that skipped a slide, printed the arc one row out of
step or dropped a line of the art direction would leave every other layer green
-- which makes this the exact check that must not be one nobody has seen red.

The plants come in two shapes, because the check asks two questions.

  the page describes the deck   planted by writing a MUTATED COPY of a real
                                storyboard into a temp file and pointing the
                                check's two-argument door at it, beside the
                                untouched source. Same shape as
                                `check-catalog.proof.py`: the tree being
                                measured is never written to.

  the page is the same twice    cannot be planted from outside at all -- a
                                generator either carries a clock or it does
                                not. So the whole skill is copied into a temp
                                tree, a clock is planted into that copy's
                                `compiler/storyboard.py`, and the check is run
                                against the copy. It is the only case here that
                                needs a whole tree, and it needs one because
                                what it proves is about the GENERATOR rather
                                than about any file it wrote.

AND ONE CASE THAT DEMANDS GREEN, because a check can also be wrong by firing.
The storyboard prints a slide's message with the emphasis flattened and the
whitespace squeezed; a source that wrapped that same slot across two lines says
exactly the same thing, and a check comparing raw text would refuse the deck for
where its author pressed return.
"""

import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from proof_driver import Proof, cut, read, swap                        # noqa: E402

SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
CHECK = os.path.join(HERE, "check-storyboard.py")
PROPOSAL = os.path.join(SKILL, "examples", "proposal.deck.html")
GENERATOR = os.path.join(SKILL, "compiler", "storyboard.py")

PROPOSAL_SOURCE = read(PROPOSAL)
GENERATOR_SOURCE = read(GENERATOR)

# The one line of the proposal deck that reaches the storyboard as a message,
# and the same line with the return pressed in the middle of it.
SLOT = ('    <p class="title">A hora reservada troca <strong>um dia inteiro</strong> '
        "por sessenta minutos</p>")
WRAPPED = ('    <p class="title">A hora reservada troca\n'
           "      <strong>um dia inteiro</strong>\n"
           "      por sessenta minutos</p>")

# The tail of `render()`, and the same tail with a clock in it. A storyboard
# that changes between two builds of one source is the defect #217 names by
# name ("reproduzível byte a byte"), and a clock is the cheapest way to have one.
TAIL = '''    lines.append("")
    return "\\n".join(lines)'''
TAIL_WITH_CLOCK = '''    lines.append(str(__import__("time").time_ns()))
    return "\\n".join(lines)'''


def _env():
    return dict(os.environ, PYTHONDONTWRITEBYTECODE="1")


def _build(source_path, into):
    """Build one source with the documented command; return the storyboard path."""
    out = os.path.join(into, "deck.html")
    # NO BROWSER, THE SAME WAY THE CHECK ITSELF ASKS FOR NONE: with no `node` to
    # find, the render gate degrades to its named SKIP and nothing else moves.
    env = {k: v for k, v in os.environ.items() if k != "PATH"}
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    done = subprocess.run(
        [sys.executable, os.path.join(SKILL, "compiler", "build.py"),
         source_path, out],
        capture_output=True, text=True, env=env, cwd=SKILL,
    )
    if done.returncode != 0:
        return None, (done.stdout + done.stderr).strip()
    return os.path.join(into, "deck.storyboard.md"), ""


REAL_BOARD = None


def _real_board():
    """The storyboard of the proposal deck, built once and kept as text."""
    global REAL_BOARD
    if REAL_BOARD is None:
        with tempfile.TemporaryDirectory(prefix="panlabs-storyboard-proof-") as tmp:
            where, why = _build(PROPOSAL, tmp)
            REAL_BOARD = read(where) if where else ""
            if not REAL_BOARD:
                print(f"REFUSED · the proposal deck would not build: {why}")
    return REAL_BOARD


def _pair(board_text):
    """Run the check over the real source and a storyboard written to disk."""
    with tempfile.TemporaryDirectory(prefix="panlabs-storyboard-proof-") as tmp:
        planted = os.path.join(tmp, "deck.storyboard.md")
        with open(planted, "w", encoding="utf-8") as fh:
            fh.write(board_text)
        done = subprocess.run(
            [sys.executable, CHECK, PROPOSAL, planted],
            capture_output=True, text=True, env=_env(), cwd=SKILL,
        )
        return done.returncode == 0, (done.stdout + done.stderr).strip()


def board_block(title, cases, width):
    settled = []

    def control(_key):
        if not settled:
            settled.append(_pair(_real_board()))
        return settled[0]

    return Proof(
        title=title,
        label=lambda key: key,
        invoke=lambda key, payload: _pair(payload),
        planted=lambda payload: payload != _real_board(),
        control=control,
        width=width,
    ).run(cases)


def the_generator_may_not_carry_a_clock():
    """A clock planted in the generator, and the corpus run demanded red.

    THE ONLY CASE HERE THAT COPIES A TREE, and the reason is that what it proves
    is not about any file: "the same source twice, byte for byte" is a property
    of the GENERATOR, and the only way to plant against it is to hand the check
    a generator that does not have it. The copy carries the whole skill because
    the check builds through the documented command, and that command reads the
    themes, the icons and the faces beside it.
    """
    if GENERATOR_SOURCE is None or TAIL not in GENERATOR_SOURCE:
        print(f"  FAIL {'setup':<24} the generator no longer ends the way this "
              "case plants into")
        return 1

    with tempfile.TemporaryDirectory(prefix="panlabs-storyboard-tree-") as tmp:
        skill = os.path.join(tmp, "skills", "panlabs-presentation-builder")
        tests = os.path.join(tmp, "workbench", "panlabs-presentation-builder", "tests")
        os.makedirs(os.path.dirname(skill))
        os.makedirs(tests)
        shutil.copytree(SKILL, skill)
        shutil.copyfile(CHECK, os.path.join(tests, "check-storyboard.py"))
        with open(os.path.join(skill, "compiler", "storyboard.py"),
                  "w", encoding="utf-8") as fh:
            fh.write(GENERATOR_SOURCE.replace(TAIL, TAIL_WITH_CLOCK, 1))

        done = subprocess.run(
            [sys.executable, os.path.join(tests, "check-storyboard.py")],
            capture_output=True, text=True, env=_env(), cwd=tmp,
        )
    said = (done.stdout + done.stderr).strip()
    red = done.returncode != 0
    says = "take the clock out of compiler/storyboard.py" in said
    good = red and says
    marks = f"[+{'+' if red else '-'}{'+' if says else '-'}+]"
    print(f"  {'ok  ' if good else 'FAIL'} {'a clock in the page':<24} {marks} "
          "a generator that writes a different page every time it runs")
    if good:
        print(f"       red: {said.splitlines()[0]}")
    else:
        print(f"       <- {'stayed GREEN' if not red else 'the red never names the fix'}: "
              f"{said.splitlines()[0] if said else '(nothing said)'}")
    return 0 if good else 1


def the_wrapped_slot_still_matches():
    """The same sentence with a return in the middle, and the check stays green.

    The storyboard flattens a slot into one line, because that is what a message
    IS -- the words, not the shape of the file they were typed into. A check that
    held the printed message against the raw source would refuse the deck for
    where its author pressed return, which is a red about a keystroke.
    """
    if PROPOSAL_SOURCE is None or SLOT not in PROPOSAL_SOURCE:
        print(f"  FAIL {'setup':<24} the proposal deck no longer carries the "
              "slot this case wraps")
        return 1

    planted = PROPOSAL_SOURCE.replace(SLOT, WRAPPED, 1)
    with tempfile.TemporaryDirectory(prefix="panlabs-storyboard-wrap-") as tmp:
        source = os.path.join(tmp, "wrapped.deck.html")
        with open(source, "w", encoding="utf-8") as fh:
            fh.write(planted)
        where, why = _build(source, tmp)
        if where is None:
            print(f"  FAIL {'wrapped slot':<24} [--] the wrapped deck would not "
                  f"build: {why}")
            return 1
        done = subprocess.run(
            [sys.executable, CHECK, source, where],
            capture_output=True, text=True, env=_env(), cwd=SKILL,
        )
    ok = done.returncode == 0
    said = (done.stdout + done.stderr).strip()
    marks = f"[+{'+' if ok else '-'}]"
    print(f"  {'ok  ' if ok else 'FAIL'} {'wrapped slot':<24} {marks} "
          "one sentence typed across three lines of the source")
    if not ok:
        print(f"       <- refused: {said}")
    return 0 if ok else 1


def main():
    board = _real_board()
    if not board:
        return Proof("the storyboard check", lambda k: k, None, None, None).refuse(
            "build examples/proposal.deck.html first — with no real storyboard "
            "there is nothing to plant into and no control to be green"
        )

    failed = board_block("the page describes the deck (#217)", [
        (
            "a slide dropped",
            "one row taken out of a story about a deck that still has the slide",
            cut(board, r"\n\| 2 \|[^\n]*", "the second slide's row"),
            "the storyboard lists",
        ),
        (
            "the wrong pattern",
            "a row naming a shape its slide does not take",
            swap(board, "`closing-call`", "`section-divider`"),
            "slide 11 is a closing-call and its row says",
        ),
        (
            "the wrong function",
            "a row naming an act the slide never declared",
            swap(board, "| 11 | chamada |", "| 11 | plano |"),
            'slide 11 declares arc="call" and its row says "plano"',
        ),
        (
            "the rows renumbered",
            "a story told in an order the deck is not in",
            swap(board, "| 11 | chamada |", "| 12 | chamada |"),
            "row 11 of the storyboard is numbered 12",
        ),
        (
            "words the deck never says",
            "a message invented for a slide that says something else",
            swap(board, "Aprovem a terça de manhã, a partir da próxima semana.",
                 "Aprove o orçamento do trimestre."),
            "and no slide of the source does",
        ),
        (
            "a choice not published",
            "the art direction's signature dropped from the header table",
            cut(board, r"\n\| assinatura \|[^\n]*", "the signature's row"),
            "the storyboard never publishes it",
        ),
    ], width=24)

    print()
    # THE TAIL THIS PAGE IS THE ONLY PUBLISHER OF (#238). A source has four
    # fields and a stage prints two of them; `where` and `excerpt` exist nowhere
    # a reader can see except here. A generator that dropped either would leave
    # the deck looking sourced, the number unfindable, and every other layer of
    # this suite green -- which is the same argument that put the rest of this
    # file here, one block over.
    failed += board_block("the provenance beside the deck (#238)", [
        (
            "the sources dropped",
            "a deck that cites, and a page that never says what it cited",
            cut(board, r"\n\n## Fontes.*", "the provenance section"),
            "the storyboard never lists it",
        ),
        (
            "a field the stage never prints",
            "the source's own address taken out of the row",
            swap(board, "examples/proposal.deck.html", "em algum lugar"),
            "under `where`",
        ),
    ], width=24)

    print()
    failed += the_generator_may_not_carry_a_clock()

    print()
    print("and the one that demands green:  [planted green]")
    failed += the_wrapped_slot_still_matches()
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
