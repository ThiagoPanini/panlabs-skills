#!/usr/bin/env node
'use strict';
/**
 * FAN DENSITY — the measurement #26 needed to calibrate the trigger of the
 * reference-zone view (#21).
 *
 *   node tools/measure-fan.cjs             # the synthetic sweep, 3..6 zones
 *   node tools/measure-fan.cjs <m.json>... # whatever models you pass
 *
 * #21 left open *which check and which threshold* fire the fallback that erases
 * the cross-zone edge, saying it depends on the "real density of the fan". This
 * file is the ruler for that density, and it measures TWO things that are not
 * the same:
 *
 *   sweep floor   the `cost` that `laneOrder` minimises: for every edge between
 *                 zones at distance `d` in the lane queue, `d − 1`. It is a
 *                 PREDICTION, and the prediction was born in a world where the
 *                 edge went straight from column to column.
 *
 *   F2 measured   the `A5.5` predicate — a polyline crossing a box the edge has
 *                 no relation to — applied to the `band` class, which is exactly
 *                 the one `A5.5` cannot see (bands were left out of the 62 by
 *                 decision of #18). It comes READ from the report
 *                 (`validator/families/extras.cjs`), never recomputed here — see
 *                 `measureF2`.
 *
 * The distance between the two columns is the finding: after the #24 routing the
 * long edge does not go straight — it drops to the outer border of the bands and
 * runs around them. The floor keeps counting crossings the drawing no longer makes.
 */

const fs = require('fs');
const path = require('path');
const { generate } = require(path.join(__dirname, '..', 'engine', 'generate.cjs'));
const { derive } = require(path.join(__dirname, '..', 'engine', 'derive.cjs'));

const LETTERS = 'abcdefghij';

/** A full mesh of brokers, one zone per subnet — the densest fan possible. */
function mesh(nZones) {
  const nodes = [
    { id: 'cloud', kind: 'cloud', label: 'AWS Cloud' },
    { id: 'vpc', kind: 'vpc', label: 'VPC · 10.0.0.0/16', cidr: '10.0.0.0/16', inside: 'cloud' },
  ];
  for (let i = 0; i < nZones; i++) {
    nodes.push({ id: `app-${LETTERS[i]}`, kind: 'subnet', label: 'App subnet', access: 'private',
      az: `us-east-1${LETTERS[i]}`, inside: 'vpc' });
    nodes.push({ id: `broker-${LETTERS[i]}`, kind: 'service', service: 'msk',
      label: `Broker ${i + 1}`, inside: `app-${LETTERS[i]}` });
  }
  const edges = [];
  for (let i = 0; i < nZones; i++)
    for (let j = 0; j < nZones; j++)
      if (i !== j) edges.push({ from: `broker-${LETTERS[i]}`, to: `broker-${LETTERS[j]}`,
        label: 'replica fetch', protocol: 'kafka', data: 'back' });
  return {
    schema: 'panlabs-aws-diagrams/model@1',
    id: `mesh-${nZones}-az`, title: `Mesh of ${nZones} zones`,
    view: 'technical', genre: 'T1', nodes, edges,
  };
}

/** The lane-sweep floor, recomputed here so it does not depend on a log. */
function sweepFloor(model) {
  const d = derive(model);
  const subnets = model.nodes.filter(n => n.kind === 'subnet');
  const zones = [...new Set(subnets.map(s => s.az).filter(Boolean))].sort();
  const zoneOf = id => {
    const n = d.t.byId.get(id);
    if (!n) return null;
    const s = n.kind === 'subnet' ? n : d.t.ancestrais(n).find(a => a.kind === 'subnet');
    return s ? s.az : null;
  };
  const crossing = (model.edges || []).map(a => [zoneOf(a.from), zoneOf(a.to)])
    .filter(([x, y]) => x && y && x !== y);
  if (zones.length < 3 || !crossing.length) return { zones: zones.length, crossing: crossing.length, floor: 0, perms: 0 };
  const permute = xs => xs.length <= 1 ? [xs]
    : xs.flatMap((x, i) => permute([...xs.slice(0, i), ...xs.slice(i + 1)]).map(r => [x, ...r]));
  const all = permute(zones);
  const floor = Math.min(...all.map(p => {
    const idx = new Map(p.map((z, i) => [z, i]));
    return crossing.reduce((s, [x, y]) => s + Math.max(0, Math.abs(idx.get(x) - idx.get(y)) - 1), 0);
  }));
  return { zones: zones.length, crossing: crossing.length, floor, perms: all.length };
}

/**
 * The validator's OWN `F2`, read from the report — not a second implementation.
 *
 * ⚠️ The first version of this function reimplemented the predicate here, and
 * review caught it: it tested only DIRECT membership (`members.has(a.from)`),
 * while the `F2` that ships also accepts a descendant of a member
 * (`scene.ehDescendente`). They are different predicates — and the evidence
 * *"F2 = 0 at all four densities"* would have been produced by an `F2` that is
 * not the one that runs.
 *
 * Measuring with a copy of the rule is the trap #23 called **a suite green by
 * halves**: both were green, each against its own version. Here the ruler and the
 * product become the same code, by construction.
 */
function measureF2(r) {
  let bands = 0;
  const cases = [];
  for (const { report } of r.relatorio.geometry) {
    if (report.scene) bands += report.scene.bands.length;
    const f2 = (report.extras || []).find(x => x.id === 'F2');
    if (!f2) continue;
    for (const o of f2.occurrences) cases.push(o.ids ? o.ids.join(' × ') : o.o_que);
  }
  return { bands, cases };
}

function count(r, id) {
  let n = 0;
  for (const { report } of r.relatorio.geometry) {
    const x = report.resultados.find(y => y.id === id);
    if (x) n += x.occurrences.length;
  }
  return n;
}

async function measure(model, label) {
  const p = sweepFloor(model);
  let r;
  try { r = await generate(model, {}); }
  catch (e) { return { label, error: e.message, ...p }; }
  const f2 = measureF2(r);
  return {
    label, ...p, bands: f2.bands, f2: f2.cases.length, examples: f2.cases.slice(0, 2),
    a55: count(r, 'A5.5'), a51: count(r, 'A5.1'), a32: count(r, 'A3.2'),
    semantics: r.relatorio.geometry.reduce((s, x) => s + x.report.semanticas.length, 0),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const rows = [];
  if (args.length) {
    for (const a of args)
      rows.push(await measure(JSON.parse(fs.readFileSync(a, 'utf8')), path.basename(a, '.json')));
  } else {
    for (let n = 3; n <= 6; n++) rows.push(await measure(mesh(n), `mesh-${n}-az`));
  }

  const head = ['case', 'zones', 'crossing', 'perms', 'floor', 'bands', 'F2', 'A5.5', 'A5.1', 'A3.2', 'sem'];
  const body = rows.map(l => l.error
    ? [l.label, String(l.zones), String(l.crossing), String(l.perms), String(l.floor), '—', '—', '—', '—', '—', 'ERROR']
    : [l.label, String(l.zones), String(l.crossing), String(l.perms), String(l.floor),
       String(l.bands), String(l.f2), String(l.a55), String(l.a51), String(l.a32), String(l.semantics)]);
  const w = head.map((_, i) => Math.max(head[i].length, ...body.map(c => c[i].length)));
  console.log('  ' + head.map((c, i) => c.padEnd(w[i])).join('  '));
  for (const c of body) console.log('  ' + c.map((v, i) => v.padEnd(w[i])).join('  '));
  for (const l of rows) if (l.error) console.log(`\n  ${l.label}: ${l.error}`);
  for (const l of rows) if (l.examples && l.examples.length)
    console.log(`\n  ${l.label} — F2: ${l.examples.join(' | ')}`);

  console.log('\n  floor = lane-sweep prediction (|i−j|−1 per edge, minimised)');
  console.log('  F2    = measured on the drawing: an edge crossing the box of a band it does not belong to');
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { mesh, sweepFloor, measureF2 };
