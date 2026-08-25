#!/usr/bin/env node
'use strict';
/**
 * Os gatilhos de multi-conta, isolados dos pixels.
 *
 * Mesmo formato do `gatilho-az.js` do #19: cada caso é uma arquitetura mínima
 * cuja resposta certa é sabida de antemão pela pesquisa de multi-conta que
 * originou o #12, e a regra tem de acertar todos. Rodar isto é mais barato que
 * renderizar, e é onde a DECISÃO do ticket vive — o desenho é consequência.
 *
 *   node tools/check-triggers.cjs
 */

const { arvore, gatilhoOu, modoDeContas, travessias, politicaDeTravessia } =
  require('../engine/derive.cjs');

let falhas = 0;
function caso(name, modelo, esperado, obter) {
  const t = arvore(modelo);
  const obtido = obter(modelo, t);
  const ok = Object.entries(esperado).every(([k, v]) => JSON.stringify(obtido[k]) === JSON.stringify(v));
  if (!ok) {
    falhas++;
    console.log(`  ✗ ${name}`);
    for (const [k, v] of Object.entries(esperado))
      if (JSON.stringify(obtido[k]) !== JSON.stringify(v))
        console.log(`      ${k}: esperado ${JSON.stringify(v)}, veio ${JSON.stringify(obtido[k])}`);
    console.log(`      porque: ${obtido.because || '—'}`);
  } else {
    console.log(`  ✓ ${name}  (${obtido.because || 'sem justificativa'})`);
  }
}

const account = (id, ou) => ({ id, kind: 'account', account: '000000000000', inside: 'cloud', ...(ou ? { ou } : {}) });
const inside = (id, pai) => ({ id, kind: 'service', service: 's3', inside: pai });
const cloud = { id: 'cloud', kind: 'cloud' };
const mod = (nodes, edges) => ({ nodes: [cloud, ...nodes], edges: edges || [] });

// ------------------------------------------------------------- gatilho de OU

console.log('\n1. gatilho de OU — a OU só vira faixa quando ela AGRUPA algo');

caso('nenhuma OU declarada', mod([account('a'), account('b')]),
  { desenhar: false }, gatilhoOu);

caso('uma OU só, com duas contas — não separa nada',
  mod([account('a', 'Workloads'), account('b', 'Workloads')]),
  { desenhar: false }, gatilhoOu);

caso('duas OUs, uma conta cada — o rótulo da conta já diz isso',
  mod([account('a', 'Security'), account('b', 'Workloads')]),
  { desenhar: false }, gatilhoOu);

caso('duas OUs, uma delas com duas contas — AGORA agrupa',
  mod([account('a', 'Security'), account('b', 'Security'), account('c', 'Workloads')]),
  { desenhar: true, ous: ['Security', 'Workloads'] }, gatilhoOu);

caso('a conta fora de OU não inventa uma OU (Management é raiz — P2)',
  mod([account('mgmt'), account('a', 'Security'), account('b', 'Security')]),
  { desenhar: true, ous: ['Security'] }, gatilhoOu);

// -------------------------------------------------------------- modo de vista

console.log('\n2. modo — inventário (mapa de colocação) vs. integração (a travessia é o assunto)');

const travessia = (from, to, label) => ({ from, to, ...(label ? { label } : {}) });

caso('conta única não é diagrama multi-conta',
  mod([account('a'), inside('x', 'a')]),
  { modo: 'none' }, modoDeContas);

caso('duas contas sem travessia — é inventário (E1: sem aresta)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b')]),
  { modo: 'inventario' }, modoDeContas);

caso('três contas com duas travessias — integração (X1)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('c'), inside('z', 'c')],
    [travessia('x', 'y'), travessia('x', 'z')]),
  { modo: 'integracao' }, modoDeContas);

caso('cinco contas — acima do que a vista de integração comporta (X1: 2 a 4)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('c'), inside('z', 'c'),
    account('d'), inside('w', 'd'), account('e'), inside('v', 'e')],
    [travessia('x', 'y')]),
  { modo: 'inventario' }, modoDeContas);

caso('aresta que entra da rua não é travessia de conta',
  mod([{ id: 'actor', kind: 'actor', service: 'users' }, account('a'), inside('x', 'a'), account('b'), inside('y', 'b')],
    [travessia('actor', 'x')]),
  { modo: 'inventario' }, modoDeContas);

caso('duas contas, oito travessias — passa do que o corpus oficial mostra (2 a 7)',
  mod([account('a'), ...Array.from({ length: 8 }, (_, i) => inside('x' + i, 'a')),
    account('b'), ...Array.from({ length: 8 }, (_, i) => inside('y' + i, 'b'))],
    Array.from({ length: 8 }, (_, i) => travessia('x' + i, 'y' + i))),
  { modo: 'inventario' }, modoDeContas);

// ------------------------------------------------- hierarquia de 6 níveis (#6)

console.log('\n3. política de travessia — a hierarquia de fallback do #6 §6.4');

function politica(modelo, t) {
  const edges = (modelo.edges || []).map((a, i) => ({ ...a, id: a.id || `e${i}` }));
  const m = modoDeContas(modelo, t, edges);
  return politicaDeTravessia(m.modo, travessias(edges, t), t);
}

caso('inventário suprime tudo — a regra soberana (E1)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('c'), inside('z', 'c'),
    account('d'), inside('w', 'd'), account('e'), inside('v', 'e')],
    [travessia('x', 'y')]),
  { nivel: 1, mecanismo: 'suprimir' }, politica);

caso('fan-in de 2 contas no mesmo destino colapsa numa aresta rotulada (E3)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('log'), inside('bucket', 'log')],
    [travessia('x', 'bucket'), travessia('y', 'bucket')]),
  { nivel: 3, mecanismo: 'agregada' }, politica);

caso('mesma origem para 2 contas irmãs vira barramento (E4)',
  mod([account('hub'), inside('tgw', 'hub'), account('a'), inside('x', 'a'), account('b'), inside('y', 'b')],
    [travessia('tgw', 'x'), travessia('tgw', 'y')]),
  { nivel: 4, mecanismo: 'barramento' }, politica);

caso('duas contas e uma travessia — aresta direta, sem cerimônia (E10)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b')],
    [travessia('x', 'y')]),
  { nivel: 6, mecanismo: 'direta' }, politica);

caso('mesma origem, mas relações DIFERENTES — barramento mentiria (E4 exige o mesmo vínculo)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('c'), inside('z', 'c')],
    [travessia('x', 'y', 'atracamento VPC'), travessia('x', 'z', 'PutEvents')]),
  { nivel: 6, mecanismo: 'direta' }, politica);

caso('mesma origem e o MESMO vínculo rotulado — aí sim barramento',
  mod([account('hub'), inside('tgw', 'hub'), account('a'), inside('x', 'a'), account('b'), inside('y', 'b')],
    [travessia('tgw', 'x', 'atracamento VPC'), travessia('tgw', 'y', 'atracamento VPC')]),
  { nivel: 4, mecanismo: 'barramento' }, politica);

caso('fan-in com relações diferentes não agrega — o rótulo único mentiria (E3)',
  mod([account('a'), inside('x', 'a'), account('b'), inside('y', 'b'), account('log'), inside('bucket', 'log')],
    [travessia('x', 'bucket', 'logs de acesso'), travessia('y', 'bucket', 'backup noturno')]),
  { nivel: 6, mecanismo: 'direta' }, politica);

console.log();
if (falhas) { console.log(`${falhas} caso(s) errado(s)`); process.exit(1); }
console.log('gatilhos ok');
