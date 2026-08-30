#!/usr/bin/env node
'use strict';
/**
 * STEPS 1 AND 6 OF THE ARC — resumes a saved `.drawio` and, if you pass a delta,
 * elaborates the technical view on top of what was approved.
 *
 *   node tools/resume.cjs <file.drawio>                          briefing only
 *   node tools/resume.cjs <file.drawio> --delta <elaboration.json> [--output y.drawio]
 *
 * They are two steps in the same command because they are the same read:
 * recognizing the file, classifying the pages and returning the briefing is step
 * 1; applying the delta on top of the result is step 6. Splitting them would force
 * reading and classifying twice, and the second read could disagree with the
 * first.
 *
 * This is what comes out of here, in this order:
 *
 *   1. recognition       — is this file mine?
 *   2. drawing state     — did the human touch it since I saved it?
 *   3. briefing          — what was decided, rejected, parked
 *   4. elaboration       — the technical delta over the approved model  (only with --delta)
 *   5. check             — does today's logical projection still match the approved one?
 *   6. both views        — in the SAME file. Two VIEWS; since #12 the multi-account
 *                          technical view is already 1+N pages (D2 of #6), so the
 *                          file has 1 + 1 + N.
 *
 * Step 5 is what the ticket buys by using a single IR: it would not exist with two
 * models linked by a mapping, because there would be no way to know whether the
 * mapping is correct.
 *
 * WARNING: UNTIL #29 STEP 6 HAD NO COMMAND. `SKILL.md` told the agent to write a
 * twenty-line driver at the skill's root — see the header of `approve.cjs` for the
 * three reasons that was undone.
 *
 * With no argument at all it runs the corpus case (`retail`), which is what layer
 * 6 of the suite exercises.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { open, differ, policy, canRegenerate } = require(path.join(ROOT, 'session', 'open.cjs'));
const { briefing } = require(path.join(ROOT, 'session', 'briefing.cjs'));
const { elaborate } = require(path.join(ROOT, 'session', 'elaborate.cjs'));
const { validate } = require(path.join(ROOT, 'session', 'validate.cjs'));
const { check } = require(path.join(ROOT, 'session', 'agreement.cjs'));
const { draw } = require(path.join(ROOT, 'session', 'draw.cjs'));
const { stitch } = require(path.join(ROOT, 'session', 'save.cjs'));
const { readPages } = require(path.join(ROOT, 'session', 'fingerprint.cjs'));

const HELP = `
  node tools/resume.cjs <file.drawio> [options]

    --delta <elaboration.json>  applies the technical phase's delta (step 6 of the arc).
                                 Without it, the command only prints the briefing (step 1).
    --output <y.drawio>         where to save both views   (default: the file itself)

  With no argument at all, runs the shipped example (output/retail.drawio with
  examples/session/retail-elaboration.json).

  Exit codes:
    0  all good
    1  the file is not mine, or the elaborated model does not validate
    2  a page diverged, or the elaboration changed what was approved
`;

const WITH_VALUE = ['delta', 'output'];

function parse(args) {
  const opts = {}; const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const name = a.slice(2);
    if (WITH_VALUE.includes(name)) { opts[name] = args[++i]; continue; }
    opts[name] = true;
  }
  return { opts, positional };
}

async function main() {
  const { opts, positional } = parse(process.argv.slice(2));
  if (opts.help || opts.h) { console.log(HELP); return; }

  const input = positional[0] || path.join(ROOT, 'output', 'retail.drawio');
  // The delta default only holds when the INPUT is also the corpus one. Inheriting
  // retail's delta on an arbitrary file would apply the wrong technical facet —
  // and `elaborate` would refuse it via `about`, but with a message that does not
  // explain the cause. Better not to get there.
  const delta = opts.delta
    || (positional.length === 0 ? path.join(ROOT, 'examples', 'session', 'retail-elaboration.json') : null);

  if (!fs.existsSync(input)) {
    console.error(`\n  ✗ could not find ${input}`);
    console.error(HELP);
    process.exit(1);
  }

  const xml = fs.readFileSync(input, 'utf8');
  console.log(`\n  RESUME · ${path.relative(process.cwd(), input)}`);

  // 1 and 2 -------------------------------------------------------------------
  const opened = open(xml);
  if (!opened.ours) { console.error(`\n  ✗ ${opened.because}`); process.exit(1); }

  const blocking = opened.pages.filter(p => policy(p.state).blocks);
  const moved = opened.pages.filter(p => p.state === 'moved');

  // 3 -----------------------------------------------------------------------
  const agreementBefore = check(opened.session);
  for (const l of briefing(opened, { agreement: agreementBefore })) console.log(l);

  // The block comes AFTER the briefing on purpose: even when it is not possible to
  // proceed, the user gets the context back. Blocking before recounting what is
  // known turns a small problem into a lost session.
  if (blocking.length) {
    console.log('\n  ┌─ DIVERGENCE ' + '─'.repeat(50));
    for (const p of blocking) {
      console.log(`  │ page "${p.name || p.id}": ${policy(p.state).say}`);
      if (p.state !== 'divergent') continue;
      const canRegen = canRegenerate(opened.session, p.view);
      if (!canRegen.can) { console.log(`  │   ${canRegen.because}`); continue; }
      const ref = await draw(opened.session, p.view);
      // The reference is the page with the SAME id — with 1+N pages per view,
      // always taking the first would compare the consolidated view against a
      // detail one and call the difference between two distinct pages
      // "divergence".
      const refPages = readPages(ref.xml).pages;
      const ref1 = refPages.find(x => x.id === p.id) || refPages[0];
      const d = differ(p, ref1.cells);
      console.log(`  │ ${d.findings.length} difference(s): ${d.absorbable} the model can express, ${d.opaque} it cannot.`);
      for (const a of d.findings) {
        const where = a.category === 'absorbable' ? `absorbable → ${a.where}` : 'opaque';
        console.log(`  │   · ${String(a.kind).padEnd(14)} ${String(a.id).padEnd(24)} ${a.was !== undefined && a.became !== undefined ? `"${a.was}" -> "${a.became}"` : a.was !== undefined ? `was "${a.was}"` : `came "${a.became}"`}  [${where}]`);
      }
    }
    console.log('  └' + '─'.repeat(63));
    console.log('\n  I will not regenerate over this. Either you tell me what changed and I absorb it into the model,');
    console.log('  or the drawing becomes the truth and the model was abandoned. I do not guess which.\n');
    process.exit(2);
  }
  for (const p of moved)
    console.log(`\n  ⚠ page "${p.name || p.id}": ${policy(p.state).say}`);

  // A MISSING agreement is not a problem: it is the normal path's own signature
  // (#198) — the agent went straight to the technical stage, and there was
  // never a human approval to lose. Only DRIFT blocks — an agreement that WAS
  // recorded and no longer matches today's projection, which is the sequential
  // arc's actual promise broken.
  if (agreementBefore.reason === 'drift') { console.error(`\n  ✗ agreement: ${agreementBefore.motivo}`); process.exit(2); }

  // Resuming a file already at the technical stage is not an error, and is the
  // common case from the third session on — whether it got there through the
  // sequential arc's `--delta` or was written straight into the technical stage
  // by the normal path. What it is not, either way, is a reason to apply a
  // delta: reapplying one would only produce "already had a technical facet"
  // ten times over.
  if (opened.session.stage === 'technical') {
    console.log('\n  This file is already at the technical stage — both views are in here.');
    console.log('  Nothing to do: the briefing above and the pages\' state already are the resumption.\n');
    return;
  }

  // With no delta the command stops here, and that is step 1 of the arc
  // fulfilled: the agent got back the agreement, the discarded candidates with
  // their reason, the rejected findings and the parking lot. None of that gets
  // asked again.
  if (!delta) {
    console.log('\n  Briefing delivered. This file is at the LOGICAL stage.');
    console.log('  To elaborate the technical view, pass --delta <elaboration.json>');
    console.log('  (the delta\'s shape is in guide/model.md).\n');
    return;
  }

  if (!fs.existsSync(delta)) { console.error(`\n  ✗ could not find the delta ${delta}\n`); process.exit(1); }

  // 4 and 5 -------------------------------------------------------------------
  const elaboration = JSON.parse(fs.readFileSync(delta, 'utf8'));
  const technical = elaborate(opened.session, elaboration);
  console.log(`\n  elaborate   ${opened.session.nodes.length} → ${technical.nodes.length} nodes, ` +
    `${opened.session.edges.length} → ${technical.edges.length} edges  (stage=${technical.stage})`);

  const v = validate(technical);
  for (const a of v.warnings) console.log(`  ⚠ ${a}`);
  if (!v.ok) { console.error(`\n  ✗ invalid model (${v.fase})`); for (const e of v.errors) console.error(`      · ${e}`); process.exit(1); }

  const agreementAfter = check(technical);
  console.log(`  check       ${agreementAfter.ok ? '✓ the TECHNICAL model\'s logical projection is byte for byte the one that was approved' : '✗ ' + agreementAfter.motivo}`);
  for (const d of agreementAfter.diferencas) console.log(`      · ${d.text}`);
  if (!agreementAfter.ok) {
    console.error('\n  The technical elaboration changed what was approved. That calls for a fresh approval, not a new drawing.\n');
    process.exit(2);
  }

  // 6 -----------------------------------------------------------------------
  const rl = await draw(technical, 'logical');
  const rt = await draw(technical, 'technical');
  for (const a of rt.report.warnings) console.log(`  ⚠ ${a}`);
  console.log(`  draw        logical: ${rl.model.nodes.length} nodes, ${rl.model.edges.length} edges  ·  ` +
    `technical: ${rt.model.nodes.length} nodes, ${rt.model.edges.length} edges (path "${rt.path}")`);
  if (rt.trail.collapsed.length)
    console.log(`              collapse: ${rt.trail.collapsed.length} node(s) from the technical view re-anchor onto the logical one`);
  for (const c of rl.trail.contracted)
    console.log(`              contracted ${c.from} → ${c.to} through [${c.by.join(', ')}]  ("${c.label}")`);

  // The proof that elaborating technically did not touch the approved drawing.
  const previousPage = opened.pages.find(p => p.view === 'logical');
  const newPage = readPages(rl.xml).pages.find(x => x.id === (previousPage && previousPage.id)) || readPages(rl.xml).pages[0];
  const identical = previousPage && previousPage.seal.panlabsSemantica === newPage.seal.panlabsSemantica
    && previousPage.seal.panlabsAparencia === newPage.seal.panlabsAparencia;
  console.log(`  check       ${identical ? '✓' : '✗'} the logical page came out identical to the approved one — not a pixel of what was approved changed`);
  if (!identical) process.exitCode = 1;

  const combined = stitch([rl.xml, rt.xml]);
  const output = opts.output || input;
  fs.writeFileSync(output, combined);
  const pageCount = readPages(combined).pages.length;
  console.log(`\n  → ${path.relative(process.cwd(), output)}  (${combined.length} bytes, ${pageCount} page(s): ` +
    `1 logical + ${pageCount - 1} from the technical view)`);
  console.log('    The approved view and the technical one are in the same file. There is no second place to drift apart.\n');
}

main().catch(e => {
  console.error(`\n  ✗ ${e.message}`);
  for (const l of e.errors || []) console.error(`      · ${l}`);
  process.exit(1);
});
