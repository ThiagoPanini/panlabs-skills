#!/usr/bin/env node
'use strict';
/**
 * O controle negativo: o validador reprova o que tem de reprovar.
 *
 * Cada caso de `casos/broken.cjs` quebra uma coisa nomeada e declara a
 * checagem que tem de acusar. Aqui se confere que ela acusou — e, no fim, que o
 * CONTROLE, construído com o mesmo vocabulário e geometria correta, NÃO é
 * acusado pelas checagens duras. Sem essa segunda metade, a suíte não distingue
 * um validador que sabe medir de um que reprova tudo.
 */

const path = require('path');
const { CASOS, CONTROLE } = require(path.join(__dirname, 'cases', 'broken.cjs'));
const { validarGeometria } = require(path.join(__dirname, '..', 'validator', 'validate-geometry.cjs'));

/** As checagens que devem passar num desenho geometricamente correto. */
const DURAS = ['A3.1', 'A3.3', 'A3.5', 'A3.7', 'A4.1', 'A4.2', 'A4.3', 'A4.4', 'A5.5', 'A5.8', 'F1'];

let falhas = 0;

console.log('  casos quebrados de propósito:\n');
for (const caso of CASOS) {
  const r = validarGeometria(caso.plano, { modelo: caso.modelo });
  const acusadas = new Set([...r.falhas, ...r.avisos].map(x => x.id));
  const faltando = caso.espera.filter(id => !acusadas.has(id));
  const ok = faltando.length === 0;
  if (!ok) falhas++;
  console.log(`  ${ok ? '✓' : '✗'} ${caso.name}`);
  if (ok) {
    const quais = caso.espera.map(id => {
      const finding = [...r.falhas, ...r.avisos].find(x => x.id === id);
      return `${id} ${finding.state === 'falha' ? 'reprovou' : 'avisou'}`;
    });
    console.log(`      ${quais.join(', ')}`);
    const primeira = [...r.falhas, ...r.avisos].find(x => caso.espera.includes(x.id) && x.occurrences.length);
    if (primeira) console.log(`      → ${primeira.occurrences[0].o_que}`);
  } else {
    console.log(`      esperava ${faltando.join(', ')} e não veio; acusadas: ${[...acusadas].join(', ') || '(nenhuma)'}`);
  }
}

// ------------------------------------------------------------------- controle

console.log('\n  controle positivo (mesmo vocabulário, geometria correta):\n');
{
  const r = validarGeometria(CONTROLE.plano, { modelo: CONTROLE.modelo });
  const acusadas = new Set(r.falhas.map(x => x.id));
  const indevidas = DURAS.filter(id => acusadas.has(id));
  const ok = indevidas.length === 0;
  if (!ok) falhas++;
  console.log(`  ${ok ? '✓' : '✗'} nenhuma checagem dura acusa o desenho correto`);
  if (ok) console.log(`      ${DURAS.length} checagens duras conferidas, ${r.resumo.ok} ok no total`);
  else {
    console.log(`      acusaram sem motivo: ${indevidas.join(', ')}`);
    for (const id of indevidas) {
      const x = r.falhas.find(f => f.id === id);
      for (const o of x.occurrences.slice(0, 3)) console.log(`        · ${id}: ${o.o_que}`);
    }
  }

  // O controle tem de ter falhas semânticas ZERO. É o que separa "o desenho
  // está feio" de "o desenho está mentindo", e é a promessa central do #18.
  const semantico = r.semanticas.length === 0;
  if (!semantico) falhas++;
  console.log(`  ${semantico ? '✓' : '✗'} zero falhas semânticas no desenho correto`);
  if (!semantico) for (const s of r.semanticas) console.log(`        · ${s.id}: ${s.mensagem}`);
}

// -------------------------------------------- o validador não pode passar calado

console.log('\n  cobertura:\n');
{
  const r = validarGeometria(CONTROLE.plano, { modelo: CONTROLE.modelo });
  const ok = r.cobertura.naoRodaram.length === 0;
  if (!ok) falhas++;
  console.log(`  ${ok ? '✓' : '✗'} as ${r.cobertura.esperadas} checagens do validador rodaram`);
  if (!ok) console.log(`      não rodaram: ${r.cobertura.naoRodaram.join(', ')}`);

  // Uma checagem que estoura vira estado `erro`, não silêncio.
  const erros = r.resultados.filter(x => x.state === 'erro');
  if (erros.length) { falhas++; console.log(`  ✗ ${erros.length} família(s) estouraram: ${erros.map(e => e.mensagem).join(' | ')}`); }
  else console.log('  ✓ nenhuma família estourou');
}

console.log(falhas
  ? `\n  ✗ ${falhas} verificação(ões) falharam`
  : `\n  ✓ o validador acusa os ${CASOS.length} defeitos e absolve o desenho correto.`);
process.exit(falhas ? 1 : 0);
