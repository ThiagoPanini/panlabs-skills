'use strict';
/**
 * The stitch between the session layer and the engine.
 *
 * It is four lines of code and they are the proof of ticket #14:
 *
 *   project  ->  generate (the engine, not knowing two views exist)  ->  seal
 *
 * The engine receives a `model@1` of ONE view and does not know two exist. It
 * never needed to: the difference between the views was settled before it was
 * called — and that stayed true after the engine grew with #12, #13 and #22,
 * which is the real test of the thesis. `tests/check-engine-untouched.cjs`
 * freezes the bytes of the PRODUCTION engine so that the next change to it is a
 * deliberate one.
 *
 * ⚠️ What CHANGED in the #23 recertification: `generate` may return 1+N pages
 * (the consolidated one plus one per account, `D2` of #6). `seal` seals them all.
 */

const path = require('path');
const { project } = require('./project.cjs');
const { sealInto } = require('./save.cjs');
const { dossierWarning } = require('./publish.cjs');

const { generate } = require(path.join(__dirname, '..', 'engine', 'generate.cjs'));

async function draw(session, view, opts = {}) {
  const { model, trail } = project(session, view);
  const r = await generate(model, opts);
  const xml = sealInto(r.xml, session, view, { engine: opts.engine });
  // A one-line warning, in the style of #16: it warns, never blocks, and names
  // the way out. It goes into the report and not to stdout because printing is
  // the CLI's job.
  const warning = dossierWarning(session);
  if (warning) r.report.warnings.push(warning);
  return { xml, model, trail, report: r.report, path: r.path, theme: r.theme };
}

module.exports = { draw };
