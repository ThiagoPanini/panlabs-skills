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
const { porId } = require(path.join(__dirname, '..', 'indice.cjs'));

/** Monta o resultado, herdando do índice o que já está declarado lá. */
function resultado(id, estado, extra = {}) {
  const c = porId(id);
  if (!c) throw new Error(`checagem "${id}" não está no índice`);
  return {
    id, nome: c.nome, familia: c.familia, insumo: c.insumo,
    severidadeMaxima: c.severidade, semantica: !!c.semantica, calibravel: !!c.calibravel,
    estado,
    mensagem: extra.mensagem || '',
    medida: extra.medida === undefined ? null : extra.medida,
    ocorrencias: extra.ocorrencias || [],
  };
}

const ok = (id, extra) => resultado(id, 'ok', extra);
const aviso = (id, extra) => resultado(id, 'aviso', extra);
const falha = (id, extra) => resultado(id, 'falha', extra);
const inaplicavel = (id, motivo) => resultado(id, 'inaplicavel', { mensagem: motivo });

/** Puladas herdam do índice o motivo — não há dois lugares onde ele possa divergir. */
function pulada(id) {
  const c = porId(id);
  return resultado(id, 'pulada', { mensagem: c.porqueRender || 'não é do validador' });
}

/**
 * Fecha a checagem pelo que foi achado: nada → ok, achados → a severidade que o
 * índice declarou. Escalona quando a checagem tem os dois níveis.
 */
function conforme(id, ocorrencias, extra = {}) {
  if (!ocorrencias.length) return ok(id, extra);
  const c = porId(id);
  const grave = extra.escalar === undefined ? c.severidade === 'fail' : extra.escalar;
  return resultado(id, grave ? 'falha' : 'aviso', { ...extra, ocorrencias });
}

/** Pares não ordenados de uma lista, sem repetir e sem parear consigo mesmo. */
function* pares(lista) {
  for (let i = 0; i < lista.length; i++)
    for (let j = i + 1; j < lista.length; j++) yield [lista[i], lista[j]];
}

const media = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const desvio = xs => (xs.length ? Math.sqrt(media(xs.map(x => (x - media(xs)) ** 2))) : 0);
const arredonda = (x, n = 3) => Number(Number(x).toFixed(n));

/** Texto do rótulo sem a marcação HTML que o motor injeta (`<b>1.</b> ...`). */
const semTags = s => String(s || '').replace(/<[^>]+>/g, '').trim();

module.exports = { resultado, ok, aviso, falha, inaplicavel, pulada, conforme, pares, media, desvio, arredonda, semTags };
