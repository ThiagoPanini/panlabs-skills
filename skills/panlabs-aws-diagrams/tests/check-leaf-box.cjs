#!/usr/bin/env node
'use strict';
/**
 * #33 — the leaf box now reflects the label's measured width.
 *
 * Before, `boxW` was always `shapeW` (the layout box was the icon box), and a
 * qualifier wider than `ROTULO_W` (120 px) leaked out of the cell with no
 * check measuring it (#29 only warned). #35 reframed #33 as the fix at the
 * CAUSE: the box widens horizontally to fit the whole label, with the icon
 * centered inside it — the catalog style already carries `aspect=fixed`, so
 * the icon does not distort when the geometry widens.
 *
 * Two levels of proof:
 *
 *   1. UNIT — `resolve.create(theme).leaf(node)` in isolation, without going
 *      through layout. This is where the width is measured.
 *   2. END TO END — `engine/generate.cjs` end-to-end, real XML: proves the
 *      measured width reaches the emitted geometry, not just the resolver's
 *      internal object.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const resolverMod = require(path.join(ROOT, 'engine', 'resolve.cjs'));
const themeMod = require(path.join(ROOT, 'theme', 'theme.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));

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
console.log('\n2 · end to end — the measured width reaches the emitted XML\n');

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
  const r = await generate(model, { tema: 'corporate' });
  const res = resolverMod.create(themeMod.load('corporate'));
  const expected = res.leaf(model.nodes[1]).boxW;

  const m = r.xml.match(/<mxCell id="n1"[\s\S]*?<mxGeometry[^>]*width="(\d+)"/);
  const emittedWidth = m && Number(m[1]);
  ok(emittedWidth === expected,
    'the emitted vertex geometry has the measured width, not a fixed 78px',
    `emitted=${emittedWidth} expected=${expected}`);
  ok(!r.relatorio.avisos.some(a => /qualifier wider than the cell/.test(a)),
    "and #29's warning no longer fires — the box now USES the measure instead of only warning",
    JSON.stringify(r.relatorio.avisos));
}

// ---------------------------------------------------------------------------
console.log(failures ? `\n  ✗ ${failures} failure(s)` : "\n  ✓ the leaf box reflects the label's measured width.");
process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
