#!/usr/bin/env node
'use strict';
/**
 * The skill inherits the module system of wherever it is installed — Node
 * decides CommonJS vs ESM per file by walking up to the nearest `package.json`,
 * and nothing inside the skill's own tree carries one.
 *
 * #133: `engine/vendor/elk.bundled.js` used to be the tree's only `.js` file.
 * Under a host whose root `package.json` declares `"type": "module"` — any
 * Vite/Next/modern Node project, once the skill is installed under
 * `.claude/skills/` — Node read the UMD bundle as ESM, `module.exports = f()`
 * never ran, `require()` returned an empty frozen namespace, and `new ELK()`
 * in `engine/layout.cjs` threw `ELK is not a constructor`. Nothing in that
 * message pointed at the cause. `.cjs` ignores every ancestor `package.json`'s
 * `"type"` by construction, which is why the fix was a rename and not a flag.
 *
 * So this check materializes a REAL install: a full copy of the skill one
 * level under a `package.json` that declares `"type": "module"`, exactly the
 * shape a modern Node project gives it, and runs the CLI from inside.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

// ---- static invariant: nothing in the tree carries an ambiguous extension ----
// A bare `.js` file is host-dependent by definition — it is the only way this
// class of bug can come back, so the tree simply may not have one.
const stray = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) stray.push(path.relative(ROOT, p));
  }
})(ROOT);
ok(stray.length === 0, 'no bare .js file in the skill tree (only .cjs is host-agnostic)',
  stray.length ? stray.join(', ') : `checked ${ROOT}`);

// ---- functional: a real install under a "type": "module" host --------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'panlabs-esm-host-'));
try {
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');
  const dest = path.join(tmp, '.claude', 'skills', 'panlabs-aws-diagrams');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(ROOT, dest, { recursive: true });

  const output = path.join(tmp, 'x.drawio');
  let cli = true, error = '';
  try {
    execFileSync(process.execPath,
      [path.join(dest, 'engine', 'generate.cjs'), path.join(dest, 'examples', 'web-multi-az.json'), '--output', output],
      { cwd: tmp, stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) { cli = false; error = (e.stderr || e.message || '').toString().trim().split('\n').pop(); }

  ok(cli && fs.existsSync(output) && fs.statSync(output).size > 0,
    'the engine generates from a copy installed under a "type": "module" host',
    cli ? `${fs.statSync(output).size} bytes` : error);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures
  ? '\n  ✗ the engine still depends on the host being CommonJS.\n'
  : '\n  ✓ the engine is host-agnostic — CommonJS or ESM, same result.\n');
process.exit(failures ? 1 : 0);
