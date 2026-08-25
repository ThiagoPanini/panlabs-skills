'use strict';
/**
 * A7 · Acessibilidade cromática.
 *
 * A única família NORMATIVA do validador: os números são da WCAG 2.2, não de um
 * percentil de gosto. Quatro das cinco são `fail`, e é o que a rubrica diz —
 * "normativo, determinístico, sem espaço para debate".
 *
 * Toda medida aqui depende do FUNDO EFETIVO, que é a decisão 4 do ticket #18 e
 * mora em `cena.fundoEfetivoEm`: a pilha de grupos composta em ordem z, não a
 * cor da página. Medir o rótulo de um EC2 contra o branco do canvas, quando ele
 * está dentro de uma subnet dentro de uma VPC dentro da nuvem, dá um contraste
 * que não existe em lugar nenhum do desenho.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const color = require(path.join(__dirname, '..', 'color.cjs'));
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, notApplicable, matches, pairs, roundTo, withoutTags, name } = require(path.join(__dirname, 'common.cjs'));


/** O piso da WCAG depende do tamanho: texto grande pede menos. */
function pisoDeTexto(px, negrito) {
  const grande = px >= lim('textoGrandePx') || (negrito && px >= lim('textoGrandeNegritoPx'));
  return { floor: grande ? lim('contrasteTextoGrande') : lim('contrasteTextoPequeno'), grande };
}

module.exports = function a7(scene) {
  const output = [];
  const { nodes, grupos, bands, edges } = scene;
  const rotulaveis = [...nodes, ...grupos, ...bands];

  // ---------------------------------------------------------------- A7.1
  {
    const casos = [];
    const medidos = [];
    for (const e of rotulaveis) {
      if (!withoutTags(e.label) || !e.rotuloCaixa) continue;
      const background = scene.fundoDoRotulo(e);
      const ratio = color.contraste(e.corDaFonte, background);
      if (ratio === null) continue;
      const { floor, grande } = pisoDeTexto(e.tamanhoDaFonte, e.negrito);
      medidos.push({ id: e.id, ratio: roundTo(ratio, 2), floor });
      if (ratio < floor)
        casos.push({ o_que: `${name(e)}: ${e.corDaFonte} sobre ${background} dá ${roundTo(ratio, 2)}:1 (piso ${floor}:1 para ${grande ? 'texto grande' : `${e.tamanhoDaFonte} px`})`, ids: [e.id] });
    }
    for (const a of edges) {
      if (!withoutTags(a.label) || !a.completa) continue;
      const background = a.halo || scene.fundoEfetivoEm(scene.pontoNoMeio(a.pontos), a.z);
      const ratio = color.contraste(a.corDaFonte, background);
      if (ratio === null) continue;
      const { floor } = pisoDeTexto(a.tamanhoDaFonte, a.negrito);
      medidos.push({ id: a.id, ratio: roundTo(ratio, 2), floor });
      if (ratio < floor) casos.push({ o_que: `a aresta "${a.id}": ${a.corDaFonte} sobre ${background} dá ${roundTo(ratio, 2)}:1 (piso ${floor}:1)`, ids: [a.id] });
    }
    const pior = medidos.length ? medidos.reduce((m, x) => (x.ratio < m.ratio ? x : m)) : null;
    output.push(medidos.length
      ? matches('A7.1', casos, { measured: { textos: medidos.length, pior: pior && { id: pior.id, ratio: pior.ratio }, abaixo_do_piso: casos.length } })
      : notApplicable('A7.1', 'não há texto para medir'));
  }

  // ---------------------------------------------------------------- A7.2
  {
    const floor = lim('contrasteNaoTextual');
    const casos = [];
    let medidos = 0;
    const contra = (quem, ink, ponto, z, o_que) => {
      if (!color.ehCor(ink)) return;
      const background = scene.fundoEfetivoEm(ponto, z);
      const ratio = color.contraste(ink, background);
      if (ratio === null) return;
      medidos++;
      if (ratio < floor) casos.push({ o_que: `${o_que}: ${ink} sobre ${background} dá ${roundTo(ratio, 2)}:1 (piso ${floor}:1)`, ids: [quem] });
    };
    for (const e of [...grupos, ...bands]) contra(e.id, e.traco, { x: e.cellBox.x, y: e.cellBox.y + e.cellBox.h / 2 }, e.z, `a borda de "${e.id}"`);
    // Num service icon o traço é o filete BRANCO do desenho interno, não a
    // silhueta: medi-lo contra o fundo dá branco-sobre-branco e acusa 1:1 num
    // ícone perfeitamente visível. Quem carrega a informação e precisa se
    // destacar do que está atrás é o PREENCHIMENTO — o quadrado colorido.
    for (const e of nodes) contra(e.id, e.preenchimento || e.traco, g.centro(e.cellBox), e.z, `${name(e)}`);
    for (const a of edges.filter(x => x.completa)) {
      contra(a.id, a.traco, scene.pontoNoMeio(a.pontos), a.z, `o traço da aresta "${a.id}"`);
      // A rubrica nomeia quatro alvos, e a ponta de seta é o quarto. No mxGraph
      // ela é pintada com o `strokeColor` da própria aresta, então a COR é a
      // mesma — o que muda é o FUNDO: a ponta encosta no perímetro do destino,
      // muitas vezes já dentro de um grupo com preenchimento próprio, enquanto
      // o meio do traço pode estar sobre a página. São duas medidas, não uma.
      const tip = a.pontos[a.pontos.length - 1];
      contra(a.id, a.traco, tip, a.z, `a ponta de seta de "${a.id}"`);
    }
    output.push(medidos ? matches('A7.2', casos, { measured: { elementos_medidos: medidos, abaixo_do_piso: casos.length, floor } })
      : notApplicable('A7.2', 'não há traço nem preenchimento para medir'));
  }

  // ---------------------------------------------------------------- A7.3
  {
    // Um "significado" é o tipo semântico. Se dois tipos só se distinguem pela
    // cor de preenchimento, quem não enxerga aquela diferença de cor não os
    // distingue — que é literalmente o SC 1.4.1.
    const byMeaning = new Map();
    for (const e of [...nodes, ...grupos, ...bands]) {
      const key = e.tipoSemantico || e.classe;
      if (!byMeaning.has(key))
        byMeaning.set(key, {
          preenchimento: e.preenchimento, traco: e.traco,
          estiloDeTraco: e.style.dashed === '1' ? 'dashed' : 'solid',
          forma: e.style.shape || (e.style.container === '1' ? 'container' : 'cellBox'),
          ids: [],
        });
      byMeaning.get(key).ids.push(e.id);
    }
    const casos = [];
    for (const [[na, a], [nb, b]] of pairs([...byMeaning.entries()])) {
      const soCor = a.preenchimento !== b.preenchimento
        && a.estiloDeTraco === b.estiloDeTraco && a.forma === b.forma && a.traco === b.traco;
      if (soCor) casos.push({ o_que: `"${na}" e "${nb}" só se distinguem pela cor de preenchimento (${a.preenchimento} vs ${b.preenchimento})`, ids: [...a.ids.slice(0, 3), ...b.ids.slice(0, 3)] });
    }
    output.push(byMeaning.size > 1
      ? matches('A7.3', casos, { measured: { significados: byMeaning.size, so_por_cor: casos.length } })
      : notApplicable('A7.3', 'há menos de dois significados distintos para comparar'));
  }

  // ---------------------------------------------------------------- A7.4
  {
    const minimo = lim('deltaE00Minimo');
    // "quaisquer duas cores que carreguem significados distintos" — não só o
    // preenchimento. A borda de um grupo é o canal que distingue VPC de subnet
    // de AZ neste catálogo, e deixá-la de fora fazia A7.4 medir metade da paleta.
    const porCor = new Map();
    const anotaCor = (hex, meaning) => {
      if (!color.ehCor(hex)) return;
      if (!porCor.has(hex)) porCor.set(hex, new Set());
      porCor.get(hex).add(meaning);
    };
    for (const e of [...nodes, ...grupos, ...bands]) {
      const key = e.tipoSemantico || e.classe;
      anotaCor(e.preenchimento, key);
      anotaCor(e.traco, key);
    }
    const colors = [...porCor.keys()];
    if (colors.length < 2) output.push(notApplicable('A7.4', 'menos de duas cores em uso'));
    else {
      const casos = [];
      let pior = { deltaE: Infinity };
      for (const [a, b] of pairs(colors)) {
        // só interessa quando as duas cores carregam significados DIFERENTES
        const ma = porCor.get(a);
        const mb = porCor.get(b);
        if ([...ma].every(x => mb.has(x)) && ma.size === mb.size) continue;
        for (const kind of color.DEFICIENCY_KINDS) {
          const d = color.deltaE00(color.paraLab(color.simulate(a, kind)), color.paraLab(color.simulate(b, kind)));
          if (d < pior.deltaE) pior = { deltaE: roundTo(d, 2), a, b, kind };
          if (d < minimo)
            casos.push({ o_que: `${a} e ${b} ficam a ΔE00 = ${roundTo(d, 2)} sob ${kind} (mínimo ${minimo}) — ${[...ma].join('/')} vs ${[...mb].join('/')}`, ids: [] });
        }
      }
      output.push(matches('A7.4', casos, {
        measured: { colors: colors.length, canais: 'preenchimento e traço', pior_par: pior.deltaE === Infinity ? null : pior, minimo },
        mensagem: casos.length ? `${casos.length} par(es) de cores indistinguíveis sob alguma deficiência` : 'as cores de significados distintos se separam nas três simulações',
      }));
    }
  }

  // ---------------------------------------------------------------- A7.5
  // A legenda tem de passar pelos mesmos pisos de A7.1 (o texto da entrada) e
  // A7.2 (a amostra de cor). Nenhum motor deste repo emite legenda ainda, então
  // na prática o ramo que roda hoje é o `inaplicavel` — mas o outro ramo é
  // implementado de verdade, e não um `conforme(id, [])` que nunca pode falhar.
  // Uma checagem `fail` que não sabe reprovar é pior que uma que não existe:
  // ela ocupa a linha do relatório e devolve verde.
  {
    if (!scene.legend.length) {
      output.push(notApplicable('A7.5', 'não há legenda para medir — a ausência dela já é reportada por A1.2, e contar duas vezes inflaria o mesmo defeito'));
    } else {
      const casos = [];
      const background = scene.background;
      for (const [i, input] of scene.legend.entries()) {
        const quem = input.id || `legenda[${i}]`;
        const text = withoutTags(input.meaning || input.text || '');
        const px = Number(input.tamanhoDaFonte) || 12;
        const corTexto = color.ehCor(input.corDaFonte) ? input.corDaFonte : '#000000';
        const entryBackground = color.ehCor(input.background) ? input.background : background;

        if (text) {
          const ratio = color.contraste(corTexto, entryBackground);
          const { floor, grande } = pisoDeTexto(px, !!input.negrito);
          if (ratio !== null && ratio < floor)
            casos.push({ o_que: `${quem}: o texto ${corTexto} sobre ${entryBackground} dá ${roundTo(ratio, 2)}:1 (piso ${floor}:1 para ${grande ? 'texto grande' : `${px} px`})`, ids: [quem] });
        }
        // a amostra de cor é objeto gráfico, não texto: piso de A7.2
        const amostra = input.simbolo && input.simbolo.color ? input.simbolo.color : input.color;
        if (color.ehCor(amostra)) {
          const ratio = color.contraste(amostra, entryBackground);
          const floor = lim('contrasteNaoTextual');
          if (ratio !== null && ratio < floor)
            casos.push({ o_que: `${quem}: a amostra ${amostra} sobre ${entryBackground} dá ${roundTo(ratio, 2)}:1 (piso ${floor}:1)`, ids: [quem] });
        }
      }
      output.push(matches('A7.5', casos, {
        measured: { entradas: scene.legend.length, abaixo_do_piso: casos.length },
        mensagem: casos.length ? `${casos.length} entrada(s) de legenda abaixo do piso` : `${scene.legend.length} entrada(s) de legenda dentro dos pisos`,
      }));
    }
  }

  return output;
};
