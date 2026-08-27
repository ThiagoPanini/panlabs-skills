#!/usr/bin/env node
'use strict';
/**
 * The corpus's good diagrams, reported on — the other half of the acceptance criteria.
 *
 * The ticket asks for the validator to "separate the two": the ones broken on
 * purpose, and the good diagram. `check-broken.cjs` covers the first side.
 * This is the second, and it is NOT "all green".
 *
 * The distinction the suite locks down is between two things a single report
 * blends together:
 *
 *   the drawing is INCOMPLETE — missing a legend, missing freshness metadata,
 *   a group title has 3.06:1 contrast. These are real engine defects, and the
 *   suite reports them instead of hiding them. They do not block: blocking
 *   here would turn a #18 finding into an engine regression.
 *
 *   the drawing is LYING — a node drawn in a VPC it is not a member of, an
 *   edge cutting through a network it has no business in, a band asserting an
 *   attribute the model denies. This is what the index marks as `semantica`,
 *   and it is zero tolerance. THIS blocks the suite, because if it shows up in
 *   one of #11's examples it means the engine regressed or the validator is
 *   wrong, and both need an eye on them.
 *
 * The count by state is printed on every run on purpose: it is the number
 * compared from one session to the next to know whether things improved.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const { validateGeometry } = require(path.join(ROOT, 'validator', 'validate-geometry.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));

/**
 * ⚠️ NAMED QUARANTINE — the machinery demands EXACT equality, and that is the record.
 *
 * #23's recertification ran #18's validator over #12's corpus for the first
 * time and found a real, SEMANTIC debt: `web-flow-3-az` was flagging `A5.5`
 * ×2 — two EC2 writes on different lanes crossing the "app-a" group, which
 * they neither left from nor went to. It entered here with a ticket (#24),
 * the reason, and the EXACT count, and with the rule that once it was paid
 * off the suite would break, demanding the entry be removed.
 *
 * **It was paid.** #24 found the cause in `layout`/`plan` — the grid's
 * perpendicular detour computed the midpoint between the ICONS, and on a 3×3
 * grid that point lands inside the middle column. `corredorLivre` started
 * looking for a GAP instead, and the suite demanded the removal of this entry
 * exactly as promised. A quarantine that knows how to expire, expired.
 *
 * **The next named debt, #39 found it — and #110 paid it.** Turning `qualifier`
 * on by default made `check-good.cjs` — which only ever runs the DEFAULT theme
 * — exercise, for the first time, a corpus where the token is on everywhere.
 * `F2` ×2 on `quorum-3-az` was pre-existing (it reproduced under `--theme
 * corporate`, which always had the token on, independent of #39) and had
 * simply never been looked at: the far pair of a 3-zone triangle graph is
 * geometrically forced past the middle zone (#21's known cost), and the only
 * obstacle `corredorLivre` got was that zone's SUBNET box — never its BAND,
 * which is deliberately larger. The corridor came out genuinely free of every
 * subnet and inside the band anyway.
 *
 * #110 gave the router the band as a SECOND obstacle list instead of swapping
 * it for the first — swapping is what an earlier attempt did, and it reopened
 * `web-flow-3-az`'s `A5.5`, trading one zero-tolerance failure for another.
 * Both quarantines this file has ever held were paid by the same lever, and
 * the object stays here, empty, because the machinery that reads it is the one
 * that demands exact equality, and the next named debt enters through it.
 */
const QUARANTINE = {};

async function main() {
  // full paths, not bare names — 3 of these files moved to the skill's own
  // `examples/` (#44), and the corpus this certifies has to keep covering them
  const models = [
    ...fs.readdirSync(path.join(WORKBENCH, 'models')).filter(f => f.endsWith('.json')).map(f => path.join(WORKBENCH, 'models', f)),
    ...fs.readdirSync(path.join(ROOT, 'examples')).filter(f => f.endsWith('.json')).map(f => path.join(ROOT, 'examples', f)),
  ].sort();
  let failed = 0;

  for (const file of models) {
    const name = path.basename(file, '.json');
    let r;
    try {
      r = await generate(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (e) {
      console.log(`  ✗ ${name}: the engine did not generate — ${e.message}`);
      failed = 1;
      continue;
    }

    const report = validateGeometry(r.layoutPlan);
    const s = report.summary;

    // 1. zero tolerance for what is semantic — save for a named quarantine,
    //    and it demands EXACT equality, not "less than or equal"
    const lies = report.semantic;
    const signature = lies.map(m => `${m.id}×${m.occurrences.length}`).sort();
    const q = QUARANTINE[name];
    const quarantined = q && JSON.stringify(signature) === JSON.stringify([...q.expected].sort());

    if (quarantined) {
      console.log(`  ⚠ ${name}: ${signature.join(', ')} — QUARANTINE ${q.ticket} (${q.because})`);
    } else {
      console.log(`  ${lies.length ? '✗' : '✓'} ${name}: ${lies.length ? `${lies.length} SEMANTIC FAILURE(S)` : 'no semantic failure'}`);
      for (const m of lies) {
        failed = 1;
        console.log(`      ${m.id} ${m.name}: ${m.message}`);
        for (const o of m.occurrences.slice(0, 3)) console.log(`        · ${o.o_que}`);
      }
      if (q) {
        failed = 1;
        console.log(`      ✗ quarantine ${q.ticket} for "${name}" expected ${q.expected.join(', ')} and got ` +
          `${signature.length ? signature.join(', ') : 'nothing'} — ` +
          (signature.length ? 'the debt changed shape' : 'the debt was PAID: remove the QUARANTINE entry'));
      }
    }

    // 2. the report has to be complete — a check that is missing cannot pass as green
    if (report.cobertura.naoRodaram.length) {
      failed = 1;
      console.log(`      ✗ did not run: ${report.cobertura.naoRodaram.join(', ')}`);
    }
    const blownUp = report.resultados.filter(x => x.state === 'erro');
    for (const e of blownUp) { failed = 1; console.log(`      ✗ ${e.message}`); }

    // 3. the snapshot, which is what gets compared between sessions
    console.log(`      ${s.ok} ok · ${s.warning} warning · ${s.failure} failure · ${s.notApplicable} not applicable · ${s.skipped} from render`);
    if (report.failures.length)
      console.log(`      findings (do not block the suite): ${report.failures.map(f => f.id).join(', ')}`);
  }

  // ---------------------------------------------------------- the separation, made explicit
  //
  // The ticket's acceptance criterion is "show that it separates the two". It
  // is worth saying on which AXIS the separation happens, because on the
  // whole-report axis it does not — and hiding that would be selling the tool
  // as better than it is.
  //
  // #11's examples pile up 6 failures each: no legend, no metadata, catalog
  // contrast below WCAG. These are REAL defects. So "has a failure" does not
  // distinguish a good diagram from a broken one — both have them.
  //
  // What distinguishes them is TRUTHFULNESS: does the drawing assert something
  // the model denies? There the separation is clean, and it is what the gate
  // uses as its default level.
  const { gate } = require(path.join(ROOT, 'validator', 'gate.cjs'));
  const { CASES } = require(path.join(__dirname, 'cases', 'broken.cjs'));

  console.log('\n  the separation, on the truthfulness axis:\n');
  const liars = CASES.filter(c => ['A4.2', 'A4.4', 'A5.5', 'F1'].some(id => c.expect.includes(id)));
  let blocked = 0;
  for (const c of liars) {
    let wasBlocked = false;
    try { gate(c.layoutPlan, { model: c.model, level: 'truthfulness' }); } catch { wasBlocked = true; }
    if (wasBlocked) blocked++;
    else { failed = 1; console.log(`  ✗ "${c.name}" passed the truthfulness gate`); }
  }
  console.log(`  ${blocked === liars.length ? '✓' : '✗'} ${blocked}/${liars.length} lying diagrams were blocked`);

  let passed = 0, quarantinedAtGate = 0;
  for (const file of models) {
    const name = path.basename(file, '.json');
    const r = await generate(JSON.parse(fs.readFileSync(file, 'utf8')));
    try { gate(r.layoutPlan, { level: 'truthfulness' }); passed++; }
    catch (e) {
      // the gate blocks what lies, and the quarantine does not turn it off: it
      // KEEPS blocking `web-flow-3-az`, which is the correct behavior. What the
      // quarantine does is not call a named debt a regression.
      if (QUARANTINE[name]) { quarantinedAtGate++; console.log(`  ⚠ ${file} blocked by the gate — quarantine ${QUARANTINE[name].ticket}`); }
      else { failed = 1; console.log(`  ✗ ${file} was blocked: ${e.errors.join(' | ')}`); }
    }
  }
  const expected = models.length - Object.keys(QUARANTINE).length;
  console.log(`  ${passed === expected ? '✓' : '✗'} ${passed}/${expected} corpus diagrams passed` +
    (quarantinedAtGate ? `  (+${quarantinedAtGate} in named quarantine)` : ''));
  if (passed !== expected) failed = 1;
  console.log('      (on the whole-report axis there is NO separation, and that is honest: the');
  console.log('       corpus diagrams have 6 to 9 real failures each. "Has a failure" does not');
  console.log('       distinguish good from broken; "lies" does.)');

  console.log(failed
    ? '\n  ✗ there is a semantic failure outside quarantine, or an incomplete report, in the corpus'
    : '\n  ✓ the corpus has reported defects, and none outside quarantine is the drawing lying.');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
