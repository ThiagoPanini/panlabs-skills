'use strict';
/**
 * Theme layer — CLOSED tokens -> style string per cell.
 *
 * Three research facts decide this module's shape:
 *
 *  1. #4 §7 measured the four levels where a style can live in draw.io and only
 *     TWO travel with the file: the style string per cell (level D) and the
 *     `<mxGraphModel>` attributes (level D'). A named `mxStylesheet` sheet,
 *     `defaultVertexStyle`, and `currentVertexStyle` depend on the installation
 *     of WHOEVER OPENS the file. So: theme is baked cell by cell, and there is
 *     no alternative.
 *
 *  2. #5 measured the normative layer: group color, group stroke, category
 *     color, and icon size are AWS presets, and changing them makes the diagram
 *     READ WRONG (the group's color IS the legend — #5 §6.4). So the theme
 *     cannot name them. Here that's not a runtime rule: it's the absence of a
 *     word in the schema, the same trick #11 used for the coordinate boundary.
 *
 *  3. The ruler (tools/measure-ruler.cjs) showed that the AWS palette is
 *     calibrated for pure white: `#ED7100` only reaches 3:1 against `#FFFFFF`.
 *     So `background` is a two-state SWITCH, not a color picker — and the
 *     second state is the dark deck that AWS itself publishes (#5 F3).
 */

const fs = require('fs');
const path = require('path');

const { againstSchema } = require('../engine/validate.cjs');
const { setKey } = require('../catalog/aws-shapes.cjs');

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));
const DIR = __dirname;

/**
 * The palettes AWS ships in a Light/Dark variant — and ONLY those.
 *
 * #5 §3.2: in the official package only the `Res_General-Icons` have
 * `_Light`/`_Dark`, because only they are monochrome; the rest use the
 * category color, "designed to be used on both light and dark backgrounds"
 * (slide 15). The measurement confirms the design: `#232F3D` gives 1.23:1 on
 * a dark background — it vanishes — while every category color stays above
 * 3:1 on both backgrounds. draw.io ships a single variant, so it's the theme
 * that inverts.
 */
const MONO_PALETTES = new Set(['general_resources', 'illustrations']);

/**
 * What the AWS dark deck changes, and nothing beyond that (#5 table 2.1 + N15):
 * the `AWS Cloud` border/icon inverts, and the callouts invert. Group colors
 * are IDENTICAL in both decks.
 */
const NORMATIVE = {
  light:  { cloud: '#232F3E', mono: '#232F3E', callout: { background: '#232F3E', ink: '#FFFFFF' } },
  dark: { cloud: '#FFFFFF', mono: '#FFFFFF', callout: { background: '#FFFFFF', ink: '#232F3E' } },
};

/** How much of the group's normative color enters the derived tint. */
const TINT = 0.10;

/** Linear mix in sRGB — not perceptual compositing; it's what draw.io does. */
function mix(color, background, p) {
  const channels = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [channels(color), channels(background)];
  return '#' + [0, 1, 2]
    .map(i => Math.round(a[i] * p + b[i] * (1 - p)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}

const DEFAULT = {
  light: {
    page: { color: '#FFFFFF', margin: 32 },
    group:  { tint: 'derived' },
    ink:  { strong: '#232F3E', weak: '#5A6C86', halo: '#FFFFFF' },
    // `qualifier: true` — #39: before this, only `corporate` turned the second
    // line on and the other two themes dropped it with no warning anywhere.
    // Whoever draws on the default theme never saw the resource name.
    text:  { family: 'Arial,Helvetica', label: 12, group: 12, edge: 10, title: 19, subtitle: 12, qualifier: true },
    edge: { color: '#232F3E', thickness: 1.6, tip: 'blockThin', corners: 12, jumps: 'arc', flow: 'solid' },
    gap:  { base: 8, density: 1.0 },
    note:   { background: '#FFF8E1', edge: '#B7791F', ink: '#6B4E00' },
    block:  { background: '#FFFFFF', edge: '#232F3E', corners: 12 },
    card: { revision: null },
  },
  dark: {
    // `#1C1C1C`, not `#161E2D`: #13's feedback asked for a darker, more neutral
    // tone, "close to #222222". Measured, `#222222` is 24% LIGHTER in luminance
    // than the night-blue that was here — it reads as darker only because it's
    // neutral, not because it's dark — and it drops the Generic group border to
    // 2.97:1, a hair below the 3:1 floor. `#1C1C1C` delivers the requested
    // neutral, is genuinely darker than both, and passes at 3.18:1.
    page: { color: '#1C1C1C', margin: 32 },
    group:  { tint: 'derived' },
    // `#AEB9C6`, not `#AAB7B8`: the second is literally the gray draw.io uses as
    // the VPC's `fontColor`, which this ticket condemned at 2.06:1 on the light
    // background. Reusing it as the dark theme's secondary ink (where it
    // measures 8.09:1 and would pass) conflates two different things under the
    // same hex — and makes it impossible to prove on the pixel that the VPC's
    // gray label didn't survive anywhere.
    ink:  { strong: '#FFFFFF', weak: '#B4B4B4', halo: '#1C1C1C' },
    // qualifier: true — same #39 rule as the light default, see above.
    text:  { family: 'Arial,Helvetica', label: 12, group: 12, edge: 10, title: 19, subtitle: 12, qualifier: true },
    edge: { color: '#EDEDED', thickness: 1.6, tip: 'blockThin', corners: 12, jumps: 'arc', flow: 'solid' },
    gap:  { base: 8, density: 1.0 },
    note:   { background: '#2A2416', edge: '#8A6D3B', ink: '#F3DFAE' },
    block:  { background: '#242424', edge: '#FFFFFF', corners: 12 },
    card: { revision: null },
  },
};

// ------------------------------------------------------------------ load

function merge(base, about) {
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(about || {})])) {
    const a = base[k], b = (about || {})[k];
    out[k] = (a && typeof a === 'object' && !Array.isArray(a)) ? merge(a, b || {}) : (b === undefined ? a : b);
  }
  return out;
}

function readFile(idOrPath) {
  const p = idOrPath.endsWith('.json') ? idOrPath : path.join(DIR, idOrPath + '.json');
  if (!fs.existsSync(p)) {
    const available = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'schema.json')
      .map(f => f.replace(/\.json$/, ''));
    const e = new Error(`theme "${idOrPath}" does not exist`);
    e.erros = [`available themes: ${available.join(', ')}`];
    throw e;
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Loads, validates against the closed vocabulary, and merges with the default
 * for `background`. `inherits` lets a theme state only the delta — the same
 * "mirror + delta" logic #17 used in the catalog, so that changing the
 * default doesn't erase the variation.
 */
function load(idOrPath = 'light', seen = []) {
  const raw = readFile(idOrPath);

  const errors = againstSchema(raw, SCHEMA, SCHEMA);
  if (errors.length) { const e = new Error(`theme "${idOrPath}" is invalid`); e.erros = errors; throw e; }

  if (seen.includes(raw.id)) {
    const e = new Error('inheritance cycle between themes');
    e.erros = [[...seen, raw.id].join(' -> ')];
    throw e;
  }

  let base = DEFAULT[raw.background];
  if (raw.inherits) {
    const parent = load(raw.inherits, [...seen, raw.id]);
    if (parent.background !== raw.background) {
      const e = new Error(`theme "${raw.id}" inherits from "${raw.inherits}", which has a different background`);
      e.erros = [`${raw.background} != ${parent.background} — inheriting across the normative switch would carry over the wrong ink`];
      throw e;
    }
    base = parent.tokens;
  }

  // `merge` pulls in the file's identity keys too; they aren't tokens and must
  // not travel inside the theme's token payload pretending to be one.
  // `background` stays: it's the normative switch, and without it the payload
  // can't rebuild itself.
  const { schema, id, label, because, inherits, ...tokens } = merge(base, raw);
  return build(raw, tokens);
}

// -------------------------------------------------------- tokens -> style

/** Applies a map of keys to a style string, preserving the order of the rest. */
function apply(style, keys) {
  let s = style;
  for (const [k, v] of Object.entries(keys)) if (v !== undefined && v !== null) s = setKey(s, k, v);
  return s;
}

const FLOW = {
  solid: {},
  dashed: { dashed: 1, dashPattern: '8 5' },
  // #4 §2.6 measured it and #11 confirmed it: `flowAnimation` survives SVG and
  // HTML, NEVER PNG — there it becomes a static dash, with no error at all.
  animated: { dashed: 1, dashPattern: '8 5', flowAnimation: 1 },
};

function build(raw, t) {
  const norm = NORMATIVE[t.background];
  const g = n => Math.round(n * t.gap.base * t.gap.density);

  /**
   * TEXT METRIC — and this is where it becomes clear the theme is NOT
   * downstream of layout. `resolve.cjs` calibrated 6.7 px/character and
   * 17 px/line against `fontSize=12`; changing the body changes the reserved
   * box, which changes the gap, which changes the geometry. See
   * tools/check-partition.cjs, which separates the tokens that move a
   * coordinate from the ones that only paint — and proves the separation by
   * generating.
   */
  const perPt = pt => 6.7 * (pt / 12);
  const metric = {
    largCar: perPt(t.text.label),
    altLinha: 17 * (t.text.label / 12),
    largCarAresta: perPt(t.text.edge),
    largCarGrupo: perPt(t.text.group),
  };

  const api = {
    id: raw.id, label: raw.label, because: raw.because || '',
    background: t.background, tokens: t, normativo: norm, metrica: metric,
    /** Slack in steps of the base grid, with density already applied. */
    g,
    /** Lane: label reservation. Does NOT carry density — see the schema. */
    lane: n => Math.round(n * t.gap.base),

    /**
     * Group (container). The theme paints ONLY the label's ink and the font.
     * `strokeColor`, `dashed`, and the icon remain the catalog's, because they
     * are the normative layer — and that's why no token exists for them.
     *
     * The label's ink is the decision #17 pushed here, and it resolves by
     * measurement, not by taste: a group's border is graphic (WCAG 1.4.11,
     * 3:1) and a label is text (1.4.3, 4.5:1). Two different thresholds don't
     * fit the same color. "The label inherits the border's color" is the
     * reading that doesn't survive any background swap; "the label is neutral
     * ink" is the deck's own reading (#5 §2.1: 12pt Arial, color `tx1`).
     */
    group(style, title) {
      const keys = {
        fontColor: t.ink.strong,
        fontFamily: t.text.family,
        fontSize: t.text.group,
      };
      /**
       * TINTING — and note where each half of the decision comes from.
       *
       * WHICH groups get tinted is a fact of the CATALOG: draw.io ships two
       * subnets with a fill and the other 18 with `none`, and the theme has
       * no word to change that set. The VALUE is derived from that group's
       * own normative color over the page background — so the tint can't
       * invent meaning: it's the color that was already there, at 10%.
       *
       * That this derivation is REALLY the product's own, and not something
       * we invented, is measured: 10% of `#00A4A6` over white gives `#E6F6F6`
       * against the `#E6F6F7` that draw.io ships, and 10% of `#7AA116` gives
       * exactly `#F2F6E8`.
       *
       * Without deriving it, the dark theme breaks: the product's fixed
       * `#E6F6F7` becomes a luminous block on the dark background, and the
       * white label of whoever falls inside it disappears.
       */
      const fill = (/(?:^|;)fillColor=([^;]*)/.exec(style) || [])[1];
      if (fill && fill !== 'none') {
        keys.fillColor = t.group.tint === 'none' ? 'none'
          : mix((/(?:^|;)strokeColor=(#[0-9A-Fa-f]{6})/.exec(style) || [])[1] || t.ink.strong,
                     t.page.color, TINT);
      }
      // the only group color the dark deck inverts (#5 §2.1 reading 2)
      if (/^AWS Cloud/i.test(title || '')) { keys.strokeColor = norm.cloud; keys.fontColor = norm.cloud; }
      return apply(style, keys);
    },

    /** AWS leaf: font and ink. The square's color belongs to the category — untouchable. */
    service(style, input) {
      const keys = { fontColor: t.ink.strong, fontFamily: t.text.family, fontSize: t.text.label };
      /**
       * `strokeColor` on an aws4 shape paints the GLYPH, not the border
       * (#4 §3.2). On monochrome icons it's `fillColor` that carries the
       * stroke, and that's the one AWS ships in two variants.
       *
       * ⚠️ And the theme INVERTS, it does not reaffirm. In the light deck the
       * catalog is already the light variant: rewriting `fillColor` with our
       * own constant repaints the icon for nothing — and "for nothing" here
       * was literally one digit. The validator's `A2.3` (#18) caught it during
       * #23's recertification: the catalog's "Users" paints `#232F3D` and the
       * constant `NORMATIVE.light.mono` says `#232F3E`. On screen it's the
       * same ink; in the check it's the theme changing an icon's color, which
       * is exactly what `A2.3` exists to forbid.
       *
       * While the engine and the validator ran separately, nobody had seen it.
       */
      if (input && MONO_PALETTES.has(input.palette) && t.background === 'dark')
        keys.fillColor = norm.mono;
      return apply(style, keys);
    },

    /** Derived band (AZ, Auto Scaling): halo on the label, since it lands on someone else's border. */
    band(style) {
      return apply(style, {
        fontColor: t.ink.strong, fontFamily: t.text.family, fontSize: t.text.group,
        labelBackgroundColor: t.ink.halo,
      });
    },

    /**
     * DEGRADED band (#31): when the union's box would embrace a non-member
     * along with the members, the band stops asserting containment — there is
     * no box that embraces only its own members without also embracing
     * whoever isn't. Same device as the OU label (`ou()`, a few lines below):
     * a loose text-only pair, with no shape, where the box would have drawn
     * the border.
     */
    faixaRotulo: () => `text;html=1;fontSize=${t.text.group};fontStyle=1;fontColor=${t.ink.strong};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,

    /** Edge. N9/A11 from #5: the official arrow is ALWAYS solid — dashed pays down debt. */
    edge(extra = {}) {
      const base = {
        edgeStyle: 'orthogonalEdgeStyle', html: 1, jettySize: 'auto', orthogonalLoop: 1,
        rounded: t.edge.corners > 0 ? 1 : 0,
        strokeColor: t.edge.color, strokeWidth: t.edge.thickness,
        endArrow: t.edge.tip, endFill: t.edge.tip === 'open' ? 0 : 1, endSize: 6,
        fontSize: t.text.edge, fontFamily: t.text.family, fontColor: t.ink.strong,
        labelBackgroundColor: t.ink.halo,
        ...(t.edge.corners > 0 ? { arcSize: t.edge.corners } : {}),
        ...(t.edge.jumps !== 'none' ? { jumpStyle: t.edge.jumps, jumpSize: 6 } : {}),
        ...FLOW[t.edge.flow],
        ...extra,
      };
      return Object.entries(base).map(([k, v]) => `${k}=${v}`).join(';') + ';';
    },

    title: () => `text;html=1;fontSize=${t.text.title};fontStyle=1;fontColor=${t.ink.strong};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,
    subtitle: () => `text;html=1;fontSize=${t.text.subtitle};fontColor=${t.ink.weak};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,
    revision: () => `text;html=1;fontSize=${Math.max(9, t.text.subtitle - 2)};fontColor=${t.ink.weak};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,
    note: () => `rounded=0;whiteSpace=wrap;html=1;fillColor=${t.note.background};strokeColor=${t.note.edge};` +
      `fontColor=${t.note.ink};fontFamily=${t.text.family};fontSize=${Math.max(9, t.text.label - 1)};` +
      `align=left;verticalAlign=top;spacing=8;dashed=0;`,
    block: () => `rounded=${t.block.corners > 0 ? 1 : 0};arcSize=${t.block.corners};whiteSpace=wrap;html=1;` +
      `fillColor=${t.block.background};strokeColor=${t.block.edge};fontColor=${t.ink.strong};` +
      `fontFamily=${t.text.family};fontSize=${t.text.label};verticalAlign=middle;align=center;strokeWidth=1.5;`,

    /**
     * THE FOUR CELLS FROM #12 — and they fit here without opening a single new
     * word in the vocabulary. It's #13's own ruler: a token only opens once it
     * proves the existing vocabulary can't reach the meaning. Here it reaches,
     * and the proof is arithmetic — in the `light` theme the four literals #12
     * wrote by hand reconstruct, token by token:
     *
     *   S_OU      #232F3E = ink.strong  · 13 pt = text.group + 1
     *   S_BUS     #232F3E = edge.color  · 1.6 = edge.thickness
     *   S_STUB    #FFFFFF = ink.halo    · 10 pt = text.edge
     *   S_ENABLES #5A6C86 = ink.weak
     *
     * In other words: #12 was already using #13's tokens without knowing it —
     * writing out their values. That's not coincidence, it's the same
     * normative palette on both ends. `tests/check-tokens-of-12.cjs` checks it.
     *
     * And that's why it lives here and not in `plan.cjs`: with the hex in
     * there, the dark deck would draw a `#232F3E` bus over a `#1C1C1C`
     * background.
     */

    /**
     * OU label. Not a box — the deck has no Organizational unit shape (#6 G1),
     * so it's an icon+label pair floating above the first member. One step up
     * from the group label, which is the relationship #12 wrote.
     */
    ou: () => `text;html=1;fontSize=${t.text.group + 1};fontStyle=1;fontColor=${t.ink.strong};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,

    /** `E4`/`X3`: the bus line. No tip — the stub carries the tip. */
    bus: () => `endArrow=none;html=1;strokeColor=${t.edge.color};` +
      `strokeWidth=${t.edge.thickness};`,

    /** The perpendicular stub that factors into the count, and `E3`'s aggregated edge. */
    stub: () => `edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=${t.edge.color};` +
      `strokeWidth=${t.edge.thickness};endArrow=${t.edge.tip};` +
      `endFill=${t.edge.tip === 'open' ? 0 : 1};endSize=6;fontSize=${t.text.edge};` +
      `fontFamily=${t.text.family};fontColor=${t.ink.strong};labelBackgroundColor=${t.ink.halo};`,

    /**
     * `E9`: a permission enabler is a SHORT arrow pointing into whoever
     * authorizes, never an edge label. Weak ink because it's an annex, not a
     * flow — the same distinction the subtitle makes in the title block.
     */
    habilitador: () => `edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=${t.ink.weak};` +
      `strokeWidth=1.4;dashed=1;dashPattern=6 4;endArrow=${t.edge.tip};` +
      `endFill=${t.edge.tip === 'open' ? 0 : 1};endSize=6;`,

    /**
     * The leaf's label. #5's O21 — "Amazon Route 53 / *DNS service*" —,
     * backed by 4 corpora: the name says what it IS, the italics say what it
     * does THERE or how it's CALLED there (`resource`, #38 — the caller
     * already resolved which of the two wins). It costs a second line, and
     * the line is metric, not paint.
     */
    rotuloDeFolha(name, second) {
      if (!t.text.qualifier || !second) return name;
      return `${name}<br><i>${second}</i>`;
    },
  };
  return api;
}

/**
 * A theme with one token swapped, without going through a file. Exists so
 * `tools/check-partition.cjs` can perturb one token at a time and measure
 * whether the geometry moves — which is how the paint/metric partition stops
 * being an assertion and becomes a check.
 */
function withPatch(base, patch) {
  const b = typeof base === 'string' ? load(base) : base;
  const tokens = merge(b.tokens, patch);
  return build({ id: b.id + '+patch', label: b.label, because: b.because }, tokens);
}

function listAll() {
  return fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'schema.json')
    .map(f => f.replace(/\.json$/, '')).sort();
}

module.exports = { load, withPatch, listAll, mix, SCHEMA, DEFAULT, NORMATIVE, MONO_PALETTES, TINT };
