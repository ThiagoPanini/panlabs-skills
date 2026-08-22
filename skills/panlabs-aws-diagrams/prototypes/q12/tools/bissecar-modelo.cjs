#!/usr/bin/env node
'use strict';
/**
 * Bisseção no MODELO, não no XML.
 *
 * O `UnknownVizError` do draw.io headless não diz onde dói, e bissecar o XML
 * produz arquivos com pai órfão — que renderizam por acidente e mentem sobre a
 * causa. Aqui cada variante volta a passar pelo motor, então todo arquivo
 * testado é um arquivo que o motor de fato emitiria.
 *
 *   node tools/bissecar-modelo.cjs modelo/x.json
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { gerar } = require('../../q11/motor/gerar.cjs');

const AQUI = path.join(__dirname, '..');
const RENDER = path.join(__dirname, 'render.sh');

/** Remove um nó e tudo que depende dele — descendentes, arestas, faixas. */
function podar(modelo, ids) {
  const alvo = new Set(ids);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const n of modelo.nos)
      if (n.dentro && alvo.has(n.dentro) && !alvo.has(n.id)) { alvo.add(n.id); mudou = true; }
  }
  return {
    ...modelo,
    nos: modelo.nos.filter(n => !alvo.has(n.id)),
    arestas: (modelo.arestas || []).filter(a => !alvo.has(a.de) && !alvo.has(a.para)),
    faixas: (modelo.faixas || []).filter(f => f.membros.every(m => !alvo.has(m))),
  };
}

async function testar(nome, modelo) {
  const drawio = path.join(AQUI, 'saida', `_bis-${nome}.drawio`);
  let r;
  try { r = await gerar(modelo); }
  catch (e) { return `${nome.padEnd(24)} motor recusou: ${e.message}`; }
  fs.writeFileSync(drawio, r.xml);
  try {
    execFileSync(RENDER, [drawio, drawio.replace(/\.drawio$/, '.png')], { stdio: 'pipe' });
    fs.unlinkSync(drawio); fs.unlinkSync(drawio.replace(/\.drawio$/, '.png'));
    return `${nome.padEnd(24)} ✓ rendeu   (${r.plano.larg}×${r.plano.alt}, ${r.plano.celulas.length} células)`;
  } catch (e) {
    return `${nome.padEnd(24)} ✗ FALHOU   (${r.plano.larg}×${r.plano.alt}, ${r.plano.celulas.length} células)`;
  }
}

async function main() {
  const modelo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const contas = modelo.nos.filter(n => n.tipo === 'conta').map(n => n.id);

  const casos = [['inteiro', []], ['sem-ator', ['cliente']]];
  for (const c of contas) casos.push([`sem-${c}`, [c]]);
  for (const c of contas) casos.push([`so-${c}`, contas.filter(o => o !== c).concat(['cliente'])]);

  for (const [nome, remover] of casos)
    console.log(await testar(nome, podar(modelo, remover)));
}

main().catch(e => { console.error(e); process.exit(1); });
