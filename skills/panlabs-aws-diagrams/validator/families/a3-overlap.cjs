'use strict';
/**
 * A3 · Overlap and spatial legibility.
 *
 * The rubric: "the highest practical value — hard failures, zero tolerance,
 * trivially computable, and exactly what an automatic generator gets wrong."
 * Runs first, together with A4, per the §Summary priority order.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, warning, failure, notApplicable, matches, pairs, roundTo, withoutTags, name } = require(path.join(__dirname, 'common.cjs'));


module.exports = function a3(scene) {
  const output = [];
  const { nodes, groups, edges, canvas } = scene;
  // Bands are left out of all of A3: they exist to cross, and `scene.cjs`
  // explains why. What applies to them is the membership check, in `extras`.
  const solid = [...nodes, ...groups];

  // ---------------------------------------------------------------- A3.1
  // "Siblings" is the rubric's word. Every leaf-leaf pair anywhere in the tree
  // is summed, because a leaf never contains a leaf: two icons for different
  // subnets that touch are the same failure, and nothing else would catch it.
  {
    const cases = [];
    const gap = lim('gapBetweenBoxes');
    const candidates = [...pairs(solid)].filter(([a, b]) =>
      (a.parent === b.parent) || (a.kind === 'node' && b.kind === 'node'));
    for (const [a, b] of candidates) {
      if (scene.isDescendant(a.id, b.id) || scene.isDescendant(b.id, a.id)) continue;
      const area = g.intersectionArea(a.cellBox, b.cellBox);
      if (area > 0) cases.push({ o_que: `${name(a)} and ${name(b)} overlap by ${roundTo(area, 0)} px²`, ids: [a.id, b.id] });
      else {
        const d = g.gap(a.cellBox, b.cellBox);
        if (d < gap) cases.push({ o_que: `${name(a)} and ${name(b)} have a ${roundTo(d, 1)} px gap (minimum ${gap})`, ids: [a.id, b.id] });
      }
    }
    output.push(matches('A3.1', cases, {
      measured: { pairsChecked: candidates.length, violations: cases.length },
      message: cases.length ? `${cases.length} pair(s) overlapping or too tight` : `${candidates.length} pairs checked, none touching`,
    }));
  }

  // ---------------------------------------------------------------- A3.2
  {
    const withLabel = [...solid, ...edges].filter(e => e.labelRect);
    const padding = lim('labelPadding');
    const cases = [];
    for (const [a, b] of pairs(withLabel)) {
      const ra = { ...a.labelRect, x: a.labelRect.x - padding, y: a.labelRect.y - padding, w: a.labelRect.w + 2 * padding, h: a.labelRect.h + 2 * padding };
      const area = g.intersectionArea(ra, b.labelRect);
      if (area > 0) cases.push({ o_que: `the labels of ${name(a)} and ${name(b)} intersect by ${roundTo(area, 0)} px²`, ids: [a.id, b.id] });
    }
    output.push(matches('A3.2', cases, {
      measured: { labels: withLabel.length, collisions: cases.length },
      message: cases.length ? `${cases.length} label collision(s)` : `${withLabel.length} labels, none touching another`,
    }));
  }

  // ---------------------------------------------------------------- A3.3
  // A leaf's label is drawn OUTSIDE its box by construction (mxGraph puts it
  // below). Overflowing, for it, means leaving the GROUP — which is when a
  // resource's tag appears outside the VPC it belongs to.
  {
    const cases = [];
    for (const e of solid) {
      const r = e.labelRect;
      if (!r) continue;
      if (r.placement === 'inside') {
        if (!g.contem(e.cellBox, r)) cases.push({ o_que: `${name(e)}'s label does not fit its own box`, ids: [e.id] });
        continue;
      }
      const parent = scene.byElement.get(e.parent);
      const bound = parent && parent.cellBox ? parent.cellBox : canvas;
      if (!g.contem(bound, r)) {
        const where = parent ? `group "${parent.id}"` : 'the canvas';
        cases.push({ o_que: `${name(e)}'s label overflows ${where}`, ids: [e.id] });
      }
    }
    output.push(matches('A3.3', cases, { measured: { overflows: cases.length } }));
  }

  // ---------------------------------------------------------------- A3.4
  {
    const cases = [];
    const withLabel = solid.filter(e => e.labelRect);
    for (const e of withLabel) {
      for (const a of edges) {
        if (!a.complete) continue;
        if (a.from === e.id || a.to === e.id) continue;   // the owner's own edge
        for (let i = 0; i + 1 < a.points.length; i++) {
          if (g.segmentCrossesRect(a.points[i], a.points[i + 1], e.labelRect)) {
            cases.push({ o_que: `edge "${a.id}" runs over ${name(e)}'s label`, ids: [a.id, e.id] });
            break;
          }
        }
      }
    }
    output.push(edges.length ? matches('A3.4', cases, { measured: { crossings: cases.length } })
      : notApplicable('A3.4', 'the diagram has no edges'));
  }

  // ---------------------------------------------------------------- A3.5
  {
    if (!edges.length) output.push(notApplicable('A3.5', 'the diagram has no edges'));
    else {
      const cases = [];
      for (const a of edges) {
        if (!a.complete) continue;
        for (const n of nodes) {
          if (n.id === a.from || n.id === a.to) continue;
          if (g.polilinhaCruzaRetangulo(a.points, n.cellBox))
            cases.push({ o_que: `edge "${a.id}" (${a.from}→${a.to}) crosses ${name(n)}`, ids: [a.id, n.id] });
        }
      }
      output.push(matches('A3.5', cases, { measured: { crossings: cases.length } }));
    }
  }

  // ---------------------------------------------------------------- A3.6
  // Where the anchor was declared, it can be measured. Where it wasn't, the
  // end is PROJECTED onto the perimeter by the renderer, and the scene
  // reconstructs it the same way — measuring there would mean checking the
  // reconstruction against itself. The check reports how many ends were left
  // by construction instead of pretending it checked both.
  {
    if (!edges.length) output.push(notApplicable('A3.6', 'the diagram has no edges'));
    else {
      const tol = lim('anchorTolerance');
      const cases = [];
      let anchored = 0;
      for (const a of edges) {
        if (!a.complete) { cases.push({ o_que: `edge "${a.id}" points at an id that does not exist in the plan`, ids: [a.id] }); continue; }
        if (!a.anchored) continue;
        anchored++;
        const origin = scene.byElement.get(a.from);
        const dest = scene.byElement.get(a.to);
        if (!g.noPerimetro(a.points[0], origin.cellBox, tol))
          cases.push({ o_que: `edge "${a.id}" starts outside ${name(origin)}'s perimeter`, ids: [a.id] });
        if (!g.noPerimetro(a.points[a.points.length - 1], dest.cellBox, tol))
          cases.push({ o_que: `edge "${a.id}" ends outside ${name(dest)}'s perimeter`, ids: [a.id] });
      }
      const byConstruction = edges.length - anchored;
      output.push(matches('A3.6', cases, {
        measured: { anchorsDeclared: anchored, byConstruction },
        message: byConstruction
          ? `${anchored} anchor(s) checked; ${byConstruction} end(s) with no declared anchor — the renderer projects onto the perimeter, so there A3.6 holds by construction, not by measurement`
          : `${anchored} anchors checked`,
      }));
    }
  }

  // ---------------------------------------------------------------- A3.7
  {
    const margin = lim('canvasMargin');
    const all = [...scene.boxes, ...scene.frames].map(e => e.cellBox).filter(Boolean);
    for (const a of edges) if (a.complete) for (const p of a.points) all.push({ x: p.x, y: p.y, w: 0, h: 0 });
    const env = g.envolvente(all);
    const fits = env && g.contem(canvas, env, margin);
    output.push(fits
      ? ok('A3.7', { measured: { envelope: env, canvas, margin }, message: `everything fits in the canvas with ≥ ${margin} px of margin` })
      : failure('A3.7', {
        measured: { envelope: env, canvas, margin },
        message: `the drawing occupies ${env ? `${roundTo(env.w, 0)}×${roundTo(env.h, 0)} from (${roundTo(env.x, 0)},${roundTo(env.y, 0)})` : '(empty)'} and the canvas is ${canvas.w}×${canvas.h} with a margin of ${margin} px`,
        occurrences: [{ o_que: 'the union of the objects does not fit in the canvas with the required margin', ids: [] }],
      }));
  }

  // ---------------------------------------------------------------- A3.8
  {
    const centers = nodes.map(n => g.centro(n.cellBox));
    if (centers.length < 2) output.push(notApplicable('A3.8', 'fewer than two nodes — no pair of distances'));
    else {
      const ds = [...pairs(centers)].map(([a, b]) => Math.hypot(a.x - b.x, a.y - b.y));
      const nr = Math.min(...ds) / Math.max(...ds);
      const q1 = lim('nodeResolutionQ1');
      output.push(nr < q1
        ? warning('A3.8', { measured: { NR: roundTo(nr) }, message: `NR = ${roundTo(nr)} < ${q1} (expert Q1); target ${lim('nodeResolutionMedian')}` })
        : ok('A3.8', { measured: { NR: roundTo(nr) }, message: `NR = ${roundTo(nr)}` }));
    }
  }

  // ---------------------------------------------------------------- A3.9
  {
    const minEdge = lim('minEdgeLabelFontSize');
    const minName = lim('minElementNameFontSize');
    const cases = [];
    for (const e of solid) {
      if (!withoutTags(e.label)) continue;
      if (e.fontSize < minName)
        cases.push({ o_que: `${name(e)} labels at ${e.fontSize} px (element name requires ${minName})`, ids: [e.id] });
    }
    for (const a of edges) {
      if (!withoutTags(a.label)) continue;
      const px = parseFloat(a.style.fontSize) || 12;
      if (px < minEdge) cases.push({ o_que: `edge "${a.id}" labels at ${px} px (edge label requires ${minEdge})`, ids: [a.id] });
    }
    output.push(matches('A3.9', cases, { measured: { belowFloor: cases.length } }));
  }

  return output;
};
