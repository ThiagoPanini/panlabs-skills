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
 *   carregar › VALIDAR › resolver › derivar › dispor › planejar › emitir › CONFERIR
 *              ^^^^^^^                        ^^^^^^                        ^^^^^^^^
 *              o agente para aqui             1º número                     XML + contraste
 *
 * O tema (#13) entra em `resolver` — ANTES do layout, não depois. Três dos seus
 * tokens são métrica (corpo do rótulo, densidade da grade, qualificador em duas
 * linhas) e movem coordenada; o resto é pintura pura. A partição está provada em
 * `tools/check-particao.cjs`.
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
const temaMod = require('../tema/tema.cjs');
const contraste = require('./contraste.cjs');

const ESQUEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'esquema.json'), 'utf8'));

async function gerar(modelo, opts = {}) {
  const relatorio = { avisos: [], passos: [] };
  const marco = (nome, extra) => relatorio.passos.push({ nome, ...extra });

  const v = validar(modelo, ESQUEMA);
  if (!v.ok) { const e = new Error(`modelo inválido (${v.fase})`); e.erros = v.erros; throw e; }
  relatorio.avisos.push(...v.avisos);
  marco('validar', { nos: modelo.nos.length, arestas: (modelo.arestas || []).length });

  // `--fluxo` é override de invocação sobre o token do tema: a mesma arquitetura
  // com o mesmo tema pode querer marcar o caminho quente numa entrega e não na
  // outra. Sobrescreve o token, e NÃO mutando o objeto de quem chamou — um tema
  // é um valor, e `comPatch` devolve outro.
  const base = (opts.tema && typeof opts.tema === 'object') ? opts.tema
    : temaMod.carregar(opts.tema || 'claro');
  const tema = opts.fluxo ? temaMod.comPatch(base, { aresta: { fluxo: opts.fluxo } }) : base;
  marco('tema', { id: tema.id, fundo: tema.fundo, densidade: tema.tokens.folga.densidade, fluxo: tema.tokens.aresta.fluxo });
  const res = resolverMod.criar(tema, opts.catalogo);
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
    plano = planejar.planoDeGrade(modelo, d, res, g, opts);
  } else {
    caminho = 'elk';
    const layout = await dispor.porElk(modelo, d, res);
    plano = planejar.planoDeElk(modelo, d, res, layout, opts);
    marco('dispor', { passadas: layout.passadas });
    if (layout.encaixe) {
      for (const a of layout.encaixe.aplicados)
        relatorio.avisos.push(`encaixe: "${a.aresta}" alinhada movendo ${a.moveu.join('+')} em ${a.delta}px`);
      for (const x of layout.encaixe.desfeitos)
        relatorio.avisos.push(`encaixe DESFEITO em "${x.aresta}" (${x.delta}px): ${x.porque}`);
    }
  }
  marco('planejar', { caminho, celulas: plano.celulas.length, pagina: `${plano.larg}×${plano.alt}` });

  const xml = emitir(plano);

  // O #19 achou isto do jeito caro: XML inválido faz o draw.io renderizar
  // truncado e sair com código 0. Se o gerador não conferir, ninguém confere.
  const malFormado = conferirXml(xml);
  if (malFormado.length) { const e = new Error('XML mal formado — o draw.io renderizaria truncado em silêncio'); e.erros = malFormado; throw e; }

  /**
   * PORTÃO DE CONTRASTE (#13) — e ele REPROVA, não avisa.
   *
   * A razão é a mesma do XML truncado logo acima: rótulo que some não dá erro
   * em lugar nenhum. O arquivo abre, o PNG sai, e o diagrama passa a omitir
   * informação em silêncio — que é a família A4.2 da rubrica (#8), o diagrama
   * que mente por ausência. Um tema é hipótese; aqui ela vira número.
   */
  const c = contraste.medir(plano);
  relatorio.contraste = c;
  if (!c.ok && !opts.forcar) {
    const e = new Error(`o tema "${tema.id}" reprova no portão de contraste (A7 da rubrica #8)`);
    e.erros = [...contraste.resumir(c), '', 'para gerar assim mesmo e VER o estrago: --forcar'];
    throw e;
  }
  if (!c.ok) relatorio.avisos.push(`--forcar: ${c.falhas.length} par(es) abaixo do limiar WCAG, gerado assim mesmo`);
  marco('conferir', { ok: true, bytes: xml.length,
    contraste: c.ok ? 'passa' : 'FORÇADO',
    piorTexto: Number.isFinite(c.piorTexto) ? c.piorTexto.toFixed(2) : '-',
    piorGrafismo: Number.isFinite(c.piorGrafismo) ? c.piorGrafismo.toFixed(2) : '-' });

  // as folhas que caíram no ícone genérico são o sintoma de nome que o
  // catálogo não conhece — vale avisar, não vale falhar
  const genericos = res.usados.filter(u => u.via === 'generico');
  if (genericos.length)
    relatorio.avisos.push(`${genericos.length} nó(s) caíram no ícone genérico: ` +
      genericos.map(u => `${u.id}("${u.pediu}")`).join(', '));

  return { xml, plano, relatorio, resolucoes: res.usados, derivado: d, caminho, tema };
}

// ------------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2);
  const entrada = args.find(a => !a.startsWith('--'));
  if (!entrada) {
    console.error('uso: node gerar.cjs <modelo.json> [--saida arquivo.drawio] [--tema ' +
      temaMod.listar().join('|') + '] [--fluxo solido|tracejado|animado] [--forcar] [--explicar]');
    process.exit(2);
  }
  const iSaida = args.indexOf('--saida');
  const saida = iSaida >= 0 ? args[iSaida + 1] : entrada.replace(/\.json$/, '.drawio');
  const explicar = args.includes('--explicar');
  const iFluxo = args.indexOf('--fluxo');
  const fluxo = iFluxo >= 0 ? args[iFluxo + 1] : null;
  if (fluxo && !['solido', 'tracejado', 'animado'].includes(fluxo)) {
    console.error(`--fluxo aceita solido | tracejado | animado (veio "${fluxo}")`);
    process.exit(2);
  }
  const iTema = args.indexOf('--tema');
  const nomeTema = iTema >= 0 ? args[iTema + 1] : 'claro';
  const forcar = args.includes('--forcar');

  let modelo;
  try { modelo = JSON.parse(fs.readFileSync(entrada, 'utf8')); }
  catch (e) { console.error(`não consegui ler ${entrada}: ${e.message}`); process.exit(1); }

  let r;
  try { r = await gerar(modelo, { fluxo: fluxo || undefined, tema: nomeTema, forcar }); }
  catch (e) {
    console.error(`\n✗ ${e.message}`);
    for (const linha of e.erros || []) console.error(`    · ${linha}`);
    process.exit(1);
  }

  for (const p of r.relatorio.passos)
    console.log(`  ${p.nome.padEnd(10)} ${Object.entries(p).filter(([k]) => k !== 'nome')
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : v}`).join('  ')}`);
  for (const a of r.relatorio.avisos) console.log(`  ⚠ ${a}`);
  if (r.tema.tokens.aresta.fluxo === 'animado')
    console.log('  ⚠ fluxo "animado" só se vê em SVG ou HTML. O #4 mediu e este motor confirmou: ' +
      'exportado para PNG vira um tracejado ESTÁTICO, sem erro nenhum. Exporte com -f svg.');

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
