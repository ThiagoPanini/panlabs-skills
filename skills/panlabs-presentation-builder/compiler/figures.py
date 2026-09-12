"""The figure: a drawing the model wrote, or an image it pointed at.

THIS IS THE ONE PLACE THE COMPILER READS A FILE THE AUTHOR NAMED. Everything
else a deck is made of arrives inside the source or inside the skill -- the
theme, the icons, the numbers a chart draws -- and this file is the seam where
a byte from somewhere else crosses into the page. It crosses ONE way: read,
weighed, checked against the format its own name promised, and written back
out as a `data:` URI, so what leaves is still a single file that opens with the
cable pulled. Nothing here reaches the network, and nothing here writes.

A DRAWING IS RE-SERIALISED, NEVER PASSED THROUGH. `_node` writes back only the
elements and attributes `compiler/catalog.py`'s own `Figure` declares, in the
register's order and in the spelling SVG wants -- the same discipline
`source.py`'s `inline_markup` keeps for emphasis, and for the same reason: an
element that reached here without being in the register is a rule that stopped
being enforced, and it should stop the build rather than reach the page.

THE CASE OF `viewBox` IS WHY THE REGISTER SPELLS ITS ATTRIBUTES. `html.parser`
hands every attribute name back lowercased, and `viewbox` is not `viewBox` --
an HTML parser in a browser happens to fix that one up, and depending on it
would be depending on a fixup table nobody in this compiler can see. Looked up
case-folded and written from the register, the built page says what the author
meant whether or not anybody downstream is feeling generous.

THE EMPTY PORTRAIT IS THE DEFECT THIS FILE EXISTS TO REFUSE. #207 asks that a
deck never show "um retrato vazio, um círculo em branco onde deveria haver uma
foto", and an `<img>` is the only thing in this dialect that can produce one
without a single ruler going red: a path that moved, a file over the ceiling,
a JPEG somebody renamed to `.png`. `resolve()` answers all three before a byte
of the page is written, which is what turns that doctrine into a machine rule.
"""

import base64
import html
import os
import re
from dataclasses import dataclass

from catalog import megabytes
from source import Refused, squeeze

# A URI, and not a path. Two characters at least before the colon, so a
# Windows drive letter is never read as a scheme -- and every one of the forms
# this refuses (`https:`, `data:`, `file:`) is the same defect wearing a
# different word: a figure that came from somewhere other than a file on disk.
SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]+:")

# A colour a theme can repaint, and the whole grammar of one. A fallback
# (`var(--accent, red)`) is refused on purpose: the fallback is a literal
# colour with a comma in front of it, and a theme that failed to declare the
# token should go red rather than quietly paint the fallback.
TOKEN = re.compile(r"^var\(\s*(--[A-Za-z0-9-]+)\s*\)$")

# Four numbers, and the drawing's own width and height are the last two.
BOX = re.compile(r"^\s*(-?[\d.]+)\s+(-?[\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$")


@dataclass(frozen=True)
class Resolved:
    """Where an imported figure's bytes are, or the one thing to do about it.

    `fix` is None exactly when the file is there, readable, under the ceiling,
    and of the format its own extension promised. Every other outcome carries
    the imperative that repairs it and leaves `path` and `media` empty.
    """

    path: str = ""     # the file the src= named, as this machine sees it
    media: str = ""    # the media type the data: URI will declare
    fix: str = None


def token(said):
    """The theme token a written colour names, or None when it names none."""
    found = TOKEN.match(said.strip())
    return found.group(1) if found else None


def attribute(node, name):
    """One attribute of a node, found however the author spelled its case.

    `html.parser` lowercases every name it hands back, and the register spells
    `viewBox` the way SVG wants it; asking case-folded, in one place, is what
    keeps the two from having to agree letter for letter at every call site.
    """
    for key, value in node.attrs.items():
        if key.lower() == name.lower():
            return value
    return ""


def box_is_sound(said):
    """True when a viewBox says four numbers and the last two are above zero."""
    found = BOX.match(said)
    return bool(found) and float(found.group(3)) > 0 and float(found.group(4)) > 0


def paints(node, figure):
    """Every colour written anywhere in a drawing: (tag, attribute, value).

    THE PAINT RULER ASKS THIS AND JUDGES THE ANSWER. Keeping the walk here and
    the verdict in `compiler/audit.py` is what stops the audit from growing a
    second idea of what a drawing's tree looks like -- this file already owns
    the one that writes it back out.
    """
    for key, value in node.attrs.items():
        if key.lower() in figure.paint:
            yield node.tag, key, value
    for child in node.elements():
        yield from paints(child, figure)


# ── the image ────────────────────────────────────────────────────────────────

def _type_of(extension, figure):
    for kind in figure.types:
        if kind.extension == extension:
            return kind
    return None


def _signed(head, kind):
    """True when the first bytes are the ones this format always opens with."""
    return all(head[at:at + len(magic)] == magic for at, magic in kind.signature)


def resolve(said, base, figure):
    """Where the file a `src=` names is, or the one thing to do about it.

    `base` is the directory the deck's SOURCE was read from, which is the only
    honest anchor for a RELATIVE path: the author writes it beside the file
    they are writing, not beside whatever directory the build happened to be
    run from. An absolute path is answered as written -- #207's own story is
    "embutir imagens minhas por caminho", and a logo living in somebody's home
    directory is a path they really have. What is refused is neither of those:
    a URI, which is a picture the page would have to fetch.
    """
    src = (said or "").strip()
    exts = ", ".join(k.extension for k in figure.types)

    if not src:
        return Resolved(fix=(
            f"give the <{figure.imported}> a {figure.path}= naming an image "
            f"beside the deck's source — {exts}"
        ))
    if SCHEME.match(src):
        return Resolved(fix=(
            f'write {figure.path}= as a path to a file on disk, not "{src}" — '
            "the compiler embeds the bytes, and a deck that fetched a picture "
            "would be a deck that stopped opening with the cable pulled"
        ))

    kind = _type_of(os.path.splitext(src)[1].lower(), figure)
    if kind is None:
        return Resolved(fix=(
            f'save "{src}" as one of {exts} — the compiler embeds those and '
            "nothing else, and a vector figure is drawn inline instead of "
            "pointed at"
        ))

    path = src if os.path.isabs(src) else os.path.join(base, src)
    if not os.path.isfile(path):
        return Resolved(fix=(
            f'put the image at "{path}" or point {figure.path}= somewhere it '
            "is — nothing is there, and a slide whose picture never resolved "
            "is the empty portrait the doctrine refuses"
        ))

    try:
        weight = os.path.getsize(path)
        with open(path, "rb") as fh:
            head = fh.read(16)
    except OSError as e:
        return Resolved(fix=(
            f'make "{path}" readable — {e.strerror}, and an image the compiler '
            "cannot open is an image the deck cannot carry"
        ))

    if weight > figure.max_bytes:
        return Resolved(fix=(
            f'shrink "{src}" to under {megabytes(figure.max_bytes)} — it weighs '
            f"{weight} bytes, {weight - figure.max_bytes} over the ceiling, and "
            "base64 costs a third more on top of whatever a figure brings"
        ))
    if not _signed(head, kind):
        return Resolved(fix=(
            f'save "{src}" as a real {kind.extension} — its first bytes are not '
            f"those of a {kind.media}, and a picture the browser cannot decode "
            "paints the blank rectangle this pattern exists to make impossible"
        ))

    return Resolved(path=path, media=kind.media)


def data_uri(resolved):
    """The whole file, inline. Only ever called on a `Resolved` that has no fix."""
    with open(resolved.path, "rb") as fh:
        payload = base64.b64encode(fh.read()).decode("ascii")
    return f"data:{resolved.media};base64,{payload}"


# ── back out to markup ───────────────────────────────────────────────────────

def _attributes(node, figure):
    """The node's attributes, canonically spelled, in the REGISTER's order.

    The order is the register's and not the author's for the same reason
    `build.py` emits a slide's slots in catalog order: what reaches the page
    should be a fact about the vocabulary, not about what somebody happened to
    type first, and two builds of one source should not differ by a keystroke.
    """
    said = {key.lower(): value for key, value in node.attrs.items()}
    return "".join(
        f' {name}="{html.escape(said[name.lower()], quote=True)}"'
        for name in figure.attrs if name.lower() in said
    )


def _node(node, figure):
    # THE ELEMENTS THAT CARRY WORDS ARE THE ONES WHOSE WHITESPACE IS SOMEBODY'S
    # TYPOGRAPHY (`Figure.words`). Everywhere else a run of spaces is the
    # author's indentation and carrying it into the page would leave a stray
    # space between two shapes; between two `<tspan>` the same run is the space
    # between two words, and dropping it would join them.
    if node.tag not in figure.tags:
        raise Refused(
            f"fix the vocabulary ruler — it passed a <{node.tag}> inside a "
            "figure and this serializer will not write markup nobody "
            "validated. A reader seeing this has found a broken check, not a "
            "broken deck"
        )
    out = []
    for child in node.children:
        if isinstance(child, str):
            if child.strip() or node.tag in figure.words:
                out.append(html.escape(squeeze(child), quote=False))
        else:
            out.append(_node(child, figure))
    inner = "".join(out)
    attrs = _attributes(node, figure)
    if not inner:
        return f"<{node.tag}{attrs}/>"
    return f"<{node.tag}{attrs}>{inner}</{node.tag}>"


def body(node, figure):
    """Everything a drawing is made of, without the `<svg>` around it.

    IT IS PUBLIC BECAUSE THE ARTICLE NEEDS THE INSIDE (#239). A drawing on the
    stage is an `<svg class="figure">` inheriting the theme from the page it is
    inlined in; the same drawing beside an article is a file of its own, with
    its own namespace, its own surface and the theme's colours resolved into
    literals -- so `compiler/article.py` builds the wrapper and asks this for
    what goes in it. Returning the whole element and having that file cut the
    opening tag back off with a regex is the shape where one of the two ends up
    describing markup the other stopped writing.
    """
    return "".join(_node(child, figure) for child in node.elements())


def drawing(node, figure, described):
    """One hand-drawn figure, as it reaches the page.

    THE CAPTION IS THE ACCESSIBLE NAME. A drawing has no words of its own that
    a screen reader could read in order, and the slide already carries a line
    saying what the picture shows -- asking the author for a second one, in a
    second attribute, would be asking them to write the same sentence twice and
    keep the two in step forever.
    """
    return (f'<{figure.drawn} class="figure"{_attributes(node, figure)} role="img" '
            f'aria-label="{html.escape(described, quote=True)}">'
            f"{body(node, figure)}</{figure.drawn}>")


def image(figure, resolved, described):
    """One imported figure, its bytes inline. Same rule about the caption."""
    return (f'<{figure.imported} class="figure" src="{data_uri(resolved)}" '
            f'alt="{html.escape(described, quote=True)}">')
