'use strict';
/**
 * Alignment — the pass that removes the "almost".
 *
 * A 13 px misalignment between two nodes joined by an edge doesn't read as a
 * choice: it reads as a mistake. Either the two sit in the same lane, or they
 * are clearly in different lanes; the middle ground is what makes a drawing
 * look careless.
 *
 * Why here and not in ELK: **I found no lever in ELK that does this.** Measured
 * and inert in `elkjs` 0.12.0 — `priority.straightness` (per edge), `elk.margins`
 * (per node), `nodePlacement.favorStraightEdges`. The `nodePlacement.bk.fixedAlignment`
 * variants work but pick a DIFFERENT neighbor to align to; none zero out the
 * difference. Since the engine already owns 100% of the geometry (#2 §8 — that's
 * why `childLayout` is forbidden), doing the snap here is consistent with the
 * contract, not a workaround around it.
 *
 * The pass is deliberately conservative:
 *   - it only touches SMALL misalignment (≤ SNAP). Large is intentional.
 *   - it moves the whole COLUMN, never a single loose node, so it doesn't eat
 *     the neighbor's gap.
 *   - if the result overlaps anything, it UNDOES. A "almost" is better than a
 *     wrong diagram.
 */

const SNAP = 30;         // above this, the misalignment is deliberate
const MAX_PASSES = 4;

/** Flat index of the ELK output, with absolute position and a pointer to the parent. */
function buildIndex(output) {
  const nodes = new Map();
  (function tier(n, parentId, ox, oy) {
    for (const c of n.children || []) {
      nodes.set(c.id, {
        node: c, parentId,
        x: ox + c.x, y: oy + c.y, w: c.width, h: c.height,
        leaf: !(c.children && c.children.length),
      });
      tier(c, c.id, ox + c.x, oy + c.y);
    }
  })(output, null, 0, 0);
  return nodes;
}

const cy = r => r.y + r.h / 2;

/** Siblings that share the same column (same x) within the same parent. */
function column(nodes, target) {
  const a = nodes.get(target);
  const out = [];
  for (const [id, r] of nodes) if (r.parentId === a.parentId && r.leaf && Math.abs(r.x - a.x) < 1) out.push(id);
  return out;
}

/**
 * Any pair of siblings overlapping, or a child overflowing its parent.
 *
 * WARNING: ALL FOUR EDGES, and the top two only arrived in #26 — the corpus
 * found them.
 *
 * The previous version only measured `bottom` and `right`, and the asymmetry
 * was not a decision: the pass was born moving a column DOWN (the `delta` of
 * the first measured case was positive), and a child that goes down can only
 * overflow through the parent's bottom. But `delta` is `cy(u) − cy(v)` and it is
 * negative just as often — then the column goes up, and going up unguarded
 * overflows the container's title band.
 *
 * The `events-fanout` case in the #26 corpus does exactly that: three snaps in
 * a row of −13, −27 and −6 px push the dead-letter-queue column 46 px above its
 * proper spot, and `dlq-estoque` ends up 7 px ABOVE the top of its own region.
 * The drawing ends up asserting that the dead-letter queue is not in the
 * region — which is `A4.4`, a SEMANTIC failure, the drawing asserting what the
 * model denies.
 *
 * It's the pattern #23 named a round earlier: **the check that doesn't know
 * how to fail**. This file's header promises "if the result overlaps anything,
 * UNDO", and the promise was blind on two of the four sides. `refit` doesn't
 * cover the gap even by accident: it only GROWS the container (`Math.max`), and
 * growing fixes whoever overflows the foot, never whoever exits through the top.
 */
function hasOverlap(output, paddings) {
  const nodes = buildIndex(output);
  const byParent = new Map();
  for (const [id, r] of nodes) {
    if (!byParent.has(r.parentId)) byParent.set(r.parentId, []);
    byParent.get(r.parentId).push({ id, ...r });
  }
  for (const [parentId, siblings] of byParent) {
    for (let i = 0; i < siblings.length; i++)
      for (let j = i + 1; j < siblings.length; j++) {
        const a = siblings[i], b = siblings[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return `${a.id}×${b.id}`;
      }
    if (parentId === null) continue;
    const p = nodes.get(parentId);
    const pad = paddings.get(parentId) || { top: 0, left: 0, bottom: 0, right: 0 };
    for (const c of siblings) {
      if (c.y + c.h > p.y + p.h - pad.bottom + 0.5) return `${c.id} overflows ${parentId}`;
      if (c.x + c.w > p.x + p.w - pad.right + 0.5) return `${c.id} overflows ${parentId} (x)`;
      if (c.y < p.y + pad.top - 0.5) return `${c.id} exits through the top of ${parentId}`;
      if (c.x < p.x + pad.left - 0.5) return `${c.id} exits through the left of ${parentId}`;
    }
  }
  return null;
}

/** Grows each container to fit its children, bottom-up. */
function refit(output, paddings) {
  (function up(n) {
    for (const c of n.children || []) up(c);
    if (!n.children || !n.children.length || n.id === 'root') return;
    const pad = paddings.get(n.id) || { bottom: 0, right: 0 };
    const neededH = Math.max(...n.children.map(c => c.y + c.height)) + pad.bottom;
    const neededW = Math.max(...n.children.map(c => c.x + c.width)) + pad.right;
    n.height = Math.max(n.height, neededH);
    n.width = Math.max(n.width, neededW);
  })(output);
}

/**
 * Rewrites the route of an edge whose endpoints are no longer where ELK left
 * them. Only two cases, and both orthogonal by construction: straight when the
 * centers coincide, a Z in the middle of the gap when they don't.
 */
function reroute(sec, u, v) {
  const uy = cy(u), vy = cy(v);
  const towardRight = u.x + u.w <= v.x;
  const xs = towardRight ? u.x + u.w : u.x;
  const xe = towardRight ? v.x : v.x + v.w;
  sec.startPoint = { x: xs, y: uy };
  sec.endPoint = { x: xe, y: vy };
  sec.bendPoints = Math.abs(uy - vy) < 0.5 ? [] : [{ x: (xs + xe) / 2, y: uy }, { x: (xs + xe) / 2, y: vy }];
}

/**
 * @returns {{applied: Array, undone: Array}}
 */
function align(output, paddings) {
  const applied = [], undone = [];

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const nodes = buildIndex(output);

    // candidates: an edge between two leaves, nearly aligned, in distinct columns
    const cands = [];
    for (const e of output.edges || []) {
      const u = nodes.get(e.sources[0]), v = nodes.get(e.targets[0]);
      if (!u || !v || !u.leaf || !v.leaf) continue;
      if (Math.abs(u.x - v.x) < 1) continue;                 // same column: not a lane
      const delta = cy(u) - cy(v);
      if (Math.abs(delta) > 0.5 && Math.abs(delta) <= SNAP) cands.push({ e, delta });
    }
    if (!cands.length) break;
    cands.sort((a, b) => a.e.id < b.e.id ? -1 : 1);          // determinism
    const { e, delta } = cands[0];

    // move the target's whole column, preserving its internal gaps
    const targets = column(nodes, e.targets[0]);
    const before = targets.map(id => ({ id, y: nodes.get(id).node.y }));
    for (const id of targets) nodes.get(id).node.y += delta;

    const heightsBefore = [];
    (function guard(n) { heightsBefore.push([n, n.width, n.height]); for (const c of n.children || []) guard(c); })(output);
    refit(output, paddings);

    const problem = hasOverlap(output, paddings);
    if (problem) {
      for (const b of before) nodes.get(b.id).node.y = b.y;
      for (const [n, w, h] of heightsBefore) { n.width = w; n.height = h; }
      undone.push({ edge: e.id, delta: Math.round(delta), because: problem });
      break;                       // a snap that doesn't fit ends the pass
    }

    // the endpoints moved: ELK's original route no longer holds for whoever moved
    const moved = new Set(targets);
    const after = buildIndex(output);
    for (const other of output.edges || []) {
      const su = other.sources[0], sv = other.targets[0];
      if (!moved.has(su) && !moved.has(sv)) continue;
      const u = after.get(su), v = after.get(sv);
      if (!u || !v) continue;
      const sec = (other.sections || [])[0];
      if (!sec) continue;
      if (moved.has(su) && moved.has(sv)) {              // the whole edge moved down together
        sec.startPoint.y += delta; sec.endPoint.y += delta;
        for (const p of sec.bendPoints || []) p.y += delta;
      } else {
        reroute(sec, u, v);
      }
    }
    applied.push({ edge: e.id, delta: Math.round(delta), moved: targets });
  }

  return { applied, undone };
}

module.exports = { align, SNAP, buildIndex };
