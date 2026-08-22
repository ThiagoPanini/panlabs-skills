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
const g = require(path.join(__dirname, '..', 'geometria.cjs'));
const cor = require(path.join(__dirname, '..', 'cor.cjs'));
const { lim } = require(path.join(__dirname, '..', 'indice.cjs'));
const { ok, inaplicavel, conforme, pares, arredonda, semTags, nome } = require(path.join(__dirname, 'comum.cjs'));


/** O piso da WCAG depende do tamanho: texto grande pede menos. */
function pisoDeTexto(px, negrito) {
  const grande = px >= lim('textoGrandePx') || (negrito && px >= lim('textoGrandeNegritoPx'));
  return { piso: grande ? lim('contrasteTextoGrande') : lim('contrasteTextoPequeno'), grande };
}

module.exports = function a7(cena) {
  const saida = [];
  const { nos, grupos, faixas, arestas } = cena;
  const rotulaveis = [...nos, ...grupos, ...faixas];

  // ---------------------------------------------------------------- A7.1
  {
    const casos = [];
    const medidos = [];
    for (const e of rotulaveis) {
      if (!semTags(e.rotulo) || !e.rotuloCaixa) continue;
      const fundo = cena.fundoDoRotulo(e);
      const razao = cor.contraste(e.corDaFonte, fundo);
      if (razao === null) continue;
      const { piso, grande } = pisoDeTexto(e.tamanhoDaFonte, e.negrito);
      medidos.push({ id: e.id, razao: arredonda(razao, 2), piso });
      if (razao < piso)
        casos.push({ o_que: `${nome(e)}: ${e.corDaFonte} sobre ${fundo} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1 para ${grande ? 'texto grande' : `${e.tamanhoDaFonte} px`})`, ids: [e.id] });
    }
    for (const a of arestas) {
      if (!semTags(a.rotulo) || !a.completa) continue;
      const fundo = a.halo || cena.fundoEfetivoEm(cena.pontoNoMeio(a.pontos), a.z);
      const razao = cor.contraste(a.corDaFonte, fundo);
      if (razao === null) continue;
      const { piso } = pisoDeTexto(a.tamanhoDaFonte, a.negrito);
      medidos.push({ id: a.id, razao: arredonda(razao, 2), piso });
      if (razao < piso) casos.push({ o_que: `a aresta "${a.id}": ${a.corDaFonte} sobre ${fundo} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1)`, ids: [a.id] });
    }
    const pior = medidos.length ? medidos.reduce((m, x) => (x.razao < m.razao ? x : m)) : null;
    saida.push(medidos.length
      ? conforme('A7.1', casos, { medida: { textos: medidos.length, pior: pior && { id: pior.id, razao: pior.razao }, abaixo_do_piso: casos.length } })
      : inaplicavel('A7.1', 'não há texto para medir'));
  }

  // ---------------------------------------------------------------- A7.2
  {
    const piso = lim('contrasteNaoTextual');
    const casos = [];
    let medidos = 0;
    const contra = (quem, tinta, ponto, z, o_que) => {
      if (!cor.ehCor(tinta)) return;
      const fundo = cena.fundoEfetivoEm(ponto, z);
      const razao = cor.contraste(tinta, fundo);
      if (razao === null) return;
      medidos++;
      if (razao < piso) casos.push({ o_que: `${o_que}: ${tinta} sobre ${fundo} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1)`, ids: [quem] });
    };
    for (const e of [...grupos, ...faixas]) contra(e.id, e.traco, { x: e.caixa.x, y: e.caixa.y + e.caixa.h / 2 }, e.z, `a borda de "${e.id}"`);
    // Num service icon o traço é o filete BRANCO do desenho interno, não a
    // silhueta: medi-lo contra o fundo dá branco-sobre-branco e acusa 1:1 num
    // ícone perfeitamente visível. Quem carrega a informação e precisa se
    // destacar do que está atrás é o PREENCHIMENTO — o quadrado colorido.
    for (const e of nos) contra(e.id, e.preenchimento || e.traco, g.centro(e.caixa), e.z, `${nome(e)}`);
    for (const a of arestas.filter(x => x.completa)) {
      contra(a.id, a.traco, cena.pontoNoMeio(a.pontos), a.z, `o traço da aresta "${a.id}"`);
      // A rubrica nomeia quatro alvos, e a ponta de seta é o quarto. No mxGraph
      // ela é pintada com o `strokeColor` da própria aresta, então a COR é a
      // mesma — o que muda é o FUNDO: a ponta encosta no perímetro do destino,
      // muitas vezes já dentro de um grupo com preenchimento próprio, enquanto
      // o meio do traço pode estar sobre a página. São duas medidas, não uma.
      const ponta = a.pontos[a.pontos.length - 1];
      contra(a.id, a.traco, ponta, a.z, `a ponta de seta de "${a.id}"`);
    }
    saida.push(medidos ? conforme('A7.2', casos, { medida: { elementos_medidos: medidos, abaixo_do_piso: casos.length, piso } })
      : inaplicavel('A7.2', 'não há traço nem preenchimento para medir'));
  }

  // ---------------------------------------------------------------- A7.3
  {
    // Um "significado" é o tipo semântico. Se dois tipos só se distinguem pela
    // cor de preenchimento, quem não enxerga aquela diferença de cor não os
    // distingue — que é literalmente o SC 1.4.1.
    const porSignificado = new Map();
    for (const e of [...nos, ...grupos, ...faixas]) {
      const chave = e.tipoSemantico || e.classe;
      if (!porSignificado.has(chave))
        porSignificado.set(chave, {
          preenchimento: e.preenchimento, traco: e.traco,
          estiloDeTraco: e.estilo.dashed === '1' ? 'tracejado' : 'solido',
          forma: e.estilo.shape || (e.estilo.container === '1' ? 'container' : 'caixa'),
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
    saida.push(porSignificado.size > 1
      ? conforme('A7.3', casos, { medida: { significados: porSignificado.size, so_por_cor: casos.length } })
      : inaplicavel('A7.3', 'há menos de dois significados distintos para comparar'));
  }

  // ---------------------------------------------------------------- A7.4
  {
    const minimo = lim('deltaE00Minimo');
    // "quaisquer duas cores que carreguem significados distintos" — não só o
    // preenchimento. A borda de um grupo é o canal que distingue VPC de subnet
    // de AZ neste catálogo, e deixá-la de fora fazia A7.4 medir metade da paleta.
    const porCor = new Map();
    const anotaCor = (hex, significado) => {
      if (!cor.ehCor(hex)) return;
      if (!porCor.has(hex)) porCor.set(hex, new Set());
      porCor.get(hex).add(significado);
    };
    for (const e of [...nos, ...grupos, ...faixas]) {
      const chave = e.tipoSemantico || e.classe;
      anotaCor(e.preenchimento, chave);
      anotaCor(e.traco, chave);
    }
    const cores = [...porCor.keys()];
    if (cores.length < 2) saida.push(inaplicavel('A7.4', 'menos de duas cores em uso'));
    else {
      const casos = [];
      let pior = { deltaE: Infinity };
      for (const [a, b] of pares(cores)) {
        // só interessa quando as duas cores carregam significados DIFERENTES
        const ma = porCor.get(a);
        const mb = porCor.get(b);
        if ([...ma].every(x => mb.has(x)) && ma.size === mb.size) continue;
        for (const tipo of cor.TIPOS_DE_DEFICIENCIA) {
          const d = cor.deltaE00(cor.paraLab(cor.simular(a, tipo)), cor.paraLab(cor.simular(b, tipo)));
          if (d < pior.deltaE) pior = { deltaE: arredonda(d, 2), a, b, tipo };
          if (d < minimo)
            casos.push({ o_que: `${a} e ${b} ficam a ΔE00 = ${arredonda(d, 2)} sob ${tipo} (mínimo ${minimo}) — ${[...ma].join('/')} vs ${[...mb].join('/')}`, ids: [] });
        }
      }
      saida.push(conforme('A7.4', casos, {
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
    if (!cena.legenda.length) {
      saida.push(inaplicavel('A7.5', 'não há legenda para medir — a ausência dela já é reportada por A1.2, e contar duas vezes inflaria o mesmo defeito'));
    } else {
      const casos = [];
      const fundo = cena.fundo;
      for (const [i, entrada] of cena.legenda.entries()) {
        const quem = entrada.id || `legenda[${i}]`;
        const texto = semTags(entrada.significado || entrada.texto || '');
        const px = Number(entrada.tamanhoDaFonte) || 12;
        const corTexto = cor.ehCor(entrada.corDaFonte) ? entrada.corDaFonte : '#000000';
        const fundoDaEntrada = cor.ehCor(entrada.fundo) ? entrada.fundo : fundo;

        if (texto) {
          const razao = cor.contraste(corTexto, fundoDaEntrada);
          const { piso, grande } = pisoDeTexto(px, !!entrada.negrito);
          if (razao !== null && razao < piso)
            casos.push({ o_que: `${quem}: o texto ${corTexto} sobre ${fundoDaEntrada} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1 para ${grande ? 'texto grande' : `${px} px`})`, ids: [quem] });
        }
        // a amostra de cor é objeto gráfico, não texto: piso de A7.2
        const amostra = entrada.simbolo && entrada.simbolo.cor ? entrada.simbolo.cor : entrada.cor;
        if (cor.ehCor(amostra)) {
          const razao = cor.contraste(amostra, fundoDaEntrada);
          const piso = lim('contrasteNaoTextual');
          if (razao !== null && razao < piso)
            casos.push({ o_que: `${quem}: a amostra ${amostra} sobre ${fundoDaEntrada} dá ${arredonda(razao, 2)}:1 (piso ${piso}:1)`, ids: [quem] });
        }
      }
      saida.push(conforme('A7.5', casos, {
        medida: { entradas: cena.legenda.length, abaixo_do_piso: casos.length },
        mensagem: casos.length ? `${casos.length} entrada(s) de legenda abaixo do piso` : `${cena.legenda.length} entrada(s) de legenda dentro dos pisos`,
      }));
    }
  }

  return saida;
};
