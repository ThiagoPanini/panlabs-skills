#!/usr/bin/env node
'use strict';
/**
 * The ticket's third candidate, measured instead of dismissed by argument.
 *
 *   > "Or order by distance from the boundary, counting hops to the most
 *   >  exposed node — works when there are edges, and falls back to what when
 *   >  there aren't?"
 *
 * The question has two halves, and both are answered by counting:
 *
 *   1. HOW MUCH of the corpus it reaches — in how many models there is enough
 *      edge to make the distance mean something;
 *   2. WHERE it reaches, if it DISAGREES with the content rule. If it agrees,
 *      it adds no information: it is the same order by a more fragile path.
 *
 * The corpus is the skill's WHOLE network corpus, not just the models written
 * for this question — and the count separates the two groups, because
 * measuring the candidate only on the examples drawn for the winner would be
 * making the ruler agree with me. The separation, which used to be a
 * directory while the corpus lived in the prototypes, became the `FROM_22`
 * list below. It is the same line, written down.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');


const { derive } = require(path.join(ROOT, 'engine', 'derive.cjs'));
const layers = require(path.join(ROOT, 'engine', 'layers.cjs'));
const resolverMod = require(path.join(ROOT, 'engine', 'resolve.cjs'));

const cat = resolverMod.create(require(path.join(ROOT, 'theme', 'theme.cjs')).load('light')).cat;

/**
 * The models #22 wrote FOR this question. The rest of the corpus came from
 * other tickets, before it — and that is the line the measurement needs to
 * separate: running the rival candidate only on the models tailor-made for
 * the winner would be making the ruler agree with me.
 *
 * In the production tree the corpus lives entirely under `models/`, so the
 * separation that used to be by DIRECTORY becomes this list. It is the same
 * line, written down.
 */
const FROM_22 = new Set(['app-data', 'elk-no-layer', 'ingest-core', 'declared-empty-subnet',
  'three-mixed-layers', 'web-data-with-flow', 'web-data', 'empty-subnet']);

const corpus = [];
// `ROOT/examples` because web-multi-az moved to the skill's own minimal
// examples directory (#44) — this sweep still needs to reach it
for (const dir of [path.join(WORKBENCH, 'models'), path.join(WORKBENCH, 'models', 'refusal'), path.join(ROOT, 'examples')])
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
    const name = f.replace(/\.json$/, '');
    corpus.push({ group: FROM_22.has(name) ? 'q22' : 'inherited', name,
      model: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) });
  }

/**
 * Distance in hops, on the model's edges as an UNDIRECTED graph, from the
 * subnet role to the most exposed thing that exists.
 *
 * "Most exposed" in the order the IR itself offers: a node outside any VPC
 * (actor, regional service), else a public subnet leaf. With neither of the
 * two there is nothing to count from, and the candidate has no answer — which
 * is already half an answer to the ticket's question.
 */
function edgeDistance(model, d) {
  const subnetOf = id => {
    const n = d.t.byId.get(id);
    if (!n) return null;
    return n.kind === 'subnet' ? n : d.t.ancestrais(n).find(a => a.kind === 'subnet') || null;
  };
  const inVpc = n => d.t.ancestrais(n).some(a => a.kind === 'vpc');

  const sources = model.nodes.filter(n => ['service', 'block', 'actor'].includes(n.kind))
    .filter(n => !inVpc(n) || (subnetOf(n.id) || {}).access === 'public')
    .map(n => n.id);
  if (!sources.length) return { ok: false, because: 'no exposed node to count from', dist: new Map() };

  const adj = new Map(model.nodes.map(n => [n.id, []]));
  for (const a of model.edges || []) {
    if (!adj.has(a.from) || !adj.has(a.to)) continue;
    adj.get(a.from).push(a.to);
    adj.get(a.to).push(a.from);
  }

  const dist = new Map(sources.map(f => [f, 0]));
  const queue = [...sources];
  while (queue.length) {
    const id = queue.shift();
    for (const v of adj.get(id) || []) if (!dist.has(v)) { dist.set(v, dist.get(id) + 1); queue.push(v); }
  }

  // a ROLE's distance is the smallest among the leaves it holds
  const perRole = new Map();
  for (const [id, dd] of dist) {
    const s = subnetOf(id);
    if (!s) continue;
    const key = layers.chaveDePapel(s, d.t);
    perRole.set(key, Math.min(perRole.get(key) ?? Infinity, dd));
  }
  return { ok: perRole.size > 0, because: perRole.size ? null : 'no subnet reached by an edge', dist: perRole };
}

let reaches = 0, mute = 0, agrees = 0, disagrees = 0;
// Separate count for the INHERITED corpus (q11 + q12). The q22 models were
// written for this question, so measuring the rival candidate only on them
// would be making the ruler agree with me — the line that matters is the one below.
let inheritedSpeaks = 0, inheritedMute = 0, inheritedDisagrees = 0;
const details = [];

for (const { group, name, model } of corpus) {
  const d = derive(model, { cat });
  const roles = [...layers.papeisDeSubnet(model, d.t, d.layers).values()];
  const privateRoles = roles.filter(p => p.access === 'private');
  if (privateRoles.length < 2) { details.push([group, name, '—', 'fewer than 2 private roles: the question does not apply']); continue; }

  const s = edgeDistance(model, d);
  const covered = privateRoles.filter(p => s.dist.has(p.key));
  if (!s.ok || covered.length < 2) {
    mute++;
    if (group !== 'q22') inheritedMute++;
    details.push([group, name, 'MUTE', s.because || `only ${covered.length} of ${privateRoles.length} roles reached by an edge`]);
    continue;
  }
  reaches++;
  if (group !== 'q22') inheritedSpeaks++;

  const byHop = [...covered].sort((a, b) => s.dist.get(a.key) - s.dist.get(b.key) || a.label.localeCompare(b.label, 'pt'));
  const byLayer = [...covered].sort((a, b) =>
    layers.layerOrder(a.layer) - layers.layerOrder(b.layer) || a.label.localeCompare(b.label, 'pt'));
  const equal = JSON.stringify(byHop.map(p => p.label)) === JSON.stringify(byLayer.map(p => p.label));
  if (equal) agrees++; else disagrees++;
  if (!equal && group !== 'q22') inheritedDisagrees++;
  details.push([group, name, equal ? 'AGREES' : 'DISAGREES',
    `hops → ${byHop.map(p => `${p.label}(${s.dist.get(p.key)})`).join(' · ')}`]);
}

console.log('\n  distance from the boundary vs. content layer — the skill\'s whole network corpus\n');
for (const [g, n, v, det] of details)
  console.log(`  ${g}  ${n.padEnd(24)} ${String(v).padEnd(9)} ${det}`);

console.log(`\n  models where distance manages to order: ${reaches}`);
console.log(`  models where it stays mute:              ${mute}`);
console.log(`  where it speaks, it agrees with content:  ${agrees}`);
console.log(`  where it speaks, it DISAGREES with content: ${disagrees}`);
console.log(`  INHERITED corpus only (written before this question): ` +
  `speaks in ${inheritedSpeaks}, mute in ${inheritedMute}, disagrees in ${inheritedDisagrees}`);

/**
 * This is a GATE, not a report — and that is why it exits 1 on disagreement.
 *
 * #22's conclusion about the rival candidate is "it carries no information the
 * content does not already have". One disagreement knocks that conclusion
 * down, and a ruler that prints "reopen" and exits 0 leaves the suite green on
 * top of a decision that just lost the argument.
 */
console.log(disagrees
  ? '\n  ✗ there is disagreement — the hop candidate carries information the content does not have. Reopen #22\'s decision.'
  : '\n  ✓ where distance speaks, it repeats what the content already said; where content speaks alone, ' +
    'it is mute. It is not a second source — it is the same answer by a path that depends on edges.');
process.exit(disagrees ? 1 : 0);
