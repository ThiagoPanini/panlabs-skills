// #21 · A afirmação forte da resolução é que a RUBRICA NÃO DESEMPATA: trocar o
// eixo é uma transposição da grade, e as checagens do #8 que esta pergunta
// aciona são todas de incidência (quem toca quem), não de distância. Incidência
// é invariante por transposição.
//
// Um caso só não prova isso. Aqui vão seis modelos diferentes pelos dois eixos.
// Se algum par divergir, a afirmação cai.
'use strict';
const { layout, iconRect, route, routeAcross, routeAround, medir, K } = require('./motor.js');

function avaliar(model, axis) {
  const L = layout(model, axis);
  const az = {};
  for (const b of model.bands.filter(x => x.kind === 'az'))
    az[model.nodes.find(n => b.members.includes(n.id)).zone] = L.bandRect(b);
  const idx = id => model.stages.findIndex(s => s.id === model.nodes.find(n => n.id === id).stage);
  const margens = { antes: -32, depois: (L.H ? L.contentH : L.contentW) + 32 };
  const routed = model.edges.map(e => {
    const a = iconRect(L.R[e.from]), b = iconRect(L.R[e.to]);
    const pula = Math.abs(idx(e.to) - idx(e.from)) > 1;
    return { ...e, poly: e.across ? routeAcross(L, a, b)
                       : pula     ? routeAround(L, a, b, margens)
                       :            route(L, a, b, e.slot || 0) };
  });
  const m = medir(model, L, az, routed);
  return { a42: m.a42.slice().sort(), a55: m.a55.slice().sort(), a51: m.a51, a57: m.a57,
           aspect: +((L.contentW + 2 * K.PAD) / (L.contentH + K.HEAD + 2 * K.PAD)).toFixed(2) };
}

/** Modelo sintético: nz zonas × ns etapas, com buracos e arestas declarados. */
function gerar(nz, ns, buracos, arestas) {
  const zones = Array.from({ length: nz }, (_, i) => 'z' + i);
  const stages = Array.from({ length: ns }, (_, i) => ({ id: 's' + i }));
  const nodes = [];
  for (const s of stages) for (const z of zones) {
    if (buracos.includes(s.id + z)) continue;
    nodes.push({ id: s.id + z, stage: s.id, zone: z });
  }
  const bands = zones.map(z => ({ id: 'az-' + z, kind: 'az',
    members: nodes.filter(n => n.zone === z).map(n => n.id) })).filter(b => b.members.length);
  return { zones, stages, nodes, bands, edges: arestas, vpcStages: [], vpcLabel: '' };
}

const casos = [
  ['3×4 leque + convergência', gerar(3, 4, [], [
    { from: 's0z0', to: 's1z0' }, { from: 's0z0', to: 's1z1' }, { from: 's0z0', to: 's1z2' },
    { from: 's1z0', to: 's2z0' }, { from: 's1z1', to: 's2z0' }, { from: 's1z2', to: 's2z0' },
    { from: 's2z0', to: 's3z0' }])],
  ['3×4 com buraco', gerar(3, 4, ['s3z2', 's3z1'], [
    { from: 's0z1', to: 's1z1' }, { from: 's1z1', to: 's2z1' }, { from: 's2z1', to: 's3z0' },
    { from: 's0z2', to: 's1z2' }, { from: 's1z2', to: 's2z2' }])],
  ['2×6 cadeia', gerar(2, 6, [], [
    { from: 's0z0', to: 's1z0' }, { from: 's1z0', to: 's2z0' }, { from: 's2z0', to: 's3z0' },
    { from: 's3z0', to: 's4z0' }, { from: 's4z0', to: 's5z1' }, { from: 's0z1', to: 's1z1' }])],
  ['4×5 malha', gerar(4, 5, [], [
    { from: 's0z0', to: 's1z3' }, { from: 's1z3', to: 's2z1' }, { from: 's2z1', to: 's3z2' },
    { from: 's3z2', to: 's4z0' }, { from: 's0z2', to: 's1z0' }])],
  ['3×5 com pulo de etapa', gerar(3, 5, [], [
    { from: 's0z0', to: 's2z0' }, { from: 's1z1', to: 's3z1' }, { from: 's2z2', to: 's4z2' },
    { from: 's0z2', to: 's1z2' }])],
  ['3×4 com aresta transversal', gerar(3, 4, [], [
    { from: 's0z0', to: 's1z0' }, { from: 's1z0', to: 's1z1', across: true },
    { from: 's1z1', to: 's2z1' }, { from: 's2z1', to: 's2z2', across: true },
    { from: 's2z2', to: 's3z2' }])],
];

let divergem = 0;
console.log('caso                          | A4.2 H/V | A5.5 H/V | A5.1 H/V | A5.7 H/V | proporção H/V');
for (const [nome, m] of casos) {
  const h = avaliar(m, 'H'), v = avaliar(m, 'V');
  const igual = JSON.stringify([h.a42, h.a55, h.a51, h.a57]) === JSON.stringify([v.a42, v.a55, v.a51, v.a57]);
  if (!igual) divergem++;
  console.log(`${nome.padEnd(29)} | ${String(h.a42.length).padStart(4)}/${v.a42.length} | ` +
    `${String(h.a55.length).padStart(4)}/${v.a55.length} | ${String(h.a51).padStart(4)}/${v.a51} | ` +
    `${h.a57.toFixed(2)}/${v.a57.toFixed(2)} | ${String(h.aspect).padStart(5)}/${v.aspect}` +
    (igual ? '' : '   ← DIVERGE'));
}
console.log(divergem
  ? `\n${divergem} caso(s) divergem — a rubrica DESEMPATA. A afirmação da resolução cai.`
  : '\nNenhum caso diverge: as checagens de incidência são idênticas nos dois eixos.\nO único número que muda é a proporção — e é ele que decide.');
