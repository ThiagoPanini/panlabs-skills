#!/usr/bin/env python3
"""THE BUILDER: skeleton.html + argument.json -> one self-contained .html.

It does exactly two things, and the split matters:

  1. VALIDATES the argument against `register.py` before anything is written.
     The model's output is data, so it can be refused with a message that
     names its own fix -- which is the only kind of failure worth having.
  2. RENDERS. Every class name, every coordinate, every `calc()` is emitted
     HERE or already lives in the skeleton. Nothing geometric crosses the
     seam from the model's side, because on the model's side there is no
     markup to put it in.

WHY THE LINE IS HERE, and not at "the model writes HTML into markers".
Measured, not argued: `cut.py` reads the #105 file the owner chose and finds
that hand-writing the section markup costs 49 distinct class names. That is
not a contract, it is a second CSS framework the model has to remember, and
premise 7 is not being met at that number. The model writes 4 beat kinds and
8 block kinds instead.
"""
import html as H
import json
import pathlib
import re
import sys

from register import REGISTER, BEATS, INLINE

HERE = pathlib.Path(__file__).resolve().parent
MARKER = "<!--P:{}-->"

# The holes this builder knows how to fill, declared as data so a checker can
# read them instead of grepping this file's source. An extractor that parses
# code is the one extractor that rots on a refactor -- and the whole argument
# of check 3 is that a name should be a fact somewhere, never an inference.
FILLS = ("TITLE", "FIGURE", "BEATS", "OCCASION")


class Refused(Exception):
    """The argument is not buildable. The message names its own fix."""


# --------------------------------------------------------------------------
# validation -- an invocation check, in this house's vocabulary
# --------------------------------------------------------------------------
_TAG = re.compile(r"</?([a-zA-Z][\w-]*)")


def _text(v, where):
    """Free text: prose plus the inline emphasis the identity actually uses.

    The deck's emphasis is a WEIGHT SWAP, never an italic and never `b="1"`;
    `<b>` is the one tag that survives into the model's side. Everything else
    is refused, and `style=` most of all: a `<span style="font-size:…">` is
    geometry wearing prose's clothes, and it is exactly how a content layer
    starts re-ruling a document nobody asked it to re-rule.
    """
    if not isinstance(v, str):
        raise Refused(f"{where}: expected text, got {type(v).__name__}")
    for tag in _TAG.findall(v):
        if tag.lower() not in INLINE:
            raise Refused(f"{where}: <{tag}> is not allowed in text. "
                          f"Allowed inline markup: {', '.join(INLINE)}.")
    if "style=" in v or "class=" in v:
        raise Refused(f"{where}: style= / class= in text. Geometry does not "
                      f"cross this seam; put it in the skeleton.")
    return v


def _walk(v, where):
    """Apply `_text` to EVERY string in a field, however deeply it is nested.

    The guard used to be `isinstance(v, str)` at the top level and nothing
    else, and six of the eight blocks carry their prose in a LIST -- `items`,
    `rows`, `cols`. All six slipped past it whole: a `<script>` in a list item
    reached the output verbatim, and `_text`'s promise above was false for
    most of the text a model actually writes. Numbers are not prose and are
    left alone; a column width has nothing to escape.
    """
    if isinstance(v, str):
        _text(v, where)
    elif isinstance(v, (list, tuple)):
        for i, item in enumerate(v, 1):
            _walk(item, f"{where}[{i}]")
    elif isinstance(v, dict):
        for k, item in v.items():
            _walk(item, f"{where}.{k}")


def _need(d, spec, where):
    missing = [k for k in spec["fields"] if k not in d]
    if missing:
        raise Refused(f"{where}: missing {', '.join(missing)}")
    known = set(spec["fields"]) | set(spec["opt"]) | {"kind", "lit"}
    extra = [k for k in d if k not in known]
    if extra:
        raise Refused(f"{where}: unknown key(s) {', '.join(extra)}. "
                      f"Known: {', '.join(sorted(known))}")


def validate(arg):
    for k in ("title", "occasion", "beats"):
        if k not in arg:
            raise Refused(f"argument: missing {k}")
    _text(arg["title"], "title")
    _text(arg["occasion"], "occasion")

    if not arg["beats"]:
        raise Refused("argument: beats is empty")
    # The seam: `lit` no longer counts against ONE figure, it counts against
    # the figure IN FORCE at that beat. This is the whole price of #120 on
    # the contract side, and the refusal below is what keeps it from being a
    # price paid in silence.
    parts_at = _figure_parts(arg)
    for i, b in enumerate(arg["beats"], 1):
        where = f"beat {i}"
        kind = b.get("kind")
        if kind not in BEATS:
            raise Refused(f"{where}: kind '{kind}' is not a beat. "
                          f"Known: {', '.join(BEATS)}")
        _need(b, BEATS[kind], where)
        for k, v in b.items():
            # `figure` is a block, not prose -- `_figure_parts` already
            # checked it, and _text() would refuse a dict. #120.
            if k in ("kind", "lit", "block", "figure"):
                continue
            _walk(v, f"{where}.{k}")
        if kind == "block":
            _check_block(b["block"], f"{where}.block")
        n_lit = parts_at[i - 1]
        for j in b.get("lit", []):
            if not (1 <= j <= n_lit):
                raise Refused(
                    f"{where}: lit {j} has nothing to light — the figure in "
                    f"force here has {n_lit} lightable part(s).")
    return arg


def _figures(arg):
    """The one walk of the flat array: (figures, index in force per beat).

    Validation and render both read this. Two walks that have to agree are
    two walks that will not -- and the disagreement would show up as a beat
    lighting parts of a figure it is not looking at, which produces no error
    and a page that lies. Exactly the failure class #93 named.
    """
    figs, at, cur = [], [], -1
    if arg.get("figure"):
        figs.append(arg["figure"])
        cur = 0
    for b in arg["beats"]:
        if b.get("figure"):
            figs.append(b["figure"])
            cur = len(figs) - 1
        at.append(max(cur, 0))
    return figs, at


def _figure_parts(arg):
    """How many lightable parts the figure in force at each beat has."""
    figs, at = _figures(arg)
    for i, f in enumerate(figs):
        where = "figure" if i == 0 and arg.get("figure") else f"figure {i + 1}"
        _check_block(f, where, as_figure=True)
    # A figure no beat is ever looking at is bytes in the band that never
    # paint. It is not a lie, so nothing on screen would ever show it -- which
    # is exactly why it has to be refused here and not noticed later.
    seen = set(at)
    dead = [i + 1 for i in range(len(figs)) if i not in seen]
    if dead:
        raise Refused(
            f"figure {dead[0]} is never in force — the next beat replaces it "
            f"before any beat looks at it. Drop it, or move the figure that "
            f"replaces it further down.")
    n = [_parts(f) for f in figs]
    return [n[i] for i in at] if figs else [0] * len(arg["beats"])


def _check_block(b, where, as_figure=False):
    """Returns how many `data-i` parts the block renders."""
    kind = b.get("kind")
    if kind not in REGISTER:
        raise Refused(f"{where}: kind '{kind}' is not a block. "
                      f"Known: {', '.join(REGISTER)}")
    spec = REGISTER[kind]
    _need(b, spec, where)
    if as_figure and not spec["lit"]:
        raise Refused(f"{where}: '{kind}' cannot be the figure — it has no "
                      f"parts to light. Figure-capable: "
                      f"{', '.join(k for k, s in REGISTER.items() if s['lit'])}")
    for k, v in b.items():
        if k != "kind":
            _walk(v, f"{where}.{k}")
    return _parts(b)


def _parts(b):
    k = b["kind"]
    if k in ("list", "parts", "steps", "metrics"):
        return len(b["items"])
    if k in ("table", "chart"):
        return len(b["rows"])
    return 0


# --------------------------------------------------------------------------
# render -- every class name in this file also exists in the skeleton's CSS,
# and the suite's emitted-classes check is what makes that a fact, not a hope.
# --------------------------------------------------------------------------
_ICONS = None


def _icon_names():
    """The icon names the ENGINE declares, read from the skeleton.

    Never listed here. A second list is a second place to be wrong, and it is
    the same argument the register makes about block names: read both sides
    and compare, so adding an icon to the skeleton needs no edit in this file.
    """
    global _ICONS
    if _ICONS is None:
        sk = (HERE / "skeleton.html").read_text(encoding="utf-8")
        _ICONS = frozenset(re.findall(r'<symbol id="i-([a-z0-9-]+)"', sk))
    return _ICONS


def ico(name):
    """An icon name is MARKUP, not prose, and `_text` is the wrong guard for
    it: `x" onload="…` carries no tag and no `style=`, so it passes, and then
    it lands inside an attribute. Checked here because here is the one place
    the name becomes markup, whichever block supplied it. A name that is not
    in the engine is refused too -- `<use>` pointing at nothing draws nothing,
    with no error, which is the silent class this house does not ship.
    """
    if not isinstance(name, str) or name not in _icon_names():
        raise Refused(
            f"icon '{name}' is not in the engine. "
            f"Available: {', '.join(sorted(_icon_names()))}")
    return f'<svg class="ic"><use href="#i-{name}"/></svg>'


def _head(e):
    h = e.get("head")
    return f"<span class=bh>{h}</span>" if h else ""


def _di(i, lit):
    return f' data-i="{i}"' if lit else ""


def quote(e, lit=False):
    return (f'<div class="blk b-quote">{_head(e)}'
            f'<span class="qm">&ldquo;</span>'
            f'<div class="qt disp">{e["text"]}</div>'
            f'<div class="qs"><span class=ln></span>{e["src"]}</div></div>')


def lst(e, lit=False):
    it = "".join(f'<div class=it{_di(i, lit)}>{ico(e["icon"])}'
                 f'<span class=tx>{t}</span></div>'
                 for i, t in enumerate(e["items"], 1))
    on = " on" if e["icon"] == "check" else ""
    return f'<div class="blk b-list{on}">{_head(e)}{it}</div>'


def number(e, lit=False):
    return (f'<div class="blk">{_head(e)}'
            f'<div class=b-num><span class=n>{e["num"]}</span>'
            f'<span class=sf>{e["suf"]}</span></div>'
            f'<div class="b-numc disp">{e["cap"]}</div>'
            f'<div class=b-numn>{e["note"]}</div></div>')


def parts(e, lit=False):
    # `b-pieces` is the skeleton's class and `parts` is the model's word for
    # the same block. The register declares both, and #117 is why they differ.
    cards = "".join(
        f'<div class=pc{_di(i, lit)}><span class="nn ok-overlap">{i:02d}</span>'
        f'{ico(ic)}<span class="ti disp">{t}</span><span class=ru></span>'
        f'<span class=ct>{c}</span></div>'
        for i, (t, ic, c) in enumerate(e["items"], 1))
    return f'<div class="blk">{_head(e)}<div class=b-pieces>{cards}</div></div>'


def steps(e, lit=False):
    rows = "".join(
        f'<div class=r{_di(i, lit)}><span class="k disp">{i:02d}</span><span>'
        f'<span class=tt>{t}</span><span class=p>{p}</span></span></div>'
        for i, (t, p) in enumerate(e["items"], 1))
    return f'<div class="blk b-steps">{_head(e)}{rows}</div>'


def table(e, lit=False):
    hd = "".join(f'<span class="{"n" if k == "n" else ""}" '
                 f'style="width:{w}%">{c}</span>' for c, w, k in e["cols"])
    rs = []
    for i, row in enumerate(e["rows"]):
        cls = " hi" if e.get("hi") == i else ""
        # No positional `c0..cN`: only `.c0` ever had a rule, so `c1..c3` were
        # class names with nothing on the other side — the exact silent shape
        # check 3 exists to catch, and it caught them on its first run. The
        # column KIND (`k`/`n`) already carries everything the styling needs.
        cells = "".join(
            f'<span{f" class={k}" if k in ("n", "k") else ""} '
            f'style="width:{w}%">{v}</span>'
            for (v, (_, w, k)) in zip(row, e["cols"]))
        rs.append(f'<div class="r{cls}"{_di(i + 1, lit)}>{cells}</div>')
    note = f'<div class=b-tbn>{e["note"]}</div>' if e.get("note") else ""
    return (f'<div class="blk b-tb">{_head(e)}<div class=hd>{hd}</div>'
            f'{"".join(rs)}</div>{note}')


def metrics(e, lit=False):
    cs = "".join(
        f'<div class=c{_di(i, lit)}>'
        f'<span class=v>{v}<span class=su>{su}</span></span>'
        f'<span class=d>{d}</span><span class=s>{s}</span></div>'
        for i, (v, su, d, s) in enumerate(e["items"], 1))
    return f'<div class="blk">{_head(e)}<div class=b-mx>{cs}</div></div>'


def chart(e, lit=False):
    """The bar generator lives in the engine (#94: 220 B against 1992 B of
    literal SVG). Every attribute is QUOTED, and that is not style: in SVG
    embedded in HTML, `height=29.50/>` makes the parser swallow the slash into
    the unquoted value, the attribute falls to 0, the bar disappears, the axis
    goes diagonal -- and there is NO MARKUP ERROR.
    """
    rows, unit, h, ppu = e["rows"], e.get("unit", ""), 44, 13.48
    mx = max(v for _, v in rows) or 1
    n = len(rows)
    slot, base = 100 / n, h - 7.5
    bw = slot * 0.44
    fs_val, fs_lab = 10 / 405 * 900 / ppu, 8 / 405 * 900 / ppu
    out = [f'<svg class="chart" viewBox="0 0 100 {h}" '
           f'preserveAspectRatio="none">',
           f'<line class="ax" x1="0" y1="{base:.2f}" x2="100" '
           f'y2="{base:.2f}"/>']
    for i, (lab, v) in enumerate(rows):
        bh = (v / mx) * (base - 7.0)
        x = i * slot + (slot - bw) / 2
        y = base - bh
        cls = "bar hi" if v == mx else "bar"
        out.append(f'<rect class="{cls}"{_di(i + 1, lit)} x="{x:.2f}" '
                   f'y="{y:.2f}" width="{bw:.2f}" height="{bh:.2f}"/>')
        out.append(f'<text class="val" x="{x + bw / 2:.2f}" '
                   f'y="{y - fs_val * .55:.2f}" '
                   f'font-size="{fs_val:.2f}">{v}{unit}</text>')
        out.append(f'<text class="lab" x="{x + bw / 2:.2f}" '
                   f'y="{base + fs_lab * 1.9:.2f}" '
                   f'font-size="{fs_lab:.2f}">{lab}</text>')
    out.append("</svg>")
    note = f'<div class=b-tbn>{e["note"]}</div>' if e.get("note") else ""
    return (f'<div class="blk b-ch">{_head(e)}{"".join(out)}</div>{note}')


RENDER = dict(quote=quote, list=lst, number=number, parts=parts,
              steps=steps, table=table, metrics=metrics, chart=chart)


# --------------------------------------------------------------------------
# beats
# --------------------------------------------------------------------------
def _kick(b):
    return f'<span class=kick>{b["kicker"]}</span>' if b.get("kicker") else ""


def _because(b):
    return (f'<span class=ru></span><span class=bc>{b["because"]}</span>'
            if b.get("because") else "")


def beat_frame(b):
    return (f'{_kick(b)}<span class=fr-t>{b["title"]}</span>'
            f'<span class=ru></span><span class=fr-s>{b["sub"]}</span>')


def beat_claim(b):
    return f'{_kick(b)}<span class=cl>{b["claim"]}</span>{_because(b)}'


def beat_block(b):
    return RENDER[b["block"]["kind"]](b["block"])


def beat_ask(b):
    return (f'{_kick(b)}<span class=cl>{b["claim"]}</span>{_because(b)}'
            f'<span class=close>{b["close"]}</span>')


BEAT = dict(frame=beat_frame, claim=beat_claim, block=beat_block, ask=beat_ask)


# --------------------------------------------------------------------------
def render(arg):
    figs, at = _figures(arg)
    beats = []
    for b, f in zip(arg["beats"], at):
        # The ordinal is DERIVED. The model never numbers a beat, so inserting
        # one renumbers nothing and there is no renumbering to get wrong. The
        # figure index is derived the same way, and for the same reason: the
        # model says WHERE the figure changes, never which number it becomes.
        lit = " ".join(str(i) for i in b.get("lit", []))
        attr = f' data-lit="{lit}"' if lit else ""
        attr += f' data-f="{f}"' if len(figs) > 1 else ""
        beats.append(f'<section class=beat{attr}>{BEAT[b["kind"]](b)}</section>')

    # Every figure lives in the band; the engine shows one. The wrapper is the
    # only markup the seam adds, and it carries no coordinate.
    figure = "".join(f'<div class="fg{" on" if i == 0 else ""}">'
                     f'{RENDER[f["kind"]](f, lit=True)}</div>'
                     for i, f in enumerate(figs))

    fills = dict(zip(FILLS, (
        H.escape(re.sub(r"<[^>]+>", "", arg["title"])),
        figure,
        "".join(beats),
        arg["occasion"])))

    out = (HERE / "skeleton.html").read_text(encoding="utf-8")
    for name, value in fills.items():
        token = MARKER.format(name)
        n = out.count(token)
        if n != 1:
            raise Refused(f"skeleton: marker P:{name} appears {n}x, "
                          f"must be exactly 1")
        out = out.replace(token, value)
    left = re.findall(r"<!--P:([A-Z]+)-->", out)
    if left:
        raise Refused(f"skeleton: marker(s) {', '.join(left)} were never "
                      f"filled — the builder does not know about them")
    return out


# Paths on the command line are the caller's, resolved against the working
# directory like every other tool's. Only the skeleton is HERE-relative,
# because the skeleton is not an input the caller chooses -- it is the engine.
EXAMPLE = HERE.parent / "examples/argument.json"


def main(src=None, dst="presentation.html"):
    src = pathlib.Path(src) if src else EXAMPLE
    arg = json.loads(src.read_text(encoding="utf-8"))
    validate(arg)
    out = pathlib.Path(dst)
    if out.parent != pathlib.Path(""):
        out.parent.mkdir(parents=True, exist_ok=True)
    html = render(arg)
    out.write_text(html, encoding="utf-8")
    return out, html


if __name__ == "__main__":
    try:
        path, h = main(*sys.argv[1:])
    except Refused as e:
        print(f"REFUSED · {e}")
        sys.exit(1)
    print(f"{path}: {len(h.encode()):,} B")
