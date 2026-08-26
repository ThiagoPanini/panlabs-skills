'use strict';
/**
 * A7 · Color accessibility.
 *
 * The validator's only NORMATIVE family: the numbers are WCAG 2.2's, not a
 * taste percentile. Four of the five are `fail`, and that's what the rubric
 * says — "normative, deterministic, no room for debate".
 *
 * Every measurement here depends on the EFFECTIVE BACKGROUND, which is
 * decision 4 of ticket #18 and lives in `scene.effectiveBackgroundAt`: the
 * stack of groups composited in z-order, not the page color. Measuring an
 * EC2 label's contrast against the canvas white, when it sits inside a
 * subnet inside a VPC inside the cloud, gives a contrast that exists nowhere
 * in the drawing.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const color = require(path.join(__dirname, '..', 'color.cjs'));
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, notApplicable, matches, pairs, roundTo, withoutTags, name } = require(path.join(__dirname, 'common.cjs'));


/** WCAG's floor depends on size: large text asks for less. */
function textFloor(px, bold) {
  const large = px >= lim('largeTextPx') || (bold && px >= lim('largeBoldTextPx'));
  return { floor: large ? lim('largeTextContrast') : lim('smallTextContrast'), large };
}

module.exports = function a7(scene) {
  const output = [];
  const { nodes, groups, bands, edges } = scene;
  const labelable = [...nodes, ...groups, ...bands];

  // ---------------------------------------------------------------- A7.1
  {
    const cases = [];
    const sampled = [];
    for (const e of labelable) {
      if (!withoutTags(e.label) || !e.labelRect) continue;
      const background = scene.labelBackground(e);
      const ratio = color.contraste(e.fontColor, background);
      if (ratio === null) continue;
      const { floor, large } = textFloor(e.fontSize, e.bold);
      sampled.push({ id: e.id, ratio: roundTo(ratio, 2), floor });
      if (ratio < floor)
        cases.push({ o_que: `${name(e)}: ${e.fontColor} over ${background} gives ${roundTo(ratio, 2)}:1 (floor ${floor}:1 for ${large ? 'large text' : `${e.fontSize} px`})`, ids: [e.id] });
    }
    for (const a of edges) {
      if (!withoutTags(a.label) || !a.complete) continue;
      const background = a.halo || scene.effectiveBackgroundAt(scene.midpoint(a.points), a.z);
      const ratio = color.contraste(a.fontColor, background);
      if (ratio === null) continue;
      const { floor } = textFloor(a.fontSize, a.bold);
      sampled.push({ id: a.id, ratio: roundTo(ratio, 2), floor });
      if (ratio < floor) cases.push({ o_que: `edge "${a.id}": ${a.fontColor} over ${background} gives ${roundTo(ratio, 2)}:1 (floor ${floor}:1)`, ids: [a.id] });
    }
    const worst = sampled.length ? sampled.reduce((m, x) => (x.ratio < m.ratio ? x : m)) : null;
    output.push(sampled.length
      ? matches('A7.1', cases, { measured: { texts: sampled.length, worst: worst && { id: worst.id, ratio: worst.ratio }, belowFloor: cases.length } })
      : notApplicable('A7.1', 'there is no text to measure'));
  }

  // ---------------------------------------------------------------- A7.2
  {
    const floor = lim('nonTextContrast');
    const cases = [];
    let sampled = 0;
    const checkContrast = (who, ink, point, z, description) => {
      if (!color.ehCor(ink)) return;
      const background = scene.effectiveBackgroundAt(point, z);
      const ratio = color.contraste(ink, background);
      if (ratio === null) return;
      sampled++;
      if (ratio < floor) cases.push({ o_que: `${description}: ${ink} over ${background} gives ${roundTo(ratio, 2)}:1 (floor ${floor}:1)`, ids: [who] });
    };
    for (const e of [...groups, ...bands]) checkContrast(e.id, e.stroke, { x: e.cellBox.x, y: e.cellBox.y + e.cellBox.h / 2 }, e.z, `the border of "${e.id}"`);
    // On a service icon the stroke is the drawing's inner WHITE outline, not
    // the silhouette: measuring it against the background gives
    // white-on-white and flags 1:1 on an icon that's perfectly visible. What
    // carries the information and needs to stand out from what's behind it
    // is the FILL — the colored square.
    for (const e of nodes) checkContrast(e.id, e.fill || e.stroke, g.centro(e.cellBox), e.z, `${name(e)}`);
    for (const a of edges.filter(x => x.complete)) {
      checkContrast(a.id, a.stroke, scene.midpoint(a.points), a.z, `edge "${a.id}"'s stroke`);
      // The rubric names four targets, and the arrowhead is the fourth. In
      // mxGraph it's painted with the edge's own `strokeColor`, so the COLOR
      // is the same — what changes is the BACKGROUND: the tip touches the
      // destination's perimeter, often already inside a group with its own
      // fill, while the middle of the stroke may sit over the page. Two
      // measurements, not one.
      const tip = a.points[a.points.length - 1];
      checkContrast(a.id, a.stroke, tip, a.z, `edge "${a.id}"'s arrowhead`);
    }
    output.push(sampled ? matches('A7.2', cases, { measured: { elementsSampled: sampled, belowFloor: cases.length, floor } })
      : notApplicable('A7.2', 'there is no stroke or fill to measure'));
  }

  // ---------------------------------------------------------------- A7.3
  {
    // A "meaning" is the semantic type. If two types differ only by fill
    // color, whoever cannot see that color difference does not distinguish
    // them — which is literally SC 1.4.1.
    const byMeaning = new Map();
    for (const e of [...nodes, ...groups, ...bands]) {
      const key = e.semanticKind || e.kind;
      if (!byMeaning.has(key))
        byMeaning.set(key, {
          fill: e.fill, stroke: e.stroke,
          strokeStyle: e.style.dashed === '1' ? 'dashed' : 'solid',
          shape: e.style.shape || (e.style.container === '1' ? 'container' : 'cellBox'),
          ids: [],
        });
      byMeaning.get(key).ids.push(e.id);
    }
    const cases = [];
    for (const [[ka, a], [kb, b]] of pairs([...byMeaning.entries()])) {
      const colorOnly = a.fill !== b.fill
        && a.strokeStyle === b.strokeStyle && a.shape === b.shape && a.stroke === b.stroke;
      if (colorOnly) cases.push({ o_que: `"${ka}" and "${kb}" are distinguished only by fill color (${a.fill} vs ${b.fill})`, ids: [...a.ids.slice(0, 3), ...b.ids.slice(0, 3)] });
    }
    output.push(byMeaning.size > 1
      ? matches('A7.3', cases, { measured: { meanings: byMeaning.size, colorOnly: cases.length } })
      : notApplicable('A7.3', 'there are fewer than two distinct meanings to compare'));
  }

  // ---------------------------------------------------------------- A7.4
  {
    const minimum = lim('minDeltaE00');
    // "any two colors that carry distinct meanings" — not just the fill. A
    // group's border is the channel that distinguishes VPC from subnet from
    // AZ in this catalog, and leaving it out made A7.4 measure only half the
    // palette.
    const byColor = new Map();
    const recordColor = (hex, meaning) => {
      if (!color.ehCor(hex)) return;
      if (!byColor.has(hex)) byColor.set(hex, new Set());
      byColor.get(hex).add(meaning);
    };
    for (const e of [...nodes, ...groups, ...bands]) {
      const key = e.semanticKind || e.kind;
      recordColor(e.fill, key);
      recordColor(e.stroke, key);
    }
    const colors = [...byColor.keys()];
    if (colors.length < 2) output.push(notApplicable('A7.4', 'fewer than two colors in use'));
    else {
      const cases = [];
      let worst = { deltaE: Infinity };
      for (const [a, b] of pairs(colors)) {
        // only matters when the two colors carry DIFFERENT meanings
        const ma = byColor.get(a);
        const mb = byColor.get(b);
        if ([...ma].every(x => mb.has(x)) && ma.size === mb.size) continue;
        for (const kind of color.DEFICIENCY_KINDS) {
          const d = color.deltaE00(color.paraLab(color.simulate(a, kind)), color.paraLab(color.simulate(b, kind)));
          if (d < worst.deltaE) worst = { deltaE: roundTo(d, 2), a, b, kind };
          if (d < minimum)
            cases.push({ o_que: `${a} and ${b} land at ΔE00 = ${roundTo(d, 2)} under ${kind} (minimum ${minimum}) — ${[...ma].join('/')} vs ${[...mb].join('/')}`, ids: [] });
        }
      }
      output.push(matches('A7.4', cases, {
        measured: { colors: colors.length, channels: 'fill and stroke', worstPair: worst.deltaE === Infinity ? null : worst, minimum },
        mensagem: cases.length ? `${cases.length} pair(s) of colors indistinguishable under some deficiency` : 'colors of distinct meanings stay apart under all three simulations',
      }));
    }
  }

  // ---------------------------------------------------------------- A7.5
  // The legend has to pass the same floors as A7.1 (the entry's text) and
  // A7.2 (the color swatch). No engine in this repo emits a legend yet, so in
  // practice the branch that runs today is `notApplicable` — but the other
  // branch is genuinely implemented, not a `matches(id, [])` that can never
  // fail. A `fail` check that doesn't know how to fail is worse than one that
  // doesn't exist: it occupies a line in the report and returns green.
  {
    if (!scene.legend.length) {
      output.push(notApplicable('A7.5', 'there is no legend to measure — its absence is already reported by A1.2, and counting it twice would inflate the same defect'));
    } else {
      const cases = [];
      const background = scene.background;
      for (const [i, input] of scene.legend.entries()) {
        const who = input.id || `legend[${i}]`;
        const text = withoutTags(input.meaning || input.text || '');
        const px = Number(input.fontSize) || 12;
        const textColor = color.ehCor(input.fontColor) ? input.fontColor : '#000000';
        const entryBackground = color.ehCor(input.background) ? input.background : background;

        if (text) {
          const ratio = color.contraste(textColor, entryBackground);
          const { floor, large } = textFloor(px, !!input.bold);
          if (ratio !== null && ratio < floor)
            cases.push({ o_que: `${who}: text ${textColor} over ${entryBackground} gives ${roundTo(ratio, 2)}:1 (floor ${floor}:1 for ${large ? 'large text' : `${px} px`})`, ids: [who] });
        }
        // the color swatch is a graphic object, not text: A7.2's floor applies
        const swatch = input.symbol && input.symbol.color ? input.symbol.color : input.color;
        if (color.ehCor(swatch)) {
          const ratio = color.contraste(swatch, entryBackground);
          const floor = lim('nonTextContrast');
          if (ratio !== null && ratio < floor)
            cases.push({ o_que: `${who}: swatch ${swatch} over ${entryBackground} gives ${roundTo(ratio, 2)}:1 (floor ${floor}:1)`, ids: [who] });
        }
      }
      output.push(matches('A7.5', cases, {
        measured: { entries: scene.legend.length, belowFloor: cases.length },
        mensagem: cases.length ? `${cases.length} legend entries below the floor` : `${scene.legend.length} legend entries within the floors`,
      }));
    }
  }

  return output;
};
