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
 * AND IT PROVES IT MEASURES. Layer 2 of the suite exists because a validator
 * has to fail a planted defect before being trusted as a ruler; a document
 * checker is no different, and this one plants five and requires red for each
 * before reporting on the real file. Green here without that is documentation.
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

// ------------------------------------------------------------------- reading

/** Every fenced block's body, with the fence lines dropped. */
function fences(text) {
  const out = [];
  let open = null;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      if (open === null) open = [];
      else { out.push(open.join('\n')); open = null; }
      continue;
    }
    if (open !== null) open.push(line);
  }
  return out;
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

// A write target is whatever follows `--output`, `-o`, `>` or `>>`. The skill's
// own convention is the first; the redirects catch a shell one-liner smuggling
// the same thing past it.
function writeTargets(block) {
  const out = [];
  const words = block.split(/\s+/).map(w => w.replace(/^[`'"(]+|[`'",;)]+$/g, ''));
  for (let i = 0; i < words.length; i++) {
    if (['--output', '-o', '>', '>>'].includes(words[i]) && words[i + 1]) out.push(words[i + 1]);
    const redirect = words[i].match(/^>>?(\S+)$/);
    if (redirect) out.push(redirect[1]);
  }
  return out;
}

// -------------------------------------------------------------- the four rules

/** Everything the four rules need, read once out of one document. */
function measure(md) {
  const lines = md.split('\n');
  const blocks = fences(md);
  const prose = md.split('```').filter((_, i) => i % 2 === 0).join('\n');

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
  for (const b of blocks)
    for (const t of writeTargets(b))
      if (INSIDE_DIRS.includes(t.split('/')[0])) writesInside.push(t);

  const escapes = [];
  const dangling = [];
  for (const b of blocks)
    for (const t of tokens(b)) {
      if (/^(\.\.\/|~|\/(?!tmp\/))/.test(t)) { escapes.push(t); continue; }
      if (t.startsWith('/tmp/')) continue;   // scratch, and deliberately not the tree
      if (/[<>*]/.test(t)) continue;         // `<case-slug>.session.json` is a placeholder
      if (!fs.existsSync(path.join(ROOT, t))) dangling.push(t);
    }

  return {
    turns,
    writesInside,
    escapes,
    dangling,
    grillingNamed: /grilling/i.test(prose),
    grillingInvoked: /grilling/i.test(blocks.join('\n')),
  };
}

/** The four rules, as verdicts over one measurement. Order is the report's order. */
function verdicts(m) {
  const parents = new Set(m.turns.map(t => t.parent));
  return [
    ['1 · the journey has exactly three turns', m.turns.length === 3, m.turns.map(t => t.title)],
    ['1 · and all three live under one section', m.turns.length > 0 && parents.size === 1, [...parents]],
    ['1 · each one states when it closes', m.turns.every(t => t.closes),
      m.turns.filter(t => !t.closes).map(t => `"${t.title}" never says when it closes`)],
    ['2 · every documented write lands outside the skill tree', m.writesInside.length === 0,
      m.writesInside.map(t => `writes to "${t}", which is inside the skill`)],
    ['3 · no command reaches above the skill root', m.escapes.length === 0,
      m.escapes.map(t => `"${t}" leaves the skill`)],
    ['3 · every concrete path a command names exists', m.dangling.length === 0,
      m.dangling.map(t => `"${t}" does not exist under the skill root`)],
    ['4 · /grilling is named in the prose', m.grillingNamed, []],
    ['4 · and no command invokes it', !m.grillingInvoked,
      ['a fenced command mentions /grilling — the fallback would stop being the main path']],
  ];
}

// ------------------------------------------------------------------ the proof

/**
 * Five defects planted in a COPY of the real document, each one aimed at a
 * single verdict. A defect that goes green here means the rule it targets is
 * not being measured, and the report below would be worth nothing.
 */
const DEFECTS = [
  ['a fourth turn', '1 · the journey has exactly three turns',
    md => `${md}\n### Turno 4 · O portão\n\n**Fecha quando** alguém disser que fecha.\n`],
  ['a turn that never closes', '1 · each one states when it closes',
    md => md.replace(/\*\*Fecha quando\*\*/, '**Talvez feche quando**')],
  ['a command writing into the skill tree', '2 · every documented write lands outside the skill tree',
    md => `${md}\n\`\`\`bash\nnode engine/generate.cjs m.json --output output/x.drawio\n\`\`\`\n`],
  ['a command naming a path that does not exist', '3 · every concrete path a command names exists',
    md => `${md}\n\`\`\`bash\nnode tools/does-not-exist.cjs\n\`\`\`\n`],
  ['a command reaching above the skill root', '3 · no command reaches above the skill root',
    md => `${md}\n\`\`\`bash\nnode ../../docs/aws-diagrams/tool.cjs\n\`\`\`\n`],
  ['a command invoking /grilling', '4 · and no command invokes it',
    md => `${md}\n\`\`\`bash\n/grilling a necessidade\n\`\`\`\n`],
];

// ------------------------------------------------------------------ the report

const md = fs.readFileSync(SKILL, 'utf8');
let failed = 0;

console.log('\n  the checker proves it measures');
for (const [name, target, plant] of DEFECTS) {
  const after = verdicts(measure(plant(md)));
  const row = after.find(([desc]) => desc === target);
  const caught = row && !row[1];
  console.log(`  ${caught ? '✓' : '✗'} planting "${name}" turns "${target}" red`);
  if (!caught) failed = 1;
}

console.log('\n  SKILL.md');
for (const [desc, ok, detail] of verdicts(measure(md))) {
  console.log(`  ${ok ? '✓' : '✗'} ${desc}`);
  if (!ok) for (const l of detail) console.log(`      · ${l}`);
  if (!ok) failed = 1;
}

console.log(failed ? '\n  ✗ RED\n' : '\n  ✓ the journey document holds\n');
process.exit(failed);
