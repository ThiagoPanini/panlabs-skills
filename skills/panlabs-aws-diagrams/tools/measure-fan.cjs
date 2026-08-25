#!/usr/bin/env node
'use strict';
/**
 * A DENSIDADE DO LEQUE — a medição que o #26 precisava para calibrar o gatilho
 * da vista de zona de referência (#21).
 *
 *   node tools/measure-fan.cjs             # a varredura sintética, 3..6 zonas
 *   node tools/measure-fan.cjs <m.json>... # os modelos que você passar
 *
 * O #21 deixou pendente *qual checagem e qual limiar* disparam o fallback que
 * apaga a aresta cross-zone, dizendo que depende da "densidade real do leque".
 * Este arquivo é a régua dessa densidade, e ele mede DUAS coisas que não são a
 * mesma:
 *
 *   piso da varredura   o `custo` que `ordemDeRaias` minimiza: para cada aresta
 *                       entre zonas a distância `d` na fila de raias, `d − 1`.
 *                       É uma PREVISÃO, e a previsão nasceu num mundo em que a
 *                       aresta ia reto de coluna a coluna.
 *
 *   F2 medido           o predicado de `A5.5` — polilinha cruzando uma caixa com
 *                       a qual a aresta não tem relação — aplicado à classe
 *                       `faixa`, que é justamente a que `A5.5` não vê (as faixas
 *                       ficaram fora das 62 por decisão do #18). Vem LIDO do
 *                       laudo (`validator/families/extras.cjs`), nunca
 *                       recalculado aqui — ver `medirF2`.
 *
 * A distância entre as duas colunas é o achado: depois do roteamento do #24 a
 * aresta longa não vai reto — ela desce até a borda externa das faixas e corre
 * por fora. O piso continua contando cruzamentos que o desenho não faz mais.
 */

const fs = require('fs');
const path = require('path');
const { gerar } = require(path.join(__dirname, '..', 'engine', 'generate.cjs'));
const { derivar } = require(path.join(__dirname, '..', 'engine', 'derive.cjs'));

const LETRAS = 'abcdefghij';

/** Malha completa de brokers, uma zona por subnet — o leque mais denso possível. */
function malha(nZonas) {
  const nodes = [
    { id: 'cloud', kind: 'cloud', label: 'AWS Cloud' },
    { id: 'vpc', kind: 'vpc', label: 'VPC · 10.0.0.0/16', cidr: '10.0.0.0/16', inside: 'cloud' },
  ];
  for (let i = 0; i < nZonas; i++) {
    nodes.push({ id: `app-${LETRAS[i]}`, kind: 'subnet', label: 'App subnet', access: 'private',
      az: `us-east-1${LETRAS[i]}`, inside: 'vpc' });
    nodes.push({ id: `broker-${LETRAS[i]}`, kind: 'service', service: 'msk',
      label: `Broker ${i + 1}`, inside: `app-${LETRAS[i]}` });
  }
  const edges = [];
  for (let i = 0; i < nZonas; i++)
    for (let j = 0; j < nZonas; j++)
      if (i !== j) edges.push({ from: `broker-${LETRAS[i]}`, to: `broker-${LETRAS[j]}`,
        label: 'busca réplica', protocol: 'kafka', data: 'back' });
  return {
    schema: 'panlabs-aws-diagrams/model@1',
    id: `malha-${nZonas}-az`, title: `Malha de ${nZonas} zonas`,
    view: 'technical', genre: 'T1', nodes, edges,
  };
}

/** O piso da varredura de raias, recalculado aqui para não depender de log. */
function pisoDaVarredura(modelo) {
  const d = derivar(modelo);
  const subnets = modelo.nodes.filter(n => n.kind === 'subnet');
  const zonas = [...new Set(subnets.map(s => s.az).filter(Boolean))].sort();
  const zonaDo = id => {
    const n = d.t.porId.get(id);
    if (!n) return null;
    const s = n.kind === 'subnet' ? n : d.t.ancestrais(n).find(a => a.kind === 'subnet');
    return s ? s.az : null;
  };
  const cruzam = (modelo.edges || []).map(a => [zonaDo(a.from), zonaDo(a.to)])
    .filter(([x, y]) => x && y && x !== y);
  if (zonas.length < 3 || !cruzam.length) return { zonas: zonas.length, cruzam: cruzam.length, piso: 0, perms: 0 };
  const permutar = xs => xs.length <= 1 ? [xs]
    : xs.flatMap((x, i) => permutar([...xs.slice(0, i), ...xs.slice(i + 1)]).map(r => [x, ...r]));
  const todas = permutar(zonas);
  const piso = Math.min(...todas.map(p => {
    const idx = new Map(p.map((z, i) => [z, i]));
    return cruzam.reduce((s, [x, y]) => s + Math.max(0, Math.abs(idx.get(x) - idx.get(y)) - 1), 0);
  }));
  return { zonas: zonas.length, cruzam: cruzam.length, piso, perms: todas.length };
}

/**
 * O `F2` **do validador**, lido do laudo — não uma segunda implementação dele.
 *
 * ⚠️ A primeira versão desta função reimplementava o predicado aqui, e a revisão
 * pegou: ela testava só a pertinência DIRETA (`membros.has(a.from)`), enquanto o
 * `F2` que embarca aceita também descendente de membro (`cena.ehDescendente`).
 * São predicados diferentes — e a evidência *"F2 = 0 nas quatro densidades"*
 * teria sido produzida por um `F2` que não é o que roda.
 *
 * Medir com uma cópia da regra é a armadilha que o #23 chamou de **suíte verde
 * por metade**: as duas estavam verdes, cada uma contra a sua própria versão.
 * Aqui a régua e o produto passam a ser o mesmo código, por construção.
 */
function medirF2(r) {
  let bands = 0;
  const casos = [];
  for (const { laudo } of r.relatorio.geometry) {
    if (laudo.cena) bands += laudo.cena.bands.length;
    const f2 = (laudo.extras || []).find(x => x.id === 'F2');
    if (!f2) continue;
    for (const o of f2.occurrences) casos.push(o.ids ? o.ids.join(' × ') : o.o_que);
  }
  return { bands, casos };
}

function account(r, id) {
  let n = 0;
  for (const { laudo } of r.relatorio.geometry) {
    const x = laudo.resultados.find(y => y.id === id);
    if (x) n += x.occurrences.length;
  }
  return n;
}

async function medir(modelo, label) {
  const p = pisoDaVarredura(modelo);
  let r;
  try { r = await gerar(modelo, {}); }
  catch (e) { return { label, erro: e.message, ...p }; }
  const f2 = medirF2(r);
  return {
    label, ...p, bands: f2.bands, f2: f2.casos.length, examples: f2.casos.slice(0, 2),
    a55: account(r, 'A5.5'), a51: account(r, 'A5.1'), a32: account(r, 'A3.2'),
    semanticas: r.relatorio.geometry.reduce((s, x) => s + x.laudo.semanticas.length, 0),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const linhas = [];
  if (args.length) {
    for (const a of args)
      linhas.push(await medir(JSON.parse(fs.readFileSync(a, 'utf8')), path.basename(a, '.json')));
  } else {
    for (let n = 3; n <= 6; n++) linhas.push(await medir(malha(n), `malha-${n}-az`));
  }

  const cab = ['caso', 'zonas', 'cruzam', 'perms', 'piso', 'bands', 'F2', 'A5.5', 'A5.1', 'A3.2', 'sem'];
  const corpo = linhas.map(l => l.erro
    ? [l.label, String(l.zonas), String(l.cruzam), String(l.perms), String(l.piso), '—', '—', '—', '—', '—', 'ERRO']
    : [l.label, String(l.zonas), String(l.cruzam), String(l.perms), String(l.piso),
       String(l.bands), String(l.f2), String(l.a55), String(l.a51), String(l.a32), String(l.semanticas)]);
  const larg = cab.map((_, i) => Math.max(cab[i].length, ...corpo.map(c => c[i].length)));
  console.log('  ' + cab.map((c, i) => c.padEnd(larg[i])).join('  '));
  for (const c of corpo) console.log('  ' + c.map((v, i) => v.padEnd(larg[i])).join('  '));
  for (const l of linhas) if (l.erro) console.log(`\n  ${l.label}: ${l.erro}`);
  for (const l of linhas) if (l.examples && l.examples.length)
    console.log(`\n  ${l.label} — F2: ${l.examples.join(' | ')}`);

  console.log('\n  piso  = previsão da varredura de raias (|i−j|−1 por aresta, minimizado)');
  console.log('  F2    = medido no desenho: aresta cruzando a caixa de uma faixa alheia');
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { malha, pisoDaVarredura, medirF2 };
