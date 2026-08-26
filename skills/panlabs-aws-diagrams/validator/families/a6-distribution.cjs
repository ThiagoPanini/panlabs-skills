'use strict';
/**
 * A6 · Distribution and overall shape.
 *
 * Last in the rubric's priority order, together with A8, and it says why:
 * "fine tuning; softer thresholds". Three of the five report a Mooney et al.
 * (GD 2025) metric against the expert-drawing Q1 — a comparison ruler, not a
 * failure.
 *
 * A6.5 is the weakest of all, and the rubric itself warns: "in an
 * architecture diagram, position is dictated by groups (VPC/AZ), not by graph
 * distance. Low priority; probably noise." It stays implemented and measured,
 * with the warning next to the number — computing it is cheap, and hiding a
 * metric the rubric listed just means never finding out it really was noise.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, warning, failure, notApplicable, pairs, mean, roundTo } = require(path.join(__dirname, 'common.cjs'));

/** Graph distances via BFS, starting from one node. */
function bfs(start, neighbors) {
  const d = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const v of neighbors.get(current) || [])
      if (!d.has(v)) { d.set(v, d.get(current) + 1); queue.push(v); }
  }
  return d;
}

module.exports = function a6(scene) {
  const output = [];
  const { nodes, edges, canvas } = scene;
  const centers = new Map(nodes.map(n => [n.id, g.centro(n.cellBox)]));

  // ---------------------------------------------------------------- A6.1
  {
    // The angle an edge LEAVES a node at is only a fact about the drawing
    // when the anchor was declared. Without an anchor, the scene projects the
    // end onto the perimeter toward the target, and two edges heading the
    // same way leave from the same point at the same angle — a reconstruction
    // artifact, not a diagram fact. mxGraph pulls the two apart at render
    // time (`jettySize=auto`). So: `fail` only where an anchor is declared;
    // without one, `warning` with the caveat.
    const incident = new Map();
    let someUnanchored = false;
    for (const a of edges.filter(x => x.complete)) {
      if (!a.anchored) someUnanchored = true;
      const record = (who, p1, p2) => {
        if (!centers.has(who)) return;
        if (!incident.has(who)) incident.set(who, []);
        incident.get(who).push({ angle: Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI, anchored: !!a.anchored });
      };
      record(a.from, a.points[0], a.points[1] || a.points[0]);
      record(a.to, a.points[a.points.length - 1], a.points[a.points.length - 2] || a.points[0]);
    }
    const withDegree = [...incident.entries()].filter(([, angs]) => angs.length > 1);
    if (!withDegree.length) output.push(notApplicable('A6.1', 'no node has two or more incident edges'));
    else {
      const q1 = lim('angularResolutionQ1');
      const absoluteFloor = lim('minIncidentAngle');
      const terms = [];
      const tight = [];          // declared anchor: the angle is a fact of the plan
      const reconstructed = [];  // no anchor: the angle is the scene's guess
      for (const [id, records] of withDegree) {
        const angles = records.map(r => r.angle);
        const allAnchored = records.every(r => r.anchored);
        const sorted = [...angles].sort((a, b) => a - b);
        let smallest = 360;
        for (let i = 0; i < sorted.length; i++) {
          const next = sorted[(i + 1) % sorted.length];
          let d = next - sorted[i];
          if (i === sorted.length - 1) d += 360;
          smallest = Math.min(smallest, Math.abs(d));
        }
        const ideal = 360 / angles.length;
        terms.push(Math.abs((ideal - smallest) / ideal));
        if (smallest < absoluteFloor)
          (allAnchored ? tight : reconstructed).push({
            o_que: `two edges leave "${id}" ${roundTo(smallest, 1)}° apart (floor ${absoluteFloor}°)` +
              (allAnchored ? '' : ' — reconstructed angle, no declared anchor'),
            ids: [id],
          });
      }
      const AR = roundTo(1 - mean(terms));
      const measured = {
        AR, nodesWithDegreeAboveOne: withDegree.length, absoluteFloor,
        reconstructedAngles: someUnanchored,
      };
      output.push(tight.length
        ? failure('A6.1', { measured, mensagem: `${tight.length} pair(s) of incident edges are indistinguishable`, occurrences: tight })
        : reconstructed.length
          ? warning('A6.1', {
            measured,
            mensagem: `${reconstructed.length} pair(s) of edges look like they leave together, but the ends were reconstructed — ` +
              'the renderer pulls the two apart (jettySize=auto). Declare the anchor to turn this into a measurement',
            occurrences: reconstructed,
          })
          : AR < q1 ? warning('A6.1', { measured, mensagem: `AR = ${AR} < ${q1} (Q1)`, occurrences: [{ o_que: 'edges fan out unevenly from the nodes', ids: [] }] })
            : ok('A6.1', { measured, mensagem: `AR = ${AR}` }));
    }
  }

  // ---------------------------------------------------------------- A6.2
  {
    if (nodes.length < 2) output.push(notApplicable('A6.2', 'fewer than two nodes'));
    else {
      const V = nodes.length;
      const env = g.envolvente(nodes.map(n => n.cellBox));
      const columns = Math.floor(Math.sqrt(V)) || 1;
      const rows = Math.ceil(V / columns);
      const T = columns * rows;
      const bucket = new Map();
      for (const n of nodes) {
        const c = g.centro(n.cellBox);
        const i = Math.min(columns - 1, Math.floor(((c.x - env.x) / (env.w || 1)) * columns));
        const j = Math.min(rows - 1, Math.floor(((c.y - env.y) / (env.h || 1)) * rows));
        const key = `${i},${j}`;
        bucket.set(key, (bucket.get(key) || 0) + 1);
      }
      const mu = V / T;
      const dMax = (2 * V * (T - 1)) / T;
      let sum = 0;
      for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) sum += Math.abs((bucket.get(`${i},${j}`) || 0) - mu);
      const NU = roundTo(dMax > 0 ? 1 - sum / dMax : 1);
      const q1 = lim('nodeUniformityQ1');
      const measured = { NU, grid: `${columns}×${rows}`, nodes: V };
      output.push(NU < q1
        ? warning('A6.2', { measured, mensagem: `NU = ${NU} < ${q1} (Q1) — there's clumping and empty space`, occurrences: [{ o_que: `${[...bucket.values()].filter(v => v === 0).length || T - bucket.size} grid cell(s) are empty`, ids: [] }] })
        : ok('A6.2', { measured, mensagem: `NU = ${NU}` }));
    }
  }

  // ---------------------------------------------------------------- A6.3
  {
    const env = g.envolvente(scene.boxes.map(e => e.cellBox));
    if (!env || !env.w || !env.h) output.push(notApplicable('A6.3', 'the drawing has no area'));
    else {
      // `Asp` is Mooney's metric and is `min/max` by definition — it measures
      // elongation, not orientation. But the SECOND half of A6.3, which
      // compares the drawing to the canvas, cannot use min/max: a drawing
      // lying sideways on a portrait page, with the same ratio, would give
      // ZERO difference and pass — which is exactly the "big empty band"
      // case this threshold is chasing. There the ratio has to be oriented.
      const asp = roundTo(Math.min(env.h, env.w) / Math.max(env.h, env.w));
      const drawingRatio = env.w / env.h;
      const canvasRatio = canvas.w / canvas.h;
      const difference = roundTo(Math.abs(drawingRatio - canvasRatio) / (canvasRatio || 1));
      const q1 = lim('aspectRatioQ1');
      const tol = lim('aspectRatioTolerance');
      const measured = {
        Asp: asp, drawingRatio: roundTo(drawingRatio, 2), canvasRatio: roundTo(canvasRatio, 2),
        relativeDifference: difference, Q1: q1, tolerance: tol,
      };
      const reasons = [];
      if (asp < q1) reasons.push({ o_que: `Asp = ${asp} < ${q1} (Q1): the drawing is a very elongated strip`, ids: [] });
      if (difference > tol) reasons.push({ o_que: `the drawing's ratio differs from the canvas's by ${roundTo(difference * 100, 0)}% (tolerance ${roundTo(tol * 100, 0)}%): there's empty space left over`, ids: [] });
      output.push(reasons.length ? warning('A6.3', { measured, mensagem: reasons.map(m => m.o_que).join('; '), occurrences: reasons })
        : ok('A6.3', { measured, mensagem: `Asp = ${asp}` }));
    }
  }

  // ---------------------------------------------------------------- A6.4
  {
    if (nodes.length < 2) output.push(notApplicable('A6.4', 'fewer than two nodes'));
    else {
      const step = lim('gridStep');
      const minimum = lim('minAlignment');
      const onGrid = v => Math.round(v / step);
      const aligned = nodes.filter(n => {
        const c = g.centro(n.cellBox);
        return nodes.some(o => o.id !== n.id && (onGrid(g.centro(o.cellBox).x) === onGrid(c.x) || onGrid(g.centro(o.cellBox).y) === onGrid(c.y)));
      });
      const fraction = roundTo(aligned.length / nodes.length);
      const measured = { alignedFraction: fraction, minimum, step, nodes: nodes.length };
      const loose = nodes.filter(n => !aligned.includes(n)).map(n => ({ o_que: `${n.id} shares no axis with any other node`, ids: [n.id] }));
      output.push(fraction >= minimum
        ? ok('A6.4', { measured, mensagem: `${roundTo(fraction * 100, 0)}% of nodes aligned with at least one other` })
        : warning('A6.4', { measured, mensagem: `only ${roundTo(fraction * 100, 0)}% aligned (minimum ${roundTo(minimum * 100, 0)}%)`, occurrences: loose }));
    }
  }

  // ---------------------------------------------------------------- A6.5
  {
    const withEdge = edges.filter(a => a.complete && centers.has(a.from) && centers.has(a.to));
    if (withEdge.length < 2 || nodes.length < 3) output.push(notApplicable('A6.5', 'the graph is too small for stress or neighborhood preservation'));
    else {
      const neighbors = new Map(nodes.map(n => [n.id, []]));
      for (const a of withEdge) { neighbors.get(a.from).push(a.to); neighbors.get(a.to).push(a.from); }

      // graph distances, only between connected pairs
      const graphDist = new Map();
      for (const n of nodes) graphDist.set(n.id, bfs(n.id, neighbors));

      const connectedPairs = [];
      for (const [a, b] of pairs(nodes)) {
        const d = graphDist.get(a.id).get(b.id);
        if (d === undefined) continue;
        connectedPairs.push({ a, b, d, euclidean: Math.hypot(centers.get(a.id).x - centers.get(b.id).x, centers.get(a.id).y - centers.get(b.id).y) });
      }
      if (!connectedPairs.length) output.push(notApplicable('A6.5', 'the graph is fully disconnected'));
      else {
        // optimal scale: minimizes Σ (α·euclidean − d)²/d²  →  α = Σ(e/d) / Σ(e²/d²)
        const num = connectedPairs.reduce((s, p) => s + p.euclidean / p.d, 0);
        const den = connectedPairs.reduce((s, p) => s + (p.euclidean ** 2) / (p.d ** 2), 0);
        const alpha = den > 0 ? num / den : 1;
        const stress = mean(connectedPairs.map(p => ((alpha * p.euclidean - p.d) ** 2) / (p.d ** 2)));
        const KSM = roundTo(1 / (1 + stress));

        // neighborhood preservation: the k nearest in the drawing against the k graph neighbors
        const NPs = [];
        for (const n of nodes) {
          const k = (neighbors.get(n.id) || []).length;
          if (!k) continue;
          const nearest = nodes.filter(o => o.id !== n.id)
            .sort((x, y) => Math.hypot(centers.get(x.id).x - centers.get(n.id).x, centers.get(x.id).y - centers.get(n.id).y)
              - Math.hypot(centers.get(y.id).x - centers.get(n.id).x, centers.get(y.id).y - centers.get(n.id).y))
            .slice(0, k).map(o => o.id);
          const actual = new Set(neighbors.get(n.id));
          NPs.push(nearest.filter(id => actual.has(id)).length / k);
        }
        const NP = roundTo(mean(NPs));
        const q1NP = lim('neighborhoodPreservationQ1');
        const q1KSM = lim('stressQ1');
        const measured = {
          NP, KSM, Q1_NP: q1NP, Q1_KSM: q1KSM,
          formula_KSM: '1/(1+stress) with optimal scaling — the exact normalization from Mooney\'s eq. (8) was not accessed; see U10 of the rubric',
          caveat: 'the rubric itself classifies A6.5 as probably noise in an architecture diagram, where position is dictated by the groups',
        };
        const reasons = [];
        if (NP < q1NP) reasons.push({ o_que: `NP = ${NP} < ${q1NP} (Q1)`, ids: [] });
        if (KSM < q1KSM) reasons.push({ o_que: `KSM = ${KSM} < ${q1KSM} (Q1)`, ids: [] });
        output.push(reasons.length
          ? warning('A6.5', { measured, mensagem: `${reasons.map(m => m.o_que).join('; ')} — but see the caveat: here position comes from the groups, not the graph`, occurrences: reasons })
          : ok('A6.5', { measured, mensagem: `NP = ${NP}, KSM = ${KSM}` }));
      }
    }
  }

  return output;
};
