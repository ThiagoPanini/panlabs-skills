#!/usr/bin/env node
// PROTOTYPE render gate. Walks every state of the deck in headless Chromium over
// raw CDP and measures seven things a static reader cannot see.
const path = require('path');
const { launch, findChrome, withNodes } = require('./cdp.cjs');
const { classify, hex } = require('./histogram.cjs');

const PALETTE = ['#141415','#F3F3F3','#2C2C2F','#FFFFFF',
                 '#CD1335','#C75000','#7634D2','#4EA9D0','#5FAB80','#FF6201'];
const SURFACE = '#141415';
// measured scale, % of stage height (issue #90)
const SCALE = { 'h1': 8.9, 'h2': 6.9, 'h3': 5.9, '.lead': 4.0, '.body': 3.5, '.kicker': 2.5 };
const TOL_SCALE = 0.35;          // percentage points
const DISPLAY_LEVELS = ['h1', 'h2'];
const DISPLAY_FACE = 'Anton';

const lum = (c) => { const f = c.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; });
  return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const toRgb = (n) => [(n>>16)&255, (n>>8)&255, n&255];

// in-page: histogram of the whole frame + per-text-box histogram, from one screenshot
const PROBE = (b64) => `async () => {
  const img = new Image(); img.src = "data:image/png;base64,${b64}"; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const D = x.getImageData(0, 0, c.width, c.height);
  const stage = document.querySelector('.stage').getBoundingClientRect();
  const full = new Map();
  for (let i = 0; i < D.data.length; i += 4) {
    const k = (D.data[i]<<16)|(D.data[i+1]<<8)|D.data[i+2];
    full.set(k, (full.get(k)||0)+1);
  }
  const box = (r) => {
    const x0 = Math.max(0, Math.round(r.left - stage.left)), y0 = Math.max(0, Math.round(r.top - stage.top));
    const x1 = Math.min(c.width, Math.round(r.right - stage.left)), y1 = Math.min(c.height, Math.round(r.bottom - stage.top));
    const m = new Map();
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy*c.width + xx)*4;
      const k = (D.data[i]<<16)|(D.data[i+1]<<8)|D.data[i+2];
      m.set(k, (m.get(k)||0)+1);
    }
    return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 24);
  };
  const slide = document.querySelector('.slide.is-active');
  const texts = [];
  for (const el of slide.querySelectorAll('*')) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const cs = getComputedStyle(el);
    // step reveal is an OPAQUE child inside a TRANSPARENT ancestor: per-element
    // opacity is not enough, the chain has to be resolved or every hidden step
    // reports as illegible text.
    let eff = 1, hidden = false;
    for (let q = el; q && q !== document.body; q = q.parentElement) {
      const qs = getComputedStyle(q);
      if (qs.visibility === 'hidden' || qs.display === 'none') { hidden = true; break; }
      eff *= parseFloat(qs.opacity);
    }
    if (hidden || eff < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    texts.push({ sel: el.tagName.toLowerCase() + (el.className ? '.'+String(el.className).split(/\\s+/)[0] : ''),
      px: parseFloat(cs.fontSize), pctH: +(parseFloat(cs.fontSize)/stage.height*100).toFixed(2),
      weight: cs.fontWeight, family: cs.fontFamily, hist: box(r) });
  }
  // geometry: anything painted outside the 16:9 stage, and page-level horizontal scroll
  const bleeds = [];
  for (const el of slide.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right > stage.right + 1 || r.left < stage.left - 1 || r.bottom > stage.bottom + 1 || r.top < stage.top - 1) {
      const s = el.tagName.toLowerCase() + (el.className ? '.'+String(el.className).split(/\\s+/)[0] : '');
      bleeds.push(s + ' [' + Math.round(r.left-stage.left) + ',' + Math.round(r.top-stage.top) + ' '
        + Math.round(r.width) + 'x' + Math.round(r.height) + ' vs stage ' + Math.round(stage.width) + 'x' + Math.round(stage.height) + ']');
    }
  }
  const de = document.scrollingElement || document.documentElement;
  return { total: c.width*c.height, hist: [...full.entries()].sort((a,b)=>b[1]-a[1]),
           texts, bleeds: [...new Set(bleeds)],
           hscroll: de.scrollWidth - innerWidth, faceErrors: [...document.fonts].filter(f=>f.status==='error').map(f=>f.family),
           state: slide.dataset.slide + '.' + slide.querySelectorAll('[data-step].is-shown').length,
           stepsTotal: slide.querySelectorAll('[data-step]').length };
}`;

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('usage: check-render.cjs <deck.html>'); process.exit(2); }
  if (!findChrome()) { console.log('SKIP: no chromium on this machine -- render layer not measured'); process.exit(0); }

  const fails = [];
  const b = await withNodes(await launch({ width: 1600, height: 900 }));
  const offMachine = [];
  const runtimeErrors = [];
  await b.send('Network.enable');
  b.onAny((m) => {
    if (m.method === 'Network.requestWillBeSent'
        && !/^(file|data|blob|about|chrome):/.test(m.params.request.url))
      offMachine.push(m.params.request.url);
    if (m.method === 'Runtime.exceptionThrown')
      runtimeErrors.push(m.params.exceptionDetails.text + ' ' +
        ((m.params.exceptionDetails.exception || {}).description || ''));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      runtimeErrors.push('console.error: ' + JSON.stringify((m.params.args[0]||{}).value));
  });
  await b.goto('file://' + path.resolve(file));
  const clip = await b.evaluate(`()=>{const r=document.querySelector('.stage').getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};}`);

  const seen = new Set(); const dominants = []; let guard = 0;
  const said = new Set();
  const say = (m) => { if (!said.has(m)) { said.add(m); fails.push(m); } };
  let sawStepped = false;
  while (guard++ < 60) {
    const shot = await b.send('Page.captureScreenshot', { format: 'png', clip });
    const p = await b.evaluate(PROBE(shot.data));
    if (seen.has(p.state)) break;
    seen.add(p.state);
    if (p.stepsTotal > 0) sawStepped = true;

    // R1 -- the face that actually painted
    if (p.faceErrors.length)
      say(`state ${p.state}: @font-face never loaded for ${[...new Set(p.faceErrors)].join(', ')} -- the deck is painting in a fallback face`);
    for (const lvl of DISPLAY_LEVELS) {
      const fonts = await b.platformFontsAll(`.slide.is-active ${lvl}`);
      for (const f of fonts) {
        if (!f || !f.length) continue;
        const used = f.sort((x,y)=>y.glyphCount-x.glyphCount)[0];
        if (used.familyName !== DISPLAY_FACE)
          say(`state ${p.state}: ${lvl} painted ${used.glyphCount} glyphs in "${used.familyName}" (isCustomFont=${used.isCustomFont}), not the display face "${DISPLAY_FACE}"`);
      }
    }
    // R2 -- the scale, as % of stage height
    for (const t of p.texts) {
      const key = Object.keys(SCALE).find(k => k.startsWith('.') ? t.sel.endsWith(k) : t.sel === k);
      if (!key) continue;
      if (Math.abs(t.pctH - SCALE[key]) > TOL_SCALE)
        say(`state ${p.state}: ${t.sel} renders at ${t.pctH}% of stage height, the measured scale for ${key} is ${SCALE[key]}% (+-${TOL_SCALE})`);
    }
    // R3 -- legibility floor, measured on the pixels actually painted
    for (const t of p.texts) {
      if (!t.hist.length) continue;
      const bg = toRgb(t.hist[0][0]);
      let best = 1, bestHex = null;
      for (const [k, n] of t.hist.slice(1)) {
        const cr = contrast(bg, toRgb(k));
        if (cr > best) { best = cr; bestHex = hex(k); }
      }
      const need = 1.5;
      if (best < need)
        say(`state ${p.state}: ${t.sel} box has no colour above ${best.toFixed(2)}:1 against its own background ${hex(t.hist[0][0])} (needs ${need}:1) -- the text is not legible where it is painted`);
    }
    // R4 -- off-palette AREA
    const c = classify(p.hist, p.total, PALETTE);
    dominants.push(c.dominant);
    if (c.worstOffender && c.worstOffender.pct >= 0.5)
      say(`state ${p.state}: ${c.worstOffender.hex} covers ${c.worstOffender.pct}% of the slide and is not on the measured palette nor on a ramp between two of its colours`);
    // R5 -- geometry
    for (const x of p.bleeds) say(`state ${p.state}: ${x} is painted outside the 16:9 stage`);
    if (p.hscroll > 4) say(`state ${p.state}: the page scrolls horizontally by ${p.hscroll}px -- the letterbox is not holding`);

    await b.key('ArrowRight');
  }
  // R0 -- premise 4, measured as BEHAVIOUR: no request left the machine.
  // Catches what no regex can: a URL assembled at runtime.
  for (const u of [...new Set(offMachine)])
    fails.unshift(`the deck asked the network for ${u.slice(0, 90)} -- a deck with zero network dependency makes no request`);
  for (const e of [...new Set(runtimeErrors)])
    fails.unshift(`runtime error: ${e.slice(0, 140)}`);
  // R6 -- surface role, judged over the whole walk, never one slide at a time
  const onSurface = dominants.filter(d => d === SURFACE).length;
  if (onSurface * 2 <= dominants.length)
    fails.push(`the surface token ${SURFACE} is the largest area in only ${onSurface} of ${dominants.length} states (dominants: ${[...new Set(dominants)].join(', ')}) -- the deck is not sitting on its own surface`);
  // R7 -- the walk is finite and the steps are reachable
  if (seen.size < 2) fails.push(`the ArrowRight walk visited ${seen.size} state(s) -- navigation is dead`);
  if (!sawStepped) fails.push('no [data-step] was found on any slide -- step reveal is declared by the skeleton and absent from the deck');

  await b.close();
  console.log(`walked ${seen.size} state(s): ${[...seen].join(' ')}`);
  if (fails.length) { fails.forEach(f => console.log(f)); process.exit(1); }
  process.exit(0);
}
main().catch(e => { console.error('render gate itself failed: ' + e.message); process.exit(2); });
