'use strict';
/**
 * The geometry validator — the facade.
 *
 *   const { validateGeometry } = require('./validator/validate-geometry.cjs');
 *   const r = validateGeometry(layoutPlan);
 *   if (!r.ok) console.error(r.falhas.map(f => f.mensagem));
 *
 * The order of the families is the one from the rubric's §Implementation priority
 * summary — A3+A4, A1, A5, A7, A2, A6, A8 — and it is not decorative: whoever
 * reads the report top to bottom meets the hard, semantically grave failures
 * first, and only then the fine tuning of a soft threshold.
 *
 * ------------------------------------------------------------------------
 * The function is PURE, and that is decision 2 of ticket #18
 * ------------------------------------------------------------------------
 *
 * The validator is a GATE, not an optimiser. It runs after `plan` and before
 * `emit` — the only point of the pipeline where the geometry already exists and
 * the XML does not — and returns a report. It repositions nothing.
 *
 * The temptation is the opposite: overlap detected, tell the layout to try again
 * with other parameters. Against that there is an argument and a precedent.
 *
 *   The argument: a correction loop driven by the validator is a SECOND
 *   optimiser, competing with ELK, with no gradient and no objective function.
 *   The 62 checks do not form a minimisable target — B9 of the rubric is explicit
 *   in forbidding their combination into a single score, and with no slope there
 *   is nothing to descend. Such a loop either does not converge, or converges to
 *   whatever the last check happened to push.
 *
 *   The precedent: the engine ALREADY corrects, and in the right place.
 *   `align.cjs` does `hasOverlap` → `refit` → `reroute` and UNDOES the pass when
 *   it makes things worse. That works because it happens inside the step that has
 *   the parameters in hand and knows what it is trading. The validator has
 *   neither: it sees the result, not the levers.
 *
 * So the division is: correcting belongs to `layout`/`align`, with the local
 * knowledge; judging belongs to this module, with no write power. If a check
 * fails systematically, the fix is to teach the lever to the step that holds it —
 * not to give layout power to the one that only knows how to measure.
 */

const path = require('path');
const { createScene } = require(path.join(__dirname, 'scene.cjs'));
const { CHECKS, FROM_VALIDATOR, byId } = require(path.join(__dirname, 'index.cjs'));

// The order is the rubric's §Priority summary, not the alphabetical one.
const FAMILIES = [
  ['A3', require(path.join(__dirname, 'families', 'a3-overlap.cjs'))],
  ['A4', require(path.join(__dirname, 'families', 'a4-grouping.cjs'))],
  ['A1', require(path.join(__dirname, 'families', 'a1-completeness.cjs'))],
  ['A5', require(path.join(__dirname, 'families', 'a5-edges.cjs'))],
  ['A7', require(path.join(__dirname, 'families', 'a7-accessibility.cjs'))],
  ['A2', require(path.join(__dirname, 'families', 'a2-notation.cjs'))],
  ['A6', require(path.join(__dirname, 'families', 'a6-distribution.cjs'))],
  ['A8', require(path.join(__dirname, 'families', 'a8-volume.cjs'))],
];
const extras = require(path.join(__dirname, 'families', 'extras.cjs'));

/**
 * @param {object} layoutPlan   the engine plan (post-`plan`, pre-`emit`)
 * @param {object} [opts]       `{ model }` when the plan does not carry the embedded one
 * @returns {{ok, falhas, avisos, resultados, extras, resumo, scene, cobertura}}
 */
function validateGeometry(layoutPlan, opts = {}) {
  const scene = createScene(layoutPlan, opts);

  const resultados = [];
  for (const [family, run] of FAMILIES) {
    let got;
    try {
      got = run(scene);
    } catch (e) {
      // A family that blows up must not take the other seven down, and much less
      // go silent: the error becomes a reported failure, carrying the family id.
      got = [{
        id: family, name: `family ${family}`, family, input: 'geometry',
        severidadeMaxima: 'fail', semantica: false, calibravel: false,
        state: 'erro', mensagem: `family ${family} blew up: ${e.message}`,
        measured: { pilha: String(e.stack || '').split('\n').slice(0, 3) }, occurrences: [],
      }];
    }
    resultados.push(...got);
  }

  const fromValidator = FROM_VALIDATOR.map(c => c.id);
  const seen = new Set(resultados.map(r => r.id));
  const naoRodaram = fromValidator.filter(id => !seen.has(id));

  const extraFindings = extras(scene);

  const falhas = [...resultados, ...extraFindings].filter(r => r.state === 'failure' || r.state === 'erro');
  const avisos = [...resultados, ...extraFindings].filter(r => r.state === 'warning');
  const semanticas = falhas.filter(r => r.semantica);

  const count = state => resultados.filter(r => r.state === state).length;
  const resumo = {
    total: resultados.length,
    ok: count('ok'),
    warning: count('warning'),
    failure: count('failure'),
    notApplicable: count('notApplicable'),
    skipped: count('skipped'),
    erro: count('erro'),
    falhas_semanticas: semanticas.length,
    occurrences: [...resultados, ...extraFindings].reduce((s, r) => s + r.occurrences.length, 0),
  };

  return {
    // A check that should have run and did not fails the whole report: an
    // incomplete report calling itself green is worse than a red one.
    ok: falhas.length === 0 && naoRodaram.length === 0,
    falhas, avisos, semanticas,
    resultados, extras: extraFindings, resumo, scene,
    cobertura: { esperadas: fromValidator.length, rodaram: fromValidator.length - naoRodaram.length, naoRodaram },
  };
}

const SYMBOL = { ok: '✓', warning: '⚠', failure: '✗', notApplicable: '·', skipped: '↷', erro: '‼' };

/** The report as text. `opts.all` also shows what passed. */
function format(r, opts = {}) {
  const lines = [];
  const show = x => opts.all || ['failure', 'warning', 'erro'].includes(x.state);

  let currentFamily = null;
  for (const x of [...r.resultados, ...r.extras]) {
    if (!show(x)) continue;
    if (x.family !== currentFamily) { lines.push(''); currentFamily = x.family; }
    const mark = x.semantica && x.state === 'failure' ? '  ← semantic failure' : '';
    lines.push(`  ${SYMBOL[x.state] || '?'} ${x.id.padEnd(5)} ${x.name}${mark}`);
    if (x.mensagem) lines.push(`        ${x.mensagem}`);
    for (const o of x.occurrences.slice(0, opts.occurrences || 5)) lines.push(`        · ${o.o_que}`);
    if (x.occurrences.length > (opts.occurrences || 5))
      lines.push(`        · … and ${x.occurrences.length - (opts.occurrences || 5)} more`);
  }

  const s = r.resumo;
  lines.push('');
  lines.push(`  ${s.total} checks: ${s.ok} ok · ${s.warning} warning · ${s.failure} failure · ` +
    `${s.notApplicable} not applicable · ${s.skipped} from render${s.erro ? ` · ${s.erro} error` : ''}`);
  if (r.cobertura.naoRodaram.length)
    lines.push(`  ‼ ${r.cobertura.naoRodaram.length} validator check(s) did not run: ${r.cobertura.naoRodaram.join(', ')}`);
  if (s.falhas_semanticas)
    lines.push(`  ✗ ${s.falhas_semanticas} SEMANTIC failure(s) — the drawing asserts what the model denies`);
  return lines.join('\n');
}

module.exports = { validateGeometry, format, byId };
