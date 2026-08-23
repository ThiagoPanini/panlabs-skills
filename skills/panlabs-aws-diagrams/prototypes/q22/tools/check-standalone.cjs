#!/usr/bin/env node
'use strict';
/**
 * A regra que este protótipo SUBSTITUIU, medida contra a que ficou.
 *
 * O #22 já tinha uma resposta no repositório: o commit `9b27d6f` ("Protótipo
 * #22: deriva a camada das subnets pelo conteúdo"), um protótipo autônomo com
 * emissor próprio. O cabeçalho da decisão é o MESMO desta — derivar do
 * conteúdo, `camada` como escape — e é por isso que ela não foi descartada por
 * gosto. Duas sub-decisões divergem, e uma delas é medível:
 *
 *   · MISTURA. Lá, subnet com serviços de mais de uma camada vira
 *     `indefinida` e vai para o fim. Aqui, vence o membro mais fundo.
 *   · TABELA. Lá são 7 categorias; aqui são 9 —
 *     `security_identity_compliance`, `application_integration` e `analytics`
 *     entraram.
 *
 * Esta régua carrega a regra de lá **do próprio git** e roda as duas sobre os
 * modelos de rede REAIS do q11 e do q12 — escritos antes das duas, por outros
 * tickets, então nenhuma das regras foi feita para eles.
 *
 * O que ela conta: quantas subnets cada regra consegue nomear. Uma subnet que
 * a regra não sabe nomear não é neutra — ela vai para o fim da exposição dela,
 * que é uma posição, e uma posição que ninguém escolheu.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const Q22 = path.join(__dirname, '..');
const Q11 = path.join(Q22, '..', 'q11');
const Q12 = path.join(Q22, '..', 'q12');
const REF = process.argv[2] || '9b27d6f';
const CAMINHO = 'skills/panlabs-aws-diagrams/prototypes/q22/camadas.cjs';

const { derivar } = require(path.join(Q11, 'motor', 'derivar.cjs'));
const cat = require(path.join(Q11, '..', '..', 'catalog', 'aws-shapes.cjs')).carregar();

// materializa a regra de lá num diretório com `type` ancorado — ver o comentário
// em `gerar-antes.sh` sobre o `package.json` que a extração do draw.io deixa em /tmp
let anterior;
try {
  const fonte = execFileSync('git', ['-C', Q22, 'show', `${REF}:${CAMINHO}`], { encoding: 'utf8', maxBuffer: 1 << 24 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q22-anterior-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"commonjs"}\n');
  fs.writeFileSync(path.join(dir, 'camadas.cjs'), fonte);
  anterior = require(path.join(dir, 'camadas.cjs'));
} catch (e) {
  console.log(`  ⚠ não consegui carregar a regra de ${REF} (${e.message.split('\n')[0]}).`);
  console.log('    A comparação é histórica; sem o commit ela não roda. Seguindo sem ela.');
  process.exit(0);
}

let total = 0, mudasLa = 0, mudasAqui = 0, divergentes = 0;
const linhas = [];

for (const [grupo, dir] of [['q11', path.join(Q11, 'modelo')], ['q12', path.join(Q12, 'modelo')]]) {
  for (const arq of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, arq), 'utf8'));
    const subnets = m.nos.filter(n => n.tipo === 'subnet');
    if (!subnets.length) continue;
    const filhos = anterior.indexarFilhos(m.nos);
    const d = derivar(m, { cat });
    for (const s of subnets) {
      total++;
      const la = anterior.classificar(s, filhos, cat);
      const aqui = (d.camadas.get(s.id) || {}).camada || null;
      const laMuda = la.camada === 'indefinida';
      const aquiMuda = !aqui;
      if (laMuda) mudasLa++;
      if (aquiMuda) mudasAqui++;
      if (laMuda !== aquiMuda) {
        divergentes++;
        linhas.push(`  ${grupo}/${arq.replace(/\.json$/, '').padEnd(24)} ${s.id.padEnd(9)} "${s.rotulo}"` +
          `\n      lá: ${la.camada} (${la.origem})   aqui: ${aqui}`);
      }
    }
  }
}

console.log(`\n  regra de ${REF} vs. a que ficou — corpus de rede do q11 e do q12\n`);
console.log(`  subnets medidas:                       ${total}`);
console.log(`  sem camada pela regra de ${REF}:  ${mudasLa}`);
console.log(`  sem camada pela regra que ficou:       ${mudasAqui}`);
if (linhas.length) {
  console.log('\n  onde uma nomeia e a outra não:\n');
  for (const l of linhas) console.log(l);
}

// A régua trava o achado: se um dia a regra que ficou passar a deixar subnet
// sem camada onde a de lá também deixava, a justificativa da substituição caiu.
const ok = mudasAqui < mudasLa;
console.log(ok
  ? `\n  ✓ a regra que ficou nomeia ${mudasLa - mudasAqui} subnet(s) que a anterior deixava sem camada, e nenhuma a menos.`
  : `\n  ✗ a regra que ficou NÃO nomeia mais que a anterior — a razão da substituição não se sustenta.`);
process.exit(ok ? 0 : 1);
