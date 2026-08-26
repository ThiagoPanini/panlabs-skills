#!/usr/bin/env node
'use strict';
/**
 * The two traps, drawn — because in prose they look like options.
 *
 *   d-trap         SAYABLE and wrong. The corporate off-white everyone asks for
 *                  (#F2F3F5), light-gray ink, and a thin arrow. No theme line is
 *                  forbidden by the vocabulary; what fails it is the CONTRAST
 *                  GATE, and only after the plan exists. Generated with --force.
 *
 *   e-unspeakable  UNSPEAKABLE. `sketch=1`, a swapped group color, and
 *                  `rounded=1` on an AWS4 vertex. No token exists for any of the
 *                  three, so this file is produced by a raw XML patch, by hand,
 *                  AFTER the engine. It is what the closed vocabulary prevents —
 *                  and the render shows why:
 *                    · `sketch=1` jitters the stencil's glyph (#4 §3.3);
 *                    · swapping the group's color erases the legend (§6.4 of #5);
 *                    · `rounded=1` on AWS4 is a silent no-op (#4 §8) — the request
 *                      does not show up anywhere, which is the worst kind of option.
 *
 *   node tools/generate-trap.cjs
 */

const fs = require('fs');
const path = require('path');
const { generate } = require('../engine/generate.cjs');
const contrast = require('../engine/contrast.cjs');

const ROOT = path.join(__dirname, '..');
fs.mkdirSync(path.join(ROOT, 'output', 'themes'), { recursive: true });
// The corpus moved to the workbench sibling in #44; MODELS_DIR is how the
// ruler (which knows where that is) tells this tool where to read from.
const MODELS_DIR = process.env.MODELS_DIR || path.join(ROOT, 'models');
const MODEL = JSON.parse(fs.readFileSync(path.join(MODELS_DIR, 'orders-serverless.json'), 'utf8'));

/** Raw patch: what the vocabulary does not allow saying, said by force. */
function patch(xml) {
  return xml
    // 1. sketch on the AWS4 shapes — the official palette forces sketch=0 on 56/56 entries
    .replace(/shape=mxgraph\.aws4\./g, 'sketch=1;curveFitting=1;jiggle=2;shape=mxgraph.aws4.')
    // 2. the group color swapped for a "house" palette — the legend disappears
    .replace(/strokeColor=#8C4FFF/g, 'strokeColor=#1B6AC9')   // purple VPC -> corporate blue
    .replace(/strokeColor=#00A4A6/g, 'strokeColor=#1B6AC9')   // private subnet -> the same blue
    .replace(/strokeColor=#7AA116/g, 'strokeColor=#1B6AC9')   // public subnet -> the same blue
    // 3. rounded on an AWS4 vertex — a request the mxStencil ignores
    .replace(/aspect=fixed;/g, 'aspect=fixed;rounded=1;arcSize=20;');
}

async function main() {
  // --- d: sayable and wrong -------------------------------------------------
  const d = await generate(MODEL, { tema: 'trap', force: true });
  fs.writeFileSync(path.join(ROOT, 'output', 'themes', 'd-trap.drawio'), d.xml);
  console.log('d-trap  — the gate would fail it like this:');
  for (const l of contrast.summarize(d.relatorio.contraste)) console.log('   ✗ ' + l);
  fs.writeFileSync(path.join(ROOT, 'output', 'themes', 'd-trap.verdict.txt'),
    contrast.summarize(d.relatorio.contraste).join('\n') + '\n');

  // --- e: unspeakable --------------------------------------------------------
  const e = await generate(MODEL, { tema: 'light' });
  const patched = patch(e.xml);
  fs.writeFileSync(path.join(ROOT, 'output', 'themes', 'e-unspeakable.drawio'), patched);
  const howMany = k => (patched.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log('\ne-unspeakable  — patches that NO theme token can write:');
  console.log(`   sketch=1 injected into ${howMany('sketch=1')} AWS4 shape(s)`);
  console.log(`   group color swapped for #1B6AC9 in ${howMany('strokeColor=#1B6AC9')} group(s)`);
  console.log(`   rounded=1 injected into ${howMany('rounded=1;arcSize=20')} AWS4 vertex/vertices (no-op — the render will ignore it)`);
  // The claim below is MEASURED, not assumed: the same patch applied to the PLAN,
  // run through the gate. If the chosen blue ever failed, this line changes sides
  // on its own instead of continuing to assert what is no longer true.
  const patchedPlan = {
    ...e.layoutPlan,
    cells: e.layoutPlan.cells.map(c => ({ ...c, style: patch(c.style || '') })),
  };
  const v = contrast.measure(patchedPlan);
  console.log(`\n   And note what this file proves about the gate: the patched version ` +
    `${v.ok ? 'PASSES' : 'FAILS'} contrast`);
  const n = x => Number.isFinite(x) ? x.toFixed(2) + ':1' : 'no pair measured';
  console.log(`   (${v.total} pairs measured, worst graphic ${n(v.piorGrafismo)}, ` +
    `worst text ${n(v.piorTexto)}) and the diagram still ended up lying —`);
  console.log('   three different boundaries in the same color. Contrast is accessibility, not');
  console.log('   truthfulness: that is why the normative layer needs to be UNSPEAKABLE, and not');
  console.log('   merely measured.');
  if (!v.ok) { for (const l of contrast.summarize(v)) console.log('     · ' + l); }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
