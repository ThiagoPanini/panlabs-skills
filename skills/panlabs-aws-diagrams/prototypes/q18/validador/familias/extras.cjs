'use strict';
/**
 * O que a rubrica não previu — e por que fica fora das 62.
 *
 * A rubrica (#8) modela UMA árvore de contenção. Este motor desenha duas
 * coisas: grupos, que contêm, e faixas, que cruzam. As checagens daqui são as
 * que nascem dessa segunda categoria, e elas NÃO entram no índice das 62 por
 * uma razão de higiene: o índice é o contrato com a rubrica, e `check-indice`
 * existe para garantir que ele não deriva. Inflar as 62 com achados nossos
 * apagaria a fronteira entre "o que a pesquisa mandou medir" e "o que a gente
 * descobriu medindo" — e é essa fronteira que faz o índice valer alguma coisa.
 *
 * Ficam com prefixo `F` (de faixa), com a mesma severidade e a mesma tolerância
 * de A4.2, porque é a mesma pergunta semântica: a caixa está afirmando de um nó
 * um fato que ele não tem?
 *
 *   A4.2  o nó caiu dentro de um GRUPO do qual não é filho
 *         → o desenho mente sobre a fronteira de rede
 *
 *   F1    a FAIXA não abraça exatamente os membros que declara
 *         → o desenho mente sobre o atributo compartilhado ("este EC2 está na
 *           AZ-b", "este banco escala com o grupo") — e mente de um jeito que
 *           A4.2 nunca pegaria, porque faixa não é pai de ninguém
 *
 * Se o #18 virar produção, o caminho é levar F1 de volta à rubrica como A4.8,
 * não deixá-lo aqui para sempre.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometria.cjs'));
const { semTags, arredonda } = require(path.join(__dirname, 'comum.cjs'));

const nome = e => `${e.id}${e.rotulo ? ` ("${semTags(e.rotulo)}")` : ''}`;

module.exports = function extras(cena) {
  const saida = [];
  const { faixas, nos } = cena;

  // ---------------------------------------------------------------- F1
  const conferiveis = faixas.filter(f => Array.isArray(f.membros));
  if (!conferiveis.length) {
    saida.push({
      id: 'F1', nome: 'Faixa abraça exatamente seus membros', familia: 'F', insumo: 'geometria',
      severidadeMaxima: 'fail', semantica: true, calibravel: false,
      estado: 'inaplicavel',
      mensagem: faixas.length ? 'as faixas do plano não declaram membros' : 'o diagrama não tem faixas',
      medida: { faixas: faixas.length }, ocorrencias: [],
    });
    return saida;
  }

  const casos = [];
  for (const f of conferiveis) {
    const declarados = new Set(f.membros);
    for (const id of declarados) {
      const membro = cena.porElemento.get(id);
      if (!membro || !membro.caixa) continue;
      if (!g.contem(f.caixa, membro.caixa))
        casos.push({
          o_que: `a faixa "${f.id}" declara "${id}" como membro e não o abraça — ` +
            `quem lê o desenho não vê o atributo que o modelo afirma`,
          ids: [f.id, id],
        });
    }
    for (const n of nos) {
      if (declarados.has(n.id)) continue;
      const area = g.areaDaIntersecao(f.caixa, n.caixa);
      if (area <= 0) continue;
      const dentro = g.contem(f.caixa, n.caixa);
      casos.push({
        o_que: `a faixa "${f.id}" ${dentro ? 'contém' : 'encosta em'} ${nome(n)}, que não é membro dela — ` +
          `o desenho afirma dele um atributo (${semTags(f.rotulo) || f.id}) que o modelo não declara`,
        ids: [f.id, n.id],
        area: arredonda(area, 0),
      });
    }
  }

  saida.push({
    id: 'F1', nome: 'Faixa abraça exatamente seus membros', familia: 'F', insumo: 'geometria',
    severidadeMaxima: 'fail', semantica: true, calibravel: false,
    estado: casos.length ? 'falha' : 'ok',
    mensagem: casos.length
      ? `${casos.length} divergência(s) entre o que a faixa desenha e o que ela declara`
      : `${conferiveis.length} faixa(s) abraçam exatamente seus membros`,
    medida: { faixas: conferiveis.length, divergencias: casos.length },
    ocorrencias: casos,
  });

  return saida;
};
