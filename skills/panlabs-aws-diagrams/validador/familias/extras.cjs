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
 *   F2    a ARESTA atravessa a caixa de uma faixa que não é dela
 *         → o mesmo par, uma linha abaixo: `A5.5` é `A4.2` aplicado à aresta, e
 *           F2 é F1 aplicado à aresta. O predicado é literalmente o de A5.5 —
 *           polilinha cruzando uma caixa com a qual a aresta não tem relação —,
 *           trocada a classe `grupo` pela classe `faixa`
 *
 * Se o #18 virar produção, o caminho é levar F1 e F2 de volta à rubrica como
 * A4.8 e A5.10, não deixá-los aqui para sempre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE F2 NASCEU NO #26, e o que a medição dele disse
 *
 * O #21 decidiu que apagar a aresta que cruza zona (a saída do #6 aplicada à
 * zona) é FALLBACK e não default, e que "o disparo tem de vir do validador, não
 * de constante mágica". Ficou pendente *qual checagem*.
 *
 * A resposta é que ela NÃO EXISTIA. `A5.5` varre `cena.grupos`; a faixa é outra
 * classe, e ficou fora das 62 por decisão explícita do #18 — mas só F1 chegou a
 * ser escrito. O resultado é que o motor era ESTRUTURALMENTE cego ao defeito que
 * o fallback do #21 existe para evitar: nenhuma checagem media a aresta cortando
 * a faixa alheia, então nenhuma podia disparar o fallback e nenhuma pegaria a
 * regressão.
 *
 * ⚠️ E a medição do #26 diz que o defeito NÃO ACONTECE neste motor. Varrendo
 * malha completa de 3, 4, 5 e 6 zonas (`tools/medir-leque.cjs`), com piso de
 * varredura previsto de 2, 8, 20 e 40, o F2 medido é ZERO nas quatro. O
 * roteamento do #24 leva a aresta longa para a borda externa das faixas em vez
 * de reto entre colunas; o piso continua contando um cruzamento que o desenho
 * não faz mais. O que cresce com a densidade é `A3.2` — colisão de rótulo,
 * 2 → 5 → 12 → 25 —, que é LEGIBILIDADE, não veracidade.
 *
 * Então F2 entra armado e calado, e é isso que ele compra: no dia em que uma
 * mudança de roteamento reintroduzir o cruzamento, o portão `veracidade` barra
 * em vez de o desenho sair mentindo. O fallback em si continua névoa nomeada —
 * ver `docs/corpus.md` §Parte 2.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometria.cjs'));
const { semTags, arredonda, nome } = require(path.join(__dirname, 'comum.cjs'));


/**
 * F2 — a aresta corta a caixa de uma faixa que não é dela.
 *
 * Espelho de `A5.5`, e de propósito linha a linha: a faixa entra na conta quando
 * NENHUMA das duas pontas é membro dela. Membro inclui descendente de membro —
 * uma faixa de AZ declara a subnet e os filhos diretos dela, e um serviço mais
 * fundo (dentro de um security group, por exemplo) continua sendo daquela zona.
 * Sem isso a checagem acusaria a própria aresta interna da zona.
 *
 * Faixa sem membros declarados não entra: é o caso da faixa de OU, que o #12
 * desenha como `render: rotulo` e cuja "caixa" é âncora de rótulo, não região.
 */
function f2(cena) {
  const comMembros = cena.faixas.filter(f => Array.isArray(f.membros) && f.membros.length);
  const arestas = cena.arestas.filter(a => a.completa);

  if (!comMembros.length || !arestas.length)
    return {
      id: 'F2', nome: 'Aresta atravessando faixa alheia', familia: 'F', insumo: 'geometria',
      severidadeMaxima: 'fail', semantica: true, calibravel: false,
      estado: 'inaplicavel',
      mensagem: !arestas.length ? 'o diagrama não tem arestas' : 'o diagrama não tem faixa com membros declarados',
      medida: { faixas: comMembros.length, arestas: arestas.length }, ocorrencias: [],
    };

  const dela = (ponta, f) => f.membros.some(m => m === ponta || cena.ehDescendente(ponta, m));

  const casos = [];
  for (const a of arestas)
    for (const f of comMembros) {
      if (dela(a.de, f) || dela(a.para, f)) continue;
      if (!g.polilinhaCruzaRetangulo(a.pontos, f.caixa)) continue;
      casos.push({
        o_que: `a aresta "${a.id}" (${a.de}→${a.para}) atravessa a faixa "${f.id}"` +
          `${semTags(f.rotulo) ? ` (${semTags(f.rotulo)})` : ''}, de onde não sai nem para onde vai — ` +
          `o desenho põe o caminho dentro de uma zona que ele não toca`,
        ids: [a.id, f.id],
      });
    }

  return {
    id: 'F2', nome: 'Aresta atravessando faixa alheia', familia: 'F', insumo: 'geometria',
    severidadeMaxima: 'fail', semantica: true, calibravel: false,
    estado: casos.length ? 'falha' : 'ok',
    mensagem: casos.length
      ? `${casos.length} travessia(s) de faixa alheia — tolerância é zero, como em A5.5`
      : `${arestas.length} aresta(s) contra ${comMembros.length} faixa(s): nenhuma corta faixa que não é dela`,
    medida: { faixas: comMembros.length, arestas: arestas.length, travessias_de_faixa: casos.length },
    ocorrencias: casos,
  };
}

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
    saida.push(f2(cena));
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

  // ---------------------------------------------------------------- F2
  saida.push(f2(cena));

  return saida;
};
