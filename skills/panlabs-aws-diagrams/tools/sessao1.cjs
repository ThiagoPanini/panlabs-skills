#!/usr/bin/env node
'use strict';
/**
 * SESSAO 1 — a vista logica de um caso, aprovada e persistida.
 *
 *   node sessao1.cjs [--saida saida/varejo.drawio]
 *
 * O que acontece aqui e o fim da sabatina do #15: o modelo esta completo no
 * estagio logico, o usuario aprovou uma das candidatas, e a conversa acaba. O
 * arquivo que sai carrega TUDO que a sessao 2 vai precisar — o modelo, o dossie,
 * o acordo e as impressoes do desenho. Nao ha um segundo arquivo, e nao ha nada
 * que so exista na memoria do agente.
 */

const fs = require('fs');
const path = require('path');

const { validar } = require('../sessao/validar.cjs');
const { aprovar } = require('../sessao/acordo.cjs');
const { desenhar } = require('../sessao/desenhar.cjs');

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--saida');
  const saida = i >= 0 ? args[i + 1] : path.join(__dirname, '..', 'saida', 'varejo.drawio');
  const entrada = path.join(__dirname, '..', 'modelo', 'sessao', 'varejo-logica.json');

  const sessao = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  console.log(`\n  SESSAO 1 · ${sessao.titulo}\n`);

  const v = validar(sessao);
  for (const a of v.avisos) console.log(`  ⚠ ${a}`);
  if (!v.ok) {
    console.error(`\n  ✗ modelo invalido (${v.fase})`);
    for (const e of v.erros) console.error(`      · ${e}`);
    process.exit(1);
  }
  console.log(`  validar     ok · estagio=${sessao.estagio} · ${sessao.nos.length} nos · ${sessao.arestas.length} arestas`);

  // A aprovacao. O usuario disse "e a A mesmo" e escolheu; o que muda no modelo
  // e so o dossie ganhando o acordo — nenhum no, nenhuma aresta.
  const aprovado = aprovar(sessao, { em: '2026-08-21', por: 'usuario', candidata: 'cand-a' });
  console.log(`  aprovar     ${aprovado.dossie.acordo.impressao.slice(0, 23)}…  ` +
    `(${aprovado.dossie.acordo.recorte.nos.length} capacidades, ${aprovado.dossie.acordo.recorte.arestas.length} fluxos)`);

  const r = await desenhar(aprovado, 'logica');
  for (const a of r.relatorio.avisos) console.log(`  ⚠ ${a}`);
  console.log(`  desenhar    caminho="${r.caminho}" · ${r.modelo.nos.length} nos projetados`);

  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, r.xml);
  console.log(`\n  → ${path.relative(process.cwd(), saida)}  (${r.xml.length} bytes, 1 pagina)`);
  console.log('    dentro dele: o modelo de sessao, o dossie, o acordo e as duas impressoes do desenho.');
  console.log('    A conversa pode acabar aqui. Nada do que foi decidido depende de eu lembrar.\n');
}

main().catch(e => {
  console.error(`\n  ✗ ${e.message}`);
  for (const l of e.erros || []) console.error(`      · ${l}`);
  process.exit(1);
});
