#!/usr/bin/env node
'use strict';
/**
 * #115 / #123 — THE GUIDE MEASURED AGAINST THE CONTRACTS IT DESCRIBES.
 *
 *   node tests/check-guide-contract.cjs
 *
 * `check-journey.cjs` already measures the front door, but it measures PATHS
 * inside documented commands — a row naming a tool that does not exist. It has
 * no opinion about field names, and #115 is the proof that the gap was load
 * bearing: after #53 converted every contract key to English, `guide/model.md`
 * kept describing `elaboration@1` with the names the rename had just killed —
 * `sobre`, `nos`, `casacos`, `dentro`, `refina`, `arestasCasaco` — and every
 * check in the suite stayed green, because prose is not parsed by anything.
 * Whoever followed the table wrote a delta the validator refuses field by
 * field.
 *
 * That is the SAME class of defect #53's own postmortem named: a contract key
 * has TWO ENDS, whoever writes it and whoever reads it, and converting one end
 * produces a green that lies. The guide is the second end.
 *
 * Four verdicts, and each one has to fail a planted defect before it counts —
 * layer 2's rule, applied to a document checker:
 *
 *   1  RETIRED VOCABULARY   no dead contract key survives inside backticks.
 *                           Curated list, each entry carrying the live name,
 *                           because "dead" is history and history cannot be
 *                           derived from today's schemas.
 *   2  EXAMPLES RUN         every fenced ```json block names a known contract
 *                           in `schema` and validates against it, and an
 *                           `elaboration@1` block also SURVIVES `elaborate()`
 *                           against the shipped approved model. #115's second
 *                           criterion, taken literally: the examples run.
 *   3  THE ITALIC IS TAUGHT `resource` and `qualifier` are named, their
 *                           precedence is stated, and a technical facet in a
 *                           fenced example actually carries a `resource`.
 *   4  THE ITALIC LANDS     the shipped example, through the real arc, puts
 *                           `<i>` on its technical leaves. #123's second
 *                           criterion — the blind run produced 0 of 24, and
 *                           the mechanism was never the problem.
 *
 * WHY VERDICT 4 READS THE SHIPPED EXAMPLE and not a model built here: the
 * blind run of #47 did not misread the guide, it copied the example. Every one
 * of the twelve technical facets in `retail-elaboration.json` glued the
 * description into the name — `"S3 · zona bruta"`, `"Lambda · parse e
 * curadoria"` — and the agent produced `"CloudTrail · trilha de auditoria
 * dedicada"`, the same shape. A guide that teaches the field while the example
 * next to it demonstrates the workaround loses to the example.
 *
 * QUARANTINE. The other four files under `guide/` carry the same debt — a
 * count is printed below and the ticket is named there. They are listed by
 * FILE rather than by word: the fix is a conversion per file, and a per-word
 * allowlist would grow into a second copy of the dead vocabulary.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const GUIDE = path.join(ROOT, 'guide');

const { againstSchema } = require(path.join(ROOT, 'engine', 'validate.cjs'));
const { approve } = require(path.join(ROOT, 'session', 'agreement.cjs'));
const { elaborate } = require(path.join(ROOT, 'session', 'elaborate.cjs'));
const { project } = require(path.join(ROOT, 'session', 'project.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));
const resolve = require(path.join(ROOT, 'engine', 'resolve.cjs'));
const theme = require(path.join(ROOT, 'theme', 'theme.cjs'));

let failures = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};

// ---------------------------------------------------------------------------
// The contracts, read from the files rather than restated here.

const SCHEMAS = {
  'panlabs-aws-diagrams/model@1': JSON.parse(fs.readFileSync(path.join(ROOT, 'schema.json'), 'utf8')),
  'panlabs-aws-diagrams/session@1': JSON.parse(fs.readFileSync(path.join(ROOT, 'session', 'schema.json'), 'utf8')),
  'panlabs-aws-diagrams/elaboration@1': JSON.parse(fs.readFileSync(path.join(ROOT, 'session', 'elaboration.schema.json'), 'utf8')),
  'panlabs-aws-diagrams/theme@1': JSON.parse(fs.readFileSync(path.join(ROOT, 'theme', 'schema.json'), 'utf8')),
};

/**
 * What #53 killed, and what took its place. Curated on purpose: "retired" is a
 * fact about history, and no amount of reading today's schemas recovers it.
 * Every entry was verified to appear in the tree BEFORE this ticket — an entry
 * for a name nobody ever wrote would be a rule that can never go red.
 */
const RETIRED = {
  esquema: 'schema', sobre: 'about', vista: 'view', genero: 'genre',
  nos: 'nodes', arestas: 'edges', faixas: 'bands', notas: 'notes', dossie: 'dossier',
  tipo: 'kind', rotulo: 'label', qualificador: 'qualifier', dentro: 'inside',
  servico: 'service', acesso: 'access', camada: 'layer', conta: 'account',
  habilita: 'enables', nota: 'note', membros: 'members',
  de: 'from', para: 'to', protocolo: 'protocol', dados: 'data', ordem: 'order',
  texto: 'text', origem: 'origin',
  casacos: 'facets', refina: 'refines', arestasCasaco: 'facetEdges', por: 'by',
  // enum values are contract too — a delta with `camada: "tecnica"` is refused
  // for the value as surely as for the key.
  tecnica: 'technical', ambas: 'both', volta: 'back', premissa: 'assumption',
  legenda: 'legend', 'achado-recusado': 'rejected-finding',
};

/** The file this ticket converted, and the one verdict 1 holds to the standard. */
const MEASURED = 'model.md';

/** Files under `guide/` still carrying the debt. Named ticket, not silence. */
const QUARANTINE = {
  'inquiry.md': '#124', 'report.md': '#124', 'visual.md': '#124', 'context-pack.md': '#124',
};

/** Backticked spans that are prose, not a contract key, and must not be read as one. */
const NOT_A_FIELD = new Set([
  'x',          // "injecting `x` into the schema" — the control experiment's stand-in
  'position',   // deliberately a key that does NOT exist: that is the point of the sentence
]);

/**
 * Keys the code reads but no schema declares — the elaboration's three maps are
 * `additionalProperties: true`, so their inner shape lives in `elaborate.cjs`
 * alone. The guide has to name them the way the code reads them or the reader
 * writes a delta that parses and does nothing.
 */
const READ_ONLY_BY_CODE = {
  rotulos: 'session/elaborate.cjs:93 — residue of #53, tracked in #124',
};

const backticked = text => [...text.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)]
  .map(m => m[1].trim());

/**
 * Three shapes carry a field name in this document, and a scanner that knows
 * only the first two goes green on the table where the names actually live:
 *
 *   `notes[].origin`                    a path
 *   `layer: "technical"`                a key AND its value — both are contract
 *   `{ edgeId: { by: [ids] } }`         the SHAPE column of every field table
 *
 * The third was missing until the review planted `{ id: casacos }` in place of
 * `{ id: technicalFacet }` and watched verdict 1 stay green — 48 of the 155
 * backticked spans in `model.md` were invisible, including rows 38-42, which is
 * the exact table #115 exists to fix. Inside braces every identifier is read;
 * prose does not live in there, so the extra reach costs nothing.
 */
function tokensOf(span) {
  if (span.includes('{')) return [...span.matchAll(/[A-Za-z_]\w*/g)].map(m => m[0]);
  const quoted = /^([A-Za-z_][\w-]*)\s*:\s*"([^"]*)"$/.exec(span);
  if (quoted) return [quoted[1], quoted[2]];
  // `service:substring` — a colon with NO quotes. The first draft returned []
  // here, and the review found the one dead name that survived the conversion
  // hiding in exactly that shape: the guide said `servico:substring` while
  // `catalog/aws-shapes.cjs:245` prints `service:` + the via.
  const bare = /^([A-Za-z_][\w-]*)\s*:\s*([A-Za-z_][\w-]*)$/.exec(span);
  if (bare) return [bare[1], bare[2]];
  if (!/^[A-Za-z_][\w-]*(\[\])?(\.[A-Za-z_][\w-]*(\[\])?)*$/.test(span)) return [];
  return span.split('.').map(s => s.replace('[]', ''));
}

function retiredIn(file) {
  const text = fs.readFileSync(path.join(GUIDE, file), 'utf8');
  const hits = new Map();
  for (const span of backticked(text)) {
    if (NOT_A_FIELD.has(span)) continue;
    for (const tok of tokensOf(span)) {
      if (NOT_A_FIELD.has(tok) || READ_ONLY_BY_CODE[tok]) continue;
      if (RETIRED[tok]) hits.set(tok, (hits.get(tok) || 0) + 1);
    }
  }
  return hits;
}

/** Every fenced ```json block in a guide file, parsed. */
function jsonBlocks(file) {
  const text = fs.readFileSync(path.join(GUIDE, file), 'utf8');
  const out = [];
  for (const m of text.matchAll(/```json\n([\s\S]*?)```/g)) {
    try { out.push({ raw: m[1], doc: JSON.parse(m[1]) }); }
    catch (e) { out.push({ raw: m[1], error: e.message }); }
  }
  return out;
}

const readExample = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'session', f), 'utf8'));
const approved = () => approve(readExample('retail-logical.json'), { at: '2026-08-21', by: 'user', candidate: 'cand-a' });

(async () => {
// ---------------------------------------------------------------------------
console.log('\n1 · the retired vocabulary is gone from the guide (#115)\n');

{
  const hits = retiredIn(MEASURED);
  const shown = [...hits.entries()].map(([k, n]) => `\`${k}\`→\`${RETIRED[k]}\`×${n}`).join(' ');
  ok(hits.size === 0,
    `guide/${MEASURED} names no key #53 retired`,
    hits.size ? shown : 'clean');

  let debt = 0;
  const cleared = [];
  for (const [file, ticket] of Object.entries(QUARANTINE)) {
    const n = [...retiredIn(file).values()].reduce((a, b) => a + b, 0);
    debt += n;
    if (n) console.log(`    · QUARANTINE ${file}: ${n} occurrence(s) — ${ticket}`);
    else cleared.push(file);
  }
  console.log(`    · ${debt} occurrence(s) still standing in ${Object.keys(QUARANTINE).length - cleared.length} quarantined file(s)`);

  // A quarantine that only ever grows is a list nobody reads. Two ways it rots,
  // both closed here: a file gets fixed and stays excused forever, and a NEW
  // guide file is born measured by nothing — verdict 1 names `model.md` by hand,
  // so the directory has to account for itself.
  ok(cleared.length === 0,
    'no quarantined file is already clean — a cleared one comes OFF the list',
    cleared.length ? `${cleared.join(', ')} — delete from QUARANTINE and #124 shrinks` : 'none is');

  const onDisk = fs.readdirSync(GUIDE).filter(f => f.endsWith('.md')).sort();
  const accounted = [MEASURED, ...Object.keys(QUARANTINE)].sort();
  ok(JSON.stringify(onDisk) === JSON.stringify(accounted),
    'every file under guide/ is either measured or named in the quarantine',
    onDisk.filter(f => !accounted.includes(f)).map(f => `${f} is neither`).join(', ') || `${onDisk.length} file(s)`);
}

// ---------------------------------------------------------------------------
console.log('\n2 · every JSON example in the guide runs against the contracts (#115)\n');

{
  const files = fs.readdirSync(GUIDE).filter(f => f.endsWith('.md') && !QUARANTINE[f]);
  let blocks = 0, elaborations = 0;

  for (const file of files) {
    for (const [i, block] of jsonBlocks(file).entries()) {
      blocks++;
      const where = `${file} block ${i + 1}`;
      if (block.error) { ok(false, `${where}: parses as JSON`, block.error); continue; }

      const schema = SCHEMAS[block.doc.schema];
      ok(!!schema, `${where}: declares a known contract`, String(block.doc.schema));
      if (!schema) continue;

      const errors = againstSchema(block.doc, schema, schema);
      ok(errors.length === 0, `${where}: validates against ${block.doc.schema}`, errors.slice(0, 3).join('; '));

      // As far as this goes, and no further: a teaching delta dresses a few nodes,
      // not all of them, so `project()` would throw on the first bare node — by
      // design. The proof that a delta reaches a DRAWING is verdict 4, on the
      // shipped example, which is the one that dresses everything.
      if (block.doc.schema === 'panlabs-aws-diagrams/elaboration@1') {
        elaborations++;
        let applied = null;
        try { applied = elaborate(approved(), block.doc); }
        catch (e) { ok(false, `${where}: survives elaborate() on the shipped model`, (e.erros || [e.message]).slice(0, 3).join('; ')); }
        if (applied) ok(true, `${where}: survives elaborate() on the shipped model`, `${applied.nodes.length} nodes`);
      }
    }
  }

  ok(blocks > 0, 'the guide carries at least one JSON example at all', `${blocks} block(s)`);
  ok(elaborations > 0, 'and at least one of them is a real elaboration@1 delta', `${elaborations}`);
}

// ---------------------------------------------------------------------------
console.log('\n3 · the guide teaches the italic line on the technical facet (#123)\n');

{
  const text = fs.readFileSync(path.join(GUIDE, 'model.md'), 'utf8');
  ok(/`resource`/.test(text), 'guide/model.md names `resource`');
  ok(/`qualifier`/.test(text), 'and names `qualifier`');
  ok(/resource[\s\S]{0,200}qualifier/.test(text.replace(/\n/g, ' ')),
    'and states the precedence between the two, in that order');

  const facets = jsonBlocks(MEASURED).filter(b => b.doc).flatMap(b => [
    ...Object.entries(b.doc.facets || {}),
    ...(b.doc.nodes || []).filter(n => n.technical).map(n => [n.id, n.technical]),
  ]);
  const withResource = facets.filter(([, f]) => typeof f.resource === 'string' && f.resource.length);
  ok(withResource.length > 0,
    'and a technical facet in a fenced example actually carries one',
    withResource.map(([, f]) => f.resource).join(', ') || 'none does');

  // "mostrando a linha em itálico RESULTANTE" — #123 asks the guide to print the
  // output, and a printed output nobody measures is a comment. Every row of the
  // guide's result table is held to what `resolve.leaf()` actually emits for the
  // facet above it; the numbers were right when written, and that is precisely
  // the state from which a table drifts.
  const leafOf = resolve.create(theme.load('corporate'));
  const rows = new Map(text.split('\n')
    .map(l => /^\|\s*`([a-z0-9-]+)`\s*\|([^|]*)\|([^|]*)\|/.exec(l))
    .filter(Boolean)
    .map(m => [m[1], { name: m[2].trim(), italic: m[3].trim().replace(/^\*|\*$/g, '') }]));

  let checked = 0;
  for (const [id, facet] of facets) {
    const row = rows.get(id);
    if (!row) continue;
    checked++;
    const emitted = leafOf.leaf({ id, ...facet }).label;
    const [name, italic = ''] = emitted.split('<br>');
    ok(name === row.name && italic.replace(/<\/?i>/g, '') === row.italic,
      `the guide's table for \`${id}\` matches what the engine emits`,
      `guide="${row.name} / ${row.italic}" engine="${name} / ${italic.replace(/<\/?i>/g, '')}"`);
  }
  ok(checked === facets.length,
    'and every facet in the example has a row in that table',
    `${checked}/${facets.length}`);
}

// ---------------------------------------------------------------------------
console.log('\n4 · the shipped example puts the italic on its technical leaves (#123)\n');

{
  const delta = readExample('retail-elaboration.json');
  const session = elaborate(approved(), delta);
  const { model } = project(session, 'technical');

  const declared = model.nodes.filter(n => n.resource);
  ok(declared.length >= 3,
    'the shipped elaboration declares `resource` on its concrete resources',
    `${declared.length} of ${model.nodes.filter(n => n.kind === 'service').length} service node(s)`);

  const { xml } = await generate(model, { tema: 'corporate' });
  const missed = declared.filter(n => {
    const m = xml.match(new RegExp(`<mxCell id="${n.id}"[^>]*value="([^"]*)"`));
    return !(m && m[1].includes(`&lt;i&gt;${n.resource}&lt;/i&gt;`));
  });
  // `declared.length > 0` is load bearing: with no resource anywhere, `missed`
  // is empty too, and the verdict would go green on the very defect it exists
  // to catch — 0 of 24, which is what the blind run actually produced.
  ok(declared.length > 0 && missed.length === 0,
    'and every one of them reaches the leaf as an italic second line',
    missed.length ? missed.map(n => n.id).join(', ') : `${declared.length}/${declared.length}`);

  const italics = (xml.match(/&lt;i&gt;/g) || []).length;
  ok(declared.length > 0 && italics >= declared.length,
    'the technical page carries at least that many italic lines',
    `${italics} in the XML`);
}

// ---------------------------------------------------------------------------
console.log('\n5 · control — each verdict knows how to fail\n');

{
  // 1 · a planted dead key is caught.
  // Planted in all three shapes a field name takes here. The brace form is the
  // one the review caught going green, and it is the one the field tables use.
  const planted = 'Uma linha `{ id: casacos }`, uma `camada: "tecnica"`, uma `notas[].origem`, e `facets` viva ao lado.';
  const hits = new Map();
  for (const span of backticked(planted)) for (const tok of tokensOf(span)) if (RETIRED[tok]) hits.set(tok, 1);
  for (const dead of ['casacos', 'camada', 'tecnica', 'notas', 'origem'])
    ok(hits.has(dead), `CONTROL 1: a planted \`${dead}\` is caught`, [...hits.keys()].join(','));
  ok(!hits.has('facets'), 'CONTROL 1: and the live `facets` beside them is not');

  // 2 · a delta that names a retired key no longer validates.
  const deadDelta = { schema: 'panlabs-aws-diagrams/elaboration@1', about: 'retail-300-stores', casacos: { loja: { kind: 'actor' } } };
  ok(againstSchema(deadDelta, SCHEMAS['panlabs-aws-diagrams/elaboration@1'], SCHEMAS['panlabs-aws-diagrams/elaboration@1']).length > 0,
    'CONTROL 2: the delta the OLD table taught is refused by the schema of today',
    'this is the defect #115 describes, reproduced');

  // 3 · the italic verdict would go red on the pre-#123 example.
  // Every place a `resource` can enter — the facets AND the new nodes. Stripping
  // only the facets left four behind and reported the baseline as 8. What is
  // left standing after a full strip is the `qualifier` fallback, which is the
  // other half of the same lesson: the count does not go to zero, it goes to
  // however many leaves have something to say without a nameable resource.
  const shipped = readExample('retail-elaboration.json');
  const glued = {
    ...shipped,
    facets: Object.fromEntries(Object.entries(shipped.facets).map(([id, f]) => [id, { ...f, resource: undefined }])),
    nodes: shipped.nodes.map(n => ({ ...n, technical: { ...n.technical, resource: undefined } })),
  };
  const gluedModel = project(elaborate(approved(), glued), 'technical').model;
  const gluedXml = (await generate(gluedModel, { tema: 'corporate' })).xml;
  const before = (gluedXml.match(/&lt;i&gt;/g) || []).length;
  const after = ((await generate(project(elaborate(approved(), readExample('retail-elaboration.json')), 'technical').model, { tema: 'corporate' })).xml.match(/&lt;i&gt;/g) || []).length;
  ok(after > before,
    'CONTROL 3: stripping `resource` back out drops the italic count — the example is what carries it',
    `with=${after} without=${before}`);

  // 4 · the blacklist must not outlive the names on it. A curated list of dead
  // words is a rule that can go WRONG in one direction the others cannot: the
  // day a schema introduces a key spelled like one of these, the check starts
  // failing correct prose, and the fastest way out is to delete the rule.
  const live = new Set();
  const walk = o => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.properties) for (const k of Object.keys(o.properties)) { live.add(k); walk(o.properties[k]); }
    if (o.definitions) for (const k of Object.keys(o.definitions)) { live.add(k); walk(o.definitions[k]); }
    if (Array.isArray(o.enum)) o.enum.forEach(v => typeof v === 'string' && live.add(v));
    if (typeof o.const === 'string') live.add(o.const);
    for (const k of ['items', 'additionalProperties', 'patternProperties', 'oneOf', 'anyOf', 'allOf']) if (o[k]) walk(o[k]);
  };
  Object.values(SCHEMAS).forEach(walk);
  const resurrected = Object.keys(RETIRED).filter(k => live.has(k));
  ok(resurrected.length === 0,
    'CONTROL 4: no name on the retired list is a live key today',
    resurrected.length ? resurrected.join(', ') : `${Object.keys(RETIRED).length} names, none of them live`);

  // 5 · and the one exception has to keep earning it. `rotulos` is excused only
  // because `elaborate.cjs` really reads it; when #124 renames it, this goes red
  // and the exception goes away with the same edit.
  const elaborateSrc = fs.readFileSync(path.join(ROOT, 'session', 'elaborate.cjs'), 'utf8');
  const stillRead = Object.keys(READ_ONLY_BY_CODE).filter(k => new RegExp(`\\.${k}\\b`).test(elaborateSrc));
  ok(stillRead.length === Object.keys(READ_ONLY_BY_CODE).length,
    'CONTROL 5: every key excused as read-only-by-code is still read by that code',
    stillRead.join(', ') || 'none is — delete the exception');
}

// ---------------------------------------------------------------------------
console.log(failures
  ? `\n  ✗ ${failures} failure(s)`
  : '\n  ✓ the guide names the contract of today, its examples run, and the italic line is both taught and produced.');
process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
