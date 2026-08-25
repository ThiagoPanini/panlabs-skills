#!/usr/bin/env node
/**
 * Extrai o catálogo de shapes AWS do draw.io para JSON compacto.
 *
 * Uso: node extract-aws4-catalog.cjs <repo-drawio> [saida.json]
 *
 * As style strings NÃO existem literalmente em nenhum arquivo — o
 * `Sidebar-AWS4.js` as monta por concatenação em runtime. Grep recupera no
 * máximo o sufixo (`.lambda;`), nunca o prefixo com a cor. A única forma
 * correta é executar o arquivo: aqui num `vm` com stubs mínimos do mxGraph,
 * interceptando `createVertexTemplateEntry`.
 *
 * Referência: §4 da pesquisa de shapes do #17.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const repo = process.argv[2];
const outPath = process.argv[3] || path.join(__dirname, '..', 'aws4.catalog.json');

if (!repo || !fs.existsSync(repo)) {
  console.error('uso: node extract-aws4-catalog.cjs <repo-drawio> [saida.json]');
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

// -------------------------------------------------- 2. estoque de stencils

const stencilXml = fs.readFileSync(
  path.join(repo, 'src/main/webapp/stencils/aws4.xml'), 'utf8');

// Normalização de nome, verbatim de mxStencilRegistry.parseStencilSet:
//   name.replace(/ /g,"_")  e depois .toLowerCase()
const declaredStencils = new Set(
  [...stencilXml.matchAll(/<shape [^>]*name="([^"]*)"/g)]
    .map(m => m[1].replace(/ /g, '_').toLowerCase()));

// ------------------------------------------------------- 3. parse de style

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
  if (cls) {  // stencil desenhado direto = Resource Icon plano da AWS
    return { kind: 'res', stencil: cls, fill: m.get('fillColor'), map: m };
  }
  return { kind: 'plain', map: m };  // retângulo puro (grupos sem ícone) ou aresta
}

// ------------------------------------------------- 4. templates canônicos

const PH_FILL = '${FILL}';
const PH_STENCIL = '${STENCIL}';

/**
 * A paleta Management Governance repete `points=[...]` idêntico duas vezes em
 * 39 entradas — bug cosmético do Sidebar-AWS4.js (o mxGraph usa a última
 * ocorrência, então o efeito é nulo). Removendo a repetição, essas 39 caem
 * dentro do template canônico em vez de virarem style literal.
 */
let pointsDeduplicados = 0;
function dedupPoints(style) {
  const partes = style.split(';');
  const vistos = new Set();
  const saida = [];
  let mexeu = false;
  for (const p of partes) {
    if (p.startsWith('points=')) {
      if (vistos.has(p)) { mexeu = true; continue; }
      vistos.add(p);
    }
    saida.push(p);
  }
  if (mexeu) pointsDeduplicados++;
  return saida.join(';');
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

// --------------------------------------------------- 5. cor por categoria

// fillColor é função da CATEGORIA, não do serviço (pesquisa §7.2).
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
          .replace(/[&]/g, ' ').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
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

// ------------------------------------------------------------ 6. entradas

const services = [];   // Service Icons (resourceIcon)
const resources = [];  // Resource Icons planos (stencil direto)
const groups = [];
const other = [];

for (const { e, c, styleN } of classified) {
  const cat = slug(e.palette);
  const base = { title: e.title, palette: cat, w: e.width, h: e.height };

  if (c.kind === 'svc' || c.kind === 'res') {
    const tpl = c.kind === 'svc' ? svcTpl.template : resTpl.template;
    const canon = canonicalize(styleN, c.stencil, c.fill);
    const rec = { ...base, stencil: c.stencil };
    const catFill = categories[cat] && categories[cat].fill;
    if (c.fill !== catFill) rec.fill = c.fill;          // exceção à cor da categoria
    if (canon !== tpl) rec.style = styleN;              // fora do template: guarda literal
    (c.kind === 'svc' ? services : resources).push(rec);
  } else if (c.kind === 'grp') {
    groups.push({ ...base, shapeClass: c.shapeClass, grIcon: c.stencil, style: styleN });
  } else if (c.kind === 'plain' && e.kind === 'vertex') {
    groups.push({ ...base, shapeClass: null, grIcon: null, style: styleN });
  } else {
    other.push({ ...base, kind: e.kind, style: e.style });
  }
}

// ---------------------------------------------- 7. validação de referência

const referenced = new Set();
for (const r of services) referenced.add(r.stencil);
for (const r of resources) referenced.add(r.stencil);
for (const g of groups) if (g.grIcon) referenced.add(g.grIcon);
const broken = [...referenced].filter(s => s && !declaredStencils.has(s));

// -------------------------------------------------------- 8. proveniência

function git(args) {
  try { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim(); }
  catch { return null; }
}
let drawioVersion = null;
try {
  const changelog = fs.readFileSync(path.join(repo, 'ChangeLog'), 'utf8');
  const m = changelog.match(/^\s*([0-9]{2}-[A-Z]{3}-[0-9]{4}):\s*([0-9.]+)/m);
  if (m) drawioVersion = { date: m[1], version: m[2] };
} catch { /* sem ChangeLog */ }

const catalog = {
  meta: {
    fonte: 'jgraph/drawio — src/main/webapp/js/diagramly/sidebar/Sidebar-AWS4.js + stencils/aws4.xml',
    drawio: drawioVersion,
    commit: git(['log', '-1', '--format=%H']),
    commitDate: git(['log', '-1', '--format=%cI']),
    family: 'mxgraph.aws4',
    stencilsDeclarados: declaredStencils.size,
    referenciasQuebradas: broken,
    pointsDuplicadosNormalizados: pointsDeduplicados,
    extraidoPor: 'catalog/tools/extract-aws4-catalog.cjs'
  },
  templates: {
    svc: { style: svcTpl.template, cobre: svcTpl.hits, from: services.length,
           note: 'Service Icon (quadrado colorido). ${FILL} = cor da categoria; ${STENCIL} = resIcon.' },
    res: { style: resTpl.template, cobre: resTpl.hits, from: resources.length,
           note: 'Resource Icon plano (sem quadrado). ${FILL} = cor da categoria; ${STENCIL} = shape.' }
  },
  categories,
  services,
  resources,
  groups,
  other
};

fs.writeFileSync(outPath, JSON.stringify(catalog, null, 1) + '\n');

console.error([
  `entradas          ${entries.length}`,
  `  service icons   ${services.length}  (template cobre ${svcTpl.hits})`,
  `  resource icons  ${resources.length}  (template cobre ${resTpl.hits})`,
  `  grupos          ${groups.length}`,
  `  outros          ${other.length}`,
  `categorias        ${Object.keys(categories).length}`,
  `points dedup      ${pointsDeduplicados}`,
  `styles literais   ${services.filter(s => s.style).length + resources.filter(r => r.style).length}`,
  `stencils no xml   ${declaredStencils.size}`,
  `refs quebradas    ${broken.length}${broken.length ? ' -> ' + broken.join(', ') : ''}`,
  `saida             ${outPath}`
].join('\n'));
