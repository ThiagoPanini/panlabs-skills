#!/usr/bin/env node
'use strict';
/**
 * #33 gave `leaf()` a `boxW` that reflects the label's measured width, and
 * for a while the emitted geometry WAS `boxW` — the icon stretched to the
 * label. #195 found the cost: 50 of 50 AWS resource icons in the practical
 * scan came out wider than tall, up to 2.67:1 against the catalog's 1:1.
 *
 * `boxW` stays — ELK and the grid still need it to keep a wide-labeled
 * sibling's text from colliding with the next node over. What changes is who
 * gets to READ it: the layout, never the emitted shape. `engine/plan.cjs`'s
 * `iconGeo()` now draws every leaf at `shapeW`×`shapeH` — the catalog's own
 * size — centered inside whatever width `boxW` reserved.
 *
 * Four levels of proof:
 *
 *   1. UNIT — `resolve.create(theme).leaf(node)` in isolation, without going
 *      through layout. This is where the width is measured, and `boxW`
 *      still has to widen here — the layout downstream depends on it.
 *   2. END TO END — `engine/generate.cjs` end-to-end, real XML: proves the
 *      EMITTED geometry stays the catalog's 1:1 icon size regardless of the
 *      label.
 *   3. UNIT — `plan.cjs`'s exported `iconGeo()`/`narrowAnchor()` directly, on
 *      hand-picked numbers: centering, and the edge-anchor remap for a touch
 *      the real corpus never happens to produce (off-center, in-bounds).
 *      An ELK run only proves what THAT run's routing happened to exercise;
 *      this is the formula itself, independent of ELK's luck.
 *   4. CORPUS SWEEP — every edge in `workbench/panlabs-aws-diagrams/models/`
 *      touching a leaf whose label widened its box: still a real anchor,
 *      still in [0,1] — no loose tip introduced by the narrower icon.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const resolverMod = require(path.join(ROOT, 'engine', 'resolve.cjs'));
const themeMod = require(path.join(ROOT, 'theme', 'theme.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));
const { iconGeo, narrowAnchor } = require(path.join(ROOT, 'engine', 'plan.cjs'));

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

const LONG_QUALIFIER = 'the 40 units come in right here, quite a bit wider than the 120px cell';

(async () => {
// ---------------------------------------------------------------------------
console.log('\n1 · unit — resolve.leaf() measures the label, does not clamp it to 120px\n');

{
  const res = resolverMod.create(themeMod.load('corporate'));
  const withoutQualifier = res.leaf({ id: 'n1', kind: 'service', service: 'aurora-postgresql' });
  ok(withoutQualifier.boxW === withoutQualifier.shapeW,
    'without a qualifier → boxW stays equal to the icon box',
    `boxW=${withoutQualifier.boxW} shapeW=${withoutQualifier.shapeW}`);

  const withQualifier = res.leaf({ id: 'n2', kind: 'service', service: 'aurora-postgresql', qualifier: LONG_QUALIFIER });
  const realWidth = res.textWidth(LONG_QUALIFIER);
  ok(withQualifier.boxW > withQualifier.shapeW,
    'with a long qualifier → boxW widens past the icon',
    `boxW=${withQualifier.boxW} shapeW=${withQualifier.shapeW}`);
  ok(withQualifier.boxW === realWidth,
    'and the width is not clamped to 120px — it is the real measure of the text',
    `boxW=${withQualifier.boxW} realWidth(untagged)=${realWidth}`);
  ok(withQualifier.labelW === realWidth,
    'labelW (what ELK reserves for the label) tracks the same measure',
    `labelW=${withQualifier.labelW}`);
}

{
  // #39: the three themes now turn the qualifier token on by default, so a
  // long one widens the box in every one of them — not just `corporate`.
  for (const id of ['light', 'dark', 'corporate']) {
    const res = resolverMod.create(themeMod.load(id));
    const f = res.leaf({ id: 'n3', kind: 'service', service: 'aurora-postgresql', qualifier: LONG_QUALIFIER });
    ok(f.boxW > f.shapeW,
      `"${id}" theme (qualifier on by default) → boxW widens past the icon`,
      `boxW=${f.boxW} shapeW=${f.shapeW}`);
  }

  // and the partition still holds when the token is explicitly off: the
  // qualifier does not show up in the label, so the box has no reason to widen.
  const off = resolverMod.create(themeMod.withPatch('light', { text: { qualifier: false } }));
  const g = off.leaf({ id: 'n4', kind: 'service', service: 'aurora-postgresql', qualifier: LONG_QUALIFIER });
  ok(g.boxW === g.shapeW,
    'qualifier explicitly off → boxW does not widen',
    `boxW=${g.boxW} shapeW=${g.shapeW}`);
}

// ---------------------------------------------------------------------------
console.log('\n2 · end to end — the CATALOG size reaches the emitted XML, not the label\n');

const geoOf = (xml, id) => {
  const m = xml.match(new RegExp(`<mxCell id="${id}"[\\s\\S]*?<mxGeometry[^>]*width="(\\d+)"[^>]*height="(\\d+)"`));
  return m && { w: Number(m[1]), h: Number(m[2]) };
};

{
  const model = {
    schema: 'panlabs-aws-diagrams/model@1',
    id: 'leaf-box-probe', title: 'probe', view: 'technical', genre: 'T1',
    nodes: [
      { id: 'cloud', kind: 'cloud', label: 'AWS Cloud' },
      { id: 'n1', kind: 'service', service: 'aurora-postgresql', inside: 'cloud', qualifier: LONG_QUALIFIER },
    ],
    edges: [],
  };
  const res = resolverMod.create(themeMod.load('corporate'));
  const { shapeW, shapeH, boxW } = res.leaf(model.nodes[1]);

  const r = await generate(model, { theme: 'corporate' });
  const geoWide = geoOf(r.xml, 'n1');

  ok(geoWide.w === shapeW && geoWide.h === shapeH,
    '#195 — a long qualifier no longer stretches the emitted shape: it stays the catalog icon size',
    `emitted=${geoWide.w}x${geoWide.h} shapeW=${shapeW} shapeH=${shapeH} boxW=${boxW} (boxW>shapeW proves the label DID widen the reservation)`);
  ok(boxW > shapeW,
    'sanity: this qualifier really does widen the reservation — a check that could not fail is not a check',
    `boxW=${boxW} shapeW=${shapeW}`);
}

// ---------------------------------------------------------------------------
console.log("\n3 · unit — iconGeo() centers the icon inside the reservation, narrowAnchor() keeps the arrow on it\n");

{
  // iconGeo: a container (no `shapeW`) passes straight through — it has no
  // icon of its own to narrow.
  const containerBox = iconGeo({ container: true }, 5, 7, 200, 90);
  ok(containerBox.x === 5 && containerBox.y === 7 && containerBox.w === 200 && containerBox.h === 90,
    'iconGeo — a container is returned untouched',
    JSON.stringify(containerBox));

  // A leaf whose label never widened the box (boxW === shapeW): no shift.
  const tight = iconGeo({ shapeW: 78, shapeH: 78 }, 100, 50, 78, 78);
  ok(tight.x === 100 && tight.w === 78,
    'iconGeo — boxW === shapeW → no centering shift',
    JSON.stringify(tight));

  // A leaf whose label widened the box by 100px (boxW=178, shapeW=78): the
  // icon narrows to 78 and slides right by exactly half the widening.
  const wide = iconGeo({ shapeW: 78, shapeH: 78 }, 100, 50, 178, 78);
  ok(wide.x === 150 && wide.y === 50 && wide.w === 78 && wide.h === 78,
    'iconGeo — boxW=178, shapeW=78 → icon narrows to 78 and centers at x=150 (100 + (178-78)/2)',
    JSON.stringify(wide));
}

{
  const meta = { shapeW: 78 };

  // Left/right touches are fixed at x=0/1 — the free axis is height, which
  // never widens, so narrowAnchor must not touch them.
  const left = narrowAnchor({ x: 0, y: 0.7 }, meta, 178);
  ok(left.x === 0 && left.y === 0.7, 'narrowAnchor — a left touch passes through unchanged', JSON.stringify(left));
  const right = narrowAnchor({ x: 1, y: 0.2 }, meta, 178);
  ok(right.x === 1 && right.y === 0.2, 'narrowAnchor — a right touch passes through unchanged', JSON.stringify(right));

  // No widening at all: pass through regardless of which side touched.
  const noWiden = narrowAnchor({ x: 0.4, y: 0 }, meta, 78);
  ok(noWiden.x === 0.4, 'narrowAnchor — boxW === shapeW → no remap needed', JSON.stringify(noWiden));

  // A top touch dead-center of the WIDE box (x=0.5) stays dead-center of the
  // narrow icon — the wide box and the narrow icon share the same center by
  // construction, so 0.5 is a fixed point of the remap.
  const centerTop = narrowAnchor({ x: 0.5, y: 0 }, meta, 178);
  ok(centerTop.x === 0.5, 'narrowAnchor — a dead-center top touch stays at 0.5 after narrowing', JSON.stringify(centerTop));

  // A top touch at x=0.9 of a 178-wide box sits at absolute offset 160.2 from
  // the box's left edge; the icon's own left edge sits 50px in (offset =
  // (178-78)/2), so the SAME physical point is (160.2-50)/78 ≈ 1.415 of the
  // narrow icon — past its right edge, and clamp() has to catch it.
  const offEdge = narrowAnchor({ x: 0.9, y: 0 }, meta, 178);
  ok(offEdge.x === 1, 'narrowAnchor — a touch past the icon on the wide side clamps to the edge (1), not a value >1', JSON.stringify(offEdge));

  // A top touch at x=0.7 of a 178-wide box: absolute offset 124.6, icon's own
  // frame starts at 50 → (124.6-50)/78 = 0.9564..., still inside [0,1] — the
  // sharp non-trivial case the real corpus never happened to exercise.
  const inside = narrowAnchor({ x: 0.7, y: 0 }, meta, 178);
  const expected = Math.round(((0.7 * 178 - 50) / 78) * 1000) / 1000;
  ok(Math.abs(inside.x - expected) < 0.001,
    'narrowAnchor — a genuine off-center, in-bounds touch remaps correctly (not clamped, not left unchanged)',
    `got=${inside.x} expected=${expected}`);
}

// ---------------------------------------------------------------------------
console.log('\n4 · corpus sweep — no widened leaf turns a real edge into a loose tip\n');

{
  const modelsDir = path.join(WORKBENCH, 'models');
  const res = resolverMod.create(themeMod.load('light'));
  let widenedEdges = 0, checked = 0;
  for (const file of fs.readdirSync(modelsDir)) {
    if (!file.endsWith('.json')) continue;
    let model;
    try { model = JSON.parse(fs.readFileSync(path.join(modelsDir, file), 'utf8')); } catch { continue; }
    if (model.schema !== 'panlabs-aws-diagrams/model@1') continue;
    const widened = new Set();
    for (const n of model.nodes || []) {
      if (n.kind !== 'service' && n.kind !== 'actor') continue;
      try { const f = res.leaf(n); if ((f.boxW || f.shapeW) > f.shapeW) widened.add(n.id); } catch { /* not a leaf */ }
    }
    if (!widened.size) continue;
    checked++;
    const r = await generate(model, { theme: 'light', gate: 'none' });
    for (const e of model.edges || []) {
      if (!widened.has(e.from) && !widened.has(e.to)) continue;
      const re = new RegExp(`style="([^"]*)" edge="1" parent="1" source="${e.from}" target="${e.to}"`);
      const m = r.xml.match(re);
      if (!m) continue;   // routed through a container-relative path this sweep does not reconstruct
      const style = m[1];
      if (!/exitX=|entryX=/.test(style)) continue;   // this edge was already a loose tip pre-#195 — not this proof's concern
      widenedEdges++;
      const exitX = Number((style.match(/exitX=([\d.]+)/) || [])[1]);
      const entryX = Number((style.match(/entryX=([\d.]+)/) || [])[1]);
      ok(!Number.isNaN(exitX) && exitX >= 0 && exitX <= 1, `${file} ${e.from}->${e.to}: exitX in [0,1]`, `exitX=${exitX}`);
      ok(!Number.isNaN(entryX) && entryX >= 0 && entryX <= 1, `${file} ${e.from}->${e.to}: entryX in [0,1]`, `entryX=${entryX}`);
    }
  }
  ok(checked > 0, 'sanity: the corpus actually has at least one model with a widened leaf', `models with a widened leaf: ${checked}`);
  ok(widenedEdges > 0, 'sanity: at least one real, anchored edge touches a widened leaf', `anchored edges touching a widened leaf: ${widenedEdges}`);
}

// ---------------------------------------------------------------------------
console.log(failures ? `\n  ✗ ${failures} failure(s)` : "\n  ✓ the leaf box reserves for the label; the emitted icon draws at the catalog's own size.");
process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
