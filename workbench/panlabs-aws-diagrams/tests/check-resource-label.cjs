#!/usr/bin/env node
'use strict';
/**
 * #38 — `resource` is born in both contracts and reaches the leaf's italic line.
 *
 * Before this ticket, every leaf's second line was `qualifier` — what the
 * service DOES here ("stores the PDFs"). That says nothing about what a
 * concrete resource is CALLED, and is exactly the gap that leaves three
 * identical S3 buckets indistinguishable. `resource` is the new field for
 * that name; the view decides which one wins on the leaf: the technical view
 * knows a nameable resource and it wins there, the logical view never has one
 * and falls through to `qualifier`, and with neither the leaf keeps one line.
 *
 * Two levels of proof, same shape as #33's check-leaf-box.cjs:
 *
 *   1. UNIT — `resolve.create(theme).leaf(node)` in isolation, over the four
 *      combinations of (resource present?, qualifier present?).
 *   2. END TO END — through `session/project.cjs`, so the priority is proven
 *      on what the two-view arc actually produces, not a hand-built model@1.
 *
 * Plus a CONTROL: with both fields set, the pre-#38 behaviour (always
 * `qualifier`) would have produced a DIFFERENT label — proving this check
 * would have caught the regression, not just confirmed the current code.
 */

const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const resolverMod = require(path.join(ROOT, 'engine', 'resolve.cjs'));
const themeMod = require(path.join(ROOT, 'theme', 'theme.cjs'));
const { project } = require(path.join(ROOT, 'session', 'project.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

const RESOURCE = 'pedidos-table';
const QUALIFIER = 'guarda os pedidos';

(async () => {
// ---------------------------------------------------------------------------
console.log('\n1 · unit — resolve.leaf() picks resource over qualifier\n');

{
  const res = resolverMod.create(themeMod.load('corporate'));   // token on

  const both = res.leaf({ id: 'n1', kind: 'service', service: 'dynamodb', resource: RESOURCE, qualifier: QUALIFIER });
  ok(both.label.includes(`<i>${RESOURCE}</i>`),
    'with BOTH set, the italic line is the resource',
    both.label);
  ok(!both.label.includes(QUALIFIER),
    'and the qualifier does not also show up',
    both.label);

  const onlyResource = res.leaf({ id: 'n2', kind: 'service', service: 'dynamodb', resource: RESOURCE });
  ok(onlyResource.label.includes(`<i>${RESOURCE}</i>`),
    'with only resource set, the italic line is the resource');

  const onlyQualifier = res.leaf({ id: 'n3', kind: 'service', service: 'dynamodb', qualifier: QUALIFIER });
  ok(onlyQualifier.label.includes(`<i>${QUALIFIER}</i>`),
    'with only qualifier set (the logical case — no nameable resource), the italic line falls back to it');

  const neither = res.leaf({ id: 'n4', kind: 'service', service: 'dynamodb' });
  ok(!/<br/i.test(neither.label) && neither.label === 'DynamoDB',
    'with neither set, the leaf keeps a single line',
    neither.label);
}

// ---------------------------------------------------------------------------
console.log('\n2 · control — the pre-#38 behaviour would have produced a DIFFERENT label\n');

{
  const res = resolverMod.create(themeMod.load('corporate'));
  const node = { id: 'n5', kind: 'service', service: 'dynamodb', resource: RESOURCE, qualifier: QUALIFIER };
  const today = res.leaf(node).label;
  const preTicket = themeMod.load('corporate');
  const oldStyleLabel = resolverMod.create(preTicket).tema.rotuloDeFolha(
    node.label || 'DynamoDB', node.qualifier);   // what resolve.cjs called BEFORE #38
  ok(today !== oldStyleLabel,
    'CONTROL: resource-first differs from the old qualifier-only call — the fix changes real output',
    `today="${today}" old="${oldStyleLabel}"`);
}

// ---------------------------------------------------------------------------
console.log("\n3 · end to end — through session@1's projection, both views\n");

{
  const session = {
    schema: 'panlabs-aws-diagrams/session@1',
    id: 'resource-probe', title: 'probe', stage: 'technical',
    nodes: [
      { id: 'cloud', logical: { kind: 'group' }, technical: { kind: 'cloud' } },
      {
        id: 'orders', inside: 'cloud',
        logical: { kind: 'block', label: 'Guardar pedidos', qualifier: QUALIFIER },
        technical: { kind: 'service', service: 'dynamodb', resource: RESOURCE, qualifier: QUALIFIER },
      },
    ],
    edges: [],
  };

  const { model: technical } = project(session, 'technical');
  const tNode = technical.nodes.find(n => n.id === 'orders');
  ok(tNode.resource === RESOURCE && tNode.qualifier === QUALIFIER,
    'the technical projection carries BOTH resource and qualifier onto model@1',
    JSON.stringify({ resource: tNode.resource, qualifier: tNode.qualifier }));

  const { model: logical } = project(session, 'logical');
  const lNode = logical.nodes.find(n => n.id === 'orders');
  ok(lNode.resource === undefined,
    'the logical projection carries no resource at all — logicalFacet never declared one',
    JSON.stringify(lNode));
  ok(lNode.qualifier === QUALIFIER,
    'and the logical leaf falls back to qualifier');

  const rTechnical = await generate(technical, { tema: 'corporate' });
  const mTechnical = rTechnical.xml.match(/<mxCell id="orders"[^>]*value="([^"]*)"/);
  ok(mTechnical && mTechnical[1].includes(`&lt;i&gt;${RESOURCE}&lt;/i&gt;`),
    'technical view XML: the leaf shows the resource in italics',
    mTechnical && mTechnical[1]);

  const rLogical = await generate(logical, { tema: 'corporate' });
  const mLogical = rLogical.xml.match(/<mxCell id="orders"[^>]*value="([^"]*)"/);
  ok(mLogical && mLogical[1].includes(`&lt;i&gt;${QUALIFIER}&lt;/i&gt;`) && !mLogical[1].includes(RESOURCE),
    'logical view XML: the leaf shows the qualifier, never the resource',
    mLogical && mLogical[1]);
}

// ---------------------------------------------------------------------------
console.log(failures
  ? `\n  ✗ ${failures} failure(s)`
  : '\n  ✓ resource is born in model@1 and session@1, and the view picks the right leaf line.');
process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
