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
const { ok, notApplicable, conforme, pares, arredonda, semTags, name } = require(path.join(__dirname, 'common.cjs'));


/** O piso da WCAG depende do tamanho: texto grande pede menos. */
function pisoDeTexto(px, negrito) {
  const grande = px >= lim('textoGrandePx') || (negrito && px >= lim('textoGrandeNegritoPx'));
  return { piso: grande ? lim('contrasteTextoGrande') : lim('contrasteTextoPequeno'), grande };
}

module.exports = function a7(cena) {
  const output = [];
  const { nodes, grupos, bands, edges } = cena;
  const rotulaveis = [...nodes, ...grupos, ...bands];

  // ---------------------------------------------------------------- A7.1
  {
    const casos = [];
    const medidos = [];
    for (const e of rotulaveis) {
      if (!semTags(e.label) || !e.rotuloCaixa) continue;
      const background = cena.fundoDoRotulo(e);
      const razao = color.contraste(e.corDaFonte, background);
      if (razao === null) continue;
      const { piso, grande } = pisoDeTexto(e.tamanhoDaFonte, e.negrito);
      medidos.push({ id: e.id, razao: arredonda(razao, 2), piso });
      if (razao < piso)
        casos.push({ o_que: `${name(e)}: ${e.corDaFonte} sobre ${background} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1 para ${grande ? 'texto grande' : `${e.tamanhoDaFonte} px`})`, ids: [e.id] });
    }
    for (const a of edges) {
      if (!semTags(a.label) || !a.completa) continue;
      const background = a.halo || cena.fundoEfetivoEm(cena.pontoNoMeio(a.pontos), a.z);
      const razao = color.contraste(a.corDaFonte, background);
      if (razao === null) continue;
      const { piso } = pisoDeTexto(a.tamanhoDaFonte, a.negrito);
      medidos.push({ id: a.id, razao: arredonda(razao, 2), piso });
      if (razao < piso) casos.push({ o_que: `a aresta "${a.id}": ${a.corDaFonte} sobre ${background} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1)`, ids: [a.id] });
    }
    const pior = medidos.length ? medidos.reduce((m, x) => (x.razao < m.razao ? x : m)) : null;
    output.push(medidos.length
      ? conforme('A7.1', casos, { medida: { textos: medidos.length, pior: pior && { id: pior.id, razao: pior.razao }, abaixo_do_piso: casos.length } })
      : notApplicable('A7.1', 'não há texto para medir'));
  }

  // ---------------------------------------------------------------- A7.2
  {
    const piso = lim('contrasteNaoTextual');
    const casos = [];
    let medidos = 0;
    const contra = (quem, ink, ponto, z, o_que) => {
      if (!color.ehCor(ink)) return;
      const background = cena.fundoEfetivoEm(ponto, z);
      const razao = color.contraste(ink, background);
      if (razao === null) return;
      medidos++;
      if (razao < piso) casos.push({ o_que: `${o_que}: ${ink} sobre ${background} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1)`, ids: [quem] });
    };
    for (const e of [...grupos, ...bands]) contra(e.id, e.traco, { x: e.caixa.x, y: e.caixa.y + e.caixa.h / 2 }, e.z, `a borda de "${e.id}"`);
    // Num service icon o traço é o filete BRANCO do desenho interno, não a
    // silhueta: medi-lo contra o fundo dá branco-sobre-branco e acusa 1:1 num
    // ícone perfeitamente visível. Quem carrega a informação e precisa se
    // destacar do que está atrás é o PREENCHIMENTO — o quadrado colorido.
    for (const e of nodes) contra(e.id, e.preenchimento || e.traco, g.centro(e.caixa), e.z, `${name(e)}`);
    for (const a of edges.filter(x => x.completa)) {
      contra(a.id, a.traco, cena.pontoNoMeio(a.pontos), a.z, `o traço da aresta "${a.id}"`);
      // A rubrica nomeia quatro alvos, e a ponta de seta é o quarto. No mxGraph
      // ela é pintada com o `strokeColor` da própria aresta, então a COR é a
      // mesma — o que muda é o FUNDO: a ponta encosta no perímetro do destino,
      // muitas vezes já dentro de um grupo com preenchimento próprio, enquanto
      // o meio do traço pode estar sobre a página. São duas medidas, não uma.
      const tip = a.pontos[a.pontos.length - 1];
      contra(a.id, a.traco, tip, a.z, `a ponta de seta de "${a.id}"`);
    }
    output.push(medidos ? conforme('A7.2', casos, { medida: { elementos_medidos: medidos, abaixo_do_piso: casos.length, piso } })
      : notApplicable('A7.2', 'não há traço nem preenchimento para medir'));
  }

  // ---------------------------------------------------------------- A7.3
  {
    // Um "significado" é o tipo semântico. Se dois tipos só se distinguem pela
    // cor de preenchimento, quem não enxerga aquela diferença de cor não os
    // distingue — que é literalmente o SC 1.4.1.
    const porSignificado = new Map();
    for (const e of [...nodes, ...grupos, ...bands]) {
      const chave = e.tipoSemantico || e.classe;
      if (!porSignificado.has(chave))
        porSignificado.set(chave, {
          preenchimento: e.preenchimento, traco: e.traco,
          estiloDeTraco: e.style.dashed === '1' ? 'dashed' : 'solid',
          forma: e.style.shape || (e.style.container === '1' ? 'container' : 'caixa'),
          ids: [],
        });
      porSignificado.get(chave).ids.push(e.id);
    }
    const casos = [];
    for (const [[na, a], [nb, b]] of pares([...porSignificado.entries()])) {
      const soCor = a.preenchimento !== b.preenchimento
        && a.estiloDeTraco === b.estiloDeTraco && a.forma === b.forma && a.traco === b.traco;
      if (soCor) casos.push({ o_que: `"${na}" e "${nb}" só se distinguem pela cor de preenchimento (${a.preenchimento} vs ${b.preenchimento})`, ids: [...a.ids.slice(0, 3), ...b.ids.slice(0, 3)] });
    }
    output.push(porSignificado.size > 1
      ? conforme('A7.3', casos, { medida: { significados: porSignificado.size, so_por_cor: casos.length } })
      : notApplicable('A7.3', 'há menos de dois significados distintos para comparar'));
  }

  // ---------------------------------------------------------------- A7.4
  {
    const minimo = lim('deltaE00Minimo');
    // "quaisquer duas cores que carreguem significados distintos" — não só o
    // preenchimento. A borda de um grupo é o canal que distingue VPC de subnet
    // de AZ neste catálogo, e deixá-la de fora fazia A7.4 medir metade da paleta.
    const porCor = new Map();
    const anotaCor = (hex, significado) => {
      if (!color.ehCor(hex)) return;
      if (!porCor.has(hex)) porCor.set(hex, new Set());
      porCor.get(hex).add(significado);
    };
    for (const e of [...nodes, ...grupos, ...bands]) {
      const chave = e.tipoSemantico || e.classe;
      anotaCor(e.preenchimento, chave);
      anotaCor(e.traco, chave);
    }
    const cores = [...porCor.keys()];
    if (cores.length < 2) output.push(notApplicable('A7.4', 'menos de duas cores em uso'));
    else {
      const casos = [];
      let pior = { deltaE: Infinity };
      for (const [a, b] of pares(cores)) {
        // só interessa quando as duas cores carregam significados DIFERENTES
        const ma = porCor.get(a);
        const mb = porCor.get(b);
        if ([...ma].every(x => mb.has(x)) && ma.size === mb.size) continue;
        for (const kind of color.TIPOS_DE_DEFICIENCIA) {
          const d = color.deltaE00(color.paraLab(color.simular(a, kind)), color.paraLab(color.simular(b, kind)));
          if (d < pior.deltaE) pior = { deltaE: arredonda(d, 2), a, b, kind };
          if (d < minimo)
            casos.push({ o_que: `${a} e ${b} ficam a ΔE00 = ${arredonda(d, 2)} sob ${kind} (mínimo ${minimo}) — ${[...ma].join('/')} vs ${[...mb].join('/')}`, ids: [] });
        }
      }
      output.push(conforme('A7.4', casos, {
        medida: { cores: cores.length, canais: 'preenchimento e traço', pior_par: pior.deltaE === Infinity ? null : pior, minimo },
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
    if (!cena.legend.length) {
      output.push(notApplicable('A7.5', 'não há legenda para medir — a ausência dela já é reportada por A1.2, e contar duas vezes inflaria o mesmo defeito'));
    } else {
      const casos = [];
      const background = cena.background;
      for (const [i, input] of cena.legend.entries()) {
        const quem = input.id || `legenda[${i}]`;
        const text = semTags(input.significado || input.text || '');
        const px = Number(input.tamanhoDaFonte) || 12;
        const corTexto = color.ehCor(input.corDaFonte) ? input.corDaFonte : '#000000';
        const fundoDaEntrada = color.ehCor(input.background) ? input.background : background;

        if (text) {
          const razao = color.contraste(corTexto, fundoDaEntrada);
          const { piso, grande } = pisoDeTexto(px, !!input.negrito);
          if (razao !== null && razao < piso)
            casos.push({ o_que: `${quem}: o texto ${corTexto} sobre ${fundoDaEntrada} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1 para ${grande ? 'texto grande' : `${px} px`})`, ids: [quem] });
        }
        // a amostra de cor é objeto gráfico, não texto: piso de A7.2
        const amostra = input.simbolo && input.simbolo.color ? input.simbolo.color : input.color;
        if (color.ehCor(amostra)) {
          const razao = color.contraste(amostra, fundoDaEntrada);
          const piso = lim('contrasteNaoTextual');
          if (razao !== null && razao < piso)
            casos.push({ o_que: `${quem}: a amostra ${amostra} sobre ${fundoDaEntrada} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1)`, ids: [quem] });
        }
      }
      output.push(conforme('A7.5', casos, {
        medida: { entradas: cena.legend.length, abaixo_do_piso: casos.length },
        mensagem: casos.length ? `${casos.length} entrada(s) de legenda abaixo do piso` : `${cena.legend.length} entrada(s) de legenda dentro dos pisos`,
      }));
    }
  }

  return output;
};
