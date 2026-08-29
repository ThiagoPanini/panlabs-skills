#!/usr/bin/env node
'use strict';
/**
 * #190 — the detail-view fan-out, on the shape #137 left uncovered.
 *
 * `detailPages` (`engine/generate.cjs`) slices one account's sub-tree out of a
 * multi-account model and runs the SAME engine on it (#12's D2). #137 taught
 * the grid to accept the ACCOUNT as its root instead of only `cloud`, but it
 * only exempted the account/vpc/subnet tree itself — a `service` sibling of
 * the VPC, directly under the account, still refused the whole page. That is
 * not a corner case: the blind run behind #190 drew exactly this shape twice
 * (an account mixing a VPC with API Gateway/Cognito/EventBridge/KMS/S3/SNS/SQS
 * hanging directly off it), and no model in this corpus had ever crossed
 * multi-account with an account-level outsider at once —
 * `two-accounts-outside-vpc-services.json` is the first.
 *
 * The fix is `#30`'s own device, one level down: the top-level grid already
 * draws a column of "outsiders" beside the `cloud` box for any top-level node
 * that isn't `cloud`/`vpc`/`subnet`. The detail page now does the same beside
 * the ACCOUNT box, for any node directly under the account that isn't
 * `vpc`/`subnet`.
 *
 *   node tests/check-detail-view-outsiders.cjs
 */

const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));

let failed = 0;
function check(desc, ok) {
  console.log(`  ${ok ? '✓' : '✗'} ${desc}`);
  if (!ok) failed = 1;
  return ok;
}

async function main() {
  // 1 · the corpus model — two accounts, each with its own VPC AND a regional
  // service hanging directly off the account, sibling of the VPC. Both detail
  // views have to come out, with the service drawn as its own outsider column.
  console.log('\n  the corpus model — two accounts, each with a service beside its VPC\n');
  const model = require(path.join(WORKBENCH, 'models', 'two-accounts-outside-vpc-services.json'));
  const r = await generate(model, {});

  check('both detail views come out (1 consolidated + 2 accounts)', r.pages.length === 2);
  check('nothing is reported missing', r.report.detailPagesMissing.length === 0);
  check('no aviso says a detail view didn\'t come out',
    !r.report.warnings.some(a => a.includes("didn't come out")));

  const planStep = r.report.steps.find(s => s.name === 'plan');
  check('the plan milestone counts the full fan-out (3/3)', planStep && planStep.pages === '3/3');

  const outsiderOf = { 'c-agendamento': 'api-agendamento', 'c-resultados': 'queue-resultados' };
  for (const [account, outsider] of Object.entries(outsiderOf)) {
    const page = r.pages.find(p => p.id === `${model.id}-${account}`);
    check(`"${account}": its detail page exists`, !!page);
    if (!page) continue;

    const accountRoot = page.cells.find(c => c.id === account);
    check(`"${account}": its own box is still the root, not shifted or replaced by the outsider`,
      !!accountRoot && accountRoot.parent === '1');

    const outsiderCell = page.cells.find(c => c.id === outsider);
    check(`"${outsider}": drawn as its own outsider column, beside the account (not inside it)`,
      !!outsiderCell && outsiderCell.parent === '1' && outsiderCell.parent !== account);
    check(`"${outsider}": sits to the LEFT of the account box (#5's O19, same side as #30)`,
      !!outsiderCell && !!accountRoot && outsiderCell.geo.x < accountRoot.geo.x);

    const vpcCell = page.cells.find(c => c.parent === account && c.id.startsWith('vpc-'));
    check(`"${account}": its VPC is still drawn inside the account box, untouched`, !!vpcCell);
  }

  // The two intra-account edges that cross an outsider boundary — one leaving
  // an outsider into the grid, one entering it — both have to survive; this is
  // the same "local detour isn't enough" routing `outsiderEdges` already
  // solved for the cloud level, exercised here from a detail page for the
  // first time.
  const agendamentoPage = r.pages.find(p => p.id === `${model.id}-c-agendamento`);
  const resultadosPage = r.pages.find(p => p.id === `${model.id}-c-resultados`);
  check('outsider → grid edge is drawn on the "agendamento" detail page',
    agendamentoPage.cells.some(c => c.kind === 'edge' && c.from === 'api-agendamento' && c.to === 'scheduler-a'));
  check('grid → outsider edge is drawn on the "resultados" detail page',
    resultadosPage.cells.some(c => c.kind === 'edge' && c.from === 'worker-a' && c.to === 'queue-resultados'));

  // 2 · the control — a node the grid genuinely still can't place: a service
  // INSIDE the VPC but outside every subnet. Its parent isn't a subnet (not
  // the grid's own tree) and its root ancestor is the VPC, which is never
  // eligible to become an outsider — so it keeps refusing, loudly, and lists
  // EVERY unsupported node instead of just the first (#190's second finding).
  console.log('\n  control — a node the grid still cannot place, and the warning counts all of them\n');
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
    schema: 'panlabs-aws-diagrams/model@1', id: 'unit-detail-view-outsiders-unsupported',
    title: 'Unit test — a node inside the VPC but outside every subnet', view: 'technical',
    nodes: [
      cloud, ...account('good', 'Good'), ...account('broken', 'Broken'),
      { id: 'stray-1', kind: 'service', service: 's3', inside: 'broken-vpc' },
      { id: 'stray-2', kind: 'service', service: 'dynamodb', inside: 'broken-vpc' },
    ],
    edges: [],
  };
  const rb = await generate(brokenModel, {});

  check('only the placeable account\'s detail view comes out', rb.pages.length === 1 &&
    rb.pages[0].id === 'unit-detail-view-outsiders-unsupported-good');
  check('the unplaceable one is reported, structured',
    rb.report.detailPagesMissing.length === 1 && rb.report.detailPagesMissing[0].account === 'broken');
  const because = rb.report.detailPagesMissing[0].because;
  check('the reason lists BOTH unsupported nodes, not just the first',
    because.includes('"stray-1"') && because.includes('"stray-2"'));

  console.log(failed
    ? '\n  ✗ the detail-view outsider column has a red assertion above'
    : '\n  ✓ a service beside an account\'s own VPC draws as an outsider column · a service ' +
      'genuinely inside the VPC with no subnet still refuses, and the warning names every one of them');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
