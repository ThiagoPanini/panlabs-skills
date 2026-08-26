#!/usr/bin/env node
'use strict';
/**
 * The index is the contract with the rubric (#8), and this check is what keeps
 * it from drifting away from it in silence.
 *
 * The rubric has 62 mechanizable checks. An index with 61 does not warn that
 * it lost one: it just reports 61 green lines, and the one that vanished
 * becomes a hole nobody looks for. That is why the 62 ids below are written
 * by hand, read from the rubric, and not derived from the index — if they
 * were derived, the check would be the index checking itself.
 *
 * Checks four things:
 *
 *   1. the set of ids is exactly the rubric's — neither missing nor extra;
 *   2. every check declares family, max severity and input;
 *   3. every threshold the rubric marked "engineering default" became named
 *      config, not a loose number in the middle of an `if`;
 *   4. the validator × render split has no overlap and no gap: every id falls
 *      into exactly one of the two sides, and whichever falls to render says why.
 */

const path = require('path');
const { CHECKS, THRESHOLDS, byId, SEVERITIES, INPUTS } = require(
  path.join(__dirname, '..', 'validator', 'index.cjs'));

// The 62 (A) ids, frozen from the quality rubric that originated the validator.
const FROM_RUBRIC = [
  'A1.1', 'A1.2', 'A1.3', 'A1.4', 'A1.5', 'A1.6', 'A1.7', 'A1.8', 'A1.9', 'A1.10', 'A1.11', 'A1.12',
  'A2.1', 'A2.2', 'A2.3', 'A2.4', 'A2.5', 'A2.6', 'A2.7', 'A2.8', 'A2.9', 'A2.10', 'A2.11',
  'A3.1', 'A3.2', 'A3.3', 'A3.4', 'A3.5', 'A3.6', 'A3.7', 'A3.8', 'A3.9',
  'A4.1', 'A4.2', 'A4.3', 'A4.4', 'A4.5', 'A4.6', 'A4.7',
  'A5.1', 'A5.2', 'A5.3', 'A5.4', 'A5.5', 'A5.6', 'A5.7', 'A5.8', 'A5.9',
  'A6.1', 'A6.2', 'A6.3', 'A6.4', 'A6.5',
  'A7.1', 'A7.2', 'A7.3', 'A7.4', 'A7.5',
  'A8.1', 'A8.2', 'A8.3', 'A8.4',
];

// The checks the rubric marks with zero tolerance and semantic severity — not
// aesthetic, and ticket #18 asks for explicit confirmation of them.
const ZERO_TOLERANCE = ['A4.2', 'A5.5'];

// THE SEVERITY THE RUBRIC ASSIGNED, check by check, read from the
// **Severity:** field of each one. Checking only that the value is in {fail,
// warn} proves nothing: an index that swapped `fail` for `warn` on A4.2 would
// pass that check and silently disarm the validator's most serious failure.
// Where the rubric gives two levels ("warn / fail above X"), what is expected
// here is the WORST the check can emit — which is what the `severity` field
// means.
const RUBRIC_SEVERITY = {
  'A1.1': 'fail', 'A1.2': 'fail', 'A1.3': 'fail', 'A1.4': 'fail', 'A1.5': 'fail', 'A1.6': 'fail',
  'A1.7': 'fail', 'A1.8': 'fail', 'A1.9': 'warn', 'A1.10': 'fail', 'A1.11': 'warn', 'A1.12': 'fail',
  'A2.1': 'fail', 'A2.2': 'fail', 'A2.3': 'fail', 'A2.4': 'warn', 'A2.5': 'fail', 'A2.6': 'fail',
  'A2.7': 'fail', 'A2.8': 'warn', 'A2.9': 'warn', 'A2.10': 'warn', 'A2.11': 'fail',
  'A3.1': 'fail', 'A3.2': 'fail', 'A3.3': 'fail', 'A3.4': 'fail', 'A3.5': 'fail', 'A3.6': 'fail',
  'A3.7': 'fail', 'A3.8': 'warn', 'A3.9': 'warn',
  'A4.1': 'fail', 'A4.2': 'fail', 'A4.3': 'fail', 'A4.4': 'fail', 'A4.5': 'warn', 'A4.6': 'warn', 'A4.7': 'warn',
  'A5.1': 'fail', 'A5.2': 'fail', 'A5.3': 'fail', 'A5.4': 'fail', 'A5.5': 'fail',
  'A5.6': 'warn', 'A5.7': 'warn', 'A5.8': 'fail', 'A5.9': 'warn',
  'A6.1': 'fail', 'A6.2': 'warn', 'A6.3': 'warn', 'A6.4': 'warn', 'A6.5': 'warn',
  'A7.1': 'fail', 'A7.2': 'fail', 'A7.3': 'fail', 'A7.4': 'warn', 'A7.5': 'fail',
  'A8.1': 'fail', 'A8.2': 'warn', 'A8.3': 'warn', 'A8.4': 'warn',
};

// The ones the rubric writes with TWO levels, and that therefore have to
// carry `escalona: true` — the concrete case is decided by the check, not by
// the table.
const SCALE_WITH = ['A2.1', 'A5.1', 'A5.2', 'A5.3', 'A5.4', 'A6.1', 'A8.1'];

const failures = [];
const note = m => failures.push(m);

// ---------------------------------------------------------------- 1. the set

const ids = CHECKS.map(c => c.id);
const idSet = new Set(ids);

if (ids.length !== 62) note(`the index has ${ids.length} checks, the rubric has 62`);
if (idSet.size !== ids.length) {
  const seen = new Set();
  const duplicates = ids.filter(i => seen.has(i) || (seen.add(i), false));
  note(`duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
}
for (const id of FROM_RUBRIC) if (!idSet.has(id)) note(`the rubric has "${id}" and the index does not`);
for (const id of ids) if (!FROM_RUBRIC.includes(id)) note(`the index invented "${id}", which is not in the rubric`);

// ---------------------------------------------------- 2. the mandatory fields

for (const c of CHECKS) {
  if (!c.name) note(`${c.id} has no name`);
  if (c.family !== c.id.split('.')[0]) note(`${c.id} declares family "${c.family}"`);
  if (!SEVERITIES.includes(c.severity)) note(`${c.id} has severity "${c.severity}", outside ${SEVERITIES.join('|')}`);
  else if (RUBRIC_SEVERITY[c.id] && c.severity !== RUBRIC_SEVERITY[c.id])
    note(`${c.id} is set to "${c.severity}" and the rubric says "${RUBRIC_SEVERITY[c.id]}"`);
  if (SCALE_WITH.includes(c.id) && !c.escalona) note(`${c.id} has two levels in the rubric and does not carry escalona: true`);
  if (!SCALE_WITH.includes(c.id) && c.escalona) note(`${c.id} calls itself scalable, and the rubric gives it a single level`);
  if (!INPUTS.includes(c.input)) note(`${c.id} has input "${c.input}", outside ${INPUTS.join('|')}`);
  if (!c.mede) note(`${c.id} does not say what it measures`);
  if (!c.fonte) note(`${c.id} does not cite a source — the rubric cites one, the index has to cite one`);
}

// -------------------------------------------- 3. the "engineering defaults"

// The list comes from the rubric's U8, which is where it takes the trouble to
// enumerate the numbers with no experimental basis — and where it demands
// they be exposed: "Must be exposed as configuration, not hardcoded". The
// inline marking in each check's body misses two (A8.3 and A8.4); U8 is the
// complete list, and it is the one that counts.
const TUNABLE = ['A3.9', 'A4.7', 'A5.3', 'A5.7', 'A6.4', 'A7.4', 'A8.3', 'A8.4'];

for (const id of TUNABLE) {
  const c = byId(id);
  if (!c) continue;                       // already reported above
  if (!c.calibravel) note(`${id} is an "engineering default" in the rubric and the index did not mark it as calibravel`);
  if (!c.limiar || !c.limiar.key) note(`${id} is calibravel and does not point to a thresholds.json key`);
  else if (!(c.limiar.key in THRESHOLDS)) note(`${id} points to key "${c.limiar.key}", missing from thresholds.json`);
}

for (const c of CHECKS) {
  if (c.calibravel && !TUNABLE.includes(c.id))
    note(`${c.id} calls itself calibravel, but the rubric did not mark it as an engineering default`);
}

// ------------------------------------------- 4. the validator × render split

for (const c of CHECKS) {
  if (c.input === 'render' && !c.porqueRender)
    note(`${c.id} was handed to render without saying why — #18's split demands the reason`);
  if (c.input !== 'render' && c.porqueRender)
    note(`${c.id} belongs to the validator and still justifies render`);
}

for (const id of ZERO_TOLERANCE) {
  const c = byId(id);
  if (!c) continue;
  if (c.severity !== 'fail') note(`${id} has zero tolerance in the rubric and the index did not mark it fail`);
  if (c.input === 'render') note(`${id} is the validator's semantic backbone and was pushed to render`);
  if (!c.semantica) note(`${id} is not marked as a semantic failure — that is what separates a linter from a truthfulness guard`);
}

// ------------------------------------------------------------------ report

const validatorOwned = CHECKS.filter(c => c.input !== 'render');
console.log(`  checks in the index:        ${CHECKS.length}/62`);
console.log(`  validator's (mandatory):    ${validatorOwned.length}`);
console.log(`  render's (opportunistic):   ${CHECKS.length - validatorOwned.length}`);
console.log(`  fail / warn:                ${CHECKS.filter(c => c.severity === 'fail').length} / ` +
  `${CHECKS.filter(c => c.severity === 'warn').length}`);
console.log(`  calibratable thresholds:    ${CHECKS.filter(c => c.calibravel).length}`);

if (failures.length) {
  console.log('\n  ✗ the index does not match the rubric:');
  for (const f of failures) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('\n  ✓ the rubric\'s 62 checks are in the index, classified and sourced.');
