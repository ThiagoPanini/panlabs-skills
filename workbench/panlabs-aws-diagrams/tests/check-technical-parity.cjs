#!/usr/bin/env node
'use strict';
/**
 * Leaf-field parity between `model@1.no`, `session@1`'s technical facet, and
 * the list that projects one onto the other — #37.
 *
 * `qualifier`, `ou`, and `habilita` existed in `model@1` and not in
 * `session@1` until #29 (see `session/project.cjs`, TECHNICAL_FIELDS):
 * whoever wrote `model@1` directly had all three; whoever went through the
 * TWO-VIEW ARC — SKILL.md's main path — lost all three, with no error at
 * all. Nothing mechanical stopped the next divergence from happening the
 * same way: a field is born in one contract and someone forgets the other,
 * and the oversight raises no alarm because `additionalProperties:false`
 * only complains about an EXTRA field, never a MISSING one.
 *
 * TWO parities, not one — because #29's incident had TWO ways to happen, and
 * one schema matching the other only proves the first:
 *
 *   1. the two SCHEMAS diverge (`model@1.no` × `session@1.technicalFacet`);
 *   2. the schemas MATCH, but `session/project.cjs` forgets to forward a
 *      field from the facet to the projected `model@1` — the field exists in
 *      both contracts and still doesn't cross the two-view arc, because
 *      `TECHNICAL_FIELDS` is a hand-written list that can disagree with the
 *      schemas the same way it once did.
 *
 * The distinction isn't hypothetical: running section 1 for the first time,
 * it found `layer` (#22) missing from `technicalFacet`. Fixed only there,
 * section 1 would go green again and section 2 would stay red until `layer`
 * also entered `TECHNICAL_FIELDS` — section 1 alone would never have caught
 * that second half, because it only compares schema against schema.
 *
 * Both comparisons come from the real files — no hand-copied list. `id` and
 * `inside` are left out of the schema parity by construction: in `session@1`
 * both live on the `node` that WRAPS the facet, not inside it — it's not a
 * lost field, it's a field that moved a level. `kind` and `label` are left
 * out of the projection parity for the same reason, one level down:
 * `project.cjs` copies them straight through, before the `TECHNICAL_FIELDS`
 * loop — not being on the list isn't a bug, it's the list not being where
 * they belong.
 *
 * `INFORMATIONAL_FIELDS` (#169) is a third, narrower exclusion from the
 * projection parity only: a field can be declared in both schemas for the
 * author to read and still be crossed by nothing on purpose, like `cidr`
 * after #169 — the schemas keep the field, `project.cjs` stops forwarding
 * it. Without this exclusion, retiring a field's projection this way would
 * be the exact loss section 2 exists to catch; with it, the exclusion is
 * read from `project.cjs` itself, so declaring a field informational and
 * forgetting to also drop it from `TECHNICAL_FIELDS` still fails loudly.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');

const STRUCTURAL = new Set(['id', 'inside']);
const COPIED_VERBATIM = new Set(['kind', 'label']);

/**
 * Symmetric difference between two sets of properties, minus the `excluded`
 * ones. A pure function — no fs here — so it can run twice: once against the
 * real files, once against a mutilated copy (the proof that it knows how to
 * fail).
 */
function divergences(propsA, propsB, excluded = STRUCTURAL) {
  const a = new Set(propsA);
  const b = new Set(propsB);
  const onlyInA = [...a].filter(p => !b.has(p) && !excluded.has(p));
  const onlyInB = [...b].filter(p => !a.has(p) && !excluded.has(p));
  return { onlyInA: onlyInA.sort(), onlyInB: onlyInB.sort() };
}

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

const { TECHNICAL_FIELDS, INFORMATIONAL_FIELDS } = require(path.join(ROOT, 'session', 'project.cjs'));

const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema.json'), 'utf8'));
const session = JSON.parse(fs.readFileSync(path.join(ROOT, 'session', 'schema.json'), 'utf8'));

const nodeProps = Object.keys(model.definitions.node.properties);
const facetProps = Object.keys(session.definitions.technicalFacet.properties);

console.log('\n1 · the two SCHEMAS — model@1.no against session@1.technicalFacet\n');
console.log(`  fields of model@1.no:                ${nodeProps.length}  (${nodeProps.slice().sort().join(', ')})`);
console.log(`  fields of session@1.technicalFacet:   ${facetProps.length}  (${facetProps.slice().sort().join(', ')})`);
console.log(`  structural, left out by construction: ${[...STRUCTURAL].join(', ')}`);

const schemaDiff = divergences(nodeProps, facetProps);
ok(schemaDiff.onlyInA.length === 0,
  'no field of model@1.no was left out of technicalFacet',
  schemaDiff.onlyInA.length ? schemaDiff.onlyInA.join(', ') : 'none');
ok(schemaDiff.onlyInB.length === 0,
  'no field of technicalFacet was left out of model@1.no',
  schemaDiff.onlyInB.length ? schemaDiff.onlyInB.join(', ') : 'none');

console.log('\n2 · the schema against whoever actually PROJECTS — technicalFacet × TECHNICAL_FIELDS\n');
console.log(`  TECHNICAL_FIELDS (project.cjs):      ${TECHNICAL_FIELDS.length}  (${TECHNICAL_FIELDS.slice().sort().join(', ')})`);
console.log(`  copied straight through, off the list: ${[...COPIED_VERBATIM].join(', ')}`);
console.log(`  informational, crossed by nothing:     ${INFORMATIONAL_FIELDS.join(', ')}`);

const PROJECTION_EXCLUDED = new Set([...COPIED_VERBATIM, ...INFORMATIONAL_FIELDS]);
const projectionDiff = divergences(facetProps, TECHNICAL_FIELDS, PROJECTION_EXCLUDED);
ok(projectionDiff.onlyInA.length === 0,
  'every field of technicalFacet (besides kind/label) is in TECHNICAL_FIELDS — it crosses the projection',
  projectionDiff.onlyInA.length ? projectionDiff.onlyInA.join(', ') : 'none');
ok(projectionDiff.onlyInB.length === 0,
  'TECHNICAL_FIELDS has no entry that technicalFacet does not declare',
  projectionDiff.onlyInB.length ? projectionDiff.onlyInB.join(', ') : 'none');

// ---------------------------------------------------------------------------
// 3 · the control proof — the check MUST flag it when a field is missing
//
// Same format as #11's control experiment (check-boundary) and #14's
// (check-projection): without this, a `divergences()` that always returns
// empty would be green by vacuity, and #17 already paid that lesson once.
// Proven once on schema parity, the same pure function holds for projection
// parity too — the behavior under test is `divergences()`, not which pair of
// lists it receives.
console.log('\n3 · control proof — remove a field from one side, it flags it\n');

const withoutQualifier = facetProps.filter(p => p !== 'qualifier');
const lossDetected = divergences(nodeProps, withoutQualifier);
ok(lossDetected.onlyInA.includes('qualifier'),
  'CONTROL: removing "qualifier" from the simulated facet, schema parity flags it',
  lossDetected.onlyInA.join(', '));

const withOrphanField = [...facetProps, 'invented'];
const orphanDetected = divergences(nodeProps, withOrphanField);
ok(orphanDetected.onlyInB.includes('invented'),
  'CONTROL: adding "invented" only to the simulated facet, schema parity flags it',
  orphanDetected.onlyInB.join(', '));

// and the structural field excluded on purpose can't fire on its own —
// otherwise "left out by construction" would be decoration, not behavior.
// The comparison is against the result ALREADY CHECKED above, not against
// zero: isolate exactly what excluding "inside" changes, without depending
// on the real corpus being free of other divergences at the moment this runs.
const withoutInsideInModel = nodeProps.filter(p => p !== 'inside');
const structuralControl = divergences(withoutInsideInModel, facetProps);
ok(!structuralControl.onlyInA.includes('inside') && !structuralControl.onlyInB.includes('inside') &&
   structuralControl.onlyInA.length === schemaDiff.onlyInA.length &&
   structuralControl.onlyInB.length === schemaDiff.onlyInB.length,
  'CONTROL: removing a STRUCTURAL field (inside) sounds no alarm beyond what was already there');

// the same proof, on the PROJECTION side: removing "layer" from
// TECHNICAL_FIELDS has to be flagged — it's the exact incident section 2
// exists to never again let through in silence.
const withoutLayerInList = TECHNICAL_FIELDS.filter(c => c !== 'layer');
const lossInProjection = divergences(facetProps, withoutLayerInList, PROJECTION_EXCLUDED);
ok(lossInProjection.onlyInA.includes('layer'),
  'CONTROL: removing "layer" from the simulated TECHNICAL_FIELDS, projection parity flags it',
  lossInProjection.onlyInA.join(', '));

// and the INFORMATIONAL excuse (#169) has to matter, the mirror image of the
// structural control above: drop it, and the field it excuses (declared in
// the schema, absent from TECHNICAL_FIELDS on purpose) gets flagged exactly
// like a genuinely lost field would.
const withoutInformationalExcuse = divergences(facetProps, TECHNICAL_FIELDS, COPIED_VERBATIM);
ok(INFORMATIONAL_FIELDS.every(f => withoutInformationalExcuse.onlyInA.includes(f)),
  'CONTROL: without the informational excuse, an excused field is flagged exactly like a lost one',
  withoutInformationalExcuse.onlyInA.join(', '));

console.log(failures
  ? `\n  ✗ ${failures} failure(s) — model@1, session@1's technical facet, and/or TECHNICAL_FIELDS diverge on a leaf field.\n`
  : "\n  ✓ model@1.no, session@1.technicalFacet, and TECHNICAL_FIELDS share the same leaf vocabulary, end to end.\n");
process.exit(failures ? 1 : 0);
