#!/usr/bin/env node
'use strict';
/**
 * STEP 5 OF THE ARC — wakes the logical view and writes the `.drawio` that resumes it.
 *
 *   node tools/approve.cjs <logical-session.json> --by <who> --candidate <id> \
 *        [--at YYYY-MM-DD] [--output x.drawio]
 *
 * Takes a `session@1` in the logical stage. Outputs a one-page `.drawio` that
 * carries EVERYTHING the next session will need — the model, the dossier, the
 * agreement and the two drawing snapshots. There is no second file, and there
 * is nothing that lives only in the agent's memory.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE THE ALTERNATIVE WAS WORSE.
 *
 * Until #29, `SKILL.md` told the agent to WRITE a twenty-line driver at the
 * skill's root and run `node approve.cjs`. Three things broke:
 *
 *   1. the skill directory accumulated one `.cjs` per session, and whoever
 *      installed the skill inherited the leftovers of whoever used it before;
 *   2. an installed skill is frequently READ-ONLY — the official authoring doc
 *      says so out loud —, and there the arc simply did not run;
 *   3. twenty lines rewritten every session are twenty lines to get wrong. The
 *      reason a deterministic engine exists is to not rewrite what is already
 *      right.
 *
 * With no argument at all it runs the corpus case (`retail`), which is what
 * layer 6 of the suite exercises.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { validate } = require(path.join(ROOT, 'session', 'validate.cjs'));
const { approve, check } = require(path.join(ROOT, 'session', 'agreement.cjs'));
const { draw } = require(path.join(ROOT, 'session', 'draw.cjs'));
const { resolveRoot } = require(path.join(ROOT, 'tools', 'case.cjs'));

const HELP = `
  node tools/approve.cjs <logical-session.json> [options]

    --by <who>             who approved            (default: "user")
    --candidate <id>       which candidate won      (default: the one with state "chosen",
                           or the dossier's only one)
    --at <YYYY-MM-DD>      agreement date           (default: today)
    --output <x.drawio>    where to write           (default: <repo-root>/output/<model-id>.drawio,
                                                      never inside this skill's own tree)

  With no argument at all, runs the shipped example (examples/session/retail-logical.json).
`;

// One single pass, so the positional cannot be confused with the VALUE of an
// option — `--by Thiago x.json` has to leave `x.json` as positional and not
// as a second `--by`.
const WITH_VALUE = ['by', 'candidate', 'at', 'output'];

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

// Without --candidate the agent would have to repeat information the dossier
// already carries. The interrogation marks the chosen one with `state: "chosen"`
// at step 3; reading it from there is the only way for the command to not ask
// back for what it already received.
function candidateFromDossier(session) {
  const cs = (session.dossier && session.dossier.candidates) || [];
  const chosen = cs.find(c => c.state === 'chosen');
  if (chosen) return chosen.id;
  if (cs.length === 1) return cs[0].id;
  return null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const { opts, positional } = parse(process.argv.slice(2));
  if (opts.help || opts.h) { console.log(HELP); return; }

  const input = positional[0] || path.join(ROOT, 'examples', 'session', 'retail-logical.json');

  if (!fs.existsSync(input)) {
    console.error(`\n  ✗ could not find ${input}`);
    console.error(HELP);
    process.exit(1);
  }

  const session = JSON.parse(fs.readFileSync(input, 'utf8'));
  console.log(`\n  APPROVE · ${session.title}\n`);

  const v = validate(session);
  for (const a of v.warnings) console.log(`  ⚠ ${a}`);
  if (!v.ok) {
    console.error(`\n  ✗ invalid model (${v.fase})`);
    for (const e of v.errors) console.error(`      · ${e}`);
    process.exit(1);
  }
  console.log(`  validate    ok · stage=${session.stage} · ${session.nodes.length} nodes · ${session.edges.length} edges`);

  const candidate = opts.candidate || candidateFromDossier(session);
  if (!candidate) {
    console.error('\n  ✗ do not know which candidate was approved.');
    console.error('    None has `state: "chosen"` in the dossier and there is more than one.');
    console.error('    Pass --candidate <id>, or mark the chosen one in the dossier (step 3 of the arc).\n');
    process.exit(1);
  }

  // Approval changes neither a node nor an edge — what changes is the dossier
  // gaining the SNAPSHOT of the logical projection. `check()` reprojects and
  // compares afterwards.
  const approved = approve(session, {
    at: opts.at || today(),
    by: opts.by || 'user',
    candidate,
  });
  const ac = approved.dossier.agreement;
  console.log(`  approve     candidate="${candidate}" by="${ac.by}" at=${ac.at}`);
  console.log(`              fingerprint ${ac.fingerprint.slice(0, 23)}…  ` +
    `(${ac.snapshot.nodes.length} capabilities, ${ac.snapshot.edges.length} flows)`);

  const d = check(approved);
  console.log(`  check       ${d.ok ? '✓ the agreement holds' : '✗ ' + d.motivo}`);
  if (!d.ok) { for (const x of d.diferencas) console.error(`      · ${x.text}`); process.exit(2); }

  const r = await draw(approved, 'logical');
  for (const a of r.report.warnings) console.log(`  ⚠ ${a}`);
  console.log(`  draw        path="${r.path}" · ${r.model.nodes.length} nodes projected`);

  // #160 — the default used to fall back to `ROOT` (this skill's own tree),
  // exactly the defect `case.cjs`'s `resolveRoot` exists to stop repeating.
  // Only resolved when `--output` was not given: an explicit path has no use
  // for the repo root, and asking `git` for it here would risk a warning
  // that means nothing to a caller who already said where to write.
  let output = opts.output;
  if (!output) {
    const { root, inRepo } = resolveRoot(process.cwd());
    if (!inRepo)
      console.log('  ⚠ not inside a git repository — writing to the current directory instead of a repo root');
    output = path.join(root, 'output', `${session.id}.drawio`);
  }
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, r.xml);
  console.log(`\n  → ${path.relative(process.cwd(), output)}  (${r.xml.length} bytes, 1 page)`);
  console.log('    inside it: the session model, the dossier, the agreement and the two drawing snapshots.');
  console.log('    The conversation can end here. Nothing that was decided depends on me remembering.\n');
}

main().catch(e => {
  console.error(`\n  ✗ ${e.message}`);
  for (const l of e.errors || []) console.error(`      · ${l}`);
  process.exit(1);
});
