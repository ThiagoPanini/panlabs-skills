#!/usr/bin/env python3
"""THE EXTRACTOR READS WHAT IT SAYS IT READS, AND SAYS SO WHEN IT CANNOT.

    workbench/panlabs-presentation-builder/tests/check-extract.py
    workbench/panlabs-presentation-builder/tests/check-extract.py <extract.py>

THE SEAM IS THE COMMAND. A file or a URL goes in and one of three things comes
out: the `<li>` of a provenance block with the document's own text under it, a
named SKIP when the tool that format needs is not on this machine, or a refusal
that names what the caller has to fix. Nothing below imports the extractor -- it
is run the way `SKILL.md` tells a reader to run it, because a check that reached
past the command would be green about a library nobody invokes.

THE FIXTURES ARE BUILT HERE AND NEVER COMMITTED, and that is a choice with a
cost. A `.docx` and an `.xlsx` are zips of XML, and a committed one is a binary
nobody can read in a diff -- so the shape being measured would be invisible in
the one place a reader goes looking for it. Written out here, the XML that the
reader is held to is right beside the assertion about it, which is also what lets
this file plant the SAME document twice with its attributes in either order.

AND THE SYNTHETIC ONES ARE NOT THE ONLY EVIDENCE. The readers were measured by
hand, once, against real bytes: a Word document from a vendored template, a
spreadsheet from `panlabs-tech/pokejourney`, and two PDFs. That pass found the
two defects this file now plants for -- an `.xlsx` whose relationship writes
`Target=` before `Id=`, and a target spelled `/xl/worksheets/sheet1.xml` rather
than `worksheets/sheet1.xml` -- and both came back as an empty document, which
is the shape of failure that looks like an empty file rather than like a bug.
A generated fixture agrees with its generator by construction; the note is here
so whoever changes a reader knows to point it at a real file once, by hand.

WHAT IS NOT MEASURED HERE IS THE NETWORK. The suite does not reach out (the
`network-zero` ruler one layer down says why for the deck; the same holds for
its tests), so the URL half of the command is exercised by hand and the YouTube
half is measured only for the branch that needs no network at all -- the one
where `yt-dlp` is not on the PATH, which is a fact about the machine and answers
before a request is made.
"""

import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
SKILL = HERE.parent.parent.parent / "skills" / "panlabs-presentation-builder"
COMMAND = SKILL / "tools" / "extract.py"

# The exit codes the command promises, named here rather than spelled at each
# assertion -- `tools/extract.py`'s own docstring is the other end of this.
WROTE, REFUSED, SKIPPED = 0, 1, 3


# ── the fixtures ─────────────────────────────────────────────────────────────
# ONE NEEDLE PER FORMAT, AND THEY ARE ALL DIFFERENT. A reader wired to the wrong
# branch still produces text; what it cannot produce is the sentence that only
# lives in the file it was pointed at.

NEEDLES = {
    "docx": "A ata de março diz que a fila parou na terça",
    "xlsx": "Correnteza",
    "csv": "Cartografia",
    "md": "O relatório de setembro",
    "txt": "Uma nota solta, sem formato nenhum",
    "html": "A página que o navegador mostra",
    "pdf": "O folheto impresso",
}

DOCX_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Ata da retrospectiva</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">A ata de mar</w:t></w:r><w:r><w:rPr><w:lang w:val="pt-BR"/></w:rPr><w:t>&#231;o diz que a fila parou na ter</w:t></w:r><w:r><w:t>&#231;a</w:t></w:r></w:p>
    <w:p><w:r><w:t>E que ningu&#233;m tinha a manh&#227; livre.</w:t></w:r></w:p>
  </w:body>
</w:document>
"""

SHARED_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
  <si><t>Equipe</t></si><si><t>Espera</t></si><si><t>Cartografia</t></si><si><t>Correnteza</t></si>
</sst>
"""

SHEET_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>3</v></c></row>
    <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3"><v>9</v></c></row>
    <row r="4"/>
  </sheetData>
</worksheet>
"""

BOOK_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Espera" sheetId="1" r:id="rId1"/></sheets>
</workbook>
"""

# THE TWO SPELLINGS OF THE SAME RELATIONSHIP, and the pair is the point. XML says
# nothing about the order attributes are written in, and a target may be
# absolute or relative to the part that declared it -- the real spreadsheet this
# was measured against writes `Target=` first and spells the path absolutely,
# which is the combination that read as an empty workbook before #238 fixed it.
RELS = {
    "id-first": (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
        'relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/'
        'officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/></Relationships>'
    ),
    "target-first": (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
        'relationships">'
        '<Relationship Type="http://schemas.openxmlformats.org/officeDocument/'
        '2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml" '
        'Id="rId1" /></Relationships>'
    ),
}


def _pdf_bytes(said):
    """One page of one line, as the smallest valid PDF that carries text.

    IT IS WRITTEN BYTE BY BYTE BECAUSE NOTHING HERE CAN WRITE ONE. `pypdf` reads
    PDFs and composes pages out of ones that already exist; putting a sentence
    on a blank page is a typesetting job, and the libraries that do it are
    exactly the dependencies this skill refuses. Five objects and a cross
    reference table is the whole format when the page is one line of Helvetica.
    """
    stream = f"BT /F1 24 Tf 72 700 Td ({said}) Tj ET\n".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n"
        + stream + b"endstream",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for n, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += str(n).encode() + b" 0 obj\n" + body + b"\nendobj\n"
    start = len(out)
    out += b"xref\n0 " + str(len(objects) + 1).encode() + b"\n"
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (b"trailer\n<< /Size " + str(len(objects) + 1).encode()
            + b" /Root 1 0 R >>\nstartxref\n" + str(start).encode()
            + b"\n%%EOF\n")
    return bytes(out)


def fixtures(into, rels="id-first"):
    """Write one file per format into a directory, and answer where each went."""
    made = {}

    made["docx"] = os.path.join(into, "ata.docx")
    with zipfile.ZipFile(made["docx"], "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", DOCX_XML)

    made["xlsx"] = os.path.join(into, "espera.xlsx")
    with zipfile.ZipFile(made["xlsx"], "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("xl/workbook.xml", BOOK_XML)
        z.writestr("xl/_rels/workbook.xml.rels", RELS[rels])
        z.writestr("xl/sharedStrings.xml", SHARED_XML)
        z.writestr("xl/worksheets/sheet1.xml", SHEET_XML)

    made["csv"] = os.path.join(into, "equipes.csv")
    with open(made["csv"], "w", encoding="utf-8") as fh:
        fh.write("Equipe,Antes,Depois\nCartografia,9,3\nCorrenteza,14,5\n")

    made["md"] = os.path.join(into, "relatorio.md")
    with open(made["md"], "w", encoding="utf-8") as fh:
        fh.write("# O relatório de setembro\n\nA fila andou, e a outra não.\n")

    made["txt"] = os.path.join(into, "aviso.txt")
    with open(made["txt"], "w", encoding="utf-8") as fh:
        fh.write("Uma nota solta, sem formato nenhum\nsegunda linha\n")

    made["html"] = os.path.join(into, "pagina.html")
    with open(made["html"], "w", encoding="utf-8") as fh:
        fh.write("<html><head><title>O painel</title>"
                 "<style>p{color:red}</style></head><body>"
                 "<script>alert('nada disto é texto')</script>"
                 "<h1>A página que o navegador mostra</h1>"
                 "<p>Primeiro parágrafo.</p><p>Segundo parágrafo.</p>"
                 "</body></html>")

    made["pdf"] = os.path.join(into, "folheto.pdf")
    with open(made["pdf"], "wb") as fh:
        fh.write(_pdf_bytes("O folheto impresso"))

    return made


# ── running the command ──────────────────────────────────────────────────────

def run_command(command, args, env=None):
    """The documented command, once. Answers (code, everything it printed)."""
    where = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    where.update(env or {})
    done = subprocess.run(
        [sys.executable, str(command)] + list(args),
        capture_output=True, text=True, env=where, timeout=180,
    )
    return done.returncode, (done.stdout + done.stderr).strip()


def _no_pypdf(into):
    """An importable `pypdf` that refuses to import -- a machine without it.

    THE MACHINE THIS RUNS ON HAS `pypdf` INSTALLED, and the branch worth proving
    is the one for the machine that does not. Uninstalling it is not something a
    test may do to the machine it runs on, so what changes is the PATH Python
    searches: a package earlier on it whose import raises is, to every `try:
    import pypdf` in the world, indistinguishable from one that is not there.
    """
    shadow = os.path.join(into, "no-pypdf")
    os.makedirs(os.path.join(shadow, "pypdf"), exist_ok=True)
    with open(os.path.join(shadow, "pypdf", "__init__.py"), "w",
              encoding="utf-8") as fh:
        fh.write('raise ImportError("no pypdf on this machine")\n')
    return {"PYTHONPATH": shadow}


def _no_tools(into):
    """A PATH with nothing on it -- a machine without `yt-dlp`."""
    empty = os.path.join(into, "empty-bin")
    os.makedirs(empty, exist_ok=True)
    return {"PATH": empty}


def _root(command):
    """The skill tree the command lives in: `<tree>/tools/extract.py`.

    ASKED OF THE COMMAND AND NOT OF THIS FILE, because the proof beside it runs
    every family against a COPY of the tree in a temp directory. A family that
    read the constant at the top would be asking the real skill whether the
    planted one wrote into itself -- which is green whatever the plant did.
    """
    return pathlib.Path(command).resolve().parent.parent


def _fragment(said):
    """The one `<li …>` line of the output, or "" when there is none."""
    for line in said.splitlines():
        if line.strip().startswith("<li "):
            return line.strip()
    return ""


# ── the families ─────────────────────────────────────────────────────────────

def check_every_format(command=None, **_):
    """Six formats in, six fragments out, each carrying its own document."""
    command = command or COMMAND
    missing = []
    with tempfile.TemporaryDirectory(prefix="panlabs-extract-check-") as into:
        made = fixtures(into)
        for kind in ("docx", "xlsx", "csv", "md", "txt", "html"):
            code, said = run_command(command, [made[kind], "--id", "F7"])
            fragment = _fragment(said)
            if code != WROTE:
                missing.append(f"{kind}: exited {code} instead of {WROTE} -- {said[:120]}")
                continue
            if 'id="F7"' not in fragment:
                missing.append(f'{kind}: the fragment carries no id="F7" -- {fragment[:90]}')
            for field in ('class="what"', 'class="where"', 'class="when"'):
                if field not in fragment:
                    missing.append(f"{kind}: the fragment has no {field}")
            if NEEDLES[kind] not in said:
                missing.append(
                    f'{kind}: the text never says "{NEEDLES[kind]}", so the '
                    "document that was read is not the one it was pointed at")
            # THE SHEET'S DECLARED NAME IS WHAT PROVES THE RELATIONSHIPS WERE
            # READ. A workbook can also be found by walking the zip for
            # `xl/worksheets/*.xml`, which is the fallback the reader keeps for a
            # file with no relationships at all -- and that path knows the rows
            # but not what the sheet is CALLED. Asking for the name is what keeps
            # the fallback from quietly standing in for the real one.
            if kind == "xlsx" and "## Espera" not in said:
                missing.append(
                    "xlsx: the sheet's declared name «Espera» never appears, so "
                    "the workbook was found by walking the zip rather than "
                    "through xl/_rels/workbook.xml.rels")
    if missing:
        return False, (
            f"{len(missing)} format(s) came back wrong: {'; '.join(missing[:3])}"
            f"{'; …' if len(missing) > 3 else ''} -- fix the reader in "
            "tools/extract.py, or take the extension out of READERS so it "
            "refuses instead of reading badly")
    return True, ("docx, xlsx, csv, md, txt and html each read into a fragment "
                  "carrying their own words")


def check_attribute_order(command=None, **_):
    """The same spreadsheet, its relationship written both ways, reads the same."""
    command = command or COMMAND
    answers = {}
    with tempfile.TemporaryDirectory(prefix="panlabs-extract-order-") as into:
        for spelling in RELS:
            room = os.path.join(into, spelling)
            os.makedirs(room, exist_ok=True)
            made = fixtures(room, rels=spelling)
            code, said = run_command(command, [made["xlsx"], "--id", "F1"])
            answers[spelling] = (code, NEEDLES["xlsx"] in said
                                 and "## Espera" in said)
    bad = [s for s, (code, found) in answers.items()
           if code != WROTE or not found]
    if bad:
        return False, (
            "read a relationship's attributes into a dict in tools/extract.py "
            "instead of matching them in one order, and resolve a Target that "
            "starts with a slash as a path from the root of the zip — the "
            f"spreadsheet comes back wrong when its relationship is written "
            f"{' and '.join(bad)}")
    return True, ("the workbook reads the same with Id= first and with Target= "
                  "first, absolute or relative")


def check_pdf_text(command=None, **_):
    """A PDF with a text layer gives its text back -- where pypdf is installed."""
    command = command or COMMAND
    try:
        import pypdf                                            # noqa: F401
    except ImportError:
        return True, ("SKIP -- no pypdf on this machine, so the branch that "
                      "reads a PDF cannot be measured here; the branch that "
                      "says so is measured by the family below")
    with tempfile.TemporaryDirectory(prefix="panlabs-extract-pdf-") as into:
        made = fixtures(into)
        code, said = run_command(command, [made["pdf"], "--id", "F2"])
    if code != WROTE:
        return False, (f"fix the PDF reader in tools/extract.py — a PDF with a "
                       f"text layer exited {code}: {said[:160]}")
    if NEEDLES["pdf"] not in said:
        return False, ("fix the PDF reader in tools/extract.py — the one line "
                       "printed on the page never came back, and pypdf is "
                       "installed here, so what came back empty is the reader "
                       "and not the machine")
    return True, "a one-page PDF gives back the line printed on it"


def check_named_skips(command=None, **_):
    """Without the tool a format needs, a named SKIP and the agreed code."""
    command = command or COMMAND
    fixes = []
    with tempfile.TemporaryDirectory(prefix="panlabs-extract-skip-") as into:
        made = fixtures(into)
        code, said = run_command(command, [made["pdf"]], env=_no_pypdf(into))
        if code != SKIPPED:
            fixes.append(f"a PDF with no pypdf exited {code}, not {SKIPPED}")
        if "SKIP" not in said or "pypdf" not in said:
            fixes.append(f"the PDF SKIP never names pypdf: {said[:120]}")

        code, said = run_command(
            command, ["https://www.youtube.com/watch?v=nada"],
            env=_no_tools(into))
        if code != SKIPPED:
            fixes.append(f"a video with no yt-dlp exited {code}, not {SKIPPED}")
        if "SKIP" not in said or "yt-dlp" not in said:
            fixes.append(f"the video SKIP never names yt-dlp: {said[:120]}")
    if fixes:
        return False, (
            f"print the named SKIP and exit {SKIPPED} from tools/extract.py — "
            f"{'; '.join(fixes)}. A missing tool is a fact about the machine and "
            f"not a defect in the input, and a caller reading {WROTE} would carry "
            "on with a source whose words it never got")
    return True, (f"a PDF without pypdf and a video without yt-dlp each name "
                  f"what is missing and exit {SKIPPED}")


def check_refusals(command=None, **_):
    """What the CALLER has to fix comes back as a refusal that says so."""
    command = command or COMMAND
    fixes = []
    with tempfile.TemporaryDirectory(prefix="panlabs-extract-refuse-") as into:
        made = fixtures(into)
        cases = [
            ("a path that is not there",
             [os.path.join(into, "nao-existe.md")], "is not there"),
            ("an extension nobody reads",
             [os.path.join(into, "ata.docx") + ".zip"], "some other way"),
            ("an --out inside the skill",
             [made["md"], "--out", str(_root(command) / "examples" / "roubado.md")],
             "outside the skill"),
        ]
        # The zip that is not a format: written beside the fixtures so the
        # refusal is about the EXTENSION and not about a file that is missing.
        shutil.copy2(made["docx"], os.path.join(into, "ata.docx.zip"))
        for what, args, must_say in cases:
            code, said = run_command(command, args)
            if code != REFUSED:
                fixes.append(f"{what}: exited {code}, not {REFUSED}")
            elif not said.startswith("REFUSED ·"):
                fixes.append(f"{what}: the red is not a refusal -- {said[:90]}")
            elif must_say not in said:
                fixes.append(f'{what}: the refusal never says "{must_say}"')
    if fixes:
        return False, ("refuse each of these with a fix in tools/extract.py — "
                       + "; ".join(fixes)
                       + ". A red that does not say what to do is a red people "
                         "learn to ignore")
    return True, ("a missing path, an unknown extension and an --out inside the "
                  "tree are each refused with the fix")


def check_writes_nothing(command=None, before=None, **_):
    """Nothing ANY run in this check wrote landed inside the skill's own tree.

    THE BASELINE IS THE TREE BEFORE THE FIRST FAMILY, NOT BEFORE THIS ONE, and
    the difference is a defect this family missed while it was written the other
    way. A command that kept a copy of its own output inside the tree wrote that
    copy on the very first run of `every-format`, four families up -- so a
    snapshot taken here already had the file in it, and the two listings matched
    perfectly while the skill sat there one file heavier. `run()` below takes the
    baseline once, before anything has run.
    """
    command = command or COMMAND
    tree = _root(command)
    before = _tree(tree) if before is None else before
    with tempfile.TemporaryDirectory(prefix="panlabs-extract-clean-") as into:
        made = fixtures(into)
        run_command(command, [made["md"], "--out", os.path.join(into, "f1.md")])
        run_command(command, [made["html"]])
    grew = sorted(_tree(tree) - before)
    if grew:
        return False, (
            "send every byte this command writes outside the tree, in "
            f"tools/extract.py — the skill grew {len(grew)} file(s) while it "
            f"ran: {', '.join(grew[:4])}. A tool that writes inside the tree it "
            "lives in makes the installed skill heavier every time somebody "
            "uses it")
    return True, ("the skill tree holds exactly the files it held before the "
                  "first family ran")


def _tree(root):
    """Every path inside one skill tree, relative to it."""
    found = set()
    for here, _, names in os.walk(root):
        for name in names:
            found.add(os.path.relpath(os.path.join(here, name), root))
    return found


FAMILIES = [
    ("every-format", check_every_format),
    ("attribute-order", check_attribute_order),
    ("pdf-text", check_pdf_text),
    ("named-skips", check_named_skips),
    ("refusals", check_refusals),
    ("writes-nothing", check_writes_nothing),
]

BY_NAME = dict(FAMILIES)


def run(quiet=False, **over):
    """Run every family. Returns the number of reds.

    THE TREE IS LISTED ONCE, HERE, and handed down -- see `check_writes_nothing`
    for the defect that taught this. Nothing else in this file needs it.
    """
    over.setdefault("before", _tree(_root(over.get("command") or COMMAND)))
    bad = 0
    for name, fn in FAMILIES:
        try:
            ok, msg = fn(**over)
        except Exception as e:                                  # noqa: BLE001
            ok, msg = False, f"{type(e).__name__}: {e}"
        bad += not ok
        if not quiet:
            print(f"  {'ok  ' if ok else 'FAIL'} {name:<17} {msg}")
    return bad


def main(argv):
    print("extract:")
    command = pathlib.Path(argv[0]).resolve() if argv else COMMAND
    if not command.exists():
        print(f"  FAIL command           {command} is not there -- every family "
              "below runs it, and their verdicts are unavailable, not false")
        return 1
    return run(command=command)


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1:]) else 0)
