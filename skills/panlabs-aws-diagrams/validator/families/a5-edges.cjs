'use strict';
/**
 * A5 · Edge routing.
 *
 * This is home to the aesthetic with the largest measured effect in the whole
 * literature — Purchase 1997: "reducing the number of edge crosses is by far
 * the most important aesthetic" — and it's also home to A5.5, which isn't
 * aesthetics at all: an edge cutting through someone else's VPC draws a
 * network path that does not exist.
 *
 * The normalized metrics follow the rubric's convention, inherited from GD
 * 2025: **1 = best**. Applies to EC, CA, EO and ELD.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, warning, failure, notApplicable, matches, pairs, mean, roundTo } = require(path.join(__dirname, 'common.cjs'));

/** Every crossing point between two polylines, ignoring incidences. */
function crossingsBetween(a, b) {
  const findings = [];
  for (let i = 0; i + 1 < a.points.length; i++)
    for (let j = 0; j + 1 < b.points.length; j++) {
      const p = g.crossing(a.points[i], a.points[i + 1], b.points[j], b.points[j + 1]);
      if (p) findings.push({ point: p, angle: g.anguloEntre(a.points[i], a.points[i + 1], b.points[j], b.points[j + 1]) });
    }
  return findings;
}

module.exports = function a5(scene) {
  const output = [];
  const edges = scene.edges.filter(a => a.complete);
  const noEdges = id => output.push(notApplicable(id, 'the diagram has no edges'));

  if (!edges.length) {
    for (const id of ['A5.1', 'A5.2', 'A5.3', 'A5.4', 'A5.5', 'A5.6', 'A5.7', 'A5.8', 'A5.9']) noEdges(id);
    return output;
  }

  const degree = scene.degree;   // the scene builds this once; A6.1 and A8.3 read the same map

  // ------------------------------------------------------------- crossings, once
  const crossings = [];
  for (const [a, b] of pairs(edges)) {
    if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;  // incidence
    for (const c of crossingsBetween(a, b)) crossings.push({ ...c, a: a.id, b: b.id });
  }

  // ---------------------------------------------------------------- A5.1
  {
    const E = edges.length;
    const degreeSum = [...degree.values()].reduce((s, d) => s + (d * (d - 1)) / 2, 0);
    const cMax = Math.max(1, (E * (E - 1)) / 2 - degreeSum);

    // The rubric writes `c = Σ_x |E(x)|²`, and that form does NOT normalize
    // against the `c_max` it gives itself: a single simple crossing has
    // |E(x)| = 2, so c = 4, and with two edges (c_max = 1) EC would come out
    // −3, outside [0,1]. `c_max = C(|E|,2) − Σ_v C(deg(v),2)` is the maximum
    // count of PAIRS that can cross, so the numerator has to be in pairs too.
    // Where k edges pass through the same point, the corresponding pair count
    // is C(k,2) — which reduces to the simple count when no three edges are
    // concurrent.
    const byPoint = new Map();
    for (const c of crossings) {
      const key = `${Math.round(c.point.x)},${Math.round(c.point.y)}`;
      if (!byPoint.has(key)) byPoint.set(key, new Set());
      byPoint.get(key).add(c.a).add(c.b);
    }
    const c = [...byPoint.values()].reduce((sum, edgesAtPoint) => {
      const k = edgesAtPoint.size;
      return sum + (k * (k - 1)) / 2;
    }, 0);
    const EC = roundTo(1 - c / cMax);
    const budget = Math.ceil(E / 10);
    const measured = { crossings: crossings.length, cInPairs: c, EC, failBudget: budget, c_max: cMax };
    const occurrences = crossings.map(c => ({ o_que: `"${c.a}" crosses "${c.b}" at (${roundTo(c.point.x, 0)}, ${roundTo(c.point.y, 0)}) at ${roundTo(c.angle, 1)}°`, ids: [c.a, c.b] }));
    output.push(!crossings.length ? ok('A5.1', { measured, mensagem: `0 crossings, EC = ${EC}` })
      : crossings.length > budget ? failure('A5.1', { measured, mensagem: `${crossings.length} crossings, above the budget of ⌈${E}/10⌉ = ${budget}`, occurrences })
        : warning('A5.1', { measured, mensagem: `${crossings.length} crossing(s), EC = ${EC} (target 0)`, occurrences }));
  }

  // ---------------------------------------------------------------- A5.2
  {
    if (!crossings.length) output.push(notApplicable('A5.2', 'there is no crossing to measure the angle of'));
    else {
      const CA = roundTo(1 - mean(crossings.map(c => Math.abs((90 - c.angle) / 90))));
      const minAngle = roundTo(Math.min(...crossings.map(c => c.angle)), 1);
      const floor = lim('minCrossingAngle');
      const q1 = lim('crossingAngleQ1');
      const measured = { CA, minAngle, ideal: lim('idealCrossingAngle') };
      const shallow = crossings.filter(c => c.angle < floor)
        .map(c => ({ o_que: `"${c.a}" and "${c.b}" cross at ${roundTo(c.angle, 1)}° (floor ${floor}°)`, ids: [c.a, c.b] }));
      output.push(shallow.length ? failure('A5.2', { measured, mensagem: `crossing at ${minAngle}°, below the floor of ${floor}°`, occurrences: shallow })
        : CA < q1 ? warning('A5.2', { measured, mensagem: `CA = ${CA} < ${q1} (Q1)`, occurrences: [{ o_que: `smallest angle ${minAngle}°, ideal ${lim('idealCrossingAngle')}°`, ids: [] }] })
          : ok('A5.2', { measured, mensagem: `CA = ${CA}, smallest angle ${minAngle}°` }));
    }
  }

  // ---------------------------------------------------------------- A5.3
  {
    const target = lim('bendsTarget');
    const ceiling = lim('bendsWarn');
    const failFloor = lim('bendsFail');
    const count = edges.map(a => ({ id: a.id, bends: Math.max(0, a.points.length - 2) }));
    const maximum = Math.max(...count.map(c => c.bends));
    const measured = { maximum, mean: roundTo(mean(count.map(c => c.bends)), 2), target, warning: ceiling, failure: failFloor };
    const severe = count.filter(c => c.bends > failFloor).map(c => ({ o_que: `"${c.id}" has ${c.bends} bends (fail above ${failFloor})`, ids: [c.id] }));
    const warned = count.filter(c => c.bends > ceiling && c.bends <= failFloor).map(c => ({ o_que: `"${c.id}" has ${c.bends} bends (target ≤ ${target})`, ids: [c.id] }));
    output.push(severe.length ? failure('A5.3', { measured, mensagem: `${severe.length} edge(s) with more than ${failFloor} bends`, occurrences: severe })
      : warned.length ? warning('A5.3', { measured, mensagem: `${warned.length} edge(s) above ${ceiling} bends`, occurrences: warned })
        : ok('A5.3', { measured, mensagem: `at most ${maximum} bend(s) per edge` }));
  }

  // ---------------------------------------------------------------- A5.4
  {
    const target = lim('bendAngleTarget');
    const floor = lim('bendAngleFail');
    const angles = [];
    for (const a of edges)
      for (let i = 1; i + 1 < a.points.length; i++)
        angles.push({ id: a.id, angle: g.anguloInterno(a.points[i - 1], a.points[i], a.points[i + 1]) });
    if (!angles.length) output.push(notApplicable('A5.4', 'no edge has a bend'));
    else {
      const smallest = Math.min(...angles.map(x => x.angle));
      const measured = { minAngle: roundTo(smallest, 1), target, floor, bends: angles.length };
      const sharp = angles.filter(x => x.angle < floor).map(x => ({ o_que: `"${x.id}" bends at ${roundTo(x.angle, 1)}° (floor ${floor}°)`, ids: [x.id] }));
      const mild = angles.filter(x => x.angle >= floor && x.angle < target).map(x => ({ o_que: `"${x.id}" bends at ${roundTo(x.angle, 1)}° (target ${target}°)`, ids: [x.id] }));
      output.push(sharp.length ? failure('A5.4', { measured, mensagem: `bend of ${roundTo(smallest, 1)}°, below the floor of ${floor}°`, occurrences: sharp })
        : mild.length ? warning('A5.4', { measured, mensagem: `${mild.length} bend(s) below ${target}°`, occurrences: mild })
          : ok('A5.4', { measured, mensagem: `smallest bend ${roundTo(smallest, 1)}°` }));
    }
  }

  // ---------------------------------------------------------------- A5.5
  // A SPURIOUS boundary. The group enters the count when it contains neither
  // endpoint and is not a common ancestor of the two — meaning the edge is
  // cutting through a network boundary it has no relationship with.
  {
    const cases = [];
    for (const a of edges) {
      for (const group of scene.groups) {
        const fromInside = a.from === group.id || scene.isDescendant(a.from, group.id);
        const toInside = a.to === group.id || scene.isDescendant(a.to, group.id);
        if (fromInside || toInside) continue;                 // the edge belongs there, or heads there
        if (g.polilinhaCruzaRetangulo(a.points, group.cellBox))
          cases.push({
            o_que: `edge "${a.id}" (${a.from}→${a.to}) crosses group "${group.id}", ` +
              `which it neither leaves from nor heads to — the drawing suggests a network path that does not exist`,
            ids: [a.id, group.id],
          });
      }
    }
    output.push(matches('A5.5', cases, {
      measured: { edges: edges.length, groups: scene.groups.length, spuriousCrossings: cases.length },
      mensagem: cases.length ? `${cases.length} crossing(s) of someone else's boundary — tolerance is zero` : 'no edge cuts through someone else\'s group',
    }));
  }

  // ---------------------------------------------------------------- A5.6
  {
    const orthogonal = edges.filter(a => a.style.edgeStyle === 'orthogonalEdgeStyle').length > edges.length / 2;
    const deviations = [];
    for (const a of edges) {
      let weightSum = 0;
      let sum = 0;
      for (let i = 0; i + 1 < a.points.length; i++) {
        const dx = a.points[i + 1].x - a.points[i].x;
        const dy = a.points[i + 1].y - a.points[i].y;
        const length = Math.hypot(dx, dy);
        if (length < g.EPS) continue;
        const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 90;
        sum += length * (Math.min(angle, 90 - angle) / 45);
        weightSum += length;
      }
      if (weightSum > 0) deviations.push(sum / weightSum);
    }
    const EO = roundTo(1 - mean(deviations));
    const target = lim('orthogonalityTarget');
    const q1 = lim('orthogonalityQ1');
    const measured = { EO, style: orthogonal ? 'orthogonal' : 'straight', target: orthogonal ? target : q1 };
    output.push(orthogonal
      ? (EO >= target ? ok('A5.6', { measured, mensagem: `EO = ${EO} ≥ ${target}` })
        : warning('A5.6', { measured, mensagem: `orthogonal style declared and EO = ${EO} < ${target}`, occurrences: [{ o_que: 'there are off-axis segments in a routing that claims to be orthogonal', ids: [] }] }))
      : (EO >= q1 ? ok('A5.6', { measured, mensagem: `EO = ${EO}` })
        : warning('A5.6', { measured, mensagem: `EO = ${EO} < ${q1} — a disordered mix of angles`, occurrences: [{ o_que: 'neither orthogonal nor consistently straight', ids: [] }] })));
  }

  // ---------------------------------------------------------------- A5.7
  {
    const minimum = lim('minConsistentFlow');
    const vectors = edges.map(a => {
      const o = scene.byElement.get(a.from);
      const d = scene.byElement.get(a.to);
      return { id: a.id, dx: g.centro(d.cellBox).x - g.centro(o.cellBox).x, dy: g.centro(d.cellBox).y - g.centro(o.cellBox).y };
    });
    // The rubric says to ignore edges perpendicular to the axis (±15°) and
    // pick ONE dominant axis; we measure both and keep whichever the drawing
    // actually uses.
    const measure = (axis) => {
      const used = vectors.filter(v => {
        const angle = Math.abs(Math.atan2(v.dy, v.dx) * 180 / Math.PI);
        const axisDeviation = axis === 'x' ? Math.min(angle, 180 - angle) : Math.abs(90 - angle);
        return axisDeviation <= 75;
      });
      const positive = used.filter(v => (axis === 'x' ? v.dx : v.dy) > 0);
      return { axis, considered: used.length, flow: used.length ? positive.length / used.length : 0, against: used.filter(v => (axis === 'x' ? v.dx : v.dy) <= 0) };
    };
    const candidates = [measure('x'), measure('y')].filter(m => m.considered);
    if (!candidates.length) output.push(notApplicable('A5.7', 'no edge has a clear projection onto an axis'));
    else {
      const best = candidates.sort((a, b) => b.flow - a.flow || b.considered - a.considered)[0];
      const flow = roundTo(best.flow);
      const measured = { axis: best.axis === 'x' ? 'left→right' : 'top→bottom', flow, considered: best.considered, minimum };
      output.push(flow >= minimum ? ok('A5.7', { measured, mensagem: `${roundTo(flow * 100, 0)}% of edges follow ${measured.axis}` })
        : warning('A5.7', {
          measured,
          mensagem: `only ${roundTo(flow * 100, 0)}% follow ${measured.axis} (minimum ${roundTo(minimum * 100, 0)}%)`,
          occurrences: best.against.map(v => ({ o_que: `"${v.id}" runs against the dominant flow`, ids: [v.id] })),
        }));
    }
  }

  // ---------------------------------------------------------------- A5.8
  {
    const separation = lim('parallelEdgeSeparation');
    const cases = [];
    const byPair = new Map();
    for (const a of edges) {
      const key = [a.from, a.to].sort().join('|');
      if (!byPair.has(key)) byPair.set(key, []);
      byPair.get(key).push(a);
    }
    for (const a of edges)
      if (a.polylineLength < g.EPS) cases.push({ o_que: `edge "${a.id}" has zero length`, ids: [a.id] });
    for (const list of byPair.values())
      for (const [a, b] of pairs(list)) {
        const d = g.hausdorff(a.points, b.points);
        if (d < separation) cases.push({ o_que: `"${a.id}" and "${b.id}" link the same pair and run ${roundTo(d, 1)} px apart (minimum ${separation})`, ids: [a.id, b.id] });
      }
    output.push(matches('A5.8', cases, { measured: { pairsWithMultipleEdges: [...byPair.values()].filter(l => l.length > 1).length, stuckTogether: cases.length } }));
  }

  // ---------------------------------------------------------------- A5.9
  // The rubric asks for the calculation SEPARATED by edge class: in a diagram
  // with nested groups, intra-group and inter-group lengths naturally differ,
  // and mixing the two populations fails the correct drawing.
  {
    const q1 = lim('edgeLengthUniformityQ1');
    const classOf = a => {
      const pa = scene.ancestors(a.from).map(x => x.id);
      const pb = scene.ancestors(a.to).map(x => x.id);
      return pa[0] && pa[0] === pb[0] ? 'intra-group' : 'inter-group';
    };
    const byClass = new Map();
    for (const a of edges) {
      const c = classOf(a);
      if (!byClass.has(c)) byClass.set(c, []);
      byClass.get(c).push(a);
    }
    const byMeasure = {};
    const cases = [];
    for (const [cls, list] of byClass) {
      if (list.length < 2) { byMeasure[cls] = { edges: list.length, ELD: null }; continue; }
      const lengths = list.map(a => a.polylineLength);
      const ideal = mean(lengths);
      const ELD = roundTo(1 / (1 + mean(lengths.map(c => Math.abs(c - ideal) / ideal))));
      byMeasure[cls] = { edges: list.length, ELD };
      if (ELD < q1) cases.push({ o_que: `${cls} edges: ELD = ${ELD} < ${q1} (Q1)`, ids: list.map(a => a.id) });
    }
    output.push(matches('A5.9', cases, { measured: { byClass: byMeasure, Q1: q1 } }));
  }

  return output;
};
