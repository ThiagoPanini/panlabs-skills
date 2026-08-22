#!/usr/bin/env node
'use strict';
/**
 * A fronteira do #11, conferida sobre o esquema NOVO.
 *
 * O #11 fez de "o agente nunca escreve coordenada" uma propriedade do formato em
 * vez de uma promessa: o esquema nao tem onde escrever uma coordenada. Esta
 * checagem existe porque o #14 acrescenta um esquema — e um esquema novo e
 * exatamente por onde uma regra dessas se perde. Quem escreve o `sessao@1` e o
 * mesmo agente, e a tentacao de "so um `x` aqui para essa caixa ficar melhor" e
 * a mesma.
 *
 * Confere as tres condicoes do #11 sobre `sessao@1` e sobre os modelos do caso.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

const GEOMETRIA = [
  'x', 'y', 'w', 'h', 'cx', 'cy', 'dx', 'dy',
  'width', 'height', 'largura', 'altura', 'tamanho', 'size',
  'pos', 'posicao', 'position', 'coord', 'coordenada', 'ponto', 'pontos', 'point', 'points',
  'waypoint', 'waypoints', 'bend', 'bendpoints', 'offset', 'deslocamento',
  'top', 'left', 'right', 'bottom', 'topo', 'esquerda', 'direita', 'fundo',
  'margin', 'margem', 'padding', 'recuo', 'spacing', 'espacamento', 'gap', 'calha', 'lane',
  'align', 'alinhamento', 'anchor', 'ancora', 'grid', 'grade', 'scale', 'escala',
  'z', 'zorder', 'zindex', 'linha', 'coluna', 'row', 'col', 'column', 'eixo', 'axis',
  'style', 'estilo', 'cor', 'color', 'fill', 'stroke',
];

const normal = k => k.toLowerCase().replace(/[^a-z]/g, '');
const falhas = [];

// 1 e 2 · o esquema -----------------------------------------------------------
const esquema = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sessao', 'esquema.json'), 'utf8'));
const props = new Set();
const semFechar = [];

(function andar(no, caminho) {
  if (!no || typeof no !== 'object') return;
  if (Array.isArray(no)) return no.forEach((v, i) => andar(v, `${caminho}[${i}]`));
  if (no.properties) {
    for (const k of Object.keys(no.properties)) props.add(k);
    // `acordo.recorte` guarda a projecao aprovada tal como ela saiu: e dado, nao
    // esquema, e nao tem `properties` — cai fora desta regra por construcao.
    if (no.additionalProperties !== false && no.type === 'object') semFechar.push(caminho || '(raiz)');
  }
  for (const [k, v] of Object.entries(no)) andar(v, `${caminho}/${k}`);
})(esquema, '');

for (const p of props)
  if (GEOMETRIA.includes(normal(p)))
    falhas.push(`sessao@1 declara a propriedade "${p}" — vocabulario de geometria`);
for (const c of semFechar)
  falhas.push(`objeto sem additionalProperties:false em ${c} — da para contrabandear chave`);

// 3 · os modelos do caso ------------------------------------------------------
const dir = path.join(RAIZ, 'modelo');
const modelos = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
for (const arq of modelos) {
  const bruto = JSON.parse(fs.readFileSync(path.join(dir, arq), 'utf8'));
  (function varrer(no, caminho) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach((v, i) => varrer(v, `${caminho}[${i}]`));
    for (const [k, v] of Object.entries(no)) {
      if (caminho.startsWith('dossie')) continue;      // opaco ao motor por contrato (#11)
      if (GEOMETRIA.includes(normal(k))) falhas.push(`${arq}: chave "${k}" em ${caminho}`);
      varrer(v, caminho ? `${caminho}.${k}` : k);
    }
  })(bruto, '');
}

// 4 · nenhum numero que seja pixel --------------------------------------------
// O `sessao@1` tem inteiros legitimos (`ordem` de passo). O que nao pode e numero
// grande solto: coordenada de pagina vive na casa das centenas.
for (const arq of modelos) {
  const bruto = JSON.parse(fs.readFileSync(path.join(dir, arq), 'utf8'));
  (function varrer(no, caminho) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach((v, i) => varrer(v, `${caminho}[${i}]`));
    for (const [k, v] of Object.entries(no)) {
      if (caminho.startsWith('dossie')) continue;
      if (typeof v === 'number' && Math.abs(v) > 100)
        falhas.push(`${arq}: numero ${v} em ${caminho}.${k} — grande demais para nao ser pixel`);
      varrer(v, caminho ? `${caminho}.${k}` : k);
    }
  })(bruto, '');
}

console.log(`  propriedades declaradas em sessao@1: ${props.size}`);
console.log(`  nenhuma delas em geometria:          ${falhas.length ? 'NAO' : 'sim'}`);
console.log(`  modelos varridos:                    ${modelos.length} (${modelos.join(', ')})`);

if (falhas.length) {
  console.log('\n  ✗ a fronteira vazou:');
  for (const f of falhas) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('\n  ✓ o modelo de sessao tambem nao tem onde escrever uma coordenada.');
