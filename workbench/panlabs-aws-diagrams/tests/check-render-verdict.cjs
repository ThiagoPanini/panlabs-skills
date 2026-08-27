#!/usr/bin/env node
'use strict';
/**
 * #128 — `render.sh` answers WHO ENDED THE PROCESS, and it kills what it started.
 *
 *   node tests/check-render-verdict.cjs
 *
 * The layer that isolates a model (`tools/bisect-model.cjs`) went red one run
 * in three, on a cut whose structural twin passed in the same run, and its only
 * word for it was `✗ FAILED`. What was underneath was never the drawing:
 * Chromium's compositing process dies (`UnknownVizError` — a string that lives
 * in the Electron binary, not in draw.io's JavaScript), draw.io never catches
 * the rejection, and the binary hangs until something kills it.
 *
 * So `render.sh` now has to hold three promises, and this file plants a defect
 * for each one:
 *
 *   1  a file draw.io REFUSES exits 1 and is never retried — asking the same
 *      question twice and preferring the second answer is not a measurement.
 *   2  a render that NEVER ANSWERS exits 4 after `ATTEMPTS` tries, and the two
 *      sentences say which is which. Before #128 both came out as `1`, and a
 *      reader had no way to tell "go read the model" from "go look at the box".
 *   3  a hang LEAVES NOTHING ALIVE. This is the one that made the flake grow:
 *      `timeout`, without `--foreground`, signals its own process group, and
 *      the `setsid` that used to sit in front of `xvfb-run` moved the render
 *      OUT of that group — so the signal reached nobody and every hang leaked a
 *      whole Chromium and an `Xvfb`. Measured against the pre-#128 command
 *      line, the stub below survives every sample out to +10s; against the
 *      current one it is gone before the first.
 *
 * ⚠️ NONE OF THIS NEEDS draw.io. The subject is `render.sh`'s control flow, so
 * the binary is a stub written here — one that exits, one that never does, one
 * that hangs once and then works. That last one is the flake itself, planted,
 * and it is the only way to require that a retry SAYS SO instead of quietly
 * turning a red into a green.
 *
 * ⚠️ HOW TO SEE IT RED. `RENDER_SH=/path/to/other/render.sh node
 * tests/check-render-verdict.cjs` runs the same four cases against any other
 * copy — point it at the pre-#128 file and promises 2 and 3 both fail. A check
 * only ever seen green is documentation.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SKILL = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const RENDER = process.env.RENDER_SH || path.join(SKILL, 'tools', 'render.sh');

let failed = 0;
function check(desc, ok, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${desc}`);
  if (!ok) { failed = 1; if (detail) console.log(`      ${String(detail).trim().split('\n').join('\n      ')}`); }
  return ok;
}

// xvfb-run is the one thing `render.sh` needs that a stub cannot replace — it
// is in the command line the script builds. Same premise 8 as layer 7: without
// it, this measures nothing rather than failing for the wrong reason.
if (spawnSync('sh', ['-c', 'command -v xvfb-run']).status !== 0) {
  console.log('  xvfb-run not found — the render contract is not measured on this machine.');
  process.exit(0);
}

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'render-verdict-'));
const CALLS = path.join(DIR, 'calls');
const OUT = path.join(DIR, 'out.png');
const IN = path.join(DIR, 'in.drawio');
const LOG = path.join(DIR, 'render.log');
fs.writeFileSync(IN, '<mxfile><diagram id="d" name="P"></diagram></mxfile>');

/**
 * Kills whatever still carries our temp directory. This file PLANTS hangs, so
 * it is the one place in the suite that has to sweep after itself — and the
 * pattern is safe here in a way `pkill -f` is not elsewhere: `DIR` is a fresh
 * mkdtemp, so nothing that predates this process can carry it.
 */
function sweep() {
  const found = spawnSync('pgrep', ['-f', DIR], { encoding: 'utf8' });
  for (const pid of (found.stdout || '').split('\n').filter(Boolean)) {
    try { process.kill(Number(pid), 'SIGKILL'); } catch (e) { /* already gone */ }
  }
}
process.on('exit', sweep);

const HANG = 'while :; do sleep 1; done';

/**
 * Writes a stub "draw.io" whose body is `body`, and points render.sh at it.
 *
 * Each one gets its own file name. When the script under test is the broken
 * kind, the stub the PREVIOUS case planted is still running — and a running
 * `/bin/sh` reads its script as it goes, so rewriting that path underneath it
 * would make the red depend on how far along the orphan happened to be.
 */
let planted = 0;
function stub(body) {
  const p = path.join(DIR, `drawio-stub-${++planted}`);
  fs.writeFileSync(p, `#!/bin/sh\necho . >> ${CALLS}\n${body}\n`, { mode: 0o755 });
  fs.writeFileSync(CALLS, '');
  return p;
}

const calls = () => fs.readFileSync(CALLS, 'utf8').split('\n').filter(Boolean).length;

/**
 * Runs render.sh against the stub. Returns `{ code, out }`.
 *
 * ⚠️ TWO THINGS HERE EXIST SO THAT A BROKEN `render.sh` GOES RED INSTEAD OF
 * FREEZING THE SUITE, and both were measured against the pre-#128 file:
 *
 *   the output goes to a FILE, not a pipe. A script that leaks the process it
 *   meant to kill leaks the pipe with it, and the reader blocks on a writer
 *   that will never close — the old file hung right here, forever, with the
 *   orphan `sh` still holding the descriptor.
 *
 *   `timeout` bounds the whole call. `render.sh` promises to answer within
 *   `LIMIT × ATTEMPTS`; the budget grants that plus room to breathe, and a
 *   script that misses it fails the check rather than stalling the layer.
 *
 * A suite that freezes teaches worse than one that lies: the lie at least ends.
 */
function render(bin, { limit = 2, attempts = 3 } = {}) {
  const budget = limit * attempts + 20;
  const fd = fs.openSync(LOG, 'w');
  const r = spawnSync('timeout', ['-k', '5', String(budget), 'bash', RENDER, IN, OUT],
    { stdio: ['ignore', fd, fd], env: { ...process.env, DRAWIO: bin, LIMIT: String(limit), ATTEMPTS: String(attempts) } });
  fs.closeSync(fd);
  let out = fs.readFileSync(LOG, 'utf8');
  // ⚠️ These 124/137 are OUR outer `timeout` reporting on `render.sh` itself —
  // not the same question as `render.sh`'s own `answered()`, which asks who
  // chose draw.io's status. Same two numbers, one level up. Do not unify them.
  const hung = r.status === 124 || r.status === 137;
  if (hung) out += `\n(render.sh never returned — killed after ${budget}s)`;
  return { code: r.status, out, hung };
}

/** What `render.sh` actually answered, per case — asserted against its reader below. */
const observed = {};

/** How many processes still carry our temp directory on their command line. */
function survivors() {
  const r = spawnSync('pgrep', ['-f', DIR], { encoding: 'utf8' });
  return (r.stdout || '').split('\n').filter(Boolean).length;
}

console.log('\n  the render came out\n');
{
  const { code, out } = render(stub(`printf 'not-really-a-png' > ${OUT}; exit 0`));
  check('exits 0', code === 0, out);
  check('and says nothing about attempts — a first try is not news', !/attempt/.test(out), out);
  check('the binary was called once', calls() === 1, `called ${calls()}×`);
}

console.log('\n  the DRAWING was refused — draw.io read it and said no\n');
{
  const { code, out } = render(stub('echo "Error: Export failed" >&2; exit 1'));
  observed.refused = code;
  check('exits 1, not 4', code === 1, out);
  check('and the sentence blames the drawing', /the drawing/i.test(out), out);
  // The promise that costs something: a verdict is an ANSWER, and repeating the
  // question does not make the second answer better. Retrying here is exactly
  // the blind repetition #128 was opened to refuse.
  check('the binary was called ONCE — a verdict is not retried', calls() === 1, `called ${calls()}×`);
}

console.log('\n  the render died of a SIGNAL — and a signal is nobody\'s opinion of the file\n');
{
  // ⚠️ THE HOLE A CODE REVIEW FOUND, PLANTED SO IT STAYS SHUT.
  //
  // The first version of `render.sh` asked only for 124 and 137, so every other
  // way of not answering fell into "the drawing": a segfault came back as
  // `REFUSED by draw.io (code 139) — the drawing`, and so would an OOM that took
  // a child (`137` is what #128's own ticket calls "cheiro de memória"), an
  // abort, or a foreign sweep's TERM. The rule is now about WHO CHOSE the
  // number — only 0–123 is draw.io's own — and this case is what holds it there.
  const { code, out } = render(stub('kill -SEGV $$'), { limit: 5, attempts: 2 });
  check('exits 4, not 1 — 139 is the kernel talking, not draw.io', code === 4, out);
  check('and the sentence blames the render', /the render, not the drawing/i.test(out), out);
  check('and it was retried, because nothing answered', calls() === 2, `called ${calls()}×`);
}

console.log('\n  the RENDER never answered — it hung, and we ended it\n');
{
  const { code, out } = render(stub(HANG), { limit: 2, attempts: 3 });
  observed.unanswered = code;
  check('exits 4, not 1', code === 4, out);
  check('and the sentence blames the render, not the drawing', /the render, not the drawing/i.test(out), out);
  check('every attempt was spent', calls() === 3, `called ${calls()}×`);
  // ⚠️ THE ONE THAT GREW THE FLAKE. A leaked Chromium costs memory and a
  // display number, so the next render is likelier to hang than the last —
  // which is how a 1-in-20 became a red suite one run in three.
  let alive = survivors();
  for (let i = 0; alive > 0 && i < 10; i++) { spawnSync('sleep', ['1']); alive = survivors(); }
  check('and it left NOTHING alive', alive === 0,
    (spawnSync('pgrep', ['-af', DIR], { encoding: 'utf8' }).stdout || '').trim());
}

console.log('\n  the flake itself — it hung once, on bytes that render fine\n');
{
  // Same file, same stub: the first call hangs, the second writes the PNG.
  // This is the shape of every red #128 investigated.
  const { code, out } = render(stub(
    `[ "$(wc -l < ${CALLS})" -lt 2 ] && { ${HANG}; }\nprintf 'not-really-a-png' > ${OUT}; exit 0`), { limit: 2, attempts: 3 });
  check('exits 0 — the retry got it', code === 0, out);
  check('it took two calls', calls() === 2, `called ${calls()}×`);
  // A retry that says nothing is a red silently turned green, and the next
  // person to look at the binary has no idea it has been flaking for months.
  check('and it names the attempt that finally worked — a swallowed flake is a flake nobody fixes',
    /attempt 2 of 3/.test(out), out);

  // ⚠️ BOTH ENDS OF THE SAME STRING, and only one of them is written here.
  //
  // `bisect-model.cjs` decides a cut flaked by grepping this output. That makes
  // it a contract with two ends — whoever writes the sentence and whoever reads
  // it — and CLAUDE.md already names what happens when only one end moves: a
  // green that lies. Reword `render.sh` and the ⚠ line simply stops appearing,
  // which is the precise failure #128 was opened to end. So the pattern is not
  // copied here: it is READ OUT OF THE READER, and asserted against the writer.
  const bisect = fs.readFileSync(path.join(__dirname, '..', 'tools', 'bisect-model.cjs'), 'utf8');
  const declared = bisect.match(/const FLAKED = \/(.+?)\/;/);
  if (check('bisect-model.cjs still declares FLAKED as a literal this check can read', !!declared,
    'the `const FLAKED = /…/;` line moved or changed shape — teach this check the new one')) {
    check(`and that literal — /${declared[1]}/ — matches what render.sh just said`,
      new RegExp(declared[1]).test(out), out);
  }

  // The other two-ended contract, and the same treatment: `bisect-model.cjs`
  // hard-codes which exit code means what. `render.sh` could renumber and every
  // cut would come back as "a code this tool does not know" — loud, but only in
  // a run nobody may make for months. Here the table is read and required to
  // agree with what `render.sh` ANSWERED, minutes ago, in this same file.
  const table = {};
  for (const m of bisect.matchAll(/^\s*(\w+):\s*\{[^}]*\bcode:\s*(\d+)/gm)) table[m[1]] = Number(m[2]);
  if (check('bisect-model.cjs still declares codes this check can read', Object.keys(table).length > 0,
    'the `ANSWERS` table moved or changed shape — teach this check the new one')) {
    for (const [state, code] of Object.entries(observed))
      check(`bisect-model.cjs reads ${code} as "${state}", and that is what render.sh answered`,
        table[state] === code, `table says ${table[state]}, render.sh answered ${code}`);
  }
}

fs.rmSync(DIR, { recursive: true, force: true });
console.log(failed ? '\n  ✗ the render contract does not hold\n' : '\n  ✓ render.sh names who ended the process, and kills what it started\n');
process.exit(failed);
