#!/usr/bin/env node
'use strict';
/**
 * A fronteira, verificada mecanicamente.
 *
 * A regra que o #11 tinha de defender é "o agente nunca escreve coordenada".
 * Regra que depende de disciplina é regra que se perde na terceira sessão. Esta
 * checagem troca disciplina por impossibilidade:
 *
 *   1. nenhuma propriedade do esquema — em nenhuma profundidade — nomeia
 *      posição, tamanho, distância ou direção;
 *   2. todo objeto do esquema é `additionalProperties: false`, então não dá
 *      para contrabandear uma chave que o esquema não previu;
 *   3. os modelos de exemplo não contêm nenhum número que seja pixel.
 *
 * Se as três passam, "o agente nunca escreve coordenada" deixa de ser promessa
 * e vira propriedade do formato: não existe onde escrever.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(RAIZ, 'schema.json'), 'utf8'));

const GEOMETRIA = [
  'x', 'y', 'w', 'h', 'cx', 'cy', 'dx', 'dy',
  'width', 'height', 'largura', 'altura', 'tamanho', 'size',
  'pos', 'posicao', 'position', 'coord', 'coordenada', 'ponto', 'pontos', 'point', 'points',
  'waypoint', 'waypoints', 'bend', 'bendpoints', 'offset', 'deslocamento',
  'top', 'left', 'right', 'bottom', 'topo', 'esquerda', 'direita', 'background',
  'margin', 'margin', 'padding', 'recuo', 'spacing', 'espacamento', 'gap', 'calha', 'lane',
  'align', 'alinhamento', 'anchor', 'ancora', 'grid', 'grade', 'scale', 'escala',
  'z', 'zorder', 'zindex', 'linha', 'coluna', 'row', 'col', 'column', 'eixo', 'axis',
  'style', 'style', 'color', 'color', 'fill', 'stroke',
];

const falhas = [];
const props = new Set();
const semFechar = [];

(function andar(no, caminho) {
  if (!no || typeof no !== 'object') return;
  if (Array.isArray(no)) return no.forEach((v, i) => andar(v, `${caminho}[${i}]`));

  if (no.properties) {
    for (const k of Object.keys(no.properties)) props.add(k);
    if (no.additionalProperties !== false && no.type === 'object' && caminho !== '/properties/dossie')
      semFechar.push(caminho || '(raiz)');
  }
  for (const [k, v] of Object.entries(no)) andar(v, `${caminho}/${k}`);
})(schema, '');

for (const p of props) {
  const n = p.toLowerCase().replace(/[^a-z]/g, '');
  if (GEOMETRIA.includes(n)) falhas.push(`o esquema declara a propriedade "${p}" — vocabulário de geometria`);
}
for (const c of semFechar) falhas.push(`objeto sem additionalProperties:false em ${c} — dá para contrabandear chave`);

// 3. os modelos de exemplo
//
// O diretório é argumento pelo mesmo motivo que o do `check-determinismo`:
// outro corpus aponta os SEUS modelos para esta mesma régua. A fronteira é
// propriedade do formato, não de um conjunto de exemplos — e quando o #22
// acrescentou `camada` ao esquema, quem tinha de dizer que ela não é geometria
// era esta checagem rodando contra os modelos que a usam.
const dirModelos = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, 'models');
const modelos = fs.existsSync(dirModelos) ? fs.readdirSync(dirModelos).filter(f => f.endsWith('.json')) : [];
for (const arq of modelos) {
  const bruto = JSON.parse(fs.readFileSync(path.join(dirModelos, arq), 'utf8'));
  (function varrer(no, caminho) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach((v, i) => varrer(v, `${caminho}[${i}]`));
    for (const [k, v] of Object.entries(no)) {
      if (caminho.startsWith('dossier')) continue;      // o dossiê é opaco por contrato
      const n = k.toLowerCase().replace(/[^a-z]/g, '');
      if (GEOMETRIA.includes(n)) falhas.push(`${arq}: chave "${k}" em ${caminho}`);
      varrer(v, caminho ? `${caminho}.${k}` : k);
    }
  })(bruto, '');
}

console.log(`  propriedades declaradas no esquema: ${props.size}`);
console.log(`  nenhuma delas em geometria:         ${falhas.length ? 'NÃO' : 'sim'}`);
console.log(`  modelos varridos:                   ${modelos.length} (${modelos.join(', ')})`);

if (falhas.length) {
  console.log('\n  ✗ a fronteira vazou:');
  for (const f of falhas) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('\n  ✓ o modelo não tem onde escrever uma coordenada.');
