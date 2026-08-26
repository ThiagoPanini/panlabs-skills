#!/usr/bin/env node
'use strict';
/**
 * The geometric validator, from the command line.
 *
 *   node tools/check-geometry.cjs <model.json> [...]    validates what the engine generates
 *   node tools/check-geometry.cjs --examples             validates the shipped examples/
 *   node tools/check-geometry.cjs ... --all             also shows what passed
 *   node tools/check-geometry.cjs ... --json             report in JSON
 *   node tools/check-geometry.cjs ... --strict           warning fails too
 *   node tools/check-geometry.cjs ... --theme <name>     evaluates with this theme (default: light)
 *
 * The exit code is 1 when there is a failure — that is what lets this hang off a
 * CI gate. With `--strict`, a warning counts as a failure.
 *
 * WITHOUT `--theme`, the report always evaluated the default theme — and is
 * blind to what only another theme turns on (#33), such as `texto.qualificador`.
 * `--theme` exists so the report can see the same thing `--theme` turns on in
 * `engine/generate.cjs`.
 *
 * The input is a MODEL, not a `.drawio`: the validator reads the `layoutPlan`,
 * which is the engine's internal seam (post-plan, pre-emit), and that is where
 * the geometry exists as an object. Reparsing the XML would mean reconstructing
 * what the engine just had in hand — and reconstructing it badly, because the
 * `.drawio` has already lost the distinction between group and band that the
 * scene needs.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { validateGeometry, format } = require(path.join(__dirname, '..', 'validator', 'validate-geometry.cjs'));

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const json = args.includes('--json');
  const strict = args.includes('--strict');
  const examples = args.includes('--examples');
  const iTheme = args.indexOf('--theme');
  const themeName = iTheme >= 0 ? args[iTheme + 1] : 'light';
  let inputs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--theme');

  if (examples) inputs = fs.readdirSync(path.join(ROOT, 'examples')).filter(f => f.endsWith('.json')).map(f => path.join(ROOT, 'examples', f));
  if (!inputs.length) {
    console.error('usage: node check-geometry.cjs <model.json> [...] | --examples  [--all] [--json] [--strict] [--theme <name>]');
    process.exit(2);
  }

  let generate;
  try { ({ generate } = require(path.join(ROOT, 'engine', 'generate.cjs'))); }
  catch (error) {
    console.error(`could not load the engine at ${ROOT}: ${error.message}`);
    process.exit(2);
  }

  const reports = [];
  let bad = 0;

  for (const input of inputs) {
    const name = path.basename(input, '.json');
    let r;
    try {
      r = await generate(JSON.parse(fs.readFileSync(input, 'utf8')), { tema: themeName });
    } catch (error) {
      console.error(`\n✗ ${name}: the engine did not generate — ${error.message}`);
      for (const row of error.erros || []) console.error(`    · ${row}`);
      bad++;
      continue;
    }

    const report = validateGeometry(r.layoutPlan);
    const failed = report.falhas.length > 0 || (strict && report.avisos.length > 0);
    if (failed || report.cobertura.naoRodaram.length) bad++;

    if (json) {
      reports.push({
        diagram: name, path: r.caminho, ok: report.ok, summary: report.resumo,
        coverage: report.cobertura,
        checks: [...report.resultados, ...report.extras].map(x => ({
          id: x.id, name: x.name, state: x.state, semantic: x.semantica,
          message: x.mensagem, measured: x.measured,
          occurrences: x.occurrences.map(o => o.o_que),
        })),
      });
      continue;
    }

    console.log(`\n${'='.repeat(72)}\n${name}  (path "${r.caminho}", ${r.layoutPlan.cells.length} cells)\n${'='.repeat(72)}`);
    console.log(format(report, { all }));
  }

  if (json) console.log(JSON.stringify(reports, null, 2));
  else {
    console.log('');
    console.log(bad ? `✗ ${bad}/${inputs.length} diagram(s) with failure` : `✓ ${inputs.length} diagram(s) with no failure`);
  }
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
