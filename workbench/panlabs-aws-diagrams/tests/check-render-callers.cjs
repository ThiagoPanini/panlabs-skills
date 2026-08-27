#!/usr/bin/env node
'use strict';
/**
 * #144 — the four checks that used to dial `xvfb-run` on their own now go
 * through `render.sh` via `tools/call-render.cjs`, and this is the file that
 * requires that to stay true.
 *
 *   node tests/check-render-callers.cjs
 *
 * Two distinct defects were planted here, and both survive as regressions a
 * later edit could reintroduce without this file:
 *
 *   1  a HANG. Before #144, `check-roundtrip-theme.cjs`, `-session.cjs` and
 *      `-model.cjs` and `check-fingerprint.cjs` called `xvfb-run` with no
 *      timeout at all — a stuck export froze the whole suite forever (the
 *      exact failure `render.sh` was built to prevent in #128).
 *
 *   2  A BLIND RETRY, AND ONE THAT REACHED PAST WHAT IT STARTED.
 *      `check-roundtrip-theme.cjs` retried any failure twice, no matter
 *      whether draw.io had already refused the file, and cleaned up between
 *      attempts with `ps -C drawio | kill -9` — a pattern that matches every
 *      `drawio` process on the machine, a neighbour session's legitimate
 *      render included.
 *
 * ⚠️ NONE OF THIS NEEDS draw.io, same premise 8 as `check-render-verdict.cjs`
 * (#128): the structural half reads source, and the behavioral half drives
 * `tools/call-render.cjs` against a stub binary this file writes itself.
 *
 * This file does NOT re-measure `render.sh` — `check-render-verdict.cjs`
 * already holds it to the timeout/no-blind-retry/scoped-kill contract. What's
 * measured here is the NEW integration point: that `call-render.cjs` is a
 * thin, honest pass-through — no retry of its own, no unscoped kill of its
 * own — and that the four callers actually go through it instead of dialing
 * `xvfb-run` themselves again one day.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const WORKBENCH = path.join(__dirname, '..');
const CALL_RENDER = path.join(WORKBENCH, 'tools', 'call-render.cjs');

let failed = 0;
function check(desc, ok, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${desc}`);
  if (!ok) { failed = 1; if (detail) console.log(`      ${String(detail).trim().split('\n').join('\n      ')}`); }
  return ok;
}

// ---------------------------------------------------------- structural half

console.log('\n  nobody dials xvfb-run directly, or reaches past what it started\n');

const CALLERS = [
  'check-roundtrip-theme.cjs',
  'check-roundtrip-session.cjs',
  'check-roundtrip-model.cjs',
  'check-fingerprint.cjs',
].map(f => path.join(__dirname, f));

for (const file of CALLERS) {
  const src = fs.readFileSync(file, 'utf8');
  const name = path.basename(file);
  check(`${name} does not spawn xvfb-run itself`, !/['"]xvfb-run['"]/.test(src));
  check(`${name} does not sweep drawio processes by name`, !/-C\s+drawio|\bpkill\b/.test(src));
  check(`${name} goes through call-render.cjs`, /call-render\.cjs/.test(src));
}

{
  const src = fs.readFileSync(CALL_RENDER, 'utf8');
  check("call-render.cjs is the one place that knows render.sh's path, not the four callers",
    /['"]render\.sh['"]/.test(src));
}

// ---------------------------------------------------------- behavioral half

if (spawnSync('sh', ['-c', 'command -v xvfb-run']).status !== 0) {
  console.log('\n  xvfb-run not found — the behavioral half is not measured on this machine.');
  process.exit(failed);
}

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'call-render-verdict-'));
const CALLS = path.join(DIR, 'calls');
const IN = path.join(DIR, 'in.drawio');
const OUT = path.join(DIR, 'out.xml');
const LOG = path.join(DIR, 'call-render.log');
fs.writeFileSync(IN, '<mxfile><diagram id="d" name="P"></diagram></mxfile>');

/** Same reasoning as check-render-verdict.cjs: DIR is a fresh mkdtemp, so a sweep by it is safe. */
function sweep() {
  const found = spawnSync('pgrep', ['-f', DIR], { encoding: 'utf8' });
  for (const pid of (found.stdout || '').split('\n').filter(Boolean)) {
    try { process.kill(Number(pid), 'SIGKILL'); } catch (e) { /* already gone */ }
  }
}
process.on('exit', sweep);

const HANG = 'while :; do sleep 1; done';

let planted = 0;
function stub(body) {
  const p = path.join(DIR, `drawio-stub-${++planted}`);
  fs.writeFileSync(p, `#!/bin/sh\necho . >> ${CALLS}\n${body}\n`, { mode: 0o755 });
  fs.writeFileSync(CALLS, '');
  return p;
}

const calls = () => fs.readFileSync(CALLS, 'utf8').split('\n').filter(Boolean).length;

function survivors() {
  const r = spawnSync('pgrep', ['-f', DIR], { encoding: 'utf8' });
  return (r.stdout || '').split('\n').filter(Boolean).length;
}

/**
 * Calls `call-render.cjs`'s `callRender()` from a subprocess, so a regression
 * that breaks the timeout hangs THAT subprocess and not this proof — the same
 * reasoning `check-render-verdict.cjs` applies one level down, and for the
 * same reason: a suite that freezes teaches worse than one that lies.
 */
function callViaWrapper(bin, { limit = 2, attempts = 3 } = {}) {
  const budget = limit * attempts + 20;
  const script = `const {callRender}=require(${JSON.stringify(CALL_RENDER)});` +
    `process.stdout.write(JSON.stringify(callRender(${JSON.stringify(IN)},${JSON.stringify(OUT)},'xml',process.env.DRAWIO)));`;
  const fd = fs.openSync(LOG, 'w');
  const r = spawnSync('timeout', ['-k', '5', String(budget), process.execPath, '-e', script],
    { stdio: ['ignore', fd, fd], env: { ...process.env, DRAWIO: bin, LIMIT: String(limit), ATTEMPTS: String(attempts) } });
  fs.closeSync(fd);
  const raw = fs.readFileSync(LOG, 'utf8');
  const hung = r.status === 124 || r.status === 137;
  let result = null;
  try { result = JSON.parse(raw); } catch (e) { /* hung, or crashed before printing */ }
  return { result, hung, raw };
}

console.log('\n  the export was REFUSED — draw.io read it and said no\n');
{
  const { result, hung, raw } = callViaWrapper(stub('echo "Error: Export failed" >&2; exit 1'));
  check('callRender() returned, no hang', !hung, raw);
  if (check('callRender() reports ok:false, code:1', !!result && result.ok === false && result.code === 1, raw))
    check('and it was called ONCE — a verdict is not retried on top of render.sh\'s own', calls() === 1, `called ${calls()}×`);
}

console.log("\n  the export NEVER ANSWERED — it hung, and render.sh ended it\n");
{
  const { result, hung, raw } = callViaWrapper(stub(HANG), { limit: 2, attempts: 2 });
  check('callRender() returned within its own bounded budget, no hang', !hung, raw);
  if (check('callRender() reports ok:false, code:4', !!result && result.ok === false && result.code === 4, raw))
    check('every attempt render.sh promised was spent', calls() === 2, `called ${calls()}×`);
  let alive = survivors();
  for (let i = 0; alive > 0 && i < 10; i++) { spawnSync('sleep', ['1']); alive = survivors(); }
  check('and it left NOTHING alive — no sweep of its own was needed', alive === 0,
    (spawnSync('pgrep', ['-af', DIR], { encoding: 'utf8' }).stdout || '').trim());
}

console.log('\n  the export FLAKED — it hung once, on bytes that export fine\n');
{
  const { result, hung, raw } = callViaWrapper(stub(
    `[ "$(wc -l < ${CALLS})" -lt 2 ] && { ${HANG}; }\nprintf '<mxfile/>' > ${OUT}; exit 0`), { limit: 2, attempts: 3 });
  check('callRender() returned, no hang', !hung, raw);
  if (check('callRender() reports ok:true', !!result && result.ok === true, raw)) {
    check('it took two calls', calls() === 2, `called ${calls()}×`);
    check('and callRender() names the retry that saved it — flaked:true', result.flaked === true, raw);
  }
}

fs.rmSync(DIR, { recursive: true, force: true });
console.log(failed
  ? '\n  ✗ the four checks do not hold the render contract\n'
  : '\n  ✓ the four checks go through render.sh, and call-render.cjs adds nothing of its own to it\n');
process.exit(failed);
