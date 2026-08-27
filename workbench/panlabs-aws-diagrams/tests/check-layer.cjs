#!/usr/bin/env node
'use strict';
/**
 * The layer rule, isolated from the pixel.
 *
 * Three families of cases:
 *
 *   1. THE TICKET'S TABLE — the three models, and the order an architect
 *      expects, against the order the alphabet gave. It is the proof #22
 *      asked for.
 *   2. THE READING — catalog category -> floor, mixing, escape, divergence.
 *   3. THE GAP — where the missing fact refuses, and where it only warns.
 *
 * The "alphabet" column is not decorative: without it the ticket's table
 * would be an assertion, and with it it is a comparison. A case where the two
 * rules agree proves nothing about which one is in force — and one of the
 * three is exactly like that.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');

const { derive } = require(path.join(ROOT, 'engine', 'derive.cjs'));
const layers = require(path.join(ROOT, 'engine', 'layers.cjs'));
const dispor = require(path.join(ROOT, 'engine', 'layout.cjs'));
const resolverMod = require(path.join(ROOT, 'engine', 'resolve.cjs'));
const { validate } = require(path.join(ROOT, 'engine', 'validate.cjs'));
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema.json'), 'utf8'));

const res = resolverMod.create(require(path.join(ROOT, 'theme', 'theme.cjs')).load('light'));
const cat = res.cat;

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

function load(name, dir = 'models') {
  const m = JSON.parse(fs.readFileSync(path.join(WORKBENCH, dir, `${name}.json`), 'utf8'));
  const v = validate(m, SCHEMA);
  if (!v.ok) throw new Error(`${name}: invalid model (${v.fase}) — ${v.errors[0]}`);
  return m;
}

/** The order of private ROLES the grid would stack, top to bottom. */
function contentOrder(model) {
  const d = derive(model, { cat });
  const roles = [...layers.papeisDeSubnet(model, d.t, d.layers).values()];
  const accessOrder = { public: 0, private: 1, '?': 2 };
  return roles
    .sort((a, b) =>
      (accessOrder[a.access] ?? 9) - (accessOrder[b.access] ?? 9) ||
      layers.layerOrder(a.layer) - layers.layerOrder(b.layer) ||
      a.label.localeCompare(b.label, 'pt'))
    .map(p => p.label);
}

/** The order the OLD rule would give: exposure, then alphabet. This is the "before". */
function alphabeticalOrder(model) {
  const d = derive(model, { cat });
  const roles = [...layers.papeisDeSubnet(model, d.t, d.layers).values()];
  const accessOrder = { public: 0, private: 1, '?': 2 };
  return roles
    .sort((a, b) =>
      (accessOrder[a.access] ?? 9) - (accessOrder[b.access] ?? 9) ||
      a.label.localeCompare(b.label, 'pt'))
    .map(p => p.label);
}

(async () => {
// ---------------------------------------------------------------------------
console.log("\n1 · the ticket's table — the chosen rule against the alphabetical placeholder\n");

const TABLE = [
  { model: 'app-data', expect: ['App subnet', 'Data subnet'] },
  { model: 'web-data', expect: ['Web subnet', 'Data subnet'] },
  { model: 'ingest-core', expect: ['Ingest subnet', 'Core subnet'] },
];

let alphabetGotItRight = 0;
for (const testCase of TABLE) {
  const m = load(testCase.model);
  const fresh = contentOrder(m);
  const old = alphabeticalOrder(m);
  const freshRight = JSON.stringify(fresh) === JSON.stringify(testCase.expect);
  const oldRight = JSON.stringify(old) === JSON.stringify(testCase.expect);
  if (oldRight) alphabetGotItRight++;
  ok(freshRight, `${testCase.model.padEnd(14)} content → ${fresh.join(' · ')}`,
    `alphabet → ${old.join(' · ')} ${oldRight ? '(also right)' : '✗ WRONG'}`);
}
ok(alphabetGotItRight === 1,
  'the alphabet gets exactly 1 of the 3 right',
  `got ${alphabetGotItRight} right — if it got all 3, the table would not distinguish the two rules`);

// ---------------------------------------------------------------------------
console.log('\n2 · the reading: catalog category → network floor\n');

const READING = [
  ['ecs', 'containers', 'application'],
  ['ec2', 'compute', 'application'],
  ['rds', 'database', 'data'],
  ['aurora', 'database', 'data'],
  ['redshift', 'analytics', 'data'],
  ['efs', 'storage', 'data'],
  ['network load balancer', 'network_content_delivery', 'edge'],
  ['nat gateway', 'network_content_delivery', 'edge'],
  ['network firewall', 'security_identity_compliance', 'edge'],
  ['sagemaker', 'artificial_intelligence', null],
];
for (const [service, expectedCategory, expectedLayer] of READING) {
  const c = layers.categoriaDoNo({ kind: 'service', service }, cat);
  const tier = c ? (layers.CATEGORY_LAYER[c] || null) : null;
  ok(c === expectedCategory && tier === expectedLayer,
    `${service.padEnd(23)} ${String(c).padEnd(28)} → ${tier || '(silent — does not vote)'}`);
}

// mixing: the deepest one wins
{
  const m = load('three-mixed-layers');
  const d = derive(m, { cat });
  const ana = d.layers.get('ana-a');
  ok(ana.layer === 'data' && ana.evidence.length === 2,
    'ECS + Redshift mixed in the same subnet → data',
    `the deepest one wins (${ana.evidence.map(e => e.layer).join(' vs ')})`);
  ok(JSON.stringify(contentOrder(m)) === JSON.stringify(['Firewall subnet', 'Worker subnet', 'Analytics subnet']),
    'three floors come out in network reading order',
    `alphabet would give ${alphabeticalOrder(m).join(' · ')}`);
}

// the escape hatch: declared wins, and the divergence is counted
{
  const m = load('declared-empty-subnet');
  const d = derive(m, { cat });
  ok(d.layers.get('res-a').layer === 'data' && d.layers.get('res-a').via === 'declared',
    'empty subnet with a declared `layer` → data [declared]');
  ok(JSON.stringify(contentOrder(m)) === JSON.stringify(['App subnet', 'Reserved subnet']),
    'and the declared row stacks below the application');

  const conflict = JSON.parse(JSON.stringify(m));
  conflict.nodes.find(n => n.id === 'app-a').layer = 'data';
  const dc = derive(conflict, { cat });
  const c = dc.layers.get('app-a');
  ok(c.layer === 'data' && c.diverge === 'application',
    'declaring against the content itself → obeys and flags it',
    `declared "data", content says "${c.diverge}"`);
}

// ---------------------------------------------------------------------------
console.log('\n3 · the gap: where the missing fact refuses, and where it only warns\n');

{
  const m = load('empty-subnet', path.join('models', 'refusal'));
  const d = derive(m, { cat });
  ok(d.gaps.length === 1 && d.gaps[0].orfaos.length === 1 &&
     d.gaps[0].orfaos[0].papel === 'Reserved subnet' && d.gaps[0].orfaos[0].vazio,
    'the gap is found, and it names the exact role',
    JSON.stringify(d.gaps.map(l => l.orfaos.map(o => o.papel))));

  let refused = null;
  try { await dispor.porGrade(m, d, res); }
  catch (e) { refused = e; }
  ok(refused !== null, 'the grid REFUSES — it does not draw a made-up order');
  ok(refused && /Reserved subnet/.test((refused.errors || []).join('\n')) &&
     /layer/.test((refused.errors || []).join('\n')),
    'and the refusal says what is missing and where',
    refused ? (refused.errors || [])[1] : '');
}

// single role: no layer, but nothing to be ordered against → does not refuse
{
  const m = load('empty-subnet', path.join('models', 'refusal'));
  const only = JSON.parse(JSON.stringify(m));
  only.nodes = only.nodes.filter(n => !['app-a', 'app-b', 'ecs-a', 'ecs-b'].includes(n.id));
  const d = derive(only, { cat });
  ok(d.gaps.length === 0,
    'a single role with no layer does NOT refuse — there is nothing to order it against',
    'the refusal fires where the missing fact would change the drawing, and only there');
}

// the ELK path: the same gap, and it draws anyway
{
  const m = load('elk-no-layer');
  const d = derive(m, { cat });
  ok(!d.az.draw, "the ELK model does not trigger the grid (1 AZ)");
  ok(d.gaps.length === 1, 'the same gap exists there');
  let error = null;
  try { await dispor.porElk(m, d, res); } catch (e) { error = e; }
  ok(error === null, 'and ELK draws anyway — it warns, it does not refuse');
}

// ---------------------------------------------------------------------------
console.log('\n4 · control experiment: the rule reads the CONTENT, not the label\n');

{
  // Swap the labels of web-data's two rows, keeping the content. If the rule
  // were reading the name, the order would flip; since it reads what is
  // inside, the subnet holding the Aurora stays at the bottom — only now it is
  // called "Web subnet".
  const m = load('web-data');
  const swapped = JSON.parse(JSON.stringify(m));
  for (const n of swapped.nodes)
    if (n.kind === 'subnet') n.label = n.label === 'Web subnet' ? 'Data subnet' : 'Web subnet';

  const order = contentOrder(swapped);
  const layerOf = r => {
    const d = derive(swapped, { cat });
    const p = [...layers.papeisDeSubnet(swapped, d.t, d.layers).values()].find(x => x.label === r);
    return p.layer;
  };
  ok(JSON.stringify(order) === JSON.stringify(['Data subnet', 'Web subnet']),
    'with the labels swapped, the order follows the CONTENT',
    `"Data subnet" now holds the EC2 (${layerOf('Data subnet')}) and moves up`);

  // And the control of the control: if the rule were alphabetical, this is the
  // result it would give — and it is the SAME for both models, which is
  // exactly the symptom of reading the letter and not the architecture.
  ok(JSON.stringify(alphabeticalOrder(swapped)) === JSON.stringify(alphabeticalOrder(m)),
    'the alphabet, on the other hand, gives the SAME output for both models',
    'swapping the content around moves nothing — that is the symptom of reading the letter');
}

// ---------------------------------------------------------------------------
console.log(failures ? `\n  ✗ ${failures} failure(s)` : '\n  ✓ the network layer comes from the content, and the alphabet lost its meaning.');
process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
