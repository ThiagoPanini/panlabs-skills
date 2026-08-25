'use strict';
/**
 * A costura entre a camada de sessao e o motor.
 *
 * Sao quatro linhas de codigo e elas sao a prova do ticket #14:
 *
 *   projetar  ->  gerar (o motor, sem saber que existem duas vistas)  ->  selar
 *
 * O motor recebe um `modelo@1` de UMA vista e nao sabe que existem duas. Nao
 * precisou saber: a diferenca entre as vistas foi resolvida antes de ele ser
 * chamado — e continua sendo verdade depois que o motor cresceu com o #12, o #13
 * e o #22, o que e o teste real da tese. `tests/check-motor-intocado.cjs` congela
 * os bytes do motor de PRODUCAO para que a proxima mudanca nele seja deliberada.
 *
 * ⚠️ O que MUDOU na recertificacao do #23: `gerar` pode devolver 1+N paginas
 * (consolidada + uma por conta, `D2` do #6). `selar` sela todas.
 */

const path = require('path');
const { projetar } = require('./projetar.cjs');
const { selar } = require('./gravar.cjs');
const { avisoDeDossie } = require('./publicar.cjs');

const { gerar } = require(path.join(__dirname, '..', 'motor', 'gerar.cjs'));

async function desenhar(sessao, vista, opts = {}) {
  const { modelo, trilha } = projetar(sessao, vista);
  const r = await gerar(modelo, opts);
  const xml = selar(r.xml, sessao, vista, { motor: opts.motor });
  // Aviso de uma linha, no padrao do #16: avisa, nunca bloqueia, e nomeia a
  // saida. Vai no relatorio e nao no stdout porque quem imprime e a CLI.
  const aviso = avisoDeDossie(sessao);
  if (aviso) r.relatorio.avisos.push(aviso);
  return { xml, modelo, trilha, relatorio: r.relatorio, caminho: r.caminho, tema: r.tema };
}

module.exports = { desenhar };
