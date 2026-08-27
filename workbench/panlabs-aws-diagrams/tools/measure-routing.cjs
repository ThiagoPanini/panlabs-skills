#!/usr/bin/env node
'use strict';
/**
 * THE FULL REPORT OF THE WHOLE CORPUS, in a shape `diff` knows how to read.
 *
 *   node tools/measure-routing.cjs > before.txt
 *   ...touch the engine...
 *   node tools/measure-routing.cjs > after.txt
 *   diff before.txt after.txt
 *
 * #24 asks for something no tool here gave: *"no check traded for another — the
 * full report, before and after"*. `check-geometry.cjs` shows only what failed,
 * and `check-good.cjs` counts by state; in both, a check moving from `ok` to
 * `warning` vanishes from the report. #12 already paid for that once: it halved
 * `A5.5` and bought a label collision, and the number of the trade only surfaced
 * when someone checked by hand.
 *
 * Here EVERY check comes out, on EVERY page, with its occurrence count — one line
 * per check, sorted, with no timestamp and no absolute path. The `diff` is what
 * becomes the before/after report, and it has no way to hide a trade.
 *
 * The two session VIEWS join the corpus on purpose: the technical view from #14
 * is the artifact that failed human inspection, and it is none of the
 * `models/*.json` — it is born from `retail-logical` + `retail-elaboration` going
 * through the projection. Measuring the corpus alone would leave out exactly the
 * drawing the ticket exists to fix.
 */

const fs = require('fs');
const path = require('path');

const WORKBENCH = path.join(__dirname, '..');
const SKILL = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const { generate } = require(path.join(SKILL, 'engine', 'generate.cjs'));
const { validateGeometry } = require(path.join(SKILL, 'validator', 'validate-geometry.cjs'));
const { approve } = require(path.join(SKILL, 'session', 'agreement.cjs'));
const { elaborate } = require(path.join(SKILL, 'session', 'elaborate.cjs'));
const { project } = require(path.join(SKILL, 'session', 'project.cjs'));

/** The technical model of the #14 session, without going through any file. */
function sessionModels() {
  // retail-logical/retail-elaboration are the skill's own minimal examples
  // (#44) — not part of the workbench corpus.
  const read = f => JSON.parse(fs.readFileSync(path.join(SKILL, 'examples', 'session', f), 'utf8'));
  const approved = approve(read('retail-logical.json'), { at: '2026-08-21', by: 'user', candidate: 'cand-a' });
  const technical = elaborate(approved, read('retail-elaboration.json'));
  return [
    { name: 'session:retail/logical', model: project(technical, 'logical').model },
    { name: 'session:retail/technical', model: project(technical, 'technical').model },
  ];
}

function inputs() {
  const dir = path.join(WORKBENCH, 'models');
  const corpus = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => ({ name: path.basename(f, '.json'), model: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
  return [...corpus, ...sessionModels()];
}

const SYMBOL = { ok: 'ok   ', warning: 'WARN ', failure: 'FAIL ', notApplicable: 'n/a  ', skipped: 'render', error: 'ERROR' };

async function main() {
  const targetOnly = process.argv.includes('--target');
  const TARGET = ['A5.5', 'A3.5', 'A3.4', 'A5.1', 'A4.2', 'A4.4', 'A3.2'];
  let totalSemantic = 0, totalFailure = 0;

  for (const { name, model } of inputs()) {
    let r;
    try {
      r = await generate(model);
    } catch (e) {
      console.log(`${name} :: DID NOT GENERATE :: ${e.message}`);
      for (const l of e.erros || []) console.log(`${name} ::   · ${l}`);
      continue;
    }
    console.log(`${name} :: path=${r.caminho} pages=${1 + r.pages.length}`);
    for (const p of [r.layoutPlan, ...r.pages]) {
      const report = validateGeometry(p);
      const page = p.id || '(no id)';
      totalSemantic += report.semanticas.length;
      totalFailure += report.falhas.length;
      const lines = [...report.resultados, ...report.extras]
        .filter(x => !targetOnly || TARGET.includes(x.id))
        .map(x => `${name}/${page} :: ${x.id.padEnd(5)} ${SYMBOL[x.state] || x.state} ` +
          `${String(x.occurrences.length).padStart(3)}oc${x.semantica && x.state === 'failure' ? ' SEMANTIC' : ''}`)
        .sort();
      for (const l of lines) console.log(l);
      if (report.cobertura.naoRodaram.length)
        console.log(`${name}/${page} :: DID NOT RUN ${report.cobertura.naoRodaram.join(',')}`);
    }
  }
  console.log(`TOTAL :: failures=${totalFailure} semantics=${totalSemantic}`);
}

main().catch(e => { console.error(e); process.exit(1); });
