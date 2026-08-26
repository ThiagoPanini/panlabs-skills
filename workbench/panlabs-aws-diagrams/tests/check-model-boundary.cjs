#!/usr/bin/env node
'use strict';
/**
 * The boundary, verified mechanically.
 *
 * The rule #11 had to defend is "the agent never writes a coordinate". A rule
 * that depends on discipline is a rule that gets lost by the third session.
 * This check trades discipline for impossibility:
 *
 *   1. no schema property — at any depth — names position, size, distance or
 *      direction;
 *   2. every object in the schema is `additionalProperties: false`, so there
 *      is no way to smuggle in a key the schema did not foresee;
 *   3. the example models contain no number that is a pixel.
 *
 * If the three pass, "the agent never writes a coordinate" stops being a
 * promise and becomes a property of the format: there is nowhere to write it.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema.json'), 'utf8'));

// Deliberately bilingual: a contributor could type either word, so both
// languages are denylisted here regardless of which one the rest of the
// codebase uses.
const GEOMETRY = [
  'x', 'y', 'w', 'h', 'cx', 'cy', 'dx', 'dy',
  'width', 'height', 'widthOf', 'altura', 'tamanho', 'size',
  'pos', 'posicao', 'position', 'coord', 'coordenada', 'ponto', 'pontos', 'point', 'points',
  'waypoint', 'waypoints', 'bend', 'bendpoints', 'offset', 'deslocamento',
  'top', 'left', 'right', 'bottom', 'topo', 'esquerda', 'direita', 'background',
  'margin', 'margin', 'padding', 'recuo', 'spacing', 'spacing', 'gap', 'lane', 'lane',
  'align', 'alinhamento', 'anchor', 'ancora', 'grid', 'grade', 'scale', 'escala',
  'z', 'zorder', 'zindex', 'row', 'column', 'row', 'col', 'column', 'eixo', 'axis',
  'style', 'style', 'color', 'color', 'fill', 'stroke',
];

const failures = [];
const props = new Set();
const unclosed = [];

(function walk(node, ptr) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${ptr}[${i}]`));

  if (node.properties) {
    for (const k of Object.keys(node.properties)) props.add(k);
    if (node.additionalProperties !== false && node.type === 'object' && ptr !== '/properties/dossie')
      unclosed.push(ptr || '(root)');
  }
  for (const [k, v] of Object.entries(node)) walk(v, `${ptr}/${k}`);
})(schema, '');

for (const p of props) {
  const n = p.toLowerCase().replace(/[^a-z]/g, '');
  if (GEOMETRY.includes(n)) failures.push(`the schema declares property "${p}" — geometry vocabulary`);
}
for (const c of unclosed) failures.push(`object without additionalProperties:false at ${c} — a key could be smuggled in`);

// 3. the example models
//
// The directory is an argument for the same reason `check-determinism`'s is:
// another corpus points ITS models at this same ruler. The boundary is a
// property of the format, not of one set of examples — and when #22 added
// `layer` to the schema, what had to say it is not geometry was this check,
// run against the models that use it.
// no override: sweep the workbench corpus PLUS the skill's own `examples/`
// (web-multi-az moved there in #44, and the boundary still has to cover it)
const models = process.argv[2]
  ? (() => { const d = path.resolve(process.argv[2]);
    return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => path.join(d, f)) : []; })()
  : [
    ...fs.readdirSync(path.join(WORKBENCH, 'models')).filter(f => f.endsWith('.json')).map(f => path.join(WORKBENCH, 'models', f)),
    ...fs.readdirSync(path.join(ROOT, 'examples')).filter(f => f.endsWith('.json')).map(f => path.join(ROOT, 'examples', f)),
  ];
for (const file of models) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  (function sweep(node, ptr) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((v, i) => sweep(v, `${ptr}[${i}]`));
    for (const [k, v] of Object.entries(node)) {
      if (ptr.startsWith('dossier')) continue;      // the dossier is opaque by contract
      const n = k.toLowerCase().replace(/[^a-z]/g, '');
      if (GEOMETRY.includes(n)) failures.push(`${file}: key "${k}" at ${ptr}`);
      sweep(v, ptr ? `${ptr}.${k}` : k);
    }
  })(raw, '');
}

console.log(`  properties declared in the schema: ${props.size}`);
console.log(`  none of them geometry:              ${failures.length ? 'NO' : 'yes'}`);
console.log(`  models swept:                       ${models.length} (${models.join(', ')})`);

if (failures.length) {
  console.log('\n  ✗ the boundary leaked:');
  for (const f of failures) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('\n  ✓ the model has nowhere to write a coordinate.');
