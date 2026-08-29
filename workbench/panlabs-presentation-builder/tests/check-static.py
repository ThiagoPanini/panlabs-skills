#!/usr/bin/env python3
"""THE STATIC GATE. Nine families, and none of them opens a browser.

    python3 check-static.py                 # builds examples/*.json in memory
    python3 check-static.py --corpus DIR    # reads the .html the suite wrote

This is #93's report turned into code: eleven candidate checks were
prototyped and run against the real corpus of #94, five died there -- every
one by FALSE POSITIVE against legitimate work, none by letting a defect
through -- and the survivors are the nine below. Nothing here knows the
vocabulary of `register.py`: every family reads bytes -- `<style>`, `href=`,
a base64 payload, a hex literal, an SVG coordinate -- and none of them
imports `REGISTER` or cares what a `beat` or a `block` is. That is what
`check-architecture.py` is for; this file is the layer under it, the one
that would still mean something if the vocabulary were rewritten tomorrow.

  1  no-network         nothing in the file names a host
  2  inline-payload     <style>/<script> are present and carry their body
                        inline, never through src=/href=
  3  font-declared      every font-family the CSS names resolves to an
                        @font-face with an embedded (data:) source
  4  font-integrity     every embedded font payload is a real font, not a
                        truncated one that merely LOOKS like one
  5  palette-chroma     every chromatic hex in the file is one of the
                        measured tokens; achromatic grey is not a violation
  6  beats-present      the skeleton was actually filled with beats
  7  connector-lands    a connector's arrowhead lands on the shape it points
                        at, not on empty canvas
  8  donut-closes       a donut's arcs sum to the circle they draw
  9  chart-coherence    a bar's drawn height agrees with its own printed
                        value

WHY 7 AND 8 NEVER FIRE TODAY, AND WHY THEY ARE HERE ANYWAY. #93 measured
these two against the PDI deck's organogram and donut -- shapes this
engine's `chart` (a bar generator, see `build.py`) does not draw and no
block in `register.py` currently produces. Porting the CHECK and porting the
VOCABULARY are different jobs; #98's map already named a future diagram
block as névoa, not scope. Both families are written to derive their
subject from the SVG itself (a `<path>` carrying `marker-end`, a `<circle>`
carrying `stroke-dasharray`) exactly as #93 wrote them, so the day that block
lands, these two start measuring it without an edit here -- and until then
they say so out loud instead of reporting a silent, meaningless green.

WHY 4 IS HONEST ABOUT WHAT IT CANNOT DO. #93's surprise was a checksum over
an sfnt TABLE DIRECTORY -- 30 lines of arithmetic, no font library -- that
caught a corruption every syntactic check let through. This engine's
`@font-face` rules all declare `format('woff2')`, and WOFF2 has no such
per-table checksum: its tables are Brotli-compressed into one stream, and
verifying that stream's content needs a Brotli decoder, which is a
dependency this project declines to add for the same reason `build.py`
declines `pip install` anything. What IS checkable without one: the
signature, and the header's OWN declared total length against the payload's
ACTUAL decoded length -- which catches truncation, the most common real
corruption. It does NOT catch a same-length bit flip inside the compressed
stream, the exact shape #93 planted. That gap is real, and it is #157's:
asking a real browser which face actually painted is the only check strong
enough to close it, exactly as the render layer's network sniff is what
closes family 1's gap below. Where a payload DOES turn out to be a raw
sfnt/OTF/TTF (not this engine's case today, but not assumed away either),
the full per-table checksum runs, because for that shape it costs nothing.

WHY THIS FILE NEVER PIPES A BIG STRING THROUGH `grep -q`. The prototype's
bash version did exactly that (`printf '%s' "$block" | grep -q ...` under
`set -o pipefail`), and it is a real, non-deterministic false red: `grep -q`
exits on its first match and the still-writing `printf` takes SIGPIPE, so
`pipefail` reports 141 and a CORRECT file reads as broken -- and only for a
payload big enough to matter, which for this suite is every embedded font.
Python's `str.find` / `in` / `re.search` have no subprocess and no pipe, so
there is no SIGPIPE to take: the trap does not exist here, not because
someone remembered to avoid it, but because the language this file is
written in has no pipe for a signal to travel through.

THE SUITE DOES NOT LIVE INSIDE THE SKILL (#44), for the same reason
`check-architecture.py` does not: read and run by whoever MAINTAINS the
skill, never by whoever EXECUTES it. Every path below points INTO
skills/panlabs-presentation-builder/ -- the only direction a reference from
here is allowed to travel.
"""
import base64
import importlib.util
import pathlib
import re
import struct
import sys

HERE = pathlib.Path(__file__).resolve().parent

# `check-architecture.py` already carries the one correct corpus loader --
# `arguments()`, `corpus()`, `read_corpus_flag()` -- with every edge case
# (an empty `--corpus`, a partial build, a missing `examples/`) already
# fought over once. Copying those ~40 lines here would be a second place
# they can drift, which is the exact failure this house's proofs exist to
# refuse; loading the module by path, the same way its own proof already
# does, reuses the one correct copy instead.
sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    "check_architecture", HERE / "check-architecture.py")
_arch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_arch)

corpus, read_corpus_flag = _arch.corpus, _arch.read_corpus_flag


def _body(corpus_html):
    return corpus_html if corpus_html is not None else corpus()


# --------------------------------------------------------------------------
# utilities every family below shares
# --------------------------------------------------------------------------
def _scrub(html):
    """Strip HTML and CSS comments: a pattern quoted in a comment is not the
    pattern in the document. Without this, family 1 would report the
    skeleton's own licence comment -- "https://openfontlicense.org" -- as a
    network reference, on every single argument, forever.

    Safe against the embedded base64: `#`, `<`, `!`, `-`, `*`, `>` are none
    of them in the base64 alphabet, so a comment delimiter can never occur
    inside a font payload for this to accidentally eat.
    """
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    html = re.sub(r"/\*.*?\*/", "", html, flags=re.S)
    return html


def _style_blocks(html):
    """Every `<style>...</style>` body, concatenated. Not just the first:
    family 2 below is what proves there is ever only one."""
    return "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S))


# --------------------------------------------------------------------------
# 1 - nothing in the file names a host
# --------------------------------------------------------------------------
_NET = re.compile(
    r'(?:href|src|srcset)\s*=\s*(?:"(?:https?:)?//[^"]*"'
    r"|'(?:https?:)?//[^']*'"
    r"|(?:https?:)?//[^\s>]*)"
    r"|url\(\s*['\"]?(?:https?:)?//[^)'\"]*"
    r"|@import[^;]*(?:https?:)?//[^;]*",
    re.I)


def check_no_network(corpus_html=None, **_):
    """#93's S1. `href=`/`src=`/`srcset=`, `url(...)`, `@import` with an
    absolute or protocol-relative scheme -- a deck with zero network
    dependency cannot name a host.

    INCOMPLETE, ON PURPOSE, STATED HERE AND IN THE GREEN MESSAGE BELOW: #93
    planted a URL assembled at runtime from character codes
    (`String.fromCharCode(...).join('.')`) and this file contained no
    literal URL for any regex to find -- `grep -c` returned 0 on a deck that
    phoned home. Only a behavioural check over a real browser's own network
    log closes that gap; #157 is where it lives. This family is a real
    guard against every LITERAL reference, and it is not the whole premise.
    """
    body = _body(corpus_html)
    hits = []
    for label, html in body:
        for m in _NET.finditer(_scrub(html)):
            hits.append(f"{label}: {m.group(0)[:70]!r}")
    if hits:
        return False, ("a reference points off the machine -- a deck with "
                       "zero network dependency cannot name a host: "
                       + "; ".join(hits[:5]))
    return True, (f"no href=/src=/srcset=/url()/@import names a host, over "
                  f"{len(body)} argument(s) -- INCOMPLETE: a URL assembled "
                  f"at runtime from character codes carries no literal "
                  f"scheme and this regex cannot see it; #157's network "
                  f"sniff over a real browser is what actually closes "
                  f"premise 4")


# --------------------------------------------------------------------------
# 2 - <style>/<script> are present and inline
# --------------------------------------------------------------------------
def check_inline_payload(corpus_html=None, **_):
    """#93's S2. Presence is not enough -- a `<script src=...>` or a
    `<link rel=stylesheet>` is a reference that also names a host in the
    common case, and even pointed at a local file it means the engine is no
    longer self-contained in the one artifact that ships."""
    body = _body(corpus_html)
    for label, html in body:
        s = _scrub(html)
        if not re.search(r"<style[^>]*>", s):
            return False, f"{label}: no <style> block -- the theme is not in the file"
        if not re.search(r"<script(?:\s[^>]*)?>", s):
            return False, f"{label}: no <script> block -- the engine's behaviour is not in the file"
        if re.search(r"<script\b[^>]*\bsrc=", s):
            return False, f"{label}: a <script> carries src= -- no engine body is inline"
        if re.search(r'<link[^>]+rel="stylesheet"', s):
            return False, (f"{label}: a <link rel=stylesheet> carries the "
                           f"theme instead of an inline <style>")
    return True, (f"<style> and <script> are present and carry their body "
                  f"inline, over {len(body)} argument(s)")


# --------------------------------------------------------------------------
# 3 - every font-family resolves to an embedded @font-face
# --------------------------------------------------------------------------
_GENERIC = {"sans-serif", "serif", "monospace", "cursive", "fantasy",
            "system-ui", "inherit", "initial", "unset"}


def _font_families(css):
    fams = set()
    for m in re.finditer(r"font-family\s*:\s*([^;}{]+)", css):
        for tok in m.group(1).split(","):
            tok = tok.strip().strip("'\"")
            if tok and not tok.startswith("var(") and tok.lower() not in _GENERIC:
                fams.add(tok)
    return fams


def check_font_declared(corpus_html=None, **_):
    """#93's S3. A `font-family` with no matching `@font-face`, or one whose
    `src:` is not a `data:` URI, is a name the browser will silently
    resolve to a fallback -- no error anywhere, just the wrong face."""
    body = _body(corpus_html)
    for label, html in body:
        css = _style_blocks(_scrub(html))
        for fam in sorted(_font_families(css)):
            block = re.search(
                r"@font-face\s*\{[^}]*font-family\s*:\s*['\"]?"
                + re.escape(fam) + r"['\"]?[^}]*\}", css, re.S)
            if not block:
                return False, (f'{label}: font-family "{fam}" has no '
                               f'@font-face in this file -- the browser '
                               f'will silently paint a fallback')
            if not re.search(r"src\s*:[^;}]*url\(\s*['\"]?data:", block.group(0)):
                return False, (f'{label}: the @font-face for "{fam}" has no '
                               f'src: url(data:...) -- the face is not '
                               f'embedded and the browser will silently '
                               f'paint a fallback')
    return True, (f"every declared font-family resolves to an embedded "
                  f"@font-face, over {len(body)} argument(s)")


# --------------------------------------------------------------------------
# 4 - every embedded font payload is a real font
# --------------------------------------------------------------------------
_SFNT_TAGS = (0x00010000, 0x4F54544F, 0x74727565)   # ttf / OTTO / 'true'
_WOFF2_TAG = 0x774F4632                              # 'wOF2'


def _sfnt_checksum(buf, off, length):
    """Sum of the table's bytes as big-endian uint32 words, zero-padded to a
    4-byte boundary, mod 2**32 -- the arithmetic every sfnt table carries a
    checksum over. Ported from #93's `sfnt.cjs`, 1:1."""
    total = 0
    end = off + length
    i = off
    while i < end:
        word = 0
        for k in range(4):
            j = i + k
            word = (word << 8) | (buf[j] if j < len(buf) else 0)
        total = (total + word) % 4294967296
        i += 4
    return total


def _verify_sfnt(buf):
    """The full per-table checksum, for the formats that carry one:
    TrueType/OpenType/'true'. Returns None when it is intact, or a message
    naming the corrupt table."""
    n = struct.unpack(">H", buf[4:6])[0]
    if 12 + n * 16 > len(buf):
        return f"table directory claims {n} tables, past the end of the payload"
    for i in range(n):
        d = 12 + i * 16
        name = buf[d:d + 4].decode("latin1", "replace")
        want = struct.unpack(">I", buf[d + 4:d + 8])[0]
        off, length = struct.unpack(">II", buf[d + 8:d + 16])
        if off + length > len(buf) + 3:
            return f"table '{name}' claims bytes {off}..{off + length}, past the end of the payload"
        got = _sfnt_checksum(buf, off, (length + 3) & ~3)
        if name == "head":
            # `head` zeroes its own checkSumAdjustment before the directory
            # checksum was computed, so the same field has to come back out
            # here before comparing.
            adj = struct.unpack(">I", buf[off + 8:off + 12])[0]
            got = (got - adj + 2 * 4294967296) % 4294967296
        if got != want:
            return (f"table '{name}' checksum is 0x{got:x}, the directory "
                    f"says 0x{want:x} -- the payload is corrupt")
    return None


def _verify_woff2(buf):
    """WOFF2 carries no per-table checksum -- its tables are Brotli-compressed
    into one stream, and this project takes no Brotli dependency to look
    inside it (see the module docstring). What the 48-byte header DOES hand
    over for free: its own `length` field, the file's declared total size,
    independently written by whatever built the font. A payload truncated or
    padded after the fact disagrees with it; a same-length bit flip inside
    the compressed stream does not, and is not caught here.
    """
    if len(buf) < 48:
        return "shorter than a WOFF2 header"
    declared = struct.unpack(">I", buf[8:12])[0]
    if declared != len(buf):
        return (f"the WOFF2 header declares length {declared}, the payload "
                f"decodes to {len(buf)} bytes -- the payload is truncated "
                f"or padded")
    return None


def _verify_font(raw):
    """One payload -> an error message, or None when it is intact."""
    if len(raw) < 12:
        return "shorter than a font header"
    tag = struct.unpack(">I", raw[:4])[0]
    if tag in _SFNT_TAGS:
        return _verify_sfnt(raw)
    if tag == _WOFF2_TAG:
        return _verify_woff2(raw)
    # WOFF1 ('wOFF') keeps the sfnt table-directory shape, checksums
    # included, behind its own small header -- verifiable without a new
    # dependency, same as raw sfnt. There is deliberately no branch for it:
    # this engine has never embedded one, an unexercised branch is a branch
    # nobody has forced to fire (the standard `check-architecture.py` already
    # holds these files to), and RETURNING None here -- "no error" -- would
    # rubber-stamp an unverified payload as intact, which is worse than not
    # having the branch at all. It falls through to the line below instead,
    # which is honestly red rather than silently green.
    return f"signature 0x{tag:08x} is not a font this check recognises"


_FONT_B64 = re.compile(r"base64,([A-Za-z0-9+/=]{100,})")


def check_font_integrity(corpus_html=None, **_):
    """#93's S4, the surprise family: a base64 payload that decodes, keeps
    the right signature, and sits behind a perfectly formed `@font-face`
    can still be a corrupt font no syntactic check will ever see -- only
    arithmetic over the payload's own bytes does."""
    body = _body(corpus_html)
    for label, html in body:
        for i, b64 in enumerate(_FONT_B64.findall(_scrub(html)), 1):
            try:
                raw = base64.b64decode(b64, validate=False)
            except (ValueError, base64.binascii.Error):
                return False, f"{label}: embedded font #{i} is not decodable base64"
            if not raw:
                return False, f"{label}: embedded font #{i} decodes to zero bytes"
            err = _verify_font(raw)
            if err:
                return False, f"{label}: embedded font #{i}: {err}"
    return True, (f"every embedded font payload is a real, intact font, "
                  f"over {len(body)} argument(s)")


# --------------------------------------------------------------------------
# 5 - every chromatic hex is a measured token
# --------------------------------------------------------------------------
_ROOT = re.compile(r":root\s*\{([^}]*)\}", re.S)
_HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
_TAG = re.compile(r"<([a-zA-Z][\w-]*)\b[^>]*>")
# Both quoting styles, plus unquoted -- the same three shapes
# `check-architecture.py`'s own `_CLASS` regex already has to allow for.
_CLASS_ATTR = re.compile(r'''class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))''')
_COLOR_ATTR = re.compile(r'\b(?:style|fill|stroke|stop-color|color|background)'
                         r'\s*=\s*"([^"]*)"')
_MARK_RULE = re.compile(r"\.mark\b[^{}]*\{[^{}]*\}")
CHROMA_CEIL = 12   # #93 measured a two-order-of-magnitude gap between grey
                   # (0-6) and colour (82-254) in the real corpus; any cut
                   # between 6 and 76 works, this is theirs.


def _norm_hex(h):
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return h.upper()


def _chroma(hexval):
    r, g, b = (int(hexval[i:i + 2], 16) for i in (0, 2, 4))
    return max(r, g, b) - min(r, g, b)


def _root_text(css):
    m = _ROOT.search(css)
    return m.group(1) if m else ""


def _has_mark_class(tag_text):
    """True when `tag_text`'s own `class=` carries the exact token `mark`,
    however it is quoted. A SUBSTRING test here was the first draft, and it
    is wrong in both directions: `class="icon mark"` has `mark` as its
    SECOND token, past a space `[^"\\s]*` refuses to cross, so the exemption
    silently fails to fire; `class="icon-mark"` is a hyphenated, unrelated
    class, and `\\bmark\\b` matches inside it anyway because `-` is a word
    boundary in regex, not a token separator in HTML. Splitting the actual
    attribute value on whitespace and comparing tokens has neither failure.
    """
    m = _CLASS_ATTR.search(tag_text)
    if not m:
        return False
    value = next((g for g in m.groups() if g is not None), "")
    return "mark" in value.split()


def _mark_spans(html):
    """The byte range of every element carrying `class="...mark..."`,
    CONTAINER INCLUDED: a wrapper `<svg class="mark">...</svg>` exempts its
    own colour attributes and every descendant's. This is not generosity --
    it is #93's own tech-stack finding, restated: "the logos on the rail,
    fill=rgb(132, 79, 186)" is a colour on a CHILD `<path>`, never on the
    element a `class="mark"` would sit on. A same-tag-only exemption solves
    a shape #93 never actually found broken.

    Matched against the FIRST closing tag of the same name after the
    opening one, which is correct for a small, non-recursive icon/logo
    block and is exactly the shape the proof (and any real one) has -- not a
    general HTML parser, deliberately.
    """
    spans = []
    for m in _TAG.finditer(html):
        name, tag_text = m.group(1), m.group(0)
        if not _has_mark_class(tag_text):
            continue
        if tag_text.endswith("/>"):
            spans.append(m.span())
            continue
        close = re.search(rf"</{re.escape(name)}\s*>", html[m.end():], re.I)
        spans.append((m.start(), m.end() + close.end() if close else m.end()))
    return spans


def _color_surface(css, html):
    """Where a hex COLOUR can legitimately live: the CSS and the handful of
    presentation attributes that carry one -- never the raw document.

    Scanning the whole file was the first draft, and it broke on the first
    run against the real engine: `// THE SEAM (#120):` is a JS comment
    naming a GitHub issue, and `#120` is three hex digits followed by a word
    boundary -- indistinguishable from a colour to a regex that does not
    know what a JS comment is. `_scrub()` strips `/* */` and `<!-- -->` on
    purpose (`no-network` needs `//` left alone, to catch a protocol-relative
    URL), which leaves every `//` line comment in `<script>` sitting in the
    text a whole-document scan would read. Scoping the surface to CSS text
    and colour-bearing attributes sidesteps the collision entirely, because
    no colour a browser will ever paint lives in a JS comment.

    Anything inside a `_mark_spans()` range, or a CSS rule under `.mark`, is
    dropped before the hex scan ever sees it -- the slot `skeleton.html`
    declares for a legitimate third-party mark, the same slot #157's
    outline-icon check will read. No block in `register.py` emits one yet,
    so the exemption is proven in the proof file, not against the real
    corpus.
    """
    parts = [_MARK_RULE.sub("", css)]
    exempt = _mark_spans(html)
    for m in _TAG.finditer(html):
        if any(a <= m.start() < b for a, b in exempt):
            continue
        parts.extend(_COLOR_ATTR.findall(m.group(0)))
    return "\n".join(parts)


def check_palette_chroma(corpus_html=None, **_):
    """#93's S5, corrected to S5': the FIRST cut this house tried was
    equality against the measured tokens, and it accused 22 hexes of
    faithful work in the real corpus of #94 -- 18 of them the achromatic
    ramp between surface and ink that any real implementation needs. Croma
    (max channel - min channel) separates the two groups by an order of
    magnitude; achromatic always passes, chromatic outside the tokens does
    not.
    """
    body = _body(corpus_html)
    for label, html in body:
        css = _style_blocks(_scrub(html))
        tokens = {_norm_hex(h) for h in _HEX.findall(_root_text(css))}
        if not tokens:
            return False, (f"{label}: no :root{{...}} custom properties "
                           f"found -- the measured palette cannot be located")
        surface = _color_surface(css, _scrub(html))
        for m in _HEX.finditer(surface):
            h = _norm_hex(m.group(1))
            if h in tokens:
                continue
            c = _chroma(h)
            if c <= CHROMA_CEIL:
                continue
            return False, (f'{label}: hex #{h} is chromatic (croma {c}) and '
                           f'is not one of the {len(tokens)} measured '
                           f'tokens -- the identity is measured, not '
                           f'chosen; a legitimate third-party mark needs '
                           f'class="mark" on its tag')
    return True, (f"every chromatic hex is a measured token, over "
                  f"{len(body)} argument(s)")


# --------------------------------------------------------------------------
# 6 - the skeleton was actually filled
# --------------------------------------------------------------------------
_BEAT = re.compile(r'<section\s+class="?beat\b')


def check_beats_present(corpus_html=None, **_):
    """#93's S6. Independent of whatever `build.py` believes it validated:
    this reads the bytes that reached disk and asks whether a beat is
    actually there, the same belt-and-suspenders relationship this whole
    layer has to the builder that runs before it."""
    body = _body(corpus_html)
    for label, html in body:
        n = len(_BEAT.findall(html))
        if n < 1:
            return False, f"{label}: the file declares {n} beat(s) -- the skeleton was never filled"
    return True, f"every argument renders at least one beat, over {len(body)} argument(s)"


# --------------------------------------------------------------------------
# 7 - a connector lands on the shape it points at
# --------------------------------------------------------------------------
_RECT = re.compile(r"<rect\b[^>]*>")
_NUM_ATTR = lambda s, k: (lambda m: float(m.group(1)) if m else None)(
    re.search(k + r'\s*=\s*"(-?[\d.]+)"', s))
_CONNECTOR = re.compile(r'<(?:path|polyline)\b[^>]*\b(?:d|points)\s*=\s*"([^"]+)"[^>]*>')
_PT = re.compile(r"(-?[\d.]+)[ ,]+(-?[\d.]+)")
_TOUCH = 6   # units of the viewBox -- #93's own tolerance


def _rects(scrubbed):
    out = []
    for m in _RECT.finditer(scrubbed):
        t = m.group(0)
        x, y, w, h = (_NUM_ATTR(t, k) for k in ("x", "y", "width", "height"))
        if x is not None and w and w > 4:
            out.append((x, y, w, h))
    return out


def _dist_to_rect(p, r):
    x, y, w, h = r
    dx = max(x - p[0], 0, p[0] - (x + w))
    dy = max(y - p[1], 0, p[1] - (y + h))
    return (dx * dx + dy * dy) ** 0.5


def check_connector_lands(corpus_html=None, **_):
    """#93's S7: a `<path>`/`<polyline>` carrying `marker-end` (an
    arrowhead) is a connector, and its first and last point must land
    within a few units of some `<rect>` -- otherwise the arrow points at
    nothing, exactly the live defect #93 found in #94's `diagram.html`
    without ever opening a browser.

    NOT MEASURED against this engine's real corpus: `chart` draws bars, not
    an organogram, and no block in `register.py` emits a connector today
    (see the module docstring). The subject is derived from the SVG itself,
    never from a block name, so the day a diagram block lands this starts
    measuring it with no edit here.
    """
    body = _body(corpus_html)
    n_checked = 0
    for label, html in body:
        scrubbed = _scrub(html)
        rects = _rects(scrubbed)
        for m in _CONNECTOR.finditer(scrubbed):
            tag = m.group(0)
            if "marker-end" not in tag:
                continue
            path = m.group(1)
            if re.search(r"[zZ]", path):
                continue   # a closed shape, not a connector
            pts = [(float(a), float(b)) for a, b in _PT.findall(path)]
            if len(pts) < 2 or not rects:
                continue
            n_checked += 1
            for tag_name, p in (("start", pts[0]), ("end", pts[-1])):
                d = min(_dist_to_rect(p, r) for r in rects)
                if d > _TOUCH:
                    near = min(rects, key=lambda r: _dist_to_rect(p, r))
                    return False, (
                        f'{label}: connector "{path[:30]}" has its {tag_name} '
                        f'at ({p[0]:g},{p[1]:g}), {d:.0f} units from the '
                        f'nearest box [{near[0]:g},{near[1]:g} '
                        f'{near[2]:g}x{near[3]:g}] -- the arrow points at '
                        f'nothing')
    if n_checked == 0:
        return True, (f"NOT MEASURED: no connector (a path/polyline with "
                      f"marker-end) appears in {len(body)} argument(s) -- "
                      f"this family exists for a diagram block #98/#120 "
                      f"left as névoa, not yet in register.py")
    return True, f"every connector ends on the shape it points at, over {n_checked} connector(s)"


# --------------------------------------------------------------------------
# 8 - a donut's arcs close the circle
# --------------------------------------------------------------------------
_CIRCLE = re.compile(r"<circle\b[^>]*>")
_DASH = re.compile(r'stroke-dasharray\s*=\s*"([\d.]+)')


def check_donut_closes(corpus_html=None, **_):
    """#93's S8: every `<circle>` in a donut carries a `stroke-dasharray`
    slice, and the slices of one donut must sum to its own circumference
    (2*pi*r) within 1% -- otherwise the wedges drawn do not close the
    circle they are meant to be slices of.

    NOT MEASURED against this engine's real corpus, for the reason S7
    above gives: no donut is drawn by any block in `register.py` today.
    """
    body = _body(corpus_html)
    n_checked = 0
    for label, html in body:
        scrubbed = _scrub(html)
        arcs = {}
        for m in _CIRCLE.finditer(scrubbed):
            t = m.group(0)
            da = _DASH.search(t)
            if not da:
                continue
            key = (_NUM_ATTR(t, "cx"), _NUM_ATTR(t, "cy"), _NUM_ATTR(t, "r"))
            arcs.setdefault(key, []).append(float(da.group(1)))
        for (cx, cy, r), parts in arcs.items():
            if r is None:
                continue
            n_checked += 1
            total = sum(parts)
            circ = 2 * 3.141592653589793 * r
            if circ and abs(total - circ) / circ > 0.01:
                return False, (
                    f"{label}: donut at ({cx:g},{cy:g}): the arcs sum to "
                    f"{total:.1f} against a circumference of {circ:.1f} "
                    f"({(total / circ - 1) * 100:.1f}% off) -- the slices "
                    f"do not close the circle")
    if n_checked == 0:
        return True, (f"NOT MEASURED: no donut (a circle with "
                      f"stroke-dasharray) appears in {len(body)} "
                      f"argument(s) -- this family exists for the same "
                      f"future block S7 names")
    return True, f"every donut's arcs close the circle, over {n_checked} donut(s)"


# --------------------------------------------------------------------------
# 9 - a chart's drawn height agrees with its own printed value
# --------------------------------------------------------------------------
_CHART_SVG = re.compile(r'<svg class="chart".*?</svg>', re.S)
_BAR = re.compile(r'<rect class="bar( hi)?"[^>]*\sheight="([\d.]+)"')
_VAL_TEXT = re.compile(r'<text class="val"[^>]*>([^<]*)</text>')
_LEADING_NUM = re.compile(r"[\d.]+")
_ABS_TOL = 0.02      # #94's chart rounds every coordinate to 2 decimals;
_REL_TOL = 0.02      # this floor plus 2% relative has margin over that
                     # rounding without hiding a deliberate mismatch


def check_chart_coherence(corpus_html=None, **_):
    """#93's S9, the family that only exists because #94 chose SVG over
    <canvas>: a bar's height and its printed value are two independent
    numbers in the same file, both derived from one source datum, so
    height must stay proportional to value across every bar of one chart
    -- exactly #93's "the drawing is right and the number is lying", ported
    from a donut's total to a bar's height because this engine draws bars,
    not donuts.

    THE REFERENCE IS THE BAR `build.py` ITSELF MARKS `class="bar hi"`, never
    an arbitrary one. An earlier draft anchored on whichever bar came FIRST
    in the markup and compared every other bar's ratio to it -- and when the
    plant lied about that exact bar, every OTHER, truthful bar came out
    "wrong" relative to the false anchor, and the red named an innocent bar.
    `hi` is set by `build.py`'s `chart()` from the real value at build time
    (`cls = "bar hi" if v == mx else "bar"`), so relabelling a bar's printed
    text cannot move which one carries it -- it stays an honest anchor even
    when the lie sits on it.

    A single-bar chart has nothing to compare its one bar against and is
    left unmeasured, same as `connector-lands`/`donut-closes` when their
    shape does not appear at all: coherence needs two independent numbers,
    and one bar is one.

    WHY NO `data-total-of`-STYLE CONTRACT LINE, UNLIKE #93'S DONUT. #93
    needed one because a donut's TOTAL is nowhere in the arcs themselves --
    summing `data-value` attributes required a name to sum them under. A
    bar chart has no such missing quantity: `build.py`'s `chart()` already
    prints every value as visible `<text class="val">` text next to the
    `<rect>` its own height was computed from, so both numbers this family
    compares are already in the markup for the model's benefit, not added
    for this check's. There is nothing to declare a slot for.

    UNAVOIDABLE, NOT A GAP THIS DESIGN LEFT OPEN: relabelling every bar in a
    chart by the same factor is invisible to ANY internal-coherence check,
    #93's donut included -- scaling `data-value` and the printed total by
    the same `k` leaves `sum(data-value) == total` exactly as true as
    before. A check that compares numbers ONLY to each other can never
    catch a lie that moves them all together; that needs an outside source
    of truth (`argument.json` itself), which is a different family.
    """
    body = _body(corpus_html)
    n_charts = 0
    for label, html in body:
        for svg in _CHART_SVG.findall(html):
            bars = [(bool(hi), float(h)) for hi, h in _BAR.findall(svg)]
            values = []
            for raw in _VAL_TEXT.findall(svg):
                m = _LEADING_NUM.match(raw)
                values.append(float(m.group(0)) if m else None)
            if not bars or len(bars) != len(values) or any(v is None for v in values):
                continue   # a shape mismatch is family 6's/the builder's job, not this one's
            if len(bars) < 2:
                continue   # one bar has nothing to be coherent against
            ref_i = next((i for i, (hi, _) in enumerate(bars) if hi), None)
            if ref_i is None or not values[ref_i]:
                continue   # no bar was ever the true max -- not measurable
            n_charts += 1
            ref_h, ref_v = bars[ref_i][1], values[ref_i]
            for i, ((_, h), v) in enumerate(zip(bars, values)):
                if i == ref_i:
                    continue
                expected = ref_h * (v / ref_v)
                if abs(h - expected) > max(_ABS_TOL, abs(expected) * _REL_TOL):
                    return False, (
                        f"{label}: a bar {h:.2f} units tall is labelled "
                        f"{v:g}, but this chart's tallest bar ({ref_h:.2f} "
                        f"units for {ref_v:g}) predicts {expected:.2f} -- "
                        f"the drawing is right and the number is lying")
    if n_charts == 0:
        return True, (f"NOT MEASURED: no chart block appears in {len(body)} "
                      f"argument(s)")
    return True, f"every bar's height agrees with its own printed value, over {n_charts} chart(s)"


FAMILIES = [
    ("no-network", check_no_network),
    ("inline-payload", check_inline_payload),
    ("font-declared", check_font_declared),
    ("font-integrity", check_font_integrity),
    ("palette-chroma", check_palette_chroma),
    ("beats-present", check_beats_present),
    ("connector-lands", check_connector_lands),
    ("donut-closes", check_donut_closes),
    ("chart-coherence", check_chart_coherence),
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
            print(f"  {'ok  ' if ok else 'FAIL'} {name:<16} {msg}")
    return bad


def main(argv):
    print("static:")
    try:
        body = corpus(read_corpus_flag(argv))
    except (AssertionError, OSError) as e:
        print(f"  FAIL corpus              {e}")
        return 1
    return run(corpus_html=body)


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1:]) else 0)
