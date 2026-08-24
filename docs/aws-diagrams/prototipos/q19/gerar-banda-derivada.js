// #19 · Teste de estresse: banda DERIVADA (não hardcoded) + membership assimétrica + ASG cruzando AZ.
const fs = require('fs');
const OUT = '/home/paninit/workspaces/panlabs-skills/skills/panlabs-aws-diagrams/prototypes/q19';
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const GRP='points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;';
const S={
 cloud:GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;fontStyle=1;fontSize=13;',
 vpc:GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#8C4FFF;dashed=0;fontStyle=1;fontSize=13;',
 az:GRP+'verticalAlign=top;align=center;fillColor=none;dashed=1;dashPattern=8 6;strokeColor=#00A4A6;fontColor=#00A4A6;fontSize=12;',
 asg:GRP+'verticalAlign=top;align=center;fillColor=none;dashed=1;dashPattern=8 6;strokeColor=#ED7100;fontColor=#ED7100;fontSize=11;spacingTop=2;',
 priv:GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#00A4A6;fillColor=#E6F6F7;verticalAlign=top;align=left;spacingLeft=30;fontColor=#00A4A6;dashed=0;fontSize=11;',
 pub:GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#7AA116;fillColor=#F2F6E8;verticalAlign=top;align=left;spacingLeft=30;fontColor=#7AA116;dashed=0;fontSize=11;',
 ec2:'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#ED7100;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;',
 nat:'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#8C4FFF;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.nat_gateway;',
 fw:'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#DD344C;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.network_firewall;',
 title:'text;html=1;fontSize=18;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;',
 sub:'text;html=1;fontSize=11;fontColor=#5A6C86;align=left;verticalAlign=middle;',
 note:'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF9E6;strokeColor=#E8C878;fontColor=#6B5314;fontSize=11;align=left;verticalAlign=top;spacing=8;',
};

// ---------------- MODELO (o IR): AZ é DIMENSÃO da subnet, não container ----------------
const model = {
  azs: ['us-east-1a','us-east-1b','us-east-1c'],
  vpcs: [
    { id:'prod', label:'VPC de produção · 10.0.0.0/16', subnets:[
      {id:'pub-a', kind:'pub', az:'us-east-1a', label:'Public subnet',  node:['NAT gateway','nat']},
      {id:'pub-b', kind:'pub', az:'us-east-1b', label:'Public subnet',  node:['NAT gateway','nat']},
      {id:'pub-c', kind:'pub', az:'us-east-1c', label:'Public subnet',  node:['NAT gateway','nat']},
      {id:'prv-a', kind:'priv',az:'us-east-1a', label:'Private subnet', node:['EC2','ec2']},
      {id:'prv-b', kind:'priv',az:'us-east-1b', label:'Private subnet', node:['EC2','ec2']},
      {id:'prv-c', kind:'priv',az:'us-east-1c', label:'Private subnet', node:['EC2','ec2']},
    ]},
    // ASSIMÉTRICA de propósito: inspeção só existe em 1a e 1b.
    { id:'insp', label:'VPC de inspeção · 10.1.0.0/16', subnets:[
      {id:'fw-a', kind:'pub', az:'us-east-1a', label:'Firewall subnet', node:['Network Firewall','fw']},
      {id:'fw-b', kind:'pub', az:'us-east-1b', label:'Firewall subnet', node:['Network Firewall','fw']},
    ]},
  ],
  // banda que cruza AZs DENTRO de uma VPC — mesma mecânica da AZ, outro eixo
  bands: [ { id:'asg', label:'Auto Scaling group', style:'asg', scope:'prod', members:['prv-a','prv-b','prv-c'] } ],
};

// ---------------- GEOMETRIA: a grade é do gerador; a banda é DERIVADA ----------------
const COL_W = 300, COL_GAP = 30, ROW_H = 100, ROW_GAP = 12, PAD = 16;
const CLOUD_X = 40, CLOUD_Y = 92, VPC_HEAD = 40, VPC_GAP = 42;

const colX = {}; model.azs.forEach((az,i)=>{ colX[az] = i*(COL_W+COL_GAP); });
const rowsOf = v => [...new Set(v.subnets.map(s=>s.kind+'|'+s.label))];

const place = {};           // subnetId -> {x,y,w,h} em coordenadas ABSOLUTAS da nuvem
let cursorY = 34;
const vpcBox = {};
for (const v of model.vpcs) {
  const rows = rowsOf(v);
  const h = VPC_HEAD + rows.length*ROW_H + (rows.length-1)*ROW_GAP + PAD;
  vpcBox[v.id] = { x: 8, y: cursorY, w: 2*PAD + 3*COL_W + 2*COL_GAP + 32, h };
  for (const s of v.subnets) {
    const r = rows.indexOf(s.kind+'|'+s.label);
    place[s.id] = { x: PAD+16+colX[s.az], y: cursorY + VPC_HEAD + r*(ROW_H+ROW_GAP), w: COL_W, h: ROW_H };
  }
  cursorY += h + VPC_GAP;
}
const CONTENT_BOTTOM = cursorY - VPC_GAP;

// banda de AZ = união dos membros daquela coluna, esticada 22px além do topo/base do conteúdo
function azBand(az) {
  const members = model.vpcs.flatMap(v=>v.subnets).filter(s=>s.az===az).map(s=>place[s.id]);
  if (!members.length) return null;
  const x1 = Math.min(...members.map(m=>m.x)) - 14;
  const x2 = Math.max(...members.map(m=>m.x+m.w)) + 14;
  const y1 = Math.min(...members.map(m=>m.y)) - 46;      // sobe acima do topo da VPC → CRUZA
  const y2 = Math.max(...members.map(m=>m.y+m.h)) + 26;  // desce abaixo da base    → CRUZA
  return { x:x1, y:y1, w:x2-x1, h:y2-y1 };
}
function memberBand(b) {
  const ms = b.members.map(id=>place[id]);
  const x1 = Math.min(...ms.map(m=>m.x)) - 8,  x2 = Math.max(...ms.map(m=>m.x+m.w)) + 8;
  const y1 = Math.min(...ms.map(m=>m.y)) - 22, y2 = Math.max(...ms.map(m=>m.y+m.h)) + 8;
  return { x:x1, y:y1, w:x2-x1, h:y2-y1 };
}

let n=0; const b=[];
const put=(v,st,p,g,extra)=>{const id='s'+(++n);b.push(`        <mxCell id="${id}" value="${esc(v)}" style="${st}" vertex="1" parent="${p}"${extra||''}><mxGeometry x="${Math.round(g.x)}" y="${Math.round(g.y)}" width="${Math.round(g.w)}" height="${Math.round(g.h)}" as="geometry"/></mxCell>`);return id;};

const W = 1180, H = CLOUD_Y + CONTENT_BOTTOM + 40 + 62;
put('B′ · Cruzamento com banda DERIVADA — assimetria + Auto Scaling', S.title, '1', {x:40,y:30,w:1000,h:26});
put('A VPC de inspeção só existe em 1a e 1b. A banda de us-east-1c para onde não há membro. O ASG cruza as 3 AZs. Mesma mecânica.', S.sub, '1', {x:40,y:56,w:1100,h:18});
const cloud = put('AWS Cloud', S.cloud, '1', {x:CLOUD_X,y:CLOUD_Y,w:1096,h:CONTENT_BOTTOM+30});

// 1) bandas de AZ primeiro → atrás de tudo
for (const az of model.azs) { const g = azBand(az); if (g) put('Availability Zone · '+az, S.az, cloud, g); }

// 2) VPCs e suas subnets
const cellId = {};
for (const v of model.vpcs) {
  const vb = vpcBox[v.id];
  const vp = put(v.label, S.vpc, cloud, vb);
  for (const s of v.subnets) {
    const g = place[s.id];
    const sid = put(s.label, S[s.kind], vp, {x:g.x-vb.x, y:g.y-vb.y, w:g.w, h:g.h});
    cellId[s.id]=sid;
    put(s.node[0], S[s.node[1]], sid, {x:g.w/2-22, y:34, w:44, h:44});
  }
}
// 3) banda de membros (ASG) — por cima das subnets, dentro do escopo da VPC
for (const bd of model.bands) {
  const g = memberBand(bd), vb = vpcBox[bd.scope];
  put(bd.label, S[bd.style], cloud, g);
}
put('<b>Banda = união dos membros, calculada, não desenhada à mão.</b> AZ 1c encolhe sozinha porque a VPC de inspeção não a usa. O ASG é a MESMA construção em outro eixo — e no deck ele cruza AZ 4×, mais que AZ×VPC (3×).', S.note, '1', {x:40,y:CLOUD_Y+CONTENT_BOTTOM+40,w:1096,h:44});

fs.writeFileSync(OUT+'/b2-banda-derivada.drawio',
`<mxfile host="panlabs-proto" type="device">
  <diagram name="banda-derivada" id="d-b2">
    <mxGraphModel dx="1200" dy="800" grid="0" gridSize="10" guides="1" tooltips="1" connect="1"
      arrows="1" fold="1" page="1" pageScale="1" pageWidth="${W}" pageHeight="${H}"
      math="0" shadow="0" background="#FFFFFF">
      <root>
        <mxCell id="0"/><mxCell id="1" parent="0"/>
${b.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`);
console.log('ok; H =', H, '; bandas AZ:', model.azs.map(a=>{const g=azBand(a);return a+'='+(g?Math.round(g.w)+'x'+Math.round(g.h):'—');}).join(' '));
