// #21 · Motor de protótipo — layout, roteamento, emissão e medição.
// Descartável. O ponto é que TUDO aqui é parametrizado por `axis`: a mesma
// função desenha o fluxo na horizontal ou na vertical. Se a decisão de eixo
// custasse um motor novo, este arquivo não existiria.
'use strict';
const path = require('path');

const CAT_DIR = '/home/paninit/workspaces/panlabs-skills/.claude/worktrees/catalogo-shapes-aws/skills/panlabs-aws-diagrams/catalog';
const cat = require(path.join(CAT_DIR, 'aws-shapes.cjs')).carregar();

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- constantes
// A célula é a MESMA nas duas orientações — texto é sempre horizontal, então
// uma caixa de subnet não transpõe. O que transpõe é o mapeamento (etapa,zona) → (x,y).
const K = {
  CELL_W: 208, CELL_H: 124,
  GAP_FLOW: 62,    // vão entre etapas — é aqui que a aresta faz a curva
  GAP_ZONE: 26,    // vão entre zonas
  HEAD: 34,        // faixa de título de container é área do filho (#2)
  PAD: 16,
  ZONE_LANE: 26,   // calha do rótulo da faixa de AZ            (#19, regra 1)
  BAND_LANE: 24,   // calha do rótulo de uma banda de membros   (#19, regra 2)
  CROSS_OUT: 14,   // transbordo da faixa sobre o que ela cruza (#19, regra 3)
  ICON: 48,        // A9
  CALLOUT: 26,     // A12
};

// --------------------------------------------------------------------- estilo
const GRP = 'points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;';

const S = {
  cloud: GRP + 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;fontStyle=1;fontSize=13;',
  vpc:   GRP + 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#8C4FFF;dashed=0;fontStyle=1;fontSize=13;',
  // AZ sai do upstream SEM container=1 e com cor pré-2022 — o catálogo do #17 corrige as duas
  az:    GRP + 'fillColor=none;dashed=1;dashPattern=8 6;strokeColor=#00A4A6;fontColor=#00A4A6;fontSize=12;',
  asg:   GRP + 'fillColor=none;dashed=1;dashPattern=8 6;strokeColor=#ED7100;fontColor=#ED7100;fontSize=11;',
  priv:  GRP + 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#00A4A6;fillColor=#E6F6F7;verticalAlign=top;align=left;spacingLeft=30;fontColor=#00A4A6;dashed=0;fontSize=11;',
  pub:   GRP + 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#7AA116;fillColor=#F2F6E8;verticalAlign=top;align=left;spacingLeft=30;fontColor=#7AA116;dashed=0;fontSize=11;',
  title: 'text;html=1;fontSize=19;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;',
  sub:   'text;html=1;fontSize=12;fontColor=#5A6C86;align=left;verticalAlign=middle;',
  note:  'rounded=0;whiteSpace=wrap;html=1;fillColor=#F4F6F8;strokeColor=#AAB7B8;fontColor=#232F3E;fontSize=11;align=left;verticalAlign=top;spacing=8;',
  // A11: seta 1.25 pt, cor tx1, sólida. O6: conector preto fino.
  edge:  'edgeStyle=none;html=1;rounded=1;arcSize=6;strokeColor=#232F3E;strokeWidth=1.5;endArrow=blockThin;endFill=1;endSize=6;jumpStyle=arc;jumpSize=10;',
  edgeDash: 'edgeStyle=none;html=1;rounded=0;strokeColor=#5A6C86;strokeWidth=1.5;dashed=1;dashPattern=6 4;endArrow=blockThin;endFill=1;startArrow=blockThin;startFill=1;endSize=6;',
  callout: 'ellipse;whiteSpace=wrap;html=1;fillColor=#232F3E;strokeColor=none;fontColor=#FFFFFF;fontSize=13;fontStyle=1;verticalAlign=middle;align=center;',
  tag: 'text;html=1;fontSize=10;fontColor=#5A6C86;align=center;verticalAlign=middle;labelBackgroundColor=#FFFFFF;',
};

function iconStyle(servico) {
  const r = cat.servico(servico);
  if (!r) throw new Error('serviço desconhecido no catálogo: ' + servico);
  return r.style + 'fontSize=11;';
}

// --------------------------------------------------------------------- layout
/**
 * Mapeia (etapa, zona) → retângulo absoluto.
 *
 *   axis 'H' → o FLUXO fica com a horizontal; as zonas viram LINHAS
 *   axis 'V' → o FLUXO fica com a vertical;   as zonas viram COLUNAS
 *
 * A célula é idêntica nos dois. O que muda é qual dimensão vira linha de papel —
 * e, com ela, ONDE mora a calha de rótulo, porque texto é sempre horizontal e
 * rótulo de caixa fica sempre no topo. Essa é a assimetria real entre os eixos.
 */
function layout(model, axis) {
  const H = axis === 'H';
  const stages = model.stages.map(s => s.id);
  const zones = model.zones;

  const rowsAre = H ? 'zone' : 'stage';          // o que vira linha de papel
  const rowIds = H ? zones : stages;
  const colIds = H ? stages : zones;
  const gapCols = H ? K.GAP_FLOW : K.GAP_ZONE;
  const gapRows = H ? K.GAP_ZONE : K.GAP_FLOW;

  const rowIdx = id => rowIds.indexOf(id);
  const colIdx = id => colIds.indexOf(id);
  const rowOfNode = n => rowsAre === 'zone' ? rowIdx(n.zone) : rowIdx(n.stage);
  const colOfNode = n => rowsAre === 'zone' ? colIdx(n.stage) : colIdx(n.zone);

  // colunas primeiro: não dependem de calha nenhuma
  const colX = []; let x = 0;
  colIds.forEach((_, c) => { if (c) x += gapCols; colX.push(x); x += K.CELL_W; });
  const contentW = x;

  // --- calhas. Toda banda precisa de espaço para o rótulo ACIMA de si, em y de
  //     papel, porque texto é horizontal e rótulo de caixa fica no topo.
  //
  //     O #19 fixou UMA constante por família de banda — bastava, porque lá
  //     todas as faixas eram colunas lado a lado, dividindo a mesma calha. Com
  //     dois eixos possíveis surge o caso que faltava: duas bandas que TOPAM NA
  //     MESMA LINHA. Aí a calha só empilha se elas se SOBREPÕEM em x de papel.
  //     Lado a lado (as três AZ em coluna) dividem a calha; sobrepostas (a AZ e
  //     o Auto Scaling group que a cruza) precisam de níveis diferentes.
  const spanCols = b => {
    const cs = model.nodes.filter(n => b.members.includes(n.id))
      .flatMap(n => n.zone == null ? colIds.map((_, i) => i) : [colOfNode(n)]);
    return [Math.min(...cs), Math.max(...cs)];
  };
  const topRow = b => Math.min(...model.nodes
    .filter(n => b.members.includes(n.id))
    .map(n => n.zone == null ? 0 : rowOfNode(n)));

  const naLinha = rowIds.map(() => []);
  for (const b of model.bands) { const r = topRow(b); if (r >= 0) naLinha[r].push(b); }

  const bandTopPad = {};
  const laneBefore = naLinha.map(bs => {
    const niveis = [];   // cada nível: { alto, ocupa: [[c1,c2], …] }
    for (const b of [...bs].sort((p, q) => (p.kind === 'az' ? 0 : 1) - (q.kind === 'az' ? 0 : 1))) {
      const [c1, c2] = spanCols(b);
      const alto = b.kind === 'az' ? K.ZONE_LANE : K.BAND_LANE;
      let i = niveis.findIndex(n => !n.ocupa.some(([d1, d2]) => c1 <= d2 && d1 <= c2));
      if (i < 0) { niveis.push({ alto, ocupa: [] }); i = niveis.length - 1; }
      niveis[i].alto = Math.max(niveis[i].alto, alto);
      niveis[i].ocupa.push([c1, c2]);
      bandTopPad[b.id] = niveis.slice(0, i + 1).reduce((s, n) => s + n.alto, 0);
    }
    return niveis.reduce((s, n) => s + n.alto, 0);
  });

  const rowY = []; let y = 0;
  rowIds.forEach((_, r) => { y += (r ? gapRows : 0) + laneBefore[r]; rowY.push(y); y += K.CELL_H; });
  const contentH = y;

  const cellRect = (stage, zone) => ({
    x: colX[rowsAre === 'zone' ? colIdx(stage) : colIdx(zone)],
    y: rowY[rowsAre === 'zone' ? rowIdx(zone) : rowIdx(stage)],
    w: K.CELL_W, h: K.CELL_H,
  });
  const spanRect = stage => unionRect(zones.map(z => cellRect(stage, z)));

  const R = {};
  for (const n of model.nodes) R[n.id] = n.zone == null ? spanRect(n.stage) : cellRect(n.stage, n.zone);

  return { R, axis, H, rowsAre, rowY, colX, contentW, contentH, laneBefore,
           cellRect, spanRect, zones, stages,
           bandRect(b) {
             const rects = b.members.map(id => R[id]);
             return unionRect(rects, { l: 10, r: 10 + (b.kind === 'az' ? 0 : K.CROSS_OUT),
                                       t: bandTopPad[b.id], b: 10 });
           } };
}

/** União de retângulos + folga. É o construtor de banda derivada do #19, sem eixo. */
function unionRect(rects, pad) {
  const p = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, pad || {});
  return {
    x: Math.min(...rects.map(r => r.x)) - p.l,
    y: Math.min(...rects.map(r => r.y)) - p.t,
    w: Math.max(...rects.map(r => r.x + r.w)) + p.r - (Math.min(...rects.map(r => r.x)) - p.l),
    h: Math.max(...rects.map(r => r.y + r.h)) + p.b - (Math.min(...rects.map(r => r.y)) - p.t),
  };
}

/**
 * O ícone mora centrado na célula, abaixo da faixa de título e acima da folga
 * do rótulo. Centrar nos DOIS eixos importa: uma caixa de span é alta em 'H' e
 * larga em 'V'; ancorar no topo daria vantagem artificial a um dos eixos na
 * hora de medir.
 */
const LABEL_ROOM = 16;
const iconRect = cell => ({
  x: cell.x + (cell.w - K.ICON) / 2,
  y: cell.y + K.HEAD + Math.max(0, (cell.h - K.HEAD - K.ICON - LABEL_ROOM) / 2),
  w: K.ICON, h: K.ICON,
});

// ---------------------------------------------------------------- roteamento
/**
 * Roteador ortogonal de 3 segmentos: sai pelo eixo do fluxo, desvia na calha
 * entre etapas, entra pelo eixo do fluxo. `slot` desloca o desvio para que
 * arestas convergentes não se sobreponham.
 */
function route(L, a, b, slot) {
  const H = L.H;
  const ac = r => H ? r.y + r.h / 2 : r.x + r.w / 2;
  const pt = (along, across) => H ? { x: along, y: across } : { x: across, y: along };
  const fwd = (H ? b.x - a.x : b.y - a.y) >= 0;
  const a0 = fwd ? (H ? a.x + a.w : a.y + a.h) : (H ? a.x : a.y);
  const b0 = fwd ? (H ? b.x : b.y) : (H ? b.x + b.w : b.y + b.h);
  const ca = ac(a), cb = ac(b);
  if (Math.abs(ca - cb) < 1) return [pt(a0, ca), pt(b0, cb)];
  const mid = a0 + (b0 - a0) / 2 + (slot || 0);
  return [pt(a0, ca), pt(mid, ca), pt(mid, cb), pt(b0, cb)];
}

/**
 * Aresta que PULA uma etapa. Passar reto por cima da etapa intermediária
 * atravessaria caixa alheia nas duas orientações — o desvio é pela margem, que
 * é o que os diagramas oficiais fazem. Nada aqui é específico de eixo.
 */
function routeAround(L, a, b, margens) {
  const H = L.H;
  const pt = (along, across) => H ? { x: along, y: across } : { x: across, y: along };
  const ac = r => H ? r.y + r.h / 2 : r.x + r.w / 2;
  const a0 = H ? a.x + a.w : a.y + a.h;
  const b0 = H ? b.x : b.y;
  const ca = ac(a), cb = ac(b);
  // sai pela margem MAIS PRÓXIMA da origem — desviar pelo lado errado atravessa
  // exatamente as faixas que o desvio existia para evitar
  const extensao = H ? L.contentH : L.contentW;
  const margin = ca < extensao / 2 ? margens.antes : margens.depois;
  return [pt(a0, ca), pt(a0 + 24, ca), pt(a0 + 24, margin), pt(b0 - 24, margin),
          pt(b0 - 24, cb), pt(b0, cb)];
}

/** Aresta puramente transversal (mesma etapa) — ex.: replicação síncrona. */
function routeAcross(L, a, b) {
  if (L.H) {
    const x = a.x + a.w / 2;
    return a.y < b.y ? [{ x, y: a.y + a.h }, { x, y: b.y }] : [{ x, y: a.y }, { x, y: b.y + b.h }];
  }
  const y = a.y + a.h / 2;
  return a.x < b.x ? [{ x: a.x + a.w, y }, { x: b.x, y }] : [{ x: a.x, y }, { x: b.x + b.w, y }];
}

/**
 * Onde o callout pousa: meio do segmento MAIS LONGO. O meio da polilinha cai em
 * cima de ícone e de rótulo com frequência; o segmento mais longo é o pedaço
 * que de fato tem espaço livre.
 */
function pointAt(poly) {
  let melhor = 0, dmax = -1;
  for (let i = 1; i < poly.length; i++) {
    const d = Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
    if (d > dmax) { dmax = d; melhor = i; }
  }
  return { x: (poly[melhor].x + poly[melhor - 1].x) / 2,
           y: (poly[melhor].y + poly[melhor - 1].y) / 2 };
}

// ------------------------------------------------------------------- medição
function segSeg(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}
const inside = (pt, r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
function segRectHit(p, q, r) {
  if (inside(p, r) || inside(q, r)) return true;
  const e = [[r.x, r.y, r.x + r.w, r.y], [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
             [r.x + r.w, r.y + r.h, r.x, r.y + r.h], [r.x, r.y + r.h, r.x, r.y]];
  return e.some(([x1, y1, x2, y2]) => segSeg(p, q, { x: x1, y: y1 }, { x: x2, y: y2 }));
}
const polyHitsRect = (poly, r) => {
  for (let i = 1; i < poly.length; i++) if (segRectHit(poly[i - 1], poly[i], r)) return true;
  return false;
};
const rectInside = (i, o) =>
  i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h;

/**
 * As checagens da rubrica (#8) que ESTA pergunta aciona.
 *   A4.2 — nó dentro de faixa de AZ da qual não é membro   (fronteira que mente)
 *   A5.5 — aresta cortando faixa de AZ onde nenhuma ponta mora
 *   A5.7 — consistência de direção no eixo declarado do fluxo
 *   A5.1 — cruzamentos entre arestas
 */
function medir(model, L, azBands, routed) {
  const zoneOf = Object.fromEntries(model.nodes.map(n => [n.id, n.zone]));

  const a42 = [];
  for (const [z, band] of Object.entries(azBands))
    for (const n of model.nodes) {
      if (n.zone === z || n.zone == null) continue;   // membro, ou nó que DECLARA cruzar
      if (rectInside(L.R[n.id], band)) a42.push(`${n.id}(${n.zone}) dentro da faixa ${z}`);
    }

  const a55 = [];
  for (const e of routed)
    for (const [z, band] of Object.entries(azBands)) {
      if (zoneOf[e.from] === z || zoneOf[e.to] === z) continue;
      if (zoneOf[e.from] == null && zoneOf[e.to] == null) continue;  // span→span cruza por definição
      if (polyHitsRect(e.poly, band)) a55.push(`${e.from}→${e.to} corta ${z}`);
    }

  const H = L.H;
  const considered = routed.filter(e => {
    const p = e.poly[0], q = e.poly[e.poly.length - 1];
    const d = Math.abs(H ? q.x - p.x : q.y - p.y);
    const perp = Math.abs(H ? q.y - p.y : q.x - p.x);
    return !(perp > 0 && d < perp * 0.27);           // ignora ±15° do perpendicular
  });
  const ok = considered.filter(e => {
    const p = e.poly[0], q = e.poly[e.poly.length - 1];
    return (H ? q.x - p.x : q.y - p.y) > 0;
  });

  let crossings = 0;
  for (let i = 0; i < routed.length; i++)
    for (let j = i + 1; j < routed.length; j++)
      for (let a = 1; a < routed[i].poly.length; a++)
        for (let b = 1; b < routed[j].poly.length; b++)
          if (segSeg(routed[i].poly[a - 1], routed[i].poly[a],
                     routed[j].poly[b - 1], routed[j].poly[b])) crossings++;

  return { a42, a55, a51: crossings,
           a57: considered.length ? ok.length / considered.length : 1 };
}

module.exports = { esc, S, K, iconStyle, layout, unionRect, iconRect,
                   route, routeAcross, routeAround, pointAt, medir, cat };
