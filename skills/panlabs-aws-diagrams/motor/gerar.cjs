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
 * O tema (#13) entra em `resolver` — ANTES do layout, não depois. Dez dos seus
 * tokens são métrica (corpo do rótulo, densidade da grade, qualificador em duas
 * linhas) e movem coordenada; os outros dezessete são pintura pura. A partição
 * está provada em `tests/check-particao.cjs`.
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
const camadasMod = require('./camadas.cjs');
const dispor = require('./dispor.cjs');
const planejar = require('./planejar.cjs');
const { emitir, conferirXml } = require('./emitir.cjs');
const temaMod = require('../tema/tema.cjs');
const contraste = require('./contraste.cjs');
const { portao, NIVEIS } = require('../validador/portao.cjs');

// O esquema é ÚNICO e mora na raiz da skill, não dentro do motor: ele é o
// contrato de quem escreve o modelo, e o motor é só o primeiro consumidor dele.
const ESQUEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'esquema.json'), 'utf8'));

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
async function paginasDeDetalhe(modelo, d, res, opts, relatorio) {
  const planejar = require('./planejar.cjs');
  const dispor = require('./dispor.cjs');
  const paginas = [];

  for (const conta of modelo.nos.filter(n => n.tipo === 'conta')) {
    const dentro = new Set();
    (function marcar(id) { dentro.add(id); for (const k of d.t.filhos.get(id)) marcar(k.id); })(conta.id);

    // as travessias viram TEXTO, não geometria — `E3`: "o texto substitui a
    // cardinalidade". A vista de detalhe carrega só aresta intra-conta.
    const entram = d.travessias.filter(a => a.contaPara === conta.id);
    const saem = d.travessias.filter(a => a.contaDe === conta.id);
    const nomeDaConta = id => {
      const c = d.t.porId.get(id);
      return (c && c.rotulo) || id;
    };
    const notas = [];
    for (const a of saem)
      notas.push({ texto: `Sai desta conta: ${a.rotulo || 'ligação'} → ${nomeDaConta(a.contaPara)}`, origem: 'legenda' });
    for (const a of entram)
      notas.push({ texto: `Entra nesta conta: ${a.rotulo || 'ligação'} ← ${nomeDaConta(a.contaDe)}`, origem: 'legenda' });

    const sub = {
      esquema: modelo.esquema,
      id: `${modelo.id}-${conta.id}`,
      titulo: `${conta.rotulo || conta.id}`,
      subtitulo: `Vista de detalhe · ${modelo.titulo}`,
      vista: modelo.vista,
      ...(modelo.genero ? { genero: modelo.genero } : {}),
      nos: modelo.nos
        .filter(n => dentro.has(n.id))
        .map(n => (n.id === conta.id ? { ...n, dentro: undefined } : { ...n }))
        .map(n => { const c = { ...n }; if (c.dentro === undefined) delete c.dentro; return c; }),
      arestas: (modelo.arestas || []).filter(a => dentro.has(a.de) && dentro.has(a.para)),
      faixas: (modelo.faixas || []).filter(f => f.membros.every(m => dentro.has(m))),
      notas,
    };

    try {
      const v = validar(sub, ESQUEMA);
      if (!v.ok) throw Object.assign(new Error(`submodelo inválido (${v.fase})`), { erros: v.erros });
      const ds = derivar(sub, { cat: res.cat });
      if (ds.az.desenhar) {
        // a grade de AZ ainda não desenha a caixa de conta como raiz — ver o
        // README. Recusar alto é melhor que desenhar a conta fora do lugar.
        throw new Error('a grade de AZ não desenha conta como container raiz');
      }
      const layout = await dispor.porElk(sub, ds, res);
      const p = planejar.planoDeElk(sub, ds, res, layout, opts);
      paginas.push(p);
    } catch (e) {
      relatorio.avisos.push(
        `vista de detalhe de "${conta.id}" não saiu: ${e.message}` +
        (e.erros ? ` — ${e.erros[0]}` : ''));
    }
  }
  return paginas;
}

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
  const d = derivar(modelo, { cat: res.cat });
  marco('derivar', { faixasAz: d.az.desenhar, porque: d.az.porque, azs: d.az.azs });

  // A camada de rede que o motor leu do conteúdo (#22). O agente não escreveu
  // nenhuma delas, salvo onde declarou o escape — e é justamente por isso que
  // vale contar: a ordem das linhas passou a depender desta leitura.
  for (const [id, c] of d.camadas)
    if (c.diverge)
      relatorio.avisos.push(`subnet "${id}": declarada como camada "${c.camada}", ` +
        `mas o que ela guarda é "${c.diverge}" (${c.evidencia.map(e => e.servico).join(', ')}). ` +
        `O motor obedece à declaração.`);

  let plano, caminho;
  const paginas = [];
  if (d.modo.modo !== 'nenhum') {
    // multi-conta manda no caminho, mesmo com faixa de AZ possível: a conta é o
    // nível mais externo da árvore, e quem escolhe a grade é o container mais
    // externo que precisa de grade. A faixa de AZ dentro de uma conta é
    // trabalho da vista de detalhe daquela conta (D2).
    caminho = 'contas';
    const g = await dispor.porContas(modelo, d, res);
    plano = planejar.planoDeContas(modelo, d, res, g, opts);
    marco('dispor', {
      modo: d.modo.modo, contas: d.modo.contas, travessias: d.modo.travessias,
      ordem: g.ordem.map(c => c.id).join('→'),
      varredura: g.varredura.varridas ? `${g.varredura.varridas} permutações, custo ${g.varredura.custo}` : 'canônica',
    });
    relatorio.avisos.push(`modo "${d.modo.modo}": ${d.modo.porque}`);
    relatorio.avisos.push(`travessia nível ${d.politica.nivel} (${d.politica.mecanismo}): ${d.politica.porque}`);
    if (d.ou.desenhar) relatorio.avisos.push(`faixas de OU: ${d.ou.porque}`);
    paginas.push(...await paginasDeDetalhe(modelo, d, res, opts, relatorio));
  } else if (d.az.desenhar) {
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
    marco('dispor', {
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
    if (d.lacunas.length)
      relatorio.avisos.push('camada de rede ausente onde a ordem dos irmãos depende dela — ' +
        'o ELK decide pelo grafo, o alfabeto desempata o resto:\n      ' +
        camadasMod.textoDaLacuna(d.lacunas).join('\n      '));
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
  marco('planejar', {
    caminho, celulas: plano.celulas.length, pagina: `${plano.larg}×${plano.alt}`,
    ...(paginas.length ? { paginas: 1 + paginas.length } : {}),
  });

  /**
   * O PORTÃO GEOMÉTRICO (#18) — entre `planejar` e `emitir`, que é o único ponto
   * onde a geometria já existe e o XML ainda não.
   *
   * O #18 escreveu a decisão e deixou o enxerto por fazer de propósito ("o motor
   * é protótipo de outro ticket"). A consolidação do #23 aplica, e escolhe o
   * default com cuidado:
   *
   *   O LAUDO SAI SEMPRE. Ele viaja em `relatorio.geometria` e aparece no
   *   `--explicar`. Um portão que só existe quando alguém pede é um portão que
   *   ninguém sabe que existe.
   *
   *   BLOQUEAR É OPT-IN (`--portao`). O próprio #18 chama `veracidade` de
   *   "default recomendado para um portão de PUBLICAÇÃO" — publicar, não
   *   desenhar. Bloquear em `gerar` faria o motor recusar `web-fluxo-3-az`, que
   *   é dívida real, nomeada e de dono conhecido (#24): a geração pararia por um
   *   defeito de roteamento que este ticket decidiu não consertar. Recusar
   *   desenhar é decisão de quem entrega, e ela tem hora.
   */
  const nivel = opts.portao || 'nenhum';
  if (!(nivel in NIVEIS)) {
    const e = new Error(`nível de portão desconhecido: "${nivel}"`);
    e.erros = [`níveis: ${Object.keys(NIVEIS).join(', ')}`];
    throw e;
  }
  const laudos = [plano, ...paginas].map((p, i) => {
    try { return { pagina: p.id || `p${i}`, laudo: portao(p, { nivel: 'nenhum' }) }; }
    catch (e) { return { pagina: p.id || `p${i}`, erro: e.message }; }
  });
  relatorio.geometria = laudos;
  const semanticas = laudos.flatMap(l => (l.laudo ? l.laudo.semanticas : []));
  const falhas = laudos.flatMap(l => (l.laudo ? l.laudo.falhas : []));
  marco('geometria', {
    paginas: laudos.length,
    falha: falhas.length,
    semanticas: semanticas.length,
    portao: nivel,
  });
  if (nivel !== 'nenhum') {
    for (const { pagina, laudo } of laudos) {
      if (!laudo) continue;
      if (!NIVEIS[nivel](laudo)) continue;
      const e = new Error(`a página "${pagina}" não passa no portão geométrico "${nivel}" (#18)`);
      e.erros = [...(laudo.semanticas.length ? laudo.semanticas : laudo.falhas)
        .map(f => `${f.id} ${f.nome}: ${f.mensagem}`)];
      e.laudo = laudo;
      throw e;
    }
  }
  // uma falha SEMÂNTICA é o desenho mentindo, e isso vale um aviso mesmo quando
  // ninguém pediu portão — senão o motor entrega em silêncio o que a rubrica
  // chama de "a falha de maior gravidade de todo o validador"
  for (const f of semanticas)
    relatorio.avisos.push(`⛔ ${f.id} ${f.nome}: ${f.mensagem} — o desenho afirma o que o modelo nega`);

  const xml = emitir([plano, ...paginas]);

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
   *
   * Roda sobre TODAS as páginas (`medirTodos`), não só a consolidada: com o #12
   * o arquivo passou a ter 1+N páginas, e um portão que olhasse só a primeira
   * deixaria as vistas de detalhe sem guarda nenhuma.
   */
  const c = contraste.medirTodos([plano, ...paginas]);
  relatorio.contraste = c;
  if (!c.ok && !opts.forcar) {
    const e = new Error(`o tema "${tema.id}" reprova no portão de contraste (A7 da rubrica #8)`);
    e.erros = [...contraste.resumir(c), '', 'para gerar assim mesmo e VER o estrago: --forcar'];
    throw e;
  }
  if (!c.ok) relatorio.avisos.push(`--forcar: ${c.falhas.length} par(es) abaixo do limiar WCAG, gerado assim mesmo`);
  // A7.2a é ÁREA: avisa e não reprova (ver o cabeçalho de contraste.cjs)
  for (const l of contraste.resumir(c, c.avisos)) relatorio.avisos.push(l);
  const n = v => Number.isFinite(v) ? v.toFixed(2) : '-';
  marco('conferir', { ok: true, bytes: xml.length,
    contraste: c.ok ? 'passa' : 'FORÇADO',
    piorTexto: n(c.piorTexto), piorTraco: n(c.piorGrafismo), piorArea: n(c.piorArea) });

  // as folhas que caíram no ícone genérico são o sintoma de nome que o
  // catálogo não conhece — vale avisar, não vale falhar
  const genericos = res.usados.filter(u => u.via === 'generico');
  if (genericos.length)
    relatorio.avisos.push(`${genericos.length} nó(s) caíram no ícone genérico: ` +
      genericos.map(u => `${u.id}("${u.pediu}")`).join(', '));

  return { xml, plano, paginas, relatorio, resolucoes: res.usados, derivado: d, caminho, tema };
}

// ------------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2);
  const entrada = args.find(a => !a.startsWith('--'));
  if (!entrada) {
    console.error('uso: node motor/gerar.cjs <modelo.json> [--saida arquivo.drawio] [--tema ' +
      temaMod.listar().join('|') + '] [--fluxo solido|tracejado|animado] [--forcar]\n' +
      '                            [--portao ' + Object.keys(NIVEIS).join('|') + '] [--explicar]');
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
  const iPortao = args.indexOf('--portao');
  const nivelPortao = iPortao >= 0 ? args[iPortao + 1] : 'nenhum';

  let modelo;
  try { modelo = JSON.parse(fs.readFileSync(entrada, 'utf8')); }
  catch (e) { console.error(`não consegui ler ${entrada}: ${e.message}`); process.exit(1); }

  let r;
  try { r = await gerar(modelo, { fluxo: fluxo || undefined, tema: nomeTema, forcar, portao: nivelPortao }); }
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

    // A camada de rede é derivada mas invisível no desenho — só a ORDEM a
    // denuncia. Sem uma trilha, "por que a Data subnet ficou embaixo?" só se
    // responde relendo o código.
    if (r.derivado.camadas.size) {
      console.log('\n  camada de rede das subnets (#22):');
      for (const [id, c] of r.derivado.camadas)
        console.log(`    ${String(id).padEnd(20)} ${String(c.camada || '—').padEnd(11)} [${c.via || 'sem evidência'}]` +
          (c.evidencia.length ? `  ← ${c.evidencia.map(e => `${e.servico}(${e.categoria})`).join(', ')}` : ''));
    }
    return;
  }

  fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
  fs.writeFileSync(saida, r.xml);
  console.log(`\n  → ${saida}  (${r.xml.length} bytes, caminho "${r.caminho}")`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { gerar, ESQUEMA };
