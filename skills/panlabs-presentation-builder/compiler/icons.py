"""The icon set: a vendored Lucide registry, and the sprite subsetted from it.

THE REGISTRY IS DATA, NEVER FETCHED. `themes/base/icons/lucide-icon-nodes.json`
is `lucide-static`'s own published file, copied in whole -- see the README
beside it for the version and the licence. This module never reaches the
network; it only reads what is already on disk, which is the whole of what
"a deck opens with the cable pulled" requires of an asset this size.

ICONS BELONG TO `base`, NOT TO THE ACTIVE THEME. A Lucide stroke carries no
brand -- `SKILL.md` says as much of the whole set a theme is allowed to
declare -- so every theme reads the same registry from the same path rather
than each carrying its own copy. A theme that one day needs a different set
is free to say so; nothing here assumes it will.

ONE SPRITE PER BUILD, SUBSETTED TO WHAT THE DECK ACTUALLY USES. Embedding the
whole registry in every deck would ship 1700-odd icons for the five a list
slide spends; `sprite()` takes the names a deck's own sections reference and
writes a `<symbol>` for each of them and nothing else.
"""

import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REGISTRY = os.path.join(ROOT, "themes", "base", "icons", "lucide-icon-nodes.json")

# Every Lucide icon ships the same wrapper -- a 24x24 stroke drawing with no
# fill -- so the registry only has to carry what actually varies between
# icons: the child elements inside that wrapper.
VIEWBOX = "0 0 24 24"

_CACHE = None


def _nodes():
    """The vendored registry, read once and kept for the life of the process."""
    global _CACHE
    if _CACHE is None:
        with open(REGISTRY, encoding="utf-8") as fh:
            _CACHE = json.load(fh)
    return _CACHE


def known(name):
    """True when the vendored set carries this Lucide name."""
    return name in _nodes()


def names():
    """Every Lucide name the vendored set carries, sorted."""
    return sorted(_nodes())


def _symbol(name):
    """One icon's `<symbol>`, its id namespaced so it cannot collide with a deck's own id."""
    nodes = _nodes()[name]
    children = "".join(
        "<" + tag
        + "".join(f' {key}="{html.escape(str(value), quote=True)}"' for key, value in attrs.items())
        + "/>"
        for tag, attrs in nodes
    )
    return f'<symbol id="icon-{html.escape(name, quote=True)}" viewBox="{VIEWBOX}">{children}</symbol>'


def sprite(names_used):
    """The hidden `<svg>` a build embeds once, carrying only the icons it uses.

    Empty input is a valid deck (no icon-list slide written) and gets the
    empty string -- `{{ICONS}}` still fills exactly once either way, which is
    what `build.py`'s own hole-filling contract requires.
    """
    uniq = sorted(set(names_used))
    if not uniq:
        return ""
    symbols = "".join(_symbol(n) for n in uniq)
    return f'<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">{symbols}</svg>'
