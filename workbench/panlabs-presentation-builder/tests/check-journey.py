#!/usr/bin/env python3
"""THE FRONT DOOR, MEASURED AGAINST ITS OWN DOCUMENTS. Five families.

    python3 check-journey.py

`SKILL.md` is the only file the runtime reads to decide whether the skill
applies, the only file every ticket edits, and -- until this one existed --
the only file in this tree nothing verified. The parallel-workflow doctrine
says so after measuring two branches that both rewrote a `SKILL.md` and
merged green without either author reading the result.

Four of #158's criteria are mechanical, and these are those four plus the one
that keeps the fifth honest. The rest is prose, and prose is read by a human:
a checker that grepped for sentences would go red on the first rewording and
teach everyone to edit around it. `check-journey.cjs` in the sibling workbench
is the template for the shape; nothing is shared but the shape.

  1  three-turns          exactly three turns, all under one section, each
                          closing on a stated condition. Seven steps each
                          carrying its own gate is the shape the sibling spec
                          exists to undo, and it grows back one heading at a
                          time.
  2  artifact-first       the FIRST turn is the one that builds. This is
                          premise 11 made falsifiable: the human reacts to an
                          artifact, and a journey that questions before
                          showing anything contradicts the premise that
                          governed this whole effort. Reorder the turns to ask
                          first and this goes red.
  3  paths-exist          every concrete path a documented command names
                          resolves inside the skill and exists.
                          `scripts/checks/references.sh` excludes code fences
                          BY DESIGN, so a command's ARGUMENTS are measured
                          here or nowhere.
  4  writes-outside       no documented command writes inside the skill tree.
                          The sibling's package reached 29 of its 30 MB
                          because a documented command wrote one file per user
                          run into the tree that ships.
  5  register-published   every fact the register declares -- ceilings,
                          counts, zones, the zone they are measured against,
                          and the document's own top-level keys -- reaches the
                          document the model reads. Family 1 of the
                          architecture gate proves the doc equals the
                          GENERATOR's output; it cannot see a generator that
                          stopped emitting a ceiling, because then both sides
                          agree about nothing. This one reads the REGISTER and
                          the DOCUMENT and compares.

NOTHING HERE KNOWS THE VOCABULARY, on purpose, and family 5 is where that is
hardest to hold: it never lists a block, a field or a number. It walks the
register and asks the document about what it found, so adding a ninth block, a
new top-level key or a retuned ceiling needs no edit in this file.

THE SUITE DOES NOT LIVE INSIDE THE SKILL (#44). Every path below points INTO
skills/panlabs-presentation-builder/ -- the only direction a reference from
here is allowed to travel.
"""
import pathlib
import re
import sys

# Nothing this suite runs may leave bytecode in the tree it measures.
sys.dont_write_bytecode = True

HERE = pathlib.Path(__file__).resolve().parent
SKILL = (HERE / "../../../skills/panlabs-presentation-builder").resolve()
ENGINE = SKILL / "engine"
FRONT = SKILL / "SKILL.md"
DOC = SKILL / "VOCABULARY.md"

sys.path.insert(0, str(ENGINE))

import vocab                                                      # noqa: E402
from register import REGISTER, ZONE_PCT, DOCUMENT                 # noqa: E402

# The command that turns an argument into a page. Named once, here, because
# family 2 is the only rule in this file that has to know WHICH command is the
# one whose position carries meaning.
BUILDER = "build.py"

# Scratch: outside the tree on purpose, and the one prefix a documented
# destination may carry without naming a file that exists.
SCRATCH_PREFIX = "/tmp/"

# A fence declaring a DATA format is data; everything else is a command. It is
# a DENY list and not an allow list because narrowing a rule is the move that
# hides a defect: an unknown language reads as a command, which fails toward
# measuring.
DATA_FENCE = frozenset(("json", "yaml", "yml", "xml", "toml", "csv", "ini"))

# A path-ish token: a run of path characters carrying at least one separator.
PATHISH = re.compile(r"~?/?[\w.<>*~-]+(?:/[\w.<>*~-]+)+")


# --------------------------------------------------------------------------
# reading -- one pass, because two passes disagreeing about where a fence
# starts is how a checker ends up measuring a document nobody wrote
# --------------------------------------------------------------------------
def split(text):
    """(fenced blocks, everything else) in one pass."""
    blocks, prose, open_, lang = [], [], None, ""
    for line in text.split("\n"):
        f = re.match(r"\s*```(\w*)", line)
        if f:
            if open_ is None:
                open_, lang = [], f.group(1).lower()
            else:
                blocks.append((lang, "\n".join(open_)))
                open_, lang = None, ""
            continue
        (prose if open_ is None else open_).append(line)
    if open_ is not None:                    # an unclosed fence is still a block
        blocks.append((lang, "\n".join(open_)))
    return blocks, "\n".join(prose)


def commands(text):
    """Every command the document documents: fenced, plus inline spans that
    read as one. The sibling learned the second half the expensive way -- its
    command table is the document's whole inventory, and a row naming a tool
    that does not exist read as prose."""
    blocks, prose = split(text)
    out = [b for lang, b in blocks if lang not in DATA_FENCE]
    out += [s[1:-1] for s in re.findall(r"`[^`\n]+`", prose)
            if re.match(r"^(python3?|bash|sh|\./)\b", s[1:-1])]
    return out


def tokens(block):
    """Path-ish tokens, scanned rather than split on whitespace: a documented
    one-liner packs its paths inside quotes and parentheses."""
    return PATHISH.findall(re.sub(r"https?://\S+", " ", block))


def heads(md):
    """Every `##` and `###`, each carrying the body that runs to the next one."""
    lines = md.split("\n")
    found = []
    for i, line in enumerate(lines):
        m = re.match(r"^(##|###)\s+(.*)$", line)
        if m:
            found.append(dict(i=i, level=len(m.group(1)), title=m.group(2).strip()))
    for k, h in enumerate(found):
        end = found[k + 1]["i"] if k + 1 < len(found) else len(lines)
        h["body"] = "\n".join(lines[h["i"]:end])
    return found


def turns(md):
    """The `###` headings, each with the `##` it sits under."""
    found = heads(md)
    out = []
    for h in found:
        if h["level"] != 3:
            continue
        parent = next((p["title"] for p in reversed(found)
                       if p["level"] == 2 and p["i"] < h["i"]), None)
        out.append(dict(title=h["title"], parent=parent, body=h["body"]))
    return out


def _front(skill_md):
    return FRONT.read_text(encoding="utf-8") if skill_md is None else skill_md


def _doc(vocab_md):
    return DOC.read_text(encoding="utf-8") if vocab_md is None else vocab_md


# --------------------------------------------------------------------------
# 1 - three turns, one section, each closing on a stated condition
# --------------------------------------------------------------------------
def check_three_turns(skill_md=None, **_):
    ts = turns(_front(skill_md))
    if len(ts) != 3:
        titles = ", ".join(f'"{t["title"]}"' for t in ts) or "none"
        return False, (f"the journey has {len(ts)} turn(s), not 3: {titles} "
                       f"-- fold the extra ones back in, or promote a turn "
                       f"that is missing")
    parents = {t["parent"] for t in ts}
    if len(parents) != 1:
        where = ", ".join(f'"{p}"' for p in sorted(map(str, parents)))
        return False, (f"the three turns are spread over {len(parents)} "
                       f"sections ({where}) -- move them under one section, "
                       f"so the journey reads as one thing")
    silent = [t["title"] for t in ts if "**Fecha quando**" not in t["body"]]
    if silent:
        return False, (f"turn(s) that never say when they close: "
                       f"{', '.join(silent)} -- add a **Fecha quando** line, "
                       f"or the turn ends whenever whoever is reading feels "
                       f"like it")
    return True, (f"three turns under \"{parents.pop()}\", each closing on a "
                  f"stated condition")


# --------------------------------------------------------------------------
# 2 - the artifact comes before the questions
# --------------------------------------------------------------------------
def check_artifact_first(skill_md=None, **_):
    """Premise 11, as a position rather than as a sentence.

    The rule is not "the document promises to show first" -- a promise is
    prose and reworded away. It is "the turn that BUILDS is the first turn",
    which is a fact about where a command sits, and it goes red the moment
    somebody puts a round of questions in front of it.
    """
    ts = turns(_front(skill_md))
    if not ts:
        return False, ("the journey has no turns at all -- there is nothing "
                       "to put the build in. Write the journey first")
    builds = [i for i, t in enumerate(ts)
              if any(BUILDER in c for c in commands(t["body"]))]
    if not builds:
        return False, (f"no turn documents a command running {BUILDER} -- the "
                       f"human never sees a page. Put the build in the first "
                       f"turn")
    if builds[0] != 0:
        asked = ", ".join(f'"{ts[i]["title"]}"' for i in range(builds[0]))
        return False, (f"turn 1 \"{ts[0]['title']}\" builds nothing; the first "
                       f"build is in \"{ts[builds[0]]['title']}\", behind "
                       f"{asked} -- the human answers before seeing anything. "
                       f"Move the build into the first turn")
    return True, (f"turn 1 \"{ts[0]['title']}\" runs {BUILDER}: the human "
                  f"sees a page before answering anything")


# --------------------------------------------------------------------------
# 3 - every path a documented command names exists, inside the skill
# --------------------------------------------------------------------------
def _scan(md):
    """(escapes, dangling) over every documented command."""
    escapes, dangling = [], []
    for cmd in commands(md):
        for t in tokens(cmd):
            if t.startswith(SCRATCH_PREFIX):
                continue
            if re.match(r"^(\.\./|~|/)", t):
                escapes.append(t)
                continue
            if re.search(r"[<>*]", t):        # a placeholder the caller supplies
                continue
            if not (SKILL / t).exists():
                dangling.append(t)
    return sorted(set(escapes)), sorted(set(dangling))


def check_paths_exist(skill_md=None, **_):
    escapes, dangling = _scan(_front(skill_md))
    if escapes:
        return False, (f"command(s) reaching outside the skill: "
                       f"{', '.join(escapes)} -- whoever installs the skill "
                       f"gets the directory and nothing beside it. Write the "
                       f"path from the skill root, or send it to {SCRATCH_PREFIX}")
    if dangling:
        return False, (f"command(s) naming a path that does not exist: "
                       f"{', '.join(dangling)} -- fix the spelling, or add "
                       f"the file. `git mv` moves the bytes and rewrites no "
                       f"line of any document")
    return True, (f"every path the documented commands name resolves inside "
                  f"the skill and exists")


# --------------------------------------------------------------------------
# 4 - nothing a documented command writes lands inside the tree that ships
# --------------------------------------------------------------------------
def _writes(cmd):
    """Where a documented command writes.

    Enumerating write syntax is leaky by nature, so this stays narrow and
    positional instead of clever: a redirect, and the destination of the one
    command in this skill that has a destination. `--write` is folded in
    because the skill's only `--write` regenerates a document INSIDE the tree
    -- it is a maintainer's command, and the front door is not where it goes.
    """
    out = []
    words = [w.strip("`'\"();,") for w in cmd.split()]
    for i, w in enumerate(words):
        if w in (">", ">>") and i + 1 < len(words):
            out.append(words[i + 1])
        m = re.match(r"^>>?(\S+)$", w)
        if m:
            out.append(m.group(1))
    if BUILDER in cmd:
        # The builder's own path is not a destination, and dropping it is what
        # keeps a command-table row (`python3 engine/build.py <arg> <dest>`,
        # whose only real path IS the builder) from reading as a write into
        # the tree it lives in.
        paths = [p for p in tokens(cmd) if BUILDER not in p]
        if paths:
            out.append(paths[-1])             # the destination is the last one
    if "--write" in words:
        out.append("(--write regenerates a document in the tree)")
    return out


def check_writes_outside(skill_md=None, **_):
    inside = []
    for cmd in commands(_front(skill_md)):
        for t in _writes(cmd):
            if t.startswith("("):             # `--write`, already spelled out
                inside.append(t)
            elif t.startswith(SCRATCH_PREFIX):
                continue
            elif re.match(r"^(~|/|\.\./)", t):
                continue                      # the caller's disk, or above the
                #                               root, which is rule 3's business
            elif re.search(r"[<>*]", t):
                continue                      # a destination the caller names
            else:
                inside.append(t)              # relative to the root IS inside
    inside = sorted(set(inside))
    if inside:
        return False, (f"documented write(s) landing inside the skill: "
                       f"{', '.join(inside)} -- the installed tree grows by "
                       f"one file per run, until the weight family fails it. "
                       f"Send it to {SCRATCH_PREFIX} or to a path the caller "
                       f"names")
    return True, "every documented write lands outside the skill tree"


# --------------------------------------------------------------------------
# 5 - the register's numbers reach the document the model reads
# --------------------------------------------------------------------------
def check_register_published(vocab_md=None, **_):
    """Read the REGISTER, then ask the DOCUMENT about what was found.

    Never a list of blocks, fields or numbers: this walks whatever the
    register happens to carry, so a ninth block, a new top-level key or a
    retuned ceiling needs no edit here. What it defends is the half family 1
    of the architecture gate cannot see -- a generator that stopped emitting a
    ceiling regenerates a document that agrees with it perfectly, and both
    sides are then green about a number the model never receives.
    """
    text = _doc(vocab_md)
    if vocab.BEGIN not in text or vocab.END not in text:
        return False, (f"{DOC.name}: the generated block is missing -- run "
                       f"`python3 engine/vocab.py --write`")
    body = text.split(vocab.BEGIN, 1)[1].split(vocab.END, 1)[0]
    rows = [ln for ln in body.split("\n") if ln.lstrip().startswith("|")]

    missing = []
    for name, spec in REGISTER.items():
        mine = [r for r in rows if r.lstrip().startswith(f"| `{name}` |")]
        # Split to WHOLE cells and whole `·`-separated entries, and compare by
        # equality. A substring test would call `note` 180 published by a
        # document that says `note` 1800 -- the one reading of the number that
        # is worse than not publishing it at all.
        cells, entries = set(), set()
        for r in mine:
            for cell in r.split("|"):
                cells.add(cell.strip())
                for entry in cell.split("·"):
                    entries.add(entry.strip())
        for k, v in spec["ceil"].items():
            if f"`{k}` {v}" not in entries:
                missing.append(f"{name}: ceiling `{k}` {v}")
        if str(spec["zones"]) not in cells:
            missing.append(f"{name}: zones {spec['zones']}")
        if spec.get("count") and str(spec["count"]) not in cells:
            missing.append(f"{name}: count {spec['count']}")
    if f"{ZONE_PCT}%" not in body:
        missing.append(f"the reading zone itself ({ZONE_PCT}%), which is the "
                       f"ruler every ceiling above is measured against")
    # The document's own top level. These four were the last names in the
    # vocabulary written by hand beside the generated block, and therefore the
    # only ones nothing compared against anything.
    for k in list(DOCUMENT["fields"]) + list(DOCUMENT["opt"]):
        if f'"{k}"' not in body:
            missing.append(f"the top-level key {k}, which an argument.json "
                           f"carries before any beat")
    if missing:
        return False, (f"the register publishes numbers the model never "
                       f"receives: {'; '.join(missing)} -- make vocab.py emit "
                       f"them, then run `python3 engine/vocab.py --write`")
    n = sum(len(s["ceil"]) for s in REGISTER.values())
    keys = len(DOCUMENT["fields"]) + len(DOCUMENT["opt"])
    return True, (f"every fact the register declares reaches the model: {n} "
                  f"ceilings over {len(REGISTER)} blocks, the {ZONE_PCT}% "
                  f"zone they are measured against, and the {keys} top-level "
                  f"keys")


FAMILIES = [
    ("three-turns", check_three_turns),
    ("artifact-first", check_artifact_first),
    ("paths-exist", check_paths_exist),
    ("writes-outside", check_writes_outside),
    ("register-published", check_register_published),
]

BY_NAME = dict(FAMILIES)


def run(quiet=False, **over):
    """Run every family. Returns the number of reds."""
    bad = 0
    for name, fn in FAMILIES:
        try:
            ok, msg = fn(**over)
        except Exception as e:                                  # noqa: BLE001
            ok, msg = False, f"{type(e).__name__}: {e}"
        bad += not ok
        if not quiet:
            print(f"  {'ok  ' if ok else 'FAIL'} {name:<19} {msg}")
    return bad


def main():
    print("journey:")
    if not FRONT.exists():
        print(f"  FAIL front-door         {FRONT} is not there -- every family "
              f"below reads it, and their verdicts are unavailable, not false")
        return 1
    return run()


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
