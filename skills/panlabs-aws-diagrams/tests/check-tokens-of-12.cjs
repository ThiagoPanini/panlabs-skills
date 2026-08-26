#!/usr/bin/env node
'use strict';
/**
 * #12's four cells come out of TOKENS, and the `light` theme reconstructs
 * the literals.
 *
 * When multi-account entered the engine, #13 didn't exist there yet:
 * `plan.cjs` gained four hand-written styles — the OU label, the bus line,
 * the stub, and the permission enabler — with hex baked in. As long as the
 * engine only drew on white, that cost nothing. The moment the two started
 * running together, it started costing the dark deck: bus `#232F3E` on a
 * `#1C1C1C` background.
 *
 * The consolidation swapped the four literals for theme constructors. The
 * claim that swap makes — and that this check measures — is strong and
 * worth writing out:
 *
 *   **#12 was already using #13's tokens, writing their values by hand.**
 *
 * If that's true, the `light` theme reconstructs every literal key for key.
 * Where it doesn't reconstruct, the divergence shows up named here instead
 * of turning into a silent drawing difference — which is exactly what the
 * consolidation exists to prevent.
 *
 * The second half is the gate: in the DARK theme the same four styles have
 * to pass contrast. That's the proof the swap bought something.
 */

const path = require('path');

const ROOT = path.join(__dirname, '..');
const themeMod = require(path.join(ROOT, 'theme', 'theme.cjs'));
const { ratio, textThreshold } = require(path.join(ROOT, 'engine', 'contrast.cjs'));

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

/** The literals as #12 wrote them, copied from that ticket's `plan.cjs`. */
const LITERALS = {
  ou: 'text;html=1;fontSize=13;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;',
  bus: 'endArrow=none;html=1;strokeColor=#232F3E;strokeWidth=1.6;',
  stub: 'edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#232F3E;strokeWidth=1.6;' +
    'endArrow=blockThin;endFill=1;endSize=6;fontSize=10;fontColor=#232F3E;labelBackgroundColor=#FFFFFF;',
  habilitador: 'edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#5A6C86;strokeWidth=1.4;dashed=1;' +
    'dashPattern=6 4;endArrow=blockThin;endFill=1;endSize=6;',
};

/**
 * EXPECTED ADDITION, and the expectation is a deliberately closed list: any
 * new key outside it is a drawing difference nobody decided on.
 *
 * `fontFamily` is included because `text.family` is a real token — `corporate`
 * swaps Arial,Helvetica for Arial and the rest of the drawing follows suit.
 * Leaving these four styles out would make them the page's only typography
 * outside the theme.
 */
const ADDITIONS = { ou: ['fontFamily'], bus: [], stub: ['fontFamily'], habilitador: [] };

const keys = s => Object.fromEntries(
  String(s).split(';').filter(Boolean).map(p => {
    const i = p.indexOf('=');
    return i < 0 ? [p, true] : [p.slice(0, i), p.slice(i + 1)];
  }));

console.log('\n1 · the `light` theme reconstructs #12\'s four literals\n');
const light = themeMod.load('light');
for (const [name, literal] of Object.entries(LITERALS)) {
  const a = keys(literal), b = keys(light[name]());
  const lost = Object.keys(a).filter(k => a[k] !== b[k]);
  const added = Object.keys(b).filter(k => !(k in a));
  const unexpected = added.filter(k => !ADDITIONS[name].includes(k));
  ok(lost.length === 0 && unexpected.length === 0, `${name}`,
    lost.length ? `diverged on ${lost.map(k => `${k}: ${a[k]} → ${b[k]}`).join(', ')}`
      : unexpected.length ? `unforeseen new key: ${unexpected.join(', ')}`
        : `${Object.keys(a).length} identical key(s)` + (added.length ? ` + ${added.join(', ')}` : ''));
}

console.log('\n2 · the token → literal mapping, one assertion per line\n');
const t = light.tokens;
/**
 * ⚠️ THIS WAS A `console.log` AND NOTHING ELSE — a numbered section that
 * didn't know how to fail, caught in #23's review. It printed the tokens'
 * values and called that proof; what it needs to assert is that **the
 * token's value is the value #12 wrote by hand**, and that's a comparison.
 */
for (const [token, value, style, key] of [
  ['ink.strong', t.ink.strong, 'ou', 'fontColor'],
  ['ink.weak', t.ink.weak, 'habilitador', 'strokeColor'],
  ['ink.halo', t.ink.halo, 'stub', 'labelBackgroundColor'],
  ['edge.color', t.edge.color, 'bus', 'strokeColor'],
  ['edge.thickness', t.edge.thickness, 'bus', 'strokeWidth'],
  ['edge.tip', t.edge.tip, 'stub', 'endArrow'],
  ['text.edge', t.text.edge, 'stub', 'fontSize'],
  ['text.group + 1', t.text.group + 1, 'ou', 'fontSize'],
]) {
  const literalValue = keys(LITERALS[style])[key];
  ok(String(value) === String(literalValue), `${String(token).padEnd(18)} → S_${style.toUpperCase()}.${key}`,
    `token ${value} · #12's literal ${literalValue}`);
}

console.log('\n3 · and in the dark deck the four pass contrast — what the swap bought\n');
const dark = themeMod.load('dark');
const background = dark.tokens.page.color;
/**
 * WHICH of the four #12's literal would have BROKEN in the dark — and the
 * number is spelled out because the swap's value is exactly that.
 *
 * `habilitador` is the one that would NOT break: `#5A6C86` gives 3.18:1, a
 * hair above the graphics floor. Leaving that implicit would make the
 * section sell the swap as better than it is; the assertion below charges
 * for all three AND charges that the fourth passes, so that the day the
 * palette changes it shows up here instead of vanishing.
 */
const WOULD_BREAK = new Set(['ou', 'bus', 'stub']);
for (const name of Object.keys(LITERALS)) {
  const before = keys(LITERALS[name]).strokeColor || keys(LITERALS[name]).fontColor;
  const after = (k => k.strokeColor || k.fontColor)(keys(dark[name]()));
  const beforeRatio = ratio(before, background), afterRatio = ratio(after, background);
  // a label is text (WCAG 1.4.3) and a stroke is graphics (1.4.11) — the text
  // floor comes from `textThreshold`, which already knows the 24px/18.5px-bold cutoff
  const floor = name === 'ou' ? textThreshold(dark.ou()) : 3.0;
  ok(afterRatio >= floor, `${name} in the dark passes through the token`,
    `${after} = ${afterRatio.toFixed(2)}:1 (floor ${floor}:1)`);
  ok((beforeRatio < floor) === WOULD_BREAK.has(name),
    `and #12's literal ${WOULD_BREAK.has(name) ? 'WOULD BREAK' : 'would pass'} — as expected`,
    `${before} = ${beforeRatio.toFixed(2)}:1`);
}

console.log(failures
  ? "\n  ✗ #12's styles are not reconstructible from the theme.\n"
  : "\n  ✓ #12 was already writing #13's tokens by hand — now it writes their name.\n");
process.exit(failures ? 1 : 0);
