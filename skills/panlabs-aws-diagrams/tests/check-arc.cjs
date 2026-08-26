#!/usr/bin/env node
'use strict';
/**
 * THE END-TO-END ARC — the sequential arc's seven steps, each closing on the
 * condition ITS OWN text sets.
 *
 * #43 turned the front door into three turns and the seven steps into the
 * SEQUENTIAL arc, reached by two triggers `SKILL.md` names. They did not stop
 * existing — they stopped being seven gates — so this file keeps measuring
 * them; what it no longer is, is a reading of the document's spine.
 *
 *   node tests/check-arc.cjs
 *
 * #26 asks for the skill to run *vague need → interview → candidates →
 * approval of the logical view → technical view → `.drawio`*. The criterion
 * has one line up front that decides the subject:
 *
 *   > E1 · the arc runs against a case that DID NOT EXIST before this
 *   >      ticket — validating the arc against its own fixture measures
 *   >      nothing.
 *
 * That is why the case is `predictive-fleet` and not `retail-300-stores`.
 * Retail was already a fixture when #14 and #23 ran; it proves the session
 * layer did not regress, and it is what `tools/approve.cjs` and
 * `tools/resume.cjs` guard. This file proves something else: that the arc
 * closes on a case born after the rules.
 *
 * And the differences from retail are deliberate, so the arc does not walk
 * the same code path twice:
 *
 *   retail   3 accounts · `byAccounts` path · 1+N pages · boundary = account
 *   fleet    1 account  · `byElk` path      · 1 page    · boundary = group
 *
 * ⚠️ IT STARTS AT STEP 2, and that is a declared limit, not an oversight.
 *
 * The *vague need → interview* leg has no code: the interview is a protocol
 * an AGENT runs with a human, and there is no function to call between *"I
 * want to know a truck will break before it breaks on the road"* and the
 * first confirmed fact. What this file does with that leg is check its
 * PRODUCT — every fact confirmed, every inferred one saying where it came
 * from, candidates that do not collapse into each other. From step 4 on,
 * everything runs for real.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { validate } = require(path.join(ROOT, 'session', 'validate.cjs'));
const { approve, check } = require(path.join(ROOT, 'session', 'agreement.cjs'));
const { draw } = require(path.join(ROOT, 'session', 'draw.cjs'));
const { open } = require(path.join(ROOT, 'session', 'open.cjs'));
const { elaborate } = require(path.join(ROOT, 'session', 'elaborate.cjs'));
const { stitch } = require(path.join(ROOT, 'session', 'save.cjs'));
const { project } = require(path.join(ROOT, 'session', 'project.cjs'));
const { publish, prune, countDeliberation } = require(path.join(ROOT, 'session', 'publish.cjs'));
const { review } = require(path.join(ROOT, 'session', 'gaps.cjs'));
const { briefing } = require(path.join(ROOT, 'session', 'briefing.cjs'));

let failed = 0;
const record = (ok, what, detail) => {
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (detail) console.log(`      ${detail}`);
};

const LOGICAL = path.join(ROOT, 'models', 'session', 'fleet-logical.json');
const DELTA = path.join(ROOT, 'models', 'session', 'fleet-elaboration.json');
const OUTPUT = path.join(ROOT, 'output', 'predictive-fleet.drawio');
const PUBLISHED = path.join(ROOT, 'output', 'predictive-fleet.published.drawio');

(async () => {
  const session = JSON.parse(fs.readFileSync(LOGICAL, 'utf8'));

  // ─────────────────────────────────────────────── step 2 · the interview closes
  console.log('\nstep 2 · the interview closes when A1 hits the floor\n');
  {
    const v = validate(session);
    record(v.ok, 'the session model is valid against `session@1`', (v.erros || []).join(' · ') || 'no errors');

    const facts = session.dossier.facts || [];
    record(facts.length > 0 && facts.every(f => f.confirmed),
      "every fact in the dossier is confirmed — inferred does not count until confirmed",
      `${facts.length} facts, ${facts.filter(f => f.provenance === 'inferred').length} inferred, ` +
      `all with \`confirmed: true\``);

    const missingFrom = facts.filter(f => f.provenance === 'inferred' && !f.from);
    record(!missingFrom.length, 'every inferred fact says WHERE it came from',
      missingFrom.length ? missingFrom.map(f => f.fact).join(' · ') : 'the inferred ones carry the source excerpt');
  }

  // ────────────────────────────────────── step 3 · genuinely distinct candidates
  console.log('\nstep 3 · every pair of candidates differs on ≥1 axis, and you can name which\n');
  {
    const cs = session.dossier.candidates || [];
    record(cs.length >= 2 && cs.length <= 3, 'ceiling 3, floor 2', `${cs.length} candidates`);
    record(cs.filter(c => c.state === 'chosen').length === 1, 'exactly one chosen');

    // the tuple invariant: no pair collapses
    const collapsed = [];
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++)
        if (JSON.stringify(cs[i].tuple) === JSON.stringify(cs[j].tuple))
          collapsed.push(`${cs[i].id}=${cs[j].id}`);
    record(!collapsed.length, 'no pair has the SAME tuple — equal tuples collapse and would be discarded',
      collapsed.length ? collapsed.join(' · ') : `${(cs.length * (cs.length - 1)) / 2} pairs, all distinct`);

    // and `differsIn` has to match the REAL difference against the chosen one
    const chosen = cs.find(c => c.state === 'chosen');
    const AXES = ['E1', 'E2', 'E3', 'E4', 'E5'];
    for (const c of cs.filter(x => x.state === 'discarded')) {
      const actual = AXES.filter((_, i) => c.tuple[i] !== chosen.tuple[i]);
      record(JSON.stringify(actual.sort()) === JSON.stringify([...(c.differsIn || [])].sort()),
        `"${c.id}": \`differsIn\` matches the tuple, not the intent`,
        `declared [${(c.differsIn || []).join(',')}] · measured [${actual.join(',')}]`);
      record(!!c.because, `"${c.id}" discarded carries \`because\` — it is what answers "why not B?"`);
    }
  }

  // ─────────────────────────────────── step 4 · the gap review, with the code
  console.log('\nstep 4 · the review runs over the assembled graph, and the refusal reaches the drawing\n');
  {
    const proj = project(session, 'logical').model;
    const r = review(proj);
    record(r.dentroDoTeto, "the review stays within §4.2's ceiling",
      `${r.findings.length} finding(s) · ceiling ⌈${proj.nodes.length}÷4⌉ = ${r.ceiling}`);

    // what the code finds has to be in the dossier: the dossier is the
    // DECISION about the finding, and a finding with no decision is a finding
    // nobody saw
    const decided = new Set((session.dossier.findings || []).map(a => `${a.rule}/${a.target}`));
    const undecided = r.findings.filter(a => !decided.has(`${a.rule}/${a.target}`));
    record(!undecided.length, 'every finding the code produces has a decision in the dossier',
      undecided.length
        ? undecided.map(a => `${a.rule}/${a.target}`).join(' · ')
        : [...decided].join(' · '));

    // and the rejection has to have an explicit link to a note
    const rejected = (session.dossier.findings || []).filter(a => a.state === 'rejected');
    record(rejected.length > 0, 'the case exercises at least one REJECTION', `${rejected.length} rejection(s)`);
    for (const a of rejected) {
      const note = (session.notes || []).find(n => n.id === a.viaNote);
      record(!!note && note.origin === 'rejected-finding',
        `the rejection of "${a.rule}/${a.target}" reaches the drawing via \`viaNote\``,
        note ? `→ ${note.id} (origin "${note.origin}")` : 'no note linked — the rejection would die in the dossier');
    }
  }

  // ──────────────────────────────────── step 5 · the agreement, and it is checkable
  console.log('\nstep 5 · approval is not a boolean — it is the snapshot, and it checks out\n');
  let approved;
  {
    approved = approve(session, { at: '2026-08-23', by: 'operations leadership', candidate: 'cand-a' });
    const d = check(approved);
    record(d.ok, '`check(approved).ok` right after approving');
    record(/^sha256:[0-9a-f]{64}$/.test(approved.dossier.agreement.fingerprint),
      'the agreement stores the fingerprint of the snapshot, not a `true`',
      approved.dossier.agreement.fingerprint.slice(0, 26) + '…');

    // and the control: touching what was approved has to BREAK the agreement
    const tampered = JSON.parse(JSON.stringify(approved));
    tampered.nodes.find(n => n.id === 'pontuar-risco').label = 'Risk scoring (v2)';
    record(!check(tampered).ok,
      'CONTROL: changing an approved label breaks the agreement — otherwise the agreement measured nothing',
      `${(check(tampered).diferencas || []).length} difference(s) reported`);

    const r = await draw(approved, 'logical');
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, r.xml);
    record(fs.existsSync(OUTPUT), 'the logical view is written', `${r.xml.length} bytes, path "${r.caminho}"`);

    const semanticFailures = r.relatorio.geometry.reduce((s, x) => s + x.report.semanticas.length, 0);
    record(semanticFailures === 0, 'the logical view has no semantic failure', `${semanticFailures} semantic`);
  }

  // ───────────────── step 6 · the technical view, and the projection survives the network level
  console.log('\nstep 6 · the technical phase inserts VPC and subnet, and the approved stays approved\n');
  let technical;
  {
    const opened = open(fs.readFileSync(OUTPUT, 'utf8'));
    record(opened.ours, 'the written `.drawio` is recognized as ours', opened.because || '');

    const delta = JSON.parse(fs.readFileSync(DELTA, 'utf8'));
    technical = elaborate(opened.session, delta);

    const v = validate(technical);
    record(v.ok, 'the elaborated model is still valid', (v.erros || []).join(' · ') || 'no errors');

    // #14's PROOF: the approved node was pushed two levels down…
    const target = technical.nodes.find(n => n.id === 'pontuar-risco');
    record(target.inside === 'sub-modelo',
      '`pontuar-risco` was reparented into a subnet the logical view does not know about',
      `inside = "${target.inside}" (was "analise")`);

    // …and today's logical projection still comes out IDENTICAL
    const d = check(technical);
    record(d.ok, "E3 · `check()` still passes — today's logical projection is byte for byte the approved one",
      d.ok ? 'the containment collapse rides right over the technical-only levels'
        : (d.diferencas || []).map(x => x.text).join(' · '));

    const rl = await draw(technical, 'logical');
    const rt = await draw(technical, 'technical');
    fs.writeFileSync(OUTPUT, stitch([rl.xml, rt.xml]));

    const semanticFailures = rt.relatorio.geometry.reduce((s, x) => s + x.report.semanticas.length, 0);
    record(semanticFailures === 0, 'E4 · the technical view passes the truthfulness gate — zero semantic failures',
      `${rt.relatorio.geometry.length} page(s), ${semanticFailures} semantic`);

    // and no service name leaked into the logical view
    const logical = project(technical, 'logical').model;
    const leaked = logical.nodes.filter(n => n.service && n.kind !== 'actor');
    record(!leaked.length, 'no AWS service name leaked into the logical view',
      leaked.length ? leaked.map(n => `${n.id}=${n.service}`).join(' · ')
        : `${logical.nodes.length} logical nodes, zero \`service\` outside an actor`);
  }

  // ───────────────────────────────────── step 1 · the resume door (the briefing)
  console.log('\nstep 1 · the file resumes, and the briefing returns what does not get asked again\n');
  {
    const opened = open(fs.readFileSync(OUTPUT, 'utf8'));
    record(opened.ours, 'the stitched file is still recognized');
    const body = briefing(opened).join('\n');
    for (const [what, needle] of [
      ['the discarded candidates, with the reason', 'Lote noturno'],
      ['the findings and their state', 'spof'],
      ['the parking lot', 'Kinesis'],
    ]) record(body.includes(needle), `the briefing carries ${what}`, `looked for "${needle}"`);
  }

  // ────────────────────────────────────────── step 7 · the copy that circulates
  console.log('\nstep 7 · the file that resumes and the one that circulates are not the same file\n');
  {
    const workingXml = fs.readFileSync(OUTPUT, 'utf8');
    const opened = open(workingXml);
    const before = countDeliberation(opened.session);
    const after = countDeliberation(prune(opened.session));
    record(before > 0 && after === 0, 'pruning strips all deliberation from the seal',
      `${before} item(s) before, ${after} after`);

    fs.writeFileSync(PUBLISHED, publish(workingXml));
    const bytes = fs.readFileSync(PUBLISHED, 'utf8');
    for (const [what, needle] of [
      ["a candidate's discard reason", 'a antecedência de 48 h não sobrevive'],
      ['who approved', 'operations leadership'],
      ['the meeting remark that became an inferred fact', 'o pessoal de dados falou'],
    ]) record(!bytes.includes(needle), `E5 · the published copy does NOT carry ${what}`, `looked for "${needle}" in the bytes`);

    // …and the control on the other end: the working file carries it
    const working = fs.readFileSync(OUTPUT, 'utf8');
    record(working.includes('a antecedência de 48 h não sobrevive'),
      'CONTROL: the WORKING file carries the deliberation — otherwise the check above measured nothing');

    // ⚠️ the copy is still OURS — what it stops being is RESUMABLE, and the two
    // are different: a file that was not recognized would not be able to say
    // WHY it does not resume.
    const reopened = open(bytes);
    record(reopened.published === true && reopened.session === null,
      'E5 · the published copy declares itself published and returns no session',
      reopened.because || '');
    record(/publicada/i.test(reopened.because || ''),
      'and says why, instead of just failing', (reopened.because || '').slice(0, 72) + '…');
  }

  console.log();
  if (failed) { console.log(`  ✗ ${failed} arc condition(s) did not close.`); process.exit(1); }
  console.log('  ✓ the seven steps close, on a case that did not exist before this ticket.');
})().catch(e => { console.error('\n  ✗ the arc blew up:', e.message); console.error(e.stack); process.exit(1); });
