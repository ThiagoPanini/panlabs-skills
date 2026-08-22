// #21 · Se a ordem das raias troca um cruzamento por outro, existe alguma ordem
// que zera? E o eixo muda a resposta? Força bruta nas 6 permutações, nos 2 eixos.
'use strict';
const { layout, iconRect, route, routeAcross, routeAround, medir } = require('./motor.js');
const { baseModel } = require('./modelo.js');

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
  return medir(model, L, az, routed);
}

const perm = a => a.length <= 1 ? [a]
  : a.flatMap((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));

console.log('ordem das raias                          | A5.5 H | A5.5 V');
const linhas = [];
for (const p of perm(['us-east-1a', 'us-east-1b', 'us-east-1c'])) {
  const m = baseModel(); m.zones = p;
  const h = avaliar(m, 'H'), v = avaliar(m, 'V');
  linhas.push([p, h.a55.length, v.a55.length]);
  console.log(`${p.map(z => z.slice(-2)).join(' · ').padEnd(40)} |   ${h.a55.length}    |   ${v.a55.length}`);
}
const minH = Math.min(...linhas.map(l => l[1])), minV = Math.min(...linhas.map(l => l[2]));
console.log(`\nmínimo alcançável: H=${minH}, V=${minV}` +
  (minH === minV ? '  → o eixo não muda o piso; a ordem da raia, sim.'
                 : '  → o eixo MUDA o piso.'));
