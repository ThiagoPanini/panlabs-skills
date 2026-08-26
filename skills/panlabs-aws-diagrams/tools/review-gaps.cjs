#!/usr/bin/env node
'use strict';
/**
 * The gap review, from the terminal — step 4 of the arc.
 *
 *   node tools/review-gaps.cjs <model.json>       the report, readable
 *   node tools/review-gaps.cjs <model.json> --json  to read in code
 *
 * Eats `model@1`. If what you have is a `session@1`, project it first — same as
 * `check-geometry.cjs`, and for the same reason (see `guide/inquiry.md`).
 *
 * The whole-corpus table (`--corpus`) moved out with the corpus itself (#44) —
 * it lives in `workbench/panlabs-aws-diagrams/tests/check-gaps.cjs`, which is
 * where the L2/L3 rule-coverage ruler actually runs.
 */

const fs = require('fs');
const path = require('path');
const { review } = require(path.join(__dirname, '..', 'session', 'gaps.cjs'));

function oneModel(file, json) {
  const model = JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = review(model);
  if (json) { console.log(JSON.stringify(r, null, 2)); return r; }

  console.log(`\n  ${model.title || model.id}  (${model.nodes.length} nodes, ceiling ${r.ceiling})`);
  if (!r.findings.length) console.log('    no findings');
  for (const a of r.findings) console.log(`    ⚠ ${a.rule.padEnd(28)} ${String(a.target).padEnd(22)} ${a.because}`);
  if (r.mudas.length) {
    console.log('\n    silent rules (the rule has no subject in this model — not the same as passing):');
    for (const m of r.mudas) console.log(`      · ${m.rule.padEnd(28)} ${m.because}`);
  }
  console.log(`\n    ${r.findings.length} finding(s) · ceiling ⌈${model.nodes.length}÷4⌉ = ${r.ceiling} · ` +
    (r.dentroDoTeto ? 'inside' : '⛔ OVER'));
  return r;
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('usage: node tools/review-gaps.cjs <model.json> [--json]');
    process.exit(2);
  }
  oneModel(file, args.includes('--json'));
}

if (require.main === module) main();
