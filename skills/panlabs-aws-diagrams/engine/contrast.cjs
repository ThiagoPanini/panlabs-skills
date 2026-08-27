'use strict';
/**
 * Contrast gate — rubric family A7 (#8), running over the PLAN.
 *
 * The method point is in #8 §5: the effective background of a label in a
 * diagram with nested groups is NOT the canvas background — it's the nearest
 * ancestor group's, resolved through the z-order stack. That's why this check
 * lives here and not in the theme file: a theme, alone, has no idea what it
 * will land on. The theme is a hypothesis; the plan is where it becomes a
 * number.
 *
 *   A7.1   text             >= 4.5:1  (>= 3:1 if >= 24 px, or >= 18.5 px bold)
 *   A7.2   stroke            >= 3:1    FAILS
 *   A7.2a  solid area        >= 3:1    WARNS
 *   A7.3   color isn't the only channel
 *
 * The split between STROKE and AREA came out of #13's rework, and it isn't a
 * convenience: a 1.25 pt group border and the 48 px square of a service icon
 * are different things under WCAG 1.4.11, which speaks of "important parts ...
 * required to understand". Finding a thin teal line against off-white is
 * genuinely hard; a saturated orange block against a 10%-tint blue is
 * perfectly visible, and its identity is carried by the white GLYPH inside it —
 * which is measured separately, against the square itself, and doesn't change
 * with the background.
 *
 * Treating both with the same hard threshold made this prototype condemn
 * draw.io's subnet tinting, which the official AWS diagrams use and which the
 * A2 caveat in #5 already sanctions. That's why AREA warns and STROKE fails.
 * The area threshold is engineering judgment, not WCAG text — the same
 * annotation the rubric gives A7.4.
 *
 * WARNING: the #4 §3.2 trap applies HERE TOO: in `mxgraph.aws4.*` shapes,
 * `strokeColor` isn't the border color — it's the GLYPH color. A validator that
 * measured `strokeColor` against the page background on a service icon would be
 * measuring the wrong pair: the glyph sits on the category square, not on the
 * page. The right pairs are in `pairsOf()`.
 */

// -------------------------------------------------------------- WCAG G18

function channel(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return 0.2126 * channel(n >> 16 & 255) + 0.7152 * channel(n >> 8 & 255) + 0.0722 * channel(n & 255);
}

function ratio(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  if (l1 === null || l2 === null) return null;
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// -------------------------------------------------------------- style

function key(style, k) {
  const m = new RegExp('(?:^|;)' + k + '=([^;]*)').exec(style || '');
  return m ? m[1] : null;
}
const color = v => (v && /^#[0-9A-Fa-f]{6}$/.test(v)) ? v : null;

/** Text threshold (A7.1): 3:1 only applies to large text. */
function textThreshold(style) {
  const px = Number(key(style, 'fontSize') || 12);
  const bold = (Number(key(style, 'fontStyle') || 0) & 1) === 1;
  return (px >= 24 || (bold && px >= 18.5)) ? 3.0 : 4.5;
}

/**
 * Effective background: walks up the parent chain until it finds an opaque
 * `fillColor`.
 *
 * Found in #13: under the AWS convention this almost never takes more than one
 * step — A2 in #5 says a group box is `<a:noFill/>`, and the catalog emits
 * `fillColor=none` on all 20 groups. In other words, the effective background
 * IS the page background almost everywhere. The z-order stack #8 warns about
 * only starts to matter once someone TINTS a group — and the theme's closed
 * vocabulary has no word for that. The check is exact by construction, not by
 * luck.
 */
function effectiveBackground(cel, byId, pageBackground, skipSelf) {
  let current = skipSelf ? byId.get(cel.parent) : cel;
  while (current) {
    const f = color(key(current.style, 'fillColor'));
    if (f) return { color: f, from: current.id };
    current = byId.get(current.parent);
  }
  return { color: pageBackground, from: '(page)' };
}

const isAws4 = style => /shape=mxgraph\.aws4\./.test(style || '');
const isServiceIcon = style => /shape=mxgraph\.aws4\.(resourceIcon|productIcon)/.test(style || '');
const isAws4Group = style => /shape=mxgraph\.aws4\.(group|groupCenter|group2)\b/.test(style || '');

/**
 * The (foreground, background) pairs a cell requires measuring. This is where
 * the `strokeColor` trap is isolated in one single place.
 */
function pairsOf(cel, byId, pageBackground) {
  const st = cel.style || '';
  const pairs = [];
  const label = String(cel.label || '').replace(/<[^>]+>/g, '').trim();

  if (cel.kind === 'edge') {
    const halo = color(key(st, 'labelBackgroundColor'));
    const stroke = color(key(st, 'strokeColor'));
    if (stroke) pairs.push({ rule: 'A7.2', o_que: 'edge stroke', frente: stroke, background: pageBackground, target: 3.0 });
    if (label) pairs.push({ rule: 'A7.1', o_que: 'edge label', frente: color(key(st, 'fontColor')) || '#000000',
      background: halo || pageBackground, target: textThreshold(st) });
    return pairs;
  }

  const fill = color(key(st, 'fillColor'));
  const stroke = color(key(st, 'strokeColor'));

  if (isServiceIcon(st)) {
    // the category square against whatever's behind it — AREA, hence a warning
    const behind = effectiveBackground(cel, byId, pageBackground, true);
    if (fill) pairs.push({ rule: 'A7.2a', o_que: 'icon square', frente: fill, background: behind.color, target: 3.0, warning: true });
    // and the GLYPH against the square — `strokeColor` paints the glyph (#4 §3.2)
    if (stroke && fill) pairs.push({ rule: 'A7.2', o_que: 'glyph inside the icon', frente: stroke, background: fill, target: 3.0 });
    // the service icon's label is drawn OUTSIDE the box (verticalLabelPosition=bottom):
    // it falls on the parent, never on the square itself
    if (label) pairs.push({ rule: 'A7.1', o_que: 'icon label', frente: color(key(st, 'fontColor')) || '#000000',
      background: behind.color, target: textThreshold(st) });
    return pairs;
  }

  if (isAws4(st)) {   // group, or a monochrome resource icon
    const behind = effectiveBackground(cel, byId, pageBackground, true);
    const group = isAws4Group(st);
    if (stroke) pairs.push({ rule: 'A7.2', o_que: group ? 'group border' : 'icon stroke',
      frente: stroke, background: behind.color, target: 3.0 });
    // In a group, the boundary is carried by the BORDER; the fill is a wash and
    // WCAG 1.4.11 speaks of "the important parts". Measuring the tint against
    // the page would fail a light gray that doesn't need to be seen — and would
    // let through what actually matters, which is the tint's effect on WHOEVER
    // SITS ON TOP OF IT. That effect is already measured: it's the children's
    // `effective background`. On a monochrome icon it's the opposite:
    // `fillColor` IS the stroke.
    if (fill && !group) pairs.push({ rule: 'A7.2', o_que: 'monochrome icon stroke', frente: fill, background: behind.color, target: 3.0 });
    /**
     * WARNING: THE Z-CUT FOR A GROUP LABEL IS DIFFERENT, and getting it wrong
     * here is a false negative.
     *
     * The border is measured against what's OUTSIDE (hence `behind`, which
     * skips its own fill): it's the boundary, and what matters is finding it on
     * the page. The LABEL is measured against what's INSIDE — it's drawn on top,
     * over the group's own fill. Measuring it against the ancestor gives dark
     * text on a dark group passing with room to spare.
     *
     * #18 found exactly this defect in the geometric validator and logged it in
     * the map: 1.00:1 on screen, 13.57:1 in the report. It stayed dormant here
     * while all 20 groups were `fillColor=none`; it started to matter again the
     * moment subnet tinting came back.
     */
    // ...and the cut only applies to a GROUP. On a monochrome icon, `fillColor`
    // is the GLYPH and the label is drawn below the box
    // (`verticalLabelPosition=bottom`), on the parent — measuring it against its
    // own fill always gives 1.00:1, because ink and glyph are the same theme
    // color. The first version of this fix didn't make the distinction and
    // failed all three themes at once; the suite caught it.
    const under = group ? effectiveBackground(cel, byId, pageBackground, false) : behind;
    if (label) pairs.push({ rule: 'A7.1', o_que: group ? 'group label' : 'icon label',
      frente: color(key(st, 'fontColor')) || '#000000',
      background: color(key(st, 'labelBackgroundColor')) || under.color, target: textThreshold(st) });
    return pairs;
  }

  // plain rectangle: logical block, note, title, subtitle
  const behind = effectiveBackground(cel, byId, pageBackground, true);
  if (stroke) pairs.push({ rule: 'A7.2', o_que: 'box border', frente: stroke, background: behind.color, target: 3.0 });
  if (label) pairs.push({ rule: 'A7.1', o_que: 'text', frente: color(key(st, 'fontColor')) || '#000000',
    background: fill || behind.color, target: textThreshold(st) });
  return pairs;
}

/**
 * A7.3 — color isn't the only channel (WCAG 1.4.1, level A).
 *
 * With the AWS palette this passes by CONSTRUCTION, and it's worth
 * understanding why: besides color, a different group carries a different
 * stroke (`sysDash`/`dash`/solid, A5 in #5) and a different icon; a different
 * service carries a different stencil. The check only fires if someone adds a
 * channel that exists only as color.
 */
function fillIsNotTheOnlyChannel(cells) {
  const signatures = new Map();
  for (const c of cells) {
    const st = c.style || '';
    if (c.kind === 'edge' || !isAws4(st)) continue;
    const fill = key(st, 'fillColor') || '-';
    const rest = [key(st, 'strokeColor') || '-', key(st, 'dashed') || '0',
      key(st, 'resIcon') || key(st, 'grIcon') || (/shape=([^;]*)/.exec(st) || [])[1] || '-'].join('|');
    if (!signatures.has(rest)) signatures.set(rest, new Set());
    signatures.get(rest).add(fill);
  }
  const violations = [];
  for (const [rest, fills] of signatures)
    if (fills.size > 1) violations.push({ rule: 'A7.3', o_que: `${fills.size} meanings that differ only in fill`, detail: rest });
  return violations;
}

// ---------------------------------------------------------------- gate

function measure(layoutPlan) {
  const pageBackground = layoutPlan.background || '#FFFFFF';
  const byId = new Map(layoutPlan.cells.map(c => [c.id, c]));
  const findings = [];

  for (const cel of layoutPlan.cells) {
    if (cel.visible === false) continue;
    for (const par of pairsOf(cel, byId, pageBackground)) {
      const r = ratio(par.frente, par.background);
      if (r === null) continue;
      findings.push({ ...par, id: cel.id, ratio: r, passa: r >= par.target });
    }
  }
  findings.push(...fillIsNotTheOnlyChannel(layoutPlan.cells).map(v => ({ ...v, id: '(palette)', ratio: null, passa: false, target: null })));

  const below = findings.filter(a => !a.passa);
  const failures = below.filter(a => !a.warning);
  const warnings = below.filter(a => a.warning);
  return {
    ok: failures.length === 0,
    total: findings.length,
    failures, warnings,
    piorTexto: Math.min(Infinity, ...findings.filter(a => a.rule === 'A7.1').map(a => a.ratio)),
    piorGrafismo: Math.min(Infinity, ...findings.filter(a => a.rule === 'A7.2').map(a => a.ratio)),
    piorArea: Math.min(Infinity, ...findings.filter(a => a.rule === 'A7.2a').map(a => a.ratio)),
    findings,
  };
}

/**
 * The gate over an N-PAGE file (#12).
 *
 * `measure` runs per page because the effective background is per page — every
 * `<diagram>` has its own `background`. #13 never saw this: in that prototype
 * the engine always produced a single page, and `generate` called
 * `measure(plan)` directly. With #12 the same file started carrying the
 * consolidated view plus one per account, and a gate that only looked at the
 * first would leave N−1 pages with no guard at all — the hole would land
 * exactly where the engine grew.
 *
 * The fold is deliberately conservative: the file passes only if EVERY page
 * passes, and the file's worst pair is the worst pair of any page.
 */
function measureAll(pages) {
  const parts = pages.map(measure);
  const min = (a, b) => Math.min(a, b);
  return {
    ok: parts.every(p => p.ok),
    total: parts.reduce((n, p) => n + p.total, 0),
    failures: parts.flatMap(p => p.failures),
    warnings: parts.flatMap(p => p.warnings),
    piorTexto: parts.map(p => p.piorTexto).reduce(min, Infinity),
    piorGrafismo: parts.map(p => p.piorGrafismo).reduce(min, Infinity),
    piorArea: parts.map(p => p.piorArea).reduce(min, Infinity),
    findings: parts.flatMap(p => p.findings),
    pages: parts.length,
  };
}

/** One line per failure, grouped — 40 labels with the same ink are one problem, not 40. */
function summarize(r, which) {
  const groups = new Map();
  for (const f of (which || r.failures)) {
    const k = `${f.rule}|${f.o_que}|${f.frente}|${f.background}`;
    if (!groups.has(k)) groups.set(k, { ...f, quantos: 0, ids: [] });
    const g = groups.get(k);
    g.quantos++; if (g.ids.length < 3) g.ids.push(f.id);
  }
  return [...groups.values()].sort((a, b) => (a.ratio || 0) - (b.ratio || 0)).map(g =>
    g.ratio === null
      ? `${g.rule}  ${g.o_que} — ${g.detail}`
      : `${g.rule}  ${g.o_que}: ${g.frente} over ${g.background} = ${g.ratio.toFixed(2)}:1 ` +
        `(needs ${g.target.toFixed(1)}:1) — ${g.quantos}× [${g.ids.join(', ')}${g.quantos > 3 ? ', …' : ''}]`);
}

module.exports = { measure, measureAll, summarize, ratio, luminance, pairsOf, textThreshold, effectiveBackground, key };
