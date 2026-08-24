// #21 · Os quatro candidatos. Um modelo só; o que muda é a política de eixo
// e de aresta. Rodar: node gerar.js
'use strict';
const fs = require('fs');
const M = require('./motor.js');
const { esc, S, K, iconStyle, layout, unionRect, iconRect, route, routeAcross, routeAround, pointAt, medir } = M;
const OUT = __dirname;

const { baseModel, ZONES } = require('./modelo.js');

// ============================================================== emissão
function desenhar({ model, axis, titulo, subtitulo, nota, bandas = true, arquivo }) {
  const L = layout(model, axis);
  const bandsList = bandas ? model.bands : [];
  const azBandsRects = {};
  for (const b of bandsList.filter(x => x.kind === 'az'))
    azBandsRects[model.nodes.find(n => b.members.includes(n.id)).zone] = L.bandRect(b);

  // --- caixas de subnet: uma por (etapa, zona) declarada, ou span
  const boxes = [];
  const seen = new Set();
  for (const n of model.nodes) {
    if (!n.box) continue;
    const key = n.stage + '|' + (n.zone ?? '*');
    if (seen.has(key)) continue;
    seen.add(key);
    boxes.push({ id: 'box-' + key.replace(/\W+/g, '_'), rect: L.R[n.id], style: S[n.box],
                 label: n.boxLabel, holds: n.id });
  }

  // --- VPC = união das caixas cujas etapas ela cobre (a árvore Cloud › VPC › Subnet do #19)
  const dentroVpc = boxes.filter(b => model.vpcStages.includes(
    model.nodes.find(n => n.id === b.holds).stage));
  const vpcRect = unionRect(dentroVpc.map(b => b.rect), { l: K.PAD, t: K.HEAD + 6, r: K.PAD, b: K.PAD });

  // --- roteamento (antes da nuvem, para o bbox contar as arestas)
  const stageIdx = id => model.stages.findIndex(s => s.id === model.nodes.find(n => n.id === id).stage);
  const margens = L.H ? { antes: -32, depois: L.contentH + 32 }
                      : { antes: -32, depois: L.contentW + 32 };
  const routed = [];
  for (const e of model.edges) {
    if (!L.R[e.from] || !L.R[e.to]) throw new Error('aresta sem nó: ' + e.from + '→' + e.to);
    const a = iconRect(L.R[e.from]), b = iconRect(L.R[e.to]);
    const pula = Math.abs(stageIdx(e.to) - stageIdx(e.from)) > 1;
    const poly = e.across ? routeAcross(L, a, b)
               : pula     ? routeAround(L, a, b, margens)
               :            route(L, a, b, e.slot || 0);
    routed.push({ ...e, poly, a, b });
  }

  const tudo = [...Object.values(azBandsRects), ...bandsList.filter(x => x.kind !== 'az').map(b => L.bandRect(b)),
                vpcRect, ...model.nodes.filter(n => !n.outside).map(n => L.R[n.id])];
  const cloudRect = unionRect(tudo, { l: K.PAD, t: K.HEAD + 6, r: K.PAD, b: K.PAD });

  // --- emissão
  const cells = [];
  let seq = 0;
  const rel = (r, p) => p ? { x: r.x - p.x, y: r.y - p.y, w: r.w, h: r.h } : r;
  const put = (label, style, parent, r, parentRect, extra) => {
    const id = 'c' + (++seq), g = rel(r, parentRect);
    cells.push(`        <mxCell id="${id}" value="${esc(label ?? '')}" style="${style}" vertex="1" parent="${parent}"${extra || ''}>` +
      `<mxGeometry x="${Math.round(g.x)}" y="${Math.round(g.y)}" width="${Math.round(g.w)}" height="${Math.round(g.h)}" as="geometry"/></mxCell>`);
    return id;
  };

  const cloud = put('AWS Cloud', S.cloud, '1', cloudRect, null);

  // faixas de AZ ANTES da VPC → ficam atrás (#19: a faixa é irmã da VPC, não pai)
  const azAlign = L.H ? 'align=left;spacingLeft=10;' : 'align=center;';
  for (const b of bandsList.filter(x => x.kind === 'az')) {
    const zone = model.nodes.find(n => b.members.includes(n.id)).zone;
    put(b.label, S.az + 'verticalAlign=top;' + azAlign, cloud, azBandsRects[zone], cloudRect);
  }

  const vpc = put(model.vpcLabel, S.vpc, cloud, vpcRect, cloudRect);
  const idDe = {};
  for (const b of boxes) {
    const n = model.nodes.find(x => x.id === b.holds);
    const dentro = model.vpcStages.includes(n.stage);
    const pai = dentro ? vpc : cloud, paiRect = dentro ? vpcRect : cloudRect;
    const bx = put(b.label, b.style, pai, b.rect, paiRect);
    idDe[n.id] = put(n.label, iconStyle(n.svc), bx, iconRect(b.rect), b.rect);
  }
  // nós sem caixa (fora da VPC, ou fora da nuvem)
  for (const n of model.nodes) {
    if (n.box) continue;
    const pai = n.outside ? '1' : cloud, paiRect = n.outside ? null : cloudRect;
    idDe[n.id] = put(n.label, iconStyle(n.svc), pai, iconRect(L.R[n.id]), paiRect);
  }
  // bandas de membro DEPOIS da VPC → ficam na frente
  for (const b of bandsList.filter(x => x.kind !== 'az'))
    put(b.label, S.asg + 'verticalAlign=top;' + azAlign, cloud, L.bandRect(b), cloudRect);

  // --- arestas: pai é a raiz, waypoints em coordenadas absolutas (#2)
  const H = L.H;
  for (const e of routed) {
    const fwd = e.across
      ? null
      : (H ? e.b.x >= e.a.x : e.b.y >= e.a.y);
    let anchor;
    if (e.across) anchor = H ? 'exitX=0.5;exitY=1;entryX=0.5;entryY=0;' : 'exitX=1;exitY=0.5;entryX=0;entryY=0.5;';
    else if (H) anchor = fwd ? 'exitX=1;exitY=0.5;entryX=0;entryY=0.5;' : 'exitX=0;exitY=0.5;entryX=1;entryY=0.5;';
    else anchor = fwd ? 'exitX=0.5;exitY=1;entryX=0.5;entryY=0;' : 'exitX=0.5;exitY=0;entryX=0.5;entryY=1;';
    const st = (e.dash ? S.edgeDash : S.edge) + anchor + 'exitDx=0;exitDy=0;entryDx=0;entryDy=0;';
    const wps = e.poly.slice(1, -1)
      .map(p => `<mxPoint x="${Math.round(p.x)}" y="${Math.round(p.y)}"/>`).join('');
    cells.push(`        <mxCell id="e${++seq}" style="${st}" edge="1" parent="1" source="${idDe[e.from]}" target="${idDe[e.to]}">` +
      `<mxGeometry relative="1" as="geometry">${wps ? `<Array as="points">${wps}</Array>` : ''}</mxGeometry></mxCell>`);
  }
  // callouts (A12) e etiquetas
  for (const e of routed) {
    if (e.n) {
      const p = pointAt(e.poly);
      put(e.n, S.callout, '1', { x: p.x - K.CALLOUT / 2, y: p.y - K.CALLOUT / 2, w: K.CALLOUT, h: K.CALLOUT }, null);
    }
    if (e.tag) {
      const p = pointAt(e.poly);
      put(e.tag, S.tag, '1', { x: p.x - 60, y: p.y - 9, w: 120, h: 18 }, null);
    }
  }

  // --- moldura da página
  const bbox = unionRect([cloudRect, ...model.nodes.filter(n => n.outside).map(n => iconRect(L.R[n.id]))]);
  const OFFX = 40 - bbox.x, OFFY = 118 - bbox.y;
  const W = bbox.w + 80, Hgt = 118 + bbox.h + 34 + 76;

  const head = [];
  head.push(`        <mxCell id="t1" value="${esc(titulo)}" style="${S.title}" vertex="1" parent="1"><mxGeometry x="40" y="34" width="${W - 80}" height="26" as="geometry"/></mxCell>`);
  head.push(`        <mxCell id="t2" value="${esc(subtitulo)}" style="${S.sub}" vertex="1" parent="1"><mxGeometry x="40" y="62" width="${W - 80}" height="34" as="geometry"/></mxCell>`);
  head.push(`        <mxCell id="t3" value="${esc(nota)}" style="${S.note}" vertex="1" parent="1"><mxGeometry x="40" y="${118 + bbox.h + 30}" width="${W - 80}" height="60" as="geometry"/></mxCell>`);

  // desloca tudo que é filho da raiz
  const shifted = cells.map(c => c.replace(/parent="1"><mxGeometry x="(-?\d+)" y="(-?\d+)"/,
    (_, x, y) => `parent="1"><mxGeometry x="${Math.round(+x + OFFX)}" y="${Math.round(+y + OFFY)}"`))
    .map(c => c.includes('edge="1"')
      ? c.replace(/<mxPoint x="(-?\d+)" y="(-?\d+)"\/>/g, (_, x, y) => `<mxPoint x="${Math.round(+x + OFFX)}" y="${Math.round(+y + OFFY)}"/>`)
      : c);

  // #19 deixou o aviso: XML inválido renderiza TRUNCADO, sem erro nenhum.
  // Um `<` cru dentro de atributo já basta. O gerador valida antes de gravar.
  const validar = xml => {
    for (const [, val] of xml.matchAll(/\s(?:value|style)="([^"]*)"/g))
      if (/[<>]/.test(val)) throw new Error('atributo com < ou > cru: ' + val.slice(0, 80));
    const abre = (xml.match(/<mxCell\b/g) || []).length;
    const fecha = (xml.match(/<\/mxCell>/g) || []).length + (xml.match(/<mxCell[^>]*\/>/g) || []).length;
    if (abre !== fecha) throw new Error(`mxCell desbalanceado: ${abre} abre, ${fecha} fecha`);
    return xml;
  };

  fs.writeFileSync(`${OUT}/${arquivo}.drawio`, validar(
`<mxfile host="panlabs-proto" type="device">
  <diagram name="${esc(arquivo)}" id="d-${esc(arquivo)}">
    <mxGraphModel dx="1400" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1"
      arrows="1" fold="1" page="1" pageScale="1" pageWidth="${Math.round(W)}" pageHeight="${Math.round(Hgt)}"
      math="0" shadow="0" background="#FFFFFF">
      <root>
        <mxCell id="0"/><mxCell id="1" parent="0"/>
${head.join('\n')}
${shifted.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`));

  const m = medir(model, L, azBandsRects, routed);
  return { arquivo, W: Math.round(bbox.w), H: Math.round(bbox.h),
           aspect: +(bbox.w / bbox.h).toFixed(2), ...m };
}

// ============================================================== candidatos
const relatorio = [];

// --- A · deck fiel: AZ em COLUNAS, fluxo VERTICAL
relatorio.push(desenhar({
  model: baseModel(), axis: 'V',
  titulo: 'A · AZ em colunas, fluxo na vertical',
  subtitulo: 'A leitura da lâmina 9 do deck preservada: zona = coluna. O fluxo numerado desce. Contraria O1 (fluxo E→D em 17 de 24 diagramas oficiais).',
  nota: '<b>O que olhar:</b> a faixa de AZ é a coluna, como no deck. O fluxo 1→5 desce contra a convenção mais forte do corpus. Repare na proporção da página e em quanto o ALB e o Auto Scaling group — que cruzam zona — ficam confortáveis nesta orientação.',
  arquivo: 'a-az-coluna-fluxo-vertical',
}));

// --- B · O1 fiel: AZ em LINHAS, fluxo HORIZONTAL
relatorio.push(desenhar({
  model: baseModel(), axis: 'H',
  titulo: 'B · AZ em linhas, fluxo na horizontal',
  subtitulo: 'O1 preservado: fontes à esquerda, processamento no meio, consumidores à direita. A zona vira raia. Inverte o protótipo do #19.',
  nota: '<b>O que olhar:</b> cada zona é uma raia e o fluxo corre dentro dela. O rótulo da faixa sai do topo-centro (deck) para o topo-esquerda (raia). Repare que nenhuma aresta de requisição atravessa zona sem precisar — e onde atravessa, atravessa de verdade.',
  arquivo: 'b-az-linha-fluxo-horizontal',
}));

// --- C · a saída do #6: a aresta que cruzaria zona não é desenhada
const mC = baseModel();
mC.edges = mC.edges.filter(e => !['ec2-b|rds-a', 'ec2-c|rds-a'].includes(e.from + '|' + e.to));
mC.edges = mC.edges.filter(e => !(e.from === 'alb' && e.to !== 'ec2-a'));
relatorio.push(desenhar({
  model: mC, axis: 'H',
  titulo: 'C · AZ em linhas, fluxo numerado só na zona de referência',
  subtitulo: 'A saída que o #6 mediu a AWS usando para multi-conta, aplicada a zona: a aresta que cruzaria fronteira simplesmente não é desenhada. O fluxo percorre uma zona; as outras são estrutura.',
  nota: '<b>O que olhar:</b> zero aresta cruzando zona. O leitor infere que 1b e 1c fazem o mesmo — a redundância é dita pela repetição, não pelo conector. É o mesmo movimento do diagrama multi-conta carro-chefe da AWS, que tem ZERO conectores.',
  arquivo: 'c-fluxo-na-zona-de-referencia',
}));

// --- D · o gênero T4 puro: sem faixa de AZ, a zona vira multiplicidade
const mD = baseModel();
mD.zones = ['us-east-1a'];
mD.nodes = mD.nodes.filter(n => !/-[bc]$/.test(n.id));
mD.nodes.find(n => n.id === 'ec2-a').boxLabel = 'Sub-rede privada · 3 AZ';
mD.nodes.find(n => n.id === 'rds-a').boxLabel = 'Sub-rede privada · 2 AZ';
mD.nodes.find(n => n.id === 'ec2-a').label = 'EC2<br><i>×3, uma por AZ</i>';
mD.nodes.find(n => n.id === 'rds-a').label = 'RDS Multi-AZ';
mD.nodes.find(n => n.id === 'alb').boxLabel = 'Sub-redes públicas · 3 AZ';
mD.bands = [];
const vivos = new Set(mD.nodes.map(n => n.id));
mD.edges = mD.edges.filter(e => vivos.has(e.from) && vivos.has(e.to) && !e.across);
relatorio.push(desenhar({
  model: mD, axis: 'H', bandas: false,
  titulo: 'D · Sem faixa de AZ: a zona vira multiplicidade declarada',
  subtitulo: 'O gênero T4 puro. A redundância zonal é dita em texto ("×3, uma por AZ") em vez de desenhada. O eixo horizontal fica inteiro com o fluxo.',
  nota: '<b>O que olhar:</b> o diagrama mais legível dos quatro — e o que menos afirma. Não dá para ver QUE recurso está em QUE zona, nem que o RDS standby vive em 1b. Serve quando a zona não é o assunto; mente por omissão quando é.',
  arquivo: 'd-az-como-multiplicidade',
}));

// --- E · mesma orientação do B, com a ORDEM DAS RAIAS escolhida por busca.
// medir-ordem.js varre as 6 permutações nos 2 eixos: o piso alcançável de A5.5 é
// ZERO, e é o MESMO nos dois eixos. Logo o cruzamento nunca foi questão de eixo —
// é questão de ordenação, e a ordenação é barata de resolver por força bruta.
const mE = baseModel();
mE.zones = ['us-east-1a', 'us-east-1c', 'us-east-1b'];
relatorio.push(desenhar({
  model: mE, axis: 'H',
  titulo: 'E · Igual ao B, com a ordem das raias escolhida por busca',
  subtitulo: 'Mesmo eixo, mesmo modelo, mesmas arestas — só a ORDEM das raias muda, de 1a·1b·1c para 1a·1c·1b. Zero cruzamento de fronteira espúria (A5.5), contra 1 no B.',
  nota: 'O que olhar: as mesmas arestas de convergência do B, agora sem atravessar faixa alheia. A raia curta (1c, que só tem EC2) foi para o meio, e as arestas que precisam cruzar passam por onde não há banda. A varredura das 6 permutações dá piso ZERO nos DOIS eixos — a correção é de ordenação, não de eixo. Uma heurística ingênua (\u201cpor o alvo da convergência no meio\u201d) apenas troca um cruzamento por outro: force bruta, que é barata (n! com n = 2 a 4).',
  arquivo: 'e-ordem-de-raia-por-busca',
}));

console.log(JSON.stringify(relatorio, null, 2));
