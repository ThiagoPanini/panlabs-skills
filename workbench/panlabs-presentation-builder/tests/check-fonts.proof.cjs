#!/usr/bin/env node
// THE MANIFEST AGAINST THE BYTES, PLANTED AND DEMANDED RED.
//
//     workbench/panlabs-presentation-builder/tests/check-fonts.proof.cjs
//
// `check-fonts.cjs` is what stops `themes/panlabs/fonts/faces.json` from
// describing a set of .woff2 files it no longer describes, and the whole
// value of it is that the manifest and the binaries can part company without
// anything else in the repository noticing. A check for that which has only
// ever been seen green is a check nobody has any reason to believe.
//
// EVERY CASE PLANTS INTO A COPY OF THE TREE. The check reads a `--root`, and
// each case builds a fresh temp root with the theme, the examples and the
// stage copied into it -- roughly 75 KB of font per case, which is the price
// of never writing into the tree being measured.
//
// THE RESERVED FONT NAME CASE PLANTS INSIDE A FONT FILE, and it is the reason
// `check-fonts.cjs` exports `split` and `repack`. That string is read from the
// binary's own `name` table and from nowhere else: planting it anywhere but
// there would prove that this proof can edit JSON. The edit is byte-for-byte
// the same length, so every table offset inside the font survives it and only
// the two lengths in the WOFF2 header move.
//
// AND ONE CASE DEMANDS GREEN, because a check can also be wrong by firing: a
// theme with no faces of its own is `base`, and it has to SKIP rather than
// fail for having no cmap to be held to.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { Drifted, Proof } = require('./proof_driver.cjs');
const { split, repack } = require('./check-fonts.cjs');

const HERE = __dirname;
const CHECK = path.join(HERE, 'check-fonts.cjs');
const SKILL = path.resolve(HERE, '..', '..', '..', 'skills', 'panlabs-presentation-builder');
const THEME = path.join(SKILL, 'themes', 'panlabs');
const MANIFEST = path.join(THEME, 'fonts', 'faces.json');
const EXAMPLE = 'few-words.deck.html';
const INTER = 'Inter-subset.woff2';

const REAL = fs.readFileSync(MANIFEST, 'utf8');

// ---------------------------------------------------------------------
// A copy of everything the check reads, under one temp root.

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function root(plant) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'panlabs-fonts-proof-'));
  copyDir(path.join(SKILL, 'themes'), path.join(dir, 'themes'));
  copyDir(path.join(SKILL, 'examples'), path.join(dir, 'examples'));
  fs.mkdirSync(path.join(dir, 'compiler'));
  fs.copyFileSync(path.join(SKILL, 'compiler', 'stage.html'),
                  path.join(dir, 'compiler', 'stage.html'));
  if (plant) plant(dir);
  return dir;
}

function run(dir) {
  try {
    const out = execFileSync(process.execPath, [CHECK, '--root', dir],
                             { encoding: 'utf8' });
    return [true, out.trim()];
  } catch (e) {
    return [false, `${e.stdout || ''}${e.stderr || ''}`.trim()];
  }
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------
// planting into the manifest

function manifest(edit) {
  return () => {
    const said = edit(REAL);
    if (said === REAL) throw new Drifted('the manifest no longer holds that text');
    return root((dir) => {
      fs.writeFileSync(path.join(dir, 'themes', 'panlabs', 'fonts', 'faces.json'), said);
    });
  };
}

function swap(needle, replacement) {
  return (text) => {
    if (!text.includes(needle)) throw new Drifted(`the fixture no longer contains ${needle}`);
    return text.replace(needle, replacement);
  };
}

// ---------------------------------------------------------------------

async function main() {
  const control = () => {
    const dir = root(null);
    try {
      return run(dir);
    } finally {
      rmrf(dir);
    }
  };

  const proof = new Proof({
    title: 'the manifest against the bytes beside it',
    label: (key) => key,
    invoke: (key, dir) => {
      try {
        return run(dir);
      } finally {
        rmrf(dir);
      }
    },
    // Every plant returns a temp root; a root that came back identical to the
    // real tree would be a case that planted nothing, and each `plant` above
    // throws `Drifted` rather than returning one.
    planted: (dir) => typeof dir === 'string' && dir.length > 0,
    control,
    width: 24,
  });

  let failed = await proof.run([
    [
      'family renamed',
      'a manifest calling a face something its name table does not',
      manifest(swap('"family": "Inter Variable"', '"family": "Inter"')),
      'set the family of Inter-subset.woff2 in faces.json to "Inter Variable"',
    ],
    [
      'repertoire too wide',
      'a character promised that neither face carries',
      manifest(swap('\u2212"', '\u2212\u2192"')),
      'cut "\u2192" (U+2192) out of the repertoire',
    ],
    [
      'repertoire too narrow',
      'a character both faces carry, missing from the promise',
      manifest(swap('\u00bc\u00bd\u00be', '\u00bc\u00be')),
      'add "\u00bd" (U+00BD) to the repertoire',
    ],
    [
      'a face gone',
      'a manifest naming bytes that are not there',
      () => root((dir) => {
        fs.unlinkSync(path.join(dir, 'themes', 'panlabs', 'fonts', INTER));
      }),
      `put ${INTER} back`,
    ],
    [
      'a face unreadable',
      'a .woff2 that is not one',
      () => root((dir) => {
        fs.writeFileSync(path.join(dir, 'themes', 'panlabs', 'fonts', INTER),
                         Buffer.from('this is not a font at all', 'utf8'));
      }),
      `re-cut ${INTER} as a WOFF2`,
    ],
    [
      'a corpus tofu',
      'an example printing a character the faces do not carry',
      () => root((dir) => {
        const file = path.join(dir, 'examples', EXAMPLE);
        const said = fs.readFileSync(file, 'utf8');
        if (!said.includes('corte o resto')) throw new Drifted('the example moved on');
        fs.writeFileSync(file, said.replace('corte o resto', 'corte o resto \u2713'));
      }),
      'rewrite "\u2713" (U+2713) out of examples/',
    ],
    [
      'stage exceptions gone',
      'the key caps the stage prints, with nothing saying who carries them',
      manifest(swap('"stageOnly": "\\u200a\u2190\u2192\u232b"', '"stageOnly": ""')),
      // The fix names all four in code-point order, so the arrow is asserted
      // by its code point rather than by the phrase that precedes it.
      '(U+2190)',
    ],
    // THE ONE EXCEPTION THAT IS A SPACE, and the reason `charsOf` drops only
    // the five whitespace characters HTML treats as layout. `\s` in JavaScript
    // matches U+200A too, and while it did, this entry of `stageOnly` could
    // neither be charged nor reported as idle: the README documented a
    // guarantee no code was making.
    [
      'a hair space exception',
      'the space between the page number and the total, unlisted',
      manifest(swap('"stageOnly": "\\u200a', '"stageOnly": "')),
      '(U+200A)',
    ],
    [
      'an idle exception',
      'a character listed as an exception that the repertoire already covers',
      manifest(swap('"stageOnly": "\\u200a\u2190', '"stageOnly": "\\u200aA\u2190')),
      'take "A" (U+0041) out of the stageOnly',
    ],
    [
      'a reserved font name',
      'a face whose own name table reserves its name',
      () => root((dir) => {
        const file = path.join(dir, 'themes', 'panlabs', 'fonts', INTER);
        const buf = fs.readFileSync(file);
        const { stream } = split(buf);
        // Equal length, so no offset inside the font moves: 25 characters of
        // copyright for 25 of reservation, in UTF-16BE as the record stores it.
        const from = Buffer.from('The Inter Project Authors', 'utf16le').swap16();
        const to = Buffer.from('with Reserved Font Name x', 'utf16le').swap16();
        const at = stream.indexOf(from);
        if (at === -1) throw new Drifted('the copyright record no longer reads that way');
        const planted = Buffer.from(stream);
        to.copy(planted, at);
        fs.writeFileSync(file, repack(buf, planted));
      }),
      `rename ${INTER}`,
    ],
  ]);

  console.log();
  console.log('and the one that demands green:  [planted green]');
  failed += theUnfacedThemeSkips();
  return failed;
}

// `base` ships no faces, and holding it to a repertoire would be inventing a
// promise it never made -- it paints with `system-ui` and what that covers is
// a fact about the machine.
function theUnfacedThemeSkips() {
  const dir = root(null);
  let ok = false;
  let said = '';
  try {
    [ok, said] = run(dir);
  } finally {
    rmrf(dir);
  }
  const named = /base · SKIP/.test(said);
  const good = ok && named;
  const marks = `[${ok ? '+' : '-'}${named ? '+' : '-'}]`;
  console.log(`  ${good ? 'ok  ' : 'FAIL'} ${'a theme with no faces'.padEnd(24)} ${marks} `
    + 'base is skipped by name instead of held to a repertoire');
  if (!good) console.log(`       <- ${said || 'said nothing at all'}`);
  return good ? 0 : 1;
}

main().then((failed) => process.exit(failed ? 1 : 0));
