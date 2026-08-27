#!/usr/bin/env node
'use strict';
/**
 * The SAME model through both engines — the ruler that picked the production one.
 *
 *   node tools/measure-before-after.cjs            # geometry report side by side
 *   node tools/measure-before-after.cjs --bytes    # and the size of the XML
 *
 * #23 asks for the choice to be made "by measurement, not by date", and then asks
 * that every geometric conclusion which does not survive be recorded. This tool
 * is the instrument for both: it generates each corpus model with the BEFORE
 * engine — the one living in `prototypes/q11/engine/`, with no theme layer — and
 * with the production one, and runs both through the #18 validator.
 *
 * It is a tool and not a check on purpose: one day `prototypes/` leaves the tree
 * and the "before" stops existing. A check that depends on the prototype would
 * rust; a tool that answers a question of archaeology only has to work while the
 * question still matters. Once the prototype is gone, it says so and exits clean.
 */

const fs = require('fs');
const path = require('path');

const WORKBENCH = path.join(__dirname, '..');
const SKILL = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const BEFORE = path.join(SKILL, 'prototypes', 'q11', 'engine', 'generate.cjs');
const { validateGeometry } = require(path.join(SKILL, 'validator', 'validate-geometry.cjs'));

async function main() {
  if (!fs.existsSync(BEFORE)) {
    console.log('  the BEFORE engine is gone from prototypes/ — there is nothing to compare.');
    console.log('  (this is the expected state once the prototypes leave the tree)');
    return 0;
  }
  const engines = {
    before: require(BEFORE).generate,
    after: require(path.join(SKILL, 'engine', 'generate.cjs')).generate,
  };
  const withBytes = process.argv.includes('--bytes');
  const models = fs.readdirSync(path.join(WORKBENCH, 'models')).filter(f => f.endsWith('.json')).sort();

  console.log('\n  the same model through both engines — report from the #18 validator\n');
  const L = withBytes ? 32 : 26;
  console.log('  ' + 'model'.padEnd(30) + 'before'.padEnd(L) + 'after');
  console.log('  ' + '─'.repeat(30 + 2 * L));

  let semanticsChanged = 0, failureCountChanged = 0, didNotGenerate = 0;
  for (const file of models) {
    const m = JSON.parse(fs.readFileSync(path.join(WORKBENCH, 'models', file), 'utf8'));
    const col = {};
    for (const [label, generate] of Object.entries(engines)) {
      try {
        const r = await generate(JSON.parse(JSON.stringify(m)));
        const l = validateGeometry(r.layoutPlan);
        col[label] = { failure: l.resumo.failure, sem: l.semanticas.map(s => `${s.id}×${s.occurrences.length}`),
          ids: l.falhas.map(f => f.id), bytes: r.xml.length };
      } catch (e) { col[label] = { error: e.message.slice(0, 40) }; }
    }
    const show = c => c.error ? `DID NOT GENERATE (${c.error})`
      : `failure=${String(c.failure).padStart(2)} sem=[${c.sem.join(',') || '—'}]` +
        (withBytes ? ` ${c.bytes}b` : '');
    console.log(`  ${path.basename(file, '.json').padEnd(30)}${show(col.before).padEnd(withBytes ? 32 : 26)}${show(col.after)}`);
    if (col.before.error || col.after.error) didNotGenerate++;
    else {
      if (JSON.stringify(col.before.sem) !== JSON.stringify(col.after.sem)) semanticsChanged++;
      if (col.before.failure !== col.after.failure) {
        failureCountChanged++;
        // WHICH ones changed, always. "The count dropped" with no list is a number
        // nobody can check, and #23 exists precisely because one such number went
        // unchecked.
        const left = col.before.ids.filter(x => !col.after.ids.includes(x));
        const arrived = col.after.ids.filter(x => !col.before.ids.includes(x));
        console.log(`  ${' '.repeat(30)}└ ${left.length ? `left ${left.join(', ')}` : ''}` +
          `${left.length && arrived.length ? ' · ' : ''}${arrived.length ? `arrived ${arrived.join(', ')}` : ''}`);
      }
    }
  }

  console.log(`\n  models whose SEMANTIC failure list changed:  ${semanticsChanged}`);
  console.log(`  models whose failure count changed:          ${failureCountChanged}`);
  if (didNotGenerate) console.log(`  models one of the engines did not generate:  ${didNotGenerate}`);
  console.log('\n  How to read it: a semantic failure is the drawing LYING (zero tolerance). A change');
  console.log('  in the total count is an #18 finding about the new scale, not a regression —');
  console.log('  `check-good.cjs` separates the two axes.\n');
  return 0;
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
