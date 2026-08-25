#!/usr/bin/env node
'use strict';
/**
 * A revisão de lacunas, do terminal — o passo 4 do arco.
 *
 *   node tools/review-gaps.cjs <modelo.json>       o laudo, legível
 *   node tools/review-gaps.cjs <modelo.json> --json  para ler no código
 *   node tools/review-gaps.cjs --corpus             a tabela do corpus inteiro
 *
 * Come `model@1`. Se o que você tem é um `session@1`, projete antes — igual ao
 * `check-geometry.cjs`, e pelo mesmo motivo (ver `guide/inquiry.md`).
 */

const fs = require('fs');
const path = require('path');
const { review, NAMES, arquivosDoCorpus } = require(path.join(__dirname, '..', 'session', 'gaps.cjs'));

const ROOT = path.join(__dirname, '..');

function umModelo(arq, json) {
  const model = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const r = review(model);
  if (json) { console.log(JSON.stringify(r, null, 2)); return r; }

  console.log(`\n  ${model.title || model.id}  (${model.nodes.length} nós, teto ${r.ceiling})`);
  if (!r.findings.length) console.log('    nenhum achado');
  for (const a of r.findings) console.log(`    ⚠ ${a.rule.padEnd(28)} ${String(a.target).padEnd(22)} ${a.because}`);
  if (r.mudas.length) {
    console.log('\n    mudas (a regra não tem sujeito neste modelo — não é o mesmo que passar):');
    for (const m of r.mudas) console.log(`      · ${m.rule.padEnd(28)} ${m.because}`);
  }
  console.log(`\n    ${r.findings.length} achado(s) · teto ⌈${model.nodes.length}÷4⌉ = ${r.ceiling} · ` +
    (r.dentroDoTeto ? 'inside' : '⛔ ESTOURA'));
  return r;
}

function corpus() {
  const arqs = arquivosDoCorpus(ROOT);
  const linhas = [];
  const disparou = new Map(), calou = new Map();
  for (const rel of arqs) {
    const model = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const r = review(model);
    const porRegra = new Map();
    for (const a of r.findings) porRegra.set(a.rule, (porRegra.get(a.rule) || 0) + 1);
    for (const [k] of porRegra) disparou.set(k, (disparou.get(k) || 0) + 1);
    for (const m of r.mudas) calou.set(m.rule, (calou.get(m.rule) || 0) + 1);
    linhas.push({
      name: path.basename(rel, '.json'), nodes: model.nodes.length,
      n: r.findings.length, ceiling: r.ceiling, ok: r.dentroDoTeto,
      regras: [...porRegra.entries()].map(([k, v]) => `${k}×${v}`).join(' '),
    });
  }

  const w = Math.max(...linhas.map(l => l.name.length));
  console.log(`  ${'model'.padEnd(w)}  nós  ach  teto        regras que dispararam`);
  for (const l of linhas)
    console.log(`  ${l.name.padEnd(w)}  ${String(l.nodes).padStart(3)}  ${String(l.n).padStart(3)}  ` +
      `${String(l.ceiling).padStart(4)} ${l.ok ? ' ' : '⛔'}   ${l.regras}`);

  console.log('\n  L2/L3 — toda regra tem de disparar em ≥1 modelo E calar em ≥1:');
  let vermelho = 0;
  for (const r of NAMES) {
    const d = disparou.get(r) || 0, c = calou.get(r) || 0;
    const ok = d >= 1 && c >= 1;
    if (!ok) vermelho++;
    console.log(`    ${ok ? '✓' : '✗'} ${r.padEnd(30)} disparou em ${String(d).padStart(2)} · calou em ${String(c).padStart(2)}`);
  }
  const estouram = linhas.filter(l => !l.ok);
  console.log(`\n  L4 — teto ⌈nós÷4⌉: ${estouram.length ? '✗ ' + estouram.map(l => l.name).join(', ') : '✓ nenhum modelo estoura'}`);
  return vermelho === 0 && !estouram.length;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--corpus')) { process.exit(corpus() ? 0 : 1); }
  const arq = args.find(a => !a.startsWith('--'));
  if (!arq) {
    console.error('uso: node tools/review-gaps.cjs <modelo.json> [--json]   |   --corpus');
    process.exit(2);
  }
  umModelo(arq, args.includes('--json'));
}

if (require.main === module) main();
