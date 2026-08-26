#!/usr/bin/env node
'use strict';
/**
 * #41 — the case verb: session@1 + slug -> the case's file set, at the
 * CALLER's project root, never inside this skill's own tree.
 *
 *   node tests/check-case.cjs [drawio-binary]
 *
 * Without an argument this covers everything that does not need the render
 * binary: the seam's purity, the corpus's two session cases drawing under the
 * `truthfulness` gate, the multi-page order (logical first, technical after —
 * general form of "two tabs", since a multi-account technical view is already
 * 1+N pages), the one-seal-per-page guarantee, the refusal of a logical-stage
 * session, and both branches of directory resolution (inside a git repo, and
 * outside one). With the binary, it additionally asks for `--image` and
 * requires the PNG to exist; without it, it forces a missing `DRAWIO` and
 * requires the opt-in warning instead of a failure.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'tools', 'case.cjs');
const { caseFiles } = require(path.join(ROOT, 'tools', 'case.cjs'));
const { elaborate } = require(path.join(ROOT, 'session', 'elaborate.cjs'));
const { readPages } = require(path.join(ROOT, 'session', 'fingerprint.cjs'));

let failed = 0;
function check(desc, ok) {
  console.log(`  ${ok ? '✓' : '✗'} ${desc}`);
  if (!ok) failed = 1;
  return ok;
}

function technicalSession(name) {
  const logical = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'session', `${name}-logical.json`), 'utf8'));
  const delta = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'session', `${name}-elaboration.json`), 'utf8'));
  return elaborate(logical, delta);
}

async function main() {
  // 1 · the seam is pure — no `fs`, no child process reachable from its own
  // source. Read from the file so a future edit that sneaks a disk write in
  // is caught by TEXT, not by trusting the docstring above it.
  const src = fs.readFileSync(CLI, 'utf8');
  const seamBody = src.slice(src.indexOf('async function caseFiles'), src.indexOf('the CLI\n'));
  check('the seam touches neither `fs` nor a child process',
    !/\bfs\.|spawnSync|execFileSync|writeFileSync/.test(seamBody));

  // 2 · the corpus's session cases draw under the gate, and none is refused —
  // this is what promotes #31/#32 from tolerable defect to blocking wall, and
  // it is why this ticket waited on them.
  const drawn = {};
  for (const name of ['retail', 'fleet']) {
    const technical = technicalSession(name);
    try {
      drawn[name] = await caseFiles(technical, name, { gate: 'truthfulness' });
      check(`"${name}" draws under the truthfulness gate`, true);
    } catch (e) {
      check(`"${name}" draws under the truthfulness gate`, false);
      console.log(`      · ${e.message}`);
      for (const l of e.erros || []) console.log(`        ${l}`);
    }
  }

  for (const name of Object.keys(drawn)) {
    const result = drawn[name];
    check(`"${name}": exactly one file, named "${name}.drawio"`,
      result.files.length === 1 && result.files[0].path === `${name}.drawio`);

    const { pages } = readPages(result.files[0].content);
    // General form of "two tabs, logical first": a multi-account technical
    // view is already 1+N pages (#12's D2), so the invariant is the SPLIT,
    // not a literal count of two.
    check(`"${name}": at least a logical and a technical page`, pages.length >= 2);
    check(`"${name}": logical page comes first`, pages[0]?.seal?.panlabsVista === 'logical');
    check(`"${name}": every page after it is technical`,
      pages.slice(1).every(p => p?.seal?.panlabsVista === 'technical'));

    // 3 · one seal per page — the point of #14, still honored here: deleting
    // one page in draw.io cannot take the session out of the other.
    const allSealed = pages.every(p => p.seal && p.seal.panlabsSessao);
    check(`"${name}": every page carries its own session seal`, allSealed);
    if (allSealed) {
      const ids = new Set(pages.map(p => JSON.parse(p.seal.panlabsSessao).id));
      check(`"${name}": every seal resumes the same session`, ids.size === 1);
    }
  }

  // 4 · a logical-stage session has no second view to draw — refuse instead
  // of guessing which page to skip.
  const fleetLogicalOnly = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'session', 'fleet-logical.json'), 'utf8'));
  try {
    await caseFiles(fleetLogicalOnly, 'fleet', {});
    check('refuses a logical-stage session instead of drawing one tab', false);
  } catch (e) {
    check('refuses a logical-stage session instead of drawing one tab', /technical-stage/.test(e.message));
  }

  // ---------------------------------------------------------- the CLI, for real, on disk
  const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'case-fixtures-'));
  const sessionFile = path.join(fixtures, 'retail-technical.json');
  fs.writeFileSync(sessionFile, JSON.stringify(technicalSession('retail')));
  const SLUG = 'retail-300-stores';
  const drawioAt = dir => path.join(dir, 'docs', 'architecture', 'diagrams', SLUG, `${SLUG}.drawio`);
  const pngAt = dir => path.join(dir, 'docs', 'architecture', 'diagrams', SLUG, `${SLUG}.png`);

  // 5 · inside a git repo, from a NESTED working directory on purpose — this
  // is what proves the resolution walks up to the repo root instead of
  // trusting `cwd` directly.
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'case-repo-'));
  spawnSync('git', ['init', '-q'], { cwd: repo });
  const nested = path.join(repo, 'some', 'nested', 'place');
  fs.mkdirSync(nested, { recursive: true });
  const r1 = spawnSync('node', [CLI, sessionFile, SLUG], { cwd: nested, encoding: 'utf8' });
  check('CLI inside a git repo: exits 0', r1.status === 0);
  check('CLI inside a git repo: the directory is born at the repo root', fs.existsSync(drawioAt(repo)));
  check('CLI inside a git repo: nothing landed inside the skill\'s own tree',
    !path.resolve(drawioAt(repo)).startsWith(ROOT + path.sep));

  // 6 · outside a git repo: falls back to the current directory, and SAYS so
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'case-bare-'));
  const r2 = spawnSync('node', [CLI, sessionFile, SLUG], { cwd: bare, encoding: 'utf8' });
  check('CLI outside a git repo: exits 0', r2.status === 0);
  check('CLI outside a git repo: warns explicitly', /not inside a git repository/.test(r2.stdout));
  check('CLI outside a git repo: still writes docs/architecture/diagrams/<slug>/', fs.existsSync(drawioAt(bare)));

  // 7 · the image — opt-in, and the two branches of "does the binary exist"
  const drawioArg = process.argv[2];
  if (drawioArg) {
    const withBin = fs.mkdtempSync(path.join(os.tmpdir(), 'case-img-'));
    const r3 = spawnSync('node', [CLI, sessionFile, SLUG, '--image'],
      { cwd: withBin, encoding: 'utf8', env: { ...process.env, DRAWIO: drawioArg } });
    check('CLI --image, binary present: exits 0', r3.status === 0);
    check('CLI --image, binary present: the PNG exists', fs.existsSync(pngAt(withBin)));
  } else {
    const withoutBin = fs.mkdtempSync(path.join(os.tmpdir(), 'case-noimg-'));
    const r3 = spawnSync('node', [CLI, sessionFile, SLUG, '--image'],
      { cwd: withoutBin, encoding: 'utf8', env: { ...process.env, DRAWIO: '/nonexistent/drawio' } });
    check('CLI --image, no binary: exits 0 anyway', r3.status === 0);
    check('CLI --image, no binary: warns instead of failing', /skipping the image/.test(r3.stdout));
    check('CLI --image, no binary: no PNG was written', !fs.existsSync(pngAt(withoutBin)));
    console.log('  (binary check skipped — no draw.io binary was passed in)');
  }

  console.log(failed
    ? '\n  ✗ the case verb has a red assertion above'
    : '\n  ✓ pure seam · corpus draws under the gate · logical-first order · one seal per page · writes at the caller\'s root · image is opt-in');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
