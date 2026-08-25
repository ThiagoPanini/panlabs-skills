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

const dispor = require('./layout.cjs');
const { AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, calhaDaFaixa, folgas } = dispor;
const { LEAVES } = require('./validate.cjs');

/**
 * A altura de uma linha do bloco de título, em função do corpo dela.
 *
 * ⚠️ UM FATOR SÓ, e ele estava escrito duas vezes com valores diferentes — 1,5
 * em `moldura` e 1,4 em `cabecalho`, pegos na revisão do #23. A reserva e o
 * consumo têm de sair da mesma conta, senão o topo da página é 1 px maior ou
 * menor que o bloco que mora nele, e a diferença cresce com a densidade do tema.
 *
 * 1,4 é entrelinha tipográfica comum e é o que o `resolve.cjs` já usa para a
 * folha (17 px a 12 pt ≈ 1,42).
 */
const ROW = px => Math.round(px * 1.4);

/**
 * A margem da página é token (`pagina.margem`, default 32 = 4 degraus da grade
 * base). O topo é a margem mais a altura do bloco de título, que cresce com o
 * corpo do título e com a linha de revisão do `O24` — por isso é calculado, e
 * não uma constante como no #11.
 *
 * ⚠️ A linha de SUBTÍTULO é reservada SEMPRE, e isso é decisão, não descuido —
 * a versão anterior escrevia `texto.subtitulo ? … : 0`, que testa um CORPO DE
 * FONTE (12 nos quatro temas) e portanto nunca era falso: parecia condicional e
 * era constante. O que ela queria testar — *este modelo tem subtítulo?* — não
 * cabe aqui, porque `moldura` é do TEMA e o `mo.topo` é a origem de todo o
 * conteúdo da página; fazê-lo variar por modelo faria dois diagramas do mesmo
 * tema terem origens diferentes sem que o tema tivesse mudado. Reservar sempre
 * custa uma linha de margem num diagrama sem subtítulo; os 15 do corpus têm.
 */
function frame(res) {
  const t = res.tema;
  const m = t.tokens.page.margin;
  const alturaTitulo = ROW(t.tokens.text.title) + ROW(t.tokens.text.subtitle) +
    (t.tokens.card.revision ? Math.round(t.tokens.text.subtitle * 1.3) : 0);
  return { x: m, topo: m + alturaTitulo, rodape: m };
}

/** Recorte do tema que este módulo usa. */
function paint(res) {
  const t = res.tema;
  return {
    background: t.tokens.page.color,
    title: t.title(), subtitle: t.subtitle(), revision: t.revision(), note: t.note(),
    ptTitulo: t.tokens.text.title, ptSub: t.tokens.text.subtitle,
    linhaRevisao: t.tokens.card.revision,
  };
}

/**
 * Estilo de aresta. O roteamento é daqui — as âncoras `exit*`/`entry*` são
 * geometria, não pintura —, e todo o resto vem do token, inclusive a decisão que
 * o #5 chama de N9/A11: a seta oficial da AWS é SEMPRE sólida, então `tracejado`
 * e `animado` são desvios que pagam uma dívida, não opções neutras.
 *
 * O #2 §5.4 é explícito: `exitX` e `exitY` só valem EM PAR, e sem
 * `exitPerimeter=0` o motor reprojeta o ponto no perímetro do shape — que em
 * shape não retangular é a principal fonte de não-determinismo visual.
 */
function estiloAresta(a, anc, tema) {
  const tip = tema.tokens.edge.tip;
  const extra = {};
  if (a.data === 'both')
    Object.assign(extra, { startArrow: tip, startFill: tip === 'open' ? 0 : 1, startSize: 6 });
  if (anc.output)
    Object.assign(extra, { exitX: anc.output.x, exitY: anc.output.y, exitDx: 0, exitDy: 0, exitPerimeter: 0 });
  if (anc.input)
    Object.assign(extra, { entryX: anc.input.x, entryY: anc.input.y, entryDx: 0, entryDy: 0, entryPerimeter: 0 });
  return tema.edge(extra);
}

const trava = v => Math.min(1, Math.max(0, Math.round(v * 1000) / 1000));

/** De que lado da caixa o ELK encostou a ponta da aresta. */
function ancora(cellBox, p) {
  const eps = 2.5;
  if (Math.abs(p.x - cellBox.x) <= eps) return { x: 0, y: trava((p.y - cellBox.y) / cellBox.h) };
  if (Math.abs(p.x - (cellBox.x + cellBox.w)) <= eps) return { x: 1, y: trava((p.y - cellBox.y) / cellBox.h) };
  if (Math.abs(p.y - cellBox.y) <= eps) return { x: trava((p.x - cellBox.x) / cellBox.w), y: 0 };
  if (Math.abs(p.y - (cellBox.y + cellBox.h)) <= eps) return { x: trava((p.x - cellBox.x) / cellBox.w), y: 1 };
  return null;   // ponta solta: deixa flutuar em vez de mentir uma âncora
}

function rotuloDaAresta(a) {
  const base = a.label || '';
  if (a.order === undefined) return base;
  return base ? `<b>${a.order}.</b> ${base}` : `<b>${a.order}</b>`;
}

/**
 * O título é dimensionado pelo texto, não por um número redondo.
 * Célula larga demais não aparece no desenho — e aparece no ARQUIVO: o
 * `drawio -x` exporta a caixa que contém tudo, então uma faixa de texto de
 * 1100 px de largura para um diagrama de 500 px produz metade da imagem em
 * branco. Foi o que aconteceu na primeira versão deste módulo.
 */
function cabecalho(layoutPlan, model, res) {
  const p = paint(res);
  const mo = frame(res);
  const larg = (text, px) => Math.ceil(res.textWidth(text) * px / 11) + 8;
  /**
   * O bloco de título começa um pouco ACIMA da margem lateral, e o fator sai de
   * uma assimetria real: a margem lateral é medida até a BORDA do primeiro
   * container, e a de cima até o topo da CAIXA DE TEXTO do título — que já traz
   * ar interno, porque o glifo não encosta no topo dela. `LINHA(px)` reserva
   * 1,4× o corpo para um texto cuja altura de glifo é ≈0,7×, então metade do
   * excesso fica em cima. Descontar isso é o que faz a margem óptica de cima
   * bater com a lateral em vez de parecer maior.
   */
  let y = mo.x - Math.round((ROW(p.ptTitulo) - p.ptTitulo) / 2);
  const alt = ROW;
  layoutPlan.celulas.push({
    kind: 'vertice', id: 'title', parent: '1', label: model.title, style: p.title,
    geo: { x: mo.x, y, w: larg(model.title, p.ptTitulo), h: alt(p.ptTitulo) },
  });
  y += alt(p.ptTitulo);
  if (model.subtitle) {
    layoutPlan.celulas.push({
      kind: 'vertice', id: 'subtitle', parent: '1', label: model.subtitle, style: p.subtitle,
      geo: { x: mo.x, y, w: larg(model.subtitle, p.ptSub), h: alt(p.ptSub) },
    });
    y += alt(p.ptSub);
  }
  // O24 do #5: 12 de 12 Reference Architecture PDFs trazem "Reviewed for
  // technical accuracy <data>". É bloco de título, e portanto camada da casa.
  if (p.linhaRevisao)
    layoutPlan.celulas.push({
      kind: 'vertice', id: 'revision', parent: '1', label: p.linhaRevisao, style: p.revision,
      geo: { x: mo.x, y, w: larg(p.linhaRevisao, p.ptSub), h: Math.round(p.ptSub * 1.3) },
    });
}

/**
 * O modelo viaja DENTRO do arquivo. O #2 provou que atributo de `<object>` faz
 * round-trip byte a byte, inclusive com quebra de linha — então o `.drawio` é o
 * seu próprio formato de persistência e não há um segundo arquivo para
 * dessincronizar.
 */
function celulaDoModelo(model, res) {
  const t = res.tema;
  return {
    kind: 'vertice', id: 'panlabs-modelo', parent: '1', label: '', visivel: false,
    style: 'text;html=1;', geo: { x: 0, y: 0, w: 1, h: 1 },
    data: {
      panlabsSchema: model.schema,
      panlabsModelo: JSON.stringify(model),
      // O TEMA VIAJA RESOLVIDO, não por nome — e a razão é a mesma que o #4 §7
      // deu para recusar `style="<nome>"` no `<mxGraphModel>`: nome só resolve
      // contra o que a outra ponta tem. Um `.drawio` que guardasse "tema=claro"
      // regeneraria diferente no dia em que `light.json` mudasse. Guardando os
      // tokens, o arquivo continua sendo o próprio formato de persistência.
      panlabsTema: JSON.stringify({ id: t.id, background: t.background, tokens: t.tokens }),
    },
  };
}

/**
 * Da coordenada de um layout para a da PÁGINA.
 *
 * Três lugares deste arquivo faziam a mesma soma com nomes diferentes (`desl`
 * duas vezes, `paraPagina` uma). É sempre a mesma pergunta — a célula de aresta
 * é filha da camada (`pai: '1'`), e ali o waypoint é de página — e ter três
 * cópias foi exatamente o que deixou a do caminho da grade sem ser feita até o
 * #24 (ver `arestasNaGrade`).
 */
const paraPagina = (base) => (pt) => ({ x: pt.x + base.x, y: pt.y + base.y });

/**
 * Uma caixa vira obstáculo de `dispor.corredorLivre`: `ini..fim` no eixo da
 * perna, `lo..hi` no eixo que ela atravessa. Duas leituras da mesma caixa,
 * porque a perna pode ser vertical ou horizontal.
 */
const caixaEmX = b => ({ ini: b.x, fim: b.x + b.w, lo: b.y, hi: b.y + b.h });
const caixaEmY = b => ({ ini: b.y, fim: b.y + b.h, lo: b.x, hi: b.x + b.w });

/**
 * As notas presas a um nó que o LAYOUT não colocou.
 *
 * Desde o #24 a nota é um nó do ELK (`dispor.notasPorPai`): ela sai do layout
 * com caixa própria, dentro do container do sujeito, sem sobrepor ninguém — e
 * a andada que monta as células já a emitiu, porque ela está em `caixas` como
 * qualquer outra folha.
 *
 * Sobra um caso, e ele é do caminho C: nota sobre um nó que não mora em conta
 * nenhuma. A fileira de contas é grade do MOTOR, não do ELK, então não existe
 * grafo onde essa nota pudesse ter entrado. Aí volta o offset fixo de antes —
 * que é chute, e é por isso que ele é a exceção e não a regra. Sumir com ela
 * seria pior: omissão calada é `A4.2` pelo outro lado.
 */
function notasPresas(layoutPlan, model, abs, p) {
  for (const [i, n] of (model.notes || []).entries()) {
    if (n.about === undefined) continue;
    // o id vem de `dispor.idDaNota` — os dois lados TÊM de concordar, senão o
    // `abs.has(id)` abaixo falha e a nota sai duas vezes
    const id = dispor.idDaNota(n, i);
    if (abs.has(id)) continue;                 // o layout já a colocou
    const a = abs.get(n.about);
    if (!a) continue;
    layoutPlan.celulas.push({
      kind: 'vertice', id, parent: '1', label: n.text, style: p.note,
      geo: { x: a.x + a.w + 14, y: a.y, w: dispor.NOTE_W, h: dispor.NOTE_MIN_H },
    });
  }
}

function rodape(layoutPlan, model, larguraUtil, res, y) {
  const p = paint(res);
  const mo = frame(res);
  const soltas = (model.notes || []).filter(n => n.about === undefined);
  if (!soltas.length) return y;
  const pedacos = soltas.map(n =>
    (n.origin === 'rejected-finding' ? '<b>⚠ Achado aceito pelo time:</b> ' : '') + n.text);
  const text = pedacos.join('<br>');
  // a caixa tem de caber o texto QUEBRADO: uma nota longa numa página estreita
  // ocupa três linhas, e dimensionar por "uma linha por nota" corta a última
  const linhas = pedacos.reduce((n, p) => n + res.labelLines(p.replace(/<[^>]+>/g, ''), larguraUtil - 20), 0);
  const alt = 22 + linhas * 16;
  layoutPlan.celulas.push({
    kind: 'vertice', id: 'notes', parent: '1', label: text, style: p.note,
    geo: { x: mo.x, y: y + 20, w: larguraUtil, h: alt },
  });
  return y + 20 + alt;
}

// ------------------------------------------------------------ caminho A (ELK)

function elkPlan(model, d, res, layout, opts = {}) {
  const mo = frame(res);
  const p = paint(res);
  const { output, boxes } = layout;
  const layoutPlan = { id: model.id, name: model.title, celulas: [], background: p.background,
    tema: res.tema.id };
  cabecalho(layoutPlan, model, res);

  const abs = new Map();

  (function tier(no, paiId, paiAbs) {
    for (const c of no.children || []) {
      const meta = boxes.get(c.id);
      const noModelo = d.t.byId.get(c.id);
      const x = c.x + (paiId === '1' ? mo.x : 0);
      const y = c.y + (paiId === '1' ? mo.topo : 0);
      const a = { x: paiAbs.x + x, y: paiAbs.y + y, w: c.width, h: c.height };
      abs.set(c.id, a);

      layoutPlan.celulas.push({
        kind: 'vertice', id: c.id, parent: paiId,
        label: meta.container ? (noModelo.label || '') : meta.label,
        style: meta.style,
        geo: { x, y, w: c.width, h: c.height },
      });

      if (c.children && c.children.length) tier(c, c.id, a);
    }
  })(output, '1', { x: 0, y: 0 });

  // faixas de membros — a caixa é a UNIÃO calculada, parenteada no ancestral comum
  for (const f of d.bands) {
    const members = f.members.map(id => abs.get(id)).filter(Boolean);
    if (members.length < 2) continue;
    const anc = f.members.map(id => d.t.byId.get(id))
      .reduce((acc, n) => acc === undefined ? n : (require('./derive.cjs').ancestralComum(acc, n, d.t) || acc), undefined);
    const paiId = anc && d.t.byId.get(anc.id) && abs.has(anc.id) ? anc.id : '1';
    const base = paiId === '1' ? { x: 0, y: 0 } : abs.get(paiId);
    const fr = res.band(f);
    const x1 = Math.min(...members.map(m => m.x)) - 12;
    const x2 = Math.max(...members.map(m => m.x + m.w)) + 12;
    const y1 = Math.min(...members.map(m => m.y)) - calhaDaFaixa(fr.style);
    const y2 = Math.max(...members.map(m => m.y + m.h)) + 12 + (layout.rotuloMax || 0);
    layoutPlan.celulas.push({
      kind: 'vertice', id: f.id, parent: paiId, label: f.label || '', style: fr.style,
      geo: { x: x1 - base.x, y: y1 - base.y, w: x2 - x1, h: y2 - y1 },
    });
  }

  // arestas: todas na camada raiz, waypoints absolutos (#2 §5.2 + #7 edgeCoords ROOT)
  for (const e of output.edges || []) {
    const a = d.edges.find(x => x.id === e.id);
    const sec = (e.sections || [])[0];
    if (!sec) continue;
    const desl = paraPagina({ x: mo.x, y: mo.topo });
    const anc = {
      output: ancora(abs.get(a.from), sec.startPoint),
      input: ancora(abs.get(a.to), sec.endPoint),
    };
    layoutPlan.celulas.push({
      kind: 'edge', id: e.id, parent: '1', from: a.from, to: a.to,
      label: rotuloDaAresta(a), style: estiloAresta(a, anc, res.tema),
      pontos: (sec.bendPoints || []).map(desl),
    });
  }

  notasPresas(layoutPlan, model, abs, p);

  const widthOf = Math.max(output.width + 2 * mo.x, 900);
  const fim = rodape(layoutPlan, model, widthOf - 2 * mo.x, res, output.height + mo.topo + (layout.rotuloMax || 0));
  layoutPlan.larg = widthOf;
  layoutPlan.alt = fim + mo.rodape;
  layoutPlan.celulas.push(celulaDoModelo(model, res));
  return layoutPlan;
}

// ---------------------------------------------------------- caminho B (grade)

/**
 * A caixa absoluta (relativa à nuvem) de cada subnet e de cada filho dela —
 * um mapa só, para os dois lugares do caminho B que precisam da mesma conta:
 * `arestasNaGrade` para as barreiras de desvio, e o #31 para saber se a caixa
 * de uma faixa abraçaria um ponto que não é dela.
 */
function gridPositions(model, g) {
  const abs = new Map();
  for (const s of model.nodes.filter(n => n.kind === 'subnet')) {
    const p = g.pos.get(s.id);
    if (!p) continue;
    abs.set(s.id, p);
    for (const filho of g.intra.get(s.id).filhos || []) {
      const meta = g.boxes.get(filho.id);
      abs.set(filho.id, { x: p.x + filho.x, y: p.y + filho.y, w: meta.caixaW || meta.formaW, h: meta.formaH });
    }
  }
  return abs;
}

/**
 * #31 — A CAIXA DA UNIÃO ABRAÇA A SUBNET INTEIRA DE CADA MEMBRO, NÃO SÓ O
 * ÍCONE DELE. A grade só sabe posicionar no grão da subnet (`g.pos`); ela não
 * tem outro jeito de dizer "onde está o membro" a não ser "onde está a subnet
 * que o contém". Então um Auto Scaling group com dois membros em AZs
 * diferentes é a UNIÃO de duas subnets inteiras — e qualquer outro serviço
 * que more numa dessas subnets (o caso frequente: um Lambda de antifraude do
 * lado do ECS que escala) está, por construção, dentro da caixa.
 *
 * Não existe conserto de roteamento aqui (ver o ticket): a caixa É a união, a
 * união É as subnets inteiras. O que dá para responder é SE isso aconteceria
 * — antes de desenhar a caixa — e degradar em vez de desenhar a mentira.
 */
function engoleNaoMembro(model, posGrade, f, x1, y1, x2, y2) {
  const members = new Set(f.members);
  for (const n of model.nodes) {
    if (!LEAVES.has(n.kind) || members.has(n.id)) continue;
    const cellBox = posGrade.get(n.id);
    if (!cellBox) continue;
    if (cellBox.x < x2 && cellBox.x + cellBox.w > x1 && cellBox.y < y2 && cellBox.y + cellBox.h > y1) return true;
  }
  return false;
}

function gridPlan(model, d, res, g, opts = {}) {
  const mo = frame(res);
  const p = paint(res);
  const f = folgas(res.tema);
  const layoutPlan = { id: model.id, name: model.title, celulas: [], background: p.background,
    tema: res.tema.id };
  cabecalho(layoutPlan, model, res);

  const cloud = model.nodes.find(n => n.kind === 'cloud');
  const larguraNuvem = g.larguraGrade + 4 * f.PAD;
  const cN = res.container(cloud || { id: 'cloud', kind: 'cloud' });
  const idNuvem = cloud ? cloud.id : 'aws-cloud';

  layoutPlan.celulas.push({
    kind: 'vertice', id: idNuvem, parent: '1',
    label: (cloud && cloud.label) || 'AWS Cloud', style: cN.style,
    geo: { x: mo.x, y: mo.topo, w: larguraNuvem, h: g.fim + f.PAD },
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
    const members = model.nodes.filter(n => n.az === z).map(n => g.pos.get(n.id)).filter(Boolean);
    if (!members.length) continue;
    const geo = g.raia
      ? {
          // a raia começa na borda da VPC mais à esquerda e transborda à
          // direita pelo `CROSS_OUT` — é o transbordo que faz o cruzamento SE
          // VER (#19, regra 3). O rótulo mora na tira reservada acima.
          x: esquerda - 8,
          y: Math.min(...members.map(m => m.y)) - (g.reservaDaRaia.get(z) || g.SWIMLANE_LANE),
          w: Math.max(...members.map(m => m.x + m.w)) + g.CROSS_OUT - (esquerda - 8),
          h: Math.max(...members.map(m => m.y + m.h)) + 10 -
             (Math.min(...members.map(m => m.y)) - (g.reservaDaRaia.get(z) || g.SWIMLANE_LANE)),
        }
      : {
          x: Math.min(...members.map(m => m.x)) - 14,
          y: topo - g.AZ_LANE,
          w: Math.max(...members.map(m => m.x + m.w)) + 14 - (Math.min(...members.map(m => m.x)) - 14),
          h: Math.max(...members.map(m => m.y + m.h)) + g.CROSS_OUT - (topo - g.AZ_LANE),
        };
    // O estilo do catálogo não traz `align`, então o rótulo sai centrado — que
    // é certo para uma coluna estreita e errado para uma raia larga, onde o
    // texto cai no meio do desenho, em cima do que estiver ali. Ancorar à
    // esquerda é do MOTOR pelo mesmo critério do halo das faixas de membro: a
    // paleta continua sendo do catálogo, a legibilidade é de quem posiciona.
    const style = res.faixaAz().style + (g.raia ? 'align=left;spacingLeft=10;' : '');
    layoutPlan.celulas.push({
      kind: 'vertice', id: `az-${z}`, parent: idNuvem,
      label: `Availability Zone · ${z}`, style, geo,
    });
  }

  // 2. a árvore de contenção real: VPC › subnet › conteúdo
  for (const [vid, box] of g.vpcBox) {
    const v = d.t.byId.get(vid);
    layoutPlan.celulas.push({
      kind: 'vertice', id: vid, parent: idNuvem, label: v.label || '', style: g.boxes.get(vid).style,
      geo: { x: box.x, y: box.y, w: box.w, h: box.h },
    });
    for (const s of model.nodes.filter(n => n.kind === 'subnet')) {
      const p = g.pos.get(s.id);
      if (!p || (d.t.ancestrais(s).find(a => a.kind === 'vpc') || {}).id !== vid) continue;
      layoutPlan.celulas.push({
        kind: 'vertice', id: s.id, parent: vid, label: s.label || '', style: g.boxes.get(s.id).style,
        geo: { x: p.x - box.x, y: p.y - box.y, w: p.w, h: p.h },
      });
      for (const filho of g.intra.get(s.id).filhos || []) {
        const meta = g.boxes.get(filho.id);
        layoutPlan.celulas.push({
          kind: 'vertice', id: filho.id, parent: s.id, label: meta.label, style: meta.style,
          geo: { x: filho.x, y: filho.y, w: meta.caixaW || meta.formaW, h: meta.formaH },
        });
      }
    }
  }

  // 3. faixas de membros por cima
  const posGrade = d.bands.length ? gridPositions(model, g) : null;
  for (const f of d.bands) {
    const cel = f.members
      .map(id => { const n = d.t.byId.get(id); return d.t.ancestrais(n).find(a => a.kind === 'subnet') || n; })
      .map(s => g.pos.get(s.id)).filter(Boolean);
    if (cel.length < 2) continue;
    const x1 = Math.min(...cel.map(m => m.x)) - 10, x2 = Math.max(...cel.map(m => m.x + m.w)) + 10;
    const lane = g.calhas.get(f.id) || g.BAND_LANE;
    const y1 = Math.min(...cel.map(m => m.y)) - lane, y2 = Math.max(...cel.map(m => m.y + m.h)) + 10;

    // #31 — a caixa varreria um não-membro: ela DEGRADA. Para de afirmar
    // contenção (não há caixa que abrace só os membros sem também abraçar
    // quem não é) e vira o mesmo recurso do rótulo de OU — texto solto, sem
    // forma —, ancorado no canto onde a caixa desenharia a borda. A calha já
    // estava reservada ali para o rótulo da própria caixa (`layout.cjs`), então
    // o texto solto não pede espaço novo a ninguém.
    if (engoleNaoMembro(model, posGrade, f, x1, y1, x2, y2)) {
      const text = f.label || '';
      layoutPlan.celulas.push({
        kind: 'vertice', id: `${f.id}-degradada`, parent: idNuvem, label: text,
        style: res.tema.faixaRotulo(),
        geo: { x: x1, y: y1, w: Math.max(40, res.textWidth(text) + 8), h: lane },
      });
      continue;
    }

    layoutPlan.celulas.push({
      kind: 'vertice', id: f.id, parent: idNuvem, label: f.label || '', style: res.band(f).style,
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
  arestasNaGrade(layoutPlan, model, d, res, g, opts);

  const widthOf = mo.x * 2 + larguraNuvem;
  const fim = rodape(layoutPlan, model, widthOf - 2 * mo.x, res, mo.topo + g.fim + f.PAD);
  layoutPlan.larg = widthOf;
  layoutPlan.alt = fim + mo.rodape;
  layoutPlan.celulas.push(celulaDoModelo(model, res));
  return layoutPlan;
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
function arestasNaGrade(layoutPlan, model, d, res, g, opts) {
  if (!d.edges.length) return;

  /**
   * ⚠️ `g.pos` É RELATIVO À NUVEM, e a célula de aresta é filha da CAMADA.
   *
   * As caixas da grade saem em coordenada da nuvem — é assim que a faixa de AZ
   * e a caixa de VPC são emitidas, com `pai: idNuvem`. A aresta não: ela vai
   * para `pai: '1'`, e ali o waypoint é página, não nuvem. Até o #24 a conta
   * não era feita, e o desvio saía deslocado (`mo.x`, `mo.topo`) das pontas que
   * o próprio motor tinha ancorado — o que transforma um traçado ortogonal por
   * construção numa DIAGONAL.
   *
   * Não era invisível: `A5.4` reportava "dobra de 44,4°, abaixo do piso de 60°"
   * e `A5.6` "há segmentos fora dos eixos num roteamento que se diz ortogonal".
   * Duas checagens apontando para o mesmo `+32,+76` que ninguém tinha somado.
   */
  const mo = frame(res);
  const daGradeParaPagina = paraPagina({ x: mo.x, y: mo.topo });

  const abs = gridPositions(model, g);

  const subnetDe = id => {
    const n = d.t.byId.get(id);
    if (!n) return null;
    const s = n.kind === 'subnet' ? n : d.t.ancestrais(n).find(a => a.kind === 'subnet');
    return s ? s.id : null;
  };
  const raiaDe = id => {
    const s = subnetDe(id);
    const n = s && d.t.byId.get(s);
    return n ? n.az : null;
  };

  /**
   * Os grupos que a perna do desvio NÃO pode atravessar: toda subnet que não é
   * a da origem nem a do destino. Sair de dentro da própria subnet e entrar na
   * do destino é o caminho; passar por dentro de uma terceira é `A5.5` — o
   * desenho afirmando um caminho de rede que o modelo nega.
   */
  const subnets = model.nodes.filter(n => n.kind === 'subnet').map(n => n.id);
  const barriers = a => {
    const minhas = new Set([subnetDe(a.from), subnetDe(a.to)]);
    return subnets.filter(id => !minhas.has(id)).map(id => abs.get(id)).filter(Boolean);
  };

  for (const a of d.edges) {
    const o = abs.get(a.from), dst = abs.get(a.to);
    if (!o || !dst) continue;
    const mesma = raiaDe(a.from) && raiaDe(a.from) === raiaDe(a.to);
    const adiante = g.raia ? dst.x >= o.x : dst.y >= o.y;

    let anc, pontos = [];
    if (g.raia) {
      const y0 = o.y + o.h / 2, y1 = dst.y + dst.h / 2;
      anc = { output: { x: adiante ? 1 : 0, y: 0.5 }, input: { x: adiante ? 0 : 1, y: 0.5 } };
      if (!mesma) {
        // desvia pela margem mais próxima da ORIGEM (#21) — mas por um VÃO, e
        // não pelo ponto médio entre os ícones. Ver `corredorLivre`.
        const perto = adiante ? (o.x + o.w + dst.x) / 2 : (dst.x + dst.w + o.x) / 2;
        const onde = dispor.corredorLivre([y0, y1], barriers(a).map(caixaEmX), perto);
        pontos = [{ x: onde, y: y0 }, { x: onde, y: y1 }];
      }
    } else {
      const x0 = o.x + o.w / 2, x1 = dst.x + dst.w / 2;
      anc = { output: { x: 0.5, y: adiante ? 1 : 0 }, input: { x: 0.5, y: adiante ? 0 : 1 } };
      if (!mesma) {
        const perto = adiante ? (o.y + o.h + dst.y) / 2 : (dst.y + dst.h + o.y) / 2;
        const onde = dispor.corredorLivre([x0, x1], barriers(a).map(caixaEmY), perto);
        pontos = [{ x: x0, y: onde }, { x: x1, y: onde }];
      }
    }

    layoutPlan.celulas.push({
      kind: 'edge', id: a.id, parent: '1', from: a.from, to: a.to,
      label: rotuloDaAresta(a), style: estiloAresta(a, anc, res.tema),
      pontos: pontos.map(daGradeParaPagina),
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
const S_OU = res => res.tema.ou();
/** O barramento do `E4`: uma linha paralela à fileira, deslocada para FORA dela. */
const S_BUS = res => res.tema.bus();
const S_STUB = res => res.tema.stub();

/**
 * `E9` — habilitador de permissão é NÓ ANEXADO, com seta curta apontando para
 * CIMA, para dentro do componente que ele autoriza. Nunca rótulo de aresta.
 * Confirmado em dois padrões oficiais independentes (bucket policy do Flow
 * Logs; Role do EventBridge cross-account).
 */
const S_ENABLES = res => res.tema.habilitador();

function accountPlan(model, d, res, g, opts = {}) {
  const mo = frame(res);
  const p = paint(res);
  const f = folgas(res.tema);
  const layoutPlan = { id: model.id, name: model.title, celulas: [], background: p.background,
    tema: res.tema.id };
  cabecalho(layoutPlan, model, res);

  const abs = new Map();          // id -> caixa absoluta, para arestas e faixas
  const cloud = model.nodes.find(n => n.kind === 'cloud');

  // nós que não moram em conta nenhuma (o ator, tipicamente) ficam FORA da
  // nuvem e à esquerda — `O19` do #5: o usuário entra pela esquerda
  //
  // A PILHA É ORDENADA PELO CONTEÚDO, não pela posição em `modelo.nos` — a
  // mesma régua P1 do #11/#21 que ordena contas e raias. Com um forasteiro só
  // isso não se via; com dois (#32 trouxe o segundo caso real do corpus),
  // reordenar `nos` no arquivo trocava qual deles ficava em cima, e a
  // suíte de determinismo (#23) provou.
  const outsiders = model.nodes.filter(n =>
    n.inside === undefined && n.kind !== 'cloud' && n.kind !== 'account' && !d.t.filhos.get(n.id).length)
    .sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id), 'pt'));
  let margemEsq = 0;
  for (const f of outsiders) margemEsq = Math.max(margemEsq, res.leaf(f).formaW + 60);

  // A canaleta de cima tem de ser RESERVADA antes de posicionar, não descoberta
  // depois: ela empurra a fileira inteira para baixo. Quantas faixas ela precisa
  // é contável sem geometria nenhuma — é quantas arestas de fora chegam numa
  // conta que não é a primeira da fileira.
  const idxDaConta = new Map(g.order.map((c, i) => [c.id, i]));
  const contaDoNoId = id => {
    const n = d.t.byId.get(id);
    if (!n) return null;
    const c = n.kind === 'account' ? n : d.t.ancestrais(n).find(a => a.kind === 'account');
    return c ? c.id : null;
  };
  const deForaDesviadas = d.edges.filter(a => {
    const ca = contaDoNoId(a.from), cb = contaDoNoId(a.to);
    if (ca && cb) return false;
    const target = cb || ca;
    return target !== null && idxDaConta.get(target) > 0;
  }).length;
  const reservaTopo = deForaDesviadas ? 26 + deForaDesviadas * 30 : 0;

  /**
   * e a de baixo pela mesma conta — mas ela depende do MECANISMO, não só da
   * contagem. Reservar só para o nível 6 deixava o barramento (`E4`) desenhado
   * fora da caixa `AWS Cloud`: ele nasce abaixo da fileira e ninguém tinha
   * pedido a altura. Era bug latente porque nenhum modelo o exercitava — os
   * modelos `hub-tgw` e `logs-centralizados` existem para que não seja mais.
   */
  const desviadas = d.policy.mecanismo === 'direta'
    ? d.travessias.filter(t => idxDaConta.get(t.contaPara) !== idxDaConta.get(t.contaDe) + 1).length
    : 0;
  const reservaFundo =
    d.policy.mecanismo === 'bus' ? 46 + 34
    : desviadas ? 40 + desviadas * 34
    : 0;
  /**
   * a agregada entra pela ESQUERDA do destino, então ela cobra margem lateral —
   * e a margem tem de caber o RÓTULO, não um número redondo. É o rótulo que faz
   * o trabalho no `E3` ("o texto substitui a cardinalidade"): encolher a corrida
   * até ele transbordar por cima do ícone de destino desfaz o mecanismo.
   */
  const aggregatedText = d.policy.mecanismo === 'agregada'
    ? (d.policy.grupos || []).map(group => {
        const ex = d.travessias.find(t => t.to === group.to);
        return `${ex && ex.label ? ex.label : 'from'} · ${group.accounts.length} contas`;
      })
    : [];
  const reservaEsq = aggregatedText.length
    ? Math.max(110, ...aggregatedText.map(t => res.textWidth(t) + 60))
    : 0;

  const baseX = mo.x + margemEsq + reservaEsq;
  // A ordem importa: o título da nuvem primeiro, a canaleta DEPOIS dele. No
  // render anterior a reserva entrou antes e a canaleta de cima caiu em cima da
  // faixa de título da nuvem.
  const baseY = mo.topo + (cloud ? 34 + f.PAD : 0) + reservaTopo;

  // 1. a nuvem, se declarada, envolve a grade inteira
  // a nuvem tem de CONTER as duas canaletas: uma ligação entre contas AWS
  // desenhada fora da caixa "AWS Cloud" é uma mentira pequena, mas é mentira
  const alturaNuvem = 34 + f.PAD + reservaTopo + g.altura + reservaFundo + f.PAD;
  const idNuvem = cloud ? cloud.id : null;
  if (cloud) {
    const c = res.container(cloud);
    layoutPlan.celulas.push({
      kind: 'vertice', id: cloud.id, parent: '1', label: cloud.label || 'AWS Cloud', style: c.style,
      geo: { x: baseX - f.PAD - reservaEsq, y: mo.topo, w: g.widthOf + 2 * f.PAD + reservaEsq, h: alturaNuvem },
    });
    abs.set(cloud.id, { x: baseX - f.PAD - reservaEsq, y: mo.topo, w: g.widthOf + 2 * f.PAD + reservaEsq, h: alturaNuvem });
  }

  // 2. os forasteiros, à esquerda da nuvem, centrados na vertical
  for (const [i, f] of outsiders.entries()) {
    const m = res.leaf(f);
    const a = { x: mo.x, y: mo.topo + g.altura / 2 - m.formaH / 2 + i * (m.formaH + 40), w: m.formaW, h: m.formaH };
    abs.set(f.id, a);
    layoutPlan.celulas.push({
      kind: 'vertice', id: f.id, parent: '1', label: m.label, style: m.style,
      geo: { x: a.x, y: a.y, w: a.w, h: a.h },
    });
  }

  // 3. rótulos de OU — ANTES das contas, porque a ordem do documento é a ordem z
  //
  // A segunda cláusula não é defesa contra `col.ou` vazio — em integração ele
  // já é sempre `null` (`porContas` ordena a fileira para MINIMIZAR CRUZAMENTO
  // de travessia, #12, não para agrupar por OU, e a mesma OU pode terminar
  // espalhada em posições não-contíguas). A cláusula está aqui para NOMEAR a
  // decisão: a faixa de OU é dimensão de CONTRASTE entre colunas (S3), e a
  // vista de integração não tem coluna por OU — tem uma fileira só, ordenada
  // pela travessia, que é o assunto dela. `generate.cjs` sabe da mesma regra e
  // ajusta o aviso para não anunciar uma faixa que este bloco não emite.
  if (d.ou.draw && g.modo !== 'integracao') {
    for (const col of g.colunas) {
      if (!col.ou) continue;
      const band = d.faixasOu.find(f => f.members.includes(col.accounts[0]));
      layoutPlan.celulas.push({
        kind: 'vertice', id: band ? band.id : `ou-${col.ou}`, parent: idNuvem || '1',
        label: `OU – ${col.ou}`, style: S_OU(res),
        geo: {
          x: (idNuvem ? f.PAD : baseX) + col.x, y: (idNuvem ? f.PAD + 34 : baseY) + 8,
          w: Math.max(140, res.textWidth(`OU – ${col.ou}`) + 16), h: 24,
        },
      });
    }
  }

  // 4. as contas e tudo dentro delas
  for (const account of g.order) {
    const p = g.pos.get(account.id);
    const ax = baseX + p.x, ay = baseY + p.y;
    abs.set(account.id, { x: ax, y: ay, w: p.w, h: p.h });
    const meta = g.boxes.get(account.id);

    // `X6`: a conta que é hub ganha ênfase de borda. Hub = a que mais participa
    // de travessia — e só vale a pena marcar se ela de fato se destaca.
    const style = meta.style + (account.id === g.hub ? 'strokeWidth=2.6;fontStyle=1;' : '');
    layoutPlan.celulas.push({
      kind: 'vertice', id: account.id, parent: idNuvem || '1', label: account.label || '', style,
      geo: { x: ax - (idNuvem ? abs.get(idNuvem).x : 0), y: ay - (idNuvem ? abs.get(idNuvem).y : 0), w: p.w, h: p.h },
    });

    (function tier(no, paiId, paiAbs) {
      for (const c of no.children || []) {
        const m = g.boxes.get(c.id);
        const noModelo = d.t.byId.get(c.id);
        const a = { x: paiAbs.x + c.x, y: paiAbs.y + c.y, w: c.width, h: c.height };
        abs.set(c.id, a);
        layoutPlan.celulas.push({
          kind: 'vertice', id: c.id, parent: paiId,
          label: m.container ? (noModelo.label || '') : m.label,
          style: m.style,
          geo: { x: c.x, y: c.y, w: c.width, h: c.height },
        });
        if (c.children && c.children.length) tier(c, c.id, a);
      }
    })(g.interno.get(account.id), account.id, { x: ax, y: ay });

    // arestas INTERNAS da conta, convertidas para o espaço absoluto (#2 §5.2:
    // um sistema de coordenadas só)
    for (const e of g.interno.get(account.id).edges || []) {
      const a = d.edges.find(x => x.id === e.id);
      const sec = (e.sections || [])[0];
      if (!a || !sec) continue;
      const desl = paraPagina({ x: ax, y: ay });
      const anc = {
        output: ancora(abs.get(a.from), desl(sec.startPoint)),
        input: ancora(abs.get(a.to), desl(sec.endPoint)),
      };
      layoutPlan.celulas.push({
        kind: 'edge', id: e.id, parent: '1', from: a.from, to: a.to,
        label: rotuloDaAresta(a), style: estiloAresta(a, anc, res.tema),
        pontos: (sec.bendPoints || []).map(desl),
      });
    }
  }

  // 5. a travessia, pelo mecanismo que a política escolheu — e o que entra de fora
  g.reservaEsq = reservaEsq;
  travessiasNoPlano(layoutPlan, model, d, res, g, abs, opts);
  arestasDeFora(layoutPlan, d, res, g, abs, opts);

  // 6. habilitadores de permissão (E9): seta curta para dentro de quem autorizam
  for (const h of d.habilitadores) {
    if (!abs.has(h.id) || !abs.has(h.target)) continue;
    layoutPlan.celulas.push({
      kind: 'edge', id: `hab-${h.id}`, parent: '1', from: h.id, to: h.target,
      label: '', style: S_ENABLES(res), pontos: [],
    });
  }

  // 7. notas presas a um nó
  notasPresas(layoutPlan, model, abs, p);

  const background = mo.topo + (cloud ? alturaNuvem : g.altura + reservaFundo) + f.PAD;
  const widthOf = Math.max(baseX + g.widthOf + mo.x, 900);
  const fim = rodape(layoutPlan, model, widthOf - 2 * mo.x, res, background);
  layoutPlan.larg = widthOf;
  layoutPlan.alt = fim + mo.rodape;
  layoutPlan.celulas.push(celulaDoModelo(model, res));
  return layoutPlan;
}

/**
 * A PARENTELA DE UM NÓ: ele, seus ancestrais e seus descendentes.
 *
 * É o conjunto que NUNCA conta como obstáculo para uma aresta que sai dele.
 * Atravessar a própria VPC para sair dela não é atravessar fronteira alheia —
 * é o único jeito de sair —, e `A5.5` diz isso na definição: espúria é a
 * fronteira de que a aresta não sai nem para onde vai.
 *
 * Estava escrita três vezes com nomes diferentes até o #24 juntar. A terceira
 * cópia (a de `arestasDeFora`) excluía SÓ as duas pontas, e por isso teria
 * empurrado para fora da nuvem uma aresta cujo destino mora dentro dela.
 */
function parentela(d, ids) {
  const meu = new Set();
  for (const id of ids) {
    const no = d.t.byId.get(id);
    if (!no) continue;
    meu.add(id);
    for (const a of d.t.ancestrais(no)) meu.add(a.id);
    (function desc(x) { for (const k of d.t.filhos.get(x)) { meu.add(k.id); desc(k.id); } })(id);
  }
  return meu;
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
  const meu = parentela(d, [idNo]);

  const cruza = (x1, x2) => {
    for (const [id, b] of abs) {
      if (meu.has(id) || id === contaAbs.id) continue;
      const dentroDaConta = b.x >= contaAbs.x - 1 && b.x + b.w <= contaAbs.x + contaAbs.w + 1;
      if (!dentroDaConta) continue;
      const band = b.y < no.y + no.h && b.y + b.h > no.y;         // sobrepõe a faixa do nó
      if (band && b.x < x2 && b.x + b.w > x1) return true;
    }
    return false;
  };

  const esquerdaLimpa = !cruza(contaAbs.x, no.x);
  const direitaLimpa = !cruza(no.x + no.w, contaAbs.x + contaAbs.w);
  const prefereEsquerda = alvoAbs && alvoAbs.x + alvoAbs.w / 2 < no.x;

  if (prefereEsquerda && esquerdaLimpa) return { lado: 'esquerda', limpo: true };
  if (!prefereEsquerda && direitaLimpa) return { lado: 'direita', limpo: true };
  if (esquerdaLimpa) return { lado: 'esquerda', limpo: true };
  if (direitaLimpa) return { lado: 'direita', limpo: true };
  /**
   * NENHUM LADO LIMPO — e até o #24 isto voltava calado.
   *
   * A versão anterior devolvia "o mal menor é o curto" e seguia, então a
   * travessia saía cortando um irmão sem que nada no motor soubesse. Foi assim
   * que `a-confia` (Lambda → papel cross-account) saiu por dentro do VPC
   * endpoint: os dois lados estavam ocupados, o roteador escolheu o esquerdo, e
   * `A3.5` cobrou. Agora ele DIZ que sujou, e quem chama tem a chance de sair
   * pelo outro eixo — que é o que a canaleta do `X3` sempre soube fazer.
   */
  return { lado: prefereEsquerda ? 'esquerda' : 'direita', limpo: false };
}

/**
 * A perna VERTICAL de saída: do nó até a canaleta, sem furar irmão.
 *
 * É a alternativa quando `ladoLivre` volta sujo dos dois lados. O #12 escreveu
 * que "sair pela vertical era o caminho curto e era o errado" — e estava certo
 * como REGRA, não como lei: descer é errado quando há irmão embaixo, e é o
 * único caminho limpo quando os dois lados estão ocupados e o vão de baixo não
 * está. Quem decide é a medida, não a preferência.
 */
function verticalLimpa(no, y, abs, d, idNo) {
  const meu = parentela(d, [idNo]);
  const lo = Math.min(y, no.y + no.h / 2), hi = Math.max(y, no.y + no.h / 2);
  const cx = no.x + no.w / 2;
  for (const [id, b] of abs) {
    if (meu.has(id)) continue;
    if (b.x < cx && b.x + b.w > cx && b.y < hi && b.y + b.h > lo) return false;
  }
  return true;
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
function travessiasNoPlano(layoutPlan, model, d, res, g, abs, opts) {
  const pol = d.policy;
  if (pol.mecanismo === 'suprimir') return;

  const cellBox = id => abs.get(id);
  const contaDoNo = id => {
    const n = d.t.byId.get(id);
    const c = n && (n.kind === 'account' ? n : d.t.ancestrais(n).find(a => a.kind === 'account'));
    return c ? c.id : null;
  };

  if (pol.mecanismo === 'bus') {
    // `E4` + `X3`: UMA linha paralela à fileira, deslocada para fora dela, com
    // stubs perpendiculares curtos entrando em cada conta. 1 linha + N stubs,
    // nunca N linhas — é literalmente o desenho do AMS MALZ.
    const y = Math.max(...g.order.map(c => cellBox(c.id).y + cellBox(c.id).h)) + 46;
    for (const group of pol.grupos) {
      const alvos = group.accounts.map(id => cellBox(id)).filter(Boolean);
      if (alvos.length < 2) continue;
      const x1 = Math.min(...alvos.map(a => a.x + a.w / 2));
      const x2 = Math.max(...alvos.map(a => a.x + a.w / 2));
      const origin = cellBox(group.from);
      layoutPlan.celulas.push({
        kind: 'edge', id: `bus-${group.from}`, parent: '1', from: null, to: null,
        label: '', style: S_BUS(res),
        pontos: [{ x: x1, y }, { x: x2, y }],
        solta: { x1, y1: y, x2, y2: y },
      });
      // o stub que desce da origem até o barramento
      if (origin)
        layoutPlan.celulas.push({
          kind: 'edge', id: `bus-tronco-${group.from}`, parent: '1', from: group.from, to: null,
          label: '', style: S_BUS(res),
          pontos: [{ x: origin.x + origin.w / 2, y: origin.y + origin.h },
                   { x: origin.x + origin.w / 2, y }],
          solta: { x1: origin.x + origin.w / 2, y1: origin.y + origin.h, x2: origin.x + origin.w / 2, y2: y },
        });
      for (const id of group.accounts) {
        const a = cellBox(id);
        const cx = a.x + a.w / 2;
        const travessia = d.travessias.find(t => t.from === group.from && t.contaPara === id);
        layoutPlan.celulas.push({
          kind: 'edge', id: `stub-${id}`, parent: '1', from: null, to: id,
          label: travessia ? rotuloDaAresta(travessia) : '', style: S_STUB(res),
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
    for (const group of pol.grupos) {
      const target = cellBox(group.to);
      if (!target) continue;
      const contaAlvo = contaDoNo(group.to);
      const cAlvo = cellBox(contaAlvo);
      const exemplo = d.travessias.find(t => t.to === group.to);
      const text = `${exemplo && exemplo.label ? exemplo.label : 'from'} · ${group.accounts.length} contas`;
      const x0 = (cAlvo ? cAlvo.x : target.x) - (g.reservaEsq || 90);
      layoutPlan.celulas.push({
        kind: 'edge', id: `fanin-${group.to}`, parent: '1', from: null, to: group.to,
        label: text, style: S_STUB(res),
        pontos: [{ x: x0, y: target.y + target.h / 2 }],
        solta: { x1: x0, y1: target.y + target.h / 2, x2: target.x, y2: target.y + target.h / 2 },
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
  const ordemIdx = new Map(g.order.map((c, i) => [c.id, i]));
  const rowBackground = Math.max(...g.order.map(c => cellBox(c.id).y + cellBox(c.id).h));
  let faixaCanaleta = 0;

  for (const t of d.travessias) {
    const o = cellBox(t.from), dst = cellBox(t.to);
    if (!o || !dst) continue;
    const ia = ordemIdx.get(t.contaDe), ib = ordemIdx.get(t.contaPara);
    const adjacenteAdiante = ib === ia + 1;

    if (adjacenteAdiante) {
      const cA = cellBox(t.contaDe), cB = cellBox(t.contaPara);
      const calhaX = (cA.x + cA.w + cB.x) / 2;
      const y0 = o.y + o.h / 2, y1 = dst.y + dst.h / 2;
      layoutPlan.celulas.push({
        kind: 'edge', id: t.id, parent: '1', from: t.from, to: t.to,
        label: rotuloDaAresta(t),
        style: estiloAresta(t, { output: { x: 1, y: 0.5 }, input: { x: 0, y: 0.5 } }, res.tema),
        pontos: y0 === y1 ? [] : [{ x: calhaX, y: y0 }, { x: calhaX, y: y1 }],
      });
      continue;
    }

    // Canaleta por fora (`X3`): sai do nó pela HORIZONTAL, pelo lado limpo, até
    // a calha entre as contas; desce a calha; corre por baixo da fileira; sobe
    // a outra calha; entra na horizontal. Sair pela vertical era o caminho
    // curto e era o errado — a linha descia por dentro das caixas irmãs.
    faixaCanaleta += 1;
    const yCanal = rowBackground + 40 + (faixaCanaleta - 1) * 34;
    const cA = { ...cellBox(t.contaDe), id: t.contaDe };
    const cB = { ...cellBox(t.contaPara), id: t.contaPara };
    const ladoO = ladoLivre(o, dst, cA, abs, d, t.from);
    const ladoD = ladoLivre(dst, o, cB, abs, d, t.to);
    // quando os dois lados estão sujos, descer direto para a canaleta é o
    // caminho limpo — ver `verticalLimpa`
    const desceO = !ladoO.limpo && verticalLimpa(o, yCanal, abs, d, t.from);
    const desceD = !ladoD.limpo && verticalLimpa(dst, yCanal, abs, d, t.to);
    const xo = desceO ? o.x + o.w / 2
      : ladoO.lado === 'esquerda' ? cA.x - g.LANE / 2 : cA.x + cA.w + g.LANE / 2;
    const xd = desceD ? dst.x + dst.w / 2
      : ladoD.lado === 'esquerda' ? cB.x - g.LANE / 2 : cB.x + cB.w + g.LANE / 2;
    const yo = desceO ? (o.y + o.h) : o.y + o.h / 2;
    const yd = desceD ? (dst.y + dst.h) : dst.y + dst.h / 2;
    /**
     * QUANDO AS DUAS PONTAS ESCOLHEM A MESMA CALHA, A CANALETA NÃO EXISTE.
     *
     * Entre duas contas vizinhas com `CALHA` de largura, sair pela direita de
     * uma e pela esquerda da outra dá exatamente o mesmo `x` — e a rota
     * `desce até a canaleta, anda zero, sobe de volta` desenha um pedaço de
     * linha para baixo e o REDESENHA para cima por cima de si mesmo. No render
     * do #24 isso apareceu como um toco pendurado abaixo do "8. varre o
     * prefixo curado", com o rótulo boiando no meio dele: o rótulo vai no meio
     * da polilinha, e metade da polilinha não levava a lugar nenhum.
     *
     * Nenhuma checagem pegava — a linha não cruza nada, não sobrepõe nada, e
     * mede certo em todas as 62. Foi o OLHO. É a metade do #17 que a suíte não
     * substitui, e o motivo de o #14 ter reprovado numa inspeção humana com a
     * suíte verde.
     */
    const mesmaCalha = Math.abs(xo - xd) < 0.5 && !desceO && !desceD;
    layoutPlan.celulas.push({
      kind: 'edge', id: t.id, parent: '1', from: t.from, to: t.to,
      label: rotuloDaAresta(t),
      style: estiloAresta(t, {
        output: desceO ? { x: 0.5, y: 1 } : { x: ladoO.lado === 'esquerda' ? 0 : 1, y: 0.5 },
        input: desceD ? { x: 0.5, y: 1 } : { x: ladoD.lado === 'esquerda' ? 0 : 1, y: 0.5 },
      }, res.tema),
      pontos: mesmaCalha
        ? [{ x: xo, y: yo }, { x: xo, y: yd }]
        : [{ x: xo, y: yo }, { x: xo, y: yCanal }, { x: xd, y: yCanal }, { x: xd, y: yd }],
    });
    if (mesmaCalha) faixaCanaleta -= 1;   // a faixa reservada não foi usada
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
function arestasDeFora(layoutPlan, d, res, g, abs, opts) {
  const contaDoNo = id => {
    const n = d.t.byId.get(id);
    if (!n) return null;
    const c = n.kind === 'account' ? n : d.t.ancestrais(n).find(a => a.kind === 'account');
    return c ? c.id : null;
  };
  const ordemIdx = new Map(g.order.map((c, i) => [c.id, i]));
  const rowTop = Math.min(...g.order.map(c => abs.get(c.id).y));
  let faixaTopo = 0;

  for (const a of d.edges) {
    const ca = contaDoNo(a.from), cb = contaDoNo(a.to);
    if (ca && cb) continue;            // intra-conta ou travessia: já desenhadas
    const o = abs.get(a.from), dst = abs.get(a.to);
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
      layoutPlan.celulas.push({
        kind: 'edge', id: a.id, parent: '1', from: a.from, to: a.to,
        label: rotuloDaAresta(a),
        style: estiloAresta(a, { output: { x: 1, y: 0.5 }, input: { x: 0, y: 0.5 } }, res.tema),
        pontos: y0 === y1 ? [] : [{ x: meio, y: y0 }, { x: meio, y: y1 }],
      });
      continue;
    }

    // canaleta por CIMA — a simétrica da de baixo. A de baixo carrega travessia
    // entre contas; esta carrega o que entra de fora e teria de furar conta
    // alheia para chegar. Duas faixas, uma de cada lado da fileira, e nenhuma
    // linha dentro de caixa que não é dela.
    faixaTopo += 1;
    const yCanal = rowTop - 26 - (faixaTopo - 1) * 30;

    // as barras que NENHUMA perna deste desvio pode atravessar — todo nó que
    // não é ancestral nem descendente das duas pontas da própria aresta.
    // Movida para antes da descida (#32): a descida perto do forasteiro
    // precisa da mesma varredura que já servia só a subida.
    const meu = parentela(d, [a.from, a.to]);
    const barras = [...abs].filter(([id]) => !meu.has(id)).map(([, b]) => caixaEmX(b));

    /**
     * A REFERÊNCIA DA DESCIDA é a de QUEM `dst` REALMENTE É — não sempre
     * `alvoConta` (#32).
     *
     * Quando é a conta que entra em cena por fora (`cliente → ALB` numa conta
     * que não é a primeira), `dst` mora dentro de `alvoConta`, e as duas
     * coincidem: descer rente à borda da conta pousa rente ao próprio `dst`,
     * e `ladoLivre` mede uma banda real — a de `alvoConta` — em busca de um
     * irmão que não é de `dst`.
     *
     * Mas quando é o ATOR que está do lado de `dst` (uma conta do meio manda
     * para fora, #32), `alvoConta` é a conta de ORIGEM — `dst` não mora nela,
     * e ancorar ali mede uma fronteira que não é a dele: a descida para bem
     * perto da conta de origem e o resto da linha, invisível para este
     * código, atravessa quem estiver entre ela e o ator. E `ladoLivre` não
     * serve aqui nem chamado sobre a caixa do próprio `dst`: sem uma SEGUNDA
     * caixa para comparar, a banda que ele mede colapsa a um ponto e a busca
     * vira fachada. O forasteiro fica sempre à esquerda de toda a fileira
     * (#5 O19) — a preferência é o meio do vão até a primeira conta, mas
     * VARRIDA por `corredorLivre` contra as mesmas barras da subida, não
     * tomada de bandeja: é a mesma alavanca do #24, só do outro lado da
     * canaleta.
     */
    const dstIsOutsider = !cb;
    let xd, entraPelaDireita;
    if (dstIsOutsider) {
      const firstAccount = abs.get(g.order[0].id);
      const prefDst = (dst.x + dst.w + firstAccount.x) / 2;
      xd = dispor.corredorLivre([yCanal, y1], barras, prefDst, g.LANE / 2);
      entraPelaDireita = xd >= dst.x + dst.w / 2;
    } else {
      const cB = { ...abs.get(alvoConta), id: alvoConta };
      const ladoD = ladoLivre(dst, o, cB, abs, d, a.to);
      xd = ladoD.lado === 'esquerda' ? cB.x - g.LANE / 2 : cB.x + cB.w + g.LANE / 2;
      entraPelaDireita = ladoD.lado !== 'esquerda';
    }

    /**
     * A SUBIDA SAI PELO LADO, E POR UM VÃO — duas coisas, e as duas medidas.
     *
     * A versão anterior subia do CENTRO do nó direto para a canaleta de cima. O
     * centro do nó é justamente onde mora o vizinho quando os atores estão
     * empilhados: na vista técnica do #14 a "Diretoria" subia por dentro das
     * "Lojas (300)", `A3.5` e `A3.4` de uma vez. Sair pelo lado é a mesma
     * inversão que o #12 já tinha feito na canaleta de baixo, e é ela que paga
     * as duas checagens.
     *
     * O `corredorLivre` é a segunda metade, e vale dizer o que ele mede AQUI para
     * ninguém confundi-lo com o conserto: a preferência é a própria borda do nó,
     * e no corpus de hoje ela nunca está bloqueada — **ele devolve a preferência
     * intacta em todas as chamadas deste caminho, e quem pagou `A3.5`/`A3.4` foi
     * a saída pelo lado.** Ele fica porque a preferência PODE estar bloqueada:
     * dois atores lado a lado na mesma faixa põem um deles em cima da perna do
     * outro, e aí o vão é procurado de verdade. Guarda, não fachada — e medir a
     * diferença entre as duas coisas é o que evita um comentário que promete
     * mais do que o código faz.
     *
     * Tentar a preferência a uma calha de distância da borda foi medido e é
     * PIOR: empurra a perna para `x=140` e ela passa a cruzar a aresta que entra
     * na primeira conta — `A5.1` sobe de 1 para 2. Rente à borda não atravessa
     * ninguém, e é o que a rubrica prefere.
     */
    const direita = xd >= o.x + o.w / 2;
    const xSobe = dispor.corredorLivre([yCanal, y0], barras, direita ? o.x + o.w : o.x, g.LANE / 2);
    // o lado de saída sai do corredor ESCOLHIDO, não do desejado: se o vão livre
    // ficou do outro lado, sair pelo lado desejado faria a perna voltar por
    // dentro do próprio nó
    const saiPelaDireita = xSobe >= o.x + o.w / 2;
    const xOutput = saiPelaDireita ? o.x + o.w : o.x;

    layoutPlan.celulas.push({
      kind: 'edge', id: a.id, parent: '1', from: a.from, to: a.to,
      label: rotuloDaAresta(a),
      style: estiloAresta(a, {
        output: { x: saiPelaDireita ? 1 : 0, y: 0.5 },
        input: { x: entraPelaDireita ? 1 : 0, y: 0.5 },
      }, res.tema),
      // a dobra em `y0` só existe quando o corredor SAIU de cima da borda: sem
      // isso ela coincide com a ponta e vira um segmento de comprimento zero,
      // que conta como dobra em `A5.3` e não desenha nada
      pontos: [
        ...(Math.abs(xSobe - xOutput) < 0.5 ? [] : [{ x: xSobe, y: y0 }]),
        { x: xSobe, y: yCanal }, { x: xd, y: yCanal }, { x: xd, y: y1 },
      ],
    });
  }
  if (faixaTopo) g.canaletaTopo = 26 + faixaTopo * 30;
}

module.exports = { elkPlan, gridPlan, accountPlan, paint, frame };
