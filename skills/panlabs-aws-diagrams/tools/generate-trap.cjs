#!/usr/bin/env node
'use strict';
/**
 * As duas armadilhas, desenhadas — porque em prosa elas parecem opções.
 *
 *   d-armadilha    DIZÍVEL e errado. O off-white corporativo que todo mundo pede
 *                  (#F2F3F5), tinta cinza-clara e seta fininha. Nenhuma linha do
 *                  tema é proibida pelo vocabulário; quem reprova é o PORTÃO DE
 *                  CONTRASTE, e só depois do plano existir. Gerado com --force.
 *
 *   e-indizivel    INDIZÍVEL. `sketch=1`, cor de grupo trocada e `rounded=1` em
 *                  vértice AWS4. Não existe token para nenhum dos três, então
 *                  este arquivo é produzido por remendo bruto no XML, à mão,
 *                  DEPOIS do motor. É o que o vocabulário fechado impede — e o
 *                  render mostra por quê:
 *                    · `sketch=1` jittera o glifo do stencil (#4 §3.3);
 *                    · trocar a cor do grupo apaga a legenda (§6.4 do #5);
 *                    · `rounded=1` em AWS4 é no-op silencioso (#4 §8) — o pedido
 *                      não aparece em lugar nenhum, que é o pior tipo de opção.
 *
 *   node tools/generate-trap.cjs
 */

const fs = require('fs');
const path = require('path');
const { generate } = require('../engine/generate.cjs');
const contraste = require('../engine/contrast.cjs');

const ROOT = path.join(__dirname, '..');
fs.mkdirSync(path.join(ROOT, 'output', 'themes'), { recursive: true });
const MODEL = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'orders-serverless.json'), 'utf8'));

/** Remendo bruto: o que o vocabulário não deixa dizer, dito na marra. */
function patch(xml) {
  return xml
    // 1. sketch nos shapes AWS4 — a paleta oficial força sketch=0 em 56/56 entradas
    .replace(/shape=mxgraph\.aws4\./g, 'sketch=1;curveFitting=1;jiggle=2;shape=mxgraph.aws4.')
    // 2. a cor do grupo trocada por uma paleta "da casa" — some a legenda
    .replace(/strokeColor=#8C4FFF/g, 'strokeColor=#1B6AC9')   // VPC roxo -> azul corporativo
    .replace(/strokeColor=#00A4A6/g, 'strokeColor=#1B6AC9')   // subnet privada -> o mesmo azul
    .replace(/strokeColor=#7AA116/g, 'strokeColor=#1B6AC9')   // subnet pública -> o mesmo azul
    // 3. rounded em vértice AWS4 — pedido que o mxStencil ignora
    .replace(/aspect=fixed;/g, 'aspect=fixed;rounded=1;arcSize=20;');
}

async function main() {
  // --- d: dizível e errado -------------------------------------------------
  const d = await generate(MODEL, { tema: 'trap', force: true });
  fs.writeFileSync(path.join(ROOT, 'output', 'themes', 'd-trap.drawio'), d.xml);
  console.log('d-armadilha  — o portão reprovaria assim:');
  for (const l of contraste.summarize(d.relatorio.contraste)) console.log('   ✗ ' + l);
  fs.writeFileSync(path.join(ROOT, 'output', 'themes', 'd-trap.verdict.txt'),
    contraste.summarize(d.relatorio.contraste).join('\n') + '\n');

  // --- e: indizível --------------------------------------------------------
  const e = await generate(MODEL, { tema: 'light' });
  const patched = patch(e.xml);
  fs.writeFileSync(path.join(ROOT, 'output', 'themes', 'e-unspeakable.drawio'), patched);
  const quantos = k => (patched.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log('\ne-indizivel  — remendos que NENHUM token do tema pode escrever:');
  console.log(`   sketch=1 injetado em ${quantos('sketch=1')} shape(s) AWS4`);
  console.log(`   cor de grupo trocada por #1B6AC9 em ${quantos('strokeColor=#1B6AC9')} grupo(s)`);
  console.log(`   rounded=1 injetado em ${quantos('rounded=1;arcSize=20')} vértice(s) AWS4 (no-op — o render vai ignorar)`);
  // A afirmação abaixo é MEDIDA, não suposta: o mesmo remendo aplicado ao PLANO,
  // passado pelo portão. Se um dia o azul escolhido reprovasse, esta linha muda de
  // lado sozinha em vez de continuar afirmando o que não é mais verdade.
  const patchedPlan = {
    ...e.layoutPlan,
    celulas: e.layoutPlan.celulas.map(c => ({ ...c, style: patch(c.style || '') })),
  };
  const v = contraste.measure(patchedPlan);
  console.log(`\n   E note o que este arquivo prova sobre o portão: a versão remendada ` +
    `${v.ok ? 'PASSA' : 'REPROVA'} no contraste`);
  const n = x => Number.isFinite(x) ? x.toFixed(2) + ':1' : 'sem par medido';
  console.log(`   (${v.total} pares medidos, pior grafismo ${n(v.piorGrafismo)}, ` +
    `pior texto ${n(v.piorTexto)}) e mesmo assim o diagrama passou a mentir —`);
  console.log('   três fronteiras diferentes na mesma cor. Contraste é acessibilidade, não');
  console.log('   veracidade: por isso a camada normativa precisa ser INDIZÍVEL, e não');
  console.log('   apenas medida.');
  if (!v.ok) { for (const l of contraste.summarize(v)) console.log('     · ' + l); }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
