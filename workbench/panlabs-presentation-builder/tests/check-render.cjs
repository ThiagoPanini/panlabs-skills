#!/usr/bin/env node
// THE RENDER GATE (#93/#157) -- what only a real browser can answer.
//
// Every family below is prototyped and its verdict recorded in
// gate-prototype/comment-93.md; this file is the shipped, corpus-proven
// form for the CURRENT engine (the scroll-narrative skeleton of #97/#113,
// not the paginated slide deck the prototype targeted). Two families in
// comment-93.md's table do NOT appear here, and both absences are written
// down rather than silent:
//
//   R4 (typographic scale, % of stage height) does not get born. Font-size
//   is architecturally unreachable from content by THREE independent,
//   already-shipped mechanisms: check-architecture.py's `no-generated-css`
//   family proves byte-for-byte that no `<style>` content can differ from
//   the frozen skeleton's own (so no per-presentation rule can ever set
//   font-size outside the skeleton's fixed `--k-*` scale tokens);
//   `engine/build.py`'s `_text()` refuses `style=`/`class=` in any text
//   field the model writes, and the only inline tag it allows (`<b>`) takes
//   no attributes; and `register.py`'s per-block scale overrides (`--nk`/
//   `--sk`) are fixed by the measurement doctrine, never derived from
//   argument.json. A render-time measurement of a value no input can ever
//   change would only ever re-confirm the skeleton's own constants -- it
//   cannot fail from anything this engine can produce, which is the same
//   standard `no-generated-css` already meets one layer earlier.
//
//   R7 (off-palette pixel area) and R11 (icon ink coverage) were tried in
//   the prototype and REJECTED there (comment-93.md: 99.45% on an inverted
//   deck; 7.5% vs 16.9%, no clean separation) -- they are not omitted here,
//   they were never alive to begin with.
//
// Two families here have NO equivalent in the prototype at all, because
// they were found afterwards, against the PDI-fidelity prototypes of #96
// and #105: a sibling line-count outlier (four cards close in five lines,
// the fifth becomes six, and nobody proofreads a line count) and a real
// stacking-order check (a decorative absolute layer with no declared
// z-index paints over in-flow content regardless of DOM order -- asked of
// the browser via `elementsFromPoint`, never deduced from the tree, because
// the deduced version was wrong in four of five candidates it was tried on).
//
// Zero npm dependencies: cdp.cjs is a ~180-line CDP client over Node's own
// WebSocket and fetch. The dependency this whole layer has is "a Chromium
// binary on disk", which is what makes the SKIP path below honest.
//
// CLI: node check-render.cjs --corpus DIR   (DIR holds the built *.html;
// run.sh's layer 1 is what builds it -- this file never builds its own
// corpus, unlike its Python siblings, because a render pass is heavy enough
// that "build it for me" would hide how expensive re-running it is).
'use strict';

const fs = require('fs');
const path = require('path');
const { launch, findChrome } = require('./cdp.cjs');

// ---------------------------------------------------------------------
// constants the frozen skeleton makes true; see skills/panlabs-presentation-
// builder/engine/skeleton.html for the source of each.
// ---------------------------------------------------------------------
const DISPLAY_FAMILY = 'Panlabs Display';
const BODY_FAMILY = 'Panlabs Body';
const SURFACE_HEX = '#141415';

// `ok-overlap` is register.py's HOOKS entry: "a class that carries no style
// and exists only for a measurer to read." build.py's `parts()` already
// stamps it on the ghost ordinal (`.nn`) that sits, by design, on top of a
// card's own title -- this family is the measurer that hook was written
// for. Read it, never reinvent the rule it names.
const OK_OVERLAP = 'ok-overlap';

// Discovered running this file's own R5 against the real corpus (#157): the
// step ordinal (`.b-steps .r .k`) and the quote's oversized ghost glyph
// (`.b-quote .qm`) both paint in `var(--card)` on `var(--surface)` --
// ~1.3:1, deliberately under the legibility floor, because neither is meant
// to be read (a muted numeral, a background quotation mark the real quote
// text sits in front of). Flagging either would report the design as the
// defect. Local to this file: no other family needs it, so it is not a
// second shared hook.
const LEGIBILITY_EXEMPT = '.b-quote .qm, .b-steps .r .k';

// register.py's INLINE tuple: the only inline tag content may carry. A run
// of `<b>` inside a paragraph has its own direct text node, so a naive walk
// of "every element with its own text" double-counts it as a second leaf
// nested inside the first -- harmless for most families, but it corrupts a
// legibility box (the tight span around three bold words samples its own
// ink as "background"). Excluded once, here, rather than worked around in
// every family that walks leaves.
const INLINE_TAGS = ['B'];

// ---------------------------------------------------------------------
function readCorpusFlag(argv) {
  const i = argv.indexOf('--corpus');
  if (i === -1 || !argv[i + 1]) {
    console.log('refused: no --corpus DIR given. This layer measures the '
      + 'bytes run.sh\'s layer 1 already built; it does not build its own '
      + '(a render pass is too heavy to hide behind a convenience default). '
      + 'Build the corpus (see run.sh) and pass --corpus DIR.');
    return null;
  }
  const dir = argv[i + 1];
  if (!fs.existsSync(dir)) {
    console.log(`refused: --corpus ${dir} does not exist`);
    return null;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
  if (!files.length) {
    console.log(`refused: --corpus ${dir} has no .html -- an empty corpus is `
      + 'a green that measured nothing');
    return null;
  }
  return files.map((f) => path.join(dir, f));
}

// Build a zero-arg evaluate() source that calls `fn` with `args` baked in as
// JSON literals. cdp.cjs's evaluate() always calls its source as a zero-arg
// IIFE, so the call itself has to be the thing with no free arguments left.
function evalCall(fn, ...args) {
  return `() => (${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`;
}

// ---------------------------------------------------------------------
// selectors, derived from the output's OWN <style> text rather than
// hand-maintained: a list that can drift from the skeleton is a list that
// will, and the skeleton is already the one place these rules live. Sliced
// before the first `@media` because the two blocks at the end (a narrow
// viewport, print) are never in force at the 1600x900 this gate renders.
function deriveFontSelectors(html) {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  let css = styleMatch ? styleMatch[1].split('@media')[0] : '';
  // Comments can straddle a rule boundary (a `/* label */` line right before
  // a selector), and left in place they get captured as part of the
  // "selector" text below -- feeding `.foo, /* label */\n.bar` to
  // querySelectorAll is a syntax error, not a selector that matches nothing.
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const display = [];
  const body = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css))) {
    const [, selectorList, decl] = m;
    const trimmedSel = selectorList.trim();
    // At-rules (`@font-face`, `@keyframes`, ...) are not selectors: their
    // body can legitimately contain `font-family:'...'` as a declaration,
    // not a hook onto elements querySelectorAll can find.
    if (trimmedSel.startsWith('@')) continue;
    if (/:(before|after)\b/.test(selectorList)) continue;
    const declaresDisplay = decl.includes(`font-family:'${DISPLAY_FAMILY}'`);
    const declaresBody = decl.includes(`font-family:'${BODY_FAMILY}'`);
    if (!declaresDisplay && !declaresBody) continue;
    for (const sel of selectorList.split(',').map((s) => s.trim()).filter(Boolean)) {
      (declaresDisplay ? display : body).push(sel);
    }
  }
  return { display: [...new Set(display)], body: [...new Set(body)] };
}

// ---------------------------------------------------------------------
// the in-page probe: everything computable from the live DOM without a
// screenshot. Runs once per beat (`?still=1&only=N`), after cdp.cjs's own
// goto() has already waited for `document.fonts.ready` -- measuring before
// the embedded face decodes measures the fallback face on a page nobody
// will ever see rendered that way (#99).
function pageMeasure(legibilityExempt, okOverlapClass, inlineTags) {
  function describe(el) {
    if (el.id) return '#' + el.id;
    const cls = el.getAttribute('class') || '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls.trim().split(/\s+/).join('.') : '');
  }
  function isExempt(el) {
    return el.classList.contains(okOverlapClass) || el.matches(legibilityExempt);
  }
  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }
  function countLines(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set();
    for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top));
    return tops.size || 1;
  }

  // force every element hit-testable during measurement: a layer that
  // normally lets clicks pass through (`pointer-events:none`, e.g. the
  // texture, the decorative frame) would otherwise be invisible to
  // `elementsFromPoint` too, exactly hiding the class of defect #105 found
  // (a decorative layer painting over real content while being, by design,
  // unclickable). This is undone nowhere -- the page is discarded after.
  document.querySelectorAll('*').forEach((el) => { el.style.pointerEvents = 'auto'; });

  const leaves = [];
  for (const el of document.querySelectorAll('body *')) {
    if (inlineTags.includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    let ownText = '';
    for (const n of el.childNodes) if (n.nodeType === 3) ownText += n.textContent;
    if (!ownText.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    leaves.push({ el, sel: describe(el), rect: rectOf(el), exempt: isExempt(el), position: cs.position });
  }

  // R9 -- box collision. Normal flow cannot overlap without help (a
  // positioned element, or a negative margin); scoped to what can. The
  // ancestor/descendant guard is the one probe-corpus.cjs already proved
  // necessary (a card containing its own icon is not a collision).
  const positioned = leaves.filter((l) => l.position === 'absolute' || l.position === 'fixed' || l.position === 'sticky');
  const collisions = [];
  for (let i = 0; i < positioned.length; i++) {
    for (let j = i + 1; j < positioned.length; j++) {
      const a = positioned[i]; const b = positioned[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.exempt || b.exempt) continue;
      const ox = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const oy = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (ox > 2 && oy > 2) {
        collisions.push(`${a.sel} overlaps ${b.sel} by ${Math.round(ox)}x${Math.round(oy)}px`);
      }
    }
  }

  // R10 -- outline icon by declared slot. Every icon build.py emits is
  // `<svg class=ic><use href="#i-name"/></svg>`; the `<use>`'s shadow
  // content is not reachable from page JS, so this reads the fill/stroke
  // INHERITED onto the `.ic` root and its `<use>` child -- the contract a
  // stray CSS rule could actually break, not the referenced <symbol>'s own
  // attributes (already checked once, statically, by nothing needing to
  // change here: every <symbol> in the skeleton hardcodes
  // fill="none" stroke="currentColor" on itself, which wins inheritance
  // regardless). `.mark` is the reserved third-party-logo slot (#93/#156):
  // a legitimate brand mark is filled by nature and exempt by name.
  const iconViolations = [];
  for (const ic of document.querySelectorAll('.ic')) {
    if (ic.closest('.mark')) continue;
    const cs = getComputedStyle(ic);
    const solidFill = cs.fill !== 'none' && cs.fill !== 'rgba(0, 0, 0, 0)';
    const noStroke = cs.stroke === 'none' || cs.stroke === 'rgba(0, 0, 0, 0)';
    if (solidFill && noStroke) {
      iconViolations.push(`${describe(ic)} resolves fill=${cs.fill} stroke=${cs.stroke} -- `
        + 'the outline-icon contract is stroke, never fill, and nothing here declares it a mark');
    }
  }

  // the line-count family (#96): siblings of the SAME repeated block should
  // wrap to the same number of lines. No stored ceiling to compare against
  // (register.py's `ceil` is declarative, unenforced, and #158's ticket, not
  // this one) -- an outlier among siblings is the only signal this engine
  // makes available, and it is the exact shape #96 found: four cards close
  // in five lines, the fifth becomes six.
  const GROUPS = [
    ['.b-list', ':scope > .it', '.tx', 'list item'],
    ['.b-steps', ':scope > .r', '.p', 'step'],
    ['.b-pieces', ':scope > .pc', '.ct', 'part'],
    ['.b-mx', ':scope > .c', '.d', 'metric'],
  ];
  const lineGroups = [];
  for (const [blockSel, itemSel, textSel, label] of GROUPS) {
    for (const block of document.querySelectorAll(blockSel)) {
      const items = [...block.querySelectorAll(itemSel)];
      if (items.length < 2) continue;
      const counts = items.map((it) => {
        const t = it.querySelector(textSel);
        return t ? countLines(t) : null;
      }).filter((c) => c !== null);
      if (counts.length < 2) continue;
      if (new Set(counts).size > 1) {
        lineGroups.push(`${describe(block)}: ${counts.length} ${label}s wrap to `
          + `${counts.join(', ')} lines -- not all the same, and a line count is `
          + 'not something anyone proofreads by eye');
      }
    }
  }

  // the stacking family (#105): ask the browser who is actually on top,
  // sampled at the real glyph rects of each leaf's OWN direct text (not the
  // padded box, which can be mostly whitespace) -- never deduced from
  // `position`/`z-index` in the tree, which is the version #105 tried first
  // and which was wrong on four candidates out of five.
  const stackViolations = [];
  for (const leaf of leaves) {
    if (leaf.exempt) continue;
    for (const node of leaf.el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue;
        const x = r.left + r.width / 2; const y = r.top + r.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const stack = document.elementsFromPoint(x, y);
        const top = stack[0];
        if (top && top !== leaf.el && !leaf.el.contains(top) && !isExempt(top)) {
          stackViolations.push(`${describe(top)} paints on top of ${leaf.sel} `
            + `("${node.textContent.trim().slice(0, 24)}") at (${Math.round(x)},${Math.round(y)}) `
            + '-- real content is covered by another layer');
        }
      }
    }
  }

  const fontErrors = [...document.fonts]
    .filter((f) => f.status === 'error')
    .map((f) => `@font-face ${f.family} ${f.weight} never loaded (status=error) -- the deck is painting a fallback face`);

  const textBoxes = leaves.filter((l) => !l.exempt).map((l) => ({
    sel: l.sel, x: l.rect.left, y: l.rect.top, w: l.rect.width, h: l.rect.height,
  }));
  const chartBoxes = [...document.querySelectorAll('svg.chart')].map((s) => {
    const r = s.getBoundingClientRect();
    return { sel: describe(s), x: r.left, y: r.top, w: r.width, h: r.height };
  });

  return {
    collisions, iconViolations, lineGroups, stackViolations, fontErrors,
    textBoxes, chartBoxes, wholeFrame: { x: 0, y: 0, w: innerWidth, h: innerHeight },
  };
}

// ---------------------------------------------------------------------
// pixel analysis: decoded from the screenshot INSIDE the page (an offscreen
// canvas), never in Node, so this stays a zero-dependency client -- Node has
// no built-in PNG decoder and this repo does not add one for a test suite.
//
// The base64-to-canvas setup below is repeated verbatim in `bleedMeasure`.
// That is not an oversight: `evalCall` ships ONE function's source across
// the wire by calling `.toString()` on it (see its own comment), so a
// helper this function called would not exist in the page it runs in --
// only what is written INSIDE the function body travels. Deduplicating it
// into a shared Node-side helper would make `bleedMeasure` throw
// `ReferenceError` the moment it actually ran in a browser.
function pixelMeasure(pngB64, textBoxes, wholeFrame) {
  return (async () => {
    const img = new Image(); img.src = 'data:image/png;base64,' + pngB64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    function hist(x, y, w, h) {
      x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
      w = Math.min(c.width - x, Math.round(w)); h = Math.min(c.height - y, Math.round(h));
      if (w <= 0 || h <= 0) return [];
      const data = ctx.getImageData(x, y, w, h).data;
      const map = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const key = data[i] + ',' + data[i + 1] + ',' + data[i + 2];
        map.set(key, (map.get(key) || 0) + 1);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    }
    function lum(rgb) {
      const f = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
    }
    function contrast(a, b) {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    }
    function toHex(rgb) { return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join(''); }

    const textResults = textBoxes.map((tb) => {
      const h = hist(tb.x, tb.y, tb.w, tb.h);
      if (!h.length) return { sel: tb.sel, best: null };
      const bg = h[0][0].split(',').map(Number);
      let best = 1;
      for (const [k] of h.slice(1)) {
        const cr = contrast(bg, k.split(',').map(Number));
        if (cr > best) best = cr;
      }
      return { sel: tb.sel, best, bgHex: toHex(bg) };
    });

    let dominant = null;
    const wf = hist(wholeFrame.x, wholeFrame.y, wholeFrame.w, wholeFrame.h);
    if (wf.length) dominant = toHex(wf[0][0].split(',').map(Number));

    return { textResults, dominant };
  })();
}

// Release each chart's own UA-default clip (an <svg>'s viewBox boundary
// clips by default, verified live: a rect drawn past the viewBox painted
// zero pixels outside the svg's own box until `overflow:visible` was set on
// the element itself -- CSS `overflow` on the <svg> root is exactly the
// author-facing switch for that default).
function releaseChartOverflow() {
  document.querySelectorAll('svg.chart').forEach((s) => { s.style.overflow = 'visible'; });
  return 1;
}

// R8, pixel-measured: the box is not the ink (#93's own lesson -- a
// bounding box that crosses an edge without painting anything there is not
// a defect). Photograph a band past each edge, count what's painted there.
// Scoped to `svg.chart`: it is the only element in this engine with a real,
// silent clip -- `.viz`'s sticky band does not itself set `overflow`, and
// every other block sizes to its own content, so nothing else can lose
// content to a clip nobody sees.
//
// Called twice per beat (measureFile diffs the two): once BEFORE
// `releaseChartOverflow`, once after. A band past the chart's own edge is
// not empty space -- the block's own heading sits just above it, a caption
// often sits just below -- so counting painted pixels in a single
// after-only photograph flags that legitimate neighbour as "clipped
// content". Only pixels that turned on BECAUSE the clip was released are
// the chart's own overflow; that is the delta, not the raw percentage.
function bleedMeasure(pngB64, boxes, band) {
  return (async () => {
    const img = new Image(); img.src = 'data:image/png;base64,' + pngB64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    function paintedPct(x, y, w, h) {
      x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
      w = Math.min(c.width - x, Math.round(w)); h = Math.min(c.height - y, Math.round(h));
      if (w <= 0 || h <= 0) return 0;
      const data = ctx.getImageData(x, y, w, h).data;
      let n = 0; const total = data.length / 4;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 24 || data[i + 1] > 24 || data[i + 2] > 24) n++;
      return +(100 * n / total).toFixed(3);
    }
    const out = [];
    for (const box of boxes) {
      const edges = {
        top: [box.x, box.y - band - 1, box.w, band],
        bottom: [box.x, box.y + box.h + 1, box.w, band],
        left: [box.x - band - 1, box.y, band, box.h],
        right: [box.x + box.w + 1, box.y, band, box.h],
      };
      for (const [name, [x, y, w, h]] of Object.entries(edges)) {
        out.push({ sel: box.sel, edge: name, pct: paintedPct(x, y, w, h) });
      }
    }
    return out;
  })();
}

// ---------------------------------------------------------------------
async function measureFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const fontSelectors = deriveFontSelectors(html);
  const fileUrl = 'file://' + path.resolve(filePath);

  const b = await launch({ width: 1600, height: 900 });
  const requests = [];
  await b.send('Network.enable');
  b.onAny((m) => {
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
  });

  await b.goto(`${fileUrl}?still=1&only=1`);
  const total = await b.evaluate('() => document.querySelectorAll(".beat").length');

  const beats = [];
  for (let n = 1; n <= total; n++) {
    if (n > 1) await b.goto(`${fileUrl}?still=1&only=${n}`);
    const dom = await b.evaluate(evalCall(pageMeasure, LEGIBILITY_EXEMPT, OK_OVERLAP, INLINE_TAGS));
    const shot = await b.shot();
    const pix = await b.evaluate(evalCall(pixelMeasure, shot, dom.textBoxes, dom.wholeFrame));
    let bleed = [];
    if (dom.chartBoxes.length) {
      const before = await b.evaluate(evalCall(bleedMeasure, shot, dom.chartBoxes, 24));
      await b.evaluate(evalCall(releaseChartOverflow));
      const shot2 = await b.shot();
      const after = await b.evaluate(evalCall(bleedMeasure, shot2, dom.chartBoxes, 24));
      bleed = after
        .map((a, i) => ({ sel: a.sel, edge: a.edge, pct: +(a.pct - before[i].pct).toFixed(3) }))
        .filter((d) => d.pct > 0.2);
    }
    const displayFonts = fontSelectors.display.length
      ? await b.platformFontsAll(fontSelectors.display.join(',')) : [];
    const bodyFonts = fontSelectors.body.length
      ? await b.platformFontsAll(fontSelectors.body.join(',')) : [];
    beats.push({ n, dom, pix, bleed, displayFonts, bodyFonts });
  }
  await b.close();
  return { file: path.basename(filePath), requests, beats, total };
}

// ---------------------------------------------------------------------
// families: each takes the list of per-file measurement bundles, returns a
// list of failure messages (empty = green).
const NETWORK_ALLOWED = /^(file|data|blob|about|chrome):/;
function familyNetwork(files) {
  const out = [];
  for (const f of files) {
    for (const url of f.requests) {
      if (!NETWORK_ALLOWED.test(url)) {
        out.push(`${f.file}: the deck asked the network for ${url.slice(0, 90)} -- `
          + 'a deck with zero network dependency makes no request');
      }
    }
  }
  return out;
}

function bestFace(fontsArray) {
  // a node can report more than one face when the fallback and the real
  // face both drew glyphs (a hybrid: an accent missing from the subset) --
  // the face with the most glyphs is the one that actually carried the text.
  let best = null;
  for (const fonts of fontsArray) {
    if (!fonts || !fonts.length) continue;
    const top = fonts.slice().sort((a, b) => b.glyphCount - a.glyphCount)[0];
    if (!best || top.glyphCount > best.glyphCount) best = top;
  }
  return best;
}
function familyPlatformFont(files) {
  const out = [];
  for (const f of files) {
    for (const beat of f.beats) {
      for (const [fonts, expected] of [[beat.displayFonts, DISPLAY_FAMILY], [beat.bodyFonts, BODY_FAMILY]]) {
        for (const nodeFonts of fonts) {
          if (!nodeFonts || !nodeFonts.length) continue;
          const used = nodeFonts.slice().sort((a, b) => b.glyphCount - a.glyphCount)[0];
          if (used.familyName !== expected || !used.isCustomFont) {
            out.push(`${f.file} beat ${beat.n}: painted ${used.glyphCount} glyphs in `
              + `"${used.familyName}" (isCustomFont=${used.isCustomFont}), not the `
              + `embedded face "${expected}" -- getComputedStyle would have said `
              + `"${expected}" here regardless, which is exactly the illusion this `
              + 'family exists to see through');
          }
        }
      }
    }
  }
  return out;
}

function familyFontFaceError(files) {
  const out = [];
  for (const f of files) for (const beat of f.beats) {
    for (const msg of beat.dom.fontErrors) out.push(`${f.file} beat ${beat.n}: ${msg}`);
  }
  return out;
}

function familyLegibility(files) {
  const out = [];
  const NEED = 1.5;
  for (const f of files) for (const beat of f.beats) {
    for (const t of beat.pix.textResults) {
      if (t.best === null) continue;
      if (t.best < NEED) {
        out.push(`${f.file} beat ${beat.n}: ${t.sel} has no colour above ${t.best.toFixed(2)}:1 `
          + `against its own background ${t.bgHex} (needs ${NEED}:1) -- the text is not legible `
          + 'where it is painted');
      }
    }
  }
  return out;
}

function familySurfaceInversion(files) {
  const out = [];
  for (const f of files) {
    const dominants = f.beats.map((beat) => beat.pix.dominant).filter(Boolean);
    const onSurface = dominants.filter((d) => d.toLowerCase() === SURFACE_HEX.toLowerCase()).length;
    if (dominants.length && onSurface * 2 <= dominants.length) {
      out.push(`${f.file}: the surface token ${SURFACE_HEX} is the largest area in only `
        + `${onSurface} of ${dominants.length} states (dominants seen: `
        + `${[...new Set(dominants)].join(', ')}) -- the deck is not sitting on its own surface`);
    }
  }
  return out;
}

function familyClipped(files) {
  const out = [];
  for (const f of files) for (const beat of f.beats) {
    for (const b of beat.bleed) {
      out.push(`${f.file} beat ${beat.n}: ${b.pct}% of the band past the ${b.edge} edge of `
        + `${b.sel} only painted once its own clip was released -- content is clipped by `
        + 'the chart\'s own viewBox, not fitted to it');
    }
  }
  return out;
}

// Four families read one already-collected list off `beat.dom` and prefix
// each entry with where it came from; the shape is the family, `key` is the
// only thing that varies.
function fromDomList(files, key) {
  const out = [];
  for (const f of files) for (const beat of f.beats) {
    for (const v of beat.dom[key]) out.push(`${f.file} beat ${beat.n}: ${v}`);
  }
  return out;
}

function familyCollision(files) { return fromDomList(files, 'collisions'); }
function familyOutlineIcon(files) { return fromDomList(files, 'iconViolations'); }
function familyLineCount(files) { return fromDomList(files, 'lineGroups'); }
function familyStacking(files) { return fromDomList(files, 'stackViolations'); }

const FAMILIES = [
  ['network-zero', familyNetwork],
  ['platform-font', familyPlatformFont],
  ['font-face-error', familyFontFaceError],
  ['legibility-floor', familyLegibility],
  ['surface-inversion', familySurfaceInversion],
  ['clipped-content', familyClipped],
  ['box-collision', familyCollision],
  ['outline-icon', familyOutlineIcon],
  ['line-count', familyLineCount],
  ['stacking', familyStacking],
];

// ---------------------------------------------------------------------
async function main(argv) {
  const paths = readCorpusFlag(argv);
  if (!paths) return false;

  if (!findChrome()) {
    // The wording is deliberate, per the ticket: not "render not measured",
    // which names nothing, but the one premise the static gate is provably
    // unable to cover on its own -- #93 planted a deck that assembles its
    // request URL from character codes at runtime, no literal URL in the
    // file, and the regex guard passed it clean while the browser made the
    // request.
    console.log('SKIP: no Chromium on this machine -- the render gate degrades '
      + 'instead of blocking, but premise 4 (zero network at runtime) was NOT '
      + 'verified this run. The static guard for it is provably incomplete (a '
      + 'URL assembled from character codes at runtime never appears as a '
      + 'literal for any regex to catch), and it is the only guard standing '
      + `in for it here. The other ${FAMILIES.length - 1} render families were `
      + 'not measured either.');
    return true;
  }

  console.log('render:');
  const files = [];
  for (const p of paths) files.push(await measureFile(p));

  let ok = true;
  for (const [name, fn] of FAMILIES) {
    const fails = fn(files);
    if (fails.length) {
      ok = false;
      console.log(`  FAIL ${name}`);
      for (const m of fails) console.log(`    - ${m}`);
    } else {
      console.log(`  ok   ${name}`);
    }
  }
  return ok;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((ok) => process.exit(ok ? 0 : 1))
    .catch((e) => { console.error(e.stack || e.message); process.exit(2); });
}

module.exports = {
  FAMILIES, BY_NAME: Object.fromEntries(FAMILIES),
  measureFile, pageMeasure, pixelMeasure, bleedMeasure, releaseChartOverflow,
  deriveFontSelectors, evalCall, readCorpusFlag,
  DISPLAY_FAMILY, BODY_FAMILY, SURFACE_HEX, OK_OVERLAP, LEGIBILITY_EXEMPT, INLINE_TAGS,
};
