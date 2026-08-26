#!/usr/bin/env node
'use strict';
/**
 * The validator is only worth something if it REJECTS — and if it says why
 * in a way whoever wrote the model can actually fix. Each case below is an
 * error an agent genuinely makes, and the assertion is about the MESSAGE,
 * not just the exit code.
 */

const fs = require('fs');
const path = require('path');
const { validate, againstSchema } = require(path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams', 'engine', 'validate.cjs'));
const { SCHEMA } = require(path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams', 'engine', 'generate.cjs'));

// A case can bring its own schema, and then it's measured by the generic
// `againstSchema`. `validate` is the one for `model@1`: it adds semantic
// checks that assume `nodes`, and pointing it at another contract breaks
// before it measures anything.
const ELABORATION_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams', 'session', 'elaboration.schema.json'), 'utf8'));
const elaboration = extra => ({
  schema: 'panlabs-aws-diagrams/elaboration@1', about: 'target', ...extra,
});

const base = {
  schema: 'panlabs-aws-diagrams/model@1',
  id: 'test', title: 'Test', view: 'technical',
  nodes: [{ id: 'cloud', kind: 'cloud' }],
};
const withExtra = extra => ({ ...base, ...extra });

const cases = [
  {
    name: 'smuggled coordinate on the node',
    model: withExtra({ nodes: [{ id: 'a', kind: 'service', service: 'lambda', x: 10, y: 20 }] }),
    expect: 'unknown property "x"',
  },
  {
    name: 'typo with an obvious neighbor',
    model: withExtra({ nodes: [{ id: 'a', kind: 'service', service: 'lambda', insidee: 'cloud' }] }),
    expect: 'did you mean "inside"',
  },
  {
    name: 'a parent that does not exist',
    model: withExtra({ nodes: [{ id: 'a', kind: 'service', service: 'lambda', inside: 'ghost' }] }),
    expect: 'does not exist',
  },
  {
    name: 'cyclic containment',
    model: withExtra({ nodes: [{ id: 'a', kind: 'group', inside: 'b' }, { id: 'b', kind: 'group', inside: 'a' }] }),
    expect: 'cyclic',
  },
  {
    name: 'an edge that ends on a container',
    model: withExtra({
      nodes: [{ id: 'vpc', kind: 'vpc' }, { id: 'l', kind: 'service', service: 'lambda' }],
      edges: [{ from: 'l', to: 'vpc' }],
    }),
    expect: 'is a container',
  },
  {
    name: 'subnet outside a VPC',
    model: withExtra({ nodes: [{ id: 's', kind: 'subnet', access: 'private', inside: 'cloud' }, { id: 'cloud', kind: 'cloud' }] }),
    expect: 'outside any VPC',
  },
  {
    name: 'AWS service in the logical view',
    model: withExtra({ view: 'logical', nodes: [{ id: 'a', kind: 'service', service: 'lambda' }] }),
    expect: 'logical view is pre-services',
  },
  {
    name: 'AZ declared on something that is not a subnet',
    model: withExtra({ nodes: [{ id: 'a', kind: 'service', service: 'lambda', az: 'us-east-1a' }] }),
    expect: 'expected the literal "subnet"',
  },
  {
    name: 'a band mixing tree levels',
    model: withExtra({
      nodes: [{ id: 'v', kind: 'vpc' }, { id: 's', kind: 'subnet', inside: 'v', access: 'private' },
            { id: 'e', kind: 'service', service: 'ec2', inside: 's' }],
      bands: [{ id: 'f', members: ['s', 'e'] }],
    }),
    expect: 'different tree depths',
  },
  {
    name: 'id outside the format (falls back to the mxCell id)',
    model: withExtra({ nodes: [{ id: 'My Lambda!', kind: 'service', service: 'lambda' }] }),
    expect: "doesn't match",
  },
  {
    name: 'a valid model stays valid',
    model: withExtra({ nodes: [{ id: 'a', kind: 'service', service: 'lambda' }] }),
    expect: null,
  },

  // ── patternProperties, both halves ──────────────────────────────────────
  // A closed schema that ENUMERATES free comment is a contradiction, and it
  // cost something: `elaboration@1` listed `_`, `_reparenta`, `_arestas`, and
  // `_refina` — the four that existed INSIDE the skill — and rejected
  // `_conferir`, which only showed up in a case fixture another ticket had
  // moved OUTSIDE it. Green on both PRs, and the defect only showed up when
  // the case was regenerated.
  //
  // Both halves matter: allowing the key without validating the value swaps
  // one hole for another.
  {
    name: 'free comment in a new key passes (the permissive half)',
    schema: ELABORATION_SCHEMA,
    model: elaboration({ _conferir: 'the lesson the case fixture keeps' }),
    expect: null,
  },
  {
    name: 'and its VALUE is still validated (the half that closes the hole)',
    schema: ELABORATION_SCHEMA,
    model: elaboration({ _conferir: 123 }),
    expect: 'expected string, got integer',
  },
];

let failures = 0;
for (const c of cases) {
  const r = c.schema
    ? (es => ({ ok: es.length === 0, erros: es }))(againstSchema(c.model, c.schema, c.schema))
    : validate(c.model, SCHEMA);
  const text = r.erros.join(' | ');
  const ok = c.expect === null ? r.ok : (!r.ok && text.includes(c.expect));
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${c.name}`);
  if (!ok) console.log(`      expected to contain ${JSON.stringify(c.expect)}, got: ${text || '(passed)'}`);
  else if (c.expect) console.log(`      → ${r.erros[0]}`);
}

console.log(failures ? `\n  ✗ ${failures}/${cases.length} failed` : `\n  ✓ ${cases.length}/${cases.length} — the validator rejects what it should and explains why.`);
process.exit(failures ? 1 : 0);
