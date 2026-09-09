"""A theme's own faces: the `@font-face` rules, and the repertoire they cover.

A THEME THAT SHIPS FACES SHIPS THEM AS BYTES, NOT AS A URL. `themes/base`
paints with whatever the machine already has -- `system-ui` and friends, which
name no concrete face a browser could fail to load. `themes/panlabs` carries
two `.woff2` files of its own, and they travel inside every deck it builds as
`data:` URIs: a deck opens on a corporate network with the cable pulled, and a
font request is a request like any other.

THE MANIFEST IS THE ONLY PLACE A FACE IS NAMED. `<theme>/fonts/faces.json`
says, for each face, the family name, the file, and the weight range the
`@font-face` descriptor offers -- and nothing here guesses any of it from a
filename. A theme with no `fonts/` directory is a theme with no faces, which
is not an error: it is `base`.

THE REPERTOIRE IS A PROMISE, AND `audit.py` CHARGES IT. A subsetter drops in
silence whatever the source face did not have, so "the characters we asked
for" and "the characters that shipped" are different lists -- the v1 measured
this (#91) and the fix was a machine ruler, not a note in a README. The
manifest publishes the INTERSECTION of what every face carries, and a deck
that prints a character outside it is refused before it can paint a fallback
glyph nobody ordered.

WHY THE COMPILER DOES NOT READ THE CMAP ITSELF. It would need to decompress a
Brotli stream, and Python's standard library has no Brotli; the whole of this
compiler is `python3` and nothing else. So the repertoire is carried in the
manifest, and `workbench/panlabs-presentation-builder/tests/check-fonts.cjs`
holds the other end of it -- reading the real cmap out of each binary and
refusing a manifest that no longer describes the bytes beside it.
"""

import base64
import json
import os

# The subsetter emits WOFF2 and nothing else; the MIME type is written here
# once rather than repeated per face in the manifest, where it could only ever
# say the same thing twice.
MIME = "font/woff2"
FORMAT = "woff2"

MANIFEST = os.path.join("fonts", "faces.json")

HERE = os.path.dirname(os.path.abspath(__file__))
THEMES = os.path.join(os.path.dirname(HERE), "themes")

_CACHE = {}


def directory(name):
    """Where a theme lives, by name.

    It is here rather than in `build.py` because the audit needs it too, and
    two modules each spelling `themes/<name>` is two places to fix the day the
    layout moves.
    """
    return os.path.join(THEMES, name)


class Missing(Exception):
    """The manifest names something the theme does not actually carry."""


def _read(theme_dir):
    """The theme's manifest, read once per directory, or None when it has none."""
    if theme_dir in _CACHE:
        return _CACHE[theme_dir]
    path = os.path.join(theme_dir, MANIFEST)
    if not os.path.isfile(path):
        _CACHE[theme_dir] = None
        return None
    with open(path, encoding="utf-8") as fh:
        _CACHE[theme_dir] = json.load(fh)
    return _CACHE[theme_dir]


def repertoire(theme_dir):
    """Every character this theme's faces can paint, or None when it ships none.

    None is not "no characters" -- it is "this theme makes no promise", which
    is what `base` is: it paints with the machine's own faces, whose coverage
    is a fact about the machine and not about the theme. A ruler that charged
    a repertoire nobody declared would be a ruler inventing its own subject.
    """
    manifest = _read(theme_dir)
    if not manifest:
        return None
    return manifest.get("repertoire") or None


def faces(theme_dir):
    """The `@font-face` block for this theme, with every face inlined.

    Empty string when the theme ships no faces, so the caller can concatenate
    it unconditionally instead of asking first.

    `font-display: block` AND NOT `swap`, WHICH IS WHAT THE DOCUMENTATION USES.
    The documentation fetches its faces over a network and would rather show
    the fallback than nothing; a deck's faces are already in the file being
    opened, so there is no wait to fill -- and `swap` would put a flash of
    system-ui on a projector, in front of a room, for the one frame between
    layout and decode. The same frame is what the render gate would sample.
    """
    manifest = _read(theme_dir)
    if not manifest:
        return ""
    rules = []
    for face in manifest.get("faces", []):
        path = os.path.join(theme_dir, "fonts", face["file"])
        if not os.path.isfile(path):
            raise Missing(
                f'put {face["file"]} back beside {MANIFEST} in '
                f"{os.path.basename(theme_dir)}/, or take its entry out of the "
                "manifest — the theme declares a face whose bytes are not there"
            )
        with open(path, "rb") as fh:
            data = base64.b64encode(fh.read()).decode("ascii")
        rules.append(
            "@font-face {\n"
            f'  font-family: \'{face["family"]}\';\n'
            f"  src: url(data:{MIME};base64,{data}) format('{FORMAT}');\n"
            f'  font-weight: {face["weight"]};\n'
            f'  font-style: {face["style"]};\n'
            "  font-display: block;\n"
            "}"
        )
    return "\n".join(rules)
