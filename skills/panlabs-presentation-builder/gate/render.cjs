#!/usr/bin/env node
// THE RENDER GATE (#209) -- what only a real browser can answer about a page
// the compiler already wrote.
//
//   node gate/render.cjs <built.html> [--out DIR]
//
// SIX RULERS, each a defect the eye does not reliably catch at 1600x900:
// content clipped past the stage's own edge, text under the type floor, a
// slide that leaves most of the projector dark, a request the network had to
// answer, a declared face that never painted, and a page number that moved.
// Every red names its own fix, same doctrine as compiler/audit.py -- the
// audit's rulers judge the SOURCE before a byte is written, these judge the
// PAGE after it exists, because none of the six is knowable without a real
// layout pass.
//
// A CONTACT SHEET IS WRITTEN NEXT TO THE INPUT ON EVERY RUN, red or green:
// one PNG tiling every slide, because a laudo answers "what is wrong" and a
// contact sheet answers "does this look like a deck" -- neither substitutes
// for the other.
//
// DEGRADES TO A NAMED SKIP WITHOUT CHROMIUM, and still exits 0: this command
// is invoked from a build a human is waiting on, and a missing browser is an
// environment fact, not a defect in the deck. A render that DOES run and
// finds red still exits 1 -- that is the render gate doing its job.
//
// gate/cdp.cjs is the whole of the browser dependency: zero npm packages,
// launched over Node's own WebSocket and fetch, against whatever Chromium
// `npx playwright install chromium` or `npx puppeteer browsers install
// chrome` left in the machine's cache.
'use strict';

const fs = require('fs');
const path = require('path');
const { launch, findChrome } = require('./cdp.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The two thresholds this ruler set enforces, named here because both are
// doctrine fixed by the spec, not something a render pass discovers:
// themes/base/tokens.css's own --type-floor is 2.2% of the stage height, and
// the minimum occupancy was calibrated against the kickoff deck that
// motivated the v2 (#207's grilling): slides at ~30% of the stage height
// read as half-empty on a projector, slides at 40% or more do not.
const TYPE_FLOOR_RATIO = 0.022;
const OCCUPANCY_MIN_RATIO = 0.40;

const NETWORK_ALLOWED = /^(file|data|blob|about|chrome):/;

// The CSS-wide generic families plus the "system font stack" idiom `base`
// writes today (system-ui, -apple-system, BlinkMacSystemFont, ...). None of
// these names a concrete face a browser could fail to embed, so the
// platform-font ruler has nothing to hold the render to when one of these is
// first in the stack -- it only fires once a theme (panlabs, #216) declares
// a literal face by name.
const GENERIC_FAMILY = /^(system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|sans-serif|serif|monospace|cursive|fantasy|math|-apple-system|blinkmacsystemfont)$/i;

// ---------------------------------------------------------------------
// Build a zero-arg evaluate() source that calls `fn` with `args` baked in as
// JSON literals. cdp.cjs's evaluate() always calls its source as a zero-arg
// IIFE, so the call itself has to be the thing with no free arguments left.
function evalCall(fn, ...args) {
  return `() => (${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`;
}

// ---------------------------------------------------------------------
// selectors, derived from the output's OWN <style> text rather than
// hand-maintained: a list that lives beside the theme's is a list that will
// drift from it, and the emitted page is already the one place the cascade
// actually resolved. Sliced before the first `@media` because the print/
// narrow-viewport blocks stage.html carries are never in force at the
// resolution this gate renders.
function deriveFontSelectors(html) {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  let css = styleMatch ? styleMatch[1].split('@media')[0] : '';
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const roles = { display: [], body: [], mono: [] };
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css))) {
    const [, selectorList, decl] = m;
    const trimmedSel = selectorList.trim();
    if (trimmedSel.startsWith('@')) continue;
    if (/:(before|after)\b/.test(selectorList)) continue;
    for (const role of Object.keys(roles)) {
      if (new RegExp(`font-family:\\s*var\\(--font-${role}\\)`).test(decl)) {
        for (const sel of selectorList.split(',').map((s) => s.trim()).filter(Boolean)) {
          roles[role].push(sel);
        }
      }
    }
  }
  for (const role of Object.keys(roles)) roles[role] = [...new Set(roles[role])];
  return roles;
}

// ---------------------------------------------------------------------
// in-page probes. Each is shipped across the wire by evalCall's `.toString()`
// (see its own comment) -- nothing outside a function's own body travels, so
// no helper is shared between them on the Node side.

function fontTokensFn() {
  const cs = getComputedStyle(document.documentElement);
  return {
    display: cs.getPropertyValue('--font-display').trim(),
    body: cs.getPropertyValue('--font-body').trim(),
    mono: cs.getPropertyValue('--font-mono').trim(),
  };
}

// Caller-driven, reload-free navigation: toggle `.is-current` exactly the
// way the page's own inline script does, without depending on that script's
// closed-over state -- this gate is measuring the page from OUTSIDE it.
function gotoSlideFn(n) {
  const slides = document.querySelectorAll('.slide');
  for (let i = 0; i < slides.length; i++) slides[i].classList.toggle('is-current', i === n);
  const readout = document.querySelector('[data-page-current]');
  if (readout) readout.textContent = String(n + 1);
  return slides.length;
}

// Everything computable from the live DOM once a slide is current: the
// stage's own box, the page number's box, and every leaf of real text inside
// the current slide -- an element with a direct, non-empty text node of its
// own, painted, and large enough to be more than a hairline.
function pageMeasureFn() {
  function describe(el) {
    if (el.id) return '#' + el.id;
    const cls = el.getAttribute('class') || '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls.trim().split(/\s+/).join('.') : '');
  }
  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }
  const stageEl = document.querySelector('.stage');
  const stage = stageEl ? rectOf(stageEl) : null;
  const pn = document.querySelector('.page-number');
  const pageNumber = pn ? rectOf(pn) : null;

  const leaves = [];
  const current = document.querySelector('.slide.is-current');
  if (current) {
    for (const el of current.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let ownText = '';
      for (const node of el.childNodes) if (node.nodeType === 3) ownText += node.textContent;
      if (!ownText.trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // SVG TEXT PAINTS AT ITS OWN SIZE TIMES ITS VIEWBOX'S SCALE, and
      // getComputedStyle only ever reports the first of the two (#213). A
      // chart label declaring 24px inside a box drawn at half scale reaches
      // the room at 12, and the type-floor ruler would have called it 24 and
      // passed it. getBoundingClientRect already accounts for the transform,
      // so only the font size needs the correction.
      //
      // IT IS INERT AT 1600x900 AND LOAD-BEARING EVERYWHERE ELSE. The chart's
      // box is a fixed fraction of the stage height, so its scale is the stage
      // height over 900 -- exactly 1 at the size this gate renders at, and
      // nothing else. Measure a deck at a taller stage and the uncorrected
      // reading falls under a floor that grew with the stage: a FALSE RED, on
      // text that is painting larger than it ever did.
      let scale = 1;
      if (el.ownerSVGElement && typeof el.getScreenCTM === 'function') {
        const m = el.getScreenCTM();
        if (m) {
          const area = Math.abs(m.a * m.d - m.b * m.c);
          if (area > 0) scale = Math.sqrt(area);
        }
      }
      leaves.push({
        sel: describe(el), rect: rectOf(el), fontSizePx: parseFloat(cs.fontSize) * scale,
      });
    }
  }
  return { stage, pageNumber, leaves };
}

// ---------------------------------------------------------------------
// the contact sheet. Composed INSIDE the page on an offscreen canvas so the
// browser's own PNG encoder does the work (canvas.toDataURL) -- Node has no
// built-in decoder or encoder and this file adds no dependency to get one.
function initSheetFn(totalW, totalH) {
  const c = document.createElement('canvas');
  c.width = totalW;
  c.height = totalH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, totalW, totalH);
  window.__panlabsSheet = c;
  window.__panlabsSheetCtx = ctx;
  return true;
}

function drawTileFn(pngB64, x, y, w, h, label) {
  return (async () => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + pngB64;
    await img.decode();
    const ctx = window.__panlabsSheetCtx;
    ctx.drawImage(img, x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = '#fafafa';
    ctx.font = '14px sans-serif';
    ctx.fillText(label, x + 6, y + 18);
    return true;
  })();
}

function finishSheetFn() {
  return window.__panlabsSheet.toDataURL('image/png');
}

async function composeContactSheet(b, slides) {
  const stage = (slides[0] && slides[0].dom.stage) || { width: 1600, height: 900 };
  const cols = Math.max(1, Math.ceil(Math.sqrt(slides.length)));
  const rows = Math.max(1, Math.ceil(slides.length / cols));
  const tileW = 480;
  const tileH = Math.max(1, Math.round((tileW * stage.height) / stage.width));
  const gap = 10;
  const totalW = cols * tileW + (cols + 1) * gap;
  const totalH = rows * tileH + (rows + 1) * gap;

  await b.evaluate(evalCall(initSheetFn, totalW, totalH));
  for (const s of slides) {
    const col = s.n % cols;
    const row = Math.floor(s.n / cols);
    const x = gap + col * (tileW + gap);
    const y = gap + row * (tileH + gap);
    // eslint-disable-next-line no-await-in-loop
    await b.evaluate(evalCall(drawTileFn, s.shotB64, x, y, tileW, tileH, String(s.n + 1)));
  }
  return b.evaluate(evalCall(finishSheetFn));
}

function writePngDataUrl(dataUrl, outPath) {
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
}

// ---------------------------------------------------------------------
// measureFile: one built page, walked slide by slide over one live Chromium
// session -- one navigation, because switching slides is a class toggle this
// page's own script already does, and a second navigation would be a second
// chance for the network-zero ruler to see a request nobody made twice.
async function measureFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const fontSelectors = deriveFontSelectors(html);
  const fileUrl = 'file://' + path.resolve(filePath);

  const b = await launch({ width: 1600, height: 900 });
  const requests = [];
  await b.gotoWatched(fileUrl, (url) => requests.push(url));

  const title = await b.evaluate('() => document.title');
  const fontTokens = await b.evaluate(evalCall(fontTokensFn));
  const total = await b.evaluate("() => document.querySelectorAll('.slide').length");
  if (!total) {
    await b.close();
    throw new Error('the page has no .slide element -- nothing for this gate to measure');
  }

  const slides = [];
  for (let n = 0; n < total; n++) {
    if (n > 0) await b.evaluate(evalCall(gotoSlideFn, n));       // eslint-disable-line no-await-in-loop
    await sleep(60);                                              // eslint-disable-line no-await-in-loop
    const dom = await b.evaluate(evalCall(pageMeasureFn));        // eslint-disable-line no-await-in-loop
    const roleFonts = {};
    for (const role of Object.keys(fontSelectors)) {
      const sels = fontSelectors[role];
      // eslint-disable-next-line no-await-in-loop
      roleFonts[role] = sels.length ? await b.platformFontsAll(sels.join(',')) : [];
    }
    const shotB64 = dom.stage ? await b.shot(dom.stage) : await b.shot();  // eslint-disable-line no-await-in-loop
    slides.push({ n, dom, roleFonts, shotB64 });
  }

  const sheetB64 = await composeContactSheet(b, slides);
  await b.close();
  return { file: path.basename(filePath), title, requests, fontTokens, slides, sheetB64 };
}

// ---------------------------------------------------------------------
// the rulers: each reads one measured bundle, returns a list of fixes (empty
// = green). Order matches the ticket's own: overflow, floor, occupancy,
// network, painted font, page number.

function rulerOverflow(m) {
  const fixes = [];
  const EPS = 1;
  for (const s of m.slides) {
    const st = s.dom.stage;
    if (!st) continue;
    for (const l of s.dom.leaves) {
      const r = l.rect;
      const over = {
        'left': st.x - r.x,
        'top': st.y - r.y,
        'right': (r.x + r.width) - (st.x + st.width),
        'bottom': (r.y + r.height) - (st.y + st.height),
      };
      const [edge, worst] = Object.entries(over).sort((a, b) => b[1] - a[1])[0];
      if (worst > EPS) {
        fixes.push(
          `slide ${s.n + 1}: shorten ${l.sel} or split the slide — it paints `
          + `${Math.round(worst)}px past the stage's own ${edge} edge, and the stage clips it `
          + 'with nothing to show for it'
        );
      }
    }
  }
  return fixes;
}

function rulerTypeFloor(m) {
  const fixes = [];
  for (const s of m.slides) {
    const st = s.dom.stage;
    if (!st) continue;
    const floor = st.height * TYPE_FLOOR_RATIO;
    for (const l of s.dom.leaves) {
      if (l.fontSizePx < floor - 0.5) {
        fixes.push(
          `slide ${s.n + 1}: raise ${l.sel} to at least ${floor.toFixed(1)}px — it paints at `
          + `${l.fontSizePx.toFixed(1)}px, under the floor themes/base/tokens.css names as `
          + '--type-floor (2.2% of the stage height)'
        );
      }
    }
  }
  return fixes;
}

function rulerOccupancy(m) {
  const fixes = [];
  for (const s of m.slides) {
    const st = s.dom.stage;
    if (!st) continue;
    if (!s.dom.leaves.length) {
      fixes.push(`slide ${s.n + 1}: give it a slot to fill — no visible text is on the stage, `
        + 'and an empty slide is not a slide');
      continue;
    }
    let top = Infinity;
    let bottom = -Infinity;
    for (const l of s.dom.leaves) {
      const r = l.rect;
      top = Math.min(top, Math.max(r.y, st.y));
      bottom = Math.max(bottom, Math.min(r.y + r.height, st.y + st.height));
    }
    const ratio = Math.max(0, bottom - top) / st.height;
    if (ratio < OCCUPANCY_MIN_RATIO - 0.001) {
      fixes.push(
        `slide ${s.n + 1}: give the slide more to say, or a bigger figure — content fills only `
        + `${(ratio * 100).toFixed(1)}% of the stage height, under the `
        + `${(OCCUPANCY_MIN_RATIO * 100).toFixed(0)}% floor calibrated against the kickoff deck `
        + 'that motivated the v2'
      );
    }
  }
  return fixes;
}

function rulerNetwork(m) {
  const fixes = [];
  for (const url of m.requests) {
    if (!NETWORK_ALLOWED.test(url)) {
      fixes.push(
        `drop whatever asked the network for ${url.slice(0, 90)}, or embed it as a data: URI `
        + 'instead — a deck with zero network dependency makes no request'
      );
    }
  }
  return fixes;
}

function firstFamily(stack) {
  return (stack.split(',')[0] || '').trim().replace(/^["']|["']$/g, '');
}

function bestFace(fontsArray) {
  // A node can report more than one face when the fallback and the real face
  // both drew glyphs (an accent missing from the subset) -- the face with
  // the most glyphs is the one that actually carried the text.
  let best = null;
  for (const fonts of fontsArray) {
    if (!fonts || !fonts.length) continue;
    const top = fonts.slice().sort((a, b) => b.glyphCount - a.glyphCount)[0];
    if (!best || top.glyphCount > best.glyphCount) best = top;
  }
  return best;
}

function rulerPlatformFont(m) {
  const fixes = [];
  for (const s of m.slides) {
    for (const role of Object.keys(m.fontTokens)) {
      const declared = m.fontTokens[role];
      if (!declared) continue;
      const name = firstFamily(declared);
      // A generic keyword (system-ui, sans-serif, ...) names no concrete
      // face a browser could fail to load -- this ruler has nothing to hold
      // the render to until a theme declares a literal one (panlabs, #216).
      if (!name || GENERIC_FAMILY.test(name)) continue;
      const face = bestFace(s.roleFonts[role] || []);
      if (!face) continue; // no painted text sampled for this role on this slide
      if (!face.isCustomFont || face.familyName.toLowerCase() !== name.toLowerCase()) {
        fixes.push(
          `slide ${s.n + 1}: embed "${name}" as a data: URI beside the theme, or fix its `
          + `@font-face — the theme declares it for --font-${role}, but ${face.glyphCount} `
          + `glyphs painted in "${face.familyName}" (isCustomFont=${face.isCustomFont}) instead, `
          + 'and the declared face never loaded'
        );
      }
    }
  }
  return fixes;
}

function rulerPageNumber(m) {
  const fixes = [];
  const withNum = m.slides.filter((s) => s.dom.pageNumber);
  if (!withNum.length) return fixes;
  const base = withNum[0];
  const EPS = 0.5;
  for (const s of withNum.slice(1)) {
    const p = s.dom.pageNumber;
    const b = base.dom.pageNumber;
    if (Math.abs(p.x - b.x) > EPS || Math.abs(p.y - b.y) > EPS) {
      fixes.push(
        `slide ${s.n + 1}: drop whatever moved the page number — it sits at `
        + `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) instead of (${b.x.toFixed(1)}, `
        + `${b.y.toFixed(1)}) like slide ${base.n + 1}, and it has to stay in the same corner `
        + 'on every slide'
      );
    }
  }
  return fixes;
}

const RULERS = [
  { name: 'box-overflow', headline: "no leaf paints past the stage's own edges", measure: rulerOverflow },
  { name: 'type-floor', headline: 'no leaf paints smaller than 2.2% of the stage height', measure: rulerTypeFloor },
  { name: 'occupancy', headline: 'every slide fills at least 40% of the stage height', measure: rulerOccupancy },
  { name: 'network-zero', headline: 'the deck makes no request the network has to answer', measure: rulerNetwork },
  { name: 'platform-font', headline: 'the face that painted is the one the theme declares', measure: rulerPlatformFont },
  { name: 'page-number', headline: 'the page number sits in the same place on every slide', measure: rulerPageNumber },
];
const BY_NAME = Object.fromEntries(RULERS.map((r) => [r.name, r.measure]));

function report(m, sheetPath) {
  const n = m.slides.length;
  const plural = n === 1 ? 'slide' : 'slides';
  const lines = [`── render · "${m.title}" · ${n} ${plural} · 1600×900`];
  let reds = 0;
  for (const r of RULERS) {
    const fixes = r.measure(m);
    if (fixes.length) reds += 1;
    lines.push(`   ${fixes.length ? '✗' : '✓'} ${r.name} · ${r.headline}`);
    for (const f of fixes) lines.push(`       | ${f}`);
  }
  lines.push(`   contact sheet · ${sheetPath}`);
  const total = `${RULERS.length} ruler${RULERS.length === 1 ? '' : 's'}`;
  lines.push(reds ? `   ${total}, ${reds} red` : `   ${total}, green`);
  return { text: lines.join('\n'), ok: reds === 0 };
}

// ---------------------------------------------------------------------
async function main(argv) {
  const input = argv.find((a) => !a.startsWith('--'));
  if (!input) {
    console.log('refused: give the built .html to measure -- node gate/render.cjs <built.html> [--out DIR]');
    return false;
  }
  if (!fs.existsSync(input)) {
    console.log(`refused: ${input} does not exist`);
    return false;
  }

  if (!findChrome()) {
    console.log(
      `── render · SKIP -- no Chromium on this machine; the ${RULERS.length} render rulers `
      + 'were not measured and no contact sheet was written. Install one to get render-time '
      + "verification (`npx playwright install chromium` or `npx puppeteer browsers install "
      + 'chrome`, or point CHROME_BIN at a binary) -- see gate/cdp.cjs.'
    );
    return true;
  }

  const outIdx = argv.indexOf('--out');
  const outDir = outIdx !== -1 && argv[outIdx + 1] ? argv[outIdx + 1] : path.dirname(path.resolve(input));
  fs.mkdirSync(outDir, { recursive: true });
  const stem = path.basename(input).replace(/\.html?$/i, '');
  const sheetPath = path.join(outDir, `${stem}.contact-sheet.png`);

  let m;
  try {
    m = await measureFile(input);
  } catch (e) {
    console.log(`── render · ${input} could not be rendered: ${e.message}`);
    return false;
  }

  writePngDataUrl(m.sheetB64, sheetPath);
  const { text, ok } = report(m, sheetPath);
  console.log(text);
  return ok;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((ok) => process.exit(ok ? 0 : 1))
    .catch((e) => { console.error(e.stack || e.message); process.exit(2); });
}

module.exports = {
  measureFile, report, RULERS, BY_NAME,
  deriveFontSelectors, evalCall,
  TYPE_FLOOR_RATIO, OCCUPANCY_MIN_RATIO, NETWORK_ALLOWED, GENERIC_FAMILY,
};
