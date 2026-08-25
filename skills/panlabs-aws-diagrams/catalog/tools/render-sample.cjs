#!/usr/bin/env node
/**
 * Monta o .drawio de amostra que prova o catálogo, e o manifesto que diz onde
 * cada shape caiu — para a verificação por pixel saber onde olhar.
 *
 *   node render-sample.cjs [dir-de-saida]
 *   -> sample.drawio  +  sample.manifest.json
 *
 * A amostra é escolhida para exercitar cada correção, não para ser bonita:
 * renomes congelados, títulos ambíguos entre paletas, os dois caminhos de
 * ícone, e os grupos que saem da sidebar sem container=1.
 *
 * DOIS MARCADORES de calibração (magenta, 10x10) ancoram o mapeamento
 * coordenada-do-diagrama -> pixel do PNG. Sem eles a verificação dependeria de
 * adivinhar a margem e a escala que o exportador usou.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { load } = require(path.join(__dirname, '..', 'aws-shapes.cjs'));

const output = process.argv[2] || path.join(__dirname, '..', 'tests');
const cat = load(path.join(__dirname, '..'));

const MARKER = '#FF00FF';

// ------------------------------------------------------------- o que provar

// Service icons — incluindo os que só resolvem por renome ou desambiguação.
const SERVICES = [
  'lambda', 's3', 'dynamodb', 'ec2', 'rds',
  'sqs', 'sns', 'cloudfront', 'iam', 'eventbridge',
  'step functions', 'bedrock', 'fargate', 'athena', 'glue',
  'opensearch',            // renome: elasticsearch_service
  'iam identity center',   // renome: single_sign_on
  'cloudwatch',            // renome: cloudwatch_2 (+ points= duplicado no upstream)
  'sagemaker',             // renome: SageMaker -> SageMaker AI
  'msk',                   // stencil congelou sem "apache"
  'api gateway',           // ambíguo: Application Integration vs Networking
  'redshift',              // ambíguo: Analytics vs Database
  'auto scaling'           // ambíguo: Compute vs Management (stencil DIFERENTE)
];

// Resource icons planos — o segundo caminho de ícone. Buscar só por
// resourceIcon faz o gerador concluir que estes não existem.
const RESOURCES = [
  's3 tables', 's3 express one zone', 'eventbridge pipes',
  'eventbridge scheduler', 'trainium', 'inferentia'
];

// Grupos — os 4 sem container=1 e os 8 com cor pré-2022 estão todos aqui.
const GROUPS = [
  'AWS Cloud', 'Region', 'VPC', 'Availability Zone', 'Private subnet',
  'Public subnet', 'Security group', 'AWS Account', 'Auto Scaling group',
  'Corporate data center', 'Elastic Beanstalk container', 'Generic group'
];

// ------------------------------------------------------------------ layout

const ICON = 78, PASSO_X = 150, PASSO_Y = 150, COLS = 6, X0 = 60, Y0 = 60;
const GRUPO_W = 300, GRUPO_H = 190, GRUPO_COLS = 4, GRUPO_GAP = 40;
const CHILD = 48, FILHO_X = 40, FILHO_Y = 90;

const celulas = [];
const manifesto = [];
let uid = 0;
const id = () => 'c' + (++uid);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function vertice({ valor, style, x, y, w, h, parent = '1' }) {
  const cid = id();
  celulas.push(
    `        <mxCell id="${cid}" value="${esc(valor)}" style="${esc(style)}" vertex="1" parent="${parent}">\n` +
    `          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>\n` +
    `        </mxCell>`);
  return cid;
}

// ---- marcador de calibração superior-esquerdo
const marcadorStyle = `rounded=0;whiteSpace=wrap;html=1;fillColor=${MARKER};strokeColor=none;`;
vertice({ valor: '', style: marcadorStyle, x: 0, y: 0, w: 10, h: 10 });

// ---- banda A+B: ícones soltos
let row = 0, column = 0;
function nextPosition() {
  const x = X0 + column * PASSO_X;
  const y = Y0 + row * PASSO_Y;
  column++;
  if (column >= COLS) { column = 0; row++; }
  return { x, y };
}

for (const [list, expected] of [[SERVICES, 'svc'], [RESOURCES, 'res']]) {
  if (column !== 0) { column = 0; row++; }          // cada lista começa numa linha
  for (const name of list) {
    const r = cat.service(name);
    if (!r) throw new Error(`amostra pede "${name}" e o catálogo não resolve`);
    const tipoReal = r.via.startsWith('recurso') ? 'res' : 'svc';
    if (tipoReal !== expected) {
      throw new Error(`"${name}" deveria ser ${expected} e resolveu como ${tipoReal} (${r.via})`);
    }
    const { x, y } = nextPosition();
    const cid = vertice({ valor: r.title, style: r.style, x, y, w: ICON, h: ICON });
    manifesto.push({
      id: cid, pedido: name, title: r.title, kind: tipoReal, via: r.via,
      stencil: r.stencil, fill: r.fill, x, y, w: ICON, h: ICON,
      glifo: tipoReal === 'svc' ? '#ffffff' : r.fill
    });
  }
}

// ---- banda C: grupos, cada um com um ícone dentro (prova o aninhamento)
const yGrupos = Y0 + (row + 1) * PASSO_Y;
GROUPS.forEach((name, i) => {
  const g = cat.group(name);
  if (!g) throw new Error(`amostra pede o grupo "${name}" e o catálogo não resolve`);
  const gx = X0 + (i % GRUPO_COLS) * (GRUPO_W + GRUPO_GAP);
  const gy = yGrupos + Math.floor(i / GRUPO_COLS) * (GRUPO_H + GRUPO_GAP);
  const gid = vertice({ valor: g.title, style: g.style, x: gx, y: gy, w: GRUPO_W, h: GRUPO_H });

  // filho aninhado: se container=1 não pegou, ele ainda desenha, mas o
  // arquivo deixa de expressar contenção — por isso o manifesto guarda o pai.
  const inside = cat.service('lambda');
  const fid = vertice({ valor: '', style: inside.style, x: FILHO_X, y: FILHO_Y,
                        w: CHILD, h: CHILD, parent: gid });

  const stroke = (g.style.match(/strokeColor=([^;]*)/) || [])[1];
  manifesto.push({
    id: gid, pedido: name, title: g.title, kind: 'group',
    grIcon: g.grIcon, shapeClass: g.shapeClass, corrections: g.corrections,
    x: gx, y: gy, w: GRUPO_W, h: GRUPO_H,
    edge: stroke === 'none' ? null : stroke,
    filho: { id: fid, x: gx + FILHO_X, y: gy + FILHO_Y, w: CHILD, h: CHILD,
             fill: inside.fill, glifo: '#ffffff' }
  });
});

// ---- marcador inferior-direito
const larguraTotal = X0 + GRUPO_COLS * (GRUPO_W + GRUPO_GAP);
const alturaTotal = yGrupos + Math.ceil(GROUPS.length / GRUPO_COLS) * (GRUPO_H + GRUPO_GAP) + 40;
vertice({ valor: '', style: marcadorStyle, x: larguraTotal, y: alturaTotal, w: 10, h: 10 });

const calib = { a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: larguraTotal, y: alturaTotal, w: 10, h: 10 },
                color: MARKER };

// ------------------------------------------------------------------- saída

const xml =
`<mxfile host="panlabs-aws-diagrams" type="device">
  <diagram name="amostra-catalogo" id="amostra">
    <mxGraphModel dx="1000" dy="800" grid="0" gridSize="10" guides="1" tooltips="1" connect="1"
                  arrows="1" fold="1" page="0" pageScale="1" pageWidth="850" pageHeight="1100"
                  math="0" shadow="0" background="#FFFFFF">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${celulas.join('\n')}
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
    servicos: SERVICES.length, recursos: RESOURCES.length, grupos: GROUPS.length
  },
  calibracao: calib,
  celulas: manifesto
}, null, 1) + '\n');

console.error([
  `service icons  ${SERVICES.length}`,
  `resource icons ${RESOURCES.length}`,
  `grupos         ${GROUPS.length}`,
  `células        ${manifesto.length} (+ ${GROUPS.length} filhos aninhados + 2 marcadores)`,
  `saída          ${path.join(output, 'sample.drawio')}`
].join('\n'));
