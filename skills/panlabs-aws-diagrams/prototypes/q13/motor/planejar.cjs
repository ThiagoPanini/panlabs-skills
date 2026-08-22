'use strict';
/**
 * Planejamento — layout bruto -> plano de células.
 *
 * O plano é a costura do motor: dele para frente ninguém sabe se o desenho
 * veio do ELK ou da grade de AZ. É o que permite o #21 decidir o eixo das
 * faixas sem tocar no emissor, e o #13 trocar a camada de estilo sem tocar
 * no layout.
 *
 * A ordem da lista é a ordem z: quem vem antes fica atrás.
 */

const { AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, PAD, calhaDaFaixa, folgas } = require('./dispor.cjs');

const OFF_X = 32;
const OFF_Y = 88;
const RODAPE = 32;

/**
 * As styles de fábrica, para quando não há tema — é o que mantém o #11 rodando
 * igual. Com tema, TODAS elas viram token; ver `tema/tema.cjs`.
 */
const S_TITULO = 'text;html=1;fontSize=19;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;';
const S_SUB = 'text;html=1;fontSize=12;fontColor=#5A6C86;align=left;verticalAlign=middle;';
const S_NOTA = 'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF8E1;strokeColor=#E0B34D;fontColor=#6B4E00;' +
  'fontSize=11;align=left;verticalAlign=top;spacing=8;dashed=0;';

/** Recorte do tema que este módulo usa; sem tema, os valores de fábrica. */
function pintura(res) {
  const t = res.tema;
  return {
    fundo: t ? t.tokens.pagina.cor : '#FFFFFF',
    margem: t ? t.tokens.pagina.margem : OFF_X,
    titulo: t ? t.titulo() : S_TITULO,
    subtitulo: t ? t.subtitulo() : S_SUB,
    revisao: t ? t.revisao() : S_SUB,
    nota: t ? t.nota() : S_NOTA,
    ptTitulo: t ? t.tokens.texto.titulo : 19,
    ptSub: t ? t.tokens.texto.subtitulo : 12,
    linhaRevisao: t ? t.tokens.cartao.revisao : null,
  };
}

/**
 * Como a aresta indica o caminho. Três variantes, e a diferença entre elas é
 * do RENDERIZADOR, não de gosto:
 *
 *   solido     traço contínuo. Vale em tudo.
 *   tracejado  traço interrompido — sugere percurso e sobrevive ao PNG.
 *   animado    `flowAnimation=1`, o tracejado que anda. O #4 mediu: **sobrevive
 *              a SVG e HTML, nunca a PNG** (o PNG é um quadro só). Exportar
 *              animado para PNG entrega uma linha sólida sem aviso.
 */
const FLUXO = {
  solido: '',
  tracejado: 'dashed=1;dashPattern=8 5;',
  animado: 'dashed=1;dashPattern=8 5;flowAnimation=1;',
};

/**
 * Estilo de aresta.
 *
 * Sem tema, é a string de fábrica do #11. Com tema, o roteamento continua sendo
 * daqui (as âncoras `exit*`/`entry*` são geometria, não pintura) e todo o resto
 * vem do token — inclusive a decisão que o #5 chama de N9/A11: a seta oficial da
 * AWS é SEMPRE sólida, então `tracejado` e `animado` são desvios que pagam uma
 * dívida, não opções neutras.
 */
function estiloAresta(a, anc, fluxo = 'solido', tema = null) {
  if (tema) {
    const extra = {};
    if (a.dados === 'ambos') Object.assign(extra, { startArrow: tema.tokens.aresta.ponta, startFill: tema.tokens.aresta.ponta === 'open' ? 0 : 1, startSize: 6 });
    if (anc.saida) Object.assign(extra, { exitX: anc.saida.x, exitY: anc.saida.y, exitDx: 0, exitDy: 0, exitPerimeter: 0 });
    if (anc.entrada) Object.assign(extra, { entryX: anc.entrada.x, entryY: anc.entrada.y, entryDx: 0, entryDy: 0, entryPerimeter: 0 });
    return tema.aresta(extra);
  }
  return estiloArestaDeFabrica(a, anc, fluxo);
}

function estiloArestaDeFabrica(a, anc, fluxo = 'solido') {
  // `rounded=1` arredonda o canto do roteamento ortogonal; `arcSize` é o raio.
  let s = 'edgeStyle=orthogonalEdgeStyle;rounded=1;arcSize=12;html=1;jettySize=auto;orthogonalLoop=1;' +
    'strokeColor=#232F3E;strokeWidth=1.6;endArrow=blockThin;endFill=1;endSize=6;' +
    'fontSize=10;fontColor=#232F3E;labelBackgroundColor=#FFFFFF;';
  s += FLUXO[fluxo] || '';
  if (a.dados === 'ambos') s += 'startArrow=blockThin;startFill=1;startSize=6;';
  // O #2 §5.4 é explícito: exitX e exitY só valem EM PAR, e sem
  // `exitPerimeter=0` o motor reprojeta o ponto no perímetro do shape — que em
  // shape não retangular é a principal fonte de não-determinismo visual.
  if (anc.saida) s += `exitX=${anc.saida.x};exitY=${anc.saida.y};exitDx=0;exitDy=0;exitPerimeter=0;`;
  if (anc.entrada) s += `entryX=${anc.entrada.x};entryY=${anc.entrada.y};entryDx=0;entryDy=0;entryPerimeter=0;`;
  return s;
}

const trava = v => Math.min(1, Math.max(0, Math.round(v * 1000) / 1000));

/** De que lado da caixa o ELK encostou a ponta da aresta. */
function ancora(caixa, p) {
  const eps = 2.5;
  if (Math.abs(p.x - caixa.x) <= eps) return { x: 0, y: trava((p.y - caixa.y) / caixa.h) };
  if (Math.abs(p.x - (caixa.x + caixa.w)) <= eps) return { x: 1, y: trava((p.y - caixa.y) / caixa.h) };
  if (Math.abs(p.y - caixa.y) <= eps) return { x: trava((p.x - caixa.x) / caixa.w), y: 0 };
  if (Math.abs(p.y - (caixa.y + caixa.h)) <= eps) return { x: trava((p.x - caixa.x) / caixa.w), y: 1 };
  return null;   // ponta solta: deixa flutuar em vez de mentir uma âncora
}

function rotuloDaAresta(a) {
  const base = a.rotulo || '';
  if (a.ordem === undefined) return base;
  return base ? `<b>${a.ordem}.</b> ${base}` : `<b>${a.ordem}</b>`;
}

/**
 * O título é dimensionado pelo texto, não por um número redondo.
 * Célula larga demais não aparece no desenho — e aparece no ARQUIVO: o
 * `drawio -x` exporta a caixa que contém tudo, então uma faixa de texto de
 * 1100 px de largura para um diagrama de 500 px produz metade da imagem em
 * branco. Foi o que aconteceu na primeira versão deste módulo.
 */
function cabecalho(plano, modelo, res) {
  const p = pintura(res);
  const larg = (texto, px) => Math.ceil(res.larguraDoTexto(texto) * px / 11) + 8;
  plano.celulas.push({
    tipo: 'vertice', id: 'titulo', pai: '1', rotulo: modelo.titulo, style: p.titulo,
    geo: { x: OFF_X, y: 30, w: larg(modelo.titulo, p.ptTitulo), h: 26 },
  });
  if (modelo.subtitulo)
    plano.celulas.push({
      tipo: 'vertice', id: 'subtitulo', pai: '1', rotulo: modelo.subtitulo, style: p.subtitulo,
      geo: { x: OFF_X, y: 58, w: larg(modelo.subtitulo, p.ptSub), h: 18 },
    });
  // O24 do #5: 12 de 12 Reference Architecture PDFs trazem "Reviewed for
  // technical accuracy <data>". É bloco de título, e portanto camada da casa.
  if (p.linhaRevisao)
    plano.celulas.push({
      tipo: 'vertice', id: 'revisao', pai: '1', rotulo: p.linhaRevisao, style: p.revisao,
      geo: { x: OFF_X, y: 74, w: larg(p.linhaRevisao, p.ptSub), h: 14 },
    });
}

/**
 * O modelo viaja DENTRO do arquivo. O #2 provou que atributo de `<object>` faz
 * round-trip byte a byte, inclusive com quebra de linha — então o `.drawio` é o
 * seu próprio formato de persistência e não há um segundo arquivo para
 * dessincronizar.
 */
function celulaDoModelo(modelo, res) {
  const t = res.tema;
  return {
    tipo: 'vertice', id: 'panlabs-modelo', pai: '1', rotulo: '', visivel: false,
    style: 'text;html=1;', geo: { x: 0, y: 0, w: 1, h: 1 },
    dados: {
      panlabsEsquema: modelo.esquema,
      panlabsModelo: JSON.stringify(modelo),
      // O TEMA VIAJA RESOLVIDO, não por nome — e a razão é a mesma que o #4 §7
      // deu para recusar `style="<nome>"` no `<mxGraphModel>`: nome só resolve
      // contra o que a outra ponta tem. Um `.drawio` que guardasse "tema=claro"
      // regeneraria diferente no dia em que `claro.json` mudasse. Guardando os
      // tokens, o arquivo continua sendo o próprio formato de persistência.
      ...(t ? { panlabsTema: JSON.stringify({ id: t.id, fundo: t.fundo, tokens: t.tokens }) } : {}),
    },
  };
}

function rodape(plano, modelo, larguraUtil, res, y) {
  const p = pintura(res);
  const soltas = (modelo.notas || []).filter(n => n.sobre === undefined);
  if (!soltas.length) return y;
  const pedacos = soltas.map(n =>
    (n.origem === 'achado-recusado' ? '<b>⚠ Achado aceito pelo time:</b> ' : '') + n.texto);
  const texto = pedacos.join('<br>');
  // a caixa tem de caber o texto QUEBRADO: uma nota longa numa página estreita
  // ocupa três linhas, e dimensionar por "uma linha por nota" corta a última
  const linhas = pedacos.reduce((n, p) => n + res.linhasDoRotulo(p.replace(/<[^>]+>/g, ''), larguraUtil - 20), 0);
  const alt = 22 + linhas * 16;
  plano.celulas.push({
    tipo: 'vertice', id: 'notas', pai: '1', rotulo: texto, style: p.nota,
    geo: { x: OFF_X, y: y + 20, w: larguraUtil, h: alt },
  });
  return y + 20 + alt;
}

// ------------------------------------------------------------ caminho A (ELK)

function planoDeElk(modelo, d, res, layout, opts = {}) {
  const { saida, caixas } = layout;
  const plano = { id: modelo.id, nome: modelo.titulo, celulas: [], fundo: pintura(res).fundo,
    tema: res.tema ? res.tema.id : null };
  cabecalho(plano, modelo, res);

  const abs = new Map();

  (function andar(no, paiId, paiAbs) {
    for (const c of no.children || []) {
      const meta = caixas.get(c.id);
      const noModelo = d.t.porId.get(c.id);
      const x = c.x + (paiId === '1' ? OFF_X : 0);
      const y = c.y + (paiId === '1' ? OFF_Y : 0);
      const a = { x: paiAbs.x + x, y: paiAbs.y + y, w: c.width, h: c.height };
      abs.set(c.id, a);

      plano.celulas.push({
        tipo: 'vertice', id: c.id, pai: paiId,
        rotulo: meta.container ? (noModelo.rotulo || '') : meta.rotulo,
        style: meta.style,
        geo: { x, y, w: c.width, h: c.height },
      });

      if (c.children && c.children.length) andar(c, c.id, a);
    }
  })(saida, '1', { x: 0, y: 0 });

  // faixas de membros — a caixa é a UNIÃO calculada, parenteada no ancestral comum
  for (const f of d.faixas) {
    const membros = f.membros.map(id => abs.get(id)).filter(Boolean);
    if (membros.length < 2) continue;
    const anc = f.membros.map(id => d.t.porId.get(id))
      .reduce((acc, n) => acc === undefined ? n : (require('./derivar.cjs').ancestralComum(acc, n, d.t) || acc), undefined);
    const paiId = anc && d.t.porId.get(anc.id) && abs.has(anc.id) ? anc.id : '1';
    const base = paiId === '1' ? { x: 0, y: 0 } : abs.get(paiId);
    const fr = res.faixa(f);
    const x1 = Math.min(...membros.map(m => m.x)) - 12;
    const x2 = Math.max(...membros.map(m => m.x + m.w)) + 12;
    const y1 = Math.min(...membros.map(m => m.y)) - calhaDaFaixa(fr.style);
    const y2 = Math.max(...membros.map(m => m.y + m.h)) + 12 + (layout.rotuloMax || 0);
    plano.celulas.push({
      tipo: 'vertice', id: f.id, pai: paiId, rotulo: f.rotulo || '', style: fr.style,
      geo: { x: x1 - base.x, y: y1 - base.y, w: x2 - x1, h: y2 - y1 },
    });
  }

  // arestas: todas na camada raiz, waypoints absolutos (#2 §5.2 + #7 edgeCoords ROOT)
  for (const e of saida.edges || []) {
    const a = d.arestas.find(x => x.id === e.id);
    const sec = (e.sections || [])[0];
    if (!sec) continue;
    const desl = p => ({ x: p.x + OFF_X, y: p.y + OFF_Y });
    const anc = {
      saida: ancora(abs.get(a.de), sec.startPoint),
      entrada: ancora(abs.get(a.para), sec.endPoint),
    };
    plano.celulas.push({
      tipo: 'aresta', id: e.id, pai: '1', de: a.de, para: a.para,
      rotulo: rotuloDaAresta(a), style: estiloAresta(a, anc, opts.fluxo, res.tema),
      pontos: (sec.bendPoints || []).map(desl),
    });
  }

  // notas presas a um nó
  for (const [i, n] of (modelo.notas || []).entries()) {
    if (n.sobre === undefined) continue;
    const a = abs.get(n.sobre);
    if (!a) continue;
    plano.celulas.push({
      tipo: 'vertice', id: n.id || `nota-${i}`, pai: '1', rotulo: n.texto, style: pintura(res).nota,
      geo: { x: a.x + a.w + 14, y: a.y, w: 190, h: 46 },
    });
  }

  const largura = Math.max(saida.width + 2 * OFF_X, 900);
  const fim = rodape(plano, modelo, largura - 2 * OFF_X, res, saida.height + OFF_Y + (layout.rotuloMax || 0));
  plano.larg = largura;
  plano.alt = fim + RODAPE;
  plano.celulas.push(celulaDoModelo(modelo, res));
  return plano;
}

// ---------------------------------------------------------- caminho B (grade)

function planoDeGrade(modelo, d, res, g, opts = {}) {
  const plano = { id: modelo.id, nome: modelo.titulo, celulas: [], fundo: pintura(res).fundo,
    tema: res.tema ? res.tema.id : null };
  cabecalho(plano, modelo, res);

  const nuvem = modelo.nos.find(n => n.tipo === 'nuvem');
  const larguraNuvem = g.larguraGrade + 4 * PAD;
  const cN = res.container(nuvem || { id: 'cloud', tipo: 'nuvem' });
  const idNuvem = nuvem ? nuvem.id : 'aws-cloud';

  plano.celulas.push({
    tipo: 'vertice', id: idNuvem, pai: '1',
    rotulo: (nuvem && nuvem.rotulo) || 'AWS Cloud', style: cN.style,
    geo: { x: OFF_X, y: OFF_Y, w: larguraNuvem, h: g.fim + PAD },
  });

  const topo = Math.min(...[...g.vpcBox.values()].map(b => b.y));

  // 1. faixas de AZ PRIMEIRO: z-order é ordem do documento, e elas ficam atrás
  for (const z of g.azs) {
    const membros = modelo.nos.filter(n => n.az === z).map(n => g.pos.get(n.id)).filter(Boolean);
    if (!membros.length) continue;
    const x1 = Math.min(...membros.map(m => m.x)) - 14;
    const x2 = Math.max(...membros.map(m => m.x + m.w)) + 14;
    const y1 = topo - g.AZ_LANE;
    const y2 = Math.max(...membros.map(m => m.y + m.h)) + g.CROSS_OUT;
    plano.celulas.push({
      tipo: 'vertice', id: `az-${z}`, pai: idNuvem,
      rotulo: `Availability Zone · ${z}`, style: res.faixaAz().style,
      geo: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 },
    });
  }

  // 2. a árvore de contenção real: VPC › subnet › conteúdo
  for (const [vid, box] of g.vpcBox) {
    const v = d.t.porId.get(vid);
    plano.celulas.push({
      tipo: 'vertice', id: vid, pai: idNuvem, rotulo: v.rotulo || '', style: g.caixas.get(vid).style,
      geo: { x: box.x, y: box.y, w: box.w, h: box.h },
    });
    for (const s of modelo.nos.filter(n => n.tipo === 'subnet')) {
      const p = g.pos.get(s.id);
      if (!p || (d.t.ancestrais(s).find(a => a.tipo === 'vpc') || {}).id !== vid) continue;
      plano.celulas.push({
        tipo: 'vertice', id: s.id, pai: vid, rotulo: s.rotulo || '', style: g.caixas.get(s.id).style,
        geo: { x: p.x - box.x, y: p.y - box.y, w: p.w, h: p.h },
      });
      for (const filho of g.intra.get(s.id).filhos || []) {
        const meta = g.caixas.get(filho.id);
        plano.celulas.push({
          tipo: 'vertice', id: filho.id, pai: s.id, rotulo: meta.rotulo, style: meta.style,
          geo: { x: filho.x, y: filho.y, w: meta.formaW, h: meta.formaH },
        });
      }
    }
  }

  // 3. faixas de membros por cima
  for (const f of d.faixas) {
    const cel = f.membros
      .map(id => { const n = d.t.porId.get(id); return d.t.ancestrais(n).find(a => a.tipo === 'subnet') || n; })
      .map(s => g.pos.get(s.id)).filter(Boolean);
    if (cel.length < 2) continue;
    const x1 = Math.min(...cel.map(m => m.x)) - 10, x2 = Math.max(...cel.map(m => m.x + m.w)) + 10;
    const y1 = Math.min(...cel.map(m => m.y)) - (g.calhas.get(f.id) || g.BAND_LANE), y2 = Math.max(...cel.map(m => m.y + m.h)) + 10;
    plano.celulas.push({
      tipo: 'vertice', id: f.id, pai: idNuvem, rotulo: f.rotulo || '', style: res.faixa(f).style,
      geo: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 },
    });
  }

  const largura = OFF_X * 2 + larguraNuvem;
  const fim = rodape(plano, modelo, largura - 2 * OFF_X, res, OFF_Y + g.fim + PAD);
  plano.larg = largura;
  plano.alt = fim + RODAPE;
  plano.celulas.push(celulaDoModelo(modelo, res));
  return plano;
}

module.exports = { planoDeElk, planoDeGrade, FLUXO, OFF_X, OFF_Y, pintura };
