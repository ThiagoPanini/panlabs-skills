#!/usr/bin/env node
'use strict';
/**
 * O validador geométrico pela linha de comando.
 *
 *   node tools/check-geometria.cjs <modelo.json> [...]   valida o que o motor gerar
 *   node tools/check-geometria.cjs --exemplos            valida os modelos do #11
 *   node tools/check-geometria.cjs ... --tudo            mostra também o que passou
 *   node tools/check-geometria.cjs ... --json            laudo em JSON
 *   node tools/check-geometria.cjs ... --estrito         aviso também reprova
 *
 * O código de saída é 1 quando há falha — é o que permite pendurar isto num
 * portão de CI. Com `--estrito`, aviso conta como falha.
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
const { validarGeometria, formatar } = require(path.join(__dirname, '..', 'validador', 'validar-geometria.cjs'));

async function main() {
  const args = process.argv.slice(2);
  const tudo = args.includes('--tudo');
  const json = args.includes('--json');
  const estrito = args.includes('--estrito');
  const exemplos = args.includes('--exemplos');
  let entradas = args.filter(a => !a.startsWith('--'));

  if (exemplos) entradas = fs.readdirSync(path.join(RAIZ, 'modelo')).filter(f => f.endsWith('.json')).map(f => path.join(RAIZ, 'modelo', f));
  if (!entradas.length) {
    console.error('uso: node check-geometria.cjs <modelo.json> [...] | --exemplos  [--tudo] [--json] [--estrito]');
    process.exit(2);
  }

  let gerar;
  try { ({ gerar } = require(path.join(RAIZ, 'motor', 'gerar.cjs'))); }
  catch (erro) {
    console.error(`não consegui carregar o motor do #11 em ${RAIZ}: ${erro.message}`);
    process.exit(2);
  }

  const laudos = [];
  let ruim = 0;

  for (const entrada of entradas) {
    const nome = path.basename(entrada, '.json');
    let r;
    try {
      r = await gerar(JSON.parse(fs.readFileSync(entrada, 'utf8')));
    } catch (erro) {
      console.error(`\n✗ ${nome}: o motor não gerou — ${erro.message}`);
      for (const linha of erro.erros || []) console.error(`    · ${linha}`);
      ruim++;
      continue;
    }

    const laudo = validarGeometria(r.plano);
    const reprovado = laudo.falhas.length > 0 || (estrito && laudo.avisos.length > 0);
    if (reprovado || laudo.cobertura.naoRodaram.length) ruim++;

    if (json) {
      laudos.push({
        diagrama: nome, caminho: r.caminho, ok: laudo.ok, resumo: laudo.resumo,
        cobertura: laudo.cobertura,
        checagens: [...laudo.resultados, ...laudo.extras].map(x => ({
          id: x.id, nome: x.nome, estado: x.estado, semantica: x.semantica,
          mensagem: x.mensagem, medida: x.medida,
          ocorrencias: x.ocorrencias.map(o => o.o_que),
        })),
      });
      continue;
    }

    console.log(`\n${'='.repeat(72)}\n${nome}  (caminho "${r.caminho}", ${r.plano.celulas.length} células)\n${'='.repeat(72)}`);
    console.log(formatar(laudo, { tudo }));
  }

  if (json) console.log(JSON.stringify(laudos, null, 2));
  else {
    console.log('');
    console.log(ruim ? `✗ ${ruim}/${entradas.length} diagrama(s) com falha` : `✓ ${entradas.length} diagrama(s) sem falha`);
  }
  process.exit(ruim ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
