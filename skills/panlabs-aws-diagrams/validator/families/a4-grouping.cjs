'use strict';
/**
 * A4 · Grouping and common region (Gestalt).
 *
 * The rubric: "in an AWS diagram this family carries the drawing's strongest
 * semantics: the VPC box IS the network boundary. An error here isn't ugly,
 * it's factually wrong."
 *
 * Two of the seven are marked `semantica` in the index — A4.2 and A4.4. In
 * those the validator stops being a linter and becomes a truthfulness guard:
 * what's measured isn't whether the drawing looks good, it's whether it's
 * ASSERTING a topology the model denies.
 *
 * This whole family runs over GROUPS. Bands are excluded, and the reason is
 * written in `scene.cjs`: a band asserts a shared attribute, not containment,
 * and the engine itself draws it to cross boxes. What applies to bands —
 * that a band embraces exactly the members it declares — lives in
 * `extras.cjs`, at the same zero tolerance.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, notApplicable, matches, pairs, mean, deviation, roundTo, withoutTags, name } = require(path.join(__dirname, 'common.cjs'));


module.exports = function a4(scene) {
  const output = [];
  const { nodes, groups } = scene;
  const solid = [...nodes, ...groups];

  // ---------------------------------------------------------------- A4.1
  {
    const padding = lim('groupPadding');
    const cases = [];
    for (const e of solid) {
      const parent = scene.byElement.get(e.parent);
      if (!parent || !parent.cellBox) continue;
      if (!g.contem(parent.cellBox, e.cellBox, padding)) {
        const p = g.paddings(parent.cellBox, [e.cellBox]);
        const tight = Object.entries(p).filter(([, d]) => d < padding)
          .map(([side, d]) => `${side}=${roundTo(d, 1)}`).join(', ');
        cases.push({ o_que: `${name(e)} does not respect ${padding} px inside "${parent.id}" (${tight})`, ids: [e.id, parent.id] });
      }
    }
    output.push(matches('A4.1', cases, { measured: { children: solid.filter(e => scene.byElement.get(e.parent)).length, violations: cases.length } }));
  }

  // ---------------------------------------------------------------- A4.2
  // The most semantically severe failure in the whole validator.
  {
    const cases = [];
    for (const n of solid) {
      for (const group of groups) {
        if (group.id === n.id) continue;
        if (scene.isDescendant(n.id, group.id)) continue;      // it's a member: allowed to be inside
        if (scene.isDescendant(group.id, n.id)) continue;      // the reverse: the group is the child
        const area = g.intersectionArea(n.cellBox, group.cellBox);
        if (area > 0) {
          const inside = g.contem(group.cellBox, n.cellBox);
          cases.push({
            o_que: `${name(n)} ${inside ? 'sits inside' : 'invades'} "${group.id}" without being a member — ` +
              `the drawing asserts a boundary membership the model does not have`,
            ids: [n.id, group.id],
          });
        }
      }
    }
    output.push(matches('A4.2', cases, {
      measured: { violations: cases.length },
      message: cases.length
        ? `${cases.length} false membership(s) — tolerance is zero`
        : 'no non-member inside someone else\'s group',
    }));
  }

  // ---------------------------------------------------------------- A4.3
  {
    const cases = [];
    const candidates = [...pairs(groups)].filter(([a, b]) =>
      a.parent === b.parent && !scene.isDescendant(a.id, b.id) && !scene.isDescendant(b.id, a.id));
    for (const [a, b] of candidates) {
      const area = g.intersectionArea(a.cellBox, b.cellBox);
      if (area > 0) cases.push({ o_que: `sibling groups "${a.id}" and "${b.id}" overlap by ${roundTo(area, 0)} px²`, ids: [a.id, b.id] });
    }
    output.push(candidates.length ? matches('A4.3', cases, { measured: { pairs: candidates.length, overlapping: cases.length } })
      : notApplicable('A4.3', 'there are no two sibling groups to compare'));
  }

  // ---------------------------------------------------------------- A4.4
  // The tree derived from the geometry against the declared tree. The
  // geometric parent is the smallest group that contains the whole box —
  // which is how the eye reads it.
  {
    const cases = [];
    for (const e of solid) {
      const containing = groups.filter(gr => gr.id !== e.id && !scene.isDescendant(gr.id, e.id) && g.contem(gr.cellBox, e.cellBox));
      const geometric = containing.sort((a, b) => (a.cellBox.w * a.cellBox.h) - (b.cellBox.w * b.cellBox.h))[0];
      const declaredValue = scene.byElement.get(e.parent);
      const geoId = geometric ? geometric.id : '(root)';
      const declaredId = declaredValue ? declaredValue.id : '(root)';
      if (geoId !== declaredId)
        cases.push({ o_que: `${name(e)} is drawn inside "${geoId}" and declared inside "${declaredId}"`, ids: [e.id] });
    }
    output.push(matches('A4.4', cases, {
      measured: { elements: solid.length, divergences: cases.length },
      message: cases.length
        ? `${cases.length} element(s) where the drawing and the model tell different topologies`
        : 'the drawn tree is the declared tree',
    }));
  }

  // ---------------------------------------------------------------- A4.5
  {
    const sigmaMax = lim('maxPaddingDeviation');
    const cases = [];
    const byKind = new Map();
    for (const group of groups) {
      const children = (scene.childrenOf.get(group.id) || []).map(f => f.cellBox);
      if (!children.length) continue;
      const p = g.paddings(group.cellBox, children);
      // The top carries the title band, which is a deliberate reservation,
      // not a deviation.
      const sides = [p.left, p.right, p.bottom];
      const s = deviation(sides);
      if (s > sigmaMax)
        cases.push({ o_que: `"${group.id}" has paddings ${sides.map(x => roundTo(x, 1)).join('/')} (σ = ${roundTo(s, 2)} > ${sigmaMax})`, ids: [group.id] });
      const kind = group.semanticKind || 'unknown';
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind).push({ id: group.id, p: mean(sides) });
    }
    for (const [kind, list] of byKind) {
      if (list.length < 2) continue;
      const s = deviation(list.map(x => x.p));
      if (s > sigmaMax)
        cases.push({ o_que: `groups of type "${kind}" use different paddings from one another (σ = ${roundTo(s, 2)})`, ids: list.map(x => x.id) });
    }
    output.push(groups.length ? matches('A4.5', cases, { measured: { groups: groups.length, irregular: cases.length } })
      : notApplicable('A4.5', 'the diagram has no groups'));
  }

  // ---------------------------------------------------------------- A4.6
  {
    const cases = [];
    let withLabel = 0;
    for (const group of groups) {
      const r = group.labelRect;
      if (!r || !withoutTags(group.label)) continue;
      withLabel++;
      const atTop = Math.abs(r.y - group.cellBox.y) <= lim('titleBandHeight');
      const atLeft = r.x - group.cellBox.x <= group.cellBox.w / 2;
      if (!atTop || !atLeft)
        cases.push({ o_que: `"${group.id}"'s label is not in the top-left corner`, ids: [group.id] });
      for (const child of scene.childrenOf.get(group.id) || [])
        if (g.intersectionArea(r, child.cellBox) > 0) {
          cases.push({ o_que: `"${group.id}"'s label collides with child "${child.id}"`, ids: [group.id, child.id] });
          break;
        }
    }
    output.push(withLabel ? matches('A4.6', cases, { measured: { labeledGroups: withLabel, outsideCanon: cases.length } })
      : notApplicable('A4.6', 'no group has a label'));
  }

  // ---------------------------------------------------------------- A4.7
  {
    const ceiling = lim('maxProximity');
    const groupOf = n => {
      const a = scene.ancestors(n.id);
      return a.length ? a[0].id : '(root)';
    };
    const intra = [];
    const inter = [];
    for (const [a, b] of pairs(nodes)) {
      const d = Math.hypot(...['x', 'y'].map(k => g.centro(a.cellBox)[k] - g.centro(b.cellBox)[k]));
      (groupOf(a) === groupOf(b) ? intra : inter).push(d);
    }
    if (!intra.length || !inter.length) output.push(notApplicable('A4.7', 'there are no intra- and inter-group pairs to compare'));
    else {
      const rho = mean(intra) / mean(inter);
      output.push(rho <= ceiling
        ? ok('A4.7', { measured: { rho: roundTo(rho), intra: roundTo(mean(intra), 1), inter: roundTo(mean(inter), 1) }, message: `ρ = ${roundTo(rho)} ≤ ${ceiling}` })
        : matches('A4.7', [{ o_que: `ρ = ${roundTo(rho)} > ${ceiling}: nodes in the same group are not closer to each other than to outside nodes`, ids: [] }],
          { measured: { rho: roundTo(rho), intra: roundTo(mean(intra), 1), inter: roundTo(mean(inter), 1) } }));
    }
  }

  return output;
};
