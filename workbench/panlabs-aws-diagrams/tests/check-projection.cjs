#!/usr/bin/env node
'use strict';
/**
 * M3 — is the technical model's logical projection REALLY the approved view?
 *
 *   node tools/check-projection.cjs
 *
 * This is the check the ticket buys by using a single IR, and it wouldn't
 * exist with two models: with an explicit mapping between a logical model and
 * a technical one, "is what I'm drawing still what you approved?" only gets
 * answered if the mapping is right — and nothing guarantees it is. With one
 * model, it's a projection and a string comparison.
 *
 * But a green check proves nothing on its own. #17 learned that the hard way:
 * 24 static checks were green while the PNG showed SageMaker with the wrong
 * icon. So here comes the CONTROL EXPERIMENT, in the same format #11 used for
 * the boundary: twelve mutations of the technical model, seven that MUST be
 * caught and five that MUST NOT be. If any lands out of place, the check is
 * measuring something else.
 */

const fs = require('fs');
const path = require('path');

const { approve, check } = require('../../../skills/panlabs-aws-diagrams/session/agreement.cjs');
const { elaborate } = require('../../../skills/panlabs-aws-diagrams/session/elaborate.cjs');
const { validate } = require('../../../skills/panlabs-aws-diagrams/session/validate.cjs');
const { project } = require('../../../skills/panlabs-aws-diagrams/session/project.cjs');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const clone = o => JSON.parse(JSON.stringify(o));
const node = (m, id) => m.nodes.find(n => n.id === id);

/**
 * Seven mutations the check MUST catch. All of them are things a distracted
 * agent does during the technical phase while thinking it's only detailing.
 */
const MUST_BREAK = [
  { name: 'strip the logical facet from an approved capability',
    mutate: m => { delete node(m, 'tratar-falha').logical; node(m, 'tratar-falha').layer = 'technical'; } },

  { name: 'rename an approved capability',
    mutate: m => { node(m, 'processar-na-chegada').logical.label = 'Enrich and validate'; } },

  { name: 'move a capability across a boundary',
    mutate: m => { node(m, 'consultar').inside = 'processamento'; } },

  { name: 'delete an approved capability',
    mutate: m => { m.nodes = m.nodes.filter(n => n.id !== 'tratar-falha');
                m.edges = m.edges.filter(a => a.from !== 'tratar-falha' && a.to !== 'tratar-falha'); } },

  { name: 'add a capability that was never discussed',
    mutate: m => { m.nodes.push({ id: 'antivirus', label: 'Scan for viruses', inside: 'aterrissagem',
                             logical: { kind: 'block' }, technical: { kind: 'service', service: 'guardduty' } }); } },

  { name: 'delete the note for the REJECTED finding',
    mutate: m => { m.notes = m.notes.filter(n => n.id !== 'n-spof'); },
    because: 'it is the channel through which "known and accepted SPOF" reaches the drawing (#15 §4)' },

  // This one doesn't break the agreement — it breaks the PROJECTION, before it
  // even exists. A technical-only hub with 2 logical inputs and 2 logical
  // outputs would contract into 4 edges, 2 of which nobody asserted. Without
  // the guard, the logical drawing would come out inventing conversation,
  // which is exactly the silent lie this map exists to chase down.
  { name: 'technical-only hub with 2 logical inputs and 2 logical outputs',
    mutate: m => {
      m.edges.push({ id: 'x-in1', from: 'receber-arquivo', to: 'bus' });
      m.edges.push({ id: 'x-in2', from: 'reter-objeto', to: 'bus' });
      m.edges.push({ id: 'x-out', from: 'bus', to: 'consultar' });
    },
    because: 'the contraction would emit 4 logical edges with only 3 asserted' },
];

/**
 * Five mutations that are LEGITIMATE technical elaboration. If the check
 * complains about any of them, it's too tight and turns into noise the user
 * learns to ignore.
 */
const MUST_NOT_BREAK = [
  { name: 'add infrastructure (technical-only node)',
    mutate: m => { m.nodes.push({ id: 'nat', layer: 'technical', inside: 'vpc-dados',
                             technical: { kind: 'service', service: 'nat gateway', label: 'NAT gateway' } }); } },

  { name: "swap a capability's AWS service",
    mutate: m => { node(m, 'consultar').technical.service = 'redshift'; node(m, 'consultar').technical.label = 'Redshift'; } },

  { name: 'insert one more network layer and reparent',
    mutate: m => { m.nodes.push({ id: 'sub-data', layer: 'technical', inside: 'vpc-dados',
                             technical: { kind: 'subnet', label: 'Private subnet · data', access: 'private' } });
                node(m, 'endpoint-s3').inside = 'sub-data'; } },

  { name: 'change the account number',
    mutate: m => { node(m, 'processamento').technical.account = '999988887777'; } },

  { name: 'give an approved edge a new technical label',
    mutate: m => { m.edges.find(a => a.id === 'a-grava').technical = { label: 'PutObject' }; } },
];

function main() {
  const logical = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'session', 'retail-logical.json'), 'utf8'));
  const elab = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'session', 'retail-elaboration.json'), 'utf8'));
  const approved = approve(logical, { at: '2026-08-21', by: 'user', candidate: 'cand-a' });
  const technical = elaborate(approved, elab);

  let failures = 0;

  // ------------------------------------------------------------ 1. the normal case
  const base = check(technical);
  console.log('\n  1 · The normal case\n');
  console.log(`    the technical model's logical projection matches the approved one .... ${base.ok ? '✓' : '✗'}`);
  if (!base.ok) { failures++; for (const d of base.diferencas) console.log(`        · ${d.text}`); }

  const pl = project(technical, 'logical').model;
  const pt = project(technical, 'technical').model;
  console.log(`    projected logical view .................................... ${pl.nodes.length} nodes, ${pl.edges.length} edges`);
  console.log(`    projected technical view ................................... ${pt.nodes.length} nodes, ${pt.edges.length} edges`);
  console.log(`    the session model has ...................................... ${technical.nodes.length} nodes, ${technical.edges.length} edges`);
  console.log(`    no node with a logical facet vanishes from the logical projection ....... ` +
    `${technical.nodes.filter(n => n.logical).length === pl.nodes.length ? '✓' : '✗'}`);
  if (technical.nodes.filter(n => n.logical).length !== pl.nodes.length) failures++;

  // Does a node's note reach the projection? An `else` without braces used to
  // stick to the `if` INSIDE the `for`, and the logical view silently lost
  // every `logical.note`. One line of checking for a class of bug that
  // throws no error.
  // The note is INJECTED here instead of read from the fixture: if the
  // fixture model stops using `logical.note` — and it did —, a check that
  // only counts what already exists passes by counting zero. Green by
  // vacuity is the failure mode #17 paid dearly to learn.
  const withNote = clone(technical);
  withNote.nodes.find(n => n.id === 'tratar-falha').logical.note = 'manual reprocessing, for now';
  const projectedNote = project(withNote, 'logical').model.nodes.find(n => n.id === 'tratar-falha').note;
  console.log(`    the logical facet's note reaches the projection ................. ` +
    `${projectedNote ? '✓' : '✗'}  (${projectedNote ? `"${projectedNote}"` : 'gone'})`);
  if (!projectedNote) failures++;

  // Two DISTINCT approved edges between the same pair both have to survive.
  // The dedup key used to be just `from>to`, and under that regime the second
  // one vanished — on BOTH sides of the agreement comparison, which left the
  // check blind to its own loss.
  const parallel = clone(technical);
  parallel.edges.push({ id: 'a-confirma', from: 'receber-arquivo', to: 'guardar-bruto', label: 'confirms write' });
  const proj = project(parallel, 'logical').model.edges
    .filter(a => a.from === 'receber-arquivo' && a.to === 'guardar-bruto').length;
  console.log(`    two distinct edges on the same pair both survive ............ ${proj === 2 ? '✓' : '✗'}  (${proj} of 2)`);
  if (proj !== 2) failures++;

  // ---------------------------------------------------------- 2. control experiment
  console.log('\n  2 · Control experiment — what MUST break\n');
  for (const mut of MUST_BREAK) {
    const m = clone(technical);
    mut.mutate(m);
    // A mutation can be caught by the validator BEFORE the projection. That
    // counts equally — both layers exist for this, and the check would only
    // fail if NEITHER caught it.
    const v = validate(m);
    let caught = !v.ok, via = 'validator';
    let r = null;
    if (!caught) { r = check(m); caught = !r.ok; via = 'agreement'; }
    console.log(`    ${mut.name.padEnd(52)} ${caught ? '✓ caught' : '✗ PASSED'}  (${caught ? via : '—'})`);
    if (!caught) failures++;
    else if (r) for (const d of r.diferencas.slice(0, 2)) console.log(`        · ${d.text}`);
    else console.log(`        · ${v.errors[0].slice(0, 110)}`);
  }

  console.log('\n  3 · Control experiment — what MUST NOT break\n');
  for (const mut of MUST_NOT_BREAK) {
    const m = clone(technical);
    mut.mutate(m);
    const v = validate(m);
    const r = v.ok ? check(m) : { ok: false, motivo: v.errors[0] };
    console.log(`    ${mut.name.padEnd(52)} ${r.ok ? '✓ passed' : '✗ BROKE'}`);
    if (!r.ok) { failures++; console.log(`        · ${(r.motivo || '').slice(0, 110)}`); for (const d of r.diferencas || []) console.log(`        · ${d.text}`); }
  }

  const total = MUST_BREAK.length + MUST_NOT_BREAK.length;
  console.log(failures
    ? `\n  ✗ ${failures} failure(s) of ${total} — the check is measuring something else.\n`
    : `\n  ✓ ${total}/${total}. The check catches what changes the agreement and lets through what merely details it.\n`);
  return failures ? 1 : 0;
}

process.exit(main());
