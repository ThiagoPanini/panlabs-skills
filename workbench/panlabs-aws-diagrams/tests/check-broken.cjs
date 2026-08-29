#!/usr/bin/env node
'use strict';
/**
 * The negative control: the validator fails what it has to fail.
 *
 * Each case from `cases/broken.cjs` breaks one named thing and declares the
 * check that has to flag it. Here we confirm it did — and, at the end, that
 * the CONTROL, built with the same vocabulary and correct geometry, is NOT
 * flagged by the hard checks. Without this second half, the suite cannot
 * tell a validator that knows how to measure from one that fails everything.
 */

const path = require('path');
const { CASES, CONTROL } = require(path.join(__dirname, 'cases', 'broken.cjs'));
const { validateGeometry } = require(path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams', 'validator', 'validate-geometry.cjs'));

/** The checks that must pass on a geometrically correct drawing. */
const HARD = ['A3.1', 'A3.3', 'A3.5', 'A3.7', 'A4.1', 'A4.2', 'A4.3', 'A4.4', 'A5.5', 'A5.8', 'F1', 'L1'];

let failures = 0;

console.log('  cases broken on purpose:\n');
for (const testCase of CASES) {
  const r = validateGeometry(testCase.layoutPlan, { model: testCase.model });
  const flagged = new Set([...r.failures, ...r.warnings].map(x => x.id));
  const missing = testCase.expect.filter(id => !flagged.has(id));
  const ok = missing.length === 0;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${testCase.name}`);
  if (ok) {
    const which = testCase.expect.map(id => {
      const finding = [...r.failures, ...r.warnings].find(x => x.id === id);
      return `${id} ${finding.state === 'failure' ? 'failed' : 'warned'}`;
    });
    console.log(`      ${which.join(', ')}`);
    const first = [...r.failures, ...r.warnings].find(x => testCase.expect.includes(x.id) && x.occurrences.length);
    if (first) console.log(`      → ${first.occurrences[0].o_que}`);
  } else {
    console.log(`      expected ${missing.join(', ')} and it did not come; flagged: ${[...flagged].join(', ') || '(none)'}`);
  }
}

// ------------------------------------------------------------------- control

console.log('\n  positive control (same vocabulary, correct geometry):\n');
{
  const r = validateGeometry(CONTROL.layoutPlan, { model: CONTROL.model });
  const flagged = new Set(r.failures.map(x => x.id));
  const undue = HARD.filter(id => flagged.has(id));
  const ok = undue.length === 0;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} no hard check flags the correct drawing`);
  if (ok) console.log(`      ${HARD.length} hard checks verified, ${r.summary.ok} ok overall`);
  else {
    console.log(`      flagged without cause: ${undue.join(', ')}`);
    for (const id of undue) {
      const x = r.failures.find(f => f.id === id);
      for (const o of x.occurrences.slice(0, 3)) console.log(`        · ${id}: ${o.o_que}`);
    }
  }

  // The control has to have ZERO semantic failures. That is what separates
  // "the drawing is ugly" from "the drawing is lying", and it is #18's
  // central promise.
  const semanticClean = r.semantic.length === 0;
  if (!semanticClean) failures++;
  console.log(`  ${semanticClean ? '✓' : '✗'} zero semantic failures on the correct drawing`);
  if (!semanticClean) for (const s of r.semantic) console.log(`        · ${s.id}: ${s.message}`);
}

// -------------------------------------------- the validator may not pass silently

console.log('\n  coverage:\n');
{
  const r = validateGeometry(CONTROL.layoutPlan, { model: CONTROL.model });
  const ok = r.cobertura.naoRodaram.length === 0;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} all ${r.cobertura.esperadas} validator checks ran`);
  if (!ok) console.log(`      did not run: ${r.cobertura.naoRodaram.join(', ')}`);

  // A check that blows up becomes state `erro`, not silence.
  const blownUp = r.resultados.filter(x => x.state === 'erro');
  if (blownUp.length) { failures++; console.log(`  ✗ ${blownUp.length} famil(y/ies) blew up: ${blownUp.map(e => e.message).join(' | ')}`); }
  else console.log('  ✓ no family blew up');
}

console.log(failures
  ? `\n  ✗ ${failures} check(s) failed`
  : `\n  ✓ the validator flags the ${CASES.length} defects and clears the correct drawing.`);
process.exit(failures ? 1 : 0);
