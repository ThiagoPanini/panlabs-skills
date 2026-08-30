#!/usr/bin/env node
'use strict';
/**
 * #199 — a long flow on the `elk` path renders as a panoramic strip
 * (measured in practice: 4.6:1 to 12.1:1) instead of breaking into rows.
 * `engine/layout.cjs`'s `wrapIfTooWide` asks ELK's OWN native row-wrapping
 * (`elk.layered.wrapping.strategy`) for a second, wrapped pass once the
 * first one measures past `MAX_PAGE_RATIO` — never before, so a model that
 * was already compliant never touches this code at all.
 *
 * Two things ELK's feature does NOT do on its own, both measured directly
 * against the vendored build and both fixed before a wrap is ever attempted:
 *
 *   1. wrapping is silently INERT under the engine's usual
 *      `elk.hierarchyHandling: INCLUDE_CHILDREN` — it only does anything
 *      under `SEPARATE_CHILDREN`, which solves the wrapped container as its
 *      own independent problem.
 *   2. `SEPARATE_CHILDREN` throws `java.util.NoSuchElementException` on any
 *      edge that carries a label object — and every numbered or described
 *      edge in this engine carries one.
 *
 * `SEPARATE_CHILDREN` buys a THIRD problem `wrapIfTooWide` has to defend
 * against instead of fix: it isolates every level it touches, so an edge
 * reaching into the wrapped container from outside it — an external actor,
 * a sibling group — comes back with no route at all. Reconstructing that
 * route by hand would be a second router competing with ELK's own; instead
 * the engine verifies, after the fact, that EVERY model edge still has one,
 * and falls back to the original, honestly over-ratio, single-row layout
 * the moment it doesn't.
 *
 * Four levels of proof:
 *
 *   1. UNIT — the exported helpers (`flowContainers`, `hasForeignEdge`,
 *      `prepareForWrap`) on hand-built graphs, independent of ELK's own
 *      quirks on any one real model.
 *   2. END TO END, SAFE CASE — a real corpus model whose flow container has
 *      no foreign edge: the page narrows under the ceiling, and it does so
 *      without losing a single edge.
 *   3. END TO END, UNSAFE CASE — a real corpus model whose flow reaches
 *      outside its own container: the page stays over-ratio, honestly, and
 *      still without losing a single edge — the wrap that would have broken
 *      one never gets returned.
 *   4. UNTOUCHED CASE — a model already under the ceiling never enters
 *      `wrapIfTooWide`'s loop at all: `passadas`/`wrapped` say so directly.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const layout = require(path.join(ROOT, 'engine', 'layout.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));
const { derive } = require(path.join(ROOT, 'engine', 'derive.cjs'));
const resolverMod = require(path.join(ROOT, 'engine', 'resolve.cjs'));
const themeMod = require(path.join(ROOT, 'theme', 'theme.cjs'));
const { MAX_PAGE_RATIO } = require(path.join(ROOT, 'engine', 'page-ratio.cjs'));

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

(async () => {
// ---------------------------------------------------------------------------
console.log('\n1 · unit — flowContainers / hasForeignEdge / prepareForWrap on hand-built graphs\n');

{
  const flat = { id: 'root', children: [{ id: 'cloud', children: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }] };
  const found = new Set();
  layout.flowContainers(flat, found);
  ok(found.has('cloud') && found.size === 1, 'flowContainers finds a container whose children are all leaves', [...found].join(','));
}

{
  // a container that itself holds a container is never a target — path B's
  // VPC/subnet nesting must not be mistaken for a flat flow row.
  const nested = { id: 'root', children: [{ id: 'vpc', children: [{ id: 'subnet', children: [{ id: 'a' }, { id: 'b' }] }] }] };
  const found = new Set();
  layout.flowContainers(nested, found);
  ok(found.has('subnet') && !found.has('vpc'), 'flowContainers descends past a mixed container to the flat one beneath it', [...found].join(','));
}

{
  const graph = {
    id: 'root', edges: [{ id: 'e0', sources: ['outsider'], targets: ['a'] }],
    children: [
      { id: 'outsider' },
      {
        id: 'cloud', edges: [{ id: 'e1', sources: ['a'], targets: ['b'] }],
        children: [{ id: 'a' }, { id: 'b' }],
      },
    ],
  };
  const own = new Set(['cloud', 'a', 'b']);
  ok(layout.hasForeignEdge(graph, own), 'hasForeignEdge catches an edge with exactly one end outside the target', '');

  const wholeGraph = new Set(['root', 'outsider', 'cloud', 'a', 'b']);
  ok(!layout.hasForeignEdge(graph, wholeGraph), 'and clears once the target widens to include both ends', '');
}

{
  // prepareForWrap must survive an edge that carries a label object — the
  // exact shape that crashes ELK's wrapping processor if handed through —
  // by moving the edge onto the target and dropping the label, not the edge.
  const graph = {
    id: 'root',
    children: [{
      id: 'cloud', layoutOptions: { 'elk.layered.spacing.nodeNodeBetweenLayers': '40' },
      edges: [{ id: 'e0', sources: ['a'], targets: ['b'], labels: [{ id: 'e0-rot', text: '1. regra', width: 60, height: 14 }] }],
      children: [{ id: 'a' }, { id: 'b' }],
    }],
    edges: [],
  };
  const own = new Set(['cloud', 'a', 'b']);
  layout.prepareForWrap(graph, 'cloud', 2.2, own);
  const cloud = graph.children[0];
  ok(graph.layoutOptions['elk.hierarchyHandling'] === 'SEPARATE_CHILDREN', 'prepareForWrap sets SEPARATE_CHILDREN at the root', '');
  ok(cloud.layoutOptions['elk.layered.wrapping.strategy'] === 'SINGLE_EDGE', 'and SINGLE_EDGE wrapping on the target', '');
  ok(cloud.edges.length === 1 && !cloud.edges[0].labels, 'the edge survives on the target with its label object stripped', JSON.stringify(cloud.edges[0]));
  ok(Number(cloud.layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers']) > 40,
    'and the label\'s width is bought back as extra inter-layer spacing', cloud.layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers']);
}

// ---------------------------------------------------------------------------
console.log('\n2 · end to end, safe case — a real over-ratio model narrows, with every edge kept\n');

const geoOf = xml => {
  const m = xml.match(/<mxGraphModel[^>]*pageWidth="(\d+)"[^>]*pageHeight="(\d+)"/);
  return m && { w: Number(m[1]), h: Number(m[2]) };
};
const edgeCellCount = xml => (xml.match(/edge="1"/g) || []).length;

{
  const model = require(path.join(WORKBENCH, 'models', 'logical-orders.json'));
  const res = resolverMod.create(themeMod.load('light'));
  const d = derive(model);
  const direct = await layout.porElk(model, d, res);
  ok(direct.wrapped === true, 'sanity: this model genuinely needed and got a wrap — a check that could not fail is not a check', JSON.stringify({ wrapped: direct.wrapped, passadas: direct.passadas }));

  const r = await generate(model, { theme: 'light', gate: 'none' });
  const geo = geoOf(r.xml);
  const ratio = geo.w / geo.h;
  ok(ratio <= MAX_PAGE_RATIO, `logical-orders.json narrows to within ${MAX_PAGE_RATIO}:1`, `${geo.w}x${geo.h} = ${ratio.toFixed(2)}:1`);
  ok(edgeCellCount(r.xml) === model.edges.length,
    'and every edge the model declares reached the drawing — none silently dropped by the wrap',
    `model=${model.edges.length} emitted=${edgeCellCount(r.xml)}`);
}

// ---------------------------------------------------------------------------
console.log('\n3 · end to end, unsafe case — a flow an outsider reaches into stays wide, honestly, never at the cost of an edge\n');

{
  const model = require(path.join(WORKBENCH, 'models', 'analytics-pipeline.json'));
  const r = await generate(model, { theme: 'light', gate: 'none' });
  const geo = geoOf(r.xml);
  const ratio = geo.w / geo.h;
  ok(ratio > MAX_PAGE_RATIO,
    'analytics-pipeline.json (an outsider actor edges into the flow container) stays over the ceiling — no safe wrap boundary exists',
    `${geo.w}x${geo.h} = ${ratio.toFixed(2)}:1`);
  ok(edgeCellCount(r.xml) === model.edges.length,
    'and it stays CORRECT while doing so — every edge still reaches the drawing, none traded away for a ratio the engine could not safely buy',
    `model=${model.edges.length} emitted=${edgeCellCount(r.xml)}`);
}

// ---------------------------------------------------------------------------
console.log("\n4 · untouched case — a compliant model never enters wrapIfTooWide's loop\n");

{
  const model = require(path.join(WORKBENCH, 'models', 'orders-serverless.json'));
  const res = resolverMod.create(themeMod.load('light'));
  const d = derive(model);
  const before = geoOf((await generate(model, { theme: 'light', gate: 'none' })).xml);
  ok(before.w / before.h <= MAX_PAGE_RATIO, 'sanity: this model is already within the ceiling', `${before.w}x${before.h}`);
  const result = await layout.porElk(model, d, res);
  ok(!result.wrapped, 'porElk() never sets `wrapped` for a model that was already compliant', JSON.stringify({ wrapped: result.wrapped, passadas: result.passadas }));
}

// ---------------------------------------------------------------------------
console.log(failures ? `\n  ✗ ${failures} failure(s)` : '\n  ✓ a long flow wraps into rows when it safely can, and stays honestly wide when it cannot.');
process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
