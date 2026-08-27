#!/usr/bin/env node
'use strict';
/**
 * THE CASE VERB — session@1 + slug -> the case's file set, in the CALLER's project.
 *
 *   node tools/case.cjs <session.json> <slug> --brief <brief.txt> [--gate <level>] [--image]
 *
 * #35 moved the arc's output out of the skill's own tree: what used to be
 * written under `output/` inside the package is now born at
 * `docs/architecture/diagrams/<slug>/`, at the root of whoever CALLED the
 * skill. This file is that seam.
 *
 * THE SPLIT, and why it is not one function:
 *
 *   `caseFiles`  session@1 + slug -> [{path, content}]. Pure. No `fs`, no
 *                child process, no path outside the two views it draws. It
 *                mirrors `session/publish.cjs`: the seam returns content and
 *                the CLI is what writes — which is what keeps it testable
 *                without a disk.
 *   `main`       the CLI. Resolves WHERE to write (the caller's git root, or
 *                the current directory with an explicit warning when there
 *                is none), creates the directory, writes the files, and — only
 *                if `--image` was asked for and the binary exists — renders
 *                the PNG alongside.
 *
 * WHY A NEW FILE INSTEAD OF `session/draw.cjs`: that seam already has a name,
 * and it draws ONE view. This one calls it twice and STITCHES the result —
 * same move `tools/resume.cjs` makes at step 6, lifted out so a case can be
 * produced without a `.drawio` already on disk to resume from.
 *
 * WHY THE GATE DEFAULTS TO `truthfulness` HERE, unlike `engine/generate.cjs`
 * (default `none`): the arc's blocking approval is what this path replaces
 * (#35's journey has no human between the two views), and #18 already named
 * `truthfulness` the recommended default for a PUBLISHING gate. Writing into
 * the caller's project is publishing.
 *
 * #42 ADDS `case.md` TO THE FILE SET — the dossier rendered for the human
 * who has to decide whether to trust the drawing, without opening the
 * .drawio: the case verbatim, what was asked vs. inferred, the candidate
 * that won and why not the others, the resource names to confirm, and what
 * still deserves attention. The rendering itself lives in
 * `session/case-notes.cjs` — a pure function, same split as the XML above —
 * and this file's only job is to gather its two inputs: the brief the
 * caller passed in (`opts.brief` — session@1 has nowhere to persist it, and
 * it does not need to: it is spent the moment the case is written) and the
 * semantic failures both draws already measured.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { draw } = require('../session/draw.cjs');
const { stitch } = require('../session/save.cjs');
const { caseNotes } = require('../session/case-notes.cjs');
const { binaryIfPresent } = require('./drawio.cjs');

const DEFAULT_GATE = 'truthfulness';

/**
 * The pure seam. Throws whatever `draw` throws — an unknown gate level, a
 * gate refusal, malformed XML, a failed contrast gate — because a case that
 * did not draw honestly has no file to write, and the caller is a machine
 * (the journey, or this file's own `main`), not a human waiting on a prompt.
 *
 * Requires a TECHNICAL-stage session: BOTH views are the point of a case,
 * and a logical-only session has no technical facet to draw at all. What a
 * case guarantees is the SPLIT, never a count — this seam draws logical
 * first and hands `stitch` that order, and `engine/generate.cjs` adds one
 * detail page per account to the technical view as soon as the model has
 * two accounts or more. So a case is 1 + (1+N) pages, and opens with the
 * two tabs of always only when N is zero. Getting there — resuming,
 * elaborating — is `session/open.cjs` and `session/elaborate.cjs`'s job,
 * done before this is ever called.
 *
 * Requires `opts.brief` too: `case.md`'s first section is the original
 * prose description, verbatim (#42) — a case with no brief has nothing
 * honest to put there, and a placeholder would be exactly the silent gap
 * this skill's dossier otherwise refuses to allow.
 */
async function caseFiles(session, slug, opts = {}) {
  if (session.stage !== 'technical')
    throw new Error(
      `the case verb needs a technical-stage session (got stage="${session.stage}") — ` +
        'elaborate the technical view first (session/elaborate.cjs)'
    );
  if (!opts.brief || !String(opts.brief).trim())
    throw new Error('the case verb needs the original brief, verbatim — pass opts.brief');

  const gate = opts.gate || DEFAULT_GATE;
  const logical = await draw(session, 'logical', { gate });
  const technical = await draw(session, 'technical', { gate });
  const xml = stitch([logical.xml, technical.xml]);

  // The ONLY validator output `case.md` reaches for — see `case-notes.cjs`'s
  // header for why `falhas`/`avisos` (which carry the two permanent, nobody-
  // can-fix-it findings) never feed section 5.
  const semanticFailures = [];
  for (const [view, drawn] of [['logical', logical], ['technical', technical]])
    for (const g of drawn.relatorio.geometry)
      for (const f of g.report.semanticas)
        semanticFailures.push({ id: f.id, name: f.name, message: f.mensagem, view });

  const md = caseNotes(session, { brief: opts.brief, semanticFailures });

  return {
    files: [
      { path: `${slug}.drawio`, content: xml },
      { path: 'case.md', content: md },
    ],
    warnings: [...logical.relatorio.avisos, ...technical.relatorio.avisos],
  };
}

// ------------------------------------------------------------------- the CLI

/**
 * Where the case directory is born. `git rev-parse --show-toplevel` walks up
 * from the CURRENT directory — not from `__dirname`, which would always
 * answer with the skill's own tree, exactly what this ticket exists to stop
 * writing into.
 */
function resolveRoot(cwd) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  if (r.status === 0 && r.stdout) return { root: r.stdout.trim(), inRepo: true };
  return { root: cwd, inRepo: false };
}

/** Reads a file the CLI was pointed at, or exits — the session and the brief both need this. */
function readOrDie(file) {
  if (!fs.existsSync(file)) {
    console.error(`\n  ✗ could not find ${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

const HELP = `
  node tools/case.cjs <session.json> <slug> --brief <brief.txt> [options]

    --brief <file>   the original prose description, read verbatim
                      (required — it is case.md's first section)
    --gate <level>   truthfulness|none|failure|strict   (default: truthfulness)
    --image          also render the PNG, when the draw.io binary is present

  Reads a session@1 already at the technical stage and writes its .drawio,
  plus a case.md dossier, to docs/architecture/diagrams/<slug>/, at the root
  of the CALLER's git repository — never inside this skill's own tree.
  Outside a git repository, falls back to the current directory, with a
  warning.

  The .drawio carries BOTH views, the logical page first. The technical one
  comes out in 1+N pages — one consolidated, plus one per account — as soon
  as the model has two accounts or more; with one account, or none, N is
  zero and the file opens with the two tabs of always.
`;

const WITH_VALUE = ['gate', 'brief'];

function parse(args) {
  const opts = {};
  const positional = [];
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

  const [input, slug] = positional;
  if (!input || !slug) { console.error(HELP); process.exit(2); }

  const session = JSON.parse(readOrDie(input));
  console.log(`\n  CASE · ${session.title} → "${slug}"`);

  const brief = opts.brief ? readOrDie(opts.brief) : undefined;

  let result;
  try {
    result = await caseFiles(session, slug, { gate: opts.gate, brief });
  } catch (e) {
    console.error(`\n  ✗ ${e.message}`);
    for (const l of e.erros || []) console.error(`      · ${l}`);
    process.exit(1);
  }
  for (const w of result.warnings) console.log(`  ⚠ ${w}`);

  const { root, inRepo } = resolveRoot(process.cwd());
  if (!inRepo)
    console.log('  ⚠ not inside a git repository — writing to the current directory instead of a repo root');

  const caseDir = path.join(root, 'docs', 'architecture', 'diagrams', slug);
  fs.mkdirSync(caseDir, { recursive: true });

  for (const f of result.files) {
    const dest = path.join(caseDir, f.path);
    fs.writeFileSync(dest, f.content);
    console.log(`  → ${dest}  (${f.content.length} bytes)`);
  }

  if (opts.image) {
    // Same resolution `tools/drawio.cjs` gives everyone else — this is not a
    // second opinion on where the binary lives, just the caller's copy of it.
    const bin = binaryIfPresent();
    if (!bin) {
      console.log('  ⚠ draw.io headless not found — skipping the image (development-only dependency)');
    } else {
      const drawioPath = path.join(caseDir, `${slug}.drawio`);
      const pngPath = path.join(caseDir, `${slug}.png`);
      const r = spawnSync('bash', [path.join(__dirname, 'render.sh'), drawioPath, pngPath], { stdio: 'inherit' });
      if (r.status !== 0) { console.error('\n  ✗ the image did not render'); process.exit(1); }
      console.log(`  → ${pngPath}`);
    }
  }
  console.log();
}

if (require.main === module) {
  main().catch(e => {
    console.error(`\n  ✗ ${e.message}`);
    for (const l of e.erros || []) console.error(`      · ${l}`);
    process.exit(1);
  });
}

module.exports = { caseFiles, resolveRoot };
