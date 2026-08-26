#!/usr/bin/env node
'use strict';
/**
 * #40 — the leaf queue is centered in the subnet's FINAL box, not packed
 * against its left padding.
 *
 * `dispor.porGrade` equalizes a subnet's box against its AZ/role siblings
 * (#19's grid), but the subnet's OWN ELK pass never sees that wider box — it
 * only ever laid the subnet out in isolation, flush against its own left
 * padding. Left unshifted, a subnet narrower than its column reads as a hole
 * on the right — visible in `web-asg-with-neighbor`'s "app-b" subnet before
 * #40: paddings 14/162/37, all the slack sitting on the right.
 *
 * The fix — a centering pass in `dispor.porGrade`, run once `pos` (and so the
 * box's final width) exists — is exactly why #40 could not run before #33:
 * centering against a box that hasn't reached its final size is centering
 * twice.
 *
 * Two levels of proof:
 *
 *   1. UNIT — `dispor.porGrade` on a tracked corpus model: the narrower
 *      subnet's leaves come back centered, in the grid's own numbers.
 *   2. END TO END — `engine/generate.cjs` on the same model: A4.5 (padding
 *      uniformity) no longer names that subnet as an outlier.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const themeMod = require(path.join(ROOT, 'theme', 'theme.cjs'));
const resolveMod = require(path.join(ROOT, 'engine', 'resolve.cjs'));
const { derive } = require(path.join(ROOT, 'engine', 'derive.cjs'));
const dispor = require(path.join(ROOT, 'engine', 'layout.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));
const { validateGeometry } = require(path.join(ROOT, 'validator', 'validate-geometry.cjs'));

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

const MODEL_PATH = path.join(WORKBENCH, 'models', 'web-asg-with-neighbor.json');
const NARROW_SUBNET = 'app-b';   // one EC2 next to app-a's two — the column equalizes on app-a

(async () => {
// ---------------------------------------------------------------------------
console.log("\n1 · unit — dispor.porGrade() centers the subnet narrower than its AZ column\n");

{
  const model = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  const theme = themeMod.load('light');
  const res = resolveMod.create(theme);
  const d = derive(model, { cat: res.cat });
  const g = await dispor.porGrade(model, d, res);

  const box = g.pos.get(NARROW_SUBNET);
  const inner = g.intra.get(NARROW_SUBNET);
  ok(box.w > inner.w, `"${NARROW_SUBNET}"'s final box is wider than its own content`,
    `box.w=${box.w} inner.w=${inner.w}`);

  // "centered" is LEFT MARGIN == RIGHT MARGIN, not "starts at x=0" — ELK
  // itself already reserves left padding inside `inner`, before #40's offset
  // ever runs.
  const leftMargin = Math.min(...inner.filhos.map(c => c.x));
  const rightMargin = box.w - Math.max(...inner.filhos.map(c => c.x + c.width));
  ok(Math.abs(leftMargin - rightMargin) < 1,
    "the subnet's leaves sit with equal left and right margins, not packed flush left",
    `left=${leftMargin} right=${rightMargin}`);
}

// ---------------------------------------------------------------------------
console.log('\n2 · end to end — A4.5 reports equal left/right padding for the subnet\n');

{
  const model = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  const r = await generate(model, { tema: 'light' });
  const report = validateGeometry(r.layoutPlan);
  const a45 = report.resultados.find(c => c.id === 'A4.5');
  const line = a45.occurrences.map(o => o.o_que || o).find(o => o.includes(`"${NARROW_SUBNET}"`));
  const m = line && line.match(/paddings ([\d.]+)\/([\d.]+)\/([\d.]+)/);
  ok(!!m, `A4.5 still measures "${NARROW_SUBNET}"'s paddings (top/bottom asymmetry is out of #40's scope)`, line);
  ok(!!m && Math.abs(Number(m[1]) - Number(m[2])) < 0.1,
    'left and right padding are now equal (they were 14/162 before #40)',
    m && `left=${m[1]} right=${m[2]} bottom=${m[3]}`);
}

// ---------------------------------------------------------------------------
console.log(failures ? `\n  ✗ ${failures} failure(s)` : '\n  ✓ the leaf queue centers in its final box.');
process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
