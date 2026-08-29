#!/usr/bin/env node
// THE PROOF. Plant one defect per red and demand it -- four assertions each.
//
//   node check-render.proof.cjs --corpus DIR    # the .html the suite wrote
//
// The standard is ADR 0001's, restated by `proof_driver.cjs` (a Node port of
// `proof_driver.py` -- Node cannot import a Python module, and #97/#156's own
// proofs already refused to keep a second COPY of the same four assertions,
// which is the reason a PORT exists instead of a third divergent driver) and
// already spent by `check-static.proof.py`/`check-architecture.proof.py`:
// planted / red / message / green, per red, not per family.
//
// EVERY PLANT WRITES TO A TEMP FILE, NEVER THE TRACKED TREE. check-render.cjs
// measures a real `file://` URL through an actual Chromium; there is no
// in-memory equivalent the way `check-static.py`'s regex families have, so
// "plant a defect" here means "copy the real corpus file's bytes, mutate
// them, write the copy to `os.tmpdir()`, point a fresh `measureFile()` at
// it, delete the directory when done." This repository has already paid for
// a review agent that planted its defect in the real worktree instead.
//
// THE GREEN CONTROL IS MEASURED EXACTLY ONCE. Ten families sharing one
// Chromium pass over the real corpus is the same corpus `check-render.cjs`
// itself would measure; re-launching a browser per case to re-derive a
// result that cannot change between cases would only make the proof slow
// for no assertion gained.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Drifted, Proof } = require('./proof_driver.cjs');
const gate = require('./check-render.cjs');
const { findChrome } = require('./cdp.cjs');

let REAL_PATH = null;
let REAL_HTML = null;

function _real() {
  return REAL_HTML;
}

// ONE RETRY, around the whole browser pass. Eleven launches in one run (ten
// cases plus the green baseline) is eleven chances for a transient CDP
// hiccup under load -- a dropped WebSocket frame, a slow paint -- that has
// nothing to do with the defect under test. A retry absorbs that without
// weakening any of the four assertions: a REAL logic defect in the plant or
// the family fails the same way twice.
async function _measureWithRetry(filePath, attempt = 1) {
  try {
    return await gate.measureFile(filePath);
  } catch (e) {
    if (attempt >= 2) throw e;
    return _measureWithRetry(filePath, attempt + 1);
  }
}

// The one shape every plant below returns: the real file's bytes, with a
// defect mutated in. Measured by copying it into a throwaway directory --
// `measureFile` needs a real `file://` URL, and the tracked corpus is never
// the thing a plant is allowed to touch.
async function _measurePlanted(html) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'panlabs-render-proof-'));
  const tmpFile = path.join(dir, path.basename(REAL_PATH));
  fs.writeFileSync(tmpFile, html);
  try {
    return await _measureWithRetry(tmpFile);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --------------------------------------------------------------------------
// 1 - network-zero
// --------------------------------------------------------------------------
function plantNetworkRequest() {
  const html = _real();
  if (!/<body[^>]*>/.test(html)) throw new Drifted('no <body> to plant a request after');
  // Loopback, closed port: the connection is refused by the OS almost
  // instantly (no external routing, no DNS, no multi-second timeout to
  // wait out) -- the request is still logged by CDP the moment Chromium
  // decides to make it, well before the refusal comes back.
  const tag = '<img src="http://127.0.0.1:1/probe.png">';
  return html.replace(/(<body[^>]*>)/, `$1${tag}`);
}

// --------------------------------------------------------------------------
// 2 - platform-font
// --------------------------------------------------------------------------
function plantFontFallback() {
  const html = _real();
  // The ORIGINAL `.disp{font-family:'Panlabs Display'...}` rule is left
  // standing on purpose: `deriveFontSelectors` finds `.disp` BY that
  // declaration, so rewriting it away would erase the very selector the
  // check needs to know to measure -- exactly the false "stayed GREEN" a
  // first draft of this plant produced. A LATER, `!important` rule wins the
  // cascade without touching the declaration the selector list is derived
  // from.
  const needle = `.disp{font-family:'${gate.DISPLAY_FAMILY}'`;
  if (!html.includes(needle)) throw new Drifted(`no ${JSON.stringify(needle)} rule found`);
  if (!html.includes('</style>')) throw new Drifted('no </style> to plant an override before');
  return html.replace('</style>', '.disp{font-family:sans-serif!important}</style>');
}

// --------------------------------------------------------------------------
// 3 - font-face-error
// --------------------------------------------------------------------------
const B64 = /base64,([A-Za-z0-9+/=]{100,})/d;
function plantFontTruncated() {
  const html = _real();
  const m = html.match(B64);
  if (!m) throw new Drifted('no embedded base64 font found');
  const [start, end] = m.indices[1];
  const b64 = html.slice(start, end);
  if (b64.length < 200) throw new Drifted('the first font is too small to truncate meaningfully');
  return html.slice(0, start) + b64.slice(0, -40) + html.slice(end);
}

// --------------------------------------------------------------------------
// 4 - legibility-floor
// --------------------------------------------------------------------------
function plantIllegibleText() {
  const html = _real();
  if (!html.includes('</style>')) throw new Drifted('no </style> to plant a rule before');
  return html.replace('</style>', `.beat .cl{color:${gate.SURFACE_HEX}}</style>`);
}

// --------------------------------------------------------------------------
// 5 - surface-inversion
// --------------------------------------------------------------------------
function plantSurfaceOverride() {
  const html = _real();
  // `body{background:...}` alone stayed GREEN: `.viz` (the sticky
  // visualisation panel) paints ITS OWN `background:var(--surface)` over
  // roughly half the viewport regardless of what `body` resolves to, so
  // overriding only `body` never moves the dominant colour enough to flip
  // the family. The token itself is the thing every one of those rules
  // reads, so redefining `--surface` is what actually changes what is
  // dominant everywhere at once -- and it is the shape of drift this family
  // exists to catch: not a stray colour, a design TOKEN that stopped
  // meaning what its name says.
  if (!html.includes('</style>')) throw new Drifted('no </style> to plant a rule before');
  return html.replace('</style>', ':root{--surface:#39ff14}</style>');
}

// --------------------------------------------------------------------------
// 6 - clipped-content
// --------------------------------------------------------------------------
function plantChartOverflow() {
  const html = _real();
  const m = html.match(/<svg class="chart"[^>]*>/);
  if (!m) throw new Drifted('no svg.chart found to plant overflow into');
  const at = m.index + m[0].length;
  // `bleedMeasure` only scans a 24-SCREEN-px band past each edge, and the
  // viewBox-to-screen scale this engine renders at is roughly 5px per
  // viewBox unit -- a rect placed 30 viewBox units above y=0 lands about
  // 150 screen px out, well clear of the 24px band the check actually
  // photographs, and reddens nothing. Two viewBox units above the edge
  // stays inside it regardless of small scale drift.
  const rect = '<rect x="10" y="-3" width="20" height="2" fill="#ffffff"/>';
  return html.slice(0, at) + rect + html.slice(at);
}

// --------------------------------------------------------------------------
// 7 - box-collision
// --------------------------------------------------------------------------
function plantCollision() {
  const html = _real();
  if (!/<body[^>]*>/.test(html)) throw new Drifted('no <body> to plant a collision after');
  const tags = '<div style="position:fixed;top:400px;left:400px;width:220px;height:80px;'
    + 'background:#fff;color:#000">Alpha ghost text</div>'
    + '<div style="position:fixed;top:420px;left:420px;width:220px;height:80px;'
    + 'background:#fff;color:#000">Beta ghost text</div>';
  return html.replace(/(<body[^>]*>)/, `$1${tags}`);
}

// --------------------------------------------------------------------------
// 8 - outline-icon
// --------------------------------------------------------------------------
function plantSolidIcon() {
  const html = _real();
  if (!/<body[^>]*>/.test(html)) throw new Drifted('no <body> to plant a solid icon after');
  const tag = '<svg class="ic" style="fill:#ff0000;stroke:none;width:20px;height:20px">'
    + '<rect width="20" height="20"/></svg>';
  return html.replace(/(<body[^>]*>)/, `$1${tag}`);
}

// --------------------------------------------------------------------------
// 9 - line-count
// --------------------------------------------------------------------------
function plantLineCountOutlier() {
  const html = _real();
  if (!/<body[^>]*>/.test(html)) throw new Drifted('no <body> to plant a line-count outlier after');
  const block = '<div class="b-list">'
    + '<div class="it"><span class="tx" style="display:block;max-width:12ch">Short.</span></div>'
    + '<div class="it"><span class="tx" style="display:block;max-width:12ch">This line is '
    + 'deliberately long enough that it wraps onto several visual rows.</span></div>'
    + '</div>';
  return html.replace(/(<body[^>]*>)/, `$1${block}`);
}

// --------------------------------------------------------------------------
// 10 - stacking
// --------------------------------------------------------------------------
function plantStackingOverlay() {
  const html = _real();
  if (!html.includes('</body>')) throw new Drifted('no </body> to plant an overlay before');
  // No text of its own (so it never becomes a leaf itself, and plants
  // exactly one kind of defect), last in the DOM, an outrageous z-index --
  // covers everything else in the page's root stacking context regardless
  // of where in the corpus the real content sits.
  const overlay = '<div style="position:fixed;inset:0;z-index:999999"></div>';
  return html.replace('</body>', `${overlay}</body>`);
}

// (family, what is planted, the plant, the fact the red must carry)
const CASES = [
  ['network-zero', 'adds an <img> pointed at a real host',
    plantNetworkRequest, 'zero network dependency makes no request'],

  ['platform-font', "redirects .disp's font-family away from the embedded face",
    plantFontFallback, 'not the embedded face'],

  ['font-face-error', "truncates the first embedded font's base64 by 30 bytes",
    plantFontTruncated, 'never loaded'],

  ['legibility-floor', 'colours a claim the same as its own surface',
    plantIllegibleText, 'not legible'],

  ['surface-inversion', 'overrides body{background} to a colour off the palette',
    plantSurfaceOverride, 'not sitting on its own surface'],

  ['clipped-content', "plants a rect above svg.chart's own viewBox",
    plantChartOverflow, "clipped by the chart's own viewbox"],

  ['box-collision', 'plants two overlapping fixed-position text boxes',
    plantCollision, 'overlaps'],

  ['outline-icon', 'plants a .ic with a solid fill and no stroke',
    plantSolidIcon, 'the outline-icon contract is stroke, never fill'],

  ['line-count', 'plants a .b-list whose two items wrap to different line counts',
    plantLineCountOutlier, 'not something anyone proofreads by eye'],

  ['stacking', 'plants a full-viewport layer on top of everything',
    plantStackingOverlay, 'covered by another layer'],
];

async function main(argv) {
  const paths = gate.readCorpusFlag(argv);
  if (!paths) return 1;

  if (!findChrome()) {
    console.log('render.proof:  SKIP -- no Chromium on this machine, the same '
      + 'degrade check-render.cjs itself takes. A proof of a check that '
      + 'cannot run measures nothing either way.');
    return 0;
  }

  [REAL_PATH] = paths;
  REAL_HTML = fs.readFileSync(REAL_PATH, 'utf8');

  let greenFiles;
  try {
    greenFiles = [await _measureWithRetry(REAL_PATH)];
  } catch (e) {
    return new Proof({ title: 'render.proof' }).refuse(`could not measure the real corpus: ${e.message}`);
  }

  // Distinct messages only, and capped: a defect that reads the same on
  // every one of thirteen beats (a stray <img>, say) is one fact, not
  // thirteen, and the mustSay check below only needs ONE of them to carry
  // the fix -- checking fails[0] alone made the assertion depend on which
  // beat happened to be measured first, which is exactly what varied under
  // load.
  function summarize(fails) {
    const uniq = [...new Set(fails)];
    const shown = uniq.slice(0, 3).join(' | ');
    return uniq.length > 3 ? `${shown} (+${uniq.length - 3} more)` : shown;
  }

  const PROOF = new Proof({
    title: 'render.proof',
    label: (family) => family,
    invoke: async (family, html) => {
      const measured = await _measurePlanted(html);
      const fails = gate.BY_NAME[family]([measured]);
      return [fails.length === 0, summarize(fails) || '(no message)'];
    },
    planted: (html) => html !== REAL_HTML,
    control: async (family) => {
      const fails = gate.BY_NAME[family](greenFiles);
      return [fails.length === 0, summarize(fails)];
    },
  });

  let bad = await PROOF.run(CASES);

  const covered = new Set(CASES.map((c) => c[0]));
  const uncovered = gate.FAMILIES.map(([name]) => name).filter((n) => !covered.has(n));
  if (uncovered.length) {
    console.log(`  FAIL coverage            no defect planted for: ${uncovered.join(', ')}. `
      + 'Add a case to CASES for each');
    bad += 1;
  } else {
    console.log(`  ok   coverage            ${CASES.length} planted defects over all `
      + `${gate.FAMILIES.length} families, against the real corpus`);
  }
  return bad;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((bad) => process.exit(bad ? 1 : 0))
    .catch((e) => { console.error(e.stack || e.message); process.exit(2); });
}

module.exports = { main };
