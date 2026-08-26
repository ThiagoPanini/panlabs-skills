#!/usr/bin/env node
'use strict';
/**
 * #33 — `tools/check-geometry.cjs` starts accepting `--theme`.
 *
 * Born blind to `--theme`: the report always evaluated the default theme
 * (`light`), and back then `qualifier` only appeared in `corporate` — so the
 * report never saw what only that theme turned on. #39 later moved
 * `qualifier` on by default into all three themes, which closed that
 * specific blind spot; the flag stays needed regardless, because the themes
 * still differ on other metric tokens (font size, gap density) that also
 * move geometry and that a light-only report would never see.
 *
 * The proof doesn't open the report's JSON (that would couple the test to
 * its format). It compares STDOUT across three calls:
 *
 *   · without `--theme`                (A, today's default)
 *   · with `--theme light` explicit    (B, the same default, said out loud)
 *   · with `--theme corporate`         (C, a theme with other metric deltas)
 *
 * A === B proves the flag is recognized without corrupting the positional
 * arguments (today's bug: `--theme light` leaves "light" left over as if it
 * were a model path, and the CLI tries to read the file "light"). A ≠ C
 * proves the requested theme actually reaches the engine.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'tools', 'check-geometry.cjs');
// has `qualifier` in its embedded corpus — see #33.
const MODEL = path.join(ROOT, 'models', 'quorum-3-az.json');

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

function run(...flags) {
  try {
    return { code: 0, output: execFileSync('node', [CLI, MODEL, '--json', ...flags], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, output: e.stdout || '', error: e.stderr || '' };
  }
}

const withoutFlag = run();
const lightTheme = run('--theme', 'light');
const corporateTheme = run('--theme', 'corporate');

ok(withoutFlag.code !== null && [0, 1].includes(withoutFlag.code),
  'without --theme runs normally (baseline)',
  `code=${withoutFlag.code} error=${withoutFlag.error || '(none)'}`);

ok(lightTheme.code === withoutFlag.code && lightTheme.output === withoutFlag.output,
  "--theme light (explicit) reproduces the baseline — doesn't corrupt the positional args",
  lightTheme.error ? `stderr: ${lightTheme.error.slice(0, 200)}` : '');

ok(corporateTheme.output !== withoutFlag.output,
  '--theme corporate changes the report — the requested theme reached the engine',
  `size without-flag=${withoutFlag.output.length} corporate=${corporateTheme.output.length}`);

console.log(failures ? `\n  ✗ ${failures} failure(s)` : '\n  ✓ check-geometry.cjs accepts --theme.');
process.exit(failures ? 1 : 0);
