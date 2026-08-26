#!/usr/bin/env node
'use strict';
/**
 * The multi-account triggers, isolated from the pixels.
 *
 * Same format as #19's `trigger-az.js`: each case is a minimal architecture
 * whose correct answer is known ahead of time from the multi-account
 * research that originated #12, and the rule has to get every one right.
 * Running this is cheaper than rendering, and it's where the ticket's
 * DECISION lives — the drawing is a consequence.
 *
 *   node tools/check-triggers.cjs
 */

const { arvore, gatilhoOu, modoDeContas, travessias, politicaDeTravessia } =
  require('../../../skills/panlabs-aws-diagrams/engine/derive.cjs');

let failures = 0;
function testCase(name, model, expected, getResult) {
  const t = arvore(model);
  const got = getResult(model, t);
  const ok = Object.entries(expected).every(([k, v]) => JSON.stringify(got[k]) === JSON.stringify(v));
  if (!ok) {
    failures++;
    console.log(`  ✗ ${name}`);
    for (const [k, v] of Object.entries(expected))
      if (JSON.stringify(got[k]) !== JSON.stringify(v))
        console.log(`      ${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(got[k])}`);
    console.log(`      because: ${got.because || '—'}`);
  } else {
    console.log(`  ✓ ${name}  (${got.because || 'no justification'})`);
  }
}

const account = (id, ou) => ({ id, kind: 'account', account: '000000000000', inside: 'cloud', ...(ou ? { ou } : {}) });
const inside = (id, parent) => ({ id, kind: 'service', service: 's3', inside: parent });
const cloud = { id: 'cloud', kind: 'cloud' };
const mod = (nodes, edges) => ({ nodes: [cloud, ...nodes], edges: edges || [] });

// ------------------------------------------------------------- OU trigger

console.log('\n1. OU trigger — an OU only becomes a band when it GROUPS something');

testCase('no OU declared', mod([account('a'), account('b')]),
  { draw: false }, gatilhoOu);

testCase('a single OU, with two accounts — separates nothing',
  mod([account('a', 'Workloads'), account('b', 'Workloads')]),
  { draw: false }, gatilhoOu);

testCase('two OUs, one account each — the account label already says it',
  mod([account('a', 'Security'), account('b', 'Workloads')]),
  { draw: false }, gatilhoOu);

testCase('two OUs, one of them with two accounts — NOW it groups',
  mod([account('a', 'Security'), account('b', 'Security'), account('c', 'Workloads')]),
  { draw: true, ous: ['Security', 'Workloads'] }, gatilhoOu);

testCase('the account outside any OU does not invent one (Management is root — P2)',
  mod([account('mgmt'), account('a', 'Security'), account('b', 'Security')]),
  { draw: true, ous: ['Security'] }, gatilhoOu);

// -------------------------------------------------------------- view mode

console.log('\n2. mode — inventory (a placement map) vs. integration (the crossing is the point)');

const crossing = (from, to, label) => ({ from, to, ...(label ? { label } : {}) });

testCase('a single account is not a multi-account diagram',
  mod([account('a'), inside('x', 'a')]),
  { modo: 'none' }, modoDeContas);

testCase('two accounts with no crossing — it is inventory (E1: no edge)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b')]),
  { modo: 'inventario' }, modoDeContas);

testCase('three accounts with two crossings — integration (X1)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('c'), inside('z', 'c')],
    [crossing('x', 'y'), crossing('x', 'z')]),
  { modo: 'integracao' }, modoDeContas);

testCase('five accounts — above what the integration view can hold (X1: 2 to 4)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('c'), inside('z', 'c'),
    account('d'), inside('w', 'd'), account('e'), inside('v', 'e')],
    [crossing('x', 'y')]),
  { modo: 'inventario' }, modoDeContas);

testCase('an edge coming in from the street is not an account crossing',
  mod([{ id: 'actor', kind: 'actor', service: 'users' }, account('a'), inside('x', 'a'), account('b'), inside('y', 'b')],
    [crossing('actor', 'x')]),
  { modo: 'inventario' }, modoDeContas);

testCase('two accounts, eight crossings — beyond what the official corpus shows (2 to 7)',
  mod([account('a'), ...Array.from({ length: 8 }, (_, i) => inside('x' + i, 'a')),
    account('b'), ...Array.from({ length: 8 }, (_, i) => inside('y' + i, 'b'))],
    Array.from({ length: 8 }, (_, i) => crossing('x' + i, 'y' + i))),
  { modo: 'inventario' }, modoDeContas);

// ------------------------------------------------- 6-level hierarchy (#6)

console.log("\n3. crossing policy — #6 §6.4's fallback hierarchy");

function policy(model, t) {
  const edges = (model.edges || []).map((a, i) => ({ ...a, id: a.id || `e${i}` }));
  const m = modoDeContas(model, t, edges);
  return politicaDeTravessia(m.modo, travessias(edges, t), t);
}

testCase('inventory suppresses everything — the sovereign rule (E1)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('c'), inside('z', 'c'),
    account('d'), inside('w', 'd'), account('e'), inside('v', 'e')],
    [crossing('x', 'y')]),
  { level: 1, mecanismo: 'suprimir' }, policy);

testCase('fan-in of 2 accounts into the same destination collapses into one labeled edge (E3)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('log'), inside('bucket', 'log')],
    [crossing('x', 'bucket'), crossing('y', 'bucket')]),
  { level: 3, mecanismo: 'agregada' }, policy);

testCase('the same origin to 2 sibling accounts becomes a bus (E4)',
  mod([account('hub'), inside('tgw', 'hub'), account('a'), inside('x', 'a'), account('b'), inside('y', 'b')],
    [crossing('tgw', 'x'), crossing('tgw', 'y')]),
  { level: 4, mecanismo: 'bus' }, policy);

testCase('two accounts and one crossing — direct edge, no ceremony (E10)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b')],
    [crossing('x', 'y')]),
  { level: 6, mecanismo: 'direta' }, policy);

testCase('same origin, but DIFFERENT relationships — a bus would lie (E4 requires the same link)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('c'), inside('z', 'c')],
    [crossing('x', 'y', 'VPC peering'), crossing('x', 'z', 'PutEvents')]),
  { level: 6, mecanismo: 'direta' }, policy);

testCase('same origin and the SAME labeled link — now a bus, yes',
  mod([account('hub'), inside('tgw', 'hub'), account('a'), inside('x', 'a'), account('b'), inside('y', 'b')],
    [crossing('tgw', 'x', 'VPC peering'), crossing('tgw', 'y', 'VPC peering')]),
  { level: 4, mecanismo: 'bus' }, policy);

testCase('fan-in with different relationships does not aggregate — one label would lie (E3)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('log'), inside('bucket', 'log')],
    [crossing('x', 'bucket', 'access logs'), crossing('y', 'bucket', 'nightly backup')]),
  { level: 6, mecanismo: 'direta' }, policy);

console.log();
if (failures) { console.log(`${failures} case(s) wrong`); process.exit(1); }
console.log('triggers ok');
