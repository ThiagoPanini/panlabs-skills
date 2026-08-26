#!/usr/bin/env node
'use strict';
/**
 * Determinism — three questions, and the third one was open.
 *
 *   1. Same input, same process, N times -> byte for byte identical?
 *   2. Same input, NEW process -> identical? (GWT's `$H` leaks a global
 *      process counter; #7 proved it does not move a coordinate, but whoever
 *      serializes the ELK's raw object versions garbage.)
 *   3. REORDERED input -> same drawing?
 *
 * #3 is #7's uncertainty 4, explicitly left unanswered there:
 *
 *   > "I did not test whether reordering `children`/`edges` in the input JSON
 *   >  changes the drawing — and there is strong evidence that it does, since
 *   >  `considerModelOrder.strategy` exists. If the generator iterates over a
 *   >  Map with no stable order, the layout can vary even with ELK being
 *   >  deterministic."
 *
 * It matters because the `.drawio` is meant to be versioned: if the order of
 * the flat list moves the drawing, a model diff that only moves one line
 * becomes a diff of the whole diagram.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));

const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
// the models directory is an argument so that another corpus can point ITS
// models at this same ruler — determinism is a property of the engine, not of
// one set of examples
// no override: sweep the workbench corpus PLUS the skill's own `examples/`
// (web-multi-az moved there in #44, and determinism still has to cover it)
const models = process.argv[2]
  ? (() => { const d = path.resolve(process.argv[2]);
    return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => path.join(d, f)); })()
  : [
    ...fs.readdirSync(path.join(WORKBENCH, 'models')).filter(f => f.endsWith('.json')).map(f => path.join(WORKBENCH, 'models', f)),
    ...fs.readdirSync(path.join(ROOT, 'examples')).filter(f => f.endsWith('.json')).map(f => path.join(ROOT, 'examples', f)),
  ];

/** Geometry only — ignores ids, styles and the order the cells came out in. */
function fingerprint(xml) {
  const geos = [...xml.matchAll(/id="([^"]+)"[^>]*>\s*<mxGeometry x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)"/g)]
    .map(m => `${m[1]}:${m[2]},${m[3]},${m[4]},${m[5]}`).sort();
  const pts = [...xml.matchAll(/<mxPoint x="(-?\d+)" y="(-?\d+)"\/>/g)].map(m => `${m[1]},${m[2]}`);
  return hash(geos.join('|') + '#' + pts.join('|'));
}

/** Deterministic shuffle — no Math.random, so the test is reproducible. */
function shuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

(async () => {
  let failures = 0;

  for (const file of models) {
    const raw = fs.readFileSync(file, 'utf8');
    const model = JSON.parse(raw);
    console.log(`\n  ${path.basename(file, '.json')}`);

    // 1. same process, 3 runs
    const hs = [];
    for (let i = 0; i < 3; i++) hs.push(hash((await generate(JSON.parse(raw))).xml));
    const same = new Set(hs).size === 1;
    console.log(`    same process    ×3   ${same ? '✓' : '✗'}  ${hs[0]}`);
    if (!same) { failures++; console.log(`        ${hs.join('  ')}`); }

    // 2. new process
    const otherProcess = execFileSync(process.execPath, ['-e', `
      const { generate } = require(${JSON.stringify(path.join(ROOT, 'engine', 'generate.cjs'))});
      const m = JSON.parse(require('fs').readFileSync(${JSON.stringify(file)}, 'utf8'));
      generate(m).then(r => process.stdout.write(require('crypto').createHash('sha256').update(r.xml).digest('hex').slice(0,16)));
    `], { encoding: 'utf8' });
    const newProcessOk = otherProcess === hs[0];
    console.log(`    new process          ${newProcessOk ? '✓' : '✗'}  ${otherProcess}`);
    if (!newProcessOk) failures++;

    // 3. reordered input — #7's uncertainty 4
    const base = fingerprint((await generate(JSON.parse(raw))).xml);
    const divergent = [];
    for (const seed of [7, 42, 1337]) {
      const m = JSON.parse(raw);
      m.nodes = shuffle(m.nodes, seed);
      if (m.edges) m.edges = shuffle(m.edges, seed + 1);
      let d;
      try { d = fingerprint((await generate(m)).xml); }
      catch (e) { d = 'ERROR: ' + e.message; }
      if (d !== base) divergent.push(`seed ${seed} -> ${d}`);
    }
    const orderOk = divergent.length === 0;
    console.log(`    reordered input      ${orderOk ? '✓' : '✗'}  geometry ${orderOk ? 'identical' : 'CHANGED'} (${base})`);
    if (!orderOk) { failures++; for (const d of divergent) console.log(`        ${d}`); }
  }

  console.log(failures
    ? `\n  ✗ ${failures} determinism failure(s)`
    : '\n  ✓ deterministic on all three fronts, including under input reordering.');
  process.exit(failures ? 1 : 0);
})();
