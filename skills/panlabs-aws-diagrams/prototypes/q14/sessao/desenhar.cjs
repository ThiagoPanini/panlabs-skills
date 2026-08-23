'use strict';
/**
 * A costura entre a camada de sessao e o motor do #11.
 *
 * Sao quatro linhas de codigo e elas sao a prova do ticket:
 *
 *   projetar  ->  gerar (o motor do #11, intocado)  ->  selar
 *
 * O motor recebe um `modelo@1` de UMA vista e nao sabe que existem duas. Nao
 * precisou saber: a diferenca entre as vistas foi resolvida antes de ele ser
 * chamado. `tools/check-motor-intocado.cjs` confere que nem um byte do #11
 * mudou para isto funcionar.
 */

const path = require('path');
const { projetar } = require('./projetar.cjs');
const { selar } = require('./gravar.cjs');

const { gerar } = require(path.join(__dirname, '..', '..', 'q11', 'motor', 'gerar.cjs'));

async function desenhar(sessao, vista, opts = {}) {
  const { modelo, trilha } = projetar(sessao, vista);
  const r = await gerar(modelo, opts);
  const xml = selar(r.xml, sessao, vista, { motor: opts.motor || 'q11' });
  return { xml, modelo, trilha, relatorio: r.relatorio, caminho: r.caminho };
}

module.exports = { desenhar };
