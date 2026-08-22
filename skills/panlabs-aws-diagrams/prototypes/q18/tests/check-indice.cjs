#!/usr/bin/env node
'use strict';
/**
 * O índice é o contrato com a rubrica (#8), e esta checagem é o que impede ele
 * de derivar dela em silêncio.
 *
 * A rubrica tem 62 checagens mecanizáveis. Um índice com 61 não avisa que
 * perdeu uma: ele só reporta 61 linhas verdes, e a que sumiu vira um buraco que
 * ninguém procura. Por isso os 62 ids abaixo estão escritos à mão, lidos da
 * rubrica, e não derivados do índice — se fossem derivados, a checagem seria
 * o índice conferindo a si mesmo.
 *
 * Confere quatro coisas:
 *
 *   1. o conjunto de ids é exatamente o da rubrica — nem falta nem sobra;
 *   2. toda checagem declara família, severidade máxima e insumo;
 *   3. todo limiar que a rubrica marcou "default de engenharia" virou config
 *      nomeada, e não número solto no meio de um `if`;
 *   4. a divisão validador × render não tem sobreposição nem buraco: todo id
 *      cai em exatamente um dos dois lados, e quem cai no render diz por quê.
 */

const path = require('path');
const { CHECAGENS, LIMIARES, porId, SEVERIDADES, INSUMOS } = require(
  path.join(__dirname, '..', 'validador', 'indice.cjs'));

// Os 62 ids de (A), lidos da rubrica em docs/research/architecture-diagram-quality-rubric.md.
const DA_RUBRICA = [
  'A1.1', 'A1.2', 'A1.3', 'A1.4', 'A1.5', 'A1.6', 'A1.7', 'A1.8', 'A1.9', 'A1.10', 'A1.11', 'A1.12',
  'A2.1', 'A2.2', 'A2.3', 'A2.4', 'A2.5', 'A2.6', 'A2.7', 'A2.8', 'A2.9', 'A2.10', 'A2.11',
  'A3.1', 'A3.2', 'A3.3', 'A3.4', 'A3.5', 'A3.6', 'A3.7', 'A3.8', 'A3.9',
  'A4.1', 'A4.2', 'A4.3', 'A4.4', 'A4.5', 'A4.6', 'A4.7',
  'A5.1', 'A5.2', 'A5.3', 'A5.4', 'A5.5', 'A5.6', 'A5.7', 'A5.8', 'A5.9',
  'A6.1', 'A6.2', 'A6.3', 'A6.4', 'A6.5',
  'A7.1', 'A7.2', 'A7.3', 'A7.4', 'A7.5',
  'A8.1', 'A8.2', 'A8.3', 'A8.4',
];

// As checagens que a rubrica marca com tolerância zero e gravidade semântica —
// não são estéticas, e o ticket #18 pede confirmação explícita delas.
const TOLERANCIA_ZERO = ['A4.2', 'A5.5'];

const falhas = [];
const anota = m => falhas.push(m);

// ---------------------------------------------------------------- 1. o conjunto

const ids = CHECAGENS.map(c => c.id);
const conjunto = new Set(ids);

if (ids.length !== 62) anota(`o índice tem ${ids.length} checagens, a rubrica tem 62`);
if (conjunto.size !== ids.length) {
  const vistos = new Set();
  const repetidos = ids.filter(i => vistos.has(i) || (vistos.add(i), false));
  anota(`ids repetidos: ${[...new Set(repetidos)].join(', ')}`);
}
for (const id of DA_RUBRICA) if (!conjunto.has(id)) anota(`a rubrica tem "${id}" e o índice não`);
for (const id of ids) if (!DA_RUBRICA.includes(id)) anota(`o índice inventou "${id}", que não está na rubrica`);

// ---------------------------------------------------- 2. os campos obrigatórios

for (const c of CHECAGENS) {
  if (!c.nome) anota(`${c.id} sem nome`);
  if (c.familia !== c.id.split('.')[0]) anota(`${c.id} declara família "${c.familia}"`);
  if (!SEVERIDADES.includes(c.severidade)) anota(`${c.id} tem severidade "${c.severidade}", fora de ${SEVERIDADES.join('|')}`);
  if (!INSUMOS.includes(c.insumo)) anota(`${c.id} tem insumo "${c.insumo}", fora de ${INSUMOS.join('|')}`);
  if (!c.mede) anota(`${c.id} não diz o que mede`);
  if (!c.fonte) anota(`${c.id} não cita a fonte — a rubrica cita, o índice tem de citar`);
}

// -------------------------------------------- 3. os "defaults de engenharia"

// A lista é do U8 da rubrica, que é onde ela se dá ao trabalho de enumerar os
// números sem base experimental — e onde manda expô-los: "Devem ser expostos
// como configuração, não embutidos". A marcação in loco no corpo de cada
// checagem esquece duas (A8.3 e A8.4); o U8 é a lista completa, e é ele que vale.
const CALIBRAVEIS = ['A3.9', 'A4.7', 'A5.3', 'A5.7', 'A6.4', 'A7.4', 'A8.3', 'A8.4'];

for (const id of CALIBRAVEIS) {
  const c = porId(id);
  if (!c) continue;                       // já reportado acima
  if (!c.calibravel) anota(`${id} é "default de engenharia" na rubrica e o índice não marcou como calibrável`);
  if (!c.limiar || !c.limiar.chave) anota(`${id} é calibrável e não aponta para uma chave de limiares.json`);
  else if (!(c.limiar.chave in LIMIARES)) anota(`${id} aponta para a chave "${c.limiar.chave}", ausente de limiares.json`);
}

for (const c of CHECAGENS) {
  if (c.calibravel && !CALIBRAVEIS.includes(c.id))
    anota(`${c.id} se diz calibrável, mas a rubrica não o marcou como default de engenharia`);
}

// ------------------------------------------- 4. a divisão validador × render

for (const c of CHECAGENS) {
  if (c.insumo === 'render' && !c.porqueRender)
    anota(`${c.id} foi entregue ao render sem dizer por quê — a divisão do #18 exige o motivo`);
  if (c.insumo !== 'render' && c.porqueRender)
    anota(`${c.id} é do validador e mesmo assim justifica o render`);
}

for (const id of TOLERANCIA_ZERO) {
  const c = porId(id);
  if (!c) continue;
  if (c.severidade !== 'fail') anota(`${id} tem tolerância zero na rubrica e o índice não a marcou como fail`);
  if (c.insumo === 'render') anota(`${id} é a espinha semântica do validador e foi empurrada para o render`);
  if (!c.semantica) anota(`${id} não está marcada como falha semântica — é o que separa linter de guarda de veracidade`);
}

// ------------------------------------------------------------------ relatório

const doValidador = CHECAGENS.filter(c => c.insumo !== 'render');
console.log(`  checagens no índice:        ${CHECAGENS.length}/62`);
console.log(`  do validador (obrigatório): ${doValidador.length}`);
console.log(`  do render (oportunista):    ${CHECAGENS.length - doValidador.length}`);
console.log(`  fail / warn:                ${CHECAGENS.filter(c => c.severidade === 'fail').length} / ` +
  `${CHECAGENS.filter(c => c.severidade === 'warn').length}`);
console.log(`  limiares calibráveis:       ${CHECAGENS.filter(c => c.calibravel).length}`);

if (falhas.length) {
  console.log('\n  ✗ o índice não bate com a rubrica:');
  for (const f of falhas) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('\n  ✓ as 62 checagens da rubrica estão no índice, classificadas e com fonte.');
