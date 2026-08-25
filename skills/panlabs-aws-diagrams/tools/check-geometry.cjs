#!/usr/bin/env node
'use strict';
/**
 * O validador geométrico pela linha de comando.
 *
 *   node tools/check-geometry.cjs <modelo.json> [...]   valida o que o motor gerar
 *   node tools/check-geometry.cjs --examples            valida os modelos do #11
 *   node tools/check-geometry.cjs ... --all            mostra também o que passou
 *   node tools/check-geometry.cjs ... --json            laudo em JSON
 *   node tools/check-geometry.cjs ... --strict         aviso também reprova
 *   node tools/check-geometry.cjs ... --theme <nome>     avalia com este tema (padrão: claro)
 *
 * O código de saída é 1 quando há falha — é o que permite pendurar isto num
 * portão de CI. Com `--strict`, aviso conta como falha.
 *
 * SEM `--theme`, o laudo sempre avaliou o tema padrão — e é cego para o que só
 * outro tema liga (#33), como `texto.qualificador`. `--theme` existe para o
 * laudo poder ver o mesmo que `--theme` liga em `engine/generate.cjs`.
 *
 * A entrada é um MODELO, não um `.drawio`: o validador lê o `plano`, que é a
 * costura interna do motor (pós-`planejar`, pré-`emitir`), e é ali que a
 * geometria existe em forma de objeto. Reparsear o XML seria reconstruir o que
 * o motor acabou de ter na mão — e reconstruir mal, porque o `.drawio` já
 * perdeu a distinção entre grupo e faixa que a cena precisa.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { validarGeometria, formatar } = require(path.join(__dirname, '..', 'validator', 'validate-geometry.cjs'));

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const json = args.includes('--json');
  const strict = args.includes('--strict');
  const examples = args.includes('--examples');
  const iTema = args.indexOf('--theme');
  const nomeTema = iTema >= 0 ? args[iTema + 1] : 'light';
  let entradas = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--theme');

  if (examples) entradas = fs.readdirSync(path.join(RAIZ, 'models')).filter(f => f.endsWith('.json')).map(f => path.join(RAIZ, 'models', f));
  if (!entradas.length) {
    console.error('uso: node check-geometry.cjs <modelo.json> [...] | --examples  [--all] [--json] [--strict] [--theme <nome>]');
    process.exit(2);
  }

  let gerar;
  try { ({ gerar } = require(path.join(RAIZ, 'engine', 'generate.cjs'))); }
  catch (erro) {
    console.error(`não consegui carregar o motor em ${RAIZ}: ${erro.message}`);
    process.exit(2);
  }

  const laudos = [];
  let ruim = 0;

  for (const input of entradas) {
    const name = path.basename(input, '.json');
    let r;
    try {
      r = await gerar(JSON.parse(fs.readFileSync(input, 'utf8')), { tema: nomeTema });
    } catch (erro) {
      console.error(`\n✗ ${name}: o motor não gerou — ${erro.message}`);
      for (const linha of erro.erros || []) console.error(`    · ${linha}`);
      ruim++;
      continue;
    }

    const laudo = validarGeometria(r.plano);
    const reprovado = laudo.falhas.length > 0 || (strict && laudo.avisos.length > 0);
    if (reprovado || laudo.cobertura.naoRodaram.length) ruim++;

    if (json) {
      laudos.push({
        diagrama: name, caminho: r.caminho, ok: laudo.ok, resumo: laudo.resumo,
        cobertura: laudo.cobertura,
        checagens: [...laudo.resultados, ...laudo.extras].map(x => ({
          id: x.id, name: x.name, state: x.state, semantica: x.semantica,
          mensagem: x.mensagem, medida: x.medida,
          occurrences: x.occurrences.map(o => o.o_que),
        })),
      });
      continue;
    }

    console.log(`\n${'='.repeat(72)}\n${name}  (caminho "${r.caminho}", ${r.plano.celulas.length} células)\n${'='.repeat(72)}`);
    console.log(formatar(laudo, { all }));
  }

  if (json) console.log(JSON.stringify(laudos, null, 2));
  else {
    console.log('');
    console.log(ruim ? `✗ ${ruim}/${entradas.length} diagrama(s) com falha` : `✓ ${entradas.length} diagrama(s) sem falha`);
  }
  process.exit(ruim ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
