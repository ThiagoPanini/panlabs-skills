#!/usr/bin/env node
'use strict';
/**
 * PAINT × METRIC — the theme is not downstream of the layout, and this proves it.
 *
 * The comfortable intuition is that style enters at the end: layout resolves
 * where everything sits and the theme just paints. It's false, and #13
 * measured where:
 *
 *   METRIC  label body, group-label body, grid density, two-line qualifier
 *           (O21), and the title block's revision line. All of them feed the
 *           layout — text reserves space, and space is geometry.
 *   PAINT   page color, ink, halo, edge color/tip/corner/jump/flow, note and
 *           logical-block colors. None of them moves a coordinate.
 *
 * The check perturbs ONE token at a time and regenerates:
 *
 *   PAINT token   -> same cells, IDENTICAL geometry. If it moves, it's
 *                    misclassified (or the engine has hidden coupling).
 *   METRIC token  -> something MUST move. If nothing moves, the engine is
 *                    ignoring the token — that's how we found out the title
 *                    band wasn't looking at `text.group`.
 *
 *   node tools/check-partition.cjs
 */

const fs = require('fs');
const path = require('path');
const { generate } = require('../../../skills/panlabs-aws-diagrams/engine/generate.cjs');
const themeMod = require('../../../skills/panlabs-aws-diagrams/theme/theme.cjs');

const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'models', f), 'utf8'));
const MODEL = read('orders-serverless.json');

/**
 * TWO models, and the second one isn't fussiness.
 *
 * The `block.*` tokens paint the LOGICAL VIEW's box — the one place in the
 * product where the house picks a box color without contradicting AWS. A
 * technical model has no `block` at all, so those tokens have nothing to
 * paint and the check would accuse them of being inert. The right target of
 * that accusation, in this case, isn't the token: it's the model.
 *
 * It's the same case as `text.qualifier`, which also came out inert until the
 * model gained qualifiers. The lesson that carries over to the real engine:
 * **a style token can depend on a fact from the model**, and a single-model
 * battery can't tell "dead token" apart from "model that doesn't exercise the
 * token".
 */
const LOGICAL_VIEW = read('logical-orders.json');

const PAINT = [
  ['page.color', { page: { color: '#FAFAFA' } }],
  ['ink.strong', { ink: { strong: '#111111' } }],
  ['ink.weak', { ink: { weak: '#444444' } }],
  ['ink.halo', { ink: { halo: '#FFFFF0' } }],
  ['edge.color', { edge: { color: '#545B64' } }],
  ['edge.thickness', { edge: { thickness: 2.4 } }],
  ['edge.tip', { edge: { tip: 'open' } }],
  ['edge.corners', { edge: { corners: 0 } }],
  ['edge.jumps', { edge: { jumps: 'none' } }],
  ['edge.flow', { edge: { flow: 'dashed' } }],
  ['note.background', { note: { background: '#EEEEEE' } }],
  ['note.edge', { note: { edge: '#555555' } }],
  ['note.ink', { note: { ink: '#000000' } }],

  // PAINT for a measured reason, not by nature: Arial and Helvetica have the
  // same advance widths, so within the three-item enum the metric doesn't
  // change. It was this very check that closed the enum — with Verdana in
  // its place, it flagged "moved nothing", which was the engine sizing the
  // band for the wrong font.
  ['text.family', { text: { family: 'Helvetica' } }],
];

/** Paint that only exists in the logical view — measured against the logical model. */
const LOGICAL_PAINT = [
  ['block.background', { block: { background: '#F5F5F5' } }],
  ['block.edge', { block: { edge: '#777777' } }],
  ['block.corners', { block: { corners: 0 } }],
];

const METRIC = [
  // page margin doesn't move anything INSIDE the drawing, but it shifts the
  // whole drawing and changes the page box — geometry, hence metric
  ['page.margin', { page: { margin: 56 } }],
  ['text.label', { text: { label: 16 } }],
  ['text.group', { text: { group: 18 } }],
  ['text.edge', { text: { edge: 16 } }],
  ['text.title', { text: { title: 30 } }],
  ['text.subtitle', { text: { subtitle: 18 } }],
  // #39 flipped the "light" default to true, so the row now moves away FROM
  // the baseline by turning the token off — same metric claim, other direction.
  ['text.qualifier', { text: { qualifier: false } }],
  ['gap.base', { gap: { base: 4 } }],
  ['gap.density', { gap: { density: 1.6 } }],
  // doesn't move anyone, but it ADDS a cell to the title block — and that's
  // exactly why it isn't paint: it changes the set of cells, not just their color
  ['card.revision', { card: { revision: 'Reviewed on 2026-08-21' } }],
];

/**
 * The XML without the theme payload.
 *
 * The first version compared `r.xml === base.xml` raw — and that comparison
 * could NEVER come out true, because `withPatch` renames the theme to
 * `light+patch` and the embedded `panlabsTema` carries the `id`. It was a
 * condition that didn't know how to fire: exactly the defect this tool
 * exists to catch in tokens, right here inside the tool itself. Strip the
 * payload, and "the token painted nothing" becomes detectable again.
 */
function withoutPayload(xml) {
  return xml.replace(/panlabsTema="[^"]*"/, 'panlabsTema=""');
}

/** Geometry signature: id -> x,y,w,h. Paint must not change any of them. */
function geometry(layoutPlan) {
  const m = new Map();
  for (const c of layoutPlan.cells) {
    if (c.kind === 'edge') { m.set(c.id, JSON.stringify(c.points || [])); continue; }
    m.set(c.id, `${Math.round(c.geo.x)},${Math.round(c.geo.y)},${Math.round(c.geo.w)},${Math.round(c.geo.h)}`);
  }
  return m;
}

function differences(a, b) {
  const out = [];
  for (const [id, v] of a) if (!b.has(id)) out.push(`${id}: disappeared`);
  for (const [id, v] of b) {
    if (!a.has(id)) out.push(`${id}: appeared`);
    else if (a.get(id) !== v) out.push(`${id}: ${a.get(id)} -> ${v}`);
  }
  return out;
}

async function main() {
  const base = await generate(MODEL, { theme: 'light', force: true });
  const g0 = geometry(base.layoutPlan);
  const baseLog = await generate(LOGICAL_VIEW, { theme: 'light', force: true });
  const gLog = geometry(baseLog.layoutPlan);
  let failed = 0;

  console.log(`reference: "light" theme · technical ${g0.size} cells · logical ${gLog.size} cells\n`);
  console.log('PAINT — must not move a coordinate');
  for (const [name, patch, isLogical] of [...PAINT, ...LOGICAL_PAINT.map(p => [...p, true])]) {
    const model = isLogical ? LOGICAL_VIEW : MODEL;
    const ref = isLogical ? gLog : g0;
    const refXml = isLogical ? baseLog.xml : base.xml;
    const r = await generate(model, { theme: themeMod.withPatch('light', patch), force: true });
    const d = differences(ref, geometry(r.layoutPlan));
    const inert = withoutPayload(r.xml) === withoutPayload(refXml);
    if (d.length) {
      console.log(`  ✗ ${name.padEnd(20)} moved ${d.length} cell(s): ${d.slice(0, 2).join(' · ')}`);
      failed = 1;
    } else if (inert) {
      // paint that neither moves a coordinate NOR changes the XML is a dead token
      console.log(`  ✗ ${name.padEnd(20)} moved nothing and painted nothing — inert token`);
      failed = 1;
    } else {
      console.log(`  ✓ ${name.padEnd(20)} identical geometry, style changed${isLogical ? '  (logical view)' : ''}`);
    }
  }

  console.log('\nMETRIC — must move something');
  for (const [name, patch] of METRIC) {
    const r = await generate(MODEL, { theme: themeMod.withPatch('light', patch), force: true });
    const d = differences(g0, geometry(r.layoutPlan));
    if (!d.length) { console.log(`  ✗ ${name.padEnd(20)} moved NOTHING — the engine is ignoring the token`); failed = 1; }
    else console.log(`  ✓ ${name.padEnd(20)} moved ${String(d.length).padStart(2)} cell(s)`);
  }

  console.log(failed ? '\nPARTITION BROKEN' : '\npartition intact: paint paints, metric measures');
  process.exit(failed);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
