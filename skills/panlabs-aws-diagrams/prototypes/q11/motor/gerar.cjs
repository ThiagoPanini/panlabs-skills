#!/usr/bin/env node
'use strict';
/**
 * Motor de geração — IR › layout › mxGraph XML.
 *
 *   node motor/gerar.cjs modelo.json --saida diagrama.drawio
 *   node motor/gerar.cjs modelo.json --explicar        # só o relatório, sem escrever
 *
 * O pipeline inteiro, e a fronteira que ele defende:
 *
 *   carregar › VALIDAR › resolver › derivar › dispor › planejar › emitir › conferir
 *              ^^^^^^^                        ^^^^^^
 *              o agente para aqui             aqui nasce o primeiro número
 *
 * Nada entre `dispor` e `conferir` tem como ser influenciado pelo modelo a não
 * ser pela semântica. Não é disciplina: o esquema não tem onde escrever uma
 * coordenada. Ver `tools/check-fronteira.cjs`.
 */

const fs = require('fs');
const path = require('path');

const { validar } = require('./validar.cjs');
const resolverMod = require('./resolver.cjs');
const { derivar } = require('./derivar.cjs');
const dispor = require('./dispor.cjs');
const planejar = require('./planejar.cjs');
const { emitir, conferirXml } = require('./emitir.cjs');

const ESQUEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'esquema.json'), 'utf8'));

async function gerar(modelo, opts = {}) {
  const relatorio = { avisos: [], passos: [] };
  const marco = (nome, extra) => relatorio.passos.push({ nome, ...extra });

  const v = validar(modelo, ESQUEMA);
  if (!v.ok) { const e = new Error(`modelo inválido (${v.fase})`); e.erros = v.erros; throw e; }
  relatorio.avisos.push(...v.avisos);
  marco('validar', { nos: modelo.nos.length, arestas: (modelo.arestas || []).length });

  const res = resolverMod.criar(opts.catalogo);
  const d = derivar(modelo);
  marco('derivar', { faixasAz: d.az.desenhar, porque: d.az.porque, azs: d.az.azs });

  let plano, caminho;
  if (d.az.desenhar) {
    caminho = 'grade';
    // O caminho da grade é uma vista de REDE: ele sabe desenhar nuvem › VPC ›
    // subnet › conteúdo e nada mais. Silenciar um container que ele não modela
    // seria produzir um diagrama que omite parte da arquitetura sem avisar —
    // exatamente o tipo de mentira calada que a rubrica (#8) chama de A4.2.
    const forasteiros = modelo.nos.filter(n =>
      ['conta', 'regiao', 'grupo-seguranca', 'grupo'].includes(n.tipo) ||
      (['servico', 'bloco', 'ator'].includes(n.tipo) &&
        !(n.dentro && d.t.porId.get(n.dentro) && d.t.porId.get(n.dentro).tipo === 'subnet')));
    if (forasteiros.length) {
      const e = new Error('o caminho da grade ainda não desenha estes nós');
      e.erros = forasteiros.map(n => `"${n.id}" (${n.tipo}) — a grade de AZ modela só nuvem › VPC › subnet › conteúdo`);
      throw e;
    }
    const g = await dispor.porGrade(modelo, d, res);
    plano = planejar.planoDeGrade(modelo, d, res, g);
  } else {
    caminho = 'elk';
    const layout = await dispor.porElk(modelo, d, res);
    plano = planejar.planoDeElk(modelo, d, res, layout);
    marco('dispor', { passadas: layout.passadas });
  }
  marco('planejar', { caminho, celulas: plano.celulas.length, pagina: `${plano.larg}×${plano.alt}` });

  const xml = emitir(plano);

  // O #19 achou isto do jeito caro: XML inválido faz o draw.io renderizar
  // truncado e sair com código 0. Se o gerador não conferir, ninguém confere.
  const malFormado = conferirXml(xml);
  if (malFormado.length) { const e = new Error('XML mal formado — o draw.io renderizaria truncado em silêncio'); e.erros = malFormado; throw e; }
  marco('conferir', { ok: true, bytes: xml.length });

  // as folhas que caíram no ícone genérico são o sintoma de nome que o
  // catálogo não conhece — vale avisar, não vale falhar
  const genericos = res.usados.filter(u => u.via === 'generico');
  if (genericos.length)
    relatorio.avisos.push(`${genericos.length} nó(s) caíram no ícone genérico: ` +
      genericos.map(u => `${u.id}("${u.pediu}")`).join(', '));

  return { xml, plano, relatorio, resolucoes: res.usados, derivado: d, caminho };
}

// ------------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2);
  const entrada = args.find(a => !a.startsWith('--'));
  if (!entrada) {
    console.error('uso: node gerar.cjs <modelo.json> [--saida arquivo.drawio] [--explicar]');
    process.exit(2);
  }
  const iSaida = args.indexOf('--saida');
  const saida = iSaida >= 0 ? args[iSaida + 1] : entrada.replace(/\.json$/, '.drawio');
  const explicar = args.includes('--explicar');

  let modelo;
  try { modelo = JSON.parse(fs.readFileSync(entrada, 'utf8')); }
  catch (e) { console.error(`não consegui ler ${entrada}: ${e.message}`); process.exit(1); }

  let r;
  try { r = await gerar(modelo); }
  catch (e) {
    console.error(`\n✗ ${e.message}`);
    for (const linha of e.erros || []) console.error(`    · ${linha}`);
    process.exit(1);
  }

  for (const p of r.relatorio.passos)
    console.log(`  ${p.nome.padEnd(10)} ${Object.entries(p).filter(([k]) => k !== 'nome')
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : v}`).join('  ')}`);
  for (const a of r.relatorio.avisos) console.log(`  ⚠ ${a}`);

  if (explicar) {
    console.log('\n  resolução de nomes pelo catálogo:');
    // o motor resolve o mesmo nó mais de uma vez (pré-medição + layout);
    // a trilha de auditoria interessa por nó, não por chamada
    const vistos = new Set();
    for (const u of r.resolucoes.filter(u => !vistos.has(u.id) && vistos.add(u.id)))
      console.log(`    ${String(u.id).padEnd(20)} "${u.pediu}" → ${u.virou}  [${u.via}]` +
        (u.correcoes && u.correcoes.length ? `  correções: ${u.correcoes.join(', ')}` : ''));
    return;
  }

  fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
  fs.writeFileSync(saida, r.xml);
  console.log(`\n  → ${saida}  (${r.xml.length} bytes, caminho "${r.caminho}")`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { gerar, ESQUEMA };
