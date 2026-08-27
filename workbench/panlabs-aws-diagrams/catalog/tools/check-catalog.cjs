#!/usr/bin/env node
/**
 * Static catalog checks. Run without rendering anything.
 *
 *   node check-catalog.cjs                 # self-contained checks
 *   node check-catalog.cjs /tmp/drawio     # + round-trip against upstream
 *
 * The check that matters most is the round-trip one: it proves that storing
 * `template + (category, stencil)` instead of 1009 literal strings is
 * COMPACTION, not loss — every reconstructed style matches byte for byte what
 * Sidebar-AWS4.js produces.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// catalog/tools/ and catalog/tests/ moved to the workbench sibling in #45;
// aws-shapes.cjs and the two JSON files it reads stayed in the skill.
const dir = path.join(__dirname, '..', '..', '..', '..', 'skills', 'panlabs-aws-diagrams', 'catalog');
const { load, applyTemplate, fixGroup } = require(path.join(dir, 'aws-shapes.cjs'));

const cat = load(dir);
const catalog = cat.catalog;
const corrections = cat.corrections;

const failures = [];
const notes = [];
function verify(name, ok, detail) {
  if (ok) notes.push(`  ok    ${name}${detail ? ' — ' + detail : ''}`);
  else failures.push(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
}

// ------------------------------------------------- 1. catalog integrity

verify('extraction has no broken reference',
  catalog.meta.referenciasQuebradas.length === 0,
  `${catalog.meta.stencilsDeclarados} stencils declared in aws4.xml`);

const missingStencil = [...catalog.services, ...catalog.resources].filter(e => !e.stencil);
verify('every entry has a stencil', missingStencil.length === 0,
  missingStencil.length ? missingStencil.map(e => e.title).join(', ') : `${catalog.services.length + catalog.resources.length} entries`);

const badHex = Object.entries(catalog.categories)
  .filter(([, c]) => !/^#[0-9A-Fa-f]{6}$/.test(c.fill || ''));
verify('every category has a valid hex color', badHex.length === 0,
  badHex.length ? badHex.map(([k]) => k).join(', ') : `${Object.keys(catalog.categories).length} categories`);

// ------------------------------------------------------- 2. the two paths

// The failure mode the ticket names: looking up only by resourceIcon makes the
// generator conclude that S3 Tables, EventBridge Pipes/Scheduler and Trainium
// don't exist, and fall back needlessly.
const twoPaths = ['s3 tables', 's3 express one zone', 'eventbridge pipes',
                  'eventbridge scheduler', 'trainium', 'inferentia'];
for (const name of twoPaths) {
  const r = cat.service(name);
  verify(`resource icon path: ${name}`,
    !!r && r.via.startsWith('resource'),
    r ? `${r.title} -> ${r.stencil} (${r.via})` : 'not resolved');
}

// ---------------------------------------------------------- 3. renames/acronyms

const knownStencils = new Set(
  [...catalog.services, ...catalog.resources].map(e => e.stencil));

for (const tableName of ['renames', 'synonyms']) {
  const table = corrections[tableName];
  const bad = Object.entries(table)
    .filter(([k]) => !k.startsWith('_'))
    .filter(([, stencil]) => !knownStencils.has(stencil));
  verify(`${tableName} table points only to an existing stencil`,
    bad.length === 0,
    bad.length ? bad.map(([k, v]) => `${k}->${v}`).join(', ')
                 : `${Object.keys(table).length - 1} entries`);

  const unresolved = Object.keys(table).filter(k => !k.startsWith('_'))
    .filter(k => !cat.service(k));
  verify(`every ${tableName} key resolves`, unresolved.length === 0,
    unresolved.join(', ') || 'all');

  // Resolving != pointing. "sagemaker" pointed correctly in the table and
  // resolved wrong, because another service's obsolete title matched first.
  const drifted = Object.entries(table)
    .filter(([k]) => !k.startsWith('_'))
    .filter(([k, stencil]) => {
      const r = cat.service(k);
      return !r || r.stencil !== stencil;
    });
  verify(`every ${tableName} key resolves TO THE DECLARED STENCIL`,
    drifted.length === 0,
    drifted.map(([k, v]) => `${k}: expected ${v}, got ${(cat.service(k) || {}).stencil}`).join('; ')
      || 'all');
}

// ------------------------------------------------------------- 4. corrections

const legacyColors = Object.keys(corrections.legacyPalette).filter(k => !k.startsWith('_'));
let corrected = 0, missingContainer = [], withLegacy = [];

for (const g of catalog.groups) {
  const r = cat.group(g.title);
  if (!r) { failures.push(`  FAIL  group does not resolve: ${g.title}`); continue; }
  if (!/(^|;)container=1(;|$)/.test(r.style)) missingContainer.push(g.title);
  for (const l of legacyColors) if (r.style.includes(l)) withLegacy.push(`${g.title}:${l}`);
  if (r.corrections.length) corrected++;
}

verify('no group without container=1 after correction',
  missingContainer.length === 0, missingContainer.join(', ') || `${catalog.groups.length} groups`);
verify('no pre-2022 palette color survives on a group',
  withLegacy.length === 0, withLegacy.join(', ') || legacyColors.join(' '));
verify('the corrections actually took effect', corrected > 0, `${corrected} groups corrected`);

// The groups upstream delivers without container=1 (research §3.5).
const missingContainerUpstream = catalog.groups
  .filter(g => !/container=1/.test(g.style)).map(g => g.title);
verify('the 4 plain rectangles from upstream were identified',
  missingContainerUpstream.length === 4, missingContainerUpstream.join(', '));

// ------------------------------------------------------- 4b. disambiguation

// A service icon title that appears in two palettes with a different color
// (or stencil) is a time bomb: without a table, the choice becomes palette
// order.
const byTitle = new Map();
for (const s of catalog.services) {
  const n = cat.normalize(s.title);
  if (!byTitle.has(n)) byTitle.set(n, []);
  byTitle.get(n).push(s);
}
const colorOf = e => e.fill || cat.categoryColor(e.palette);
const ambiguous = [...byTitle.entries()]
  .filter(([, v]) => new Set(v.map(colorOf)).size > 1 || new Set(v.map(e => e.stencil)).size > 1)
  .map(([k]) => k);

const missingTable = ambiguous.filter(k => !corrections.disambiguation[k]);
verify('every ambiguous title has a disambiguation entry',
  missingTable.length === 0, missingTable.join(', ') || `${ambiguous.length} ambiguous titles covered`);

const badDisambiguation = Object.entries(corrections.disambiguation)
  .filter(([k]) => !k.startsWith('_'))
  .filter(([k, d]) => {
    const r = cat.service(k);
    return !r || r.stencil !== d.stencil || r.palette !== d.palette;
  });
verify('disambiguation actually governs resolution', badDisambiguation.length === 0,
  badDisambiguation.map(([k]) => k).join(', ') ||
  `${Object.keys(corrections.disambiguation).length - 1} entries`);

const openTieBreaks = Object.entries(corrections.disambiguation)
  .filter(([k, d]) => !k.startsWith('_') && d.review).map(([k]) => k);
notes.push(`  --    ${openTieBreaks.length} open arbitrary tie-breaks: ${openTieBreaks.join(', ')}`);

// ------------------------------------------------- 4c. substring never guesses wrong
//
// #139: two real queries where a genuine second word — not a typo, not a
// fragment of the first — collided with a DIFFERENT, unrelated catalog entry.
// "aurora serverless" matched both "Aurora" and the standalone "Serverless"
// category icon; "vpc endpoint" matched both "VPC" (the container) and
// "Endpoint" (the resource), and a tie-break used to hand the win to whichever
// candidate was a service icon — "VPC", discarding the endpoint the query
// actually named. Both must now refuse (fall to the generic icon, visibly)
// rather than confidently return the wrong shape.

const neverWrong = [
  ['aurora serverless', 'ambiguous between "Aurora" and the unrelated "Serverless" category icon'],
  ['vpc endpoint', 'ambiguous between the VPC container and the Endpoint resource — used to return VPC'],
];
for (const [name, why] of neverWrong) {
  const r = cat.service(name);
  verify(`"${name}" refuses instead of guessing wrong (${why})`,
    !!r && r.via === 'generic',
    r ? `${r.title} (${r.stencil}, ${r.via})` : 'not resolved');
}

// And the control: a genuine qualifier that does NOT collide with another
// catalog entry must keep resolving exactly as it did before — ambiguity
// refusing is not license for the substring step to get trigger-happy the
// other way and start refusing matches it used to get right.
const qualifierSurvives = [['aurora', 'aurora postgresql', 'aurora']];
for (const [base, qualified, stencil] of qualifierSurvives) {
  const rBase = cat.service(base);
  const rQualified = cat.service(qualified);
  verify(`qualifier does not topple a real match: "${base}" vs "${qualified}"`,
    !!rBase && !!rQualified && rBase.stencil === stencil && rQualified.stencil === stencil,
    `${base} -> ${rBase && rBase.stencil} (${rBase && rBase.via}); ` +
    `${qualified} -> ${rQualified && rQualified.stencil} (${rQualified && rQualified.via})`);
}

// ------------------------------------------------- 5. round-trip (needs a repo)

const repo = process.argv[2];
if (repo && fs.existsSync(repo)) {
  const tmp = path.join(require('os').tmpdir(), `catalog-roundtrip-${process.pid}.json`);
  execFileSync('node', [path.join(__dirname, 'extract-aws4-catalog.cjs'), repo, tmp],
    { stdio: ['ignore', 'ignore', 'ignore'] });
  const fresh = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  fs.unlinkSync(tmp);

  verify('re-extraction is deterministic',
    JSON.stringify(fresh) === JSON.stringify(catalog),
    'same commit -> same JSON');

  // Reconstructs each style from the template and compares it with upstream.
  let divergent = 0, literal = 0, reconstructed = 0;
  for (const [list, tplKey] of [[catalog.services, 'svc'], [catalog.resources, 'res']]) {
    for (const e of list) {
      if (e.style) { literal++; continue; }       // stored verbatim, nothing to reconstruct
      const fill = e.fill || cat.categoryColor(e.palette);
      const built = applyTemplate(catalog.templates[tplKey].style, { fill, stencil: e.stencil });
      const upstream = (tplKey === 'svc' ? fresh.services : fresh.resources)
        .find(x => x.stencil === e.stencil && x.title === e.title && x.palette === e.palette);
      const expected = upstream && upstream.style
        ? upstream.style
        : applyTemplate(fresh.templates[tplKey].style,
            { fill: upstream.fill || (fresh.categories[upstream.palette] || {}).fill, stencil: upstream.stencil });
      if (built !== expected) divergent++; else reconstructed++;
    }
  }
  verify('round-trip: reconstructed style == upstream style',
    divergent === 0,
    `${reconstructed} reconstructed, ${literal} literal, ${divergent} divergent`);

  // Every cited stencil exists in aws4.xml.
  const xml = fs.readFileSync(path.join(repo, 'src/main/webapp/stencils/aws4.xml'), 'utf8');
  const declared = new Set([...xml.matchAll(/<shape [^>]*name="([^"]*)"/g)]
    .map(m => m[1].replace(/ /g, '_').toLowerCase()));
  const cited = new Set([...knownStencils,
    ...catalog.groups.filter(g => g.grIcon).map(g => g.grIcon)]);
  const missing = [...cited].filter(s => !declared.has(s));
  verify('every cited stencil exists in aws4.xml', missing.length === 0,
    missing.join(', ') || `${cited.size} stencils`);
} else {
  notes.push('  --    round-trip skipped (pass the draw.io repo path to run it)');
}

// ----------------------------------------------------------------- result

console.log(`aws4 catalog — draw.io ${catalog.meta.drawio && catalog.meta.drawio.version}, commit ${(catalog.meta.commit || '').slice(0, 8)}`);
console.log(notes.join('\n'));
if (failures.length) {
  console.log(failures.join('\n'));
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log(`\nall ${notes.filter(n => n.includes('ok ')).length} checks passed.`);
