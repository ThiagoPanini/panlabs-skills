#!/usr/bin/env node
'use strict';
/**
 * M2 — what fingerprint granularity is good enough to detect human edits?
 *
 *   node tests/check-fingerprint.cjs [drawio-binary]
 *
 * The reflex is to keep a hash of the file. The measurement exists to show
 * that it does not work, for two distinct reasons:
 *
 *   1. it flags an UNTOUCHED file — opening and saving in draw.io itself
 *      rewrites the XML, and no human edited anything;
 *   2. it does not distinguish dragging a box (the model is still valid) from
 *      deleting a service (the model became a lie). These are opposite answers.
 *
 * Ten edits a human really makes, three fingerprint schemes, and the expected
 * classification of each. The third scheme is the adopted one — and the
 * difference between it and the second is ONE case, which is the control
 * experiment: repainting a private subnet with the public one's hex. They
 * have the same `shape` and the same `grIcon` (measured in #17's catalog);
 * the boundary that rubric (#8)'s A4.2 check protects lives only in the color.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const { readPages, semanticFingerprint, appearanceFingerprint } = require('../../../skills/panlabs-aws-diagrams/session/fingerprint.cjs');
const { approve } = require('../../../skills/panlabs-aws-diagrams/session/agreement.cjs');
const { elaborate } = require('../../../skills/panlabs-aws-diagrams/session/elaborate.cjs');
const { draw } = require('../../../skills/panlabs-aws-diagrams/session/draw.cjs');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const { binary } = require(path.join(ROOT, 'tools', 'drawio.cjs'));
const DRAWIO = binary(process.argv[2]);

// ------------------------------------------------------------------ the edits

/**
 * Swaps inside the FIRST cell with this id. Here the base is a single page, so
 * first and only are the same — the name still says "first" because there is
 * a sibling of this helper in `demo-divergence.cjs` that matches the LAST
 * one, and two helpers with the same name and opposite semantics is the
 * cheapest way to plant a bug.
 */
function inFirstCell(xml, id, fn) {
  const re = new RegExp(`(<mxCell id="${id}"[\\s\\S]*?</mxCell>)`);
  const m = re.exec(xml);
  if (!m) throw new Error(`cell "${id}" not found`);
  return xml.replace(re, fn(m[1]));
}

const EDITS = [
  { name: 'save without editing anything', expected: 'intact', app: true,
    because: "the app's own codec rewrites the file; nobody edited it" },

  { name: 'drag a box', expected: 'moved',
    // Anchoring on `<mxGeometry x=` is mandatory: a loose `/x="(\d+)"/` matches
    // inside `vertex="1"` and the edit turns into something else. It cost a
    // round trip.
    apply: x => inFirstCell(x, 'processar-na-chegada',
      c => c.replace(/<mxGeometry x="(-?\d+)"/, (_, v) => `<mxGeometry x="${+v + 40}"`)) },

  { name: "change a label's font", expected: 'moved',
    apply: x => inFirstCell(x, 'title', c => c.replace('fontSize=19', 'fontSize=15')) },

  { name: 'collapse a container', expected: 'moved',
    apply: x => inFirstCell(x, 'vpc-dados', c => c.replace('<mxCell id="vpc-dados"', '<mxCell id="vpc-dados" collapsed="1"')) },

  { name: 'reorder cells (z-order)', expected: 'moved',
    apply: x => {
      const re = /( *<mxCell id="tratar-falha"[\s\S]*?<\/mxCell>\n)/;
      const block = re.exec(x)[1];
      return x.replace(re, '').replace(/( *<mxCell id="loja")/, block + '$1');
    } },

  { name: 'repaint a private subnet as public', expected: 'divergent', control: true,
    apply: x => inFirstCell(x, 'sub-app', c => c.replace('#00A4A6', '#7AA116').replace('#E6F6F7', '#F2F6E8')),
    because: 'same shape, same grIcon — the public/private boundary only exists in the hex' },

  // The rename lands on the leaf's ITALIC line, which is where the shipped
  // example says what this bucket is called (#123). Before that ticket the
  // whole thing was glued into one string — `value="S3 · zona curada"` — and
  // the rename had to rewrite the name and the description together.
  { name: 'rename a service', expected: 'divergent',
    apply: x => inFirstCell(x, 'reter-objeto', c =>
      c.replace('&lt;i&gt;retail-lake-curado&lt;/i&gt;', '&lt;i&gt;retail-lake-arquivado&lt;/i&gt;')) },

  { name: 'delete a node', expected: 'divergent',
    apply: x => x.replace(/ *<mxCell id="papel-leitura"[\s\S]*?<\/mxCell>\n/, '') },

  { name: 'add a node', expected: 'divergent',
    apply: x => x.replace('      </root>',
      '        <mxCell id="caixa-do-humano" value="Firewall" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">\n' +
      '          <mxGeometry x="10" y="10" width="80" height="40" as="geometry"/>\n' +
      '        </mxCell>\n      </root>') },

  { name: "change a service's icon", expected: 'divergent',
    apply: x => inFirstCell(x, 'processar-na-chegada', c => c.replace(/resIcon=mxgraph\.aws4\.\w+/, 'resIcon=mxgraph.aws4.ec2')) },
];

// ---------------------------------------------------------------- the schemas

const fileSha = s => 'sha256:' + crypto.createHash('sha256').update(s, 'utf8').digest('hex');

const SCHEMAS = [
  {
    name: 'hash of the whole file',
    sealInto: xml => ({ file: fileSha(xml) }),
    read: (xml, seal) => fileSha(xml) === seal.file ? 'intact' : 'divergent',
  },
  {
    name: 'semantics WITHOUT color + appearance',
    sealInto: xml => { const c = readPages(xml).pages[0].cells;
      return { s: semanticFingerprint(c, { withColor: false }), a: appearanceFingerprint(c) }; },
    read: (xml, seal) => { const c = readPages(xml).pages[0].cells;
      if (semanticFingerprint(c, { withColor: false }) !== seal.s) return 'divergent';
      return appearanceFingerprint(c) === seal.a ? 'intact' : 'moved'; },
  },
  {
    name: 'semantics WITH color + appearance  ← adopted',
    sealInto: xml => { const c = readPages(xml).pages[0].cells;
      return { s: semanticFingerprint(c), a: appearanceFingerprint(c) }; },
    read: (xml, seal) => { const c = readPages(xml).pages[0].cells;
      if (semanticFingerprint(c) !== seal.s) return 'divergent';
      return appearanceFingerprint(c) === seal.a ? 'intact' : 'moved'; },
  },
];

// ------------------------------------------------------------- measurement

async function main() {
  const logical = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'session', 'retail-logical.json'), 'utf8'));
  const elab = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'session', 'retail-elaboration.json'), 'utf8'));
  const technical = elaborate(approve(logical, { at: '2026-08-21' }), elab);
  const base = (await draw(technical, 'technical')).xml;

  const hasApp = fs.existsSync(DRAWIO);
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fingerprint-'));

  const seals = SCHEMAS.map(e => e.sealInto(base));
  const rows = [];
  let codecBytes = null;

  for (const edit of EDITS) {
    let after;
    if (edit.app) {
      if (!hasApp) { rows.push({ edit, skipped: true }); continue; }
      const inPath = path.join(TMP, 'e.drawio'), outPath = path.join(TMP, 's.drawio');
      fs.writeFileSync(inPath, base);
      execFileSync('xvfb-run', ['-a', DRAWIO, '-x', '-f', 'xml', '--no-sandbox', '--disable-gpu', '-o', outPath, inPath],
        { stdio: ['ignore', 'ignore', 'ignore'] });
      after = fs.readFileSync(outPath, 'utf8');
      codecBytes = { before: base.length, after: after.length, equal: base === after };
    } else {
      after = edit.apply(base);
      if (after === base) throw new Error(`the "${edit.name}" edit changed nothing — the test would be empty`);
    }
    rows.push({ edit, verdicts: SCHEMAS.map((e, i) => e.read(after, seals[i])) });
  }

  // ------------------------------------------------------------------ report
  console.log('\n  Ten human edits against three fingerprint schemas\n');
  const colWidth = 34;
  console.log('    ' + 'edit'.padEnd(colWidth) + 'expected'.padEnd(13) +
    SCHEMAS.map((e, i) => `[${i + 1}]`.padEnd(6)).join(''));
  console.log('    ' + '─'.repeat(colWidth + 13 + 6 * SCHEMAS.length));

  const misses = SCHEMAS.map(() => 0);
  for (const row of rows) {
    if (row.skipped) { console.log(`    ${row.edit.name.padEnd(colWidth)}${'(needs the app — skipped)'}`); continue; }
    const marks = row.verdicts.map((v, i) => {
      const ok = v === row.edit.expected;
      if (!ok) misses[i]++;
      return (ok ? '✓' : '✗').padEnd(6);
    });
    console.log(`    ${row.edit.name.padEnd(colWidth)}${row.edit.expected.padEnd(13)}${marks.join('')}`);
    for (const [i, v] of row.verdicts.entries())
      if (v !== row.edit.expected) console.log(`      └ [${i + 1}] said "${v}"${row.edit.because ? ' — ' + row.edit.because : ''}`);
  }

  console.log('');
  for (const [i, e] of SCHEMAS.entries()) {
    const total = rows.filter(row => !row.skipped).length;
    console.log(`    [${i + 1}] ${e.name.padEnd(38)} ${total - misses[i]}/${total} correct`);
  }

  if (codecBytes)
    console.log(`\n    Open and save without editing: ${codecBytes.before} → ${codecBytes.after} bytes, ` +
      `file ${codecBytes.equal ? 'IDENTICAL' : 'DIFFERENT'}. ` +
      (codecBytes.equal ? '' : 'File hash flags divergence on a file nobody edited.'));

  fs.rmSync(TMP, { recursive: true, force: true });
  const adopted = misses[SCHEMAS.length - 1];
  console.log(adopted === 0
    ? '\n  ✓ the adopted scheme classifies every measured edit.\n'
    : `\n  ✗ the adopted scheme got ${adopted} wrong.\n`);
  return adopted === 0 ? 0 : 1;
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
