#!/usr/bin/env node
'use strict';
/**
 * #43 — THE JOURNEY, MEASURED AGAINST ITS OWN DOCUMENT.
 *
 *   node tests/check-journey.cjs
 *
 * `SKILL.md` is the skill's front door and the one file every ticket edits,
 * and until this file existed NOTHING verified it — the parallel-workflow
 * doctrine says so in as many words, after measuring two branches that both
 * rewrote it and merged green without either author reading the result.
 *
 * Four of #43's acceptance criteria are mechanical, and these are those four.
 * The rest are prose, and prose is read by a human; a checker that grepped for
 * sentences would go red on the first rewording and teach everyone to edit
 * around it.
 *
 *   1  THREE TURNS       the journey has exactly three, all under one section,
 *                        and each closes on a stated condition. Seven steps
 *                        each carrying its own gate is the shape #35 exists to
 *                        undo, and it would grow back one heading at a time.
 *   2  NOTHING WRITES    no documented command writes into the skill's own
 *      INSIDE            tree. That was the complaint that opened the spec:
 *                        `output/<case>.drawio` grew the published package by
 *                        one file per user run, to 29 MB against a 30 MB
 *                        ceiling.
 *   3  NOTHING POINTS    every path a documented command names resolves inside
 *      OUTSIDE           the skill, and exists. #46 asks this of the whole tree
 *                        through Markdown link syntax; `scripts/checks/
 *                        references.sh` excludes code fences BY DESIGN, so a
 *                        command's ARGUMENTS are measured here or nowhere.
 *   4  `/grilling` IS    it may be named in prose, never invoked by a command.
 *      OPTIONAL          "no instruction depends on /grilling existing" is
 *                        exactly "it never appears inside a fence".
 *
 * WHAT COUNTS AS A DOCUMENTED COMMAND, for rules 2 and 3: every fenced block,
 * PLUS every inline code span that starts like a command (`node …`, `./…`), in
 * `SKILL.md` AND in every file under `guide/`. Three widenings, each one a
 * defect that passed green before it:
 *
 *   fences only          the "Os comandos" table is the document's whole
 *                        command inventory, and a row naming a tool that does
 *                        not exist read as prose.
 *   `--output` only      `cp x output/y` and `writeFileSync('output/y')` both
 *                        wrote into the tree past a rule that only knew flags.
 *                        Hence `WRITE_ONLY_DIR` below, checked positionally.
 *   `SKILL.md` only      `guide/visual.md` documented publishing into
 *                        `output/<caso>.publicado.drawio` — a step writing
 *                        inside the tree, in a file the front door points at.
 *
 * `README.md` is deliberately NOT a surface: it is the map for whoever MODIFIES
 * the skill, and its bench commands legitimately name `output/`. Rules 1 and 4
 * stay `SKILL.md`-only — the turns and the fallback are the front door's own
 * business — and rule 4 stays fenced-only besides, because `/grilling` in an
 * inline span is prose, and prose may name it.
 *
 * AND IT PROVES IT MEASURES. Layer 2 of the suite exists because a validator
 * has to fail a planted defect before being trusted as a ruler; a document
 * checker is no different. Every verdict below carries at least one planted
 * defect and has to go red for it — and that coverage is itself a verdict, so
 * a rule added without a plant fails instead of passing quietly.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKILL = path.join(ROOT, 'SKILL.md');

/** Directory names that live inside the skill — the prefixes a write must avoid. */
const INSIDE_DIRS = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

// The one directory in the tree that exists to be WRITTEN rather than read, and
// the literal subject of the complaint that opened #35. No documented command
// has business naming it in any position, so it is checked independently of the
// write syntax below — which is the half that can always be worded around.
const WRITE_ONLY_DIR = 'output';

// ------------------------------------------------------------------- reading

/**
 * Splits the document into fenced blocks and everything else, in ONE pass.
 * Two passes disagreeing about where a fence starts is how a checker ends up
 * measuring a document nobody wrote.
 */
function split(text) {
  const blocks = [];
  const prose = [];
  let open = null;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      if (open === null) open = [];
      else { blocks.push(open.join('\n')); open = null; }
      continue;
    }
    (open ?? prose).push(line);
  }
  if (open !== null) blocks.push(open.join('\n'));   // an unclosed fence is still a block
  return { blocks, prose: prose.join('\n') };
}

/** Inline code spans that read as a command — the "Os comandos" table's rows. */
function commandSpans(prose) {
  return (prose.match(/`[^`\n]+`/g) || [])
    .map(s => s.slice(1, -1))
    .filter(s => /^(node|bash|sh|\.\/)\b|^\.\//.test(s));
}

// A path-ish token: a run of path characters carrying at least one separator.
// Matched by scanning rather than by splitting on whitespace, because a
// documented `node -e` one-liner packs its paths inside quotes and parentheses
// — splitting handed back `{project}=require('./session/project.cjs` and called
// it a dangling path.
//
// Placeholders (`<case-slug>.session.json`) are matched here and skipped in
// rule 3: rule 2 needs their PREFIX to tell an inside write from an outside one.
const PATHISH = /\/?[\w.<>*-]+(?:\/[\w.<>*-]+)+/g;
function tokens(block) {
  return block.replace(/https?:\/\/\S+/g, ' ').match(PATHISH) || [];
}

/**
 * Where a command writes. Enumerating write syntax is leaky by nature — this
 * list grew every time the review found a form it did not know — which is why
 * `WRITE_ONLY_DIR` above is checked positionally instead of through here.
 */
function writeTargets(block) {
  const out = [];
  const words = block.split(/\s+/).map(w => w.replace(/^[`'"(]+|[`'",;)]+$/g, ''));
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (['--output', '-o', '>', '>>'].includes(w) && words[i + 1]) out.push(words[i + 1]);
    const inlined = w.match(/^--output=(.+)$/);        // `--output=x`, one word
    if (inlined) out.push(inlined[1]);
    const redirect = w.match(/^>>?(\S+)$/);            // `>x`, no space
    if (redirect) out.push(redirect[1]);
    if (['cp', 'mv', 'tee'].includes(w) && words.length > i + 1) out.push(words[words.length - 1]);
  }
  // Node's own writers, as they appear in the documented `node -e` one-liners.
  for (const m of block.matchAll(/(?:writeFileSync|appendFileSync|createWriteStream)\(\s*['"`]([^'"`]+)/g))
    out.push(m[1]);
  return out;
}

// -------------------------------------------------------------- the four rules

/** Every command a document documents, fenced or inline. */
function commandsIn(text) {
  const { blocks, prose } = split(text);
  return [...blocks, ...commandSpans(prose)];
}

/** The guides, which the front door points at and whose commands it stands behind. */
function guideSurfaces() {
  const dir = path.join(ROOT, 'guide');
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ file: `guide/${f}`, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

/**
 * Everything the rules need. Rules 1 and 4 read `md` — the front door alone;
 * rules 2 and 3 read every surface, so a failure can name the file it is in.
 */
function measure(md, surfaces = []) {
  const lines = md.split('\n');
  const { blocks, prose } = split(md);
  const commands = [{ file: 'SKILL.md', text: md }, ...surfaces].flatMap(s =>
    commandsIn(s.text).map(c => ({ file: s.file, command: c }))
  );

  const TURN = /^###\s+(.*)$/;
  const SECTION = /^##\s+(.*)$/;
  const heads = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TURN) || lines[i].match(SECTION);
    if (m) heads.push({ i, level: lines[i].startsWith('### ') ? 3 : 2, title: m[1].trim() });
  }
  for (let k = 0; k < heads.length; k++)
    heads[k].body = lines.slice(heads[k].i, heads[k + 1]?.i ?? lines.length).join('\n');

  const turns = heads.filter(h => h.level === 3).map(h => ({
    title: h.title,
    parent: [...heads].reverse().find(p => p.level === 2 && p.i < h.i)?.title,
    closes: /\*\*Fecha quando\*\*/.test(h.body),
  }));

  const writesInside = [];
  const escapes = [];
  const dangling = [];
  for (const { file, command } of commands) {
    for (const t of writeTargets(command))
      if (INSIDE_DIRS.includes(t.split('/')[0])) writesInside.push({ file, t });
    for (const t of tokens(command)) {
      if (t.split('/')[0] === WRITE_ONLY_DIR) writesInside.push({ file, t });
      if (t.startsWith('/tmp/')) continue;      // scratch: outside the tree on purpose
      if (/^(\.\.\/|~|\/)/.test(t)) { escapes.push({ file, t }); continue; }
      if (/[<>*]/.test(t)) continue;            // `<case-slug>.session.json` is a placeholder
      if (!fs.existsSync(path.join(ROOT, t))) dangling.push({ file, t });
    }
  }
  const unique = xs => [...new Map(xs.map(x => [`${x.file} ${x.t}`, x])).values()];

  return {
    turns,
    writesInside: unique(writesInside),
    escapes: unique(escapes),
    dangling: unique(dangling),
    grillingNamed: /grilling/i.test(prose),
    grillingInvoked: /grilling/i.test(blocks.join('\n')),
  };
}

/** The four rules, as verdicts over one measurement. Order is the report's order. */
function verdicts(m) {
  const parents = new Set(m.turns.map(t => t.parent));
  return [
    ['1 · the journey has exactly three turns', m.turns.length === 3, m.turns.map(t => t.title)],
    ['1 · and all three live under one section', m.turns.length > 0 && parents.size === 1,
      [...parents].map(p => `a turn sits under "${p}"`)],
    ['1 · each one states when it closes', m.turns.every(t => t.closes),
      m.turns.filter(t => !t.closes).map(t => `"${t.title}" never says when it closes`)],
    ['2 · every documented write lands outside the skill tree', m.writesInside.length === 0,
      m.writesInside.map(({ file, t }) => `${file} writes to "${t}", which is inside the skill`)],
    ['3 · no command reaches above the skill root', m.escapes.length === 0,
      m.escapes.map(({ file, t }) => `${file}: "${t}" leaves the skill`)],
    ['3 · every concrete path a command names exists', m.dangling.length === 0,
      m.dangling.map(({ file, t }) => `${file}: "${t}" does not exist under the skill root`)],
    ['4 · /grilling is named in the prose', m.grillingNamed,
      ['the fallback is the main path, and a document that never names the skill cannot say so']],
    ['4 · and no command invokes it', !m.grillingInvoked,
      ['a fenced command mentions /grilling — the fallback would stop being the main path']],
  ];
}

// ------------------------------------------------------------------ the proof

const fence = body => `\n\`\`\`bash\n${body}\n\`\`\`\n`;
const row = body => `\n| \`${body}\` | uma linha da tabela de comandos |\n`;

/**
 * Defects planted in a COPY of the real document, each aimed at one verdict.
 * A defect that goes green means the rule it targets is not being measured,
 * and the report below would be worth nothing. Every verdict must appear here
 * as a target — `coverage` below is the verdict that enforces that.
 */
const DEFECTS = [
  ['a fourth turn', '1 · the journey has exactly three turns',
    md => `${md}\n### Turno 4 · O portão\n\n**Fecha quando** alguém disser que fecha.\n`],
  ['a turn under a second section', '1 · and all three live under one section',
    md => `${md}\n## Um apêndice\n\n### Turno 4 · O portão\n\n**Fecha quando** alguém disser que fecha.\n`],
  ['a turn that never closes', '1 · each one states when it closes',
    md => md.replace(/\*\*Fecha quando\*\*/, '**Talvez feche quando**')],
  ['--output into the skill tree', '2 · every documented write lands outside the skill tree',
    md => md + fence('node engine/generate.cjs m.json --output output/retail.drawio')],
  ['--output=, with no space', '2 · every documented write lands outside the skill tree',
    md => md + fence('node engine/generate.cjs m.json --output=output/retail.drawio')],
  ['a shell copy into the skill tree', '2 · every documented write lands outside the skill tree',
    md => md + fence('cp /tmp/x.drawio output/retail.drawio')],
  ['writeFileSync into the skill tree', '2 · every documented write lands outside the skill tree',
    md => md + fence(`node -e "require('fs').writeFileSync('models/new.json', x)"`)],
  ['a table row writing into the skill tree', '2 · every documented write lands outside the skill tree',
    md => md + row('node engine/generate.cjs m.json --output output/retail.drawio')],
  ['a command naming a path that does not exist', '3 · every concrete path a command names exists',
    md => md + fence('node tools/does-not-exist.cjs')],
  ['a table row naming a path that does not exist', '3 · every concrete path a command names exists',
    md => md + row('node tools/does-not-exist.cjs <m.json>')],
  ['a command reaching above the skill root', '3 · no command reaches above the skill root',
    md => md + fence('node ../../docs/aws-diagrams/tool.cjs')],
  ['a command reaching an absolute path', '3 · no command reaches above the skill root',
    md => md + fence('node /opt/elsewhere/tool.cjs')],
  ['the prose never naming /grilling', '4 · /grilling is named in the prose',
    md => md.replace(/grilling/gi, 'outra-skill')],
  ['a command invoking /grilling', '4 · and no command invokes it',
    md => md + fence('/grilling a necessidade')],
];

// ------------------------------------------------------------------ the report

const md = fs.readFileSync(SKILL, 'utf8');
const GUIDES = guideSurfaces();
const read = doc => verdicts(measure(doc, GUIDES));
const RULES = read(md).map(([desc]) => desc);
let failed = 0;

console.log('\n  the checker proves it measures');
for (const [name, target, plant] of DEFECTS) {
  const row = read(plant(md)).find(([desc]) => desc === target);
  if (!row) {
    console.log(`  ✗ "${name}" aims at "${target}", which is not a rule here`);
    failed = 1;
    continue;
  }
  const caught = !row[1];
  console.log(`  ${caught ? '✓' : '✗'} planting "${name}" turns "${target}" red`);
  if (!caught) failed = 1;
}

// The rule that keeps the rules honest: a verdict nobody plants against is a
// verdict nobody has ever seen fail.
const unplanted = RULES.filter(r => !DEFECTS.some(([, target]) => target === r));
console.log(`  ${unplanted.length ? '✗' : '✓'} every rule has a planted defect aimed at it`);
for (const r of unplanted) console.log(`      · "${r}" is never proven to fail`);
if (unplanted.length) failed = 1;

console.log(`\n  SKILL.md, and the ${GUIDES.length} files under guide/`);
for (const [desc, ok, detail] of read(md)) {
  console.log(`  ${ok ? '✓' : '✗'} ${desc}`);
  if (!ok) for (const l of detail) console.log(`      · ${l}`);
  if (!ok) failed = 1;
}

console.log(failed ? '\n  ✗ RED\n' : '\n  ✓ the journey document holds\n');
process.exit(failed);
