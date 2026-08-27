#!/usr/bin/env node
'use strict';
/**
 * Bisection on the MODEL, not on the XML.
 *
 * The draw.io headless `UnknownVizError` does not say where it hurts, and
 * bisecting the XML produces files with an orphan parent — which render by
 * accident and lie about the cause. Here every variant goes back through the
 * engine, so every file under test is a file the engine would actually emit.
 *
 *   node tools/bisect-model.cjs models/x.json
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SKILL = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const { generate } = require(path.join(SKILL, 'engine', 'generate.cjs'));

// render.sh stayed in the skill's tools/ (#45) — case.cjs's `--image` depends
// on it at runtime, so it could not move with the rest of the bancada.
const RENDER = path.join(SKILL, 'tools', 'render.sh');

/** Removes a node and everything that depends on it — descendants, edges, bands. */
function prune(model, ids) {
  const target = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of model.nodes)
      if (n.inside && target.has(n.inside) && !target.has(n.id)) { target.add(n.id); changed = true; }
  }
  return {
    ...model,
    nodes: model.nodes.filter(n => !target.has(n.id)),
    edges: (model.edges || []).filter(a => !target.has(a.from) && !target.has(a.to)),
    bands: (model.bands || []).filter(f => f.members.every(m => !target.has(m))),
  };
}

const { binary } = require(path.join(SKILL, 'tools', 'drawio.cjs'));
const DRAWIO = binary(process.argv[3]);
const HAS_APP = fs.existsSync(DRAWIO) && fs.existsSync(RENDER);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bisect-'));

async function test(name, model) {
  const drawio = path.join(TMP, `_bis-${name}.drawio`);
  let r;
  try { r = await generate(model); }
  catch (e) { return { name, state: 'rejected', txt: `${name.padEnd(24)} engine refused: ${e.message}` }; }
  const shape = `(${r.layoutPlan.width}×${r.layoutPlan.height}, ${r.layoutPlan.cells.length} cells)`;
  if (!HAS_APP) {
    // Without the app, the bisection still answers half the question: does the
    // ENGINE accept each cut? Printing "✗ FAILED" here would be the tool blaming
    // the model for a development dependency that does not exist on this machine.
    return { name, state: 'generated', txt: `${name.padEnd(24)} ✓ engine generated  ${shape}  (render skipped — no draw.io)` };
  }
  fs.writeFileSync(drawio, r.xml);
  try {
    execFileSync(RENDER, [drawio, drawio.replace(/\.drawio$/, '.png')], { stdio: 'pipe' });
    fs.unlinkSync(drawio); fs.unlinkSync(drawio.replace(/\.drawio$/, '.png'));
    return { name, state: 'rendered', txt: `${name.padEnd(24)} ✓ rendered   ${shape}` };
  } catch (e) {
    return { name, state: 'failed', txt: `${name.padEnd(24)} ✗ FAILED   ${shape}` };
  }
}

async function main() {
  const model = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const accounts = model.nodes.filter(n => n.kind === 'account').map(n => n.id);

  const cases = [['whole', []], ['without-actor', ['cliente']]];
  for (const c of accounts) cases.push([`without-${c}`, [c]]);
  for (const c of accounts) cases.push([`only-${c}`, accounts.filter(o => o !== c).concat(['cliente'])]);

  const r = [];
  for (const [name, remove] of cases) {
    const t = await test(name, prune(model, remove));
    console.log(t.txt);
    r.push(t);
  }

  /**
   * ⚠️ THE BISECTION EXITS 1 WHEN IT FINDS SOMETHING — and until #23's
   * recertification it always exited 0.
   *
   * While it was a diagnostic tool run by hand, that cost nothing: whoever
   * called it was reading the table. Inside a suite it is another matter — a
   * layer that cannot go red is a green that asserts nothing, and the
   * `render.sh` it calls was not even on the production tree, so EVERY cut
   * "failed" and the suite moved on.
   */
  const bad = r.filter(x => x.state === 'failed' || x.state === 'rejected');
  if (bad.length) {
    console.log(`\n  ✗ ${bad.length} cut(s) did not pass: ${bad.map(x => x.name).join(', ')}`);
    process.exit(1);
  }
  console.log(`\n  ✓ all ${r.length} cuts of the model pass` +
    (HAS_APP ? ' — engine and render' : ' through the engine (render is a development dependency)'));
}

main().catch(e => { console.error(e); process.exit(1); });
