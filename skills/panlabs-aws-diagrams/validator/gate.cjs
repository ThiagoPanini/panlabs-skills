'use strict';
/**
 * The gate — decision 2 of ticket #18, in code rather than prose.
 *
 * `validateGeometry` returns a report and decides nothing; what turns a report
 * into a barrier is this function, and it lives apart for a reason: judging and
 * blocking are different policies. A review report wants the whole report; a
 * publishing pipeline wants to stop. Mixing the two would force one behaviour on
 * everybody.
 *
 * WHERE IT FITS. In the #11 pipeline —
 *
 *     load › VALIDATE › resolve › derive › layout › plan › emit › check
 *                                                  ^^^^^^^^^^
 *                                                  here, between the two
 *
 * — it is the only point where the geometry already exists and the XML does not.
 *
 * ✅ THE GRAFT IS IN PLACE since the #23 consolidation. When #18 closed, the
 * engine was still another ticket's prototype and touching it from outside would
 * have mixed two decision boundaries; the production tree ended that separation.
 *
 * How it enters `engine/generate.cjs`, and why this way:
 *
 *   THE REPORT ALWAYS COMES OUT, in `relatorio.geometria`, and a SEMANTIC
 *   failure becomes a warning even with nobody asking for a gate. A gate that
 *   only exists when someone asks is a gate nobody knows about.
 *
 *   BLOCKING IS OPT-IN (`--gate <level>`, default `none`) — and this is what
 *   this section already said in other words: `truthfulness` is the default of a
 *   PUBLISHING gate. Publishing and drawing are not the same act, and refusing to
 *   draw has its moment.
 *
 * WHAT IT DOES NOT DO. It does not correct, reposition, or ask for a new layout.
 * The reasoning is in `validate-geometry.cjs`: a correction loop driven by the
 * validator is a second optimiser competing with ELK, with no gradient and no
 * objective function, because B9 of the rubric forbids combining the 62 into a
 * score. Correcting is `align.cjs`'s job — it has the levers in hand.
 */

const path = require('path');
const { validateGeometry, format } = require(path.join(__dirname, 'validate-geometry.cjs'));

/**
 * Blocking levels, from loosest to tightest.
 *
 * `truthfulness` is the recommended default for a publishing gate, and it is the
 * only one that separates the two things #18 insists on not confusing: an
 * INCOMPLETE diagram (no legend, no metadata) is still true and may go on the
 * wall; a diagram that LIES about a network boundary may not.
 */
const LEVELS = {
  none: () => false,
  truthfulness: report => report.semanticas.length > 0,
  failure: report => report.falhas.length > 0,
  strict: report => report.falhas.length > 0 || report.avisos.length > 0,
};

/**
 * Measures the plan and, per the level, lets it through or throws.
 *
 * @param {object} layoutPlan           the engine plan, post-`plan`
 * @param {object} [opts]
 * @param {string} [opts.level]         `none` | `truthfulness` | `failure` | `strict`
 * @param {boolean} [opts.block]        shortcut: `true` means level `failure`
 * @param {object} [opts.model]         when the plan does not carry the embedded one
 * @returns {object} the report, when it passes
 * @throws {Error} with `.erros` (readable lines) and `.report`, when it blocks
 */
function gate(layoutPlan, opts = {}) {
  const report = validateGeometry(layoutPlan, opts);
  const level = opts.level || (opts.block ? 'failure' : 'none');
  const blocks = LEVELS[level];
  if (!blocks) throw new Error(`unknown gate level: "${level}" (use ${Object.keys(LEVELS).join(', ')})`);

  // An incomplete report never passes, at any level: if a check that should have
  // run did not, green means nothing — and it is precisely on the day someone
  // breaks a family that the gate must not be lying.
  const incomplete = report.cobertura.naoRodaram.length > 0 || report.resultados.some(r => r.state === 'erro');

  if (!blocks(report) && !incomplete) return report;

  const lines = [];
  if (incomplete) {
    if (report.cobertura.naoRodaram.length)
      lines.push(`checks that did not run: ${report.cobertura.naoRodaram.join(', ')}`);
    for (const r of report.resultados.filter(x => x.state === 'erro')) lines.push(r.mensagem);
  }
  for (const r of [...report.semanticas, ...report.falhas.filter(f => !f.semantica)]) {
    lines.push(`${r.id} ${r.name}${r.semantica ? ' (the drawing asserts what the model denies)' : ''}: ${r.mensagem}`);
    for (const o of r.occurrences.slice(0, 3)) lines.push(`    · ${o.o_que}`);
  }
  if (level === 'strict') for (const r of report.avisos) lines.push(`${r.id} ${r.name}: ${r.mensagem}`);

  const error = new Error(incomplete
    ? 'incomplete geometry report — some check did not run'
    : `geometry rejected at gate "${level}"`);
  error.erros = lines;
  error.report = report;
  throw error;
}

module.exports = { gate, LEVELS, format };
