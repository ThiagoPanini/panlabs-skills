'use strict';
/**
 * What the rubric didn't anticipate — and why it stays out of the 62.
 *
 * The rubric (#8) models ONE containment tree. This engine draws two things:
 * groups, which contain, and bands, which cross. The checks here are the ones
 * born from that second category, and they do NOT enter the index of 62 for a
 * hygiene reason: the index is the contract with the rubric, and
 * `check-index` exists to guarantee it never drifts. Inflating the 62 with
 * our own findings would erase the line between "what the research told us to
 * measure" and "what we found out by measuring" — and that line is what makes
 * the index worth anything.
 *
 * They carry the prefix `F` (for "faixa", band), with the same severity and
 * the same tolerance as A4.2, because it's the same semantic question: is the
 * box asserting a fact about a node that it doesn't have?
 *
 *   A4.2  the node fell inside a GROUP it isn't a child of
 *         → the drawing lies about the network boundary
 *
 *   F1    the BAND doesn't embrace exactly the members it declares
 *         → the drawing lies about the shared attribute ("this EC2 is in
 *           AZ-b", "this database scales with the group") — and it lies in a
 *           way A4.2 would never catch, because a band is nobody's parent
 *
 *   F2    the EDGE crosses the box of a band it doesn't belong to
 *         → the same pair, one line down: `A5.5` is `A4.2` applied to the
 *           edge, and F2 is F1 applied to the edge. The predicate is
 *           literally A5.5's — a polyline crossing a box the edge has no
 *           relationship with —, swapping the `group` class for the `band` class
 *
 * If #18 ever ships to production, the path is to bring F1 and F2 back into
 * the rubric as A4.8 and A5.10, not leave them here forever.
 *
 * `L1` (#164) is a different animal — not a band, a leaf field the rubric's
 * own A1 family never named — but the same hygiene reason keeps it in this
 * file and out of the 62. Its own docstring, right above where it's defined,
 * has the detail; the short version is that `resultados` (what `a1()` and
 * its seven siblings return) is where the "62 rubric" totals get counted
 * from, and this file's `output` is kept apart from that on purpose.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY F2 WAS BORN IN #26, AND WHAT ITS MEASUREMENT SAID
 *
 * #21 decided that deleting an edge that crosses a zone (the #6 exit applied
 * to the zone) is a FALLBACK, not a default, and that "the trigger has to come
 * from the validator, not a magic constant." What was left pending was
 * *which check*.
 *
 * The answer is that it DIDN'T EXIST. `A5.5` sweeps `scene.groups`; a band is
 * a different class, and it was left out of the 62 by #18's explicit
 * decision — but only F1 ever got written. The result is that the engine was
 * STRUCTURALLY blind to the very defect #21's fallback exists to prevent: no
 * check measured an edge cutting through someone else's band, so none could
 * trigger the fallback and none would catch a regression.
 *
 * ⚠️ And #26's measurement says the defect does NOT happen in this engine.
 * Sweeping a complete mesh of 3, 4, 5 and 6 zones (`workbench/panlabs-aws-diagrams/tools/measure-fan.cjs`),
 * with a predicted sweep floor of 2, 8, 20 and 40, the measured F2 is ZERO on
 * all four. #24's routing takes the long edge to the bands' outer border
 * instead of straight across columns; the floor keeps counting a crossing the
 * drawing no longer makes. What grows with density is `A3.2` — label
 * collision, 2 → 5 → 12 → 25 —, which is LEGIBILITY, not truthfulness.
 *
 * So F2 goes in armed and quiet, and that's what it buys: the day a routing
 * change reintroduces the crossing, the `truthfulness` gate blocks it instead
 * of letting the drawing lie. The fallback itself remains named fog.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const { withoutTags, roundTo, name } = require(path.join(__dirname, 'common.cjs'));

/**
 * The descriptor for an `F`-family finding, in one place.
 *
 * ⚠️ `common.cjs`'s `matches()` would do this for the 62 — and does NOT work
 * here, by construction: it decides severity by reading `byId(id).severity`
 * from the index, and `byId('F1')` and `byId('F2')` are `undefined` precisely
 * because family `F` stays **outside** the index on purpose. Using `matches`
 * here would break on that lookup, or force inflating the index — which is
 * exactly what #18's decision refuses.
 *
 * So the descriptor is hand-written, but **once** per check instead of twice
 * (the `notApplicable` branch and the verdict branch used to repeat the same
 * seven fields).
 */
const bandFinding = (id, checkName) => (state, message, measured, occurrences = []) => ({
  id, name: checkName, family: 'F', input: 'geometry',
  maxSeverity: 'fail', semantica: true, calibratable: false,
  state, message: message, measured, occurrences,
});


/**
 * F2 — the edge cuts through the box of a band it doesn't belong to.
 *
 * A mirror of `A5.5`, line for line on purpose: the band enters the count
 * when NEITHER endpoint is a member of it. Membership includes a member's
 * descendants — an AZ band declares the subnet and its direct children, and a
 * service nested deeper (inside a security group, say) still belongs to that
 * zone. Without that the check would flag the zone's own internal edge.
 *
 * A band with no declared members is left out: that's the case of the OR
 * band, which #12 draws as `render: label` and whose "box" is a label anchor,
 * not a region.
 */
function f2(scene) {
  const finding = bandFinding('F2', 'Edge crossing someone else\'s band');
  const withMembers = scene.bands.filter(f => Array.isArray(f.members) && f.members.length);
  const edges = scene.edges.filter(a => a.complete);

  if (!withMembers.length || !edges.length)
    return finding('notApplicable',
      !edges.length ? 'the diagram has no edges' : 'the diagram has no band with declared members',
      { bands: withMembers.length, edges: edges.length });

  const belongsTo = (endpoint, f) => f.members.some(m => m === endpoint || scene.isDescendant(endpoint, m));

  const cases = [];
  for (const a of edges)
    for (const f of withMembers) {
      if (belongsTo(a.from, f) || belongsTo(a.to, f)) continue;
      if (!g.polilinhaCruzaRetangulo(a.points, f.cellBox)) continue;
      cases.push({
        o_que: `edge "${a.id}" (${a.from}→${a.to}) crosses band "${f.id}"` +
          `${withoutTags(f.label) ? ` (${withoutTags(f.label)})` : ''}, which it neither leaves from nor heads to — ` +
          `the drawing routes the path through a zone it never touches`,
        ids: [a.id, f.id],
      });
    }

  return finding(cases.length ? 'failure' : 'ok',
    cases.length
      ? `${cases.length} crossing(s) of someone else's band — tolerance is zero, as in A5.5`
      : `${edges.length} edge(s) against ${withMembers.length} band(s): none cuts through a band it doesn't belong to`,
    { bands: withMembers.length, edges: edges.length, bandCrossings: cases.length },
    cases);
}

/**
 * L1 — every technical leaf carries `resource` or `qualifier` (#164).
 *
 * The rubric's A1 family already asks "is every element NAMED" (A1.4) and
 * "is every element TYPED" (A1.5) — the same "presence of a field" question
 * this asks, of a field the rubric never named: the second, italic line a
 * leaf draws below its name (guide/model.md, "A segunda linha da folha").
 * It stays out of the 62 for the same hygiene reason F1/F2 do, and it lands
 * in THIS file rather than beside A1.4/A1.5 in `a1-completeness.cjs` for a
 * concrete, measured reason, not a stylistic one: `validate-geometry.cjs`
 * keeps this file's output in its own bucket, `r.extras`, apart from
 * `resultados` — the array `summary.total`/`summary.ok`/`summary.failure`
 * are counted from. A check returned from `a1()`'s own `module.exports`
 * would land in `resultados` instead, and silently inflate what those
 * "62 rubric" totals mean on every technical-view run.
 */
function l1(scene) {
  const finding = (state, message, measured, occurrences = []) => ({
    id: 'L1', name: 'Technical leaf carries a second line', family: 'L', input: 'model',
    maxSeverity: 'fail', semantica: false, calibratable: false,
    state, message, measured, occurrences,
  });
  const model = scene.model;
  if (!model) return finding('notApplicable', 'the plan does not carry the semantic model', { leaves: 0 });
  if (model.view !== 'technical')
    // The logical view's leaf falls to `qualifier` on its OWN facet — that is
    // turn 1's job (guide/model.md), not what this rule audits.
    return finding('notApplicable', 'the plan is the logical view — its leaf label is turn 1\'s job', { leaves: 0 });

  const leaves = (model.nodes || []).filter(n => n.kind === 'service' || n.kind === 'actor');
  const cases = leaves.filter(n => !n.resource && !n.qualifier)
    .map(n => ({ o_que: `${name(n)} has neither "resource" nor "qualifier" — the leaf draws with no second line`, ids: [n.id] }));
  return finding(cases.length ? 'failure' : 'ok',
    cases.length
      ? `${cases.length} technical leaf(s) with no second line`
      : `${leaves.length} technical leaf(s), every one carries "resource" or "qualifier"`,
    { leaves: leaves.length, missing: cases.length },
    cases);
}

module.exports = function extras(scene) {
  const output = [];
  const { bands, nodes } = scene;
  const finding = bandFinding('F1', 'Band embraces exactly its members');

  // ---------------------------------------------------------------- F1
  const checkable = bands.filter(f => Array.isArray(f.members));
  if (!checkable.length) {
    output.push(finding('notApplicable',
      bands.length ? 'the plan\'s bands declare no members' : 'the diagram has no bands',
      { bands: bands.length }));
    output.push(f2(scene));
    output.push(l1(scene));
    return output;
  }

  const cases = [];
  for (const f of checkable) {
    const declared = new Set(f.members);
    for (const id of declared) {
      const member = scene.byElement.get(id);
      if (!member || !member.cellBox) continue;
      if (!g.contem(f.cellBox, member.cellBox))
        cases.push({
          o_que: `band "${f.id}" declares "${id}" as a member and does not embrace it — ` +
            `whoever reads the drawing does not see the attribute the model asserts`,
          ids: [f.id, id],
        });
    }
    for (const n of nodes) {
      if (declared.has(n.id)) continue;
      const area = g.intersectionArea(f.cellBox, n.cellBox);
      if (area <= 0) continue;
      const inside = g.contem(f.cellBox, n.cellBox);
      cases.push({
        o_que: `band "${f.id}" ${inside ? 'contains' : 'touches'} ${name(n)}, which is not a member of it — ` +
          `the drawing asserts an attribute about it (${withoutTags(f.label) || f.id}) that the model does not declare`,
        ids: [f.id, n.id],
        area: roundTo(area, 0),
      });
    }
  }

  output.push(finding(cases.length ? 'failure' : 'ok',
    cases.length
      ? `${cases.length} divergence(s) between what the band draws and what it declares`
      : `${checkable.length} band(s) embrace exactly their members`,
    { bands: checkable.length, divergences: cases.length },
    cases));

  // ---------------------------------------------------------------- F2
  output.push(f2(scene));

  // ---------------------------------------------------------------- L1
  output.push(l1(scene));

  return output;
};
