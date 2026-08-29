#!/usr/bin/env python3
"""The four assertions, written once, for every proof in this suite.

ADR 0001's standard is four, and they are these:

  planted   the mutated input really differs from the real one. Without this
            a drifted fixture plants NOTHING and the case still passes the
            other three by accident -- the exact way a proof rots silently.
  red       the check goes red on it.
  message   the red NAMES ITS OWN FIX, in the imperative. `exit 1` names
            nothing, and a red that does not say what to do is a red people
            learn to ignore. The phrase asserted is the fix, never the
            diagnosis: "registered but unstyled" says what is wrong, "drop
            the block from register.py" says what to do about it.
  green     the same check, with nothing planted, is green AGAINST THE REAL
            CORPUS. A proof with no real control measures the author of the
            check, not the check.

WHY THIS IS A MODULE AND NOT COPIED INTO EACH PROOF. It already was copied,
and the two copies had already diverged in how they de-duplicate a repeated
control -- one kept a set, the other a list. Two copies of a rule that drift
is the failure mode this entire suite exists to refuse, and refusing it in
the engine while practising it in the suite is the shape of a gate nobody
believes. It is also what #156 and #157 need: each of them lands a proof
file, and the third divergent driver is the one that quietly asserts three.

The file has no hyphen in its name because it is imported, not run. Every
other file here is a command and carries the house's hyphen.
"""


class Drifted(AssertionError):
    """The fixture no longer describes the tree; pick another needle."""


class Proof:
    """One proof file's worth of cases, all sharing a check and a control.

    `invoke(payload)`  -> (ok, message) for a planted payload
    `planted(payload)` -> True when the payload really differs from the real
                          input. Supplied by the caller because only it knows
                          what "the real input" is.
    `control()`        -> (ok, message) with nothing planted at all
    """

    def __init__(self, title, label, invoke, planted, control, width=19):
        self.title = title
        self.label = label
        self.invoke = invoke
        self.planted = planted
        self.control = control
        self.width = width
        self._told = set()

    def _green(self, key):
        """The control, reported in full only ONCE per key.

        Several cases share one control, and printing the same paragraph
        four times buries the tag that says which assertion actually failed.
        """
        ok, msg = self.control(key)
        if not ok:
            if key in self._told:
                msg = "(same as above)"
            self._told.add(key)
        return ok, msg

    def case(self, key, what, plant, must_say):
        marks, why = [], []

        try:
            payload = plant()
            planted = self.planted(payload)
            if not planted:
                why.append("the plant changed nothing")
        except Drifted as e:
            payload, planted = None, False
            why.append(f"fixture drifted: {e}")
        marks.append(planted)

        if planted:
            try:
                ok, msg = self.invoke(key, payload)
            except Exception as e:                              # noqa: BLE001
                ok, msg = False, f"{type(e).__name__}: {e}"
            red = not ok
            says = must_say.lower() in msg.lower()
            if not red:
                why.append("stayed GREEN")
            elif not says:
                why.append(f"the red never says {must_say!r}")
        else:
            red = says = False
            msg = ""
        marks += [red, says]

        green, gmsg = self._green(key)
        if not green:
            why.append(f"green control is RED: {gmsg}")
        marks.append(green)

        good = all(marks)
        tag = "".join("+" if m else "-" for m in marks)
        name = self.label(key)
        print(f"  {'ok  ' if good else 'FAIL'} {name:<{self.width}} "
              f"[{tag}] {what}")
        if good:
            print(f"       red: {msg}")
        else:
            for w in why:
                print(f"       <- {w}")
        return good

    def run(self, cases):
        """Every case, in order. Returns the number that failed."""
        print(f"{self.title}:  [planted red message green]")
        return sum(not self.case(*c) for c in cases)

    def refuse(self, why):
        """No case could run at all -- say so as a red that names its fix."""
        print(f"{self.title}:  [planted red message green]")
        print(f"  FAIL {'setup':<{self.width}} {why}")
        return 1
