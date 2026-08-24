#!/usr/bin/env node
'use strict';
/**
 * Monta `exemplos/referencia.drawio` — o diagrama que uma empresa (fictícia,
 * "Acme Corp") teria à mão hoje: rede de trânsito + uma conta de aplicação
 * front-end, tudo em subnet privada. É o material do #16 §"o que se extrai de
 * um .drawio de exemplo".
 *
 * Hand-placed, não passa pelo `elkjs` — o diagrama é pequeno e fixo, e o
 * ponto aqui é a CONVENÇÃO gravada no style, não o layout. Reaproveita o
 * catálogo (#17) para toda cor/ícone e o emissor do #11 para não reinventar
 * escape de XML (armadilha que o #19 já pagou).
 *
 * Duas convenções deliberadamente DIVERGEM do catálogo puro, para o
 * extrator ter algo genuíno para achar:
 *   - `strokeWidth=3` nos grupos de Conta — ênfase de fronteira que o
 *     catálogo não tem.
 *   - `fontColor` do grupo VPC trocado de #AAB7B8 (cinza que soma no fundo
 *     branco) para #232F3E — exatamente a divergência que o #17 listou como
 *     aberta, "camada de estilo, outro ticket".
 */

const fs = require('fs');
const path = require('path');

const { carregar } = require(path.join(__dirname, '..', '..', '..', 'catalog', 'aws-shapes.cjs'));
const { emitir, conferirXml } = require(path.join(__dirname, '..', '..', 'q11', 'motor', 'emitir.cjs'));

const cat = carregar(path.join(__dirname, '..', '..', '..', 'catalog'));

const TITULO_H = 44;   // faixa de título do grupo (34, #11 resolver.cjs) + folga
const PAD = 14;
const ICONE = 78;
const ROTULO = 30;     // faixa reservada para o rótulo do ícone, abaixo dele

// --------------------------------------------------------- ajuste de style

function comOverrides(style, overrides) {
  const partes = style.split(';').filter(Boolean);
  const mapa = new Map(partes.map(p => {
    const i = p.indexOf('=');
    return i === -1 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)];
  }));
  for (const [k, v] of Object.entries(overrides)) mapa.set(k, v);
  return [...mapa.entries()].map(([k, v]) => v === '' ? k : `${k}=${v}`).join(';') + ';';
}

// -------------------------------------------------------------- as células

const celulas = [];
let seq = 0;
const id = prefixo => `${prefixo}-${++seq}`;

function grupo(pai, x, y, w, h, nome, rotulo, overrides) {
  const g = cat.grupo(nome);
  if (!g) throw new Error(`grupo "${nome}" ausente do catálogo`);
  const cid = id('grp');
  celulas.push({
    id: cid, pai, rotulo,
    style: overrides ? comOverrides(g.style, overrides) : g.style,
    geo: { x, y, w, h },
  });
  return cid;
}

function servico(pai, x, y, chave, rotulo) {
  const s = cat.servico(chave);
  if (!s) throw new Error(`serviço "${chave}" ausente do catálogo`);
  const cid = id('svc');
  celulas.push({ id: cid, pai, rotulo: rotulo || s.title, style: s.style, geo: { x, y, w: ICONE, h: ICONE + ROTULO } });
  return cid;
}

// Conta de trânsito — 320×160, à esquerda.
const contaTransito = grupo('1', 40, 40, 320, 160, 'AWS Account', 'rede-compartilhada',
  { strokeWidth: '3' });
const vpcTransito = grupo(contaTransito, PAD, TITULO_H, 320 - 2 * PAD, 160 - TITULO_H - PAD,
  'VPC', 'acme-vpc-transito', { fontColor: '#232F3E' });
servico(vpcTransito, PAD, TITULO_H, 'transit gateway', 'acme-tgw-hub');

// Conta de aplicação — 400×260, à direita, com folga maior entre contas do
// que entre VPC e subnet lá dentro (o mesmo contraste de espaçamento 1:4
// que o #6 mediu no diagrama multi-conta oficial — aqui só qualitativo).
const GAP_CONTAS = 120;
const xContaApp = 40 + 320 + GAP_CONTAS;
const contaApp = grupo('1', xContaApp, 40, 400, 260, 'AWS Account', 'workload-frontend',
  { strokeWidth: '3' });
const vpcApp = grupo(contaApp, PAD, TITULO_H, 400 - 2 * PAD, 260 - TITULO_H - PAD,
  'VPC', 'acme-vpc-workload', { fontColor: '#232F3E' });
const subnetApp = grupo(vpcApp, PAD, TITULO_H, 400 - 2 * PAD - 2 * PAD, 260 - TITULO_H - PAD - TITULO_H - PAD,
  'Private subnet', 'acme-app-1a');
servico(subnetApp, PAD, TITULO_H, 'ec2', 'front-end');
servico(subnetApp, PAD + ICONE + 40, TITULO_H, 'key management service', 'acme-kms-app');

// A única aresta: o attachment ao Transit Gateway. Cross-account, tracejada —
// é a única travessia de fronteira que este diagrama desenha.
celulas.push({
  tipo: 'aresta',
  id: id('edge'),
  pai: '1',
  rotulo: 'attach',
  style: 'endArrow=block;html=1;rounded=0;dashed=1;strokeColor=#545B64;fontColor=#545B64;',
  de: vpcApp,
  para: vpcTransito,
});

const larg = xContaApp + 400 + 40;
const alt = 40 + 260 + 40;

const plano = { id: 'referencia-acme', titulo: 'Acme — rede de referência (exemplo do context pack)', larg, alt, celulas };

const xml = emitir(plano);
const erros = conferirXml(xml);
if (erros.length) { console.error('XML malformado:', erros); process.exit(1); }

const saida = path.join(__dirname, 'exemplos', 'referencia.drawio');
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, xml);
console.log('escrito:', saida);
