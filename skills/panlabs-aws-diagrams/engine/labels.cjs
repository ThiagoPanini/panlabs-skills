'use strict';
/**
 * #40 — an edge label that would land on top of another slides along its OWN
 * edge instead of sitting frozen at the midpoint.
 *
 * The division `validate-geometry.cjs` documents for `align.cjs` applies
 * here too: "correcting belongs to layout/align, with the local knowledge;
 * judging belongs to [the validator], with no write power". This module is
 * the corrector, and it decides with the SAME math A3.2 will grade it
 * against — by literally calling `createScene` to see what a candidate
 * position looks like, instead of re-deriving anchor and midpoint geometry a
 * second time. No duplicated formula means no drift between "what the
 * engine thinks it drew" and "what the validator measures".
 *
 * The search is bounded and DETERMINISTIC: edges are tried in id order, so
 * the first edge on a page always keeps the center and only a later one that
 * lands on the same spot moves — the same "first free wins" rule #21 already
 * uses for lane assignment. A label the search can't clear keeps its
 * midpoint: a collision the reader can still find beats a label pushed off
 * the edge it belongs to.
 */

const path = require('path');
const { createScene } = require(path.join(__dirname, '..', 'validator', 'scene.cjs'));
const { lim } = require(path.join(__dirname, '..', 'validator', 'index.cjs'));
const geo = require(path.join(__dirname, '..', 'validator', 'geometry.cjs'));

// Never this close to either end — a label riding the last ~12% of an edge
// reads as belonging to the node beside it, not to the line.
const MIN_T = 0.12, MAX_T = 0.88;
const CANDIDATES = [-0.15, 0.15, -0.28, 0.28, -0.4, 0.4]
  .filter(o => 0.5 + o >= MIN_T && 0.5 + o <= MAX_T);

/** A3.2's own rule: expand one side by the padding, then intersect. */
function collides(a, b, padding) {
  const grown = { ...a, x: a.x - padding, y: a.y - padding, w: a.w + 2 * padding, h: a.h + 2 * padding };
  return geo.intersectionArea(grown, b) > 0;
}

/**
 * @param {object} layoutPlan  a page, post-`plan` and pre-`emit` — mutated in place
 * @param {object} [opts]      forwarded to `createScene` (e.g. `{model}`)
 * @returns {{id: string, t: number}[]} the edges whose label moved off-center
 */
function resolveEdgeLabelCollisions(layoutPlan, opts = {}) {
  const cellById = new Map(layoutPlan.cells.map(c => [c.id, c]));
  const padding = lim('labelPadding');

  const scene = createScene(layoutPlan, opts);
  // Node and group labels don't move — they're the immovable obstacles an
  // edge label slides away from, same as A3.2 treats them (`solid` there).
  const placed = [...scene.nodes, ...scene.groups].map(n => n.labelRect).filter(Boolean);
  const withLabel = scene.edges.filter(e => e.labelRect).sort((a, b) => (a.id < b.id ? -1 : 1));

  const moved = [];
  for (const e of withLabel) {
    const cell = cellById.get(e.id);
    if (!cell) continue;
    if (!placed.some(r => collides(e.labelRect, r, padding))) { placed.push(e.labelRect); continue; }

    let landed = null;
    for (const offset of CANDIDATES) {
      cell.labelT = 0.5 + offset;
      const rect = createScene(layoutPlan, opts).edges.find(x => x.id === e.id).labelRect;
      if (rect && !placed.some(r => collides(rect, r, padding))) { landed = rect; break; }
    }
    if (landed) { placed.push(landed); moved.push({ id: e.id, t: cell.labelT }); }
    else { delete cell.labelT; placed.push(e.labelRect); }   // no clear spot found — keep the center
  }
  return moved;
}

module.exports = { resolveEdgeLabelCollisions };
