#!/usr/bin/env python3
"""Plant a defect in the front door and demand RED -- the four assertions.

    python3 check-journey.proof.py

`SKILL.md` is the file every ticket edits, and a checker over a document is
the easiest kind to write green by accident: reword the rule it greps for and
it passes by vacuity, saying nothing about a journey that has quietly grown a
fourth turn or lost its build. Every family of `check-journey.py` is planted
against here, on the standard `proof_driver.py` states in full.

NOTHING IS WRITTEN TO THE TREE. Both families' inputs are passed in as text,
which is why the checker takes `skill_md` and `vocab_md` as arguments rather
than reading the files itself: a proof that mutates the document it measures
is one interrupted run away from leaving a mangled `SKILL.md` behind, and this
repository has already paid for a review agent that planted its defect in the
real worktree.
"""
import importlib.util
import pathlib
import re
import sys

# Nothing this suite runs may leave bytecode in the tree it measures.
sys.dont_write_bytecode = True

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from proof_driver import Drifted, Proof                           # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "check_journey", HERE / "check-journey.py")
check = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check)

FRONT = check.FRONT.read_text(encoding="utf-8") if check.FRONT.exists() else None
VOCAB = check.DOC.read_text(encoding="utf-8") if check.DOC.exists() else None


def _front():
    if FRONT is None:
        raise Drifted(f"{check.FRONT.name} is not on disk, so there is "
                      f"nothing to mutate -- restore it and run this again")
    return FRONT


def _vocab():
    if VOCAB is None:
        raise Drifted(f"{check.DOC.name} is not on disk -- run "
                      f"`python3 engine/vocab.py --write`")
    return VOCAB


def fence(body):
    return f"\n```bash\n{body}\n```\n"


# --------------------------------------------------------------------------
# 1 - three turns, one section, each closing
# --------------------------------------------------------------------------
def plant_fourth_turn():
    return dict(skill_md=_front() + "\n### Turno 4 · O portão\n\n"
                "**Fecha quando** alguém disser que fecha.\n")


def plant_second_section():
    """The LAST turn moves under a heading of its own, and nothing else moves.

    Adding a fourth turn under a new section would plant two defects at once,
    and the count rule -- which returns first -- would be the one to fire. A
    case whose red comes from a rule it was not aiming at proves that rule
    twice and this one never.
    """
    lines = _front().split("\n")
    heads = [i for i, l in enumerate(lines) if l.startswith("### ")]
    if len(heads) < 2:
        raise Drifted("there are not two turns to split across two sections")
    at = heads[-1]
    return dict(skill_md="\n".join(lines[:at] + ["## Um apêndice", ""]
                                   + lines[at:]))


def plant_turn_never_closes():
    md = _front()
    if "**Fecha quando**" not in md:
        raise Drifted("no turn says when it closes, so removing one changes "
                      "nothing -- the document is already red")
    return dict(skill_md=md.replace("**Fecha quando**", "**Talvez feche "
                                    "quando**", 1))


# --------------------------------------------------------------------------
# 2 - the artifact comes before the questions
# --------------------------------------------------------------------------
def _without_builds(md):
    """Every line naming the builder, gone.

    EVERY line, and not just the fenced one. An earlier version cut only the
    fence, and the day the document grew a second build -- an inline span in
    the door table -- the plant stopped planting: turn 1 still built, the
    family stayed green, and the case reported a rule it was no longer
    testing. Being blunt here is the point; the family cares about whether ANY
    command in turn 1 builds, so the plant has to leave none.
    """
    lines = md.split("\n")
    rest = [l for l in lines if check.BUILDER not in l]
    if len(rest) == len(lines):
        raise Drifted(f"no line names {check.BUILDER}, so there is no build "
                      f"to remove -- the document is already red")
    return rest


def plant_no_build_at_all():
    return dict(skill_md="\n".join(_without_builds(_front())))


def plant_build_behind_the_questions():
    """The build survives, but a later turn owns it -- the ordering branch.

    Worth its own case because the two failures are different documents: one
    forgot to document the build, the other put a round of questions in front
    of it, which is the premise this whole journey is shaped by.
    """
    rest = _without_builds(_front())
    heads = [i for i, l in enumerate(rest) if l.startswith("### ")]
    if len(heads) < 2:
        raise Drifted("there is no later turn to move the build into")
    at = heads[-1] + 1
    moved = fence(f"python3 engine/{check.BUILDER} /tmp/a.json /tmp/b.html")
    return dict(skill_md="\n".join(rest[:at] + [moved] + rest[at:]))


# --------------------------------------------------------------------------
# 3 - every path a documented command names exists, inside the skill
# --------------------------------------------------------------------------
def plant_dangling_path():
    return dict(skill_md=_front() + fence("python3 engine/does-not-exist.py"))


def plant_path_above_the_root():
    return dict(skill_md=_front() + fence("python3 ../../tools/elsewhere.py"))


def plant_dangling_in_a_table_row():
    """An inline span in the pointer table, not a fence.

    The sibling learned this one the expensive way: its command table is the
    document's whole inventory, and a row naming a tool that does not exist
    read as prose and was measured by nothing.
    """
    return dict(skill_md=_front() +
                "\n| `python3 engine/does-not-exist.py` | uma linha da tabela "
                "de comandos |\n")


# --------------------------------------------------------------------------
# 4 - nothing a documented command writes lands inside the tree that ships
# --------------------------------------------------------------------------
def plant_build_into_the_tree():
    """A destination that EXISTS inside the tree, so only family 4 fires.

    Writing to `examples/argument.json` is the realistic version of this
    defect: the documented command overwrites the example it ships with, and
    the installed package grows a file per run.
    """
    return dict(skill_md=_front() + fence(
        "python3 engine/build.py /tmp/x.argument.json examples/argument.json"))


def plant_redirect_into_the_tree():
    return dict(skill_md=_front() + fence(
        "python3 engine/build.py /tmp/x.argument.json /tmp/x.html > engine/log.txt"))


def plant_regenerating_write():
    """`--write` regenerates a document INSIDE the tree.

    It is a maintainer's command; the front door is read by whoever EXECUTES
    the skill, and a reader who runs it rewrites the vocabulary they were
    about to read.
    """
    return dict(skill_md=_front() + fence("python3 engine/vocab.py --write"))


# --------------------------------------------------------------------------
# 5 - the register's numbers reach the document the model reads
# --------------------------------------------------------------------------
def _drop_from_vocab(needle):
    md = _vocab()
    if needle not in md:
        raise Drifted(f"{needle!r} is not in {check.DOC.name}, so removing it "
                      f"changes nothing -- the document is already red")
    return dict(vocab_md=md.replace(needle, "—", 1))


def plant_ceiling_dropped():
    """One ceiling stops being published. The generator and the document would
    still agree with each other perfectly -- which is the half family 1 of the
    architecture gate cannot see."""
    name, spec = next(iter(check.REGISTER.items()))
    k, v = next(iter(spec["ceil"].items()))
    return _drop_from_vocab(f"`{k}` {v}")


def plant_zone_dropped():
    return _drop_from_vocab(f"{check.ZONE_PCT}%")


def plant_top_level_key_dropped():
    """A key an `argument.json` carries stops being published.

    These four used to be hand-written above the generated block, which is
    exactly why they are the case worth keeping: they were the last names in
    the vocabulary that nothing compared against anything.
    """
    k = check.DOCUMENT["fields"][0]
    return _drop_from_vocab(f'"{k}"')


CASES = [
    ("three-turns", "a fourth turn", plant_fourth_turn,
     "fold the extra ones back in"),
    ("three-turns", "a turn under a second section", plant_second_section,
     "move them under one section"),
    ("three-turns", "a turn that never says when it closes",
     plant_turn_never_closes, "add a **fecha quando** line"),
    ("artifact-first", "no turn builds anything", plant_no_build_at_all,
     "put the build in the first turn"),
    ("artifact-first", "the build moved behind the questions",
     plant_build_behind_the_questions, "move the build into the first turn"),
    ("paths-exist", "a command naming a path that does not exist",
     plant_dangling_path, "fix the spelling"),
    ("paths-exist", "a command reaching above the skill root",
     plant_path_above_the_root, "write the path from the skill root"),
    ("paths-exist", "a table row naming a path that does not exist",
     plant_dangling_in_a_table_row, "fix the spelling"),
    ("writes-outside", "the build writing over the example it ships",
     plant_build_into_the_tree, "send it to /tmp/"),
    ("writes-outside", "a redirect into the tree", plant_redirect_into_the_tree,
     "send it to /tmp/"),
    ("writes-outside", "a documented command regenerating a tracked document",
     plant_regenerating_write, "send it to /tmp/"),
    ("register-published", "one ceiling stops being published",
     plant_ceiling_dropped, "make vocab.py emit"),
    ("register-published", "the reading zone stops being published",
     plant_zone_dropped, "make vocab.py emit"),
    ("register-published", "a top-level key stops being published",
     plant_top_level_key_dropped, "make vocab.py emit"),
]


PROOF = Proof(
    title="journey.proof",
    label=lambda key: key,
    invoke=lambda key, payload: check.BY_NAME[key](**payload),
    planted=lambda payload: payload.get("skill_md", FRONT) != FRONT
    or payload.get("vocab_md", VOCAB) != VOCAB,
    control=lambda key: check.BY_NAME[key](),
)


def main():
    if FRONT is None:
        return PROOF.refuse(f"{check.FRONT} is not there -- every case below "
                            f"mutates it, and there is nothing to mutate")
    failed = PROOF.run(CASES)

    # A family nobody plants against is a family nobody has ever seen fail.
    # Worded and shaped exactly like the three proofs that came before this
    # one: a fourth phrasing of the same verdict is the drift `proof_driver`
    # was extracted to stop, one floor up.
    unplanted = [n for n, _ in check.FAMILIES
                 if not any(c[0] == n for c in CASES)]
    if unplanted:
        print(f"  FAIL coverage            no defect planted for: "
              f"{', '.join(unplanted)} -- add a case, or drop the family")
    else:
        print(f"  ok   coverage            {len(CASES)} planted defects over "
              f"all {len(check.FAMILIES)} families")
    return failed + len(unplanted)


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
