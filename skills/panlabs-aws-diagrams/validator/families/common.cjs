'use strict';
/**
 * O contrato de resultado, compartilhado pelas oito famílias.
 *
 * Toda checagem devolve o mesmo objeto, e o objeto tem cinco estados possíveis.
 * Os dois últimos existem porque o silêncio é o modo de falhar de um validador:
 * uma checagem que não roda e não diz nada é indistinguível de uma que rodou e
 * aprovou, e o relatório fica verde por não ter olhado.
 *
 *   ok           mediu e passou
 *   aviso        mediu e passou do limiar, sem bloquear
 *   falha        mediu e reprovou
 *   inaplicavel  não havia o que medir NESTE diagrama (zero arestas, zero
 *                grupos). É informação: A5.1 "inaplicável" num desenho sem
 *                aresta é diferente de A5.1 "ok"
 *   pulada       não é do validador. É do render, e o índice diz por quê
 *
 * `medida` carrega o número, sempre — inclusive quando passa. A rubrica pede
 * métrica reportada em doze checagens (B9 é explícito: "não construa um score
 * único, reporte cada métrica separadamente"), e um validador que só fala quando
 * reprova não tem o que reportar no dia em que alguém perguntar se melhorou.
 */

const path = require('path');
const { byId } = require(path.join(__dirname, '..', 'index.cjs'));

/** Monta o resultado, herdando do índice o que já está declarado lá. */
function outcome(id, state, extra = {}) {
  const c = byId(id);
  if (!c) throw new Error(`checagem "${id}" não está no índice`);
  return {
    id, name: c.name, family: c.family, input: c.input,
    severidadeMaxima: c.severity, semantica: !!c.semantica, calibravel: !!c.calibravel,
    state,
    mensagem: extra.mensagem || '',
    measured: extra.measured === undefined ? null : extra.measured,
    occurrences: extra.occurrences || [],
  };
}

const ok = (id, extra) => outcome(id, 'ok', extra);
const warning = (id, extra) => outcome(id, 'warning', extra);
const failure = (id, extra) => outcome(id, 'failure', extra);
const notApplicable = (id, motivo) => outcome(id, 'notApplicable', { mensagem: motivo });

/** Puladas herdam do índice o motivo — não há dois lugares onde ele possa divergir. */
function skipped(id) {
  const c = byId(id);
  return outcome(id, 'skipped', { mensagem: c.porqueRender || 'não é do validador' });
}

/**
 * Fecha a checagem pelo que foi achado: nada → ok, achados → a severidade que o
 * índice declarou. Escalona quando a checagem tem os dois níveis.
 */
function matches(id, occurrences, extra = {}) {
  if (!occurrences.length) return ok(id, extra);
  return outcome(id, byId(id).severity === 'fail' ? 'failure' : 'warning', { ...extra, occurrences });
}

/** Pares não ordenados de uma lista, sem repetir e sem parear consigo mesmo. */
function* pairs(list) {
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) yield [list[i], list[j]];
}

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const deviation = xs => (xs.length ? Math.sqrt(mean(xs.map(x => (x - mean(xs)) ** 2))) : 0);
const roundTo = (x, n = 3) => Number(Number(x).toFixed(n));

/** Texto do rótulo sem a marcação HTML que o motor injeta (`<b>1.</b> ...`). */
const withoutTags = s => String(s || '').replace(/<[^>]+>/g, '').trim();

/**
 * Como um elemento é citado numa mensagem: o id, mais o rótulo quando existe.
 *
 * Mora aqui porque mensagem de erro é produto, e seis cópias da mesma linha é
 * onde uma delas passa a citar só o id — e aí a ocorrência de A4.2 diz
 * "srv está dentro de vpc-b" em vez de dizer de que serviço se trata.
 */
const name = e => `${e.id}${withoutTags(e.label) ? ` ("${withoutTags(e.label)}")` : ''}`;

module.exports = { outcome, ok, warning, failure, notApplicable, skipped, matches, pairs, mean, deviation, roundTo, withoutTags, name };
