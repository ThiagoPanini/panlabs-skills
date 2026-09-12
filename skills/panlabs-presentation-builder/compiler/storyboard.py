"""The storyboard: the deck as a story, written beside the deck as a page.

    /tmp/proposta.html  ->  /tmp/proposta.storyboard.md

WHY IT IS EMITTED AT ALL. #207 puts the storyboard in the first turn, before a
pixel exists, because "estrutura é mais barata de corrigir em texto do que em
slide" -- and the second turn is where that stops being true unless the story
survives the build. Written beside the deck, it is what lets the next ask be
"slide 4 is doing the tension twice" instead of "encurte o slide sete": the
deck's own author gets the arc back in one page, in the same order the room
will hear it.

IT IS GENERATED AND NEVER WRITTEN. Everything here is read out of the source --
the header, the art direction, each slide's pattern, arc function and message --
so there is no second copy of the story to drift from the first. That is also
what makes it reproducible to the byte: no clock, no path, no count that is not
in the source.

THE DOCUMENT IS PORTUGUESE, AND THAT IS THE SAME SEAM THE STAGE SITS ON. The
messages this compiler PRINTS are English (CLAUDE.md § O código é em inglês);
what it AUTHORS for a person to read is not -- the help panel inside every built
deck is Portuguese for exactly this reason, and so are the `purpose=` lines
CATALOG.md publishes. A storyboard is read by whoever is about to present, and
it carries their deck's own words back to them.
"""

import os

from catalog import (ARC_ATTR, ARC_LABEL, CLAIM, DIRECTION_CHOICES,
                     MOMENTS_CHOICE, NAME, SOURCE_EXCERPT, SOURCE_WHAT,
                     SOURCE_WHEN, SOURCE_WHERE, scale_of, slot_specs)
from source import sources_of, texts_of

SUFFIX = ".storyboard.md"


def beside(output_path):
    """Where the storyboard for a built deck goes: beside it, same stem.

    The same shape `gate/render.cjs` gives the contact sheet, and for the same
    reason -- everything one build produces answers to one name, so a directory
    with four decks in it never leaves anyone guessing which sheet belongs to
    which page.
    """
    stem = os.path.splitext(os.path.basename(output_path))[0]
    return os.path.join(os.path.dirname(os.path.abspath(output_path)), stem + SUFFIX)


def message(slide):
    """The line the storyboard prints for one slide: what the slide SAYS.

    THE FIRST SLOT THAT MAKES A POINT, IN THE PATTERN'S OWN READING ORDER. Most
    patterns carry exactly one CLAIM slot and it is the obvious answer; the two
    that need the fallback are the whole reason this is a rule rather than a
    field per pattern. A section divider has no claim at all -- its biggest text
    is a NAME, and naming the next act is the divider doing its job -- and a
    figure that gave up its optional title says what it shows in the caption
    instead. Falling back in that order gets every pattern right, and adds
    nothing to the register that would have to be kept in step with the slots
    beside it.
    """
    pattern = slide.attrs.get("pattern", "")
    said = texts_of(slide)
    for role in (CLAIM, NAME):
        for slot in slot_specs(pattern):
            if slot.role == role and said.get(slot.name):
                return said[slot.name]
    for slot in slot_specs(pattern):
        if said.get(slot.name):
            return said[slot.name]
    return ""


def cell(text):
    """One table cell: a pipe in the words would end the column early."""
    return text.replace("|", "\\|")


def render(deck, theme, moments):
    """The whole storyboard, as Markdown, for one deck in one theme.

    `moments` is the list of slide numbers the audit counted as peaks, passed in
    rather than recounted: the ruler and this page disagreeing about how many a
    deck holds is the exact class of two-ended contract this skill refuses
    everywhere else.
    """
    # THE HEADER IS ALREADY WHOLE BY THE TIME THIS RUNS. `build.py` refuses a
    # `<deck>` missing any of DECK_FIELDS before a ruler has read a slide, so
    # this line reads them straight rather than guarding each one -- a default
    # here would be a default nobody could ever reach, and reading as if one
    # were possible is how a promise stops being visible in the code.
    header = deck.header
    lines = [
        f"# {deck.title}",
        "",
        f"{header['occasion']} · tema `{theme}` · {header['lang']} · "
        f"{header['minutes']} min · movimento `{header['motion']}`",
        "",
        "## Direção de arte",
        "",
        "| | |",
        "| --- | --- |",
    ]

    said = texts_of(deck.direction) if deck.direction is not None else {}
    for choice in DIRECTION_CHOICES:
        value = said.get(choice.name, "")
        if not value:
            continue
        # A NAME IS SET AS CODE AND A SENTENCE IS NOT. `Choice.options` is the
        # register's own answer to which of the two a choice is, so the day a
        # choice stops being drawn from a closed set this page follows without
        # being told.
        printed = f"`{value}`" if choice.options else cell(value)
        if choice.name == MOMENTS_CHOICE:
            # THE RANGE IS THE REGISTER'S TO WRITE, not this page's. `Scale.span`
            # is the one place it is spelled in Portuguese, and CATALOG.md's own
            # table of scales prints the same property -- the reference and the
            # storyboard saying a range two different ways would be two ends of
            # one contract, over a string a reader compares by eye.
            scale = scale_of(value)
            if scale:
                printed += f" — {scale.span}, e este deck tem {len(moments)}"
        lines.append(f"| {choice.label} | {printed} |")

    lines += [
        "",
        "## Storyboard",
        "",
        "| # | função | padrão | mensagem |",
        "| --- | --- | --- | --- |",
    ]
    for n, slide in enumerate(deck.sections, start=1):
        pattern = slide.attrs.get("pattern", "")
        arc = slide.attrs.get(ARC_ATTR, "").strip()
        shape = f"`{pattern}`" + (" · momento" if n in moments else "")
        # SUBSCRIPTED, NOT `.get`, FOR THE SAME REASON THE HEADER IS READ
        # STRAIGHT. The vocabulary ruler refuses a `<section>` whose `arc=` is
        # missing or is not one of the six, so by the time this runs every slide
        # has a label. A fallback here would print the English identifier into a
        # Portuguese table and call it a row -- silence where a KeyError would
        # have named a broken check.
        lines.append(
            f"| {n} | {ARC_LABEL[arc]} | {shape} | {cell(message(slide))} |"
        )

    # THE PROVENANCE, LAST, AND ONLY WHEN THERE IS ONE (#238). The storyboard is
    # what whoever is about to present reads before they stand up, and the one
    # question a room asks that no slide can answer alone is "how old is that
    # number" -- the stage prints two of a source's four fields, and this is the
    # only page that publishes all four. It goes at the END because it is
    # reference and not story: a reader following the arc should reach the closing
    # before they reach a bibliography.
    #
    # THE EXCERPT IS NOT A COLUMN. It is a literal paragraph -- ninety words
    # where the other three fields are five -- and a fifth column holding one
    # would make every row of the table unreadable to publish a field that is
    # usually absent. It goes under the table, for the sources that have one.
    said = sources_of(deck)
    if said:
        lines += [
            "",
            "## Fontes",
            "",
            "| id | o que é | onde | quando |",
            "| --- | --- | --- | --- |",
        ]
        for key, fields in said.items():
            lines.append(
                f"| `{key}` | {cell(fields.get(SOURCE_WHAT, ''))} "
                f"| {cell(fields.get(SOURCE_WHERE, ''))} "
                f"| {cell(fields.get(SOURCE_WHEN, ''))} |"
            )
        quoted = [(key, fields[SOURCE_EXCERPT]) for key, fields in said.items()
                  if fields.get(SOURCE_EXCERPT)]
        if quoted:
            lines += ["", "E o trecho literal, onde alguma citação do deck sai "
                          "de um:", ""]
            for key, excerpt in quoted:
                lines.append(f"- `{key}` — «{excerpt}»")

    lines.append("")
    return "\n".join(lines)


def write(path, deck, theme, moments):
    """Put the storyboard beside the deck, and say where it went."""
    where = beside(path)
    with open(where, "w", encoding="utf-8") as fh:
        fh.write(render(deck, theme, moments))
    return where
