#!/usr/bin/env node
'use strict';
/**
 * #40 — an edge label that would land on top of another slides along its OWN
 * edge instead of sitting frozen at the midpoint.
 *
 * `engine/labels.cjs` runs after `plan` and before the geometric gate, and it
 * decides with the SAME math A3.2 will grade it against — it calls
 * `createScene` itself to see what a candidate position looks like, rather
 * than re-deriving anchor and midpoint geometry a second time.
 *
 * Two levels of proof:
 *
 *   1. UNIT — `resolveEdgeLabelCollisions` on a synthetic plan with two edge
 *      labels planted on the same point: the second one moves, `labelT` gets
 *      set, and the two rects stop touching.
 *   2. END TO END — `engine/generate.cjs` on a tracked corpus model that
 *      collided before #40 (`events-fanout`, where an edge's label used to
 *      land on the "baixa-estoque" Lambda's own label): A3.2 comes back
 *      clean, and the emitted XML carries the label's `x` offset.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { resolveEdgeLabelCollisions } = require(path.join(ROOT, 'engine', 'labels.cjs'));
const { createScene } = require(path.join(ROOT, 'validator', 'scene.cjs'));
const geo = require(path.join(ROOT, 'validator', 'geometry.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));
const { validateGeometry } = require(path.join(ROOT, 'validator', 'validate-geometry.cjs'));
const themeMod = require(path.join(ROOT, 'theme', 'theme.cjs'));

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

(async () => {
// ---------------------------------------------------------------------------
console.log('\n1 · unit — two edge labels planted on the same point separate\n');

{
  // Two long, parallel, horizontal edges 4px apart — close enough that their
  // midpoint labels (14px tall) are bound to touch.
  const layoutPlan = {
    id: 'label-collision-probe', width: 800, height: 400, background: '#FFFFFF',
    cells: [
      { kind: 'vertice', id: 'a', parent: '1', label: '', style: 'text;', geo: { x: 20, y: 100, w: 40, h: 40 } },
      { kind: 'vertice', id: 'b', parent: '1', label: '', style: 'text;', geo: { x: 700, y: 100, w: 40, h: 40 } },
      { kind: 'vertice', id: 'c', parent: '1', label: '', style: 'text;', geo: { x: 20, y: 104, w: 40, h: 40 } },
      { kind: 'vertice', id: 'd', parent: '1', label: '', style: 'text;', geo: { x: 700, y: 104, w: 40, h: 40 } },
      { kind: 'edge', id: 'e1', parent: '1', from: 'a', to: 'b', label: 'primeira aresta', style: 'edgeStyle=none;', points: [] },
      { kind: 'edge', id: 'e2', parent: '1', from: 'c', to: 'd', label: 'segunda aresta', style: 'edgeStyle=none;', points: [] },
    ],
  };

  const before = createScene(layoutPlan).edges.filter(e => e.labelRect);
  const touchingBefore = geo.intersectionArea(before[0].labelRect, before[1].labelRect) > 0;
  ok(touchingBefore, 'sanity check — the two labels do collide before the fix runs',
    JSON.stringify(before.map(e => e.labelRect)));

  const moved = resolveEdgeLabelCollisions(layoutPlan);
  ok(moved.length === 1 && moved[0].id === 'e2',
    'the SECOND edge (id order) is the one that moves, not the first',
    JSON.stringify(moved));

  const after = createScene(layoutPlan).edges.filter(e => e.labelRect);
  const touchingAfter = geo.intersectionArea(after[0].labelRect, after[1].labelRect) > 0;
  ok(!touchingAfter, 'and the two label rects no longer touch', JSON.stringify(after.map(e => e.labelRect)));

  const cell = layoutPlan.cells.find(c => c.id === 'e2');
  ok(cell.labelT !== undefined && cell.labelT !== 0.5,
    "the moved edge's cell carries a labelT away from the untouched midpoint",
    `labelT=${cell.labelT}`);
}

// ---------------------------------------------------------------------------
console.log('\n2 · end to end — a corpus model that used to collide comes back clean\n');

{
  // #39 turned `qualifier` on by default in "light", which widens leaf boxes
  // enough to shift this model's layout — the specific collision below no
  // longer occurs under today's "light". Forcing the token off reproduces
  // the exact geometry this proof was measured against; the fix under test
  // is #40's collision resolver, not #39's default, so pin the OLD condition.
  const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'events-fanout.json'), 'utf8'));
  const r = await generate(model, { tema: themeMod.withPatch('light', { text: { qualifier: false } }) });
  const report = validateGeometry(r.layoutPlan);
  const a32 = report.resultados.find(c => c.id === 'A3.2');
  ok(a32.state === 'ok', 'A3.2 (label-label overlap) is clean on "events-fanout"', JSON.stringify(a32.occurrences));

  const moved = r.layoutPlan.cells.filter(c => c.kind === 'edge' && c.labelT !== undefined);
  ok(moved.length > 0, 'at least one edge label actually moved to get there', moved.map(c => c.id).join(', '));

  const hasOffset = moved.every(c => new RegExp(`<mxCell id="${c.id}"[\\s\\S]*?<mxGeometry[^>]*\\bx="`).test(r.xml));
  ok(hasOffset, "and the emitted XML carries each moved edge's label offset (mxGeometry x=)",
    moved.map(c => c.id).join(', '));
}

// ---------------------------------------------------------------------------
console.log(failures ? `\n  ✗ ${failures} failure(s)` : '\n  ✓ a colliding edge label slides along its own edge.');
process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
