#!/usr/bin/env python3
"""The catalog: every name the dialect knows, in the one place that knows it.

    python3 compiler/catalog.py            # the reference, on stdout
    python3 compiler/catalog.py --check    # CATALOG.md still says what this says,
                                           # and the theme still declares every
                                           # token a figure may paint with
    python3 compiler/catalog.py --write    # make it say so

THE CATALOG IS THE SOURCE, NOT A DESCRIPTION OF ONE. The compiler validates
against this file and nothing else, and the reference a model reads before
writing a deck is GENERATED from it -- `CATALOG.md` carries a block this file
prints, and `--check` refuses a block that drifted. The v1 measured what the
alternative costs: prose written beside a register drifts from it, and the
copy the agent reads is always the one that aged.

A PATTERN DECLARES STRUCTURE AND SLOTS, NEVER A MEASURE. How tall a statement
is, how wide it runs and where it sits are the stage's business -- a pattern
that fixed a height would be a pattern that broke on the next projector.

A PATTERN'S REQUIRED SLOTS ARE WHAT KEEPS THE STAGE FULL. Everything in this
first catalog says few words, and few words is exactly what leaves a
projector half dark -- the render gate refuses a slide whose content spans
less of the stage height than the floor `gate/render.cjs` carries as
OCCUPANCY_MIN_RATIO (calibrated in #209; the number lives there and is not
restated here, so recalibrating it cannot leave a lie in this file). A
slide with two words survives that floor by having an ANCHOR and a HORIZON:
something small at the top edge and something large at the bottom, with the
stage between them. That is why a cover requires its `meta` line and a pivot
question requires its `kicker`: drop either and the pattern stops being able
to hold the stage, whatever the theme does.

THE PROSE IN THIS FILE IS PORTUGUESE AND THE REST OF IT IS ENGLISH, on
purpose. `purpose=` is the line the reference publishes to whoever writes a
deck, so it follows the same seam CLAUDE.md draws for a schema's own
`description`: identifiers, comments and every message the compiler PRINTS
are English; the prose that explains a pattern to its author is not.
"""

import argparse
import os
import re
from dataclasses import dataclass


# What a deck's header has to say about itself, and every field is required.
# `theme` is here because a deck knows which identity it was written for; the
# build command can still override it, which is what lets the same deck be
# rebuilt in `base` to prove the patterns hold without a brand behind them.
#
# `motion` JOINED THEM IN #215, AND IT IS REQUIRED LIKE THE REST. It is the
# first piece of the art direction #207 puts in this header, and the spec's
# own reason for putting any of it there is that "as escolhas de forma saírem
# de mim e não do acaso" -- a default would be exactly the accident it names.
DECK_FIELDS = ("title", "occasion", "theme", "lang", "minutes", "motion")

# THE THREE MOTION PROFILES, and the whole of what a deck may pick between.
# They are the spec's own three (#207: estático, editorial, cinemático), and
# they decide two things and nothing else: how a slide arrives, and how a
# fragment enters. Neither is ever written per deck -- the profile is a name
# the header says and `compiler/stage.html` answers, the same seam every other
# piece of composition in this skill sits on.
#
# A MACHINE THAT ASKED FOR LESS MOTION GETS NONE, WHICHEVER IS PICKED. The
# stage's own `prefers-reduced-motion` block turns every animation and every
# transition off, so the profile decides what a deck looks like on a machine
# that never said otherwise -- it is not a way around the preference.
MOTION_PROFILES = ("static", "editorial", "cinematic")

# THE INLINE VOCABULARY CLOSES HERE (#211). Two tags always available -- bold
# and an accent-coloured highlight -- plus one that is not a matter of taste:
# `BREAK_TAG` forces a line inside a slot's own prose, and only where a
# pattern's own `allow_break` says a paragraph is long enough to need one.
# `em` never joins this set: italic said nothing the closed three do not
# already say, and a vocabulary that keeps growing by one tag per ticket is a
# vocabulary nobody can hold in their head while writing a deck.
INLINE_TAGS = ("strong", "mark")
BREAK_TAG = "br"

# A text slot is written as a paragraph. The element carries the slot's name
# as its only class, and nothing else: `style=` and a second class are
# geometry wearing the clothes of prose, and geometry does not cross this
# seam.
SLOT_TAG = "p"

# WHAT DOES NOT FIT ON THE STAGE, WRITTEN WHERE IT DOES (#215). The doctrine
# #207 sets is "um argumento por slide; o que não cabe vai para as notas, e
# nada se perde" -- and a dialect with nowhere to put the rest is a dialect
# that makes losing it the easy path. A slide carries at most one `<notes>`,
# bare like a group's container, because the tag alone says what it is; it
# never reaches the stage, only the panel the presenter opens with a key, so
# nothing here is spent from the slide's own word budget.
NOTES_TAG = "notes"

# THE BARE ATTRIBUTE THAT MAKES A SLOT A FRAGMENT (#215). A slide reveals in
# beats when the argument has beats: the slot marked with it is hidden until
# the presenter advances, and the order is the order the PATTERN reads its
# slots, never a number written here. Same shape as `Group.flag` one level up
# -- the register spells the word once and every reader asks it.
#
# THE ZERO STEP IS WHAT THIS CANNOT SAY ON ITS OWN. Mark every slot and the
# stage is blank until the first advance, which the room reads as a slide that
# failed to load; `gate/render.cjs`'s zero-step ruler is what refuses that,
# because whether anything painted is a question only a browser answers.
STEP_ATTR = "step"

# WHAT A SLIDE IS FOR, WHICH IS NOT WHAT IT LOOKS LIKE (#217). A pattern names
# the shape; the arc function names the job, and neither implies the other -- a
# chart can be the tension or the evidence, and a full-bleed statement can be
# either. #207's arc is these six words in this order, and every `<section>`
# says which one it is doing in `ARC_ATTR`.
#
# WHY EVERY SLIDE CARRIES IT AND NOT JUST THE STORYBOARD. The storyboard is
# GENERATED, and a generated document can only publish what the source already
# knows. The alternative is the arc written twice -- once in the deck, once in a
# file beside it -- which is a contract with two ends and the silent drift that
# comes with one: #207's own lesson from the v1 is that "a cópia que o agente lê
# é sempre a que envelheceu". The source says it once, and
# `compiler/storyboard.py` reads it back out.
ARC_ATTR = "arc"

ARC_FUNCTIONS = ("context", "tension", "thesis", "evidence", "plan", "call")

# The last act, named once so that the ruler charging a deck for its closing
# does not spell the word a second time.
ARC_CALL = "call"

# The reference and the storyboard publish the arc in Portuguese, the same seam
# `ROLE_LABEL` sits on one section down: the name is an identifier, the label is
# prose for whoever reads the story back.
ARC_LABEL = {
    "context": "contexto",
    "tension": "tensão",
    "thesis": "tese",
    "evidence": "provas",
    "plan": "plano",
    "call": "chamada",
}


# ── what a slot is for ───────────────────────────────────────────────────────
# The role is the register's answer to "how loud is this, and who measures
# it". The stage reads it as `data-role=` on the emitted paragraph and styles
# by it, so a pattern that adds a `meta` slot in a later ticket inherits the
# treatment instead of restating it; the category-title ruler reads it to
# know which slots are supposed to make a CLAIM. The reference publishes them
# by the Portuguese names below.
#
# NAME EXISTS BECAUSE OF THE ARC. A section divider's title is set as large as
# any claim and is the only text on the stage that is SUPPOSED to name a
# folder -- naming the next section "Contexto" is the divider doing its job,
# and #207's own arc opens on that word. Reading it as a claim would let the
# category-title ruler refuse the spec's first act, so the register says what
# the text is and the ruler measures only what claims.
CLAIM = "claim"        # the sentence the slide is there to say
NAME = "name"          # a section's name -- where a category is the right word
FIGURE = "figure"      # a number or token, set large and read as an image
BODY = "body"          # the prose that supports the claim
META = "meta"          # furniture: the label, the index, the source, the date
ICON = "icon"          # a Lucide name, read as a glyph and never as a word

ROLE_LABEL = {
    CLAIM: "afirmação",
    NAME: "nome",
    FIGURE: "número",
    BODY: "corpo",
    META: "metadado",
    ICON: "ícone",
}


@dataclass(frozen=True)
class Slot:
    """One named place for text inside a pattern."""

    name: str
    role: str
    purpose: str       # Portuguese: the line the reference publishes about it
    pairs_with: str = None  # another slot that must be written exactly when this one is (#211)


@dataclass(frozen=True)
class Field:
    """One named part of a group's item -- a metric's value, a milestone's date.

    THE SAME SHAPE AS A SLOT, ONE LEVEL DEEPER. A slot names what a `<p>`
    means inside a SLIDE; a field names what one means inside an ITEM of a
    repeating group. Keeping it a separate dataclass rather than reusing
    `Slot` is what lets a field carry no budget and no top-level
    requiredness of its own -- an item's shape is fixed by the group that
    declares it, not by the slide.
    """

    name: str
    role: str
    purpose: str       # Portuguese: the line the reference publishes about it


@dataclass(frozen=True)
class Group:
    """A bounded, repeating collection of same-shaped items inside a pattern.

    EVERY OTHER PATTERN IN THIS FILE SAYS A NAME ONCE. That is what a slot
    is, and #210's whole catalog never needed more. A metric row, a
    milestone and a table's data row are exactly the place that stops
    holding: the evidence a deck exists to show is a SERIES, not a fact, and
    a dialect that could only say each name once would have no way to write
    one.

    THE CONTAINER TAG IS THE ONLY VOCABULARY THE GROUP NEEDS. Every pattern
    below carries at most one group, so there is nothing for a `class=` on
    `<ul>` or `<ol>` to disambiguate -- the tag alone says what is being
    counted, the same way a bare `<table>` needs no class to say it is one.
    """

    container: str       # the tag the items sit inside: "ul", "ol"
    item: str             # the tag one item is written as: "li"
    fields: tuple          # the Field(s) an item carries, in reading order
    required_fields: tuple
    minimum: int
    maximum: int
    purpose: str          # Portuguese: the line the reference publishes about it
    # ONE ITEM OF A GROUP MAY BE SINGLED OUT, AND THE REGISTER NAMES THE WORD.
    # #212 wrote this as `now_flag: bool` with the attribute name "now" spelled
    # out in the audit, the stage and the reference; #213 needs the same shape
    # under another word (`mark`, the one point of a chart the accent is spent
    # on), and a second hard-coded name is how one rule ends up living in four
    # files. The register says the word once and every reader asks it.
    flag: str = None            # the bare attribute at most one item may carry
    flag_purpose: str = None    # Portuguese: what marking an item means here


@dataclass(frozen=True)
class ChartForm:
    """One shape a chart may be drawn in, and what the series has to look like.

    THE FORM IS WHERE THE COUNTS LIVE, NOT THE GROUP. A bar chart of nine bars
    and a line of two points are both broken, and they are broken at different
    numbers -- the group declares the ENVELOPE every form fits inside, and the
    form declares the pair that actually judges a slide.
    """

    name: str
    minimum: int
    maximum: int
    purpose: str            # Portuguese: the line the reference publishes about it
    proportion: bool = False  # the values are shares of one whole and must total it


@dataclass(frozen=True)
class Chart:
    """The forms one pattern may draw its series in, and how a slide picks one.

    A CHART IS ONE PATTERN AND SIX DRAWINGS, not six patterns (#207's own
    catalogue of eighteen names "gráfico com título-tese" once). What changes
    between a bar and a line is the MARK, never the slots: the same thesis, the
    same unit, the same dated source, the same label-and-value series.
    """

    attribute: str    # the <section> attribute that names the form: "type"
    forms: tuple      # the ChartForm(s), in the order the reference publishes
    total: int = 100  # what a proportion form's values have to add up to
    # WHAT THE STAGE SPENDS DRAWING ONE (#217), AND WHY IT IS A PATTERN-WIDE
    # ANSWER RATHER THAN A PER-FORM ONE. `compiler/stage.html` paints a mark, a
    # dot, a line, an area and a slice out of these two tokens, and WHICH of them
    # a given slide reaches depends on the form AND on whether a point is
    # marked -- a line with no mark touches only the first. Naming that exactly
    # would mean a copy of that cascade living here, in step with a stylesheet,
    # by hand: the two-ended contract this register exists to have one end of.
    #
    # So it names both, and the ruler asks a deck showing a chart to say what
    # both mean. The over-approximation costs one line in a header and can only
    # ever err toward asking; the exact version errs toward a colour reaching the
    # room with nothing said about it, which is the defect #207's own user story
    # ("a mesma cor marque a mesma coisa do começo ao fim") is about.
    content: tuple = ("--content-1", "--content-2")


@dataclass(frozen=True)
class ImageType:
    """One format an imported figure may be, and how to know the bytes are it.

    THE SIGNATURE SITS BESIDE THE EXTENSION BECAUSE A NAME IS NOT A FACT. A
    JPEG saved as `.png` embeds under a media type no browser will decode, and
    what reaches the stage is the blank rectangle #207 calls a "retrato vazio"
    -- the one defect this pattern exists to make impossible. The extension
    picks the type; the first bytes confirm it, and disagreeing is a red.
    """

    extension: str
    media: str            # the media type the data: URI declares
    signature: tuple      # (offset, bytes) pairs, all of which have to match


@dataclass(frozen=True)
class Figure:
    """The one slot the catalog bounds and never composes.

    EVERY OTHER PATTERN IN THIS FILE SAYS WHAT GOES IN IT -- a claim, a metric,
    a series of numbers -- and #207 asks for exactly one place where it does
    not: "uma figura desenhada sob medida quando o catálogo não tem o que o
    slide pede, um ciclo, um organograma, um fluxo". What the register can
    still fix is the VOCABULARY the drawing is built from, which is why the
    freedom below is bounded on three sides and open in the middle.

    TWO THINGS, AND THE TAG SAYS WHICH. A drawing is an `<svg>` the model wrote
    itself; an image is an `<img>` pointing at a file on disk, which the
    compiler embeds. Neither carries a `class=`, for the same reason a group's
    `<ul>` does not: the tag alone already says what it is.

    NOT ONE COLOUR IS WRITTEN INTO A DRAWING. `paint` names the attributes that
    carry one and `tokens` names what they may say, so a figure changes
    identity with the deck instead of wearing `base` in every theme -- the same
    promise `compiler/charts.py` keeps by emitting class names, arrived at from
    the other side because a hand-drawn figure has no classes the stage could
    have agreed to in advance.

    THE CLOSED TAG SET IS WHAT REFUSES A SCRIPT AND AN EXTERNAL REFERENCE, and
    it refuses them the same way it refuses everything else the dialect never
    declared. `<script>`, `<image>`, `<use>`, `<foreignObject>` and an
    `href=`/`style=`/`on…=` anywhere are all outside `tags` and `attrs`, so
    none of them needs a rule of its own -- a vocabulary with a hole per threat
    is a vocabulary that grows a hole per threat nobody thought of.
    """

    drawn: str            # the tag a hand-drawn figure is written as
    imported: str         # the tag an image by path is written as
    path: str             # the attribute naming the file: an `<img>`'s only one
    box: str              # the attribute a drawing cannot omit: its viewBox
    caption: str          # the slot whose words become the figure's accessible name
    words: tuple          # the elements of a drawing that carry words
    tags: tuple           # the elements a drawing may be built from
    attrs: tuple          # the attributes any of them may carry, canonically spelled
    paint: tuple          # which of those attributes carry a colour
    tokens: tuple         # the theme tokens a colour may name
    unpainted: str        # the one colour that is not a token
    types: tuple          # the ImageType(s) an imported figure may be
    max_bytes: int        # the ceiling one imported file may weigh
    purpose: str          # Portuguese: the line the reference publishes about it


# THE ELEMENTS A DRAWING IS BUILT FROM. Enough for the three figures #207 names
# by name -- a cycle, an org chart, a flow -- and nothing that reaches outside
# the page. An arrowhead is a `<polygon>` here rather than a `<marker>`,
# deliberately: a marker is attached through `marker-end="url(#id)"`, and the
# moment a paint value may say `url(…)` the rule that every colour is a token
# stops being answerable by reading the value.
FIGURE_TAGS = ("g", "path", "rect", "circle", "ellipse", "line", "polyline",
               "polygon", "text", "tspan")

# THE ATTRIBUTES, IN THE SPELLING SVG WANTS. `viewBox` is the only one whose
# case matters, and it matters twice: `html.parser` hands every attribute back
# lowercased, so the compiler looks a name up case-folded and writes it back
# from this tuple. Nothing that names a face or a weight is here -- the stage
# sets those for every figure at once (compiler/stage.html), which is one less
# thing an author can get wrong and one less value to hold to a token.
FIGURE_ATTRS = (
    "viewBox",
    "d", "points",
    "x", "y", "width", "height", "rx", "ry",
    "cx", "cy", "r",
    "x1", "y1", "x2", "y2",
    "dx", "dy",
    "transform",
    "fill", "stroke",
    "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
    "opacity", "fill-opacity", "stroke-opacity",
    "font-size", "text-anchor", "dominant-baseline",
)

# THE COLOURS A FIGURE MAY WEAR, and they are the theme's own names rather than
# a list this file invented: `--check` refuses a name `themes/base/tokens.css`
# does not declare, so the day a token is renamed is the day this tuple is red
# instead of the day a figure silently paints nothing.
FIGURE_TOKENS = ("--surface", "--ink", "--ink-muted", "--accent",
                 "--content-1", "--content-2",
                 "--hairline-faint", "--hairline", "--hairline-strong")

# TWO MEGABYTES, PER FILE. Base64 costs a third on top, so a figure at the
# ceiling is under three megabytes of text in a deck that still opens from a
# mail attachment -- and a picture that needs more than this to fill a 16:9
# projector is a picture nobody resized for one. The ceiling is per file and
# not per deck on purpose: a deck's own weight is something its author can see,
# and one image quietly costing forty is not.
FIGURE_MAX_BYTES = 2 * 1024 * 1024

# The bare name `FIGURE` is already the ROLE a big number carries, and the two
# are unrelated: one says how a `<p>` is set, this one says what may be drawn.
FIGURE_SPEC = Figure(
    drawn="svg",
    imported="img",
    path="src",
    box="viewBox",
    caption="caption",
    words=("text", "tspan"),
    tags=FIGURE_TAGS,
    attrs=FIGURE_ATTRS,
    paint=("fill", "stroke"),
    tokens=FIGURE_TOKENS,
    unpainted="none",
    types=(
        ImageType(".png", "image/png", ((0, b"\x89PNG\r\n\x1a\n"),)),
        ImageType(".jpg", "image/jpeg", ((0, b"\xff\xd8\xff"),)),
        ImageType(".jpeg", "image/jpeg", ((0, b"\xff\xd8\xff"),)),
        ImageType(".gif", "image/gif", ((0, b"GIF8"),)),
        ImageType(".webp", "image/webp", ((0, b"RIFF"), (8, b"WEBP"))),
    ),
    max_bytes=FIGURE_MAX_BYTES,
    purpose="um `<svg>` que você mesmo desenha, ou um `<img>` apontando para um "
            "arquivo que o compilador embute",
)


@dataclass(frozen=True)
class Pattern:
    """One entry of the catalog."""

    name: str
    slots: tuple       # every slot the pattern accepts, in reading order
    required: tuple    # the slot names without which the slide is not the pattern
    budget: int        # words the WHOLE slide may spend, furniture included
    purpose: str       # Portuguese: the line the reference publishes about it
    group: Group = None      # a Group this pattern also carries, or None
    table: bool = False      # this pattern's evidence is a real <table>, not a group
    allow_break: bool = False  # may a slot force a line with BREAK_TAG (#211)
    chart: Chart = None      # the group is drawn, not printed -- see Chart (#213)
    figure: Figure = None    # the slot the catalog does not limit -- see Figure (#214)
    # THE TWO THINGS AN ART DIRECTION PICKS A PATTERN *BY* (#217), and they are
    # facts about the pattern rather than about a deck -- which is why they are
    # declared here once instead of listed by name in a ruler that would then
    # have to be edited every time the catalog grows.
    #
    # `cover` is what makes "escolhe a capa entre os padrões de capa" a closed
    # question. `moment` is #207's own definition read into this register: "um
    # slide com figura desenhada, gráfico animado ou afirmação de tela cheia" --
    # the three patterns below, with the drawn/imported split for the figure
    # settled per slide, because a photograph is not a drawing.
    #
    # AND "GRÁFICO ANIMADO" IS READ AS "GRÁFICO", DELIBERATELY. This engine
    # animates a slide's ARRIVAL by motion profile and never a chart's marks
    # (compiler/stage.html), so the spec's adjective describes a feature that
    # does not exist here yet. Read literally, no chart would ever count -- and a
    # deck of six charts would declare itself "sober" while being a wall of
    # peaks, which is the exact rhythm the scale exists to measure. Counting the
    # chart is what keeps the scale about the DECK rather than about a feature;
    # the day chart animation lands, this line does not have to change.
    cover: bool = False      # a deck may open on this one
    moment: bool = False     # a slide of this pattern is one of the deck's moments
    # AND THE ONE A DECK HAS TO END ON. #207 makes the closing mandatory ("fecho
    # obrigatório que volta à tese e pede algo à plateia"), and the ruler that
    # charges a deck for it asks the register which pattern that is rather than
    # spelling a name -- a name spelled in a ruler is a name that outlives the
    # pattern it referred to.
    closing: bool = False    # the deck's last slide is one of these


# THE ORDER IS THE ARC, not the alphabet: a deck opens with a cover, turns on
# a question, states its thesis, holds the stage with a sentence, lays out
# its evidence, borrows a voice, takes a breath, and asks for something. The
# reference publishes them in this order and every message that lists them
# uses it too, because the order teaches when to reach for which.
#
# THE BUDGETS ARE THE SPEC'S (#207), AND THEY ARE THE SLIDE'S, NOT THE SLOT'S.
# A label is words the room reads too, so a cover's `meta` and a question's
# `kicker` are spent from the same 25 or 12 as the headline. Nothing here
# counts what you SAY over the slide, which is where everything that did not
# fit belongs.
#
# AND ONE CEILING OVER ALL OF THEM: no slide, whatever its pattern, spends
# more than this. The widest word-budgeted patterns are two columns at 60 and
# three columns and the comparison at 75, and the only place the ceiling can
# be broken is here, when a budget is written. `--check` is what refuses it.
# `table` (#212) sets its budget AT the ceiling on purpose: the spec's own
# regulator for a table is the row count, not a word count, and a tighter
# number here would be a second ceiling nobody asked for.
ABSOLUTE_BUDGET = 90

PATTERNS = {
    p.name: p
    for p in (
        Pattern(
            name="cover-headline",
            slots=(
                Slot("kicker", META, "o rótulo curto que situa o deck antes do título"),
                Slot("title", CLAIM, "a manchete: o que este deck afirma"),
                Slot("subtitle", BODY, "uma frase que estende a manchete"),
                Slot("meta", META, "a ocasião e a data, na base do palco"),
            ),
            required=("title", "meta"),
            budget=25,
            purpose="A capa que abre pela manchete — o deck se apresenta pelo que afirma",
            cover=True,
        ),
        Pattern(
            name="cover-numbered",
            slots=(
                Slot("number", FIGURE, "o número que abre a capa, no maior corpo do palco"),
                Slot("title", CLAIM, "o que o número quer dizer, logo abaixo dele"),
                Slot("meta", META, "de onde veio o número, e quando foi medido"),
            ),
            required=("number", "title"),
            budget=25,
            purpose="A capa que abre por um número, com o título dizendo o que ele mede",
            cover=True,
        ),
        Pattern(
            name="pivot-question",
            slots=(
                Slot("kicker", META, "o rótulo que avisa a plateia de que vem uma pergunta"),
                Slot("question", CLAIM, "a pergunta em que a apresentação vira"),
            ),
            required=("kicker", "question"),
            budget=12,
            purpose="A pergunta que vira a apresentação, em corpo de display",
        ),
        Pattern(
            name="thesis-title",
            slots=(
                Slot("title", CLAIM, "a tese, com verbo ou número"),
                Slot("sentence", BODY, "a única frase que sustenta a tese"),
            ),
            required=("title", "sentence"),
            budget=25,
            purpose="A tese no alto e uma frase só no pé, com o palco inteiro entre as duas",
        ),
        # THE PROVAS ARC BEGINS HERE (#212). A tese sozinha é uma afirmação; o
        # que a torna crível é a evidência logo depois dela -- o próprio arco
        # que #207 prescreve é contexto, tensão, TESE, PROVAS, plano, chamada.
        # Os quatro abaixo são os primeiros padrões deste catálogo que dizem
        # mais de uma coisa por slide, e é por isso que cada um carrega um
        # `group` ou uma `table`: nenhum slot sozinho, dito uma vez, segura
        # uma série.
        Pattern(
            name="big-number",
            slots=(
                Slot("number", FIGURE, "o número, sozinho no maior corpo do palco"),
                Slot("caption", CLAIM, "o que o número prova"),
                Slot("meta", META, "de onde veio o número, e quando foi medido"),
            ),
            required=("number", "caption"),
            budget=25,
            purpose="Um número gigante e a legenda que diz o que ele prova",
        ),
        Pattern(
            name="inline-metrics",
            slots=(
                Slot("claim", CLAIM, "o que as métricas, juntas, provam"),
            ),
            required=("claim",),
            budget=48,
            purpose="De duas a quatro métricas lado a lado, cada uma com seu número e seu rótulo",
            group=Group(
                container="ul",
                item="li",
                fields=(
                    Field("value", FIGURE, "o número da métrica"),
                    Field("label", META, "o que esse número mede"),
                ),
                required_fields=("value", "label"),
                minimum=2,
                maximum=4,
                purpose="cada `<li>` é uma métrica, com seu `value` e seu `label`",
            ),
        ),
        Pattern(
            name="timeline",
            slots=(
                Slot("claim", CLAIM, "o que a linha do tempo prova"),
            ),
            required=("claim",),
            budget=60,
            purpose="De três a seis marcos em sequência, um deles podendo ser o momento presente",
            group=Group(
                container="ol",
                item="li",
                fields=(
                    Field("label", NAME, "o nome do marco"),
                    Field("date", META, "quando o marco aconteceu"),
                ),
                required_fields=("label", "date"),
                minimum=3,
                maximum=6,
                purpose="cada `<li>` é um marco, com seu `label` e sua `date`",
                flag="now",
                flag_purpose="marca o momento presente",
            ),
        ),
        Pattern(
            name="table",
            slots=(
                Slot("claim", CLAIM, "o que a tabela prova"),
            ),
            required=("claim",),
            budget=ABSOLUTE_BUDGET,
            purpose="Uma tabela com cabeçalho obrigatório e até seis linhas ao todo, "
                    "cabeçalho incluído",
            table=True,
        ),
        # THE SERIES THE COMPILER DRAWS INSTEAD OF PRINTING (#213). Every other
        # pattern above hands the stage the author's own words; this one hands
        # `compiler/charts.py` a list of numbers and puts a drawing where the
        # list was. #94 measured why the drawing is generated rather than
        # written: the same bar chart costs 30 lines and 79 hand-placed
        # coordinates as literal SVG against two lines of data through a
        # generator, and the generator's axis came out cleaner than the hand's.
        #
        # THE UNIT AND THE DATED SOURCE ARE REQUIRED, and that is doctrine, not
        # bookkeeping: a number with no unit is a number the room cannot argue
        # with, and a number with no date is one it cannot check. #207 asks for
        # both by name ("toda visualização carrega título-tese e legenda com
        # fonte e data").
        Pattern(
            name="chart",
            slots=(
                Slot("title", CLAIM, "a tese que o gráfico prova — com verbo ou número"),
                Slot("unit", META, "em que unidade os valores estão, ou o que os cem "
                                   "por cento somam"),
                Slot("source", META, "de onde veio o dado, e quando foi medido — a "
                                     "data é obrigatória"),
            ),
            required=("title", "unit", "source"),
            budget=60,
            purpose="Um gráfico desenhado a partir dos dados escritos no próprio "
                    "slide, com título-tese e fonte datada",
            group=Group(
                container="ul",
                item="li",
                fields=(
                    Field("label", NAME, "o nome do ponto"),
                    Field("value", FIGURE, "o número do ponto — dígitos, com vírgula "
                                           "decimal e sem unidade"),
                ),
                required_fields=("label", "value"),
                # THE ENVELOPE, NOT THE JUDGEMENT. Each form below carries the
                # pair that actually measures a slide; these two are the union
                # of all six, so a series outside them is outside every form.
                minimum=2,
                maximum=12,
                purpose="cada `<li>` é um ponto da série, com seu `label` e seu `value`",
                flag="mark",
                flag_purpose="marca o ponto que o slide é sobre, na cor de acento",
            ),
            chart=Chart(
                attribute="type",
                forms=(
                    ChartForm("bars-h", 2, 6,
                              "barras horizontais — cada rótulo tem uma coluna só "
                              "dele, e é a forma que aceita rótulo longo"),
                    ChartForm("bars-v", 2, 8,
                              "barras verticais — o rótulo fica sob a coluna, e por "
                              "isso precisa ser curto"),
                    ChartForm("line", 3, 8,
                              "uma linha sobre uma grade com eixo, para a evolução "
                              "de uma medida no tempo"),
                    ChartForm("area", 3, 8,
                              "a mesma linha com a área preenchida até o zero, para "
                              "volume em vez de posição"),
                    ChartForm("sparkline", 4, 12,
                              "a linha sem eixo nem grade, com o último valor em "
                              "destaque — a tendência, e um número"),
                    ChartForm("share", 2, 3,
                              "uma barra empilhada de fatias que somam cem, uma por "
                              "cor que o tema empresta", proportion=True),
                ),
            ),
            moment=True,
        ),
        # THE SLOT THE CATALOG DOES NOT LIMIT (#214). Every pattern above says
        # what goes in it; this one says only what the figure may be BUILT
        # from, because the moment the catalog has nothing for a slide -- a
        # cycle, an org chart, a flow -- is exactly the moment #207 refuses to
        # sacrifice ("para o momento mais forte do deck não ser sacrificado ao
        # catálogo").
        #
        # THE TITLE IS OPTIONAL AND THE CAPTION IS NOT, and that is the whole of
        # "a figura pode ocupar o slide inteiro ou dividir o palco com um
        # título-tese": written, the claim takes the top of the stage and the
        # figure takes what is left; unwritten, the figure takes all of it. The
        # caption stays required either way, because a figure nobody names is a
        # picture the room has to guess at -- and it is what the compiler hands
        # a screen reader as the drawing's accessible name.
        Pattern(
            name="figure-caption",
            slots=(
                Slot("title", CLAIM, "a tese que a figura prova — sem ela, a "
                                     "figura fica com o palco inteiro"),
                Slot("caption", META, "o que a figura mostra, e de onde ela "
                                      "veio — é também o texto alternativo"),
            ),
            required=("caption",),
            budget=48,
            purpose="Uma figura desenhada sob medida, ou uma imagem embutida por "
                    "caminho, com a legenda embaixo",
            figure=FIGURE_SPEC,
            moment=True,
        ),
        Pattern(
            name="full-bleed-statement",
            slots=(
                Slot("statement", CLAIM, "a frase que o slide inteiro sustenta"),
            ),
            required=("statement",),
            budget=12,
            purpose="Uma frase em corpo de display, segurando o palco sozinha",
            moment=True,
        ),
        Pattern(
            name="two-columns",
            slots=(
                Slot("title", CLAIM, "a tese que as duas colunas sustentam"),
                Slot("column-a", BODY, "o primeiro argumento"),
                Slot("column-b", BODY, "o segundo argumento"),
            ),
            required=("title", "column-a", "column-b"),
            budget=60,
            purpose="A tese no alto, sustentada por dois argumentos lado a lado",
            allow_break=True,
        ),
        Pattern(
            name="three-columns",
            slots=(
                Slot("title", CLAIM, "a tese que as três colunas sustentam"),
                Slot("column-a", BODY, "o primeiro argumento"),
                Slot("column-b", BODY, "o segundo argumento"),
                Slot("column-c", BODY, "o terceiro argumento"),
            ),
            required=("title", "column-a", "column-b", "column-c"),
            budget=75,
            purpose="A tese no alto, sustentada por três argumentos lado a lado",
            allow_break=True,
        ),
        Pattern(
            name="comparison",
            slots=(
                Slot("title", CLAIM, "a tese que a comparação decide"),
                Slot("label-a", META, "o nome do primeiro lado"),
                Slot("label-b", META, "o nome do segundo lado"),
                Slot("body-a", BODY, "o que se diz do primeiro lado"),
                Slot("body-b", BODY, "o que se diz do segundo lado"),
            ),
            required=("title", "label-a", "label-b", "body-a", "body-b"),
            budget=75,
            purpose="Dois lados nomeados e postos lado a lado, com uma hairline entre eles",
            allow_break=True,
        ),
        Pattern(
            name="icon-list",
            slots=(
                Slot("title", CLAIM, "a tese que a lista sustenta"),
                Slot("item-1-icon", ICON, "o ícone do primeiro item", pairs_with="item-1-text"),
                Slot("item-1-text", BODY, "o primeiro item"),
                Slot("item-2-icon", ICON, "o ícone do segundo item", pairs_with="item-2-text"),
                Slot("item-2-text", BODY, "o segundo item"),
                Slot("item-3-icon", ICON, "o ícone do terceiro item", pairs_with="item-3-text"),
                Slot("item-3-text", BODY, "o terceiro item"),
                Slot("item-4-icon", ICON, "o ícone do quarto item", pairs_with="item-4-text"),
                Slot("item-4-text", BODY, "o quarto item"),
                Slot("item-5-icon", ICON, "o ícone do quinto item", pairs_with="item-5-text"),
                Slot("item-5-text", BODY, "o quinto item"),
            ),
            required=("title", "item-1-icon", "item-1-text"),
            budget=60,
            purpose="Até cinco itens, cada um com seu ícone — nunca um marcador solto",
        ),
        Pattern(
            name="pull-quote",
            slots=(
                Slot("quote", CLAIM, "a frase citada, na voz de quem a disse"),
                Slot("attribution", META, "quem disse, e em que papel"),
            ),
            required=("quote", "attribution"),
            budget=30,
            purpose="Uma citação segurando o palco, com a atribuição na base",
        ),
        Pattern(
            name="section-divider",
            slots=(
                Slot("index", FIGURE, "o número da seção que começa, no alto do palco"),
                Slot("title", NAME, "o nome da seção, no pé do palco"),
            ),
            required=("index", "title"),
            budget=8,
            purpose="O respiro entre duas seções — um número no alto, o nome embaixo",
        ),
        Pattern(
            name="closing-call",
            slots=(
                Slot("thesis", BODY, "a tese, relembrada em uma linha"),
                Slot("call", CLAIM, "o que você pede à plateia"),
                Slot("meta", META, "onde a conversa continua depois do deck"),
            ),
            required=("thesis", "call"),
            budget=30,
            purpose="O fecho que volta à tese e pede alguma coisa",
            closing=True,
        ),
    )
}


# THE TABLE'S ROW CEILING, HEADER INCLUDED (#212, and the spec's own "tabela
# até 6 linhas"). Whoever counts the lines of a printed table counts the
# header as one of them, so the ceiling below is on the table as a whole and
# not on the body alone -- a table at the ceiling is one header row and five
# data rows, never six of the latter.
TABLE_MAX_ROWS = 6


# THE TITLES THAT NAME A FOLDER INSTEAD OF A POINT. A slide whose claim is
# one of these has spent the biggest type on the stage saying where the
# reader is, which the page number already answers. The list is short and
# Portuguese because it is DATA about the language a deck is written in, not
# a message the compiler prints; it is the spec's own list (#207), and it
# grows by ticket, never by guess.
CATEGORY_TITLES = (
    "visão geral",
    "agenda",
    "introdução",
    "conclusão",
    "próximos passos",
    "contexto",
    "resumo",
    "obrigado",
)


def pattern_names():
    """Every pattern the catalog declares, in the arc's order."""
    return tuple(PATTERNS)


def slot_specs(name):
    """The slots of a pattern, or () when the catalog never heard of it.

    EVERY OTHER READER GOES THROUGH THIS ONE. A source reaches the audit
    before anything has agreed it is valid, so "a pattern the catalog never
    heard of" is a real case rather than a defensive one -- and it is
    answered here, once, instead of at each caller.
    """
    p = PATTERNS.get(name)
    return p.slots if p else ()


def slots_of(name):
    """The slot NAMES of a pattern, in reading order."""
    return tuple(s.name for s in slot_specs(name))


def claims_of(name):
    """The slots of a pattern that are supposed to make a claim."""
    return tuple(s.name for s in slot_specs(name) if s.role == CLAIM)


def budget_of(name):
    """The words a slide of this pattern may spend, or None for a stranger."""
    p = PATTERNS.get(name)
    return p.budget if p else None


def group_of(name):
    """The pattern's repeating group, or None for a pattern with none."""
    p = PATTERNS.get(name)
    return p.group if p else None


def is_table(name):
    """True when the pattern's evidence is a real <table>."""
    p = PATTERNS.get(name)
    return bool(p and p.table)


def chart_of(name):
    """The pattern's chart declaration, or None for a pattern that draws nothing."""
    p = PATTERNS.get(name)
    return p.chart if p else None


def figure_of(name):
    """The pattern's figure declaration, or None for a pattern that carries none."""
    p = PATTERNS.get(name)
    return p.figure if p else None


@dataclass(frozen=True)
class Evidence:
    """What a pattern shows besides its own words, and the tag it is written as.

    THREE SHAPES, ONE QUESTION -- AND IT IS THE NAMING QUESTION, NOT THE
    DISPATCH. A group, a table and a figure are each a thing the author writes
    as a tag of its own rather than as a named `<p>`, so the audit and the
    compiler both had to ask, per pattern, "which tag is this pattern's
    evidence, and what do I call it in a message". That is what this record
    answers once. Each shape still needs its OWN handler in each file -- the
    register cannot hold one without importing the audit that would import it
    back -- so the `if figure … elif group …` cascades survive on purpose;
    what does not survive is a second, hand-kept list of tags beside the one
    the register already has. `kind` is the word every message uses, so a red
    says "figure" where a figure is what is missing.
    """

    kind: str      # "group", "table" or "figure"
    tags: tuple    # the tag(s) the author may write it as


def evidence_of(name):
    """The evidence this pattern carries, or None when its words are all of it."""
    p = PATTERNS.get(name)
    if not p:
        return None
    if p.figure:
        return Evidence("figure", (p.figure.drawn, p.figure.imported))
    if p.table:
        return Evidence("table", ("table",))
    if p.group:
        return Evidence("group", (p.group.container,))
    return None


# EVERY TAG ANY PATTERN WRITES ITS EVIDENCE AS, computed from the register and
# never listed by hand. It is what lets a reader of a slide say "this `<svg>` is
# somebody's evidence, and it is in the wrong pattern" instead of "this is a tag
# I have never heard of" -- the first names the fix, the second is a shrug.
def _evidence_tags():
    tags = set()
    for name in PATTERNS:
        found = evidence_of(name)
        if found:
            tags.update(found.tags)
    return tuple(sorted(tags))


EVIDENCE_TAGS = _evidence_tags()


def form_names(name):
    """Every form this pattern's chart may be drawn in, in the reference's order."""
    chart = chart_of(name)
    return tuple(f.name for f in chart.forms) if chart else ()


def form_of(name, form):
    """One named form of a pattern's chart, or None when either is a stranger."""
    chart = chart_of(name)
    for f in (chart.forms if chart else ()):
        if f.name == form:
            return f
    return None


def role_of(pattern, slot_name):
    """The role of one named slot in one pattern, or None when either is a stranger."""
    for s in slot_specs(pattern):
        if s.name == slot_name:
            return s.role
    return None


def role_of_element(pattern, el):
    """`role_of`, reading the slot name off a parsed Element's own `class=`.

    The three callers that need this (audit.py's word-budget and icon-known
    rulers, build.py's icon collector) were each spelling
    `el.attrs.get("class", "").strip()` out by hand -- one copy here is what
    keeps a future slot-naming change from having to find all three.
    """
    return role_of(pattern, el.attrs.get("class", "").strip())


def allow_break_of(name):
    """Whether BREAK_TAG may appear inside this pattern's prose."""
    p = PATTERNS.get(name)
    return bool(p and p.allow_break)


# ── the art direction of one deck (#217) ─────────────────────────────────────
# WHERE THE FREEDOM LIVES, AND EXACTLY HOW MUCH OF IT THERE IS. #207 draws the
# line: the theme locks the surface, the faces, the hairlines, the radius, the
# icon set and the accent, and everything a DECK still gets to decide is written
# in the block below -- the cover it opens on, a geometric signature that
# repeats, what each borrowed colour means, the register of the text, how many
# moments it holds, three patterns it gives up on purpose, and how it differs
# from the skill's canonical example.
#
# IT IS A HEADER, NOT A SLIDE. The block is the first child of `<deck>` and
# reaches no stage: nothing in it is painted, and #207's "nenhum CSS por deck"
# stays true to the letter. What it feeds is the STORYBOARD -- where a deck is
# still cheap to fix, because it is still text -- and the four rulers in
# `compiler/audit.py` that hold the slides to what the direction promised.
#
# THE SHAPE IS THE ONE THE MODEL ALREADY WRITES. A choice is a `<p>` with the
# choice's name in its `class=`, exactly like a slide's slot, and the three
# renunciations are numbered `renounced-1` … `renounced-3` the same way
# `icon-list` numbers its five items. No new container, no prose smuggled into
# an attribute, and nothing to learn that the dialect did not already teach.
DIRECTION_TAG = "direction"


@dataclass(frozen=True)
class Scale:
    """One declared scale of moments, and the count of them it admits.

    A MOMENT IS A SLIDE THAT HOLDS THE STAGE ALONE -- #207's "figura desenhada,
    gráfico animado ou afirmação de tela cheia", which is `Pattern.moment` one
    section up. The scale is declared BEFORE a slide exists, in the calibration
    round, and this is what holds the built deck to it: a deck that promised
    sober and shipped six peaks is a deck whose art direction stopped describing
    it, and nothing else in this compiler would notice.

    THE CEILING IS OPEN AT THE TOP AND THE FLOOR NEVER IS. `maximum=None` is
    "seis ou mais"; there is no scale admitting ZERO, and that is the spec's own
    arithmetic rather than an omission -- a deck with no moment at all has no
    peak, and #207 asks for the strongest moment of a deck by name.
    """

    name: str
    minimum: int
    maximum: int          # None: no ceiling
    purpose: str          # Portuguese: the line the reference publishes about it
    motion: str = None    # the one motion profile this scale may be declared with

    @property
    def span(self):
        """The count this scale admits, written the way its readers publish it.

        PORTUGUESE, AND ON THE RECORD RATHER THAN AT EACH READER. `reference()`
        below and `compiler/storyboard.py` both print this range for a person to
        read, and they had a copy each -- with two different tests for the open
        ceiling, which is how one of them ends up printing "6 a None" the day a
        fourth scale lands. The audit's own English version stays where it is:
        that one is a message the program PRINTS, and CLAUDE.md's seam runs
        between the two.
        """
        return (f"{self.minimum} a {self.maximum}" if self.maximum is not None
                else f"{self.minimum} ou mais")


MOMENT_SCALES = (
    Scale("sober", 1, 2,
          "um ou dois momentos — a proposta sóbria, que não pede palco"),
    Scale("standard", 3, 5,
          "de três a cinco — o ritmo padrão, com pico e respiro"),
    Scale("high", 6, None,
          "seis ou mais, e só com `motion=\"cinematic\"` — o palco assumido, "
          "nunca o acidente",
          motion="cinematic"),
)


@dataclass(frozen=True)
class Choice:
    """One decision the art direction records, written as a slot of its own.

    `options` IS WHAT MAKES A CHOICE A CHOICE. A name drawn from a closed set is
    held against it; free prose is only held to being there at all, because the
    signature and the register are sentences a person wrote and this register has
    nothing to measure a sentence against.

    `token` IS SET ON THE TWO COLOURS AND NOWHERE ELSE. Their name IS a theme
    token, so the ruler that refuses an undeclared colour reads the token from
    here rather than pasting `--` in front of a class name -- the day the tokens
    are renamed, this file is the one place that has to say so.
    """

    name: str
    purpose: str        # Portuguese: the line the reference publishes about it
    label: str          # Portuguese: how the storyboard names this line
    options: tuple = ()      # the closed set the value comes from, () for prose
    token: str = None        # the theme token this choice lends a meaning to


def covers():
    """Every pattern a deck may open on, in the arc's order."""
    return tuple(n for n, p in PATTERNS.items() if p.cover)


def moment_of(name):
    """Whether a slide of this pattern can be one of the deck's moments."""
    p = PATTERNS.get(name)
    return bool(p and p.moment)


def closings():
    """Every pattern a deck may end on, in the arc's order."""
    return tuple(n for n, p in PATTERNS.items() if p.closing)


# The three choices whose value is not prose, named once so that a reader --
# and a ruler -- asks the register instead of matching on a class name.
COVER_CHOICE = "cover"
MOMENTS_CHOICE = "moments"
COLOUR_CHOICES = ("content-1", "content-2")
RENOUNCE_CHOICES = ("renounced-1", "renounced-2", "renounced-3")

DIRECTION_CHOICES = (
    Choice(COVER_CHOICE,
           "o padrão de capa em que este deck abre — um dos padrões de capa do "
           "catálogo",
           "capa",
           options=covers()),
    Choice("signature",
           "a assinatura geométrica que se repete: o motivo que volta e faz do "
           "deck uma peça em vez de uma pilha",
           "assinatura"),
    Choice("register",
           "o registro do texto — em que pessoa, em que tom e com que "
           "vocabulário os slides falam",
           "registro"),
    Choice(MOMENTS_CHOICE,
           "a escala de momentos que este deck se dá, e é contra ela que a "
           "contagem é cobrada",
           "momentos",
           options=tuple(s.name for s in MOMENT_SCALES)),
    Choice("difference",
           "em que este deck difere do exemplo canônico da skill, na capa e na "
           "assinatura",
           "diferença"),
    Choice(COLOUR_CHOICES[0],
           "o que a primeira cor de conteúdo significa neste deck, do primeiro "
           "slide ao último — sem esta linha, nada pode pintar com ela",
           "`--content-1`",
           token="--content-1"),
    Choice(COLOUR_CHOICES[1],
           "o mesmo para a segunda cor de conteúdo — o tema empresta duas, e "
           "o deck declara as que gasta",
           "`--content-2`",
           token="--content-2"),
) + tuple(
    Choice(name,
           f"o {ordinal} padrão do catálogo de que este deck abre mão — usá-lo "
           "reprova a construção",
           f"renúncia {n}",
           options=pattern_names())
    for n, (name, ordinal) in enumerate(
        zip(RENOUNCE_CHOICES, ("primeiro", "segundo", "terceiro")), start=1)
)

# EVERY CHOICE BUT THE TWO COLOURS. #207 lends "até duas cores de conteúdo" --
# up to two -- so a deck painted in ink and accent alone declares neither, and
# the ruler that refuses an undeclared colour is the one that gives the pair
# their teeth. The three renunciations are required at three: #207 asks for
# "três renúncias explícitas", and a direction that could renounce nothing would
# be a direction that gave nothing up.
DIRECTION_REQUIRED = tuple(
    c.name for c in DIRECTION_CHOICES if c.name not in COLOUR_CHOICES
)


def choice_of(name):
    """One named choice of the art direction, or None for a stranger."""
    for c in DIRECTION_CHOICES:
        if c.name == name:
            return c
    return None


def choice_names():
    """Every choice the art direction records, in reading order."""
    return tuple(c.name for c in DIRECTION_CHOICES)


def scale_of(name):
    """One named scale of moments, or None when the register never heard of it."""
    for s in MOMENT_SCALES:
        if s.name == name:
            return s
    return None


# ── the reference the model reads ────────────────────────────────────────────
# Generated, never written: `CATALOG.md` carries the block between the two
# markers below and nothing else of this file's business. The prose around
# the block is a human's to write.

BEGIN = "<!-- catalog:begin -->"
END = "<!-- catalog:end -->"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCUMENT = os.path.join(ROOT, "CATALOG.md")

# THE SHEET THIS REGISTER IS HELD AGAINST. `FIGURE_TOKENS` is a list of names
# the THEME owns, and a register that named one the theme does not declare
# would pass every check in this file while painting a figure with nothing.
TOKENS = os.path.join(ROOT, "themes", "base", "tokens.css")

TOKEN_DECLARED = re.compile(r"^\s*(--[A-Za-z0-9-]+)\s*:", re.M)


def megabytes(n):
    """A weight, in the units a REFUSAL names it in: English, decimal point.

    Public because `compiler/figures.py` refuses an oversized image against the
    same ceiling this file publishes, and a second copy of "how do we write a
    megabyte" is how a refusal ends up naming a number the catalog never
    printed. CLAUDE.md's seam runs straight through it -- a message the program
    prints is English, the prose explaining a pattern is not -- so the
    Portuguese reference localises the result with `_pt` rather than this
    returning a comma into an English sentence.
    """
    return f"{n / (1024 * 1024):.1f} MB"


def _pt(said):
    """A number, with the decimal mark the reference's Portuguese prose uses."""
    return said.replace(".", ",")


def reference():
    """The whole register, as Markdown, exactly as CATALOG.md publishes it."""
    breakable = [p.name for p in PATTERNS.values() if p.allow_break]
    out = [
        "O cabeçalho é o próprio `<deck>`, e todos os campos dele são obrigatórios: "
        + ", ".join(f"`{f}`" for f in DECK_FIELDS)
        + f". Um slot é um `<{SLOT_TAG}>` com o nome do slot na `class=` — e, no "
        f"máximo, o `{STEP_ATTR}` pelado que faz dele um fragmento. "
        "O vocabulário de ênfase inline fecha em três marcações: "
        + " e ".join(f"`<{t}>`" for t in INLINE_TAGS)
        + f", sempre disponíveis, e `<{BREAK_TAG}/>` (quebra forçada), disponível só "
        "nos padrões que o dizem.",
        "",
        "`motion` é o perfil de movimento do deck, e vale um destes: "
        + ", ".join(f"`{m}`" for m in MOTION_PROFILES)
        + ". Ele decide como um slide chega e como um fragmento entra, e mais nada; "
        "numa máquina que pediu menos movimento nenhuma animação roda, seja qual "
        "for o perfil.",
        "",
        f"O cabeçalho não acaba aí: o primeiro filho do `<deck>` é um "
        f"`<{DIRECTION_TAG}>` com a direção de arte, e toda `<section>` carrega um "
        f"`{ARC_ATTR}=` dizendo a sua função no arco. As duas últimas seções deste "
        "documento são sobre isso.",
        "",
        f"São {len(PATTERNS)} padrões, na ordem do arco. O orçamento é do slide "
        "inteiro, mobília inclusive, e nenhum slide passa de "
        f"{ABSOLUTE_BUDGET} palavras seja qual for o padrão.",
        "",
    ]
    for p in PATTERNS.values():
        out += [
            f"### `{p.name}` · até {p.budget} palavras",
            "",
            p.purpose
            + (f" — admite `<{BREAK_TAG}/>` na prosa" if p.allow_break else "")
            + ".",
            "",
            "| slot | papel | obrigatório | o que vai nele |",
            "| --- | --- | --- | --- |",
        ]
        for s in p.slots:
            need = "sim" if s.name in p.required else "não"
            out.append(f"| `{s.name}` | {ROLE_LABEL[s.role]} | {need} | {s.purpose} |")
        out.append("")

        if p.group:
            g = p.group
            flag = (
                f" `<{g.item} {g.flag}>` {g.flag_purpose}, em no máximo um `<{g.item}>`."
                if g.flag else ""
            )
            out += [
                f"De {g.minimum} a {g.maximum} `<{g.item}>` dentro de um `<{g.container}>`, "
                f"sem `class=` em nenhum dos dois — {g.purpose}.{flag}",
                "",
                "| campo | papel | obrigatório | o que vai nele |",
                "| --- | --- | --- | --- |",
            ]
            for f in g.fields:
                need = "sim" if f.name in g.required_fields else "não"
                out.append(f"| `{f.name}` | {ROLE_LABEL[f.role]} | {need} | {f.purpose} |")
            out.append("")

        if p.chart:
            c = p.chart
            out += [
                f"A série não é impressa, é desenhada: a `<section>` carrega um "
                f"`{c.attribute}=` a mais, que diz em que forma. São "
                f"{len(c.forms)} formas, e cada uma tem a sua faixa de pontos — "
                "fora dela a construção recusa.",
                "",
                f"| `{c.attribute}=` | pontos | o que desenha |",
                "| --- | --- | --- |",
            ]
            for f in c.forms:
                out.append(f"| `{f.name}` | {f.minimum} a {f.maximum} | {f.purpose} |")
            out += [
                "",
                f"Todo valor é um número — dígitos, com vírgula decimal e nada mais: "
                f"a unidade mora no slot `unit`, e o número é desenhado do jeito que "
                f"foi escrito. Negativo recusa. Numa forma de proporção "
                f"(`{', '.join(f.name for f in c.forms if f.proportion)}`) os valores "
                f"têm de somar exatamente {c.total}.",
                "",
            ]

        if p.figure:
            f = p.figure
            out += [
                f"A figura não é um slot de texto, e não leva `class=`: ou é um "
                f"`<{f.drawn}>` que você desenha, ou é um `<{f.imported}>` "
                f"apontando para um arquivo — a tag já diz qual dos dois.",
                "",
                f"Um `<{f.drawn}>` precisa do `{f.box}` e é montado só com estes "
                "elementos — "
                + ", ".join(f"`<{t}>`" for t in f.tags)
                + " — que só aceitam estes atributos: "
                + ", ".join(f"`{a}`" for a in f.attrs)
                + ". Qualquer outra tag ou atributo recusa, `<script>`, `<use>`, "
                "`href=` e `style=` inclusive.",
                "",
                "Toda cor vem do tema: "
                + " e ".join(f"`{a}`" for a in f.paint)
                + f" só aceitam `{f.unpainted}` ou `var(--token)`, e os tokens são "
                + ", ".join(f"`{t}`" for t in f.tokens)
                + ". Um hexadecimal, um `rgb()`, um nome de cor ou um `url()` "
                "recusam — é o que faz a mesma figura trocar de identidade junto "
                "com o deck.",
                "",
                f"Um `<{f.imported}>` carrega só `{f.path}=`, um caminho de "
                "arquivo — relativo à fonte do deck, ou absoluto — e nunca uma "
                "URL. O compilador embute o arquivo "
                "em base64: "
                + ", ".join(f"`{t.extension}`" for t in f.types)
                + f", até {_pt(megabytes(f.max_bytes))} cada. Caminho que não existe, "
                "arquivo acima do teto e bytes que não são do formato que a "
                "extensão promete recusam a construção — um retrato vazio nunca "
                "chega ao palco.",
                "",
            ]

        if p.table:
            out += [
                f"Um `<table>` sem `class=`, com um `<thead>` de um `<tr>` de `<th>` "
                "(o cabeçalho, obrigatório) e um `<tbody>` de um a "
                f"{TABLE_MAX_ROWS - 1} `<tr>` de `<td>` — {TABLE_MAX_ROWS} linhas ao "
                "todo, cabeçalho incluído, e toda linha do corpo com o mesmo número "
                "de células que o cabeçalho.",
                "",
            ]

    out += [
        "### Títulos que reprovam",
        "",
        "Um slot de papel **afirmação** que diga só uma destas reprova a construção — "
        "a categoria nomeia a pasta, não o ponto:",
        "",
        ", ".join(f"«{t}»" for t in CATEGORY_TITLES) + ".",
        "",
        "### Quebra forçada",
        "",
        f"`<{BREAK_TAG}/>` só é aceito, vazio e sem atributo, dentro da prosa destes "
        "padrões — nos demais a construção recusa: "
        + ", ".join(f"`{n}`" for n in breakable) + ".",
        "",
        "### Notas do apresentador",
        "",
        f"Um slide carrega no máximo um `<{NOTES_TAG}>`, sem `class=` e sem atributo "
        f"— a tag já diz o que é. O que vai nele é prosa, com as mesmas marcações de "
        f"ênfase e com `<{BREAK_TAG}/>` sempre disponível, e **não conta no orçamento "
        "de palavras**: a nota é lida por uma pessoa num painel, não pela sala num "
        "telão. Nada dela chega ao palco. Um `<"
        + NOTES_TAG + ">` vazio reprova — ou escreva a nota, ou tire a tag.",
        "",
        "### Fragmentos",
        "",
        f"Um slot marcado com o `{STEP_ATTR}` pelado (`<{SLOT_TAG} class=\"sentence\" "
        f"{STEP_ATTR}>`) só aparece depois que o apresentador avança. A ordem é a "
        "ordem em que o padrão lê os slots, nunca um número escrito no atributo — "
        f"`{STEP_ATTR}=\"2\"` reprova. Dois slots que o registro emparelha (o ícone e "
        "o texto de um item) entram no mesmo passo, e marcar um sem marcar o outro "
        "reprova. Um item de grupo não é fragmento: uma série é uma prova só, e meia "
        "linha do tempo é uma linha do tempo mentindo sobre o próprio eixo.",
        "",
        "**O passo zero não pode ser vazio.** Marcar todos os slots deixa o palco em "
        "branco até o primeiro avanço, e a sala lê isso como um slide que não "
        "carregou; o portão de render reprova, e o conserto é tirar o "
        f"`{STEP_ATTR}` de um deles.",
        "",
        "### A direção de arte",
        "",
        f"O primeiro filho do `<deck>` é um `<{DIRECTION_TAG}>`, e é ali que a "
        "direção de arte deste deck fica gravada. Cada escolha é um `<p>` com o "
        "nome dela na `class=`, do mesmo jeito que um slot de slide. **Nada disso "
        "chega ao palco e nada disso pinta coisa alguma** — o que a direção "
        "alimenta é o storyboard, onde a história ainda é barata de corrigir, e as "
        "réguas que cobram do deck aquilo que ela prometeu.",
        "",
        "| escolha | obrigatória | o que vai nela |",
        "| --- | --- | --- |",
    ]
    for c in DIRECTION_CHOICES:
        need = "sim" if c.name in DIRECTION_REQUIRED else "não"
        out.append(f"| `{c.name}` | {need} | {c.purpose} |")

    moments = [n for n in PATTERNS if moment_of(n)]
    # The one moment pattern whose slide has to be READ before it counts: a
    # drawing is a moment and a photograph is not, and the register knows which
    # patterns carry a figure without this line naming one by hand.
    drawn_moment = next(n for n in moments if figure_of(n))
    out += [
        "",
        "A capa sai destes padrões: "
        + ", ".join(f"`{n}`" for n in covers())
        + ".",
        "",
        "**Momento é um slide que segura o palco sozinho** — uma figura desenhada "
        "à mão, um gráfico, ou uma afirmação de tela cheia. São estes padrões: "
        + ", ".join(f"`{n}`" for n in moments)
        + f" — e um `{drawn_moment}` só conta quando a figura é um "
        f"`<{FIGURE_SPEC.drawn}>` desenhado, nunca quando é um "
        f"`<{FIGURE_SPEC.imported}>` embutido: uma fotografia não é um desenho.",
        "",
        f"`{MOMENTS_CHOICE}` diz quantos deles este deck se dá, e a contagem é "
        "cobrada contra a escala declarada:",
        "",
        f"| `{MOMENTS_CHOICE}` | momentos | |",
        "| --- | --- | --- |",
    ]
    for s in MOMENT_SCALES:
        out.append(f"| `{s.name}` | {s.span} | {s.purpose} |")

    out += [
        "",
        "As duas cores de conteúdo são as únicas que o tema empresta além do "
        "acento, e a direção diz o que cada uma significa neste deck. Um slide que "
        "gaste uma cor que a direção não declarou reprova a construção — uma figura "
        "pintada com ela, e também um gráfico, que o palco desenha nas duas sem "
        "ninguém escrever cor nenhuma. É assim que a mesma cor marca a mesma coisa "
        "do primeiro slide ao último.",
        "",
        "### A função no arco",
        "",
        f"Toda `<section>` carrega um `{ARC_ATTR}=` além do `pattern=`: o padrão "
        "diz que forma o slide tem, a função diz para que ele está ali, e nenhum "
        f"dos dois implica o outro. São {len(ARC_FUNCTIONS)} funções, na ordem do "
        "arco: "
        + ", ".join(f"`{a}` ({ARC_LABEL[a]})" for a in ARC_FUNCTIONS)
        + ".",
        "",
        "**O deck termina em fecho, e o fecho pede alguma coisa.** O último slide "
        "é um "
        + " ou ".join(f"`{n}`" for n in closings())
        + f" com `{ARC_ATTR}=\"{ARC_CALL}\"`; um deck que acaba sem pedir nada é "
        "um deck de que a sala sai sem saber o que se espera dela.",
    ]
    return "\n".join(out)


def _block(text):
    """The generated block of a document, or None when the markers are gone."""
    if BEGIN not in text or END not in text:
        return None
    return text.split(BEGIN, 1)[1].split(END, 1)[0].strip("\n")


def _read(path):
    """A file's text, and why it could not be read. One of the two is None."""
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read(), None
    except OSError as e:
        return None, e.strerror


def check(path):
    """True when the register is in order and the document publishes it.

    The document is named by its BASENAME in every message, not by the path it
    was handed: the proof beside this file points `--check` at a planted copy
    in a temp directory, and a red that opened with six `../` would be naming
    a file nobody has.
    """
    where = os.path.basename(path)

    # THE REGISTER IS CHECKED BEFORE THE DOCUMENT, because a document that
    # faithfully publishes a budget the spec forbids is two problems, and
    # only one of them is the document's.
    over = [p for p in PATTERNS.values() if p.budget > ABSOLUTE_BUDGET]
    if over:
        worst = max(over, key=lambda p: p.budget)
        print(f'REFUSED · bring the budget of "{worst.name}" down to '
              f"{ABSOLUTE_BUDGET} words or fewer in compiler/catalog.py — it "
              f"declares {worst.budget}, over the ceiling #207 puts on any "
              "slide whatever its pattern")
        return False

    # AND THE SECOND HALF OF THE REGISTER'S OWN HOUSEKEEPING (#214). Every
    # other name in this file is one the file itself owns; `FIGURE_TOKENS` is a
    # list of names the THEME owns, and a register naming one the theme dropped
    # would pass every check here while a figure painted with it paints
    # nothing at all -- the failure has no red anywhere and no pixel either.
    sheet, why = _read(TOKENS)
    if why:
        print("REFUSED · put themes/base/tokens.css back — "
              f"{why}; it declares the tokens a figure may paint with, and this "
              "register cannot be held to a sheet that is not there")
        return False
    declared = set(TOKEN_DECLARED.findall(sheet))
    stray = [t for t in FIGURE_TOKENS if t not in declared]
    if stray:
        print(f"REFUSED · take {stray[0]} out of FIGURE_TOKENS in "
              "compiler/catalog.py, or declare it in themes/base/tokens.css — a "
              "figure painted with a token no theme declares paints nothing, and "
              "nothing is exactly what the room would see")
        return False

    text, why = _read(path)
    if why:
        print(f"REFUSED · put {where} back and run `python3 compiler/catalog.py "
              f"--write` — {why}")
        return False

    found = _block(text)
    if found is None:
        print(f"REFUSED · put {BEGIN} and {END} back around the generated block of "
              f"{where}, then run `python3 compiler/catalog.py --write` — without "
              "the markers there is nothing to keep in step with the register")
        return False

    want = reference()
    if found != want:
        drift = sum(1 for a, b in zip(found.split("\n"), want.split("\n")) if a != b)
        drift += abs(len(found.split("\n")) - len(want.split("\n")))
        print(f"REFUSED · run `python3 compiler/catalog.py --write` — {where} is "
              f"{drift} line(s) out of step with compiler/catalog.py, and the "
              "reference a model reads is always the copy that aged")
        return False

    print(f"   ✓ {where} publishes the register: {len(PATTERNS)} patterns, "
          f"{sum(len(p.slots) for p in PATTERNS.values())} slots, "
          f"{len(CATEGORY_TITLES)} refused titles, "
          f"{len(FIGURE_TOKENS)} paint tokens the theme declares")
    return True


def write(path):
    """Put the register back into the document, between the markers."""
    text, why = _read(path)
    if why:
        print(f"REFUSED · write {path} by hand first, with {BEGIN} and {END} in "
              f"it — {why}")
        return False
    if _block(text) is None:
        print(f"REFUSED · put {BEGIN} and {END} into {path} around the place the "
              "generated block belongs")
        return False

    head, rest = text.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(head + BEGIN + "\n\n" + reference() + "\n\n" + END + tail)
    print(f"   wrote the register into {path}")
    return True


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="catalog.py",
        description="The pattern register, and the reference generated from it.",
    )
    ap.add_argument("document", nargs="?", default=DOCUMENT,
                    help="the Markdown file carrying the generated block")
    ap.add_argument("--check", action="store_true",
                    help="refuse when the document drifted from this register")
    ap.add_argument("--write", action="store_true",
                    help="rewrite the document's generated block from this register")
    args = ap.parse_args(argv)

    if args.check and args.write:
        print("REFUSED · ask for --check or --write, not both — one reads and the "
              "other writes, and running them together hides which one answered")
        return 1
    if args.check:
        return 0 if check(args.document) else 1
    if args.write:
        return 0 if write(args.document) else 1
    print(reference())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
