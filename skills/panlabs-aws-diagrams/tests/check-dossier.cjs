#!/usr/bin/env node
'use strict';
/**
 * The dossier's privacy, checked IN THE FILE — not in the object.
 *
 * The check that would be worth writing wrong is this one: compare the pruned
 * object against the expected one and call it a day. That does not work.
 * #23's question is about what someone reads opening *Extra › Edit Diagram*,
 * and what gets read there is BYTES. So the ruler is: plant unmistakable
 * phrases in every field the decision sends away, publish, and **search for
 * the phrases in the XML**.
 *
 * The control experiment is the other half, and without it the check proves
 * nothing: the same phrases have to be present in the WORKING file. If they
 * vanished from both, the search could be wrong and nobody would know.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { approve } = require(path.join(ROOT, 'session', 'agreement.cjs'));
const { elaborate } = require(path.join(ROOT, 'session', 'elaborate.cjs'));
const { draw } = require(path.join(ROOT, 'session', 'draw.cjs'));
const { publish, prune, dossierWarning, countDeliberation, DELIBERATION } =
  require(path.join(ROOT, 'session', 'publish.cjs'));
const { open } = require(path.join(ROOT, 'session', 'open.cjs'));
const { readPages, semanticFingerprint, appearanceFingerprint } =
  require(path.join(ROOT, 'session', 'fingerprint.cjs'));

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

/**
 * The planted phrases COME FROM THE RULER ITSELF — one per field that
 * `DELIBERATION` sends away, plus one per item it erases whole.
 *
 * Writing them by hand was the first version's mistake, and the review caught
 * it: the list covered 6 of the 12 fields, and `buys`, `pays`, `chooseIf`,
 * `wrongIf`, `differsIn` and `agreement.snapshot` were never planted —
 * exactly the gap where the counter and the pruning had drifted apart.
 * Deriving from the ruler, a new field in the pruning is born with its mark
 * planted in the same commit.
 *
 * No mark resembles text the engine would produce: if it shows up in the XML,
 * it came from the dossier.
 */
const markFor = (where, field) => `MARK-${where}-${field}`.toUpperCase();

/** What HAS to survive — otherwise the pruning became censorship and the file is useless. */
const KEPT = {
  'the fact itself': 'MARK-FACT-ITSELF',
  "the chosen candidate's name": 'MARK-CANDIDATE-CHOSEN-NAME',
  'the label of a node in the drawing': 'MARK-NODE-LABEL',
};

async function main() {
  const logical = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'session', 'retail-logical.json'), 'utf8'));
  const elab = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'session', 'retail-elaboration.json'), 'utf8'));

  // ---------------------------------------------------------------- 1 · plant
  const seeded = JSON.parse(JSON.stringify(logical));
  const d = seeded.dossier;
  const chosen = d.candidates.find(c => c.state === 'chosen');
  chosen.name = KEPT["the chosen candidate's name"];
  d.facts[0].provenance = 'inferred';
  d.facts[0].fact = KEPT['the fact itself'];
  seeded.nodes[0].label = KEPT['the label of a node in the drawing'];
  // `agreement` is written by `approve`, so the mark for who approved goes in through there
  const BY_MARK = markFor('agreement', 'by');

  const technical = elaborate(approve(seeded, { at: '2026-08-21', by: BY_MARK }), elab);

  /**
   * The planting, derived from the ruler. Runs AFTER `elaborate` because it is
   * the one that rewrites each parking-lot entry's note when returning it in
   * the technical phase (#15 §5) — planting before would measure the
   * elaborator's own text.
   */
  const MARKS = {};
  const list = (dd, where) => (Array.isArray(dd[where]) ? dd[where] : dd[where] ? [dd[where]] : []);
  for (const r of DELIBERATION) {
    for (const it of list(technical.dossier, r.onde)) {
      for (const c of r.campos) {
        // only plant where the value is text: `snapshot` and `differsIn` are
        // structure, and swapping them for a string would break the schema.
        // For those, the mark goes INSIDE — a key that does not exist anywhere.
        const m = markFor(r.onde, c);
        if (c === 'snapshot') { if (it[c]) { it[c][m] = m; MARKS[`${r.onde}.${c}`] = m; } continue; }
        if (c === 'differsIn') { if (Array.isArray(it[c])) { /* closed enum — not plantable */ } continue; }
        it[c] = m;
        MARKS[`${r.onde}.${c}`] = m;
      }
    }
  }
  MARKS['agreement.by'] = BY_MARK;
  // and the item that vanishes WHOLE: a discarded candidate, marked in the name
  const discarded = technical.dossier.candidates.find(c => c.state === 'discarded');
  discarded.name = markFor('candidates', 'discarded-name');
  MARKS['candidates[discarded].name'] = discarded.name;

  const working = (await draw(technical, 'technical')).xml;
  const copy = publish(working);

  // -------------------------------------------------- 2 · the control, first
  //
  // Before claiming the copy does not have the marks, prove that the WORKING
  // file DOES. A search that finds nothing in either file does not
  // distinguish "it was pruned" from "the search is broken".
  console.log(`\n1 · control: the WORKING file carries everything — ${Object.keys(MARKS).length} fields from the ruler\n`);
  for (const [name, mark] of Object.entries(MARKS))
    ok(working.includes(mark), `${name} is in the working file`);
  // and the ruler has to be covered: a new field in DELIBERATION without a
  // mark here is the gap #23's review found
  const expected = DELIBERATION.flatMap(r => r.campos.filter(c => c !== 'differsIn').map(c => `${r.onde}.${c}`));
  const missingMark = expected.filter(k => !(k in MARKS));
  ok(missingMark.length === 0, 'every field in the ruler has a planted mark',
    missingMark.length ? `no mark: ${missingMark.join(', ')}` : `${expected.length} fields`);

  // ------------------------------------------------------------- 3 · the pruning
  console.log('\n2 · the published copy: the deliberation does not leave the house\n');
  for (const [name, mark] of Object.entries(MARKS))
    ok(!copy.includes(mark), `${name} is NOT in the copy`,
      copy.includes(mark) ? 'LEAKED' : undefined);

  console.log('\n3 · and what stays, stays — pruning is not censorship\n');
  for (const [name, mark] of Object.entries(KEPT))
    ok(copy.includes(mark), `${name} survived`);

  // the fingerprints carry on: they are what proves the PNG is this very file
  const pubs = readPages(copy).pages;
  ok(pubs.every(p => p.seal && p.seal.panlabsSemantica && p.seal.panlabsAparencia),
    'the drawing fingerprints survived on every page',
    `${pubs.length} page(s)`);
  ok(pubs.every(p => p.seal.panlabsRetomavel === 'nao'),
    'every page of the copy declares itself not-resumable');

  /**
   * AND THE DRAWING IS THE SAME DRAWING — cell by cell, in both fingerprints.
   *
   * This is the claim the whole decision rests on, and it would be the
   * easiest one to break without noticing: the copy that circulates has to be
   * the SAME diagram, not a similar one. If the pruning touched a coordinate
   * or a label, the user would send out something they never saw on screen.
   */
  const workingPages = readPages(working).pages;
  const sameDrawing = workingPages.length === pubs.length && workingPages.every((p, i) =>
    semanticFingerprint(p.cells) === semanticFingerprint(pubs[i].cells) &&
    appearanceFingerprint(p.cells) === appearanceFingerprint(pubs[i].cells));
  ok(sameDrawing, 'and the drawing is cell for cell the same — the pruning only touches the seal',
    `${workingPages.length} pages, identical semantics and appearance`);

  // ------------------------------------------------------- 4 · the copy announces itself
  console.log('\n4 · the copy declares itself, instead of looking like a broken working file\n');
  const a = open(copy);
  ok(a.ours === true, 'the skill still recognizes the file as its own');
  ok(a.published === true, 'and knows it is a published copy');
  ok(a.session === null, 'does not return a session — there is nothing to resume');
  ok(/publicada/i.test(a.because || ''), 'and says why', (a.because || '').slice(0, 70) + '…');

  const t = open(working);
  ok(t.published !== true && t.session !== null,
    'control: the working file keeps resuming normally');

  // ------------------------------------------------------------- 5 · the warning
  console.log('\n5 · the one-line warning (#16 pattern: warns, never blocks)\n');
  const warning = dossierWarning(technical);
  ok(!!warning && /deliberacao/i.test(warning), 'the session with deliberation produces a warning', (warning || '').slice(0, 62) + '…');
  ok(dossierWarning(prune(technical)) === null,
    'and the already-pruned session does NOT produce a warning — the warning measures, it does not decorate');
  /**
   * THE COUNTER MUST NOT DOUBLE-COUNT nor leave a field out — the two defects
   * the review found, one in each direction.
   */
  const onlyOneField = (where, field, value) => {
    const t = prune(JSON.parse(JSON.stringify(technical)));
    const target = list(t.dossier, where)[0];
    if (!target) return null;
    target[field] = value;
    return countDeliberation(t);
  };
  for (const r of DELIBERATION)
    for (const c of r.campos) {
      if (c === 'differsIn' || c === 'snapshot') continue;
      const n = onlyOneField(r.onde, c, 'x');
      if (n === null) continue;
      ok(n === 1, `a single "${r.onde}.${c}" counts as exactly 1`, `counted ${n}`);
    }
  const duplicate = prune(JSON.parse(JSON.stringify(technical)));
  duplicate.dossier.candidates.push({ id: 'z', name: 'Z', tuple: ['a', 'b', 'c', 'd', 'e'],
    state: 'discarded', because: 'x', pays: 'y' });
  ok(countDeliberation(duplicate) === 1,
    'a discarded candidate WITH `because` and `pays` counts 1, not 3',
    `counted ${countDeliberation(duplicate)}`);
  const r = await draw(technical, 'logical');
  ok(r.relatorio.avisos.some(x => /Editar diagrama/.test(x)),
    'and it reaches the report of whoever drew it');

  // ------------------------------------------------- 6 · the pruning is deterministic
  console.log('\n6 · the pruning is a pure, deterministic function\n');
  const before = JSON.stringify(technical);
  const p1 = JSON.stringify(prune(technical));
  ok(JSON.stringify(technical) === before, 'pruning does not mutate the caller\'s session');
  ok(p1 === JSON.stringify(prune(technical)), 'pruning twice gives the same result');
  ok(p1 === JSON.stringify(prune(JSON.parse(p1))), 'pruning the already-pruned is a no-op (idempotent)');
  ok(publish(copy) === copy, 'publishing the copy returns the same copy');

  console.log(failures
    ? `\n  ✗ ${failures} check(s) failed — the dossier is not where the decision says it is.\n`
    : '\n  ✓ the deliberation stays in the working file and does not leave in the copy that circulates.\n');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
