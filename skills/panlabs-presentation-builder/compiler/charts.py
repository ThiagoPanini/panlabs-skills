"""The chart generator: a written series in, one SVG out.

THE MODEL WRITES DATA AND THE COMPILER WRITES COORDINATES, and #94 is the
measurement that settled it. The same six-bar chart with axis and labels cost
30 lines and 79 hand-placed coordinates as literal SVG, against two lines of
data through a generator -- and the generator's axis came out CLEANER than the
hand-written one (a top of 20 with ticks every 5, where the hand had picked 16
with ticks every 4 to make it fit). The markup always rendered; what a hand
gets wrong in a chart is arithmetic, and arithmetic is exactly what no markup
validator ever catches.

NOT ONE COLOUR CROSSES THIS FILE. Every mark below carries a class and no
paint at all: `compiler/stage.html` binds each class to a token of the active
theme, which is the whole of #213's "as cores vêm dos tokens; nenhum hex
literal no SVG gerado". A generator that wrote `fill="#c8c8c8"` would be a
generator that painted `base` into a deck built in another theme.

ONE UNIT IS ONE CSS PIXEL AT 1600x900, AND THAT IS NOT A COINCIDENCE. The
stage gives the plot a box of exactly `--stage-height * 1.5` by
`--stage-height * 0.44`; at the 1600x900 the render gate measures at, the
stage is 900 tall and the box is 1350x396 -- the viewBox below, at scale 1.
So a font size written here in units is the same number of pixels the ruler
reads, and `FLOOR` is the type floor itself rather than an approximation of
it. At any other resolution everything scales together, which is why nothing
in this skill is ever measured in pixels.

SVG DOES NOT MEASURE TEXT, AND THAT IS THE ONE THING THIS FILE CANNOT DO FOR
THE AUTHOR. A label longer than the space its form gives it does not wrap and
does not error -- it runs under its neighbour or off the edge, and the
clipping is invisible to every ruler that measures against the STAGE. `room()`
is what closes that hole: it publishes, per form and per point count, how many
characters actually fit, and `compiler/audit.py` refuses the source before a
byte is drawn. It can do that because the labels are set in the mono face,
where every character is the same width.
"""

import html
import math
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from source import plain_text

# ── the plot's own coordinate system ─────────────────────────────────────────
PLOT_W = 1350
PLOT_H = 396

# The type floor, in plot units: 2.2% of the 900-pixel stage the gate measures.
# Nothing below writes a size under this, and `_text` refuses one that does.
FLOOR = 19.8

LABEL = 24          # a category name, an axis tick
VALUE = 26          # a number the room reads off a mark
CALLOUT = 44        # the one number a sparkline exists to deliver
SHARE_VALUE = 34    # a slice's share, in the legend

# The advance width of one character, as a fraction of the font size. Every
# monospaced face a machine is likely to fall back to sits at 0.6 (SF Mono,
# Menlo, DejaVu Sans Mono, Liberation Mono) or below (Consolas, 0.55); 0.62 is
# deliberately the wide side of that spread, because this number's whole job is
# to make `room()` refuse a label BEFORE it collides rather than after.
ADVANCE = 0.62


@dataclass(frozen=True)
class Point:
    """One written point of a series: what it is called, and how much it is."""

    label: str
    said: str        # the value exactly as the author wrote it, drawn verbatim
    value: Decimal
    marked: bool


# ── the number ───────────────────────────────────────────────────────────────
# THE ONE PLACE A WRITTEN NUMBER BECOMES A NUMBER. Both the ruler that refuses
# a series and the generator that draws it ask this function, so there is no
# second grammar to drift from the first.
#
# THE DECIMAL MARK IS THE COMMA AND THERE IS NO THOUSANDS SEPARATOR, which is
# a renunciation and not an oversight: `1.800` is one thousand eight hundred to
# half a room and one point eight to the other half, and a compiler that picked
# a side would draw a bar nine hundred and ninety-nine times too short without
# one ruler going red. Written as digits with at most one comma, there is
# nothing left to guess. The trigger to reopen it is the first deck whose
# `lang=` is not Portuguese and whose author writes a dot.
VALUE_GRAMMAR = re.compile(r"^\d+(,\d+)?$")


def parse(said):
    """The Decimal a written value means, or None when it is not a number."""
    text = said.strip()
    if not VALUE_GRAMMAR.match(text):
        return None
    try:
        return Decimal(text.replace(",", "."))
    except InvalidOperation:      # pragma: no cover -- the grammar already refused it
        return None


def series(container, group):
    """Every `<li>` of a chart's group, read into Points in the author's order.

    A SERIES HAS NO CATALOG ORDER TO FALL BACK ON, the same reason
    `build.py`'s `group_markup` reads source order: the sequence the author
    wrote is the sequence the chart means, and a bar chart sorted by anything
    else is a different argument.

    A point whose value is not a number comes back with `value` None. The
    `chart-data` ruler is what refuses it; this function's job is to report
    what is written, never to judge it.
    """
    out = []
    for item in container.elements():
        if item.tag != group.item:
            continue
        fields = {el.attrs.get("class", "").strip(): el for el in item.elements()}
        label = plain_text(fields["label"]) if "label" in fields else ""
        said = plain_text(fields["value"]).strip() if "value" in fields else ""
        out.append(Point(label=label, said=said, value=parse(said),
                         marked=bool(group.flag and group.flag in item.attrs)))
    return out


# ── how much room a label has, per form ──────────────────────────────────────

def _chars(units, size):
    """How many characters of `size` fit across `units`, rounded down."""
    return max(1, int(units / (size * ADVANCE)))


def _room(form, n):
    """The character ceilings a form gives one label and one value, at N points.

    A form that draws no number per point carries no `value` key at all, so
    the caller has nothing to measure rather than a number it must know to
    ignore.
    """
    if form == "bars-h":
        return {"label": _chars(BH_LABEL_W, LABEL), "value": _chars(BH_VALUE_W - 14, VALUE)}
    if form == "bars-v":
        col = PLOT_W / n
        return {"label": _chars(col * 0.92, LABEL), "value": _chars(col * 0.92, VALUE)}
    # THE ONLY THING THAT CROWDS AN X LABEL IS THE NEXT ONE. Both forms below
    # anchor their first and last labels to the ends of the plot rather than
    # centring them (see `_curve`), so neither can run off an edge and the
    # distance between two neighbours is the whole constraint. The gutter is
    # taken at its minimum, which is what every realistic axis produces -- a
    # tick label past ten characters widens it, and makes this ceiling
    # generous by a character or two rather than wrong.
    if form in ("line", "area"):
        span = (PLOT_W - AX_INSET) - (AX_LABEL_W + AX_INSET)
        return {"label": _chars(span / max(1, n - 1) * 0.92, LABEL)}
    if form == "sparkline":
        span = (PLOT_W - SP_CALLOUT_W - SP_PAD) - SP_PAD
        return {"label": _chars(span / max(1, n - 1) * 0.92, LABEL),
                "value": _chars(SP_CALLOUT_W - 40, CALLOUT)}
    if form == "share":
        entry = PLOT_W / n - SH_SWATCH - 32
        # One under, because a slice's number is drawn with its percent sign.
        return {"label": _chars(entry, LABEL),
                "value": max(1, _chars(entry, SHARE_VALUE) - 1)}
    return {}


# WHOSE NUMBER IS ACTUALLY DRAWN, per form. A line and an area put every value
# on the grid and none of them in words; a sparkline draws exactly one, the
# last, which is the figure it exists to leave behind. Measuring a value no
# form ever paints would be a red about nothing, and this table is why the
# audit never has to know which is which.
DRAWN_VALUES = {
    "bars-h": "every", "bars-v": "every", "share": "every",
    "sparkline": "last", "line": "none", "area": "none",
}


def overlong(form, points):
    """Every drawn string this form has no room for: (kind, text, ceiling).

    THIS IS THE HOLE SVG LEAVES OPEN AND NOTHING ELSE CLOSES. A label wider
    than its slot does not wrap and does not error -- it runs under its
    neighbour, or off the plot's own edge where the clipping hides it from
    every ruler that measures against the stage. Refusing it in the source is
    the only place it can be caught, and it is catchable at all only because
    the chart's text is set in the mono face.
    """
    ceiling = _room(form, max(1, len(points)))
    drawn = DRAWN_VALUES.get(form, "none")
    said = []
    for i, p in enumerate(points):
        if "label" in ceiling and len(p.label) > ceiling["label"]:
            said.append(("label", p.label, ceiling["label"]))
        if "value" not in ceiling:
            continue
        if drawn == "every" or (drawn == "last" and i == len(points) - 1):
            if len(p.said) > ceiling["value"]:
                said.append(("value", p.said, ceiling["value"]))
    return said


# ── writing an element ───────────────────────────────────────────────────────

def _n(v):
    """A coordinate, short and stable: two decimals, and no trailing zeros."""
    s = f"{float(v):.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def _rect(x, y, w, h, cls):
    return (f'<rect class="{cls}" x="{_n(x)}" y="{_n(y)}" width="{_n(max(w, 2))}" '
            f'height="{_n(max(h, 2))}"/>')


def _line(x1, y1, x2, y2, cls):
    return (f'<line class="{cls}" x1="{_n(x1)}" y1="{_n(y1)}" x2="{_n(x2)}" '
            f'y2="{_n(y2)}"/>')


def _dot(x, y, r, cls):
    return f'<circle class="{cls}" cx="{_n(x)}" cy="{_n(y)}" r="{_n(r)}"/>'


def _points(pairs):
    return " ".join(f"{_n(x)},{_n(y)}" for x, y in pairs)


def _text(x, y, size, cls, said, anchor=None, baseline=None):
    """One string of drawn text, and the guard that no string is unreadable.

    THE FLOOR IS CHECKED HERE AND NOT ONLY IN THE BROWSER. The render gate
    measures what painted, which is the honest last word -- but a size written
    under the floor is a defect of THIS file, and a compiler that shipped it
    and waited for a browser to say so would be asking a ruler to cover for a
    bug in the thing it measures.
    """
    if size < FLOOR:
        raise ValueError(
            f"raise the {cls} text in compiler/charts.py to at least {FLOOR} units "
            f"— it asks for {size}, under the type floor the theme sets at 2.2% "
            "of the stage height"
        )
    extra = f' text-anchor="{anchor}"' if anchor else ""
    extra += f' dominant-baseline="{baseline}"' if baseline else ""
    return (f'<text class="{cls}" x="{_n(x)}" y="{_n(y)}" font-size="{_n(size)}"'
            f"{extra}>{html.escape(said, quote=False)}</text>")


# ── the axis ─────────────────────────────────────────────────────────────────
# ONLY THE TWO FORMS THAT DRAW A GRID ASK FOR ONE. Bars carry the number at the
# end of the mark, which IS the axis and reads better than one; a sparkline
# has no axis by definition, and drawing it one would make it a line chart.

STEPS = (Decimal(1), Decimal(2), Decimal("2.5"), Decimal(5))
TICKS_MAX = 5


def _steps(span):
    """Candidate tick steps, smallest first: 1, 2, 2.5, 5, then ten times over."""
    magnitude = Decimal(10) ** int(math.floor(math.log10(float(span) / 4)))
    for _ in range(24):
        for m in STEPS:
            yield m * magnitude
        magnitude *= 10


def scale(values, zero_based):
    """The axis a series is drawn against: (low, high, step), all exact.

    A FILLED MARK STARTS AT ZERO AND A STROKE DOES NOT. An area's height is
    its magnitude, so a suppressed zero makes it lie about proportion; a line
    marks POSITION, and holding it to zero flattens the very change it was
    drawn to show. The one guard on the second is the 35% below: a series whose
    floor is close to zero anyway is drawn from zero, so the axis only ever
    zooms in when zooming in is the point.

    THE STEP IS CHOSEN AGAINST THE ROUNDED RANGE, NOT THE RAW ONE, and the
    difference is a chart nobody would ship: 9 to 21 spans 12, which a step of
    2.5 covers in five -- but rounding out to 7,5 and 22,5 turns those five
    into seven, and seven lines of grid behind four points is a table wearing a
    chart's clothes. Trying each step against the range it actually produces is
    the only way the ceiling means what it says.
    """
    high = max(values)
    low = Decimal(0) if zero_based else min(values)
    if not zero_based and low <= high * Decimal("0.35"):
        low = Decimal(0)
    span = high - low
    if span <= 0:
        span = high if high > 0 else Decimal(1)
    for step in _steps(span):
        bottom = (low / step).to_integral_value(rounding="ROUND_FLOOR") * step
        top = (high / step).to_integral_value(rounding="ROUND_CEILING") * step
        if top == bottom:
            top = bottom + step
        if (top - bottom) / step <= TICKS_MAX:
            return bottom, top, step
    raise ValueError(                     # pragma: no cover -- the step grows without bound
        f"widen the step family in compiler/charts.py — no step covers {low} to "
        f"{high} in {TICKS_MAX} intervals"
    )


def _tick_label(d):
    """A tick, written the way the deck writes its own numbers."""
    said = format(d.normalize(), "f")
    if "." in said:
        said = said.rstrip("0").rstrip(".")
    return said.replace(".", ",")


def _ticks(low, high, step):
    out = []
    v = low
    while v <= high:
        out.append(v)
        v += step
    return out


# ── bars-h ───────────────────────────────────────────────────────────────────
# The label has a column of its own, which is why this is the form that takes
# a long name, and the number sits at the end of its own bar -- close enough to
# the mark that nobody has to read across a grid to pair them.

BH_LABEL_W = 340
BH_VALUE_W = 150
BH_GAP = 20


def _bars_h(points):
    # THE COLUMN IS AS WIDE AS THE LONGEST NAME AND NEVER WIDER. `BH_LABEL_W`
    # is the CEILING `_room` refuses against, not a fixed indent -- held fixed,
    # a chart of five-letter names would open with a third of the stage empty
    # and its bars a third shorter for nothing.
    width = max(len(p.label) for p in points) * LABEL * ADVANCE
    label_w = min(BH_LABEL_W, width)
    x0 = label_w + BH_GAP
    track = PLOT_W - x0 - BH_GAP - BH_VALUE_W
    top = max(p.value for p in points)
    row = PLOT_H / len(points)
    thick = min(max(row * 0.52, 24), 88)

    out = [_line(x0, 0, x0, PLOT_H, "axis")]
    for i, p in enumerate(points):
        middle = row * i + row / 2
        width = float(p.value / top) * track
        out.append(_rect(x0, middle - thick / 2, width, thick,
                         "mark is-marked" if p.marked else "mark"))
        # RIGHT-ALIGNED AGAINST THE AXIS, not left against the plot's edge. A
        # column of labels set flush left leaves a gap of its own between the
        # short ones and the bars they name, and the eye has to travel it to
        # pair them; ranged right, every label ends the same distance from its
        # own mark whatever its length.
        out.append(_text(label_w, middle, LABEL, "label", p.label,
                         anchor="end", baseline="central"))
        out.append(_text(x0 + width + 14, middle, VALUE, "value", p.said,
                         anchor="start", baseline="central"))
    return out


# ── bars-v ───────────────────────────────────────────────────────────────────
# The label sits under its column and the column is 1/n of the stage, which is
# the whole reason `room()` gives this form the tightest ceiling of the six --
# and why the red it produces points at bars-h rather than at a shorter word.

BV_BAND = 34
BV_GAP = 10


def _bars_v(points):
    floor_y = PLOT_H - BV_BAND - BV_GAP
    ceiling_y = BV_BAND + BV_GAP
    height = floor_y - ceiling_y
    top = max(p.value for p in points)
    col = PLOT_W / len(points)
    thick = min(col * 0.58, 140)

    out = [_line(0, floor_y, PLOT_W, floor_y, "axis")]
    for i, p in enumerate(points):
        middle = col * i + col / 2
        tall = float(p.value / top) * height
        out.append(_rect(middle - thick / 2, floor_y - tall, thick, tall,
                         "mark is-marked" if p.marked else "mark"))
        out.append(_text(middle, floor_y - tall - 10, VALUE, "value", p.said,
                         anchor="middle"))
        out.append(_text(middle, floor_y + BV_GAP + 2, LABEL, "label", p.label,
                         anchor="middle", baseline="hanging"))
    return out


# ── line and area ────────────────────────────────────────────────────────────
# One drawing with one difference: the area closes down to the axis.

AX_LABEL_W = 150     # the gutter the y ticks sit in, and its MINIMUM
AX_INSET = 44        # the air between the grid's edge and the first point
AX_BAND = 34
AX_GAP = 12


def _edge_anchor(i, last):
    """First label to the right, last to the left, everything else centred.

    A CENTRED LABEL AT EITHER END WALKS OFF THE PLOT, and off the plot is
    invisible: an SVG with a viewBox clips, and a clipped label has the same
    bounding box it always had, so the render gate sees nothing wrong. Anchored
    to the end it sits against, a label can only ever grow inwards -- which
    also means the one thing that can crowd it is its neighbour, and that is
    the single number `_room` has to reason about.
    """
    return "start" if i == 0 else ("end" if i == last else "middle")


def _curve(points, filled):
    low, high, step = scale([p.value for p in points], zero_based=filled)
    ticks = _ticks(low, high, step)
    gutter = max(AX_LABEL_W,
                 max(len(_tick_label(t)) for t in ticks) * LABEL * ADVANCE + 16)
    x0 = gutter + AX_INSET
    x1 = PLOT_W - AX_INSET
    y0 = 16
    y1 = PLOT_H - AX_BAND - AX_GAP
    reach = high - low

    def at(v):
        return y1 - float((v - low) / reach) * (y1 - y0)

    out = []
    for tick in ticks:
        y = at(tick)
        out.append(_line(gutter + 16, y, PLOT_W, y, "axis" if tick == low else "grid"))
        out.append(_text(gutter - 16, y, LABEL, "label", _tick_label(tick),
                         anchor="end", baseline="central"))

    gap = (x1 - x0) / max(1, len(points) - 1)
    plotted = [(x0 + gap * i, at(p.value)) for i, p in enumerate(points)]
    if filled:
        out.append(f'<polygon class="area" points="'
                   + _points([(plotted[0][0], y1)] + plotted + [(plotted[-1][0], y1)])
                   + '"/>')
    out.append(f'<polyline class="line" points="{_points(plotted)}"/>')

    last = len(points) - 1
    for i, ((x, y), p) in enumerate(zip(plotted, points)):
        out.append(_dot(x, y, 10 if p.marked else 7,
                        "dot is-marked" if p.marked else "dot"))
        out.append(_text(x, y1 + AX_GAP + 2, LABEL, "label", p.label,
                         anchor=_edge_anchor(i, last), baseline="hanging"))
    return out


# ── sparkline ────────────────────────────────────────────────────────────────
# No axis, no grid, no number on any point but the last: the shape of the
# trend, and the one figure the slide is there to leave behind. What separates
# it from `line` is everything it does NOT draw.

SP_PAD = 60
SP_CALLOUT_W = 210


def _sparkline(points):
    x0 = SP_PAD
    x1 = PLOT_W - SP_CALLOUT_W - SP_PAD
    y0 = 34
    y1 = PLOT_H - AX_BAND - AX_GAP
    values = [p.value for p in points]
    low, high = min(values), max(values)
    reach = high - low

    def at(v):
        if reach == 0:
            return (y0 + y1) / 2
        return y1 - float((v - low) / reach) * (y1 - y0)

    gap = (x1 - x0) / (len(points) - 1)
    plotted = [(x0 + gap * i, at(p.value)) for i, p in enumerate(points)]
    out = [f'<polyline class="line" points="{_points(plotted)}"/>']

    last = plotted[-1]
    out.append(_dot(last[0], last[1], 11, "dot is-marked"))
    out.append(_text(last[0] + 30, last[1], CALLOUT, "callout", points[-1].said,
                     anchor="start", baseline="central"))

    end = len(points) - 1
    for i, ((x, y), p) in enumerate(zip(plotted, points)):
        if p.marked:
            out.append(_dot(x, y, 10, "dot is-marked"))
        out.append(_text(x, y1 + AX_GAP + 2, LABEL, "label", p.label,
                         anchor=_edge_anchor(i, end), baseline="hanging"))
    return out


# ── share ────────────────────────────────────────────────────────────────────
# One bar, one colour per slice, and the legend under it carrying the name and
# the share. The bar itself says nothing in words: a slice too narrow to hold
# its own number would either lose it or overlap its neighbour, and a legend
# that always reads is worth more than a number that sometimes does.

SH_BAR_Y = 26
SH_BAR_H = 180
SH_SEG_GAP = 6
SH_SWATCH = 26
SH_LABEL_Y = 288
SH_VALUE_Y = 348


def _share(points):
    total = PLOT_W - SH_SEG_GAP * (len(points) - 1)
    out = []
    x = 0.0
    for i, p in enumerate(points):
        width = float(p.value) / 100.0 * total
        out.append(_rect(x, SH_BAR_Y, width, SH_BAR_H, f"slice slice-{i + 1}"))
        x += width + SH_SEG_GAP

    entry = PLOT_W / len(points)
    for i, p in enumerate(points):
        left = entry * i
        out.append(_rect(left, SH_LABEL_Y - SH_SWATCH / 2, SH_SWATCH, SH_SWATCH,
                         f"slice slice-{i + 1}"))
        out.append(_text(left + SH_SWATCH + 16, SH_LABEL_Y, LABEL, "label", p.label,
                         anchor="start", baseline="central"))
        out.append(_text(left + SH_SWATCH + 16, SH_VALUE_Y, SHARE_VALUE, "value",
                         f"{p.said}%", anchor="start"))
    return out


# ── the drawing ──────────────────────────────────────────────────────────────

FORMS = {
    "bars-h": _bars_h,
    "bars-v": _bars_v,
    "line": lambda points: _curve(points, filled=False),
    "area": lambda points: _curve(points, filled=True),
    "sparkline": _sparkline,
    "share": _share,
}


def draw(form, points):
    """One chart, as inline SVG. Only ever called on a series the rulers passed.

    THE `aria-label` IS THE SERIES ITSELF. A screen reader handed a drawing
    gets the numbers the drawing is of, in the order they were written -- and
    it costs nothing on the stage, where the same numbers are already painted.
    """
    said = ", ".join(f"{p.label} {p.said}" for p in points)
    body = "".join(FORMS[form](points))
    return (f'<svg class="plot" viewBox="0 0 {PLOT_W} {PLOT_H}" role="img" '
            f'aria-label="{html.escape(said, quote=True)}">{body}</svg>')
