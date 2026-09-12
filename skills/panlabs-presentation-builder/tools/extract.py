#!/usr/bin/env python3
"""THE EXTRACTOR: a file or a URL in, one source of the provenance block out.

    python3 tools/extract.py <file-or-url> [--id F1] [--out /tmp/f1.md]

WHAT IT IS FOR. #238 makes every number on a stage cite a source the header
declares, and a header nobody can fill is a rule nobody keeps: the material a
deck is built from arrives as a `.docx` somebody mailed, a spreadsheet, a page
on the web, a PDF. This turns one of those into the `<li>` the block wants, with
the document's own text under it to pick an excerpt from -- so writing the
provenance is reading, not retyping.

IT IS THE PYTHON OF THE HOUSE AND NOTHING ELSE, which is the same promise the
compiler beside it makes: no `pip install`, no library to have installed for the
common case. A `.docx` and an `.xlsx` are zips with XML in them and the standard
library opens both; `.csv`, `.md`, `.txt` and HTML over the wire need nothing at
all. Two formats cannot be read that way, and for those it DELEGATES -- `pypdf`
for a PDF, `yt-dlp` for a video's captions -- and says so when they are not on
the machine rather than guessing at the content.

A SKIP IS NAMED, AND IT EXITS 3. The render gate's own missing-Chromium SKIP is
the shape this borrows (`gate/render.cjs`), and the exit code is where the two
part company on purpose: that gate is a second opinion about a page already
written, so a SKIP there costs the caller nothing and folds into 0. This command
has nothing else to hand back -- a SKIP means no text -- and a script that read
0 would carry on with a source whose words it never got. So the code says which
of the three happened, and `workbench/.../tests/check-extract.py` asserts all
three:

    0   a fragment was written
    1   the CALLER has something to fix: a path that is not there, a format this
        does not read, an --out inside the skill's own tree
    3   nothing to fix in the input -- the tool this format needs is not on this
        machine, and what is missing is named

NOTHING IS EVER WRITTEN INSIDE THE SKILL. Same rule as `SKILL.md`'s: the tree
that gets installed does not grow a file per run. With no `--out` the fragment
goes to stdout; with one, it goes where the caller said, and an `--out` that
resolves inside this tree is refused with the fix.

THE DOCUMENT IT WRITES IS PORTUGUESE AND THE MESSAGES IT PRINTS ARE ENGLISH.
The same seam `compiler/storyboard.py` sits on, for the same reason: what a
program AUTHORS for a person to read is that person's language, and what it says
about its own failure is the house's. CLAUDE.md § O código é em inglês.
"""

import argparse
import csv
import html
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from datetime import date, datetime
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

# BEFORE THE SIBLING IMPORT, for the reason `compiler/build.py` states at the
# same line: importing `catalog` writes `compiler/__pycache__/` into a tree that
# is usually a symlink to a checkout, and a tool must not modify what it lives in.
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "compiler"))

from catalog import (SLOT_TAG, SOURCE_EXCERPT, SOURCE_WHAT,  # noqa: E402
                     SOURCE_WHEN, SOURCE_WHERE, SOURCES_SPEC, SOURCES_TAG)

# The one exit code this file invents; the other two are the shell's own.
SKIP = 3

# HOW LONG A LINE MAY BE BEFORE IT IS NOT A TITLE. The `what` is a guess read off
# the top of the document, and a guess that comes back as a whole paragraph is
# worse than no guess -- it looks filled in.
TITLE_MAX = 120


class Refused(Exception):
    """The caller has something to fix, and the message says what."""


class Absent(Exception):
    """The tool this format needs is not on this machine. Not the caller's fault."""


# ── the readers ──────────────────────────────────────────────────────────────
# EACH ONE ANSWERS THE SAME PAIR -- `(text, title)` -- and answers it in plain
# text with blank lines between blocks. Nothing here tries to keep a document's
# structure: what the caller does with the text is pick a sentence out of it for
# an `excerpt`, and structure it never asked for would be structure to strip.
#
# THE TITLE IS EMPTY FOR EVERY FORMAT BUT ONE, and the pair exists for that one.
# HTML carries its own `<title>`, which beats any line guessed off the top of a
# document; the others have nothing better to offer than the guess, and saying so
# with an empty string is what keeps `READERS` from carrying a hole and every
# caller from carrying an `if` about it.

def _tidy(text):
    """Text with the runs of blank lines collapsed and the edges trimmed.

    IT IS NOT `source.squeeze`, WHICH IS WHY IT IS NOT CALLED THAT. That one
    collapses every run of whitespace into one space, because a slot's prose is
    a sentence; this one keeps the line breaks a document was written with and
    only drops the empty runs between them, because what a reader is about to do
    with this is find a paragraph in it.
    """
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    out = []
    for line in lines:
        if line or (out and out[-1]):
            out.append(line)
    return "\n".join(out).strip()


def _read_text(path):
    """A file's bytes as text, UTF-8, never refused for one bad byte.

    THE ONE READER THAT IS NOT A READER. Everything in `READERS` answers
    `(text, title)`; this answers raw text, and it is what the others are built
    out of -- including the caption file, which is not a document at all.
    """
    with open(path, "rb") as fh:
        return fh.read().decode("utf-8", "replace")


def _txt(path):
    """A plain text or Markdown file: its own words, and no title of its own."""
    return _tidy(_read_text(path)), ""


class _Stripper(HTMLParser):
    """Markup in, the words out -- script and style included out.

    THE TAG SET IS NOT A WHITELIST HERE, and it is the one place in this skill
    where that is right: `compiler/audit.py` refuses a tag it never heard of
    because what it reads is going to be BUILT, and this is only ever read. What
    it does need is to know which tags end a line, so a menu does not come back
    as one word.
    """

    BLOCK = frozenset((
        "p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6",
        "section", "article", "header", "footer", "blockquote", "pre", "td",
        "th", "table", "ul", "ol", "figcaption", "main", "nav",
    ))
    MUTE = frozenset(("script", "style", "noscript", "svg", "head"))

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.title = ""
        self._muted = 0
        self._titling = False

    def handle_starttag(self, tag, attrs):
        if tag in self.MUTE:
            self._muted += 1
        if tag == "title":
            self._titling = True
        if tag in self.BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in self.MUTE and self._muted:
            self._muted -= 1
        if tag == "title":
            self._titling = False
        if tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if self._titling:
            self.title += data
        if not self._muted:
            self.out.append(data)

    def text(self):
        return _tidy("".join(self.out))


def _html_text(markup):
    """(text, title) of an HTML document."""
    reader = _Stripper()
    reader.feed(markup)
    reader.close()
    return reader.text(), " ".join(reader.title.split())


def _html_file(path):
    """The same, from disk. The one format that answers with a title of its own."""
    return _html_text(_read_text(path))


# A run of text in a Word document, and the paragraph that ends one.
W_TEXT = re.compile(r"<w:t[^>]*>(.*?)</w:t\s*>", re.S)
W_PARA = re.compile(r"</w:p\s*>")


def _docx(path):
    """A Word document: `word/document.xml` out of the zip, tags off, one
    paragraph per line.

    IT IS READ AS XML-SHAPED TEXT AND NOT PARSED AS A TREE, deliberately. A
    `.docx` carries its words in `<w:t>` runs that split mid-word wherever the
    editor happened to change a property -- a spell-check mark, a language, a
    tracked edit -- so the tree's shape says nothing about the sentence. Joining
    every run inside a paragraph is what puts a sentence back together, and it is
    the same answer a tree walk would arrive at with more ceremony.
    """
    try:
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf-8", "replace")
    except KeyError:
        raise Refused(
            f"point at a .docx — {os.path.basename(path)} is a zip with no "
            "word/document.xml inside it, so it is some other kind of file "
            "wearing the extension"
        )
    except zipfile.BadZipFile:
        raise Refused(
            f"point at a real .docx — {os.path.basename(path)} is not a zip at "
            "all, and a Word document always is one"
        )
    lines = []
    for para in W_PARA.split(xml):
        said = "".join(html.unescape(run) for run in W_TEXT.findall(para))
        lines.append(" ".join(said.split()))
    return _tidy("\n".join(lines)), ""


# A worksheet's rows and cells, and the shared string table they point into.
#
# NOTHING HERE DEPENDS ON THE ORDER OF AN ATTRIBUTE, and that is not caution: the
# first version of this file matched `Id="…"` before `Target="…"` and came back
# with an empty spreadsheet from the first real `.xlsx` it was pointed at, which
# writes them the other way round. XML says nothing about the order attributes
# are written in, so the tag is matched whole and its attributes are read into a
# dict.
X_SHEET = re.compile(r"<sheet\b([^>]*?)/?>", re.S)
X_REL = re.compile(r"<Relationship\b([^>]*?)/?>", re.S)
X_ROW = re.compile(r"<row\b[^>]*/>|<row\b[^>]*>.*?</row\s*>", re.S)
X_CELL = re.compile(r"<c\b([^>]*?)/>|<c\b([^>]*?)>(.*?)</c\s*>", re.S)
X_VALUE = re.compile(r"<v[^>]*>(.*?)</v\s*>", re.S)
X_INLINE = re.compile(r"<t[^>]*>(.*?)</t\s*>", re.S)
X_STRING = re.compile(r"<si\b.*?</si\s*>", re.S)
X_ATTR = re.compile(r'([\w:.-]+)\s*=\s*"([^"]*)"')


def _attrs(said):
    """One tag's attributes, by name, whatever order they were written in."""
    return {k: html.unescape(v) for k, v in X_ATTR.findall(said or "")}


def _member(target):
    """Where a workbook relationship's target really is inside the zip.

    A TARGET IS ABSOLUTE OR RELATIVE AND BOTH ARE WRITTEN IN THE WILD -- the
    spreadsheet this was first tested against says `/xl/worksheets/sheet1.xml`,
    and the specification's own examples say `worksheets/sheet1.xml`. Relative
    means relative to the part that declared it, which is `xl/workbook.xml`.
    """
    if target.startswith("/"):
        return target.lstrip("/")
    return os.path.normpath(os.path.join("xl", target)).replace(os.sep, "/")


def _xlsx(path):
    """A spreadsheet: every sheet, every row, the cells joined by a pipe.

    THE SHARED STRING TABLE IS WHY THIS IS NOT THREE LINES. An `.xlsx` stores
    each distinct piece of text ONCE, in `xl/sharedStrings.xml`, and writes an
    INDEX into the cell -- so a sheet read without the table comes back as a grid
    of small integers that look exactly like data.
    """
    try:
        z = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        raise Refused(
            f"point at a real .xlsx — {os.path.basename(path)} is not a zip at "
            "all, and a spreadsheet always is one"
        )
    with z:
        names = set(z.namelist())
        if "xl/workbook.xml" not in names:
            raise Refused(
                f"point at an .xlsx — {os.path.basename(path)} is a zip with no "
                "xl/workbook.xml inside it, so it is some other kind of file "
                "wearing the extension"
            )

        shared = []
        if "xl/sharedStrings.xml" in names:
            table = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
            for item in X_STRING.findall(table):
                shared.append(html.unescape("".join(X_INLINE.findall(item))))

        rels = {}
        if "xl/_rels/workbook.xml.rels" in names:
            said = z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "replace")
            for tag in X_REL.findall(said):
                found = _attrs(tag)
                if found.get("Id") and found.get("Target"):
                    rels[found["Id"]] = _member(found["Target"])

        book = z.read("xl/workbook.xml").decode("utf-8", "replace")
        sheets = [(_attrs(tag).get("name", ""), _attrs(tag).get("r:id", ""))
                  for tag in X_SHEET.findall(book)]
        # A WORKBOOK WITH NO RELATIONSHIPS STILL HAS ITS SHEETS, and a reader
        # that gave up there would hand back an empty document for a file whose
        # every row is sitting in the zip under the name it always has.
        if not any(rels.get(rid) in names for _, rid in sheets):
            sheets = [(os.path.basename(n), n) for n in sorted(names)
                      if n.startswith("xl/worksheets/") and n.endswith(".xml")]
            rels = {n: n for _, n in sheets}

        out = []
        for title, rid in sheets:
            member = rels.get(rid, "")
            if member not in names:
                continue
            xml = z.read(member).decode("utf-8", "replace")
            rows = []
            for row in X_ROW.findall(xml):
                cells = []
                for bare, attrs, body in X_CELL.findall(row):
                    kind = _attrs(bare or attrs).get("t", "")
                    said = ""
                    if kind == "s":
                        found = X_VALUE.search(body or "")
                        if found:
                            index = int(found.group(1))
                            said = shared[index] if index < len(shared) else ""
                    elif kind == "inlineStr":
                        said = html.unescape("".join(X_INLINE.findall(body or "")))
                    else:
                        found = X_VALUE.search(body or "")
                        said = html.unescape(found.group(1)) if found else ""
                    cells.append(" ".join(said.split()))
                while cells and not cells[-1]:
                    cells.pop()
                if cells:
                    rows.append(" | ".join(cells))
            if rows:
                out.append(f"## {title}\n\n" + "\n".join(rows))
        return _tidy("\n\n".join(out)), ""


def _csv_file(path):
    """A CSV, as rows of cells joined by a pipe -- the same shape a sheet gets."""
    with open(path, newline="", encoding="utf-8", errors="replace") as fh:
        return _tidy("\n".join(
            " | ".join(cell.strip() for cell in row) for row in csv.reader(fh))), ""


def _pdf(path):
    """A PDF, delegated to `pypdf`, or a named SKIP when it is not installed."""
    try:
        from pypdf import PdfReader
    except ImportError:
        raise Absent(
            "pypdf is not on this machine, and a PDF's text is not something "
            "the standard library can read — install it (`pip install pypdf`) "
            "and run this again, or copy the passage you need by hand into the "
            f"<{SLOT_TAG} class=\"{SOURCE_EXCERPT}\"> yourself"
        )
    reader = PdfReader(path)
    said = _tidy("\n\n".join(page.extract_text() or "" for page in reader.pages))
    if not said:
        # A PDF OF PICTURES IS THE VIDEO WITH NO CAPTIONS, one format over. The
        # first real PDF this was pointed at came back empty from pypdf itself --
        # sixteen pages, not one character of text layer -- and "o documento não
        # tem texto nenhum" would send the reader looking for a bug in this
        # command. What is missing is an OCR nobody here has.
        raise Absent(
            f"{os.path.basename(path)} has no text layer — its "
            f"{len(reader.pages)} page(s) are images, and reading them needs an "
            "OCR nobody on this machine has. Copy the passage you need by hand, "
            "or find the document in a format that carries its own text"
        )
    return said, ""


# A caption file's furniture: the cue numbers, the timecodes, and the inline
# tags a YouTube auto-caption carries.
VTT_CUE = re.compile(r"^\d+$|-->|^WEBVTT|^Kind:|^Language:|^NOTE\b")
VTT_TAG = re.compile(r"<[^>]+>")

YOUTUBE_HOSTS = ("youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com")

# THE LANGUAGES ASKED FOR, SPELLED AND NOT GLOBBED. `pt.*` looks like the
# generous choice and is the expensive one: YouTube publishes a machine
# TRANSLATION of the captions into every language it knows, so the glob asks for
# a dozen files of the same lecture and the run comes back rate-limited (HTTP
# 429) partway through -- with the transcript in hand but the video's own title
# and date never written. Three names, in the order this house reads them.
CAPTIONS = "pt-BR,pt,en"


def _youtube(url, into):
    """A video's captions, delegated to `yt-dlp`.

    It answers (text, title, when): the publisher already knows what the video is
    called and when it went up, which are two of the three fields the block wants.

    A VIDEO WITH NO CAPTIONS HAS NO TRANSCRIPT ON THIS MACHINE, and saying so is
    the whole point of this branch. Transcribing audio needs a model nobody here
    has; what `yt-dlp` fetches is the text the publisher (or YouTube's own
    recogniser) already wrote, and when neither exists the honest answer is that
    there is nothing to read -- never a summary this command invented.
    """
    if not shutil.which("yt-dlp"):
        raise Absent(
            "yt-dlp is not on this machine, and a video's captions are not "
            "something the standard library can fetch — install it (`pip "
            "install yt-dlp`) and run this again, or paste the passage you need "
            "by hand"
        )
    done = subprocess.run(
        ["yt-dlp", "--skip-download", "--write-subs", "--write-auto-subs",
         "--write-info-json", "--sub-format", "vtt", "--sub-langs", CAPTIONS,
         "--no-progress", "-o", os.path.join(into, "captions"), url],
        capture_output=True, text=True, timeout=180,
    )
    found = sorted(f for f in os.listdir(into) if f.endswith(".vtt"))
    if not found:
        raise Absent(
            f"this video has no captions to read — yt-dlp fetched none in "
            f"{CAPTIONS} for {url}, and a video without them has no transcript "
            "on this machine: nothing here transcribes audio, and a summary "
            "written from the title would be a source that says what nobody said"
            + (f" (yt-dlp said: {done.stderr.strip().splitlines()[-1]})"
               if done.stderr.strip() else "")
        )
    # IN THE ORDER ASKED FOR, NOT IN THE ORDER THE DISK LISTS THEM. `captions.en`
    # sorts before `captions.pt-BR`, so an alphabetical pick quietly hands back
    # English for a deck being written in Portuguese whenever both exist.
    chosen = next(
        (f"captions.{lang}.vtt" for lang in CAPTIONS.split(",")
         if f"captions.{lang}.vtt" in found),
        found[0],
    )
    lines, last = [], None
    for line in _read_text(os.path.join(into, chosen)).splitlines():
        said = " ".join(VTT_TAG.sub("", line).split())
        if not said or VTT_CUE.search(said):
            continue
        # AUTO-CAPTIONS REPEAT EVERY LINE, once as the cue that scrolls in and
        # once as the cue that scrolls out. Dropping a line identical to the one
        # before it is what turns a transcript back into prose.
        if said != last:
            lines.append(said)
            last = said

    # THE VIDEO'S OWN TITLE AND UPLOAD DATE, WHICH ARE THE TWO FIELDS THE BLOCK
    # WANTS. Guessing the `what` off the first caption gives "Isto é um três." --
    # the opening sentence of a lecture, and a `what` a reader would have to
    # rewrite every time. The publisher already answered both questions, and
    # `--write-info-json` is where the answer lands.
    title, when = "", date.today().isoformat()
    info = os.path.join(into, "captions.info.json")
    if os.path.exists(info):
        try:
            with open(info, encoding="utf-8") as fh:
                said = json.load(fh)
            title = " ".join(str(said.get("title", "")).split())
            stamp = str(said.get("upload_date", ""))
            if len(stamp) == 8 and stamp.isdigit():
                when = f"{stamp[:4]}-{stamp[4:6]}-{stamp[6:]}"
        except (OSError, ValueError):
            pass
    return _tidy("\n".join(lines)), title, when


# ── what kind of thing this is ───────────────────────────────────────────────

# EVERY READER ANSWERS `(text, title)`, INCLUDING THE FIVE WITH NO TITLE TO GIVE.
# HTML is the one format that carries its own name -- a `<title>` beats any line
# guessed off the top of a document -- and an entry shaped for it alone would put
# a `None` in this table and an `if kind == "html"` beside every use of it.
READERS = {
    ".docx": ("docx", _docx),
    ".xlsx": ("xlsx", _xlsx),
    ".csv": ("csv", _csv_file),
    ".md": ("md", _txt),
    ".markdown": ("md", _txt),
    ".txt": ("txt", _txt),
    ".text": ("txt", _txt),
    ".pdf": ("pdf", _pdf),
    ".html": ("html", _html_file),
    ".htm": ("html", _html_file),
}

KINDS = ", ".join(sorted(set(k for k, _ in READERS.values())))


def _title_of(text, kind, fallback):
    """The `what` this command guesses: the document's own first line.

    A GUESS, AND THE DOCUMENT SAYS SO. What a source IS to a deck is a judgement
    -- "a ata de março" against "Reunião 2026-03-12 v3 FINAL" -- and no reader of
    bytes makes it. What this can do is put the document's own words there
    instead of leaving the field blank, because a field left blank is one the
    writer has to go find the answer for, and a field filled wrong is one they
    correct in place.
    """
    for line in text.splitlines():
        said = line.strip()
        if kind in ("md", "xlsx"):
            said = said.lstrip("#").strip()
        if said and len(said) <= TITLE_MAX:
            return said
    return fallback


def _when_of(path):
    """A file's own date: when it was last written, as the block wants it."""
    try:
        stamp = os.path.getmtime(path)
    except OSError:
        return date.today().isoformat()
    return datetime.fromtimestamp(stamp).date().isoformat()


def _fetch(url, into):
    """One URL: (kind, text, title, when). The network is the caller's, not ours."""
    host = (urlparse(url).hostname or "").lower()
    if host in YOUTUBE_HOSTS:
        said, title, when = _youtube(url, into)
        return "video", said, title, when

    request = Request(url, headers={
        "User-Agent": "panlabs-presentation-builder/extract.py",
        "Accept": "text/html, text/plain, text/csv, text/markdown, */*",
    })
    try:
        with urlopen(request, timeout=30) as answer:
            raw = answer.read()
            kind = (answer.headers.get_content_type() or "").lower()
            charset = answer.headers.get_content_charset() or "utf-8"
            modified = answer.headers.get("Last-Modified") or ""
    except HTTPError as e:
        raise Refused(
            f"point at a URL this machine can read — {url} answered "
            f"{e.code} {e.reason}"
        )
    except (URLError, OSError, ValueError) as e:
        raise Refused(f"point at a URL this machine can reach — {url}: {e}")

    when = date.today().isoformat()
    if modified:
        try:
            when = datetime.strptime(
                modified[:25], "%a, %d %b %Y %H:%M:%S").date().isoformat()
        except ValueError:
            pass

    if kind == "application/pdf":
        raise Absent(
            f"download {url} first and point this at the file — a PDF is read "
            "through pypdf, from disk, and this command does not keep what it "
            "fetches"
        )
    text = raw.decode(charset, "replace")
    if kind in ("text/html", "application/xhtml+xml"):
        said, title = _html_text(text)
        return "html", said, title, when
    if kind == "text/csv":
        return "csv", _tidy("\n".join(
            " | ".join(c.strip() for c in row)
            for row in csv.reader(io.StringIO(text)))), "", when
    return "txt", _tidy(text), "", when


# ── the document it writes ───────────────────────────────────────────────────

def fragment(key, fields):
    """The one `<li>` the provenance block wants, on one line.

    THE SHAPE IS THE REGISTER'S AND NOT THIS FILE'S. `SOURCES_SPEC` names the
    item tag, the key and every field, so the fields are written in the order the
    register declares them -- and the day one is renamed, a fragment this wrote
    does not quietly stop parsing in the compiler next door.

    IT WRITES WHAT IT WAS GIVEN AND NEVER AN EMPTY FIELD. A field this command
    could not find is a field the author has to write, and a `<p class="when">`
    with nothing in it would be a blank the compiler refuses with a message about
    a slot rather than about a document nobody could read a date out of.
    """
    said = "".join(
        f'<{SLOT_TAG} class="{f.name}">'
        f"{html.escape(fields[f.name], quote=False)}</{SLOT_TAG}>"
        for f in SOURCES_SPEC.fields if fields.get(f.name)
    )
    item, attr = SOURCES_SPEC.item, SOURCES_SPEC.key
    return f'<{item} {attr}="{html.escape(key, quote=True)}">{said}</{item}>'


def document(key, fields, kind, text):
    """The Markdown this command hands back, fragment first and text under it."""
    words = len(text.split())
    where = fields[SOURCE_WHERE]
    lines = [
        f"# {key} · {where}",
        "",
        f"Cole o `<{SOURCES_SPEC.item}>` abaixo no bloco `<{SOURCES_TAG}>` do "
        f"cabeçalho do deck, e escreva `{key}` no slot `source` de todo slide que "
        "usar alguma coisa daqui.",
        "",
        "```html",
        fragment(key, fields),
        "```",
        "",
        f"**Reescreva o `{SOURCE_WHAT}` antes de colar.** Ele é um palpite — a "
        "primeira linha que este documento tinha cara de título —, e o que uma "
        "fonte É para um deck é julgamento de quem escreve o deck. O "
        f"`{SOURCE_WHEN}` veio do próprio arquivo; confira se é a data do DADO e "
        "não a do último salvamento.",
        "",
        f"**O `{SOURCE_EXCERPT}` não está aí, e só é obrigatório se alguma "
        "citação do deck sair desta fonte.** Nesse caso, copie do texto abaixo o "
        "trecho literal — a régua `quote-verbatim` confere a frase do slide "
        f"contra ele, palavra por palavra, e `{SOURCES_SPEC.elision}` marca o que "
        "você cortou.",
        "",
        "## O texto",
        "",
        f"`{kind}` · {words} palavra(s) · {len(text)} caractere(s)",
        "",
        text if text else "_(o documento não tem texto nenhum dentro dele)_",
        "",
    ]
    return "\n".join(lines)


# ── the command ──────────────────────────────────────────────────────────────

def refuse(fix):
    print(f"REFUSED · {fix}")
    return 1


def skip(why):
    """The named degradation, in the render gate's own shape."""
    print(f"── extract · SKIP — {why}")
    return SKIP


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="extract.py",
        description="Read a file or a URL into one source of a deck's "
                    "provenance block.",
    )
    # TWO OPTIONS, AND #238 ASKS FOR BOTH OF THEM. The id is what a slide cites
    # the source by, and `--out` is "a saída vai para onde o chamador mandar".
    # Nothing else: an earlier draft carried `--what`, `--when` and a ceiling on
    # the text, and all three were conveniences for editing a fragment the
    # document already tells its reader to edit. The command reads a document and
    # writes what it found; deciding what any of it MEANS is the caller's.
    ap.add_argument("where", help="the file or the URL to read")
    ap.add_argument("--id", default="F1",
                    help="the id the slides will cite this source by")
    ap.add_argument("--out", default=None,
                    help="write the Markdown here instead of to stdout")
    args = ap.parse_args(argv)

    if args.out:
        landing = os.path.abspath(args.out)
        if landing == ROOT or landing.startswith(ROOT + os.sep):
            return refuse(
                f"write the fragment outside the skill — {args.out} lands inside "
                f"{os.path.basename(ROOT)}/, and the tree that gets installed "
                "does not grow a file per run. /tmp, or anywhere in the project "
                "that asked for the deck"
            )

    where = args.where
    remote = "://" in where
    with tempfile.TemporaryDirectory(prefix="panlabs-extract-") as scratch:
        try:
            if remote:
                kind, text, title, when = _fetch(where, scratch)
            else:
                if not os.path.isfile(where):
                    return refuse(
                        f"point at a file this command can read — {where} is not "
                        "there, or is a directory"
                    )
                extension = os.path.splitext(where)[1].lower()
                if extension not in READERS:
                    return refuse(
                        f'read "{extension or os.path.basename(where)}" some '
                        f"other way — this command reads {KINDS}, and a video by "
                        "URL. Convert the file, or copy the passage you need by "
                        "hand"
                    )
                kind, reader = READERS[extension]
                text, title = reader(where)
                when = _when_of(where)
        except Refused as e:
            return refuse(str(e))
        except Absent as e:
            return skip(str(e))
        except (OSError, ValueError, subprocess.SubprocessError) as e:
            return refuse(
                f"point at something this command can read — {where}: "
                f"{type(e).__name__}: {e}"
            )

    # THE THREE FIELDS, IN THE SHAPE EVERY OTHER READER OF A SOURCE USES.
    # `compiler/source.py` hands a source around as {field name: words} and
    # `source_line` reads exactly that; passing the same map here rather than
    # four loose strings is what keeps the day a field is added from being a day
    # this file grows a fifth positional argument.
    fallback = where if remote else os.path.basename(where)
    fields = {
        SOURCE_WHAT: " ".join((title or _title_of(text, kind, fallback)).split()),
        SOURCE_WHERE: where,
        SOURCE_WHEN: when,
    }
    said = document(args.id, fields, kind, text)

    if not args.out:
        print(said)
        return 0
    parent = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(parent, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(said)
    print(f"   wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
