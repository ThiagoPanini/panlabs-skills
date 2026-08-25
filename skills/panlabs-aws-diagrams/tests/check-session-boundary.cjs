#!/usr/bin/env node
'use strict';
/**
 * A fronteira do #11, conferida sobre o esquema NOVO.
 *
 * O #11 fez de "o agente nunca escreve coordenada" uma propriedade do formato em
 * vez de uma promessa: o esquema nao tem onde escrever uma coordenada. Esta
 * checagem existe porque o #14 acrescenta um esquema — e um esquema novo e
 * exatamente por onde uma regra dessas se perde. Quem escreve o `session@1` e o
 * mesmo agente, e a tentacao de "so um `x` aqui para essa caixa ficar melhor" e
 * a mesma.
 *
 * Confere as tres condicoes do #11 sobre `session@1` e sobre os modelos do caso.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

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

const normal = k => k.toLowerCase().replace(/[^a-z]/g, '');
const falhas = [];

// 1 e 2 · o esquema -----------------------------------------------------------
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'session', 'schema.json'), 'utf8'));
const props = new Set();
const unclosed = [];

(function tier(no, caminho) {
  if (!no || typeof no !== 'object') return;
  if (Array.isArray(no)) return no.forEach((v, i) => tier(v, `${caminho}[${i}]`));
  if (no.properties) {
    for (const k of Object.keys(no.properties)) props.add(k);
    // `acordo.recorte` guarda a projecao aprovada tal como ela saiu: e dado, nao
    // esquema, e nao tem `properties` — cai fora desta regra por construcao.
    if (no.additionalProperties !== false && no.type === 'object') unclosed.push(caminho || '(raiz)');
  }
  for (const [k, v] of Object.entries(no)) tier(v, `${caminho}/${k}`);
})(schema, '');

for (const p of props)
  if (GEOMETRY.includes(normal(p)))
    falhas.push(`session@1 declara a propriedade "${p}" — vocabulario de geometria`);
for (const c of unclosed)
  falhas.push(`objeto sem additionalProperties:false em ${c} — da para contrabandear chave`);

// 3 · os modelos do caso ------------------------------------------------------
const dir = path.join(ROOT, 'models', 'session');
const modelos = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
for (const arq of modelos) {
  const bruto = JSON.parse(fs.readFileSync(path.join(dir, arq), 'utf8'));
  (function sweep(no, caminho) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach((v, i) => sweep(v, `${caminho}[${i}]`));
    for (const [k, v] of Object.entries(no)) {
      if (caminho.startsWith('dossier')) continue;      // opaco ao motor por contrato (#11)
      if (GEOMETRY.includes(normal(k))) falhas.push(`${arq}: chave "${k}" em ${caminho}`);
      sweep(v, caminho ? `${caminho}.${k}` : k);
    }
  })(bruto, '');
}

// 4 · nenhum numero que seja pixel --------------------------------------------
// O `session@1` tem inteiros legitimos (`ordem` de passo). O que nao pode e numero
// grande solto: coordenada de pagina vive na casa das centenas.
for (const arq of modelos) {
  const bruto = JSON.parse(fs.readFileSync(path.join(dir, arq), 'utf8'));
  (function sweep(no, caminho) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach((v, i) => sweep(v, `${caminho}[${i}]`));
    for (const [k, v] of Object.entries(no)) {
      if (caminho.startsWith('dossier')) continue;
      if (typeof v === 'number' && Math.abs(v) > 100)
        falhas.push(`${arq}: numero ${v} em ${caminho}.${k} — grande demais para nao ser pixel`);
      sweep(v, caminho ? `${caminho}.${k}` : k);
    }
  })(bruto, '');
}

console.log(`  propriedades declaradas em session@1: ${props.size}`);
console.log(`  nenhuma delas em geometria:          ${falhas.length ? 'NAO' : 'sim'}`);
console.log(`  modelos varridos:                    ${modelos.length} (${modelos.join(', ')})`);

if (falhas.length) {
  console.log('\n  ✗ a fronteira vazou:');
  for (const f of falhas) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('\n  ✓ o modelo de sessao tambem nao tem onde escrever uma coordenada.');
