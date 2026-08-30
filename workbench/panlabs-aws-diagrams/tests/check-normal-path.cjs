#!/usr/bin/env node
'use strict';
/**
 * #198 — THE NORMAL PATH, END TO END: a technical-stage session written
 * directly — no logical-only stage ever existed, no `dossier.agreement` — has
 * to validate, publish and resume all the same.
 *
 *   node tests/check-normal-path.cjs
 *
 * Until this ticket, `session/validate.cjs` required `dossier.agreement` on
 * EVERY technical-stage session, and `tools/resume.cjs` blocked resuming ANY
 * file with no agreement, with status 2 and the message "no agreement". Both
 * rules were written against the SEQUENTIAL arc alone (`check-arc.cjs` proves
 * that one) and fired just the same on the journey's own documented shortcut:
 * `SKILL.md`'s turn 2 writes `session@1` with `stage: "technical"` straight
 * away, with no logical-only stage ever approved. The case verb published
 * anyway — nothing in `case.cjs` ever called `session/validate.cjs` — and the
 * FIRST resume of that exact file, the every-session-after-the-first case the
 * whole dossier mechanism exists for, died on "no agreement".
 *
 * The fixture is `examples/session/retail-technical.json` itself: the
 * embedded technical example `SKILL.md` points readers at, and the exact
 * shape the acceptance criteria name — stage "technical", no
 * `dossier.agreement`. It is assembled here through `elaborate()` only
 * because that is the shortest way to reach the object the normal path
 * hand-writes directly; the contract under test is the SHAPE that comes out,
 * never the route that produced it.
 *
 * The control is the sequential arc's opposite promise, still standing: an
 * agreement that WAS recorded and no longer matches today's projection still
 * blocks resume with status 2. Without this half, "absence does not block"
 * could have quietly become "nothing blocks" — see step 4 below.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const RESUME_CLI = path.join(ROOT, 'tools', 'resume.cjs');
const { validate } = require(path.join(ROOT, 'session', 'validate.cjs'));
const { approve, check } = require(path.join(ROOT, 'session', 'agreement.cjs'));
const { elaborate } = require(path.join(ROOT, 'session', 'elaborate.cjs'));
const { draw } = require(path.join(ROOT, 'session', 'draw.cjs'));
const { open } = require(path.join(ROOT, 'session', 'open.cjs'));
const { briefing } = require(path.join(ROOT, 'session', 'briefing.cjs'));
const { caseFiles } = require(path.join(ROOT, 'tools', 'case.cjs'));

let failed = 0;
const record = (ok, what, detail) => {
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (detail) console.log(`      ${detail}`);
};

const OUTPUT_DIR = process.env.OUTPUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'panlabs-aws-diagrams-normal-path-'));

(async () => {
  const technical = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'examples', 'session', 'retail-technical.json'), 'utf8')
  );

  // ─────────────────────────────────────────────── 1 · the fixture's own shape
  console.log('\n1 · the fixture is what the normal path actually produces\n');
  record(technical.stage === 'technical', 'stage is "technical"', `got "${technical.stage}"`);
  record(!(technical.dossier && technical.dossier.agreement),
    'no `dossier.agreement` — no logical view was ever approved by a human',
    technical.dossier && technical.dossier.agreement ? 'an agreement is present' : 'absent, as expected');

  // ────────────────────────────────────────────────── 2 · validation, without it
  console.log('\n2 · `session/validate.cjs` accepts it — the acceptance criterion, read literally\n');
  const v = validate(technical);
  record(v.ok, 'validate(technical).ok', (v.errors || []).join(' · ') || 'no errors');
  record(!(v.errors || []).some(e => /agreement/i.test(e)),
    'nothing in the error list mentions the agreement at all',
    (v.errors || []).join(' · ') || '(no errors)');

  // `check()` on the SAME session: `reason` has to say "missing", not "drift" —
  // the two `ok: false` cases this ticket exists to keep apart.
  const bare = check(technical);
  record(!bare.ok && bare.reason === 'missing',
    'agreement.cjs\'s `check()` reports `reason: "missing"`, not `"drift"`',
    `ok=${bare.ok} reason=${bare.reason}`);

  // ───────────────────────────────────────────── 3 · publish, through the real verb
  console.log('\n3 · the case verb publishes it — case.cjs never required an agreement either\n');
  let published;
  try {
    published = await caseFiles(technical, 'normal-path', { gate: 'truthfulness', brief: 'Test brief for the normal path.' });
    record(true, 'caseFiles() draws both views and does not throw');
  } catch (e) {
    record(false, 'caseFiles() draws both views and does not throw', e.message);
  }

  const drawioFile = path.join(OUTPUT_DIR, 'normal-path.drawio');
  if (published) {
    const drawio = published.files.find(f => f.path === 'normal-path.drawio');
    fs.writeFileSync(drawioFile, drawio.content);
    record(fs.existsSync(drawioFile), 'the .drawio landed on disk', `${drawio.content.length} bytes`);
  }

  // ──────────────────────────────────── 4 · resume — the bug this ticket closes
  console.log('\n4 · resume — status 0, and the briefing tells the truth about who decided\n');
  const r = spawnSync('node', [RESUME_CLI, drawioFile], { encoding: 'utf8' });
  record(r.status === 0, 'resume.cjs exits 0 on the published normal-path file',
    r.status !== 0 ? (r.stderr || r.stdout) : `exit ${r.status}`);
  record(!/no agreement/.test(r.stdout + r.stderr),
    'the old "no agreement" refusal is gone from the output',
    /no agreement/.test(r.stdout + r.stderr) ? 'still printed' : 'not printed');
  record(/The agent chose the logical view; no human approved it/.test(r.stdout),
    'the briefing distinguishes an agent\'s own choice from a human approval',
    'looked for the exact sentence in stdout');
  record(!/was approved by a human|approved\b.*\bby\b/i.test(r.stdout.split('The agreement')[1]?.split('Candidates')[0] || ''),
    'and does not forge an approver — no `by`/`at` invented for a decision nobody signed');
  for (const [what, needle] of [
    ['the discarded candidates', 'Micro-lote de 15 minutos'],
    ['the rejected finding', 'spof'],
    ['the parking lot', 'Lambda'],
  ]) record(r.stdout.includes(needle), `the briefing carries ${what}`, `looked for "${needle}"`);

  // and the SAME thing, unit-level, against `session/briefing.cjs` directly —
  // the CLI proof above catches wiring; this one pins the exact wording so a
  // future edit to the string cannot drift without a red here.
  const reopened = open(fs.readFileSync(drawioFile, 'utf8'));
  const body = reopened.ours ? briefing(reopened, { agreement: check(reopened.session) }).join('\n') : '';
  record(reopened.ours, 'the published file is recognized as ours on reopen', reopened.because || '');
  record(body.includes('this session went straight to the technical stage. The agent chose the logical view; no human approved it.'),
    'briefing.cjs, called directly, prints the same sentence');

  // ──────────────────────── 5 · the control: the sequential arc still blocks on DRIFT
  console.log('\n5 · CONTROL: the sequential arc\'s broken promise still blocks — this fix did not disable the check, only its false positive\n');
  const logical = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'session', 'retail-logical.json'), 'utf8'));
  const approved = approve(logical, { at: '2026-08-21', by: 'operations leadership', candidate: 'cand-a' });
  record(check(approved).ok && check(approved).reason === null,
    'freshly approved: `check().ok` is true and `reason` is null — the third value `reason` can take');

  const tampered = JSON.parse(JSON.stringify(approved));
  tampered.nodes.find(n => n.id === 'consultar').label = 'DRIFTED LABEL — planted for this proof';
  const drift = check(tampered);
  record(!drift.ok && drift.reason === 'drift', 'CONTROL: tampering an approved model reports `reason: "drift"`',
    `ok=${drift.ok} reason=${drift.reason}`);

  const driftedDrawio = (await draw(tampered, 'logical')).xml;
  const driftedFile = path.join(OUTPUT_DIR, 'drifted-agreement.drawio');
  fs.writeFileSync(driftedFile, driftedDrawio);
  const r2 = spawnSync('node', [RESUME_CLI, driftedFile], { encoding: 'utf8' });
  record(r2.status === 2, 'CONTROL: resume.cjs still exits 2 on a genuinely drifted agreement',
    `exit ${r2.status}`);
  record(/today's logical projection differs from the approved one/.test(r2.stdout + r2.stderr),
    'CONTROL: and names the drift, not "no agreement"');

  // and the sequential arc's elaboration step, unaffected — a technical model
  // produced through `elaborate()` from an intact agreement still resumes 0
  const delta = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'session', 'retail-elaboration.json'), 'utf8'));
  const elaborated = elaborate(approved, delta);
  const elaboratedDrawioLogical = (await draw(elaborated, 'logical')).xml;
  const elaboratedDrawioTechnical = (await draw(elaborated, 'technical')).xml;
  const { stitch } = require(path.join(ROOT, 'session', 'save.cjs'));
  const elaboratedFile = path.join(OUTPUT_DIR, 'sequential-elaborated.drawio');
  fs.writeFileSync(elaboratedFile, stitch([elaboratedDrawioLogical, elaboratedDrawioTechnical]));
  const r3 = spawnSync('node', [RESUME_CLI, elaboratedFile], { encoding: 'utf8' });
  record(r3.status === 0, 'CONTROL: a genuinely elaborated sequential-arc file still resumes 0',
    r3.status !== 0 ? (r3.stderr || r3.stdout) : `exit ${r3.status}`);
  record(/approved 2026-08-21 by operations leadership/.test(r3.stdout),
    'CONTROL: and its briefing still names who approved it — real approvals are never hidden either');

  console.log();
  if (failed) { console.log(`  ✗ ${failed} normal-path condition(s) did not close.`); process.exit(1); }
  console.log('  ✓ the normal path validates, publishes and resumes with no agreement — and the sequential arc\'s own promise still holds.');
})().catch(e => { console.error('\n  ✗ the normal-path proof blew up:', e.message); console.error(e.stack); process.exit(1); });
