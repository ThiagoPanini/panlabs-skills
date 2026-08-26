#!/usr/bin/env node
'use strict';
/**
 * ONE contract, ONE file — the acceptance criterion #23 writes as "a single
 * `schema.json`".
 *
 * What it was naming: four files called `schema.json` in the tree, two of
 * them declaring the SAME `$id` (`panlabs-aws-diagrams/model@1`) with
 * diverging content — #11's, with `ou` and `habilita`, and #13's, with
 * `qualificador`. In that state the system's contract depends on which copy
 * `require` reached first, which is the definition of having no contract.
 *
 * The consolidation doesn't collapse everything into a single file, and it's
 * worth saying why: the other three `schema.json` files in the tree declare
 * DIFFERENT `$id`s — `theme@1` is #13's closed vocabulary, `session@1` is
 * #14's session model, `elaboration@1` is #14's technical-phase delta, with
 * no schema until #37. They're distinct contracts for distinct layers.
 * Merging them would produce a file that mixes audiences and has no owner.
 *
 * So the rule this check locks down is the strongest one that stays true:
 *
 *   1. every `$id` appears in EXACTLY ONE file in the production tree;
 *   2. the model contract (`model@1`) lives at the skill's ROOT, not inside
 *      the engine — it's what the agent writes, and the engine is only its
 *      first reader;
 *   3. whoever loads the schema loads THAT file (measured, not asserted);
 *   4. `model@1` is a superset of the two it replaced — no property from #11
 *      or #13 was lost in the merge;
 *   5. all FOUR contracts exist, and none is the exception only the corpus
 *      example describes — #37 closed the missing `elaboration@1`.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

/** The paths a `require(modulePath)` opens via `fs.readFileSync`, actually measured. */
function requireReads(modulePath) {
  const reads = [];
  const original = fs.readFileSync;
  fs.readFileSync = function (p, ...r) { reads.push(String(p)); return original.call(fs, p, ...r); };
  try {
    delete require.cache[require.resolve(modulePath)];
    require(modulePath);
  } finally { fs.readFileSync = original; }
  return reads;
}

/** Every .json in the production tree that declares itself a JSON Schema. */
function schemas(dir, excluded = new Set(['prototypes', 'node_modules', 'output'])) {
  const findings = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { findings.push(...schemas(p, excluded)); continue; }
    if (!e.name.endsWith('.json')) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (err) { continue; }
    if (j && typeof j === 'object' && j.$schema && j.$id) findings.push({ p, id: j.$id, j });
  }
  return findings;
}

const findings = schemas(ROOT);

console.log('\n1 · each contract in a single file\n');
const byId = new Map();
for (const a of findings) {
  if (!byId.has(a.id)) byId.set(a.id, []);
  byId.get(a.id).push(path.relative(ROOT, a.p));
}
for (const [id, files] of [...byId].sort())
  ok(files.length === 1, `${id}`, files.join(' + '));
ok(byId.size === 4, `${byId.size} distinct contracts in the tree — the FOUR from #37, no more, no less`,
  [...byId.keys()].sort().join(' · '));

console.log("\n2 · the model contract lives at the skill's root\n");
const forModel = byId.get('panlabs-aws-diagrams/model@1') || [];
ok(forModel.length === 1 && forModel[0] === 'schema.json',
  'panlabs-aws-diagrams/model@1 is in schema.json, at the root',
  forModel.join(', ') || 'not found');
ok(!fs.existsSync(path.join(ROOT, 'engine', 'schema.json')),
  'and there is NO LONGER a schema.json inside the engine');

console.log('\n2b · the fourth contract — elaboration@1 — lives next to whoever consumes it\n');
const fromElaboration = byId.get('panlabs-aws-diagrams/elaboration@1') || [];
ok(fromElaboration.length === 1 && fromElaboration[0] === 'session/elaboration.schema.json',
  'panlabs-aws-diagrams/elaboration@1 is in session/elaboration.schema.json',
  fromElaboration.join(', ') || 'not found');

console.log('\n3 · it is this file the engine loads (measured)\n');
{
  const reads = requireReads(path.join(ROOT, 'engine', 'generate.cjs'));
  const target = path.join(ROOT, 'schema.json');
  ok(reads.includes(target), 'engine/generate.cjs opened <root>/schema.json',
    reads.filter(p => p.endsWith('schema.json')).map(p => path.relative(ROOT, p)).join(', ') || 'none');
}

console.log('\n3b · and it is this file elaborate.cjs loads for the delta (measured)\n');
{
  const reads = requireReads(path.join(ROOT, 'session', 'elaborate.cjs'));
  const target = path.join(ROOT, 'session', 'elaboration.schema.json');
  ok(reads.includes(target), 'session/elaborate.cjs opened session/elaboration.schema.json',
    reads.filter(p => p.endsWith('.json')).map(p => path.relative(ROOT, p)).join(', ') || 'none');
}

console.log('\n4 · the merge lost no property from the two schemas it replaced\n');
{
  const props = j => {
    const out = new Set();
    (function walk(n, prefix) {
      if (!n || typeof n !== 'object') return;
      if (n.properties) for (const k of Object.keys(n.properties)) {
        out.add(`${prefix}${k}`);
        walk(n.properties[k], `${prefix}${k}.`);
      }
      for (const k of ['items', 'then', 'else']) if (n[k]) walk(n[k], prefix);
      for (const k of ['allOf', 'anyOf', 'oneOf']) if (Array.isArray(n[k])) n[k].forEach(x => walk(x, prefix));
      if (n.definitions) for (const [k, v] of Object.entries(n.definitions)) walk(v, `${k}.`);
    })(j, '');
    return out;
  };
  const production = props(JSON.parse(fs.readFileSync(path.join(ROOT, 'schema.json'), 'utf8')));
  /**
   * ⚠️ FROZEN LIST, AND IT REPLACED A GIT READ — #62.
   *
   * Up to this point this section rebuilt the two old schemas with `git show`
   * pointing at the prototypes, which lived outside the skill's tree. The
   * previous version of this file already wrote down what to do the day they
   * left: *"whoever removes them replaces the comparison against git with a
   * frozen list of properties — instead of inheriting an empty green"*. #62
   * deleted them, and this is that instruction carried out.
   *
   * The two lists below were EXTRACTED from git, not hand-written: this same
   * section's `props()` ran over the original content. #62 records both
   * addresses and the commit to reopen them from.
   *
   * The swap also removed the skill's ONLY reference to a path above its own
   * root (`REPO`, and the `execFileSync` that used it) — that's the direction
   * #46 requires: what's outside can point in, what's inside doesn't point out.
   */
  const FROZEN = {
    '#11': [
      'edge.data', 'edge.from', 'edge.id', 'edge.order', 'edge.to',
      'edge.protocol', 'edge.label', 'edges', 'dossier', 'schema',
      'band.id', 'band.members', 'band.label', 'band.kind', 'bands',
      'genre', 'id', 'node.access', 'node.az', 'node.layer', 'node.cidr', 'node.account',
      'node.inside', 'node.enables', 'node.id', 'node.note', 'node.ou', 'node.label',
      'node.service', 'node.kind', 'nodes', 'note.id', 'note.origin', 'note.about',
      'note.text', 'notes', 'subtitle', 'title', 'view',
    ],
    '#13': [
      'edge.data', 'edge.from', 'edge.id', 'edge.order', 'edge.to',
      'edge.protocol', 'edge.label', 'edges', 'dossier', 'schema',
      'band.id', 'band.members', 'band.label', 'band.kind', 'bands',
      'genre', 'id', 'node.access', 'node.az', 'node.cidr', 'node.account', 'node.inside',
      'node.id', 'node.note', 'node.qualifier', 'node.label', 'node.service',
      'node.kind', 'nodes', 'note.id', 'note.origin', 'note.about', 'note.text',
      'notes', 'subtitle', 'title', 'view',
    ],
  };
  /**
   * ⚠️ THE FLOOR EXISTS BECAUSE A FROZEN LIST CAN BE EMPTIED OUT.
   *
   * The git read had an obvious failure mode — the file disappearing — and
   * the previous version treated that as a FAILURE precisely so it wouldn't
   * inherit an empty green. A literal list has the inverse, quieter failure
   * mode: someone deletes a line to "fix" the check and it stays green,
   * claiming nothing was lost after checking less. The floor is the count
   * measured on the day of extraction; shrinking the list turns it red.
   */
  const FLOOR = { '#11': 39, '#13': 37 };
  for (const [label, previous] of Object.entries(FROZEN)) {
    ok(previous.length >= FLOOR[label], `${label}'s frozen list didn't shrink`,
      `${previous.length} of ${FLOOR[label]} properties`);
    const lost = previous.filter(p => !production.has(p));
    ok(lost.length === 0, `no property from ${label}'s schema was lost`,
      lost.length ? lost.join(', ') : `${previous.length} properties checked`);
  }
  for (const newProp of ['node.qualifier', 'node.ou', 'node.enables', 'node.layer'])
    ok(production.has(newProp), `and the single schema carries "${newProp}"`);
}

console.log(failures
  ? '\n  ✗ the contract still lives in more than one place.\n'
  : '\n  ✓ one contract, one file — and the engine reads the one at the root.\n');
process.exit(failures ? 1 : 0);
