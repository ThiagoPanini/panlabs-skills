'use strict';
/**
 * O acordo — a aprovacao da vista logica virada fato conferivel.
 *
 * A premissa 2 do #1 poe a aprovacao ENTRE as duas fases, e chama a progressao
 * de coracao do produto. O que este arquivo faz e recusar que essa aprovacao
 * seja um booleano.
 *
 *   `aprovado: true` sobrevive a tudo. Voce aprova a vista logica, a sessao
 *   seguinte elabora tecnicamente, alguem acrescenta uma capacidade que nunca
 *   foi discutida, e o booleano continua dizendo sim. O diagrama tecnico sai com
 *   o carimbo de aprovado por cima de uma arquitetura que ninguem aprovou.
 *
 * O acordo guarda o RECORTE da projecao logica aprovada. Reconferir e reprojetar
 * o modelo de hoje e comparar. Se bate, a elaboracao tecnica e fiel; se nao
 * bate, a diferenca sai no vocabulario da conversa — "voce aprovou 12
 * capacidades, o modelo tecnico serve 11" — e nao em hash contra hash.
 */

const { projetar, recorteDoAcordo } = require('./project.cjs');
const { impressaoDoAcordo, canonicalizar } = require('./fingerprint.cjs');

/** Sela a aprovacao no dossie. Nao muda mais nada do modelo. */
function aprovar(sessao, quem = {}) {
  const { modelo } = projetar(sessao, 'logical');
  const snapshot = recorteDoAcordo(modelo);
  const output = JSON.parse(JSON.stringify(sessao));
  output.dossier = output.dossier || {};
  output.dossier.agreement = {
    view: 'logical',
    fingerprint: impressaoDoAcordo(snapshot),
    snapshot,
    ...(quem.at ? { at: quem.at } : {}),
    ...(quem.by ? { by: quem.by } : {}),
    ...(quem.candidate ? { candidate: quem.candidate } : {}),
  };
  return output;
}

/**
 * O modelo de hoje ainda serve o que foi aprovado?
 *
 * Esta e a rastreabilidade que o #14 temia perder ao usar um IR so. Com dois
 * modelos ligados por mapeamento, responder isto exige que o mapeamento esteja
 * certo — e nada garante que esteja. Com um IR, a resposta e uma projecao e uma
 * comparacao de strings.
 */
function check(sessao) {
  const agreement = sessao.dossier && sessao.dossier.agreement;
  if (!agreement) return { ok: false, motivo: 'sem acordo', diferencas: [] };

  const { modelo } = projetar(sessao, 'logical');
  const agora = recorteDoAcordo(modelo);
  const fingerprint = impressaoDoAcordo(agora);
  if (fingerprint === agreement.fingerprint) return { ok: true, fingerprint, diferencas: [] };

  return { ok: false, motivo: 'a projecao logica de hoje difere da aprovada', fingerprint,
    esperada: agreement.fingerprint, diferencas: diferencaDoRecorte(agreement.snapshot, agora) };
}

/** A diferenca no vocabulario da conversa, nao no do XML. */
function diferencaDoRecorte(antes, depois) {
  const out = [];
  const porId = l => new Map((l || []).map(x => [x.id, x]));
  const a = porId(antes.nodes), d = porId(depois.nodes);

  for (const [id, n] of a) if (!d.has(id))
    out.push({ o: 'capability', kind: 'sumiu', id, text: `"${n.label || id}" foi aprovada e o modelo tecnico nao a serve` });
  for (const [id, n] of d) if (!a.has(id))
    out.push({ o: 'capability', kind: 'apareceu', id, text: `"${n.label || id}" nao estava na vista aprovada` });
  for (const [id, n] of d) {
    const v = a.get(id); if (!v) continue;
    if (v.label !== n.label) out.push({ o: 'capability', kind: 'label', id, text: `"${v.label}" virou "${n.label}"` });
    if (v.inside !== n.inside) out.push({ o: 'capability', kind: 'fronteira', id, text: `"${v.label || id}" mudou de fronteira: ${v.inside || '(raiz)'} → ${n.inside || '(raiz)'}` });
    if (v.kind !== n.kind) out.push({ o: 'capability', kind: 'kind', id, text: `"${v.label || id}" mudou de tipo: ${v.kind} → ${n.kind}` });
  }

  const chave = e => `${e.from}→${e.to}`;
  const ea = new Map((antes.edges || []).map(e => [chave(e), e]));
  const ed = new Map((depois.edges || []).map(e => [chave(e), e]));
  for (const [k, e] of ea) if (!ed.has(k)) out.push({ o: 'flow', kind: 'sumiu', id: k, text: `o fluxo ${k} ("${e.label || ''}") foi aprovado e nao existe mais` });
  for (const [k, e] of ed) if (!ea.has(k)) out.push({ o: 'flow', kind: 'apareceu', id: k, text: `o fluxo ${k} ("${e.label || ''}") nao estava na vista aprovada` });
  for (const [k, e] of ed) {
    const v = ea.get(k); if (!v) continue;
    if (v.label !== e.label) out.push({ o: 'flow', kind: 'label', id: k, text: `${k}: "${v.label}" virou "${e.label}"` });
    if ((v.data || 'out') !== (e.data || 'out')) out.push({ o: 'flow', kind: 'sentido', id: k, text: `${k}: sentido do dado ${v.data || 'out'} → ${e.data || 'out'}` });
  }

  const na = new Set((antes.notes || []).map(canonicalizar));
  const nd = new Set((depois.notes || []).map(canonicalizar));
  for (const n of na) if (!nd.has(n)) out.push({ o: 'note', kind: 'sumiu', id: n.slice(0, 40), text: `uma nota aprovada sumiu — se for a do achado recusado, o desenho volta a enganar calado (#15 §4)` });
  for (const n of nd) if (!na.has(n)) out.push({ o: 'note', kind: 'apareceu', id: n.slice(0, 40), text: 'nota nova na vista logica' });

  return out;
}

module.exports = { aprovar, check, diferencaDoRecorte };
