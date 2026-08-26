#!/usr/bin/env node
'use strict';
/**
 * The same decision, checked in the EMITTED FILE — not in the rule I wrote.
 *
 * `check-layer.cjs` proves the RULE orders correctly, and it does so by
 * calling the rule. If one day `layout.cjs` stops consulting the layer, that
 * gauge stays green and the drawing comes out wrong: it would be checking my
 * intent, not the product. It's the lesson #17 paid dearly for — "static
 * checking doesn't replace rendering" — and the format here is the one from
 * `check-traversal.cjs` in #12.
 *
 * This reads the `.drawio` the engine just emitted, extracts the Y of each
 * subnet cell, and checks that the top-to-bottom order is what the ticket
 * expects. It goes through the whole pipeline: derive › lay out › plan ›
 * emit.
 *
 * The Y comes from the GEOMETRY, not from the order of cells in the
 * document: document order is Z-order and isn't what the reader sees
 * stacked.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));

/**
 * What ticket #22 expects to see, top to bottom, in each model.
 * It's the table from the ticket's statement, plus the cases this prototype added.
 */
const EXPECTED = {
  'app-data': ['App subnet', 'Data subnet'],
  'web-data': ['Web subnet', 'Data subnet'],
  'ingest-core': ['Ingest subnet', 'Core subnet'],
  'three-mixed-layers': ['Firewall subnet', 'Worker subnet', 'Analytics subnet'],
  'declared-empty-subnet': ['App subnet', 'Reserved subnet'],
  'web-data-with-flow': ['Public subnet', 'Web subnet', 'Data subnet'],
  'elk-no-layer': ['App subnet', 'Reserved subnet'],
};

/**
 * The subnet rows from the XML, top to bottom, without repeating a label.
 *
 * A subnet cell's `value` is the label, and its style carries
 * `grIcon=…group_security_group` — that's how the catalog (#17) draws the
 * two subnets, and it's what tells the subnet apart from the VPC and the
 * cloud in the same file.
 *
 * Each role appears once per zone, all on the same row: deduplicating by
 * label returns exactly the grid's ROWS, which is what we want to check.
 */
function fileRows(xml) {
  const cells = [...xml.matchAll(
    /<mxCell id="([^"]+)" value="([^"]*)" style="([^"]*)"[^>]*>\s*<mxGeometry x="(-?\d+)" y="(-?\d+)"/g)]
    .filter(m => /group_security_group/.test(m[3]))
    .map(m => ({ id: m[1], label: m[2], y: Number(m[5]) }));

  cells.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  const seen = new Set();
  return cells.filter(c => !seen.has(c.label) && seen.add(c.label)).map(c => c.label);
}

(async () => {
  let failures = 0;
  console.log('\n  row order READ FROM THE EMITTED FILE\n');

  for (const [name, expected] of Object.entries(EXPECTED)) {
    const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', `${name}.json`), 'utf8'));
    const { xml } = await generate(model);
    const got = fileRows(xml);
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (!ok) failures++;
    console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(24)} ${got.join(' → ')}`);
    if (!ok) console.log(`      expected: ${expected.join(' → ')}`);
  }

  /**
   * The control: without it, an extractor that always returned an empty list
   * would pass everything. Here the data subnet is declared as edge — the
   * drawing MUST invert, and if it doesn't invert it's because the file
   * isn't actually being read.
   */
  const control = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'web-data.json'), 'utf8'));
  for (const n of control.nodes) if (n.label === 'Data subnet') n.layer = 'edge';
  const { xml } = await generate(control);
  const inverted = fileRows(xml);
  const didInvert = JSON.stringify(inverted) === JSON.stringify(['Data subnet', 'Web subnet']);
  if (!didInvert) failures++;
  console.log(`\n  ${didInvert ? '✓' : '✗'} control: declaring the Data subnet as "edge" inverts the drawing ` +
    `— ${inverted.join(' → ')}`);

  console.log(failures
    ? `\n  ✗ ${failures} failure(s) — the order in the file isn't what the rule promises`
    : '\n  ✓ what the rule decides is what the file shows.');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
