#!/usr/bin/env node
'use strict';
/**
 * #137 — the detail-view fan-out, on the shape it silently dropped.
 *
 * `detailPages` (`engine/generate.cjs`) slices one account's sub-tree out of
 * a multi-account model and runs the SAME engine on it (#12's D2). Until
 * this ticket, any account whose sub-model tripped the AZ grid — ≥2 AZs with
 * a repeated subnet role, #19's own trigger — refused outright: the grid
 * only knew how to wrap `vpc`/`subnet` in a `cloud` box, and a detail page's
 * root is the ACCOUNT, not the cloud. That is not a corner case: account >
 * VPC > subnet across two zones is the shape this skill draws the most, and
 * no model in this corpus had ever crossed it with ≥2 accounts at once —
 * `two-accounts-az-redundant.json` is the first.
 *
 *   node tests/check-detail-view-az.cjs
 */

const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));
const { caseNotes } = require(path.join(ROOT, 'session', 'case-notes.cjs'));

let failed = 0;
function check(desc, ok) {
  console.log(`  ${ok ? '✓' : '✗'} ${desc}`);
  if (!ok) failed = 1;
  return ok;
}

async function main() {
  // 1 · the corpus model — two accounts, each with its own VPC and a subnet
  // role repeated across two AZs. Both detail views have to come out.
  console.log('\n  the corpus model — two accounts, both AZ-redundant\n');
  const model = require(path.join(WORKBENCH, 'models', 'two-accounts-az-redundant.json'));
  const r = await generate(model, {});

  check('both detail views come out (1 consolidated + 2 accounts)', r.pages.length === 2);
  check('nothing is reported missing', r.report.detailPagesMissing.length === 0);
  check('no aviso says a detail view didn\'t come out',
    !r.report.warnings.some(a => a.includes("didn't come out")));

  const planStep = r.report.steps.find(s => s.name === 'plan');
  check('the plan milestone counts the full fan-out (3/3)', planStep && planStep.pages === '3/3');

  for (const account of ['c-agendamento', 'c-resultados']) {
    const page = r.pages.find(p => p.id === `${model.id}-${account}`);
    check(`"${account}": its detail page exists`, !!page);
    if (!page) continue;
    const root = page.cells.find(c => c.id === account);
    const modelAccount = model.nodes.find(n => n.id === account);
    check(`"${account}": its own box is the root, labeled and styled as the account — not a fake "AWS Cloud"`,
      !!root && root.label === modelAccount.label && /group_account/i.test(root.style));
    check(`"${account}": its VPC is drawn inside that box`,
      page.cells.some(c => c.parent === account && c.id === `vpc-${account.replace('c-', '')}`));
  }

  // 2 · the control — a node the grid genuinely can't place still refuses
  // THAT account, loudly, and leaves the other account's page alone. Same
  // shape as the top-level grid path's own "cannot yet draw these nodes"
  // refusal (#30), now reachable from a detail page too.
  //
  // A service sibling of the VPC (directly under the ACCOUNT) is no longer
  // this shape — #190 gave it the outsider-column treatment. What still has
  // nowhere to go is a service inside the VPC but outside every subnet: not
  // the grid's own tree (its parent isn't a subnet) and not an outsider
  // either (its root ancestor is the VPC, never eligible to become one).
  console.log('\n  control — a node the grid still cannot place\n');
  const cloud = { id: 'cloud', kind: 'cloud' };
  const account = (id, label) => ([
    { id, kind: 'account', account: '111111111111', label, inside: 'cloud' },
    { id: `${id}-vpc`, kind: 'vpc', label: 'VPC', inside: id },
    { id: `${id}-sub-a`, kind: 'subnet', label: 'App subnet', access: 'private', az: 'us-east-1a', inside: `${id}-vpc` },
    { id: `${id}-sub-b`, kind: 'subnet', label: 'App subnet', access: 'private', az: 'us-east-1b', inside: `${id}-vpc` },
    { id: `${id}-svc-a`, kind: 'service', service: 'ecs', inside: `${id}-sub-a` },
    { id: `${id}-svc-b`, kind: 'service', service: 'ecs', inside: `${id}-sub-b` },
  ]);
  const brokenModel = {
    schema: 'panlabs-aws-diagrams/model@1', id: 'unit-detail-view-unsupported',
    title: 'Unit test — one account the grid cannot place', view: 'technical',
    nodes: [
      cloud, ...account('good', 'Good'), ...account('broken', 'Broken'),
      { id: 'stray', kind: 'service', service: 's3', inside: 'broken-vpc' }, // inside the VPC, outside every subnet
    ],
    edges: [],
  };
  const rb = await generate(brokenModel, {});

  check('only the placeable account\'s detail view comes out', rb.pages.length === 1 &&
    rb.pages[0].id === 'unit-detail-view-unsupported-good');
  check('the unplaceable one is reported, structured — not just buried in warnings',
    rb.report.detailPagesMissing.length === 1 &&
    rb.report.detailPagesMissing[0].account === 'broken' &&
    /grid path cannot yet draw/.test(rb.report.detailPagesMissing[0].because));
  const rbPlanStep = rb.report.steps.find(s => s.name === 'plan');
  check('the plan milestone shows the partial fan-out (2/3)', rbPlanStep && rbPlanStep.pages === '2/3');

  // 3 · case.md's new bullet block — the human-facing side of the same fix.
  // `tools/case.cjs` flattens `report.detailPagesMissing` across both views
  // into `opts.detailPagesMissing`; `case-notes.cjs` renders it as its own
  // block instead of leaving it inside the nine-line `warnings` pile.
  console.log('\n  case.md — the missing-page block, in isolation\n');
  const fakeSession = {
    schema: 'panlabs-aws-diagrams/session@1', id: 'unit-detail-missing', title: 'Unit test', stage: 'technical', nodes: [],
  };
  const mdEmpty = caseNotes(fakeSession, { brief: 'BRIEF.', detailPagesMissing: [] });
  check('with nothing missing, section 5 says so explicitly',
    mdEmpty.includes("Detail views that didn't come out") &&
    mdEmpty.includes('_None — every account got its own detail page._'));

  const mdMissing = caseNotes(fakeSession, {
    brief: 'BRIEF.',
    detailPagesMissing: [{ account: 'broken', view: 'technical', because: 'THE REASON, VERBATIM' }],
  });
  check('with one missing, section 5 names the account, the view and the reason',
    mdMissing.includes('"broken"') && mdMissing.includes('(technical)') && mdMissing.includes('THE REASON, VERBATIM'));

  console.log(failed
    ? '\n  ✗ the detail-view fan-out has a red assertion above'
    : '\n  ✓ two AZ-redundant accounts both get a detail page · a genuinely unplaceable ' +
      'node still refuses, structured · case.md surfaces it without nine warnings');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
