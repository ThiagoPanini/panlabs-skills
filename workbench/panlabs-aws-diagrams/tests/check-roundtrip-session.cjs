#!/usr/bin/env node
'use strict';
/**
 * Does the TWO-page file survive draw.io's own codec?
 *
 *   node tools/check-roundtrip.cjs [drawio-binary]
 *
 * #11 had already closed #2's uncertainty 7(a) for a single-page file. Here
 * there are three new things that test doesn't reach, and all three are this
 * ticket's own decision:
 *
 *   1. the seal survives on BOTH pages, not just the first;
 *   2. the two copies of the model keep agreeing after the round-trip;
 *   3. — the one that matters most — after the app rewrites the file, it
 *      still reads as INTACT. If the app's re-serialization touched anything
 *      the fingerprint looks at, every user who opened and saved the file
 *      would get a false alarm on the next session. An alarm that fires for
 *      no reason is an alarm the user learns to ignore.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { open } = require('../../../skills/panlabs-aws-diagrams/session/open.cjs');
const { canonicalize } = require('../../../skills/panlabs-aws-diagrams/session/fingerprint.cjs');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const { callRender, indent } = require(path.join(WORKBENCH, 'tools', 'call-render.cjs'));
// The render corpus is scratch (#45) — the ruler exports OUTPUT_DIR once and
// every check that reads a generated `.drawio` reads it from there.
const FILE = path.join(process.env.OUTPUT_DIR || os.tmpdir(), 'retail.drawio');
const { binary } = require(path.join(ROOT, 'tools', 'drawio.cjs'));
const DRAWIO = binary(process.argv[2]);

if (!fs.existsSync(FILE)) { console.error('  run tools/approve.cjs and tools/resume.cjs first.'); process.exit(1); }

const before = open(fs.readFileSync(FILE, 'utf8'));
let failures = 0;
const report = (label, ok, extra = '') => {
  console.log(`    ${label.padEnd(52)} ${ok ? '✓' : '✗'} ${extra}`);
  if (!ok) failures++;
};

console.log('\n  Static (runs on any machine)\n');
report('recognized as ours', before.ours, before.howIRecognized.join(' · '));
report('both pages carry a seal', before.pages.every(p => p.seal && p.seal.panlabsSchema), `${before.pages.length} page(s)`);
report('the model copies agree', !before.copyConflict);
report('all pages intact', before.pages.every(p => p.state === 'intact'),
  before.pages.map(p => `${p.view}=${p.state}`).join(' '));
report('the dossier traveled whole', !!(before.session.dossier && before.session.dossier.agreement && before.session.dossier.candidates),
  `${(before.session.dossier.candidates || []).length} candidate(s), ${(before.session.dossier.findings || []).length} finding(s)`);

if (!fs.existsSync(DRAWIO)) {
  console.log(`\n  draw.io headless missing at ${DRAWIO} — the app layer is left out (premise 8).`);
  process.exit(failures ? 1 : 0);
}

console.log("\n  Through the app's own codec (-x -f xml)\n");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'session-rt-'));
const output = path.join(TMP, 'back.drawio');

/**
 * #19 found that invalid XML makes draw.io RENDER truncated with exit code 0.
 * Here its sibling showed up, and it cost a red run to understand: under
 * memory pressure the app **exports XML with pages missing** and also exits
 * with 0. Measured on this machine — the same two-page file came back with 2
 * pages on one run (69,149 bytes) and with 1 on the next (25,588), with no
 * error on either.
 *
 * The lesson applies to the real engine too, not just to this test:
 * **whoever calls the app has to check what came back**, because the exit
 * code doesn't count. That's why the attempt is retried before flagging a
 * design failure — otherwise a loaded machine produces a red run that isn't
 * about the code.
 *
 * #144: the export itself used to dial `xvfb-run` with no timeout at all — a
 * hang here froze the whole suite, the exact failure `render.sh` exists to
 * prevent (#128). It goes through `render.sh` now, which bounds the wait and
 * retries only a non-answer; the loop below is a different question — draw.io
 * DID answer, just with the wrong page count — and stays as it was.
 */
let raw = null;
for (let attempt = 1; attempt <= 2 && raw === null; attempt++) {
  const exported = callRender(FILE, output, 'xml', DRAWIO);
  if (!exported.ok) {
    console.log(`    the app failed to export (render.sh exit ${exported.code}) — on this machine electron dies under memory pressure.`);
    console.log(indent(exported.log));
    fs.rmSync(TMP, { recursive: true, force: true });
    process.exit(failures ? 1 : 0);
  }
  if (exported.flaked) console.log(indent(exported.out));
  const readBack = fs.readFileSync(output, 'utf8');
  const pages = (readBack.match(/<diagram\b/g) || []).length;
  if (pages === before.pages.length) { raw = readBack; break; }
  console.log(`    ⚠ attempt ${attempt}: the app returned ${pages} of ${before.pages.length} page(s), ` +
    `${readBack.length} bytes, and exited with code 0. Truncated silently.`);
  if (attempt === 2) raw = readBack;
}

const after = open(raw);
report('still recognized', after.ours, `host=${JSON.stringify(after.host)}`);
report('both pages came back', after.pages.length === before.pages.length,
  `${before.pages.length} → ${after.pages.length}`);
report('the seal survived on both', after.pages.every(p => p.seal && p.seal.panlabsSchema));
report('the session model came back identical', canonicalize(after.session) === canonicalize(before.session));
report('the opaque dossier came back identical',
  canonicalize(after.session && after.session.dossier) === canonicalize(before.session.dossier));
report('STILL READS AS INTACT after the app rewrites it',
  after.pages.every(p => p.state === 'intact'),
  after.pages.map(p => `${p.view}=${p.state}`).join(' '));
console.log(`\n    bytes: ${fs.statSync(FILE).size} → ${raw.length}` +
  `  (the app ${raw.length === fs.statSync(FILE).size ? "didn't change the size" : 'rewrote the file'})`);

fs.rmSync(TMP, { recursive: true, force: true });
console.log(failures ? `\n  ✗ ${failures} failure(s)\n` : "\n  ✓ the two-page .drawio is its own persistence format.\n");
process.exit(failures ? 1 : 0);
