"""The skeleton: a plan in, a source in the dialect out -- form without content.

    /tmp/proposta.storyboard.md  ->  a <deck> whose every slide is a placeholder

WHY IT EXISTS. #237's diagnosis of the v2 is that "a calibragem é texto, e o
dono decide olhando": the first turn proposes a table, and the form and the
rhythm of the deck only become visible in the second, where correcting them
costs the deck. A skeleton closes that gap -- the very rows the calibration
proposed, painted, with a contact sheet beside them, before a sentence of
content exists. What it shows is composition and pace: which slide holds the
stage alone, where the breath falls, whether nine slides in twenty minutes
reads as a story or as a stack.

IT WRITES A SOURCE AND NOTHING ELSE, which is the whole of why it is thirty
lines of mapping rather than a second compiler. Everything downstream -- the
dialect ruler, the stage, the theme, the render gate -- is the one that already
exists, so a skeleton cannot drift from the deck it is a rehearsal for. The one
thing `compiler/build.py` does differently for it is the audit: only the
DIALECT ruler is charged (#239's "só a régua do dialeto vale nele; nenhuma
régua de doutrina é cobrada"), because a placeholder is supposed to be over
budget, to name a folder and to repeat a shape -- the doctrine measures
CONTENT, and there is none here yet.

EVERY PLACEHOLDER SAYS IT IS ONE. A skeleton that read like a deck is a
skeleton somebody would send; every string it writes opens with the word
`amostra` and names the slot it is standing in, which is also the most useful
thing a reader of a contact sheet can be told -- "this is where `column-b`
goes" is exactly the question a form and a rhythm are judged by.

ONE PLACEHOLDER PER ROLE, NEVER ONE PER PATTERN. `Slot.role` is the register's
own answer to what a slot IS -- a claim, a name, a number, prose, furniture, an
icon -- so the nineteenth pattern gets its placeholders without a line being
added here. The same rule one level down covers a group's fields, and the three
shapes of evidence (a group, a table, a figure) are asked of the register too.

IT IS DETERMINISTIC BYTE FOR BYTE, like the deck and the storyboard: no clock,
no path, no counter that is not in the plan.
"""

import html

from catalog import (BODY, DIRECTION_TAG, FIGURE, ICON, SLOT_TAG,
                     SOURCE_EXCERPT, SOURCE_WHAT, SOURCE_WHEN, SOURCE_WHERE,
                     SOURCES_SPEC, TABLE_MAX_ROWS, chart_of, figure_of, form_of,
                     group_of, is_table, slot_specs)
from source import Refused
from storyboard import message_slot

import icons

# THE WORD EVERY PLACEHOLDER OPENS WITH. It is Portuguese because it is written
# for whoever is looking at the contact sheet, the same seam `compiler/
# storyboard.py` sits on: this compiler's MESSAGES are English, and what it
# AUTHORS for a person to read is not.
SAMPLE = "amostra"

# The icon every ICON slot stands in with. A Lucide name is furniture rather
# than a word the room reads, so there is no placeholder to write -- what a
# skeleton can do is name one the vendored set really carries, and say so when
# it does not rather than emitting a `<use>` pointing at a symbol no sprite
# holds.
SAMPLE_ICON = "square-dashed"

# The one source a skeleton declares when the plan has none. A citing slot
# carries an id and nothing else, so the alternative to inventing one is a
# slide the dialect refuses -- and the `what` is the honest legend for a page
# where nothing was measured, the same line `examples/` gives its own `S1`.
SAMPLE_SOURCE = "A1"
SAMPLE_SOURCE_FIELDS = {
    SOURCE_WHAT: f"{SAMPLE} — nada aqui foi medido",
    SOURCE_WHERE: "a fonte real entra aqui: o caminho, a URL ou a máquina",
    SOURCE_WHEN: "set/2026",
    SOURCE_EXCERPT: f"{SAMPLE} — o trecho literal da fonte entra aqui",
}

# How many columns and how many lines a placeholder table takes. The ceiling is
# the register's (`TABLE_MAX_ROWS`, header included) and the floor is what a
# table has to have to be one; three data rows under a header of two columns is
# the shape a reader recognises as a table without filling the stage with
# nothing.
TABLE_COLUMNS = 2
TABLE_ROWS = min(4, TABLE_MAX_ROWS)

# The box a placeholder figure is drawn in, and the drawing itself. It is
# written here rather than generated because a figure is the one slot the
# catalog does not compose (#214) -- there is no shape to derive. It paints in
# `--hairline-strong`, `--ink-muted` and `--accent` only: the two content
# colours mean whatever a deck's own art direction says they mean, and a
# placeholder spending one would be a placeholder making a claim.
FIGURE_BOX = "0 0 1200 456"
FIGURE_DRAWING = (
    '<rect x="8" y="8" width="1184" height="440" rx="16" fill="none" '
    'stroke="var(--hairline-strong)" stroke-width="2"/>'
    '<rect x="96" y="112" width="288" height="200" rx="16" fill="none" '
    'stroke="var(--hairline-strong)" stroke-width="2"/>'
    '<rect x="456" y="112" width="288" height="200" rx="16" '
    'fill="var(--accent)"/>'
    '<rect x="816" y="112" width="288" height="200" rx="16" fill="none" '
    'stroke="var(--hairline-strong)" stroke-width="2"/>'
    '<line x1="384" y1="212" x2="456" y2="212" stroke="var(--hairline-strong)" '
    'stroke-width="2"/>'
    '<line x1="744" y1="212" x2="816" y2="212" stroke="var(--hairline-strong)" '
    'stroke-width="2"/>'
    '<text x="600" y="384" font-size="30" text-anchor="middle" '
    f'fill="var(--ink-muted)">{SAMPLE} — a figura real entra aqui</text>'
)


def _text(said):
    """One placeholder, escaped for the dialect. Plain words, never markup."""
    return html.escape(said, quote=False)


def _slot(name, said):
    return f'<{SLOT_TAG} class="{name}">{_text(said)}</{SLOT_TAG}>'


def placeholder(slot, row):
    """What a slot stands in with, decided by the role the register gives it.

    A CITING SLOT NEVER REACHES HERE. Its content is the id of a source, which
    is the plan's to give and not this function's to invent -- `_slide` writes it
    before it asks for a placeholder, the same way it writes the message.

    THE NUMBER IS THE SLIDE'S OWN, and that is the one placeholder that is not a
    word. A `figure` slot is set in the largest type on the stage and a sentence
    there would not be read as a number at all -- so what goes in it is the
    slide's place in the deck, two digits, which reads as a placeholder to
    anybody and gives a numbered divider its own number instead of three
    dividers all saying the same thing.
    """
    if slot.role == ICON:
        return SAMPLE_ICON
    if slot.role == FIGURE:
        return f"{row.number:02d}"
    if slot.role == BODY:
        # AS LONG AS PROSE IS, BECAUSE THE OCCUPANCY RULER MEASURES THE STAGE.
        # A three-word placeholder in three columns fills 37% of the slide and
        # the render gate refuses it -- on a page whose whole job is to be
        # looked at, so the red would be about the marker and not about the
        # deck. A line this long is roughly what a real column holds.
        return (f"{SAMPLE} · {slot.name} — o texto real entra aqui, e ocupa "
                "mais ou menos esta altura")
    return f"{SAMPLE} · {slot.name}"


def _field(field, index):
    """What one field of a group's item stands in with, by its own role."""
    if field.role == FIGURE:
        return f"{index:02d}"
    return f"{SAMPLE} {index}"


def _item(group, index, marked, said=None):
    """One `<li>` of a placeholder group, fields in the register's order.

    `said` OVERRIDES A FIELD BY ITS ROLE AND NOT BY ITS NAME, which is what a
    chart's series needs: a value it draws has to be a NUMBER a form can scale,
    and "amostra 3" is not one. Keyed by role, the override is the register's own
    question -- a series whose figures move to another field name still gets its
    numbers, and this file never spells `value`.
    """
    flag = f" {group.flag}" if marked and group.flag else ""
    said = said or {}
    cells = "".join(
        _slot(f.name, said.get(f.role, _field(f, index))) for f in group.fields)
    return f"<{group.item}{flag}>{cells}</{group.item}>"


def _series(chart, form, count):
    """The numbers a placeholder chart draws.

    A PROPORTION HAS TO ADD UP AND THE REST ONLY HAVE TO CLIMB. `Chart.total`
    is the register's own sum for a share, and the remainder goes on the last
    slice so the column totals it exactly whatever the count is; every other
    form wants a series a reader can see the mark in, which is what an
    ascending run of round numbers gives.
    """
    if form.proportion:
        share = chart.total // count
        return [share] * (count - 1) + [chart.total - share * (count - 1)]
    return [10 * (i + 1) for i in range(count)]


def _point(group, values, index):
    """The fields of one point of a placeholder series, by role.

    EVERY FIELD OF A CHART'S ITEM IS A NUMBER, and that is the one place a
    placeholder cannot say the word. The value has to be a number a form can
    scale -- "amostra 3" is not one. And the LABEL has to be SHORT, because it
    is drawn into a plot whose room per label is measured: "amostra 8" under the
    eighth point of a line runs into "amostra 7" beside it, and that collision
    is invisible to every ruler that measures against the stage, which is how it
    reached a contact sheet once. Two digits fit every form at its ceiling --
    the tightest is the sparkline, which spends its width on twelve points and
    leaves five characters under each -- and they read as a placeholder beside a
    `unit` slot that says so in words.
    """
    return {f.role: (str(values[index]) if f.role == FIGURE
                     else f"{index + 1:02d}")
            for f in group.fields}


def _group(pattern, row):
    """The series a pattern shows, at the widest count its shape admits.

    IT ANSWERS FOR A CHART TOO, which is why the cascade in `_slide` is
    three-way where `compiler/build.py`'s is four. A chart's series IS a group --
    the same container, the same item, the same named fields -- and what the
    chart adds is whose counts apply and what a value has to look like. Both are
    this function's business, and a fourth branch up there would call back into
    it anyway.

    THE CEILING, LIKE `_slide`, AND FOR THE SAME REASON: a rehearsal is judged
    on composition, and a series is at its most composed when it is full -- a
    chart of two bars where the deck will draw six rehearses a slide nobody is
    going to see, and a shape that holds at its ceiling holds at every width
    under it. The count is the register's: a chart's is the FORM's (a line of
    two points is broken and a line of eight is the widest it draws), and every
    other group's is its own.
    """
    group = group_of(pattern)
    chart = chart_of(pattern)
    if chart:
        form = form_of(pattern, row.form or chart.forms[0].name)
        count = form.maximum
        values = _series(chart, form, count)
        said = [_point(group, values, i) for i in range(count)]
    else:
        count = group.maximum
        said = [None] * count
    items = "".join(
        _item(group, i + 1, marked=(i == count - 1), said=said[i])
        for i in range(count)
    )
    return f"<{group.container}>{items}</{group.container}>"


def _table():
    """A placeholder table: one header, three rows, every row every column."""
    heads = "".join(
        f"<th>{_text(f'{SAMPLE} · coluna {j + 1}')}</th>"
        for j in range(TABLE_COLUMNS)
    )
    rows = "".join(
        "<tr>" + "".join(
            f"<td>{_text(f'{SAMPLE} {i + 1}.{j + 1}')}</td>"
            for j in range(TABLE_COLUMNS)
        ) + "</tr>"
        for i in range(TABLE_ROWS - 1)
    )
    return f"<table><thead><tr>{heads}</tr></thead><tbody>{rows}</tbody></table>"


def _figure(pattern):
    """A placeholder figure: a drawing, never an image.

    A DRAWING AND NOT AN `<img>`, because an image is bytes on somebody's disk
    and a skeleton has none to point at -- `figure-asset` would refuse the
    source, and rightly: the "retrato vazio" it exists to stop is exactly what a
    placeholder path would produce.
    """
    figure = figure_of(pattern)
    return f'<{figure.drawn} {figure.box}="{FIGURE_BOX}">{FIGURE_DRAWING}</{figure.drawn}>'


def _slide(row, cited):
    """One placeholder slide, every slot the register declares, in its order.

    EVERY SLOT AND NOT ONLY THE REQUIRED ONES, because what a rehearsal is for
    is the COMPOSITION, and a pattern's composition is the whole of what it
    declares. `icon-list` requires one item and offers five; a skeleton that
    painted one would show a list reading as a mistake rather than as a list,
    and a cover with a hole where its kicker goes is a cover nobody can judge
    the weight of. The counts inside a SERIES are the other way round -- see
    `_group`.

    THE MESSAGE'S SLOT IS ASKED OF THE PAGE THAT PUBLISHES IT. `message_slot`
    (compiler/storyboard.py) is the one rule for "which slot a slide's message
    is read out of", and this is the same rule read the other way -- the words
    go INTO the slot the storyboard would have taken them from. A second copy
    here is how a storyboard ends up publishing one slot and a skeleton filling
    another, over a page nobody compares.
    """
    slots = slot_specs(row.pattern)
    said = message_slot(row.pattern, {s.name for s in slots})
    body = []
    for slot in slots:
        if slot is said:
            body.append(_slot(slot.name, row.message))
            continue
        if slot.cites:
            body.append(_slot(slot.name, cited))
            continue
        body.append(_slot(slot.name, placeholder(slot, row)))

    if figure_of(row.pattern):
        body.append(_figure(row.pattern))
    elif group_of(row.pattern):
        body.append(_group(row.pattern, row))
    elif is_table(row.pattern):
        body.append(_table())

    chart = chart_of(row.pattern)
    drawn = ""
    if chart:
        form = row.form or chart.forms[0].name
        drawn = f' {chart.attribute}="{html.escape(form, quote=True)}"'
    return (f'  <section pattern="{html.escape(row.pattern, quote=True)}"'
            f' arc="{html.escape(row.arc, quote=True)}"{drawn}>\n'
            + "".join(f"    {part}\n" for part in body)
            + "  </section>")


def _sources(plan):
    """The provenance a skeleton declares: the plan's own, or one placeholder.

    A PLAN WITH SOURCES CITES ITS OWN, so a skeleton painted from a built deck's
    storyboard prints the same legend under the same slides -- which is one less
    difference between the rehearsal and the deck. A plan with none gets the
    single placeholder above, and only when some pattern in it has to cite.
    """
    if plan.sources:
        return plan.sources
    if any(any(s.cites for s in slot_specs(r.pattern)) for r in plan.rows):
        return {SAMPLE_SOURCE: dict(SAMPLE_SOURCE_FIELDS)}
    return {}


def source(plan):
    """One plan, as a source in the dialect. Refuses what it cannot paint."""
    if not plan.rows:
        raise Refused(
            "give the storyboard a row per slide — a plan with no slide paints "
            "a page with nothing on it"
        )
    if not icons.known(SAMPLE_ICON):
        raise Refused(
            f'name an icon the vendored set carries in compiler/skeleton.py — '
            f'"{SAMPLE_ICON}" is not one of them, and a skeleton cannot stand '
            "in for an icon-list with a symbol no sprite holds"
        )

    header = " ".join(
        f'{key}="{html.escape(value, quote=True)}"'
        for key, value in plan.header.items()
    )
    direction = "".join(
        f"\n    " + _slot(name, value) for name, value in plan.direction.items()
    )

    said = _sources(plan)
    cited = next(iter(said), "")
    provenance = ""
    if said:
        items = "".join(
            f"\n    <{SOURCES_SPEC.item} {SOURCES_SPEC.key}=\"{html.escape(key, quote=True)}\">"
            + "".join(_slot(f.name, fields[f.name])
                      for f in SOURCES_SPEC.fields if fields.get(f.name))
            + f"</{SOURCES_SPEC.item}>"
            for key, fields in said.items()
        )
        provenance = (f"\n  <{SOURCES_SPEC.container}>{items}\n  "
                      f"</{SOURCES_SPEC.container}>\n")

    slides = "\n\n".join(_slide(row, cited) for row in plan.rows)
    return (
        "<!-- O ESQUELETO DESTE STORYBOARD, GERADO POR compiler/build.py "
        "--skeleton.\n"
        "     O cabeçalho é o do plano, palavra por palavra: a direção de arte "
        "e as\n"
        "     fontes vêm da própria tabela. Nos SLIDES nada é conteúdo — só a "
        "mensagem\n"
        "     de cada linha, e todo o resto é um marcador que começa por "
        f"«{SAMPLE}» e\n"
        "     diz em que slot ele está. -->\n"
        f"<deck {header}>\n"
        f"  <{DIRECTION_TAG}>{direction}\n  </{DIRECTION_TAG}>\n"
        f"{provenance}\n"
        f"{slides}\n\n</deck>\n"
    )
