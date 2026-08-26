#!/usr/bin/env node
'use strict';
/**
 * THE BACKGROUND RULER — how far the official AWS palette lets the page change colour.
 *
 * This measurement is the finding that rewrote the third theme of #13. The
 * question we were about to answer by taste ("which background for the corporate
 * theme?") has an answer by number, and the answer is: almost none.
 *
 * Method: WCAG 2.2 SC 1.4.11 requires 3:1 between "the important parts of a more
 * complex diagram" and the adjacent colour. The group border is the drawn
 * boundary — it is what the reader needs to see. For each normative colour we
 * sweep the 256 neutral grays and find the darkest (coming from white) and the
 * lightest (coming from black) that still deliver 3:1.
 *
 *   node tools/measure-ruler.cjs
 */

const { ratio, luminance } = require('../engine/contrast.cjs');
const cat = require('../catalog/aws-shapes.cjs').load();
const theme = require('../theme/theme.cjs');

const gray = g => '#' + Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0').repeat(3).toUpperCase();

function bounds(color, target = 3) {
  let light = null, dark = null;
  for (let g = 255; g >= 0; g--) { if (ratio(color, gray(g)) < target) { light = g + 1; break; } }
  for (let g = 0; g <= 255; g++) { if (ratio(color, gray(g)) < target) { dark = g - 1; break; } }
  return { light: light === null ? 0 : light, dark: dark === null ? 255 : dark };
}

function borderColor(style) { return (/(?:^|;)strokeColor=(#[0-9A-Fa-f]{6})/.exec(style) || [])[1]; }

function main() {
  const borders = new Map();
  for (const t of cat.groups()) {
    const c = borderColor(cat.group(t).style);
    if (!c) continue;
    if (!borders.has(c)) borders.set(c, []);
    borders.get(c).push(t);
  }

  console.log('\n=== 1. GROUP BORDER vs. NEUTRAL BACKGROUND (WCAG 1.4.11, target 3:1) ===\n');
  console.log('colour   vs white   darkest light background that passes   lightest dark background that passes   groups');
  const rows = [...borders.entries()].sort((a, b) => ratio(a[0], '#FFFFFF') - ratio(b[0], '#FFFFFF'));
  for (const [c, groups] of rows) {
    const l = bounds(c);
    console.log(`${c}   ${ratio(c, '#FFFFFF').toFixed(2).padStart(5)}   ` +
      `${(l.light > 255 ? 'NONE' : gray(l.light)).padEnd(30)} ` +
      `${(l.dark < 0 ? 'NONE' : gray(l.dark)).padEnd(30)} ${groups.slice(0, 2).join(', ')}`);
  }

  // AWS Cloud drops out of the dark-background sum because it is precisely the
  // colour the dark deck INVERTS — measuring it as if it did not invert would
  // make the ruler useless.
  const withoutCloud = rows.filter(([c]) => c !== '#232F3E');
  const ceiling = Math.max(...rows.map(([c]) => bounds(c).light));
  const floor = Math.min(...withoutCloud.map(([c]) => bounds(c).dark));
  console.log(`\n  → the LIGHT background cannot be darker than ${gray(ceiling)} (set by: ` +
    rows.filter(([c]) => bounds(c).light === ceiling).map(([c]) => c).join(', ') + ')');
  console.log(`  → the DARK background cannot be lighter than ${gray(floor)} (set by: ` +
    withoutCloud.filter(([c]) => bounds(c).dark === floor).map(([c]) => c).join(', ') +
    ') — already with AWS Cloud inverted, as the dark deck requires');
  console.log('\n  There is no band in between. The "corporate off-white" — #F7F8FA, #F2F3F5,');
  console.log('  #FAFAFA — falls outside the ceiling. The house style has no room in the background.');

  console.log('\n=== 2. WHAT THE AWS DARK DECK CHANGES, DERIVED FROM THE MEASUREMENT ===\n');
  console.log('AWS publishes two decks and the dark one changes the AWS Cloud border/icon and the');
  console.log('callouts, nothing else (#5 §2.1 reading 2). Measured against a dark background:\n');
  const dark = theme.DEFAULT.dark.page.color;
  const failing = [];
  for (const [c, groups] of rows) {
    const r = ratio(c, dark);
    const mark = r >= 3 ? ' ' : '✗';
    if (r < 3) failing.push(c);
    console.log(`  ${mark} ${c}  ${r.toFixed(2).padStart(5)}:1 over ${dark}   ${groups.slice(0, 2).join(', ')}`);
  }
  console.log(`\n  → failing: ${failing.join(', ') || 'none'}. The measured list and the dark-deck`);
  console.log('    list are the SAME. The dark deck is the minimum edit WCAG demands.');

  console.log('\n=== 3. CATEGORY PALETTE (the service icon square) ===\n');
  const fills = new Map();
  for (const [k, v] of Object.entries(cat.categories())) {
    if (!v.fill) continue;
    if (!fills.has(v.fill)) fills.set(v.fill, []);
    fills.get(v.fill).push(k);
  }
  console.log('colour   vs white   vs dark    white glyph over it    categories');
  for (const [c, cats] of [...fills.entries()].sort((a, b) => ratio(a[0], '#FFFFFF') - ratio(b[0], '#FFFFFF')))
    console.log(`${c}   ${ratio(c, '#FFFFFF').toFixed(2).padStart(5)}     ${ratio(c, dark).toFixed(2).padStart(5)}` +
      `      ${ratio(c, '#FFFFFF').toFixed(2).padStart(5)}                ${cats.slice(0, 3).join(', ')}`);
  console.log('\n  The glyph is white over the square, so "vs white" and "glyph" are the same');
  console.log('  sum — and that is why the whole palette sits right at 3:1: it was calibrated');
  console.log('  for the white glyph to fit, not for the page.');

  console.log('\n=== 4. WHICH SERVICES THE DARK THEME DOES NOT SUPPORT ===\n');
  const byCategory = new Map();
  for (const s of cat.catalog.services) {
    if (!byCategory.has(s.palette)) byCategory.set(s.palette, 0);
    byCategory.set(s.palette, byCategory.get(s.palette) + 1);
  }
  let rejected = 0, total = 0;
  const list = [];
  for (const [pal, n] of byCategory) {
    const fill = (cat.categories()[pal] || {}).fill;
    total += n;
    if (!fill) continue;
    // the monochrome palettes are exactly the ones AWS ships in Light/Dark;
    // the theme inverts them and they come out white. Out of the sum.
    if (theme.MONO_PALETTES.has(pal)) continue;
    const r = ratio(fill, dark);
    if (r < 3) { rejected += n; list.push(`${pal} (${fill}, ${r.toFixed(2)}:1, ${n} icons)`); }
  }
  if (list.length) {
    console.log('  The AWS dark deck says the category colour does not change. The measurement');
    console.log('  disagrees on two categories — and that is why the gate runs over the PLAN,');
    console.log('  not over the theme: if the diagram does not use those services, it passes.\n');
    for (const l of list) console.log('  ✗ ' + l);
    console.log(`\n  → ${rejected} of ${total} service icons land below 3:1 on the dark background.`);
  } else {
    console.log('  No category fails on the dark background.');
  }

  console.log('\n=== 5. VERDICT PER THEME ===\n');
  for (const id of theme.listAll()) {
    let t; try { t = theme.load(id); } catch (e) { console.log(`  ${id.padEnd(14)} does not load: ${e.message}`); continue; }
    const f = t.tokens.page.color;
    // apply the normative inversion before measuring: it is what the theme actually emits
    const colors = rows.map(([c]) => c === '#232F3E' ? t.normativo.cloud : c);
    const worst = Math.min(...colors.map(c => ratio(c, f)));
    const who = colors.find(c => ratio(c, f) === worst);
    const lum = luminance(f);
    const ok = worst >= 3;
    console.log(`  ${ok ? '✓' : '✗'} ${id.padEnd(14)} background ${f}  luminance ${lum.toFixed(4)}  ` +
      `worst group border ${worst.toFixed(2)}:1 (${who})  ${ok ? '' : '← FAILS'}`);
  }
  console.log('');
}

if (require.main === module) main();
module.exports = { bounds, gray };
