#!/usr/bin/env node
'use strict';
/**
 * #141 — `detect-neighbor.sh` finds a render that is not this execution's own.
 *
 *   node tests/check-detect-neighbor.cjs
 *
 * A check only ever seen green is documentation: this plants a fake `Xvfb`
 * and a fake `drawio` — real running processes, shaped like the ones
 * `clean-render.sh` already knows how to find — and requires the tool to see
 * them, then requires it to stop seeing them once they're gone, and to see
 * nothing on a clear machine to begin with.
 *
 * ⚠️ NONE OF THIS NEEDS draw.io OR `xvfb-run`. The subject is a process-name
 * match, not a render, so the "neighbor" is a copy of `sh` — a real ELF
 * binary — placed at a path shaped like the one being watched for and kept
 * alive with a trivial loop. Copying `sh` (rather than writing a script with
 * its own shebang) matters: a script's process name comes from its
 * INTERPRETER, not its filename, so `pgrep Xvfb` would never see it. Running
 * the copy directly makes ITS OWN path the exec target, and Linux takes the
 * process name from that.
 *
 * ⚠️ EVERY "NOT FOUND" ASSERTION CHECKS FOR THE ABSENCE OF ITS OWN MARKER, NOT
 * FOR SILENCE. This machine runs more than one session of this repository
 * (that is the whole premise of #141), so a REAL neighbor can start between
 * one line of this file and the next — measured while writing it: an actual
 * `xvfb-run` from another session appeared mid-run and broke a plain
 * `stdout === ''` assertion that had nothing to do with it. Every plant here
 * therefore gets a marker unique to this run (`FAKE_DRAWIO`, `DIR`), and a
 * "not found" assertion checks that MARKER's absence — an ambient neighbor
 * elsewhere in the output is not this proof's business.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const WORKBENCH = path.join(__dirname, '..');
const DETECT = path.join(WORKBENCH, 'tools', 'detect-neighbor.sh');

let failed = 0;
function check(desc, ok, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${desc}`);
  if (!ok) { failed = 1; if (detail) console.log(`      ${String(detail).trim().split('\n').join('\n      ')}`); }
  return ok;
}

if (spawnSync('sh', ['-c', 'command -v pgrep']).status !== 0) {
  console.log('  pgrep not found — neighbor detection is not measured on this machine.');
  process.exit(0);
}

console.log('\n  a clear machine says so\n');
{
  // ⚠️ THE ONE ASSERTION THIS FILE CANNOT MAKE MARKER-ROBUST: before anything
  // is planted, there is nothing of ours to look for, so this genuinely needs
  // an ambient-clear machine. A real neighbor already here is not a defect in
  // `detect-neighbor.sh` — it is doing exactly its job — so this SKIPS rather
  // than fails, same shape as the xvfb-run guard above.
  const r = spawnSync('bash', [DETECT], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.log('  another render is already on this machine — the neighbor contract is not measured this run:');
    console.log(r.stdout.trim().split('\n').map((l) => `    ${l}`).join('\n'));
    process.exit(0);
  }
  check('exits 0', true);
  check('and stays silent — nothing found is not news', r.stdout.trim() === '', r.stdout);
}

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-neighbor-'));
const FAKE_DRAWIO = path.join(DIR, 'squashfs-root', 'drawio');
const FAKE_XVFB = path.join(DIR, 'Xvfb');
const SH = spawnSync('sh', ['-c', 'command -v sh']).stdout.toString().trim();

fs.mkdirSync(path.join(DIR, 'squashfs-root'));
fs.copyFileSync(SH, FAKE_DRAWIO);
fs.chmodSync(FAKE_DRAWIO, 0o755);
fs.copyFileSync(SH, FAKE_XVFB);
fs.chmodSync(FAKE_XVFB, 0o755);

const LOOP = 'while :; do sleep 1; done';
const children = [];

/** Plants one running process at `bin`, with `args` on its command line. */
function plant(bin, args) {
  const child = spawn(bin, args, { stdio: 'ignore' });
  children.push(child);
  return child;
}

/** Kills everything this file planted — the one place here that has to sweep after itself. */
function sweep() {
  for (const c of children) { try { c.kill('SIGKILL'); } catch (e) { /* already gone */ } }
}
process.on('exit', sweep);

/** Sweeps the current block's plants and gives the OS a moment to actually remove them. */
function settle() {
  sweep();
  children.length = 0;
  spawnSync('sleep', ['0.3']);
}

function run() {
  return spawnSync('bash', [DETECT], { encoding: 'utf8', env: { ...process.env, DRAWIO: FAKE_DRAWIO } });
}

console.log('\n  a planted drawio render is found\n');
{
  plant(FAKE_DRAWIO, ['-c', LOOP]);
  // give the OS a moment to make the new process visible to pgrep
  spawnSync('sleep', ['0.3']);
  const r = run();
  check('and names the drawio process it found', r.stdout.includes(FAKE_DRAWIO), r.stdout + r.stderr);
  settle();
}

console.log('\n  a planted Xvfb raised by xvfb-run is found\n');
{
  const authPath = path.join(DIR, 'xvfb-run.planted-test', 'Xauthority');
  plant(FAKE_XVFB, ['-c', LOOP, 'Xvfb', '-auth', authPath]);
  spawnSync('sleep', ['0.3']);
  const r = run();
  check('and names the xvfb-run auth path it found', r.stdout.includes(authPath), r.stdout + r.stderr);
  settle();
}

console.log('\n  an Xvfb NOT raised by xvfb-run is left alone\n');
{
  // A pre-existing display server on the machine carries no `-auth
  // /tmp/xvfb-run.*` — the same distinction `clean-render.sh` already draws
  // for its own sweep, so this tool does not refuse layer 7 over a display
  // that has nothing to do with this suite. `DIR` rides along as an
  // otherwise-meaningless argument purely so this plant has a marker unique
  // to this run to check the ABSENCE of.
  plant(FAKE_XVFB, ['-c', LOOP, 'Xvfb', ':7', DIR]);
  spawnSync('sleep', ['0.3']);
  const alive = spawnSync('pgrep', ['-af', DIR], { encoding: 'utf8' });
  check('the plant is actually running', alive.stdout.includes('Xvfb'), alive.stdout);
  const r = run();
  check('not every Xvfb is a neighbor', !r.stdout.includes(DIR), r.stdout + r.stderr);
  settle();
}

console.log('\n  a process merely CARRYING the path as an argument is not a render\n');
{
  // `tests/run.sh` itself, and every layer-7 check that resolves $DRAWIO
  // (`check-fingerprint.cjs "$DRAWIO"`, this very script), carry the binary's
  // path as a BARE trailing argument on their own command line — no flag
  // after it. This is the same distinction `clean-render.sh` already draws
  // for `pkill -f`: without it, a suite calling this tool would refuse
  // itself the moment it started.
  plant(SH, ['-c', LOOP, 'fake-caller', FAKE_DRAWIO]);
  spawnSync('sleep', ['0.3']);
  const alive = spawnSync('pgrep', ['-f', FAKE_DRAWIO], { encoding: 'utf8' });
  check('the plant is actually running', alive.status === 0, alive.stdout + alive.stderr);
  const r = run();
  check('a bare path argument does not self-match', !r.stdout.includes(FAKE_DRAWIO), r.stdout + r.stderr);
  settle();
}

fs.rmSync(DIR, { recursive: true, force: true });
console.log(failed
  ? '\n  ✗ detect-neighbor.sh does not find what it should\n'
  : '\n  ✓ detect-neighbor.sh finds a render that is not this execution\'s own\n');
process.exit(failed);
