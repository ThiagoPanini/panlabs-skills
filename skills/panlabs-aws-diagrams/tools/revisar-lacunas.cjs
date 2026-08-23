#!/usr/bin/env node
'use strict';
/**
 * A revisão de lacunas, do terminal — o passo 4 do arco.
 *
 *   node tools/revisar-lacunas.cjs <modelo.json>       o laudo, legível
 *   node tools/revisar-lacunas.cjs <modelo.json> --json  para ler no código
 *   node tools/revisar-lacunas.cjs --corpus             a tabela do corpus inteiro
 *
 * Come `modelo@1`. Se o que você tem é um `sessao@1`, projete antes — igual ao
 * `check-geometria.cjs`, e pelo mesmo motivo (ver `guia/sabatina.md`).
 */

const fs = require('fs');
const path = require('path');
const { revisar } = require(path.join(__dirname, '..', 'sessao', 'lacunas.cjs'));

const RAIZ = path.join(__dirname, '..');

function umModelo(arq, json) {
  const modelo = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const r = revisar(modelo);
  if (json) { console.log(JSON.stringify(r, null, 2)); return r; }

  console.log(`\n  ${modelo.titulo || modelo.id}  (${modelo.nos.length} nós, teto ${r.teto})`);
  if (!r.achados.length) console.log('    nenhum achado');
  for (const a of r.achados) console.log(`    ⚠ ${a.regra.padEnd(28)} ${String(a.alvo).padEnd(22)} ${a.porque}`);
  if (r.mudas.length) {
    console.log('\n    mudas (a regra não tem sujeito neste modelo — não é o mesmo que passar):');
    for (const m of r.mudas) console.log(`      · ${m.regra.padEnd(28)} ${m.porque}`);
  }
  console.log(`\n    ${r.achados.length} achado(s) · teto ⌈${modelo.nos.length}÷4⌉ = ${r.teto} · ` +
    (r.dentroDoTeto ? 'dentro' : '⛔ ESTOURA'));
  return r;
}

function corpus() {
  const arqs = [];
  for (const d of ['modelo', 'modelo/recusa']) {
    const dir = path.join(RAIZ, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort())
      arqs.push(path.join(d, f));
  }

  const linhas = [];
  const disparou = new Map(), calou = new Map();
  for (const rel of arqs) {
    const modelo = JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
    const r = revisar(modelo);
    const porRegra = new Map();
    for (const a of r.achados) porRegra.set(a.regra, (porRegra.get(a.regra) || 0) + 1);
    for (const [k] of porRegra) disparou.set(k, (disparou.get(k) || 0) + 1);
    for (const m of r.mudas) calou.set(m.regra, (calou.get(m.regra) || 0) + 1);
    linhas.push({
      nome: path.basename(rel, '.json'), nos: modelo.nos.length,
      n: r.achados.length, teto: r.teto, ok: r.dentroDoTeto,
      regras: [...porRegra.entries()].map(([k, v]) => `${k}×${v}`).join(' '),
    });
  }

  const w = Math.max(...linhas.map(l => l.nome.length));
  console.log(`  ${'modelo'.padEnd(w)}  nós  ach  teto        regras que dispararam`);
  for (const l of linhas)
    console.log(`  ${l.nome.padEnd(w)}  ${String(l.nos).padStart(3)}  ${String(l.n).padStart(3)}  ` +
      `${String(l.teto).padStart(4)} ${l.ok ? ' ' : '⛔'}   ${l.regras}`);

  const REGRAS = ['spof', 'single-az', 'egress-sem-controle', 'dado-em-subnet-publica',
    'cross-account-sem-confianca', 'assincrono-sem-dlq'];
  console.log('\n  L2/L3 — toda regra tem de disparar em ≥1 modelo E calar em ≥1:');
  let vermelho = 0;
  for (const r of REGRAS) {
    const d = disparou.get(r) || 0, c = calou.get(r) || 0;
    const ok = d >= 1 && c >= 1;
    if (!ok) vermelho++;
    console.log(`    ${ok ? '✓' : '✗'} ${r.padEnd(30)} disparou em ${String(d).padStart(2)} · calou em ${String(c).padStart(2)}`);
  }
  const estouram = linhas.filter(l => !l.ok);
  console.log(`\n  L4 — teto ⌈nós÷4⌉: ${estouram.length ? '✗ ' + estouram.map(l => l.nome).join(', ') : '✓ nenhum modelo estoura'}`);
  return vermelho === 0 && !estouram.length;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--corpus')) { process.exit(corpus() ? 0 : 1); }
  const arq = args.find(a => !a.startsWith('--'));
  if (!arq) {
    console.error('uso: node tools/revisar-lacunas.cjs <modelo.json> [--json]   |   --corpus');
    process.exit(2);
  }
  umModelo(arq, args.includes('--json'));
}

if (require.main === module) main();
