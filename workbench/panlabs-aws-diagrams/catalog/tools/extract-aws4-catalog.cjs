#!/usr/bin/env node
/**
 * Extracts the AWS shape catalog from draw.io into compact JSON.
 *
 * Usage: node extract-aws4-catalog.cjs <drawio-repo> [output.json]
 *
 * The style strings do NOT exist literally in any file — `Sidebar-AWS4.js`
 * assembles them by concatenation at runtime. Grep recovers at most the
 * suffix (`.lambda;`), never the prefix with the color. The only correct way
 * is to execute the file: here, inside a `vm` with minimal mxGraph stubs,
 * intercepting `createVertexTemplateEntry`.
 *
 * Reference: §4 of the shape research from #17.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const repo = process.argv[2];
// catalog/tools/ moved to the workbench sibling in #45; aws4.catalog.json
// stayed in the skill.
const outPath = process.argv[3] ||
  path.join(__dirname, '..', '..', '..', '..', 'skills', 'panlabs-aws-diagrams', 'catalog', 'aws4.catalog.json');

if (!repo || !fs.existsSync(repo)) {
  console.error('usage: node extract-aws4-catalog.cjs <drawio-repo> [output.json]');
  process.exit(2);
}

// ---------------------------------------------------------------- 1. sandbox

function runSidebar(file, entryFn) {
  const src = fs.readFileSync(
    path.join(repo, 'src/main/webapp/js/diagramly/sidebar', file), 'utf8');
  const out = [];

  function Sidebar() {}
  Sidebar.prototype = {
    setCurrentSearchEntryLibrary() {},
    getTagsForStencil(gn, name, dt) {
      return [(dt || ''), (name || '')].join(' ').trim().split(/\s+/);
    },
    createVertexTemplateEntry(style, w, h, value, title, showLabel, showTitle, tags) {
      return { kind: 'vertex', style, width: w, height: h, value: value || '',
               title: title || '', tags: tags || '' };
    },
    createEdgeTemplateEntry(style, w, h, value, title, showLabel, showTitle, tags) {
      return { kind: 'edge', style, width: w, height: h, value: value || '',
               title: title || '', tags: tags || '' };
    },
    createVertexTemplate() { return {}; },
    addEntry() { return {}; },
    addPalette() { return {}; },
    addPaletteFunctions(id, title, expanded, fns) {
      for (const e of fns) {
        if (e && e.style !== undefined) { e.paletteId = id; e.palette = title; out.push(e); }
      }
    }
  };

  const sandbox = {
    Sidebar, console,
    mxConstants: { STYLE_SHAPE: 'shape', STYLE_POINTER_EVENTS: 'pointerEvents', NODETYPE_ELEMENT: 1 },
    mxCellRenderer: { registerShape() {} },
    mxUtils: { bind: (s, f) => f.bind(s), extend() {}, getValue: (s, k, d) => d },
    mxStencilRegistry: { libraries: {}, getStencil() { return null; } },
    mxShape: function () {}
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: file });

  const sb = Object.create(sandbox.Sidebar.prototype);
  sandbox.Sidebar.prototype[entryFn].call(sb);
  return out;
}

const entries = runSidebar('Sidebar-AWS4.js', 'addAWS4Palette');

// -------------------------------------------------- 2. stencil inventory

const stencilXml = fs.readFileSync(
  path.join(repo, 'src/main/webapp/stencils/aws4.xml'), 'utf8');

// Name normalization, verbatim from mxStencilRegistry.parseStencilSet:
//   name.replace(/ /g,"_")  then .toLowerCase()
const declaredStencils = new Set(
  [...stencilXml.matchAll(/<shape [^>]*name="([^"]*)"/g)]
    .map(m => m[1].replace(/ /g, '_').toLowerCase()));

// ------------------------------------------------------- 3. style parsing

function styleToMap(style) {
  const map = new Map();
  for (const part of style.split(';')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) map.set(part, true);
    else map.set(part.slice(0, i), part.slice(i + 1));
  }
  return map;
}

function classify(e) {
  const m = styleToMap(e.style);
  const shape = m.get('shape') || '';
  const cls = shape.startsWith('mxgraph.aws4.') ? shape.slice('mxgraph.aws4.'.length) : '';

  if (e.kind === 'edge') return { kind: 'edge' };

  if (cls === 'resourceIcon') {
    return { kind: 'svc', stencil: (m.get('resIcon') || '').replace(/^mxgraph\.aws4\./, ''),
             fill: m.get('fillColor'), map: m };
  }
  if (cls === 'group' || cls === 'groupCenter' || cls === 'group2') {
    return { kind: 'grp', shapeClass: cls,
             stencil: (m.get('grIcon') || '').replace(/^mxgraph\.aws4\./, ''), map: m };
  }
  if (cls) {  // stencil drawn directly = plain AWS Resource Icon
    return { kind: 'res', stencil: cls, fill: m.get('fillColor'), map: m };
  }
  return { kind: 'plain', map: m };  // plain rectangle (icon-less groups) or edge
}

// ------------------------------------------------- 4. canonical templates

const PH_FILL = '${FILL}';
const PH_STENCIL = '${STENCIL}';

/**
 * The Management Governance palette repeats an identical `points=[...]` twice
 * in 39 entries — a cosmetic Sidebar-AWS4.js bug (mxGraph uses the last
 * occurrence, so the effect is null). Removing the repetition, those 39 fall
 * inside the canonical template instead of becoming a literal style.
 */
let pointsDeduplicated = 0;
function dedupPoints(style) {
  const parts = style.split(';');
  const seen = new Set();
  const output = [];
  let changed = false;
  for (const p of parts) {
    if (p.startsWith('points=')) {
      if (seen.has(p)) { changed = true; continue; }
      seen.add(p);
    }
    output.push(p);
  }
  if (changed) pointsDeduplicated++;
  return output.join(';');
}

function canonicalize(style, stencil, fill) {
  let s = style;
  if (fill) s = s.split(fill).join(PH_FILL);
  if (stencil) s = s.split('mxgraph.aws4.' + stencil).join('mxgraph.aws4.' + PH_STENCIL);
  return s;
}

function modeOf(counts) {
  let best = null, bestN = -1;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return { template: best, hits: bestN };
}

const svcCounts = new Map(), resCounts = new Map();
const classified = entries.map(e => ({ e, c: classify(e), styleN: dedupPoints(e.style) }));

for (const { c, styleN } of classified) {
  if (c.kind === 'svc' || c.kind === 'res') {
    const canon = canonicalize(styleN, c.stencil, c.fill);
    const bag = c.kind === 'svc' ? svcCounts : resCounts;
    bag.set(canon, (bag.get(canon) || 0) + 1);
  }
}

const svcTpl = modeOf(svcCounts);
const resTpl = modeOf(resCounts);

// --------------------------------------------------- 5. color by category

// fillColor is a function of the CATEGORY, not of the service (research §7.2).
const paletteFill = new Map();   // palette -> Map(fill -> n)
for (const { e, c } of classified) {
  if ((c.kind === 'svc' || c.kind === 'res') && c.fill) {
    if (!paletteFill.has(e.palette)) paletteFill.set(e.palette, new Map());
    const m = paletteFill.get(e.palette);
    m.set(c.fill, (m.get(c.fill) || 0) + 1);
  }
}

function slug(s) {
  return s.replace(/^AWS \/ /, '').trim().toLowerCase()
          .replace(/[&]/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/^_|_$/g, '');
}

const categories = {};
for (const [palette, fills] of paletteFill) {
  const { template: fill, hits } = modeOf(fills);
  const total = [...fills.values()].reduce((a, b) => a + b, 0);
  categories[slug(palette)] = {
    label: palette.replace(/^AWS \/ /, ''),
    fill,
    entries: total,
    ...(hits < total ? { fillVariants: Object.fromEntries(fills) } : {})
  };
}

// ------------------------------------------------------------ 6. entries

const services = [];   // Service Icons (resourceIcon)
const resources = [];  // plain Resource Icons (direct stencil)
const groups = [];
const other = [];

for (const { e, c, styleN } of classified) {
  const category = slug(e.palette);
  const base = { title: e.title, palette: category, w: e.width, h: e.height };

  if (c.kind === 'svc' || c.kind === 'res') {
    const tpl = c.kind === 'svc' ? svcTpl.template : resTpl.template;
    const canon = canonicalize(styleN, c.stencil, c.fill);
    const rec = { ...base, stencil: c.stencil };
    const categoryFill = categories[category] && categories[category].fill;
    if (c.fill !== categoryFill) rec.fill = c.fill;      // exception to the category color
    if (canon !== tpl) rec.style = styleN;              // outside the template: stores literal
    (c.kind === 'svc' ? services : resources).push(rec);
  } else if (c.kind === 'grp') {
    groups.push({ ...base, shapeClass: c.shapeClass, grIcon: c.stencil, style: styleN });
  } else if (c.kind === 'plain' && e.kind === 'vertex') {
    groups.push({ ...base, shapeClass: null, grIcon: null, style: styleN });
  } else {
    other.push({ ...base, kind: e.kind, style: e.style });
  }
}

// ---------------------------------------------- 7. reference validation

const referenced = new Set();
for (const r of services) referenced.add(r.stencil);
for (const r of resources) referenced.add(r.stencil);
for (const g of groups) if (g.grIcon) referenced.add(g.grIcon);
const broken = [...referenced].filter(s => s && !declaredStencils.has(s));

// -------------------------------------------------------- 8. provenance

function git(args) {
  try { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim(); }
  catch { return null; }
}
let drawioVersion = null;
try {
  const changelog = fs.readFileSync(path.join(repo, 'ChangeLog'), 'utf8');
  const m = changelog.match(/^\s*([0-9]{2}-[A-Z]{3}-[0-9]{4}):\s*([0-9.]+)/m);
  if (m) drawioVersion = { date: m[1], version: m[2] };
} catch { /* no ChangeLog */ }

// NOTE: the `catalog` object below is written verbatim to aws4.catalog.json,
// a file this tool does not own the schema of end to end — it mirrors what
// draw.io ships. Its key names (including the Portuguese `meta.*` and
// `templates.*.cobre` fields) and the `note` prose are frozen to match the
// currently committed file; do not rename them here without regenerating
// and re-committing aws4.catalog.json in the same change.
const catalog = {
  meta: {
    fonte: 'jgraph/drawio — src/main/webapp/js/diagramly/sidebar/Sidebar-AWS4.js + stencils/aws4.xml',
    drawio: drawioVersion,
    commit: git(['log', '-1', '--format=%H']),
    commitDate: git(['log', '-1', '--format=%cI']),
    family: 'mxgraph.aws4',
    stencilsDeclarados: declaredStencils.size,
    referenciasQuebradas: broken,
    pointsDuplicadosNormalizados: pointsDeduplicated,
    extraidoPor: 'catalog/tools/extract-aws4-catalog.cjs'
  },
  templates: {
    svc: { style: svcTpl.template, cobre: svcTpl.hits, from: services.length,
           note: 'Service Icon (quadrado colorido). ${FILL} = cor da category; ${STENCIL} = resIcon.' },
    res: { style: resTpl.template, cobre: resTpl.hits, from: resources.length,
           note: 'Resource Icon plano (sem quadrado). ${FILL} = cor da category; ${STENCIL} = shape.' }
  },
  categories,
  services,
  resources,
  groups,
  other
};

fs.writeFileSync(outPath, JSON.stringify(catalog, null, 1) + '\n');

console.error([
  `entries           ${entries.length}`,
  `  service icons   ${services.length}  (template covers ${svcTpl.hits})`,
  `  resource icons  ${resources.length}  (template covers ${resTpl.hits})`,
  `  groups          ${groups.length}`,
  `  other           ${other.length}`,
  `categories        ${Object.keys(categories).length}`,
  `points dedup      ${pointsDeduplicated}`,
  `literal styles    ${services.filter(s => s.style).length + resources.filter(r => r.style).length}`,
  `stencils in xml   ${declaredStencils.size}`,
  `broken refs       ${broken.length}${broken.length ? ' -> ' + broken.join(', ') : ''}`,
  `output            ${outPath}`
].join('\n'));
