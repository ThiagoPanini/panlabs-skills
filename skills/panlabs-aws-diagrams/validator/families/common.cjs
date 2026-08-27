'use strict';
/**
 * The result contract, shared by the eight families.
 *
 * Every check returns the same object, and the object has five possible
 * states. The last two exist because silence is how a validator fails: a
 * check that doesn't run and says nothing is indistinguishable from one that
 * ran and passed, and the report turns green for having never looked.
 *
 *   ok            measured and passed
 *   warning       measured and went past the threshold, without blocking
 *   failure       measured and failed
 *   notApplicable there was nothing to measure in THIS diagram (zero edges,
 *                 zero groups). This is information: A5.1 "not applicable" on
 *                 a drawing with no edges is different from A5.1 "ok"
 *   skipped       not the validator's job. It's render's, and the index says why
 *
 * `measured` always carries the number, even when it passes. The rubric asks
 * for a reported metric on twelve checks (B9 is explicit: "don't build a
 * single score, report each metric separately"), and a validator that only
 * speaks when it fails has nothing to report on the day someone asks whether
 * things got better.
 */

const path = require('path');
const { byId } = require(path.join(__dirname, '..', 'index.cjs'));

/** Builds the result, inheriting from the index what is already declared there. */
function outcome(id, state, extra = {}) {
  const c = byId(id);
  if (!c) throw new Error(`check "${id}" is not in the index`);
  return {
    id, name: c.name, family: c.family, input: c.input,
    maxSeverity: c.severity, semantica: !!c.semantica, calibratable: !!c.calibratable,
    state,
    message: extra.message || '',
    measured: extra.measured === undefined ? null : extra.measured,
    occurrences: extra.occurrences || [],
  };
}

const ok = (id, extra) => outcome(id, 'ok', extra);
const warning = (id, extra) => outcome(id, 'warning', extra);
const failure = (id, extra) => outcome(id, 'failure', extra);
const notApplicable = (id, reason) => outcome(id, 'notApplicable', { message: reason });

/** Skipped checks inherit their reason from the index — there is no second place where it could diverge. */
function skipped(id) {
  const c = byId(id);
  return outcome(id, 'skipped', { message: c.porqueRender || 'not the validator\'s job' });
}

/**
 * Closes the check based on what was found: nothing → ok, findings → the
 * severity the index declared. Scales when the check has both levels.
 */
function matches(id, occurrences, extra = {}) {
  if (!occurrences.length) return ok(id, extra);
  return outcome(id, byId(id).severity === 'fail' ? 'failure' : 'warning', { ...extra, occurrences });
}

/** Unordered pairs from a list, with no repeats and never paired with itself. */
function* pairs(list) {
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) yield [list[i], list[j]];
}

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const deviation = xs => (xs.length ? Math.sqrt(mean(xs.map(x => (x - mean(xs)) ** 2))) : 0);
const roundTo = (x, n = 3) => Number(Number(x).toFixed(n));

/** Label text without the HTML markup the engine injects (`<b>1.</b> ...`). */
const withoutTags = s => String(s || '').replace(/<[^>]+>/g, '').trim();

/**
 * How an element is cited in a message: the id, plus the label when it exists.
 *
 * Lives here because an error message is a product, and six copies of the
 * same line is where one of them ends up citing only the id — and then A4.2's
 * occurrence says "srv is inside vpc-b" instead of saying which service it is.
 */
const name = e => `${e.id}${withoutTags(e.label) ? ` ("${withoutTags(e.label)}")` : ''}`;

module.exports = { outcome, ok, warning, failure, notApplicable, skipped, matches, pairs, mean, deviation, roundTo, withoutTags, name };
