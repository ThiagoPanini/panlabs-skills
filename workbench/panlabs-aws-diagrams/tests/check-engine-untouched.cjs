#!/usr/bin/env node
'use strict';
/**
 * The engine does not change unless someone decides it changes.
 *
 *   node tests/check-engine-untouched.cjs            # checks
 *   node tests/check-engine-untouched.cjs --write   # rewrites the manifest
 *
 * ⚠️ THIS MANIFEST CHANGED WHAT IT CLAIMS in the #23 recertification, and it is
 * worth saying what it used to claim.
 *
 * #14 froze #11's engine bytes to prove that serving BOTH VIEWS did not cost a
 * single line of the engine: if it had, the engine would have had to learn
 * what a logical view is, what a coat is, what collapses. That claim **died**
 * — #12, #13 and #22 changed the engine afterward, and the manifest was
 * already red on `main` before this ticket (#22 itself recorded it).
 *
 * #14's THESIS survives, and now it is tested for real instead of by
 * freezing: `check-projection.cjs` passes 12/12 against an engine that has
 * grown three times. Serving both views is still a matter of PROJECTION.
 *
 * What this file now claims is more modest and still useful: the 12 files of
 * the PRODUCTION engine have these bytes. The next change to them will be
 * deliberate — someone runs `--write` and explains — instead of discovered
 * three tickets later.
 *
 * Why a manifest and not `git diff`: `git diff` compares against what is
 * committed, and an engine that was changed AND committed passes. The
 * manifest compares against the bytes the suite was measured against, which
 * is the claim that matters.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENGINE = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams', 'engine');
const MANIFEST = path.join(__dirname, 'engine.manifest.json');

// `vendor/` is the embedded elkjs (1.6 MB) — hashed the same way, but listed
// separately so the manifest stays readable.
function listFiles(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, base));
    else out.push(path.relative(base, p));
  }
  return out.sort();
}

const current = {};
for (const rel of listFiles(ENGINE))
  current[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(ENGINE, rel))).digest('hex').slice(0, 16);

if (process.argv.includes('--write')) {
  fs.writeFileSync(MANIFEST, JSON.stringify(current, null, 2) + '\n');
  console.log(`  manifest written: ${Object.keys(current).length} production engine file(s)`);
  process.exit(0);
}

if (!fs.existsSync(MANIFEST)) {
  console.log('  manifest missing — run with --write once.');
  process.exit(1);
}
const expected = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

const failures = [];
for (const [rel, h] of Object.entries(expected)) {
  if (current[rel] === undefined) failures.push(`gone: engine/${rel}`);
  else if (current[rel] !== h) failures.push(`CHANGED: engine/${rel}  (${h} → ${current[rel]})`);
}
for (const rel of Object.keys(current)) if (expected[rel] === undefined) failures.push(`new: engine/${rel}`);

console.log(`  production engine files checked: ${Object.keys(expected).length}`);
if (failures.length) {
  console.log('\n  ✗ the engine changed since the suite last measured it:');
  for (const f of failures) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('  ✓ untouched since the last measurement — no accidental change.');
