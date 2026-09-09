#!/usr/bin/env node
// THE FACES A THEME SHIPS, READ OUT OF THE BYTES AND NOT OUT OF A README.
//
//     workbench/panlabs-presentation-builder/tests/check-fonts.cjs
//
// `themes/<theme>/fonts/faces.json` publishes a REPERTOIRE, and
// `compiler/audit.py`'s `theme-repertoire` ruler refuses a deck that prints a
// character outside it. That is a contract with two ends: the manifest says
// what the faces carry, the .woff2 files actually carry something, and if the
// two ever part company the ruler goes on being green about the wrong list.
// #91 measured exactly this failure in the v1 -- a subsetter drops in silence
// whatever the source face did not have, so "asked for" and "shipped" are
// different sets -- and the fix it named was a machine check, which is this.
//
// WHY NODE AND NOT PYTHON. A .woff2 is a Brotli stream, and Python's standard
// library has no Brotli; the compiler is `python3` and nothing else on
// purpose. Node has `zlib.brotliDecompressSync` built in, and the render gate
// already makes Node a dependency of this suite. Nothing is installed.
//
// WHAT IT MEASURES, IN THE ORDER IT MEASURES IT:
//
//   family        every face's `family` in the manifest is the name its own
//                 `name` ID 1 carries -- the string Chromium answers with, and
//                 therefore the string the render gate's `platform-font` ruler
//                 compares the theme's token against.
//   reserved      no face declares a Reserved Font Name. The OFL restricts the
//                 primary font name of a MODIFIED version, and a subset is a
//                 modification (OFL-FAQ 2.6); these faces keep the names their
//                 upstreams gave them, which is only allowed while no RFN is
//                 declared. Re-read from the binary every run, because a font
//                 file swapped for a differently-licensed one is the only way
//                 that sentence stops being true without anybody noticing.
//   repertoire    the manifest's repertoire is EXACTLY the intersection of the
//                 faces' cmaps. Not a subset of it -- a manifest that promised
//                 less than shipped would refuse decks for no reason -- and
//                 not a superset, which is the silent-tofu case.
//   corpus        every character every source under `examples/` prints is
//                 inside that repertoire.
//   stage         every character `compiler/stage.html` prints is inside the
//                 repertoire or named in `stageOnly`, and nothing is named
//                 there that the repertoire already covers. The stage's own
//                 furniture is not a deck and no ruler charges it; the reason
//                 each of those characters is safe is one line each in
//                 `themes/panlabs/fonts/README.md`, and a new one shows up
//                 here as a red until somebody writes its line.
//
// A THEME WITH NO `fonts/` DIRECTORY IS SKIPPED, NOT FAILED. `base` paints
// with the machine's own faces and has no cmap of its own to be held to.

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const HERE = __dirname;
const SKILL = path.resolve(HERE, '..', '..', '..', 'skills', 'panlabs-presentation-builder');

// EVERYTHING IS READ UNDER ONE ROOT, and `--root` moves it. The proof beside
// this file plants into a COPY of the tree -- a manifest that lies, a face
// with an RFN in it, an example with a character nothing carries -- and a
// check that could only ever read the real tree would be a check whose reds
// nobody has seen.
function paths(root) {
  return {
    themes: path.join(root, 'themes'),
    examples: path.join(root, 'examples'),
    stage: path.join(root, 'compiler', 'stage.html'),
  };
}

// ---------------------------------------------------------------------
// WOFF2, far enough in to read two tables.
//
// The container is a header, a table directory, and ONE Brotli stream holding
// every table concatenated in directory order with no padding. Only `cmap`
// and `name` are wanted here and neither is ever transformed, so the
// transforms themselves do not have to be undone -- but their LENGTHS do,
// because that is what says where the next table starts.

// The 63 tags the format spells as a 6-bit index, in the order the spec lists
// them. Index 63 means an arbitrary 4-byte tag follows instead.
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
  'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern',
  'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
  'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
];

function readBase128(buf, at) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[at + i];
    value = (value << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) return { value: value >>> 0, at: at + i + 1 };
  }
  throw new Error('a UIntBase128 longer than five bytes');
}

function split(buf) {
  if (buf.toString('ascii', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  const numTables = buf.readUInt16BE(12);
  let at = 48;
  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[at];
    at += 1;
    let tag;
    if ((flags & 0x3f) === 0x3f) {
      tag = buf.toString('ascii', at, at + 4);
      at += 4;
    } else {
      tag = KNOWN_TAGS[flags & 0x3f];
    }
    const version = (flags >> 6) & 0x03;
    let read = readBase128(buf, at);
    const origLength = read.value;
    at = read.at;
    // The null transform is version 3 for glyf/loca and version 0 for every
    // other table; anything else means a transformLength follows.
    const nullTransform = (tag === 'glyf' || tag === 'loca') ? version === 3 : version === 0;
    let length = origLength;
    if (!nullTransform) {
      read = readBase128(buf, at);
      length = read.value;
      at = read.at;
    }
    entries.push({ tag, origLength, length });
  }
  return { at, entries, stream: zlib.brotliDecompressSync(buf.subarray(at)) };
}

function woff2Tables(buf) {
  const { entries, stream } = split(buf);
  const out = {};
  let offset = 0;
  for (const e of entries) {
    out[e.tag] = stream.subarray(offset, offset + e.origLength);
    offset += e.length;
  }
  return out;
}

// The other direction, for the proof and for nothing else: a WOFF2 whose
// decompressed stream has been edited IN PLACE, byte for byte, so that no
// table offset moves and only the two lengths in the header change. A proof
// that plants a Reserved Font Name has to plant it in a real font file --
// there is no other place that string is read from.
function repack(buf, stream) {
  const { at } = split(buf);
  const compressed = zlib.brotliCompressSync(stream);
  const out = Buffer.concat([Buffer.from(buf.subarray(0, at)), compressed]);
  out.writeUInt32BE(out.length, 8);
  out.writeUInt32BE(compressed.length, 20);
  return out;
}

// ---------------------------------------------------------------------
// cmap: every code point that maps to a glyph that is not .notdef.

function codepoints(cmap) {
  const n = cmap.readUInt16BE(2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const at = 4 + i * 8;
    const platform = cmap.readUInt16BE(at);
    const encoding = cmap.readUInt16BE(at + 2);
    const offset = cmap.readUInt32BE(at + 4);
    const unicode = platform === 0
      || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    const format = cmap.readUInt16BE(offset);
    if (format !== 4 && format !== 12) continue;
    // Format 12 wins when both are present: it is the one that can carry
    // anything above the basic plane.
    if (!best || format > best.format) best = { format, offset };
  }
  if (!best) throw new Error('no Unicode cmap subtable this reader understands');
  return best.format === 4 ? format4(cmap, best.offset) : format12(cmap, best.offset);
}

function format4(cmap, at) {
  const segX2 = cmap.readUInt16BE(at + 6);
  const segs = segX2 / 2;
  const endAt = at + 14;
  const startAt = endAt + segX2 + 2;
  const deltaAt = startAt + segX2;
  const rangeAt = deltaAt + segX2;
  const out = new Set();
  for (let s = 0; s < segs; s++) {
    const end = cmap.readUInt16BE(endAt + s * 2);
    const start = cmap.readUInt16BE(startAt + s * 2);
    const delta = cmap.readInt16BE(deltaAt + s * 2);
    const range = cmap.readUInt16BE(rangeAt + s * 2);
    if (start === 0xffff) continue;
    for (let c = start; c <= end; c++) {
      let glyph;
      if (range === 0) {
        glyph = (c + delta) & 0xffff;
      } else {
        const gi = rangeAt + s * 2 + range + (c - start) * 2;
        if (gi + 1 >= cmap.length) continue;
        glyph = cmap.readUInt16BE(gi);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) out.add(c);
    }
  }
  return out;
}

function format12(cmap, at) {
  const groups = cmap.readUInt32BE(at + 12);
  const out = new Set();
  for (let g = 0; g < groups; g++) {
    const gi = at + 16 + g * 12;
    const start = cmap.readUInt32BE(gi);
    const end = cmap.readUInt32BE(gi + 4);
    const glyph = cmap.readUInt32BE(gi + 8);
    if (glyph === 0 && start === 0) continue;
    for (let c = start; c <= end; c++) out.add(c);
  }
  return out;
}

// ---------------------------------------------------------------------
// name: the records this check reads, decoded.

function names(name) {
  const count = name.readUInt16BE(2);
  const strings = name.readUInt16BE(4);
  const out = {};
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12;
    const platform = name.readUInt16BE(at);
    const nameID = name.readUInt16BE(at + 6);
    const length = name.readUInt16BE(at + 8);
    const offset = name.readUInt16BE(at + 10);
    const bytes = name.subarray(strings + offset, strings + offset + length);
    // Windows and Unicode records are UTF-16BE; Node decodes UTF-16LE, so the
    // bytes are swapped first. Macintosh Roman is close enough to latin1 for
    // the four fields this check reads, all of which are ASCII in practice.
    const said = (platform === 1 || bytes.length % 2)
      ? bytes.toString('latin1')
      : Buffer.from(bytes).swap16().toString('utf16le');
    if (out[nameID] === undefined) out[nameID] = said;
  }
  return out;
}

// ---------------------------------------------------------------------
// what the tree prints

function textOf(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  return unescapeEntities(s);
}

function unescapeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// The stage prints two kinds of string: what stands in its markup, and what
// its own script writes into the page -- the help panel's key names and what
// each key does. A quoted literal in that script is the only place the second
// kind exists, so every one of them counts, comments stripped first so that
// the prose ABOUT the panel is not mistaken for the panel.
function stageText(html) {
  const withoutStyle = html.replace(/<style>[\s\S]*?<\/style>/g, ' ');
  const scripts = [...withoutStyle.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const markup = textOf(withoutStyle.replace(/<script>[\s\S]*?<\/script>/g, ' '));
  const literals = [];
  for (const raw of scripts) {
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) literals.push(m[1]);
    for (const m of code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) literals.push(m[1]);
  }
  return markup + literals.join(' ');
}

function charsOf(text) {
  const out = new Set();
  for (const ch of text) if (!/\s/.test(ch) || ch === ' ') out.add(ch);
  return out;
}

function spell(chars) {
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
    .map((c) => `"${c}" (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`)
    .join(', ');
}

// ---------------------------------------------------------------------

function measure(theme, where) {
  const { themes: THEMES, examples: EXAMPLES, stage: STAGE } = where;
  const dir = path.join(THEMES, theme, 'fonts');
  const manifestPath = path.join(dir, 'faces.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const fixes = [];
  const cmaps = [];

  for (const face of manifest.faces) {
    const file = path.join(dir, face.file);
    if (!fs.existsSync(file)) {
      fixes.push(
        `put ${face.file} back in themes/${theme}/fonts/, or take its entry out of `
        + 'faces.json — the manifest declares a face whose bytes are not there'
      );
      continue;
    }
    let tables;
    try {
      tables = woff2Tables(fs.readFileSync(file));
    } catch (e) {
      fixes.push(
        `re-cut ${face.file} as a WOFF2 — this reader could not open it (${e.message}), `
        + 'and a face nothing can read is a face nothing can be held to'
      );
      continue;
    }
    const record = names(tables.name);
    if (record[1] !== face.family) {
      fixes.push(
        `set the family of ${face.file} in faces.json to "${record[1]}" — that is what `
        + `its own name ID 1 says, and it is the string Chromium answers with; the `
        + `manifest calls it "${face.family}", so themes/${theme}/tokens.css names a `
        + 'face the render gate can never match'
      );
    }
    const declared = [0, 7, 13].map((id) => record[id] || '').join(' ');
    if (/reserved font name/i.test(declared)) {
      fixes.push(
        `rename ${face.file} and say so in themes/${theme}/fonts/OFL.txt — its own name `
        + 'table declares a Reserved Font Name, and OFL 1.1 § 3 forbids a modified '
        + 'version from keeping it (a subset is a modification, OFL-FAQ 2.6)'
      );
    }
    cmaps.push(codepoints(tables.cmap));
  }

  // ONLY WHEN EVERY FACE WAS READ. With one of them missing the intersection
  // is the other one's whole cmap, and the advice that falls out of it --
  // "widen the repertoire" -- is advice it would be wrong to follow. A face
  // that is not there is one fix, not four.
  if (cmaps.length && cmaps.length === manifest.faces.length) {
    let both = cmaps[0];
    for (const c of cmaps.slice(1)) both = new Set([...both].filter((x) => c.has(x)));
    const said = new Set([...manifest.repertoire]);
    const shipped = new Set([...both].map((c) => String.fromCodePoint(c)));
    const promisedNotShipped = new Set([...said].filter((c) => !shipped.has(c)));
    const shippedNotPromised = new Set([...shipped].filter((c) => !said.has(c)));
    if (promisedNotShipped.size) {
      fixes.push(
        `cut ${spell(promisedNotShipped)} out of the repertoire in faces.json, or re-cut `
        + 'the faces to carry them — every face has to have a character before the '
        + 'audit lets a deck print it'
      );
    }
    if (shippedNotPromised.size) {
      fixes.push(
        `add ${spell(shippedNotPromised)} to the repertoire in faces.json — every face `
        + 'ships them, and the audit is refusing decks that could paint them'
      );
    }

    const covered = new Set([...said, ...(manifest.stageOnly || '')]);
    const deck = new Set();
    for (const file of fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.deck.html'))) {
      for (const c of charsOf(textOf(fs.readFileSync(path.join(EXAMPLES, file), 'utf8')))) {
        if (!said.has(c)) deck.add(c);
      }
    }
    if (deck.size) {
      fixes.push(
        `rewrite ${spell(deck)} out of examples/, or re-cut the faces to carry them — `
        + `the corpus prints characters the "${theme}" faces do not have, and every one `
        + 'of them paints in whatever face the machine falls back to'
      );
    }

    const stage = new Set();
    for (const c of charsOf(stageText(fs.readFileSync(STAGE, 'utf8')))) {
      if (!covered.has(c)) stage.add(c);
    }
    if (stage.size) {
      fixes.push(
        `name ${spell(stage)} in the stageOnly of faces.json and say in `
        + `themes/${theme}/fonts/README.md which face prints them — compiler/stage.html `
        + 'prints them as its own furniture, and the repertoire does not cover them'
      );
    }
    const idle = new Set([...(manifest.stageOnly || '')].filter((c) => said.has(c)));
    if (idle.size) {
      fixes.push(
        `take ${spell(idle)} out of the stageOnly of faces.json — the repertoire already `
        + 'covers them, and a list of exceptions with a non-exception in it is a list '
        + 'nobody can read'
      );
    }
  }

  return { fixes, faces: manifest.faces.length, repertoire: manifest.repertoire.length };
}

function main(argv) {
  const flag = argv.indexOf('--root');
  const where = paths(flag === -1 ? SKILL : path.resolve(argv[flag + 1]));
  const THEMES = where.themes;
  const themes = fs.readdirSync(THEMES)
    .filter((d) => fs.statSync(path.join(THEMES, d)).isDirectory())
    .sort();
  let reds = 0;
  let measured = 0;
  for (const theme of themes) {
    const result = measure(theme, where);
    if (!result) {
      console.log(`── fonts · ${theme} · SKIP — this theme ships no faces of its own`);
      continue;
    }
    measured += 1;
    console.log(`── fonts · ${theme} · ${result.faces} faces · ${result.repertoire} characters`);
    const ok = result.fixes.length === 0;
    if (!ok) reds += 1;
    console.log(`   ${ok ? '✓' : '✗'} theme-faces · the manifest describes the bytes beside it, `
      + 'and the corpus fits inside them');
    for (const fix of result.fixes) console.log(`       | ${fix}`);
  }
  if (!measured) {
    console.log('   no theme ships faces — nothing was measured');
  }
  return reds === 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)) ? 0 : 1);
}

module.exports = { split, repack, woff2Tables };
