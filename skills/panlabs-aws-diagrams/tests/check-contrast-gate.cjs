#!/usr/bin/env node
'use strict';
/**
 * DOES THE GATE KNOW HOW TO FAIL? — a control experiment on the gate itself.
 *
 * Every other check in this prototype earned a control; the contrast gate had
 * none, and it is the one with the most to lose: a gate that approves by
 * mistake is worse than no gate at all, because it produces a green.
 *
 * The urgency is not hypothetical. #18's map recorded that the first version
 * of the geometric validator got the group label's Z-CUT wrong — it measured
 * the label against the page instead of against the group's own fill, and
 * reported "13.57:1" for dark text on a dark group that read as 1.00:1 on
 * screen. A false negative, in the only normative family, found only in review.
 *
 * This gate had the same defect. It stayed DORMANT while the catalog's 20
 * groups were `fillColor=none` — and woke up the instant subnet tinting came
 * back, on #13's return. Each case below is a plan known to be bad that the
 * gate HAS to fail, by the named rule.
 *
 *   node tests/check-contrast-gate.cjs
 */

const { measure } = require('../engine/contrast.cjs');

// The label is mandatory in the A7.1 cases: with no text there is no text pair
// to measure, and the case would pass without exercising anything — which is
// how the first version of these fixtures "passed" without touching the
// defect it existed to catch.
const cell = (id, label, style, parent = '1') =>
  ({ id, kind: 'vertice', parent, label, style, geo: { x: 0, y: 0, w: 10, h: 10 } });

const GROUP = 'shape=mxgraph.aws4.group;grIcon=x;container=1;';
const ICON = 'shape=mxgraph.aws4.resourceIcon;resIcon=y;';
// monochrome icon: aws4, but neither group nor service icon — the third path,
// and the one the first version of this control did not cover
const MONO = 'shape=mxgraph.aws4.users;';

const CASES = [
  {
    name: 'dark group label over a dark tint',
    because: "the LABEL's z-cut is the group's own fill, not the ancestor's (#18)",
    rule: 'A7.1',
    layoutPlan: { background: '#FFFFFF', cells: [
      cell('sub', 'Private subnet', GROUP + 'strokeColor=#00A4A6;fillColor=#2A3A3A;fontColor=#232F3E;fontSize=12;') ] },
  },
  {
    name: "leaf label over the parent's tint",
    because: "the LEAF's z-cut is the parent — the icon's label is drawn outside its own box",
    rule: 'A7.1',
    layoutPlan: { background: '#FFFFFF', cells: [
      cell('sub', 'Private subnet', GROUP + 'strokeColor=#00A4A6;fillColor=#1A1A1A;fontColor=#FFFFFF;fontSize=12;'),
      cell('lambda', 'Process order', ICON + 'fillColor=#ED7100;strokeColor=#FFFFFF;fontColor=#232F3E;fontSize=12;', 'sub') ] },
  },
  {
    name: "group border over the neighboring page background",
    because: "the BORDER's z-cut is what is OUTSIDE — it is the boundary, and it has to be findable",
    rule: 'A7.2',
    layoutPlan: { background: '#F2F3F5', cells: [
      cell('reg', 'us-east-1', GROUP + 'strokeColor=#00A4A6;fillColor=none;fontColor=#232F3E;fontSize=12;') ] },
  },
  {
    name: "monochrome icon label over the parent",
    because: "on it `fillColor` is the GLYPH, and the label falls below the box — it measures against the PARENT",
    rule: 'A7.1',
    layoutPlan: { background: '#FFFFFF', cells: [
      cell('sub', 'Private subnet', GROUP + 'strokeColor=#00A4A6;fillColor=#3A3A3A;fontColor=#FFFFFF;fontSize=12;'),
      cell('users', 'Customers', MONO + 'fillColor=#232F3E;fontColor=#232F3E;fontSize=12;', 'sub') ] },
  },
  {
    name: 'pale edge stroke',
    because: 'a thin stroke fails at 3:1 — it is the pair WCAG 1.4.11 names',
    rule: 'A7.2',
    layoutPlan: { background: '#FFFFFF', cells: [
      { id: 'e1', kind: 'edge', parent: '1', from: 'a', to: 'b', label: '',
        style: 'edgeStyle=orthogonalEdgeStyle;strokeColor=#DDDDDD;' } ] },
  },
  {
    name: 'white glyph over a square that is too light',
    because: "the glyph is measured against its OWN square, and does not change with the page background",
    rule: 'A7.2',
    layoutPlan: { background: '#FFFFFF', cells: [
      cell('svc', 'Service', ICON + 'fillColor=#EEEEEE;strokeColor=#FFFFFF;fontColor=#232F3E;fontSize=12;') ] },
  },
];

/** And a case the gate must NOT fail — otherwise it only knows how to say no. */
const CLEAN = {
  name: 'the correct drawing passes',
  layoutPlan: { background: '#FFFFFF', cells: [
    cell('sub', 'Private subnet', GROUP + 'strokeColor=#00A4A6;fillColor=#E6F6F6;fontColor=#232F3E;fontSize=12;'),
    cell('lambda', 'Process order', ICON + 'fillColor=#ED7100;strokeColor=#FFFFFF;fontColor=#232F3E;fontSize=12;', 'sub'),
    cell('users', 'Customers', MONO + 'fillColor=#232F3E;fontColor=#232F3E;fontSize=12;') ] },
};

function main() {
  let failed = 0;

  for (const testCase of CASES) {
    const r = measure(testCase.layoutPlan);
    const caught = r.falhas.some(f => f.rule === testCase.rule);
    if (!caught) failed = 1;
    console.log(`  ${caught ? '✓' : '✗'} ${testCase.name.padEnd(48)} ${testCase.rule}  ${testCase.because}`);
    if (!caught) console.log(`      NOT CAUGHT — the gate approved a plan known to be bad`);
  }

  const clean = measure(CLEAN.layoutPlan);
  const ok = clean.ok;
  if (!ok) failed = 1;
  console.log(`  ${ok ? '✓' : '✗'} ${CLEAN.name.padEnd(48)} —     a gate that only knows how to say no is not a gate`);
  if (!ok) for (const l of require('../engine/contrast.cjs').summarize(clean)) console.log('      ' + l);

  console.log(failed ? '\n  GATE DOES NOT KNOW HOW TO FAIL' : `\n  ✓ the gate catches the ${CASES.length} bad plans and approves the good one`);
  process.exit(failed);
}

if (require.main === module) main();
