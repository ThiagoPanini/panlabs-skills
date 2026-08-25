'use strict';
/**
 * Resolution: model node -> drawable shape.
 *
 * This is where semantics touches the catalog (#17) and comes out the other side
 * as an mxGraph style string. The engine knows no hex, no stencil, no
 * `container=1` — all of that comes from the catalog, already corrected.
 *
 * The only thing this module decides on its own is SIZE, and for a concrete
 * reason: in mxGraph the label of a service icon is drawn OUTSIDE the bounds
 * (`verticalLabelPosition=bottom`). The geometry says 78×78 and the drawing
 * occupies 78×(78+label). Anyone passing 78×78 to the layout hands over a
 * label–label collision, which is `A3.2` of the rubric (#8). The engine reserves
 * the label band because mxGraph does not.
 */

const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'catalog', 'aws-shapes.cjs');

// Model kind -> group name in the catalog. The subnet depends on `access`.
const GROUP_OF = {
  cloud: 'AWS Cloud',
  account: 'AWS Account',
  region: 'Region',
  vpc: 'VPC',
  'security-group': 'Security group',
  group: 'Generic group',
};

// Text metrics. There is no way to measure a font without rendering, so this is a
// calibrated estimate — and that is why the geometry validator (#18) exists.
// The catalog styles draw a leaf label at `fontSize=12`, not 10 — the first
// version estimated at 10 and undersized the label band by ~25%. That is how the
// "VPC endpoint" ended up touching the RDS "Catálogo" label.
const MIN_LABEL = 23;
/**
 * ⚠️ THERE IS NO TEXT METRIC HERE — it comes from the theme.
 *
 * The per-character width and line height of #11 were calibrated against
 * `fontSize=12`, the body the catalog styles draw and that `N11` of #5
 * prescribes. Changing the body changes the reserved box, which changes the gap,
 * which changes the geometry — so that sum belongs to the theme, and the theme
 * enters the pipeline BEFORE the layout. See `tools/check-partition.cjs`.
 */

/** How many lines the label takes if wrapped in a box `larg` px wide. */
function labelLines(text, larg, charWidth) {
  if (!text) return 0;
  // a label with a qualifier (O21) already carries the break inside it
  const forced = String(text).split(/<br\s*\/?>/i);
  if (forced.length > 1)
    return forced.reduce((n, p) => n + labelLines(p.replace(/<[^>]+>/g, ''), larg, charWidth), 0);
  const perLine = Math.max(1, Math.floor(larg / charWidth));
  let lines = 1, current = 0;
  for (const word of String(text).split(/\s+/)) {
    const cost = word.length + (current ? 1 : 0);
    if (current + cost > perLine && current > 0) { lines++; current = word.length; }
    else current += cost;
  }
  return lines;
}

function textWidth(text, charWidth) {
  return Math.ceil(String(text || '').length * charWidth);
}

function create(theme, catalogDir) {
  if (!theme) throw new Error('resolve.create requires a theme — there is no path without one');
  const cat = require(catalogDir || CATALOG_PATH).load();

  const used = [];   // audit trail: how each name was resolved
  const M = theme.metrica;

  function groupOfNode(node) {
    if (node.kind === 'subnet') return node.access === 'public' ? 'Public subnet' : 'Private subnet';
    return GROUP_OF[node.kind] || 'Generic group';
  }

  /** Container: style + reserved title band. */
  function container(node) {
    const name = groupOfNode(node);
    const g = cat.group(name);
    if (!g) throw new Error(`group "${name}" missing from the catalog`);
    used.push({ id: node.id, pediu: node.kind, virou: g.title, via: 'group', corrections: g.corrections });
    const style = theme.group(g.style, g.title);
    // `spacingLeft=30` in the group style is the icon window: the label starts
    // after it. The title band is the child's area (#2 §3.2), so the one who
    // reserves it is the engine.
    const hasIcon = /grIcon=/.test(g.style);
    return {
      style,
      // The title band is a LANE: label reserve, and therefore derived from the
      // group's text body — not from the density. `check-partition.cjs` caught
      // this: with the band fixed at 4 steps, raising `text.group` to 16 pt moved
      // not one coordinate and the label began to graze the top border.
      tituloH: Math.max(theme.lane(4), Math.round(theme.tokens.text.group * 2.2)),
      recuoTitulo: hasIcon ? 30 : 8,
      color: (style.match(/strokeColor=(#[0-9A-Fa-f]{6})/) || [])[1] || '#5A6C86',
      corrections: g.corrections,
    };
  }

  /** Leaf: style + a box that already includes the label band. */
  function leaf(node) {
    if (node.kind === 'block') {
      const larg = 170;
      const lines = labelLines(node.label || node.id, larg - 16, M.largCar);
      used.push({ id: node.id, pediu: 'block', virou: '(logical block)', via: 'block' });
      return {
        // logical view: pre-services, therefore out of reach of the AWS
        // convention. It is the only place where the house picks a box colour
        // without contradicting anyone.
        style: theme.block(),
        label: node.label || node.id,
        formaW: larg, formaH: Math.max(56, 20 + lines * M.altLinha),
        rotuloH: 0,                       // the label is internal — no band to reserve
      };
    }

    const key = node.service || (node.kind === 'actor' ? 'users' : null);
    if (!key) throw new Error(`node "${node.id}" of kind "${node.kind}" has no service key`);
    const s = cat.service(key);
    if (!s) throw new Error(`service "${key}" did not resolve, not even to the generic one`);
    used.push({
      id: node.id, pediu: key, virou: s.title, via: s.via,
      fallback: s.via === 'generic' || String(s.via).includes(':'),
    });

    const name = node.label || s.rotuloSugerido || s.title;
    // O21 of #5: the name says what it IS, the italic says what it does HERE.
    // Whether it shows is the theme's call; the text itself is a fact of the
    // model — the only style token of this prototype that needed a new field in
    // the IR.
    const label = theme.rotuloDeFolha(name, node.qualifier);
    const formaW = s.w || 78, formaH = s.h || 78;
    // #33/#35: the box is the MEASURED width of the label, not an assumed wrap —
    // mxGraph does not break the line the way `labelLines` supposed (it comes out
    // whole, and the "wrapped" one came only from the explicit `<br>` of
    // `rotuloDeFolha`). Measuring each explicit line and widening to the widest is
    // what makes overflow stop existing as a concept: the icon stays centred
    // inside the box because the catalog style already carries `aspect=fixed` —
    // there is no offset to compute here.
    const rotuloW = Math.max(0, ...label.split(/<br\s*\/?>/i)
      .map(row => textWidth(row.replace(/<[^>]+>/g, ''), M.largCar)));
    const boxW = Math.max(formaW, rotuloW);
    const lines = labelLines(label, boxW, M.largCar);
    return {
      style: theme.service(s.style, s),
      label,
      formaW, formaH,
      rotuloH: Math.max(MIN_LABEL, lines * M.altLinha),
      rotuloW,
      caixaW: boxW,
    };
  }

  function band(f) {
    const name = f.kind === 'auto-scaling' ? 'Auto Scaling group' : 'Generic group';
    const g = cat.group(name);
    used.push({ id: f.id, pediu: f.kind || 'generic', virou: g.title, via: 'band', corrections: g.corrections });
    // A band exists to CROSS other boxes, so its label is born on top of somebody
    // else's borders — with 2 AZ columns the centre of the band falls exactly on
    // the divide between the zones, and the dashed line strikes through the text.
    // The halo solves it without touching colour or stroke: the palette stays the
    // catalog's, the legibility is the engine's.
    const style = theme.band(g.style);
    return {
      style,
      color: (style.match(/strokeColor=(#[0-9A-Fa-f]{6})/) || [])[1],
    };
  }

  function azBand() {
    const g = cat.group('Availability Zone');
    return { style: theme.group(g.style, g.title), corrections: g.corrections };
  }

  return {
    container, leaf, band, faixaAz: azBand, cat, usados: used, tema: theme,
    labelLines: (t, l) => labelLines(t, l, M.largCar),
    textWidth: t => textWidth(t, M.largCar),
    larguraDaAresta: t => textWidth(t, M.largCarAresta),
    larguraDoRotuloDeGrupo: t => textWidth(t, M.largCarGrupo),
  };
}

module.exports = { create, labelLines, textWidth };
