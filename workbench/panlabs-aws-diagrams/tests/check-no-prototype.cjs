#!/usr/bin/env node
'use strict';
/**
 * The production tree does not reach into `prototypes/` — and the check is a
 * RUNTIME one, not a grep.
 *
 * #23's acceptance criterion is literal: *"`node <root>/engine/generate.cjs
 * <model> --output <x>` works from the skill's root, without depending on
 * anything inside `prototypes/`"*. A grep for `prototypes` would find the
 * path written by hand and miss the assembled one (`path.join(dir, '..',
 * '..')`), which is exactly how every prototype referenced itself.
 *
 * So the ruler is `require.cache`: load the whole pipeline, generate every
 * model in the corpus, and then ask Node WHICH files it actually opened. If
 * any is under `prototypes/`, the dependency exists — no matter how it was
 * written.
 *
 * The second half is the opposite and equally necessary: **nothing from
 * outside the skill's tree**, except Node itself. A `require('ajv')` would
 * pass the check above and break premise 7 (zero network or binary
 * dependency at runtime).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const PROTOTYPES = path.join(ROOT, 'prototypes');

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

async function main() {
  // load EVERYTHING the published skill exposes, and run the real pipeline
  const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));
  require(path.join(ROOT, 'validator', 'validate-geometry.cjs'));
  require(path.join(ROOT, 'validator', 'gate.cjs'));
  require(path.join(ROOT, 'theme', 'theme.cjs'));
  require(path.join(ROOT, 'session', 'draw.cjs'));
  require(path.join(ROOT, 'session', 'open.cjs'));
  require(path.join(ROOT, 'session', 'publish.cjs'));

  const models = fs.readdirSync(path.join(WORKBENCH, 'models')).filter(f => f.endsWith('.json')).sort();
  for (const m of models)
    await generate(JSON.parse(fs.readFileSync(path.join(WORKBENCH, 'models', m), 'utf8')));

  const loaded = Object.keys(require.cache)
    .filter(f => !f.includes(`${path.sep}node_modules${path.sep}`))
    .filter(f => f !== __filename);

  const fromProto = loaded.filter(f => f.startsWith(PROTOTYPES + path.sep));
  ok(fromProto.length === 0, 'no file from prototypes/ was loaded',
    fromProto.length ? fromProto.map(f => path.relative(ROOT, f)).join(', ') : `${loaded.length} modules loaded`);

  const outsideSkill = loaded.filter(f => !f.startsWith(ROOT + path.sep));
  ok(outsideSkill.length === 0, 'nor anything from outside the skill\'s tree (premise 7)',
    outsideSkill.length ? outsideSkill.join(', ') : 'only Node and what the skill bundles');

  // ------------------------------------------------ and the DATA, not just the code
  //
  // `require.cache` only sees `require`. The catalog, corrections and theme
  // file come in through `readFileSync`, and one of them pointing at the
  // prototype would slip past the first assertion unnoticed.
  //
  // ⚠️ `schema.json` and `thresholds.json` do NOT show up in this list, and it
  // is not a gap: both are read at the top of the module, at LOAD time — so
  // they were already read by the time the spy kicks in, and the first
  // assertion (`require.cache`) is what covers their path. An earlier comment
  // named them here; it was wrong, and #23's review caught it by
  // instrumenting the spy.
  const reads = [];
  const realFs = fs.readFileSync;
  fs.readFileSync = function (p, ...rest) { reads.push(String(p)); return realFs.call(fs, p, ...rest); };
  try {
    delete require.cache[require.resolve(path.join(ROOT, 'catalog', 'aws-shapes.cjs'))];
    require(path.join(ROOT, 'catalog', 'aws-shapes.cjs')).load();
    await generate(JSON.parse(realFs.call(fs, path.join(ROOT, 'examples', 'web-multi-az.json'), 'utf8')),
      { theme: 'corporate' });
  } finally { fs.readFileSync = realFs; }
  // and the spy has to have seen SOMETHING — a spy that observes nothing makes
  // the next assertion vacuously true
  ok(reads.length > 0, 'the `readFileSync` spy observed reads',
    `${new Set(reads).size} distinct file(s)`);

  const dataFromProto = reads.filter(p => p.startsWith(PROTOTYPES + path.sep));
  ok(dataFromProto.length === 0, 'no DATA FILE came from prototypes/',
    dataFromProto.length ? dataFromProto.map(p => path.relative(ROOT, p)).join(', ')
      : `${new Set(reads).size} file(s) read, all inside the tree`);

  // --------------------------------------------- the CLI, the way the AC asks
  const { execFileSync } = require('child_process');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'no-proto-'));
  const output = path.join(tmp, 'x.drawio');
  let cli = true;
  try {
    execFileSync(process.execPath,
      [path.join(ROOT, 'engine', 'generate.cjs'), path.join(ROOT, 'examples', 'web-multi-az.json'), '--output', output],
      { stdio: 'ignore', cwd: ROOT });
  } catch (e) { cli = false; }
  ok(cli && fs.existsSync(output) && fs.statSync(output).size > 0,
    'node engine/generate.cjs <model> --output <x> runs from the skill\'s root',
    cli ? `${fs.statSync(output).size} bytes` : 'the CLI failed');
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(failures
    ? '\n  ✗ the production tree still depends on the prototype.\n'
    : '\n  ✓ the production tree stands on its own.\n');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
