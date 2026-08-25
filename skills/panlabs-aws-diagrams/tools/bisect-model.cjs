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
 *   node tools/bisect-model.cjs modelo/x.json
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { gerar } = require('../engine/generate.cjs');

const AQUI = path.join(__dirname, '..');
const RENDER = path.join(__dirname, 'render.sh');

/** Remove um nó e tudo que depende dele — descendentes, arestas, faixas. */
function podar(modelo, ids) {
  const target = new Set(ids);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const n of modelo.nodes)
      if (n.inside && target.has(n.inside) && !target.has(n.id)) { target.add(n.id); mudou = true; }
  }
  return {
    ...modelo,
    nodes: modelo.nodes.filter(n => !target.has(n.id)),
    edges: (modelo.edges || []).filter(a => !target.has(a.from) && !target.has(a.to)),
    bands: (modelo.bands || []).filter(f => f.members.every(m => !target.has(m))),
  };
}

const { binario } = require('./drawio.cjs');
const DRAWIO = binario(process.argv[3]);
const TEM_APP = fs.existsSync(DRAWIO) && fs.existsSync(RENDER);

async function testar(name, modelo) {
  const drawio = path.join(AQUI, 'output', `_bis-${name}.drawio`);
  let r;
  try { r = await gerar(modelo); }
  catch (e) { return { name, state: 'rejected', txt: `${name.padEnd(24)} motor recusou: ${e.message}` }; }
  const forma = `(${r.plano.larg}×${r.plano.alt}, ${r.plano.celulas.length} células)`;
  if (!TEM_APP) {
    // Sem o app, a bisseção ainda responde metade da pergunta: o MOTOR aceita
    // cada recorte? Dizer "✗ FALHOU" aqui seria a ferramenta acusando o modelo
    // por uma dependência de desenvolvimento que não existe na máquina.
    return { name, state: 'gerou', txt: `${name.padEnd(24)} ✓ o motor gerou  ${forma}  (render pulado — sem draw.io)` };
  }
  fs.writeFileSync(drawio, r.xml);
  try {
    execFileSync(RENDER, [drawio, drawio.replace(/\.drawio$/, '.png')], { stdio: 'pipe' });
    fs.unlinkSync(drawio); fs.unlinkSync(drawio.replace(/\.drawio$/, '.png'));
    return { name, state: 'rendeu', txt: `${name.padEnd(24)} ✓ rendeu   ${forma}` };
  } catch (e) {
    return { name, state: 'falhou', txt: `${name.padEnd(24)} ✗ FALHOU   ${forma}` };
  }
}

async function main() {
  const modelo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const contas = modelo.nodes.filter(n => n.kind === 'account').map(n => n.id);

  const casos = [['inteiro', []], ['sem-ator', ['cliente']]];
  for (const c of contas) casos.push([`sem-${c}`, [c]]);
  for (const c of contas) casos.push([`so-${c}`, contas.filter(o => o !== c).concat(['cliente'])]);

  const r = [];
  for (const [name, remover] of casos) {
    const t = await testar(name, podar(modelo, remover));
    console.log(t.txt);
    r.push(t);
  }

  /**
   * ⚠️ A BISSEÇÃO SAI 1 QUANDO ACHA ALGUMA COISA — e até a recertificação do #23
   * ela saía 0 sempre.
   *
   * Enquanto ela era ferramenta de diagnóstico rodada à mão, isso não custava:
   * quem a chamou estava lendo a tabela. Dentro de uma suíte é outra coisa —
   * uma camada que não sabe ficar vermelha é um verde que não afirma nada, e o
   * `render.sh` que ela chama nem estava na árvore de produção, então TODOS os
   * recortes "falhavam" e a suíte seguia em frente.
   */
  const ruins = r.filter(x => x.state === 'falhou' || x.state === 'rejected');
  if (ruins.length) {
    console.log(`\n  ✗ ${ruins.length} recorte(s) não passaram: ${ruins.map(x => x.name).join(', ')}`);
    process.exit(1);
  }
  console.log(`\n  ✓ os ${r.length} recortes do modelo passam` +
    (TEM_APP ? ' — motor e render' : ' pelo motor (render é dependência de desenvolvimento)'));
}

main().catch(e => { console.error(e); process.exit(1); });
