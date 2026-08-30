#!/usr/bin/env node
'use strict';
/**
 * #197 — `dossier.findings.target` is not always a node.
 *
 *   node tests/check-finding-target.cjs
 *
 * The finding that motivated this file: a real gap review flagged
 * `cross-account-sem-confianca` and came back with `target: "f7"` — the id of
 * the crossing EDGE, because that is what the rule is about (session/gaps.cjs's
 * `ruleTrust`), not either account it touches. `session/validate.cjs` only
 * checked `target` against the node ids, so the only way to publish the case
 * was to drop the target and keep "f7" in free text — machine addressing lost
 * for exactly the finding the case most needed to point at.
 *
 * This is the reproduction, in the smallest shape that exercises the real
 * path: a two-account model with one crossing whose edge carries an explicit
 * `id`, walked through `review()` → `dossier.findings` → `validate()` →
 * `case.md` → `publish()` → the round trip through a real `.drawio`.
 */

const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const { validate } = require(path.join(ROOT, 'session', 'validate.cjs'));
const { project } = require(path.join(ROOT, 'session', 'project.cjs'));
const { review } = require(path.join(ROOT, 'session', 'gaps.cjs'));
const { caseNotes } = require(path.join(ROOT, 'session', 'case-notes.cjs'));
const { prune } = require(path.join(ROOT, 'session', 'publish.cjs'));
const { draw } = require(path.join(ROOT, 'session', 'draw.cjs'));
const { open } = require(path.join(ROOT, 'session', 'open.cjs'));

let failed = 0;
const record = (ok, what, detail) => {
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (detail) console.log(`      ${detail}`);
};

const clone = o => JSON.parse(JSON.stringify(o));

// The two-account crossing the reported case had: an edge with an explicit
// `id`, and no habilitador (`enables`) drawn at either end — the exact shape
// `ruleTrust` (session/gaps.cjs) fires on.
function baseSession() {
  return {
    schema: 'panlabs-aws-diagrams/session@1',
    id: 'cross-account-target-check',
    title: 'Cross-account crossing — regression for #197',
    stage: 'technical',
    nodes: [
      { id: 'cloud', label: 'AWS Cloud', layer: 'technical', technical: { kind: 'cloud' } },
      { id: 'c-origem', label: 'Conta origem', inside: 'cloud', layer: 'technical',
        technical: { kind: 'account', account: '200000000021' } },
      { id: 'svc-origem', label: 'Serviço de origem', inside: 'c-origem', layer: 'technical',
        technical: { kind: 'service', service: 'ecs' } },
      { id: 'c-destino', label: 'Conta destino', inside: 'cloud', layer: 'technical',
        technical: { kind: 'account', account: '200000000022' } },
      { id: 'svc-destino', label: 'Serviço de destino', inside: 'c-destino', layer: 'technical',
        technical: { kind: 'service', service: 's3' } },
    ],
    edges: [
      { id: 'f7', from: 'svc-origem', to: 'svc-destino', label: 'grava' },
    ],
    notes: [
      { id: 'n-cross', text: 'Travessia conhecida e aceita: acordo entre as contas assinado fora da esteira (2026-08).',
        origin: 'rejected-finding' },
    ],
    dossier: {
      findings: [
        { rule: 'cross-account-sem-confianca', target: 'f7', state: 'rejected',
          note: 'INTERNAL — decisão tomada na reunião de arquitetura', viaNote: 'n-cross', at: '2026-08-27' },
      ],
      agreement: { view: 'logical', fingerprint: `sha256:${'0'.repeat(64)}`, snapshot: {} },
    },
  };
}

(async () => {
  console.log('\n1 · review-gaps hands back the edge id, unmodified\n');
  {
    const session = baseSession();
    const projected = project(session, 'technical').model;
    const r = review(projected);
    const crossing = r.findings.find(f => f.rule === 'cross-account-sem-confianca');
    record(!!crossing, 'the crossing fires — two accounts, one edge, no habilitador drawn');
    record(crossing && crossing.target === 'f7',
      'and its target IS the edge id, exactly as the model declared it — nothing to adapt before it goes in the dossier',
      crossing ? `target = "${crossing.target}"` : '(no finding)');
  }

  console.log('\n2 · dossier.findings.target accepts an edge id, and rejects what is neither\n');
  {
    const v = validate(baseSession());
    record(v.ok, 'a finding targeting the edge id validates clean', (v.errors || []).join(' | ') || 'no errors');

    const ghost = baseSession();
    ghost.dossier.findings[0].target = 'nao-existe-em-lugar-nenhum';
    const vGhost = validate(ghost);
    record(!vGhost.ok && vGhost.errors.some(e => e.includes('does not exist among the nodes or edges')),
      'CONTROL: a target that is neither a node nor an edge still fails, and says so',
      vGhost.errors.join(' | '));

    const node = baseSession();
    node.dossier.findings[0].target = 'svc-origem';
    delete node.dossier.findings[0].viaNote;
    node.dossier.findings[0].state = 'accepted';
    const vNode = validate(node);
    record(vNode.ok, 'CONTROL: a node id still validates — the fix widens the check, it does not narrow it',
      (vNode.errors || []).join(' | ') || 'no errors');
  }

  console.log('\n3 · every state — accepted, resolved, rejected — keeps the edge target\n');
  for (const state of ['accepted', 'resolved', 'rejected']) {
    const s = baseSession();
    s.dossier.findings[0].state = state;
    if (state !== 'rejected') delete s.dossier.findings[0].viaNote;
    const v = validate(s);
    record(v.ok, `state "${state}" validates with target still pointing at the edge`,
      (v.errors || []).join(' | ') || 'no errors');
  }

  console.log('\n4 · the rejected finding still needs `viaNote`, edge target or not\n');
  {
    const noLink = baseSession();
    delete noLink.dossier.findings[0].viaNote;
    const v = validate(noLink);
    record(!v.ok && v.errors.some(e => e.includes('viaNote')),
      'a rejection with no `viaNote` still fails — the link to the drawing stays mandatory',
      v.errors.join(' | '));
  }

  console.log('\n5 · case.md names the edge and both ends it connects\n');
  {
    const md = caseNotes(baseSession(), { brief: 'A travessia entre as duas contas do caso.' });
    record(md.includes('on edge `f7` (`svc-origem` → `svc-destino`)'),
      'the edge target reads as an edge, with both endpoints named — not an opaque id',
      md.slice(md.indexOf('**Gap findings**'), md.indexOf('**Gap findings**') + 160));

    const nodeTarget = baseSession();
    nodeTarget.dossier.findings[0].target = 'svc-origem';
    nodeTarget.dossier.findings[0].state = 'accepted';
    delete nodeTarget.dossier.findings[0].viaNote;
    const mdNode = caseNotes(nodeTarget, { brief: 'Controle: alvo é um nó.' });
    record(mdNode.includes('on `svc-origem`') && !mdNode.includes('on edge `svc-origem`'),
      'CONTROL: a node target still reads as a plain node reference, not relabeled as an edge');
  }

  console.log('\n6 · the target survives publication — pruned of the conversation, not of the address\n');
  {
    const pruned = prune(baseSession());
    const f = pruned.dossier.findings[0];
    record(f.target === 'f7' && f.rule === 'cross-account-sem-confianca' && f.state === 'rejected',
      'rule/target/state stay in the copy that circulates', JSON.stringify(f));
    record(f.note === undefined, 'and the deliberation text — the only thing about the conversation — leaves');
  }

  console.log('\n7 · the target survives a real round trip through the .drawio\n');
  {
    const session = baseSession();
    const drawn = await draw(session, 'technical');
    const reopened = open(drawn.xml);
    record(reopened.ours === true, 'the file this suite just drew is recognized as its own');
    const f = (reopened.session && reopened.session.dossier && reopened.session.dossier.findings) || [];
    const back = f.find(a => a.rule === 'cross-account-sem-confianca');
    record(!!back && back.target === 'f7',
      'resuming the file gets the edge target back, unchanged',
      back ? `target = "${back.target}"` : '(finding missing)');
  }

  console.log(failed
    ? `\n  ✗ ${failed} check(s) failed — an edge-targeted finding does not travel the way a node-targeted one does.\n`
    : '\n  ✓ a finding that points at an edge is addressed, validated, published and resumed exactly like one that points at a node.\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
