#!/usr/bin/env node
'use strict';
/**
 * O motor do #11 nao mudou uma linha.
 *
 *   node tools/check-motor-intocado.cjs            # confere
 *   node tools/check-motor-intocado.cjs --gravar   # regrava o manifesto
 *
 * Esta e a afirmacao mais forte do prototipo e a mais facil de contar errado. A
 * tese do #14 e que servir as duas vistas nao e problema do MOTOR, e problema de
 * PROJECAO: se fosse do motor, ele teria de aprender o que e vista logica, o que
 * e casaco, o que colapsa. A prova de que nao teve e o motor sair daqui byte a
 * byte igual ao que o #11 deixou.
 *
 * Por que manifesto e nao `git diff`: `git diff` compara com o que esta commitado,
 * e um motor alterado E commitado passa. O manifesto compara com os bytes contra
 * os quais este prototipo foi medido, que e a afirmacao que interessa.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MOTOR = path.join(__dirname, '..', '..', 'q11', 'motor');
const MANIFESTO = path.join(__dirname, 'motor.manifesto.json');

// `vendor/` e o elkjs embarcado (1,6 MB) — hasheado igual, mas listado a parte
// para o manifesto continuar legivel.
function arquivos(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...arquivos(p, base));
    else out.push(path.relative(base, p));
  }
  return out.sort();
}

const atual = {};
for (const rel of arquivos(MOTOR))
  atual[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(MOTOR, rel))).digest('hex').slice(0, 16);

if (process.argv.includes('--gravar')) {
  fs.writeFileSync(MANIFESTO, JSON.stringify(atual, null, 2) + '\n');
  console.log(`  manifesto gravado: ${Object.keys(atual).length} arquivos do motor do #11`);
  process.exit(0);
}

if (!fs.existsSync(MANIFESTO)) {
  console.log('  manifesto ausente — rode com --gravar uma vez.');
  process.exit(1);
}
const esperado = JSON.parse(fs.readFileSync(MANIFESTO, 'utf8'));

const falhas = [];
for (const [rel, h] of Object.entries(esperado)) {
  if (atual[rel] === undefined) falhas.push(`sumiu: motor/${rel}`);
  else if (atual[rel] !== h) falhas.push(`MUDOU: motor/${rel}  (${h} → ${atual[rel]})`);
}
for (const rel of Object.keys(atual)) if (esperado[rel] === undefined) falhas.push(`novo: motor/${rel}`);

console.log(`  arquivos do motor do #11 conferidos: ${Object.keys(esperado).length}`);
if (falhas.length) {
  console.log('\n  ✗ o motor mudou — a tese de que a projecao resolve sozinha nao vale mais:');
  for (const f of falhas) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('  ✓ intacto. Servir as duas vistas nao custou uma linha do motor.');
