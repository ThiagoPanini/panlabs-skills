'use strict';
/**
 * The validator's geometric primitives. No dependency, per premise 7 of the map.
 *
 * Three boundary decisions hold across the whole module, because they are the
 * difference between a validator that flags what matters and one that shouts
 * all the time:
 *
 *   TOUCHING IS NOT OVERLAPPING. Two sibling groups that share an edge have
 *   zero intersection area. The layout places adjacent boxes on purpose, and a
 *   validator that called adjacency overlap would fail every tightly packed
 *   diagram. Area is the measure; contact has no area.
 *
 *   TANGENT IS NOT CROSSING. Every well-anchored edge (A3.6) touches the
 *   perimeter of its own node. If touching the border counted as crossing,
 *   A3.5 would flag exactly the behavior A3.6 requires. That's why crossing
 *   requires the interior, not the border.
 *
 *   INCIDENT IS NOT CROSSING. Two edges leaving the same node share a point.
 *   That's the graph, not a drawing defect — and that's why A5.1's c_max
 *   discounts C(deg(v),2). Crossing here requires an intersection in the
 *   interior of both segments.
 *
 * Every angle goes in and out in DEGREES. The rubric is written in degrees,
 * the thresholds are in degrees, and converting midway is exactly where the
 * sign gets lost.
 */

const EPS = 1e-9;

// -------------------------------------------------------------------- rectangle

const direita = r => r.x + r.w;
const baixo = r => r.y + r.h;
const centro = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Intersection area. Zero when the boxes only touch. */
function intersectionArea(a, b) {
  const width = Math.min(direita(a), direita(b)) - Math.max(a.x, b.x);
  const height = Math.min(baixo(a), baixo(b)) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

/** `child` fits entirely inside `parent`, with optional slack on every side. */
function contem(parent, child, padding = 0) {
  return child.x >= parent.x + padding - EPS
    && child.y >= parent.y + padding - EPS
    && direita(child) <= direita(parent) - padding + EPS
    && baixo(child) <= baixo(parent) - padding + EPS;
}

/**
 * Distance between two boxes. Positive when apart, zero when touching,
 * NEGATIVE when overlapping — and the negative value is the overlap depth on
 * whichever axis is smaller, which is how far A3.1 would need to push them apart.
 */
function gap(a, b) {
  const dx = Math.max(a.x - direita(b), b.x - direita(a));
  const dy = Math.max(a.y - baixo(b), b.y - baixo(a));
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
  if (dx > 0) return dx;
  if (dy > 0) return dy;
  return Math.max(dx, dy);
}

/** The four inner paddings between the rectangle and the box of its children. */
function paddings(parent, children) {
  if (!children.length) return null;
  const cx1 = Math.min(...children.map(f => f.x));
  const cy1 = Math.min(...children.map(f => f.y));
  const cx2 = Math.max(...children.map(direita));
  const cy2 = Math.max(...children.map(baixo));
  return { left: cx1 - parent.x, top: cy1 - parent.y, right: direita(parent) - cx2, bottom: baixo(parent) - cy2 };
}

/** The box that encloses every box. */
function envolvente(boxes) {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map(c => c.x));
  const y = Math.min(...boxes.map(c => c.y));
  return { x, y, w: Math.max(...boxes.map(direita)) - x, h: Math.max(...boxes.map(baixo)) - y };
}

// ---------------------------------------------------------------- segment × rect

/**
 * The segment passes through the INTERIOR of the rectangle.
 *
 * Clips the segment against the box (Liang-Barsky) and checks that what's left
 * has length and falls inside, not on the border. This is what separates "the
 * edge cuts through the VPC" from "the edge leaves a node that touches the VPC".
 */
function segmentCrossesRect(p, q, r) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, p.x - r.x],
    [dx, direita(r) - p.x],
    [-dy, p.y - r.y],
    [dy, baixo(r) - p.y],
  ];
  for (const [pk, qk] of edges) {
    if (Math.abs(pk) < EPS) { if (qk < 0) return false; continue; }
    const t = qk / pk;
    if (pk < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  if (t1 - t0 <= EPS) return false;
  const m = (t0 + t1) / 2;
  const mx = p.x + m * dx;
  const my = p.y + m * dy;
  return mx > r.x + EPS && mx < direita(r) - EPS && my > r.y + EPS && my < baixo(r) - EPS;
}

/** Any segment of the polyline passes through the interior of the rectangle. */
function polilinhaCruzaRetangulo(points, r) {
  for (let i = 0; i + 1 < points.length; i++)
    if (segmentCrossesRect(points[i], points[i + 1], r)) return true;
  return false;
}

// ---------------------------------------------------------------- segment × segment

/**
 * Crossing point in the interior of both segments, or `null`.
 * A shared endpoint returns `null` — incidence is not crossing.
 */
function crossing(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < EPS) return null;            // parallel or collinear
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

/** Acute angle between two lines, in degrees, in [0, 90]. */
function anguloEntre(p1, p2, p3, p4) {
  const a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const b = Math.atan2(p4.y - p3.y, p4.x - p3.x);
  let d = Math.abs((a - b) * 180 / Math.PI) % 180;
  if (d > 90) d = 180 - d;
  return d;
}

/** Interior angle at vertex `b`, in degrees, in [0, 180]. 180 is straight. */
function anguloInterno(a, b, c) {
  const ux = a.x - b.x, uy = a.y - b.y;
  const vx = c.x - b.x, vy = c.y - b.y;
  const nu = Math.hypot(ux, uy);
  const nv = Math.hypot(vx, vy);
  if (nu < EPS || nv < EPS) return 180;            // repeated point: not a bend
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (nu * nv)));
  return Math.acos(cos) * 180 / Math.PI;
}

// ------------------------------------------------------------------------ polyline

function pointSegmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const den = dx * dx + dy * dy;
  if (den < EPS) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / den));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function pointPolylineDistance(p, row) {
  let m = Infinity;
  for (let i = 0; i + 1 < row.length; i++)
    m = Math.min(m, pointSegmentDistance(p, row[i], row[i + 1]));
  return row.length === 1 ? Math.hypot(p.x - row[0].x, p.y - row[0].y) : m;
}

/**
 * Hausdorff distance between two polylines, sampling each one's vertices
 * against the other's segments. This is A5.8's measure: two edges sharing the
 * same origin→destination pair that run too close together produce two
 * illegible labels stacked on a single stroke.
 */
function hausdorff(a, b) {
  if (!a.length || !b.length) return Infinity;
  const out = Math.max(...a.map(p => pointPolylineDistance(p, b)));
  const back = Math.max(...b.map(p => pointPolylineDistance(p, a)));
  return Math.max(out, back);
}

function polylineLength(points) {
  let t = 0;
  for (let i = 0; i + 1 < points.length; i++) t += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  return t;
}

/** Sits on the rectangle's perimeter, within tolerance. */
function noPerimetro(p, r, tol) {
  const inside = p.x >= r.x - tol && p.x <= direita(r) + tol && p.y >= r.y - tol && p.y <= baixo(r) + tol;
  if (!inside) return false;
  const d = Math.min(
    Math.abs(p.x - r.x), Math.abs(p.x - direita(r)),
    Math.abs(p.y - r.y), Math.abs(p.y - baixo(r)));
  return d <= tol;
}

module.exports = {
  EPS, direita, baixo, centro,
  intersectionArea, contem, gap, paddings, envolvente,
  segmentCrossesRect, polilinhaCruzaRetangulo,
  crossing, anguloEntre, anguloInterno,
  pointSegmentDistance, pointPolylineDistance, hausdorff, polylineLength, noPerimetro,
};
