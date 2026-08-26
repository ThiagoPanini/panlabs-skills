'use strict';
/**
 * A8 · Volume and complexity.
 *
 * The rubric records the remedy alongside the diagnosis, and the remedy isn't
 * shrinking: it's DECOMPOSING. Moody & Heymans (RE'09) measured that splitting
 * a complex diagram into several simple ones "improve[s] end user
 * understanding by more than 50%". A validator that only says "51 nodes,
 * failed" invites deleting information; the message here says what to do.
 */

const path = require('path');
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, warning, failure, notApplicable, skipped, roundTo } = require(path.join(__dirname, 'common.cjs'));

module.exports = function a8(scene) {
  const output = [];
  const { nodes, edges } = scene;

  // ---------------------------------------------------------------- A8.1
  {
    const V = nodes.length;                       // group boxes don't count
    const target = lim('elementsTarget');
    const ceiling = lim('elementsFail');
    const measured = { nodes: V, groups: scene.groups.length, bands: scene.bands.length, target, ceiling };
    const decompose = { o_que: `the literature's remedy is decomposing into smaller diagrams, not deleting elements (Moody & Heymans, RE'09)`, ids: [] };
    output.push(V <= target ? ok('A8.1', { measured, mensagem: `${V} first-class node(s) (target ≤ ${target})` })
      : V <= ceiling ? warning('A8.1', { measured, mensagem: `${V} nodes — above the target of ${target}`, occurrences: [decompose] })
        : failure('A8.1', { measured, mensagem: `${V} nodes — above the cutoff of ${ceiling}, where node-link loses to a matrix on most tasks`, occurrences: [decompose] }));
  }

  // ---------------------------------------------------------------- A8.2
  {
    const V = nodes.length;
    const E = edges.length;
    if (V < 2) output.push(notApplicable('A8.2', 'fewer than two nodes'));
    else {
      const possible = (V * (V - 1)) / 2;
      const d = roundTo(E / possible);
      const linear = roundTo(E / V, 2);
      const ceiling = lim('maxDensity');
      const target = lim('elementsTarget');
      const measured = { density: d, linearDensity: linear, nodes: V, edges: E, ceiling };
      // The rubric asks for the CONJUNCTION: high density only matters in a large graph.
      output.push(d > ceiling && V > target
        ? warning('A8.2', {
          measured,
          mensagem: `density ${d} > ${ceiling} with ${V} nodes — the combination the literature avoids`,
          occurrences: [{ o_que: 'above 20% density the literature only uses a matrix or edge bundling', ids: [] }],
        })
        : ok('A8.2', { measured, mensagem: `density ${d} (${E} edges for ${V} nodes)` }));
    }
  }

  // ---------------------------------------------------------------- A8.3
  {
    if (!scene.degree.size) output.push(notApplicable('A8.3', edges.length
      ? 'no edge links two ids that exist in the plan'
      : 'the diagram has no edges'));
    else {
      const degree = scene.degree;
      const ceiling = lim('maxFanOut');
      const maximum = Math.max(...degree.values());
      const exceeded = [...degree.entries()].filter(([, d]) => d > ceiling)
        .map(([id, d]) => ({ o_que: `"${id}" has degree ${d} (above ${ceiling}, A6.1's angular resolution becomes mechanically impossible)`, ids: [id] }));
      const measured = { maxDegree: maximum, ceiling, nodesWithEdge: degree.size };
      output.push(exceeded.length
        ? warning('A8.3', { measured, mensagem: `max degree ${maximum}, above ${ceiling}`, occurrences: exceeded })
        : ok('A8.3', { measured, mensagem: `max degree ${maximum}` }));
    }
  }

  // ---------------------------------------------------------------- A8.4
  output.push(skipped('A8.4'));

  return output;
};
