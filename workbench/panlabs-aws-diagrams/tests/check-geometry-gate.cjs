#!/usr/bin/env node
'use strict';
/**
 * The gate, run end to end — decision 2 proven, not just declared.
 *
 * #18's review pointed out that "the validator is a gate after `plan` and
 * before `emit`" lived only in prose: nothing in the code exercised the
 * graft, and an architecture decision nobody executes is an intention.
 *
 * This test executes it. It assembles the pipeline by hand up to `plan`,
 * calls the gate exactly where it lives, and checks both halves:
 *
 *   · on a plan that lies, the gate THROWS, and the message says what broke;
 *   · on a correct plan, it LETS IT THROUGH and `emit` runs right after,
 *     producing the XML — which is the proof that the gate fits in the
 *     middle of the pipeline without breaking it.
 *
 * ✅ And the graft IS in place since the #23 consolidation — when this test was
 * written it was not, because the engine was another ticket's prototype, and
 * what was being proven here was that it FIT. It keeps proving that, and now
 * proves the stronger claim: the gate the suite exercises by hand is the same
 * one `engine/generate.cjs` calls. The end-to-end run through the engine is in
 * `tests/run.sh`, layer 5.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const { gate, LEVELS } = require(path.join(ROOT, 'validator', 'gate.cjs'));
const { CASES, CONTROL } = require(path.join(__dirname, 'cases', 'broken.cjs'));
const { emit, checkXml } = require(path.join(ROOT, 'engine', 'emit.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));

let failures = 0;
const note = (ok, what, detail) => {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (detail) console.log(`      ${detail}`);
};

// ------------------------------------------------- 1. the gate blocks the lie

/**
 * ⚠️ ONE SEMANTIC FAMILY AT A TIME, and not just the first one the list finds.
 *
 * The previous version only exercised `A4.2`. #24's review pointed out the
 * hole: if the gate started blocking `A4.2` and letting `A5.5` through, this
 * file would stay green — and `A5.5` is exactly the family #24 zeroed out in
 * the engine, which means no model in the corpus produces it anymore to
 * charge it elsewhere. A gate that loses the validator's most serious check
 * cannot depend on a defect existing in the corpus to be caught.
 *
 * The FIVE zero-tolerance families, each with its own planted case — `F2`
 * came in with #26, and by the same argument #24 used for `A5.5`: it is the
 * check that NO model in the corpus produces (measured on a full 3-to-6-zone
 * mesh, F2 = 0 across all four), so if it is not charged here, it is not
 * charged anywhere.
 */
{
  for (const id of ['A4.2', 'A4.4', 'A5.5', 'F1', 'F2']) {
    const lying = CASES.find(c => c.expect.includes(id));
    if (!lying) { note(false, `there is a planted case for ${id}`); continue; }
    let thrown = null;
    try {
      gate(lying.layoutPlan, { model: lying.model, level: 'truthfulness' });
    } catch (e) { thrown = e; }

    note(!!thrown, `"truthfulness" level blocks the plan that lies via ${id} ("${lying.name}")`,
      thrown ? `→ ${thrown.errors[0]}` : 'passed, and it should not have');
    if (!thrown) continue;
    note(Array.isArray(thrown.errors) && thrown.errors.length > 0,
      `${id}: the error carries readable lines in \`.errors\`, like the rest of the engine`);
    note(!!thrown.report, `${id}: the error carries the whole report for whoever wants the detail`);
    note(thrown.errors.some(l => l.includes(id)), `${id}: the message names the check that blocked it`);
  }
}

// ------------------ 2. incompleteness never passes, even at the loosest level

{
  // A correct plan at the `none` level has to pass…
  let passed = true;
  try { gate(CONTROL.layoutPlan, { model: CONTROL.model, level: 'none' }); }
  catch { passed = false; }
  note(passed, '"none" level lets a correct plan through');

  // …but not even `none` swallows an incomplete report. There is no way to
  // simulate this by removing a family from the index; what is checked is
  // that the rule exists and is wired in.
  const report = require(path.join(ROOT, 'validator', 'validate-geometry.cjs'))
    .validateGeometry(CONTROL.layoutPlan, { model: CONTROL.model });
  note(report.cobertura.naoRodaram.length === 0 && !report.resultados.some(r => r.state === 'erro'),
    "the control's report is complete (no check is missing)",
    `${report.cobertura.rodaram}/${report.cobertura.esperadas} ran`);
}

// --------------------------- 3. the real graft: plan › GATE › emit

{
  // #11's pipeline up to the plan. `generate` already does everything, so the
  // plan it returns is used — it is the same object that would exist between
  // `plan` and `emit`.
  const model = JSON.parse(fs.readFileSync(path.join(WORKBENCH, 'models', 'orders-serverless.json'), 'utf8'));
  generate(model).then(r => {
    let report = null;
    let blocked = null;
    try {
      // this is EXACTLY what goes into `generate.cjs`, in the two lines documented in gate.cjs
      report = gate(r.layoutPlan, { level: 'truthfulness' });
    } catch (e) { blocked = e; }

    note(!blocked, "#11's good diagram passes the truthfulness gate",
      blocked ? blocked.errors.join(' | ') : `${report.summary.ok} ok, ${report.summary.failure} failure, 0 semantic`);

    // and the pipeline continues: the gate did not consume or alter the plan
    const xml = emit(r.layoutPlan);
    const malformed = checkXml(xml);
    note(malformed.length === 0 && xml.length > 0,
      '`emit` runs after the gate and produces well-formed XML',
      `${xml.length} bytes`);
    note(xml === r.xml, 'the XML is byte for byte the same — the gate is pure, it did not touch the plan');

    /**
     * ⚠️ THE MOST IMPORTANT CONTROL IN THIS FILE — and the only one that needs
     * a child process.
     *
     * #18 guarantees that *"an incomplete report never passes, AT NO LEVEL"*:
     * if a check family stopped running, green means nothing. It is the
     * easiest guarantee to lose in the graft, and it WAS lost in the first
     * version of #23 — `generate.cjs` called `gate` inside a `try` and skipped
     * the page when it threw, so a broken family came out as a green gate over
     * a report that measured nothing.
     *
     * Exercising this requires breaking a family BEFORE `gate.cjs` is loaded —
     * it destructures `validateGeometry` at load time, so swapping the
     * property afterward does not reach the reference it kept. Hence the
     * child process.
     */
    const { execFileSync } = require('child_process');
    const script = `
      const path = require('path');
      const ROOT = ${JSON.stringify(ROOT)};
      const target = require.resolve(path.join(ROOT, 'validator', 'validate-geometry.cjs'));
      const real = require(target);
      // a report that declares itself INCOMPLETE, and nothing else
      require.cache[target].exports = {
        ...real,
        validateGeometry: (layoutPlan, opts) => {
          const l = real.validateGeometry(layoutPlan, opts);
          return { ...l, cobertura: { ...l.cobertura, naoRodaram: ['A9.9'] } };
        },
      };
      const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'web-multi-az.json'), 'utf8'));
      generate(m, { gate: 'none' })
        .then(() => { console.log('PASSED'); })
        .catch(e => { console.log('BLOCKED:' + e.message); });
    `;
    const childOutput = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim();
    note(childOutput.startsWith('BLOCKED:'),
      'an INCOMPLETE report does not pass even at the "none" level (the #18 guarantee)',
      childOutput.slice(0, 110));

    console.log(failures
      ? `\n  ✗ ${failures} check(s) failed`
      : '\n  ✓ the gate blocks what lies, lets through what does not lie, and fits between plan and emit.');
    process.exit(failures ? 1 : 0);
  }).catch(e => { console.error(e); process.exit(1); });
}

// module sanity: the declared levels exist
note(Object.keys(LEVELS).length === 4, 'the four gate levels are declared',
  Object.keys(LEVELS).join(', '));
