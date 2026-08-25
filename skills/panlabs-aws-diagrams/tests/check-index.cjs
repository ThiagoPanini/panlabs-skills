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
const { CHECKS, THRESHOLDS, byId, SEVERITIES, INPUTS } = require(
  path.join(__dirname, '..', 'validator', 'index.cjs'));

// Os 62 ids de (A), congelados da rubrica de qualidade que originou o validador.
const FROM_RUBRIC = [
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
const ZERO_TOLERANCE = ['A4.2', 'A5.5'];

// A SEVERIDADE QUE A RUBRICA ATRIBUIU, checagem por checagem, lida do campo
// **Severidade:** de cada uma. Conferir só que o valor está em {fail, warn}
// não prova nada: um índice que trocasse `fail` por `warn` em A4.2 passaria
// nessa checagem e desarmaria a falha mais grave do validador em silêncio.
// Onde a rubrica dá dois níveis ("warn / fail acima de X"), o esperado aqui é o
// PIOR que a checagem pode emitir — que é o que o campo `severidade` significa.
const RUBRIC_SEVERITY = {
  'A1.1': 'fail', 'A1.2': 'fail', 'A1.3': 'fail', 'A1.4': 'fail', 'A1.5': 'fail', 'A1.6': 'fail',
  'A1.7': 'fail', 'A1.8': 'fail', 'A1.9': 'warn', 'A1.10': 'fail', 'A1.11': 'warn', 'A1.12': 'fail',
  'A2.1': 'fail', 'A2.2': 'fail', 'A2.3': 'fail', 'A2.4': 'warn', 'A2.5': 'fail', 'A2.6': 'fail',
  'A2.7': 'fail', 'A2.8': 'warn', 'A2.9': 'warn', 'A2.10': 'warn', 'A2.11': 'fail',
  'A3.1': 'fail', 'A3.2': 'fail', 'A3.3': 'fail', 'A3.4': 'fail', 'A3.5': 'fail', 'A3.6': 'fail',
  'A3.7': 'fail', 'A3.8': 'warn', 'A3.9': 'warn',
  'A4.1': 'fail', 'A4.2': 'fail', 'A4.3': 'fail', 'A4.4': 'fail', 'A4.5': 'warn', 'A4.6': 'warn', 'A4.7': 'warn',
  'A5.1': 'fail', 'A5.2': 'fail', 'A5.3': 'fail', 'A5.4': 'fail', 'A5.5': 'fail',
  'A5.6': 'warn', 'A5.7': 'warn', 'A5.8': 'fail', 'A5.9': 'warn',
  'A6.1': 'fail', 'A6.2': 'warn', 'A6.3': 'warn', 'A6.4': 'warn', 'A6.5': 'warn',
  'A7.1': 'fail', 'A7.2': 'fail', 'A7.3': 'fail', 'A7.4': 'warn', 'A7.5': 'fail',
  'A8.1': 'fail', 'A8.2': 'warn', 'A8.3': 'warn', 'A8.4': 'warn',
};

// As que a rubrica escreve com DOIS níveis, e que por isso têm de trazer
// `escalona: true` — quem decide o caso concreto é a checagem, não a tabela.
const SCALE_WITH = ['A2.1', 'A5.1', 'A5.2', 'A5.3', 'A5.4', 'A6.1', 'A8.1'];

const falhas = [];
const anota = m => falhas.push(m);

// ---------------------------------------------------------------- 1. o conjunto

const ids = CHECKS.map(c => c.id);
const conjunto = new Set(ids);

if (ids.length !== 62) anota(`o índice tem ${ids.length} checagens, a rubrica tem 62`);
if (conjunto.size !== ids.length) {
  const vistos = new Set();
  const repetidos = ids.filter(i => vistos.has(i) || (vistos.add(i), false));
  anota(`ids repetidos: ${[...new Set(repetidos)].join(', ')}`);
}
for (const id of FROM_RUBRIC) if (!conjunto.has(id)) anota(`a rubrica tem "${id}" e o índice não`);
for (const id of ids) if (!FROM_RUBRIC.includes(id)) anota(`o índice inventou "${id}", que não está na rubrica`);

// ---------------------------------------------------- 2. os campos obrigatórios

for (const c of CHECKS) {
  if (!c.name) anota(`${c.id} sem nome`);
  if (c.family !== c.id.split('.')[0]) anota(`${c.id} declara família "${c.family}"`);
  if (!SEVERITIES.includes(c.severity)) anota(`${c.id} tem severidade "${c.severity}", fora de ${SEVERITIES.join('|')}`);
  else if (RUBRIC_SEVERITY[c.id] && c.severity !== RUBRIC_SEVERITY[c.id])
    anota(`${c.id} está como "${c.severity}" e a rubrica diz "${RUBRIC_SEVERITY[c.id]}"`);
  if (SCALE_WITH.includes(c.id) && !c.escalona) anota(`${c.id} tem dois níveis na rubrica e não traz escalona: true`);
  if (!SCALE_WITH.includes(c.id) && c.escalona) anota(`${c.id} se diz escalonável, e a rubrica lhe dá um nível só`);
  if (!INPUTS.includes(c.input)) anota(`${c.id} tem insumo "${c.input}", fora de ${INPUTS.join('|')}`);
  if (!c.mede) anota(`${c.id} não diz o que mede`);
  if (!c.fonte) anota(`${c.id} não cita a fonte — a rubrica cita, o índice tem de citar`);
}

// -------------------------------------------- 3. os "defaults de engenharia"

// A lista é do U8 da rubrica, que é onde ela se dá ao trabalho de enumerar os
// números sem base experimental — e onde manda expô-los: "Devem ser expostos
// como configuração, não embutidos". A marcação in loco no corpo de cada
// checagem esquece duas (A8.3 e A8.4); o U8 é a lista completa, e é ele que vale.
const TUNABLE = ['A3.9', 'A4.7', 'A5.3', 'A5.7', 'A6.4', 'A7.4', 'A8.3', 'A8.4'];

for (const id of TUNABLE) {
  const c = byId(id);
  if (!c) continue;                       // já reportado acima
  if (!c.calibravel) anota(`${id} é "default de engenharia" na rubrica e o índice não marcou como calibrável`);
  if (!c.limiar || !c.limiar.key) anota(`${id} é calibrável e não aponta para uma chave de thresholds.json`);
  else if (!(c.limiar.key in THRESHOLDS)) anota(`${id} aponta para a chave "${c.limiar.key}", ausente de thresholds.json`);
}

for (const c of CHECKS) {
  if (c.calibravel && !TUNABLE.includes(c.id))
    anota(`${c.id} se diz calibrável, mas a rubrica não o marcou como default de engenharia`);
}

// ------------------------------------------- 4. a divisão validador × render

for (const c of CHECKS) {
  if (c.input === 'render' && !c.porqueRender)
    anota(`${c.id} foi entregue ao render sem dizer por quê — a divisão do #18 exige o motivo`);
  if (c.input !== 'render' && c.porqueRender)
    anota(`${c.id} é do validador e mesmo assim justifica o render`);
}

for (const id of ZERO_TOLERANCE) {
  const c = byId(id);
  if (!c) continue;
  if (c.severity !== 'fail') anota(`${id} tem tolerância zero na rubrica e o índice não a marcou como fail`);
  if (c.input === 'render') anota(`${id} é a espinha semântica do validador e foi empurrada para o render`);
  if (!c.semantica) anota(`${id} não está marcada como falha semântica — é o que separa linter de guarda de veracidade`);
}

// ------------------------------------------------------------------ relatório

const doValidador = CHECKS.filter(c => c.input !== 'render');
console.log(`  checagens no índice:        ${CHECKS.length}/62`);
console.log(`  do validador (obrigatório): ${doValidador.length}`);
console.log(`  do render (oportunista):    ${CHECKS.length - doValidador.length}`);
console.log(`  fail / warn:                ${CHECKS.filter(c => c.severity === 'fail').length} / ` +
  `${CHECKS.filter(c => c.severity === 'warn').length}`);
console.log(`  limiares calibráveis:       ${CHECKS.filter(c => c.calibravel).length}`);

if (falhas.length) {
  console.log('\n  ✗ o índice não bate com a rubrica:');
  for (const f of falhas) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('\n  ✓ as 62 checagens da rubrica estão no índice, classificadas e com fonte.');
