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
const { ok, aviso, falha, notApplicable, pulada, arredonda } = require(path.join(__dirname, 'common.cjs'));

module.exports = function a8(cena) {
  const saida = [];
  const { nodes, edges } = cena;

  // ---------------------------------------------------------------- A8.1
  {
    const V = nodes.length;                       // caixas de grupo não contam
    const target = lim('elementosAlvo');
    const teto = lim('elementosFalha');
    const medida = { nodes: V, grupos: cena.grupos.length, bands: cena.bands.length, target, teto };
    const decompor = { o_que: `o remédio da literatura é decompor em diagramas menores, não apagar elementos (Moody & Heymans, RE'09)`, ids: [] };
    saida.push(V <= target ? ok('A8.1', { medida, mensagem: `${V} nó(s) de primeira classe (alvo ≤ ${target})` })
      : V <= teto ? aviso('A8.1', { medida, mensagem: `${V} nós — acima do alvo de ${target}`, occurrences: [decompor] })
        : falha('A8.1', { medida, mensagem: `${V} nós — acima do corte de ${teto}, onde node-link perde para matriz na maioria das tarefas`, occurrences: [decompor] }));
  }

  // ---------------------------------------------------------------- A8.2
  {
    const V = nodes.length;
    const E = edges.length;
    if (V < 2) saida.push(notApplicable('A8.2', 'menos de dois nós'));
    else {
      const possiveis = (V * (V - 1)) / 2;
      const d = arredonda(E / possiveis);
      const linear = arredonda(E / V, 2);
      const teto = lim('densidadeMaxima');
      const target = lim('elementosAlvo');
      const medida = { density: d, densidade_linear: linear, nodes: V, edges: E, teto };
      // A rubrica pede a CONJUNÇÃO: densidade alta só preocupa em grafo grande.
      saida.push(d > teto && V > target
        ? aviso('A8.2', {
          medida,
          mensagem: `densidade ${d} > ${teto} com ${V} nós — a combinação que a literatura evita`,
          occurrences: [{ o_que: 'acima de 20% de densidade a literatura só usa matriz ou edge bundling', ids: [] }],
        })
        : ok('A8.2', { medida, mensagem: `densidade ${d} (${E} arestas para ${V} nós)` }));
    }
  }

  // ---------------------------------------------------------------- A8.3
  {
    if (!cena.grau.size) saida.push(notApplicable('A8.3', edges.length
      ? 'nenhuma aresta liga dois ids que existem no plano'
      : 'o diagrama não tem arestas'));
    else {
      const grau = cena.grau;
      const teto = lim('fanOutMaximo');
      const maximo = Math.max(...grau.values());
      const estourados = [...grau.entries()].filter(([, d]) => d > teto)
        .map(([id, d]) => ({ o_que: `"${id}" tem grau ${d} (acima de ${teto}, a resolução angular de A6.1 fica mecanicamente impossível)`, ids: [id] }));
      const medida = { grau_maximo: maximo, teto, nos_com_aresta: grau.size };
      saida.push(estourados.length
        ? aviso('A8.3', { medida, mensagem: `grau máximo ${maximo}, acima de ${teto}`, occurrences: estourados })
        : ok('A8.3', { medida, mensagem: `grau máximo ${maximo}` }));
    }
  }

  // ---------------------------------------------------------------- A8.4
  saida.push(pulada('A8.4'));

  return saida;
};
