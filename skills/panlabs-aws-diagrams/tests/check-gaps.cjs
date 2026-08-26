#!/usr/bin/env node
'use strict';
/**
 * The gap review's ruler — the thresholds #26 calibrated, locked in.
 *
 * #15 settled the policy (blocks in bulk, once only; reports and never
 * silently fixes) and left the THRESHOLD open, with the number that
 * motivated it: the prototype's rules fired **4 findings on a 3-node model**.
 *
 * The acceptance criterion was written BEFORE these rules existed. This file
 * is that criterion, executable.
 *
 *   L1  every rule has a written precondition, and stays silent where the
 *       model does not assert the structure it talks about  →  checked by
 *       `mudas[]` existing and carrying a reason
 *   L2  every rule fires on ≥1 model in the corpus
 *   L3  every rule stays silent on ≥1 model in the corpus
 *   L4  no model produces more findings than ⌈nodes ÷ 4⌉
 *
 * L2 and L3 together are the guard: a rule has to know how to say yes AND how
 * to say no, against the same corpus. A rule that fires on everything measures
 * nothing, it asserts a constant — it is #23's lesson (`A4.1` measuring the
 * engine against itself, 77 occurrences all reporting exactly 8) applied to
 * the other end.
 */

const fs = require('fs');
const path = require('path');
const { review, NAMES, arquivosDoCorpus } =
  require(path.join(__dirname, '..', 'session', 'gaps.cjs'));

const ROOT = path.join(__dirname, '..');

/**
 * ⚠️ NAMED EXCEPTIONS TO L4 — none, and the empty list is a result, not an oversight.
 *
 * It had one, and its story is the mechanism working. `platform-3-accounts`
 * produced 6 findings with a ceiling of 5, the six were checked by hand, and
 * the entry stayed here with the measured reason: the ceiling's denominator
 * is a node count, and findings scale with architecture SURFACE.
 *
 * Then #26's end-to-end case found the missing clause in `spof` — only the
 * MAXIMAL bottlenecks, because in a linear chain every link is an
 * articulation point — and the exception expired on its own: this test went
 * red with the message it had itself prepared (*"it no longer fires: DELETE
 * the entry"*), and the entry was deleted. It is the same trajectory as #23's
 * quarantine, which #24 made expire the same way.
 *
 * The observation about the denominator still holds and is still on record —
 * it just no longer has a corpus model to prove it.
 */
const OVER_CEILING = {};

let failed = 0;
const note = (ok, what, detail) => {
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (detail) console.log(`      ${detail}`);
};

// ------------------------------------------------------------- run the corpus

// The SAME scan the CLI uses — if there were two, `L2`/`L3` could stay green
// against half the corpus.
const files = arquivosDoCorpus(ROOT);

const fired = new Map(), silenced = new Map();
const overflowing = [];
let totalFindings = 0, totalNodes = 0;

for (const rel of files) {
  const model = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  const name = path.basename(rel, '.json');
  const r = review(model);
  totalFindings += r.findings.length;
  totalNodes += model.nodes.length;

  for (const k of new Set(r.findings.map(a => a.rule))) fired.set(k, (fired.get(k) || 0) + 1);
  for (const m of r.mudas) silenced.set(m.rule, (silenced.get(m.rule) || 0) + 1);
  if (!r.dentroDoTeto) overflowing.push({ name, findings: r.findings.length, ceiling: r.ceiling });
}

console.log(`\n1 · corpus run: ${files.length} models, ${totalNodes} nodes, ${totalFindings} findings\n`);

// L1 — every rule that stays silent says WHY
{
  const noReason = [];
  for (const rel of files) {
    const model = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    for (const m of review(model).mudas)
      if (!m.because || !m.because.trim()) noReason.push(`${path.basename(rel, '.json')}/${m.rule}`);
  }
  note(!noReason.length, 'L1 · every silent rule carries the reason — "did not fire" never gets confused with "did not run"',
    noReason.length ? noReason.join(', ') : `${[...silenced.values()].reduce((a, b) => a + b, 0)} silences, all with a reason`);
}

// L2 and L3
console.log('\n2 · the two-sided guard: every rule knows how to say yes AND how to say no\n');
for (const r of NAMES) {
  const d = fired.get(r) || 0, c = silenced.get(r) || 0;
  note(d >= 1, `L2 · "${r}" fires on ≥1 model`, `fired on ${d}`);
  note(c >= 1, `L3 · "${r}" is silent on ≥1 model`, `silent on ${c}`);
}

// L4
console.log('\n3 · the ceiling\n');
{
  const unexpected = overflowing.filter(e => !OVER_CEILING[e.name]);
  note(!unexpected.length, 'L4 · no model overflows ⌈nodes÷4⌉ outside the named exceptions',
    unexpected.length
      ? unexpected.map(e => `${e.name}: ${e.findings} > ${e.ceiling}`).join(' · ')
      : `${files.length - overflowing.length}/${files.length} within the ceiling`);

  // the other end: an exception that stopped overflowing has to be DELETED
  for (const [name, expected] of Object.entries(OVER_CEILING)) {
    const real = overflowing.find(e => e.name === name);
    note(!!real, `the named exception "${name}" STILL overflows`,
      real ? `${real.findings} findings against ceiling ${real.ceiling} — ${expected.because}`
        : `it no longer overflows: the ceiling was fixed or the rule changed. DELETE the entry from OVER_CEILING.`);
    if (real)
      note(real.findings === expected.findings && real.ceiling === expected.ceiling,
        'and it overflows by the SAME margin that was checked by hand',
        `expected ${expected.findings}/${expected.ceiling}, got ${real.findings}/${real.ceiling}`);
  }
}

// #15's number, so it can be compared
console.log('\n4 · the ruler against the #15 prototype\n');
{
  const rate = totalFindings / totalNodes;
  note(rate < 1.33 / 4, "the rate is at least 4× below the prototype's",
    `${totalFindings} findings / ${totalNodes} nodes = ${rate.toFixed(3)} per node ` +
    `(prototype: 4/3 = 1.333 — ${(1.333 / rate).toFixed(1)}× above this)`);
}

console.log();
if (failed) { console.log(`  ✗ ${failed} gap-review assertion(s) failed.`); process.exit(1); }
console.log(`  ✓ the six rules know how to fire and know how to stay silent, and ${Object.keys(OVER_CEILING).length
  ? `the ceiling has ${Object.keys(OVER_CEILING).length} named exception(s)`
  : 'no model overflows the ceiling'}.`);
