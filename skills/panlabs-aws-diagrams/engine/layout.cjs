'use strict';
/**
 * Layout — the only place in the engine where a position number is born.
 *
 * Two paths, and the model chooses, not the agent:
 *
 *   A · ELK runs everything.  Without an AZ band, `elkjs` lays out the whole
 *       hierarchy in one pass. `shapeCoords: PARENT` returns a coordinate
 *       already relative to the parent — the exact semantics of `mxGeometry`
 *       (#7).
 *
 *   B · the engine runs the grid.  With an AZ band, the subnets of the same
 *       zone need to line up ACROSS VPCs for the band to read as a column, and
 *       ELK laying out each VPC in isolation doesn't guarantee that (#19). So
 *       the engine keeps the columns' `x` and ELK keeps the content INSIDE
 *       each cell.
 *
 * Path B's price is exactly what #19 measured: four lane constants. It isn't
 * a new engine.
 */

const ELK = require('./vendor/elk.bundled.js');
const { align } = require('./align.cjs');
const layersMod = require('./layers.cjs');
const { CONTAINERS, LEAVES } = require('./validate.cjs');

// ---- #19's four lanes ---------------------------------------------------
//
// WARNING: A LANE ISN'T A GAP, and the theme's density (#13) doesn't touch
// them.
//
// A gap is breathing room: the space between two nodes, a container's
// padding. Shrinking it tightens the drawing and nothing else. A lane is a
// LABEL RESERVE — derived from font metrics and from the style's own
// `spacingTop` (#11 finding 6). Shrinking a lane doesn't tighten: it drops
// text on top of a border. That's why density multiplies `folgas()` and never
// a lane constant.
const AZ_LANE = 36;    // label row for AZ columns
const BAND_LANE = 24;  // floor for a member band's label — see calhaDaFaixa
const CROSS_OUT = 24;  // overflow that makes the crossing VISIBLE
const HEAD = 34;       // title band of any container — recursive (#2 §3.2)

/**
 * The fifth lane, and it's #12's: the row where the OU's label lives.
 *
 * It comes from the same measurement as the others: in the SRA's PPTX the OU
 * icon is 0.50" tall and the first member account starts ≈0.12" below it (#6
 * §1.4/§2.2). With this engine's account boxes running 250–550 px wide against
 * the SRA's 2.5–4", the scale is ≈100 px per inch, so 0.50" + 0.12" ≈ 62.
 *
 * It's a sibling of `AZ_LANE` and exists for the same reason: the band is
 * drawn OUTSIDE the tree, so nobody reserves space for its label except the
 * engine.
 */
const OU_LANE = 62;

/**
 * The box of an EMPTY container — and it exists because #22 tripped over it.
 *
 * A container is whoever the SCHEMA says is a container, not whoever has a
 * child. Both ELK paths used to decide by `kids.length`, and an empty subnet
 * fell into the leaf branch: the engine died in `res.leaf()` with "node with
 * no service key" — a message that talks about a service to whoever wrote a
 * subnet. The grid path never had the problem, because there an empty
 * container already got a minimum box (200×90); it was only ELK.
 *
 * An empty subnet isn't a model error: it's the range reserved for what
 * doesn't exist yet, and a network diagram draws it.
 */
const EMPTY_W = 200;
const EMPTY_H = 56;

/**
 * The box of a container with no child — a single definition, for both
 * `paraElk`s.
 *
 * The width already comes out with the title measured, because the
 * `deficitDeTitulo` pass buys slack through `padding.right`, and padding
 * doesn't widen a node with no content to push against the border.
 */
function emptyBox(no, c, res) {
  const needsTitle = res.larguraDoRotuloDeGrupo(no.label || '') + (c.titleIndent || 8) + 16;
  return {
    id: no.id,
    width: Math.max(EMPTY_W, Math.ceil(needsTitle)),
    height: c.titleH + EMPTY_H,
  };
}

/**
 * And the sixth: a zone SWIMLANE's label strip.
 *
 * With the AZ in a column, every zone's label sits in a single strip above the
 * grid — that's `AZ_LANE`. Transposed, each swimlane needs its own strip,
 * because the label is drawn at the band's top-left corner and there's one
 * band per row. So the reserve stops being global and starts living in the
 * gap BETWEEN swimlanes. 26 px is comfortably what a 12 px label takes.
 */
const SWIMLANE_LANE = 26;

/**
 * `BAND_LANE` can't be a constant — discovered when the engine was wired to
 * the catalog.
 *
 * #19 calibrated 24 px against a hand-written band style. The REAL Auto
 * Scaling group style in the catalog (#17) is `groupCenter` with
 * `spacingTop=25`: the label is drawn 25 px below the box's top, to fit the
 * icon that shape puts there. With a 24 px lane, the band's label lands
 * exactly on the title line of the subnet it crosses.
 *
 * So the lane is read from the style — whoever knows where the label will
 * land is the shape, not a constant of ours.
 */
function calhaDaFaixa(style) {
  const m = /(?:^|;)spacingTop=(-?\d+)/.exec(style || '');
  const indent = m ? Number(m[1]) : 0;
  return Math.max(BAND_LANE, indent + 18 + 6);
}

// #11's values, kept as a historical reference of the previous scale. None of
// them is read: `folgas(theme)` is what governs it now.
//   PAD 12 · COL_GAP 30 · ROW_GAP 14 · nodeNode 30 · betweenLayers 46
//
// WARNING: and it's because of this line that `web-multi-az` stopped coming
// out byte-for-byte identical to #11/#12's: the scale moved from "numbers
// arrived at one by one" to "multiples of 8".

/**
 * The gap scale, derived from the theme's base grid (#13).
 *
 * #11's values above stay what they were — numbers with no common
 * denominator, arrived at one by one. The house layer re-anchors them on a
 * base-8 scale, and 8 isn't taste: the service icon is 48 px and the group
 * icon 40 px (A9/A6 in #5, locked in the preset), both multiples of 8, and the
 * minimum gap between nested groups (N7: 0.05") is 4.8 px, whose next step up
 * is 8.
 *
 * There's no path with no theme. #13's prototype's first version carried a
 * factory branch to "keep #11 running identically", and it **did not keep
 * it**: a `+10` literal became `+PAD` and `web-multi-az` came out 6 px taller
 * with nobody noticing. Compatibility nobody exercises isn't compatibility,
 * it's weight.
 */
function folgas(tema) {
  const g = tema.g;
  return {
    PAD: g(1), COL_GAP: g(4), ROW_GAP: g(2),
    nodeNode: g(4), entreCamadas: g(6), edgeNode: g(3), edgeEdge: g(2), edgeLabel: g(1),
  };
}

/**
 * #5's `O1` is the strongest observed trend in the corpus — 17 of 24 official
 * diagrams run left→right. `RIGHT` also steers clear of #7's bug, where
 * `nodeSize.minimum` swaps axes on a compound node under `DOWN`/`UP`.
 */
/**
 * WARNING: A SPACING OPTION DOESN'T DESCEND INTO A CONTAINER.
 *
 * Found by measuring, and it's this module's most expensive trap: with
 * `hierarchyHandling: INCLUDE_CHILDREN` the documentation implies the whole
 * graph is laid out in one pass — but spacing options are read **per
 * container**, not inherited from the root. Setting them only at the root
 * isn't a silent typo: it's INERT configuration. What applies inside is ELK's
 * default (`nodeNode` = 20).
 *
 * Proof: with the options only at the root, `spacing.nodeNode` of 38, 50 or 90
 * all produce exactly the same geometry — a 20 px gap, the default. Repeated
 * per container, the gap starts obeying the requested value. Same for
 * `nodePlacement.strategy`, which was inert at the root and changes the
 * drawing when repeated.
 *
 * That's why `spacingOf()` exists and why every container gets the whole
 * block. Whoever adds a spacing option here needs to add it in `spacingOf`
 * too, never only in ROOT_OPTIONS.
 */
/**
 * WARNING: WHOEVER ADDS A SPACING OPTION touches TWO places: `folgas()`, which
 * gives the value, and here, which gives ELK's name for it. Two halves of the
 * same decision — and the warning above about ROOT_OPTIONS still holds,
 * because the whole block has to be repeated per container.
 */
function spacingOf(fg) {
  return {
    'elk.spacing.nodeNode': String(fg.nodeNode),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(fg.entreCamadas),
    'elk.spacing.edgeNode': String(fg.edgeNode),
    'elk.spacing.edgeEdge': String(fg.edgeEdge),
    'elk.layered.spacing.edgeLabelSpacing': String(fg.edgeLabel),
    'elk.edgeLabels.placement': 'CENTER',
  };
}

const ROOT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',   // without this every container is laid out on its own
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.crossingMinimization.semiInteractive': 'true',
  'elk.randomSeed': '1',                          // 0 == the clock's seed
  'elk.json.shapeCoords': 'PARENT',               // == mxGeometry's semantics
  'elk.json.edgeCoords': 'ROOT',                  // the root's default is CONTAINER, not ROOT
};

/** The text the edge will actually show — the reserved width comes from it. */
function textoDaAresta(a) {
  const base = a.label || '';
  if (a.order === undefined) return base;
  return base ? `${a.order}. ${base}` : String(a.order);
}

/**
 * THE DIRECTION THE LAYOUT READS — the data, not the arrow.
 *
 * `from` in the schema is *whoever starts the conversation*, and that's a
 * modeling decision (rubric B3: the diagram has to answer who calls whom).
 * `data` exists exactly for the cases where whoever starts isn't where the
 * data flows from: polling is `from: consumer` with `data: "back"`.
 *
 * The LAYOUT wants the other question. #5's `O1` measured 17 of 24 official
 * diagrams with the primary flow left→right, and #6's `X5` repeats the rule
 * for the row of accounts. Whoever has to move right is the DATA.
 *
 * #14 left this written down as debt and #24 is its ticket: *"`data: back` is
 * semantic, but the layout orders by the arrow"*. Here the debt is paid — the
 * layout now orders by the data, and the ARROW keeps being drawn the way the
 * model said. They're two different questions, and now each one is answered
 * by the field that answers it.
 *
 * WARNING: `both` does NOT reverse: two directions don't elect one, and
 * flipping a coin would be a layout that changes on the generator's whim.
 */
function sentidoDeLeitura(a) {
  return a.data === 'back'
    ? { from: a.to, to: a.from, revertida: true }
    : { from: a.from, to: a.to, revertida: false };
}

/**
 * And the way back: ELK returns the edge in the direction it was given.
 *
 * Reversing on the way in and forgetting to reverse back on the way out would
 * trade one defect for a worse one — the arrow would point the wrong way,
 * which is all of `A2.x`, the drawing lying about who calls whom. So the
 * reversal is a closed pair: it goes in here, comes out here, and nothing
 * between `porElk` and `plan` needs to know it ever happened.
 *
 * Un-reversing means swapping the ends and flipping the bend list. The route
 * is the same — a polyline has no direction, only its reading does.
 */
function unrevert(output, revertidas) {
  if (!revertidas || !revertidas.size) return output;
  for (const e of output.edges || []) {
    if (!revertidas.has(e.id)) continue;
    [e.sources, e.targets] = [e.targets, e.sources];
    for (const sec of e.sections || []) {
      [sec.startPoint, sec.endPoint] = [sec.endPoint, sec.startPoint];
      if (sec.bendPoints) sec.bendPoints.reverse();
      // `incomingShape`/`outgoingShape` are ELK's symmetric pair; swapping one
      // without the other leaves the section describing an edge that doesn't exist
      if ('incomingShape' in sec || 'outgoingShape' in sec)
        [sec.incomingShape, sec.outgoingShape] = [sec.outgoingShape, sec.incomingShape];
    }
  }
  return output;
}

/**
 * THE FREE CORRIDOR — where a detour's perpendicular leg is allowed to pass.
 *
 * Every orthogonal detour in this engine has the same shape: it leaves the
 * origin along one axis, WALKS A STRETCH ON THE OTHER, and enters the
 * destination along the first one again. The stretch in the middle is a leg
 * that crosses a whole band of the drawing, and it's the one that cuts through
 * what it shouldn't.
 *
 * #21 already had the rule — *"an edge that skips a step detours along the
 * margin closest to the origin; detouring on the wrong side crosses exactly
 * the bands the detour existed to avoid"* — and the engine implemented it with
 * an account that knew no obstacle at all:
 *
 *     const mid = (o.x + o.w + dst.x) / 2;     // ← between the ICONS
 *
 * `o` and `dst` are the ICON's boxes, not the container's. On a 3×3 grid, the
 * midpoint between two icons in neighboring columns falls INSIDE one of the
 * columns, and the leg goes down through the middle row's subnet. That's how
 * `web-flow-3-az` racked up `A5.5` ×2: two EC2 recordings in different
 * swimlanes going down through the "app-a" group, which they neither leave
 * from nor go to. Measured, not guessed — the leg was at x=538 and "app-a"
 * went up to x=539.
 *
 * The right account isn't an average: it's searching for a GAP. The obstacles
 * the leg would cross are whichever ones overlap its band; what's left between
 * them are the corridors; and among the corridors the one closest to the
 * origin's side wins, which is #21's rule written in geometry instead of prose.
 *
 * WARNING: IT ALWAYS FINDS ONE, and that isn't optimism — it's geometry: the
 * obstacles are a FINITE set of boxes, so the two outer margins (`first −
 * margin` and `last + margin`) are free by construction. An earlier version
 * returned `{ where, free }` for the caller to propagate the failure;
 * `free: false` was unreachable, no caller read the field, and the header's
 * warning described a behavior that didn't exist. A contract nobody runs is an
 * intention — the field came out.
 *
 * What it does NOT promise is that the corridor stays BETWEEN the two ends:
 * when everything between them is taken, the leg goes outside. That's the
 * price of not lying about the path, and it's #21's choice (detour along the
 * margin) taken seriously.
 *
 * @param {[number,number]} band          the stretch of the OTHER axis the leg crosses
 * @param {Array<{ini,fim,lo,hi}>} obstacles  boxes: `ini..fim` on the leg's axis,
 *                                             `lo..hi` on the band's axis
 * @param {number} near             the coordinate the leg would like to have
 * @param {number} [margin]         how much to breathe when going outside everything
 * @returns {number} the leg's coordinate
 */
function corredorLivre(band, obstaculos, perto, margin = 24) {
  const lo = Math.min(band[0], band[1]);
  const hi = Math.max(band[0], band[1]);

  const blocking = obstaculos
    .filter(b => b.lo < hi && b.hi > lo)         // only whoever the leg would actually cross
    .map(b => [Math.min(b.ini, b.fim), Math.max(b.ini, b.fim)])
    .sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const [i, f] of blocking) {
    const u = merged[merged.length - 1];
    if (u && i <= u[1]) u[1] = Math.max(u[1], f);
    else merged.push([i, f]);
  }
  // touching the border isn't crossing it: a leg that runs FLUSH against the
  // box doesn't enter it, and that's exactly what a lane is
  const inside = c => merged.some(([i, f]) => c > i && c < f);
  if (!inside(perto)) return perto;

  // The candidates: the two outer margins and the middle of each gap. Since
  // the blockers already come merged, no two neighbors ever touch — every
  // gap's middle is strictly free, and that's why the search always ends with
  // an answer.
  const gaps = [merged[0][0] - margin];
  for (let k = 0; k + 1 < merged.length; k++) gaps.push((merged[k][1] + merged[k + 1][0]) / 2);
  gaps.push(merged[merged.length - 1][1] + margin);

  return gaps.reduce((a, b) => (Math.abs(b - perto) < Math.abs(a - perto) ? b : a));
}

/**
 * THE LEAF'S BOX GOES TO ELK WITH ITS DECLARED LABEL, AND IT STAYS OUTSIDE.
 *
 * A leaf's label is drawn OUTSIDE its box — centered below the icon.
 * `montarElk`'s (now `buildElkGraph`'s) header explains why the box can't be
 * inflated to fit the text: ELK routes to the CENTER, and an offset center
 * sends the arrow out from inside the letters.
 *
 * Until #24 the fix was for the engine to BUY the space from outside:
 * `spacing.nodeNode` got `rotuloMax` added and so did the container's
 * `padding.bottom`. That only separates NEIGHBORS and does nothing else — ELK's
 * edge router still didn't know text was there, and ran right over it. It was
 * `A3.4` (edge over label) and half of `A3.2` (label over label): in #14's
 * technical view, the edge "fires" cutting through the VPC endpoint's label,
 * on both pages where it appears.
 *
 * `elk.nodeLabels.placement = [H_CENTER,V_BOTTOM,OUTSIDE]` is the right lever
 * and it was always there: ELK reserves the label OUTSIDE the box, so the
 * center stays the icon's (the anchor doesn't move) and the router starts
 * steering around the text.
 *
 * WARNING: AND THE MANUAL RESERVE CAME OUT WITH IT — both together would pay
 * for the same space twice. Measured: with both, `landing-zone` comes out
 * 1903×997; with only ELK's, 1903×861 — 136 px shorter than with both, and 41
 * shorter than the 1864×902 from before any of this. The gain isn't only in
 * height: `A4.5` (uniform group padding) improves on six pages, because
 * whoever computes the padding now knows how big the content actually is.
 *
 * What did NOT come out: `rotuloMax` is still added to the band's footer and
 * to the page height in `plan.cjs`, and it's still right — the box the band
 * hugs is the ICON's, so the members' text still needs to fit below it.
 */
function folhaComRotulo(id, f) {
  return {
    id, width: f.boxW || f.shapeW, height: f.shapeH,
    labels: [{ id: `${id}-rot`, text: f.label || '', width: f.labelW || 0, height: f.labelH || 0 }],
    layoutOptions: { 'elk.nodeLabels.placement': '[H_CENTER,V_BOTTOM,OUTSIDE]' },
  };
}

/**
 * A NOTE ATTACHED TO A NODE IS A LAYOUT NODE — and before #24 it was nothing.
 *
 * The engine used to draw it AFTER everything else, at a fixed offset to the
 * subject's right:
 *
 *     geo: { x: a.x + a.w + 14, y: a.y, w: 190, h: 46 }     // ← a guess
 *
 * Nobody had reserved that space, so the box landed on top of whatever was
 * there. In #14's technical view the toll was: `A4.2` ×3 and `A4.4` ×1 — both
 * SEMANTIC, the note asserting it belongs to an account and a cloud it isn't a
 * member of —, plus `A3.5`, `A3.4` and `A3.2` because the edge nobody warned
 * about passed right through it. #14 had already seen the symptom with the
 * naked eye: *"a note attached to a node touches the container's border
 * (visible in both PNGs)"*.
 *
 * The fix is the same sentence #18 uses for everything: whoever has the
 * levers is whoever fixes it. Handing the note to ELK as a real node, all five
 * checks fall by CONSTRUCTION, not by patch — ELK doesn't overlap nodes,
 * doesn't pull a child out of its parent, and routes around what it knows
 * about. None of them needed to be aimed at.
 *
 * The parent is the SUBJECT's parent, and that's the semantic part: a note
 * about the cured zone lives inside the account the cured zone lives in. Then
 * what the drawing asserts and what the model declares become the same thing,
 * which is literally `A4.4`'s statement.
 */
const NOTE_W = 190;
const NOTE_MIN_H = 46;

/**
 * A note's id has ONE owner, and the reason is hard: `plan.cjs`'s
 * `attachedNotes` decides whether to draw it by `abs.has(id)`. If both sides
 * derived the id on their own and disagreed by one character, the note would
 * come out TWICE in the same drawing — once from the layout and once from the
 * rescue offset —, and the symptom would be one yellow box on top of another,
 * which none of the 62 calls an error.
 */
function idDaNota(n, i) { return n.id || `nota-${i}`; }

function notasPorPai(model, d, res, boxes) {
  const byParent = new Map();
  for (const [i, n] of (model.notes || []).entries()) {
    if (n.about === undefined) continue;
    const target = d.t.byId.get(n.about);
    if (!target) continue;                        // orphaned note — `validate.cjs` already complains about it
    const id = idDaNota(n, i);
    const lines = res.labelLines(n.text, NOTE_W - 16);
    const cellBox = {
      container: false, note: true, label: n.text, style: res.tema.note(),
      shapeW: NOTE_W, shapeH: Math.max(NOTE_MIN_H, 12 + lines * 16),
    };
    boxes.set(id, cellBox);
    const parent = target.inside || null;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push({ id, width: cellBox.shapeW, height: cellBox.shapeH });
  }
  return byParent;
}

/** GWT's `$H` leaks into the JSON and changes on every run without moving a single coordinate (#7). */
function clean(o) {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(o)) if (k !== '$H') r[k] = clean(v);
    return r;
  }
  return o;
}

// ------------------------------------------------------------------ path A

/**
 * The box ELK sees is the ICON's box, not the icon plus the label.
 *
 * The obvious path — inflating the height to fit the label — looks right and
 * is wrong: ELK routes to the box's CENTER, and a box inflated downward has
 * its center below the icon. The arrow would start coming out from inside the
 * text. So the box is the icon (center = icon's center, exact anchor) and the
 * label's space is bought where it's actually spent:
 *
 *   - vertically, through `spacing.nodeNode`, which separates neighbors in the
 *     same layer;
 *   - horizontally, by widening the box to the label's width, with the icon
 *     centered — that way the text's overflow stays INSIDE the box and no
 *     neighbor touches it;
 *   - at the container's foot, through `padding.bottom`.
 */
function buildElkGraph(model, d, res, measure) {
  const GAP = folgas(res.tema);
  const boxes = new Map();
  const paddings = new Map();     // the alignment pass needs to know each box's limit

  // pre-resolve the leaves to know how much label the layout needs to steer clear of
  let rotuloMax = 0, overflow = 0;
  for (const no of model.nodes) {
    // LEAF is the type, not "whoever has no child" — see `emptyBox`. Testing by
    // child count used to send every empty subnet to `res.leaf()`.
    if (!LEAVES.has(no.kind)) continue;
    const f = res.leaf(no);
    rotuloMax = Math.max(rotuloMax, f.labelH);
    // how much the text overflows each side of the icon — that's what needs to
    // fit in the gap between layers, since the layout's box is the icon's
    overflow = Math.max(overflow, Math.max(0, ((f.labelW || 0) - f.shapeW) / 2));
  }

  // The effective spacing depends on the label, and it needs to be IDENTICAL
  // at the root and in every container — see the ROOT_OPTIONS warning above.
  const spacing = {
    ...spacingOf(GAP),
    // the gap between neighbors is just breathing room: the label is reserved
    // by ELK, which now knows about it (`folhaComRotulo`). Adding `rotuloMax`
    // here would pay for the same space twice.
    'elk.spacing.nodeNode': String(GAP.ROW_GAP),
    // and the side neighbor has to fit the text's overflow on both sides
    'elk.layered.spacing.nodeNodeBetweenLayers': String(GAP.PAD + Math.ceil(2 * overflow)),
  };

  const notes = notasPorPai(model, d, res, boxes);
  const paraElk = (no) => {
    const kids = d.t.filhos.get(no.id);
    // a note attached to a child of this container is ITS child — see `notasPorPai`
    const myNotes = notes.get(no.id) || [];
    if (CONTAINERS.has(no.kind)) {
      const c = res.container(no);
      boxes.set(no.id, { container: true, ...c });
      if (!kids.length && !myNotes.length) return emptyBox(no, c, res);
      // a leaf's label overflows its box SIDEWAYS, and the container has to
      // reserve for it — the reserve at the BOTTOM is now ELK's
      // (`folhaComRotulo`). "has a leaf" is about TYPE, same as `emptyBox`.
      const hasLeaf = kids.some(k => LEAVES.has(k.kind));
      const gap = hasLeaf ? Math.ceil(overflow) : 0;
      const pad = {
        top: c.titleH + GAP.PAD, left: GAP.PAD + gap,
        bottom: GAP.PAD, right: GAP.PAD + gap + (measure.get(no.id) || 0),
      };
      paddings.set(no.id, pad);
      return {
        id: no.id,
        layoutOptions: {
          'elk.padding': `[top=${pad.top},left=${pad.left},bottom=${pad.bottom},right=${pad.right}]`,
          ...spacing,          // without this, the container uses ELK's defaults — see the warning above
        },
        children: [...kids.map(paraElk), ...myNotes],
      };
    }
    const f = res.leaf(no);
    boxes.set(no.id, { container: false, ...f });
    return folhaComRotulo(no.id, f);
  };

  const revertidas = new Set();
  const graph = {
    id: 'root',
    layoutOptions: { ...ROOT_OPTIONS, ...spacing },
    children: [...d.t.raizes.map(paraElk), ...(notes.get(null) || [])],
    // The edge's label travels WITH it. Without it, ELK pulls the nodes
    // together until the gap is smaller than the text, and the text lands on
    // top of the neighboring icon — which is `A3.2` of the rubric (#8), the
    // failure it predicts for an automatic generator. Handing over the label,
    // the gap gets computed to fit it.
    edges: d.edges.map(a => {
      const txt = textoDaAresta(a);
      // the LAYOUT reads the data (`sentidoDeLeitura`); the ARROW keeps being
      // the model's, and `unrevert` returns the edge to its own direction
      // before any consumer sees it
      const s = sentidoDeLeitura(a);
      if (s.revertida) revertidas.add(a.id);
      return {
        id: a.id, sources: [s.from], targets: [s.to],
        ...(txt ? { labels: [{ id: a.id + '-rot', text: txt, width: res.larguraDaAresta(txt) + 8, height: 14 }] } : {}),
      };
    }),
  };
  return { grafo: graph, boxes, paddings, rotuloMax, overflow, revertidas };
}

/**
 * The minimum width the title requires. The workaround #7 proposes — widening
 * the container AFTER the layout — can touch a sibling (uncertainty 7 there).
 * Here the slack goes in as `padding.right`, and ELK relayouts with it, so
 * siblings move apart on their own. Two passes, ~180 ms each in the worst
 * measured case.
 */
function deficitDeTitulo(no, cellBox, obtainedWidth, res) {
  if (!cellBox || !cellBox.container) return 0;
  const text = no.label || '';
  if (!text) return 0;
  // a group's label has its own body (`text.group`), which can differ from a leaf's
  const needed = res.larguraDoRotuloDeGrupo(text) + (cellBox.titleIndent || 8) + 16;
  return Math.max(0, Math.ceil(needed - obtainedWidth));
}

async function porElk(model, d, res) {
  const elk = new ELK();
  let measure = new Map();
  let output = null;

  for (let pass = 0; pass < 2; pass++) {
    const { grafo, boxes, paddings, rotuloMax, revertidas } = buildElkGraph(model, d, res, measure);
    output = unrevert(clean(await elk.layout(structuredClone(grafo))), revertidas);
    if (pass === 1) return { output, boxes, rotuloMax, passadas: 2, snap: align(output, paddings) };

    const next = new Map();
    (function measureTitles(n) {
      for (const c of n.children || []) {
        const no = d.t.byId.get(c.id);
        const def = deficitDeTitulo(no, boxes.get(c.id), c.width, res);
        if (def > 0) next.set(c.id, def);
        measureTitles(c);
      }
    })(output);
    if (!next.size) return { output, boxes, rotuloMax, passadas: 1, snap: align(output, paddings) };
    measure = next;
  }
}

// ------------------------------------------------------------------ path B

/**
 * The AZ grid, on BOTH axes — and the model chooses, not the agent.
 *
 * #11 wrote this grid with the AZ in COLUMNS, which was #19's prototype's
 * orientation. #21 closed it later and decided the opposite — but with a
 * condition that's easy to miss if you only read the headline:
 *
 *   > When BOTH dimensions are present, the ORDERED one takes the horizontal;
 *   > the parallel one becomes a swimlane stacked vertically. A numbered step
 *   > is ordered; a zonal replica is interchangeable — that's what
 *   > "redundancy" means. **With no numbered flow, the AZ can stay in the
 *   > column, like the deck.**
 *
 * So the inherited debt wasn't "transpose everything": it was "the engine has
 * to know both axes, and the choice is a rule". #21's ruler measured why — 24
 * realistic combinations, flow on the horizontal winning 24 of 24 WHEN there's
 * a numbered step, because then the ordered dimension has 5–11 positions and
 * the parallel one has 2–4, and the long dimension goes on the paper's long
 * side. With no numbered step the regime changes and the deck's column ties
 * again.
 *
 * The grid is written in ABSTRACT coordinates — `principal` (subnet roles, the
 * flow axis) and `transversal` (the zones) — and only at the end mapped to
 * (x,y). Transposing means swapping the mapping, not rewriting the grid. VPCs
 * stack along the PRINCIPAL axis, because the zone band crosses all of them
 * and runs in that direction.
 */
function eixoDaGrade(model) {
  const numbered = (model.edges || []).some(a => a.order !== undefined);
  return {
    eixo: numbered ? 'raia' : 'column',
    because: numbered
      ? 'there is a numbered step — the ordered dimension takes the horizontal (#21)'
      : 'no numbered step — the AZ stays in the column, like the deck (#21)',
  };
}

/**
 * Swimlane order — a SWEEP, not a heuristic.
 *
 * #21 measured the 6 permutations of 3 zones on both axes and found a ZERO
 * floor for `A5.5` in two of them; it also measured that the obvious heuristic
 * ("put the convergence target in the middle") only TRADES one crossing for
 * another. With 2 to 4 zones that's 2 to 24 permutations: sweeping is exact
 * and cheap.
 *
 * The cost is #21's: an edge between non-neighboring zones crosses whoever is
 * in the middle's band, which is `A5.5` of the rubric (#8).
 */
function ordemDeRaias(model, d, subnets) {
  const zonas = [...new Set(subnets.map(s => s.az).filter(Boolean))].sort();
  if (zonas.length < 3) return { zonas, custo: 0, varridas: 0 };

  const zoneOf = id => {
    const n = d.t.byId.get(id);
    if (!n) return null;
    const s = n.kind === 'subnet' ? n : d.t.ancestrais(n).find(a => a.kind === 'subnet');
    return s ? s.az : null;
  };
  const crossing = (model.edges || [])
    .map(a => [zoneOf(a.from), zoneOf(a.to)])
    .filter(([x, y]) => x && y && x !== y);
  if (!crossing.length) return { zonas, custo: 0, varridas: 0 };

  let best = null;
  const all = permute(zonas);
  for (const perm of all) {
    const idx = new Map(perm.map((z, i) => [z, i]));
    let cost = 0;
    for (const [x, y] of crossing) cost += Math.max(0, Math.abs(idx.get(x) - idx.get(y)) - 1);
    if (!best || cost < best.custo) best = { perm, custo: cost };
  }
  return { zonas: best.perm, custo: best.custo, varridas: all.length };
}

/**
 * THE FIFTH LANE — the one #21 found and #19 didn't have.
 *
 *   > A lane only stacks if the bands OVERLAP on the transversal axis; side by
 *   > side, they share. Without this fix the three AZ bands come out
 *   > staircased.
 *
 * #19's rule charged the lane on the first row the band touches and took the
 * MAX among that row's bands — right for side-by-side bands, wrong for
 * overlapping ones, because those need space one AFTER the other.
 *
 * It becomes a max of sums: for each transversal position, sum the lanes of
 * the bands that start on that row AND cover that position; the row's lane is
 * the largest of those totals. Side by side, each position only sees one band
 * and the sum degenerates into the old max — the old rule is this one's
 * special case, which is why swapping one for the other doesn't move any
 * existing drawing.
 */
function calhaDaLinha(faixasDaLinha, zonas) {
  let max = 0;
  for (const z of zonas) {
    let sum = 0;
    for (const f of faixasDaLinha) if (f.zonas.has(z)) sum += f.lane;
    max = Math.max(max, sum);
  }
  for (const f of faixasDaLinha) if (!f.zonas.size) max = Math.max(max, f.lane);
  return max;
}

async function porGrade(model, d, res) {
  const GAP = folgas(res.tema);
  /**
   * The grid REFUSES when the order depends on a fact the model doesn't have
   * (#22), and refuses BEFORE laying out anything.
   *
   * Here the row order IS the drawing: the role key alone drives it, with no
   * edge and no ELK to break ties. A subnet with no network layer, in a group
   * with more than one role to stack, is an invented order — and an invented
   * order puts the data layer on top, which is the reading the network
   * convention doesn't want.
   *
   * Same policy as the rest of the grid path: fail with the LIST, instead of
   * silently omitting (the rubric's A4.2). And the refusal is precise — it
   * only fires where the missing fact changes the drawing, never for an empty
   * subnet that competes with nobody for a row. The agent reads the message
   * and fixes the model; the human isn't called in, and premise 11 stays
   * standing.
   */
  if (d.gaps.length) {
    const e = new Error("the grid doesn't know how to stack these rows — the subnets' network layer is missing");
    e.erros = layersMod.textoDaLacuna(d.gaps);
    throw e;
  }

  const elk = new ELK();
  const boxes = new Map();
  const { eixo, because: whyAxis } = eixoDaGrade(model);
  const raia = eixo === 'raia';

  const vpcs = model.nodes.filter(n => n.kind === 'vpc');
  const subnets = model.nodes.filter(n => n.kind === 'subnet');

  // 1. each subnet is laid out in isolation, to know what size it needs
  const intra = new Map();
  for (const s of subnets) {
    const kids = d.t.filhos.get(s.id);
    const c = res.container(s);
    boxes.set(s.id, { container: true, ...c });
    if (!kids.length) { intra.set(s.id, { w: 200, h: 90, filhos: [] }); continue; }
    const g = {
      id: s.id,
      layoutOptions: {
        'elk.algorithm': 'layered', 'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '30', 'elk.randomSeed': '1',
        'elk.json.shapeCoords': 'PARENT',
        'elk.padding': `[top=${c.titleH + 10},left=14,bottom=14,right=14]`,
      },
      children: kids.map(k => {
        const f = res.leaf(k);
        boxes.set(k.id, { container: false, ...f });
        return { id: k.id, width: f.boxW || f.shapeW, height: f.shapeH + f.labelH };
      }),
    };
    const r = clean(await elk.layout(g));
    intra.set(s.id, { w: r.width, h: r.height, filhos: r.children });
  }

  // The role key is ONE — `layers.cjs`'s. It used to be built here and there,
  // with the same expression written twice; two definitions of "role" would
  // be two grids, and whoever decides the layer has to be the same one that
  // becomes a row.
  const role = s => layersMod.chaveDePapel(s, d.t);
  const vpcOf = s => (d.t.ancestrais(s).find(a => a.kind === 'vpc') || {}).id;

  const varreduraRaias = ordemDeRaias(model, d, subnets);
  const zonas = varreduraRaias.zonas;

  const rolesByVpc = new Map();
  for (const v of vpcs) rolesByVpc.set(v.id, []);
  for (const s of subnets) {
    const list = rolesByVpc.get(vpcOf(s));
    if (list && !list.includes(role(s))) list.push(role(s));
  }
  /**
   * ROLE ORDER IS DERIVED, not inherited from the file's order.
   *
   * The first version stacked rows in the order subnets appeared in `nodes`.
   * Reordering the list reordered the drawing — exactly #7's uncertainty 4,
   * and it was confirmed: `check-determinismo` flagged different geometry in
   * 2 of 3 shufflings. It matters because whoever writes the model is an
   * agent, and no LLM emits the same list in the same order twice; without a
   * derived order, regenerating the same diagram produces a whole diff.
   *
   * Criterion: exposure first (public before, the deck's reading order),
   * NETWORK LAYER next, label as the last tiebreak.
   *
   * #22 closed the placeholder that was left open here. The middle tiebreak
   * used to be alphabetical and it got `App · Data` right by coincidence; now
   * what drives it is the layer the role occupies, read from what its subnets
   * hold (`layers.cjs`). The alphabet stays at the end and changed role: it no
   * longer carries meaning, it only closes the total order determinism
   * requires.
   *
   * No role reaches here with no layer — the refusal above already blocked
   * that.
   */
  /**
   * The comparator reads FIELDS, not pieces of the key.
   *
   * The previous version did `a.split('|')` and picked out exposure and label
   * by position — which breaks silently the day a label contains a `|`: the
   * key gains a fourth piece and the tiebreak starts comparing the wrong slice
   * of text. `papeisDeSubnet` already returns the role as an object; it's just
   * a matter of querying it.
   */
  const byRole = layersMod.papeisDeSubnet(model, d.t, d.camadas);
  const orderOf = key => {
    const p = byRole.get(key) || {};
    return [layersMod.ordemDeAcesso(p.access), layersMod.layerOrder(p.layer), p.label || ''];
  };
  for (const list of rolesByVpc.values())
    list.sort((a, b) => {
      const ka = orderOf(a), kb = orderOf(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2], 'pt');
    });

  // 2. each zone's TRANSVERSAL extent: width with AZ in a column, height with
  //    AZ in a swimlane. This is the only place the transposition touches the measurement.
  const extT = s => raia ? intra.get(s.id).h : intra.get(s.id).w;
  const extP = s => raia ? intra.get(s.id).w : intra.get(s.id).h;
  const minT = raia ? 90 : 200;
  const minP = raia ? 200 : 90;

  /**
   * The PRINCIPAL gap, with the grid transposed, has to fit the edge's label.
   *
   * With the AZ in a column, the principal axis is Y and the gap between roles
   * only separates boxes — 14 px is enough. Transposed, the principal axis is
   * X and that's exactly where the numbered step's label is drawn. It's the
   * same finding as #11's on the ELK path ("hand the label to the layout, or
   * it pulls the nodes together until the text lands on the neighboring
   * icon"), except here there's no ELK to hand it to: the grid itself reserves it.
   */
  const larguraDoRotulo = Math.max(0, ...d.edges.map(a => res.larguraDaAresta(textoDaAresta(a))));
  const GAP_T = raia ? GAP.ROW_GAP : GAP.COL_GAP;
  const GAP_P = raia ? Math.max(GAP.ROW_GAP, larguraDoRotulo + 24) : GAP.ROW_GAP;

  const tamT = new Map(zonas.map(z =>
    [z, Math.max(minT, ...subnets.filter(s => s.az === z).map(extT))]));

  /**
   * 3. member bands, and on WHICH AXIS their lane is charged.
   *
   * The lane exists for the band's LABEL, and the band's label is drawn at its
   * top — at -Y, always, because that's where the style's `verticalAlign=top`
   * puts it. So the lane is charged on whichever axis is mapped to Y:
   *
   *   AZ in a column  Y is the PRINCIPAL     → charged on the role row where the band starts
   *   AZ in a swimlane  Y is the TRANSVERSAL   → charged on the swimlane where the band starts
   *
   * #19 only saw the first case, because there was only one axis back then.
   * Ignoring this on the transposed grid was visible in the first render: the
   * Auto Scaling group's own label rose into the VPC's title band, and the gap
   * between role columns gained 49 px nobody asked for.
   */
  const calhas = new Map();
  const porLinha = new Map();      // vpc -> Map(role row -> [{lane, zonas}])
  const porRaia = new Map();       // swimlane index -> accumulated lane
  for (const f of (model.bands || [])) {
    const lane = calhaDaFaixa(res.band(f).style);
    calhas.set(f.id, lane);
    const members = f.members.map(m => {
      const s = d.t.ancestrais(d.t.byId.get(m)).find(a => a.kind === 'subnet') || d.t.byId.get(m);
      const v = vpcOf(s);
      return { v, az: s.az, idx: rolesByVpc.get(v) ? rolesByVpc.get(v).indexOf(role(s)) : -1 };
    }).filter(x => x.idx >= 0);

    if (raia) {
      const idxs = members.map(l => zonas.indexOf(l.az)).filter(i => i >= 0);
      if (!idxs.length) continue;
      const first = Math.min(...idxs);
      porRaia.set(first, Math.max(porRaia.get(first) || 0, lane));
      continue;
    }
    for (const v of new Set(members.map(l => l.v))) {
      const mine = members.filter(l => l.v === v);
      const first = Math.min(...mine.map(l => l.idx));
      if (!porLinha.has(v)) porLinha.set(v, new Map());
      const map = porLinha.get(v);
      if (!map.has(first)) map.set(first, []);
      map.get(first).push({ lane, zonas: new Set(mine.map(l => l.az).filter(Boolean)) });
    }
  }

  /**
   * Each swimlane's reserve is the SUM of two strips, not the max.
   *
   * Stacking instead of sharing is the same rule #21 found for two bands on
   * the same row, applied between a DERIVED band (the zone swimlane) and a
   * MEMBER band (the Auto Scaling group): they overlap on the transversal axis
   * — the ASG sits inside the swimlane — so they need space one after the other.
   */
  const posT = new Map();
  const reservaDaRaia = new Map();
  let t = 0;
  for (const [i, z] of zonas.entries()) {
    if (i > 0) t += GAP_T;
    const reserve = raia ? SWIMLANE_LANE + (porRaia.get(i) || 0) : 0;
    reservaDaRaia.set(z, reserve);
    t += reserve;
    posT.set(z, t);
    t += tamT.get(z);
  }
  const extensaoT = t;

  // 4. stack the VPCs along the PRINCIPAL axis
  const pos = new Map();
  const vpcBox = new Map();
  // #19's rules 1+4: the zone's lane is always born BELOW its container's
  // title band. In a column, that's an offset on the principal axis (Y); in a
  // swimlane, the zone's label lives in the lane BETWEEN swimlanes, so the
  // principal axis starts at the margin and it's the transversal one that
  // carries the reserve.
  let p = raia ? GAP.PAD : HEAD + AZ_LANE;
  for (const v of vpcs) {
    const roles = rolesByVpc.get(v.id);
    const ofVpc = porLinha.get(v.id) || new Map();
    const cV = res.container(v);
    boxes.set(v.id, { container: true, ...cV });

    // the container's title band consumes the PRINCIPAL axis when the
    // principal is Y; with the grid transposed it consumes the transversal,
    // not the principal
    let run = raia ? GAP.PAD : cV.titleH + GAP.PAD;
    const posP = [], tamP = [];
    roles.forEach((pa, i) => {
      if (i > 0) run += GAP_P + calhaDaLinha(ofVpc.get(i) || [], zonas);
      const ext = Math.max(minP, ...subnets.filter(s => role(s) === pa).map(extP));
      posP.push(run); tamP.push(ext); run += ext;
    });
    run += GAP.PAD;

    // the top of the content inside the VPC: title + padding, plus the first
    // swimlane's label lane when the grid is transposed
    const shiftT = raia ? HEAD + cV.titleH + GAP.PAD : 2 * GAP.PAD;
    vpcBox.set(v.id, raia
      ? { x: p, y: HEAD, w: run, h: cV.titleH + GAP.PAD + extensaoT + GAP.PAD }
      : { x: GAP.PAD, y: p, w: extensaoT + 2 * GAP.PAD, h: run });

    for (const s of subnets) {
      if (vpcOf(s) !== v.id) continue;
      const i = roles.indexOf(role(s));
      pos.set(s.id, raia
        ? { x: p + posP[i], y: shiftT + posT.get(s.az), w: tamP[i], h: tamT.get(s.az) }
        : { x: 2 * GAP.PAD + posT.get(s.az), y: p + posP[i], w: tamT.get(s.az), h: tamP[i] });
    }
    p += run + GAP.COL_GAP + GAP.ROW_GAP;
  }

  const fimP = p - GAP.COL_GAP - GAP.ROW_GAP;
  const alturaRaia = vpcs.length
    ? Math.max(...[...vpcBox.values()].map(b => b.y + b.h))
    : HEAD;

  return {
    pos, vpcBox, intra, boxes, calhas, zonas, azs: zonas, eixo, raia, whyAxis,
    varreduraRaias, SWIMLANE_LANE, reservaDaRaia,
    colX: posT, colW: tamT, posT, tamT, extensaoT,
    larguraGrade: raia ? fimP : extensaoT,
    fim: raia ? alturaRaia : fimP,
    AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, PAD: GAP.PAD,
  };
}

// ------------------------------------------------------------------ path C

/**
 * Multi-account (#12). Third path, same division of labor as the other two:
 * the engine keeps the grid, ELK keeps each cell's content — except here the
 * cell is an ACCOUNT.
 *
 * Why the account can't be left to ELK: `antes-elk-sem-politica.png` shows the
 * cost. ELK arranges the accounts by the edge graph, so they come out
 * scattered diagonally, uneven in size, with no reading order and half the
 * cloud empty. None of the rules #6 measured — canonical order `P1`, alignment
 * `S5`, lane `X1`, 1:4 gap contrast `S3` — can be expressed as an ELK option:
 * they talk about ACCOUNTS, and ELK doesn't know what an account is.
 */

// The gaps come from the geometry measured in the SRA's PPTX (#6 §2.2), and
// what carries weight is the RATIO, not the value: gap between siblings in the
// same OU 0.11–0.15"; gap between OU groups ≈0.51". The 1:4 contrast is what
// makes OU grouping legible with NO box drawn at all (`S3`) — and since AWS
// has no OU shape (`G2`), it does all the work.
const GAP_IRMA = 22;
const GAP_OU = 4 * GAP_IRMA;
// `X1`/`X2`: in the integration view accounts sit side by side with a WIDE
// lane, because that's where the shared element lives (peering, PrivateLink,
// TGW) and it's through it that the crossing breathes.
const LANE = 130;

/**
 * `P1` — the canonical reading order, measured across three independent
 * official diagrams (SRA, MALZ, phase-1): governance → security →
 * infrastructure → workload. The account with no OU comes first because it's
 * Management, which `P2` puts on top and outside any OU.
 */
const RANK_OU = ['management', 'security', 'infrastructure', 'infra', 'network',
  'shared services', 'shared', 'workloads', 'workload', 'application', 'sandbox'];

function rankOu(ou) {
  if (!ou) return -1;                       // no OU = Management, and it comes before everything (P2)
  const k = String(ou).toLowerCase();
  const i = RANK_OU.findIndex(r => k.includes(r));
  return i >= 0 ? i : RANK_OU.length;       // an OU AWS doesn't name goes after the ones it does
}

/** Permutations of a short list. Only ever called with n ≤ 4 — see `ordemDeContas`. */
function permute(xs) {
  if (xs.length <= 1) return [xs];
  const out = [];
  for (let i = 0; i < xs.length; i++)
    for (const rest of permute([...xs.slice(0, i), ...xs.slice(i + 1)]))
      out.push([xs[i], ...rest]);
  return out;
}

/**
 * The order of the accounts along the axis.
 *
 * A SWEEP, NOT A HEURISTIC — #21's lesson, which measured that "put the
 * convergence target in the middle" only TRADES one crossing for another.
 * There the swimlanes were AZs; here they're accounts, and the arithmetic is
 * the same: `X1` caps the integration view at 4 accounts, so it's at most 24
 * permutations. Sweeping is cheap and exact; guessing is cheap and wrong.
 *
 * The cost has two terms, and the order between them is what matters:
 *
 *   JUMP (weight 10)      crossing between non-adjacent accounts — the edge
 *                         crosses a third account's box. It's `A5.5` of the
 *                         rubric (#8), an edge cutting through a band that
 *                         isn't its own, and it's what turns the drawing into
 *                         spaghetti.
 *   AGAINST-FLOW (1)      a crossing pointing backward. `X5` says the
 *                         left→right axis follows the primary flow; an edge
 *                         against the axis doesn't lie, it just reads worse.
 *
 * The final tiebreak is the canonical order `P1`, so two layouts of equal cost
 * don't depend on the order the agent happened to write the list in (#11
 * measured that no LLM emits the same list twice).
 */
function ordemDeContas(accounts, cruz, modo) {
  const canonical = [...accounts].sort((a, b) =>
    rankOu(a.ou) - rankOu(b.ou) ||
    String(a.label || a.id).localeCompare(String(b.label || b.id), 'pt'));

  if (modo !== 'integracao' || !cruz.length) return { order: canonical, custo: null, varridas: 0 };

  const costOf = (perm) => {
    const pos = new Map(perm.map((c, i) => [c.id, i]));
    let jump = 0, againstFlow = 0;
    for (const a of cruz) {
      // AGAINST-FLOW IS ABOUT THE DATA, NOT THE ARROW — `sentidoDeLeitura`.
      // `X5` talks about the primary flow, and in a polling crossing what
      // flows is the response: `from` is only whoever opened the
      // conversation. Measuring by the arrow, the retail row came out
      // `analytics | data | stores` — the whole drawing read backward because
      // two queries point back at the data's origin.
      const rev = a.data === 'back';
      const i = pos.get(rev ? a.contaPara : a.contaDe);
      const j = pos.get(rev ? a.contaDe : a.contaPara);
      if (i === undefined || j === undefined) continue;
      if (Math.abs(i - j) > 1) jump += Math.abs(i - j) - 1;
      if (j < i) againstFlow++;
    }
    return 10 * jump + againstFlow;
  };

  /**
   * The tiebreak is INVERSIONS against the canonical order, and that isn't a
   * detail.
   *
   * In this three-account model, two permutations tie at cost 1 — the two that
   * put the workload in the middle — and the difference between them is
   * reading `Network | Workload | Data` or `Data | Workload | Network`. "The
   * first one enumeration finds" is deterministic and arbitrary; counting
   * inversions against `P1` is deterministic and MEANINGFUL: between two
   * layouts equally good for the edge, the one closer to AWS's reading order
   * wins.
   */
  const canonicalIdx = new Map(canonical.map((c, i) => [c.id, i]));
  const inversions = (perm) => {
    let n = 0;
    for (let i = 0; i < perm.length; i++)
      for (let j = i + 1; j < perm.length; j++)
        if (canonicalIdx.get(perm[i].id) > canonicalIdx.get(perm[j].id)) n++;
    return n;
  };

  let best = null;
  const all = permute(canonical);
  for (const perm of all) {
    const c = costOf(perm), inv = inversions(perm);
    if (!best || c < best.custo || (c === best.custo && inv < best.inv))
      best = { perm, custo: c, inv };
  }
  return { order: best.perm, custo: best.custo, inversions: best.inv, varridas: all.length };
}

/**
 * Layout of an account's INTERIOR: ELK arranges the subtree and the internal edges.
 *
 * Two passes, for the same reason as path A: an account whose content is
 * narrow comes out narrower than its own title, and the label spills below
 * the box. That's what happened to "Org Management" and "Shared Services" in
 * the landing zone's first render — two lines of text hanging outside the
 * magenta border. The slack goes in as `padding.right` and ELK relayouts with
 * it, so nothing needs stretching afterward (which is the workaround #7
 * proposes and which can touch a sibling).
 */
async function layoutDaConta(elk, account, d, res, boxes, metrica, measure = new Map(), notes = new Map()) {
  const GAP = folgas(res.tema);
  const spacing = {
    ...spacingOf(GAP),
    'elk.spacing.nodeNode': String(GAP.ROW_GAP),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(GAP.PAD + Math.ceil(2 * metrica.transbordo)),
  };

  const paraElk = (no) => {
    const kids = d.t.filhos.get(no.id);
    const myNotes = notes.get(no.id) || [];              // see `notasPorPai`
    if (CONTAINERS.has(no.kind)) {
      const c = res.container(no);
      boxes.set(no.id, { container: true, ...c });
      if (!kids.length && !myNotes.length) return emptyBox(no, c, res);
      const hasLeaf = kids.some(k => LEAVES.has(k.kind));   // by TYPE — see `emptyBox`
      const gap = hasLeaf ? Math.ceil(metrica.transbordo) : 0;
      return {
        id: no.id,
        layoutOptions: {
          'elk.padding': `[top=${c.titleH + GAP.PAD},left=${GAP.PAD + gap},` +
            `bottom=${GAP.PAD},right=${GAP.PAD + gap + (measure.get(no.id) || 0)}]`,
          ...spacing,
        },
        children: [...kids.map(paraElk), ...myNotes],
      };
    }
    const f = res.leaf(no);
    boxes.set(no.id, { container: false, ...f });
    return folhaComRotulo(no.id, f);
  };

  const cC = res.container(account);
  boxes.set(account.id, { container: true, ...cC });
  const accountGap = d.t.filhos.get(account.id).some(k => LEAVES.has(k.kind))
    ? metrica.transbordo : 0;                              // by TYPE — see `emptyBox`

  // only the edges whose BOTH ends live in this account — the crossing belongs to the engine
  const inside = new Set();
  (function mark(id) { inside.add(id); for (const k of d.t.filhos.get(id)) mark(k.id); })(account.id);
  const internal = d.edges.filter(a => inside.has(a.from) && inside.has(a.to));
  const revertidas = new Set();

  const graph = {
    id: account.id,
    layoutOptions: {
      ...ROOT_OPTIONS,
      'elk.json.edgeCoords': 'CONTAINER',   // inside the account, the space is the account's
      // the side slack applies to the ACCOUNT too, not only to the containers
      // inside it: the leaf's label is drawn centered under the icon and wider
      // than it, so without this "IAM Identity Center" would touch the magenta border
      'elk.padding': `[top=${cC.titleH + GAP.PAD},left=${GAP.PAD + accountGap},` +
        `bottom=${GAP.PAD},right=${GAP.PAD + accountGap + (measure.get(account.id) || 0)}]`,
      ...spacing,
    },
    children: [...d.t.filhos.get(account.id).map(paraElk), ...(notes.get(account.id) || [])],
    edges: internal.map(a => {
      const txt = textoDaAresta(a);
      const s = sentidoDeLeitura(a);                       // the data drives the layout
      if (s.revertida) revertidas.add(a.id);
      return {
        id: a.id, sources: [s.from], targets: [s.to],
        ...(txt ? { labels: [{ id: a.id + '-rot', text: txt, width: res.larguraDaAresta(txt) + 8, height: 14 }] } : {}),
      };
    }),
  };
  return unrevert(clean(await elk.layout(graph)), revertidas);
}

/** The two label measurements every path needs before assembling any graph. */
function metricaDeRotulo(model, d, res) {
  let rotuloMax = 0, transbordo = 0;
  for (const no of model.nodes) {
    if (!LEAVES.has(no.kind)) continue;              // see `emptyBox`
    const f = res.leaf(no);
    rotuloMax = Math.max(rotuloMax, f.labelH);
    transbordo = Math.max(transbordo, Math.max(0, ((f.labelW || 0) - f.shapeW) / 2));
  }
  return { rotuloMax, transbordo: Math.ceil(transbordo) };
}

async function porContas(model, d, res) {
  const elk = new ELK();
  const boxes = new Map();
  const metrica = metricaDeRotulo(model, d, res);
  // a note attached to a node enters the ELK of ITS account — see `notasPorPai`.
  // One about a node that lives in no account has no ELK to enter (the row of
  // accounts is the engine's grid), and `plan.cjs` puts it at the usual offset.
  const notes = notasPorPai(model, d, res, boxes);
  const accounts = model.nodes.filter(n => n.kind === 'account');
  const modo = d.modo.modo;

  // 1. each account is laid out in isolation, to know what size it needs (S4)
  const interno = new Map();
  for (const c of accounts) {
    let measure = new Map(), r = null;
    for (let pass = 0; pass < 2; pass++) {
      r = await layoutDaConta(elk, c, d, res, boxes, metrica, measure, notes);
      const next = new Map();
      const def = deficitDeTitulo(c, boxes.get(c.id), r.width, res);
      if (def > 0) next.set(c.id, def);
      (function measureTitles(n) {
        for (const child of n.children || []) {
          const no = d.t.byId.get(child.id);
          const dd = deficitDeTitulo(no, boxes.get(child.id), child.width, res);
          if (dd > 0) next.set(child.id, dd);
          measureTitles(child);
        }
      })(r);
      if (!next.size) break;
      measure = next;
    }
    interno.set(c.id, r);
  }

  // 2. the order along the axis — swept in integration, canonical in inventory
  const { order, custo, varridas } = ordemDeContas(accounts, d.travessias, modo);

  // `X6`: the hub account gets a border emphasis, the spokes stay thin. Only
  // marks whoever DOMINATES — a tie has no hub, and an emphasis that doesn't
  // distinguish is noise. Hub = whoever participates in the most crossings.
  const grau = new Map(accounts.map(c => [c.id, 0]));
  for (const a of d.travessias) {
    grau.set(a.contaDe, (grau.get(a.contaDe) || 0) + 1);
    grau.set(a.contaPara, (grau.get(a.contaPara) || 0) + 1);
  }
  const ranking = [...grau.entries()].sort((a, b) => b[1] - a[1]);
  // and ONLY in the integration view: `X6` comes from the diagrams where the
  // crossing is actually drawn, and in the inventory it isn't. Thickening an
  // account's border because of edges the view suppressed would assert an
  // emphasis the reader has no way to check.
  const hub = modo === 'integracao' && ranking.length > 1 &&
    ranking[0][1] > ranking[1][1] && ranking[0][1] >= 2
    ? ranking[0][0] : null;

  // 3. the grid. Integration: a single row, wide lane (X1). Inventory: one
  //    COLUMN per OU group, accounts stacked inside it (the SRA's layout,
  //    measured in §2.2), with the 1:4 gap contrast doing the grouping.
  const pos = new Map();
  let larguraTotal = 0, alturaTotal = 0;
  const colunas = [];

  if (modo === 'integracao') {
    let x = 0;
    const alt = Math.max(...order.map(c => interno.get(c.id).height));
    order.forEach((c, i) => {
      const g = interno.get(c.id);
      if (i > 0) x += LANE;
      // `S5` transposed: in a COLUMN accounts are left-aligned at the origin;
      // in a ROW, top-aligned. The flat top is what lets the crossing come out
      // horizontal and short.
      pos.set(c.id, { x, y: 0, w: g.width, h: g.height });
      x += g.width;
    });
    larguraTotal = x; alturaTotal = alt;
    colunas.push({ ou: null, accounts: order.map(c => c.id) });
  } else {
    // groups into columns by OU, preserving the already-computed canonical order
    let current = null;
    for (const c of order) {
      const key = c.ou || null;
      if (!current || current.ou !== key) { current = { ou: key, accounts: [] }; colunas.push(current); }
      current.accounts.push(c.id);
    }
    let x = 0;
    for (const [i, col] of colunas.entries()) {
      if (i > 0) x += GAP_OU;
      const width = Math.max(...col.accounts.map(id => interno.get(id).width));
      let y = d.ou.draw ? OU_LANE : 0;   // the OU's label band is born above the first member
      col.x = x; col.width = width; col.y = 0;
      for (const id of col.accounts) {
        const g = interno.get(id);
        pos.set(id, { x, y, w: g.width, h: g.height });   // S5: left-aligned at the column's origin
        y += g.height + GAP_IRMA;
      }
      col.height = y - GAP_IRMA;
      alturaTotal = Math.max(alturaTotal, col.height);
      x += width;
    }
    larguraTotal = x;
  }

  return {
    pos, interno, boxes, order, colunas, modo, hub,
    widthOf: larguraTotal, altura: alturaTotal,
    varredura: { custo, varridas },
    metrica, GAP_IRMA, GAP_OU, LANE, OU_LANE,
  };
}

module.exports = {
  porElk, porGrade, porContas, ordemDeContas, ordemDeRaias, eixoDaGrade, calhaDaLinha,
  rankOu, metricaDeRotulo,
  textoDaAresta, calhaDaFaixa, ROOT_OPTIONS, corredorLivre, sentidoDeLeitura,
  notasPorPai, idDaNota, NOTE_W, NOTE_MIN_H,
  AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, GAP_IRMA, GAP_OU, LANE, OU_LANE, clean, folgas,
};
