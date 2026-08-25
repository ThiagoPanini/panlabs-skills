'use strict';
/**
 * O validador geométrico — a fachada.
 *
 *   const { validarGeometria } = require('./validator/validate-geometry.cjs');
 *   const r = validarGeometria(plano);
 *   if (!r.ok) console.error(r.falhas.map(f => f.mensagem));
 *
 * A ordem das famílias é a do §Resumo de prioridade de implementação da rubrica
 * — A3+A4, A1, A5, A7, A2, A6, A8 — e não é decorativa: quem lê o relatório de
 * cima para baixo encontra primeiro as falhas duras e semanticamente graves, e
 * só depois o ajuste fino de limiar mole.
 *
 * ------------------------------------------------------------------------
 * A função é PURA, e isso é a decisão 2 do ticket #18
 * ------------------------------------------------------------------------
 *
 * O validador é um PORTÃO, não um otimizador. Roda depois de `planejar` e antes
 * de `emitir` — o único ponto do pipeline onde a geometria já existe e o XML
 * ainda não — e devolve um laudo. Ele não reposiciona nada.
 *
 * A tentação é o contrário: detectou sobreposição, mande o layout tentar de
 * novo com outros parâmetros. Contra isso há um argumento e um precedente.
 *
 *   O argumento: um laço de correção comandado pelo validador é um SEGUNDO
 *   otimizador, competindo com o ELK, sem gradiente e sem função objetivo. As
 *   62 checagens não formam um alvo minimizável — B9 da rubrica é explícito ao
 *   proibir combiná-las num score único, e sem escalar não há o que descer.
 *   Um laço desses ou não converge, ou converge para o que a última checagem
 *   por acaso empurrou.
 *
 *   O precedente: o motor JÁ corrige, e no lugar certo. `align.cjs` faz
 *   `temSobreposicao` → `refitar` → `rerrotear` e DESFAZ a passada quando ela
 *   piora. Isso funciona porque acontece dentro do passo que tem os parâmetros
 *   na mão e sabe o que está trocando. O validador não tem nem uma coisa nem
 *   outra: ele vê o resultado, não as alavancas.
 *
 * Então a divisão é: quem corrige é `dispor`/`alinhar`, com o conhecimento
 * local; quem julga é este módulo, sem poder de escrita. Se uma checagem
 * reprovar sistematicamente, o conserto é ensinar a alavanca ao passo que a
 * tem — não dar poder de layout a quem só sabe medir.
 */

const path = require('path');
const { criarCena } = require(path.join(__dirname, 'scene.cjs'));
const { CHECAGENS, DO_VALIDADOR, porId } = require(path.join(__dirname, 'index.cjs'));

// A ordem é a do §Resumo de prioridade da rubrica, não a alfabética.
const FAMILIAS = [
  ['A3', require(path.join(__dirname, 'families', 'a3-overlap.cjs'))],
  ['A4', require(path.join(__dirname, 'families', 'a4-grouping.cjs'))],
  ['A1', require(path.join(__dirname, 'families', 'a1-completeness.cjs'))],
  ['A5', require(path.join(__dirname, 'families', 'a5-edges.cjs'))],
  ['A7', require(path.join(__dirname, 'families', 'a7-accessibility.cjs'))],
  ['A2', require(path.join(__dirname, 'families', 'a2-notation.cjs'))],
  ['A6', require(path.join(__dirname, 'families', 'a6-distribution.cjs'))],
  ['A8', require(path.join(__dirname, 'families', 'a8-volume.cjs'))],
];
const extras = require(path.join(__dirname, 'families', 'extras.cjs'));

/**
 * @param {object} plano   o plano do motor (pós-`planejar`, pré-`emitir`)
 * @param {object} [opts]  `{ modelo }` quando o plano não carrega o embutido
 * @returns {{ok, falhas, avisos, resultados, extras, resumo, cena, cobertura}}
 */
function validarGeometria(plano, opts = {}) {
  const cena = criarCena(plano, opts);

  const resultados = [];
  for (const [family, roda] of FAMILIAS) {
    let obtidos;
    try {
      obtidos = roda(cena);
    } catch (e) {
      // Uma família que estoura não pode derrubar as outras sete, e muito menos
      // sair calada: o erro vira falha reportada, com o id da família.
      obtidos = [{
        id: family, name: `família ${family}`, family, input: 'geometria',
        severidadeMaxima: 'fail', semantica: false, calibravel: false,
        state: 'erro', mensagem: `a família ${family} estourou: ${e.message}`,
        medida: { pilha: String(e.stack || '').split('\n').slice(0, 3) }, occurrences: [],
      }];
    }
    resultados.push(...obtidos);
  }

  const doValidador = DO_VALIDADOR.map(c => c.id);
  const vistos = new Set(resultados.map(r => r.id));
  const naoRodaram = doValidador.filter(id => !vistos.has(id));

  const achadosExtras = extras(cena);

  const falhas = [...resultados, ...achadosExtras].filter(r => r.state === 'falha' || r.state === 'erro');
  const avisos = [...resultados, ...achadosExtras].filter(r => r.state === 'aviso');
  const semanticas = falhas.filter(r => r.semantica);

  const account = state => resultados.filter(r => r.state === state).length;
  const resumo = {
    total: resultados.length,
    ok: account('ok'),
    aviso: account('aviso'),
    falha: account('falha'),
    notApplicable: account('notApplicable'),
    pulada: account('pulada'),
    erro: account('erro'),
    falhas_semanticas: semanticas.length,
    occurrences: [...resultados, ...achadosExtras].reduce((s, r) => s + r.occurrences.length, 0),
  };

  return {
    // Uma checagem que deveria ter rodado e não rodou reprova o laudo inteiro:
    // um relatório incompleto que se diz verde é pior que um vermelho.
    ok: falhas.length === 0 && naoRodaram.length === 0,
    falhas, avisos, semanticas,
    resultados, extras: achadosExtras, resumo, cena,
    cobertura: { esperadas: doValidador.length, rodaram: doValidador.length - naoRodaram.length, naoRodaram },
  };
}

const SIMBOLO = { ok: '✓', aviso: '⚠', falha: '✗', notApplicable: '·', pulada: '↷', erro: '‼' };

/** O laudo em texto. `opts.tudo` mostra também o que passou. */
function formatar(r, opts = {}) {
  const linhas = [];
  const mostrar = x => opts.tudo || ['falha', 'aviso', 'erro'].includes(x.state);

  let familiaAtual = null;
  for (const x of [...r.resultados, ...r.extras]) {
    if (!mostrar(x)) continue;
    if (x.family !== familiaAtual) { linhas.push(''); familiaAtual = x.family; }
    const marca = x.semantica && x.state === 'falha' ? '  ← falha semântica' : '';
    linhas.push(`  ${SIMBOLO[x.state] || '?'} ${x.id.padEnd(5)} ${x.name}${marca}`);
    if (x.mensagem) linhas.push(`        ${x.mensagem}`);
    for (const o of x.occurrences.slice(0, opts.occurrences || 5)) linhas.push(`        · ${o.o_que}`);
    if (x.occurrences.length > (opts.occurrences || 5))
      linhas.push(`        · … e mais ${x.occurrences.length - (opts.occurrences || 5)}`);
  }

  const s = r.resumo;
  linhas.push('');
  linhas.push(`  ${s.total} checagens: ${s.ok} ok · ${s.aviso} aviso · ${s.falha} falha · ` +
    `${s.notApplicable} inaplicável · ${s.pulada} do render${s.erro ? ` · ${s.erro} erro` : ''}`);
  if (r.cobertura.naoRodaram.length)
    linhas.push(`  ‼ ${r.cobertura.naoRodaram.length} checagem(ns) do validador não rodaram: ${r.cobertura.naoRodaram.join(', ')}`);
  if (s.falhas_semanticas)
    linhas.push(`  ✗ ${s.falhas_semanticas} falha(s) SEMÂNTICA(s) — o desenho afirma o que o modelo nega`);
  return linhas.join('\n');
}

module.exports = { validarGeometria, formatar, porId };
