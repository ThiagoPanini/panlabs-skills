#!/usr/bin/env python3
"""The skeleton is FROZEN. This is the line that says so to a machine.

    python3 check-skeleton-frozen.py            # checks
    python3 check-skeleton-frozen.py --write    # re-freezes, deliberately

WHY THE SKELETON AND NOT THE WHOLE ENGINE. `build.py`, `register.py` and
`vocab.py` are meant to grow -- a ninth block is a line in the register and a
renderer beside it, and freezing them would turn ordinary work into a
manifest edit, which teaches people to run `--write` without reading. The
skeleton is the one artifact the doctrine of #97 calls COPIED AND NEVER
REGENERATED: it enters the output byte for byte, no line of its CSS or JS is
ever produced per presentation, and that is the whole reason two different
presentations are the same identity instead of two approximations of it.

#154 is what made the freeze possible to state at all. Until it landed, the
skeleton carrying #120's seam existed only as the result of running two patch
scripts over a copy of another skeleton -- a recipe, not a file. Freezing a
recipe freezes whatever it happened to produce that day.

WHY A MANIFEST AND NOT `git diff`. `git diff` compares against what is
committed, so a skeleton that was changed AND committed passes. This compares
against the bytes the suite was measured against, which is the claim that
matters -- and it is the claim the architecture gate one layer down rests on:
every one of its six families reads this file as its fixed point.

WHY IT HAS `--write` AT ALL. The skeleton will change one day; the point is
never that it cannot, only that it cannot change BY ACCIDENT. `--write` makes
the next change deliberate -- somebody runs it and says why in the commit --
instead of discovered three tickets later, which is the shape of the one mark
this repository already has on ADR 0001's counter.
"""
import hashlib
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
SKILL = (HERE / "../../../skills/panlabs-presentation-builder").resolve()
SKELETON = SKILL / "engine/skeleton.html"
MANIFEST = HERE / "skeleton.manifest.json"
KEY = "skills/panlabs-presentation-builder/engine/skeleton.html"


def measure(raw):
    return dict(sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))


def verdict(raw, want):
    """The whole check, as a function of bytes and a manifest entry.

    Taking both as arguments is what lets the proof plant a defect without
    writing to the tree it is measuring. A check that can only be exercised
    by mutating the real file is a check nobody exercises -- and `raw=None`
    for "the file is gone" lives here, rather than in `main`, for the same
    reason: a branch that only the filesystem can reach is a branch no proof
    can see.
    """
    if raw is None:
        return False, (f"gone: {KEY} -- the engine the whole suite measures "
                       f"is not there. Restore the file, or, if the skill "
                       f"moved, point this check at where it went")
    if want is None:
        return False, (f"{MANIFEST.name} does not freeze {KEY} -- run "
                       f"`check-skeleton-frozen.py --write` once, and say why "
                       f"in the commit")
    now = measure(raw)
    if now["sha256"] != want["sha256"]:
        return False, (
            f"{KEY} is NOT the frozen skeleton: "
            f"frozen {want['bytes']:,} B / sha256 {want['sha256'][:16]}..., "
            f"on disk {now['bytes']:,} B / sha256 {now['sha256'][:16]}.... "
            f"The skeleton is copied byte for byte into every output, so a "
            f"change here changes every presentation generated afterwards. "
            f"If it was meant, run `check-skeleton-frozen.py --write` and say "
            f"why in the commit; if it was not, restore the file")
    return True, (f"{KEY}: frozen, {now['bytes']:,} B, "
                  f"sha256 {now['sha256'][:16]}...")


def frozen():
    """The manifest entry for the skeleton, or None."""
    if not MANIFEST.exists():
        return None
    return json.loads(MANIFEST.read_text(encoding="utf-8")).get(KEY)


def main(argv):
    raw = SKELETON.read_bytes() if SKELETON.exists() else None
    if raw is None:
        ok, msg = verdict(None, frozen())
        print(f"  {msg}")
        return 1

    if "--write" in argv:
        MANIFEST.write_text(
            json.dumps({KEY: measure(raw)}, indent=2) + "\n", encoding="utf-8")
        m = measure(raw)
        print(f"  frozen: {KEY} -- {m['bytes']:,} B, "
              f"sha256 {m['sha256'][:16]}...")
        return 0

    ok, msg = verdict(raw, frozen())
    print(f"  {msg}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
