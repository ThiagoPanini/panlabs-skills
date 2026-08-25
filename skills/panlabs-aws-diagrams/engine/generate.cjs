#!/usr/bin/env node
'use strict';
/**
 * Motor de geração — IR › layout › mxGraph XML.
 *
 *   node engine/generate.cjs modelo.json --output diagrama.drawio
 *   node engine/generate.cjs modelo.json --explain        # só o relatório, sem escrever
 *
 * O pipeline inteiro, e a fronteira que ele defende:
 *
 *   carregar › VALIDAR › resolver › derivar › dispor › planejar › emitir › CONFERIR
 *              ^^^^^^^                        ^^^^^^                        ^^^^^^^^
 *              o agente para aqui             1º número                     XML + contraste
 *
 * O tema (#13) entra em `resolver` — ANTES do layout, não depois. Dez dos seus
 * tokens são métrica (corpo do rótulo, densidade da grade, qualificador em duas
 * linhas) e movem coordenada; os outros dezessete são pintura pura. A partição
 * está provada em `tests/check-partition.cjs`.
 *
 * Nada entre `dispor` e `conferir` tem como ser influenciado pelo modelo a não
 * ser pela semântica. Não é disciplina: o esquema não tem onde escrever uma
 * coordenada. Ver `tools/check-fronteira.cjs`.
 */

const fs = require('fs');
const path = require('path');

const { validate } = require('./validate.cjs');
const resolverMod = require('./resolve.cjs');
const { derive } = require('./derive.cjs');
const camadasMod = require('./layers.cjs');
const dispor = require('./layout.cjs');
const plan = require('./plan.cjs');
const { emit, checkXml } = require('./emit.cjs');
const temaMod = require('../theme/theme.cjs');
const contraste = require('./contrast.cjs');
const { gate, LEVELS } = require('../validator/gate.cjs');

// O esquema é ÚNICO e mora na raiz da skill, não dentro do motor: ele é o
// contrato de quem escreve o modelo, e o motor é só o primeiro consumidor dele.
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schema.json'), 'utf8'));

/**
 * As vistas de detalhe, uma por conta — e elas NÃO são plano B.
 *
 * O #6 `D2` é explícito, e a estrutura do PPTX oficial do SRA prova: slide 3 é
 * a consolidada (6 contas, ZERO conectores) e os slides 7–12 são uma conta cada,
 * com 2 a 7 conectores intra-conta. As duas coisas são publicadas ao mesmo
 * tempo. O corte não acontece "quando fica cheio demais" — é estrutural.
 *
 * O jeito de construí-las é a melhor prova de que a fronteira do motor está no
 * lugar: a vista de detalhe é O MESMO motor rodando num SUBMODELO. Nada aqui
 * sabe desenhar; recorta semântica e chama o pipeline de novo.
 */
async function paginasDeDetalhe(model, d, res, opts, relatorio) {
  const plan = require('./plan.cjs');
  const dispor = require('./layout.cjs');
  const pages = [];

  for (const account of model.nodes.filter(n => n.kind === 'account')) {
    const inside = new Set();
    (function mark(id) { inside.add(id); for (const k of d.t.filhos.get(id)) mark(k.id); })(account.id);

    // as travessias viram TEXTO, não geometria — `E3`: "o texto substitui a
    // cardinalidade". A vista de detalhe carrega só aresta intra-conta.
    const entram = d.travessias.filter(a => a.contaPara === account.id);
    const saem = d.travessias.filter(a => a.contaDe === account.id);
    const nomeDaConta = id => {
      const c = d.t.byId.get(id);
      return (c && c.label) || id;
    };
    const notes = [];
    for (const a of saem)
      notes.push({ text: `Sai desta conta: ${a.label || 'ligação'} → ${nomeDaConta(a.contaPara)}`, origin: 'legend' });
    for (const a of entram)
      notes.push({ text: `Entra nesta conta: ${a.label || 'ligação'} ← ${nomeDaConta(a.contaDe)}`, origin: 'legend' });

    const sub = {
      schema: model.schema,
      id: `${model.id}-${account.id}`,
      title: `${account.label || account.id}`,
      subtitle: `Vista de detalhe · ${model.title}`,
      view: model.view,
      ...(model.genre ? { genre: model.genre } : {}),
      nodes: model.nodes
        .filter(n => inside.has(n.id))
        .map(n => (n.id === account.id ? { ...n, inside: undefined } : { ...n }))
        .map(n => { const c = { ...n }; if (c.inside === undefined) delete c.inside; return c; }),
      edges: (model.edges || []).filter(a => inside.has(a.from) && inside.has(a.to)),
      bands: (model.bands || []).filter(f => f.members.every(m => inside.has(m))),
      notes,
    };

    try {
      const v = validate(sub, SCHEMA);
      if (!v.ok) throw Object.assign(new Error(`submodelo inválido (${v.fase})`), { erros: v.erros });
      const ds = derive(sub, { cat: res.cat });
      if (ds.az.draw) {
        // a grade de AZ ainda não desenha a caixa de conta como raiz — ver o
        // README. Recusar alto é melhor que desenhar a conta fora do lugar.
        throw new Error('a grade de AZ não desenha conta como container raiz');
      }
      const layout = await dispor.porElk(sub, ds, res);
      const p = plan.elkPlan(sub, ds, res, layout, opts);
      pages.push(p);
    } catch (e) {
      relatorio.avisos.push(
        `vista de detalhe de "${account.id}" não saiu: ${e.message}` +
        (e.erros ? ` — ${e.erros[0]}` : ''));
    }
  }
  return pages;
}

async function generate(model, opts = {}) {
  const relatorio = { avisos: [], passos: [] };
  const milestone = (name, extra) => relatorio.passos.push({ name, ...extra });

  const v = validate(model, SCHEMA);
  if (!v.ok) { const e = new Error(`modelo inválido (${v.fase})`); e.erros = v.erros; throw e; }
  relatorio.avisos.push(...v.avisos);
  milestone('validate', { nodes: model.nodes.length, edges: (model.edges || []).length });

  // `--flow` é override de invocação sobre o token do tema: a mesma arquitetura
  // com o mesmo tema pode querer marcar o caminho quente numa entrega e não na
  // outra. Sobrescreve o token, e NÃO mutando o objeto de quem chamou — um tema
  // é um valor, e `comPatch` devolve outro.
  const base = (opts.tema && typeof opts.tema === 'object') ? opts.tema
    : temaMod.load(opts.tema || 'light');
  const tema = opts.flow ? temaMod.withPatch(base, { edge: { flow: opts.flow } }) : base;
  milestone('theme', { id: tema.id, background: tema.background, density: tema.tokens.gap.density, flow: tema.tokens.edge.flow });

  const res = resolverMod.create(tema, opts.catalog);

  const d = derive(model, { cat: res.cat });
  milestone('derive', { faixasAz: d.az.draw, because: d.az.because, azs: d.az.azs });

  // A camada de rede que o motor leu do conteúdo (#22). O agente não escreveu
  // nenhuma delas, salvo onde declarou o escape — e é justamente por isso que
  // vale contar: a ordem das linhas passou a depender desta leitura.
  for (const [id, c] of d.camadas)
    if (c.diverge)
      relatorio.avisos.push(`subnet "${id}": declarada como camada "${c.layer}", ` +
        `mas o que ela guarda é "${c.diverge}" (${c.evidence.map(e => e.service).join(', ')}). ` +
        `O motor obedece à declaração.`);

  let layoutPlan, caminho;
  const pages = [];
  if (d.modo.modo !== 'none') {
    // multi-conta manda no caminho, mesmo com faixa de AZ possível: a conta é o
    // nível mais externo da árvore, e quem escolhe a grade é o container mais
    // externo que precisa de grade. A faixa de AZ dentro de uma conta é
    // trabalho da vista de detalhe daquela conta (D2).
    caminho = 'accounts';
    const g = await dispor.porContas(model, d, res);
    layoutPlan = plan.accountPlan(model, d, res, g, opts);
    milestone('dispor', {
      modo: d.modo.modo, accounts: d.modo.accounts, travessias: d.modo.travessias,
      order: g.order.map(c => c.id).join('→'),
      varredura: g.varredura.varridas ? `${g.varredura.varridas} permutações, custo ${g.varredura.custo}` : 'canônica',
    });
    relatorio.avisos.push(`modo "${d.modo.modo}": ${d.modo.because}`);
    relatorio.avisos.push(`travessia nível ${d.policy.level} (${d.policy.mecanismo}): ${d.policy.because}`);
    // O gatilho (`d.ou.desenhar`) só sabe da CONTA — não do modo. `plan.cjs`
    // (§3) suprime a faixa em integração, e o aviso tinha ficado cego a essa
    // segunda condição: anunciava a faixa mesmo quando o `.drawio` saía sem
    // nenhuma. O aviso só afirma o que o desenho de fato tem.
    if (d.ou.draw) {
      relatorio.avisos.push(d.modo.modo === 'integracao'
        ? `faixas de OU: ${d.ou.because}, mas o modo integração não desenha faixa de OU`
        : `faixas de OU: ${d.ou.because}`);
    }
    pages.push(...await paginasDeDetalhe(model, d, res, opts, relatorio));
  } else if (d.az.draw) {
    caminho = 'grade';
    // O caminho da grade é uma vista de REDE: ele sabe desenhar nuvem › VPC ›
    // subnet › conteúdo e nada mais. Silenciar um container que ele não modela
    // seria produzir um diagrama que omite parte da arquitetura sem avisar —
    // exatamente o tipo de mentira calada que a rubrica (#8) chama de A4.2.
    const outsiders = model.nodes.filter(n =>
      ['account', 'region', 'security-group', 'group'].includes(n.kind) ||
      (['service', 'block', 'actor'].includes(n.kind) &&
        !(n.inside && d.t.byId.get(n.inside) && d.t.byId.get(n.inside).kind === 'subnet')));
    if (outsiders.length) {
      const e = new Error('o caminho da grade ainda não desenha estes nós');
      e.erros = outsiders.map(n => `"${n.id}" (${n.kind}) — a grade de AZ modela só nuvem › VPC › subnet › conteúdo`);
      throw e;
    }
    const g = await dispor.porGrade(model, d, res);
    layoutPlan = plan.gridPlan(model, d, res, g, opts);
    milestone('dispor', {
      eixo: g.eixo,
      raias: g.zonas.join('/'),
      varredura: g.varreduraRaias.varridas
        ? `${g.varreduraRaias.varridas} permutações, custo ${g.varreduraRaias.custo}`
        : 'ordem declarada',
    });
    relatorio.avisos.push(`eixo da grade "${g.eixo}": ${g.porqueEixo}`);
  } else {
    caminho = 'elk';
    /**
     * Aqui a camada que falta AVISA, não recusa — e a assimetria com a grade é
     * a decisão do #22, não descuido.
     *
     * O motor exige o fato onde o fato É o desenho, e avisa onde ele é só
     * desempate. Na grade a chave de papel manda sozinha na ordem das linhas;
     * no ELK ela só decide entre irmãos que nenhuma aresta ordena, e o ELK tem
     * o grafo inteiro para mandar nele. Recusar aqui bloquearia o caso comum
     * por uma ambiguidade que quase nunca chega ao desenho.
     */
    if (d.gaps.length)
      relatorio.avisos.push('camada de rede ausente onde a ordem dos irmãos depende dela — ' +
        'o ELK decide pelo grafo, o alfabeto desempata o resto:\n      ' +
        camadasMod.textoDaLacuna(d.gaps).join('\n      '));
    const layout = await dispor.porElk(model, d, res);
    layoutPlan = plan.elkPlan(model, d, res, layout, opts);
    milestone('dispor', { passadas: layout.passadas });
    if (layout.encaixe) {
      for (const a of layout.encaixe.aplicados)
        relatorio.avisos.push(`encaixe: "${a.edge}" alinhada movendo ${a.moveu.join('+')} em ${a.delta}px`);
      for (const x of layout.encaixe.desfeitos)
        relatorio.avisos.push(`encaixe DESFEITO em "${x.edge}" (${x.delta}px): ${x.because}`);
    }
  }
  milestone('plan', {
    caminho, celulas: layoutPlan.celulas.length, page: `${layoutPlan.larg}×${layoutPlan.alt}`,
    ...(pages.length ? { pages: 1 + pages.length } : {}),
  });

  /**
   * O PORTÃO GEOMÉTRICO (#18) — entre `planejar` e `emitir`, que é o único ponto
   * onde a geometria já existe e o XML ainda não.
   *
   * O #18 escreveu a decisão e deixou o enxerto por fazer de propósito ("o motor
   * é protótipo de outro ticket"). A consolidação do #23 aplica, e escolhe o
   * default com cuidado:
   *
   *   O LAUDO SAI SEMPRE. Ele viaja em `relatorio.geometria` e o `--explain` o
   *   imprime. Um portão que só existe quando alguém pede é um portão que
   *   ninguém sabe que existe.
   *
   *   BLOQUEAR É OPT-IN (`--gate`). O próprio #18 chama `veracidade` de
   *   "default recomendado para um portão de PUBLICAÇÃO" — publicar, não
   *   desenhar. Bloquear em `gerar` faria o motor recusar `web-flow-3-az`, que
   *   é dívida real, nomeada e de dono conhecido (#24): a geração pararia por um
   *   defeito de roteamento que este ticket decidiu não consertar. Recusar
   *   desenhar é decisão de quem entrega, e ela tem hora.
   *
   *   ⚠️ E QUEM DECIDE SE BARRA É O `portao()`, NÃO ESTE ARQUIVO. A primeira
   *   versão desta seção chamava `portao(p, {nivel:'nenhum'})` dentro de um
   *   `try` e reimplementava o `NIVEIS[nivel](laudo)` aqui fora — e com isso
   *   engolia a garantia mais importante do #18: *"um laudo incompleto nunca
   *   passa, EM NENHUM NÍVEL"*. Uma família de checagem quebrada virava
   *   `{erro: ...}`, o `if (!laudo) continue` pulava a página, e o portão saía
   *   verde sobre um laudo que não mediu nada. Chamar `portao()` com o nível
   *   pedido e deixar ele lançar é ao mesmo tempo a correção e a simplificação.
   */
  const level = opts.gate || 'none';
  if (!(level in LEVELS)) {
    const e = new Error(`unknown gate level: "${level}"`);
    e.erros = [`níveis: ${Object.keys(LEVELS).join(', ')}`];
    throw e;
  }
  const laudos = [];
  for (const [i, p] of [layoutPlan, ...pages].entries()) {
    const page = p.id || `p${i}`;
    try {
      laudos.push({ page, report: gate(p, { level }) });
    } catch (e) {
      e.message = `a página "${page}": ${e.message}`;
      throw e;
    }
  }
  relatorio.geometry = laudos;
  const semanticas = laudos.flatMap(l => l.report.semanticas);
  const falhas = laudos.flatMap(l => l.report.falhas);
  milestone('geometry', {
    pages: laudos.length,
    failure: falhas.length,
    semanticas: semanticas.length,
    gate: level,
  });
  // uma falha SEMÂNTICA é o desenho mentindo, e isso vale um aviso mesmo quando
  // ninguém pediu portão — senão o motor entrega em silêncio o que a rubrica
  // chama de "a falha de maior gravidade de todo o validador"
  for (const f of semanticas)
    relatorio.avisos.push(`⛔ ${f.id} ${f.name}: ${f.mensagem} — o desenho afirma o que o modelo nega`);

  const xml = emit([layoutPlan, ...pages]);

  // O #19 achou isto do jeito caro: XML inválido faz o draw.io renderizar
  // truncado e sair com código 0. Se o gerador não conferir, ninguém confere.
  const malformed = checkXml(xml);
  if (malformed.length) { const e = new Error('XML mal formado — o draw.io renderizaria truncado em silêncio'); e.erros = malformed; throw e; }
  /**
   * PORTÃO DE CONTRASTE (#13) — e ele REPROVA, não avisa.
   *
   * A razão é a mesma do XML truncado logo acima: rótulo que some não dá erro
   * em lugar nenhum. O arquivo abre, o PNG sai, e o diagrama passa a omitir
   * informação em silêncio — que é a família A4.2 da rubrica (#8), o diagrama
   * que mente por ausência. Um tema é hipótese; aqui ela vira número.
   *
   * Roda sobre TODAS as páginas (`medirTodos`), não só a consolidada: com o #12
   * o arquivo passou a ter 1+N páginas, e um portão que olhasse só a primeira
   * deixaria as vistas de detalhe sem guarda nenhuma.
   */
  const c = contraste.measureAll([layoutPlan, ...pages]);
  relatorio.contraste = c;
  if (!c.ok && !opts.force) {
    const e = new Error(`o tema "${tema.id}" reprova no portão de contraste (A7 da rubrica #8)`);
    e.erros = [...contraste.summarize(c), '', 'para gerar assim mesmo e VER o estrago: --force'];
    throw e;
  }
  if (!c.ok) relatorio.avisos.push(`--force: ${c.falhas.length} par(es) abaixo do limiar WCAG, gerado assim mesmo`);
  // A7.2a é ÁREA: avisa e não reprova (ver o cabeçalho de contrast.cjs)
  for (const l of contraste.summarize(c, c.avisos)) relatorio.avisos.push(l);
  const n = v => Number.isFinite(v) ? v.toFixed(2) : '-';
  milestone('check', { ok: true, bytes: xml.length,
    contraste: c.ok ? 'passa' : 'FORÇADO',
    piorTexto: n(c.piorTexto), piorTraco: n(c.piorGrafismo), piorArea: n(c.piorArea) });

  // as folhas que caíram no ícone genérico são o sintoma de nome que o
  // catálogo não conhece — vale avisar, não vale falhar
  const genericos = res.usados.filter(u => u.via === 'generic');
  if (genericos.length)
    relatorio.avisos.push(`${genericos.length} nó(s) caíram no ícone genérico: ` +
      genericos.map(u => `${u.id}("${u.pediu}")`).join(', '));

  return { xml, layoutPlan, pages, relatorio, resolucoes: res.usados, derived: d, caminho, tema };
}

// ------------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith('--'));
  if (!input) {
    console.error('uso: node engine/generate.cjs <modelo.json> [--output arquivo.drawio] [--theme ' +
      temaMod.listAll().join('|') + '] [--flow solido|tracejado|animado] [--force]\n' +
      '                            [--gate ' + Object.keys(LEVELS).join('|') + '] [--explain]');
    process.exit(2);
  }
  const iOutput = args.indexOf('--output');
  const output = iOutput >= 0 ? args[iOutput + 1] : input.replace(/\.json$/, '.drawio');
  const explain = args.includes('--explain');
  const iFluxo = args.indexOf('--flow');
  const flow = iFluxo >= 0 ? args[iFluxo + 1] : null;
  if (flow && !['solid', 'dashed', 'animated'].includes(flow)) {
    console.error(`--flow aceita solido | tracejado | animado (veio "${flow}")`);
    process.exit(2);
  }
  const iTema = args.indexOf('--theme');
  const nomeTema = iTema >= 0 ? args[iTema + 1] : 'light';
  const force = args.includes('--force');
  const iGate = args.indexOf('--gate');
  const gateLevel = iGate >= 0 ? args[iGate + 1] : 'none';

  let model;
  try { model = JSON.parse(fs.readFileSync(input, 'utf8')); }
  catch (e) { console.error(`não consegui ler ${input}: ${e.message}`); process.exit(1); }

  let r;
  try { r = await generate(model, { flow: flow || undefined, tema: nomeTema, force, gate: gateLevel }); }
  catch (e) {
    console.error(`\n✗ ${e.message}`);
    for (const row of e.erros || []) console.error(`    · ${row}`);
    process.exit(1);
  }

  for (const p of r.relatorio.passos)
    console.log(`  ${p.name.padEnd(10)} ${Object.entries(p).filter(([k]) => k !== 'name')
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : v}`).join('  ')}`);
  for (const a of r.relatorio.avisos) console.log(`  ⚠ ${a}`);
  if (r.tema.tokens.edge.flow === 'animated')
    console.log('  ⚠ fluxo "animado" só se vê em SVG ou HTML. O #4 mediu e este motor confirmou: ' +
      'exportado para PNG vira um tracejado ESTÁTICO, sem erro nenhum. Exporte com -f svg.');

  if (explain) {
    console.log('\n  resolução de nomes pelo catálogo:');
    // o motor resolve o mesmo nó mais de uma vez (pré-medição + layout);
    // a trilha de auditoria interessa por nó, não por chamada
    const vistos = new Set();
    for (const u of r.resolucoes.filter(u => !vistos.has(u.id) && vistos.add(u.id)))
      console.log(`    ${String(u.id).padEnd(20)} "${u.pediu}" → ${u.virou}  [${u.via}]` +
        (u.corrections && u.corrections.length ? `  correções: ${u.corrections.join(', ')}` : ''));

    // A camada de rede é derivada mas invisível no desenho — só a ORDEM a
    // denuncia. Sem uma trilha, "por que a Data subnet ficou embaixo?" só se
    // responde relendo o código.
    if (r.derived.camadas.size) {
      console.log('\n  camada de rede das subnets (#22):');
      for (const [id, c] of r.derived.camadas)
        console.log(`    ${String(id).padEnd(20)} ${String(c.layer || '—').padEnd(11)} [${c.via || 'sem evidência'}]` +
          (c.evidence.length ? `  ← ${c.evidence.map(e => `${e.service}(${e.categoria})`).join(', ')}` : ''));
    }

    // O laudo geométrico (#18), pagina a pagina. Sai aqui porque o `--explain`
    // e a trilha de auditoria do motor: quem quer saber POR QUE o desenho ficou
    // assim quer as duas listas, a do catalogo e a da rubrica.
    console.log('\n  laudo geométrico (#18):');
    for (const { page, report } of r.relatorio.geometry) {
      const s = report.resumo;
      console.log(`    ${String(page).padEnd(38)} ${s.ok} ok · ${s.warning} aviso · ${s.failure} falha · ` +
        `${s.notApplicable} inaplicável · ${s.skipped} do render`);
      for (const f of report.semanticas)
        console.log(`      ⛔ ${f.id} ${f.name}: ${f.mensagem}`);
      if (report.falhas.length)
        console.log(`      achados: ${report.falhas.map(f => f.id).join(', ')}`);
    }
    return;
  }

  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, r.xml);
  console.log(`\n  → ${output}  (${r.xml.length} bytes, caminho "${r.caminho}")`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { generate, SCHEMA };
