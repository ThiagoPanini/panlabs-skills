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
 *
 * ⚠️ A CUT CAN FAIL FOR TWO REASONS THAT HAVE NOTHING TO DO WITH EACH OTHER,
 * and until #128 both printed the same `✗ FAILED` with nothing after it.
 *
 *   the DRAWING   draw.io read the file and refused it. Reproducible: #128
 *                 measured a malformed file failing 3 times out of 3, exiting
 *                 on its own, saying `Error: Export failed`.
 *   the RENDER    Chromium's compositing process died (`UnknownVizError`),
 *                 draw.io never caught the rejection, and the binary hung.
 *                 Nothing about the file causes it: the same bytes came out as
 *                 a byte-identical PNG 19 times out of 20, and `only-c-a` —
 *                 which is `only-c-b` with different labels and ids, cell for
 *                 cell — passed in the very run where `only-c-b` did not.
 *
 * `render.sh` is the one that can tell them apart, because it knows WHO ended
 * the process; it answers 1 for the first and 4 for the second, and it retries
 * only the second. This file reads that answer, prints what `render.sh` said
 * instead of throwing it away, and names which of the two it is.
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

/**
 * WHAT `render.sh` CAN ANSWER, AND WHAT EACH ANSWER MEANS — in one place.
 *
 * Three facts about an outcome used to sit apart: the exit code, the sentence
 * printed next to the cut, and which summary the cut is counted under. A state
 * added to one had to be remembered in the other two, and forgetting is exactly
 * the shape of defect this ticket is about. `rejected` carries no code because
 * the ENGINE refuses before `render.sh` is ever called; it shares the `drawing`
 * blame all the same. Anything `render.sh` answers that is not in this table is
 * a surprise, and is reported as one rather than guessed into a bucket.
 */
const ANSWERS = {
  rejected:   { blame: 'drawing' },
  refused:    { blame: 'drawing', code: 1, line: '✗ THE DRAWING WAS REFUSED' },
  unanswered: { blame: 'render',  code: 4, line: '✗ THE RENDER NEVER ANSWERED' },
};
const stateFor = code => Object.keys(ANSWERS).find(s => ANSWERS[s].code === code) || 'unknown';
const blamed = (results, blame) => results.filter(x => (ANSWERS[x.state] || {}).blame === blame);

/**
 * The sentence `render.sh` prints when a retry is what saved the render.
 *
 * ⚠️ TWO ENDS, AND THE OTHER ONE IS `render.sh`. `tests/check-render-verdict.cjs`
 * reads THIS literal out of THIS file and requires `render.sh` to still print
 * something it matches — so a reword over there goes red here instead of
 * silently retiring the warning.
 */
const FLAKED = /did not answer/;

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

/** One column for everything `render.sh` said, whatever indentation it chose. */
const indent = txt => txt.trim().split('\n').map(l => `     ${l.trim()}`).join('\n');

async function test(name, model) {
  const drawio = path.join(TMP, `_bis-${name}.drawio`);
  const png = drawio.replace(/\.drawio$/, '.png');
  let r;
  try { r = await generate(model); }
  catch (e) { return { name, state: 'rejected', txt: `${name.padEnd(24)} engine refused: ${e.message}` }; }
  // ⚠️ This number comes from the LAYOUT PLAN, so it is the same on the line
  // that rendered and on the line that did not — it says what the engine drew,
  // never that a PNG came out. The #128 report read a `(900×543, 9 cells)` on a
  // failing line as proof the cut had rendered; the word `plan` is here so the
  // next reader does not have to make that inference at all.
  const plan = `plan ${r.layoutPlan.width}×${r.layoutPlan.height}, ${r.layoutPlan.cells.length} cells`;
  if (!HAS_APP) {
    // Without the app, the bisection still answers half the question: does the
    // ENGINE accept each cut? Printing "✗ FAILED" here would be the tool blaming
    // the model for a development dependency that does not exist on this machine.
    return { name, state: 'generated', txt: `${name.padEnd(24)} ✓ engine generated  ${plan}  (render skipped — no draw.io)` };
  }
  fs.writeFileSync(drawio, r.xml);
  try {
    // ⚠️ THE BINARY THIS FILE CHOSE, HANDED TO THE SCRIPT THAT RUNS IT.
    //
    // Without this, the argument on the command line decided only WHETHER to
    // render — `render.sh` then rendered with whatever `$DRAWIO` or the
    // installed default happened to be, so `bisect-model.cjs model /some/binary`
    // reported on a binary nobody asked for. It is the same divergence
    // `tools/drawio.cjs` was written to end, one call site further along, and it
    // surfaced in #128 the moment a stub binary was pointed at this tool and
    // every cut came back green.
    const out = execFileSync(RENDER, [drawio, png], { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, DRAWIO } });
    // `render.sh` says so when a retry is what saved the render — a flake that
    // is swallowed is a flake nobody ever fixes.
    const flaked = FLAKED.test(out);
    return {
      name, state: 'rendered', flaked,
      txt: `${name.padEnd(24)} ✓ rendered   ${plan}` + (flaked ? `\n${indent(out)}` : ''),
    };
  } catch (e) {
    const log = `${e.stdout || ''}${e.stderr || ''}`.trim() || `render.sh exited ${e.status} and said nothing`;
    const state = stateFor(e.status);
    const line = (ANSWERS[state] || {}).line || `✗ render.sh exited ${e.status} — a code this tool does not know`;
    return { name, state, txt: `${name.padEnd(24)} ${line}   ${plan}\n${indent(log)}` };
  } finally {
    fs.rmSync(drawio, { force: true }); fs.rmSync(png, { force: true });
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
   *
   * ⚠️ AND IT STILL EXITS 1 FOR BOTH KINDS, on purpose (#128). A cut that hung
   * on every one of `render.sh`'s attempts is no longer the 1-in-20 flake that
   * made this layer red one run in three — it is a machine that is genuinely
   * down, and a suite should stop for that. What #128 bought is not silence,
   * it is the SENTENCE: the reds now say whether to go read the model or to go
   * look at the machine.
   */
  const flaked = r.filter(x => x.flaked);
  const drawing = blamed(r, 'drawing');
  const machine = blamed(r, 'render');
  // A code `render.sh` does not document gets its own sentence rather than being
  // folded into one of the two above. Reachable today by pointing this tool at a
  // path that exists but is not executable (`HAS_APP` tests existence, `render.sh`
  // tests the execute bit and answers 3), and tomorrow by `render.sh` growing an
  // outcome this file was never taught. Guessing which bucket it belongs in would
  // be the tool inventing a verdict, which is the habit #128 is here to break.
  const strange = r.filter(x => x.state === 'unknown');

  if (flaked.length)
    console.log(`\n  ⚠ draw.io hung on ${flaked.length} cut(s) and render.sh got them on a later attempt: ` +
      `${flaked.map(x => x.name).join(', ')}\n    the binary, not the drawing — same bytes, and they came out (#128).`);

  if (drawing.length)
    console.log(`\n  ✗ THE DRAWING — ${drawing.length} cut(s) the engine or draw.io refused: ${drawing.map(x => x.name).join(', ')}`);

  if (machine.length)
    console.log(`\n  ✗ THE RENDER — ${machine.length} cut(s) never came out: ${machine.map(x => x.name).join(', ')}` +
      `\n    on every attempt something other than draw.io chose the exit code — a deadline, a signal, a missing xvfb-run.` +
      `\n    Go look at this machine — leftovers, memory, display, another session rendering — not at the model.` +
      `\n    tools/clean-render.sh is what sweeps a saturated one; pgrep -f "drawio|Xvfb" is what finds a neighbour.`);

  if (strange.length)
    console.log(`\n  ✗ render.sh answered with a code this tool does not know, on: ${strange.map(x => x.name).join(', ')}` +
      `\n    each line above carries the code it gave. Either render.sh grew an outcome, or it is not the file this tool thinks it is.`);

  if (drawing.length || machine.length || strange.length) process.exit(1);

  console.log(`\n  ✓ all ${r.length} cuts of the model pass` +
    (HAS_APP ? ' — engine and render' : ' through the engine (render is a development dependency)'));
}

main().catch(e => { console.error(e); process.exit(1); });
