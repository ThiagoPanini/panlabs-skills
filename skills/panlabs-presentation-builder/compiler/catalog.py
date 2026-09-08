#!/usr/bin/env python3
"""The catalog: every name the dialect knows, in the one place that knows it.

    python3 compiler/catalog.py            # the reference, on stdout
    python3 compiler/catalog.py --check    # CATALOG.md still says what this says
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
from dataclasses import dataclass


# The five things a deck's header has to say about itself. `theme` is here
# because a deck knows which identity it was written for; the build command
# can still override it, which is what lets the same deck be rebuilt in
# `base` to prove the patterns hold without a brand behind them.
DECK_FIELDS = ("title", "occasion", "theme", "lang", "minutes")

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
        ),
        Pattern(
            name="full-bleed-statement",
            slots=(
                Slot("statement", CLAIM, "a frase que o slide inteiro sustenta"),
            ),
            required=("statement",),
            budget=12,
            purpose="Uma frase em corpo de display, segurando o palco sozinha",
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


# ── the reference the model reads ────────────────────────────────────────────
# Generated, never written: `CATALOG.md` carries the block between the two
# markers below and nothing else of this file's business. The prose around
# the block is a human's to write.

BEGIN = "<!-- catalog:begin -->"
END = "<!-- catalog:end -->"

DOCUMENT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "CATALOG.md")


def reference():
    """The whole register, as Markdown, exactly as CATALOG.md publishes it."""
    breakable = [p.name for p in PATTERNS.values() if p.allow_break]
    out = [
        "O cabeçalho é o próprio `<deck>`, e os cinco campos são obrigatórios: "
        + ", ".join(f"`{f}`" for f in DECK_FIELDS)
        + f". Um slot é um `<{SLOT_TAG}>` com o nome do slot na `class=` e nada mais. "
        "O vocabulário de ênfase inline fecha em três marcações: "
        + " e ".join(f"`<{t}>`" for t in INLINE_TAGS)
        + f", sempre disponíveis, e `<{BREAK_TAG}/>` (quebra forçada), disponível só "
        "nos padrões que o dizem.",
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
    ]
    return "\n".join(out)


def _block(text):
    """The generated block of a document, or None when the markers are gone."""
    if BEGIN not in text or END not in text:
        return None
    return text.split(BEGIN, 1)[1].split(END, 1)[0].strip("\n")


def _document(path):
    """The document's text, and why it could not be read. One of the two is None."""
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

    text, why = _document(path)
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
          f"{len(CATEGORY_TITLES)} refused titles")
    return True


def write(path):
    """Put the register back into the document, between the markers."""
    text, why = _document(path)
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
