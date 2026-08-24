#!/usr/bin/env node
'use strict';
/**
 * O PORTÃO SABE FALHAR? — experimento de controle sobre o próprio portão.
 *
 * Todas as outras checagens deste protótipo ganharam controle; o portão de
 * contraste não tinha nenhum, e ele é o que mais tem a perder: um portão que
 * aprova por engano é pior que portão nenhum, porque produz um verde.
 *
 * A urgência não é hipotética. O #18 registrou no mapa que a primeira versão do
 * validador geométrico errava o CORTE DE Z do rótulo de grupo — media o rótulo
 * contra a página em vez de contra o preenchimento do próprio grupo, e entregava
 * "13,57:1" para um texto escuro sobre grupo escuro que na tela dava 1,00:1.
 * Falso negativo, na única família normativa, achado só na revisão.
 *
 * Este portão tinha o mesmo defeito. Ele ficou DORMENTE enquanto os 20 grupos do
 * catálogo eram `fillColor=none` — e acordou no instante em que o tingimento de
 * subnet voltou, no retorno do #13. Cada caso abaixo é um plano sabidamente ruim
 * que o portão TEM de reprovar, pela regra nomeada.
 *
 *   node tools/check-portao.cjs
 */

const { medir } = require('../motor/contraste.cjs');

// O rótulo é obrigatório nos casos de A7.1: sem texto não há par de texto para
// medir, e o caso passaria por não exercitar nada — que é como a primeira versão
// destes fixtures "passou" sem tocar no defeito que ela existia para pegar.
const cel = (id, rotulo, style, pai = '1') =>
  ({ id, tipo: 'vertice', pai, rotulo, style, geo: { x: 0, y: 0, w: 10, h: 10 } });

const GRUPO = 'shape=mxgraph.aws4.group;grIcon=x;container=1;';
const ICONE = 'shape=mxgraph.aws4.resourceIcon;resIcon=y;';
// ícone monocromático: aws4, mas nem grupo nem service icon — o terceiro caminho,
// e o que a primeira versão deste controle não cobria
const MONO = 'shape=mxgraph.aws4.users;';

const CASOS = [
  {
    nome: 'rótulo de grupo escuro sobre tingimento escuro',
    porque: 'o corte de z do RÓTULO é o preenchimento do próprio grupo, não o do ancestral (#18)',
    regra: 'A7.1',
    plano: { fundo: '#FFFFFF', celulas: [
      cel('sub', 'Private subnet', GRUPO + 'strokeColor=#00A4A6;fillColor=#2A3A3A;fontColor=#232F3E;fontSize=12;') ] },
  },
  {
    nome: 'rótulo de folha sobre o tingimento do pai',
    porque: 'o corte de z da FOLHA é o pai — o rótulo do ícone é desenhado fora da caixa dele',
    regra: 'A7.1',
    plano: { fundo: '#FFFFFF', celulas: [
      cel('sub', 'Private subnet', GRUPO + 'strokeColor=#00A4A6;fillColor=#1A1A1A;fontColor=#FFFFFF;fontSize=12;'),
      cel('lambda', 'Processar pedido', ICONE + 'fillColor=#ED7100;strokeColor=#FFFFFF;fontColor=#232F3E;fontSize=12;', 'sub') ] },
  },
  {
    nome: 'borda de grupo sobre fundo de página vizinho',
    porque: 'o corte de z da BORDA é o que está FORA — ela é a fronteira, e tem de ser achável',
    regra: 'A7.2',
    plano: { fundo: '#F2F3F5', celulas: [
      cel('reg', 'us-east-1', GRUPO + 'strokeColor=#00A4A6;fillColor=none;fontColor=#232F3E;fontSize=12;') ] },
  },
  {
    nome: 'rótulo de ícone monocromático sobre o pai',
    porque: 'nele `fillColor` é o GLIFO, e o rótulo cai abaixo da caixa — mede contra o PAI',
    regra: 'A7.1',
    plano: { fundo: '#FFFFFF', celulas: [
      cel('sub', 'Private subnet', GRUPO + 'strokeColor=#00A4A6;fillColor=#3A3A3A;fontColor=#FFFFFF;fontSize=12;'),
      cel('users', 'Clientes', MONO + 'fillColor=#232F3E;fontColor=#232F3E;fontSize=12;', 'sub') ] },
  },
  {
    nome: 'traço de aresta pálido',
    porque: 'traço fino reprova a 3:1 — é o par que a WCAG 1.4.11 nomeia',
    regra: 'A7.2',
    plano: { fundo: '#FFFFFF', celulas: [
      { id: 'e1', tipo: 'aresta', pai: '1', de: 'a', para: 'b', rotulo: '',
        style: 'edgeStyle=orthogonalEdgeStyle;strokeColor=#DDDDDD;' } ] },
  },
  {
    nome: 'glifo branco sobre quadrado claro demais',
    porque: 'o glifo é medido contra o PRÓPRIO quadrado, e não muda com o fundo da página',
    regra: 'A7.2',
    plano: { fundo: '#FFFFFF', celulas: [
      cel('svc', 'Serviço', ICONE + 'fillColor=#EEEEEE;strokeColor=#FFFFFF;fontColor=#232F3E;fontSize=12;') ] },
  },
];

/** E um caso que o portão NÃO pode reprovar — senão ele só sabe dizer não. */
const LIMPO = {
  nome: 'o desenho certo passa',
  plano: { fundo: '#FFFFFF', celulas: [
    cel('sub', 'Private subnet', GRUPO + 'strokeColor=#00A4A6;fillColor=#E6F6F6;fontColor=#232F3E;fontSize=12;'),
    cel('lambda', 'Processar pedido', ICONE + 'fillColor=#ED7100;strokeColor=#FFFFFF;fontColor=#232F3E;fontSize=12;', 'sub'),
    cel('users', 'Clientes', MONO + 'fillColor=#232F3E;fontColor=#232F3E;fontSize=12;') ] },
};

function main() {
  let falhou = 0;

  for (const caso of CASOS) {
    const r = medir(caso.plano);
    const pegou = r.falhas.some(f => f.regra === caso.regra);
    if (!pegou) falhou = 1;
    console.log(`  ${pegou ? '✓' : '✗'} ${caso.nome.padEnd(48)} ${caso.regra}  ${caso.porque}`);
    if (!pegou) console.log(`      NÃO FOI PEGO — o portão aprovou um plano sabidamente ruim`);
  }

  const limpo = medir(LIMPO.plano);
  const ok = limpo.ok;
  if (!ok) falhou = 1;
  console.log(`  ${ok ? '✓' : '✗'} ${LIMPO.nome.padEnd(48)} —     um portão que só sabe dizer não não é portão`);
  if (!ok) for (const l of require('../motor/contraste.cjs').resumir(limpo)) console.log('      ' + l);

  console.log(falhou ? '\n  PORTÃO NÃO SABE FALHAR' : `\n  ✓ o portão pega os ${CASOS.length} planos ruins e aprova o bom`);
  process.exit(falhou);
}

if (require.main === module) main();
