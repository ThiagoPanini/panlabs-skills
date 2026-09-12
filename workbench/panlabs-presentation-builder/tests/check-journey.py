#!/usr/bin/env python3
"""THE FRONT DOOR, MEASURED AGAINST ITS OWN DOCUMENTS. Eight families.

    workbench/panlabs-presentation-builder/tests/check-journey.py

`SKILL.md` is the only file the runtime reads to decide whether the skill
applies, the only file every ticket edits, and -- until this one existed in the
v2 -- the only file in this tree nothing verified. The parallel-workflow
doctrine says so after measuring two branches that both rewrote a `SKILL.md`
and merged green without either author reading the result.

WHAT IS MECHANICAL IS HERE; THE REST IS PROSE, AND PROSE IS READ BY A HUMAN. A
checker that grepped for sentences would go red on the first rewording and
teach everyone to edit around it. What these eight read is POSITION and the
REGISTER: where a turn sits, which turn runs the builder IN WHICH MODE, what
names the catalog holds. Reword any paragraph in the document and every one of
them stays green.

  1  four-turns           exactly four turns, all under one section, each
                          closing on a stated condition. #237 put a survey in
                          front of #207's three; seven steps each carrying its
                          own gate is the shape a journey grows into one
                          heading at a time.
  2  calibration-first    ONE turn decides EVERY name a source's header holds
                          -- walked out of `compiler/catalog.py`, never listed
                          here -- and the deck is built LATER. This is #207's
                          "calibragem antes de gerar" made falsifiable from
                          both ends: cut the round out of the document and the
                          first half goes red; move the build up in front of
                          it and the second does. It reads the round's
                          POSITION rather than its number, because #237 put a
                          turn in front of it without moving it.
  3  storyboard-first     the storyboard is proposed before the deck is built.
                          #207 asks for the story to arrive "antes de existir
                          um pixel" because structure is cheaper to fix in
                          text than in slides; a document that first names it
                          in the turn that BUILDS has quietly turned it into a
                          by-product of the deck.
  4  paths-exist          every concrete path a documented command names
                          resolves inside the skill and exists.
                          `scripts/checks/references.sh` excludes code fences
                          BY DESIGN, so a command's ARGUMENTS are measured
                          here or nowhere.
  5  writes-outside       no documented command writes inside the skill tree.
                          The sibling's package reached 29 of its 30 MB
                          because a documented command wrote one file per user
                          run into the tree that ships, and #207 asks for the
                          source and the storyboard to land "no projeto de
                          quem chamou" for exactly that reason.
  6  register-published   every fact the register declares -- every pattern,
                          its budget, its slots and its group's fields, the
                          absolute ceiling, the header's own fields, the arc
                          functions, the art direction's choices, the scales of
                          moments and the titles that refuse -- reaches
                          `CATALOG.md`, the document the model actually reads.
                          Layer 3's `catalog.py --check` proves the document
                          equals the GENERATOR's output; it cannot see a
                          generator that stopped emitting a budget, because
                          then both sides agree about nothing. This one reads
                          the REGISTER and the DOCUMENT and compares.
  7  survey-first         the journey opens on the survey: the FIRST turn maps
                          the material onto EVERY arc function the register
                          declares, it names the extractor, and it sits ahead
                          of the round. #237's diagnosis is that a deck fails
                          on what nobody went looking for -- a thesis with no
                          evidence, an audience nobody asked about -- and a
                          survey that runs AFTER the header is decided is a
                          survey whose findings arrive too late to change
                          anything. The six rows come out of
                          `catalog.ARC_FUNCTIONS`, so a seventh function
                          tomorrow is one more row with no edit here.
  8  modes-in-their-turns each of the builder's three modes sits in the turn
                          that can act on what it makes. #239 made the
                          skeleton and the article MODES of `build.py`, which
                          is what stopped "which turn builds" from being a
                          question about a filename: the skeleton is a
                          rehearsal and belongs BEFORE the deck, where a
                          rhythm still costs a row to fix; the article is
                          written FROM a deck and cannot precede one. A
                          document that offers the article in the turn that
                          builds is offering it before anyone has seen the
                          deck.

NOTHING HERE KNOWS THE VOCABULARY, on purpose, and family 6 is where that is
hardest to hold: it never lists a pattern, a slot or a number. It walks the
register and asks the document about what it found, so a nineteenth pattern, a
fourth scale or a retuned budget needs no edit in this file.

THE SUITE DOES NOT LIVE INSIDE THE SKILL (#44). Every path below points INTO
skills/panlabs-presentation-builder/ -- the only direction a reference from
here is allowed to travel.
"""
import importlib.util
import pathlib
import re
import sys

# Nothing this suite runs may leave bytecode in the tree it measures.
sys.dont_write_bytecode = True

HERE = pathlib.Path(__file__).resolve().parent
SKILL = (HERE / "../../../skills/panlabs-presentation-builder").resolve()
COMPILER = SKILL / "compiler"
FRONT = SKILL / "SKILL.md"
DOC = SKILL / "CATALOG.md"

# THE REGISTER, LOADED BY PATH RATHER THAN BY `import`. Putting `compiler/` on
# `sys.path` would let a sibling's own imports drag half the compiler in behind
# it; one file, by location, is the whole of what family 6 needs.
_spec = importlib.util.spec_from_file_location("catalog", COMPILER / "catalog.py")
catalog = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(catalog)

# The command that turns a source into a deck. Named once, here, because family
# 2 is the only rule in this file that has to know WHICH command is the one
# whose position carries meaning.
BUILDER = "build.py"

# The artifact family 3 is about, asked of the tree rather than spelled out: the
# generator is `compiler/storyboard.py`, so the noun the document has to use for
# what it writes is that file's own name. Rename the generator and the document
# has to follow, which is the point.
STORYBOARD = (COMPILER / "storyboard.py").stem

# THE TWO MODES #239 GREW, ASKED OF THE TREE THE SAME WAY. Each is a module
# beside the builder, and the flag that turns it on is that module's own name
# -- `compiler/skeleton.py` is reached as `--skeleton`. Rename the module and
# the document has to follow, which is the point; spelling the flags here as
# literals would let a renamed mode keep a green.
SKELETON = (COMPILER / "skeleton.py").stem
ARTICLE = (COMPILER / "article.py").stem
MODE_FLAGS = (f"--{SKELETON}", f"--{ARTICLE}")

# The tool every subagent of the survey runs, by its path inside the skill:
# family 7 asks the FIRST turn to name it, and family 4 then proves the name
# resolves. Two families, one file, and neither spells the other's rule.
EXTRACTOR = SKILL / "tools" / "extract.py"

# Scratch: outside the tree on purpose, and the one prefix a documented
# destination may carry without naming a file that exists.
SCRATCH_PREFIX = "/tmp/"

# A fence declaring a DATA format is data; everything else is a command. It is
# a DENY list and not an allow list because narrowing a rule is the move that
# hides a defect: an unknown language reads as a command, which fails toward
# measuring.
DATA_FENCE = frozenset(("json", "yaml", "yml", "xml", "toml", "csv", "ini",
                        "html", "markdown", "md", "css", "svg", "text"))

# A path-ish token: a run of path characters carrying at least one separator.
PATHISH = re.compile(r"~?/?[\w.<>*~-]+(?:/[\w.<>*~-]+)+")

# How a turn says it is over. Prose, and the one phrase in this file that is:
# "when does this turn end" has no position and no register to read it out of,
# and a turn that never answers it ends whenever the reader feels like it.
CLOSES = "**Fecha quando**"

# NOT A PATH, AND NEVER WAS ONE. `_writes()` returns destinations, and the
# skill's only `--write` has no destination to return -- it regenerates a
# document in the tree by name. Carrying it as a named constant, compared for
# equality, is what keeps `check_writes_outside` from asking "does this path
# start with a parenthesis", which is a question about punctuation standing in
# for a question about kind.
REGENERATES = "(--write regenerates a document in the tree)"


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
            if re.match(r"^(python3?|bash|sh|node|\./)\b", s[1:-1])]
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


def sections(md):
    """Every `##`, with the `###` that sit under it before the next one."""
    found = heads(md)
    out = []
    for k, h in enumerate(found):
        if h["level"] != 2:
            continue
        kids = []
        for p in found[k + 1:]:
            if p["level"] == 2:
                break
            kids.append(p)
        out.append(dict(title=h["title"], kids=kids))
    return out


def turns(md):
    """The `###` of every section that documents a journey.

    A SECTION IS A JOURNEY'S WHEN SOMETHING UNDER IT SAYS WHEN IT CLOSES, and
    the alternative is worse in a way that only shows up later: counting every
    `###` in the document makes an unrelated subsection anywhere in the file --
    under the theme, under the gate -- read as a fourth turn, and hands its
    author a fix ("fold the extra ones back in") aimed at a heading that was
    never a turn.

    A TURN THAT LOST ITS OWN LINE IS STILL A TURN. What identifies the SECTION
    is that something in it closes; every `###` inside is then counted, so the
    count stays right and family 1 can still name the missing line as the fix
    rather than reporting two turns where there are three.
    """
    out = []
    for s in sections(md):
        kids = [k for k in s["kids"] if k["level"] == 3]
        if not any(CLOSES in k["body"] for k in kids):
            continue
        for k in kids:
            out.append(dict(title=k["title"], parent=s["title"],
                            body=k["body"]))
    return out


def _builds(ts, mode=None):
    """Indices of the turns documenting a `build.py` run in one mode.

    `mode=None` MEANS THE DECK: the invocation carrying no mode flag at all.
    Before #239 "which turn builds" was a question about a filename; now a turn
    can run the builder and produce no deck -- the skeleton is a rehearsal and
    the article is a write-up -- so three families would each go red at the
    wrong turn if they kept asking whether the line says `build.py`.
    """
    out = []
    for i, t in enumerate(ts):
        for c in commands(t["body"]):
            if BUILDER not in c:
                continue
            flags = [f for f in MODE_FLAGS if f in c]
            if mode in flags if mode else not flags:
                out.append(i)
                break
    return out


def _round_at(ts):
    """(index of the turn that decides most of the header, what it leaves open).

    THE ROUND IS FOUND BY WHAT IT DECIDES, NOT BY ITS NUMBER, and that is what
    survived #240 unedited: a turn went in FRONT of the calibration without the
    calibration moving, and a family holding "turn 1 carries the round" as a
    position would have gone red at a document that lost nothing.
    """
    if not ts:
        return None, []
    names = _header_names()
    scored = [sum(1 for f in names if f"`{f}`" in t["body"]) for t in ts]
    at = max(range(len(ts)), key=lambda i: scored[i])
    return at, [f for f in names if f"`{f}`" not in ts[at]["body"]]


def _front(skill_md):
    return FRONT.read_text(encoding="utf-8") if skill_md is None else skill_md


def _doc(catalog_md):
    return DOC.read_text(encoding="utf-8") if catalog_md is None else catalog_md


# --------------------------------------------------------------------------
# 1 - four turns, one section, each closing on a stated condition
# --------------------------------------------------------------------------
TURNS = 4


def check_four_turns(skill_md=None, **_):
    ts = turns(_front(skill_md))
    if len(ts) != TURNS:
        titles = ", ".join(f'"{t["title"]}"' for t in ts) or "none"
        return False, (f"the journey has {len(ts)} turn(s), not {TURNS}: "
                       f"{titles} -- fold the extra ones back in, or promote a "
                       f"turn that is missing")
    parents = {t["parent"] for t in ts}
    if len(parents) != 1:
        where = ", ".join(f'"{p}"' for p in sorted(map(str, parents)))
        return False, (f"the {TURNS} turns are spread over {len(parents)} "
                       f"sections ({where}) -- move them under one section, "
                       f"so the journey reads as one thing")
    silent = [t["title"] for t in ts if CLOSES not in t["body"]]
    if silent:
        return False, (f"turn(s) that never say when they close: "
                       f"{', '.join(silent)} -- add a {CLOSES} line, or the "
                       f"turn ends whenever whoever is reading feels like it")
    return True, (f"{TURNS} turns under \"{parents.pop()}\", each closing on a "
                  f"stated condition")


# --------------------------------------------------------------------------
# 2 - the round comes first, and it decides the whole header
# --------------------------------------------------------------------------
def _header_names():
    """Every name a source's header can hold, straight out of the register.

    The `<deck>` fields and EVERY art-direction choice are what has to be
    decided before a single slide can be written -- which is what makes them
    the round's subject rather than a list somebody chose. A tenth choice
    tomorrow is one more thing turn 1 has to name, with no edit here.

    EVERY CHOICE, NOT ONLY `DIRECTION_REQUIRED`, AND THE TWO COLOURS ARE WHY.
    The theme lends up to two content colours and a deck that paints in ink and
    accent alone declares neither, so the register marks them optional -- and a
    document that never names them is a document whose round never offers them.
    #207 asks for the proposed art direction to carry "cores de conteúdo" by
    name, and every deck that reads the colour by itself from the first slide to
    the last starts with someone being asked what it means.
    """
    return tuple(catalog.DECK_FIELDS) + tuple(catalog.choice_names())


def check_calibration_first(skill_md=None, **_):
    ts = turns(_front(skill_md))
    if not ts:
        return False, ("the journey has no turns at all -- there is nothing "
                       "to put the round in. Write the journey first")

    at, undecided = _round_at(ts)
    if undecided:
        return False, (f"no turn decides the whole header -- "
                       f"\"{ts[at]['title']}\" comes closest and still leaves "
                       f"{', '.join(undecided)} open. The header of a source "
                       f"settles them before a slide exists, so a round that "
                       f"never raises one leaves it to the accident of "
                       f"whoever writes the source. Name each in the round, "
                       f"and say what the recommendation defaults to")

    builds = _builds(ts)
    if not builds:
        return False, (f"no turn documents a command running {BUILDER} into a "
                       f"deck -- the round is answered and nothing is ever "
                       f"built. Put the build in a turn after the round")
    if builds[0] <= at:
        return False, (f"\"{ts[builds[0]]['title']}\" builds the deck, and the "
                       f"round is answered in \"{ts[at]['title']}\" -- the deck "
                       f"exists before the round is answered, and every "
                       f"question after it costs a rebuild. Move the build "
                       f"into a later turn")
    return True, (f"\"{ts[at]['title']}\" decides all {len(_header_names())} "
                  f"names a header holds, and the deck is first built in "
                  f"\"{ts[builds[0]]['title']}\"")


# --------------------------------------------------------------------------
# 3 - the story arrives before the pixels
# --------------------------------------------------------------------------
def check_storyboard_first(skill_md=None, **_):
    ts = turns(_front(skill_md))
    if not ts:
        return False, ("the journey has no turns at all -- there is nothing "
                       "to propose a storyboard in. Write the journey first")
    named = [i for i, t in enumerate(ts) if STORYBOARD in t["body"].lower()]
    if not named:
        return False, (f"no turn proposes a {STORYBOARD} -- the reader corrects "
                       f"the story by reading slides. Propose it in turn 1, "
                       f"one line per slide")
    # THE TURN THAT PROPOSES IS THE TURN THAT CALIBRATES, and asking it that
    # way rather than by position is what #240 had to buy: the survey went in
    # front, and its table of inputs names the storyboard IN PASSING -- "a
    # source from an earlier session already carries it". A family reading
    # "the first turn that says the word" called that the proposal and went
    # green over a document whose calibration had lost it.
    at, _u = _round_at(ts)
    if at not in named:
        return False, (f"\"{ts[at]['title']}\" decides the header and never "
                       f"names the {STORYBOARD} -- the round settles what the "
                       f"deck looks like and leaves what it SAYS to whoever "
                       f"writes the source. Move the proposal into turn 1, "
                       f"beside the round, one line per slide")
    builds = _builds(ts)
    if builds and named[0] >= builds[0]:
        return False, (f"the {STORYBOARD} first appears in "
                       f"\"{ts[named[0]]['title']}\", once the deck already "
                       f"exists -- move the proposal into turn 1, where the "
                       f"story is still a paragraph and not a rebuild")
    return True, (f"\"{ts[at]['title']}\" proposes the {STORYBOARD}, "
                  f"before anything is built")


# --------------------------------------------------------------------------
# 4 - every path a documented command names exists, inside the skill
# --------------------------------------------------------------------------
def _scan(md):
    """(escapes, dangling) over every documented command."""
    escapes, dangling = [], []
    for cmd in commands(md):
        for t in tokens(cmd):
            if t.startswith(SCRATCH_PREFIX):
                continue
            if re.search(r"[<>*]", t):        # a placeholder the caller supplies
                continue
            if re.match(r"^(\.\./|~|/)", t):
                escapes.append(t)
                continue
            if not (SKILL / t).exists():
                dangling.append(t)
    return sorted(set(escapes)), sorted(set(dangling))


def _nothing_to_measure(md, what):
    """The red a family owes when the document documents no command at all.

    BOTH COMMAND FAMILIES ARE VACUOUSLY GREEN WITHOUT IT. Strip every fence and
    every inline command from the front door and `commands()` returns nothing,
    so "no path dangles" and "no write lands inside" are both true about a
    document that names no command to be wrong about. It is the same assertion
    the proofs beside this file make with their `coverage` line: a check that
    measured nothing has to say so rather than report the green.
    """
    if commands(md):
        return None
    return (False, f"the front door documents no command at all, so {what} "
                   f"measured nothing -- a green here would be about a document "
                   f"with nothing to be wrong about. Restore the build command")


def check_paths_exist(skill_md=None, **_):
    md = _front(skill_md)
    empty = _nothing_to_measure(md, "the paths a command names")
    if empty:
        return empty
    escapes, dangling = _scan(md)
    if escapes:
        return False, (f"command(s) reaching outside the skill: "
                       f"{', '.join(escapes)} -- whoever installs the skill "
                       f"gets the directory and nothing beside it. Write the "
                       f"path from the skill root, or send it to "
                       f"{SCRATCH_PREFIX}")
    if dangling:
        return False, (f"command(s) naming a path that does not exist: "
                       f"{', '.join(dangling)} -- fix the spelling, or add "
                       f"the file. A rename moves the bytes and rewrites no "
                       f"line of any document")
    return True, (f"every path the {len(commands(md))} documented commands "
                  f"name resolves inside the skill and exists")


# --------------------------------------------------------------------------
# 5 - nothing a documented command writes lands inside the tree that ships
# --------------------------------------------------------------------------
def _writes(cmd):
    """Where a documented command writes.

    Enumerating write syntax is leaky by nature, so this stays narrow and
    positional instead of clever: a redirect, the destination of the one
    command in this skill that has a destination, and `--out`, which is how the
    render gate names where the contact sheet lands. `--write` is folded in
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
        if w == "--out" and i + 1 < len(words):
            out.append(words[i + 1])
    if BUILDER in cmd:
        # The builder's own path is not a destination, and dropping it is what
        # keeps a command-table row (`python3 compiler/build.py <src> <dest>`,
        # whose only real path IS the builder) from reading as a write into
        # the tree it lives in.
        paths = [p for p in tokens(cmd) if BUILDER not in p]
        if paths:
            out.append(paths[-1])             # the destination is the last one
    if "--write" in words:
        out.append(REGENERATES)
    return out


def check_writes_outside(skill_md=None, **_):
    md = _front(skill_md)
    empty = _nothing_to_measure(md, "where a command writes")
    if empty:
        return empty
    inside = []
    for cmd in commands(md):
        for t in _writes(cmd):
            if t == REGENERATES:               # not a path, and never was one
                inside.append(t)
            elif t.startswith(SCRATCH_PREFIX):
                continue
            elif re.search(r"[<>*]", t):
                continue                      # a destination the caller names
            elif re.match(r"^(~|/|\.\./)", t):
                continue                      # the caller's disk, or above the
                #                               root, which is rule 4's business
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
# 6 - the register's facts reach the document the model reads
# --------------------------------------------------------------------------
def _sections(text):
    """The document's `###` sections, by the backticked name in the heading.

    A pattern's budget and its slots are held against ITS OWN section rather
    than against the whole page, so a document that published one pattern's 30
    and dropped another's cannot be green because the number 30 appears
    somewhere.
    """
    out, name, body = {}, None, []
    for line in text.split("\n"):
        m = re.match(r"^###\s+`([^`]+)`", line)
        if m:
            if name:
                out[name] = "\n".join(body)
            name, body = m.group(1), [line]
        elif name:
            body.append(line)
    if name:
        out[name] = "\n".join(body)
    return out


def _has_number(text, n):
    """A number, with no digit on either side of it.

    A SUBSTRING TEST WOULD CALL A BUDGET OF 12 PUBLISHED BY A DOCUMENT THAT
    SAYS 120, which is the one reading of a number that is worse than not
    publishing it at all.
    """
    return re.search(rf"(?<!\d){re.escape(str(n))}(?!\d)", text) is not None


def check_register_published(catalog_md=None, **_):
    """Read the REGISTER, then ask the DOCUMENT about what was found.

    Never a list of patterns, slots or numbers: this walks whatever the
    register happens to carry, so a nineteenth pattern, a fourth scale of
    moments or a retuned budget needs no edit here. What it defends is the half
    layer 3 cannot see -- a generator that stopped emitting a budget
    regenerates a document that agrees with it perfectly, and both sides are
    then green about a number the model never receives.

    A NAME IS ASKED FOR IN BACKTICKS AND A NUMBER WITH NO DIGIT BESIDE IT. The
    backticks are what keep `cover` from being answered by `cover-headline`,
    and the digits are what keep a budget of 12 from being answered by 120.
    """
    text = _doc(catalog_md)
    sections = _sections(text)
    missing = []

    for name, p in catalog.PATTERNS.items():
        body = sections.get(name)
        if body is None:
            missing.append(f"the pattern `{name}`, which has no section at all")
            continue
        if not _has_number(body, p.budget):
            missing.append(f"`{name}`: the budget of {p.budget} words")
        for s in p.slots:
            if f"`{s.name}`" not in body:
                missing.append(f"`{name}`: the slot `{s.name}`")
        if p.group:
            for f in p.group.fields:
                if f"`{f.name}`" not in body:
                    missing.append(f"`{name}`: the group field `{f.name}`")

    for name in (tuple(catalog.DECK_FIELDS)
                 + tuple(catalog.ARC_FUNCTIONS)
                 + tuple(catalog.choice_names())
                 + tuple(catalog.MOTION_PROFILES)):
        if f"`{name}`" not in text:
            missing.append(f"the name `{name}`")

    for s in catalog.MOMENT_SCALES:
        if f"`{s.name}`" not in text:
            missing.append(f"the scale of moments `{s.name}`")
        elif s.span not in text:
            missing.append(f"`{s.name}`: the count it admits ({s.span})")

    for t in catalog.CATEGORY_TITLES:
        if t not in text:
            missing.append(f"the title that refuses «{t}»")

    # THE PROVENANCE BLOCK IS PART OF THE HEADER AND NOT PART OF A PATTERN
    # (#238), so the walk over `PATTERNS` above cannot reach it -- and a model
    # that never receives the field names cannot write a block the compiler
    # accepts. The elision is here for the same reason: it is the one piece of
    # punctuation in this dialect that CHANGES a verdict, and a model that has
    # not been told the mark exists writes a quotation that gets refused.
    if f"`<{catalog.SOURCES_TAG}>`" not in text:
        missing.append(f"the provenance block `<{catalog.SOURCES_TAG}>`")
    for f in catalog.SOURCES_SPEC.fields:
        if f"`{f.name}`" not in text:
            missing.append(f"the provenance field `{f.name}`")
    if f"`{catalog.SOURCES_SPEC.elision}`" not in text:
        missing.append(f"the elision mark `{catalog.SOURCES_SPEC.elision}`, "
                       "which is how a quotation says it left words out")

    if not _has_number(text, catalog.ABSOLUTE_BUDGET):
        missing.append(f"the absolute ceiling of {catalog.ABSOLUTE_BUDGET} "
                       f"words, which no pattern may pass")

    if missing:
        return False, (f"the register holds {len(missing)} fact(s) the model "
                       f"never receives: {'; '.join(missing[:6])}"
                       f"{'; …' if len(missing) > 6 else ''} -- make "
                       f"`reference()` in compiler/catalog.py emit them, then "
                       f"run `python3 compiler/catalog.py --write`")

    slots = sum(len(p.slots) for p in catalog.PATTERNS.values())
    return True, (f"every fact the register declares reaches the model: "
                  f"{len(catalog.PATTERNS)} patterns with their budgets and "
                  f"{slots} slots, {len(catalog.ARC_FUNCTIONS)} arc functions, "
                  f"{len(catalog.choice_names())} art-direction choices, "
                  f"{len(catalog.MOMENT_SCALES)} scales of moments and the "
                  f"{len(catalog.SOURCES_SPEC.fields)} fields of a source")


# --------------------------------------------------------------------------
# 7 - the journey opens on the survey, and the survey covers the whole arc
# --------------------------------------------------------------------------
def check_survey_first(skill_md=None, **_):
    ts = turns(_front(skill_md))
    if not ts:
        return False, ("the journey has no turns at all -- there is nothing "
                       "to survey the material in. Write the journey first")

    arc = tuple(catalog.ARC_FUNCTIONS)
    mapped = [i for i, t in enumerate(ts)
              if all(f"`{a}`" in t["body"] for a in arc)]
    if not mapped:
        scored = [sum(1 for a in arc if f"`{a}`" in t["body"]) for t in ts]
        best = max(range(len(ts)), key=lambda i: scored[i])
        missing = [a for a in arc if f"`{a}`" not in ts[best]["body"]]
        return False, (f"no turn maps the material onto the arc -- "
                       f"\"{ts[best]['title']}\" comes closest and never "
                       f"names {', '.join(missing)}. A deck fails on the "
                       f"function nobody went looking for, so the survey is a "
                       f"row per function: give each one what the material "
                       f"already has, what is missing, and what the skill "
                       f"does about it")
    if mapped[0] != 0:
        return False, (f"the material is first mapped onto the arc in "
                       f"\"{ts[mapped[0]]['title']}\", and the journey opens "
                       f"on \"{ts[0]['title']}\" -- a survey whose findings "
                       f"arrive after the deck is calibrated is a survey that "
                       f"cannot change anything. Put the survey first")

    survey = ts[0]
    if EXTRACTOR.name not in survey["body"]:
        return False, (f"\"{survey['title']}\" maps the arc but never names "
                       f"{EXTRACTOR.name} -- the material is read by "
                       f"subagents that write the provenance as they read, "
                       f"and a survey that never runs the extractor hands the "
                       f"main context the raw sources it exists to keep out. "
                       f"Name the extractor in the survey")

    at, _u = _round_at(ts)
    if at == 0:
        return False, (f"\"{survey['title']}\" both surveys the material and "
                       f"decides the header -- the survey exists to find what "
                       f"the round then asks about, and folding them into one "
                       f"turn asks the questions before the answers are in. "
                       f"Split the round into a later turn")
    return True, (f"\"{survey['title']}\" opens the journey, maps the "
                  f"material onto all {len(arc)} arc functions with "
                  f"{EXTRACTOR.name}, and the round follows in "
                  f"\"{ts[at]['title']}\"")


# --------------------------------------------------------------------------
# 8 - every mode of the builder in the turn that can act on what it makes
# --------------------------------------------------------------------------
def check_modes_in_their_turns(skill_md=None, **_):
    ts = turns(_front(skill_md))
    deck = _builds(ts)
    if not deck:
        return False, (f"no turn runs {BUILDER} into a deck -- the two other "
                       f"modes are rehearsals of a deck that is never built. "
                       f"Restore the build command")

    for mode, side in ((SKELETON, "before"), (ARTICLE, "after")):
        at = _builds(ts, f"--{mode}")
        if not at:
            return False, (f"no turn runs {BUILDER} --{mode} -- it is a mode "
                           f"of the same command and nothing in the journey "
                           f"reaches it, so it ships unreachable. Offer the "
                           f"{mode} in the turn {side} the deck is built")
        ok = at[0] < deck[0] if side == "before" else at[-1] > deck[0]
        if not ok:
            where = ts[at[0] if side == "before" else at[-1]]["title"]
            why = ("a rehearsal shown once the deck exists is a rehearsal of "
                   "nothing -- the rhythm it would have cost a row to fix now "
                   "costs the deck"
                   if side == "before" else
                   "an article is written FROM a deck, so offering it before "
                   "one exists offers a write-up of slides nobody has seen")
            return False, (f"{BUILDER} --{mode} sits in \"{where}\", and the "
                           f"deck is built in \"{ts[deck[0]]['title']}\" -- "
                           f"{why}. Move --{mode} to the turn {side} the "
                           f"build")

    return True, (f"the {BUILDER} modes land in order: --{SKELETON} in "
                  f"\"{ts[_builds(ts, f'--{SKELETON}')[0]]['title']}\", the "
                  f"deck in \"{ts[deck[0]]['title']}\", --{ARTICLE} in "
                  f"\"{ts[_builds(ts, f'--{ARTICLE}')[-1]]['title']}\"")


FAMILIES = [
    ("four-turns", check_four_turns),
    ("calibration-first", check_calibration_first),
    ("storyboard-first", check_storyboard_first),
    ("paths-exist", check_paths_exist),
    ("writes-outside", check_writes_outside),
    ("register-published", check_register_published),
    ("survey-first", check_survey_first),
    ("modes-in-their-turns", check_modes_in_their_turns),
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
            print(f"  {'ok  ' if ok else 'FAIL'} {name:<20} {msg}")
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
