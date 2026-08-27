'use strict';
/**
 * A2 · Notation, consistency and vocabulary.
 *
 * The rubric places this family 5th in implementation order, but notes it's
 * where all five guides — C4, AWS deck, Azure WAF, Azure Icons, IBM — agree
 * without exception. It's the cheapest family to satisfy and the easiest to
 * break without noticing, because each isolated violation looks harmless.
 */

const path = require('path');
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, warning, failure, notApplicable, skipped, matches, roundTo, withoutTags, name } = require(path.join(__dirname, 'common.cjs'));
const { catalog, fillOf, stencilOf } = require(path.join(__dirname, 'catalog.cjs'));


/** Arrowheads the AWS deck's presets cover. */
const PRESET_ARROWS = new Set(['none', 'block', 'blockThin', 'open', 'openThin', 'classic', 'classicThin', 'oval', 'diamond', 'diamondThin', 'halfCircle', 'baseDash', 'ERone', 'ERmandOne']);

/** Chartjunk marks: effects that carry no data. */
const CHARTJUNK = [
  ['shadow', e => e.style.shadow === '1', 'shadow'],
  ['glass', e => e.style.glass === '1', 'glassy glow'],
  ['sketch', e => e.style.sketch === '1', 'sketchy stroke'],
  ['gradient', e => e.style.gradientColor && e.style.gradientColor !== 'none', 'gradient'],
  ['perspective', e => e.style.shape === 'cube' || e.style.isometric === '1', 'perspective/isometry'],
];

module.exports = function a2(scene) {
  const output = [];
  const cat = catalog();
  const { nodes, groups, bands, edges } = scene;
  const drawable = [...nodes, ...groups, ...bands];

  // ---------------------------------------------------------------- A2.1
  // Counts symbol TYPES, not instances — "twenty Lambdas = 1 entry".
  {
    const symbols = new Set(drawable.map(e =>
      [e.fill, e.stroke, e.style.dashed === '1' ? 'dashed' : 'solid', e.style.shape || (e.style.container === '1' ? 'container' : 'cellBox')].join('|')));
    for (const a of edges) symbols.add(['edge', a.style.strokeColor, a.style.dashed === '1' ? 'dashed' : 'solid', a.style.endArrow].join('|'));
    const n = symbols.size;
    const target = lim('graphicComplexityTarget');
    const ceiling = lim('graphicComplexityFail');
    const measured = { entriesNeeded: n, target, ceiling };
    output.push(n <= target ? ok('A2.1', { measured, message: `${n} symbol type(s) (target ≤ ${target})` })
      : n <= ceiling ? warning('A2.1', { measured, message: `${n} symbol types — above the target of ${target}, still within ${ceiling}`, occurrences: [{ o_que: `the legend would need ${n} entries`, ids: [] }] })
        : failure('A2.1', { measured, message: `${n} symbol types — above the limit of ${ceiling} (span of absolute judgement)`, occurrences: [{ o_que: `the legend would need ${n} entries; Moody puts the effective ceiling at ${target}`, ids: [] }] }));
  }

  // ---------------------------------------------------------------- A2.2
  {
    const cases = [];
    for (const e of drawable) {
      const s = e.style;
      const deformations = [];
      if (s.flipH === '1') deformations.push('mirrored horizontally');
      if (s.flipV === '1') deformations.push('mirrored vertically');
      if (s.rotation && parseFloat(s.rotation) !== 0) deformations.push(`rotated ${s.rotation}°`);
      if (s.direction && s.direction !== 'east') deformations.push(`direction "${s.direction}"`);
      if (deformations.length) cases.push({ o_que: `${name(e)} is ${deformations.join(' and ')}`, ids: [e.id] });
    }
    output.push(matches('A2.2', cases, { measured: { objects: drawable.length, deformed: cases.length } }));
  }

  // ---------------------------------------------------------------- A2.3
  {
    if (!cat) output.push(notApplicable('A2.3', 'the shape catalog is not available'));
    else if (!scene.model) output.push(notApplicable('A2.3', 'the plan does not carry the model, so there is no way to know which service each node asked for'));
    else {
      const byModelId = new Map((scene.model.nodes || []).map(n => [n.id, n]));
      const cases = [];
      let checked = 0;
      for (const e of nodes) {
        const m = byModelId.get(e.id);
        const key = m && (m.service || (m.kind === 'actor' ? 'users' : null));
        if (!key) continue;
        const official = cat.service(key);
        if (!official) continue;
        checked++;
        const expected = fillOf(official.style);
        if (expected && e.fill && expected.toLowerCase() !== e.fill.toLowerCase())
          cases.push({ o_que: `${name(e)} paints ${e.fill} and the catalog prescribes ${expected} for "${official.title}"`, ids: [e.id] });
      }
      output.push(matches('A2.3', cases, {
        measured: { checked, diverging: cases.length },
        message: `${checked} icon(s) checked against the catalog's declared color — the pixel hash belongs to render`,
      }));
    }
  }

  // ---------------------------------------------------------------- A2.4
  {
    if (!cat) output.push(notApplicable('A2.4', 'the shape catalog is not available'));
    else {
      const cases = [];
      let withStencil = 0;
      for (const e of nodes) {
        const id = stencilOf(e.rawStyle);
        if (!id) continue;
        withStencil++;
        if (!cat.ids.has(id)) cases.push({ o_que: `${name(e)} uses stencil "${id}", which is not in the current catalog`, ids: [e.id] });
      }
      output.push(matches('A2.4', cases, {
        measured: { withStencil, outsideCatalog: cases.length, asOf: cat.asOf },
        message: `catalog as of ${cat.asOf || 'unknown date'}; ${withStencil} icon(s) with a declared stencil`,
      }));
    }
  }

  // ---------------------------------------------------------------- A2.5
  {
    const byClass = new Map();
    for (const e of nodes) {
      const cls = e.semanticKind || 'unknown';
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls).push(e);
    }
    const cases = [];
    for (const [cls, list] of byClass) {
      if (list.length < 2) continue;
      const widths = list.map(e => e.cellBox.w);
      const ratio = Math.max(...widths) / Math.min(...widths);
      if (ratio !== 1)
        cases.push({ o_que: `class "${cls}" uses widths from ${Math.min(...widths)} to ${Math.max(...widths)} px (ratio ${roundTo(ratio, 2)})`, ids: list.map(e => e.id) });
    }
    output.push(byClass.size ? matches('A2.5', cases, { measured: { classes: byClass.size, irregular: cases.length } })
      : notApplicable('A2.5', 'the diagram has no nodes'));
  }

  // ---------------------------------------------------------------- A2.6
  {
    const channels = ['fillColor', 'strokeColor', 'strokeWidth', 'dashed', 'shape'];
    // "For each `type`" means the ELEMENT's type — Lambda, RDS, public subnet
    // — not the model's coarse type. Getting the granularity wrong breaks
    // A2.6 in both directions, and both wrong versions have already shown up
    // in a measurement:
    //
    //   too coarse (the model's `type`): every `service` in one bucket, and
    //   the check fails AWS's own official palette, where each service HAS
    //   its own color. It exists to catch two Lambdas in different colors.
    //
    //   too fine but at the wrong layer (the stencil): a public and a private
    //   subnet share the `group_security_group` stencil and are DIFFERENT
    //   types, with different colors on purpose — and the check flags the
    //   convention.
    //
    // The right key lives in the model, which is what actually knows what
    // discriminates the type: the `kind` plus whatever fields specialize it
    // (`service`, `access`).
    const kindOf = (e) => {
      const m = e.modelNode;
      if (m && m.kind) return [m.kind, m.service, m.access].filter(Boolean).join('/');
      return stencilOf(e.rawStyle) || e.semanticKind || 'unknown';
    };
    const byKind = new Map();
    for (const e of [...nodes, ...groups]) {
      const t = kindOf(e);
      if (!byKind.has(t)) byKind.set(t, []);
      byKind.get(t).push(e);
    }
    const cases = [];
    for (const [kind, list] of byKind) {
      if (list.length < 2) continue;
      for (const channel of channels) {
        const values = new Set(list.map(e => e.style[channel] === undefined ? '(absent)' : e.style[channel]));
        if (values.size > 1)
          cases.push({ o_que: `type "${kind}" uses ${values.size} values of ${channel}: ${[...values].join(', ')}`, ids: list.map(e => e.id) });
      }
    }
    output.push(byKind.size ? matches('A2.6', cases, { measured: { types: byKind.size, inconsistencies: cases.length } })
      : notApplicable('A2.6', 'the diagram has no typed elements'));
  }

  // ---------------------------------------------------------------- A2.7
  {
    if (!edges.length) output.push(notApplicable('A2.7', 'the diagram has no edges'));
    else {
      // The meaning of a relationship is the RELATIONSHIP TYPE the model
      // declares — here, `protocol`. Deriving meaning from the pair of
      // endpoint types would be inventing a taxonomy: "actor→service" and
      // "service→service" are not two line meanings, they are two positions
      // in the graph, and failing on that would accuse every diagram with
      // more than one node shape of being ambiguous. Edges that declare no
      // type are left out: absence is not ambiguity.
      const model = scene.model || {};
      const declaredKind = new Map((model.edges || [])
        .map(a => [`${a.from}→${a.to}`, a.protocol || a.kind || null]));
      const withKind = edges.filter(a => declaredKind.get(`${a.from}→${a.to}`));
      const byStyle = new Map();
      const byMeaning = new Map();
      for (const a of withKind) {
        const style = a.style.dashed === '1' ? `dashed(${a.style.dashPattern || 'default'})` : 'solid';
        const meaning = declaredKind.get(`${a.from}→${a.to}`);
        if (!byStyle.has(style)) byStyle.set(style, new Set());
        byStyle.get(style).add(meaning);
        if (!byMeaning.has(meaning)) byMeaning.set(meaning, new Set());
        byMeaning.get(meaning).add(style);
      }
      if (byMeaning.size < 2) {
        output.push(notApplicable('A2.7', withKind.length
          ? 'only one relationship type is declared — there is no bijection to check'
          : 'no edge declares a relationship type (protocol); with no taxonomy there is nothing to map'));
      } else {
        const cases = [];
        for (const [style, meanings] of byStyle)
          if (meanings.size > 1) cases.push({ o_que: `stroke "${style}" carries ${meanings.size} meanings: ${[...meanings].join(', ')}`, ids: withKind.map(a => a.id) });
        for (const [meaning, styles] of byMeaning)
          if (styles.size > 1) cases.push({ o_que: `relationship "${meaning}" is drawn ${styles.size} different ways: ${[...styles].join(', ')}`, ids: [] });
        output.push(matches('A2.7', cases, { measured: { styles: byStyle.size, meanings: [...byMeaning.keys()], bijectionBreaks: cases.length } }));
      }
    }
  }

  // ---------------------------------------------------------------- A2.8
  {
    // Containment (cloud, region, VPC, subnet) draws solid; logical zone (AZ,
    // Auto Scaling) draws dashed. That's IBM's mapping, and the rubric warns
    // AWS does not publish its own as a norm — hence `warn`.
    // `region` is left out on purpose: AWS draws the Region border DASHED in
    // its own deck, and the catalog reproduces that. It is a geographic
    // boundary, not a network boundary — same family as the zones.
    const containment = new Set(['cloud', 'account', 'vpc', 'subnet', 'security-group']);
    const cases = [];
    for (const e of groups) {
      const t = e.semanticKind;
      if (!t || !containment.has(t)) continue;
      if (e.style.dashed === '1') cases.push({ o_que: `containment group "${e.id}" (${t}) draws dashed, and dashed is the zone convention`, ids: [e.id] });
    }
    for (const f of bands)
      if (f.style.dashed !== '1') cases.push({ o_que: `band "${f.id}" draws solid, and solid is the containment convention`, ids: [f.id] });
    output.push((groups.length + bands.length) ? matches('A2.8', cases, { measured: { groups: groups.length, bands: bands.length, outsideConvention: cases.length } })
      : notApplicable('A2.8', 'the diagram has no groups or bands'));
  }

  // ---------------------------------------------------------------- A2.9
  output.push(skipped('A2.9'));

  // ---------------------------------------------------------------- A2.10
  {
    if (!edges.length) output.push(notApplicable('A2.10', 'the diagram has no edges'));
    else {
      const cases = [];
      for (const a of edges)
        for (const tip of ['startArrow', 'endArrow']) {
          const v = a.style[tip];
          if (v === undefined) continue;
          if (!PRESET_ARROWS.has(v)) cases.push({ o_que: `edge "${a.id}" uses ${tip}="${v}", outside the presets`, ids: [a.id] });
        }
      output.push(matches('A2.10', cases, { measured: { edges: edges.length, outsidePresets: cases.length } }));
    }
  }

  // ---------------------------------------------------------------- A2.11
  {
    const cases = [];
    for (const e of [...drawable, ...edges])
      for (const [, test, label] of CHARTJUNK)
        if (test(e)) cases.push({ o_que: `${e.id} uses ${label} — ink that carries no data`, ids: [e.id] });
    output.push(matches('A2.11', cases, { measured: { objects: drawable.length + edges.length, withChartjunk: cases.length } }));
  }

  return output;
};
