#!/usr/bin/env node
'use strict';
/**
 * The primitives, against published values.
 *
 * Geometry and color are where a validator fails silently: the computation
 * runs, returns a number, and the number is wrong. A rectangle that thinks
 * it's disjoint from its neighbor doesn't flag A3.1, and the suite stays
 * green for having found nothing.
 *
 * That's why the assertions here aren't "the result looks reasonable" — they
 * are against an OUTSIDE NUMBER:
 *
 *   · WCAG contrast against the standard's own canonical pairs (21:1 at the
 *     extreme, 1:1 at identity, and #767676 on white, the pair the W3C uses
 *     to illustrate the 4.5:1 boundary);
 *   · CIEDE2000 against Sharma, Wu & Dalal's (2005) test set — the 34 pairs
 *     that exist precisely because the formula has discontinuities in the
 *     hue angle that almost every implementation gets wrong on the first try.
 *
 * If these pass, the rest of the validator is measuring what it claims to measure.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'validator', 'geometry.cjs'));
const c = require(path.join(__dirname, '..', 'validator', 'color.cjs'));

const failures = [];
const cases = [];

function ok(name, condition, detail) {
  cases.push(name);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
function near(name, got, expected, tol) {
  const d = Math.abs(got - expected);
  ok(name, d <= tol, `expected ${expected} (±${tol}), got ${Number(got.toFixed(4))}`);
}

// -------------------------------------------------------------------- geometry

const r = (x, y, w, h) => ({ x, y, w, h });

near('intersection area of overlapping rectangles', g.intersectionArea(r(0, 0, 10, 10), r(5, 5, 10, 10)), 25, 1e-9);
near('intersection area of disjoint rectangles', g.intersectionArea(r(0, 0, 10, 10), r(20, 20, 5, 5)), 0, 1e-9);
// Touching isn't overlapping: two sibling groups that share a border have
// zero intersection area, and A4.3 must not flag that as overlap.
near('intersection area of rectangles that only touch', g.intersectionArea(r(0, 0, 10, 10), r(10, 0, 10, 10)), 0, 1e-9);

ok('contains: child inside the parent with slack', g.contem(r(0, 0, 100, 100), r(20, 20, 10, 10)));
ok('contains: child overflowing the border', !g.contem(r(0, 0, 100, 100), r(95, 20, 10, 10)));
near('gap between rectangles separated on the x axis', g.gap(r(0, 0, 10, 10), r(18, 0, 10, 10)), 8, 1e-9);
ok('gap between overlapping rectangles is negative', g.gap(r(0, 0, 10, 10), r(5, 5, 10, 10)) < 0,
  `got ${g.gap(r(0, 0, 10, 10), r(5, 5, 10, 10))}`);
near('gap between touching rectangles is zero', g.gap(r(0, 0, 10, 10), r(10, 0, 10, 10)), 0, 1e-9);

// segment × rectangle — the heart of A3.5 and A5.5
ok('segment crossing the rectangle', g.segmentCrossesRect({ x: -5, y: 5 }, { x: 15, y: 5 }, r(0, 0, 10, 10)));
ok('segment passing well clear', !g.segmentCrossesRect({ x: -5, y: 50 }, { x: 15, y: 50 }, r(0, 0, 10, 10)));
ok('segment entirely inside the rectangle', g.segmentCrossesRect({ x: 2, y: 2 }, { x: 8, y: 8 }, r(0, 0, 10, 10)));
// An edge that TOUCHES its own owner's border must not count as a crossing,
// or every well-anchored edge (A3.6) would turn into an A3.5 violation.
ok('segment tangent to the border is not a crossing', !g.segmentCrossesRect({ x: 10, y: -5 }, { x: 10, y: 15 }, r(0, 0, 10, 10)));

const x1 = g.crossing({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
ok('X crossing is detected', !!x1);
if (x1) {
  near('X crossing point', x1.x, 5, 1e-9);
  near('X crossing angle', g.anguloEntre({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }), 90, 1e-9);
}
ok('parallel segments do not cross', !g.crossing({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }));
// Two edges leaving the same node share a point. That's incidence, not
// crossing — and counting it as a crossing would blow up A5.1 in every
// diagram with a degree-2 node. That's why c_max discounts C(deg(v),2).
ok('meeting at a shared endpoint is not a crossing', !g.crossing({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }));

near('shallow angle between segments', g.anguloEntre({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 1 }), 5.7106, 1e-3);
near('interior angle of an L-bend is 90°', g.anguloInterno({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }), 90, 1e-9);
near('interior angle of a bend that folds back on itself is 0°', g.anguloInterno({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }), 0, 1e-9);
near('interior angle of a straight segment is 180°', g.anguloInterno({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }), 180, 1e-9);

near('Hausdorff distance between coincident polylines', g.hausdorff([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 0 }, { x: 10, y: 0 }]), 0, 1e-9);
near('Hausdorff distance between polylines 5px apart', g.hausdorff([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 5 }, { x: 10, y: 5 }]), 5, 1e-9);

// ------------------------------------------------------------------------ color

near('contrast of black on white', c.contraste('#000000', '#FFFFFF'), 21, 1e-9);
near('contrast of a color against itself', c.contraste('#4A7EBB', '#4A7EBB'), 1, 1e-9);
// The pair the W3C uses to illustrate the SC 1.4.3 boundary: #767676 is the
// lightest gray that still passes 4.5:1 on white.
near('contrast of #767676 on white (SC 1.4.3 boundary)', c.contraste('#767676', '#FFFFFF'), 4.54, 5e-3);
near('contrast is symmetric', c.contraste('#FFFFFF', '#767676'), c.contraste('#767676', '#FFFFFF'), 1e-9);

ok('3-digit hex is accepted', Math.abs(c.contraste('#000', '#FFF') - 21) < 1e-9);

// Alpha compositing — what resolves the "effective background" from decision 4 of #18.
ok('opaque composite returns the top color', c.compor('#FF0000', '#00FF00', 1) === '#ff0000');
ok('transparent composite returns the bottom color', c.compor('#FF0000', '#00FF00', 0) === '#00ff00');
ok('50% composite lands in the middle', c.compor('#000000', '#FFFFFF', 0.5) === '#808080');

// CIEDE2000 — Sharma, Wu & Dalal's (2005) test set, Table 1. The chosen pairs
// cover the discontinuities: hue crossing 0°/360°, near-zero chroma, and the
// rotation term in the blue region.
const SHARMA = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
  [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1.0000],
  [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0000],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, -1, 2], [50, 0, 0], 2.3669],
  // These four exist in Sharma's table for one reason only: between b=0.0010
  // and b=0.0011 the mean hue switches branch, and ΔE00 JUMPS from 7.1792 to
  // 7.2195. It's not numerical noise — it's a discontinuity the formula
  // genuinely has, and reproducing it is the proof that the `h1+h2 < 360`
  // case is on the right side. An implementation that returns 7.1792 for all
  // four has the wrong branch.
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.0010], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
  [[50, 2.49, -0.001], [50, -2.49, 0.0012], 7.2195],
  [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
  [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
  [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
];
for (const [lab1, lab2, expected] of SHARMA)
  near(`Sharma ΔE00 (${lab1.join(',')}) vs (${lab2.join(',')})`, c.deltaE00(lab1, lab2), expected, 1e-4);

// sRGB → Lab, round trip through what can be checked by hand.
const labWhite = c.paraLab('#FFFFFF');
near('L* of white', labWhite[0], 100, 1e-3);
near('a* of white', labWhite[1], 0, 1e-3);
near('b* of white', labWhite[2], 0, 1e-3);
near('L* of black', c.paraLab('#000000')[0], 0, 1e-3);

// Color-deficiency simulation: gray is the fixed point of all three
// matrices — if a simulation moves a gray, it's wrong.
for (const kind of ['protanopia', 'deuteranopia', 'tritanopia']) {
  const simulated = c.simulate('#808080', kind);
  ok(`${kind} doesn't move gray`, c.deltaE00(c.paraLab(simulated), c.paraLab('#808080')) < 1.5, `became ${simulated}`);
}
// And what it must do: red and green collapse under protanopia. If the
// distance between them doesn't drop a lot, the matrix is inert and A7.4
// never fires.
const dNormal = c.deltaE00(c.paraLab('#D62728'), c.paraLab('#2CA02C'));
const dProtan = c.deltaE00(c.paraLab(c.simulate('#D62728', 'protanopia')), c.paraLab(c.simulate('#2CA02C', 'protanopia')));
ok('red and green collapse under protanopia', dProtan < dNormal / 2,
  `normal ΔE00=${dNormal.toFixed(1)}, protanopia ΔE00=${dProtan.toFixed(1)}`);

// ------------------------------------------------------------------------ report

console.log(`  assertions: ${cases.length}`);
if (failures.length) {
  console.log(`\n  ✗ ${failures.length}/${cases.length} failed:`);
  for (const f of failures) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('\n  ✓ geometry and color match the published values.');
