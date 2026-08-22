#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const catalogo = require('../../catalog/aws-shapes.cjs').carregar();
const { CAMADAS, indexarFilhos, ordenarCamadas } = require('./camadas.cjs');

const LAYOUT = {
  margemHorizontal: 76,
  inicioVertical: 116,
  larguraVpc: 620,
  alturaSubnet: 108,
  intervaloSubnet: 24,
  alturaCabecalhoVpc: 34,
  preenchimento: 18,
  tamanhoIcone: 48,
};

const esc = valor => String(valor ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function validar(modelo) {
  if (!modelo || !Array.isArray(modelo.nos)) throw new Error('modelo.nos precisa ser uma lista');
  const ids = new Set();
  for (const no of modelo.nos) {
    if (!no.id || !no.tipo) throw new Error('todo nó precisa de id e tipo');
    if (ids.has(no.id)) throw new Error(`id repetido: "${no.id}"`);
    if (no.camada !== undefined && no.tipo !== 'subnet')
      throw new Error(`campo "camada" só é válido em subnet (veio em "${no.id}")`);
    if (no.camada !== undefined && !CAMADAS.includes(no.camada))
      throw new Error(`subnet "${no.id}" tem camada desconhecida: "${no.camada}"`);
    ids.add(no.id);
  }
  for (const no of modelo.nos)
    if (no.dentro && !ids.has(no.dentro)) throw new Error(`nó "${no.id}" aponta para pai ausente: "${no.dentro}"`);
}

function objeto({ id, rotulo, style, parent, x, y, w, h, camada, origem }) {
  const metadados = camada ? ` panlabsCamada="${esc(camada)}" panlabsOrigem="${esc(origem)}"` : '';
  return `        <object id="${esc(id)}" label="${esc(rotulo)}"${metadados}>\n` +
    `          <mxCell style="${esc(style)}" vertex="1" parent="${esc(parent)}">` +
    `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>\n` +
    '        </object>';
}

function gerar(modelo) {
  validar(modelo);
  const porId = new Map(modelo.nos.map(no => [no.id, no]));
  const filhos = indexarFilhos(modelo.nos);

  const ordenadas = ordenarCamadas(modelo, catalogo);
  const porVpc = new Map();
  for (const item of ordenadas) {
    const vpc = porId.get(item.no.dentro);
    if (!vpc || vpc.tipo !== 'vpc') throw new Error(`subnet "${item.no.id}" precisa ser filha direta de uma VPC`);
    if (!porVpc.has(vpc.id)) porVpc.set(vpc.id, []);
    porVpc.get(vpc.id).push(item);
  }

  const vpcs = modelo.nos.filter(no => no.tipo === 'vpc').sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const cells = [];
  const ordem = [];
  const avisos = [];
  let cursorY = LAYOUT.inicioVertical;

  for (const vpc of vpcs) {
    const linhas = porVpc.get(vpc.id) || [];
    const alturaVpc = LAYOUT.alturaCabecalhoVpc + LAYOUT.preenchimento +
      linhas.length * LAYOUT.alturaSubnet +
      Math.max(0, linhas.length - 1) * LAYOUT.intervaloSubnet + LAYOUT.preenchimento;
    const vpcStyle = catalogo.grupo('VPC').style;
    cells.push(objeto({ id: vpc.id, rotulo: vpc.rotulo || vpc.id, style: vpcStyle,
      parent: '1', x: LAYOUT.margemHorizontal, y: cursorY, w: LAYOUT.larguraVpc, h: alturaVpc }));

    linhas.forEach((item, indice) => {
      const subnet = item.no;
      const y = LAYOUT.alturaCabecalhoVpc + LAYOUT.preenchimento +
        indice * (LAYOUT.alturaSubnet + LAYOUT.intervaloSubnet);
      const nomeGrupo = subnet.acesso === 'publica' ? 'Public subnet' : 'Private subnet';
      cells.push(objeto({ id: subnet.id, rotulo: subnet.rotulo || subnet.id,
        style: catalogo.grupo(nomeGrupo).style, parent: vpc.id, x: LAYOUT.preenchimento, y,
        w: LAYOUT.larguraVpc - 2 * LAYOUT.preenchimento, h: LAYOUT.alturaSubnet,
        camada: item.camada, origem: item.origem }));

      const servicos = (filhos.get(subnet.id) || []).filter(no => no.tipo === 'servico')
        .sort((a, b) => a.id.localeCompare(b.id, 'en'));
      servicos.forEach((servico, j) => {
        const shape = catalogo.servico(servico.servico);
        cells.push(objeto({ id: servico.id, rotulo: servico.rotulo || shape.title,
          style: `${shape.style}fontSize=11;`, parent: subnet.id,
          x: 54 + j * 112, y: 38, w: LAYOUT.tamanhoIcone, h: LAYOUT.tamanhoIcone }));
      });

      ordem.push({ vpc: vpc.id, subnet: subnet.id, rotulo: subnet.rotulo || subnet.id,
        acesso: subnet.acesso, camada: item.camada, origem: item.origem });
      if (item.camada === 'indefinida') {
        const motivo = item.origem === 'conteudo-misto' ? 'conteúdo aponta para mais de uma camada' : 'sem conteúdo classificável';
        avisos.push(`subnet "${subnet.id}" ficou na camada indefinida (${motivo}); use "camada" como escape semântico`);
      }
    });
    cursorY += alturaVpc + 36;
  }

  const pageW = 2 * LAYOUT.margemHorizontal + LAYOUT.larguraVpc;
  const pageH = cursorY + 42;
  const titleStyle = 'text;html=1;fontSize=20;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;';
  const subStyle = 'text;html=1;fontSize=11;fontColor=#5A6C86;align=left;verticalAlign=middle;';
  const title = objeto({ id: 'titulo', rotulo: modelo.titulo || 'Camadas de rede', style: titleStyle,
    parent: '1', x: LAYOUT.margemHorizontal, y: 34, w: LAYOUT.larguraVpc, h: 28 });
  const subtitle = objeto({ id: 'subtitulo', rotulo: 'borda → aplicação → dados → indefinida', style: subStyle,
    parent: '1', x: LAYOUT.margemHorizontal, y: 66, w: LAYOUT.larguraVpc, h: 22 });
  const xml = `<mxfile host="panlabs-proto" type="device">\n` +
`  <diagram name="q22" id="q22">\n` +
`    <mxGraphModel grid="0" page="1" pageScale="1" pageWidth="${pageW}" pageHeight="${pageH}" background="#FFFFFF">\n` +
`      <root>\n` +
`        <mxCell id="0"/><mxCell id="1" parent="0"/>\n` +
`${title}\n${subtitle}\n${cells.join('\n')}\n` +
`      </root>\n` +
`    </mxGraphModel>\n` +
`  </diagram>\n` +
`</mxfile>\n`;

  return { xml, relatorio: { ordem, avisos } };
}

function main() {
  const entrada = process.argv[2];
  const iSaida = process.argv.indexOf('--saida');
  if (!entrada) {
    console.error('uso: node gerar.cjs <modelo.json> [--saida arquivo.drawio]');
    process.exit(2);
  }
  const modelo = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  const resultado = gerar(modelo);
  const saida = iSaida >= 0 ? process.argv[iSaida + 1] : entrada.replace(/\.json$/, '.drawio');
  fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
  fs.writeFileSync(saida, resultado.xml);
  for (const item of resultado.relatorio.ordem)
    console.log(`${item.subnet}: ${item.camada} (${item.origem})`);
  for (const aviso of resultado.relatorio.avisos) console.log(`⚠ ${aviso}`);
  console.log(`→ ${saida}`);
}

if (require.main === module) main();

module.exports = { gerar };
