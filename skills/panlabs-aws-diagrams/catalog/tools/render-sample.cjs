#!/usr/bin/env node
/**
 * Assembles the sample .drawio that exercises the catalog, and the manifest
 * that says where each shape landed — so the pixel verification knows where
 * to look.
 *
 *   node render-sample.cjs [output-dir]
 *   -> sample.drawio  +  sample.manifest.json
 *
 * The sample is chosen to exercise every correction, not to be pretty:
 * frozen renames, titles ambiguous between palettes, the two icon paths,
 * and the groups that leave the sidebar without container=1.
 *
 * TWO calibration MARKERS (magenta, 10x10) anchor the mapping from
 * diagram coordinates to PNG pixels. Without them, verification would depend
 * on guessing the margin and scale the exporter used.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { load } = require(path.join(__dirname, '..', 'aws-shapes.cjs'));

const output = process.argv[2] || path.join(__dirname, '..', 'tests');
const cat = load(path.join(__dirname, '..'));

const MARKER = '#FF00FF';

// ------------------------------------------------------------- what to prove

// Service icons — including the ones that only resolve through a rename or
// disambiguation.
const SERVICES = [
  'lambda', 's3', 'dynamodb', 'ec2', 'rds',
  'sqs', 'sns', 'cloudfront', 'iam', 'eventbridge',
  'step functions', 'bedrock', 'fargate', 'athena', 'glue',
  'opensearch',            // rename: elasticsearch_service
  'iam identity center',   // rename: single_sign_on
  'cloudwatch',            // rename: cloudwatch_2 (+ duplicated points= upstream)
  'sagemaker',             // rename: SageMaker -> SageMaker AI
  'msk',                   // stencil froze without "apache"
  'api gateway',           // ambiguous: Application Integration vs Networking
  'redshift',              // ambiguous: Analytics vs Database
  'auto scaling'           // ambiguous: Compute vs Management (DIFFERENT stencil)
];

// Plain resource icons — the second icon path. Looking up only by
// resourceIcon makes the generator conclude these don't exist.
const RESOURCES = [
  's3 tables', 's3 express one zone', 'eventbridge pipes',
  'eventbridge scheduler', 'trainium', 'inferentia'
];

// Groups — the 4 without container=1 and the 8 with pre-2022 color are all here.
const GROUPS = [
  'AWS Cloud', 'Region', 'VPC', 'Availability Zone', 'Private subnet',
  'Public subnet', 'Security group', 'AWS Account', 'Auto Scaling group',
  'Corporate data center', 'Elastic Beanstalk container', 'Generic group'
];

// ------------------------------------------------------------------ layout

const ICON = 78, STEP_X = 150, STEP_Y = 150, COLS = 6, X0 = 60, Y0 = 60;
const GROUP_W = 300, GROUP_H = 190, GROUP_COLS = 4, GROUP_GAP = 40;
const CHILD = 48, CHILD_X = 40, CHILD_Y = 90;

const cells = [];
const manifest = [];
let uid = 0;
const id = () => 'c' + (++uid);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function vertex({ value, style, x, y, w, h, parent = '1' }) {
  const cid = id();
  cells.push(
    `        <mxCell id="${cid}" value="${esc(value)}" style="${esc(style)}" vertex="1" parent="${parent}">\n` +
    `          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>\n` +
    `        </mxCell>`);
  return cid;
}

// ---- top-left calibration marker
const markerStyle = `rounded=0;whiteSpace=wrap;html=1;fillColor=${MARKER};strokeColor=none;`;
vertex({ value: '', style: markerStyle, x: 0, y: 0, w: 10, h: 10 });

// ---- band A+B: loose icons
let row = 0, column = 0;
function nextPosition() {
  const x = X0 + column * STEP_X;
  const y = Y0 + row * STEP_Y;
  column++;
  if (column >= COLS) { column = 0; row++; }
  return { x, y };
}

for (const [list, expected] of [[SERVICES, 'svc'], [RESOURCES, 'res']]) {
  if (column !== 0) { column = 0; row++; }          // each list starts on its own row
  for (const name of list) {
    const r = cat.service(name);
    if (!r) throw new Error(`sample asks for "${name}" and the catalog doesn't resolve it`);
    const actualKind = r.via.startsWith('resource') ? 'res' : 'svc';
    if (actualKind !== expected) {
      throw new Error(`"${name}" should be ${expected} and resolved as ${actualKind} (${r.via})`);
    }
    const { x, y } = nextPosition();
    const cid = vertex({ value: r.title, style: r.style, x, y, w: ICON, h: ICON });
    manifest.push({
      id: cid, requested: name, title: r.title, kind: actualKind, via: r.via,
      stencil: r.stencil, fill: r.fill, x, y, w: ICON, h: ICON,
      glyph: actualKind === 'svc' ? '#ffffff' : r.fill
    });
  }
}

// ---- band C: groups, each with an icon inside (proves nesting)
const yGroups = Y0 + (row + 1) * STEP_Y;
GROUPS.forEach((name, i) => {
  const g = cat.group(name);
  if (!g) throw new Error(`sample asks for group "${name}" and the catalog doesn't resolve it`);
  const gx = X0 + (i % GROUP_COLS) * (GROUP_W + GROUP_GAP);
  const gy = yGroups + Math.floor(i / GROUP_COLS) * (GROUP_H + GROUP_GAP);
  const gid = vertex({ value: g.title, style: g.style, x: gx, y: gy, w: GROUP_W, h: GROUP_H });

  // nested child: if container=1 didn't take, it still draws, but the
  // file no longer expresses containment — that's why the manifest keeps the parent.
  const inside = cat.service('lambda');
  const fid = vertex({ value: '', style: inside.style, x: CHILD_X, y: CHILD_Y,
                        w: CHILD, h: CHILD, parent: gid });

  const stroke = (g.style.match(/strokeColor=([^;]*)/) || [])[1];
  manifest.push({
    id: gid, requested: name, title: g.title, kind: 'group',
    grIcon: g.grIcon, shapeClass: g.shapeClass, corrections: g.corrections,
    x: gx, y: gy, w: GROUP_W, h: GROUP_H,
    edge: stroke === 'none' ? null : stroke,
    child: { id: fid, x: gx + CHILD_X, y: gy + CHILD_Y, w: CHILD, h: CHILD,
             fill: inside.fill, glyph: '#ffffff' }
  });
});

// ---- bottom-right marker
const totalWidth = X0 + GROUP_COLS * (GROUP_W + GROUP_GAP);
const totalHeight = yGroups + Math.ceil(GROUPS.length / GROUP_COLS) * (GROUP_H + GROUP_GAP) + 40;
vertex({ value: '', style: markerStyle, x: totalWidth, y: totalHeight, w: 10, h: 10 });

const calib = { a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: totalWidth, y: totalHeight, w: 10, h: 10 },
                color: MARKER };

// ------------------------------------------------------------------- output

const xml =
`<mxfile host="panlabs-aws-diagrams" type="device">
  <diagram name="catalog-sample" id="sample">
    <mxGraphModel dx="1000" dy="800" grid="0" gridSize="10" guides="1" tooltips="1" connect="1"
                  arrows="1" fold="1" page="0" pageScale="1" pageWidth="850" pageHeight="1100"
                  math="0" shadow="0" background="#FFFFFF">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'sample.drawio'), xml);
fs.writeFileSync(path.join(output, 'sample.manifest.json'), JSON.stringify({
  meta: {
    drawio: cat.meta.drawio, commit: cat.meta.commit,
    services: SERVICES.length, resources: RESOURCES.length, groups: GROUPS.length
  },
  calibration: calib,
  cells: manifest
}, null, 1) + '\n');

console.error([
  `service icons  ${SERVICES.length}`,
  `resource icons ${RESOURCES.length}`,
  `groups         ${GROUPS.length}`,
  `cells          ${manifest.length} (+ ${GROUPS.length} nested children + 2 markers)`,
  `output         ${path.join(output, 'sample.drawio')}`
].join('\n'));
