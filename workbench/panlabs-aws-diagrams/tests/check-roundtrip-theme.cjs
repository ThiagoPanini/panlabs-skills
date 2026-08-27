#!/usr/bin/env node
'use strict';
/**
 * THE THEME TRAVELS RESOLVED — and comes back intact through draw.io's own codec.
 *
 * #11 proved the embedded model round-trips byte for byte through
 * `drawio -x -f xml`, which is the app DECODING and RE-SERIALIZING. This check
 * extends that proof to `panlabsTema`, and what's at stake isn't symmetry: it's
 * the reason for storing TOKENS and not the theme's NAME.
 *
 * #4 §7 measured why `style="<name>"` on the `<mxGraphModel>` is useless —
 * a name only resolves against what the other end has. A `.drawio` that
 * stored `theme=light` would regenerate differently the day `light.json`
 * changed, with no warning. By storing the resolved tokens, the file remains
 * its own persistence format.
 *
 *   node tools/check-roundtrip-theme.cjs [drawio-binary]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const { callRender, indent } = require(path.join(WORKBENCH, 'tools', 'call-render.cjs'));
const { binary } = require(path.join(ROOT, 'tools', 'drawio.cjs'));
const DRAWIO = binary(process.argv[2]);

/**
 * #144: this used to dial `xvfb-run` directly — no timeout, a blind 2-attempt
 * retry no matter WHY the export failed, and a cleanup between attempts that
 * killed every `drawio` process on the machine, a neighbour session's
 * legitimate render included. `render.sh` already carries the timeout, the
 * scoped kill and the answer-vs-non-answer retry that #128 built; this just
 * asks it for XML instead of PNG.
 *
 * ⚠️ `--user-data-dir=<profile>` AND `--disable-update` ARE GONE, ON PURPOSE.
 * The old call gave every export a fresh Electron profile, presumably to
 * dodge a `SingletonLock` collision between concurrent sessions — the same
 * neighbour-contention worry the killer above was (wrongly) guarding
 * against. `render.sh` has never taken a custom profile, for anyone: not
 * `tools/case.cjs`'s `--image`, not `tools/bisect-model.cjs`, not any step in
 * `tests/run.sh` — all default-profile, all `render.sh`. #144's own
 * measurement is the evidence that this is safe: with a neighbour session
 * rendering at the same time, EVERY layer that already went through
 * `render.sh` (bisection, corpus render, theme PNG render — same machine,
 * same default profile) stayed green; the only red was this file talking to
 * `xvfb-run` on its own. Isolating the profile was never what made the
 * difference; going through `render.sh`'s discipline was. Extending
 * `render.sh` with a flag every other caller would carry and never use is
 * the "two copies" the issue asked to justify — not extending it is the
 * answer.
 */
function exportXml(origin, destination) {
  return callRender(origin, destination, 'xml', DRAWIO);
}

const ENTITIES = { '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&#xa;': '\n', '&#x9;': '\t', '&#xd;': '\r', '&amp;': '&' };
const unescape = s => String(s).replace(/&(?:quot|#39|lt|gt|#xa|#x9|#xd|amp);/g, e => ENTITIES[e]);
const attribute = (xml, name) => {
  const m = new RegExp(name + '="([^"]*)"').exec(xml);
  return m ? unescape(m[1]) : null;
};

/**
 * ⚠️ The check GENERATES the files it checks, instead of waiting for someone
 * to have generated them beforehand. While it depended on files left behind
 * by another step, their absence came out as "skipped" and the suite stayed
 * green having checked zero — a check that doesn't know how to fail. Now it
 * fails if it checked nothing.
 */
const VARIANTS = [
  { name: 'a-light' }, { name: 'b-dark' }, { name: 'c-corporate' },
  { name: 'g-logical-view' },
  // multi-account: the consolidated page PLUS the detail pages, which is
  // where #12 and #13 meet and where nobody had measured a theme round-trip
  { name: 'h-accounts-dark' },
];

// The render corpus is scratch (#45) — reused from the ruler's export when run
// through it, or created fresh for a standalone run and handed down so both
// sides of the child process agree on where the variants landed.
const OUTPUT_DIR = process.env.OUTPUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'panlabs-aws-diagrams-'));

/** The one place that knows how to build the variants is `tools/generate-themes.cjs`. */
async function generateVariants() {
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [path.join(WORKBENCH, 'tools', 'generate-themes.cjs')],
    { stdio: 'ignore', env: { ...process.env, OUTPUT_DIR } });
  return path.join(OUTPUT_DIR, 'themes');
}

async function main() {
  if (!fs.existsSync(DRAWIO)) {
    console.log('   draw.io headless not found — round-trip skipped (premise 8).');
    process.exit(0);
  }
  const variantsDir = await generateVariants();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-rt-'));
  let failed = 0, checked = 0;

  for (const { name } of VARIANTS) {
    const origin = path.join(variantsDir, name + '.drawio');
    if (!fs.existsSync(origin)) { console.log(`   ✗ ${name}: .drawio missing`); failed = 1; continue; }
    checked++;
    const destination = path.join(tmp, name + '.xml');
    const exported = exportXml(origin, destination);
    if (!exported.ok) {
      console.log(`   ✗ ${name.padEnd(14)} the headless export produced no XML (see tools/render.sh)`);
      console.log(indent(exported.log));
      failed = 1;
      continue;
    }
    if (exported.flaked) console.log(indent(exported.out));

    const before = fs.readFileSync(origin, 'utf8');
    const after = fs.readFileSync(destination, 'utf8');
    for (const attr of ['panlabsTema', 'panlabsModelo']) {
      const a = attribute(before, attr), b = attribute(after, attr);
      const ok = a !== null && a === b;
      if (!ok) failed = 1;
      console.log(`   ${ok ? '✓' : '✗'} ${name.padEnd(14)} ${attr.padEnd(14)} ${String((a || '').length).padStart(5)} bytes  ${ok ? 'identical' : 'DIVERGED'}`);
    }
    // and the theme has to rebuild: id, background, and the token groups
    const t = JSON.parse(attribute(after, 'panlabsTema') || '{}');
    const groups = ['page', 'ink', 'text', 'edge', 'gap', 'note', 'block', 'card'];
    const missing = groups.filter(g => !(g in (t.tokens || {})));
    if (missing.length || !t.id || !t.background) {
      console.log(`   ✗ ${name}: incomplete payload (missing ${missing.join(', ') || 'id/background'})`);
      failed = 1;
    }
    // and it must NOT carry file metadata pretending to be a token
    const stowaways = ['schema', 'id', 'label', 'because', 'inherits'].filter(k => k in (t.tokens || {}));
    if (stowaways.length) {
      console.log(`   ✗ ${name}: identity key traveling as a token (${stowaways.join(', ')})`);
      failed = 1;
    }
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  if (!checked) { console.log('   ✗ no variant checked — the check measured nothing'); failed = 1; }
  console.log(failed ? '   THEME ROUND-TRIP RED'
    : `   ✓ the theme is its own persistence format (${checked} variants)`);
  process.exit(failed);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
