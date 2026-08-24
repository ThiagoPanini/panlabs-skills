// #19 · B″ — cruzamento com as REGRAS DE CALHA explícitas. Mesmo modelo, mesma banda derivada.
const fs=require('fs');
const OUT='/home/paninit/workspaces/panlabs-skills/skills/panlabs-aws-diagrams/prototypes/q19';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const GRP='points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;';
const S={
 cloud:GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;fontStyle=1;fontSize=13;',
 vpc:GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#8C4FFF;dashed=0;fontStyle=1;fontSize=13;',
 az:GRP+'verticalAlign=top;align=center;fillColor=none;dashed=1;dashPattern=8 6;strokeColor=#00A4A6;fontColor=#00A4A6;fontSize=12;',
 asg:GRP+'verticalAlign=top;align=center;fillColor=none;dashed=1;dashPattern=8 6;strokeColor=#ED7100;fontColor=#ED7100;fontSize=11;spacingTop=1;',
 priv:GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#00A4A6;fillColor=#E6F6F7;verticalAlign=top;align=left;spacingLeft=30;fontColor=#00A4A6;dashed=0;fontSize=11;',
 pub:GRP+'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#7AA116;fillColor=#F2F6E8;verticalAlign=top;align=left;spacingLeft=30;fontColor=#7AA116;dashed=0;fontSize=11;',
 ec2:'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#ED7100;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;',
 nat:'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#8C4FFF;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.nat_gateway;',
 fw:'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#DD344C;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.network_firewall;',
 title:'text;html=1;fontSize=18;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;',
 sub:'text;html=1;fontSize=11;fontColor=#5A6C86;align=left;verticalAlign=middle;',
 note:'rounded=0;whiteSpace=wrap;html=1;fillColor=#EAF6EC;strokeColor=#8CBF95;fontColor=#1F5128;fontSize=11;align=left;verticalAlign=top;spacing=8;',
};
const model={
 azs:['us-east-1a','us-east-1b','us-east-1c'],
 vpcs:[
  {id:'prod',label:'VPC de produção · 10.0.0.0/16',subnets:[
   {id:'pub-a',kind:'pub',az:'us-east-1a',label:'Public subnet',node:['NAT gateway','nat']},
   {id:'pub-b',kind:'pub',az:'us-east-1b',label:'Public subnet',node:['NAT gateway','nat']},
   {id:'pub-c',kind:'pub',az:'us-east-1c',label:'Public subnet',node:['NAT gateway','nat']},
   {id:'prv-a',kind:'priv',az:'us-east-1a',label:'Private subnet',node:['EC2','ec2']},
   {id:'prv-b',kind:'priv',az:'us-east-1b',label:'Private subnet',node:['EC2','ec2']},
   {id:'prv-c',kind:'priv',az:'us-east-1c',label:'Private subnet',node:['EC2','ec2']}]},
  {id:'insp',label:'VPC de inspeção · 10.1.0.0/16',subnets:[
   {id:'fw-a',kind:'pub',az:'us-east-1a',label:'Firewall subnet',node:['Network Firewall','fw']},
   {id:'fw-b',kind:'pub',az:'us-east-1b',label:'Firewall subnet',node:['Network Firewall','fw']}]}],
 bands:[{id:'asg',label:'Auto Scaling group',style:'asg',scope:'prod',members:['prv-a','prv-b','prv-c']}],
};

// ======================= AS TRÊS REGRAS DE CALHA =======================
const AZ_LANE   = 36;  // 1. faixa livre no topo, só para o rótulo das colunas de AZ
const BAND_LANE = 24;  // 2. faixa livre para o rótulo de uma banda de membros
const CROSS_OUT = 24;  // 3. quanto a banda ultrapassa o conteúdo que ela cruza
const HEAD      = 34;  // 4. faixa de título de QUALQUER container é área reservada (#2) — vale recursivamente
const COL_W=300, COL_GAP=30, ROW_H=100, ROW_GAP=12, PAD=16, VPC_HEAD=40, VPC_GAP=44;

const colX={}; model.azs.forEach((az,i)=>colX[az]=i*(COL_W+COL_GAP));
const rowsOf=v=>[...new Set(v.subnets.map(s=>s.kind+'|'+s.label))];
// regra 2: o gap ANTES da primeira linha de uma banda cresce para caber o rótulo dela
const bandFirstRow={};
for(const bd of model.bands){
  const v=model.vpcs.find(x=>x.id===bd.scope), rows=rowsOf(v);
  const idx=Math.min(...bd.members.map(m=>rows.indexOf(v.subnets.find(s=>s.id===m).kind+'|'+v.subnets.find(s=>s.id===m).label)));
  (bandFirstRow[v.id]=bandFirstRow[v.id]||new Set()).add(idx);
}
const place={}, vpcBox={};
let y = HEAD + AZ_LANE;                    // regras 1+4: a calha de AZ nasce ABAIXO da faixa de título da nuvem
for(const v of model.vpcs){
  const rows=rowsOf(v), banded=bandFirstRow[v.id]||new Set();
  const gapBefore=i=> i===0?0:(banded.has(i)?ROW_GAP+BAND_LANE:ROW_GAP);
  let h=VPC_HEAD; const rowY=[];
  rows.forEach((_,i)=>{ h+=gapBefore(i); rowY.push(h); h+=ROW_H; });
  h+=PAD;
  vpcBox[v.id]={x:8,y,w:2*PAD+3*COL_W+2*COL_GAP+32,h};
  for(const s of v.subnets){
    const r=rows.indexOf(s.kind+'|'+s.label);
    place[s.id]={x:PAD+16+colX[s.az], y:y+rowY[r], w:COL_W, h:ROW_H};
  }
  y+=h+VPC_GAP;
}
const BOTTOM=y-VPC_GAP;
const TOP_OF_CONTENT=Math.min(...Object.values(vpcBox).map(b=>b.y));

function azBand(az){
  const ms=model.vpcs.flatMap(v=>v.subnets).filter(s=>s.az===az).map(s=>place[s.id]);
  if(!ms.length) return null;
  return { x:Math.min(...ms.map(m=>m.x))-14,
           y:TOP_OF_CONTENT-AZ_LANE,                       // topo comum → rótulos numa linha só
           w:Math.max(...ms.map(m=>m.x+m.w))+14-(Math.min(...ms.map(m=>m.x))-14),
           h:Math.max(...ms.map(m=>m.y+m.h))+CROSS_OUT-(TOP_OF_CONTENT-AZ_LANE) };
}
function memberBand(bd){
  const ms=bd.members.map(id=>place[id]);
  const x1=Math.min(...ms.map(m=>m.x))-10, x2=Math.max(...ms.map(m=>m.x+m.w))+10;
  const y1=Math.min(...ms.map(m=>m.y))-BAND_LANE, y2=Math.max(...ms.map(m=>m.y+m.h))+10;
  return {x:x1,y:y1,w:x2-x1,h:y2-y1};
}
let n=0; const b=[];
const put=(v,st,p,g)=>{const id='s'+(++n);b.push(`        <mxCell id="${id}" value="${esc(v)}" style="${st}" vertex="1" parent="${p}"><mxGeometry x="${Math.round(g.x)}" y="${Math.round(g.y)}" width="${Math.round(g.w)}" height="${Math.round(g.h)}" as="geometry"/></mxCell>`);return id;};
const CY=92, W=1180, H=CY+BOTTOM+34+72;
put('B″ · Cruzamento com regras de calha — o custo é limitado', S.title,'1',{x:40,y:30,w:1000,h:26});
put('Mesmo modelo do B′. Quatro constantes eliminam TODA colisão: calha de AZ (36), calha de banda (24), transbordo (24), faixa de título (34).', S.sub,'1',{x:40,y:56,w:1120,h:18});
const cloud=put('AWS Cloud',S.cloud,'1',{x:40,y:CY,w:1096,h:BOTTOM+28});
for(const az of model.azs){const g=azBand(az); if(g) put('Availability Zone · '+az,S.az,cloud,g);}
for(const v of model.vpcs){
  const vb=vpcBox[v.id], vp=put(v.label,S.vpc,cloud,vb);
  for(const s of v.subnets){
    const g=place[s.id];
    const sid=put(s.label,S[s.kind],vp,{x:g.x-vb.x,y:g.y-vb.y,w:g.w,h:g.h});
    put(s.node[0],S[s.node[1]],sid,{x:g.w/2-22,y:34,w:44,h:44});
  }
}
for(const bd of model.bands) put(bd.label,S[bd.style],cloud,memberBand(bd));
put('<b>Zero colisão — e nenhuma delas foi resolvida à mão.</b> A calha é do gerador, não do desenhista: AZ_LANE reserva a linha de rótulo das colunas, BAND_LANE alarga só o gap de linha onde uma banda começa, CROSS_OUT garante que o cruzamento SE VEJA. E a regra 4 é recursiva: a calha de uma banda nasce sempre abaixo da faixa de título de quem a contém. É esse o preço de honrar o deck — quatro constantes, não um motor novo.', S.note,'1',{x:40,y:CY+BOTTOM+34,w:1096,h:56});
fs.writeFileSync(OUT+'/b3-calhas.drawio',
`<mxfile host="panlabs-proto" type="device">
  <diagram name="calhas" id="d-b3">
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
console.log('ok H=',H);
