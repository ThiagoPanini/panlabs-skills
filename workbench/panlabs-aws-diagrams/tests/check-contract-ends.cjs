#!/usr/bin/env node
'use strict';
/**
 * #125 — A CONTRACT KEY HAS TWO ENDS, AND HERE IS WHERE THE SECOND ONE IS RULED.
 *
 *   node tests/check-contract-ends.cjs
 *
 * `session/briefing.cjs` asked `policy(p.state)` for `.glifo`; `session/open.cjs`
 * had been returning `.glyph` since #53 converted the tree to English. Every page
 * of the resume briefing printed `undefined` where the state glyph belongs, and
 * the whole suite stayed green — it measures what the briefing SAYS, never the
 * character it says it with.
 *
 * The irony is written above the broken call, in `open.cjs`: *"The glyph lives
 * here with the rest. It used to sit in a loose table in the briefing, and a new
 * state would mean remembering two places — this is the only one that knows what
 * each state means."* Centralizing it removed the second place. Renaming one end
 * put it back.
 *
 * `check-guide-contract.cjs` rules the same class one document over: prose that
 * names a field the schema retired. THIS one rules the class that no schema and
 * no document can see — a key one `.cjs` WRITES and another `.cjs` READS, with
 * nothing in between to disagree with.
 *
 *   1  THE FOUR GLYPHS    the four page states `open()` can emit, driven through
 *                         the real `open()` on a real `.drawio`, each arriving in
 *                         the briefing as the glyph `policy()` declares for it.
 *   2  NOTHING IS UNDEFINED   no line of a briefing renders `undefined`,
 *                         `[object Object]` or `NaN`. The symptom, generalized:
 *                         this is what a dangling read looks like on the way out.
 *   3  EVERY READ HAS A WRITER   the sweep. Every key the skill's own sources
 *                         read — `x.key` and `const { key } = …` alike —
 *                         answers to something that writes `key`.
 *   4  CONTROL            each verdict, held against a planted defect.
 *
 * WHY VERDICT 1 IS NOT ENOUGH, AND VERDICT 3 EXISTS. Verdict 1 is a test of one
 * function: it goes red today and it stays honest forever, but it only ever knows
 * about `policy`. #53 converted 145 paths and 165 contract keys; the question the
 * ticket actually asks is *"did any OTHER end get left behind?"*, and that one is
 * answered by reading the tree, not by testing a function.
 *
 * WHY THE SWEEP IS NOT A WORDLIST. A curated list of Portuguese names would age
 * the day someone writes a new one, and it would say nothing about a key retired
 * by some future rename that has nothing to do with #53. What is derived instead
 * is the PRODUCER SET, and it holds only what can actually NAME A PROPERTY: an
 * object-literal key, a shorthand property, a method shorthand, an assignment
 * target, a field declared in a schema. A key read against that set with nothing
 * to answer it has no writer, in any language.
 *
 * ⚠️ AND THE PRODUCER SET IS NOT "EVERY IDENTIFIER", though the first draft made
 * it that, and the difference is the whole check. Under the loose rule the tree
 * offered 3 206 producers against 1 254, and every extra one was an alibi: a
 * local variable named like a key excused a read of that key anywhere. It cost
 * exactly the defect this file is named for — `const { glifo } = policy(p.state)`
 * went GREEN, because using the binding on the next line put `glifo` back into
 * the producer set. The pattern wrote its own excuse.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');

const { open, policy } = require(path.join(ROOT, 'session', 'open.cjs'));
const { briefing } = require(path.join(ROOT, 'session', 'briefing.cjs'));
const { sealInto } = require(path.join(ROOT, 'session', 'save.cjs'));
const { approve, check } = require(path.join(ROOT, 'session', 'agreement.cjs'));

const BRIEFING = path.join(ROOT, 'session', 'briefing.cjs');

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

// ---------------------------------------------------------------------------
// A four-page `.drawio`, built here rather than generated.
//
// The engine is not in this picture on purpose: what is under test is the seam
// between `open()` and `briefing()`, and a run through ELK would buy nothing but
// the ability to fail for an unrelated reason. Four pages because there are four
// states, and one of them — the page with NO seal — is the one no generated file
// ever contains: it only exists after a human deletes the seal or pastes a page
// in by hand, which is precisely the case the glyph is there to flag.

const page = (id, name, label, x) =>
  `  <diagram id="${id}" name="${name}">\n` +
  '    <mxGraphModel dx="800" dy="600" grid="0" page="1">\n' +
  '      <root>\n' +
  '        <mxCell id="0"/>\n' +
  '        <mxCell id="1" parent="0"/>\n' +
  `        <mxCell id="${id}-node" value="${label}" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">\n` +
  `          <mxGeometry x="${x}" y="40" width="120" height="60" as="geometry"/>\n` +
  '        </mxCell>\n' +
  '        <object id="panlabs-modelo" label="">\n' +
  '          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">\n' +
  '            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>\n' +
  '          </mxCell>\n' +
  '        </object>\n' +
  '      </root>\n' +
  '    </mxGraphModel>\n' +
  '  </diagram>\n';

const BLANK =
  '<mxfile host="panlabs-aws-diagrams">\n' +
  page('untouched', 'Untouched', 'Alpha', 40) +
  page('dragged', 'Dragged', 'Bravo', 240) +
  page('rewritten', 'Rewritten', 'Charlie', 440) +
  page('unsealed', 'Unsealed', 'Delta', 640) +
  '</mxfile>\n';

const session = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'session', 'retail-logical.json'), 'utf8'));

/**
 * The three edits a human makes to a file we sealed, and the fourth thing that
 * happens to it. Each one is the MINIMUM that moves a page into its state:
 * dragging changes the geometry and nothing else, rewriting changes a label and
 * nothing else, and the seal simply goes away.
 */
function fourStates() {
  let xml = sealInto(BLANK, session, 'logical');
  xml = xml.replace('<mxGeometry x="240"', '<mxGeometry x="265"');              // dragged  -> moved
  xml = xml.replace('value="Charlie"', 'value="Charlie Delta"');                // rewritten -> divergent
  const seal = /[ \t]*<object id="panlabs-modelo"[\s\S]*?<\/object>\n/g;
  let n = 0;
  xml = xml.replace(seal, m => (++n === 4 ? '' : m));                           // unsealed -> no-seal
  return xml;
}

// ---------------------------------------------------------------------------
console.log('\n1 · the four page states reach the briefing as glyphs (#125)\n');

/** The four `open()` can put on a page. `no-seal` is the one `policy` answers under `default`. */
const STATES = ['intact', 'moved', 'divergent', 'no-seal'];

const opened = open(fourStates());
const lines = briefing(opened);
const rows = lines.filter(l => l.includes('view='));

{
  ok(opened.ours, 'the built file is recognized as ours', opened.because || opened.howIRecognized.join(' · '));

  const states = opened.pages.map(p => p.state);
  ok(JSON.stringify(states) === JSON.stringify(STATES),
    'and the four edits produce the four states, in order',
    states.join(' · '));

  ok(rows.length === opened.pages.length,
    'the briefing prints one row per page', `${rows.length} row(s) for ${opened.pages.length} page(s)`);

  // The `default` branch is the one the ticket calls the worst of the four to
  // hide: a page with no seal is the one nobody knows what it asserts. It has no
  // name in `policy`'s switch, so it is named here by the state that lands on it.
  for (const p of opened.pages) {
    const glyph = policy(p.state).glyph;
    const row = lines.find(l => l.includes(String(p.name || p.id)) && l.includes('view='));
    ok(!!row && row.trim().startsWith(glyph),
      `the \`${p.state}\` page carries its glyph \`${glyph}\``,
      row ? `"${row.trim().slice(0, 46)}"` : 'no row for this page at all');
  }

  const distinct = new Set(opened.pages.map(p => policy(p.state).glyph));
  ok(distinct.size === STATES.length,
    'and the four glyphs are four different characters — the point of having them',
    [...distinct].join(' '));
}

// ---------------------------------------------------------------------------
console.log('\n2 · nothing in a briefing renders as `undefined` (#125)\n');

/**
 * ⚠️ `no undefined in 49 lines` IS WORTH NOTHING IF THE BRANCH THAT WOULD BREAK
 * NEVER RAN, and the shipped example alone does not run them all: it carries no
 * approved agreement, so the two lines that read `extra.agreement.motivo` and
 * `.diferencas` — the same shape as the defect this ticket is about, two lines
 * below it — are dead in a briefing built from it.
 *
 * So the surface is covered on purpose and then MEASURED: the section titles are
 * read out of `briefing.cjs` itself rather than listed here, and every one of them
 * has to appear in one of the briefings below. A section that gets added later and
 * is never rendered turns this red instead of quietly halving the verdict.
 */
const briefings = (() => {
  const approved = approve(session, { at: '2026-08-21', by: 'user', candidate: 'cand-a' });
  // the same model with one capability renamed: the projection no longer matches
  // the snapshot the approval hung on to, so `check` comes back with a reason and
  // a list of differences — the branch the shipped example cannot reach.
  const drifted = { ...approved, nodes: approved.nodes.map((n, i) => (i ? n : { ...n, label: `${n.label} (renamed)` })) };
  const withDossier = xml => open(sealInto(xml, approved, 'logical'));
  return [
    { what: 'the four states', L: lines },
    { what: 'an agreement that holds', L: briefing(withDossier(BLANK), { agreement: check(approved) }) },
    { what: 'an agreement that broke', L: briefing(withDossier(BLANK), { agreement: check(drifted) }) },
    { what: 'a file that is not ours', L: briefing(open('<mxfile host="app.diagrams.net"><diagram id="x" name="X">' +
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>')) },
  ];
})();

{
  const everything = briefings.flatMap(b => b.L).join('\n');

  const sections = [...fs.readFileSync(BRIEFING, 'utf8').matchAll(/head\('([^']+)'\)/g)].map(m => m[1]);
  ok(sections.length > 0, 'briefing.cjs declares its sections where they can be read', `${sections.length} found`);
  const unrendered = sections.filter(s => !everything.includes(s));
  ok(unrendered.length === 0,
    'and every section of the briefing is actually rendered by these fixtures',
    unrendered.length ? `never reached: ${unrendered.join(', ')}` : sections.join(' · '));

  // the two agreement branches by name, because both are one line long and a
  // fixture that reached neither would still satisfy the section check above
  ok(everything.includes("still matches the approved one"), 'the agreement that holds prints its line');
  const broke = briefings.find(b => b.what === 'an agreement that broke').L.filter(l => l.includes('✗') || l.trim().startsWith('·'));
  ok(broke.length >= 2, 'the agreement that broke prints its reason AND its differences',
    broke.map(l => l.trim().slice(0, 40)).join(' | ') || 'neither');

  // What a dangling read looks like once it reaches a human. `undefined` is the
  // one this ticket was reported for; the other two are the same accident with a
  // different shape, and they cost nothing to watch for while we are here.
  for (const needle of ['undefined', '[object Object]', 'NaN']) {
    const bad = briefings.flatMap(b => b.L.filter(l => l.includes(needle)).map(l => ({ ...b, l })));
    ok(bad.length === 0, `no line of any of the ${briefings.length} briefings says \`${needle}\``,
      bad.length
        ? `${bad.length} line(s), first in ${bad[0].what}: "${bad[0].l.trim().slice(0, 46)}"`
        : `${briefings.reduce((n, b) => n + b.L.length, 0)} lines clean`);
  }
}

// ---------------------------------------------------------------------------
console.log('\n3 · every property the skill reads, something in the skill writes (#125)\n');

/**
 * Bags whose keys come from OUTSIDE this tree. Reading one of these is not
 * reading our own contract, and no producer for it will ever be found here —
 * they are keyed at runtime, by a string this repository never spells.
 *
 * Listed by RECEIVER rather than by key, and that is the whole point: a list of
 * mxGraph key names would need a new entry every time family A2 learns to look
 * at one more style attribute, which is a rule that goes red on correct code.
 */
const FOREIGN_BAGS = {
  style: "draw.io's mxGraph style string, parsed into an object by `readStyle` (validator/scene.cjs) " +
    'with computed keys — spelled the way draw.io spells them, per CLAUDE.md § interface alheia',
  opts: 'the command-line flag bag, keyed by whatever the caller typed',
  env: 'process.env',
};

/**
 * Keys with a writer that is not source we can read.
 *
 * `sections`, `incomingShape` and `outgoingShape` come out of ELK, whose only
 * copy here is a 1.6 MB minified bundle. An earlier draft fed every identifier
 * in that bundle into the producer set and the sweep went green on everything:
 * 23 811 producers, of which the bundle was 20 605 — an alibi for any name a
 * minifier happens to have used. It buys three keys, so it costs three lines.
 *
 * `symbol` is the other kind: a legend entry field, read by families A1 and A7
 * against a legend `validator/scene.cjs:423` says out loud the engine does not
 * emit yet. The read is against a shape that has no writer BECAUSE the feature
 * has no writer. Verdict 4 makes sure this stays true.
 */
const FOREIGN_KEYS = {
  sections: "ELK's JSON graph format (engine/vendor/elk.bundled.js)",
  incomingShape: "ELK's JSON graph format (engine/vendor/elk.bundled.js)",
  outgoingShape: "ELK's JSON graph format (engine/vendor/elk.bundled.js)",
  symbol: 'the legend entry the engine does not emit yet — validator/scene.cjs:423',
  // JSON Schema's own `if`/`then`/`else`. `engine/validate.cjs` implements the
  // triple; no schema in this tree uses the `else` arm, so nothing writes it.
  // Its siblings resolve on their own — `then` is a Promise method, `if` is
  // spelled in a schema — which is why only one of the three is named here.
  else: "JSON Schema's if/then/else — implemented in engine/validate.cjs, unused by any schema here",
  // CIEDE2000's parametric weights. `validator/color.cjs` accepts them as an
  // optional argument and every caller in this tree takes the defaults, so the
  // read is against a shape nobody here fills in. Foreign vocabulary, and the
  // formula spells them exactly this way.
  kL: 'CIEDE2000 parametric weight — optional argument of deltaE00, defaulted by every caller here',
  kC: 'CIEDE2000 parametric weight — optional argument of deltaE00, defaulted by every caller here',
  kH: 'CIEDE2000 parametric weight — optional argument of deltaE00, defaulted by every caller here',
};

/**
 * The builtin surface, DERIVED from the runtime instead of listed. `.length`,
 * `.map`, `.exec`, `.index`, `.status` — every one of them is a property with a
 * writer we can ask for, and asking is what keeps this from being a second
 * wordlist to maintain.
 */
function builtins() {
  const out = new Set();
  const own = o => { if (o) for (const n of Object.getOwnPropertyNames(o)) out.add(n); };
  for (const C of [Object, Array, String, Number, Boolean, Function, RegExp, Map, Set, Promise, Error, Date, Symbol])
    { own(C); own(C.prototype); }
  const cp = require('child_process');
  // ⚠️ `process.env` is NOT in this list, and leaving it out is load bearing. Its
  // own properties are the CALLER's environment variables, so including it made
  // the producer set depend on who ran the check: under `tests/run.sh`, which
  // exports `DRAWIO`, the name `DRAWIO` became a builtin and CONTROL 2 lost the
  // one read it exists to watch. A ruler whose verdict moves with the shell is
  // the same defect this file rules, one level up. Reads on `process.env` are
  // excused by receiver, in FOREIGN_BAGS, where they belong.
  for (const O of [JSON, Math, console, process, process.stdout, Reflect, Buffer, Buffer.prototype,
    require('fs'), require('fs').promises, require('path'), require('os'), require('crypto'), cp])
    own(O);
  const hash = require('crypto').createHash('sha256');
  own(hash); own(Object.getPrototypeOf(hash));      // .update / .digest
  own(cp.spawnSync(process.execPath, ['-e', '0'])); // .status / .stdout / .signal
  own(/x/.exec('x'));                               // .index / .input / .groups
  own(new Error('x'));                              // .stack / .message — own to the INSTANCE, not the prototype
  own(module); own(require);
  return out;
}

/**
 * Everything that is not code: comments, and the TEXT of every string. Blanked
 * character by character so the line numbers survive — a finding that names the
 * wrong line is a finding nobody chases.
 *
 * A template literal keeps its `${…}` islands: they are code, and `p.state` inside
 * one is as much a read as `p.state` outside. Its prose goes, which is what stops
 * `node tools/case.cjs <session.json>` in a usage banner from being read as a
 * `.cjs` and a `.json` nobody writes.
 */
const blank = s => s.replace(/[^\n]/g, ' ');
const REGEX_LITERAL = /(^|[=(,:[!&|?{};+\-*%^~<>]|return|typeof)(\s*)\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n])+\/[gimsuy]*/g;

function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)))
    .replace(REGEX_LITERAL, (m, p, sp) => p + sp + blank(m.slice(p.length + sp.length)))
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, m =>
      '`' + m.slice(1, -1).replace(/\$\{[\s\S]*?\}|[\s\S]/g, t => (t[0] === '$' ? t : blank(t))) + '`')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, m => "'" + blank(m.slice(2)) + "'")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, m => '"' + blank(m.slice(2)) + '"');
}

function sourcesUnder(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') sourcesUnder(p, ext, out); }
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** What stands to the left of the dot: `e.style.glass` → `style`, `opts.help` → `opts`. */
const RECEIVER = /([A-Za-z_$][\w$]*)\s*(?:\([^()]*\))?\s*$/;

/**
 * ⚠️ THE DOT IS NOT HOW THIS TREE READS MOST OF ITS OWN KEYS.
 *
 * `const { host, pages } = readPages(xml)`, `const { model } = project(...)`,
 * `const { policy } = require('./open.cjs')` — 108 patterns naming 245 keys. Next
 * to 8 251 dotted reads that is 3 % by volume and the wrong way to count it: 73
 * of the 108 are `require`, so this shape is not a minority of the reads, it is
 * ALL of the module seams. Every import in this skill is one of these.
 *
 * And a scanner that only knew the dot was blind in the worst direction: the
 * destructured name reads like any other bare identifier, so
 * `const { glifo } = policy(p.state)` did not merely slip past — it ENTERED THE
 * PRODUCER SET and wrote its own alibi. The defect this whole file exists for,
 * typed one line differently, went green.
 *
 * So a pattern's KEYS are reads, and the names it BINDS are neither — a local
 * variable names no property, however it got its name:
 *
 *   const { glyph } = policy(s)               read  glyph
 *   const { corrections: applied } = load()   read  corrections, not `applied`
 *   const { id, ...tokens } = token           read  id, not `tokens`
 *
 * The alias arm of `FIELD` looks unused and is not: consuming `: applied` is what
 * stops the next match from taking the local name as a key of its own.
 *
 * It reaches the module boundary too, which is the same seam one level up:
 * `const { politica } = require('./open.cjs')` is a key nothing exports, and it
 * is now a finding instead of a `undefined is not a function` at run time.
 *
 * Nested patterns and destructured PARAMETERS are not handled — and neither
 * appears in this tree, which was measured before leaving them out rather than
 * assumed. If one is written, its keys go on being read as bare identifiers, so
 * the failure is a missed finding and not a false one.
 */
const BINDING = /\b(?:const|let|var)\s*\{([^{}]*)\}\s*=(?!=)/g;
const FIELD = /(^|,)\s*(\.\.\.)?\s*([A-Za-z_$][\w$]*)\s*(?::\s*([A-Za-z_$][\w$]*))?/g;

/** `name(args) {` is a method shorthand — unless the name is a keyword and the block is a body. */
const KEYWORD = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'do', 'else']);

/**
 * @param {(name: string, receiver: string) => boolean} excused
 * @returns {{reads: Map<string, object[]>, producers: Set<string>}}
 */
function sweep(root, excused) {
  const producers = new Set();
  const reads = new Map();
  const write = name => producers.add(name);

  for (const file of sourcesUnder(root, '.cjs')) {
    let src = code(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(root, file);
    const lineAt = i => src.slice(0, i).split('\n').length;
    const read = (name, i, receiver) => {
      if (excused(name, receiver, bags)) return;
      if (!reads.has(name)) reads.set(name, []);
      reads.get(name).push({ at: `${rel}:${lineAt(i)}`, receiver });
    };
    // one hop of aliasing, because `const s = e.style` is how the style bag is
    // actually read: without it, eight mxGraph keys come back as findings.
    const bags = new Set(Object.keys(FOREIGN_BAGS));
    for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[\w.$]*\.([A-Za-z_$][\w$]*)/g))
      if (bags.has(m[2])) bags.add(m[1]);

    // ---- the destructured reads, taken first and then blanked, so the
    // object-literal rules below never mistake a pattern for a literal
    for (const b of [...src.matchAll(BINDING)]) {
      const inner = b[1];
      const start = b.index + b[0].indexOf(inner);
      for (const f of [...inner.matchAll(FIELD)]) {
        const [, , spread, name, alias] = f;
        if (spread) continue;                        // `...tokens` binds a local, it names no key
        read(name, b.index, 'const {');
      }
      src = src.slice(0, start) + blank(inner) + src.slice(start + inner.length);
    }

    // ---- the writers, and ONLY things that can name a property
    for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) write(m[1]);                 // { key: v }
    for (const m of src.matchAll(/[{,]\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/g)) write(m[1]);   // { key }
    for (const m of src.matchAll(/\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) write(m[1]);          // x.key = v
    for (const m of src.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g))     // { key(a) {…} }
      if (!KEYWORD.has(m[2])) write(m[2]);

    // ---- the dotted reads
    for (const m of src.matchAll(/\.([A-Za-z_$][\w$]*)/g)) {
      if (src[m.index - 1] === '.') continue;                     // `...spread` is not a member read
      if (/^\s*=(?!=)/.test(src.slice(m.index + m[0].length))) continue;          // handled as a write
      read(m[1], m.index, (RECEIVER.exec(src.slice(Math.max(0, m.index - 80), m.index)) || [, '?'])[1]);
    }
  }
  // A schema field and a corpus key are writers too — `schema.json` declares
  // `nodes`, and nothing in the `.cjs` has to spell it for `m.nodes` to be a
  // read with a writer.
  for (const file of sourcesUnder(root, '.json'))
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/"([A-Za-z_$][\w$]*)"\s*:/g)) write(m[1]);

  return { reads, producers };
}

const BUILTIN = builtins();

const dangling = (root, { bags = true, keys = true } = {}) => {
  const { reads, producers } = sweep(root, (name, receiver, aliased) => {
    if (bags && aliased.has(receiver)) return true;
    if (keys && FOREIGN_KEYS[name]) return true;
    return false;
  });
  return [...reads.entries()]
    .filter(([k]) => !producers.has(k) && !BUILTIN.has(k))
    .map(([k, where]) => ({ key: k, where }));
};

{
  const found = dangling(ROOT);
  // The counts are printed, not just the verdict: a sweep that quietly stopped
  // seeing half the tree would still say "no property is read that nothing
  // writes", and the only tell would be the number going quiet.
  const all = sweep(ROOT, () => false);
  let dotted = 0, destructured = 0;
  for (const where of all.reads.values())
    for (const w of where) (w.receiver === 'const {' ? destructured++ : dotted++);
  ok(found.length === 0,
    'no property is read that nothing in the skill writes',
    found.length
      ? found.map(f => `${f.where[0].receiver}.${f.key} (${f.where[0].at})`).join('; ')
      : `${dotted} dotted + ${destructured} destructured read(s) of ${all.reads.size} distinct ` +
        `key(s), against ${all.producers.size} producers`);
}

// ---------------------------------------------------------------------------
console.log('\n4 · control — each verdict knows how to fail\n');

{
  // 1 · the defect this ticket is about, replanted. `.glyph` read as `.glifo` is
  // a read of a key nothing writes, and the sweep is what has to see it.
  const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'contract-ends-'));
  try {
    fs.cpSync(ROOT, path.join(TMP, 'skill'), { recursive: true });
    const broken = path.join(TMP, 'skill', 'session', 'briefing.cjs');
    fs.writeFileSync(broken, fs.readFileSync(broken, 'utf8').replace('policy(p.state).glyph', 'policy(p.state).glifo'));

    const found = dangling(path.join(TMP, 'skill'));
    ok(found.length === 1 && found[0].key === 'glifo',
      'CONTROL 1: the sweep finds `.glifo` replanted in the briefing',
      found.map(f => `${f.where[0].receiver}.${f.key}`).join('; ') || 'it found nothing');

    // ⚠️ THE SAME DEFECT, DESTRUCTURED — and this one went green for a while.
    // `const { glifo } = policy(p.state)` is the identical broken seam typed the
    // way this tree reads by default, and under a producer set of "every
    // identifier" the binding's own use on the next line excused it.
    fs.writeFileSync(broken, fs.readFileSync(broken, 'utf8')
      .replace('policy(p.state).glifo', 'policy(p.state).glyph')
      .replace('const mark = policy(p.state).glyph;', 'const { glifo } = policy(p.state);\n    const mark = glifo;'));
    const destructured = dangling(path.join(TMP, 'skill'));
    ok(destructured.length === 1 && destructured[0].key === 'glifo',
      'CONTROL 1: and finds the same defect written `const { glifo } = policy(…)`',
      destructured.map(f => `${f.key} at ${f.where[0].at}`).join('; ') || 'it found nothing');

    // the module boundary is the same seam one level up: a name nothing exports
    fs.writeFileSync(broken, fs.readFileSync(broken, 'utf8')
      .replace('const { glifo } = policy(p.state);\n    const mark = glifo;', 'const mark = policy(p.state).glyph;')
      .replace("const { policy } = require('./open.cjs');", "const { politica } = require('./open.cjs');\nconst policy = politica;"));
    const imported = dangling(path.join(TMP, 'skill'));
    ok(imported.length === 1 && imported[0].key === 'politica',
      'CONTROL 1: and a `require` destructuring a name nothing exports',
      imported.map(f => f.key).join('; ') || 'it found nothing');

    // and the same rename applied to BOTH ends is not a finding: this rules the
    // seam, not the language. Which end is English is CLAUDE.md's rule and #124's
    // ticket, and a check that conflated the two would report a repo-wide opinion
    // as a defect.
    fs.writeFileSync(broken, fs.readFileSync(broken, 'utf8')
      .replace("const { politica } = require('./open.cjs');\nconst policy = politica;", "const { policy } = require('./open.cjs');"));
    for (const f of ['open.cjs', 'briefing.cjs']) {
      const p = path.join(TMP, 'skill', 'session', f);
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\bglyph\b/g, 'glifo'));
    }
    ok(dangling(path.join(TMP, 'skill')).length === 0,
      'CONTROL 1: and renaming BOTH ends is not a finding — this rules the seam, not the language');
  } finally { fs.rmSync(TMP, { recursive: true, force: true }); }

  // 1b · the other direction: shapes that LOOK like a member read and are not.
  // `...spread` was read as one for a while — the last dot of the three, plus the
  // name — and every such name arrived as a finding until a producer happened to
  // excuse it. Six of the tree's spreads were being counted as reads of a key.
  {
    const probe = fs.mkdtempSync(path.join(require('os').tmpdir(), 'contract-ends-spread-'));
    try {
      const dir = path.join(probe, 'skill', 'session');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'probe.cjs'),
        "'use strict';\n" +
        'const bag = { a: 1 };\n' +
        'const out = [...spreadNotARead(bag)];\n' +          // a spread, not `x.spreadNotARead`
        'function spreadNotARead(x) { return [x.a]; }\n' +
        'module.exports = { out };\n');
      const found = dangling(path.join(probe, 'skill'));
      ok(found.length === 0,
        'CONTROL 1: a `...spread` is not reported as a member read',
        found.map(f => `${f.where[0].receiver}.${f.key}`).join('; ') || 'clean');
    } finally { fs.rmSync(probe, { recursive: true, force: true }); }
  }

  // 2 · the excuses have to keep earning themselves. Both lists are the only
  // hand-written thing here, so both are held to the same rule `check-guide-
  // contract.cjs` holds its own to: an exception for something that is no longer
  // a finding is deleted, not kept.
  const withoutBags = dangling(ROOT, { bags: false }).flatMap(f => f.where.map(w => w.receiver));
  for (const bag of Object.keys(FOREIGN_BAGS))
    ok(withoutBags.includes(bag),
      `CONTROL 2: the \`${bag}\` bag is still read somewhere — otherwise the excuse goes`,
      FOREIGN_BAGS[bag].slice(0, 58));

  const withoutKeys = new Set(dangling(ROOT, { keys: false }).map(f => f.key));
  for (const key of Object.keys(FOREIGN_KEYS))
    ok(withoutKeys.has(key),
      `CONTROL 2: \`${key}\` is still a read with no writer here — otherwise the excuse goes`,
      FOREIGN_KEYS[key].slice(0, 58));

  // 3 · verdict 1 has to be measuring the GLYPH and not the state word printed
  // beside it. Both are on the row, and the state word came out in full through
  // the whole life of this defect — that is why the ticket says nothing goes
  // WRONG, only illegible. A predicate that passed on the word would have been
  // green all along and would be green again tomorrow.
  //
  // So the pair is built here rather than taken from the briefing: two rows that
  // differ in the glyph and in NOTHING else. Held against the product's own rows
  // this would just restate verdict 1, and go red whenever verdict 1 does — which
  // is a duplicate, not a control.
  const carriesGlyph = (row, state) => row.trim().startsWith(policy(state).glyph);
  for (const state of STATES) {
    const mine = policy(state).glyph;
    const other = STATES.map(s => policy(s).glyph).find(g => g !== mine);
    const row = g => `    ${g} A page                             view=logical  ${state}`;
    ok(carriesGlyph(row(mine), state) && !carriesGlyph(row(other), state),
      `CONTROL 3: the predicate tells \`${mine}\` from \`${other}\` on an otherwise identical \`${state}\` row`,
      'same page name, same view, same state word — only the glyph differs');
  }
}

// ---------------------------------------------------------------------------
console.log(failures
  ? `\n  ✗ ${failures} failure(s)`
  : '\n  ✓ the four states arrive as glyphs, no briefing says `undefined`, and every key the skill reads it also writes.');
process.exit(failures ? 1 : 0);
