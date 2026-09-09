#!/usr/bin/env python3
"""Plant a defect in the front door and demand RED -- the four assertions.

    workbench/panlabs-presentation-builder/tests/check-journey.proof.py

`SKILL.md` is the file every ticket edits, and a checker over a document is the
easiest kind to write green by accident: reword the rule it greps for and it
passes by vacuity, saying nothing about a journey that has quietly grown a
fourth turn, lost its round of questions, or started building before it asks
anything. Every family of `check-journey.py` is planted against here, on the
standard `proof_driver.py` states in full.

THE CASE #218 NAMES BY NAME IS `calibration-first`'s FIRST. Cut the round out
of turn 1 -- the table that decides the header -- and the family has to go red;
that is the whole of what "calibragem antes de gerar" buys, and a document that
lost it would otherwise read as three perfectly well-formed turns.

NOTHING IS WRITTEN TO THE TREE. Both documents are passed in as text, which is
why every family takes `skill_md` and `catalog_md` as arguments rather than
reading the files itself: a proof that mutates the document it measures is one
interrupted run away from leaving a mangled `SKILL.md` behind, and this
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
DOC = check.DOC.read_text(encoding="utf-8") if check.DOC.exists() else None


def _front():
    if FRONT is None:
        raise Drifted(f"{check.FRONT.name} is not on disk, so there is nothing "
                      f"to mutate -- restore it and run this again")
    return FRONT


def _doc():
    if DOC is None:
        raise Drifted(f"{check.DOC.name} is not on disk -- run "
                      f"`python3 compiler/catalog.py --write`")
    return DOC


def fence(body):
    return f"\n```bash\n{body}\n```\n"


def _turn_bounds(md, which):
    """(first line, last line) of one turn's body, by index.

    Turn bodies are what four of the six families read, and slicing them by
    heading is the only way a plant can touch ONE turn and leave the rest of
    the document exactly as it was.
    """
    lines = md.split("\n")
    heads = [i for i, line in enumerate(lines) if line.startswith("### ")]
    if len(heads) <= which:
        raise Drifted(f"the document has {len(heads)} turn(s), so there is no "
                      f"turn {which + 1} to plant into")
    start = heads[which]
    end = next((i for i, line in enumerate(lines)
                if i > start and (line.startswith("### ")
                                  or line.startswith("## "))), len(lines))
    return lines, start, end


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
    lines, start, _ = _turn_bounds(_front(), 2)
    return dict(skill_md="\n".join(lines[:start] + ["## Um apêndice", ""]
                                   + lines[start:]))


def plant_turn_never_closes():
    md = _front()
    if check.CLOSES not in md:
        raise Drifted("no turn says when it closes, so removing one changes "
                      "nothing -- the document is already red")
    return dict(skill_md=md.replace(check.CLOSES, "**Talvez feche quando**", 1))


# --------------------------------------------------------------------------
# 2 - the round comes first, and it decides the whole header
# --------------------------------------------------------------------------
def plant_round_removed():
    """THE CASE #218 ASKS FOR BY NAME: the calibration leaves the document.

    Every line of turn 1 naming a header field goes, and the three other turns
    -- the build included -- stay exactly where they were. What is left reads
    as a well-formed journey of three turns that never asks anything, which is
    precisely the regression a family measuring only POSITION would miss.
    """
    lines, start, end = _turn_bounds(_front(), 0)
    names = check._header_names()
    body = [line for line in lines[start:end]
            if not any(f"`{n}`" in line for n in names)]
    if len(body) == end - start:
        raise Drifted("turn 1 names no header field, so there is no round to "
                      "remove -- the document is already red")
    return dict(skill_md="\n".join(lines[:start] + body + lines[end:]))


def plant_one_choice_undecided():
    """One name of the header stops being decided, and only that one.

    Worth its own case beside the wholesale cut: the register is what supplies
    the list, so the day a tenth art-direction choice lands, this is the shape
    of red the document gets -- one line to add, not a journey to rewrite.
    """
    md = _front()
    name = check._header_names()[-1]
    if f"`{name}`" not in md:
        raise Drifted(f"`{name}` is not in the document, so removing it changes "
                      f"nothing -- the document is already red")
    return dict(skill_md=md.replace(f"`{name}`", "«a definir»"))


def _without_builds(md):
    """Every line naming the builder, gone.

    EVERY line, and not just the fenced one. The v1 learned this the expensive
    way: it cut only the fence, and the day the document grew a second build --
    an inline span in the door table -- the plant stopped planting and the case
    reported a rule it was no longer testing.
    """
    lines = md.split("\n")
    rest = [line for line in lines if check.BUILDER not in line]
    if len(rest) == len(lines):
        raise Drifted(f"no line names {check.BUILDER}, so there is no build to "
                      f"remove -- the document is already red")
    return rest


def plant_no_build_at_all():
    return dict(skill_md="\n".join(_without_builds(_front())))


def plant_build_in_front_of_the_round():
    """The build survives, and turn 1 owns it -- the ordering branch.

    This is the v1's premise inverted, and the inversion is the whole of #207's
    change of mind: that skill built first because the human reacted to an
    artifact, and this one asks first because the artifact is twenty slides
    whose tension is in the wrong place.
    """
    rest = _without_builds(_front())
    heads = [i for i, line in enumerate(rest) if line.startswith("### ")]
    if not heads:
        raise Drifted("there is no first turn to move the build into")
    at = heads[0] + 1
    moved = fence(f"python3 compiler/{check.BUILDER} /tmp/a.deck.html /tmp/b.html")
    return dict(skill_md="\n".join(rest[:at] + [moved] + rest[at:]))


# --------------------------------------------------------------------------
# 3 - the story arrives before the pixels
# --------------------------------------------------------------------------
def _without_storyboard(lines):
    """Every mention of the storyboard gone, and every heading still standing.

    A HEADING IS REWRITTEN RATHER THAN DROPPED, and the difference is the whole
    reason this helper exists: turn 1's own title carries the word, so cutting
    lines outright would delete a `### ` and hand the family a document of TWO
    turns. The red would still arrive, from a defect nobody planted.
    """
    rest = []
    hit = False
    for line in lines:
        if check.STORYBOARD not in line.lower():
            rest.append(line)
            continue
        hit = True
        if line.startswith("### "):
            rest.append(line.replace(check.STORYBOARD, "a história"))
    if not hit:
        raise Drifted(f"no line names the {check.STORYBOARD}, so there is "
                      f"nothing to move -- the document is already red")
    return rest


def plant_no_storyboard_at_all():
    return dict(skill_md="\n".join(_without_storyboard(_front().split("\n"))))


def plant_storyboard_after_the_build():
    """The proposal moves out of turn 1 and into the turn that builds.

    The realistic version of this defect, and the reason the family reads
    POSITION rather than presence: a document that mentions the storyboard only
    where the compiler happens to write one has turned the story into a
    by-product of the deck, which is the exact order #207 refuses.
    """
    lines = _without_storyboard(_front().split("\n"))
    heads = [i for i, line in enumerate(lines) if line.startswith("### ")]
    if len(heads) < 2:
        raise Drifted("there is no later turn to move the proposal into")
    at = heads[1] + 1
    moved = (f"\nO {check.STORYBOARD} proposto sai aqui, ao lado do deck "
             f"construído.\n")
    return dict(skill_md="\n".join(lines[:at] + [moved] + lines[at:]))


# --------------------------------------------------------------------------
# 4 - every path a documented command names exists, inside the skill
# --------------------------------------------------------------------------
def plant_dangling_path():
    return dict(skill_md=_front() + fence("python3 compiler/does-not-exist.py"))


def plant_path_above_the_root():
    return dict(skill_md=_front() + fence("python3 ../../tools/elsewhere.py"))


def plant_no_commands_at_all():
    """Every command leaves the document, and the two command families are
    asked whether they are green about nothing.

    THE HOLE THIS CLOSES. `paths-exist` asks whether a documented path resolves
    and `writes-outside` asks where a documented write lands; strip the last
    command and both questions have no subject, so both answered TRUE about a
    front door that names no command to be wrong about. It is the same shape as
    a suite finding an empty corpus, and the same answer: a check that measured
    nothing says so.
    """
    md = _front()
    if not check.commands(md):
        raise Drifted("the document already documents no command -- there is "
                      "nothing to strip")
    out, fenced = [], False
    for line in md.split("\n"):
        if re.match(r"\s*```", line):
            fenced = not fenced
            continue
        if fenced:
            continue
        out.append(re.sub(r"`(?:python3?|bash|sh|node|\./)[^`\n]*`",
                          "«um comando»", line))
    planted = "\n".join(out)
    if check.commands(planted):
        raise Drifted(f"stripping fences and inline spans still leaves "
                      f"{len(check.commands(planted))} command(s) -- the plant "
                      f"no longer plants; re-anchor it on how the document "
                      f"writes a command now")
    return dict(skill_md=planted)


def plant_dangling_in_a_table_row():
    """An inline span in the pointer table, not a fence.

    The sibling learned this one the expensive way: its command table is the
    document's whole inventory, and a row naming a tool that does not exist
    read as prose and was measured by nothing.
    """
    return dict(skill_md=_front() +
                "\n| `node gate/does-not-exist.cjs` | uma linha da tabela de "
                "comandos |\n")


# --------------------------------------------------------------------------
# 5 - nothing a documented command writes lands inside the tree that ships
# --------------------------------------------------------------------------
def plant_build_into_the_tree():
    """A destination that EXISTS inside the tree, so only family 5 fires.

    Writing over `examples/proposal.deck.html` is the realistic version of
    this defect: the documented command overwrites the example it ships with,
    and the installed package grows a file per run.
    """
    return dict(skill_md=_front() + fence(
        "python3 compiler/build.py /tmp/x.deck.html "
        "examples/proposal.deck.html"))


def plant_contact_sheet_into_the_tree():
    """The render gate's `--out`, aimed at the tree instead of at scratch.

    The contact sheet is a PNG per build, and #207 put the whole suite outside
    the skill so that the package would not carry the maintainer's weight. A
    documented `--out examples` would undo that one image at a time.
    """
    return dict(skill_md=_front() + fence(
        "node gate/render.cjs /tmp/exemplo.html --out examples"))


def plant_redirect_into_the_tree():
    return dict(skill_md=_front() + fence(
        "python3 compiler/build.py /tmp/x.deck.html /tmp/x.html > compiler/log.txt"))


def plant_regenerating_write():
    """`--write` regenerates a document INSIDE the tree.

    It is a maintainer's command; the front door is read by whoever EXECUTES
    the skill, and a reader who runs it rewrites the catalog they were about to
    read.
    """
    return dict(skill_md=_front() + fence("python3 compiler/catalog.py --write"))


# --------------------------------------------------------------------------
# 6 - the register's facts reach the document the model reads
# --------------------------------------------------------------------------
def _drop_from_doc(needle, replacement="—"):
    """One fact out of the document, and NOTHING ELSE OUT WITH IT.

    Every needle below keeps the scaffolding around the fact it drops -- the
    section heading, the row, the name in the first cell. A plant that took the
    heading with the budget would go red for a pattern with no section, which
    is a different rule of the same family proving itself twice while the one
    the case is named after goes untested.
    """
    md = _doc()
    if needle not in md:
        raise Drifted(f"{needle!r} is not in {check.DOC.name}, so removing it "
                      f"changes nothing -- the document is already red")
    return dict(catalog_md=md.replace(needle, replacement, 1))


def plant_budget_dropped():
    """One pattern's budget stops being published, and only that one.

    The generator and the document would still agree with each other perfectly
    -- which is the half layer 3's `catalog.py --check` cannot see. The number
    goes and its section stays, so a family holding budgets against the whole
    page would stay green on some other pattern's copy of the same number.
    """
    name, p = next(iter(check.catalog.PATTERNS.items()))
    return _drop_from_doc(f"### `{name}` · até {p.budget} palavras",
                          f"### `{name}`")


def plant_slot_dropped():
    """One slot's row loses the slot's name, and keeps everything else.

    A pattern with a slot the document never names is a pattern the model
    writes without it -- and the compiler then refuses a source for a slot the
    reference never offered.
    """
    name, p = next(iter(check.catalog.PATTERNS.items()))
    slot = p.slots[-1]
    return _drop_from_doc(f"| `{slot.name}` |", "| — |")


def plant_scale_span_dropped():
    """A scale of moments keeps its name and loses the count it admits.

    The nastiest of the four: `moments` is a promise the deck makes in its own
    header and a ruler cashes in, and a model reading a scale with no count
    declares one by feel.
    """
    s = check.catalog.MOMENT_SCALES[0]
    return _drop_from_doc(f"| `{s.name}` | {s.span} |", f"| `{s.name}` | — |")


def plant_category_title_dropped():
    """One title that refuses stops being published.

    The list is closed and the compiler enforces it; a model that cannot read
    it writes «Visão geral», gets refused, and has nowhere to look up why.
    """
    return _drop_from_doc(f"«{check.catalog.CATEGORY_TITLES[0]}»")


CASES = [
    ("three-turns", "a fourth turn", plant_fourth_turn,
     "fold the extra ones back in"),
    ("three-turns", "a turn under a second section", plant_second_section,
     "move them under one section"),
    ("three-turns", "a turn that never says when it closes",
     plant_turn_never_closes, "add a **fecha quando** line"),
    ("calibration-first", "the round cut out of turn 1", plant_round_removed,
     "name each in the round"),
    ("calibration-first", "one name of the header left undecided",
     plant_one_choice_undecided, "name each in the round"),
    ("calibration-first", "no turn builds anything", plant_no_build_at_all,
     "put the build in a turn after the round"),
    ("calibration-first", "the build moved in front of the round",
     plant_build_in_front_of_the_round, "move the build into a later turn"),
    ("storyboard-first", "no turn proposes a storyboard",
     plant_no_storyboard_at_all, "propose it in turn 1"),
    ("storyboard-first", "the storyboard proposed after the deck exists",
     plant_storyboard_after_the_build, "move the proposal into turn 1"),
    ("paths-exist", "a command naming a path that does not exist",
     plant_dangling_path, "fix the spelling"),
    ("paths-exist", "a command reaching above the skill root",
     plant_path_above_the_root, "write the path from the skill root"),
    ("paths-exist", "a table row naming a path that does not exist",
     plant_dangling_in_a_table_row, "fix the spelling"),
    ("paths-exist", "every command stripped, so there is no path to resolve",
     plant_no_commands_at_all, "restore the build command"),
    ("writes-outside", "every command stripped, so there is no write to place",
     plant_no_commands_at_all, "restore the build command"),
    ("writes-outside", "the build writing over the example it ships",
     plant_build_into_the_tree, "send it to /tmp/"),
    ("writes-outside", "the contact sheet landing in the tree",
     plant_contact_sheet_into_the_tree, "send it to /tmp/"),
    ("writes-outside", "a redirect into the tree", plant_redirect_into_the_tree,
     "send it to /tmp/"),
    ("writes-outside", "a documented command regenerating a tracked document",
     plant_regenerating_write, "send it to /tmp/"),
    ("register-published", "one pattern's budget stops being published",
     plant_budget_dropped, "make `reference()` in compiler/catalog.py emit"),
    ("register-published", "one slot stops being published", plant_slot_dropped,
     "make `reference()` in compiler/catalog.py emit"),
    ("register-published", "a scale keeps its name and loses its count",
     plant_scale_span_dropped, "make `reference()` in compiler/catalog.py emit"),
    ("register-published", "a title that refuses stops being published",
     plant_category_title_dropped,
     "make `reference()` in compiler/catalog.py emit"),
]


PROOF = Proof(
    title="journey.proof",
    label=lambda key: key,
    invoke=lambda key, payload: check.BY_NAME[key](**payload),
    planted=lambda payload: payload.get("skill_md", FRONT) != FRONT
    or payload.get("catalog_md", DOC) != DOC,
    control=lambda key: check.BY_NAME[key](),
)


def main():
    if FRONT is None:
        return PROOF.refuse(f"{check.FRONT} is not there -- every case below "
                            f"mutates it, and there is nothing to mutate")
    return PROOF.run(CASES) + PROOF.coverage(check.FAMILIES, CASES)


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
