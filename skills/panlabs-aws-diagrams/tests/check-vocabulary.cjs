#!/usr/bin/env node
'use strict';
/**
 * THE NORMATIVE LAYER IS UNSPEAKABLE — checked, with a control experiment.
 *
 * #11 proved that "the agent never writes a coordinate" needed no discipline:
 * it was enough for the schema to have no property that named a position.
 * Here's the same move for #13's other boundary:
 *
 *   > the theme must not change a group's color, a category's color, a
 *   > group's stroke, or an icon's size — because changing those makes the
 *   > diagram READ WRONG (the group's color IS the legend, #5 §6.4).
 *
 * Two fronts, because one alone doesn't close the case:
 *
 *   INPUT    the theme schema rejects the forbidden token.
 *   OUTPUT   the emitted style strings don't carry the forbidden key, even if
 *            someone worked around the input.
 *
 * And #17's expensive lesson — 24 green checks and the PNG came out with the
 * wrong icon — becomes a control experiment: we inject the forbidden tokens
 * into the schema and the check MUST flag it. A check that doesn't know how
 * to fail proves nothing.
 *
 *   node tools/check-vocabulary.cjs
 */

const fs = require('fs');
const path = require('path');
const { againstSchema } = require('../engine/validate.cjs');

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'theme', 'schema.json'), 'utf8'));

const BASE = { schema: 'panlabs-aws-diagrams/theme@1', id: 'test', label: 'Test', background: 'light' };

/** What a theme is NOT allowed to say, and why. */
const FORBIDDEN = [
  { name: 'group border color', theme: { group: { edge: '#FF0000' } },
    because: "the group's color IS the legend — #5 §6.4" },
  { name: 'group stroke', theme: { group: { stroke: 'solid' } },
    because: "sysDash/dash/solid carry meaning — #5's A5" },
  { name: 'service category color', theme: { category: { compute: '#FF0000' } },
    because: "the square's color is the category — deck slide 26" },
  { name: 'icon size', theme: { icon: { size: 64 } },
    because: 'N1: "use icons at their predefined size and do not resize"' },
  { name: 'group fill', theme: { group: { background: '#EEEEEE' } },
    because: "A2: a group's box is <a:noFill/>; and tinting drops #ED7100 below 3:1" },
  { name: 'sketch / hand-drawn', theme: { sketch: true },
    because: '#4 §3.3: RoughCanvas jitters the AWS stencil glyph — the official palette forces sketch=0 in 56/56' },
  { name: 'glass', theme: { glass: true },
    because: '#4 §8: silent no-op in AWS4 — exposing it generates bug reports' },
  { name: 'shadow', theme: { shadow: true },
    because: 'zero shadow across 156 deck slides; and per cell only the outer square receives one' },
  { name: 'gradient', theme: { gradient: { color: '#505863', direction: 'north' } },
    because: "a gradient icon is pre-2022 legacy — AWS itself warns about it (#5's F1)" },
  { name: 'adaptive colors / light-dark()', theme: { adaptiveColors: 'auto' },
    because: '#4 §1.4: the same file renders differently on two computers' },
  { name: 'font outside the safe list', theme: { text: { family: 'Inter' } },
    because: '#4 §4.2: the PNG depends on the font installed on the renderer' },
  { name: 'rounded corners on an AWS4 vertex', theme: { icon: { corners: 8 } },
    because: '#4 §3.3: silent no-op — AWS4 is not in roundableShapes' },
  { name: 'exotic edge style', theme: { edge: { style: 'isometricEdgeStyle' } },
    because: 'N10: straight lines and right angles; isometric does not exist in AWS architecture' },
  { name: 'math / MathJax', theme: { math: true },
    because: "#4 §1.4: pure render cost if the generator doesn't emit LaTeX" },
];

/** style keys the emitted file must never contain, no matter where they'd come from. */
const FORBIDDEN_KEYS = ['sketch=1', 'comic=1', 'glass=1', 'shadow=1', 'sketchStyle=',
  'gradientColor=#', 'light-dark(', 'fontSource=', 'libavoidRouting=1'];

function testInput(schema) {
  const passed = [];
  for (const item of FORBIDDEN) {
    const errors = againstSchema({ ...BASE, ...item.theme }, schema, schema);
    if (errors.length === 0) passed.push(item);
  }
  return passed;
}

async function testOutput() {
  const { generate } = require('../engine/generate.cjs');
  const themeMod = require('../theme/theme.cjs');
  const findings = [];
  for (const file of fs.readdirSync(path.join(__dirname, '..', 'models')).filter(f => f.endsWith('.json'))) {
    const model = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'models', file), 'utf8'));
    for (const id of themeMod.listAll()) {
      let r;
      // `force: true` disarms the contrast gate, so any exception here is a
      // real defect. Swallowing it with `continue` would count as approved a
      // theme that didn't even get to generate — and this file's header says
      // a check that doesn't know how to fail proves nothing.
      try {
        r = await generate(model, { tema: id, force: true });
      } catch (e) {
        findings.push(`${file} + theme ${id}: generation failed (${e.message}) — can't check the output`);
        continue;
      }
      for (const key of FORBIDDEN_KEYS)
        if (r.xml.includes(key)) findings.push(`${file} + theme ${id}: XML contains "${key}"`);
    }
  }
  return findings;
}

async function main() {
  let failed = 0;

  console.log('INPUT — the theme schema rejects the forbidden token');
  const leaked = testInput(SCHEMA);
  for (const item of FORBIDDEN)
    console.log(`  ${leaked.includes(item) ? '✗' : '✓'} ${item.name.padEnd(38)} ${item.because}`);
  if (leaked.length) { console.log(`\n  ${leaked.length} forbidden token(s) ACCEPTED by the schema`); failed = 1; }

  console.log('\nCONTROL — injecting the tokens into the schema, the check MUST flag it');
  const sabotaged = JSON.parse(JSON.stringify(SCHEMA));
  sabotaged.properties.group = { type: 'object' };
  sabotaged.properties.category = { type: 'object' };
  sabotaged.properties.icon = { type: 'object' };
  sabotaged.properties.sketch = { type: 'boolean' };
  sabotaged.properties.glass = { type: 'boolean' };
  sabotaged.properties.shadow = { type: 'boolean' };
  sabotaged.properties.gradient = { type: 'object' };
  sabotaged.properties.adaptiveColors = { type: 'string' };
  sabotaged.properties.math = { type: 'boolean' };
  sabotaged.properties.text.properties.family = { type: 'string' };
  sabotaged.properties.edge.properties.style = { type: 'string' };
  const flagged = testInput(sabotaged);
  const expected = FORBIDDEN.length;
  console.log(`  sabotaged schema accepts ${flagged.length} of ${expected} forbidden tokens`);
  if (flagged.length !== expected) {
    console.log('  ✗ the control did NOT reproduce the violation — the input check does not prove what it claims');
    for (const c of FORBIDDEN) if (!flagged.includes(c)) console.log(`      not reproduced: ${c.name}`);
    failed = 1;
  } else {
    console.log('  ✓ the control reproduces it — the check knows how to fail');
  }

  console.log('\nOUTPUT — the emitted XML carries no forbidden key');
  const findings = await testOutput();
  if (findings.length) { for (const a of findings) console.log('  ✗ ' + a); failed = 1; }
  else console.log(`  ✓ ${FORBIDDEN_KEYS.length} key(s) checked, none in the XML of any theme`);

  console.log(failed ? '\nVOCABULARY LEAKED' : '\nvocabulary closed');
  process.exit(failed);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
