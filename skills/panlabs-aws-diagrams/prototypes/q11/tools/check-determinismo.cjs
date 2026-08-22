#!/usr/bin/env node
'use strict';
/**
 * Determinismo — três perguntas, e a terceira estava aberta.
 *
 *   1. Mesma entrada, mesmo processo, N vezes -> byte a byte idêntico?
 *   2. Mesma entrada, processo NOVO -> idêntico? (o `$H` do GWT vaza com um
 *      contador global de processo; o #7 provou que ele não move coordenada,
 *      mas quem serializa o objeto cru do ELK versiona lixo.)
 *   3. Entrada REORDENADA -> mesmo desenho?
 *
 * A 3 é a incerteza 4 do #7, deixada explicitamente sem resposta lá:
 *
 *   > "Não testei se reordenar `children`/`edges` no JSON de entrada muda o
 *   >  desenho — e há forte indício de que muda, já que existe
 *   >  `considerModelOrder.strategy`. Se o gerador itera sobre um Map sem ordem
 *   >  estável, o layout pode variar mesmo com o ELK sendo determinístico."
 *
 * Importa porque o `.drawio` é para ser versionado: se a ordem da lista plana
 * mexe no desenho, um diff de modelo que só move uma linha vira um diff de
 * diagrama inteiro.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const { gerar } = require(path.join(RAIZ, 'motor', 'gerar.cjs'));

const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
// o diretório de modelos é argumento para que outro protótipo aponte os SEUS
// modelos para esta mesma régua — o determinismo é propriedade do motor, não
// de um conjunto de exemplos
const DIR_MODELOS = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, 'modelo');
const modelos = fs.readdirSync(DIR_MODELOS).filter(f => f.endsWith('.json'));

/** Só a geometria — ignora ids, estilos e a ordem em que as células saíram. */
function digital(xml) {
  const geos = [...xml.matchAll(/id="([^"]+)"[^>]*>\s*<mxGeometry x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)"/g)]
    .map(m => `${m[1]}:${m[2]},${m[3]},${m[4]},${m[5]}`).sort();
  const pts = [...xml.matchAll(/<mxPoint x="(-?\d+)" y="(-?\d+)"\/>/g)].map(m => `${m[1]},${m[2]}`);
  return hash(geos.join('|') + '#' + pts.join('|'));
}

/** Embaralho determinístico — sem Math.random, para o teste ser reproduzível. */
function embaralhar(arr, semente) {
  const a = [...arr];
  let s = semente;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

(async () => {
  let falhas = 0;

  for (const arq of modelos) {
    const bruto = fs.readFileSync(path.join(DIR_MODELOS, arq), 'utf8');
    const modelo = JSON.parse(bruto);
    console.log(`\n  ${arq}`);

    // 1. mesmo processo, 3 execuções
    const hs = [];
    for (let i = 0; i < 3; i++) hs.push(hash((await gerar(JSON.parse(bruto))).xml));
    const iguais = new Set(hs).size === 1;
    console.log(`    mesmo processo  ×3   ${iguais ? '✓' : '✗'}  ${hs[0]}`);
    if (!iguais) { falhas++; console.log(`        ${hs.join('  ')}`); }

    // 2. processo novo
    const outro = execFileSync(process.execPath, ['-e', `
      const { gerar } = require(${JSON.stringify(path.join(RAIZ, 'motor', 'gerar.cjs'))});
      const m = JSON.parse(require('fs').readFileSync(${JSON.stringify(path.join(DIR_MODELOS, arq))}, 'utf8'));
      gerar(m).then(r => process.stdout.write(require('crypto').createHash('sha256').update(r.xml).digest('hex').slice(0,16)));
    `], { encoding: 'utf8' });
    const novoOk = outro === hs[0];
    console.log(`    processo novo        ${novoOk ? '✓' : '✗'}  ${outro}`);
    if (!novoOk) falhas++;

    // 3. entrada reordenada — a incerteza 4 do #7
    const base = digital((await gerar(JSON.parse(bruto))).xml);
    const divergentes = [];
    for (const semente of [7, 42, 1337]) {
      const m = JSON.parse(bruto);
      m.nos = embaralhar(m.nos, semente);
      if (m.arestas) m.arestas = embaralhar(m.arestas, semente + 1);
      let d;
      try { d = digital((await gerar(m)).xml); }
      catch (e) { d = 'ERRO: ' + e.message; }
      if (d !== base) divergentes.push(`semente ${semente} -> ${d}`);
    }
    const ordemOk = divergentes.length === 0;
    console.log(`    entrada reordenada   ${ordemOk ? '✓' : '✗'}  geometria ${ordemOk ? 'idêntica' : 'MUDOU'} (${base})`);
    if (!ordemOk) { falhas++; for (const d of divergentes) console.log(`        ${d}`); }
  }

  console.log(falhas
    ? `\n  ✗ ${falhas} falha(s) de determinismo`
    : '\n  ✓ determinístico nas três frentes, inclusive sob reordenação da entrada.');
  process.exit(falhas ? 1 : 0);
})();
