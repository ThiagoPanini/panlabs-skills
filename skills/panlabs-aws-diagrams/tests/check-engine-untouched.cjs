#!/usr/bin/env node
'use strict';
/**
 * O motor nao muda sem que alguem decida que muda.
 *
 *   node tests/check-engine-untouched.cjs            # confere
 *   node tests/check-engine-untouched.cjs --gravar   # regrava o manifesto
 *
 * ⚠️ ESTE MANIFESTO MUDOU DE AFIRMACAO na recertificacao do #23, e vale dizer o
 * que ele afirmava antes.
 *
 * O #14 congelava os bytes do motor do #11 para provar que servir as DUAS VISTAS
 * nao custou uma linha do motor: se custasse, o motor teria de aprender o que e
 * vista logica, o que e casaco, o que colapsa. Aquela afirmacao **morreu** — o
 * #12, o #13 e o #22 mudaram o motor depois, e o manifesto ja estava vermelho na
 * `main` antes deste ticket (o proprio #22 registrou).
 *
 * A TESE do #14 sobrevive, e agora ela e testada de verdade em vez de por
 * congelamento: `check-projection.cjs` passa 12/12 contra um motor que cresceu
 * tres vezes. Servir as duas vistas continua sendo problema de PROJECAO.
 *
 * O que este arquivo passa a afirmar e mais modesto e continua util: os 12
 * arquivos do motor de PRODUCAO tem estes bytes. A proxima mudanca neles vai ser
 * deliberada — alguem roda `--gravar` e explica — em vez de descoberta tres
 * tickets depois.
 *
 * Por que manifesto e nao `git diff`: `git diff` compara com o que esta commitado,
 * e um motor alterado E commitado passa. O manifesto compara com os bytes contra
 * os quais a suite foi medida, que e a afirmacao que interessa.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MOTOR = path.join(__dirname, '..', 'engine');
const MANIFESTO = path.join(__dirname, 'engine.manifest.json');

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
  console.log(`  manifesto gravado: ${Object.keys(atual).length} arquivos do motor de producao`);
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

console.log(`  arquivos do motor de producao conferidos: ${Object.keys(esperado).length}`);
if (falhas.length) {
  console.log('\n  ✗ o motor mudou desde a ultima medicao da suite:');
  for (const f of falhas) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('  ✓ intacto desde a ultima medicao — nenhuma mudanca acidental.');
