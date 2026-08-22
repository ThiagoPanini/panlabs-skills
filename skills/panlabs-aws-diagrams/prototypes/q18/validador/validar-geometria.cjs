'use strict';
/**
 * O validador geométrico — a fachada.
 *
 *   const { validarGeometria } = require('./validador/validar-geometria.cjs');
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
 *   O precedente: o motor JÁ corrige, e no lugar certo. `alinhar.cjs` faz
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
const { criarCena } = require(path.join(__dirname, 'cena.cjs'));
const { CHECAGENS, porId } = require(path.join(__dirname, 'indice.cjs'));

// A ordem é a do §Resumo de prioridade da rubrica, não a alfabética.
const FAMILIAS = [
  ['A3', require(path.join(__dirname, 'familias', 'a3-sobreposicao.cjs'))],
  ['A4', require(path.join(__dirname, 'familias', 'a4-agrupamento.cjs'))],
  ['A1', require(path.join(__dirname, 'familias', 'a1-completude.cjs'))],
  ['A5', require(path.join(__dirname, 'familias', 'a5-arestas.cjs'))],
  ['A7', require(path.join(__dirname, 'familias', 'a7-acessibilidade.cjs'))],
  ['A2', require(path.join(__dirname, 'familias', 'a2-notacao.cjs'))],
  ['A6', require(path.join(__dirname, 'familias', 'a6-distribuicao.cjs'))],
  ['A8', require(path.join(__dirname, 'familias', 'a8-volume.cjs'))],
];
const extras = require(path.join(__dirname, 'familias', 'extras.cjs'));

/**
 * @param {object} plano   o plano do motor (pós-`planejar`, pré-`emitir`)
 * @param {object} [opts]  `{ modelo }` quando o plano não carrega o embutido
 * @returns {{ok, falhas, avisos, resultados, extras, resumo, cena, cobertura}}
 */
function validarGeometria(plano, opts = {}) {
  const cena = criarCena(plano, opts);

  const resultados = [];
  for (const [familia, roda] of FAMILIAS) {
    let obtidos;
    try {
      obtidos = roda(cena);
    } catch (e) {
      // Uma família que estoura não pode derrubar as outras sete, e muito menos
      // sair calada: o erro vira falha reportada, com o id da família.
      obtidos = [{
        id: familia, nome: `família ${familia}`, familia, insumo: 'geometria',
        severidadeMaxima: 'fail', semantica: false, calibravel: false,
        estado: 'erro', mensagem: `a família ${familia} estourou: ${e.message}`,
        medida: { pilha: String(e.stack || '').split('\n').slice(0, 3) }, ocorrencias: [],
      }];
    }
    resultados.push(...obtidos);
  }

  const doValidador = CHECAGENS.filter(c => c.insumo !== 'render').map(c => c.id);
  const vistos = new Set(resultados.map(r => r.id));
  const naoRodaram = doValidador.filter(id => !vistos.has(id));

  const achadosExtras = extras(cena);

  const falhas = [...resultados, ...achadosExtras].filter(r => r.estado === 'falha' || r.estado === 'erro');
  const avisos = [...resultados, ...achadosExtras].filter(r => r.estado === 'aviso');
  const semanticas = falhas.filter(r => r.semantica);

  const conta = estado => resultados.filter(r => r.estado === estado).length;
  const resumo = {
    total: resultados.length,
    ok: conta('ok'),
    aviso: conta('aviso'),
    falha: conta('falha'),
    inaplicavel: conta('inaplicavel'),
    pulada: conta('pulada'),
    erro: conta('erro'),
    falhas_semanticas: semanticas.length,
    ocorrencias: [...resultados, ...achadosExtras].reduce((s, r) => s + r.ocorrencias.length, 0),
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

const SIMBOLO = { ok: '✓', aviso: '⚠', falha: '✗', inaplicavel: '·', pulada: '↷', erro: '‼' };

/** O laudo em texto. `opts.tudo` mostra também o que passou. */
function formatar(r, opts = {}) {
  const linhas = [];
  const mostrar = x => opts.tudo || ['falha', 'aviso', 'erro'].includes(x.estado);

  let familiaAtual = null;
  for (const x of [...r.resultados, ...r.extras]) {
    if (!mostrar(x)) continue;
    if (x.familia !== familiaAtual) { linhas.push(''); familiaAtual = x.familia; }
    const marca = x.semantica && x.estado === 'falha' ? '  ← falha semântica' : '';
    linhas.push(`  ${SIMBOLO[x.estado] || '?'} ${x.id.padEnd(5)} ${x.nome}${marca}`);
    if (x.mensagem) linhas.push(`        ${x.mensagem}`);
    for (const o of x.ocorrencias.slice(0, opts.ocorrencias || 5)) linhas.push(`        · ${o.o_que}`);
    if (x.ocorrencias.length > (opts.ocorrencias || 5))
      linhas.push(`        · … e mais ${x.ocorrencias.length - (opts.ocorrencias || 5)}`);
  }

  const s = r.resumo;
  linhas.push('');
  linhas.push(`  ${s.total} checagens: ${s.ok} ok · ${s.aviso} aviso · ${s.falha} falha · ` +
    `${s.inaplicavel} inaplicável · ${s.pulada} do render${s.erro ? ` · ${s.erro} erro` : ''}`);
  if (r.cobertura.naoRodaram.length)
    linhas.push(`  ‼ ${r.cobertura.naoRodaram.length} checagem(ns) do validador não rodaram: ${r.cobertura.naoRodaram.join(', ')}`);
  if (s.falhas_semanticas)
    linhas.push(`  ✗ ${s.falhas_semanticas} falha(s) SEMÂNTICA(s) — o desenho afirma o que o modelo nega`);
  return linhas.join('\n');
}

/** Uma linha por checagem, para diffar dois laudos. */
const resumirPorId = r => Object.fromEntries([...r.resultados, ...r.extras].map(x => [x.id, x.estado]));

module.exports = { validarGeometria, formatar, resumirPorId, porId };
