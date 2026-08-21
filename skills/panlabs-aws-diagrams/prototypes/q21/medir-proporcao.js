// #21 · A regra precisa de um critério que não seja gosto. Este script mede,
// com o MESMO motor de layout, qual orientação chega mais perto do 16:9 que o
// O24 mediu em 12 de 12 PDFs de Reference Architecture.
//
// Faixa de zonas: 2 a 4 (o que a AWS desenha).
// Faixa de etapas: 4 a 11 (O22 mediu 5 a 11 passos numerados, mediana 9).
'use strict';
const { layout, K } = require('./motor.js');

const ALVO = 16 / 9;
const dist = a => Math.abs(Math.log(a / ALVO));   // erro em oitavas, simétrico

function medida(nz, ns, axis) {
  const zones = Array.from({ length: nz }, (_, i) => 'z' + i);
  const stages = Array.from({ length: ns }, (_, i) => ({ id: 's' + i }));
  const nodes = [];
  for (const s of stages) for (const z of zones) nodes.push({ id: s.id + z, stage: s.id, zone: z });
  const bands = zones.map(z => ({ id: 'az-' + z, kind: 'az', members: nodes.filter(n => n.zone === z).map(n => n.id) }));
  const L = layout({ zones, stages, nodes, bands }, axis);
  return (L.contentW + 2 * K.PAD) / (L.contentH + K.HEAD + 2 * K.PAD);
}

console.log('nz  ns |  H(fluxo→) erro |  V(fluxo↓) erro | vence');
let venceH = 0, total = 0;
for (const nz of [2, 3, 4]) {
  for (const ns of [4, 5, 6, 7, 8, 9, 10, 11]) {
    const h = medida(nz, ns, 'H'), v = medida(nz, ns, 'V');
    const g = dist(h) < dist(v) ? 'H' : 'V';
    if (g === 'H') venceH++;
    total++;
    console.log(` ${nz}  ${String(ns).padStart(2)} | ${h.toFixed(2).padStart(6)} ${dist(h).toFixed(2)} | ${v.toFixed(2).padStart(6)} ${dist(v).toFixed(2)} |   ${g}`);
  }
}
console.log(`\nH vence em ${venceH}/${total} das combinações realistas.`);

// E o caso que o deck de fato desenha: 2 AZ, SEM fluxo numerado (lâmina 9).
// Aí as "etapas" são só as camadas de sub-rede — 2 ou 3.
console.log('\nSem fluxo numerado (o caso da lâmina 9): as etapas são só camadas de sub-rede.');
for (const [nz, ns] of [[2, 2], [2, 3], [3, 2], [3, 3]]) {
  const h = medida(nz, ns, 'H'), v = medida(nz, ns, 'V');
  console.log(` ${nz} AZ × ${ns} camadas | H ${h.toFixed(2)} (${dist(h).toFixed(2)}) | V ${v.toFixed(2)} (${dist(v).toFixed(2)}) | vence ${dist(h) < dist(v) ? 'H' : 'V'}`);
}
