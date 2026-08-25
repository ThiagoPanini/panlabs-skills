#!/usr/bin/env node
'use strict';
/**
 * As variantes de tema, num lugar só — `output/temas/`.
 *
 *   node tools/generate-themes.cjs
 *
 * Existem para duas checagens que precisam de arquivo e não de objeto: o
 * round-trip do tema pelo codec do app (`tests/check-roundtrip-theme.cjs`) e a
 * verificação no PIXEL (`tools/verify-theme.py`), que é a lição do #17 —
 * style string certa não é render certo.
 *
 * A `d-armadilha` e a `e-indizivel` saem de `generate-trap.cjs`, que é quem
 * sabe construí-las; aqui ficam só as legítimas.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { gerar } = require('../engine/generate.cjs');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'output', 'themes');

const VARIANTES = [
  { name: 'a-claro', modelo: 'orders-serverless.json', tema: 'light' },
  { name: 'b-escuro', modelo: 'orders-serverless.json', tema: 'dark' },
  { name: 'c-corporativo', modelo: 'orders-serverless.json', tema: 'corporate' },
  { name: 'g-vista-logica', modelo: 'logical-orders.json', tema: 'light' },
  // o encontro do #12 com o #13: multi-conta no deck escuro
  { name: 'h-contas-escuro', modelo: 'hub-tgw-3-accounts.json', tema: 'dark' },
  // a variante animada só se vê em SVG (#4): PNG dela seria prova falsa
  { name: 'f-fluxo-animado', modelo: 'orders-serverless.json', tema: 'light', flow: 'animated' },
];

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  for (const v of VARIANTES) {
    const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', v.modelo), 'utf8'));
    const r = await gerar(m, { tema: v.tema, flow: v.flow });
    fs.writeFileSync(path.join(DIR, v.name + '.drawio'), r.xml);
    console.log(`  ${v.name.padEnd(18)} tema=${v.tema}${v.flow ? ` fluxo=${v.flow}` : ''}  ${r.xml.length} bytes`);
  }
  execFileSync(process.execPath, [path.join(__dirname, 'generate-trap.cjs')], { stdio: 'inherit' });
}

main().catch(e => { console.error(e); process.exit(1); });
