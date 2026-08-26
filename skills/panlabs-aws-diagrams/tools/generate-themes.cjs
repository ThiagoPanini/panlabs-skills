#!/usr/bin/env node
'use strict';
/**
 * The theme variants, in one place — `output/themes/`.
 *
 *   node tools/generate-themes.cjs
 *
 * They exist for two checks that need a file and not an object: the theme's
 * round trip through the app's own codec (`tests/check-roundtrip-theme.cjs`) and
 * the PIXEL verification (`tools/verify-theme.py`), which is #17's lesson — a
 * correct style string is not a correct render.
 *
 * `d-trap` and `e-unspeakable` come from `generate-trap.cjs`, which is the one
 * that knows how to build them; only the legitimate ones stay here.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { generate } = require('../engine/generate.cjs');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'output', 'themes');

const VARIANTS = [
  { name: 'a-light', model: 'orders-serverless.json', theme: 'light' },
  { name: 'b-dark', model: 'orders-serverless.json', theme: 'dark' },
  { name: 'c-corporate', model: 'orders-serverless.json', theme: 'corporate' },
  { name: 'g-logical-view', model: 'logical-orders.json', theme: 'light' },
  // where #12 meets #13: multi-account on the dark deck
  { name: 'h-accounts-dark', model: 'hub-tgw-3-accounts.json', theme: 'dark' },
  // the animated variant is only visible in SVG (#4): a PNG of it would be false proof
  { name: 'f-animated-flow', model: 'orders-serverless.json', theme: 'light', flow: 'animated' },
];

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  for (const v of VARIANTS) {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', v.model), 'utf8'));
    const r = await generate(m, { tema: v.theme, flow: v.flow });
    fs.writeFileSync(path.join(DIR, v.name + '.drawio'), r.xml);
    console.log(`  ${v.name.padEnd(18)} theme=${v.theme}${v.flow ? ` flow=${v.flow}` : ''}  ${r.xml.length} bytes`);
  }
  execFileSync(process.execPath, [path.join(__dirname, 'generate-trap.cjs')], { stdio: 'inherit' });
}

main().catch(e => { console.error(e); process.exit(1); });
