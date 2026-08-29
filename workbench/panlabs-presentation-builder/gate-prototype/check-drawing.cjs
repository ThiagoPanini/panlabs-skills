#!/usr/bin/env node
// PROTOTYPE static gate for declarative drawings. Pure arithmetic on the markup:
// no browser. Only possible because the drawing is SVG -- a <canvas> carries none
// of these numbers in the file.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
let fail = 0;
const say = (m) => { console.log(m); fail = 1; };
const num = (s, k) => { const m = s.match(new RegExp(k + '\\s*=\\s*"([-0-9.]+)"')); return m ? +m[1] : null; };

// ---- 1. a connector must land ON the thing it points at ---------------------
const rects = [...html.matchAll(/<rect\b[^>]*>/g)].map(m => m[0])
  .map(t => ({ x: num(t,'x'), y: num(t,'y'), w: num(t,'width'), h: num(t,'height') }))
  .filter(r => r.x !== null && r.w > 4);
const TOUCH = 6;                              // units of the viewBox
const distToRect = (p, r) => {
  const dx = Math.max(r.x - p[0], 0, p[0] - (r.x + r.w));
  const dy = Math.max(r.y - p[1], 0, p[1] - (r.y + r.h));
  return Math.hypot(dx, dy);
};
for (const m of html.matchAll(/<(?:path|polyline)\b[^>]*\b(?:d|points)\s*=\s*"([^"]+)"[^>]*>/g)) {
  const tag = m[0];
  if (!/marker-end|class="[^"]*\bln\b/.test(tag) && !/marker-end/.test(html.slice(0, m.index))) continue;
  if (/\bz\b|\bZ\b/.test(m[1])) continue;                   // closed shape, not a connector
  const pts = [...m[1].matchAll(/(-?[\d.]+)[ ,]+(-?[\d.]+)/g)].map(p => [+p[1], +p[2]]);
  if (pts.length < 2 || !rects.length) continue;
  for (const [label, p] of [['start', pts[0]], ['end', pts[pts.length - 1]]]) {
    const d = Math.min(...rects.map(r => distToRect(p, r)));
    if (d > TOUCH) {
      const near = rects.reduce((a, r) => distToRect(p, r) < distToRect(p, a) ? r : a);
      say(`connector "${m[1].slice(0, 30)}" has its ${label} at (${p[0]},${p[1]}), ${Math.round(d)} units from the nearest box `
        + `[${near.x},${near.y} ${near.w}x${near.h}] -- the arrow points at nothing`);
    }
  }
}

// ---- 2. the arcs of a donut must close the circle ---------------------------
const arcs = {};
for (const m of html.matchAll(/<circle\b[^>]*>/g)) {
  const t = m[0];
  const da = t.match(/stroke-dasharray\s*=\s*"([\d.]+)/);
  if (!da) continue;
  const key = `${num(t,'cx')},${num(t,'cy')},${num(t,'r')}`;
  (arcs[key] = arcs[key] || { r: num(t, 'r'), parts: [] }).parts.push(+da[1]);
}
for (const [key, a] of Object.entries(arcs)) {
  const sum = a.parts.reduce((x, y) => x + y, 0);
  const circ = 2 * Math.PI * a.r;
  if (Math.abs(sum - circ) / circ > 0.01)
    say(`donut at (${key}): the arcs sum to ${sum.toFixed(1)} against a circumference of ${circ.toFixed(1)} `
      + `(${((sum/circ-1)*100).toFixed(1)}% off) -- the slices do not close the circle`);
}

// ---- 3. the drawn number must agree with the data that drew it --------------
// Measurable ONLY where the skeleton names the relationship. Contract:
//   <text data-total-of="donut-1">40</text>   and   <circle data-value="15" data-series="donut-1">
const totals = [...html.matchAll(/<text\b[^>]*data-total-of\s*=\s*"([^"]+)"[^>]*>\s*([\d.,]+)/g)];
for (const [, id, shown] of totals) {
  const vals = [...html.matchAll(new RegExp(`data-series\\s*=\\s*"${id}"[^>]*data-value\\s*=\\s*"([\\d.]+)"|data-value\\s*=\\s*"([\\d.]+)"[^>]*data-series\\s*=\\s*"${id}"`, 'g'))]
    .map(m => +(m[1] || m[2]));
  const sum = vals.reduce((a, b) => a + b, 0);
  const drawn = +String(shown).replace(',', '.');
  if (vals.length && Math.abs(sum - drawn) > 0.005)
    say(`the label for "${id}" reads ${drawn} and the ${vals.length} series it totals sum to ${sum} `
      + `(${vals.join(' + ')}) -- the drawing is right and the number is lying`);
}
if (!totals.length) console.log(`(no data-total-of contract in this file: label-vs-data coherence is not measurable here)`);

process.exit(fail);
