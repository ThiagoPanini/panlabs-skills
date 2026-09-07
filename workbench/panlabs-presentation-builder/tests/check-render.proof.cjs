#!/usr/bin/env node
// THE PROOF. Plant one defect per ruler and demand it goes red -- four
// assertions each, ADR 0001's standard.
//
//   node check-render.proof.cjs --corpus DIR    # the .html run.sh's layer 1 wrote
//
// EVERY PLANT WRITES TO A TEMP FILE, NEVER THE TRACKED TREE. gate/render.cjs
// measures a real `file://` URL through an actual Chromium; there is no
// in-memory equivalent the way check-audit.proof.py's source mutations have,
// so "plant a defect" here means "take the real built page's bytes, mutate
// them, write the copy to `os.tmpdir()`, point a fresh measureFile() at it,
// delete the directory when done." This repository has already paid for a
// review agent that planted its defect in the real worktree instead
// (docs/agents/ § sub-agente de revisão muta a árvore).
//
// THE PLANTS MUTATE THE BUILT PAGE, NOT THE DIALECT SOURCE. The render gate's
// own contract is "a built .html file", never a `.deck.html` source -- the
// compiler's vocabulary ruler already owns everything reachable through the
// dialect (check-audit.proof.py), and a render-time defect (an <img> nobody
// wrote in the dialect, a page number nudged by a same-origin stylesheet
// override) is exactly the class of thing that can only ever reach a built
// page by surviving past the compiler, which is the reason this gate exists
// standing beside the audit rather than folded into it.
//
// THE GREEN CONTROL IS MEASURED EXACTLY ONCE. Six rulers sharing one
// Chromium pass over the real corpus is the same corpus gate/render.cjs
// itself would measure; re-launching a browser per case to re-derive a
// result that cannot change between cases would only make the proof slow
// for no assertion gained.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Drifted, Proof } = require('./proof_driver.cjs');

const HERE = __dirname;
const SKILL = path.resolve(HERE, '..', '..', '..', 'skills', 'panlabs-presentation-builder');
const gate = require(path.join(SKILL, 'gate', 'render.cjs'));
const { findChrome } = require(path.join(SKILL, 'gate', 'cdp.cjs'));

let REAL_PATH = null;
let REAL_HTML = null;

function _real() {
  return REAL_HTML;
}

// ONE RETRY, around the whole browser pass -- the same margin
// check-render.proof.cjs's v1 ancestor gave itself (#157): a dropped
// WebSocket frame or a slow paint has nothing to do with the defect under
// test, and a real logic defect in the plant or the ruler fails the same
// way twice.
async function _measureWithRetry(filePath, attempt = 1) {
  try {
    return await gate.measureFile(filePath);
  } catch (e) {
    if (attempt >= 2) throw e;
    return _measureWithRetry(filePath, attempt + 1);
  }
}

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
// 1 - box-overflow
// --------------------------------------------------------------------------
// THE SLOT'S OWN OPENING TAG IS KEPT, WHATEVER IT SAYS. The compiler decides
// what travels on a slot besides its class -- #210 put `data-role` there, and
// the stage sets the type size from it -- so a plant that rewrote the tag
// would be planting a defect into a paragraph the theme no longer styles. 200
// words at body size fit the stage; at display size they do not, and the
// second is the deck this ruler exists to refuse.
const STATEMENT = /<p class="statement"[^>]*>[\s\S]*?<\/p>/;

function _restate(html, text, what) {
  const m = html.match(STATEMENT);
  if (!m) throw new Drifted(`no <p class="statement" …> found to ${what}`);
  const open = m[0].slice(0, m[0].indexOf('>') + 1);
  return html.replace(m[0], `${open}${text}</p>`);
}

function plantOverflowWords() {
  const words = Array.from({ length: 200 }, (_, i) => `palavra${i + 1}`).join(' ');
  return _restate(_real(), words, 'overflow');
}

// --------------------------------------------------------------------------
// 2 - type-floor
// --------------------------------------------------------------------------
function plantTinyLabel() {
  const html = _real();
  const idx = html.indexOf('</section>');
  if (idx === -1) throw new Drifted('no </section> found to plant a label before');
  const tag = '<p style="font-size:11px">Rótulo pequeno</p>';
  return html.slice(0, idx) + tag + html.slice(idx);
}

// --------------------------------------------------------------------------
// 3 - occupancy
// --------------------------------------------------------------------------
function plantSparseSlide() {
  return _restate(_real(), 'Oi.', 'shrink');
}

// --------------------------------------------------------------------------
// 4 - network-zero
// --------------------------------------------------------------------------
function plantNetworkRequest() {
  const html = _real();
  if (!/<body[^>]*>/.test(html)) throw new Drifted('no <body> to plant a request after');
  // Loopback, closed port: refused by the OS almost instantly -- no DNS, no
  // external routing, no multi-second timeout to wait out -- and CDP still
  // logs the request the moment Chromium decides to make it, well before
  // the refusal comes back.
  const tag = '<img src="http://127.0.0.1:1/probe.png">';
  return html.replace(/(<body[^>]*>)/, `$1${tag}`);
}

// --------------------------------------------------------------------------
// 5 - platform-font
// --------------------------------------------------------------------------
function plantFontFallback() {
  const html = _real();
  if (!html.includes('</style>')) throw new Drifted('no </style> to plant an override before');
  // A LATER `:root{--font-display:...}` wins the cascade over the theme's
  // own without touching it -- the literal name is what makes the ruler
  // stop skipping the role (system-ui, base's own first choice, is generic
  // and nothing to hold a render to).
  return html.replace('</style>', ':root{--font-display:"Plant Fake Face",system-ui,sans-serif}</style>');
}

// --------------------------------------------------------------------------
// 6 - page-number
// --------------------------------------------------------------------------
function plantMovingPageNumber() {
  const html = _real();
  const m = html.match(/<section class="slide is-current"[\s\S]*?<\/section>/);
  if (!m) throw new Drifted('no <section class="slide is-current"> found to duplicate');
  if (!html.includes('</style>')) throw new Drifted('no </style> to plant an override before');
  const second = m[0]
    .replace('class="slide is-current"', 'class="slide"')
    .replace('aria-label="slide 1"', 'aria-label="slide 2"');
  const withSecondSlide = html.replace(m[0], m[0] + second);
  // Targets the SECOND <section> specifically, and only while it is current
  // -- a hypothetical pattern's own rule nudging the shared footer out of
  // its corner, exactly the class of drift the ruler exists to catch.
  const rule = '.slide:nth-of-type(2).is-current ~ .page-number{right:30%;bottom:30%}';
  return withSecondSlide.replace('</style>', `${rule}</style>`);
}

// The asserted phrase is always the FIX and never the diagnosis, same rule
// proof_driver.py/check-audit.proof.py already spend: "under the 40% floor"
// is a diagnosis and leaves the reader to guess what to do; "give the slide
// more to say" is the repair.
// (ruler, what is planted, the plant, the fact the red must carry)
const CASES = [
  ['box-overflow', 'replaces the statement with a 200-word sentence',
    plantOverflowWords, 'split the slide'],

  ['type-floor', 'plants an 11px label inside the slide',
    plantTinyLabel, 'raise'],

  ['occupancy', 'shrinks the statement down to two words',
    plantSparseSlide, 'give the slide more to say'],

  ['network-zero', 'adds an <img> pointed at a closed local port',
    plantNetworkRequest, 'drop whatever asked the network'],

  ['platform-font', 'overrides --font-display with a face nothing embeds',
    plantFontFallback, 'fix its @font-face'],

  ['page-number', 'duplicates the slide and moves the footer on the second one',
    plantMovingPageNumber, 'drop whatever moved the page number'],
];

async function main(argv) {
  const idx = argv.indexOf('--corpus');
  if (idx === -1 || !argv[idx + 1]) {
    console.log('refused: no --corpus DIR given. This proof plants defects onto the built '
      + 'page run.sh\'s layer 1 already wrote; it does not build its own. Pass --corpus DIR.');
    return 1;
  }
  const dir = argv[idx + 1];
  if (!fs.existsSync(dir)) {
    console.log(`refused: --corpus ${dir} does not exist`);
    return 1;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
  if (!files.length) {
    console.log(`refused: --corpus ${dir} has no .html -- an empty corpus is a green that measured nothing`);
    return 1;
  }

  if (!findChrome()) {
    console.log('render.proof:  SKIP -- no Chromium on this machine, the same degrade '
      + 'gate/render.cjs itself takes. A proof of a check that cannot run measures nothing '
      + 'either way.');
    return 0;
  }

  // THE PLANTS PICK THE PAGE, NOT THE ALPHABET. Two of the six rewrite the
  // deck's own statement to make their defect, so the page measured here has
  // to be one that HAS a statement slot. It used to be `files[0]`, which was
  // the right file only while the corpus held a single deck: #210 added a
  // second example, the sort handed this proof a page with no statement in
  // it, and both cases went red as "fixture drifted" -- the proof catching
  // its own rot, and this is the fix it asked for.
  const carries = (f) => fs.readFileSync(path.join(dir, f), 'utf8').match(STATEMENT);
  const chosen = files.find(carries);
  if (!chosen) {
    console.log(`refused: build a source with a full-bleed-statement slide into `
      + `--corpus ${dir} -- two of these plants rewrite the deck's own statement `
      + 'to make their defect, and no built page there carries a '
      + '<p class="statement" …> for them to plant into');
    return 1;
  }

  REAL_PATH = path.join(dir, chosen);
  REAL_HTML = fs.readFileSync(REAL_PATH, 'utf8');

  let GREEN;
  try {
    GREEN = await _measureWithRetry(REAL_PATH);
  } catch (e) {
    return new Proof({ title: 'render.proof' }).refuse(`could not measure the real corpus: ${e.message}`);
  }

  function summarize(fails) {
    const uniq = [...new Set(fails)];
    const shown = uniq.slice(0, 3).join(' | ');
    return uniq.length > 3 ? `${shown} (+${uniq.length - 3} more)` : shown;
  }

  const PROOF = new Proof({
    title: 'render.proof',
    label: (ruler) => ruler,
    invoke: async (ruler, html) => {
      const measured = await _measurePlanted(html);
      const fails = gate.BY_NAME[ruler](measured);
      return [fails.length === 0, summarize(fails) || '(no message)'];
    },
    planted: (html) => html !== REAL_HTML,
    control: async (ruler) => {
      const fails = gate.BY_NAME[ruler](GREEN);
      return [fails.length === 0, summarize(fails)];
    },
  });

  let bad = await PROOF.run(CASES);

  const covered = new Set(CASES.map((c) => c[0]));
  const uncovered = gate.RULERS.map((r) => r.name).filter((n) => !covered.has(n));
  if (uncovered.length) {
    console.log(`  FAIL coverage            no defect planted for: ${uncovered.join(', ')}. `
      + 'Add a case to CASES for each');
    bad += 1;
  } else {
    console.log(`  ok   coverage            ${CASES.length} planted defects over all `
      + `${gate.RULERS.length} rulers, against the real corpus`);
  }
  return bad;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((bad) => process.exit(bad ? 1 : 0))
    .catch((e) => { console.error(e.stack || e.message); process.exit(2); });
}

module.exports = { main };
