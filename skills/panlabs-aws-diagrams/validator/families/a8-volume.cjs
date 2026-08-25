'use strict';
/**
 * A8 · Volume e complexidade.
 *
 * A rubrica registra o remédio junto com o diagnóstico, e o remédio não é
 * encolher: é DECOMPOR. Moody & Heymans (RE'09) mediram que dividir um diagrama
 * complexo em vários simples "improve end user understanding by more than 50%".
 * Um validador que só diga "51 nós, reprovado" convida a apagar informação; a
 * mensagem daqui diz o que fazer.
 */

const path = require('path');
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, warning, failure, notApplicable, skipped, roundTo } = require(path.join(__dirname, 'common.cjs'));

module.exports = function a8(scene) {
  const output = [];
  const { nodes, edges } = scene;

  // ---------------------------------------------------------------- A8.1
  {
    const V = nodes.length;                       // caixas de grupo não contam
    const target = lim('elementosAlvo');
    const ceiling = lim('elementosFalha');
    const measured = { nodes: V, grupos: scene.grupos.length, bands: scene.bands.length, target, ceiling };
    const decompor = { o_que: `o remédio da literatura é decompor em diagramas menores, não apagar elementos (Moody & Heymans, RE'09)`, ids: [] };
    output.push(V <= target ? ok('A8.1', { measured, mensagem: `${V} nó(s) de primeira classe (alvo ≤ ${target})` })
      : V <= ceiling ? warning('A8.1', { measured, mensagem: `${V} nós — acima do alvo de ${target}`, occurrences: [decompor] })
        : failure('A8.1', { measured, mensagem: `${V} nós — acima do corte de ${ceiling}, onde node-link perde para matriz na maioria das tarefas`, occurrences: [decompor] }));
  }

  // ---------------------------------------------------------------- A8.2
  {
    const V = nodes.length;
    const E = edges.length;
    if (V < 2) output.push(notApplicable('A8.2', 'menos de dois nós'));
    else {
      const possiveis = (V * (V - 1)) / 2;
      const d = roundTo(E / possiveis);
      const linear = roundTo(E / V, 2);
      const ceiling = lim('densidadeMaxima');
      const target = lim('elementosAlvo');
      const measured = { density: d, densidade_linear: linear, nodes: V, edges: E, ceiling };
      // A rubrica pede a CONJUNÇÃO: densidade alta só preocupa em grafo grande.
      output.push(d > ceiling && V > target
        ? warning('A8.2', {
          measured,
          mensagem: `densidade ${d} > ${ceiling} com ${V} nós — a combinação que a literatura evita`,
          occurrences: [{ o_que: 'acima de 20% de densidade a literatura só usa matriz ou edge bundling', ids: [] }],
        })
        : ok('A8.2', { measured, mensagem: `densidade ${d} (${E} arestas para ${V} nós)` }));
    }
  }

  // ---------------------------------------------------------------- A8.3
  {
    if (!scene.grau.size) output.push(notApplicable('A8.3', edges.length
      ? 'nenhuma aresta liga dois ids que existem no plano'
      : 'o diagrama não tem arestas'));
    else {
      const grau = scene.grau;
      const ceiling = lim('fanOutMaximo');
      const maximo = Math.max(...grau.values());
      const estourados = [...grau.entries()].filter(([, d]) => d > ceiling)
        .map(([id, d]) => ({ o_que: `"${id}" tem grau ${d} (acima de ${ceiling}, a resolução angular de A6.1 fica mecanicamente impossível)`, ids: [id] }));
      const measured = { grau_maximo: maximo, ceiling, nos_com_aresta: grau.size };
      output.push(estourados.length
        ? warning('A8.3', { measured, mensagem: `grau máximo ${maximo}, acima de ${ceiling}`, occurrences: estourados })
        : ok('A8.3', { measured, mensagem: `grau máximo ${maximo}` }));
    }
  }

  // ---------------------------------------------------------------- A8.4
  output.push(skipped('A8.4'));

  return output;
};
