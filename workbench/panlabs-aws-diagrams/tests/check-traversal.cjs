#!/usr/bin/env node
'use strict';
/**
 * #12's decisions, checked IN THE FILE — not in the prose.
 *
 * Each check here corresponds to a rule measured in the multi-account
 * research that originated #12. The difference between "we decided to
 * suppress the cross-account edge" and "the file has no cross-account edge"
 * is the difference between a meeting note and an engine.
 *
 *   node tools/check-traversal.cjs
 */

const fs = require('fs');
const path = require('path');
const { generate } = require('../../../skills/panlabs-aws-diagrams/engine/generate.cjs');

const HERE = path.join(__dirname, '..');
let failures = 0;

function ok(name, condition, detail) {
  if (condition) { console.log(`  ✓ ${name}${detail ? `  (${detail})` : ''}`); return; }
  failures++;
  console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ''}`);
}

/** Only the first page: it's the consolidated view. */
function consolidatedPage(xml) {
  const m = /<diagram\b[\s\S]*?<\/diagram>/.exec(xml);
  return m ? m[0] : xml;
}

function edgeCells(page) {
  return [...page.matchAll(/<mxCell([^>]*edge="1"[^>]*)>/g)].map(m => m[1]);
}

function attribute(tag, name) {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

/**
 * How many times a crossing enters the interior of an account that is
 * neither its origin nor its destination. It's the rubric's (#8) `A5.5` —
 * an edge cutting through someone else's band — and it's the difference
 * between "I drew the edge" and "I drew it well".
 */
function countIntrusions(cells, crossings, accountBox) {
  let n = 0;
  for (const cell of cells) {
    const t = crossings.find(x => x.id === cell.id);
    if (!t) continue;
    const pts = cell.points || [];
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      for (const [id, cx] of accountBox) {
        if (id === t.accountFrom || id === t.accountTo) continue;
        const inside = p => p.x > cx.x && p.x < cx.x + cx.w && p.y > cx.y && p.y < cx.y + cx.h;
        // orthogonal segment: endpoints inside, or the segment piercing straight through the rectangle
        const crossesH = a.y === b.y && a.y > cx.y && a.y < cx.y + cx.h &&
          Math.min(a.x, b.x) < cx.x + cx.w && Math.max(a.x, b.x) > cx.x;
        const crossesV = a.x === b.x && a.x > cx.x && a.x < cx.x + cx.w &&
          Math.min(a.y, b.y) < cx.y + cx.h && Math.max(a.y, b.y) > cx.y;
        if (inside(a) || inside(b) || crossesH || crossesV) n++;
      }
    }
  }
  return n;
}

async function main() {
  const model = f => JSON.parse(fs.readFileSync(path.join(HERE, 'models', f), 'utf8'));

  // ---------------------------------------------------------------- E1
  console.log('\n1. E1 — the sovereign rule: the consolidated inventory view has no crossing');
  const inv = model('landing-zone-6-accounts.json');
  const rInv = await generate(inv);
  // each node's account, walking up the `inside` chain — without depending on
  // the engine, so the check doesn't measure the engine against itself
  const byId = new Map(inv.nodes.map(n => [n.id, n]));
  const accountOfNode = new Map();
  for (const n of inv.nodes) {
    let c = n, found = null;
    while (c) {
      if (c.kind === 'account') { found = c.id; break; }
      c = c.inside ? byId.get(c.inside) : null;
    }
    accountOfNode.set(n.id, found);
  }

  const crossInModel = (inv.edges || []).filter(a =>
    accountOfNode.get(a.from) && accountOfNode.get(a.to) && accountOfNode.get(a.from) !== accountOfNode.get(a.to));
  ok('the model declares crossings', crossInModel.length > 0, `${crossInModel.length} in the model`);

  const drawnEdges = edgeCells(consolidatedPage(rInv.xml))
    .map(t => ({ from: attribute(t, 'source'), to: attribute(t, 'target') }));
  const drawnCrossings = drawnEdges.filter(a =>
    a.from && a.to && accountOfNode.get(a.from) && accountOfNode.get(a.to) &&
    accountOfNode.get(a.from) !== accountOfNode.get(a.to));
  ok('none of them was drawn on the consolidated page', drawnCrossings.length === 0,
    drawnCrossings.length ? `${drawnCrossings.length} leaked through` : 'zero cross-account connectors');
  ok('the INTRA-account edges are still drawn', drawnEdges.length > 0,
    `${drawnEdges.length} edge(s) on the page`);

  // ---------------------------------------------------------------- G2
  console.log('\n2. G2 — an OU is not a container: floating label, no box');
  ok('the engine decided to draw OU bands', rInv.derived.ou.draw, rInv.derived.ou.because);
  const ouCells = rInv.layoutPlan.cells.filter(c => String(c.id).startsWith('ou-'));
  ok('there is one cell per declared OU', ouCells.length === rInv.derived.ou.ous.length,
    `${ouCells.length} cell(s) for ${rInv.derived.ou.ous.length} OU(s)`);
  ok('none of them is a container', ouCells.every(c => !/container=1/.test(c.style)),
    'no container=1 — the deck has no Organizational unit shape');
  ok('none of them has a border', ouCells.every(c => !/strokeColor=#/.test(c.style)),
    'no strokeColor — the grouping is done by the 1:4 gap contrast (S3)');

  // ---------------------------------------------------------------- S3
  console.log('\n3. S3 — the 1:4 gap contrast between siblings and OU groups');
  const columns = [];
  for (const c of rInv.layoutPlan.cells) {
    if (!/grIcon=mxgraph\.aws4\.group_account/.test(c.style || '')) continue;
    columns.push({ id: c.id, x: c.geo.x, y: c.geo.y, w: c.geo.w, h: c.geo.h });
  }
  const byColumn = new Map();
  for (const c of columns) {
    if (!byColumn.has(c.x)) byColumn.set(c.x, []);
    byColumn.get(c.x).push(c);
  }
  let siblingGap = Infinity;
  for (const list of byColumn.values()) {
    list.sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++)
      siblingGap = Math.min(siblingGap, list[i].y - (list[i - 1].y + list[i - 1].h));
  }
  const xs = [...byColumn.keys()].sort((a, b) => a - b);
  let ouGap = Infinity;
  for (let i = 1; i < xs.length; i++) {
    const previousEnd = Math.max(...byColumn.get(xs[i - 1]).map(c => c.x + c.w));
    ouGap = Math.min(ouGap, xs[i] - previousEnd);
  }
  ok('gap between OU groups ≈ 4× the gap between siblings',
    Number.isFinite(siblingGap) && Number.isFinite(ouGap) && Math.abs(ouGap / siblingGap - 4) < 0.5,
    `siblings ${siblingGap}px · OU ${ouGap}px · ratio ${(ouGap / siblingGap).toFixed(2)}`);

  // ---------------------------------------------------------------- D2
  console.log('\n4. D2 — one detail view per account, ALWAYS (not a fallback)');
  const pages = [...rInv.xml.matchAll(/<diagram id="([^"]+)"/g)].map(m => m[1]);
  const accounts = inv.nodes.filter(n => n.kind === 'account');
  ok('there is 1 consolidated + 1 page per account', pages.length === 1 + accounts.length,
    `${pages.length} page(s) for ${accounts.length} account(s)`);
  ok('every account has its own', accounts.every(c => pages.includes(`${inv.id}-${c.id}`)),
    pages.slice(1).join(', '));

  // ------------------------------------------------------- X1 / E8 / E10
  console.log("\n5. X1/E8/E10 — in the integration view the crossing is drawn, and doesn't turn into spaghetti");
  const integ = model('platform-3-accounts.json');
  const rInt = await generate(integ);
  ok('the engine entered integration mode', rInt.derived.modo.modo === 'integration', rInt.derived.modo.because);
  ok("picked a level from #6 §6.4's hierarchy", rInt.derived.policy.level > 1,
    `level ${rInt.derived.policy.level} — ${rInt.derived.policy.mechanism}`);

  const crossingIds = new Set(rInt.derived.travessias.map(t => t.id));
  const drawn = rInt.layoutPlan.cells.filter(c => c.kind === 'edge' && crossingIds.has(c.id));
  ok('every declared crossing was drawn', drawn.length === crossingIds.size,
    `${drawn.length}/${crossingIds.size}`);

  /**
   * E8: no ceremony at the border — no crossing marker.
   *
   * ⚠️ `jumpStyle` CAME OUT of this list in #23's recertification, and the
   * reason is that it never belonged in it. #6's `E8` talks about a marker AT
   * THE ACCOUNT BOUNDARY: "the line simply passes over the magenta border —
   * there's no AWS convention for a port, gateway, diamond, or crossing
   * marker". `jumpStyle` in mxGraph marks no border at all: it's the jump an
   * edge makes when it crosses ANOTHER EDGE, so the reader sees the two
   * don't connect.
   *
   * As long as the engine never emitted `jumpStyle`, banning the whole family
   * was the cheap way to write "no ceremony" and it cost nothing. #13's theme
   * has the `edge.jumps` token (default `arc`, "high legibility gain, zero
   * cost"), and from the moment the two run together the broad rule started
   * failing something `E8` doesn't prohibit. Narrowing the check to what
   * `E8` says is the fix; loosening the token would be obeying the test.
   */
  const CEREMONY = /startArrow=diamond|endArrow=diamond|startArrow=oval|endArrow=oval/;
  ok('no ceremony at the account border (E8)',
    drawn.every(c => !CEREMONY.test(c.style)),
    'no diamond or crossing marker at the tip');
  /**
   * CONTROL, in both directions. Without it, swapping the regex for `/$^/`
   * would leave the line above green forever — and that's what the previous
   * version had become: it also matched `shape=…gateway`, which NEVER
   * appears on an edge, and the dead alternative went unnoticed because
   * nothing exercised the rule.
   */
  const WITH_DIAMOND = 'edgeStyle=orthogonalEdgeStyle;html=1;endArrow=diamond;endFill=1;';
  const CLEANED = 'edgeStyle=orthogonalEdgeStyle;html=1;endArrow=blockThin;endFill=1;jumpStyle=arc;';
  ok('and the rule FLAGS a diamond at the tip (control)', CEREMONY.test(WITH_DIAMOND),
    'the same rule, over a style with a diamond, fails it');
  ok('and does NOT flag `jumpStyle`, which is a jump between EDGES, not a border marker',
    !CEREMONY.test(CLEANED),
    "#6's E8 talks about a port/diamond at the account boundary, not a line crossing");

  // and the anti-spaghetti check: the line must not cross the INTERIOR of an
  // account that isn't its own. It's the check that tells "I drew the edge"
  // apart from "I drew it well".
  const accountBox = new Map();
  for (const c of rInt.layoutPlan.cells) {
    if (!/grIcon=mxgraph\.aws4\.group_account/.test(c.style || '')) continue;
    const parent = rInt.layoutPlan.cells.find(x => x.id === c.parent);
    const base = parent ? { x: parent.geo.x, y: parent.geo.y } : { x: 0, y: 0 };
    accountBox.set(c.id, { x: base.x + c.geo.x, y: base.y + c.geo.y, w: c.geo.w, h: c.geo.h });
  }
  const intrusions = countIntrusions(drawn, rInt.derived.travessias, accountBox);
  ok('no crossing cuts through the interior of an unrelated account (A5.5)', intrusions === 0,
    intrusions ? `${intrusions} intrusion(s)` : 'the channels and the raceway held');

  // CONTROL EXPERIMENT. A geometric check that only knows how to pass proves
  // nothing — it could be measuring the wrong thing and agreeing with itself.
  // Here the same routine receives the NAIVE route (a straight line end to
  // end, which is what the engine did before the raceway) and has to flag it.
  const first = rInt.derived.travessias[0];
  const originCell = rInt.layoutPlan.cells.find(c => c.id === first.from);
  const destCell = rInt.layoutPlan.cells.find(c => c.id === first.to);
  if (originCell && destCell) {
    const middle = [...accountBox.entries()].find(([id]) =>
      id !== first.accountFrom && id !== first.accountTo);
    if (middle) {
      const [, cx] = middle;
      const y = cx.y + cx.h / 2;
      const straightLine = [{
        id: first.id, kind: 'edge',
        points: [{ x: cx.x - 60, y }, { x: cx.x + cx.w + 60, y }],
      }];
      const flagged = countIntrusions(straightLine, rInt.derived.travessias, accountBox);
      ok('and the check FLAGS it when the route is the naive one (control)', flagged > 0,
        flagged ? `${flagged} intrusion(s) detected on the straight line` : "the check didn't see it — it isn't measuring what it claims to measure");
    }
  }

  // ---------------------------------------------------------------- #34
  console.log("\n6. #34 — the report must not announce an OU band the drawing doesn't have");
  // `platform-3-accounts` is the same model from section 5: 3 accounts,
  // `Workloads` with TWO (c-workload and c-dados) and `c-rede` outside it —
  // the contrast that fires `gatilhoOu` — and integration mode, where
  // `plan.cjs` suppresses the band. It's the corpus case with an OU in
  // integration that #34 asked for.
  ok('the OU trigger fired (real contrast: Workloads×2 outside Infrastructure)',
    rInt.derived.ou.draw, rInt.derived.ou.because);
  const ouInXml = (rInt.xml.match(/OU – /g) || []).length;
  ok('the OU band is not in the .drawio (integration mode suppresses it)', ouInXml === 0,
    `${ouInXml} occurrence(s) of "OU – " in the output`);
  const ouWarning = rInt.report.warnings.find(a => a.startsWith('OU bands'));
  ok('there is a warning about the OU band', Boolean(ouWarning), ouWarning);
  ok("the warning SAYS integration mode doesn't draw it — it doesn't assert what the XML denies",
    Boolean(ouWarning) && /doesn't draw an OU band/.test(ouWarning), ouWarning);

  console.log();
  if (failures) { console.log(`${failures} check(s) failed`); process.exit(1); }
  console.log("#12's decisions are in the file, not just in the README.");
}

main().catch(e => { console.error(e); process.exit(1); });
