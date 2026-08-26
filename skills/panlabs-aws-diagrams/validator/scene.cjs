'use strict';
/**
 * Scene — the engine's plan turned into what the checks know how to read.
 *
 * The plan is built for the EMITTER: geometry relative to the parent, style as
 * a string, z implicit in list order. The checks need the opposite: absolute
 * coordinates, style as fields, and the three object classes kept apart.
 * Translating once here is what stops eight families from reimplementing the
 * same tree traversal with eight different bugs.
 *
 * ------------------------------------------------------------------------
 * The distinction the rubric doesn't have: GROUP and BAND
 * ------------------------------------------------------------------------
 *
 * The rubric (#8) assumes a single containment tree. A4.2 says "no node falls
 * inside a group it is not a child of" and A4.3 says "sibling groups are
 * disjoint" — both at zero tolerance, and A4.2 is called "the most
 * semantically severe failure in the whole validator".
 *
 * Except this engine draws two kinds of box, and `resolve.cjs` is explicit
 * about the second: **"A band exists to CROSS other boxes."** An AZ band runs
 * across subnets; an Auto Scaling group wraps EC2 instances from two different
 * AZs. Applying A4.2 and A4.3 to them fails the correct drawing, and fails it
 * for exactly the highest-severity reason — the validator would accuse the
 * generator's central decision of lying.
 *
 * The way out isn't to carve an exception, it's to recognize the two boxes
 * assert different things:
 *
 *   A GROUP asserts CONTAINMENT. "this node is inside this VPC" is a network
 *   topology fact, and the box IS the boundary. Overlap here is a lie.
 *
 *   A BAND asserts a SHARED ATTRIBUTE. "these two nodes are in this AZ",
 *   "these two scale together". It isn't a network boundary, it's a class —
 *   and a class cuts across the containment tree by definition, or it
 *   wouldn't need to exist.
 *
 * So A4.2/A4.3/A5.5 apply to GROUPS, and bands get the check that actually
 * fits them: **the band contains exactly the members it declares** — not one
 * fewer (the member got left out of the embrace) and not one more (a
 * non-member fell inside and the band asserts an attribute about it that it
 * doesn't have). It's the same semantic question as A4.2, asked against the
 * member list instead of the parent relation.
 *
 * This is a finding #18 made against the rubric, not a loophole: the zero
 * tolerance stays zero, just measured against what the box actually asserts.
 */

const path = require('path');
const { THRESHOLDS } = require(path.join(__dirname, 'index.cjs'));
const color = require(path.join(__dirname, 'color.cjs'));
const geo = require(path.join(__dirname, 'geometry.cjs'));

const v = key => THRESHOLDS[key].value;

/** Cells that are document chrome, not diagram content. */
const CHROME = new Set(['title', 'subtitle', 'notes', 'panlabs-modelo']);

// ---------------------------------------------------------------------- style

/**
 * The mxGraph style string turned into an object.
 *
 * The format is `key=value;key=value;` with two details that break a naive
 * `split('=')`: the first token can be a shape name with no value
 * (`text;html=1`), and values like `points=[[0,0],[1,0]]` and
 * `dashPattern=8 5` carry commas, brackets and spaces inside the value.
 */
function readStyle(s) {
  const out = { _flags: [] };
  for (const part of String(s || '').split(';')) {
    const t = part.trim();
    if (!t) continue;
    const i = t.indexOf('=');
    if (i < 0) { out._flags.push(t); continue; }
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

const num = (e, key, fallback) => {
  const x = parseFloat(e[key]);
  return Number.isFinite(x) ? x : fallback;
};
/** `none` and absent are different things from a color, and both become `null`. */
const colorOf = (e, key) => (color.ehCor(e[key]) ? e[key] : null);

// ---------------------------------------------------------------------- label

/**
 * The box a label occupies. It's an estimate, and the module says so out loud.
 *
 * The engine reserves the label band by SPACING (`elk.spacing.nodeNode` and
 * the group's bottom padding), not by cell geometry: in the plan, a leaf is
 * 78×78, which is the icon's box, and the label is drawn outside it. Anyone
 * who wants to know whether two labels touch has to reconstruct both boxes.
 *
 * The character-width constant here belongs to the validator, not imported
 * from the engine — but the two land in the same place, because they measure
 * the same font at the same size. The independence that matters isn't in the
 * constant: it's in the fact that the engine RESERVES space and never CHECKS
 * whether the reservation was enough, and that check is what A3.2, A3.3 and
 * A3.4 do. The final word still belongs to render (B7).
 */
function labelBox(cellBox, label, style) {
  const text = String(label || '').replace(/<[^>]+>/g, '').trim();
  if (!text) return null;

  const fontSize = num(style, 'fontSize', 12);
  const scale = fontSize / 12;
  const perChar = v('avgCharWidth') * scale;
  const lineHeight = v('lineHeight') * scale;

  // Container: the label lives in the title band, top-left corner.
  if (style.container === '1') {
    // `style` is already parsed: looking for "grIcon=" in its JSON never
    // matches, because serialized the pair becomes `"grIcon":"..."`. The key
    // itself is what gets tested.
    const indent = 'grIcon' in style || style.spacingLeft ? num(style, 'spacingLeft', 30) : 8;
    return {
      x: cellBox.x + indent, y: cellBox.y,
      w: Math.min(cellBox.w - indent, text.length * perChar),
      h: v('titleBandHeight'),
      placement: 'title',
    };
  }

  // Leaf with an outside label: band centered right below the icon.
  if (style.verticalLabelPosition === 'bottom') {
    // O21: an explicit `<br>` is a MANDATORY break, not a wrap opportunity —
    // the same treatment `resolve.cjs`'s `labelLines()` gives it, and since
    // #33 the box GROWS to the widest row instead of wrapping at a fixed
    // width (`ROTULO_W`/120px died there — see `check-leaf-box.cjs`). This
    // used to measure `text` — the tag-stripped label with both rows glued
    // into one string — and cap that at the dead 120px width; the first
    // summed the two rows' lengths into one, the second reintroduced the
    // wrap #33 removed. Both overstated the box and made a two-line
    // qualifier read as leaving its own group when it didn't (#39).
    const rows = String(label || '').split(/<br\s*\/?>/i).map(l => l.replace(/<[^>]+>/g, '').trim());
    const width = Math.max(...rows.map(r => r.length * perChar));
    return {
      x: cellBox.x + (cellBox.w - width) / 2, y: cellBox.y + cellBox.h,
      w: width, h: Math.max(v('minLabelHeight'), rows.length * lineHeight),
      placement: 'below',
    };
  }

  // Inline label: the box is the object's own box.
  return { x: cellBox.x, y: cellBox.y, w: cellBox.w, h: cellBox.h, placement: 'inside' };
}

// ---------------------------------------------------------------------- edge

/**
 * The plan only stores the edge's BENDS — mxGraph projects the ends onto the
 * perimeter at render time. To check A3.5 and A5.5 the polyline needs to be
 * whole, so the ends are reconstructed the same way the renderer would compute
 * them: the declared anchor when one exists (`exitX`/`entryX`), a projection
 * onto the perimeter toward the next point when it doesn't.
 *
 * The consequence has to be written down, because it changes what A3.6 can
 * assert: if the end is reconstructed by projection, it sits on the perimeter
 * BY CONSTRUCTION, and A3.6 only has something to measure where the anchor was
 * declared. See `a3` for what the check reports in that case — what it does
 * not do is stay quiet and pretend it checked.
 */
function tipOnPerimeter(cellBox, target) {
  const c = geo.centro(cellBox);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (Math.abs(dx) < geo.EPS && Math.abs(dy) < geo.EPS) return c;
  const tx = Math.abs(dx) < geo.EPS ? Infinity : (cellBox.w / 2) / Math.abs(dx);
  const ty = Math.abs(dy) < geo.EPS ? Infinity : (cellBox.h / 2) / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

function declaredAnchor(cellBox, style, prefix) {
  const ax = parseFloat(style[`${prefix}X`]);
  const ay = parseFloat(style[`${prefix}Y`]);
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) return null;
  return { x: cellBox.x + ax * cellBox.w, y: cellBox.y + ay * cellBox.h, declared: true };
}

// ---------------------------------------------------------------------- scene

function createScene(layoutPlan, opts = {}) {
  const cells = layoutPlan.cells || [];

  // 1. the semantic model, which travels inside the plan itself (#2 §round-trip)
  let model = opts.model || null;
  if (!model) {
    const embedded = cells.find(c => c.id === 'panlabs-modelo');
    if (embedded && embedded.data && embedded.data.panlabsModelo) {
      try { model = JSON.parse(embedded.data.panlabsModelo); } catch { model = null; }
    }
  }

  const bandIds = new Set((model && model.bands || []).map(f => f.id));
  const bandMembers = new Map((model && model.bands || []).map(f => [f.id, f.members || []]));
  const modelNodeById = new Map((model && model.nodes || []).map(n => [n.id, n]));

  // 2. absolute coordinates, resolving the parent chain
  const cellById = new Map();
  const absoluteBox = new Map();
  for (const c of cells) if (c.geo) cellById.set(c.id, c);

  function abs(c) {
    if (absoluteBox.has(c.id)) return absoluteBox.get(c.id);
    let x = c.geo.x;
    let y = c.geo.y;
    const parent = cellById.get(c.parent);
    if (parent) { const a = abs(parent); x += a.x; y += a.y; }
    const r = { x, y, w: c.geo.w, h: c.geo.h };
    absoluteBox.set(c.id, r);
    return r;
  }

  // 3. classify. The loop order is z-order (whoever comes first sits behind).
  const elements = [];
  cells.forEach((c, z) => {
    const style = readStyle(c.style);
    if (c.kind === 'edge') {
      elements.push({
        id: c.id, kind: 'edge', parent: c.parent, z, style, rawStyle: c.style || '',
        label: c.label || '', from: c.from, to: c.to, bends: c.points || [], labelT: c.labelT,
        // the same fields the boxes get: without this every family re-parses
        // the style by hand, and A3.9 and A7.1 already disagreed on the
        // default for `fontSize`
        stroke: colorOf(style, 'strokeColor'),
        fontColor: colorOf(style, 'fontColor') || '#000000',
        fontSize: num(style, 'fontSize', 12),
        bold: style.fontStyle === '1' || style.fontStyle === '3',
        halo: colorOf(style, 'labelBackgroundColor'),
      });
      return;
    }
    if (!c.geo) return;
    const cellBox = abs(c);
    const hidden = c.visible === false;
    let kind;
    if (hidden || CHROME.has(c.id)) kind = c.id === 'panlabs-modelo' || hidden ? 'hidden' : 'frame';
    else if (bandIds.has(c.id) || /^az-/.test(c.id)) kind = 'band';
    else if (style.container === '1') kind = 'group';
    else if (style._flags.includes('text')) kind = 'frame';
    else kind = 'node';

    elements.push({
      id: c.id, kind, parent: c.parent, z, cellBox, style, rawStyle: c.style || '',
      label: c.label || '',
      semanticKind: (modelNodeById.get(c.id) || {}).kind || null,
      modelNode: modelNodeById.get(c.id) || null,
      members: bandMembers.get(c.id) || null,
      labelRect: cellBox && !hidden ? labelBox(cellBox, c.label, style) : null,
      fill: colorOf(style, 'fillColor'),
      stroke: colorOf(style, 'strokeColor'),
      fontColor: colorOf(style, 'fontColor') || '#000000',
      fontSize: num(style, 'fontSize', 12),
      bold: style.fontStyle === '1' || style.fontStyle === '3',
      opacity: num(style, 'opacity', 100) / 100,
    });
  });

  const from = kind => elements.filter(e => e.kind === kind);
  const nodes = from('node');
  const groups = from('group');
  const bands = from('band');
  const frames = from('frame');
  const edges = from('edge');
  const boxes = [...nodes, ...groups, ...bands];
  const byElement = new Map(elements.map(e => [e.id, e]));

  // 4. AZ bands come from the grid path and are not in the model; their
  //    members are the nodes whose subnet declares that zone.
  for (const f of bands) {
    if (f.members) continue;
    const zone = /^az-(.+)$/.exec(f.id);
    if (!zone || !model) { f.members = null; continue; }
    const subnets = new Set((model.nodes || []).filter(n => n.az === zone[1]).map(n => n.id));
    f.members = (model.nodes || [])
      .filter(n => subnets.has(n.id) || subnets.has(n.inside))
      .map(n => n.id)
      .filter(id => byElement.has(id) && byElement.get(id).kind === 'node');
  }

  // 5. the DECLARED containment tree — groups and nodes only; a band is nobody's parent
  const childrenOf = new Map();
  for (const e of [...nodes, ...groups]) {
    const parent = e.parent === '1' ? null : e.parent;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(e);
  }
  function ancestors(id) {
    const output = [];
    let current = byElement.get(id);
    while (current && current.parent && current.parent !== '1') {
      const parent = byElement.get(current.parent);
      if (!parent || output.includes(parent)) break;
      output.push(parent);
      current = parent;
    }
    return output;
  }
  const isDescendant = (id, ancestorId) => ancestors(id).some(a => a.id === ancestorId);

  // 6. edge ends, and the complete polyline
  for (const a of edges) {
    const origin = byElement.get(a.from);
    const dest = byElement.get(a.to);
    if (!origin || !dest) { a.points = a.bends.slice(); a.complete = false; continue; }
    const aimStart = a.bends[0] || geo.centro(dest.cellBox);
    const aimEnd = a.bends[a.bends.length - 1] || geo.centro(origin.cellBox);
    const start = declaredAnchor(origin.cellBox, a.style, 'exit') || tipOnPerimeter(origin.cellBox, aimStart);
    const end = declaredAnchor(dest.cellBox, a.style, 'entry') || tipOnPerimeter(dest.cellBox, aimEnd);
    a.points = [start, ...a.bends, end];
    a.complete = true;
    a.anchored = !!(start.declared && end.declared);
    a.polylineLength = geo.polylineLength(a.points);
    a.labelRect = a.label ? edgeLabelRect(a) : null;
  }

  function edgeLabelRect(a) {
    const text = String(a.label).replace(/<[^>]+>/g, '').trim();
    if (!text) return null;
    const fontSize = num(a.style, 'fontSize', 12);
    const width = text.length * v('avgCharWidth') * (fontSize / 12);
    const height = v('lineHeight') * (fontSize / 12);
    // #40 — the engine slides a label that would collide away from the
    // midpoint (`labelT`, along the SAME polyline); default to 0.5 for
    // whoever didn't need to move.
    const mid = pointAt(a.points, a.labelT ?? 0.5);
    return { x: mid.x - width / 2, y: mid.y - height / 2, w: width, h: height, placement: 'edge' };
  }

  /** The point at fraction `t` (0 = start, 1 = end) along a polyline's length. */
  function pointAt(points, t) {
    const total = geo.polylineLength(points);
    const target = total * t;
    let walked = 0;
    for (let i = 0; i + 1 < points.length; i++) {
      const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      if (walked + d >= target) {
        const along = d < geo.EPS ? 0 : (target - walked) / d;
        return { x: points[i].x + along * (points[i + 1].x - points[i].x), y: points[i].y + along * (points[i + 1].y - points[i].y) };
      }
      walked += d;
    }
    return points[0] || { x: 0, y: 0 };
  }

  // A7's contrast sampling wants the STROKE's midpoint, not the label's — an
  // edge's color doesn't move when #40 slides the label off it, so this stays
  // fixed at t=0.5 and keeps its own one-argument shape for `scene.midpoint`.
  const midpoint = points => pointAt(points, 0.5);

  /**
   * The effective background at a point — decision 4 of #18.
   *
   * Not `plan.background`. A label inside a subnet inside a VPC inside the
   * cloud has the whole stack behind it, and AWS groups draw with their own
   * fill. The computation is: sweep the boxes in z-order, keep the ones that
   * contain the point and have a fill, and composite them back-to-front with
   * each one's opacity. Measuring against the page's white would give a
   * contrast nobody sees.
   *
   * `fillColor=none` — which is how bands and the AZ draw — doesn't paint,
   * and so it doesn't enter the stack: the band crosses without changing the
   * background of whatever is underneath, which is exactly what it visually
   * promises.
   */
  function effectiveBackgroundAt(point, beforeZ = Infinity) {
    let background = layoutPlan.background || '#FFFFFF';
    for (const e of boxes) {
      if (e.z >= beforeZ) continue;
      if (!e.fill) continue;
      const c = e.cellBox;
      if (point.x < c.x || point.x > geo.direita(c) || point.y < c.y || point.y > geo.baixo(c)) continue;
      background = color.compor(e.fill, background, e.opacity);
    }
    return background;
  }

  /**
   * The effective background under an element's label, honoring the halo if there is one.
   *
   * The `+ 1` in the z-cutoff isn't a detail: a group's label is drawn INSIDE
   * its own box, in the title band, so the group's own fill is that text's
   * background. Cutting at `e.z` excludes exactly the color behind it and
   * measures against the page instead.
   *
   * The error has a dangerous direction. A `#00A4A6` title over an `#E6F6F7`
   * subnet gives 2.75:1, and measured against white gives 3.06:1 — optimistic,
   * but still a fail. But dark text over a dark group (`#232F3E` over
   * `#232F3D`) is 1.00:1 on screen and becomes 13.57:1 measured against the
   * page: PASSES. A false negative in the validator's one normative family.
   *
   * For a label drawn outside its box (a leaf with
   * `verticalLabelPosition=bottom`) including the element itself changes
   * nothing: its label's point falls outside its own box, and the containment
   * test decides it, not the z-cutoff.
   */
  function labelBackground(e) {
    const halo = colorOf(e.style, 'labelBackgroundColor');
    if (halo) return halo;
    const cellBox = e.labelRect;
    if (!cellBox) return layoutPlan.background || '#FFFFFF';
    return effectiveBackgroundAt({ x: cellBox.x + cellBox.w / 2, y: cellBox.y + cellBox.h / 2 }, e.z + 1);
  }

  // Each node's degree. Lives here because A5.1 (c_max), A6.1 and A8.3 all
  // want the same map, and three copies is where one of them stops counting
  // an incomplete edge.
  const degree = new Map();
  for (const a of edges) if (a.complete) for (const id of [a.from, a.to]) degree.set(id, (degree.get(id) || 0) + 1);

  return {
    layoutPlan, model, degree,
    canvas: { x: 0, y: 0, w: layoutPlan.width, h: layoutPlan.height },
    background: layoutPlan.background || '#FFFFFF',
    elements, nodes, groups, bands, frames, edges, boxes,
    byElement, childrenOf, ancestors, isDescendant,
    effectiveBackgroundAt, labelBackground, midpoint,
    // the legend doesn't exist in this engine yet; the scene exposes the field
    // so family A1 can say "absent" instead of blowing up
    legend: layoutPlan.legend || [],
  };
}

module.exports = { createScene, readStyle, labelBox, tipOnPerimeter };
