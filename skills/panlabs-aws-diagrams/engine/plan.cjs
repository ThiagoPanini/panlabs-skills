'use strict';
/**
 * Planning — raw layout -> cell plan.
 *
 * The plan is the engine's seam: from here on, nobody knows whether the
 * drawing came from ELK or from the AZ grid. It's what lets #21 decide the
 * bands' axis without touching the emitter, and #13 swap the style layer
 * without touching the layout.
 *
 * List order is z order: whoever comes first sits behind.
 */

const dispor = require('./layout.cjs');
const { AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, calhaDaFaixa, folgas } = dispor;
const { LEAVES } = require('./validate.cjs');

/**
 * The height of a title block row, as a function of its body size.
 *
 * WARNING: ONE FACTOR ONLY, and it used to be written twice with different
 * values — 1.5 in `frame` and 1.4 in `header`, caught in #23's review. The
 * reservation and the consumption have to come from the same account, or the
 * top of the page ends up 1 px taller or shorter than the block that lives in
 * it, and the gap grows with the theme's density.
 *
 * 1.4 is common typographic line-height and it's what `resolve.cjs` already
 * uses for the leaf label (17 px at 12 pt ≈ 1.42).
 */
const ROW = px => Math.round(px * 1.4);

/**
 * The page margin is a token (`page.margin`, default 32 = 4 steps of the base
 * grid). The top is the margin plus the title block's height, which grows
 * with the title's body and with `O24`'s revision line — so it's computed,
 * not a constant like in #11.
 *
 * WARNING: the SUBTITLE line is ALWAYS reserved, and that's a decision, not an
 * oversight — the previous version wrote `text.subtitle ? … : 0`, which tests
 * a FONT BODY (12 in all four themes) and therefore was never false: it looked
 * conditional and was constant. What it meant to test — *does this model have
 * a subtitle?* — doesn't belong here, because `frame` is a THEME concern and
 * `mo.topo` is the origin of the whole page's content; making it vary per
 * model would give two diagrams of the same theme different origins without
 * the theme having changed. Always reserving it costs one margin's worth of
 * line in a diagram with no subtitle; the corpus's 15 have one.
 */
function frame(res) {
  const t = res.tema;
  const m = t.tokens.page.margin;
  const titleHeight = ROW(t.tokens.text.title) + ROW(t.tokens.text.subtitle) +
    (t.tokens.card.revision ? Math.round(t.tokens.text.subtitle * 1.3) : 0);
  return { x: m, topo: m + titleHeight, rodape: m };
}

/** The slice of the theme this module uses. */
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
 * Edge style. Routing comes from here — the `exit*`/`entry*` anchors are
 * geometry, not paint —, and everything else comes from the token, including
 * what #5 calls N9/A11: AWS's official arrow is ALWAYS solid, so `dashed` and
 * `animated` are deviations that pay off a debt, not neutral options.
 *
 * #2 §5.4 is explicit: `exitX` and `exitY` only count IN PAIR, and without
 * `exitPerimeter=0` the engine reprojects the point onto the shape's
 * perimeter — which on a non-rectangular shape is the main source of visual
 * non-determinism.
 */
function edgeStyle(a, anc, theme) {
  const tip = theme.tokens.edge.tip;
  const extra = {};
  if (a.data === 'both')
    Object.assign(extra, { startArrow: tip, startFill: tip === 'open' ? 0 : 1, startSize: 6 });
  if (anc.output)
    Object.assign(extra, { exitX: anc.output.x, exitY: anc.output.y, exitDx: 0, exitDy: 0, exitPerimeter: 0 });
  if (anc.input)
    Object.assign(extra, { entryX: anc.input.x, entryY: anc.input.y, entryDx: 0, entryDy: 0, entryPerimeter: 0 });
  return theme.edge(extra);
}

const clamp = v => Math.min(1, Math.max(0, Math.round(v * 1000) / 1000));

/** Which side of the box ELK touched the edge's tip against. */
function anchor(cellBox, p) {
  const eps = 2.5;
  if (Math.abs(p.x - cellBox.x) <= eps) return { x: 0, y: clamp((p.y - cellBox.y) / cellBox.h) };
  if (Math.abs(p.x - (cellBox.x + cellBox.w)) <= eps) return { x: 1, y: clamp((p.y - cellBox.y) / cellBox.h) };
  if (Math.abs(p.y - cellBox.y) <= eps) return { x: clamp((p.x - cellBox.x) / cellBox.w), y: 0 };
  if (Math.abs(p.y - (cellBox.y + cellBox.h)) <= eps) return { x: clamp((p.x - cellBox.x) / cellBox.w), y: 1 };
  return null;   // loose tip: let it float instead of lying about an anchor
}

function edgeLabel(a) {
  const base = a.label || '';
  if (a.order === undefined) return base;
  return base ? `<b>${a.order}.</b> ${base}` : `<b>${a.order}</b>`;
}

/**
 * The title is sized by the text, not by a round number.
 * A cell that's too wide doesn't show up in the drawing — but it shows up in
 * the FILE: `drawio -x` exports the box that contains everything, so a
 * 1100 px wide text band for a 500 px diagram produces half the image in
 * blank space. That's what happened in this module's first version.
 */
function header(layoutPlan, model, res) {
  const p = paint(res);
  const mo = frame(res);
  const measure = (text, px) => Math.ceil(res.textWidth(text) * px / 11) + 8;
  /**
   * The title block starts a little ABOVE the side margin, and the factor
   * comes from a real asymmetry: the side margin is measured to the EDGE of
   * the first container, while the top one is measured to the top of the
   * title's TEXT BOX — which already carries internal air, because the glyph
   * doesn't touch its top. `ROW(px)` reserves 1.4× the body for a text whose
   * glyph height is ≈0.7×, so half the excess sits on top. Subtracting that is
   * what makes the top's optical margin match the side one instead of looking
   * bigger.
   */
  let y = mo.x - Math.round((ROW(p.ptTitulo) - p.ptTitulo) / 2);
  const h = ROW;
  layoutPlan.cells.push({
    kind: 'vertice', id: 'title', parent: '1', label: model.title, style: p.title,
    geo: { x: mo.x, y, w: measure(model.title, p.ptTitulo), h: h(p.ptTitulo) },
  });
  y += h(p.ptTitulo);
  if (model.subtitle) {
    layoutPlan.cells.push({
      kind: 'vertice', id: 'subtitle', parent: '1', label: model.subtitle, style: p.subtitle,
      geo: { x: mo.x, y, w: measure(model.subtitle, p.ptSub), h: h(p.ptSub) },
    });
    y += h(p.ptSub);
  }
  // #5's O24: 12 of 12 Reference Architecture PDFs carry "Reviewed for
  // technical accuracy <date>". It's part of the title block, and therefore a
  // house-layer concern.
  if (p.linhaRevisao)
    layoutPlan.cells.push({
      kind: 'vertice', id: 'revision', parent: '1', label: p.linhaRevisao, style: p.revision,
      geo: { x: mo.x, y, w: measure(p.linhaRevisao, p.ptSub), h: Math.round(p.ptSub * 1.3) },
    });
}

/**
 * The model travels INSIDE the file. #2 proved that an `<object>` attribute
 * round-trips byte for byte, line breaks included — so the `.drawio` is its
 * own persistence format and there's no second file to fall out of sync.
 */
function modelCell(model, res) {
  const t = res.tema;
  return {
    kind: 'vertice', id: 'panlabs-modelo', parent: '1', label: '', visible: false,
    style: 'text;html=1;', geo: { x: 0, y: 0, w: 1, h: 1 },
    data: {
      panlabsSchema: model.schema,
      panlabsModelo: JSON.stringify(model),
      // THE THEME TRAVELS RESOLVED, not by name — for the same reason #4 §7
      // gave for refusing `style="<name>"` on `<mxGraphModel>`: a name only
      // resolves against whatever the other end has. A `.drawio` that stored
      // "theme=light" would regenerate differently the day `light.json`
      // changed. By storing the tokens, the file keeps being its own
      // persistence format.
      panlabsTema: JSON.stringify({ id: t.id, background: t.background, tokens: t.tokens }),
    },
  };
}

/**
 * From a layout coordinate to a PAGE one.
 *
 * Three places in this file used to do the same addition under different
 * names (`offset` twice, `toPage` once). It's always the same question — the
 * edge cell is a child of the layer (`parent: '1'`), and there the waypoint is
 * in page space — and having three copies is exactly what left the grid
 * path's version undone until #24 (see `gridEdges`).
 */
const toPage = (base) => (pt) => ({ x: pt.x + base.x, y: pt.y + base.y });

/**
 * A box turns into an obstacle for `dispor.corredorLivre`: `ini..fim` on the
 * leg's axis, `lo..hi` on the axis it crosses. Two readings of the same box,
 * because the leg can be vertical or horizontal.
 */
const boxOnX = b => ({ ini: b.x, fim: b.x + b.w, lo: b.y, hi: b.y + b.h });
const boxOnY = b => ({ ini: b.y, fim: b.y + b.h, lo: b.x, hi: b.x + b.w });

/**
 * The notes attached to a node that the LAYOUT didn't place.
 *
 * Since #24 a note is an ELK node (`dispor.notasPorPai`): it comes out of the
 * layout with its own box, inside its subject's container, without
 * overlapping anyone — and the pass that assembles the cells has already
 * emitted it, because it's in `boxes` like any other leaf.
 *
 * One case is left, and it's path C's: a note about a node that lives in no
 * account at all. The row of accounts is the ENGINE's grid, not ELK's, so
 * there's no graph for that note to have entered. Then the old fixed offset
 * comes back — which is a guess, and that's exactly why it's the exception and
 * not the rule. Making it disappear would be worse: a silent omission is
 * `A4.2` from the other side.
 */
function attachedNotes(layoutPlan, model, abs, p) {
  for (const [i, n] of (model.notes || []).entries()) {
    if (n.about === undefined) continue;
    // the id comes from `dispor.idDaNota` — the two sides HAVE to agree, or
    // the `abs.has(id)` check below fails and the note comes out twice
    const id = dispor.idDaNota(n, i);
    if (abs.has(id)) continue;                 // the layout already placed it
    const a = abs.get(n.about);
    if (!a) continue;
    layoutPlan.cells.push({
      kind: 'vertice', id, parent: '1', label: n.text, style: p.note,
      geo: { x: a.x + a.w + 14, y: a.y, w: dispor.NOTE_W, h: dispor.NOTE_MIN_H },
    });
  }
}

function footer(layoutPlan, model, usableWidth, res, y) {
  const p = paint(res);
  const mo = frame(res);
  const loose = (model.notes || []).filter(n => n.about === undefined);
  if (!loose.length) return y;
  const chunks = loose.map(n =>
    (n.origin === 'rejected-finding' ? '<b>⚠ Finding accepted by the team:</b> ' : '') + n.text);
  const text = chunks.join('<br>');
  // the box has to fit the WRAPPED text: a long note on a narrow page takes
  // three lines, and sizing by "one line per note" cuts off the last one
  const rows = chunks.reduce((n, p) => n + res.labelLines(p.replace(/<[^>]+>/g, ''), usableWidth - 20), 0);
  const h = 22 + rows * 16;
  layoutPlan.cells.push({
    kind: 'vertice', id: 'notes', parent: '1', label: text, style: p.note,
    geo: { x: mo.x, y: y + 20, w: usableWidth, h },
  });
  return y + 20 + h;
}

// ------------------------------------------------------------ path A (ELK)

function elkPlan(model, d, res, layout, opts = {}) {
  const mo = frame(res);
  const p = paint(res);
  const { output, boxes } = layout;
  const layoutPlan = { id: model.id, name: model.title, cells: [], background: p.background,
    tema: res.tema.id };
  header(layoutPlan, model, res);

  const abs = new Map();

  (function tier(no, parentId, parentAbs) {
    for (const c of no.children || []) {
      const meta = boxes.get(c.id);
      const modelNode = d.t.byId.get(c.id);
      const x = c.x + (parentId === '1' ? mo.x : 0);
      const y = c.y + (parentId === '1' ? mo.topo : 0);
      const a = { x: parentAbs.x + x, y: parentAbs.y + y, w: c.width, h: c.height };
      abs.set(c.id, a);

      layoutPlan.cells.push({
        kind: 'vertice', id: c.id, parent: parentId,
        label: meta.container ? (modelNode.label || '') : meta.label,
        style: meta.style,
        geo: { x, y, w: c.width, h: c.height },
      });

      if (c.children && c.children.length) tier(c, c.id, a);
    }
  })(output, '1', { x: 0, y: 0 });

  // member bands — the box is the computed UNION, parented at the common ancestor
  for (const f of d.bands) {
    const members = f.members.map(id => abs.get(id)).filter(Boolean);
    if (members.length < 2) continue;
    const anc = f.members.map(id => d.t.byId.get(id))
      .reduce((acc, n) => acc === undefined ? n : (require('./derive.cjs').ancestralComum(acc, n, d.t) || acc), undefined);
    const parentId = anc && d.t.byId.get(anc.id) && abs.has(anc.id) ? anc.id : '1';
    const base = parentId === '1' ? { x: 0, y: 0 } : abs.get(parentId);
    const fr = res.band(f);
    const x1 = Math.min(...members.map(m => m.x)) - 12;
    const x2 = Math.max(...members.map(m => m.x + m.w)) + 12;
    const y1 = Math.min(...members.map(m => m.y)) - calhaDaFaixa(fr.style);
    const y2 = Math.max(...members.map(m => m.y + m.h)) + 12 + (layout.rotuloMax || 0);
    layoutPlan.cells.push({
      kind: 'vertice', id: f.id, parent: parentId, label: f.label || '', style: fr.style,
      geo: { x: x1 - base.x, y: y1 - base.y, w: x2 - x1, h: y2 - y1 },
    });
  }

  // edges: all on the root layer, absolute waypoints (#2 §5.2 + #7 edgeCoords ROOT)
  for (const e of output.edges || []) {
    const a = d.edges.find(x => x.id === e.id);
    const sec = (e.sections || [])[0];
    if (!sec) continue;
    const shift = toPage({ x: mo.x, y: mo.topo });
    const anc = {
      output: anchor(abs.get(a.from), sec.startPoint),
      input: anchor(abs.get(a.to), sec.endPoint),
    };
    layoutPlan.cells.push({
      kind: 'edge', id: e.id, parent: '1', from: a.from, to: a.to,
      label: edgeLabel(a), style: edgeStyle(a, anc, res.tema),
      points: (sec.bendPoints || []).map(shift),
    });
  }

  attachedNotes(layoutPlan, model, abs, p);

  const widthOf = Math.max(output.width + 2 * mo.x, 900);
  const end = footer(layoutPlan, model, widthOf - 2 * mo.x, res, output.height + mo.topo + (layout.rotuloMax || 0));
  layoutPlan.width = widthOf;
  layoutPlan.height = end + mo.rodape;
  layoutPlan.cells.push(modelCell(model, res));
  return layoutPlan;
}

// ---------------------------------------------------------- path B (grid)

/**
 * The absolute box (relative to the cloud) of each subnet and of each of its
 * children — a single map, for the two places in path B that need the same
 * accounting: `gridEdges` for the detour barriers, and #31 for knowing
 * whether a band's box would hug a point that isn't its own.
 */
function gridPositions(model, g) {
  const abs = new Map();
  for (const s of model.nodes.filter(n => n.kind === 'subnet')) {
    const p = g.pos.get(s.id);
    if (!p) continue;
    abs.set(s.id, p);
    for (const child of g.intra.get(s.id).filhos || []) {
      const meta = g.boxes.get(child.id);
      abs.set(child.id, { x: p.x + child.x, y: p.y + child.y, w: meta.boxW || meta.shapeW, h: meta.shapeH });
    }
  }
  return abs;
}

/**
 * THE AZ BAND'S BOX, IN THE SAME SPACE `gridPositions` USES — and computed ONCE.
 *
 * There are two consumers, and #110 is the ticket that proves they have to be
 * the same box: `gridPlan` DRAWS the band, and `gridEdges` has to route around
 * a band it doesn't belong to. Two copies of this formula would be a contract
 * with two ends, and the drawn band and the routed-around band would drift
 * apart silently — the drawing crossing a strip the router believed it had
 * cleared.
 *
 * The band is deliberately LARGER than the subnets it holds. It reserves a
 * lane for its own label (`AZ_LANE` above the column, `reservaDaRaia` above
 * the swimlane), it starts at the leftmost/topmost VPC edge, and it overflows
 * the far end by `CROSS_OUT` — that overflow being what makes the crossing
 * visible at all (#19, rule 3). Every one of those margins is a strip the
 * subnet's own box does not cover, and every one of them is region an edge
 * routed against the SUBNET alone will happily land in.
 */
function azBandBoxes(model, g) {
  const boxes = new Map();
  if (!g.vpcBox.size) return boxes;
  const top = Math.min(...[...g.vpcBox.values()].map(b => b.y));
  const left = Math.min(...[...g.vpcBox.values()].map(b => b.x));

  for (const z of g.azs) {
    const members = model.nodes.filter(n => n.az === z).map(n => g.pos.get(n.id)).filter(Boolean);
    if (!members.length) continue;
    // the swimlane starts at the leftmost VPC's edge and overflows to the
    // right through `CROSS_OUT` — that overflow is what makes the crossing
    // VISIBLE (#19, rule 3). The label lives in the strip reserved above.
    const lane = g.reservaDaRaia.get(z) || g.SWIMLANE_LANE;
    boxes.set(z, g.raia
      ? {
          x: left - 8,
          y: Math.min(...members.map(m => m.y)) - lane,
          w: Math.max(...members.map(m => m.x + m.w)) + g.CROSS_OUT - (left - 8),
          h: Math.max(...members.map(m => m.y + m.h)) + 10 -
             (Math.min(...members.map(m => m.y)) - lane),
        }
      : {
          x: Math.min(...members.map(m => m.x)) - 14,
          y: top - g.AZ_LANE,
          w: Math.max(...members.map(m => m.x + m.w)) + 14 - (Math.min(...members.map(m => m.x)) - 14),
          h: Math.max(...members.map(m => m.y + m.h)) + g.CROSS_OUT - (top - g.AZ_LANE),
        });
  }
  return boxes;
}

/**
 * #31 — THE UNION'S BOX HUGS THE MEMBER'S WHOLE SUBNET, NOT JUST ITS ICON. The
 * grid only knows how to position at the grain of a subnet (`g.pos`); it has
 * no other way to say "where is the member" than "where is the subnet that
 * contains it". So an Auto Scaling group with two members in different AZs is
 * the UNION of two whole subnets — and any other service that lives in one of
 * those subnets (the frequent case: an antifraud Lambda next to the ECS that
 * scales) is, by construction, inside the box.
 *
 * There's no routing fix here (see the ticket): the box IS the union, the
 * union IS the whole subnets. What can be answered is WHETHER this would
 * happen — before drawing the box — and degrading instead of drawing the lie.
 */
function swallowsNonMember(model, gridPos, f, x1, y1, x2, y2) {
  const members = new Set(f.members);
  for (const n of model.nodes) {
    if (!LEAVES.has(n.kind) || members.has(n.id)) continue;
    const cellBox = gridPos.get(n.id);
    if (!cellBox) continue;
    if (cellBox.x < x2 && cellBox.x + cellBox.w > x1 && cellBox.y < y2 && cellBox.y + cellBox.h > y1) return true;
  }
  return false;
}

/**
 * #30 — every outsider root's and descendant's box, in the SAME grid-space
 * `gridPositions` uses (the cloud's own top-left is the origin). An outsider
 * sits at a negative x by construction — see `layout.cjs`'s `layoutOutsiders`
 * — so no extra bookkeeping is needed to tell the two apart.
 */
function outsiderPositions(g) {
  const abs = new Map();
  if (!g.outsiders) return abs;
  for (const n of g.outsiders.order) {
    const p = g.outsiders.pos.get(n.id);
    abs.set(n.id, p);
    const r = g.outsiders.interno.get(n.id);
    if (!r.children) continue;             // a leaf — no descendants to place
    (function tier(node, base) {
      for (const c of node.children || []) {
        const a = { x: base.x + c.x, y: base.y + c.y, w: c.width, h: c.height };
        abs.set(c.id, a);
        if (c.children && c.children.length) tier(c, a);
      }
    })(r, p);
  }
  return abs;
}

/**
 * #30 — the outsiders' own cells. Root tier at the page level (`parent: '1'`,
 * same as an account in `accountPlan`); a container outsider's isolated ELK
 * result recurses exactly like `elkPlan`/`accountPlan`'s own `tier()`, and its
 * INTERNAL edges (both ends inside the same outsider) come straight from that
 * ELK result — everything that crosses OUT of an outsider is `outsiderEdges`'s
 * job, drawn after this.
 */
function drawOutsiders(layoutPlan, model, d, res, g, mo) {
  const fromGridToPage = toPage({ x: mo.x + g.outsiders.leftMargin, y: mo.topo });
  const gridSpace = outsiderPositions(g);

  for (const n of g.outsiders.order) {
    const p = gridSpace.get(n.id);
    const page = fromGridToPage(p);
    const meta = g.outsiders.boxes.get(n.id);
    layoutPlan.cells.push({
      kind: 'vertice', id: n.id, parent: '1',
      label: meta.container ? (n.label || '') : meta.label,
      style: meta.style,
      geo: { x: page.x, y: page.y, w: p.w, h: p.h },
    });

    const r = g.outsiders.interno.get(n.id);
    if (!r.children) continue;             // a leaf — nothing further to draw

    (function tier(node, parentId) {
      for (const c of node.children || []) {
        const m = g.outsiders.boxes.get(c.id);
        const modelNode = d.t.byId.get(c.id);
        layoutPlan.cells.push({
          kind: 'vertice', id: c.id, parent: parentId,
          label: m.container ? (modelNode.label || '') : m.label,
          style: m.style,
          geo: { x: c.x, y: c.y, w: c.width, h: c.height },
        });
        if (c.children && c.children.length) tier(c, c.id);
      }
    })(r, n.id);

    const boxPage = id => { const b = gridSpace.get(id); return { ...fromGridToPage(b), w: b.w, h: b.h }; };
    for (const e of r.edges || []) {
      const edge = d.edges.find(x => x.id === e.id);
      const sec = (e.sections || [])[0];
      if (!edge || !sec) continue;
      const eshift = toPage({ x: page.x, y: page.y });
      const anc = {
        output: anchor(boxPage(edge.from), eshift(sec.startPoint)),
        input: anchor(boxPage(edge.to), eshift(sec.endPoint)),
      };
      layoutPlan.cells.push({
        kind: 'edge', id: e.id, parent: '1', from: edge.from, to: edge.to,
        label: edgeLabel(edge), style: edgeStyle(edge, anc, res.tema),
        points: (sec.bendPoints || []).map(eshift),
      });
    }
  }
}

/**
 * #30 — edges that touch an outsider: outsider↔outsider, or outsider↔grid.
 * An edge fully inside ONE outsider's own subtree was already drawn by
 * `drawOutsiders`, straight from that outsider's own ELK result.
 *
 * A LOCAL detour (a short jog around whichever subnet is "in the way") isn't
 * enough here — measured on `outside-vpc-services`: the jog clears the first
 * blocking subnet, but the segment from there to the target's own anchor
 * still runs straight through it, because that segment was never checked.
 * `gridEdges` never hits this: its own detours stay inside the grid, where
 * the SAME two ends bound every segment.
 *
 * The route that actually works is the one #24 already measured for the
 * grid's own cross-zone edges (`tools/measure-fan.cjs`): don't cut through
 * the middle, go around the OUTSIDE. In column mode a band is a full-HEIGHT
 * strip, so "outside" means a row below every band — north was measured too
 * and rejected: it runs into the title block, which owns everything above
 * y=0 that isn't the grid's own `HEAD`/`AZ_LANE` reserve. In raia mode a
 * band is a full-WIDTH strip, so "outside" means a column past every VPC —
 * which, for an outsider, is simply the side it already lives on (#5's O19).
 * A leg bound by the SAME axis as its own end never crosses anything that
 * isn't its own: the leg at the outsider's own coordinate only ever touches
 * what's already west of the grid, and the leg at the target's own center
 * only ever touches its own column/lane, because columns and lanes don't
 * overlap each other by construction.
 *
 * KNOWN GAP: entering a column from the south assumes the target is the
 * BOTTOM-most role sharing that column — true whenever a zone holds one role
 * (every case #30 was asked to unblock), but a role stacked ABOVE another in
 * the same zone would need the same free-side search `accountPlan` already
 * has for a sibling account. Not measured to occur anywhere in the corpus;
 * left named rather than guessed at.
 */
function outsiderEdges(layoutPlan, model, d, res, g, mo) {
  if (!d.edges.length) return;
  const fromGridToPage = toPage({ x: mo.x + g.outsiders.leftMargin, y: mo.topo });

  const rootOf = new Map();
  for (const n of g.outsiders.order) {
    rootOf.set(n.id, n.id);
    (function walk(id) { for (const k of d.t.filhos.get(id)) { rootOf.set(k.id, n.id); walk(k.id); } })(n.id);
  }

  const outAbs = outsiderPositions(g);
  const gridAbs = gridPositions(model, g);
  const west = Math.min(...g.outsiders.order.map(n => outAbs.get(n.id).x)) - 40;
  const south = g.fim + 40;

  const crossing = d.edges.filter(a => {
    const rootA = rootOf.get(a.from), rootB = rootOf.get(a.to);
    return (rootA || rootB) && !(rootA && rootB && rootA === rootB);
  });

  // #30's own A6.1 — more than one of these edges leaving the SAME outsider
  // exits at the exact same point (its box center) unless spread apart, and
  // two edges from one point are indistinguishable. Grouped by whichever
  // outsider each edge touches, spread evenly along that box's own side.
  const fanKey = a => rootOf.get(a.from) || rootOf.get(a.to);
  const groups = new Map();
  for (const a of crossing) {
    const k = fanKey(a);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a);
  }
  const fanOf = new Map();
  for (const list of groups.values()) {
    list.sort((x, y) => String(x.id).localeCompare(String(y.id)));
    for (const [i, a] of list.entries())
      fanOf.set(a.id, list.length > 1 ? 0.3 + 0.4 * i / (list.length - 1) : 0.5);
  }

  const push = (a, anc, points) => layoutPlan.cells.push({
    kind: 'edge', id: a.id, parent: '1', from: a.from, to: a.to,
    label: edgeLabel(a), style: edgeStyle(a, anc, res.tema),
    points: points.map(fromGridToPage),
  });

  for (const a of crossing) {
    const rootA = rootOf.get(a.from), rootB = rootOf.get(a.to);
    const o = rootA ? outAbs.get(a.from) : gridAbs.get(a.from);
    const dst = rootB ? outAbs.get(a.to) : gridAbs.get(a.to);
    if (!o || !dst) continue;
    const fy = fanOf.get(a.id);

    if (rootA && rootB) {   // both outsiders: the column they're stacked in is already clear
      const forward = dst.x >= o.x;
      const anc = { output: { x: forward ? 1 : 0, y: fy }, input: { x: forward ? 0 : 1, y: fy } };
      const y0 = o.y + o.h * fy, y1 = dst.y + dst.h * fy;
      push(a, anc, Math.abs(y0 - y1) > 0.5 ? [{ x: west, y: y0 }, { x: west, y: y1 }] : []);
      continue;
    }

    const outsiderIsOrigin = !!rootA;
    const outEnd = outsiderIsOrigin ? o : dst;
    const gridEnd = outsiderIsOrigin ? dst : o;
    const outExitX = outsiderIsOrigin ? outEnd.x + outEnd.w : outEnd.x;

    // Every chain below is built OUTSIDER-FIRST (the shape when the
    // outsider is `a.from`) and reversed when it's `a.to` instead — the
    // waypoints have to walk from `a.from` to `a.to`, in that order, or the
    // implicit final segment connects the wrong pair of ends.
    if (g.raia) {
      // zones are Y-stacked, full WIDTH — "outside" is west, same side the
      // outsider already lives on: drop/rise straight there, at ITS x, then
      // enter the target horizontally at ITS own y (its own lane's only).
      const outY = outEnd.y + outEnd.h * fy, gridY = gridEnd.y + gridEnd.h / 2;
      const chain = [{ x: outExitX, y: outY }, { x: west, y: outY }, { x: west, y: gridY }];
      const anc = outsiderIsOrigin
        ? { output: { x: 1, y: fy }, input: { x: 0, y: 0.5 } }
        : { output: { x: 0, y: 0.5 }, input: { x: 1, y: fy } };
      push(a, anc, outsiderIsOrigin ? chain : [...chain].reverse());
    } else {
      // zones are X-columns, full HEIGHT — "outside" is south of every band
      // (never north — see the header), then straight up into the target's
      // OWN column center: no other column shares that x. The Y-adjustment
      // down to the safe row happens at `west`, NOT at the outsider's own
      // edge — two outsiders share a column, and a sibling can sit between
      // one of them and the safe row (measured: banlist's own "checks"
      // edges crossed agent's box before this, same shape as raia's own
      // west-first adjustment above).
      const outY = outEnd.y + outEnd.h * fy;
      const targetCenterX = gridEnd.x + gridEnd.w / 2;
      const chain = [{ x: west, y: outY }, { x: west, y: south }, { x: targetCenterX, y: south }];
      const anc = outsiderIsOrigin
        ? { output: { x: 1, y: fy }, input: { x: 0.5, y: 1 } }
        : { output: { x: 0.5, y: 1 }, input: { x: 1, y: fy } };
      push(a, anc, outsiderIsOrigin ? chain : [...chain].reverse());
    }
  }
}

function gridPlan(model, d, res, g, opts = {}) {
  const mo = frame(res);
  const p = paint(res);
  const f = folgas(res.tema);
  const layoutPlan = { id: model.id, name: model.title, cells: [], background: p.background,
    tema: res.tema.id };
  header(layoutPlan, model, res);

  /**
   * The grid's outer box — `cloud` normally, `account` on a DETAIL PAGE
   * (#137): `generate.cjs`'s `detailPages` slices one account out into its
   * own sub-model and strips its `inside`, so it arrives here as the only
   * root the sub-model has. Falling back to the generic "AWS Cloud" box in
   * that case would draw the account in the wrong place — silently, with
   * the account's own label and style gone — which is exactly what the
   * refusal this replaces existed to avoid.
   */
  const root = model.nodes.find(n => n.kind === 'cloud') ||
    model.nodes.find(n => n.kind === 'account' && n.inside === undefined);
  const cloudWidth = g.larguraGrade + 4 * f.PAD;
  const cN = res.container(root || { id: 'cloud', kind: 'cloud' });
  const cloudId = root ? root.id : 'aws-cloud';
  // #30: a column of outsiders shifts the cloud right to make room, but
  // doesn't touch a single coordinate inside it — see `layoutOutsiders`.
  const leftMargin = g.outsiders ? g.outsiders.leftMargin : 0;
  const cloudX = mo.x + leftMargin;

  layoutPlan.cells.push({
    kind: 'vertice', id: cloudId, parent: '1',
    label: (root && (root.label || root.id)) || 'AWS Cloud', style: cN.style,
    geo: { x: cloudX, y: mo.topo, w: cloudWidth, h: g.fim + f.PAD },
  });

  if (g.outsiders) drawOutsiders(layoutPlan, model, d, res, g, mo);

  // 1. AZ bands FIRST: z-order is document order, and they sit behind
  //
  // The band runs along the axis the VPCs stack on — that's what makes it
  // cross all of them — and `AZ_LANE` reserves its label on the other side.
  // With the AZ in a column the band is vertical and the label is born ABOVE;
  // transposed, it's horizontal and the label is born ON THE LEFT. It's the
  // same lane, on the other axis.
  //
  // The box comes from `azBandBoxes` and not from a formula written here:
  // `gridEdges` routes around this same band, and #110 is what happens when
  // the two ends of that accounting are written twice.
  for (const [z, geo] of azBandBoxes(model, g)) {
    // The catalog style doesn't carry `align`, so the label comes out
    // centered — which is right for a narrow column and wrong for a wide
    // swimlane, where the text falls in the middle of the drawing, on top of
    // whatever's there. Anchoring left is the ENGINE's call by the same
    // criterion as the member bands' halo: the palette stays the catalog's,
    // the legibility is whoever positions it.
    const style = res.faixaAz().style + (g.raia ? 'align=left;spacingLeft=10;' : '');
    layoutPlan.cells.push({
      kind: 'vertice', id: `az-${z}`, parent: cloudId,
      label: `Availability Zone · ${z}`, style, geo,
    });
  }

  // 2. the real containment tree: VPC › subnet › content
  for (const [vid, box] of g.vpcBox) {
    const v = d.t.byId.get(vid);
    layoutPlan.cells.push({
      kind: 'vertice', id: vid, parent: cloudId, label: v.label || '', style: g.boxes.get(vid).style,
      geo: { x: box.x, y: box.y, w: box.w, h: box.h },
    });
    for (const s of model.nodes.filter(n => n.kind === 'subnet')) {
      const p = g.pos.get(s.id);
      if (!p || (d.t.ancestrais(s).find(a => a.kind === 'vpc') || {}).id !== vid) continue;
      layoutPlan.cells.push({
        kind: 'vertice', id: s.id, parent: vid, label: s.label || '', style: g.boxes.get(s.id).style,
        geo: { x: p.x - box.x, y: p.y - box.y, w: p.w, h: p.h },
      });
      for (const child of g.intra.get(s.id).filhos || []) {
        const meta = g.boxes.get(child.id);
        layoutPlan.cells.push({
          kind: 'vertice', id: child.id, parent: s.id, label: meta.label, style: meta.style,
          geo: { x: child.x, y: child.y, w: meta.boxW || meta.shapeW, h: meta.shapeH },
        });
      }
    }
  }

  // 3. member bands on top
  const gridPos = d.bands.length ? gridPositions(model, g) : null;
  for (const f of d.bands) {
    const cel = f.members
      .map(id => { const n = d.t.byId.get(id); return d.t.ancestrais(n).find(a => a.kind === 'subnet') || n; })
      .map(s => g.pos.get(s.id)).filter(Boolean);
    if (cel.length < 2) continue;
    const x1 = Math.min(...cel.map(m => m.x)) - 10, x2 = Math.max(...cel.map(m => m.x + m.w)) + 10;
    const lane = g.calhas.get(f.id) || g.BAND_LANE;
    const y1 = Math.min(...cel.map(m => m.y)) - lane, y2 = Math.max(...cel.map(m => m.y + m.h)) + 10;

    // #31 — the box would sweep over a non-member: it DEGRADES. It stops
    // asserting containment (there's no box that hugs only the members
    // without also hugging whoever isn't one) and turns into the same device
    // used for the OR label — loose text, no shape —, anchored at the corner
    // where the box would have drawn its border. The lane was already
    // reserved there for the box's own label (`layout.cjs`), so the loose
    // text asks nobody for new space.
    if (swallowsNonMember(model, gridPos, f, x1, y1, x2, y2)) {
      const text = f.label || '';
      layoutPlan.cells.push({
        kind: 'vertice', id: `${f.id}-degradada`, parent: cloudId, label: text,
        style: res.tema.faixaRotulo(),
        geo: { x: x1, y: y1, w: Math.max(40, res.textWidth(text) + 8), h: lane },
      });
      continue;
    }

    layoutPlan.cells.push({
      kind: 'vertice', id: f.id, parent: cloudId, label: f.label || '', style: res.band(f).style,
      geo: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 },
    });
  }

  // 4. the flow. #11 left the grid WITHOUT edges on purpose — #6 had measured
  // that AWS's flagship multi-account diagram has none, and the axis was
  // still open. #21 closed the axis by saying the ORDERED dimension takes the
  // horizontal, and "ordered" means a numbered step: without drawing the
  // step, the axis choice would have no way to be seen or checked. So the
  // grid now draws what the model declares.
  //
  // The routing belongs to the engine, not to ELK, for the same reason as
  // path C: whoever knows where the grid's lanes are is whoever built the
  // grid.
  gridEdges(layoutPlan, model, d, res, g, opts);
  if (g.outsiders) outsiderEdges(layoutPlan, model, d, res, g, mo);

  /**
   * THE NOTE BLOCK STARTS BELOW WHAT THE PAGE DREW, NOT BELOW THE CLOUD.
   *
   * Both routings above are allowed to go SOUTH of the cloud, and both do it
   * on purpose: in column mode a band is a full-height strip, so getting
   * around one means a row past its end, and the band already overflows the
   * cloud by `CROSS_OUT`. "Below every band" is therefore outside the cloud by
   * construction — there is no row inside it to use instead.
   *
   * The footer used to start at the CLOUD's bottom edge, which is a different
   * number, and the note block landed on top of that row. #110 hit it: the
   * far pair's detour cleared every band and then ran straight through the
   * legend text. `outsiderEdges` had the same latent collision since #30 —
   * no outsider model in the corpus happens to carry a loose note.
   *
   * Reading the drawn edges back is the honest measurement: whatever the
   * routing decided, the footer sits under it. Anything else is a second copy
   * of the routing's own arithmetic.
   */
  const drawnBottom = layoutPlan.cells.reduce((low, c) =>
    c.kind === 'edge' ? (c.points || []).reduce((m, pt) => Math.max(m, pt.y), low) : low,
  mo.topo + g.fim + f.PAD);

  const widthOf = mo.x * 2 + leftMargin + cloudWidth;
  const end = footer(layoutPlan, model, widthOf - 2 * mo.x, res, drawnBottom);
  layoutPlan.width = widthOf;
  layoutPlan.height = end + mo.rodape;
  layoutPlan.cells.push(modelCell(model, res));
  return layoutPlan;
}

/**
 * The edges inside the grid.
 *
 * Two ends in the SAME swimlane (or column) become a straight line along the
 * flow axis — the case #21 wanted to favor by putting the numbered step on
 * the horizontal. Ends in different lanes detour along the border closest to
 * the ORIGIN, which is #21's third method finding:
 *
 *   > An edge that skips a step detours along the margin closest to the
 *   > origin. Detouring on the wrong side crosses exactly the bands the
 *   > detour existed to avoid.
 */
function gridEdges(layoutPlan, model, d, res, g, opts) {
  if (!d.edges.length) return;

  /**
   * WARNING: `g.pos` IS RELATIVE TO THE CLOUD, and the edge cell is a child of
   * the LAYER.
   *
   * The grid's boxes come out in cloud coordinates — that's how the AZ band
   * and the VPC box are emitted, with `parent: cloudId`. The edge isn't: it
   * goes to `parent: '1'`, and there the waypoint is page space, not cloud
   * space. Until #24 this accounting wasn't done, and the detour came out
   * offset (`mo.x`, `mo.topo`) from the very ends the engine itself had
   * anchored — which turns a route that's orthogonal by construction into a
   * DIAGONAL.
   *
   * It wasn't invisible: `A5.4` reported "44.4° bend, below the 60° floor" and
   * `A5.6` reported "there are off-axis segments in a routing that claims to
   * be orthogonal". Two checks pointing at the same `+32,+76` that nobody had
   * added up.
   */
  const mo = frame(res);
  const fromGridToPage = toPage({ x: mo.x, y: mo.topo });

  const abs = gridPositions(model, g);

  const subnetOf = id => {
    const n = d.t.byId.get(id);
    if (!n) return null;
    const s = n.kind === 'subnet' ? n : d.t.ancestrais(n).find(a => a.kind === 'subnet');
    return s ? s.id : null;
  };
  const laneOf = id => {
    const s = subnetOf(id);
    const n = s && d.t.byId.get(s);
    return n ? n.az : null;
  };

  /**
   * What the detour's leg CANNOT cross — and it is TWO lists, not one.
   *
   * ┌ every SUBNET that is neither the origin's nor the destination's.
   * │ Leaving the subnet it starts in and entering the destination's is the
   * │ path; passing through a third one is `A5.5` — the drawing asserting a
   * │ network path the model denies.
   * │
   * └ every AZ BAND that neither end belongs to. This is `F2`, and it is the
   *   mirror of `A5.5` for a band instead of a group — the same sentence with
   *   the noun swapped, which is exactly how the validator words it.
   *
   * #110 IS THE PROOF THAT ONE LIST WAS NOT TWO. Until it, the only obstacle
   * here was the subnet, and the band was assumed to be covered by it. It is
   * not: the band is deliberately larger (see `azBandBoxes`) — its own label
   * lane, the `CROSS_OUT` overflow, the reach to the outermost VPC edge. So
   * `corredorLivre` did its job, found a gap genuinely free of every subnet,
   * and put the leg down inside the neighboring band anyway. `quorum-3-az`
   * showed it: three brokers, one per zone, replicating to every peer — the
   * far pair sits at distance 2 in ANY lane order (#21's measured fallback),
   * its leg detoured into the row between the band's top and the VPC's title,
   * and that row is free of subnets and inside band `b`.
   *
   * ⚠️ AND IT IS AN ADDITION, NOT A SUBSTITUTION. Replacing subnet-with-band
   * here closes `quorum-3-az` and reopens `A5.5` on `web-flow-3-az` — a zone
   * there stacks THREE subnets, so its band is the union of all three, and
   * handing that union over as the only obstacle widens the search until the
   * corridor lands inside a subnet that the narrower obstacle had kept it out
   * of. Both lists, or one zero-tolerance failure is traded for another.
   *
   * Excluding the ENDS' OWN bands is what keeps this from being that same
   * over-widening: in swimlane mode a band is a full-WIDTH strip, and feeding
   * the origin's own band in would block every candidate the leg has.
   *
   * ⚠️ AND THE FOREIGN BAND STAYS A BOX — WHICH MEANS THE LEG MAY GO NORTH.
   *
   * In column mode a band runs the full height of the grid, so blocking one
   * leaves `corredorLivre` exactly two candidates: a row above every band or a
   * row below, whichever the midpoint sits nearer. `quorum-3-az` lands south.
   * A grid with the VPCs stacked TWO rows deep and the edge in the top row
   * lands north instead — the crossbar in the cloud's own label row, the two
   * verticals through the VPC's title row, which `A3.4` reports and which does
   * not block. The same model reports that same single `A3.4` WITHOUT this
   * change, alongside the `F2` this change removes: north is not a new defect
   * here, it is the old one minus the lie.
   *
   * Forcing south instead — opening the obstacle upward so north cannot win —
   * was tried and MEASURED on exactly that two-row grid: the leg clears every
   * band, and then its two verticals descend from the top row's icons past the
   * bottom row's subnets, `A5.5` ×3. That trades a readability finding for
   * three zero-tolerance lies. And #30's own rejection of north ("it runs into
   * the title block") was measured for the OUTSIDER leg, which travels above
   * the whole cloud — not for this one, which stops inside it. So the obstacle
   * stays a box, and the primitive keeps choosing the nearer margin.
   */
  const subnets = model.nodes.filter(n => n.kind === 'subnet').map(n => n.id);
  const bands = azBandBoxes(model, g);
  const onAxis = g.raia ? boxOnX : boxOnY;
  const barriers = a => {
    const mine = new Set([subnetOf(a.from), subnetOf(a.to)]);
    const myBands = new Set([laneOf(a.from), laneOf(a.to)]);
    return [
      ...subnets.filter(id => !mine.has(id)).map(id => abs.get(id)).filter(Boolean),
      ...[...bands].filter(([z]) => !myBands.has(z)).map(([, box]) => box),
    ].map(onAxis);
  };

  for (const a of d.edges) {
    const o = abs.get(a.from), dst = abs.get(a.to);
    if (!o || !dst) continue;
    const same = laneOf(a.from) && laneOf(a.from) === laneOf(a.to);
    const forward = g.raia ? dst.x >= o.x : dst.y >= o.y;

    let anc, points = [];
    if (g.raia) {
      const y0 = o.y + o.h / 2, y1 = dst.y + dst.h / 2;
      anc = { output: { x: forward ? 1 : 0, y: 0.5 }, input: { x: forward ? 0 : 1, y: 0.5 } };
      if (!same) {
        // detours along the margin closest to the ORIGIN (#21) — but through a
        // GAP, not through the midpoint between the icons. See `corredorLivre`.
        const near = forward ? (o.x + o.w + dst.x) / 2 : (dst.x + dst.w + o.x) / 2;
        const where = dispor.corredorLivre([y0, y1], barriers(a), near);
        points = [{ x: where, y: y0 }, { x: where, y: y1 }];
      }
    } else {
      const x0 = o.x + o.w / 2, x1 = dst.x + dst.w / 2;
      anc = { output: { x: 0.5, y: forward ? 1 : 0 }, input: { x: 0.5, y: forward ? 0 : 1 } };
      if (!same) {
        const near = forward ? (o.y + o.h + dst.y) / 2 : (dst.y + dst.h + o.y) / 2;
        const where = dispor.corredorLivre([x0, x1], barriers(a), near);
        points = [{ x: x0, y: where }, { x: x1, y: where }];
      }
    }

    layoutPlan.cells.push({
      kind: 'edge', id: a.id, parent: '1', from: a.from, to: a.to,
      label: edgeLabel(a), style: edgeStyle(a, anc, res.tema),
      points: points.map(fromGridToPage),
    });
  }
}

// --------------------------------------------------------- path C (accounts)

/**
 * The OR label. It isn't a box, and that's measurement, not style.
 *
 * The official deck has a CLOSED list of 13 group icons and `AWS account` is
 * on it; `Organization` and `Organizational unit` aren't (#6 G1). AWS draws
 * the OU as an icon+label pair floating ABOVE the first member, with no
 * rectangle, and the grouping is done through the 1:4 gap contrast (`G2`/`S3`).
 *
 * So the OU band uses the SAME derived-band constructor as #19 — union of the
 * members — and only changes what it does with it: instead of becoming a
 * rectangle, the union becomes the anchor the label is pinned to. One
 * constructor, two renderings.
 */
const S_OU = res => res.tema.ou();
/** `E4`'s bus: a line parallel to the row, offset OUTSIDE it. */
const S_BUS = res => res.tema.bus();
const S_STUB = res => res.tema.stub();

/**
 * `E9` — a permission enabler is an ATTACHED NODE, with a short arrow pointing
 * UP, into the component it authorizes. Never an edge label. Confirmed in two
 * independent official patterns (the Flow Logs bucket policy; the EventBridge
 * cross-account Role).
 */
const S_ENABLES = res => res.tema.habilitador();

function accountPlan(model, d, res, g, opts = {}) {
  const mo = frame(res);
  const p = paint(res);
  const f = folgas(res.tema);
  const layoutPlan = { id: model.id, name: model.title, cells: [], background: p.background,
    tema: res.tema.id };
  header(layoutPlan, model, res);

  const abs = new Map();          // id -> absolute box, for edges and bands
  const cloud = model.nodes.find(n => n.kind === 'cloud');

  // nodes that live in no account at all (typically the actor) sit OUTSIDE
  // the cloud, on the left — #5's `O19`: the user comes in from the left
  //
  // THE STACK IS ORDERED BY CONTENT, not by position in `model.nodes` — the
  // same P1 ruler that orders accounts and swimlanes in #11/#21. With a single
  // outsider this wasn't visible; with two (#32 brought the second real
  // corpus case), reordering `nodes` in the file would swap which one ended
  // up on top, and the determinism suite (#23) proved it.
  const outsiders = model.nodes.filter(n =>
    n.inside === undefined && n.kind !== 'cloud' && n.kind !== 'account' && !d.t.filhos.get(n.id).length)
    .sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id), 'pt'));
  let leftMargin = 0;
  for (const f of outsiders) leftMargin = Math.max(leftMargin, res.leaf(f).shapeW + 60);

  // The top channel has to be RESERVED before positioning, not discovered
  // afterward: it pushes the whole row down. How many lanes it needs is
  // countable with no geometry at all — it's however many outside edges reach
  // an account that isn't the row's first.
  const accountIdx = new Map(g.order.map((c, i) => [c.id, i]));
  const accountOfNode = id => {
    const n = d.t.byId.get(id);
    if (!n) return null;
    const c = n.kind === 'account' ? n : d.t.ancestrais(n).find(a => a.kind === 'account');
    return c ? c.id : null;
  };
  const detouredFromOutside = d.edges.filter(a => {
    const ca = accountOfNode(a.from), cb = accountOfNode(a.to);
    if (ca && cb) return false;
    const target = cb || ca;
    return target !== null && accountIdx.get(target) > 0;
  }).length;
  const topReserve = detouredFromOutside ? 26 + detouredFromOutside * 30 : 0;

  /**
   * and the bottom one for the same reason — but it depends on the MECHANISM,
   * not just the count. Reserving only for level 6 left the bus (`E4`) drawn
   * outside the `AWS Cloud` box: it's born below the row and nobody had asked
   * for the height. It was a latent bug because no model exercised it — the
   * `hub-tgw` and `logs-centralizados` models exist so it no longer is.
   */
  const detoured = d.policy.mecanismo === 'direta'
    ? d.travessias.filter(t => accountIdx.get(t.contaPara) !== accountIdx.get(t.contaDe) + 1).length
    : 0;
  const bottomReserve =
    d.policy.mecanismo === 'bus' ? 46 + 34
    : detoured ? 40 + detoured * 34
    : 0;
  /**
   * the aggregated one enters from the destination's LEFT, so it charges a
   * side margin — and the margin has to fit the LABEL, not a round number.
   * It's the label that does the work in `E3` ("the text replaces the
   * cardinality"): shrinking the run until it overflows on top of the
   * destination icon undoes the mechanism.
   */
  const aggregatedText = d.policy.mecanismo === 'agregada'
    ? (d.policy.grupos || []).map(group => {
        const ex = d.travessias.find(t => t.to === group.to);
        return `${ex && ex.label ? ex.label : 'from'} · ${group.accounts.length} accounts`;
      })
    : [];
  const leftReserve = aggregatedText.length
    ? Math.max(110, ...aggregatedText.map(t => res.textWidth(t) + 60))
    : 0;

  const baseX = mo.x + leftMargin + leftReserve;
  // Order matters: the cloud's title first, the channel AFTER it. In a
  // previous render the reserve came first and the top channel landed on top
  // of the cloud's title band.
  const baseY = mo.topo + (cloud ? 34 + f.PAD : 0) + topReserve;

  // 1. the cloud, if declared, wraps the whole grid
  // the cloud has to CONTAIN both channels: a link between AWS accounts drawn
  // outside the "AWS Cloud" box is a small lie, but it's a lie
  const cloudHeight = 34 + f.PAD + topReserve + g.altura + bottomReserve + f.PAD;
  const cloudId = cloud ? cloud.id : null;
  if (cloud) {
    const c = res.container(cloud);
    layoutPlan.cells.push({
      kind: 'vertice', id: cloud.id, parent: '1', label: cloud.label || 'AWS Cloud', style: c.style,
      geo: { x: baseX - f.PAD - leftReserve, y: mo.topo, w: g.widthOf + 2 * f.PAD + leftReserve, h: cloudHeight },
    });
    abs.set(cloud.id, { x: baseX - f.PAD - leftReserve, y: mo.topo, w: g.widthOf + 2 * f.PAD + leftReserve, h: cloudHeight });
  }

  // 2. the outsiders, to the left of the cloud, vertically centered
  for (const [i, f] of outsiders.entries()) {
    const m = res.leaf(f);
    const a = { x: mo.x, y: mo.topo + g.altura / 2 - m.shapeH / 2 + i * (m.shapeH + 40), w: m.shapeW, h: m.shapeH };
    abs.set(f.id, a);
    layoutPlan.cells.push({
      kind: 'vertice', id: f.id, parent: '1', label: m.label, style: m.style,
      geo: { x: a.x, y: a.y, w: a.w, h: a.h },
    });
  }

  // 3. OU labels — BEFORE the accounts, because document order is z order
  //
  // The second clause isn't a defense against an empty `col.ou` — in
  // integration it's already always `null` (`porContas` orders the row to
  // MINIMIZE CROSSING of a crossing, #12, not to group by OU, and the same OU
  // can end up spread across non-contiguous positions). The clause is here to
  // NAME the decision: the OU band is a CONTRAST dimension between columns
  // (S3), and the integration view has no per-OU column — it has a single
  // row, ordered by the crossing, which is its subject. `generate.cjs` knows
  // the same rule and adjusts the warning so it doesn't announce a band this
  // block doesn't emit.
  if (d.ou.draw && g.modo !== 'integracao') {
    for (const col of g.colunas) {
      if (!col.ou) continue;
      const band = d.faixasOu.find(f => f.members.includes(col.accounts[0]));
      layoutPlan.cells.push({
        kind: 'vertice', id: band ? band.id : `ou-${col.ou}`, parent: cloudId || '1',
        label: `OU – ${col.ou}`, style: S_OU(res),
        geo: {
          x: (cloudId ? f.PAD : baseX) + col.x, y: (cloudId ? f.PAD + 34 : baseY) + 8,
          w: Math.max(140, res.textWidth(`OU – ${col.ou}`) + 16), h: 24,
        },
      });
    }
  }

  // 4. the accounts and everything inside them
  for (const account of g.order) {
    const p = g.pos.get(account.id);
    const ax = baseX + p.x, ay = baseY + p.y;
    abs.set(account.id, { x: ax, y: ay, w: p.w, h: p.h });
    const meta = g.boxes.get(account.id);

    // `X6`: the hub account gets a border emphasis. Hub = the one that
    // participates in the most crossings — and it's only worth marking if it
    // truly stands out.
    const style = meta.style + (account.id === g.hub ? 'strokeWidth=2.6;fontStyle=1;' : '');
    layoutPlan.cells.push({
      kind: 'vertice', id: account.id, parent: cloudId || '1', label: account.label || '', style,
      geo: { x: ax - (cloudId ? abs.get(cloudId).x : 0), y: ay - (cloudId ? abs.get(cloudId).y : 0), w: p.w, h: p.h },
    });

    (function tier(no, parentId, parentAbs) {
      for (const c of no.children || []) {
        const m = g.boxes.get(c.id);
        const modelNode = d.t.byId.get(c.id);
        const a = { x: parentAbs.x + c.x, y: parentAbs.y + c.y, w: c.width, h: c.height };
        abs.set(c.id, a);
        layoutPlan.cells.push({
          kind: 'vertice', id: c.id, parent: parentId,
          label: m.container ? (modelNode.label || '') : m.label,
          style: m.style,
          geo: { x: c.x, y: c.y, w: c.width, h: c.height },
        });
        if (c.children && c.children.length) tier(c, c.id, a);
      }
    })(g.interno.get(account.id), account.id, { x: ax, y: ay });

    // edges INTERNAL to the account, converted to absolute space (#2 §5.2: one
    // coordinate system only)
    for (const e of g.interno.get(account.id).edges || []) {
      const a = d.edges.find(x => x.id === e.id);
      const sec = (e.sections || [])[0];
      if (!a || !sec) continue;
      const shift = toPage({ x: ax, y: ay });
      const anc = {
        output: anchor(abs.get(a.from), shift(sec.startPoint)),
        input: anchor(abs.get(a.to), shift(sec.endPoint)),
      };
      layoutPlan.cells.push({
        kind: 'edge', id: e.id, parent: '1', from: a.from, to: a.to,
        label: edgeLabel(a), style: edgeStyle(a, anc, res.tema),
        points: (sec.bendPoints || []).map(shift),
      });
    }
  }

  // 5. the crossing, by whichever mechanism the policy chose — and what comes in from outside
  g.reservaEsq = leftReserve;
  crossingsInPlan(layoutPlan, model, d, res, g, abs, opts);
  outsideEdges(layoutPlan, d, res, g, abs, opts);

  // 6. permission enablers (E9): short arrow into whoever they authorize
  for (const h of d.habilitadores) {
    if (!abs.has(h.id) || !abs.has(h.target)) continue;
    layoutPlan.cells.push({
      kind: 'edge', id: `hab-${h.id}`, parent: '1', from: h.id, to: h.target,
      label: '', style: S_ENABLES(res), points: [],
    });
  }

  // 7. notes attached to a node
  attachedNotes(layoutPlan, model, abs, p);

  const background = mo.topo + (cloud ? cloudHeight : g.altura + bottomReserve) + f.PAD;
  const widthOf = Math.max(baseX + g.widthOf + mo.x, 900);
  const end = footer(layoutPlan, model, widthOf - 2 * mo.x, res, background);
  layoutPlan.width = widthOf;
  layoutPlan.height = end + mo.rodape;
  layoutPlan.cells.push(modelCell(model, res));
  return layoutPlan;
}

/**
 * A NODE'S KINFOLK: itself, its ancestors and its descendants.
 *
 * It's the set that NEVER counts as an obstacle for an edge that leaves it.
 * Crossing your own VPC to leave it isn't crossing someone else's boundary —
 * it's the only way out —, and `A5.5` says so in its own definition: spurious
 * is a boundary the edge neither leaves from nor goes to.
 *
 * It used to be written three times under different names until #24 merged
 * them. The third copy (`outsideEdges`'s) excluded ONLY the two endpoints, and
 * because of that would have pushed outside the cloud an edge whose
 * destination lives inside it.
 */
function relatives(d, ids) {
  const mine = new Set();
  for (const id of ids) {
    const no = d.t.byId.get(id);
    if (!no) continue;
    mine.add(id);
    for (const a of d.t.ancestrais(no)) mine.add(a.id);
    (function desc(x) { for (const k of d.t.filhos.get(x)) { mine.add(k.id); desc(k.id); } })(id);
  }
  return mine;
}

/**
 * Which side a node can leave from without passing over something that isn't
 * its own.
 *
 * `E8` says the account's border is crossed without ceremony — but it talks
 * about the borders of whoever CONTAINS the node. Crossing a SIBLING's box is
 * something else: it's `A5.5` of the rubric (#8), an edge cutting through a
 * band that isn't its own, and it's what showed up in the second render — the
 * crossing left the Transit Gateway downward and went down through the
 * inspection VPC, the Inspection subnet and the Network Firewall, none of
 * which have anything to do with that link.
 *
 * The rule: an obstacle is any drawn box that is NEITHER an ancestor NOR a
 * descendant of the node. If it falls in the node's horizontal band between it
 * and the border, that side is dirty. Prefer the side that points toward the
 * destination, but only if it's clean.
 */
function freeSide(no, targetAbs, accountAbs, abs, d, noId) {
  const mine = relatives(d, [noId]);

  const crosses = (x1, x2) => {
    for (const [id, b] of abs) {
      if (mine.has(id) || id === accountAbs.id) continue;
      const insideAccount = b.x >= accountAbs.x - 1 && b.x + b.w <= accountAbs.x + accountAbs.w + 1;
      if (!insideAccount) continue;
      const band = b.y < no.y + no.h && b.y + b.h > no.y;         // overlaps the node's band
      if (band && b.x < x2 && b.x + b.w > x1) return true;
    }
    return false;
  };

  const leftClean = !crosses(accountAbs.x, no.x);
  const rightClean = !crosses(no.x + no.w, accountAbs.x + accountAbs.w);
  const prefersLeft = targetAbs && targetAbs.x + targetAbs.w / 2 < no.x;

  if (prefersLeft && leftClean) return { side: 'left', clean: true };
  if (!prefersLeft && rightClean) return { side: 'right', clean: true };
  if (leftClean) return { side: 'left', clean: true };
  if (rightClean) return { side: 'right', clean: true };
  /**
   * NO CLEAN SIDE — and until #24 this used to come back silent.
   *
   * The previous version returned "the lesser evil is the short one" and
   * moved on, so the crossing came out cutting through a sibling with nothing
   * in the engine knowing it. That's how `a-confia` (Lambda → cross-account
   * role) came out passing through the VPC endpoint: both sides were taken,
   * the router picked the left one, and `A3.5` charged for it. Now it SAYS it
   * got dirty, and whoever calls it gets the chance to leave through the
   * other axis — which is what `X3`'s channel always knew how to do.
   */
  return { side: prefersLeft ? 'left' : 'right', clean: false };
}

/**
 * The VERTICAL leg on the way out: from the node to the channel, without
 * puncturing a sibling.
 *
 * It's the alternative when `freeSide` comes back dirty on both sides. #12
 * wrote that "leaving vertically was the short path and it was the wrong one"
 * — and it was right as a RULE, not as a law: going down is wrong when there's
 * a sibling below, and it's the only clean path when both sides are taken and
 * the gap below isn't. What decides is the measurement, not the preference.
 */
function verticalClear(no, y, abs, d, noId) {
  const mine = relatives(d, [noId]);
  const lo = Math.min(y, no.y + no.h / 2), hi = Math.max(y, no.y + no.h / 2);
  const cx = no.x + no.w / 2;
  for (const [id, b] of abs) {
    if (mine.has(id)) continue;
    if (b.x < cx && b.x + b.w > cx && b.y < hi && b.y + b.h > lo) return false;
  }
  return true;
}

/**
 * The account-boundary crossing — the core of #12's question.
 *
 * Each `level` here is one of the rungs of #6 §6.4's fallback hierarchy, and
 * the choice between them was already made in `derive.cjs`'s
 * `politicaDeTravessia`. This module only draws what was chosen.
 *
 * What's NOT here is also a decision: no ceremony at the account border. `E8`
 * measured, across every pattern in §3, that "the line simply passes over the
 * magenta border — there's no AWS convention for a port, gateway, diamond or
 * crossing marker". So no `jumpStyle` at the boundary: what marks the
 * crossing is WHERE the permission enabler is (`E9`), not the line.
 */
function crossingsInPlan(layoutPlan, model, d, res, g, abs, opts) {
  const pol = d.policy;
  if (pol.mecanismo === 'suprimir') return;

  const cellBox = id => abs.get(id);
  const accountOfNode = id => {
    const n = d.t.byId.get(id);
    const c = n && (n.kind === 'account' ? n : d.t.ancestrais(n).find(a => a.kind === 'account'));
    return c ? c.id : null;
  };

  if (pol.mecanismo === 'bus') {
    // `E4` + `X3`: ONE line parallel to the row, offset outside it, with
    // short perpendicular stubs entering each account. 1 line + N stubs,
    // never N lines — it's literally the AMS MALZ drawing.
    const y = Math.max(...g.order.map(c => cellBox(c.id).y + cellBox(c.id).h)) + 46;
    for (const group of pol.grupos) {
      const targets = group.accounts.map(id => cellBox(id)).filter(Boolean);
      if (targets.length < 2) continue;
      const x1 = Math.min(...targets.map(a => a.x + a.w / 2));
      const x2 = Math.max(...targets.map(a => a.x + a.w / 2));
      const origin = cellBox(group.from);
      layoutPlan.cells.push({
        kind: 'edge', id: `bus-${group.from}`, parent: '1', from: null, to: null,
        label: '', style: S_BUS(res),
        points: [{ x: x1, y }, { x: x2, y }],
        loose: { x1, y1: y, x2, y2: y },
      });
      // the stub that drops from the origin down to the bus
      if (origin)
        layoutPlan.cells.push({
          kind: 'edge', id: `bus-tronco-${group.from}`, parent: '1', from: group.from, to: null,
          label: '', style: S_BUS(res),
          points: [{ x: origin.x + origin.w / 2, y: origin.y + origin.h },
                   { x: origin.x + origin.w / 2, y }],
          loose: { x1: origin.x + origin.w / 2, y1: origin.y + origin.h, x2: origin.x + origin.w / 2, y2: y },
        });
      for (const id of group.accounts) {
        const a = cellBox(id);
        const cx = a.x + a.w / 2;
        const crossing = d.travessias.find(t => t.from === group.from && t.contaPara === id);
        layoutPlan.cells.push({
          kind: 'edge', id: `stub-${id}`, parent: '1', from: null, to: id,
          label: crossing ? edgeLabel(crossing) : '', style: S_STUB(res),
          points: [{ x: cx, y }, { x: cx, y: a.y + a.h }],
          loose: { x1: cx, y1: y, x2: cx, y2: a.y + a.h },
        });
      }
    }
    g.barramentoAlt = 70;
    return;
  }

  if (pol.mecanismo === 'agregada') {
    // `E3`: fan-in from N accounts collapses into ONE edge entering the
    // destination's box from outside, with the TEXT carrying the cardinality
    // — never N edges. It's what the SRA does at the Log Archive ("From
    // CloudTrail organization trail").
    for (const group of pol.grupos) {
      const target = cellBox(group.to);
      if (!target) continue;
      const targetAccount = accountOfNode(group.to);
      const cTarget = cellBox(targetAccount);
      const example = d.travessias.find(t => t.to === group.to);
      const text = `${example && example.label ? example.label : 'from'} · ${group.accounts.length} accounts`;
      const x0 = (cTarget ? cTarget.x : target.x) - (g.reservaEsq || 90);
      layoutPlan.cells.push({
        kind: 'edge', id: `fanin-${group.to}`, parent: '1', from: null, to: group.to,
        label: text, style: S_STUB(res),
        points: [{ x: x0, y: target.y + target.h / 2 }],
        loose: { x1: x0, y1: target.y + target.h / 2, x2: target.x, y2: target.y + target.h / 2 },
      });
    }
    return;
  }

  // `E10`/level 6: direct edge. The routing belongs to the ENGINE, not to
  // ELK, because it's the engine that knows where the channel is — and that's
  // what keeps it from turning to spaghetti: every crossing goes down the
  // SAME channel, instead of each one finding its own path.
  //
  // But "direct" is only direct when the accounts are neighbors AND the
  // direction matches the axis. When it doesn't, the straight line crosses
  // the INTERIOR of the origin account — in the first render, the ECS→Transit
  // Gateway crossing cut through the whole VPC and dropped the "VPC
  // attachment" label on top of the ALB icon, which is `A3.2` of the rubric
  // (#8) and `A5.5` at the same time.
  //
  // The way out isn't invented: it's `X3`. The dedicated channel is a band
  // PARALLEL to the row of accounts, OFFSET OUTSIDE it, with short
  // perpendicular stubs entering each account's border. What #6 measured for
  // "N siblings receive the same link" serves just as well for "this crossing
  // doesn't fit the axis": pulling the line out from inside the boxes is the
  // point of both.
  const orderIdx = new Map(g.order.map((c, i) => [c.id, i]));
  const rowBackground = Math.max(...g.order.map(c => cellBox(c.id).y + cellBox(c.id).h));
  let channelLane = 0;

  for (const t of d.travessias) {
    const o = cellBox(t.from), dst = cellBox(t.to);
    if (!o || !dst) continue;
    const ia = orderIdx.get(t.contaDe), ib = orderIdx.get(t.contaPara);
    const adjacentForward = ib === ia + 1;

    if (adjacentForward) {
      const cA = cellBox(t.contaDe), cB = cellBox(t.contaPara);
      const laneX = (cA.x + cA.w + cB.x) / 2;
      const y0 = o.y + o.h / 2, y1 = dst.y + dst.h / 2;
      layoutPlan.cells.push({
        kind: 'edge', id: t.id, parent: '1', from: t.from, to: t.to,
        label: edgeLabel(t),
        style: edgeStyle(t, { output: { x: 1, y: 0.5 }, input: { x: 0, y: 0.5 } }, res.tema),
        points: y0 === y1 ? [] : [{ x: laneX, y: y0 }, { x: laneX, y: y1 }],
      });
      continue;
    }

    // Outer channel (`X3`): leaves the node HORIZONTALLY, on the clean side,
    // to the lane between the accounts; goes down the lane; runs below the
    // row; goes up the other lane; enters horizontally. Leaving vertically was
    // the short path and it was the wrong one — the line went down through
    // the sibling boxes.
    channelLane += 1;
    const laneY = rowBackground + 40 + (channelLane - 1) * 34;
    const cA = { ...cellBox(t.contaDe), id: t.contaDe };
    const cB = { ...cellBox(t.contaPara), id: t.contaPara };
    const sideO = freeSide(o, dst, cA, abs, d, t.from);
    const sideD = freeSide(dst, o, cB, abs, d, t.to);
    // when both sides are dirty, dropping straight to the channel is the
    // clean path — see `verticalClear`
    const downO = !sideO.clean && verticalClear(o, laneY, abs, d, t.from);
    const downD = !sideD.clean && verticalClear(dst, laneY, abs, d, t.to);
    const xo = downO ? o.x + o.w / 2
      : sideO.side === 'left' ? cA.x - g.LANE / 2 : cA.x + cA.w + g.LANE / 2;
    const xd = downD ? dst.x + dst.w / 2
      : sideD.side === 'left' ? cB.x - g.LANE / 2 : cB.x + cB.w + g.LANE / 2;
    const yo = downO ? (o.y + o.h) : o.y + o.h / 2;
    const yd = downD ? (dst.y + dst.h) : dst.y + dst.h / 2;
    /**
     * WHEN BOTH ENDS PICK THE SAME LANE, THE CHANNEL DOESN'T EXIST.
     *
     * Between two neighboring accounts with a `LANE`-wide gap, leaving from
     * the right of one and the left of the other gives exactly the same `x` —
     * and the route `go down to the channel, walk zero, come back up` draws a
     * piece of line going down and REDRAWS it going up right on top of
     * itself. In #24's render this showed up as a stub hanging below "8.
     * sweeps the cured prefix", with the label floating in the middle of it:
     * the label sits in the middle of the polyline, and half the polyline
     * went nowhere.
     *
     * No check caught it — the line crosses nothing, overlaps nothing, and
     * measures fine across all 62. It was the EYE. It's the half of #17 the
     * suite doesn't replace, and the reason #14 failed a human inspection with
     * a green suite.
     */
    const sameLane = Math.abs(xo - xd) < 0.5 && !downO && !downD;
    layoutPlan.cells.push({
      kind: 'edge', id: t.id, parent: '1', from: t.from, to: t.to,
      label: edgeLabel(t),
      style: edgeStyle(t, {
        output: downO ? { x: 0.5, y: 1 } : { x: sideO.side === 'left' ? 0 : 1, y: 0.5 },
        input: downD ? { x: 0.5, y: 1 } : { x: sideD.side === 'left' ? 0 : 1, y: 0.5 },
      }, res.tema),
      points: sameLane
        ? [{ x: xo, y: yo }, { x: xo, y: yd }]
        : [{ x: xo, y: yo }, { x: xo, y: laneY }, { x: xd, y: laneY }, { x: xd, y: yd }],
    });
    if (sameLane) channelLane -= 1;   // the reserved lane went unused
  }
  if (channelLane) g.canaletaAlt = 40 + channelLane * 34;
}

/**
 * Edges entering the drawing from outside any account — the actor, the
 * client, the internet.
 *
 * They aren't an account crossing (they don't have an account on both sides),
 * so #6 §6.4's policy doesn't speak of them; and they aren't internal to any
 * account, so that account's ELK never saw them. They were left ownerless in
 * the first version and DISAPPEARED from the drawing — the client's "1.
 * HTTPS" edge to the ALB simply didn't exist in the render, which is a silent
 * omission, `A4.2`.
 */
function outsideEdges(layoutPlan, d, res, g, abs, opts) {
  const accountOfNode = id => {
    const n = d.t.byId.get(id);
    if (!n) return null;
    const c = n.kind === 'account' ? n : d.t.ancestrais(n).find(a => a.kind === 'account');
    return c ? c.id : null;
  };
  const orderIdx = new Map(g.order.map((c, i) => [c.id, i]));
  const rowTop = Math.min(...g.order.map(c => abs.get(c.id).y));
  let topLane = 0;

  for (const a of d.edges) {
    const ca = accountOfNode(a.from), cb = accountOfNode(a.to);
    if (ca && cb) continue;            // intra-account or crossing: already drawn
    const o = abs.get(a.from), dst = abs.get(a.to);
    if (!o || !dst) continue;

    // An entry coming from outside is only straight when the destination
    // account is the row's first. If it isn't, the straight line crosses the
    // earlier accounts — in the second render, the client's "1. HTTPS" cut
    // through the whole Network account and dropped the label on top of the
    // inspection VPC's title.
    const targetAccount = cb || ca;
    const idx = orderIdx.get(targetAccount);
    const straight = idx === undefined || idx === 0;
    const y0 = o.y + o.h / 2, y1 = dst.y + dst.h / 2;

    if (straight) {
      const mid = (o.x + o.w + dst.x) / 2;
      layoutPlan.cells.push({
        kind: 'edge', id: a.id, parent: '1', from: a.from, to: a.to,
        label: edgeLabel(a),
        style: edgeStyle(a, { output: { x: 1, y: 0.5 }, input: { x: 0, y: 0.5 } }, res.tema),
        points: y0 === y1 ? [] : [{ x: mid, y: y0 }, { x: mid, y: y1 }],
      });
      continue;
    }

    // channel ABOVE — the top's mirror. The one below carries crossings
    // between accounts; this one carries what comes in from outside and would
    // have to punch through someone else's account to arrive. Two lanes, one
    // on each side of the row, and no line inside a box that isn't its own.
    topLane += 1;
    const laneY = rowTop - 26 - (topLane - 1) * 30;

    // the bars this detour's leg CANNOT cross at all — every node that is
    // neither ancestor nor descendant of the edge's own two ends. Moved to
    // before the drop (#32): the drop near the outsider needs the same sweep
    // that used to serve only the rise.
    const mine = relatives(d, [a.from, a.to]);
    const bars = [...abs].filter(([id]) => !mine.has(id)).map(([, b]) => boxOnX(b));

    /**
     * THE DROP'S REFERENCE is WHO `dst` REALLY IS — not always `targetAccount`
     * (#32).
     *
     * When it's the account that enters the scene from outside (`client → ALB`
     * in an account that isn't the first), `dst` lives inside `targetAccount`,
     * and the two coincide: dropping close to the account's border lands
     * close to `dst` itself, and `freeSide` measures a real band — the
     * account's — looking for a sibling that isn't `dst`'s.
     *
     * But when it's the ACTOR on `dst`'s side (a middle account sending
     * outward, #32), `targetAccount` is the ORIGIN account — `dst` doesn't
     * live in it, and anchoring there measures a boundary that isn't its own:
     * the drop lands close to the origin account and the rest of the line,
     * invisible to this code, crosses whoever sits between it and the actor.
     * And `freeSide` doesn't work here either, called on `dst`'s own box: with
     * no SECOND box to compare against, the band it measures collapses to a
     * point and the search becomes a facade. The outsider always sits to the
     * left of the whole row (#5 O19) — the preference is the midpoint of the
     * gap up to the first account, but SWEPT by `corredorLivre` against the
     * same bars as the rise, not taken for granted: it's the same lever as
     * #24, just on the other side of the channel.
     */
    const dstIsOutsider = !cb;
    let xd, entersFromTheRight;
    if (dstIsOutsider) {
      const firstAccount = abs.get(g.order[0].id);
      const prefDst = (dst.x + dst.w + firstAccount.x) / 2;
      xd = dispor.corredorLivre([laneY, y1], bars, prefDst, g.LANE / 2);
      entersFromTheRight = xd >= dst.x + dst.w / 2;
    } else {
      const cB = { ...abs.get(targetAccount), id: targetAccount };
      const sideD = freeSide(dst, o, cB, abs, d, a.to);
      xd = sideD.side === 'left' ? cB.x - g.LANE / 2 : cB.x + cB.w + g.LANE / 2;
      entersFromTheRight = sideD.side !== 'left';
    }

    /**
     * THE RISE LEAVES FROM THE SIDE, AND THROUGH A GAP — two things, and both
     * measured.
     *
     * The previous version rose from the node's CENTER straight to the top
     * channel. The node's center is exactly where a neighbor lives when the
     * actors are stacked: in #14's technical view "Diretoria" rose through
     * "Lojas (300)", `A3.5` and `A3.4` at once. Leaving from the side is the
     * same inversion #12 had already made in the bottom channel, and it's what
     * pays off both checks.
     *
     * `corredorLivre` is the second half, and it's worth saying what it
     * measures HERE so nobody mistakes it for the fix: the preference is the
     * node's own border, and in today's corpus it's never blocked — **it
     * returns the preference untouched on every call along this path, and
     * what paid off `A3.5`/`A3.4` was leaving from the side.** It stays
     * because the preference CAN be blocked: two actors side by side in the
     * same lane put one of them on top of the other's leg, and then the gap is
     * really searched for. A guard, not a facade — and measuring the
     * difference between the two is what keeps a comment from promising more
     * than the code does.
     *
     * Trying the preference one lane away from the border was measured and is
     * WORSE: it pushes the leg to `x=140` and it starts crossing the edge
     * entering the first account — `A5.1` goes from 1 to 2. Right against the
     * border crosses nobody, and that's what the rubric prefers.
     */
    const right = xd >= o.x + o.w / 2;
    const xUp = dispor.corredorLivre([laneY, y0], bars, right ? o.x + o.w : o.x, g.LANE / 2);
    // the exit side comes from the CHOSEN corridor, not the desired one: if
    // the free gap ended up on the other side, leaving from the desired side
    // would send the leg back through the node itself
    const exitsFromTheRight = xUp >= o.x + o.w / 2;
    const xOutput = exitsFromTheRight ? o.x + o.w : o.x;

    layoutPlan.cells.push({
      kind: 'edge', id: a.id, parent: '1', from: a.from, to: a.to,
      label: edgeLabel(a),
      style: edgeStyle(a, {
        output: { x: exitsFromTheRight ? 1 : 0, y: 0.5 },
        input: { x: entersFromTheRight ? 1 : 0, y: 0.5 },
      }, res.tema),
      // the bend at `y0` only exists when the corridor LEFT the border: without
      // it, it coincides with the tip and becomes a zero-length segment, which
      // counts as a bend in `A5.3` and draws nothing
      points: [
        ...(Math.abs(xUp - xOutput) < 0.5 ? [] : [{ x: xUp, y: y0 }]),
        { x: xUp, y: laneY }, { x: xd, y: laneY }, { x: xd, y: y1 },
      ],
    });
  }
  if (topLane) g.canaletaTopo = 26 + topLane * 30;
}

module.exports = { elkPlan, gridPlan, accountPlan, paint, frame };
