#!/usr/bin/env node
'use strict';
/**
 * The case #14 asks out loud:
 *
 *   > What happens when the human edited the `.drawio` by hand between two
 *   > sessions — is the model still valid? Does the skill detect divergence?
 *
 *   node tools/demo-divergence.cjs <retail.drawio>
 *
 * It does what a human really does to a diagram they received: drags a box,
 * renames a service that had the wrong name, deletes one that no longer exists
 * and draws one that was missing. Then saves and sends it back.
 *
 * There are two output files, written alongside the input, and the difference
 * between them is the decision of this ticket:
 *
 *   retail-only-dragged.drawio   — only dragged. The model still holds.
 *   retail-hand-edited.drawio    — touched the content. The model became a lie.
 */

const fs = require('fs');
const path = require('path');

const SKILL = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const { open, differ, policy, canRegenerate } = require(path.join(SKILL, 'session', 'open.cjs'));
const { draw } = require(path.join(SKILL, 'session', 'draw.cjs'));
const { readPages } = require(path.join(SKILL, 'session', 'fingerprint.cjs'));

const FILE = process.argv[2];

/**
 * Applies a swap to the LAST cell with this id — the file has two pages and the
 * same id appears in both; the last one is the technical page.
 *
 * The slice is by INDEX, not by `String.replace(text, ...)`: replace with a
 * string pattern swaps the FIRST occurrence of the text, so it would only hit
 * the technical page while the two cells differed in some byte. Matching by
 * accident is worse than missing: it works right up to the day both pages draw
 * the cell identically.
 */
function inLastCell(xml, id, fn) {
  const re = new RegExp(`<mxCell id="${id}"[\\s\\S]*?</mxCell>`, 'g');
  const all = [...xml.matchAll(re)];
  if (!all.length) throw new Error(`cell "${id}" not found`);
  const m = all[all.length - 1];
  return xml.slice(0, m.index) + fn(m[0]) + xml.slice(m.index + m[0].length);
}

const ONLY_DRAGGED = xml =>
  inLastCell(xml, 'reter-objeto', c => c.replace(/<mxGeometry x="(-?\d+)" y="(-?\d+)"/,
    (_, x, y) => `<mxGeometry x="${+x + 60}" y="${+y + 24}"`));

const TOUCHED_CONTENT = xml => {
  let x = ONLY_DRAGGED(xml);
  x = inLastCell(x, 'tratar-falha', c => c.replace('value="SQS · fila de falha"', 'value="SQS · quarantine"'));
  // deleted the read role and the edge that went into it
  x = x.replace(/ *<mxCell id="papel-leitura"[\s\S]*?<\/mxCell>\n/, '');
  x = x.replace(/ *<mxCell id="a-confia"[\s\S]*?<\/mxCell>\n/, '');
  // drew a box nobody asked for, on the technical page (the last one)
  const last = x.lastIndexOf('        <object id="panlabs-modelo"');
  return x.slice(0, last) + (
    '        <mxCell id="architect-waf" value="WAF" ' +
    'style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#DD344C;strokeColor=#ffffff;dashed=0;' +
    'verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;aspect=fixed;' +
    'shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.waf;" vertex="1" parent="1">\n' +
    '          <mxGeometry x="40" y="700" width="78" height="78" as="geometry"/>\n' +
    '        </mxCell>\n') + x.slice(last);
};

async function describe(label, file) {
  console.log(`\n  ══ ${label}`);
  const opened = open(fs.readFileSync(file, 'utf8'));
  console.log(`     recognized: ${opened.howIRecognized.join(' · ')}`);
  for (const p of opened.pages) {
    const pol = policy(p.state);
    console.log(`     page view=${p.view}  →  ${p.state.toUpperCase()}`);
    console.log(`       ${pol.say}`);
    if (p.state !== 'divergent') continue;
    const can = canRegenerate(opened.session, p.view);
    if (!can.can) { console.log(`       ${can.because}`); continue; }
    const ref = await draw(opened.session, p.view);
    const d = differ(p, readPages(ref.xml).pages[0].cells);
    console.log(`       ${d.findings.length} difference(s) — ${d.absorbable} absorbable, ${d.opaque} opaque:`);
    for (const a of d.findings)
      console.log(`         · ${String(a.kind).padEnd(14)} ${String(a.id).padEnd(20)} ` +
        `${a.was !== undefined && a.became !== undefined
            ? `"${String(a.was).slice(0, 24)}" → "${String(a.became).slice(0, 24)}"`
            : a.was !== undefined ? `was "${String(a.was).slice(0, 32)}"`
            : `came "${String(a.became).slice(0, 32)}"`}` +
        `  [${a.category}${a.where ? ': ' + a.where : ''}]`);
  }
}

async function main() {
  if (!FILE || !fs.existsSync(FILE)) {
    console.error('  usage: node demo-divergence.cjs <retail.drawio>  (run tools/approve.cjs and tools/resume.cjs first)');
    process.exit(1);
  }
  const base = fs.readFileSync(FILE, 'utf8');

  const dir = path.dirname(FILE);
  const a = path.join(dir, 'retail-only-dragged.drawio');
  const b = path.join(dir, 'retail-hand-edited.drawio');
  fs.writeFileSync(a, ONLY_DRAGGED(base));
  fs.writeFileSync(b, TOUCHED_CONTENT(base));

  await describe('The human ONLY DRAGGED a box', a);
  await describe('The human TOUCHED THE CONTENT', b);

  console.log('\n  The difference between the two is not of degree, it is of answer:');
  console.log('  in the first the skill carries on and warns that regenerating erases their edit;');
  console.log('  in the second it stops, because it does not know which of the two versions the user calls true.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
