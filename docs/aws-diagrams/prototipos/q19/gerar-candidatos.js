// Protótipo descartável do ticket #19 — 2 VPCs x 3 AZs em três representações.
const fs = require('fs');
const OUT = '/home/paninit/workspaces/panlabs-skills/skills/panlabs-aws-diagrams/prototypes/q19';

const GRP = 'points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;';
const S = {
  cloud:  GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;fontStyle=1;fontSize=13;',
  vpc:    GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#8C4FFF;dashed=0;fontStyle=1;fontSize=13;',
  // AZ: cor OFICIAL #00A4A6 (o preset do draw.io traz #147eba, pré-2022 — ver #3), tracejado, rótulo CENTRALIZADO, sem ícone
  az:     GRP+'verticalAlign=top;align=center;fillColor=none;dashed=1;dashPattern=8 6;strokeColor=#00A4A6;fontColor=#00A4A6;fontSize=12;fontStyle=0;',
  priv:   GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#00A4A6;fillColor=#E6F6F7;verticalAlign=top;align=left;spacingLeft=30;fontColor=#00A4A6;dashed=0;fontSize=11;',
  pub:    GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#7AA116;fillColor=#F2F6E8;verticalAlign=top;align=left;spacingLeft=30;fontColor=#7AA116;dashed=0;fontSize=11;',
  fw:     GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#7AA116;fillColor=#F2F6E8;verticalAlign=top;align=left;spacingLeft=30;fontColor=#7AA116;dashed=0;fontSize=11;',
  node:   'sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#ED7100;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;',
  fwnode: 'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#DD344C;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.network_firewall;',
  nat:    'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#8C4FFF;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.nat_gateway;',
  title:  'text;html=1;fontSize=18;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;',
  sub:    'text;html=1;fontSize=11;fontColor=#5A6C86;align=left;verticalAlign=middle;',
  note:   'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF9E6;strokeColor=#E8C878;fontColor=#6B5314;fontSize=11;align=left;verticalAlign=top;spacing=8;',
};

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let n = 0;
function cell(v, style, parent, x, y, w, h, extra) {
  const id = 'n' + (++n);
  const e = extra || '';
  return { id, xml: `        <mxCell id="${id}" value="${esc(v)}" style="${style}" vertex="1" parent="${parent}"${e}><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>` };
}

function doc(name, W, H, body) {
  return `<mxfile host="panlabs-proto" type="device">
  <diagram name="${name}" id="d-${name}">
    <mxGraphModel dx="1200" dy="800" grid="0" gridSize="10" guides="1" tooltips="1" connect="1"
      arrows="1" fold="1" page="1" pageScale="1" pageWidth="${W}" pageHeight="${H}"
      math="0" shadow="0" background="#FFFFFF">
      <root>
        <mxCell id="0"/><mxCell id="1" parent="0"/>
${body.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
}

const AZS = ['us-east-1a', 'us-east-1b', 'us-east-1c'];
const W = 1180, H = 760;

// ---------------------------------------------------------------- A: ÁRVORE ESTRITA
function candA() {
  const b = [];
  b.push(cell('A · Árvore estrita — AZ dentro da VPC', S.title, '1', 40, 30, 900, 26).xml);
  b.push(cell('O que mxCell e elkjs já sabem fazer. A AZ vira filha da VPC — e por isso é DESENHADA 6 VEZES: 3 por VPC.', S.sub, '1', 40, 56, 1000, 18).xml);

  const cloud = cell('AWS Cloud', S.cloud, '1', 40, 92, 1096, 620);
  b.push(cloud.xml);
  const vpcs = [
    { t: 'VPC de produção · 10.0.0.0/16', y: 40,  h: 330, kind: 'app' },
    { t: 'VPC de inspeção · 10.1.0.0/16', y: 396, h: 190, kind: 'fw'  },
  ];
  for (const v of vpcs) {
    const vp = cell(v.t, S.vpc, cloud.id, 24, v.y, 1048, v.h);
    b.push(vp.xml);
    AZS.forEach((az, i) => {
      const azc = cell('Availability Zone<br>' + az, S.az, vp.id, 28 + i * 336, 38, 320, v.h - 62);
      b.push(azc.xml);
      if (v.kind === 'app') {
        const pu = cell('Public subnet', S.pub, azc.id, 16, 44, 288, 96); b.push(pu.xml);
        b.push(cell('NAT gateway', S.nat, pu.id, 122, 34, 44, 44).xml);
        const pr = cell('Private subnet', S.priv, azc.id, 16, 154, 288, 104); b.push(pr.xml);
        b.push(cell('EC2', S.node, pr.id, 122, 36, 44, 44).xml);
      } else {
        const fw = cell('Firewall subnet', S.fw, azc.id, 16, 44, 288, 84); b.push(fw.xml);
        b.push(cell('Network Firewall', S.fwnode, fw.id, 122, 30, 44, 44).xml);
      }
    });
  }
  b.push(cell('<b>A AZ aparece 6×.</b> Mas <i>us-east-1a</i> é UMA zona, não duas. O desenho afirma duas.<br>Custo: mente sobre identidade. Ganho: mxCell e elkjs funcionam sem nenhuma adaptação.', S.note, '1', 40, 722, 1096, 30).xml);
  return doc('arvore-estrita', W, H, b);
}

// ---------------------------------------------------------------- B: CRUZAMENTO (deck)
function candB() {
  const b = [];
  b.push(cell('B · Cruzamento — fiel ao deck oficial (slides 9 e 21)', S.title, '1', 40, 30, 900, 26).xml);
  b.push(cell('Faixas de AZ atravessam as duas VPCs. A subnet é a INTERSEÇÃO. A AZ aparece 3× — uma por zona real.', S.sub, '1', 40, 56, 1000, 18).xml);

  const cloud = cell('AWS Cloud', S.cloud, '1', 40, 92, 1096, 620);
  b.push(cloud.xml);

  // 1) faixas de AZ primeiro -> ficam ATRÁS (z-order = ordem do documento)
  const azIds = AZS.map((az, i) =>
    cell('Availability Zone · ' + az, S.az, cloud.id, 40 + i * 336, 40, 320, 552));
  azIds.forEach(c => b.push(c.xml));

  // 2) VPCs por cima, mais LARGAS que o span das AZs (sai pelos dois lados, como no slide 21)
  const vpcs = [
    { t: 'VPC de produção · 10.0.0.0/16', y: 78,  h: 300, kind: 'app' },
    { t: 'VPC de inspeção · 10.1.0.0/16', y: 404, h: 150, kind: 'fw'  },
  ];
  for (const v of vpcs) {
    const vp = cell(v.t, S.vpc, cloud.id, 20, v.y, 1056, v.h);
    b.push(vp.xml);
    AZS.forEach((az, i) => {
      // subnet = célula da grade: coluna da AZ x faixa da VPC
      const x = 36 + i * 336; // relativo à VPC (az_x 40 - vpc_x 20 + 16)
      if (v.kind === 'app') {
        const pu = cell('Public subnet', S.pub, vp.id, x, 40, 288, 96); b.push(pu.xml);
        b.push(cell('NAT gateway', S.nat, pu.id, 122, 34, 44, 44).xml);
        const pr = cell('Private subnet', S.priv, vp.id, x, 150, 288, 104); b.push(pr.xml);
        b.push(cell('EC2', S.node, pr.id, 122, 36, 44, 44).xml);
      } else {
        const fw = cell('Firewall subnet', S.fw, vp.id, x, 40, 288, 84); b.push(fw.xml);
        b.push(cell('Network Firewall', S.fwnode, fw.id, 122, 30, 44, 44).xml);
      }
    });
  }
  b.push(cell('<b>A AZ aparece 3×</b> — verdade sobre identidade. Mas a subnet é filha da VPC no XML, e a AZ é IRMÃ da VPC: a contenção visual AZ⊃subnet não existe na árvore, só nos pixels.', S.note, '1', 40, 722, 1096, 30).xml);
  return doc('cruzamento', W, H, b);
}

// ---------------------------------------------------------------- C: AZ OMITIDA (SRA)
function candC() {
  const b = [];
  b.push(cell('C · AZ omitida — o jeito da AWS SRA (medido: zero caixas de AZ)', S.title, '1', 40, 30, 940, 26).xml);
  b.push(cell('Árvore pura VPC › Subnet. A zona vira RÓTULO da subnet, não moldura. Multi-AZ se lê pela repetição.', S.sub, '1', 40, 56, 1000, 18).xml);

  const cloud = cell('AWS Cloud', S.cloud, '1', 40, 92, 1096, 560);
  b.push(cloud.xml);
  const vpcs = [
    { t: 'VPC de produção · 10.0.0.0/16', y: 40,  h: 300, kind: 'app' },
    { t: 'VPC de inspeção · 10.1.0.0/16', y: 366, h: 152, kind: 'fw'  },
  ];
  for (const v of vpcs) {
    const vp = cell(v.t, S.vpc, cloud.id, 24, v.y, 1048, v.h);
    b.push(vp.xml);
    AZS.forEach((az, i) => {
      const x = 28 + i * 336;
      if (v.kind === 'app') {
        const pu = cell('Public subnet · ' + az, S.pub, vp.id, x, 40, 320, 96); b.push(pu.xml);
        b.push(cell('NAT gateway', S.nat, pu.id, 138, 34, 44, 44).xml);
        const pr = cell('Private subnet · ' + az, S.priv, vp.id, x, 150, 320, 104); b.push(pr.xml);
        b.push(cell('EC2', S.node, pr.id, 138, 36, 44, 44).xml);
      } else {
        const fw = cell('Firewall subnet · ' + az, S.fw, vp.id, x, 40, 320, 84); b.push(fw.xml);
        b.push(cell('Network Firewall', S.fwnode, fw.id, 138, 30, 44, 44).xml);
      }
    });
  }
  b.push(cell('<b>A AZ aparece 0×.</b> Nenhuma mentira, nenhuma moldura extra — mas a fronteira de falha fica implícita no texto do rótulo, e some para quem lê rápido.', S.note, '1', 40, 668, 1096, 30).xml);
  return doc('az-omitida', 1180, 712, b);
}

fs.writeFileSync(OUT + '/a-arvore-estrita.drawio', candA());
n = 0; fs.writeFileSync(OUT + '/b-cruzamento.drawio', candB());
n = 0; fs.writeFileSync(OUT + '/c-az-omitida.drawio', candC());
console.log('escritos em', OUT);
