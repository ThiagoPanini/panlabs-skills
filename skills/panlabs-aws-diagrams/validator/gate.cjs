'use strict';
/**
 * O portão — a decisão 2 do ticket #18, em código e não em prosa.
 *
 * `validarGeometria` devolve um laudo e não decide nada; quem transforma laudo
 * em barreira é esta função, e ela existe separada por um motivo: julgar e
 * bloquear são políticas diferentes. Um relatório de revisão quer o laudo
 * inteiro; um pipeline de publicação quer parar. Misturar os dois obrigaria a
 * escolher um dos comportamentos para todo mundo.
 *
 * ONDE ENCAIXA. No pipeline do #11 —
 *
 *     carregar › VALIDAR › resolver › derivar › dispor › planejar › emitir › conferir
 *                                                        ^^^^^^^^^^
 *                                                        aqui, entre os dois
 *
 * — é o único ponto onde a geometria já existe e o XML ainda não.
 *
 * ✅ O ENXERTO ESTÁ APLICADO desde a consolidação do #23. Quando o #18 fechou, o
 * motor ainda era protótipo de outro ticket e mexer nele de fora misturaria duas
 * fronteiras de decisão; a árvore de produção acabou com essa separação.
 *
 * Como ele entra em `engine/generate.cjs`, e por que assim:
 *
 *   O LAUDO SAI SEMPRE, em `relatorio.geometria`, e uma falha SEMÂNTICA vira
 *   aviso mesmo sem ninguém pedir portão. Um portão que só existe quando alguém
 *   pede é um portão que ninguém sabe que existe.
 *
 *   BLOQUEAR É OPT-IN (`--gate <nível>`, default `nenhum`) — e isto é o que
 *   esta seção já dizia com outras palavras: `veracidade` é o default de um
 *   portão de PUBLICAÇÃO. Publicar e desenhar não são o mesmo ato, e recusar
 *   desenhar tem hora.
 *
 * O QUE ELE NÃO FAZ. Não corrige, não reposiciona, não pede novo layout. A
 * justificativa está em `validate-geometry.cjs`: um laço de correção comandado
 * pelo validador é um segundo otimizador competindo com o ELK, sem gradiente e
 * sem função objetivo, porque o B9 da rubrica proíbe combinar as 62 num score.
 * Quem corrige é `align.cjs`, que tem as alavancas na mão.
 */

const path = require('path');
const { validateGeometry, format } = require(path.join(__dirname, 'validate-geometry.cjs'));

/**
 * Níveis de bloqueio, do mais frouxo ao mais apertado.
 *
 * `veracidade` é o default recomendado para um portão de publicação, e é o
 * único que separa as duas coisas que o #18 insiste em não confundir: um
 * diagrama INCOMPLETO (sem legenda, sem metadados) ainda é verdadeiro e pode
 * ir para a parede; um diagrama que MENTE sobre a fronteira de rede, não.
 */
const LEVELS = {
  none: () => false,
  truthfulness: report => report.semanticas.length > 0,
  failure: report => report.falhas.length > 0,
  strict: report => report.falhas.length > 0 || report.avisos.length > 0,
};

/**
 * Mede o plano e, conforme o nível, deixa passar ou lança.
 *
 * @param {object} plano                o plano do motor, pós-`planejar`
 * @param {object} [opts]
 * @param {string} [opts.nivel]         `nenhum` | `veracidade` | `falha` | `estrito`
 * @param {boolean} [opts.bloquear]     atalho: `true` vira nível `falha`
 * @param {object} [opts.modelo]        quando o plano não carrega o embutido
 * @returns {object} o laudo, quando passa
 * @throws {Error} com `.erros` (linhas legíveis) e `.laudo`, quando barra
 */
function gate(layoutPlan, opts = {}) {
  const report = validateGeometry(layoutPlan, opts);
  const level = opts.level || (opts.bloquear ? 'failure' : 'none');
  const barra = LEVELS[level];
  if (!barra) throw new Error(`nível de portão desconhecido: "${level}" (use ${Object.keys(LEVELS).join(', ')})`);

  // Um laudo incompleto nunca passa, em nenhum nível: se uma checagem que devia
  // rodar não rodou, o verde não quer dizer nada — e é justamente no dia em que
  // alguém quebra uma família que o portão precisa não estar mentindo.
  const incompleto = report.cobertura.naoRodaram.length > 0 || report.resultados.some(r => r.state === 'erro');

  if (!barra(report) && !incompleto) return report;

  const linhas = [];
  if (incompleto) {
    if (report.cobertura.naoRodaram.length)
      linhas.push(`checagens que não rodaram: ${report.cobertura.naoRodaram.join(', ')}`);
    for (const r of report.resultados.filter(x => x.state === 'erro')) linhas.push(r.mensagem);
  }
  for (const r of [...report.semanticas, ...report.falhas.filter(f => !f.semantica)]) {
    linhas.push(`${r.id} ${r.name}${r.semantica ? ' (o desenho afirma o que o modelo nega)' : ''}: ${r.mensagem}`);
    for (const o of r.occurrences.slice(0, 3)) linhas.push(`    · ${o.o_que}`);
  }
  if (level === 'strict') for (const r of report.avisos) linhas.push(`${r.id} ${r.name}: ${r.mensagem}`);

  const erro = new Error(incompleto
    ? 'laudo geométrico incompleto — há checagem que não rodou'
    : `geometria reprovada no portão "${level}"`);
  erro.erros = linhas;
  erro.report = report;
  throw erro;
}

module.exports = { gate, LEVELS, format };
