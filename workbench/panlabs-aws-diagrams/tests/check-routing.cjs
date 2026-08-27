#!/usr/bin/env node
'use strict';
/**
 * #24's ROUTING BUDGET — and it measures the drawing that got rejected.
 *
 * #14's human inspection rejected the technical view for arrows on top of
 * icons; #18's validator named what the eye saw; #12's engine improved and
 * didn't close the account. This file is that account, and it has two parts.
 *
 *   ┌ TRUTHFULNESS, across the whole corpus. `A5.5` is the edge that crosses
 *   │ a network boundary it neither leaves from nor heads to — the drawing
 *   │ asserting a path the model denies. The rubric (#8) puts ZERO tolerance
 *   │ on it, and #18 confirmed that. It applies to every page of every
 *   │ model, not just the technical view: a spurious crossing is no less of
 *   │ a lie for being in a diagram nobody looked at.
 *   │
 *   └ READABILITY, in the technical view. `A3.5` (edge over an icon) and
 *     `A3.4` (edge over a label) are the symptom human inspection saw
 *     without seeing any number, and `A5.1` is the crossing, which carries a
 *     budget instead of zero tolerance — the rubric accepts 2.
 *
 * ⚠️ WHAT THIS FILE IS NOT: a second validator. It measures nothing on its
 * own — it calls #18's and compares against a written budget. #18's decision
 * 2 still holds: what corrects is `layout`/`align`, what judges is the
 * validator, and a number in a test is not a correction loop.
 *
 * ⚠️ And it is EXACT, not "less than or equal": a budget that accepts
 * anything below the ceiling lets an improvement pass unrecorded, and the
 * ticket wants the number. When the drawing improves, this file has to be
 * updated on purpose — the same contract as `check-good.cjs`'s quarantine.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));
const { validateGeometry } = require(path.join(ROOT, 'validator', 'validate-geometry.cjs'));
const { approve } = require(path.join(ROOT, 'session', 'agreement.cjs'));
const { elaborate } = require(path.join(ROOT, 'session', 'elaborate.cjs'));
const { project } = require(path.join(ROOT, 'session', 'project.cjs'));

/**
 * THE TECHNICAL VIEW IS NOT A `models/*.json`.
 *
 * It's born from #14's session — `retail-logical` approved, `retail-elaboration`
 * applied on top, and the projection cutting out the technical layer. Measuring
 * only the corpus would leave out exactly the drawing this ticket exists to
 * fix, and that's why #14's suite stayed green over a drawing human inspection
 * rejected: it measured the projection, not the routing.
 */
function technicalView() {
  const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'session', f), 'utf8'));
  const approved = approve(read('retail-logical.json'), { at: '2026-08-21', by: 'user', candidate: 'cand-a' });
  return project(elaborate(approved, read('retail-elaboration.json')), 'technical').model;
}

/** The ticket's budget, summed over ALL of the technical view's pages. */
const TECHNICAL_BUDGET = {
  'A5.5': 0,   // zero tolerance — it's truthfulness, not taste
  'A3.5': 0,   // the arrow over the icon the human saw
  'A3.4': 0,   // and the arrow over the label
};

function occurrences(report, id) {
  const x = [...report.resultados, ...report.extras].find(r => r.id === id);
  return x ? { n: x.occurrences.length, state: x.state, det: x.occurrences.map(o => o.o_que) } : null;
}

/**
 * THE PRIMITIVE, against hand-written cases.
 *
 * `corredorLivre` is #24's new lever, and it's pure: band + obstacles +
 * preference go in, one coordinate comes out. Checking it only through the
 * whole drawing would mean checking the sum of ten decisions — and when the
 * number changed, nobody would know which of them changed. The cases below
 * are the ones the engine actually encounters, reduced to the minimum that
 * tells them apart.
 */
function primitive() {
  const { corredorLivre } = require(path.join(ROOT, 'engine', 'layout.cjs'));
  // `corredorLivre` still expects obstacle boxes shaped exactly `{ini,fim,lo,hi}`
  // — that's engine/layout.cjs's own contract, unrenamed; match it verbatim.
  const cellBox = (ini, fim, lo, hi) => ({ ini, fim, lo, hi });

  // the three columns of `web-flow-3-az`, on the band the leg crosses
  const grid = [cellBox(48, 248, 0, 800), cellBox(339, 539, 0, 800), cellBox(630, 830, 0, 800)];

  const cases = [
    { name: 'a preference that is already free passes through unchanged',
      r: corredorLivre([100, 300], grid, 584.5), expected: 584.5 },
    { name: 'a preference INSIDE a column falls into the neighboring gap',
      r: corredorLivre([100, 300], grid, 538), expected: 584.5 },
    { name: 'and it picks the gap on the origin side, not the widest one',
      r: corredorLivre([100, 300], grid, 350), expected: 293.5 },
    { name: "an obstacle that doesn't cross the band doesn't count",
      r: corredorLivre([0, 50], [cellBox(339, 539, 100, 800)], 400), expected: 400 },
    { name: 'flush against the border is not crossing it',
      r: corredorLivre([100, 300], grid, 539), expected: 539 },
    { name: 'with no obstacle at all, returns the preference',
      r: corredorLivre([100, 300], [], 42), expected: 42 },
    // the guarantee that makes the return value always a number: the outer
    // margins are free by construction, so the search never comes back empty-handed
    { name: 'everything blocked exits through the nearest margin',
      r: corredorLivre([100, 300], [cellBox(0, 1000, 0, 800)], 400), expected: -24 },
    { name: 'and through the RIGHT margin when the preference is on that side',
      r: corredorLivre([100, 300], [cellBox(0, 1000, 0, 800)], 900), expected: 1024 },
  ];

  let failed = 0;
  console.log("\n  corredorLivre — the lever the workaround didn't have\n");
  for (const c of cases) {
    const ok = Math.abs(c.r - c.expected) < 0.001;
    if (!ok) failed = 1;
    console.log(`  ${ok ? '✓' : '✗'} ${c.name}` + (ok ? '' : `  — expected ${c.expected}, got ${c.r}`));
  }
  return failed;
}

/**
 * THE TWO-ROW GRID, WHICH IS WHERE #110's TRADE ACTUALLY GETS DECIDED.
 *
 * `quorum-3-az` is the corpus's triangle graph, and its detour comes out SOUTH
 * of every band because that margin is the one nearer the midpoint. Stack the
 * VPCs two rows deep and put the same triangle in the TOP row and the nearer
 * margin flips north — into the cloud's label row, with the two verticals
 * crossing the VPC's title row. That is an `A3.4`, it does not block, and the
 * same model reports the same single `A3.4` with the fix reverted.
 *
 * The alternative was to forbid north outright and always take the south row.
 * Measured on this exact model, it makes the crossbar clear every band and
 * then drags both verticals down past the BOTTOM row's subnets: `A5.5` ×3, a
 * lie about the network, in exchange for a note about legibility.
 *
 * No corpus model has two VPC rows and a triangle, so nothing here would have
 * caught the reversal. This is that model, and it lives in the test rather
 * than in `models/` because what it pins is one routing decision, not an
 * architecture anybody would draw.
 */
function twoRowGrid() {
  const zone = (vpc, z, n) => ([
    { id: `${vpc}-${z}`, kind: 'subnet', label: 'App subnet', access: 'private',
      az: `us-east-1${z}`, cidr: `10.${n}.${z.charCodeAt(0) - 96}.0/24`, inside: vpc },
    { id: `svc-${vpc}-${z}`, kind: 'service', service: 'msk', label: `Broker ${vpc}${z}`,
      inside: `${vpc}-${z}` },
  ]);
  return {
    schema: 'panlabs-aws-diagrams/model@1', id: 'two-row-grid',
    title: 'Two stacked VPC rows, the triangle in the top one',
    view: 'technical', genre: 'T1',
    nodes: [
      { id: 'cloud', kind: 'cloud', label: 'AWS Cloud' },
      { id: 'vpc1', kind: 'vpc', label: 'Top VPC · 10.1.0.0/16', cidr: '10.1.0.0/16', inside: 'cloud' },
      ...['a', 'b', 'c'].flatMap(z => zone('vpc1', z, 1)),
      { id: 'vpc2', kind: 'vpc', label: 'Bottom VPC · 10.2.0.0/16', cidr: '10.2.0.0/16', inside: 'cloud' },
      ...['a', 'b', 'c'].flatMap(z => zone('vpc2', z, 2)),
    ],
    // every pair, so no lane order puts the three of them side by side (#21)
    edges: [['a', 'b'], ['b', 'c'], ['a', 'c']].map(([x, y]) =>
      ({ from: `svc-vpc1-${x}`, to: `svc-vpc1-${y}`, label: 'replica', protocol: 'kafka' })),
  };
}

/**
 * THE ONE ROUTING DEFECT NO VALIDATOR FAMILY CAN EVER REPORT.
 *
 * `scene.cjs` keeps a `CHROME` set — `title`, `subtitle`, `notes`,
 * `panlabs-modelo` — out of the scene on purpose: they are the page's
 * furniture, not the diagram's content, and measuring a legend block as if it
 * were an architecture element would make every family lie. The consequence is
 * that an edge drawn straight through the note block is INVISIBLE to `A3.4`,
 * to `A3.5`, to all of them. It cannot be a finding, so it has to be a test.
 *
 * And the grid genuinely routes there. In column mode an AZ band is a
 * full-height strip that already overflows the cloud by `CROSS_OUT`, so
 * getting around one means a row past its end — and for `quorum-3-az` the
 * nearer end is the south one, outside the cloud by construction. #110 sent
 * that far pair down that row and it came out on top of the legend, one green
 * report later. `plan.cjs` now starts the footer below whatever the routing
 * drew instead of below the cloud, and this is what holds it there.
 */
function chromeIsClear(name, layoutPlan) {
  const geo = require(path.join(ROOT, 'validator', 'geometry.cjs'));
  const { createScene } = require(path.join(ROOT, 'validator', 'scene.cjs'));
  // `panlabs-modelo` is a 1×1 data marker at the origin, not ink on the page
  const INK = new Set(['title', 'subtitle', 'notes']);

  const scene = createScene(layoutPlan);
  const chrome = (layoutPlan.cells || []).filter(c => INK.has(c.id) && c.geo);
  const hits = [];
  for (const c of chrome) {
    const box = { x: c.geo.x, y: c.geo.y, w: c.geo.w, h: c.geo.h };
    for (const a of scene.edges) {
      if (!a.complete) continue;
      if (geo.polilinhaCruzaRetangulo(a.points, box))
        hits.push(`${name}: edge "${a.id}" runs through the page's "${c.id}"`);
    }
  }
  return hits;
}

async function main() {
  let failed = primitive();

  // ---------------------------------------------------------- 1 · truthfulness, across the corpus
  console.log('\n  A5.5 — edge crossing a boundary it has no business with (zero tolerance, whole corpus)\n');
  // full paths, not bare names — web-multi-az moved to the skill's own
  // `examples/` (#44), and "whole corpus" still means whole corpus
  const corpus = [
    ...fs.readdirSync(path.join(WORKBENCH, 'models')).filter(f => f.endsWith('.json')).map(f => path.join(WORKBENCH, 'models', f)),
    ...fs.readdirSync(path.join(ROOT, 'examples')).filter(f => f.endsWith('.json')).map(f => path.join(ROOT, 'examples', f)),
  ].sort();
  const entries = [
    ...corpus.map(f => ({ name: path.basename(f, '.json'),
      model: JSON.parse(fs.readFileSync(f, 'utf8')) })),
    { name: 'technical view (#14 session)', model: technicalView() },
    { name: 'two stacked VPC rows (#110)', model: twoRowGrid() },
  ];

  let crossings = 0;
  const onChrome = [];
  for (const { name, model } of entries) {
    const r = await generate(model);
    for (const p of [r.layoutPlan, ...r.pages]) {
      const a55 = occurrences(validateGeometry(p), 'A5.5');
      onChrome.push(...chromeIsClear(`${name} · page "${p.id}"`, p));
      if (!a55) { failed = 1; console.log(`  ‼ ${name}: A5.5 did not run`); continue; }
      if (!a55.n) continue;
      failed = 1; crossings += a55.n;
      console.log(`  ✗ ${name} · page "${p.id}": A5.5 ×${a55.n}`);
      for (const o of a55.det) console.log(`      · ${o}`);
    }
  }
  console.log(`  ${crossings ? '✗' : '✓'} ${crossings} spurious crossing(s) in the corpus — the budget is 0`);

  // ----------------------------------- 1b · and the routing stays off the page's chrome (#110)
  console.log("\n  the routing lands on no page furniture — the defect no family reports\n");
  if (onChrome.length) failed = 1;
  for (const o of onChrome) console.log(`  ✗ ${o}`);
  console.log(`  ${onChrome.length ? '✗' : '✓'} ${onChrome.length} edge(s) over a title, subtitle or note block — the budget is 0`);

  // -------------------------------- 1c · the band is an obstacle, on BOTH margins (#110)
  //
  // `A5.5` above already covers the south choice. What only this model can say
  // is that the NORTH one stays truthful too — see `twoRowGrid`'s header for
  // the trade, and note that F2 is the finding that would come back if the
  // band ever stopped being an obstacle at all.
  console.log('\n  the detour clears every band it does not belong to, on either margin\n');
  const twoRow = validateGeometry((await generate(twoRowGrid())).layoutPlan);
  const lies = twoRow.semantic.map(m => `${m.id}×${m.occurrences.length}`);
  if (lies.length) failed = 1;
  for (const m of twoRow.semantic) for (const o of m.occurrences) console.log(`      · ${o.o_que}`);
  console.log(`  ${lies.length ? '✗' : '✓'} two stacked VPC rows, triangle in the top one: ` +
    `${lies.length ? lies.join(', ') : 'no semantic failure'} — the budget is 0`);

  // -------------------------------------------------- 2 · legibility, in the technical view
  //
  // ⚠️ ALL OF THE VIEW'S PAGES, not just the consolidated one.
  //
  // Since #12 the multi-account technical view is 1+N pages (#6's `D2`), and
  // the first version of this file only measured the first one. It passed —
  // and `retail-300-stores-technical-processing` was still carrying `A3.4`
  // ×1. Measuring the consolidated page and calling it "the technical view"
  // is the same scoping mistake that left #14's suite green over a drawing
  // rejected by eye: the measurement's cut didn't match the delivery's cut.
  console.log("\n  #14's technical view — the drawing human inspection rejected\n");
  const rt = await generate(technicalView());
  const pages = [rt.layoutPlan, ...rt.pages];
  const reports = pages.map(p => ({ page: p.id, report: validateGeometry(p) }));

  for (const [id, ceiling] of Object.entries(TECHNICAL_BUDGET)) {
    let total = 0, missing = false;
    const det = [];
    for (const { page, report: l } of reports) {
      const x = occurrences(l, id);
      if (!x) { missing = true; console.log(`  ‼ ${id} did not run on "${page}"`); continue; }
      total += x.n;
      for (const o of x.det) det.push(`${page}: ${o}`);
    }
    const ok = !missing && total === ceiling;
    if (!ok) failed = 1;
    console.log(`  ${ok ? '✓' : '✗'} ${id} ×${total} across ${pages.length} page(s)  (budget ${ceiling})`);
    if (!ok) for (const o of det.slice(0, 4)) console.log(`      · ${o}`);
  }
  const report = reports[0].report;   // `A5.1` is the consolidated page's — see below

  /**
   * `A5.1` is the only one in the ticket with a BUDGET instead of zero
   * tolerance, and the ruler is the rubric's own: the validator already knows
   * how many crossings it tolerates before turning into a failure
   * (`failBudget` in the measurement). Reimplementing the number here would
   * be a second copy of the threshold — and #18 measured the price of having
   * two copies of a threshold.
   */
  const a51 = occurrences(report, 'A5.1');
  const measured = [...report.resultados].find(r => r.id === 'A5.1');
  const inside = a51 && a51.state !== 'failure';
  if (!inside) failed = 1;
  console.log(`  ${inside ? '✓' : '✗'} A5.1 ${measured ? `${measured.measured.crossings} crossing(s), budget ${measured.measured.failBudget}` : '—'}` +
    ` → ${a51 ? a51.state : 'did not run'}`);

  console.log(failed
    ? "\n  ✗ the technical view's routing is outside #24's budget\n"
    : '\n  ✓ the routing fits the budget: no spurious crossing, no arrow over an icon or label.\n');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
