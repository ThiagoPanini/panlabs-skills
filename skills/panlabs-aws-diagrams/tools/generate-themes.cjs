#!/usr/bin/env node
'use strict';
/**
 * As variantes de tema, num lugar só — `saida/temas/`.
 *
 *   node tools/gerar-temas.cjs
 *
 * Existem para duas checagens que precisam de arquivo e não de objeto: o
 * round-trip do tema pelo codec do app (`tests/check-roundtrip-tema.cjs`) e a
 * verificação no PIXEL (`tools/verificar-tema.py`), que é a lição do #17 —
 * style string certa não é render certo.
 *
 * A `d-armadilha` e a `e-indizivel` saem de `gerar-armadilha.cjs`, que é quem
 * sabe construí-las; aqui ficam só as legítimas.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { gerar } = require('../motor/gerar.cjs');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'saida', 'temas');

const VARIANTES = [
  { nome: 'a-claro', modelo: 'pedidos-serverless.json', tema: 'claro' },
  { nome: 'b-escuro', modelo: 'pedidos-serverless.json', tema: 'escuro' },
  { nome: 'c-corporativo', modelo: 'pedidos-serverless.json', tema: 'corporativo' },
  { nome: 'g-vista-logica', modelo: 'logica-pedidos.json', tema: 'claro' },
  // o encontro do #12 com o #13: multi-conta no deck escuro
  { nome: 'h-contas-escuro', modelo: 'hub-tgw-3-contas.json', tema: 'escuro' },
  // a variante animada só se vê em SVG (#4): PNG dela seria prova falsa
  { nome: 'f-fluxo-animado', modelo: 'pedidos-serverless.json', tema: 'claro', fluxo: 'animado' },
];

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  for (const v of VARIANTES) {
    const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', v.modelo), 'utf8'));
    const r = await gerar(m, { tema: v.tema, fluxo: v.fluxo });
    fs.writeFileSync(path.join(DIR, v.nome + '.drawio'), r.xml);
    console.log(`  ${v.nome.padEnd(18)} tema=${v.tema}${v.fluxo ? ` fluxo=${v.fluxo}` : ''}  ${r.xml.length} bytes`);
  }
  execFileSync(process.execPath, [path.join(__dirname, 'gerar-armadilha.cjs')], { stdio: 'inherit' });
}

main().catch(e => { console.error(e); process.exit(1); });
