#!/usr/bin/env node
'use strict';
/**
 * #33 — a caixa da folha passa a refletir a largura medida do rótulo.
 *
 * Antes, `caixaW` era sempre `formaW` (a caixa do layout era a caixa do
 * ícone), e um qualificador maior que `ROTULO_W` (120 px) vazava a célula sem
 * que nenhuma checagem medisse isso (#29 só avisava). A #35 reenquadrou #33
 * como a correção na CAUSA: a caixa alarga na horizontal até caber o rótulo
 * inteiro, com o ícone centrado dentro dela — o estilo do catálogo já traz
 * `aspect=fixed`, então o ícone não distorce quando a geometria alarga.
 *
 * Dois níveis de prova:
 *
 *   1. UNITÁRIO — `resolver.criar(tema).folha(no)` isolado, sem passar pelo
 *      layout. É onde a largura é medida.
 *   2. PONTA A PONTA — `engine/generate.cjs` end-to-end, XML real: prova que a
 *      largura medida chega até a geometria emitida, não só até o objeto
 *      interno do resolver.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const resolverMod = require(path.join(ROOT, 'engine', 'resolve.cjs'));
const temaMod = require(path.join(ROOT, 'theme', 'theme.cjs'));
const { generate } = require(path.join(ROOT, 'engine', 'generate.cjs'));

let falhas = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) falhas++;
};

const LONG_QUALIFIER = 'as 40 unidades entram por aqui, bem mais largo que a celula de 120px';

(async () => {
// ---------------------------------------------------------------------------
console.log('\n1 · unitário — resolver.folha() mede o rótulo, não grampeia em 120px\n');

{
  const res = resolverMod.create(temaMod.load('corporate'));
  const semQualificador = res.leaf({ id: 'n1', kind: 'service', service: 'aurora-postgresql' });
  ok(semQualificador.caixaW === semQualificador.formaW,
    'sem qualificador → caixaW continua igual à caixa do ícone',
    `caixaW=${semQualificador.caixaW} formaW=${semQualificador.formaW}`);

  const comQualificador = res.leaf({ id: 'n2', kind: 'service', service: 'aurora-postgresql', qualifier: LONG_QUALIFIER });
  const larguraReal = res.textWidth(LONG_QUALIFIER);
  ok(comQualificador.caixaW > comQualificador.formaW,
    'com qualificador longo → caixaW alarga além do ícone',
    `caixaW=${comQualificador.caixaW} formaW=${comQualificador.formaW}`);
  ok(comQualificador.caixaW === larguraReal,
    'e a largura não é grampeada em 120px — é a medida real do texto',
    `caixaW=${comQualificador.caixaW} larguraReal(sem tag)=${larguraReal}`);
  ok(comQualificador.rotuloW === larguraReal,
    'rotuloW (o que o ELK reserva para o rótulo) acompanha a mesma medida',
    `rotuloW=${comQualificador.rotuloW}`);
}

{
  // tema sem o token ligado: o qualificador nem aparece no rótulo, então a
  // caixa não tem por que alargar — o #39 (fora do escopo de #33) é quem liga
  // o token nos três temas.
  const res = resolverMod.create(temaMod.load('light'));
  const f = res.leaf({ id: 'n3', kind: 'service', service: 'aurora-postgresql', qualifier: LONG_QUALIFIER });
  ok(f.caixaW === f.formaW,
    'tema "claro" (qualificador desligado) → caixaW não alarga',
    `caixaW=${f.caixaW} formaW=${f.formaW}`);
}

// ---------------------------------------------------------------------------
console.log('\n2 · ponta a ponta — a largura medida chega ao XML emitido\n');

{
  const model = {
    schema: 'panlabs-aws-diagrams/model@1',
    id: 'caixa-de-folha-probe', title: 'probe', view: 'technical', genre: 'T1',
    nodes: [
      { id: 'cloud', kind: 'cloud', label: 'AWS Cloud' },
      { id: 'n1', kind: 'service', service: 'aurora-postgresql', inside: 'cloud', qualifier: LONG_QUALIFIER },
    ],
    edges: [],
  };
  const r = await generate(model, { tema: 'corporate' });
  const res = resolverMod.create(temaMod.load('corporate'));
  const expected = res.leaf(model.nodes[1]).caixaW;

  const m = r.xml.match(/<mxCell id="n1"[\s\S]*?<mxGeometry[^>]*width="(\d+)"/);
  const emittedWidth = m && Number(m[1]);
  ok(emittedWidth === expected,
    'a geometria do vértice emitido tem a largura medida, não 78px fixos',
    `emitido=${emittedWidth} esperado=${expected}`);
  ok(!r.relatorio.avisos.some(a => /qualificador maior que a celula/.test(a)),
    'e o aviso do #29 não dispara mais — a caixa passou a USAR a medida, não só avisar',
    JSON.stringify(r.relatorio.avisos));
}

// ---------------------------------------------------------------------------
console.log(falhas ? `\n  ✗ ${falhas} falha(s)` : '\n  ✓ a caixa da folha reflete a largura medida do rótulo.');
process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
