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

const { AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, PAD, calhaDaFaixa } = require('./dispor.cjs');

const OFF_X = 32;
const OFF_Y = 88;
const RODAPE = 32;

const S_TITULO = 'text;html=1;fontSize=19;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;';
const S_SUB = 'text;html=1;fontSize=12;fontColor=#5A6C86;align=left;verticalAlign=middle;';
const S_NOTA = 'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF8E1;strokeColor=#E0B34D;fontColor=#6B4E00;' +
  'fontSize=11;align=left;verticalAlign=top;spacing=8;dashed=0;';

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

/** Estilo de aresta. A camada de estilo é do #13; aqui fica só o que o roteamento exige. */
function estiloAresta(a, anc, fluxo = 'solido') {
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
  const larg = (texto, px) => Math.ceil(res.larguraDoTexto(texto) * px / 11) + 8;
  plano.celulas.push({
    tipo: 'vertice', id: 'titulo', pai: '1', rotulo: modelo.titulo, style: S_TITULO,
    geo: { x: OFF_X, y: 30, w: larg(modelo.titulo, 19), h: 26 },
  });
  if (modelo.subtitulo)
    plano.celulas.push({
      tipo: 'vertice', id: 'subtitulo', pai: '1', rotulo: modelo.subtitulo, style: S_SUB,
      geo: { x: OFF_X, y: 58, w: larg(modelo.subtitulo, 12), h: 18 },
    });
}

/**
 * O modelo viaja DENTRO do arquivo. O #2 provou que atributo de `<object>` faz
 * round-trip byte a byte, inclusive com quebra de linha — então o `.drawio` é o
 * seu próprio formato de persistência e não há um segundo arquivo para
 * dessincronizar.
 */
function celulaDoModelo(modelo) {
  return {
    tipo: 'vertice', id: 'panlabs-modelo', pai: '1', rotulo: '', visivel: false,
    style: 'text;html=1;', geo: { x: 0, y: 0, w: 1, h: 1 },
    dados: {
      panlabsEsquema: modelo.esquema,
      panlabsModelo: JSON.stringify(modelo),
    },
  };
}

function rodape(plano, modelo, larguraUtil, res, y) {
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
    tipo: 'vertice', id: 'notas', pai: '1', rotulo: texto, style: S_NOTA,
    geo: { x: OFF_X, y: y + 20, w: larguraUtil, h: alt },
  });
  return y + 20 + alt;
}

// ------------------------------------------------------------ caminho A (ELK)

function planoDeElk(modelo, d, res, layout, opts = {}) {
  const { saida, caixas } = layout;
  const plano = { id: modelo.id, nome: modelo.titulo, celulas: [], fundo: '#FFFFFF' };
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
      rotulo: rotuloDaAresta(a), style: estiloAresta(a, anc, opts.fluxo),
      pontos: (sec.bendPoints || []).map(desl),
    });
  }

  // notas presas a um nó
  for (const [i, n] of (modelo.notas || []).entries()) {
    if (n.sobre === undefined) continue;
    const a = abs.get(n.sobre);
    if (!a) continue;
    plano.celulas.push({
      tipo: 'vertice', id: n.id || `nota-${i}`, pai: '1', rotulo: n.texto, style: S_NOTA,
      geo: { x: a.x + a.w + 14, y: a.y, w: 190, h: 46 },
    });
  }

  const largura = Math.max(saida.width + 2 * OFF_X, 900);
  const fim = rodape(plano, modelo, largura - 2 * OFF_X, res, saida.height + OFF_Y + (layout.rotuloMax || 0));
  plano.larg = largura;
  plano.alt = fim + RODAPE;
  plano.celulas.push(celulaDoModelo(modelo));
  return plano;
}

// ---------------------------------------------------------- caminho B (grade)

function planoDeGrade(modelo, d, res, g, opts = {}) {
  const plano = { id: modelo.id, nome: modelo.titulo, celulas: [], fundo: '#FFFFFF' };
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
  const esquerda = Math.min(...[...g.vpcBox.values()].map(b => b.x));

  // 1. faixas de AZ PRIMEIRO: z-order é ordem do documento, e elas ficam atrás
  //
  // A faixa corre ao longo do eixo em que as VPCs empilham — é o que a faz
  // atravessar todas elas — e a `AZ_LANE` reserva o rótulo do outro lado. Com a
  // AZ em coluna a faixa é vertical e o rótulo nasce ACIMA; transposta, ela é
  // horizontal e o rótulo nasce À ESQUERDA. É a mesma calha, no outro eixo.
  for (const z of g.azs) {
    const membros = modelo.nos.filter(n => n.az === z).map(n => g.pos.get(n.id)).filter(Boolean);
    if (!membros.length) continue;
    const geo = g.raia
      ? {
          // a raia começa na borda da VPC mais à esquerda e transborda à
          // direita pelo `CROSS_OUT` — é o transbordo que faz o cruzamento SE
          // VER (#19, regra 3). O rótulo mora na tira reservada acima.
          x: esquerda - 8,
          y: Math.min(...membros.map(m => m.y)) - (g.reservaDaRaia.get(z) || g.RAIA_LANE),
          w: Math.max(...membros.map(m => m.x + m.w)) + g.CROSS_OUT - (esquerda - 8),
          h: Math.max(...membros.map(m => m.y + m.h)) + 10 -
             (Math.min(...membros.map(m => m.y)) - (g.reservaDaRaia.get(z) || g.RAIA_LANE)),
        }
      : {
          x: Math.min(...membros.map(m => m.x)) - 14,
          y: topo - g.AZ_LANE,
          w: Math.max(...membros.map(m => m.x + m.w)) + 14 - (Math.min(...membros.map(m => m.x)) - 14),
          h: Math.max(...membros.map(m => m.y + m.h)) + g.CROSS_OUT - (topo - g.AZ_LANE),
        };
    // O estilo do catálogo não traz `align`, então o rótulo sai centrado — que
    // é certo para uma coluna estreita e errado para uma raia larga, onde o
    // texto cai no meio do desenho, em cima do que estiver ali. Ancorar à
    // esquerda é do MOTOR pelo mesmo critério do halo das faixas de membro: a
    // paleta continua sendo do catálogo, a legibilidade é de quem posiciona.
    const style = res.faixaAz().style + (g.raia ? 'align=left;spacingLeft=10;' : '');
    plano.celulas.push({
      tipo: 'vertice', id: `az-${z}`, pai: idNuvem,
      rotulo: `Availability Zone · ${z}`, style, geo,
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

  // 4. o fluxo. O #11 deixou a grade SEM arestas de propósito — o #6 tinha
  // medido que o diagrama multi-conta carro-chefe da AWS não tem nenhuma, e o
  // eixo estava em aberto. O #21 fechou o eixo dizendo que a dimensão ORDENADA
  // fica com a horizontal, e "ordenada" quer dizer passo numerado: sem desenhar
  // o passo, a escolha de eixo não teria como ser vista nem conferida. Então a
  // grade passa a desenhar o que o modelo declara.
  //
  // O roteamento é do motor, não do ELK, pelo mesmo motivo do caminho C: quem
  // sabe onde estão as calhas da grade é quem construiu a grade.
  arestasNaGrade(plano, modelo, d, res, g, opts);

  const largura = OFF_X * 2 + larguraNuvem;
  const fim = rodape(plano, modelo, largura - 2 * OFF_X, res, OFF_Y + g.fim + PAD);
  plano.larg = largura;
  plano.alt = fim + RODAPE;
  plano.celulas.push(celulaDoModelo(modelo));
  return plano;
}

/**
 * As arestas dentro da grade.
 *
 * Duas pontas na MESMA raia (ou coluna) viram linha reta ao longo do eixo do
 * fluxo — que é o caso que o #21 quis privilegiar ao pôr o passo numerado na
 * horizontal. Pontas em raias diferentes desviam pela borda mais próxima da
 * ORIGEM, que é o terceiro achado de método do #21:
 *
 *   > Aresta que pula etapa desvia pela margem mais próxima da origem. Desviar
 *   > pelo lado errado atravessa exatamente as faixas que o desvio existia para
 *   > evitar.
 */
function arestasNaGrade(plano, modelo, d, res, g, opts) {
  if (!d.arestas.length) return;

  const abs = new Map();
  for (const s of modelo.nos.filter(n => n.tipo === 'subnet')) {
    const p = g.pos.get(s.id);
    if (!p) continue;
    abs.set(s.id, p);
    for (const filho of g.intra.get(s.id).filhos || []) {
      const meta = g.caixas.get(filho.id);
      abs.set(filho.id, { x: p.x + filho.x, y: p.y + filho.y, w: meta.formaW, h: meta.formaH });
    }
  }

  const raiaDe = id => {
    const n = d.t.porId.get(id);
    if (!n) return null;
    const s = n.tipo === 'subnet' ? n : d.t.ancestrais(n).find(a => a.tipo === 'subnet');
    return s ? s.az : null;
  };

  for (const a of d.arestas) {
    const o = abs.get(a.de), dst = abs.get(a.para);
    if (!o || !dst) continue;
    const mesma = raiaDe(a.de) && raiaDe(a.de) === raiaDe(a.para);
    const adiante = g.raia ? dst.x >= o.x : dst.y >= o.y;

    let anc, pontos = [];
    if (g.raia) {
      const y0 = o.y + o.h / 2, y1 = dst.y + dst.h / 2;
      anc = { saida: { x: adiante ? 1 : 0, y: 0.5 }, entrada: { x: adiante ? 0 : 1, y: 0.5 } };
      if (!mesma) {
        // desvia pela margem mais próxima da ORIGEM (#21)
        const meio = adiante ? (o.x + o.w + dst.x) / 2 : (dst.x + dst.w + o.x) / 2;
        pontos = [{ x: meio, y: y0 }, { x: meio, y: y1 }];
      }
    } else {
      const x0 = o.x + o.w / 2, x1 = dst.x + dst.w / 2;
      anc = { saida: { x: 0.5, y: adiante ? 1 : 0 }, entrada: { x: 0.5, y: adiante ? 0 : 1 } };
      if (!mesma) {
        const meio = adiante ? (o.y + o.h + dst.y) / 2 : (dst.y + dst.h + o.y) / 2;
        pontos = [{ x: x0, y: meio }, { x: x1, y: meio }];
      }
    }

    plano.celulas.push({
      tipo: 'aresta', id: a.id, pai: '1', de: a.de, para: a.para,
      rotulo: rotuloDaAresta(a), style: estiloAresta(a, anc, opts.fluxo), pontos,
    });
  }
}

// --------------------------------------------------------- caminho C (contas)

/**
 * O rótulo de OU. Não é uma caixa, e isso é medição, não estilo.
 *
 * O deck oficial tem uma lista FECHADA de 13 group icons e `AWS account` está
 * nela; `Organization` e `Organizational unit` não estão (#6 G1). A AWS desenha
 * OU como par ícone+rótulo flutuando ACIMA do primeiro membro, sem retângulo, e
 * o agrupamento é feito pelo contraste de gap 1:4 (`G2`/`S3`).
 *
 * Então a faixa de OU usa o MESMO construtor de banda derivada do #19 — união
 * dos membros — e só troca o que faz com ela: em vez de virar retângulo, a
 * união vira a âncora onde o rótulo é ancorado. Um construtor, dois renders.
 */
const S_OU = 'text;html=1;fontSize=13;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;';
/** O barramento do `E4`: uma linha paralela à fileira, deslocada para FORA dela. */
const S_BARRAMENTO = 'endArrow=none;html=1;strokeColor=#232F3E;strokeWidth=1.6;';
const S_STUB = 'edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#232F3E;strokeWidth=1.6;' +
  'endArrow=blockThin;endFill=1;endSize=6;fontSize=10;fontColor=#232F3E;labelBackgroundColor=#FFFFFF;';

/**
 * `E9` — habilitador de permissão é NÓ ANEXADO, com seta curta apontando para
 * CIMA, para dentro do componente que ele autoriza. Nunca rótulo de aresta.
 * Confirmado em dois padrões oficiais independentes (bucket policy do Flow
 * Logs; Role do EventBridge cross-account).
 */
const S_HABILITA = 'edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#5A6C86;strokeWidth=1.4;dashed=1;' +
  'dashPattern=6 4;endArrow=blockThin;endFill=1;endSize=6;';

function planoDeContas(modelo, d, res, g, opts = {}) {
  const plano = { id: modelo.id, nome: modelo.titulo, celulas: [], fundo: '#FFFFFF' };
  cabecalho(plano, modelo, res);

  const abs = new Map();          // id -> caixa absoluta, para arestas e faixas
  const nuvem = modelo.nos.find(n => n.tipo === 'nuvem');

  // nós que não moram em conta nenhuma (o ator, tipicamente) ficam FORA da
  // nuvem e à esquerda — `O19` do #5: o usuário entra pela esquerda
  const forasteiros = modelo.nos.filter(n =>
    n.dentro === undefined && n.tipo !== 'nuvem' && n.tipo !== 'conta' && !d.t.filhos.get(n.id).length);
  let margemEsq = 0;
  for (const f of forasteiros) margemEsq = Math.max(margemEsq, res.folha(f).formaW + 60);

  // A canaleta de cima tem de ser RESERVADA antes de posicionar, não descoberta
  // depois: ela empurra a fileira inteira para baixo. Quantas faixas ela precisa
  // é contável sem geometria nenhuma — é quantas arestas de fora chegam numa
  // conta que não é a primeira da fileira.
  const idxDaConta = new Map(g.ordem.map((c, i) => [c.id, i]));
  const contaDoNoId = id => {
    const n = d.t.porId.get(id);
    if (!n) return null;
    const c = n.tipo === 'conta' ? n : d.t.ancestrais(n).find(a => a.tipo === 'conta');
    return c ? c.id : null;
  };
  const deForaDesviadas = d.arestas.filter(a => {
    const ca = contaDoNoId(a.de), cb = contaDoNoId(a.para);
    if (ca && cb) return false;
    const alvo = cb || ca;
    return alvo !== null && idxDaConta.get(alvo) > 0;
  }).length;
  const reservaTopo = deForaDesviadas ? 26 + deForaDesviadas * 30 : 0;

  /**
   * e a de baixo pela mesma conta — mas ela depende do MECANISMO, não só da
   * contagem. Reservar só para o nível 6 deixava o barramento (`E4`) desenhado
   * fora da caixa `AWS Cloud`: ele nasce abaixo da fileira e ninguém tinha
   * pedido a altura. Era bug latente porque nenhum modelo o exercitava — os
   * modelos `hub-tgw` e `logs-centralizados` existem para que não seja mais.
   */
  const desviadas = d.politica.mecanismo === 'direta'
    ? d.travessias.filter(t => idxDaConta.get(t.contaPara) !== idxDaConta.get(t.contaDe) + 1).length
    : 0;
  const reservaFundo =
    d.politica.mecanismo === 'barramento' ? 46 + 34
    : desviadas ? 40 + desviadas * 34
    : 0;
  /**
   * a agregada entra pela ESQUERDA do destino, então ela cobra margem lateral —
   * e a margem tem de caber o RÓTULO, não um número redondo. É o rótulo que faz
   * o trabalho no `E3` ("o texto substitui a cardinalidade"): encolher a corrida
   * até ele transbordar por cima do ícone de destino desfaz o mecanismo.
   */
  const textoAgregado = d.politica.mecanismo === 'agregada'
    ? (d.politica.grupos || []).map(grupo => {
        const ex = d.travessias.find(t => t.para === grupo.para);
        return `${ex && ex.rotulo ? ex.rotulo : 'de'} · ${grupo.contas.length} contas`;
      })
    : [];
  const reservaEsq = textoAgregado.length
    ? Math.max(110, ...textoAgregado.map(t => res.larguraDoTexto(t) + 60))
    : 0;

  const baseX = OFF_X + margemEsq + reservaEsq;
  // A ordem importa: o título da nuvem primeiro, a canaleta DEPOIS dele. No
  // render anterior a reserva entrou antes e a canaleta de cima caiu em cima da
  // faixa de título da nuvem.
  const baseY = OFF_Y + (nuvem ? 34 + PAD : 0) + reservaTopo;

  // 1. a nuvem, se declarada, envolve a grade inteira
  // a nuvem tem de CONTER as duas canaletas: uma ligação entre contas AWS
  // desenhada fora da caixa "AWS Cloud" é uma mentira pequena, mas é mentira
  const alturaNuvem = 34 + PAD + reservaTopo + g.altura + reservaFundo + PAD;
  const idNuvem = nuvem ? nuvem.id : null;
  if (nuvem) {
    const c = res.container(nuvem);
    plano.celulas.push({
      tipo: 'vertice', id: nuvem.id, pai: '1', rotulo: nuvem.rotulo || 'AWS Cloud', style: c.style,
      geo: { x: baseX - PAD - reservaEsq, y: OFF_Y, w: g.largura + 2 * PAD + reservaEsq, h: alturaNuvem },
    });
    abs.set(nuvem.id, { x: baseX - PAD - reservaEsq, y: OFF_Y, w: g.largura + 2 * PAD + reservaEsq, h: alturaNuvem });
  }

  // 2. os forasteiros, à esquerda da nuvem, centrados na vertical
  for (const [i, f] of forasteiros.entries()) {
    const m = res.folha(f);
    const a = { x: OFF_X, y: OFF_Y + g.altura / 2 - m.formaH / 2 + i * (m.formaH + 40), w: m.formaW, h: m.formaH };
    abs.set(f.id, a);
    plano.celulas.push({
      tipo: 'vertice', id: f.id, pai: '1', rotulo: m.rotulo, style: m.style,
      geo: { x: a.x, y: a.y, w: a.w, h: a.h },
    });
  }

  // 3. rótulos de OU — ANTES das contas, porque a ordem do documento é a ordem z
  if (d.ou.desenhar && g.modo !== 'integracao') {
    for (const col of g.colunas) {
      if (!col.ou) continue;
      const faixa = d.faixasOu.find(f => f.membros.includes(col.contas[0]));
      plano.celulas.push({
        tipo: 'vertice', id: faixa ? faixa.id : `ou-${col.ou}`, pai: idNuvem || '1',
        rotulo: `OU – ${col.ou}`, style: S_OU,
        geo: {
          x: (idNuvem ? PAD : baseX) + col.x, y: (idNuvem ? PAD + 34 : baseY) + 8,
          w: Math.max(140, res.larguraDoTexto(`OU – ${col.ou}`) + 16), h: 24,
        },
      });
    }
  }

  // 4. as contas e tudo dentro delas
  for (const conta of g.ordem) {
    const p = g.pos.get(conta.id);
    const ax = baseX + p.x, ay = baseY + p.y;
    abs.set(conta.id, { x: ax, y: ay, w: p.w, h: p.h });
    const meta = g.caixas.get(conta.id);

    // `X6`: a conta que é hub ganha ênfase de borda. Hub = a que mais participa
    // de travessia — e só vale a pena marcar se ela de fato se destaca.
    const style = meta.style + (conta.id === g.hub ? 'strokeWidth=2.6;fontStyle=1;' : '');
    plano.celulas.push({
      tipo: 'vertice', id: conta.id, pai: idNuvem || '1', rotulo: conta.rotulo || '', style,
      geo: { x: ax - (idNuvem ? abs.get(idNuvem).x : 0), y: ay - (idNuvem ? abs.get(idNuvem).y : 0), w: p.w, h: p.h },
    });

    (function andar(no, paiId, paiAbs) {
      for (const c of no.children || []) {
        const m = g.caixas.get(c.id);
        const noModelo = d.t.porId.get(c.id);
        const a = { x: paiAbs.x + c.x, y: paiAbs.y + c.y, w: c.width, h: c.height };
        abs.set(c.id, a);
        plano.celulas.push({
          tipo: 'vertice', id: c.id, pai: paiId,
          rotulo: m.container ? (noModelo.rotulo || '') : m.rotulo,
          style: m.style,
          geo: { x: c.x, y: c.y, w: c.width, h: c.height },
        });
        if (c.children && c.children.length) andar(c, c.id, a);
      }
    })(g.interno.get(conta.id), conta.id, { x: ax, y: ay });

    // arestas INTERNAS da conta, convertidas para o espaço absoluto (#2 §5.2:
    // um sistema de coordenadas só)
    for (const e of g.interno.get(conta.id).edges || []) {
      const a = d.arestas.find(x => x.id === e.id);
      const sec = (e.sections || [])[0];
      if (!a || !sec) continue;
      const desl = pt => ({ x: ax + pt.x, y: ay + pt.y });
      const anc = {
        saida: ancora(abs.get(a.de), desl(sec.startPoint)),
        entrada: ancora(abs.get(a.para), desl(sec.endPoint)),
      };
      plano.celulas.push({
        tipo: 'aresta', id: e.id, pai: '1', de: a.de, para: a.para,
        rotulo: rotuloDaAresta(a), style: estiloAresta(a, anc, opts.fluxo),
        pontos: (sec.bendPoints || []).map(desl),
      });
    }
  }

  // 5. a travessia, pelo mecanismo que a política escolheu — e o que entra de fora
  g.reservaEsq = reservaEsq;
  travessiasNoPlano(plano, modelo, d, res, g, abs, opts);
  arestasDeFora(plano, d, g, abs, opts);

  // 6. habilitadores de permissão (E9): seta curta para dentro de quem autorizam
  for (const h of d.habilitadores) {
    if (!abs.has(h.id) || !abs.has(h.alvo)) continue;
    plano.celulas.push({
      tipo: 'aresta', id: `hab-${h.id}`, pai: '1', de: h.id, para: h.alvo,
      rotulo: '', style: S_HABILITA, pontos: [],
    });
  }

  // 7. notas presas a um nó
  for (const [i, n] of (modelo.notas || []).entries()) {
    if (n.sobre === undefined) continue;
    const a = abs.get(n.sobre);
    if (!a) continue;
    plano.celulas.push({
      tipo: 'vertice', id: n.id || `nota-${i}`, pai: '1', rotulo: n.texto, style: S_NOTA,
      geo: { x: a.x + a.w + 14, y: a.y, w: 190, h: 46 },
    });
  }

  const fundo = OFF_Y + (nuvem ? alturaNuvem : g.altura + reservaFundo) + PAD;
  const largura = Math.max(baseX + g.largura + OFF_X, 900);
  const fim = rodape(plano, modelo, largura - 2 * OFF_X, res, fundo);
  plano.larg = largura;
  plano.alt = fim + RODAPE;
  plano.celulas.push(celulaDoModelo(modelo));
  return plano;
}

/**
 * De que lado o nó pode sair sem passar por cima de quem não é dele.
 *
 * `E8` diz que a borda da conta é atravessada sem cerimônia — mas ela fala das
 * bordas de quem CONTÉM o nó. Atravessar a caixa de um IRMÃO é outra coisa: é
 * `A5.5` da rubrica (#8), aresta cortando faixa alheia, e foi o que apareceu no
 * segundo render — a travessia saiu do Transit Gateway para baixo e desceu por
 * dentro da VPC de inspeção, do Inspection subnet e do Network Firewall, que
 * não têm nada com aquela ligação.
 *
 * A regra: obstáculo é toda caixa desenhada que NÃO é ancestral nem descendente
 * do nó. Se ela cai na faixa horizontal do nó entre ele e a borda, aquele lado
 * está sujo. Preferir o lado que aponta para o destino, mas só se estiver limpo.
 */
function ladoLivre(no, alvoAbs, contaAbs, abs, d, idNo) {
  const meu = new Set([idNo]);
  for (const a of d.t.ancestrais(d.t.porId.get(idNo))) meu.add(a.id);
  (function desc(id) { for (const k of d.t.filhos.get(id)) { meu.add(k.id); desc(k.id); } })(idNo);

  const cruza = (x1, x2) => {
    for (const [id, b] of abs) {
      if (meu.has(id) || id === contaAbs.id) continue;
      const dentroDaConta = b.x >= contaAbs.x - 1 && b.x + b.w <= contaAbs.x + contaAbs.w + 1;
      if (!dentroDaConta) continue;
      const faixa = b.y < no.y + no.h && b.y + b.h > no.y;         // sobrepõe a faixa do nó
      if (faixa && b.x < x2 && b.x + b.w > x1) return true;
    }
    return false;
  };

  const esquerdaLimpa = !cruza(contaAbs.x, no.x);
  const direitaLimpa = !cruza(no.x + no.w, contaAbs.x + contaAbs.w);
  const prefereEsquerda = alvoAbs && alvoAbs.x + alvoAbs.w / 2 < no.x;

  if (prefereEsquerda && esquerdaLimpa) return 'esquerda';
  if (!prefereEsquerda && direitaLimpa) return 'direita';
  if (esquerdaLimpa) return 'esquerda';
  if (direitaLimpa) return 'direita';
  return prefereEsquerda ? 'esquerda' : 'direita';   // nenhum limpo: o mal menor é o curto
}

/**
 * A travessia de fronteira de conta — o núcleo da pergunta do #12.
 *
 * Cada `nivel` aqui é um dos degraus da hierarquia de fallback do #6 §6.4, e a
 * escolha entre eles já foi feita em `derivar.politicaDeTravessia`. Este módulo
 * só desenha o que foi escolhido.
 *
 * O que NÃO tem aqui também é decisão: nenhuma cerimônia na borda da conta.
 * `E8` mediu em todos os padrões do §3 que "a linha simplesmente passa por cima
 * da borda magenta — não existe convenção AWS de porta, gateway, losango ou
 * marcador de travessia". Então nada de `jumpStyle` na fronteira: o que marca a
 * travessia é ONDE o habilitador de permissão está (`E9`), não a linha.
 */
function travessiasNoPlano(plano, modelo, d, res, g, abs, opts) {
  const pol = d.politica;
  if (pol.mecanismo === 'suprimir') return;

  const caixa = id => abs.get(id);
  const contaDoNo = id => {
    const n = d.t.porId.get(id);
    const c = n && (n.tipo === 'conta' ? n : d.t.ancestrais(n).find(a => a.tipo === 'conta'));
    return c ? c.id : null;
  };

  if (pol.mecanismo === 'barramento') {
    // `E4` + `X3`: UMA linha paralela à fileira, deslocada para fora dela, com
    // stubs perpendiculares curtos entrando em cada conta. 1 linha + N stubs,
    // nunca N linhas — é literalmente o desenho do AMS MALZ.
    const y = Math.max(...g.ordem.map(c => caixa(c.id).y + caixa(c.id).h)) + 46;
    for (const grupo of pol.grupos) {
      const alvos = grupo.contas.map(id => caixa(id)).filter(Boolean);
      if (alvos.length < 2) continue;
      const x1 = Math.min(...alvos.map(a => a.x + a.w / 2));
      const x2 = Math.max(...alvos.map(a => a.x + a.w / 2));
      const origem = caixa(grupo.de);
      plano.celulas.push({
        tipo: 'aresta', id: `bus-${grupo.de}`, pai: '1', de: null, para: null,
        rotulo: '', style: S_BARRAMENTO,
        pontos: [{ x: x1, y }, { x: x2, y }],
        solta: { x1, y1: y, x2, y2: y },
      });
      // o stub que desce da origem até o barramento
      if (origem)
        plano.celulas.push({
          tipo: 'aresta', id: `bus-tronco-${grupo.de}`, pai: '1', de: grupo.de, para: null,
          rotulo: '', style: S_BARRAMENTO,
          pontos: [{ x: origem.x + origem.w / 2, y: origem.y + origem.h },
                   { x: origem.x + origem.w / 2, y }],
          solta: { x1: origem.x + origem.w / 2, y1: origem.y + origem.h, x2: origem.x + origem.w / 2, y2: y },
        });
      for (const id of grupo.contas) {
        const a = caixa(id);
        const cx = a.x + a.w / 2;
        const travessia = d.travessias.find(t => t.de === grupo.de && t.contaPara === id);
        plano.celulas.push({
          tipo: 'aresta', id: `stub-${id}`, pai: '1', de: null, para: id,
          rotulo: travessia ? rotuloDaAresta(travessia) : '', style: S_STUB,
          pontos: [{ x: cx, y }, { x: cx, y: a.y + a.h }],
          solta: { x1: cx, y1: y, x2: cx, y2: a.y + a.h },
        });
      }
    }
    g.barramentoAlt = 70;
    return;
  }

  if (pol.mecanismo === 'agregada') {
    // `E3`: fan-in de N contas colapsa em UMA aresta entrando na caixa do
    // destino vinda de fora, com o TEXTO carregando a cardinalidade — nunca N
    // arestas. É o que a SRA faz na Log Archive ("From CloudTrail organization
    // trail").
    for (const grupo of pol.grupos) {
      const alvo = caixa(grupo.para);
      if (!alvo) continue;
      const contaAlvo = contaDoNo(grupo.para);
      const cAlvo = caixa(contaAlvo);
      const exemplo = d.travessias.find(t => t.para === grupo.para);
      const texto = `${exemplo && exemplo.rotulo ? exemplo.rotulo : 'de'} · ${grupo.contas.length} contas`;
      const x0 = (cAlvo ? cAlvo.x : alvo.x) - (g.reservaEsq || 90);
      plano.celulas.push({
        tipo: 'aresta', id: `fanin-${grupo.para}`, pai: '1', de: null, para: grupo.para,
        rotulo: texto, style: S_STUB,
        pontos: [{ x: x0, y: alvo.y + alvo.h / 2 }],
        solta: { x1: x0, y1: alvo.y + alvo.h / 2, x2: alvo.x, y2: alvo.y + alvo.h / 2 },
      });
    }
    return;
  }

  // `E10`/nível 6: aresta direta. O roteamento é do MOTOR, não do ELK, porque
  // é ele que sabe onde a calha está — e é isso que impede o espaguete: toda
  // travessia desce pela MESMA calha, em vez de cada uma achar seu caminho.
  //
  // Mas "direta" só é direta quando as contas são vizinhas E o sentido bate com
  // o eixo. Quando não bate, a linha reta atravessa o INTERIOR da conta de
  // origem — no primeiro render, a travessia ECS→Transit Gateway cortou a VPC
  // inteira e largou o rótulo "atracamento VPC" em cima do ícone do ALB, que é
  // `A3.2` da rubrica (#8) e `A5.5` de uma vez só.
  //
  // A saída não é inventada: é `X3`. A canaleta dedicada é uma faixa PARALELA à
  // fileira de contas, DESLOCADA PARA FORA dela, com stubs perpendiculares
  // entrando na borda de cada conta. O que o #6 mediu para "N irmãs recebem o
  // mesmo vínculo" serve igual para "esta travessia não cabe no eixo": tirar a
  // linha de dentro das caixas é o ponto dos dois.
  const ordemIdx = new Map(g.ordem.map((c, i) => [c.id, i]));
  const fundoDaFileira = Math.max(...g.ordem.map(c => caixa(c.id).y + caixa(c.id).h));
  let faixaCanaleta = 0;

  for (const t of d.travessias) {
    const o = caixa(t.de), dst = caixa(t.para);
    if (!o || !dst) continue;
    const ia = ordemIdx.get(t.contaDe), ib = ordemIdx.get(t.contaPara);
    const adjacenteAdiante = ib === ia + 1;

    if (adjacenteAdiante) {
      const cA = caixa(t.contaDe), cB = caixa(t.contaPara);
      const calhaX = (cA.x + cA.w + cB.x) / 2;
      const y0 = o.y + o.h / 2, y1 = dst.y + dst.h / 2;
      plano.celulas.push({
        tipo: 'aresta', id: t.id, pai: '1', de: t.de, para: t.para,
        rotulo: rotuloDaAresta(t),
        style: estiloAresta(t, { saida: { x: 1, y: 0.5 }, entrada: { x: 0, y: 0.5 } }, opts.fluxo),
        pontos: y0 === y1 ? [] : [{ x: calhaX, y: y0 }, { x: calhaX, y: y1 }],
      });
      continue;
    }

    // Canaleta por fora (`X3`): sai do nó pela HORIZONTAL, pelo lado limpo, até
    // a calha entre as contas; desce a calha; corre por baixo da fileira; sobe
    // a outra calha; entra na horizontal. Sair pela vertical era o caminho
    // curto e era o errado — a linha descia por dentro das caixas irmãs.
    faixaCanaleta += 1;
    const yCanal = fundoDaFileira + 40 + (faixaCanaleta - 1) * 34;
    const cA = { ...caixa(t.contaDe), id: t.contaDe };
    const cB = { ...caixa(t.contaPara), id: t.contaPara };
    const ladoO = ladoLivre(o, dst, cA, abs, d, t.de);
    const ladoD = ladoLivre(dst, o, cB, abs, d, t.para);
    const xo = ladoO === 'esquerda' ? cA.x - g.CALHA / 2 : cA.x + cA.w + g.CALHA / 2;
    const xd = ladoD === 'esquerda' ? cB.x - g.CALHA / 2 : cB.x + cB.w + g.CALHA / 2;
    const yo = o.y + o.h / 2, yd = dst.y + dst.h / 2;
    plano.celulas.push({
      tipo: 'aresta', id: t.id, pai: '1', de: t.de, para: t.para,
      rotulo: rotuloDaAresta(t),
      style: estiloAresta(t, {
        saida: { x: ladoO === 'esquerda' ? 0 : 1, y: 0.5 },
        entrada: { x: ladoD === 'esquerda' ? 0 : 1, y: 0.5 },
      }, opts.fluxo),
      pontos: [{ x: xo, y: yo }, { x: xo, y: yCanal }, { x: xd, y: yCanal }, { x: xd, y: yd }],
    });
  }
  if (faixaCanaleta) g.canaletaAlt = 40 + faixaCanaleta * 34;
}

/**
 * Arestas que entram no desenho vindas de fora de qualquer conta — o ator, o
 * cliente, a internet.
 *
 * Não são travessia de conta (não têm conta dos dois lados), então a política
 * do #6 §6.4 não fala delas; e não são internas de conta nenhuma, então o ELK
 * de cada conta não as viu. Ficaram sem dono na primeira versão e SUMIRAM do
 * desenho — a aresta "1. HTTPS" do cliente para o ALB simplesmente não existia
 * no render, que é omissão calada, `A4.2`.
 */
function arestasDeFora(plano, d, g, abs, opts) {
  const contaDoNo = id => {
    const n = d.t.porId.get(id);
    if (!n) return null;
    const c = n.tipo === 'conta' ? n : d.t.ancestrais(n).find(a => a.tipo === 'conta');
    return c ? c.id : null;
  };
  const ordemIdx = new Map(g.ordem.map((c, i) => [c.id, i]));
  const topoDaFileira = Math.min(...g.ordem.map(c => abs.get(c.id).y));
  let faixaTopo = 0;

  for (const a of d.arestas) {
    const ca = contaDoNo(a.de), cb = contaDoNo(a.para);
    if (ca && cb) continue;            // intra-conta ou travessia: já desenhadas
    const o = abs.get(a.de), dst = abs.get(a.para);
    if (!o || !dst) continue;

    // A entrada vinda de fora só é reta quando a conta de destino é a primeira
    // da fileira. Se não for, a reta atravessa as contas anteriores — no
    // segundo render, o "1. HTTPS" do cliente cortou a conta Network inteira e
    // largou o rótulo em cima do título da VPC de inspeção.
    const alvoConta = cb || ca;
    const idx = ordemIdx.get(alvoConta);
    const reta = idx === undefined || idx === 0;
    const y0 = o.y + o.h / 2, y1 = dst.y + dst.h / 2;

    if (reta) {
      const meio = (o.x + o.w + dst.x) / 2;
      plano.celulas.push({
        tipo: 'aresta', id: a.id, pai: '1', de: a.de, para: a.para,
        rotulo: rotuloDaAresta(a),
        style: estiloAresta(a, { saida: { x: 1, y: 0.5 }, entrada: { x: 0, y: 0.5 } }, opts.fluxo),
        pontos: y0 === y1 ? [] : [{ x: meio, y: y0 }, { x: meio, y: y1 }],
      });
      continue;
    }

    // canaleta por CIMA — a simétrica da de baixo. A de baixo carrega travessia
    // entre contas; esta carrega o que entra de fora e teria de furar conta
    // alheia para chegar. Duas faixas, uma de cada lado da fileira, e nenhuma
    // linha dentro de caixa que não é dela.
    faixaTopo += 1;
    const yCanal = topoDaFileira - 26 - (faixaTopo - 1) * 30;
    const cB = { ...abs.get(alvoConta), id: alvoConta };
    const ladoD = ladoLivre(dst, o, cB, abs, d, a.para);
    const xd = ladoD === 'esquerda' ? cB.x - g.CALHA / 2 : cB.x + cB.w + g.CALHA / 2;
    plano.celulas.push({
      tipo: 'aresta', id: a.id, pai: '1', de: a.de, para: a.para,
      rotulo: rotuloDaAresta(a),
      style: estiloAresta(a, {
        saida: { x: 0.5, y: 0 },
        entrada: { x: ladoD === 'esquerda' ? 0 : 1, y: 0.5 },
      }, opts.fluxo),
      pontos: [{ x: o.x + o.w / 2, y: yCanal }, { x: xd, y: yCanal }, { x: xd, y: y1 }],
    });
  }
  if (faixaTopo) g.canaletaTopo = 26 + faixaTopo * 30;
}

module.exports = { planoDeElk, planoDeGrade, planoDeContas, FLUXO, OFF_X, OFF_Y };
