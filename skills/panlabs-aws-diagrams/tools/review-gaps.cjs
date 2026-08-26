#!/usr/bin/env node
'use strict';
/**
 * The gap review, from the terminal — step 4 of the arc.
 *
 *   node tools/review-gaps.cjs <model.json>       the report, readable
 *   node tools/review-gaps.cjs <model.json> --json  to read in code
 *   node tools/review-gaps.cjs --corpus             the whole corpus's table
 *
 * Eats `model@1`. If what you have is a `session@1`, project it first — same as
 * `check-geometry.cjs`, and for the same reason (see `guide/inquiry.md`).
 */

const fs = require('fs');
const path = require('path');
const { review, NAMES, arquivosDoCorpus } = require(path.join(__dirname, '..', 'session', 'gaps.cjs'));

const ROOT = path.join(__dirname, '..');

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

function corpus() {
  const files = arquivosDoCorpus(ROOT);
  const rows = [];
  const fired = new Map(), silent = new Map();
  for (const rel of files) {
    const model = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const r = review(model);
    const byRule = new Map();
    for (const a of r.findings) byRule.set(a.rule, (byRule.get(a.rule) || 0) + 1);
    for (const [k] of byRule) fired.set(k, (fired.get(k) || 0) + 1);
    for (const m of r.mudas) silent.set(m.rule, (silent.get(m.rule) || 0) + 1);
    rows.push({
      name: path.basename(rel, '.json'), nodes: model.nodes.length,
      n: r.findings.length, ceiling: r.ceiling, ok: r.dentroDoTeto,
      rules: [...byRule.entries()].map(([k, v]) => `${k}×${v}`).join(' '),
    });
  }

  const w = Math.max(...rows.map(l => l.name.length));
  console.log(`  ${'model'.padEnd(w)}  nodes  find  ceil        rules that fired`);
  for (const l of rows)
    console.log(`  ${l.name.padEnd(w)}  ${String(l.nodes).padStart(3)}  ${String(l.n).padStart(3)}  ` +
      `${String(l.ceiling).padStart(4)} ${l.ok ? ' ' : '⛔'}   ${l.rules}`);

  console.log('\n  L2/L3 — every rule must fire in ≥1 model AND stay silent in ≥1:');
  let red = 0;
  for (const r of NAMES) {
    const d = fired.get(r) || 0, c = silent.get(r) || 0;
    const ok = d >= 1 && c >= 1;
    if (!ok) red++;
    console.log(`    ${ok ? '✓' : '✗'} ${r.padEnd(30)} fired in ${String(d).padStart(2)} · silent in ${String(c).padStart(2)}`);
  }
  const over = rows.filter(l => !l.ok);
  console.log(`\n  L4 — ceiling ⌈nodes÷4⌉: ${over.length ? '✗ ' + over.map(l => l.name).join(', ') : '✓ no model goes over'}`);
  return red === 0 && !over.length;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--corpus')) { process.exit(corpus() ? 0 : 1); }
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('usage: node tools/review-gaps.cjs <model.json> [--json]   |   --corpus');
    process.exit(2);
  }
  oneModel(file, args.includes('--json'));
}

if (require.main === module) main();
