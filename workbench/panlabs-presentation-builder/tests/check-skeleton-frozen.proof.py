#!/usr/bin/env python3
"""Plant a drifted skeleton and demand RED -- the same four assertions.

    python3 check-skeleton-frozen.proof.py

The freeze is the fixed point every family of the architecture gate rests on:
if the skeleton on disk is not the one the suite was measured against, all six
of them are green about another engine. A fixed point that has never been seen
to move is exactly the kind of check this house calls documentation, so it
gets a proof of its own, on the standard `proof_driver.py` states in full.

NOTHING IS WRITTEN TO THE TREE. `verdict()` takes the bytes and the manifest
entry as arguments precisely so a defect can be planted in memory: a proof
that mutates the file it measures is one interrupted run away from leaving a
corrupt skeleton behind, and this repository has already paid for a review
agent that planted its defect in the real worktree.

AND NOTHING IS READ AT IMPORT TIME EITHER. An earlier draft read the skeleton
into a module-level constant, which meant that with the skeleton missing this
file died of `FileNotFoundError` before printing a line -- while carrying a
case whose entire purpose is to prove that exact condition goes red with a
message. A proof that crashes on the defect it exists to demonstrate is worse
than no proof: it turns a named red into a stack trace.
"""
import importlib.util
import pathlib
import sys

# Nothing this suite runs may leave bytecode in the tree it measures.
sys.dont_write_bytecode = True

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from proof_driver import Drifted, Proof                           # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "check_skeleton_frozen", HERE / "check-skeleton-frozen.py")
check = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check)

RAW = check.SKELETON.read_bytes() if check.SKELETON.exists() else None
WANT = check.frozen()


def _raw():
    if RAW is None:
        raise Drifted("the skeleton is not on disk, so there is nothing to "
                      "mutate — restore it and run this again")
    return RAW


def plant_one_byte():
    """Flip a single byte in the middle of the skeleton."""
    raw = _raw()
    i = len(raw) // 2
    return raw[:i] + bytes([raw[i] ^ 0x01]) + raw[i + 1:], WANT


def plant_appended():
    """Append one byte -- the drift that also changes the length.

    Worth its own case because the two failures read differently to whoever
    is looking at the red: a same-length change is almost always an edit, a
    longer file is almost always a regeneration.
    """
    return _raw() + b"\n", WANT


def plant_no_manifest():
    """The freeze has never been taken. Nothing is being guarded."""
    return _raw(), None


def plant_skeleton_gone():
    """The skeleton is not there at all.

    This branch lives inside `verdict()` and not inside `main()` precisely so
    it can be planted here: a branch only the filesystem can reach is a
    branch no proof can see, and it would be the one red printed on the day
    a path moved under the suite's feet.
    """
    return None, WANT


CASES = [
    ("frozen", "one byte flipped in the middle",
     plant_one_byte, "restore the file"),
    ("frozen", "one byte appended at the end",
     plant_appended, "--write"),
    ("frozen", "the manifest does not freeze it",
     plant_no_manifest, "--write"),
    ("frozen", "the skeleton is not there at all",
     plant_skeleton_gone, "restore the file"),
]

PROOF = Proof(
    title="skeleton-frozen.proof",
    label=lambda _: "skeleton-frozen",
    invoke=lambda _, payload: check.verdict(*payload),
    planted=lambda payload: payload != (RAW, WANT),
    control=lambda _: check.verdict(RAW, WANT),
)


if __name__ == "__main__":
    sys.exit(1 if PROOF.run(CASES) else 0)
